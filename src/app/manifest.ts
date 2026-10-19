import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Recovery Portal",
    short_name: "RecoveryPortal",
    description:
      "Centralized command node for retail branches and warehouses. Monitor live data sync, diagnose server outages, and automate recoveries.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020617", // slate-950
    theme_color: "#020617",      // slate-950
    categories: ["utilities", "productivity"],
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
