"use client";

import { useState, useEffect } from "react";
import {
  RefreshCw,
  Store,
  Warehouse,
  AlertTriangle,
  Clock,
  Database,
  Server,
  HardDrive,
  Cpu,
  Layers,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  AlertOctagon,
  WifiOff,
  Activity,
  Timer,
} from "lucide-react";
import { useOrg } from "@/lib/OrgContext";

/* ─── Types ─────────────────────────────────────────────── */
interface ProntoNotPostedItem {
  outlet_code: string;
  branch_name: string;
  latest_trans_date: string;
}

interface ProntoPostedItem {
  trans_date: string;
  outlet_count: number;
}

interface CountsData {
  activeOutlets: number;
  activeWarehouses: number;
  unsyncedOutlets: number;
  pendingDayEnd: number | null;
  prontoNotPostedCount: number;
  prontoNotPostedList: ProntoNotPostedItem[];
  prontoPosted: ProntoPostedItem[];
}

interface TablespaceItem {
  name: string;
  usedGb: number;
  totalGb: number;
  usedPct: number;
}

interface MountPoint {
  path: string;
  pct: number | null;
}

interface ServerMetric {
  id: string;
  name: string;
  ip: string;
  role: string;
  status: "online" | "offline" | "error";
  cpu: number | null;
  mem: number | null;
  uptime: string | null;
  mounts: MountPoint[];
  error?: string;
  updatedAt?: string;
}

/* ─── Animated Counter ──────────────────────────────────── */
function AnimatedNumber({
  value,
  loading,
}: {
  value: number | string | null | undefined;
  loading: boolean;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (loading || value === null || value === undefined) return;
    const target = typeof value === "number" ? value : parseInt(String(value), 10);
    if (isNaN(target)) return;
    const start = 0;
    const diff = target - start;
    if (diff === 0) return;
    const duration = 900;
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * ease));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [value, loading]);

  if (loading) {
    return <span className="inline-block h-9 w-16 rounded-lg bg-white/5 animate-pulse" />;
  }
  if (value === null || value === undefined) return <span className="text-slate-500">—</span>;
  return <span>{display.toLocaleString()}</span>;
}

/* ─── Ring Progress Meter ───────────────────────────────── */
function RingMeter({
  pct,
  size = 64,
  stroke = 5,
  icon: Icon,
  label,
  iconClass,
}: {
  pct: number | null;
  size?: number;
  stroke?: number;
  icon: React.ElementType;
  label: string;
  iconClass: string;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const safeP = pct !== null ? Math.min(100, Math.max(0, pct)) : 0;
  const dash = (safeP / 100) * circ;

  const ringColor =
    pct === null ? "#334155" : pct >= 85 ? "#f43f5e" : pct >= 70 ? "#f59e0b" : "#10b981";

  const textColor =
    pct === null
      ? "text-slate-500"
      : pct >= 85
      ? "text-rose-400"
      : pct >= 70
      ? "text-amber-400"
      : "text-emerald-400";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeDasharray={circ}
            strokeDashoffset={circ - dash}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 0.85s cubic-bezier(0.16,1,0.3,1), stroke 0.4s ease",
              filter: pct !== null ? `drop-shadow(0 0 5px ${ringColor}90)` : "none",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className={`w-4 h-4 ${iconClass}`} />
        </div>
      </div>
      <div className={`text-[11px] font-bold font-mono ${textColor}`}>
        {pct !== null ? `${pct}%` : "N/A"}
      </div>
      <div className="text-[10px] text-slate-600 uppercase tracking-wider">{label}</div>
    </div>
  );
}

/* ─── Utilization Bar ───────────────────────────────────── */
function UtilBar({ pct }: { pct: number | null }) {
  const barColor =
    pct === null
      ? "bg-slate-700"
      : pct >= 85
      ? "bg-gradient-to-r from-rose-600 to-rose-400"
      : pct >= 70
      ? "bg-gradient-to-r from-amber-600 to-amber-400"
      : "bg-gradient-to-r from-emerald-600 to-emerald-400";

  const glow =
    pct !== null && pct >= 85
      ? "0 0 8px rgba(244,63,94,0.55)"
      : pct !== null && pct >= 70
      ? "0 0 8px rgba(245,158,11,0.5)"
      : pct !== null
      ? "0 0 6px rgba(16,185,129,0.4)"
      : "none";

  return (
    <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
        style={{ width: `${Math.min(100, Math.max(0, pct || 0))}%`, boxShadow: glow }}
      />
    </div>
  );
}

/* ─── Section Header ────────────────────────────────────── */
type Accent = "blue" | "violet" | "emerald" | "amber";

const sectionAccent: Record<Accent, string> = {
  blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

function SectionHeader({
  icon,
  title,
  accent = "blue",
  action,
}: {
  icon: React.ReactNode;
  title: string;
  accent?: Accent;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className={`p-1.5 rounded-lg border ${sectionAccent[accent]}`}>{icon}</div>
        <h2 className="text-base font-semibold text-slate-100 tracking-tight">{title}</h2>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

/* ─── KPI Card ──────────────────────────────────────────── */
type KpiAccent = "blue" | "violet" | "amber" | "rose" | "emerald" | "slate";

const kpiAccentMap: Record<
  KpiAccent,
  { icon: string; glow: string; valueClass: string }
> = {
  blue: { icon: "bg-blue-500/10 text-blue-400 border-blue-500/20", glow: "rgba(59,130,246,0.18)", valueClass: "text-white" },
  violet: { icon: "bg-violet-500/10 text-violet-400 border-violet-500/20", glow: "rgba(139,92,246,0.18)", valueClass: "text-white" },
  amber: { icon: "bg-amber-500/10 text-amber-400 border-amber-500/20", glow: "rgba(245,158,11,0.2)", valueClass: "text-amber-400" },
  rose: { icon: "bg-rose-500/10 text-rose-400 border-rose-500/20", glow: "rgba(244,63,94,0.2)", valueClass: "text-rose-400" },
  emerald: { icon: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", glow: "rgba(16,185,129,0.18)", valueClass: "text-white" },
  slate: { icon: "bg-slate-800 text-slate-400 border-slate-700", glow: "transparent", valueClass: "text-slate-400" },
};

function KpiCard({
  label,
  value,
  loading,
  icon,
  accent = "blue",
  sub,
  alert,
  dim,
}: {
  label: string;
  value: number | null | undefined;
  loading: boolean;
  icon: React.ReactNode;
  accent?: KpiAccent;
  sub?: string;
  alert?: boolean;
  dim?: boolean;
}) {
  const a = kpiAccentMap[accent];

  return (
    <div
      className={`relative group rounded-2xl border border-white/[0.07] p-5 overflow-hidden transition-all duration-300 hover:border-white/[0.14] hover:-translate-y-0.5 ${dim ? "opacity-45" : ""}`}
      style={{
        background: "rgba(15,23,42,0.6)",
        backdropFilter: "blur(14px)",
        boxShadow: alert
          ? `0 0 28px -8px ${a.glow}, 0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)`
          : "0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* Corner glow for alert state */}
      {alert && (
        <div
          aria-hidden
          className="pointer-events-none absolute -top-8 -right-8 w-28 h-28 rounded-full blur-2xl opacity-35 transition-opacity"
          style={{ background: a.glow.replace("0.2", "1").replace("0.18", "1") }}
        />
      )}

      <div className="relative flex items-start justify-between mb-4">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider leading-tight pr-2">
          {label}
        </span>
        <div className={`p-2 rounded-xl border shrink-0 ${a.icon}`}>{icon}</div>
      </div>

      <div className={`relative text-3xl font-extrabold tracking-tight mb-1.5 ${a.valueClass}`}>
        <AnimatedNumber value={value} loading={loading} />
      </div>

      {sub && <p className="relative text-[11px] text-slate-600 leading-snug">{sub}</p>}
    </div>
  );
}

/* ─── Server Card ───────────────────────────────────────── */
function ServerCard({ srv }: { srv: ServerMetric }) {
  const isOnline = srv.status === "online";
  // root mount is always the first entry
  const rootMount = srv.mounts?.find((m) => m.path === "/") ?? null;
  // remaining named mounts (skip root since it's in the ring)
  const namedMounts = srv.mounts?.filter((m) => m.path !== "/") ?? [];

  return (
    <div
      className="relative rounded-2xl border border-white/[0.07] p-5 overflow-hidden transition-all duration-300 hover:border-white/[0.13] hover:-translate-y-0.5"
      style={{
        background: "rgba(15,23,42,0.6)",
        backdropFilter: "blur(14px)",
        boxShadow: isOnline
          ? "0 4px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.03)"
          : "0 4px 20px rgba(244,63,94,0.1), 0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      {/* Server header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="text-sm font-bold text-white truncate">{srv.name}</div>
          <div className="text-[11px] font-mono text-slate-500 mt-0.5">{srv.ip}</div>
          <div className="text-[11px] text-slate-600 mt-0.5">{srv.role}</div>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
              isOnline
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isOnline ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
              }`}
            />
            {isOnline ? "Online" : "Offline"}
          </span>
          {/* Uptime chip */}
          {isOnline && srv.uptime && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-500 bg-white/[0.03] border border-white/[0.06]">
              <Timer className="w-2.5 h-2.5" />
              {srv.uptime}
            </span>
          )}
        </div>
      </div>

      {isOnline ? (
        <div>
          {/* Ring meters: CPU · RAM · Root Disk */}
          <div className="flex items-end justify-around py-1 mb-4">
            <RingMeter pct={srv.cpu} icon={Cpu} label="CPU" iconClass="text-blue-400" />
            <RingMeter pct={srv.mem} icon={Database} label="RAM" iconClass="text-violet-400" />
            <RingMeter pct={rootMount?.pct ?? null} icon={HardDrive} label="Root /" iconClass="text-emerald-400" />
          </div>

          {/* Named mount point bars */}
          {namedMounts.length > 0 && (
            <div className="space-y-2 pt-3 border-t border-white/[0.05]">
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">
                Storage Volumes
              </div>
              {namedMounts.map(({ path, pct }) => (
                <div key={path}>
                  <div className="flex justify-between items-center text-[11px] mb-1">
                    <span className="font-mono text-slate-500">{path}</span>
                    <span
                      className={`font-mono font-semibold ${
                        pct === null
                          ? "text-slate-600"
                          : pct >= 85
                          ? "text-rose-400"
                          : pct >= 70
                          ? "text-amber-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {pct !== null ? `${pct}%` : "—"}
                    </span>
                  </div>
                  <UtilBar pct={pct} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-rose-500/5 border border-rose-500/15 text-xs text-rose-300">
          <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <span>{srv.error || "Unable to retrieve metrics over SSH."}</span>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */
export default function DashboardPage() {
  const { org } = useOrg();

  const [loadingDb, setLoadingDb] = useState(false);
  const [loadingServers, setLoadingServers] = useState(false);
  const [counts, setCounts] = useState<CountsData | null>(null);
  const [tablespaces, setTablespaces] = useState<TablespaceItem[]>([]);
  const [servers, setServers] = useState<ServerMetric[]>([]);
  const [dbError, setDbError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string | null>(null);
  const [showProntoList, setShowProntoList] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showAllTablespaces, setShowAllTablespaces] = useState(false);

  const TABLESPACE_PREVIEW = 8;

  const fetchDbMetrics = async () => {
    setLoadingDb(true);
    setDbError(null);
    try {
      const res = await fetch(`/api/dashboard?org=${org}&section=db`);
      const json = await res.json();
      if (json.data?.counts) setCounts(json.data.counts);
      if (json.data?.tablespaces) setTablespaces(json.data.tablespaces);
      if (json.data?.errors?.database) setDbError(json.data.errors.database);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      setDbError(err?.message || "Failed to fetch database metrics");
    } finally {
      setLoadingDb(false);
      setIsInitialLoad(false);
    }
  };

  const fetchServerMetrics = async () => {
    setLoadingServers(true);
    try {
      const res = await fetch(`/api/dashboard?org=${org}&section=servers`);
      const json = await res.json();
      if (json.data?.servers) setServers(json.data.servers);
    } catch (err: any) {
      console.error("Failed to load server metrics:", err);
    } finally {
      setLoadingServers(false);
    }
  };

  const refreshAll = () => {
    fetchDbMetrics();
    fetchServerMetrics();
  };

  useEffect(() => {
    refreshAll();
  }, [org]);

  const isRefreshing = loadingDb || loadingServers;

  /* Slice for tablespace preview */
  const visibleTablespaces = showAllTablespaces
    ? tablespaces
    : tablespaces.slice(0, TABLESPACE_PREVIEW);

  return (
    <div className="min-h-screen pb-16">
      {/* Ambient top glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-80 opacity-25"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% -5%, rgba(59,130,246,0.3) 0%, transparent 70%)",
        }}
      />

      {/* ── INITIAL LOAD OVERLAY ──────────────────────── */}
      {isInitialLoad && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-5 pointer-events-none">
          {/* Spinner */}
          <div className="relative w-14 h-14">
            {/* outer ring */}
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
              <circle
                cx="28" cy="28" r="24"
                fill="none"
                stroke="url(#spin-grad)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="150.8"
                strokeDashoffset="113.1"
                style={{ animation: "spin 1s linear infinite" }}
              />
              <defs>
                <linearGradient id="spin-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            {/* inner pulse dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
            </div>
          </div>
          {/* Label */}
          <div className="text-center">
            <p className="text-sm font-medium text-slate-300 tracking-wide">Loading metrics</p>
            <p className="text-xs text-slate-600 mt-0.5">Fetching DB &amp; server data…</p>
          </div>
        </div>
      )}

      {/* Content — hidden until initial load done */}
      <div className={`relative max-w-7xl mx-auto space-y-10 transition-opacity duration-500 ${isInitialLoad ? "opacity-0 pointer-events-none" : "opacity-100"}`}>

        {/* ── PAGE HEADER ─────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5 pt-1">
          <div>
            <div className="flex items-center flex-wrap gap-2.5 mb-1.5">
              <div className="relative">
                <div className="absolute inset-0 rounded-xl bg-blue-500/30 blur-md" />
                <div className="relative h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
                  <Activity className="h-4.5 w-4.5 text-white" />
                </div>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Operations Dashboard</h1>
              <span
                className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-widest border"
                style={{
                  background: org === "sathosa" ? "rgba(59,130,246,0.1)" : "rgba(139,92,246,0.1)",
                  borderColor: org === "sathosa" ? "rgba(59,130,246,0.3)" : "rgba(139,92,246,0.3)",
                  color: org === "sathosa" ? "#60a5fa" : "#a78bfa",
                }}
              >
                {org}
              </span>
            </div>
            <p className="text-sm text-slate-500 ml-0.5">
              On-demand operational metrics · Infrastructure status · No persistent connections
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {lastRefreshed && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-1.5">
                <Clock className="w-3 h-3" />
                <span className="font-mono">{lastRefreshed}</span>
              </div>
            )}
            <button
              onClick={refreshAll}
              disabled={isRefreshing}
              className="group flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm text-white transition-all duration-200 active:scale-95 disabled:opacity-60 hover:brightness-110"
              style={{
                background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                boxShadow:
                  "0 4px 14px rgba(37,99,235,0.4), inset 0 1px 0 rgba(255,255,255,0.1)",
              }}
            >
              <RefreshCw
                className={`w-4 h-4 transition-transform duration-500 ${
                  isRefreshing ? "animate-spin" : "group-hover:rotate-180"
                }`}
              />
              <span>{isRefreshing ? "Refreshing…" : "Refresh All"}</span>
            </button>
          </div>
        </div>

        {/* ── ERROR BANNER ────────────────────────────── */}
        {dbError && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-amber-500/25 text-amber-300 text-xs"
            style={{ background: "rgba(245,158,11,0.07)" }}>
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{dbError}</span>
            </div>
            <button
              onClick={fetchDbMetrics}
              disabled={loadingDb}
              className="shrink-0 px-3 py-1 rounded-lg font-medium border border-amber-500/20 text-amber-200 transition-colors hover:bg-amber-500/15"
              style={{ background: "rgba(245,158,11,0.1)" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            SECTION 1 – KPI CARDS
        ═══════════════════════════════════════════════ */}
        <section className="space-y-4">
          <SectionHeader
            icon={<Layers className="w-4 h-4" />}
            title="Outlet & Branch Overview"
            action={
              <button
                onClick={fetchDbMetrics}
                disabled={loadingDb}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${loadingDb ? "animate-spin" : ""}`} />
                Refresh DB
              </button>
            }
          />

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <KpiCard
              label="Active Outlets"
              value={counts?.activeOutlets}
              loading={loadingDb}
              icon={<Store className="w-4 h-4" />}
              accent="blue"
              sub="BRANCH_ID 'S' · Status A"
            />
            <KpiCard
              label="Active Warehouses"
              value={counts?.activeWarehouses}
              loading={loadingDb}
              icon={<Warehouse className="w-4 h-4" />}
              accent="violet"
              sub="Non-S/H branches · Status A"
            />
            <KpiCard
              label="Unsynced Outlets"
              value={counts?.unsyncedOutlets}
              loading={loadingDb}
              icon={<WifiOff className="w-4 h-4" />}
              accent={counts?.unsyncedOutlets ? "amber" : "slate"}
              sub="Last sync > 5 hours ago"
              alert={!!counts?.unsyncedOutlets}
            />
            <KpiCard
              label="Pending Day-End"
              value={null}
              loading={false}
              icon={<Clock className="w-4 h-4" />}
              accent="slate"
              sub="Not configured"
              dim
            />
            <KpiCard
              label="Pronto Not Synced"
              value={counts?.prontoNotPostedCount}
              loading={loadingDb}
              icon={<FileSpreadsheet className="w-4 h-4" />}
              accent={counts?.prontoNotPostedCount ? "rose" : "slate"}
              sub="Not posted > 3 days"
              alert={!!counts?.prontoNotPostedCount}
            />
          </div>

          {/* Pronto breakdown row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
            {/* Posted breakdown */}
            <div
              className="rounded-2xl border border-white/[0.07] p-5"
              style={{
                background: "rgba(15,23,42,0.55)",
                backdropFilter: "blur(14px)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200 mb-4">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                Pronto Posted – Last 3 Days
              </div>
              <div className="space-y-1">
                {loadingDb ? (
                  [0, 1, 2].map((i) => (
                    <div key={i} className="h-9 rounded-lg bg-white/[0.03] animate-pulse" />
                  ))
                ) : counts?.prontoPosted && counts.prontoPosted.length > 0 ? (
                  counts.prontoPosted.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <span className="text-xs font-mono text-slate-400">
                        {new Date(item.trans_date).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        {item.outlet_count} outlets
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-5 text-center text-xs text-slate-600">
                    No records in last 3 days
                  </p>
                )}
              </div>
            </div>

            {/* Not synced details */}
            <div
              className="lg:col-span-2 rounded-2xl border border-white/[0.07] p-5"
              style={{
                background: "rgba(15,23,42,0.55)",
                backdropFilter: "blur(14px)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)",
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                    <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                    </div>
                    Outlets Behind in Pronto Sync
                    <span className="text-[11px] font-normal text-slate-500">(&gt; 3 days)</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1.5 pl-0.5">
                    {counts?.prontoNotPostedList?.length || 0} branches have not posted sales to Pronto
                  </p>
                </div>
                <button
                  onClick={() => setShowProntoList(!showProntoList)}
                  disabled={!counts?.prontoNotPostedList?.length}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.07] disabled:opacity-30 text-xs font-medium text-slate-300 border border-white/[0.08] transition-all"
                >
                  {showProntoList ? (
                    <>Hide <ChevronUp className="w-3 h-3" /></>
                  ) : (
                    <>View Outlets <ChevronDown className="w-3 h-3" /></>
                  )}
                </button>
              </div>

              {showProntoList &&
                counts?.prontoNotPostedList &&
                counts.prontoNotPostedList.length > 0 && (
                  <div className="rounded-xl border border-white/[0.06] bg-black/20 overflow-hidden">
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-950/90 backdrop-blur-sm border-b border-white/[0.06]">
                          <tr>
                            <th className="py-2.5 px-4 font-medium text-slate-400">Code</th>
                            <th className="py-2.5 px-4 font-medium text-slate-400">Branch Name</th>
                            <th className="py-2.5 px-4 text-right font-medium text-slate-400">
                              Last Trans
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {counts.prontoNotPostedList.map((branch, i) => (
                            <tr
                              key={i}
                              className="border-t border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                            >
                              <td className="py-2.5 px-4 font-mono font-bold text-rose-400">
                                {branch.outlet_code}
                              </td>
                              <td className="py-2.5 px-4 text-slate-300">{branch.branch_name}</td>
                              <td className="py-2.5 px-4 text-right font-mono text-slate-500">
                                {branch.latest_trans_date
                                  ? new Date(branch.latest_trans_date).toLocaleDateString(
                                      "en-GB",
                                      { day: "2-digit", month: "short", year: "numeric" }
                                    )
                                  : "Never"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            SECTION 2 – SERVERS
        ═══════════════════════════════════════════════ */}
        <section className="space-y-4">
          <SectionHeader
            icon={<Server className="w-4 h-4" />}
            title="Core Server Infrastructure"
            accent="violet"
            action={
              <button
                onClick={fetchServerMetrics}
                disabled={loadingServers}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${loadingServers ? "animate-spin" : ""}`} />
                Poll Servers
              </button>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {servers.length > 0
              ? servers.map((srv) => <ServerCard key={srv.id} srv={srv} />)
              : [0, 1, 2].map((_, i) => (
                  <div
                    key={i}
                    className="relative rounded-2xl border border-white/[0.06] overflow-hidden h-56"
                    style={{ background: "rgba(15,23,42,0.4)" }}
                  >
                    <div
                      className="absolute inset-0 animate-pulse"
                      style={{ background: "rgba(255,255,255,0.012)" }}
                    />
                  </div>
                ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════
            SECTION 3 – TABLESPACES
        ═══════════════════════════════════════════════ */}
        <section className="space-y-4">
          <SectionHeader
            icon={<HardDrive className="w-4 h-4" />}
            title="HO Oracle Tablespaces"
            accent="emerald"
            action={
              <span className="text-[11px] font-mono text-slate-600">
                dba_tablespace_usage_metrics
              </span>
            }
          />

          <div
            className="rounded-2xl border border-white/[0.07] overflow-hidden"
            style={{
              background: "rgba(15,23,42,0.55)",
              backdropFilter: "blur(14px)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)",
            }}
          >
            {loadingDb && tablespaces.length === 0 ? (
              <div className="p-6 space-y-3">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 rounded-lg bg-white/[0.03] animate-pulse"
                    style={{ animationDelay: `${i * 80}ms` }}
                  />
                ))}
              </div>
            ) : tablespaces.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-white/[0.06]" style={{ background: "rgba(255,255,255,0.015)" }}>
                    <tr>
                      <th className="py-3.5 px-5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Tablespace
                      </th>
                      <th className="py-3.5 px-4 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Used
                      </th>
                      <th className="py-3.5 px-4 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="py-3.5 px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Utilization
                      </th>
                      <th className="py-3.5 px-5 text-right text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Used %
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {visibleTablespaces.map((ts, i) => {
                      const pct = ts.usedPct;
                      const badgeCls =
                        pct >= 85
                          ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                          : pct >= 70
                          ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";

                      return (
                        <tr key={i} className="group hover:bg-white/[0.02] transition-colors">
                          <td className="py-3.5 px-5 font-mono font-semibold text-white text-xs">
                            {ts.name}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-400 text-xs">
                            {ts.usedGb.toFixed(2)}{" "}
                            <span className="text-slate-600">GB</span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-500 text-xs">
                            {ts.totalGb.toFixed(2)}{" "}
                            <span className="text-slate-600">GB</span>
                          </td>
                          <td className="py-3.5 px-4 w-44">
                            <UtilBar pct={ts.usedPct} />
                          </td>
                          <td className="py-3.5 px-5 text-right">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-md font-mono font-bold text-xs border ${badgeCls}`}
                            >
                              {ts.usedPct.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-14 text-center text-sm text-slate-600">
                <Database className="w-8 h-8 mx-auto mb-3 opacity-25" />
                No tablespace data returned or query permissions required.
              </div>
            )}

            {/* Collapse / Expand toggle */}
            {tablespaces.length > TABLESPACE_PREVIEW && (
              <div className="border-t border-white/[0.05]">
                <button
                  onClick={() => setShowAllTablespaces((v) => !v)}
                  className="w-full flex items-center justify-center gap-2 py-3 text-xs font-medium text-slate-500 hover:text-slate-300 hover:bg-white/[0.02] transition-all duration-200 group"
                >
                  {showAllTablespaces ? (
                    <>
                      <ChevronUp className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5" />
                      Collapse — showing all {tablespaces.length} tablespaces
                      <ChevronUp className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5" />
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5" />
                      Show all {tablespaces.length} tablespaces
                      <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-600 font-mono">
                        +{tablespaces.length - TABLESPACE_PREVIEW} more
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 transition-transform group-hover:translate-y-0.5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}
