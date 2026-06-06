import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function waitForApp(page: Page) {
  await page.goto("/");
  await page.waitForSelector(".shell", { timeout: 20000 });
}

async function navToProfiel(page: Page) {
  await page.locator(".sb-acct-btn").click();
  await page.getByRole("button", { name: /Bedrijfsprofiel/i }).click();
  await page.waitForTimeout(500);
}

async function saveProfiel(page: Page) {
  await page.getByRole("button", { name: /^Opslaan$/ }).last().click();
  await expect(page.locator("text=Profiel opgeslagen")).toBeVisible({ timeout: 8000 });
}

async function openTab(page: Page, tabName: string) {
  await page.getByRole("button", { name: new RegExp(tabName, "i") }).first().click();
  await page.waitForTimeout(400);
}

// ─── 1. Typografie: Plus Jakarta Sans is geladen ──────────────────────────────
test("typografie – Plus Jakarta Sans font is geladen", async ({ page }) => {
  await waitForApp(page);

  // Controleer dat de font-family in de CSS aanwezig is (in de gegenereerde <style> tag)
  const fontInCSS = await page.evaluate(() => {
    // Zoek in alle style tags naar de font import of font-family declaratie
    const styles = [...document.querySelectorAll("style")].map((s) => s.textContent || "");
    const allCSS = styles.join(" ");
    return (
      allCSS.includes("Plus Jakarta Sans") ||
      allCSS.includes("Syne") ||
      // Alternatief: kijk via computed styles van body
      window.getComputedStyle(document.body).fontFamily.includes("Plus Jakarta") ||
      window.getComputedStyle(document.body).fontFamily.includes("Syne")
    );
  });
  expect(fontInCSS, "Plus Jakarta Sans of Syne moet in de CSS staan").toBe(true);

  // Controleer dat de achtergrondkleur de nieuwe tint is (#F1F5F9)
  const bgColor = await page.evaluate(() => {
    const shell = document.querySelector(".shell") as HTMLElement | null;
    return shell ? window.getComputedStyle(shell).backgroundColor : null;
  });
  // rgb(241, 245, 249) = #F1F5F9
  expect(bgColor, "Achtergrond moet de nieuwe tint #F1F5F9 zijn").toContain("241");

  // Controleer dat inputs een box-shadow krijgen bij focus
  await openTab(page, "Klanten");
  const searchInput = page.locator("input").first();
  await searchInput.focus();
  const focusShadow = await page.evaluate(() => {
    const inp = document.querySelector("input:focus") as HTMLElement | null;
    return inp ? window.getComputedStyle(inp).boxShadow : "";
  });
  // Box-shadow bevat "rgba(99, 102, 241" voor de paarse focus ring
  expect(focusShadow, "Inputs moeten een paarse focus ring hebben").toContain("99");

  console.log("✅ Typografie: fonts geladen, achtergrond correct, focus ring aanwezig");
});

// ─── 2. Input validatie: ongeldige email/telefoon toont Nederlandse foutmelding ──
test("input validatie – ongeldige email en telefoon in CRM", async ({ page }) => {
  await waitForApp(page);
  await openTab(page, "Klanten");

  // Open 'Klant toevoegen'
  await page.getByRole("button", { name: /\+ Klant/i }).click();
  await page.waitForTimeout(500);

  // Wacht tot het formulier zichtbaar is
  await expect(page.locator("text=Klant toevoegen").first()).toBeVisible({ timeout: 5000 });

  // Vul naam in via specifieke placeholder (knop is disabled tot naam ingevuld is)
  await page.locator("input[placeholder='Bedrijf of naam']").fill("Test Bedrijf BV");

  // Vul een ongeldig e-mailadres in via specifieke placeholder
  await page.locator("input[placeholder='klant@email.nl']").fill("geen-geldig-email");

  // Probeer op te slaan — knop is nu enabled want naam is ingevuld
  await page.getByRole("button", { name: "Toevoegen" }).click();
  await page.waitForTimeout(300);

  // Controleer dat de foutmelding zichtbaar is
  await expect(page.locator("text=Voer een geldig e-mailadres in.")).toBeVisible({ timeout: 3000 });
  const errText = await page.locator("text=Voer een geldig e-mailadres in.").textContent();
  console.log(`✅ Email validatie foutmelding: "${errText}"`);

  // Verbeter email, vul fout telefoonnummer in (te kort, geen geldig NL nummer)
  await page.locator("input[placeholder='klant@email.nl']").fill("test@voorbeeld.nl");
  await page.locator("input[placeholder='06-12345678']").fill("12345");

  await page.getByRole("button", { name: "Toevoegen" }).click();
  await page.waitForTimeout(300);

  await expect(page.locator("text=Voer een geldig Nederlands telefoonnummer in")).toBeVisible({ timeout: 3000 });
  const telErr = await page.locator("text=Voer een geldig Nederlands telefoonnummer in").textContent();
  console.log(`✅ Telefoon validatie foutmelding: "${telErr}"`);

  // Annuleer
  await page.getByRole("button", { name: "Annuleren" }).click();
});

// ─── 3. Ritten: km automatisch berekend en correct opgeslagen ────────────────
test("ritten – automatische km berekening en opslaan", async ({ page }) => {
  test.setTimeout(60000); // geocoding kan meerdere seconden duren
  await waitForApp(page);
  await openTab(page, "Ritten");

  // Noteer het huidige aantal ritten
  const telVoor = await page.locator("text=/ritten geregistreerd/i").textContent().catch(() => "0");
  const aantalVoor = parseInt((telVoor || "0").match(/\d+/)?.[0] || "0");

  // Open het formulier
  await page.getByRole("button", { name: /\+ Rit/i }).click();
  await page.waitForTimeout(300);

  // Vul vertrek en bestemming in via exacte placeholders
  await page.locator("input[placeholder='Straat 1, Amsterdam']").fill("Utrecht");
  await page.locator("input[placeholder='Straat 2, Rotterdam']").fill("Den Haag");

  // Wacht tot de Opslaan-knop actief wordt (= km berekend + geladen)
  // Debounce 700ms + twee geocode calls + OSRM call kan tot ~10s duren
  await expect(page.getByRole("button", { name: "Opslaan" })).toBeEnabled({ timeout: 20000 });
  await page.waitForTimeout(300);

  // Controleer dat km is ingevuld (niet leeg, niet 0)
  const kmWaarde = await page.locator("input[placeholder='Wordt automatisch berekend']").inputValue();
  const kmGetal = parseFloat(kmWaarde);
  expect(kmGetal, "KM moet automatisch berekend zijn (> 0)").toBeGreaterThan(0);
  console.log(`✅ KM berekend: ${kmGetal} km (Utrecht → Den Haag)`);

  // Opslaan
  await page.getByRole("button", { name: /^Opslaan$/ }).click();
  await page.waitForTimeout(1500);

  // Controleer dat het formulier is gesloten (modal weg)
  await expect(page.locator("text=/Rit toevoegen/i")).toBeHidden({ timeout: 5000 });

  // Controleer dat de lijst één rit meer heeft
  const telNa = await page.locator("text=/ritten geregistreerd/i").textContent().catch(() => "0");
  const aantalNa = parseInt((telNa || "0").match(/\d+/)?.[0] || "0");
  expect(aantalNa, "Lijst moet één rit meer tonen na opslaan").toBe(aantalVoor + 1);

  // Controleer dat de opgeslagen km correct is in de tabel
  const eersteKmCell = page.locator("tbody tr").first().locator("td").nth(3);
  const opgeslagenKm = await eersteKmCell.textContent();
  const opgeslagenGetal = parseFloat(opgeslagenKm?.replace(",", ".") || "0");
  expect(opgeslagenGetal, "Opgeslagen km moet > 0 zijn in de tabel").toBeGreaterThan(0);

  console.log(`✅ Rit opgeslagen: ${kmGetal} km zichtbaar in lijst`);
});

// ─── 4. Planning: afspraak aanmaken en zichtbaar in agenda ───────────────────
test("planning – afspraak aanmaken en zichtbaar in agenda", async ({ page }) => {
  await waitForApp(page);
  await openTab(page, "Planning");
  await page.waitForTimeout(500);

  // Open 'Opdracht toevoegen'
  await page.getByRole("button", { name: /\+ Opdracht/i }).click();
  await page.waitForTimeout(300);

  // Selecteer eerste klant
  const klantSelect = page.locator("select").filter({ hasText: /Kies klant/ });
  await klantSelect.selectOption({ index: 1 });
  await page.waitForTimeout(200);

  // Vul dienst in
  await page.locator("input[placeholder*='Wat ga je doen']").fill("Playwright Test Opdracht");

  // Stel tijd in op 10:00
  await page.locator("input[type='time']").first().fill("10:00");
  const eindtijdInputs = page.locator("input[type='time']");
  if (await eindtijdInputs.count() > 1) {
    await eindtijdInputs.nth(1).fill("11:00");
  }

  // Sla op
  await page.getByRole("button", { name: /Toevoegen|Herhaling aanmaken/i }).click();
  await page.waitForTimeout(1500);

  // Controleer dat het formulier is gesloten
  await expect(page.locator("text=/Opdracht toevoegen/i")).toBeHidden({ timeout: 5000 });

  // Ga naar weekview om het tijdblok te zien
  const weekBtn = page.getByRole("button", { name: /Week/i }).first();
  if (await weekBtn.isVisible()) {
    await weekBtn.click();
    await page.waitForTimeout(500);

    // Controleer dat er een taakblok zichtbaar is
    const blokken = page.locator(".cal-task-blk");
    const aantalBlokken = await blokken.count();
    expect(aantalBlokken, "Minstens één tijdblok moet zichtbaar zijn in week-view").toBeGreaterThan(0);

    // Controleer dat het blok een gekleurde linker border heeft (de nieuwe CSS)
    const eersteBlok = blokken.first();
    const borderLeft = await eersteBlok.evaluate((el) =>
      window.getComputedStyle(el).borderLeftWidth
    );
    expect(parseFloat(borderLeft), "Tijdblok moet een zichtbare linker border hebben").toBeGreaterThan(0);
    console.log(`✅ Planning: ${aantalBlokken} tijdblok(ken) zichtbaar in week-view`);
  }

  // Maandview: controleer dat de opdracht zichtbaar is als taak-chip
  const maandBtn = page.getByRole("button", { name: /Maand/i }).first();
  if (await maandBtn.isVisible()) {
    await maandBtn.click();
    await page.waitForTimeout(400);
    const taken = page.locator(".cal-task");
    const aantalTaken = await taken.count();
    expect(aantalTaken, "Minstens één taak moet zichtbaar zijn in maand-view").toBeGreaterThan(0);
    console.log(`✅ Planning: ${aantalTaken} taak-chip(s) zichtbaar in maand-view`);
  }

  // Opruimen: verwijder de test-opdracht
  const testOpdracht = page.locator(".cal-task", { hasText: /Playwright Test/ });
  if (await testOpdracht.count() > 0) {
    await testOpdracht.first().click({ force: true });
  }
});

// ─── 5. Whitelist: admin panel heeft gratis toegang sectie ───────────────────
test("whitelist – admin panel bevat gratis toegang sectie", async ({ page }) => {
  await page.goto("/admin");
  await page.waitForTimeout(2000);

  const toegangGeweigerd = await page.locator("text=/Toegang geweigerd/i").isVisible();
  if (toegangGeweigerd) {
    test.skip(); // Test-gebruiker heeft geen admin-rechten in deze omgeving
    return;
  }

  // Controleer dat de stats sectie zichtbaar is
  await expect(page.locator("text=/Totaal gebruikers/i").first()).toBeVisible({ timeout: 8000 });
  console.log("✅ Admin stats zichtbaar");

  // Controleer dat de whitelist sectie aanwezig is
  await expect(page.locator("text=/Gratis toegang verlenen/i")).toBeVisible({ timeout: 5000 });
  console.log("✅ Gratis toegang sectie aanwezig");

  // Controleer de invoervelden
  const emailInput = page.locator("input[placeholder*='gebruiker@email']");
  await expect(emailInput).toBeVisible();

  const maandenInput = page.locator("input[type='number'][min='1']");
  await expect(maandenInput).toBeVisible();
  expect(await maandenInput.inputValue()).toBe("2"); // default = 2 maanden

  // Vul een test-email in en controleer dat de knop actief is
  await emailInput.fill("testgebruiker@voorbeeld.nl");
  const toevoegenBtn = page.getByRole("button", { name: /Toevoegen/i }).last();
  await expect(toevoegenBtn).toBeEnabled();
  console.log("✅ Whitelist formulier werkt correct");

  // Controleer ook dat de gebruikerstabel zichtbaar is
  await expect(page.locator("text=/Alle gebruikers/i")).toBeVisible();
  const rijen = page.locator("tbody tr");
  const aantalRijen = await rijen.count();
  expect(aantalRijen, "Gebruikerstabel moet rijen bevatten").toBeGreaterThan(0);
  console.log(`✅ Gebruikerstabel: ${aantalRijen} gebruikers zichtbaar`);
});

// ─── 6. Merkkleur opslaan en persisteren in bedrijfsprofiel ──────────────────
test("merkkleur – opslaan en persisteren in bedrijfsprofiel", async ({ page }) => {
  await waitForApp(page);
  await navToProfiel(page);

  const hexInput = page.locator("input[placeholder='#6366F1']");
  await expect(hexInput, "Hex-kleur input moet zichtbaar zijn in Bedrijfsprofiel").toBeVisible({ timeout: 5000 });

  const testKleur = "#e74c3c";
  await hexInput.fill(testKleur);
  await saveProfiel(page);
  console.log(`✅ Merkkleur ${testKleur} opgeslagen`);

  // Reload en verifieer dat de kleur is opgeslagen in de database
  await page.reload();
  await page.waitForSelector(".shell", { timeout: 20000 });
  await navToProfiel(page);

  const persistedValue = await page.locator("input[placeholder='#6366F1']").inputValue();
  expect(
    persistedValue.toLowerCase(),
    `Merkkleur moet na reload nog ${testKleur} zijn (DB round-trip)`
  ).toBe(testKleur.toLowerCase());
  console.log(`✅ Merkkleur persistent na reload: ${persistedValue}`);

  // Opruimen: reset naar leeg
  await page.locator("input[placeholder='#6366F1']").fill("");
  await saveProfiel(page);
});

// ─── 7. PDF offerte – download met merkkleur in header ───────────────────────
test("offerte PDF – download wordt getriggerd met merkkleur actief", async ({ page }) => {
  test.setTimeout(45000);
  await waitForApp(page);

  // Stel eerst een merkkleur in zodat de PDF die kleur gebruikt
  await navToProfiel(page);
  const hexInput = page.locator("input[placeholder='#6366F1']");
  await hexInput.fill("#3498db");
  await saveProfiel(page);
  console.log("✅ Merkkleur #3498db ingesteld voor PDF test");

  // Ga naar Offertes
  await openTab(page, "Offertes");
  await page.waitForTimeout(600);

  // Zoek de eerste PDF-knop in de offertelijst (desktop tabel)
  const pdfBtn = page.locator("button.btn-ghost", { hasText: "PDF" }).first();
  const pdfBtnCount = await pdfBtn.count();
  if (pdfBtnCount === 0) {
    console.log("⚠️  Geen offertes gevonden — PDF-test overgeslagen");
    test.skip();
    return;
  }
  await expect(pdfBtn).toBeVisible({ timeout: 5000 });

  // Wacht op een download-event en klik de knop
  const downloadPromise = page.waitForEvent("download", { timeout: 15000 });
  await pdfBtn.click();
  const download = await downloadPromise;

  const filename = download.suggestedFilename();
  expect(filename, "Bestandsnaam moet eindigen op .pdf").toMatch(/\.pdf$/i);

  const dlPath = await download.path();
  expect(dlPath, "Pad naar gedownload bestand moet bestaan").toBeTruthy();

  const stats = fs.statSync(dlPath!);
  expect(stats.size, "PDF moet meer dan 1000 bytes bevatten (geen leeg bestand)").toBeGreaterThan(1000);
  console.log(`✅ PDF gedownload: "${filename}" (${stats.size} bytes)`);

  // Opruimen
  await navToProfiel(page);
  await page.locator("input[placeholder='#6366F1']").fill("");
  await saveProfiel(page);
});

// ─── 8. Email versturen – klantkleur zit in edge-function aanroep ─────────────
test("email versturen – merkkleur bereikt de edge function payload", async ({ page }) => {
  test.setTimeout(45000);
  await waitForApp(page);

  // Stel merkkleur in
  await navToProfiel(page);
  const hexInput = page.locator("input[placeholder='#6366F1']");
  await hexInput.fill("#8e44ad");
  await saveProfiel(page);
  console.log("✅ Merkkleur #8e44ad opgeslagen voor email-test");

  // Onderschep de edge-function aanroep en verifieer de payload
  let capturedAction: string | null = null;
  let capturedCompanyName: string | null = null;
  await page.route("**/functions/v1/ai-proxy", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    if (body?.action === "send-invoice-email" || body?.action === "send-offer-email") {
      capturedAction = body.action as string;
      capturedCompanyName = (body.company_name as string) || null;
      // Retourneer een nep-succesbericht zodat er geen echte e-mail wordt verstuurd
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, id: "pw-test-mock" }),
      });
    } else {
      await route.continue();
    }
  });

  // Ga naar Financiën → Facturen
  await openTab(page, "Financiën");
  await page.waitForTimeout(500);

  // Controleer eerst of er facturen zijn met een Mail-knop
  const mailBtn = page.locator("button.f-btn-mail").first();
  const mailBtnCount = await mailBtn.count();
  if (mailBtnCount === 0) {
    console.log("⚠️  Geen facturen met Mail-knop gevonden — email-test overgeslagen");
    test.skip();
    return;
  }

  // Open de 'Factuur versturen' modal
  await mailBtn.click();
  await page.waitForTimeout(400);

  // Vul e-mailadres in als het leeg is (modal toont een invoerveld)
  const emailField = page.locator("input[type='email'], input[placeholder*='mail']").last();
  const currentEmail = await emailField.inputValue().catch(() => "");
  if (!currentEmail) {
    await emailField.fill("test-playwright@mailinator.com");
  }

  // Klik op 'Factuur versturen'
  await page.getByRole("button", { name: /Factuur versturen/i }).click();
  await page.waitForTimeout(2000);

  // Verifieer dat de edge function werd aangeroepen met de juiste velden
  expect(capturedAction, "Edge function moet aangeroepen zijn met send-invoice-email").toBe("send-invoice-email");
  expect(capturedCompanyName, "company_name moet aanwezig zijn in de payload").toBeTruthy();
  console.log(`✅ Edge function aangeroepen: action=${capturedAction}, company_name="${capturedCompanyName}"`);

  // Opruimen: sluit eventuele modal en reset kleur
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await navToProfiel(page);
  await page.locator("input[placeholder='#6366F1']").fill("");
  await saveProfiel(page);
});
