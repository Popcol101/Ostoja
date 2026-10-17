"use client";
// Komponenty interaktywne: licznik 15 minut, kopiowanie linku, stan offline, potwierdzenie wysyłki formularza.
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";

function remaining(expiresAt: string, now: number) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000));
}

/** Licznik czasu na odpowiedź. Po upływie odświeża stronę (zapytanie trafia do innego zakładu). */
export function Countdown({ expiresAt, totalSeconds = 900 }: { expiresAt: string; totalSeconds?: number }) {
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const left = now === null ? totalSeconds : remaining(expiresAt, now);
  useEffect(() => {
    if (now !== null && left === 0) router.refresh();
  }, [left, now, router]);

  const minutes = Math.floor(left / 60);
  const seconds = String(left % 60).padStart(2, "0");
  const pct = Math.min(100, Math.round((left / totalSeconds) * 100));

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm">
        <span className="font-semibold">Odpowiedz w 15 minut</span>
        <span className="font-semibold text-warn-ink" aria-live="polite">
          {left > 0 ? `zostało ${minutes}:${seconds}` : "czas minął"}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-warn-tint" aria-hidden="true">
        <div className="h-full rounded-full bg-warn transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function CopyButton({ text, label = "Kopiuj link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          setDone(false);
        }
      }}
      className="inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-brand bg-card px-4 text-[15px] font-semibold text-brand hover:bg-brand-tint"
    >
      <span aria-live="polite">{done ? "Skopiowano" : label}</span>
    </button>
  );
}

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/** Pasek „brak połączenia” – stan offline wspólny dla wszystkich ekranów. */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="bg-warn-tint px-4 py-2 text-center text-sm font-semibold text-warn-ink">
      Brak połączenia z internetem. Zmiany zapiszą się, gdy połączenie wróci – nie zamykaj tej strony.
    </div>
  );
}

/** Przycisk wysyłki pokazujący stan zapisu. */
export function SubmitButton({
  children,
  pendingLabel = "Zapisuję…",
  variant = "primary",
  full,
  name,
  value,
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  full?: boolean;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const cls =
    variant === "primary"
      ? "bg-brand text-white border border-brand hover:bg-brand-dark"
      : variant === "danger"
        ? "bg-card text-danger border-[1.5px] border-danger hover:bg-danger-tint"
        : "bg-card text-brand border-[1.5px] border-brand hover:bg-brand-tint";
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-disabled={pending}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-[15px] font-semibold disabled:opacity-60 ${cls} ${full ? "w-full" : ""}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function PrintButton({ label = "Drukuj lub zapisz jako PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-brand bg-brand px-4 text-[15px] font-semibold text-white hover:bg-brand-dark"
    >
      {label}
    </button>
  );
}

/** Zgłasza błąd z granicy błędów do /api/bledy (bez danych osobowych – czyści je serwer). */
export function useReportError(error: Error & { digest?: string }) {
  useEffect(() => {
    try {
      void fetch("/api/bledy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ path: window.location.pathname, message: `${error.name}: ${error.message}`.slice(0, 500), digest: error.digest }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // brak sieci – trudno
    }
  }, [error]);
}

/** Pole hasła z przyciskiem „Pokaż” – łatwiej wpisać długie hasło na telefonie. */
export function PasswordInput({
  id,
  name,
  autoComplete,
  describedBy,
  minLength,
}: {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  describedBy?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex gap-2">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        required
        minLength={minLength}
        maxLength={200}
        aria-describedby={describedBy}
        className="min-h-12 w-full min-w-0 rounded-[10px] border border-field bg-card px-3.5 text-[16px] text-ink"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-controls={id}
        aria-label={visible ? "Ukryj hasło" : "Pokaż hasło"}
        className="min-h-12 min-w-[76px] shrink-0 rounded-[10px] border border-field bg-card px-3 text-[15px] font-semibold text-brand"
      >
        {visible ? "Ukryj" : "Pokaż"}
      </button>
    </div>
  );
}
