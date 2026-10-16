import { Badge, Card, EmptyState, Notice, PageTitle } from "@/components/ui";
import { withUser } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

type AppError = {
  kind: "serwer" | "przegladarka";
  route: string;
  message: string;
  last_digest: string | null;
  count: number;
  first_seen: Date;
  last_seen: Date;
};

export default async function Errors() {
  const admin = await requireAdmin();
  const rows = await withUser(admin.userId, (tx) => tx<AppError[]>`select * from admin_errors()`);

  return (
    <>
      <PageTitle sub="Błędy aplikacji z ostatnich 30 dni, zgrupowane po trasie i komunikacie.">Błędy</PageTitle>
      <div className="mb-4">
        <Notice>
          Bez danych osobowych: zamiast numerów, e-maili i identyfikatorów zapisujemy znaczniki. Szczegóły błędu z digestem są w logach Vercel
          (Logs → wyszukaj digest).
        </Notice>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Brak błędów w ostatnich 30 dniach" />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((e) => (
            <li key={`${e.kind}-${e.route}-${e.message}`}>
              <Card>
                <p className="flex flex-wrap items-center gap-2">
                  <Badge tone={e.kind === "serwer" ? "warn" : "neutral"}>{e.kind === "serwer" ? "Serwer" : "Przeglądarka"}</Badge>
                  <span className="font-mono text-[14px] break-all">{e.route}</span>
                  <span className="ml-auto text-sm text-muted">
                    {e.count}× · ostatnio {formatDateTime(e.last_seen)}
                  </span>
                </p>
                <p className="mt-2 break-words text-[15px]">{e.message}</p>
                <p className="mt-1 text-sm text-muted">
                  Pierwszy raz {formatDateTime(e.first_seen)}
                  {e.last_digest ? (
                    <>
                      {" "}
                      · digest <span className="font-mono">{e.last_digest}</span>
                    </>
                  ) : null}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
