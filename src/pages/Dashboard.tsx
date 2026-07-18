// Stats dashboard
import React from 'react';
import { Users, PhoneCall, TrendingUp, AlertCircle, ArrowRight, Mic, Heart } from 'lucide-react';
import { mockStats } from '../data';
import { Link } from 'react-router-dom';
import { cn, formatSafeDate } from '../lib/utils';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { Patient, VoiceAlert } from '../types';
import { mockAlerts } from '../data';

import { CountUp } from '../components/CountUp';

export function Dashboard() {
  const { data: dbPatients } = useFirestoreData<Patient>('patients');
  const { data: alerts } = useFirestoreData<VoiceAlert>('alerts');
  const activeAlerts = alerts.filter(a => a.status === 'Active');
  
  const criticalPatients = dbPatients.filter(p => p.voiceHealthStatus !== 'Stable').slice(0, 5);

  const totalPatients = dbPatients.length;
  const avgAdherence = totalPatients > 0 
    ? Math.round(dbPatients.reduce((sum, p) => sum + p.adherenceRate, 0) / totalPatients)
    : 84;

  const statsCards = [
    { label: "Patients suivis", value: totalPatients, icon: Users, color: 'text-[#2e4d38]', bg: 'bg-[#ecf3ee] border-[#c0d6c7] shadow-[inset_0_2px_10px_rgba(148,168,154,0.1)]', trend: '+12 ce mois-ci', trendColor: 'text-emerald-700' },
    { label: "Appels aujourd'hui", value: mockStats.todayCalls, icon: PhoneCall, color: 'text-indigo-900', bg: 'bg-indigo-50 border-indigo-200 shadow-[inset_0_2px_10px_rgba(99,102,241,0.05)]', trend: 'Ligne Hanen active', trendColor: 'text-indigo-700' },
    { label: "Taux d'observance", value: `${avgAdherence}%`, icon: TrendingUp, color: 'text-teal-950', bg: 'bg-teal-50 border-teal-200 shadow-[inset_0_2px_10px_rgba(13,148,136,0.05)]', trend: avgAdherence >= 80 ? 'Excellente observance' : 'Attention requise', trendColor: avgAdherence >= 80 ? 'text-teal-700' : 'text-amber-700' },
    { label: "Alertes Actives", value: activeAlerts.length, icon: AlertCircle, color: 'text-rose-950', bg: 'bg-rose-50 border-rose-200 shadow-[inset_0_2px_10px_rgba(244,63,94,0.1)]', trend: activeAlerts.length > 0 ? "Action recommandée < 24h" : "Aucune urgence non résolue", trendColor: activeAlerts.length > 0 ? 'text-rose-600' : 'text-emerald-600' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Hanen Compassionate Welcome Banner */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-indigo-50/20 rounded-3xl border border-slate-200 p-8 sm:p-10 shadow-sm relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-100/30 rounded-full blur-3xl -translate-y-24 translate-x-12 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-50/20 rounded-full blur-3xl -translate-x-24 translate-y-12 pointer-events-none" />
        
        <div className="space-y-5 relative z-10 flex-1">
          <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-indigo-100 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            Veille Active Hanen
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight leading-tight max-w-xl">
            La technologie au service de la <span className="text-indigo-600 font-serif italic">bienveillance médicale</span>
          </h1>
          <p className="text-slate-600 font-medium text-base leading-relaxed max-w-2xl">
            Hanen assure une surveillance proactive et humaine pour vos patients seniors. 
            Grâce à l'analyse phono-clinique, elle identifie les signaux faibles pour vous aider à intervenir au moment opportun.
          </p>
        </div>
        
        <div className="shrink-0 flex flex-col sm:flex-row md:flex-col gap-4 relative z-10 w-full md:w-auto">
          <div className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center gap-4 shadow-sm min-w-[200px]">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner shrink-0">
              <Heart size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Accompagnement</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">Soutien Continu</p>
            </div>
          </div>
          
          <div className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center gap-4 shadow-sm min-w-[200px]">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner shrink-0">
              <Mic size={20} />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Analyse Vocale</p>
              <p className="text-sm font-bold text-slate-900 mt-0.5">Biosignaux Captés</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsCards.map((stat, i) => (
          <div key={i} className="group bg-white p-6 rounded-2xl border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 opacity-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:scale-150 transition-transform duration-700"></div>
            <div className="flex justify-between items-start relative z-10">
              <div>
                <p className="text-slate-500 text-xs font-bold tracking-wide uppercase">{stat.label}</p>
                <div className="text-3xl font-extrabold text-slate-800 mt-2 tracking-tight">
                  <CountUp value={stat.value} />
                </div>
              </div>
              <div className={cn("p-3.5 rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 border", stat.bg)}>
                <stat.icon className={stat.color} size={24} strokeWidth={2.5} />
              </div>
            </div>
            <p className={cn("text-xs mt-5 font-bold tracking-wide flex items-center gap-1", stat.trendColor)}>{stat.trend}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Patients nécessitant attention */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/60 shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] p-8">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Patients nécessitant attention</h2>
            <Link to="/patients" className="text-sm font-bold text-emerald-600 flex items-center gap-1 hover:text-emerald-700 bg-emerald-50 px-4 py-2 rounded-xl transition-colors">
              Voir tout <ArrowRight size={16} />
            </Link>
          </div>
          
          <div className="space-y-4">
            {criticalPatients.map(patient => {
              const isCrit = patient.voiceHealthStatus === 'Critique';
              return (
                <div 
                  key={patient.id} 
                  className={cn(
                    "group flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden pl-7",
                    isCrit 
                      ? "border-rose-200 bg-rose-50/20 hover:border-rose-400 hover:shadow-md" 
                      : "border-amber-100 bg-amber-50/15 hover:border-amber-300 hover:shadow-md"
                  )}
                >
                  {/* Left accent color guide for quick scanning */}
                  <div className={cn(
                    "absolute left-0 top-0 bottom-0 w-2",
                    isCrit ? "bg-rose-600" : "bg-amber-500"
                  )} />

                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "w-14 h-14 rounded-xl font-extrabold flex items-center justify-center text-xl shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-300 border",
                      isCrit 
                        ? "bg-rose-100/90 text-rose-800 border-rose-200" 
                        : "bg-amber-100/90 text-amber-800 border-amber-200"
                    )}>
                      {patient.name.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                      <Link 
                        to={`/patients/${patient.id}`} 
                        className={cn(
                          "font-extrabold transition-colors truncate block text-lg tracking-tight",
                          isCrit ? "text-rose-950 hover:text-rose-700" : "text-slate-900 hover:text-amber-800"
                        )}
                      >
                        {patient.name}
                      </Link>
                      <p className="text-sm text-slate-600 font-extrabold truncate mt-0.5">
                        {patient.age} ans • <span className="text-slate-500 font-medium">{patient.conditions?.join(', ')}</span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn(
                      "px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border",
                      isCrit 
                        ? 'bg-rose-600 border-rose-600 text-white shadow-xs' 
                        : 'bg-amber-100 border-amber-300 text-amber-800 shadow-xs'
                    )}>
                      {patient.voiceHealthStatus === 'Critique' ? '🔴 CRITIQUE' : '🟡 IMPORTANT'}
                    </span>
                    <p className="text-[11px] font-bold text-slate-500 mt-3 uppercase tracking-wider">Dernier appel: {formatSafeDate(patient.lastCallDate, 'time')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Alerts Summary */}
        <div className="bg-indigo-900 rounded-3xl shadow-sm p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500 opacity-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          
          <div className="flex justify-between items-center mb-8 relative z-10 border-b border-indigo-200 pb-5">
            <h2 className="text-xl font-bold tracking-tight flex items-center gap-2"><AlertCircle className="text-indigo-400" size={24} /> Alertes Récentes</h2>
            <Link to="/alerts" className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all">
              Voir tout
            </Link>
          </div>

          <div className="space-y-4 relative z-10">
            {activeAlerts.slice(0,3).map((alert, idx) => {
              const patient = dbPatients.find(p => p.id === alert.patientId) || dbPatients[idx % dbPatients.length];
              return (
                <div key={alert.id} className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all duration-300">
                  <div className="flex justify-between items-start mb-3">
                    <p className="font-bold text-white text-base">{patient?.name || 'Patient'}</p>
                    <span className="text-[10px] uppercase tracking-wider font-bold bg-white text-indigo-900 px-2.5 py-1 rounded-lg">
                      {alert.priority === 'High' ? 'Critique' : 'Important'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {alert.detectedSigns.slice(0, 2).map(sign => (
                      <span key={sign} className="text-[10px] font-bold tracking-wider bg-indigo-400/20 text-indigo-200 px-2.5 py-1 rounded-lg">{sign}</span>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-5 text-xs text-indigo-200 border-t border-white/10 pt-4">
                    <span className="font-medium tracking-wide">{new Date(alert.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    <Link to={`/patients/${patient?.id}`} className="text-indigo-200 hover:text-white font-bold transition-colors">
                       Consulter
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
