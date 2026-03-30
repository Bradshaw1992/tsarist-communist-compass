import { useParams, Navigate } from "react-router-dom";
import { getSpecBySlug } from "@/lib/slugify";
import { SEOHead } from "@/components/SEOHead";
import { slugify } from "@/lib/slugify";

const TopicPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const spec = slug ? getSpecBySlug(slug) : undefined;

  if (!spec) return <Navigate to="/" replace />;

  // Render SEO tags before redirect so crawlers can index unique metadata
  return (
    <>
      <SEOHead
        title={`${spec.title} | AQA 1H Russia Compass`}
        description={`Revise ${spec.title} for AQA 7042/1H: Tsarist and Communist Russia 1855–1964. Active recall, precision drilling, and exam-style questions.`}
        canonicalPath={`/topic/${slug}`}
      />
      <Navigate to={`/?topic=${spec.id}`} replace />
    </>
  );
};

export default TopicPage;
