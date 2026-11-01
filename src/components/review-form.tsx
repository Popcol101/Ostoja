// Ocena zakładu przez rodzinę (strona /r/[token]). Prawdziwe pola radio – działa bez JS i z czytnikiem ekranu.
import { SubmitButton } from "@/components/client";
import { Card, CardTitle, Field, Textarea } from "@/components/ui";
import { familyReview } from "@/app/rodzina-actions";

export type FamilyReview = {
  eligible: boolean;
  home_name: string;
  rating: number | null;
  comment: string | null;
  submitted_at: string | null;
};

const LABELS = ["", "Źle", "Słabo", "Przeciętnie", "Dobrze", "Bardzo dobrze"] as const;

export function ReviewCard({ token, review }: { token: string; review: FamilyReview }) {
  if (!review.eligible) return null;
  const done = review.rating !== null;
  return (
    <Card id="ocena">
      <CardTitle aside={done ? `Twoja ocena: ${review.rating} z 5` : undefined}>Jak pracował zakład?</CardTitle>
      <p className="mb-4 text-[15px] text-muted">
        {done
          ? "Dziękujemy. Możesz zmienić ocenę, dopóki ten link działa."
          : `Twoja ocena pomoże innym rodzinom wybrać zakład. To zajmie chwilę i nie wymaga konta.`}
      </p>
      <form action={familyReview} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <fieldset>
          <legend className="mb-2 font-semibold">Wybierz ocenę od 1 do 5</legend>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <label
                key={n}
                className="flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-xl border border-line px-1 py-2 text-center has-[:checked]:border-brand has-[:checked]:bg-brand-tint has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand"
              >
                <input type="radio" name="ocena" value={n} defaultChecked={review.rating === n} required className="sr-only" />
                <span className="text-[20px] font-semibold leading-none">{n}</span>
                <span className="mt-1 text-[12px] leading-tight text-muted">{LABELS[n]}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field id="komentarz" label="Komentarz (nieobowiązkowe)" hint="Zobaczy go tylko zakład i Ostoja. Nie wpisuj danych osobowych.">
          <Textarea id="komentarz" name="komentarz" rows={3} maxLength={1000} defaultValue={review.comment ?? ""} aria-describedby="komentarz-hint" />
        </Field>
        <SubmitButton full>{done ? "Zmień ocenę" : "Wyślij ocenę"}</SubmitButton>
      </form>
    </Card>
  );
}
