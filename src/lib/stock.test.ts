import { describe, expect, it } from "vitest";
import { STOCK_TEMPLATE, lowStock, stockItemSchema, stockMoveSchema } from "./stock";

describe("magazyn", () => {
  it("podstawowy asortyment przechodzi walidację i ma trumny i urny", () => {
    const parsed = STOCK_TEMPLATE.map((t) => stockItemSchema.parse(t));
    expect(parsed.some((p) => p.kind === "trumna")).toBe(true);
    expect(parsed.some((p) => p.kind === "urna")).toBe(true);
    expect(new Set(parsed.map((p) => p.name)).size).toBe(parsed.length);
  });

  it("cena z przecinkiem i spacjami", () => {
    const p = stockItemSchema.parse({ kind: "urna", name: "Urna", price_pln: "1 250,50", qty: "2", min_qty: "1" });
    expect(p.price_pln).toBe(1250.5);
    expect(() => stockItemSchema.parse({ kind: "urna", name: "Urna", price_pln: "-1", qty: "0", min_qty: "0" })).toThrow();
  });

  it("ruch magazynowy: tylko dostawa albo korekta, liczba całkowita", () => {
    expect(stockMoveSchema.safeParse({ itemId: "00000000-0000-4000-c100-000000000001", mode: "dostawa", qty: "3" }).success).toBe(true);
    expect(stockMoveSchema.safeParse({ itemId: "00000000-0000-4000-c100-000000000001", mode: "zlecenie", qty: "3" }).success).toBe(false);
    expect(stockMoveSchema.safeParse({ itemId: "00000000-0000-4000-c100-000000000001", mode: "dostawa", qty: "1.5" }).success).toBe(false);
  });

  it("mało na stanie", () => {
    expect(lowStock(2, 2)).toBe(true);
    expect(lowStock(3, 2)).toBe(false);
    expect(lowStock(0, 0)).toBe(true);
    expect(lowStock(1, 0)).toBe(false);
  });
});
