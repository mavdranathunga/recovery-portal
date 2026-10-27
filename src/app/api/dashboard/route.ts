import { NextResponse } from "next/server";
import { getHoConnectionByOrg, parseOrg } from "@/lib/db";
import { executeSshCommand } from "@/lib/ssh";
import type { Connection } from "oracledb";

export const dynamic = "force-dynamic";

// Per-server mount points to monitor
const CORE_SERVERS = [
  {
    id: "ho_db",
    name: "HO DB Server",
    ip: "192.168.16.9",
    role: "Database (Oracle)",
    mounts: ["/", "/oraundo", "/oraredo", "/home", "/archivelogs", "/u02", "/backup"],
  },
  {
    id: "ho_sync",
    name: "HO SYNC Server",
    ip: "192.168.16.3",
    role: "Sync Engine",
    mounts: ["/", "/home", "/storage", "/coins", "/var/log"],
  },
  {
    id: "ho_app",
    name: "HO APP Server",
    ip: "192.168.16.10",
    role: "Application Server",
    mounts: ["/", "/home", "/u01", "/coins"],
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const org = parseOrg(searchParams.get("org"));
  const section = searchParams.get("section"); // 'db', 'servers', or undefined for all

  const responsePayload: {
    counts?: any;
    tablespaces?: any[];
    servers?: any[];
    errors?: Record<string, string>;
  } = {};

  const errors: Record<string, string> = {};

  // 1. DATABASE QUERIES (Only SELECT, connection closed immediately)
  if (!section || section === "db") {
    let hoConn: Connection | null = null;
    try {
      hoConn = await getHoConnectionByOrg(org);

      // 1. Active Outlets count
      const activeOutletsQuery = `
        SELECT count(*) AS COUNT
        FROM TBL_MST_BRANCH
        WHERE BRANCH_ID LIKE '%S%'
          AND STATUS IN ('A')
      `;

      // 2. Active Warehouses count
      const activeWhQuery = `
        SELECT count(*) AS COUNT
        FROM TBL_MST_BRANCH
        WHERE BRANCH_ID NOT LIKE '%S%'
          AND BRANCH_ID NOT LIKE '%H%'
          AND STATUS IN ('A')
      `;

      // 3. Unsynced Outlets count (>5 hours)
      const unsyncedOutletsQuery = `
        SELECT count(*) AS COUNT
        FROM TBL_LOG_SYNC_STATUS s
        JOIN TBL_MST_BRANCH b
          ON b.BRANCH_ID = s.BRANCHID
        LEFT JOIN TBL_MAP_BRANCH2CONNECTION m
          ON m.BRANCH_ID = b.BRANCH_ID
        WHERE s.LAST_SYNC_TIME < (SYSDATE - INTERVAL '3' HOUR)
          AND s.LAST_SYNC_TIME >= ADD_MONTHS(SYSDATE, -1)
      `;

      // 4. Pronto posted count breakdown (latest 3 days)
      const prontoPostedQuery = `
        SELECT
            TRUNC(latest_trans_date) AS TRANS_DATE,
            COUNT(*) AS OUTLET_COUNT
        FROM (
            SELECT
                outlet_code,
                MAX(trans_date) AS latest_trans_date
            FROM lsn.bksalespgl2
            GROUP BY outlet_code
        )
        WHERE latest_trans_date >= TRUNC(SYSDATE) - 3
          AND latest_trans_date < TRUNC(SYSDATE) + 1
        GROUP BY TRUNC(latest_trans_date)
        ORDER BY TRANS_DATE DESC
      `;

      // 5. Not posted to pronto for 3 days (Detailed list & count)
      const prontoNotPostedListQuery = `
        SELECT
            b.BRANCH_ID AS OUTLET_CODE,
            b.BRANCH_NAME,
            s.LATEST_TRANS_DATE
        FROM TBL_MST_BRANCH b
        INNER JOIN TBL_MAP_BRANCH2CONNECTION c
            ON b.BRANCH_ID = c.BRANCH_ID
        INNER JOIN (
            SELECT
                OUTLET_CODE,
                MAX(TRANS_DATE) AS LATEST_TRANS_DATE
            FROM LSN.BKSALESPGL2
            GROUP BY OUTLET_CODE
        ) s
            ON s.OUTLET_CODE = b.BRANCH_ID
        WHERE b.STATUS = 'A'
          AND s.LATEST_TRANS_DATE < TRUNC(SYSDATE) - 3
        ORDER BY s.LATEST_TRANS_DATE DESC
      `;

      // 6. Tablespace utilization query
      const tablespacesQuery = `
        SELECT 
            tablespace_name AS TABLESPACE_NAME,
            ROUND(used_space * 8192 / (1024 * 1024 * 1024), 2) AS USED_GB,
            ROUND(tablespace_size * 8192 / (1024 * 1024 * 1024), 2) AS TOTAL_GB,
            ROUND(used_percent, 2) AS USED_PCT
        FROM dba_tablespace_usage_metrics
        ORDER BY used_percent DESC
      `;

      // Run read-only SELECT queries concurrently on the single session
      const [
        outletsRes,
        whRes,
        unsyncedRes,
        prontoPostedRes,
        prontoNotPostedRes,
        tablespacesRes,
      ] = await Promise.all([
        hoConn.execute<any>(activeOutletsQuery, [], { outFormat: 4002 }),
        hoConn.execute<any>(activeWhQuery, [], { outFormat: 4002 }),
        hoConn.execute<any>(unsyncedOutletsQuery, [], { outFormat: 4002 }),
        hoConn.execute<any>(prontoPostedQuery, [], { outFormat: 4002 }),
        hoConn.execute<any>(prontoNotPostedListQuery, [], { outFormat: 4002 }),
        hoConn.execute<any>(tablespacesQuery, [], { outFormat: 4002 }),
      ]);

      const activeOutletsCount = outletsRes.rows?.[0]?.COUNT ?? 0;
      const activeWhCount = whRes.rows?.[0]?.COUNT ?? 0;
      const unsyncedOutletsCount = unsyncedRes.rows?.[0]?.COUNT ?? 0;
      const prontoNotPostedList = (prontoNotPostedRes.rows || []).map((r: any) => ({
        outlet_code: r.OUTLET_CODE,
        branch_name: r.BRANCH_NAME?.trim(),
        latest_trans_date: r.LATEST_TRANS_DATE,
      }));

      const prontoPosted = (prontoPostedRes.rows || []).map((r: any) => ({
        trans_date: r.TRANS_DATE,
        outlet_count: r.OUTLET_COUNT,
      }));

      responsePayload.counts = {
        activeOutlets: activeOutletsCount,
        activeWarehouses: activeWhCount,
        unsyncedOutlets: unsyncedOutletsCount,
        pendingDayEnd: null, // Kept empty as requested
        prontoNotPostedCount: prontoNotPostedList.length,
        prontoNotPostedList,
        prontoPosted,
      };

      responsePayload.tablespaces = (tablespacesRes.rows || []).map((r: any) => ({
        name: r.TABLESPACE_NAME,
        usedGb: Number(r.USED_GB || 0),
        totalGb: Number(r.TOTAL_GB || 0),
        usedPct: Number(r.USED_PCT || 0),
      }));
    } catch (dbErr: any) {
      console.error("Dashboard DB query error:", dbErr);
      const rawMsg = dbErr?.message || "";
      if (rawMsg.includes("ORA-12170") || rawMsg.includes("connect timeout")) {
        errors.database = "HO Database connection timed out. Please check network connectivity.";
      } else if (rawMsg.includes("ORA-01017")) {
        errors.database = "Invalid database credentials for Head Office database.";
      } else if (rawMsg.includes("ORA-12541") || rawMsg.includes("TNS:no listener")) {
        errors.database = "Cannot reach Oracle listener on HO Database server.";
      } else {
        errors.database = "Unable to fetch data from HO Database. Please try refreshing.";
      }
    } finally {
      if (hoConn) {
        try {
          await hoConn.close();
        } catch (closeErr) {
          console.warn("Failed to close HO connection:", closeErr);
        }
      }
    }
  }

  if (!section || section === "servers") {
    const serverPromises = CORE_SERVERS.map(async (server) => {
      // Build df checks for each named mount point: MOUNT_<safe>:<pct>
      const mountChecks = server.mounts
        .map((m) => {
          const safe = m.replace(/\//g, "_").replace(/^_/, "") || "root";
          // df returns "N/A" when mount doesn't exist; use || to handle missing
          return `MOUNT_${safe}:$(df -h '${m}' 2>/dev/null | awk 'NR==2{gsub(/%/,""); print $5}' || echo "N/A")`;
        })
        .join("|");

      const cmd = [
        `echo "CPU:$(top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}')"`,
        `echo "MEM:$(free -m | awk '/Mem:/ {printf \"%.1f\", $3/$2*100}')"`,
        `echo "UPTIME:$(uptime -p 2>/dev/null | sed 's/up //' || uptime | awk '{print $3,$4}' | sed 's/,//')"`,
        `echo "${mountChecks}"`,
      ].join(" && ");

      try {
        const { stdout, code } = await executeSshCommand(server.ip, cmd, 10000);

        let cpu: number | null = null;
        let mem: number | null = null;
        let uptime: string | null = null;
        const mounts: { path: string; pct: number | null }[] = [];
        let status = "online";

        if (code === 0 && stdout) {
          const matchCpu = stdout.match(/CPU:([0-9.]+)/);
          const matchMem = stdout.match(/MEM:([0-9.]+)/);
          const matchUptime = stdout.match(/UPTIME:(.+)/);

          cpu = matchCpu ? Math.round(parseFloat(matchCpu[1])) : null;
          mem = matchMem ? Math.round(parseFloat(matchMem[1])) : null;
          uptime = matchUptime ? matchUptime[1].trim() : null;

          // Parse each mount point
          for (const m of server.mounts) {
            const safe = m.replace(/\//g, "_").replace(/^_/, "") || "root";
            const re = new RegExp(`MOUNT_${safe}:([0-9]+|N\/A)`);
            const match = stdout.match(re);
            const raw = match ? match[1] : null;
            mounts.push({
              path: m,
              pct: raw && raw !== "N/A" ? parseInt(raw, 10) : null,
            });
          }
        } else {
          status = "error";
        }

        return {
          id: server.id,
          name: server.name,
          ip: server.ip,
          role: server.role,
          status,
          cpu,
          mem,
          uptime,
          mounts,
          updatedAt: new Date().toISOString(),
        };
      } catch (sshErr: any) {
        return {
          id: server.id,
          name: server.name,
          ip: server.ip,
          role: server.role,
          status: "offline",
          cpu: null,
          mem: null,
          uptime: null,
          mounts: [] as { path: string; pct: number | null }[],
          error: sshErr?.message || "Connection failed",
          updatedAt: new Date().toISOString(),
        };
      }
    });

    responsePayload.servers = await Promise.all(serverPromises);
  }

  if (Object.keys(errors).length > 0) {
    responsePayload.errors = errors;
  }

  return NextResponse.json({
    success: true,
    data: responsePayload,
    timestamp: new Date().toISOString(),
  });
}
