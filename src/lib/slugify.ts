import data from "@/data/revision_database.json";
import type { RevisionDatabase } from "@/types/revision";

const db = data as RevisionDatabase;

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function getSpecBySlug(slug: string) {
  return db.spec_points.find((sp) => slugify(sp.title) === slug);
}

export function getAllTopicSlugs() {
  return db.spec_points.map((sp) => ({
    id: sp.id,
    slug: slugify(sp.title),
    title: sp.title,
    section: sp.section,
  }));
}
