import Link from "next/link";
import { SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { Card, Field, Input, Notice, PageTitle, Select, Textarea } from "@/components/ui";
import { withUser } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { createHome } from "../../actions";

export default async function NewHome({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireAdmin();
  const cities = await withUser(admin.userId, (tx) => tx<{ slug: string; name: string }[]>`select slug, name from cities order by name`);

  return (
    <>
      <Link href="/admin" className="text-sm font-semibold text-brand">
        Wszystkie zakłady
      </Link>
      <PageTitle sub="Zakład pojawi się rodzinom dopiero po weryfikacji i uzupełnieniu cennika.">Dodaj partnera</PageTitle>
      <Flash searchParams={searchParams} />
      <form action={createHome} className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="flex flex-col gap-4">
          <Field id="name" label="Nazwa zakładu">
            <Input id="name" name="name" required minLength={3} maxLength={120} placeholder="Zakład Pogrzebowy Wierzba" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="nip" label="NIP">
              <Input id="nip" name="nip" required inputMode="numeric" placeholder="725-000-11-22" />
            </Field>
            <Field id="city_slug" label="Miasto">
              <Select id="city_slug" name="city_slug" required defaultValue="">
                <option value="" disabled>
                  Wybierz miasto
                </option>
                {cities.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field id="address" label="Adres biura">
            <Input id="address" name="address" required placeholder="ul. Wierzbowa 1, 90-001 Łódź" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="phone" label="Telefon dla rodzin">
              <Input id="phone" name="phone" type="tel" required placeholder="+48 600 000 010" />
            </Field>
            <Field id="email" label="E-mail zakładu">
              <Input id="email" name="email" type="email" required />
            </Field>
          </div>
          <Field id="description" label="Opis (nieobowiązkowe)" hint="Widzą go rodziny. Zakład może go później zmienić.">
            <Textarea id="description" name="description" maxLength={1000} aria-describedby="description-hint" />
          </Field>
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <Field id="service_radius_km" label="Zasięg (km od miasta)">
              <Input id="service_radius_km" name="service_radius_km" type="number" min={1} max={200} defaultValue={25} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="lat" label="Szer. geogr.">
                <Input id="lat" name="lat" inputMode="decimal" placeholder="51.7592" />
              </Field>
              <Field id="lng" label="Dł. geogr.">
                <Input id="lng" name="lng" inputMode="decimal" placeholder="19.4560" />
              </Field>
            </div>
            <p className="text-[14px] text-muted">Bez współrzędnych przyjmiemy środek miasta. Od nich zależy odległość pokazywana rodzinom.</p>
            <label className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="has_farewell_hall" value="tak" className="size-5 accent-brand" />
              Własna sala pożegnań
            </label>
          </Card>
          <Notice title="Po dodaniu">
            Zaproś właściciela do panelu, poproś o uzupełnienie cennika i sprawdź dokumenty (wpis do CEIDG lub KRS, umowa partnerska). Dopiero
            wtedy zweryfikuj zakład.
          </Notice>
          <SubmitButton full pendingLabel="Dodaję…">
            Dodaj zakład
          </SubmitButton>
        </div>
      </form>
    </>
  );
}
