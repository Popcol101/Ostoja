import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ostoja – panel zakładu",
    short_name: "Ostoja",
    description: "Zapytania od rodzin, zlecenia i kalendarz zakładu pogrzebowego.",
    start_url: "/panel/zapytania",
    display: "standalone",
    background_color: "#ECEDEB",
    theme_color: "#1E2422",
    lang: "pl",
    icons: [
      { src: "/brand/ostoja-ikona-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/ostoja-ikona-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/ostoja-ikona-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
