// Zdjęcie grobu po wizycie – dla klienta z linkiem zamówienia (token) albo dla usługodawcy (sesja).
import { asAnon, withUser } from "@/lib/db";
import { getUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

function image(row: { photo: Buffer; photo_mime: string } | undefined) {
  if (!row) return new Response("Nie znaleziono", { status: 404 });
  return new Response(new Uint8Array(row.photo), {
    headers: {
      "Content-Type": row.photo_mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const visit = url.searchParams.get("v") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(visit)) return new Response("Nie znaleziono", { status: 404 });
  const token = url.searchParams.get("t");
  if (token) {
    if (!/^[a-f0-9]{48}$/.test(token)) return new Response("Nie znaleziono", { status: 404 });
    const [row] = await asAnon((tx) => tx<{ photo: Buffer; photo_mime: string }[]>`select * from grave_visit_photo(${token}, ${visit})`);
    return image(row);
  }
  const userId = await getUserId();
  if (!userId) return new Response("Brak dostępu", { status: 401 });
  const [row] = await withUser(userId, (tx) => tx<{ photo: Buffer; photo_mime: string }[]>`select * from provider_visit_photo(${visit})`);
  return image(row);
}
