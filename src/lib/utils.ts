import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formate une date ISO (YYYY-MM-DD) en libellé court français. */
export function formatDateFr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** Date du jour au format YYYY-MM-DD (fuseau local). */
export function todayISO(): string {
  const d = new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

export function isOverdue(dueDate: string | null | undefined): boolean {
  if (!dueDate) return false;
  return dueDate < todayISO();
}

/**
 * Extrait un message lisible d'une erreur, qu'il s'agisse d'une vraie `Error` JS
 * ou d'un objet d'erreur Supabase/Postgrest (qui a un `.message` mais n'étend pas `Error`).
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "Une erreur est survenue";
}
