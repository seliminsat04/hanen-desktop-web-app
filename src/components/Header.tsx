import React from 'react';
import { Search, Bell, Menu, Database } from 'lucide-react';
import { mockAlerts } from '../data';
import { useAuth } from '../AuthContext';
import { seedMockDataToFirestore } from '../lib/seeder';
import { useNavigate } from 'react-router-dom';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { VoiceAlert } from '../types';
import { formatDoctorName } from '../utils/nameHelper';

export function Header() {
  const navigate = useNavigate();
  const { data: alerts } = useFirestoreData<VoiceAlert>('alerts');
  const activeAlerts = alerts.filter(a => a.status === 'Active').length;

  const { user, logout, tenantId, tenantData } = useAuth();
  const [seeding, setSeeding] = React.useState(false);

  const handleSeed = async () => {
    if (!tenantId) return;
    setSeeding(true);
    await seedMockDataToFirestore(tenantId);
    setSeeding(false);
    alert("Données injectées avec succès ! Rechargez la page ou vérifiez les listes.");
  };

  return (
    <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10 transition-all">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-slate-800 tracking-tight font-sans">
          Bonjour, {formatDoctorName(tenantData?.doctorName || user?.displayName)}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {tenantId && (
            <button 
              onClick={handleSeed}
              disabled={seeding}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
            >
              <Database size={14} />
              {seeding ? 'Installation...' : 'Installer Données de Test'}
            </button>
        )}

        <div className="relative ml-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher un patient..." 
            className="pl-10 pr-4 py-2.5 rounded-full border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all w-64"
          />
        </div>

        <button 
          onClick={() => navigate('/alerts')}
          className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition-colors"
          title="Voir les alertes"
        >
          <Bell size={22} />
          {activeAlerts > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 rounded-full border-2 border-white text-[9px] font-bold text-white flex items-center justify-center">
              {activeAlerts}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
