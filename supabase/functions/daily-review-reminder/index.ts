// Fonction Edge Supabase — rappel du soir pour la revue quotidienne.
// Conçue pour être appelée une fois par jour par une tâche planifiée (pg_cron + pg_net,
// voir le SQL fourni dans le README). Utilise la clé service_role (fournie automatiquement
// par Supabase à toute Edge Function — pas besoin de la configurer) pour parcourir tous
// les utilisateurs ayant activé les notifications, sans être limitée par un utilisateur précis.
//
// Règle volontairement simple pour commencer (voir section "Notifications intelligentes" du
// projet) : un seul rappel, un seul moment, une seule condition — pas de bruit.
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

    // Utilisateurs distincts ayant au moins un abonnement push actif.
    const { data: subs, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth");
    if (subsError) throw subsError;

    const userIds = [...new Set((subs ?? []).map((s) => s.user_id as string))];
    if (userIds.length === 0) return json({ notified: 0 });

    const { data: reviewsToday, error: reviewsError } = await supabase
      .from("daily_reviews")
      .select("user_id")
      .eq("review_date", today)
      .in("user_id", userIds);
    if (reviewsError) throw reviewsError;

    const alreadyDone = new Set((reviewsToday ?? []).map((r) => r.user_id as string));
    const toNotify = userIds.filter((id) => !alreadyDone.has(id));

    let notified = 0;
    for (const userId of toNotify) {
      const userSubs = (subs ?? []).filter((s) => s.user_id === userId);
      for (const sub of userSubs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint as string, keys: { p256dh: sub.p256dh as string, auth: sub.auth as string } },
            JSON.stringify({
              title: "Revue du soir",
              body: "3 minutes pour faire le point avant demain.",
              url: "/review",
            }),
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
    }

    return json({ notified });
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
