import React from 'react';
import { motion } from 'motion/react';
import { 
  Play, 
  Pause, 
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  Music2,
  Activity
} from 'lucide-react';
import { usePlayer } from '../../core/PlayerContext';
import { AudioVisualizer } from './AudioVisualizer';

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
    buffered,
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

  const [hoverTime, setHoverTime] = React.useState<number | null>(null);
  const [hoverX, setHoverX] = React.useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (duration === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    setHoverTime(percentage * duration);
    setHoverX(x);
  };

  return (
    <div className="flex flex-col md:flex-row items-center justify-between w-full h-full px-6 lg:px-12 relative z-50 bg-base/80 backdrop-blur-3xl border-t border-white/5">
      {/* Precision Seek Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 md:h-1.5 z-[110]">
        <div 
          className="w-full h-full bg-white/[0.02] cursor-pointer relative group transition-all lg:hover:h-3"
          onClick={handleSeek}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverTime(null)}
        >
          {/* Buffered Progress */}
          <div 
            className="absolute inset-y-0 left-0 bg-white/5 transition-all duration-300"
            style={{ width: duration > 0 ? `${(buffered / duration) * 100}%` : "0%" }}
          />

          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }}
            transition={{ duration: 0.8, ease: "linear" }}
            className="h-full relative z-10 shadow-[0_0_15px_rgba(204,255,0,0.4)]"
            style={{ backgroundColor: 'var(--accent-color)' }}
          />

          {/* Precision Tooltip */}
          {hoverTime !== null && (
            <div 
              className="absolute -top-12 bg-black border border-white/10 px-3 py-1.5 rounded-lg text-[10px] font-mono text-accent pointer-events-none z-[120] shadow-2xl backdrop-blur-xl"
              style={{ left: hoverX, transform: 'translateX(-50%)' }}
            >
              <div className="flex items-center gap-2">
                <span className="opacity-40">SEEK</span>
                <span className="font-bold">{formatTime(hoverTime)}</span>
              </div>
            </div>
          )}
          
          {/* Handle */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-xl border-4 border-black"
            style={{ left: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%", transform: 'translate(-50%, -50%)' }}
          />
        </div>
      </div>

      {/* Track Info */}
      <div className="flex items-center gap-6 w-full md:w-auto mt-2 md:mt-0">
        <div className="flex flex-col">
          <h4 className="text-sm font-bold uppercase tracking-tight truncate max-w-[150px] md:max-w-[200px] lg:max-w-xs text-accent drop-shadow-[0_0_8px_rgba(204,255,0,0.1)]">{activeTrack?.title || 'Frequency Silent'}</h4>
          <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.2em] truncate">{activeTrack?.artist || 'Ready for Node'}</p>
        </div>
        <div className="flex items-center gap-3 font-mono text-[9px] text-accent/40 bg-accent/5 px-2 py-1 rounded border border-accent/10 tabular-nums">
          <span className="text-accent">{formatTime(currentTime)}</span>
          <span className="opacity-20">/</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-4 lg:gap-10">
        <div className="flex items-center gap-1 md:gap-3">
          <button 
            onClick={toggleShuffle}
            className={`p-2 transition-all hover:scale-110 ${isShuffled ? 'text-accent drop-shadow-[0_0_8px_rgba(204,255,0,0.5)]' : 'text-white/20 hover:text-white'}`}
            title="Shuffle"
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button 
            onClick={toggleRepeat}
            className={`p-2 transition-all hover:scale-110 relative ${repeatMode !== 'none' ? 'text-accent drop-shadow-[0_0_8px_rgba(204,255,0,0.5)]' : 'text-white/20 hover:text-white'}`}
            title="Repeat"
          >
            {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-3 lg:gap-6 bg-white/[0.02] border border-white/5 rounded-full p-1.5 px-6 shadow-inner glass-panel-saas">
          <button 
            onClick={playPrev}
            className="p-2 text-white/30 hover:text-white transition-all active:scale-90"
            aria-label="Previous"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>
          
          <button 
            onClick={togglePlay}
            disabled={!activeTrack}
            className="w-12 h-12 rounded-full bg-accent text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_25px_rgba(204,255,0,0.3)] disabled:opacity-20 disabled:grayscale"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-7 h-7 fill-current" /> : <Play className="w-7 h-7 fill-current ml-1" />}
          </button>

          <button 
            onClick={playNext}
            className="p-2 text-white/30 hover:text-white transition-all active:scale-90"
            aria-label="Next"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>

        {/* Visualizer Plate */}
        <div className="w-48 h-12 glass-panel-saas hidden xl:flex items-center justify-center relative overflow-hidden group rounded-xl border-white/5 bg-white/[0.01]">
          <div className="absolute inset-x-0 bottom-0">
             <AudioVisualizer />
          </div>
          <div className="absolute top-1 left-3 flex items-center gap-2 opacity-20 group-hover:opacity-100 transition-opacity">
            <Activity className="w-2.5 h-2.5 text-accent animate-pulse" />
            <span className="text-[7px] font-mono uppercase tracking-[0.4em]">Synaptic_Feed</span>
          </div>
        </div>
      </div>

      {/* Utilities */}
      <div className="flex items-center gap-6 w-full md:w-64 mb-4 md:mb-0">
        <button 
          onClick={() => setShowLyrics(!showLyrics)}
          className={`group flex items-center gap-3 p-2 transition-all ${showLyrics ? 'text-accent' : 'text-white/20 hover:text-white'}`}
        >
          <Music2 className="w-4 h-4" />
          <span className="text-[10px] font-mono font-bold tracking-widest hidden lg:block opacity-0 group-hover:opacity-100 transition-opacity uppercase">Lyrics</span>
        </button>

        <div className="flex-1 flex items-center gap-4 group/vol px-4 py-2 bg-white/[0.02] rounded-full border border-white/5 hover:border-white/10 transition-colors">
          <Volume2 className="w-4 h-4 text-white/20 group-hover/vol:text-accent transition-colors" />
          <div className="flex-1 h-1 bg-white/5 relative cursor-pointer">
            <div 
              className="absolute inset-y-0 left-0 bg-white/20 group-hover/vol:bg-accent transition-colors shadow-[0_0_8px_rgba(204,255,0,0.3)]"
              style={{ width: `${volume}%` }}
            />
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={volume} 
              onChange={(e) => setVolume(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover/vol:opacity-100 transition-opacity shadow-xl"
              style={{ left: `${volume}%`, transform: 'translate(-50%, -50%)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
