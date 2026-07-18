// Patient directory
import React, { useState, useRef } from 'react';
import { Search, Filter, Phone, PlayCircle, Activity, Plus, X, Heart, Sun, Cloud, MessageCircle, Home, FileText, UploadCloud, AlertCircle, Scan } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, formatSafeDate } from '../lib/utils';
import { Patient } from '../types';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../AuthContext';

export function Patients() {
  const { tenantId } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const { data: dbPatients, loading } = useFirestoreData<Patient>('patients');
  
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newPatient, setNewPatient] = useState({
     name: '',
     age: '',
     gender: 'M',
     phone: '',
     condition: '',
     livesAlone: false,
     techSavvy: false,
     lifestylePreference: 'Matinée',
  });

  // Keep track of which fields AI isn't confident about (< 80)
  const [lowConfidenceFields, setLowConfidenceFields] = useState<string[]>([]);
  const [scanMessage, setScanMessage] = useState<{text: string; type: 'success' | 'error'} | null>(null);

  const filteredPatients = dbPatients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.conditions && p.conditions.some(c => c.toLowerCase().includes(searchTerm.toLowerCase())))
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
       setScanMessage({ text: "Fichier trop volumineux. La taille maximale est de 10Mo.", type: 'error' });
       return;
    }

    setIsScanning(true);
    setScanMessage(null);
    setLowConfidenceFields([]);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        const res = await fetch('/api/scan-patient', {
           method: 'POST',
           headers: {
             'Content-Type': 'application/json'
           },
           body: JSON.stringify({
             fileType: file.type,
             fileData: base64Data
           })
        });

        if (!res.ok) {
           let errMsg = "Erreur lors de l'analyse du document.";
           try {
             const errData = await res.json();
             if (errData && errData.error === "API_KEY_MISSING") {
               errMsg = errData.message || "La clé API Gemini est introuvable côté serveur.";
             } else if (errData && errData.message) {
               errMsg = errData.message;
             }
           } catch (_) {
             errMsg = `Erreur de communication (code ${res.status}).`;
           }
           throw new Error(errMsg);
        }

        const data = await res.json();
        
        if (data.isRelevantDocument === false) {
           throw new Error("Ce fichier ne semble pas être un document médical ou une pièce d'identité valide. Par mesure de sécurité, le scan est annulé.");
        }
        
        let newFields = { ...newPatient };
        let uncertainFields: string[] = [];

        if (data.name?.value) { newFields.name = String(data.name.value); if (data.name.confidence < 80) uncertainFields.push('name'); }
        if (data.age?.value) { newFields.age = String(data.age.value); if (data.age.confidence < 80) uncertainFields.push('age'); }
        if (data.gender?.value) { 
           newFields.gender = String(data.gender.value).toUpperCase().startsWith('F') ? 'F' : 'M'; 
           if (data.gender.confidence < 80) uncertainFields.push('gender'); 
        }
        if (data.phone?.value) { newFields.phone = String(data.phone.value); if (data.phone.confidence < 80) uncertainFields.push('phone'); }
        if (data.condition?.value) { newFields.condition = String(data.condition.value); if (data.condition.confidence < 80) uncertainFields.push('condition'); }
        
        setNewPatient(newFields);
        setLowConfidenceFields(uncertainFields);

        if (uncertainFields.length > 0) {
           setScanMessage({ text: "Scan partiellement complet. Vérifiez les champs surlignés en jaune.", type: 'error' });
        } else {
           setScanMessage({ text: "Extraction réussie avec une haute confiance.", type: 'success' });
        }
        setIsScanning(false);
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.error(err);
        setIsScanning(false);
        setScanMessage({ text: err.name === 'AbortError' ? "Scan annulé." : err.message || "Impossible de scanner le document.", type: 'error' });
      }
    };
    reader.onerror = () => {
      setIsScanning(false);
      setScanMessage({ text: "Erreur lors de la lecture locale du fichier.", type: 'error' });
    };
    reader.readAsDataURL(file);
  };

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantId) return;
    
    try {
      await addDoc(collection(db, 'tenants', tenantId, 'patients'), {
        name: newPatient.name,
        age: parseInt(newPatient.age, 10),
        gender: newPatient.gender,
        conditions: newPatient.condition ? [newPatient.condition] : [],
        voiceHealthStatus: 'Stable',
        adherenceRate: 100,
        phone: newPatient.phone,
        dignityIndex: 100,
        livesAlone: newPatient.livesAlone,
        techSavvy: newPatient.techSavvy,
        lifestylePreference: newPatient.lifestylePreference,
        dominantMood: 'Serein',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setIsAddModalOpen(false);
      setNewPatient({ name: '', age: '', gender: 'M', phone: '', condition: '', livesAlone: false, techSavvy: false, lifestylePreference: 'Matinée' });
      setLowConfidenceFields([]);
      setScanMessage(null);
      alert("Patient ajouté avec succès !");
    } catch (err) {
      console.error("Erreur ajout patient:", err);
      alert("Erreur lors de l'ajout du patient.");
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
             <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Nouveau Patient</h2>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                  <button onClick={() => fileInputRef.current?.click()} type="button" disabled={isScanning} className={cn("text-[11px] uppercase tracking-wider font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-all shadow-sm disabled:cursor-not-allowed flex items-center gap-1.5 focus:outline-none relative overflow-hidden", isScanning ? "ring-2 ring-indigo-400 border-indigo-400" : "border-indigo-100 border")}>
                     {isScanning && <div className="absolute inset-0 bg-indigo-200/50 animate-pulse z-0"></div>}
                     <span className="relative z-10 flex items-center gap-1.5">
                       {isScanning ? <Activity size={14} className="animate-spin" /> : <Scan size={14} strokeWidth={2.5} />}
                       {isScanning ? 'Analyse...' : 'Pré-remplir via Scan'}
                     </span>
                  </button>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-slate-500 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors focus:outline-none">
                  <X size={20} strokeWidth={2.5} />
                </button>
             </div>

             <div className="overflow-y-auto flex-1 p-6">
               {scanMessage && (
                 <div className={cn("text-xs font-bold px-4 py-3 rounded-xl mb-6 flex items-start gap-3 animate-in fade-in slide-in-from-top-2", scanMessage.type === 'error' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200')}>
                    <span className="mt-0.5">{scanMessage.type === 'error' ? <AlertCircle size={16} /> : <Scan size={16} />}</span> 
                    <span>{scanMessage.text}</span>
                 </div>
               )}

               <form id="add-patient-form" onSubmit={handleAddPatient} className="space-y-4">
                 <div>
                    <label className="flex items-center justify-between text-sm font-bold text-slate-700 mb-1">
                      Nom Complet 
                      {lowConfidenceFields.includes('name') && <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Vérifier</span>}
                    </label>
                    <input required disabled={isScanning} placeholder={isScanning && !newPatient.name ? "Analyse en cours..." : ""} type="text" value={newPatient.name} onChange={e => {setNewPatient({...newPatient, name: e.target.value}); setLowConfidenceFields(prev => prev.filter(f => f !== 'name'))}} className={cn("w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 outline-none font-medium transition-all disabled:opacity-60 disabled:cursor-wait", lowConfidenceFields.includes('name') ? "border-amber-400 ring-4 ring-amber-100/50 focus:ring-amber-500 bg-amber-50/50" : isScanning && !newPatient.name ? "animate-pulse bg-indigo-50/50 border-indigo-100 placeholder:text-indigo-400/70" : "border-slate-200 focus:ring-indigo-500")} />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="flex items-center justify-between text-sm font-bold text-slate-700 mb-1">
                        Âge
                        {lowConfidenceFields.includes('age') && <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Vérifier</span>}
                      </label>
                      <input required disabled={isScanning} placeholder={isScanning && !newPatient.age ? "..." : ""} type="number" min="0" value={newPatient.age} onChange={e => {setNewPatient({...newPatient, age: e.target.value}); setLowConfidenceFields(prev => prev.filter(f => f !== 'age'))}} className={cn("w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 outline-none font-medium transition-all disabled:opacity-60 disabled:cursor-wait", lowConfidenceFields.includes('age') ? "border-amber-400 ring-4 ring-amber-100/50 focus:ring-amber-500 bg-amber-50/50" : isScanning && !newPatient.age ? "animate-pulse bg-indigo-50/50 border-indigo-100 placeholder:text-indigo-400/70" : "border-slate-200 focus:ring-indigo-500")} />
                   </div>
                   <div>
                      <label className="flex items-center justify-between text-sm font-bold text-slate-700 mb-1">
                        Genre
                        {lowConfidenceFields.includes('gender') && <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Vérifier</span>}
                      </label>
                      <select disabled={isScanning} value={newPatient.gender} onChange={e => {setNewPatient({...newPatient, gender: e.target.value}); setLowConfidenceFields(prev => prev.filter(f => f !== 'gender'))}} className={cn("w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 outline-none font-medium transition-all disabled:opacity-60 disabled:cursor-wait", lowConfidenceFields.includes('gender') ? "border-amber-400 ring-4 ring-amber-100/50 focus:ring-amber-500 bg-amber-50/50" : isScanning ? "animate-pulse bg-indigo-50/50 border-indigo-100" : "border-slate-200 focus:ring-indigo-500")}>
                         <option value="M">Homme</option>
                         <option value="F">Femme</option>
                      </select>
                   </div>
                 </div>
                 <div>
                    <label className="flex items-center justify-between text-sm font-bold text-slate-700 mb-1">
                      Téléphone
                      {lowConfidenceFields.includes('phone') && <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Vérifier</span>}
                    </label>
                    <input required disabled={isScanning} placeholder={isScanning && !newPatient.phone ? "Analyse en cours..." : ""} type="tel" value={newPatient.phone} onChange={e => {setNewPatient({...newPatient, phone: e.target.value}); setLowConfidenceFields(prev => prev.filter(f => f !== 'phone'))}} className={cn("w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 outline-none font-medium transition-all disabled:opacity-60 disabled:cursor-wait", lowConfidenceFields.includes('phone') ? "border-amber-400 ring-4 ring-amber-100/50 focus:ring-amber-500 bg-amber-50/50" : isScanning && !newPatient.phone ? "animate-pulse bg-indigo-50/50 border-indigo-100 placeholder:text-indigo-400/70" : "border-slate-200 focus:ring-indigo-500")} />
                 </div>
                 <div>
                    <label className="flex items-center justify-between text-sm font-bold text-slate-700 mb-1">
                      Pathologie Principale
                      {lowConfidenceFields.includes('condition') && <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full uppercase tracking-wider">Vérifier</span>}
                    </label>
                    <input disabled={isScanning} placeholder={isScanning && !newPatient.condition ? "Analyse en cours..." : ""} type="text" value={newPatient.condition} onChange={e => {setNewPatient({...newPatient, condition: e.target.value}); setLowConfidenceFields(prev => prev.filter(f => f !== 'condition'))}} className={cn("w-full px-4 py-2.5 bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 outline-none font-medium transition-all disabled:opacity-60 disabled:cursor-wait", lowConfidenceFields.includes('condition') ? "border-amber-400 ring-4 ring-amber-100/50 focus:ring-amber-500 bg-amber-50/50" : isScanning && !newPatient.condition ? "animate-pulse bg-indigo-50/50 border-indigo-100 placeholder:text-indigo-400/70" : "border-slate-200 focus:ring-indigo-500")} />
                 </div>
                 
                 <div className="pt-4 border-t border-slate-100">
                    <h3 className="text-sm font-extrabold text-slate-800 tracking-tight mb-4 flex items-center gap-2"><Heart size={16} className="text-rose-400"/> Contexte Social & Impact IA</h3>
                    <div className="space-y-4">
                      <label className="flex items-start gap-3 p-3 bg-indigo-50/30 border border-indigo-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                        <input type="checkbox" checked={newPatient.livesAlone} onChange={e => setNewPatient({...newPatient, livesAlone: e.target.checked})} className="mt-1 rounded text-indigo-600 focus:ring-indigo-500" />
                        <div>
                           <p className="text-sm font-bold text-slate-800">Vit seul(e) ou particulièrement isolé</p>
                           <p className="text-xs text-slate-500 font-medium">L'IA Hanen ajustera le ton pour être plus chaleureuse, prolongera légèrement l'appel, et priorisera la détection de signaux de solitude absolue.</p>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3 bg-emerald-50/30 border border-emerald-100 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                        <input type="checkbox" checked={newPatient.techSavvy} onChange={e => setNewPatient({...newPatient, techSavvy: e.target.checked})} className="mt-1 rounded text-emerald-600 focus:ring-emerald-500" />
                        <div>
                           <p className="text-sm font-bold text-slate-800">À l'aise avec la technologie</p>
                           <p className="text-xs text-slate-500 font-medium">Réduit la verbosité de l'IA. Les introductions répétitives (qui peuvent être condescendantes pour des actifs) seront désactivées. L'échange sera plus vif.</p>
                        </div>
                      </label>
                      <div className="p-3">
                        <label className="block text-sm font-bold text-slate-800 mb-2">Moment de prédilection <span className="font-normal text-xs text-slate-500">- Respect du rythme</span></label>
                        <select value={newPatient.lifestylePreference} onChange={e => setNewPatient({...newPatient, lifestylePreference: e.target.value})} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-slate-50 focus:bg-white text-sm font-medium transition-all shadow-sm">
                           <option value="Matinée">Matinée (Avant midi)</option>
                           <option value="Après-midi">Après-midi (Après la sieste - Idéal fragilité)</option>
                           <option value="Soirée">Soirée (Peut générer de l'anxiété chez certains)</option>
                        </select>
                      </div>
                    </div>
                 </div>
               </form>
             </div>
             
             {/* Sticky footer for buttons */}
             <div className="p-6 border-t border-slate-100 bg-white">
                <div className="flex gap-3">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-6 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors">Annuler</button>
                  <button type="submit" form="add-patient-form" className="flex-1 px-4 py-3 text-white bg-indigo-600 hover:bg-indigo-700 shadow-[0_4px_14px_0_rgba(79,70,229,0.39)] rounded-xl font-bold tracking-wide transition-all duration-300">
                    Créer le dossier Patient
                  </button>
                </div>
             </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">Mes Patients</h1>
          <p className="text-slate-500 font-medium mt-1">Gérez le suivi vocal de vos patients avec Hanen.</p>
        </div>
        
        <div className="flex gap-4">
          <button 
             onClick={() => setIsAddModalOpen(true)}
             className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all duration-300 shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.23)] hover:-translate-y-0.5"
          >
            <Plus size={18} strokeWidth={2.5} /> Nouveau Patient
          </button>
          <div className="relative group flex-1 sm:flex-none">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher patient..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-64 pl-11 pr-4 py-2.5 rounded-xl border border-slate-200/60 bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm font-medium transition-all duration-300 shadow-sm"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200/60 rounded-xl text-slate-700 hover:bg-slate-50 hover:border-slate-300 text-sm font-bold transition-all duration-300 shadow-sm">
            <Filter size={18} /> Filtres
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] overflow-hidden">
        <div className="overflow-x-auto min-h-[300px] relative">
            {loading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
                    <p className="text-slate-500 font-bold tracking-wide animate-pulse">Chargement des données...</p>
                </div>
            )}
            
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200/60 text-slate-500 text-xs uppercase tracking-wider font-bold">
                <th className="px-8 py-5">Patient & Contexte</th>
                <th className="px-6 py-5">Dernier Appel</th>
                <th className="px-6 py-5">État Vocal & Humeur</th>
                <th className="px-6 py-5">Bien-être (Dignité)</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPatients.map((patient: Patient) => (
                <tr key={patient.id} className="hover:bg-slate-50/80 transition-all duration-300 group border-transparent border-l-4 hover:border-l-indigo-500">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center font-bold text-slate-700 shadow-inner group-hover:scale-105 transition-all duration-300 relative">
                        {patient.name.charAt(0)}
                        {patient.livesAlone && (
                          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm" title="Vit seul(e)">
                            <Home size={10} className="text-slate-600" />
                          </div>
                        )}
                      </div>
                      <div>
                        <Link to={`/patients/${patient.id}`} className="font-bold text-slate-800 text-base tracking-tight hover:text-indigo-600 block transition-colors">
                          {patient.name}
                        </Link>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500 font-medium tracking-wide mt-1">
                           <span>{patient.age} ans</span>
                           {patient.lifestylePreference && <span className="bg-slate-100 px-1.5 rounded">{patient.lifestylePreference}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm font-semibold text-slate-500">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-indigo-400" /> 
                        {formatSafeDate(patient.lastCallDate, 'date')}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {patient.conditions?.map(c => (
                          <span key={c} className="text-[10px] uppercase font-bold text-slate-500">{c}</span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                       <span className={cn(
                        "px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 border shadow-sm",
                        patient.voiceHealthStatus === 'Stable' && "bg-emerald-50 text-emerald-700 border-emerald-100",
                        patient.voiceHealthStatus === 'Attention' && "bg-amber-50 text-amber-700 border-amber-100",
                        patient.voiceHealthStatus === 'Critique' && "bg-red-50 text-red-700 border-red-100 animate-pulse",
                       )}>
                         <div className={cn(
                           "w-1.5 h-1.5 rounded-full",
                           patient.voiceHealthStatus === 'Stable' ? 'bg-emerald-500' : patient.voiceHealthStatus === 'Attention' ? 'bg-amber-500' : 'bg-red-500'
                         )} />
                         {patient.voiceHealthStatus}
                       </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2" title="Indice de Dignité (santé mentale & émotionnelle)">
                        <Heart size={14} className={patient.dignityIndex < 50 ? "text-rose-500" : patient.dignityIndex < 80 ? "text-amber-500" : "text-emerald-500"} />
                        <span className="text-sm font-extrabold text-slate-700">{patient.dignityIndex}<span className="text-xs text-slate-500">/100</span></span>
                      </div>
                      <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1" title={`Observance médicale ${patient.adherenceRate || 0}%`}>
                        <div 
                          className={cn("h-full transition-all duration-1000", patient.adherenceRate > 80 ? "bg-emerald-500" : patient.adherenceRate > 60 ? "bg-amber-500" : "bg-rose-500")} 
                          style={{ width: `${Math.min(100, Math.max(0, patient.adherenceRate || 0))}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                        <button title="Envoyer appel de réconfort" className="p-2.5 text-rose-400 hover:text-white hover:bg-rose-500 border border-transparent hover:border-rose-400 rounded-xl transition-all duration-300 transform hover:scale-110">
                          <Heart size={20} strokeWidth={2.5} />
                        </button>
                        <Link to={`/patients/${patient.id}`} title="Consulter la fiche" className="p-2.5 text-indigo-400 hover:text-white hover:bg-indigo-600 border border-transparent hover:border-indigo-500 rounded-xl transition-all duration-300 transform hover:scale-110">
                          <PlayCircle size={20} strokeWidth={2.5} />
                        </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {!loading && filteredPatients.length === 0 && (
              <div className="text-center py-12">
                  <p className="text-slate-500 font-medium">Aucun patient trouvé dans la base de données Firebase.</p>
                  <p className="text-sm text-slate-500 mt-1">Utilisez le bouton "Installer Données de Test" en haut si vous venez de vous connecter.</p>
              </div>
          )}
        </div>
      </div>
    </div>
  );
}
