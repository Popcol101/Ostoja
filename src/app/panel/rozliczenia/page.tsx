import type { Metadata } from "next";
import Link from "next/link";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { withUser } from "@/lib/db";
import { countLabel, formatDate, formatPln } from "@/lib/format";
import { requireMember } from "@/lib/session";

export const metadata: Metadata = { title: "Rozliczenia" };
export const dynamic = "force-dynamic";

type Line = { order_id: string; contract_signed_at: Date; billing_month: string; deceased_name: string | null; fee_net_pln: number };

export default async function BillingPage() {
  const me = await requireMember();
  const lines = await withUser(me.userId, (tx) => tx<Line[]>`
    select order_id, contract_signed_at, billing_month, deceased_name, fee_net_pln
    from billing_lines order by contract_signed_at desc`);

  const months = [...new Set(lines.map((l) => l.billing_month))];

  return (
    <>
      <PageTitle sub="Opłata 250 zł netto za zlecenie z Ostoi z podpisaną umową. Zlecenia spoza Ostoi są bezpłatne.">
        Rozliczenia z Ostoją
      </PageTitle>
      {lines.length === 0 ? (
        <EmptyState title="Brak opłat">Opłata pojawi się po oznaczeniu umowy jako podpisanej w zleceniu z Ostoi.</EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {months.map((m) => {
            const rows = lines.filter((l) => l.billing_month === m);
            const sum = rows.reduce((s, r) => s + r.fee_net_pln, 0);
            return (
              <Card key={m}>
                <div className="mb-3 flex items-baseline justify-between gap-3">
                  <h2 className="text-[17px] font-semibold capitalize">
                    {formatDate(`${m}T12:00:00Z`, { day: undefined, month: "long", year: "numeric" })}
                  </h2>
                  <p className="text-right">
                    <span className="block text-lg font-bold">{formatPln(sum)} netto</span>
                    <span className="text-[13px] text-muted">{countLabel(rows.length, "zlecenie", "zlecenia", "zleceń")}</span>
                  </p>
                </div>
                <ul className="flex flex-col divide-y divide-line-soft">
                  {rows.map((r) => (
                    <li key={r.order_id} className="flex justify-between gap-3 py-2">
                      <Link href={`/panel/zlecenia/${r.order_id}`} className="text-ink">
                        {r.deceased_name ?? "Zlecenie"}
                        <span className="block text-[13px] text-muted">umowa {formatDate(r.contract_signed_at)}</span>
                      </Link>
                      <span>{formatPln(r.fee_net_pln)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
