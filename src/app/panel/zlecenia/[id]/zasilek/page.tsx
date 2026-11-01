import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PrintButton, SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { Card, CardTitle, Field, Input, Notice } from "@/components/ui";
import { withUser } from "@/lib/db";
import { dayKey, formatBankAccount, formatPlainDate, formatPln } from "@/lib/format";
import { FUNERAL_BENEFIT_PLN } from "@/lib/labels";
import { requireMember } from "@/lib/session";
import { claimDeadline, missingForClaim, type ZusClaim } from "@/lib/zus";
import { saveZusClaim } from "../../../actions";

export const metadata: Metadata = { title: "Wniosek o zasiłek pogrzebowy" };
export const dynamic = "force-dynamic";

type Row = {
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
  family_consents: Record<string, boolean>;
  total_pln: number | null;
  home_name: string;
  home_nip: string;
  home_regon: string | null;
  home_address: string;
  home_bank_account: string | null;
};
type Invoice = { number: string | null; issued_on: string | null; gross_pln: number | null; ksef_number: string | null; status: string };

function Box({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <p className="flex gap-2">
      <span aria-hidden="true" className="font-mono">{on ? "[X]" : "[ ]"}</span>
      <span>
        {children}
        <span className="sr-only">{on ? " – zaznaczone" : " – niezaznaczone"}</span>
      </span>
    </p>
  );
}

function Line({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,13rem)_minmax(0,1fr)] gap-x-3 border-b border-line-soft py-1.5 print:grid-cols-[48mm_1fr]">
      <dt className="text-muted">{label}</dt>
      <dd className="min-h-5 font-semibold">{value || <span className="font-normal text-muted">……………………</span>}</dd>
    </div>
  );
}

export default async function ZusClaimPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireMember();
  const data = await withUser(me.userId, async (tx) => {
    const [o] = await tx<Row[]>`
      select o.deceased_first_name, o.deceased_last_name, o.born_on, o.died_at, o.principal_name, o.principal_phone, o.principal_email,
             o.principal_street, o.principal_post_code, o.principal_city, o.zus_bank_account, o.family_consents, o.total_pln,
             h.name as home_name, h.nip as home_nip, h.regon as home_regon, h.address as home_address, h.bank_account as home_bank_account
      from orders o join funeral_homes h on h.id = o.home_id where o.id = ${id}`;
    if (!o) return null;
    const [claim] = await tx<ZusClaim[]>`
      select applicant_pesel, applicant_id_doc, applicant_relation, deceased_pesel, deceased_id_doc, death_place, other_pension_body,
             costs_covered, no_other_benefit, payout_to_home, payout_home_pln
      from zus_claims where order_id = ${id}`;
    const [invoice] = await tx<Invoice[]>`
      select number, issued_on, gross_pln, ksef_number, status from invoices where order_id = ${id} and status in ('wystawiona', 'reczna')`;
    return { o, claim: claim ?? null, invoice: invoice ?? null };
  });
  if (!data) notFound();
  const { o, claim, invoice } = data;
  const canEdit = me.role !== "ekipa";
  const consent = Boolean(o.family_consents.wniosek_przez_zaklad);
  const deceased = [o.deceased_first_name, o.deceased_last_name].filter(Boolean).join(" ");
  const deathDay = o.died_at ? dayKey(o.died_at) : null;
  const address = o.principal_city ? `${o.principal_street ?? ""}, ${o.principal_post_code ?? ""} ${o.principal_city}` : "";
  const missing = missingForClaim({
    claim,
    deceasedName: Boolean(o.deceased_first_name && o.deceased_last_name),
    diedAt: Boolean(o.died_at),
    applicantAddress: Boolean(o.principal_city && o.principal_street && o.principal_post_code),
    applicantAccount: Boolean(o.zus_bank_account),
    invoice: Boolean(invoice),
    homeRegon: Boolean(o.home_regon),
    homeAccount: Boolean(o.home_bank_account),
  });
  const c: ZusClaim = claim ?? {
    applicant_pesel: null,
    applicant_id_doc: null,
    applicant_relation: null,
    deceased_pesel: null,
    deceased_id_doc: null,
    death_place: null,
    other_pension_body: null,
    costs_covered: "calosc",
    no_other_benefit: false,
    payout_to_home: "brak",
    payout_home_pln: null,
  };
  const homeAmount = c.payout_to_home === "calosc" ? FUNERAL_BENEFIT_PLN : c.payout_to_home === "czesc" ? c.payout_home_pln : null;

  return (
    <div className="mx-auto flex max-w-[794px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/panel/zlecenia/${id}`} className="text-sm font-semibold text-brand">
          ← Karta zlecenia
        </Link>
        <PrintButton />
      </div>
      <div className="print:hidden">
        <h1 className="font-serif text-[28px] leading-tight">Wniosek o zasiłek pogrzebowy</h1>
        <p className="text-muted">
          Dane do formularza ZUS Z-12, uzupełnione ze zlecenia.
          {deathDay ? ` Termin złożenia: do ${formatPlainDate(claimDeadline(deathDay))} (12 miesięcy od dnia śmierci).` : ""}
        </p>
      </div>
      <div className="print:hidden">
        <Flash searchParams={searchParams} />
      </div>

      <div className="print:hidden">
        {missing.length === 0 ? (
          <Notice title="Komplet danych">Wydrukuj, daj do podpisu osobie, która pokryła koszty, i złóż w ZUS z fakturą.</Notice>
        ) : (
          <Notice tone="warn" title={`Brakuje: ${missing.length}`}>
            <ul className="mt-1 list-disc pl-5">
              {missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </Notice>
        )}
      </div>

      {canEdit ? (
        <Card className="print:hidden">
          <CardTitle>Dane, których nie ma w zleceniu</CardTitle>
          <form action={saveZusClaim} className="grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="orderId" value={id} />
            <Field id="z-dpesel" label="PESEL osoby zmarłej">
              <Input id="z-dpesel" name="deceased_pesel" inputMode="numeric" autoComplete="off" defaultValue={c.deceased_pesel ?? ""} maxLength={14} />
            </Field>
            <Field id="z-ddoc" label="albo seria i numer dokumentu (bez PESEL)">
              <Input id="z-ddoc" name="deceased_id_doc" autoComplete="off" defaultValue={c.deceased_id_doc ?? ""} maxLength={30} />
            </Field>
            <Field id="z-place" label="Miejsce zgonu (miejscowość)">
              <Input id="z-place" name="death_place" defaultValue={c.death_place ?? ""} maxLength={120} />
            </Field>
            <Field id="z-other" label="Inny organ rentowy zmarłego (np. KRUS) – jeśli był">
              <Input id="z-other" name="other_pension_body" defaultValue={c.other_pension_body ?? ""} maxLength={120} />
            </Field>
            <Field id="z-apesel" label={`PESEL: ${o.principal_name}`}>
              <Input id="z-apesel" name="applicant_pesel" inputMode="numeric" autoComplete="off" defaultValue={c.applicant_pesel ?? ""} maxLength={14} />
            </Field>
            <Field id="z-adoc" label="albo seria i numer dokumentu (bez PESEL)">
              <Input id="z-adoc" name="applicant_id_doc" autoComplete="off" defaultValue={c.applicant_id_doc ?? ""} maxLength={30} />
            </Field>
            <Field id="z-rel" label="Kim jest dla osoby zmarłej (np. syn, żona)">
              <Input id="z-rel" name="applicant_relation" defaultValue={c.applicant_relation ?? ""} maxLength={60} />
            </Field>
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 font-semibold">Koszty pogrzebu pokrył(a)</legend>
              <label className="flex min-h-11 items-center gap-3">
                <input type="radio" name="costs_covered" value="calosc" defaultChecked={c.costs_covered === "calosc"} className="size-5 accent-brand" /> w całości
              </label>
              <label className="flex min-h-11 items-center gap-3">
                <input type="radio" name="costs_covered" value="czesc" defaultChecked={c.costs_covered === "czesc"} className="size-5 accent-brand" /> w części
              </label>
            </fieldset>
            <label className="flex min-h-11 items-start gap-3 sm:col-span-2">
              <input type="checkbox" name="no_other_benefit" value="tak" defaultChecked={c.no_other_benefit} className="mt-1 size-5 accent-brand" />
              <span>Rodzina potwierdziła, że nie pobrała zasiłku pogrzebowego po tej osobie z innego tytułu (np. KRUS, MSWiA, MON).</span>
            </label>
            <fieldset className="flex flex-col gap-1 sm:col-span-2" disabled={!consent}>
              <legend className="mb-1 font-semibold">Wypłata na rachunek zakładu</legend>
              {!consent ? (
                <p className="text-sm text-muted">Rodzina nie zaznaczyła w swoim linku, że zakład ma złożyć wniosek w jej imieniu.</p>
              ) : null}
              <label className="flex min-h-11 items-center gap-3">
                <input type="radio" name="payout_to_home" value="brak" defaultChecked={c.payout_to_home === "brak"} className="size-5 accent-brand" /> nie – cały zasiłek dla rodziny
              </label>
              <label className="flex min-h-11 items-center gap-3">
                <input type="radio" name="payout_to_home" value="calosc" defaultChecked={c.payout_to_home === "calosc"} className="size-5 accent-brand" /> w całości
              </label>
              <label className="flex min-h-11 items-center gap-3">
                <input type="radio" name="payout_to_home" value="czesc" defaultChecked={c.payout_to_home === "czesc"} className="size-5 accent-brand" /> w części
              </label>
              <Field id="z-amount" label="Kwota dla zakładu przy wypłacie w części (zł)">
                <Input id="z-amount" name="payout_home_pln" inputMode="decimal" defaultValue={c.payout_home_pln ?? o.total_pln ?? ""} className="w-40" />
              </Field>
            </fieldset>
            {!consent ? <input type="hidden" name="payout_to_home" value="brak" /> : null}
            <div className="sm:col-span-2">
              <SubmitButton>Zapisz dane wniosku</SubmitButton>
            </div>
          </form>
        </Card>
      ) : null}

      <article aria-label="Wniosek do druku" className="rounded-[14px] border border-line bg-white p-6 text-[14px] print:border-0 print:p-[14mm] print:text-[11pt]">
        <header className="mb-4">
          <h2 className="font-serif text-[22px] leading-tight">Wniosek o wypłatę zasiłku pogrzebowego</h2>
          <p className="text-muted">Dane do formularza ZUS Z-12 · zasiłek {formatPln(FUNERAL_BENEFIT_PLN)} (zgon od 1.01.2026)</p>
        </header>

        <section className="mb-4">
          <h3 className="mb-1 font-semibold">1. Osoba, która pokryła koszty pogrzebu</h3>
          <dl>
            <Line label="Imię i nazwisko" value={o.principal_name} />
            <Line label="PESEL" value={c.applicant_pesel ?? (c.applicant_id_doc ? `dokument: ${c.applicant_id_doc}` : "")} />
            <Line label="Adres" value={address} />
            <Line label="Telefon / e-mail" value={[o.principal_phone, o.principal_email].filter(Boolean).join(" · ")} />
          </dl>
        </section>

        <section className="mb-4">
          <h3 className="mb-1 font-semibold">2. Osoba zmarła</h3>
          <dl>
            <Line label="Imię i nazwisko" value={deceased} />
            <Line label="PESEL" value={c.deceased_pesel ?? (c.deceased_id_doc ? `dokument: ${c.deceased_id_doc}` : "")} />
            <Line label="Data urodzenia" value={o.born_on ? formatPlainDate(o.born_on) : ""} />
            <Line label="Data i miejsce zgonu" value={[deathDay ? formatPlainDate(deathDay) : "", c.death_place].filter(Boolean).join(", ")} />
            <Line label="Inny organ rentowy zmarłego" value={c.other_pension_body ?? (claim ? "nie dotyczy" : "")} />
          </dl>
        </section>

        <section className="mb-4">
          <h3 className="mb-1 font-semibold">3. Oświadczenia osoby, która pokryła koszty</h3>
          <div className="flex flex-col gap-1">
            <p>Jestem dla osoby zmarłej: <strong>{c.applicant_relation ?? "……………………"}</strong></p>
            <Box on={c.costs_covered === "calosc"}>Koszty pogrzebu pokryłem/pokryłam w całości.</Box>
            <Box on={c.costs_covered === "czesc"}>Koszty pogrzebu pokryłem/pokryłam w części.</Box>
            <Box on={c.no_other_benefit}>Nie pobrałem/pobrałam zasiłku pogrzebowego po tej osobie z innego tytułu.</Box>
          </div>
        </section>

        <section className="mb-4">
          <h3 className="mb-1 font-semibold">4. Zakład pogrzebowy, który składa wniosek</h3>
          <dl>
            <Line label="Nazwa" value={o.home_name} />
            <Line label="NIP / REGON" value={[o.home_nip, o.home_regon].filter(Boolean).join(" / ")} />
            <Line label="Adres" value={o.home_address} />
          </dl>
          <div className="mt-2 flex flex-col gap-1">
            <Box on={c.payout_to_home !== "brak"}>
              Upoważniam ZUS do wypłaty zasiłku pogrzebowego na rachunek zakładu
              {c.payout_to_home === "calosc" ? " w całości" : c.payout_to_home === "czesc" ? ` w części: ${formatPln(homeAmount)}` : ""}.
            </Box>
            {c.payout_to_home !== "brak" ? <Line label="Rachunek zakładu" value={o.home_bank_account ? formatBankAccount(o.home_bank_account) : ""} /> : null}
          </div>
        </section>

        <section className="mb-4">
          <h3 className="mb-1 font-semibold">5. Wypłata dla osoby, która pokryła koszty</h3>
          <dl>
            <Line
              label="Rachunek bankowy"
              value={c.payout_to_home === "calosc" ? "nie dotyczy – całość dla zakładu" : o.zus_bank_account ? formatBankAccount(o.zus_bank_account) : ""}
            />
          </dl>
        </section>

        <section className="mb-6">
          <h3 className="mb-1 font-semibold">6. Załączniki</h3>
          {invoice ? (
            <p>
              Faktura nr <strong>{invoice.number}</strong>
              {invoice.issued_on ? ` z ${formatPlainDate(invoice.issued_on)}` : ""}, {formatPln(invoice.gross_pln)}
              {invoice.ksef_number ? `, numer KSeF ${invoice.ksef_number} – wydruk faktury z kodem QR` : " – oryginał"}.
            </p>
          ) : (
            <p>Faktura lub rachunek za pogrzeb: ……………………</p>
          )}
          <p className="mt-1 text-muted">Jeśli oryginały rachunków złożono w banku – kopie potwierdzone przez bank.</p>
        </section>

        <div className="grid grid-cols-2 gap-8 pt-6">
          <p className="border-t border-ink pt-1 text-center text-[13px]">Data</p>
          <p className="border-t border-ink pt-1 text-center text-[13px]">Podpis osoby, która pokryła koszty</p>
        </div>
        <p className="mt-6 text-[12px] text-muted">
          Treść wniosku według § 4 ust. 2a rozporządzenia w sprawie postępowania o świadczenia emerytalno-rentowe (Dz.U. 2025 poz. 1888). Zakład składa
          wniosek podpisany przez osobę uprawnioną w ZUS osobiście albo pocztą.
        </p>
      </article>
    </div>
  );
}
