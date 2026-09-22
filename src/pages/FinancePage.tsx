import * as React from "react";
import { Plus, Trash2, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useFinanceTransactions,
  useCreateFinanceTransaction,
  useDeleteFinanceTransaction,
  summarize,
} from "@/hooks/useFinance";
import { useProjects } from "@/hooks/useProjects";
import { formatDateFr, getErrorMessage, todayISO } from "@/lib/utils";
import type { TransactionType } from "@/types/finance";

const CATEGORY_SUGGESTIONS: Record<TransactionType, string[]> = {
  income: ["Vente", "Acompte client", "Autre revenu"],
  expense: ["Achat stock", "Publicité", "Export / logistique", "Frais divers"],
};

function fmtFCFA(n: number) {
  return `${n.toLocaleString("fr-FR")} FCFA`;
}

const emptyForm = {
  type: "income" as TransactionType,
  category: "Vente",
  amount: "",
  quantity: "",
  unit_price: "",
  project_id: "",
  transaction_date: todayISO(),
  description: "",
};

export default function FinancePage() {
  const { data: transactions } = useFinanceTransactions();
  const { data: projects } = useProjects();
  const createTx = useCreateFinanceTransaction();
  const deleteTx = useDeleteFinanceTransaction();

  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState(emptyForm);
  const [projectFilter, setProjectFilter] = React.useState<string>("all");

  const all = transactions ?? [];
  const overall = summarize(all);

  const byProject = React.useMemo(() => {
    const map = new Map<string, typeof all>();
    for (const t of all) {
      const key = t.project_id ?? "none";
      const list = map.get(key) ?? [];
      list.push(t);
      map.set(key, list);
    }
    return map;
  }, [all]);

  const filtered = projectFilter === "all" ? all : all.filter((t) => (t.project_id ?? "none") === projectFilter);

  function projectTitle(id: string | null) {
    if (!id) return "Sans projet";
    return projects?.find((p) => p.id === id)?.title ?? "Projet supprimé";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      toast.error("Montant invalide");
      return;
    }
    try {
      await createTx.mutateAsync({
        type: form.type,
        category: form.category.trim() || (form.type === "income" ? "Vente" : "Dépense"),
        amount,
        quantity: form.quantity ? Number(form.quantity) : null,
        unit_price: form.unit_price ? Number(form.unit_price) : null,
        project_id: form.project_id || null,
        transaction_date: form.transaction_date,
        description: form.description || null,
      });
      toast.success("Transaction enregistrée");
      setForm(emptyForm);
      setOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Finance</h1>
          <p className="text-sm text-muted-foreground">
            La trésorerie n'est jamais stockée — toujours calculée à partir des transactions.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4" /> Nouvelle transaction
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle transaction</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Tabs value={form.type} onValueChange={(v) => setForm({ ...form, type: v as TransactionType, category: CATEGORY_SUGGESTIONS[v as TransactionType][0] })}>
                <TabsList>
                  <TabsTrigger value="income">Entrée (vente...)</TabsTrigger>
                  <TabsTrigger value="expense">Sortie (achat, pub...)</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_SUGGESTIONS[form.type].map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setForm({ ...form, category: c })}
                    className={`rounded-full border px-2.5 py-1 text-xs ${form.category === c ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Catégorie</Label>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Quantité (optionnel)</Label>
                  <Input
                    type="number"
                    value={form.quantity}
                    onChange={(e) => {
                      const quantity = e.target.value;
                      const unit = Number(form.unit_price);
                      const amount = quantity && unit ? String(Number(quantity) * unit) : form.amount;
                      setForm({ ...form, quantity, amount });
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Prix unitaire (optionnel)</Label>
                  <Input
                    type="number"
                    value={form.unit_price}
                    onChange={(e) => {
                      const unit_price = e.target.value;
                      const qty = Number(form.quantity);
                      const amount = qty && unit_price ? String(qty * Number(unit_price)) : form.amount;
                      setForm({ ...form, unit_price, amount });
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Montant total (FCFA)</Label>
                <Input
                  type="number"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                <div className="flex flex-col gap-1.5">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={form.transaction_date}
                    onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Note (optionnel)</Label>
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <DialogFooter>
                <Button type="submit">Enregistrer</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Vue d'ensemble */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <TrendingUp className="h-4 w-4 text-status-good" />
            <div>
              <p className="text-xs text-muted-foreground">Revenus totaux</p>
              <p className="text-lg font-semibold">{fmtFCFA(overall.income)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <TrendingDown className="h-4 w-4 text-status-bad" />
            <div>
              <p className="text-xs text-muted-foreground">Dépenses totales</p>
              <p className="text-lg font-semibold">{fmtFCFA(overall.expense)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <Wallet className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Trésorerie (solde)</p>
              <p className={`text-lg font-semibold ${overall.balance < 0 ? "text-status-bad" : ""}`}>
                {fmtFCFA(overall.balance)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Par projet */}
      {byProject.size > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-muted-foreground">Par projet</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {[...byProject.entries()].map(([key, txs]) => {
              const s = summarize(txs);
              return (
                <Card key={key}>
                  <CardContent className="flex flex-col gap-1 pt-5 text-sm">
                    <p className="font-medium">{projectTitle(key === "none" ? null : key)}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Revenus {fmtFCFA(s.income)}</span>
                      <span>Dépenses {fmtFCFA(s.expense)}</span>
                      <span className={s.balance < 0 ? "font-medium text-status-bad" : "font-medium"}>
                        Solde {fmtFCFA(s.balance)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Liste des transactions */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">Transactions</h2>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les projets</SelectItem>
              {[...byProject.keys()].map((key) => (
                <SelectItem key={key} value={key}>
                  {projectTitle(key === "none" ? null : key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {filtered.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex items-center gap-3 pt-4 pb-4 text-sm">
              <Badge variant={t.type === "income" ? "good" : "bad"}>{t.type === "income" ? "+" : "-"}</Badge>
              <div className="flex-1">
                <p className="font-medium">
                  {t.category} {t.quantity ? `— ${t.quantity} unité(s)` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDateFr(t.transaction_date)} · {projectTitle(t.project_id)}
                  {t.description ? ` · ${t.description}` : ""}
                </p>
              </div>
              <p className={`font-medium ${t.type === "income" ? "text-status-good" : "text-status-bad"}`}>
                {t.type === "income" ? "+" : "-"}
                {fmtFCFA(t.amount)}
              </p>
              <button
                className="text-muted-foreground hover:text-status-bad"
                onClick={() => deleteTx.mutate(t.id)}
                aria-label="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Aucune transaction pour l'instant.</p>}
      </div>
    </div>
  );
}
