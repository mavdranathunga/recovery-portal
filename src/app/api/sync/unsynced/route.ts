import { NextResponse } from "next/server";
import { getHoConnectionByOrg, parseOrg } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hours = Math.max(0.5, Math.min(72, parseFloat(searchParams.get("hours") || "3")));
  const org = parseOrg(searchParams.get("org"));

  let connection;
  try {
    connection = await getHoConnectionByOrg(org);

    const query = `
      SELECT  s.BRANCHID,
              b.BRANCH_NAME,
              m.IP_ADDRESS,
              s.LAST_SYNC_TIME
      FROM TBL_LOG_SYNC_STATUS s
      JOIN TBL_MST_BRANCH b
        ON b.BRANCH_ID = s.BRANCHID
      LEFT JOIN TBL_MAP_BRANCH2CONNECTION m
        ON m.BRANCH_ID = b.BRANCH_ID
      WHERE s.LAST_SYNC_TIME < (SYSDATE - INTERVAL '${hours}' HOUR)
        AND s.LAST_SYNC_TIME >= ADD_MONTHS(SYSDATE, -1)
      ORDER BY s.LAST_SYNC_TIME
    `;

    const result = await connection.execute(query);

    const unsynced = result.rows?.map((row: any) => ({
      id: row.BRANCHID,
      name: row.BRANCH_NAME,
      ip: row.IP_ADDRESS,
      lastSyncTime: row.LAST_SYNC_TIME,
    })) || [];

    return NextResponse.json({ unsynced, hours, org });
  } catch (error: any) {
    console.error(`Error fetching unsynced branches (org=${org}):`, error);
    return NextResponse.json({ error: "Failed to fetch unsynced branches" }, { status: 500 });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing HO connection in unsynced API:", err);
      }
    }
  }
}

