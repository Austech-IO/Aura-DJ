export interface Track {
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: string;
  year: string;
  searchQuery: string;
  thumbnailHint?: string;
  youtubeId?: string;
  spotifyId?: string;
  spotifyUri?: string;
  thumbnail?: string;
  isDownloaded?: boolean;
  bpm?: number;
  energy?: number;
}

export interface SongExperience {
  song: {
    title: string;
    artist: string;
  };
  mood: string;
  energyLevel: "low" | "medium" | "high";
  themeColor: string;
  interpretation: string;
  lyricsStyle: string[];
  uiNotes: string;
}

export interface Playlist {
  id?: string;
  userId: string;
  mood: string;
  energyLevel: "low" | "medium" | "high";
  themeColor: string;
  title: string;
  description: string;
  tracks: Track[];
  createdAt: any;
}
