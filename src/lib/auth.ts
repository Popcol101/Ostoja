// Logowanie e-mailem i hasłem przez Supabase Auth (REST, bez biblioteki klienckiej).
// Supabase sprawdza hasło i trzyma jego skrót; sesję w aplikacji wydajemy sami (src/lib/session.ts),
// a zapytania do bazy idą dalej przez withUser() z RLS.
//
// Konta zakłada aplikacja (Admin API, klucz service_role) przy przyjęciu zaproszenia – razem z hasłem.
// Zmiana hasła: Admin API tworzy jednorazowy token „recovery” (Supabase nic nie wysyła), aplikacja wysyła
// link przez Brevo (src/lib/mail.ts), a po kliknięciu wymienia token na konto i ustawia nowe hasło.
// Szablony e-maili Supabase nie są używane.

export type AuthConfig = { url: string; anonKey: string };
export type AdminConfig = { url: string; serviceKey: string };

export function authConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig | null {
  const url = env.SUPABASE_URL?.replace(/\/+$/, "");
  const anonKey = env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function adminConfig(env: NodeJS.ProcessEnv = process.env): AdminConfig | null {
  const base = authConfig(env);
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !serviceKey) return null;
  return { url: base.url, serviceKey };
}

/** Logowanie hasłem działa, gdy aplikacja zna adres i klucz publiczny Supabase. */
export function emailLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return authConfig(env) !== null;
}

/** Format token_hash z linku (Supabase: 56 znaków szesnastkowych; dopuszczamy zapas). */
export const TOKEN_HASH = /^[A-Za-z0-9_-]{20,200}$/;
const USER_ID = /^[0-9a-f-]{36}$/i;

const adminHeaders = (a: AdminConfig) => ({
  apikey: a.serviceKey,
  authorization: `Bearer ${a.serviceKey}`,
  "content-type": "application/json",
});

export type SignInResult = { ok: true; userId: string } | { ok: false; reason: "dane" | "limit" | "blad" };

/** Sprawdza e-mail i hasło. Ten sam wynik „dane” dla złego hasła i nieistniejącego konta. */
export async function signInWithPassword(email: string, password: string, cfg: AuthConfig, fetcher: typeof fetch = fetch): Promise<SignInResult> {
  const res = await fetcher(`${cfg.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: cfg.anonKey, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (res.status === 429) return { ok: false, reason: "limit" };
  if (res.status === 400 || res.status === 401 || res.status === 422) return { ok: false, reason: "dane" };
  if (!res.ok) return { ok: false, reason: "blad" };
  const body = (await res.json().catch(() => null)) as { user?: { id?: unknown } } | null;
  const id = body?.user?.id;
  return typeof id === "string" && USER_ID.test(id) ? { ok: true, userId: id } : { ok: false, reason: "blad" };
}

/** Jednorazowy token do ustawienia hasła (Supabase go nie wysyła – robi to aplikacja). null = brak konta lub błąd. */
export async function createPasswordToken(email: string, admin: AdminConfig, fetcher: typeof fetch = fetch): Promise<string | null> {
  const res = await fetcher(`${admin.url}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: adminHeaders(admin),
    body: JSON.stringify({ type: "recovery", email }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { hashed_token?: unknown; properties?: { hashed_token?: unknown } } | null;
  const token = body?.properties?.hashed_token ?? body?.hashed_token;
  return typeof token === "string" && TOKEN_HASH.test(token) ? token : null;
}

export type VerifyResult = { ok: true; userId: string } | { ok: false };

/** Wymienia token z linku „ustaw hasło” na identyfikator konta. Token działa raz. */
export async function verifyPasswordToken(tokenHash: string, cfg: AuthConfig, fetcher: typeof fetch = fetch): Promise<VerifyResult> {
  if (!TOKEN_HASH.test(tokenHash)) return { ok: false };
  const res = await fetcher(`${cfg.url}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: cfg.anonKey, "content-type": "application/json" },
    body: JSON.stringify({ type: "recovery", token_hash: tokenHash }),
    cache: "no-store",
  });
  if (!res.ok) return { ok: false };
  const body = (await res.json().catch(() => null)) as { user?: { id?: unknown } } | null;
  const id = body?.user?.id;
  return typeof id === "string" && USER_ID.test(id) ? { ok: true, userId: id } : { ok: false };
}

/** Ustawia hasło konta (Admin API). */
export async function setUserPassword(
  userId: string,
  password: string,
  admin: AdminConfig,
  fetcher: typeof fetch = fetch,
): Promise<"ok" | "slabe" | "blad"> {
  if (!USER_ID.test(userId)) return "blad";
  const res = await fetcher(`${admin.url}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers: adminHeaders(admin),
    body: JSON.stringify({ password }),
    cache: "no-store",
  });
  if (res.ok) return "ok";
  return (await errorCode(res)) === "weak_password" ? "slabe" : "blad";
}

export type CreateUserResult = { ok: true; userId: string } | { ok: false; reason: "istnieje" | "slabe" | "blad" };

/** Kod błędu Supabase Auth (np. email_exists, weak_password). */
async function errorCode(res: Response): Promise<string | null> {
  const body = (await res.json().catch(() => null)) as { error_code?: unknown; code?: unknown } | null;
  return typeof body?.error_code === "string" ? body.error_code : typeof body?.code === "string" ? body.code : null;
}

/** Zakłada potwierdzone konto z hasłem (Admin API). Rejestracja z formularza w Supabase jest wyłączona. */
export async function createUserWithPassword(email: string, password: string, admin: AdminConfig, fetcher: typeof fetch = fetch): Promise<CreateUserResult> {
  const res = await fetcher(`${admin.url}/auth/v1/admin/users`, {
    method: "POST",
    headers: adminHeaders(admin),
    body: JSON.stringify({ email, password, email_confirm: true }),
    cache: "no-store",
  });
  if (!res.ok) {
    const code = await errorCode(res);
    if (code === "email_exists" || code === "user_already_exists") return { ok: false, reason: "istnieje" };
    if (code === "weak_password") return { ok: false, reason: "slabe" };
    return { ok: false, reason: "blad" };
  }
  const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
  return typeof body?.id === "string" && USER_ID.test(body.id) ? { ok: true, userId: body.id } : { ok: false, reason: "blad" };
}
