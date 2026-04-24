/**
 * Run with: npx tsx scripts/generate-sitemap.ts
 * Writes public/sitemap.xml covering the home page and all 24 /spec/:id
 * landing pages (the prerendered SEO routes).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DOMAIN = new URL("https://tsarist-communist-russia-1h.co.uk").origin;
const SPEC_COUNT = 24; // AQA 7042/1H — fixed: 24 spec points across 4 Parts.

const today = new Date().toISOString().split("T")[0];

let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${DOMAIN}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
`;

for (let id = 1; id <= SPEC_COUNT; id++) {
  xml += `  <url>
    <loc>${DOMAIN}/spec/${id}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
}

xml += `</urlset>
`;

const outPath = path.resolve(__dirname, "../public/sitemap.xml");
fs.writeFileSync(outPath, xml, "utf-8");
console.log(`✅ Sitemap written with ${SPEC_COUNT + 1} URLs → ${outPath}`);
