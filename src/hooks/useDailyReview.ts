import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { DailyReview } from "@/types/db";
import { todayISO } from "@/lib/utils";

export function useTodayReview() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["daily_review", user?.id, todayISO()],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_reviews")
        .select("*")
        .eq("review_date", todayISO())
        .maybeSingle();
      if (error) throw error;
      return data as DailyReview | null;
    },
  });
}

export function useRecentReviews(limit = 14) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["daily_reviews", user?.id, limit],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_reviews")
        .select("*")
        .order("review_date", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as DailyReview[];
    },
  });
}

type ReviewInput = Omit<DailyReview, "id" | "user_id" | "created_at" | "review_date">;

export function useSaveTodayReview() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ReviewInput>) => {
      const { error } = await supabase.from("daily_reviews").upsert(
        { ...input, user_id: user!.id, review_date: todayISO() },
        { onConflict: "user_id,review_date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily_review", user?.id] });
      qc.invalidateQueries({ queryKey: ["daily_reviews", user?.id] });
    },
  });
}
