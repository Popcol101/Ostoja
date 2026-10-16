import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ObituaryCard } from "@/components/obituary-card";
import { ShareButtons } from "@/components/share";
import { buildObituary, shareText } from "@/lib/obituary";
import { loadPublicObituary } from "@/lib/obituary-data";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const d = await loadPublicObituary(slug);
  return d ? { ...d, o: buildObituary(d.input) } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const d = await load((await params).slug);
  if (!d) return { title: "Klepsydra – Ostoja", robots: { index: false, follow: false } };
  const title = `${d.o.honorific ? `${d.o.honorific} ` : ""}${d.o.name} – klepsydra`;
  const description = shareText(d.o);
  return {
    title: { absolute: title },
    description,
    // Klepsydra jest do udostępniania linkiem, nie do wyszukiwarek.
    robots: { index: false, follow: false },
    openGraph: { title, description, type: "article", locale: "pl_PL" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicObituary({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await load(slug);
  if (!d) notFound();
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const url = `${origin}/klepsydra/${slug}`;

  return (
    <div className="flex min-h-dvh flex-col bg-ground-family">
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-6">
        <ObituaryCard o={d.o} variant="screen" heading="h1" className="rounded-[14px] border border-line" />
        <section aria-labelledby="udostepnij" className="rounded-[14px] border border-line bg-card p-4">
          <h2 id="udostepnij" className="mb-3 text-[17px] font-semibold">
            Przekaż wiadomość bliskim
          </h2>
          <ShareButtons url={url} text={shareText(d.o)} subject={`Klepsydra – ${d.o.name}`} />
        </section>
        {d.memorialSlug ? (
          <Link
            href={`/pamiec/${d.memorialSlug}`}
            className="inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-brand px-4 font-semibold text-brand no-underline"
          >
            Strona pamięci
          </Link>
        ) : null}
        <p className="text-center text-sm text-muted">
          Pytania o uroczystości: {d.input.homeName}, tel.{" "}
          <a href={`tel:${d.input.homePhone.replace(/\s/g, "")}`} className="font-semibold text-brand">
            {d.input.homePhone}
          </a>
        </p>
      </main>
    </div>
  );
}
