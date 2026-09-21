-- Permet de savoir si une tâche en retard a déjà été rappelée aujourd'hui, pour
-- n'envoyer qu'un seul rappel push par tâche et par jour (pas de spam).

alter table public.tasks add column reminded_at timestamptz;
