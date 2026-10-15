"use client";
import { Building2, PhoneCall, Receipt } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Zakłady", icon: Building2, match: (p: string) => p === "/admin" || p.startsWith("/admin/zaklady") },
  { href: "/admin/zapytania", label: "Do opiekuna", icon: PhoneCall, match: (p: string) => p.startsWith("/admin/zapytania") },
  { href: "/admin/rozliczenia", label: "Rozliczenia", icon: Receipt, match: (p: string) => p.startsWith("/admin/rozliczenia") },
];

export function AdminNav({ waiting }: { waiting: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Administracja" className="border-b border-line bg-card print:hidden">
      <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 lg:px-6">
        {items.map(({ href, label, icon: Icon, match }) => {
          const active = match(path);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-12 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-[15px] font-semibold no-underline ${
                  active ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <Icon size={18} aria-hidden="true" />
                {label}
                {href === "/admin/zapytania" && waiting > 0 ? (
                  <span className="rounded-full bg-warn px-2 text-[13px] text-white">
                    {waiting}
                    <span className="sr-only"> czeka</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
