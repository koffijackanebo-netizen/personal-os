-- Abonnements aux notifications push (Web Push). Un utilisateur peut avoir
-- plusieurs abonnements (un par appareil/navigateur).

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_all_own" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all on table public.push_subscriptions to anon, authenticated, service_role;
