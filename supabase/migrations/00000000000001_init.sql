-- Personal OS — schéma initial (MVP)
-- Toutes les tables sont scopées à l'utilisateur via user_id + Row Level Security.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Fonctions utilitaires
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profils (1 ligne par utilisateur)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  today_energy text check (today_energy in ('high', 'medium', 'low')),
  today_energy_date date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- Domaines de vie (seedés à la création du compte)
-- ---------------------------------------------------------------------------

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  icon text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.domains enable row level security;

create policy "domains_all_own" on public.domains for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Objectifs
-- ---------------------------------------------------------------------------

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  domain_id uuid references public.domains (id) on delete set null,
  title text not null,
  expected_result text,
  deadline date,
  indicator text,
  reason text,
  priority smallint not null default 2 check (priority between 1 and 3),
  status text not null default 'active' check (status in ('active', 'paused', 'done', 'abandoned')),
  progress smallint not null default 0 check (progress between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "goals_all_own" on public.goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger goals_set_updated_at before update on public.goals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Projets
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  title text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'done', 'abandoned')),
  priority smallint not null default 2 check (priority between 1 and 3),
  potential_value numeric,
  deadline date,
  time_invested_minutes int not null default 0,
  result text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "projects_all_own" on public.projects for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Tâches
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  description text,
  priority smallint not null default 2 check (priority between 1 and 3),
  duration_minutes int,
  energy_required text check (energy_required in ('high', 'medium', 'low')),
  due_date date,
  scheduled_at timestamptz,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'cancelled')),
  postponed_count int not null default 0,
  is_discomfort_action boolean not null default false,
  minimum_version text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "tasks_all_own" on public.tasks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger tasks_set_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

create index tasks_user_due_idx on public.tasks (user_id, due_date);
create index tasks_user_status_idx on public.tasks (user_id, status);

-- ---------------------------------------------------------------------------
-- Habitudes
-- ---------------------------------------------------------------------------

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text,
  frequency text not null default 'daily' check (frequency in ('daily', 'weekly')),
  target_days_per_week smallint check (target_days_per_week between 1 and 7),
  preferred_context text check (preferred_context in ('morning', 'evening', 'any')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.habits enable row level security;

create policy "habits_all_own" on public.habits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  log_date date not null,
  done boolean not null default true,
  context text check (context in ('morning', 'evening', 'any')),
  note text,
  created_at timestamptz not null default now(),
  unique (habit_id, log_date)
);

alter table public.habit_logs enable row level security;

create policy "habit_logs_all_own" on public.habit_logs for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index habit_logs_habit_date_idx on public.habit_logs (habit_id, log_date);

-- ---------------------------------------------------------------------------
-- Revues quotidiennes
-- ---------------------------------------------------------------------------

create table public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  review_date date not null,
  accomplishments text,
  missed_task text,
  missed_reason text,
  tomorrow_first_action text,
  to_delete text,
  created_at timestamptz not null default now(),
  unique (user_id, review_date)
);

alter table public.daily_reviews enable row level security;

create policy "daily_reviews_all_own" on public.daily_reviews for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Sessions Deep Work
-- ---------------------------------------------------------------------------

create table public.deep_work_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete set null,
  objective text not null,
  planned_minutes int not null default 25,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  result text,
  created_at timestamptz not null default now()
);

alter table public.deep_work_sessions enable row level security;

create policy "deep_work_sessions_all_own" on public.deep_work_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Onboarding automatique : profil + 8 domaines de vie à la création du compte
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id);

  insert into public.domains (user_id, name, icon, sort_order)
  values
    (new.id, 'Carrière', 'briefcase', 1),
    (new.id, 'Finances', 'coins', 2),
    (new.id, 'Business', 'rocket', 3),
    (new.id, 'Développement personnel', 'sprout', 4),
    (new.id, 'Relations sociales', 'users', 5),
    (new.id, 'Apprentissage', 'book-open', 6),
    (new.id, 'Santé / énergie', 'heart-pulse', 7),
    (new.id, 'Organisation personnelle', 'layout-grid', 8);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Permissions de base (indépendantes des policies RLS ci-dessus).
-- Sans ça, Postgres refuse tout accès aux tables ("permission denied for
-- table ...") avant même d'évaluer les policies RLS — RLS restreint l'accès,
-- il ne l'accorde pas.
-- ---------------------------------------------------------------------------

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
