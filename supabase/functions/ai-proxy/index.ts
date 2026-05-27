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

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
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
    if (offerte.status === "Geaccepteerd") return json({ success: true, already: true });

    await admin.from("offertes").update({ status: "Geaccepteerd", handtekening: handtekening || null }).eq("portal_token", portal_token);

    // Auto-create factuur
    const now = new Date();
    const yr = now.getFullYear();
    const { data: existing } = await admin.from("facturen").select("nummer").eq("user_id", offerte.user_id).like("nummer", `${yr}-%`);
    const nums = (existing || []).map((f: { nummer: string }) => parseInt((f.nummer || "").split("-")[1]) || 0);
    const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
    const nummer = `${yr}-${String(nextNum).padStart(3, "0")}`;
    const datum = now.toISOString().slice(0, 10);
    const vervalD = new Date(now); vervalD.setDate(vervalD.getDate() + 30);
    const vervaldatum = vervalD.toISOString().slice(0, 10);
    await admin.from("facturen").insert({
      user_id: offerte.user_id, nummer, klant: offerte.klant,
      klant_email: klant_email || offerte.klant_email || "",
      datum, vervaldatum, regels: offerte.regels || [],
      btw: offerte.btw || 0, totaal: offerte.totaal || 0, status: "Verstuurd",
    });

    // Send confirmation emails (best-effort)
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (resendKey) {
      const { data: profiel } = await admin.from("bedrijfsprofiel").select("email,bedrijfsnaam").eq("user_id", offerte.user_id).single();
      const companyName = esc(profiel?.bedrijfsnaam || "WerkMate");
      const safeKlant = esc(offerte.klant || klant_naam || "klant");
      const safeNummer = esc(nummer);

      const sendMail = (to: string, subject: string, html: string) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({ from: `${companyName} <info@werkmate.tech>`, to, subject, html }),
        });

      const clientEmail = isValidEmail(klant_email) ? klant_email! : (isValidEmail(offerte.klant_email) ? offerte.klant_email : null);
      if (clientEmail) {
        await sendMail(clientEmail, `Offerte geaccepteerd — ${companyName}`,
          `<p>Beste ${safeKlant},</p><p>Bedankt voor het accepteren van de offerte. Uw factuur (${safeNummer}) is aangemaakt en wordt zo spoedig mogelijk verstuurd.</p><p>Met vriendelijke groet,<br/>${companyName}</p>`);
      }
      if (profiel?.email && isValidEmail(profiel.email)) {
        await sendMail(profiel.email, `✅ Offerte geaccepteerd door ${safeKlant}`,
          `<p>Hallo,</p><p><strong>${safeKlant}</strong> heeft de offerte ondertekend en geaccepteerd.</p><p>Factuur <strong>${safeNummer}</strong> is automatisch aangemaakt.</p><p>WerkMate</p>`);
      }
    }

    return json({ success: true, factuur_nummer: nummer });
  }

  // ── Send portal link email (public, anon safe) ─────────────
  if (body.action === "send-portal-link") {
    const { customer_email, customer_name, company_name, portal_url } = body as {
      customer_email?: string; customer_name?: string; company_name?: string; portal_url?: string;
    };
    if (!customer_email || !portal_url) return json({ error: "customer_email en portal_url zijn verplicht" }, 400);
    if (!isValidEmail(customer_email)) return json({ error: "Ongeldig e-mailadres" }, 400);

    const authHeader2 = req.headers.get("Authorization") ?? "";
    const admin2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader2 } } });
    const { data: { user: u2 } } = await admin2.auth.getUser();
    if (!u2) return json({ error: "Authentication required" }, 401);

    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) return json({ error: "E-mailservice niet geconfigureerd" }, 500);
    const cn = esc(company_name || "WerkMate");
    const safeName = esc(customer_name || "");
    const safeUrl = esc(portal_url || "");
    const html = `<p>Beste ${safeName},</p><p>${cn} heeft een offerte voor u klaargemaakt. U kunt de offerte bekijken en digitaal ondertekenen via de knop hieronder.</p><p style="text-align:center;margin:32px 0"><a href="${safeUrl}" style="background:#6366F1;color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-weight:700;font-size:15px">📋 Offerte bekijken &amp; ondertekenen</a></p><p>Of kopieer deze link:<br/><a href="${safeUrl}">${safeUrl}</a></p><p>Met vriendelijke groet,<br/>${cn}</p>`;
    const res2 = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({ from: `${cn} <info@werkmate.tech>`, to: customer_email, subject: `Offerte van ${cn} — bekijk en onderteken`, html }),
    });
    if (!res2.ok) return json({ error: "E-mail versturen mislukt" }, res2.status);
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

      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "WerkMate <info@werkmate.tech>";
      const companyName = esc(body.company_name || fromEmail.split(" <")[0] || "WerkMate");
      const acceptLink = `${appUrl.replace(/\/$/, "")}?invite_token=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(inviteEmail)}`;

      const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Uitnodiging voor WerkMate</title></head>
<body style="margin:0;padding:0;font-family:Inter,system-ui,sans-serif;background:#f5f7fb;color:#111;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,.08);">
<tr><td style="background:#111827;padding:28px 32px;"><h1 style="margin:0;color:#fff;font-size:24px;">${companyName}</h1></td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 24px;font-size:16px;">Je bent uitgenodigd om WerkMate te gebruiken.</p>
<p style="margin:0 0 24px;font-size:15px;color:#4b5563;">Klik op de knop hieronder om je account te maken en direct met je team te beginnen.</p>
<p style="text-align:center;margin:36px 0;"><a href="${acceptLink}" style="display:inline-block;padding:14px 24px;border-radius:12px;background:#6366F1;color:#fff;text-decoration:none;font-weight:700;">Accepteer uitnodiging</a></p>
<p style="margin:0 0 24px;font-size:15px;color:#4b5563;">Als de knop niet werkt, kopieer dan deze link in je browser:</p>
<p style="font-size:13px;color:#6b7280;word-break:break-all;">${acceptLink}</p>
<p style="margin:24px 0 0;font-size:15px;color:#4b5563;">Met vriendelijke groet,<br/>${companyName}</p>
</td></tr>
</table></td></tr></table>
</body></html>`;

      const replyTo = isValidEmail(body.reply_to) ? body.reply_to : undefined;
      const payload: Record<string, unknown> = {
        from: `${companyName} <info@werkmate.tech>`,
        to: inviteEmail,
        subject: "Je bent uitgenodigd voor WerkMate",
        text: `Je bent uitgenodigd voor WerkMate. Open deze link: ${acceptLink}`,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      };

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) return json({ error: "E-mail versturen mislukt" }, res.status);
      try { return json(JSON.parse(text)); }
      catch { return json({ error: "Onverwacht antwoord van e-mailservice" }, 500); }
    }

    // ── Send offer email ──────────────────────────────────────
    if (body.action === "send-offer-email") {
      const { customer_email, customer_name } = body;
      if (!customer_email || !customer_name) {
        return json({ error: "customer_email en customer_name zijn verplicht" }, 400);
      }
      if (!isValidEmail(customer_email)) return json({ error: "Ongeldig e-mailadres" }, 400);

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return json({ error: "E-mailservice niet geconfigureerd" }, 500);

      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "WerkMate <info@werkmate.tech>";
      const companyName = esc(body.company_name || fromEmail.split(" <")[0] || "WerkMate");
      const safeCustomer = esc(customer_name);

      const html = `<!DOCTYPE html>
<html lang="nl"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;font-family:Inter,system-ui,sans-serif;background:#f5f7fb;color:#111;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,.08);">
<tr><td style="background:#111827;padding:28px 32px;"><h1 style="margin:0;color:#fff;font-size:24px;">${companyName}</h1></td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 24px;font-size:16px;">Geachte ${safeCustomer},</p>
<p style="margin:0 0 24px;font-size:15px;color:#4b5563;">Hierbij ontvangt u uw offerte in de bijlage.</p>
<p style="margin:0 0 24px;font-size:15px;color:#4b5563;">Met vriendelijke groet,<br/>${companyName}</p>
</td></tr></table></td></tr></table></body></html>`;

      const replyTo = isValidEmail(body.reply_to) ? body.reply_to : undefined;
      const payload: Record<string, unknown> = {
        from: `${companyName} <info@werkmate.tech>`,
        to: customer_email,
        subject: `Offerte van ${companyName} voor ${safeCustomer}`,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      };
      if (body.attachments) payload.attachments = body.attachments;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) return json({ error: "E-mail versturen mislukt" }, res.status);
      try { return json(JSON.parse(text)); }
      catch { return json({ error: "Onverwacht antwoord van e-mailservice" }, 500); }
    }

    // ── Send review request email ─────────────────────────────
    if (body.action === "send-review-request-email") {
      const { customer_email, company_name, service_description } = body;
      if (!customer_email) return json({ error: "customer_email is verplicht" }, 400);
      if (!isValidEmail(customer_email)) return json({ error: "Ongeldig e-mailadres" }, 400);

      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (!resendKey) return json({ error: "E-mailservice niet geconfigureerd" }, 500);

      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "WerkMate <info@werkmate.tech>";
      const companyName = esc(body.company_name || company_name || fromEmail.split(" <")[0] || "WerkMate");
      const serviceText = esc(service_description || "de service");

      const html = `<!DOCTYPE html>
<html lang="nl"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;font-family:Inter,system-ui,sans-serif;background:#f5f7fb;color:#111;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 20px 60px rgba(15,23,42,.08);">
<tr><td style="background:#111827;padding:28px 32px;"><h1 style="margin:0;color:#fff;font-size:24px;">${companyName}</h1></td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 24px;font-size:16px;">Hallo,</p>
<p style="margin:0 0 24px;font-size:15px;color:#4b5563;">We hopen dat u tevreden bent over ${serviceText}. Zou u ons kort laten weten hoe het ging en een review achterlaten?</p>
<p style="margin:0 0 24px;font-size:15px;color:#4b5563;">Uw feedback helpt ons om continu beter te worden. Alvast bedankt!</p>
<p style="margin:0;font-size:15px;color:#4b5563;">Met vriendelijke groet,<br/>${companyName}</p>
</td></tr></table></td></tr></table></body></html>`;

      const replyTo = isValidEmail(body.reply_to) ? body.reply_to : undefined;
      const payload: Record<string, unknown> = {
        from: `${companyName} <info@werkmate.tech>`,
        to: customer_email,
        subject: `Laat een review achter voor ${companyName}`,
        text: `Hallo,\n\nWe hopen dat u tevreden bent over ${service_description || "de service"}. Zou u een review willen achterlaten?\n\nMet vriendelijke groet,\n${company_name || "WerkMate"}`,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
      };

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) return json({ error: "E-mail versturen mislukt" }, res.status);
      try { return json(JSON.parse(text)); }
      catch { return json({ error: "Onverwacht antwoord van e-mailservice" }, 500); }
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

      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "WerkMate <info@werkmate.tech>";
      const companyName = esc(body.company_name || fromEmail.split(" <")[0] || "WerkMate");
      const safeCustomer = esc(customer_name);
      const safeNummer = esc(factuur_nummer || "");

      const html = `<!DOCTYPE html>
<html lang="nl"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;font-family:Inter,system-ui,sans-serif;background:#f5f7fb;color:#111;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;">
<tr><td style="background:#111827;padding:28px 32px;"><h1 style="margin:0;color:#fff;font-size:24px;">${companyName}</h1></td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;font-size:16px;">Geachte ${safeCustomer},</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">Hierbij ontvangt u factuur <strong>${safeNummer}</strong> in de bijlage.</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">Bij vragen kunt u altijd contact met ons opnemen.</p>
<p style="margin:0;font-size:15px;color:#4b5563;">Met vriendelijke groet,<br/>${companyName}</p>
</td></tr></table></td></tr></table></body></html>`;

      const payload: Record<string, unknown> = {
        from: `${companyName} <info@werkmate.tech>`,
        to: customer_email,
        subject: `Factuur ${safeNummer} van ${companyName}`,
        html,
      };
      if (body.attachments) payload.attachments = body.attachments;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) return json({ error: "E-mail versturen mislukt" }, res.status);
      try { return json(JSON.parse(text)); }
      catch { return json({ error: "Onverwacht antwoord van e-mailservice" }, 500); }
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

      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "WerkMate <info@werkmate.tech>";
      const companyName = esc(body.company_name || fromEmail.split(" <")[0] || "WerkMate");
      const safeCustomer = esc(customer_name);
      const safeNummer = esc(factuur_nummer || "");
      const totaalFmt = totaal != null
        ? `€ ${Number(totaal).toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`
        : "";

      const html = `<!DOCTYPE html>
<html lang="nl"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;font-family:Inter,system-ui,sans-serif;background:#f5f7fb;color:#111;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fb;padding:24px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:20px;overflow:hidden;">
<tr><td style="background:#111827;padding:28px 32px;"><h1 style="margin:0;color:#fff;font-size:24px;">${companyName}</h1></td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;font-size:16px;">Geachte ${safeCustomer},</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">Wij willen u vriendelijk herinneren aan openstaande factuur <strong>${safeNummer}</strong>${totaalFmt ? ` van <strong>${esc(totaalFmt)}</strong>` : ""}.</p>
<p style="margin:0 0 16px;font-size:15px;color:#4b5563;">Gelieve het bedrag zo spoedig mogelijk over te maken.</p>
<p style="margin:0;font-size:15px;color:#4b5563;">Met vriendelijke groet,<br/>${companyName}</p>
</td></tr></table></td></tr></table></body></html>`;

      const payload: Record<string, unknown> = {
        from: `${companyName} <info@werkmate.tech>`,
        to: customer_email,
        subject: `Betalingsherinnering factuur ${safeNummer} — ${companyName}`,
        html,
      };
      if (body.attachments) payload.attachments = body.attachments;

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (!res.ok) return json({ error: "E-mail versturen mislukt" }, res.status);
      try { return json(JSON.parse(text)); }
      catch { return json({ error: "Onverwacht antwoord van e-mailservice" }, 500); }
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
