import { Check, MapPin, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { SearchParams } from "@/components/flash";
import { OPIEKUN_PHONE, SiteFooter, SiteHeader } from "@/components/site";
import { Badge, EmptyState, LinkButton, cx } from "@/components/ui";
import { asAnon } from "@/lib/db";
import { parseSearch, parseSort, SORTS, toQuery } from "@/lib/family-params";
import { formatPln, plural } from "@/lib/format";
import { BURIAL_LABEL, CEREMONY_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Oferty zakładów – Ostoja" };
export const dynamic = "force-dynamic";

type Home = {
  home_id: string;
  slug: string;
  name: string;
  address: string;
  distance_km: number;
  rating: number | null;
  reviews_count: number;
  has_farewell_hall: boolean;
  available_today: boolean;
  quote_pln: number;
  left_from_benefit: number;
};
type PriceRow = { item_key: string; label: string; price_pln: number; optional: boolean };

export default async function OfertyPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const parsed = parseSearch(sp);
  if (!parsed.success) redirect("/zapytanie");
  const input = parsed.data;
  const sort = parseSort(Array.isArray(sp.sort) ? sp.sort[0] : sp.sort);

  const { homes, prices, cityName } = await asAnon(async (tx) => {
    const [city] = await tx<{ name: string }[]>`select name from cities where slug = ${input.miasto}`;
    const homes = await tx<Home[]>`
      select * from search_homes(${input.miasto}, ${input.forma}::burial_type, ${input.ceremonia}::ceremony_type, ${sort})`;
    const prices = new Map<string, PriceRow[]>();
    for (const h of homes) {
      prices.set(
        h.home_id,
        await tx<PriceRow[]>`select * from home_price_list(${h.home_id}, ${input.forma}::burial_type, ${input.ceremonia}::ceremony_type)`,
      );
    }
    return { homes, prices, cityName: city?.name };
  });

  if (!cityName) redirect("/zapytanie");
  const base = { miasto: input.miasto, forma: input.forma, ceremonia: input.ceremonia, miejsce: input.miejsce, budzet: input.budzet };
  const tel = OPIEKUN_PHONE.replace(/\s/g, "");

  return (
    <div className="flex min-h-dvh flex-col bg-ground-family">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        <Link href={`/zapytanie?${toQuery(base)}`} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-brand">
          Zmień odpowiedzi
        </Link>
        <h1 className="font-serif text-[30px] leading-tight sm:text-[36px]">
          {homes.length > 0
            ? `${homes.length} ${plural(homes.length, "zakład", "zakłady", "zakładów")} w okolicy: ${cityName}`
            : `Zakłady w okolicy: ${cityName}`}
        </h1>
        <p className="mt-1 text-muted">
          {BURIAL_LABEL[input.forma]} · {CEREMONY_LABEL[input.ceremonia]}. Ceny obejmują ten sam zakres usług.
        </p>

        {homes.length > 0 ? (
          <>
            <nav aria-label="Sortowanie" className="mt-5 flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <Link
                  key={s.value}
                  href={`/oferty?${toQuery({ ...base, sort: s.value })}`}
                  aria-current={s.value === sort ? "true" : undefined}
                  className={cx(
                    "inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold no-underline",
                    s.value === sort ? "border-brand bg-brand text-white" : "border-line bg-card text-ink",
                  )}
                >
                  {s.label}
                </Link>
              ))}
            </nav>
            <p className="mt-2 text-sm text-muted">Kolejności nie da się kupić. Sortujesz tylko po odległości, cenie albo ocenach.</p>

            <ul className="mt-5 flex flex-col gap-4">
              {homes.map((h) => {
                const rows = prices.get(h.home_id) ?? [];
                const included = rows.filter((r) => !r.optional);
                const extras = rows.filter((r) => r.optional);
                const left = h.left_from_benefit;
                return (
                  <li key={h.home_id} className="rounded-2xl border border-line bg-card p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="font-serif text-[24px] leading-tight">{h.name}</h2>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-muted">
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={16} aria-hidden="true" />
                            {h.distance_km.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} km
                          </span>
                          {h.rating ? (
                            <span className="inline-flex items-center gap-1">
                              <Star size={16} aria-hidden="true" />
                              {h.rating.toLocaleString("pl-PL", { minimumFractionDigits: 1 })} ({h.reviews_count}{" "}
                              {plural(h.reviews_count, "opinia", "opinie", "opinii")})
                            </span>
                          ) : (
                            <span>Brak opinii</span>
                          )}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {h.available_today ? <Badge tone="brand">Przyjmuje zlecenia dziś</Badge> : <Badge>Dziś bez wolnych terminów</Badge>}
                          {h.has_farewell_hall ? <Badge>Własna sala pożegnań</Badge> : null}
                        </div>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-[28px] font-semibold leading-none">{formatPln(h.quote_pln)}</p>
                        <p className={cx("mt-1.5 text-[15px] font-semibold", left >= 0 ? "text-brand" : "text-warn-ink")}>
                          {left >= 0 ? `Z zasiłku zostaje ${formatPln(left)}` : `Dopłata ponad zasiłek ${formatPln(-left)}`}
                        </p>
                      </div>
                    </div>

                    <details className="group mt-4 border-t border-line pt-3">
                      <summary className="flex min-h-11 cursor-pointer list-none items-center font-semibold text-brand">
                        <span className="group-open:hidden">Co obejmuje cena</span>
                        <span className="hidden group-open:inline">Zwiń szczegóły</span>
                      </summary>
                      <ul className="mt-2 flex flex-col gap-1.5 text-[15px]">
                        {included.map((r) => (
                          <li key={r.item_key} className="flex justify-between gap-3">
                            <span className="flex items-center gap-2">
                              <Check size={16} className="shrink-0 text-brand" aria-hidden="true" />
                              {r.label}
                            </span>
                            <span className="tabular-nums">{formatPln(r.price_pln)}</span>
                          </li>
                        ))}
                      </ul>
                      {extras.length > 0 ? (
                        <>
                          <p className="mt-3 text-sm font-semibold text-muted">Dodatkowo, jeśli zechcesz</p>
                          <ul className="mt-1 flex flex-col gap-1.5 text-[15px] text-muted">
                            {extras.map((r) => (
                              <li key={r.item_key} className="flex justify-between gap-3">
                                <span>{r.label}</span>
                                <span className="tabular-nums">{formatPln(r.price_pln)}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      ) : null}
                      <p className="mt-2 text-sm text-muted">{h.address}</p>
                    </details>

                    <LinkButton href={`/oferty/kontakt?${toQuery({ ...base, dom: h.home_id })}`} full className="mt-4 min-h-12 sm:w-auto">
                      Wybierz ten zakład
                    </LinkButton>
                  </li>
                );
              })}
            </ul>

            <div className="mt-6 rounded-2xl border border-line bg-card p-5">
              <p className="font-semibold">Nie wiesz, który wybrać?</p>
              <p className="mt-1 text-muted">Wyślemy zapytanie do trzech najbliższych zakładów. Oddzwoni ten, który odpowie pierwszy.</p>
              <LinkButton href={`/oferty/kontakt?${toQuery(base)}`} variant="secondary" className="mt-3">
                Wyślij do 3 najbliższych
              </LinkButton>
            </div>
          </>
        ) : (
          <div className="mt-6">
            <EmptyState
              title="W tej okolicy nie mamy jeszcze zakładu z pełnym cennikiem."
              action={
                <LinkButton href={`tel:${tel}`}>Zadzwoń do opiekuna: {OPIEKUN_PHONE}</LinkButton>
              }
            >
              Opiekun Ostoi znajdzie zakład i oddzwoni. Odbieramy przez całą dobę.
            </EmptyState>
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
