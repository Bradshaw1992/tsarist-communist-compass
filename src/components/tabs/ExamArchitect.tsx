import { useState } from "react";
import { useExamQuestionsForSpec } from "@/hooks/useRevisionData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ChevronDown, ChevronUp, BookOpen } from "lucide-react";

interface ExamArchitectProps {
  specId: number;
}

export function ExamArchitect({ specId }: ExamArchitectProps) {
  const questions = useExamQuestionsForSpec(specId);

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        No exam questions found for this specification point.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="font-serif text-2xl font-bold text-primary">Exam Architect</h2>
        <p className="text-sm text-muted-foreground">
          Strategic planning — study real AQA questions and mark schemes.
        </p>
      </div>

      <div className="space-y-4">
        {questions.map((q) => (
          <ExamCard key={q.id} question={q} />
        ))}
      </div>
    </div>
  );
}

function ExamCard({ question }: { question: ReturnType<typeof useExamQuestionsForSpec>[0] }) {
  const [showMarkScheme, setShowMarkScheme] = useState(false);

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-primary/30 font-sans text-xs">
            {question.year}
          </Badge>
          <Badge variant="outline" className="border-primary/30 font-sans text-xs">
            Section {question.section}
          </Badge>
          <Badge variant="secondary" className="font-sans text-xs">
            {question.marks} marks
          </Badge>
          <Badge
            variant="secondary"
            className="font-sans text-xs capitalize"
          >
            {question.question_type.replace("_", " ")}
          </Badge>
        </div>
        <CardTitle className="font-serif text-base font-medium leading-relaxed text-foreground">
          <FileText className="mr-2 inline h-4 w-4 text-accent" />
          {question.question_text}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMarkScheme(!showMarkScheme)}
          className="text-sm font-medium text-primary hover:text-primary/80"
        >
          <BookOpen className="mr-1.5 h-4 w-4" />
          {showMarkScheme ? "Hide" : "Reveal"} Mark Scheme
          {showMarkScheme ? (
            <ChevronUp className="ml-1 h-3 w-3" />
          ) : (
            <ChevronDown className="ml-1 h-3 w-3" />
          )}
        </Button>

        {showMarkScheme && (
          <div className="mt-3 animate-flip-in rounded-lg border border-accent/30 bg-accent/5 p-4">
            <h4 className="mb-2 font-serif text-sm font-semibold text-primary">
              Indicative Content
            </h4>
            <ul className="space-y-1.5">
              {question.indicative_content.key_points.map((point, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-sm leading-relaxed text-foreground/80"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
