// Dane klepsydry z bazy → wejście generatora (src/lib/obituary.ts). Panel zakładu (RLS) i publiczna klepsydra (anon).
import "server-only";
import { asAnon, withUser } from "./db";
import type { ObituaryEvent, ObituaryInput, ObituarySymbol } from "./obituary";

export type ObituaryFields = {
  gender: "k" | "m";
  style: "religijna" | "swiecka" | "bez" | null;
  maiden_name: string | null;
  description: string | null;
  sacraments: boolean;
  symbol: ObituarySymbol | null;
  private_funeral: boolean;
  ceremony_place: string | null;
  cemetery_place: string | null;
  rosary: string | null;
  request: string | null;
  signature: string | null;
};

export type PanelObituary = {
  input: ObituaryInput;
  fields: ObituaryFields;
  orderCeremony: "religijna" | "swiecka" | "bez";
  saved: boolean;
  slug: string | null;
  published: boolean;
  visible: boolean;
};

type Row = {
  first: string | null;
  last: string | null;
  born_on: string | null;
  died_at: Date | null;
  ceremony: "religijna" | "swiecka" | "bez";
  burial: "tradycyjny" | "kremacja" | "nie_wiem";
  home_name: string;
  home_phone: string;
  events: { kind: ObituaryEvent["kind"]; starts_at: string; place: string | null }[];
  ob: (ObituaryFields & { public_slug: string | null; published_at: string | null; visible: boolean }) | null;
};

/** Domyślna forma z imienia: zakończone na „a” → kobieta (można zmienić w edytorze). */
export function guessGender(firstName: string | null): "k" | "m" {
  return (firstName ?? "").trim().toLowerCase().endsWith("a") ? "k" : "m";
}

export function emptyFields(firstName: string | null): ObituaryFields {
  return {
    gender: guessGender(firstName),
    style: null,
    maiden_name: null,
    description: null,
    sacraments: false,
    symbol: null,
    private_funeral: false,
    ceremony_place: null,
    cemetery_place: null,
    rosary: null,
    request: null,
    signature: null,
  };
}

export function toInput(
  base: Omit<ObituaryInput, "gender" | "maidenName" | "description" | "sacraments" | "symbol" | "privateFuneral" | "ceremonyPlace" | "cemeteryPlace" | "rosary" | "request" | "signature">,
  f: ObituaryFields,
): ObituaryInput {
  return {
    ...base,
    ceremony: f.style ?? base.ceremony,
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
  };
}

export async function loadPanelObituary(userId: string, orderId: string): Promise<PanelObituary | null> {
  const [r] = await withUser(userId, (tx) => tx<Row[]>`
    select o.deceased_first_name as first, o.deceased_last_name as last, o.born_on, o.died_at, o.ceremony, o.burial,
           h.name as home_name, h.phone as home_phone,
           coalesce((select json_agg(json_build_object('kind', e.kind, 'starts_at', lower(e.during), 'place', e.place) order by lower(e.during))
                     from events e where e.order_id = o.id and e.status <> 'odwolany' and e.kind in ('ceremonia', 'pochowek')), '[]') as events,
           (select to_jsonb(b) || jsonb_build_object('visible', b.published_at is not null and now() < coalesce(
                     (select max(upper(e.during)) from events e
                      where e.order_id = o.id and e.status <> 'odwolany' and e.kind in ('ceremonia', 'pochowek')),
                     b.published_at) + interval '30 days')
            from obituaries b where b.order_id = o.id) as ob
    from orders o join funeral_homes h on h.id = o.home_id where o.id = ${orderId}`);
  if (!r) return null;
  const fields: ObituaryFields = r.ob ? { ...emptyFields(r.first), ...pick(r.ob) } : emptyFields(r.first);
  const input = toInput(
    {
      ceremony: r.ceremony,
      burial: r.burial,
      firstName: r.first,
      lastName: r.last,
      bornOn: r.born_on,
      diedAt: r.died_at,
      events: r.events.map((e) => ({ kind: e.kind, startsAt: e.starts_at, place: e.place })),
      homeName: r.home_name,
      homePhone: r.home_phone,
    },
    fields,
  );
  return {
    input,
    fields,
    orderCeremony: r.ceremony,
    saved: Boolean(r.ob),
    slug: r.ob?.public_slug ?? null,
    published: Boolean(r.ob?.published_at),
    visible: Boolean(r.ob?.visible),
  };
}

function pick(o: Record<string, unknown>): Partial<ObituaryFields> {
  const keys: (keyof ObituaryFields)[] = [
    "gender", "style", "maiden_name", "description", "sacraments", "symbol", "private_funeral",
    "ceremony_place", "cemetery_place", "rosary", "request", "signature",
  ];
  return Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]])) as Partial<ObituaryFields>;
}

type PublicRow = {
  ceremony: "religijna" | "swiecka" | "bez";
  burial: "tradycyjny" | "kremacja" | "nie_wiem";
  gender: "k" | "m";
  first_name: string | null;
  last_name: string | null;
  maiden_name: string | null;
  age: number | null;
  died_at: string | null;
  description: string | null;
  sacraments: boolean;
  symbol: ObituarySymbol | null;
  private_funeral: boolean;
  ceremony_place: string | null;
  cemetery_place: string | null;
  rosary: string | null;
  request: string | null;
  signature: string | null;
  home_name: string;
  home_phone: string;
  memorial_slug: string | null;
  events: { kind: ObituaryEvent["kind"]; starts_at: string; place: string | null }[];
};

export const SLUG = /^[a-z0-9-]{3,80}$/;

export async function loadPublicObituary(slug: string): Promise<{ input: ObituaryInput; memorialSlug: string | null } | null> {
  if (!SLUG.test(slug)) return null;
  const d = await asAnon(async (tx) => {
    const [row] = await tx<{ data: PublicRow | null }[]>`select public_obituary(${slug}) as data`;
    return row?.data ?? null;
  });
  if (!d) return null;
  return {
    memorialSlug: d.memorial_slug,
    input: {
      ceremony: d.ceremony,
      burial: d.burial,
      gender: d.gender,
      firstName: d.first_name,
      lastName: d.last_name,
      maidenName: d.maiden_name,
      bornOn: null,
      age: d.age,
      diedAt: d.died_at,
      description: d.description,
      sacraments: d.sacraments,
      symbol: d.symbol,
      privateFuneral: d.private_funeral,
      ceremonyPlace: d.ceremony_place,
      cemeteryPlace: d.cemetery_place,
      rosary: d.rosary,
      request: d.request,
      signature: d.signature,
      events: d.events.map((e) => ({ kind: e.kind, startsAt: e.starts_at, place: e.place })),
      homeName: d.home_name,
      homePhone: d.home_phone,
    },
  };
}
