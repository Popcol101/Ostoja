"use client";
import { useReportError } from "@/components/client";

export default function PanelError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useReportError(error);
  return (
    <div role="alert" className="rounded-[14px] border border-line bg-card px-5 py-8 text-center">
      <p className="text-[17px] font-semibold">Nie udało się wczytać tej strony.</p>
      <p className="mx-auto mt-1 max-w-md text-muted">
        Sprawdź połączenie z internetem i spróbuj ponownie. Jeśli problem wraca, zadzwoń do opiekuna Ostoi.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 inline-flex min-h-11 items-center rounded-[10px] bg-brand px-4 font-semibold text-white"
      >
        Spróbuj ponownie
      </button>
    </div>
  );
}
