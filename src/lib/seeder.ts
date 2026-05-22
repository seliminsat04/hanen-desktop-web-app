import {
  collection,
  doc,
  writeBatch,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "./firebase";
import { mockPatients, mockAlerts, mockVoiceSessions } from "../data";

export const seedMockDataToFirestore = async (tenantId: string) => {
  try {
    console.log(
      "Starting high-fidelity database seeding for tenant:",
      tenantId,
    );

    // 1. Fetch and clean up existing patients for this tenant first to avoid duplicate list entries from past manual runs
    const patientsRef = collection(db, "tenants", tenantId, "patients");
    const existingPatientsSnap = await getDocs(patientsRef);

    if (!existingPatientsSnap.empty) {
      console.log(
        `Cleaning up ${existingPatientsSnap.size} existing patient documents...`,
      );
      const deleteBatch = writeBatch(db);
      existingPatientsSnap.forEach((patientDoc) => {
        deleteBatch.delete(patientDoc.ref);
      });
      await deleteBatch.commit();
      console.log("Cleanup complete.");
    }

    const alertsRef = collection(db, "tenants", tenantId, "alerts");
    const existingAlertsSnap = await getDocs(alertsRef);
    if (!existingAlertsSnap.empty) {
      const deleteBatch2 = writeBatch(db);
      existingAlertsSnap.forEach((alertDoc) => {
        deleteBatch2.delete(alertDoc.ref);
      });
      await deleteBatch2.commit();
    }

    // 2. Write new pristine seed data
    const batch = writeBatch(db);

    // Patients - Seed using deterministic patient IDs (p1 through p8) to tie aligned detail data together
    for (const patient of mockPatients) {
      const pRef = doc(db, "tenants", tenantId, "patients", patient.id);

      batch.set(pRef, {
        name: patient.name,
        age: patient.age,
        gender: patient.gender,
        conditions: patient.conditions,
        voiceHealthStatus: patient.voiceHealthStatus,
        adherenceRate: patient.adherenceRate,
        phone: patient.phone,
        notes: patient.notes || "",
        dignityIndex: patient.dignityIndex,
        // Parse date strings to Javascript Dates so Firestore saves them as Timestamp (with .seconds and .nanoseconds)
        lastCallDate: patient.lastCallDate
          ? new Date(patient.lastCallDate)
          : new Date(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Alerts - Seed under each respective patient subcollection
    for (const alert of mockAlerts) {
      const pRefId = alert.patientId;
      // Safety guard in case patient ID isn't p1-p8
      if (mockPatients.some((p) => p.id === pRefId)) {
        const aRef = doc(collection(db, "tenants", tenantId, "alerts"));
        batch.set(aRef, {
          patientId: pRefId,
          priority: alert.priority,
          date: alert.date ? new Date(alert.date) : new Date(),
          detectedSigns: alert.detectedSigns,
          duration: alert.duration,
          aiSuggestion: alert.aiSuggestion,
          status: alert.status,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    // Voice Sessions - Seed under each respective patient subcollection
    for (const session of mockVoiceSessions) {
      const pRefId = session.patientId;
      if (mockPatients.some((p) => p.id === pRefId)) {
        const sRef = doc(
          collection(db, "tenants", tenantId, "patients", pRefId, "sessions"),
        );
        batch.set(sRef, {
          patientId: pRefId,
          date: session.date ? new Date(session.date) : new Date(),
          duration: session.duration,
          summary: session.summary,
          transcript: session.transcript || "",
          stressLevel: session.stressLevel,
          fatigueLevel: session.fatigueLevel,
          sentiment: session.sentiment,
          createdAt: serverTimestamp(),
        });
      }
    }

    // Seed realistic message interactions for patient p2 and p3 to populate the Inbox thread instantly
    const messagesToSeed = [
      {
        patientId: "p2",
        sender: "doctor",
        type: "text",
        content:
          "Bonjour Ahmed, comment s'est passé votre réveil aujourd'hui ?",
        audioUrl: "",
        offsetMinutes: 120,
      },
      {
        patientId: "p2",
        sender: "hanen",
        type: "text",
        content:
          "Ahmed a mentionné s'être senti un peu fatigué ce matin mais qu'il a bien pris ses diurétiques.",
        audioUrl: "",
        offsetMinutes: 90,
      },
      {
        patientId: "p2",
        sender: "doctor",
        type: "text",
        content:
          "Très bien. S'il vous plaît surveillez s'il recommence à tousser sec ou s'il s'essouffle.",
        audioUrl: "",
        offsetMinutes: 60,
      },
      {
        patientId: "p2",
        sender: "hanen",
        type: "text",
        content:
          "C'est noté, j'intensifie la surveillance de sa phonation lors des prochains appels.",
        audioUrl: "",
        offsetMinutes: 30,
      },
      {
        patientId: "p3",
        sender: "doctor",
        type: "text",
        content:
          "Chère Khadija, j'ai écouté votre alerte de solitude au téléphone. Je vous envoie tout mon soutien. Ma secrétaire va vous contacter pour planifier une petite visite.",
        audioUrl: "",
        offsetMinutes: 180,
      },
    ];

    for (const msg of messagesToSeed) {
      const mRef = doc(
        collection(
          db,
          "tenants",
          tenantId,
          "patients",
          msg.patientId,
          "messages",
        ),
      );
      const timestamp = new Date();
      timestamp.setMinutes(timestamp.getMinutes() - msg.offsetMinutes);

      batch.set(mRef, {
        patientId: msg.patientId,
        type: msg.type,
        content: msg.content,
        audioUrl: msg.audioUrl,
        sender: msg.sender,
        createdAt: timestamp,
      });
    }

    await batch.commit();
    console.log("Clinical database seed written successfully!");
  } catch (error) {
    console.error("Critical error seeding data:", error);
    throw error;
  }
};
