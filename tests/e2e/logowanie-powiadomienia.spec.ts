import { expect, test, type Page } from "@playwright/test";
import { lastMail, noMail } from "./mail";

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `docs/zrzuty/${test.info().project.name}-${name}.png`, fullPage: true });
}

// Logowanie e-mailem i hasłem, „Nie pamiętam hasła” (atrapy Supabase Auth i Brevo) i powiadomienia (tryb testowy).

test("zakład loguje się e-mailem i hasłem", async ({ page }) => {
  await page.goto("/logowanie");
  await page.getByLabel("E-mail", { exact: true }).fill("anna@cisza.test");
  await page.getByLabel("Hasło", { exact: true }).fill("zle-haslo-testowe");
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page.getByText("Nieprawidłowy e-mail lub hasło.")).toBeVisible();
  await shot(page, "36-logowanie-haslo");

  await page.getByLabel("E-mail", { exact: true }).fill("anna@cisza.test");
  await page.getByLabel("Hasło", { exact: true }).fill("anna-haslo-testowe");
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page).toHaveURL(/\/panel\/zapytania/);
  await expect(page.getByText("Anna Cichońska")).toBeVisible();
});

test("nie pamiętam hasła: link e-mailem, nowe hasło, link działa raz", async ({ page }) => {
  const email = "ewa@cisza.test";
  const password = `nowe haslo ewy ${test.info().project.name}`;
  await page.goto("/logowanie");
  await page.getByRole("link", { name: "Nie pamiętam hasła" }).click();
  await expect(page).toHaveURL(/\/logowanie\/haslo/);

  // Nieznany adres: ten sam komunikat, bez e-maila.
  await page.getByLabel("E-mail", { exact: true }).fill("nikt-taki@cisza.test");
  await page.getByRole("button", { name: "Wyślij link" }).click();
  await expect(page.getByText("Jeśli ten adres ma konto w Ostoi, wysłaliśmy na niego link do ustawienia hasła.", { exact: false })).toBeVisible();
  await noMail(page.request, "nikt-taki@cisza.test");

  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Wyślij link" }).click();
  await expect(page.getByText("Jeśli ten adres ma konto w Ostoi, wysłaliśmy na niego link do ustawienia hasła.", { exact: false })).toBeVisible();
  await shot(page, "37-nie-pamietam-hasla");
  const mail = await lastMail(page.request, email);
  expect(mail.subject).toBe("Ustaw hasło do panelu Ostoi");
  expect(mail.tags).toEqual(["haslo"]);
  expect(mail.path).toMatch(/^\/logowanie\/nowe-haslo\?token_hash=[0-9a-f]{56}$/);

  // Otwarcie linku niczego nie zmienia (skanery poczty); różne hasła nie zużywają linku.
  await page.goto(mail.path);
  await expect(page.getByRole("heading", { name: "Ustaw nowe hasło" })).toBeVisible();
  await page.getByLabel("Nowe hasło", { exact: true }).fill(password);
  await page.getByLabel("Powtórz hasło", { exact: true }).fill(password + "!");
  await page.getByRole("button", { name: "Zapisz hasło i zaloguj się" }).click();
  await expect(page.getByText("Hasła się różnią. Wpisz to samo hasło dwa razy.")).toBeVisible();
  await shot(page, "38-nowe-haslo");
  await page.getByLabel("Nowe hasło", { exact: true }).fill(password);
  await page.getByLabel("Powtórz hasło", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Zapisz hasło i zaloguj się" }).click();
  await expect(page).toHaveURL(/\/panel\/zapytania/);
  await expect(page.getByText("Hasło ustawione. Od teraz logujesz się e-mailem i tym hasłem.")).toBeVisible();

  // Drugi raz ten sam link nie działa.
  await page.goto(mail.path);
  await page.getByLabel("Nowe hasło", { exact: true }).fill(password);
  await page.getByLabel("Powtórz hasło", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Zapisz hasło i zaloguj się" }).click();
  await expect(page).toHaveURL(/\/logowanie\/haslo/);
  await expect(page.getByText("Link wygasł albo został już użyty. Poproś o nowy.")).toBeVisible();

  // Nowe hasło działa.
  await page.goto("/logowanie");
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Hasło", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page).toHaveURL(/\/panel\/zapytania/);
});

test("nieprawidłowy link do ustawienia hasła", async ({ page }) => {
  await page.goto("/logowanie/nowe-haslo?token_hash=<x>");
  await expect(page.getByText("Ten link jest nieprawidłowy.")).toBeVisible();
});

test("zakład wysyła rodzinie SMS z linkiem; w trybie testowym nic nie wychodzi", async ({ page }) => {
  await page.goto("/logowanie");
  await page.getByRole("button", { name: /Anna/ }).click();
  await page.waitForURL(/zapytania/);
  await page.goto("/panel/zlecenia/00000000-0000-4000-d000-000000000005");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Wyślij SMS z linkiem" }).click();
  await expect(page.getByText("SMS z linkiem jest w drodze do rodziny.")).toBeVisible();
  await expect(page.getByRole("list", { name: "Wysłane SMS-y" })).toBeVisible();

  // Kolejka obsłużona (od razu po akcji albo przez harmonogram): bez klucza SMSAPI SMS jest pomijany.
  const res = await page.request.post("/api/powiadomienia", { headers: { authorization: "Bearer test-cron-secret-1234567890" } });
  expect(res.ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole("list", { name: "Wysłane SMS-y" })).toContainText("SMS w trybie testowym");
});

test("harmonogram wysyłki wymaga sekretu", async ({ request }) => {
  expect((await request.post("/api/powiadomienia")).status()).toBe(401);
  expect((await request.post("/api/powiadomienia", { headers: { authorization: "Bearer zly" } })).status()).toBe(401);
});
