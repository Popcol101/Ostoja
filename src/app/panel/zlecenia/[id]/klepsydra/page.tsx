import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/client";
import type { SearchParams } from "@/components/flash";
import { param } from "@/components/flash";
import { withUser } from "@/lib/db";
import { formatDate, formatTime, TZ } from "@/lib/format";
import { requireMember } from "@/lib/session";

export const metadata: Metadata = { title: "Klepsydra" };
export const dynamic = "force-dynamic";

type Data = {
  first: string | null;
  last: string | null;
  born_on: string | null;
  died_at: Date | null;
  ceremony: "religijna" | "swiecka" | "bez";
  home_name: string;
  home_phone: string;
  events: { title: string; starts_at: string; place: string | null; kind: string }[];
};

function ageAtDeath(born: string | null, died: Date | null): number | null {
  if (!born || !died) return null;
  const [y, m, d] = born.split("-").map(Number);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(died)
    .split("-")
    .map(Number);
  let age = parts[0] - y;
  if (parts[1] < m || (parts[1] === m && parts[2] < d)) age -= 1;
  return age;
}

export default async function KlepsydraPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireMember();
  const [d] = await withUser(me.userId, (tx) => tx<Data[]>`
    select o.deceased_first_name as first, o.deceased_last_name as last, o.born_on, o.died_at, o.ceremony,
           h.name as home_name, h.phone as home_phone,
           coalesce((select json_agg(json_build_object('title', e.title, 'starts_at', lower(e.during), 'place', e.place, 'kind', e.kind)
                     order by lower(e.during))
                     from events e where e.order_id = o.id and e.status <> 'odwolany' and e.kind in ('ceremonia', 'pochowek')), '[]') as events
    from orders o join funeral_homes h on h.id = o.home_id where o.id = ${id}`);
  if (!d) notFound();

  const name = [d.first, d.last].filter(Boolean).join(" ");
  const formParam = await param(searchParams, "forma");
  const female = formParam ? formParam === "k" : (d.first ?? "").trim().toLowerCase().endsWith("a");
  const age = ageAtDeath(d.born_on, d.died_at);
  const religious = d.ceremony === "religijna";
  const back = `/panel/zlecenia/${id}`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[794px] flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={back} className="text-sm font-semibold text-brand">
          ← Karta zlecenia
        </Link>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Forma:</span>
          <Link href={`?forma=k`} aria-current={female ? "true" : undefined} className={`rounded-full px-3 py-2 ${female ? "bg-brand text-white" : "bg-card text-brand"}`}>
            zmarła
          </Link>
          <Link href={`?forma=m`} aria-current={!female ? "true" : undefined} className={`rounded-full px-3 py-2 ${!female ? "bg-brand text-white" : "bg-card text-brand"}`}>
            zmarł
          </Link>
          <PrintButton />
        </div>
      </div>

      {!name ? (
        <p className="rounded-xl bg-warn-tint px-4 py-3 text-warn-ink print:hidden">
          Uzupełnij imię i nazwisko zmarłego w karcie zlecenia – klepsydra je pobierze.
        </p>
      ) : null}

      <article
        aria-label="Podgląd klepsydry"
        className="aspect-[210/297] w-full max-w-[794px] bg-white p-[6%] text-center text-black print:max-w-none print:p-[18mm]"
      >
        <div className="flex h-full flex-col items-center justify-center gap-[3%] border-[6px] border-black px-[8%] py-[6%]">
          {religious ? (
            <svg aria-hidden="true" viewBox="0 0 40 60" className="h-[8%]">
              <path d="M17 0h6v16h17v6H23v38h-6V22H0v-6h17z" fill="#000" />
            </svg>
          ) : null}
          <p className="font-serif text-[clamp(14px,2.4vw,20px)]">
            Z głębokim żalem zawiadamiamy, że{" "}
            {d.died_at ? `dnia ${formatDate(d.died_at, { year: "numeric" })}` : "[DATA ZGONU]"}{" "}
            {female ? "zmarła" : "zmarł"}
            {age !== null ? `, przeżywszy ${age} lat,` : ""}
          </p>
          {religious ? <p className="font-serif text-[clamp(14px,2.2vw,18px)]">Śp.</p> : null}
          <h1 className="font-serif text-[clamp(28px,6vw,52px)] leading-tight">{name || "[IMIĘ I NAZWISKO]"}</h1>
          <div className="font-serif text-[clamp(13px,2.2vw,18px)]">
            {d.events.length ? (
              d.events.map((e, i) => (
                <p key={i}>
                  {e.kind === "pochowek" ? "Pochówek" : religious ? "Uroczystości pogrzebowe" : "Ceremonia pożegnalna"} odbędzie się{" "}
                  {formatDate(e.starts_at, { weekday: "long" })} o godz. {formatTime(e.starts_at)}
                  {e.place ? `, ${e.place}` : ""}.
                </p>
              ))
            ) : (
              <p>Uroczystości pogrzebowe odbędą się [DATA, GODZINA, MIEJSCE].</p>
            )}
          </div>
          <p className="font-serif text-[clamp(14px,2.4vw,20px)] italic">Pogrążona w smutku rodzina</p>
          <p className="mt-auto text-[clamp(9px,1.4vw,11px)] text-[#444]">
            {d.home_name}, tel. {d.home_phone}
          </p>
        </div>
      </article>
    </div>
  );
}
