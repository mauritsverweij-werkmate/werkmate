import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Escape characters that have special meaning in HTML to prevent injection.
const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const isValidEmail = (v: unknown) =>
  typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

const capitalize = (s: string): string => {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ── Email signature ───────────────────────────────────────────
type Profiel = {
  bedrijfsnaam?: string | null;
  telefoon?: string | null;
  website?: string | null;
  logo?: string | null;
  email?: string | null;
  kleur?: string | null;
};

function buildSignature(profiel: Profiel | null): string {
  if (!profiel) return "";
  const name    = esc(profiel.bedrijfsnaam ?? "");
  const tel     = profiel.telefoon ? esc(profiel.telefoon) : null;
  const rawSite = profiel.website   ? esc(profiel.website)  : null;
  // Skip base64 logos — they bloat emails and many clients block them
  const logo    = profiel.logo && !profiel.logo.startsWith("data:") ? esc(profiel.logo) : null;
  const href    = rawSite
    ? (rawSite.startsWith("http") ? rawSite : `https://${rawSite}`)
    : null;

  if (!name && !tel && !rawSite && !logo) return "";

  return `<tr><td style="padding:0 32px 28px;">
  <table cellpadding="0" cellspacing="0" width="100%"><tr>
    <td style="border-top:1px solid #f0f0f0;padding-top:20px;">
      <table cellpadding="0" cellspacing="0"><tr>
        ${logo ? `<td style="padding-right:14px;vertical-align:middle;"><img src="${logo}" alt="${name}" width="44" height="44" style="width:44px;height:44px;border-radius:8px;object-fit:contain;display:block;"/></td>` : ""}
        <td style="vertical-align:middle;">
          ${name ? `<p style="margin:0;font-size:14px;font-weight:700;color:#111827;line-height:1.4;">${name}</p>` : ""}
          ${tel    ? `<p style="margin:2px 0 0;font-size:12px;color:#6b7280;line-height:1.4;">${tel}</p>` : ""}
          ${href  ? `<p style="margin:2px 0 0;font-size:12px;line-height:1.4;"><a href="${href}" style="color:#6366F1;text-decoration:none;">${rawSite}</a></p>` : ""}
        </td>
      </tr></table>
    </td>
  </tr></table>
</td></tr>`;
}

// Fetch bedrijfsprofiel for a given user (service-role, no RLS needed)
async function fetchProfiel(userId: string): Promise<Profiel | null> {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
  const { data } = await admin
    .from("bedrijfsprofiel")
    .select("bedrijfsnaam,telefoon,website,logo,email,kleur")
    .eq("user_id", userId)
    .single();
  return data ?? null;
}

// ── Resend helper — logs result and surfaces real error ───────
async function sendViaResend(resendKey: string, payload: Record<string, unknown>): Promise<{ ok: boolean; id?: string; error?: string }> {
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify(payload),
    });
  } catch (networkErr) {
    console.error("[sendViaResend] network error:", networkErr);
    return { ok: false, error: "Netwerk fout bij verbinden met e-mailservice" };
  }
  const text = await res.text();
  console.log(`[sendViaResend] to=${payload.to} status=${res.status} body=${text.slice(0, 300)}`);
  if (!res.ok) {
    let msg = `Resend fout ${res.status}`;
    try { const b = JSON.parse(text); msg = b.message || b.name || b.error || msg; } catch { /* ignore */ }
    return { ok: false, error: msg };
  }
  try { const b = JSON.parse(text); return { ok: true, id: b.id }; }
  catch { return { ok: true }; }
}

// ── Shared email outer wrapper ────────────────────────────────
function emailWrapper(headerTitle: string, contentRows: string, signatureRow: string, accentColor = "#111827", logoDataUri?: string | null): string {
  // Only accept safe hex colors (prevent injection through color value)
  const safeColor = /^#[0-9A-Fa-f]{3,6}$/.test(accentColor) ? accentColor : "#111827";
  const logoHtml = logoDataUri && logoDataUri.startsWith("data:image/")
    ? `<img src="${logoDataUri}" alt="" height="44" style="height:44px;max-width:140px;object-fit:contain;display:block;margin-bottom:10px;border-radius:6px;"/>`
    : "";
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;font-family:Inter,system-ui,sans-serif;background:#f5f7fb;color:#111;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,.08);">
<tr><td style="background:${safeColor};padding:28px 32px;">
  ${logoHtml}<h1 style="margin:0;color:#fff;font-size:24px;font-family:Inter,system-ui,sans-serif;">${headerTitle}</h1>
</td></tr>
<tr><td style="padding:32px 32px 24px;">
${contentRows}
<p style="margin:24px 0 0;font-size:15px;color:#4b5563;">Met vriendelijke groet,</p>
</td></tr>
${signatureRow}
</table>
</td></tr>
</table>
</body></html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Parse body once (needed for public portal-sign check)
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  // ── Portal sign (public — no auth needed) ──────────────────
  if (body.action === "portal-sign") {
    const { portal_token, handtekening, klant_email, klant_naam } = body as {
      portal_token?: string; handtekening?: string; klant_email?: string; klant_naam?: string;
    };
    if (!portal_token) return json({ error: "portal_token required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: offerte, error: fe } = await admin.from("offertes").select("*").eq("portal_token", portal_token).single();
    if (fe || !offerte) return json({ error: "Offerte niet gevonden" }, 404);
    if (offerte.status === "Ondertekend") return json({ success: true, already: true });

    await admin.from("offertes").update({ status: "Ondertekend", handtekening: handtekening || null }).eq("portal_token", portal_token);

    // Auto-create factuur — use the atomic DB counter to avoid race conditions
    const now = new Date();
    const { data: numData, error: numErr } = await admin.rpc("next_factuur_nummer", { p_user_id: offerte.user_id });
    if (numErr) return json({ error: "Kon factuurnummer niet genereren: " + numErr.message }, 500);
    const nummer = numData as string;
    const datum = now.toISOString().slice(0, 10);
    const vervalD = new Date(now); vervalD.setDate(vervalD.getDate() + 30);
    const vervaldatum = vervalD.toISOString().slice(0, 10);
    await admin.from("facturen").insert({
      user_id: offerte.user_id, nummer, klant: offerte.klant,
      klant_email: klant_email || offerte.klant_email || "",
      datum, vervaldatum, regels: offerte.regels || [],
      btw: offerte.btw || 0, totaal: offerte.totaal || 0, status: "Klaar om te versturen",
    });

    // Send confirmation emails (best-effort)
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const profiel = await fetchProfiel(offerte.user_id);
      const rawCompanySign = String(profiel?.bedrijfsnaam || "WerkMate");
      const companyName = esc(rawCompanySign);
      const safeKlant   = esc(capitalize(offerte.klant || klant_naam || "klant"));
      const safeNummer  = esc(nummer);
      const sig = buildSignature(profiel);

      const sendMail = (to: string, subject: string, html: string) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({ from: `${rawCompanySign} <info@werkmate.tech>`, to, subject, html }),
        });

      const clientEmail = isValidEmail(klant_email) ? klant_email! : (isValidEmail(offerte.klant_email) ? offerte.klant_email : null);
      if (clientEmail) {
        await sendMail(
          clientEmail,
          `Offerte geaccepteerd — ${companyName}`,
          emailWrapper(companyName,
            `<p style="margin:0 0 16px;font-size:16px;">Beste ${safeKlant},</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">Bedankt voor het accepteren van de offerte. Uw factuur (<strong>${safeNummer}</strong>) is aangemaakt en wordt zo spoedig mogelijk verstuurd.</p>`,
            sig, profiel?.kleur || undefined, profiel?.logo || undefined)
        );
      }
      // Internal notification to company (no customer signature needed)
      if (profiel?.email && isValidEmail(profiel.email)) {
        await sendMail(
          profiel.email,
          `✅ Offerte geaccepteerd door ${safeKlant}`,
          emailWrapper("WerkMate",
            `<p style="margin:0 0 16px;font-size:16px;">Hallo,</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;"><strong>${safeKlant}</strong> heeft de offerte ondertekend en geaccepteerd.</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">Factuur <strong>${safeNummer}</strong> is automatisch aangemaakt.</p>`,
            "")
        );
      }
    }

    return json({ success: true, factuur_nummer: nummer });
  }

  // ── Send portal link email ──────────────────────────────────
  if (body.action === "send-portal-link") {
    const { customer_email, customer_name, company_name, portal_url } = body as {
      customer_email?: string; customer_name?: string; company_name?: string; portal_url?: string;
    };
    if (!customer_email || !portal_url) return json({ error: "customer_email en portal_url zijn verplicht" }, 400);
    if (!isValidEmail(customer_email)) return json({ error: "Ongeldig e-mailadres" }, 400);

    const authHeader2 = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader2 } } });
    const { data: { user: u2 } } = await userClient.auth.getUser();
    if (!u2) return json({ error: "Authentication required" }, 401);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "E-mailservice niet geconfigureerd" }, 500);

    const profiel = await fetchProfiel(u2.id);
    const rawCn    = String(company_name || profiel?.bedrijfsnaam || "WerkMate");
    const cn       = esc(rawCn);
    const safeName = esc(customer_name || "");
    const safeUrl  = esc(portal_url || "");
    const sig      = buildSignature(profiel);

    const html = emailWrapper(cn,
      `<p style="margin:0 0 16px;font-size:16px;">Beste ${safeName},</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">${cn} heeft een offerte voor u klaargemaakt. U kunt de offerte bekijken en digitaal ondertekenen via de knop hieronder.</p>
<p style="text-align:center;margin:32px 0;">
  <a href="${safeUrl}" style="background:#6366F1;color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">📋 Offerte bekijken &amp; ondertekenen</a>
</p>
<p style="margin:0 0 16px;font-size:14px;color:#9ca3af;">Of kopieer deze link: <a href="${safeUrl}" style="color:#6366F1;">${safeUrl}</a></p>`,
      sig, profiel?.kleur || undefined, profiel?.logo || undefined);

    const customSubject = typeof body.custom_subject === "string" && body.custom_subject.trim() ? body.custom_subject.trim() : null;
    const finalSubject = customSubject || `Offerte van ${rawCn} — bekijk en onderteken`;
    const r2 = await sendViaResend(resendKey, { from: `${rawCn} <info@werkmate.tech>`, to: customer_email, subject: finalSubject, html });
    if (!r2.ok) return json({ error: r2.error, message: r2.error }, 422);
    return json({ success: true, id: r2.id, html });
  }

  // ── Contact form (public — no auth needed) ─────────────────
  if (body.action === "send-contact-form") {
    const { naam, email, bericht } = body as {
      naam?: string; email?: string; bericht?: string;
    };
    if (!naam || !email || !bericht) return json({ error: "Naam, e-mail en bericht zijn verplicht" }, 400);
    if (!isValidEmail(email)) return json({ error: "Ongeldig e-mailadres" }, 400);
    if (String(bericht).length > 4000) return json({ error: "Bericht te lang" }, 400);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "E-mailservice niet geconfigureerd" }, 500);

    const safeNaam    = esc(naam);
    const safeEmail   = esc(email);
    const safeBericht = esc(bericht).replace(/\n/g, "<br>");

    const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;font-family:Inter,system-ui,sans-serif;background:#f5f7fb;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(15,23,42,.08);">
<tr><td style="background:#111827;padding:24px 28px;">
  <p style="margin:0;color:#fff;font-size:20px;font-weight:700;">📩 Nieuw contactbericht via werkmate.tech</p>
</td></tr>
<tr><td style="padding:28px;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="padding-bottom:16px;border-bottom:1px solid #f0f0f0;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Naam</p>
      <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${safeNaam}</p>
    </td></tr>
    <tr><td style="padding:16px 0;border-bottom:1px solid #f0f0f0;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">E-mailadres</p>
      <p style="margin:0;font-size:15px;color:#111827;"><a href="mailto:${safeEmail}" style="color:#6366F1;text-decoration:none;">${safeEmail}</a></p>
    </td></tr>
    <tr><td style="padding:16px 0;">
      <p style="margin:0 0 8px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px;">Bericht</p>
      <p style="margin:0;font-size:15px;color:#374151;line-height:1.65;">${safeBericht}</p>
    </td></tr>
  </table>
  <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
    <tr><td style="background:#f8fafc;border-radius:10px;padding:14px 16px;">
      <p style="margin:0;font-size:13px;color:#6b7280;">Beantwoord dit bericht door te antwoorden op deze e-mail — het antwoord gaat direct naar <strong>${safeEmail}</strong>.</p>
    </td></tr>
  </table>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

    const r = await sendViaResend(resendKey, {
      from: "WerkMate Website <info@werkmate.tech>",
      to: "info@werkmate.tech",
      reply_to: email,
      subject: `Nieuw contactbericht van ${safeNaam}`,
      html,
    });
    if (!r.ok) return json({ error: r.error, message: r.error }, 422);
    return json({ success: true });
  }

  // ── Authentication ─────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Authentication required" }, 401);
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
  if (authError || !user) {
    return json({ error: "Authentication required" }, 401);
  }

  try {

    // ── Send invite email ─────────────────────────────────────
    if (body.action === "send-invite-email") {
      const inviteEmail = body.invite_email;
      const inviteToken = body.invite_token;
      const appUrl = "https://app.werkmate.tech";

      if (!inviteEmail || !inviteToken) {
        return json({ error: "invite_email and invite_token zijn verplicht" }, 400);
      }

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return json({ error: "E-mailservice niet geconfigureerd" }, 500);

      const profiel         = await fetchProfiel(user.id);
      const rawCompanyName  = String(body.company_name || profiel?.bedrijfsnaam || "WerkMate");
      const companyName     = esc(rawCompanyName);
      const acceptLink      = `${appUrl}?invite_token=${encodeURIComponent(inviteToken as string)}&email=${encodeURIComponent(inviteEmail as string)}`;
      const sig             = buildSignature(profiel);

      const html = emailWrapper(companyName,
        `<p style="margin:0 0 16px;font-size:16px;">Je bent uitgenodigd om WerkMate te gebruiken.</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">Klik op de knop hieronder om je account te maken en direct met je team te beginnen.</p>
<p style="text-align:center;margin:36px 0;">
  <a href="${esc(acceptLink)}" style="display:inline-block;padding:14px 24px;border-radius:12px;background:#6366F1;color:#fff;text-decoration:none;font-weight:700;">Accepteer uitnodiging</a>
</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">Als de knop niet werkt, kopieer dan deze link in je browser:</p>
<p style="font-size:13px;color:#6b7280;word-break:break-all;">${esc(acceptLink)}</p>`,
        sig, profiel?.kleur || undefined, profiel?.logo || undefined);

      const replyTo = isValidEmail(body.reply_to) ? body.reply_to : undefined;
      const payload: Record<string, unknown> = {
        from: `${rawCompanyName} <info@werkmate.tech>`,
        to: inviteEmail,
        subject: "Je bent uitgenodigd voor WerkMate",
        text: `Je bent uitgenodigd voor WerkMate. Open deze link: ${acceptLink}`,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      };

      const r = await sendViaResend(resendKey, payload);
      if (!r.ok) return json({ error: r.error, message: r.error }, 422);
      return json({ success: true, id: r.id });
    }

    // ── Send offer email ──────────────────────────────────────
    if (body.action === "send-offer-email") {
      const { customer_email, customer_name, portal_url } = body as {
        customer_email?: string; customer_name?: string; portal_url?: string;
      };
      if (!customer_email || !customer_name) {
        return json({ error: "customer_email en customer_name zijn verplicht" }, 400);
      }
      if (!isValidEmail(customer_email)) return json({ error: "Ongeldig e-mailadres" }, 400);

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return json({ error: "E-mailservice niet geconfigureerd" }, 500);

      const profiel          = await fetchProfiel(user.id);
      const rawCompanyName   = String(body.company_name || profiel?.bedrijfsnaam || "WerkMate");
      const companyName      = esc(rawCompanyName);
      const safeCustomer     = esc(capitalize(customer_name || ""));
      const safePortal       = portal_url ? esc(portal_url) : null;
      const sig              = buildSignature(profiel);

      const portalBlock = safePortal ? `
<p style="margin:0 0 10px;font-size:13px;color:#6b7280;">U kunt de offerte ook online inzien en ondertekenen:</p>
<p style="margin:0 0 20px;">
  <a href="${safePortal}" style="display:inline-block;background:#F8FAFC;color:#374151;padding:9px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500;border:1px solid #E2E8F0;">Bekijk offerte online →</a>
</p>` : "";

      const customBody = typeof body.custom_body === "string" && body.custom_body.trim() ? body.custom_body.trim() : null;
      const mainContent = customBody
        ? `<p style="margin:0 0 16px;font-size:15px;color:#4b5563;white-space:pre-line;">${esc(customBody).replace(/\n/g, "<br>")}</p>${portalBlock}`
        : `<p style="margin:0 0 16px;font-size:16px;">Geachte ${safeCustomer},</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">Hierbij ontvangt u uw offerte in de bijlage.</p>${portalBlock}`;

      const html = emailWrapper(companyName, mainContent, sig, profiel?.kleur || undefined, profiel?.logo || undefined);

      const customSubject = typeof body.custom_subject === "string" && body.custom_subject.trim() ? body.custom_subject.trim() : null;
      const replyTo = isValidEmail(body.reply_to) ? body.reply_to : undefined;
      const payload: Record<string, unknown> = {
        from: `${rawCompanyName} <info@werkmate.tech>`,
        to: customer_email,
        subject: customSubject || `Offerte van ${rawCompanyName} voor ${safeCustomer}`,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      };
      if (body.attachments) payload.attachments = body.attachments;

      const r = await sendViaResend(resendKey, payload);
      if (!r.ok) return json({ error: r.error, message: r.error }, 422);
      return json({ success: true, id: r.id, html });
    }

    // ── Send review request email ─────────────────────────────
    if (body.action === "send-review-request-email") {
      const { customer_email, company_name, service_description } = body;
      if (!customer_email) return json({ error: "customer_email is verplicht" }, 400);
      if (!isValidEmail(customer_email)) return json({ error: "Ongeldig e-mailadres" }, 400);

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return json({ error: "E-mailservice niet geconfigureerd" }, 500);

      const profiel            = await fetchProfiel(user.id);
      const rawCompanyName     = String(company_name || profiel?.bedrijfsnaam || "WerkMate");
      const companyName        = esc(rawCompanyName);
      const serviceText        = esc(service_description || "de service");
      const sig                = buildSignature(profiel);
      const rawReviewUrl       = body.google_review_url || (profiel as Record<string,unknown>)?.google_review_url;
      const safeReviewUrl  = typeof rawReviewUrl === "string" && rawReviewUrl.startsWith("http") ? rawReviewUrl : null;

      const reviewBtn = safeReviewUrl
        ? `<p style="margin:24px 0 8px;text-align:center;">
<a href="${safeReviewUrl}" style="display:inline-block;background:#4285F4;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:600;letter-spacing:.2px;">⭐ Laat een Google review achter</a>
</p>
<p style="margin:0 0 16px;font-size:12px;color:#9ca3af;text-align:center;">Duurt minder dan 1 minuut</p>`
        : `<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">Uw feedback helpt ons om continu beter te worden. Alvast bedankt!</p>`;

      const customBody = typeof body.custom_body === "string" && body.custom_body.trim() ? body.custom_body.trim() : null;
      const mainContent = customBody
        ? `<p style="margin:0 0 16px;font-size:15px;color:#4b5563;white-space:pre-line;">${esc(customBody).replace(/\n/g, "<br>")}</p>${reviewBtn}`
        : `<p style="margin:0 0 16px;font-size:16px;">Hallo,</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">Bedankt voor het vertrouwen in ${companyName}! We hopen dat u tevreden bent over ${serviceText}.</p>
<p style="margin:0 0 4px;font-size:15px;color:#4b5563;">Zou u even 1 minuut nemen om een review achter te laten? Dat helpt ons enorm.</p>
${reviewBtn}`;

      const html = emailWrapper(companyName, mainContent, sig, profiel?.kleur || undefined, profiel?.logo || undefined);

      const customSubject = typeof body.custom_subject === "string" && body.custom_subject.trim() ? body.custom_subject.trim() : null;
      const replyTo = isValidEmail(body.reply_to) ? body.reply_to : undefined;
      const reviewLinkText = safeReviewUrl ? `\n\nLaat een review achter: ${safeReviewUrl}` : "";
      const payload: Record<string, unknown> = {
        from: `${rawCompanyName} <info@werkmate.tech>`,
        to: customer_email,
        subject: customSubject || `Hoe was uw ervaring met ${rawCompanyName}?`,
        text: `Hallo,\n\nBedankt voor het vertrouwen in ${rawCompanyName}! We hopen dat u tevreden bent over ${service_description || "de service"}.\n\nZou u een review willen achterlaten? Dat helpt ons enorm.${reviewLinkText}\n\nMet vriendelijke groet,\n${rawCompanyName}`,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      };

      const r = await sendViaResend(resendKey, payload);
      if (!r.ok) return json({ error: r.error, message: r.error }, 422);
      return json({ success: true, id: r.id, html });
    }

    // ── Send compose email (handmatig vanuit Mail tab) ────────
    if (body.action === "send-compose-email") {
      const { to_email, subject, message } = body;
      if (!to_email || !subject || !message) return json({ error: "to_email, subject en message zijn verplicht" }, 400);
      if (!isValidEmail(to_email)) return json({ error: "Ongeldig e-mailadres" }, 400);

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return json({ error: "E-mailservice niet geconfigureerd" }, 500);

      const profiel          = await fetchProfiel(user.id);
      const rawCompanyName   = String(profiel?.bedrijfsnaam || "WerkMate");
      const companyName      = esc(rawCompanyName);
      const sig              = buildSignature(profiel);
      const safeMsg          = esc(message).replace(/\n/g, "<br>");

      const html = emailWrapper(companyName,
        `<div style="font-size:15px;color:#374151;line-height:1.7;white-space:pre-line;">${safeMsg}</div>`,
        sig, profiel?.kleur || undefined, profiel?.logo || undefined);

      const r = await sendViaResend(resendKey, {
        from: `${rawCompanyName} <info@werkmate.tech>`,
        to: to_email,
        subject: String(subject),
        text: `${message}\n\nMet vriendelijke groet,\n${rawCompanyName}`,
        html,
      });
      if (!r.ok) return json({ error: r.error, message: r.error }, 422);
      return json({ success: true, id: r.id, html });
    }

    // ── Send invoice email ────────────────────────────────────
    if (body.action === "send-invoice-email") {
      const { customer_email, customer_name, factuur_nummer } = body;
      if (!customer_email || !customer_name) {
        return json({ error: "customer_email en customer_name zijn verplicht" }, 400);
      }
      if (!isValidEmail(customer_email)) return json({ error: "Ongeldig e-mailadres" }, 400);

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return json({ error: "E-mailservice niet geconfigureerd" }, 500);

      const profiel          = await fetchProfiel(user.id);
      const rawCompanyName   = String(body.company_name || profiel?.bedrijfsnaam || "WerkMate");
      const companyName      = esc(rawCompanyName);
      const safeCustomer     = esc(capitalize(customer_name || ""));
      const safeNummer       = esc(factuur_nummer || "");
      const sig              = buildSignature(profiel);

      const customBody = typeof body.custom_body === "string" && body.custom_body.trim() ? body.custom_body.trim() : null;
      const bodyContent = customBody
        ? `<p style="margin:0 0 16px;font-size:15px;color:#4b5563;white-space:pre-line;">${esc(customBody).replace(/\n/g, "<br>")}</p>`
        : `<p style="margin:0 0 16px;font-size:16px;">Geachte ${safeCustomer},</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">Hierbij ontvangt u factuur <strong>${safeNummer}</strong> in de bijlage.</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">Bij vragen kunt u altijd contact met ons opnemen.</p>`;

      const html = emailWrapper(companyName, bodyContent, sig, profiel?.kleur || undefined, profiel?.logo || undefined);

      const customSubject = typeof body.custom_subject === "string" && body.custom_subject.trim() ? body.custom_subject.trim() : null;
      const textInv = customBody
        ? `${customBody}\n\nMet vriendelijke groet,\n${rawCompanyName}`
        : `Geachte ${safeCustomer},\n\nHierbij ontvangt u factuur ${safeNummer} in de bijlage.\n\nBij vragen kunt u altijd contact met ons opnemen.\n\nMet vriendelijke groet,\n${rawCompanyName}`;
      const payload: Record<string, unknown> = {
        from: `${rawCompanyName} <info@werkmate.tech>`,
        to: customer_email,
        subject: customSubject || `Factuur ${safeNummer} van ${rawCompanyName}`,
        text: textInv,
        html,
      };
      if (body.attachments) payload.attachments = body.attachments;

      const r = await sendViaResend(resendKey, payload);
      if (!r.ok) return json({ error: r.error, message: r.error }, 422);
      return json({ success: true, id: r.id, html });
    }

    // ── Send reminder email ───────────────────────────────────
    if (body.action === "send-reminder-email") {
      const { customer_email, customer_name, factuur_nummer, totaal } = body;
      if (!customer_email || !customer_name) {
        return json({ error: "customer_email en customer_name zijn verplicht" }, 400);
      }
      if (!isValidEmail(customer_email)) return json({ error: "Ongeldig e-mailadres" }, 400);

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return json({ error: "E-mailservice niet geconfigureerd" }, 500);

      const profiel          = await fetchProfiel(user.id);
      const rawCompanyName   = String(body.company_name || profiel?.bedrijfsnaam || "WerkMate");
      const companyName      = esc(rawCompanyName);
      const safeCustomer     = esc(capitalize(customer_name || ""));
      const safeNummer       = esc(factuur_nummer || "");
      const totaalFmt        = totaal != null
        ? `€ ${Number(totaal).toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`
        : "";
      const sig = buildSignature(profiel);

      const customBody = typeof body.custom_body === "string" && body.custom_body.trim() ? body.custom_body.trim() : null;
      const bodyContent = customBody
        ? `<p style="margin:0 0 16px;font-size:15px;color:#4b5563;white-space:pre-line;">${esc(customBody).replace(/\n/g, "<br>")}</p>`
        : `<p style="margin:0 0 16px;font-size:16px;">Geachte ${safeCustomer},</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">Wij willen u vriendelijk herinneren aan openstaande factuur <strong>${safeNummer}</strong>${totaalFmt ? ` van <strong>${esc(totaalFmt)}</strong>` : ""}.</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">Gelieve het bedrag zo spoedig mogelijk over te maken.</p>`;

      const html = emailWrapper(companyName, bodyContent, sig, profiel?.kleur || undefined, profiel?.logo || undefined);

      const customSubject = typeof body.custom_subject === "string" && body.custom_subject.trim() ? body.custom_subject.trim() : null;
      // Avoid spam-trigger words ("betalingsherinnering") and Unicode em-dashes in subject
      const defaultSubjectRem = `Factuur ${safeNummer} - nog openstaand (${rawCompanyName})`;
      const textRem = customBody
        ? `${customBody}\n\nMet vriendelijke groet,\n${rawCompanyName}`
        : `Geachte ${safeCustomer},\n\nWij willen u vriendelijk herinneren aan openstaande factuur ${safeNummer}${totaalFmt ? ` van ${totaalFmt}` : ""}.\n\nGelieve het bedrag zo spoedig mogelijk over te maken.\n\nMet vriendelijke groet,\n${rawCompanyName}`;
      const payload: Record<string, unknown> = {
        from: `${rawCompanyName} <info@werkmate.tech>`,
        to: customer_email,
        subject: customSubject || defaultSubjectRem,
        text: textRem,
        html,
      };
      if (body.attachments) payload.attachments = body.attachments;

      const r = await sendViaResend(resendKey, payload);
      if (!r.ok) return json({ error: r.error, message: r.error }, 422);
      return json({ success: true, id: r.id, html });
    }

    // ── Scan bonnetje ────────────────────────────────────────
    if (body.action === "scan-bonnetje") {
      const { image_base64, media_type } = body as { image_base64?: string; media_type?: string };
      if (!image_base64) return json({ error: "image_base64 is verplicht" }, 400);
      const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
      if (!anthropicKey) return json({ error: "AI-service niet geconfigureerd" }, 500);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 500,
          messages: [{ role: "user", content: [
            { type: "image", source: { type: "base64", media_type: media_type || "image/jpeg", data: image_base64 } },
            { type: "text", text: 'Dit is een bonnetje of factuur. Extraheer de volgende gegevens en geef ALLEEN geldige JSON terug zonder uitleg of code-blocks: {"datum":"YYYY-MM-DD","omschrijving":"korte omschrijving","bedrag":0.00,"btw_percentage":21}. Datum in ISO formaat (als onduidelijk, gebruik vandaag). Bedrag is het totaalbedrag inclusief BTW als getal. BTW percentage is 0, 9 of 21. Als iets niet leesbaar is, gebruik lege string of 0.' },
          ]}],
        }),
      });
      const data = await res.json();
      const text: string = data?.content?.[0]?.text || "{}";
      try {
        const cleaned = text.replace(/```json|```/g, "").trim();
        return json(JSON.parse(cleaned));
      } catch {
        return json({ error: "Kon bonnetje niet lezen" }, 422);
      }
    }

    // ── Claude AI call ────────────────────────────────────────
    const { prompt } = body;
    if (!prompt) return json({ error: "prompt is verplicht" }, 400);

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json({ error: "AI-service niet geconfigureerd" }, 500);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    return json(data);

  } catch (error) {
    console.error("ai-proxy error:", error);
    return json({ error: "Er is een interne fout opgetreden" }, 500);
  }
});
