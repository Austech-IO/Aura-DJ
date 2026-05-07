import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Music2, 
  Play, 
  Pause, 
  History, 
  User, 
  LogOut, 
  Sparkles,
  ChevronRight,
  TrendingUp,
  Volume2,
  ListMusic
} from "lucide-react";
import { auth, db, signIn, logout, handleFirestoreError, OperationType } from "./services/firebase";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  limit,
  serverTimestamp,
  deleteDoc,
  getDocs,
  writeBatch,
  doc
} from "firebase/firestore";
import { generatePlaylist, PlaylistData, generateSongExperience, SongExperienceData, generateDJResponse, DJEngineResponse } from "./services/gemini";
import { Playlist, Track, SongExperience } from "./types";

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

// --- Components ---

const EditorialBg = () => (
  <div className="fixed inset-0 -z-10 bg-base overflow-hidden">
    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] contrast-150 brightness-150" />
    <div className="absolute top-0 left-0 w-full h-[1px] bg-white/5" />
    <div className="absolute bottom-0 left-0 w-full h-[1px] bg-white/5" />
  </div>
);

const SectionLabel = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <h2 className={`text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-6 ${className}`}>{children}</h2>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [history, setHistory] = useState<Playlist[]>([]);
  const [activeTrack, setActiveTrack] = useState<Track | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  // Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeatMode, setRepeatMode] = useState<'none' | 'one' | 'all'>('none');
  const [isShuffled, setIsShuffled] = useState(false);
  const [playlistQueue, setPlaylistQueue] = useState<Track[]>([]);
  const [songExperience, setSongExperience] = useState<SongExperience | null>(null);
  const [isExpLoading, setIsExpLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'aura', text: string }[]>([
    { role: 'aura', text: "Neural connection established. How can I tune your frequency today?" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [djConfig, setDjConfig] = useState<DJEngineResponse['transition'] | null>(null);
  const [nextTrack, setNextTrack] = useState<Track | null>(null);
  
  const playerRef = useRef<any>(null);
  const progressInterval = useRef<any>(null);
  const fadeIntervalRef = useRef<any>(null);

  const rampVolume = (target: number, duration: number = 1000) => {
    return new Promise<void>((resolve) => {
      if (!playerRef.current || typeof playerRef.current.getVolume !== 'function') {
        resolve();
        return;
      }

      if (fadeIntervalRef.current) clearInterval(fadeIntervalRef.current);

      const startVol = playerRef.current.getVolume();
      const steps = 20;
      const stepTime = duration / steps;
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
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, "playlists"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Playlist));
      setHistory(docs);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "playlists");
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (history.length > 0 && !currentPlaylist && !isLoading) {
      const latest = history[0];
      setCurrentPlaylist(latest);
      setPlaylistQueue(latest.tracks);
    }
  }, [history, currentPlaylist, isLoading]);

  // YouTube API initialization
  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      console.log('YouTube API Ready');
    };
  }, []);

  const onPlayerStateChange = (event: any) => {
    if (event.data === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
      setDuration(playerRef.current.getDuration());
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      setIsPlaying(false);
    } else if (event.data === window.YT.PlayerState.ENDED) {
      handleTrackEnd();
    }
  };

  const handleTrackEnd = () => {
    if (repeatMode === 'one') {
      playerRef.current.seekTo(0);
      playerRef.current.playVideo();
    } else {
      playNext();
    }
  };

  const playNext = () => {
    if (!currentPlaylist) return;
    const currentIndex = playlistQueue.findIndex(t => t.searchQuery === activeTrack?.searchQuery);
    const nextIndex = currentIndex + 1;

    if (nextIndex < playlistQueue.length) {
      playTrack(playlistQueue[nextIndex]);
    } else if (repeatMode === 'all') {
      playTrack(playlistQueue[0]);
    } else {
      // Continuous mode: If we reach the end, ask DJ for more songs
      setChatMessages(prev => [...prev, { role: 'aura', text: "Sequence complete. Evolving the frequency..." }]);
      handleChatSubmit(new Event('submit') as any, "continue the vibe with fresh tracks related to the current mood");
    }
  };

  const playPrev = () => {
    if (!currentPlaylist) return;
    const currentIndex = playlistQueue.findIndex(t => t.searchQuery === activeTrack?.searchQuery);
    const prevIndex = currentIndex - 1;

    if (prevIndex >= 0) {
      playTrack(playlistQueue[prevIndex]);
    }
  };

  const toggleShuffle = () => {
    if (!currentPlaylist) return;
    const newShuffle = !isShuffled;
    setIsShuffled(newShuffle);

    if (newShuffle) {
      const shuffled = [...currentPlaylist.tracks].sort(() => Math.random() - 0.5);
      setPlaylistQueue(shuffled);
    } else {
      setPlaylistQueue(currentPlaylist.tracks);
    }
  };

  const toggleRepeat = () => {
    const modes: ('none' | 'one' | 'all')[] = ['none', 'one', 'all'];
    const nextMode = modes[(modes.indexOf(repeatMode) + 1) % modes.length];
    setRepeatMode(nextMode);
  };

  useEffect(() => {
    if (isPlaying) {
      progressInterval.current = setInterval(() => {
        if (playerRef.current && playerRef.current.getCurrentTime) {
          setCurrentTime(playerRef.current.getCurrentTime());
        }
      }, 1000);
    } else {
      clearInterval(progressInterval.current);
    }
    return () => clearInterval(progressInterval.current);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying && duration > 0 && djConfig) {
      const progress = currentTime / duration;
      if (progress >= djConfig.start_transition_at) {
        console.log("DJ Transition Triggered at", progress);
        const transitionTo = nextTrack;
        const fadeOutDuration = djConfig.crossfade_duration_ms / 2;
        const fadeInDuration = djConfig.crossfade_duration_ms / 2;
        
        setDjConfig(null); 
        setNextTrack(null);
        
        if (transitionTo) {
          playTrack(transitionTo, fadeOutDuration, fadeInDuration);
          // Request next set of instructions for the new current track to keep flow dynamic
          handleChatSubmit(new Event('submit') as any, `The current song is now ${transitionTo.title} by ${transitionTo.artist}. Provide the next transition and recommendation for continuous flow.`, true);
        } else {
          playNext();
        }
      }
    }
  }, [currentTime, duration, isPlaying, djConfig, nextTrack]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current || duration === 0) return;
    if (typeof playerRef.current.seekTo !== 'function') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const seekTime = percentage * duration;
    playerRef.current.seekTo(seekTime);
    setCurrentTime(seekTime);
  };

  const initPlayer = (videoId: string, fadeInMs: number = 1500) => {
    if (!window.YT || !window.YT.Player) {
      console.warn('YouTube API not ready yet. Retrying in 1s...');
      setTimeout(() => initPlayer(videoId, fadeInMs), 1000);
      return;
    }

    if (playerRef.current) {
      try {
        if (typeof playerRef.current.loadVideoById === 'function') {
          playerRef.current.setVolume(0);
          playerRef.current.loadVideoById(videoId);
          setIsPlaying(true);
          rampVolume(volume, fadeInMs); // Fade in smoothly
        } else {
          console.warn('Player exists but API methods are not ready. Retrying in 500ms...');
          setTimeout(() => initPlayer(videoId, fadeInMs), 500);
        }
      } catch (err) {
        console.error("Failed to load video:", err);
      }
      return;
    }

    playerRef.current = new window.YT.Player('youtube-player', {
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
          rampVolume(volume, fadeInMs); // Initial fade in
        },
        onStateChange: onPlayerStateChange
      }
    });
  };

  const clearHistory = async () => {
    if (!user || !confirm("Clear all session history?")) return;
    try {
      const q = query(collection(db, "playlists"), where("userId", "==", user.uid));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      setCurrentPlaylist(null);
      setActiveTrack(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "playlists");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseInt(e.target.value);
    setVolume(newVol);
    if (playerRef.current?.setVolume) {
      playerRef.current.setVolume(newVol);
    }
  };

  const togglePlay = async () => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        await rampVolume(0, 500);
        if (typeof playerRef.current.pauseVideo === 'function') {
          playerRef.current.pauseVideo();
        }
      } else {
        if (typeof playerRef.current.playVideo === 'function') {
          playerRef.current.playVideo();
          await rampVolume(volume, 500);
        }
      }
    } catch (e) {
      console.warn("Toggle play failed", e);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent, forcedInput?: string, isSilent: boolean = false) => {
    if (e) e.preventDefault();
    const userMsg = forcedInput || chatInput;
    if (!userMsg.trim() || isChatLoading) return;

    if (!forcedInput) setChatInput("");
    if (!isSilent) {
      setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
      setIsChatLoading(true);
    }

    try {
      const historyTitles = history.flatMap(p => p.tracks.map(t => t.title)).slice(0, 50);
      const aiResponse = await generateDJResponse(userMsg, historyTitles);
      
      if (aiResponse.message && !isSilent) {
        setChatMessages(prev => [...prev, { role: 'aura', text: aiResponse.message }]);
      }

      if (aiResponse.dj_mode === "active") {
        setDjConfig(aiResponse.transition);

        // Current track
        const currentTrack: Track = {
          title: aiResponse.current_song.title,
          artist: aiResponse.current_song.artist,
          searchQuery: aiResponse.current_song.search_query,
          album: "AI Stream",
          genre: aiResponse.mood || "Dynamic",
          duration: "3:30",
          year: new Date().getFullYear().toString(),
          youtubeId: ""
        };

        // Next track (to be preloaded)
        const nextT: Track = {
          title: aiResponse.next_song.title,
          artist: aiResponse.next_song.artist,
          searchQuery: aiResponse.next_song.search_query,
          album: "AI Stream",
          genre: aiResponse.mood || "Dynamic",
          duration: "3:30",
          year: new Date().getFullYear().toString(),
          youtubeId: ""
        };

        // Complete queue
        const queueTracks: Track[] = aiResponse.queue.map(s => ({
          title: s.title,
          artist: s.artist,
          searchQuery: s.search_query,
          album: "AI Queue",
          genre: aiResponse.mood || "Dynamic",
          duration: "3:30",
          year: new Date().getFullYear().toString(),
          youtubeId: ""
        }));

        const tracks = [currentTrack, nextT, ...queueTracks];

        const newPlaylist: Playlist = {
          id: `dj-${Date.now()}`,
          title: `Aura: ${aiResponse.mood || 'Continuous'}`,
          description: aiResponse.message || "Evolving the soundscape.",
          tracks,
          createdAt: new Date().toISOString(),
          userId: user.uid,
          themeColor: aiResponse.energy_level === "high" ? "#ff4444" : aiResponse.energy_level === "medium" ? "#4444ff" : "#44ff44",
          mood: aiResponse.mood,
          energyLevel: aiResponse.energy_level
        };

        setCurrentPlaylist(newPlaylist);
        setPlaylistQueue(tracks);
        
        // Start current
        await playTrack(currentTrack);

        // Preload next
        try {
          const data = await searchYouTube(nextT.searchQuery);
          const vidId = data.id?.videoId || data.id;
          if (vidId) {
            setNextTrack({ ...nextT, youtubeId: vidId });
          }
        } catch (err) {
          console.warn("Preload failed", err);
        }
      }
    } catch (error) {
       setChatMessages(prev => [...prev, { role: 'aura', text: "Signal interference detected. Please retry." }]);
    } finally {
      if (!isSilent) setIsChatLoading(false);
    }
  };

  const handleGenerate = async (e?: React.FormEvent, forcedInput?: string) => {
    if (e) e.preventDefault();
    const targetInput = forcedInput || input;
    if (!targetInput.trim() || !user || isLoading) return;

    setIsLoading(true);
    setCurrentPlaylist(null); // Clear while generating
    setActiveTrack(null);

    try {
      // Collect titles of recently played songs to exclude
      const recentTitles = history.flatMap(p => p.tracks.map(t => t.title)).slice(0, 30);
      
      const data: PlaylistData = await generatePlaylist(targetInput, recentTitles);
      
      if (!data.playlist || data.playlist.length === 0) {
        throw new Error("AI returned empty playlist");
      }

      const tracks: Track[] = data.playlist.map(p => ({
        title: p.title,
        artist: p.artist,
        album: p.album,
        genre: p.genre,
        duration: p.duration,
        year: p.year,
        searchQuery: p.search_query,
        thumbnailHint: p.thumbnail_hint
      }));

      const newPlaylist: Playlist = {
        userId: user.uid,
        mood: data.mood,
        energyLevel: data.energy_level,
        themeColor: data.theme_color,
        title: data.playlist_title,
        description: data.playlist_description,
        tracks,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, "playlists"), newPlaylist);
      const playlistWithId = { ...newPlaylist, id: docRef.id };
      
      setCurrentPlaylist(playlistWithId);
      setPlaylistQueue(tracks);
      await playTrack(tracks[0]);
      setInput("");
    } catch (error) {
      console.error("Signal Generation Failed:", error);
      // Optional: show a user-friendly error instead of just throwing
      // handleFirestoreError logs it correctly for the system but let's not break the user flow
      try {
        handleFirestoreError(error, OperationType.WRITE, "playlists");
      } catch (e) {
        // Silent catch for the re-throw if we want to avoid unhandled rejection in UI
      }
    } finally {
      setIsLoading(false);
    }
  };

  const searchYouTube = async (query: string): Promise<any> => {
    try {
      const response = await fetch(`${window.location.origin}/api/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Search failed with status ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Search API Error:", error);
      throw error;
    }
  };

  const playTrack = async (track: Track, fadeOutMs: number = 800, fadeInMs: number = 1500) => {
    if (activeTrack?.searchQuery === track.searchQuery) {
      togglePlay();
      return;
    }

    // Fade out current track if it exists
    if (playerRef.current && isPlaying) {
      await rampVolume(0, fadeOutMs);
    }

    setSongExperience(null);
    setIsExpLoading(true);

    try {
      // Trigger experience generation in parallel
      generateSongExperience(track.title, track.artist).then(data => {
        setSongExperience({
          song: { title: track.title, artist: track.artist },
          mood: data.mood,
          energyLevel: data.energy_level,
          themeColor: data.theme_color,
          interpretation: data.interpretation,
          lyricsStyle: data.lyrics_style,
          uiNotes: data.ui_notes
        });
        setIsExpLoading(false);
      }).catch(err => {
        console.error("Experience generation failed", err);
        setIsExpLoading(false);
      });

      if (track.youtubeId) {
        setActiveTrack(track);
        initPlayer(track.youtubeId, fadeInMs);
        // Fade in will be handled after initialization or load
        return;
      }

      const data = await searchYouTube(track.searchQuery);
      const videoId = data.id?.videoId || data.id;
      
      if (videoId) {
        const updatedTrack = { 
          ...track, 
          youtubeId: videoId, 
          thumbnail: data.thumbnail?.thumbnails?.[0]?.url 
        };
        setActiveTrack(updatedTrack);
        initPlayer(videoId, fadeInMs);
      }
    } catch (error) {
      console.error("YouTube search failed:", error);
    }
  };

  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const handleSignIn = async () => {
    setIsAuthLoading(true);
    try {
      await signIn();
    } catch (error) {
      // Errors are logged in the service, we just reset state here
    } finally {
      setIsAuthLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="h-screen flex items-center justify-center p-6 bg-base">
        <EditorialBg />
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="max-w-md w-full border border-white/10 bg-surface p-12 space-y-12"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                <div className="w-4 h-4 bg-black rounded-sm rotate-45"></div>
              </div>
              <span className="font-mono text-xs tracking-widest text-accent">NEURAL DJ / AUTH</span>
            </div>
            <h1 className="text-6xl font-bold tracking-tighter">AURA</h1>
            <p className="text-white/40 font-mono text-xs uppercase tracking-widest leading-loose">
              Synthesizing acoustic landscapes through neural resonance. 
              Please authenticate to establish session connection.
            </p>
          </div>
          
          <button 
            onClick={handleSignIn}
            disabled={isAuthLoading}
            className="w-full bg-accent text-black font-bold py-6 rounded-sm hover:brightness-110 transition-all flex items-center justify-center gap-3 group text-sm tracking-widest uppercase disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAuthLoading ? (
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                Authenticate User
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="h-screen flex flex-col overflow-hidden bg-base text-[#e0e0e0] font-sans selection:bg-accent/30 selection:text-black"
      style={{ '--accent-color': currentPlaylist?.themeColor || '#CCFF00' } as React.CSSProperties}
    >
      <EditorialBg />
      
      {/* Header Navigation */}
      <header className="h-16 lg:h-20 border-b border-white/10 flex items-center justify-between px-4 lg:px-10 bg-surface shrink-0 relative z-[70]">
        <div className="flex items-center gap-3 md:gap-6">
          <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-3 lg:hidden text-white/40 hover:text-white"
          >
            <Sparkles className={`w-6 h-6 ${showSidebar ? 'text-accent' : ''}`} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 md:w-6 md:h-6 bg-accent rounded-full flex items-center justify-center">
              <div className="w-2.5 h-2.5 md:w-3 md:h-3 bg-black rounded-sm rotate-45"></div>
            </div>
            <span className="font-mono text-[9px] md:text-[10px] tracking-widest text-accent whitespace-nowrap">AURA_DJ / V.1.0</span>
          </div>
        </div>
        
        <div className="hidden lg:flex gap-8 text-[10px] tracking-[0.2em] uppercase font-semibold text-white/40">
          <button className="text-accent border-b border-accent pb-1">Session</button>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`transition-colors hover:text-white ${showHistory ? 'text-accent' : ''}`}
          >
            History
          </button>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <div className="hidden sm:flex items-center gap-3">
            <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="font-mono text-[9px] text-white/60 tracking-wider uppercase">Neural Active</span>
          </div>
          <div className="h-8 w-px bg-white/10 hidden sm:block" />
          <div className="flex items-center gap-2 md:gap-4">
             <button 
               onClick={() => setShowHistory(!showHistory)}
               className={`p-2 lg:hidden ${showHistory ? 'text-accent' : 'text-white/40'}`}
             >
               <History className="w-5 h-5" />
             </button>
             <div className="flex items-center gap-3 pl-2 sm:pl-0">
               <span className="font-mono text-[9px] md:text-[10px] text-white/40 uppercase truncate max-w-[80px] md:max-w-[120px]">{user.email?.split('@')[0]}</span>
               <button 
                 onClick={logout}
                 className="p-1.5 text-white/20 hover:text-white transition-colors"
               >
                 <LogOut className="w-3.5 h-3.5" />
               </button>
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {/* Sidebar: Mood Protocol */}
        <AnimatePresence>
          {(showSidebar || window.innerWidth >= 1024) && (
            <motion.aside 
              initial={window.innerWidth < 1024 ? { x: '-100%' } : {}}
              animate={window.innerWidth < 1024 ? { x: 0 } : {}}
              exit={window.innerWidth < 1024 ? { x: '-100%' } : {}}
              className={`w-[280px] sm:w-80 border-r border-white/10 p-6 lg:p-10 flex flex-col justify-between overflow-y-auto bg-surface lg:bg-surface/50 absolute lg:relative inset-y-0 left-0 z-[80] lg:z-0`}
            >
              <div className="space-y-12">
                <div className="flex items-center justify-between lg:hidden mb-4">
                  <SectionLabel>Mood Protocol</SectionLabel>
                  <button onClick={() => setShowSidebar(false)} className="text-white/40 p-2">
                    <LogOut className="w-4 h-4 rotate-180" />
                  </button>
                </div>
                <section>
                  <SectionLabel className="hidden lg:block">Mood Protocol</SectionLabel>
                  <div className="relative group">
                    <form onSubmit={(e) => { e.preventDefault(); handleGenerate(e); setShowSidebar(false); }}>
                      <input 
                        type="text" 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Describe energy..."
                        className="w-full bg-transparent border-b border-white/20 pb-4 text-xl font-light placeholder:text-white/10 focus:outline-none focus:border-accent transition-colors"
                      />
                      <button 
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className="absolute right-0 bottom-4 text-accent hover:scale-110 transition-transform disabled:opacity-30"
                      >
                        {isLoading ? (
                          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Sparkles className="w-5 h-5" />
                        )}
                      </button>
                    </form>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {["Lofi Beats", "Night Drive", "Cyberpunk", "Zen Focus"].map(tag => (
                      <button 
                        key={tag}
                        onClick={() => { setInput(tag); }}
                        className="text-[9px] font-mono text-left uppercase tracking-wider text-white/30 p-2 border border-white/5 hover:border-accent/30 hover:text-accent transition-all"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </section>

                <AnimatePresence>
                  {currentPlaylist && (
                    <motion.section 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="space-y-6"
                    >
                      <div>
                        <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-2">Resonance Detected</p>
                        <p className="text-2xl font-serif italic capitalize">{currentPlaylist.mood}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/5 rounded-sm border border-white/5">
                          <p className="text-[10px] font-mono text-white/30">LEVEL</p>
                          <p className="text-lg font-mono uppercase text-accent/80">{currentPlaylist.energyLevel}</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-sm border border-white/5 text-right">
                          <p className="text-[10px] font-mono text-white/30 text-right uppercase">Track Count</p>
                          <p className="text-lg font-mono">{currentPlaylist.tracks.length.toString().padStart(2, '0')}</p>
                        </div>
                      </div>
                    </motion.section>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-8 bg-accent/5 p-6 border border-accent/20 rounded-sm">
                <p className="text-[10px] font-mono text-accent mb-2">NEURAL_STATUS</p>
                <p className="text-[11px] leading-relaxed text-accent/70 italic">
                  "Adapting audio parameters to match environmental frequency and neural output for immersive synchronization."
                </p>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Main Stage: Playlist View */}
        <section 
          className="flex-1 p-5 md:p-8 lg:p-12 flex flex-col overflow-y-auto scrollbar-hide relative"
        >
          {/* Neural Experience Layer */}
          <AnimatePresence>
            {activeTrack && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
              >
                <div 
                  className="absolute inset-0 opacity-10 blur-[100px] animate-pulse"
                  style={{ backgroundColor: songExperience?.themeColor || 'var(--accent-color)' }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mb-8 md:mb-10 lg:mb-12 flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/10 pb-8 md:pb-10 lg:pb-12 relative z-10 gap-8">
            <div className="max-w-2xl w-full">
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter leading-tight md:leading-none mb-4 md:mb-6 uppercase break-words w-full">
                {currentPlaylist?.title.split(' ').slice(0, 2).map((word, idx) => (
                  <React.Fragment key={idx}>
                    {idx === 1 ? (
                      <span className="text-transparent" style={{ WebkitTextStroke: '1px rgba(255,255,255,0.2)' }}>
                        {word}
                      </span>
                    ) : word}
                    {idx === 0 && <br className="hidden md:block" />}
                    {idx === 0 && <span className="md:hidden"> </span>}
                  </React.Fragment>
                )) || 'READY STATION'}
              </h1>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-[1px] w-8" style={{ backgroundColor: 'var(--accent-color)' }} />
                  <p className="text-white/40 font-mono text-[10px] uppercase tracking-[0.3em]">Curated Session // {currentPlaylist?.tracks.length || 0} Tracks</p>
                </div>
                <p className="text-white/60 font-serif italic text-base md:text-lg leading-relaxed max-w-xl">
                  {currentPlaylist?.description || "Initialize connection protocol to generate personalized audio landscapes."}
                </p>
              </div>
            </div>
            
            {activeTrack && (
              <div className="flex flex-col md:flex-row items-start md:items-end gap-6 md:gap-12 relative z-10 w-full md:w-auto">
                {songExperience && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-xs text-left md:text-right hidden sm:block"
                  >
                    <p className="text-[10px] font-mono text-white/30 uppercase tracking-[0.2em] mb-2 text-left md:text-right">Neural Interpretation</p>
                    <p className="text-[12px] text-white/50 leading-relaxed italic">{songExperience.interpretation}</p>
                  </motion.div>
                )}
                <div className="text-left md:text-right whitespace-nowrap">
                  <p className="text-4xl md:text-6xl font-mono font-light leading-none flex items-baseline justify-start md:justify-end gap-1">
                    {String((playlistQueue.findIndex(t => t.searchQuery === activeTrack.searchQuery) ?? -1) + 1).padStart(2, '0')}
                    <span className="text-sm text-white/20">/{playlistQueue.length.toString().padStart(2, '0') || '10'}</span>
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mt-2">Active Signal</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-12 relative z-10">
            <div className="grid gap-px bg-white/5 border border-white/5 overflow-hidden h-fit">
              {playlistQueue.map((track, i) => (
              <div 
                key={i}
                onClick={() => playTrack(track)}
                className={`group flex items-center p-4 md:p-6 transition-all cursor-pointer ${
                  activeTrack?.searchQuery === track.searchQuery 
                    ? 'text-black' 
                    : 'hover:bg-white/5'
                }`}
                style={activeTrack?.searchQuery === track.searchQuery ? { backgroundColor: 'var(--accent-color)' } : {}}
              >
                <span className={`font-mono w-16 text-sm ${activeTrack?.searchQuery === track.searchQuery ? 'opacity-100' : 'opacity-20'}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-4">
                    <h3 className="text-xl font-semibold tracking-tight uppercase truncate">{track.title}</h3>
                    <span className={`text-[9px] font-mono whitespace-nowrap ${activeTrack?.searchQuery === track.searchQuery ? 'opacity-60' : 'opacity-20'}`}>
                      {track.year} • {track.genre}
                    </span>
                  </div>
                  <p className={`text-[10px] uppercase font-mono tracking-widest truncate ${activeTrack?.searchQuery === track.searchQuery ? 'opacity-70' : 'opacity-40'}`}>
                    {track.artist} — {track.album}
                  </p>
                </div>
                
                <div className="flex items-center gap-8 ml-8">
                  <div className={`text-[10px] font-mono uppercase tracking-widest ${activeTrack?.searchQuery === track.searchQuery ? 'font-bold' : 'opacity-40'}`}>
                    {activeTrack?.searchQuery === track.searchQuery ? 'RESONATING' : track.duration}
                  </div>
                  <div className={`w-16 h-px ${activeTrack?.searchQuery === track.searchQuery ? 'bg-black/20' : 'bg-white/10 group-hover:w-24 transition-all'}`}></div>
                </div>
              </div>
            ))}
            </div>

            {!currentPlaylist && !isLoading && (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 grayscale opacity-20 col-span-full">
                <Music2 className="w-24 h-24 mb-6 stroke-1 animate-pulse" />
                <p className="text-xs font-mono uppercase tracking-[0.4em]">Initialize Neural Connection</p>
                <p className="text-[10px] mt-4 opacity-50">Describe your vibe in the mood protocol to generate audio landscapes.</p>
              </div>
            )}

            {isLoading && (
              <div className="h-full flex flex-col items-center justify-center text-center py-20 col-span-full">
                <div className="flex gap-2 items-end h-12 mb-8">
                  {[1, 2, 3, 4, 5].map(i => (
                    <motion.div 
                      key={i}
                      animate={{ height: ["20%", "100%", "20%"] }}
                      transition={{ repeat: Infinity, duration: 0.5 + i * 0.1 }}
                      className="w-1.5 bg-accent/40"
                    />
                  ))}
                </div>
                <p className="text-xs font-mono uppercase tracking-[0.4em] text-accent animate-pulse">Synthesizing Frequencies...</p>
              </div>
            )}
          </div>

          {/* Neural Lyrics Display */}
          {activeTrack && (
            <div className="mt-12 space-y-12">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <SectionLabel>Neural Fragments</SectionLabel>
                    <div className="space-y-4">
                      {isExpLoading ? (
                        [1, 2, 3, 4].map(i => (
                          <div key={i} className="h-8 bg-white/5 rounded-sm animate-pulse w-full" style={{ animationDelay: `${i * 0.1}s` }} />
                        ))
                      ) : (
                        songExperience?.lyricsStyle.map((line, i) => (
                          <motion.p 
                            key={i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="text-4xl font-serif italic text-white/80 leading-tight"
                          >
                            {line}
                          </motion.p>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {songExperience && (
                    <div className="space-y-6">
                      <SectionLabel>Atmospheric Data</SectionLabel>
                      <div className="bg-white/5 border border-white/5 p-8 space-y-8">
                        <div className="grid grid-cols-2 gap-8">
                           <div>
                             <p className="text-[9px] font-mono text-white/30 uppercase mb-1">Mood Mapping</p>
                             <p className="text-xl font-medium tracking-tight uppercase">{songExperience.mood}</p>
                           </div>
                           <div>
                             <p className="text-[9px] font-mono text-white/30 uppercase mb-1">Energy Matrix</p>
                             <p className="text-xl font-medium tracking-tight uppercase">{songExperience.energyLevel}</p>
                           </div>
                        </div>
                        <div>
                          <p className="text-[9px] font-mono text-white/30 uppercase mb-2">UI Signal</p>
                          <p className="text-[12px] font-mono opacity-50 uppercase tracking-widest">{songExperience.uiNotes}</p>
                        </div>
                        <div className="flex gap-1 h-2">
                           {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                             <div key={i} className="flex-1 bg-white/10" style={{ backgroundColor: i % 3 === 0 ? 'var(--accent-color)' : '' }} />
                           ))}
                        </div>
                      </div>
                    </div>
                  )}
               </div>
            </div>
          )}
        </section>

        {/* History Overlay/Sidebar */}
        <AnimatePresence>
          {showHistory && (
             <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="w-[280px] sm:w-80 border-l border-white/10 bg-surface/95 backdrop-blur-xl absolute right-0 top-16 lg:top-20 bottom-28 lg:bottom-24 z-[90] p-6 lg:p-10 flex flex-col"
            >
              <div className="flex items-center justify-between mb-8">
                <SectionLabel>Session History</SectionLabel>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={clearHistory}
                    className="text-[9px] font-mono uppercase tracking-widest text-[#ff4444] hover:text-[#ff6666] transition-colors"
                  >
                    Clear
                  </button>
                  <button 
                    onClick={() => setShowHistory(false)}
                    className="p-1 hover:bg-white/5 rounded-full transition-colors md:hidden"
                  >
                    <Music2 className="w-4 h-4 rotate-90" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4">
                {history.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => { setCurrentPlaylist(h); setShowHistory(false); }}
                    className="w-full text-left p-4 border border-white/5 hover:border-accent transition-all group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-1 h-full opacity-20" style={{ backgroundColor: h.themeColor || 'var(--accent-color)' }} />
                    <div className="flex justify-between items-start mb-2">
                       <p className="text-lg font-serif italic truncate">{h.title || h.mood}</p>
                       <span className="text-[9px] font-mono opacity-40 uppercase">/V.S</span>
                    </div>
                    <p className="text-[10px] font-mono text-white/30 uppercase tracking-wider">
                      {h.tracks.length} Tracks • {h.energyLevel} Energy
                    </p>
                  </button>
                ))}
                {history.length === 0 && (
                  <p className="text-center text-[10px] font-mono text-white/20 py-12">DATABASE_EMPTY</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Player Engine */}
      <footer className="h-28 md:h-24 bg-surface/90 backdrop-blur-3xl border-t border-white/10 px-4 md:px-8 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-0 relative z-[100] py-4 md:py-0 shrink-0">
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundColor: 'var(--accent-color)' }} />
        
        {/* Track Progress */}
        <div className="absolute top-0 left-0 right-0 z-50">
          <div className="flex justify-between items-center px-4 md:px-8 mb-1">
            <div className="flex items-center gap-3">
              <span className="text-[10px] md:text-[11px] font-mono font-bold tracking-tight uppercase truncate max-w-[200px] md:max-w-md lg:max-w-xl" style={{ color: 'var(--accent-color)' }}>
                {activeTrack ? `${activeTrack.title} — ${activeTrack.artist}` : 'IDLE'}
              </span>
            </div>
            <span className="text-[9px] md:text-[10px] font-mono text-white/30">
              {activeTrack ? `${formatTime(currentTime)} / ${formatTime(duration)}` : '--:--'}
            </span>
          </div>
          <div 
            className="w-full h-1.5 md:h-1 bg-white/5 cursor-pointer relative group"
            onClick={handleSeek}
          >
            <div className="absolute inset-y-0 left-0 right-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }}
              className="h-full relative z-10"
              style={{ backgroundColor: 'var(--accent-color)' }}
            />
          </div>
        </div>

        {/* Visualizer Plate (Hidden on mobile) */}
        <div className="w-48 h-12 bg-white/5 border border-white/5 hidden md:flex items-center justify-center relative overflow-hidden">
          <div className="flex gap-1 items-end h-6 relative z-10">
            {[0.8, 0.4, 0.7, 0.9, 0.5, 0.6, 0.3, 0.7, 0.8].map((v, i) => (
              <motion.div 
                key={i}
                animate={{ height: activeTrack ? [v * 100 + "%", (1 - v) * 100 + "%", v * 100 + "%"] : v * 24 }}
                transition={{ repeat: Infinity, duration: 0.5 + i * 0.1 }}
                className="w-1" 
                style={{ backgroundColor: 'var(--accent-color)' }}
              />
            ))}
          </div>
        </div>

        {/* Controls Container */}
        <div className="flex items-center justify-between w-full md:w-auto md:gap-12 relative z-50">
          <div className="flex items-center gap-2 md:gap-8">
             <div className="flex items-center gap-1 md:gap-3 pr-2 md:pr-4 border-r border-white/5">
                <button 
                  onClick={toggleShuffle}
                  className={`p-2 transition-colors ${isShuffled ? 'text-accent' : 'text-white/20 hover:text-white'}`}
                >
                   <motion.div animate={isShuffled ? { rotate: [0, 10, -10, 0] } : {}}>
                     <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                   </motion.div>
                </button>
                <button 
                  onClick={toggleRepeat}
                  className={`p-2 transition-colors flex items-center relative ${repeatMode !== 'none' ? 'text-accent' : 'text-white/20 hover:text-white'}`}
                >
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                   {repeatMode === 'one' && <span className="absolute top-0 right-0 text-[8px] font-bold">1</span>}
                </button>
             </div>

             <div className="flex items-center gap-2 md:gap-4 ml-2">
               <button onClick={playPrev} className="p-2 text-white/30 hover:text-white transition-colors">
                  <Play className="w-4 h-4 rotate-180 fill-current" />
               </button>
               <button 
                  onClick={togglePlay}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/20 flex items-center justify-center hover:text-black transition-all"
                  onMouseEnter={(e) => { if(window.innerWidth > 768) e.currentTarget.style.backgroundColor = 'var(--accent-color)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  style={{ touchAction: 'manipulation' }}
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-0.5 fill-current" />}
               </button>
               <button onClick={playNext} className="p-2 text-white/30 hover:text-white transition-colors">
                  <Play className="w-4 h-4 fill-current" />
               </button>
             </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-6">
             <button 
               onClick={() => setShowLyrics(!showLyrics)}
               className={`p-2 transition-all ${showLyrics ? 'text-accent' : 'text-white/30 hover:text-white'}`}
             >
               <ListMusic className="w-5 h-5" />
             </button>
             <div className="hidden sm:flex items-center gap-3 group">
               <Volume2 className="w-4 h-4 text-white/30 group-hover:text-accent transition-colors" />
               <input 
                  type="range" 
                  min="0" max="100" 
                  value={volume}
                  onChange={handleVolumeChange}
                  className="w-20 md:w-32 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent"
                />
             </div>
          </div>
        </div>
        
        {/* Hidden Player Div */}
        <div id="youtube-player" className="hidden" />

        {/* Collapsible Neural Fragments Section (Drawer Style) */}
        <AnimatePresence>
          {showLyrics && activeTrack && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="absolute left-0 right-0 bottom-full bg-surface/95 backdrop-blur-2xl border-t border-white/10 z-40 overflow-hidden"
            >
              <div className="p-6 md:p-12 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <SectionLabel>Neural Fragments</SectionLabel>
                    <span className="text-[10px] font-mono text-accent animate-pulse">STREAMING_LIVE</span>
                  </div>
                  <div className="space-y-6 max-h-[60vh] md:max-h-[70vh] overflow-y-auto pr-4 scrollbar-hide custom-scrollbar">
                    {isExpLoading ? (
                      [1, 2, 3, 4].map(i => (
                        <div key={i} className="h-8 bg-white/5 rounded-sm animate-pulse w-full" style={{ animationDelay: `${i * 0.1}s` }} />
                      ))
                    ) : (
                      songExperience?.lyricsStyle.map((line, i) => (
                        <motion.p 
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="text-2xl md:text-4xl font-serif italic text-white/90 leading-tight tracking-tight"
                        >
                          {line}
                        </motion.p>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-8">
                  <SectionLabel>Signal Interpretation</SectionLabel>
                  <div className="space-y-8">
                    <p className="text-lg md:text-xl font-light text-white/60 leading-relaxed italic border-l-2 border-accent pl-6">
                      {songExperience?.interpretation || "Decoding neural patterns..."}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-px bg-white/5 border border-white/5">
                      <div className="p-4 md:p-6 bg-surface">
                        <p className="text-[8px] font-mono text-white/20 uppercase mb-2">Dominant Mood</p>
                        <p className="text-xs md:text-sm font-mono uppercase tracking-widest text-accent">{songExperience?.mood || '---'}</p>
                      </div>
                      <div className="p-4 md:p-6 bg-surface">
                        <p className="text-[8px] font-mono text-white/20 uppercase mb-2">Energy Flux</p>
                        <p className="text-xs md:text-sm font-mono uppercase tracking-widest text-accent">{songExperience?.energyLevel || '---'}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[8px] font-mono text-white/20 uppercase">UI Atmosphere Directives</p>
                      <p className="text-[10px] font-mono opacity-50 uppercase tracking-[0.2em]">{songExperience?.uiNotes || 'SYSTEM_DEFAULT'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </footer>

      {/* Neural Assistant Chatbot */}
      <div className="fixed bottom-32 right-8 z-[150] flex flex-col items-end">
        <AnimatePresence>
          {isChatOpen && (
            <motion.div 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="mb-4 w-[320px] md:w-[380px] h-[450px] bg-surface/95 backdrop-blur-2xl border border-white/10 rounded-sm flex flex-col shadow-2xl overflow-hidden"
            >
              <div className="p-4 md:p-6 lg:p-8 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                  <span className="text-[10px] font-mono tracking-widest uppercase">Aura Assistant</span>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="text-white/30 hover:text-white p-2">
                   <Pause className="w-4 h-4 rotate-45" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {chatMessages.map((msg, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: msg.role === 'aura' ? -10 : 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex ${msg.role === 'aura' ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-[85%] p-3 rounded-sm text-[12px] leading-relaxed ${
                      msg.role === 'aura' 
                        ? 'bg-white/5 text-white/80 font-serif italic' 
                        : 'bg-accent/10 border border-accent/20 text-accent font-mono'
                    }`}>
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white/5 p-3 rounded-sm flex gap-1">
                      <div className="w-1 h-1 bg-white/40 rounded-full animate-bounce" />
                      <div className="w-1 h-1 bg-white/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="w-1 h-1 bg-white/40 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleChatSubmit} className="p-4 border-t border-white/10 bg-white/[0.02]">
                <div className="relative">
                  <input 
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Ask Aura something..."
                    className="w-full bg-transparent border-b border-white/20 pb-2 text-[12px] font-light placeholder:text-white/10 focus:outline-none focus:border-accent transition-colors"
                  />
                  <button type="submit" className="absolute right-0 bottom-2 text-accent">
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-all shadow-xl group border ${
            isChatOpen 
              ? 'bg-accent border-accent text-black rotate-90' 
              : 'bg-surface border-white/10 text-accent hover:border-accent'
          }`}
        >
          {isChatOpen ? <Pause className="w-6 h-6 fill-current" /> : <Sparkles className="w-6 h-6 animate-pulse group-hover:scale-110 transition-transform" />}
        </button>
      </div>
    </div>
  );
}

