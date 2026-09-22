import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDomains } from "@/hooks/useDomains";
import { useCreateGoal, useUpdateGoal, useDeleteGoal } from "@/hooks/useGoals";
import type { Goal, GoalStatus, Priority } from "@/types/db";
import { getErrorMessage } from "@/lib/utils";

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

/**
 * Dialogue de création/édition d'un objectif — utilisé par la page Objectifs et par le
 * Dashboard (clic sur un objectif), pour retrouver "pourquoi" il a été décidé (champ Raison)
 * depuis n'importe où dans l'app.
 */
export default function GoalFormDialog({
  open,
  onOpenChange,
  goal,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = création d'un nouvel objectif */
  goal: Goal | null;
}) {
  const { data: domains } = useDomains();
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const [form, setForm] = React.useState(emptyForm);

  React.useEffect(() => {
    if (!open) return;
    if (goal) {
      setForm({
        title: goal.title,
        domain_id: goal.domain_id ?? "",
        expected_result: goal.expected_result ?? "",
        deadline: goal.deadline ?? "",
        indicator: goal.indicator ?? "",
        reason: goal.reason ?? "",
        priority: goal.priority,
        status: goal.status,
        progress: goal.progress,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, goal]);

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
      if (goal) {
        await updateGoal.mutateAsync({ id: goal.id, ...payload });
        toast.success("Objectif mis à jour");
      } else {
        await createGoal.mutateAsync(payload);
        toast.success("Objectif créé");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal ? "Modifier l'objectif" : "Nouvel objectif"}</DialogTitle>
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
              <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
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
            <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} />
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
            {goal && (
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  await deleteGoal.mutateAsync(goal.id);
                  toast.success("Objectif supprimé");
                  onOpenChange(false);
                }}
              >
                Supprimer
              </Button>
            )}
            <Button type="submit">{goal ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
