import { NextResponse } from "next/server";
import path from "path";
import { scpUploadFile, executeSshCommand } from "@/lib/ssh";

export const dynamic = "force-dynamic";

// Absolute path to the script on this server
const LOCAL_FILE = path.resolve(process.cwd(), "Files", "coinsInstallOracle");

// Where it lands on the remote server (deshanr home dir)
const REMOTE_PATH = "/home/deshanr/coinsInstallOracle";

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

  const steps: { step: string; stdout: string; stderr: string; code: number | null }[] = [];
  let authMethod = "N/A";

  // Step 1: SCP upload
  try {
    const scpResult = await scpUploadFile(ip.trim(), LOCAL_FILE, REMOTE_PATH);
    authMethod = scpResult.authMethod;
    steps.push({ step: "scp", stdout: `File uploaded to ${REMOTE_PATH}`, stderr: "", code: 0 });
  } catch (err: any) {
    steps.push({ step: "scp", stdout: "", stderr: err.message || String(err), code: 1 });
    return NextResponse.json({ steps, authMethod, error: "SCP upload failed" }, { status: 500 });
  }

  // Step 2: chmod +x
  try {
    const chmod = await executeSshCommand(ip.trim(), `chmod +x ${REMOTE_PATH}`, 10000);
    authMethod = chmod.authMethod || authMethod;
    steps.push({ step: "chmod", stdout: chmod.stdout, stderr: chmod.stderr, code: chmod.code });
    if (chmod.code !== 0) {
      return NextResponse.json({ steps, authMethod, error: "chmod failed" }, { status: 500 });
    }
  } catch (err: any) {
    steps.push({ step: "chmod", stdout: "", stderr: err.message || String(err), code: 1 });
    return NextResponse.json({ steps, authMethod, error: "chmod failed" }, { status: 500 });
  }

  // Step 3: Execute (2-min timeout to accommodate Oracle setup)
  try {
    const exec = await executeSshCommand(
      ip.trim(),
      `sudo bash ${REMOTE_PATH}`,
      120000
    );
    authMethod = exec.authMethod || authMethod;
    steps.push({ step: "exec", stdout: exec.stdout, stderr: exec.stderr, code: exec.code });
  } catch (err: any) {
    steps.push({ step: "exec", stdout: "", stderr: err.message || String(err), code: 1 });
    return NextResponse.json({ steps, authMethod, error: "Execution failed" }, { status: 500 });
  }

  const finalStep = steps[steps.length - 1];
  return NextResponse.json({
    steps,
    authMethod,
    stdout: steps.map((s) => `[${s.step.toUpperCase()}]\n${s.stdout}`).filter(Boolean).join("\n\n"),
    stderr: steps
      .map((s) => (s.stderr ? `[${s.step.toUpperCase()} STDERR]\n${s.stderr}` : ""))
      .filter(Boolean)
      .join("\n\n"),
    code: finalStep.code,
  });
}
