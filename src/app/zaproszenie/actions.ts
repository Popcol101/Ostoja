"use server";
// Przyjęcie zaproszenia do panelu zakładu. Link przychodzi e-mailem, więc jego otwarcie potwierdza adres.
// Nowa osoba ustawia hasło (konto zakładamy razem z hasłem), osoba z kontem w Ostoi potwierdza swoim hasłem.
import { RedirectType, redirect } from "next/navigation";
import { INVITE_TOKEN, demoCreateUser, findAuthUser } from "@/lib/accounts";
import { adminConfig, authConfig, createUserWithPassword, signInWithPassword } from "@/lib/auth";
import { asServer, userFacingDbError } from "@/lib/db";
import { withMessage } from "@/lib/messages";
import { PASSWORD_MESSAGE, isPwned, passwordProblem } from "@/lib/password";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, demoModeEnabled } from "@/lib/session";

export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const here = `/zaproszenie?t=${encodeURIComponent(token)}`;
  const fail = (text: string): never => redirect(withMessage(here, "blad", text), RedirectType.replace);
  if (!INVITE_TOKEN.test(token)) fail("Zaproszenie wygasło albo zostało już użyte");
  if (!(await rateLimit("zaproszenie", 10, 15 * 60 * 1000))) fail("Zbyt wiele prób. Spróbuj za chwilę.");

  const email = await asServer(async (tx) => {
    const [row] = await tx<{ email: string | null }[]>`select invitation_email(${token}) as email`;
    return row?.email ?? null;
  });
  if (!email) fail("Zaproszenie wygasło albo zostało już użyte");

  const auth = authConfig();
  const admin = adminConfig();
  let userId: string;
  if (auth && admin) {
    const password = String(formData.get("password") ?? "");
    const existing = await findAuthUser(email!);
    if (existing) {
      // Konto już jest (np. ta osoba pracuje też w innym zakładzie) – potwierdza swoim hasłem.
      const res = await signInWithPassword(email!, password, auth);
      if (!res.ok) fail(res.reason === "dane" ? "Nieprawidłowe hasło." : "Zbyt wiele prób logowania. Spróbuj ponownie za kwadrans.");
      userId = (res as { userId: string }).userId;
    } else {
      const problem = passwordProblem(password, String(formData.get("repeat") ?? ""), email);
      if (problem) fail(PASSWORD_MESSAGE[problem]);
      if (await isPwned(password)) fail(PASSWORD_MESSAGE.wyciek);
      const created = await createUserWithPassword(email!, password, admin);
      if (!created.ok) {
        fail(
          created.reason === "slabe"
            ? "To hasło jest za słabe. Wybierz dłuższe, np. kilka słów."
            : "Nie udało się przygotować konta. Zadzwoń do opiekuna partnerów Ostoi.",
        );
      }
      userId = (created as { userId: string }).userId;
    }
  } else if (demoModeEnabled()) {
    // Wersja lokalna bez Supabase: konto w nakładce, logowanie od razu (bez hasła).
    userId = await demoCreateUser(email!);
  } else {
    fail("Nie udało się przygotować konta. Zadzwoń do opiekuna partnerów Ostoi.");
  }

  try {
    await asServer((tx) => tx`select accept_invitation(${token}, ${userId!})`);
  } catch (error) {
    const message = userFacingDbError(error);
    if (message) fail(message);
    throw error;
  }
  await createSession(userId!);
  redirect(withMessage("/panel/zapytania", "ok", auth && admin ? "Witaj w panelu Ostoi. Logujesz się tym adresem e-mail i hasłem." : "Witaj w panelu Ostoi."));
}
