import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export interface AssistantMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  memory_suggestion: string | null;
  proposals: unknown | null;
  created_at: string;
}

const HISTORY_LIMIT = 60;

export function useAssistantMessages() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["assistant_messages", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistant_messages")
        .select("id, role, content, memory_suggestion, proposals, created_at")
        .order("created_at", { ascending: false })
        .limit(HISTORY_LIMIT);
      if (error) throw error;
      return ((data ?? []) as AssistantMessageRow[]).reverse();
    },
  });
}

export function useSaveAssistantMessage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      role: "user" | "assistant";
      content: string;
      memory_suggestion?: string | null;
      proposals?: unknown;
    }) => {
      const { error } = await supabase.from("assistant_messages").insert({ ...input, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assistant_messages", user?.id] }),
  });
}
