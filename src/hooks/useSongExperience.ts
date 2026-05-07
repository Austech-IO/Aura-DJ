import { useState, useEffect } from 'react';
import { Track, SongExperience } from '../types';
import { generateSongExperience } from '../services/gemini';

export const useSongExperience = (track: Track | null) => {
  const [songExperience, setSongExperience] = useState<SongExperience | null>(null);
  const [isExpLoading, setIsExpLoading] = useState(false);

  useEffect(() => {
    if (!track) {
      setSongExperience(null);
      return;
    }

    setIsExpLoading(true);
    generateSongExperience(track.title, track.artist)
      .then(data => {
        setSongExperience({
          song: { title: track.title, artist: track.artist },
          mood: data.mood,
          energyLevel: data.energy_level,
          themeColor: data.theme_color,
          interpretation: data.interpretation,
          lyricsStyle: data.lyrics_style,
          uiNotes: data.ui_notes
        });
        setIsExpLoading(false);
      })
      .catch(err => {
        console.error("Experience generation failed", err);
        setIsExpLoading(false);
      });
  }, [track?.searchQuery]);

  return { songExperience, isExpLoading };
};
