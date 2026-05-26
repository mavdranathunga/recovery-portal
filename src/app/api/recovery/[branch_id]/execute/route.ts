import { NextResponse } from "next/server";
import { getBranchIpMap } from "@/lib/db";
import { executeSshCommandStream } from "@/lib/ssh";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ branch_id: string }> }
) {
  const { branch_id } = await params;

  if (!branch_id) {
    return NextResponse.json({ error: "Missing branch_id" }, { status: 400 });
  }

  try {
    const ipMap = await getBranchIpMap();
    const ip = ipMap.get(branch_id.toUpperCase());

    if (!ip) {
      return NextResponse.json({ error: `Could not find IP for branch ${branch_id}` }, { status: 404 });
    }

    const command = `ping -c 5 192.168.16.3; for x in $( sudo atq | cut -f1 );do sudo atrm $x;done; sudo service tomcat stop; sudo killall -9 java; sudo service tomcat start; sudo rm -rf /coins/appLog/$(date +%Y%m%d)/*; sudo /coins/schedule/scripts/job_start.sh ; sudo service atd restart; systemctl restart zabbix-agent2.service; echo "---"; sudo atq`;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const onData = (data: string, isError: boolean) => {
          const msg = JSON.stringify({ type: isError ? 'err' : 'out', data }) + '\n';
          controller.enqueue(encoder.encode(msg));
        };

        try {
          await executeSshCommandStream(ip, command, onData);
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
          controller.close();
        } catch (error: any) {
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'err', data: `SSH Command Failed: ${error.message}` }) + '\n'));
          controller.enqueue(encoder.encode(JSON.stringify({ type: 'done' }) + '\n'));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error: any) {
    console.error(`Error starting recovery stream for ${branch_id}:`, error);
    return NextResponse.json({ error: "Stream start failed", details: error.message }, { status: 500 });
  }
}
