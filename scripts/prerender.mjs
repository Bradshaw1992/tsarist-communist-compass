// =============================================================================
// prerender.mjs — build-time static prerender for SEO
// =============================================================================
// Runs after `vite build`. Spawns `vite preview`, walks a list of routes with
// Puppeteer, and writes each route's rendered HTML to dist/<route>/index.html.
// Netlify's 200-status SPA fallback is non-forcing, so these static files are
// served first and only unknown routes fall through to the client-side SPA.
//
// Scope (first deploy): only /spec/1, to verify the pipeline end-to-end before
// rolling out to all 24 spec pages.
// =============================================================================

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}`;
const DIST = path.resolve(process.cwd(), "dist");

// Start small. Once verified on Netlify preview, expand to all 24.
const ROUTES = ["/spec/1"];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(BASE);
      if (res.ok || res.status === 404) return;
    } catch {
      /* not ready yet */
    }
    await sleep(500);
  }
  throw new Error(`vite preview did not start on ${BASE} within 30s`);
}

async function main() {
  console.log("[prerender] starting vite preview…");
  const server = spawn(
    "npx",
    [
      "vite",
      "preview",
      "--port",
      String(PORT),
      "--strictPort",
      "--host",
      "127.0.0.1",
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
  );

  let shuttingDown = false;
  const shutdown = () => {
    if (!shuttingDown) {
      shuttingDown = true;
      try {
        server.kill("SIGTERM");
      } catch {
        /* ignore */
      }
    }
  };
  process.on("exit", shutdown);
  process.on("SIGINT", () => {
    shutdown();
    process.exit(1);
  });

  try {
    await waitForServer();
    console.log("[prerender] server up, launching browser…");

    const browser = await chromium.launch({ headless: true });

    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
      });
      for (const route of ROUTES) {
        console.log(`[prerender] ${route}`);
        const page = await context.newPage();
        const response = await page.goto(BASE + route, {
          waitUntil: "networkidle",
          timeout: 30000,
        });
        if (!response || !response.ok()) {
          throw new Error(
            `${route} returned ${response?.status() ?? "no response"}`,
          );
        }
        // Wait until the H1 is populated — signal that Supabase data loaded
        await page.waitForFunction(
          () => {
            const h1 = document.querySelector("h1");
            return h1 && h1.textContent && h1.textContent.trim().length > 20;
          },
          { timeout: 15000 },
        );
        const html = await page.content();
        const outPath = path.join(DIST, route.slice(1), "index.html");
        await fs.mkdir(path.dirname(outPath), { recursive: true });
        await fs.writeFile(outPath, html, "utf-8");
        console.log(`  ✓ wrote ${outPath} (${html.length} bytes)`);
        await page.close();
      }
      await context.close();
    } finally {
      await browser.close();
    }
  } finally {
    shutdown();
  }
}

main().catch((err) => {
  console.error("[prerender] failed:", err);
  process.exit(1);
});
