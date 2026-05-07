import React from 'react';
import { motion } from 'framer-motion';
import { 
  Play, 
  Pause, 
  ChevronRight, 
  TrendingUp, 
  ListMusic, 
  Volume2 
} from 'lucide-react';
import { usePlayer } from '../../core/PlayerContext';

interface PlayerControlsProps {
  showLyrics: boolean;
  setShowLyrics: (show: boolean) => void;
}

export const PlayerControls: React.FC<PlayerControlsProps> = ({ showLyrics, setShowLyrics }) => {
  const { 
    activeTrack, 
    isPlaying, 
    currentTime, 
    duration, 
    volume, 
    repeatMode, 
    isShuffled,
    togglePlay,
    playNext,
    playPrev,
    setVolume,
    seekTo,
    toggleShuffle,
    toggleRepeat
  } = usePlayer();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const seekTime = percentage * duration;
    seekTo(seekTime);
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4 md:gap-0 relative z-50 h-full">
      {/* Track Progress */}
      <div className="absolute top-0 left-0 right-0 z-[110] -translate-y-full md:translate-y-0">
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

      {/* Visualizer Plate */}
      <div className="w-48 h-12 bg-white/5 border border-white/5 hidden md:flex items-center justify-center relative overflow-hidden">
        <div className="flex gap-1 items-end h-6 relative z-10">
          {[0.8, 0.4, 0.7, 0.9, 0.5, 0.6, 0.3, 0.7, 0.8].map((v, i) => (
            <motion.div 
              key={i}
              animate={{ height: activeTrack && isPlaying ? [v * 100 + "%", (1 - v) * 100 + "%", v * 100 + "%"] : v * 24 }}
              transition={{ repeat: Infinity, duration: 0.5 + i * 0.1 }}
              className="w-1" 
              style={{ backgroundColor: 'var(--accent-color)' }}
            />
          ))}
        </div>
      </div>

      {/* Controls Container */}
      <div className="flex items-center justify-between w-full md:w-auto md:gap-12">
        <div className="flex items-center gap-2 md:gap-8">
           <div className="flex items-center gap-1 md:gap-3 pr-2 md:pr-4 border-r border-white/5">
              <button 
                onClick={toggleShuffle}
                className={`p-2 transition-colors ${isShuffled ? 'text-accent' : 'text-white/20 hover:text-white'}`}
              >
                 <motion.div animate={isShuffled ? { rotate: [0, 10, -10, 0] } : {}}>
                   <TrendingUp className="w-4 h-4" />
                 </motion.div>
              </button>
              <button 
                onClick={toggleRepeat}
                className={`p-2 transition-colors flex items-center relative ${repeatMode !== 'none' ? 'text-accent' : 'text-white/20 hover:text-white'}`}
              >
                 <ListMusic className="w-4 h-4" />
                 {repeatMode === 'one' && <span className="absolute top-0 right-0 text-[8px] font-bold">1</span>}
              </button>
           </div>

           <div className="flex items-center gap-2 md:gap-4 ml-2">
             <button onClick={playPrev} className="p-2 text-white/30 hover:text-white transition-colors">
                <ChevronRight className="w-4 h-4 rotate-180 fill-current" />
             </button>
             <button 
                onClick={togglePlay}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/20 flex items-center justify-center hover:text-black transition-all"
                onMouseEnter={(e) => { if(window.innerWidth > 768) e.currentTarget.style.backgroundColor = 'var(--accent-color)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
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
                onChange={(e) => setVolume(parseInt(e.target.value))}
                className="w-20 md:w-32 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-accent"
              />
           </div>
        </div>
      </div>
    </div>
  );
};
