import * as React from "react";
import { Lightbulb, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useHabits,
  useHabitLogs,
  useCreateHabit,
  useArchiveHabit,
  useLogHabitToday,
  useUnlogHabitToday,
  computeHabitStats,
} from "@/hooks/useHabits";
import type { HabitContext, HabitFrequency } from "@/types/db";
import { todayISO } from "@/lib/utils";

const emptyForm = {
  title: "",
  description: "",
  frequency: "daily" as HabitFrequency,
  preferred_context: "any" as HabitContext,
};

export default function HabitsPage() {
  const { data: habits } = useHabits();
  const { data: logs } = useHabitLogs(60);
  const createHabit = useCreateHabit();
  const archiveHabit = useArchiveHabit();
  const logHabit = useLogHabitToday();
  const unlogHabit = useUnlogHabitToday();

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    try {
      await createHabit.mutateAsync({
        title: form.title.trim(),
        description: form.description || null,
        frequency: form.frequency,
        preferred_context: form.preferred_context,
        target_days_per_week: null,
      });
      toast.success("Habitude créée");
      setForm(emptyForm);
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Habitudes</h1>
          <p className="text-sm text-muted-foreground">Régularité, pas de streak superficiel.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" /> Nouvelle habitude
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle habitude</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Titre</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex. 20 min de sport"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Contexte préféré</Label>
                <Select
                  value={form.preferred_context}
                  onValueChange={(v) => setForm({ ...form, preferred_context: v as HabitContext })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Matin</SelectItem>
                    <SelectItem value="evening">Soir</SelectItem>
                    <SelectItem value="any">Indifférent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit">Créer</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-3">
        {(habits ?? []).map((h) => {
          const habitLogs = (logs ?? []).filter((l) => l.habit_id === h.id);
          const stats = computeHabitStats(h, habitLogs);
          const doneToday = habitLogs.some((l) => l.log_date === todayISO());

          return (
            <Card key={h.id}>
              <CardContent className="flex flex-col gap-2 pt-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={doneToday}
                      onCheckedChange={(c) =>
                        c
                          ? logHabit.mutate({ habitId: h.id, context: h.preferred_context ?? "any" })
                          : unlogHabit.mutate(h.id)
                      }
                    />
                    <p className="font-medium">{h.title}</p>
                  </div>
                  <button
                    className="text-xs text-muted-foreground hover:text-status-bad"
                    onClick={() => archiveHabit.mutate(h.id)}
                  >
                    Archiver
                  </button>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Taux d'exécution : {stats.executionRate}%</span>
                  <span>Série actuelle : {stats.currentStreak} j</span>
                  <span>{stats.missedRecently} jour(s) manqué(s) sur 7</span>
                </div>
                {stats.fragileContext && (
                  <div className="flex items-start gap-2 rounded-md bg-accent p-2 text-xs">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>
                      Tu réussis surtout le {stats.fragileContext.strong === "morning" ? "matin" : "soir"}, beaucoup moins
                      le {stats.fragileContext.weak === "morning" ? "matin" : "soir"}. Essaie de la déplacer au{" "}
                      {stats.fragileContext.strong === "morning" ? "matin" : "soir"} plutôt que de te forcer davantage.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {(habits ?? []).length === 0 && <p className="text-sm text-muted-foreground">Aucune habitude pour l'instant.</p>}
      </div>
    </div>
  );
}
