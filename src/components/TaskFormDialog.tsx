import * as React from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTask, useUpdateTask, useDeleteTask } from "@/hooks/useTasks";
import { useProjects } from "@/hooks/useProjects";
import type { Task, Energy, Priority } from "@/types/db";
import { getErrorMessage } from "@/lib/utils";

const emptyForm = {
  title: "",
  reason: "",
  description: "",
  project_id: "" as string,
  priority: 2 as Priority,
  duration_minutes: "",
  energy_required: "" as Energy | "",
  due_date: "",
  is_discomfort_action: false,
};

/**
 * Dialogue de création/édition d'une tâche — utilisé par la page Tâches et par le
 * Dashboard (clic sur une tâche), pour qu'on puisse retrouver "pourquoi" une tâche
 * a été décidée (champ Raison) depuis n'importe où dans l'app.
 */
export default function TaskFormDialog({
  open,
  onOpenChange,
  task,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = création d'une nouvelle tâche */
  task: Task | null;
}) {
  const { data: projects } = useProjects();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [form, setForm] = React.useState(emptyForm);

  React.useEffect(() => {
    if (!open) return;
    if (task) {
      setForm({
        title: task.title,
        reason: task.reason ?? "",
        description: task.description ?? "",
        project_id: task.project_id ?? "",
        priority: task.priority,
        duration_minutes: task.duration_minutes?.toString() ?? "",
        energy_required: task.energy_required ?? "",
        due_date: task.due_date ?? "",
        is_discomfort_action: task.is_discomfort_action,
      });
    } else {
      setForm(emptyForm);
    }
  }, [open, task]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      reason: form.reason || null,
      description: form.description || null,
      project_id: form.project_id || null,
      priority: form.priority,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      energy_required: form.energy_required || null,
      due_date: form.due_date || null,
      is_discomfort_action: form.is_discomfort_action,
      status: task?.status ?? "todo",
      scheduled_at: task?.scheduled_at ?? null,
      minimum_version: task?.minimum_version ?? null,
    };
    try {
      if (task) {
        await updateTask.mutateAsync({ id: task.id, ...payload });
        toast.success("Tâche mise à jour");
      } else {
        await createTask.mutateAsync(payload);
        toast.success("Tâche créée");
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
          <DialogTitle>{task ? "Modifier la tâche" : "Nouvelle tâche"}</DialogTitle>
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
            <Label>Pourquoi cette tâche ? (raison / contexte de la décision)</Label>
            <Textarea
              rows={2}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Ex. Le client a relancé 2 fois, risque de perdre la vente si pas de réponse cette semaine"
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
            {task && (
              <Button
                type="button"
                variant="destructive"
                onClick={async () => {
                  await deleteTask.mutateAsync(task.id);
                  toast.success("Tâche supprimée");
                  onOpenChange(false);
                }}
              >
                <Trash2 className="h-4 w-4" /> Supprimer
              </Button>
            )}
            <Button type="submit">{task ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
