import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yusuf Tracker",
    short_name: "Yusuf",
    description: "Track Yusuf's daily care, training plans, and progress.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f4f6",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/icon-192.png?v=3",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png?v=3",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512-maskable.png?v=3",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
