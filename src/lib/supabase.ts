import { createClient } from "@supabase/supabase-js";

// NB : on n'utilise pas le typage générique `createClient<Database>(...)` de supabase-js —
// sa forme interne exacte (Relationships, __InternalSupabase, ...) varie selon les versions
// et est fragile à répliquer à la main. À la place, chaque hook (src/hooks/use*.ts) type
// explicitement les données qu'il lit/écrit via les interfaces de src/types/db.ts.
// Si tu utilises la CLI Supabase, tu peux régénérer un vrai type Database et le rebrancher ici :
//   supabase gen types typescript --project-id <id> > src/types/db.ts

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !key) {
  // Ne bloque pas le build, mais évite un plantage silencieux au runtime.
  console.error(
    "Variables d'environnement Supabase manquantes. Copie .env.example vers .env et remplis-le.",
  );
}

export const supabase = createClient(url ?? "", key ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
