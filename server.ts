// Backend server
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, LiveServerMessage, Modality } from "@google/genai";
import { WebSocketServer } from "ws";
import http from "http";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const server = http.createServer(app);

  app.use(express.json({ limit: '50mb' }));

  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on("connection", async (clientWs, req) => {
    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const sysPrompt = url.searchParams.get("sysPrompt") || "You are a helpful assistant.";

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        clientWs.close(1011, "API_KEY_MISSING");
        return;
      }

      const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
      
      const sessionPromise = ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onmessage: (message: any) => {
            console.log("[Live API] Received message from Gemini server.");
            
            // Use standard SDK getter 'data' if available, otherwise fall back to manual structural checks
            let audio = message?.data;
            if (!audio) {
              const serverContent = message?.serverContent || message?.server_content;
              const modelTurn = serverContent?.modelTurn || serverContent?.model_turn;
              const parts = modelTurn?.parts;
              if (parts && Array.isArray(parts)) {
                for (const part of parts) {
                  const inlineData = part.inlineData || part.inline_data;
                  if (inlineData?.data) {
                    audio = inlineData.data;
                    break;
                  }
                }
              }
            }

            if (audio) {
              clientWs.send(JSON.stringify({ audio }));
            }

            const serverContent = message?.serverContent || message?.server_content;
            const interrupted = serverContent?.interrupted;
            if (interrupted) {
              console.log("[Live API] Assistant interrupted by user speak");
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
          },
          onerror: (err: any) => {
            console.error("[Live API] Error from Gemini:", err);
            clientWs.send(JSON.stringify({ error: err?.message || "Live API Error" }));
          },
          onclose: (e: any) => {
            console.log("[Live API] Connection closed by Gemini:", e);
            clientWs.close();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: { parts: [{ text: sysPrompt }] },
        },
      });

      // Just log successful connection
      sessionPromise.then(session => {
        console.log("[Live API] Live session connected, ready for audio.");
      }).catch(err => {
        console.error("[Live API] Handshake promise rejected:", err);
        try { clientWs.close(1011, "LIVE_HANDSHAKE_FAILED"); } catch (_) {}
      });

      let chunkCount = 0;
      clientWs.on("message", (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (!parsed.audio) return;
          
          chunkCount++;
          if (chunkCount % 100 === 0) {
            console.log(`[Live WebSockets] Successfully received and forwarded ${chunkCount} audio chunks from user`);
          }
          
          sessionPromise.then(session => {
             session.sendRealtimeInput({
               media: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
             });
          }).catch(err => {
              console.error("[Live API] Error sending realtime input:", err);
          });
        } catch (e) {
          console.error("[Live API] Error parsing client message:", e);
        }
      });
      
      clientWs.on("close", () => {
         sessionPromise.then(session => {
            // Can't close session cleanly in exactly the same way without knowing sdk type, but we can just let it GC when connection drops
         }).catch(() => {});
      });

    } catch(err) {
      console.error("Live API error:", err);
      clientWs.close(1011, "LIVE_API_ERROR");
    }
  });

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
        model: "gemini-3.5-flash",
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

  // API Route for generating a custom message draft after the Live AI call
  app.post("/api/draft-message", async (req, res) => {
    try {
      const { patient, transcript } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
         return res.status(500).json({ error: "API_KEY_MISSING", message: "La clé API Gemini est manquante." });
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const condition = patient?.conditions?.[0] || 'santé générale';
      
      const prompt = `Le docteur vient de terminer une consigne vocale pour le patient suivant : ${patient?.name}, ${patient?.age} ans, souffrant de : ${condition}.
Voici ce que le médecin vient de dire à l'oral (transcription) : "${transcript || 'Aucune transcription détectée'}".

RÈGLE STRICTE (Le Français Majestueux en retour) : Tu comprends tout, mais tu ne réponds et ne rédige la traduction clinique au patient qu'en EXCELLENT FRANÇAIS.
Génère une proposition de message texte TRÈS COURT ET BIENVEILLANT (en français uniquement) adressé directement au patient pour lui traduire la consigne. Aucun mot en arabe.
Exemple de ton: chaleureux, majestueux, clair, professionnel.
Produis un format JSON strict:
{
  "draft": "Le message à envoyer au patient...",
  "videoTitle": "Titre d'une recherche YouTube pertinente pour sa condition",
  "searchQuery": "mots clés pour youtube"
}`;

      const config = {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            draft: { type: Type.STRING },
            videoTitle: { type: Type.STRING },
            searchQuery: { type: Type.STRING }
          }
        }
      };

      let text = "";
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config
        });
        text = response.text || "";
      } catch (err: any) {
        if (err.status === 429 || err.message?.includes("429") || err.message?.includes("quota")) {
          console.warn("Quota exceeded on gemini-3.5-flash, retrying content generation...");
          const fallbackRes = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config
          });
          text = fallbackRes.text || "";
        } else {
          throw err;
        }
      }
      
      if (!text) throw new Error("No response");
      const parsed = JSON.parse(text);
      
      let videoUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(parsed.searchQuery)}`;
      let videoTitle = parsed.videoTitle;
      let videoThumbnail = "";

      // Try YouTube API if key is present
      const youtubeKey = process.env.YOUTUBE_API_KEY;
      if (youtubeKey) {
         try {
            const ytResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${encodeURIComponent(parsed.searchQuery)}&type=video&key=${youtubeKey}`);
            if (ytResponse.ok) {
               const ytData = await ytResponse.json();
               if (ytData.items && ytData.items.length > 0) {
                  const videoId = ytData.items[0].id.videoId;
                  videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                  videoTitle = ytData.items[0].snippet.title;
                  videoThumbnail = ytData.items[0].snippet.thumbnails?.high?.url || ytData.items[0].snippet.thumbnails?.default?.url || "";
               }
            }
         } catch (e) {
            console.error("YouTube API fallback error:", e);
         }
      }
      
      res.json({
         draft: parsed.draft,
         videoTitle: videoTitle,
         videoUrl: videoUrl,
         thumbnailUrl: videoThumbnail
      });

    } catch (e: any) {
      console.error("Erreur draft message:", e);
      res.status(500).json({ error: "GENERAL_ERROR", message: "Impossible de générer le brouillon avec Gemini." });
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
        model: "gemini-3.5-flash",
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

  // API Route for TTS Audio via Gemini
  app.post("/api/generate-tts", express.json(), async (req, res) => {
    try {
      const { text } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!text || !apiKey) {
        return res.status(400).json({ error: "Missing text or API key" });
      }

      const { GoogleGenAI, Modality } = await import("@google/genai");
      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: text }] }],
        config: {
          systemInstruction: "You are a warm, compassionate female medical assistant named Hanen. Read the following message in natural, fluent, native French language with an encouraging, elegant tone and clear pronunciation.",
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' } // Female voice perfect for Hanen's French vocal assistant role
            }
          }
        }
      });
      
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        res.json({ audio: base64Audio });
      } else {
        throw new Error("No audio returned by Gemini TTS");
      }
    } catch (e: any) {
      console.error("Erreur TTS:", e);
      res.status(500).json({ error: "TTS_ERROR", message: e.message });
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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
