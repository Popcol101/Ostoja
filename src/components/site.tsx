import { Phone } from "lucide-react";
import Link from "next/link";
import { OfflineBanner } from "./client";

export const OPIEKUN_PHONE = process.env.NEXT_PUBLIC_OPIEKUN_PHONE ?? "+48 000 000 000";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2.5 text-ink no-underline ${className}`}>
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <path d="M6 28V14a10 10 0 0 1 20 0v14" fill="none" stroke="#24453C" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M16 28V17" stroke="#B9802A" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className="font-serif text-[25px] font-medium">Ostoja</span>
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
    <footer className="bg-night text-[#C9D2CE]">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-6 px-4 py-8 text-sm">
        <div className="flex flex-col gap-1">
          <span className="font-serif text-[22px] text-white">Ostoja</span>
          <span>Ostoja sp. z o.o. · NIP [DO UZUPEŁNIENIA] · KRS [DO UZUPEŁNIENIA]</span>
          <span>Wersja testowa – zakłady i dane są fikcyjne.</span>
        </div>
        <nav aria-label="Stopka" className="flex flex-wrap items-start gap-x-6 gap-y-2">
          <Link href="/#zasady" className="text-[#C9D2CE]">Zasady</Link>
          <Link href="/logowanie" className="text-[#C9D2CE]">Panel zakładu</Link>
          <a href={`tel:${OPIEKUN_PHONE.replace(/\s/g, "")}`} className="text-[#C9D2CE]">Kontakt</a>
        </nav>
      </div>
    </footer>
  );
}
