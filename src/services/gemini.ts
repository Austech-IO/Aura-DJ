import { GoogleGenAI, Type } from "@google/genai";

export interface PlaylistTrack {
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: string;
  year: string;
  search_query: string;
  thumbnail_hint: string;
  bpm: number;
  energy: number;
}

export interface PlaylistData {
  mood: string;
  energy_level: "low" | "medium" | "high";
  theme_color: string;
  playlist_title: string;
  playlist_description: string;
  playlist: PlaylistTrack[];
}

export interface SongExperienceData {
  mood: string;
  energy_level: "low" | "medium" | "high";
  theme_color: string;
  interpretation: string;
  lyrics_style: string[];
  ui_notes: string;
}

const MODEL_NAME = "gemini-2.0-flash";

// Initialize AI lazily
let aiInstance: GoogleGenAI | null = null;
function getAI() {
  if (!aiInstance) {
    // Check both process.env (Vite define) and import.meta.env
    const apiKey = 
      (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : null) || 
      (import.meta as any).env?.VITE_GEMINI_API_KEY ||
      (window as any)?.__GEMINI_API_KEY__;
      
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      console.error("[Aura AI] ❌ GEMINI_API_KEY is not configured. Please add it in AI Studio Secrets.");
      // Return a dummy instance that throws descriptive errors
      return {
        models: {
          get: () => ({ generateContent: async () => { throw new Error("GEMINI_API_KEY is not configured. Please add your key in the AI Studio Secrets panel."); } }),
          generateContent: async () => { throw new Error("GEMINI_API_KEY is not configured. Please add your key in the AI Studio Secrets panel."); }
        }
      } as any;
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
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

export async function generatePlaylist(userInput: string, history: string[] = []): Promise<PlaylistData> {
  try {
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
    
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Generate Playlist Error:", error);
    throw error;
  }
}

export async function generateSongExperience(title: string, artist: string): Promise<SongExperienceData> {
  try {
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
    return JSON.parse(response.text);
  } catch (error) {
    console.warn("Gemini Experience Error (Falling back):", error);
    return getFallbackExperience(title, artist);
  }
}

function getFallbackExperience(title: string, artist: string): SongExperienceData {
  return {
    mood: "Reflective",
    energy_level: "medium",
    theme_color: "#1a1a1a",
    interpretation: `Visualizing the depth of "${title}" by ${artist}.`,
    lyrics_style: ["Echoes in the neural net..."],
    ui_notes: "Deep shadows, minimal pulse"
  };
}

export interface DJEngineResponse {
  dj_mode: "active" | "insert";
  action?: "insert";
  position?: number; 
  track?: {
    title: string;
    artist: string;
    search_query: string;
  };
  current_song?: {
    title: string;
    artist: string;
    search_query: string;
  };
  next_song?: {
    title: string;
    artist: string;
    search_query: string;
  };
  queue?: {
    title: string;
    artist: string;
    search_query: string;
  }[];
  transition?: {
    strategy: "smooth_fade" | "energetic_blend" | "soft_cut";
    start_transition_at: number; 
    preload_next: boolean;
    crossfade_duration_ms: number;
  };
  flow_control?: {
    energy_curve: "rising" | "stable" | "falling" | "wave";
    mood_consistency: "strict" | "flexible";
    avoid_jumps: boolean;
  };
  autoplay?: true;
  continuous_mode?: true;
  message?: string;
  mood?: string;
  energy_level?: "low" | "medium" | "high";
}

export async function generateDJResponse(message: string, history: string[] = []): Promise<DJEngineResponse> {
  try {
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
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini DJ Engine Error:", error);
    throw error;
  }
}

export interface ProfileInsights {
  summary: string;
  genres: string[];
  recommendation_logic: string;
}

export async function generateProfileInsights(history: any[]): Promise<ProfileInsights> {
  try {
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
    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Profile Insights Error:", error);
    throw error;
  }
}

export async function generateVibeSuggestion(arc: any): Promise<string> {
  try {
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

    return response.text.trim().replace(/^"|"$/g, '').replace(/\.$/, '');
  } catch (error) {
    console.error("Gemini Vibe Suggestion Error:", error);
    return "The energy is shifting. Ready for a new direction?";
  }
}
