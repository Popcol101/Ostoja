import Link from "next/link";
import { OfflineBanner } from "@/components/client";
import { withUser } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/labels";
import { requireMember } from "@/lib/session";
import { logout, toggleAccepting } from "./actions";
import { PanelNav } from "./nav";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMember();
  const [{ count }] = await withUser(me.userId, (tx) =>
    tx<{ count: number }[]>`select count(*)::int as count from offers where status = 'nowe' and expires_at > now()`,
  );

  return (
    <div className="min-h-dvh bg-ground">
      <OfflineBanner />
      <header className="bg-night text-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <Link href="/panel/zapytania" className="flex items-center gap-3 text-white no-underline">
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-[10px] bg-brand font-bold"
            >
              {me.homeName
                .split(" ")
                .filter((w) => w.length > 2)
                .slice(-2)
                .map((w) => w[0])
                .join("")}
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
                className="flex min-h-11 items-center gap-3 rounded-xl border border-night-line bg-[#22302C] px-3 text-left"
              >
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">
                    {me.acceptingToday ? "Przyjmuję zapytania" : "Zapytania wstrzymane"}
                  </span>
                  <span className="hidden text-[12px] text-night-muted sm:block">
                    {me.acceptingToday ? "Rodziny widzą: dostępny dziś" : "Nie dostajesz nowych zapytań"}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`flex h-7 w-12 items-center rounded-full p-[3px] ${
                    me.acceptingToday ? "justify-end bg-[#4F8A76]" : "justify-start bg-muted"
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
      <div className="mx-auto flex max-w-6xl gap-6 lg:px-6">
        <PanelNav variant="side" newCount={count} />
        <main id="tresc" className="min-w-0 flex-1 px-4 pb-28 pt-5 lg:px-0 lg:pb-12">
          {children}
        </main>
      </div>
      <PanelNav variant="bottom" newCount={count} />
    </div>
  );
}
