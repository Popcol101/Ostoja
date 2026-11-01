import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

// Opieka nad grobem: zamówienie bez konta (tylko gdy da się ustalić drogę do grobu), płatność testowa,
// e-mail z linkiem, wizyta u usługodawcy ze zdjęciem, zdjęcie u klienta.

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `docs/zrzuty/${test.info().project.name}-${name}.png`, fullPage: true });
}

test("zamówienie, płatność testowa, wizyta ze zdjęciem", async ({ page, browser, request }) => {
  const email = `klient-${test.info().project.name}@example.test`;
  await page.goto("/groby");
  await expect(page.getByRole("heading", { name: "Opieka nad grobem", level: 1 })).toBeVisible();

  // Cmentarz bez wyszukiwarki: bez położenia z telefonu zamówienie nie przejdzie.
  await page.getByLabel("Cmentarz").selectOption({ label: "Cmentarz parafialny testowy przy ul. Przykładowej" });
  await expect(page.getByText("Ten cmentarz nie ma wyszukiwarki grobów.", { exact: false })).toBeVisible();
  await page.getByLabel("Imię i nazwisko osoby pochowanej").fill("Jan Testowy");
  await page.getByLabel("Kwatera").fill("12");
  await page.getByLabel("Numer").fill("5");
  await page.getByLabel("Imię i nazwisko", { exact: true }).fill("Ewa Testowa");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/Akceptuję/).check();
  await page.getByRole("button", { name: "Dalej – podsumowanie" }).click();
  await expect(page.getByText("Nie da się ustalić, jak dojść do grobu.", { exact: false })).toBeVisible();

  // Doły: kwatera i numer z wyszukiwarki; znicz × 2 i sprzątanie, co miesiąc.
  await page.getByLabel("Cmentarz").selectOption({ label: "Cmentarz Komunalny Doły" });
  await expect(page.getByRole("link", { name: /wyszukiwarce grobów/ })).toHaveAttribute("href", /cmentarzekomunalne\.lodz/);
  await page.getByLabel("Imię i nazwisko osoby pochowanej").fill("Jan Testowy");
  await page.getByLabel("Kwatera").fill("IV");
  await page.getByLabel("Rząd").fill("3");
  await page.getByLabel("Numer").fill("17");
  await page.getByLabel("Sztuk").first().fill("2");
  await page.getByRole("checkbox", { name: /Sprzątanie grobu/ }).check();
  await expect(page.getByText("120 zł", { exact: true })).toBeVisible(); // 40 + 2×10 + 60
  await page.getByLabel("Jak często").selectOption("co_miesiac");
  await page.getByLabel("Imię i nazwisko", { exact: true }).fill("Ewa Testowa");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel(/Akceptuję/).check();
  await shot(page, "60-groby-zamowienie");
  await page.getByRole("button", { name: "Dalej – podsumowanie" }).click();

  await page.waitForURL(/\/usluga\/[a-f0-9]{48}$/);
  const orderUrl = page.url();
  await expect(page.getByText("Do zapłaty", { exact: true })).toBeVisible();
  await expect(page.getByText("Za każdą wizytę")).toBeVisible();
  await page.getByRole("link", { name: /Zapłać 120/ }).click();
  await expect(page.getByText("Płatność testowa")).toBeVisible();
  await page.getByRole("button", { name: /Zapłać 120.*\(test\)/ }).click();
  await expect(page.getByText("Zamówienie jest opłacone", { exact: false })).toBeVisible();
  await expect(page.getByText("Spokój – opieka nad grobami (test)")).toBeVisible();
  await expect(page.getByText("Zdjęcie pojawi się po wizycie.")).toBeVisible();
  await shot(page, "61-groby-oplacone");

  const mail = await (await request.get(`http://127.0.0.1:54399/mock/outbox?to=${encodeURIComponent(email)}`)).json();
  expect(mail.subject).toContain("Potwierdzenie zamówienia");
  expect(mail.text).toContain(orderUrl.replace(/^https?:\/\/[^/]+/, ""));

  // Usługodawca: wizyta bez telefonu i e-maila klienta, zdjęcie obowiązkowe.
  const ctx = await browser.newContext();
  const prov = await ctx.newPage();
  await prov.goto("/logowanie");
  await prov.getByRole("button", { name: /Marek Spokojny/ }).click();
  await prov.waitForURL(/\/uslugi/);
  const card = prov.locator("li", { hasText: "kwatera IV, rząd 3, nr 17" }).first();
  await expect(card.getByText("Jan Testowy")).toBeVisible();
  expect(await prov.content()).not.toContain(email);
  await shot(prov, "62-uslugodawca-wizyty");
  const jpeg = readFileSync("tests/e2e/grob.jpg");
  await card.locator('input[type="file"]').setInputFiles({ name: "grob.jpg", mimeType: "image/jpeg", buffer: jpeg });
  await card.getByLabel("Uwagi dla klienta (nieobowiązkowe)").fill("Znicze zapalone, płyta umyta.");
  await card.getByRole("button", { name: "Wykonane – wyślij zdjęcie" }).click();
  await expect(prov.getByText("Wizyta zapisana. Klient dostał zdjęcie.")).toBeVisible();

  // Klient widzi zdjęcie pod swoim linkiem; następna wizyta za miesiąc już zaplanowana.
  await page.goto(orderUrl);
  const img = page.getByRole("img", { name: /Grób po wizycie/ });
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByText("Znicze zapalone, płyta umyta.")).toBeVisible();
  await expect(page.getByText("Zaplanowana")).toBeVisible();
  await shot(page, "63-groby-zdjecie");
  await ctx.close();
});
