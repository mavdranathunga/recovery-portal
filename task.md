# IDT Status Monitor - Task List

## Planning
- [x] Analyze requirements
- [x] Design architecture
- [x] Write implementation plan

## Setup
- [x] Initialize Next.js project in d:\Projects\IDT_status
- [x] Install dependencies (oracledb, etc.)
- [x] Create project structure

## Backend
- [x] Create branch config loader (reads branch list with IPs from HO DB)
- [x] Create Oracle connection pool utility (multi-DB)
- [x] API: GET /api/idt/[dpn_id] - track IDT across HO + relevant outlet DBs
- [x] API: GET /api/shop/[branch_id] - list all IDTs for a shop
- [x] API: GET /api/branches - list all branches

## Frontend
- [x] Layout and navigation
- [x] IDT Tracker page (search by dpn_id)
- [x] Shop Monitor page (search by branch code)
- [x] Result display: sync journey timeline
- [x] Status badges and color coding

## Verification
- [x] Test Node.js compilation and build
- [x] Manual User Verification (DB Connections, Tracker, Shop Monitor)
- [x] Implement DB Connection Timeouts & Error Parsing
- [x] API: GET /api/sync/[branch_id] - Quick sync status check
- [x] Branch Name Integration (TBL_MST_BRANCH) across all pages
- [x] Logic Refinement: Fully Synchronized if record exists in Destination DB
- [x] UI: High-visibility Branch Name & Code labels
- [x] UI: Centered Head Office layout with consistent alignment
- [x] UI: Shop Monitor client-side IDT filter
