// Fonction Edge Supabase — Assistant IA personnel.
// Reçoit un message utilisateur, rassemble le contexte récent (objectifs, projets,
// tâches, habitudes, dernières revues) depuis la base (scopé via le JWT de l'utilisateur,
// donc soumis aux mêmes règles RLS que le reste de l'app), puis appelle Claude avec une
// personnalité calme, lucide, exigeante et directe — jamais motivationnelle ni complaisante.
//
// Secret requis : ANTHROPIC_API_KEY (supabase secrets set ANTHROPIC_API_KEY=sk-ant-...)

import { createClient } from "jsr:@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk@0.32.1";

const SYSTEM_PROMPT = `Tu es l'assistant personnel intégré à Personal OS, le système d'exécution et de croissance de l'utilisateur.

Personnalité : calme, lucide, exigeante, stratégique, directe et pragmatique.
Tu n'es JAMAIS : excessivement enthousiaste, infantilisante, moralisatrice, remplie de phrases motivationnelles, ou positive sans raison.

Tu dois pouvoir dire, sans agressivité :
- "Non. Ce n'est pas une priorité."
- "Tu compliques inutilement cette tâche."
- "Tu repousses cette décision parce qu'elle est inconfortable."
- "Tu as suffisamment réfléchi. Passe à l'action."
- "Cet objectif n'a actuellement aucun système d'exécution."

Principe directeur : transformer l'abstrait en concret.
Objectif → projet → prochaine action → créneau → exécution → vérification.
Cherche toujours : "Quelle est la prochaine action concrète ?"

Quand tu analyses la journée ou la semaine de l'utilisateur, cherche les causes réelles, jamais la culpabilisation :
"Ton problème cette semaine n'était pas le manque de temps. Tes tâches importantes ont été régulièrement remplacées par des tâches secondaires."

Réponds en français, de façon brève et actionnable. Pas de longs préambules.

Tu as accès à un "contexte mentor" : un carnet que l'utilisateur tient à jour entre les sessions
(objectifs actuels, état de ses projets, décisions en cours, journal). Lis-le pour ne pas reposer
des questions déjà répondues et pour rester cohérent avec les décisions déjà prises.

Quand — et SEULEMENT quand — la conversation fait apparaître quelque chose qui mérite d'être
retenu pour les prochaines sessions (une décision prise, un changement d'état important sur un
projet, un blocage récurrent identifié), termine ta réponse par un bloc exactement dans ce format,
après ta réponse normale à l'utilisateur :

---MENTOR_UPDATE---
<une note courte, 1 à 3 phrases, à ajouter au journal du contexte mentor>
---END_MENTOR_UPDATE---

N'inclus ce bloc que rarement — seulement quand c'est vraiment digne d'être mémorisé. La plupart
de tes réponses ne doivent PAS en contenir. N'en mets jamais pour de la simple conversation.`;

interface ChatRequest {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

const MENTOR_UPDATE_RE = /---MENTOR_UPDATE---\s*([\s\S]*?)\s*---END_MENTOR_UPDATE---/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Non authentifié" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return json({ error: "Non authentifié" }, 401);
    }

    const { message, history = [] }: ChatRequest = await req.json();
    if (!message?.trim()) {
      return json({ error: "Message vide" }, 400);
    }

    const [context, mentorContext] = await Promise.all([
      gatherContext(supabase),
      fetchMentorContext(supabase, user.id),
    ]);

    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });

    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 1500,
      system: `${SYSTEM_PROMPT}\n\n--- Contexte mentor (mémoire long terme) ---\n${mentorContext}\n\n--- Contexte actuel de l'utilisateur (données live) ---\n${context}`,
      messages: [
        ...history.map((h) => ({ role: h.role, content: h.content })),
        { role: "user" as const, content: message },
      ],
    });

    const rawText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    const match = rawText.match(MENTOR_UPDATE_RE);
    const reply = rawText.replace(MENTOR_UPDATE_RE, "").trim();
    const memorySuggestion = match ? match[1].trim() : null;

    return json({ reply, memorySuggestion });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Erreur inconnue" }, 500);
  }
});

async function fetchMentorContext(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("mentor_context")
    .select("content")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.content as string | undefined)?.trim() || "(vide — rien enregistré pour l'instant)";
}

async function gatherContext(supabase: ReturnType<typeof createClient>): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: goals }, { data: projects }, { data: tasks }, { data: habits }, { data: reviews }] =
    await Promise.all([
      supabase.from("goals").select("title,status,priority,progress,deadline").eq("status", "active").limit(15),
      supabase.from("projects").select("title,status,priority,deadline").eq("status", "active").limit(15),
      supabase
        .from("tasks")
        .select("title,status,priority,due_date,postponed_count")
        .neq("status", "cancelled")
        .neq("status", "done")
        .order("due_date", { ascending: true })
        .limit(20),
      supabase.from("habits").select("title,frequency,preferred_context").eq("active", true).limit(15),
      supabase
        .from("daily_reviews")
        .select("review_date,accomplishments,missed_task,missed_reason,tomorrow_first_action")
        .order("review_date", { ascending: false })
        .limit(5),
    ]);

  const lines: string[] = [`Date du jour : ${today}`];

  lines.push("\nObjectifs actifs :");
  (goals ?? []).forEach((g: any) =>
    lines.push(`- ${g.title} (priorité ${g.priority}, ${g.progress}%, échéance ${g.deadline ?? "—"})`),
  );

  lines.push("\nProjets actifs :");
  (projects ?? []).forEach((p: any) =>
    lines.push(`- ${p.title} (priorité ${p.priority}, échéance ${p.deadline ?? "—"})`),
  );

  lines.push("\nTâches en attente :");
  (tasks ?? []).forEach((t: any) =>
    lines.push(
      `- ${t.title} (P${t.priority}, échéance ${t.due_date ?? "—"}${t.postponed_count ? `, reportée ${t.postponed_count}x` : ""})`,
    ),
  );

  lines.push("\nHabitudes actives :");
  (habits ?? []).forEach((h: any) => lines.push(`- ${h.title} (${h.frequency}, ${h.preferred_context ?? "any"})`));

  lines.push("\nRevues récentes :");
  (reviews ?? []).forEach((r: any) =>
    lines.push(
      `- ${r.review_date} : accompli="${r.accomplishments ?? "—"}", manqué="${r.missed_task ?? "—"}" (raison: ${r.missed_reason ?? "—"}), demain="${r.tomorrow_first_action ?? "—"}"`,
    ),
  );

  return lines.join("\n");
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}
