// Limit prób na adres IP, w bazie (wspólny dla wszystkich instancji serwera).
// Do bazy trafia tylko skrót SHA-256 z rodzaju akcji i adresu IP, nie sam adres.
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { asServer } from "./db";

export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
  const hashed = createHash("sha256").update(`${key}:${ip}:${process.env.SESSION_SECRET ?? ""}`).digest("hex").slice(0, 32);
  const windowS = Math.max(1, Math.round(windowMs / 1000));
  const [row] = await asServer((tx) => tx<{ ok: boolean }[]>`select hit_rate_limit(${`${key}:${hashed}`}, ${max}, ${windowS}) as ok`);
  return row?.ok ?? false;
}
