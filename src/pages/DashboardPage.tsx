import * as React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, Flame, Target as TargetIcon, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, formatDateFr, isOverdue, todayISO } from "@/lib/utils";
import { useGoals } from "@/hooks/useGoals";
import { useProjects } from "@/hooks/useProjects";
import { useTasks, splitTasksForToday, useCompleteTask } from "@/hooks/useTasks";
import { useHabits, useHabitLogs, useLogHabitToday, useUnlogHabitToday } from "@/hooks/useHabits";
import { useTodayEnergy, useSetTodayEnergy } from "@/hooks/useProfile";
import { useDeepWorkSessions } from "@/hooks/useDeepWork";
import type { Energy } from "@/types/db";

const ENERGY_OPTIONS: { value: Energy; label: string; icon: string }[] = [
  { value: "high", label: "Élevée", icon: "🔥" },
  { value: "medium", label: "Moyenne", icon: "⚡" },
  { value: "low", label: "Faible", icon: "🌙" },
];

export default function DashboardPage() {
  const { data: goals } = useGoals();
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();
  const { data: habits } = useHabits();
  const { data: habitLogs } = useHabitLogs(7);
  const { data: deepWorkSessions } = useDeepWorkSessions(50);
  const energy = useTodayEnergy();
  const setEnergy = useSetTodayEnergy();
  const completeTask = useCompleteTask();
  const logHabit = useLogHabitToday();
  const unlogHabit = useUnlogHabitToday();

  const { dueToday, overdue, all: activeTasks } = splitTasksForToday(tasks);

  // Top 3 : priorité 1 en premier, puis échéance la plus proche.
  const topTasks = [...overdue, ...dueToday, ...activeTasks]
    .filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) === i)
    .sort((a, b) => a.priority - b.priority || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 3);

  const oneThing = topTasks[0] ?? null;

  const goalsWithoutAction = (goals ?? []).filter((g) => {
    if (g.status !== "active") return false;
    const linkedProjects = (projects ?? []).filter((p) => p.goal_id === g.id);
    if (linkedProjects.length === 0) return true;
    const hasTask = (tasks ?? []).some(
      (t) => t.status !== "done" && t.status !== "cancelled" && linkedProjects.some((p) => p.id === t.project_id),
    );
    return !hasTask;
  });

  const stuckTasks = (tasks ?? []).filter((t) => t.postponed_count >= 3 && t.status !== "done");

  const todayHabitDone = (habitId: string) =>
    (habitLogs ?? []).some((l) => l.habit_id === habitId && l.log_date === todayISO());

  const deepWorkMinutesToday = (deepWorkSessions ?? [])
    .filter((s) => s.started_at.slice(0, 10) === todayISO() && s.ended_at)
    .reduce((sum, s) => {
      const mins = (Date.parse(s.ended_at!) - Date.parse(s.started_at)) / 60000;
      return sum + Math.round(mins);
    }, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Aujourd'hui</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Énergie du jour */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-5">
          <span className="text-sm font-medium">Ton énergie aujourd'hui :</span>
          <div className="flex gap-2">
            {ENERGY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setEnergy.mutate(opt.value)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  energy === opt.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input hover:bg-accent",
                )}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Objectifs sans action */}
      {goalsWithoutAction.length > 0 && (
        <Card className="border-status-warn/50 bg-status-warn/10">
          <CardContent className="flex items-start gap-3 pt-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-warn" />
            <div className="text-sm">
              <p className="font-medium">
                {goalsWithoutAction.length} objectif{goalsWithoutAction.length > 1 ? "s" : ""} sans action concrète
              </p>
              <p className="text-muted-foreground">
                {goalsWithoutAction.map((g) => g.title).join(", ")} — défini{goalsWithoutAction.length > 1 ? "s" : ""}, mais aucune prochaine action planifiée.
              </p>
              <Link to="/goals" className="text-primary underline underline-offset-2">
                Ajouter une action →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tâches bloquées (reportées 3x+) */}
      {stuckTasks.length > 0 && (
        <Card className="border-status-bad/50 bg-status-bad/10">
          <CardContent className="flex items-start gap-3 pt-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-status-bad" />
            <div className="text-sm">
              <p className="font-medium">
                {stuckTasks.length} tâche{stuckTasks.length > 1 ? "s" : ""} reportée{stuckTasks.length > 1 ? "s" : ""} 3 fois ou plus
              </p>
              <p className="text-muted-foreground">Quel est le véritable obstacle ? Réduis, délègue ou fais la version minimale.</p>
              <Link to="/tasks" className="text-primary underline underline-offset-2">
                Voir les tâches →
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Une seule chose */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Flame className="h-4 w-4" /> Si tu ne fais qu'une seule chose aujourd'hui
          </CardTitle>
        </CardHeader>
        <CardContent>
          {oneThing ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">{oneThing.title}</p>
                <p className="text-sm text-muted-foreground">
                  {oneThing.duration_minutes ? `${oneThing.duration_minutes} min · ` : ""}
                  Échéance {formatDateFr(oneThing.due_date)}
                </p>
              </div>
              <Button size="sm" onClick={() => completeTask.mutate(oneThing.id)}>
                <Check className="h-4 w-4" /> Fait
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aucune tâche active. Ajoute une prochaine action à un projet.</p>
          )}
        </CardContent>
      </Card>

      {/* Top 3 + prochaine action */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Top 3 priorités</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {topTasks.length === 0 && <p className="text-sm text-muted-foreground">Rien de prioritaire pour l'instant.</p>}
            {topTasks.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={false} onCheckedChange={() => completeTask.mutate(t.id)} />
                <span className={cn(isOverdue(t.due_date) && "text-status-bad")}>{t.title}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">📌 Prochaine action</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{oneThing ? oneThing.title : "Aucune action en attente."}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tâches du jour / retard */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Prévues aujourd'hui ({dueToday.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {dueToday.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={false} onCheckedChange={() => completeTask.mutate(t.id)} />
                <span>{t.title}</span>
              </div>
            ))}
            {dueToday.length === 0 && <p className="text-sm text-muted-foreground">Rien de prévu aujourd'hui.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">En retard ({overdue.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {overdue.map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-sm">
                <Checkbox checked={false} onCheckedChange={() => completeTask.mutate(t.id)} />
                <span className="text-status-bad">{t.title}</span>
              </div>
            ))}
            {overdue.length === 0 && <p className="text-sm text-muted-foreground">Aucun retard. 👍</p>}
          </CardContent>
        </Card>
      </div>

      {/* Habitudes du jour */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Habitudes du jour</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {(habits ?? []).map((h) => {
            const done = todayHabitDone(h.id);
            return (
              <div key={h.id} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={done}
                  onCheckedChange={(checked) =>
                    checked ? logHabit.mutate({ habitId: h.id }) : unlogHabit.mutate(h.id)
                  }
                />
                <span className={cn(done && "text-muted-foreground line-through")}>{h.title}</span>
              </div>
            );
          })}
          {(habits ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Pas encore d'habitude. <Link to="/habits" className="text-primary underline underline-offset-2">Ajoute-en une →</Link>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Progression des objectifs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <TargetIcon className="h-4 w-4" /> Progression des objectifs
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(goals ?? [])
            .filter((g) => g.status === "active")
            .map((g) => (
              <div key={g.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{g.title}</span>
                  <span className="text-muted-foreground">{g.progress}%</span>
                </div>
                <Progress value={g.progress} />
              </div>
            ))}
          {(goals ?? []).filter((g) => g.status === "active").length === 0 && (
            <p className="text-sm text-muted-foreground">
              Aucun objectif actif. <Link to="/goals" className="text-primary underline underline-offset-2">Définis-en un →</Link>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Deep work */}
      <Card>
        <CardContent className="flex items-center gap-3 pt-5 text-sm">
          <Zap className="h-4 w-4 text-primary" />
          <span>
            <strong>{deepWorkMinutesToday} min</strong> de travail profond aujourd'hui
          </span>
          <Link to="/deep-work" className="ml-auto text-primary underline underline-offset-2">
            Démarrer une session →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
