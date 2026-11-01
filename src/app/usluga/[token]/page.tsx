import { CalendarDays, Camera } from "lucide-react";
import type { Metadata } from "next";
import { Flash, type SearchParams } from "@/components/flash";
import { OPIEKUN_PHONE, SiteFooter, SiteHeader } from "@/components/site";
import { Badge, Card, CardTitle, EmptyState, LinkButton, Notice } from "@/components/ui";
import { gravePaymentsMode } from "@/app/groby-actions";
import { asAnon } from "@/lib/db";
import { formatDateTime, formatPlainDate, formatPln } from "@/lib/format";
import { FREQUENCY_LABEL, VISIT_STATUS_LABEL, type Frequency, type GraveItem, type GraveProduct, type GraveService } from "@/lib/grave";

export const metadata: Metadata = { title: "Opieka nad grobem – zamówienie", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Order = {
  status: "do_zaplaty" | "oplacone" | "anulowane";
  total_pln: number;
  frequency: Frequency;
  first_on: string;
  deceased_name: string;
  customer_email: string;
  grave_section: string | null;
  grave_row: string | null;
  grave_number: string | null;
  has_gps: boolean;
  items: GraveItem[];
  paid_at: string | null;
  cemetery: { name: string; city: string };
  provider: { name: string; phone: string } | null;
  visits: { id: string; due_on: string; status: string; done_at: string | null; note: string | null; has_photo: boolean }[];
};

export default async function GraveOrderPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: SearchParams }) {
  const { token } = await params;
  const valid = /^[a-f0-9]{48}$/.test(token);
  const data = valid
    ? await asAnon(async (tx) => {
        const [row] = await tx<{ o: Order | null }[]>`select grave_order_by_token(${token}) as o`;
        const services = await tx<GraveService[]>`select key, label, description, base_price_pln, product_kind from grave_services`;
        const products = await tx<GraveProduct[]>`select key, kind, label, price_pln, is_default from grave_products`;
        return { order: row?.o ?? null, services, products };
      })
    : null;
  const order = data?.order ?? null;
  const payments = await gravePaymentsMode();

  return (
    <div className="flex min-h-dvh flex-col bg-ground-family">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        {!order || !data ? (
          <EmptyState title="Nie znaleźliśmy tego zamówienia." action={<LinkButton href="/groby">Zamów opiekę nad grobem</LinkButton>}>
            Sprawdź link z e-maila albo zadzwoń: {OPIEKUN_PHONE}.
          </EmptyState>
        ) : (
          <>
            <p className="text-[15px] text-muted">Opieka nad grobem</p>
            <h1 className="font-serif text-[30px] leading-tight">{order.deceased_name}</h1>
            <p className="text-muted">
              {order.cemetery.name}, {order.cemetery.city}
            </p>
            <div className="mt-4">
              <Flash searchParams={searchParams} />
            </div>

            <div className="mt-2 flex flex-col gap-4">
              <Card>
                <CardTitle aside={order.status === "oplacone" ? <Badge tone="brand">Opłacone</Badge> : order.status === "do_zaplaty" ? <Badge tone="warn">Do zapłaty</Badge> : <Badge>Anulowane</Badge>}>
                  Podsumowanie
                </CardTitle>
                <ul className="flex flex-col gap-1.5 text-[15px]">
                  {order.items.map((it) => {
                    const s = data.services.find((x) => x.key === it.service);
                    return (
                      <li key={it.service}>
                        <span className="font-semibold">{s?.label ?? it.service}</span>
                        {(it.products ?? []).map((p) => {
                          const prod = data.products.find((x) => x.key === p.key);
                          return <span key={p.key} className="block text-muted">{prod?.label ?? p.key} × {p.qty}</span>;
                        })}
                      </li>
                    );
                  })}
                </ul>
                <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 border-t border-line pt-3 text-[15px]">
                  <dt className="text-muted">Grób</dt>
                  <dd>
                    {[order.grave_section && `kwatera ${order.grave_section}`, order.grave_row && `rząd ${order.grave_row}`, order.grave_number && `nr ${order.grave_number}`]
                      .filter(Boolean)
                      .join(", ") || (order.has_gps ? "położenie z telefonu" : "–")}
                  </dd>
                  <dt className="text-muted">Częstotliwość</dt>
                  <dd>{FREQUENCY_LABEL[order.frequency]}</dd>
                  <dt className="text-muted">Pierwsza wizyta</dt>
                  <dd>{formatPlainDate(order.first_on)}</dd>
                  <dt className="text-muted">Potwierdzenia</dt>
                  <dd className="break-all">{order.customer_email}</dd>
                </dl>
                <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                  <span>{order.frequency === "jednorazowo" ? "Razem" : "Za każdą wizytę"}</span>
                  <span className="text-[24px] font-semibold">{formatPln(order.total_pln)}</span>
                </div>
                {order.status === "do_zaplaty" ? (
                  payments ? (
                    <LinkButton href={`/usluga/${token}/platnosc`} full className="mt-3">
                      Zapłać {formatPln(order.total_pln)}
                    </LinkButton>
                  ) : (
                    <div className="mt-3">
                      <Notice tone="warn">Płatności online ruszą wkrótce. Zamówienie jest zapisane – opiekun Ostoi skontaktuje się z Tobą.</Notice>
                    </div>
                  )
                ) : null}
              </Card>

              {order.status === "oplacone" ? (
                <Card>
                  <CardTitle aside={order.provider ? order.provider.name : undefined}>Wizyty</CardTitle>
                  <ul className="flex flex-col gap-4">
                    {order.visits.map((v) => (
                      <li key={v.id} className="flex flex-col gap-2">
                        <p className="flex flex-wrap items-center gap-2">
                          <CalendarDays size={18} className="text-brand" aria-hidden="true" />
                          <span className="font-semibold">{formatPlainDate(v.due_on)}</span>
                          <Badge tone={v.status === "wykonana" ? "brand" : "neutral"}>{VISIT_STATUS_LABEL[v.status]}</Badge>
                          {v.done_at ? <span className="text-[13px] text-muted">{formatDateTime(v.done_at)}</span> : null}
                        </p>
                        {v.has_photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/groby/zdjecie?t=${token}&v=${v.id}`}
                            alt={`Grób po wizycie ${formatPlainDate(v.due_on)}`}
                            className="w-full rounded-xl border border-line"
                            loading="lazy"
                          />
                        ) : v.status === "zaplanowana" ? (
                          <p className="flex items-center gap-2 text-[15px] text-muted">
                            <Camera size={16} aria-hidden="true" /> Zdjęcie pojawi się po wizycie.
                          </p>
                        ) : null}
                        {v.note ? <p className="text-[15px]">{v.note}</p> : null}
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}

              <p className="text-center text-sm text-muted">
                Ten link jest tylko dla Ciebie. Pytania: {OPIEKUN_PHONE}.
              </p>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
