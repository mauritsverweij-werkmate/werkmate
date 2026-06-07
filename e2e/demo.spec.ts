/**
 * WerkMate verkoopvideo demo script — ~3 minuten
 * Run: npx playwright test --config playwright.demo.config.ts
 * Output: demo-videos/*.webm
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

async function navTab(page: Page, nameRe: RegExp) {
  await page.locator("button.nb", { hasText: nameRe }).first().click();
  await page.waitForTimeout(2000);
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
  const base = `${SUPABASE_URL}/rest/v1`;
  const today = isoDate(0);

  // ── Klanten ──────────────────────────────────────────────────────────────
  await fetch(`${base}/klanten`, {
    method: "POST", headers: h,
    body: JSON.stringify([
      { user_id: USER_ID, naam: "Hoveniersbedrijf Van Dijk", tel: "06-12345678", email: "vandijk@hoveniers.nl",   adres: "Tuinlaan 15, Utrecht"     },
      { user_id: USER_ID, naam: "Tuinservice Bakker",         tel: "06-87654321", email: "bakker@tuinservice.nl", adres: "Molenweg 8, Amsterdam"     },
      { user_id: USER_ID, naam: "Villa Zonnedal",             tel: "06-11223344", email: "info@villazonnedal.nl", adres: "Zonneweg 3, Rotterdam"     },
    ]),
  });

  // ── Offertes ──────────────────────────────────────────────────────────────
  await fetch(`${base}/offertes`, {
    method: "POST", headers: h,
    body: JSON.stringify([
      {
        user_id: USER_ID,
        klant:   "Hoveniersbedrijf Van Dijk",
        dienst:  "Jaarcontract tuinonderhoud",
        bedrag:  "€ 3.448,50",
        regels:  JSON.stringify([
          { omschrijving: "Maandelijks onderhoud", aantal: 12, eenheid: "maand", prijs: 195, btw_pct: 21 },
          { omschrijving: "Seizoenssnoei",          aantal:  2, eenheid: "dag",   prijs: 285, btw_pct: 21 },
        ]),
        subtotaal: 2910, btw: 611.10, totaal: 3521.10,
        status:  "Verstuurd",
        datum:   isoDate(5),
        opmerkingen: "Startdatum 1 juli 2026. Jaarcontract.",
      },
      {
        user_id: USER_ID,
        klant:   "Tuinservice Bakker",
        dienst:  "Bestrating oprit 60m²",
        bedrag:  "€ 3.673,56",
        regels:  JSON.stringify([
          { omschrijving: "Betontegels 60m²",    aantal: 60, eenheid: "m²",   prijs:  42, btw_pct: 21 },
          { omschrijving: "Grondwerk egaliseren", aantal:  8, eenheid: "uur",  prijs:  72, btw_pct: 21 },
          { omschrijving: "Afvoer puin",          aantal:  1, eenheid: "stuk", prijs: 165, btw_pct: 21 },
        ]),
        subtotaal: 3081, btw: 647.01, totaal: 3728.01,
        status:  "In afwachting",
        datum:   isoDate(2),
        opmerkingen: "",
      },
    ]),
  });

  // ── Factuur Betaald ───────────────────────────────────────────────────────
  await fetch(`${base}/facturen`, {
    method: "POST", headers: h,
    body: JSON.stringify([{
      user_id:      USER_ID,
      nummer:       "2026-001",
      klant:        "Villa Zonnedal",
      klant_email:  "info@villazonnedal.nl",
      datum:        isoDate(10),
      vervaldatum:  isoDate(3),
      regels:       JSON.stringify([
        { omschrijving: "Snoeiwerkzaamheden", aantal: 10, eenheid: "uur",  prijs: 72, btw_pct: 21 },
        { omschrijving: "Materialen",          aantal:  1, eenheid: "stuk", prijs: 85, btw_pct: 21 },
      ]),
      btw:    169.05,
      totaal: 974.05,
      status: "Betaald",
    }]),
  });

  // ── Planning — 2 items vandaag ────────────────────────────────────────────
  await fetch(`${base}/planning`, {
    method: "POST", headers: h,
    body: JSON.stringify([
      {
        user_id:    USER_ID, datum: today,
        tijd: "09:00", eindtijd: "12:00",
        klant: "Hoveniersbedrijf Van Dijk",
        dienst: "Tuinonderhoud", adres: "Tuinlaan 15, Utrecht",
        status: "Ingepland", herhaal: "", categorie: "", medewerker: "",
      },
      {
        user_id:    USER_ID, datum: today,
        tijd: "14:00", eindtijd: "15:00",
        klant: "Tuinservice Bakker",
        dienst: "Offerte opname oprit", adres: "Molenweg 8, Amsterdam",
        status: "Ingepland", herhaal: "", categorie: "", medewerker: "",
      },
    ]),
  });

  console.log("Seed data ingevoerd.");
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

// ── AI offerte mock data (voor Peters) ───────────────────────────────────────
const AI_JSON = JSON.stringify({
  dienst: "Groenaanleg bedrijfspand Peters",
  regels: [
    { omschrijving: "Gazon aanleggen 120m²",  aantal: 120, eenheid: "m²",   prijs:  18, btw_pct: 21 },
    { omschrijving: "Heesters plaatsen",       aantal:  25, eenheid: "stuk", prijs:  28, btw_pct: 21 },
    { omschrijving: "Terras bestrating 80m²",  aantal:  80, eenheid: "m²",   prijs:  38, btw_pct: 21 },
    { omschrijving: "Grondvoorbereiding",      aantal:  12, eenheid: "uur",  prijs:  72, btw_pct: 21 },
  ],
  subtotaal: 6764,
  btw:       1420.44,
  totaal:    8184.44,
  opmerkingen: "2 jaar garantie op aanleg. Materialen inclusief.",
});

// ── Main demo test ────────────────────────────────────────────────────────────
test("🎬 WerkMate demo verkoopvideo", async ({ browser }) => {
  test.setTimeout(480_000);

  // ── Setup: cleanup + seed ──────────────────────────────────────────────────
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
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ content: [{ type: "text", text: AI_JSON }] }),
      });
    } else if (body?.action === "send-offer-email") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    } else {
      await route.continue();
    }
  });

  // Capture portal_token van Peters offerte insert
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

  // ── Open app ───────────────────────────────────────────────────────────────
  await page.goto("https://app.werkmate.tech");
  await page.waitForSelector("button.nb", { timeout: 20_000 });
  await page.waitForTimeout(2000);

  // ─────────────────────────────────────────────────────────────────────────
  // 0:00–0:12  DASHBOARD — gevulde stats
  // ─────────────────────────────────────────────────────────────────────────
  const statCards = page.locator(".sc");
  const nCards    = await statCards.count();
  for (let i = 0; i < Math.min(nCards, 4); i++) {
    const box = await statCards.nth(i).boundingBox();
    if (box) await glide(page, box.x + box.width / 2, box.y + box.height / 2, 24);
    await page.waitForTimeout(700);
  }
  // Glide naar planning-sectie op dashboard
  await glide(page, 640, 540, 22);
  await page.waitForTimeout(3000);

  // ─────────────────────────────────────────────────────────────────────────
  // 0:12–0:27  PRIJSLIJST — tarieven tonen
  // ─────────────────────────────────────────────────────────────────────────
  // Via account-dropdown onderaan sidebar
  await glideTo(page, ".sb-acct-btn");
  await page.locator(".sb-acct-btn").click();
  await page.waitForTimeout(700);
  await glideTo(page, ".sb-dd-item");
  await page.locator(".sb-dd-item").filter({ hasText: /Prijslijst/i }).click();

  await page.waitForSelector(".pl-row", { timeout: 8000 });
  await page.waitForTimeout(1500);

  // Glide langs tariefregels
  const plRows = page.locator(".pl-row");
  const nRows  = await plRows.count();
  for (let i = 0; i < Math.min(nRows, 7); i++) {
    const box = await plRows.nth(i).boundingBox();
    if (box) await glide(page, box.x + box.width / 2, box.y + box.height / 2, 18);
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(5000); // 5 sec bekijken

  // ─────────────────────────────────────────────────────────────────────────
  // 0:27–0:52  KLANTEN — 3 bestaande tonen + Groenservice Peters toevoegen
  // ─────────────────────────────────────────────────────────────────────────
  await navTab(page, /klanten|crm/i);

  // Glide langs bestaande klantkaarten
  const existingCards = page.locator(".pc");
  const nExisting     = await existingCards.count();
  for (let i = 0; i < Math.min(nExisting, 3); i++) {
    const box = await existingCards.nth(i).boundingBox();
    if (box) await glide(page, box.x + box.width / 2, box.y + box.height / 2, 20);
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(1500);

  // + Klant knop
  await glideTo(page, ".ph button.btn-dark");
  await page.locator(".ph button.btn-dark").first().click();
  await page.waitForTimeout(800);

  // Groenservice Peters typen
  await slowType(page, "input[placeholder='Bedrijf of naam']",     "Groenservice Peters");
  await page.waitForTimeout(300);
  await glideTo(page, "input[placeholder='06-12345678']");
  await slowType(page, "input[placeholder='06-12345678']",          "06-55667788");
  await page.waitForTimeout(300);
  await glideTo(page, "input[placeholder='klant@email.nl']");
  await slowType(page, "input[placeholder='klant@email.nl']",       "peters@groenservice.nl");
  await page.waitForTimeout(300);
  await glideTo(page, "input[placeholder='Straat 1, Amsterdam']");
  await slowType(page, "input[placeholder='Straat 1, Amsterdam']",  "Groenstraat 12, Den Haag");
  await page.waitForTimeout(400);

  // Opslaan
  await glideTo(page, ".overlay .btn-dark.btn-full");
  await page.locator(".overlay .btn-dark.btn-full").first().click();

  await page.waitForSelector(".pc, .mob-card", { timeout: 8000 });
  await glideTo(page, ".pc:last-of-type, .mob-card:last-of-type");
  await page.waitForTimeout(3000);

  // ─────────────────────────────────────────────────────────────────────────
  // 0:52–1:12  OFFERTES — 2 bestaande + Slimme offerte voor Peters
  // ─────────────────────────────────────────────────────────────────────────
  await navTab(page, /offert/i);

  // Glide langs bestaande offertes
  await glide(page, 640, 320, 20);
  await page.waitForTimeout(2000);

  // Klik Slimme offerte
  await glideTo(page, "button.btn-ai");
  await page.locator("button.btn-ai").first().click();
  await page.waitForTimeout(1000);

  // Selecteer Peters (niet Van Dijk of Bakker)
  const klantSel = await selectByOptionText(page, "Groenservice Peters");
  await glideTo(page, ".overlay select.inp");
  await klantSel.selectOption({ label: "Groenservice Peters" });
  await page.waitForTimeout(600);

  // Type projectomschrijving voor Peters
  await glideTo(page, "textarea[placeholder*='CV ketel']");
  await slowType(
    page,
    "textarea[placeholder*='CV ketel']",
    "Groenaanleg bedrijfspand 200m2 gazon, heesters en terrasbestrating"
  );
  await page.waitForTimeout(3000);

  // ─────────────────────────────────────────────────────────────────────────
  // 1:12–1:52  AI GENEREERT — scroll door regels + totaal
  // ─────────────────────────────────────────────────────────────────────────
  await glideTo(page, "button.btn-ai.btn-full");
  await page.locator("button.btn-ai.btn-full").first().click();

  await page.waitForSelector(".tot-box", { timeout: 15_000 });
  await page.waitForTimeout(2000);

  const overlay = page.locator(".overlay").first();
  await overlay.evaluate(el => el.scrollTo({ top: 80,  behavior: "smooth" }));
  await page.waitForTimeout(1800);
  await overlay.evaluate(el => el.scrollTo({ top: 230, behavior: "smooth" }));
  await page.waitForTimeout(1800);
  await overlay.evaluate(el => el.scrollTo({ top: 400, behavior: "smooth" }));
  await page.waitForTimeout(1800);

  await glideTo(page, ".tot-box");
  await page.waitForTimeout(5000); // 5 sec op totaalbox

  // ─────────────────────────────────────────────────────────────────────────
  // 1:52–2:10  OFFERTE VERSTUREN — Opslaan & Verstuur, Mail 4 sec, WhatsApp
  // ─────────────────────────────────────────────────────────────────────────
  await overlay.evaluate(el => el.scrollTo({ top: 9999, behavior: "smooth" }));
  await page.waitForTimeout(800);
  await glideTo(page, "button.btn-ai:not(.btn-full)");
  await page.locator("button.btn-ai:not(.btn-full)").first().click();

  // Wacht tot offerte in lijst
  await page.waitForSelector(".off-tbl-row.mob-hide, .mob-card", { timeout: 10_000 });
  await page.waitForTimeout(1500);

  // Mail knop — native alert 4 sec zichtbaar
  page.once("dialog", async dialog => {
    await new Promise<void>(res => setTimeout(res, 4000));
    await dialog.accept();
  });
  await glideTo(page, ".btn-blue.btn-sm");
  await page.locator(".btn-blue.btn-sm").first().click();
  await page.waitForTimeout(5500);

  // WhatsApp hover
  await glideTo(page, ".btn-green.btn-sm");
  await page.locator(".btn-green.btn-sm").first().hover();
  await page.waitForTimeout(3000);

  // ── Portal sign + status patch (achtergrond) ───────────────────────────────
  if (capturedPortalToken) {
    await portalSign(jwt, capturedPortalToken);
    await patchOfferteStatus(jwt, capturedPortalToken, "Ondertekend");
  } else {
    console.warn("portal_token niet gevangen — factuur wordt niet aangemaakt");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2:10–2:22  STATUS ONDERTEKEND — in lijst
  // ─────────────────────────────────────────────────────────────────────────
  await navTab(page, /offert/i);

  await page.waitForSelector(".badge", { timeout: 8000 });
  await glideTo(page, ".badge");
  await page.waitForTimeout(3000);

  // ─────────────────────────────────────────────────────────────────────────
  // 2:22–2:37  FINANCIËN — factuur automatisch aangemaakt
  // ─────────────────────────────────────────────────────────────────────────
  await navTab(page, /financ/i);

  await page.waitForSelector(".f-row, .tw tbody tr", { timeout: 10_000 });
  await page.waitForTimeout(1000);

  await glide(page, 640, 360, 22);
  await page.waitForTimeout(2000);
  await glide(page, 900, 360, 18);
  await page.waitForTimeout(5000);

  // ─────────────────────────────────────────────────────────────────────────
  // 2:37–2:52  PLANNING — afspraak Peters + weekoverzicht
  // ─────────────────────────────────────────────────────────────────────────
  await navTab(page, /planning/i);
  await page.waitForSelector(".cal-grid, .cal-wg-outer", { timeout: 8000 });

  await glideTo(page, ".ph button.btn-dark");
  await page.locator(".ph button.btn-dark").last().click();
  await page.waitForTimeout(800);

  const planKlant = await selectByOptionText(page, "Groenservice Peters");
  await glideTo(page, ".overlay select.inp");
  await planKlant.selectOption({ label: "Groenservice Peters" });
  await page.waitForTimeout(500);

  await glideTo(page, "input[placeholder='Wat ga je doen?']");
  await slowType(page, "input[placeholder='Wat ga je doen?']", "Startopname groenaanleg");
  await page.waitForTimeout(500);

  await glideTo(page, ".overlay .btn-dark.btn-full");
  await page.locator(".overlay .btn-dark.btn-full").first().click();
  await page.waitForTimeout(1500);

  // Weekoverzicht — 3 planning items zichtbaar
  await page.locator(".cal-vt-btn:has-text('Week')").click();
  await page.waitForTimeout(1500);

  await glide(page, 640, 440, 22);
  await page.waitForTimeout(1000);

  const taskBlk = page.locator(".cal-task-blk").first();
  if (await taskBlk.isVisible().catch(() => false)) {
    await glideTo(page, ".cal-task-blk");
    await page.waitForTimeout(1500);
  }

  await glideTo(page, "button:has-text('🏷️')");
  await page.locator("button:has-text('🏷️')").hover();
  await page.waitForTimeout(2000);

  // ─────────────────────────────────────────────────────────────────────────
  // 2:52–3:12  BOEKHOUDING TOUR
  // ─────────────────────────────────────────────────────────────────────────
  await navTab(page, /financ/i);
  await page.waitForTimeout(1000);

  await glideTo(page, "button:has-text('📊 BTW')");
  await page.locator("button:has-text('📊 BTW')").click();
  await page.waitForTimeout(4000);

  await glideTo(page, "button:has-text('💳 Uitgaven')");
  await page.locator("button:has-text('💳 Uitgaven')").click();
  await page.waitForTimeout(4000);

  await glideTo(page, "button.btn-ghost");
  await page.locator("button.btn-ghost").filter({ hasText: /Scan/i }).first().hover();
  await page.waitForTimeout(2000);

  await glideTo(page, "button:has-text('📈 Winst')");
  await page.locator("button:has-text('📈 Winst')").click();
  await page.waitForTimeout(4000);

  await glideTo(page, "button:has-text('📄 Facturen')");
  await page.locator("button:has-text('📄 Facturen')").click();
  await page.waitForTimeout(3000);

  // Sluit context → video opgeslagen in demo-videos/
  await context.close();
});
