import { Camera, MapPin, Repeat } from "lucide-react";
import type { Metadata } from "next";
import { Flash, type SearchParams } from "@/components/flash";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Card } from "@/components/ui";
import { asAnon } from "@/lib/db";
import type { GraveProduct, GraveService } from "@/lib/grave";
import { GraveOrderForm, type CemeteryOption } from "./order-form";

export const metadata: Metadata = {
  title: "Opieka nad grobem – Ostoja",
  description: "Zapalimy znicz, postawimy kwiaty i posprzątamy grób. Po każdej wizycie dostaniesz zdjęcie. Jednorazowo albo regularnie.",
};
export const dynamic = "force-dynamic";

function isoDay(offset: number): string {
  const d = new Date(Date.now() + offset * 864e5);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(d);
}

export default async function GraveCarePage({ searchParams }: { searchParams: SearchParams }) {
  const { cemeteries, services, products } = await asAnon(async (tx) => ({
    cemeteries: await tx<CemeteryOption[]>`select * from grave_care_cemeteries()`,
    services: await tx<GraveService[]>`select key, label, description, base_price_pln, product_kind from grave_services order by sort_order`,
    products: await tx<GraveProduct[]>`select key, kind, label, price_pln, is_default from grave_products where active order by kind, sort_order`,
  }));
  const available = cemeteries.filter((c) => c.has_provider);

  return (
    <div className="flex min-h-dvh flex-col bg-ground-family">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <h1 className="font-serif text-[32px] leading-tight">Opieka nad grobem</h1>
        <p className="mt-2 text-[17px] text-muted">
          Gdy nie możesz przyjechać, zapalimy znicz, postawimy kwiaty albo posprzątamy grób. Po każdej wizycie dostaniesz zdjęcie.
        </p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { icon: MapPin, t: "Tylko gdy wiemy, gdzie jest grób", d: "Kwatera i numer z wyszukiwarki grobów albo położenie z telefonu." },
            { icon: Camera, t: "Zdjęcie po każdej wizycie", d: "Pod Twoim linkiem i w e-mailu." },
            { icon: Repeat, t: "Jednorazowo albo regularnie", d: "Co tydzień, co miesiąc albo przed świętami." },
          ].map(({ icon: Icon, t, d }) => (
            <li key={t} className="rounded-xl border border-line bg-card p-4">
              <Icon size={20} className="text-brand" aria-hidden="true" />
              <p className="mt-2 font-semibold">{t}</p>
              <p className="text-[15px] text-muted">{d}</p>
            </li>
          ))}
        </ul>

        <div id="zamowienie" className="mt-6 scroll-mt-4">
          <Flash searchParams={searchParams} />
        </div>
        <Card className="mt-2">
          {available.length === 0 ? (
            <p className="text-muted">Usługę uruchamiamy najpierw w Łodzi. Wkrótce kolejne miasta.</p>
          ) : (
            <GraveOrderForm cemeteries={cemeteries} services={services} products={products} minDate={isoDay(1)} maxDate={isoDay(120)} />
          )}
        </Card>
        <p className="mt-4 text-center text-sm text-muted">
          Obsługujemy cmentarze, na których mamy sprawdzonego usługodawcę ({available.length}). Cmentarze oznaczone „wkrótce” dodamy, gdy znajdziemy
          wykonawcę.
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
