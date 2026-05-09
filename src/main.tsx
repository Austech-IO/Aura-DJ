import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { PlayerProvider } from './core/PlayerContext.tsx';

// Suppress unhandled WebSocket rejections from Vite HMR in sandboxed
// environments (AI Studio, iframes) where WebSocket connections are blocked.
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message ?? String(event.reason ?? '');
  if (msg.includes('WebSocket') || msg.includes('websocket')) {
    event.preventDefault();
  }
});

// Spotify SDK Initialization Hook
// This prevents "onSpotifyWebPlaybackSDKReady is not defined" errors
// if the SDK loads before the React component mounts.
(window as any).onSpotifyWebPlaybackSDKReady = () => {
  console.log("[Aura DJ] 🎧 Spotify Web Playback SDK is ready (Initialized via main.tsx)");
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlayerProvider>
      <App />
    </PlayerProvider>
  </StrictMode>,
);
