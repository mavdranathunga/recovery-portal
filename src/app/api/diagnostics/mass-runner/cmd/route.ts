import { NextResponse } from "next/server";
import { executeSshCommand } from "@/lib/ssh";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { ip, command, timeoutMs } = body;

    if (!ip || typeof ip !== "string") {
      return NextResponse.json({ error: "Missing or invalid IP address" }, { status: 400 });
    }

    if (!command || typeof command !== "string") {
      return NextResponse.json({ error: "Missing or invalid command" }, { status: 400 });
    }

    const { stdout, stderr, code, authMethod } = await executeSshCommand(
      ip.trim(),
      command.trim(),
      typeof timeoutMs === "number" ? timeoutMs : 15000
    );

    return NextResponse.json({
      stdout,
      stderr,
      code,
      authMethod,
      ip
    });
  } catch (err: any) {
    console.error("Error executing mass runner SSH command:", err);
    return NextResponse.json(
      { error: "SSH Command Execution Failed", details: err.message || String(err) },
      { status: 500 }
    );
  }
}
