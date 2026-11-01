// Fakturownia: https://github.com/fakturownia/API (faktury) i KSeF.md (gov_save_and_send, gov_status, gov_id).
// Konto = subdomena (<konto>.fakturownia.pl), klucz = „Kod autoryzacyjny API”. Do KSeF wysyła sama Fakturownia.
import type { InvoiceDraft, InvoicingProvider, IssueResult, KsefStatus } from "./types";

const KSEF_STATUSES = new Set(["processing", "ok", "send_error", "offline", "offline_error"]);

export function fakturowniaBase(account: string): string {
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(account)) throw new Error("Nieprawidłowa nazwa konta");
  const override = process.env.FAKTUROWNIA_BASE_URL; // testy: atrapa API
  return override ? `${override.replace(/\/$/, "")}/${account}` : `https://${account}.fakturownia.pl`;
}

export function fakturowniaBody(token: string, d: InvoiceDraft) {
  return {
    api_token: token,
    gov_save_and_send: d.sendToKsef,
    invoice: {
      kind: "vat",
      issue_date: d.issueDate,
      sell_date: d.issueDate,
      payment_to: d.paymentDue,
      buyer_company: false,
      buyer_first_name: d.buyer.firstName,
      buyer_last_name: d.buyer.lastName,
      buyer_street: d.buyer.street,
      buyer_post_code: d.buyer.postCode,
      buyer_city: d.buyer.city,
      buyer_country: "PL",
      ...(d.buyer.email ? { buyer_email: d.buyer.email } : {}),
      description: d.description,
      positions: d.positions.map((p) => ({ name: p.name, tax: d.vat === "zw" ? "zw" : Number(d.vat), total_price_gross: p.grossPln, quantity: 1 })),
    },
  };
}

/** Komunikat do zapisania w bazie: tylko kody pól i statusy, bez treści faktury (dane osobowe). */
function safeError(status: number, body: unknown): string {
  let keys = "";
  if (body && typeof body === "object") {
    const msg = (body as { message?: unknown }).message;
    if (msg && typeof msg === "object") keys = Object.keys(msg).slice(0, 5).join(", ");
  }
  return `Fakturownia odrzuciła fakturę (HTTP ${status})${keys ? `: popraw pola ${keys}` : ""}.`.slice(0, 300);
}

function ksefNumber(v: unknown): string | null {
  return typeof v === "string" && /^[0-9]{10}-[0-9]{8}-[0-9A-Z]{6,40}$/.test(v) ? v : null;
}

export function fakturownia(account: string, token: string, fetchImpl: typeof fetch = fetch): InvoicingProvider {
  const base = fakturowniaBase(account);
  return {
    async issue(d: InvoiceDraft): Promise<IssueResult> {
      let res: Response;
      try {
        res = await fetchImpl(`${base}/invoices.json`, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify(fakturowniaBody(token, d)),
          signal: AbortSignal.timeout(15_000),
        });
      } catch {
        return { ok: false, retry: true, error: "Brak połączenia z Fakturownią. Ponowimy za kilka minut." };
      }
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (res.status === 401 || res.status === 403) return { ok: false, retry: false, error: "Fakturownia odrzuciła klucz API. Sprawdź połączenie w profilu zakładu." };
      if (res.status >= 500 || res.status === 429) return { ok: false, retry: true, error: `Fakturownia chwilowo nie odpowiada (HTTP ${res.status}). Ponowimy.` };
      if (!res.ok || !body || body.id === undefined) return { ok: false, retry: false, error: safeError(res.status, body) };
      const tokenPart = typeof body.token === "string" && /^[A-Za-z0-9]+$/.test(body.token) ? body.token : null;
      const gov = typeof body.gov_status === "string" && KSEF_STATUSES.has(body.gov_status) ? body.gov_status : null;
      return {
        ok: true,
        externalId: String(body.id),
        number: typeof body.number === "string" ? body.number.slice(0, 60) : null,
        viewUrl: tokenPart && base.startsWith("https://") ? `${base}/invoice/${tokenPart}` : null,
        ksefStatus: d.sendToKsef ? (gov ?? "processing") : null,
        ksefNumber: ksefNumber(body.gov_id),
      };
    },
    async ksefStatus(externalId: string): Promise<KsefStatus | null> {
      if (!/^[0-9]{1,20}$/.test(externalId)) return null;
      const q = new URLSearchParams({ api_token: token, "fields[invoice]": "gov_status,gov_id" });
      try {
        const res = await fetchImpl(`${base}/invoices/${externalId}.json?${q}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(15_000) });
        if (!res.ok) return null;
        const body = (await res.json()) as Record<string, unknown>;
        const gov = typeof body.gov_status === "string" && KSEF_STATUSES.has(body.gov_status) ? body.gov_status : null;
        return { ksefStatus: gov, ksefNumber: ksefNumber(body.gov_id) };
      } catch {
        return null;
      }
    },
  };
}
