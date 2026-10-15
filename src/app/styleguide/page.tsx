import type { Metadata } from "next";
import { Badge, Button, Card, CardTitle, DefinitionList, EmptyState, Field, Input, Notice, Select } from "@/components/ui";

export const metadata: Metadata = { title: "System wizualny – Ostoja", robots: { index: false } };

const COLORS: { name: string; token: string; hex: string }[] = [
  { name: "Kamień – tło panelu", token: "ground", hex: "#ECEDEB" },
  { name: "Mgła – tło dla rodzin", token: "ground-family", hex: "#F4F4F2" },
  { name: "Karta", token: "card", hex: "#FFFFFF" },
  { name: "Linia", token: "line", hex: "#D8DAD7" },
  { name: "Grafit – tekst", token: "ink", hex: "#1E2422" },
  { name: "Popiel – tekst drugorzędny", token: "muted", hex: "#5C6461" },
  { name: "Szałwia – kolor główny", token: "brand", hex: "#3F5650" },
  { name: "Szałwia jasna", token: "brand-tint", hex: "#E6EAE8" },
  { name: "Piasek – akcent i ostrzeżenia", token: "sand", hex: "#A68B5B" },
  { name: "Piasek ciemny – tekst ostrzeżeń", token: "warn-ink", hex: "#6E5A33" },
  { name: "Noc – nagłówek panelu", token: "night", hex: "#1E2422" },
];

export default function Styleguide() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 bg-ground px-4 py-8">
      <div>
        <h1 className="font-serif text-[36px]">System wizualny Ostoi</h1>
        <p className="text-muted">Komponenty z src/components/ui.tsx. Zasady: docs/identyfikacja-wizualna.md i docs/design-system.md.</p>
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
