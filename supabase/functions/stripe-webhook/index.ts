import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// Verify Stripe webhook signature (HMAC-SHA256 over "t=<ts>.<rawBody>")
async function verifySignature(rawBody: string, sigHeader: string, secret: string): Promise<boolean> {
  const t   = sigHeader.split(",").find(p => p.startsWith("t="))?.slice(2) ?? "";
  const v1  = sigHeader.split(",").find(p => p.startsWith("v1="))?.slice(3) ?? "";
  if (!t || !v1) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${rawBody}`));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

  // Timing-safe comparison via constant-length XOR
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

// Map Stripe subscription status → our status
function mapStatus(stripeStatus: string): string {
  const map: Record<string, string> = {
    active:             "active",
    trialing:           "trialing",
    past_due:           "past_due",
    unpaid:             "past_due",
    incomplete:         "past_due",
    incomplete_expired: "canceled",
    canceled:           "canceled",
    paused:             "canceled",
  };
  return map[stripeStatus] ?? "past_due";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) return json({ error: "Webhook secret not configured" }, 500);

  // Read raw body BEFORE any JSON parsing (signature is over raw bytes)
  const rawBody = await req.text();
  const sigHeader = req.headers.get("stripe-signature") ?? "";

  const valid = await verifySignature(rawBody, sigHeader, webhookSecret);
  if (!valid) return json({ error: "Invalid signature" }, 400);

  let event: { type: string; data: { object: Record<string, unknown> } };
  try { event = JSON.parse(rawBody); }
  catch { return json({ error: "Invalid JSON" }, 400); }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Resolve Stripe customer e-mail → WerkMate user_id
  async function userIdByEmail(email: string): Promise<string | null> {
    const { data: { users } } = await admin.auth.admin.listUsers();
    const match = users.find((u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase());
    return (match as { id: string } | undefined)?.id ?? null;
  }

  // Upsert a subscription row
  async function upsert(userId: string, customerId: string, status: string) {
    await admin.from("subscriptions").upsert(
      { user_id: userId, stripe_customer_id: customerId, status },
      { onConflict: "user_id" }
    );
  }

  // Update by Stripe customer ID (for recurring-event handlers)
  async function updateByCustomer(customerId: string, status: string) {
    await admin.from("subscriptions")
      .update({ status })
      .eq("stripe_customer_id", customerId);
  }

  const { type, data: { object: obj } } = event;

  try {
    // ── Initial payment via payment link ───────────────────────
    if (type === "checkout.session.completed") {
      const email: string =
        (obj.customer_details as Record<string, unknown>)?.email as string
        || obj.customer_email as string
        || "";
      const customerId = obj.customer as string;

      if (email && customerId) {
        const userId = await userIdByEmail(email);
        if (userId) await upsert(userId, customerId, "active");
      }
    }

    // ── Subscription status change (upgrades, cancellations…) ──
    else if (type === "customer.subscription.updated") {
      const customerId = obj.customer as string;
      const status = mapStatus(obj.status as string);
      await updateByCustomer(customerId, status);
    }

    // ── Subscription cancelled from Stripe dashboard ───────────
    else if (type === "customer.subscription.deleted") {
      await updateByCustomer(obj.customer as string, "canceled");
    }

    // ── Successful recurring payment — keep/restore active ─────
    else if (type === "invoice.paid") {
      const customerId = obj.customer as string;
      // Only restore if not already intentionally canceled
      await admin.from("subscriptions")
        .update({ status: "active" })
        .eq("stripe_customer_id", customerId)
        .neq("status", "canceled");
    }

    // ── Failed payment ─────────────────────────────────────────
    else if (type === "invoice.payment_failed") {
      await updateByCustomer(obj.customer as string, "past_due");
    }

    return json({ received: true });
  } catch (err) {
    console.error("stripe-webhook handler error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
