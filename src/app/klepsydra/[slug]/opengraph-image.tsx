// Podzbiory kroju: „latin” i „latin-ext” (polskie znaki) pod dwiema nazwami – satori szuka brakujących znaków
// w kolejnych krojach z listy fontFamily, a nie w plikach o tej samej nazwie.
// Obraz podglądu linku (Facebook, WhatsApp, SMS z podglądem): klepsydra w poziomie 1200 × 630.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { buildObituary } from "@/lib/obituary";
import { loadPublicObituary } from "@/lib/obituary-data";

export const runtime = "nodejs";
export const alt = "Klepsydra";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONT_DIR = join(process.cwd(), "node_modules/@fontsource/newsreader/files");

async function fonts() {
  const load = (f: string) => readFile(join(FONT_DIR, f));
  const [l5, e5, l6, e6, li, ei] = await Promise.all([
    load("newsreader-latin-500-normal.woff"),
    load("newsreader-latin-ext-500-normal.woff"),
    load("newsreader-latin-600-normal.woff"),
    load("newsreader-latin-ext-600-normal.woff"),
    load("newsreader-latin-500-italic.woff"),
    load("newsreader-latin-ext-500-italic.woff"),
  ]);
  return [
    { name: "Newsreader", data: l5, weight: 500 as const, style: "normal" as const },
    { name: "NewsreaderExt", data: e5, weight: 500 as const, style: "normal" as const },
    { name: "Newsreader", data: l6, weight: 600 as const, style: "normal" as const },
    { name: "NewsreaderExt", data: e6, weight: 600 as const, style: "normal" as const },
    { name: "Newsreader", data: li, weight: 500 as const, style: "italic" as const },
    { name: "NewsreaderExt", data: ei, weight: 500 as const, style: "italic" as const },
  ];
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const d = await loadPublicObituary((await params).slug);
  const o = d ? buildObituary(d.input) : null;
  const died = o ? [o.diedOn ? `${o.verb[0].toUpperCase()}${o.verb.slice(1)} ${o.diedOn}` : null, o.age].filter(Boolean).join(", ") : "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#FFFFFF", padding: 28, fontFamily: "Newsreader, NewsreaderExt" }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "12px solid #000",
            color: "#000",
            padding: "24px 64px",
            textAlign: "center",
          }}
        >
          {o?.symbol === "krzyz" ? (
            <svg width="40" height="60" viewBox="0 0 40 60" style={{ marginBottom: 18 }}>
              <path d="M17 0h6v16h17v6H23v38h-6V22H0v-6h17z" fill="#000" />
            </svg>
          ) : null}
          {o?.honorific ? <div style={{ fontSize: 30, letterSpacing: 4, marginBottom: 6 }}>{o.honorific}</div> : null}
          <div style={{ fontSize: o && o.name.length > 24 ? 64 : 80, fontWeight: 600, lineHeight: 1.05 }}>{o?.name ?? "Klepsydra"}</div>
          {o?.maiden ? <div style={{ fontSize: 30, fontStyle: "italic", marginTop: 6 }}>{o.maiden}</div> : null}
          {o ? (
            <div style={{ fontSize: 32, marginTop: 22 }}>{died}</div>
          ) : null}
          {o?.firstEvent ? <div style={{ fontSize: 30, marginTop: 14 }}>{o.firstEvent}</div> : null}
          {o ? <div style={{ fontSize: 22, marginTop: 30, color: "#444" }}>{o.footer}</div> : null}
        </div>
      </div>
    ),
    { ...size, fonts: await fonts() },
  );
}
