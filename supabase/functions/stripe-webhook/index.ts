// stripe-webhook — grants "Nomenklatura" membership after a successful payment.
//
// Wired to a Stripe Payment Link (one-off £5 "Exam-Year Pass"). The client opens
// the link with `?client_reference_id=<supabase user id>` appended, so the
// checkout.session.completed event tells us exactly which account paid. We then
// upsert a user_entitlements row (tier=nomenklatura, source=stripe, 12 months).
//
// verify_jwt = false in config.toml — Stripe calls this without a Supabase JWT;
// the security boundary is Stripe's webhook SIGNATURE, verified below.
//
// Secrets required (supabase secrets set ...):
//   STRIPE_SECRET_KEY          sk_test_… / sk_live_…
//   STRIPE_WEBHOOK_SECRET      whsec_…   (from the Stripe webhook endpoint)
//   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.

import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const MEMBERSHIP_MONTHS = 12;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  if (!signature) return new Response("Missing signature", { status: 400 });

  // Verify the event really came from Stripe (async: Deno uses SubtleCrypto).
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", (err as Error).message);
    return new Response(`Bad signature: ${(err as Error).message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Only grant on an actually-paid session.
    if (session.payment_status !== "paid" && session.status !== "complete") {
      return new Response(JSON.stringify({ received: true, skipped: "unpaid" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = session.client_reference_id;
    const stripeCustomerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;

    // We key the grant off client_reference_id (the signed-in user's id, set by
    // the Upgrade button). If it's missing — e.g. the raw link was opened
    // without it — we can't safely attribute the payment, so we log and let it
    // pass (200 so Stripe doesn't retry forever); Tom reconciles by email.
    if (!userId) {
      console.warn(
        "checkout.session.completed with no client_reference_id — email:",
        session.customer_details?.email ?? session.customer_email,
        "session:",
        session.id,
      );
      return new Response(JSON.stringify({ received: true, skipped: "no client_reference_id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + MEMBERSHIP_MONTHS);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { error } = await sb.from("user_entitlements").upsert(
      {
        user_id: userId,
        tier: "nomenklatura",
        source: "stripe",
        status: "active",
        current_period_end: periodEnd.toISOString(),
        stripe_customer_id: stripeCustomerId,
        note: "Exam-Year Pass",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      // Return 500 so Stripe retries — we don't want to silently drop a paid grant.
      console.error("Failed to grant entitlement for", userId, error);
      return new Response(`DB error: ${error.message}`, { status: 500 });
    }

    console.log("Granted Nomenklatura to", userId, "until", periodEnd.toISOString());
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
