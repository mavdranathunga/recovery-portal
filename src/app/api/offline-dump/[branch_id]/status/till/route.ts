import { NextResponse } from "next/server";
import { executeTillSshCommand } from "@/lib/ssh";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ branch_id: string }> }
) {
  const { branch_id } = await params;

  if (!branch_id) {
    return NextResponse.json({ error: "Missing branch_id" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { tillIp } = body;
  if (!tillIp) {
    return NextResponse.json({ error: "Missing tillIp in request body" }, { status: 400 });
  }

  try {
    // Command to get the most recent .dump file in /coins/in/, handling both root and deshanr users
    const command = `if command -v sudo >/dev/null 2>&1; then sudo ls -lt /coins/in/; else ls -lt /coins/in/; fi | grep "\\.dump$" | head -n 1`;
    
    const result = await executeTillSshCommand(tillIp, command);

    if (result.code !== 0 && result.code !== null && !result.stdout.trim()) {
      return NextResponse.json({ 
        success: true, 
        status: {
          exists: false,
          filename: null,
          date: null,
          isHealthy: false,
          message: "No .dump files found."
        }
      });
    }

    const output = result.stdout.trim();
    if (!output) {
       return NextResponse.json({ 
        success: true, 
        status: {
          exists: false,
          filename: null,
          date: null,
          isHealthy: false,
          message: "Directory empty or missing."
        }
      });
    }

    // Parse the output: -rw-r--r-- 1 oracle dba 343638016 May 19 10:01 2026-05-19_10.00.02.dump
    const tokens = output.split(/\s+/);
    const filename = tokens[tokens.length - 1];

    if (!filename || !filename.endsWith('.dump')) {
      return NextResponse.json({ 
        success: true, 
        status: {
          exists: false,
          filename: null,
          date: null,
          isHealthy: false,
          message: "Could not parse filename."
        }
      });
    }

    // Parse date from filename: YYYY-MM-DD_HH.MM.SS.dump
    const dateMatch = filename.match(/^(\d{4}-\d{2}-\d{2})/);
    let isHealthy = false;
    let fileDate = null;

    if (dateMatch && dateMatch[1]) {
      fileDate = dateMatch[1]; // YYYY-MM-DD
      
      // Get today's date in local time
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      
      isHealthy = fileDate === todayStr;
    }

    return NextResponse.json({
      success: true,
      status: {
        exists: true,
        filename,
        date: fileDate,
        isHealthy,
        message: isHealthy ? "Dump is up to date." : "Dump is outdated."
      }
    });

  } catch (error: any) {
    console.error(`Till dump check error for ${branch_id} at ${tillIp}:`, error);
    return NextResponse.json({ error: "Failed to check till dump status", details: error.message }, { status: 500 });
  }
}
