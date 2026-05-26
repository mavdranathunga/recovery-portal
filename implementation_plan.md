# IDT Sync Status Monitor – Implementation Plan

## Background

A retail chain with 450 outlets and 13 warehouses runs a sync job every 20 minutes.  
Each outlet has its own Oracle XE 11g database; the Head Office (HO) runs Oracle 19c.  
Inter-Depot Transfers (IDTs) travel: **Source Outlet → HO → Destination Outlet**.

The `T2024_DPN` table is the core record:

| Column | Meaning |
|---|---|
| `dpn_id` | IDT number (primary key) |
| `dpn_src_branchid` | Source branch (e.g. S001) |
| `dpn_dest_branchid` | Destination branch (e.g. S002) |
| `dpn_status` | E=Entered, D=Dispatch, P=Print/Partial Received, R=Received, C=Cancel, H=System Hold |
| `effective_date` | Effective date of the IDT |
| `rec_date` | Record creation date |
| `lupd_date` | Last update date |
| `sync_date` | Date the record was synced |
| `dpn_commit_date` | Date the IDT was committed |

There is a branch master table in HO containing `branch_id` and the outlet's IP address, used to connect to outlet DBs.

---

## Architecture: Next.js + Server-Side Oracle Connections

**Why Next.js (instead of a heavier stack)?**  
- Lightweight, single process, runs on the HO server or any monitoring PC.  
- API Routes handle all Oracle connections server-side (never exposes credentials to the browser).  
- No separate backend process needed.

**Connection strategy:**  
With 463 databases we **do NOT keep persistent pools to all outlets**. Instead:  
1. On startup (or on-demand), query HO for the branch master table (branch_id → IP mapping).  
2. When a user searches, open a **short-lived connection** to the relevant outlet DB(s) only, execute the query, then close.  
3. HO connection uses a small persistent pool (it is queried for every search).

---

## Proposed Changes

### Environment & Config

#### [NEW] `.env.local`
```
HO_DB_USER=...
HO_DB_PASSWORD=...
HO_DB_CONNECTSTRING=<ho-host>:1521/<service>
OUTLET_DB_USER=...        # shared credentials across outlets
OUTLET_DB_PASSWORD=...
OUTLET_DB_PORT=1521
OUTLET_DB_SERVICE=XE      # Oracle XE default
```

---

### Next.js Project (App Router)

#### [NEW] `package.json` – key dependencies
- `next`, `react`, `react-dom`
- `oracledb` – Oracle thin client (no Oracle Client install needed with thin mode)
- `lucide-react` – icons

---

### Backend API Routes

#### [NEW] `src/lib/db.ts`
- `getHoConnection()` – returns a connection from the HO pool
- `getOutletConnection(ip)` – opens a thin connection to an outlet DB
- `getBranchMap()` – cached fetch from HO branch master table; returns `Map<branchId, ip>`

#### [NEW] `src/app/api/idt/[dpn_id]/route.ts`
**IDT Tracker** – given a `dpn_id`:
1. Query HO `T2024_DPN` for the record → gives `dpn_src_branchid`, `dpn_dest_branchid`, all dates.
2. Lookup IP for source branch → connect to source outlet → query same table for that `dpn_id`.
3. Lookup IP for dest branch → connect to dest outlet → query same table.
4. Return all three snapshots (HO, source, dest) so the UI can render the journey.

Response shape:
```json
{
  "dpn_id": "...",
  "ho": { ...record or null },
  "source": { "branch_id": "S001", "ip": "...", "record": {...} | null },
  "dest":   { "branch_id": "S002", "ip": "...", "record": {...} | null }
}
```

From this the UI infers:
- **Only at source** → not synced to HO yet (sync pending)
- **At HO, not at dest** → awaiting next sync cycle at destination
- **At all three** → fully synced

#### [NEW] `src/app/api/shop/[branch_id]/route.ts`
**Shop Monitor** – given a `branch_id`:
1. Look up whether the branch is HO or an outlet.
2. Query `T2024_DPN` where `dpn_src_branchid = branch_id OR dpn_dest_branchid = branch_id` (up to last N days, configurable).
3. For each IDT, determine sync reach by checking HO copy.
4. Return paginated list sorted by `rec_date DESC`.

#### [NEW] `src/app/api/branches/route.ts`
Returns the full branch list from HO (for autocomplete / dropdowns).

---

### Frontend Pages

#### [NEW] `src/app/page.tsx` – Home / Dashboard
- Two large search cards: **"Track IDT"** and **"Monitor Shop"**
- Recent searches (localStorage)
- System status pill (HO connection OK / error)

#### [NEW] `src/app/idt/[dpn_id]/page.tsx` – IDT Tracker
- Search bar at top
- **Journey Timeline** showing three nodes: `Source Outlet → HO → Dest Outlet`
- Each node shows:
  - Branch ID + IP
  - Record found / not found
  - Key dates (rec_date, sync_date, lupd_date, dpn_commit_date)
  - Status badge (color-coded)
- Sync lag calculation: time between `sync_date` at HO vs source creation

#### [NEW] `src/app/shop/[branch_id]/page.tsx` – Shop Monitor  
- Search bar at top
- Filter tabs: All | Outgoing | Incoming | By Status
- Table/card list of IDTs with columns: IDT#, Source, Dest, Status, Date, Sync Reach
- Click any row → navigates to IDT detail page

#### Design tokens
- Dark-mode first, glassmorphism cards
- Status colors: `E`=blue, `D`=orange, `P`=yellow, `R`=green, `C`=red, `H`=purple
- Sync reach indicators: 🔴 (source only) → 🟡 (at HO) → 🟢 (fully synced)

---

## User Review Required

> [!IMPORTANT]
> **Shared outlet DB credentials** – The plan assumes all 450+ outlet Oracle XE instances share the same username/password. If credentials differ per outlet, we need an alternative (e.g. a credentials column in the branch master). Please confirm.

> [!IMPORTANT]
> **Branch master table** – Please provide: the exact table name and column names for `branch_id` and `ip_address` in the HO database. Also confirm the Oracle XE service name on outlets (default is `XE`).

> [!IMPORTANT]
> **Oracle thin mode** – `oracledb` v6+ supports "thin mode" (no Oracle Client required). This works with Oracle 11g XE and 19c. If the monitoring server already has an Oracle Client installed, we can use thick mode instead. Please confirm.

> [!WARNING]
> **Performance** – Connecting to an outlet DB on every search adds latency (~1–3s). For the Shop Monitor page which may query many outlet DBs, we'll limit queries to HO data first and only connect to individual outlets on demand (drill-down). This is the recommended UX tradeoff.

---

## Verification Plan

### Automated
- `npm run dev` – confirm dev server starts without errors
- Test API routes with `curl` or browser:
  - `GET /api/branches` – should return branch list
  - `GET /api/idt/<real_dpn_id>` – should return HO + source + dest snapshots
  - `GET /api/shop/S001` – should return IDT list for shop S001

### Browser Validation
- Open home page → verify two search cards render
- Search for a known IDT number → verify journey timeline shows correct nodes
- Search for a known shop code → verify IDT list populates
- Verify status badges are color-coded correctly
- Test with an IDT that hasn't reached HO yet (if available) → should show red indicator

### Manual (User)
1. Start the app: `npm run dev` in `d:\Projects\IDT_status`
2. Open `http://localhost:3000`
3. Enter a known `dpn_id` and verify the displayed status matches what you see in the DB
4. Enter shop code `S001` and verify the IDT list matches
