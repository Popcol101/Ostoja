// Logowanie linkiem z e-maila przez Supabase Auth (REST, bez biblioteki klienckiej).
// Supabase tylko potwierdza adres e-mail; sesję w aplikacji wydajemy sami (src/lib/session.ts),
// a zapytania do bazy idą dalej przez withUser() z RLS.
//
// Szablon e-maila „Magic Link” w Supabase (Authentication → Email Templates):
//   <a href="{{ .SiteURL }}/logowanie/potwierdz?token_hash={{ .TokenHash }}&type=email">Zaloguj się do Ostoi</a>
// Site URL = APP_URL. Konta zakładów zakłada opiekun Ostoi – nowych kont z formularza nie tworzymy.

export type AuthConfig = { url: string; anonKey: string };

export function authConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig | null {
  const url = env.SUPABASE_URL?.replace(/\/+$/, "");
  const anonKey = env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function emailLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return authConfig(env) !== null;
}

/** Format token_hash z linku (Supabase: 56 znaków szesnastkowych; dopuszczamy zapas). */
export const TOKEN_HASH = /^[A-Za-z0-9_-]{20,200}$/;

export type MagicLinkResult = { ok: true } | { ok: false; reason: "limit" | "blad" };

/**
 * Wysyła link logowania. Nie zdradza, czy konto istnieje: dla nieznanego adresu Supabase
 * zwraca błąd „Signups not allowed”, a my i tak pokazujemy ten sam komunikat.
 */
export async function requestMagicLink(email: string, cfg: AuthConfig, fetcher: typeof fetch = fetch): Promise<MagicLinkResult> {
  const res = await fetcher(`${cfg.url}/auth/v1/otp`, {
    method: "POST",
    headers: { apikey: cfg.anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, create_user: false }),
    cache: "no-store",
  });
  if (res.ok) return { ok: true };
  if (res.status === 429) return { ok: false, reason: "limit" };
  // 400/422 dla nieistniejącego konta traktujemy jak sukces (bez wycieku informacji).
  if (res.status === 400 || res.status === 422) return { ok: true };
  return { ok: false, reason: "blad" };
}

export type VerifyResult = { ok: true; userId: string } | { ok: false };

/** Wymienia token_hash z linku na identyfikator użytkownika (auth.users.id). */
export async function verifyMagicLink(tokenHash: string, cfg: AuthConfig, fetcher: typeof fetch = fetch): Promise<VerifyResult> {
  if (!TOKEN_HASH.test(tokenHash)) return { ok: false };
  const res = await fetcher(`${cfg.url}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: cfg.anonKey, "content-type": "application/json" },
    body: JSON.stringify({ type: "email", token_hash: tokenHash }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false };
  const body = (await res.json().catch(() => null)) as { user?: { id?: unknown } } | null;
  const id = body?.user?.id;
  return typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id) ? { ok: true, userId: id } : { ok: false };
}
