-- Module financier — un grand livre unique (entrées + sorties). La trésorerie n'est
-- jamais stockée à part : elle se calcule (somme entrées - somme sorties) pour éviter
-- toute désynchronisation entre un solde stocké et le détail qui le compose.

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  type text not null check (type in ('income', 'expense')),
  category text not null,
  amount numeric not null check (amount > 0),
  quantity int,
  unit_price numeric,
  description text,
  transaction_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.finance_transactions enable row level security;

create policy "finance_transactions_all_own" on public.finance_transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index finance_transactions_user_date_idx on public.finance_transactions (user_id, transaction_date);
create index finance_transactions_project_idx on public.finance_transactions (project_id);

grant all on table public.finance_transactions to anon, authenticated, service_role;
