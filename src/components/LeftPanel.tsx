import React from 'react';
import {
  Terminal,
  Code2,
  ShieldAlert,
  FileText,
  Coffee,
  FileAudio,
  FolderGit2,
  Users,
  BrainCircuit,
  Settings,
  X,
  Radio,
  Calendar,
  HardDrive,
  Database,
} from 'lucide-react';
import { MayaMode } from '../types';

interface LeftPanelProps {
  currentMode: MayaMode;
  onSelectMode: (mode: MayaMode) => void;
  onOpenTranscribe: () => void;
  onOpenProjects: () => void;
  onOpenTeam: () => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  onOpenCalendar?: () => void;
  onOpenWorkspace?: () => void;
  onOpenCloudMemory?: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

const MODES: Array<{
  id: MayaMode;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  {
    id: 'COMMAND',
    label: 'Command',
    desc: '1-2 sentence replies, fast & direct',
    icon: Terminal,
    color: 'text-[#00E5FF]',
  },
  {
    id: 'BUILDER',
    label: 'Builder',
    desc: 'Master prompts for Bolt, Lovable, v0',
    icon: Code2,
    color: 'text-cyan-400',
  },
  {
    id: 'SENTINEL',
    label: 'Sentinel',
    desc: 'Security audits & CTF lab scopes',
    icon: ShieldAlert,
    color: 'text-[#FF0077]',
  },
  {
    id: 'BRIEF',
    label: 'Brief',
    desc: 'Summaries & top daily priority',
    icon: FileText,
    color: 'text-amber-400',
  },
  {
    id: 'CHILL',
    label: 'Chill',
    desc: 'Casual conversation with light wit',
    icon: Coffee,
    color: 'text-purple-400',
  },
];

export const LeftPanel: React.FC<LeftPanelProps> = ({
  currentMode,
  onSelectMode,
  onOpenTranscribe,
  onOpenProjects,
  onOpenTeam,
  onOpenMemory,
  onOpenSettings,
  onOpenCalendar,
  onOpenWorkspace,
  onOpenCloudMemory,
  isOpenMobile,
  onCloseMobile,
}) => {
  return (
    <aside
      className={`fixed lg:static inset-y-0 left-0 z-40 w-72 h-full bg-[#070a12] border-r border-slate-800/80 flex flex-col transition-transform duration-200 ${
        isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}
    >
      {/* Panel Top */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800/80 bg-[#090e18]">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-[#00E5FF]" />
          <h2 className="text-xs font-mono font-bold text-slate-200 tracking-wider uppercase">
            PROTOCOLS & TOOLS
          </h2>
        </div>
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1 rounded text-slate-400 hover:text-white cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {/* Modes Section */}
        <div className="space-y-1.5">
          <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase px-2">
            OPERATIONAL MODES
          </span>
          <div className="space-y-1">
            {MODES.map((m) => {
              const Icon = m.icon;
              const isActive = currentMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    onSelectMode(m.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-start gap-2.5 p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0f1828] border border-[#00E5FF]/40 shadow-sm'
                      : 'hover:bg-slate-900 border border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? m.color : 'text-slate-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold font-mono ${isActive ? 'text-slate-100' : ''}`}>
                        {m.label}
                      </span>
                      {isActive && (
                        <span className="text-[9px] font-mono text-[#00E5FF] uppercase">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5 truncate">
                      {m.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tools Section */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
          <span className="text-[10px] font-mono tracking-widest text-slate-500 uppercase px-2">
            INTELLIGENCE TOOLS
          </span>
          <div className="space-y-1">
            <button
              onClick={() => {
                onOpenTranscribe();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-mono"
            >
              <FileAudio className="w-4 h-4 text-[#00E5FF] shrink-0" />
              <span>Transcribe Audio</span>
            </button>

            <button
              onClick={() => {
                onOpenCalendar?.();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-mono"
            >
              <Calendar className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Google Calendar Hub</span>
            </button>

            <button
              onClick={() => {
                onOpenWorkspace?.();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-mono"
            >
              <HardDrive className="w-4 h-4 text-[#00E5FF] shrink-0" />
              <span>Google Workspace Hub</span>
            </button>

            <button
              onClick={() => {
                onOpenCloudMemory?.();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-mono"
            >
              <Database className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Maya Cloud Memory</span>
            </button>

            <button
              onClick={() => {
                onOpenProjects();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-mono"
            >
              <FolderGit2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>ASC Projects Radar</span>
            </button>

            <button
              onClick={() => {
                onOpenTeam();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-mono"
            >
              <Users className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>ASC Team Roster</span>
            </button>

            <button
              onClick={() => {
                onOpenMemory();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-slate-900 text-slate-300 hover:text-white transition-colors cursor-pointer text-xs font-mono"
            >
              <BrainCircuit className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Memory & Directives</span>
            </button>
          </div>
        </div>
      </div>

      {/* Settings Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-[#090e18]">
        <button
          onClick={() => {
            onOpenSettings();
            onCloseMobile();
          }}
          className="w-full flex items-center justify-between p-2 rounded-xl bg-[#0f1422] hover:bg-[#141b2e] border border-slate-800 text-slate-200 transition-colors cursor-pointer text-xs font-mono"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#00E5FF]" />
            <span>HUD Settings</span>
          </div>
          <span className="text-[10px] text-slate-500">v1.0</span>
        </button>
      </div>
    </aside>
  );
};
