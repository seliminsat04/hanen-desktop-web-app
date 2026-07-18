// Assistant interface
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Stethoscope, X, Maximize2, Minimize2, Send, Bot, Sparkles, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocation } from 'react-router-dom';
import { mockAlerts } from '../data';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { Patient, VoiceAlert } from '../types';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export function Chatbot() {
  const location = useLocation();
  const { data: dbPatients } = useFirestoreData<Patient>('patients');
  const { data: dbAlerts } = useFirestoreData<VoiceAlert>('alerts');
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: "Assistant Clinique actif. Prêt pour l'analyse de dossier ou la confirmation de protocole.",
    }
  ]);
  
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textOverride) setInput('');
    setIsTyping(true);

    try {
      let contextInfo = '';
      if (location.pathname.startsWith('/patients/')) {
        const patientId = location.pathname.split('/')[2];
        const patient = dbPatients.find(p => p.id === patientId);
        if (patient) {
          contextInfo = `L'utilisateur (médecin) consulte actuellement le dossier du patient:
Nom: ${patient.name}
Âge: ${patient.age}
Sexe: ${patient.gender}
Pathologies: ${patient.conditions.join(', ')}
Statut vocal IA: ${patient.voiceHealthStatus}
Observance médicale: ${patient.adherenceRate}%
Il est CRITIQUE d'utiliser UNIQUEMENT ces exactes informations. N'invente pas d'autres antécédents, médicaments ou examens cliniques fictifs (PAS d'hallucination).`;
        }
      } else if (location.pathname === '/alerts') {
        const activeAlerts = dbAlerts.filter(a => a.status === 'Active');
        const MAX_ALERTS_CONTEXT = 5;
        const alertsToInclude = activeAlerts.slice(0, MAX_ALERTS_CONTEXT);
        const remainingAlerts = activeAlerts.length - alertsToInclude.length;
        
        let alertsText = alertsToInclude.map(a => `- Patient: ${dbPatients.find(p=>p.id===a.patientId)?.name || a.patientId}, Motif: ${a.detectedSigns.join(', ')}, Urgence: ${a.priority}, Suggestion IA: ${a.aiSuggestion}`).join('\n');
        
        if (remainingAlerts > 0) {
            alertsText += `\n... et ${remainingAlerts} autres alertes actives non affichées ici pour des raisons de concision.`;
        }
        
        contextInfo = `L'utilisateur (médecin) consulte actuellement la page des Alertes Critiques. Il y a ${activeAlerts.length} alertes actives au total. Voici les détails des ${Math.min(activeAlerts.length, MAX_ALERTS_CONTEXT)} premières alertes:\n${alertsText}
Il est CRITIQUE de n'utiliser QUE ces informations. N'invente pas de faux patients ni de fausses alertes. Si le médecin te pose des questions sur les autres alertes, explique-lui que pour prévenir toute limite mémoire (ou risque d'hallucination), tu ne lui affiches qu'un échantillon et suggère-lui de fournir lui-même le nom ou les symptômes pour avoir une analyse.`;
      } else if (location.pathname === '/') {
        contextInfo = `L'utilisateur consulte le tableau de bord principal avec une vue d'ensemble. Aucune fiche patient spécifique n'est ouverte. Dis-lui qu'il doit naviguer vers un patient pour avoir des informations précises sans inventer de données.`;
      }

      const chatHistory = [...messages, userMessage].filter(m => m.role !== 'system').map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: chatHistory, contextInfo }),
      });

      if (!res.ok) {
        throw new Error("Erreur de communication avec l'assistant");
      }

      const data = await res.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.text,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (e: any) {
      if (e.name === 'AbortError') return; // Ignore aborts from unmounting
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: "Erreur de connexion à l'assistant. Vérifiez la clé API ou la connexion.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col mb-4 ${
              isExpanded ? 'w-[600px] h-[700px] max-h-[85vh] max-w-[90vw]' : 'w-[400px] h-[550px]'
            }`}
          >
            {/* Header */}
            <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-slate-700 flex items-center justify-center">
                  <Stethoscope className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Copilote Médical</h3>
                  <p className="text-[10px] text-slate-300 uppercase tracking-wider font-semibold">Assistant Virtuel</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-slate-500">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 hover:bg-slate-700 hover:text-white rounded transition-colors"
                  title={isExpanded ? "Réduire" : "Agrandir"}
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-slate-700 hover:text-white rounded transition-colors"
                  title="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 flex flex-col gap-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white rounded-br-none'
                        : msg.role === 'system'
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                        <div className="markdown-body prose prose-sm max-w-none text-slate-800">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                    ) : msg.role === 'system' ? (
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <span>{msg.content}</span>
                        </div>
                    ) : (
                        msg.content
                    )}
                  </div>
                </div>
              ))}
              
              {messages.length === 1 && !isTyping && (
                <div className="flex flex-col gap-2 mt-2">
                  <p className="text-slate-500 font-medium text-[11px] uppercase tracking-wider mb-1 px-1">Suggestions de requêtes</p>
                  <button 
                    onClick={() => handleSend("Quelles sont les alertes critiques d'aujourd'hui ?")}
                    className="text-left px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-blue-400 hover:text-blue-700 transition-all text-xs font-medium shadow-sm"
                  >
                    Quelles sont les alertes critiques d'aujourd'hui ?
                  </button>
                  <button 
                    onClick={() => handleSend("Y a-t-il des interactions signalées avec ce traitement en cours ?")}
                    className="text-left px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-blue-400 hover:text-blue-700 transition-all text-xs font-medium shadow-sm"
                  >
                    Y a-t-il des interactions signalées avec ce traitement en cours ?
                  </button>
                  <button 
                    onClick={() => handleSend("Affiche-moi un résumé clinique du patient actuel.")}
                    className="text-left px-3 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-blue-400 hover:text-blue-700 transition-all text-xs font-medium shadow-sm"
                  >
                    Affiche-moi un résumé clinique du patient actuel.
                  </button>
                </div>
              )}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-slate-200 rounded-lg rounded-bl-none shadow-sm flex items-center gap-1.5 h-9 px-3">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              )}
              <div ref={endOfMessagesRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-slate-200">
              <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Recherche dossier, posologie, protocole..."
                  className="flex-1 bg-transparent border-none focus:ring-0 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                  className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!isOpen && (
          <motion.button
            onClick={() => setIsOpen(true)}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-14 h-14 bg-slate-800 text-white rounded-full shadow-lg shadow-blue-900/20 flex items-center justify-center relative group"
          >
            <Stethoscope className="w-6 h-6 text-emerald-400" />
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-[#faf8f5] flex items-center justify-center">
                <Sparkles className="w-2 h-2 text-white" />
            </div>
            
            <div className="absolute right-16 top-1/2 -translate-y-1/2 bg-slate-900 text-white text-xs font-semibold px-3 py-1.5 rounded pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              Copilote Médical
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
