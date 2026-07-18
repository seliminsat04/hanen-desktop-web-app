import React, { useState, useMemo, useEffect } from 'react';
import { mockAlerts, mockPatients } from '../data';
import { 
  AlertTriangle, Clock, Activity, CheckCircle2, Mic, Play, Pause, Search, 
  Sparkles, Filter, Check, X, ShieldAlert, HeartHandshake, Volume2, Send, 
  CornerDownRight, CheckCircle, MessageSquare, AlertCircle, RefreshCw, FileText, Bell, Info, ShieldCheck, Download
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { VoiceAlert, Patient, VoiceSession } from '../types';
import { useAuth } from '../AuthContext';
import { db } from '../lib/firebase';
import { updateDoc, doc, serverTimestamp, writeBatch, collection, getDocs } from 'firebase/firestore';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { generatePatientZip, encryptPayload } from '../utils/cryptoZipHelper';
import { saveAs } from 'file-saver';

// Custom rich clinic transcripts corresponding to the mock alerts
const transcriptDetails: Record<string, { 
  transcriptText: string; 
  audioDurationSec: number; 
  dialectText: string; 
  frenchTranslation: string;
  historyAlertsCount: number;
  detectionPeriod: string;
}> = {
  a1: {
    transcriptText: "Patiente en détresse émotionnelle importante.",
    audioDurationSec: 45,
    dialectText: "« Aïchta ya Hanen... rani faddit mel 9o3da wa7di fi dar... s3ib el we7ed yekber wa7do... t7ess demla fi sedri... [pleurs légers pendant 5 secondes]... m3ach n7eb nakhodh dweya lyoum... »",
    frenchTranslation: "« Ma chère Hanen... j'en ai marre de rester seule dans cette maison... c'est dur de vieillir seul... je sens un poids sur ma poitrine... je ne veux plus prendre mes médicaments aujourd'hui... »",
    historyAlertsCount: 3,
    detectionPeriod: "Détecté sur 5 jours (dernier appel : aujourd’hui à 08:05)"
  },
  a2: {
    transcriptText: "Tremblements intenses et blocages de l'élocution.",
    audioDurationSec: 62,
    dialectText: "« Hanen, rani... [tremblements saccadés]... sbe7 dweya dhabtich... rassi... n7es fi rassi idor... glag kbir... [silence de 6s]... yedi tr3ech barcha m3ach najem nched l-kas... »",
    frenchTranslation: "« Hanen, je suis... [tremblements]... je n'ai pas pu doser mon médicament ce matin... ma tête tourne... grande angoisse... mes mains tremblent beaucoup, je ne peux plus tenir le verre... »",
    historyAlertsCount: 2,
    detectionPeriod: "Détecté sur 2 jours (dernier appel : aujourd’hui à 16:12)"
  },
  a3: {
    transcriptText: "Essoufflement aigu continu d'effort.",
    audioDurationSec: 35,
    dialectText: "« Hanen... [dyspnée avec sifflement]... m3ach najem netnafes belbda... n7es fi sedri rzin glag... l-bera7 chrabt dweya, ama lyoum sa9aya tnafkhet barcha l-ma we7el... »",
    frenchTranslation: "« Hanen... [respiration haletante]... je n'arrive plus à bien respirer... ma poitrine est lourde et angoissée... hier j'ai pris mes médicaments, mais aujourd'hui mes jambes ont fort gonflé, l'eau s'est accumulée... »",
    historyAlertsCount: 1,
    detectionPeriod: "Détecté sur 3 jours (dernier appel : aujourd’hui à 10:18)"
  },
  a4: {
    transcriptText: "Irritation bronchique et quintes régulières.",
    audioDurationSec: 28,
    dialectText: "« El bard eh lyoum... [quinte de toux sèche répétée]... k7a ta3betni barcha ya Hanen... ama rani sbe7 dweya chrabto m3a l-7lib kima 9otli... »",
    frenchTranslation: "« C'est froid aujourd'hui... [toux répétée]... la toux m'épuise beaucoup Hanen... mais ce matin j'ai bien pris mes médicaments avec du lait comme conseillé... »",
    historyAlertsCount: 0,
    detectionPeriod: "Détecté sur 1 jour (dernier appel : aujourd’hui à 11:22)"
  }
};

// Tooltip dictionary with technical terms mapped to precise patient outcomes
const glossaryTooltips: Record<string, string> = {
  "Voix faible et isolée": "Asthénie et baisse d'amplitude vocale : Signe caractéristique d'un repli affectif, de solitude ou d'une baisse d'énergie vitale chez le senior.",
  "Pleurs détectés": "Labilité ou détresse émotionnelle soudaine signalée par des sanglots étouffés, captés et analysés en phonation par Hanen.",
  "Absence prolongée de motivation": "Apathie ou aboulie : Risques précurseurs de dépression ou d'un laisser-aller thérapeutique aigu (rupture d'observance).",
  "Grande difficulté d'élocution": "Dysarthrie transitoire ou blocages phonatoires : Peut traduire un tremblement parkinsonien prononcé ou une fatigue neuromusculaire.",
  "Rythme lent": "Bradylalie clinique : Ralentissement du débit de parole, souvent lié à un état dépressif, confusionnel ou de sous-dosage neurologique.",
  "Fatigue vocale extrême": "Fatigue laryngée chronique acquise au cours de la parole longue, traduisant un épuisement physique global ou des difficultés respiratoires d'effort.",
  "Essoufflement léger pendant la conversation": "Dyspnée de parole : Signe précoce et critique de décompensation cardiopulmonaire ou d'insuffisance cardiaque (OAP débutant).",
  "Toux sèche occasionnelle": "Irritation bronchique pouvant être un effet indésirable classique de certains antihypertenseurs ou un début d'infection."
};

export function Alerts() {
  const { tenantId } = useAuth();
  const { data: alerts } = useFirestoreData<VoiceAlert>('alerts');
  const { data: patients } = useFirestoreData<Patient>('patients');

  // Track comments separately to avoid types disruption of VoiceAlert
  // They are now stored in `doctorComment` field of the alert directly in Firestore.
  // We keep a local state for the input field being typed before saving.
  const [localComments, setLocalComments] = useState<Record<string, string>>({});

  // Filters State
  const [statusFilter, setStatusFilter] = useState<'Active' | 'Resolved'>('Active');
  const [priorityFilter, setPriorityFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');
  const [periodFilter, setPeriodFilter] = useState<'Aujourdhui' | '7jours' | '30jours' | 'Tous'>('Tous');
  const [pathologyFilter, setPathologyFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications simulate banner
  const [activeNotification, setActiveNotification] = useState<string | null>(null);

  // Audio player state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [playProgress, setPlayProgress] = useState<number>(0);
  const playIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Modals state
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  
  const [capsuleId, setCapsuleId] = useState<string | null>(null);
  const [selectedCapsuleType, setSelectedCapsuleType] = useState<'dwe' | 'wanesny' | 'nafas' | 'custom'>('dwe');
  const [customCapsuleText, setCustomCapsuleText] = useState('');
  const [isSendingCapsule, setIsSendingCapsule] = useState(false);
  const [capsuleSuccessMsg, setCapsuleSuccessMsg] = useState(false);

  // PDF Export simulator modal
  const [exportAlert, setExportAlert] = useState<VoiceAlert | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [zipEncryptionStatus, setZipEncryptionStatus] = useState<string | null>(null);

  // Collapsed history blocks state
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Tooltip UI State
  const [hoveredTerm, setHoveredTerm] = useState<string | null>(null);

  // Audio wave player simulator ticker
  useEffect(() => {
    if (playingId) {
      setPlayProgress(0);
      const details = transcriptDetails[playingId] || transcriptDetails['a1'];
      const limit = details.audioDurationSec;
      
      playIntervalRef.current = setInterval(() => {
        setPlayProgress(prev => {
          if (prev >= 100) {
            clearInterval(playIntervalRef.current!);
            setPlayingId(null);
            return 0;
          }
          return prev + (100 / limit);
        });
      }, 1000);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    }

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [playingId]);

  const handlePlayToggle = (id: string) => {
    if (playingId === id) {
      setPlayingId(null);
    } else {
      setPlayingId(id);
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>, id: string) => {
    if (playingId !== id) {
      setPlayingId(id);
      setPlayProgress(0);
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const progressPercent = Math.min(Math.max((clickX / rect.width) * 100, 0), 100);
    setPlayProgress(progressPercent);
  };

  const updateDoctorComment = async (id: string, text: string) => {
    setLocalComments(prev => ({ ...prev, [id]: text }));
    if (tenantId) {
      try {
        await updateDoc(doc(db, 'tenants', tenantId, 'alerts', id), {
          doctorComment: text,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.error("Error updating doctor comment", err);
      }
    }
  };

  // Mark resolved
  const openResolveModal = (id: string) => {
    setResolvingId(id);
    const alert = alerts.find(a => a.id === id);
    setResolutionNote(localComments[id] || alert?.doctorComment || '');
  };

  const handleCloseResolveModal = () => {
    setResolvingId(null);
  };

  const submitResolve = async () => {
    if (!resolvingId || !tenantId) return;
    try {
      await updateDoc(doc(db, 'tenants', tenantId, 'alerts', resolvingId), {
        status: 'Resolved',
        resolvedAt: new Date().toISOString(),
        closureNote: resolutionNote || "Considéré résolu après examen clinique par le médecin.",
        updatedAt: serverTimestamp()
      });
      setResolvingId(null);
      showNotice("Alerte marquée comme résolue avec succès !");
    } catch (e) {
      console.error(e);
      showNotice("Erreur lors de la résolution.");
    }
  };

  // Re-open an alert
  const handleReopenAlert = async (id: string) => {
    if (!tenantId) return;
    try {
      await updateDoc(doc(db, 'tenants', tenantId, 'alerts', id), {
        status: 'Active',
        updatedAt: serverTimestamp()
      });
      showNotice("Alerte rentrée à nouveau dans la file active.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllAsResolved = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir marquer toutes les alertes de la sélection courante de filtres comme résolues ?")) {
      if (!tenantId) return;
      const filteredActiveIds = filteredAlerts.filter(a => a.status === 'Active').map(a => a.id);
      try {
        const batch = writeBatch(db);
        filteredActiveIds.forEach(id => {
          batch.update(doc(db, 'tenants', tenantId, 'alerts', id), {
            status: 'Resolved',
            resolvedAt: new Date().toISOString(),
            closureNote: "Résolution globale groupée par le Dr. Slim.",
            updatedAt: serverTimestamp()
          });
        });
        await batch.commit();
        showNotice("Toutes les alertes sélectionnées ont été marquées comme résolues.");
      } catch (err) {
        console.error(err);
      }
    }
  };

  const simulateRealtimeAlert = async () => {
    if (!tenantId) return;
    const id = 'a_new_' + Date.now();
    const newAlert: any = {
      patientId: 'p1', // Fatima Ben Ali
      priority: 'High',
      date: serverTimestamp(),
      detectedSigns: ['Essoufflement léger pendant la conversation', 'Voix faible et isolée'],
      duration: '4 min',
      aiSuggestion: 'Aggravation suspectée de la fatigue cardiaque. Surveillance du poids et de la toux recommandée ce jour.',
      status: 'Active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    // Supplement transcript info dynamically
    transcriptDetails[id] = {
      transcriptText: "Toux sèche d'irritation persistante.",
      audioDurationSec: 32,
      dialectText: "« Hanen ya benti... sedri wja3ni chwaya l-bera7, m3awenich en-nafas kima el 3ada... dweya chrabto ama t3ebt mel mcheb... »",
      frenchTranslation: "« Hanen ma fille... ma poitrine m'a fait un peu mal hier, je ne respire pas aussi bien que d'habitude... j'ai pris mes médicaments mais je me sens fatiguée... »",
      historyAlertsCount: 4,
      detectionPeriod: "Détecté instantanément de l'appel de 18:25"
    };

    try {
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'tenants', tenantId, 'alerts', id), newAlert);
      setActiveNotification("Nouvelle alerte vocale critique captée à l'instant pour Mme Fatima Ben Ali !");
      setTimeout(() => {
        setActiveNotification(null);
      }, 6000);
    } catch (e) {
      console.error(e);
    }
  };

  // Action Capsule dispatch
  const handleOpenCapsuleDialog = (id: string) => {
    setCapsuleId(id);
    setSelectedCapsuleType('dwe');
    setCustomCapsuleText('');
    setCapsuleSuccessMsg(false);
  };

  const handleSendCapsule = () => {
    setIsSendingCapsule(true);
    setTimeout(() => {
      setIsSendingCapsule(false);
      setCapsuleSuccessMsg(true);
      setTimeout(() => {
        setCapsuleId(null);
        setCapsuleSuccessMsg(false);
      }, 2000);
    }, 1500);
  };

  const handleTriggerExport = (alert: VoiceAlert) => {
    setExportAlert(alert);
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
    }, 2500);
  };

  const handleExportZipDirect = async (alert: VoiceAlert) => {
    const matchedPatient = patients.find(p => p.id === alert.patientId);
    if (!matchedPatient) {
      window.alert("Impossible de localiser le patient associé à cette alerte.");
      return;
    }
    
    const pwd = window.prompt("🚨 SÉCURISATION RGPD :\nEntrez un mot de passe de chiffrage pour sécuriser l'archive ZIP (AES-256) du patient " + matchedPatient.name + " :");
    if (pwd === null) return;
    if (pwd.trim().length < 4) {
      window.alert("Le mot de passe doit contenir au moins 4 caractères.");
      return;
    }
    
    setIsGeneratingZip(true);
    setZipEncryptionStatus("Chargement des données cliniques...");
    
    try {
      let patientSessions: VoiceSession[] = [];
      if (tenantId) {
        setZipEncryptionStatus("Extraction de l'historique d'appels...");
        const querySnapshot = await getDocs(collection(db, 'tenants', tenantId, 'patients', matchedPatient.id, 'sessions'));
        querySnapshot.forEach(docSnap => {
          patientSessions.push({ id: docSnap.id, ...docSnap.data() } as VoiceSession);
        });
      }
      
      setZipEncryptionStatus("Assemblage de la structure ZIP standard...");
      const zipBytes = await generatePatientZip(matchedPatient, patientSessions, [alert]);
      
      setZipEncryptionStatus("Chiffrement par algorithme AES-256 GCM (PBKDF2)...");
      const encryptedBytes = await encryptPayload(zipBytes, pwd.trim());
      
      setZipEncryptionStatus("Création du blob binaire final...");
      const blob = new Blob([encryptedBytes], { type: 'application/octet-stream' });
      const safeName = matchedPatient.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      saveAs(blob, `ALERTE_${alert.id}_DOSSIER_CHIFFRE_${safeName}.zip.enc`);
      
      showNotice("Dossier client-side ZIP chiffré généré et téléchargé avec succès.");
    } catch (e: any) {
      console.error(e);
      window.alert(`Erreur d'exportation sécurisée ZIP : ${e.message || e}`);
    } finally {
      setIsGeneratingZip(false);
      setZipEncryptionStatus(null);
    }
  };

  const showNotice = (msg: string) => {
    setActiveNotification(msg);
    setTimeout(() => {
      setActiveNotification(null);
    }, 4000);
  };

  const handleExportCSV = () => {
    try {
      const headers = ["ID_Alerte", "ID_Patient_Anonyme", "Type_Alerte", "Priorite", "Statut", "Date_Detection"];
      const rows = alerts
        .filter(a => a.status === statusFilter) // or export all if desired, using filtered alerts conceptually
        .map((a, index) => {
          // Create an anonymous ID
          const anonymousPatientId = `ANON_PATIENT_${(a.patientId || '').substring(0, 5)}`;
          
          return [
            `ALT_${(index + 1).toString().padStart(4, '0')}`,
            anonymousPatientId,
            `"${a.detectedSigns?.[0] || 'Anomalie Vocale'}"`,
            a.priority,
            a.status,
            a.date || ''
          ].join(",");
        });

      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Export_Alertes_Anonymise_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Erreur d'exportation CSV:", err);
    }
  };

  // Computed metric state
  const statsOverview = useMemo(() => {
    const activeArr = alerts.filter((a) => a.status === 'Active');
    const highActive = activeArr.filter((a) => a.priority === 'High').length;
    
    // Calculate total patients with alerts
    const distinctAlertPatients = new Set(alerts.map(a => a.patientId)).size;
    const diseaseAnomaliesRate = ((distinctAlertPatients / (patients.length || 1)) * 100).toFixed(1);

    return {
      activeCount: activeArr.length,
      highActiveCount: highActive,
      anomaliesRate: diseaseAnomaliesRate,
      totalThisMonth: alerts.length,
    };
  }, [alerts, patients]);

  // Handle Multi-Criteria Filtering
  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      // 1. Filter by Status
      if (alert.status !== statusFilter) return false;

      // Map patient
      const patient = patients.find(p => p.id === alert.patientId);
      if (!patient) return false;

      // 2. Keyword/Search Patient name or signs or AI suggestions
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesPatientName = patient.name.toLowerCase().includes(query);
        const matchesSigns = alert.detectedSigns.some(s => s.toLowerCase().includes(query));
        const matchesSuggestion = alert.aiSuggestion.toLowerCase().includes(query);
        if (!matchesPatientName && !matchesSigns && !matchesSuggestion) return false;
      }

      // 3. Filter by severity Priority
      if (priorityFilter !== 'All') {
        const mappedPrio = priorityFilter === 'High' ? 'High' : priorityFilter === 'Medium' ? 'Medium' : 'Low';
        if (alert.priority !== mappedPrio) return false;
      }

      // 4. Filter by Pathology
      if (pathologyFilter !== 'all') {
        const hasPathology = patient.conditions.some(c => 
          c.toLowerCase().includes(pathologyFilter.toLowerCase())
        );
        if (!hasPathology) return false;
      }

      // 5. Filter by Period Timeframe
      if (periodFilter !== 'Tous') {
        const alertTime = new Date(alert.date).getTime();
        const currentTime = new Date("2026-05-21T20:33:09Z").getTime();
        const diffHours = (currentTime - alertTime) / (1000 * 60 * 60);

        if (periodFilter === 'Aujourdhui') {
          // Check if same date day (2026-05-21)
          const alertDateStr = new Date(alert.date).toISOString().split('T')[0];
          if (alertDateStr !== '2026-05-21') return false;
        } else if (periodFilter === '7jours') {
          if (diffHours > 7 * 24) return false;
        } else if (periodFilter === '30jours') {
          if (diffHours > 30 * 24) return false;
        }
      }

      return true;
    });
  }, [alerts, statusFilter, priorityFilter, pathologyFilter, periodFilter, searchQuery]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20 px-4">
      
          {/* Real-time Simulated Alert Toast */}
      {activeNotification && (
        <div className="fixed top-6 right-6 z-50 max-w-md bg-slate-900 text-white p-5 rounded-2xl shadow-2xl flex items-start gap-4 animate-in slide-in-from-top-6 border border-slate-800">
          <div className="bg-red-600 text-white rounded-full p-2.5 shrink-0 animate-pulse">
            <Bell size={20} />
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="font-bold text-sm">Système d'Alerte Hanen</h4>
            <p className="text-xs text-slate-300 leading-relaxed font-medium">{activeNotification}</p>
          </div>
          <button onClick={() => setActiveNotification(null)} className="text-slate-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header section with clinical label */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-100 pb-8">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            Flux d'Alertes IA
            {statsOverview.highActiveCount > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-red-100/80 text-red-700 border border-red-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                {statsOverview.highActiveCount} Critique{statsOverview.highActiveCount > 1 ? 's' : ''}
              </span>
            )}
          </h1>
          <p className="text-slate-500 font-medium text-sm max-w-2xl">
            Surveillance en temps réel des signaux cliniques identifiés lors des interactions vocales.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => alert('Sélection multiple et chiffrement complet AES-256 (ZIP) pour vos dossiers seront supportés nativement dans l\'application bureau.')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-100 text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95"
          >
            <ShieldCheck size={14} />
            Archives Sécurisées (ZIP)
          </button>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95"
          >
            <Download size={14} />
            Export Anonymisé (CSV)
          </button>
          <button
            onClick={simulateRealtimeAlert}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95"
          >
            <Bell size={14} />
            Simuler une alerte
          </button>
        </div>
      </div>

      {/* 2. VUE GLOBALE (KPIs CARD) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-xs relative overflow-hidden group hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Total Alertes Ce Mois</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50/70 flex items-center justify-center text-indigo-500 shrink-0">
              <Activity size={16} />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800 tracking-tight">{statsOverview.totalThisMonth + 14}</span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              +12% vs avril
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium mt-1">Cumulé actif & hist. de résolutions</p>
        </div>

        {/* KPI 2 */}
        <div className="bg-white rounded-2xl border border-rose-100 p-5 shadow-xs relative overflow-hidden group hover:border-rose-300 transition-colors">
          <div className="absolute top-0 right-0 w-16 h-16 bg-rose-50/40 rounded-full translate-x-3 -translate-y-3 shrink-0" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-widest block">Urgences Critiques Actives</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
              <ShieldAlert size={16} />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600 tracking-tight">
              {statsOverview.highActiveCount}
            </span>
            <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">
              Action &lt; 24h
            </span>
          </div>
          <p className="text-[10px] text-rose-400 font-medium mt-1">Niveau d'exacerbation élevé</p>
        </div>

        {/* KPI 3 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-xs relative overflow-hidden group hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Taux anomalies vocales</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50/70 flex items-center justify-center text-emerald-600 shrink-0">
              <Mic size={16} />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800 tracking-tight">{statsOverview.anomaliesRate}%</span>
            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
              stable
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium mt-1">Rapporté à l'effectif actif du cabinet</p>
        </div>

        {/* KPI 4 */}
        <div className="bg-white rounded-2xl border border-slate-200/70 p-5 shadow-xs relative overflow-hidden group hover:border-indigo-200 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Évolution clinique</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50/70 flex items-center justify-center text-indigo-500 shrink-0">
              <HeartHandshake size={16} />
            </div>
          </div>
          <div className="mt-3.5 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-indigo-600 tracking-tight">-15% d'urgences</span>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              efficace
            </span>
          </div>
          <p className="text-[10px] text-slate-500 font-medium mt-1">Grâce aux appels de prévention rapides</p>
        </div>

      </div>

      {/* 1. SECTIONS FILTRES RICHES */}
      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-xs p-6 space-y-5">
        
        {/* Top layer Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          
          {/* Status Tab Toggle (Non traitées / Traitées) */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/40 w-full lg:w-fit">
            <button
              onClick={() => {
                setStatusFilter('Active');
              }}
              className={cn(
                "flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                statusFilter === 'Active'
                  ? "bg-white text-rose-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              {statsOverview.activeCount > 0 && <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shrink-0" />}
              Alertes non traitées ({statsOverview.activeCount})
            </button>
            <button
              onClick={() => {
                setStatusFilter('Resolved');
              }}
              className={cn(
                "flex-1 lg:flex-none px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2",
                statusFilter === 'Resolved'
                  ? "bg-white text-indigo-600 shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              )}
            >
              <CheckCircle2 size={13} className="text-emerald-500" strokeWidth={2.5} />
              Alertes closes / archivées ({alerts.filter(a => a.status === 'Resolved').length})
            </button>
          </div>

          {/* Search bar inputs */}
          <div className="relative flex-1 max-w-md w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
            <input
              type="text"
              placeholder="Rechercher par patient ou mot-clé (toux, essoufflement...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-slate-50 border border-slate-200/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-xs font-bold transition-all text-slate-700 placeholder-slate-450"
            />
          </div>

          {/* Bulk Action Mark all as Resolved */}
          {statusFilter === 'Active' && filteredAlerts.length > 0 && (
            <button
              onClick={handleMarkAllAsResolved}
              className="lg:ml-auto inline-flex items-center gap-2 px-5 py-3 hover:bg-slate-50 text-slate-700 hover:text-rose-600 font-extrabold text-xs rounded-xl border border-slate-200 transition-all shadow-xs"
            >
              <CheckCircle size={14} className="text-emerald-500" />
              Marquer tout comme traité
            </button>
          )}

        </div>

        {/* Secondary controls layer: Period, Priority, Pathology */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-5 border-t border-slate-100">
          
          {/* Period Filter */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Clock size={12} /> Période d'identification
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {(['Aujourdhui', '7jours', '30jours', 'Tous'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriodFilter(p)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[10px] font-extrabold tracking-wide border transition-all",
                    periodFilter === p
                      ? "bg-slate-900 border-slate-900 text-white"
                      : "bg-white border-slate-250 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {p === 'Aujourdhui' ? "Aujourd'hui" : p === '7jours' ? "7 Jours" : p === '30jours' ? "30 Jours" : "Tous"}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Filter */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Filter size={12} /> Niveau d'Urgence
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {(['All', 'High', 'Medium', 'Low'] as const).map(prio => (
                <button
                  key={prio}
                  onClick={() => setPriorityFilter(prio)}
                  className={cn(
                    "p-1.5 px-3 rounded-lg text-[10px] font-bold tracking-wide border transition-all",
                    priorityFilter === prio
                      ? prio === 'High' ? "bg-rose-50 border-rose-300 text-rose-700"
                        : prio === 'Medium' ? "bg-orange-50 border-orange-300 text-orange-700"
                        : prio === 'Low' ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : "bg-slate-900 border-slate-900 text-white"
                      : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {prio === 'All' ? 'Toutes' : prio === 'High' ? 'Critique 🔴' : prio === 'Medium' ? 'Important 🟠' : 'Suivi 🟢'}
                </button>
              ))}
            </div>
          </div>

          {/* Pathology Filter Selection */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Activity size={12} /> Diagnostic Pathologique
            </span>
            <select
              value={pathologyFilter}
              onChange={(e) => setPathologyFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 bg-white"
            >
              <option value="all">Toutes pathologies (Tous)</option>
              <option value="Diabète">Diabète Type 2</option>
              <option value="Hypertension">Hypertension Artérielle</option>
              <option value="Cardiaque">Insuffisance Cardiaque</option>
              <option value="Parkinson">Maladie de Parkinson</option>
              <option value="Alzheimer">Maladie d'Alzheimer</option>
              <option value="Isolement">Risque d'Isolement / Solitude</option>
              <option value="Asthme">Asthme / Voies Respiratoires</option>
            </select>
          </div>

        </div>

      </div>

      {/* 4. MAIN LIST FEED */}
      <div className="space-y-6">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/60 p-16 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-500">
              <ShieldCheck size={36} className="text-emerald-500 animate-pulse" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="text-base font-bold text-slate-800">Aucune alerte trouvée</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Toutes les alertes cliniques correspondant à vos critères de filtres ont été traitées ou archivées. Le cabinet médical de Dr. Slim est entièrement à jour !
              </p>
            </div>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const patient = patients.find(p => p.id === alert.patientId);
            if (!patient) return null;

            const tracking = transcriptDetails[alert.id] || {
              transcriptText: "Discussion générale.",
              audioDurationSec: 30,
              dialectText: "« El 7amdoullah kol chay mri7... »",
              frenchTranslation: "« Louange à Dieu, tout est très bien... »",
              historyAlertsCount: 0,
              detectionPeriod: "Détecté lors du dernier appel"
            };

            const isPlaying = playingId === alert.id;

            const isHigh = alert.priority === 'High' && alert.status !== 'Resolved';
            const isMedium = alert.priority === 'Medium' && alert.status !== 'Resolved';
            const isLow = alert.priority === 'Low' && alert.status !== 'Resolved';
            const isResolved = alert.status === 'Resolved';

            return (
              <div 
                key={alert.id} 
                className={cn(
                  "bg-white rounded-3xl border transition-all duration-300 relative overflow-hidden shadow-sm",
                  isResolved 
                    ? "border-slate-200 opacity-90 shadow-none hover:opacity-100" 
                    : isHigh 
                    ? "border-red-600 bg-red-50/10 shadow-[0_20px_50px_-12px_rgba(220,38,38,0.25)] border-2"
                    : isMedium
                    ? "border-amber-500/50 bg-amber-50/10"
                    : "border-slate-200"
                )}
              >
                {/* Urgent Callout Warning Banner on High Alerts */}
                {isHigh && (
                  <div className="bg-red-600 text-white px-6 py-3 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wider relative z-10">
                    <span className="flex items-center gap-2.5">
                      <AlertTriangle size={16} strokeWidth={3} className="animate-pulse" />
                      Alerte Critique : Intervention requise immédiatement
                    </span>
                    <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded border border-white/30">
                      PRIORITÉ ÉLEVÉE
                    </span>
                  </div>
                )}

                {/* Horizontal left indicators for layout accent */}
                <div className={cn(
                  "absolute left-0 top-0 bottom-0 w-2.5",
                  isResolved
                    ? 'bg-slate-400'
                    : isHigh
                    ? 'bg-red-650' 
                    : isMedium
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                )} />

                <div className={cn(
                  "p-6 md:p-8 pl-8",
                  isHigh ? "pt-5" : ""
                )}>
                  
                  {/* Card Header Line */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-150/60 pb-5">
                    
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn(
                        "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border",
                        alert.status === 'Resolved'
                          ? "bg-slate-50 border-slate-200 text-slate-500"
                          : alert.priority === 'High'
                          ? "bg-red-50 border-red-100 text-red-700"
                          : alert.priority === 'Medium'
                          ? "bg-amber-50 border-amber-100 text-amber-700"
                          : "bg-emerald-50 border-emerald-100 text-emerald-700"
                      )}>
                        <AlertTriangle size={12} /> 
                        {alert.status === 'Resolved' 
                          ? 'Traité' 
                          : alert.priority === 'High' 
                          ? 'Critique' 
                          : alert.priority === 'Medium' 
                          ? 'Suivi Prioritaire' 
                          : 'Normal'}
                      </span>

                      <span className="text-xs font-extrabold uppercase tracking-wider bg-slate-100 border border-slate-300 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-slate-800">
                        <Clock size={13} /> Capté le {new Date(alert.date).toLocaleDateString('fr-FR')} à {new Date(alert.date).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
                      </span>

                      {/* Display Detection Period Metadata */}
                      <span className="text-xs font-bold text-slate-500 italic bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-3xs">
                        {tracking.detectionPeriod}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Document PDF Generation */}
                      <button
                        onClick={() => handleTriggerExport(alert)}
                        className="p-2 text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1 text-[11px] font-bold"
                        title="Exporter en rapport PDF"
                      >
                        <Download size={13} />
                        Exporter
                      </button>

                      {alert.status === 'Resolved' && alert.resolvedAt && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1">
                          Clos le {new Date(alert.resolvedAt).toLocaleDateString('fr-FR')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Comprehensive Columns layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5">
                    
                    {/* Left block: senior parameters & transcript waveform */}
                    <div className="col-span-1 lg:col-span-8 space-y-5">
                      
                      {/* Senior Basic profile */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#fdfaf5] p-5 rounded-2xl border border-[#ede3d1]/80 shadow-3xs">
                        <div>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <Link to={`/patients/${patient.id}`} className="text-2xl font-extrabold text-slate-900 hover:text-red-700 transition-colors tracking-tight">
                              {patient.name}
                            </Link>
                            <span className="text-slate-800 font-bold text-xs bg-white border border-[#e2d6bf] px-2.5 py-1 rounded-lg">
                              {patient.age} ans
                            </span>
                            <span className="text-xs font-extrabold text-[#5c4a31] bg-[#efe9dd] border border-[#dfd4c0] px-2.5 py-1 rounded-lg">
                              Tél: {patient.phone}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-bold mt-2 uppercase tracking-wide">
                            Contexte Pathologique : <span className="text-red-900 normal-case font-bold text-sm bg-red-100/50 border border-red-200/40 px-2 py-0.5 rounded ml-1.5">{patient.conditions.join(' + ')}</span>
                          </p>
                        </div>

                        {/* Interactive Tooltip glossary trigger */}
                        <div className="flex items-center gap-1.5 self-start sm:self-center bg-white border border-[#e6decf] px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 shadow-3xs">
                          <Info size={13} className="text-amber-600 shrink-0" />
                          <span>Passez l'anomalie au survol pour explication</span>
                        </div>
                      </div>

                      {/* Decoded/biomarked Vocal signs */}
                      <div className="bg-[#fcfaf7] border border-[#eadeca]/80 rounded-2xl p-5 space-y-4 shadow-3xs">
                        <div className="flex items-center justify-between border-b border-[#e2d6bf] pb-3">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-[#5c442d] flex items-center gap-2">
                            <Activity size={15} className="text-red-600 animate-pulse" strokeWidth={2.5} /> 
                            Anomalies Cliniques Vocales Détectées (Durée de l'appel : {alert.duration})
                          </h4>
                        </div>
                        
                        {/* Interactive tags with tooltip outcomes on hover */}
                        <div className="flex flex-wrap gap-2 relative">
                          {alert.detectedSigns.map((sign, i) => (
                            <div 
                              key={i} 
                              onMouseEnter={() => setHoveredTerm(sign)}
                              onMouseLeave={() => setHoveredTerm(null)}
                              className="relative cursor-help"
                            >
                              <button className={cn(
                                "text-xs font-bold border rounded-xl px-3 py-2 flex items-center gap-2 select-none transition-colors shadow-3xs",
                                alert.status === 'Resolved'
                                  ? "bg-slate-100 text-slate-700 border-slate-300"
                                  : alert.priority === 'High'
                                  ? "bg-red-100/90 hover:bg-red-100 text-red-950 border-red-300"
                                  : "bg-amber-100/80 hover:bg-amber-100 text-amber-950 border-amber-300"
                              )}>
                                <span className={cn(
                                  "w-2.5 h-2.5 rounded-full",
                                  alert.status === 'Resolved'
                                    ? 'bg-slate-400'
                                    : alert.priority === 'High'
                                    ? 'bg-red-600 animate-ping'
                                    : 'bg-amber-500'
                                )} />
                                {sign}
                              </button>

                              {/* Styled Glossaire outcome box */}
                              {hoveredTerm === sign && glossaryTooltips[sign] && (
                                <div className="absolute top-11 left-0 z-30 max-w-sm w-80 bg-slate-900 text-slate-100 p-4 rounded-xl shadow-2xl text-xs font-semibold leading-relaxed border border-slate-800 animate-in fade-in zoom-in-95">
                                  <b className="font-extrabold text-amber-400 block mb-1">Observation Clinique du Biomarqueur :</b>
                                  {glossaryTooltips[sign]}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Suggestion d'Intervention IA */}
                        <div className="pt-2">
                          <div className={cn(
                            "text-sm leading-relaxed rounded-2xl p-5 flex items-start gap-4 shadow-3xs border",
                            alert.status === 'Resolved'
                              ? "bg-slate-100/80 border-slate-200 text-slate-800"
                              : alert.priority === 'High'
                              ? "bg-red-50/90 border-red-200 text-red-950"
                              : "bg-indigo-50/95 border-indigo-200 text-indigo-950"
                          )}>
                            <div className={cn(
                              "p-2.5 rounded-xl shrink-0 self-start shadow-inner",
                              alert.status === 'Resolved'
                                ? "bg-slate-200 text-slate-600"
                                : alert.priority === 'High'
                                ? "bg-red-100 text-red-700"
                                : "bg-indigo-100 text-indigo-700"
                            )}>
                              <Sparkles size={18} />
                            </div>
                            <div className="flex-1 space-y-1.5">
                              <b className="font-bold text-xs block uppercase tracking-wider text-slate-900">
                                Analyse hanen :
                              </b>
                              <span className="font-semibold text-slate-800 block leading-relaxed text-[13px]">{alert.aiSuggestion}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Trigger Transcript Section */}
                      <div className="bg-slate-950 text-slate-100 rounded-2xl p-5 border border-slate-900 space-y-4 relative shadow-inner">
                        
                        {/* Audio Wave Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                            <MessageSquare size={13} className="text-indigo-400" /> Extrait de la Discussion Enregistrée (Tunisian Derja)
                          </span>
                          
                          {/* Live playback toggles */}
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-mono">Sensibilité vocale active</span>
                            <button
                              onClick={() => handlePlayToggle(alert.id)}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                                isPlaying 
                                  ? "bg-rose-500 text-white" 
                                  : "bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300"
                              )}
                            >
                              {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                              {isPlaying ? 'Arrêter' : 'Écouter l’extrait vocal'}
                            </button>
                          </div>
                        </div>

                        {/* Clinkable Waveform Player widget */}
                        <div 
                          className="bg-slate-900 border border-slate-800/80 rounded-xl p-3.5 space-y-2 cursor-pointer relative hover:border-slate-700 transition-colors"
                          onClick={(e) => handleWaveformClick(e, alert.id)}
                          title="Cliquez sur la waveform pour naviguer dans l'extrait"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-indigo-400 shrink-0 font-bold bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                              {isPlaying ? "LECTURE AUDIO ACTIVE" : "ÉCOUTE DISPONIBLE"}
                            </span>
                            
                            {/* Live waveform rendering bars */}
                            <div className="flex-1 flex items-end justify-between h-8 shrink-0 relative overflow-hidden px-1">
                              {[...Array(26)].map((_, idx) => {
                                const isActive = isPlaying && playProgress > (idx / 26) * 100;
                                return (
                                  <div 
                                    key={idx} 
                                    className={cn(
                                      "w-1 rounded-full transition-all duration-300",
                                      isActive 
                                        ? "bg-gradient-to-t from-indigo-500 to-rose-400 animate-pulse" 
                                        : "bg-slate-700 hover:bg-slate-500"
                                    )}
                                    style={{ 
                                      height: isPlaying 
                                        ? `${Math.max(15, Math.floor(Math.abs(Math.sin((playProgress / 10) + idx)) * 100))}%`
                                        : `${(idx % 3 === 0) ? 65 : (idx % 2 === 0) ? 40 : 25}%`
                                    }}
                                  />
                                );
                              })}
                            </div>
                          </div>

                          {/* Navigation Playback progress slider metadata */}
                          <div className="flex justify-between items-center text-[9px] text-slate-550 font-mono mt-1 px-1">
                            <span className="text-slate-500">
                              Progression : {Math.round(playProgress)}%
                            </span>
                            <span className="text-slate-500 font-extrabold flex items-center gap-1">
                              <Volume2 size={10} className="text-indigo-500" />
                              {Math.round(playProgress * tracking.audioDurationSec / 100)}s / {tracking.audioDurationSec}s
                            </span>
                          </div>
                        </div>

                        {/* Tunisian Derja dialetic transcript text */}
                        <div className="space-y-3 pt-2">
                          <p className="text-base font-bold leading-relaxed tracking-wide text-slate-100 border-l-3 border-emerald-500 pl-4.5 bg-slate-900/60 py-2.5 rounded-r-lg">
                            {tracking.dialectText}
                          </p>
                          <p className="text-[13px] font-semibold text-slate-300 italic pl-4.5 leading-relaxed bg-slate-900/30 py-1.5 rounded-r-lg">
                            Traduction clinique locale : <span className="font-bold text-slate-100">{tracking.frenchTranslation}</span>
                          </p>
                        </div>

                      </div>

                      {/* CLINICAL NOTES BY DR. SLIM (Interactive live comment box) */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 shadow-inner">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">
                          Commentaires de suivi médical (Sauvegardé automatiquement) :
                        </label>
                        <textarea
                          placeholder="Saisissez des notes médicales pour ce cas clinique (antécédents, appel passé avec la famille, etc.)..."
                          value={localComments[alert.id] ?? alert.doctorComment ?? ''}
                          onChange={(e) => updateDoctorComment(alert.id, e.target.value)}
                          className="w-full text-xs font-semibold p-3.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white placeholder-slate-400 text-slate-700"
                          rows={2}
                        />
                      </div>

                      {/* Display closure note if resolved */}
                      {alert.status === 'Resolved' && alert.closureNote && (
                        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl animate-in slide-in-from-top-3">
                          <p className="text-xs font-bold text-emerald-800">
                            <b>Note clinique de clôture :</b>
                          </p>
                          <p className="text-xs text-slate-600 font-medium mt-1">
                            {alert.closureNote}
                          </p>
                        </div>
                      )}

                      {/* Collapsible Patient alerts history feed */}
                      {tracking.historyAlertsCount > 0 && (
                        <div className="pt-2">
                          <button
                            onClick={() => setExpandedHistoryId(expandedHistoryId === alert.id ? null : alert.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-500 hover:text-indigo-600 focus:outline-none"
                          >
                            <FileText size={13} />
                            {expandedHistoryId === alert.id 
                              ? "Masquer l'historique d'urgences de ce patient" 
                              : `Voir l'historique d'urgences de ce patient (${tracking.historyAlertsCount} recensées)`}
                          </button>

                          {expandedHistoryId === alert.id && (
                            <div className="mt-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-150 space-y-3 animate-in fade-in duration-200">
                              <span className="text-[9px] font-bold text-indigo-650 uppercase tracking-wider block">
                                Progression clinique antérieure du senior ({patient.name})
                              </span>
                              
                              <div className="space-y-2.5">
                                <div className="p-3 bg-white rounded-xl border border-slate-200 border-l-3 border-orange-500 text-xs">
                                  <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                                    <span>14 Mai 2026 - Alerte Important</span>
                                    <span>Traité par Dr. Slim</span>
                                  </div>
                                  <p className="mt-1 text-slate-700 font-bold">Tremblement de la voix détecté.</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5 mt-1 font-medium italic">« Note : Ré-ajustement léger de l'horaire de prise. »</p>
                                </div>

                                <div className="p-3 bg-white rounded-xl border border-slate-200 border-l-3 border-emerald-500 text-xs">
                                  <div className="flex justify-between text-[10px] text-slate-500 font-bold">
                                    <span>05 Mai 2026 - Alerte Suivi</span>
                                    <span>Traité par Dr. Slim</span>
                                  </div>
                                  <p className="mt-1 text-slate-700 font-bold">Légère bradylalie lors de l'appel du matin.</p>
                                  <p className="text-[11px] text-slate-500 mt-1 font-medium italic">« Note : Fatigue passagère due à un mauvais sommeil rapporté. »</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    </div>

                    {/* Right column: Physicians rapid clinical dispatch controls */}
                    <div className="col-span-1 lg:col-span-4 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-150/80 lg:pl-6 pt-5 lg:pt-0 gap-5 min-h-[220px]">
                      
                      <div className="space-y-3 w-full">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 block mb-1">
                          Actions rapides recommandées
                        </span>
                        
                        <Link 
                          to={`/patients/${patient.id}`} 
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm focus:outline-none text-center"
                        >
                          <Activity size={14} /> Explorer dossier complet
                        </Link>
                        
                        {alert.status === 'Active' ? (
                          <button
                            onClick={() => handleOpenCapsuleDialog(alert.id)}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white text-xs font-extrabold rounded-xl transition-all border border-indigo-150/65 hover:border-indigo-600 hover:shadow-xs focus:outline-none"
                          >
                            <Mic size={14} /> Envoyer une capsule vocale
                          </button>
                        ) : (
                          <div className="p-3.5 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 leading-relaxed font-semibold">
                            Cette anomalie a été traitée cliniquement. Le clinicien s'est assuré du suivi d'accompagnement.
                          </div>
                        )}
                      </div>

                      <div className="pt-4 border-t border-slate-100/85 w-full mt-auto">
                        {alert.status === 'Active' ? (
                          <button
                            onClick={() => openResolveModal(alert.id)}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white text-xs font-bold rounded-xl transition-all border border-emerald-200"
                          >
                            <CheckCircle2 size={14} /> Marquer comme traitée / résolue
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReopenAlert(alert.id)}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-white hover:bg-slate-50 text-slate-600 text-xs font-bold rounded-xl transition-all border border-slate-200"
                          >
                            <RefreshCw size={13} /> Ré-ouvrir l'anomalie
                          </button>
                        )}
                      </div>

                    </div>

                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. MODAL 1: PRESET CAPSULE VOCALE SENDER */}
      {capsuleId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-7 border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                  <Mic size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Envoyer une Capsule de Soins (Vocal)</h3>
                  <p className="text-slate-500 text-xs mt-0.5 font-semibold">Le message sera prononcé par Hanen lors du prochain appel.</p>
                </div>
              </div>
              <button 
                onClick={() => setCapsuleId(null)}
                className="text-slate-500 hover:text-slate-600 p-1 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {capsuleSuccessMsg ? (
              <div className="py-8 text-center space-y-3.5">
                <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                  <Check size={24} strokeWidth={3} />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-800 text-sm">Capsule vocale transmise avec succès !</h4>
                  <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">
                    L'assistance médicale Hanen l'exécutera auprès du senior dans un intervalle de 10 min.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-5">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block">Choisissez le modèle de capsule médicale :</label>
                
                <div className="grid grid-cols-1 gap-2.5">
                  
                  {/* Option 1: Medication reminder */}
                  <label 
                    className={cn(
                      "p-3.5 border rounded-2xl cursor-pointer flex items-start gap-3 transition-colors",
                      selectedCapsuleType === 'dwe' ? "bg-indigo-50/50 border-indigo-200" : "bg-slate-50 border-slate-200/60 hover:border-slate-305"
                    )}
                  >
                    <input 
                      type="radio" 
                      name="capsule-type" 
                      checked={selectedCapsuleType === 'dwe'} 
                      onChange={() => setSelectedCapsuleType('dwe')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500 rounded-full"
                    />
                    <div className="text-xs">
                      <b className="font-extrabold text-slate-800 block">Rappel d'observance doux (Dwe)</b>
                      <span className="text-slate-500 font-medium block mt-0.5">
                        « Écoute-moi, n'oublie pas de prendre tes comprimés de midi maintenant pour préserver ton cœur. »
                      </span>
                    </div>
                  </label>

                  {/* Option 2: Social support */}
                  <label 
                    className={cn(
                      "p-3.5 border rounded-2xl cursor-pointer flex items-start gap-3 transition-colors",
                      selectedCapsuleType === 'wanesny' ? "bg-indigo-50/50 border-indigo-200" : "bg-slate-50 border-slate-200/60 hover:border-slate-305"
                    )}
                  >
                    <input 
                      type="radio" 
                      name="capsule-type" 
                      checked={selectedCapsuleType === 'wanesny'} 
                      onChange={() => setSelectedCapsuleType('wanesny')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500 rounded-full"
                    />
                    <div className="text-xs">
                      <b className="font-extrabold text-slate-800 block">Réconfort de solitude (Wanesny)</b>
                      <span className="text-slate-500 font-medium block mt-0.5">
                        « L'équipe de Dr. Slim pense bien à toi aujourd'hui, Hanen t'appellera ce soir pour bavarder un peu. »
                      </span>
                    </div>
                  </label>

                  {/* Option 3: Respiration */}
                  <label 
                    className={cn(
                      "p-3.5 border rounded-2xl cursor-pointer flex items-start gap-3 transition-colors",
                      selectedCapsuleType === 'nafas' ? "bg-indigo-50/50 border-indigo-200" : "bg-slate-50 border-slate-200/60 hover:border-slate-305"
                    )}
                  >
                    <input 
                      type="radio" 
                      name="capsule-type" 
                      checked={selectedCapsuleType === 'nafas'} 
                      onChange={() => setSelectedCapsuleType('nafas')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500 rounded-full"
                    />
                    <div className="text-xs">
                      <b className="font-extrabold text-slate-800 block">Exercice respiratoire relaxant (Nafas)</b>
                      <span className="text-slate-500 font-medium block mt-0.5">
                        « Faisons ensemble 3 inspirations calmes maintenant. Hanen va guider ton souffle... »
                      </span>
                    </div>
                  </label>

                  {/* Option 4: Custom */}
                  <label 
                    className={cn(
                      "p-3.5 border rounded-2xl cursor-pointer flex items-start gap-3 transition-colors",
                      selectedCapsuleType === 'custom' ? "bg-indigo-50/50 border-indigo-200" : "bg-slate-50 border-slate-200/60 hover:border-slate-305"
                    )}
                  >
                    <input 
                      type="radio" 
                      name="capsule-type" 
                      checked={selectedCapsuleType === 'custom'} 
                      onChange={() => setSelectedCapsuleType('custom')}
                      className="mt-1 text-indigo-600 focus:ring-indigo-500 rounded-full"
                    />
                    <div className="text-xs flex-1">
                      <b className="font-extrabold text-slate-800 block">Message vocal personnalisé (Dr. Slim)</b>
                      {selectedCapsuleType === 'custom' && (
                        <textarea
                          placeholder="Écrivez le message ici. Hanen le synthétisera avec sa voix d'accompagnement bienveillante."
                          value={customCapsuleText}
                          onChange={(e) => setCustomCapsuleText(e.target.value)}
                          className="w-full mt-2 p-2.5 rounded-xl border border-slate-200 focus:ring-1 focus:ring-indigo-500 text-xs font-semibold focus:outline-none placeholder-slate-400 bg-white"
                          rows={2}
                        />
                      )}
                    </div>
                  </label>

                </div>

                <div className="flex gap-2.5 pt-4">
                  <button
                    onClick={() => setCapsuleId(null)}
                    className="flex-1 py-3 text-xs bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 font-bold transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSendCapsule}
                    disabled={isSendingCapsule || (selectedCapsuleType === 'custom' && !customCapsuleText.trim())}
                    className="flex-1 py-3 text-xs bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg rounded-xl text-white font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSendingCapsule ? 'Envoi en cours...' : 'Programmer l’envoi'}
                    <Send size={12} />
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* 6. MODAL 2: RESOLVE CLINICAL ALERT WITH NOTES */}
      {resolvingId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200 font-sans">
            
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5 font-sans">
                <div className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base tracking-tight">Clôture de l'Alerte IA</h3>
                  <p className="text-slate-500 text-xs mt-0.5 font-semibold">Clôturer l'alerte médicale après examen clinique.</p>
                </div>
              </div>
              <button 
                onClick={handleCloseResolveModal}
                className="text-slate-500 hover:text-slate-600 p-1 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 pt-5">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block mb-1.5">Note médicale définitive de clôture :</label>
                <textarea
                  placeholder="Ex: Famille contactée. Observance diurétiques corrigée ce midi. État réévalué stable..."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 focus:ring-1 focus:ring-indigo-500 rounded-2xl text-xs font-semibold placeholder-slate-400 text-slate-700 focus:bg-white focus:outline-none"
                  rows={4}
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleCloseResolveModal}
                  className="flex-1 py-3 text-xs bg-slate-100 border border-slate-250 hover:bg-slate-200 rounded-2xl text-slate-600 font-bold transition-all font-sans"
                >
                  Fermer
                </button>
                <button
                  type="button"
                  onClick={submitResolve}
                  className="flex-1 py-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl transition-all shadow-[0_4px_12px_rgba(16,185,129,0.2)] font-sans"
                >
                  Confirmer la clôture
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODAL 3: EXPORT CLINICAL GENERAL REPORT PDF MODAL */}
      {exportAlert && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-200 text-slate-850">
            
            <div className="flex justify-between items-start border-b border-slate-150 pb-4">
              <div className="flex items-center gap-2.5">
                <FileText className="text-indigo-600" size={20} />
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">Rapport Clinique Biomarqueurs Vocaux</h3>
                  <p className="text-slate-500 text-xs">Aperçu du document PDF prêt pour intégration dossier médical.</p>
                </div>
              </div>
              <button 
                onClick={() => setExportAlert(null)}
                className="text-slate-500 hover:text-slate-600 p-1.5 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Simulated Medical Dossier Structure */}
            <div className="my-6 p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-4 font-sans text-xs">
              <div className="flex justify-between border-b pb-3 uppercase tracking-wider text-[10px] text-slate-500 font-bold">
                <span>Cabinet De Dr. Slim Pro</span>
                <span>Hanen IA Platform Integration</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h5 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest">PATIENT :</h5>
                  <p className="font-bold text-slate-900 mt-0.5 text-sm">{patients.find(p => p.id === exportAlert.patientId)?.name}</p>
                  <p className="text-slate-500">Âge : {patients.find(p => p.id === exportAlert.patientId)?.age} ans</p>
                  <p className="text-slate-500">Tél : {patients.find(p => p.id === exportAlert.patientId)?.phone}</p>
                </div>
                <div>
                  <h5 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest">INFORMATIONS ALERTE :</h5>
                  <p className="font-bold text-slate-900 mt-0.5">ID: {exportAlert.id}</p>
                  <p className="text-slate-500">Créé le : {new Date(exportAlert.date).toLocaleString('fr-FR')}</p>
                  <p className="text-slate-500 font-extrabold text-indigo-600">Priorité : {exportAlert.priority}</p>
                </div>
              </div>

              <div className="pt-3 border-t">
                <h5 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest mb-1">SIGNES VOCAUX IDENTIFIÉS :</h5>
                <ul className="list-disc pl-4 space-y-1 text-slate-705 font-bold">
                  {exportAlert.detectedSigns.map((s, idx) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t space-y-1 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/50">
                <h5 className="font-bold text-[10px] text-indigo-950 uppercase tracking-widest text-[10px]">SUGGESTION DIAGNOSTIC IA :</h5>
                <p className="text-slate-650 leading-relaxed font-semibold">{exportAlert.aiSuggestion}</p>
              </div>

              <div className="pt-3 border-t">
                <h5 className="font-bold text-[10px] text-slate-500 uppercase tracking-widest mb-1">NOTES COMPLÉMENTAIRES DU MÉDECIN :</h5>
                <p className="text-slate-600 italic font-medium leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                  {exportAlert.doctorComment || "Aucune note complémentaire ajoutée par le docteur."}
                </p>
              </div>
            </div>

            {zipEncryptionStatus && (
              <div className="p-3 bg-indigo-50 border border-indigo-150 rounded-xl flex items-center gap-2.5">
                <RefreshCw size={14} className="text-indigo-650 animate-spin shrink-0" />
                <p className="text-[11px] font-bold text-indigo-950 uppercase tracking-wide">{zipEncryptionStatus}</p>
              </div>
            )}

            <div className="flex gap-2.5 justify-end flex-wrap">
              <button
                onClick={() => setExportAlert(null)}
                disabled={isGeneratingZip}
                className="px-4 py-2.5 text-xs bg-slate-100 hover:bg-slate-200 border border-slate-250 rounded-xl text-slate-705 font-bold transition-all text-center"
              >
                Annuler
              </button>
              <button
                disabled={isGeneratingZip}
                onClick={() => handleExportZipDirect(exportAlert)}
                className="px-4 py-2.5 text-xs bg-emerald-50 hover:bg-emerald-100 border border-emerald-355 text-emerald-950 font-bold rounded-xl transition-all flex items-center gap-1.5 text-center shadow-xs"
              >
                <ShieldCheck size={14} className="text-emerald-600" />
                {isGeneratingZip ? "Compilation..." : "Exporter Dossier ZIP (AES-250)"}
              </button>
              <button
                disabled={isGeneratingZip}
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 text-center"
              >
                <FileText size={14} />
                Sauvegarder Rapport PDF
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
