import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

const UNSUBSCRIBE_SECRET = Deno.env.get("UNSUBSCRIBE_SECRET") ?? "fallback-change-me";

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

async function verifyToken(userId: string, token: string): Promise<boolean> {
  const expected = await hmacSign(userId);
  return expected === token;
}

serve(async (req: Request) => {
  const url = new URL(req.url);
  const userId = url.searchParams.get("uid");
  const token = url.searchParams.get("token");

  if (!userId || !token) {
    return new Response(page("Missing parameters", "This unsubscribe link appears to be invalid."), {
      status: 400,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const valid = await verifyToken(userId, token);
  if (!valid) {
    return new Response(page("Invalid link", "This unsubscribe link has expired or is invalid."), {
      status: 403,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { error } = await supabase
    .from("user_profiles")
    .update({ email_opt_out: true })
    .eq("id", userId);

  if (error) {
    return new Response(page("Something went wrong", "Please try again or contact us."), {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response(
    page(
      "Unsubscribed",
      "You've been unsubscribed from Russia Revision Tool emails. You can still use the app as normal.",
    ),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
});

function page(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | Russia Revision Tool</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 80px auto; padding: 0 20px; color: #1e293b; }
  h1 { font-size: 1.5rem; }
  p { color: #475569; line-height: 1.6; }
  a { color: #2563eb; }
</style></head>
<body>
  <h1>${title}</h1>
  <p>${message}</p>
  <p><a href="https://tsarist-communist-russia-1h.co.uk">Back to Russia Revision Tool</a></p>
</body></html>`;
}
