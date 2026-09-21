import * as React from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export type PushStatus = "unsupported" | "unsubscribed" | "subscribed" | "loading";

export function usePushNotifications() {
  const { user } = useAuth();
  const [status, setStatus] = React.useState<PushStatus>("loading");

  const supported =
    typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

  const refresh = React.useCallback(async () => {
    if (!supported) {
      setStatus("unsupported");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setStatus(sub ? "subscribed" : "unsubscribed");
    } catch {
      setStatus("unsubscribed");
    }
  }, [supported]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function enable() {
    if (!supported || !user) return;
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidKey) {
      throw new Error("VITE_VAPID_PUBLIC_KEY manquante — configure-la dans Vercel puis redéploie.");
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Permission refusée pour les notifications.");
    }
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    });
    const json = sub.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: json.endpoint!,
        p256dh: json.keys!.p256dh,
        auth: json.keys!.auth,
      },
      { onConflict: "endpoint" },
    );
    if (error) throw error;
    setStatus("subscribed");
  }

  async function disable() {
    if (!supported) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    setStatus("unsubscribed");
  }

  async function sendTest() {
    const { error } = await supabase.functions.invoke("send-notification", {
      body: { title: "Personal OS", body: "Notification de test — tout fonctionne." },
    });
    if (error) throw error;
  }

  return { status, supported, enable, disable, sendTest };
}
