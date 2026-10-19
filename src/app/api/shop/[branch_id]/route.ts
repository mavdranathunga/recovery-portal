import { NextResponse } from "next/server";
import { getHoConnectionByOrg, getOutletConnection, getBranchIpMap, getStatusText, parseOrg } from "@/lib/db";
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

  const limit = parseInt(searchParams.get("limit") || "50", 10);
  const upperBranchId = branch_id.toUpperCase();

  // Query for outlet DB (connected as IBOM user directly - uses ROWNUM for Oracle 11g compatibility)
  const outletQuery = `
    SELECT * FROM (
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
    )
    WHERE ROWNUM <= :3
  `;

  // Query for HO DB (under IBOM schema)
  const hoQuery = `
    SELECT * FROM (
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
      FROM IBOM.T2024_DPN 
      WHERE (dpn_src_branchid = :1 OR dpn_dest_branchid = :2)
      ORDER BY rec_date DESC
    )
    WHERE ROWNUM <= :3
  `;

  let outletConnected = false;
  let dataSource: "OUTLET" | "HEAD_OFFICE" = "HEAD_OFFICE";
  let connectionWarning: string | null = null;
  let rawRows: any[] = [];
  let outletIp: string | null = null;

  // 1. First, check Branch IP from Head Office cache/mapping
  try {
    const branchMap = await getBranchIpMap(org);
    outletIp = branchMap.get(upperBranchId) || null;
  } catch (err: any) {
    console.warn("Could not load branch IP mapping:", err.message);
  }

  // 2. Attempt to connect directly to the OUTLET database first
  if (outletIp) {
    let outletConn: Connection | null = null;
    try {
      outletConn = await getOutletConnection(outletIp);
      const outletResult = await outletConn.execute<any>(
        outletQuery,
        [upperBranchId, upperBranchId, limit],
        { outFormat: 4002 }
      );
      rawRows = outletResult.rows || [];
      outletConnected = true;
      dataSource = "OUTLET";
    } catch (outletErr: any) {
      console.warn(`Outlet connection failed for ${upperBranchId} (${outletIp}):`, outletErr.message);
      connectionWarning = `Outlet database at ${outletIp} is unreachable. Displaying fallback data from Head Office.`;
    } finally {
      if (outletConn) {
        try { await outletConn.close(); } catch {}
      }
    }
  } else {
    connectionWarning = `No IP address registered for branch ${upperBranchId}. Displaying data from Head Office.`;
  }

  // 3. Fallback to Head Office if outlet was not reachable
  let hoConn: Connection | null = null;
  let last_sync_time = null;
  let branch_name = upperBranchId;

  try {
    hoConn = await getHoConnectionByOrg(org);

    // If outlet was unreachable, fetch DPN records from HO
    if (!outletConnected) {
      const hoResult = await hoConn.execute<any>(
        hoQuery,
        [upperBranchId, upperBranchId, limit],
        { outFormat: 4002 }
      );
      rawRows = hoResult.rows || [];
      dataSource = "HEAD_OFFICE";
    }

    // Always fetch last sync time & branch name from HO metadata tables
    const syncQuery = `SELECT LAST_SYNC_TIME FROM TBL_LOG_SYNC_STATUS WHERE BRANCHID = :1`;
    const nameQuery = `SELECT BRANCH_NAME FROM TBL_MST_BRANCH WHERE BRANCH_ID = :1`;

    try {
      const [syncResult, nameResult] = await Promise.all([
        hoConn.execute<any>(syncQuery, [upperBranchId], { outFormat: 4002 }),
        hoConn.execute<any>(nameQuery, [upperBranchId], { outFormat: 4002 })
      ]);

      if (syncResult.rows && syncResult.rows.length > 0) {
        last_sync_time = syncResult.rows[0].LAST_SYNC_TIME;
      }
      if (nameResult.rows && nameResult.rows.length > 0) {
        branch_name = nameResult.rows[0].BRANCH_NAME.trim();
      }
    } catch (metaErr: any) {
      console.warn("Could not fetch extra branch details from HO:", metaErr.message);
    }
  } catch (hoErr: any) {
    console.error("Error connecting to HO database:", hoErr);
    // If outlet succeeded but HO metadata failed, we still have outlet records
    if (!outletConnected) {
      return NextResponse.json({
        error: "Database error",
        details: hoErr.message,
      }, { status: 500 });
    }
  } finally {
    if (hoConn) {
      try { await hoConn.close(); } catch {}
    }
  }

  const records = rawRows.map(rec => ({
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
    direction: rec.DPN_SRC_BRANCHID === upperBranchId ? "OUTGOING" : "INCOMING"
  }));

  return NextResponse.json({
    branch_id: upperBranchId,
    branch_name,
    branch_ip: outletIp,
    last_sync_time,
    dataSource,
    outletConnected,
    connectionWarning,
    records
  });
}
