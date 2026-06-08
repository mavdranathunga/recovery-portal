import { NextResponse } from "next/server";
import { getHoConnectionByOrg, parseOrg } from "@/lib/db";
import type { Connection } from "oracledb";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ branch_id: string }> }
) {
  const { branch_id } = await params;
  const { searchParams } = new URL(request.url);
  const org = parseOrg(searchParams.get("org"));

  if (!branch_id) {
    return NextResponse.json({ error: "Missing branch_id" }, { status: 400 });
  }

  let hoConn: Connection | null = null;
  
  try {
    hoConn = await getHoConnectionByOrg(org);
    
    const syncQuery = `SELECT LAST_SYNC_TIME FROM TBL_LOG_SYNC_STATUS WHERE BRANCHID = :1`;
    const nameQuery = `SELECT BRANCH_NAME FROM TBL_MST_BRANCH WHERE BRANCH_ID = :1`;

    const [syncResult, nameResult] = await Promise.all([
      hoConn.execute<any>(syncQuery, [branch_id.toUpperCase()], { outFormat: 4002 }),
      hoConn.execute<any>(nameQuery, [branch_id.toUpperCase()], { outFormat: 4002 })
    ]);
    
    const last_sync_time = (syncResult.rows && syncResult.rows.length > 0) ? syncResult.rows[0].LAST_SYNC_TIME : null;
    const branch_name = (nameResult.rows && nameResult.rows.length > 0) ? nameResult.rows[0].BRANCH_NAME.trim() : branch_id.toUpperCase();

    // Close early
    try {
      await hoConn.close();
      hoConn = null;
    } catch (err) {}

    return NextResponse.json({
      branch_id: branch_id.toUpperCase(),
      branch_name,
      last_sync_time,
      org,
    });

  } catch (err: any) {
    console.error(`Error in Sync API (org=${org}):`, err);
    return NextResponse.json({ error: "Backend error", details: err.message }, { status: 500 });
  } finally {
    if (hoConn) {
      try {
        await hoConn.close();
      } catch (err) {}
    }
  }
}
