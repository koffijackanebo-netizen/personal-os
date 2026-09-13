import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Habit, HabitContext, HabitLog } from "@/types/db";
import { todayISO } from "@/lib/utils";

export function useHabits() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["habits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("habits")
        .select("*")
        .eq("active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Habit[];
    },
  });
}

/** Logs des N derniers jours pour toutes les habitudes (pour calculer régularité / fragilité). */
export function useHabitLogs(days = 60) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["habit_logs", user?.id, days],
    enabled: !!user,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      const { data, error } = await supabase
        .from("habit_logs")
        .select("*")
        .gte("log_date", since.toISOString().slice(0, 10))
        .order("log_date", { ascending: false });
      if (error) throw error;
      return data as HabitLog[];
    },
  });
}

type HabitInput = Omit<Habit, "id" | "user_id" | "created_at" | "active">;

export function useCreateHabit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<HabitInput> & { title: string }) => {
      const { error } = await supabase.from("habits").insert({ ...input, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits", user?.id] }),
  });
}

export function useArchiveHabit() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("habits").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habits", user?.id] }),
  });
}

/** Coche/décoche l'habitude pour aujourd'hui (upsert sur (habit_id, log_date)). */
export function useLogHabitToday() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      habitId,
      context,
    }: {
      habitId: string;
      context?: HabitContext;
    }) => {
      const { error } = await supabase.from("habit_logs").upsert(
        {
          user_id: user!.id,
          habit_id: habitId,
          log_date: todayISO(),
          done: true,
          context: context ?? "any",
        },
        { onConflict: "habit_id,log_date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["habit_logs", user?.id] });
    },
  });
}

export function useUnlogHabitToday() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (habitId: string) => {
      const { error } = await supabase
        .from("habit_logs")
        .delete()
        .eq("habit_id", habitId)
        .eq("log_date", todayISO());
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["habit_logs", user?.id] }),
  });
}

// --- Statistiques dérivées ---------------------------------------------------

export interface HabitStats {
  executionRate: number; // % de jours réussis sur les jours "attendus" depuis la création
  currentStreak: number;
  missedRecently: number; // jours manqués sur les 7 derniers jours
  fragileContext: { weak: HabitContextLabel; strong: HabitContextLabel } | null;
}

type HabitContextLabel = "morning" | "evening";

export function computeHabitStats(
  habit: Habit,
  logs: { log_date: string; context: HabitContext | null }[],
): HabitStats {
  const sorted = [...logs].sort((a, b) => (a.log_date < b.log_date ? 1 : -1));
  const createdDate = habit.created_at.slice(0, 10);
  const daysSinceCreation = Math.max(
    1,
    Math.round((Date.parse(todayISO()) - Date.parse(createdDate)) / 86_400_000) + 1,
  );
  const executionRate = Math.round((logs.length / daysSinceCreation) * 100);

  let currentStreak = 0;
  const cursor = new Date();
  for (;;) {
    const iso = new Date(cursor.getTime() - cursor.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10);
    if (sorted.some((l) => l.log_date === iso)) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }

  const last7 = new Set<string>();
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7.add(new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
  }
  const missedRecently = [...last7].filter((d) => !sorted.some((l) => l.log_date === d)).length;

  const morning = sorted.filter((l) => l.context === "morning").length;
  const evening = sorted.filter((l) => l.context === "evening").length;
  let fragileContext: HabitStats["fragileContext"] = null;
  if (morning >= 3 && evening >= 3 && Math.abs(morning - evening) / Math.max(morning, evening) > 0.4) {
    fragileContext =
      morning > evening ? { weak: "evening", strong: "morning" } : { weak: "morning", strong: "evening" };
  }

  return { executionRate, currentStreak, missedRecently, fragileContext };
}
