import { Phone } from "lucide-react";
import Link from "next/link";
import { OfflineBanner } from "./client";

export const OPIEKUN_PHONE = process.env.NEXT_PUBLIC_OPIEKUN_PHONE ?? "+48 000 000 000";

/** Znak „Brama i droga”: dwie bramy jedna za drugą i prosta droga w osi symetrii. Do 24 px bez wewnętrznej bramy.
 * Pliki: public/brand/ (scripts/brand/build_logo.py). */
export function Mark({ size = 30, onDark = false }: { size?: number; onDark?: boolean }) {
  const gate = onDark ? "#E4E7E5" : "#3F5650";
  const road = onDark ? "#CDB98F" : "#A68B5B";
  if (size <= 24) {
    return (
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <path d="M6 28.5V15a10 10 0 0 1 20 0v13.5" fill="none" stroke={gate} strokeWidth={3.4} strokeLinecap="round" />
        <path d="M16 28.5V18" stroke={road} strokeWidth={3} strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <path d="M6.25 28V14.75a9.75 9.75 0 0 1 19.5 0V28" fill="none" stroke={gate} strokeWidth={2.5} strokeLinecap="round" />
      <path d="M11 28V18.5a5 5 0 0 1 10 0V28" fill="none" stroke={gate} strokeWidth={1.6} strokeLinecap="round" />
      <path d="M16 28V21" stroke={road} strokeWidth={2.2} strokeLinecap="round" />
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
