// Wniosek o zasiłek pogrzebowy (ZUS Z-12): walidacja PESEL, termin złożenia i formularz zakładu.
import { z } from "zod";

/** PESEL: 11 cyfr, poprawna suma kontrolna i data urodzenia. */
export function validPesel(p: string): boolean {
  if (!/^\d{11}$/.test(p)) return false;
  const d = p.split("").map(Number);
  const w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const sum = w.reduce((s, x, i) => s + x * d[i], 0);
  if ((10 - (sum % 10)) % 10 !== d[10]) return false;
  let month = d[2] * 10 + d[3];
  let year = d[0] * 10 + d[1];
  const centuries = [1900, 2000, 2100, 2200, 1800];
  const century = centuries[Math.floor(month / 20)];
  month %= 20;
  year += century;
  const day = d[4] * 10 + d[5];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Ostatni dzień na złożenie wniosku: 12 miesięcy od dnia śmierci (RRRR-MM-DD). */
export function claimDeadline(deathDay: string): string {
  const [y, m, d] = deathDay.split("-").map(Number);
  const last = new Date(Date.UTC(y + 1, m, 0)).getUTCDate(); // 29 lutego → 28 lutego w roku nieprzestępnym
  return `${y + 1}-${String(m).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}

const pesel = (msg: string) =>
  z
    .string()
    .optional()
    .default("")
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v === "" || validPesel(v), { message: msg });

export const zusClaimSchema = z
  .object({
    orderId: z.guid(),
    applicant_pesel: pesel("Sprawdź PESEL osoby, która pokryła koszty."),
    applicant_id_doc: z.string().trim().max(30).optional().default(""),
    applicant_relation: z.string().trim().max(60).optional().default(""),
    deceased_pesel: pesel("Sprawdź PESEL osoby zmarłej."),
    deceased_id_doc: z.string().trim().max(30).optional().default(""),
    death_place: z.string().trim().max(120).optional().default(""),
    other_pension_body: z.string().trim().max(120).optional().default(""),
    costs_covered: z.enum(["calosc", "czesc"]),
    no_other_benefit: z.literal("tak").optional(),
    payout_to_home: z.enum(["brak", "calosc", "czesc"]),
    payout_home_pln: z
      .string()
      .optional()
      .default("")
      .transform((v) => (v.trim() === "" ? null : Number(v.replace(/\s/g, "").replace(",", "."))))
      .refine((v) => v === null || (Number.isFinite(v) && v > 0 && v <= 100000), { message: "Kwota musi być liczbą." }),
  })
  .refine((v) => v.payout_to_home !== "czesc" || v.payout_home_pln !== null, {
    message: "Podaj kwotę, którą ZUS ma wypłacić zakładowi.",
  });

export type ZusClaim = {
  applicant_pesel: string | null;
  applicant_id_doc: string | null;
  applicant_relation: string | null;
  deceased_pesel: string | null;
  deceased_id_doc: string | null;
  death_place: string | null;
  other_pension_body: string | null;
  costs_covered: "calosc" | "czesc";
  no_other_benefit: boolean;
  payout_to_home: "brak" | "calosc" | "czesc";
  payout_home_pln: number | null;
};

/** Czego brakuje do złożenia wniosku (lista dla zakładu). */
export function missingForClaim(x: {
  claim: ZusClaim | null;
  deceasedName: boolean;
  diedAt: boolean;
  applicantAddress: boolean;
  applicantAccount: boolean;
  invoice: boolean;
  homeRegon: boolean;
  homeAccount: boolean;
}): string[] {
  const c = x.claim;
  const out: string[] = [];
  if (!x.deceasedName) out.push("Imię i nazwisko osoby zmarłej");
  if (!c?.deceased_pesel && !c?.deceased_id_doc) out.push("PESEL osoby zmarłej (albo seria i numer dokumentu)");
  if (!x.diedAt) out.push("Data zgonu");
  if (!c?.death_place) out.push("Miejsce zgonu");
  if (!c?.applicant_pesel && !c?.applicant_id_doc) out.push("PESEL osoby, która pokryła koszty");
  if (!c?.applicant_relation) out.push("Pokrewieństwo z osobą zmarłą");
  if (!x.applicantAddress) out.push("Adres osoby, która pokryła koszty");
  if (!c?.no_other_benefit) out.push("Oświadczenie o niepobraniu zasiłku z innego tytułu");
  if (!x.invoice) out.push("Faktura lub rachunek za pogrzeb");
  if (c && c.payout_to_home !== "calosc" && !x.applicantAccount) out.push("Numer konta rodziny do wypłaty zasiłku");
  if (c && c.payout_to_home !== "brak" && (!x.homeRegon || !x.homeAccount)) out.push("REGON i rachunek zakładu (profil zakładu)");
  return out;
}
