import Link from "next/link";
import { Mark } from "@/components/site";
import { OfflineBanner } from "@/components/client";
import { withUser } from "@/lib/db";
import { homeStatus } from "@/lib/home-status";
import { ROLE_LABEL } from "@/lib/labels";
import { requireMember } from "@/lib/session";
import { logout, toggleAccepting } from "./actions";
import { PanelNav } from "./nav";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember();
  const [[{ count }], status] = await Promise.all([
    withUser(me.userId, (tx) =>
      tx<{ count: number }[]>`select count(*)::int as count from offers where status = 'nowe' and expires_at > now()`,
    ),
    homeStatus(me.userId, me.homeId),
  ]);

  return (
    <div className="min-h-dvh bg-ground">
      <OfflineBanner />
      <header className="bg-night text-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <Link href="/panel/zapytania" className="flex items-center gap-3 text-white no-underline">
            <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-[10px] bg-brand">
              <Mark size={26} onDark />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-semibold">{me.homeName}</span>
              <span className="text-[13px] text-night-muted">
                {me.displayName} · {ROLE_LABEL[me.role]}
              </span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <form action={toggleAccepting}>
              <button
                type="submit"
                role="switch"
                aria-checked={me.acceptingToday}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-night-line bg-night-raised px-3 text-left"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">
                    {me.acceptingToday ? "Przyjmuję zapytania" : "Zapytania wstrzymane"}
                  </span>
                  <span className="hidden text-[12px] text-night-muted sm:block">
                    {status.status !== "zweryfikowany" ? "Zakład niewidoczny dla rodzin" : me.acceptingToday ? "Rodziny widzą: dostępny dziś" : "Nie dostajesz nowych zapytań"}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-12 items-center rounded-full p-[3px] ${
                    me.acceptingToday ? "justify-end bg-night-on" : "justify-start bg-muted"
                  }`}
                >
                  <span className="size-[22px] rounded-full bg-white" />
                </span>
              </button>
            </form>
            <form action={logout}>
              <button type="submit" className="min-h-11 rounded-[10px] px-3 text-sm text-night-muted hover:text-white">
                Wyloguj
              </button>
            </form>
          </div>
        </div>
      </header>
      {status.status === "wstrzymany" ? (
        <div role="status" className="border-b border-warn bg-warn-tint print:hidden">
          <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-[15px] text-warn-ink lg:px-6">
            <span className="font-semibold">Zakład jest wstrzymany.</span>
            <span>Rodziny go nie widzą i nie dostajesz nowych zapytań. Trwające zlecenia prowadzisz dalej.</span>
            <Link href="/panel/status" className="inline-flex min-h-11 items-center font-semibold text-warn-ink underline">
              Uzasadnienie i odwołanie
            </Link>
          </p>
        </div>
      ) : null}
      <div className="mx-auto flex max-w-6xl gap-6 lg:px-6">
        <PanelNav variant="side" newCount={count} />
        <main id="tresc" className="min-w-0 flex-1 px-4 pb-28 pt-5 lg:px-0 lg:pb-12 print:p-0">
          {children}
        </main>
      </div>
      <PanelNav variant="bottom" newCount={count} />
    </div>
  );
}
