// Diagnostic analytics
import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Legend, LineChart, Line, PieChart, Pie, Cell 
} from 'recharts';
import { mockPatients, mockAlerts } from '../data';
import { useFirestoreData } from '../hooks/useFirestoreData';
import { Patient, VoiceAlert } from '../types';
import { 
  ArrowUpRight, ArrowDownRight, Users, Activity, Heart, Info, 
  Sparkles, Filter, Calendar, Download, AlertTriangle, FileText, CheckCircle2,
  TrendingUp, Star, Phone, Shield, ThumbsUp, Radio, AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

// Static Voice Anomalies Category data
const voiceAnomaliesData = [
  { name: 'Essoufflement (Dyspnée)', count: 38, percentage: 32, severity: 'Haute' },
  { name: 'Fatigue / Voix Faible', count: 30, percentage: 25, severity: 'Modérée' },
  { name: 'Tremblement / Instabilité', count: 18, percentage: 15, severity: 'Haute' },
  { name: 'Élocution ralentie', count: 20, percentage: 17, severity: 'Basse' },
  { name: 'Toux / Irritation', count: 13, percentage: 11, severity: 'Basse' },
];

// Horizontal reasons for calling Hanen
const reasonsData = [
  { reason: 'Oubli de traitement', count: 142, color: '#f59e0b' },
  { reason: 'Détresse morale (Solitude)', count: 98, color: '#6366f1' },
  { reason: 'Effet indésirable déclaré', count: 48, color: '#ef4444' },
  { reason: 'Besoin d\'information santé', count: 37, color: '#10b981' },
  { reason: 'Rendez-vous cabinet', count: 24, color: '#64748b' },
];

const COLORS_PIE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

export function Statistics() {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '3m' | '12m'>('30d');
  const [selectedPathology, setSelectedPathology] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'vocals' | 'dignity' | 'reports'>('overview');
  const [isExporting, setIsExporting] = useState(false);
  const [showExportSuccess, setShowExportSuccess] = useState(false);

  const { data: dbPatients } = useFirestoreData<Patient>('patients');
  const { data: dbAlerts } = useFirestoreData<VoiceAlert>('alerts');

  const activePatientsList = useMemo(() => {
    return dbPatients && dbPatients.length > 0 ? dbPatients : mockPatients;
  }, [dbPatients]);

  const activeAlertsList = useMemo(() => {
    return dbAlerts && dbAlerts.length > 0 ? dbAlerts : mockAlerts;
  }, [dbAlerts]);

  // 1. Dynamic filtering of patient list based on pathologie
  const filteredPatients = useMemo(() => {
    if (selectedPathology === 'all') return activePatientsList;
    return activePatientsList.filter(p => 
      p.conditions && p.conditions.some(c => c.toLowerCase().includes(selectedPathology.toLowerCase()))
    );
  }, [activePatientsList, selectedPathology]);

  // 2. Computed dynamic KPIs based on filtering
  const kpis = useMemo(() => {
    const total = filteredPatients.length;
    if (total === 0) {
      return {
        totalFollowed: 0,
        avgAdherence: 0,
        avgDignity: 0,
        activeAlerts: 0,
        appelsCount: 0
      };
    }

    const sumAdherence = filteredPatients.reduce((acc, curr) => acc + curr.adherenceRate, 0);
    const sumDignity = filteredPatients.reduce((acc, curr) => acc + curr.dignityIndex, 0);
    
    // Count alerts related to the filtered list
    const filteredPatientIds = filteredPatients.map(p => p.id);
    const activeAlertsCount = activeAlertsList.filter(a => 
      filteredPatientIds.includes(a.patientId) && a.status === 'Active'
    ).length;

    // Estimate call volumes (simulated scaling per patient)
    const baseCallsPerPatient = timeRange === '7d' ? 3 : timeRange === '30d' ? 12 : timeRange === '3m' ? 36 : 144;
    const estimatedCallsVec = filteredPatients.reduce((acc, curr) => {
      // Patients with conditions or low adherence call slightly more
      const factor = curr.adherenceRate < 80 ? 1.4 : 1.0;
      return acc + Math.round(baseCallsPerPatient * factor);
    }, 0);

    return {
      totalFollowed: total,
      avgAdherence: Math.round(sumAdherence / total),
      avgDignity: Math.round(sumDignity / total),
      activeAlerts: activeAlertsCount,
      appelsCount: estimatedCallsVec
    };
  }, [filteredPatients, timeRange]);

  // 3. Dynamic chart timeline data based on time range
  const timelineData = useMemo(() => {
    const defaultBaseline = selectedPathology === 'all' 
      ? 84 
      : selectedPathology.includes('Cardiaque') ? 75
      : selectedPathology.includes('Diabète') ? 92
      : selectedPathology.includes('Hypertension') ? 88 : 81;

    switch (timeRange) {
      case '7d':
        return [
          { label: 'Jér. -6', observance: defaultBaseline - 3, appels: Math.round(kpis.appelsCount / 7 * 0.8), fatigue: 22, humeur: 78 },
          { label: 'Jér. -5', observance: defaultBaseline - 1, appels: Math.round(kpis.appelsCount / 7 * 1.1), fatigue: 24, humeur: 80 },
          { label: 'Jér. -4', observance: defaultBaseline + 2, appels: Math.round(kpis.appelsCount / 7 * 1.3), fatigue: 18, humeur: 85 },
          { label: 'Jér. -3', observance: defaultBaseline + 1, appels: Math.round(kpis.appelsCount / 7 * 0.9), fatigue: 19, humeur: 82 },
          { label: 'Jér. -2', observance: defaultBaseline - 2, appels: Math.round(kpis.appelsCount / 7 * 1.0), fatigue: 27, humeur: 77 },
          { label: 'Hier',     observance: defaultBaseline,     appels: Math.round(kpis.appelsCount / 7 * 1.2), fatigue: 21, humeur: kpis.avgDignity },
          { label: 'Aujourd\'hui', observance: kpis.avgAdherence, appels: Math.round(kpis.appelsCount / 7 * 0.7), fatigue: 23, humeur: kpis.avgDignity + 1 },
        ];
      case '3m':
        return [
          { label: 'Mars S1', observance: defaultBaseline - 4, appels: Math.round(kpis.appelsCount / 6), fatigue: 30, humeur: 72 },
          { label: 'Mars S2', observance: defaultBaseline - 1, appels: Math.round(kpis.appelsCount / 6 * 0.9), fatigue: 26, humeur: 75 },
          { label: 'Avr S1', observance: defaultBaseline + 3, appels: Math.round(kpis.appelsCount / 6 * 1.1), fatigue: 22, humeur: 79 },
          { label: 'Avr S2', observance: defaultBaseline + 2, appels: Math.round(kpis.appelsCount / 6 * 1.2), fatigue: 24, humeur: 81 },
          { label: 'Mai S1', observance: defaultBaseline, appels: Math.round(kpis.appelsCount / 6 * 1.0), fatigue: 28, humeur: 78 },
          { label: 'Mai S2', observance: kpis.avgAdherence, appels: Math.round(kpis.appelsCount / 6 * 0.8), fatigue: 25, humeur: kpis.avgDignity },
        ];
      case '12m':
        return [
          { label: 'Juin 25', observance: 82, appels: Math.round(kpis.appelsCount / 12 * 0.8), fatigue: 35, humeur: 70 },
          { label: 'Aoû 25', observance: 80, appels: Math.round(kpis.appelsCount / 12 * 0.7), fatigue: 38, humeur: 68 },
          { label: 'Oct 25', observance: 85, appels: Math.round(kpis.appelsCount / 12 * 1.0), fatigue: 30, humeur: 74 },
          { label: 'Déc 25', observance: 88, appels: Math.round(kpis.appelsCount / 12 * 1.2), fatigue: 24, humeur: 78 },
          { label: 'Fév 26', observance: 86, appels: Math.round(kpis.appelsCount / 12 * 0.9), fatigue: 27, humeur: 81 },
          { label: 'Avr 26', observance: 84, appels: Math.round(kpis.appelsCount / 12 * 1.1), fatigue: 25, humeur: 79 },
          { label: 'Mai 26', observance: kpis.avgAdherence, appels: Math.round(kpis.appelsCount / 12), fatigue: 23, humeur: kpis.avgDignity },
        ];
      case '30d':
      default:
        return [
          { label: '01 Mai', observance: defaultBaseline - 5, appels: Math.round(kpis.appelsCount / 5 * 0.8), fatigue: 29, humeur: 70 },
          { label: '05 Mai', observance: defaultBaseline - 2, appels: Math.round(kpis.appelsCount / 5 * 1.1), fatigue: 31, humeur: 74 },
          { label: '10 Mai', observance: defaultBaseline + 3, appels: Math.round(kpis.appelsCount / 5 * 1.3), fatigue: 25, humeur: 81 },
          { label: '15 Mai', observance: defaultBaseline + 1, appels: Math.round(kpis.appelsCount / 5 * 0.9), fatigue: 26, humeur: 79 },
          { label: '20 Mai', observance: defaultBaseline - 1, appels: Math.round(kpis.appelsCount / 5 * 1.0), fatigue: 22, humeur: 78 },
          { label: '21 Mai', observance: kpis.avgAdherence, appels: Math.round(kpis.appelsCount / 5 * 0.9), fatigue: 24, humeur: kpis.avgDignity },
        ];
    }
  }, [timeRange, selectedPathology, kpis]);

  // 4. Grouped conditions count for pie chart
  const pathologyPieData = useMemo(() => {
    const rawCounts: Record<string, number> = {};
    activePatientsList.forEach(p => {
      p.conditions.forEach(c => {
        rawCounts[c] = (rawCounts[c] || 0) + 1;
      });
    });
    return Object.entries(rawCounts).map(([name, value]) => ({ name, value }));
  }, [activePatientsList]);

  // 5. Sorted Patient lists for the boards
  const highestAdherencePatients = useMemo(() => {
    return [...filteredPatients]
      .sort((a, b) => b.adherenceRate - a.adherenceRate)
      .slice(0, 5);
  }, [filteredPatients]);

  const vigilancePatients = useMemo(() => {
    return [...filteredPatients]
      .filter(p => p.adherenceRate < 80 || p.voiceHealthStatus !== 'Stable')
      .sort((a, b) => a.adherenceRate - b.adherenceRate || (b.dignityIndex - a.dignityIndex))
      .slice(0, 5);
  }, [filteredPatients]);

  const mostActivePatients = useMemo(() => {
    return [...filteredPatients]
      .sort((a, b) => b.age - a.age) // Seniors have higher active phone needs
      .slice(0, 5);
  }, [filteredPatients]);

  const handleExportCSV = () => {
    try {
      const headers = ["ID_Anonyme", "Age", "Pathologies", "Observance", "Indice_Dignite", "Statut_Vocal"];
      const rows = filteredPatients.map((p, index) => {
        // Create an anonymous ID
        const anonymousId = `ANON_${(index + 1).toString().padStart(4, '0')}`;
        // Escape pathologies list for CSV (wrap in quotes if contains comma)
        const pathologies = `"${p.conditions.join(", ")}"`;
        return [
          anonymousId,
          p.age,
          pathologies,
          p.adherenceRate,
          p.dignityIndex,
          p.voiceHealthStatus
        ].join(",");
      });

      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Export_Cohorte_Anonymise_${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Erreur d'exportation CSV:", err);
    }
  };

  const handleExportReport = () => {
    setIsExporting(true);
    
    setTimeout(() => {
      try {
        const doc = new jsPDF();
        doc.setFont("helvetica");

        // Primary header visual banner
        doc.setFillColor(67, 56, 202); // Elegant Indigo color
        doc.rect(0, 0, 210, 38, 'F');

        // Main Title on Banner
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text("HANEN HEALTH - RAPPORT DE COHORTE CLINIQUE", 15, 18);

        // Subtitles and doctor/cabinet information on Banner
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Cabinet Medical Dr. Slim - Tunis, Tunisie", 15, 25);
        
        const filterStr = selectedPathology === 'all' ? 'Toutes pathologies' : selectedPathology;
        const timeStr = timeRange === '7d' ? '7 Jours' : timeRange === '30d' ? '30 Jours' : timeRange === '3m' ? '3 Mois' : '1 An';
        doc.text(`Genere le: ${new Date().toLocaleDateString('fr-FR')} | Periode: ${timeStr} | Filtres: ${filterStr}`, 15, 31);

        // --- SECTION 1: GLOBAL CLINICAL INDICATORS ---
        doc.setTextColor(15, 23, 42); // Slate-900
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("1. Indicateurs Globaux Cliniques (KPIs)", 15, 50);

        // Render structured columns / grid
        doc.setFontSize(9.5);
        doc.setFont("helvetica", "bold");
        doc.text("Metrique", 20, 60);
        doc.text("Valeur", 130, 60);
        doc.text("Appreciation medicale", 150, 60);

        // Table divider
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.line(15, 63, 195, 63);

        const kpiRows = [
          { name: "Patients actifs suivis par Hanen", val: `${kpis.totalFollowed}`, desc: "Actifs en cabinet" },
          { name: "Taux d'observance therapeutique moyen", val: `${kpis.avgAdherence}%`, desc: kpis.avgAdherence >= 80 ? "Excellente fidelite" : "Vigilance requise" },
          { name: "Volume d'appels geres ce mois-ci", val: `${kpis.appelsCount}`, desc: "Interactions sémantiques" },
          { name: "Indice moyen de Dignite Senior", val: `${kpis.avgDignity}/100`, desc: "Ecoute active et respect INPDP" },
          { name: "Nombre d'alertes vocales actives", val: `${kpis.activeAlerts}`, desc: kpis.activeAlerts > 0 ? "ATTENTION: Signal clinique actif" : "Aucun signal critique" }
        ];

        let yRowPos = 70;
        kpiRows.forEach(row => {
          doc.setFont("helvetica", "bold");
          doc.text(row.name, 20, yRowPos);
          doc.text(row.val, 130, yRowPos);
          doc.setFont("helvetica", "normal");
          doc.text(row.desc, 150, yRowPos);
          
          // Row divider
          doc.setDrawColor(241, 245, 249);
          doc.line(15, yRowPos + 3, 195, yRowPos + 3);
          yRowPos += 8;
        });

        // --- SECTION 2: IA CLINICAL INSIGHTS ---
        yRowPos += 8;
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("2. Synthese d'Intelligence Artificielle Cohorte", 15, yRowPos);

        doc.setFontSize(9.5);
        doc.setFont("helvetica", "normal");
        
        const mainAnalysisText = 
          `Cher Dr. Slim,\n\n` +
          `L'analyse clinique de votre cohorte montre une observance globale moyenne stable de ${kpis.avgAdherence}%. ` +
          `Les detections vocales revelent qu'Hanen a effectue un total de ${kpis.appelsCount} communications de proximite.\n\n` +
          `POINT DE VIGILANCE CRITIQUE :\n` +
          `Les insuffisants cardiaques de la cohorte presentent des signes de fatigue vocale accrus associes a une baisse de prise medicamenteuse de l'ordre de 15% en fin de journee. Une surveillance passive sémantique est active.\n\n` +
          `SUGGESTIONS IA RECOMMANDEES :\n` +
          `1. Tele-confort : Declencher les appels de soins automatiques vers 17h00.\n` +
          `2. Evaluation de proximite : Une consultation chez Mme Mansour est conseillee (Alerte active, Dignite: 55).`;

        const textLines = doc.splitTextToSize(mainAnalysisText, 180);
        doc.text(textLines, 15, yRowPos + 8);

        // --- SECTION 3: VIGILANCE PATIENTS TABLE ---
        yRowPos += 8 + (textLines.length * 5) + 12;
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.text("3. Patients necessitant une Vigilance Immediate", 15, yRowPos);

        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text("Nom du Patient", 20, yRowPos + 8);
        doc.text("Age / Affections", 70, yRowPos + 8);
        doc.text("Observance", 140, yRowPos + 8);
        doc.text("Statut Vocal", 168, yRowPos + 8);

        // Divider
        doc.setDrawColor(226, 232, 240);
        doc.line(15, yRowPos + 11, 195, yRowPos + 11);

        let yPatPos = yRowPos + 17;
        vigilancePatients.forEach(patient => {
          doc.setFont("helvetica", "bold");
          doc.text(patient.name, 20, yPatPos);
          
          doc.setFont("helvetica", "normal");
          doc.text(`${patient.age} ans - ${patient.conditions.join(', ')}`, 70, yPatPos);
          doc.text(`${patient.adherenceRate}%`, 140, yPatPos);
          doc.text(patient.voiceHealthStatus === 'Stable' ? 'Stable' : 'Vigilance active', 168, yPatPos);
          
          doc.setDrawColor(241, 245, 249);
          doc.line(15, yPatPos + 3, 195, yPatPos + 3);
          yPatPos += 8;
        });

        // Footer at bottom Page 1
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text("Document clinique confidentiel Hanen - Genere de maniere securisee, conforme aux reglementations INPDP.", 15, 282);
        doc.text("Page 1 de 2", 182, 282);

        // --- PAGE 2: GRAPHIQUES ---
        doc.addPage();
        
        // Header Page 2
        doc.setFillColor(67, 56, 202); // Elegant Indigo color
        doc.rect(0, 0, 210, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("ANNEXE : GRAPHIQUES ET COURBES D'ÉVOLUTION", 15, 16);

        // CHART 1: Évolution de l'Observance Thérapeutique
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(12);
        doc.text("Évolution de l'Observance Thérapeutique (%)", 15, 45);

        const startX = 25;
        const startY = 85;
        const graphWidth = 160;
        const graphHeight = 30; // Scale 70 to 100% for better visibility
        const minVal = 60;
        const maxVal = 100;
        const range = maxVal - minVal;

        // Draw axes
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.4);
        doc.line(startX, startY, startX + graphWidth, startY); // X
        doc.line(startX, startY, startX, startY - graphHeight - 5); // Y
        
        // Axis Labels
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.text("60%", startX - 8, startY);
        doc.text("80%", startX - 8, startY - (graphHeight / 2));
        doc.text("100%", startX - 8, startY - graphHeight);

        // Plot Line Chart
        const pts = timelineData.length;
        const stepX = graphWidth / (pts > 1 ? pts - 1 : 1);
        let prevX = startX;
        let prevY = startY;

        timelineData.forEach((d, i) => {
            const x = startX + i * stepX;
            // constrain value above 60
            const cVal = Math.max(minVal, Math.min(d.observance, maxVal));
            const y = startY - ((cVal - minVal) / range) * graphHeight;
            
            // Label X
            doc.setFontSize(7.5);
            doc.setTextColor(100, 100, 100);
            doc.text(d.label, x - 5, startY + 6);
            
            // Line from prev
            if (i > 0) {
                doc.setDrawColor(67, 56, 202); // Indigo
                doc.setLineWidth(0.8);
                doc.line(prevX, prevY, x, y);
            }
            
            prevX = x;
            prevY = y;
        });

        // Loop again purely for drawing points over lines
        timelineData.forEach((d, i) => {
            const x = startX + i * stepX;
            const cVal = Math.max(minVal, Math.min(d.observance, maxVal));
            const y = startY - ((cVal - minVal) / range) * graphHeight;
            
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(67, 56, 202);
            doc.setLineWidth(0.6);
            doc.circle(x, y, 1.8, 'FD'); // Fill and border
            
            // Value
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", "bold");
            doc.text(`${d.observance}%`, x - 3, y - 3);
        });

        // CHART 2: Répartition des Pathologies
        let yPathologies = 120;
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text("Répartition des Pathologies Suivies (Cohorte Active)", 15, yPathologies);

        const barStartX = 70;
        let barY = yPathologies + 12;
        const maxCount = Math.max(...pathologyPieData.map(p => p.value), 1);
        
        pathologyPieData.forEach(p => {
            doc.setFontSize(9);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(71, 85, 105);
            doc.text(p.name.substring(0, 30), 15, barY + 3.5);
            
            // Horizontal Bar
            const barWidth = (p.value / maxCount) * 100;
            doc.setFillColor(14, 165, 233); // lively blue
            doc.rect(barStartX, barY, barWidth, 5, 'F');
            
            // Value next to bar
            doc.setFontSize(8.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text(`${p.value} patient(s)`, barStartX + barWidth + 3, barY + 3.5);
            
            barY += 9;
        });

        // Footer Page 2
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184);
        doc.text("Document clinique confidentiel Hanen - Genere de maniere securisee, conforme aux reglementations INPDP.", 15, 282);
        doc.text("Page 2 de 2", 182, 282);

        // Native PDF Save
        doc.save(`Rapport_Clinique_Hanen_Dr_Slim_${selectedPathology}_30J.pdf`);
        setShowExportSuccess(true);
        setTimeout(() => setShowExportSuccess(false), 5000);
      } catch (err) {
        console.error("Erreur d'exportation PDF:", err);
      } finally {
        setIsExporting(false);
      }
    }, 1000);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16 print:bg-white print:p-0">
      
      {/* Title & Action Filters Bar */}
      <div id="stats-header-banner" className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-6 print:hidden">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
            Tableau d'Observance & Clinique
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Indicateurs cliniques, adhérence thérapeutique au cabinet et indices de dignité senior.
          </p>
        </div>
        
        <div id="stats-filter-container" className="flex flex-wrap items-center gap-3">
          {/* Pathologie Selector */}
          <div className="flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
            <Filter size={14} className="text-slate-500 mr-2" />
            <select 
              id="filter-pathology"
              value={selectedPathology}
              onChange={(e) => setSelectedPathology(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer text-slate-700 font-bold"
            >
              <option value="all">Toutes pathologies</option>
              <option value="Cardiaque">Insuffisance Cardiaque</option>
              <option value="Diabète">Diabète Type 2</option>
              <option value="Hypertension">Hypertension</option>
              <option value="Alzheimer">Maladie d'Alzheimer</option>
              <option value="Isolement">Risque d'Isolement</option>
            </select>
          </div>

          {/* Time range selection buttons */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
            {(['7d', '30d', '3m', '12m'] as const).map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setTimeRange(range)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  timeRange === range
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {range === '7d' ? '7 J' : range === '30d' ? '30 J' : range === '3m' ? '3 M' : '1 An'}
              </button>
            ))}
          </div>

          {/* Download CSV */}
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-sm"
          >
            <Download size={14} />
            Export Anonymisé (CSV)
          </button>

          {/* Export Report */}
          <button
            id="btn-export-clinical-report"
            onClick={handleExportReport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-[0_4px_12px_rgba(79,70,229,0.25)]"
          >
            {isExporting ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Download size={14} />
            )}
            {isExporting ? 'Génération...' : 'Exporter Rapport (PDF)'}
          </button>
        </div>
      </div>

      {showExportSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-2xl flex items-center gap-3 text-sm font-bold animate-in fade-in slide-in-from-top-2 print:hidden">
          <CheckCircle2 className="text-emerald-500 animate-pulse" size={20} />
          Rapport clinique prêt à imprimer. La mise en page a été restructurée pour la clarté médicale.
        </div>
      )}

      {/* 5-KPI High-impact row */}
      <div id="kpi-summary-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
        {/* Total follow up */}
        <div id="kpi-total-patients" className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between hover:border-indigo-100 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Suivis Actifs</span>
            <span className="p-2 bg-indigo-50 rounded-xl text-indigo-600"><Users size={16} /></span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-extrabold text-slate-800 tracking-tight">{kpis.totalFollowed}</p>
            <p className="text-[10px] text-emerald-600 font-bold mt-1 flex items-center gap-1">
              <ArrowUpRight size={12} /> +12% ce mois-ci
            </p>
          </div>
        </div>

        {/* Adherence rates */}
        <div id="kpi-observance-rate" className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between hover:border-indigo-100 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Observance Moyenne</span>
            <span className="p-2 bg-emerald-50 rounded-xl text-emerald-600"><Activity size={16} /></span>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-slate-800 tracking-tight">{kpis.avgAdherence}%</span>
              <span className="text-xs font-medium text-slate-500">du traitement</span>
            </div>
            <p className={cn(
              "text-[10px] font-bold mt-1 flex items-center gap-1",
              kpis.avgAdherence >= 80 ? "text-emerald-600" : "text-amber-600"
            )}>
              {kpis.avgAdherence >= 80 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {kpis.avgAdherence >= 80 ? 'Haute fidélité' : 'Attention requise'}
            </p>
          </div>
        </div>

        {/* Total Call volume */}
        <div id="kpi-total-calls" className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between hover:border-indigo-100 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Appels Hanen</span>
            <span className="p-2 bg-pink-50 rounded-xl text-pink-500"><Phone size={16} /></span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-extrabold text-slate-800 tracking-tight">{kpis.appelsCount}</p>
            <p className="text-[10px] text-slate-500 font-bold mt-1">
              Durée moyenne: <span className="text-indigo-600">4min 20s</span>
            </p>
          </div>
        </div>

        {/* Dignity and comfort Index */}
        <div id="kpi-avg-dignity" className="bg-white p-5 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between hover:border-indigo-100 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Indice Dignité Senior</span>
            <span className="p-2 bg-rose-50 rounded-xl text-rose-500"><Heart size={16} /></span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-extrabold text-slate-800 tracking-tight">{kpis.avgDignity}/100</p>
            <p className="text-[10px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <Star size={10} className="fill-emerald-500 stroke-none" /> Écoute et intégrité préservées
            </p>
          </div>
        </div>

        {/* Active vocal alerts */}
        <div id="kpi-active-alerts" className={cn(
          "p-5 rounded-2xl border shadow-sm flex flex-col justify-between transition-colors",
          kpis.activeAlerts > 0 
            ? "bg-rose-50/60 border-rose-200 hover:border-rose-300" 
            : "bg-white border-slate-200/60 hover:border-slate-300"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Alertes Actives</span>
            <span className={cn(
              "p-2 rounded-xl",
              kpis.activeAlerts > 0 ? "bg-rose-100 text-rose-600" : "bg-slate-100 text-slate-600"
            )}><AlertTriangle size={16} /></span>
          </div>
          <div className="mt-4">
            <p className="text-2xl font-extrabold text-slate-800 tracking-tight">{kpis.activeAlerts}</p>
            <p className={cn(
              "text-[10px] font-bold mt-1",
              kpis.activeAlerts > 0 ? "text-rose-600 animate-pulse" : "text-slate-500"
            )}>
              {kpis.activeAlerts > 0 ? 'Urgence d\'intervention' : 'Aucune alerte critique'}
            </p>
          </div>
        </div>

      </div>

      {/* Sub-Navigation Tabs inside the Stats page */}
      <div id="statistics-tab-navigation" className="flex border-b border-slate-200/70 pb-px gap-6 print:hidden">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            "py-3 font-bold text-sm border-b-2 transition-all relative focus:outline-none",
            activeTab === 'overview'
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          Vue Temporelle & Observance
        </button>
        <button
          onClick={() => setActiveTab('vocals')}
          className={cn(
            "py-3 font-bold text-sm border-b-2 transition-all relative focus:outline-none",
            activeTab === 'vocals'
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          Analyse Vocale & Pathologies
        </button>
        <button
          onClick={() => setActiveTab('dignity')}
          className={cn(
            "py-3 font-bold text-sm border-b-2 transition-all relative focus:outline-none",
            activeTab === 'dignity'
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          Dignité & Isolement
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={cn(
            "py-3 font-bold text-sm border-b-2 transition-all relative focus:outline-none",
            activeTab === 'reports'
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          )}
        >
          Rapport IA & Insights
        </button>
      </div>

      {/* Main Container - Conditional tab views */}
      <div className="space-y-8">
        
        {/* TAB 1: OVERVIEW & EVOLUTION TEMPORELLE */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Timeline Linear Area Chart */}
            <div id="chart-evolution-panel" className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 lg:col-span-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-slate-800 tracking-tight">Suivi Chronologique Médicaments / Humeur</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Corrélation temporelle des comportements d'adhérence du patient.</p>
                </div>
                {/* Chart indicators legend layout */}
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>Observance (%)</span>
                  <span className="flex items-center gap-1.5 text-slate-600"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>Indice de moral (Dignité)</span>
                </div>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                    <defs>
                      <linearGradient id="colorObservance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4338ca" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#4338ca" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDignityTrack" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748B' }} domain={[40, 100]} />
                    <Tooltip 
                      contentStyle={{ background: '#1e293b', color: '#f8fafc', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                      itemStyle={{ color: '#f8fafc' }}
                    />
                    <Area type="monotone" name="Observance" dataKey="observance" stroke="#4338ca" strokeWidth={3} fillOpacity={1} fill="url(#colorObservance)" />
                    <Area type="monotone" name="Moral / Dignité" dataKey="humeur" stroke="#f43f5e" strokeWidth={2} fillOpacity={1} fill="url(#colorDignityTrack)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 p-4.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-start gap-3">
                <span className="p-1 bg-indigo-50 text-indigo-600 rounded-lg mt-0.5"><Sparkles size={16} /></span>
                <div>
                  <h4 className="text-xs font-bold text-slate-700">Observation analytique de Hanen</h4>
                  <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                    L'observance rebondit systématiquement après les appels de satisfaction d'écoute active planifiés en milieu de semaine. Le moral et la prise de médicaments évoluent en symbiose étroite (+85% de corrélation).
                  </p>
                </div>
              </div>
            </div>

            {/* Calling Reasons Distribution Chart */}
            <div id="reasons-horizontal-panel" className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 tracking-tight">Motifs d'appels à Hanen (30J)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Analyses sémantiques basées sur les transcriptions audio.</p>
              </div>

              <div className="mt-6 space-y-4">
                {reasonsData.map((item, idx) => {
                  const maxCount = Math.max(...reasonsData.map(r => r.count));
                  const percentWidth = Math.round((item.count / maxCount) * 100);
                  
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-700">{item.reason}</span>
                        <span className="font-semibold text-slate-500">{item.count} appels</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000" 
                          style={{ 
                            width: `${percentWidth}%`,
                            backgroundColor: item.color 
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-5 border-t border-slate-100 text-center">
                <p className="text-xs font-bold text-indigo-600 flex items-center justify-center gap-1 hover:underline cursor-pointer">
                  Consulter les transcriptions médicales complètes <ArrowUpRight size={14} />
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DETECTED VOCAL SIGNS & PATHOLOGY BREAKDOWNS */}
        {activeTab === 'vocals' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Pathology share with Compliance details */}
            <div id="chart-pathology-distribution" className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 tracking-tight">Répartition par Pathologie active</h3>
                <p className="text-xs text-slate-500 mt-0.5">Nombre total de seniors par affection médicale chronique au cabinet.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                {/* Pie chart representing pathological status */}
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pathologyPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pathologyPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3.5">
                  {pathologyPieData.map((item, idx) => (
                    <div key={idx} className="flex items-start justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS_PIE[idx % COLORS_PIE.length] }} />
                        <span className="font-bold text-slate-700">{item.name}</span>
                      </div>
                      <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">{item.value} patients</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-xs font-bold text-slate-700 mb-3">Observance moyenne par pathologie</h4>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Diabète Type 2</span>
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">92%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Hypertension</span>
                    <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">88%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Insuffisance Cardiaque</span>
                    <span className="font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full">75%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Maladie d'Alzheimer</span>
                    <span className="font-bold text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full">65%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Vocal Signs and fatigue/dyspnea indicator */}
            <div id="chart-vocal-anomalies" className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-6 space-y-6">
              <div>
                <h3 className="text-base font-bold text-slate-800 tracking-tight">Anomalies Vocales Détectées (30J)</h3>
                <p className="text-xs text-slate-500 mt-0.5">Biomarqueurs vocaux identifiés par l'intelligence artificielle Hanen.</p>
              </div>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={voiceAnomaliesData} margin={{ top: 10, right: 10, bottom: 5, left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={34} name="Cas identifiés" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-800 tracking-tight uppercase block">Gravité clinique des anomalies detectées</span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl">
                    <span className="text-[10px] text-rose-700 font-bold uppercase tracking-wider block">Insuffisance Cardiaque & Parkinson</span>
                    <p className="text-xs font-bold text-rose-900 mt-1">Essoufflement aigu & tremblement</p>
                    <p className="text-[10px] text-rose-600 font-semibold mt-0.5">56 cas signalés (Niveau de vigilance: CRITIQUE)</p>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <span className="text-[10px] text-amber-700 font-bold uppercase tracking-wider block">Isolement social & sédentarité</span>
                    <p className="text-xs font-bold text-amber-900 mt-1">Fatigue vocale / pauses prolongées</p>
                    <p className="text-[10px] text-amber-600 font-semibold mt-0.5">30 cas signalés (Niveau de vigilance: MODÉRÉ)</p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 3: DIGNITÈ INDEX ANALYSIS */}
        {activeTab === 'dignity' && (
          <div id="dignity-insights-module" className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  Indice de Dignité & Qualité d'accompagnement
                </h3>
                <p className="text-slate-500 text-sm mt-1">
                  Enquête continue anonymisée mesurant le ressenti des patients par rapport à l'IA d'appel de proximité.
                </p>
              </div>

              <div className="p-4 bg-emerald-50 text-emerald-900 rounded-2xl border border-emerald-100 flex items-center gap-3.5 max-w-sm">
                <ThumbsUp className="text-emerald-500 shrink-0" size={24} />
                <div>
                  <h4 className="font-bold text-sm">Satisfaction: 94.6%</h4>
                  <p className="text-[11px] text-emerald-700 mt-0.5 font-medium">Les patients expriment un fort sentiment d'écoute et de respect de leur autonomie.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
              
              <div className="space-y-2 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-slate-800 text-sm">Respect du Repos</h4>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-indigo-600">98%</span>
                  <span className="text-xs text-slate-500">conformité</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '98%' }}></div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 font-medium">Aucun appel pendant la sieste préservée ou après 19h30 en Tunisie.</p>
              </div>

              <div className="space-y-2 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-slate-800 text-sm">Écoute Libre (Parole)</h4>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-indigo-600">89%</span>
                  <span className="text-xs text-slate-500">d'auto-expression</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '89%' }}></div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 font-medium">L'IA laisse le senior s'exprimer pleinement sans l'interrompre brutalement.</p>
              </div>

              <div className="space-y-2 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-slate-800 text-sm">Soulagement Solitude</h4>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-indigo-600">76%</span>
                  <span className="text-xs text-slate-500">baisse ressentie</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '76%' }}></div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 font-medium">Les aînés rapportent se sentir plus entourés et en sécurité psychologique.</p>
              </div>

              <div className="space-y-2 p-5 bg-slate-50 rounded-2xl border border-slate-100">
                <h4 className="font-bold text-slate-800 text-sm">Absence Frustration</h4>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-extrabold text-indigo-600">81%</span>
                  <span className="text-xs text-slate-500">clarté d'échange</span>
                </div>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: '81%' }}></div>
                </div>
                <p className="text-[10px] text-slate-500 mt-2 font-medium">Dialecte tunisien (Derja) compris et imité sans sentiment d'échecs de discussion.</p>
              </div>

            </div>

            {/* Inpdp check info */}
            <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100/70 flex items-start gap-3 justify-between">
              <div className="flex items-start gap-3">
                <Shield className="text-indigo-600 shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-bold text-indigo-900 text-sm">Alignement INPDP & Droits Humains</h4>
                  <p className="text-xs text-indigo-700/80 leading-relaxed max-w-3xl mt-0.5">
                    Toutes les métriques de dignité respectent de bout en bout l'anonymat de l'INPDP (Tunisie). La dignité n'est pas qu'un indicateur de statistiques, c'est le cadre de conception éthique de Hanen pour protéger le moral des patients face au vieillissement.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 4: REPORTS & IA SYNTHESIS */}
         {activeTab === 'reports' && (
           <div id="ai-generative-cohort-summary" className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-8 space-y-6">
             <div className="flex items-center justify-between">
               <div className="flex items-center gap-2.5">
                 <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                   <Sparkles size={20} />
                 </div>
                 <div>
                   <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">Rapport de Cohorte Clinique IA (Hanen)</h3>
                   <p className="text-xs text-slate-500">Analyse consolidée du comportement des patients générée le 21 mai 2026.</p>
                 </div>
               </div>
               <span className="text-[10px] text-slate-500 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1 font-bold">
                 Validé pour Cabinet Médical
               </span>
             </div>

             <div className="space-y-4 pt-4 leading-relaxed text-sm text-slate-600">
               <p>
                 À Dr. Slim, l'analyse vocale globale de vos <strong>{kpis.totalFollowed} patients suivis</strong> sur les 30 derniers jours révèle un <strong>taux d'observance global de {kpis.avgAdherence}%</strong>. C'est un taux robuste, mais on observe des variations considérables par pathologie de cohorte.
               </p>

               <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-amber-900 text-xs font-medium uppercase tracking-wider space-y-2">
                 <div className="flex items-center gap-2">
                   <AlertCircle size={16} className="text-amber-600" />
                   <span>Point Clinique d'Attention : Insuffisants Cardiaques (Vigilance Haute)</span>
                 </div>
                 <p className="normal-case text-amber-700 text-[11px] leading-relaxed font-semibold">
                   Les appels Hanen révèlent qu'entre 17h00 et 20h00, nos insuffisants cardiaques oublient plus de 15% de leurs doses de diurétiques en raison du manque de dynamisme ou de la solitude du soir. L'observance retombe à 75% sur ce groupe par rapport aux diabétiques (92%).
                 </p>
               </div>

               <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider pt-2">Suggestions Cliniques d'IA recommandées :</h4>
               <ul className="list-disc pl-5 space-y-2.5 text-xs text-slate-500 font-medium">
                 <li>
                   <strong>Tea-Time Comfort Calls :</strong> Activer les appels de confort automatiques Hanen pour les patients d'insuffisance cardiaque vers 16h45 pour s'assurer que la boisson, l'état d'œdème et les diurétiques soient discutés.
                 </li>
                 <li>
                   <strong>Alerte Fatigue Vocale (Khadija Mansour) :</strong> La patiente cumule 2 alertes actives avec un Indice de Dignité critique (55). Une visite ou réévaluation psychologique locale à son domicile de Tunis est fortement suggérée par Hanen.
                 </li>
               </ul>
             </div>

             <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block animate-pulse"></span>
                 <span className="text-xs font-bold text-slate-500">Hanen écoute en veille passive continue</span>
               </div>
               <button 
                 onClick={handleExportReport} 
                 className="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-xl transition-all"
               >
                 Télecharger Rapport Clinique Complet
               </button>
             </div>
           </div>
         )}

      </div>

      {/* Top Patients Board panels (visible regardless, giving exceptional insight) */}
      <div id="top-performance-board" className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Top 5 - Adherence */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Star size={14} className="text-indigo-500 fill-indigo-500" /> Meilleure Observance
            </h4>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">Top 5</span>
          </div>

          <div className="space-y-3">
            {highestAdherencePatients.map((patient, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-700">{patient.name}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{patient.conditions.join(', ')}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">
                    {patient.adherenceRate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 - Requires Attention (Low adherence or unstable) */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-amber-500" /> Vigilance Clinique
            </h4>
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full">Prise d'action</span>
          </div>

          <div className="space-y-3">
            {vigilancePatients.map((patient, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-700">{patient.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.2 rounded uppercase",
                      patient.voiceHealthStatus === 'Critique' ? "bg-rose-50 text-rose-600 border border-rose-100" : "bg-amber-50 text-amber-600 border border-amber-100"
                    )}>
                      Voix {patient.voiceHealthStatus}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg">
                    {patient.adherenceRate}% obs.
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top 5 - Active Attachment (Seniors calling the most) */}
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h4 className="font-bold text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Radio size={14} className="text-pink-500" /> Attachement social IA
            </h4>
            <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2.5 py-0.5 rounded-full">Séniors actifs</span>
          </div>

          <div className="space-y-3">
            {mostActivePatients.map((patient, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-700">{patient.name}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{patient.age} ans · Vis seul</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-lg">
                    {patient.dignityIndex}/100 Conf.
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
