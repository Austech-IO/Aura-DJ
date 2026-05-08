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

export async function generatePlaylist(userInput: string, history: string[] = []): Promise<PlaylistData> {
  try {
    const response = await fetch("/api/generate/playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userInput, history })
    });
    if (!response.ok) throw new Error("AI Signal Lost");
    return await response.json();
  } catch (error) {
    console.error("Gemini Generate Playlist Error:", error);
    throw error;
  }
}

export async function generateSongExperience(title: string, artist: string): Promise<SongExperienceData> {
  try {
    const response = await fetch("/api/generate/experience", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, artist })
    });
    if (!response.ok) throw new Error("Experience interpretation failed");
    return await response.json();
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
    const response = await fetch("/api/generate/dj", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, history })
    });
    if (!response.ok) throw new Error("Aura connection unstable...");
    return await response.json();
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
    const response = await fetch("/api/generate/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ history })
    });
    if (!response.ok) throw new Error("Neural insights failed");
    return await response.json();
  } catch (error) {
    console.error("Gemini Profile Insights Error:", error);
    throw error;
  }
}

export async function generateVibeSuggestion(arc: any): Promise<string> {
  try {
    const response = await fetch("/api/generate/vibe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arc })
    });
    if (!response.ok) throw new Error("Vibe suggestion failure");
    const data = await response.json();
    return data.text;
  } catch (error) {
    console.error("Gemini Vibe Suggestion Error:", error);
    return "The energy is shifting. Ready for a new direction?";
  }
}
