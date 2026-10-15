import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { param, type SearchParams } from "@/components/flash";
import { Logo } from "@/components/site";
import { Notice } from "@/components/ui";
import { sql } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/labels";
import { createSession, demoModeEnabled } from "@/lib/session";

export const metadata: Metadata = { title: "Logowanie do panelu" };
export const dynamic = "force-dynamic";

type Account = { user_id: string; email: string; display_name: string; role: string; home_name: string };

async function loginDemo(formData: FormData) {
  "use server";
  if (!demoModeEnabled()) redirect("/logowanie?blad=demo-wylaczone");
  const userId = z.guid().parse(formData.get("userId"));
  const [m] = await sql<{ user_id: string }[]>`select user_id from memberships where user_id = ${userId} limit 1`;
  if (!m) redirect("/logowanie?blad=brak-zakladu");
  await createSession(m.user_id);
  redirect("/panel/zapytania");
}

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const error = await param(searchParams, "blad");
  const accounts = demoModeEnabled()
    ? await sql<Account[]>`
        select m.user_id, u.email, m.display_name, m.role, h.name as home_name
        from memberships m join auth.users u on u.id = m.user_id join funeral_homes h on h.id = m.home_id
        order by h.name, m.role`
    : [];

  return (
    <main className="min-h-dvh bg-ground px-4 py-10">
      <div className="mx-auto flex max-w-md flex-col gap-5">
        <div>
          <Logo />
          <h1 className="mt-4 font-serif text-[32px] leading-tight">Panel zakładu pogrzebowego</h1>
        </div>
        {error ? (
          <Notice tone="danger">
            {error === "brak-zakladu" ? "To konto nie jest przypisane do żadnego zakładu." : "Logowanie testowe jest wyłączone."}
          </Notice>
        ) : null}
        {demoModeEnabled() ? (
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
        ) : (
          <div className="rounded-[14px] border border-line bg-card p-5">
            <p className="font-semibold">Logowanie linkiem z e-maila będzie dostępne po wdrożeniu Supabase Auth.</p>
            <p className="mt-1 text-muted">W razie pytań zadzwoń do opiekuna partnerów Ostoi.</p>
          </div>
        )}
      </div>
    </main>
  );
}
