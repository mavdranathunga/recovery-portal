import { NextResponse } from "next/server";
import { getBranchIpMap, parseOrg } from "@/lib/db";
import { executeSshCommand } from "@/lib/ssh";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ branch_id: string }> }
) {
  const { branch_id } = await params;
  const { searchParams } = new URL(request.url);
  const org = parseOrg(searchParams.get("org"));

  if (!branch_id) {
    return NextResponse.json({ error: "Missing branch_id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    const branchMap = await getBranchIpMap(org);
    const ip = branchMap.get(branch_id);

    if (!ip) {
      return NextResponse.json({ error: `No IP found for branch ${branch_id}` }, { status: 404 });
    }

    let command = "";

    if (action === "oracle_status") {
      command = "sudo service oracle-xe status";
    } else if (action === "oracle_restart") {
      command = "sudo service oracle-xe stop; sudo lsnrctl stop; sudo rm -rfR /var/tmp/.oracle; sudo lsnrctl start; sudo service oracle-xe start;";
    } else if (action === "tomcat_restart") {
      command = "sudo service tomcat stop; sudo killall -9 java; sudo service tomcat start;";
    } else if (action === "system_stats") {
      // Get CPU (load avg), RAM, and Storage (/)
      command = `
echo "=== CPU Load ==="
cat /proc/loadavg
echo "=== Memory ==="
free -m
echo "=== Storage ==="
df -h /
      `.trim();
    } else if (action === "custom") {
      if (!body.command) return NextResponse.json({ error: "Missing command for custom action" }, { status: 400 });
      command = body.command;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { stdout, stderr, code } = await executeSshCommand(ip, command);

    return NextResponse.json({
      stdout,
      stderr,
      code,
      action
    });

  } catch (err: any) {
    console.error("Error in SSH command execution:", err);
    return NextResponse.json({ error: "Backend error", details: err.message }, { status: 500 });
  }
}
