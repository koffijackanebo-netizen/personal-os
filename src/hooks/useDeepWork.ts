import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { DeepWorkSession } from "@/types/db";

export function useDeepWorkSessions(limit = 20) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["deep_work_sessions", user?.id, limit],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deep_work_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as DeepWorkSession[];
    },
  });
}

/** La session en cours (non terminée), s'il y en a une. */
export function useActiveDeepWorkSession() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["deep_work_active", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deep_work_sessions")
        .select("*")
        .is("ended_at", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as DeepWorkSession | null;
    },
  });
}

export function useStartDeepWork() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { objective: string; planned_minutes: number; task_id?: string | null }) => {
      const { error } = await supabase.from("deep_work_sessions").insert({
        ...input,
        user_id: user!.id,
        started_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deep_work_active", user?.id] });
      qc.invalidateQueries({ queryKey: ["deep_work_sessions", user?.id] });
    },
  });
}

export function useEndDeepWork() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, result }: { id: string; result: string }) => {
      const { error } = await supabase
        .from("deep_work_sessions")
        .update({ ended_at: new Date().toISOString(), result })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deep_work_active", user?.id] });
      qc.invalidateQueries({ queryKey: ["deep_work_sessions", user?.id] });
    },
  });
}
