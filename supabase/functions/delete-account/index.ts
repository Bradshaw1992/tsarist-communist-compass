// =============================================================================
// delete-account — permanently deletes the signed-in user's account + data.
// =============================================================================
// Satisfies Apple Guideline 5.1.1(v) and Google Play's User Data account-
// deletion policy: the app's Settings → "Delete Account" button calls this.
//
// Flow:
//   1. Authenticate the caller from their JWT — a user may only delete THEMSELF.
//   2. Delete their rows from every user-owned table (service role bypasses RLS).
//   3. Delete the auth.users record itself (the part the stores require).
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically into every Edge Function at runtime — no manual secrets needed.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// User-owned tables and the column holding the user id. Deleted children-first,
// then the auth record. `user_profiles` is keyed by `id`; the rest by `user_id`.
// If you add user-owned tables later, add them here so deletion stays complete.
const USER_TABLES: { table: string; column: string }[] = [
  { table: "user_wrong_answers", column: "user_id" },
  { table: "user_extract_attempts", column: "user_id" },
  { table: "user_blank_recalls", column: "user_id" },
  { table: "user_sessions", column: "user_id" },
  { table: "user_feedback", column: "user_id" },
  { table: "question_flags", column: "user_id" },
  { table: "class_members", column: "user_id" },
  { table: "potemkin_conversations", column: "user_id" },
  { table: "user_profiles", column: "id" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Who is calling? getUser() validates the JWT and returns that user only,
    //    so a caller can never delete anyone else's account.
    const caller = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await caller.auth.getUser();
    if (userErr || !user) return json({ error: "Invalid or expired session" }, 401);

    // 2. Service-role client deletes their data (bypasses RLS). Non-fatal per
    //    table — a missing table/column is logged, not a reason to abort.
    const admin = createClient(url, serviceKey);
    const warnings: string[] = [];
    for (const { table, column } of USER_TABLES) {
      const { error } = await admin.from(table).delete().eq(column, user.id);
      if (error) warnings.push(`${table}: ${error.message}`);
    }

    // 3. Delete the auth identity itself.
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) {
      return json({ error: `Failed to delete account: ${delErr.message}`, warnings }, 500);
    }

    return json({ success: true, warnings }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
