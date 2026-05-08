export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface SpotifyUser {
  display_name: string;
  email: string;
  images: { url: string }[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
  uri: string;
}

class SpotifyService {
  private tokens: SpotifyTokens | null = null;

  constructor() {
    const saved = localStorage.getItem('aura-spotify-tokens');
    if (saved) {
      this.tokens = JSON.parse(saved);
    }
  }

  setTokens(tokens: SpotifyTokens) {
    this.tokens = tokens;
    localStorage.setItem('aura-spotify-tokens', JSON.stringify(tokens));
  }

  logout() {
    this.tokens = null;
    localStorage.removeItem('aura-spotify-tokens');
  }

  async fetchWithAuth(url: string, options: RequestInit = {}) {
    if (!this.tokens) throw new Error('Not authenticated with Spotify');

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.tokens.access_token}`,
      },
    });

    if (response.status === 401) {
      // Token expired - in a real app, implement refresh logic here
      this.logout();
      throw new Error('Spotify session expired');
    }

    return response;
  }

  async getUserProfile(): Promise<SpotifyUser> {
    const res = await this.fetchWithAuth('https://api.spotify.com/v1/me');
    return res.json();
  }

  async getUserPlaylists() {
    const res = await this.fetchWithAuth('https://api.spotify.com/v1/me/playlists');
    return res.json();
  }

  async getLikedSongs(limit = 20) {
    const res = await this.fetchWithAuth(`https://api.spotify.com/v1/me/tracks?limit=${limit}`);
    return res.json();
  }

  async searchTracks(query: string) {
    const res = await this.fetchWithAuth(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`);
    return res.json();
  }

  isAuthenticated() {
    return !!this.tokens;
  }
}

export const spotifyService = new SpotifyService();
