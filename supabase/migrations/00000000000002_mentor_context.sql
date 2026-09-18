-- Mémoire persistante de l'Assistant IA — un "carnet de contexte" par utilisateur
-- (objectifs actuels, état des projets, décisions en cours), lu à chaque conversation
-- et mis à jour uniquement avec validation explicite de l'utilisateur (jamais en silence).

create table public.mentor_context (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  content text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.mentor_context enable row level security;

create policy "mentor_context_all_own" on public.mentor_context for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger mentor_context_set_updated_at before update on public.mentor_context
  for each row execute function public.set_updated_at();

grant all on table public.mentor_context to anon, authenticated, service_role;
