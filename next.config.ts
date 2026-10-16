import type { NextConfig } from "next";

// Nagłówki bezpieczeństwa. Link dla rodziny (/r/<token>) nie może wyciec w nagłówku Referer
// do innych stron, dlatego tam „no-referrer”.
const security = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // Content-Security-Policy z nonce ustawia src/middleware.ts.
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Kroje do obrazu podglądu klepsydry (next/og czyta pliki z dysku – Vercel musi je dołączyć do funkcji).
  outputFileTracingIncludes: {
    "/klepsydra/[slug]/opengraph-image": ["./node_modules/@fontsource/newsreader/files/newsreader-latin*-{500,600}-*.woff"],
  },
  async headers() {
    const headers = [
      { source: "/:path*", headers: security },
      { source: "/r/:token*", headers: [{ key: "Referrer-Policy", value: "no-referrer" }, { key: "Cache-Control", value: "no-store" }] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
    // Wersja testowa nie trafia do wyszukiwarek (ALLOW_INDEXING=true tylko na produkcji).
    if (process.env.ALLOW_INDEXING !== "true") {
      headers.push({ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] });
    }
    return headers;
  },
};

export default nextConfig;
