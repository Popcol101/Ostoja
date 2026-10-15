import type { Metadata } from "next";
import { Badge, Button, Card, CardTitle, DefinitionList, EmptyState, Field, Input, Notice, Select } from "@/components/ui";

export const metadata: Metadata = { title: "System wizualny – Ostoja", robots: { index: false } };

const COLORS: { name: string; token: string; hex: string; dark?: boolean }[] = [
  { name: "Tło panelu", token: "ground", hex: "#EEF0EC" },
  { name: "Tło strony dla rodzin", token: "ground-family", hex: "#F3F4F1" },
  { name: "Karta", token: "card", hex: "#FFFFFF" },
  { name: "Obramowanie", token: "line", hex: "#D9DDD6" },
  { name: "Tekst", token: "ink", hex: "#17211E", dark: true },
  { name: "Tekst drugorzędny", token: "muted", hex: "#55615C", dark: true },
  { name: "Kolor główny", token: "brand", hex: "#24453C", dark: true },
  { name: "Jasny akcent", token: "brand-tint", hex: "#E3ECE8" },
  { name: "Ostrzeżenie", token: "warn", hex: "#B9802A", dark: true },
  { name: "Tekst ostrzeżenia", token: "warn-ink", hex: "#7A5214", dark: true },
  { name: "Nagłówek panelu", token: "night", hex: "#17211E", dark: true },
];

export default function Styleguide() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 bg-ground px-4 py-8">
      <div>
        <h1 className="font-serif text-[36px]">System wizualny Ostoi</h1>
        <p className="text-muted">Komponenty z src/components/ui.tsx. Zasady: docs/design-system.md.</p>
      </div>

      <Card>
        <CardTitle>Kolory</CardTitle>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {COLORS.map((c) => (
            <li key={c.token} className="overflow-hidden rounded-xl border border-line">
              <div className="h-16" style={{ background: c.hex }} />
              <div className="p-2 text-sm">
                <p className="font-semibold">{c.name}</p>
                <p className="text-muted">
                  {c.token} · {c.hex}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Typografia</CardTitle>
        <p className="font-serif text-[40px] leading-tight">Newsreader – nagłówki stron</p>
        <p className="font-serif text-[28px]">Newsreader – nagłówki sekcji</p>
        <p className="text-[17px] font-semibold">Figtree 17 półgruby – tytuły kart</p>
        <p className="text-[16px]">Figtree 16 – tekst podstawowy. Zażółć gęślą jaźń. 5 790 zł.</p>
        <p className="text-[14px] text-muted">Figtree 14 – podpisy i wskazówki</p>
      </Card>

      <Card>
        <CardTitle>Przyciski</CardTitle>
        <div className="flex flex-wrap gap-3">
          <Button>Przyjmij zlecenie</Button>
          <Button variant="secondary">Zadzwoń</Button>
          <Button variant="quiet">Więcej</Button>
          <Button variant="danger">Odrzuć</Button>
          <Button disabled>Niedostępny</Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Etykiety i komunikaty</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Badge tone="brand">Potwierdzony</Badge>
          <Badge tone="warn">Wstępny</Badge>
          <Badge>Zamknięte</Badge>
          <Badge tone="danger">Odwołany</Badge>
          <Badge tone="night">Dyżur</Badge>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <Notice title="Zapisano">Rodzina widzi już nowy termin.</Notice>
          <Notice tone="warn" title="Pochówek wcześniej niż 24 godziny od zgonu">Sprawdź termin z rodziną i cmentarzem.</Notice>
          <Notice tone="danger">Ten zasób jest już zarezerwowany w tym czasie.</Notice>
        </div>
      </Card>

      <Card>
        <CardTitle>Formularze</CardTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="sg-name" label="Imię i nazwisko" hint="Tak, jak w dowodzie osobistym.">
            <Input id="sg-name" placeholder="Jan Kowalski" aria-describedby="sg-name-hint" />
          </Field>
          <Field id="sg-select" label="Etap">
            <Select id="sg-select" defaultValue="umowa">
              <option value="przyjete">Przyjęte</option>
              <option value="umowa">Umowa</option>
            </Select>
          </Field>
        </div>
      </Card>

      <Card>
        <CardTitle>Lista definicji</CardTitle>
        <DefinitionList
          items={[
            { term: "Forma", value: "Kremacja" },
            { term: "Ceremonia", value: "Religijna" },
            { term: "Razem", value: "5 790 zł" },
          ]}
        />
      </Card>

      <EmptyState title="Brak nowych zapytań" action={<Button variant="secondary">Odśwież</Button>}>
        Gdy rodzina z Twojej okolicy wyśle zapytanie, zobaczysz je tutaj i usłyszysz powiadomienie.
      </EmptyState>
    </main>
  );
}
