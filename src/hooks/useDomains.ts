import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import type { Domain } from "@/types/db";

export function useDomains() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["domains", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("domains")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Domain[];
    },
  });
}
