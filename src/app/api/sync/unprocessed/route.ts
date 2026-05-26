import { NextResponse } from "next/server";
import { getHoConnection } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minutes = Math.max(1, Math.min(1440, parseInt(searchParams.get("minutes") || "5", 10)));

  let connection;
  try {
    connection = await getHoConnection();

    const query = `
      SELECT *
      FROM TBL_LOG_SYNC_FILE_STATUS
      WHERE queue_process_time IS NULL
      AND queue_time <= SYSDATE - (${minutes}/1440)
      order by QUEUE_TIME
    `;

    const result = await connection.execute(query);

    // Map result rows to plain objects (Oracle returns uppercase keys)
    const unprocessed = result.rows?.map((row: any) => {
      const obj: any = {};
      for (const key of Object.keys(row)) {
        obj[key] = row[key];
      }
      return obj;
    }) || [];

    return NextResponse.json({ unprocessed, minutes });
  } catch (error: any) {
    console.error("Error fetching unprocessed files:", error);
    return NextResponse.json({ error: "Failed to fetch unprocessed files" }, { status: 500 });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing HO connection in unprocessed API:", err);
      }
    }
  }
}
