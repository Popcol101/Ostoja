// Błędy z przeglądarki (granice błędów error.tsx). Przyjmujemy tylko digest, ścieżkę i krótki komunikat;
// wszystko czyści src/lib/error-report.ts. Limit: 20 zgłoszeń na minutę z jednego adresu.
import { z } from "zod";
import { reportError } from "@/lib/error-report";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  path: z.string().max(500),
  message: z.string().max(1000).optional().default(""),
  digest: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return new Response(null, { status: 403 });
  if (!(await rateLimit("bledy", 20, 60_000))) return new Response(null, { status: 429 });
  const body = await req.text();
  if (body.length > 4000) return new Response(null, { status: 413 });
  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    return new Response(null, { status: 400 });
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) return new Response(null, { status: 400 });
  await reportError({
    kind: "przegladarka",
    route: parsed.data.path,
    // Błąd z serwera ma digest i jest już zapisany po stronie serwera; z przeglądarki bierzemy komunikat tylko bez digestu.
    message: parsed.data.digest ? "błąd serwera pokazany w przeglądarce" : parsed.data.message,
    digest: parsed.data.digest,
  });
  return new Response(null, { status: 204 });
}
