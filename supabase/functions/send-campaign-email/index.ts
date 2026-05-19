import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const UNSUBSCRIBE_SECRET = Deno.env.get("UNSUBSCRIBE_SECRET") ?? "fallback-change-me";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_SECRET = Deno.env.get("CAMPAIGN_ADMIN_SECRET") ?? "";

const FROM_EMAIL = "Tom <tom@tsarist-communist-russia-1h.co.uk>";
const REPLY_TO = "tom@tsarist-communist-russia-1h.co.uk";
const BATCH_SIZE = 50;
const DELAY_BETWEEN_EMAILS_MS = 200;

async function hmacSign(userId: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(UNSUBSCRIBE_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  sessions: number;
  accuracy: number | null;
  blank_recalls: number;
}

async function fetchRecipients(
  supabase: ReturnType<typeof createClient>,
  campaignKey: string,
): Promise<UserRow[]> {
  const { data, error } = await supabase.rpc("get_campaign_recipients", {
    p_campaign_key: campaignKey,
  });
  if (error) throw new Error(`Failed to fetch recipients: ${error.message}`);
  return data ?? [];
}

function buildEmailHtml(user: UserRow, unsubscribeUrl: string): string {
  const name = user.display_name || "there";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,system-ui,sans-serif;max-width:560px;margin:0 auto;padding:20px;color:#1e293b;line-height:1.6;">

<p style="font-size:18px;font-weight:600;margin-bottom:4px;">Russia Revision Tool</p>
<p style="color:#64748b;margin-top:0;font-size:14px;">AQA 7042 / 1H &middot; Tsarist &amp; Communist Russia</p>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;">

<p>Hi ${name},</p>

<p>When I built this app for my school, I really never thought it would take off in the way it has. We&rsquo;ve had thousands of users from nearly 40 different schools &mdash; and I&rsquo;ve loved every minute of watching it grow.</p>

<p><strong>Share it forward.</strong> If the Russia Revision Tool helped you, please pass it on to your teacher, your friends taking Russia next year, or anyone you think would benefit. The app is staying up over summer, and in September it&rsquo;ll be back with more questions, new features, and worked examples for extract and essay technique.</p>

<p style="margin:24px 0;">
  <a href="https://tsarist-communist-russia-1h.co.uk" style="background:#1e293b;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500;">Share the link: tsarist-communist-russia-1h.co.uk</a>
</p>

<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:24px 0;">
  <p style="margin:0 0 8px;font-weight:600;color:#92400e;">Help keep the Russia Revision Tool running</p>
  <p style="margin:0;color:#78350f;font-size:14px;">I&rsquo;m a teacher, not a company. There&rsquo;s no profit here &mdash; just hosting, AI, and domain costs that add up. If you found it useful and you&rsquo;re able to, a small contribution helps keep it free and available for everyone.</p>
  <p style="margin:12px 0 0;">
    <a href="https://buy.stripe.com/8x26oz9osaJb8j1eQr5wI00" style="color:#92400e;font-weight:500;">Contribute &rarr;</a>
  </p>
</div>

<p><strong>I&rsquo;d love your feedback.</strong> What worked? What didn&rsquo;t? What would you change? Even a couple of sentences would help me make it better for next year&rsquo;s students. Just log in, click your name in the top right, and hit &ldquo;Send Feedback.&rdquo;</p>

<p style="margin:24px 0;">
  <a href="https://tsarist-communist-russia-1h.co.uk/general?feedback=true" style="background:#fff;color:#1e293b;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:500;border:1px solid #cbd5e1;">Log in and leave feedback</a>
</p>

<p>If you&rsquo;re a teacher and you&rsquo;d like to talk about using the Russia Revision Tool with your classes, or if you have any questions at all, just reply to this email &mdash; it comes straight to me.</p>

<p>Good luck with the rest of your exams.</p>

<p>Tom<br><span style="color:#64748b;font-size:14px;">A-Level History teacher &amp; builder of Russia Revision Tool</span></p>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

<p style="font-size:12px;color:#94a3b8;">
  You&rsquo;re receiving this because you have an account on Russia Revision Tool.
  <a href="${unsubscribeUrl}" style="color:#94a3b8;">Unsubscribe from future emails</a>
</p>

</body></html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  }

  const body = await req.json().catch(() => ({}));
  const { secret, campaign_key, dry_run, test_email } = body as {
    secret?: string;
    campaign_key?: string;
    dry_run?: boolean;
    test_email?: string;
  };

  if (!secret || secret !== ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  if (!campaign_key) {
    return new Response(JSON.stringify({ error: "campaign_key required" }), { status: 400 });
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let users: UserRow[];
  try {
    users = await fetchRecipients(supabase, campaign_key);
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 });
  }

  if (test_email) {
    const testUser: UserRow = {
      id: "test",
      email: test_email,
      display_name: "Tom",
      sessions: 0,
      accuracy: null,
      blank_recalls: 0,
    };
    const html = buildEmailHtml(testUser, "#");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        reply_to: REPLY_TO,
        to: [test_email],
        subject: "Thank you for using Russia Revision Tool",
        html,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: err }), { status: 500 });
    }
    return new Response(
      JSON.stringify({ test_sent_to: test_email }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  if (dry_run) {
    return new Response(
      JSON.stringify({
        dry_run: true,
        campaign_key,
        recipients: users.length,
        sample: users.slice(0, 3).map((u) => ({
          display_name: u.display_name,
          sessions: u.sessions,
          accuracy: u.accuracy,
          blank_recalls: u.blank_recalls,
        })),
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const user of users) {
    try {
      const token = await hmacSign(user.id);
      const unsubUrl = `${SUPABASE_URL}/functions/v1/email-unsubscribe?uid=${user.id}&token=${token}`;
      const html = buildEmailHtml(user, unsubUrl);

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          reply_to: REPLY_TO,
          to: [user.email],
          subject: "Thank you for using Russia Revision Tool",
          html,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        errors.push(`${user.email}: ${err}`);
        failed++;
        continue;
      }

      await supabase.from("email_sends").insert({
        campaign_key,
        user_id: user.id,
        status: "sent",
      });

      sent++;
      if (sent % BATCH_SIZE === 0) {
        await sleep(1000);
      } else {
        await sleep(DELAY_BETWEEN_EMAILS_MS);
      }
    } catch (e) {
      errors.push(`${user.email}: ${(e as Error).message}`);
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ campaign_key, sent, failed, errors: errors.slice(0, 10) }),
    { headers: { "Content-Type": "application/json" } },
  );
});
