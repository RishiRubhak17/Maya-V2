import React, { useState, useEffect } from 'react';
import { DottedGlobe } from '../visuals/DottedGlobe';
import { TrafficChart } from '../visuals/TrafficChart';
import { MayaEmotion, EmotionHistoryEntry, EMOTION_MAP } from '../emotion/types';

interface NetworkPanelProps {
  emotion: MayaEmotion;
  intensity: number;
  emotionHistory: EmotionHistoryEntry[];
  audioInRate: number;
  audioOutRate: number;
  apiMessageRate: number;
}

export const NetworkPanel: React.FC<NetworkPanelProps> = ({
  emotion,
  intensity,
  emotionHistory,
  audioInRate,
  audioOutRate,
  apiMessageRate,
}) => {
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pingMs, setPingMs] = useState<number>(24);
  const [connType, setConnType] = useState<string>('BROADBAND');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Read connection type if available
    const conn = (navigator as any).connection;
    if (conn) {
      const updateConn = () => {
        setConnType(conn.effectiveType ? conn.effectiveType.toUpperCase() : 'LAN/WIFI');
      };
      updateConn();
      conn.addEventListener('change', updateConn);
    }

    // Ping check interval
    const pingInterval = setInterval(async () => {
      if (!navigator.onLine) {
        setPingMs(999);
        return;
      }
      const start = performance.now();
      try {
        await fetch('/api/maya/health', { method: 'GET', cache: 'no-store' });
        const delta = Math.round(performance.now() - start);
        setPingMs(delta);
      } catch (e) {
        setPingMs(42);
      }
    }, 8000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(pingInterval);
    };
  }, []);

  const currentProfile = EMOTION_MAP[emotion] || EMOTION_MAP.calm;

  return (
    <aside className="edex-panel h-full flex flex-col p-3 overflow-y-auto no-scrollbar select-none gap-3 border-l border-[#2e2e31]">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-[#2e2e31]/80 pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
          <span className="font-hud text-xs tracking-widest text-[#cfcfca] font-bold">PANEL // NETWORK</span>
        </div>
        <span
          className={`font-mono text-[10px] px-1.5 py-0.5 border ${
            isOnline
              ? 'text-[var(--accent)] border-[var(--accent)]/40 bg-[var(--accent)]/10'
              : 'text-[#c4524f] border-[#c4524f]/40 bg-[#c4524f]/10'
          }`}
        >
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </span>
      </div>

      {/* Network Telemetry Badges */}
      <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
        <div className="bg-[#09090b] p-1.5 border border-[#2e2e31]/50 flex flex-col">
          <span className="text-[#6d6d69]">LATENCY / PING</span>
          <span className="text-[#cfcfca] font-bold">{isOnline ? `${pingMs} MS` : 'ERR'}</span>
        </div>
        <div className="bg-[#09090b] p-1.5 border border-[#2e2e31]/50 flex flex-col">
          <span className="text-[#6d6d69]">CONNECTION</span>
          <span className="text-[#cfcfca] font-bold">{connType}</span>
        </div>
      </div>

      {/* Dotted Globe Canvas */}
      <div className="bg-[#09090b] border border-[#2e2e31]/60 flex flex-col items-center p-1 relative overflow-hidden">
        <div className="w-full flex justify-between text-[9px] font-mono text-[#6d6d69] px-2 py-0.5 border-b border-[#2e2e31]/30">
          <span>ORBITAL MESH</span>
          <span>FIBONACCI SPHERE</span>
        </div>
        <DottedGlobe emotion={emotion} isOnline={isOnline} />
      </div>

      {/* Network Traffic Line Chart */}
      <TrafficChart
        audioInRate={audioInRate}
        audioOutRate={audioOutRate}
        apiMessageRate={apiMessageRate}
      />

      {/* Emotion System Panel */}
      <div className="space-y-1.5 bg-[#09090b] border border-[#2e2e31]/60 p-2.5 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between border-b border-[#2e2e31]/40 pb-1">
          <span className="font-hud text-[11px] tracking-wider text-[#6d6d69] font-bold">
            EMOTION CORE // SYNAPSE
          </span>
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: currentProfile.color }}
          />
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <span className="font-hud text-lg font-bold tracking-widest text-[#cfcfca] uppercase">
            {emotion}
          </span>
          <span className="font-mono text-xs text-[#cfcfca]">{intensity}% INTENSITY</span>
        </div>

        <div className="text-[10px] text-[#6d6d69] font-mono italic">
          {currentProfile.description}
        </div>

        {/* Intensity Bar */}
        <div className="w-full bg-[#141416] h-1.5 border border-[#2e2e31]/60 overflow-hidden my-1">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${intensity}%`,
              backgroundColor: currentProfile.color,
            }}
          />
        </div>

        {/* Emotion Sparkline */}
        <div className="flex flex-col gap-1 mt-auto pt-2 border-t border-[#2e2e31]/40">
          <span className="text-[9px] font-hud text-[#6d6d69] tracking-wider">AFFECT TRAJECTORY</span>
          <svg className="w-full h-8 overflow-visible" preserveAspectRatio="none">
            {emotionHistory.length > 1 && (
              <polyline
                fill="none"
                stroke={currentProfile.color}
                strokeWidth="1.5"
                points={emotionHistory
                  .map((entry, idx) => {
                    const x = (idx / (emotionHistory.length - 1)) * 180;
                    const y = 30 - (entry.intensity / 100) * 26;
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            )}
            {emotionHistory.map((entry, idx) => {
              const x = (idx / (Math.max(1, emotionHistory.length - 1))) * 180;
              const y = 30 - (entry.intensity / 100) * 26;
              return (
                <circle
                  key={idx}
                  cx={x}
                  cy={y}
                  r="2"
                  fill={idx === emotionHistory.length - 1 ? 'var(--accent)' : '#6d6d69'}
                />
              );
            })}
          </svg>
        </div>
      </div>
    </aside>
  );
};
