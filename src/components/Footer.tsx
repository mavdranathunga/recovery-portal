import { Activity } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 py-12">

        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">

          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-white">
              <Activity className="h-5 w-5 text-blue-500" />
              <span className="font-semibold tracking-tight">
                Recovery Portal
              </span>
            </div>

            <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
              Centralized command center for real-time synchronization, diagnostics, and recovery.
            </p>

            {/* Status (mobile friendly) */}
            <div className="flex items-center gap-2 text-xs text-slate-500 md:hidden">
              <span className="text-emerald-400 font-semibold uppercase tracking-wider">
                v2.4.0
              </span>
              <span>•</span>
              <span>Prod Env</span>
            </div>
          </div>

          {/* Copyright */}
          <div className="text-slate-400 text-sm text-left md:text-center">
            &copy; {new Date().getFullYear()} Recovery Portal. All rights reserved.
          </div>

          {/* Status (desktop) */}
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-mono">
            <span className="text-emerald-400 font-semibold uppercase tracking-wider">
              v2.4.0
            </span>
            <span>•</span>
            <span>Prod Env</span>
          </div>

        </div>
      </div>
    </footer>
  );
}