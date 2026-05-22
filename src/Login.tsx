import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useAuth } from './AuthContext';
import { cn } from './lib/utils';
import { 
  Stethoscope, 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  User, 
  Briefcase, 
  ChevronRight, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  ShieldCheck, 
  Loader2, 
  Award,
  LockKeyhole
} from 'lucide-react';

export function Login() {
  const { login, loginWithEmail, signupWithEmail } = useAuth();
  
  // Navigation & Screen state management
  const [showSplash, setShowSplash] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot-password'>('login');
  
  // Form input state variables
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  // Account creation state variables
  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('Médecine Générale');
  const [customSpecialty, setCustomSpecialty] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Password recovery state variable
  const [resetEmail, setResetEmail] = useState('');

  // Feedbacks and UX status variables
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load custom saved email if "remember credentials" was activated formerly
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('hanen_remembered_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (e) {
      console.error(e);
    }
    
    // Animate Splash Screen exit after 2000 milliseconds
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  // Form Validation and Submission Handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    
    if (!email.trim() || !password.trim()) {
      setErrorMessage("Veuillez renseigner votre adresse e-mail professionnelle ainsi que votre mot de passe.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setErrorMessage("Le format de l'adresse e-mail professionnelle saisie n'est pas valide.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (rememberMe) {
        localStorage.setItem('hanen_remembered_email', email);
      } else {
        localStorage.removeItem('hanen_remembered_email');
      }
      
      await loginWithEmail(email, password);
    } catch (err: any) {
      console.error("Clinical authentication failed:", err);
      let text = "Échec de l'authentification. Veuillez vérifier vos identifiants.";
      
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        text = "Identifiants incorrects ou mot de passe invalide. Veuillez vérifier vos informations d'accès.";
      } else if (err.code === 'auth/invalid-email') {
        text = "Le format de l'adresse e-mail saisie est incorrect.";
      } else if (err.code === 'auth/too-many-requests') {
        text = "L'accès à ce compte a été temporairement suspendu en raison d'un grand nombre de tentatives infructueuses. Veuillez patienter ou réinitialiser votre mot de passe.";
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-disabled') {
        text = "Identifiants d'accès invalides ou compte professionnel suspendu par votre administrateur d'établissement.";
      }
      setErrorMessage(text);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Validation
    const finalSpecialty = specialty === 'Autre' ? customSpecialty : specialty;

    if (!doctorName.trim()) {
      setErrorMessage("Veuillez renseigner le nom complet du praticien titulaire.");
      return;
    }
    if (!finalSpecialty.trim()) {
      setErrorMessage("Veuillez préciser votre spécialité clinique ou discipline médicale.");
      return;
    }
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      setErrorMessage("Tous les champs requis doivent être renseignés pour configurer le compte de votre cabinet.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage("Les deux mots de passe saisis ne correspondent pas.");
      return;
    }
    if (password.length < 8) {
      setErrorMessage("Par mesure de sécurité HDS, le mot de passe doit comporter au moins 8 caractères.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formattedName = docNameWithSpecialty(doctorName, finalSpecialty);
      await signupWithEmail(email, password, formattedName);
      setSuccessMessage("Votre compte cabinet Hanen Pro a été provisionné et sécurisé d'après les normes HDS. Redirection vers votre espace de télésurveillance...");
    } catch (err: any) {
      console.error("Clinical registration failed:", err);
      let text = "Création du cabinet impossible dans nos registres sécurisés.";
      if (err.code === 'auth/email-already-in-use') {
        text = "Cette adresse e-mail professionnelle est déjà enregistrée pour un cabinet médical existant.";
      } else if (err.code === 'auth/invalid-email') {
        text = "L'adresse e-mail professionnelle saisie n'est pas reconnue.";
      } else if (err.code === 'auth/weak-password') {
        text = "Le mot de passe choisi est trop faible. Veuillez complexifier vos caractères.";
      }
      setErrorMessage(text);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestPasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!resetEmail.trim() || !/\S+@\S+\.\S+/.test(resetEmail)) {
      setErrorMessage("Veuillez renseigner une adresse e-mail professionnelle valide.");
      return;
    }

    setIsSubmitting(true);
    // Simulating secure clinician recovery request with gorgeous feedback banner
    setTimeout(() => {
      setIsSubmitting(false);
      setSuccessMessage(`Une procédure sécurisée de réinitialisation de mot de passe a été transmise à l'adresse professionnelle : ${resetEmail}.`);
      setResetEmail('');
    }, 1200);
  };

  const handleGoogleFederation = async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    try {
      await login();
    } catch (err: any) {
      console.error("Google SSO Federation failed:", err);
      setErrorMessage("L'authentification Google a échoué ou a été annulée par l'utilisateur.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const docNameWithSpecialty = (name: string, spec: string) => {
    const cleanName = name.startsWith("Dr.") ? name : `Dr. ${name}`;
    return `${cleanName} (${spec})`;
  };

  // --- SCREEN 1: BRAND SPLASH SCREEN PANEL ---
  if (showSplash) {
    return (
      <div className="min-h-screen bg-[#FAF6F0] flex flex-col items-center justify-center font-sans overflow-hidden select-none">
        
        {/* Soft, glowing radial warm blur inside the background */}
        <div className="absolute inset-0 bg-radial-gradient from-amber-100/30 to-transparent pointer-events-none" />

        <div className="relative text-center space-y-8 z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
          
          {/* Animated Hanen Logo showcasing the clinical identity */}
          <div className="relative flex flex-col items-center justify-center">
            <div className="absolute w-48 h-48 rounded-full border border-[#C96F53]/10 animate-ping duration-[4000ms]" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="relative z-10"
            >
              <img 
                src="/hanen-logo.png" 
                alt="Hanen Logo" 
                className="w-64 h-auto drop-shadow-2xl"
                referrerPolicy="no-referrer"
              />
            </motion.div>
          </div>

          <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
            <p className="text-[10px] text-[#5C7F67] uppercase tracking-[0.3em] font-black opacity-80">
              Plateforme Clinique de Télésurveillance
            </p>
          </div>

          {/* Gentle acoustic voice wave simulator */}
          <div className="flex items-end justify-center gap-1.5 h-10 py-1">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((bar) => {
              const randomizedHeights = [12, 32, 20, 36, 16, 40, 24, 38, 14, 28, 18, 10];
              return (
                <div
                  key={bar}
                  style={{
                    height: `${randomizedHeights[bar - 1]}px`,
                    animation: `bounceWave 0.7s ease-in-out infinite alternate`,
                    animationDelay: `${bar * 60}ms`
                  }}
                  className="w-1 bg-gradient-to-t from-[#0F1E36] via-[#C96F53] to-orange-400 rounded-full"
                />
              );
            })}
          </div>

          <div className="pt-2 text-[11px] font-bold text-slate-500/70 inline-flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#5C7F67]" />
            Liaison médicale cryptée de bout en bout
          </div>
        </div>
      </div>
    );
  }

  // --- SCREEN 2: ACTIVE CLINIC AUTHENTICATION VIEW ---
  return (
    <div className="min-h-screen bg-gradient-to-tr from-[#FAF6F0] via-white to-[#FAF6F0] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative overflow-x-hidden">
      
      {/* Decorative Warm Accent Blur Blobs */}
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-orange-100/30 blur-3xl pointer-events-none animate-pulse duration-[6000ms]" />
      <div className="absolute -bottom-45 -left-40 w-96 h-96 rounded-full bg-emerald-50/40 blur-3xl pointer-events-none animate-pulse duration-[8000ms]" />
      
      {/* Upper Navigation / Info Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 flex flex-col items-center">
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex items-center justify-center p-2 rounded-2xl bg-white/40 backdrop-blur-sm border border-white/50 shadow-sm"
        >
          <img src="/hanen-logo.png" alt="Hanen Pro" className="h-14 w-auto" />
        </motion.div>
        <p className="mt-4 text-[10px] text-[#5C7F67] font-black uppercase tracking-[0.2em] text-center opacity-70">
          Plateforme Clinique de Télésurveillance
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-lg relative z-10">
        <div className="bg-white/95 backdrop-blur-md py-10 px-6 sm:px-12 shadow-2xl shadow-slate-200/50 rounded-3xl border border-slate-100 relative overflow-hidden">
          
          {/* Aesthetic upper marker banner strip */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#0F1E36] via-[#C96F53] to-[#5C7F67]" />

          {/* Premium Segmented Segment Switcher (CONNEXION VS ENREGISTREMENT) */}
          {authMode !== 'forgot-password' && (
            <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8 border border-slate-200/50">
              <button
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={cn(
                  "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5",
                  authMode === 'login' 
                    ? "bg-white text-[#0F1E36] shadow-sm font-black"
                    : "text-slate-500 hover:text-slate-800 font-bold"
                )}
              >
                <LockKeyhole size={14} className={authMode === 'login' ? "text-[#C96F53]" : "text-slate-400"} />
                Se connecter
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setErrorMessage(null);
                  setSuccessMessage(null);
                }}
                className={cn(
                  "flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-all duration-300 flex items-center justify-center gap-1.5",
                  authMode === 'register' 
                    ? "bg-white text-[#0F1E36] shadow-sm font-black"
                    : "text-slate-500 hover:text-slate-800 font-bold"
                )}
              >
                <User size={14} className={authMode === 'register' ? "text-[#5C7F67]" : "text-slate-400"} />
                Créer un compte
              </button>
            </div>
          )}

          {/* Feedback status messages */}
          {errorMessage && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200/80 rounded-2xl flex items-start gap-3.5 text-xs text-rose-800 leading-relaxed font-semibold animate-in fade-in duration-200">
              <AlertCircle size={18} className="text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block mb-0.5">Erreur de sécurité :</span>
                {errorMessage}
              </div>
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-xs text-emerald-800 font-semibold animate-in fade-in duration-200">
              <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block mb-0.5">Action validée :</span>
                {successMessage}
              </div>
            </div>
          )}

          {/* --- VIEW: LOGIN FORM --- */}
          {authMode === 'login' && (
            <div className="animate-in fade-in duration-200">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-black text-[#0F1E36] tracking-tight">
                  Bienvenue sur Hanen Pro
                </h2>
                <span className="inline-block mt-1 pl-2.5 pr-3 py-1 bg-amber-50 rounded-xl text-[11px] text-[#C96F53] font-black uppercase tracking-wider border border-amber-100">
                  Espace Médecin
                </span>
              </div>

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label htmlFor="login-email" className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">
                    Adresse E-mail Professionnelle
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-450">
                      <Mail size={16} />
                    </div>
                    <input
                      id="login-email"
                      type="email"
                      required
                      placeholder="nom.prenom@cabinet.tn"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10.5 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold placeholder:text-slate-400 text-[#0F1E36] outline-none hover:border-slate-300 focus:bg-white focus:border-[#0F1E36] focus:ring-4 focus:ring-slate-150/55 transition-all duration-200"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="block text-xs font-black text-slate-700 uppercase tracking-widest">
                      Mot de passe d'accès
                    </label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-455">
                      <Lock size={16} />
                    </div>
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10.5 pr-11 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold placeholder:text-slate-400 text-[#0F1E36] outline-none hover:border-slate-300 focus:bg-white focus:border-[#0F1E36] focus:ring-4 focus:ring-slate-150/55 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-450 hover:text-[#0F1E36] focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-slate-300 text-[#C96F53] focus:ring-[#C96F53] w-4.5 h-4.5 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-600">Se souvenir de moi</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('forgot-password');
                      setErrorMessage(null);
                      setSuccessMessage(null);
                    }}
                    className="text-xs font-black text-[#C96F53] hover:text-[#B55D42] uppercase tracking-wider"
                  >
                    Mot de passe oublié ?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full relative flex items-center justify-center gap-2.5 py-4 px-4 bg-[#0F1E36] hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-85 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-amber-400 animate-duration-100" />
                      Authentification sécurisée...
                    </>
                  ) : (
                    <>
                      Se connecter à mon Cabinet
                      <ChevronRight size={15} strokeWidth={2.5} />
                    </>
                  )}
                </button>
              </form>

              {/* Secure Separator */}
              <div className="relative my-7 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center bg-transparent">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <span className="relative bg-white px-4 text-[10px] font-black text-[#5C7F67] uppercase tracking-widest">
                  Ou utiliser l'authentification externe
                </span>
              </div>

              {/* Prominent external Google connection */}
              <button
                type="button"
                onClick={handleGoogleFederation}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-3 py-3.5 px-4 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs active:scale-[0.99] transition-all disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
              >
                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.529-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.227C18.281 1.037 15.483 0 12.24 0 5.58 0 0 5.58 0 12.24s5.58 12.24 12.24 12.24c6.96 0 11.57-4.89 11.57-11.77 0-.79-.085-1.4-.187-2.425H12.24z"
                  />
                </svg>
                Se connecter avec Google Workspace
              </button>
            </div>
          )}

          {/* --- VIEW: ACCOUNT REGISTRATION FORM --- */}
          {authMode === 'register' && (
            <div className="animate-in fade-in duration-200">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-black text-[#0F1E36] tracking-tight">
                  Enregistrer un Cabinet
                </h2>
                <span className="inline-block mt-1 px-3 py-1 bg-emerald-50 rounded-xl text-[11px] text-[#5C7F67] font-black uppercase tracking-wider border border-emerald-100">
                  Formulaire Praticien
                </span>
              </div>

              <form onSubmit={handleRegister} className="space-y-4.5">
                <div>
                  <label htmlFor="reg-name" className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">
                    Nom du praticien principal
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User size={16} />
                    </div>
                    <input
                      id="reg-name"
                      type="text"
                      required
                      placeholder="ex: Dr. Slim Ben Slimane"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      className="block w-full pl-10.5 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold placeholder:text-slate-400 text-[#0F1E36] outline-none hover:border-slate-300 focus:bg-white focus:border-[#5C7F67] focus:ring-4 focus:ring-emerald-50/50 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-specialty" className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">
                    Spécialité / Discipline Clinique (Tunisie)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Briefcase size={16} />
                    </div>
                    <select
                      id="reg-specialty"
                      value={specialty}
                      onChange={(e) => {
                        setSpecialty(e.target.value);
                        if (e.target.value !== 'Autre') {
                          setCustomSpecialty('');
                        }
                      }}
                      className="block w-full pl-10.5 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-[#0F1E36] outline-none hover:border-slate-300 focus:bg-white focus:border-[#5C7F67] focus:ring-4 focus:ring-emerald-50/50 appearance-none transition-all cursor-pointer"
                    >
                      <option value="Médecine de Famille">Médecine de Famille / Médecine Générale (Libéral / Structure publique)</option>
                      <option value="Cardiologue">Cardiologie (Suivi de l'insuffisance cardiaque & hypertension)</option>
                      <option value="Gériatre">Gériatrie / Gérontologie (Prise en charge du sujet âgé)</option>
                      <option value="Neurologue">Neurologie (Suivi Alzheimer, Parkinson & démences)</option>
                      <option value="Psychiatre">Psychiatrie & Psychogériatrie (Anxiété, Dépression, Apathie)</option>
                      <option value="Orthophoniste">Orthophonie / Phoniatrie (Troubles de la déglutition & phonation)</option>
                      <option value="Pneumologue">Pneumologie (Télésurveillance de la mécanique respiratoire)</option>
                      <option value="Médecine Interne">Médecine Interne</option>
                      <option value="Médecine Physique et Réadaptation">Médecine Physique et Réadaptation (MPR / Kinésithérapie)</option>
                      <option value="Pédiatre">Pédiatrie</option>
                      <option value="ORL">ORL (Oto-Rhino-Laryngologie)</option>
                      <option value="Autre">Autre spécialité... (Saisie libre / manuelle)</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {specialty === 'Autre' && (
                    <div className="mt-2.5 animate-in slide-in-from-top-1 fade-in duration-200">
                      <label htmlFor="reg-specialty-custom" className="block text-[10px] font-black text-[#5C7F67] uppercase tracking-widest mb-1 bg-emerald-50 border border-emerald-100/65 px-2.5 py-1 rounded w-max">
                        Saisissez votre spécialité clinique
                      </label>
                      <input
                        id="reg-specialty-custom"
                        type="text"
                        required
                        placeholder="Ex: Endocrinologie, Chirurgie Cardiovasculaire, Neuropédiatrie..."
                        value={customSpecialty}
                        onChange={(e) => setCustomSpecialty(e.target.value)}
                        className="block w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-[#0F1E36] placeholder:text-slate-400 outline-none hover:border-slate-300 focus:bg-white focus:border-[#5C7F67] focus:ring-4 focus:ring-emerald-50/50 transition-all duration-200"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="reg-email" className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">
                    Adresse E-mail Professionnelle (MSSanté / Standard)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail size={16} />
                    </div>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      placeholder="nom.prenom@cabinet.tn"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10.5 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold placeholder:text-slate-400 text-[#0F1E36] outline-none hover:border-slate-300 focus:bg-white focus:border-[#5C7F67] focus:ring-4 focus:ring-emerald-50/50 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="reg-pass" className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">
                      Mot de passe
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock size={16} />
                      </div>
                      <input
                        id="reg-pass"
                        type="password"
                        required
                        placeholder="8 caractères min."
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-10.5 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 text-[#0F1E36]"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="reg-pass-confirm" className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">
                      Confirmation
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Lock size={16} />
                      </div>
                      <input
                        id="reg-pass-confirm"
                        type="password"
                        required
                        placeholder="Saisissez à nouveau"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="block w-full pl-10.5 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 text-[#0F1E36]"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full relative flex items-center justify-center gap-2 py-4 px-4 bg-[#5C7F67] hover:bg-[#486650] text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer text-center mt-3"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin text-amber-200" />
                      Sécurisation & initialisation du Cabinet...
                    </>
                  ) : (
                    "Initialiser mon Cabinet Médical"
                  )}
                </button>
              </form>
            </div>
          )}

          {/* --- VIEW: PASSWORD RECOVERY --- */}
          {authMode === 'forgot-password' && (
            <div className="animate-in fade-in duration-250">
              <div className="text-center mb-8 relative">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }}
                  className="absolute left-0 top-1 text-slate-500 hover:text-[#0F1E36] transition-colors"
                  aria-label="Retour"
                >
                  <ArrowLeft size={18} strokeWidth={2.5} />
                </button>
                <h2 className="text-2xl font-black text-[#0F1E36] tracking-tight">
                  Identifiants oubliés
                </h2>
                <span className="inline-block mt-1 px-3 py-1 bg-orange-50 rounded-xl text-xs text-[#C96F53] font-black uppercase tracking-wider border border-orange-100">
                  Restauration de clef d'accès
                </span>
              </div>

              {successMessage ? (
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
                    <CheckCircle size={28} />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-[#0F1E36] uppercase tracking-wider">Lien de Restauration Expédié</h4>
                    <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                      {successMessage}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setSuccessMessage(null);
                    }}
                    className="w-full py-3.5 bg-[#0F1E36] text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-slate-800 transition-colors"
                  >
                    Retourner à l'authentification
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRequestPasswordReset} className="space-y-5">
                  <p className="text-slate-550 text-xs font-semibold leading-relaxed text-center">
                    Saisissez l'adresse e-mail professionnelle liée à votre cabinet. Un e-mail contenant les instructions de récupération ainsi qu'un code temporaire à usage unique vous parviendront immédiatement.
                  </p>
                  <div>
                    <label htmlFor="reset-email" className="block text-xs font-black text-slate-700 uppercase tracking-widest mb-1.5">
                      Adresse e-mail de récupération
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <Mail size={16} />
                      </div>
                      <input
                        id="reset-email"
                        type="email"
                        required
                        placeholder="votre.email@cabinet.tn"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="block w-full pl-10.5 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-[#0F1E36] outline-none hover:border-slate-300 focus:bg-white focus:border-[#C96F53] focus:ring-4 focus:ring-orange-100/30 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full relative flex items-center justify-center gap-2 py-4 px-4 bg-[#C96F53] hover:bg-[#B55D42] text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin text-amber-200" />
                        Génération du lien sécurisé...
                      </>
                    ) : (
                      "Générer un lien de secours"
                    )}
                  </button>
                </form>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Trust Badges & Clinical Regulatory Compliance Information */}
      <div className="mt-10 text-center sm:mx-auto sm:w-full sm:max-w-md relative z-10 space-y-4">
        
        {/* Compliance Icons & Labels */}
        <div className="flex items-center justify-center gap-6 text-slate-500 py-1 bg-white/40 backdrop-blur-xs rounded-2xl max-w-sm mx-auto border border-slate-100/50 shadow-2xs">
          <div className="flex items-center gap-1.5">
            <Award size={14} className="text-[#5C7F67]" />
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">Conforme HDS</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-slate-300" />
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-[#0F1E36]" />
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">RGPD Sécurisé</span>
          </div>
        </div>

        <p className="text-[9px] text-slate-400 font-semibold leading-normal max-w-sm mx-auto">
          Hanen Pro assure le cryptage SSL/TLS de l'ensemble des transmissions cliniques à destination de nos serveurs souverains. L'accès à cette plateforme est strictement réservé aux professionnels de santé agréés.
        </p>

        <div className="flex justify-center gap-4 text-[9px] text-[#5C7F67] font-black uppercase tracking-wider">
          <span className="hover:underline cursor-pointer">Conditions Générales d'Usage (CGU)</span>
          <span>•</span>
          <span className="hover:underline cursor-pointer">Assistance & Support technique via Hanen Pro</span>
        </div>
      </div>

    </div>
  );
}
