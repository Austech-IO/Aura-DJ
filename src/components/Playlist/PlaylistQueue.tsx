import React from 'react';
import { motion, AnimatePresence, Reorder } from 'motion/react';
import { Music2, Trash2, GripVertical, Download, Lock, PlusCircle } from 'lucide-react';
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
  const { 
    queue, 
    currentIndex, 
    playTrack, 
    setQueue, 
    removeTrack, 
    pinnedIds, 
    togglePinTrack, 
    downloadedIds, 
    toggleDownloadTrack,
    insertNext
  } = usePlayer();

  const activeTrack = currentIndex >= 0 ? queue[currentIndex] : null;
  const upcomingTracks = queue.slice(currentIndex + 1);
  const previousTracks = queue.slice(0, currentIndex);

  const [recentlyInserted, setRecentlyInserted] = React.useState<string[]>([]);

  const prevQueueIds = React.useRef<string[]>([]);
  React.useEffect(() => {
    const currentIds = queue.map(t => t.searchQuery);
    const newItems = currentIds.filter(id => !prevQueueIds.current.includes(id));
    
    if (newItems.length > 0) {
      setRecentlyInserted(prev => [...prev, ...newItems]);
      setTimeout(() => {
        setRecentlyInserted(prev => prev.filter(id => !newItems.includes(id)));
      }, 3000);
    }
    
    prevQueueIds.current = currentIds;
  }, [queue]);

  const handleReorder = (newOrder: Track[]) => {
    setQueue(newOrder);
  };

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 relative z-10 w-full px-4 lg:px-12 py-12">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <SectionLabel>Signal Pipeline</SectionLabel>
          <div className="flex items-center gap-4">
            <span className="text-[10px] font-mono text-white/20 uppercase tracking-[0.2em]">{queue.length} Tracks</span>
          </div>
        </div>
        
        <div className="space-y-12">
          {/* Currently Playing */}
          {activeTrack && (
            <div className="space-y-4">
              <p className="text-[9px] font-mono text-accent uppercase tracking-[0.3em] flex items-center gap-2">
                <span className="w-1 h-1 bg-accent animate-pulse rounded-full" />
                Active Transmission
              </p>
              <div className="glass-saas border-accent/20 bg-accent/[0.03] p-5 rounded-2xl flex items-center group relative overflow-hidden">
                <div className="flex-1 min-w-0">
                  <h3 className="text-2xl font-bold tracking-tight uppercase truncate text-accent shadow-[0_0_20px_rgba(204,255,0,0.1)]">
                    {activeTrack.title}
                  </h3>
                  <p className="text-xs font-mono text-accent/60 uppercase tracking-widest mt-1">
                    {activeTrack.artist}
                  </p>
                </div>
                <div className="flex items-center gap-8">
                   <div className="text-right">
                     <p className="text-[9px] font-mono text-white/20 uppercase">Duration</p>
                     <p className="text-sm font-mono text-white/60">{activeTrack.duration}</p>
                   </div>
                   <div className="h-10 w-px bg-white/10" />
                   <div className="text-right">
                     <p className="text-[9px] font-mono text-white/20 uppercase">Index</p>
                     <p className="text-sm font-mono text-white/60">#{(currentIndex + 1).toString().padStart(2, '0')}</p>
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* Up Next */}
          <div className="space-y-4">
            <p className="text-[9px] font-mono text-white/20 uppercase tracking-[0.3em]">Neural Queue // Distribution</p>
            <div className="glass-saas rounded-2xl overflow-hidden border border-white/5 backdrop-blur-3xl shadow-2xl">
              <Reorder.Group 
                axis="y" 
                values={queue} 
                onReorder={(n) => setQueue(n)}
                className="divide-y divide-white/[0.03]"
              >
                {queue.map((track, i) => {
                  const isPlaying = i === currentIndex;
                  
                  return (
                    <Reorder.Item 
                      key={track.searchQuery + i} 
                      value={track}
                      layout
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className={`group flex items-center p-3 md:p-5 transition-all cursor-pointer select-none relative ${
                        isPlaying 
                          ? 'bg-accent/10 border-l-2 border-accent' 
                          : recentlyInserted.includes(track.searchQuery)
                            ? 'border-l-2 border-accent'
                            : 'hover:bg-white/[0.03]'
                      }`}
                    >
                      <div className="flex items-center gap-3 w-10 shrink-0">
                        <GripVertical className={`w-3 h-3 opacity-0 group-hover:opacity-10 shadow-sm transition-opacity cursor-grab active:cursor-grabbing ${isPlaying ? 'text-accent' : 'text-white'}`} />
                        <span className={`font-mono text-[10px] ${isPlaying ? 'text-accent font-bold' : 'text-white/20'}`}>
                          {String(i + 1).padStart(2, '0')}
                        </span>
                      </div>

                      <div 
                        className="flex-1 min-w-0 px-4"
                        onClick={() => playTrack(track, { index: i })}
                      >
                        <h3 className={`text-sm md:text-base font-bold tracking-tight uppercase truncate transition-colors ${isPlaying ? 'text-accent shadow-accent/20 blur-[0.2px]' : 'text-accent/90 group-hover:text-accent'}`}>
                          {track.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-1">
                          <p className={`text-[10px] uppercase font-mono tracking-widest truncate ${isPlaying ? 'text-accent/60' : 'text-white/30'}`}>
                            {track.artist}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 md:gap-4 ml-4">
                        {!isPlaying && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              insertNext(track);
                            }}
                            className="p-2 rounded-full text-white/10 hover:text-accent opacity-0 group-hover:opacity-100 transition-all flex items-center gap-2"
                            title="Play Next"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDownloadTrack(track);
                          }}
                          className={`p-2 rounded-full transition-all flex items-center gap-2 ${
                            downloadedIds.includes(track.searchQuery)
                              ? 'text-blue-400 opacity-100 group-hover:scale-110'
                              : 'text-white/10 hover:text-white opacity-0 group-hover:opacity-100'
                          } ${isPlaying ? 'text-accent/40' : ''}`}
                        >
                           <Download className={`w-3.5 h-3.5 ${downloadedIds.includes(track.searchQuery) ? 'fill-current' : ''}`} />
                        </button>

                        <div className={`text-[10px] font-mono tracking-widest tabular-nums ${isPlaying ? 'text-accent' : 'text-white/40'}`}>
                          {track.duration}
                        </div>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTrack(i);
                          }}
                          className={`p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/10 ${isPlaying ? 'text-accent/40' : 'text-white/10 hover:text-red-400'}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {isPlaying && (
                        <motion.div 
                          layoutId="playing-pulse"
                          className="absolute inset-0 bg-accent/[0.02] pointer-events-none"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        />
                      )}
                    </Reorder.Item>
                  );
                })}
              </Reorder.Group>
            </div>
          </div>
        </div>
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
