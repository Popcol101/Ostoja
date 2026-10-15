import { Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { SiteFooter, SiteHeader } from "@/components/site";
import { Field, Input } from "@/components/ui";
import { createInquiry } from "@/app/rodzina-actions";
import { asAnon } from "@/lib/db";
import { parseSearch, toQuery } from "@/lib/family-params";
import { formatPln } from "@/lib/format";
import { BURIAL_LABEL, CEREMONY_LABEL, PLACE_LABEL } from "@/lib/labels";

export const metadata: Metadata = { title: "Prośba o kontakt – Ostoja" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function KontaktPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const parsed = parseSearch(sp);
  if (!parsed.success) redirect("/zapytanie");
  const input = parsed.data;
  const domRaw = Array.isArray(sp.dom) ? sp.dom[0] : sp.dom;
  const dom = domRaw && UUID.test(domRaw) ? domRaw : "";

  const home = dom
    ? await asAnon(async (tx) => {
        const [h] = await tx<{ name: string; quote_pln: number }[]>`
          select name, quote_pln from search_homes(${input.miasto}, ${input.forma}::burial_type, ${input.ceremonia}::ceremony_type)
          where home_id = ${dom}`;
        return h ?? null;
      })
    : null;

  const back = `/oferty?${toQuery({ miasto: input.miasto, forma: input.forma, ceremonia: input.ceremonia, miejsce: input.miejsce, budzet: input.budzet })}`;

  return (
    <div className="flex min-h-dvh flex-col bg-ground-family">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6">
        <Link href={back} className="inline-flex min-h-11 items-center text-[15px] font-semibold text-brand">
          Wróć do ofert
        </Link>
        <h1 className="font-serif text-[30px] leading-tight">
          {home ? `Zakład ${home.name} oddzwoni do Ciebie` : "Oddzwoni najbliższy wolny zakład"}
        </h1>
        <p className="mt-2 text-muted">
          {home
            ? `Zakład ma 15 minut na odpowiedź. Jeśli nie zdąży, przekażemy zapytanie do kolejnego najbliższego zakładu.`
            : "Wyślemy zapytanie do trzech najbliższych zakładów. Twój numer dostanie tylko ten, który przyjmie zapytanie jako pierwszy."}
        </p>

        <div className="mt-4 rounded-xl border border-line bg-card px-4 py-3 text-[15px]">
          <p className="font-semibold">
            {BURIAL_LABEL[input.forma]} · {CEREMONY_LABEL[input.ceremonia]}
          </p>
          <p className="text-muted">
            {PLACE_LABEL[input.miejsce]}
            {home ? ` · ${formatPln(home.quote_pln)}` : ""}
          </p>
        </div>

        <div className="mt-5">
          <Flash searchParams={searchParams} />
        </div>

        <form action={createInquiry} className="flex flex-col gap-5">
          <input type="hidden" name="miasto" value={input.miasto} />
          <input type="hidden" name="forma" value={input.forma} />
          <input type="hidden" name="ceremonia" value={input.ceremonia} />
          <input type="hidden" name="miejsce" value={input.miejsce} />
          <input type="hidden" name="budzet" value={input.budzet ?? ""} />
          <input type="hidden" name="dom" value={dom} />

          <Field id="contact_name" label="Twoje imię i nazwisko">
            <Input id="contact_name" name="contact_name" autoComplete="name" required minLength={2} maxLength={120} />
          </Field>
          <Field id="contact_phone" label="Numer telefonu" hint="Na ten numer zadzwoni zakład.">
            <Input
              id="contact_phone"
              name="contact_phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="600 100 200"
              required
              aria-describedby="contact_phone-hint"
            />
          </Field>
          <Field id="goscie" label="Ile osób może przyjść na pogrzeb? (nieobowiązkowe)">
            <Input id="goscie" name="goscie" type="number" inputMode="numeric" min={1} max={2000} />
          </Field>

          <label className="flex cursor-pointer gap-3 rounded-xl border border-line bg-card p-4 has-[:checked]:border-brand">
            <input type="checkbox" name="zgoda" value="tak" required className="mt-0.5 size-5 shrink-0 accent-brand" />
            <span className="text-[15px]">
              Zgadzam się na przekazanie mojego imienia i numeru telefonu zakładowi, który przyjmie zapytanie, w celu kontaktu w sprawie pogrzebu.
            </span>
          </label>

          <SubmitButton full pendingLabel="Wysyłam…">
            Poproś o kontakt
          </SubmitButton>
          <p className="flex items-start gap-2 text-sm text-muted">
            <Lock size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Nie pytamy o przyczynę zgonu ani o PESEL. Szczegóły ustalisz z zakładem.
          </p>
        </form>
      </main>
      <SiteFooter />
    </div>
  );
}
