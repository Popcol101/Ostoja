import { SiteFooter, SiteHeader } from "@/components/site";
import { EmptyState, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-ground-family">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
        <h1 className="sr-only">Nie znaleziono strony</h1>
        <EmptyState title="Nie ma takiej strony." action={<LinkButton href="/">Wróć na stronę główną</LinkButton>}>
          Link mógł wygasnąć albo zawierać literówkę.
        </EmptyState>
      </main>
      <SiteFooter />
    </div>
  );
}
