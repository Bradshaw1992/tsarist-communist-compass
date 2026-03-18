import { useParams, Navigate } from "react-router-dom";
import { getSpecBySlug } from "@/lib/slugify";
import Index from "./Index";

const TopicPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const spec = slug ? getSpecBySlug(slug) : undefined;

  if (!spec) return <Navigate to="/" replace />;

  // Redirect to home — the topic routes exist for SEO/sitemap purposes
  return <Navigate to={`/?topic=${spec.id}`} replace />;
};

export default TopicPage;
