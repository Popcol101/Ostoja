import "server-only";
// Podpowiedzi miejsc z bazy parafii i cmentarzy (miasto zakładu): do klepsydry (zdania) i kalendarza (nazwy).
import { withUser } from "./db";

export type PlaceSuggestions = { ceremony: string[]; cemetery: string[]; names: string[] };

export async function placeSuggestions(userId: string, homeId: string): Promise<PlaceSuggestions> {
  return withUser(userId, async (tx) => {
    const rows = await tx<{ kind: "parafia" | "cmentarz"; name: string; phrase: string | null }[]>`
      with city as (select c.name from funeral_homes h join cities c on c.slug = h.city_slug where h.id = ${homeId})
      select 'parafia' as kind, p.name, p.phrase from parishes p where p.city = (select name from city)
      union all
      select 'cmentarz', c.name, c.phrase from cemeteries c where c.city = (select name from city)
      order by 1, 2`;
    return {
      ceremony: rows.filter((r) => r.kind === "parafia" && r.phrase).map((r) => r.phrase!),
      cemetery: rows.filter((r) => r.kind === "cmentarz" && r.phrase).map((r) => r.phrase!),
      names: rows.map((r) => r.name),
    };
  });
}
