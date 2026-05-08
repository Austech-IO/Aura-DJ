import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { usePlayer } from '../../core/PlayerContext';

export const AudioVisualizer: React.FC = () => {
  const { isPlaying, currentTime, activeTrack } = usePlayer();
  const containerRef = useRef<HTMLDivElement>(null);

  // We'll create a set of bars that pulse based on "synaptic" values
  // Since we don't have raw audio data from YouTube due to iframe restrictions,
  // we simulate the intensity using the current time and track characteristics.
  
  const barCount = 40;
  const bars = Array.from({ length: barCount });

  return (
    <div 
      ref={containerRef}
      className="flex items-end justify-center gap-1 h-32 w-full max-w-md mx-auto overflow-hidden px-4"
    >
      {bars.map((_, i) => {
        // Create a pseudo-random intensity based on index and time
        const delay = i * 0.05;
        const baseHeight = 10 + Math.sin(i * 0.5) * 5;
        
        return (
          <motion.div
            key={i}
            initial={{ height: '10%' }}
            animate={isPlaying ? {
              height: [
                `${baseHeight}%`,
                `${Math.min(100, baseHeight + Math.random() * 80)}%`,
                `${baseHeight}%`
              ],
              opacity: [0.3, 1, 0.3],
            } : {
              height: '10%',
              opacity: 0.1
            }}
            transition={{
              repeat: Infinity,
              duration: 0.4 + Math.random() * 0.6,
              delay: delay,
              ease: "easeInOut"
            }}
            className="w-1 md:w-1.5 bg-accent rounded-full shadow-[0_0_15px_rgba(204,255,0,0.3)]"
          />
        );
      })}
    </div>
  );
};
