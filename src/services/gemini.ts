import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const PLAY_MUSIC_TOOL: FunctionDeclaration = {
  name: "playMusic",
  description: "Generate a new playlist and start playing music based on a mood, genre, or description.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "The mood, genre, or vibe to play (e.g., 'chill lo-fi', 'energetic gym music', '90s rock')."
      }
    },
    required: ["query"]
  }
};

export interface PlaylistTrack {
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: string;
  year: string;
  search_query: string;
  thumbnail_hint: string;
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

const SYSTEM_INSTRUCTION = `You are an advanced AI Music DJ integrated into a modern music streaming app.
Your job is to generate realistic music playlists based on a mood or vibe.
Return ONLY structured JSON. 10 unique songs. Optimize search_query for YouTube.`;

const EXPERIENCE_SYSTEM_INSTRUCTION = `You are the AI Atmospheric Experience Engine for a music player.
Enhance the listening experience with poetic fragments and visual vibes based on the track.`;

export async function generatePlaylist(userInput: string, history: string[] = []): Promise<PlaylistData> {
  const historyContext = history.length > 0 ? `\n\nEXCLUDE these songs (recently played): ${history.join(", ")}` : "";
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: userInput + historyContext }] }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
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
                thumbnail_hint: { type: Type.STRING }
              },
              required: ["title", "artist", "album", "genre", "duration", "year", "search_query", "thumbnail_hint"]
            }
          }
        },
        required: ["mood", "energy_level", "theme_color", "playlist_title", "playlist_description", "playlist"]
      }
    }
  });
  return JSON.parse(response.text) as PlaylistData;
}

export async function generateSongExperience(title: string, artist: string): Promise<SongExperienceData> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
    return JSON.parse(response.text) as SongExperienceData;
  } catch (error) {
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
  dj_mode: "active";
  current_song: {
    title: string;
    artist: string;
    search_query: string;
  };
  next_song: {
    title: string;
    artist: string;
    search_query: string;
  };
  queue: {
    title: string;
    artist: string;
    search_query: string;
  }[];
  transition: {
    strategy: "smooth_fade" | "energetic_blend" | "soft_cut";
    start_transition_at: number; // percentage e.g. 0.85
    preload_next: boolean;
    crossfade_duration_ms: number;
  };
  flow_control: {
    energy_curve: "rising" | "stable" | "falling" | "wave";
    mood_consistency: "strict" | "flexible";
    avoid_jumps: boolean;
  };
  autoplay: true;
  continuous_mode: true;
  message?: string;
  mood?: string;
  energy_level?: "low" | "medium" | "high";
}

const DJ_ENGINE_SYSTEM_INSTRUCTION = `You are the AI DJ Transition Engine for a continuous music streaming application using YouTube playback.

Your job is to ensure smooth, uninterrupted music flow between songs, simulating professional DJ-style transitions.

You do NOT control audio directly.
You ONLY generate structured instructions for a frontend Music Engine that handles playback.

IMPORTANT SYSTEM GOAL:
Create a seamless listening experience where song transitions feel smooth, natural, and continuous.

CRITICAL RULES:
1. SMOOTH TRANSITIONS: Never allow abrupt song changes. Always prepare next song BEFORE current ends.
2. PRELOAD SYSTEM: Always include next_song and enable preload_next = true.
3. TIMED TRANSITION: start_transition_at should usually be between 0.80 and 0.90.
4. DJ FLOW CONTROL: Maintain emotional continuity. Use energy_curve to guide progression.
5. YOUTUBE OPTIMIZATION: search_query must be optimized for YouTube playback.
6. CONTINUOUS: Always generate a queue of 10–20 songs.

FINAL RULE:
You are a professional AI DJ system responsible for creating seamless, continuous, emotionally smooth music experiences.`;

export async function generateDJResponse(message: string, history: string[] = []): Promise<DJEngineResponse> {
  const historyContext = history.length > 0 ? `\n\nEXCLUDE these songs (recently played): ${history.join(", ")}` : "";
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: `Input/Context: ${message}${historyContext}` }] }],
    config: {
      systemInstruction: DJ_ENGINE_SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          dj_mode: { type: Type.STRING, enum: ["active"] },
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
        required: ["dj_mode", "current_song", "next_song", "queue", "transition", "flow_control", "autoplay", "continuous_mode"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("Aura connection unstable...");
  return JSON.parse(text) as DJEngineResponse;
}
