"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ShieldCheck, ServerCrash, HardDrive, Terminal, Building2, Play, LogOut } from "lucide-react";
import { useOrg } from "@/lib/OrgContext";


const navItems = [
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
    <nav className="sticky top-0 z-50 border-b border-white/[0.08] bg-slate-950/80 backdrop-blur-2xl">
      {/* subtle top/bottom glow */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-16 flex items-center justify-between">

          {/* Logo */}
          <Link
            href="/"
            className="group flex items-center gap-2.5"
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-blue-500/20 blur-md group-hover:bg-blue-500/30 transition-all duration-300" />
              <div className="relative flex items-center justify-center h-9 w-9 rounded-lg border border-blue-500/30 bg-gradient-to-br from-slate-900 to-slate-950 shadow-md">
                <ShieldCheck className="h-4.5 w-4.5 text-blue-400" />
              </div>
            </div>

            <div className="flex flex-col leading-tight">
              <span className="text-white font-semibold tracking-tight text-sm">
                Recovery Portal
              </span>
            </div>
          </Link>

          {/* Center Navigation */}
          <div className="hidden md:flex items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1 shadow-lg shadow-black/20">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? "text-white bg-white/[0.08] shadow-sm border border-white/[0.08]"
                      : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 transition-transform duration-200 ${isActive ? "text-blue-400" : "text-slate-400 group-hover:text-slate-200"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Organization Switcher & Logout */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center rounded-lg border border-white/[0.08] bg-slate-950/60 p-0.5 text-xs">
              <button
                onClick={() => handleOrgChange("sathosa")}
                className={`relative px-2.5 py-1 rounded-md font-medium transition-all duration-200 ${
                  org === "sathosa"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Sathosa
              </button>
              <button
                onClick={() => handleOrgChange("idl")}
                className={`relative px-2.5 py-1 rounded-md font-medium transition-all duration-200 ${
                  org === "idl"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                IDL
              </button>
            </div>

            <button
              onClick={handleLogout}
              className="group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-slate-950/60 hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 font-medium text-xs transition-all duration-200"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>

        </div>
      </div>
    </nav>
  );
}


