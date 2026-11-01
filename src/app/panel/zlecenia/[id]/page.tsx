import { AlertTriangle, Check, FileText, Phone, Printer } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton, SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { Badge, Card, CardTitle, Field, Input, LinkButton, Select, Textarea } from "@/components/ui";
import { withUser } from "@/lib/db";
import { dayKey, formatDateTime, formatPlainDate, formatPln, formatTime } from "@/lib/format";
import {
  BURIAL_LABEL,
  CEREMONY_LABEL,
  EVENT_KIND_LABEL,
  EVENT_STATUS_LABEL,
  FUNERAL_BENEFIT_PLN,
  OSTOJA_FEE_PLN,
  STAGES,
  STAGE_LABEL,
  type Burial,
  type Ceremony,
  type EventKind,
  type EventStatus,
  type OrderStage,
} from "@/lib/labels";
import { requireMember } from "@/lib/session";
import { assignOrderItem, manualInvoice, publishMemorial, removeOrderItem, requestInvoice, sendFamilySms, updatePayerAddress, setEventStatus, setStage, signContract, toggleTask, updateOrderDetails } from "../../actions";
import { EventForm, type Resource } from "../../event-form";

export const metadata: Metadata = { title: "Karta zlecenia" };
export const dynamic = "force-dynamic";

type Order = {
  id: string;
  stage: OrderStage;
  burial: Burial;
  ceremony: Ceremony;
  deceased_first_name: string | null;
  deceased_last_name: string | null;
  born_on: string | null;
  died_at: Date | null;
  principal_name: string;
  principal_phone: string;
  principal_email: string | null;
  principal_street: string | null;
  principal_post_code: string | null;
  principal_city: string | null;
  zus_bank_account: string | null;
  total_pln: number | null;
  notes: string | null;
  contract_signed_at: Date | null;
  family_updated_at: Date | null;
  family_token: string;
  memorial_slug: string | null;
  memorial_published: boolean;
  memorial_note: string | null;
  offer_id: string | null;
  home_id: string;
  family_consents: Record<string, boolean>;
};

type Item = { label: string; price_pln: number; optional: boolean };
type Task = { id: string; title: string; done: boolean; assignee_name: string | null };
type Ev = {
  id: string;
  kind: EventKind;
  title: string;
  status: EventStatus;
  starts_at: Date;
  ends_at: Date;
  place: string | null;
  resource_names: string[];
  warning: string | null;
};

type InvoiceRow = {
  status: "do_wystawienia" | "wystawiona" | "blad" | "reczna";
  provider: string | null;
  number: string | null;
  issued_on: string | null;
  gross_pln: number | null;
  ksef_number: string | null;
  ksef_status: string | null;
  view_url: string | null;
  attempts: number;
  last_error: string | null;
};

const KSEF_LABEL: Record<string, string> = {
  processing: "wysłana do KSeF, czeka na numer",
  ok: "w KSeF",
  send_error: "błąd wysyłki do KSeF – sprawdź w programie do faktur",
  offline: "tryb offline – program wyśle do KSeF później",
  offline_error: "błąd trybu offline – sprawdź w programie do faktur",
};

type OrderStock = { stock_item_id: string; name: string; kind: string; qty: number; unit_price_pln: number };
type StockOption = { id: string; name: string; kind: string; qty: number; price_pln: number };

type Sms = { status: "oczekuje" | "wyslano" | "blad" | "pominieto"; last_error: string | null; created_at: Date; sent_at: Date | null };

const SMS_STATUS: Record<Sms["status"], string> = {
  oczekuje: "w kolejce",
  wyslano: "wysłany",
  blad: "błąd – ponowimy",
  pominieto: "nie wysłano",
};

export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireMember();

  const data = await withUser(me.userId, async (tx) => {
    const [order] = await tx<Order[]>`select * from orders where id = ${id}`;
    if (!order) return null;
    const items = await tx<Item[]>`
      select c.label, p.price_pln, c.optional
      from orders o
      cross join lateral unnest(o.selected_items) as k(item_key)
      join price_catalog c on c.item_key = k.item_key
      join price_items p on p.item_key = k.item_key and p.home_id = o.home_id
      where o.id = ${id}
      order by c.sort_order`;
    const tasks = await tx<Task[]>`
      select t.id, t.title, t.done, m.display_name as assignee_name
      from order_tasks t left join memberships m on m.user_id = t.assignee and m.home_id = t.home_id
      where t.order_id = ${id} order by t.sort_order, t.title`;
    const events = await tx<Ev[]>`
      select id, kind, title, status, starts_at, ends_at, place, resource_names, warning
      from calendar_events where order_id = ${id} order by starts_at`;
    const resources = await tx<Resource[]>`select id, name from resources order by kind, name`;
    const sms = await tx<Sms[]>`
      select status, last_error, created_at, sent_at from notifications
      where order_id = ${id} and kind = 'link_dla_rodziny' order by created_at desc limit 3`;
    const orderStock = await tx<OrderStock[]>`
      select oi.stock_item_id, s.name, s.kind, oi.qty, oi.unit_price_pln
      from order_items oi join stock_items s on s.id = oi.stock_item_id
      where oi.order_id = ${id} order by s.kind, s.name`;
    const stockOptions = await tx<StockOption[]>`
      select id, name, kind, qty, price_pln from stock_items
      where home_id = ${order.home_id} and active and qty > 0
        and id not in (select stock_item_id from order_items where order_id = ${id})
      order by kind, name`;
    const [invoice] = await tx<InvoiceRow[]>`
      select status, provider, number, issued_on, gross_pln, ksef_number, ksef_status, view_url, attempts, last_error
      from invoices where order_id = ${id}`;
    return { order, items, tasks, events, resources, sms, orderStock, stockOptions, invoice: invoice ?? null };
  });
  if (!data) notFound();
  const { order: o, items, tasks, events, resources, sms, orderStock, stockOptions, invoice } = data;
  const canEditStock = me.role !== "ekipa";

  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const familyUrl = `${origin}/r/${o.family_token}`;
  const name = [o.deceased_first_name, o.deceased_last_name].filter(Boolean).join(" ");
  const smsBody = `Dzień dobry, tu ${me.homeName}. Terminy, koszty i dane do dokumentów: ${familyUrl}`;
  const path = `/panel/zlecenia/${o.id}`;
  const visibleStages = STAGES.filter((s) => s !== "zamkniete");
  const stageIndex = STAGES.indexOf(o.stage);

  const zusChecklist = [
    { label: "Imię i nazwisko zmarłego", ok: Boolean(o.deceased_first_name && o.deceased_last_name) },
    { label: "Data zgonu", ok: Boolean(o.died_at) },
    { label: "Dane osoby, która pokryła koszty", ok: Boolean(o.principal_name) },
    { label: "Numer konta do wypłaty zasiłku", ok: Boolean(o.zus_bank_account) },
    { label: "Faktura za pogrzeb", ok: Boolean(invoice && (invoice.status === "wystawiona" || invoice.status === "reczna")) },
  ];
  const zusDone = zusChecklist.filter((c) => c.ok).length;

  return (
    <>
      <div className="mb-4">
        <Link href="/panel/zlecenia" className="text-sm font-semibold text-brand">
          ← Wszystkie zlecenia
        </Link>
        <h1 className="mt-1 font-serif text-[30px] leading-tight">{name || "Dane zmarłego do uzupełnienia"}</h1>
        <p className="text-muted">
          {BURIAL_LABEL[o.burial]} · {CEREMONY_LABEL[o.ceremony].toLowerCase()}
          {o.offer_id ? "" : " · zlecenie spoza Ostoi"}
        </p>
      </div>
      <Flash searchParams={searchParams} />

      <ol aria-label="Etapy zlecenia" className="mb-5 grid grid-cols-5 gap-1">
        {visibleStages.map((s, i) => {
          const done = i < stageIndex || o.stage === "zamkniete";
          const current = i === stageIndex;
          return (
            <li key={s} aria-current={current ? "step" : undefined} className="flex flex-col gap-1.5">
              <span className={`h-1.5 rounded-full ${done ? "bg-brand" : current ? "bg-warn" : "bg-line"}`} />
              <span className={`text-[12px] sm:text-[13px] ${current ? "font-bold text-ink" : "text-muted"}`}>
                {STAGE_LABEL[s]}
                {done ? <span className="sr-only"> – zakończony</span> : null}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>Kontakt z rodziną</CardTitle>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{o.principal_name}</p>
                <p className="text-muted">{o.principal_phone}</p>
                {o.principal_email ? <p className="text-muted">{o.principal_email}</p> : null}
              </div>
              <LinkButton href={`tel:${o.principal_phone.replace(/\s/g, "")}`} prefetch={false}>
                <Phone size={18} aria-hidden="true" /> Zadzwoń
              </LinkButton>
            </div>
            <details className="mt-3 border-t border-line-soft pt-2" open={!o.principal_city && Boolean(o.contract_signed_at)}>
              <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand">
                {o.principal_city ? `Adres: ${o.principal_street ?? ""}, ${o.principal_post_code ?? ""} ${o.principal_city}` : "Adres do faktury i wniosku o zasiłek"}
              </summary>
              <form action={updatePayerAddress} className="mt-1 grid gap-3 sm:grid-cols-[minmax(0,2fr)_7rem_minmax(0,1fr)] sm:items-end">
                <input type="hidden" name="orderId" value={o.id} />
                <Field id="payer-street" label="Ulica i numer">
                  <Input id="payer-street" name="principal_street" defaultValue={o.principal_street ?? ""} maxLength={120} autoComplete="off" />
                </Field>
                <Field id="payer-post" label="Kod">
                  <Input id="payer-post" name="principal_post_code" defaultValue={o.principal_post_code ?? ""} placeholder="00-000" maxLength={6} autoComplete="off" />
                </Field>
                <Field id="payer-city" label="Miejscowość">
                  <Input id="payer-city" name="principal_city" defaultValue={o.principal_city ?? ""} maxLength={80} autoComplete="off" />
                </Field>
                <div className="sm:col-span-3">
                  <SubmitButton variant="secondary">Zapisz adres</SubmitButton>
                </div>
              </form>
            </details>
          </Card>

          <Card>
            <CardTitle aside={o.family_updated_at ? `uzupełnione ${formatDateTime(o.family_updated_at)}` : "jeszcze nieotwarty"}>
              Link dla rodziny
            </CardTitle>
            <p className="mb-3 text-[15px] text-muted">
              Rodzina bez logowania uzupełnia dane do dokumentów, wybiera dodatkowe usługi i podaje numer konta do zasiłku.
            </p>
            <p className="mb-3 break-all rounded-[10px] bg-ground-family px-3 py-2 font-mono text-[13px]">{familyUrl}</p>
            <div className="flex flex-wrap gap-2">
              <form action={sendFamilySms}>
                <input type="hidden" name="orderId" value={o.id} />
                <SubmitButton pendingLabel="Wysyłam…">Wyślij SMS z linkiem</SubmitButton>
              </form>
              <CopyButton text={familyUrl} />
              <LinkButton
                href={`sms:${o.principal_phone.replace(/\s/g, "")}?body=${encodeURIComponent(smsBody)}`}
                variant="quiet"
                prefetch={false}
              >
                Z mojego telefonu
              </LinkButton>
            </div>
            {sms.length ? (
              <ul className="mt-3 flex flex-col gap-1 border-t border-line-soft pt-3 text-[14px]" aria-label="Wysłane SMS-y">
                {sms.map((m) => (
                  <li key={m.created_at.toISOString()}>
                    <span className="text-muted">SMS {formatDateTime(m.created_at)}: </span>
                    <span className={m.status === "wyslano" ? "font-semibold text-brand" : "font-semibold text-warn-ink"}>{SMS_STATUS[m.status]}</span>
                    {m.status === "pominieto" && m.last_error ? <span className="text-muted"> – {m.last_error}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Dane zmarłego</CardTitle>
            <form action={updateOrderDetails} className="grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="orderId" value={o.id} />
              <Field label="Imię" id="fn">
                <Input id="fn" name="deceased_first_name" defaultValue={o.deceased_first_name ?? ""} autoComplete="off" />
              </Field>
              <Field label="Nazwisko" id="ln">
                <Input id="ln" name="deceased_last_name" defaultValue={o.deceased_last_name ?? ""} autoComplete="off" />
              </Field>
              <Field label="Data urodzenia" id="born">
                <Input id="born" name="born_on" type="date" defaultValue={o.born_on ?? ""} />
              </Field>
              <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
                <Field label="Data zgonu" id="died">
                  <Input id="died" name="died_date" type="date" defaultValue={o.died_at ? dayKey(o.died_at) : ""} />
                </Field>
                <Field label="Godzina" id="diedt">
                  <Input id="diedt" name="died_time" type="time" defaultValue={o.died_at ? formatTime(o.died_at) : ""} />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="Notatki zakładu" id="notes" hint="Widoczne tylko dla zakładu. Nie wpisuj przyczyny zgonu.">
                  <Textarea id="notes" name="notes" defaultValue={o.notes ?? ""} aria-describedby="notes-hint" />
                </Field>
              </div>
              <div className="sm:col-span-2">
                <SubmitButton>Zapisz dane</SubmitButton>
              </div>
            </form>
          </Card>

          <Card>
            <CardTitle aside={`${events.length} w kalendarzu`}>Terminy</CardTitle>
            {events.length === 0 ? (
              <p className="text-muted">Brak terminów. Dodaj odbiór, kremację lub ceremonię.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line-soft">
                {events.map((e) => (
                  <li key={e.id} className="flex flex-col gap-2 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {EVENT_KIND_LABEL[e.kind]} · {formatDateTime(e.starts_at)}
                        </p>
                        <p className="text-[14px] text-muted">
                          {[e.place, e.resource_names.join(", ")].filter(Boolean).join(" · ") || "Bez miejsca"}
                        </p>
                      </div>
                      <Badge tone={e.status === "potwierdzony" ? "brand" : e.status === "odwolany" ? "neutral" : "warn"}>
                        {EVENT_STATUS_LABEL[e.status]}
                      </Badge>
                    </div>
                    {e.warning && e.status !== "odwolany" ? (
                      <p className="flex items-center gap-2 rounded-[10px] bg-warn-tint px-3 py-2 text-[14px] font-semibold text-warn-ink">
                        <AlertTriangle size={16} aria-hidden="true" /> {e.warning}. Sprawdź, czy zachodzi wyjątek ustawowy.
                      </p>
                    ) : null}
                    {e.status !== "odwolany" ? (
                      <div className="flex flex-wrap gap-2">
                        {e.status === "wstepny" ? (
                          <form action={setEventStatus}>
                            <input type="hidden" name="eventId" value={e.id} />
                            <input type="hidden" name="status" value="potwierdzony" />
                            <input type="hidden" name="returnTo" value={path} />
                            <SubmitButton variant="secondary">Potwierdzony</SubmitButton>
                          </form>
                        ) : null}
                        <form action={setEventStatus}>
                          <input type="hidden" name="eventId" value={e.id} />
                          <input type="hidden" name="status" value="odwolany" />
                          <input type="hidden" name="returnTo" value={path} />
                          <SubmitButton variant="danger">Odwołaj</SubmitButton>
                        </form>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <details className="mt-3 rounded-[10px] border border-line px-3 py-2">
              <summary className="min-h-11 cursor-pointer py-2.5 font-semibold text-brand">Dodaj termin</summary>
              <EventForm orderId={o.id} returnTo={path} resources={resources} />
            </details>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>Umowa</CardTitle>
            {o.contract_signed_at ? (
              <p className="text-[15px]">
                <Badge tone="brand">Podpisana</Badge> <span className="ml-1">{formatDateTime(o.contract_signed_at)}</span>
                {o.offer_id ? (
                  <span className="mt-2 block text-muted">Opłata Ostoi {formatPln(OSTOJA_FEE_PLN)} netto trafi do zestawienia miesięcznego.</span>
                ) : null}
              </p>
            ) : (
              <form action={signContract} className="flex flex-col gap-3">
                <input type="hidden" name="orderId" value={o.id} />
                <label className="flex min-h-11 items-start gap-3 text-[15px]">
                  <input type="checkbox" name="confirm" value="tak" required className="mt-1 size-5 accent-brand" />
                  <span>
                    Potwierdzam, że umowa z rodziną jest podpisana. Ceny w karcie zostaną zamknięte
                    {o.offer_id ? `, a Ostoja naliczy opłatę ${formatPln(OSTOJA_FEE_PLN)} netto.` : "."}
                  </span>
                </label>
                <SubmitButton>Umowa podpisana</SubmitButton>
              </form>
            )}
          </Card>

          <Card>
            <CardTitle aside={invoice?.number ? invoice.number : undefined}>Faktura</CardTitle>
            {!invoice ? (
              !o.contract_signed_at ? (
                <p className="text-[15px] text-muted">Faktura powstanie po oznaczeniu umowy jako podpisanej – w programie do faktur połączonym w profilu zakładu.</p>
              ) : (
                <form action={requestInvoice}>
                  <input type="hidden" name="orderId" value={o.id} />
                  <SubmitButton pendingLabel="Wystawiam…">Wystaw fakturę w programie</SubmitButton>
                </form>
              )
            ) : invoice.status === "do_wystawienia" ? (
              <p className="text-[15px]">
                <Badge tone="warn">W drodze</Badge> <span className="ml-1">Wystawiamy fakturę w programie do faktur.</span>
                {invoice.last_error ? <span className="mt-1 block text-[14px] text-warn-ink">{invoice.last_error}</span> : null}
              </p>
            ) : invoice.status === "blad" ? (
              <div className="flex flex-col gap-2 text-[15px]">
                <p>
                  <Badge tone="danger">Nie wystawiono</Badge> <span className="ml-1">{invoice.last_error}</span>
                </p>
                <form action={requestInvoice}>
                  <input type="hidden" name="orderId" value={o.id} />
                  <SubmitButton variant="secondary" pendingLabel="Wystawiam…">Wystaw ponownie</SubmitButton>
                </form>
              </div>
            ) : (
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[15px]">
                <dt className="text-muted">Numer</dt>
                <dd className="font-semibold">{invoice.number ?? "nadaje program"}</dd>
                <dt className="text-muted">Wystawiona</dt>
                <dd>{invoice.issued_on ? formatPlainDate(invoice.issued_on) : "–"}</dd>
                <dt className="text-muted">Kwota brutto</dt>
                <dd>{formatPln(invoice.gross_pln)}</dd>
                <dt className="text-muted">KSeF</dt>
                <dd>
                  {invoice.ksef_number ? <span className="block break-all font-mono text-[13px]">{invoice.ksef_number}</span> : null}
                  {invoice.ksef_status ? KSEF_LABEL[invoice.ksef_status] : invoice.ksef_number ? "w KSeF" : "poza KSeF (faktura dla osoby prywatnej)"}
                </dd>
              </dl>
            )}
            {invoice?.view_url ? (
              <a href={invoice.view_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand">
                Podgląd faktury w programie
              </a>
            ) : null}
            {o.contract_signed_at && me.role !== "ekipa" && (!invoice || invoice.status === "blad" || invoice.status === "reczna") ? (
              <details className="mt-2 border-t border-line-soft pt-2">
                <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand">
                  {invoice?.status === "reczna" ? "Popraw dane faktury" : "Faktura z innego programu – wpisz dane"}
                </summary>
                <form action={manualInvoice} className="mt-1 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="orderId" value={o.id} />
                  <Field id="mi-number" label="Numer faktury">
                    <Input id="mi-number" name="number" defaultValue={invoice?.number ?? ""} maxLength={60} required />
                  </Field>
                  <Field id="mi-date" label="Data wystawienia">
                    <Input id="mi-date" name="issued_on" type="date" defaultValue={invoice?.issued_on ?? ""} required />
                  </Field>
                  <Field id="mi-gross" label="Kwota brutto (zł)">
                    <Input id="mi-gross" name="gross_pln" inputMode="decimal" defaultValue={invoice?.gross_pln ?? o.total_pln ?? ""} required />
                  </Field>
                  <Field id="mi-ksef" label="Numer KSeF (jeśli jest)">
                    <Input id="mi-ksef" name="ksef_number" defaultValue={invoice?.ksef_number ?? ""} maxLength={60} autoComplete="off" />
                  </Field>
                  <div className="sm:col-span-2">
                    <SubmitButton variant="secondary">Zapisz fakturę</SubmitButton>
                  </div>
                </form>
              </details>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Usługi i koszt</CardTitle>
            <ul className="flex flex-col gap-1.5 text-[15px]">
              {items.map((it) => (
                <li key={it.label} className="flex justify-between gap-3">
                  <span>
                    {it.label}
                    {it.optional ? <span className="text-muted"> (dodatkowo)</span> : null}
                  </span>
                  <span className="whitespace-nowrap">{formatPln(it.price_pln)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-line pt-3 font-bold">
              <span>Razem</span>
              <span>{formatPln(o.total_pln)}</span>
            </div>
            <p className="mt-2 rounded-[10px] bg-brand-tint px-3 py-2 text-[14px] text-brand-dark">
              {o.total_pln !== null && o.total_pln <= FUNERAL_BENEFIT_PLN
                ? `Mieści się w zasiłku ${formatPln(FUNERAL_BENEFIT_PLN)}; zostaje ${formatPln(FUNERAL_BENEFIT_PLN - (o.total_pln ?? 0))}.`
                : `Przekracza zasiłek ${formatPln(FUNERAL_BENEFIT_PLN)} o ${formatPln((o.total_pln ?? 0) - FUNERAL_BENEFIT_PLN)}.`}
            </p>
          </Card>

          <Card>
            <CardTitle aside={<Link href="/panel/magazyn" className="font-semibold text-brand">Magazyn</Link>}>Trumna, urna i dodatki</CardTitle>
            {orderStock.length === 0 ? (
              <p className="text-[15px] text-muted">Nic jeszcze nie wydano z magazynu do tego zlecenia.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-line-soft text-[15px]">
                {orderStock.map((it) => (
                  <li key={it.stock_item_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-semibold">{it.name}</span>
                      {it.qty > 1 ? ` × ${it.qty}` : ""}
                      <span className="block text-[13px] text-muted">{formatPln(it.unit_price_pln * it.qty)} wg magazynu</span>
                    </span>
                    {canEditStock ? (
                      <form action={removeOrderItem}>
                        <input type="hidden" name="orderId" value={o.id} />
                        <input type="hidden" name="itemId" value={it.stock_item_id} />
                        <SubmitButton variant="secondary" pendingLabel="Oddaję…">Oddaj na stan</SubmitButton>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {canEditStock ? (
              stockOptions.length === 0 ? (
                <p className="mt-2 text-[13px] text-muted">Brak produktów na stanie do wydania. Przyjmij dostawę w magazynie.</p>
              ) : (
                <form action={assignOrderItem} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <input type="hidden" name="orderId" value={o.id} />
                  <Field id="stock-item" label="Wydaj z magazynu">
                    <Select id="stock-item" name="itemId" required defaultValue="">
                      <option value="" disabled>
                        Wybierz produkt
                      </option>
                      {stockOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {formatPln(s.price_pln)} · na stanie {s.qty}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <input type="hidden" name="qty" value="1" />
                  <SubmitButton variant="secondary" pendingLabel="Wydaję…">Wydaj</SubmitButton>
                </form>
              )
            ) : null}
            <p className="mt-2 text-[13px] text-muted">Wydanie zdejmuje produkt ze stanu. Cena w kosztorysie dla rodziny zostaje wg cennika Ostoi.</p>
          </Card>

          <Card>
            <CardTitle aside={`${tasks.filter((t) => t.done).length}/${tasks.length}`}>Zadania</CardTitle>
            <ul className="flex flex-col">
              {tasks.map((t) => (
                <li key={t.id}>
                  <form action={toggleTask}>
                    <input type="hidden" name="taskId" value={t.id} />
                    <input type="hidden" name="orderId" value={o.id} />
                    <button
                      type="submit"
                      role="checkbox"
                      aria-checked={t.done}
                      className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-1 text-left hover:bg-ground-family"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                          t.done ? "border-brand bg-brand text-white" : "border-field"
                        }`}
                      >
                        {t.done ? <Check size={15} /> : null}
                      </span>
                      <span className={t.done ? "text-muted line-through" : "font-semibold"}>
                        {t.title}
                        {t.assignee_name ? <span className="block text-[13px] font-normal text-muted no-underline">{t.assignee_name}</span> : null}
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardTitle>Dokumenty</CardTitle>
            <div className="flex flex-col gap-2">
              <LinkButton href={`${path}/klepsydra`} variant="secondary">
                <Printer size={18} aria-hidden="true" /> Klepsydra do druku
              </LinkButton>
              <LinkButton href={`${path}/kosztorys`} variant="secondary">
                <FileText size={18} aria-hidden="true" /> Kosztorys dla rodziny
              </LinkButton>
              <LinkButton href={`${path}/zasilek`} variant="secondary">
                <FileText size={18} aria-hidden="true" /> Wniosek o zasiłek (ZUS Z-12)
              </LinkButton>
            </div>
            <div className="mt-4">
              <p className="mb-1 flex justify-between font-semibold">
                <span>Dane do wniosku o zasiłek</span>
                <span>
                  {zusDone}/{zusChecklist.length}
                </span>
              </p>
              <ul className="flex flex-col gap-1 text-[14px]">
                {zusChecklist.map((c) => (
                  <li key={c.label} className="flex items-center gap-2">
                    <span aria-hidden="true" className={c.ok ? "text-brand" : "text-warn-ink"}>
                      {c.ok ? "✓" : "○"}
                    </span>
                    <span className={c.ok ? "" : "font-semibold text-warn-ink"}>
                      {c.label}
                      <span className="sr-only">{c.ok ? " – gotowe" : " – brakuje"}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[13px] text-muted">
                Zakład składa wniosek podpisany przez rodzinę w ZUS osobiście albo pocztą. Pełna lista braków jest we wniosku o zasiłek.
              </p>
            </div>
          </Card>

          <Card>
            <CardTitle aside={o.memorial_published ? "opublikowana" : "nieopublikowana"}>Strona pamięci</CardTitle>
            <form action={publishMemorial} className="flex flex-col gap-3">
              <input type="hidden" name="orderId" value={o.id} />
              <Field label="Kilka słów o zmarłym (opcjonalnie)" id="memnote" hint="Treść ustala rodzina. Do 600 znaków.">
                <Textarea id="memnote" name="memorial_note" maxLength={600} defaultValue={o.memorial_note ?? ""} aria-describedby="memnote-hint" />
              </Field>
              <div className="flex flex-wrap gap-2">
                <SubmitButton name="publish" value="tak">
                  {o.memorial_published ? "Zapisz zmiany" : "Opublikuj"}
                </SubmitButton>
                {o.memorial_published ? (
                  <SubmitButton name="publish" value="nie" variant="secondary">
                    Ukryj stronę
                  </SubmitButton>
                ) : null}
              </div>
              {o.memorial_published && o.memorial_slug ? (
                <Link href={`/pamiec/${o.memorial_slug}`} className="font-semibold text-brand" target="_blank">
                  Zobacz stronę pamięci
                </Link>
              ) : null}
            </form>
          </Card>

          <Card>
            <CardTitle>Etap zlecenia</CardTitle>
            <form action={setStage} className="flex gap-2">
              <input type="hidden" name="orderId" value={o.id} />
              <label htmlFor="stage" className="sr-only">
                Etap
              </label>
              <Select id="stage" name="stage" defaultValue={o.stage}>
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </Select>
              <SubmitButton variant="secondary">Zmień</SubmitButton>
            </form>
            {o.born_on ? <p className="mt-2 text-[13px] text-muted">Data urodzenia: {formatPlainDate(o.born_on)}</p> : null}
          </Card>
        </div>
      </div>
    </>
  );
}
