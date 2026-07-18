# 🩺 Hanen Pro | Plateforme Clinique de Télésurveillance Vocale

![Hanen Pro Logo](public/hanen-logo.png)

> **"L'écoute clinique, augmentée par l'intelligence artificielle."**  
> Hanen Pro est une solution de pointe dédiée aux professionnels de santé pour le suivi à distance des patients via l'analyse biométrique et sémantique de la voix.
>
> 🌐 **Explorez notre solution : [hanen-ai.lovable.app](https://hanen-ai.lovable.app)**

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

### 3. 📊 Analyse Statistique & Reporting Avancé
- **Tableau d'Observance Clinique** : Suivi temporel de l'adhérence thérapeutique corrélé à l'indice de dignité.
- **Biomarqueurs Vocaux** : Visualisation des anomalies détectées (Dyspnée, Fatigue, Tremblements) via `Recharts`.
- **Exportation de Rapports PDF** : Génération de synthèses cliniques professionnelles avec `jsPDF` pour le dossier patient physique.
- **Filtrage par Pathologie** : Analyse granulaire des cohortes (Diabète, Insuffisance Cardiaque, Alzheimer).

### 4. 🎙️ Capsule Vocale Hanen (Communication Avancée & Agent Live)
- **Moteur de Synthèse IA** : Conversion de consignes (texte ou voix enregistrée) en appels téléphoniques synthétisés.
- **Agent Vocal Conversationnel (Gemini Live API)** : Interaction fluide en temps réel (Audio-à-Audio) avec l'assistante virtuelle Hanen. Le médecin peut dicter ses consignes à haute voix et dialoguer en temps réel.
- **Paramètres Cognitifs** :
  - **Élocution Adaptative** : Rythme standard ou *Lent/Apaisé* pour les patients fragiles.
  - **Tonalité Émotionnelle** : Choix entre un ton *Chaleureux* ou *Solennel*.
- **Modes de Distribution** : Appels immédiats ou insertion dans le "Journal Vocal Matinal".
- **Bibliothèque de Modèles** : Templates cliniques pré-paramétrés (Consultation, Résultats, Motivation).
- **Speech-to-Text** : Transcription automatique des mémos vocaux du médecin avant envoi.

---

## 🎙️ Zoom Technique : L'Agent de Télésurveillance Vocale Live

L'application intègre une expérience de **vrai dialogue Audio-à-Audio temps réel (Full-Duplex)**. Loin des modèles classiques combinant laborieusement trois systèmes distincts (STT -> LLM -> TTS), cet outil utilise l'API **Gemini Multimodal Live**.

### 🛠️ Architecture et Flux du Signal

```
[Microphone Médecin] ──(44.1/48kHz Float32)──► [Client Browser / AudioContext]
                                                      │
                                           Downsampling à 16kHz
                                           Int16 signed PCM conversion
                                                      │
[Gemini Live Server] ◄──(Base64 WebSockets)─── [Serveur Express Proxy (/live)]
         │
  Génère des blocs
  24kHz Int16 Raw PCM
         │
[Serveur Express Proxy (/live)] ──(Base64)──► [Client Browser / AudioBufferSource]
                                                      │
       Haut-parleur (24kHz Playback) ◄────────────────┘
```

#### 1. Traitement Audio Client (`src/pages/Messages.tsx`)
- **Captation native** : Utilisation de `navigator.mediaDevices.getUserMedia` avec filtres matériels activés (`echoCancellation: true`, `noiseSuppression: true`).
- **Downsampling Temps Réel** : Les flux navigateurs (généralement cadencés à 44.1kHz ou 48kHz) sont filtrés et sous-échantillonnés de manière dynamique à **16 000 Hz (16kHz signed 16-bit PCM)** pour correspondre précisément aux spécifications de flux d'entrée de Gemini.
- **Lecture Synchrone** : Le décodage s'effectue en sens inverse à une fréquence de **24 000 Hz (24kHz)** à l'intérieur d'un pipeline d'alimentation dynamique régulé par `nextStartTimeRef.current` pour éliminer tout effet de hachage audio.
- **Support des Interruptions (Barge-In)** : Dès que le médecin parle pendant que Gemini émet, le serveur Gemini transmet un signal `interrupted: true`. Le code client arrête immédiatement toutes les sources d'audio actives (`activeSourcesRef.current.forEach(src => src.stop())`), instanciant un dialogue fluide et des interruptions naturelles.

#### 2. Passerelle de Communication Serveur (`server.ts`)
- **Passerelle WebSockets sécurisée** : Un serveur WebSockets (`ws`) monté sur la route `/live` intercepte et maintient la connexion persistante bidirectionnelle entre l'UI du navigateur et le serveur d'API de Google Gemini.
- **Protocole Multimodal Gemini** : Initialise la connexion via le SDK officiel `@google/genai` en utilisant le modèle à ultra-basse latence **`gemini-2.0-flash-exp`**, configuré avec la modalité exclusive `Modality.AUDIO` et le profil vocal `"Zephyr"`.
- **Aide Contextuelle Dynamique** : Injecte à la volée le dossier clinique actif du patient sélectionné dans le paramètre `systemInstruction`, guidant ainsi le comportement et l'expertise médicale de la voix de Hanen.

---

### 5. 🤖 Copilote Médical IA (Assistant Virtuel)
- **Analyse de Contexte** : L'assistant sait quel dossier patient vous consultez pour répondre avec précision.
- **Aide à la Décision** : Résumés cliniques instantanés, vérification d'interactions médicamenteuses et analyse d'alertes.
- **Protocoles de Surveillance** : Assistance dans la définition des seuils de détection IA.

### 6. 🚨 Système d'Alertes Prédictives
- **Détection IA de Signes Faibles** : Identification automatique de détresse respiratoire ou émotionnelle.
- **Triage Intelligent** : Classification automatique par urgence (Haute, Moyenne, Basse).
- **Gestion du Cycle d'Alerte** : Archivage des interventions et historique de prise en charge.

### 7. ⚙️ Sécurité & Compliance (INPDP / RGPD)
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
│   │   ├── Statistics.tsx  # Analyse analytique & Rapports PDF
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

## 🌍 Site Officiel & Contact

Pour découvrir l'ensemble de notre écosystème, nos études de cas et nos offres commerciales, visitez notre plateforme de présentation :

👉 [**https://hanen-ai.lovable.app**](https://hanen-ai.lovable.app)

---

*Conçu avec expertise pour le futur de la médecine connectée.*
