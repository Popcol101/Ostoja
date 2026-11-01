"use server";
// Opieka nad grobem – zamówienie bez konta i płatność (na razie tryb testowy, GRAVE_PAYMENTS=test).
import { randomBytes } from "node:crypto";
import { RedirectType, redirect } from "next/navigation";
import { asAnon, asServer, userFacingDbError } from "@/lib/db";
import { graveOrderEmail } from "@/lib/emails";
import { formatPlainDate, formatPln } from "@/lib/format";
import { FREQUENCY_LABEL, graveOrderSchema, itemsFromForm, type Frequency, type GraveService } from "@/lib/grave";
import { mailConfig, sendMail } from "@/lib/mail";
import { withMessage } from "@/lib/messages";
import { rateLimit } from "@/lib/rate-limit";

export async function gravePaymentsMode(): Promise<"test" | null> {
  return process.env.GRAVE_PAYMENTS === "test" ? "test" : null;
}

export async function createGraveOrder(formData: FormData) {
  const BACK = "/groby#zamowienie";
  const raw: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const [k, v] of formData.entries()) raw[k] = k in raw ? ([] as FormDataEntryValue[]).concat(raw[k], v) : v;
  const parsed = graveOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(withMessage(BACK, "blad", parsed.error.issues[0]?.message ?? "Sprawdź wpisane dane."), RedirectType.replace);
  if (!(await rateLimit("grob-zamowienie", 10, 60 * 60 * 1000))) redirect(withMessage(BACK, "blad", "Zbyt wiele prób. Spróbuj za chwilę."), RedirectType.replace);

  const services = await asAnon((tx) => tx<GraveService[]>`select key, label, description, base_price_pln, product_kind from grave_services order by sort_order`);
  const items = itemsFromForm(raw, services);
  if (items.length === 0) redirect(withMessage(BACK, "blad", "Wybierz co najmniej jedną usługę."), RedirectType.replace);
  const d = parsed.data;
  const phone = d.customer_phone ? (d.customer_phone.startsWith("+48") ? d.customer_phone : `+48${d.customer_phone}`).replace(/^\+48(\d{3})(\d{3})(\d{3})$/, "+48 $1 $2 $3") : "";

  let token: string | null = null;
  let error: string | null = null;
  try {
    const [row] = await asServer((tx) => tx<{ token: string }[]>`select create_grave_order(${tx.json({
      cemetery_id: d.cemetery_id,
      deceased_name: d.deceased_name,
      grave_section: d.grave_section,
      grave_row: d.grave_row,
      grave_number: d.grave_number,
      grave_lat: d.grave_lat === null ? "" : String(d.grave_lat),
      grave_lng: d.grave_lng === null ? "" : String(d.grave_lng),
      grave_notes: d.grave_notes,
      customer_name: d.customer_name,
      customer_email: d.customer_email,
      customer_phone: phone,
      items: items as never,
      frequency: d.frequency,
      first_on: d.first_on,
    })}) as token`);
    token = row.token;
  } catch (e) {
    error = userFacingDbError(e);
    if (!error) throw e;
  }
  if (error || !token) redirect(withMessage(BACK, "blad", error ?? "Sprawdź wpisane dane."), RedirectType.replace);
  redirect(`/usluga/${token}`);
}

type Paid = { total_pln: number; first_on: string; frequency: Frequency; deceased_name: string; customer_name: string; customer_email: string; cemetery: { name: string; city: string } };

export async function payGraveOrderTest(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  if (!/^[a-f0-9]{48}$/.test(token)) redirect("/groby");
  const here = `/usluga/${token}`;
  if ((await gravePaymentsMode()) !== "test") redirect(withMessage(here, "blad", "Płatności online ruszą wkrótce."), RedirectType.replace);
  if (!(await rateLimit("grob-platnosc", 20, 60 * 60 * 1000))) redirect(withMessage(here, "blad", "Zbyt wiele prób. Spróbuj za chwilę."), RedirectType.replace);
  let order: Paid | null = null;
  try {
    const [row] = await asServer((tx) => tx<{ o: Paid }[]>`select mark_grave_order_paid(${token}, 'test', ${`TEST-${randomBytes(4).toString("hex")}`}) as o`);
    order = row.o;
  } catch (e) {
    const message = userFacingDbError(e);
    if (!message) throw e;
    redirect(withMessage(here, "blad", message), RedirectType.replace);
  }
  const cfg = mailConfig();
  if (cfg && order) {
    const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
    const m = graveOrderEmail({
      name: order.customer_name,
      deceased: order.deceased_name,
      cemetery: `${order.cemetery.name}, ${order.cemetery.city}`,
      total: formatPln(order.total_pln),
      firstOn: formatPlainDate(order.first_on),
      frequency: FREQUENCY_LABEL[order.frequency],
      link: `${base}/usluga/${token}`,
    });
    await sendMail({ to: order.customer_email, ...m, kind: "opieka" }, cfg);
  }
  redirect(withMessage(here, "ok", "Dziękujemy. Zamówienie jest opłacone – potwierdzenie z linkiem wysłaliśmy e-mailem."), RedirectType.replace);
}
