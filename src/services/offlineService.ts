import { get, set, del, keys } from 'idb-keyval';
import { Track } from '../types';

export class OfflineService {
  private static STORAGE_KEY_PREFIX = 'aura-offline-track-';

  static async saveTrack(track: Track) {
    // In a real app with clean audio streams, we'd fetch the audio blob and save it
    // For this prototype, we're caching the metadata and marking it as "downloaded"
    // We also cache the lyrics if available.
    try {
      await set(`${this.STORAGE_KEY_PREFIX}${track.searchQuery}`, {
        ...track,
        downloadedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Failed to save track offline:', error);
      return false;
    }
  }

  static async removeTrack(trackId: string) {
    await del(`${this.STORAGE_KEY_PREFIX}${trackId}`);
  }

  static async getDownloadedTracks(): Promise<Track[]> {
    const allKeys = await keys();
    const trackKeys = allKeys.filter(k => typeof k === 'string' && k.startsWith(this.STORAGE_KEY_PREFIX));
    
    const tracks: Track[] = [];
    for (const key of trackKeys) {
      const track = await get(key);
      if (track) tracks.push(track);
    }
    return tracks;
  }

  static async isDownloaded(trackId: string): Promise<boolean> {
    const track = await get(`${this.STORAGE_KEY_PREFIX}${trackId}`);
    return !!track;
  }
}
