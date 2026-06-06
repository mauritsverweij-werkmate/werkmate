import { chromium, FullConfig } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = "https://cpfdyrscucicvqzpnisd.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_KEY || "sb_publishable_-pgSrBNGFV9D-2QHqX3FPA_VQS-ganx";
const AUTH_PATH = path.join(__dirname, ".auth", "session.json");

async function getStoredToken(): Promise<{ access_token: string; expires_at: number } | null> {
  try {
    const raw = fs.readFileSync(AUTH_PATH, "utf-8");
    const state = JSON.parse(raw);
    const entry = state?.origins?.[0]?.localStorage?.find(
      (e: { name: string; value: string }) => e.name === "sb-cpfdyrscucicvqzpnisd-auth-token"
    );
    if (!entry) return null;
    const parsed = JSON.parse(entry.value);
    return { access_token: parsed.access_token, expires_at: parsed.expires_at };
  } catch {
    return null;
  }
}

async function isTokenValid(token: { access_token: string; expires_at: number }): Promise<boolean> {
  // expires_at is Unix seconds; leave 60s buffer
  if (Date.now() / 1000 > token.expires_at - 60) return false;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token.access_token}`, apikey: SUPABASE_ANON_KEY },
  }).catch(() => null);
  return res?.ok ?? false;
}

export default async function globalSetup(_config: FullConfig) {
  // Check if we have a still-valid session — skip login if so
  const stored = await getStoredToken();
  if (stored && await isTokenValid(stored)) {
    console.log("[setup] Bestaande sessie nog geldig, login overgeslagen.");
    return;
  }

  const email = process.env.TEST_EMAIL || process.env.PLAYWRIGHT_EMAIL;
  const password = process.env.TEST_PASSWORD || process.env.PLAYWRIGHT_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Sessie verlopen. Stel TEST_EMAIL en TEST_PASSWORD in als omgevingsvariabelen en run opnieuw.\n" +
      "Voorbeeld: TEST_EMAIL=jij@voorbeeld.nl TEST_PASSWORD=geheim npx playwright test"
    );
  }

  console.log(`[setup] Sessie verlopen of ontbreekt — opnieuw inloggen als ${email}…`);

  // Verkrijg een vers token via Supabase password auth
  const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify({ email, password }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text().catch(() => "");
    throw new Error(`Supabase login mislukt (${tokenRes.status}): ${err}`);
  }

  const tokenData = await tokenRes.json();
  const authToken = {
    access_token: tokenData.access_token,
    token_type: tokenData.token_type,
    expires_in: tokenData.expires_in,
    expires_at: tokenData.expires_at,
    refresh_token: tokenData.refresh_token,
    user: tokenData.user,
  };

  // Sla op in het localStorage-formaat dat Supabase JS SDK verwacht
  const sessionState = {
    cookies: [],
    origins: [
      {
        origin: "http://localhost:5173",
        localStorage: [
          {
            name: "sb-cpfdyrscucicvqzpnisd-auth-token",
            value: JSON.stringify(authToken),
          },
        ],
      },
    ],
  };

  fs.mkdirSync(path.dirname(AUTH_PATH), { recursive: true });
  fs.writeFileSync(AUTH_PATH, JSON.stringify(sessionState, null, 2));
  console.log(`[setup] Nieuwe sessie opgeslagen (geldig tot ${new Date(authToken.expires_at * 1000).toLocaleTimeString("nl-NL")}).`);

  // Verifieer dat de app daadwerkelijk laadt met de nieuwe sessie
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: AUTH_PATH, baseURL: "http://localhost:5173" });
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForSelector(".shell", { timeout: 20000 }).catch(async () => {
    const html = await page.content();
    console.error("[setup] App laadde niet (.shell niet gevonden). Body snippet:", html.slice(0, 500));
    throw new Error("App kon niet worden geladen na login — controleer de sessie.");
  });
  await browser.close();
  console.log("[setup] Sessie geverifieerd ✅");
}
