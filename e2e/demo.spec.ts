/**
 * WerkMate verkoopvideo — ~3 minuten
 * Run: npx playwright test --config playwright.demo.config.ts
 * Output: demo-videos/*.webm
 *
 * Tijdlijn
 *   0:00–0:18  Dashboard         (gevulde stats)
 *   0:18–0:48  Klanten           (3 bestaande + Peters toevoegen)
 *   0:48–1:05  Prijslijst        (tarieven, 8 sec bekijken)
 *   1:05–1:28  Offertes          (2 bestaande + Slimme offerte voor Peters)
 *   1:28–2:05  AI genereert      (regels met prijslijst-tarieven, totaal)
 *   2:05–2:20  Versturen         (Mail 4 sec, WhatsApp)
 *   2:20–2:30  Ondertekend       (badge)
 *   2:30–2:43  Financiën         (factuur automatisch)
 *   2:43–2:55  Planning          (afspraak Peters + weekview)
 *   2:55–3:20  Boekhouding       (BTW 6s · Uitgaven 6s · Scan 3s · Winst 6s)
 */

import { test, Page } from "@playwright/test";
import { readFileSync } from "fs";

// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://cpfdyrscucicvqzpnisd.supabase.co";
const ANON_KEY    = "sb_publishable_-pgSrBNGFV9D-2QHqX3FPA_VQS-ganx";
const USER_ID     = "10b87703-25f3-49a0-aa79-e624f5e16fb2";

// ── Helpers ───────────────────────────────────────────────────────────────────
async function glide(page: Page, x: number, y: number, steps = 28) {
  await page.mouse.move(x, y, { steps });
}

async function glideTo(page: Page, selector: string, steps = 28) {
  const el  = page.locator(selector).first();
  const box = await el.boundingBox();
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

async function selectByOptionText(page: Page, optionText: string) {
  return page.locator("select", { has: page.locator("option", { hasText: optionText }) }).first();
}

/** Navigeert via sidebar-knop; wacht 2 sec zodat content laadt */
async function navTab(page: Page, nameRe: RegExp) {
  await page.locator("button.nb", { hasText: nameRe }).first().click();
  await page.waitForTimeout(2000);
}

/** Wacht seconden, toont een commentaar in console */
async function pause(page: Page, ms: number, label?: string) {
  if (label) console.log(`  pause ${ms}ms — ${label}`);
  await page.waitForTimeout(ms);
}

// ── Supabase helpers (Node.js) ───────────────────────────────────────────────
function getJwt(): string {
  const session = JSON.parse(readFileSync("e2e/.auth/session.json", "utf8"));
  const ls: Array<{ name: string; value: string }> =
    session?.origins?.[0]?.localStorage ?? [];
  const entry = ls.find(e => e.name.includes("auth-token"));
  if (!entry) throw new Error("No auth token in session.json");
  return JSON.parse(entry.value).access_token;
}

function isoDate(daysAgo = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

async function cleanupDemoData(jwt: string) {
  const headers = {
    "Authorization": `Bearer ${jwt}`,
    "apikey":        ANON_KEY,
    "Prefer":        "return=minimal",
    "Content-Type":  "application/json",
  };
  // Prijslijst wordt NIET verwijderd
  for (const tbl of ["facturen","offertes","werkbonnen","planning","ritten","uitgaven","klanten"]) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/${tbl}?user_id=eq.${USER_ID}`,
      { method: "DELETE", headers }
    );
    console.log(`cleanup ${tbl}: ${r.status}`);
  }
}

async function seedDemoData(jwt: string) {
  const h = {
    "Authorization": `Bearer ${jwt}`,
    "apikey":        ANON_KEY,
    "Content-Type":  "application/json",
    "Prefer":        "return=minimal",
  };
  const base  = `${SUPABASE_URL}/rest/v1`;
  const today = isoDate(0);

  // Klanten
  await fetch(`${base}/klanten`, {
    method: "POST", headers: h,
    body: JSON.stringify([
      { user_id: USER_ID, naam: "Hoveniersbedrijf Van Dijk", tel: "06-12345678", email: "vandijk@hoveniers.nl",   adres: "Tuinlaan 15, Utrecht"   },
      { user_id: USER_ID, naam: "Tuinservice Bakker",         tel: "06-87654321", email: "bakker@tuinservice.nl", adres: "Molenweg 8, Amsterdam"   },
      { user_id: USER_ID, naam: "Villa Zonnedal",             tel: "06-11223344", email: "info@villazonnedal.nl", adres: "Zonneweg 3, Rotterdam"   },
    ]),
  });

  // Offertes
  await fetch(`${base}/offertes`, {
    method: "POST", headers: h,
    body: JSON.stringify([
      {
        user_id: USER_ID, klant: "Hoveniersbedrijf Van Dijk",
        dienst: "Jaarcontract tuinonderhoud", bedrag: "€ 3.521,10",
        regels: JSON.stringify([
          { omschrijving: "Tuinonderhoud",       aantal: 12, eenheid: "maand", prijs: 220, btw_pct: 21 },
          { omschrijving: "Snoeiwerk",           aantal:  4, eenheid: "uur",   prijs:  52, btw_pct: 21 },
        ]),
        subtotaal: 2848, btw: 598.08, totaal: 3446.08,
        status: "Verstuurd", datum: isoDate(5),
        opmerkingen: "Jaarcontract 2026–2027. Startdatum 1 juli.",
      },
      {
        user_id: USER_ID, klant: "Tuinservice Bakker",
        dienst: "Bestrating oprit 60m²", bedrag: "€ 2.904,00",
        regels: JSON.stringify([
          { omschrijving: "Bestrating vernieuwen", aantal: 60, eenheid: "m²",   prijs:  35, btw_pct: 21 },
          { omschrijving: "Grondwerk egaliseren",  aantal:  8, eenheid: "uur",   prijs:  55, btw_pct: 21 },
          { omschrijving: "Afvoer puin",           aantal:  1, eenheid: "stuk",  prijs: 160, btw_pct: 21 },
        ]),
        subtotaal: 2400, btw: 504, totaal: 2904,
        status: "In afwachting", datum: isoDate(2), opmerkingen: "",
      },
    ]),
  });

  // Factuur Betaald
  await fetch(`${base}/facturen`, {
    method: "POST", headers: h,
    body: JSON.stringify([{
      user_id: USER_ID, nummer: "2026-001",
      klant: "Villa Zonnedal", klant_email: "info@villazonnedal.nl",
      datum: isoDate(10), vervaldatum: isoDate(3),
      regels: JSON.stringify([
        { omschrijving: "Snoeiwerk",         aantal: 6, eenheid: "uur",  prijs: 52, btw_pct: 21 },
        { omschrijving: "Beplanting leveren", aantal: 8, eenheid: "stuk", prijs: 18, btw_pct: 21 },
      ]),
      btw: 98.49, totaal: 554.49, status: "Betaald",
    }]),
  });

  // Planning — 2 items vandaag
  await fetch(`${base}/planning`, {
    method: "POST", headers: h,
    body: JSON.stringify([
      {
        user_id: USER_ID, datum: today,
        tijd: "09:00", eindtijd: "12:00",
        klant: "Hoveniersbedrijf Van Dijk", dienst: "Tuinonderhoud",
        adres: "Tuinlaan 15, Utrecht",
        status: "Ingepland", herhaal: "", categorie: "", medewerker: "",
      },
      {
        user_id: USER_ID, datum: today,
        tijd: "14:00", eindtijd: "15:30",
        klant: "Tuinservice Bakker", dienst: "Offerte opname oprit",
        adres: "Molenweg 8, Amsterdam",
        status: "Ingepland", herhaal: "", categorie: "", medewerker: "",
      },
    ]),
  });

  console.log("Seed data klaar.");
}

async function portalSign(jwt: string, token: string): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/ai-proxy`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      action:       "portal-sign",
      portal_token: token,
      handtekening: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=",
      klant_email:  "peters@groenservice.nl",
      klant_naam:   "Groenservice Peters",
    }),
  });
  console.log("portal-sign:", r.status);
  return r.ok;
}

async function patchOfferteStatus(jwt: string, token: string, status: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/offertes?portal_token=eq.${token}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "apikey":        ANON_KEY,
      "Content-Type":  "application/json",
      "Prefer":        "return=minimal",
    },
    body: JSON.stringify({ status }),
  });
}

// ── AI offerte mock — regels komen exact overeen met prijslijst-tarieven ──────
// Prijslijst tuinieren: Tuinonderhoud €55/uur · Bestrating vernieuwen €35/m² · Snoeiwerk €52/uur
// Offerte omschrijving: "Tuinonderhoud 5 uur, Bestrating vernieuwen 20m2, Snoeiwerk 3 uur"
const AI_JSON = JSON.stringify({
  dienst: "Groenaanleg en onderhoud bedrijfspand Groenservice Peters",
  regels: [
    { omschrijving: "Tuinonderhoud",       aantal:  5, eenheid: "uur", prijs: 55, btw_pct: 21 },
    { omschrijving: "Bestrating vernieuwen", aantal: 20, eenheid: "m²", prijs: 35, btw_pct: 21 },
    { omschrijving: "Snoeiwerk",           aantal:  3, eenheid: "uur", prijs: 52, btw_pct: 21 },
  ],
  subtotaal: 1231,   // 5×55 + 20×35 + 3×52 = 275+700+156
  btw:        258.51,
  totaal:    1489.51,
  opmerkingen: "Tarieven conform uw prijslijst. Uitvoering binnen 2 weken.",
});

// ── Main demo test ────────────────────────────────────────────────────────────
test("🎬 WerkMate demo verkoopvideo", async ({ browser }) => {
  test.setTimeout(600_000);

  // ── Setup ─────────────────────────────────────────────────────────────────
  const jwt = getJwt();
  console.log("Cleanup + seed…");
  await cleanupDemoData(jwt);
  await seedDemoData(jwt);

  // ── Browser context + video ────────────────────────────────────────────────
  const context = await browser.newContext({
    viewport:     { width: 1280, height: 800 },
    storageState: "e2e/.auth/session.json",
    recordVideo:  { dir: "demo-videos/", size: { width: 1280, height: 800 } },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);

  // ── Route mocks ────────────────────────────────────────────────────────────
  let capturedPortalToken: string | null = null;

  await context.route("**/functions/v1/ai-proxy", async (route, request) => {
    const body = request.postDataJSON() as Record<string, unknown>;
    if (body?.action === "ai-offerte") {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ content: [{ type: "text", text: AI_JSON }] }),
      });
    } else if (body?.action === "send-offer-email") {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    } else {
      await route.continue();
    }
  });

  // Capture portal_token uit Peters offerte INSERT response
  await context.route("**/rest/v1/offertes*", async (route, request) => {
    const response = await route.fetch();
    if (request.method() === "POST" && !capturedPortalToken) {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        const pt   = Array.isArray(json) ? json[0]?.portal_token : json?.portal_token;
        if (pt) { capturedPortalToken = pt; console.log("portal_token:", pt); }
      } catch { /* ignore */ }
      await route.fulfill({ response, body: text });
    } else {
      await route.fulfill({ response });
    }
  });

  // ── Open app ──────────────────────────────────────────────────────────────
  await page.goto("https://app.werkmate.tech");
  await page.waitForSelector("button.nb", { timeout: 20_000 });
  await pause(page, 2000, "app geladen");

  // ═══════════════════════════════════════════════════════════════════════════
  // 0:00–0:18  DASHBOARD — gevulde stats
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("== DASHBOARD ==");

  // Glide langs alle stat-kaarten
  const statCards = page.locator(".sc");
  const nCards    = await statCards.count();
  for (let i = 0; i < Math.min(nCards, 4); i++) {
    const box = await statCards.nth(i).boundingBox();
    if (box) await glide(page, box.x + box.width / 2, box.y + box.height / 2, 24);
    await pause(page, 800);
  }

  // Glide naar planning-sectie (vandaag 2 items)
  await glide(page, 640, 480, 22);
  await pause(page, 1000);
  await glide(page, 640, 580, 18);
  await pause(page, 4000, "dashboard-overzicht");

  // ═══════════════════════════════════════════════════════════════════════════
  // 0:18–0:48  KLANTEN — 3 bestaande tonen + Groenservice Peters toevoegen
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("== KLANTEN ==");
  await navTab(page, /klanten|crm/i);

  // Glide langzaam langs 3 bestaande klantkaarten
  const klantCards = page.locator(".pc");
  const nKlanten   = await klantCards.count();
  for (let i = 0; i < Math.min(nKlanten, 3); i++) {
    const box = await klantCards.nth(i).boundingBox();
    if (box) await glide(page, box.x + box.width / 2, box.y + box.height / 2, 22);
    await pause(page, 900);
  }
  await pause(page, 2500, "bestaande klanten bekijken");

  // + Klant toevoegen
  await glideTo(page, ".ph button.btn-dark");
  await page.locator(".ph button.btn-dark").first().click();
  await pause(page, 900);

  // Naam
  await slowType(page, "input[placeholder='Bedrijf of naam']", "Groenservice Peters");
  await pause(page, 600);

  // Telefoon
  await glideTo(page, "input[placeholder='06-12345678']");
  await slowType(page, "input[placeholder='06-12345678']", "06-55667788");
  await pause(page, 600);

  // Email
  await glideTo(page, "input[placeholder='klant@email.nl']");
  await slowType(page, "input[placeholder='klant@email.nl']", "peters@groenservice.nl");
  await pause(page, 600);

  // Adres
  await glideTo(page, "input[placeholder='Straat 1, Amsterdam']");
  await slowType(page, "input[placeholder='Straat 1, Amsterdam']", "Groenstraat 12, Den Haag");
  await pause(page, 700);

  // Opslaan
  await glideTo(page, ".overlay .btn-dark.btn-full");
  await page.locator(".overlay .btn-dark.btn-full").first().click();
  await page.waitForSelector(".pc", { timeout: 8000 });

  // Glide naar nieuwe Peters-kaart (laatste)
  const allCards = page.locator(".pc");
  const lastBox  = await allCards.last().boundingBox();
  if (lastBox) await glide(page, lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height / 2, 22);
  await pause(page, 3000, "Peters-kaart zichtbaar");

  // ═══════════════════════════════════════════════════════════════════════════
  // 0:48–1:05  PRIJSLIJST — tarieven bekijken (connectie met offerte)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("== PRIJSLIJST ==");

  // Navigeer via account-dropdown
  await glideTo(page, ".sb-acct-btn");
  await page.locator(".sb-acct-btn").click();
  await pause(page, 700);
  await glideTo(page, ".sb-dd-item");
  await page.locator(".sb-dd-item").filter({ hasText: /Prijslijst/i }).click();

  await page.waitForSelector(".pl-row", { timeout: 8000 });
  await pause(page, 1500, "prijslijst geladen");

  // Glide langs tariefregels — kijker ziet Tuinonderhoud/Bestrating/Snoeiwerk
  const plRows = page.locator(".pl-row");
  const nRows  = await plRows.count();
  for (let i = 0; i < Math.min(nRows, 8); i++) {
    const box = await plRows.nth(i).boundingBox();
    if (box) await glide(page, box.x + box.width / 2, box.y + box.height / 2, 16);
    await pause(page, 400);
  }
  await pause(page, 8000, "tarieven bekijken — kijker herkent Tuinonderhoud/Bestrating/Snoeiwerk");

  // ═══════════════════════════════════════════════════════════════════════════
  // 1:05–1:28  OFFERTES — 2 bestaande + Slimme offerte voor Peters
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("== OFFERTES ==");
  await navTab(page, /offert/i);

  // Even de bestaande offertes bekijken
  await glide(page, 640, 300, 20);
  await pause(page, 1500);
  await glide(page, 640, 420, 18);
  await pause(page, 2500, "bestaande offertes");

  // Slimme offerte knop
  await glideTo(page, "button.btn-ai");
  await pause(page, 800);
  await page.locator("button.btn-ai").first().click();
  await pause(page, 1000);

  // Selecteer Peters
  const klantSel = await selectByOptionText(page, "Groenservice Peters");
  await glideTo(page, ".overlay select.inp");
  await klantSel.selectOption({ label: "Groenservice Peters" });
  await pause(page, 700);

  // Typ omschrijving met EXACT de diensten uit de prijslijst
  // Kijker ziet: Tuinonderhoud, Bestrating vernieuwen, Snoeiwerk → straks in de offerte
  await glideTo(page, "textarea[placeholder*='CV ketel']");
  await slowType(
    page,
    "textarea[placeholder*='CV ketel']",
    "Tuinonderhoud 5 uur, Bestrating vernieuwen 20m2, Snoeiwerk 3 uur"
  );
  await pause(page, 3500, "omschrijving met prijslijst-diensten");

  // ═══════════════════════════════════════════════════════════════════════════
  // 1:28–2:05  AI GENEREERT — regels tonen met prijslijst-tarieven
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("== AI GENEREREN ==");
  await glideTo(page, "button.btn-ai.btn-full");
  await page.locator("button.btn-ai.btn-full").first().click();

  // Wacht op stap 2 (regels geladen)
  await page.waitForSelector(".tot-box", { timeout: 15_000 });
  await pause(page, 2500, "AI resultaat geladen");

  const overlay = page.locator(".overlay").first();

  // Scroll langzaam door de regels — kijker herkent de prijslijst-prijzen
  await overlay.evaluate(el => el.scrollTo({ top: 60,  behavior: "smooth" }));
  await pause(page, 2500);
  await overlay.evaluate(el => el.scrollTo({ top: 160, behavior: "smooth" }));
  await pause(page, 2500);

  // Glide cursor langs elke regel om de diensten te benadrukken
  const regels = overlay.locator(".off-cel, .off-row, tr").filter({ hasText: /uur|m²|stuk/i });
  const nRegels = await regels.count();
  for (let i = 0; i < Math.min(nRegels, 3); i++) {
    const box = await regels.nth(i).boundingBox();
    if (box) await glide(page, box.x + box.width / 2, box.y + box.height / 2, 20);
    await pause(page, 1800);
  }

  await overlay.evaluate(el => el.scrollTo({ top: 320, behavior: "smooth" }));
  await pause(page, 2500);

  // Totaalbox — prominent zichtbaar
  await glideTo(page, ".tot-box");
  await pause(page, 10000, "totaal zichtbaar €1.489,51");

  // ═══════════════════════════════════════════════════════════════════════════
  // 2:05–2:20  OFFERTE VERSTUREN — Mail 4 sec, WhatsApp hover
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("== VERSTUREN ==");

  // Scroll naar Opslaan & Verstuur
  await overlay.evaluate(el => el.scrollTo({ top: 9999, behavior: "smooth" }));
  await pause(page, 1000);
  await glideTo(page, "button.btn-ai:not(.btn-full)");
  await page.locator("button.btn-ai:not(.btn-full)").first().click();

  // Wacht tot offerte in lijst staat
  await page.waitForSelector(".off-tbl-row.mob-hide, .mob-card", { timeout: 10_000 });
  await pause(page, 1500);

  // Mail knop — native alert blijft 4 sec zichtbaar
  page.once("dialog", async dialog => {
    await new Promise<void>(res => setTimeout(res, 4000));
    await dialog.accept();
  });
  await glideTo(page, ".btn-blue.btn-sm");
  await page.locator(".btn-blue.btn-sm").first().click();
  await pause(page, 5500, "mail-alert 4 sec zichtbaar");

  // WhatsApp knop hoveren
  await glideTo(page, ".btn-green.btn-sm");
  await page.locator(".btn-green.btn-sm").first().hover();
  await pause(page, 4000, "WhatsApp knop");

  // ── Portal-sign + status patch (achtergrond, niet zichtbaar) ───────────────
  if (capturedPortalToken) {
    await portalSign(jwt, capturedPortalToken);
    await patchOfferteStatus(jwt, capturedPortalToken, "Ondertekend");
  } else {
    console.warn("portal_token niet gevangen — factuur wordt niet aangemaakt");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2:20–2:30  STATUS ONDERTEKEND
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("== ONDERTEKEND ==");
  await navTab(page, /offert/i);

  await page.waitForSelector(".badge", { timeout: 8000 });
  await glideTo(page, ".badge");
  await pause(page, 4000, "Ondertekend badge");

  // ═══════════════════════════════════════════════════════════════════════════
  // 2:30–2:43  FINANCIËN — factuur automatisch aangemaakt
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("== FINANCIËN ==");
  await navTab(page, /financ/i);

  await page.waitForSelector(".f-row, .tw tbody tr", { timeout: 10_000 });
  await pause(page, 1000);

  await glide(page, 640, 340, 22);
  await pause(page, 2000);
  await glide(page, 960, 340, 18);
  await pause(page, 5000, "factuur zichtbaar");

  // ═══════════════════════════════════════════════════════════════════════════
  // 2:43–2:55  PLANNING — afspraak Peters + weekoverzicht
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("== PLANNING ==");
  await navTab(page, /planning/i);
  await page.waitForSelector(".cal-grid, .cal-wg-outer", { timeout: 8000 });

  // + Opdracht
  await glideTo(page, ".ph button.btn-dark");
  await page.locator(".ph button.btn-dark").last().click();
  await pause(page, 800);

  // Klant Peters
  const planKlant = await selectByOptionText(page, "Groenservice Peters");
  await glideTo(page, ".overlay select.inp");
  await planKlant.selectOption({ label: "Groenservice Peters" });
  await pause(page, 500);

  // Dienst
  await glideTo(page, "input[placeholder='Wat ga je doen?']");
  await slowType(page, "input[placeholder='Wat ga je doen?']", "Startopname groenaanleg");
  await pause(page, 600);

  // Opslaan
  await glideTo(page, ".overlay .btn-dark.btn-full");
  await page.locator(".overlay .btn-dark.btn-full").first().click();
  await pause(page, 1500);

  // Schakel naar weekoverzicht
  await page.locator(".cal-vt-btn:has-text('Week')").click();
  await pause(page, 1500);
  await glide(page, 640, 440, 22);
  await pause(page, 1000);

  const taskBlk = page.locator(".cal-task-blk").first();
  if (await taskBlk.isVisible().catch(() => false)) {
    await glideTo(page, ".cal-task-blk");
    await pause(page, 1500);
  }

  // Categorieën hover
  await glideTo(page, "button:has-text('🏷️')");
  await page.locator("button:has-text('🏷️')").hover();
  await pause(page, 1500);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2:55–3:20  BOEKHOUDING TOUR
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("== BOEKHOUDING ==");
  await navTab(page, /financ/i);
  await pause(page, 1000);

  // BTW — 6 sec
  await glideTo(page, "button:has-text('📊 BTW')");
  await page.locator("button:has-text('📊 BTW')").click();
  await pause(page, 6000, "BTW-overzicht");

  // Uitgaven — 6 sec
  await glideTo(page, "button:has-text('💳 Uitgaven')");
  await page.locator("button:has-text('💳 Uitgaven')").click();
  await pause(page, 6000, "Uitgaven-overzicht");

  // Scan knop hoveren — 3 sec
  await glideTo(page, "button.btn-ghost");
  await page.locator("button.btn-ghost").filter({ hasText: /Scan/i }).first().hover();
  await pause(page, 3000, "Scan-knop");

  // Winst — 6 sec
  await glideTo(page, "button:has-text('📈 Winst')");
  await page.locator("button:has-text('📈 Winst')").click();
  await pause(page, 6000, "Winst-grafiek");

  // Eindigen op Facturen
  await glideTo(page, "button:has-text('📄 Facturen')");
  await page.locator("button:has-text('📄 Facturen')").click();
  await pause(page, 4000, "einde — facturen-dashboard");

  // ── Opslaan video ─────────────────────────────────────────────────────────
  console.log("Context sluiten — video wordt opgeslagen in demo-videos/");
  await context.close();
});
