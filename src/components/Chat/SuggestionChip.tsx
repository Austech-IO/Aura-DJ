import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Sparkles } from 'lucide-react';

interface SuggestionChipProps {
  text: string | null;
  onAccept: () => void;
  onDismiss: () => void;
  corner: string;
}

export const SuggestionChip: React.FC<SuggestionChipProps> = ({ text, onAccept, onDismiss, corner }) => {
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (text) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, 8000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, onDismiss]);

  const isTop = corner.includes('top');
  const isLeft = corner.includes('left');

  const containerStyles: any = {
    position: 'fixed',
    zIndex: 115,
    [isLeft ? 'left' : 'right']: '24px',
    [isTop ? 'top' : 'bottom']: isTop ? 'calc(24px + 60px)' : 'calc(24px + 96px + 24px + 44px + 12px)',
  };

  return (
    <AnimatePresence>
      {text && (
        <motion.div
          initial={{ opacity: 0, y: isTop ? -20 : 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: isTop ? -20 : 20, scale: 0.9 }}
          style={containerStyles}
          className="max-w-[280px] bg-black/80 backdrop-blur-xl border border-accent/20 rounded-full px-4 py-2 flex items-center gap-3 shadow-2xl"
        >
          <div className="bg-accent/10 p-1.5 rounded-full">
            <Sparkles className="w-3 h-3 text-accent" />
          </div>
          
          <p className="text-[11px] text-white/90 font-medium leading-tight line-clamp-1 flex-1">
            {text}
          </p>

          <div className="flex items-center gap-1 border-l border-white/10 pl-2">
            <button 
              onClick={onAccept}
              className="p-1 hover:bg-accent/20 rounded-full transition-colors group"
              title="Accept suggestion"
            >
              <Check className="w-3.5 h-3.5 text-accent group-hover:scale-110 transition-transform" />
            </button>
            <button 
              onClick={onDismiss}
              className="p-1 hover:bg-white/10 rounded-full transition-colors group"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
