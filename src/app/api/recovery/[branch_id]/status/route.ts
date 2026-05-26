import { NextResponse } from "next/server";
import { getBranchIpMap } from "@/lib/db";
import { executeSshCommand } from "@/lib/ssh";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ branch_id: string }> }
) {
  const { branch_id } = await params;

  if (!branch_id) {
    return NextResponse.json({ error: "Missing branch_id" }, { status: 400 });
  }

  try {
    const ipMap = await getBranchIpMap();
    const ip = ipMap.get(branch_id.toUpperCase());

    if (!ip) {
      return NextResponse.json({ error: `Could not find IP for branch ${branch_id}` }, { status: 404 });
    }

    // Command to get date and atq
    const command = `echo "Date : " ; date; echo "------------------------------------------"; echo "ATQ : "; sudo atq`;
    const result = await executeSshCommand(ip, command);

    return NextResponse.json({
      branch_id,
      ip,
      output: result.stdout,
      error_output: result.stderr,
    });
  } catch (error: any) {
    console.error(`Error checking status for ${branch_id}:`, error);
    return NextResponse.json({ error: "SSH Connection Failed", details: error.message }, { status: 500 });
  }
}
