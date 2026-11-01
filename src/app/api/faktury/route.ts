// Wystawianie faktur z kolejki i dociąganie numerów KSeF. Wywołuje harmonogram (np. co 5 minut)
// z nagłówkiem „Authorization: Bearer <CRON_SECRET>” – tak jak /api/powiadomienia.
import { timingSafeEqual } from "node:crypto";
import { integrationsEnabled } from "@/lib/crypto";
import { processInvoices } from "@/lib/invoicing/process";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

async function handle(req: Request) {
  if (!authorized(req)) return Response.json({ error: "Brak dostępu" }, { status: 401 });
  if (!integrationsEnabled()) return Response.json({ issued: 0, failed: 0, polled: 0, note: "Brak INTEGRATIONS_KEY" });
  return Response.json(await processInvoices());
}

export const GET = handle;
export const POST = handle;
