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
      const mounts = ["/", "/var/spool", "/u01", "/coins", "/storage", "/home"];
      const mountChecks = mounts
        .map((m) => {
          const safe = m.replace(/\//g, "_").replace(/^_/, "") || "root";
          return `MOUNT_${safe}:$(df -h '${m}' 2>/dev/null | awk 'NR==2{gsub(/%/,""); print $5}' || echo "N/A")`;
        })
        .join("|");

      // Extract CPU, MEM, UPTIME, and partitions, while keeping legacy section markers
      command = [
        `echo "CPU:$(top -bn1 2>/dev/null | grep -i 'cpu' | head -n1 | awk '{for(i=1;i<=NF;i++) if($(i+1) ~ /^id/) {print 100-$i; found=1; exit}} END {if(!found) print $2+$4}' 2>/dev/null || top -bn1 2>/dev/null | grep 'Cpu(s)' | awk '{print $2 + $4}')"`,
        `echo "MEM:$(free -m 2>/dev/null | awk '/Mem:/ {if($2>0) printf \"%.1f\", $3/$2*100; else print \"0\"}')"`,
        `echo "UPTIME:$(uptime -p 2>/dev/null | sed 's/up //' || uptime 2>/dev/null | awk '{print $3,$4}' | sed 's/,//')"`,
        `echo "${mountChecks}"`,
        `echo "=== CPU Load ==="`,
        `cat /proc/loadavg 2>/dev/null || true`,
        `echo "=== Memory ==="`,
        `free -m 2>/dev/null || true`,
        `echo "=== Storage ==="`,
        `df -h / 2>/dev/null || true`,
      ].join(" && ");
    } else if (action === "custom") {
      if (!body.command) return NextResponse.json({ error: "Missing command for custom action" }, { status: 400 });
      command = body.command;
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const { stdout, stderr, code } = await executeSshCommand(ip, command);

    let stats: {
      cpu: number | null;
      mem: number | null;
      uptime: string | null;
      mounts: { path: string; pct: number | null }[];
    } | undefined = undefined;

    if (action === "system_stats" && stdout) {
      const matchCpu = stdout.match(/CPU:([0-9.]+)/);
      const matchMem = stdout.match(/MEM:([0-9.]+)/);
      const matchUptime = stdout.match(/UPTIME:(.+)/);

      const cpu = matchCpu && !isNaN(parseFloat(matchCpu[1])) ? Math.round(parseFloat(matchCpu[1])) : null;
      const mem = matchMem && !isNaN(parseFloat(matchMem[1])) ? Math.round(parseFloat(matchMem[1])) : null;
      const uptime = matchUptime ? matchUptime[1].trim() : null;

      const mountsList = ["/", "/var/spool", "/u01", "/coins", "/storage", "/home"];
      const mounts: { path: string; pct: number | null }[] = [];

      for (const m of mountsList) {
        const safe = m.replace(/\//g, "_").replace(/^_/, "") || "root";
        const re = new RegExp(`MOUNT_${safe}:([0-9]+|N\\/A)`);
        const match = stdout.match(re);
        const raw = match ? match[1] : null;
        mounts.push({
          path: m,
          pct: raw && raw !== "N/A" ? parseInt(raw, 10) : null,
        });
      }

      stats = { cpu, mem, uptime, mounts };
    }

    return NextResponse.json({
      stdout,
      stderr,
      code,
      action,
      stats,
    });

  } catch (err: any) {
    console.error("Error in SSH command execution:", err);
    return NextResponse.json({ error: "Backend error", details: err.message }, { status: 500 });
  }
}
