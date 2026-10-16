import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MESSAGES, messageCode, messageText, withMessage } from "./messages";

describe("komunikaty po akcjach", () => {
  it("zamienia znany tekst na kod i z powrotem", () => {
    expect(messageCode("Zapisano profil.")).toBe("profil-zapisany");
    expect(messageText("profil-zapisany")).toBe("Zapisano profil.");
  });

  it("nieznany tekst (np. błąd z bazy z danymi) daje ogólny komunikat", () => {
    expect(messageCode("Pole x nie może być zmienione przez rodzinę")).toBe("blad-zapisu");
  });

  it("nie pokazuje dowolnego tekstu z adresu", () => {
    expect(messageText("Zadzwoń pod 600 000 000")).toBeNull();
    expect(messageText(undefined)).toBeNull();
  });

  it("buduje adres tylko ze znaków ASCII i zastępuje poprzedni komunikat", () => {
    const url = withMessage("/panel/zlecenia/1?ok=zapytanie-przyjete&tydzien=2026-10-12", "ok", "Umowa oznaczona jako podpisana.");
    expect(url).toBe("/panel/zlecenia/1?tydzien=2026-10-12&ok=umowa-podpisana");
    expect(/^[\x20-\x7e]+$/.test(url)).toBe(true);
  });

  it("kody są unikalne i w ASCII", () => {
    for (const code of Object.keys(MESSAGES)) expect(code).toMatch(/^[a-z-]+$/);
    expect(new Set(Object.values(MESSAGES)).size).toBe(Object.keys(MESSAGES).length);
  });

  it("ma tekst dla każdego błędu, który baza pokazuje użytkownikowi (P0001, 42501)", () => {
    const dir = "supabase/migrations";
    const missing: string[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql"))) {
      const sql = readFileSync(`${dir}/${file}`, "utf8");
      for (const m of sql.matchAll(/raise exception '((?:[^']|'')+)'\s+using errcode = '(?:P0001|42501)'/g)) {
        const text = m[1].replaceAll("''", "'");
        if (messageCode(text) === "blad-zapisu") missing.push(`${file}: ${text}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
