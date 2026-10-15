import { Plus } from "lucide-react";
import Link from "next/link";
import { Flash, param, type SearchParams } from "@/components/flash";
import { Badge, EmptyState, LinkButton, PageTitle, cx } from "@/components/ui";
import { withUser } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { requireAdmin } from "@/lib/session";

type Home = {
  id: string;
  name: string;
  city_name: string;
  address: string;
  phone: string;
  email: string;
  nip: string;
  verified_at: Date | null;
  accepting_today: boolean;
  members: number;
  owners: number;
  price_complete: boolean;
  orders_month: number;
  created_at: Date;
};

const FILTERS = [
  { value: "wszystkie", label: "Wszystkie" },
  { value: "do-weryfikacji", label: "Do weryfikacji" },
  { value: "aktywne", label: "Zweryfikowane" },
] as const;

export default async function AdminHomes({ searchParams }: { searchParams: SearchParams }) {
  const admin = await requireAdmin();
  const filter = (await param(searchParams, "pokaz")) ?? "wszystkie";
  const homes = await withUser(admin.userId, (tx) => tx<Home[]>`select * from admin_homes()`);
  const shown = homes.filter((h) => (filter === "do-weryfikacji" ? !h.verified_at : filter === "aktywne" ? !!h.verified_at : true));
  const pending = homes.filter((h) => !h.verified_at).length;

  return (
    <>
      <PageTitle
        sub={`${homes.length} zakładów · ${pending} czeka na weryfikację`}
        aside={
          <LinkButton href="/admin/zaklady/nowy">
            <Plus size={18} aria-hidden="true" /> Dodaj partnera
          </LinkButton>
        }
      >
        Zakłady partnerskie
      </PageTitle>
      <Flash searchParams={searchParams} />
      <nav aria-label="Filtr" className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "wszystkie" ? "/admin" : `/admin?pokaz=${f.value}`}
            aria-current={filter === f.value ? "true" : undefined}
            className={cx(
              "inline-flex min-h-11 items-center rounded-full border px-4 text-[15px] font-semibold no-underline",
              filter === f.value ? "border-brand bg-brand text-white" : "border-line bg-card text-ink",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <EmptyState title="Brak zakładów w tym widoku" action={<LinkButton href="/admin/zaklady/nowy">Dodaj partnera</LinkButton>} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {shown.map((h) => (
            <li key={h.id}>
              <Link
                href={`/admin/zaklady/${h.id}`}
                className="flex h-full flex-col gap-2 rounded-[14px] border border-line bg-card p-4 text-ink no-underline hover:border-brand"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="font-serif text-[21px] leading-tight">{h.name}</span>
                  {h.verified_at ? <Badge tone="brand">Zweryfikowany</Badge> : <Badge tone="warn">Do weryfikacji</Badge>}
                </span>
                <span className="text-[14px] text-muted">
                  {h.city_name} · NIP {h.nip} · dodany {formatDate(h.created_at)}
                </span>
                <span className="flex flex-wrap gap-2">
                  {h.owners === 0 ? <Badge tone="warn">Brak właściciela w panelu</Badge> : <Badge>{h.members} os. w panelu</Badge>}
                  {h.price_complete ? null : <Badge tone="warn">Cennik niepełny</Badge>}
                  {h.verified_at && !h.accepting_today ? <Badge>Dziś nie przyjmuje</Badge> : null}
                  <Badge>{h.orders_month} zleceń w tym miesiącu</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
