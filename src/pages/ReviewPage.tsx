import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useTodayReview, useRecentReviews, useSaveTodayReview } from "@/hooks/useDailyReview";
import { formatDateFr } from "@/lib/utils";

const QUESTIONS: { key: keyof FormState; label: string }[] = [
  { key: "accomplishments", label: "Qu'est-ce que j'ai réellement accompli ?" },
  { key: "missed_task", label: "Quelle action importante n'a pas été faite ?" },
  { key: "missed_reason", label: "Pourquoi ?" },
  { key: "tomorrow_first_action", label: "Quelle est la première action de demain ?" },
  { key: "to_delete", label: "Y a-t-il quelque chose à supprimer plutôt qu'à reporter ?" },
];

interface FormState {
  accomplishments: string;
  missed_task: string;
  missed_reason: string;
  tomorrow_first_action: string;
  to_delete: string;
}

const empty: FormState = {
  accomplishments: "",
  missed_task: "",
  missed_reason: "",
  tomorrow_first_action: "",
  to_delete: "",
};

export default function ReviewPage() {
  const { data: today } = useTodayReview();
  const { data: recent } = useRecentReviews(7);
  const saveReview = useSaveTodayReview();
  const [form, setForm] = React.useState<FormState>(empty);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (today && !loaded) {
      setForm({
        accomplishments: today.accomplishments ?? "",
        missed_task: today.missed_task ?? "",
        missed_reason: today.missed_reason ?? "",
        tomorrow_first_action: today.tomorrow_first_action ?? "",
        to_delete: today.to_delete ?? "",
      });
      setLoaded(true);
    }
  }, [today, loaded]);

  async function handleSave() {
    try {
      await saveReview.mutateAsync(form);
      toast.success("Revue enregistrée");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Revue du soir</h1>
        <p className="text-sm text-muted-foreground">3 à 5 minutes. On cherche les causes, pas la culpabilité.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-5">
          {QUESTIONS.map((q) => (
            <div key={q.key} className="flex flex-col gap-1.5">
              <Label>{q.label}</Label>
              <Textarea
                rows={2}
                value={form[q.key]}
                onChange={(e) => setForm({ ...form, [q.key]: e.target.value })}
              />
            </div>
          ))}
          <Button onClick={handleSave} disabled={saveReview.isPending} className="self-start">
            Enregistrer la revue
          </Button>
        </CardContent>
      </Card>

      {(recent ?? []).length > 1 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Revues récentes</h2>
          {(recent ?? [])
            .filter((r) => r.review_date !== today?.review_date)
            .map((r) => (
              <Card key={r.id}>
                <CardHeader>
                  <CardTitle className="text-xs text-muted-foreground">{formatDateFr(r.review_date)}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-1 pt-0 text-sm">
                  {r.accomplishments && <p>✅ {r.accomplishments}</p>}
                  {r.tomorrow_first_action && (
                    <>
                      <Separator className="my-1" />
                      <p className="text-muted-foreground">→ {r.tomorrow_first_action}</p>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
