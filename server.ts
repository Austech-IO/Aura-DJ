import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import yts from "youtube-search-api";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Gemini Config ---
const MODEL_NAME = "gemini-2.0-flash";

let aiInstance: GoogleGenAI | null = null;
function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is UNSET in server environment.");
      throw new Error("GEMINI_API_KEY missing from environment");
    }
    
    if (apiKey.includes("MY_GEMINI_API_KEY") || apiKey.length < 10) {
      console.error("GEMINI_API_KEY appears to be a placeholder or invalid string.");
      return new Proxy({}, {
        get: () => ({
          generateContent: async () => {
            throw new Error("GEMINI_API_KEY is not configured. Please add your key in the AI Studio Secrets panel.");
          }
        })
      }) as any;
    } else {
      console.log(`Gemini SDK initialized with key: ${apiKey.substring(0, 6)}...`);
    }

    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

function formatGeminiError(error: any) {
  const message = error?.message || String(error);
  if (message.includes("API key not valid")) {
    return "Invalid Gemini API Key. Please verify your secrets in the AI Studio settings.";
  }
  if (message.includes("User location is not supported")) {
    return "Gemini API is not available in your current region.";
  }
  return message;
}

const PLAYLIST_SYSTEM_INSTRUCTION = `You are an advanced AI Music DJ integrated into a modern music streaming app.
Your job is to generate realistic music playlists based on a mood or vibe.
Return ONLY structured JSON. 10 unique songs. Optimize search_query for YouTube.`;

const EXPERIENCE_SYSTEM_INSTRUCTION = `You are the AI Atmospheric Experience Engine for a music player.
Enhance the listening experience with poetic fragments and visual vibes based on the track.`;

const DJ_ENGINE_SYSTEM_INSTRUCTION = `You are the AI DJ Transition Engine for a continuous music streaming application using YouTube playback.

Your job is to ensure smooth, uninterrupted music flow between songs, simulating professional DJ-style transitions.

You do NOT control audio directly.
You ONLY generate structured instructions for a frontend Music Engine that handles playback.

CORE MODES:
1. "active": Standard mode for providing a new playlist or vibe shift. Returns current_song, next_song, and a full queue.
2. "insert": Triggered when the user wants to add a specific track at a specific position.

CRITICAL RULES:
1. SMOOTH TRANSITIONS: Never allow abrupt song changes. Always prepare next song BEFORE current ends.
2. TIMED TRANSITION: start_transition_at should usually be between 0.80 and 0.90.
3. YOUTUBE OPTIMIZATION: search_query must be optimized for YouTube playback.
4. INSERTION: If the user asks to add, insert, or slip in a specific track to the queue, respond ONLY with this JSON (no markdown, no extra text):
{"action":"insert","position":<number>,"track":{"title":"...","artist":"...","search_query":"..."}}
Position is 0-indexed. If position is unspecified, use the next position after the currently playing track.

FINAL RULE:
You are a professional AI DJ system responsible for creating seamless, continuous experiences.`;

const INSIGHTS_SYSTEM_INSTRUCTION = `You are Aura's Neural Insight Engine. 
Analyze a user's listening history (playlist titles and moods) and provide a deep, poetic, and technical summary of their musical identity.
Return JSON ONLY. Use a sophisticated, futuristic tone.`;

export async function createServer() {
  const app = express();

  app.use(express.json());

  // Spotify Auth Endpoints
  app.get("/api/auth/spotify/url", (req, res) => {
    const clientId = process.env.VITE_SPOTIFY_CLIENT_ID;
    const baseUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
    const redirectUri = req.query.redirect_uri as string || `${baseUrl}/auth/callback`;
    
    if (!clientId) {
      return res.status(500).json({ error: "Spotify Client ID not configured" });
    }

    const scope = "user-read-private user-read-email user-library-read playlist-read-private streaming user-modify-playback-state user-read-playback-state";
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: scope,
      show_dialog: "true"
    });

    res.json({ url: `https://accounts.spotify.com/authorize?${params.toString()}` });
  });

  app.get("/api/auth/spotify/callback", async (req, res) => {
    const { code, redirect_uri } = req.query;
    if (!code) {
      return res.status(400).send("Missing code");
    }

    try {
      const clientId = process.env.VITE_SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
      const baseUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
      
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code as string,
          redirect_uri: redirect_uri as string || `${baseUrl}/auth/callback`,
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        return res.status(400).json(data);
      }

      // Return success HTML with the tokens and a closing script
      res.send(`
        <html>
          <body>
            <script>
              window.opener.postMessage({ 
                type: 'SPOTIFY_AUTH_SUCCESS', 
                tokens: ${JSON.stringify(data)} 
              }, '*');
              window.close();
            </script>
            <p>Authentication successful. Window closing...</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error("Spotify token exchange error:", error);
      res.status(500).send("Authentication failed");
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", message: "Aura DJ Server is alive" });
  });

  // YouTube API Routes
  app.get("/api/search", async (req, res) => {
    const query = req.query.q as string;
    if (!query) {
      return res.status(400).json({ error: "Missing search query" });
    }

    try {
      console.log(`Searching YouTube for: ${query}`);
      const results = await yts.GetListByKeyword(query, false, 5);
      if (results && results.items) {
        res.json(results.items);
      } else {
        res.status(404).json({ error: "No results found" });
      }
    } catch (error) {
      console.error("YouTube search error:", error);
      res.status(500).json({ error: "Failed to search YouTube" });
    }
  });

  // Gemini API Routes
  app.post("/api/generate/playlist", async (req, res) => {
    try {
      const { userInput, history = [] } = req.body;
      const ai = getAI();
      const historyContext = history.length > 0 ? `\n\nEXCLUDE these songs (recently played): ${history.join(", ")}` : "";
      
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: userInput + historyContext }] }],
        config: {
          systemInstruction: PLAYLIST_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mood: { type: Type.STRING },
              energy_level: { type: Type.STRING, enum: ["low", "medium", "high"] },
              theme_color: { type: Type.STRING },
              playlist_title: { type: Type.STRING },
              playlist_description: { type: Type.STRING },
              playlist: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    artist: { type: Type.STRING },
                    album: { type: Type.STRING },
                    genre: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    year: { type: Type.STRING },
                    search_query: { type: Type.STRING },
                    thumbnail_hint: { type: Type.STRING },
                    bpm: { type: Type.NUMBER },
                    energy: { type: Type.NUMBER }
                  },
                  required: ["title", "artist", "album", "genre", "duration", "year", "search_query", "thumbnail_hint", "bpm", "energy"]
                }
              }
            },
            required: ["mood", "energy_level", "theme_color", "playlist_title", "playlist_description", "playlist"]
          }
        }
      });
      
      res.json(JSON.parse(response.text));
    } catch (error: any) {
      console.error("Gemini Playlist Error:", error);
      res.status(500).json({ error: formatGeminiError(error) });
    }
  });

  app.post("/api/generate/experience", async (req, res) => {
    try {
      const { title, artist } = req.body;
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: `Title: ${title}\nArtist: ${artist}` }] }],
        config: {
          systemInstruction: EXPERIENCE_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mood: { type: Type.STRING },
              energy_level: { type: Type.STRING, enum: ["low", "medium", "high"] },
              theme_color: { type: Type.STRING },
              interpretation: { type: Type.STRING },
              lyrics_style: { type: Type.ARRAY, items: { type: Type.STRING } },
              ui_notes: { type: Type.STRING }
            },
            required: ["mood", "energy_level", "theme_color", "interpretation", "lyrics_style", "ui_notes"]
          }
        }
      });
      res.json(JSON.parse(response.text));
    } catch (error: any) {
      console.error("Gemini Experience Error:", error);
      res.status(500).json({ error: formatGeminiError(error) });
    }
  });

  app.post("/api/generate/dj", async (req, res) => {
    try {
      const { message, history = [] } = req.body;
      const ai = getAI();
      const historyContext = history.length > 0 ? `\n\nEXCLUDE these songs (recently played): ${history.join(", ")}` : "";
      
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: `Input/Context: ${message}${historyContext}` }] }],
        config: {
          systemInstruction: DJ_ENGINE_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              dj_mode: { type: Type.STRING, enum: ["active", "insert"] },
              action: { type: Type.STRING, enum: ["insert"] },
              position: { type: Type.NUMBER },
              track: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  artist: { type: Type.STRING },
                  search_query: { type: Type.STRING }
                },
                required: ["title", "artist", "search_query"]
              },
              current_song: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  artist: { type: Type.STRING },
                  search_query: { type: Type.STRING }
                },
                required: ["title", "artist", "search_query"]
              },
              next_song: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  artist: { type: Type.STRING },
                  search_query: { type: Type.STRING }
                },
                required: ["title", "artist", "search_query"]
              },
              queue: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    artist: { type: Type.STRING },
                    search_query: { type: Type.STRING }
                  },
                  required: ["title", "artist", "search_query"]
                }
              },
              transition: {
                type: Type.OBJECT,
                properties: {
                  strategy: { type: Type.STRING, enum: ["smooth_fade", "energetic_blend", "soft_cut"] },
                  start_transition_at: { type: Type.NUMBER },
                  preload_next: { type: Type.BOOLEAN },
                  crossfade_duration_ms: { type: Type.NUMBER }
                },
                required: ["strategy", "start_transition_at", "preload_next", "crossfade_duration_ms"]
              },
              flow_control: {
                type: Type.OBJECT,
                properties: {
                  energy_curve: { type: Type.STRING, enum: ["rising", "stable", "falling", "wave"] },
                  mood_consistency: { type: Type.STRING, enum: ["strict", "flexible"] },
                  avoid_jumps: { type: Type.BOOLEAN }
                },
                required: ["energy_curve", "mood_consistency", "avoid_jumps"]
              },
              autoplay: { type: Type.BOOLEAN },
              continuous_mode: { type: Type.BOOLEAN },
              message: { type: Type.STRING },
              mood: { type: Type.STRING },
              energy_level: { type: Type.STRING, enum: ["low", "medium", "high"] }
            },
            required: ["dj_mode"]
          }
        }
      });
      res.json(JSON.parse(response.text));
    } catch (error: any) {
      console.error("Gemini DJ Error:", error);
      res.status(500).json({ error: formatGeminiError(error) });
    }
  });

  app.post("/api/generate/insights", async (req, res) => {
    try {
      const { history } = req.body;
      const ai = getAI();
      const context = history.map((h: any) => `${h.title}: ${h.mood}`).join(", ");
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: `Analyze history: ${context}` }] }],
        config: {
          systemInstruction: INSIGHTS_SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              genres: { type: Type.ARRAY, items: { type: Type.STRING } },
              recommendation_logic: { type: Type.STRING }
            },
            required: ["summary", "genres", "recommendation_logic"]
          }
        }
      });
      res.json(JSON.parse(response.text));
    } catch (error: any) {
      console.error("Gemini Insights Error:", error);
      res.status(500).json({ error: formatGeminiError(error) });
    }
  });

  app.post("/api/generate/vibe", async (req, res) => {
    try {
      const { arc } = req.body;
      const ai = getAI();
      const prompt = `The listener has been playing music for ${arc.durationMins} minutes.
Session arc: avg BPM ${arc.avgBpm}, avg energy ${arc.avgEnergy}/10, time of day: ${arc.timeOfDay}.
Suggest one short vibe-shift or affirm the current direction in under 12 words.
Conversational tone. No quotes. No punctuation at end.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          systemInstruction: "You are Aura, an AI DJ. You provide short, insightful vibe suggestions.",
        }
      });

      res.json({ text: response.text.trim().replace(/^"|"$/g, '').replace(/\.$/, '') });
    } catch (error: any) {
      console.error("Gemini Vibe Error:", error);
      res.status(500).json({ error: formatGeminiError(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (path.extname(req.path)) {
        res.status(404).end();
      } else {
        res.sendFile(path.join(distPath, "index.html"));
      }
    });
  }

  return app;
}

// Only start the server if this file is run directly (not through a function import like Vercel)
if (!process.env.VERCEL) {
  createServer().then(app => {
    const PORT = 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Aura DJ Server running on http://localhost:${PORT}`);
    });
  });
}
