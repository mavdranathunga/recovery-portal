import { NextResponse } from "next/server";
import { getBranchIpMap, parseOrg } from "@/lib/db";

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

  try {
    const branchMap = await getBranchIpMap(org);
    const ip = branchMap.get(branch_id);

    if (!ip) {
      return NextResponse.json({ error: `No IP found for branch ${branch_id}` }, { status: 404 });
    }

    const targetUrl = org === "idl" ? `http://${ip}:8181/FineSpirits/` : `http://${ip}:8181/sathosa`;
    
    // Fetch with an AbortController for a 5 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let isSuccess = false;
    let statusCode = null;

    try {
      const response = await fetch(targetUrl, { signal: controller.signal, method: "GET" });
      statusCode = response.status;
      if (response.ok) {
        isSuccess = true;
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return NextResponse.json({ success: false, error: "Connection timed out after 5 seconds." });
      }
      return NextResponse.json({ success: false, error: e.message || "Failed to reach Tomcat" });
    } finally {
      clearTimeout(timeoutId);
    }

    return NextResponse.json({
      success: isSuccess,
      status: statusCode,
      message: isSuccess ? "Tomcat is reachable" : `Tomcat returned status ${statusCode}`
    });

  } catch (err: any) {
    console.error("Error checking Tomcat status:", err);
    return NextResponse.json({ error: "Backend error", details: err.message }, { status: 500 });
  }
}
