import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Play, 
  Pause, 
  History, 
  LogOut, 
  Sparkles,
  ChevronRight,
  Music2,
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
import { useSongExperience } from "./hooks/useSongExperience";
import { signIn } from "./services/firebase";
import { EditorialBg } from "./components/Layout/EditorialBg";
import { SectionLabel } from "./components/ui/SectionLabel";
import { PlaylistQueue } from "./components/Playlist/PlaylistQueue";
import { PlayerControls } from "./components/Player/PlayerControls";
import { MoodProtocol } from "./components/Sidebar/MoodProtocol";

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
  } = usePlayer();

  const { songExperience, isExpLoading } = useSongExperience(activeTrack);

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [history, setHistory] = useState<Playlist[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

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
      setQueue(latest.tracks);
    }
  }, [history, currentPlaylist, isLoading, setQueue]);

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
                
                <MoodProtocol 
                  input={input}
                  setInput={setInput}
                  isLoading={isLoading}
                  handleGenerate={(e) => { handleGenerate(e); setShowSidebar(false); }}
                  currentPlaylist={currentPlaylist}
                />
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

          <PlaylistQueue 
            isLoading={isLoading}
            isExpLoading={isExpLoading}
            songExperience={songExperience}
          />
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

      {/* Neural Assistant Integration */}
      <AuraAssistant isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      
      <div className="fixed bottom-32 right-8 z-[150] flex flex-col items-end">
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

