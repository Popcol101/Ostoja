import type { ReactNode } from "react";
import { SiteFooter, SiteHeader } from "./site";
import { Notice } from "./ui";

/** Układ stron prawnych (polityka prywatności, regulamin). */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-ground-family">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="font-serif text-[34px] leading-tight">{title}</h1>
        <p className="mt-1 text-muted">Wersja z {updated}</p>
        <div className="mt-4">
          <Notice tone="warn" title="Wersja robocza">
            Ten tekst przygotowano przed przeglądem prawnym. Przed przyjęciem prawdziwych danych sprawdzi go prawnik.
          </Notice>
        </div>
        <div className="legal mt-6 flex flex-col gap-4 text-[16px] leading-relaxed [&_h2]:mt-4 [&_h2]:font-serif [&_h2]:text-[24px] [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
