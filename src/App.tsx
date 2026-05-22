import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { PatientDetail } from './pages/PatientDetail';
import { Alerts } from './pages/Alerts';
import { Statistics } from './pages/Statistics';
import { Messages } from './pages/Messages';
import { Settings } from './pages/Settings';
import { useAuth } from './AuthContext';
import { Login } from './Login';
import { Chatbot } from './components/Chatbot';

function AppLayout() {
  const { user, loading } = useAuth();
  
  if (loading) {
     return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans"><p className="text-slate-500 font-medium">Chargement en cours...</p></div>;
  }
  
  if (!user) {
      return <Login />;
  }

  return (
    <div className="flex h-screen bg-[#faf8f5] text-slate-900 font-sans overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientDetail />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
      <Chatbot />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppLayout />
    </HashRouter>
  );
}
