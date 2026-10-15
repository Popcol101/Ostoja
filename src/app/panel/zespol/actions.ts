"use server";
// Zespół zakładu: zaproszenia, odwoływanie, odbieranie dostępu. Uprawnienia sprawdza baza (funkcje security definer).
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { RedirectType, redirect } from "next/navigation";
import { z } from "zod";
import { userFacingDbError, withUser } from "@/lib/db";
import { withMessage } from "@/lib/messages";
import { requireMember } from "@/lib/session";
import { INVITE_COOKIE } from "@/lib/team";

const PATH = "/panel/zespol";

const back = (kind: "ok" | "blad", text: string): never => redirect(withMessage(PATH, kind, text), RedirectType.replace);

async function attempt<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const message = userFacingDbError(error);
    if (message) back("blad", message);
    throw error;
  }
}

const inviteSchema = z.object({
  display_name: z.string().trim().min(2, { message: "Podaj imię i nazwisko" }).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email({ message: "Podaj poprawny e-mail" }).max(200)),
  role: z.enum(["wlasciciel", "biuro", "ekipa"]),
});

export async function inviteMember(formData: FormData) {
  const me = await requireMember();
  if (me.role !== "wlasciciel") back("blad", "Zapraszać może tylko właściciel zakładu");
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("blad", parsed.error.issues[0]?.message ?? "Sprawdź wpisane dane.");
  const d = parsed.data!;
  const token = await attempt(() =>
    withUser(me.userId, async (tx) => {
      const [row] = await tx<{ token: string }[]>`select create_invitation(${d.email}, ${d.role}::member_role, ${d.display_name}) as token`;
      return row.token;
    }),
  );
  const jar = await cookies();
  jar.set(INVITE_COOKIE, JSON.stringify({ token, name: d.display_name, email: d.email }), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: PATH,
    maxAge: 15 * 60,
  });
  revalidatePath(PATH);
  back("ok", "Zaproszenie gotowe. Wyślij link tej osobie – działa 7 dni.");
}

export async function revokeInvitation(formData: FormData) {
  const me = await requireMember();
  const id = z.guid().parse(formData.get("id"));
  await attempt(() => withUser(me.userId, (tx) => tx`select revoke_invitation(${id})`));
  (await cookies()).delete({ name: INVITE_COOKIE, path: PATH });
  revalidatePath(PATH);
  back("ok", "Zaproszenie odwołane. Link przestał działać.");
}

export async function removeMember(formData: FormData) {
  const me = await requireMember();
  const userId = z.guid().parse(formData.get("userId"));
  if (formData.get("confirm") !== "tak") back("blad", "Sprawdź wpisane dane.");
  await attempt(() => withUser(me.userId, (tx) => tx`select remove_member(${userId})`));
  revalidatePath(PATH);
  back("ok", "Dostęp odebrany.");
}
