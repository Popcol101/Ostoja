"use server";
// Logowanie do panelu: e-mail i hasło (Supabase Auth), zmiana hasła linkiem z e-maila,
// a w wersji testowej także konta testowe (@….test) jednym kliknięciem.
import { RedirectType, redirect } from "next/navigation";
import { z } from "zod";
import { findAuthUser } from "@/lib/accounts";
import { TOKEN_HASH, adminConfig, authConfig, createPasswordToken, setUserPassword, signInWithPassword, verifyPasswordToken } from "@/lib/auth";
import { asServer } from "@/lib/db";
import { passwordEmail } from "@/lib/emails";
import { mailConfig, sendMail } from "@/lib/mail";
import { withMessage } from "@/lib/messages";
import { PASSWORD_MESSAGE, isPwned, passwordProblem } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, demoModeEnabled } from "@/lib/session";

const back = (kind: "ok" | "blad", text: string, path = "/logowanie"): never => redirect(withMessage(path, kind, text), RedirectType.replace);

/** Dokąd wpuścić konto: panel zakładu (członkostwo), panel administratora albo nigdzie. */
async function destination(userId: string): Promise<"/panel/zapytania" | "/admin" | null> {
  const [row] = await asServer((tx) => tx<{ d: string | null }[]>`select login_destination(${userId}) as d`);
  return row?.d === "panel" ? "/panel/zapytania" : row?.d === "admin" ? "/admin" : null;
}

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ message: "Podaj poprawny e-mail" }).max(200)),
  password: z.string().min(1, { message: "Wpisz hasło" }).max(200),
});

export async function loginWithPassword(formData: FormData) {
  const cfg = authConfig();
  if (!cfg) back("blad", "Nie udało się zapisać. Spróbuj ponownie albo zadzwoń do opiekuna Ostoi.");
  const parsed = loginSchema.safeParse({ email: formData.get("email") ?? "", password: formData.get("password") ?? "" });
  if (!parsed.success) back("blad", parsed.error.issues[0]?.message ?? "Sprawdź wpisane dane.");
  if (!(await rateLimit("logowanie", 30, 15 * 60 * 1000))) back("blad", "Zbyt wiele prób logowania. Spróbuj ponownie za kwadrans.");

  const res = await signInWithPassword(parsed.data!.email, parsed.data!.password, cfg!);
  if (!res.ok) {
    back(
      "blad",
      res.reason === "dane"
        ? "Nieprawidłowy e-mail lub hasło."
        : res.reason === "limit"
          ? "Zbyt wiele prób logowania. Spróbuj ponownie za kwadrans."
          : "Nie udało się zapisać. Spróbuj ponownie albo zadzwoń do opiekuna Ostoi.",
    );
  }
  const userId = (res as { userId: string }).userId;
  const target = await destination(userId);
  if (!target) back("blad", "To konto nie jest przypisane do żadnego zakładu. Zadzwoń do opiekuna partnerów Ostoi.");
  await createSession(userId);
  redirect(target!);
}

const emailSchema = z.object({ email: z.string().trim().toLowerCase().pipe(z.email({ message: "Podaj poprawny e-mail" }).max(200)) });

/** „Nie pamiętam hasła”: link do ustawienia hasła. Ten sam komunikat, czy konto istnieje, czy nie. */
export async function requestPasswordLink(formData: FormData) {
  const PATH = "/logowanie/haslo";
  const parsed = emailSchema.safeParse({ email: formData.get("email") ?? "" });
  if (!parsed.success) back("blad", "Podaj poprawny e-mail", PATH);
  const admin = adminConfig();
  const mail = mailConfig();
  if (!admin || !mail) back("blad", "Wysyłka e-maili jest chwilowo niedostępna. Zadzwoń do opiekuna partnerów Ostoi.", PATH);
  if (!(await rateLimit("link-hasla", 5, 15 * 60 * 1000))) back("blad", "Zbyt wiele prób. Spróbuj za chwilę.", PATH);

  const email = parsed.data!.email;
  const userId = await findAuthUser(email);
  // Link tylko dla kont z dostępem do panelu – inne adresy dostają ten sam komunikat, bez e-maila.
  if (userId && (await destination(userId))) {
    const token = await createPasswordToken(email, admin!);
    if (token) {
      const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
      const m = passwordEmail(`${base}/logowanie/nowe-haslo?token_hash=${encodeURIComponent(token)}`);
      const sent = await sendMail({ to: email, ...m, kind: "haslo" }, mail!);
      if (!sent) back("blad", "Wysyłka e-maili jest chwilowo niedostępna. Zadzwoń do opiekuna partnerów Ostoi.", PATH);
    }
  }
  back("ok", "Jeśli ten adres ma konto w Ostoi, wysłaliśmy na niego link do ustawienia hasła. Link działa godzinę.", PATH);
}

/** Nowe hasło z linku. Najpierw sprawdzamy hasło (zły wybór nie zużywa linku), potem wymieniamy token. */
export async function setNewPassword(formData: FormData) {
  const tokenHash = String(formData.get("token_hash") ?? "");
  const here = `/logowanie/nowe-haslo?token_hash=${encodeURIComponent(tokenHash)}`;
  const cfg = authConfig();
  const admin = adminConfig();
  if (!cfg || !admin || !TOKEN_HASH.test(tokenHash)) back("blad", "Link wygasł albo został już użyty. Poproś o nowy.", "/logowanie/haslo");
  if (!(await rateLimit("nowe-haslo", 10, 15 * 60 * 1000))) back("blad", "Zbyt wiele prób. Spróbuj za chwilę.", here);

  const password = String(formData.get("password") ?? "");
  const problem = passwordProblem(password, String(formData.get("repeat") ?? ""));
  if (problem) back("blad", PASSWORD_MESSAGE[problem], here);
  if (await isPwned(password)) back("blad", PASSWORD_MESSAGE.wyciek, here);

  const res = await verifyPasswordToken(tokenHash, cfg!);
  if (!res.ok) back("blad", "Link wygasł albo został już użyty. Poproś o nowy.", "/logowanie/haslo");
  const userId = (res as { userId: string }).userId;
  const set = await setUserPassword(userId, password, admin!);
  // Token jest już zużyty – przy błędzie trzeba poprosić o nowy link.
  if (set === "slabe") back("blad", "To hasło jest za słabe. Poproś o nowy link i wybierz dłuższe, np. kilka słów.", "/logowanie/haslo");
  if (set !== "ok") back("blad", "Nie udało się zapisać. Spróbuj ponownie albo zadzwoń do opiekuna Ostoi.", "/logowanie/haslo");
  const target = await destination(userId);
  if (!target) back("blad", "To konto nie jest przypisane do żadnego zakładu. Zadzwoń do opiekuna partnerów Ostoi.");
  await createSession(userId);
  redirect(withMessage(target!, "ok", "Hasło ustawione. Od teraz logujesz się e-mailem i tym hasłem."));
}

export async function loginDemo(formData: FormData) {
  if (!demoModeEnabled()) back("blad", "Logowanie kontami testowymi jest wyłączone.");
  const userId = z.guid().parse(formData.get("userId"));
  // Konta testowe to tylko adresy @….test – prawdziwe konta logują się hasłem, nawet na wersji testowej.
  const [u] = await asServer((tx) => tx<{ email: string | null }[]>`select auth_user_email(${userId}) as email`);
  if (!u?.email?.endsWith(".test")) back("blad", "To konto loguje się e-mailem i hasłem.");
  const target = await destination(userId);
  if (!target) back("blad", "To konto nie jest przypisane do żadnego zakładu. Zadzwoń do opiekuna partnerów Ostoi.");
  await createSession(userId);
  redirect(target!);
}
