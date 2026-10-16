import type { Metadata } from "next";
import Link from "next/link";
import { OfflineBanner } from "@/components/client";
import { Mark } from "@/components/site";
import { withUser } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { logout } from "../panel/actions";
import { AdminNav } from "./nav";

export const metadata: Metadata = { title: "Administracja – Ostoja", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  // Sama liczba, bez danych kontaktowych – dlatego nie trafia do dziennika jak pełna lista.
  const [{ count, appeals }] = await withUser(admin.userId, (tx) =>
    tx<{ count: number; appeals: number }[]>`select admin_waiting_count() as count, admin_appeals_waiting() as appeals`,
  );

  return (
    <div className="min-h-dvh bg-ground">
      <OfflineBanner />
      <header className="bg-night text-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 lg:px-6">
          <Link href="/admin" className="flex items-center gap-3 text-white no-underline">
            <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-[10px] bg-brand">
              <Mark size={26} onDark />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-semibold">Ostoja · administracja</span>
              <span className="text-[13px] text-night-muted">{admin.displayName}</span>
            </span>
          </Link>
          <form action={logout} className="ml-auto">
            <button type="submit" className="min-h-11 rounded-[10px] px-3 text-sm text-night-muted hover:text-white">
              Wyloguj
            </button>
          </form>
        </div>
      </header>
      <AdminNav waiting={count} appeals={appeals} />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-5 lg:px-6">{children}</main>
    </div>
  );
}
