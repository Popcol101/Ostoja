import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/client";
import { withUser } from "@/lib/db";
import { formatDate, formatPln } from "@/lib/format";
import { BURIAL_LABEL, CEREMONY_LABEL, FUNERAL_BENEFIT_PLN, type Burial, type Ceremony } from "@/lib/labels";
import { requireMember } from "@/lib/session";

export const metadata: Metadata = { title: "Kosztorys" };
export const dynamic = "force-dynamic";

export default async function CostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireMember();
  const data = await withUser(me.userId, async (tx) => {
    const [o] = await tx<
      { name: string | null; principal_name: string; burial: Burial; ceremony: Ceremony; total_pln: number | null; home_name: string; home_address: string; home_phone: string; contract_signed_at: Date | null }[]
    >`select nullif(trim(coalesce(o.deceased_first_name,'') || ' ' || coalesce(o.deceased_last_name,'')), '') as name,
             o.principal_name, o.burial, o.ceremony, o.total_pln, o.contract_signed_at,
             h.name as home_name, h.address as home_address, h.phone as home_phone
      from orders o join funeral_homes h on h.id = o.home_id where o.id = ${id}`;
    if (!o) return null;
    const items = await tx<{ label: string; price_pln: number }[]>`
      select c.label, p.price_pln from orders o
      cross join lateral unnest(o.selected_items) as k(item_key)
      join price_catalog c on c.item_key = k.item_key
      join price_items p on p.item_key = k.item_key and p.home_id = o.home_id
      where o.id = ${id} order by c.sort_order`;
    return { o, items };
  });
  if (!data) notFound();
  const { o, items } = data;
  const total = o.total_pln ?? 0;

  return (
    <div className="mx-auto flex max-w-[794px] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/panel/zlecenia/${id}`} className="text-sm font-semibold text-brand">
          ← Karta zlecenia
        </Link>
        <PrintButton />
      </div>
      <article className="rounded-[14px] border border-line bg-white p-6 print:border-0 print:p-[18mm]">
        <header className="mb-6 flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="font-serif text-[28px]">Kosztorys usługi pogrzebowej</h1>
            <p className="text-muted">
              {o.name ? `Pogrzeb: ${o.name}` : "Pogrzeb"} · {BURIAL_LABEL[o.burial]} · {CEREMONY_LABEL[o.ceremony].toLowerCase()}
            </p>
          </div>
          <div className="text-right text-[14px]">
            <p className="font-semibold">{o.home_name}</p>
            <p>{o.home_address}</p>
            <p>tel. {o.home_phone}</p>
          </div>
        </header>
        <p className="mb-3 text-[15px]">
          Dla: <strong>{o.principal_name}</strong> · {formatDate(new Date(), { year: "numeric" })}
        </p>
        <table className="w-full border-collapse text-[15px]">
          <caption className="sr-only">Pozycje kosztorysu</caption>
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th scope="col" className="py-2 font-semibold">Pozycja (standard cennika Ostoi)</th>
              <th scope="col" className="py-2 text-right font-semibold">Cena</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.label} className="border-b border-line-soft">
                <th scope="row" className="py-2 text-left font-normal">{it.label}</th>
                <td className="py-2 text-right">{formatPln(it.price_pln)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="pt-3 text-left font-bold">Cena łączna zakładu</th>
              <td className="pt-3 text-right text-lg font-bold">{formatPln(total)}</td>
            </tr>
          </tbody>
        </table>
        <div className="mt-5 rounded-xl bg-brand-tint px-4 py-3 text-[15px] text-brand-dark">
          <p className="flex justify-between font-semibold">
            <span>Zasiłek pogrzebowy ZUS dla członka rodziny</span>
            <span>{formatPln(FUNERAL_BENEFIT_PLN)}</span>
          </p>
          <p>
            {total <= FUNERAL_BENEFIT_PLN
              ? `Po opłaceniu usług zakładu z zasiłku zostaje ${formatPln(FUNERAL_BENEFIT_PLN - total)} na opłaty cmentarne, kwiaty i konsolację.`
              : `Koszt usług zakładu przekracza zasiłek o ${formatPln(total - FUNERAL_BENEFIT_PLN)}.`}
          </p>
        </div>
        <p className="mt-4 text-[13px] text-muted">
          Opłaty cmentarne i parafialne nie są częścią cennika zakładu.{" "}
          {o.contract_signed_at ? "Ceny potwierdzone umową." : "Kosztorys przed podpisaniem umowy – ceny zgodne z profilem zakładu w Ostoi."}
        </p>
      </article>
    </div>
  );
}
