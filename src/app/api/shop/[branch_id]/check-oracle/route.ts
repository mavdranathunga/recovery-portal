import { NextResponse } from "next/server";
import { getBranchIpMap, getOutletConnection } from "@/lib/db";
import type { Connection } from "oracledb";

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
    const branchMap = await getBranchIpMap();
    const ip = branchMap.get(branch_id);

    if (!ip) {
      return NextResponse.json({ error: `No IP found for branch ${branch_id}` }, { status: 404 });
    }

    let conn: Connection | null = null;
    let isSuccess = false;
    let message = "";

    try {
      conn = await getOutletConnection(ip);
      // Run a simple query to verify the connection is alive
      const result = await conn.execute("SELECT 1 AS VAL FROM DUAL");
      if (result.rows && result.rows.length > 0) {
        isSuccess = true;
        message = "Oracle DB (IBOM) connection successful";
      } else {
        message = "Connected, but query failed to return data";
      }
    } catch (err: any) {
      isSuccess = false;
      message = err.message || "Failed to connect to Oracle DB";
    } finally {
      if (conn) {
        try {
          await conn.close();
        } catch (e) {
          console.error("Error closing Oracle connection:", e);
        }
      }
    }

    return NextResponse.json({
      success: isSuccess,
      message
    });

  } catch (err: any) {
    console.error("Error checking Oracle status:", err);
    return NextResponse.json({ error: "Backend error", details: err.message }, { status: 500 });
  }
}
