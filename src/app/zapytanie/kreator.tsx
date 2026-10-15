"use client";
// Kreator 4 pytań. Bez JavaScriptu wszystkie pytania są widoczne naraz i formularz działa tak samo.
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type City = { slug: string; name: string };
type Option = { value: string; label: string; hint?: string };

const STEPS: { name: string; legend: string; hint?: string; options: Option[] }[] = [
  {
    name: "miejsce",
    legend: "Gdzie nastąpił zgon?",
    hint: "Od tego zależy, skąd zakład odbierze ciało.",
    options: [
      { value: "szpital", label: "W szpitalu" },
      { value: "dom", label: "W domu" },
      { value: "dps", label: "W hospicjum lub domu opieki" },
    ],
  },
  {
    name: "forma",
    legend: "Jaka forma pochówku?",
    options: [
      { value: "tradycyjny", label: "Pochówek tradycyjny", hint: "w trumnie" },
      { value: "kremacja", label: "Kremacja", hint: "pochówek urny" },
      { value: "nie_wiem", label: "Jeszcze nie wiem", hint: "pokażemy ceny pochówku tradycyjnego" },
    ],
  },
  {
    name: "ceremonia",
    legend: "Jaka ceremonia?",
    options: [
      { value: "religijna", label: "Religijna" },
      { value: "swiecka", label: "Świecka", hint: "z mistrzem ceremonii" },
      { value: "bez", label: "Bez ceremonii" },
    ],
  },
  {
    name: "budzet",
    legend: "Jaki budżet bierzesz pod uwagę?",
    hint: "To pytanie nie jest obowiązkowe. Pomaga zakładowi przygotować propozycję.",
    options: [
      { value: "zasilek", label: "W granicach zasiłku", hint: "do 7 000 zł" },
      { value: "srednio", label: "7 000–10 000 zł" },
      { value: "wiecej", label: "Powyżej 10 000 zł" },
      { value: "nie_wiem", label: "Nie wiem" },
    ],
  },
];

const radioCard =
  "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-line bg-card px-4 py-3 has-[:checked]:border-brand has-[:checked]:bg-brand-tint has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand";

export function Kreator({ cities, initial }: { cities: City[]; initial: Record<string, string> }) {
  const [enhanced, setEnhanced] = useState(false);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, string>>(initial);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const total = STEPS.length + 1;

  useEffect(() => setEnhanced(true), []);
  useEffect(() => {
    if (enhanced) headingRef.current?.focus();
  }, [step, enhanced]);

  const set = (name: string, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setError(null);
  };

  const required = ["miasto", "miejsce", "forma", "ceremonia"];
  const currentName = step === 0 ? "miasto" : STEPS[step - 1].name;

  function next(e: React.MouseEvent) {
    if (required.includes(currentName) && !values[currentName]) {
      e.preventDefault();
      setError(step === 0 ? "Wybierz miasto." : "Wybierz jedną odpowiedź.");
      return;
    }
    if (step < total - 1) {
      e.preventDefault();
      setStep(step + 1);
    }
  }

  const visible = (i: number) => !enhanced || i === step;

  return (
    <form action="/oferty" method="get" className="flex flex-col gap-6" noValidate={enhanced}>
      {enhanced ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-muted">
            Pytanie {step + 1} z {total}
          </p>
          <div className="h-1.5 rounded-full bg-line" aria-hidden="true">
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${((step + 1) / total) * 100}%` }} />
          </div>
        </div>
      ) : null}

      <fieldset hidden={!visible(0)} className="flex flex-col gap-3">
        <legend className="mb-3">
          <h2 ref={step === 0 ? headingRef : undefined} tabIndex={-1} className="font-serif text-[28px] leading-tight outline-none">
            W jakim mieście ma się odbyć pogrzeb?
          </h2>
        </legend>
        <label htmlFor="miasto" className="font-semibold">
          Miasto
        </label>
        <select
          id="miasto"
          name="miasto"
          required
          value={values.miasto ?? ""}
          onChange={(e) => set("miasto", e.target.value)}
          className="min-h-12 w-full rounded-[10px] border border-field bg-card px-3.5 text-[16px]"
        >
          <option value="">Wybierz miasto</option>
          {cities.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <p className="text-sm text-muted">W wersji testowej działamy w pięciu miastach.</p>
      </fieldset>

      {STEPS.map((s, i) => (
        <fieldset key={s.name} hidden={!visible(i + 1)} className="flex flex-col gap-2.5">
          <legend className="mb-3">
            <h2 ref={step === i + 1 ? headingRef : undefined} tabIndex={-1} className="font-serif text-[28px] leading-tight outline-none">
              {s.legend}
            </h2>
            {s.hint ? <span className="mt-1 block text-muted">{s.hint}</span> : null}
          </legend>
          {s.options.map((o) => (
            <label key={o.value} className={radioCard}>
              <input
                type="radio"
                name={s.name}
                value={o.value}
                required={required.includes(s.name)}
                checked={values[s.name] === o.value}
                onChange={() => set(s.name, o.value)}
                className="size-5 accent-brand"
              />
              <span>
                <span className="font-semibold">{o.label}</span>
                {o.hint ? <span className="block text-sm text-muted">{o.hint}</span> : null}
              </span>
            </label>
          ))}
        </fieldset>
      ))}

      {error ? (
        <p role="alert" className="rounded-xl bg-danger-tint px-4 py-3 font-semibold text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {enhanced && step > 0 ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStep(step - 1);
            }}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] px-4 font-semibold text-brand"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Wstecz
          </button>
        ) : (
          <span />
        )}
        <button
          type="submit"
          onClick={enhanced ? next : undefined}
          className="inline-flex min-h-12 items-center justify-center rounded-[10px] bg-brand px-6 text-[17px] font-semibold text-white hover:bg-brand-dark"
        >
          {!enhanced || step === total - 1 ? "Pokaż oferty" : "Dalej"}
        </button>
      </div>
    </form>
  );
}
