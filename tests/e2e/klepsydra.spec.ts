import { expect, test, type Page } from "@playwright/test";

// Klepsydra: edytor z podglądem (religijna/świecka), zapis, publikacja za zgodą rodziny, udostępnianie, strona w sieci.

const ORDER = "/panel/zlecenia/00000000-0000-4000-d000-000000000002"; // Jan Kowalski, ceremonia religijna
const FAMILY = "/r/demo-rodzina-kowalski-00000000000000000000000000";

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `docs/zrzuty/${test.info().project.name}-${name}.png`, fullPage: true });
}

test("klepsydra religijna i świecka, publikacja i udostępnianie", async ({ page, browser }) => {
  await page.goto("/logowanie");
  await page.getByRole("button", { name: /Anna Cichońska/ }).click();
  await page.waitForURL(/\/panel/);
  await page.goto(`${ORDER}/klepsydra`);
  await page.waitForLoadState("networkidle");

  // Po przerwanym poprzednim przebiegu klepsydra mogła zostać w sieci.
  const withdraw = page.getByRole("button", { name: "Wycofaj z sieci" });
  if (await withdraw.count()) {
    await withdraw.click();
    await expect(page.getByText("Klepsydra wycofana z sieci.")).toBeVisible();
  }
  const card = page.getByRole("article", { name: /Klepsydra: Jan Kowalski/ });
  await expect(card.getByText("Ś.P.", { exact: true })).toBeVisible();
  await expect(card.getByText(/przeżywszy lat \d+/)).toBeVisible();
  await expect(card.getByText(/^Msza Święta żałobna zostanie odprawiona we? \S+ \d+ \S+ \d{4} r\. o godz\. \d\d:\d\d/)).toBeVisible();

  // Podgląd na żywo.
  await page.getByLabel(/Opatrzony Świętymi Sakramentami/).check();
  await expect(card.getByText(/zmarł, opatrzony Świętymi Sakramentami,/)).toBeVisible();
  await page.getByLabel("Gdzie Msza Święta – tak jak w zdaniu").fill("w kościele pw. św. Anny w Łodzi");
  await page.getByLabel("Miejsce pochówku – tak jak w zdaniu").fill("na cmentarzu parafialnym przy ul. Ogrodowej w Łodzi");
  await page.getByLabel("Podpis").fill("Żona, dzieci i wnuki");
  await expect(card.getByText(/w kościele pw\. św\. Anny w Łodzi, po czym nastąpi odprowadzenie do grobu na cmentarzu parafialnym/)).toBeVisible();

  // Świecka: bez krzyża, „Ś.P.” i Mszy.
  await page.getByLabel(/^Świecka/).check();
  await expect(card.getByText("Ś.P.", { exact: true })).toHaveCount(0);
  await expect(card.getByText(/^Uroczystość pożegnania odbędzie się/)).toBeVisible();
  await expect(card.getByText(/w wieku \d+ lat/)).toBeVisible();
  await page.getByLabel(/^Religijna/).check();
  await page.getByLabel("Gdzie Msza Święta – tak jak w zdaniu").fill("w kościele pw. św. Anny w Łodzi");

  await page.getByRole("button", { name: "Zapisz klepsydrę" }).click();
  await expect(page.getByText("Zapisano klepsydrę.")).toBeVisible();
  await expect(card.getByText("Żona, dzieci i wnuki")).toBeVisible();
  await shot(page, "32-klepsydra-edytor");
  if (test.info().project.name === "komputer") {
    // Wydruk: dokładnie jedna strona A4, sama klepsydra.
    const pdf = (await page.pdf({ format: "A4", printBackground: true })).toString("latin1");
    expect(pdf.match(/\/Type\s*\/Page(?!s)/g)?.length).toBe(1);
  }

  // Publikacja wymaga zgody rodziny.
  await page.getByLabel("Rodzina zgodziła się na publikację klepsydry w internecie.").check();
  await page.getByRole("button", { name: "Opublikuj klepsydrę" }).click();
  await expect(page.getByText("Klepsydra jest w sieci.", { exact: false })).toBeVisible();
  const url = await page.locator('a[href*="/klepsydra/jan-kowalski-"]').first().getAttribute("href");
  expect(url).toMatch(/\/klepsydra\/jan-kowalski-[a-z0-9]{6}$/);
  const share = page.getByRole("list", { name: "Udostępnij klepsydrę" });
  await expect(share.getByRole("link", { name: "Facebook" })).toHaveAttribute("href", `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url!)}`);
  await expect(share.getByRole("link", { name: "WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/\?text=Z%20%C5%BCalem%20zawiadamiamy/);
  await expect(share.getByRole("link", { name: "SMS" })).toHaveAttribute("href", /^sms:\?&body=/);
  await expect(share.getByRole("link", { name: "E-mail" })).toHaveAttribute("href", /^mailto:\?subject=Klepsydra%20%E2%80%93%20Jan%20Kowalski/);

  // Klepsydra w sieci – bez logowania i bez danych rodziny.
  const ctx = await browser.newContext();
  const guest = await ctx.newPage();
  const path = new URL(url!).pathname;
  await guest.goto(path);
  await expect(guest.getByRole("heading", { level: 1, name: "Jan Kowalski" })).toBeVisible();
  await expect(guest.getByRole("article").getByText("Ś.P.", { exact: true })).toBeVisible();
  await expect(guest.getByText("Joanna")).toHaveCount(0);
  await expect(guest.getByText("500 100 202")).toHaveCount(0);
  await expect(guest.getByRole("list", { name: "Udostępnij klepsydrę" }).getByRole("link", { name: "WhatsApp" })).toBeVisible();
  const og = await guest.locator('meta[property="og:image"]').getAttribute("content");
  expect(og).toContain(`${path}/opengraph-image`);
  const img = await guest.request.get(new URL(og!).pathname + new URL(og!).search);
  expect(img.status()).toBe(200);
  expect(img.headers()["content-type"]).toContain("image/png");
  if (test.info().project.name === "komputer") {
    const fs = await import("node:fs/promises");
    await fs.writeFile("docs/zrzuty/komputer-34-klepsydra-podglad-linku.png", await img.body());
  }
  await shot(guest, "33-klepsydra-online");

  // Rodzina widzi klepsydrę na swojej stronie.
  await guest.goto(FAMILY);
  await expect(guest.getByRole("link", { name: "Zobacz klepsydrę" })).toHaveAttribute("href", path);

  // Wycofanie z sieci.
  await page.getByRole("button", { name: "Wycofaj z sieci" }).click();
  await expect(page.getByText("Klepsydra wycofana z sieci.")).toBeVisible();
  const gone = await guest.goto(path);
  expect(gone?.status()).toBe(404);
  await ctx.close();
});

test("ekipa widzi klepsydrę do druku, ale jej nie zmienia", async ({ page }) => {
  await page.goto("/logowanie");
  await page.getByRole("button", { name: /Adam Sowiński/ }).click();
  await page.waitForURL(/\/panel/);
  await page.goto(`${ORDER}/klepsydra`);
  await expect(page.getByText("Klepsydrę zmienia właściciel albo biuro. Możesz ją wydrukować.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Zapisz klepsydrę" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Drukuj klepsydrę (A4)" })).toBeVisible();
});

test("najdłuższa dopuszczalna treść mieści się na stronie A4", async ({ page }) => {
  await page.goto("/logowanie");
  await page.getByRole("button", { name: /Anna Cichońska/ }).click();
  await page.waitForURL(/\/panel/);
  await page.goto(`${ORDER}/klepsydra`);
  await page.waitForLoadState("networkidle");
  const long = (n: number) => "Długie zdanie o zmarłym i rodzinie, które sprawdza zawijanie. ".repeat(10).slice(0, n);
  await page.getByLabel("Nazwisko rodowe (nieobowiązkowe)").fill("Wiśniewska-Zawadzka-Kowalczyk");
  await page.getByLabel("Kilka słów o zmarłym (nieobowiązkowe)").fill(long(200));
  await page.getByLabel("Gdzie Msza Święta – tak jak w zdaniu").fill(long(160));
  await page.getByLabel("Miejsce pochówku – tak jak w zdaniu").fill(long(160));
  await page.getByLabel("Różaniec lub czuwanie (nieobowiązkowe)").fill(long(300));
  await page.getByLabel("Prośba rodziny (nieobowiązkowe)").fill(long(300));
  await page.getByLabel("Podpis").fill(long(200));
  const overflow = await page.getByRole("article", { name: /Klepsydra:/ }).evaluate((el) => {
    const frame = el.firstElementChild as HTMLElement;
    return frame.scrollHeight - frame.clientHeight;
  });
  expect(overflow).toBeLessThanOrEqual(1);
  await shot(page, "35-klepsydra-dluga-tresc");
});
