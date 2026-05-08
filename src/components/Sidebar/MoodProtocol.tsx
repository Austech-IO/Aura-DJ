import React, { useState } from 'react';
import { Sparkles, Search, Plus, Music } from 'lucide-react';
import { SectionLabel } from '../ui/SectionLabel';
import { Playlist, Track } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { usePlayer } from '../../core/PlayerContext';

interface MoodProtocolProps {
  input: string;
  setInput: (val: string) => void;
  isLoading: boolean;
  handleGenerate: (e?: React.FormEvent, forcedInput?: string) => void;
  currentPlaylist: Playlist | null;
}

export const MoodProtocol: React.FC<MoodProtocolProps> = ({ 
  input, 
  setInput, 
  isLoading, 
  handleGenerate,
  currentPlaylist
}) => {
  const { addTrackToQueue } = usePlayer();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Track[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      
      const tracks: Track[] = data.map((item: any) => ({
        title: item.title,
        artist: item.artist || "Unknown Artist",
        album: "Search Result",
        genre: "Various",
        duration: "3:30",
        year: new Date().getFullYear().toString(),
        searchQuery: item.title + " " + (item.artist || ""),
        youtubeId: item.id?.videoId || item.id
      }));
      setSearchResults(tracks);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };
  return (
    <div className="space-y-12">
      <section>
        <SectionLabel className="hidden lg:block">Mood Protocol</SectionLabel>
        <div className="relative group">
          <form onSubmit={(e) => { e.preventDefault(); handleGenerate(e); }}>
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
              onClick={() => { 
                setInput(tag);
                handleGenerate(undefined, tag);
              }}
              className="text-[9px] font-mono text-left uppercase tracking-wider text-white/30 p-2 border border-white/5 hover:border-accent/30 hover:text-accent transition-all"
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <SectionLabel>Augment Queue</SectionLabel>
        <div className="relative group">
          <form onSubmit={handleSearch} className="relative">
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search global frequencies..."
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs font-medium placeholder:text-white/10 focus:outline-none focus:border-accent/40 focus:bg-white/[0.05] transition-all"
            />
            <button 
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-accent transition-colors disabled:opacity-30"
            >
              {isSearching ? (
                <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </button>
          </form>
        </div>

        <div className="space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
          <AnimatePresence mode="popLayout">
            {searchResults.map((track, i) => (
              <motion.div 
                key={track.youtubeId + i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.03] border border-transparent hover:border-white/5 transition-all group/item"
              >
                <div className="flex-1 truncate pr-4">
                  <p className="text-[11px] font-bold truncate uppercase tracking-tight text-accent/90 group-hover/item:text-accent transition-colors">{track.title}</p>
                  <p className="text-[9px] font-mono opacity-30 truncate uppercase mt-0.5">{track.artist}</p>
                </div>
                <button 
                  onClick={() => {
                    addTrackToQueue(track);
                    setSearchResults(prev => prev.filter(t => t.youtubeId !== track.youtubeId));
                  }}
                  className="w-8 h-8 rounded-lg bg-accent/5 border border-accent/10 flex items-center justify-center text-accent opacity-0 group-hover/item:opacity-100 hover:bg-accent hover:text-black transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {searchResults.length === 0 && !isSearching && searchQuery && (
             <div className="text-center py-12 border border-dashed border-white/5 rounded-xl">
               <Music className="w-8 h-8 text-white/5 mx-auto mb-3" />
               <p className="text-[10px] font-mono text-white/10 uppercase tracking-widest">Awaiting Command</p>
             </div>
          )}
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
  );
};
