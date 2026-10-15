"use client";

export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const phone = process.env.NEXT_PUBLIC_OPIEKUN_PHONE ?? "+48 000 000 000";
  return (
    <main className="flex min-h-dvh items-center justify-center bg-ground-family px-4">
      <div role="alert" className="max-w-md rounded-[14px] border border-line bg-card px-5 py-8 text-center">
        <h1 className="font-serif text-[26px]">Nie udało się wczytać strony</h1>
        <p className="mt-2 text-muted">
          Sprawdź połączenie z internetem i spróbuj ponownie. Możesz też zadzwonić do opiekuna Ostoi: {phone}.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-[10px] bg-brand px-4 font-semibold text-white"
          >
            Spróbuj ponownie
          </button>
          <a
            href={`tel:${phone.replace(/\s/g, "")}`}
            className="inline-flex min-h-11 items-center justify-center rounded-[10px] border-[1.5px] border-brand px-4 font-semibold text-brand no-underline"
          >
            Zadzwoń
          </a>
        </div>
      </div>
    </main>
  );
}
