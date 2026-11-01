import Link from "next/link";
import { OfflineBanner } from "@/components/client";
import { Mark } from "@/components/site";
import { requireProvider } from "@/lib/session";
import { providerLogout } from "./actions";

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const me = await requireProvider();
  return (
    <div className="min-h-dvh bg-ground">
      <OfflineBanner />
      <header className="bg-night text-white">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/uslugi" className="flex items-center gap-3 text-white no-underline">
            <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-[10px] bg-brand">
              <Mark size={26} onDark />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="font-semibold">{me.providerName}</span>
              <span className="text-[13px] text-night-muted">{me.displayName} · opieka nad grobami</span>
            </span>
          </Link>
          <form action={providerLogout} className="ml-auto">
            <button type="submit" className="min-h-11 rounded-[10px] px-3 text-sm text-night-muted hover:text-white">
              Wyloguj
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
    </div>
  );
}
