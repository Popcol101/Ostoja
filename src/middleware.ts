// Content-Security-Policy z jednorazowym nonce: przeglądarka uruchamia tylko skrypty Next.js z tym nonce
// (i ładowane przez nie – 'strict-dynamic'). Wstrzyknięty <script> z treści (np. imię w formularzu) się nie wykona.
// Next.js sam dokleja nonce do swoich skryptów, gdy znajdzie ten nagłówek w żądaniu; dlatego strony renderują się
// dynamicznie (src/app/layout.tsx).
import { NextResponse, type NextRequest } from "next/server";

export function contentSecurityPolicy(nonce: string, dev = false): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Bez plików statycznych i obrazów – tam nie ma skryptów.
      source: "/((?!_next/static|_next/image|icon.svg|apple-icon.png|opengraph-image.png|brand/|sw.js|manifest.webmanifest|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
