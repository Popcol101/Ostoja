import { expect, test, type Page } from "@playwright/test";

// Faktury: właścicielka łączy Fakturownię (klucz zaszyfrowany, nie wraca na ekran), uzupełnia adres płacącego,
// oznacza umowę – faktura powstaje w programie zakładu; bez połączenia – faktura wpisana ręcznie z numerem KSeF.

const ORDER = "/panel/zlecenia/00000000-0000-4000-d000-000000000002"; // Jan Kowalski, przed umową
const TOKEN = "fakturownia-test-token";

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `docs/zrzuty/${test.info().project.name}-${name}.png`, fullPage: true });
}

test("połączenie z Fakturownią i faktura po podpisaniu umowy", async ({ page, request }) => {
  await page.goto("/logowanie");
  await page.getByRole("button", { name: /Anna Cichońska/ }).click();
  await page.waitForURL(/\/panel/);

  await page.goto("/panel/profil");
  const card = page.locator("section", { hasText: "Program do faktur" });
  await card.getByLabel("Nazwa konta").fill("https://dom-cisza.fakturownia.pl");
  const tokenField = card.getByLabel(/kod autoryzacyjny API/i);
  await tokenField.fill(TOKEN);
  await card.getByRole("button", { name: /Połącz Fakturownię|Zapisz ustawienia/ }).click();
  await expect(page.getByText("Program do faktur połączony.", { exact: false })).toBeVisible();
  await expect(card.getByText("połączono · klucz …oken")).toBeVisible();
  expect(await page.content()).not.toContain(TOKEN);
  await expect(card.getByLabel("Nazwa konta")).toHaveValue("dom-cisza");
  await shot(page, "55-faktury-polaczenie");

  // Umowa Jana Kowalskiego: najpierw adres płacącego, potem umowa → faktura w Fakturowni.
  await page.goto(ORDER);
  const signed = await page.getByText("Podpisana", { exact: true }).count();
  if (!signed) {
    await page.getByText("Adres do faktury i wniosku o zasiłek").click();
    await page.getByLabel("Ulica i numer").fill("ul. Lipowa 2");
    await page.getByLabel("Kod", { exact: true }).fill("90-001");
    await page.getByLabel("Miejscowość").fill("Łódź");
    await page.getByRole("button", { name: "Zapisz adres" }).click();
    await expect(page.getByText("Zapisano dane.")).toBeVisible();
    await page.getByLabel(/Potwierdzam, że umowa z rodziną jest podpisana/).check();
    await page.getByRole("button", { name: "Umowa podpisana" }).click();
    await expect(page.getByText("Umowa oznaczona jako podpisana.")).toBeVisible();
  }
  const invoice = page.locator("section", { hasText: "Faktura" }).filter({ has: page.getByRole("heading", { name: "Faktura" }) });
  await expect(async () => {
    await page.reload();
    await expect(invoice.getByText(/^FV \d+\/11\/2026$/).first()).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await expect(invoice.getByText("poza KSeF (faktura dla osoby prywatnej)")).toBeVisible();
  await shot(page, "56-faktura-zlecenie");

  const sent = await (await request.get("http://127.0.0.1:54399/mock/fakturownia")).json();
  expect(sent.account).toBe("dom-cisza");
  expect(sent.body.invoice.buyer_last_name).toBe("Kowalska");
  expect(sent.body.invoice.description).toBe("Koszty pogrzebu: Jan Kowalski");
  expect(sent.body.gov_save_and_send).toBe(false);
});

test("faktura z innego programu wpisana ręcznie", async ({ page }) => {
  await page.goto("/logowanie");
  await page.getByRole("button", { name: /Anna Cichońska/ }).click();
  await page.waitForURL(/\/panel/);
  await page.goto("/panel/zlecenia/00000000-0000-4000-d000-000000000003"); // Teresa Lis, po umowie
  await page.getByText(/Faktura z innego programu – wpisz dane|Popraw dane faktury/).click();
  await page.getByLabel("Numer faktury").fill("FV 7/10/2026");
  await page.getByLabel("Data wystawienia").fill("2026-10-20");
  await page.getByLabel("Numer KSeF (jeśli jest)").fill("zly");
  await page.getByRole("button", { name: "Zapisz fakturę" }).click();
  await expect(page.getByText("Numer KSeF ma postać", { exact: false })).toBeVisible();
  await page.getByText(/Faktura z innego programu – wpisz dane|Popraw dane faktury/).click();
  await page.getByLabel("Numer faktury").fill("FV 7/10/2026");
  await page.getByLabel("Data wystawienia").fill("2026-10-20");
  await page.getByLabel("Numer KSeF (jeśli jest)").fill("5252445767-20261020-ABC123DEF456");
  await page.getByRole("button", { name: "Zapisz fakturę" }).click();
  await expect(page.getByText("Zapisano dane faktury.")).toBeVisible();
  await expect(page.getByText("5252445767-20261020-ABC123DEF456")).toBeVisible();
});
