import type { Metadata } from "next";
import { SubmitButton } from "@/components/client";
import { Flash, type SearchParams } from "@/components/flash";
import { Badge, Card, CardTitle, EmptyState, Field, Input, PageTitle, Select } from "@/components/ui";
import { withUser } from "@/lib/db";
import { formatDateTime, formatPln } from "@/lib/format";
import { requireMember } from "@/lib/session";
import { STOCK_KINDS, STOCK_KIND_LABEL, lowStock, type StockKind } from "@/lib/stock";
import { addStockItem, editStockItem, installStockTemplate, moveStock } from "../actions";

export const metadata: Metadata = { title: "Magazyn" };
export const dynamic = "force-dynamic";

type Item = {
  id: string;
  kind: StockKind;
  name: string;
  material: string | null;
  supplier: string | null;
  price_pln: number;
  qty: number;
  min_qty: number;
  active: boolean;
};
type Move = { id: string; name: string; delta: number; qty_after: number; reason: string; note: string | null; created_at: Date; order_id: string | null };

const REASON_LABEL: Record<string, string> = { dostawa: "Dostawa", zlecenie: "Do zlecenia", zwrot: "Zwrot ze zlecenia", korekta: "Korekta" };

export default async function StockPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireMember();
  const canEdit = me.role !== "ekipa";
  const { items, moves } = await withUser(me.userId, async (tx) => {
    const items = await tx<Item[]>`
      select id, kind, name, material, supplier, price_pln, qty, min_qty, active
      from stock_items where home_id = ${me.homeId} order by active desc, kind, name`;
    const moves = await tx<Move[]>`
      select m.id, s.name, m.delta, m.qty_after, m.reason, m.note, m.created_at, m.order_id
      from stock_movements m join stock_items s on s.id = m.stock_item_id
      where m.home_id = ${me.homeId} order by m.created_at desc limit 15`;
    return { items, moves };
  });
  const low = items.filter((i) => i.active && lowStock(i.qty, i.min_qty));

  return (
    <>
      <PageTitle sub="Trumny, urny i dodatki: stan, ceny i historia. Produkt przypisany do zlecenia schodzi ze stanu sam.">Magazyn</PageTitle>
      <Flash searchParams={searchParams} />

      {items.length === 0 ? (
        <EmptyState
          title="Magazyn jest pusty"
          action={
            canEdit ? (
              <form action={installStockTemplate}>
                <SubmitButton pendingLabel="Dodaję…">Dodaj podstawowy asortyment</SubmitButton>
              </form>
            ) : undefined
          }
        >
          {canEdit
            ? "Zacznij od podstawowego asortymentu (4 trumny, 4 urny, 2 dodatki z przykładowymi cenami) i zmień ceny na swoje – albo dodaj własne produkty niżej."
            : "Produkty dodaje właściciel albo biuro."}
        </EmptyState>
      ) : (
        <>
          {low.length > 0 ? (
            <p role="status" className="mb-4 rounded-xl bg-warn-tint px-4 py-3 text-[15px] text-warn-ink">
              <span className="font-semibold">Do zamówienia: </span>
              {low.map((i) => `${i.name} (${i.qty} szt.)`).join(", ")}
            </p>
          ) : null}
          <div className="flex flex-col gap-4">
            {STOCK_KINDS.map((kind) => {
              const rows = items.filter((i) => i.kind === kind);
              if (rows.length === 0) return null;
              return (
                <Card key={kind}>
                  <CardTitle aside={`${rows.reduce((n, r) => n + r.qty, 0)} szt.`}>{STOCK_KIND_LABEL[kind]}</CardTitle>
                  <ul className="flex flex-col divide-y divide-line-soft">
                    {rows.map((i) => (
                      <li key={i.id} className="py-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <p>
                            <span className={i.active ? "font-semibold" : "font-semibold text-muted line-through"}>{i.name}</span>
                            {i.material ? <span className="block text-[13px] text-muted">{i.material}</span> : null}
                          </p>
                          <p className="flex items-baseline gap-3">
                            <span className="tabular-nums">{formatPln(i.price_pln)}</span>
                            <span className="text-[17px] font-semibold tabular-nums">{i.qty} szt.</span>
                            {!i.active ? <Badge>Wycofany</Badge> : lowStock(i.qty, i.min_qty) ? <Badge tone="warn">{i.qty === 0 ? "Brak" : "Mało"}</Badge> : null}
                          </p>
                        </div>
                        {canEdit ? (
                          <div className="mt-2 flex flex-wrap gap-x-4">
                            <details className="group">
                              <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand">Przyjmij dostawę</summary>
                              <form action={moveStock} className="mt-1 flex flex-wrap items-end gap-2 pb-2">
                                <input type="hidden" name="itemId" value={i.id} />
                                <input type="hidden" name="mode" value="dostawa" />
                                <Field id={`in-${i.id}`} label="Ile sztuk przyszło">
                                  <Input id={`in-${i.id}`} name="qty" type="number" min={1} max={1000} defaultValue={1} className="w-28" required />
                                </Field>
                                <Field id={`in-note-${i.id}`} label="Uwagi (np. nr faktury)">
                                  <Input id={`in-note-${i.id}`} name="note" maxLength={200} />
                                </Field>
                                <SubmitButton>Przyjmij</SubmitButton>
                              </form>
                            </details>
                            <details>
                              <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand">Popraw stan</summary>
                              <form action={moveStock} className="mt-1 flex flex-wrap items-end gap-2 pb-2">
                                <input type="hidden" name="itemId" value={i.id} />
                                <input type="hidden" name="mode" value="korekta" />
                                <Field id={`fix-${i.id}`} label="Stan po spisie">
                                  <Input id={`fix-${i.id}`} name="qty" type="number" min={0} max={1000} defaultValue={i.qty} className="w-28" required />
                                </Field>
                                <Field id={`fix-note-${i.id}`} label="Powód">
                                  <Input id={`fix-note-${i.id}`} name="note" maxLength={200} required minLength={3} />
                                </Field>
                                <SubmitButton>Zapisz stan</SubmitButton>
                              </form>
                            </details>
                            <details>
                              <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand">Edytuj</summary>
                              <form action={editStockItem} className="mt-1 grid gap-2 pb-2 sm:grid-cols-3 sm:items-end">
                                <input type="hidden" name="itemId" value={i.id} />
                                <Field id={`name-${i.id}`} label="Nazwa">
                                  <Input id={`name-${i.id}`} name="name" defaultValue={i.name} maxLength={120} required />
                                </Field>
                                <Field id={`price-${i.id}`} label="Cena (zł)">
                                  <Input id={`price-${i.id}`} name="price_pln" inputMode="decimal" defaultValue={i.price_pln} required />
                                </Field>
                                <Field id={`min-${i.id}`} label="Minimum na stanie">
                                  <Input id={`min-${i.id}`} name="min_qty" type="number" min={0} max={1000} defaultValue={i.min_qty} required />
                                </Field>
                                <label className="flex min-h-11 items-center gap-3">
                                  <input type="checkbox" name="active" value="tak" defaultChecked={i.active} className="size-5 accent-brand" />W ofercie
                                </label>
                                <SubmitButton>Zapisz</SubmitButton>
                              </form>
                            </details>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {canEdit ? (
        <Card className="mt-4">
          <CardTitle>Dodaj produkt</CardTitle>
          <form action={addStockItem} className="grid gap-3 sm:grid-cols-2">
            <Field id="new-kind" label="Rodzaj">
              <Select id="new-kind" name="kind" defaultValue="trumna">
                <option value="trumna">Trumna</option>
                <option value="urna">Urna</option>
                <option value="inne">Inne</option>
              </Select>
            </Field>
            <Field id="new-name" label="Nazwa">
              <Input id="new-name" name="name" maxLength={120} required />
            </Field>
            <Field id="new-material" label="Materiał (nieobowiązkowe)">
              <Input id="new-material" name="material" maxLength={120} />
            </Field>
            <Field id="new-supplier" label="Dostawca (nieobowiązkowe)">
              <Input id="new-supplier" name="supplier" maxLength={120} />
            </Field>
            <Field id="new-price" label="Cena dla rodziny (zł)">
              <Input id="new-price" name="price_pln" inputMode="decimal" required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="new-qty" label="Na stanie">
                <Input id="new-qty" name="qty" type="number" min={0} max={1000} defaultValue={0} required />
              </Field>
              <Field id="new-min" label="Minimum">
                <Input id="new-min" name="min_qty" type="number" min={0} max={1000} defaultValue={1} required />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Dodaj produkt</SubmitButton>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="mt-4">
        <CardTitle>Ostatnie ruchy</CardTitle>
        {moves.length === 0 ? (
          <p className="text-muted">Tu pojawią się dostawy, wydania do zleceń i korekty.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line-soft text-[15px]">
            {moves.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-x-3 py-2">
                <span>
                  <span className="font-semibold">{REASON_LABEL[m.reason] ?? m.reason}</span> · {m.name}
                  {m.note ? <span className="text-muted"> · {m.note}</span> : null}
                </span>
                <span className="tabular-nums text-muted">
                  {m.delta > 0 ? `+${m.delta}` : m.delta} → {m.qty_after} szt. · {formatDateTime(m.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
