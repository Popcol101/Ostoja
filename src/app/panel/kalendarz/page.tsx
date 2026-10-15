import { AlertTriangle, ChevronLeft, ChevronRight, Moon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Flash, param, type SearchParams } from "@/components/flash";
import { Card, CardTitle, PageTitle } from "@/components/ui";
import { withUser } from "@/lib/db";
import { addDays, countLabel, dayKey, formatDate, formatTime, mondayOf, warsawToUtc } from "@/lib/format";
import { EVENT_KIND_LABEL, EVENT_STATUS_LABEL, type EventKind, type EventStatus } from "@/lib/labels";
import { requireMember } from "@/lib/session";
import { EventForm, type Resource } from "../event-form";

export const metadata: Metadata = { title: "Kalendarz" };
export const dynamic = "force-dynamic";

type Ev = {
  id: string;
  order_id: string | null;
  kind: EventKind;
  title: string;
  status: EventStatus;
  starts_at: Date;
  ends_at: Date;
  place: string | null;
  resource_names: string[];
  warning: string | null;
};
type Duty = { name: string; starts_at: Date; ends_at: Date };

export default async function CalendarPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const today = dayKey(new Date());
  const requested = await param(searchParams, "od");
  const monday = mondayOf(requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today);
  const from = warsawToUtc(monday, "00:00");
  const to = warsawToUtc(addDays(monday, 7), "00:00");

  const { events, duties, unconfirmed, resources } = await withUser(me.userId, async (tx) => {
    const events = await tx<Ev[]>`
      select id, order_id, kind, title, status, starts_at, ends_at, place, resource_names, warning
      from calendar_events
      where during && tstzrange(${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz)
        and status <> 'odwolany'
      order by starts_at`;
    const duties = await tx<Duty[]>`
      select m.display_name as name, lower(d.during) as starts_at, upper(d.during) as ends_at
      from duty_shifts d join memberships m on m.user_id = d.user_id and m.home_id = d.home_id
      where d.during && tstzrange(${from.toISOString()}::timestamptz, ${to.toISOString()}::timestamptz)
      order by lower(d.during)`;
    const unconfirmed = await tx<Ev[]>`
      select id, order_id, kind, title, status, starts_at, ends_at, place, resource_names, warning
      from calendar_events where status = 'wstepny' and ends_at > now() order by starts_at limit 10`;
    const resources = await tx<Resource[]>`select id, name from resources order by kind, name`;
    return { events, duties, unconfirmed, resources };
  });

  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const tonight = duties.find((d) => d.starts_at.getTime() <= Date.now() + 12 * 3600_000 && d.ends_at.getTime() > Date.now());
  const warnings = events.filter((e) => e.warning);

  return (
    <>
      <PageTitle
        sub={`${formatDate(from)} – ${formatDate(addDays(monday, 6) + "T12:00:00Z", { year: "numeric" })}`}
        aside={
          <div className="flex items-center gap-1">
            <Link href={`?od=${addDays(monday, -7)}`} aria-label="Poprzedni tydzień" className="flex size-11 items-center justify-center rounded-[10px] bg-card text-ink ring-1 ring-line">
              <ChevronLeft size={20} aria-hidden="true" />
            </Link>
            <Link href="/panel/kalendarz" className="flex min-h-11 items-center rounded-[10px] bg-card px-3 font-semibold text-ink no-underline ring-1 ring-line">
              Dziś
            </Link>
            <Link href={`?od=${addDays(monday, 7)}`} aria-label="Następny tydzień" className="flex size-11 items-center justify-center rounded-[10px] bg-card text-ink ring-1 ring-line">
              <ChevronRight size={20} aria-hidden="true" />
            </Link>
          </div>
        }
      >
        Kalendarz
      </PageTitle>
      <Flash searchParams={searchParams} />

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <div className="flex items-center gap-3 rounded-[14px] bg-night px-4 py-3 text-white">
          <Moon size={20} aria-hidden="true" />
          <p>
            {tonight ? (
              <>
                Dyżur: <strong>{tonight.name}</strong> do {formatTime(tonight.ends_at)}. Nowe zapytania w nocy trafiają do tej osoby.
              </>
            ) : (
              "Brak dyżuru w najbliższych godzinach."
            )}
          </p>
        </div>
        {warnings.length ? (
          <div className="flex items-center gap-3 rounded-[14px] bg-warn-tint px-4 py-3 text-warn-ink">
            <AlertTriangle size={20} aria-hidden="true" />
            <p className="font-semibold">
              {countLabel(warnings.length, "termin wymaga", "terminy wymagają", "terminów wymaga")} sprawdzenia reguły 24 godzin.
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-7 lg:gap-2">
        {days.map((day) => {
          const dayEvents = events.filter((e) => dayKey(e.starts_at) === day);
          const isToday = day === today;
          return (
            <section
              key={day}
              aria-labelledby={`dzien-${day}`}
              className={`rounded-[14px] border bg-card p-3 lg:p-2 ${isToday ? "border-brand ring-1 ring-brand" : "border-line"}`}
            >
              <h2 id={`dzien-${day}`} className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 text-[15px] font-semibold">
                <span className="inline-block first-letter:uppercase lg:hidden">{formatDate(`${day}T12:00:00Z`, { weekday: "short" })}</span>
                <span className="hidden first-letter:uppercase lg:inline-block">
                  {formatDate(`${day}T12:00:00Z`, { weekday: "short", month: undefined })}
                </span>
                {isToday ? <span className="text-[12px] font-bold uppercase text-brand">dziś</span> : null}
              </h2>
              {dayEvents.length === 0 ? (
                <p className="text-[13px] text-muted">Wolne</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {dayEvents.map((e) => (
                    <li
                      key={e.id}
                      className={`rounded-[10px] px-2.5 py-2 text-[13px] break-words lg:px-2 ${
                        e.status === "wstepny" ? "border border-dashed border-warn bg-warn-tint/40" : "bg-brand-tint"
                      }`}
                    >
                      <p className="font-bold">
                        {formatTime(e.starts_at)}–{formatTime(e.ends_at)}
                      </p>
                      <p className="font-semibold">
                        {e.order_id ? (
                          <Link href={`/panel/zlecenia/${e.order_id}`} className="text-ink">
                            {e.title}
                          </Link>
                        ) : (
                          e.title
                        )}
                      </p>
                      <p className="text-muted">
                        {EVENT_KIND_LABEL[e.kind]}
                        {e.place ? ` · ${e.place}` : ""}
                      </p>
                      {e.resource_names.length ? <p className="text-muted">{e.resource_names.join(", ")}</p> : null}
                      <p className={`mt-1 text-[12px] font-bold ${e.status === "potwierdzony" ? "text-brand" : "text-warn-ink"}`}>
                        {EVENT_STATUS_LABEL[e.status]}
                      </p>
                      {e.warning ? (
                        <p className="mt-0.5 flex items-start gap-1 text-[12px] font-bold text-warn-ink">
                          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                          Mniej niż 24 h od zgonu
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle aside={unconfirmed.length ? `${unconfirmed.length}` : undefined}>Do potwierdzenia</CardTitle>
          {unconfirmed.length === 0 ? (
            <p className="text-muted">Wszystkie nadchodzące terminy są potwierdzone.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft">
              {unconfirmed.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span>
                    <span className="block font-semibold">{e.title}</span>
                    <span className="text-[14px] text-muted">
                      {formatDate(e.starts_at, { weekday: "short" })}, {formatTime(e.starts_at)}
                      {e.place ? ` · ${e.place}` : ""}
                    </span>
                  </span>
                  {e.order_id ? (
                    <Link href={`/panel/zlecenia/${e.order_id}`} className="whitespace-nowrap font-semibold text-brand">
                      Otwórz
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[13px] text-muted">
            Terminy na cmentarzu, w parafii i w krematorium ustalasz poza Ostoją. Oznacz je jako potwierdzone, gdy masz pewność.
          </p>
        </Card>
        <Card>
          <CardTitle>Wpis ręczny</CardTitle>
          <p className="text-[14px] text-muted">Spotkania, dostawy i zlecenia spoza Ostoi. Terminy zleceń dodajesz w karcie zlecenia.</p>
          <EventForm returnTo="/panel/kalendarz" resources={resources} />
          <p className="mt-3 border-t border-line-soft pt-3 text-[14px]">
            <a href="/api/kalendarz" className="font-semibold text-brand">
              Pobierz kalendarz (.ics)
            </a>{" "}
            <span className="text-muted">– do Kalendarza Google, Apple lub Outlook.</span>
          </p>
        </Card>
      </div>
    </>
  );
}
