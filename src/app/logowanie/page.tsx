import type { Metadata } from "next";
import Link from "next/link";
import { PasswordInput, SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { Logo, OPIEKUN_PHONE } from "@/components/site";
import { Field, Input, Notice } from "@/components/ui";
import { emailLoginEnabled } from "@/lib/auth";
import { asServer } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/labels";
import { demoModeEnabled } from "@/lib/session";
import { loginDemo, loginWithPassword } from "./actions";

export const metadata: Metadata = { title: "Logowanie do panelu" };
export const dynamic = "force-dynamic";

type Account = { user_id: string; email: string; display_name: string; role: string; home_name: string };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const demo = demoModeEnabled();
  const emailLogin = emailLoginEnabled();
  const accounts = demo
    ? await asServer((tx) => tx<Account[]>`select * from demo_accounts()`)
    : [];

  return (
    <main className="min-h-dvh bg-ground px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <div>
          <Logo />
          <h1 className="mt-6 font-serif text-[32px] leading-tight">Panel zakładu pogrzebowego</h1>
        </div>
        <Flash searchParams={searchParams} />

        {emailLogin ? (
          <form action={loginWithPassword} className="flex flex-col gap-4 rounded-[14px] border border-line bg-card p-5">
            <Field id="email" label="E-mail">
              <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" required maxLength={200} />
            </Field>
            <Field id="password" label="Hasło">
              <PasswordInput id="password" name="password" autoComplete="current-password" />
            </Field>
            <SubmitButton full pendingLabel="Loguję…">
              Zaloguj się
            </SubmitButton>
            <p className="text-[15px]">
              <Link href="/logowanie/haslo" className="inline-flex min-h-11 items-center font-semibold text-brand underline underline-offset-4">
                Nie pamiętam hasła
              </Link>
            </p>
            <p className="text-[14px] text-muted">
              Pierwsze logowanie? Hasło ustawiasz z linku w e-mailu z zaproszeniem. Konto bez hasła – kliknij „Nie pamiętam hasła”.
            </p>
          </form>
        ) : null}

        {demo ? (
          <>
            <Notice tone="warn" title="Wersja testowa">
              Wybierz konto testowe. Wszystkie zakłady, osoby i numery w tej wersji są fikcyjne.
            </Notice>
            <ul className="flex flex-col gap-2">
              {accounts.map((a) => (
                <li key={a.user_id}>
                  <form action={loginDemo}>
                    <input type="hidden" name="userId" value={a.user_id} />
                    <button
                      type="submit"
                      className="flex min-h-14 w-full flex-col items-start rounded-[14px] border border-line bg-card px-4 py-3 text-left hover:border-brand"
                    >
                      <span className="font-semibold">{a.display_name}</span>
                      <span className="text-[14px] text-muted">
                        {a.home_name} · {ROLE_LABEL[a.role]}
                      </span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {!demo && !emailLogin ? (
          <div className="rounded-[14px] border border-line bg-card p-5">
            <p className="font-semibold">Logowanie jest chwilowo niedostępne.</p>
            <p className="mt-1 text-muted">Zadzwoń do opiekuna partnerów Ostoi: {OPIEKUN_PHONE}.</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
