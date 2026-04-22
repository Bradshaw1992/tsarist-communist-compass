// =============================================================================
// PotemkinChat — floating button + chat sheet for the Potemkin AI tutor
// =============================================================================
// - Button fixed bottom-right on every page inside AppShell.
// - Opens a sheet (mobile-friendly side panel) with the chat history.
// - Anonymous users see a "Sign in to ask Potemkin" state.
// - Calls /functions/v1/potemkin-chat with the user's JWT.
// =============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, Sparkles, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
  cached?: boolean;
}

function newSessionId(): string {
  // RFC4122 v4
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function PotemkinChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sessionId] = useState(newSessionId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [dailyRemaining, setDailyRemaining] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isAnon = !user;

  // Auto-scroll to bottom when new messages land
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, busy]);

  const canSend = useMemo(
    () => !isAnon && !busy && input.trim().length > 0,
    [isAnon, busy, input]
  );

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isAnon || busy) return;

    setBusy(true);
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");

    try {
      const { data, error } = await supabase.functions.invoke("potemkin-chat", {
        body: { session_id: sessionId, message: trimmed },
      });

      if (error) {
        // Supabase functions.invoke surfaces 4xx/5xx as errors; data may still carry the message.
        const payload = (error as { context?: { body?: string } }).context?.body;
        let reason = error.message || "Something went wrong";
        if (payload) {
          try {
            const parsed = JSON.parse(payload);
            if (parsed.error) reason = parsed.error;
          } catch {
            /* ignore */
          }
        }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠️ ${reason}` },
        ]);
        return;
      }

      if (!data?.answer) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "⚠️ Potemkin returned an empty response. Try again." },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, cached: !!data.cached },
      ]);
      if (typeof data.daily_remaining === "number") {
        setDailyRemaining(data.daily_remaining);
      }
    } catch (e) {
      console.error(e);
      toast.error("Couldn't reach Potemkin");
    } finally {
      setBusy(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Ask Potemkin"
        className="fixed bottom-4 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-primary/20 transition-transform hover:scale-105 sm:bottom-6 sm:right-6"
      >
        <Sparkles className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b p-4 text-left">
            <div className="flex items-center justify-between gap-2">
              <div>
                <SheetTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Potemkin
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Your AQA 7042 Russia tutor. Ask about any spec point.
                </SheetDescription>
              </div>
              {dailyRemaining !== null && !isAnon && (
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {dailyRemaining} left today
                </span>
              )}
            </div>
          </SheetHeader>

          {isAnon ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
              <Sparkles className="h-10 w-10 text-muted-foreground/60" />
              <div>
                <h3 className="font-serif text-lg font-semibold">
                  Sign in to ask Potemkin
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Potemkin is free — we just need you signed in so we can stop
                  abuse and give you a sensible daily allowance.
                </p>
              </div>
              <Button asChild>
                <Link to="/login" onClick={() => setOpen(false)}>
                  Sign in
                </Link>
              </Button>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-4"
              >
                {messages.length === 0 && (
                  <div className="mx-auto max-w-sm rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
                    Ask me anything within the AQA 7042 Russia spec — concepts,
                    differences between figures or policies, why things
                    happened. Try:
                    <div className="mt-3 space-y-1.5 text-left text-xs">
                      <button
                        onClick={() =>
                          setInput(
                            "What's the difference between the Kadets and Octobrists?"
                          )
                        }
                        className="block w-full rounded border border-border/60 bg-background px-2.5 py-1.5 text-left hover:border-primary/40"
                      >
                        "What's the difference between the Kadets and Octobrists?"
                      </button>
                      <button
                        onClick={() =>
                          setInput("Why did the NEP replace War Communism?")
                        }
                        className="block w-full rounded border border-border/60 bg-background px-2.5 py-1.5 text-left hover:border-primary/40"
                      >
                        "Why did the NEP replace War Communism?"
                      </button>
                      <button
                        onClick={() =>
                          setInput(
                            "How successful were Khrushchev's agricultural reforms?"
                          )
                        }
                        className="block w-full rounded border border-border/60 bg-background px-2.5 py-1.5 text-left hover:border-primary/40"
                      >
                        "How successful were Khrushchev's agricultural reforms?"
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {messages.map((m, i) => (
                    <div
                      key={i}
                      className={
                        m.role === "user"
                          ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3.5 py-2.5 text-sm text-primary-foreground"
                          : "max-w-[95%] rounded-lg bg-muted/60 px-3.5 py-2.5 text-sm text-foreground"
                      }
                    >
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {busy && (
                    <div className="flex max-w-[95%] items-center gap-2 rounded-lg bg-muted/60 px-3.5 py-2.5 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Thinking…
                    </div>
                  )}
                </div>
              </div>

              {/* Input */}
              <div className="border-t bg-background p-3">
                <div className="flex items-end gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask Potemkin something…"
                    disabled={busy}
                    rows={2}
                    maxLength={2000}
                    className="min-h-0 resize-none"
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!canSend}
                    aria-label="Send"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground/80">
                  Potemkin stays within AQA 7042 scope and draws on textbooks,
                  readings, and mark schemes. Answers aren't guaranteed perfect
                  — verify with your teacher.
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
