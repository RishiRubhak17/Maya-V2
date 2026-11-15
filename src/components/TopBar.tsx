import React from 'react';
import { Menu, Settings, Download, Radio, Shield, Sparkles } from 'lucide-react';
import { MayaMode, LiveSessionState } from '../types';

import { Calendar, CheckCircle2, User as UserIcon } from 'lucide-react';
import { User } from 'firebase/auth';

interface TopBarProps {
  currentMode: MayaMode;
  sessionState: LiveSessionState;
  onOpenSettings: () => void;
  onToggleMobileLeft: () => void;
  onInstallClick?: () => void;
  isInstallable: boolean;
  onTriggerBrief: () => void;
  googleUser?: User | null;
  onOpenCalendar?: () => void;
  onGoogleConnect?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentMode,
  sessionState,
  onOpenSettings,
  onToggleMobileLeft,
  onInstallClick,
  isInstallable,
  onTriggerBrief,
  googleUser,
  onOpenCalendar,
  onGoogleConnect,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 lg:px-6 py-3 bg-[#050608]/95 backdrop-blur-md border-b border-slate-800/80 select-none">
      {/* Zone 1: Brand Wordmark (Single text element) */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileLeft}
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          className="flex items-center gap-2 text-sm sm:text-base font-bold font-mono tracking-tight text-slate-100 whitespace-nowrap shrink-0 hover:text-[#00E5FF] transition-colors"
        >
          <span className="w-2.5 h-2.5 rounded-sm bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
          <span>AXIOM INTELLIGENCE // MAYA</span>
        </a>
      </div>

      {/* Zone 2: Status & Mode Indicators (Single-line controls) */}
      <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
        {/* Live Audio Status */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              sessionState === 'SPEAKING'
                ? 'bg-[#FF0077] animate-ping'
                : sessionState === 'LISTENING'
                ? 'bg-[#00E5FF] animate-pulse'
                : sessionState === 'THINKING'
                ? 'bg-[#E040FB] animate-spin'
                : 'bg-emerald-400'
            }`}
          />
          <span className="text-slate-400">
            {sessionState === 'IDLE' ? 'ONLINE' : `LIVE: ${sessionState}`}
          </span>
        </div>

        <span className="text-slate-700">|</span>

        {/* Operational Mode */}
        <div className="flex items-center gap-1.5 text-slate-300">
          <span className="text-slate-500">MODE:</span>
          <span className="text-[#00E5FF] font-semibold">{currentMode}</span>
        </div>
      </div>

      {/* Zone 3: Actions (Calendar Sync, Brief, Install PWA, Settings) */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Google Workspace & Cloud Memory Status & Connect Button */}
        {googleUser ? (
          <button
            onClick={onOpenCalendar}
            title={`Connected to Google Workspace: ${googleUser.email || googleUser.displayName}. Drive, Sheets, Gmail, Docs, Tasks, Meet & Calendar.`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-medium text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 rounded-lg transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden md:inline">Workspace Synced</span>
          </button>
        ) : (
          <button
            onClick={onGoogleConnect || onOpenCalendar}
            title="Connect Google Workspace with permission to sync Drive, Sheets, Gmail, Docs, Tasks, Meet & Calendar"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono font-medium text-amber-300 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 rounded-lg transition-colors cursor-pointer"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            <span className="hidden sm:inline">Connect Workspace</span>
          </button>
        )}

        <button
          onClick={onTriggerBrief}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-800/60 rounded-lg transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
          <span className="hidden sm:inline">Tactical</span>
          <span>Brief</span>
        </button>

        {isInstallable && onInstallClick && (
          <button
            onClick={onInstallClick}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold text-slate-950 bg-[#00E5FF] hover:bg-[#00E5FF]/80 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Install</span>
          </button>
        )}

        <button
          onClick={onOpenSettings}
          title="HUD Settings"
          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <Settings className="w-4 h-4 text-[#00E5FF]" />
        </button>
      </div>
    </header>
  );
};
