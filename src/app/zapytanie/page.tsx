import type { Metadata } from "next";
import { param, type SearchParams } from "@/components/flash";
import { OPIEKUN_PHONE, SiteFooter, SiteHeader } from "@/components/site";
import { asAnon } from "@/lib/db";
import { Kreator } from "./kreator";

export const metadata: Metadata = { title: "Sprawdź ceny – Ostoja" };
export const dynamic = "force-dynamic";

export default async function ZapytaniePage({ searchParams }: { searchParams: SearchParams }) {
  const cities = await asAnon((tx) => tx<{ slug: string; name: string }[]>`select slug, name from cities order by name`);
  const initial: Record<string, string> = {};
  for (const key of ["miasto", "miejsce", "forma", "ceremonia", "budzet"]) {
    const v = await param(searchParams, key);
    if (v) initial[key] = v;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-ground-family">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        <h1 className="sr-only">Sprawdź ceny pogrzebu</h1>
        <Kreator cities={cities} initial={initial} />
        <p className="mt-8 text-center text-muted">
          Wolisz porozmawiać?{" "}
          <a href={`tel:${OPIEKUN_PHONE.replace(/\s/g, "")}`} className="font-semibold text-brand">
            Zadzwoń: {OPIEKUN_PHONE}
          </a>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
