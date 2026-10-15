// Dostęp do bazy wyłącznie po stronie serwera.
// Każde zapytanie w imieniu użytkownika idzie przez withUser(), które ustawia rolę i claims
// dokładnie tak jak Supabase — dzięki temu działają polityki RLS z supabase/migrations.
import postgres from "postgres";

const globalForDb = globalThis as unknown as { ostojaSql?: postgres.Sql };

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Brak zmiennej DATABASE_URL");
  return postgres(url, {
    max: 10,
    idle_timeout: 20,
    prepare: false, // zgodność z poolerem Supabase (tryb transaction)
    types: {
      // Kwoty i odległości jako liczby (numeric domyślnie przychodzi jako tekst).
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      // Daty bez godziny zostają tekstem RRRR-MM-DD, żeby uniknąć przesunięć stref czasowych.
      date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
    },
  });
}

export const sql: postgres.Sql = globalForDb.ostojaSql ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.ostojaSql = sql;

export type Tx = postgres.TransactionSql;

/** Zapytania w imieniu zalogowanego pracownika zakładu (rola authenticated + RLS). */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const result = await sql.begin(async (tx) => {
    const claims = JSON.stringify({ sub: userId, role: "authenticated" });
    await tx`select set_config('request.jwt.claims', ${claims}, true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  });
  return result as T;
}

/** Zapytania gościa (rodzina bez logowania) — rola anon, tylko funkcje security definer. */
export async function asAnon<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const result = await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', '{"role":"anon"}', true)`;
    await tx`set local role anon`;
    return fn(tx);
  });
  return result as T;
}

/**
 * Operacje, które może wykonać tylko serwer aplikacji (kod SMS, przyjęcie zaproszenia, limity prób) –
 * rola service_role. Nigdy nie wywołuj z danymi, których nie sprawdziła akcja serwerowa.
 */
export async function asServer<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const result = await sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', '{"role":"service_role"}', true)`;
    await tx`set local role service_role`;
    return fn(tx);
  });
  return result as T;
}

/** Komunikat błędu z bazy, który można pokazać użytkownikowi (nasze RAISE z kodami P0001 i 42501). */
export function userFacingDbError(error: unknown): string | null {
  if (error && typeof error === "object" && "code" in error && "message" in error) {
    const { code, message } = error as { code: string; message: string };
    if (code === "P0001" || code === "42501") return message;
    if (code === "23P01") return "Ten zasób jest już zarezerwowany w tym czasie.";
    if (code === "23514" || code === "22023" || code === "22P02") return "Sprawdź wpisane dane.";
  }
  return null;
}
