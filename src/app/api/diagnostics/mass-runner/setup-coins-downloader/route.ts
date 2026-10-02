import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { scpUploadFile, executeSshCommand } from "@/lib/ssh";

export const dynamic = "force-dynamic";

// Local file paths
const LOCAL_ADMIN_KEY = path.resolve(process.cwd(), "ssh", "deshanr");
const LOCAL_SCRIPT = path.resolve(process.cwd(), "Files", "setupCoinsDownloader.sh");
const LOCAL_DOWNLOADER = path.resolve(process.cwd(), "Files", "coinsDumpDownloader");

// Remote paths on the target Till
const REMOTE_ADMIN_KEY = "/tmp/deshanr_key";
const REMOTE_TEMP_SCRIPT = "/tmp/setupCoinsDownloader.sh";
const REMOTE_FINAL_SCRIPT = "/coins/setupCoinsDownloader.sh";
const REMOTE_TEMP_DOWNLOADER = "/tmp/coinsDumpDownloader";
const REMOTE_FINAL_DOWNLOADER = "/coins/coinsDumpDownloader";

export async function POST(request: Request) {
  let body: { ip?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { ip } = body;

  if (!ip || typeof ip !== "string") {
    return NextResponse.json({ error: "Missing or invalid IP address" }, { status: 400 });
  }

  // Pre-flight check: ensure local files exist
  if (!fs.existsSync(LOCAL_ADMIN_KEY)) {
    return NextResponse.json(
      { error: `Administrative key not found locally at ${LOCAL_ADMIN_KEY}` },
      { status: 500 }
    );
  }

  if (!fs.existsSync(LOCAL_SCRIPT)) {
    return NextResponse.json(
      { error: `Setup script not found locally at ${LOCAL_SCRIPT}` },
      { status: 500 }
    );
  }

  if (!fs.existsSync(LOCAL_DOWNLOADER)) {
    return NextResponse.json(
      { error: `Downloader script not found locally at ${LOCAL_DOWNLOADER}` },
      { status: 500 }
    );
  }

  const steps: { step: string; stdout: string; stderr: string; code: number | null }[] = [];
  let authMethod = "N/A";

  // Step 1: Upload admin key (deshanr) to /tmp/deshanr_key
  try {
    const scpKeyResult = await scpUploadFile(ip.trim(), LOCAL_ADMIN_KEY, REMOTE_ADMIN_KEY);
    authMethod = scpKeyResult.authMethod;
    steps.push({
      step: "upload-admin-key",
      stdout: `Admin key successfully copied to ${REMOTE_ADMIN_KEY}`,
      stderr: "",
      code: 0,
    });
  } catch (err: any) {
    steps.push({
      step: "upload-admin-key",
      stdout: "",
      stderr: err.message || String(err),
      code: 1,
    });
    return NextResponse.json(
      { steps, authMethod, error: `Failed to upload admin key to ${REMOTE_ADMIN_KEY}` },
      { status: 500 }
    );
  }

  // Step 2: Upload coinsDumpDownloader to /tmp/coinsDumpDownloader
  try {
    const scpDownloaderResult = await scpUploadFile(ip.trim(), LOCAL_DOWNLOADER, REMOTE_TEMP_DOWNLOADER);
    authMethod = scpDownloaderResult.authMethod || authMethod;
    steps.push({
      step: "upload-downloader",
      stdout: `coinsDumpDownloader uploaded to ${REMOTE_TEMP_DOWNLOADER}`,
      stderr: "",
      code: 0,
    });
  } catch (err: any) {
    steps.push({
      step: "upload-downloader",
      stdout: "",
      stderr: err.message || String(err),
      code: 1,
    });
    return NextResponse.json(
      { steps, authMethod, error: `Failed to upload coinsDumpDownloader to ${REMOTE_TEMP_DOWNLOADER}` },
      { status: 500 }
    );
  }

  // Step 3: Upload setupCoinsDownloader.sh to /tmp/setupCoinsDownloader.sh
  try {
    const scpScriptResult = await scpUploadFile(ip.trim(), LOCAL_SCRIPT, REMOTE_TEMP_SCRIPT);
    authMethod = scpScriptResult.authMethod || authMethod;
    steps.push({
      step: "upload-script",
      stdout: `Setup script uploaded to ${REMOTE_TEMP_SCRIPT}`,
      stderr: "",
      code: 0,
    });
  } catch (err: any) {
    steps.push({
      step: "upload-script",
      stdout: "",
      stderr: err.message || String(err),
      code: 1,
    });
    return NextResponse.json(
      { steps, authMethod, error: `Failed to upload setup script to ${REMOTE_TEMP_SCRIPT}` },
      { status: 500 }
    );
  }

  // Step 4: Move files to /coins, apply chmod +x, and set admin key permissions (600)
  try {
    const stageCmd = `sudo mkdir -p /coins && sudo cp ${REMOTE_TEMP_DOWNLOADER} ${REMOTE_FINAL_DOWNLOADER} && sudo rm -f ${REMOTE_TEMP_DOWNLOADER} && sudo chmod +x ${REMOTE_FINAL_DOWNLOADER} && sudo cp ${REMOTE_TEMP_SCRIPT} ${REMOTE_FINAL_SCRIPT} && sudo rm -f ${REMOTE_TEMP_SCRIPT} && sudo chmod +x ${REMOTE_FINAL_SCRIPT} && sudo chmod 600 ${REMOTE_ADMIN_KEY}`;
    const stageResult = await executeSshCommand(ip.trim(), stageCmd, 20000);
    authMethod = stageResult.authMethod || authMethod;

    steps.push({
      step: "install-files",
      stdout: stageResult.stdout || `Installed scripts and downloader into /coins/ with executable permissions.`,
      stderr: stageResult.stderr,
      code: stageResult.code,
    });

    if (stageResult.code !== 0) {
      return NextResponse.json(
        { steps, authMethod, error: "Failed to install files to /coins/" },
        { status: 500 }
      );
    }
  } catch (err: any) {
    steps.push({
      step: "install-files",
      stdout: "",
      stderr: err.message || String(err),
      code: 1,
    });
    return NextResponse.json(
      { steps, authMethod, error: "Failed to set up files in /coins/" },
      { status: 500 }
    );
  }

  // Step 5: Execute /coins/setupCoinsDownloader.sh (clean mode, 180s timeout)
  try {
    const execResult = await executeSshCommand(
      ip.trim(),
      `sudo ${REMOTE_FINAL_SCRIPT}`,
      180000
    );
    authMethod = execResult.authMethod || authMethod;

    steps.push({
      step: "execute-setup",
      stdout: execResult.stdout,
      stderr: execResult.stderr,
      code: execResult.code,
    });

    const isSuccess = execResult.code === 0;

    // Clean output: keep only summary on success, or concise error on failure
    let cleanOutput = "";
    if (isSuccess) {
      const successIdx = execResult.stdout.indexOf("SETUP COMPLETED SUCCESSFULLY");
      if (successIdx !== -1) {
        const summaryPortion = execResult.stdout.substring(successIdx);
        const cleaned = summaryPortion
          .replace(/=+[\r\n]*/g, "")
          .replace(/SETUP COMPLETED SUCCESSFULLY[\r\n]*/i, "")
          .trim();
        cleanOutput = `✓ SETUP COMPLETED SUCCESSFULLY\n\n${cleaned}`;
      } else {
        cleanOutput = "✓ SETUP COMPLETED SUCCESSFULLY";
      }

      // Ensure downloaded dump filename is displayed
      const dumpMatch = execResult.stdout.match(/([0-9]{4}-[0-9]{2}-[0-9]{2}[0-9_\-\.]*\.dump)/i);
      if (dumpMatch && !cleanOutput.toLowerCase().includes("downloaded dump")) {
        cleanOutput = cleanOutput.replace(/(Server\s*:\s*[^\r\n]+)/i, `$1\nDownloaded dump : ${dumpMatch[1]}`);
      }
    } else {
      const errIdx = execResult.stdout.indexOf("ERROR:");
      if (errIdx !== -1) {
        cleanOutput = execResult.stdout
          .substring(errIdx)
          .replace(/=+[\r\n]*/g, "")
          .trim();
      } else {
        cleanOutput = execResult.stderr.trim() || execResult.stdout.trim() || "Setup failed.";
      }
    }

    return NextResponse.json({
      steps,
      authMethod,
      stdout: cleanOutput,
      stderr: isSuccess ? "" : (execResult.stderr || cleanOutput),
      code: execResult.code,
      error: isSuccess ? null : (cleanOutput || "Setup script execution returned an error."),
    });
  } catch (err: any) {
    steps.push({
      step: "execute-setup",
      stdout: "",
      stderr: err.message || String(err),
      code: 1,
    });
    return NextResponse.json(
      {
        steps,
        authMethod,
        stdout: "",
        stderr: err.message || String(err),
        code: 1,
        error: "Execution failed or timed out",
      },
      { status: 500 }
    );
  }
}

