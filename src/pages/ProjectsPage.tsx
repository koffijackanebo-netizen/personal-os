import * as React from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGoals } from "@/hooks/useGoals";
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import type { Project, ProjectStatus, Priority } from "@/types/db";
import { formatDateFr, cn, getErrorMessage } from "@/lib/utils";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Actif",
  paused: "En pause",
  done: "Terminé",
  abandoned: "Abandonné",
};

const emptyForm = {
  title: "",
  goal_id: "" as string,
  status: "active" as ProjectStatus,
  priority: 2 as Priority,
  potential_value: "",
  deadline: "",
  result: "",
};

const ACTIVE_PROJECT_WARNING_THRESHOLD = 5;

export default function ProjectsPage() {
  const { data: goals } = useGoals();
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Project | null>(null);
  const [form, setForm] = React.useState(emptyForm);

  const activeProjects = (projects ?? []).filter((p) => p.status === "active");
  const tooManyActive = activeProjects.length > ACTIVE_PROJECT_WARNING_THRESHOLD;
  const recommended = [...activeProjects]
    .sort((a, b) => a.priority - b.priority || (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"))
    .slice(0, 3);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(p: Project) {
    setEditing(p);
    setForm({
      title: p.title,
      goal_id: p.goal_id ?? "",
      status: p.status,
      priority: p.priority,
      potential_value: p.potential_value?.toString() ?? "",
      deadline: p.deadline ?? "",
      result: p.result ?? "",
    });
    setOpen(true);
  }

  function nextActionFor(projectId: string) {
    return (tasks ?? [])
      .filter((t) => t.project_id === projectId && t.status !== "done" && t.status !== "cancelled")
      .sort((a, b) => a.priority - b.priority || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))[0];
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      goal_id: form.goal_id || null,
      status: form.status,
      priority: form.priority,
      potential_value: form.potential_value ? Number(form.potential_value) : null,
      deadline: form.deadline || null,
      result: form.result || null,
    };
    try {
      if (editing) {
        await updateProject.mutateAsync({ id: editing.id, ...payload });
        toast.success("Projet mis à jour");
      } else {
        await createProject.mutateAsync(payload);
        toast.success("Projet créé");
      }
      setOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Projets</h1>
          <p className="text-sm text-muted-foreground">Chaque objectif se décompose en projets, chaque projet en actions.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nouveau projet
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier le projet" : "Nouveau projet"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Titre</Label>
                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Objectif lié</Label>
                <Select value={form.goal_id} onValueChange={(v) => setForm({ ...form, goal_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Aucun" />
                  </SelectTrigger>
                  <SelectContent>
                    {(goals ?? []).map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Statut</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as ProjectStatus })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABEL).map(([v, label]) => (
                        <SelectItem key={v} value={v}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Valeur potentielle</Label>
                  <Input
                    type="number"
                    value={form.potential_value}
                    onChange={(e) => setForm({ ...form, potential_value: e.target.value })}
                    placeholder="FCFA"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Échéance</Label>
                  <Input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Résultat obtenu</Label>
                <Input value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} />
              </div>
              <DialogFooter>
                {editing && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={async () => {
                      await deleteProject.mutateAsync(editing.id);
                      toast.success("Projet supprimé");
                      setOpen(false);
                    }}
                  >
                    Supprimer
                  </Button>
                )}
                <Button type="submit">{editing ? "Enregistrer" : "Créer"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {tooManyActive && (
        <Card className="border-status-warn/50 bg-status-warn/10">
          <CardContent className="flex items-start gap-3 pt-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warn" />
            <div className="text-sm">
              <p className="font-medium">
                Tu as {activeProjects.length} projets actifs. Cela augmente fortement le risque de dispersion.
              </p>
              <p className="text-muted-foreground">
                Voici les 3 qui méritent réellement ton attention cette semaine :{" "}
                {recommended.map((p) => p.title).join(", ")}.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {(projects ?? []).map((p) => {
          const goal = (goals ?? []).find((g) => g.id === p.goal_id);
          const next = nextActionFor(p.id);
          return (
            <Card key={p.id} className="cursor-pointer transition-colors hover:border-primary/40" onClick={() => openEdit(p)}>
              <CardContent className="flex flex-col gap-1.5 pt-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium">{p.title}</p>
                  <Badge variant={p.status === "done" ? "good" : p.status === "abandoned" ? "bad" : "secondary"}>
                    {STATUS_LABEL[p.status]}
                  </Badge>
                </div>
                {goal && <p className="text-xs text-muted-foreground">Objectif : {goal.title}</p>}
                <p className={cn("text-sm", next ? "text-foreground" : "text-status-warn")}>
                  {next ? `📌 ${next.title}` : "Aucune prochaine action définie"}
                </p>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Échéance {formatDateFr(p.deadline)}</span>
                  {p.potential_value != null && <span>{p.potential_value.toLocaleString("fr-FR")} FCFA potentiel</span>}
                  <span>{Math.round(p.time_invested_minutes / 60)}h investies</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {(projects ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun projet pour l'instant.</p>
        )}
      </div>
    </div>
  );
}
