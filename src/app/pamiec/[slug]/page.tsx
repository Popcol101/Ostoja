import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/site";
import { asAnon } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import type { Ceremony } from "@/lib/labels";

export const dynamic = "force-dynamic";

type Memorial = {
  first_name: string | null;
  last_name: string | null;
  born_year: number | null;
  died_year: number | null;
  note: string | null;
  ceremony: Ceremony;
  home_name: string;
  events: { title: string; starts_at: string; place: string | null }[];
};

async function load(slug: string): Promise<Memorial | null> {
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return null;
  return asAnon(async (tx) => {
    const [row] = await tx<{ data: Memorial | null }[]>`select public_memorial(${slug}) as data`;
    return row?.data ?? null;
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const m = await load((await params).slug);
  if (!m) return { title: "Strona pamięci – Ostoja" };
  return { title: `${m.first_name ?? ""} ${m.last_name ?? ""} – pamięć`.trim(), robots: { index: false } };
}

export default async function MemorialPage({ params }: { params: Promise<{ slug: string }> }) {
  const m = await load((await params).slug);
  if (!m) notFound();
  const years = [m.born_year, m.died_year].filter(Boolean).join("–");

  return (
    <div className="flex min-h-dvh flex-col bg-ground-family">
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12 text-center">
        <p className="text-muted">Z żalem zawiadamiamy o odejściu</p>
        {m.ceremony === "religijna" ? (
          <p className="mt-4 font-serif text-[22px]" aria-hidden="true">
            ✝
          </p>
        ) : null}
        <h1 className="mt-2 font-serif text-[40px] leading-tight">
          {m.ceremony === "religijna" ? <span className="sr-only">Świętej pamięci </span> : null}
          {m.first_name} {m.last_name}
        </h1>
        {years ? <p className="mt-1 text-[18px] text-muted">{years}</p> : null}
        {m.note ? <p className="mx-auto mt-6 max-w-md whitespace-pre-line font-serif text-[20px] leading-relaxed">{m.note}</p> : null}

        {m.events.length > 0 ? (
          <section aria-labelledby="uroczystosci" className="mt-10 rounded-2xl border border-line bg-card p-5 text-left">
            <h2 id="uroczystosci" className="font-serif text-[22px]">
              Uroczystości
            </h2>
            <ul className="mt-3 flex flex-col gap-3">
              {m.events.map((e) => (
                <li key={e.starts_at + e.title}>
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-muted">
                    {formatDateTime(e.starts_at)}
                    {e.place ? ` · ${e.place}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p className="mt-8 text-sm text-muted">Uroczystości organizuje {m.home_name}.</p>
      </main>
      <footer className="flex justify-center border-t border-line py-5">
        <Logo />
      </footer>
    </div>
  );
}
