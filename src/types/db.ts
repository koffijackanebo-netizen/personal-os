// Types manuels correspondant au schéma SQL (supabase/migrations/00000000000001_init.sql).
// Si tu utilises la CLI Supabase, tu peux plus tard régénérer ce fichier avec :
//   supabase gen types typescript --project-id <id> > src/types/db.ts

export type Priority = 1 | 2 | 3;
export type Energy = "high" | "medium" | "low";
export type GoalStatus = "active" | "paused" | "done" | "abandoned";
export type ProjectStatus = "active" | "paused" | "done" | "abandoned";
export type TaskStatus = "todo" | "doing" | "done" | "cancelled";
export type HabitFrequency = "daily" | "weekly";
export type HabitContext = "morning" | "evening" | "any";

export interface Profile {
  id: string;
  display_name: string | null;
  timezone: string;
  today_energy: Energy | null;
  today_energy_date: string | null;
  created_at: string;
}

export interface Domain {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  domain_id: string | null;
  title: string;
  expected_result: string | null;
  deadline: string | null;
  indicator: string | null;
  reason: string | null;
  priority: Priority;
  status: GoalStatus;
  progress: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  goal_id: string | null;
  title: string;
  status: ProjectStatus;
  priority: Priority;
  potential_value: number | null;
  deadline: string | null;
  time_invested_minutes: number;
  result: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  priority: Priority;
  duration_minutes: number | null;
  energy_required: Energy | null;
  due_date: string | null;
  scheduled_at: string | null;
  status: TaskStatus;
  postponed_count: number;
  is_discomfort_action: boolean;
  minimum_version: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Habit {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  frequency: HabitFrequency;
  target_days_per_week: number | null;
  preferred_context: HabitContext | null;
  active: boolean;
  created_at: string;
}

export interface HabitLog {
  id: string;
  user_id: string;
  habit_id: string;
  log_date: string;
  done: boolean;
  context: HabitContext | null;
  note: string | null;
  created_at: string;
}

export interface DailyReview {
  id: string;
  user_id: string;
  review_date: string;
  accomplishments: string | null;
  missed_task: string | null;
  missed_reason: string | null;
  tomorrow_first_action: string | null;
  to_delete: string | null;
  created_at: string;
}

export interface DeepWorkSession {
  id: string;
  user_id: string;
  task_id: string | null;
  objective: string;
  planned_minutes: number;
  started_at: string;
  ended_at: string | null;
  result: string | null;
  created_at: string;
}

type TableDef<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Insert>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      profiles: TableDef<Profile, Partial<Profile> & { id: string }>;
      domains: TableDef<Domain, Partial<Domain> & { name: string }>;
      goals: TableDef<Goal, Partial<Goal> & { title: string }>;
      projects: TableDef<Project, Partial<Project> & { title: string }>;
      tasks: TableDef<Task, Partial<Task> & { title: string }>;
      habits: TableDef<Habit, Partial<Habit> & { title: string }>;
      habit_logs: TableDef<HabitLog, Partial<HabitLog> & { habit_id: string; log_date: string }>;
      daily_reviews: TableDef<DailyReview, Partial<DailyReview> & { review_date: string }>;
      deep_work_sessions: TableDef<
        DeepWorkSession,
        Partial<DeepWorkSession> & { objective: string }
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
