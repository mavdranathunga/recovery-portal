import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";
import { Footer } from "@/components/Footer";
import { OrgProvider } from "@/lib/OrgContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Recovery Portal",
  description: "Recovery Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased flex flex-col min-h-screen bg-slate-950 text-slate-200`}>
        <OrgProvider>
          <NavBar />

          <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
            {children}
          </main>

          <Footer />
        </OrgProvider>
      </body>
    </html>
  );
}


