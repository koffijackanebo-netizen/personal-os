// Fonction Edge Supabase — rappel des tâches en retard dans la journée.
// Conçue pour être appelée plusieurs fois par jour (ex. toutes les heures entre 8h et 20h)
// par une tâche planifiée (pg_cron + pg_net, voir le README). Utilise la clé service_role
// (fournie automatiquement par Supabase à toute Edge Function) pour parcourir tous les
// utilisateurs abonnés aux notifications.
//
// Règle anti-spam : une tâche en retard n'est rappelée qu'une seule fois par jour
// (reminded_at est comparé à la date du jour, pas à l'heure exacte).
//
// Secrets requis (déjà nécessaires pour send-notification) :
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT

import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    webpush.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") ?? "mailto:contact@example.com",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );

    const today = new Date().toISOString().slice(0, 10);

    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth");
    if (subsError) throw subsError;

    const userIds = [...new Set((subs ?? []).map((s) => s.user_id as string))];
    if (userIds.length === 0) return json({ notified: 0 });

    // Tâches en retard (échéance aujourd'hui ou avant, pas terminées), pas encore rappelées aujourd'hui.
    const { data: overdueTasks, error: tasksError } = await supabase
      .from("tasks")
      .select("id, user_id, title, due_date, reminded_at")
      .in("user_id", userIds)
      .in("status", ["todo", "doing"])
      .lte("due_date", today)
      .not("due_date", "is", null);
    if (tasksError) throw tasksError;

    const toRemindToday = (overdueTasks ?? []).filter((t) => {
      const remindedDate = t.reminded_at ? String(t.reminded_at).slice(0, 10) : null;
      return remindedDate !== today;
    });

    const byUser = new Map<string, typeof toRemindToday>();
    for (const t of toRemindToday) {
      const list = byUser.get(t.user_id as string) ?? [];
      list.push(t);
      byUser.set(t.user_id as string, list);
    }

    let notified = 0;
    for (const [userId, tasks] of byUser) {
      const userSubs = (subs ?? []).filter((s) => s.user_id === userId);
      if (userSubs.length === 0 || tasks.length === 0) continue;

      const body =
        tasks.length === 1
          ? `"${tasks[0].title}" est en retard.`
          : `${tasks.length} tâches en retard, dont "${tasks[0].title}".`;

      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
            JSON.stringify({ title: "Tâche en retard", body, url: "/tasks" }),
          );
          notified++;
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          } else {
            console.error("Échec d'envoi push :", err);
          }
        }
      }

      await supabase
        .from("tasks")
        .update({ reminded_at: new Date().toISOString() })
        .in("id", tasks.map((t) => t.id));
    }

    return json({ notified, usersConcerned: byUser.size });
  } catch (err) {
    console.error(err);
    return json({ error: err instanceof Error ? err.message : "Erreur inconnue" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
