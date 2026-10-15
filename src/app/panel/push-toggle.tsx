"use client";
// Włączanie powiadomień push o nowych zapytaniach na tym urządzeniu (telefon w terenie, komputer w biurze).
import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription } from "./actions";

type State = "sprawdzam" | "brak-wsparcia" | "ios-ekran" | "zablokowane" | "wylaczone" | "wlaczone" | "pracuje" | "blad";

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceName(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Urządzenie";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "przeglądarka";
  return `${os} · ${browser}`;
}

const TEXT: Record<State, string> = {
  sprawdzam: "Sprawdzam to urządzenie…",
  "brak-wsparcia": "Ta przeglądarka nie obsługuje powiadomień. Użyj Chrome, Edge, Firefox albo Safari.",
  "ios-ekran": "Na iPhonie dodaj panel do ekranu początkowego (Udostępnij → Do ekranu początkowego), otwórz go stamtąd i włącz powiadomienia.",
  zablokowane: "Powiadomienia są zablokowane w ustawieniach przeglądarki. Zezwól na nie dla tej strony i odśwież.",
  wylaczone: "Włącz, żeby telefon dał znać o nowym zapytaniu – także w nocy, przy zablokowanym ekranie.",
  wlaczone: "To urządzenie dostaje powiadomienia o nowych zapytaniach.",
  pracuje: "Chwileczkę…",
  blad: "Nie udało się włączyć powiadomień. Spróbuj ponownie.",
};

export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("sprawdzam");

  useEffect(() => {
    (async () => {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      if (!supported) return setState(ios && !standalone ? "ios-ekran" : "brak-wsparcia");
      if (!publicKey) return setState("brak-wsparcia");
      if (Notification.permission === "denied") return setState("zablokowane");
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "wlaczone" : "wylaczone");
      } catch {
        setState("blad");
      }
    })();
  }, [publicKey]);

  async function enable() {
    if (!publicKey) return;
    setState("pracuje");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "zablokowane" : "wylaczone");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(publicKey) });
      const res = await savePushSubscription(sub.toJSON(), deviceName());
      setState(res.ok ? "wlaczone" : "blad");
    } catch {
      setState("blad");
    }
  }

  async function disable() {
    setState("pracuje");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("wylaczone");
    } catch {
      setState("blad");
    }
  }

  const on = state === "wlaczone";
  const canToggle = state === "wlaczone" || state === "wylaczone" || state === "blad";

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-start gap-2 text-[15px]" aria-live="polite">
        {on ? <Bell size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" /> : <BellOff size={18} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />}
        <span>{TEXT[state]}</span>
      </p>
      {canToggle ? (
        <button
          type="button"
          onClick={on ? disable : enable}
          className={`inline-flex min-h-11 items-center justify-center self-start rounded-[10px] px-4 text-[15px] font-semibold ${
            on ? "border-[1.5px] border-brand bg-card text-brand hover:bg-brand-tint" : "border border-brand bg-brand text-white hover:bg-brand-dark"
          }`}
        >
          {on ? "Wyłącz na tym urządzeniu" : "Włącz powiadomienia"}
        </button>
      ) : null}
    </div>
  );
}
