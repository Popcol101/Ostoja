// Wysyłka powiadomień ze skrzynki nadawczej w bazie (tabela notifications).
// Push (web-push, klucze VAPID) do pracowników zakładu o nowym zapytaniu; SMS (SMSAPI) z linkiem dla rodziny.
// Bez kluczy działa „tryb testowy”: nic nie wychodzi, a powiadomienie dostaje status „pominieto” z opisem.
// W logach tylko identyfikatory – nigdy telefony, imiona ani nazwiska.
import "server-only";
import webpush from "web-push";
import { asServer } from "./db";
import { BURIAL_LABEL, CEREMONY_LABEL, type Burial, type Ceremony } from "./labels";

export type Claimed = {
  id: string;
  kind: "nowe_zapytanie" | "link_dla_rodziny";
  channel: "push" | "sms";
  home_id: string;
  attempts: number;
  home_name: string;
  home_phone: string;
  burial: Burial | null;
  ceremony: Ceremony | null;
  city_name: string | null;
  distance_km: number | null;
  family_phone: string | null;
  family_token: string | null;
};

type Outcome = { status: "wyslano" | "blad" | "pominieto"; error?: string };

export type PushPayload = { title: string; body: string; url: string; tag: string };

/** Treść push – widoczna na ekranie blokady, więc bez danych rodziny. */
export function pushPayload(n: Pick<Claimed, "burial" | "ceremony" | "city_name" | "distance_km">): PushPayload {
  const what = [n.burial ? BURIAL_LABEL[n.burial] : null, n.ceremony ? CEREMONY_LABEL[n.ceremony].toLowerCase() : null]
    .filter(Boolean)
    .join(", ");
  const where = n.city_name ? `${n.city_name}${n.distance_km != null ? `, ${n.distance_km.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} km` : ""}` : "";
  return {
    title: "Nowe zapytanie – odpowiedz w 15 minut",
    body: [what, where].filter(Boolean).join(" · ") || "Rodzina czeka na odpowiedź.",
    url: "/panel/zapytania",
    tag: "nowe-zapytanie",
  };
}

/** SMS z linkiem dla rodziny. Nadawca i podpis – zakład, nie Ostoja. */
export function smsText(n: Pick<Claimed, "home_name" | "home_phone" | "family_token">, appUrl: string): string {
  const link = `${appUrl.replace(/\/+$/, "")}/r/${n.family_token}`;
  return `Dzień dobry, tu ${n.home_name}. Terminy, koszty i dane do dokumentów: ${link} Pytania: ${n.home_phone}`;
}

/** „+48 600 100 200” → „48600100200” (format SMSAPI). */
export function smsNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (/^\d{9}$/.test(digits)) return `48${digits}`;
  if (/^48\d{9}$/.test(digits)) return digits;
  return null;
}

export type SmsConfig = { token: string; sender?: string; test: boolean };

export function smsConfig(env: NodeJS.ProcessEnv = process.env): SmsConfig | null {
  if (!env.SMSAPI_TOKEN) return null;
  return { token: env.SMSAPI_TOKEN, sender: env.SMSAPI_SENDER || undefined, test: env.SMSAPI_TEST === "true" };
}

export function smsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return smsConfig(env) !== null;
}

export async function sendSms(to: string, message: string, cfg: SmsConfig, fetcher: typeof fetch = fetch): Promise<Outcome> {
  const body = new URLSearchParams({ to, message, format: "json", encoding: "utf-8" });
  if (cfg.sender) body.set("from", cfg.sender);
  if (cfg.test) body.set("test", "1");
  const res = await fetcher("https://api.smsapi.pl/sms.do", {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as { error?: number; message?: string; count?: number } | null;
  if (!res.ok || !data || data.error) {
    // Kody 8–14 SMSAPI to błędy treści/numeru – ponawianie nic nie da.
    const permanent = data?.error !== undefined && data.error >= 8 && data.error <= 14;
    return { status: permanent ? "pominieto" : "blad", error: `SMSAPI ${data?.error ?? res.status}: ${data?.message ?? "brak odpowiedzi"}` };
  }
  return { status: "wyslano" };
}

function vapidReady(): boolean {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:opiekun@ostoja.invalid", pub, priv);
  return true;
}

async function sendPush(n: Claimed): Promise<Outcome> {
  if (!vapidReady()) return { status: "pominieto", error: "Powiadomienia push wyłączone (brak kluczy VAPID)" };
  const subs = await asServer((tx) => tx<{ id: string; endpoint: string; p256dh: string; auth: string }[]>`
    select id, endpoint, p256dh, auth from push_subscriptions where home_id = ${n.home_id}`);
  if (subs.length === 0) return { status: "pominieto", error: "Żadne urządzenie zakładu nie ma włączonych powiadomień" };

  const payload = JSON.stringify(pushPayload(n));
  let delivered = 0;
  let lastError = "";
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
        TTL: 15 * 60,
        urgency: "high",
        topic: "nowe-zapytanie",
      });
      delivered++;
      await asServer((tx) => tx`update push_subscriptions set last_used_at = now() where id = ${s.id}`);
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await asServer((tx) => tx`delete from push_subscriptions where id = ${s.id}`); // urządzenie wycofało zgodę
      } else {
        lastError = `push ${status ?? "?"}`;
      }
    }
  }
  if (delivered > 0) return { status: "wyslano" };
  return lastError ? { status: "blad", error: lastError } : { status: "pominieto", error: "Wszystkie subskrypcje wygasły" };
}

async function sendFamilySms(n: Claimed): Promise<Outcome> {
  const cfg = smsConfig();
  if (!cfg) return { status: "pominieto", error: "SMS w trybie testowym (brak klucza SMSAPI) – nic nie wysłano" };
  const to = n.family_phone ? smsNumber(n.family_phone) : null;
  if (!to || !n.family_token) return { status: "pominieto", error: "Brak poprawnego numeru telefonu" };
  return sendSms(to, smsText(n, process.env.APP_URL ?? "http://localhost:3000"), cfg);
}

export type OutboxResult = { wyslano: number; pominieto: number; blad: number };

/** Wysyła oczekujące powiadomienia. Bezpieczne przy równoległych wywołaniach (rezerwacja w bazie). */
export async function processOutbox(limit = 50): Promise<OutboxResult> {
  const result: OutboxResult = { wyslano: 0, pominieto: 0, blad: 0 };
  const batch = await asServer(async (tx) => {
    await tx`select skip_stale_offer_notifications()`;
    return tx<Claimed[]>`select * from claim_notifications(${limit})`;
  });
  for (const n of batch) {
    let outcome: Outcome;
    try {
      outcome = n.channel === "push" ? await sendPush(n) : await sendFamilySms(n);
    } catch (e) {
      outcome = { status: "blad", error: e instanceof Error ? e.message.slice(0, 200) : "nieznany błąd" };
    }
    await asServer((tx) => tx`select complete_notification(${n.id}, ${outcome.status}::notification_status, ${outcome.error ?? null})`);
    result[outcome.status]++;
    if (outcome.status !== "wyslano") console.info(`[powiadomienia] ${n.id} ${n.channel} → ${outcome.status}: ${outcome.error ?? ""}`);
  }
  return result;
}
