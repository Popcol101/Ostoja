import { afterEach, describe, expect, it, vi } from "vitest";
import { fakturownia, fakturowniaBase, fakturowniaBody } from "./fakturownia";
import type { InvoiceDraft } from "./types";

const draft: InvoiceDraft = {
  issueDate: "2026-11-01",
  paymentDue: "2026-11-15",
  buyer: { firstName: "Piotr", lastName: "Nowak", street: "ul. Testowa 1", postCode: "90-001", city: "Łódź", email: null },
  positions: [
    { name: "Odbiór i transport zmarłego", grossPln: 600 },
    { name: "Kremacja", grossPln: 1050 },
  ],
  vat: "8",
  description: "Koszty pogrzebu: Halina Nowak",
  sendToKsef: false,
};

afterEach(() => {
  delete process.env.FAKTUROWNIA_BASE_URL;
});

describe("Fakturownia", () => {
  it("adres konta tylko z dozwolonych znaków (bez podstawienia innego hosta)", () => {
    expect(fakturowniaBase("dom-cisza")).toBe("https://dom-cisza.fakturownia.pl");
    expect(() => fakturowniaBase("evil.com/x")).toThrow();
    expect(() => fakturowniaBase("a@b")).toThrow();
  });

  it("faktura dla osoby prywatnej: imię, nazwisko, adres, pozycje brutto z VAT 8%", () => {
    const body = fakturowniaBody("tok", draft);
    expect(body.gov_save_and_send).toBe(false);
    expect(body.invoice.buyer_company).toBe(false);
    expect(body.invoice.buyer_first_name).toBe("Piotr");
    expect(body.invoice.positions).toEqual([
      { name: "Odbiór i transport zmarłego", tax: 8, total_price_gross: 600, quantity: 1 },
      { name: "Kremacja", tax: 8, total_price_gross: 1050, quantity: 1 },
    ]);
    expect(fakturowniaBody("tok", { ...draft, vat: "zw" }).invoice.positions[0].tax).toBe("zw");
    expect("buyer_email" in body.invoice).toBe(false);
  });

  it("zapisuje numer, link podglądu i status KSeF", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ id: 123, number: "FV 1/11/2026", token: "abcDEF123", gov_status: "processing" }), { status: 201 }),
    );
    const r = await fakturownia("dom-cisza", "tok", fetchMock as unknown as typeof fetch).issue({ ...draft, sendToKsef: true });
    expect(r).toEqual({
      ok: true,
      externalId: "123",
      number: "FV 1/11/2026",
      viewUrl: "https://dom-cisza.fakturownia.pl/invoice/abcDEF123",
      ksefStatus: "processing",
      ksefNumber: null,
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://dom-cisza.fakturownia.pl/invoices.json");
    expect(JSON.parse(String(init.body)).gov_save_and_send).toBe(true);
  });

  it("błąd 422 bez treści faktury w komunikacie; 5xx – ponów; zły klucz – bez ponawiania", async () => {
    const bad = vi.fn(async () => new Response(JSON.stringify({ code: "error", message: { buyer_post_code: ["Piotr Nowak zły kod"] } }), { status: 422 }));
    const r = await fakturownia("dom-cisza", "tok", bad as unknown as typeof fetch).issue(draft);
    expect(r).toEqual({ ok: false, retry: false, error: "Fakturownia odrzuciła fakturę (HTTP 422): popraw pola buyer_post_code." });

    const down = vi.fn(async () => new Response("", { status: 503 }));
    expect(await fakturownia("dom-cisza", "tok", down as unknown as typeof fetch).issue(draft)).toMatchObject({ ok: false, retry: true });

    const denied = vi.fn(async () => new Response("{}", { status: 401 }));
    expect(await fakturownia("dom-cisza", "tok", denied as unknown as typeof fetch).issue(draft)).toMatchObject({ ok: false, retry: false });
  });

  it("odczyt numeru KSeF tylko w poprawnym formacie", async () => {
    const ok = vi.fn(async () => new Response(JSON.stringify({ gov_status: "ok", gov_id: "5252445767-20260201-ABC123DEF456" }), { status: 200 }));
    expect(await fakturownia("dom-cisza", "tok", ok as unknown as typeof fetch).ksefStatus("123")).toEqual({
      ksefStatus: "ok",
      ksefNumber: "5252445767-20260201-ABC123DEF456",
    });
    const odd = vi.fn(async () => new Response(JSON.stringify({ gov_status: "hack", gov_id: "<script>" }), { status: 200 }));
    expect(await fakturownia("dom-cisza", "tok", odd as unknown as typeof fetch).ksefStatus("123")).toEqual({ ksefStatus: null, ksefNumber: null });
    expect(await fakturownia("dom-cisza", "tok", ok as unknown as typeof fetch).ksefStatus("../1")).toBeNull();
  });
});
