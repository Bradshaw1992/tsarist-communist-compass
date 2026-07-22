# Zhukovsky fact-check for Google Docs

A personal Google Docs add-on that fact-checks A-Level History essays against Tom's
Russia corpus, at three levels:

1. **Highlight mistakes** — amber highlights only (student finds the error).
2. **Highlight + comments** — highlights + a numbered note on *what* is wrong.
3. **Highlight + corrections** — wrong facts are **fixed in place** (green), with a
   note of each change; anything not fixable by a small swap falls back to a flag + note.

Notes render as a numbered "— Zhukovsky notes —" block appended to the end of the
document (Google's native anchored-comment API fails silently in scripts, so this
reliable approach is used instead). It reuses the validated, conservative `CHECKER`
from `zhukovsky` — it flags only clear factual errors, not interpretation.

Scope: works on any **Russia AQA 7042/1H** essay or notes, any formatting (it reads
words only). Two limits: ~2,000 words (12,000 chars) per run, and it's Russia-specific
(the corpus is the point — it can't check other subjects).

**Selection:** if you **select text** before running, it checks only that selection —
use this for documents over the length limit. With nothing selected it checks the
whole document (excluding its own notes block).

## Architecture

```
Google Doc ──(essay text + shared secret)──▶ factcheck edge function
   ▲                                              │  embeds each paragraph (OpenAI)
   │  highlights / fixes / notes                  │  retrieves corpus (potemkin_search)
   └──(issues: quote, anchor, correction, ◀───────┘  fact-checks (Haiku + corpus)
       replacement, why, confidence)
```

The add-on holds only the shared secret; the Anthropic/OpenAI keys stay server-side.
Spans are located by verbatim quote (`findText`), never character offsets.

## Server setup (one-time)

```bash
cd _app
supabase functions deploy factcheck --project-ref prmpzclkdjtrphsemrgm   # config.toml sets verify_jwt=false
openssl rand -hex 24                                                      # generate the secret
supabase secrets set FACTCHECK_SECRET=<value> --project-ref prmpzclkdjtrphsemrgm
```

Then run migration `_rebuild/05_phase1/37_factcheck_usage.sql` in the SQL Editor
(makes fact-check spend count toward the £5/day global cap; the function works
without it). Quick server test:

```bash
curl -s -X POST https://prmpzclkdjtrphsemrgm.functions.supabase.co/factcheck \
  -H "content-type: application/json" -H "x-factcheck-secret: <secret>" \
  -d '{"text":"Stalin launched the first Five-Year Plan in 1932."}'
```

## Personal add-on setup (one-time) — available on ALL your docs

This installs as a private **editor add-on** for your own account, so it appears on
every Google Doc automatically — no per-doc setup, no editor visits.

1. **script.google.com → New project** (standalone, not from a doc). Rename it
   *Zhukovsky Fact-Check*.
2. Paste `Code.gs` over the default file.
3. **⚙ Project Settings → Show appsscript.json** → paste `appsscript.json`.
4. **⚙ Project Settings → Script Properties → Add**: `FACTCHECK_SECRET` = your secret.
   (It lives here, *not* in `Code.gs`, so pasting a future code update never wipes it.) **Save.**
5. **Deploy → Test deployments** → choose the Editor Add-on / Google Docs option →
   **Install**. Approve the auth prompt (unverified-app screen → Advanced → Allow).

Then, on any Doc: **Extensions → Zhukovsky Fact-Check → 1 / 2 / 3 / Clear**.

**To edit later:** change the code in that one standalone project and Save. Test
deployments always run the latest code — no reinstalling.

## Notes & limits

- **Corrections are hard edits, not tracked suggestions** — Apps Script can't create
  Google's "Suggesting"-mode changes. Tier 3 highlights every change green and lists
  them, so nothing is silent, but review before accepting.
- **Cost:** ~1p per essay, bounded by the £5/day global AI spend cap.
- **OpenAI-embeddings dependency:** if fact-check 500s, check the OpenAI balance
  (the same failure that has taken Potemkin down before).
- **Debug:** the deployed function currently returns real error messages
  (`Fact-check failed: …`) to authorised callers — revert to a generic message
  before any wider sharing.
- **Sharing with other staff (later):** this is set up as a *personal* add-on. To
  share, either distribute a copy with the secret hardcoded, or publish a
  domain-internal add-on, and add per-teacher tokens/caps so usage is bounded.
