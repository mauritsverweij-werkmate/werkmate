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
    console.log(`cleanup ${tbl}: ${r.status}`);
  }
}

async function portalSign(jwt: string, token: string): Promise<boolean> {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/ai-proxy`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      action:       "portal-sign",
      portal_token: token,
      handtekening: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=",
      klant_email:  "vandijk@gmail.com",
      klant_naam:   "Hoveniersbedrijf Van Dijk",
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

// ── AI offerte mock data ──────────────────────────────────────────────────────
const AI_JSON = JSON.stringify({
  dienst: "Tuinaanleg Villa Zonnedal",
  regels: [
    { omschrijving: "Bestrating 80m²",        aantal: 80, eenheid: "m²",   prijs:  38, btw_pct: 21 },
    { omschrijving: "Borders aanleggen",       aantal: 16, eenheid: "uur",  prijs:  72, btw_pct: 21 },
    { omschrijving: "Beplanting en graszaad",  aantal:  1, eenheid: "stuk", prijs: 890, btw_pct: 21 },
    { omschrijving: "Grondwerk en afvoer",     aantal:  8, eenheid: "uur",  prijs:  72, btw_pct: 21 },
  ],
  subtotaal: 5242,
  btw:       1100.82,
  totaal:    6342.82,
  opmerkingen: "2 jaar garantie op aanleg en materialen.",
});

// ── Main demo test ────────────────────────────────────────────────────────────
test("🎬 WerkMate demo verkoopvideo", async ({ browser }) => {
  test.setTimeout(420_000);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const jwt = getJwt();
  console.log("Cleaning up demo data…");
  await cleanupDemoData(jwt);
  console.log("Cleanup done.");

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

  // AI offerte + email send mocks
  await context.route("**/functions/v1/ai-proxy", async (route, request) => {
    const body = request.postDataJSON() as Record<string, unknown>;
    if (body?.action === "ai-offerte") {
      await route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ content: [{ type: "text", text: AI_JSON }] }),
      });
    } else if (body?.action === "send-offer-email") {
      await route.fulfill({
        status:      200,
        contentType: "application/json",
        body:        JSON.stringify({ ok: true }),
      });
    } else {
      await route.continue();
    }
  });

  // Capture portal_token from offerte POST response
  await context.route("**/rest/v1/offertes*", async (route, request) => {
    const response = await route.fetch();
    if (request.method() === "POST" && !capturedPortalToken) {
      const text = await response.text();
      try {
        const json = JSON.parse(text);
        const pt   = Array.isArray(json) ? json[0]?.portal_token : json?.portal_token;
        if (pt) { capturedPortalToken = pt; console.log("portal_token captured:", pt); }
      } catch { /* ignore */ }
      await route.fulfill({ response, body: text });
    } else {
      await route.fulfill({ response });
    }
  });

  // ── Navigate to app ────────────────────────────────────────────────────────
  await page.goto("http://localhost:5173");
  await page.waitForSelector("button.nb", { timeout: 15_000 });
  await page.waitForTimeout(1500);

  // ─────────────────────────────────────────────────────────────────────────
  // 0:00–0:10  DASHBOARD
  // ─────────────────────────────────────────────────────────────────────────
  const statCards = page.locator(".sc");
  const nCards    = await statCards.count();
  for (let i = 0; i < Math.min(nCards, 4); i++) {
    const box = await statCards.nth(i).boundingBox();
    if (box) await glide(page, box.x + box.width / 2, box.y + box.height / 2, 22);
    await page.waitForTimeout(600);
  }
  await glide(page, 640, 520, 22);
  await page.waitForTimeout(3000);

  // ─────────────────────────────────────────────────────────────────────────
  // 0:10–0:35  KLANTEN — Hoveniersbedrijf Van Dijk toevoegen
  // ─────────────────────────────────────────────────────────────────────────
  await navTab(page, /klanten|crm/i);

  await glideTo(page, ".ph button.btn-dark");
  await page.locator(".ph button.btn-dark").first().click();
  await page.waitForTimeout(800);

  await slowType(page, "input[placeholder='Bedrijf of naam']", "Hoveniersbedrijf Van Dijk");
  await page.waitForTimeout(350);
  await glideTo(page, "input[placeholder='06-12345678']");
  await slowType(page, "input[placeholder='06-12345678']", "06-12345678");
  await page.waitForTimeout(350);
  await glideTo(page, "input[placeholder='klant@email.nl']");
  await slowType(page, "input[placeholder='klant@email.nl']", "vandijk@gmail.com");
  await page.waitForTimeout(350);
  await glideTo(page, "input[placeholder='Straat 1, Amsterdam']");
  await slowType(page, "input[placeholder='Straat 1, Amsterdam']", "Utrecht");
  await page.waitForTimeout(500);

  await glideTo(page, ".overlay .btn-dark.btn-full");
  await page.locator(".overlay .btn-dark.btn-full").first().click();

  await page.waitForSelector(".pc, .mob-card", { timeout: 8000 });
  await glideTo(page, ".pc, .mob-card");
  await page.waitForTimeout(3000);

  // ─────────────────────────────────────────────────────────────────────────
  // 0:35–0:55  OFFERTES — Slimme offerte opstarten
  // ─────────────────────────────────────────────────────────────────────────
  await navTab(page, /offert/i);

  await glide(page, 640, 350, 20);
  await page.waitForTimeout(2000);

  await glideTo(page, "button.btn-ai");
  await page.locator("button.btn-ai").first().click();
  await page.waitForTimeout(1000);

  // Klant selecteren
  const klantSel = await selectByOptionText(page, "Hoveniersbedrijf Van Dijk");
  await glideTo(page, ".overlay select.inp");
  await klantSel.selectOption({ label: "Hoveniersbedrijf Van Dijk" });
  await page.waitForTimeout(600);

  // Projectomschrijving typen
  await glideTo(page, "textarea[placeholder*='CV ketel']");
  await slowType(
    page,
    "textarea[placeholder*='CV ketel']",
    "Volledige tuinaanleg 80m2 bestrating, borders en beplanting"
  );
  await page.waitForTimeout(3000);

  // ─────────────────────────────────────────────────────────────────────────
  // 0:55–1:35  AI GENEREERT — scroll door regels + totaal
  // ─────────────────────────────────────────────────────────────────────────
  await glideTo(page, "button.btn-ai.btn-full");
  await page.locator("button.btn-ai.btn-full").first().click();

  await page.waitForSelector(".tot-box", { timeout: 15_000 });
  await page.waitForTimeout(2000);

  // Scroll langzaam door offerte regels
  const overlay = page.locator(".overlay").first();
  await overlay.evaluate(el => el.scrollTo({ top: 80, behavior: "smooth" }));
  await page.waitForTimeout(1800);
  await overlay.evaluate(el => el.scrollTo({ top: 220, behavior: "smooth" }));
  await page.waitForTimeout(1800);
  await overlay.evaluate(el => el.scrollTo({ top: 380, behavior: "smooth" }));
  await page.waitForTimeout(1800);

  // Hover totaalbox
  await glideTo(page, ".tot-box");
  await page.waitForTimeout(5000);

  // ─────────────────────────────────────────────────────────────────────────
  // 1:35–1:55  OFFERTE VERSTUREN — Mail alert + WhatsApp hover
  // ─────────────────────────────────────────────────────────────────────────
  // Scroll naar beneden voor Opslaan & Verstuur knop
  await overlay.evaluate(el => el.scrollTo({ top: 9999, behavior: "smooth" }));
  await page.waitForTimeout(800);
  await glideTo(page, "button.btn-ai:not(.btn-full)");
  await page.locator("button.btn-ai:not(.btn-full)").first().click();

  // Wacht tot offerte in lijst verschijnt
  await page.waitForSelector(".off-tbl-row.mob-hide, .mob-card", { timeout: 10_000 });
  await page.waitForTimeout(1500);

  // Klik Mail knop — native alert zichtbaar gedurende 4 sec
  page.once("dialog", async dialog => {
    await new Promise<void>(res => setTimeout(res, 4000));
    await dialog.accept();
  });
  await glideTo(page, ".btn-blue.btn-sm");
  await page.locator(".btn-blue.btn-sm").first().click();
  await page.waitForTimeout(5500); // wacht tot dialog geaccepteerd en pagina stabiel

  // Hover WhatsApp knop
  await glideTo(page, ".btn-green.btn-sm");
  await page.locator(".btn-green.btn-sm").first().hover();
  await page.waitForTimeout(3000);

  // ── Achtergrond: portal-sign → factuur aanmaken + status patchen ──────────
  if (capturedPortalToken) {
    await portalSign(jwt, capturedPortalToken);
    await patchOfferteStatus(jwt, capturedPortalToken, "Ondertekend");
  } else {
    console.warn("portal_token niet gevangen — factuur wordt niet aangemaakt");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 1:55–2:10  STATUS ONDERTEKEND — zichtbaar in offertes lijst
  // ─────────────────────────────────────────────────────────────────────────
  await navTab(page, /offert/i);

  await page.waitForSelector(".badge", { timeout: 8000 });
  await glideTo(page, ".badge");
  await page.waitForTimeout(3000);

  // ─────────────────────────────────────────────────────────────────────────
  // 2:10–2:25  FINANCIËN — factuur automatisch aangemaakt
  // ─────────────────────────────────────────────────────────────────────────
  await navTab(page, /financ/i);

  await page.waitForSelector(".f-row, .tw tbody tr", { timeout: 10_000 });
  await page.waitForTimeout(1000);

  await glide(page, 640, 360, 22);
  await page.waitForTimeout(2000);
  await glide(page, 900, 360, 18);
  await page.waitForTimeout(5000);

  // ─────────────────────────────────────────────────────────────────────────
  // 2:25–2:40  PLANNING — afspraak toevoegen + weekoverzicht
  // ─────────────────────────────────────────────────────────────────────────
  await navTab(page, /planning/i);
  await page.waitForSelector(".cal-grid, .cal-wg-outer", { timeout: 8000 });

  // + Opdracht knop
  await glideTo(page, ".ph button.btn-dark");
  await page.locator(".ph button.btn-dark").last().click();
  await page.waitForTimeout(800);

  // Klant selecteren in formulier
  const planKlant = await selectByOptionText(page, "Hoveniersbedrijf Van Dijk");
  await glideTo(page, ".overlay select.inp");
  await planKlant.selectOption({ label: "Hoveniersbedrijf Van Dijk" });
  await page.waitForTimeout(500);

  // Dienst typen
  await glideTo(page, "input[placeholder='Wat ga je doen?']");
  await slowType(page, "input[placeholder='Wat ga je doen?']", "Tuinaanleg check");
  await page.waitForTimeout(500);

  // Opslaan
  await glideTo(page, ".overlay .btn-dark.btn-full");
  await page.locator(".overlay .btn-dark.btn-full").first().click();
  await page.waitForTimeout(1500);

  // Weekoverzicht
  await page.locator(".cal-vt-btn:has-text('Week')").click();
  await page.waitForTimeout(1500);

  await glide(page, 640, 440, 22);
  await page.waitForTimeout(1000);

  const taskBlk = page.locator(".cal-task-blk").first();
  if (await taskBlk.isVisible().catch(() => false)) {
    await glideTo(page, ".cal-task-blk");
    await page.waitForTimeout(1500);
  }

  // Categorieën knop hoveren
  await glideTo(page, "button:has-text('🏷️')");
  await page.locator("button:has-text('🏷️')").hover();
  await page.waitForTimeout(2500);

  // ─────────────────────────────────────────────────────────────────────────
  // 2:40–3:00  BOEKHOUDING TOUR
  // ─────────────────────────────────────────────────────────────────────────
  await navTab(page, /financ/i);
  await page.waitForTimeout(1000);

  // BTW — 4 sec
  await glideTo(page, "button:has-text('📊 BTW')");
  await page.locator("button:has-text('📊 BTW')").click();
  await page.waitForTimeout(4000);

  // Uitgaven — 4 sec
  await glideTo(page, "button:has-text('💳 Uitgaven')");
  await page.locator("button:has-text('💳 Uitgaven')").click();
  await page.waitForTimeout(4000);

  // Hover Scan knop — 2 sec
  await glideTo(page, "button.btn-ghost");
  await page.locator("button.btn-ghost").filter({ hasText: /Scan/i }).first().hover();
  await page.waitForTimeout(2000);

  // Winst — 4 sec
  await glideTo(page, "button:has-text('📈 Winst')");
  await page.locator("button:has-text('📈 Winst')").click();
  await page.waitForTimeout(4000);

  // Eindigen op Facturen dashboard
  await glideTo(page, "button:has-text('📄 Facturen')");
  await page.locator("button:has-text('📄 Facturen')").click();
  await page.waitForTimeout(3000);

  // Sluit context → video opgeslagen in demo-videos/
  await context.close();
});
