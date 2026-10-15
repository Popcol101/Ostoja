// Konta logowania (auth.users) dla zaproszonych osób. Tylko po stronie serwera.
// Supabase: konto zakładamy przez Admin API kluczem service_role (SUPABASE_SERVICE_ROLE_KEY – nigdy NEXT_PUBLIC_).
// Lokalnie i w wersji testowej bez Supabase (DEMO_MODE=true): wiersz w lokalnej nakładce auth.users.
import { authConfig } from "./auth";
import { sql } from "./db";

export type AdminConfig = { url: string; serviceKey: string };

export function adminConfig(env: NodeJS.ProcessEnv = process.env): AdminConfig | null {
  const base = authConfig(env);
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !serviceKey) return null;
  return { url: base.url, serviceKey };
}

/** Format tokenu zaproszenia: 32 bajty w base64url (43–44 znaki). */
export const INVITE_TOKEN = /^[A-Za-z0-9_-]{40,60}$/;

export type EnsureResult = { ok: true; userId: string } | { ok: false };

async function findUser(email: string): Promise<string | null> {
  const [u] = await sql<{ id: string }[]>`select id from auth.users where lower(email) = ${email} limit 1`;
  return u?.id ?? null;
}

/** Zwraca id konta dla adresu; zakłada konto, jeśli go nie ma. */
export async function ensureAuthUser(
  email: string,
  opts: { admin: AdminConfig | null; demo: boolean; fetcher?: typeof fetch },
): Promise<EnsureResult> {
  const normalized = email.trim().toLowerCase();
  const existing = await findUser(normalized);
  if (existing) return { ok: true, userId: existing };

  if (opts.admin) {
    const res = await (opts.fetcher ?? fetch)(`${opts.admin.url}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: opts.admin.serviceKey,
        authorization: `Bearer ${opts.admin.serviceKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: normalized, email_confirm: true }),
      cache: "no-store",
    });
    if (!res.ok) {
      // Równoległe przyjęcie mogło już założyć konto.
      const again = await findUser(normalized);
      return again ? { ok: true, userId: again } : { ok: false };
    }
    const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
    return typeof body?.id === "string" ? { ok: true, userId: body.id } : { ok: false };
  }

  if (opts.demo) {
    const [u] = await sql<{ id: string }[]>`
      insert into auth.users (id, email) values (gen_random_uuid(), ${normalized})
      on conflict (email) do update set email = excluded.email
      returning id`;
    return { ok: true, userId: u.id };
  }
  return { ok: false };
}
