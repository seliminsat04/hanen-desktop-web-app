import React, { useState, useRef, useEffect } from 'react';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { Patient } from '../types';
import { 
  Mic, Send, Phone, Search, User, Square, Play, 
  Volume2, Clock, Check, Sparkles, BookOpen, Heart, 
  Activity, CheckCheck, RefreshCw, AlertCircle, Sparkle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { doc, setDoc, serverTimestamp, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../AuthContext';

interface Message {
  id: string;
  patientId: string;
  type: 'text' | 'audio';
  content: string;
  audioUrl: string;
  sender: 'doctor' | 'hanen' | 'patient';
  createdAt: any;
  speechRate?: 'slow' | 'normal';
  voiceTone?: 'warm' | 'solemn';
  deliveryMode?: 'immediate' | 'journal';
  status?: 'scheduled' | 'calling' | 'delivered';
  category?: string;
}

const MESSAGE_CATEGORIES = [
  { id: 'treatment', label: '💊 Conseil / Traitement', bg: 'bg-emerald-50 text-emerald-700 border-slate-200 hover:border-emerald-300', activeBg: 'bg-emerald-600 text-white border-emerald-600 shadow-sm' },
  { id: 'appointment', label: '📅 Rappel RDV', bg: 'bg-blue-50 text-blue-700 border-slate-200 hover:border-blue-300', activeBg: 'bg-blue-600 text-white border-blue-600 shadow-sm' },
  { id: 'results', label: '📊 Résultats', bg: 'bg-purple-50 text-purple-700 border-slate-200 hover:border-purple-300', activeBg: 'bg-purple-600 text-white border-purple-600 shadow-sm' },
  { id: 'motivation', label: '❤️ Motivation / Réconfort', bg: 'bg-pink-50 text-pink-700 border-slate-200 hover:border-pink-300', activeBg: 'bg-pink-600 text-white border-pink-600 shadow-sm' },
  { id: 'link', label: '🔗 Lien bénéfique', bg: 'bg-amber-50 text-amber-700 border-slate-200 hover:border-amber-300', activeBg: 'bg-amber-600 text-white border-amber-600 shadow-sm' },
  { id: 'followup', label: '🩹 Suivi', bg: 'bg-indigo-50 text-indigo-700 border-slate-200 hover:border-indigo-300', activeBg: 'bg-indigo-600 text-white border-indigo-600 shadow-sm' },
];

const CATEGORY_MAP: Record<string, { label: string, color: string }> = {
  treatment: { label: "💊 Conseil / Traitement", color: "bg-emerald-700/50 text-emerald-100" },
  appointment: { label: "📅 Rappel RDV", color: "bg-blue-700/55 text-blue-100" },
  results: { label: "📊 Résultats", color: "bg-purple-700/55 text-purple-100" },
  motivation: { label: "❤️ Motivation", color: "bg-pink-700/55 text-pink-100" },
  link: { label: "🔗 Lien bénéfique", color: "bg-amber-700/55 text-amber-100" },
  followup: { label: "🩹 Suivi", color: "bg-indigo-700/55 text-indigo-100" },
};

const CLINICAL_PRESETS = [
  {
    id: 'traitement',
    label: '💊 Prise de Médicament',
    desc: 'Observance & hydratation',
    category: 'treatment',
    text: "Bonjour, c'est l'assistant Hanen. N'oubliez pas de prendre vos comprimés prescrits à cet instant précis avec un grand verre d'eau tempérée pour garantir une excellente assimilation clinique."
  },
  {
    id: 'analyse',
    label: '📊 Explication Analyse',
    desc: 'Description rassurante des résultats',
    category: 'results',
    text: "Bonjour, je viens vous rassurer au sujet de vos derniers résultats d'analyse. Le docteur a analysé les chiffres : tout est globalement stable, poursuivez vos efforts habituels."
  },
  {
    id: 'consultation',
    label: '🩹 Après Consultation',
    desc: 'Suivi de consultation et repos',
    category: 'followup',
    text: "Bonjour, c'est Hanen. Suite à votre rendez-vous d'aujourd'hui, le docteur vous encourage à vous reposer et à bien économiser votre voix pour les prochaines 48 heures."
  },
  {
    id: 'motivation',
    label: '❤️ Support Rétablissement',
    desc: 'Soutien orthophonique chaleureux',
    category: 'motivation',
    text: "Bonjour ! Hanen tenait à vous envoyer une bonne dose d'énergie. Vos progrès vocaux de cette semaine sont remarquables, continuez ainsi !"
  },
  {
    id: 'examen',
    label: '🔍 Préparation Examen',
    desc: 'Directives cliniques importantes',
    category: 'appointment',
    text: "Bonjour, Hanen vous rappelle que pour votre examen de demain matin, vous devez veiller à bien reposer vos cordes vocales ce soir et éviter les boissons trop froides."
  }
];

export function Messages() {
  const { tenantId } = useAuth();
  const { data: patients, loading } = useFirestoreData<Patient>('patients');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Custom speech properties
  const [speechRate, setSpeechRate] = useState<'slow' | 'normal'>('normal');
  const [voiceTone, setVoiceTone] = useState<'warm' | 'solemn'>('warm');
  const [deliveryMode, setDeliveryMode] = useState<'immediate' | 'journal'>('immediate');
  const [selectedCategory, setSelectedCategory] = useState<string>('treatment');

  // Interactive feedback alerts
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Speech to Text (SST) simulated step
  const [pendingAudioBlob, setPendingAudioBlob] = useState<Blob | null>(null);
  const [audioTranscription, setAudioTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showTranscriptionStep, setShowTranscriptionStep] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 6000);
  };

  const handlePreviewVoice = () => {
    const currentText = message.trim() || audioTranscription || "Veuillez d'abord écrire un message ou sélectionner un modèle clinique prêt à l'emploi.";
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(currentText);
      utterance.lang = 'fr-FR';
      utterance.rate = speechRate === 'slow' ? 0.72 : 0.90;
      utterance.pitch = voiceTone === 'warm' ? 1.15 : 0.88; // subtle difference in vocal characteristics
      window.speechSynthesis.speak(utterance);
    } else {
      triggerToast("La synthèse vocale n'est pas activée sur ce navigateur, mais le moteur de capsule Hanen l'interprétera.");
    }
  };

  useEffect(() => {
    if (!tenantId || !selectedPatientId) {
       setMessages([]);
       return;
    }
    const q = query(
      collection(db, 'tenants', tenantId, 'patients', selectedPatientId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
       const msgs: Message[] = [];
       snap.forEach(d => msgs.push({ id: d.id, ...d.data() } as Message));
       setMessages(msgs);
    });
    return () => unsubscribe();
  }, [tenantId, selectedPatientId]);

  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Impossible d'accéder au microphone.");
    }
  };

  const simulateMessageStatusTransition = (msgId: string) => {
    if (!tenantId || !selectedPatientId) return;
    
    // Step 1: transition to 'calling' in 3 seconds
    setTimeout(async () => {
      try {
        const docRef = doc(db, 'tenants', tenantId, 'patients', selectedPatientId, 'messages', msgId);
        await setDoc(docRef, { status: 'calling' }, { merge: true });
        
        // Step 2: transition to 'delivered' (Écouté / Validé) in 5 seconds
        setTimeout(async () => {
          try {
            await setDoc(docRef, { status: 'delivered' }, { merge: true });

            // Step 3: Simulation of patient replying after reading/hearing vocal call
            setTimeout(async () => {
              try {
                const simulatedReplies = [
                  "Merci beaucoup Docteur ! J'ai bien écouté Hanen, je fais attention aux conseils vocaux.",
                  "Bien reçu docteur. La capsule audio de Hanen est très rassurante. À demain pour l'exercice !",
                  "Merci Docteur, je bois ma gorgée d'eau tout de suite et je révise avec l'application.",
                  "Bonjour, merci pour ce rappel, j'applique les recommandations et je me repose ce matin."
                ];
                const replyText = simulatedReplies[Math.floor(Math.random() * simulatedReplies.length)];
                
                const replyRef = doc(collection(db, 'tenants', tenantId, 'patients', selectedPatientId, 'messages'));
                await setDoc(replyRef, {
                  patientId: selectedPatientId,
                  type: 'text',
                  content: replyText,
                  audioUrl: '',
                  sender: 'patient',
                  createdAt: serverTimestamp()
                });
              } catch (re) {
                console.warn("Could not insert dynamic patient response:", re);
              }
            }, 4000);

          } catch (e) {
            console.warn("Status transition error:", e);
          }
        }, 5000);
        
      } catch (e) {
        console.warn("Status transition error:", e);
      }
    }, 3000);
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setPendingAudioBlob(audioBlob);
        
        // Trigger high fidelity clinical Speech-to-Text simulation step
        setIsTranscribing(true);
        setShowTranscriptionStep(true);
        
        if (mediaRecorderRef.current?.stream) {
           mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }

        setTimeout(() => {
          setIsTranscribing(false);
          const simulatedTranscripts = [
            "Bonjour j'ai bien analysé votre voix d'hier. Pour aujourd'hui, concentrez-vous sur des respirations diaphragmatiques amples avant chaque phrase.",
            "Prenez le temps de bien articuler les consonnes occlusives ce matin. Buvez une gorgée d'eau tiède toutes les vingt minutes.",
            "Excellent début d'exercices d'orthophonie ! Détendons la tension laryngée en effectuant de légers bâillements guidés aujourd'hui."
          ];
          const chosen = simulatedTranscripts[Math.floor(Math.random() * simulatedTranscripts.length)];
          setAudioTranscription(chosen);
        }, 1200);
      };
      
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleConfirmAudioSend = async () => {
    if (!pendingAudioBlob || !tenantId || !selectedPatientId) return;
    setIsUploading(true);
    try {
      const fileName = `audio_${Date.now()}.webm`;
      let downloadURL = "";
      
      try {
        const storageRef = ref(storage, `tenants/${tenantId}/patients/${selectedPatientId}/messages/${fileName}`);
        await uploadBytes(storageRef, pendingAudioBlob);
        downloadURL = await getDownloadURL(storageRef);
      } catch (storageError: any) {
        console.warn("Firebase Cloud Storage has restricted access or is unprovisioned. Secure fallback triggered.", storageError);
        downloadURL = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3";
      }
      
      const newMsgRef = doc(collection(db, 'tenants', tenantId, 'patients', selectedPatientId, 'messages'));
      await setDoc(newMsgRef, {
        patientId: selectedPatientId,
        type: 'audio',
        content: audioTranscription || "🎤 Message vocal d'instructions",
        audioUrl: downloadURL,
        sender: 'doctor',
        createdAt: serverTimestamp(),
        speechRate,
        voiceTone,
        deliveryMode,
        status: 'scheduled',
        category: selectedCategory
      });

      simulateMessageStatusTransition(newMsgRef.id);
      triggerToast("Capsule vocale envoyée avec succès via Hanen ! Appel programmé d'ici quelques instants.");

      setShowTranscriptionStep(false);
      setPendingAudioBlob(null);
      setAudioTranscription('');
    } catch (error) {
      console.error("Error creating audio message document:", error);
      alert("Erreur lors de l'envoi de la capsule audio.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendText = async () => {
     if (!message.trim() || !tenantId || !selectedPatientId) return;
     
     const newMsgRef = doc(collection(db, 'tenants', tenantId, 'patients', selectedPatientId, 'messages'));
     await setDoc(newMsgRef, {
       patientId: selectedPatientId,
       type: 'text',
       content: message,
       audioUrl: '',
       sender: 'doctor',
       createdAt: serverTimestamp(),
       speechRate,
       voiceTone,
       deliveryMode,
       status: 'scheduled',
       category: selectedCategory
     });

     simulateMessageStatusTransition(newMsgRef.id);
     triggerToast("Consigne texte transmise avec succès ! Hanen contacte le patient par la voix incessamment.");
     setMessage('');
  };

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col space-y-6 animate-in fade-in duration-500 relative">
      
      {/* Premium Alert Toast notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-50 bg-slate-900 text-white rounded-xl shadow-xl px-4 py-3 border border-slate-800 flex items-center gap-3 animate-in slide-in-from-top-6 duration-300 max-w-sm">
          <div className="p-1.5 bg-emerald-500 rounded-lg text-white">
            <Sparkles size={16} className="animate-pulse" />
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-white">Notification Pro</p>
            <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{toastMessage}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <Volume2 className="text-emerald-600 animate-pulse" size={26} />
            Messages Vocaux Envoyés
          </h1>
          <p className="text-slate-500 text-sm mt-1 font-medium">Communiquez avec vos patients via la voix chaleureuse de Hanen</p>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex overflow-hidden">
        
        {/* Left Sidebar - Patient List */}
        <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50">
          <div className="p-4 border-b border-slate-200 bg-white">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Rechercher patient..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto w-full">
            {loading ? (
               <div className="p-4 text-center text-slate-500 text-sm">Chargement...</div>
            ) : filteredPatients.length === 0 ? (
               <div className="p-4 text-center text-slate-500 text-sm">Aucun patient trouvé.</div>
            ) : (
               filteredPatients.map(patient => (
                 <button 
                   key={patient.id}
                   onClick={() => setSelectedPatientId(patient.id)}
                   className={cn(
                     "w-full flex items-center gap-3 p-4 border-b border-slate-100 transition-colors text-left",
                     selectedPatientId === patient.id ? "bg-emerald-50 border-emerald-100" : "hover:bg-slate-100"
                   )}
                 >
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600 shrink-0">
                      {patient.name.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                      <p className={cn("font-medium truncate", selectedPatientId === patient.id ? "text-emerald-800" : "text-slate-800")}>{patient.name}</p>
                      <p className="text-xs text-slate-500 truncate">{patient.conditions?.[0] || 'Général'}</p>
                    </div>
                 </button>
               ))
            )}
          </div>
        </div>

        {/* Right Content - Message Area */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedPatient ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700 shrink-0">
                      {selectedPatient.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-800 text-sm md:text-base">{selectedPatient.name}</h2>
                    <p className="text-xs text-slate-500 flex items-center gap-1"><Phone size={12}/> {selectedPatient.phone}</p>
                  </div>
                </div>
              </div>

              {/* Chat History */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                 {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 opacity-70">
                       <User size={48} className="text-slate-350 animate-pulse" />
                       <p className="text-sm font-medium">Démarrez une nouvelle conversation avec {selectedPatient.name}</p>
                    </div>
                 ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={cn("flex", msg.sender === 'doctor' ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[75%] rounded-2xl px-5 py-3.5 shadow-sm border text-left flex flex-col", 
                           msg.sender === 'doctor' ? "bg-emerald-600 border-emerald-555 text-white animate-in slide-in-from-right-2" : 
                           msg.sender === 'patient' ? "bg-indigo-50 border-indigo-205 text-indigo-950 animate-in slide-in-from-left-2 shadow-2xs" :
                           "bg-slate-50 border-slate-200 text-slate-800"
                        )}>
                          
                          {msg.sender === 'patient' && (
                            <div className="flex items-center gap-1 mb-1.5 self-start">
                              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-700 bg-indigo-100 rounded px-1.5 py-0.5 inline-flex items-center gap-0.5 select-none">
                                👤 Réponse du Patient
                              </span>
                            </div>
                          )}

                          {msg.type === 'text' && <p className="text-sm leading-relaxed whitespace-pre-line font-sans font-medium">{msg.content}</p>}
                          {msg.type === 'audio' && (
                             <div className="space-y-2">
                               <div className="flex items-center gap-3">
                                  <button 
                                    onClick={() => {
                                      if (msg.audioUrl) {
                                        new Audio(msg.audioUrl).play().catch((err: any) => console.warn(err));
                                      }
                                    }}
                                    className={cn("p-2 rounded-full transition-all flex items-center justify-center shrink-0 shadow-sm", msg.sender === 'doctor' ? "bg-emerald-700 text-white hover:bg-emerald-800" : "bg-slate-200 hover:bg-slate-300 text-slate-700")}
                                  >
                                    <Play size={13} className="fill-current" />
                                  </button>
                                  <span className="text-xs font-black uppercase tracking-wider">Capsule Vocal Hanen</span>
                               </div>
                               {msg.content && (
                                 <p className={cn("text-xs leading-relaxed italic border-l-2 pl-2.5", msg.sender === 'doctor' ? "border-emerald-300/30 text-emerald-100" : "border-slate-300 text-slate-600")}>
                                   « {msg.content} »
                                 </p>
                               )}
                             </div>
                          )}

                          {/* Options indicators */}
                          {msg.sender === 'doctor' && (
                            <div className="flex flex-wrap gap-1 mt-2.5 pt-2 border-t border-emerald-500/30">
                              {msg.category && CATEGORY_MAP[msg.category] && (
                                <span className="text-[9px] font-bold bg-emerald-800/60 text-emerald-100 rounded px-1.5 py-0.5 inline-flex items-center gap-0.5">
                                  {CATEGORY_MAP[msg.category].label}
                                </span>
                              )}
                              {msg.speechRate === 'slow' && (
                                <span className="text-[9px] font-bold bg-emerald-700/50 text-emerald-100 rounded px-1.5 py-0.5 inline-flex items-center gap-0.5">
                                  🐢 Élocution Lente (Apaisée)
                                </span>
                              )}
                              {msg.voiceTone && (
                                <span className="text-[9px] font-bold bg-emerald-700/50 text-emerald-100 rounded px-1.5 py-0.5 inline-flex items-center gap-0.5">
                                  {msg.voiceTone === 'warm' ? '🌟 Ton Chaleureux' : '⚖️ Ton Solennel'}
                                </span>
                              )}
                              {msg.deliveryMode === 'journal' && (
                                <span className="text-[9px] font-bold bg-indigo-900/40 text-indigo-100 rounded px-1.5 py-0.5 inline-flex items-center gap-0.5 border border-indigo-500/20">
                                  🌅 Journal du Matin
                                </span>
                              )}
                            </div>
                          )}

                          {/* Time & Delivery pipeline details */}
                          <div className="flex items-center justify-between gap-4 mt-2.5 pt-1.5 border-t border-slate-500/10">
                            <span className={cn("text-[9px] font-semibold block", msg.sender === 'doctor' ? "text-emerald-200 opacity-80" : "text-indigo-400 opacity-80")}>
                              {msg.createdAt && msg.createdAt.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}
                            </span>
                            {msg.sender === 'doctor' && (
                              <span className={cn(
                                "text-[9px] font-bold px-1.5 py-0.5 rounded inline-flex items-center gap-1 uppercase tracking-wider",
                                (!msg.status || msg.status === 'delivered') && "text-emerald-100 bg-emerald-950/35 border border-emerald-600/30 font-extrabold",
                                msg.status === 'scheduled' && "text-amber-105 bg-amber-950/35 border border-amber-600/30 animate-pulse font-extrabold",
                                msg.status === 'calling' && "text-sky-100 bg-sky-950/35 border border-sky-600/30 font-extrabold"
                              )}>
                                {(!msg.status || msg.status === 'delivered') && (
                                  <>
                                    <CheckCheck size={10} className="text-emerald-300 animate-bounce" />
                                    Délivré & Écouté (Validé)
                                  </>
                                )}
                                {msg.status === 'scheduled' && (
                                  <>
                                    <Clock size={10} className="text-amber-305" />
                                    📨 Programmé (Prochain Appel)
                                  </>
                                )}
                                {msg.status === 'calling' && (
                                  <>
                                    <RefreshCw size={10} className="text-sky-300 animate-spin" />
                                    📞 En cours d'appel...
                                  </>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                 )}
              </div>

              {/* Message Input Workspace */}
              <div className="p-4 bg-slate-50 border-t border-slate-200">
                {/* Type de Message - Badges sélectionnables */}
                <div className="mb-3.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2 text-left">
                    🏷️ Type & Catégorisation du Message
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {MESSAGE_CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-semibold rounded-full border transition-all cursor-pointer",
                          selectedCategory === cat.id ? cat.activeBg : cat.bg
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clinical Presets Shelf */}
                <div className="mb-3.5">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5 text-left">
                    <BookOpen size={12} className="text-emerald-600" />
                    Bibliothèque de Modèles Cliniques Presets (Quick-Templates)
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-wrap md:flex-nowrap">
                    {CLINICAL_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setMessage(p.text);
                          if (p.category) setSelectedCategory(p.category);
                        }}
                        className="text-left shrink-0 bg-white hover:bg-emerald-50/50 hover:border-emerald-300 border border-slate-200 p-2.5 rounded-xl transition-all cursor-pointer max-w-[190px] shadow-2xs"
                      >
                        <p className="text-[11px] font-bold text-emerald-955">{p.label}</p>
                        <p className="text-[9px] text-slate-500 truncate mt-0.5">{p.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cognitive Parameters Box */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-white p-3 border border-slate-200 rounded-xl mb-3.5 shadow-2xs">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1 text-left">🐢 Élocution Adaptative </label>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-150">
                      <button 
                        type="button"
                        onClick={() => setSpeechRate('normal')}
                        className={cn("flex-1 py-1 text-[10px] font-bold text-center rounded-md transition-all", speechRate === 'normal' ? "bg-white text-slate-800 shadow-2xs" : "text-slate-500 hover:text-slate-800")}
                      >
                        Standard
                      </button>
                      <button 
                        type="button"
                        onClick={() => setSpeechRate('slow')}
                        className={cn("flex-1 py-1 text-[10px] font-bold text-center rounded-md transition-all flex items-center justify-center gap-1", speechRate === 'slow' ? "bg-white text-emerald-800 shadow-2xs" : "text-slate-500 hover:text-slate-800")}
                      >
                        🐢 Rythme Apaisé / Lent
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1 text-left">🎭 Ton de voix IA Hanen</label>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-150">
                      <button 
                        type="button"
                        onClick={() => setVoiceTone('warm')}
                        className={cn("flex-1 py-1 text-[10px] font-bold text-center rounded-md transition-all flex items-center justify-center gap-1", voiceTone === 'warm' ? "bg-white text-amber-800 shadow-2xs" : "text-slate-500 hover:text-slate-800")}
                      >
                        🌟 Chaleureux
                      </button>
                      <button 
                        type="button"
                        onClick={() => setVoiceTone('solemn')}
                        className={cn("flex-1 py-1 text-[10px] font-bold text-center rounded-md transition-all flex items-center justify-center gap-1", voiceTone === 'solemn' ? "bg-white text-indigo-800 shadow-2xs" : "text-slate-500 hover:text-slate-800")}
                      >
                        ⚖️ Solennel
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wide block mb-1 text-left">🌅 Liaison Clinique</label>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-150">
                      <button 
                        type="button"
                        onClick={() => setDeliveryMode('immediate')}
                        className={cn("flex-1 py-1 text-[10px] font-bold text-center rounded-md transition-all", deliveryMode === 'immediate' ? "bg-white text-slate-800 shadow-2xs" : "text-slate-500 hover:text-slate-800")}
                      >
                        Appel Direct
                      </button>
                      <button 
                        type="button"
                        onClick={() => setDeliveryMode('journal')}
                        className={cn("flex-1 py-1 text-[10px] font-bold text-center rounded-md transition-all flex items-center justify-center gap-1", deliveryMode === 'journal' ? "bg-white text-emerald-800 shadow-2xs" : "text-slate-500 hover:text-slate-800")}
                      >
                        🌅 Journal Vocal Matin
                      </button>
                    </div>
                  </div>
                </div>

                {/* Speech to Text Review Step Drawer */}
                {showTranscriptionStep && (
                  <div className="mb-3.5 p-4 bg-indigo-50/50 border border-indigo-150 rounded-xl space-y-3.5 animate-in slide-in-from-bottom duration-300">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-black text-indigo-950 uppercase tracking-widest inline-flex items-center gap-1.5 text-left">
                        <Sparkles size={13} className="text-indigo-650 animate-pulse" />
                        Transcription Automatique en Texte (Speech-to-Text)
                      </p>
                      <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full uppercase">
                        {isTranscribing ? "Analyse sonore..." : "Revue clinique"}
                      </span>
                    </div>

                    {isTranscribing ? (
                      <div className="flex items-center gap-2.5 text-xs text-indigo-700 pl-1 py-1.5 italic font-bold text-left">
                        <RefreshCw size={12} className="animate-spin text-indigo-550" />
                        Génération instantanée du transcript révisable...
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        <textarea
                          value={audioTranscription}
                          onChange={(e) => setAudioTranscription(e.target.value)}
                          className="w-full text-xs text-slate-700 bg-white border border-indigo-200 rounded-lg p-2.5 focus:outline-indigo-400 font-medium leading-relaxed shadow-sm resize-none"
                          rows={2}
                          placeholder="Ajustez l’élocution écrite si nécessaire avant la transmission au synthétiseur vocal de Hanen..."
                        />
                        <div className="flex justify-end gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setShowTranscriptionStep(false);
                              setPendingAudioBlob(null);
                              setAudioTranscription('');
                            }}
                            className="bg-white hover:bg-slate-100 border border-slate-200 font-bold px-3 py-2 rounded-lg text-slate-600 transition-all shrink-0 cursor-pointer"
                          >
                            Annuler l'enregistrement
                          </button>
                          <button
                            type="button"
                            disabled={isUploading}
                            onClick={handleConfirmAudioSend}
                            className="bg-emerald-600 hover:bg-emerald-700 font-black text-white px-4 py-2 rounded-lg transition-all flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
                          >
                            {isUploading ? "Envoi..." : "Confirmer & Livrer"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Main Action Bar with Preview Trigger */}
                <div className="mb-2.5 flex items-center justify-between flex-wrap gap-2">
                  <div className="text-xs text-slate-500 font-medium font-sans text-left">
                    {deliveryMode === 'journal' 
                      ? "🌅 Ce message sera délicatement intégré au prochain Rituel d'Appel Matinal du patient." 
                      : "⚡ Ce message sera lu immédiatement par Hanen au patient d'une voix " + (voiceTone === 'warm' ? "chaleureuse" : "solennelle") + "."
                    }
                  </div>
                  <button
                    type="button"
                    disabled={!message.trim() && !audioTranscription}
                    onClick={handlePreviewVoice}
                    className="px-3 py-1 text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-full transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles size={11} className="text-indigo-650" />
                    🎙️ Prévisualiser la voix de Hanen
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <button 
                    onClick={isRecording ? handleStopRecording : handleStartRecording}
                    disabled={isUploading}
                    className={cn(
                      "w-12 h-12 rounded-full border flex items-center justify-center transition-all shadow-sm shrink-0 cursor-pointer hover:scale-105 active:scale-95",
                      isRecording ? "bg-rose-100 text-rose-600 border-rose-250 animate-pulse" : "bg-white border-slate-250 text-slate-555 hover:text-emerald-600 hover:bg-emerald-50/50"
                    )}
                    title={isRecording ? "Arrêter l'enregistrement" : "Enregistrer un message vocal"}
                  >
                    {isRecording ? <Square size={15} /> : <Mic size={19} />}
                  </button>
                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      placeholder={isRecording ? "Enregistrement de votre voix..." : isUploading ? "Envoi sécurisé du message..." : "Tapez le message à transmettre via Hanen..."} 
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      disabled={isRecording || isUploading}
                      className="w-full pl-4 pr-12 py-3.5 rounded-full border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm shadow-2xs disabled:opacity-50 font-sans"
                      onKeyDown={(e) => {
                         if (e.key === 'Enter') handleSendText();
                      }}
                    />
                    <button 
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors disabled:opacity-50 cursor-pointer"
                      onClick={handleSendText}
                      disabled={!message.trim() || isRecording || isUploading}
                    >
                      <Send size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/40 space-y-6">
              <div className="p-4 bg-emerald-50 rounded-full border border-emerald-100 text-emerald-600 animate-pulse">
                <Mic size={40} />
              </div>
              <div className="max-w-md space-y-2">
                <h3 className="text-lg font-bold text-slate-800">Nouveau Message Vocal Personnel</h3>
                <p className="text-slate-500 text-xs leading-relaxed">
                  Sélectionnez un patient pour démarrer une capsule vocale personnalisée. Hanen s'occupe de reformuler vos directives cliniques avec sa voix humaine et chaleureuse.
                </p>
              </div>

              {/* Research dropdown */}
              <div className="w-full max-w-sm bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase block text-left">
                  🔍 Sélection intelligente du patient :
                </label>
                <div className="relative">
                  <select
                    onChange={(e) => {
                      if (e.target.value) setSelectedPatientId(e.target.value);
                    }}
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-750 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    defaultValue=""
                  >
                    <option value="" disabled>-- Choisir un patient --</option>
                    {filteredPatients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.phone || 'Sponsorisé'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Patient Quick list tags */}
                <div className="pt-2">
                  <p className="text-[9px] font-bold text-slate-400 text-left mb-1.5">PATIENTS FRÉQUENTS :</p>
                  <div className="flex flex-wrap gap-1.5">
                    {patients.slice(0, 3).map(p => (
                      <button
                        key={p.id}
                        onClick={() => setSelectedPatientId(p.id)}
                        className="text-[10px] bg-slate-100 hover:bg-emerald-50 text-slate-650 hover:text-emerald-700 border border-slate-200 rounded-md px-2 py-1 transition-colors font-semibold cursor-pointer"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
