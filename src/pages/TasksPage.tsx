import * as React from "react";
import { AlertTriangle, Check, Clock3, Flame, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useCompleteTask,
  usePostponeTask,
} from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import type { Task, TaskStatus, Energy, Priority } from "@/types/db";
import { cn, formatDateFr, isOverdue, getErrorMessage } from "@/lib/utils";

const ENERGY_LABEL: Record<Energy, string> = { high: "🔥 Élevée", medium: "⚡ Moyenne", low: "🌙 Faible" };

const emptyForm = {
  title: "",
  description: "",
  project_id: "" as string,
  priority: 2 as Priority,
  duration_minutes: "",
  energy_required: "" as Energy | "",
  due_date: "",
  is_discomfort_action: false,
  minimum_version: "",
};

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
  const { data: projects } = useProjects();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const completeTask = useCompleteTask();
  const postponeTask = usePostponeTask();

  const [statusFilter, setStatusFilter] = React.useState<"all" | TaskStatus>("all");
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Task | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [minimumFor, setMinimumFor] = React.useState<Task | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(t: Task) {
    setEditing(t);
    setForm({
      title: t.title,
      description: t.description ?? "",
      project_id: t.project_id ?? "",
      priority: t.priority,
      duration_minutes: t.duration_minutes?.toString() ?? "",
      energy_required: t.energy_required ?? "",
      due_date: t.due_date ?? "",
      is_discomfort_action: t.is_discomfort_action,
      minimum_version: t.minimum_version ?? "",
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      description: form.description || null,
      project_id: form.project_id || null,
      priority: form.priority,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      energy_required: form.energy_required || null,
      due_date: form.due_date || null,
      is_discomfort_action: form.is_discomfort_action,
      minimum_version: form.minimum_version || null,
      status: editing?.status ?? "todo",
      scheduled_at: editing?.scheduled_at ?? null,
    };
    try {
      if (editing) {
        await updateTask.mutateAsync({ id: editing.id, ...payload });
        toast.success("Tâche mise à jour");
      } else {
        await createTask.mutateAsync(payload);
        toast.success("Tâche créée");
      }
      setOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  const filtered = (tasks ?? []).filter((t) => statusFilter === "all" || t.status === statusFilter);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tâches</h1>
          <p className="text-sm text-muted-foreground">Toujours une prochaine action concrète, jamais une intention vague.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nouvelle tâche
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier la tâche" : "Nouvelle tâche"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Titre (action concrète, pas une intention)</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex. Envoyer la relance au client X"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Projet lié</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    {(projects ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Priorité</Label>
                  <Select
                    value={String(form.priority)}
                    onValueChange={(v) => setForm({ ...form, priority: Number(v) as Priority })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Haute</SelectItem>
                      <SelectItem value="2">Moyenne</SelectItem>
                      <SelectItem value="3">Basse</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Énergie requise</Label>
                  <Select
                    value={form.energy_required}
                    onValueChange={(v) => setForm({ ...form, energy_required: v as Energy })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">🔥 Élevée</SelectItem>
                      <SelectItem value="medium">⚡ Moyenne</SelectItem>
                      <SelectItem value="low">🌙 Faible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Durée (min)</Label>
                  <Input
                    type="number"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Échéance</Label>
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.is_discomfort_action}
                  onCheckedChange={(c) => setForm({ ...form, is_discomfort_action: !!c })}
                />
                Action d'inconfort (à faire malgré la réticence)
              </label>
              <DialogFooter>
                {editing && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={async () => {
                      await deleteTask.mutateAsync(editing.id);
                      toast.success("Tâche supprimée");
                      setOpen(false);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Supprimer
                  </Button>
                )}
                <Button type="submit">{editing ? "Enregistrer" : "Créer"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
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
