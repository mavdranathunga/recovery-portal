import { NextResponse } from "next/server";
import { getBranchIpMap } from "@/lib/db";
import * as net from "net";

export const dynamic = "force-dynamic";

/**
 * Pings the outlet by attempting a raw TCP connect to its SSH port.
 * This is fast (1-2s) and doesn't require SSH credentials.
 */
function tcpPing(host: string, port: number, timeoutMs: number): Promise<{ reachable: boolean; ip: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on("connect", () => {
      socket.destroy();
      resolve({ reachable: true, ip: host });
    });

    socket.on("timeout", () => {
      socket.destroy();
      resolve({ reachable: false, ip: host });
    });

    socket.on("error", () => {
      socket.destroy();
      resolve({ reachable: false, ip: host });
    });

    socket.connect(port, host);
  });
}

function generatePossibleTillIps(serverIp: string): string[] {
  const parts = serverIp.split(".");
  if (parts.length !== 4) return [];

  const base = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const lastOctet = parseInt(parts[3], 10);
  
  const possibleIps = new Set<string>();

  // Standard case 1: server is .50, tills are .101, .102, .103, .104
  possibleIps.add(`${base}.101`);
  possibleIps.add(`${base}.102`);
  possibleIps.add(`${base}.103`);
  possibleIps.add(`${base}.104`);

  // Standard case 2: /28 subnet, server is e.g. .5, tills are .6, .7, .8, .9
  // General rule: check D+1 to D+4
  if (!isNaN(lastOctet)) {
    for (let i = 1; i <= 4; i++) {
      if (lastOctet + i <= 254) {
        possibleIps.add(`${base}.${lastOctet + i}`);
      }
    }
  }

  return Array.from(possibleIps);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ branch_id: string }> }
) {
  const { branch_id } = await params;

  if (!branch_id) {
    return NextResponse.json({ error: "Missing branch_id" }, { status: 400 });
  }

  try {
    const ipMap = await getBranchIpMap();
    const serverIp = ipMap.get(branch_id.toUpperCase());

    if (!serverIp) {
      return NextResponse.json({ error: `No Server IP found for branch ${branch_id}` }, { status: 404 });
    }

    const possibleIps = generatePossibleTillIps(serverIp);
    const port = parseInt(process.env.SSH_PORT || "22", 10);
    
    // Ping all possible IPs concurrently
    const pingPromises = possibleIps.map(ip => tcpPing(ip, port, 2000));
    const results = await Promise.all(pingPromises);
    
    // Filter out only the reachable ones
    const activeTills = results.filter(r => r.reachable).map(r => r.ip);

    // Sort IP addresses numerically
    activeTills.sort((a, b) => {
      const aOctet = parseInt(a.split(".")[3], 10);
      const bOctet = parseInt(b.split(".")[3], 10);
      return aOctet - bOctet;
    });

    return NextResponse.json({
      branch_id,
      serverIp,
      discoveredTills: activeTills,
      scannedCount: possibleIps.length
    });
  } catch (error: any) {
    console.error(`Till discovery error for ${branch_id}:`, error);
    return NextResponse.json({ error: "Till discovery failed", details: error.message }, { status: 500 });
  }
}
