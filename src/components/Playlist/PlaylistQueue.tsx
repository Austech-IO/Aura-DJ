import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music2 } from 'lucide-react';
import { Track, SongExperience } from '../../types';
import { usePlayer } from '../../core/PlayerContext';
import { SectionLabel } from '../ui/SectionLabel';

interface PlaylistQueueProps {
  isLoading: boolean;
  isExpLoading: boolean;
  songExperience: SongExperience | null;
}

export const PlaylistQueue: React.FC<PlaylistQueueProps> = ({ 
  isLoading, 
  isExpLoading, 
  songExperience 
}) => {
  const { queue, activeTrack, playTrack, isPlaying } = usePlayer();

  if (!queue.length && !isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-20 grayscale opacity-20 col-span-full">
        <Music2 className="w-24 h-24 mb-6 stroke-1 animate-pulse" />
        <p className="text-xs font-mono uppercase tracking-[0.4em]">Initialize Neural Connection</p>
        <p className="text-[10px] mt-4 opacity-50">Describe your vibe in the mood protocol to generate audio landscapes.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
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
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 lg:gap-12 relative z-10 w-full">
      <div className="grid gap-px bg-white/5 border border-white/5 overflow-hidden h-fit">
        {queue.map((track, i) => (
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

      <div className="space-y-12">
        {activeTrack && (
          <div className="space-y-12">
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
      </div>
    </div>
  );
};
