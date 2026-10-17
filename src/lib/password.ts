// Hasła do panelu: co najmniej 12 znaków, bez wymogów typu „wielka litera i cyfra” (zalecenia NIST SP 800-63B),
// za to odrzucamy hasła znane z wycieków. Sprawdzenie jest anonimowe (Have I Been Pwned, k-anonimowość):
// do serwisu trafia tylko 5 pierwszych znaków skrótu SHA-1, nigdy hasło ani cały skrót.
import { createHash } from "node:crypto";

export const PASSWORD_MIN = 12;
/** Supabase (bcrypt) bierze pod uwagę najwyżej 72 bajty. */
export const PASSWORD_MAX_BYTES = 72;

export const PASSWORD_HINT = "Co najmniej 12 znaków. Najłatwiej zapamiętać kilka słów, np. „zielony czajnik stoi w ogrodzie”.";

export type PasswordProblem = "za-krotkie" | "za-dlugie" | "rozne" | "jak-email" | "wyciek";

export const PASSWORD_MESSAGE: Record<PasswordProblem, string> = {
  "za-krotkie": "Hasło musi mieć co najmniej 12 znaków.",
  "za-dlugie": "Hasło jest za długie – najwyżej 72 znaki.",
  rozne: "Hasła się różnią. Wpisz to samo hasło dwa razy.",
  "jak-email": "Hasło nie może być adresem e-mail.",
  wyciek: "To hasło wyciekło kiedyś z innego serwisu i jest znane włamywaczom. Wybierz inne.",
};

/** Sprawdzenia bez sieci. `repeat` = null, gdy formularz nie ma powtórzenia (logowanie przy zaproszeniu). */
export function passwordProblem(password: string, repeat: string | null, email?: string | null): PasswordProblem | null {
  if ([...password].length < PASSWORD_MIN) return "za-krotkie";
  if (Buffer.byteLength(password, "utf8") > PASSWORD_MAX_BYTES) return "za-dlugie";
  if (repeat !== null && password !== repeat) return "rozne";
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) return "jak-email";
  return null;
}

/**
 * Czy hasło jest w bazie wycieków. Przy braku odpowiedzi (sieć, limit) przepuszczamy – lepiej nie blokować
 * zakładu w nocy przez awarię cudzego serwisu. PWNED_CHECK=off wyłącza sprawdzenie (testy lokalne).
 */
export async function isPwned(password: string, fetcher: typeof fetch = fetch, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  if (env.PWNED_CHECK === "off") return false;
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  try {
    const res = await fetcher(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true", "user-agent": "Ostoja" },
      cache: "no-store",
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) return false;
    const body = await res.text();
    return body.split("\n").some((line) => {
      const [s, count] = line.trim().split(":");
      return s === suffix && Number(count) > 0;
    });
  } catch {
    return false;
  }
}
