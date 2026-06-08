import { NextResponse } from "next/server";
import { getHoConnectionByOrg, parseOrg } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const org = parseOrg(searchParams.get("org"));

  let connection;
  try {
    connection = await getHoConnectionByOrg(org);

    const query = `
      SELECT 
        b.BRANCH_ID, 
        b.BRANCH_NAME, 
        m.IP_ADDRESS 
      FROM TBL_MST_BRANCH b
      JOIN TBL_MAP_BRANCH2CONNECTION m ON b.BRANCH_ID = m.BRANCH_ID
      WHERE b.STATUS NOT IN ('N', 'D', 'I') 
        AND m.IP_ADDRESS IS NOT NULL
        AND UPPER(b.BRANCH_ID) != 'HO'
    `;

    const result = await connection.execute<{
      BRANCH_ID: string;
      BRANCH_NAME: string;
      IP_ADDRESS: string;
    }>(query);

    const branches: { id: string; name: string; ip: string; category: string }[] = [];

    if (result.rows) {
      result.rows.forEach((row: any) => {
        const id = row.BRANCH_ID.trim();
        // Categorize: Contains 'S' -> Shop, else -> Warehouse
        const category = id.toUpperCase().includes('S') ? 'Shop' : 'Warehouse';

        branches.push({
          id,
          name: row.BRANCH_NAME.trim(),
          ip: row.IP_ADDRESS.trim(),
          category
        });
      });
    }

    // Sort by Category (Shops first) then by ID
    branches.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category === 'Shop' ? -1 : 1;
      }
      return a.id.localeCompare(b.id);
    });

    return NextResponse.json({ branches, org });
  } catch (error: any) {
    console.error(`Error fetching branches (org=${org}):`, error);
    return NextResponse.json({ error: "Failed to fetch branches" }, { status: 500 });
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) { }
    }
  }
}
