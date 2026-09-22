import * as React from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import GoalFormDialog from "@/components/GoalFormDialog";
import { useDomains } from "@/hooks/useDomains";
import { useGoals } from "@/hooks/useGoals";
import { useProjects } from "@/hooks/useProjects";
import { useTasks } from "@/hooks/useTasks";
import type { Goal } from "@/types/db";
import { formatDateFr } from "@/lib/utils";

export default function GoalsPage() {
  const { data: domains } = useDomains();
  const { data: goals } = useGoals();
  const { data: projects } = useProjects();
  const { data: tasks } = useTasks();

  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Goal | null>(null);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(g: Goal) {
    setEditing(g);
    setOpen(true);
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
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Nouvel objectif
        </Button>
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

      <GoalFormDialog open={open} onOpenChange={setOpen} goal={editing} />
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
