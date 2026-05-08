import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RotateCcw, X } from 'lucide-react';

interface UndoToastProps {
  show: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({ show, onUndo, onDismiss }) => {
  const [timeLeft, setTimeLeft] = useState(5);

  useEffect(() => {
    if (!show) {
      setTimeLeft(5);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [show]);

  useEffect(() => {
    if (show && timeLeft === 0) {
      onDismiss();
    }
  }, [show, timeLeft, onDismiss]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-4 bg-black/90 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-2xl shadow-2xl"
        >
          <div className="flex flex-col flex-1">
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs font-bold text-white uppercase tracking-wider">Queue Modified</p>
              <p className="text-[10px] text-white/40 font-mono">Reverting in {timeLeft}s</p>
            </div>
            {/* Progress Bar Container */}
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
               <motion.div 
                 initial={{ width: "100%" }}
                 animate={{ width: "0%" }}
                 transition={{ duration: 5, ease: "linear" }}
                 className="h-full bg-accent"
               />
            </div>
          </div>

          <div className="h-8 w-px bg-white/10 mx-2" />

          <button 
            onClick={() => {
              onUndo();
              onDismiss();
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-accent text-black rounded-lg hover:bg-accent/90 transition-colors group"
          >
            <RotateCcw className="w-3.5 h-3.5 group-hover:rotate-[-45deg] transition-transform" />
            <span className="text-[10px] font-bold uppercase">Undo</span>
          </button>

          <button 
            onClick={onDismiss}
            className="p-1 hover:bg-white/10 rounded-full text-white/40 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
