import type { Obituary } from "@/lib/obituary";

// Klepsydra w klasycznym układzie: czarna ramka, znak u góry, imię i nazwisko największe, wyśrodkowany tekst szeryfowy.
// Rozmiary w jednostkach kontenera (cqw), więc podgląd, wydruk A4 i strona w sieci wyglądają tak samo w każdej szerokości.

export function ObituarySymbolMark({ symbol, className }: { symbol: Obituary["symbol"]; className?: string }) {
  if (symbol === "krzyz") {
    return (
      <svg aria-hidden="true" viewBox="0 0 40 60" className={className}>
        <path d="M17 0h6v16h17v6H23v38h-6V22H0v-6h17z" fill="currentColor" />
      </svg>
    );
  }
  if (symbol === "galazka") {
    // Gałązka z liśćmi – znak żałobny bez treści religijnych.
    const leaves = [
      [30, 50, -35], [36, 41, -30], [42, 32, -25], [48, 23, -20],
      [22, 46, 35], [27, 37, 40], [33, 28, 45], [39, 19, 50],
    ];
    return (
      <svg aria-hidden="true" viewBox="0 0 70 70" className={className}>
        <path d="M14 66 C 26 50, 38 32, 56 8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        {leaves.map(([x, y, r], i) => (
          <ellipse key={i} cx={x} cy={y} rx="8" ry="3.4" transform={`rotate(${r} ${x} ${y})`} fill="currentColor" />
        ))}
      </svg>
    );
  }
  return null;
}

export function ObituaryCard({
  o,
  variant = "a4",
  heading = "h2",
  className = "",
}: {
  o: Obituary;
  variant?: "a4" | "screen";
  heading?: "h1" | "h2";
  className?: string;
}) {
  const Name = heading;
  // Dopasowanie do strony A4: przy długiej treści litery maleją (pole tekstu ~ kwadrat skali), najwyżej do 60%.
  const chars = [o.intro, o.honorific, o.name, o.maiden, o.age, o.description, ...o.ceremony, o.rosary, o.request, o.signature]
    .filter(Boolean)
    .join(" ").length;
  // Na ekranie telefonu (wąski kontener) litery większe, żeby treść dała się przeczytać bez powiększania.
  const scale = variant === "a4" ? Math.max(0.6, Math.min(1, Math.sqrt(620 / Math.max(chars, 1)))) : 1.4;
  return (
    <article
      aria-label={`Klepsydra: ${o.name}`}
      style={{ ["--s" as string]: scale }}
      className={`@container w-full bg-white text-center text-black ${variant === "a4" ? "aspect-[210/297] print:aspect-auto print:h-[296mm] print:break-inside-avoid" : ""} ${className}`}
    >
      <div
        className={`flex flex-col items-center border-black font-serif ${
          variant === "a4"
            ? "m-[4cqw] h-[calc(100%-8cqw)] border-[1.2cqw] px-[7cqw] pt-[5cqw] pb-[2.5cqw]"
            : "m-[3cqw] border-[1.4cqw] px-[6cqw] pt-[8cqw] pb-[3cqw]"
        }`}
      >
        <div className={`flex flex-col items-center gap-[calc(2.8cqw*var(--s))] ${variant === "a4" ? "flex-1 justify-center" : ""}`}>
          {o.symbol !== "brak" ? <ObituarySymbolMark symbol={o.symbol} className="h-[calc(11cqw*var(--s))] w-auto" /> : null}
          <p className="max-w-[60ch] text-[calc(3.3cqw*var(--s))] leading-snug">{o.intro}</p>
          {o.honorific ? <p className="text-[calc(3.1cqw*var(--s))] tracking-[0.3em]">{o.honorific}</p> : null}
          <div>
            <Name className="text-[calc(8.2cqw*var(--s))] leading-[1.08] font-semibold">{o.name}</Name>
            {o.maiden ? <p className="mt-[0.6cqw] text-[calc(3.2cqw*var(--s))] italic">{o.maiden}</p> : null}
          </div>
          {o.age ? <p className="text-[calc(3.3cqw*var(--s))]">{o.age}</p> : null}
          {o.description ? <p className="max-w-[48ch] text-[calc(3.1cqw*var(--s))] italic leading-snug">{o.description}</p> : null}
          <span aria-hidden="true" className="h-px w-[18cqw] bg-black" />
          <div className="flex max-w-[62ch] flex-col gap-[1.6cqw] text-[calc(3cqw*var(--s))] leading-snug">
            {o.ceremony.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {o.rosary ? <p>{o.rosary}</p> : null}
          </div>
          {o.request ? <p className="max-w-[56ch] text-[calc(2.9cqw*var(--s))] italic leading-snug">{o.request}</p> : null}
          <p className="text-[calc(3.3cqw*var(--s))] italic">{o.signature}</p>
        </div>
        <p className={`mt-[3cqw] font-sans text-[#444] ${variant === "a4" ? "text-[1.8cqw]" : "text-[13px]"}`}>{o.footer}</p>
      </div>
    </article>
  );
}
