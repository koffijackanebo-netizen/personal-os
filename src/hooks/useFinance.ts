import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { FinanceTransaction } from "@/types/finance";

export function useFinanceTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["finance_transactions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("finance_transactions")
        .select("*")
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FinanceTransaction[];
    },
  });
}

type TransactionInput = Omit<FinanceTransaction, "id" | "user_id" | "created_at">;

export function useCreateFinanceTransaction() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<TransactionInput> & { type: "income" | "expense"; category: string; amount: number }) => {
      const { error } = await supabase.from("finance_transactions").insert({ ...input, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance_transactions", user?.id] }),
  });
}

export function useDeleteFinanceTransaction() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("finance_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["finance_transactions", user?.id] }),
  });
}

export interface FinanceSummary {
  income: number;
  expense: number;
  balance: number;
}

/** Calcule les totaux (jamais stockés — toujours dérivés des transactions). */
export function summarize(transactions: FinanceTransaction[]): FinanceSummary {
  const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  return { income, expense, balance: income - expense };
}
