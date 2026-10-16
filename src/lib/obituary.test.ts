import { describe, expect, it } from "vitest";
import { ageAtDeath, buildObituary, shareText, type ObituaryInput } from "./obituary";

const base: ObituaryInput = {
  ceremony: "religijna",
  burial: "tradycyjny",
  gender: "k",
  firstName: "Halina",
  lastName: "Nowak",
  maidenName: "Kowalczyk",
  bornOn: "1944-05-30",
  diedAt: "2026-10-14T06:30:00Z",
  description: "emerytowana nauczycielka, ukochana Mama i Babcia",
  sacraments: true,
  rosary: null,
  request: null,
  signature: null,
  privateFuneral: false,
  ceremonyPlace: "w kościele pw. św. Anny w Łodzi",
  cemeteryPlace: "na Cmentarzu Starym przy ul. Ogrodowej w Łodzi",
  events: [
    { kind: "ceremonia", startsAt: "2026-10-17T09:00:00Z", place: "Kościół św. Anny" }, // sobota, 11:00 w Warszawie
    { kind: "pochowek", startsAt: "2026-10-17T10:15:00Z", place: "Cmentarz Stary" },
  ],
  homeName: "Dom Pogrzebowy Cisza",
  homePhone: "+48 600 000 001",
};

describe("klepsydra religijna", () => {
  const o = buildObituary(base);

  it("ma krzyż, Ś.P., sakramenty i wiek w tradycyjnej formie", () => {
    expect(o.symbol).toBe("krzyz");
    expect(o.honorific).toBe("Ś.P.");
    expect(o.intro).toBe("Z głębokim żalem i smutkiem zawiadamiamy, że dnia 14 października 2026 r. zmarła, opatrzona Świętymi Sakramentami,");
    expect(o.name).toBe("Halina Nowak");
    expect(o.maiden).toBe("z domu Kowalczyk");
    expect(o.age).toBe("przeżywszy lat 82");
  });

  it("zaprasza na Mszę Świętą z dniem tygodnia i odprowadzeniem do grobu", () => {
    expect(o.ceremony).toEqual([
      "Msza Święta żałobna zostanie odprawiona w sobotę 17 października 2026 r. o godz. 11:00 w kościele pw. św. Anny w Łodzi, po czym nastąpi odprowadzenie do grobu na Cmentarzu Starym przy ul. Ogrodowej w Łodzi.",
    ]);
    expect(o.signature).toBe("O czym zawiadamia pogrążona w smutku Rodzina");
    expect(o.missing).toEqual([]);
  });

  it("dla mężczyzny odmienia formy", () => {
    const m = buildObituary({ ...base, gender: "m", firstName: "Jan", maidenName: null });
    expect(m.intro).toContain("zmarł, opatrzony Świętymi Sakramentami,");
    expect(m.maiden).toBeNull();
  });

  it("przy kremacji mówi o złożeniu urny", () => {
    const k = buildObituary({ ...base, burial: "kremacja" });
    expect(k.ceremony[0]).toContain("po czym urna z prochami zostanie złożona na Cmentarzu Starym");
  });

  it("bez sakramentów nie dopisuje formuły", () => {
    expect(buildObituary({ ...base, sacraments: false }).intro).toBe(
      "Z głębokim żalem i smutkiem zawiadamiamy, że dnia 14 października 2026 r. zmarła",
    );
  });
});

describe("klepsydra świecka", () => {
  const s = buildObituary({
    ...base,
    ceremony: "swiecka",
    sacraments: true, // ignorowane przy ceremonii świeckiej
    ceremonyPlace: "w sali pożegnań Domu Pogrzebowego Cisza",
  });

  it("nie ma symboli religijnych ani formuł kościelnych", () => {
    expect(s.symbol).toBe("brak");
    expect(s.honorific).toBeNull();
    expect(s.intro).toBe("Z głębokim żalem zawiadamiamy, że dnia 14 października 2026 r. zmarła");
    expect(s.age).toBe("w wieku 82 lat");
    expect(JSON.stringify(s)).not.toMatch(/Msza|Sakrament|Ś\.P\.|Świętej/);
  });

  it("zaprasza na uroczystość pożegnania", () => {
    expect(s.ceremony[0]).toBe(
      "Uroczystość pożegnania odbędzie się w sobotę 17 października 2026 r. o godz. 11:00 w sali pożegnań Domu Pogrzebowego Cisza, po czym nastąpi odprowadzenie do grobu na Cmentarzu Starym przy ul. Ogrodowej w Łodzi.",
    );
    expect(s.signature).toBe("Pogrążona w smutku Rodzina");
  });

  it("pozwala wybrać gałązkę zamiast pustego miejsca", () => {
    expect(buildObituary({ ...base, ceremony: "swiecka", symbol: "galazka" }).symbol).toBe("galazka");
    expect(buildObituary({ ...base, ceremony: "swiecka", symbol: "krzyz" }).symbol).toBe("brak"); // krzyż tylko przy religijnej
  });
});

describe("bez ceremonii i przypadki szczególne", () => {
  it("bez ceremonii podaje tylko pochówek", () => {
    const b = buildObituary({ ...base, ceremony: "bez", burial: "kremacja", events: [base.events[1]] });
    expect(b.ceremony).toEqual(["Złożenie urny z prochami odbędzie się w sobotę 17 października 2026 r. o godz. 12:15 na Cmentarzu Starym przy ul. Ogrodowej w Łodzi."]);
  });

  it("pogrzeb w gronie najbliższych nie podaje terminu", () => {
    const p = buildObituary({ ...base, privateFuneral: true });
    expect(p.ceremony).toEqual(["Uroczystości pogrzebowe odbędą się w gronie najbliższej rodziny."]);
    expect(p.missing).toEqual([]);
  });

  it("bez miejsca w treści używa miejsca z kalendarza w nawiasie", () => {
    const n = buildObituary({ ...base, ceremonyPlace: null, cemeteryPlace: null });
    expect(n.ceremony[0]).toContain("o godz. 11:00 (Kościół św. Anny), po czym nastąpi odprowadzenie do grobu (Cmentarz Stary).");
  });

  it("pochówek innego dnia to osobne zdanie", () => {
    const d = buildObituary({ ...base, events: [base.events[0], { kind: "pochowek", startsAt: "2026-10-19T08:00:00Z", place: null }] });
    expect(d.ceremony).toEqual([
      "Msza Święta żałobna zostanie odprawiona w sobotę 17 października 2026 r. o godz. 11:00 w kościele pw. św. Anny w Łodzi.",
      "Odprowadzenie do grobu nastąpi w poniedziałek 19 października 2026 r. o godz. 10:00 na Cmentarzu Starym przy ul. Ogrodowej w Łodzi.",
    ]);
  });

  it("zaznacza brakujące dane i wstawia czytelne miejsca do uzupełnienia", () => {
    const e = buildObituary({ ...base, firstName: null, lastName: null, diedAt: null, events: [] });
    expect(e.name).toBe("[imię i nazwisko]");
    expect(e.intro).toContain("[data zgonu]");
    expect(e.missing).toEqual(["imię i nazwisko", "data zgonu", "termin ceremonii"]);
  });

  it("przyjmuje wiek policzony w bazie zamiast daty urodzenia", () => {
    expect(buildObituary({ ...base, bornOn: null, age: 85 }).age).toBe("przeżywszy lat 85");
  });

  it("liczy wiek w dniu zgonu w strefie Polski", () => {
    expect(ageAtDeath("1944-05-30", "2026-05-29T22:30:00Z")).toBe(82); // 30 maja, 0:30 w Polsce
    expect(ageAtDeath("1944-05-30", "2026-05-29T21:30:00Z")).toBe(81); // 29 maja, 23:30 w Polsce
    expect(ageAtDeath(null, "2026-05-29T21:30:00Z")).toBeNull();
  });

  it("krótki tekst do udostępnienia: kto i kiedy, bez danych rodziny", () => {
    const t = shareText(buildObituary(base));
    expect(t).toBe("Z żalem zawiadamiamy, że zmarła Ś.P. Halina Nowak. Msza Święta żałobna: sobota 17 października, godz. 11:00.");
    expect(t).not.toContain("600");
  });
});
