import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import "@fontsource-variable/newsreader";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Ostoja – pomoc przy organizacji pogrzebu", template: "%s · Ostoja" },
  description:
    "Porównaj zakłady pogrzebowe w okolicy w jednym standardzie cen. Bezpłatnie dla rodzin, z opiekunem przez całą dobę.",
};

export const viewport: Viewport = {
  themeColor: "#24453C",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
