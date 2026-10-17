import { expect, type APIRequestContext } from "@playwright/test";

// Ostatni e-mail wysłany na adres (atrapa Brevo w tests/e2e/mock-supabase.mjs) i link z jego treści.
export async function lastMail(request: APIRequestContext, to: string) {
  const res = await request.get(`http://127.0.0.1:54399/mock/outbox?to=${encodeURIComponent(to)}`);
  expect(res.status(), `brak e-maila na ${to}`).toBe(200);
  const mail = (await res.json()) as { subject: string; html: string; text: string; tags: string[] };
  const link = mail.text.match(/https?:\/\/\S+/)?.[0] ?? "";
  return { ...mail, link, path: link.replace(/^https?:\/\/[^/]+/, "") };
}

export async function noMail(request: APIRequestContext, to: string) {
  const res = await request.get(`http://127.0.0.1:54399/mock/outbox?to=${encodeURIComponent(to)}`);
  expect(res.status()).toBe(404);
}
