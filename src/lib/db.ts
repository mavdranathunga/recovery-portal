import oracledb from "oracledb";

// Enable thick mode for Oracle 11g XE compatibility
try {
  // Specify the exact path to the Instant Client the user downloaded
  oracledb.initOracleClient();
} catch (err) {
  console.error("Oracle Thick mode failed to initialize. Please ensure Oracle Instant Client is installed.", err);
}
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

export async function getHoConnection(): Promise<oracledb.Connection> {
  return await oracledb.getConnection({
    user: process.env.HO_DB_USER,
    password: process.env.HO_DB_PASSWORD,
    connectString: process.env.HO_DB_CONNECTSTRING,
  });
}

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

// In-memory cache for branch map to avoid hitting HO DB excessively
let branchMapCache: Map<string, string> | null = null;
let branchNameCache: Map<string, string> | null = null;
let branchMapTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetches the mappings of Branch ID to IP Address from the HO database.
 * Uses a simple timestamp cache.
 */
export async function getBranchIpMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (branchMapCache && now - branchMapTimestamp < CACHE_TTL_MS) {
    return branchMapCache;
  }

  let connection;
  try {
    connection = await getHoConnection();
    const result = await connection.execute<{
      BRANCH_ID: string;
      IP_ADDRESS: string;
    }>(`SELECT BRANCH_ID, IP_ADDRESS FROM TBL_MAP_BRANCH2CONNECTION WHERE IP_ADDRESS IS NOT NULL`);

    const map = new Map<string, string>();
    if (result.rows) {
      result.rows.forEach((row: any) => {
        // Some Oracle DBs might pad or trim differently, so we trim.
        if (row.BRANCH_ID && row.IP_ADDRESS) {
          map.set(row.BRANCH_ID.trim(), row.IP_ADDRESS.trim());
        }
      });
    }

    branchMapCache = map;
    branchMapTimestamp = now;
    return map;
  } catch (err) {
    console.error("Error fetching branch IP map:", err);
    // If we fail but have stale cache, return it
    if (branchMapCache) return branchMapCache;
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error("Error closing HO connection in getBranchIpMap:", err);
      }
    }
  }
}

/**
 * Fetches the mappings of Branch ID to Branch Name from the HO database.
 */
export async function getBranchNameMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (branchNameCache && now - branchMapTimestamp < CACHE_TTL_MS) {
    return branchNameCache;
  }

  let connection;
  try {
    connection = await getHoConnection();
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

    console.log(`Loaded ${map.size} branch names from HO.`);
    branchNameCache = map;
    branchMapTimestamp = now; // Update timestamp to prevent immediate re-fetch
    return map;
  } catch (err) {
    console.error("Error fetching branch name map:", err);
    if (branchNameCache) return branchNameCache;
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {}
    }
  }
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
