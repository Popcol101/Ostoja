// Zgłaszanie błędów aplikacji bez danych osobowych (zasada: logi bez PESEL, telefonów i nazwisk).
// Do bazy trafia tylko: rodzaj (serwer/przeglądarka), wzorzec trasy, oczyszczony komunikat i digest Next.js.
import { createHash } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Usuwa z komunikatu wszystko, co może być daną osobową albo sekretem; skraca do 300 znaków. */
export function scrubMessage(input: string): string {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[e-mail]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[id]")
    .replace(/\b(?=[A-Za-z0-9_-]*\d)(?=[A-Za-z0-9_-]*[A-Za-z])[A-Za-z0-9_-]{20,}\b/g, "[token]")
    .replace(/\+?\d[\d\s-]{4,}\d/g, "[liczba]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

/** Adres strony → wzorzec trasy: bez zapytania, z identyfikatorami, tokenami i nazwami w adresie zamienionymi na znaczniki. */
export function normalizePath(path: string): string {
  const clean = path.split(/[?#]/)[0] || "/";
  const segments = clean.split("/");
  return segments
    .map((seg, i) => {
      const prev = segments[i - 1];
      if (!seg) return seg;
      if (prev === "r") return "[token]";
      if (prev === "pamiec") return "[slug]";
      if (prev === "zaproszenie") return "[token]";
      if (UUID.test(seg)) return "[id]";
      if (seg.length >= 20 || /\d{3,}/.test(seg)) return "[token]";
      return seg;
    })
    .join("/")
    .slice(0, 200);
}

export function fingerprint(kind: string, route: string, message: string): string {
  return createHash("sha256").update(`${kind}|${route}|${message}`).digest("hex").slice(0, 32);
}

export type ErrorReport = { kind: "serwer" | "przegladarka"; route: string; message: string; digest?: string | null };

/** Zapisuje błąd w bazie (app_errors). Nigdy nie rzuca – monitoring nie może zepsuć strony. */
export async function reportError(report: ErrorReport): Promise<void> {
  try {
    const route = normalizePath(report.route);
    const message = scrubMessage(report.message || "bez komunikatu");
    const digest = report.digest && /^[A-Za-z0-9@:_-]{1,64}$/.test(report.digest) ? report.digest : null;
    const { asServer } = await import("./db");
    await asServer((tx) => tx`select log_app_error(${fingerprint(report.kind, route, message)}, ${report.kind}, ${route}, ${message}, ${digest})`);
  } catch {
    // Brak bazy albo błąd zapisu – nie zgłaszamy dalej, żeby nie zapętlić.
  }
}
