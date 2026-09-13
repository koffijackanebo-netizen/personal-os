import * as React from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { useDomains } from "@/hooks/useDomains";
import { useGoals, useCreateGoal, useUpdateGoal, useDeleteGoal } from "@/hooks/useGoals";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import type { Goal, GoalStatus, Priority } from "@/types/db";
import { formatDateFr } from "@/lib/utils";

const emptyForm = {
  title: "",
  domain_id: "" as string,
  expected_result: "",
  deadline: "",
  indicator: "",
  reason: "",
  priority: 2 as Priority,
  status: "active" as GoalStatus,
  progress: 0,
};

export default function GoalsPage() {
  const { data: domains } = useDomains();
  const { data: goals } = useGoals();
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Goal | null>(null);
  const [form, setForm] = React.useState(emptyForm);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(g: Goal) {
    setEditing(g);
    setForm({
      title: g.title,
      domain_id: g.domain_id ?? "",
      expected_result: g.expected_result ?? "",
      deadline: g.deadline ?? "",
      indicator: g.indicator ?? "",
      reason: g.reason ?? "",
      priority: g.priority,
      status: g.status,
      progress: g.progress,
    });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      domain_id: form.domain_id || null,
      expected_result: form.expected_result || null,
      deadline: form.deadline || null,
      indicator: form.indicator || null,
      reason: form.reason || null,
      priority: form.priority,
      status: form.status,
      progress: form.progress,
    };
    try {
      if (editing) {
        await updateGoal.mutateAsync({ id: editing.id, ...payload });
        toast.success("Objectif mis à jour");
      } else {
        await createGoal.mutateAsync(payload);
        toast.success("Objectif créé");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  function projectsFor(goalId: string) {
    return (projects ?? []).filter((p) => p.goal_id === goalId);
  }

  function hasOpenAction(goalId: string) {
    const linked = projectsFor(goalId);
    if (linked.length === 0) return false;
    return (tasks ?? []).some(
      (t) => t.status !== "done" && t.status !== "cancelled" && linked.some((p) => p.id === t.project_id),
    );
  }

  const grouped = (domains ?? []).map((d) => ({
    domain: d,
    goals: (goals ?? []).filter((g) => g.domain_id === d.id),
  }));
  const orphan = (goals ?? []).filter((g) => !g.domain_id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Objectifs</h1>
          <p className="text-sm text-muted-foreground">Vision → objectif → projet → prochaine action.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nouvel objectif
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier l'objectif" : "Nouvel objectif"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Titre</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex. Développer mon activité e-commerce"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Domaine</Label>
                <Select value={form.domain_id} onValueChange={(v) => setForm({ ...form, domain_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un domaine" />
                  </SelectTrigger>
                  <SelectContent>
                    {(domains ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Résultat attendu</Label>
                <Input
                  value={form.expected_result}
                  onChange={(e) => setForm({ ...form, expected_result: e.target.value })}
                  placeholder="Ex. 500 000 FCFA/mois"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Échéance</Label>
                  <Input
                    type="date"
                    value={form.deadline}
                    onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Indicateur</Label>
                  <Input
                    value={form.indicator}
                    onChange={(e) => setForm({ ...form, indicator: e.target.value })}
                    placeholder="Ex. CA mensuel"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Raison (pourquoi cet objectif compte)</Label>
                <Textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
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
                  <Label>Statut</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as GoalStatus })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="paused">En pause</SelectItem>
                      <SelectItem value="done">Terminé</SelectItem>
                      <SelectItem value="abandoned">Abandonné</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Progression %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={form.progress}
                    onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
                  />
                </div>
              </div>
              <DialogFooter>
                {editing && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={async () => {
                      await deleteGoal.mutateAsync(editing.id);
                      toast.success("Objectif supprimé");
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

      {grouped
        .filter((g) => g.goals.length > 0)
        .map(({ domain, goals: domainGoals }) => (
          <div key={domain.id} className="flex flex-col gap-2">
            <h2 className="text-sm font-medium text-muted-foreground">{domain.name}</h2>
            <div className="flex flex-col gap-2">
              {domainGoals.map((g) => (
                <GoalCard key={g.id} goal={g} hasAction={hasOpenAction(g.id)} projectCount={projectsFor(g.id).length} onClick={() => openEdit(g)} />
              ))}
            </div>
          </div>
        ))}

      {orphan.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Sans domaine</h2>
          <div className="flex flex-col gap-2">
            {orphan.map((g) => (
              <GoalCard key={g.id} goal={g} hasAction={hasOpenAction(g.id)} projectCount={projectsFor(g.id).length} onClick={() => openEdit(g)} />
            ))}
          </div>
        </div>
      )}

      {(goals ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">Aucun objectif pour l'instant. Commence par en créer un.</p>
      )}
    </div>
  );
}

function GoalCard({
  goal,
  hasAction,
  projectCount,
  onClick,
}: {
  goal: Goal;
  hasAction: boolean;
  projectCount: number;
  onClick: () => void;
}) {
  return (
    <Card className="cursor-pointer transition-colors hover:border-primary/40" onClick={onClick}>
      <CardContent className="flex flex-col gap-2 pt-5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium">{goal.title}</p>
          <Badge variant={goal.priority === 1 ? "bad" : goal.priority === 2 ? "warn" : "secondary"}>
            P{goal.priority}
          </Badge>
        </div>
        {goal.expected_result && <p className="text-sm text-muted-foreground">{goal.expected_result}</p>}
        <Progress value={goal.progress} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Échéance {formatDateFr(goal.deadline)}</span>
          <span>{projectCount} projet{projectCount > 1 ? "s" : ""}</span>
          {!hasAction && (
            <span className="flex items-center gap-1 text-status-warn">
              <AlertTriangle className="h-3 w-3" /> Aucune action planifiée
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
