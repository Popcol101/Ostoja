// Prosty limit prób na adres IP (w pamięci procesu). Na produkcji z wieloma instancjami:
// tabela w bazie albo Redis (Upstash) – patrz docs/STAN.md.
import { headers } from "next/headers";

const hits = new Map<string, number[]>();

export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const id = `${key}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(id, recent);
  return recent.length <= max;
}
