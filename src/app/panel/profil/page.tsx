import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { Card, CardTitle, Field, Input, PageTitle, Textarea } from "@/components/ui";
import { withUser } from "@/lib/db";
import { formatPln } from "@/lib/format";
import { FUNERAL_BENEFIT_PLN } from "@/lib/labels";
import { requireMember } from "@/lib/session";
import { updatePrices, updateProfile } from "../actions";

export const metadata: Metadata = { title: "Profil i cennik" };
export const dynamic = "force-dynamic";

type Home = {
  name: string;
  nip: string;
  address: string;
  phone: string;
  email: string;
  description: string | null;
  service_radius_km: number;
  has_farewell_hall: boolean;
  verified_at: Date | null;
  rating: number | null;
  reviews_count: number;
};
type PriceRow = { item_key: string; label: string; for_burial: string; optional: boolean; price_pln: number | null };

const FOR_LABEL: Record<string, string> = { wszystkie: "każdy pogrzeb", tradycyjny: "pochówek tradycyjny", kremacja: "kremacja" };

export default async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const { home, prices, quotes } = await withUser(me.userId, async (tx) => {
    const [home] = await tx<Home[]>`select * from funeral_homes where id = ${me.homeId}`;
    const prices = await tx<PriceRow[]>`
      select c.item_key, c.label, c.for_burial, c.optional, p.price_pln
      from price_catalog c left join price_items p on p.item_key = c.item_key and p.home_id = ${me.homeId}
      order by c.optional, c.sort_order`;
    const quotes = await tx<{ label: string; quote: number | null }[]>`
      select 'Kremacja z ceremonią świecką' as label, quote_for(${me.homeId}, 'kremacja', 'swiecka') as quote
      union all select 'Pochówek tradycyjny z ceremonią religijną', quote_for(${me.homeId}, 'tradycyjny', 'religijna')
      union all select 'Kremacja bez ceremonii', quote_for(${me.homeId}, 'kremacja', 'bez')`;
    return { home, prices, quotes };
  });
  const canEdit = me.role !== "ekipa";

  return (
    <>
      <PageTitle sub={home.verified_at ? "Profil zweryfikowany przez Ostoję" : "Profil czeka na weryfikację – rodziny go jeszcze nie widzą"}>
        Profil i cennik
      </PageTitle>
      <Flash searchParams={searchParams} />
      <p className="mb-4 lg:hidden">
        <Link href="/panel/rozliczenia" className="font-semibold text-brand">
          Rozliczenia z Ostoją
        </Link>
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle aside={home.rating ? `${String(home.rating).replace(".", ",")} / 5 · ${home.reviews_count} opinii` : undefined}>
            {home.name}
          </CardTitle>
          <form action={updateProfile} className="flex flex-col gap-3">
            <fieldset disabled={!canEdit} className="flex flex-col gap-3">
              <Field label="Telefon dla rodzin" id="phone">
                <Input id="phone" name="phone" type="tel" defaultValue={home.phone} required />
              </Field>
              <Field label="E-mail" id="email">
                <Input id="email" name="email" type="email" defaultValue={home.email} required />
              </Field>
              <Field label="Adres" id="address">
                <Input id="address" name="address" defaultValue={home.address} required />
              </Field>
              <Field label="Opis dla rodzin" id="description" hint="Krótko i konkretnie: od kiedy działacie, co macie (chłodnia, sala, karawany).">
                <Textarea id="description" name="description" defaultValue={home.description ?? ""} maxLength={600} aria-describedby="description-hint" />
              </Field>
              <Field label="Obszar działania (km od centrum miasta)" id="radius">
                <Input id="radius" name="service_radius_km" type="number" min={1} max={200} defaultValue={home.service_radius_km} required />
              </Field>
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" name="has_farewell_hall" value="tak" defaultChecked={home.has_farewell_hall} className="size-5 accent-brand" />
                Mamy własną salę pożegnań
              </label>
            </fieldset>
            <p className="text-[13px] text-muted">NIP {home.nip}. Nazwę i NIP zmienia Ostoja po weryfikacji dokumentów.</p>
            {canEdit ? <SubmitButton>Zapisz profil</SubmitButton> : <p className="text-muted">Profil edytuje właściciel lub biuro.</p>}
          </form>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>Tak widzą to rodziny</CardTitle>
            <ul className="flex flex-col gap-2">
              {quotes.map((q) => (
                <li key={q.label} className="flex items-baseline justify-between gap-3 rounded-[10px] bg-ground-family px-3 py-2.5">
                  <span>{q.label}</span>
                  <span className="text-right">
                    <span className="block font-bold">{q.quote === null ? "Uzupełnij cennik" : formatPln(q.quote)}</span>
                    {q.quote !== null ? (
                      <span className="text-[13px] text-muted">z zasiłku zostaje {formatPln(FUNERAL_BENEFIT_PLN - q.quote)}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[13px] text-muted">
              Kolejność zakładów w wynikach zależy od odległości, ceny i ocen. Nie można jej kupić.
            </p>
          </Card>

          <Card>
            <CardTitle>Cennik w standardzie Ostoi</CardTitle>
            <form action={updatePrices} className="flex flex-col gap-2">
              <fieldset disabled={!canEdit}>
                <legend className="sr-only">Ceny pozycji w złotych</legend>
                <ul className="flex flex-col divide-y divide-line-soft">
                  {prices.map((p) => (
                    <li key={p.item_key} className="flex items-center justify-between gap-3 py-2">
                      <label htmlFor={`price-${p.item_key}`} className="flex flex-col">
                        <span className="font-semibold">{p.label}</span>
                        <span className="text-[13px] text-muted">
                          {p.optional ? "dodatkowo, wybiera rodzina" : FOR_LABEL[p.for_burial]}
                        </span>
                      </label>
                      <span className="flex items-center gap-1.5">
                        <Input
                          id={`price-${p.item_key}`}
                          name={`price:${p.item_key}`}
                          inputMode="decimal"
                          defaultValue={p.price_pln ?? ""}
                          className="w-28 text-right"
                          placeholder={p.optional ? "brak" : "wymagane"}
                        />
                        <span aria-hidden="true">zł</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </fieldset>
              {canEdit ? <SubmitButton>Zapisz cennik</SubmitButton> : null}
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
