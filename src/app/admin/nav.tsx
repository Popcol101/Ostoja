"use client";
import { Bug, Building2, PhoneCall, Receipt, Scale, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Zakłady", icon: Building2, match: (p: string) => p === "/admin" || p.startsWith("/admin/zaklady") },
  { href: "/admin/zapytania", label: "Do opiekuna", icon: PhoneCall, match: (p: string) => p.startsWith("/admin/zapytania") },
  { href: "/admin/odwolania", label: "Odwołania", icon: Scale, match: (p: string) => p.startsWith("/admin/odwolania") },
  { href: "/admin/rozliczenia", label: "Rozliczenia", icon: Receipt, match: (p: string) => p.startsWith("/admin/rozliczenia") },
  { href: "/admin/rodo", label: "Wnioski RODO", icon: ShieldCheck, match: (p: string) => p.startsWith("/admin/rodo") },
  { href: "/admin/bledy", label: "Błędy", icon: Bug, match: (p: string) => p.startsWith("/admin/bledy") },
];

export function AdminNav({ waiting, appeals }: { waiting: number; appeals: number }) {
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
                {(href === "/admin/zapytania" ? waiting : href === "/admin/odwolania" ? appeals : 0) > 0 ? (
                  <span className="rounded-full bg-warn-ink px-2 text-[13px] text-white">
                    {href === "/admin/zapytania" ? waiting : appeals}
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
