"use server";
// Akcje strony dla rodzin (bez logowania). Baza: tylko funkcje security definer w roli anon.
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { RedirectType, redirect } from "next/navigation";
import { z } from "zod";
import { asAnon, userFacingDbError } from "@/lib/db";
import { warsawToUtc } from "@/lib/format";
import { withMessage } from "@/lib/messages";
import { processOutbox } from "@/lib/notify";
import { rateLimit } from "@/lib/rate-limit";

const inquirySchema = z.object({
  miasto: z.string().min(2).max(40),
  forma: z.enum(["tradycyjny", "kremacja", "nie_wiem"]),
  ceremonia: z.enum(["religijna", "swiecka", "bez"]),
  miejsce: z.enum(["szpital", "dom", "dps"]),
  budzet: z.enum(["zasilek", "srednio", "wiecej", "nie_wiem"]).optional().or(z.literal("")),
  dom: z.union([z.literal(""), z.guid()]).optional(),
  contact_name: z.string().trim().min(2, { message: "Podaj imię i nazwisko" }).max(120),
  contact_phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[^\d+]/g, ""))
    .pipe(z.string().regex(/^(\+48)?\d{9}$/, { message: "Podaj numer telefonu, np. 600 100 200" })),
  goscie: z.union([z.literal(""), z.coerce.number().int().min(1).max(2000)]).optional(),
  zgoda: z.literal("tak", { message: "Potrzebujemy zgody, żeby przekazać Twój numer zakładowi" }),
});

export async function createInquiry(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const backTo = `/oferty/kontakt?${new URLSearchParams({
    miasto: String(raw.miasto ?? ""),
    forma: String(raw.forma ?? ""),
    ceremonia: String(raw.ceremonia ?? ""),
    miejsce: String(raw.miejsce ?? ""),
    budzet: String(raw.budzet ?? ""),
    dom: String(raw.dom ?? ""),
  })}`;

  const parsed = inquirySchema.safeParse(raw);
  if (!parsed.success) redirect(withMessage(backTo, "blad", parsed.error.issues[0]?.message ?? "Sprawdź wpisane dane."), RedirectType.replace);
  if (!(await rateLimit("zapytanie", 5, 60 * 60 * 1000))) {
    redirect(withMessage(backTo, "blad", "Wysłano już kilka zapytań. Zadzwoń do opiekuna – pomożemy od razu."), RedirectType.replace);
  }

  const d = parsed.data;
  const phone = d.contact_phone.startsWith("+48") ? d.contact_phone : `+48${d.contact_phone}`;
  const formatted = phone.replace(/^\+48(\d{3})(\d{3})(\d{3})$/, "+48 $1 $2 $3");
  let error: string | null = null;
  try {
    await asAnon((tx) => tx`select create_inquiry(${tx.json({
      city_slug: d.miasto,
      burial: d.forma,
      ceremony: d.ceremonia,
      place_of_death: d.miejsce,
      budget: d.budzet || "",
      guests_estimate: d.goscie === "" || d.goscie === undefined ? "" : String(d.goscie),
      contact_name: d.contact_name,
      contact_phone: formatted,
      preferred_home_id: d.dom || "",
    })})`);
  } catch (e) {
    error = userFacingDbError(e);
    if (!error) throw e;
  }
  if (error) redirect(withMessage(backTo, "blad", error), RedirectType.replace);
  after(() => processOutbox()); // push do zakładu od razu, bez czekania na harmonogram
  redirect(
    `/zapytanie/wyslane?${new URLSearchParams({ miasto: d.miasto, forma: d.forma, ceremonia: d.ceremonia, miejsce: d.miejsce, dom: d.dom ?? "" })}`,
  );
}

const familySchema = z.object({
  token: z.string().regex(/^[a-z0-9-]{20,80}$/),
  deceased_first_name: z.string().trim().max(80),
  deceased_last_name: z.string().trim().max(80),
  born_on: z.union([z.literal(""), z.iso.date()]),
  died_date: z.union([z.literal(""), z.iso.date()]),
  died_time: z.union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/)]),
  principal_email: z.union([z.literal(""), z.email({ message: "Podaj poprawny e-mail" })]),
  zus_bank_account: z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .pipe(z.union([z.literal(""), z.string().length(26, { message: "Numer konta ma 26 cyfr" })])),
});

export async function familyUpdate(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const token = String(raw.token ?? "");
  const parsed = familySchema.safeParse(raw);
  if (!parsed.success) redirect(withMessage(`/r/${encodeURIComponent(token)}`, "blad", parsed.error.issues[0]?.message ?? "Sprawdź wpisane dane."), RedirectType.replace);
  if (!(await rateLimit("rodzina", 60, 60 * 60 * 1000))) redirect(withMessage(`/r/${token}`, "blad", "Zbyt wiele prób. Spróbuj za chwilę."), RedirectType.replace);

  const d = parsed.data;
  const patch: Record<string, unknown> = {
    deceased_first_name: d.deceased_first_name,
    deceased_last_name: d.deceased_last_name,
    born_on: d.born_on,
    died_at: d.died_date ? warsawToUtc(d.died_date, d.died_time || "12:00").toISOString() : "",
    principal_email: d.principal_email,
    zus_bank_account: d.zus_bank_account,
    family_consents: {
      dane_do_dokumentow: formData.get("zgoda_dane") === "tak",
      wniosek_przez_zaklad: formData.get("zgoda_zasilek") === "tak",
    },
  };
  if (formData.get("edytuj_uslugi") === "tak") patch.selected_items = formData.getAll("dodatki").map(String);

  let error: string | null = null;
  try {
    await asAnon((tx) => tx`select family_update_order(${d.token}, ${tx.json(patch as never)})`);
  } catch (e) {
    error = userFacingDbError(e);
    if (!error) throw e;
  }
  revalidatePath(`/r/${d.token}`);
  if (error) redirect(withMessage(`/r/${d.token}`, "blad", error), RedirectType.replace);
  redirect(withMessage(`/r/${d.token}`, "ok", "Dziękujemy. Zakład widzi już te informacje."), RedirectType.replace);
}
