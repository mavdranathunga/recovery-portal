import { NextResponse } from "next/server";
import { executeSshCommand } from "@/lib/ssh";
import { getBranchIpMap } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ branch_id: string }> }
) {
  const { branch_id } = await params;

  if (!branch_id) {
    return NextResponse.json({ error: "Missing branch_id" }, { status: 400 });
  }

  try {
    const ipMap = await getBranchIpMap();
    const serverIp = ipMap.get(branch_id.toUpperCase());

    if (!serverIp) {
      return NextResponse.json({ error: `No Server IP found for branch ${branch_id}` }, { status: 404 });
    }

    // Command to get the most recent dump.zip file, trying 'ls' first (for root), falling back to 'sudo ls' (for non-root)
    const command = `{ ls -lt /coins/zyncdump/out/ 2>/dev/null || sudo ls -lt /coins/zyncdump/out/; } | grep dump.zip | head -n 1`;
    
    const result = await executeSshCommand(serverIp, command);

    if (result.code !== 0 && result.code !== null && !result.stdout.trim()) {
      return NextResponse.json({ 
        success: true, 
        status: {
          exists: false,
          filename: null,
          date: null,
          isHealthy: false,
          message: "No dump.zip files found."
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

    // Parse the output: -rw-r--r-- 1 root root 58684561 May 19 11:01 2026-05-19_11.00.01.dump.zip
    const tokens = output.split(/\s+/);
    const filename = tokens[tokens.length - 1];

    if (!filename || !filename.includes('dump.zip')) {
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

    // Parse date from filename: YYYY-MM-DD_HH.MM.SS.dump.zip
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
    console.error(`Server dump check error for ${branch_id}:`, error);
    return NextResponse.json({ error: "Failed to check server dump status", details: error.message }, { status: 500 });
  }
}
