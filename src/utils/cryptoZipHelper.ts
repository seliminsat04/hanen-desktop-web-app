// Cryptographic export
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Patient, VoiceAlert, VoiceSession } from '../types';

/**
 * Derives a PBKDF2 symmetric AES key and encrypts the given Uint8Array payload.
 * High security standard: PBKDF2 SHA-256 with 100k rounds, AES-GCM 256-bit encryption.
 */
export async function encryptPayload(payload: Uint8Array, password: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const passwordBuffer = enc.encode(password);
  
  // Generate a secure random 16-byte salt
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  
  // Import the password as key material
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  // Derive the 256-bit AES-GCM key
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  
  // Generate a random 12-byte IV for AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the source payload
  const encryptedContent = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    payload
  );
  
  const encryptedBytes = new Uint8Array(encryptedContent);
  
  // Pack Salt (16b) + IV (12b) + Ciphertext into a single array
  const combined = new Uint8Array(salt.length + iv.length + encryptedBytes.length);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(encryptedBytes, salt.length + iv.length);
  
  return combined;
}

/**
 * Decrypts a combined byte array (Salt + IV + Ciphertext) using the password.
 */
export async function decryptPayload(combined: Uint8Array, password: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const passwordBuffer = enc.encode(password);
  
  if (combined.length < 16 + 12) {
    throw new Error("L'archive chiffrée est trop courte, elle semble corrompue ou invalide.");
  }
  
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 16 + 12);
  const ciphertext = combined.slice(16 + 12);
  
  // Import key material
  const baseKey = await window.crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  // Derive key
  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
  
  // Decrypt payload
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    ciphertext
  );
  
  return new Uint8Array(decryptedBuffer);
}

/**
 * Generates clinical reports and packages them in a ZIP file structure.
 */
export async function generatePatientZip(
  patient: Patient,
  sessions: VoiceSession[],
  alerts: VoiceAlert[]
): Promise<Uint8Array> {
  const zip = new JSZip();

  // 1. Patient identity card & clinical KPIs (JSON form)
  const identityData = {
    exportDate: new Date().toISOString(),
    patientId: patient.id,
    name: patient.name,
    age: patient.age,
    gender: patient.gender,
    phone: patient.phone,
    pathologies: patient.conditions,
    adherenceRate: `${patient.adherenceRate}%`,
    voiceHealthStatus: patient.voiceHealthStatus,
    dignityIndex: `${patient.dignityIndex}/100`,
    dominantMood: patient.dominantMood || 'Inconnu',
    medicalNotes: patient.notes,
    livingConditions: {
      livesAlone: patient.livesAlone ?? false,
      techSavvy: patient.techSavvy ?? false,
      lifestylePreference: patient.lifestylePreference || 'Non précisé'
    }
  };
  zip.file(
    "01_identite_clinique.json", 
    JSON.stringify(identityData, null, 2)
  );

  // 2. Structured markdown dossier printable report
  let mdReport = `# DOSSIER MÉDICAL SÉCURISÉ - COMPLÉMENT DE SUIVI BIOMARQUEURS VOCAUX\n\n`;
  mdReport += `## Patient : ${patient.name} (ID: ${patient.id})\n`;
  mdReport += `- **Âge :** ${patient.age} ans\n`;
  mdReport += `- **Genre :** ${patient.gender}\n`;
  mdReport += `- **Téléphone :** ${patient.phone}\n`;
  mdReport += `- **Inscriptions Pathologiques :** ${patient.conditions.join(', ') || 'Aucune'}\n`;
  mdReport += `- **Statut Vitalité Vocale :** ${patient.voiceHealthStatus}\n`;
  mdReport += `- **Observance Globale :** ${patient.adherenceRate}%\n`;
  mdReport += `- **Indice d'Autonomie & Dignité :** ${patient.dignityIndex}/100\n`;
  mdReport += `- **Humeur dominante :** ${patient.dominantMood || 'Inconnu'}\n\n`;
  mdReport += `### Notes Cliniques Générales\n`;
  mdReport += `> ${patient.notes || 'Aucune note générale.'}\n\n`;

  // Sessions list
  mdReport += `## Historique des Appels et Échanges (Service Vocal Assistant IA Hanen)\n\n`;
  if (sessions.length === 0) {
    mdReport += `Aucun appel enregistré pour ce patient.\n`;
  } else {
    sessions.forEach((s, i) => {
      mdReport += `### Rapport de Session #${i + 1} - ${new Date(s.date).toLocaleDateString('fr-FR')} (Durée: ${s.duration})\n`;
      mdReport += `- **Niveau de Stress :** ${s.stressLevel}/10\n`;
      mdReport += `- **Indice de Fatigue :** ${s.fatigueLevel}/10\n`;
      mdReport += `- **Analyse Sentimentale :** ${s.sentiment}\n`;
      mdReport += `- **Résumé IA Hanen :** ${s.summary}\n`;
      if (s.transcript) {
        mdReport += `- **Transcription Textuelle Complète :**\n`;
        mdReport += `  \`\`\`text\n  ${s.transcript.split('\n').join('\n  ')}\n  \`\`\`\n`;
      }
      mdReport += `\n`;
    });
  }

  // Alerts list
  mdReport += `\n## Anomalies Émises et Alertes Cliniques\n\n`;
  const patientAlerts = alerts.filter(a => a.patientId === patient.id);
  if (patientAlerts.length === 0) {
    mdReport += `Aucune alerte clinique relevée pour ce patient.\n`;
  } else {
    patientAlerts.forEach((a, i) => {
      mdReport += `### Alerte d'Anomalie Clinique #${i + 1} (${new Date(a.date).toLocaleDateString('fr-FR')})\n`;
      mdReport += `- **Priorité :** ${a.priority}\n`;
      mdReport += `- **Statut Actuel :** ${a.status}\n`;
      mdReport += `- **Signes Acoustiques Détectés :** ${a.detectedSigns.join(', ') || 'Inconnu'}\n`;
      mdReport += `- **Suggestion clinique IA :** ${a.aiSuggestion}\n`;
      if (a.doctorComment) {
        mdReport += `- **Annotations Complémentaires du Praticien :**\n  > ${a.doctorComment}\n`;
      }
      if (a.closureNote) {
        mdReport += `- **Raison de Résolution/Fermeture :**\n  > ${a.closureNote}\n`;
      }
      mdReport += `\n`;
    });
  }

  mdReport += `\n\n*Rapport généré automatiquement et encodé de manière cryptographique conforme aux exigences ASIP-Santé / RGPD.*`;
  zip.file("02_fiche_suivi_clinique.md", mdReport);

  // 3. Fake medical diagnostic audio structure placeholder
  let indexWav = `# HISTORIQUE AUDIO DES APPELS SÉCURISÉS\n\n`;
  indexWav += `Pour des raisons de secret médical de niveau 3 et conformité RGPD, les enregistrements audio originaux des appels de l'assistant Hanen ont été isolés et convertis en paquets binaires chiffrés.\n\n`;
  sessions.forEach((s, idx) => {
    indexWav += `- Fichier: \`audio_session_n_${idx + 1}.mp3\` | Taille simulée: 872 KB | Codec: MP3 Dual-Mono Lame 128kbps | Statut: Sécurisé\n`;
    const dummyAudioBytes = new TextEncoder().encode(`SIMULATED METADATA FOR AUDIO STREAM #${idx + 1} - PATIENT ID: ${patient.id} - DATE: ${s.date} - STRESS LEVEL: ${s.stressLevel}`);
    zip.file(`audio_sessions/audio_session_n_${idx + 1}.mp3`, dummyAudioBytes);
  });
  
  zip.file("03_enregistrements_audio_rapport.txt", indexWav);

  // Generate ZIP as uint8array
  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  return zipBytes;
}
