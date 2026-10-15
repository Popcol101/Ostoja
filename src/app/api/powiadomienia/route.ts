// Wysyłka kolejki powiadomień. Wywołuje ją harmonogram (co minutę) z nagłówkiem
// „Authorization: Bearer <CRON_SECRET>” – Vercel Cron, cron w Supabase (pg_net) albo cron-job.org.
// Akcje aplikacji wysyłają też od razu po zapisie (after() w akcjach), harmonogram łapie resztę.
import { timingSafeEqual } from "node:crypto";
import { processOutbox } from "@/lib/notify";

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
  const result = await processOutbox();
  return Response.json(result);
}

export const GET = handle; // Vercel Cron wywołuje GET
export const POST = handle;
