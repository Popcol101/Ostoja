// Parametry wyszukiwania z kreatora (adres /oferty?miasto=…&forma=…). Wspólne dla /oferty i /oferty/kontakt.
import { z } from "zod";

export const searchSchema = z.object({
  miasto: z.string().regex(/^[a-z-]{2,40}$/),
  forma: z.enum(["tradycyjny", "kremacja", "nie_wiem"]),
  ceremonia: z.enum(["religijna", "swiecka", "bez"]),
  miejsce: z.enum(["szpital", "dom", "dps"]),
  budzet: z.enum(["zasilek", "srednio", "wiecej", "nie_wiem"]).optional().catch(undefined),
});

export type SearchInput = z.infer<typeof searchSchema>;

export const SORTS = [
  { value: "odleglosc", label: "Najbliżej" },
  { value: "cena", label: "Najniższa cena" },
  { value: "oceny", label: "Najlepsze oceny" },
] as const;

export type Sort = (typeof SORTS)[number]["value"];

export function parseSort(v: string | undefined): Sort {
  return SORTS.some((s) => s.value === v) ? (v as Sort) : "odleglosc";
}

/** Query string bez pustych wartości. */
export function toQuery(input: Partial<SearchInput> & Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(input)) if (v) p.set(k, v);
  return p.toString();
}

export function parseSearch(sp: Record<string, string | string[] | undefined>) {
  const flat: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(sp)) flat[k] = Array.isArray(v) ? v[0] : v;
  return searchSchema.safeParse(flat);
}
