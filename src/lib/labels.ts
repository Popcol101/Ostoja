export type Burial = "tradycyjny" | "kremacja" | "nie_wiem";
export type Ceremony = "religijna" | "swiecka" | "bez";
export type PlaceOfDeath = "szpital" | "dom" | "dps";
export type OfferStatus = "nowe" | "przyjete" | "odrzucone" | "wygasle" | "zamkniete";
export type OrderStage = "przyjete" | "umowa" | "odbior" | "ceremonia" | "rozliczenie" | "zamkniete";
export type EventKind = "odbior" | "kremacja" | "ceremonia" | "pochowek" | "spotkanie" | "inne";
export type EventStatus = "wstepny" | "potwierdzony" | "odwolany";

export const BURIAL_LABEL: Record<Burial, string> = {
  tradycyjny: "Pochówek tradycyjny",
  kremacja: "Kremacja",
  nie_wiem: "Forma do ustalenia",
};

export const CEREMONY_LABEL: Record<Ceremony, string> = {
  religijna: "Ceremonia religijna",
  swiecka: "Ceremonia świecka",
  bez: "Bez ceremonii",
};

export const PLACE_LABEL: Record<PlaceOfDeath, string> = {
  szpital: "W szpitalu",
  dom: "W domu",
  dps: "W hospicjum lub DPS",
};

export const BUDGET_LABEL: Record<string, string> = {
  zasilek: "W granicach zasiłku (do 7 000 zł)",
  srednio: "7 000–10 000 zł",
  wiecej: "Powyżej 10 000 zł",
  nie_wiem: "Nie wiem",
};

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  nowe: "Nowe",
  przyjete: "Przyjęte",
  odrzucone: "Odrzucone",
  wygasle: "Przekazane dalej",
  zamkniete: "Przyjął inny zakład",
};

export const STAGES: OrderStage[] = ["przyjete", "umowa", "odbior", "ceremonia", "rozliczenie", "zamkniete"];

export const STAGE_LABEL: Record<OrderStage, string> = {
  przyjete: "Przyjęte",
  umowa: "Umowa",
  odbior: "Odbiór",
  ceremonia: "Ceremonia",
  rozliczenie: "Rozliczenie",
  zamkniete: "Zamknięte",
};

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  odbior: "Odbiór",
  kremacja: "Kremacja",
  ceremonia: "Ceremonia",
  pochowek: "Pochówek",
  spotkanie: "Spotkanie",
  inne: "Inne",
};

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  wstepny: "Wstępny",
  potwierdzony: "Potwierdzony",
  odwolany: "Odwołany",
};

export const ROLE_LABEL: Record<string, string> = {
  wlasciciel: "Właściciel",
  biuro: "Biuro",
  ekipa: "Ekipa",
};

/** Zasiłek pogrzebowy z ZUS od 1 stycznia 2026 r. */
export const FUNERAL_BENEFIT_PLN = 7000;
/** Opłata Ostoi za zlecenie z podpisaną umową (netto). */
export const OSTOJA_FEE_PLN = 250;
