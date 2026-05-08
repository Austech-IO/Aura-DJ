import { useState, useCallback } from 'react';
import { generateDJResponse } from '../services/gemini';
import { usePlayer } from '../core/PlayerContext';
import { Track } from '../types';

export interface Message {
  role: 'user' | 'aura';
  text: string;
}

export function useAuraChat() {
  const { playTrack, setQueue, setDjConfig, insertTrack, setShowUndoToast, currentIndex, setNextTrack } = usePlayer();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'aura', text: "Neural connection established. How can I tune your frequency today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = useCallback(async (forcedInput?: string) => {
    const userMsg = forcedInput || input;
    if (!userMsg.trim() || isLoading) return;

    if (!forcedInput) setInput("");
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const aiResponse = await generateDJResponse(userMsg);
      
      if (aiResponse.message) {
        setMessages(prev => [...prev, { role: 'aura', text: aiResponse.message || '' }]);
      }

      if (aiResponse.dj_mode === "insert" && aiResponse.track) {
        const newTrack: Track = {
          title: aiResponse.track.title,
          artist: aiResponse.track.artist,
          searchQuery: aiResponse.track.search_query,
          album: "AI Request",
          genre: "Requested",
          duration: "3:30",
          year: new Date().getFullYear().toString(),
          bpm: 110,
          energy: 6
        };

        const pos = aiResponse.position !== undefined ? aiResponse.position : currentIndex + 1;
        insertTrack(pos, newTrack);
        setShowUndoToast(true);
      }

      if (aiResponse.dj_mode === "active") {
        setDjConfig(aiResponse.transition);

        const currentTrack: Track = {
          title: aiResponse.current_song!.title,
          artist: aiResponse.current_song!.artist,
          searchQuery: aiResponse.current_song!.search_query,
          album: "AI Stream",
          genre: aiResponse.mood || "Dynamic",
          duration: "3:30",
          year: new Date().getFullYear().toString(),
        };

        const queueTracks: Track[] = aiResponse.queue!.map(s => ({
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

        if (aiResponse.next_song) {
          const nextTrk: Track = {
            title: aiResponse.next_song.title,
            artist: aiResponse.next_song.artist,
            searchQuery: aiResponse.next_song.search_query,
            album: "AI Next",
            genre: aiResponse.mood || "Dynamic",
            duration: "3:30",
            year: new Date().getFullYear().toString(),
          };
          setNextTrack(nextTrk);
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'aura', text: "Signal interference detected. Please retry." }]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, playTrack, setQueue, setDjConfig]);

  return {
    messages,
    input,
    setInput,
    isLoading,
    sendMessage
  };
}
