import { describe, expect, it } from "vitest";
import { buildInvoiceDraft, splitName } from "./draft";

const order = {
  principal_name: "Anna Maria Kowalska",
  principal_email: "anna@example.test",
  principal_street: "ul. Lipowa 2",
  principal_post_code: "90-001",
  principal_city: "Łódź",
  deceased_first_name: "Jan",
  deceased_last_name: "Kowalski",
};
const items = [
  { label: "Odbiór i transport zmarłego", price_pln: 600 },
  { label: "Trumna", price_pln: 1500 },
  { label: "Gratis", price_pln: 0 },
];

describe("faktura ze zlecenia", () => {
  it("dzieli imię i nazwisko (nazwisko = ostatni człon)", () => {
    expect(splitName("Anna Maria Kowalska")).toEqual({ firstName: "Anna Maria", lastName: "Kowalska" });
    expect(splitName("  Piotr   Nowak ")).toEqual({ firstName: "Piotr", lastName: "Nowak" });
    expect(splitName("Piotr")).toEqual({ firstName: "Piotr", lastName: "" });
  });

  it("składa fakturę: termin 14 dni, opis z osobą zmarłą, bez pozycji za 0 zł", () => {
    const r = buildInvoiceDraft(order, items, { vat: "8", ksefB2c: false, today: "2026-12-25" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.draft.paymentDue).toBe("2027-01-08");
    expect(r.draft.description).toBe("Koszty pogrzebu: Jan Kowalski");
    expect(r.draft.positions).toEqual([
      { name: "Odbiór i transport zmarłego", grossPln: 600 },
      { name: "Trumna", grossPln: 1500 },
    ]);
    expect(r.draft.sendToKsef).toBe(false);
  });

  it("brak adresu albo danych zmarłego – czytelny komunikat zamiast faktury", () => {
    expect(buildInvoiceDraft({ ...order, principal_city: null }, items, { vat: "8", ksefB2c: false, today: "2026-11-01" })).toMatchObject({
      ok: false,
      error: expect.stringContaining("Brak adresu"),
    });
    expect(buildInvoiceDraft({ ...order, deceased_last_name: null }, items, { vat: "8", ksefB2c: false, today: "2026-11-01" })).toMatchObject({
      ok: false,
      error: expect.stringContaining("osoby zmarłej"),
    });
  });
});
