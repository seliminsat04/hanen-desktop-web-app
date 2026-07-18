// Type definitions
export type HealthStatus = 'Stable' | 'Attention' | 'Critique';

export type AlertPriority = 'High' | 'Medium' | 'Low';

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  conditions: string[];
  lastCallDate: string;
  voiceHealthStatus: HealthStatus;
  adherenceRate: number; // 0-100
  phone: string;
  notes: string;
  dignityIndex: number; // 0-100, measures comfort/dignity
  lifestylePreference?: string;
  livesAlone?: boolean;
  techSavvy?: boolean;
  dominantMood?: 'Serein' | 'Anxieux' | 'Triste' | 'Inconnu';
}

export interface VoiceAlert {
  id: string;
  patientId: string;
  priority: AlertPriority;
  date: string;
  detectedSigns: string[];
  duration: string;
  aiSuggestion: string;
  status: 'Active' | 'Resolved';
  doctorComment?: string;
  closureNote?: string;
  resolvedAt?: string;
}

export interface VoiceSession {
  id: string;
  patientId: string;
  date: string;
  duration: string;
  summary: string;
  transcript?: string;
  stressLevel: number; // 0-10
  fatigueLevel: number; // 0-10
  sentiment: 'Positive' | 'Neutral' | 'Negative';
}

export interface CabinetStats {
  totalPatients: number;
  activeAlerts: number;
  todayCalls: number;
  avgAdherence: number;
  avgDignityIndex: number;
}
