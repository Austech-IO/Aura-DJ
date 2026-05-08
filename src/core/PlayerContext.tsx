import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Track, Playlist } from '../types';
import { OfflineService } from '../services/offlineService';

interface PlayerContextType {
  activeTrack: Track | null;
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  repeatMode: 'none' | 'one' | 'all';
  isShuffled: boolean;
  
  buffered: number;
  pinnedIds: string[];
  downloadedIds: string[];
  removeTrack: (index: number) => void;
  addTrackToQueue: (track: Track) => void;
  insertNext: (track: Track) => void;
  insertTrack: (index: number, track: Track) => void;
  setQueue: (tracks: Track[]) => void;
  undo: () => void;
  canUndo: boolean;
  showUndoToast: boolean;
  setShowUndoToast: (show: boolean) => void;
  togglePinTrack: (track: Track) => void;
  toggleDownloadTrack: (track: Track) => Promise<void>;
  playTrack: (track: Track, options?: { fadeOut?: number; fadeIn?: number; replaceQueue?: boolean; index?: number }) => Promise<void>;
  togglePlay: () => Promise<void>;
  playNext: () => void;
  playPrev: () => void;
  setVolume: (vol: number) => void;
  seekTo: (time: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setDjConfig: (config: any) => void;
  setNextTrack: (track: Track | null) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within PlayerProvider');
  return context;
};

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [queue, setQueueState] = useState<Track[]>([]);
  const [history, setHistory] = useState<{ queue: Track[], currentIndex: number }[]>([]);
  const [showUndoToast, setShowUndoToast] = useState(false);
  
  const activeTrack = currentIndex >= 0 ? queue[currentIndex] : null;

  const queueRef = useRef(queue);
  const currentIndexRef = useRef(currentIndex);

  useEffect(() => {
    queueRef.current = queue;
    currentIndexRef.current = currentIndex;
  }, [queue, currentIndex]);

  const pushToHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-9), { queue: [...queueRef.current], currentIndex: currentIndexRef.current }]);
    setShowUndoToast(true);
  }, []);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setQueueState(last.queue);
    setCurrentIndex(last.currentIndex);
  }, [history]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('aura-pinned-ids');
    return saved ? JSON.parse(saved) : [];
  });
  const [downloadedIds, setDownloadedIds] = useState<string[]>([]);
  const [volume, setVolumeState] = useState(80);

  useEffect(() => {
    loadDownloadedIds();
  }, []);

  const loadDownloadedIds = async () => {
    const tracks = await OfflineService.getDownloadedTracks();
    setDownloadedIds(tracks.map(t => t.searchQuery));
  };

  const toggleDownloadTrack = async (track: Track) => {
    const isDownloaded = downloadedIds.includes(track.searchQuery);
    if (isDownloaded) {
      await OfflineService.removeTrack(track.searchQuery);
      setDownloadedIds(prev => prev.filter(id => id !== track.searchQuery));
    } else {
      await OfflineService.saveTrack(track);
      setDownloadedIds(prev => [...prev, track.searchQuery]);
    }
  };

  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
  const [isShuffled, setIsShuffled] = useState(false);
  
  const playerRef = useRef<any>(null);
  const progressInterval = useRef<any>(null);
  const fadeIntervalRef = useRef<any>(null);
  const skipToNextRef = useRef<() => void>(() => {});

  // Ramp Volume helper (stabilized with useCallback)
  const rampVolume = useCallback((target: number, durationMs: number = 1000) => {
    return new Promise<void>((resolve) => {
      if (!playerRef.current || typeof playerRef.current.getVolume !== 'function') {
        resolve();
        return;
      }

      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

      const startVol = playerRef.current.getVolume();
      const steps = 20;
      const stepTime = durationMs / steps;
      const stepAmount = (target - startVol) / steps;
      let currentVol = startVol;
      let stepCount = 0;

      fadeIntervalRef.current = setInterval(() => {
        stepCount++;
        currentVol += stepAmount;
        
        const finalVol = Math.max(0, Math.min(100, currentVol));
        playerRef.current.setVolume(finalVol);

        if (stepCount >= steps) {
          playerRef.current.setVolume(target);
          clearInterval(fadeIntervalRef.current);
          resolve();
        }
      }, stepTime);
    });
  }, []);

  const togglePlay = useCallback(async () => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        await rampVolume(0, 500);
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
        await rampVolume(volume, 500);
      }
    } catch (e) {
      console.warn("Toggle play failed", e);
    }
  }, [isPlaying, rampVolume, volume]);

  const initPlayer = useCallback((videoId: string, fadeInMs: number = 1500) => {
    if (!window.YT || !window.YT.Player) {
      console.warn('YouTube API not ready');
      return;
    }

    if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
      playerRef.current.setVolume(0);
      playerRef.current.loadVideoById(videoId);
      setIsPlaying(true);
      rampVolume(volume, fadeInMs);
      return;
    }

    playerRef.current = new window.YT.Player('youtube-player-mount', {
      height: '0',
      width: '0',
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0
      },
      events: {
        onReady: (event: any) => {
          event.target.setVolume(0);
          setIsPlaying(true);
          rampVolume(volume, fadeInMs);
        },
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
            setDuration(playerRef.current.getDuration());
          } else if (event.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
          } else if (event.data === window.YT.PlayerState.ENDED) {
            if (repeatModeRef.current === 'one') {
              playerRef.current.seekTo(0);
              playerRef.current.playVideo();
            } else {
              skipToNextRef.current();
            }
          }
        }
      }
    });
  }, [volume, rampVolume]);

  const searchYouTube = async (query: string): Promise<any> => {
    try {
      const response = await fetch(`${window.location.origin}/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error("Search failed");
      return await response.json();
    } catch (error) {
      console.error("Search API Error:", error);
      throw error;
    }
  };

  const playTrack = useCallback(async (track: Track, options: { fadeOut?: number; fadeIn?: number; replaceQueue?: boolean; index?: number } = {}) => {
    const { fadeOut = 800, fadeIn = 1500, index } = options;
    
    // Check if it's already the active track by index or search query if index is not provided
    const targetIndex = index !== undefined ? index : queueRef.current.findIndex(t => t.searchQuery === track.searchQuery);
    
    if (currentIndexRef.current === targetIndex && targetIndex !== -1 && isPlaying) {
      togglePlay();
      return;
    }

    if (playerRef.current && isPlaying) {
      await rampVolume(0, fadeOut);
    }

    try {
      let videoId = track.youtubeId;
      if (!videoId) {
        const results = await searchYouTube(track.searchQuery);
        const data = Array.isArray(results) ? results[0] : results;
        videoId = data?.id?.videoId || data?.id;
      }

      if (videoId) {
        const enrichedTrack = { ...track, youtubeId: videoId };
        
        if (targetIndex !== -1) {
          const newQueue = [...queueRef.current];
          newQueue[targetIndex] = enrichedTrack;
          setQueueState(newQueue);
          setCurrentIndex(targetIndex);
        } else {
          const newQueue = [...queueRef.current, enrichedTrack];
          setQueueState(newQueue);
          setCurrentIndex(newQueue.length - 1);
        }

        initPlayer(videoId, fadeIn);
      }
    } catch (error) {
      console.error("PlayTrack failed:", error);
    }
  }, [isPlaying, rampVolume, togglePlay, initPlayer]);

  const skipToNext = useCallback(() => {
    if (queue.length === 0) return;
    
    if (isShuffled) {
      const randomIndex = Math.floor(Math.random() * queue.length);
      playTrack(queue[randomIndex], { index: randomIndex });
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      playTrack(queue[nextIndex], { index: nextIndex });
    } else if (repeatMode === 'all') {
      playTrack(queue[0], { index: 0 });
    } else {
      setIsPlaying(false);
    }
  }, [queue, currentIndex, repeatMode, isShuffled, playTrack]);

  useEffect(() => {
    skipToNextRef.current = skipToNext;
  }, [skipToNext]);

  const repeatModeRef = useRef(repeatMode);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  const [djConfig, setDjConfig] = useState<any>(null);
  const [nextTrack, setNextTrack] = useState<Track | null>(null);

  const handleNextInternal = useCallback(() => {
    skipToNext();
  }, [skipToNext]);

  // Handle DJ Transitions
  useEffect(() => {
    if (isPlaying && duration > 0 && djConfig) {
      const progress = currentTime / duration;
      if (progress >= djConfig.start_transition_at) {
        console.log("DJ Transition Triggered");
        const nextIdx = currentIndex + 1;
        const trackToPlay = nextTrack || (nextIdx < queue.length ? queue[nextIdx] : null);
        
        if (trackToPlay) {
          setDjConfig(null);
          setNextTrack(null);
          playTrack(trackToPlay, { 
            fadeOut: djConfig.crossfade_duration_ms / 2, 
            fadeIn: djConfig.crossfade_duration_ms / 2,
            index: nextIdx < queue.length ? nextIdx : undefined
          });
        }
      }
    }
  }, [currentTime, duration, isPlaying, djConfig, nextTrack, queue, currentIndex, playTrack]);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(vol);
    if (playerRef.current?.setVolume) {
      playerRef.current.setVolume(vol);
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(time);
      setCurrentTime(time);
    }
  }, []);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;
    
    if (isShuffled) {
      const randomIndex = Math.floor(Math.random() * queue.length);
      playTrack(queue[randomIndex], { index: randomIndex });
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      playTrack(queue[nextIndex], { index: nextIndex });
    } else if (repeatMode === 'all' && queue.length > 0) {
      playTrack(queue[0], { index: 0 });
    }
  }, [queue, currentIndex, repeatMode, isShuffled, playTrack]);

  const playPrev = useCallback(() => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      playTrack(queue[prevIndex], { index: prevIndex });
    }
  }, [queue, currentIndex, playTrack]);

  useEffect(() => {
    localStorage.setItem('aura-pinned-ids', JSON.stringify(pinnedIds));
  }, [pinnedIds]);

  const removeTrack = useCallback((index: number) => {
    pushToHistory();
    setQueueState(prev => {
      const next = prev.filter((_, i) => i !== index);
      return next;
    });
    
    if (index < currentIndexRef.current) {
      setCurrentIndex(prev => prev - 1);
    } else if (index === currentIndexRef.current) {
      skipToNext();
    }
  }, [pushToHistory, skipToNext]);

  const addTrackToQueue = useCallback((track: Track) => {
    pushToHistory();
    setQueueState(prev => [...prev, track]);
  }, [pushToHistory]);

  const insertNext = useCallback((track: Track) => {
    pushToHistory();
    setQueueState(prev => {
      const nextIndex = currentIndexRef.current + 1;
      const newQueue = [...prev];
      newQueue.splice(nextIndex, 0, track);
      return newQueue;
    });
  }, [pushToHistory]);

  const insertTrack = useCallback((index: number, track: Track) => {
    pushToHistory();
    setQueueState(prev => {
      const newQueue = [...prev];
      newQueue.splice(index, 0, track);
      return newQueue;
    });
  }, [pushToHistory]);

  const setQueue = useCallback((tracks: Track[]) => {
    pushToHistory();
    setQueueState(tracks);
    setCurrentIndex(tracks.length > 0 ? 0 : -1);
  }, [pushToHistory]);

  const togglePinTrack = useCallback((track: Track) => {
    const id = track.searchQuery;
    setPinnedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  }, []);

  const toggleShuffle = useCallback(() => setIsShuffled(prev => !prev), []);
  const toggleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      const modes: ('none' | 'one' | 'all')[] = ['none', 'one', 'all'];
      return modes[(modes.indexOf(prev) + 1) % modes.length];
    });
  }, []);

  // Progress Update Loop
  useEffect(() => {
    if (isPlaying) {
      progressInterval.current = setInterval(() => {
        if (playerRef.current?.getCurrentTime) {
          setCurrentTime(playerRef.current.getCurrentTime());
        }
        if (playerRef.current?.getVideoLoadedFraction) {
          setBuffered(playerRef.current.getVideoLoadedFraction() * (playerRef.current.getDuration() || 0));
        }
      }, 1000);
    } else {
      clearInterval(progressInterval.current);
    }
    return () => clearInterval(progressInterval.current);
  }, [isPlaying]);

  const value = {
    activeTrack,
    queue,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    buffered,
    pinnedIds,
    downloadedIds,
    volume,
    repeatMode,
    isShuffled,
    playTrack,
    togglePlay,
    playNext,
    playPrev,
    setVolume,
    seekTo,
    setQueue,
    removeTrack,
    addTrackToQueue,
    togglePinTrack,
    toggleDownloadTrack,
    toggleShuffle,
    toggleRepeat,
    undo,
    canUndo: history.length > 0,
    showUndoToast,
    setShowUndoToast,
    insertNext,
    insertTrack,
    setDjConfig,
    setNextTrack
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};
