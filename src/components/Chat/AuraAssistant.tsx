import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { Sparkles, X, Send, Command, Zap, Cloud, Music, Dice5, Volume2, Maximize2, Minimize2, GripHorizontal } from 'lucide-react';
import { usePlayer } from '../../core/PlayerContext';
import { generateDJResponse } from '../../services/gemini';
import { Track } from '../../types';
import { Message } from '../../hooks/useAuraChat';

const INITIAL_QUICK_ACTIONS = [
  { label: "Surprise me", icon: Zap, prompt: "Surprise me with a fresh vibe" },
  { label: "Calm focus", icon: Cloud, prompt: "I need some calm music to focus" },
  { label: "Cyberpunk night", icon: Command, prompt: "Give me some high energy cyberpunk vibes for a night drive" },
];

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export const AuraAssistant: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void;
  messages: Message[];
  input: string;
  setInput: (val: string) => void;
  isLoading: boolean;
  sendMessage: (forcedInput?: string) => Promise<void>;
  children?: React.ReactNode;
  activeTab?: 'mood' | 'aura';
}> = ({ 
  isOpen, 
  onClose, 
  messages,
  input,
  setInput,
  isLoading,
  sendMessage,
  children,
  activeTab = 'aura'
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const { activeTrack } = usePlayer();
  
  const [corner, setCorner] = useState<Corner>(() => {
    return (localStorage.getItem('aura_overlay_corner') as Corner) || 'bottom-right';
  });
  const [isMobile, setIsMobile] = useState(false);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 600);
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Corner style generator
  const containerStyles = useMemo(() => {
    if (isMobile) return { 
      bottom: '120px', 
      left: '16px', 
      right: '16px',
      width: 'auto'
    };
    
    const offset = '24px';
    const playerHeight = '96px';
    const styles: any = { 
      position: 'fixed', 
      zIndex: 110,
      width: '340px'
    };

    if (corner.includes('top')) {
      styles.top = offset;
    } else {
      styles.bottom = `calc(${offset} + ${playerHeight} + 24px)`;
    }

    if (corner.includes('left')) {
      styles.left = offset;
    } else {
      styles.right = offset;
    }

    return styles;
  }, [corner, isMobile]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isOpen, activeTab]);

  const handleDragEnd = (_e: any, info: any) => {
    if (isMobile) return;
    
    // Nearest corner logic
    const { x, y } = info.point;
    const midX = window.innerWidth / 2;
    const midY = window.innerHeight / 2;

    let newCorner: Corner = 'bottom-right';
    if (x < midX && y < midY) newCorner = 'top-left';
    else if (x >= midX && y < midY) newCorner = 'top-right';
    else if (x < midX && y >= midY) newCorner = 'bottom-left';
    else newCorner = 'bottom-right';

    setCorner(newCorner);
    localStorage.setItem('aura_overlay_corner', newCorner);
  };

  const handleSubmit = async (e?: React.FormEvent, forcedInput?: string) => {
    if (e) e.preventDefault();
    await sendMessage(forcedInput);
  };

  const getSuggestedPrompts = () => {
    if (!activeTrack) return INITIAL_QUICK_ACTIONS;
    return [
      { label: `More like ${activeTrack.artist}`, icon: Music, prompt: `Play more tracks similar to ${activeTrack.title} by ${activeTrack.artist}` },
      { label: "Switch the mood", icon: Dice5, prompt: "The energy is good, but let's try a different genre. Surprise me!" },
      { label: "Deep dive", icon: Volume2, prompt: `Tell me about the production and vibe of ${activeTrack.title}.` },
    ];
  };

  const ChatContent = () => (
    <>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar"
      >
        {messages.length < 2 && (
          <div className="space-y-3 mb-8">
            <p className="text-[8px] font-mono uppercase tracking-[0.3em] text-white/10 text-center">Initial Protocols</p>
            <div className="space-y-2">
              {INITIAL_QUICK_ACTIONS.map((action, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSubmit(undefined, action.prompt)}
                  className="w-full flex items-center justify-between gap-3 bg-white/[0.02] border border-white/5 hover:border-accent/40 hover:bg-accent/[0.02] p-3 rounded-xl text-[9px] font-mono text-white/40 hover:text-accent transition-all group/btn"
                >
                  <div className="flex items-center gap-3">
                    <action.icon className="w-4 h-4 opacity-40 group-hover/btn:opacity-100" />
                    <span className="uppercase tracking-widest leading-none">{action.label}</span>
                  </div>
                  <Command className="w-3 h-3 opacity-10 group-hover/btn:opacity-60" />
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className={`max-w-[90%] p-4 rounded-2xl text-[11px] leading-relaxed tracking-tight ${
              m.role === 'user' 
                ? 'bg-accent text-black font-bold rounded-tr-none shadow-[0_4px_20px_rgba(204,255,0,0.15)]' 
                : 'bg-white/[0.03] text-white/80 border border-white/5 rounded-tl-none backdrop-blur-md font-mono'
            }`}>
              {m.text}
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <div className="flex flex-col items-start gap-3">
            <div className="bg-white/5 p-4 rounded-2xl rounded-tl-none flex gap-2 items-center backdrop-blur-md border border-white/5">
              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_rgba(204,255,0,0.5)]" />
              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_rgba(204,255,0,0.5)]" />
              <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-accent rounded-full shadow-[0_0_8px_rgba(204,255,0,0.5)]" />
            </div>
          </div>
        )}
      </div>

      {!isLoading && (
        <div className="px-5 py-2 overflow-x-auto whitespace-nowrap scrollbar-hide border-t border-white/5 flex gap-2 shrink-0">
          <AnimatePresence>
            {getSuggestedPrompts().map((suggestion, idx) => (
              <motion.button
                key={idx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: idx * 0.1 }}
                onClick={() => handleSubmit(undefined, suggestion.prompt)}
                className="inline-flex items-center gap-2 bg-white/5 border border-white/10 hover:border-accent/40 hover:bg-accent/5 px-3 py-1.5 rounded-full text-[8px] font-mono text-white/50 hover:text-accent transition-all shrink-0"
              >
                <suggestion.icon className="w-3 h-3" />
                <span>{suggestion.label}</span>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="p-5 border-t border-white/5 bg-white/[0.01] backdrop-blur-3xl shrink-0">
        <form onSubmit={handleSubmit} className="relative group">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Initialize command..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-[11px] font-mono text-white placeholder:text-white/10 focus:outline-none focus:border-accent/40 transition-all pr-12"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isLoading}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-accent text-black rounded-lg disabled:opacity-10 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </>
  );

  const ExpandedChat = () => (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 12 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="w-full h-[520px] max-h-[calc(100vh-12rem)] glass-saas rounded-2xl flex flex-col shadow-2xl border border-white/5 overflow-hidden pointer-events-auto"
      role="dialog"
      aria-label="Aura DJ Assistant"
    >
      {/* Drag Handle Bar */}
      <div 
        className="h-2 w-full bg-white/[0.02] cursor-grab active:cursor-grabbing flex items-center justify-center group/drag"
        onPointerDown={(e) => !isMobile && dragControls.start(e)}
      >
        <div className="w-8 h-1 bg-white/10 rounded-full group-hover/drag:bg-accent/40 transition-colors" />
      </div>

      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02] backdrop-blur-2xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 border-2 border-[#0a0a0a] rounded-full bg-accent" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold tracking-widest uppercase text-white/90">Aura Synapse</span>
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 rounded-full bg-accent animate-pulse" />
              <span className="text-[7px] font-mono tracking-[0.2em] uppercase text-accent/60">Neural_Bridge_Active</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={onClose}
            className="text-white/20 hover:text-white p-1.5 hover:bg-white/5 rounded-lg transition-all"
            title="Collapse"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      
      {activeTab === 'aura' ? <ChatContent /> : children}
    </motion.div>
  );

  const CollapsedChip = () => (
    <motion.button
      onClick={onClose}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="h-[44px] min-w-[100px] flex items-center gap-3 px-5 bg-accent text-black rounded-full shadow-2xl hover:brightness-110 transition-all font-mono text-[9px] font-bold tracking-widest uppercase pointer-events-auto"
    >
      <Sparkles className="w-4 h-4" />
      <span>✦ AURA</span>
    </motion.button>
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <motion.div
      style={containerStyles}
      drag={!isMobile}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      dragConstraints={{
        left: 0,
        right: dimensions.width - 340,
        top: 0,
        bottom: dimensions.height - 150
      }}
      onDragEnd={handleDragEnd}
      className="pointer-events-none"
    >
      <AnimatePresence mode="wait">
        {isOpen ? (
          <ExpandedChat key="expanded" />
        ) : (
          <CollapsedChip key="collapsed" />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

