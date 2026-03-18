import data from "@/data/revision_database.json";
import type { RevisionDatabase } from "@/types/revision";

const db = data as RevisionDatabase;

export function slugify(id: number, title: string): string {
  const base = title
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${id}-${base}`;
}

export function getSpecBySlug(slug: string) {
  const match = slug.match(/^(\d+)-/);
  if (!match) return undefined;
  const id = parseInt(match[1], 10);
  return db.spec_points.find((sp) => sp.id === id);
}

export function getAllTopicSlugs() {
  return db.spec_points.map((sp) => ({
    id: sp.id,
    slug: slugify(sp.id, sp.title),
    title: sp.title,
    section: sp.section,
  }));
}
