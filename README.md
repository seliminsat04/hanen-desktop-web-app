# 🩺 Hanen Pro | Plateforme Clinique de Télésurveillance Vocale

![Hanen Pro Logo](public/hanen-logo.png)

> **"L'écoute clinique, augmentée par l'intelligence artificielle."**  
> Hanen Pro est une solution de pointe dédiée aux professionnels de santé pour le suivi à distance des patients via l'analyse biométrique et sémantique de la voix.

---

## 🌟 Vision & Concept

**Hanen Pro** (signifiant *Tendresse/Compassion* en arabe) réinvente le lien médecin-patient. En capturant les nuances subtiles de la voix, notre plateforme permet de détecter précocement les signes de fatigue, de stress ou de dégradation cognitive, offrant ainsi une surveillance proactive sans être intrusive.

## 🚀 Écosystème de Fonctionnalités

### 1. 📊 Dashboard Clinique & Pilotage
- **Indicateurs KPIs Dynamiques** : Aperçu instantané (Comptage de patients, Alertes Actives, Index de Dignité Moyen, Taux d'Observance).
- **Animations Count-Up** : Transition fluide des données pour une lecture dynamique.
- **État de Santé Global** : Visualisation des tendances de la patientèle sur les dernières 24h.

### 2. 👥 Gestion Patient 360°
- **Dossier Médical Unifié** : Historique complet, antécédents, comorbidités et traitements en cours.
- **Fiche Patient Multi-Dimensionnelle** :
  - **Biométrie Vocale** : Analyse technique du signal (Fréquence, Jitter, Shimmer, Stabilité).
  - **Profil Comportemental** : Évaluation du stress, de la fatigue et de l'humeur.
  - **Journal de Bord** : Chronologie des interactions et des événements cliniques.
  - **Observance (Adhérence)** : Suivi rigoureux de la prise de médicaments.

### 3. 🎙️ Capsule Vocale Hanen (Communication Avancée)
- **Moteur de Synthèse IA** : Conversion de consignes (texte ou voix enregistrée) en appels téléphoniques synthétisés.
- **Paramètres Cognitifs** :
  - **Élocution Adaptative** : Rythme standard ou *Lent/Apaisé* pour les patients fragiles.
  - **Tonalité Émotionnelle** : Choix entre un ton *Chaleureux* ou *Solennel*.
- **Modes de Distribution** : Appels immédiats ou insertion dans le "Journal Vocal Matinal".
- **Bibliothèque de Modèles** : Templates cliniques pré-paramétrés (Consultation, Résultats, Motivation).
- **Speech-to-Text** : Transcription automatique des mémos vocaux du médecin avant envoi.

### 4. 🤖 Copilote Médical IA (Assistant Virtuel)
- **Analyse de Contexte** : L'assistant sait quel dossier patient vous consultez pour répondre avec précision.
- **Aide à la Décision** : Résumés cliniques instantanés, vérification d'interactions médicamenteuses et analyse d'alertes.
- **Protocoles de Surveillance** : Assistance dans la définition des seuils de détection IA.

### 5. 🚨 Système d'Alertes Prédictives
- **Détection IA de Signes Faibles** : Identification automatique de détresse respiratoire ou émotionnelle.
- **Triage Intelligent** : Classification automatique par urgence (Haute, Moyenne, Basse).
- **Gestion du Cycle d'Alerte** : Archivage des interventions et historique de prise en charge.

### 6. ⚙️ Sécurité & Compliance (INPDP / RGPD)
- **Consentement Éclairé** : Signature numérique obligatoire pour l'analyse IA.
- **Gestion de la Rétention** : Paramétrage de la durée de conservation des données avec option de suppression immédiate.
- **Anonymisation Native** : Option de caviardage des marqueurs d'identité dans les transcriptions vocales.

---

## 🛠 Tech Stack & Architecture

- **Core** : [React 19](https://react.dev/) + [Vite 6](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **State & Backend** : [Firebase 12](https://firebase.google.com/) (Firestore Real-time, Auth, Storage)
- **Intelligence Artificielle** : 
  - [Google Gemini API](https://ai.google.dev/) (Analyse sémantique et contextuelle).
  - Moteur de Synthèse Vocale (Web Speech API & Cloud Integration).
- **Design System** : 
  - [Tailwind CSS 4](https://tailwindcss.com/) (Utilitarisme radical).
  - [Lucide React](https://lucide.dev/) (Iconographie clinique).
  - [Framer Motion](https://motion.dev/) (motion/react) pour l'expérience utilisateur premium.
- **Graphiques** : [Recharts](https://recharts.org/) pour la télémétrie médicale.

---

## 📁 Organisation du Code

```bash
├── public/                 # Assets (hanen-logo.png)
├── src/
│   ├── components/         # Chatbot, Sidebar, Header, CountUp...
│   ├── hooks/              # useFirestoreData (Real-time syncing)
│   ├── lib/                # Firebase Init, Utils, Seeder de données
│   ├── pages/              
│   │   ├── Dashboard.tsx   # Tableau de bord principal
│   │   ├── Patients.tsx    # Liste et filtres patients
│   │   ├── PatientDetail.tsx # Vue clinique granulaire (Tabs)
│   │   ├── Alerts.tsx      # Gestionnaire d'urgences
│   │   ├── Messages.tsx    # Centre de communication vocale
│   │   └── Settings.tsx    # Configuration Cabinet & IA
│   ├── types.ts            # Modèles de données (Patient, Alert, Message)
│   ├── Login.tsx           # Intro animée Hanen Pro
│   └── App.tsx             # Routing & Auth Guard
├── server.ts               # Serveur Express & API proxy pour Gemini
└── firestore.rules         # Sécurité granulaire (RBAC & Isolation Tenant)
```

---

## 🔐 Sécurité & Intégrité

Le système repose sur un modèle de **Multi-Tenancy** :
- **Isolation Critique** : Chaque médecin accède exclusivement aux données de son cabinet via des règles Firestore strictes.
- **Vérification de Schémas** : Les modifications de données sont filtrées par des règles de sécurité (affectedKeys) pour prévenir toute altération malveillante.

---

## 🩺 À Propos de Hanen

Hanen Pro n'est pas seulement un logiciel ; c'est un partenaire clinique. Chaque micro-interaction a été conçue pour réduire l'épuisement professionnel des médecins tout en garantissant une présence vocale rassurante auprès de chaque patient, 24h/24.

---

*Conçu avec expertise pour le futur de la médecine connectée.*
