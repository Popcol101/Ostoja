import { Check, Clock, FileText, Phone, Scale } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OPIEKUN_PHONE, SiteFooter, SiteHeader } from "@/components/site";
import { LinkButton } from "@/components/ui";
import { formatPln } from "@/lib/format";
import { FUNERAL_BENEFIT_PLN } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Ostoja – pomoc w organizacji pogrzebu",
  description:
    "Porównaj ceny zakładów pogrzebowych w swoim mieście i zamów kontakt. Zakład oddzwoni w 15 minut. Bez zakładania konta.",
};

const STEPS = [
  { title: "Odpowiedz na 4 pytania", text: "Miasto, forma pochówku, ceremonia, budżet. Nie pytamy o nic więcej." },
  { title: "Porównaj ceny", text: "Pełne kwoty za ten sam zakres usług – bez „od” i bez gwiazdek." },
  { title: "Zakład oddzwoni", text: "Wybrany zakład ma 15 minut na odpowiedź. Jeśli nie zdąży, zapytanie trafia do kolejnego." },
];

const RULES = [
  { icon: Scale, title: "Kolejności nie da się kupić", text: "Zakłady sortujesz po odległości, cenie albo ocenach. Nikt nie płaci za wyższe miejsce na liście." },
  { icon: Phone, title: "Twój numer dostaje jeden zakład", text: "Numer telefonu widzi dopiero zakład, który przyjął zapytanie. Nie dzwoni do Ciebie kilka firm naraz." },
  { icon: FileText, title: "Cena za ten sam zakres", text: "Każdy zakład wycenia ten sam standardowy zestaw usług, więc kwoty da się porównać." },
  { icon: Clock, title: "Opiekun przez całą dobę", text: "Gdy nie chcesz wypełniać formularza, zadzwoń. Człowiek odbierze o każdej porze." },
];

const FAQ = [
  {
    q: "Ile kosztuje korzystanie z Ostoi?",
    a: "Dla rodzin nic. Zakład płaci Ostoi stałą opłatę za zlecenie, tylko gdy podpiszecie umowę. Ta opłata nie wpływa na kolejność na liście.",
  },
  {
    q: "Co zrobić najpierw, gdy bliska osoba zmarła?",
    a: "Potrzebna jest karta zgonu – w szpitalu wystawia ją lekarz oddziału, w domu lekarz rodzinny lub wezwany lekarz. Zakład pogrzebowy pomoże w pozostałych formalnościach.",
  },
  {
    q: "Czy zasiłek pogrzebowy pokryje koszty?",
    a: `Zasiłek pogrzebowy z ZUS wynosi ${formatPln(FUNERAL_BENEFIT_PLN)}. Przy każdej ofercie pokazujemy, ile zostanie z zasiłku albo ile trzeba dopłacić. Zakład może złożyć wniosek w Twoim imieniu.`,
  },
  {
    q: "Czy muszę zakładać konto?",
    a: "Nie. Podajesz tylko imię i numer telefonu, żeby zakład mógł oddzwonić. Później dostajesz link, pod którym widzisz terminy i koszty.",
  },
];

export default function Home() {
  const tel = OPIEKUN_PHONE.replace(/\s/g, "");
  return (
    <div className="flex min-h-dvh flex-col bg-ground-family">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl gap-8 px-4 pb-12 pt-8 sm:pt-14 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <h1 className="font-serif text-[36px] leading-[1.1] sm:text-[52px]">
              Pomożemy zorganizować pogrzeb. Spokojnie, krok po kroku.
            </h1>
            <p className="mt-4 max-w-xl text-[18px] text-muted">
              Porównaj pełne ceny zakładów pogrzebowych w swoim mieście. Wybrany zakład oddzwoni w ciągu 15 minut – także w nocy.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <LinkButton href="/zapytanie" className="min-h-13 px-6 text-[17px]">
                Sprawdź ceny w swoim mieście
              </LinkButton>
              <LinkButton href={`tel:${tel}`} variant="secondary" className="min-h-13 px-6 text-[17px]">
                <Phone size={18} aria-hidden="true" />
                Zadzwoń do opiekuna
              </LinkButton>
            </div>
            <p className="mt-3 text-sm text-muted">Bez zakładania konta. Twój numer trafi tylko do jednego zakładu.</p>
          </div>
          <div className="rounded-2xl border border-line bg-card p-5">
            <p className="text-sm font-semibold text-muted">Przykładowa oferta · Łódź · kremacja z ceremonią religijną</p>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <p className="font-serif text-[24px]">Dom Pogrzebowy Cisza</p>
              <p className="text-[24px] font-semibold">{formatPln(5790)}</p>
            </div>
            <p className="mt-1 text-[15px] text-brand">Z zasiłku zostaje {formatPln(FUNERAL_BENEFIT_PLN - 5790)}</p>
            <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-[15px]">
              {["Transport i chłodnia", "Przygotowanie ciała", "Trumna do kremacji i kremacja", "Ceremonia", "Formalności i wniosek o zasiłek"].map((i) => (
                <li key={i} className="flex items-center gap-2">
                  <Check size={18} className="shrink-0 text-brand" aria-hidden="true" />
                  {i}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-muted">Dane przykładowe z wersji testowej.</p>
          </div>
        </section>

        <section aria-labelledby="jak" className="border-y border-line bg-card">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <h2 id="jak" className="font-serif text-[28px]">Jak to działa</h2>
            <ol className="mt-5 grid gap-5 sm:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-tint font-semibold text-brand" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold">{s.title}</p>
                    <p className="mt-0.5 text-muted">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="zasady" aria-labelledby="zasady-t" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-10">
          <h2 id="zasady-t" className="font-serif text-[28px]">Nasze zasady</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {RULES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="rounded-[14px] border border-line bg-card p-5">
                <Icon size={22} className="text-brand" aria-hidden="true" />
                <p className="mt-2 font-semibold">{title}</p>
                <p className="mt-1 text-muted">{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="faq" className="mx-auto max-w-3xl px-4 pb-12">
          <h2 id="faq" className="font-serif text-[28px]">Częste pytania</h2>
          <div className="mt-4 flex flex-col gap-2">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-[14px] border border-line bg-card">
                <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-semibold">
                  {f.q}
                  <span aria-hidden="true" className="text-[20px] text-brand group-open:rotate-45">+</span>
                </summary>
                <p className="px-4 pb-4 text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section aria-labelledby="dla-zakladow" className="bg-brand-tint">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="dla-zakladow" className="font-serif text-[26px]">Prowadzisz zakład pogrzebowy?</h2>
              <p className="mt-1 max-w-xl text-brand-dark">
                Zapytania z Twojej okolicy, kalendarz karawanów i sal, dokumenty jednym kliknięciem. Płacisz tylko za podpisane umowy.
              </p>
            </div>
            <Link href="/logowanie" className="inline-flex min-h-11 items-center font-semibold text-brand">
              Wejdź do panelu zakładu
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
