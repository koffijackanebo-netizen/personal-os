import * as React from "react";
import { AlertTriangle, Check, Clock3, Flame, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TaskFormDialog from "@/components/TaskFormDialog";
import { useTasks, useCompleteTask, usePostponeTask, useUpdateTask } from "@/hooks/useTasks";
import type { Task, TaskStatus, Energy } from "@/types/db";
import { cn, formatDateFr, isOverdue } from "@/lib/utils";

const ENERGY_LABEL: Record<Energy, string> = { high: "🔥 Élevée", medium: "⚡ Moyenne", low: "🌙 Faible" };

/** Suggestion locale et déterministe de "Mode Minimum" — pas d'appel IA nécessaire. */
function suggestMinimumVersion(task: Pick<Task, "title" | "duration_minutes" | "is_discomfort_action">) {
  if (task.is_discomfort_action) {
    return `Fais la version la plus petite possible, maintenant : un seul message, un seul contact, une seule ligne — pour "${task.title}".`;
  }
  if (task.duration_minutes && task.duration_minutes > 15) {
    return `Ouvre ce dont tu as besoin et travaille seulement 5 minutes sur : "${task.title}".`;
  }
  return `Fais uniquement la toute première étape de : "${task.title}". Rien de plus pour l'instant.`;
}

export default function TasksPage() {
  const { data: tasks } = useTasks();
  const completeTask = useCompleteTask();
  const postponeTask = usePostponeTask();
  const updateTask = useUpdateTask();

  const [statusFilter, setStatusFilter] = React.useState<"all" | TaskStatus>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Task | null>(null);
  const [minimumFor, setMinimumFor] = React.useState<Task | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(t: Task) {
    setEditing(t);
    setFormOpen(true);
  }

  const filtered = (tasks ?? []).filter((t) => statusFilter === "all" || t.status === statusFilter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tâches</h1>
          <p className="text-sm text-muted-foreground">Toujours une prochaine action concrète, jamais une intention vague.</p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nouvelle tâche
        </Button>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
        <TabsList>
          <TabsTrigger value="all">Toutes</TabsTrigger>
          <TabsTrigger value="todo">À faire</TabsTrigger>
          <TabsTrigger value="doing">En cours</TabsTrigger>
          <TabsTrigger value="done">Terminées</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-2">
        {filtered.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex flex-col gap-2 pt-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={t.status === "done"}
                    onCheckedChange={() => t.status !== "done" && completeTask.mutate(t.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-0.5"
                  />
                  <div>
                    <p
                      className={cn("cursor-pointer font-medium", t.status === "done" && "text-muted-foreground line-through")}
                      onClick={() => openEdit(t)}
                    >
                      {t.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {t.due_date && (
                        <span className={cn(isOverdue(t.due_date) && t.status !== "done" && "font-medium text-status-bad")}>
                          Échéance {formatDateFr(t.due_date)}
                        </span>
                      )}
                      {t.duration_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock3 className="h-3 w-3" /> {t.duration_minutes} min
                        </span>
                      )}
                      {t.energy_required && <span>{ENERGY_LABEL[t.energy_required]}</span>}
                      {t.is_discomfort_action && (
                        <span className="flex items-center gap-1 text-primary">
                          <Flame className="h-3 w-3" /> Inconfort
                        </span>
                      )}
                      {t.reason && <span className="italic">"{t.reason}"</span>}
                    </div>
                  </div>
                </div>
                <Badge variant={t.priority === 1 ? "bad" : t.priority === 2 ? "warn" : "secondary"}>P{t.priority}</Badge>
              </div>

              {t.postponed_count >= 3 && t.status !== "done" && (
                <div className="flex items-start gap-2 rounded-md bg-status-bad/10 p-2 text-xs text-status-bad">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Cette tâche a été reportée {t.postponed_count} fois. Quel est le véritable obstacle ? Réduis-la, supprime-la,
                    délègue-la, ou fais juste 5 minutes.
                  </span>
                </div>
              )}

              {t.status !== "done" && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setMinimumFor(t)}>
                    <Sparkles className="h-3.5 w-3.5" /> Mode Minimum
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 1);
                      postponeTask.mutate({
                        id: t.id,
                        newDueDate: d.toISOString().slice(0, 10),
                        currentCount: t.postponed_count,
                      });
                    }}
                  >
                    Reporter à demain
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => completeTask.mutate(t.id)}>
                    <Check className="h-3.5 w-3.5" /> Terminer
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Aucune tâche ici.</p>}
      </div>

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} task={editing} />

      {/* Mode Minimum */}
      <Dialog open={!!minimumFor} onOpenChange={(o) => !o && setMinimumFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Mode Minimum
            </DialogTitle>
          </DialogHeader>
          {minimumFor && (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Ne jamais laisser une mauvaise journée devenir une semaine perdue. Fais juste ça :
              </p>
              <p className="rounded-md bg-accent p-3 text-sm font-medium">
                {minimumFor.minimum_version || suggestMinimumVersion(minimumFor)}
              </p>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    completeTask.mutate(minimumFor.id);
                    setMinimumFor(null);
                  }}
                >
                  <Check className="h-4 w-4" /> C'est fait
                </Button>
                <Button
                  onClick={() => {
                    updateTask.mutate({
                      id: minimumFor.id,
                      status: "doing",
                    });
                    setMinimumFor(null);
                  }}
                >
                  Je commence maintenant
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
