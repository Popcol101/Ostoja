import { Camera, ExternalLink, MapPin } from "lucide-react";
import type { Metadata } from "next";
import { SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { Badge, Card, EmptyState, Field, Input, PageTitle } from "@/components/ui";
import { withUser } from "@/lib/db";
import { formatDateTime, formatPlainDate } from "@/lib/format";
import { FREQUENCY_LABEL, type Frequency, type GraveItem, type GraveProduct, type GraveService } from "@/lib/grave";
import { requireProvider } from "@/lib/session";
import { completeVisit } from "./actions";
import { PhotoInput } from "./photo-input";

export const metadata: Metadata = { title: "Wizyty przy grobach" };
export const dynamic = "force-dynamic";

type Visit = {
  visit_id: string;
  due_on: string;
  status: "zaplanowana" | "wykonana" | "nie_wykonano";
  done_at: Date | null;
  note: string | null;
  has_photo: boolean;
  frequency: Frequency;
  items: GraveItem[];
  deceased_name: string;
  cemetery_name: string;
  cemetery_city: string;
  locator: "grobonet" | "miejska" | "brak";
  locator_url: string | null;
  grave_section: string | null;
  grave_row: string | null;
  grave_number: string | null;
  grave_lat: number | null;
  grave_lng: number | null;
  grave_notes: string | null;
};

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Warsaw" }).format(new Date());
}

export default async function ProviderHome({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireProvider();
  const { visits, services, products } = await withUser(me.userId, async (tx) => ({
    visits: await tx<Visit[]>`select * from provider_visits(60)`,
    services: await tx<GraveService[]>`select key, label, description, base_price_pln, product_kind from grave_services`,
    products: await tx<GraveProduct[]>`select key, kind, label, price_pln, is_default from grave_products`,
  }));
  const todo = visits.filter((v) => v.status === "zaplanowana");
  const done = visits.filter((v) => v.status !== "zaplanowana");
  const now = today();

  return (
    <>
      <PageTitle sub="Wizyty przy grobach na Waszych cmentarzach. Po wizycie dodaj zdjęcie grobu – klient dostanie je od razu.">Wizyty</PageTitle>
      <Flash searchParams={searchParams} />
      <h2 className="mb-2 mt-2 text-[19px] font-semibold">Do zrobienia ({todo.length})</h2>
      {todo.length === 0 ? (
        <EmptyState title="Nie ma zaplanowanych wizyt">Nowe zamówienia pojawią się tutaj po opłaceniu przez klienta.</EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {todo.map((v) => {
            const late = v.due_on < now;
            const place = [v.grave_section && `kwatera ${v.grave_section}`, v.grave_row && `rząd ${v.grave_row}`, v.grave_number && `nr ${v.grave_number}`].filter(Boolean).join(", ");
            return (
              <li key={v.visit_id}>
                <Card>
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{formatPlainDate(v.due_on)}</span>
                    {late ? <Badge tone="warn">Po terminie</Badge> : v.due_on === now ? <Badge tone="brand">Dziś</Badge> : null}
                    <span className="text-[13px] text-muted">{FREQUENCY_LABEL[v.frequency]}</span>
                  </p>
                  <h3 className="mt-1 font-serif text-[22px] leading-tight">{v.deceased_name}</h3>
                  <p className="text-muted">
                    {v.cemetery_name}, {v.cemetery_city}
                  </p>
                  <p className="mt-2 font-semibold">{place || "Położenie z telefonu klienta"}</p>
                  {v.grave_notes ? <p className="text-[15px]">{v.grave_notes}</p> : null}
                  <div className="mt-1 flex flex-wrap gap-x-4">
                    {v.grave_lat !== null && v.grave_lng !== null ? (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${v.grave_lat},${v.grave_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand"
                      >
                        <MapPin size={16} aria-hidden="true" /> Nawiguj do grobu
                      </a>
                    ) : null}
                    {v.locator_url ? (
                      <a href={v.locator_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand">
                        <ExternalLink size={16} aria-hidden="true" /> Wyszukiwarka grobów
                      </a>
                    ) : null}
                  </div>
                  <ul className="mt-2 flex flex-col gap-1 border-t border-line-soft pt-2 text-[15px]">
                    {v.items.map((it) => (
                      <li key={it.service}>
                        <span className="font-semibold">{services.find((s) => s.key === it.service)?.label ?? it.service}</span>
                        {(it.products ?? []).map((p) => (
                          <span key={p.key} className="text-muted">
                            {" "}
                            · {products.find((x) => x.key === p.key)?.label ?? p.key} × {p.qty}
                          </span>
                        ))}
                      </li>
                    ))}
                  </ul>
                  <form action={completeVisit} encType="multipart/form-data" className="mt-3 flex flex-col gap-3 border-t border-line-soft pt-3">
                    <input type="hidden" name="visitId" value={v.visit_id} />
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor={`photo-${v.visit_id}`} className="flex items-center gap-2 font-semibold">
                        <Camera size={18} aria-hidden="true" /> Zdjęcie grobu po wizycie
                      </label>
                      <PhotoInput id={`photo-${v.visit_id}`} />
                    </div>
                    <Field id={`note-${v.visit_id}`} label="Uwagi dla klienta (nieobowiązkowe)">
                      <Input id={`note-${v.visit_id}`} name="note" maxLength={300} />
                    </Field>
                    <SubmitButton pendingLabel="Wysyłam…">Wykonane – wyślij zdjęcie</SubmitButton>
                  </form>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="mb-2 mt-6 text-[19px] font-semibold">Wykonane (60 dni)</h2>
      {done.length === 0 ? (
        <p className="text-muted">Tu pojawią się wizyty ze zdjęciami.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {done.map((v) => (
            <li key={v.visit_id}>
              <Card>
                <p className="font-semibold">{v.deceased_name}</p>
                <p className="text-[13px] text-muted">
                  {v.cemetery_name} · {v.done_at ? formatDateTime(v.done_at) : formatPlainDate(v.due_on)}
                </p>
                {v.has_photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/groby/zdjecie?v=${v.visit_id}`} alt={`Grób: ${v.deceased_name}, po wizycie`} className="mt-2 w-full rounded-xl border border-line" loading="lazy" />
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
