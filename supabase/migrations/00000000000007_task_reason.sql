-- Capture la "raison" d'une tâche (pourquoi cette décision/action), distincte de la
-- description (ce qu'il faut faire). Permet de cliquer une tâche plus tard et de
-- retrouver pourquoi elle a été créée — même logique que goals.reason.

alter table public.tasks add column reason text;
