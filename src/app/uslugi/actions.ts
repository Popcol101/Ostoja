"use server";
// Panel usługodawcy (opieka nad grobami): wykonanie wizyty ze zdjęciem grobu.
import { revalidatePath } from "next/cache";
import { RedirectType, redirect } from "next/navigation";
import { z } from "zod";
import { asServer, userFacingDbError, withUser } from "@/lib/db";
import { graveVisitEmail } from "@/lib/emails";
import { mailConfig, sendMail } from "@/lib/mail";
import { withMessage } from "@/lib/messages";
import { destroySession, requireProvider } from "@/lib/session";

const HOME = "/uslugi";
const MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const back = (kind: "ok" | "blad", text: string): never => redirect(withMessage(HOME, kind, text), RedirectType.replace);

export async function providerLogout() {
  await destroySession();
  redirect("/logowanie");
}

/** Sprawdza sygnaturę pliku, a nie tylko deklarowany typ. */
function sniff(buf: Buffer): string | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export async function completeVisit(formData: FormData) {
  const me = await requireProvider();
  const visitId = z.guid().safeParse(formData.get("visitId"));
  if (!visitId.success) back("blad", "Nieprawidłowy identyfikator");
  const note = z.string().trim().max(300).safeParse(String(formData.get("note") ?? ""));
  if (!note.success) back("blad", "Sprawdź wpisane dane.");
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0 || file.size > 3_000_000 || !MIME.has(file.type)) {
    back("blad", "Dodaj zdjęcie grobu (JPG, PNG albo WebP, do 3 MB).");
  }
  const buf = Buffer.from(await (file as File).arrayBuffer());
  const mime = sniff(buf);
  if (!mime) back("blad", "Dodaj zdjęcie grobu (JPG, PNG albo WebP, do 3 MB).");

  try {
    await withUser(me.userId, (tx) => tx`select complete_grave_visit(${visitId.data!}, ${buf}, ${mime!}, ${note.data!})`);
  } catch (e) {
    const message = userFacingDbError(e);
    if (message) back("blad", message);
    throw e;
  }
  const cfg = mailConfig();
  if (cfg) {
    const [c] = await asServer((tx) => tx<{ token: string; customer_email: string; customer_name: string; deceased_name: string }[]>`
      select * from grave_order_contact(${visitId.data!})`);
    if (c) {
      const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
      await sendMail({ to: c.customer_email, ...graveVisitEmail({ name: c.customer_name, deceased: c.deceased_name, link: `${base}/usluga/${c.token}` }), kind: "opieka" }, cfg);
    }
  }
  revalidatePath(HOME);
  back("ok", "Wizyta zapisana. Klient dostał zdjęcie.");
}
