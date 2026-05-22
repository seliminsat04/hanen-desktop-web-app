import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Route for Clinical Chatbot
  app.post("/api/chatbot", async (req, res) => {
    try {
      const { messages, contextInfo } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "API_KEY_MISSING", message: "La clé API Gemini est manquante." });
      }

      const ai = new GoogleGenAI({ apiKey });

      const systemPrompt = `Tu es l'Assistant Virtuel Clinique (Copilote Médical) de cette application destinée au MÉDECIN.
Ton rôle est de faire gagner du temps au médecin, réduire sa charge mentale et l'aider à traiter les dossiers avec efficacité.
Règles d'interaction :
- Sois factuel, concis, professionnel et direct (pas de "Bonjour Docteur", pas de blabla amical).
- Va à l'essentiel : utilise le formatage Markdown (listes à puces, gras pour les données chiffrées et termes cliniques).
- Ne te présente jamais comme un robot amical. Tu es un outil d'assistance rapide.
- Tu peux synthétiser des dossiers, rappeler des protocoles, alerter sur des médicaments.
- Ne pas inventer (halluciner) de patients. Base-toi uniquement sur le contexte fourni.
- Si on te pose une question générale, réponds avec précision et brièveté.

CONTEXTE ACTUEL FOURNI PAR L'APPLICATION:
${contextInfo || "Aucun contexte spécifique n'est ouvert par le médecin actuellement."}`;

      // Transform messages to strictly fit the Gemini API chat history format
      // that genai SDK accepts in generateContent with system instruction
      const formattedMessages = messages.map((m: any) => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: formattedMessages,
        config: {
            systemInstruction: systemPrompt,
            temperature: 0.2, // Low temperature for factual precision
        }
      });

      const text = response.text;
      res.json({ text });
    } catch (e: any) {
      console.error("Erreur Gemini Chatbot:", e);
      res.status(500).json({ error: "GENERAL_ERROR", message: "Erreur lors de la requête à l'assistant." });
    }
  });

  // API Route for OCR 
  app.post("/api/scan-patient", async (req, res) => {
    try {
      const { fileType, fileData } = req.body; // fileData is base64
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "API_KEY_MISSING", message: "La clé API Gemini (GEMINI_API_KEY) n'est pas configurée côté serveur." });
      }

      const ai = new GoogleGenAI({ apiKey });

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            inlineData: {
              data: fileData,
              mimeType: fileType, // e.g. "application/pdf" or "image/jpeg"
            }
          },
          "Analyse ce document. D'abord, détermine s'il s'agit d'un document médical, d'une pièce d'identité ou d'un formulaire lié à la santé/au patient. Si ce N'EST PAS le cas (ex: paysage, recette de cuisine, facture sans rapport), fixe 'isRelevantDocument' à false et arrête-toi là. Si c'est pertinent ('isRelevantDocument': true), extrait les informations du patient. Retourne UNIQUEMENT un objet JSON en respectant le schéma fourni. Pour chaque champ, indique la valeur extraite et ton niveau de confiance (0 à 100). Si l'information n'est pas présente, laisse une chaîne vide et une confiance de 0."
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isRelevantDocument: { type: Type.BOOLEAN },
              name: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING },
                  confidence: { type: Type.NUMBER }
                }
              },
              age: {
                 type: Type.OBJECT,
                 properties: {
                   value: { type: Type.STRING },
                   confidence: { type: Type.NUMBER }
                 }
              },
               gender: {
                 type: Type.OBJECT,
                 properties: {
                   value: { type: Type.STRING },
                   confidence: { type: Type.NUMBER }
                 }
              },
              phone: {
                 type: Type.OBJECT,
                 properties: {
                   value: { type: Type.STRING },
                   confidence: { type: Type.NUMBER }
                 }
              },
              condition: {
                 type: Type.OBJECT,
                 properties: {
                   value: { type: Type.STRING },
                   confidence: { type: Type.NUMBER }
                 }
              }
            }
          }
        }
      });

      const extractedText = response.text;
      if (!extractedText) throw new Error("No response from Gemini");

      res.json(JSON.parse(extractedText));
    } catch (e: any) {
      console.error("Erreur Gemini Scan:", e);
      res.status(500).json({ error: "GENERAL_ERROR", message: e.message || "Erreur lors de l'extraction IA. Le document est peut-être trop lourd ou illisible." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
