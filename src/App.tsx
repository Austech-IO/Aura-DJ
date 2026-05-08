import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  Play, 
  Pause, 
  History, 
  LogOut, 
  Sparkles,
  ChevronRight,
  Music2,
  X,
} from "lucide-react";
import { auth, db, logout, handleFirestoreError, OperationType } from "./services/firebase";
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
  getDocs,
  writeBatch
} from "firebase/firestore";
import { generatePlaylist, PlaylistData } from "./services/gemini";
import { Playlist, Track } from "./types";
import { usePlayer } from "./core/PlayerContext";
import { YouTubePlayer } from "./components/Player/YouTubePlayer";
import { AuraAssistant } from "./components/Chat/AuraAssistant";
import { LyricsOverlay } from "./components/Player/LyricsOverlay";
import { useSongExperience } from "./hooks/useSongExperience";
import { useAuraChat } from "./hooks/useAuraChat";
import { signIn } from "./services/firebase";
import { EditorialBg } from "./components/Layout/EditorialBg";
import { SectionLabel } from "./components/ui/SectionLabel";
import { PlaylistQueue } from "./components/Playlist/PlaylistQueue";
import { PlayerControls } from "./components/Player/PlayerControls";
import { MoodProtocol } from "./components/Sidebar/MoodProtocol";
import { ProfilePage } from "./components/Profile/ProfilePage";
import { AuraSession } from "./services/session";
import { useAuraSuggestions } from "./hooks/useAuraSuggestions";
import { SuggestionChip } from "./components/Chat/SuggestionChip";
import { UndoToast } from "./components/Chat/UndoToast";

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

// --- Main App ---

export default function App() {
  const { 
    activeTrack, 
    isPlaying, 
    playTrack,
    setQueue,
    queue: playlistQueue,
    currentIndex,
    undo,
    showUndoToast,
    setShowUndoToast
  } = usePlayer();

  const { songExperience, isExpLoading } = useSongExperience(activeTrack);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [showSidebar, setShowSidebar] = useState(isDesktop);
  const auraChat = useAuraChat();
  const { suggestion, clearSuggestion } = useAuraSuggestions(activeTrack, showSidebar);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [history, setHistory] = useState<Playlist[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'mood' | 'aura'>('mood');
  const [activeView, setActiveView] = useState<'player' | 'profile'>('player');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });

    // Load Spotify SDK
    if (!document.getElementById('spotify-player-sdk')) {
      const script = document.createElement('script');
      script.id = 'spotify-player-sdk';
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onerror = (e) => console.warn("Spotify SDK load potential issue (non-fatal):", e);
      document.body.appendChild(script);
    }

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
      setQueue(latest.tracks);
      if (latest.tracks.length > 0) {
        playTrack(latest.tracks[0]);
      }
    }
  }, [history, currentPlaylist, isLoading, setQueue, playTrack]);

  const clearHistory = async () => {
    if (!user || !confirm("Clear all session history?")) return;
    try {
      const q = query(collection(db, "playlists"), where("userId", "==", user.uid));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      setCurrentPlaylist(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "playlists");
    }
  };

  const handleGenerate = async (e?: React.FormEvent, forcedInput?: string) => {
    if (e) e.preventDefault();
    const targetInput = forcedInput || input;
    if (!targetInput.trim() || !user || isLoading) return;

    setIsLoading(true);
    setCurrentPlaylist(null); // Clear while generating
    setSidebarTab('mood'); // Switch to mood tab to show generation progress if applicable

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
        thumbnailHint: p.thumbnail_hint,
        bpm: p.bpm,
        energy: p.energy
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
      setQueue(tracks);
      playTrack(tracks[0], { replaceQueue: true });
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

  useEffect(() => {
    if (activeTrack) {
      AuraSession.logTrack({
        title: activeTrack.title,
        artist: activeTrack.artist,
        bpm: activeTrack.bpm || 110,
        energy: activeTrack.energy || 6
      });
    }
  }, [activeTrack]);

  const handleAcceptSuggestion = () => {
    if (suggestion) {
      setSidebarTab('aura');
      setShowSidebar(true);
      auraChat.setInput(suggestion);
      clearSuggestion();
    }
  };

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
      
      <LyricsOverlay 
        isOpen={showLyrics} 
        onClose={() => setShowLyrics(false)} 
        track={activeTrack}
      />
      
      {/* Header Navigation */}
      <header className="h-16 lg:h-20 border-b border-white/5 flex items-center justify-between px-6 lg:px-12 bg-base/80 backdrop-blur-3xl shrink-0 relative z-[70]">
        <div className="flex items-center gap-6 md:gap-10">
          <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className="flex items-center gap-3 group"
          >
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-all shadow-[0_0_20px_rgba(204,255,0,0.1)] group-hover:shadow-[0_0_25px_rgba(204,255,0,0.3)] ${showSidebar ? 'bg-accent rotate-0' : 'bg-surface border border-white/10 group-hover:bg-white/5'}`}>
              <Sparkles className={`w-4 h-4 md:w-5 md:h-5 transition-colors ${showSidebar ? 'text-black' : 'text-accent'}`} />
            </div>
            <div className="flex flex-col text-left">
              <h1 className="text-sm md:text-base font-bold tracking-tight uppercase leading-none">Aura DJ</h1>
              <span className={`text-[8px] font-mono uppercase tracking-[0.3em] mt-1 transition-opacity ${showSidebar ? 'text-accent opacity-100' : 'text-white/40 opacity-60'}`}>Neural_Synapse_{showSidebar ? 'Open' : 'Link'}</span>
            </div>
          </button>
          
          <nav className="hidden lg:flex items-center gap-8 border-l border-white/10 pl-10 h-8">
            <button className="text-[10px] font-mono tracking-[0.3em] uppercase text-accent border-b border-accent pb-1">Session</button>
            <button 
              onClick={() => setShowHistory(!showHistory)}
              className={`text-[10px] font-mono tracking-[0.3em] uppercase transition-colors hover:text-white ${showHistory ? 'text-accent' : 'text-white/40'}`}
            >
              History
            </button>
            <button className="text-[10px] font-mono tracking-[0.3em] uppercase text-white/20 hover:text-white transition-colors">Neural</button>
          </nav>
        </div>

        <div className="flex items-center gap-4 md:gap-8">
          <button 
            onClick={() => setShowLyrics(true)}
            className="group flex items-center gap-3"
          >
            <span className="hidden xl:inline text-[9px] font-mono text-white/30 uppercase tracking-[0.2em] group-hover:text-accent transition-colors">Lyrics Protocol</span>
            <div className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center group-hover:border-accent group-hover:bg-accent/5 transition-all">
              <Music2 className="w-4 h-4 text-white/40 group-hover:text-accent" />
            </div>
          </button>

          <div className="h-10 w-px bg-white/5 mx-2 hidden md:block"></div>

          <div className="flex items-center gap-4 group bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-full pl-4 pr-1 py-1 transition-all">
            <button 
              onClick={() => setActiveView('profile')}
              className="text-right hidden sm:block text-left"
            >
              <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/90 truncate max-w-[100px]">{user.email?.split('@')[0]}</p>
              <p className="text-[8px] font-mono text-accent/50 uppercase tracking-tighter mt-0.5">Status: Authorized</p>
            </button>
            <button 
              onClick={() => setActiveView('profile')}
              className="w-9 h-9 rounded-full border-2 border-white/10 overflow-hidden ring-2 ring-black group-hover:border-accent transition-all shrink-0"
            >
              <img src={user.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.email}`} alt="Avatar" className="w-full h-full object-cover" />
            </button>
            <button 
              onClick={logout}
              className="p-2 text-white/10 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {/* Main Stage: Playlist View */}
        <section 
          className="flex-1 lg:p-12 p-6 flex flex-col overflow-y-auto scrollbar-hide relative bg-base/20 transition-all"
        >
          {activeView === 'profile' ? (
            <ProfilePage 
              user={user}
              history={history}
              onPlayTrack={playTrack}
              onBack={() => setActiveView('player')}
            />
          ) : (
            <>
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
                    {String(currentIndex + 1).padStart(2, '0')}
                    <span className="text-sm text-white/20">/{playlistQueue.length.toString().padStart(2, '0') || '10'}</span>
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mt-2">Active Signal</p>
                </div>
              </div>
            )}
          </div>

          <PlaylistQueue 
            isLoading={isLoading}
            isExpLoading={isExpLoading}
            songExperience={songExperience}
          />
            </>
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
        
        <PlayerControls 
          showLyrics={showLyrics}
          setShowLyrics={setShowLyrics}
        />
        
        <YouTubePlayer />
    </footer>

    {/* Floating Aura Overlay */}
    <SuggestionChip 
      text={suggestion}
      onDismiss={clearSuggestion}
      onAccept={handleAcceptSuggestion}
      corner={localStorage.getItem('aura_overlay_corner') || 'bottom-right'}
    />
    <UndoToast 
      show={showUndoToast}
      onUndo={undo}
      onDismiss={() => setShowUndoToast(false)}
    />
    <AuraAssistant 
      isOpen={showSidebar} 
      onClose={() => setShowSidebar(prev => !prev)} 
      {...auraChat}
      activeTab={sidebarTab}
    >
      {/* 
        This is passed as a named slot or child if I update AuraAssistant to handle tabs 
        For now I will render MoodProtocol internally in AuraAssistant or pass it here.
      */}
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex border-b border-white/5 shrink-0 bg-white/[0.02]">
          <button 
            onClick={() => setSidebarTab('mood')}
            className={`flex-1 py-3 text-[9px] font-mono tracking-[0.2em] uppercase transition-all relative ${sidebarTab === 'mood' ? 'text-accent' : 'text-white/20 hover:text-white/40'}`}
          >
            Generation
            {sidebarTab === 'mood' && <motion.div layoutId="overlay-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
          </button>
          <button 
            onClick={() => setSidebarTab('aura')}
            className={`flex-1 py-3 text-[9px] font-mono tracking-[0.2em] uppercase transition-all relative ${sidebarTab === 'aura' ? 'text-accent' : 'text-white/20 hover:text-white/40'}`}
          >
            Neural AI
            {sidebarTab === 'aura' && <motion.div layoutId="overlay-tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
           {sidebarTab === 'mood' ? (
             <MoodProtocol 
               input={input}
               setInput={setInput}
               isLoading={isLoading}
               handleGenerate={(e) => handleGenerate(e)}
               currentPlaylist={currentPlaylist}
             />
           ) : null}
        </div>
      </div>
    </AuraAssistant>
  </div>
);
}

