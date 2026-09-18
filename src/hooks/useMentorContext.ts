import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_CONTEXT = `# Contexte mentor

## Objectifs actuels

## Projets en cours

## Décisions en cours

## Journal (notes du mentor)
`;

export function useMentorContext() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["mentor_context", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mentor_context")
        .select("content, updated_at")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.content as string | undefined) ?? DEFAULT_CONTEXT;
    },
  });
}

export function useSaveMentorContext() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from("mentor_context")
        .upsert({ user_id: user!.id, content }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mentor_context", user?.id] }),
  });
}
