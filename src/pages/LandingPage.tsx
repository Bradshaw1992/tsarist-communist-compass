import { useNavigate } from "react-router-dom";
import { PenLine, Crosshair, Camera, ArrowRight, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero */}
      <section className="relative flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        {/* Decorative accent line */}
        <div className="mb-8 h-1 w-16 rounded-full bg-accent" />

        <h1 className="max-w-3xl font-serif text-4xl font-bold leading-tight text-primary sm:text-5xl lg:text-6xl">
          The AQA 1H Russia Revision Engine
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Master Tsarist &amp; Communist Russia (1855–1964) with AI-powered Active Recall and Precision Drilling.
        </p>

        <Button
          size="lg"
          className="mt-10 gap-2 bg-accent px-8 py-6 text-base font-semibold text-accent-foreground shadow-lg transition-transform hover:scale-105 hover:bg-accent/90"
          onClick={() => navigate("/app")}
        >
          <BookOpen className="h-5 w-5" />
          Start Revising
          <ArrowRight className="h-4 w-4" />
        </Button>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-card px-6 py-16">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          <FeatureCard
            icon={<PenLine className="h-7 w-7 text-accent" />}
            title="Blank Recall"
            description="Write everything you know from memory, then let AI highlight the gaps you missed against the specification."
          />
          <FeatureCard
            icon={<Crosshair className="h-7 w-7 text-accent" />}
            title="Precision Driller"
            description="Rapid-fire questions on dates, names, and statistics — self-mark and track your weakest areas for targeted revision."
          />
          <FeatureCard
            icon={<Camera className="h-7 w-7 text-accent" />}
            title="Handwriting Scanner"
            description="Working on paper? Photograph your handwritten notes and convert them to text with our Potemkin Scribe AI Gem."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        AQA 7042/1H · Tsarist and Communist Russia, 1855–1964
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-background p-6 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
        {icon}
      </div>
      <h3 className="font-serif text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
