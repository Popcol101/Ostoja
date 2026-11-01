import { describe, expect, it } from "vitest";
import { graveOrderSchema, itemsFromForm, quoteGrave, type GraveProduct, type GraveService } from "./grave";

const services: GraveService[] = [
  { key: "znicz", label: "Zapalenie znicza", description: "", base_price_pln: 40, product_kind: "znicz" },
  { key: "kwiaty", label: "Postawienie kwiatów", description: "", base_price_pln: 40, product_kind: "kwiaty" },
  { key: "sprzatanie", label: "Sprzątanie grobu", description: "", base_price_pln: 60, product_kind: null },
];
const products: GraveProduct[] = [
  { key: "znicz_1d", kind: "znicz", label: "Znicz 1 dzień", price_pln: 10, is_default: true },
  { key: "roze", kind: "kwiaty", label: "Róże", price_pln: 60, is_default: false },
];

describe("opieka nad grobem – wycena", () => {
  it("znicz 40 + 10 zł za sztukę, kwiaty 40 + cena kwiatów, sprzątanie 60", () => {
    expect(quoteGrave([{ service: "znicz", products: [{ key: "znicz_1d", qty: 1 }] }], services, products)).toBe(50);
    expect(quoteGrave([{ service: "znicz", products: [{ key: "znicz_1d", qty: 3 }] }], services, products)).toBe(70);
    expect(
      quoteGrave([{ service: "kwiaty", products: [{ key: "roze", qty: 1 }] }, { service: "sprzatanie" }], services, products),
    ).toBe(160);
    // Produkt z innej kategorii nie liczy się do usługi.
    expect(quoteGrave([{ service: "znicz", products: [{ key: "roze", qty: 1 }] }], services, products)).toBe(40);
  });

  it("pozycje z formularza (liczba sztuk 1–20)", () => {
    const items = itemsFromForm({ usluga: ["znicz", "sprzatanie"], produkt_znicz: "znicz_1d", sztuki_znicz: "50" }, services);
    expect(items).toEqual([{ service: "znicz", products: [{ key: "znicz_1d", qty: 20 }] }, { service: "sprzatanie" }]);
  });

  it("formularz: e-mail, zgoda, położenie w Polsce", () => {
    const base = {
      cemetery_id: "00000000-0000-4000-c300-000000000001",
      deceased_name: "Jan Testowy",
      frequency: "jednorazowo",
      first_on: "2026-11-05",
      customer_name: "Ewa Testowa",
      customer_email: "Ewa@Example.test",
      zgoda: "tak",
    };
    expect(graveOrderSchema.parse(base).customer_email).toBe("ewa@example.test");
    expect(graveOrderSchema.safeParse({ ...base, zgoda: undefined }).success).toBe(false);
    expect(graveOrderSchema.safeParse({ ...base, grave_lat: "40.1", grave_lng: "19.4" }).success).toBe(false);
    expect(graveOrderSchema.parse({ ...base, grave_lat: "51,75", grave_lng: "19.45" }).grave_lat).toBe(51.75);
  });
});
