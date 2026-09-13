import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Energy, Profile } from "@/types/db";
import { todayISO } from "@/lib/utils";

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

/** Énergie du jour — null si pas encore renseignée aujourd'hui. */
export function useTodayEnergy() {
  const { data: profile } = useProfile();
  if (!profile) return null;
  if (profile.today_energy_date !== todayISO()) return null;
  return profile.today_energy;
}

export function useSetTodayEnergy() {
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (energy: Energy) => {
      const { error } = await supabase
        .from("profiles")
        .update({ today_energy: energy, today_energy_date: todayISO() })
        .eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile", user?.id] }),
  });
}
