"use client";
// Edytor klepsydry z podglądem na żywo: każda zmiana pola od razu widać na klepsydrze (generator działa w przeglądarce).
import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/client";
import { ObituaryCard } from "@/components/obituary-card";
import { Field, Input, Notice, Textarea } from "@/components/ui";
import { buildObituary, type ObituaryInput } from "@/lib/obituary";
import type { ObituaryFields } from "@/lib/obituary-data";
import { saveObituary } from "../../../actions";

const STYLE_LABEL = { religijna: "Religijna", swiecka: "Świecka", bez: "Bez ceremonii" } as const;

type Base = Omit<
  ObituaryInput,
  "gender" | "maidenName" | "description" | "sacraments" | "symbol" | "privateFuneral" | "ceremonyPlace" | "cemeteryPlace" | "rosary" | "request" | "signature"
>;

export function ObituaryEditor({
  orderId,
  base,
  initial,
  orderCeremony,
  canEdit,
}: {
  orderId: string;
  base: Base;
  initial: ObituaryFields;
  orderCeremony: "religijna" | "swiecka" | "bez";
  canEdit: boolean;
}) {
  const [f, setF] = useState<ObituaryFields>(initial);
  const set = <K extends keyof ObituaryFields>(k: K, v: ObituaryFields[K]) => setF((x) => ({ ...x, [k]: v }));
  const style = f.style ?? orderCeremony;
  const religious = style === "religijna";
  const female = f.gender === "k";

  const o = useMemo(
    () =>
      buildObituary({
        ...base,
        ceremony: style,
        gender: f.gender,
        maidenName: f.maiden_name,
        description: f.description,
        sacraments: f.sacraments,
        symbol: f.symbol,
        privateFuneral: f.private_funeral,
        ceremonyPlace: f.ceremony_place,
        cemeteryPlace: f.cemetery_place,
        rosary: f.rosary,
        request: f.request,
        signature: f.signature,
      }),
    [base, f, style],
  );

  const text = (k: keyof ObituaryFields) => ({
    value: (f[k] as string | null) ?? "",
    onChange: (e: { target: { value: string } }) => set(k, (e.target.value || null) as never),
    disabled: !canEdit,
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start print:block">
      <form action={saveObituary} className="flex flex-col gap-4 rounded-[14px] border border-line bg-card p-4 print:hidden lg:p-5">
        <input type="hidden" name="orderId" value={orderId} />
        <h2 className="text-[17px] font-semibold">Treść klepsydry</h2>
        {!canEdit ? <Notice>Klepsydrę zmienia właściciel albo biuro. Możesz ją wydrukować.</Notice> : null}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Rodzaj klepsydry</legend>
          <div className="flex flex-wrap gap-2">
            {(["religijna", "swiecka", "bez"] as const).map((s) => (
              <label key={s} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-line px-3 has-[:checked]:border-brand has-[:checked]:bg-brand-tint">
                <input
                  type="radio"
                  name="style"
                  value={s === orderCeremony ? "zlecenie" : s}
                  checked={style === s}
                  onChange={() => set("style", s === orderCeremony ? null : s)}
                  disabled={!canEdit}
                  className="size-5 shrink-0 accent-brand"
                />
                {STYLE_LABEL[s]}
                {s === orderCeremony ? <span className="text-sm text-muted">(jak w zleceniu)</span> : null}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Forma</legend>
          <div className="flex gap-2">
            {(["k", "m"] as const).map((g) => (
              <label key={g} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-line px-3 has-[:checked]:border-brand has-[:checked]:bg-brand-tint">
                <input type="radio" name="gender" value={g} checked={f.gender === g} onChange={() => set("gender", g)} disabled={!canEdit} className="size-5 shrink-0 accent-brand" />
                {g === "k" ? "zmarła" : "zmarł"}
              </label>
            ))}
          </div>
        </fieldset>

        <Field id="maiden_name" label="Nazwisko rodowe (nieobowiązkowe)" hint="Na klepsydrze: „z domu …”.">
          <Input id="maiden_name" name="maiden_name" maxLength={80} autoComplete="off" aria-describedby="maiden_name-hint" {...text("maiden_name")} />
        </Field>
        <Field id="description" label="Kilka słów o zmarłym (nieobowiązkowe)" hint={`Np. „emerytowan${female ? "a nauczycielka, ukochana Mama i Babcia" : "y kolejarz, ukochany Tata i Dziadek"}”.`}>
          <Input id="description" name="description" maxLength={200} autoComplete="off" aria-describedby="description-hint" {...text("description")} />
        </Field>

        {religious ? (
          <>
            <label className="flex min-h-11 items-start gap-3 text-[15px]">
              <input
                type="checkbox"
                name="sacraments"
                value="tak"
                checked={f.sacraments}
                onChange={(e) => set("sacraments", e.target.checked)}
                disabled={!canEdit}
                className="mt-0.5 size-5 shrink-0 accent-brand"
              />
              {female ? "Opatrzona" : "Opatrzony"} Świętymi Sakramentami – tylko gdy rodzina to potwierdziła
            </label>
            <label className="flex min-h-11 items-start gap-3 text-[15px]">
              <input
                type="checkbox"
                name="symbol"
                value="brak"
                checked={f.symbol === "brak"}
                onChange={(e) => set("symbol", e.target.checked ? "brak" : null)}
                disabled={!canEdit}
                className="mt-0.5 size-5 shrink-0 accent-brand"
              />
              Bez krzyża u góry (np. inne wyznanie)
            </label>
          </>
        ) : (
          <label className="flex min-h-11 items-start gap-3 text-[15px]">
            <input
              type="checkbox"
              name="symbol"
              value="galazka"
              checked={f.symbol === "galazka"}
              onChange={(e) => set("symbol", e.target.checked ? "galazka" : null)}
              disabled={!canEdit}
              className="mt-0.5 size-5 shrink-0 accent-brand"
            />
            Gałązka u góry klepsydry (znak żałobny bez symboli religijnych)
          </label>
        )}

        <label className="flex min-h-11 items-start gap-3 text-[15px]">
          <input
            type="checkbox"
            name="private_funeral"
            value="tak"
            checked={f.private_funeral}
            onChange={(e) => set("private_funeral", e.target.checked)}
            disabled={!canEdit}
            className="mt-0.5 size-5 shrink-0 accent-brand"
          />
          Pogrzeb w gronie najbliższej rodziny – bez terminu i miejsca na klepsydrze
        </label>

        {!f.private_funeral ? (
          <>
            {style !== "bez" ? (
              <Field
                id="ceremony_place"
                label={religious ? "Gdzie Msza Święta – tak jak w zdaniu" : "Gdzie pożegnanie – tak jak w zdaniu"}
                hint={religious ? "Np. „w kościele pw. św. Anny w Łodzi”. Termin bierzemy z kalendarza zlecenia." : "Np. „w sali pożegnań przy ul. Ogrodowej 5 w Łodzi”. Termin z kalendarza zlecenia."}
              >
                <Input id="ceremony_place" name="ceremony_place" maxLength={160} autoComplete="off" aria-describedby="ceremony_place-hint" {...text("ceremony_place")} />
              </Field>
            ) : null}
            <Field id="cemetery_place" label="Miejsce pochówku – tak jak w zdaniu" hint="Np. „na cmentarzu parafialnym przy ul. Ogrodowej w Łodzi”.">
              <Input id="cemetery_place" name="cemetery_place" maxLength={160} autoComplete="off" aria-describedby="cemetery_place-hint" {...text("cemetery_place")} />
            </Field>
          </>
        ) : null}

        {religious ? (
          <Field id="rosary" label="Różaniec lub czuwanie (nieobowiązkowe)" hint="Np. „Różaniec w intencji Zmarłej w piątek o godz. 18:00 w kościele pw. św. Anny”.">
            <Textarea id="rosary" name="rosary" maxLength={300} rows={2} aria-describedby="rosary-hint" {...text("rosary")} />
          </Field>
        ) : null}
        <Field id="request" label="Prośba rodziny (nieobowiązkowe)" hint="Np. „Zamiast kwiatów prosimy o wsparcie hospicjum św. Łazarza.”">
          <Textarea id="request" name="request" maxLength={300} rows={2} aria-describedby="request-hint" {...text("request")} />
        </Field>
        <Field id="signature" label="Podpis" hint={`Puste = „${religious ? "O czym zawiadamia pogrążona w smutku Rodzina" : "Pogrążona w smutku Rodzina"}”. Np. „Mąż, córki z rodzinami i wnuki”.`}>
          <Input id="signature" name="signature" maxLength={200} autoComplete="off" aria-describedby="signature-hint" {...text("signature")} />
        </Field>

        {canEdit ? <SubmitButton pendingLabel="Zapisuję…">Zapisz klepsydrę</SubmitButton> : null}
      </form>

      <div className="flex flex-col gap-3 lg:sticky lg:top-4 print:static">
        {o.missing.length ? (
          <div className="print:hidden">
            <Notice tone="warn" title="Do uzupełnienia">
              {o.missing.join(", ")} – w karcie zlecenia{o.missing.includes("termin ceremonii") ? " i w kalendarzu" : ""}.
            </Notice>
          </div>
        ) : null}
        <div className="rounded-[14px] border border-line bg-card p-2 shadow-none print:border-0 print:p-0">
          <ObituaryCard o={o} variant="a4" />
        </div>
      </div>
    </div>
  );
}
