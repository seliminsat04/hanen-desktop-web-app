// Messages board
import React, { useState, useEffect, useRef } from 'react';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { Patient } from '../types';
import { 
  Search, Mic, StopCircle, RefreshCw, Sparkles, 
  Play, Send, Youtube, Paperclip, FileText, Check, 
  AlertCircle, ChevronDown, Clock, User, X, PhoneOff, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { doc, setDoc, serverTimestamp, collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../AuthContext';

// --- Types ---
interface Message {
  id: string;
  patientId: string;
  type: 'text' | 'ai_composite';
  content: string;
  videoLink?: string | null;
  attachedFile?: string | null;
  sender: 'doctor' | 'hanen' | 'patient';
  createdAt: any;
  status?: 'scheduled' | 'calling' | 'delivered';
}

const COLORS = {
  navy: '#0F1E36',
  terracotta: '#E07A5F',
  sage: '#5C7F67',
  cream: '#FAF6F0'
};

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 1024) {
    const chunk = bytes.subarray(i, Math.min(i + 1024, len));
    binary += String.fromCharCode.apply(null, chunk as any);
  }
  return btoa(binary);
}

function downsample(buffer: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) {
    return buffer;
  }
  if (fromRate < toRate) {
    return buffer;
  }
  const sampleRateRatio = fromRate / toRate;
  const newLength = Math.round(buffer.length / sampleRateRatio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetBuffer = 0;
  while (offsetResult < result.length) {
    const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
    let accum = 0;
    let count = 0;
    for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
      accum += buffer[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetBuffer = nextOffsetBuffer;
  }
  return result;
}

export function Messages() {
  const { tenantId } = useAuth();
  const { data: patients, loading } = useFirestoreData<Patient>('patients');
  
  // App State
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // AI Assistant States (idle, listening, processing, review)
  const [aiState, setAiState] = useState<'idle' | 'listening' | 'processing' | 'review'>('idle');
  const [generatedText, setGeneratedText] = useState('');
  const [suggestedVideo, setSuggestedVideo] = useState<{title: string, url: string, thumbnailUrl?: string} | null>(null);
  const [attachedContext, setAttachedContext] = useState<string | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const selectedPatient = patients.find(p => p.id === selectedPatientId);

  const playSpecificMessageAudio = async (msgId: string, text: string) => {
    try {
      setPlayingMessageId(msgId);
      const res = await fetch('/api/generate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (!res.ok) {
        throw new Error(`Erreur TTS (code ${res.status})`);
      }
      const data = await res.json();
      if (data.audio) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const binary = atob(data.audio);
        const arrayBuffer = new ArrayBuffer(binary.length);
        const view = new Uint8Array(arrayBuffer);
        for (let i = 0; i < binary.length; i++) {
          view[i] = binary.charCodeAt(i);
        }

        // Keep a copy of the buffer as decodeAudioData is destructive (neuters)
        const arrayBufferCopy = arrayBuffer.slice(0);
        const viewCopy = new Uint8Array(arrayBufferCopy);

        try {
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioCtx.destination);
          source.start(0);
          source.onended = () => setPlayingMessageId(null);
        } catch (decodeErr) {
          const pcmFloat = new Float32Array(viewCopy.length / 2);
          const dataView = new DataView(arrayBufferCopy);
          for (let i = 0; i < pcmFloat.length; i++) {
            pcmFloat[i] = dataView.getInt16(i * 2, true) / 32768.0;
          }
          const buffer = audioCtx.createBuffer(1, pcmFloat.length, 24000);
          buffer.getChannelData(0).set(pcmFloat);
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          source.start();
          source.onended = () => setPlayingMessageId(null);
        }
      } else {
        alert("Erreur: Pas d'audio reçu");
        setPlayingMessageId(null);
      }
    } catch (err) {
      console.error("TTS preview error:", err);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'fr-FR'; 
        utterance.onend = () => setPlayingMessageId(null);
        window.speechSynthesis.speak(utterance);
      } else {
        setPlayingMessageId(null);
      }
    }
  };

  // Focus latest messages
  useEffect(() => {
    if (!tenantId || !selectedPatientId) {
       setMessages([]);
       return;
    }
    const q = query(
      collection(db, 'tenants', tenantId, 'patients', selectedPatientId, 'messages'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
       const msgs: Message[] = [];
       snap.forEach(d => msgs.push({ id: d.id, ...d.data() } as Message));
       setMessages(msgs);
    });
    return () => unsubscribe();
  }, [tenantId, selectedPatientId]);

  // --- Gemini Real-Time Live Session ---
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  
  // Speech Recognition for recording transcript
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");

  const cleanupAudio = () => {
    if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch(e) {}
        recognitionRef.current = null;
    }
    activeSourcesRef.current.forEach(src => {
        try { src.stop(); } catch(e) {}
    });
    activeSourcesRef.current = [];
    
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
    }
    if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
    }
    if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
    }
  };

  const handleStartLive = async () => {
    if (!selectedPatientId || !selectedPatient) {
      alert("Veuillez sélectionner un patient d'abord.");
      return;
    }
    setAiState('listening');
    transcriptRef.current = "";

    try {
      const dateStr = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
      const docName = "Docteur"; 
      
      const sysPrompt = `Vous êtes Hanen (voix féminine Zephyr, douce, rassurante). \
Nous sommes le ${dateStr}. Vous assistez le ${docName}. \
Patient évalué actuellement: ${selectedPatient.name}, ${selectedPatient.age} ans, souffrant de: ${selectedPatient.conditions?.[0] || 'Non renseigné'}. \
RÈGLES DE LANGAGE TRÈS STRICTES (Le Français Majestueux en retour) : \
Vous comprenez tout (dialecte tunisien darija, arabe pur, français, etc.). \
Cependant, le prompt oblige strictement Hanen à ne formuler ses réponses et à ne rédiger ses "traductions cliniques" au patient qu'en français clair, professionnel et bienveillant. \
La règle est : "Comprends tout, mais ne réponds et ne rédige qu'en excellent français." \
Saluez d'abord le docteur avec une phrase d'accueil TRÈS COURTE en indiquant que vous êtes prête pour ce patient. \
Écoutez ses consignes vocales. \
Ensuite, formulez CLAIREMENT ET EN DÉTAIL le message éducatif ou l'instruction médicamenteuse qui sera transmis au patient, toujours en excellent français.`;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = new URL(`${protocol}//${window.location.host}/live`);
      url.searchParams.set("sysPrompt", sysPrompt);

      const ws = new WebSocket(url.toString());
      wsRef.current = ws;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      nextStartTimeRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;

      // Force resume since getUserMedia is an async browser sandbox transition
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      // Start Web Speech API for transcript
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'fr-FR'; 
          
          recognition.onresult = (event: any) => {
              let currentTranscript = '';
              for (let i = 0; i < event.results.length; i++) {
                  currentTranscript += event.results[i][0].transcript + ' ';
              }
              transcriptRef.current = currentTranscript;
          };
          recognition.start();
          recognitionRef.current = recognition;
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(audioCtx.destination);

      const inputSampleRate = audioCtx.sampleRate;
      const targetSampleRate = 16000;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        const pcmData = e.inputBuffer.getChannelData(0);
        
        // Robust downsampling to 16000Hz (highly compatible with Gemini Live API audio input specs)
        const downsampled = downsample(pcmData, inputSampleRate, targetSampleRate);
        
        // Convert Float32Array to 16bit signed PCM
        const buffer = new ArrayBuffer(downsampled.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < downsampled.length; i++) {
          const s = Math.max(-1, Math.min(1, downsampled[i]));
          view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        
        const bytes = new Uint8Array(buffer);
        const base64 = uint8ArrayToBase64(bytes);
        wsRef.current.send(JSON.stringify({ audio: base64 }));
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.interrupted) {
            console.log("[Client] Gemini interrupted the active playback.");
            nextStartTimeRef.current = audioCtx.currentTime;
            // Purge currently playing sources to achieve real "barge-in"
            activeSourcesRef.current.forEach(src => {
              try { src.stop(); } catch(e) {}
            });
            activeSourcesRef.current = [];
          }
          if (msg.audio) {
            const base64 = msg.audio;
            const binaryString = atob(base64);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Alignment-safe and robust 16-bit signed PCM decoder
            const samplesCount = Math.floor(bytes.length / 2);
            const float32Array = new Float32Array(samplesCount);
            for (let i = 0; i < samplesCount; i++) {
              const byte0 = bytes[i * 2];
              const byte1 = bytes[i * 2 + 1];
              let val = byte0 | (byte1 << 8);
              if (val & 0x8000) {
                val |= ~0xffff; // sign extension for 16-bit signed values
              }
              float32Array[i] = val / 32768.0;
            }
            
            const audioBuffer = audioCtx.createBuffer(1, float32Array.length, 24000);
            audioBuffer.getChannelData(0).set(float32Array);
            
            const src = audioCtx.createBufferSource();
            src.buffer = audioBuffer;
            src.connect(audioCtx.destination);
            
            src.onended = () => {
               activeSourcesRef.current = activeSourcesRef.current.filter(s => s !== src);
            };
            activeSourcesRef.current.push(src);

            const currentTime = audioCtx.currentTime;
            if (nextStartTimeRef.current < currentTime) {
              nextStartTimeRef.current = currentTime + 0.05; // minimized queue delay for snappy, ultra-natural conversation
            }
            src.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuffer.duration;
          }
        } catch (parsingErr) {
          console.error("[Client] Error parsing incoming websocket message:", parsingErr);
        }
      };

      ws.onclose = (event) => {
        console.warn(`[Client] Live WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
        if (event.code !== 1000) {
          console.error("Live WebSocket connection closed with warning or error.", event);
        }
        // Ensure UI doesn't hang in listening or processing state if the connection is terminated
        setAiState('idle');
      };

      ws.onerror = (e) => {
        console.error("Live API WS Error:", e);
        alert("Erreur de connexion Live API.");
        handleStopLive(true);
      };

    } catch (e) {
      console.error(e);
      alert("Erreur d'accès au micro");
      setAiState('idle');
    }
  };

  const handleStopLive = async (isError = false) => {
    // Capture transcript right before cleanup stops speech recognition
    const finalTranscript = transcriptRef.current;
    
    cleanupAudio();
    if (isError) {
      setAiState('idle');
      return;
    }
    
    setAiState('processing');
    
    // Call the real API to generate a draft message
    try {
      const res = await fetch('/api/draft-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient: selectedPatient, transcript: finalTranscript })
      });
      if (!res.ok) throw new Error('Failed to generate draft');
      const data = await res.json();
      
      setGeneratedText(data.draft);
      setSuggestedVideo({
        title: data.videoTitle,
        url: data.videoUrl,
        thumbnailUrl: data.thumbnailUrl
      });
      setAiState('review');
    } catch (err) {
      console.error(err);
      // Fallback empty if generation fails
      setGeneratedText(`Bonjour ${selectedPatient?.name.split(' ')[0] || 'Madame / Monsieur'}, c'est l'assistante Hanen. Le docteur m'a chargée de vous rappeler votre consigne de la journée. N'oubliez pas votre traitement, c'est important.`);
      setSuggestedVideo(null);
      setAiState('review');
    }
  };

  useEffect(() => {
     return () => cleanupAudio();
  }, []);

  const playPreview = async () => {
    try {
      setIsPlayingPreview(true);
      const res = await fetch('/api/generate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: generatedText })
      });
      if (!res.ok) {
        throw new Error(`Erreur TTS (code ${res.status})`);
      }
      const data = await res.json();
      if (data.audio) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const binary = atob(data.audio);
        const arrayBuffer = new ArrayBuffer(binary.length);
        const view = new Uint8Array(arrayBuffer);
        for (let i = 0; i < binary.length; i++) {
          view[i] = binary.charCodeAt(i);
        }
        
        // Keep a copy because decodeAudioData is destructive (neuters)
        const arrayBufferCopy = arrayBuffer.slice(0);
        const viewCopy = new Uint8Array(arrayBufferCopy);

        try {
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          const source = audioCtx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioCtx.destination);
          source.start(0);
          source.onended = () => setIsPlayingPreview(false);
        } catch (decodeErr) {
          // Fallback if raw PCM (16-bit 24kHz)
          const pcmFloat = new Float32Array(viewCopy.length / 2);
          const dataView = new DataView(arrayBufferCopy);
          for (let i = 0; i < pcmFloat.length; i++) {
            pcmFloat[i] = dataView.getInt16(i * 2, true) / 32768.0;
          }
          const buffer = audioCtx.createBuffer(1, pcmFloat.length, 24000);
          buffer.getChannelData(0).set(pcmFloat);
          const source = audioCtx.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtx.destination);
          source.start();
          source.onended = () => setIsPlayingPreview(false);
        }
      } else {
        alert("Erreur: Pas d'audio reçu");
        setIsPlayingPreview(false);
      }
    } catch (err) {
      console.error("TTS preview error:", err);
      // Fallback to local
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(generatedText);
        utterance.lang = 'fr-FR'; 
        utterance.onend = () => setIsPlayingPreview(false);
        window.speechSynthesis.speak(utterance);
      } else {
        setIsPlayingPreview(false);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploadingFile(true);
      setTimeout(() => {
        setAttachedContext(file.name);
        setIsUploadingFile(false);
      }, 1200);
    }
  };

  const simulateMessageStatusTransition = (msgId: string) => {
    if (!tenantId || !selectedPatientId) return;
    setTimeout(async () => {
      try {
        const docRef = doc(db, 'tenants', tenantId, 'patients', selectedPatientId, 'messages', msgId);
        await setDoc(docRef, { status: 'calling' }, { merge: true });
        
        setTimeout(async () => {
          await setDoc(docRef, { status: 'delivered' }, { merge: true });
        }, 6000);
      } catch (e) { console.warn(e); }
    }, 2500);
  };

  const handleSendViaHanen = async () => {
    if (!tenantId || !selectedPatientId || !generatedText) return;
    
    const newMsgRef = doc(collection(db, 'tenants', tenantId, 'patients', selectedPatientId, 'messages'));
    await setDoc(newMsgRef, {
      patientId: selectedPatientId,
      type: 'ai_composite',
      content: generatedText,
      videoLink: suggestedVideo?.url || null,
      attachedFile: attachedContext || null,
      sender: 'doctor',
      createdAt: serverTimestamp(),
      status: 'scheduled'
    });

    simulateMessageStatusTransition(newMsgRef.id);
    resetAssistant();
  };

  const resetAssistant = () => {
    setAiState('idle');
    setGeneratedText('');
    setSuggestedVideo(null);
    setAttachedContext(null);
  };

  return (
    <div className="max-w-6xl mx-auto min-h-[calc(100vh-8rem)] pb-24 relative font-sans animate-in fade-in duration-500 flex flex-col md:flex-row gap-6">
      
      {/* 📱 LEFT COLUMN: Patient Selection & History */}
      <div className="w-full md:w-[350px] flex flex-col gap-4">
        {/* Patient Selector */}
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
            <User size={14} className="text-[#5C7F67]" /> Patient Cible
          </h2>
          <div className="relative">
            <select
              value={selectedPatientId || ""}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full appearance-none bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#5C7F67] pr-10 cursor-pointer"
            >
              <option value="" disabled>-- Sélectionner un patient --</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.name} (Âge: {p.age})</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>

          {selectedPatientId && selectedPatient && (
            <motion.div initial={{opacity:0, y:-10}} animate={{opacity:1, y:0}} className="mt-4 p-4 bg-[#FAF6F0] rounded-2xl border border-[#0F1E36]/5">
              <p className="text-sm font-bold text-[#0F1E36] mb-1">{selectedPatient.name}</p>
              <p className="text-xs text-slate-500 mb-3">{selectedPatient.conditions?.[0]}</p>
              <div className="flex flex-wrap gap-2">
                <span className="text-[9px] uppercase tracking-wider bg-white border border-[#E07A5F]/20 text-[#E07A5F] px-2 py-1 rounded-full font-bold shadow-sm">
                  Dignité: {selectedPatient.dignityIndex || 85}%
                </span>
                <span className="text-[9px] uppercase tracking-wider bg-white border border-[#5C7F67]/20 text-[#5C7F67] px-2 py-1 rounded-full font-bold shadow-sm">
                  Statut: {selectedPatient.voiceHealthStatus}
                </span>
              </div>
            </motion.div>
          )}
        </div>

        {/* Message History */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden max-h-[60vh]">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
              <Clock size={14} className="text-[#0F1E36]" /> Historique des Échanges
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!selectedPatientId ? (
              <div className="text-center text-slate-500 text-xs py-10 font-medium">
                Veuillez sélectionner un patient.
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-slate-500 text-xs py-10 font-medium">
                Aucun message récent.
              </div>
            ) : (
              messages.map(msg => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  key={msg.id} 
                  className={cn(
                    "p-3 rounded-2xl border shadow-sm flex flex-col gap-2 relative overflow-hidden",
                    msg.sender === 'doctor' ? "bg-white border-[#5C7F67]/20 ml-4" : "bg-[#FAF6F0] border-[#0F1E36]/10 mr-4"
                  )}
                >
                  <div className={cn("absolute top-0 left-0 w-1 h-full", msg.sender === 'doctor' ? "bg-[#5C7F67]" : "bg-[#E07A5F]")} />
                  
                  <div className="flex justify-between items-center pl-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {msg.sender === 'doctor' ? 'Capsule Envoyée' : 'Réponse Patient'}
                    </span>
                    <span className="text-[9px] font-bold text-slate-500">
                      {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 font-medium pl-2 leading-relaxed">
                    « {msg.content} »
                  </p>

                  {/* Badges for composite stuff */}
                  {(msg.videoLink || msg.attachedFile || msg.type === 'ai_composite') && (
                    <div className="flex gap-2 pl-2 mt-1 flex-wrap">
                      {msg.videoLink && <span className="text-[9px] flex items-center gap-1 text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100"><Youtube size={10}/> Vidéo</span>}
                      {msg.attachedFile && <span className="text-[9px] flex items-center gap-1 text-[#0F1E36] font-bold bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"><FileText size={10}/> Fichier</span>}
                      {msg.sender === 'doctor' && (
                        <button
                          onClick={() => playSpecificMessageAudio(msg.id, msg.content)}
                          disabled={playingMessageId === msg.id}
                          className="text-[9px] flex items-center gap-1 text-[#E07A5F] font-bold bg-[#E07A5F]/10 px-1.5 py-0.5 rounded border border-[#E07A5F]/20 hover:bg-[#E07A5F]/20 transition-colors"
                        >
                          {playingMessageId === msg.id ? <RefreshCw size={10} className="animate-spin" /> : <Play size={10} />}
                          Vocale Hanen
                        </button>
                      )}
                    </div>
                  )}

                  {msg.sender === 'doctor' && (
                    <div className="flex items-center gap-1 justify-end mt-1">
                      {(!msg.status || msg.status === 'delivered') && <span className="text-[9px] flex items-center gap-1 text-[#5C7F67] font-bold"><Check size={10}/> Écouté</span>}
                      {msg.status === 'calling' && <span className="text-[9px] flex items-center gap-1 text-sky-600 font-bold animate-pulse"><RefreshCw size={10}/> En cours...</span>}
                      {msg.status === 'scheduled' && <span className="text-[9px] flex items-center gap-1 text-[#E07A5F] font-bold"><Clock size={10}/> Programmé</span>}
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 🚀 RIGHT COLUMN: Main Composition Area (Gemini AI Review Panel) */}
      <div className="flex-1">
        {selectedPatientId ? (
          <div className="h-full">
            {aiState === 'review' ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-[32px] p-6 lg:p-10 border border-[#0F1E36]/10 shadow-xl relative overflow-hidden"
              >
                {/* Decorative background element */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#5C7F67]/10 to-transparent rounded-bl-full pointer-events-none" />

                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0F1E36] to-slate-800 flex items-center justify-center shadow-lg relative">
                    <Sparkles size={24} className="text-[#FAF6F0]" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#5C7F67] border-2 border-white rounded-full"></div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-extrabold text-[#0F1E36] tracking-tight">Copilote Hanen</h2>
                    <p className="text-xs font-bold text-[#E07A5F] uppercase tracking-widest mt-1">Brouillon IA Généré</p>
                  </div>
                </div>

                <div className="space-y-6 relative z-10">
                  {/* Text Review Box */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Traduction Clinique & Empathique</label>
                    <textarea 
                      value={generatedText}
                      onChange={(e) => setGeneratedText(e.target.value)}
                      className="w-full h-40 bg-[#FAF6F0] border-2 border-transparent focus:border-[#5C7F67]/30 focus:bg-white rounded-3xl p-5 text-sm text-[#0F1E36] font-medium leading-relaxed resize-none shadow-inner transition-all outline-none"
                    />
                  </div>

                  {/* Context Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* YouTube Suggestion Box */}
                    <div className="p-4 rounded-2xl border-2 border-rose-100 bg-rose-50/50 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-rose-500">
                        <Youtube size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Vidéo Pédagogique Associée</span>
                      </div>
                      {suggestedVideo ? (
                         <a href={suggestedVideo.url} target="_blank" rel="noopener noreferrer" className="block bg-white p-3 rounded-xl border border-rose-100 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                           {suggestedVideo.thumbnailUrl ? (
                             <img src={suggestedVideo.thumbnailUrl} alt="Thumbnail" className="w-16 h-12 object-cover rounded-md flex-shrink-0" />
                           ) : (
                             <div className="w-16 h-12 bg-rose-100 rounded-md flex-shrink-0 flex items-center justify-center">
                               <Youtube size={20} className="text-rose-400" />
                             </div>
                           )}
                           <div className="flex-1 min-w-0">
                             <div className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight">
                               {suggestedVideo.title}
                             </div>
                             <div className="text-[10px] text-slate-500 mt-1 uppercase font-semibold">Regarder la vidéo</div>
                           </div>
                         </a>
                      ) : (
                         <div className="text-xs text-rose-400 font-medium italic">Aucune vidéo suggérée.</div>
                      )}
                    </div>

                    {/* Attachment Box */}
                    <div className={cn("p-4 rounded-2xl border-2 flex flex-col gap-2", attachedContext ? "border-[#0F1E36]/10 bg-slate-50" : "border-dashed border-slate-200 bg-white")}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Paperclip size={16} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Contexte Visuel (PDF/Image)</span>
                        </div>
                        
                        {!attachedContext && (
                          <label className="cursor-pointer bg-[#0F1E36] text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors">
                            {isUploadingFile ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} className="rotate-90" />}
                            <input type="file" className="hidden" accept=".pdf,image/*" onChange={handleFileUpload} />
                          </label>
                        )}
                      </div>
                      {attachedContext ? (
                         <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                           <span className="text-xs font-bold text-[#0F1E36] truncate">{attachedContext}</span>
                           <button onClick={() => setAttachedContext(null)} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                         </div>
                      ) : (
                         <div className="text-[10px] text-slate-500 font-medium">Optionnel : Attachez le résumé clinique à lire.</div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 mt-4 border-t border-slate-100">
                    <button 
                      onClick={resetAssistant}
                      className="px-6 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-100 transition-colors text-sm"
                    >
                      Annuler
                    </button>
                    
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button 
                        onClick={playPreview}
                        disabled={isPlayingPreview}
                        className="px-5 py-3 rounded-2xl font-bold bg-[#0F1E36] text-white hover:bg-slate-800 transition-colors text-sm flex items-center gap-2 flex-1 sm:flex-none justify-center shadow-lg"
                      >
                        {isPlayingPreview ? <RefreshCw className="animate-spin" size={16} /> : <Play size={16} />}
                        Prévisualiser
                      </button>
                      
                      <button 
                        onClick={handleSendViaHanen}
                        className="px-6 py-3 rounded-2xl font-bold bg-[#E07A5F] text-white hover:bg-[#C96F53] transition-colors text-sm flex items-center gap-2 flex-1 sm:flex-none justify-center shadow-lg shadow-[#E07A5F]/30"
                      >
                        <Send size={16} />
                        Envoyer via Hanen
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-10 bg-white shadow-sm border border-slate-200 rounded-[32px]">
                
                <h3 className="text-xl font-extrabold text-[#0F1E36] mb-8">Assistant Vocal IA</h3>
                
                <div className="w-32 h-32 mb-8 relative">
                  <div className="absolute inset-0 bg-[#E8C547]/90 rounded-full scale-[1.05] shadow-inner"></div>
                  <img 
                    src="/img_hanen_avatar.png" 
                    alt="Hanen" 
                    className="relative w-full h-full object-cover rounded-full border-4 border-white shadow-md bg-[#FAF6F0]" 
                  />
                </div>
                
                <p className="text-sm font-medium text-slate-500 max-w-sm leading-relaxed mb-8">
                  Ne tapez plus vos messages. Parlez naturellement, Hanen s'occupe de reformuler vos consignes avec bienveillance pour le patient.
                </p>
                
                <button 
                  onClick={handleStartLive}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 text-lg rounded-2xl transition-all duration-300 flex items-center gap-3 w-64 justify-center shadow-md hover:shadow-blue-500/30 hover:-translate-y-1"
                >
                  <Phone size={24} className="text-white" />
                  Appeler Hanen
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full border-2 border-dashed border-slate-200 rounded-[32px] flex items-center justify-center text-slate-500 font-bold p-10 text-center bg-white/30 text-sm">
            Veuillez sélectionner un patient à gauche pour démarrer la messagerie assistée.
          </div>
        )}
      </div>

      {/* 🔴 OVERLAY: Gemini Live "Listening" Modal */}
      <AnimatePresence>
        {aiState === 'listening' || aiState === 'processing' ? (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F1E36]/30 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-white p-8 md:p-12 rounded-[40px] shadow-2xl max-w-lg w-full text-center flex flex-col items-center relative overflow-hidden"
            >
              <div className="relative w-36 h-36 mb-6 z-10 flex-shrink-0">
                {/* Animated Rings Background (Emma style) */}
                {aiState === 'listening' ? (
                   <>
                     <div className="absolute inset-0 bg-[#E8C547]/90 rounded-full scale-[1.08] shadow-inner border border-white/50"></div>
                     <div className="absolute inset-0 bg-blue-100/50 rounded-full scale-[1.16] -z-10 animate-pulse"></div>
                   </>
                ) : (
                   <div className="absolute inset-0 bg-slate-100 rounded-full scale-[1.08]"></div>
                )}
                
                <img 
                  src="/img_hanen_avatar.png" 
                  alt="Hanen" 
                  className="relative w-full h-full object-cover rounded-full border-4 border-white shadow-xl z-20 bg-[#FAF6F0]"
                />
                
                {aiState === 'processing' && (
                  <div className="absolute inset-0 bg-white/60 rounded-full z-30 flex items-center justify-center backdrop-blur-sm border-4 border-white">
                    <RefreshCw size={40} className="text-[#0F1E36] animate-spin" />
                  </div>
                )}
              </div>
              
              <h3 className="text-3xl font-extrabold text-[#0F1E36] tracking-tight mb-2 relative z-10">
                {aiState === 'listening' ? "Appel en cours..." : "Analyse en cours..."}
              </h3>
              
              <p className="text-lg text-slate-500 font-medium mb-8 max-w-sm relative z-10">
                {aiState === 'listening' 
                  ? "Hanen vous écoute"
                  : "Veuillez patienter pendant le traitement..."}
              </p>

              {aiState === 'listening' && (
                <button 
                  onClick={() => handleStopLive(false)}
                  className="bg-[#FF3B30] hover:bg-[#FF3B30]/90 text-white font-bold px-10 py-4 text-lg rounded-2xl shadow-lg shadow-red-500/30 transition-transform active:scale-95 flex items-center gap-3 relative z-10 justify-center w-[260px]"
                >
                  <PhoneOff size={24} />
                  Raccrocher
                </button>
              )}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Floating button removed */}
    </div>
  );
}
