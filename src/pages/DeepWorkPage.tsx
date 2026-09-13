import * as React from "react";
import { toast } from "sonner";
import { Timer as TimerIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useActiveDeepWorkSession,
  useDeepWorkSessions,
  useStartDeepWork,
  useEndDeepWork,
} from "@/hooks/useDeepWork";
import { useTasks } from "@/hooks/useTasks";
import { formatDateFr } from "@/lib/utils";

function useElapsedSeconds(startedAt: string | undefined) {
  const [seconds, setSeconds] = React.useState(0);
  React.useEffect(() => {
    if (!startedAt) return;
    const tick = () => setSeconds(Math.floor((Date.now() - Date.parse(startedAt)) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return seconds;
}

function fmt(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function DeepWorkPage() {
  const { data: active } = useActiveDeepWorkSession();
  const { data: sessions } = useDeepWorkSessions(20);
  const { data: tasks } = useTasks();
  const startSession = useStartDeepWork();
  const endSession = useEndDeepWork();

  const [objective, setObjective] = React.useState("");
  const [taskId, setTaskId] = React.useState("");
  const [minutes, setMinutes] = React.useState("25");
  const [result, setResult] = React.useState("");

  const elapsed = useElapsedSeconds(active?.started_at);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!objective.trim()) return;
    try {
      await startSession.mutateAsync({
        objective: objective.trim(),
        planned_minutes: Number(minutes),
        task_id: taskId || null,
      });
      setObjective("");
      setTaskId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  async function handleEnd() {
    if (!active) return;
    try {
      await endSession.mutateAsync({ id: active.id, result: result.trim() || "—" });
      setResult("");
      toast.success("Session terminée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Deep Work</h1>
        <p className="text-sm text-muted-foreground">Une session, un objectif unique. On mesure le résultat, pas le temps passé.</p>
      </div>

      {active ? (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-4 pt-8 pb-8 text-center">
            <TimerIcon className="h-6 w-6 text-primary" />
            <p className="text-sm text-muted-foreground">Objectif</p>
            <p className="text-lg font-medium">{active.objective}</p>
            <p className="font-mono text-4xl tabular-nums">{fmt(elapsed)}</p>
            <p className="text-xs text-muted-foreground">Prévu : {active.planned_minutes} min</p>
            <div className="flex w-full max-w-sm flex-col gap-2 pt-4">
              <Label className="text-left">Qu'as-tu produit ?</Label>
              <Textarea rows={2} value={result} onChange={(e) => setResult(e.target.value)} />
              <Button onClick={handleEnd}>Terminer la session</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Démarrer une session</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStart} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Objectif unique de la session</Label>
                <Input
                  required
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="Ex. Rédiger la première version du contrat"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Durée</Label>
                  <Select value={minutes} onValueChange={setMinutes}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="25">25 min</SelectItem>
                      <SelectItem value="50">50 min</SelectItem>
                      <SelectItem value="90">90 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Tâche liée (optionnel)</Label>
                  <Select value={taskId} onValueChange={setTaskId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Aucune" />
                    </SelectTrigger>
                    <SelectContent>
                      {(tasks ?? [])
                        .filter((t) => t.status !== "done")
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="self-start">
                Démarrer
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Historique</h2>
        {(sessions ?? [])
          .filter((s) => s.ended_at)
          .map((s) => (
            <Card key={s.id}>
              <CardContent className="flex flex-col gap-1 pt-4 pb-4 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{s.objective}</p>
                  <span className="text-xs text-muted-foreground">{formatDateFr(s.started_at.slice(0, 10))}</span>
                </div>
                {s.result && <p className="text-muted-foreground">→ {s.result}</p>}
              </CardContent>
            </Card>
          ))}
        {(sessions ?? []).filter((s) => s.ended_at).length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune session terminée pour l'instant.</p>
        )}
      </div>
    </div>
  );
}
