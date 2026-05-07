import React from 'react';
import { Sparkles } from 'lucide-react';
import { SectionLabel } from '../ui/SectionLabel';
import { Playlist } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';

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
  );
};
