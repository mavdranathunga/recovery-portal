import { NextResponse } from "next/server";
import { getHoConnectionByOrg, getOutletConnection, getBranchIpMap, getBranchNameMap, getStatusText, parseOrg } from "@/lib/db";
import type { Connection } from "oracledb";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ dpn_id: string }> } // In Next.js 15+, params is a Promise
) {
  // Await the params since Next.js 15+ standardizes this
  const { dpn_id } = await params;
  const { searchParams } = new URL(request.url);
  const org = parseOrg(searchParams.get("org"));

  if (!dpn_id) {
    return NextResponse.json({ error: "Missing dpn_id" }, { status: 400 });
  }

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
    WHERE dpn_id = :1
  `;

  let hoConn: Connection | null = null;

  try {
    hoConn = await getHoConnectionByOrg(org);
    const branchMap = await getBranchIpMap(org);
    const nameMap = await getBranchNameMap(org);


    // 1. Fetch from HO
    const hoResult = await hoConn.execute<any>(query, [dpn_id], { outFormat: 4002 /* oracledb.OUT_FORMAT_OBJECT */ });
    const hoRecord = (hoResult.rows && hoResult.rows.length > 0) ? hoResult.rows[0] : null;

    // Immediately close HO connection so it doesn't stay open during slow outlet DB queries
    try {
      await hoConn.close();
      hoConn = null;
    } catch (err) {
      console.error("Failed to close hoConn early:", err);
    }

    // Determine target branches from HO record if it exists, otherwise we'd need to guess or it's a 404
    // If it hasn't reached HO yet, the user must specify a shop, or we can't find it easily unless we broadcast.
    // Let's assume the user just searched universally. If it's not in HO, we can only find it if we broadcast, which is bad.
    // But wait, the user's prompt said "if I enter the idt number, I can detect where this is now."
    // We cannot poll 450 DBs instantly to find an IDT that hasn't reached HO. 
    // Usually, the IDT number contains the source branch code (e.g. S001-DPN-0001) or is uniquely identifiable.
    // If it is, we can extract the shop code as a prefix. Let's see if we can try to guess the source branch from dpn_id.

    let srcBranch = hoRecord ? hoRecord.DPN_SRC_BRANCHID : null;
    let destBranch = hoRecord ? hoRecord.DPN_DEST_BRANCHID : null;

    // Guess source branch if HO record is missing but IDT often starts with Branch Code (e.g. 'S001...')
    if (!hoRecord) {
      if (dpn_id.length >= 4) {
        // e.g., 'S00112345' or 'S001-...'
        const maybeBranch = dpn_id.split("-")[0].toUpperCase();
        if (branchMap.has(maybeBranch) || nameMap.has(maybeBranch)) {
          srcBranch = maybeBranch;
        } else if (branchMap.has(dpn_id.substring(0, 4).toUpperCase())) {
           srcBranch = dpn_id.substring(0, 4).toUpperCase();
        }
      }
    }

    let sourceRecord = null;
    let destRecord = null;

    // 2. Fetch from Source Branch
    if (srcBranch && branchMap.has(srcBranch)) {
      const srcIp = branchMap.get(srcBranch);
      if (srcIp) {
        let srcConn: Connection | null = null;
        try {
          srcConn = await getOutletConnection(srcIp);
          const srcResult = await srcConn.execute<any>(query, [dpn_id], { outFormat: 4002 });
          if (srcResult.rows && srcResult.rows.length > 0) {
            sourceRecord = srcResult.rows[0];
            // If HO record was missing, we can now populate destBranch from the source record!
            if (!destBranch) destBranch = sourceRecord.DPN_DEST_BRANCHID;
          }
        } catch (err: any) {
          console.error(`Error fetching source record from ${srcBranch} (${srcIp}):`, err.message);
          const isNetworkError = err.message.includes("ORA-12170") || err.message.includes("TNS:");
          sourceRecord = { error: isNetworkError ? "Connection Failed" : err.message || "Connection failed" };
        } finally {
          if (srcConn) {
            try { await srcConn.close(); } catch (e) { }
          }
        }
      }
    }

    // 3. Fetch from Dest Branch
    if (destBranch && branchMap.has(destBranch)) {
      const destIp = branchMap.get(destBranch);
      if (destIp) {
        let destConn: Connection | null = null;
        try {
          destConn = await getOutletConnection(destIp);
          const destResult = await destConn.execute<any>(query, [dpn_id], { outFormat: 4002 });
          if (destResult.rows && destResult.rows.length > 0) {
            destRecord = destResult.rows[0];
          }
        } catch (err: any) {
          console.error(`Error fetching dest record from ${destBranch} (${destIp}):`, err.message);
          const isNetworkError = err.message.includes("ORA-12170") || err.message.includes("TNS:");
          destRecord = { error: isNetworkError ? "Connection Failed" : err.message || "Connection failed" };
        } finally {
          if (destConn) {
            try { await destConn.close(); } catch (e) { }
          }
        }
      }
    }

    // Format output
    // A helper to normalize the record keys to standard lowercase for the frontend
    const normalizeRecord = (rec: any) => {
      if (!rec || rec.error) return rec;
      return {
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
      };
    };

    return NextResponse.json({
      dpn_id,
      ho: normalizeRecord(hoRecord),
      source: {
        branch_id: srcBranch,
        branch_name: srcBranch ? nameMap.get(srcBranch) : null,
        ip: srcBranch ? branchMap.get(srcBranch) : null,
        record: normalizeRecord(sourceRecord),
      },
      dest: {
        branch_id: destBranch,
        branch_name: destBranch ? nameMap.get(destBranch) : null,
        ip: destBranch ? branchMap.get(destBranch) : null,
        record: normalizeRecord(destRecord),
      }
    });

  } catch (err: any) {
    console.error("Error in IDT API:", err);
    return NextResponse.json({ error: "Backend error", details: err.message }, { status: 500 });
  } finally {
    if (hoConn) {
      try {
        await hoConn.close();
      } catch (err) { }
    }
  }
}
