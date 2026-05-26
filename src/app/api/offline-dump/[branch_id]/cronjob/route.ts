import { NextResponse } from "next/server";
import { executeTillSshCommand } from "@/lib/ssh";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ branch_id: string }> }
) {
  const { branch_id } = await params;

  if (!branch_id) {
    return NextResponse.json({ error: "Missing branch_id" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { tillIp } = body;
  if (!tillIp) {
    return NextResponse.json({ error: "Missing tillIp in request body" }, { status: 400 });
  }

  try {
    // Command to get the root user's crontab, handling both root and deshanr users
    const command = `if command -v sudo >/dev/null 2>&1; then sudo crontab -l -u root; else crontab -l; fi`;
    
    const result = await executeTillSshCommand(tillIp, command);

    // If crontab -l returns an error (e.g., "no crontab for user"), it might exit with code 1
    if (result.code !== 0 && !result.stdout.trim()) {
      return NextResponse.json({ 
        success: true, 
        cronjob: result.stderr.trim() || "No crontab found."
      });
    }

    return NextResponse.json({
      success: true,
      cronjob: result.stdout.trim() || "Empty crontab."
    });

  } catch (error: any) {
    console.error(`Till cronjob check error for ${branch_id} at ${tillIp}:`, error);
    return NextResponse.json({ error: "Failed to check till cronjob", details: error.message }, { status: 500 });
  }
}
