import { messageText } from "@/lib/messages";
import { Notice } from "./ui";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

/** Komunikat po akcji (parametry ?ok= i ?blad= w adresie). */
export async function Flash({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // Pokazujemy tylko znane komunikaty (kody z src/lib/messages.ts), nigdy tekst z adresu.
  const ok = messageText(first(sp.ok));
  const error = messageText(first(sp.blad));
  if (!ok && !error) return null;
  return <div className="mb-4">{error ? <Notice tone="danger">{error}</Notice> : <Notice>{ok}</Notice>}</div>;
}

export async function param(searchParams: SearchParams, key: string): Promise<string | undefined> {
  return first((await searchParams)[key]);
}
