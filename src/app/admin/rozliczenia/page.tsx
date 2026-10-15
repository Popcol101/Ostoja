import { ChevronLeft, ChevronRight } from "lucide-react";
import { param, type SearchParams } from "@/components/flash";
import { Card, EmptyState, LinkButton, PageTitle } from "@/components/ui";
import { withUser } from "@/lib/db";
import { formatPln } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

type Line = { home_id: string; home_name: string; nip: string; orders: number; fee_pln: number };

function monthParts(v: string | undefined): { y: number; m: number } {
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Warsaw" }));
  const match = v?.match(/^(\d{4})-(\d{2})$/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]);
    if (m >= 1 && m <= 12 && y >= 2026 && y <= 2100) return { y, m };
  }
  return { y: now.getFullYear(), m: now.getMonth() + 1 };
}
const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
const shift = (y: number, m: number, d: number) => {
  const t = y * 12 + (m - 1) + d;
  return key(Math.floor(t / 12), (t % 12) + 1);
};

export default async function AdminBilling({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireAdmin();
  const { y, m } = monthParts(await param(searchParams, "miesiac"));
  const lines = await withUser(admin.userId, (tx) => tx<Line[]>`select * from admin_billing(${`${key(y, m)}-01`}::date)`);
  const total = lines.reduce((a, l) => a + l.fee_pln, 0);
  const orders = lines.reduce((a, l) => a + l.orders, 0);
  const label = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(new Date(Date.UTC(y, m - 1, 15)));

  return (
    <>
      <PageTitle
        sub={`Opłaty netto za zlecenia z Ostoi z podpisaną umową: ${label}`}
        aside={
          <div className="flex gap-2">
            <LinkButton variant="secondary" href={`/admin/rozliczenia?miesiac=${shift(y, m, -1)}`} aria-label="Poprzedni miesiąc">
              <ChevronLeft size={18} aria-hidden="true" />
            </LinkButton>
            <LinkButton variant="secondary" href={`/admin/rozliczenia?miesiac=${shift(y, m, 1)}`} aria-label="Następny miesiąc">
              <ChevronRight size={18} aria-hidden="true" />
            </LinkButton>
          </div>
        }
      >
        Rozliczenia
      </PageTitle>
      {lines.length === 0 ? (
        <EmptyState title={`Brak opłat za ${label}`}>Opłata powstaje, gdy zakład oznaczy umowę ze zlecenia z Ostoi jako podpisaną.</EmptyState>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[15px]">
              <thead>
                <tr className="border-b border-line text-[13px] text-muted">
                  <th scope="col" className="py-2 pr-3 font-semibold">Zakład</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">NIP</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Zlecenia</th>
                  <th scope="col" className="py-2 text-right font-semibold">Do faktury (netto)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.home_id} className="border-b border-line-soft">
                    <td className="py-2.5 pr-3 font-semibold">{l.home_name}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{l.nip}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{l.orders}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatPln(l.fee_pln)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" className="pt-3 text-left">Razem</th>
                  <td />
                  <td className="pt-3 text-right font-semibold tabular-nums">{orders}</td>
                  <td className="pt-3 text-right font-semibold tabular-nums">{formatPln(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
