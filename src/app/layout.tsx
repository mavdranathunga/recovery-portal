import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { OrgProvider } from "@/lib/OrgContext";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "Recovery Portal",
  description:
    "Centralized command node for retail branches and warehouses. Monitor live data sync, diagnose server outages, and automate recoveries.",
  applicationName: "Recovery Portal",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Recovery Portal",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#020617" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body className="antialiased flex flex-col min-h-screen bg-slate-950 text-slate-200 overflow-x-hidden">
        <OrgProvider>
          <NavBar />

          <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
            {children}
          </main>

          <Footer />
        </OrgProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
