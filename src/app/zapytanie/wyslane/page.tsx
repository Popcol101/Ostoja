import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import { param, type SearchParams } from "@/components/flash";
import { OPIEKUN_PHONE, SiteFooter, SiteHeader } from "@/components/site";
import { LinkButton } from "@/components/ui";
import { asAnon } from "@/lib/db";
import { parseSearch } from "@/lib/family-params";

export const metadata: Metadata = { title: "Zapytanie wysłane – Ostoja" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function WyslanePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const dom = await param(searchParams, "dom");
  const search = parseSearch(sp);
  // Nazwa zakładu jest publiczna (lista ofert), więc bierzemy ją z search_homes, nie z danych zapytania.
  const homeName =
    dom && UUID.test(dom) && search.success
      ? await asAnon(async (tx) => {
          const [h] = await tx<{ name: string }[]>`
            select name from search_homes(${search.data.miasto}, ${search.data.forma}::burial_type, ${search.data.ceremonia}::ceremony_type)
            where home_id = ${dom}`;
          return h?.name ?? null;
        })
      : null;
  const tel = OPIEKUN_PHONE.replace(/\s/g, "");

  return (
    <div className="flex min-h-dvh flex-col bg-ground-family">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        <CheckCircle2 size={40} className="text-brand" aria-hidden="true" />
        <h1 className="mt-3 font-serif text-[32px] leading-tight">Zapytanie wysłane</h1>
        <p className="mt-2 text-[18px]">
          {homeName ? `${homeName} oddzwoni do Ciebie w ciągu 15 minut.` : "Zakład oddzwoni do Ciebie w ciągu 15 minut."}
        </p>
        <ol className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-card p-5">
          <li>
            <p className="font-semibold">Odbierz telefon od zakładu</p>
            <p className="text-muted">Numer może być nieznany. Zakład przedstawi się i powie, że dzwoni z Ostoi.</p>
          </li>
          <li>
            <p className="font-semibold">Dostaniesz SMS z linkiem</p>
            <p className="text-muted">Pod linkiem zobaczysz terminy, koszty i uzupełnisz dane do dokumentów. Bez logowania.</p>
          </li>
          <li>
            <p className="font-semibold">Przygotuj kartę zgonu</p>
            <p className="text-muted">Wystawia ją lekarz. Zakład powie, co jeszcze będzie potrzebne.</p>
          </li>
        </ol>
        <div className="mt-6 rounded-2xl bg-brand-tint p-5">
          <p className="font-semibold text-brand-dark">Nikt nie zadzwonił w 15 minut?</p>
          <p className="mt-1 text-brand-dark">Przekażemy zapytanie dalej automatycznie. Możesz też od razu zadzwonić do opiekuna.</p>
          <LinkButton href={`tel:${tel}`} variant="secondary" className="mt-3">
            Zadzwoń: {OPIEKUN_PHONE}
          </LinkButton>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
