import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "@fontsource-variable/figtree";
import "@fontsource-variable/newsreader";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Ostoja – pomoc przy organizacji pogrzebu", template: "%s · Ostoja" },
  description:
    "Porównaj zakłady pogrzebowe w okolicy w jednym standardzie cen. Bezpłatnie dla rodzin, z opiekunem przez całą dobę.",
};

export const viewport: Viewport = {
  themeColor: "#1E2422",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Odczyt nagłówków = render dynamiczny, więc każda strona dostaje świeży nonce z CSP (src/middleware.ts).
  await headers();
  return (
    <html lang="pl">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
