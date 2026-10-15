import { Field, Input, Select } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { EVENT_KIND_LABEL } from "@/lib/labels";
import { addEvent } from "./actions";

export type Resource = { id: string; name: string };

export function EventForm({ orderId, returnTo, resources }: { orderId?: string; returnTo: string; resources: Resource[] }) {
  return (
    <form action={addEvent} className="mt-2 grid gap-3 pb-2 sm:grid-cols-2">
      <input type="hidden" name="orderId" value={orderId ?? ""} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Field label="Rodzaj" id={`kind-${orderId ?? "x"}`}>
        <Select id={`kind-${orderId ?? "x"}`} name="kind" defaultValue={orderId ? "ceremonia" : "spotkanie"}>
          {Object.entries(EVENT_KIND_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Status" id={`st-${orderId ?? "x"}`}>
        <Select id={`st-${orderId ?? "x"}`} name="status" defaultValue="wstepny">
          <option value="wstepny">Wstępny – do potwierdzenia</option>
          <option value="potwierdzony">Potwierdzony</option>
        </Select>
      </Field>
      <Field label="Data" id={`d-${orderId ?? "x"}`}>
        <Input id={`d-${orderId ?? "x"}`} name="date" type="date" required />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Godzina" id={`t-${orderId ?? "x"}`}>
          <Input id={`t-${orderId ?? "x"}`} name="time" type="time" required />
        </Field>
        <Field label="Czas (min)" id={`m-${orderId ?? "x"}`}>
          <Input id={`m-${orderId ?? "x"}`} name="minutes" type="number" min={15} max={600} step={15} defaultValue={60} required />
        </Field>
      </div>
      <Field label="Miejsce" id={`p-${orderId ?? "x"}`}>
        <Input id={`p-${orderId ?? "x"}`} name="place" placeholder="np. kaplica cmentarza komunalnego" />
      </Field>
      <Field label="Karawan lub sala" id={`r-${orderId ?? "x"}`}>
        <Select id={`r-${orderId ?? "x"}`} name="resourceId" defaultValue="">
          <option value="">Bez rezerwacji</option>
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
      </Field>
      {!orderId ? (
        <div className="sm:col-span-2">
          <Field label="Tytuł" id="title-x">
            <Input id="title-x" name="title" placeholder="np. Dostawa trumien" />
          </Field>
        </div>
      ) : (
        <input type="hidden" name="title" value="" />
      )}
      <div className="sm:col-span-2">
        <SubmitButton>Dodaj termin</SubmitButton>
      </div>
    </form>
  );
}
