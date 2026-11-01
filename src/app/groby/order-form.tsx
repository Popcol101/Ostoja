"use client";
// Formularz zamówienia opieki nad grobem. Działa bez JS (zwykły formularz); z JS: cena na żywo, link do wyszukiwarki
// grobów wybranego cmentarza i „Jestem przy grobie” (położenie z telefonu).
import { MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/client";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { FREQUENCY_LABEL, quoteGrave, type Frequency, type GraveItem, type GraveProduct, type GraveService } from "@/lib/grave";
import { createGraveOrder } from "@/app/groby-actions";

export type CemeteryOption = { id: string; name: string; city: string; locator: "grobonet" | "miejska" | "brak"; locator_url: string | null; has_provider: boolean };

const pln = (n: number) => `${n.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} zł`;

export function GraveOrderForm({
  cemeteries,
  services,
  products,
  minDate,
  maxDate,
}: {
  cemeteries: CemeteryOption[];
  services: GraveService[];
  products: GraveProduct[];
  minDate: string;
  maxDate: string;
}) {
  const [cemeteryId, setCemeteryId] = useState("");
  const [chosen, setChosen] = useState<Record<string, boolean>>({ znicz: true });
  const [product, setProduct] = useState<Record<string, string>>(() =>
    Object.fromEntries(["znicz", "kwiaty"].map((k) => [k, products.find((p) => p.kind === k && p.is_default)?.key ?? ""])),
  );
  const [qty, setQty] = useState<Record<string, number>>({ znicz: 1, kwiaty: 1 });
  const [gps, setGps] = useState<{ lat: string; lng: string }>({ lat: "", lng: "" });
  const [gpsState, setGpsState] = useState<"" | "szukam" | "ok" | "blad">("");

  const cemetery = cemeteries.find((c) => c.id === cemeteryId);
  const cities = [...new Set(cemeteries.map((c) => c.city))];
  const items: GraveItem[] = services
    .filter((s) => chosen[s.key])
    .map((s) => (s.product_kind ? { service: s.key, products: [{ key: product[s.key], qty: qty[s.key] ?? 1 }] } : { service: s.key }));
  const total = useMemo(() => quoteGrave(items, services, products), [items, services, products]);

  function locate() {
    if (!navigator.geolocation) return setGpsState("blad");
    setGpsState("szukam");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGps({ lat: p.coords.latitude.toFixed(6), lng: p.coords.longitude.toFixed(6) });
        setGpsState("ok");
      },
      () => setGpsState("blad"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <form action={createGraveOrder} className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[19px] font-semibold">1. Gdzie jest grób</legend>
        <Field id="cemetery_id" label="Cmentarz">
          <Select id="cemetery_id" name="cemetery_id" required value={cemeteryId} onChange={(e) => setCemeteryId(e.target.value)}>
            <option value="" disabled>
              Wybierz cmentarz
            </option>
            {cities.map((city) => (
              <optgroup key={city} label={city}>
                {cemeteries
                  .filter((c) => c.city === city)
                  .map((c) => (
                    <option key={c.id} value={c.id} disabled={!c.has_provider}>
                      {c.name}
                      {c.has_provider ? "" : " – wkrótce"}
                    </option>
                  ))}
              </optgroup>
            ))}
          </Select>
        </Field>
        <Field id="deceased_name" label="Imię i nazwisko osoby pochowanej">
          <Input id="deceased_name" name="deceased_name" required maxLength={120} autoComplete="off" />
        </Field>
        {cemetery && cemetery.locator !== "brak" && cemetery.locator_url ? (
          <p className="text-[15px]">
            Kwaterę i numer grobu sprawdzisz w{" "}
            <a href={cemetery.locator_url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand">
              wyszukiwarce grobów {cemetery.locator === "grobonet" ? "(Grobonet)" : "cmentarza"}
            </a>
            .
          </p>
        ) : cemetery ? (
          <p className="rounded-xl bg-warn-tint px-4 py-3 text-[15px] text-warn-ink">
            Ten cmentarz nie ma wyszukiwarki grobów. Zaznacz położenie grobu przyciskiem „Jestem przy grobie”, gdy będziesz na miejscu.
          </p>
        ) : null}
        <div className="grid grid-cols-3 gap-3">
          <Field id="grave_section" label="Kwatera">
            <Input id="grave_section" name="grave_section" maxLength={20} autoComplete="off" />
          </Field>
          <Field id="grave_row" label="Rząd">
            <Input id="grave_row" name="grave_row" maxLength={20} autoComplete="off" />
          </Field>
          <Field id="grave_number" label="Numer">
            <Input id="grave_number" name="grave_number" maxLength={20} autoComplete="off" />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={locate}
            className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border-[1.5px] border-brand bg-card px-4 font-semibold text-brand"
          >
            <MapPin size={18} aria-hidden="true" /> Jestem przy grobie – użyj położenia
          </button>
          <span role="status" className="text-[15px] text-muted">
            {gpsState === "szukam" ? "Ustalam położenie…" : gpsState === "ok" ? `Zapisano położenie grobu (${gps.lat}, ${gps.lng}).` : gpsState === "blad" ? "Nie udało się ustalić położenia. Podaj kwaterę i numer." : ""}
          </span>
        </div>
        <input type="hidden" name="grave_lat" value={gps.lat} />
        <input type="hidden" name="grave_lng" value={gps.lng} />
        <Field id="grave_notes" label="Jak rozpoznać grób (nieobowiązkowe)" hint="Np. szary granit, przy alejce głównej, trzeci od wejścia.">
          <Textarea id="grave_notes" name="grave_notes" rows={2} maxLength={300} aria-describedby="grave_notes-hint" />
        </Field>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[19px] font-semibold">2. Co zrobić</legend>
        {services.map((s) => (
          <div key={s.key} className="rounded-xl border border-line p-4 has-[:checked]:border-brand">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                name="usluga"
                value={s.key}
                checked={!!chosen[s.key]}
                onChange={(e) => setChosen({ ...chosen, [s.key]: e.target.checked })}
                className="mt-1 size-5 shrink-0 accent-brand"
              />
              <span className="flex-1">
                <span className="flex flex-wrap justify-between gap-x-3">
                  <span className="font-semibold">{s.label}</span>
                  <span className="tabular-nums">{pln(Number(s.base_price_pln))}{s.product_kind ? " + " + (s.product_kind === "znicz" ? "znicze" : "kwiaty") : ""}</span>
                </span>
                <span className="block text-[15px] text-muted">{s.description}</span>
              </span>
            </label>
            {s.product_kind && chosen[s.key] ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                <Field id={`produkt_${s.key}`} label={s.product_kind === "znicz" ? "Znicz" : "Kwiaty"}>
                  <Select id={`produkt_${s.key}`} name={`produkt_${s.key}`} value={product[s.key]} onChange={(e) => setProduct({ ...product, [s.key]: e.target.value })}>
                    {products
                      .filter((p) => p.kind === s.product_kind)
                      .map((p) => (
                        <option key={p.key} value={p.key}>
                          {p.label} – {pln(Number(p.price_pln))}
                        </option>
                      ))}
                  </Select>
                </Field>
                <Field id={`sztuki_${s.key}`} label="Sztuk">
                  <Input
                    id={`sztuki_${s.key}`}
                    name={`sztuki_${s.key}`}
                    type="number"
                    min={1}
                    max={20}
                    value={qty[s.key] ?? 1}
                    onChange={(e) => setQty({ ...qty, [s.key]: Math.max(1, Math.min(20, Number(e.target.value) || 1)) })}
                  />
                </Field>
              </div>
            ) : null}
          </div>
        ))}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[19px] font-semibold">3. Kiedy</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="frequency" label="Jak często">
            <Select id="frequency" name="frequency" defaultValue="jednorazowo">
              {(Object.keys(FREQUENCY_LABEL) as Frequency[]).map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABEL[f]}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="first_on" label="Pierwsza wizyta">
            <Input id="first_on" name="first_on" type="date" min={minDate} max={maxDate} defaultValue={minDate} required />
          </Field>
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-[19px] font-semibold">4. Twoje dane</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="customer_name" label="Imię i nazwisko">
            <Input id="customer_name" name="customer_name" autoComplete="name" required maxLength={120} />
          </Field>
          <Field id="customer_email" label="E-mail" hint="Wyślemy na niego potwierdzenie i zdjęcia po wizytach.">
            <Input id="customer_email" name="customer_email" type="email" autoComplete="email" required aria-describedby="customer_email-hint" />
          </Field>
          <Field id="customer_phone" label="Telefon (nieobowiązkowe)">
            <Input id="customer_phone" name="customer_phone" type="tel" autoComplete="tel" />
          </Field>
        </div>
        <label className="flex cursor-pointer items-start gap-3 text-[15px]">
          <input type="checkbox" name="zgoda" value="tak" required className="mt-0.5 size-5 shrink-0 accent-brand" />
          <span>
            Akceptuję <a href="/regulamin" className="font-semibold text-brand">regulamin</a> i zgadzam się, żeby usługodawca Ostoi zobaczył dane grobu. Moich
            danych kontaktowych usługodawca nie dostaje.
          </span>
        </label>
      </fieldset>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-line bg-card px-4 py-3 sm:static sm:mx-0 sm:rounded-xl sm:border">
        <p>
          <span className="block text-[13px] text-muted">Do zapłaty{items.length ? " za wizytę" : ""}</span>
          <span className="text-[24px] font-semibold tabular-nums" aria-live="polite">
            {pln(total)}
          </span>
        </p>
        <SubmitButton pendingLabel="Zapisuję…">Dalej – podsumowanie</SubmitButton>
      </div>
    </form>
  );
}
