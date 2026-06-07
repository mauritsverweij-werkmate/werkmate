/**
 * WerkMate – volledige end-to-end flow
 *
 * Gebruik de bestaande auth sessie uit .env.test / e2e/.auth/session.json
 * Elke test is onafhankelijk en begint met een verse paginanavigatie.
 */

import { test, expect, Page } from "@playwright/test";
import * as fs from "fs";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function waitForApp(page: Page) {
  await page.goto("/");
  await page.waitForSelector(".shell", { timeout: 20000 });
}

async function navToProfiel(page: Page) {
  const acctBtn = page.locator(".sb-acct-btn");
  if (await acctBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    // Desktop: sidebar account-dropdown
    await acctBtn.click();
    await page.getByRole("button", { name: /Bedrijfsprofiel/i }).click();
  } else {
    // Mobiel: Meer-panel → Bedrijfsprofiel
    await page.locator("nav.mob-nav button.mob-nb", { hasText: /Meer/ }).click();
    await page.waitForTimeout(300);
    await page.locator("button", { hasText: /Bedrijfsprofiel/ }).last().click();
  }
  await page.waitForTimeout(500);
}

async function saveProfiel(page: Page) {
  await page.getByRole("button", { name: /^Opslaan$/ }).last().click();
  await expect(page.locator("text=Profiel opgeslagen")).toBeVisible({ timeout: 8000 });
}

/**
 * Navigeert naar een tab. Werkt op zowel desktop (sidebar .nb) als mobiel
 * (bottom nav .mob-nb, of "Meer"-panel voor overflow-tabs zoals Werkbonnen).
 */
async function openTab(page: Page, tabName: string) {
  const vp = page.viewportSize();
  const isMobile = vp ? vp.width < 700 : false;

  if (!isMobile) {
    await page.locator("button.nb", { hasText: new RegExp(tabName, "i") }).first().click();
    await page.waitForTimeout(500);
    return;
  }

  // Mobiel: probeer direct in de bottom nav (MOB_PRIMARY tabs)
  const mobNavBtn = page.locator("nav.mob-nav button.mob-nb", { hasText: new RegExp(tabName, "i") });
  if (await mobNavBtn.count() > 0) {
    await mobNavBtn.first().click();
    await page.waitForTimeout(500);
    return;
  }

  // Mobiel: tab zit in "Meer" overflow (Werkbonnen, Team, Mail) → klik "Meer" eerst
  await page.locator("nav.mob-nav button.mob-nb", { hasText: /Meer/ }).click();
  await page.waitForTimeout(300);
  // Meer-panel buttons staan als laatste in de DOM, .last() pakt de zichtbare panelknop
  await page.locator("button", { hasText: new RegExp(tabName, "i") }).last().click();
  await page.waitForTimeout(500);
}

/** Teken een eenvoudige lijn op het eerste canvas-element */
async function drawSignature(page: Page) {
  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 5000 });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Canvas niet gevonden");
  await page.mouse.move(box.x + 60, box.y + 70);
  await page.mouse.down();
  for (let i = 0; i <= 140; i += 10) {
    await page.mouse.move(box.x + 60 + i, box.y + 70 + Math.sin(i / 20) * 18);
    await page.waitForTimeout(10);
  }
  await page.mouse.up();
  await page.waitForTimeout(200);
}

// ─── 1. Registreren: overgeslagen ─────────────────────────────────────────────
// Registreren vereist e-mailbevestiging via Supabase — niet automatiseerbaar in CI.
test.skip("1. registreren – bevestigingsbericht na account aanmaken", () => {
  // Geen implementatie
});

// ─── 2. Bedrijfsprofiel invullen + merkkleur instellen ────────────────────────
test("2. bedrijfsprofiel – invullen en merkkleur persistent na reload", async ({ page }) => {
  test.setTimeout(40000);
  await waitForApp(page);
  await navToProfiel(page);

  const websiteInput = page.locator("input[placeholder='https://jouwbedrijf.nl']");
  await websiteInput.fill("https://playwright-test.nl");

  const kleurInput = page.locator("input[placeholder='#6366F1']");
  await kleurInput.fill("#27ae60");

  await saveProfiel(page);
  console.log("✅ Profiel opgeslagen met kleur #27ae60");

  await page.reload();
  await page.waitForSelector(".shell", { timeout: 20000 });
  await navToProfiel(page);

  const savedKleur = await page.locator("input[placeholder='#6366F1']").inputValue();
  expect(savedKleur.toLowerCase()).toBe("#27ae60");
  console.log(`✅ Merkkleur persistent: ${savedKleur}`);

  // Opruimen
  await page.locator("input[placeholder='#6366F1']").fill("");
  await saveProfiel(page);
});

// ─── 3. Klant aanmaken ────────────────────────────────────────────────────────
test("3. klant aanmaken – verschijnt in CRM lijst", async ({ page }) => {
  test.setTimeout(45000);
  await waitForApp(page);
  await openTab(page, "Klanten");

  // Gebruik .ph (page header) scope: enige btn-dark knop in de Klanten header
  await page.locator(".ph button.btn-dark").click();
  await page.waitForTimeout(400);
  await expect(page.locator(".mt", { hasText: "Klant toevoegen" })).toBeVisible({ timeout: 5000 });

  const klantNaam = `PW Testklant ${Date.now()}`;
  await page.locator("input[placeholder='Bedrijf of naam']").fill(klantNaam);
  await page.locator("input[placeholder='klant@email.nl']").fill("pw-klant@mailinator.com");
  await page.locator("input[placeholder='06-12345678']").fill("06-87654321");

  // Knop heeft een SVG-icon + "Toevoegen" — scope naar de overlay voor zekerheid
  await page.locator(".overlay").locator("button.btn-dark").last().click();
  await page.waitForTimeout(1500);

  // Modal moet gesloten zijn
  await expect(page.locator(".overlay")).toBeHidden({ timeout: 6000 });

  // Klant verschijnt in de lijst (.pc op desktop, .mob-card op mobiel)
  await expect(page.locator(".pc,.mob-card", { hasText: klantNaam })).toBeVisible({ timeout: 8000 });
  console.log(`✅ Klant aangemaakt: "${klantNaam}" zichtbaar in CRM`);
});

// ─── 4. AI offerte genereren + PDF downloaden ─────────────────────────────────
test("4. AI offerte – genereren en PDF downloaden", async ({ page }) => {
  test.setTimeout(120000);
  await waitForApp(page);
  await openTab(page, "Offertes");

  await page.getByRole("button", { name: /Slimme offerte/i }).click();
  await page.waitForTimeout(500);

  // Klant is optioneel — laat leeg om e-mail te vermijden
  await page.locator("textarea[placeholder*='CV ketel']").fill(
    "Loodgieter: vervangen kraan badkamer, 2 uur arbeid + materialen"
  );

  await page.getByRole("button", { name: /Maak offerte/i }).click();
  console.log("⏳ Wachten op AI offerte generatie…");

  // Step 2: "Opslaan & Verstuur" knop verschijnt als AI klaar is
  await expect(
    page.getByRole("button", { name: /Opslaan.*Verstuur/i })
  ).toBeVisible({ timeout: 90000 });
  console.log("✅ AI offerte gegenereerd");

  await page.getByRole("button", { name: /Opslaan.*Verstuur/i }).click();
  await page.waitForTimeout(3000);

  // Sluit eventuele open modal
  const closeBtn = page.locator(".overlay .mc").first();
  if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  }

  // Download PDF van eerste offerte
  const pdfBtn = page.locator("button.btn-ghost", { hasText: "PDF" }).first();
  if ((await pdfBtn.count()) === 0) {
    console.log("⚠️  Geen PDF-knop — test overgeslagen");
    test.skip();
    return;
  }

  const dlPromise = page.waitForEvent("download", { timeout: 15000 });
  await pdfBtn.click();
  const dl = await dlPromise;

  expect(dl.suggestedFilename()).toMatch(/\.pdf$/i);
  const dlPath = await dl.path();
  expect(fs.statSync(dlPath!).size).toBeGreaterThan(1000);
  console.log(`✅ PDF gedownload: "${dl.suggestedFilename()}" (${fs.statSync(dlPath!).size} bytes)`);
});

// ─── 5. Offerte mailen (intercepteer edge function) ───────────────────────────
test("5. offerte mailen – edge function payload gecontroleerd", async ({ page }) => {
  test.setTimeout(30000);
  await waitForApp(page);
  await openTab(page, "Offertes");
  await page.waitForTimeout(800);

  let capturedAction: string | null = null;
  await page.route("**/functions/v1/ai-proxy", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    if (body?.action === "send-offer-email") {
      capturedAction = body.action as string;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, id: "pw-mock" }),
      });
    } else {
      await route.continue();
    }
  });

  // Accepteer alert-dialogen ("Verstuurd naar …" of "Geen e-mailadres")
  page.on("dialog", (d) => d.accept());

  // "Mail"-knop in offertes tabel: class "btn-blue btn-sm" met Mail tekst
  const mailBtn = page.locator("button.btn-blue.btn-sm", { hasText: /Mail/ }).first();
  if ((await mailBtn.count()) === 0) {
    console.log("⚠️  Geen Mail-knop in offertelijst — test overgeslagen");
    test.skip();
    return;
  }

  await mailBtn.click();
  await page.waitForTimeout(2500);

  if (!capturedAction) {
    console.log("⚠️  Klant heeft geen e-mailadres — edge function niet aangeroepen");
    test.skip();
    return;
  }

  expect(capturedAction).toBe("send-offer-email");
  console.log("✅ Offerte mail: edge function action=send-offer-email ontvangen");
});

// ─── 6. Offerte ondertekenen via klantportaal ─────────────────────────────────
test("6. klantportaal – offerte ondertekenen", async ({ page }) => {
  test.setTimeout(40000);

  // Stel route intercept in VÓÓR de navigatie, zodat de Supabase REST call wordt gevangen
  let portalToken: string | null = null;
  await page.route("**supabase.co/rest/v1/offertes**", async (route) => {
    const response = await route.fetch();
    try {
      const json = await response.json();
      const items: Record<string, unknown>[] = Array.isArray(json) ? json : [json];
      // Kies een offerte die nog niet ondertekend is
      const found = items.find(
        (o) => o.portal_token &&
          o.status !== "Ondertekend" &&
          o.status !== "Geaccepteerd" &&
          o.status !== "Afgewezen"
      );
      if (found && !portalToken) portalToken = found.portal_token as string;
    } catch { /* negeer json parse fouten */ }
    await route.fulfill({ response });
  });

  await waitForApp(page);
  await openTab(page, "Offertes");
  await page.waitForTimeout(2000);

  if (!portalToken) {
    console.log("⚠️  Geen geschikte offerte met portal_token — test overgeslagen");
    test.skip();
    return;
  }

  // Mock de portal-sign call zodat geen echte DB-wijziging plaatsvindt
  await page.route("**/functions/v1/ai-proxy", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    if (body?.action === "portal-sign") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });

  // Navigeer naar het klantportaal
  await page.goto(`/portal/${portalToken}`);
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // Vul e-mailadres in
  const emailInput = page.locator("input[placeholder='uw@email.nl']");
  await expect(emailInput).toBeVisible({ timeout: 10000 });
  await emailInput.fill("playwright@mailinator.com");

  // Ga naar tekenstap
  await page.locator("button", { hasText: "Offerte ondertekenen" }).click();
  await page.waitForTimeout(600);

  // Teken handtekening op canvas
  await drawSignature(page);

  // Klikt "Handtekening plaatsen" (save-knop in SignatureCanvas)
  await page.locator("button", { hasText: /Handtekening plaatsen/ }).click();
  await page.waitForTimeout(2500);

  // Bevestigingsscherm
  await expect(page.locator("text=Offerte geaccepteerd")).toBeVisible({ timeout: 10000 });
  console.log(`✅ Klantportaal: offerte ${portalToken.slice(0, 8)}… ondertekend`);
});

// ─── 7. Factuur aanmaken + mailen ─────────────────────────────────────────────
test("7. factuur aanmaken en mailen", async ({ page }) => {
  test.setTimeout(40000);
  await waitForApp(page);
  await openTab(page, "Financi");  // matcht "Financiën"
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: /Nieuwe factuur/i }).click();
  await page.waitForTimeout(600);

  // Klant selecteren binnen de factuur-modal
  const modal = page.locator(".overlay");
  const klantSelect = modal.locator("select").first();
  const opties = await klantSelect.locator("option").count();
  if (opties <= 1) {
    console.log("⚠️  Geen klanten beschikbaar voor factuur — test overgeslagen");
    await page.keyboard.press("Escape");
    test.skip();
    return;
  }
  await klantSelect.selectOption({ index: 1 });
  await page.waitForTimeout(600);  // wacht op React state update

  // Vul eerste regelomschrijving in
  const regelInput = modal.locator("textarea.off-inp").first();
  if ((await regelInput.count()) > 0) {
    await regelInput.fill("Playwright testdienst");
  }

  // Vul prijs in
  const prijsInput = modal.locator("input.off-inp[type='number']").last();
  if ((await prijsInput.count()) > 0) {
    await prijsInput.fill("150");
  }

  // Klik "Factuur aanmaken"
  await modal.locator("button.btn-dark").last().click();
  await page.waitForTimeout(2000);

  // Modal moet gesloten zijn — check op de overlay zelf (niet op de knoptekst)
  await expect(page.locator(".overlay")).toBeHidden({ timeout: 8000 });
  console.log("✅ Factuur aangemaakt");

  // Mail de factuur — intercepteer edge function
  let invoiceAction: string | null = null;
  await page.route("**/functions/v1/ai-proxy", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    if (body?.action === "send-invoice-email") {
      invoiceAction = body.action as string;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });

  const mailBtn = page.locator("button.f-btn-mail").first();
  if ((await mailBtn.count()) === 0) {
    console.log("⚠️  Geen f-btn-mail gevonden — mail stap overgeslagen");
    return;
  }
  await mailBtn.click();
  await page.waitForTimeout(600);

  const emailField = page.locator(".overlay input[type='email']");
  if ((await emailField.count()) > 0) {
    const current = await emailField.inputValue().catch(() => "");
    if (!current) await emailField.fill("factuur@mailinator.com");
  }

  await page.locator(".overlay").getByRole("button", { name: /Factuur versturen/i }).click();
  await page.waitForTimeout(2000);

  expect(invoiceAction).toBe("send-invoice-email");
  console.log("✅ Factuur mail: edge function action=send-invoice-email ontvangen");
});

// ─── 8. Werkbon aanmaken + status op Afgerond ─────────────────────────────────
test("8. werkbon aanmaken en status naar Afgerond", async ({ page }) => {
  test.setTimeout(50000);
  await waitForApp(page);
  await openTab(page, "Werkbonnen");
  await page.waitForTimeout(500);

  // Gebruik .ph (page header) scope: enige btn-dark knop in de Werkbonnen header
  await page.locator(".ph button.btn-dark").click();
  await page.waitForTimeout(500);

  const addModal = page.locator(".overlay", { hasText: "Werkbon toevoegen" });
  await expect(addModal).toBeVisible({ timeout: 5000 });

  // Klant selecteren
  const klantSelect = addModal.locator("select").first();
  const opties = await klantSelect.locator("option").count();
  if (opties <= 1) {
    console.log("⚠️  Geen klanten voor werkbon — test overgeslagen");
    await page.keyboard.press("Escape");
    test.skip();
    return;
  }
  await klantSelect.selectOption({ index: 1 });
  await page.waitForTimeout(300);

  await page.locator("textarea[placeholder='Wat is er gedaan?']").fill("Playwright test werkzaamheden");

  // Opslaan knop in de modal (btn-primary)
  await addModal.locator("button.btn-primary").click();
  await page.waitForTimeout(1500);
  await expect(addModal).toBeHidden({ timeout: 6000 });
  console.log("✅ Werkbon aangemaakt (status: Nieuw)");

  // Bewerk eerste werkbon: zet status op Afgerond
  // Op mobiel toont de werkbonnenlijst als mob-card-list zonder Bewerken-knoppen
  const editBtn = page.locator("button.btn-outline.btn-sm", { hasText: /Bewerken/ }).first();
  const editBtnVisible = await editBtn.isVisible({ timeout: 3000 }).catch(() => false);
  if (!editBtnVisible) {
    console.log("⚠️  Bewerken knop niet gevonden (mobiele UI) — status-stap overgeslagen");
    return;
  }
  await editBtn.click();
  await page.waitForTimeout(500);

  const editModal = page.locator(".overlay", { hasText: "Werkbon bewerken" });
  await expect(editModal).toBeVisible({ timeout: 5000 });

  // Status select is de tweede .inp select in de edit modal
  const statusSelect = editModal.locator("select.inp").nth(1);
  await statusSelect.selectOption("Afgerond");
  await page.waitForTimeout(200);

  await editModal.locator("button.btn-primary").click();
  await page.waitForTimeout(1500);
  await expect(editModal).toBeHidden({ timeout: 6000 });

  // Afgerond badge zichtbaar in de tabel
  await expect(
    page.locator("td").filter({ hasText: "Afgerond" }).first()
  ).toBeVisible({ timeout: 5000 });
  console.log("✅ Werkbon status: Afgerond zichtbaar in tabel");
});

// ─── 9. Review verzoek (intercepteer edge function) ───────────────────────────
test("9. review verzoek – edge function send-review-request-email", async ({ page }) => {
  test.setTimeout(30000);
  await waitForApp(page);
  await openTab(page, "Werkbonnen");
  await page.waitForTimeout(800);

  // Knop alleen zichtbaar bij status Afgerond + klant met e-mail
  const reviewBtn = page.locator("button.btn-outline.btn-sm", { hasText: /Review verzoek/ }).first();
  if ((await reviewBtn.count()) === 0) {
    console.log("⚠️  Geen Afgerond werkbon met klant-email — test overgeslagen");
    test.skip();
    return;
  }

  let reviewAction: string | null = null;
  await page.route("**/functions/v1/ai-proxy", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    if (body?.action === "send-review-request-email") {
      reviewAction = body.action as string;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    } else {
      await route.continue();
    }
  });

  await reviewBtn.click();
  await page.waitForTimeout(500);

  // EmailConfirmModal: klik "Verstuur"
  const verstuurBtn = page.locator(".overlay").getByRole("button", { name: /^Verstuur$/ });
  await expect(verstuurBtn).toBeVisible({ timeout: 5000 });
  await verstuurBtn.click();
  await page.waitForTimeout(2000);

  expect(reviewAction).toBe("send-review-request-email");
  console.log("✅ Review verzoek: edge function action=send-review-request-email ontvangen");
});

// ─── 10. Planning: afspraak aanmaken en zichtbaar in agenda ───────────────────
test("10. planning – afspraak aanmaken zichtbaar in week-view", async ({ page }) => {
  test.setTimeout(45000);
  await waitForApp(page);
  await openTab(page, "Planning");
  await page.waitForTimeout(500);

  // Gebruik .ph (page header) scope: de btn-dark knop in de Planning header
  await page.locator(".ph button.btn-dark").click();
  await page.waitForTimeout(400);

  const planModal = page.locator(".overlay", { hasText: "Opdracht toevoegen" });
  await expect(planModal).toBeVisible({ timeout: 5000 });

  // Klant selecteren — label "Klant" is uniek in dit modal (Status/Herhaling/Categorie/Medewerker labels bevatten geen "Klant")
  const klantSelect = planModal.locator(".ig").filter({ has: page.locator("label", { hasText: /^Klant$/ }) }).locator("select");
  const opties = await klantSelect.locator("option").count();
  if (opties > 1) {
    await klantSelect.selectOption({ index: 1 });
    await page.waitForTimeout(200);
  } else {
    console.log("⚠️  Geen klanten — Toevoegen-knop mogelijk uitgeschakeld");
  }

  // Dienst invullen — "Wat ga je doen?" input is veld "dienst"
  await planModal.locator("input[placeholder='Wat ga je doen?']").fill("Playwright Test Opdracht");

  const tijdInputs = page.locator("input[type='time']");
  await tijdInputs.first().fill("10:00");
  if ((await tijdInputs.count()) > 1) await tijdInputs.nth(1).fill("11:00");

  // Toevoegen-knop in de modal (is disabled als klant of dienst leeg is)
  const toevoegenBtn = planModal.locator("button.btn-dark").last();
  await expect(toevoegenBtn).toBeEnabled({ timeout: 3000 });
  await toevoegenBtn.click();
  await page.waitForTimeout(1500);

  await expect(planModal).toBeHidden({ timeout: 6000 });
  console.log("✅ Planning: opdracht aangemaakt");

  // Controleer week-view
  const weekBtn = page.locator("button.nb").filter({ hasText: /Planning/ }).first();
  // Al op planningsscherm — klik Week-knop in de agenda header
  const weekViewBtn = page.getByRole("button", { name: /^Week$/ }).first();
  if (await weekViewBtn.isVisible()) {
    await weekViewBtn.click();
    await page.waitForTimeout(600);
    const blokken = page.locator(".cal-task-blk");
    const n = await blokken.count();
    expect(n, "Minstens één tijdblok zichtbaar").toBeGreaterThan(0);
    console.log(`✅ Planning: ${n} tijdblok(ken) in week-view`);
  }
});

// ─── 11. Rit registreren ──────────────────────────────────────────────────────
// Ritten is een sub-tab binnen Financiën (geen eigen sidebar-item meer)
test("11. rit registreren – km automatisch berekend en opgeslagen", async ({ page }) => {
  test.setTimeout(60000);
  await waitForApp(page);

  // Navigeer naar Financiën → Ritten sub-tab
  await openTab(page, "Financi");  // matcht "Financiën" in sidebar
  await page.waitForTimeout(500);

  // Klik op de "🚗 Ritten" sub-tab knop
  await page.locator("button", { hasText: /Ritten/ }).first().click();
  await page.waitForTimeout(500);

  // Lees huidig aantal ritten uit de subtitel
  const telTekst = await page
    .locator(".pg-sub", { hasText: /ritten geregistreerd/i })
    .textContent()
    .catch(() => "0 ritten");
  const aantalVoor = parseInt((telTekst || "0").match(/\d+/)?.[0] || "0");

  // RittenTab heeft eigen .ph na de FinancienTab header (Nieuwe factuur) → .last() pakt de Rit-knop
  await page.locator(".ph button.btn-dark").last().click();
  await page.waitForTimeout(400);

  const ritModal = page.locator(".overlay", { hasText: "Rit toevoegen" });
  await expect(ritModal).toBeVisible({ timeout: 5000 });

  await page.locator("input[placeholder='Straat 1, Amsterdam']").fill("Amsterdam Centraal");
  await page.locator("input[placeholder='Straat 2, Rotterdam']").fill("Rotterdam Centraal");

  // Wacht tot geocoding + routering klaar is en Opslaan enabled is
  await expect(ritModal.locator("button", { hasText: /^Opslaan$/ })).toBeEnabled({
    timeout: 25000,
  });

  const km = await page
    .locator("input[placeholder='Wordt automatisch berekend']")
    .inputValue();
  const kmGetal = parseFloat(km);
  expect(kmGetal, "KM moet groter dan 0 zijn").toBeGreaterThan(0);
  console.log(`✅ Km berekend: ${kmGetal} km`);

  await ritModal.locator("button", { hasText: /^Opslaan$/ }).click();
  await page.waitForTimeout(1500);
  await expect(ritModal).toBeHidden({ timeout: 5000 });

  // Controleer dat de teller met 1 is opgehoogd
  const telNaTekst = await page
    .locator(".pg-sub", { hasText: /ritten geregistreerd/i })
    .textContent()
    .catch(() => "0 ritten");
  const aantalNa = parseInt((telNaTekst || "0").match(/\d+/)?.[0] || "0");
  expect(aantalNa, "Één rit meer dan voor").toBe(aantalVoor + 1);
  console.log(`✅ Rit opgeslagen: ${kmGetal} km (Amsterdam → Rotterdam), totaal ${aantalNa}`);
});
