import { expect, test, type Page } from "@playwright/test";

// Pełny przepływ: rodzina wysyła zapytanie → zakład przyjmuje → widzi telefon → umowa → klepsydra.
// Po nawigacji czekamy na pełne załadowanie (hydratację), zanim klikniemy akcję serwerową lub link
// zmieniający tylko parametry adresu (szybszy niż człowiek test potrafi kliknąć przed hydratacją).
async function settled(page: Page) {
  await page.waitForLoadState("networkidle");
}

// Zrzuty ekranu trafiają do docs/zrzuty/<projekt>-<krok>.png (390 i 1280 px).

async function shot(page: Page, name: string) {
  const project = test.info().project.name;
  await page.screenshot({ path: `docs/zrzuty/${project}-${name}.png`, fullPage: true });
}

test("rodzina wysyła zapytanie, zakład je przyjmuje i prowadzi zlecenie", async ({ page }) => {
  const guests = test.info().project.name === "telefon" ? "37" : "38";

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Pomożemy zorganizować pogrzeb");
  await shot(page, "01-start");

  await page.getByRole("link", { name: "Sprawdź ceny w swoim mieście" }).click();
  await page.getByLabel("Miasto").selectOption("lodz");
  await shot(page, "02-kreator");
  await page.getByRole("button", { name: "Dalej" }).click();
  await page.getByRole("button", { name: "Dalej" }).click();
  await expect(page.getByText("Wybierz jedną odpowiedź.")).toBeVisible();
  await page.getByLabel("W szpitalu").check();
  await page.getByRole("button", { name: "Dalej" }).click();
  await page.getByLabel(/Kremacja/).check();
  await page.getByRole("button", { name: "Dalej" }).click();
  await page.getByLabel("Religijna").check();
  await page.getByRole("button", { name: "Dalej" }).click();
  await page.getByLabel(/W granicach zasiłku/).check();
  await page.getByRole("button", { name: "Pokaż oferty" }).click();

  await expect(page).toHaveURL(/\/oferty\?/);
  await expect(page.getByRole("heading", { name: "Dom Pogrzebowy Cisza" })).toBeVisible();
  await shot(page, "03-oferty");

  // Sortowanie po cenie: najtańsza oferta na górze.
  await settled(page);
  await page.getByRole("link", { name: "Najniższa cena" }).click();
  await expect(page.getByRole("link", { name: "Najniższa cena" })).toHaveAttribute("aria-current", "true");
  const prices = await page.locator("li p.text-\\[28px\\]").allInnerTexts();
  const nums = prices.map((p) => Number(p.replace(/\D/g, "")));
  expect(nums).toEqual([...nums].sort((a, b) => a - b));

  const cisza = page.locator("li", { has: page.getByRole("heading", { name: "Dom Pogrzebowy Cisza" }) });
  await cisza.getByRole("link", { name: "Wybierz ten zakład" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dom Pogrzebowy Cisza oddzwoni");

  // Walidacja: bez zgody formularz nie przechodzi (atrybut required).
  await page.getByLabel("Twoje imię i nazwisko").fill("Joanna Testowa");
  await page.getByLabel("Numer telefonu").fill("600 100 200");
  await page.getByLabel(/Ile osób/).fill(guests);
  await page.getByLabel(/Zgadzam się na przekazanie/).check();
  await shot(page, "04-kontakt");
  await page.getByRole("button", { name: "Poproś o kontakt" }).click();

  // Kod z SMS-a (wersja testowa pokazuje go na ekranie). Zły kod – komunikat; dobry – zapytanie idzie do zakładu.
  await expect(page.getByRole("heading", { name: "Wpisz kod z SMS-a" })).toBeVisible();
  await expect(page.getByText("+48 600 ••• 200")).toBeVisible();
  const code = (await page.locator("span.font-mono").innerText()).trim();
  expect(code).toMatch(/^\d{6}$/);
  await shot(page, "05a-kod-sms");
  await settled(page);
  await page.getByLabel("Kod (6 cyfr)").fill(code === "000000" ? "111111" : "000000");
  await page.getByRole("button", { name: "Potwierdź i wyślij zapytanie" }).click();
  await expect(page.getByText("Nieprawidłowy kod. Sprawdź SMS i wpisz go jeszcze raz.")).toBeVisible();
  await settled(page);
  await page.getByLabel("Kod (6 cyfr)").fill(code);
  await page.getByRole("button", { name: "Potwierdź i wyślij zapytanie" }).click();
  await expect(page.getByRole("heading", { name: "Zapytanie wysłane" })).toBeVisible();
  await expect(page.getByText("Dom Pogrzebowy Cisza oddzwoni do Ciebie w ciągu 15 minut.")).toBeVisible();
  await shot(page, "05-wyslane");

  // Zakład: logowanie demo jako właścicielka Domu Pogrzebowego Cisza.
  await page.goto("/logowanie");
  await shot(page, "06-logowanie");
  await page.getByRole("button", { name: /Anna/ }).click();
  await expect(page).toHaveURL(/\/panel\/zapytania/);

  const card = page.locator("section", { hasText: `ok. ${guests} osób` });
  await expect(card).toBeVisible();
  // Przed przyjęciem zakład nie widzi numeru rodziny.
  await expect(page.getByText("600 100 200")).toHaveCount(0);
  await shot(page, "07-skrzynka");
  await settled(page);
  await card.getByRole("button", { name: "Przyjmij i zadzwoń" }).click();

  await expect(page).toHaveURL(/\/panel\/zlecenia\/[0-9a-f-]+/);
  await expect(page.getByText("+48 600 100 200").first()).toBeVisible();
  await expect(page.getByText("Joanna Testowa").first()).toBeVisible();
  await shot(page, "08-zlecenie");

  await settled(page);
  await page.getByLabel(/Potwierdzam, że umowa z rodziną jest podpisana/).check();
  await page.getByRole("button", { name: "Umowa podpisana" }).click();
  await expect(page.getByText("Umowa oznaczona jako podpisana.")).toBeVisible();

  await page.getByRole("link", { name: /Klepsydra do druku/ }).click();
  await expect(page).toHaveURL(/klepsydra/);
  await shot(page, "09-klepsydra");

  await page.goto("/panel/kalendarz");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await shot(page, "10-kalendarz");

  await page.goto("/panel/rozliczenia");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await shot(page, "11-rozliczenia");

  await page.goto("/panel/profil");
  await shot(page, "12-profil");
});

test("rodzina uzupełnia dane pod linkiem bez logowania", async ({ page }) => {
  await page.goto("/r/demo-rodzina-mazur-0000000000000000000000000000");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await settled(page);
  await page.getByLabel("Numer konta do wypłaty zasiłku").fill("12 3456 7890 1234 5678 9012 3456");
  await page.getByLabel(/Zgadzam się, żeby/).check();
  await page.getByRole("button", { name: "Zapisz i przekaż zakładowi" }).click();
  await expect(page.getByText("Dziękujemy. Zakład widzi już te informacje.")).toBeVisible();
  await expect(page.getByLabel("Numer konta do wypłaty zasiłku")).toHaveValue(/12 3456 7890/);
  await shot(page, "13-link-rodziny");

  await page.goto("/r/nieprawidlowy-link-0000000000");
  await expect(page.getByText("Ten link wygasł albo jest nieprawidłowy.")).toBeVisible();

  await page.goto("/pamiec/halina-nowak");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Halina Nowak");
  await shot(page, "14-pamiec");
});

test("strona pamięci nieopublikowana daje 404, panel wymaga logowania", async ({ page }) => {
  const res = await page.goto("/pamiec/nie-ma-takiej");
  expect(res?.status()).toBe(404);
  await page.goto("/panel/zlecenia");
  await expect(page).toHaveURL(/\/logowanie/);
});

test("polityka prywatności i regulamin są dostępne ze stopki", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Prywatność" }).click();
  await expect(page.getByRole("heading", { name: "Polityka prywatności", level: 1 })).toBeVisible();
  await expect(page.getByText("Nie pytamy o przyczynę zgonu ani o numer PESEL.", { exact: false })).toBeVisible();
  await shot(page, "20-prywatnosc");
  await page.getByRole("link", { name: "Regulamin" }).click();
  await expect(page.getByRole("heading", { name: "Regulamin serwisu dla rodzin", level: 1 })).toBeVisible();
  await expect(page.getByText("Zakłady nie płacą za miejsce na liście", { exact: false })).toBeVisible();
});
