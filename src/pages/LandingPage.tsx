import { useNavigate } from "react-router-dom";
import { PenLine, Crosshair, Camera, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center px-6 py-24 text-center sm:py-32">
        <div className="mb-6 inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-accent">
          AQA 7042 / 1H
        </div>

        <h1 className="max-w-4xl font-serif text-4xl font-bold leading-[1.15] text-primary sm:text-5xl lg:text-[3.5rem]">
          Tsarist and Communist Russia
          <span className="mt-1 block text-accent">(1855–1964)</span>
        </h1>

        <p className="mt-4 font-serif text-lg italic text-muted-foreground sm:text-xl">
          A-Level History Revision Engine
        </p>

        <div className="mt-3 h-px w-24 bg-accent/40" />

        <Button
          size="lg"
          className="mt-10 gap-2.5 bg-primary px-10 py-6 text-base font-semibold text-primary-foreground shadow-xl transition-all hover:scale-[1.03] hover:shadow-2xl"
          onClick={() => navigate("/app")}
        >
          Launch Revision Engine
          <ArrowRight className="h-4 w-4" />
        </Button>
      </section>

      {/* About / SEO Section */}
      <section className="border-y border-border bg-card px-6 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-2xl font-bold text-primary sm:text-3xl">
            Master the Breadth Study
          </h2>
          <div className="mx-auto mt-4 h-0.5 w-12 rounded-full bg-accent" />
          <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Designed specifically for the AQA 7042 Specification, this tool uses
            AI-powered active recall to help you master the complex political,
            social, and economic changes from the autocracy of Alexander&nbsp;II
            to the fall of Khrushchev. No generic notes—just precision drilling
            and marking based on the official course requirements.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-16">
        <div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
          <FeatureCard
            icon={<PenLine className="h-7 w-7 text-accent" />}
            title="AI Blank Recall"
            description="Get instant academic feedback on your knowledge of the Romanovs and the Soviet State, grounded strictly in our specialised 1H database."
          />
          <FeatureCard
            icon={<Crosshair className="h-7 w-7 text-accent" />}
            title="Precision Driller"
            description="Master the 'Sniper Facts'—dates, edicts, and statistics that differentiate an A from an A*."
          />
          <FeatureCard
            icon={<Camera className="h-7 w-7 text-accent" />}
            title="Handwriting Bridge"
            description="Working on paper? Use our integrated 'Scribe' to turn your handwritten recall into digital text for analysis."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
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
    <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-7 text-center shadow-sm transition-shadow hover:shadow-md">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-accent/20 bg-accent/10">
        {icon}
      </div>
      <h3 className="font-serif text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
