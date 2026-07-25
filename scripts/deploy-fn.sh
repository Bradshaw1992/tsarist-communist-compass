#!/usr/bin/env bash
#
# Deploy a Supabase edge function ONLY after a pre-flight typecheck.
#
# Why this exists: on 2026-07 the `zhukovsky` marker went 100% down in production
# because a `const` was used six lines before it was declared (a temporal-dead-zone
# ReferenceError — TypeScript code TS2448/TS2454). It threw on every request and
# returned a 500 ("edge function returned a non-2xx status code") to every student.
# `supabase functions deploy` bundles with esbuild and does NOT typecheck, so nothing
# stopped it shipping. `deno check` catches exactly this class of bug.
#
# This codebase's edge functions emit ~12 supabase-js "loose typing" warnings
# (TS2345/TS2538/TS7053) that are NOT runtime-fatal and that FLICKER on and off with
# deno's dep-cache state. If we blocked on those, the gate would fail unpredictably
# and get ignored. So we block ONLY on the deterministic, source-level codes that mean
# "this references something that won't exist at runtime" — PLUS the case where
# `deno check` never actually ran, which must never be treated as a clean pass.
#
# Usage:  ./scripts/deploy-fn.sh zhukovsky
#         DRY_RUN=1 ./scripts/deploy-fn.sh zhukovsky   # typecheck only, no deploy
set -euo pipefail

FN="${1:?usage: ./scripts/deploy-fn.sh <function-name>   e.g. ./scripts/deploy-fn.sh zhukovsky}"
PROJECT_REF="prmpzclkdjtrphsemrgm"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENTRY="$ROOT/supabase/functions/$FN/index.ts"

[ -f "$ENTRY" ] || { echo "✖ No such function: $ENTRY"; exit 1; }

# Runtime-fatal codes: undefined name (2304/2552), use-before-declaration (2448/2454),
# redeclaration (2451), and any syntax error (TS1xxx). Anything here => the function
# will throw at runtime. The flaky loose-typing noise is deliberately NOT listed.
FATAL='TS2448|TS2454|TS2304|TS2552|TS2451|TS1[0-9]{3}'

echo "▶ Pre-flight typecheck: $FN"
# --no-lock: don't read/write a deno.lock (a stale one injects phantom type errors).
# Capture output AND the real exit code without tripping `set -e`.
CHECK_OUT="$(deno check --no-lock "$ENTRY" 2>&1)" && CHECK_RC=0 || CHECK_RC=$?

# 1) A deterministic, runtime-fatal error (the incident class) — always block.
if echo "$CHECK_OUT" | grep -qE "$FATAL"; then
  echo ""
  echo "✖ DEPLOY BLOCKED — $FN has an error that would break at runtime:"
  echo "$CHECK_OUT" | grep -E "$FATAL" | sed 's/^/    /'
  echo ""
  echo "  Fix the above and re-run."
  exit 1
fi

# 2) Non-zero exit with NO type diagnostics at all => deno check never actually ran
#    (bad path, unresolved import, crash). The old `|| true` let this pass as clean;
#    it must not. Benign noise DOES emit TS codes, so this only fires on a real failure.
if [ "$CHECK_RC" -ne 0 ] && ! echo "$CHECK_OUT" | grep -qE 'TS[0-9]+'; then
  echo ""
  echo "✖ DEPLOY BLOCKED — \`deno check\` did not complete (no diagnostics produced):"
  echo "$CHECK_OUT" | tail -6 | sed 's/^/    /'
  exit 1
fi

echo "✓ No runtime-fatal type errors."

if [ "${DRY_RUN:-}" = "1" ]; then
  echo "▷ DRY_RUN set — skipping deploy."
  exit 0
fi

echo "▶ Deploying $FN to $PROJECT_REF …"
supabase functions deploy "$FN" --project-ref "$PROJECT_REF"
echo "✓ $FN deployed."
