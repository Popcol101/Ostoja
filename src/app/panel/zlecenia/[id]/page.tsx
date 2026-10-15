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
import { publishMemorial, setEventStatus, setStage, signContract, toggleTask, updateOrderDetails } from "../../actions";
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
    return { order, items, tasks, events, resources };
  });
  if (!data) notFound();
  const { order: o, items, tasks, events, resources } = data;

  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const familyUrl = `${origin}/r/${o.family_token}`;
  const name = [o.deceased_first_name, o.deceased_last_name].filter(Boolean).join(" ");
  const smsBody = `Dzień dobry, tu ${me.homeName}. Pod tym linkiem uzupełnią Państwo dane do dokumentów i wybiorą usługi: ${familyUrl}`;
  const path = `/panel/zlecenia/${o.id}`;
  const visibleStages = STAGES.filter((s) => s !== "zamkniete");
  const stageIndex = STAGES.indexOf(o.stage);

  const zusChecklist = [
    { label: "Imię i nazwisko zmarłego", ok: Boolean(o.deceased_first_name && o.deceased_last_name) },
    { label: "Data zgonu", ok: Boolean(o.died_at) },
    { label: "Dane osoby, która pokryła koszty", ok: Boolean(o.principal_name) },
    { label: "Numer konta do wypłaty zasiłku", ok: Boolean(o.zus_bank_account) },
    { label: "Rachunek za pogrzeb (po podpisaniu umowy)", ok: Boolean(o.contract_signed_at) },
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
              <CopyButton text={familyUrl} />
              <LinkButton
                href={`sms:${o.principal_phone.replace(/\s/g, "")}?body=${encodeURIComponent(smsBody)}`}
                variant="secondary"
                prefetch={false}
              >
                Wyślij SMS-em
              </LinkButton>
            </div>
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
                          t.done ? "border-brand bg-brand text-white" : "border-[#8C9792]"
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
                Wniosek składa zakład w ZUS (osobiście, pocztą lub przez PUE/eZUS). Ostoja przygotowuje komplet danych.
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
