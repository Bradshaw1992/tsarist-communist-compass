import { useParams, Navigate } from "react-router-dom";
import { getSpecBySlug } from "@/lib/slugify";

// /topic/:slug is kept for back-compat with older sitemap entries and any
// external links that used the slug format. It redirects to the canonical
// /spec/:id, which is the route prerendered to static HTML for SEO.
// No SEOHead here — we do NOT want to claim /topic/:slug as canonical, or
// Google sees competing canonicals between this route and /spec/:id.
const TopicPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const spec = slug ? getSpecBySlug(slug) : undefined;

  if (!spec) return <Navigate to="/" replace />;
  return <Navigate to={`/spec/${spec.id}`} replace />;
};

export default TopicPage;
