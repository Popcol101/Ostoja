"use server";
// Akcje strony dla rodzin (bez logowania). Baza: tylko funkcje security definer w roli anon.
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { after } from "next/server";
import { RedirectType, redirect } from "next/navigation";
import { z } from "zod";
import { asAnon, userFacingDbError } from "@/lib/db";
import { warsawToUtc } from "@/lib/format";
import { withMessage } from "@/lib/messages";
import { processOutbox, sendSms, smsConfig, smsNumber } from "@/lib/notify";
import { DEMO_CODE_COOKIE, smsCodeText } from "@/lib/phone";
import { demoModeEnabled } from "@/lib/session";
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
  const sms = smsConfig();
  const demo = demoModeEnabled();
  if (!sms && !demo) {
    redirect(withMessage(backTo, "blad", "Nie możemy teraz wysłać kodu SMS. Zadzwoń do opiekuna – pomożemy od razu."), RedirectType.replace);
  }

  let started: { draft_id: string; code: string } | null = null;
  let error: string | null = null;
  try {
    [started] = await asAnon((tx) => tx<{ draft_id: string; code: string }[]>`select * from start_inquiry(${tx.json({
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
  if (error || !started) redirect(withMessage(backTo, "blad", error ?? "Sprawdź wpisane dane."), RedirectType.replace);
  await deliverCode(started!.draft_id, started!.code, formatted, backTo);
  redirect(`/oferty/potwierdz?d=${started!.draft_id}`);
}

/** Wysyła kod SMS-em; w wersji testowej bez SMSAPI pokazuje go na ekranie (ciasteczko tylko dla tej przeglądarki). */
async function deliverCode(draftId: string, code: string, phone: string, backTo: string) {
  const sms = smsConfig();
  if (sms) {
    const to = smsNumber(phone);
    const res = to ? await sendSms(to, smsCodeText(code), sms) : { status: "pominieto" as const };
    if (res.status !== "wyslano") {
      redirect(withMessage(backTo, "blad", "Nie możemy teraz wysłać kodu SMS. Zadzwoń do opiekuna – pomożemy od razu."), RedirectType.replace);
    }
    return;
  }
  (await cookies()).set(DEMO_CODE_COOKIE, JSON.stringify({ d: draftId, c: code }), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/oferty/potwierdz",
    maxAge: 10 * 60,
  });
}

type DraftInfo = {
  city_slug: string;
  burial: string;
  ceremony: string;
  place_of_death: string;
  budget: string | null;
  preferred_home_id: string | null;
};

const confirmSchema = z.object({
  d: z.guid(),
  kod: z.string().transform((v) => v.replace(/\D/g, "")),
});

export async function confirmInquiry(formData: FormData) {
  const parsed = confirmSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/zapytanie");
  const { d, kod } = parsed.data!;
  const here = `/oferty/potwierdz?d=${d}`;
  if (!(await rateLimit("kod-sms", 20, 15 * 60 * 1000))) redirect(withMessage(here, "blad", "Zbyt wiele prób. Spróbuj za chwilę."), RedirectType.replace);

  const { info, result } = await asAnon(async (tx) => {
    const [info] = await tx<DraftInfo[]>`select city_slug, burial, ceremony, place_of_death, budget, preferred_home_id from draft_info(${d})`;
    const [result] = await tx<{ status: string; inquiry_id: string | null; attempts_left: number }[]>`select * from confirm_inquiry(${d}, ${kod})`;
    return { info, result };
  });
  if (result.status === "zly") {
    redirect(withMessage(here, "blad", result.attempts_left > 0 ? "Nieprawidłowy kod. Sprawdź SMS i wpisz go jeszcze raz." : "Za dużo prób. Wypełnij formularz jeszcze raz albo zadzwoń do opiekuna."), RedirectType.replace);
  }
  if (result.status !== "ok" || !info) redirect(here, RedirectType.replace);
  (await cookies()).delete({ name: DEMO_CODE_COOKIE, path: "/oferty/potwierdz" });
  after(() => processOutbox()); // push do zakładu od razu, bez czekania na harmonogram
  redirect(
    `/zapytanie/wyslane?${new URLSearchParams({
      miasto: info!.city_slug,
      forma: info!.burial,
      ceremonia: info!.ceremony,
      miejsce: info!.place_of_death,
      dom: info!.preferred_home_id ?? "",
    })}`,
  );
}

export async function resendCode(formData: FormData) {
  const d = z.guid().safeParse(formData.get("d"));
  if (!d.success) redirect("/zapytanie");
  const here = `/oferty/potwierdz?d=${d.data}`;
  if (!(await rateLimit("kod-sms-ponownie", 5, 60 * 60 * 1000))) redirect(withMessage(here, "blad", "Zbyt wiele prób. Spróbuj za chwilę."), RedirectType.replace);
  let row: { code: string; phone: string } | undefined;
  try {
    [row] = await asAnon((tx) => tx<{ code: string; phone: string }[]>`select * from resend_inquiry_code(${d.data})`);
  } catch (e) {
    const message = userFacingDbError(e);
    if (!message) throw e;
    redirect(withMessage(here, "blad", message), RedirectType.replace);
  }
  await deliverCode(d.data, row!.code, row!.phone, here);
  redirect(withMessage(here, "ok", "Wysłaliśmy nowy kod. Poprzedni przestał działać."), RedirectType.replace);
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
