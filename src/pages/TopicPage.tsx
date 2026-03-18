import { useParams, Navigate } from "react-router-dom";
import { getSpecBySlug } from "@/lib/slugify";
import Index from "./Index";

const TopicPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const spec = slug ? getSpecBySlug(slug) : undefined;

  if (!spec) return <Navigate to="/" replace />;

  return <Index initialSpecId={spec.id} />;
};

export default TopicPage;
