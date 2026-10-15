import { Phone } from "lucide-react";
import Link from "next/link";
import { OfflineBanner } from "./client";

export const OPIEKUN_PHONE = process.env.NEXT_PUBLIC_OPIEKUN_PHONE ?? "+48 000 000 000";

/** Znak „Brama i droga”: łuk bramy i prosta linia drogi, która zaczyna się przed progiem. Pliki: public/brand/. */
export function Mark({ size = 30, onDark = false }: { size?: number; onDark?: boolean }) {
  const small = size <= 24;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <path
        d={small ? "M6 28.5V15a10 10 0 0 1 20 0v13.5" : "M6.25 28V14.75a9.75 9.75 0 0 1 19.5 0V28"}
        fill="none"
        stroke={onDark ? "#E4E7E5" : "#3F5650"}
        strokeWidth={small ? 3.4 : 2.5}
        strokeLinecap="round"
      />
      <path
        d={small ? "M16 30.4V17.5" : "M16 30.75V17"}
        stroke={onDark ? "#CDB98F" : "#A68B5B"}
        strokeWidth={small ? 2.8 : 2}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ className = "", onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 no-underline ${onDark ? "text-[#E4E7E5]" : "text-ink"} ${className}`}>
      <Mark onDark={onDark} />
      <span className="font-serif text-[25px] font-medium leading-none">Ostoja</span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <>
      <OfflineBanner />
      <header className="border-b border-line bg-ground-family">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Logo />
          <a
            href={`tel:${OPIEKUN_PHONE.replace(/\s/g, "")}`}
            className="ml-auto flex min-h-11 items-center gap-2 font-semibold text-brand no-underline"
          >
            <Phone size={18} aria-hidden="true" />
            <span>
              <span className="hidden sm:inline">Opiekun 24/7: </span>
              {OPIEKUN_PHONE}
            </span>
          </a>
        </div>
      </header>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-night text-night-text">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-6 px-4 py-8 text-sm">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 font-serif text-[22px] text-white">
            <Mark size={26} onDark />
            Ostoja
          </span>
          <span>Ostoja sp. z o.o. · NIP [DO UZUPEŁNIENIA] · KRS [DO UZUPEŁNIENIA]</span>
          <span>Wersja testowa – zakłady i dane są fikcyjne.</span>
        </div>
        <nav aria-label="Stopka" className="flex flex-wrap items-start gap-x-6 gap-y-2">
          <Link href="/#zasady" className="text-night-text">Zasady</Link>
          <Link href="/logowanie" className="text-night-text">Panel zakładu</Link>
          <a href={`tel:${OPIEKUN_PHONE.replace(/\s/g, "")}`} className="text-night-text">Kontakt</a>
        </nav>
      </div>
    </footer>
  );
}
