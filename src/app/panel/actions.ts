"use server";
// Akcje serwerowe panelu zakładu. Każda: sesja → walidacja zod → zapytanie przez withUser (RLS).
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { RedirectType, redirect } from "next/navigation";
import { z } from "zod";
import { userFacingDbError, withUser } from "@/lib/db";
import { slugify, warsawToUtc } from "@/lib/format";
import { withMessage } from "@/lib/messages";
import { processOutbox } from "@/lib/notify";
import { destroySession, requireMember } from "@/lib/session";

const uuid = z.guid({ message: "Nieprawidłowy identyfikator" });

function back(path: string, message: string, kind: "blad" | "ok" = "blad"): never {
  redirect(withMessage(path, kind, message), RedirectType.replace);
}

/** Wykonuje operację; błąd biznesowy z bazy wraca na stronę jako komunikat, inne błędy lecą dalej. */
async function attempt<T>(fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    const message = userFacingDbError(error);
    if (message) return { ok: false, message };
    throw error;
  }
}

export async function logout() {
  await destroySession();
  redirect("/logowanie");
}

export async function toggleAccepting() {
  const me = await requireMember();
  await withUser(me.userId, (tx) => tx`update funeral_homes set accepting_today = not accepting_today where id = ${me.homeId}`);
  revalidatePath("/panel", "layout");
}

// Zapytania ---------------------------------------------------------------

export async function acceptOffer(formData: FormData) {
  const me = await requireMember();
  const offerId = uuid.parse(formData.get("offerId"));
  const res = await attempt(() =>
    withUser(me.userId, async (tx) => {
      const [row] = await tx<{ order_id: string }[]>`select accept_offer(${offerId}) as order_id`;
      return row.order_id;
    }),
  );
  if (!res.ok) back("/panel/zapytania", res.message);
  redirect(withMessage(`/panel/zlecenia/${res.value}`, "ok", "Zapytanie przyjęte. Zadzwoń teraz do rodziny."));
}

export async function declineOffer(formData: FormData) {
  const me = await requireMember();
  const offerId = uuid.parse(formData.get("offerId"));
  const res = await attempt(() => withUser(me.userId, (tx) => tx`select decline_offer(${offerId})`));
  if (!res.ok) back("/panel/zapytania", res.message);
  after(() => processOutbox()); // zapytanie poszło do kolejnych zakładów – powiadom je od razu
  revalidatePath("/panel/zapytania");
  back("/panel/zapytania", "Zapytanie trafi do innego zakładu.", "ok");
}

// Karta zlecenia ------------------------------------------------------------

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

const deceasedSchema = z.object({
  orderId: uuid,
  deceased_first_name: optionalText(80),
  deceased_last_name: optionalText(80),
  born_on: z.union([z.literal(""), z.iso.date()]).transform((v) => v || null),
  died_date: z.union([z.literal(""), z.iso.date()]),
  died_time: z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)]),
  notes: optionalText(2000),
});

export async function updateOrderDetails(formData: FormData) {
  const me = await requireMember();
  const parsed = deceasedSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back(`/panel/zlecenia/${formData.get("orderId")}`, "Sprawdź daty i długość pól.");
  const d = parsed.data;
  const diedAt = d.died_date ? warsawToUtc(d.died_date, d.died_time || "12:00") : null;
  await withUser(me.userId, (tx) => tx`
    update orders set
      deceased_first_name = ${d.deceased_first_name},
      deceased_last_name = ${d.deceased_last_name},
      born_on = ${d.born_on},
      died_at = ${diedAt},
      notes = ${d.notes}
    where id = ${d.orderId}`);
  revalidatePath(`/panel/zlecenia/${d.orderId}`);
  back(`/panel/zlecenia/${d.orderId}`, "Zapisano dane.", "ok");
}

export async function toggleTask(formData: FormData) {
  const me = await requireMember();
  const taskId = uuid.parse(formData.get("taskId"));
  const orderId = uuid.parse(formData.get("orderId"));
  await withUser(me.userId, (tx) => tx`update order_tasks set done = not done where id = ${taskId}`);
  revalidatePath(`/panel/zlecenia/${orderId}`);
}

export async function signContract(formData: FormData) {
  const me = await requireMember();
  const orderId = uuid.parse(formData.get("orderId"));
  if (formData.get("confirm") !== "tak") back(`/panel/zlecenia/${orderId}`, "Zaznacz potwierdzenie podpisania umowy.");
  const res = await attempt(() =>
    withUser(me.userId, (tx) => tx`update orders set contract_signed_at = now() where id = ${orderId} and contract_signed_at is null`),
  );
  if (!res.ok) back(`/panel/zlecenia/${orderId}`, res.message);
  revalidatePath(`/panel/zlecenia/${orderId}`);
  back(`/panel/zlecenia/${orderId}`, "Umowa oznaczona jako podpisana.", "ok");
}

const stageSchema = z.object({
  orderId: uuid,
  stage: z.enum(["przyjete", "umowa", "odbior", "ceremonia", "rozliczenie", "zamkniete"]),
});

export async function setStage(formData: FormData) {
  const me = await requireMember();
  const { orderId, stage } = stageSchema.parse(Object.fromEntries(formData));
  await withUser(me.userId, (tx) => tx`update orders set stage = ${stage} where id = ${orderId}`);
  revalidatePath(`/panel/zlecenia/${orderId}`);
}

export async function publishMemorial(formData: FormData) {
  const me = await requireMember();
  const orderId = uuid.parse(formData.get("orderId"));
  const publish = formData.get("publish") === "tak";
  const note = z.string().trim().max(600).parse(formData.get("memorial_note") ?? "");
  const res = await attempt(() =>
    withUser(me.userId, async (tx) => {
      const [o] = await tx<{ first: string | null; last: string | null; slug: string | null }[]>`
        select deceased_first_name as first, deceased_last_name as last, memorial_slug as slug from orders where id = ${orderId}`;
      if (!o?.first || !o?.last) throw Object.assign(new Error("Najpierw uzupełnij imię i nazwisko zmarłego."), { code: "P0001" });
      const slug = o.slug ?? `${slugify(`${o.first} ${o.last}`)}-${orderId.slice(0, 4)}`;
      await tx`update orders set memorial_slug = ${slug}, memorial_published = ${publish}, memorial_note = ${note || null} where id = ${orderId}`;
    }),
  );
  if (!res.ok) back(`/panel/zlecenia/${orderId}`, res.message);
  revalidatePath(`/panel/zlecenia/${orderId}`);
  back(`/panel/zlecenia/${orderId}`, publish ? "Strona pamięci jest opublikowana." : "Zapisano stronę pamięci.", "ok");
}

// Kalendarz -------------------------------------------------------------------

const eventSchema = z.object({
  orderId: z.union([z.literal(""), uuid]).transform((v) => v || null),
  kind: z.enum(["odbior", "kremacja", "ceremonia", "pochowek", "spotkanie", "inne"]),
  title: optionalText(120),
  date: z.iso.date({ message: "Podaj datę" }),
  time: z.string().regex(/^\d{2}:\d{2}$/, { message: "Podaj godzinę" }),
  minutes: z.coerce.number().int().min(15).max(600),
  place: optionalText(160),
  resourceId: z.union([z.literal(""), uuid]).transform((v) => v || null),
  status: z.enum(["wstepny", "potwierdzony"]),
  returnTo: z.string().startsWith("/panel/"),
});

const KIND_TITLE: Record<string, string> = {
  odbior: "Odbiór",
  kremacja: "Kremacja",
  ceremonia: "Ceremonia",
  pochowek: "Pochówek",
  spotkanie: "Spotkanie",
  inne: "Wpis",
};

export async function addEvent(formData: FormData) {
  const me = await requireMember();
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  const returnTo = typeof formData.get("returnTo") === "string" ? String(formData.get("returnTo")) : "/panel/kalendarz";
  if (!parsed.success) back(returnTo.startsWith("/panel/") ? returnTo : "/panel/kalendarz", parsed.error.issues[0]?.message ?? "Sprawdź dane terminu.");
  const e = parsed.data;
  const start = warsawToUtc(e.date, e.time);
  const end = new Date(start.getTime() + e.minutes * 60_000);

  const res = await attempt(() =>
    withUser(me.userId, async (tx) => {
      let title = e.title;
      if (!title) {
        const [o] = e.orderId
          ? await tx<{ name: string | null }[]>`
              select nullif(trim(coalesce(deceased_first_name,'') || ' ' || coalesce(deceased_last_name,'')), '') as name
              from orders where id = ${e.orderId}`
          : [{ name: null }];
        title = o?.name ? `${KIND_TITLE[e.kind]}: ${o.name}` : KIND_TITLE[e.kind];
      }
      const [ev] = await tx<{ id: string }[]>`
        insert into events (home_id, order_id, kind, title, status, during, place)
        values (${me.homeId}, ${e.orderId}, ${e.kind}, ${title}, ${e.status},
                tstzrange(${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz), ${e.place})
        returning id`;
      if (e.resourceId) {
        await tx`insert into bookings (event_id, resource_id, home_id, during)
                 values (${ev.id}, ${e.resourceId}, ${me.homeId}, '[,]')`;
      }
    }),
  );
  if (!res.ok) back(e.returnTo, res.message);
  revalidatePath(e.returnTo);
  back(e.returnTo, "Dodano termin.", "ok");
}

export async function setEventStatus(formData: FormData) {
  const me = await requireMember();
  const eventId = uuid.parse(formData.get("eventId"));
  const status = z.enum(["wstepny", "potwierdzony", "odwolany"]).parse(formData.get("status"));
  const returnTo = z.string().startsWith("/panel/").parse(formData.get("returnTo"));
  await withUser(me.userId, (tx) => tx`update events set status = ${status} where id = ${eventId}`);
  revalidatePath(returnTo);
}

// Profil i cennik ---------------------------------------------------------------

const profileSchema = z.object({
  phone: z.string().trim().regex(/^\+?[0-9 ]{9,16}$/, { message: "Podaj poprawny numer telefonu" }),
  email: z.email({ message: "Podaj poprawny e-mail" }),
  address: z.string().trim().min(5).max(160),
  description: optionalText(600),
  service_radius_km: z.coerce.number().int().min(1).max(200),
  has_farewell_hall: z.literal("tak").optional(),
});

export async function updateProfile(formData: FormData) {
  const me = await requireMember();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("/panel/profil", parsed.error.issues[0]?.message ?? "Sprawdź dane profilu.");
  const p = parsed.data;
  await withUser(me.userId, (tx) => tx`
    update funeral_homes set phone = ${p.phone}, email = ${p.email}, address = ${p.address},
      description = ${p.description}, service_radius_km = ${p.service_radius_km},
      has_farewell_hall = ${p.has_farewell_hall === "tak"}
    where id = ${me.homeId}`);
  revalidatePath("/panel/profil");
  back("/panel/profil", "Zapisano profil.", "ok");
}

export async function updatePrices(formData: FormData) {
  const me = await requireMember();
  const entries = [...formData.entries()].filter(([k]) => k.startsWith("price:"));
  const rows: { key: string; price: number | null }[] = [];
  for (const [k, v] of entries) {
    const raw = String(v).replace(/\s/g, "").replace(",", ".");
    if (raw === "") {
      rows.push({ key: k.slice(6), price: null });
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 100000) back("/panel/profil", "Ceny muszą być liczbami od 0 do 100 000 zł.");
    rows.push({ key: k.slice(6), price: Math.round(n * 100) / 100 });
  }
  await withUser(me.userId, async (tx) => {
    for (const r of rows) {
      if (r.price === null) {
        await tx`delete from price_items where home_id = ${me.homeId} and item_key = ${r.key}`;
      } else {
        await tx`insert into price_items (home_id, item_key, price_pln) values (${me.homeId}, ${r.key}, ${r.price})
                 on conflict (home_id, item_key) do update set price_pln = excluded.price_pln`;
      }
    }
  });
  revalidatePath("/panel/profil");
  back("/panel/profil", "Zapisano cennik.", "ok");
}

// --- Powiadomienia -------------------------------------------------------------------------

export async function sendFamilySms(formData: FormData) {
  const me = await requireMember();
  const orderId = uuid.parse(formData.get("orderId"));
  const res = await attempt(() => withUser(me.userId, (tx) => tx`select queue_family_sms(${orderId})`));
  if (!res.ok) back(`/panel/zlecenia/${orderId}`, res.message);
  after(() => processOutbox());
  revalidatePath(`/panel/zlecenia/${orderId}`);
  back(`/panel/zlecenia/${orderId}`, "SMS z linkiem jest w drodze do rodziny.", "ok");
}

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(40).max(200), auth: z.string().min(10).max(100) }),
});

/** Zapisuje subskrypcję push tego urządzenia (wywoływane z przeglądarki po zgodzie użytkownika). */
export async function savePushSubscription(raw: unknown, device: string): Promise<{ ok: boolean }> {
  const me = await requireMember();
  const parsed = subscriptionSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  const { endpoint, keys } = parsed.data;
  await withUser(me.userId, (tx) => tx`
    insert into push_subscriptions (user_id, home_id, endpoint, p256dh, auth, device)
    values (${me.userId}, ${me.homeId}, ${endpoint}, ${keys.p256dh}, ${keys.auth}, ${device.slice(0, 120)})
    on conflict (endpoint) do nothing`);
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const me = await requireMember();
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { ok: false };
  await withUser(me.userId, (tx) => tx`delete from push_subscriptions where endpoint = ${endpoint}`);
  return { ok: true };
}
