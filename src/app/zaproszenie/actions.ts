"use server";
// Przyjęcie zaproszenia do panelu zakładu (osoba bez konta, z linkiem od właściciela).
import { RedirectType, redirect } from "next/navigation";
import { INVITE_TOKEN, adminConfig, ensureAuthUser } from "@/lib/accounts";
import { authConfig, requestMagicLink } from "@/lib/auth";
import { asAnon, userFacingDbError } from "@/lib/db";
import { withMessage } from "@/lib/messages";
import { rateLimit } from "@/lib/rate-limit";
import { createSession, demoModeEnabled } from "@/lib/session";

export async function acceptInvitation(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const here = `/zaproszenie?t=${encodeURIComponent(token)}`;
  const fail = (text: string): never => redirect(withMessage(here, "blad", text), RedirectType.replace);
  if (!INVITE_TOKEN.test(token)) fail("Zaproszenie wygasło albo zostało już użyte");
  if (!(await rateLimit("zaproszenie", 10, 15 * 60 * 1000))) fail("Zbyt wiele prób. Spróbuj za chwilę.");

  const email = await asAnon(async (tx) => {
    const [row] = await tx<{ email: string | null }[]>`select invitation_email(${token}) as email`;
    return row?.email ?? null;
  });
  if (!email) fail("Zaproszenie wygasło albo zostało już użyte");

  const auth = authConfig();
  const account = await ensureAuthUser(email!, { admin: adminConfig(), demo: demoModeEnabled() && !auth });
  if (!account.ok) fail("Nie udało się przygotować konta. Zadzwoń do opiekuna partnerów Ostoi.");
  const userId = (account as { userId: string }).userId;

  try {
    await asAnon((tx) => tx`select accept_invitation(${token}, ${userId})`);
  } catch (error) {
    const message = userFacingDbError(error);
    if (message) fail(message);
    throw error;
  }

  if (auth) {
    // Zaproszenie nie dowodzi, że link otworzył właściciel adresu – logujemy linkiem wysłanym na ten e-mail.
    await requestMagicLink(email!, auth);
    redirect(withMessage("/logowanie", "ok", "Zaproszenie przyjęte. Wysłaliśmy link logowania na Twój e-mail – działa godzinę."));
  }
  // Wersja testowa bez Supabase: od razu do panelu.
  await createSession(userId);
  redirect(withMessage("/panel/zapytania", "ok", "Witaj w panelu Ostoi."));
}
