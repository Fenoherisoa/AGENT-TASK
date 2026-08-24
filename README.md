# RFC Task Agent

Agent d'automatisation et robot d'exécution local pour les opérateurs Telegram. Développé avec **React + TypeScript + Vite** pour l'interface opérateur et **Node.js (Express) + TypeScript** pour le backend, avec persistance SQLite/JSON et gestionnaire de file d'attente d'automatisation.

---

## 🎯 Architecture RFC Task Agent

Le système repose sur la connexion directe au compte ou à la session Telegram autorisée par l'opérateur, sans dépendance obligatoire vis-à-vis d'un bot tiers ou d'identifiants imposés :

```text
RFC TASK AGENT
        ↓
AUTHORIZED TELEGRAM ACCOUNT CONNECTION (Session Utilisateur ou Bot)
        ↓
TELEGRAM SESSION
        ↓
CHAT DISCOVERY (Groupes & Canaux autorisés)
        ↓
MESSAGE SYNCHRONIZATION
        ↓
TASK DETECTION & PARSER
        ↓
TASK QUEUE (Persistance SQLite/JSON)
        ↓
WORKFLOW ENGINE & BROWSER CONTROLLER
```

---

## 🌐 Configuration Navigateur & URL Cible (Optionnelle)

La variable `TARGET_URL` est **strictement optionnelle**. L'agent démarre, se synchronise avec Telegram et exécute ses tâches sans nécessiter d'URL cible globale par défaut.

Le contrôleur de navigateur (`BrowserManager`) prend en charge 3 modes de résolution d'URL dans l'ordre de priorité suivant :

1. **Saisie manuelle ou étape active** : URL saisie directement par l'opérateur depuis l'écran Navigateur (`/browser`) ou cible d'étape spécifique (`step.target`).
2. **URL spécifique au Workflow** : Champ `targetUrl` défini dans la configuration du workflow en cours d'exécution.
3. **URL globale par défaut (`TARGET_URL`)** : URL de repli configurée dans les Paramètres ou le fichier `.env` si elle est définie.

Si aucune URL n'est configurée, le navigateur s'initialise dans un état prêt sans déclencher d'erreur et permet la navigation interactive.

---

## 🚀 Démarrage Rapide

### 1. Installation des dépendances
```bash
npm install
```

### 2. Lancement en Mode Développement (Local)
```bash
npm run dev
```
L'application s'ouvre sur `http://localhost:3000`.

### 3. Exécution de la Validation & des Tests
```bash
npm run typecheck
npm run test
```

### 4. Build de Production
```bash
npm run build
npm run start
```

---

## 🔑 Connexion au Compte Telegram

L'opérateur dispose d'un écran dédié **"Telegram Account"** (`/telegram`) pour connecter son compte ou sa session :

1. **Session Utilisateur (Recommandé pour l'opérateur)** :
   - Renseignez votre `API ID`, `API Hash` et votre chaîne de session authentifiée (`Session String`).
   - Permet à l'agent de synchroniser les messages de vos discussions autorisées en toute indépendance.

2. **Bot Token (Optionnel / Administrateur)** :
   - Si un bot dédié est mis à disposition par l'administrateur, renseignez le token HTTP API (`123456:ABC...`).

3. **Découverte Dynamique des Discussions** :
   - Dès la connexion réussie (`CONNECTED`), l'agent découvre automatiquement les groupes et canaux de travail disponibles.
   - Les chats peuvent être assignés aux rôles `TASK_SOURCE` (source de tâches), `DATA_SOURCE` (données complémentaires) ou `NOTIFICATION_CHAT` (alertes).

> **Important** : Si Telegram n'est pas connecté, l'application affiche un état clair `TELEGRAM NOT CONNECTED` et n'injecte aucune fausse donnée.

---

## 🛡️ Règles de Sécurité & Actions Manuelles

- **Redaction stricte des secrets** : Les mots de passe et tokens sont masqués dans les journaux d'audit (`redactSecret()`).
- **Points de contrôle manuels** : Les étapes nécessitant une intervention humaine (codes SMS, vérifications sensibles) basculent la tâche en `WAITING_MANUAL_ACTION` pour que l'opérateur intervienne dans son navigateur local avant de reprendre la séquence automatique.
- **Persistance locale** : Toutes les tâches, exécutions et versions de workflows sont conservées localement dans `.data/local_tasks_db.json`.

---

## 📁 Structure du Projet

```
├── src/
│   ├── pages/
│   │   ├── Dashboard.tsx            # Tableau de bord principal opérateur
│   │   ├── Tasks.tsx                # File d'attente détaillée & gestion des états
│   │   ├── TelegramConnection.tsx   # Gestionnaire de connexion Telegram (Session / Bot)
│   │   ├── TelegramChats.tsx        # Découverte et surveillance des chats
│   │   ├── Automation.tsx           # Console d'exécution séquentielle en direct
│   │   ├── Workflows.tsx            # Éditeur de workflows, étapes & versions
│   │   ├── WorkflowRecorder.tsx     # Enregistreur interactif de workflows
│   │   ├── BrowserPage.tsx          # Contrôleur et actions du navigateur local
│   │   ├── ActivityLog.tsx          # Journal d'audit temps réel
│   │   ├── Settings.tsx             # Paramètres moteur, navigateur & base
│   │   └── SystemTest.tsx           # Suite de diagnostics intégrée
│   ├── services/
│   │   └── api.ts                   # Client API REST & SSE
│   └── types/
│       └── task.ts                  # Types TypeScript stricts
│
├── server/
│   ├── server.ts                    # API Express & flux SSE
│   ├── telegram.ts                  # Service de synchronisation Telegram
│   ├── automationRunner.ts          # Moteur de séquences & checkpoints
│   ├── browserManager.ts            # Gestionnaire de session navigateur & URL optionnelle
│   ├── workflowRecorder.ts          # Enregistrement des flux
│   ├── taskParser.ts                # Analyseur de tâches structurées
│   ├── phoneProvider.ts             # Gestionnaire de réservations de numéros
│   ├── database.ts                  # Persistance SQLite/JSON locale
│   └── logger.ts                    # Journalisation avec masquage des secrets
│
└── tests/
    ├── parser.test.ts               # Tests du parseur de tâches
    ├── queue.test.ts                # Tests de la machine d'états
    ├── phone.test.ts                # Tests d'isolation des numéros
    └── browser.test.ts              # Tests de résolution d'URL et session navigateur
```
