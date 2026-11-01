// Opieka nad grobem: katalog, wycena (ta sama reguła co grave_quote w bazie), formularz zamówienia.
import { z } from "zod";

export type GraveService = { key: "znicz" | "kwiaty" | "sprzatanie"; label: string; description: string; base_price_pln: number; product_kind: "znicz" | "kwiaty" | null };
export type GraveProduct = { key: string; kind: "znicz" | "kwiaty"; label: string; price_pln: number; is_default: boolean };
export type GraveItem = { service: GraveService["key"]; products?: { key: string; qty: number }[] };
export type Frequency = "jednorazowo" | "co_tydzien" | "co_miesiac" | "swieta";

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  jednorazowo: "Jednorazowo",
  co_tydzien: "Co tydzień",
  co_miesiac: "Co miesiąc",
  swieta: "Przed świętami (31.10 i 23.12)",
};

export const VISIT_STATUS_LABEL: Record<string, string> = { zaplanowana: "Zaplanowana", wykonana: "Wykonana", nie_wykonano: "Nie wykonano" };

/** Wycena: usługa (40 zł znicz/kwiaty, 60 zł sprzątanie) + produkty × sztuki. */
export function quoteGrave(items: GraveItem[], services: GraveService[], products: GraveProduct[]): number {
  let total = 0;
  for (const it of items) {
    const s = services.find((x) => x.key === it.service);
    if (!s) continue;
    total += Number(s.base_price_pln);
    if (s.product_kind) {
      for (const p of it.products ?? []) {
        const prod = products.find((x) => x.key === p.key && x.kind === s.product_kind);
        if (prod) total += Number(prod.price_pln) * p.qty;
      }
    }
  }
  return Math.round(total * 100) / 100;
}

/** Pozycje z formularza: usluga=znicz, produkt_znicz=znicz_3d, sztuki_znicz=2 … */
export function itemsFromForm(form: Record<string, FormDataEntryValue | FormDataEntryValue[]>, services: GraveService[]): GraveItem[] {
  const chosen = ([] as FormDataEntryValue[]).concat(form.usluga ?? []).map(String);
  const items: GraveItem[] = [];
  for (const s of services) {
    if (!chosen.includes(s.key)) continue;
    if (s.product_kind) {
      const key = String(form[`produkt_${s.key}`] ?? "");
      const qty = Math.max(1, Math.min(20, Math.trunc(Number(form[`sztuki_${s.key}`] ?? 1)) || 1));
      items.push({ service: s.key, products: key ? [{ key, qty }] : [] });
    } else {
      items.push({ service: s.key });
    }
  }
  return items;
}

const coord = (min: number, max: number) =>
  z
    .string()
    .optional()
    .default("")
    .transform((v) => (v.trim() === "" ? null : Number(v.replace(",", "."))))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), { message: "Nieprawidłowe położenie grobu." });

export const graveOrderSchema = z.object({
  cemetery_id: z.guid({ message: "Wybierz cmentarz z listy." }),
  deceased_name: z.string().trim().min(2, { message: "Podaj imię i nazwisko osoby pochowanej." }).max(120),
  grave_section: z.string().trim().max(20).optional().default(""),
  grave_row: z.string().trim().max(20).optional().default(""),
  grave_number: z.string().trim().max(20).optional().default(""),
  grave_lat: coord(49, 55),
  grave_lng: coord(14, 25),
  grave_notes: z.string().trim().max(300).optional().default(""),
  frequency: z.enum(["jednorazowo", "co_tydzien", "co_miesiac", "swieta"]),
  first_on: z.iso.date({ message: "Wybierz termin pierwszej wizyty." }),
  customer_name: z.string().trim().min(2, { message: "Podaj imię i nazwisko" }).max(120),
  customer_email: z.string().trim().toLowerCase().pipe(z.email({ message: "Podaj poprawny e-mail" })),
  customer_phone: z
    .string()
    .optional()
    .default("")
    .transform((v) => v.replace(/[^\d+]/g, ""))
    .pipe(z.union([z.literal(""), z.string().regex(/^(\+48)?\d{9}$/, { message: "Podaj numer telefonu, np. 600 100 200" })])),
  zgoda: z.literal("tak", { message: "Zaakceptuj regulamin usługi." }),
});
