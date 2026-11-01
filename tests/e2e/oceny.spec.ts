import { expect, test, type Page } from "@playwright/test";

// Oceny od rodzin: rodzina ocenia z linku (bez konta) dopiero po pogrzebie, zakład widzi ocenę w profilu,
// administrator może ukryć ocenę łamiącą regulamin (z powodem).

const FAMILY_AFTER = "/r/demo-rodzina-lis-000000000000000000000000000000"; // zlecenie w rozliczeniu
const FAMILY_BEFORE = "/r/demo-rodzina-kowalski-00000000000000000000000000"; // przed umową

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `docs/zrzuty/${test.info().project.name}-${name}.png`, fullPage: true });
}

async function login(page: Page, who: RegExp) {
  await page.goto("/logowanie");
  await page.getByRole("button", { name: who }).click();
  await page.waitForURL(/\/(panel|admin)/);
}

test("rodzina ocenia zakład z linku, zakład i administrator widzą ocenę", async ({ page, browser }) => {
  // Przed pogrzebem nie ma oceny.
  await page.goto(FAMILY_BEFORE);
  await expect(page.getByRole("heading", { name: "Jak pracował zakład?" })).toHaveCount(0);

  // Po pogrzebie: wybór oceny i komentarz.
  await page.goto(FAMILY_AFTER);
  const card = page.locator("#ocena");
  await expect(card.getByRole("heading", { name: "Jak pracował zakład?" })).toBeVisible();
  await card.getByRole("radio", { name: /^4/ }).check({ force: true });
  await card.getByLabel("Komentarz (nieobowiązkowe)").fill("Spokojnie i bez pośpiechu, wszystko wyjaśnione.");
  await card.getByRole("button", { name: /Wyślij ocenę|Zmień ocenę/ }).click();
  await expect(page.getByText("Dziękujemy za ocenę. Pomoże innym rodzinom wybrać zakład.")).toBeVisible();
  await expect(card.getByText("Twoja ocena: 4 z 5")).toBeVisible();
  await shot(page, "50-ocena-rodzina");

  // Zakład widzi ocenę w profilu.
  const homeCtx = await browser.newContext();
  const home = await homeCtx.newPage();
  await login(home, /Anna Cichońska/);
  await home.goto("/panel/profil");
  const reviews = home.getByRole("region", { name: "Oceny od rodzin" }).or(home.locator("section", { hasText: "Oceny od rodzin" }));
  await expect(reviews.getByText("Ocena 4 z 5")).toBeVisible();
  await expect(reviews.getByText("Spokojnie i bez pośpiechu, wszystko wyjaśnione.")).toBeVisible();
  await shot(home, "51-oceny-panel");

  // Administrator ukrywa ocenę z powodem; zakład widzi, że nie liczy się do średniej.
  const adminCtx = await browser.newContext();
  const admin = await adminCtx.newPage();
  await login(admin, /Ola Maj/);
  await admin.goto("/admin/oceny");
  const restore = admin.getByRole("button", { name: "Przywróć ocenę" });
  if (await restore.count()) {
    await restore.first().click();
    await expect(admin.getByText("Ocena przywrócona.")).toBeVisible();
  }
  await admin.getByLabel("Powód ukrycia").first().fill("Test: dane osobowe w komentarzu");
  await admin.getByRole("button", { name: "Ukryj ocenę" }).first().click();
  await expect(admin.getByText("Ocena ukryta. Nie liczy się do średniej zakładu.")).toBeVisible();
  await shot(admin, "52-oceny-admin");

  await home.reload();
  await expect(home.getByText("Ukryta przez Ostoję – nie liczy się do średniej")).toBeVisible();

  // Sprzątanie: ocena wraca, żeby kolejny przebieg zaczynał tak samo.
  await admin.getByRole("button", { name: "Przywróć ocenę" }).first().click();
  await expect(admin.getByText("Ocena przywrócona.")).toBeVisible();
  await homeCtx.close();
  await adminCtx.close();
});
