import { useState, useEffect, useCallback } from 'react';
import { AuraSession } from '../services/session';
import { generateVibeSuggestion } from '../services/gemini';
import { Track } from '../types';

export function useAuraSuggestions(activeTrack: Track | null, isOverlayOpen: boolean) {
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [playCount, setPlayCount] = useState(0);
  const [lastFocusTime, setLastFocusTime] = useState(Date.now());

  const triggerSuggestion = useCallback(async () => {
    if (isOverlayOpen) return; // Don't interrupt mid-conversation
    
    const arc = AuraSession.getArc();
    const text = await generateVibeSuggestion(arc);
    setSuggestion(text);
  }, [isOverlayOpen]);

  // Track play count
  useEffect(() => {
    if (activeTrack) {
      setPlayCount(prev => prev + 1);
    }
  }, [activeTrack]);

  useEffect(() => {
    if (playCount > 0 && playCount % 3 === 0) {
      triggerSuggestion();
    }
  }, [playCount, triggerSuggestion]);

  // Focus tracking (Visibility API)
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const now = Date.now();
        const diffMins = (now - lastFocusTime) / 60000;
        if (diffMins > 5) {
          triggerSuggestion();
        }
        setLastFocusTime(now);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [lastFocusTime, triggerSuggestion]);

  const clearSuggestion = useCallback(() => setSuggestion(null), []);

  return {
    suggestion,
    clearSuggestion
  };
}
