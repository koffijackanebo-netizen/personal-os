export type TransactionType = "income" | "expense";

export interface FinanceTransaction {
  id: string;
  user_id: string;
  project_id: string | null;
  type: TransactionType;
  category: string;
  amount: number;
  quantity: number | null;
  unit_price: number | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
}
