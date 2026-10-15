"use server";
// Logowanie do panelu: link z e-maila (Supabase Auth) albo – tylko w wersji testowej – konto testowe.
import { RedirectType, redirect } from "next/navigation";
import { z } from "zod";
import { TOKEN_HASH, authConfig, requestMagicLink, verifyMagicLink } from "@/lib/auth";
import { asServer } from "@/lib/db";
import { withMessage } from "@/lib/messages";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, demoModeEnabled } from "@/lib/session";

const back = (kind: "ok" | "blad", text: string): never => redirect(withMessage("/logowanie", kind, text), RedirectType.replace);

/** Dokąd wpuścić konto: panel zakładu (członkostwo), panel administratora albo nigdzie. */
async function destination(userId: string): Promise<"/panel/zapytania" | "/admin" | null> {
  const [row] = await asServer((tx) => tx<{ d: string | null }[]>`select login_destination(${userId}) as d`);
  return row?.d === "panel" ? "/panel/zapytania" : row?.d === "admin" ? "/admin" : null;
}

const emailSchema = z.object({ email: z.email({ message: "Podaj poprawny e-mail" }).max(200) });

export async function sendLoginLink(formData: FormData) {
  const cfg = authConfig();
  if (!cfg) back("blad", "Nie udało się zapisać. Spróbuj ponownie albo zadzwoń do opiekuna Ostoi.");
  const parsed = emailSchema.safeParse({ email: String(formData.get("email") ?? "").trim().toLowerCase() });
  if (!parsed.success) back("blad", "Podaj poprawny e-mail");
  if (!(await rateLimit("link-logowania", 5, 15 * 60 * 1000))) back("blad", "Link można wysłać raz na minutę. Spróbuj za chwilę.");

  const res = await requestMagicLink(parsed.data!.email, cfg!);
  if (!res.ok) {
    back("blad", res.reason === "limit" ? "Link można wysłać raz na minutę. Spróbuj za chwilę." : "Nie udało się zapisać. Spróbuj ponownie albo zadzwoń do opiekuna Ostoi.");
  }
  back("ok", "Jeśli ten adres jest przypisany do zakładu, wysłaliśmy na niego link. Sprawdź skrzynkę – link działa godzinę.");
}

export async function confirmLoginLink(formData: FormData) {
  const cfg = authConfig();
  const tokenHash = String(formData.get("token_hash") ?? "");
  if (!cfg || !TOKEN_HASH.test(tokenHash)) back("blad", "Link wygasł albo został już użyty. Poproś o nowy.");
  if (!(await rateLimit("potwierdzenie", 20, 15 * 60 * 1000))) back("blad", "Zbyt wiele prób. Spróbuj za chwilę.");

  const res = await verifyMagicLink(tokenHash, cfg!);
  if (!res.ok) back("blad", "Link wygasł albo został już użyty. Poproś o nowy.");
  const userId = (res as { userId: string }).userId;
  const target = await destination(userId);
  if (!target) back("blad", "To konto nie jest przypisane do żadnego zakładu. Zadzwoń do opiekuna partnerów Ostoi.");
  await createSession(userId);
  redirect(target!);
}

export async function loginDemo(formData: FormData) {
  if (!demoModeEnabled()) back("blad", "Logowanie kontami testowymi jest wyłączone.");
  const userId = z.guid().parse(formData.get("userId"));
  // Konta testowe to tylko adresy @….test – prawdziwe konta logują się linkiem z e-maila, nawet na wersji testowej.
  const [u] = await asServer((tx) => tx<{ email: string | null }[]>`select auth_user_email(${userId}) as email`);
  if (!u?.email?.endsWith(".test")) back("blad", "To konto loguje się linkiem z e-maila.");
  const target = await destination(userId);
  if (!target) back("blad", "To konto nie jest przypisane do żadnego zakładu. Zadzwoń do opiekuna partnerów Ostoi.");
  await createSession(userId);
  redirect(target!);
}
