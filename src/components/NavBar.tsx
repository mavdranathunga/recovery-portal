"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ShieldCheck, ServerCrash, HardDrive, Terminal, Building2, Play, LogOut } from "lucide-react";
import { useOrg } from "@/lib/OrgContext";


const navItems = [
  {
    href: "/",
    label: "Dashboard",
    icon: Activity,
  },
  {
    href: "/recovery",
    label: "Recovery",
    icon: ServerCrash,
  },
  {
    href: "/diagnostics",
    label: "Diagnostics",
    icon: Terminal,
  },
  {
    href: "/mass-runner",
    label: "Mass Runner",
    icon: Play,
  },
  {
    href: "/offline-dump",
    label: "Offline Dump",
    icon: HardDrive,
  },
];

export function NavBar() {
  const { org, setOrg } = useOrg();
  const pathname = usePathname();

  // Hide the navbar on the login page for a clean entrance
  if (pathname === "/login") {
    return null;
  }

  const handleOrgChange = (newOrg: "sathosa" | "idl") => {
    setOrg(newOrg);
    window.location.href = "/";
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-slate-950/60">
      {/* subtle glow */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-500/40 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-20 flex items-center justify-between">

          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-3"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-blue-500/20 blur-xl group-hover:bg-blue-500/30 transition-all duration-300" />

              <div className="relative flex items-center justify-center h-11 w-11 rounded-xl border border-blue-500/20 bg-gradient-to-br from-slate-900 to-slate-800 shadow-lg shadow-black/30">
                <ShieldCheck className="h-5 w-5 text-blue-400" />
              </div>
            </div>

            <div className="flex flex-col leading-tight">
              <span className="text-white font-semibold tracking-tight text-base">
                Recovery Portal
              </span>
            </div>
          </Link>

          {/* Center Navigation */}
          <div className="hidden md:flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2 shadow-2xl shadow-black/20">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative overflow-hidden flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-300 ${
                    isActive
                      ? "text-white bg-white/[0.08] shadow-inner"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.05]"
                  }`}
                >
                  {/* active indicator glow */}
                  {isActive && (
                    <span className="absolute inset-x-3 bottom-0 h-px bg-gradient-to-r from-blue-500/60 via-cyan-400/60 to-blue-500/60 rounded-full" />
                  )}

                  {/* hover glow (inactive only) */}
                  {!isActive && (
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-blue-500/10 via-cyan-500/10 to-transparent" />
                  )}

                  <Icon className={`relative h-4 w-4 transition-transform duration-300 group-hover:scale-110 ${isActive ? "text-blue-400" : ""}`} />

                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </div>


          {/* Organization Switcher & Logout */}
          <div className="flex items-center gap-3">
            <div className="relative flex items-center rounded-xl border border-white/10 bg-slate-900/60 p-1 font-medium text-sm">
              <button
                onClick={() => handleOrgChange("sathosa")}
                className={`relative px-3 py-1.5 rounded-lg transition-all duration-300 ${
                  org === "sathosa"
                    ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Sathosa
              </button>
              <button
                onClick={() => handleOrgChange("idl")}
                className={`relative px-3 py-1.5 rounded-lg transition-all duration-300 ${
                  org === "idl"
                    ? "bg-purple-600 text-white shadow-[0_0_12px_rgba(147,51,234,0.4)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                IDL
              </button>
            </div>

            <button
              onClick={handleLogout}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 font-medium text-sm transition-all duration-300"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
}


