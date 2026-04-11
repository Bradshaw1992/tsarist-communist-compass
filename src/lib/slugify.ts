// Slug format: `${id}-${kebab-title}` — e.g. "3-alexander-ii-iii-as-rulers"
// This file used to read from a static JSON bundle. All content now lives in
// Supabase, so the helpers here are intentionally content-free: they derive
// what they can from the slug itself and let hooks fetch the rest at runtime.

export function slugify(id: number, title: string): string {
  const base = title
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${id}-${base}`;
}

/** Parse `{id, title}` out of a slug. The title is reverse-kebab-cased so
 *  SEO tags can still show a readable string before Supabase data loads. */
export function getSpecBySlug(
  slug: string
): { id: number; title: string } | undefined {
  const match = slug.match(/^(\d+)-(.*)$/);
  if (!match) return undefined;
  const id = parseInt(match[1], 10);
  if (Number.isNaN(id)) return undefined;
  const title = match[2]
    .split("-")
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
  return { id, title };
}
