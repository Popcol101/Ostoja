// Formatowanie dla polskiego interfejsu. Strefa czasowa zawsze Europe/Warsaw.
export const TZ = "Europe/Warsaw";

const pln = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0, useGrouping: "always" });

export function formatPln(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${pln.format(Math.round(value)).replace(/[\u202f\s]/g, "\u00a0")}\u00a0zł`;
}

export function formatDate(value: Date | string, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pl-PL", { timeZone: TZ, day: "numeric", month: "long", ...opts }).format(d);
}

export function formatTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pl-PL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(d);
}

export function formatDateTime(value: Date | string): string {
  return `${formatDate(value, { weekday: "short" })}, ${formatTime(value)}`;
}

/** Data bez godziny zapisana jako tekst RRRR-MM-DD. */
export function formatPlainDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Polska odmiana liczebników: 1 zlecenie, 2 zlecenia, 5 zleceń. */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  if (abs === 1) return one;
  const last = abs % 10;
  const lastTwo = abs % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}

export function countLabel(n: number, one: string, few: string, many: string): string {
  return `${n} ${plural(n, one, few, many)}`;
}

/** Klucz dnia RRRR-MM-DD w strefie Europe/Warsaw. */
export function dayKey(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts; // en-CA daje format RRRR-MM-DD
}

/** Moment w UTC dla lokalnej daty i godziny w Europe/Warsaw (uwzględnia zmianę czasu). */
export function warsawToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // Przesunięcie strefy w tym momencie (godzina letnia/zimowa).
  const offsetAt = (t: number) => {
    const local = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    }).formatToParts(new Date(t));
    const get = (type: string) => Number(local.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    return asUtc - t;
  };
  let ts = guess - offsetAt(guess);
  ts = guess - offsetAt(ts);
  return new Date(ts);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Poniedziałek tygodnia zawierającego podany dzień (RRRR-MM-DD). */
export function mondayOf(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = niedziela
  const shift = dow === 0 ? -6 : 1 - dow;
  return addDays(day, shift);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function formatBankAccount(digits: string | null | undefined): string {
  if (!digits) return "—";
  const clean = digits.replace(/\D/g, "");
  return clean.replace(/^(\d{2})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})$/, "$1 $2 $3 $4 $5 $6 $7");
}
