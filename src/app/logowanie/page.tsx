import type { Metadata } from "next";
import { SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { Logo, OPIEKUN_PHONE } from "@/components/site";
import { Field, Input, Notice } from "@/components/ui";
import { emailLoginEnabled } from "@/lib/auth";
import { sql } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/labels";
import { demoModeEnabled } from "@/lib/session";
import { loginDemo, sendLoginLink } from "./actions";

export const metadata: Metadata = { title: "Logowanie do panelu" };
export const dynamic = "force-dynamic";

type Account = { user_id: string; email: string; display_name: string; role: string; home_name: string };

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const demo = demoModeEnabled();
  const emailLogin = emailLoginEnabled();
  const accounts = demo
    ? await sql<Account[]>`
        select * from (
          select m.user_id, u.email, m.display_name, m.role::text as role, h.name as home_name, 0 as ord
          from memberships m join auth.users u on u.id = m.user_id join funeral_homes h on h.id = m.home_id
          union all
          select p.user_id, u.email, p.display_name, 'admin', 'Ostoja – administracja', 1
          from platform_admins p join auth.users u on u.id = p.user_id
        ) a
        -- Tylko konta testowe (@….test): prawdziwe konta pilotażowe logują się wyłącznie linkiem z e-maila.
        where a.email like '%.test'
        order by a.ord, a.home_name, a.role`
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
          <form action={sendLoginLink} className="flex flex-col gap-4 rounded-[14px] border border-line bg-card p-5">
            <Field id="email" label="Twój e-mail" hint="Wyślemy link do logowania. Bez hasła.">
              <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required aria-describedby="email-hint" />
            </Field>
            <SubmitButton full pendingLabel="Wysyłam…">
              Wyślij link
            </SubmitButton>
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
