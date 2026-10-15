import type { Metadata } from "next";
import Link from "next/link";
import { Flash, type SearchParams } from "@/components/flash";
import { Badge, EmptyState, PageTitle } from "@/components/ui";
import { withUser } from "@/lib/db";
import { formatDateTime, formatPln } from "@/lib/format";
import { BURIAL_LABEL, STAGE_LABEL, type Burial, type OrderStage } from "@/lib/labels";
import { requireMember } from "@/lib/session";

export const metadata: Metadata = { title: "Zlecenia" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  stage: OrderStage;
  burial: Burial;
  name: string | null;
  principal_name: string;
  total_pln: number | null;
  contract_signed_at: Date | null;
  from_ostoja: boolean;
  next_title: string | null;
  next_at: Date | null;
  open_tasks: number;
};

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const rows = await withUser(me.userId, (tx) => tx<Row[]>`
    select o.id, o.stage, o.burial, o.principal_name, o.total_pln, o.contract_signed_at,
           o.offer_id is not null as from_ostoja,
           nullif(trim(coalesce(o.deceased_first_name,'') || ' ' || coalesce(o.deceased_last_name,'')), '') as name,
           ne.title as next_title, ne.starts_at as next_at,
           (select count(*)::int from order_tasks t where t.order_id = o.id and not t.done) as open_tasks
    from orders o
    left join lateral (
      select e.title, lower(e.during) as starts_at from events e
      where e.order_id = o.id and e.status <> 'odwolany' and upper(e.during) > now()
      order by lower(e.during) limit 1
    ) ne on true
    order by (o.stage = 'zamkniete'), coalesce(ne.starts_at, o.created_at)`);

  const active = rows.filter((r) => r.stage !== "zamkniete");
  const closed = rows.filter((r) => r.stage === "zamkniete");

  return (
    <>
      <PageTitle sub="Wszystkie sprawy zakładu – z Ostoi i spoza niej">Zlecenia</PageTitle>
      <Flash searchParams={searchParams} />
      {rows.length === 0 ? (
        <EmptyState title="Nie masz jeszcze zleceń">
          Zlecenie pojawi się tu po przyjęciu zapytania od rodziny.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...active, ...closed].map((r) => (
            <li key={r.id}>
              <Link
                href={`/panel/zlecenia/${r.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-line bg-card px-4 py-3.5 text-ink no-underline hover:border-brand"
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">
                    {r.name ?? "Dane zmarłego do uzupełnienia"} · {BURIAL_LABEL[r.burial].toLowerCase()}
                  </span>
                  <span className="text-[14px] text-muted">
                    {r.next_at ? `${r.next_title}: ${formatDateTime(r.next_at)}` : `Zlecający: ${r.principal_name}`}
                    {r.open_tasks ? ` · ${r.open_tasks} do zrobienia` : ""}
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {!r.from_ostoja ? <Badge>Spoza Ostoi</Badge> : null}
                  <Badge tone={r.contract_signed_at ? "brand" : "warn"}>
                    {r.contract_signed_at ? STAGE_LABEL[r.stage] : "Czeka na umowę"}
                  </Badge>
                  <span className="font-semibold">{formatPln(r.total_pln)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
