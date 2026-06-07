/**
 * WerkMate – Demo verkoopvideo (±3 minuten)
 *
 * Draai: npx playwright test e2e/demo.spec.ts --project=chromium
 * Video: demo-videos/<hash>.webm
 *
 * Tijdlijn:
 *   0:00  Dashboard        (10s)
 *   0:10  Klanten          (25s)
 *   0:35  Offertes         (10s)
 *   0:45  AI offerte       (40s)
 *   1:25  Offerte aanpassen(20s)
 *   1:45  Opslaan + mail   (20s)
 *   2:05  Klantportaal     (25s)
 *   2:30  Terug in app     (15s)
 *   2:45  Planning         (10s)
 *   2:55  Dashboard slot   ( 5s)
 */

import { test, Page } from "@playwright/test";

// Draai via: npx playwright test --config playwright.demo.config.ts

// ── Mock AI offerte respons ──────────────────────────────────────────────────
const AI_OFFERTE_JSON = JSON.stringify({
  dienst: "Tuinaanleg Villa Zonnedal",
  omschrijving:
    "Volledige tuinaanleg voor 80m² met bestrating, borders en beplanting. " +
    "Professioneel aangelegd met duurzame materialen en 2 jaar garantie op aanleg.",
  regels: [
    {
      omschrijving: "Bestrating 80m² — tegels, zand en fundatie",
      aantal: 80,
      eenheid: "m²",
      prijs: 38,
      btw_pct: 21,
    },
    {
      omschrijving: "Borders aanleggen + beplanting plaatsen",
      aantal: 16,
      eenheid: "uur",
      prijs: 72,
      btw_pct: 21,
    },
    {
      omschrijving: "Vaste planten, struiken en seizoensbloemen",
      aantal: 1,
      eenheid: "stuk",
      prijs: 890,
      btw_pct: 21,
    },
    {
      omschrijving: "Grondwerk en afvoer puin",
      aantal: 8,
      eenheid: "uur",
      prijs: 72,
      btw_pct: 21,
    },
  ],
  subtotaal: 5242,
  btw9: 0,
  btw21: 1100.82,
  btw: 1100.82,
  totaal: 6342.82,
  geldigheid: "30 dagen",
  opmerkingen:
    "2 jaar garantie op aanleg en materialen. Beplanting conform opgave. Geldigheid offerte: 30 dagen.",
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function glide(page: Page, x: number, y: number, steps = 28) {
  await page.mouse.move(x, y, { steps });
}

async function glideTo(page: Page, selector: string, steps = 28) {
  const box = await page.locator(selector).first().boundingBox();
  if (!box) return;
  await glide(page, box.x + box.width / 2, box.y + box.height / 2, steps);
}

async function slowType(page: Page, selector: string, text: string, delay = 80) {
  const el = page.locator(selector).first();
  await el.click();
  await el.fill("");
  for (const ch of text) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(delay);
  }
}

/** Vindt de <select> die een <option> bevat met de gegeven tekst. */
async function selectByOptionText(page: Page, optionText: string) {
  return page.locator("select", {
    has: page.locator("option", { hasText: optionText }),
  });
}

async function drawSignature(page: Page) {
  const canvas = page.locator("canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 8000 });
  const box = await canvas.boundingBox();
  if (!box) return;
  await page.mouse.move(box.x + 40, box.y + 75);
  await page.mouse.down();
  for (let i = 0; i <= 195; i += 4) {
    await page.mouse.move(
      box.x + 40 + i,
      box.y + 75 + Math.sin(i / 20) * 30 + (i / 195) * 18,
    );
    await page.waitForTimeout(10);
  }
  await page.mouse.up();
  await page.waitForTimeout(250);
  await page.mouse.move(box.x + 36, box.y + 125);
  await page.mouse.down();
  for (let i = 0; i <= 130; i += 7) {
    await page.mouse.move(box.x + 36 + i, box.y + 125);
    await page.waitForTimeout(12);
  }
  await page.mouse.up();
  await page.waitForTimeout(300);
}

// ── Demo test ─────────────────────────────────────────────────────────────────

test("🎬 WerkMate demo verkoopvideo", async ({ browser }) => {
  test.setTimeout(420_000); // 7 min max

  // Eigen context zodat recordVideo.dir naar demo-videos/ gaat,
  // ongeacht de video:'off' instelling in playwright.config.ts
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    storageState: "e2e/.auth/session.json",
    recordVideo: {
      dir: "demo-videos/",
      size: { width: 1280, height: 800 },
    },
  });
  const page = await context.newPage();

  let portalToken: string | null = null;

  // Vang portal_token op uit Supabase offertes responses
  await page.route("**/rest/v1/offertes*", async (route) => {
    const response = await route.fetch();
    try {
      const body = await response.json();
      const items: Record<string, unknown>[] = Array.isArray(body)
        ? body
        : body && typeof body === "object"
          ? [body]
          : [];
      const found = items.find(
        (o) =>
          o.portal_token &&
          o.status !== "Ondertekend" &&
          o.status !== "Geaccepteerd",
      );
      if (found && !portalToken) portalToken = found.portal_token as string;
    } catch {}
    await route.fulfill({ response });
  });

  // AI offerte generatie en e-mail sends zijn gemocked; portal-sign loopt echt
  await page.route("**/functions/v1/ai-proxy", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown> | null;
    if (!body) { await route.continue(); return; }

    if (
      body.action === "send-offer-email" ||
      body.action === "send-compose-email" ||
      body.action === "send-invoice-email"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, id: "demo-mock" }),
      });
      return;
    }

    if (body.prompt) {
      await new Promise<void>((res) => setTimeout(res, 3000));
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          content: [{ type: "text", text: AI_OFFERTE_JSON }],
        }),
      });
      return;
    }

    await route.continue();
  });

  page.on("dialog", (d) => d.accept());

  // ── 0:00 Dashboard — cursor langs stats, planning vandaag (10s) ───────────
  await page.goto("/");
  await page.waitForSelector(".shell", { timeout: 25000 });
  await page.waitForTimeout(1000);

  await glide(page, 640, 280);
  for (let n = 1; n <= 4; n++) {
    await glideTo(page, `.sc:nth-child(${n})`, 30);
    await page.waitForTimeout(600);
  }
  await page.mouse.wheel(0, 180);
  await page.waitForTimeout(1200);
  await page.mouse.wheel(0, -180);
  await page.waitForTimeout(400);

  // ── 0:10 Klanten — scroll, nieuwe klant aanmaken (25s) ───────────────────
  await page.locator("button.nb", { hasText: /Klanten/i }).first().click();
  await page.waitForTimeout(800);

  await page.mouse.wheel(0, 260);
  await page.waitForTimeout(750);
  await page.mouse.wheel(0, -260);
  await page.waitForTimeout(500);

  const eersteKlant = page.locator(".pc").first();
  if (await eersteKlant.isVisible({ timeout: 1000 }).catch(() => false)) {
    await glideTo(page, ".pc", 20);
    await page.waitForTimeout(450);
  }

  await page.locator(".ph button.btn-dark").click();
  await page.waitForTimeout(400);

  await slowType(page, "input[placeholder='Bedrijf of naam']", "Hoveniersbedrijf Van Dijk", 65);
  await page.waitForTimeout(220);
  await slowType(page, "input[placeholder='06-12345678']", "06-21334455", 55);
  await page.waitForTimeout(200);
  await slowType(page, "input[placeholder='klant@email.nl']", "info@vandijk-hovenier.nl", 50);
  await page.waitForTimeout(200);

  await page.locator("input[placeholder='Straat 1, Amsterdam']").click();
  for (const ch of "Prinses Beatrixlaan 12, Utrecht") {
    await page.keyboard.type(ch);
    await page.waitForTimeout(48);
  }
  await page.waitForTimeout(400);

  await page.locator(".overlay").locator("button.btn-dark").last().click();
  await page.waitForTimeout(1600);

  // ── 0:35 Offertes — bestaande tonen, Slimme offerte klikken (10s) ─────────
  await page.locator("button.nb", { hasText: /Offertes/i }).first().click();
  await page.waitForTimeout(1000);

  await page.mouse.wheel(0, 130);
  await page.waitForTimeout(750);
  await page.mouse.wheel(0, -130);
  await page.waitForTimeout(500);

  await glideTo(page, "button.btn-ai", 20);
  await page.waitForTimeout(400);
  await page.locator("button.btn-ai").click();
  await page.waitForTimeout(500);

  // ── 0:45 AI offerte — typen, generatie, scroll, bedrag (40s) ─────────────
  // Klant selecteren via label-match
  const klantSelAI = page.locator(".overlay select.inp").first();
  await klantSelAI.selectOption({ label: "Villa Zonnedal" }).catch(() => {});
  await page.waitForTimeout(300);

  const BESCHRIJVING =
    "Volledige tuinaanleg 80m2 bestrating, borders en beplanting voor Villa Zonnedal";
  await page.locator("textarea[placeholder*='CV ketel']").click();
  for (const ch of BESCHRIJVING) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(78);
  }
  await page.waitForTimeout(500);

  await glideTo(page, "button.btn-ai.btn-full", 18);
  await page.waitForTimeout(250);
  await page.locator("button.btn-ai.btn-full").click();

  // Wacht op stap 2 — AI mock geeft na 3s antwoord
  await page.waitForSelector(".off-tbl", { timeout: 20000 });
  await page.waitForTimeout(800);

  const modal = page.locator(".modal.modal-lg").first();

  // Hover over regels
  for (let i = 0; i < 4; i++) {
    const row = page.locator(".off-tbl-row.mob-hide").nth(i);
    const rBox = await row.boundingBox();
    if (rBox) await glide(page, rBox.x + rBox.width * 0.3, rBox.y + rBox.height / 2, 18);
    await page.waitForTimeout(550);
  }

  // Scroll naar totaalbox — WOW moment
  await modal.evaluate((el: HTMLElement) => (el.scrollTop += 230));
  await page.waitForTimeout(450);
  await glideTo(page, ".tot-box", 18);
  await page.waitForTimeout(1100);

  // ── 1:25 Offerte aanpassen — prijs + extra regel (20s) ────────────────────
  await modal.evaluate((el: HTMLElement) => (el.scrollTop = 0));
  await page.waitForTimeout(400);

  // Wijzig prijs eerste regel (38 → 42 €/m²)
  const firstPrijs = page
    .locator(".off-tbl-row.mob-hide")
    .first()
    .locator("input[type='number']")
    .nth(1);
  await firstPrijs.click({ clickCount: 3 });
  await page.waitForTimeout(150);
  await page.keyboard.type("42");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(600);

  await modal.evaluate((el: HTMLElement) => (el.scrollTop += 190));
  await page.waitForTimeout(350);
  await glideTo(page, ".tot-box", 18);
  await page.waitForTimeout(550);

  // + Regel toevoegen
  await modal.evaluate((el: HTMLElement) => (el.scrollTop += 160));
  await page.waitForTimeout(300);
  await page.locator("button", { hasText: /\+ Regel toevoegen/ }).click();
  await page.waitForTimeout(380);

  await modal.evaluate((el: HTMLElement) => (el.scrollTop += 180));
  await page.waitForTimeout(300);

  const lastRow = page.locator(".off-tbl-row.mob-hide").last();
  await lastRow.locator(".off-inp-ta").click();
  for (const ch of "Tuinonderhoud jaarcontract") {
    await page.keyboard.type(ch);
    await page.waitForTimeout(62);
  }
  await page.keyboard.press("Tab");
  await page.waitForTimeout(400);

  // ── 1:45 Opslaan en versturen — mail + WhatsApp (20s) ────────────────────
  await modal.evaluate((el: HTMLElement) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(480);

  const opslaanBtn = page.getByRole("button", { name: /Opslaan.*Verstuur/i });
  const oBBox = await opslaanBtn.first().boundingBox();
  if (oBBox) await glide(page, oBBox.x + oBBox.width / 2, oBBox.y + oBBox.height / 2, 16);
  await page.waitForTimeout(350);
  await opslaanBtn.first().click();
  await page.waitForTimeout(2800);

  // Hover Mail knop
  const mailBtn = page.locator(".btn-blue.btn-sm").first();
  if (await mailBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await glideTo(page, ".btn-blue.btn-sm", 20);
    await page.waitForTimeout(850);
    await mailBtn.click();
    await page.waitForTimeout(1400);
  }

  // WhatsApp knop tonen
  const waBtn = page.locator(".btn-green.btn-sm").first();
  if (await waBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await glideTo(page, ".btn-green.btn-sm", 18);
    await page.waitForTimeout(1300);
  }

  // ── 2:05 Klantportaal — scroll offerte, teken handtekening (25s) ──────────
  for (let i = 0; i < 20 && !portalToken; i++) {
    await page.waitForTimeout(500);
  }

  if (portalToken) {
    await page.goto(`/portal/${portalToken}`);
    await page.waitForTimeout(1800);

    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 190);
      await page.waitForTimeout(620);
    }
    await page.waitForTimeout(300);
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, -190);
      await page.waitForTimeout(350);
    }
    await page.waitForTimeout(250);

    const emailInput = page.locator("input[placeholder='uw@email.nl']");
    if (await emailInput.isVisible({ timeout: 4000 }).catch(() => false)) {
      await slowType(page, "input[placeholder='uw@email.nl']", "eigenaar@villazonnedal.nl", 58);
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: /Offerte ondertekenen/i }).click();
      await page.waitForTimeout(700);
    }

    await drawSignature(page);

    const plBtn = page.getByRole("button", { name: /Handtekening plaatsen/i });
    const plBBox = await plBtn.first().boundingBox();
    if (plBBox) await glide(page, plBBox.x + plBBox.width / 2, plBBox.y + plBBox.height / 2, 16);
    await page.waitForTimeout(320);
    await plBtn.first().click();
    await page.waitForTimeout(2600); // ✅ Offerte geaccepteerd!
  }

  // ── 2:30 Terug in app — Ondertekend + factuur (15s) ──────────────────────
  await page.goto("/");
  await page.waitForSelector(".shell", { timeout: 15000 });
  await page.waitForTimeout(650);

  await page.locator("button.nb", { hasText: /Offertes/i }).first().click();
  await page.waitForTimeout(1600);

  const ondertekendRij = page.locator("tr").filter({ hasText: /Ondertekend/i }).first();
  if (await ondertekendRij.isVisible({ timeout: 3000 }).catch(() => false)) {
    const rBBox = await ondertekendRij.boundingBox();
    if (rBBox) await glide(page, rBBox.x + rBBox.width * 0.4, rBBox.y + rBBox.height / 2, 20);
    await page.waitForTimeout(1100);
  }

  await page.locator("button.nb", { hasText: /Financiën/i }).first().click();
  await page.waitForTimeout(1600);
  await page.mouse.wheel(0, 110);
  await page.waitForTimeout(650);

  // ── 2:45 Planning — afspraak Van Dijk aanmaken (10s) ─────────────────────
  await page.locator("button.nb", { hasText: /Planning/i }).first().click();
  await page.waitForTimeout(800);

  await page.locator(".ph button.btn-dark").click();
  await page.waitForTimeout(500);

  // Vind de Klant-select via de opties die erin staan (unambiguous)
  const vandijkSel = await selectByOptionText(page, "Hoveniersbedrijf Van Dijk");
  await vandijkSel
    .selectOption("Hoveniersbedrijf Van Dijk")
    .catch(async () => {
      const zonnedal = await selectByOptionText(page, "Villa Zonnedal");
      await zonnedal.selectOption("Villa Zonnedal").catch(() => {});
    });
  await page.waitForTimeout(350);

  await page.locator("input[placeholder='Wat ga je doen?']").fill("Tuinaanleg — start aanleg");
  await page.waitForTimeout(350);

  // Klik Toevoegen (wacht tot enabled, max 5s)
  const toevoegenBtn = page.locator(".overlay button.btn-dark").last();
  await toevoegenBtn.waitFor({ state: "visible" });
  await toevoegenBtn.click({ timeout: 8000 });
  await page.waitForTimeout(1300);

  await glide(page, 640, 420, 22);
  await page.waitForTimeout(800);

  // ── 2:55 Dashboard eindshot — alle stats (5s) ────────────────────────────
  await page.locator("button.nb", { hasText: /Dashboard/i }).first().click();
  await page.waitForTimeout(850);

  for (let n = 1; n <= 4; n++) {
    await glideTo(page, `.sc:nth-child(${n})`, 26);
    await page.waitForTimeout(400);
  }
  await glide(page, 640, 400, 18);
  await page.waitForTimeout(900);

  // Context sluiten zodat de video wordt opgeslagen in demo-videos/
  await context.close();
});
