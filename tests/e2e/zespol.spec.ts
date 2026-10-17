import { expect, test, type Browser, type Page } from "@playwright/test";
import { lastMail } from "./mail";

// Zaproszenie pracownika: właścicielka wysyła zaproszenie e-mailem (atrapa Brevo), osoba ustawia hasło
// i od razu jest w panelu (atrapa Supabase Auth). Osoba z kontem dołącza do kolejnego zakładu swoim hasłem.

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `docs/zrzuty/${test.info().project.name}-${name}.png`, fullPage: true });
}

async function loginDemo(page: Page, who: RegExp) {
  await page.goto("/logowanie");
  await page.getByRole("button", { name: who }).click();
  await page.waitForURL(/\/panel/);
}

async function invite(page: Page, name: string, email: string, role = "biuro") {
  await page.goto("/panel/zespol");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Imię i nazwisko").fill(name);
  await page.getByLabel("E-mail służbowy").fill(email);
  await page.getByLabel("Rola").selectOption(role);
  await page.getByRole("button", { name: "Wyślij zaproszenie" }).click();
  await expect(page.getByText("Zaproszenie wysłane e-mailem. Link do ustawienia hasła działa 7 dni.")).toBeVisible();
}

async function guestPage(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

const PASSWORD = "jesienne liscie na stole";

test("właścicielka zaprasza e-mailem, osoba ustawia hasło i loguje się nim; dostęp można odebrać", async ({ page, browser }) => {
  const project = test.info().project.name;
  const email = `nowy-${project}@cisza.test`;
  const name = project === "telefon" ? "Marek Nowicki" : "Olga Wrona";

  await loginDemo(page, /Anna/);
  await invite(page, name, email);
  await expect(page.getByText(`${email} · ważne do`)).toBeVisible();
  await expect(page.locator("p.font-mono")).toHaveCount(0); // link idzie tylko e-mailem
  await shot(page, "15-zespol");

  const mail = await lastMail(page.request, email);
  expect(mail.subject).toBe("Zaproszenie do panelu Ostoi – Dom Pogrzebowy Cisza");
  expect(mail.html).toContain("Ustaw hasło i dołącz");
  expect(mail.html).toContain(name);

  // Osoba zaproszona – osobna przeglądarka, bez sesji.
  const { ctx, page: guest } = await guestPage(browser);
  await guest.goto(mail.path);
  await guest.waitForLoadState("networkidle");
  await expect(guest.getByRole("heading", { name: /zaprasza Cię do panelu Ostoi/ })).toBeVisible();
  await expect(guest.getByText(email)).toHaveCount(0); // adres ukryty
  await shot(guest, "16-zaproszenie");

  // Różne hasła – komunikat, zaproszenie dalej działa.
  await guest.getByLabel("Hasło", { exact: true }).fill(PASSWORD);
  await guest.getByLabel("Powtórz hasło", { exact: true }).fill(PASSWORD + "x");
  await guest.getByRole("button", { name: "Ustaw hasło i dołącz" }).click();
  await expect(guest.getByText("Hasła się różnią. Wpisz to samo hasło dwa razy.")).toBeVisible();

  // „Pokaż” odsłania hasło.
  await guest.getByLabel("Hasło", { exact: true }).fill(PASSWORD);
  await guest.getByRole("button", { name: "Pokaż hasło" }).first().click();
  await expect(guest.getByLabel("Hasło", { exact: true })).toHaveAttribute("type", "text");
  await guest.getByLabel("Powtórz hasło", { exact: true }).fill(PASSWORD);
  await guest.getByRole("button", { name: "Ustaw hasło i dołącz" }).click();
  await expect(guest).toHaveURL(/\/panel\/zapytania/);
  await expect(guest.getByText("Witaj w panelu Ostoi. Logujesz się tym adresem e-mail i hasłem.")).toBeVisible();
  await expect(guest.getByText(`${name} · Biuro`)).toBeVisible();

  // Link drugi raz nie działa.
  await guest.goto(mail.path);
  await expect(guest.getByText("To zaproszenie zostało już przyjęte. Zaloguj się e-mailem i hasłem.")).toBeVisible();

  // Biuro widzi zespół, ale nie zaprasza.
  await guest.goto("/panel/zespol");
  await expect(guest.getByText("Zespół zmienia właściciel zakładu")).toBeVisible();
  await ctx.close();

  // Logowanie e-mailem i hasłem w nowej przeglądarce.
  const second = await guestPage(browser);
  await second.page.goto("/logowanie");
  await second.page.getByLabel("E-mail", { exact: true }).fill(email);
  await second.page.getByLabel("Hasło", { exact: true }).fill(PASSWORD);
  await second.page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(second.page).toHaveURL(/\/panel\/zapytania/);

  // Właścicielka odbiera dostęp.
  await page.goto("/panel/zespol");
  await page.waitForLoadState("networkidle");
  const row = page.locator("li", { hasText: email });
  await row.getByText("Odbierz dostęp").first().click();
  await row.getByLabel("Potwierdzam").check();
  await row.getByRole("button", { name: "Odbierz dostęp" }).click();
  await expect(page.getByText("Dostęp odebrany.")).toBeVisible();
  await expect(page.locator("li", { hasText: email })).toHaveCount(0);

  // Przy następnym kliknięciu pracownik traci dostęp, a hasło już nie wpuszcza.
  await second.page.goto("/panel/zlecenia");
  await expect(second.page).toHaveURL(/\/logowanie/);
  await second.page.getByLabel("E-mail", { exact: true }).fill(email);
  await second.page.getByLabel("Hasło", { exact: true }).fill(PASSWORD);
  await second.page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(second.page.getByText("To konto nie jest przypisane do żadnego zakładu.", { exact: false })).toBeVisible();

  // Osoba z kontem dołącza do innego zakładu swoim hasłem.
  const kalina = await guestPage(browser);
  await loginDemo(kalina.page, /Katarzyna Kalinowska/);
  await invite(kalina.page, name, email, "ekipa");
  const again = await lastMail(page.request, email);
  expect(again.subject).toBe("Zaproszenie do panelu Ostoi – Zakład Pogrzebowy Kalina");
  await second.page.goto(again.path);
  await second.page.waitForLoadState("networkidle");
  await expect(second.page.getByText("Masz już konto w Ostoi.", { exact: false })).toBeVisible();
  await second.page.getByLabel("Twoje hasło", { exact: true }).fill("zle haslo zle haslo");
  await second.page.getByRole("button", { name: "Dołącz do zakładu" }).click();
  await expect(second.page.getByText("Nieprawidłowe hasło.")).toBeVisible();
  await second.page.getByLabel("Twoje hasło", { exact: true }).fill(PASSWORD);
  await second.page.getByRole("button", { name: "Dołącz do zakładu" }).click();
  await expect(second.page).toHaveURL(/\/panel\/zapytania/);
  await expect(second.page.getByText(`${name} · Ekipa`)).toBeVisible();
  await kalina.ctx.close();
  await second.ctx.close();
});

test("ponowna wysyłka zaproszenia unieważnia poprzedni link", async ({ page }) => {
  const email = `ponownie-${test.info().project.name}@cisza.test`;
  await loginDemo(page, /Anna/);
  await invite(page, "Jan Ponowny", email);
  const first = await lastMail(page.request, email);
  const row = page.locator("li", { hasText: email });
  await row.getByRole("button", { name: "Wyślij ponownie" }).click();
  // Komunikat jest ten sam co po pierwszej wysyłce – czekamy na nowy e-mail.
  await expect.poll(async () => (await lastMail(page.request, email)).path).not.toBe(first.path);
  await expect(page.getByText("Zaproszenie wysłane e-mailem.", { exact: false })).toBeVisible();
  await page.goto(first.path);
  await expect(page.getByText("To zaproszenie zostało odwołane.", { exact: false })).toBeVisible();
  await page.goto("/panel/zespol");
  await page.locator("li", { hasText: email }).getByRole("button", { name: "Odwołaj" }).click();
  await expect(page.getByText("Zaproszenie odwołane. Link przestał działać.")).toBeVisible();
});

test("nieprawidłowy link zaproszenia", async ({ page }) => {
  await page.goto("/zaproszenie?t=" + "x".repeat(43));
  await expect(page.getByText("Ten link zaproszenia jest nieprawidłowy.")).toBeVisible();
});
