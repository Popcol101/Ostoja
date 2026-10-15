import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { withUser } from "./db";

const COOKIE = "ostoja_sesja";
const MAX_AGE_S = 60 * 60 * 12;

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET musi mieć co najmniej 32 znaki");
  return new TextEncoder().encode(value);
}

export function demoModeEnabled() {
  return process.env.DEMO_MODE === "true";
}

export async function createSession(userId: string) {
  const token = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function destroySession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function getUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

export type Membership = {
  userId: string;
  homeId: string;
  homeName: string;
  role: "wlasciciel" | "biuro" | "ekipa";
  displayName: string;
  acceptingToday: boolean;
};

/** Sesja pracownika zakładu z członkostwem; bez sesji przekierowuje na logowanie. */
export async function requireMember(): Promise<Membership> {
  const userId = await getUserId();
  if (!userId) redirect("/logowanie");
  const rows = await withUser(userId, (tx) => tx<
    { home_id: string; name: string; role: Membership["role"]; display_name: string; accepting_today: boolean }[]
  >`
    select m.home_id, h.name, m.role, m.display_name, h.accepting_today
    from memberships m join funeral_homes h on h.id = m.home_id
    where m.user_id = ${userId}
    limit 1`);
  const m = rows[0];
  if (!m) redirect("/logowanie?blad=brak-zakladu");
  return {
    userId,
    homeId: m.home_id,
    homeName: m.name,
    role: m.role,
    displayName: m.display_name,
    acceptingToday: m.accepting_today,
  };
}

export type Admin = { userId: string; displayName: string };

/** Sesja administratora Ostoi (tabela platform_admins); inaczej przekierowuje na logowanie. */
export async function requireAdmin(): Promise<Admin> {
  const userId = await getUserId();
  if (!userId) redirect("/logowanie");
  const [row] = await withUser(userId, (tx) => tx<{ name: string | null }[]>`select admin_me() as name`);
  if (!row?.name) redirect("/logowanie?blad=brak-uprawnien-admina");
  return { userId, displayName: row.name };
}
