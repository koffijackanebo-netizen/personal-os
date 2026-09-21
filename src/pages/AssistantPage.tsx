import * as React from "react";
import { BookOpen, Check, FolderKanban, ListChecks, Send, Target, X } from "lucide-react";
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
import { useAssistantMessages, useSaveAssistantMessage } from "@/hooks/useAssistantMessages";
import { useDomains } from "@/hooks/useDomains";
import { useGoals, useCreateGoal } from "@/hooks/useGoals";
import { useProjects, useCreateProject } from "@/hooks/useProjects";
import { useCreateTask } from "@/hooks/useTasks";
import type { Energy, Priority } from "@/types/db";

interface GoalProposal {
  title: string;
  domain?: string;
  expected_result?: string;
  indicator?: string;
  reason?: string;
  priority?: Priority;
  deadline?: string;
}
interface ProjectProposal {
  title: string;
  goal_title?: string;
  priority?: Priority;
  potential_value?: number;
  deadline?: string;
}
interface TaskProposal {
  title: string;
  project_title?: string;
  priority?: Priority;
  duration_minutes?: number;
  energy_required?: Energy;
  due_date?: string;
  is_discomfort_action?: boolean;
}
interface Proposals {
  goals: GoalProposal[];
  projects: ProjectProposal[];
  tasks: TaskProposal[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
  memorySuggestion?: string | null;
  proposals?: Proposals;
}

const SUGGESTIONS = [
  "Analyse ma journée",
  "Aide-moi à prioriser mes tâches",
  "Je suis bloqué sur une décision",
  "Pourquoi je procrastine sur ce projet ?",
];

function findByTitle<T extends { title: string }>(list: T[] | undefined, title: string | undefined): T | undefined {
  if (!list || !title) return undefined;
  const needle = title.trim().toLowerCase();
  return list.find((x) => x.title.trim().toLowerCase() === needle);
}

export default function AssistantPage() {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [contextOpen, setContextOpen] = React.useState(false);
  const [handled, setHandled] = React.useState<Set<string>>(new Set());
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { data: mentorContext } = useMentorContext();
  const saveMentorContext = useSaveMentorContext();
  const [contextDraft, setContextDraft] = React.useState("");

  const { data: history, isLoading: historyLoading, error: historyError } = useAssistantMessages();
  const saveMessage = useSaveAssistantMessage();
  const hydrated = React.useRef(false);

  React.useEffect(() => {
    if (historyError) {
      toast.error(`Historique non chargé : ${getErrorMessage(historyError)}`);
    }
  }, [historyError]);

  const { data: domains } = useDomains();
  const { data: goals } = useGoals();
  const { data: projects } = useProjects();
  const createGoal = useCreateGoal();
  const createProject = useCreateProject();
  const createTask = useCreateTask();

  React.useEffect(() => {
    if (mentorContext !== undefined) setContextDraft(mentorContext);
  }, [mentorContext]);

  // Charge l'historique persistant une seule fois — les suggestions (mémoire, propositions)
  // ne sont pas ré-affichées pour les anciens messages, pour éviter de recréer un doublon
  // en acceptant à nouveau une proposition déjà traitée lors d'une session précédente.
  React.useEffect(() => {
    if (hydrated.current || !history) return;
    hydrated.current = true;
    if (history.length > 0) {
      setMessages(history.map((m) => ({ role: m.role, content: m.content })));
    }
  }, [history]);

  React.useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function markHandled(key: string) {
    setHandled((s) => new Set(s).add(key));
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    saveMessage.mutate(
      { role: "user", content: trimmed },
      { onError: (err) => toast.error(`Message non sauvegardé : ${getErrorMessage(err)}`) },
    );

    try {
      // On limite l'historique envoyé au modèle pour garder des réponses rapides et
      // un coût raisonnable — le contexte mentor porte la mémoire long terme, pas besoin
      // de rejouer toute la conversation depuis le début à chaque message.
      const recentHistory = messages.slice(-24).map(({ role, content }) => ({ role, content }));
      const { data, error } = await supabase.functions.invoke("assistant", {
        body: { message: trimmed, history: recentHistory },
      });
      if (error) throw error;
      const reply = data.reply as string;
      const memorySuggestion = (data.memorySuggestion ?? null) as string | null;
      const proposals = data.proposals as Proposals | undefined;
      setMessages([...nextMessages, { role: "assistant", content: reply, memorySuggestion, proposals }]);
      saveMessage.mutate(
        { role: "assistant", content: reply, memory_suggestion: memorySuggestion, proposals },
        { onError: (err) => toast.error(`Réponse non sauvegardée : ${getErrorMessage(err)}`) },
      );
    } catch (err) {
      toast.error(getErrorMessage(err));
      setMessages(nextMessages);
    } finally {
      setLoading(false);
    }
  }

  async function acceptMemory(key: string, note: string) {
    const current = mentorContext ?? "";
    const updated = `${current.trimEnd()}\n- ${todayISO()} : ${note}\n`;
    try {
      await saveMentorContext.mutateAsync(updated);
      markHandled(key);
      toast.success("Ajouté au contexte mentor");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function acceptGoal(key: string, p: GoalProposal) {
    const domain = findByTitle(domains?.map((d) => ({ title: d.name, id: d.id })), p.domain);
    try {
      await createGoal.mutateAsync({
        title: p.title,
        domain_id: domain?.id ?? null,
        expected_result: p.expected_result ?? null,
        indicator: p.indicator ?? null,
        reason: p.reason ?? null,
        priority: p.priority ?? 2,
        deadline: p.deadline ?? null,
        status: "active",
        progress: 0,
      });
      markHandled(key);
      toast.success("Objectif créé");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function acceptProject(key: string, p: ProjectProposal) {
    const goal = findByTitle(goals, p.goal_title);
    try {
      await createProject.mutateAsync({
        title: p.title,
        goal_id: goal?.id ?? null,
        priority: p.priority ?? 2,
        potential_value: p.potential_value ?? null,
        deadline: p.deadline ?? null,
        status: "active",
        result: null,
        time_invested_minutes: 0,
      });
      markHandled(key);
      toast.success("Projet créé");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function acceptTask(key: string, p: TaskProposal) {
    const project = findByTitle(projects, p.project_title);
    try {
      await createTask.mutateAsync({
        title: p.title,
        project_id: project?.id ?? null,
        priority: p.priority ?? 2,
        duration_minutes: p.duration_minutes ?? null,
        energy_required: p.energy_required ?? null,
        due_date: p.due_date ?? null,
        is_discomfort_action: p.is_discomfort_action ?? false,
        status: "todo",
        description: null,
        scheduled_at: null,
        minimum_version: null,
      });
      markHandled(key);
      toast.success("Tâche créée");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
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
        {historyLoading && messages.length === 0 && (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Chargement…</div>
        )}
        {!historyLoading && messages.length === 0 && (
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

              {m.memorySuggestion &&
                (() => {
                  const key = `${i}-memory`;
                  if (handled.has(key)) return null;
                  return (
                    <SuggestionCard
                      icon={<BookOpen className="h-3.5 w-3.5" />}
                      label="Le mentor propose d'ajouter au contexte :"
                      summary={m.memorySuggestion}
                      onAccept={() => acceptMemory(key, m.memorySuggestion!)}
                      onDismiss={() => markHandled(key)}
                    />
                  );
                })()}

              {m.proposals?.goals.map((p, j) => {
                const key = `${i}-goal-${j}`;
                if (handled.has(key)) return null;
                return (
                  <SuggestionCard
                    key={key}
                    icon={<Target className="h-3.5 w-3.5" />}
                    label="Nouvel objectif proposé :"
                    summary={p.title}
                    detail={p.expected_result}
                    onAccept={() => acceptGoal(key, p)}
                    onDismiss={() => markHandled(key)}
                  />
                );
              })}

              {m.proposals?.projects.map((p, j) => {
                const key = `${i}-project-${j}`;
                if (handled.has(key)) return null;
                return (
                  <SuggestionCard
                    key={key}
                    icon={<FolderKanban className="h-3.5 w-3.5" />}
                    label="Nouveau projet proposé :"
                    summary={p.title}
                    detail={p.goal_title ? `Lié à l'objectif : ${p.goal_title}` : undefined}
                    onAccept={() => acceptProject(key, p)}
                    onDismiss={() => markHandled(key)}
                  />
                );
              })}

              {m.proposals?.tasks.map((p, j) => {
                const key = `${i}-task-${j}`;
                if (handled.has(key)) return null;
                return (
                  <SuggestionCard
                    key={key}
                    icon={<ListChecks className="h-3.5 w-3.5" />}
                    label="Nouvelle tâche proposée :"
                    summary={p.title}
                    detail={p.project_title ? `Liée au projet : ${p.project_title}` : undefined}
                    onAccept={() => acceptTask(key, p)}
                    onDismiss={() => markHandled(key)}
                  />
                );
              })}
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

function SuggestionCard({
  icon,
  label,
  summary,
  detail,
  onAccept,
  onDismiss,
}: {
  icon: React.ReactNode;
  label: string;
  summary: string;
  detail?: string;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex max-w-[85%] flex-col gap-2 self-start rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs">
      <p className="flex items-center gap-1.5 font-medium">
        {icon} {label}
      </p>
      <p className="text-muted-foreground">
        {summary}
        {detail ? ` — ${detail}` : ""}
      </p>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onAccept}>
          <Check className="h-3.5 w-3.5" /> Créer
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          <X className="h-3.5 w-3.5" /> Ignorer
        </Button>
      </div>
    </div>
  );
}
