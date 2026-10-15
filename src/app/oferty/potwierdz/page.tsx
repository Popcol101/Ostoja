import { MessageSquareText } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/client";
import { Flash, param, type SearchParams } from "@/components/flash";
import { OPIEKUN_PHONE, SiteFooter, SiteHeader } from "@/components/site";
import { EmptyState, LinkButton, Notice } from "@/components/ui";
import { confirmInquiry, resendCode } from "@/app/rodzina-actions";
import { asAnon } from "@/lib/db";
import { DEMO_CODE_COOKIE, parseDemoCode } from "@/lib/phone";

export const metadata: Metadata = { title: "Kod z SMS-a – Ostoja", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Info = {
  phone_hint: string;
  expired: boolean;
  blocked: boolean;
  resend_in: number;
  sends_left: number;
  city_slug: string;
  burial: string;
  ceremony: string;
  place_of_death: string;
  budget: string | null;
  preferred_home_id: string | null;
};

export default async function ConfirmPhone({ searchParams }: { searchParams: SearchParams }) {
  const d = (await param(searchParams, "d")) ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(d)) redirect("/zapytanie");
  const info = await asAnon(async (tx) => {
    const [row] = await tx<Info[]>`select * from draft_info(${d})`;
    return row ?? null;
  });
  const demoCode = parseDemoCode((await cookies()).get(DEMO_CODE_COOKIE)?.value, d);
  const tel = OPIEKUN_PHONE.replace(/\s/g, "");
  const back = info
    ? `/oferty/kontakt?${new URLSearchParams(
        Object.entries({
          miasto: info.city_slug,
          forma: info.burial,
          ceremonia: info.ceremony,
          miejsce: info.place_of_death,
          budzet: info.budget ?? "",
          dom: info.preferred_home_id ?? "",
        }).filter(([, v]) => v),
      )}`
    : "/zapytanie";

  return (
    <div className="flex min-h-dvh flex-col bg-ground-family">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8">
        {!info || info.expired || info.blocked ? (
          <>
            <h1 className="sr-only">Kod wygasł</h1>
            <EmptyState
              title={info?.blocked ? "Za dużo prób wpisania kodu." : "Ten kod wygasł."}
              action={<LinkButton href={back}>Wypełnij formularz jeszcze raz</LinkButton>}
            >
              Możesz też od razu zadzwonić do opiekuna: {OPIEKUN_PHONE}.
            </EmptyState>
          </>
        ) : (
          <>
            <MessageSquareText size={36} className="text-brand" aria-hidden="true" />
            <h1 className="mt-3 font-serif text-[30px] leading-tight">Wpisz kod z SMS-a</h1>
            <p className="mt-2 text-[17px]">
              Wysłaliśmy go na numer <span className="whitespace-nowrap font-semibold">{info.phone_hint}</span>. Dzięki temu zakład na pewno
              dodzwoni się do właściwej osoby.
            </p>
            <div className="mt-5">
              <Flash searchParams={searchParams} />
            </div>
            {demoCode ? (
              <div className="mb-4">
                <Notice tone="warn" title="Wersja testowa">
                  SMS-y nie wychodzą. Kod: <span className="font-mono text-[18px] font-bold tracking-[0.2em]">{demoCode}</span>
                </Notice>
              </div>
            ) : null}
            <form action={confirmInquiry} className="flex flex-col gap-4">
              <input type="hidden" name="d" value={d} />
              <label htmlFor="kod" className="font-semibold">
                Kod (6 cyfr)
              </label>
              <input
                id="kod"
                name="kod"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9 ]{6,7}"
                maxLength={7}
                className="min-h-14 w-full rounded-[10px] border border-field bg-card px-4 text-center font-mono text-[26px] tracking-[0.4em]"
              />
              <SubmitButton full pendingLabel="Sprawdzam…">
                Potwierdź i wyślij zapytanie
              </SubmitButton>
            </form>
            <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 text-[15px]">
              {info.sends_left > 0 ? (
                <form action={resendCode}>
                  <input type="hidden" name="d" value={d} />
                  <SubmitButton variant="secondary" pendingLabel="Wysyłam…">
                    Nie dostałem SMS-a – wyślij nowy kod
                  </SubmitButton>
                  {info.resend_in > 0 ? <p className="mt-1 text-[14px] text-muted">Nowy kod możesz wysłać po minucie od poprzedniego.</p> : null}
                </form>
              ) : null}
              <Link href={back} className="inline-flex min-h-11 items-center font-semibold text-brand">
                Zmień numer telefonu
              </Link>
              <p className="text-muted">
                Wolisz porozmawiać?{" "}
                <a href={`tel:${tel}`} className="font-semibold text-brand">
                  Zadzwoń do opiekuna: {OPIEKUN_PHONE}
                </a>
              </p>
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
