"use server";
// Akcje panelu administratora Ostoi. Każda: sesja administratora → zod → funkcja bazy, która sama
// sprawdza uprawnienia (assert_platform_admin) i zapisuje działanie w dzienniku admin_audit.
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { RedirectType, redirect } from "next/navigation";
import { z } from "zod";
import { userFacingDbError, withUser } from "@/lib/db";
import { slugify } from "@/lib/format";
import { withMessage } from "@/lib/messages";
import { requireAdmin } from "@/lib/session";
import { INVITE_COOKIE } from "@/lib/team";

const back = (path: string, kind: "ok" | "blad", text: string): never => redirect(withMessage(path, kind, text), RedirectType.replace);

async function attempt<T>(path: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const message = userFacingDbError(error);
    if (message) back(path, "blad", message);
    throw error;
  }
}

const homeSchema = z.object({
  name: z.string().trim().min(3, { message: "Podaj nazwę zakładu" }).max(120),
  nip: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().length(10, { message: "NIP ma 10 cyfr" })),
  city_slug: z.string().regex(/^[a-z-]{2,40}$/),
  address: z.string().trim().min(5, { message: "Podaj adres" }).max(200),
  phone: z.string().trim().regex(/^\+?[0-9 ]{9,16}$/, { message: "Podaj poprawny numer telefonu" }),
  email: z.string().trim().toLowerCase().pipe(z.email({ message: "Podaj poprawny e-mail" })),
  description: z.string().trim().max(1000).optional().default(""),
  service_radius_km: z.coerce.number().int().min(1).max(200).default(25),
  has_farewell_hall: z.literal("tak").optional(),
  lat: z.union([z.literal(""), z.coerce.number().min(49).max(55)]).optional(),
  lng: z.union([z.literal(""), z.coerce.number().min(14).max(25)]).optional(),
});

export async function createHome(formData: FormData) {
  const admin = await requireAdmin();
  const PATH = "/admin/zaklady/nowy";
  const parsed = homeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(PATH, "blad", parsed.error.issues[0]?.message ?? "Sprawdź wpisane dane.");
  const d = parsed.data!;
  const id = await attempt(PATH, () =>
    withUser(admin.userId, async (tx) => {
      const [row] = await tx<{ id: string }[]>`select admin_create_home(${tx.json({
        ...d,
        slug: slugify(d.name),
        has_farewell_hall: d.has_farewell_hall === "tak",
        lat: d.lat === "" || d.lat === undefined ? "" : String(d.lat),
        lng: d.lng === "" || d.lng === undefined ? "" : String(d.lng),
      })}) as id`;
      return row.id;
    }),
  );
  revalidatePath("/admin");
  back(`/admin/zaklady/${id}`, "ok", "Zakład dodany. Uzupełnij zaproszenie dla właściciela, a po sprawdzeniu dokumentów zweryfikuj zakład.");
}

export async function setVerified(formData: FormData) {
  const admin = await requireAdmin();
  const home = z.guid().parse(formData.get("homeId"));
  const path = `/admin/zaklady/${home}`;
  await attempt(path, () => withUser(admin.userId, (tx) => tx`select admin_set_verified(${home}, true)`));
  revalidatePath("/admin");
  revalidatePath(path);
  back(path, "ok", "Zakład zweryfikowany. Rodziny widzą go na liście ofert.");
}

const GROUNDS = ["dokumenty", "ceny", "skargi", "umowa", "na_wniosek", "inne"] as const;
const suspendSchema = z.object({
  homeId: z.guid(),
  ground: z.enum(GROUNDS, { message: "Sprawdź wpisane dane." }),
  reason: z.string().trim().min(20, { message: "Opisz konkretne fakty (co najmniej 20 znaków)" }).max(1000),
});

/** Wstrzymanie zakładu (P2B art. 4): podstawa z zasad dla partnerów i konkretne fakty, które zobaczy zakład. */
export async function suspendHome(formData: FormData) {
  const admin = await requireAdmin();
  const raw = Object.fromEntries(formData);
  const homeId = z.guid().parse(raw.homeId);
  const path = `/admin/zaklady/${homeId}`;
  const parsed = suspendSchema.safeParse(raw);
  if (!parsed.success) back(path, "blad", parsed.error.issues[0]?.message ?? "Sprawdź wpisane dane.");
  const d = parsed.data!;
  await attempt(path, () =>
    withUser(admin.userId, (tx) => tx`select admin_suspend_home(${homeId}, ${d.ground}::suspension_ground, ${d.reason})`),
  );
  revalidatePath("/admin");
  revalidatePath(path);
  back(path, "ok", "Zakład wstrzymany. Uzasadnienie widzi właściciel w panelu i może się odwołać.");
}

const answerSchema = z.object({
  appealId: z.guid(),
  decision: z.enum(["przywroc", "utrzymaj"], { message: "Sprawdź wpisane dane." }),
  answer: z.string().trim().min(20, { message: "Uzasadnij odpowiedź (co najmniej 20 znaków)" }).max(2000),
});

export async function answerAppeal(formData: FormData) {
  const admin = await requireAdmin();
  const PATH = "/admin/odwolania";
  const parsed = answerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(PATH, "blad", parsed.error.issues[0]?.message ?? "Sprawdź wpisane dane.");
  const d = parsed.data!;
  await attempt(PATH, () =>
    withUser(admin.userId, (tx) => tx`select admin_answer_appeal(${d.appealId}, ${d.decision === "przywroc"}, ${d.answer})`),
  );
  revalidatePath("/admin", "layout");
  back(PATH, "ok", "Odpowiedź zapisana. Zakład widzi ją w panelu.");
}

const inviteSchema = z.object({
  homeId: z.guid(),
  display_name: z.string().trim().min(2, { message: "Podaj imię i nazwisko" }).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email({ message: "Podaj poprawny e-mail" }).max(200)),
  role: z.enum(["wlasciciel", "biuro", "ekipa"]),
});

export async function inviteToHome(formData: FormData) {
  const admin = await requireAdmin();
  const raw = Object.fromEntries(formData);
  const homeId = z.guid().parse(raw.homeId);
  const path = `/admin/zaklady/${homeId}`;
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) back(path, "blad", parsed.error.issues[0]?.message ?? "Sprawdź wpisane dane.");
  const d = parsed.data!;
  const token = await attempt(path, () =>
    withUser(admin.userId, async (tx) => {
      const [row] = await tx<{ token: string }[]>`select admin_invite(${homeId}, ${d.email}, ${d.role}::member_role, ${d.display_name}) as token`;
      return row.token;
    }),
  );
  (await cookies()).set(INVITE_COOKIE, JSON.stringify({ token, name: d.display_name, email: d.email }), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path,
    maxAge: 15 * 60,
  });
  revalidatePath(path);
  back(path, "ok", "Zaproszenie gotowe. Wyślij link tej osobie – działa 7 dni.");
}

export async function markHandled(formData: FormData) {
  const admin = await requireAdmin();
  const PATH = "/admin/zapytania";
  const id = z.guid().parse(formData.get("inquiryId"));
  const note = z.string().trim().max(500).parse(String(formData.get("note") ?? ""));
  await attempt(PATH, () => withUser(admin.userId, (tx) => tx`select admin_mark_handled(${id}, ${note})`));
  revalidatePath(PATH);
  back(PATH, "ok", "Zapytanie oznaczone jako obsłużone.");
}
