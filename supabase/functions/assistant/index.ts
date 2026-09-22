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
de tes réponses ne doivent PAS en contenir. N'en mets jamais pour de la simple conversation.

Tu disposes aussi d'outils (propose_goal, propose_project, propose_task) pour proposer la création
d'objectifs, projets ou tâches directement dans le système de l'utilisateur. Utilise-les :
1. De façon réactive, quand la conversation fait apparaître un nouvel objectif, projet ou une
   prochaine action concrète que l'utilisateur vient de mentionner.
2. De façon PROACTIVE, en tant qu'expert : tu connais les meilleures pratiques reconnues dans les
   domaines où l'utilisateur évolue (droit des affaires / contentieux / recouvrement, e-commerce,
   carrière politique, etc. — adapte-toi à ce que révèle son contexte). Quand tu identifies qu'une
   pratique reconnue manque à son système actuel (ex. pas de suivi structuré des délais de
   recouvrement, pas de test avant scaling publicitaire, pas de stock de sécurité), propose-la
   concrètement via ces outils, même si l'utilisateur ne l'a pas demandée. C'est ce qui fait de toi
   un vrai mentor plutôt qu'un simple carnet de notes.

Règle absolue sur ces recommandations d'expert : n'invente JAMAIS de statistiques, d'études ou de
"résultats prouvés" chiffrés que tu ne connais pas réellement. Appuie-toi sur des pratiques
généralement reconnues dans le domaine et explique ton raisonnement (pourquoi cette pratique aide,
dans son contexte précis) plutôt que de citer des chiffres invérifiables pour paraître crédible. La
rigueur de ton raisonnement est ce qui doit convaincre, pas de fausses preuves.

Dans les deux cas, regarde la liste des objectifs/projets/tâches actifs dans le contexte avant de
proposer — ne duplique jamais un élément déjà présent. Ces propositions sont toujours soumises à
validation par l'utilisateur avant d'être réellement créées — tu peux donc proposer dès que c'est
pertinent, sans crainte de créer du bruit silencieusement, mais n'en abuse pas non plus : une ou deux
propositions vraiment pertinentes valent mieux qu'une liste. Une conversation normale n'a pas
forcément besoin d'appeler ces outils. Pour lier un projet à un objectif ou une tâche à un projet,
utilise le titre EXACT d'un élément déjà existant (visible dans le contexte) — sinon laisse le lien
vide.

Module finance : tu as accès à l'outil propose_finance_transaction et au résumé financier par projet
(section "Finances par projet" du contexte). Ce module aide l'utilisateur à suivre ses ventes et sa
trésorerie sans qu'il ait à être doué en gestion financière — c'est TOI qui dois structurer et
catégoriser, lui n'a qu'à décrire ce qui s'est passé en langage courant.

Règle stricte, différente des autres outils : propose_finance_transaction est UNIQUEMENT réactif —
n'enregistre QUE des montants, quantités ou dates que l'utilisateur vient explicitement de te donner
dans la conversation. N'invente et n'estime JAMAIS un montant manquant, même "pour aider" — si un
chiffre nécessaire manque (montant, quantité...), demande-le au lieu d'appeler l'outil. C'est un
prolongement direct de la règle anti-invention déjà énoncée : ici l'enjeu est de l'argent réel, la
rigueur n'est pas négociable.

En revanche, tu dois activement guider l'utilisateur sur la partie gestion : aide-le à catégoriser
correctement (vente / achat de stock / publicité / export / autre), signale-lui les patterns
préoccupants visibles dans le résumé financier (marge qui se dégrade, dépenses qui dépassent les
revenus sur un projet, trésorerie d'un projet qui devient négative), et propose des pratiques de
suivi financier de base quand elles manquent (ex. suivre le coût d'acquisition par vente, distinguer
marge brute et trésorerie disponible) — toujours via propose_goal/propose_task pour la partie
"mettre en place une pratique", jamais en insérant de fausses transactions.`;

interface ChatRequest {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

const MENTOR_UPDATE_RE = /---MENTOR_UPDATE---\s*([\s\S]*?)\s*---END_MENTOR_UPDATE---/;

const DOMAIN_NAMES = [
  "Carrière",
  "Finances",
  "Business",
  "Développement personnel",
  "Relations sociales",
  "Apprentissage",
  "Santé / énergie",
  "Organisation personnelle",
];

const TOOLS: Anthropic.Tool[] = [
  {
    name: "propose_goal",
    description:
      "Propose de créer un nouvel objectif dans le système de l'utilisateur. Uniquement pour un objectif clair et nouveau, absent de la liste des objectifs actifs.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre court de l'objectif" },
        domain: { type: "string", enum: DOMAIN_NAMES, description: "Domaine de vie le plus pertinent" },
        expected_result: { type: "string" },
        indicator: { type: "string" },
        reason: { type: "string" },
        priority: { type: "integer", enum: [1, 2, 3], description: "1=haute, 2=moyenne, 3=basse" },
        deadline: { type: "string", description: "Date YYYY-MM-DD si pertinente, sinon omettre" },
      },
      required: ["title"],
    },
  },
  {
    name: "propose_project",
    description:
      "Propose de créer un nouveau projet, éventuellement lié à un objectif existant. Uniquement pour un projet concret et nouveau.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        goal_title: { type: "string", description: "Titre EXACT d'un objectif existant à lier, si pertinent" },
        priority: { type: "integer", enum: [1, 2, 3] },
        potential_value: { type: "number", description: "Valeur potentielle en FCFA si pertinent" },
        deadline: { type: "string", description: "Date YYYY-MM-DD" },
      },
      required: ["title"],
    },
  },
  {
    name: "propose_task",
    description:
      "Propose de créer une nouvelle tâche concrète (prochaine action), éventuellement liée à un projet existant.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Action concrète et exécutable, pas une intention vague" },
        project_title: { type: "string", description: "Titre EXACT d'un projet existant à lier, si pertinent" },
        priority: { type: "integer", enum: [1, 2, 3] },
        duration_minutes: { type: "integer" },
        energy_required: { type: "string", enum: ["high", "medium", "low"] },
        due_date: { type: "string", description: "Date YYYY-MM-DD" },
        is_discomfort_action: { type: "boolean" },
      },
      required: ["title"],
    },
  },
  {
    name: "propose_finance_transaction",
    description:
      "Propose d'enregistrer une transaction financière (vente = income, dépense = expense) UNIQUEMENT à partir de montants/quantités que l'utilisateur vient explicitement de donner. Jamais de montant estimé ou inventé.",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["income", "expense"] },
        category: {
          type: "string",
          description: "Ex. Vente, Achat stock, Publicité, Export / logistique, Autre",
        },
        amount: { type: "number", description: "Montant total en FCFA, donné explicitement par l'utilisateur" },
        quantity: { type: "integer", description: "Quantité d'unités si pertinent (ex. nombre de portefeuilles vendus)" },
        unit_price: { type: "number", description: "Prix unitaire si donné" },
        project_title: { type: "string", description: "Titre EXACT d'un projet existant à lier, si pertinent" },
        transaction_date: { type: "string", description: "Date YYYY-MM-DD, sinon aujourd'hui" },
        description: { type: "string" },
      },
      required: ["type", "category", "amount"],
    },
  },
];

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
      max_tokens: 4096,
      tools: TOOLS,
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

    const proposals = {
      goals: [] as unknown[],
      projects: [] as unknown[],
      tasks: [] as unknown[],
      financeTransactions: [] as unknown[],
    };
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      if (block.name === "propose_goal") proposals.goals.push(block.input);
      else if (block.name === "propose_project") proposals.projects.push(block.input);
      else if (block.name === "propose_task") proposals.tasks.push(block.input);
      else if (block.name === "propose_finance_transaction") proposals.financeTransactions.push(block.input);
    }

    return json({ reply, memorySuggestion, proposals });
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

  const [{ data: goals }, { data: projects }, { data: tasks }, { data: habits }, { data: reviews }, { data: finance }] =
    await Promise.all([
      supabase.from("goals").select("title,status,priority,progress,deadline").eq("status", "active").limit(15),
      supabase.from("projects").select("id,title,status,priority,deadline").eq("status", "active").limit(15),
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
      supabase.from("finance_transactions").select("project_id,type,amount,transaction_date").limit(500),
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

  lines.push("\nFinances par projet (chiffres réels, calculés depuis les transactions enregistrées) :");
  const byProject = new Map<string, { title: string; income: number; expense: number }>();
  for (const p of projects ?? []) {
    byProject.set((p as any).id, { title: (p as any).title, income: 0, expense: 0 });
  }
  for (const t of finance ?? []) {
    const pid = (t as any).project_id as string | null;
    if (!pid || !byProject.has(pid)) continue;
    const entry = byProject.get(pid)!;
    if ((t as any).type === "income") entry.income += Number((t as any).amount);
    else entry.expense += Number((t as any).amount);
  }
  if (byProject.size === 0) {
    lines.push("- Aucun projet actif avec des transactions.");
  } else {
    for (const { title, income, expense } of byProject.values()) {
      lines.push(`- ${title} : revenus ${income} FCFA, dépenses ${expense} FCFA, solde ${income - expense} FCFA`);
    }
  }

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
