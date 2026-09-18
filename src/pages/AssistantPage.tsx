import * as React from "react";
import { BookOpen, Check, Send, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, getErrorMessage, todayISO } from "@/lib/utils";
import { useMentorContext, useSaveMentorContext } from "@/hooks/useMentorContext";

interface Message {
  role: "user" | "assistant";
  content: string;
  memorySuggestion?: string | null;
}

const SUGGESTIONS = [
  "Analyse ma journée",
  "Aide-moi à prioriser mes tâches",
  "Je suis bloqué sur une décision",
  "Pourquoi je procrastine sur ce projet ?",
];

export default function AssistantPage() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [contextOpen, setContextOpen] = React.useState(false);
  const [handledSuggestions, setHandledSuggestions] = React.useState<Set<number>>(new Set());
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { data: mentorContext } = useMentorContext();
  const saveMentorContext = useSaveMentorContext();
  const [contextDraft, setContextDraft] = React.useState("");

  React.useEffect(() => {
    if (mentorContext !== undefined) setContextDraft(mentorContext);
  }, [mentorContext]);

  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("assistant", {
        body: { message: trimmed, history: messages.map(({ role, content }) => ({ role, content })) },
      });
      if (error) throw error;
      setMessages([
        ...nextMessages,
        { role: "assistant", content: data.reply as string, memorySuggestion: data.memorySuggestion ?? null },
      ]);
    } catch (err) {
      toast.error(getErrorMessage(err));
      setMessages(nextMessages);
    } finally {
      setLoading(false);
    }
  }

  async function acceptSuggestion(index: number, note: string) {
    const current = mentorContext ?? "";
    const updated = `${current.trimEnd()}\n- ${todayISO()} : ${note}\n`;
    try {
      await saveMentorContext.mutateAsync(updated);
      setHandledSuggestions((s) => new Set(s).add(index));
      toast.success("Ajouté au contexte mentor");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  function dismissSuggestion(index: number) {
    setHandledSuggestions((s) => new Set(s).add(index));
  }

  async function saveContext() {
    try {
      await saveMentorContext.mutateAsync(contextDraft);
      toast.success("Contexte enregistré");
      setContextOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col md:h-[calc(100dvh-4rem)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Assistant</h1>
          <p className="text-sm text-muted-foreground">Calme, direct, stratégique. Pas de motivation gratuite.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setContextOpen(true)}>
          <BookOpen className="h-4 w-4" /> Contexte
        </Button>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto rounded-lg border bg-card p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">Pose une question, ou choisis :</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border px-3 py-1.5 text-xs hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((m, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                  m.role === "user" ? "self-end bg-primary text-primary-foreground" : "self-start bg-accent",
                )}
              >
                {m.content}
              </div>
              {m.memorySuggestion && !handledSuggestions.has(i) && (
                <div className="flex max-w-[85%] flex-col gap-2 self-start rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
                  <p className="flex items-center gap-1.5 font-medium">
                    <BookOpen className="h-3.5 w-3.5" /> Le mentor propose d'ajouter au contexte :
                  </p>
                  <p className="text-muted-foreground">{m.memorySuggestion}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => acceptSuggestion(i, m.memorySuggestion!)}>
                      <Check className="h-3.5 w-3.5" /> Ajouter
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => dismissSuggestion(i)}>
                      <X className="h-3.5 w-3.5" /> Ignorer
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {loading && <div className="self-start rounded-lg bg-accent px-3 py-2 text-sm text-muted-foreground">…</div>}
          <div ref={scrollRef} />
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex gap-2"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Écris ton message…"
          className="resize-none"
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>

      <Dialog open={contextOpen} onOpenChange={setContextOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Contexte mentor
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Ce que le mentor lit à chaque conversation : tes objectifs actuels, l'état de tes projets, tes
            décisions en cours. Modifie-le librement — le mentor peut aussi proposer des ajouts après une
            conversation.
          </p>
          <Textarea
            value={contextDraft}
            onChange={(e) => setContextDraft(e.target.value)}
            rows={16}
            className="font-mono text-xs"
          />
          <DialogFooter>
            <Button onClick={saveContext} disabled={saveMentorContext.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
