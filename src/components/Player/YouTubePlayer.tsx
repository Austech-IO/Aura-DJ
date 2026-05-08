import React, { useEffect } from 'react';

export const YouTubePlayer: React.FC = () => {
  useEffect(() => {
    // We only want the script to load once.
    const setupAPI = () => {
      if (typeof window === 'undefined') return;

      // Avoid double injection
      if (document.getElementById('youtube-iframe-api')) {
        if ((window as any).YT && (window as any).YT.Player) {
          console.log('YouTube API already loaded');
        }
        return;
      }
      
      try {
        // Attach global callback only once
        if (!(window as any).onYouTubeIframeAPIReady) {
          (window as any).onYouTubeIframeAPIReady = () => {
            console.log('YouTube API Initialized');
            // Notify any listeners if needed
          };
        }

        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api';
        tag.src = "https://www.youtube.com/iframe_api";
        tag.async = true;
        
        const firstScriptTag = document.getElementsByTagName('script')[0];
        if (firstScriptTag && firstScriptTag.parentNode) {
          firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        } else {
          document.head.appendChild(tag);
        }
      } catch (err) {
        console.error('YouTube API Script Injection Error:', err);
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
