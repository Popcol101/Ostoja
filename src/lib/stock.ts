// Magazyn trumien i urn: etykiety, walidacja i podstawowy asortyment do szybkiego startu (dane przykładowe).
import { z } from "zod";

export type StockKind = "trumna" | "urna" | "inne";

export const STOCK_KIND_LABEL: Record<StockKind, string> = { trumna: "Trumny", urna: "Urny", inne: "Inne" };
export const STOCK_KINDS: StockKind[] = ["trumna", "urna", "inne"];

const PRICE_MSG = { message: "Cena musi być liczbą od 0 do 100 000 zł." };
const price = z
  .union([z.string(), z.number()])
  .transform((v) => Number(String(v).replace(/\s/g, "").replace(",", ".")))
  .pipe(z.number(PRICE_MSG).min(0, PRICE_MSG).max(100000, PRICE_MSG))
  .transform((n) => Math.round(n * 100) / 100);
const count = (max: number) => z.coerce.number({ message: "Podaj liczbę sztuk." }).int({ message: "Podaj liczbę sztuk." }).min(0, { message: "Podaj liczbę sztuk." }).max(max, { message: "Podaj liczbę sztuk." });

export const stockItemSchema = z.object({
  kind: z.enum(["trumna", "urna", "inne"]),
  name: z.string().trim().min(2, { message: "Podaj nazwę produktu." }).max(120),
  material: z.string().trim().max(120).optional().default(""),
  supplier: z.string().trim().max(120).optional().default(""),
  sku: z.string().trim().max(60).optional().default(""),
  price_pln: price,
  qty: count(1000),
  min_qty: count(1000),
});

export const stockEditSchema = z.object({
  itemId: z.guid(),
  name: z.string().trim().min(2, { message: "Podaj nazwę produktu." }).max(120),
  price_pln: price,
  min_qty: count(1000),
  active: z.literal("tak").optional(),
});

export const stockMoveSchema = z.object({
  itemId: z.guid(),
  mode: z.enum(["dostawa", "korekta"]),
  qty: count(1000),
  note: z.string().trim().max(200).optional().default(""),
});

export type StockTemplateItem = z.input<typeof stockItemSchema>;

/** Podstawowy asortyment: nazwy ogólne, ceny przykładowe – zakład zmienia je na swoje. */
export const STOCK_TEMPLATE: StockTemplateItem[] = [
  { kind: "trumna", name: "Trumna sosnowa lakierowana", material: "sosna", price_pln: "1500", qty: 0, min_qty: 2 },
  { kind: "trumna", name: "Trumna olchowa", material: "olcha", price_pln: "2400", qty: 0, min_qty: 1 },
  { kind: "trumna", name: "Trumna dębowa", material: "dąb", price_pln: "4200", qty: 0, min_qty: 1 },
  { kind: "trumna", name: "Trumna do kremacji", material: "sosna, bez metalowych okuć", price_pln: "900", qty: 0, min_qty: 2 },
  { kind: "urna", name: "Urna ceramiczna", material: "ceramika", price_pln: "450", qty: 0, min_qty: 2 },
  { kind: "urna", name: "Urna metalowa", material: "stal malowana proszkowo", price_pln: "700", qty: 0, min_qty: 1 },
  { kind: "urna", name: "Urna drewniana", material: "dąb", price_pln: "600", qty: 0, min_qty: 1 },
  { kind: "urna", name: "Urna biodegradowalna", material: "papier i włókna roślinne", price_pln: "350", qty: 0, min_qty: 1 },
  { kind: "inne", name: "Komplet do trumny (poduszka, pościel)", material: "tkanina", price_pln: "150", qty: 0, min_qty: 2 },
  { kind: "inne", name: "Krzyż drewniany z tabliczką", material: "drewno", price_pln: "250", qty: 0, min_qty: 1 },
];

/** Mało na stanie: stan na poziomie minimum albo niżej (przy minimum 0 – dopiero gdy brak). */
export function lowStock(qty: number, minQty: number): boolean {
  return minQty > 0 ? qty <= minQty : qty === 0;
}
