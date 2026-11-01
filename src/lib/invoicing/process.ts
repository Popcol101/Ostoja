// Wystawianie faktur z kolejki (tabela invoices). Wywołuje akcja po podpisaniu umowy (after()) i harmonogram /api/faktury.
// Klucz API odszyfrowuje tylko serwer, tylko na czas wywołania. Do bazy i logów nie trafia treść faktury.
import "server-only";
import { decryptSecret } from "@/lib/crypto";
import { asServer, type Tx } from "@/lib/db";
import { buildInvoiceDraft, type OrderForInvoice } from "./draft";
import { fakturownia } from "./fakturownia";
import type { InvoicingProvider, VatRate } from "./types";

const MAX_ATTEMPTS = 5;

type Claimed = { order_id: string; home_id: string; provider: string; attempts: number };
type Conn = { provider: string; account: string; secret_enc: string; vat_rate: VatRate; ksef_b2c: boolean };

function providerFor(conn: Conn, homeId: string): InvoicingProvider | null {
  if (conn.provider !== "fakturownia") return null;
  return fakturownia(conn.account, decryptSecret(conn.secret_enc, homeId));
}

function warsawToday(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());
}

async function fail(tx: Tx, orderId: string, error: string, retry: boolean, attempts: number) {
  if (retry && attempts < MAX_ATTEMPTS) {
    await tx`update invoices set last_error = ${error}, updated_at = now() where order_id = ${orderId}`;
  } else {
    await tx`update invoices set status = 'blad', last_error = ${error}, updated_at = now() where order_id = ${orderId}`;
  }
}

type Loaded = { conn: Conn | undefined; order: OrderForInvoice | undefined; items: { label: string; price_pln: number }[] };
type Outcome =
  | { ok: true; result: Extract<Awaited<ReturnType<InvoicingProvider["issue"]>>, { ok: true }>; issueDate: string; gross: number }
  | { ok: false; error: string; retry: boolean };

async function issueOne(inv: Claimed, { conn, order, items }: Loaded): Promise<Outcome> {
  if (!conn) return { ok: false, error: "Program do faktur nie jest już połączony.", retry: false };
  if (!order) return { ok: false, error: "Nie znaleziono zlecenia.", retry: false };
  const built = buildInvoiceDraft(order, items, { vat: conn.vat_rate, ksefB2c: conn.ksef_b2c, today: warsawToday() });
  if (!built.ok) return { ok: false, error: built.error, retry: false };
  let provider: InvoicingProvider | null;
  try {
    provider = providerFor(conn, inv.home_id);
  } catch {
    return { ok: false, error: "Nie udało się odczytać klucza API. Połącz program do faktur jeszcze raz.", retry: false };
  }
  if (!provider) return { ok: false, error: "Ten program do faktur nie jest jeszcze obsługiwany. Wpisz fakturę ręcznie.", retry: false };
  const r = await provider.issue(built.draft);
  if (!r.ok) return { ok: false, error: r.error, retry: r.retry };
  return { ok: true, result: r, issueDate: built.draft.issueDate, gross: built.draft.positions.reduce((s, p) => s + p.grossPln, 0) };
}

export async function processInvoices(limit = 10): Promise<{ issued: number; failed: number; polled: number }> {
  let issued = 0;
  let failed = 0;
  const claimed = await asServer((tx) => tx<Claimed[]>`select order_id, home_id, provider, attempts from claim_invoices(${limit})`);
  for (const inv of claimed) {
    // 1) Dane z bazy (krótka transakcja), 2) wywołanie programu do faktur poza transakcją, 3) zapis wyniku.
    const data = await asServer(async (tx) => {
      const [conn] = await tx<Conn[]>`select provider, account, secret_enc, vat_rate, ksef_b2c from invoicing_connections where home_id = ${inv.home_id}`;
      const [order] = await tx<OrderForInvoice[]>`
        select principal_name, principal_email, principal_street, principal_post_code, principal_city,
               deceased_first_name, deceased_last_name
        from orders where id = ${inv.order_id}`;
      const items = await tx<{ label: string; price_pln: number }[]>`
        select c.label, p.price_pln
        from orders o cross join lateral unnest(o.selected_items) as k(item_key)
        join price_catalog c on c.item_key = k.item_key
        join price_items p on p.item_key = k.item_key and p.home_id = o.home_id
        where o.id = ${inv.order_id} order by c.sort_order`;
      return { conn, order, items };
    });
    const outcome = await issueOne(inv, data);
    await asServer(async (tx) => {
      if (outcome.ok) {
        const r = outcome.result;
        await tx`
          update invoices set status = 'wystawiona', external_id = ${r.externalId}, number = ${r.number}, issued_on = ${outcome.issueDate},
            gross_pln = ${outcome.gross}, view_url = ${r.viewUrl}, ksef_status = ${r.ksefStatus}, ksef_number = ${r.ksefNumber},
            last_error = null, updated_at = now()
          where order_id = ${inv.order_id}`;
      } else {
        await fail(tx, inv.order_id, outcome.error, outcome.retry, inv.attempts);
      }
    });
    if (outcome.ok) issued++;
    else failed++;
  }
  const polled = await pollKsef();
  return { issued, failed, polled };
}

/** Faktury wysłane do KSeF: dociąga numer KSeF, gdy program go nada. */
async function pollKsef(): Promise<number> {
  const rows = await asServer((tx) => tx<{ order_id: string; home_id: string; external_id: string }[]>`
    select order_id, home_id, external_id from invoices
    where status = 'wystawiona' and ksef_status = 'processing' and external_id is not null
      and updated_at < now() - interval '1 minute'
    order by updated_at limit 10`);
  let n = 0;
  for (const row of rows) {
    const [conn] = await asServer((tx) => tx<Conn[]>`
      select provider, account, secret_enc, vat_rate, ksef_b2c from invoicing_connections where home_id = ${row.home_id}`);
    if (!conn) continue;
    let provider: InvoicingProvider | null = null;
    try {
      provider = providerFor(conn, row.home_id);
    } catch {
      continue;
    }
    const s = provider ? await provider.ksefStatus(row.external_id) : null;
    await asServer((tx) => tx`
      update invoices set ksef_status = coalesce(${s?.ksefStatus ?? null}, ksef_status),
        ksef_number = coalesce(${s?.ksefNumber ?? null}, ksef_number), updated_at = now()
      where order_id = ${row.order_id}`);
    n++;
  }
  return n;
}
