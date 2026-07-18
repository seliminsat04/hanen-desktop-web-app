import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Phone, ArrowLeft, Mic, User, Activity, Heart, FileText, Play, Pause, 
  AlertTriangle, Calendar, TrendingUp, ChevronRight, Check, X, ShieldAlert, 
  Sparkles, Send, Volume2, Save, Plus, Trash2, CheckCircle, Clock, Info, ShieldCheck, HeartHandshake, HelpCircle, ChevronDown
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';
import { cn, formatSafeDate } from '../lib/utils';
import { doc, getDoc, collection, getDocs, setDoc, serverTimestamp, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../AuthContext';
import { Patient, VoiceSession, VoiceAlert } from '../types';
import { mockPatients, mockVoiceSessions } from '../data';
import { generatePatientZip, encryptPayload, decryptPayload } from '../utils/cryptoZipHelper';
import { saveAs } from 'file-saver';

// --- Extended Patient Clinical Parameters ---
const patientExtendedInfo: Record<string, {
  bloodType: string;
  weight: string;
  bloodPressure: string;
  heartRate: string;
  allergies: string[];
  emergencyContact: { name: string; relation: string; phone: string };
  preferredLanguage: string;
  referringDoctor: string;
}> = {
  p1: {
    bloodType: "A+",
    weight: "68 kg",
    bloodPressure: "135/82 mmHg",
    heartRate: "72 bpm",
    allergies: ["Pénicilline"],
    emergencyContact: { name: "Amira Ben Ali", relation: "Fille", phone: "+216 95 125 789" },
    preferredLanguage: "Derja tunisienne & Français",
    referringDoctor: "Dr. Kamel Ben Jemia"
  },
  p2: {
    bloodType: "O+",
    weight: "84 kg",
    bloodPressure: "142/88 mmHg",
    heartRate: "64 bpm",
    allergies: ["Aucune"],
    emergencyContact: { name: "Yassine Trabelsi", relation: "Fils", phone: "+216 23 456 789" },
    preferredLanguage: "Derja tunisienne",
    referringDoctor: "Dr. Slim Jamil"
  },
  p3: {
    bloodType: "AB-",
    weight: "59 kg",
    bloodPressure: "118/72 mmHg",
    heartRate: "80 bpm",
    allergies: ["Aspirine", "Sulfate de sodium"],
    emergencyContact: { name: "Mariem Mansour", relation: "Fille", phone: "+216 98 444 555" },
    preferredLanguage: "Derja tunisienne & Italien de base",
    referringDoctor: "Dr. Slim Jamil"
  },
  p4: {
    bloodType: "B+",
    weight: "77 kg",
    bloodPressure: "128/80 mmHg",
    heartRate: "74 bpm",
    allergies: ["Aucune'],"],
    emergencyContact: { name: "Sonia Gharbi", relation: "Fille", phone: "+216 50 111 222" },
    preferredLanguage: "Français & Derja",
    referringDoctor: "Dr. Mourad Sfar"
  },
  p5: {
    bloodType: "O-",
    weight: "64 kg",
    bloodPressure: "130/85 mmHg",
    heartRate: "78 bpm",
    allergies: ["Pollen de palmier"],
    emergencyContact: { name: "Kais Khemiri", relation: "Fils", phone: "+216 96 222 333" },
    preferredLanguage: "Derja tunisienne",
    referringDoctor: "Dr. Slim Jamil"
  },
  p6: {
    bloodType: "A-",
    weight: "72 kg",
    bloodPressure: "125/75 mmHg",
    heartRate: "70 bpm",
    allergies: ["Aucune"],
    emergencyContact: { name: "Leila Jendoubi", relation: "Fille (aidante principale)", phone: "+216 54 888 777" },
    preferredLanguage: "Derja tunisienne",
    referringDoctor: "Dr. Amina El Abed"
  },
  p7: {
    bloodType: "B-",
    weight: "66 kg",
    bloodPressure: "120/70 mmHg",
    heartRate: "72 bpm",
    allergies: ["Gluten"],
    emergencyContact: { name: "Malek Boubaker", relation: "Époux", phone: "+216 93 444 111" },
    preferredLanguage: "Français & Derja",
    referringDoctor: "Dr. Slim Jamil"
  },
  p8: {
    bloodType: "B+",
    weight: "74 kg",
    bloodPressure: "128/78 mmHg",
    heartRate: "76 bpm",
    allergies: ["Aucune"],
    emergencyContact: { name: "Sofiene Ayari", relation: "Fils", phone: "+216 92 333 444" },
    preferredLanguage: "Derja tunisienne",
    referringDoctor: "Dr. Slim Jamil"
  }
};

// --- Patient Extended Treatments ---
const patientTreatments: Record<string, {
  name: string;
  dosage: string;
  frequency: string;
  timing: string;
  doctorNotes: string;
  adherenceRate: number;
}[]> = {
  p1: [
    { name: "Metformine 1000mg", dosage: "1 comprimé", frequency: "2 fois par jour", timing: "Matin (09h00) & Soir (20h00)", doctorNotes: "Prendre au milieu des repas pour réduire les troubles intestinaux.", adherenceRate: 95 },
    { name: "Lisinopril 10mg", dosage: "1 comprimé", frequency: "1 fois par jour", timing: "Matin (09h00)", doctorNotes: "Surveiller la sensation de vertige en orthostatisme.", adherenceRate: 92 },
    { name: "Atorvastatine 20mg", dosage: "1 comprimé", frequency: "1 fois par jour", timing: "Soir (20h00)", doctorNotes: "Prendre de préférence après le dîner.", adherenceRate: 88 }
  ],
  p2: [
    { name: "Lasilix 40mg (Furosémide)", dosage: "1 comprimé", frequency: "1 fois par jour", timing: "Matin (08h00)", doctorNotes: "Suivi quotidien du poids recommandé pour détecter la rétention.", adherenceRate: 64 },
    { name: "Kardegic 75mg", dosage: "1 sachet", frequency: "1 fois par jour", timing: "Midi (13h00)", doctorNotes: "À prendre avec un grand verre d'eau au cours du repas.", adherenceRate: 85 },
    { name: "Ramipril 5mg", dosage: "1 gélule", frequency: "1 fois par jour", timing: "Soir (20h00)", doctorNotes: "Cibler la tension sous 140/90 mmHg.", adherenceRate: 78 }
  ],
  p3: [
    { name: "Paracétamol 1g", dosage: "1 comprimé", frequency: "3 fois par jour si besoin", timing: "Toutes les 8 heures", doctorNotes: "Maximum 3g par jour pour les crises d'arthrose.", adherenceRate: 50 },
    { name: "Sertraline 50mg (Zoloft)", dosage: "1 gélule", frequency: "1 fois par jour", timing: "Matin (09h00)", doctorNotes: "Rappels stimulants de Hanen centrés sur l'estime de soi.", adherenceRate: 65 }
  ],
  p5: [
    { name: "Ventoline 100µg", dosage: "1 ou 2 bouffées", frequency: "Si besoin, max 4 fois/j", timing: "À la demande", doctorNotes: "IA Hanen traque le rythme de toux consécutif lors de l'appel.", adherenceRate: 80 },
    { name: "Metformine 850mg", dosage: "1 comprimé", frequency: "2 fois par jour", timing: "Matin & Soir", doctorNotes: "Bonne tolérance générale.", adherenceRate: 82 }
  ],
  p8: [
    { name: "Levodopa/Carbidopa 100mg", dosage: "1 comprimé", frequency: "3 fois par jour", timing: "08h00, 14h00, 20h00", doctorNotes: "Prendre rigoureusement hors des repas riches en protéines.", adherenceRate: 70 },
    { name: "Rasagiline 1mg", dosage: "1 comprimé", frequency: "1 fois par jour", timing: "Matin (08h00)", doctorNotes: "Suivi de l'évolution des tremblements phonatoires.", adherenceRate: 70 }
  ]
};

// Default treatment for unspecified patients
const defaultTreatments = [
  { name: "Traitement Standard 500mg", dosage: "1 comprimé", frequency: "1 fois par jour", timing: "Matin", doctorNotes: "Suivi thérapeutique de routine.", adherenceRate: 85 }
];

// --- Patient Appointments ---
const patientAppointments: Record<string, {
  date: string;
  time: string;
  type: string;
  doctor: string;
  room: string;
}[]> = {
  p1: [
    { date: "2026-05-28", time: "10:30", type: "Contrôle Semestriel Diabète", doctor: "Dr. Kamel Ben Jemia", room: "Cabinet B, Tunis" },
    { date: "2026-06-15", time: "14:00", type: "Bilan Cardiologique & ECG", doctor: "Dr. Slim Jamil", room: "Salle 102, Clinique Hanen" }
  ],
  p2: [
    { date: "2026-05-25", time: "09:00", type: "Consultation Cardiologie", doctor: "Dr. Slim Jamil", room: "Salle 102, Clinique Hanen" },
    { date: "2026-06-20", time: "11:30", type: "Prise de sang à domicile", doctor: "Infirmière à Domicile", room: "Domicile du Patient" }
  ],
  p3: [
    { date: "2026-05-30", time: "16:15", type: "Consultation Gériatrie & Soutien", doctor: "Dr. Slim Jamil", room: "Salle 103, Clinique Hanen" }
  ]
};

const defaultAppointments = [
  { date: "2026-06-05", time: "11:00", type: "Contrôle d'observance", doctor: "Dr. Slim Jamil", room: "Salle de consultation" }
];

// --- AI Weekly Summaries ---
const patientWeeklySummaries: Record<string, string> = {
  p1: "Mme Fatima Ben Ali fait preuve d'une assiduité remarquable ce mois-ci. Les alertes douces de Hanen l'ont aidée à restaurer son habitude de prendre la Metformine juste après les repas. Aucun indicateur d'essoufflement ni de stress n'a été repéré par l'analyse acoustique. La voix est bien timbrée, animée et chaleureuse. Excellente observance globale de 92%.",
  p2: "M. Ahmed Trabelsi a manifesté un relâchement passager d'observance cette semaine, mentionnant à l'IA avoir oublié de prendre son Lasilix le 20 mai au soir. Les biomarqueurs d'analyse vocale de Hanen ont identifié une légère dyspnée de parole (essoufflement à l'effort phonatoire) lors du dialogue du 21 mai au matin. Surveillance rigoureuse de son poids requise sous 48h.",
  p3: "Mme Khadija Mansour suscite des préoccupations de solitude extrême et de baisse d'humeur. Pendant l'échange d'appel de 15 minutes le 21 mai, l'amplitude vocale était très faible et l'IA Hanen a capté des pleurs légers lorsqu'elle évoquait sa solitude. Son taux d'observance (Sertraline) a rétrogradé à 60% lié à l'apathie. Une visite directe semble cruciale.",
  p8: "M. Youssef Ayari exprime une fatigue neuromusculaire importante. Hanen a identifié de micro-tremblements phonatoires s'intensifiant en fin de phrase, corrélés à des retards de prise de Levodopa. Le sentiment d'humeur reste toutefoisCombatif."
};

const defaultWeeklySummary = "Le patient poursuit son dialogue quotidien de soutien avec Hanen. L'observance globale est conforme au protocole défini. La voix témoigne d'une stabilité clinique émotionnelle correcte.";

// --- Tunisian Derja Comfort Feedbacks ---
const patientDignityFeedbacks: Record<string, {
  date: string;
  dignityScore: number;
  verbatimDerja: string;
  frenchTranslation: string;
  category: string;
}[]> = {
  p1: [
    { date: "18 Mai 2026", dignityScore: 90, verbatimDerja: "« Wallah tfara7ni barcha Hanen, t9oul benti tsaksa 3liya dima... manich n7es rani t3ebt mel mcheb mta3 ed-dwe. »", frenchTranslation: "« Par Dieu, Hanen me fait grand plaisir, on dirait ma fille qui prend régulièrement de mes nouvelles... je ne me sens plus coupable avec mes médicaments. »", category: "Lien & Non-intrusion" },
    { date: "10 Mai 2026", dignityScore: 86, verbatimDerja: "« Swelha bel hdech ykhallini dima fer7a elli najem nsa3ed ro7i wa7di. » ", frenchTranslation: "« Ses questions attentionnées me rendent fière de savoir que je peux encore m'occuper de moi-même. »", category: "Préservation d'Autonomie" }
  ],
  p2: [
    { date: "21 Mai 2026", dignityScore: 72, verbatimDerja: "« N7es rani mdaye9 7ad kif nel9a tlifoun min Hanen... tsakket glag demla fi sedri. » ", frenchTranslation: "« Je sens que je ne dérange personne quand je reçois l'appel automatique de Hanen... cela apaise mon anxiété cardiaque. »", category: "Aisance de Dialogue" },
    { date: "14 Mai 2026", dignityScore: 68, verbatimDerja: "« El dwe welef bih b’chwaya ama el mcheb el bera7 rzan chwaya kletni do5a. »", frenchTranslation: "« Je m'habitue doucement au traitement, mais hier la fatigue m'a pesé et j'ai eu quelques vertiges. »", category: "Confort Clinique" }
  ],
  p3: [
    { date: "21 Mai 2026", dignityScore: 52, verbatimDerja: "« Rani faddit mel we7da f dar ya benti... s3ib el we7ed yekber l’wa7do... swalha dima mwanesni. »", frenchTranslation: "« J'en ai vraiment marre de la solitude chez moi ma fille... c'est si dur de vieillir seule... ses questions me réconfortent au moins. »", category: "Soutien Affectif" },
    { date: "12 Mai 2026", dignityScore: 58, verbatimDerja: "« Khaddemti l-kas bl-mcheb mta3 yedi el m3awach... n7es f tarf rou7i sghira... »", frenchTranslation: "« J'ai laissé tomber le verre à cause des tremblements de ma main... je me sens diminuée et vulnérable... »", category: "Image de Soi (Fragilisée)" }
  ],
  p8: [
    { date: "19 Mai 2026", dignityScore: 62, verbatimDerja: "« Yedi tr3ech barcha m3ach najem nched l-kas, ama Hanen ma tfaddich mel klem m3aya... »", frenchTranslation: "« Ma main tremble beaucoup, je ne peux plus tenir le verre, mais Hanen ne s'impatiente jamais d'écouter ma voix lente... »", category: "Préservation de la voix" }
  ]
};

const defaultFeedbacks = [
  { date: "20 Mai 2026", dignityScore: 80, verbatimDerja: "« El 7amdoullah kol chay mri7, Hanen dima mwansatni dial dwe... »", frenchTranslation: "« Dieu soit loué tout va bien, Hanen me tient toujours compagnie pour les médicaments... »", category: "Lien Social" }
];

// Glossary of Vocal Indicators Tooltips
const indicatorGlossary: Record<string, string> = {
  "Fatigue Vocale": "Indice d'asthénie vocale capté lors de la parole prolongée. Un score excessif (>65) témoigne d'une fatigue pulmonaire ou d'un épuisement musculaire.",
  "Essoufflement": "Dyspnée de parole. Signe d'insuffisance cardiaque congestive (congestion pulmonaire) ou d'exacerbation bronchique si détecté au repos.",
  "Rythme de Parole": "Traduit la vitesse d'élocution (bradylalie). Un ralentissement sévère peut signaler un trouble neurologique ou un épisode dépressif.",
  "Stabilité Émotionnelle": "Mesure de la sérénité phonatoire. Une chute brutale indique de l'anxiété, de l'angoisse de solitude ou des pleurs étouffés."
};

export function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const { tenantId } = useAuth();
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<VoiceSession[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 5 Tabs State as specified
  const [activeTab, setActiveTab] = useState<'overview' | 'voice' | 'adherence' | 'dignity' | 'notes'>('overview');
  
  // Doctor Interactive Notes state
  const [notesHistory, setNotesHistory] = useState<{ id: string; date: string; text: string; author: string }[]>([]);

  const [newNoteText, setNewNoteText] = useState('');

  // Voice Timeline Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'all' | '7days' | '30days'>('all');

  // Multi-line Vocal Evolution chart Toggle (30 vs 60 days)
  const [chartPeriod, setChartPeriod] = useState<30 | 60>(30);

  // Simulated Voice Session Ticker for Playable Audio Waves
  const [playingSessionId, setPlayingSessionId] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState<number>(0);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Send Vocal Message Modal State
  const [isVocalModalOpen, setIsVocalModalOpen] = useState(false);
  const [vocalCategory, setVocalCategory] = useState<'dwe' | 'wanesny' | 'nafas' | 'custom'>('dwe');
  const [customVocalText, setCustomVocalText] = useState('');
  const [vocalStatus, setVocalStatus] = useState<'idle' | 'generating' | 'sending' | 'success'>('idle');
  const [vocalStepText, setVocalStepText] = useState('');

  // General Notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Glossary Tooltip state
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);

  // ZIP secure export state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [zipEncryptionStatus, setZipEncryptionStatus] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Decryption tool panel state
  const [isDecryptModalOpen, setIsDecryptModalOpen] = useState(false);
  const [decryptPassword, setDecryptPassword] = useState('');
  const [decryptStatus, setDecryptStatus] = useState<string | null>(null);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [encryptedFile, setEncryptedFile] = useState<File | null>(null);

  const handleExportDossierSecure = async () => {
    if (!patient) return;
    if (!exportPassword) {
      setExportError("Veuillez saisir un mot de passe pour chiffrer l'archive.");
      return;
    }
    if (exportPassword.length < 4) {
      setExportError("Le mot de passe doit contenir au moins 4 caractères.");
      return;
    }
    
    setIsGeneratingZip(true);
    setExportError(null);
    setZipEncryptionStatus("Génération de l'archive ZIP en cours...");
    
    try {
      // Fetch alerts for this patient in real-time or fallback
      let patientAlerts: VoiceAlert[] = [];
      try {
        if (tenantId) {
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const alertsRef = collection(db, 'tenants', tenantId, 'alerts');
          const q = query(alertsRef, where('patientId', '==', patient.id));
          const snap = await getDocs(q);
          snap.forEach(docSnap => {
            patientAlerts.push({ id: docSnap.id, ...docSnap.data() } as VoiceAlert);
          });
        }
      } catch (err) {
        console.warn("Could not retrieve real-time alerts for zip export:", err);
      }
      
      setZipEncryptionStatus("Compression des rapports cliniques et enregistrements...");
      const zipBytes = await generatePatientZip(patient, sessions, patientAlerts);
      
      setZipEncryptionStatus("Sécurisation cryptographique AES-256 (PBKDF2/GCM)...");
      const encryptedBytes = await encryptPayload(zipBytes, exportPassword);
      
      setZipEncryptionStatus("Génération du paquet final sécurisé...");
      const blob = new Blob([encryptedBytes], { type: 'application/octet-stream' });
      
      // Clean filename compliant with safety and GDPR standards
      const safeName = patient.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      saveAs(blob, `DOSSIER_MED_CHIFFRE_${safeName}.zip.enc`);
      
      setZipEncryptionStatus("Téléchargement lancé avec succès !");
      setTimeout(() => {
        setIsExportModalOpen(false);
        setIsGeneratingZip(false);
        setExportPassword('');
        setZipEncryptionStatus(null);
      }, 1500);
      
    } catch (e: any) {
      console.error(e);
      setExportError(`Erreur lors du chiffrement : ${e.message || e}`);
      setIsGeneratingZip(false);
    }
  };

  const handleDecryptFile = async () => {
    if (!encryptedFile) {
      setDecryptError("Veuillez charger un fichier .zip.enc chiffré.");
      return;
    }
    if (!decryptPassword) {
      setDecryptError("Veuillez saisir le mot de passe de déchiffrement.");
      return;
    }
    
    setDecryptStatus("Déchiffrement en cours...");
    setDecryptError(null);
    
    try {
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        try {
          const arrBuffer = e.target?.result as ArrayBuffer;
          const combinedBytes = new Uint8Array(arrBuffer);
          
          setDecryptStatus("Vérification de l'intégrité et décodage AES-GCM...");
          const decryptedBytes = await decryptPayload(combinedBytes, decryptPassword);
          
          setDecryptStatus("Décompression et extraction de l'archive ZIP...");
          const blob = new Blob([decryptedBytes], { type: 'application/zip' });
          
          saveAs(blob, `DOSSIER_MED_DECHIFFRE_${patient?.name.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'patient'}.zip`);
          setDecryptStatus("Archive décompressée et prête !");
          
          setTimeout(() => {
            setIsDecryptModalOpen(false);
            setDecryptPassword('');
            setEncryptedFile(null);
            setDecryptStatus(null);
          }, 1500);
        } catch (err: any) {
          console.error(err);
          setDecryptError("Mot de passe incorrect ou fichier altéré. Échec de décomposition.");
          setDecryptStatus(null);
        }
      };
      fileReader.readAsArrayBuffer(encryptedFile);
    } catch (e: any) {
      console.error(e);
      setDecryptError(`Erreur lors du traitement : ${e.message || e}`);
      setDecryptStatus(null);
    }
  };

  // Retrieve patient and subscribe to updates
  useEffect(() => {
    if (!id) return;
    let unsubscribePatient = () => {};
    
    async function loadData() {
      setLoading(true);
      
      try {
        if (tenantId) {
          const pRef = doc(db, 'tenants', tenantId, 'patients', id);
          unsubscribePatient = onSnapshot(pRef, (pSnap) => {
            if (pSnap.exists()) {
              const data = pSnap.data();
              setPatient({ id: pSnap.id, ...data } as Patient);
              if (data.notes) {
                try {
                  const arr = JSON.parse(data.notes);
                  // Ensure it's an array
                  if (Array.isArray(arr)) setNotesHistory(arr);
                } catch(e) {
                  console.error("Notes non valides");
                }
              }
            } else {
              fallbackMockPatient()
            }
          }, (err) => {
            console.warn("Firestore patient retrieval failed, falling back to mock data.", err);
            fallbackMockPatient();
          });

          // Fetch voice sessions
          try {
            const sRef = collection(db, 'tenants', tenantId, 'patients', id, 'sessions');
            const sSnap = await getDocs(sRef);
            let sData: VoiceSession[] = [];
            if (sSnap && !sSnap.empty) {
              sSnap.forEach(docSnap => sData.push({ id: docSnap.id, ...docSnap.data() } as VoiceSession));
            } else {
              sData = fallbackMockSessions();
            }
            setSessions(sData);
          } catch(err) {
            console.warn("Sessions fallback", err);
            setSessions(fallbackMockSessions());
          }
        } else {
          fallbackMockPatient();
          setSessions(fallbackMockSessions());
        }
      } catch (err) {
        console.error("Critical error inside loadData:", err);
      } finally {
        setLoading(false);
      }
    }
    
    function fallbackMockPatient() {
      const matched = mockPatients.find(p => p.id === id);
      if (matched) {
        setPatient(matched);
      } else {
        setPatient(null);
      }
    }

    function fallbackMockSessions(): VoiceSession[] {
       const matched = mockVoiceSessions.filter(s => s.patientId === id);
       return matched.length > 0 ? matched : mockVoiceSessions;
    }

    loadData();
    
    return () => {
      unsubscribePatient();
    };
  }, [tenantId, id]);

  // Audio Playback simulation tick
  useEffect(() => {
    if (playingSessionId) {
      setPlayProgress(0);
      const limit = 45; // simulated seconds
      playIntervalRef.current = setInterval(() => {
        setPlayProgress(prev => {
          if (prev >= 100) {
            clearInterval(playIntervalRef.current!);
            setPlayingSessionId(null);
            showNotification("Extrait audio terminé.");
            return 0;
          }
          return prev + (100 / limit);
        });
      }, 500);
    } else {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [playingSessionId]);

  // Helper trigger action message toast
  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleAudioPlayToggle = (sessionId: string) => {
    if (playingSessionId === sessionId) {
      setPlayingSessionId(null);
    } else {
      setPlayingSessionId(sessionId);
    }
  };

  // Safe parameters extraction based on patient
  const details = useMemo(() => {
    return patientExtendedInfo[id || ''] || patientExtendedInfo['p1'];
  }, [id]);

  const treatments = useMemo(() => {
    return patientTreatments[id || ''] || defaultTreatments;
  }, [id]);

  const appointments = useMemo(() => {
    return patientAppointments[id || ''] || defaultAppointments;
  }, [id]);

  const rawWeeklySummary = useMemo(() => {
    return patientWeeklySummaries[id || ''] || defaultWeeklySummary;
  }, [id]);

  const comfortFeedbacks = useMemo(() => {
    return patientDignityFeedbacks[id || ''] || defaultFeedbacks;
  }, [id]);

  // Voice Evolution Multi-line Chart Data (30 vs 60 days)
  const chartData = useMemo(() => {
    const base = [
      { date: '01 Mai', fatigue: 30, essoufflement: 20, rythme: 85, h穩定: 80 },
      { date: '04 Mai', fatigue: 32, essoufflement: 22, rythme: 80, h穩定: 78 },
      { date: '08 Mai', fatigue: 35, essoufflement: 25, rythme: 82, h穩定: 82 },
      { date: '12 Mai', fatigue: 45, essoufflement: 40, rythme: 75, h穩定: 65 },
      { date: '15 Mai', fatigue: 40, essoufflement: 35, rythme: 78, h穩定: 72 },
      { date: '18 Mai', fatigue: 52, essoufflement: 50, rythme: 68, h穩定: 55 },
      { date: '21 Mai', fatigue: id === 'p3' ? 78 : id === 'p2' ? 62 : 38, essoufflement: id === 'p2' ? 68 : 34, rythme: id === 'p8' ? 45 : 75, h穩定: id === 'p3' ? 42 : 75 },
    ];

    if (chartPeriod === 60) {
      // Prepend previous month
      return [
        { date: '10 Avr', fatigue: 25, essoufflement: 15, rythme: 85, h穩定: 85 },
        { date: '18 Avr', fatigue: 28, essoufflement: 18, rythme: 82, h穩定: 80 },
        { date: '25 Avr', fatigue: 30, essoufflement: 20, rythme: 85, h穩定: 82 },
        ...base
      ];
    }
    return base;
  }, [chartPeriod, id]);

  // Calendar Heatmap data generator (May 2026, today standard: 21 May)
  const calendarDays = useMemo(() => {
    const totalDays = 31;
    const days: { 
      day: number; 
      status: 'full' | 'partial' | 'missed' | 'future';
      details?: string;
    }[] = [];
    
    // Customize compliance calendar mapping based on active patient profile
    const activeTreatments = patientTreatments[id || ''] || defaultTreatments;
    const firstMed = activeTreatments[0]?.name || "Médicament";
    const secondMed = activeTreatments[1]?.name || "Traitement";
    
    for (let d = 1; d <= totalDays; d++) {
      if (d > 21) {
        // Future days (today is May 21, 2026)
        days.push({ day: d, status: 'future', details: "Sélection future (Prise à venir de vos prescriptions)" });
      } else {
        // Past / Present days
        let status: 'full' | 'partial' | 'missed' = 'full';
        let details = "Validation d'adhésion complète confirmée par la voix.";
        
        if (id === 'p1') {
          // Excellent: only a few partials, no missed
          if (d === 10 || d === 18) {
            status = 'partial';
            details = `Omission partielle : ${secondMed} non validé ce midi.`;
          }
        } else if (id === 'p2') {
          // Cardiac: missing some diuretic doses
          if (d === 5 || d === 20) {
            status = 'missed';
            details = `Alerte Rouge : ${firstMed} complètement oublié !`;
          } else if (d === 12 || d === 19) {
            status = 'partial';
            details = `Prise tardive concernant ${secondMed} signalée par l'IA.`;
          }
        } else if (id === 'p3') {
          // High isolation & apathic: several missed
          if (d === 4 || d === 12 || d === 15 || d === 20) {
            status = 'missed';
            details = `Non-observance critique : ${secondMed} et ${firstMed} manqués.`;
          } else if (d === 8 || d === 19) {
            status = 'partial';
            details = `Validation manquée pour ${secondMed} ce matin.`;
          }
        } else {
          // standard
          if (d % 6 === 0) {
            status = 'partial';
            details = `Oubli partiel sur la prise de ${firstMed}.`;
          } else if (d % 11 === 0) {
            status = 'missed';
            details = `Refus d'adhésion ou rejet sur l'ensemble des traitements médicaux.`;
          }
        }
        
        days.push({ day: d, status, details });
      }
    }
    return days;
  }, [id]);

  // Interactive timeline filter
  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // text search
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesSummary = session.summary.toLowerCase().includes(query);
        const matchesTranscript = session.transcript?.toLowerCase().includes(query) || false;
        if (!matchesSummary && !matchesTranscript) return false;
      }
      
      // timeline range (all / 7days / 30days)
      if (periodFilter !== 'all') {
        const sessionDate = new Date(session.date).getTime();
        const currentDate = new Date("2026-05-21T21:05:11Z").getTime();
        const diffDays = (currentDate - sessionDate) / (1000 * 60 * 60 * 24);
        
        if (periodFilter === '7days' && diffDays > 7) return false;
        if (periodFilter === '30days' && diffDays > 30) return false;
      }
      
      return true;
    });
  }, [sessions, searchQuery, periodFilter]);

  // Add notes in doctor text box
  const handleAddNewNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;

    const newNote = {
      id: 'note_user_' + Date.now(),
      date: new Date().toISOString(),
      text: newNoteText,
      author: "Dr. Slim Jamil (Vous)"
    };

    const newNotesHistory = [newNote, ...notesHistory];
    setNotesHistory(newNotesHistory);
    setNewNoteText('');
    
    if (tenantId && id) {
      try {
        await updateDoc(doc(db, 'tenants', tenantId, 'patients', id), {
          notes: JSON.stringify(newNotesHistory),
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Erreur lors de la sauvegarde de la note", err);
      }
    }

    showNotification("Remarque médicale ajoutée avec succès !");
  };

  const handleClearNote = async (noteId: string) => {
    if (window.confirm("Êtes-vous sûr de vouloir supprimer cette note ?")) {
      const newNotesHistory = notesHistory.filter(n => n.id !== noteId);
      setNotesHistory(newNotesHistory);
      
      if (tenantId && id) {
        try {
          await updateDoc(doc(db, 'tenants', tenantId, 'patients', id), {
             notes: JSON.stringify(newNotesHistory),
             updatedAt: serverTimestamp()
          });
        } catch (err) {
          console.error("Erreur lors de la suppression de la note", err);
        }
      }

      showNotification("Note médicale supprimée.");
    }
  };

  // Vocal Message sending step animator and Firestore dispatcher
  const triggerSendVocalMessage = () => {
    setVocalStatus('generating');
    setVocalStepText("Traduction en dialecte tunisien (Derja) et conversion acoustique...");
    
    const contentToSend = vocalCategory === 'custom' 
      ? customVocalText 
      : predefinedVocalTemplates[vocalCategory] || "";

    if (tenantId && patient?.id && contentToSend.trim()) {
      const newMsgRef = doc(collection(db, 'tenants', tenantId, 'patients', patient.id, 'messages'));
      setDoc(newMsgRef, {
        patientId: patient.id,
        type: 'text',
        content: contentToSend,
        audioUrl: '',
        sender: 'doctor',
        createdAt: serverTimestamp()
      }).catch(err => console.error("Error writing message to firestore in background:", err));
    }

    setTimeout(() => {
      setVocalStatus('sending');
      setVocalStepText("Hanen IA : Transmission du signal vocal encrypté au senior...");
      
      setTimeout(() => {
        setVocalStatus('success');
        setVocalStepText("Le message vocal a été déposé avec succès sur l'application compagnon de l'aîné !");
        
        setTimeout(() => {
          setIsVocalModalOpen(false);
          setVocalStatus('idle');
          setCustomVocalText('');
          showNotification(`Message vocal "${vocalCategory.toUpperCase()}" envoyé via Hanen.`);
        }, 2000);
      }, 1500);
    }, 1500);
  };

  // Predefined prompt helper texts
  const predefinedVocalTemplates = {
    dwe: "« Ya l-gali, matensech dwe el sbe7 ta3ek, Hanen m3ak bch dima sa7tek labes. Rabi ye7fdek. » (Cher aîné, n'oublie pas ton médicament de ce matin, Hanen est avec toi pour veiller sur ta santé. Que Dieu te préserve.)",
    wanesny: "« Mar7ba bik, Hanen dima hna bch tesm3ek w tdardach m3ak, rani msdouda b-klemek el mezyen. » (Bienvenue à toi, Hanen est toujours là pour t'écouter et bavarder, ta belle voix me fait un grand plaisir.)",
    nafas: "« Kbili dabba dabba, netnafsou belbda m3a ba3dhna. Khodh hwa sghir, wrja3 l-ra7tek... » (Doucement, doucement, respirons amplement ensemble. Prends une légère inspiration, puis expire paisiblement...)",
    custom: ""
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-slate-800 animate-spin" />
        <span className="font-extrabold text-sm tracking-wide">Veuillez patienter pendant la recomposition du dossier clinique...</span>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center text-slate-550 border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
        <User size={48} className="mx-auto text-slate-300" />
        <h3 className="text-lg font-extrabold text-slate-800">Dossier Clinique Introuvable</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto">Le patient demandé n'a pas pu être extrait des collections physiques ou de secours.</p>
        <Link to="/patients" className="inline-block mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-500">&larr; Retourner aux patients</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20 animate-in fade-in duration-500 px-4 md:px-0">
      
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-slate-50 border border-slate-800 p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4">
          <CheckCircle size={18} className="text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* FIXED HEADER WITH METRICS & PATHOLOGIES */}
      <div className="bg-white rounded-3xl border border-slate-200/50 p-6 md:p-8 shadow-xs relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full translate-x-10 -translate-y-10 shrink-0 pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          
          {/* Patient identity & clinical badges */}
          <div className="flex items-start gap-5">
            <Link to="/patients" className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-500 self-center transition-colors">
              <ArrowLeft size={16} />
            </Link>
            
            {/* Circular picture fallback initialized */}
            <div className="w-18 h-18 md:w-20 md:h-20 rounded-2xl bg-slate-150 border border-slate-250 flex items-center justify-center text-3xl font-extrabold text-slate-700 shrink-0 shadow-inner">
              {patient.name.charAt(0)}
            </div>

            <div className="space-y-1.5 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">{patient.name}</h1>
                <span className="text-xs font-extrabold px-3 py-1 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg">
                  {patient.age} ans • {patient.gender === 'M' ? 'Homme' : 'Femme'}
                </span>
                
                {/* Global Status badge */}
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border flex items-center gap-1.5",
                  patient.voiceHealthStatus === 'Stable' 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                    : patient.voiceHealthStatus === 'Attention' 
                    ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse" 
                    : "bg-rose-50 text-rose-700 border-rose-200 animate-pulse"
                )}>
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    patient.voiceHealthStatus === 'Stable' ? 'bg-emerald-600' : patient.voiceHealthStatus === 'Attention' ? 'bg-amber-600' : 'bg-rose-600'
                  )} />
                  {patient.voiceHealthStatus === 'Stable' ? 'VOIX STABLE | RAS' : patient.voiceHealthStatus === 'Attention' ? 'VIGILANCE CONSEILLÉE 🟠' : 'ATTENTION REQUISE 🔴'}
                </span>
              </div>

              {/* Badges of pathologies */}
              <div className="flex flex-wrap items-center gap-2">
                {patient.conditions?.map((cond) => (
                  <span key={cond} className="px-2.5 py-1 bg-indigo-50 border border-indigo-300 text-indigo-950 rounded-lg text-[10px] font-bold tracking-wide uppercase shadow-2xs">
                    {cond}
                  </span>
                ))}
                
                <span className="text-[11px] font-semibold text-slate-500 inline-flex items-center gap-1 ml-1">
                  <Clock size={12} /> Dernier échange Hanen : <b className="text-slate-600">{formatSafeDate(patient.lastCallDate, 'datetime')}</b>
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap lg:flex-nowrap">
            <button
               onClick={() => setIsExportModalOpen(true)}
              className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-950 font-bold text-[11px] rounded-xl border border-indigo-250 shadow-xs tracking-wider uppercase transition-all"
            >
              <FileText size={14} className="text-indigo-600" />
              Exporter Dossier (ZIP AES-250)
            </button>
            <button
               onClick={() => setIsDecryptModalOpen(true)}
              className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-[11px] rounded-xl border border-slate-200 shadow-xs tracking-wider uppercase transition-all"
            >
              <ShieldCheck size={14} className="text-emerald-600" />
              Outil Déchiffrement Dossier
            </button>
            <button
               onClick={() => setIsVocalModalOpen(true)}
              className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-4 py-3 bg-rose-500 hover:bg-rose-600 text-white text-[11px] font-bold rounded-xl border border-rose-600/20 shadow-md tracking-wider uppercase hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 animate-pulse"
            >
              <Mic size={14} strokeWidth={2.5} />
              Envoyer message Hanen
            </button>
          </div>

        </div>

      </div>

      {/* MULTI-TAB NAVIGATION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Navigation panel */}
        <div className="lg:col-span-12">
          {/* Mobile Select Selector */}
          <div className="block md:hidden w-full mb-1">
            <label htmlFor="mobile-tab-selector" className="sr-only">Sélectionner un onglet clinique</label>
            <div className="relative">
              <select
                id="mobile-tab-selector"
                value={activeTab}
                onChange={(e) => {
                  setActiveTab(e.target.value as any);
                  setPlayingSessionId(null);
                }}
                className="w-full bg-slate-905 bg-slate-900 text-white font-bold text-xs py-3.5 pl-4 pr-10 rounded-2xl appearance-none border border-slate-850 focus:outline-none"
              >
                <option value="overview">Aperçu Général</option>
                <option value="voice">Analyse Vocale & Historique</option>
                <option value="adherence">Observance Médicamenteuse</option>
                <option value="dignity">Dignité & Confort</option>
                <option value="notes">Notes Médicales</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-white">
                <ChevronDown size={14} />
              </div>
            </div>
          </div>

          {/* Desktop Tab Buttons Panel */}
          <div className="hidden md:flex overflow-x-auto whitespace-nowrap bg-slate-100 p-1 rounded-2xl border border-slate-200/50 max-w-full">
            {[
              { id: 'overview', label: "Aperçu Général", icon: User },
              { id: 'voice', label: "Analyse Vocale", icon: Mic },
              { id: 'adherence', label: "Observance", icon: Calendar },
              { id: 'dignity', label: "Dignité", icon: HeartHandshake },
              { id: 'notes', label: "Notes Médicales", icon: FileText }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setPlayingSessionId(null);
                }}
                className={cn(
                  "flex-1 md:flex-none px-6 py-3 text-xs font-bold transition-all rounded-xl focus:outline-none flex items-center justify-center gap-2",
                  activeTab === tab.id
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
                )}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* MAIN DETAILED VIEW AREA */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/60 p-6 md:p-8 shadow-xs min-h-[580px]">
          
          {/* TAB 1: APERÇU GÉNÉRAL */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Header and IA Summary */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
                    <Sparkles size={18} className="text-indigo-500" />
                    Bilan hebdomadaire Hanen
                  </h3>
                </div>
                <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/50 rounded-full blur-2xl -translate-y-8 translate-x-8" />
                  <p className="text-sm text-slate-700 leading-relaxed font-medium relative z-10">
                    {rawWeeklySummary}
                  </p>
                </div>
              </div>

              {/* Basic Medical stats (Weight, BP, HR, etc.) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100">
                <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Tension Artérielle</span>
                  <span className="text-sm font-bold text-slate-800 mt-1 block">{details.bloodPressure}</span>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Fréquence Cardiaque</span>
                  <span className="text-sm font-bold text-slate-800 mt-1 block">{details.heartRate}</span>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Poids Constaté</span>
                  <span className="text-sm font-bold text-slate-800 mt-1 block">{details.weight}</span>
                </div>
                <div className="p-3.5 bg-slate-50 border border-slate-150 rounded-xl">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Groupe Sanguin</span>
                  <span className="text-sm font-bold text-slate-800 mt-1 block">{details.bloodType}</span>
                </div>
              </div>

              {/* Extended Profile details info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="p-4 bg-slate-50/30 border border-slate-150 rounded-2xl space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Informations Clés de Contact</h4>
                  <p className="text-xs font-semibold text-slate-600">
                    Médecin Traitant : <br/><span className="text-slate-800 font-bold">{details.referringDoctor}</span>
                  </p>
                  <p className="text-xs font-semibold text-slate-600">
                    Contact d'urgence ({details.emergencyContact.relation}) : <br/><span className="text-slate-800 font-bold">{details.emergencyContact.name} ({details.emergencyContact.phone})</span>
                  </p>
                </div>

                <div className="p-4 bg-slate-50/30 border border-slate-150 rounded-2xl space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Préférences d'Interaction</h4>
                  <p className="text-xs font-semibold text-slate-600">
                    Langue parlée préférée : <br/><span className="text-indigo-700 font-extrabold">{details.preferredLanguage}</span>
                  </p>
                  <p className="text-xs font-semibold text-slate-600">
                    Allergies recensées : <br/>
                    <span className="text-rose-600 font-bold">
                      {details.allergies.join(', ') || "Aucune allergie connue"}
                    </span>
                  </p>
                </div>
              </div>

              {/* Highlight current treatments list */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <FileText size={15} className="text-indigo-500" />
                  Prescription Thérapeutique Actuelle ({treatments.length})
                </h3>
                <div className="space-y-2">
                  {treatments.map((med, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3.5 bg-slate-50 hover:bg-slate-100/50 rounded-xl border border-slate-200/60 transition-colors">
                      <div className="space-y-0.5">
                        <span className="text-xs font-extrabold text-slate-800">{med.name} — {med.dosage}</span>
                        <div className="text-[10px] text-slate-500 font-semibold">{med.frequency} • {med.timing}</div>
                        <p className="text-[10px] italic text-slate-500 mt-1">{med.doctorNotes}</p>
                      </div>
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-2 py-0.5">
                        {med.adherenceRate}% obs.
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next appointments list */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Calendar size={15} className="text-slate-500" />
                  Prochains Rendez-vous du Cabinet
                </h3>
                <div className="space-y-2">
                  {appointments.map((app, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl text-xs font-semibold">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center font-bold">
                          {app.date.split('-')[2]}
                        </div>
                        <div>
                          <p className="font-extrabold text-slate-800">{app.type}</p>
                          <p className="text-[10px] text-slate-500">{app.doctor} • {app.room}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold uppercase text-indigo-600 tracking-wider bg-indigo-50 px-2 py-1 rounded">
                        le {formatSafeDate(app.date, 'date')} à {app.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: ANALYSE VOCALE & HISTORIQUE */}
          {activeTab === 'voice' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              {/* Header section with toggle for chart range */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150 pb-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                    <TrendingUp size={18} className="text-indigo-500" />
                    Indicateurs Vocaux Cliniques (Phonant-IA)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">Bilan combiné des 4 anomalies chroniques basées sur les dialogues automatiques.</p>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-center border border-slate-200 w-fit">
                  <button
                    onClick={() => setChartPeriod(30)}
                    className={cn("px-3 py-1.5 text-[10px] font-bold tracking-wide rounded-lg transition-all", chartPeriod === 30 ? "bg-white text-slate-900 shadow-xs" : "text-slate-550 hover:text-slate-800")}
                  >30 Jours</button>
                  <button
                    onClick={() => setChartPeriod(60)}
                    className={cn("px-3 py-1.5 text-[10px] font-bold tracking-wide rounded-lg transition-all", chartPeriod === 60 ? "bg-white text-slate-900 shadow-xs" : "text-slate-550 hover:text-slate-800")}
                  >60 Jours</button>
                </div>
              </div>

              {/* Informative Help Alert Box with glossary trigger tags on click */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/50">
                <span className="text-[10px] font-extrabold text-slate-500 block mb-2 uppercase tracking-wider flex items-center gap-1">
                  <Info size={12} className="text-indigo-500" /> Hover / Cliquez pour comprendre les indicateurs :
                </span>
                <div className="flex flex-wrap gap-2">
                  {["Fatigue Vocale", "Essoufflement", "Rythme de Parole", "Stabilité Émotionnelle"].map((term) => (
                    <div key={term} className="relative">
                      <button
                        onMouseEnter={() => setHoveredTerm(term)}
                        onMouseLeave={() => setHoveredTerm(null)}
                        className="text-[10px] font-bold bg-white hover:bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-800 transition-all flex items-center gap-1.5"
                      >
                        <span className={cn("w-1.5 h-1.5 rounded-full", term === "Fatigue Vocale" ? "bg-indigo-500" : term === "Essoufflement" ? "bg-amber-500" : term === "Rythme de Parole" ? "bg-rose-500" : "bg-emerald-500")} />
                        {term}
                      </button>

                      {hoveredTerm === term && (
                        <div className="absolute top-8 left-0 z-30 w-64 bg-slate-900 text-slate-100 p-3 rounded-lg shadow-xl text-[10px] leading-relaxed border border-slate-800 animate-in fade-in zoom-in-95">
                          <b className="font-extrabold text-indigo-400 block mb-1">{term} :</b>
                          {indicatorGlossary[term]}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* THE MULTI-LINE CHART */}
              <div className="h-64 w-full bg-slate-50/20 p-2.5 rounded-2xl border border-slate-100 shadow-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 15, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748B'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#64748B'}} domain={[0, 100]} />
                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', fontSize: '11px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{fontSize: '10px', paddingTop: '10px'}} />
                    <Line type="monotone" name="Fatigue Vocale" dataKey="fatigue" stroke="#818CF8" strokeWidth={3} dot={{r:3}} />
                    <Line type="monotone" name="Essoufflement" dataKey="essoufflement" stroke="#FB923C" strokeWidth={3} dot={{r:3}} />
                    <Line type="monotone" name="Rythme de Parole" dataKey="rythme" stroke="#F43F5E" strokeWidth={3} dot={{r:3}} />
                    <Line type="monotone" name="Stabilité Émot." dataKey="h穩定" stroke="#10B981" strokeWidth={3} dot={{r:3}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* FILTER FOR CALLS */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Historique Vocal Interactif ({filteredSessions.length})</h4>
                
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Filtrer par mot-clé..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="px-3.5 py-1.5 bg-slate-50 border border-slate-250 rounded-lg text-[10px] font-bold text-slate-655 focus:outline-none focus:bg-white placeholder-slate-400 focus:border-indigo-400 transition-colors w-40"
                    />
                  </div>

                  <select
                    value={periodFilter}
                    onChange={(e: any) => setPeriodFilter(e.target.value)}
                    className="px-3.5 py-1.5 bg-slate-50 border border-slate-250 rounded-lg text-[10px] font-bold text-slate-600 focus:outline-none bg-white font-bold"
                  >
                    <option value="all">Tous les appels</option>
                    <option value="7days">Derniers 7 jours</option>
                    <option value="30days">Derniers 30 jours</option>
                  </select>
                </div>
              </div>

              {/* TIMELINE LIST OF CALLS */}
              <div className="space-y-4">
                {filteredSessions.length === 0 ? (
                  <div className="text-center py-10 text-slate-450 text-xs border border-dashed border-slate-200 rounded-2xl">
                    Aucun appel correspondant à vos critères de filtres.
                  </div>
                ) : (
                  filteredSessions.map((session) => {
                    const isPlaying = playingSessionId === session.id;

                    return (
                      <div key={session.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-200 hover:shadow-md transition-all duration-200">
                        {/* Session Top header */}
                        <div className="bg-slate-50/50 p-4 rounded-t-2xl border-b border-slate-150 flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="text-indigo-500" />
                            <span className="font-extrabold text-slate-800">
                              {formatSafeDate(session.date, 'datetime')}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-200/60 rounded text-[10px] font-bold text-slate-500">
                              Appel de {session.duration}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {session.sentiment && (
                              <span className={cn(
                                "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                session.sentiment === 'Positive' ? 'bg-emerald-50 text-emerald-800 border-emerald-150' : session.sentiment === 'Negative' ? 'bg-rose-50 text-rose-800 border-rose-150' : 'bg-slate-100 text-slate-600 border-slate-200'
                              )}>
                                Humeur : {session.sentiment === 'Positive' ? 'Positive' : session.sentiment === 'Negative' ? 'Négative' : 'Neutre'}
                              </span>
                            )}

                            {session.fatigueLevel !== undefined && (
                              <span className={cn(
                                "text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full border",
                                session.fatigueLevel > 6 ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-indigo-50 text-indigo-700 border-indigo-150"
                              )}>
                                Fatigue : {session.fatigueLevel}/10
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Speech content & waveform */}
                        <div className="p-4 space-y-4">
                          {/* Summary sentence */}
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block mb-1">Résumé conversationnel IA</span>
                            <p className="text-xs text-slate-600 leading-relaxed font-semibold">{session.summary}</p>
                          </div>

                          {/* Playable acoustic waveform widget */}
                          <div className="bg-slate-900 text-white p-3.5 rounded-xl space-y-2.5">
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => handleAudioPlayToggle(session.id)}
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-transform hover:scale-105 active:scale-95",
                                  isPlaying ? "bg-rose-500 text-white animate-pulse" : "bg-white text-slate-900"
                                )}
                              >
                                {isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} className="ml-0.5" fill="currentColor" />}
                              </button>
                              
                              <div className="flex-1 space-y-1">
                                <div className="flex items-end justify-between h-5 gap-0.5">
                                  {[...Array(24)].map((_, wIdx) => {
                                    const isActive = isPlaying && playProgress > (wIdx / 24) * 100;
                                    return (
                                      <div 
                                        key={wIdx} 
                                        className={cn(
                                          "w-[3px] rounded-full transition-all duration-300",
                                          isActive ? "bg-gradient-to-t from-rose-400 to-indigo-400 h-full" : "bg-slate-700 h-1/2"
                                        )}
                                        style={{ 
                                          height: isPlaying 
                                            ? `${Math.max(20, Math.floor(Math.abs(Math.sin((playProgress / 5) + wIdx)) * 100))}%` 
                                            : `${(wIdx % 3 === 0) ? 60 : (wIdx % 2 === 0) ? 40 : 20}%`
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              </div>

                              <span className="text-[9px] font-mono text-slate-500 shrink-0 select-none">
                                {isPlaying ? `${Math.round(playProgress * 0.45)}s` : "00:00"} / 04:12
                              </span>
                            </div>
                            
                            {/* Dialect translation focus line when selected */}
                            {session.transcript && (
                              <div className="pt-2 border-t border-slate-800 text-[11px] leading-relaxed text-slate-300 font-medium">
                                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1.5">Transcription extrait</span>
                                <div className="space-y-1.5 pl-2 border-l border-indigo-500/50">
                                  {session.transcript.split('\n').slice(0, 3).map((line, lIdx) => (
                                    <p key={lIdx} className="italic text-slate-200">
                                      {line}
                                    </p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          
                        </div>

                      </div>
                    );
                  })
                )}
              </div>

            </div>
          )}

          {/* TAB 3: OBSERVANCE MÉDICAMENTEUSE */}
          {activeTab === 'adherence' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                    <Calendar className="text-indigo-500" size={18} />
                    Calendrier Clinique d'Observance (Mai 2026)
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">Suivi quotidien des notifications reçues et de la validation vocale par l'aîné.</p>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg">
                    Taux Global : <b className="text-indigo-600 font-bold">{patient.adherenceRate}%</b>
                  </span>
                </div>
              </div>

              {/* MONTHLY CALENDAR GRID HEATMAP FOR MAY 2026 */}
              <div className="bg-slate-50 border border-slate-150 p-5 rounded-2xl">
                
                {/* Legend indicator bar */}
                <div className="flex flex-wrap justify-between items-center gap-3 mb-5 border-b border-slate-200/50 pb-3">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">État quotidien de prise</span>
                  
                  <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-emerald-500 rounded-sm" /> Complète (100%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-amber-500 rounded-sm" /> Partielle (&gt;50%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-rose-500 rounded-sm" /> Manquée (0%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 border border-dashed border-slate-300 bg-white rounded-sm" /> À venir</span>
                  </div>
                </div>

                {/* Day Calendar Grid (May 2026 starts on Friday) */}
                <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-wider">
                  <div>Lun</div><div>Mar</div><div>Mer</div><div>Jeu</div><div>Ven</div><div>Sam</div><div>Dim</div>
                </div>
                
                <div className="grid grid-cols-7 gap-2">
                  {/* Empty slots for May 2026 Friday start (Friday: empty Mo Tu We Th) */}
                  {[...Array(4)].map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square rounded-lg bg-slate-100/30 border border-transparent" />
                  ))}

                  {/* Render May days */}
                  {calendarDays.map((dayData) => (
                    <div 
                      key={dayData.day}
                      className={cn(
                        "aspect-square rounded-xl border flex flex-col items-center justify-center p-1 relative group cursor-default transition-all duration-150",
                        dayData.status === 'full' 
                          ? "bg-emerald-500 border-emerald-500 text-white shadow-xs" 
                          : dayData.status === 'partial' 
                          ? "bg-amber-500 border-amber-500 text-white shadow-xs" 
                          : dayData.status === 'missed' 
                          ? "bg-rose-500 border-rose-500 text-white shadow-xs" 
                          : "bg-white border-slate-250 border-dashed text-slate-500 hover:border-slate-400"
                      )}
                    >
                      <span className="text-xs font-bold">{dayData.day}</span>
                      
                      {/* Micro visual symbol inside */}
                      {dayData.status === 'full' && <Check size={10} className="mt-0.5 opacity-90 stroke-[3]" />}
                      {dayData.status === 'partial' && <span className="w-1.5 h-1.5 bg-white rounded-full mt-1" />}
                      {dayData.status === 'missed' && <X size={10} className="mt-0.5 opacity-90 stroke-[3]" />}
                      {dayData.status === 'future' && <Clock size={10} className="mt-0.5 opacity-40 text-slate-450" />}

                      {/* Tooltip on hover day */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 hidden group-hover:flex flex-col bg-slate-950 text-white p-3 rounded-xl text-[10px] w-48 shadow-2xl z-30 pointer-events-none text-left border border-slate-800 animate-in fade-in duration-100">
                        <span className="font-extrabold text-indigo-400 capitalize mb-1">📅 Mai {dayData.day}</span>
                        <span className="font-semibold text-slate-300 leading-normal">{dayData.details}</span>
                        <div className="mt-1.5 flex items-center gap-1">
                          <span className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            dayData.status === 'full' ? "bg-emerald-400" :
                            dayData.status === 'partial' ? "bg-amber-400" :
                            dayData.status === 'missed' ? "bg-rose-500" : "bg-slate-500"
                          )} />
                          <span className="text-[8px] font-bold uppercase text-slate-500 tracking-wider">
                            {dayData.status === 'full' ? "Prises complètes" :
                             dayData.status === 'partial' ? "Incomplet / Partiel" :
                             dayData.status === 'missed' ? "Zéro observance" : "Futur"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

              </div>

              {/* STATS DETAILS BY MEDICATION */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Taux d'observance par médicament prescrit</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {treatments.map((med, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-3.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800 block truncate max-w-[150px]">{med.name}</span>
                        <span className="text-xs font-bold text-indigo-600 block">{med.adherenceRate}%</span>
                      </div>

                      {/* Bar indicator layout */}
                      <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            med.adherenceRate > 85 ? "bg-emerald-500" : med.adherenceRate > 70 ? "bg-amber-500" : "bg-rose-500"
                          )}
                          style={{ width: `${med.adherenceRate}%` }}
                        />
                      </div>

                      <div className="text-[10px] text-slate-500 font-bold flex justify-between">
                        <span>Posologie: {med.dosage}</span>
                        <span className="uppercase text-slate-500 font-bold">{med.frequency}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* LIST OF ADHERENCE ALERTS */}
              <div className="pt-4 border-t border-slate-150 space-y-3">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Alertes de non-observance actives</h4>
                
                {id === 'p3' || id === 'p2' ? (
                  <div className="p-4 bg-rose-50 border border-rose-150 rounded-2xl flex items-start gap-3 text-xs leading-relaxed font-semibold text-rose-800 animate-in slide-in-from-top-3">
                    <ShieldAlert size={16} className="text-rose-600 self-start mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <p className="font-extrabold">Oubli systématique diagnostiqué ce matin</p>
                      <p className="text-slate-600 text-[11px] font-medium leading-normal">
                        L'IA Hanen n'a reçu aucune confirmation d'adhésion lors du rappel automatisé de 09h00. Un message synthétique d'incitation a été déposé, sans validation de la part de l'aîné dans le délai réglementaire de 2h.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 text-center text-xs text-slate-500 bg-slate-50 border border-dashed border-slate-200 rounded-2xl flex items-center justify-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-500" />
                    <span>Aucun oubli ou anomalie d'observance active recensé chez Mme Fatima.</span>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* TAB 4: DIGNITÉ & CONFORT */}
          {activeTab === 'dignity' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                    <HeartHandshake className="text-indigo-500" size={18} />
                    Scores d'Indice de Dignité & Confort
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium font-bold">Rapports d'impact respectueux générés sur la solitude ressentie et l'image de soi.</p>
                </div>

                <div className="flex items-end gap-1 shrink-0 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-center">
                  <span className="text-2xl font-extrabold text-slate-800">{patient.dignityIndex}</span>
                  <span className="text-xs text-slate-500 font-bold mb-1">/100</span>
                </div>
              </div>

              {/* Indicators bar display */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50/50 border border-slate-150 rounded-2xl space-y-2">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-widest block">Sentiment d'autonomie</span>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-800">{id === 'p1' ? '92' : id === 'p2' ? '74' : '52'}/100</span>
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Rassuré</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: id === 'p1' ? '92%' : id === 'p2' ? '74%' : '52%' }} />
                  </div>
                </div>

                <div className="p-4 bg-slate-50/50 border border-slate-150 rounded-2xl space-y-2">
                  <span className="text-[10px] font-bold uppercase text-slate-500 tracking-widest block">Énergie & Bien-être ressenti</span>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-slate-800">{id === 'p1' ? '88' : id === 'p2' ? '70' : '45'}/100</span>
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Stable</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full rounded-full" style={{ width: id === 'p1' ? '88%' : id === 'p2' ? '70%' : '45%' }} />
                  </div>
                </div>
              </div>

              {/* EXPLICATIVE DE DIGNITE PAR L'IA */}
              <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200/60 font-medium">
                Notre algorithme d'analyse qualitative évalue de manière anonymisée la sémantique de l'aîné ainsi que l'amplitude vocale pour calculer cet indicateur. L'objectif est de vérifier que le senior conserve un sentiment de liberté de contrôle et d'estime de soi dans son dialogue thérapeutique quotidien.
              </p>

              {/* LIST OF SENIORS' DIRECT VERBATIMS & DIALECT TRANSLATIONS */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Remarques & Verbatims collectés (Traduit du dialecte)</h4>
                
                <div className="space-y-3">
                  {comfortFeedbacks.map((f, i) => (
                    <div key={i} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3">
                      <div className="flex justify-between items-start gap-4 flex-wrap">
                        <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wider bg-slate-50 px-2 py-1 rounded">
                          Catégorie : {f.category}
                        </span>
                        
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-500 font-bold">{f.date}</span>
                          <span className="w-1.5 h-1.5 bg-slate-200 rounded-full mx-1.5" />
                          <span className="text-xs font-bold text-indigo-600">Note Dignité : {f.dignityScore}/100</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <p className="text-xs font-bold leading-relaxed text-slate-900 border-l-2 border-slate-900 pl-3 italic">
                          {f.verbatimDerja}
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500 pl-3 leading-normal">
                          Traduction : {f.frenchTranslation}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: NOTES MÉDICALES */}
          {activeTab === 'notes' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  <FileText className="text-indigo-500" size={18} />
                  Journal de Suivi Clinique (Dr. Slim)
                </h3>
                <p className="text-[11px] text-slate-500 font-semibold font-medium">Consignez vos conclusions cliniques, les retours familiaux et les consignes de correction d'observance.</p>
              </div>

              {/* NEW NOTE INPUT FORM */}
              <form onSubmit={handleAddNewNote} className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider block mb-1">
                  Créer une nouvelle annotation datée
                </label>
                <textarea
                  placeholder="Saisissez des conclusions cliniques de consultation ou des échanges de coordination familiale (ex: 'Fille consultée ce jour, diurétique décalé au matin...')"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full text-xs font-semibold p-4 rounded-xl border border-slate-250 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white placeholder-slate-400 bg-white"
                  rows={3}
                />
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white xs font-bold rounded-xl text-xs transition-colors shadow-sm"
                  >
                    <Save size={14} />
                    Sauvegarder l'annotation
                  </button>
                </div>
              </form>

              {/* CLINICAL HISTORY LIST OF NOTES */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">Historique des annotations médicales ({notesHistory.length})</h4>
                
                <div className="space-y-3">
                  {notesHistory.map((note) => (
                    <div key={note.id} className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 hover:border-slate-300 relative group transition-all">
                      
                      {/* Delete annotation trigger */}
                      <button
                        onClick={() => handleClearNote(note.id)}
                        className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-rose-500 rounded-lg bg-slate-50 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-all"
                        title="Supprimer cette note"
                      >
                        <Trash2 size={13} />
                      </button>

                      <div className="flex items-center gap-2 text-slate-500 text-[10px] font-bold">
                        <Clock size={12} />
                        <span>Créé le {formatSafeDate(note.date, 'datetime')}</span>
                        <span className="w-1.5 h-1.5 bg-slate-200 rounded-full mx-1.5" />
                        <span className="font-extrabold text-slate-600 block">{note.author}</span>
                      </div>

                      <p className="text-xs font-semibold text-slate-700 leading-relaxed pr-6">
                        {note.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* RIGHT COLUMN: RECAP CARD PROFILE METRICS / OUTLINE */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Diagnostic Stats Snapshot */}
          <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 border border-slate-850 shadow-md">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-1.5">
              <Activity size={14} className="text-indigo-400" />
              État Clinique Vocal
            </h4>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center text-xs font-bold mb-1">
                  <span className="text-slate-300">Stress Moyen</span>
                  <span className="text-white">{id === 'p3' ? '7' : id === 'p2' ? '5' : '3'}/10</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="bg-indigo-400 h-full rounded-full" style={{ width: id === 'p3' ? '70%' : id === 'p2' ? '50%' : '30%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-bold mb-1">
                  <span className="text-slate-300">Fatigue moyenne</span>
                  <span className="text-white">{id === 'p3' ? '8' : id === 'p2' ? '6' : '2'}/10</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="bg-orange-400 h-full rounded-full" style={{ width: id === 'p3' ? '80%' : id === 'p2' ? '60%' : '20%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center text-xs font-bold mb-1">
                  <span className="text-slate-300">Humeur Surchargée</span>
                  <span className="text-white">{id === 'p3' ? 'Sévère' : id === 'p2' ? 'Modérée' : 'Sereine'}</span>
                </div>
                <p className="text-[10px] italic text-slate-500 leading-normal mt-1">Évaluation cumulée par Hanen après analyses de phonation hebdomadaires.</p>
              </div>
            </div>
          </div>

          {/* Quick Action links to companion diagnostic tools */}
          <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-xs space-y-4">
            <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Liens Pratiques d'Action</h4>
            
            <div className="space-y-2">
              <Link 
                to="/alerts" 
                className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all group text-xs font-bold"
              >
                <span className="flex items-center gap-2">
                  <AlertTriangle size={15} className="text-rose-500" />
                  Consulter les alertes correspondantes
                </span>
                <ChevronRight size={14} className="text-slate-500 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>

        </div>

      </div>

      {/* COMPACT INTERACTIVE VOICE MESSAGE SENDER MODAL */}
      {isVocalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 md:p-8 space-y-6 border border-slate-200 animate-in zoom-in-95">
            
            {/* Header modal */}
            <div className="flex justify-between items-start gap-3">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 border border-indigo-100 rounded px-2.5 py-1">
                  COMPAGNON HANEN PRO
                </span>
                <h3 className="text-lg font-extrabold text-slate-900 mt-2">Envoyer un message à {patient.name}</h3>
              </div>
              <button 
                onClick={() => setIsVocalModalOpen(false)}
                className="p-1.5 text-slate-500 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Selecting Type of Voice prompt */}
            {vocalStatus === 'idle' ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Objet de l'envoi</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'dwe', label: "💊 Rappel Dwe" },
                      { id: 'wanesny', label: "💬 Soutien moral" },
                      { id: 'nafas', label: "🫁 Respiration" },
                      { id: 'custom', label: "✏️ Personnalisé" }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setVocalCategory(opt.id as any)}
                        className={cn(
                          "p-3 rounded-xl text-xs font-bold tracking-wide border transition-all text-center flex flex-col items-center justify-center gap-1",
                          vocalCategory === opt.id 
                            ? "bg-slate-900 border-slate-900 text-white" 
                            : "bg-slate-50 border-slate-200 text-slate-655 hover:bg-slate-100"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text preview of Synth */}
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block">Message synthétisé</label>
                  
                  {vocalCategory === 'custom' ? (
                    <textarea
                      placeholder="Saisissez votre consigne vocale personnalisée en dialecte ou en français..."
                      value={customVocalText}
                      onChange={(e) => setCustomVocalText(e.target.value)}
                      className="w-full text-xs font-bold p-3.5 rounded-xl border border-slate-250 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400 bg-slate-50 focus:bg-white text-slate-700 font-semibold leading-relaxed"
                      rows={3}
                    />
                  ) : (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                      <p className="text-xs font-bold leading-relaxed text-slate-700 italic border-l-2 border-slate-900 pl-3">
                        {predefinedVocalTemplates[vocalCategory]}
                      </p>
                    </div>
                  )}
                </div>

                {/* Actions bottom */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsVocalModalOpen(false)}
                    className="flex-1 py-3 text-xs font-extrabold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    Annuler
                  </button>

                  <button
                    onClick={triggerSendVocalMessage}
                    className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl tracking-wide shadow-md transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Send size={13} />
                    Générer et envoyer
                  </button>
                </div>

              </div>
            ) : (
              // Status steps loading screen
              <div className="py-8 text-center space-y-5">
                
                <div className="relative w-16 h-16 mx-auto">
                  {vocalStatus !== 'success' ? (
                    <div className="absolute inset-0 rounded-full border-4 border-slate-100 border-t-rose-500 animate-spin" />
                  ) : (
                    <div className="absolute inset-0 rounded-full bg-emerald-50 border border-emerald-300 flex items-center justify-center text-emerald-500 shadow-inner">
                      <CheckCircle size={32} />
                    </div>
                  )}
                </div>

                {vocalStatus !== 'success' && (
                  <div className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl max-w-sm mx-auto space-y-3">
                    <span className="text-[9px] font-bold uppercase text-indigo-600 bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded tracking-wider">
                      Traitement acoustique temps réel
                    </span>
                    <div className="flex items-center justify-center gap-1 min-h-[46px]">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map((bar) => (
                        <div
                          key={bar}
                          style={{
                            animation: `bounceWave 0.7s ease-in-out infinite alternate`,
                            animationDelay: `${bar * 50}ms`
                          }}
                          className="w-1.5 bg-gradient-to-t from-indigo-500 via-purple-500 to-rose-400 rounded-full min-h-[4px]"
                        />
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-1 max-w-xs mx-auto">
                  <p className="text-xs font-bold text-slate-800 uppercase tracking-widest">{vocalStatus === 'success' ? "Message Transmis" : "Opération en cours"}</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">{vocalStepText}</p>
                </div>

              </div>
            )}

          </div>
        </div>
      )}

      {/* MODAL: HIGH-SECURITY AES-256 ENCRYPTED EXTRACTION / COMPRESSION */}
      {isExportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-3xl p-6 md:p-8 space-y-5 border border-slate-100 animate-in zoom-in-95">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-600">
                  <ShieldAlert size={22} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Exportation Chiffrée Haute Sécurité</h3>
                  <p className="text-[11px] text-slate-500 font-semibold">Chiffrement symétrique AES-256 client-side (RGPD / Secret Médical)</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsExportModalOpen(false);
                  setExportPassword('');
                  setExportError(null);
                }}
                className="p-1 text-slate-500 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 space-y-2.5">
              <h4 className="text-[10px] uppercase font-bold tracking-wider text-slate-600">Fichiers inclus dans l'archive sécurisée :</h4>
              <ul className="text-xs font-semibold text-slate-700 space-y-1.5 pl-1">
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-500 shrink-0" />
                  <span><b>01_identite_clinique.json</b> — Fiche signalétique patient détaillée</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-500 shrink-0" />
                  <span><b>02_fiche_suivi_clinique.md</b> — Historique d'observation médicale et alertes</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-500 shrink-0" />
                  <span><b>audio_sessions/audio_session_n_*.mp3</b> — Bandes d'appels synthétisées</span>
                </li>
              </ul>
            </div>

            <div className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 block">DÉFINIR UN MOT DE PASSE DE SÉCURITÉ</label>
                <p className="text-[11px] text-slate-500 pb-1 leading-normal font-medium">Ce mot de passe restera confidentiel et n'est stocké nulle part. Conservez-le pour déchiffrer votre archive ultérieurement.</p>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Saisissez un mot de passe fort..."
                    value={exportPassword}
                    disabled={isGeneratingZip}
                    onChange={(e) => setExportPassword(e.target.value)}
                    className="w-full text-xs font-bold p-3.5 rounded-xl border border-slate-250 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-400 bg-slate-50 focus:bg-white text-slate-800 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-650"
                  >
                    {showPassword ? "Masquer" : "Afficher"}
                  </button>
                </div>
              </div>

              {exportError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold leading-normal">
                  ⚠️ {exportError}
                </div>
              )}

              {zipEncryptionStatus && (
                <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="w-4 h-4 rounded-full border-2 border-indigo-650 border-t-transparent animate-spin shrink-0" />
                  <p className="text-xs font-extrabold text-indigo-900">{zipEncryptionStatus}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={isGeneratingZip}
                onClick={() => {
                  setIsExportModalOpen(false);
                  setExportPassword('');
                  setExportError(null);
                }}
                className="flex-1 py-3 text-xs font-bold bg-slate-100 border border-slate-250 hover:bg-slate-200 rounded-xl text-slate-600 transition-all font-sans"
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={isGeneratingZip}
                onClick={handleExportDossierSecure}
                className="flex-2 py-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                {isGeneratingZip ? 'Chiffrement AES-256...' : 'Compresser & Chiffrer Dossier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ARCHIVE DECRYPTOR UTILITY TOOL */}
      {isDecryptModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-3xl p-6 md:p-8 space-y-5 border border-slate-100 animate-in zoom-in-95">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
                  <ShieldCheck size={22} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-sans">Convertisseur-Décontracteur d'Archives</h3>
                  <p className="text-[11px] text-slate-500 font-semibold">Déverrouillage AES-256 RGPD et décompression locale de votre dossier</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setIsDecryptModalOpen(false);
                  setDecryptPassword('');
                  setDecryptError(null);
                  setEncryptedFile(null);
                }}
                className="p-1 text-slate-500 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500">1. Charger le pack chiffré (.zip.enc)</label>
                <div className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50 p-6 rounded-2xl transition-all text-center relative cursor-pointer">
                  <input
                    type="file"
                    accept=".enc"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setEncryptedFile(e.target.files[0]);
                        setDecryptError(null);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                    <FileText size={24} className="text-slate-500" />
                    {encryptedFile ? (
                      <span className="text-xs font-bold text-slate-800">{encryptedFile.name} ({(encryptedFile.size / 1024).toFixed(1)} KB)</span>
                    ) : (
                      <span className="text-xs font-semibold text-slate-500">Déposer ou cliquer pour importer le document `.zip.enc`</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-widest text-slate-500">2. Entrer le mot de passe de déverrouillage</label>
                <input
                  type="password"
                  placeholder="Tapez le code secret configuré lors de l'exportation..."
                  value={decryptPassword}
                  onChange={(e) => setDecryptPassword(e.target.value)}
                  className="w-full text-xs font-bold p-3.5 rounded-xl border border-slate-250 focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-400 bg-slate-50 focus:bg-white text-slate-800"
                />
              </div>

              {decryptError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold leading-normal">
                  ⚠️ {decryptError}
                </div>
              )}

              {decryptStatus && (
                <div className="flex items-center gap-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="w-4 h-4 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin shrink-0" />
                  <p className="text-xs font-extrabold text-emerald-900">{decryptStatus}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDecryptModalOpen(false);
                  setDecryptPassword('');
                  setDecryptError(null);
                  setEncryptedFile(null);
                }}
                className="flex-1 py-3 text-xs font-bold bg-slate-100 border border-slate-250 hover:bg-slate-200 rounded-xl text-slate-600 transition-all font-sans"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={handleDecryptFile}
                className="flex-2 py-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
              >
                Déchiffrer et Télécharger ZIP
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
