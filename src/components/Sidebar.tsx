import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, BellRing, BarChart3, Mic, Settings, Stethoscope, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../AuthContext';
import { formatDoctorName } from '../utils/nameHelper';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Mes Patients', path: '/patients', icon: Users },
  { name: 'Alertes IA Vocales', path: '/alerts', icon: BellRing },
  { name: 'Statistiques', path: '/statistics', icon: BarChart3 },
  { name: 'Messages Vocaux', path: '/messages', icon: Mic },
  { name: 'Paramètres', path: '/settings', icon: Settings },
];

export function Sidebar() {
  const { user, tenantData, logout } = useAuth();
  
  const doctorName = formatDoctorName(tenantData?.doctorName || user?.displayName);
  const doctorSpecialty = tenantData?.doctorSpecialty || 'Cardiologue';
  
  // Resolve profile photo URL
  const avatarUrl = tenantData?.avatarUrl 
    || user?.photoURL 
    || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(doctorName.replace('Dr. ', ''))}`;

  return (
    <div className="w-64 bg-slate-900 text-slate-300 h-screen flex flex-col flex-shrink-0 sticky top-0 border-r border-slate-800 shadow-xl">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-white/10 p-1.5 rounded-xl border border-white/5 shadow-sm overflow-hidden flex-shrink-0">
          <img src="/hanen-logo.png" alt="Hanen" className="h-10 w-auto" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-lg font-black font-sans text-white tracking-tight truncate">Hanen Pro</span>
          <span className="text-[10px] text-emerald-400 font-bold tracking-widest uppercase opacity-80">Espace Médecin</span>
        </div>
      </div>

      <nav className="flex-1 px-4 py-8 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium',
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 font-semibold shadow-sm'
                  : 'hover:bg-slate-800 hover:text-white'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={20} className={isActive ? "text-emerald-400" : "text-slate-400"} />
                {item.name}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center justify-between gap-2.5 bg-slate-850 p-2.5 rounded-xl border border-slate-800/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
              <img 
                src={avatarUrl} 
                alt={doctorName} 
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover" 
              />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-xs font-bold text-white truncate" title={doctorName}>{doctorName}</p>
              <p className="text-[10px] text-slate-400 truncate" title={doctorSpecialty}>{doctorSpecialty}</p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={logout}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-all shrink-0 cursor-pointer"
            title="Se déconnecter de mon espace"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
