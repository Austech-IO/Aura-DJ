import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Pause, Send } from 'lucide-react';
import { usePlayer } from '../../core/PlayerContext';
import { generateDJResponse } from '../../services/gemini';
import { Track } from '../../types';

interface Message {
  role: 'user' | 'aura';
  text: string;
}

export const AuraAssistant: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { playTrack, setQueue, setDjConfig, setNextTrack } = usePlayer();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'aura', text: "Neural connection established. How can I tune your frequency today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input;
    setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const aiResponse = await generateDJResponse(userMsg);
      
      if (aiResponse.message) {
        setMessages(prev => [...prev, { role: 'aura', text: aiResponse.message || '' }]);
      }

      if (aiResponse.dj_mode === "active") {
        setDjConfig(aiResponse.transition);

        const currentTrack: Track = {
          title: aiResponse.current_song.title,
          artist: aiResponse.current_song.artist,
          searchQuery: aiResponse.current_song.search_query,
          album: "AI Stream",
          genre: aiResponse.mood || "Dynamic",
          duration: "3:30",
          year: new Date().getFullYear().toString(),
        };

        const queueTracks: Track[] = aiResponse.queue.map(s => ({
          title: s.title,
          artist: s.artist,
          searchQuery: s.search_query,
          album: "AI Queue",
          genre: aiResponse.mood || "Dynamic",
          duration: "3:30",
          year: new Date().getFullYear().toString(),
        }));

        setQueue([currentTrack, ...queueTracks]);
        playTrack(currentTrack, { replaceQueue: true });
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'aura', text: "Signal interference detected. Please retry." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-32 right-8 w-[320px] md:w-[380px] h-[450px] bg-surface/95 backdrop-blur-2xl border border-white/10 rounded-sm flex flex-col shadow-2xl overflow-hidden z-[150]"
        >
          <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-[10px] font-mono tracking-widest uppercase text-white/60">Aura Assistant</span>
            </div>
            <button onClick={onClose} className="text-white/30 hover:text-white p-2">
               <Pause className="w-4 h-4 rotate-45" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-sm text-[11px] leading-relaxed font-mono ${
                  m.role === 'user' 
                    ? 'bg-accent text-black ml-4' 
                    : 'bg-white/5 text-white/70 mr-4'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/5 p-3 rounded-sm flex gap-1">
                  <div className="w-1 h-1 bg-accent/50 rounded-full animate-bounce" />
                  <div className="w-1 h-1 bg-accent/50 rounded-full animate-bounce delay-75" />
                  <div className="w-1 h-1 bg-accent/50 rounded-full animate-bounce delay-150" />
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 bg-white/[0.01]">
            <div className="relative">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message Aura..."
                className="w-full bg-white/5 border border-white/5 rounded-sm py-3 px-4 text-[11px] font-mono focus:outline-none focus:border-accent/30 transition-all pr-12"
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-accent disabled:opacity-20 p-2"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
