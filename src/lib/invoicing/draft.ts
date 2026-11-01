// Składanie faktury ze zlecenia (czysta funkcja – testy w draft.test.ts).
import type { InvoiceDraft, VatRate } from "./types";

export type OrderForInvoice = {
  principal_name: string;
  principal_email: string | null;
  principal_street: string | null;
  principal_post_code: string | null;
  principal_city: string | null;
  deceased_first_name: string | null;
  deceased_last_name: string | null;
};

export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1)! };
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Zwraca fakturę albo opis braku danych, który zakład musi uzupełnić. */
export function buildInvoiceDraft(
  o: OrderForInvoice,
  items: { label: string; price_pln: number }[],
  opts: { vat: VatRate; ksefB2c: boolean; today: string },
): { ok: true; draft: InvoiceDraft } | { ok: false; error: string } {
  const { firstName, lastName } = splitName(o.principal_name);
  if (!firstName || !lastName) return { ok: false, error: "Brak imienia i nazwiska osoby, która płaci – popraw w zleceniu." };
  if (!o.principal_street || !o.principal_post_code || !o.principal_city) {
    return { ok: false, error: "Brak adresu osoby, która płaci – uzupełnij w zleceniu albo poproś rodzinę o link." };
  }
  if (!o.deceased_first_name || !o.deceased_last_name) {
    return { ok: false, error: "Brak imienia i nazwiska osoby zmarłej – ZUS sprawdza, czyjego pogrzebu dotyczy faktura." };
  }
  const positions = items.filter((i) => i.price_pln > 0).map((i) => ({ name: i.label, grossPln: Number(i.price_pln) }));
  if (positions.length === 0) return { ok: false, error: "Zlecenie nie ma usług z ceną." };
  return {
    ok: true,
    draft: {
      issueDate: opts.today,
      paymentDue: addDays(opts.today, 14),
      buyer: { firstName, lastName, street: o.principal_street, postCode: o.principal_post_code, city: o.principal_city, email: o.principal_email },
      positions,
      vat: opts.vat,
      description: `Koszty pogrzebu: ${o.deceased_first_name} ${o.deceased_last_name}`,
      sendToKsef: opts.ksefB2c,
    },
  };
}
