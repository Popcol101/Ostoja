import { expect, test } from "@playwright/test";

// Logowanie linkiem z e-maila (atrapa Supabase Auth) i powiadomienia (tryb testowy, bez wysyłki).

test("zakład loguje się linkiem z e-maila", async ({ page }) => {
  await page.goto("/logowanie");
  await page.getByLabel("Twój e-mail").fill("anna@cisza.test");
  await page.getByRole("button", { name: "Wyślij link" }).click();
  await expect(page.getByText("Jeśli ten adres jest przypisany do zakładu, wysłaliśmy na niego link.")).toBeVisible();

  // Wygasły link nie loguje.
  await page.goto(`/logowanie/potwierdz?token_hash=${"b".repeat(56)}`);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page.getByText("Link wygasł albo został już użyty. Poproś o nowy.")).toBeVisible();

  // Otwarcie linku nie loguje samo z siebie (skanery poczty) – dopiero kliknięcie.
  await page.goto(`/logowanie/potwierdz?token_hash=${"a".repeat(56)}`);
  await expect(page).toHaveURL(/potwierdz/);
  await page.getByRole("button", { name: "Zaloguj się" }).click();
  await expect(page).toHaveURL(/\/panel\/zapytania/);
  await expect(page.getByText("Anna Cichońska")).toBeVisible();
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
