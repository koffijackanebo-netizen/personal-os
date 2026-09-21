-- Historique persistant des conversations avec l'Assistant IA — sans ça, tout se
-- perdait au rechargement de la page. Un seul fil continu par utilisateur (pas de
-- notion de "conversations" séparées pour l'instant, cohérent avec le contexte mentor
-- qui est lui aussi unique et continu).

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  memory_suggestion text,
  proposals jsonb,
  created_at timestamptz not null default now()
);

alter table public.assistant_messages enable row level security;

create policy "assistant_messages_all_own" on public.assistant_messages for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index assistant_messages_user_created_idx on public.assistant_messages (user_id, created_at);

grant all on table public.assistant_messages to anon, authenticated, service_role;
