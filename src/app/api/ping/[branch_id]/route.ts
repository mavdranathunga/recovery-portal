import { NextResponse } from "next/server";
import { getBranchIpMap, parseOrg } from "@/lib/db";
import * as net from "net";

export const dynamic = "force-dynamic";

/**
 * Pings the outlet by attempting a raw TCP connect to its SSH port.
 * This is fast (1-2s) and doesn't require SSH credentials.
 */
function tcpPing(host: string, port: number, timeoutMs: number): Promise<{ reachable: boolean; latencyMs: number | null }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();

    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      const latencyMs = Date.now() - start;
      socket.destroy();
      resolve({ reachable: true, latencyMs });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ reachable: false, latencyMs: null });
    });

    socket.on("error", () => {
      socket.destroy();
      resolve({ reachable: false, latencyMs: null });
    });

    socket.connect(port, host);
  });
}

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
    const ipMap = await getBranchIpMap(org);
    const ip = ipMap.get(branch_id.toUpperCase());

    if (!ip) {
      return NextResponse.json({ error: `No IP found for branch ${branch_id}` }, { status: 404 });
    }

    const port = parseInt(process.env.SSH_PORT || "22", 10);
    const result = await tcpPing(ip, port, 3000);

    return NextResponse.json({
      branch_id,
      ip,
      reachable: result.reachable,
      latencyMs: result.latencyMs,
    });
  } catch (error: any) {
    console.error(`Ping error for ${branch_id}:`, error);
    return NextResponse.json({ error: "Ping failed", details: error.message }, { status: 500 });
  }
}

