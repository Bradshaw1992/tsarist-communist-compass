/**
 * Run with: npx tsx scripts/generate-sitemap.ts
 * Reads revision_database.json and writes public/sitemap.xml
 */
import fs from "fs";
import path from "path";

const DOMAIN = "https://tsarist-communist-russia-1h.co.uk";

interface SpecPoint {
  id: number;
  title: string;
}

const dbPath = path.resolve(__dirname, "../src/data/revision_database.json");
const db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));

function slugify(id: number, title: string): string {
  const base = title
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${id}-${base}`;
}

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

for (const sp of db.spec_points as SpecPoint[]) {
  const slug = slugify(sp.id, sp.title);
  xml += `  <url>
    <loc>${DOMAIN}/topic/${slug}</loc>
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
console.log(`✅ Sitemap written with ${db.spec_points.length + 1} URLs → ${outPath}`);
