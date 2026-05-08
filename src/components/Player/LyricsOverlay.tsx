import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Music } from 'lucide-react';
import { Track } from '../../types';

interface LyricsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
}

export const LyricsOverlay: React.FC<LyricsOverlayProps> = ({ isOpen, onClose, track }) => {
  const [lyrics, setLyrics] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && track) {
      fetchLyrics(track.artist, track.title);
    }
  }, [isOpen, track]);

  const fetchLyrics = async (artist: string, title: string) => {
    setLoading(true);
    setLyrics("");
    try {
      // Using a public proxy-less API if possible, otherwise use a simulated/cached approach
      // lyrics.ovh is quite reliable for most popular tracks
      const res = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
      const data = await res.json();
      if (data.lyrics) {
        setLyrics(data.lyrics);
      } else {
        setLyrics("Neural link established but lyrics not found in archives.");
      }
    } catch (e) {
      setLyrics("Signal loss. Unable to retrieve lyrics from the network.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(40px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          className="fixed inset-0 z-[130] bg-black/60 flex items-center justify-center p-4 md:p-12 overflow-hidden"
        >
          <motion.div 
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            className="w-full max-w-4xl h-full flex flex-col bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden relative"
          >
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight uppercase">{track?.title || 'Unknown Frequency'}</h2>
                <p className="text-sm font-mono text-accent uppercase tracking-widest mt-1">{track?.artist}</p>
              </div>
              <button 
                onClick={onClose}
                className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
                aria-label="Close Lyrics"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 md:p-16 custom-scrollbar scroll-smooth">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center grayscale opacity-30 gap-6">
                  <Music className="w-16 h-16 animate-bounce" />
                  <p className="text-xs font-mono uppercase tracking-[0.4em] text-accent">Decoding Lyrics...</p>
                </div>
              ) : (
                <div className="max-w-2xl mx-auto space-y-8">
                  {lyrics.split('\n').map((line, i) => (
                    <motion.p 
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.01 }}
                      className={`text-2xl md:text-3xl font-serif italic leading-relaxed ${
                        line.trim() === "" ? "h-8" : "text-white/80 hover:text-white transition-colors cursor-default"
                      }`}
                    >
                      {line}
                    </motion.p>
                  ))}
                </div>
              )}
            </div>

            {/* Background Accent */}
            <div className="absolute bottom-0 right-0 p-12 opacity-5 pointer-events-none">
              <Music className="w-64 h-64 rotate-12" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
