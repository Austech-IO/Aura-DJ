import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { Track, Playlist } from '../types';

interface PlayerContextType {
  activeTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  repeatMode: 'none' | 'one' | 'all';
  isShuffled: boolean;
  
  playTrack: (track: Track, options?: { fadeOut?: number; fadeIn?: number; replaceQueue?: boolean }) => Promise<void>;
  togglePlay: () => Promise<void>;
  playNext: () => void;
  playPrev: () => void;
  setVolume: (vol: number) => void;
  seekTo: (time: number) => void;
  setQueue: (tracks: Track[]) => void;
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
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(80);
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
  const [isShuffled, setIsShuffled] = useState(false);
  
  const playerRef = useRef<any>(null);
  const progressInterval = useRef<any>(null);
  const fadeIntervalRef = useRef<any>(null);

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

  const skipToNext = useCallback(() => {
    if (queue.length === 0) return;
    const currentIndex = queue.findIndex(t => t.searchQuery === activeTrack?.searchQuery);
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      playTrack(queue[nextIndex]);
    } else if (repeatMode === 'all') {
      playTrack(queue[0]);
    } else {
      setIsPlaying(false);
    }
  }, [queue, activeTrack, repeatMode]);

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
            if (repeatMode === 'one') {
              playerRef.current.seekTo(0);
              playerRef.current.playVideo();
            } else {
              skipToNext();
            }
          }
        }
      }
    });
  }, [volume, rampVolume, repeatMode, skipToNext]);

  const playTrack = async (track: Track, options: { fadeOut?: number; fadeIn?: number; replaceQueue?: boolean } = {}) => {
    const { fadeOut = 800, fadeIn = 1500, replaceQueue = false } = options;
    
    if (activeTrack?.searchQuery === track.searchQuery) {
      togglePlay();
      return;
    }

    if (playerRef.current && isPlaying) {
      await rampVolume(0, fadeOut);
    }

    if (replaceQueue) {
      // Future: handle context-based queue replacement
    }

    try {
      let videoId = track.youtubeId;
      if (!videoId) {
        const data = await searchYouTube(track.searchQuery);
        videoId = data.id?.videoId || data.id;
      }

      if (videoId) {
        setActiveTrack({ ...track, youtubeId: videoId });
        initPlayer(videoId, fadeIn);
      }
    } catch (error) {
      console.error("PlayTrack failed:", error);
    }
  };

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
        const trackToPlay = nextTrack || (queue.findIndex(t => t.searchQuery === activeTrack?.searchQuery) + 1 < queue.length ? queue[queue.findIndex(t => t.searchQuery === activeTrack?.searchQuery) + 1] : null);
        
        if (trackToPlay) {
          setDjConfig(null);
          setNextTrack(null);
          playTrack(trackToPlay, { 
            fadeOut: djConfig.crossfade_duration_ms / 2, 
            fadeIn: djConfig.crossfade_duration_ms / 2 
          });
        }
      }
    }
  }, [currentTime, duration, isPlaying, djConfig, nextTrack, queue, activeTrack, playTrack]);

  const togglePlay = async () => {
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
  };

  const setVolume = (vol: number) => {
    setVolumeState(vol);
    if (playerRef.current?.setVolume) {
      playerRef.current.setVolume(vol);
    }
  };

  const seekTo = (time: number) => {
    if (playerRef.current?.seekTo) {
      playerRef.current.seekTo(time);
      setCurrentTime(time);
    }
  };

  const playNext = useCallback(() => {
    const currentIndex = queue.findIndex(t => t.searchQuery === activeTrack?.searchQuery);
    const nextIndex = currentIndex + 1;
    if (nextIndex < queue.length) {
      playTrack(queue[nextIndex]);
    } else if (repeatMode === 'all' && queue.length > 0) {
      playTrack(queue[0]);
    }
  }, [queue, activeTrack, repeatMode]);

  const playPrev = useCallback(() => {
    const currentIndex = queue.findIndex(t => t.searchQuery === activeTrack?.searchQuery);
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      playTrack(queue[prevIndex]);
    }
  }, [queue, activeTrack]);

  const toggleShuffle = () => setIsShuffled(!isShuffled);
  const toggleRepeat = () => {
    const modes: ('none' | 'one' | 'all')[] = ['none', 'one', 'all'];
    setRepeatMode(modes[(modes.indexOf(repeatMode) + 1) % modes.length]);
  };

  // Progress Update Loop
  useEffect(() => {
    if (isPlaying) {
      progressInterval.current = setInterval(() => {
        if (playerRef.current?.getCurrentTime) {
          setCurrentTime(playerRef.current.getCurrentTime());
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
    isPlaying,
    currentTime,
    duration,
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
    toggleShuffle,
    toggleRepeat,
    setDjConfig,
    setNextTrack
  };

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
};
