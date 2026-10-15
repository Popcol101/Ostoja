"use client";
import { CalendarDays, ClipboardList, Inbox, Receipt, Store } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/panel/zapytania", label: "Zapytania", icon: Inbox, mobile: true },
  { href: "/panel/zlecenia", label: "Zlecenia", icon: ClipboardList, mobile: true },
  { href: "/panel/kalendarz", label: "Kalendarz", icon: CalendarDays, mobile: true },
  { href: "/panel/profil", label: "Profil i cennik", icon: Store, mobile: true },
  { href: "/panel/rozliczenia", label: "Rozliczenia", icon: Receipt, mobile: false },
];

/** Stan ładowania przy przejściu między ekranami (zamiast loading.tsx – patrz docs/design-system.md). */
function PendingMark({ className = "" }: { className?: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span role="status" className={className}>
      <span className="sr-only">Wczytuję…</span>
      <span aria-hidden="true" className="block size-2 animate-pulse rounded-full bg-brand" />
    </span>
  );
}

export function PanelNav({ variant, newCount }: { variant: "side" | "bottom"; newCount: number }) {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(`${href}/`);

  if (variant === "side") {
    return (
      <nav aria-label="Panel zakładu" className="hidden w-56 shrink-0 pt-5 lg:block print:hidden">
        <ul className="flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-[10px] px-3 font-semibold no-underline ${
                  active(href) ? "bg-card text-brand ring-1 ring-line" : "text-ink hover:bg-card"
                }`}
              >
                <Icon size={20} aria-hidden="true" />
                <span className="flex-1">{label}</span>
                <PendingMark />
                {href === "/panel/zapytania" && newCount > 0 ? (
                  <span className="rounded-full bg-warn-ink px-2 text-[13px] text-white">
                    {newCount}
                    <span className="sr-only"> nowe</span>
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Panel zakładu"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5 lg:hidden print:hidden"
    >
      <ul className="grid grid-cols-4">
        {items
          .filter((i) => i.mobile)
          .map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 text-[12px] no-underline ${
                  active(href) ? "font-bold text-brand" : "text-muted"
                }`}
              >
                <Icon size={22} aria-hidden="true" />
                {label === "Profil i cennik" ? "Profil" : label}
                <PendingMark className="absolute bottom-0" />
                {href === "/panel/zapytania" && newCount > 0 ? (
                  <span className="absolute right-[calc(50%-22px)] top-0 min-w-5 rounded-full bg-warn-ink px-1 text-center text-[11px] font-bold text-white">
                    {newCount}
                    <span className="sr-only"> nowe</span>
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}
