import React from 'react';
import { Terminal, Code2, ShieldAlert, FileText, Coffee } from 'lucide-react';
import { MayaMode } from '../types';

interface ModeSelectorProps {
  currentMode: MayaMode;
  onSelectMode: (mode: MayaMode) => void;
}

const MODES: Array<{
  id: MayaMode;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  badge: string;
}> = [
  {
    id: 'COMMAND',
    label: 'Command',
    description: '1-2 sentence execution. Confirmation for risky ops.',
    icon: Terminal,
    accentColor: 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10',
    badge: '1-2 Sentences',
  },
  {
    id: 'BUILDER',
    label: 'Builder',
    description: 'Master prompts for Lovable, Bolt, v0 or full code.',
    icon: Code2,
    accentColor: 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10',
    badge: 'Full Spec',
  },
  {
    id: 'SENTINEL',
    label: 'Sentinel',
    description: 'Defensive security, CTF labs, scope authorization.',
    icon: ShieldAlert,
    accentColor: 'text-rose-400 border-rose-500/50 bg-rose-500/10',
    badge: 'Scope Enforced',
  },
  {
    id: 'BRIEF',
    label: 'Brief',
    description: 'Daily summary of deadlines and 1 core priority.',
    icon: FileText,
    accentColor: 'text-amber-400 border-amber-500/50 bg-amber-500/10',
    badge: 'Executive',
  },
  {
    id: 'CHILL',
    label: 'Chill',
    description: 'Composed, casual conversation with light wit.',
    icon: Coffee,
    accentColor: 'text-indigo-400 border-indigo-500/50 bg-indigo-500/10',
    badge: 'Conversational',
  },
];

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  onSelectMode,
}) => {
  return (
    <div className="w-full bg-[#0d1017] border-b border-slate-800/80 px-4 py-2.5">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] font-mono tracking-wider text-slate-500 uppercase mr-1">
            MODE //
          </span>
          {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = currentMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onSelectMode(m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? `${m.accentColor} border shadow-sm font-semibold`
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>

        <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-500 font-mono">
          <span>Active Protocol:</span>
          <span className="text-slate-300 font-semibold">
            {MODES.find((m) => m.id === currentMode)?.description}
          </span>
        </div>
      </div>
    </div>
  );
};
