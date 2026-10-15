import { CalendarDays, Lock, Phone } from "lucide-react";
import type { Metadata } from "next";
import { SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { OPIEKUN_PHONE, SiteFooter, SiteHeader } from "@/components/site";
import { Badge, Card, CardTitle, EmptyState, Field, Input, LinkButton, cx } from "@/components/ui";
import { familyUpdate } from "@/app/rodzina-actions";
import { asAnon } from "@/lib/db";
import { formatBankAccount, formatDateTime, formatPln } from "@/lib/format";
import { BURIAL_LABEL, CEREMONY_LABEL, EVENT_STATUS_LABEL, FUNERAL_BENEFIT_PLN, STAGE_LABEL, STAGES, type Burial, type Ceremony, type EventStatus, type OrderStage } from "@/lib/labels";

export const metadata: Metadata = { title: "Organizacja pogrzebu – Ostoja", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type FamilyOrder = {
  order_id: string;
  stage: OrderStage;
  home: { name: string; phone: string; address: string };
  burial: Burial;
  ceremony: Ceremony;
  deceased_first_name: string | null;
  deceased_last_name: string | null;
  born_on: string | null;
  died_at: string | null;
  principal_name: string;
  principal_email: string | null;
  zus_bank_account: string | null;
  selected_items: string[];
  total_pln: number | null;
  family_consents: { dane_do_dokumentow?: boolean; wniosek_przez_zaklad?: boolean };
  contract_signed: boolean;
  price_list: { item_key: string; label: string; price_pln: number; optional: boolean }[];
  events: { kind: string; title: string; status: EventStatus; starts_at: string; place: string | null }[];
};

function warsawParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

export default async function FamilyOrderPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: SearchParams }) {
  const { token } = await params;
  const valid = /^[a-z0-9-]{20,80}$/.test(token);
  const order = valid
    ? await asAnon(async (tx) => {
        const [row] = await tx<{ data: FamilyOrder | null }[]>`select family_get_order(${token}) as data`;
        return row?.data ?? null;
      })
    : null;
  const tel = OPIEKUN_PHONE.replace(/\s/g, "");

  if (!order) {
    return (
      <div className="flex min-h-dvh flex-col bg-ground-family">
        <SiteHeader />
        <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
          <h1 className="sr-only">Link nie działa</h1>
          <EmptyState title="Ten link wygasł albo jest nieprawidłowy." action={<LinkButton href={`tel:${tel}`}>Zadzwoń do opiekuna</LinkButton>}>
            Poproś zakład o nowy link SMS-em albo zadzwoń do opiekuna Ostoi – pomożemy.
          </EmptyState>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const died = warsawParts(order.died_at);
  const total = order.total_pln ?? 0;
  const left = FUNERAL_BENEFIT_PLN - total;
  const stageIndex = STAGES.indexOf(order.stage);
  const included = order.price_list.filter((p) => !p.optional);
  const extras = order.price_list.filter((p) => p.optional);
  const deceased = [order.deceased_first_name, order.deceased_last_name].filter(Boolean).join(" ");
  const homeTel = order.home.phone.replace(/\s/g, "");

  return (
    <div className="flex min-h-dvh flex-col bg-ground-family">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <p className="text-[15px] text-muted">Organizację prowadzi</p>
        <h1 className="font-serif text-[30px] leading-tight">{order.home.name}</h1>
        <p className="mt-1 text-muted">
          {deceased ? `Pogrzeb: ${deceased}` : "Pogrzeb"} · {BURIAL_LABEL[order.burial]} · {CEREMONY_LABEL[order.ceremony]}
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <LinkButton href={`tel:${homeTel}`}>
            <Phone size={18} aria-hidden="true" />
            Zadzwoń do zakładu
          </LinkButton>
          <span className="self-center text-[15px] text-muted">{order.home.phone}</span>
        </div>

        <div className="mt-5">
          <Flash searchParams={searchParams} />
        </div>

        <ol aria-label="Etapy" className="mb-5 flex flex-wrap gap-x-1 gap-y-2 text-[13px]">
          {STAGES.slice(0, 5).map((s, i) => (
            <li
              key={s}
              aria-current={i === stageIndex ? "step" : undefined}
              className={cx(
                "rounded-full px-2.5 py-1 font-semibold",
                i < stageIndex && "bg-brand-tint text-brand",
                i === stageIndex && "bg-brand text-white",
                i > stageIndex && "bg-card text-muted",
              )}
            >
              {i < stageIndex ? "✓ " : ""}
              {STAGE_LABEL[s]}
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>Terminy</CardTitle>
            {order.events.length === 0 ? (
              <p className="text-muted">Zakład jeszcze nie ustalił terminów. Pojawią się tutaj, gdy tylko zostaną zarezerwowane.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {order.events.map((e) => (
                  <li key={`${e.kind}-${e.starts_at}`} className="flex gap-3">
                    <CalendarDays size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                    <div>
                      <p className="font-semibold">
                        {e.title} <Badge tone={e.status === "potwierdzony" ? "brand" : "warn"}>{EVENT_STATUS_LABEL[e.status]}</Badge>
                      </p>
                      <p className="text-muted">
                        {formatDateTime(e.starts_at)}
                        {e.place ? ` · ${e.place}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>Koszt</CardTitle>
            <div className="flex items-baseline justify-between gap-3">
              <span>Razem</span>
              <span className="text-[24px] font-semibold">{formatPln(total)}</span>
            </div>
            <p className={cx("mt-1 font-semibold", left >= 0 ? "text-brand" : "text-warn-ink")}>
              {left >= 0
                ? `Zasiłek pogrzebowy (${formatPln(FUNERAL_BENEFIT_PLN)}) pokrywa całość. Zostaje ${formatPln(left)}.`
                : `Dopłata ponad zasiłek pogrzebowy (${formatPln(FUNERAL_BENEFIT_PLN)}): ${formatPln(-left)}.`}
            </p>
            <ul className="mt-3 flex flex-col gap-1.5 border-t border-line pt-3 text-[15px]">
              {included.map((p) => (
                <li key={p.item_key} className="flex justify-between gap-3">
                  <span>{p.label}</span>
                  <span className="tabular-nums">{formatPln(p.price_pln)}</span>
                </li>
              ))}
              {extras
                .filter((p) => order.selected_items.includes(p.item_key))
                .map((p) => (
                  <li key={p.item_key} className="flex justify-between gap-3">
                    <span>{p.label}</span>
                    <span className="tabular-nums">{formatPln(p.price_pln)}</span>
                  </li>
                ))}
            </ul>
          </Card>

          <form action={familyUpdate} className="flex flex-col gap-4">
            <input type="hidden" name="token" value={token} />

            <Card>
              <CardTitle>Dane do dokumentów</CardTitle>
              <p className="mb-4 text-[15px] text-muted">
                Zakład potrzebuje ich do aktu zgonu, klepsydry i wniosku o zasiłek. Uzupełnij, co wiesz – resztę ustalicie przez telefon.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="deceased_first_name" label="Imię osoby zmarłej">
                  <Input id="deceased_first_name" name="deceased_first_name" defaultValue={order.deceased_first_name ?? ""} maxLength={80} />
                </Field>
                <Field id="deceased_last_name" label="Nazwisko osoby zmarłej">
                  <Input id="deceased_last_name" name="deceased_last_name" defaultValue={order.deceased_last_name ?? ""} maxLength={80} />
                </Field>
                <Field id="born_on" label="Data urodzenia">
                  <Input id="born_on" name="born_on" type="date" defaultValue={order.born_on ?? ""} />
                </Field>
                <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
                  <Field id="died_date" label="Data zgonu">
                    <Input id="died_date" name="died_date" type="date" defaultValue={died.date} />
                  </Field>
                  <Field id="died_time" label="Godzina">
                    <Input id="died_time" name="died_time" type="time" defaultValue={died.time} />
                  </Field>
                </div>
              </div>
            </Card>

            <Card>
              <CardTitle>Zasiłek pogrzebowy</CardTitle>
              <div className="flex flex-col gap-4">
                <Field id="principal_email" label="Twój e-mail (nieobowiązkowe)" hint="Wyślemy na niego kosztorys i umowę.">
                  <Input
                    id="principal_email"
                    name="principal_email"
                    type="email"
                    autoComplete="email"
                    defaultValue={order.principal_email ?? ""}
                    aria-describedby="principal_email-hint"
                  />
                </Field>
                <Field id="zus_bank_account" label="Numer konta do wypłaty zasiłku" hint="26 cyfr. Jeśli zakład składa wniosek za Ciebie, ZUS wypłaci mu zasiłek, a Ty dopłacasz tylko różnicę.">
                  <Input
                    id="zus_bank_account"
                    name="zus_bank_account"
                    inputMode="numeric"
                    autoComplete="off"
                    defaultValue={order.zus_bank_account ? formatBankAccount(order.zus_bank_account) : ""}
                    aria-describedby="zus_bank_account-hint"
                  />
                </Field>
                <label className="flex cursor-pointer gap-3">
                  <input
                    type="checkbox"
                    name="zgoda_zasilek"
                    value="tak"
                    defaultChecked={!!order.family_consents.wniosek_przez_zaklad}
                    className="mt-0.5 size-5 shrink-0 accent-brand"
                  />
                  <span className="text-[15px]">Chcę, żeby zakład złożył wniosek o zasiłek pogrzebowy w moim imieniu.</span>
                </label>
              </div>
            </Card>

            <Card>
              <CardTitle>Usługi dodatkowe</CardTitle>
              {order.contract_signed ? (
                <p className="flex items-start gap-2 text-[15px] text-muted">
                  <Lock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Umowa jest podpisana. Zmianę usług ustal z zakładem przez telefon.
                </p>
              ) : extras.length === 0 ? (
                <p className="text-muted">Zakład nie ma usług dodatkowych w cenniku.</p>
              ) : (
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 text-[15px] text-muted">Zaznacz, jeśli chcesz. Cena zmieni się po zapisaniu.</legend>
                  <input type="hidden" name="edytuj_uslugi" value="tak" />
                  {extras.map((p) => (
                    <label
                      key={p.item_key}
                      className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-4 py-2 has-[:checked]:border-brand has-[:checked]:bg-brand-tint"
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          name="dodatki"
                          value={p.item_key}
                          defaultChecked={order.selected_items.includes(p.item_key)}
                          className="size-5 accent-brand"
                        />
                        {p.label}
                      </span>
                      <span className="tabular-nums text-muted">+{formatPln(p.price_pln)}</span>
                    </label>
                  ))}
                </fieldset>
              )}
            </Card>

            <label className="flex cursor-pointer gap-3 rounded-[14px] border border-line bg-card p-4">
              <input
                type="checkbox"
                name="zgoda_dane"
                value="tak"
                defaultChecked={!!order.family_consents.dane_do_dokumentow}
                className="mt-0.5 size-5 shrink-0 accent-brand"
              />
              <span className="text-[15px]">
                Zgadzam się, żeby {order.home.name} użył tych danych do przygotowania dokumentów pogrzebu.
              </span>
            </label>

            <SubmitButton full>Zapisz i przekaż zakładowi</SubmitButton>
          </form>

          <p className="text-center text-sm text-muted">
            Ten link jest tylko dla Ciebie. Nie udostępniaj go publicznie.
            <br />
            {order.home.address}
          </p>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
