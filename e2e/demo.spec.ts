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

import { test, Page, BrowserContext } from "@playwright/test";
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
  if (!box) { console.warn(`  glideTo: geen boundingBox voor "${selector}"`); return; }
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

/** Navigeert via sidebar-knop; wacht 2 sec zodat content laadt */
async function navTab(page: Page, nameRe: RegExp) {
  console.log(`  navTab: ${nameRe}`);
  const btn = page.locator("button.nb", { hasText: nameRe }).first();
  await btn.waitFor({ state: "visible", timeout: 10_000 });
  await btn.click();
  await page.waitForTimeout(2000);
}

async function pause(page: Page, ms: number, label?: string) {
  console.log(`  ⏸ ${ms}ms${label ? " — " + label : ""}`);
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
  for (const tbl of ["facturen","offertes","werkbonnen","planning","ritten","uitgaven","klanten"]) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/${tbl}?user_id=eq.${USER_ID}`,
      { method: "DELETE", headers }
    );
    console.log(`  cleanup ${tbl}: ${r.status}`);
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

  const r1 = await fetch(`${base}/klanten`, {
    method: "POST", headers: h,
    body: JSON.stringify([
      { user_id: USER_ID, naam: "Hoveniersbedrijf Van Dijk", tel: "06-12345678", email: "vandijk@hoveniers.nl",   adres: "Tuinlaan 15, Utrecht"  },
      { user_id: USER_ID, naam: "Tuinservice Bakker",         tel: "06-87654321", email: "bakker@tuinservice.nl", adres: "Molenweg 8, Amsterdam"  },
      { user_id: USER_ID, naam: "Villa Zonnedal",             tel: "06-11223344", email: "info@villazonnedal.nl", adres: "Zonneweg 3, Rotterdam"  },
    ]),
  });
  console.log(`  seed klanten: ${r1.status}`);

  const r2 = await fetch(`${base}/offertes`, {
    method: "POST", headers: h,
    body: JSON.stringify([
      {
        user_id: USER_ID, klant: "Hoveniersbedrijf Van Dijk",
        dienst: "Jaarcontract tuinonderhoud", bedrag: "€ 3.446,08",
        regels: JSON.stringify([
          { omschrijving: "Tuinonderhoud",   aantal: 12, eenheid: "maand", prijs: 220, btw_pct: 21 },
          { omschrijving: "Snoeiwerk",       aantal:  4, eenheid: "uur",   prijs:  52, btw_pct: 21 },
        ]),
        subtotaal: 2848, btw: 598.08, totaal: 3446.08,
        status: "Verstuurd", datum: isoDate(5),
        opmerkingen: "Jaarcontract 2026–2027.",
      },
      {
        user_id: USER_ID, klant: "Tuinservice Bakker",
        dienst: "Bestrating oprit 60m²", bedrag: "€ 2.904,00",
        regels: JSON.stringify([
          { omschrijving: "Bestrating vernieuwen", aantal: 60, eenheid: "m²",   prijs:  35, btw_pct: 21 },
          { omschrijving: "Grondwerk egaliseren",  aantal:  8, eenheid: "uur",  prijs:  55, btw_pct: 21 },
        ]),
        subtotaal: 2540, btw: 533.4, totaal: 3073.4,
        status: "In afwachting", datum: isoDate(2), opmerkingen: "",
      },
    ]),
  });
  console.log(`  seed offertes: ${r2.status}`);

  const r3 = await fetch(`${base}/facturen`, {
    method: "POST", headers: h,
    body: JSON.stringify([{
      user_id: USER_ID, nummer: "2026-001",
      klant: "Villa Zonnedal", klant_email: "info@villazonnedal.nl",
      datum: isoDate(10), vervaldatum: isoDate(3),
      regels: JSON.stringify([
        { omschrijving: "Snoeiwerk",          aantal: 6, eenheid: "uur",  prijs: 52, btw_pct: 21 },
        { omschrijving: "Beplanting leveren", aantal: 8, eenheid: "stuk", prijs: 18, btw_pct: 21 },
      ]),
      btw: 98.49, totaal: 554.49, status: "Betaald",
    }]),
  });
  console.log(`  seed facturen: ${r3.status}`);

  const r4 = await fetch(`${base}/planning`, {
    method: "POST", headers: h,
    body: JSON.stringify([
      { user_id: USER_ID, datum: today, tijd: "09:00", eindtijd: "12:00",
        klant: "Hoveniersbedrijf Van Dijk", dienst: "Tuinonderhoud",
        adres: "Tuinlaan 15, Utrecht", status: "Ingepland", herhaal: "", categorie: "", medewerker: "" },
      { user_id: USER_ID, datum: today, tijd: "14:00", eindtijd: "15:30",
        klant: "Tuinservice Bakker", dienst: "Offerte opname oprit",
        adres: "Molenweg 8, Amsterdam", status: "Ingepland", herhaal: "", categorie: "", medewerker: "" },
    ]),
  });
  console.log(`  seed planning: ${r4.status}`);
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
  console.log(`  portal-sign: ${r.status}`);
  return r.ok;
}

async function patchOfferteStatus(jwt: string, token: string, status: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/offertes?portal_token=eq.${token}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${jwt}`,
      "apikey":        ANON_KEY,
      "Content-Type":  "application/json",
      "Prefer":        "return=minimal",
    },
    body: JSON.stringify({ status }),
  });
  console.log(`  patch offerte status → ${status}: ${r.status}`);
}

// Regels matchen exact de prijslijst-tarieven voor tuinieren:
// Tuinonderhoud €55/uur · Bestrating vernieuwen €35/m² · Snoeiwerk €52/uur
const AI_JSON = JSON.stringify({
  dienst: "Groenaanleg en onderhoud bedrijfspand Groenservice Peters",
  regels: [
    { omschrijving: "Tuinonderhoud",         aantal:  5, eenheid: "uur", prijs: 55, btw_pct: 21 },
    { omschrijving: "Bestrating vernieuwen", aantal: 20, eenheid: "m²",  prijs: 35, btw_pct: 21 },
    { omschrijving: "Snoeiwerk",             aantal:  3, eenheid: "uur", prijs: 52, btw_pct: 21 },
  ],
  subtotaal: 1131,   // 5×55 + 20×35 + 3×52 = 275+700+156
  btw:        237.51,
  totaal:    1368.51,
  opmerkingen: "Tarieven conform uw prijslijst. Uitvoering binnen 2 weken.",
});

// ── Main demo test ────────────────────────────────────────────────────────────
test("🎬 WerkMate demo verkoopvideo", async ({ browser }) => {
  test.setTimeout(600_000);

  console.log("=== DEMO START ===");

  // ── Setup (buiten browser, voor video begint) ─────────────────────────────
  console.log("STAP: getJwt");
  const jwt = getJwt();
  console.log("STAP: cleanup");
  await cleanupDemoData(jwt);
  console.log("STAP: seed");
  await seedDemoData(jwt);

  // ── Browser context + video ────────────────────────────────────────────────
  console.log("STAP: browser.newContext");
  let context: BrowserContext | undefined;
  let capturedPortalToken: string | null = null;

  try {
    context = await browser.newContext({
      viewport:     { width: 1280, height: 800 },
      storageState: "e2e/.auth/session.json",
      recordVideo:  { dir: "demo-videos/", size: { width: 1280, height: 800 } },
    });

    console.log("STAP: newPage");
    const page = await context.newPage();
    page.setDefaultTimeout(30_000);

    // Log browser-side errors zodat we zien wat mis gaat
    page.on("console", msg => {
      if (msg.type() === "error") console.error("  [browser error]", msg.text());
    });
    page.on("pageerror", err => console.error("  [page error]", err.message));

    // ── Route mocks ──────────────────────────────────────────────────────────
    console.log("STAP: routes instellen");

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

    // ── BUGFIX: gebruik route.continue() voor GETs; alleen POSTs onderscheppen ─
    await context.route("**/rest/v1/offertes*", async (route, request) => {
      if (request.method() !== "POST") {
        // Laat GETs/PATCHes/DELETEs gewoon door — GEEN route.fetch() aanroepen
        await route.continue();
        return;
      }
      // POST: onderschep voor portal_token
      try {
        const response = await route.fetch();
        const text     = await response.text();
        if (!capturedPortalToken) {
          try {
            const json = JSON.parse(text);
            const pt   = Array.isArray(json) ? json[0]?.portal_token : json?.portal_token;
            if (pt) { capturedPortalToken = pt; console.log("  portal_token gevangen:", pt.slice(0, 8) + "…"); }
          } catch { /* lege response of geen portal_token */ }
        }
        await route.fulfill({ response, body: text });
      } catch (err) {
        console.error("  [route/offertes POST fout]", err);
        await route.continue(); // val terug op normale request
      }
    });

    // ── Open app ──────────────────────────────────────────────────────────────
    console.log("STAP: page.goto");
    await page.goto("https://app.werkmate.tech");

    console.log("STAP: waitForSelector button.nb");
    await page.waitForSelector("button.nb", { timeout: 20_000 });
    console.log("  button.nb gevonden — app geladen");
    await pause(page, 2000, "app geladen");

    // ═════════════════════════════════════════════════════════════════════════
    // 0:00–0:18  DASHBOARD
    // ═════════════════════════════════════════════════════════════════════════
    console.log("STAP: DASHBOARD");

    const statCards = page.locator(".sc");
    const nCards    = await statCards.count();
    console.log(`  stat cards: ${nCards}`);
    for (let i = 0; i < Math.min(nCards, 4); i++) {
      const box = await statCards.nth(i).boundingBox();
      if (box) await glide(page, box.x + box.width / 2, box.y + box.height / 2, 24);
      await pause(page, 800);
    }

    await glide(page, 640, 480, 22);
    await pause(page, 1000);
    await glide(page, 640, 580, 18);
    await pause(page, 4000, "dashboard-overzicht");

    // ═════════════════════════════════════════════════════════════════════════
    // 0:18–0:48  KLANTEN — 3 bestaande + Peters toevoegen
    // ═════════════════════════════════════════════════════════════════════════
    console.log("STAP: KLANTEN — navTab");
    await navTab(page, /klanten|crm/i);

    const klantCards = page.locator(".pc");
    const nKlanten   = await klantCards.count();
    console.log(`  klantkaarten: ${nKlanten}`);
    for (let i = 0; i < Math.min(nKlanten, 3); i++) {
      const box = await klantCards.nth(i).boundingBox();
      if (box) await glide(page, box.x + box.width / 2, box.y + box.height / 2, 22);
      await pause(page, 900);
    }
    await pause(page, 2500, "bestaande klanten bekijken");

    console.log("STAP: klant toevoegen — klik +");
    await glideTo(page, ".ph button.btn-dark");
    await page.locator(".ph button.btn-dark").first().click();
    await pause(page, 900);

    console.log("STAP: typ naam Peters");
    await slowType(page, "input[placeholder='Bedrijf of naam']", "Groenservice Peters");
    await pause(page, 600);

    console.log("STAP: typ telefoon");
    await slowType(page, "input[placeholder='06-12345678']", "06-55667788");
    await pause(page, 600);

    console.log("STAP: typ email");
    await slowType(page, "input[placeholder='klant@email.nl']", "peters@groenservice.nl");
    await pause(page, 600);

    console.log("STAP: typ adres");
    await slowType(page, "input[placeholder='Straat 1, Amsterdam']", "Groenstraat 12, Den Haag");
    await pause(page, 700);

    console.log("STAP: opslaan klant");
    await glideTo(page, ".overlay .btn-dark.btn-full");
    await page.locator(".overlay .btn-dark.btn-full").first().click();
    await page.waitForSelector(".pc", { timeout: 8000 });
    console.log("  klant opgeslagen");

    const allCards = page.locator(".pc");
    const lastBox  = await allCards.last().boundingBox();
    if (lastBox) await glide(page, lastBox.x + lastBox.width / 2, lastBox.y + lastBox.height / 2, 22);
    await pause(page, 3000, "Peters-kaart zichtbaar");

    // ═════════════════════════════════════════════════════════════════════════
    // 0:48–1:05  PRIJSLIJST — tarieven bekijken
    // ═════════════════════════════════════════════════════════════════════════
    console.log("STAP: PRIJSLIJST — account dropdown");
    await glideTo(page, ".sb-acct-btn");
    await page.locator(".sb-acct-btn").click();
    await pause(page, 700);

    console.log("STAP: klik Prijslijst item");
    await glideTo(page, ".sb-dd-item");
    await page.locator(".sb-dd-item").filter({ hasText: /Prijslijst/i }).click();

    console.log("STAP: wacht op .pl-row");
    await page.waitForSelector(".pl-row", { timeout: 8000 });
    await pause(page, 1500, "prijslijst geladen");

    const plRows = page.locator(".pl-row");
    const nRows  = await plRows.count();
    console.log(`  prijslijst rijen: ${nRows}`);
    for (let i = 0; i < Math.min(nRows, 8); i++) {
      const box = await plRows.nth(i).boundingBox();
      if (box) await glide(page, box.x + box.width / 2, box.y + box.height / 2, 16);
      await pause(page, 400);
    }
    await pause(page, 8000, "tarieven bekijken");

    // ═════════════════════════════════════════════════════════════════════════
    // 1:05–1:28  OFFERTES — 2 bestaande + Slimme offerte Peters
    // ═════════════════════════════════════════════════════════════════════════
    console.log("STAP: OFFERTES — navTab");
    await navTab(page, /offert/i);

    await glide(page, 640, 300, 20);
    await pause(page, 1500);
    await glide(page, 640, 420, 18);
    await pause(page, 2500, "bestaande offertes");

    console.log("STAP: Slimme offerte — klik btn-ai");
    await glideTo(page, "button.btn-ai");
    await pause(page, 800);
    await page.locator("button.btn-ai").first().click();
    await pause(page, 1000, "AI modal open");

    console.log("STAP: selecteer Peters in klantdropdown");
    // Selecteer Peters via de select in de overlay
    const klantSelect = page.locator(".overlay select").first();
    await klantSelect.waitFor({ state: "visible", timeout: 8000 });
    await klantSelect.selectOption({ label: "Groenservice Peters" });
    await pause(page, 700);

    console.log("STAP: typ omschrijving (prijslijst-diensten)");
    await glideTo(page, "textarea");
    await slowType(
      page,
      "textarea",
      "Tuinonderhoud 5 uur, Bestrating vernieuwen 20m2, Snoeiwerk 3 uur"
    );
    await pause(page, 3500, "omschrijving klaar");

    // ═════════════════════════════════════════════════════════════════════════
    // 1:28–2:05  AI GENEREERT
    // ═════════════════════════════════════════════════════════════════════════
    console.log("STAP: klik Genereer");
    await glideTo(page, "button.btn-ai.btn-full");
    await page.locator("button.btn-ai.btn-full").first().click();

    console.log("STAP: wacht op .tot-box");
    await page.waitForSelector(".tot-box", { timeout: 15_000 });
    console.log("  tot-box gevonden");
    await pause(page, 2500, "AI resultaat geladen");

    const overlay = page.locator(".overlay").first();

    console.log("STAP: scroll door regels");
    await overlay.evaluate(el => el.scrollTo({ top: 80,  behavior: "smooth" }));
    await pause(page, 2500);
    await overlay.evaluate(el => el.scrollTo({ top: 200, behavior: "smooth" }));
    await pause(page, 2500);

    // Glide langs de regels — kijker herkent Tuinonderhoud/Bestrating/Snoeiwerk
    const regels = overlay.locator("tr, [class*='row']").filter({ hasText: /uur|m²|stuk/i });
    const nRegels = await regels.count();
    console.log(`  offerte-regels: ${nRegels}`);
    for (let i = 0; i < Math.min(nRegels, 3); i++) {
      const box = await regels.nth(i).boundingBox();
      if (box) await glide(page, box.x + box.width / 2, box.y + box.height / 2, 20);
      await pause(page, 1800);
    }

    await overlay.evaluate(el => el.scrollTo({ top: 9999, behavior: "smooth" }));
    await pause(page, 2000);

    console.log("STAP: glide naar totaalbox");
    await glideTo(page, ".tot-box");
    await pause(page, 10000, "totaal €1.368,51 zichtbaar");

    // ═════════════════════════════════════════════════════════════════════════
    // 2:05–2:20  VERSTUREN
    // ═════════════════════════════════════════════════════════════════════════
    console.log("STAP: Opslaan & Verstuur");
    await glideTo(page, "button.btn-ai:not(.btn-full)");
    await page.locator("button.btn-ai:not(.btn-full)").first().click();

    console.log("STAP: wacht op offerte in lijst");
    await page.waitForSelector(".off-tbl-row.mob-hide, .mob-card", { timeout: 10_000 });
    await pause(page, 1500);

    console.log("STAP: mail knop — native alert 4s");
    page.once("dialog", async dialog => {
      await new Promise<void>(res => setTimeout(res, 4000));
      await dialog.accept();
    });
    await glideTo(page, ".btn-blue.btn-sm");
    await page.locator(".btn-blue.btn-sm").first().click();
    await pause(page, 5500, "mail-alert 4s zichtbaar");

    console.log("STAP: WhatsApp hover");
    await glideTo(page, ".btn-green.btn-sm");
    await page.locator(".btn-green.btn-sm").first().hover();
    await pause(page, 3000, "WhatsApp knop");  // 1s korter dan eerder

    // Portal-sign (achtergrond)
    if (capturedPortalToken) {
      console.log("STAP: portal-sign");
      await portalSign(jwt, capturedPortalToken);
      await patchOfferteStatus(jwt, capturedPortalToken, "Ondertekend");
    } else {
      console.warn("  [WARN] portal_token niet gevangen — badge mogelijk niet zichtbaar");
    }

    // ═════════════════════════════════════════════════════════════════════════
    // ONDERTEKEND — badge zichtbaar
    // ═════════════════════════════════════════════════════════════════════════
    console.log("STAP: OFFERTES — Ondertekend badge");
    await navTab(page, /offert/i);
    const badge = page.locator(".badge").first();
    await badge.waitFor({ state: "visible", timeout: 8000 }).catch(() => {
      console.warn("  [WARN] badge niet zichtbaar — door");
    });
    await glideTo(page, ".badge");
    await pause(page, 4000, "Ondertekend badge");

    // ═════════════════════════════════════════════════════════════════════════
    // PLANNING — Peters' afspraak toevoegen + tonen (5s)
    // ═════════════════════════════════════════════════════════════════════════
    console.log("STAP: PLANNING — navTab");
    await navTab(page, /planning/i);
    await page.waitForSelector(".cal-grid, .cal-wg-outer", { timeout: 8000 }).catch(() => {
      console.warn("  [WARN] kalender niet gevonden");
    });

    console.log("STAP: planning — + Opdracht");
    await glideTo(page, ".ph button.btn-dark");
    await page.locator(".ph button.btn-dark").last().click();
    await pause(page, 800);

    // Klant selecteren — de 3e select in het formulier (Categorie, Medewerker, Klant)
    const planKlantSelect = page.locator(".overlay select").filter({
      has: page.locator("option", { hasText: /Kies klant/i }),
    }).first();
    await planKlantSelect.waitFor({ state: "visible", timeout: 8000 }).catch(() => {
      console.warn("  [WARN] planning klantselect niet gevonden");
    });
    await planKlantSelect.selectOption({ value: "Groenservice Peters" }).catch(() => {
      console.warn("  [WARN] Peters niet in planning dropdown");
    });
    await pause(page, 500);

    console.log("STAP: typ dienst planning");
    await glideTo(page, "input[placeholder='Wat ga je doen?']");
    await slowType(page, "input[placeholder='Wat ga je doen?']", "Startopname groenaanleg");
    await pause(page, 600);

    console.log("STAP: planning opslaan");
    await glideTo(page, ".overlay .btn-dark.btn-full");
    await page.locator(".overlay .btn-dark.btn-full").first().click();
    await pause(page, 1500);

    // Weekoverzicht — toon Peters' afspraak
    const weekBtn = page.locator(".cal-vt-btn:has-text('Week')");
    if (await weekBtn.isVisible().catch(() => false)) {
      await weekBtn.click();
      await pause(page, 1200);
    }
    await glide(page, 640, 440, 22);
    await pause(page, 800);

    const taskBlk = page.locator(".cal-task-blk").first();
    if (await taskBlk.isVisible().catch(() => false)) {
      await glideTo(page, ".cal-task-blk");
    }
    await pause(page, 5000, "afspraak Peters zichtbaar");

    // ═════════════════════════════════════════════════════════════════════════
    // FINANCIËN — Facturen → Peters' factuur (5s)
    // ═════════════════════════════════════════════════════════════════════════
    console.log("STAP: FINANCIËN — navTab");
    await navTab(page, /financ/i);

    console.log("STAP: Facturen tab");
    await glideTo(page, "button:has-text('📄 Facturen')");
    await page.locator("button:has-text('📄 Facturen')").click();
    await page.waitForSelector(".f-row, .tw tbody tr", { timeout: 10_000 }).catch(() => {
      console.warn("  [WARN] geen factuurrows gevonden");
    });
    await pause(page, 800);

    // Scroll naar de Peters-factuur (meest recent, onderaan)
    const factuurRows = page.locator(".f-row, .tw tbody tr");
    const nFacturen   = await factuurRows.count();
    if (nFacturen > 0) {
      const lastRow = await factuurRows.last().boundingBox();
      if (lastRow) await glide(page, lastRow.x + lastRow.width / 2, lastRow.y + lastRow.height / 2, 20);
    }
    await pause(page, 5000, "Peters factuur zichtbaar");

    // ═════════════════════════════════════════════════════════════════════════
    // Uitgaven tab (5s)
    // ═════════════════════════════════════════════════════════════════════════
    console.log("STAP: Uitgaven tab");
    await glideTo(page, "button:has-text('💳 Uitgaven')");
    await page.locator("button:has-text('💳 Uitgaven')").click();
    await pause(page, 5000, "Uitgaven-overzicht");

    // ═════════════════════════════════════════════════════════════════════════
    // BTW tab (5s)
    // ═════════════════════════════════════════════════════════════════════════
    console.log("STAP: BTW tab");
    await glideTo(page, "button:has-text('📊 BTW')");
    await page.locator("button:has-text('📊 BTW')").click();
    await pause(page, 5000, "BTW-overzicht");

    // ═════════════════════════════════════════════════════════════════════════
    // Winst tab (5s)
    // ═════════════════════════════════════════════════════════════════════════
    console.log("STAP: Winst tab");
    await glideTo(page, "button:has-text('📈 Winst')");
    await page.locator("button:has-text('📈 Winst')").click();
    await pause(page, 5000, "Winst-grafiek");

    // ═════════════════════════════════════════════════════════════════════════
    // Ritten tab — rittenregistratie (5s)
    // ═════════════════════════════════════════════════════════════════════════
    console.log("STAP: Ritten tab");
    await glideTo(page, "button:has-text('🚗 Ritten')");
    await page.locator("button:has-text('🚗 Ritten')").click();
    await pause(page, 1000);
    await glide(page, 640, 400, 22);
    await pause(page, 5000, "Rittenregistratie zichtbaar");

    // ═════════════════════════════════════════════════════════════════════════
    // Einde op Dashboard
    // ═════════════════════════════════════════════════════════════════════════
    console.log("STAP: terug naar Dashboard");
    await navTab(page, /dashboard/i);
    await glide(page, 640, 350, 22);
    await pause(page, 3000, "einde — dashboard");

    console.log("=== DEMO COMPLEET ===");

  } finally {
    // Context sluiten triggert video-opslag — altijd uitvoeren, ook bij fout
    if (context) {
      console.log("STAP: context.close() — video opslaan");
      await context.close();
      console.log("  video opgeslagen in demo-videos/");
    }
  }
});
