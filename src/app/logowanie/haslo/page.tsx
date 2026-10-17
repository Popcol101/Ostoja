import type { Metadata } from "next";
import Link from "next/link";
import { SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { Logo, OPIEKUN_PHONE } from "@/components/site";
import { Field, Input } from "@/components/ui";
import { adminConfig } from "@/lib/auth";
import { mailEnabled } from "@/lib/mail";
import { requestPasswordLink } from "../actions";

export const metadata: Metadata = { title: "Ustaw nowe hasło", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const available = mailEnabled() && adminConfig() !== null;
  return (
    <main className="min-h-dvh bg-ground px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <Logo />
        <h1 className="font-serif text-[32px] leading-tight">Nie pamiętam hasła</h1>
        <Flash searchParams={searchParams} />
        {available ? (
          <form action={requestPasswordLink} className="flex flex-col gap-4 rounded-[14px] border border-line bg-card p-5">
            <p className="text-[15px]">Wpisz adres, którym logujesz się do panelu. Wyślemy link do ustawienia nowego hasła – działa godzinę.</p>
            <Field id="email" label="E-mail">
              <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" required maxLength={200} />
            </Field>
            <SubmitButton full pendingLabel="Wysyłam…">
              Wyślij link
            </SubmitButton>
          </form>
        ) : (
          <div className="rounded-[14px] border border-line bg-card p-5">
            <p className="font-semibold">Wysyłka e-maili jest chwilowo niedostępna.</p>
            <p className="mt-1 text-muted">Zadzwoń do opiekuna partnerów Ostoi: {OPIEKUN_PHONE}.</p>
          </div>
        )}
        <Link href="/logowanie" className="inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4">
          Wróć do logowania
        </Link>
      </div>
    </main>
  );
}
