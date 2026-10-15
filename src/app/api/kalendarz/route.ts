// Eksport kalendarza zakładu do pliku .ics (Google, Apple, Outlook). Wymaga sesji.
import ical from "ical-generator";
import { withUser } from "@/lib/db";
import { getUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return new Response("Zaloguj się", { status: 401 });

  const { home, events } = await withUser(userId, async (tx) => {
    const [home] = await tx<{ name: string }[]>`select name from funeral_homes limit 1`;
    const events = await tx<{ id: string; title: string; starts_at: Date; ends_at: Date; place: string | null; status: string }[]>`
      select id, title, starts_at, ends_at, place, status from calendar_events
      where status <> 'odwolany' and ends_at > now() - interval '30 days' order by starts_at`;
    return { home, events };
  });

  const cal = ical({ name: `${home?.name ?? "Zakład"} – Ostoja`, timezone: "Europe/Warsaw" });
  for (const e of events) {
    cal.createEvent({
      id: e.id,
      start: e.starts_at,
      end: e.ends_at,
      summary: e.status === "wstepny" ? `${e.title} (wstępny)` : e.title,
      location: e.place ?? undefined,
    });
  }

  return new Response(cal.toString(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ostoja-kalendarz.ics"',
      "Cache-Control": "no-store",
    },
  });
}
