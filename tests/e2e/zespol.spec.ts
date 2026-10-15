import { expect, test, type Page } from "@playwright/test";

// Zaproszenie pracownika: właścicielka tworzy link, osoba go przyjmuje i loguje się linkiem z e-maila (atrapa Supabase).

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `docs/zrzuty/${test.info().project.name}-${name}.png`, fullPage: true });
}

test("właścicielka zaprasza pracownika, ten przyjmuje i loguje się; dostęp można odebrać", async ({ page, browser }) => {
  const project = test.info().project.name;
  const email = `nowy-${project}@cisza.test`;
  const name = project === "telefon" ? "Marek Nowicki" : "Olga Wrona";

  await page.goto("/logowanie");
  await page.getByRole("button", { name: /Anna/ }).click();
  await page.waitForURL(/zapytania/);
  await page.goto("/panel/zespol");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Zespół", level: 1 })).toBeVisible();

  await page.getByLabel("Imię i nazwisko").fill(name);
  await page.getByLabel("E-mail służbowy").fill(email);
  await page.getByLabel("Rola").selectOption("biuro");
  await page.getByRole("button", { name: "Utwórz zaproszenie" }).click();
  await expect(page.getByText("Zaproszenie gotowe. Wyślij link tej osobie – działa 7 dni.")).toBeVisible();
  const link = await page.locator("p.font-mono").innerText();
  expect(link).toMatch(/\/zaproszenie\?t=[A-Za-z0-9_-]{40,60}$/);
  await expect(page.getByText(`${email} · ważne do`)).toBeVisible();
  await shot(page, "15-zespol");

  // Osoba zaproszona – osobna przeglądarka, bez sesji.
  const ctx = await browser.newContext();
  const guest = await ctx.newPage();
  await guest.goto(link.replace(/^https?:\/\/[^/]+/, "http://localhost:3100"));
  await expect(guest.getByRole("heading", { name: /zaprasza Cię do panelu Ostoi/ })).toBeVisible();
  await expect(guest.getByText(email)).toHaveCount(0); // adres ukryty
  await shot(guest, "16-zaproszenie");
  await guest.waitForLoadState("networkidle");
  await guest.getByRole("button", { name: "Przyjmij zaproszenie" }).click();
  await expect(guest).toHaveURL(/\/logowanie/);
  await expect(guest.getByText("Zaproszenie przyjęte. Wysłaliśmy link logowania na Twój e-mail – działa godzinę.")).toBeVisible();

  // Link drugi raz nie działa.
  await guest.goto(link.replace(/^https?:\/\/[^/]+/, "http://localhost:3100"));
  await expect(guest.getByText("To zaproszenie zostało już przyjęte.", { exact: false })).toBeVisible();

  // Logowanie linkiem z e-maila.
  await guest.goto(`/logowanie/potwierdz?token_hash=${"c".repeat(56)}`);
  await guest.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(guest).toHaveURL(/\/panel\/zapytania/);
  await expect(guest.getByText(`${name} · Biuro`)).toBeVisible();

  // Biuro widzi zespół, ale nie zaprasza.
  await guest.goto("/panel/zespol");
  await expect(guest.getByText("Zespół zmienia właściciel zakładu")).toBeVisible();

  // Właścicielka odbiera dostęp.
  await page.reload();
  await page.waitForLoadState("networkidle");
  const row = page.locator("li", { hasText: email });
  await row.getByText("Odbierz dostęp").first().click();
  await row.getByLabel("Potwierdzam").check();
  await row.getByRole("button", { name: "Odbierz dostęp" }).click();
  await expect(page.getByText("Dostęp odebrany.")).toBeVisible();
  await expect(page.locator("li", { hasText: email })).toHaveCount(0);

  // Przy następnym kliknięciu pracownik traci dostęp.
  await guest.goto("/panel/zlecenia");
  await expect(guest).toHaveURL(/\/logowanie/);
  await ctx.close();
});

test("nieprawidłowy link zaproszenia", async ({ page }) => {
  await page.goto("/zaproszenie?t=" + "x".repeat(43));
  await expect(page.getByText("Ten link zaproszenia jest nieprawidłowy.")).toBeVisible();
});
