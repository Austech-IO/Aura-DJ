import React, { useEffect } from 'react';

export const YouTubePlayer: React.FC = () => {
  useEffect(() => {
    // We only want the script to load once. App.tsx already loads it, 
    // but we ensure it works here if needed.
    const setupAPI = () => {
      if (!window.YT) {
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      }
    };
    
    setupAPI();
  }, []);

  return (
    <div id="youtube-player-container" className="hidden pointer-events-none absolute invisible">
      <div id="youtube-player-mount"></div>
    </div>
  );
};
