import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Task } from "@/types/db";
import { todayISO } from "@/lib/utils";

export function useTasks() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tasks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .neq("status", "cancelled")
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as Task[];
    },
  });
}

type TaskInput = Omit<
  Task,
  "id" | "user_id" | "created_at" | "updated_at" | "postponed_count" | "completed_at"
>;

export function useCreateTask() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<TaskInput> & { title: string }) => {
      const { error } = await supabase.from("tasks").insert({ ...input, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", user?.id] }),
  });
}

export function useUpdateTask() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<TaskInput> & { id: string }) => {
      const { error } = await supabase.from("tasks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", user?.id] }),
  });
}

export function useCompleteTask() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", user?.id] }),
  });
}

/** Reporte une tâche à une nouvelle date et incrémente son compteur de report. */
export function usePostponeTask() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, newDueDate, currentCount }: { id: string; newDueDate: string; currentCount: number }) => {
      const { error } = await supabase
        .from("tasks")
        .update({ due_date: newDueDate, postponed_count: currentCount + 1 })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", user?.id] }),
  });
}

export function useDeleteTask() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", user?.id] }),
  });
}

// --- Sélecteurs dérivés (dashboard) -----------------------------------------

export function splitTasksForToday(tasks: Task[] | undefined) {
  const today = todayISO();
  const active = (tasks ?? []).filter((t) => t.status === "todo" || t.status === "doing");
  return {
    dueToday: active.filter((t) => t.due_date === today),
    overdue: active.filter((t) => !!t.due_date && t.due_date < today),
    upcoming: active.filter((t) => !t.due_date || t.due_date > today),
    all: active,
  };
}
