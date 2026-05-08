export interface TrackLog {
  title: string;
  artist: string;
  bpm: number;
  energy: number;
  timestamp: number;
}

export interface SessionArc {
  avgBpm: number;
  avgEnergy: number;
  durationMins: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'late-night';
}

const STORAGE_KEY = 'aura_session';

export const AuraSession = {
  logTrack(track: Omit<TrackLog, 'timestamp'>) {
    const history = this.getHistory();
    const newEntry: TrackLog = { ...track, timestamp: Date.now() };
    
    const updatedHistory = [newEntry, ...history].slice(0, 50);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updatedHistory));
  },

  getHistory(): TrackLog[] {
    try {
      const data = sessionStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  getArc(): SessionArc {
    const history = this.getHistory();
    if (history.length === 0) {
      return { avgBpm: 0, avgEnergy: 0, durationMins: 0, timeOfDay: this.getTimeOfDay() };
    }

    const avgBpm = Math.round(history.reduce((acc, t) => acc + t.bpm, 0) / history.length);
    const avgEnergy = Math.round((history.reduce((acc, t) => acc + t.energy, 0) / history.length) * 10) / 10;
    
    // Duration from first track to now
    const firstTrack = history[history.length - 1];
    const durationMins = Math.round((Date.now() - firstTrack.timestamp) / 60000);

    return {
      avgBpm,
      avgEnergy,
      durationMins,
      timeOfDay: this.getTimeOfDay()
    };
  },

  getTimeOfDay(): SessionArc['timeOfDay'] {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'late-night';
  },

  clear() {
    sessionStorage.removeItem(STORAGE_KEY);
  }
};
