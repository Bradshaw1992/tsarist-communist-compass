import { BookOpen, PenLine, FileText, Crosshair, Zap, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function WelcomeGuide() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-8">
      <div className="space-y-2 text-center">
        <div className="flex justify-center">
          <BookOpen className="h-10 w-10 text-accent" />
        </div>
        <h1 className="font-serif text-3xl font-bold text-primary">
          Russia 1855–1964: The Revision Engine
        </h1>
        <p className="text-base text-muted-foreground">
          Precision Recall for the AQA 7042/1H Specification
        </p>
      </div>

      <Card>
        <CardContent className="space-y-6 p-6">
          <h2 className="font-serif text-xl font-semibold text-primary">
            How to use this platform:
          </h2>

          <div className="space-y-5">
            <Step
              icon={<BookOpen className="h-5 w-5 text-accent" />}
              title="Select a Topic"
              description="Use the sidebar to choose one of the 24 specification points."
            />
            <Step
              icon={<PenLine className="h-5 w-5 text-accent" />}
              title="Tab 1: Blank Recall"
              description="Don't look at your notes! Write a summary of the topic first. Use 'Reveal Gaps' to see the conceptual material you missed. (Includes local keyword detection for 'What You Mentioned')."
            />
            <Step
              icon={<FileText className="h-5 w-5 text-accent" />}
              title="Tab 2: Exam Architect"
              description="Practice 25-mark essay planning. Study the Indicative Content to see exactly what historical facts the examiners want to see."
            />
            <Step
              icon={<Crosshair className="h-5 w-5 text-accent" />}
              title="Tab 3: Precision Driller"
              description="Rapid-fire testing of your core knowledge. If you get a question wrong, note the Workpack and Textbook page and go back to your physical notes immediately."
            />
            <Step
              icon={<Zap className="h-5 w-5 text-accent" />}
              title="Tab 4: Specific Knowledge"
              description="Sniper Facts. Randomized, rapid-fire questions on dates, names, and statistics. Tracks your errors for a 'Revision Report' at the end of the session."
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-accent/30 bg-accent/5">
        <CardContent className="flex items-start gap-3 p-5">
          <Target className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <p className="text-sm leading-relaxed text-foreground">
            <strong className="font-semibold">Goal:</strong> Move beyond{" "}
            <em>'knowing'</em> the history to <em>'analysing'</em> it. Focus on
            the <strong>Why</strong>, the <strong>How</strong>, and the{" "}
            <strong>Significance</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Step({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <h3 className="font-sans text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
