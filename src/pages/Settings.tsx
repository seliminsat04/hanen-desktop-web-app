import React, { useState, useEffect } from 'react';
import { Bell, ShieldCheck, User, Volume2, Save, Phone, Clock, FileText, Smartphone, UploadCloud, Link as LinkIcon, Image as ImageIcon, Sparkles, Check, AlertCircle, Globe, RefreshCw } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';
import { formatDoctorName } from '../utils/nameHelper';

export function Settings() {
  const { tenantId, user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'ia-config' | 'consent' | 'notifications'>('profile');
  
  // Tab 1: Profile State
  const [doctorName, setDoctorName] = useState('Dr. Slim N.');
  const [specialty, setSpecialty] = useState('Cardiologue');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [activeAvatarSource, setActiveAvatarSource] = useState<'google' | 'initials' | 'preset' | 'upload' | 'url'>('initials');
  const [dragActive, setDragActive] = useState(false);
  const [email, setEmail] = useState('');
  const [cabinetName, setCabinetName] = useState('Cabinet de Cardiologie du Dr. Slim');
  const [contactPhone, setContactPhone] = useState('+216 71 234 567');
  const [cnamId, setCnamId] = useState('12345/C/67');
  
  // Tab 2: IA State
  const [distressDetection, setDistressDetection] = useState(true);
  const [comfortCalls, setComfortCalls] = useState(true);
  const [dialect, setDialect] = useState('Derja (Tunisien)');
  const [callingWindow, setCallingWindow] = useState('Respect du rythme (9h-12h, 16h-19h30, pas de sieste)');

  // Tab 3: Consent & Legals
  const [inpdpConsent, setInpdpConsent] = useState(true);
  const [retentionMonths, setRetentionMonths] = useState('3');
  const [customRetentionMonths, setCustomRetentionMonths] = useState('48');
  const [anonymization, setAnonymization] = useState(true);

  // Tab 4: Notifications State
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsEmergency, setSmsEmergency] = useState(false);
  const [doctorMobile, setDoctorMobile] = useState('+216 98 765 432');
  const [summaryTime, setSummaryTime] = useState('18:00');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
       if (!tenantId) return;
       try {
         const docRef = doc(db, 'tenants', tenantId);
         const docSnap = await getDoc(docRef);
         if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.doctorName) setDoctorName(formatDoctorName(data.doctorName));
            if (data.doctorSpecialty) setSpecialty(data.doctorSpecialty);
            if (data.cabinetName) setCabinetName(data.cabinetName);
            if (data.contactPhone) setContactPhone(data.contactPhone);
            if (data.cnamId) setCnamId(data.cnamId);
            if (data.avatarUrl) {
              const url = data.avatarUrl;
              setAvatarUrl(url);
              if (user?.photoURL && url === user.photoURL) {
                setActiveAvatarSource('google');
              } else if (url.includes('notionists') || url.includes('avataaars')) {
                setActiveAvatarSource('preset');
              } else if (url.startsWith('data:image/') || url.includes('base64')) {
                setActiveAvatarSource('upload');
              } else if (url.includes('initials')) {
                setActiveAvatarSource('initials');
              } else if (url.startsWith('http')) {
                setActiveAvatarSource('url');
              } else {
                setActiveAvatarSource('initials');
              }
            } else {
              setActiveAvatarSource('initials');
            }
            if (data.aiDistressDetection !== undefined) setDistressDetection(data.aiDistressDetection);
            if (data.aiComfortCalls !== undefined) setComfortCalls(data.aiComfortCalls);
            if (data.dialect) setDialect(data.dialect);
            if (data.callingWindow) setCallingWindow(data.callingWindow);
            if (data.inpdpConsent !== undefined) setInpdpConsent(data.inpdpConsent);
            if (data.retentionMonths !== undefined) {
              const val = String(data.retentionMonths);
              const presets = ['1', '3', '6', '12', '24', '0'];
              if (presets.includes(val)) {
                setRetentionMonths(val);
              } else {
                setRetentionMonths('autre');
                setCustomRetentionMonths(val);
              }
            }
            if (data.anonymization !== undefined) setAnonymization(data.anonymization);
            if (data.emailAlerts !== undefined) setEmailAlerts(data.emailAlerts);
            if (data.smsEmergency !== undefined) setSmsEmergency(data.smsEmergency);
            if (data.doctorMobile) setDoctorMobile(data.doctorMobile);
            if (data.summaryTime) setSummaryTime(data.summaryTime);
         }
         if (user?.email) setEmail(user.email);
       } catch (err) {
         console.error('Error loading settings', err);
       } finally {
         setLoading(false);
       }
    }
    loadSettings();
  }, [tenantId, user]);

  const handleSave = async () => {
    if (!tenantId) return;
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const docRef = doc(db, 'tenants', tenantId);
      await updateDoc(docRef, {
         name: cabinetName,
         doctorName,
         doctorSpecialty: specialty,
         avatarUrl,
         cabinetName,
         contactPhone,
         cnamId,
         aiDistressDetection: distressDetection,
         aiComfortCalls: comfortCalls,
         dialect,
         callingWindow,
         inpdpConsent,
         retentionMonths: retentionMonths === 'autre' ? Number(customRetentionMonths) : Number(retentionMonths),
         anonymization,
         emailAlerts,
         smsEmergency,
         doctorMobile,
         summaryTime,
         updatedAt: serverTimestamp()
      });
      setSuccessMsg('Vos préférences ont été enregistrées avec succès!');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Error saving settings', err);
      setErrorMsg('Erreur lors de l’enregistrement de vos préférences.');
    } finally {
      setSaving(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Veuillez sélectionner un fichier image valide (PNG, JPEG, SVG, WebP).");
      setTimeout(() => setErrorMsg(null), 5000);
      return;
    }
    
    // Check file size (limit: 1.5MB)
    if (file.size > 1.5 * 1024 * 1024) {
      setErrorMsg("L'image est trop volumineuse (limite max recommandée : 1.5 Mo pour assurer des chargements rapides).");
      setTimeout(() => setErrorMsg(null), 5000);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAvatarUrl(event.target.result as string);
        setActiveAvatarSource('upload');
      }
    };
    reader.readAsDataURL(file);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-3">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-semibold text-sm">Chargement de vos configurations...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Paramètres du Cabinet</h1>
          <p className="text-slate-500 text-sm mt-1">Configurez l'IA Hanen, l'intégration légale INPDP et votre profil de consultation.</p>
        </div>
        <div>
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold tracking-wide transition-all shadow-[0_4px_14px_0_rgba(79,70,229,0.3)] disabled:opacity-50"
          >
            <Save size={16} strokeWidth={2.5} /> 
            {saving ? 'Sauvegarde...' : 'Enregistrer tout'}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-100 text-rose-800 rounded-2xl text-sm font-bold animate-in fade-in slide-in-from-top-2">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        
        {/* Settings Navigation */}
        <div className="md:col-span-1 flex flex-col gap-1 bg-slate-100/50 p-2 rounded-2xl border border-slate-200/50">
          <button 
            type="button"
            onClick={() => setActiveTab('profile')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left focus:outline-none",
              activeTab === 'profile' 
                ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40" 
                : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-800"
            )}
          >
            <User size={18} className={activeTab === 'profile' ? "text-indigo-600" : "text-slate-400"} /> 
            Mon Profil
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('ia-config')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left focus:outline-none",
              activeTab === 'ia-config' 
                ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40" 
                : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-800"
            )}
          >
            <Volume2 size={18} className={activeTab === 'ia-config' ? "text-indigo-600" : "text-slate-400"} /> 
            Configuration IA
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('consent')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left focus:outline-none",
              activeTab === 'consent' 
                ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40" 
                : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-800"
            )}
          >
            <ShieldCheck size={18} className={activeTab === 'consent' ? "text-indigo-600" : "text-slate-400"} /> 
            Consentements
          </button>

          <button 
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all text-left focus:outline-none",
              activeTab === 'notifications' 
                ? "bg-white text-indigo-600 shadow-sm border border-slate-200/40" 
                : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-800"
            )}
          >
            <Bell size={18} className={activeTab === 'notifications' ? "text-indigo-600" : "text-slate-400"} /> 
            Notifications
          </button>
        </div>

        {/* Settings Content Section */}
        <div className="md:col-span-3">
          
          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              
              {/* Profile Header and Avatar Selection */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Left: Avatar Preview and Essential Info */}
                <div className="lg:col-span-4 flex flex-col items-center">
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-full border-4 border-white shadow-md overflow-hidden bg-slate-50 transition-transform group-hover:scale-[1.02]">
                      <img 
                        src={avatarUrl || user?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(doctorName.replace('Dr. ', ''))}`} 
                        alt="Profile" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {activeAvatarSource === 'upload' && (
                      <div className="absolute -bottom-1 -right-1 bg-white border border-slate-200 text-indigo-600 rounded-full p-2 shadow-sm">
                        <UploadCloud size={14} />
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-5 text-center space-y-1">
                    <h3 className="font-bold text-slate-900 text-lg">{doctorName}</h3>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">{specialty || "Médecin Spécialiste"}</p>
                  </div>


                </div>

                {/* Right: Avatar Source Selection System */}
                <div className="lg:col-span-8 space-y-6">
                  <div className="space-y-1.5">
                    <h4 className="text-sm font-bold text-slate-900 tracking-tight">Source de l'identité visuelle</h4>
                    <p className="text-xs font-medium text-slate-500">Choisissez comment votre image de profil est générée ou importée.</p>
                  </div>

                  {/* Options Menu - Refined Selection Flow */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'initials', label: 'Initiales', icon: User },
                      { id: 'google', label: 'Google', icon: Globe, disabled: !user?.photoURL },
                      { id: 'preset', label: 'Modèles', icon: ImageIcon },
                      { id: 'upload', label: 'Importer', icon: UploadCloud },
                      { id: 'url', label: 'Lien URL', icon: LinkIcon }
                    ].map((source) => (
                      <button
                        key={source.id}
                        type="button"
                        disabled={source.disabled}
                        onClick={() => {
                          if (source.id === 'initials') {
                            setAvatarUrl(`https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(doctorName.replace('Dr. ', ''))}`);
                          } else if (source.id === 'google' && user?.photoURL) {
                            setAvatarUrl(user.photoURL);
                          } else if (source.id === 'preset') {
                            setAvatarUrl('https://api.dicebear.com/7.x/notionists/svg?seed=Jasper');
                          }
                          setActiveAvatarSource(source.id as any);
                        }}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-30",
                          activeAvatarSource === source.id 
                            ? "bg-slate-900 text-white border-slate-900 shadow-sm" 
                            : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                        )}
                      >
                        <source.icon size={14} />
                        {source.label}
                      </button>
                    ))}
                  </div>

                  {/* Contextual Input Area */}
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 min-h-[140px] flex flex-col justify-center">
                    {activeAvatarSource === 'initials' && (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800 tracking-tight">Génération dynamique</p>
                        <p className="text-xs text-slate-600 leading-relaxed">Les initiales sont extraites automatiquement de votre nom d'usage professionnel.</p>
                      </div>
                    )}

                    {activeAvatarSource === 'google' && (
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-slate-800 tracking-tight">Compte Google</p>
                        <p className="text-xs text-slate-600 leading-relaxed">Utilisation de la photo associée à votre identité de connexion : <span className="font-bold text-slate-900">{user?.email}</span></p>
                      </div>
                    )}

                    {activeAvatarSource === 'preset' && (
                      <div className="space-y-4">
                        <p className="text-xs font-bold text-slate-700">Modèles de représentation</p>
                        <div className="flex flex-wrap gap-4">
                          {[
                            { id: 'jasper', label: 'H - 1', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Jasper' },
                            { id: 'sarah', label: 'F - 1', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Sarah' },
                            { id: 'felix', label: 'H - 2', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Felix' },
                            { id: 'amina', label: 'F - 2', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Amina' },
                            { id: 'toby', label: 'H - 3', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Toby' },
                            { id: 'sofia', label: 'F - 3', url: 'https://api.dicebear.com/7.x/notionists/svg?seed=Sofia' }
                          ].map(preset => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => setAvatarUrl(preset.url)}
                              className={cn(
                                "flex flex-col items-center gap-2 transition-all p-1.5 rounded-xl border-2",
                                avatarUrl === preset.url ? "border-indigo-500 bg-white shadow-sm" : "border-transparent opacity-60 hover:opacity-100"
                              )}
                            >
                              <img src={preset.url} className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200" alt={preset.label} />
                              <span className="text-[9px] font-extrabold uppercase tracking-widest">{preset.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeAvatarSource === 'upload' && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-700">Importation locale</p>
                        <div 
                          onDragEnter={handleDrag}
                          onDragOver={handleDrag}
                          onDragLeave={handleDrag}
                          onDrop={handleDrop}
                          onClick={() => document.getElementById('avatar-file-upload')?.click()}
                          className={cn(
                            "border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all",
                            dragActive ? "border-indigo-400 bg-indigo-50/50" : "border-slate-200 hover:bg-slate-100/50"
                          )}
                        >
                          <input id="avatar-file-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                          <UploadCloud size={20} className="text-slate-400 mb-2" />
                          <p className="text-[11px] font-bold text-slate-600">Glissez-déposez ou cliquez pour parcourir</p>
                          <p className="text-[9px] text-slate-400 mt-1">PNG, JPG ou WebP (Max 1.5MB)</p>
                        </div>
                      </div>
                    )}

                    {activeAvatarSource === 'url' && (
                      <div className="space-y-3">
                        <p className="text-xs font-bold text-slate-700">Lien URL externe</p>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <LinkIcon size={14} />
                          </div>
                          <input 
                            type="text" 
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            placeholder="https://votre-site.com/photo.jpg"
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-medium"
                          />
                        </div>
                        <p className="text-[10px] text-slate-400">Pointez vers un fichier public (JPG, PNG, SVG, WebP).</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-8 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-6">
                  <div className="p-2 rounded-lg bg-slate-900 text-white">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 tracking-tight">Informations Administratives</h4>
                    <p className="text-xs font-medium text-slate-500">Détails de facturation et de présentation clinique.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nom complet d'usage</label>
                  <input 
                    type="text" 
                    value={doctorName} 
                    onChange={(e) => setDoctorName(e.target.value)} 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium transition-all text-sm" 
                  />
                  <p className="text-[11px] text-slate-400 font-medium">Ex: Dr. Slim N. (utilisé pour se présenter au téléphone)</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Spécialité médicale</label>
                  <input 
                    type="text" 
                    value={specialty} 
                    onChange={(e) => setSpecialty(e.target.value)} 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium transition-all text-sm" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nom du Cabinet / Clinique</label>
                  <input 
                    type="text" 
                    value={cabinetName} 
                    onChange={(e) => setCabinetName(e.target.value)} 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium transition-all text-sm" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Téléphone de redirection du cabinet</label>
                  <input 
                    type="text" 
                    value={contactPhone} 
                    onChange={(e) => setContactPhone(e.target.value)} 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium transition-all text-sm" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Numéro de Convention CNAM Tunisie</label>
                  <input 
                    type="text" 
                    value={cnamId} 
                    onChange={(e) => setCnamId(e.target.value)} 
                    placeholder="Ex: 12345/C/67"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-medium transition-all text-sm" 
                  />
                  <p className="text-[11px] text-slate-400 font-medium">Requis pour l'alignement réglementaire d'assurance maladie de vos patients.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Email professionnel d'accès</label>
                  <input 
                    type="email" 
                    value={email} 
                    disabled 
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-100 text-slate-400 rounded-xl outline-none font-medium text-sm cursor-not-allowed" 
                  />
                  <p className="text-[11px] text-slate-400 font-medium">L'adresse de connexion ne peut pas être modifiée.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONFIG IA */}
          {activeTab === 'ia-config' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Paramètres de l'Assistant Vocal</h2>
                <p className="text-xs font-medium text-slate-500">Configuration des protocoles d'interaction et de surveillance vocale.</p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800">Analyse de la détresse vocale</h4>
                    <p className="text-xs text-slate-500">Détecte les anomalies de respiration et les signes de fatigue lors des échanges.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={distressDetection} onChange={(e) => setDistressDetection(e.target.checked)} className="sr-only peer" />
                    <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800">Appels de suivi automatisés</h4>
                    <p className="text-xs text-slate-500">Planifie des appels de contrôle réguliers selon le profil d'adhérence du patient.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={comfortCalls} onChange={(e) => setComfortCalls(e.target.checked)} className="sr-only peer" />
                    <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Langue de l'Assistant</label>
                    <select value={dialect} onChange={(e) => setDialect(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-semibold text-slate-700">
                      <option>Derja (Tunisien)</option>
                      <option>Français</option>
                      <option>Arabe Littéraire</option>
                      <option>Autre</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Fuseau horaire d'activité</label>
                    <select value={callingWindow} onChange={(e) => setCallingWindow(e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-semibold text-slate-700">
                      <option>Plage standard (09h00 - 19h30)</option>
                      <option>Matinée uniquement (09h00 - 12h00)</option>
                      <option>Après-midi uniquement (16h00 - 19h30)</option>
                      <option>Alertes urgentes uniquement</option>
                      <option>Autre</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CONSENTEMENTS & LÉGAL */}
          {activeTab === 'consent' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Consentements & Conformité</h2>
                <p className="text-xs font-medium text-slate-500">Gestion de la conformité réglementaire et protection des données.</p>
              </div>

              <div className="space-y-6">
                <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3.5">
                  <ShieldCheck className="text-indigo-600 mt-1 shrink-0" size={18} />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Cadre Réglementaire (INPDP)</h4>
                    <p className="text-xs text-slate-500 leading-relaxed mt-1">
                      Conformément à la législation en vigueur sur la protection des données de santé, chaque traitement nécessite un consentement explicite du patient.
                    </p>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="flex items-center justify-between p-5 border border-slate-100 rounded-2xl hover:bg-slate-50/50 transition-colors shadow-sm">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-slate-800">Consentement préalable obligatoire</p>
                      <p className="text-xs text-slate-500">Exiger la signature numérique avant toute analyse IA.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={inpdpConsent} onChange={(e) => setInpdpConsent(e.target.checked)} className="sr-only peer" />
                      <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  <div className="flex items-center justify-between p-5 border border-slate-100 rounded-2xl hover:bg-slate-50/50 transition-colors shadow-sm">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-slate-800">Anonymisation des logs vocaux</p>
                      <p className="text-xs text-slate-500">Suppression des marqueurs d'identité après transcription.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" checked={anonymization} onChange={(e) => setAnonymization(e.target.checked)} className="sr-only peer" />
                      <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:bg-slate-50/50 transition-all gap-6">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Durée de conservation</p>
                    <p className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Gestion du cycle de vie des données</p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <select value={retentionMonths} onChange={(e) => setRetentionMonths(e.target.value)} className="w-full sm:w-[220px] px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-700 transition-all">
                      <option value="1">1 Mois</option>
                      <option value="3">3 Mois (Standard)</option>
                      <option value="6">6 Mois</option>
                      <option value="12">12 Mois</option>
                      <option value="24">2 Ans</option>
                      <option value="0">Suppression immédiate</option>
                      <option value="autre">Autre</option>
                    </select>

                    {retentionMonths === 'autre' && (
                      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                        <input 
                          type="number"
                          value={customRetentionMonths}
                          onChange={(e) => setCustomRetentionMonths(e.target.value)}
                          className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-xs font-bold text-slate-700"
                          min="1"
                          placeholder="Nb"
                        />
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Mois</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Paramètres de Notification</h2>
                <p className="text-xs font-medium text-slate-500">Configuration des alertes critiques et des comptes-rendus.</p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800">Compte-rendu quotidien par email</h4>
                    <p className="text-xs text-slate-500">Réception d'une synthèse d'activité en fin de journée.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} className="sr-only peer" />
                    <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/60">
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800">Alertes critiques par SMS</h4>
                    <p className="text-xs text-slate-500">Alerte immédiate en cas de détection d'événement critique.</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={smsEmergency} onChange={(e) => setSmsEmergency(e.target.checked)} className="sr-only peer" />
                    <div className="w-10 h-5.5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Téléphone d'urgence</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Smartphone size={14} />
                      </div>
                      <input 
                        type="text" 
                        value={doctorMobile} 
                        onChange={(e) => setDoctorMobile(e.target.value)} 
                        disabled={!smsEmergency}
                        placeholder="+216 -- --- ---"
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-semibold disabled:bg-slate-50 disabled:text-slate-400" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Heure de la synthèse</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Clock size={14} />
                      </div>
                      <input 
                        type="text" 
                        value={summaryTime} 
                        onChange={(e) => setSummaryTime(e.target.value)} 
                        placeholder="18:00"
                        className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-500 outline-none text-xs font-semibold"
                      />
                    </div>
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
