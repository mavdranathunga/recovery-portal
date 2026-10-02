import { NextResponse } from "next/server";
import { scpUploadFile } from "@/lib/ssh";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let ip: string;
  let fileBuffer: Buffer;
  let remotePath: string;

  try {
    const formData = await request.formData();
    const ipField = formData.get("ip");
    const file = formData.get("file") as File | null;
    const remoteDir = (formData.get("remoteDir") as string) || "/home/deshanr";

    if (!ipField || typeof ipField !== "string") {
      return NextResponse.json({ error: "Missing or invalid IP address" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    ip = ipField.trim();
    const arrayBuffer = await file.arrayBuffer();
    fileBuffer = Buffer.from(arrayBuffer);
    remotePath = path.posix.join(remoteDir, file.name);
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to parse request", details: err.message }, { status: 400 });
  }

  // Write to a temp file so scpUploadFile can read it from disk
  const tmpFile = path.join(os.tmpdir(), `idt_upload_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  try {
    fs.writeFileSync(tmpFile, fileBuffer);
    const { authMethod } = await scpUploadFile(ip, tmpFile, remotePath);
    return NextResponse.json({
      stdout: `File uploaded to ${remotePath}`,
      stderr: "",
      code: 0,
      authMethod,
      remotePath,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Upload failed", details: err.message || String(err) },
      { status: 500 }
    );
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}
