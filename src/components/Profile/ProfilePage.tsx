import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  User, 
  Clock, 
  Heart, 
  Zap, 
  ChevronRight, 
  Settings,
  Music,
  Download,
  CheckCircle2,
  Lock,
  Music2,
  Sparkles
} from 'lucide-react';
import { Playlist, Track } from '../../types';
import { auth, db } from '../../services/firebase';
import { spotifyService } from '../../services/spotifyService';
import { OfflineService } from '../../services/offlineService';
import { generateProfileInsights, ProfileInsights } from '../../services/gemini';
import { SectionLabel } from '../ui/SectionLabel';

interface ProfilePageProps {
  user: any;
  history: Playlist[];
  onPlayTrack: (track: Track) => void;
  onBack: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ 
  user, 
  history, 
  onPlayTrack, 
  onBack 
}) => {
  const [offlineTracks, setOfflineTracks] = useState<Track[]>([]);
  const [spotifyStatus, setSpotifyStatus] = useState(spotifyService.isAuthenticated());
  const [insights, setInsights] = useState<ProfileInsights | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(false);

  useEffect(() => {
    loadOfflineTracks();
    if (history.length > 0) {
      loadInsights();
    }
  }, [history]);

  const loadOfflineTracks = async () => {
    const tracks = await OfflineService.getDownloadedTracks();
    setOfflineTracks(tracks);
  };

  const loadInsights = async () => {
    setIsInsightsLoading(true);
    try {
      const data = await generateProfileInsights(history);
      setInsights(data);
    } catch (err) {
      console.error('Failed to load insights:', err);
    } finally {
      setIsInsightsLoading(false);
    }
  };

  const handleSpotifyConnect = async () => {
    try {
      const response = await fetch('/api/auth/spotify/url');
      const { url } = await response.json();
      const popup = window.open(url, 'spotify-login', 'width=500,height=700');
      
      const messageListener = (event: MessageEvent) => {
        if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
          spotifyService.setTokens(event.data.tokens);
          setSpotifyStatus(true);
          window.removeEventListener('message', messageListener);
        }
      };
      window.addEventListener('message', messageListener);
    } catch (err) {
      console.error('Spotify connect error:', err);
    }
  };

  const stats = [
    { label: 'Synapses', value: history.length * 12, icon: Zap, color: 'text-accent' },
    { label: 'Sessions', value: history.length, icon: Clock, color: 'text-white/40' },
    { label: 'Vault', value: offlineTracks.length, icon: Download, color: 'text-blue-400' },
  ];

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-12 bg-base/40">
      <div className="max-w-6xl mx-auto space-y-16">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center gap-8 border-b border-white/5 pb-10">
          <div className="relative group">
            <div className="w-32 h-32 rounded-3xl overflow-hidden ring-4 ring-accent/10 group-hover:ring-accent/30 transition-all">
              <img 
                src={user.photoURL || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${user.email}`} 
                className="w-full h-full object-cover"
                alt="Avatar"
              />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-accent text-black p-2 rounded-xl shadow-lg">
              <Settings className="w-5 h-5" />
            </div>
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
               <h1 className="text-4xl font-black uppercase tracking-tight">{user.displayName || user.email?.split('@')[0]}</h1>
               <span className="saas-badge text-accent self-center md:self-auto px-3 py-1">CORE_LEVEL_04</span>
            </div>
            <p className="font-mono text-xs text-white/30 uppercase mt-2 tracking-[0.2em]">{user.email}</p>
            
            <div className="flex flex-wrap items-center gap-8 mt-8">
              {stats.map(s => (
                <div key={s.label} className="flex items-center gap-3">
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                  <div className="flex flex-col">
                    <span className="text-lg font-black leading-none">{s.value}</span>
                    <span className="text-[9px] font-mono uppercase tracking-widest opacity-20">{s.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button 
            onClick={onBack}
            className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all text-[10px] font-mono uppercase tracking-[0.25em]"
          >
            Terminal_Exit
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column: Integrations & Offline */}
          <div className="lg:col-span-1 space-y-12">
            <section>
              <SectionLabel>Integrations</SectionLabel>
              <div className="mt-4 glass-saas rounded-2xl p-6 border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                      <Music2 className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest">Spotify API</p>
                      <p className="text-[10px] font-mono text-white/30 uppercase mt-0.5">{spotifyStatus ? 'SYNKED' : 'NOT_INITIATED'}</p>
                    </div>
                  </div>
                  {spotifyStatus ? (
                    <CheckCircle2 className="w-5 h-5 text-accent" />
                  ) : (
                    <button 
                      onClick={handleSpotifyConnect}
                      className="px-4 py-2 bg-green-500 text-black text-[10px] font-bold uppercase rounded-lg hover:bg-green-400 transition-colors"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-4">
                <SectionLabel>Offline Vault</SectionLabel>
                <span className="text-[10px] font-mono text-white/20 uppercase tracking-[0.2em]">{offlineTracks.length} / 100</span>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                {offlineTracks.map((track, i) => (
                  <div 
                    key={track.searchQuery + i}
                    className="group bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 p-3 rounded-xl flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/5 rounded flex items-center justify-center text-white/20">
                         <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase truncate max-w-[120px]">{track.title}</p>
                        <p className="text-[9px] font-mono opacity-30 uppercase truncate max-w-[120px]">{track.artist}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => onPlayTrack(track)}
                      className="p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:text-accent"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                ))}
                {offlineTracks.length === 0 && (
                  <div className="p-8 text-center border border-dashed border-white/5 rounded-2xl">
                    <Lock className="w-8 h-8 text-white/5 mx-auto mb-3" />
                    <p className="text-[10px] font-mono text-white/10 uppercase tracking-widest">No Frequencies Downloaded</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column: History & Stats */}
          <div className="lg:col-span-2 space-y-12">
            <section>
              <SectionLabel>Frequency History</SectionLabel>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {history.map((playlist, i) => (
                  <div 
                    key={playlist.id || i}
                    className="glass-saas hover:bg-white/[0.05] border-white/5 p-5 rounded-2xl transition-all cursor-pointer group"
                    onClick={() => playlist.tracks[0] && onPlayTrack(playlist.tracks[0])}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-2 rounded-lg bg-accent/10 border border-accent/20">
                         <Music2 className="w-4 h-4 text-accent" />
                      </div>
                      <span className="text-[9px] font-mono text-white/20 uppercase tracking-tight">{new Date(playlist.createdAt?.seconds * 1000).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-lg font-bold uppercase tracking-tight truncate">{playlist.title}</h3>
                    <p className="text-[10px] font-mono text-white/30 uppercase mt-1 tracking-widest line-clamp-1">{playlist.mood} • {playlist.tracks.length} Tracks</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <SectionLabel>Neural Insights</SectionLabel>
              <div className="mt-4 p-8 glass-saas rounded-2xl border-white/5 relative overflow-hidden group min-h-[300px] flex flex-col justify-center">
                 <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-20 transition-opacity">
                    <Sparkles className="w-24 h-24 text-accent" />
                 </div>
                 
                 {isInsightsLoading ? (
                   <div className="space-y-4">
                     <div className="h-8 bg-white/5 rounded animate-pulse w-3/4" />
                     <div className="h-4 bg-white/5 rounded animate-pulse w-full" />
                     <div className="h-4 bg-white/5 rounded animate-pulse w-2/3" />
                   </div>
                 ) : insights ? (
                   <>
                     <h3 className="text-xl font-black uppercase tracking-tight mb-4">Recommendation Protocol</h3>
                     <p className="text-sm font-medium text-white/60 leading-relaxed max-w-lg mb-8 italic">
                       "{insights.summary}"
                     </p>
                     <div className="flex flex-wrap gap-2 mb-8">
                        {insights.genres.map(tag => (
                          <span key={tag} className="px-3 py-1 bg-accent/5 border border-accent/10 rounded-full text-[9px] font-mono font-bold tracking-widest text-accent uppercase">{tag}</span>
                        ))}
                     </div>
                     <p className="text-[10px] font-mono text-white/20 uppercase tracking-[0.2em] max-w-sm">
                       Logic: {insights.recommendation_logic}
                     </p>
                   </>
                 ) : (
                   <p className="text-center text-[10px] font-mono text-white/20 uppercase tracking-widest">Insufficient Data for Synthesis</p>
                 )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};
