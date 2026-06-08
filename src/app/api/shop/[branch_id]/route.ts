import { NextResponse } from "next/server";
import { getHoConnectionByOrg, getStatusText, parseOrg } from "@/lib/db";
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

  // Optional: Read pagination or limit parameters from URL
  const limit = parseInt(searchParams.get("limit") || "50", 10);

  const query = `
    SELECT 
      dpn_id, 
      dpn_src_branchid, 
      dpn_dest_branchid, 
      dpn_status, 
      effective_date, 
      rec_date, 
      lupd_date, 
      zync_date, 
      dpn_commit_date 
    FROM T2024_DPN 
    WHERE (dpn_src_branchid = :1 OR dpn_dest_branchid = :2)
    ORDER BY rec_date DESC
    FETCH FIRST :3 ROWS ONLY
  `;

  let hoConn: Connection | null = null;

  try {
    hoConn = await getHoConnectionByOrg(org);


    // To monitor a shop efficiently, we first ask HO "what IDTs exist for this shop?"
    // Contacting the shop database to list 50 records right away is slow and only 
    // gives us half the picture (the synced status from HO's perspective is most important).
    const hoResult = await hoConn.execute<any>(query, [branch_id, branch_id, limit], { outFormat: 4002 });

    const records = (hoResult.rows || []).map(rec => ({
      dpn_id: rec.DPN_ID,
      dpn_src_branchid: rec.DPN_SRC_BRANCHID,
      dpn_dest_branchid: rec.DPN_DEST_BRANCHID,
      dpn_status: rec.DPN_STATUS,
      status_text: getStatusText(rec.DPN_STATUS),
      effective_date: rec.EFFECTIVE_DATE,
      rec_date: rec.REC_DATE,
      lupd_date: rec.LUPD_DATE,
      sync_date: rec.ZYNC_DATE,
      dpn_commit_date: rec.DPN_COMMIT_DATE,
      // For quick filtering
      direction: rec.DPN_SRC_BRANCHID === branch_id ? "OUTGOING" : "INCOMING"
    }));

    const syncQuery = `SELECT LAST_SYNC_TIME FROM TBL_LOG_SYNC_STATUS WHERE BRANCHID = :1`;
    const nameQuery = `SELECT BRANCH_NAME FROM TBL_MST_BRANCH WHERE BRANCH_ID = :1`;
    
    let last_sync_time = null;
    let branch_name = branch_id;

    try {
      const [syncResult, nameResult] = await Promise.all([
        hoConn.execute<any>(syncQuery, [branch_id], { outFormat: 4002 }),
        hoConn.execute<any>(nameQuery, [branch_id], { outFormat: 4002 })
      ]);

      if (syncResult.rows && syncResult.rows.length > 0) {
        last_sync_time = syncResult.rows[0].LAST_SYNC_TIME;
      }
      if (nameResult.rows && nameResult.rows.length > 0) {
        branch_name = nameResult.rows[0].BRANCH_NAME.trim();
      }
    } catch (err: any) {
      console.warn("Could not fetch extra branch details:", err.message);
    }

    // Close early
    try {
      await hoConn.close();
      hoConn = null;
    } catch (err) {}

    return NextResponse.json({
      branch_id,
      branch_name,
      last_sync_time,
      records
    });

  } catch (err: any) {
    console.error("Error in Shop API:", err);
    return NextResponse.json({ error: "Backend error", details: err.message }, { status: 500 });
  } finally {
    if (hoConn) {
      try {
        await hoConn.close();
      } catch (err) { }
    }
  }
}
