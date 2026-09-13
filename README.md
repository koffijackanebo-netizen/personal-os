# Personal OS

Ton système personnel d'exécution et de croissance — MVP.

Transforme des objectifs abstraits en actions concrètes exécutables au quotidien :
**Objectif → Projet → Prochaine action → Créneau → Exécution → Vérification.**

## Fonctionnalités du MVP

- **Dashboard** — Top 3 priorités, "Une seule chose", prochaine action, tâches du jour/en retard, habitudes, progression des objectifs, temps de deep work.
- **Objectifs** — par domaine de vie (carrière, finances, business, développement personnel, relations, apprentissage, santé, organisation), avec échéance, indicateur, raison, priorité, progression. Alerte si un objectif n'a aucune action liée.
- **Projets** — statut, prochaine action, échéance, valeur potentielle, temps investi. Alerte si trop de projets actifs simultanément.
- **Tâches** — priorité, durée, énergie requise, échéance, statut, report (avec compteur). **Mode Minimum** : réduit une tâche à sa plus petite version exécutable.
- **Habitudes** — suivi quotidien, taux d'exécution, régularité, détection des habitudes fragiles selon le contexte (matin/soir).
- **Revue quotidienne** — 5 questions, 3 à 5 minutes, orientée cause plutôt que culpabilité.
- **Deep Work** — session chronométrée, un objectif unique, mesure du résultat produit.
- **Assistant IA** — chat avec une personnalité calme, lucide, exigeante, stratégique et directe (jamais motivationnelle ni complaisante), alimenté par le contexte réel (objectifs, tâches, habitudes, revues récentes).

## Stack technique

- **Frontend** : React + TypeScript + Vite (SPA), Tailwind CSS v4, shadcn/ui (style new-york), TanStack Query, React Router.
- **Backend / DB** : Supabase (Postgres + Auth + Row Level Security + Edge Functions).
- **IA** : Edge Function Supabase (Deno) qui appelle l'API Claude (Anthropic) — clé API gardée côté serveur.
- **Hébergement** : n'importe quel hébergeur de site statique (Vercel, Netlify, Cloudflare Pages...) + Supabase Cloud.

Architecture modulaire par domaine (`src/pages` + `src/hooks` un par module) pour ajouter plus tard : calendrier, WhatsApp, email, notifications, automatisations, statistiques, intégrations externes — sans toucher au reste.

## Mise en route

### 1. Créer le projet Supabase

1. Va sur [supabase.com](https://supabase.com), crée un nouveau projet.
2. Dans **SQL Editor**, exécute le contenu de `supabase/migrations/00000000000001_init.sql` (crée les tables, les policies RLS, et le trigger qui seed automatiquement ton profil + tes 8 domaines de vie à l'inscription).
3. Dans **Project Settings → API**, récupère `Project URL` et la clé `anon public`.

### 2. Configurer l'app

```bash
cp .env.example .env
# remplis VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY
npm install
npm run dev
```

Ouvre `http://localhost:5173`, crée ton compte (email + mot de passe). Ton profil et tes domaines de vie sont créés automatiquement.

### 3. Activer l'Assistant IA (optionnel mais recommandé)

Nécessite la [CLI Supabase](https://supabase.com/docs/guides/cli) :

```bash
supabase login
supabase link --project-ref <ton-project-ref>
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
supabase functions deploy assistant
```

Sans cette étape, tout le reste de l'app fonctionne — seul l'onglet Assistant renverra une erreur.

### 4. Déployer le frontend

N'importe quel hébergeur de site statique fonctionne (build command `npm run build`, dossier `dist`). Pense à renseigner les mêmes variables d'environnement (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) côté hébergeur.

## Prochaines étapes (hors MVP, prévues par l'architecture)

- Revue hebdomadaire avec diagnostic comportemental
- Module financier (revenus, dépenses, objectifs, "revenu potentiel en construction")
- Module décisions (problème / options / coût / bénéfice / risque / réversibilité)
- Tableau de progression personnelle (discipline, audace, exécution, concentration...)
- Notifications et interventions intelligentes
- Intégrations calendrier / WhatsApp / email
- PWA installable sur mobile
