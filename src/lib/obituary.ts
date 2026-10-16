// Treść klepsydry według polskiego zwyczaju. Czysta funkcja: dane zlecenia + terminy z kalendarza + pola klepsydry.
//
// Religijna: krzyż, „Ś.P.”, „opatrzona Świętymi Sakramentami” (gdy rodzina to potwierdzi), „przeżywszy lat 82”,
// Msza Święta żałobna, „O czym zawiadamia pogrążona w smutku Rodzina”.
// Świecka: bez symboli i formuł religijnych (opcjonalnie gałązka), „w wieku 82 lat”, uroczystość pożegnania.
// Bez ceremonii: sam pochówek albo „w gronie najbliższej rodziny”.
// Miejsca wpisuje zakład w formie, w jakiej stoją w zdaniu („w kościele pw. św. Anny w Łodzi”,
// „na cmentarzu parafialnym w Łodzi”). Gdy ich brak, bierzemy miejsce z kalendarza w nawiasie – bez zgadywania odmiany.
import { TZ } from "./format";

export type ObituarySymbol = "krzyz" | "galazka" | "brak";

export type ObituaryEvent = { kind: "ceremonia" | "pochowek" | "kremacja"; startsAt: string; place: string | null };

export type ObituaryInput = {
  ceremony: "religijna" | "swiecka" | "bez";
  burial: "tradycyjny" | "kremacja" | "nie_wiem";
  gender: "k" | "m";
  firstName: string | null;
  lastName: string | null;
  maidenName?: string | null;
  bornOn: string | null;
  /** Wiek policzony wcześniej (publiczna klepsydra nie dostaje daty urodzenia). Ma pierwszeństwo przed bornOn. */
  age?: number | null;
  diedAt: string | Date | null;
  description?: string | null;
  sacraments?: boolean;
  rosary?: string | null;
  request?: string | null;
  signature?: string | null;
  symbol?: ObituarySymbol | null;
  privateFuneral?: boolean;
  ceremonyPlace?: string | null;
  cemeteryPlace?: string | null;
  events: ObituaryEvent[];
  homeName: string;
  homePhone: string;
};

export type Obituary = {
  religious: boolean;
  symbol: ObituarySymbol;
  intro: string;
  honorific: string | null;
  name: string;
  maiden: string | null;
  age: string | null;
  description: string | null;
  ceremony: string[];
  rosary: string | null;
  request: string | null;
  signature: string;
  footer: string;
  /** „zmarła” / „zmarł” i data zgonu („14 października 2026 r.”) – do krótkich form (obraz podglądu linku). */
  verb: string;
  diedOn: string | null;
  /** Pierwsza uroczystość do krótkiego tekstu udostępnienia: np. „Msza Święta żałobna: sobota 17 października, godz. 11:00”. */
  firstEvent: string | null;
  missing: string[];
};

const WEEKDAY_ACC = ["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"];

function warsawParts(value: string | Date) {
  const d = typeof value === "string" ? new Date(value) : value;
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  const y = Number(p.year);
  const m = Number(p.month);
  const day = Number(p.day);
  return { y, m, day, time: `${p.hour}:${p.minute}`, weekday: new Date(Date.UTC(y, m - 1, day)).getUTCDay() };
}

const MONTH_GEN = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const WEEKDAY_NOM = ["niedziela", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota"];

/** „14 października 2026 r.” */
function longDate(value: string | Date): string {
  const p = warsawParts(value);
  return `${p.day} ${MONTH_GEN[p.m - 1]} ${p.y} r.`;
}

/** „w sobotę 17 października 2026 r. o godz. 11:00” */
function when(value: string): string {
  const p = warsawParts(value);
  return `${WEEKDAY_ACC[p.weekday]} ${longDate(value)} o godz. ${p.time}`;
}

/** Wiek w dniu zgonu (data zgonu w strefie Polski). */
export function ageAtDeath(bornOn: string | null, diedAt: string | Date | null): number | null {
  if (!bornOn || !diedAt) return null;
  const [y, m, d] = bornOn.split("-").map(Number);
  const p = warsawParts(diedAt);
  let age = p.y - y;
  if (p.m < m || (p.m === m && p.day < d)) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

const clean = (s: string | null | undefined) => {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  return t.length ? t : null;
};

function sameDay(a: string, b: string) {
  const x = warsawParts(a);
  const y = warsawParts(b);
  return x.y === y.y && x.m === y.m && x.day === y.day;
}

export function buildObituary(input: ObituaryInput): Obituary {
  const religious = input.ceremony === "religijna";
  const female = input.gender === "k";
  const urn = input.burial === "kremacja";
  const missing: string[] = [];

  const name = clean([input.firstName, input.lastName].filter(Boolean).join(" "));
  if (!name) missing.push("imię i nazwisko");
  if (!input.diedAt) missing.push("data zgonu");

  const died = input.diedAt ? `dnia ${longDate(input.diedAt)}` : "dnia [data zgonu]";
  const verb = female ? "zmarła" : "zmarł";
  const sacraments = religious && input.sacraments ? `, ${female ? "opatrzona" : "opatrzony"} Świętymi Sakramentami,` : "";
  const intro = religious
    ? `Z głębokim żalem i smutkiem zawiadamiamy, że ${died} ${verb}${sacraments}`
    : `Z głębokim żalem zawiadamiamy, że ${died} ${verb}`;

  const ageN = input.age ?? ageAtDeath(input.bornOn, input.diedAt);
  const age = ageN === null ? null : religious ? `przeżywszy lat ${ageN}` : `w wieku ${ageN} lat`;

  const ceremonyEvent = input.events.filter((e) => e.kind === "ceremonia").sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const burialEvent = input.events.filter((e) => e.kind === "pochowek").sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const at = (custom: string | null | undefined, ev: ObituaryEvent | undefined) => {
    const c = clean(custom);
    if (c) return ` ${c}`;
    const p = clean(ev?.place);
    return p ? ` (${p})` : "";
  };
  const ceremonyAt = at(input.ceremonyPlace, ceremonyEvent);
  const cemeteryAt = at(input.cemeteryPlace, burialEvent);
  const burialPhrase = urn ? `urna z prochami zostanie złożona${cemeteryAt}` : `nastąpi odprowadzenie do grobu${cemeteryAt}`;
  const hasCemetery = cemeteryAt.length > 0 || Boolean(burialEvent);

  const ceremony: string[] = [];
  let firstEvent: string | null = null;
  const short = (label: string, startsAt: string) => {
    const p = warsawParts(startsAt);
    return `${label}: ${WEEKDAY_NOM[p.weekday]} ${p.day} ${MONTH_GEN[p.m - 1]}, godz. ${p.time}`;
  };

  if (input.privateFuneral) {
    ceremony.push("Uroczystości pogrzebowe odbędą się w gronie najbliższej rodziny.");
  } else if (input.ceremony !== "bez") {
    const label = religious ? "Msza Święta żałobna" : "Uroczystość pożegnania";
    if (!ceremonyEvent) {
      missing.push("termin ceremonii");
      ceremony.push(`${label} ${religious ? "zostanie odprawiona" : "odbędzie się"} [termin i miejsce – dodaj ceremonię w kalendarzu zlecenia].`);
    } else {
      firstEvent = short(label, ceremonyEvent.startsAt);
      const main = `${label} ${religious ? "zostanie odprawiona" : "odbędzie się"} ${when(ceremonyEvent.startsAt)}${ceremonyAt}`;
      if (burialEvent && !sameDay(burialEvent.startsAt, ceremonyEvent.startsAt)) {
        ceremony.push(`${main}.`);
        ceremony.push(
          urn
            ? `Złożenie urny z prochami nastąpi ${when(burialEvent.startsAt)}${cemeteryAt}.`
            : `Odprowadzenie do grobu nastąpi ${when(burialEvent.startsAt)}${cemeteryAt}.`,
        );
      } else if (hasCemetery) {
        ceremony.push(`${main}, po czym ${burialPhrase}.`);
      } else {
        ceremony.push(`${main}.`);
      }
    }
  } else if (burialEvent) {
    const label = urn ? "Złożenie urny z prochami" : "Pogrzeb";
    firstEvent = short(label, burialEvent.startsAt);
    ceremony.push(`${label} odbędzie się ${when(burialEvent.startsAt)}${cemeteryAt}.`);
  } else {
    ceremony.push("Pogrzeb odbędzie się w gronie najbliższej rodziny.");
  }

  const symbol: ObituarySymbol = religious ? (input.symbol === "brak" ? "brak" : "krzyz") : input.symbol === "galazka" ? "galazka" : "brak";

  return {
    religious,
    symbol,
    intro,
    honorific: religious ? "Ś.P." : null,
    name: name ?? "[imię i nazwisko]",
    maiden: clean(input.maidenName) ? `z domu ${clean(input.maidenName)}` : null,
    age,
    description: clean(input.description),
    ceremony,
    rosary: religious ? clean(input.rosary) : null,
    request: clean(input.request),
    signature: clean(input.signature) ?? (religious ? "O czym zawiadamia pogrążona w smutku Rodzina" : "Pogrążona w smutku Rodzina"),
    footer: `${input.homeName}, tel. ${input.homePhone}`,
    verb,
    diedOn: input.diedAt ? longDate(input.diedAt) : null,
    firstEvent,
    missing,
  };
}

/** Krótki tekst do SMS-a, WhatsAppa i e-maila – kto zmarł i kiedy uroczystość. Bez danych rodziny. */
export function shareText(o: Obituary): string {
  const verb = o.verb;
  const who = [o.honorific, o.name].filter(Boolean).join(" ");
  return `Z żalem zawiadamiamy, że ${verb} ${who}.${o.firstEvent ? ` ${o.firstEvent}.` : ""}`;
}
