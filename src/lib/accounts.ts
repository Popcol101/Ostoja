// Konta logowania (auth.users). Tylko po stronie serwera.
// Na Supabase konto z hasłem zakłada src/lib/auth.ts (Admin API, klucz service_role – nigdy NEXT_PUBLIC_).
// Lokalnie bez Supabase (DEMO_MODE=true): wiersz w lokalnej nakładce auth.users, bez hasła.
import { asServer } from "./db";

/** Format tokenu zaproszenia: 32 bajty w base64url (43–44 znaki). */
export const INVITE_TOKEN = /^[A-Za-z0-9_-]{40,60}$/;

/** Id konta dla adresu e-mail albo null. */
export async function findAuthUser(email: string): Promise<string | null> {
  const [u] = await asServer((tx) => tx<{ id: string | null }[]>`select auth_user_by_email(${email.trim().toLowerCase()}) as id`);
  return u?.id ?? null;
}

/** Wersja testowa bez Supabase: konto w nakładce auth (logowanie tylko kontami testowymi). */
export async function demoCreateUser(email: string): Promise<string> {
  const [u] = await asServer((tx) => tx<{ id: string }[]>`select demo_create_auth_user(${email.trim().toLowerCase()}) as id`);
  return u.id;
}
