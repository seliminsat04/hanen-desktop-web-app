# 🩺 Hanen Pro | Plateforme Clinique de Télésurveillance Vocale

![Hanen Pro Logo](public/hanen-logo.png)

> **"L'écoute clinique, augmentée par l'intelligence."**  
> Hanen Pro est une solution de pointe dédiée aux professionnels de santé pour le suivi à distance des patients via l'analyse biométrique et sémantique de la voix.

---

## 🌟 Vision & Concept

**Hanen Pro** (signifiant *Tendresse/Compassion* en arabe) réinvente le lien médecin-patient. En capturant les nuances subtiles de la voix, notre plateforme permet de détecter précocement les signes de fatigue, de stress ou de dégradation cognitive, offrant ainsi une surveillance proactive sans être intrusive.

## 🚀 Fonctionnalités Clés

### 📊 Dashboard Clinique Intelligent
- **Surveillance en Temps Réel** : Un aperçu instantané de l'état de santé de votre patientèle via des indicateurs dynamiques (KPIs).
- **Cartes de Statistiques Animées** : Utilisation de `motion/react` pour des animations de comptage élégantes et fluides.
- **Visualisation de Données** : Graphiques avancés avec `Recharts` pour suivre l'évolution de l'index de dignité, le niveau de fatigue et l'adhérence thérapeutique.

### 👥 Gestion Holistique des Patients
- **Profils Détaillés** : Âge, sexe, comorbidités, et habitudes de vie.
- **Index de Dignité** : Une mesure exclusive permettant de s'assurer que le suivi respecte le bien-être émotionnel du patient.
- **Historique des Sessions Vocales** : Accès aux transcriptions, résumés IA et marqueurs de sentiment (Positif, Neutre, Négatif).

### 🚨 Système d'Alertes Prédictives
- **Détection de Signes Faibles** : L'IA identifie les changements de timbre, de débit ou de tonalité.
- **Priorisation Intelligente** : Alertes classées par niveau d'urgence (High, Medium, Low) pour une gestion efficace du temps médical.
- **Protocoles de Résolution** : Possibilité de clore des incidents avec des notes cliniques précises.

### ⚙️ Configuration & Compliance (RGPD/INPDP)
- **Gestion du Cycle de Vie des Données** : Paramétrage précis de la durée de conservation (1 mois à 2 ans, ou personnalisé).
- **Anonymisation Native** : Option de suppression des marqueurs d'identité dans les logs vocaux.
- **Personnalisation de l'IA** : Ajustement des seuils de détection pour les appels de confort et de détresse.

---

## 🛠 Tech Stack

L'architecture de Hanen Pro repose sur les technologies les plus modernes pour garantir performance, sécurité et maintenabilité.

- **Frontend** : [React 19](https://react.dev/) + [Vite 6](https://vitejs.dev/)
- **Backend** : [Express](https://expressjs.com/) sur Node.js
- **Base de Données & Auth** : [Firebase 12](https://firebase.google.com/) (Firestore et Authentication)
- **Intelligence Artificielle** : [Google Gemini API](https://ai.google.dev/) (@google/genai)
- **Styling** : [Tailwind CSS 4](https://tailwindcss.com/)
- **Animations** : [Framer Motion](https://motion.dev/) (motion/react)
- **Graphiques** : [Recharts](https://recharts.org/)
- **Typographie** : Inter & Space Grotesk (pour une esthétique clinique et moderne)

---

## 📁 Structure du Projet

```bash
├── public/                 # Assets statiques (Logo, Icons)
├── src/
│   ├── components/         # Composants UI réutilisables (CountUp, Sidebar, Header...)
│   ├── hooks/              # Custom hooks (useFirestoreData...)
│   ├── lib/                # Configurations (Firebase, Utils, Seeder)
│   ├── pages/              # Vues principales (Dashboard, Patients, Settings...)
│   ├── types.ts            # Définitions strictes des types TypeScript
│   ├── App.tsx             # Routing et Layout principal
│   └── main.tsx            # Point d'entrée React
├── server.ts               # Serveur Express & Middleware Vite
├── firestore.rules         # Règles de sécurité Firestore (Granular Access Control)
└── package.json            # Manifeste des dépendances et scripts
```

---

## 🔐 Sécurité & Confidentialité

Le projet implémente des règles de sécurité Firestore rigoureuses :
- **Isolation des Locataires (Tenants)** : Les médecins n'accèdent qu'aux données de leur propre cabinet.
- **Validation des Schémas** : Protection contre l'injection de données invalides via les `affectedKeys`.
- **Consentement Éclairé** : Système de signature numérique intégré avant toute analyse IA.

---

## ⚙️ Installation & Lancement

1. **Cloner le dépôt**
   ```bash
   git clone https://github.com/votre-repo/hanen-pro.git
   ```

2. **Installer les dépendances**
   ```bash
   npm install
   ```

3. **Variables d'environnement**
   Créez un fichier `.env` à la racine (voir `.env.example`) :
   - `GEMINI_API_KEY` : Votre clé API Google AI.
   - Configuration Firebase (API Key, Project ID, etc.).

4. **Lancer en mode développement**
   ```bash
   npm run dev
   ```

5. **Build pour la production**
   ```bash
   npm run build
   npm start
   ```

---

## 👨‍⚕️ À Propos

Hanen Pro a été conçu pour humaniser la technologie. Chaque aspect de l'interface, du choix des couleurs au timing des animations, a été pensé pour réduire la charge cognitive des médecins et maximiser l'efficacité du suivi.

---

*Développé avec ❤️ pour le secteur de la santé par l'équipe Hanen.*
