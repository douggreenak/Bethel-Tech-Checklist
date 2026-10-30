import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Church Tech Checklist",
    short_name: "Church Tech",
    description: "Shared weekly checklist for church tech teams",
    start_url: "/",
    display: "standalone",
    background_color: "#E3E7ED",
    theme_color: "#0B57D0",
    icons: [
      {
        src: "/icons/icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
      },
      {
        src: "/icons/icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}
