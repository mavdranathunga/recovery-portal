import oracledb from "oracledb";

// Enable thick mode for Oracle 11g XE compatibility
try {
  // Specify the exact path to the Instant Client the user downloaded
  oracledb.initOracleClient();
} catch (err) {
  console.error("Oracle Thick mode failed to initialize. Please ensure Oracle Instant Client is installed.", err);
}
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

export type OrgId = "sathosa" | "idl";

// ─── HO Connections ──────────────────────────────────────────────────────────

export async function getHoConnection(): Promise<oracledb.Connection> {
  return await oracledb.getConnection({
    user: process.env.HO_DB_USER,
    password: process.env.HO_DB_PASSWORD,
    connectString: process.env.HO_DB_CONNECTSTRING,
  });
}

export async function getIdlHoConnection(): Promise<oracledb.Connection> {
  return await oracledb.getConnection({
    user: process.env.HO_DB_USER,          // Same user
    password: process.env.HO_DB_PASSWORD,  // Same password
    connectString: process.env.IDL_HO_DB_CONNECTSTRING,
  });
}

/** Returns the correct HO connection for the given org. */
export async function getHoConnectionByOrg(org: OrgId): Promise<oracledb.Connection> {
  return org === "idl" ? getIdlHoConnection() : getHoConnection();
}

// ─── Outlet Connection ───────────────────────────────────────────────────────

/**
 * Returns a standalone thin connection to a specific outlet database.
 * No persistent pool is used to avoid exhausting connections across 400+ branches.
 * Important: Be sure to close this connection after use.
 */
export async function getOutletConnection(
  ipAddress: string
): Promise<oracledb.Connection> {
  const port = process.env.OUTLET_DB_PORT || "1521";
  const service = process.env.OUTLET_DB_SERVICE || "XE";
  // Using full TNS descriptor format to reliably enforce a 5-second timeout
  // without breaking service name resolution on Oracle 11g databases.
  const connectString = `(DESCRIPTION=(CONNECT_TIMEOUT=5)(TRANSPORT_CONNECT_TIMEOUT=5)(RETRY_COUNT=0)(ADDRESS=(PROTOCOL=TCP)(HOST=${ipAddress})(PORT=${port}))(CONNECT_DATA=(SERVICE_NAME=${service})))`;

  return await oracledb.getConnection({
    user: process.env.OUTLET_DB_USER,
    password: process.env.OUTLET_DB_PASSWORD,
    connectString,
  });
}

// ─── Branch Map Cache (per-org) ───────────────────────────────────────────────

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface OrgCache {
  branchMap: Map<string, string> | null;
  branchNameMap: Map<string, string> | null;
  timestamp: number;
}

const orgCaches: Record<OrgId, OrgCache> = {
  sathosa: { branchMap: null, branchNameMap: null, timestamp: 0 },
  idl:     { branchMap: null, branchNameMap: null, timestamp: 0 },
};

/**
 * Fetches the mappings of Branch ID to IP Address from the specified org's HO database.
 * Uses a simple timestamp cache per org.
 */
export async function getBranchIpMap(org: OrgId = "sathosa"): Promise<Map<string, string>> {
  const cache = orgCaches[org];
  const now = Date.now();
  if (cache.branchMap && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.branchMap;
  }

  let connection;
  try {
    connection = await getHoConnectionByOrg(org);
    const result = await connection.execute<{
      BRANCH_ID: string;
      IP_ADDRESS: string;
    }>(`SELECT BRANCH_ID, IP_ADDRESS FROM TBL_MAP_BRANCH2CONNECTION WHERE IP_ADDRESS IS NOT NULL`);

    const map = new Map<string, string>();
    if (result.rows) {
      result.rows.forEach((row: any) => {
        if (row.BRANCH_ID && row.IP_ADDRESS) {
          map.set(row.BRANCH_ID.trim(), row.IP_ADDRESS.trim());
        }
      });
    }

    cache.branchMap = map;
    cache.timestamp = now;
    return map;
  } catch (err) {
    console.error(`Error fetching branch IP map for org=${org}:`, err);
    if (cache.branchMap) return cache.branchMap;
    throw err;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {
        console.error("Error closing HO connection in getBranchIpMap:", err);
      }
    }
  }
}

/**
 * Fetches the mappings of Branch ID to Branch Name from the specified org's HO database.
 */
export async function getBranchNameMap(org: OrgId = "sathosa"): Promise<Map<string, string>> {
  const cache = orgCaches[org];
  const now = Date.now();
  if (cache.branchNameMap && now - cache.timestamp < CACHE_TTL_MS) {
    return cache.branchNameMap;
  }

  let connection;
  try {
    connection = await getHoConnectionByOrg(org);
    const result = await connection.execute<{
      BRANCH_ID: string;
      BRANCH_NAME: string;
    }>(`SELECT BRANCH_ID, BRANCH_NAME FROM TBL_MST_BRANCH`);

    const map = new Map<string, string>();
    map.set("HO", "Head Office");
    if (result.rows) {
      result.rows.forEach((row: any) => {
        if (row.BRANCH_ID && row.BRANCH_NAME) {
          map.set(row.BRANCH_ID.trim(), row.BRANCH_NAME.trim());
        }
      });
    }

    console.log(`Loaded ${map.size} branch names from HO (org=${org}).`);
    cache.branchNameMap = map;
    cache.timestamp = now;
    return map;
  } catch (err) {
    console.error(`Error fetching branch name map for org=${org}:`, err);
    if (cache.branchNameMap) return cache.branchNameMap;
    throw err;
  } finally {
    if (connection) {
      try { await connection.close(); } catch (err) {}
    }
  }
}

/**
 * Parses an org string from a query param into a validated OrgId.
 * Defaults to "sathosa" for unknown values.
 */
export function parseOrg(raw: string | null | undefined): OrgId {
  return raw === "idl" ? "idl" : "sathosa";
}

/**
 * Common formatting function for IDT statuses.
 */
export function getStatusText(statusCode: string): string {
  const mapping: Record<string, string> = {
    E: "Entered",
    D: "Dispatch",
    P: "Partial Received", // or Print/Dispatch
    R: "Received",
    C: "Cancel",
    H: "System Hold",
  };
  return mapping[statusCode] || statusCode;
}
