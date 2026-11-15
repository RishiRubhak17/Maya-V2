import React from 'react';
import { ConsoleTab } from './ConsolePanel';
import {
  Layers,
  Cpu,
  FileText,
  Search,
  CheckSquare,
  Settings,
  Volume2,
  ShieldAlert,
  Calendar,
} from 'lucide-react';

interface ModulesPanelProps {
  onSelectTab: (tab: ConsoleTab) => void;
  onOpenSettings: () => void;
  onOpenVoice: () => void;
  onOpenAbout: () => void;
  onOpenModes: () => void;
  onOpenMemory?: () => void;
  currentMode: string;
}

export const ModulesPanel: React.FC<ModulesPanelProps> = ({
  onSelectTab,
  onOpenSettings,
  onOpenVoice,
  onOpenAbout,
  onOpenModes,
  onOpenMemory,
  currentMode,
}) => {
  const modules = [
    {
      id: 'MODES',
      label: 'MODES',
      sub: currentMode,
      icon: <Layers size={18} />,
      action: onOpenModes,
    },
    {
      id: 'MEMORY',
      label: 'MEMORY',
      sub: 'RELATIONSHIP',
      icon: <Cpu size={18} />,
      action: () => (onOpenMemory ? onOpenMemory() : onSelectTab('TASKS')),
    },
    {
      id: 'TRANSCRIPTS',
      label: 'TRANSCRIPTS',
      sub: 'AUDIO // TXT',
      icon: <FileText size={18} />,
      action: () => onSelectTab('TRANSCRIBE'),
    },
    {
      id: 'SOURCES',
      label: 'SOURCES',
      sub: 'GROUNDING',
      icon: <Search size={18} />,
      action: () => onSelectTab('SEARCH'),
    },
    {
      id: 'CALENDAR',
      label: 'CALENDAR',
      sub: 'GOOGLE SYNC',
      icon: <Calendar size={18} />,
      action: () => onSelectTab('CALENDAR'),
    },
    {
      id: 'TASKS',
      label: 'TASKS',
      sub: 'DEADLINES',
      icon: <CheckSquare size={18} />,
      action: () => onSelectTab('TASKS'),
    },
    {
      id: 'SETTINGS',
      label: 'SETTINGS',
      sub: 'PREFERENCES',
      icon: <Settings size={18} />,
      action: onOpenSettings,
    },
    {
      id: 'VOICE',
      label: 'VOICE',
      sub: 'SYNTHESIS',
      icon: <Volume2 size={18} />,
      action: onOpenVoice,
    },
    {
      id: 'ABOUT',
      label: 'ABOUT',
      sub: 'AXIOM CORE',
      icon: <ShieldAlert size={18} />,
      action: onOpenAbout,
    },
  ];

  return (
    <div className="edex-panel h-full flex flex-col p-2.5 overflow-hidden border border-[#2e2e31]">
      {/* Header Path */}
      <div className="flex items-center justify-between border-b border-[#2e2e31] pb-1.5 mb-2 font-hud text-[11px] text-[#6d6d69]">
        <span className="tracking-widest">PATH // AXIOM://MAYA/MODULES</span>
        <span className="text-[var(--accent)] font-mono text-[10px]">8 CORES</span>
      </div>

      {/* Filesystem Grid of Module Icons */}
      <div className="grid grid-cols-4 gap-2 flex-1">
        {modules.map((m) => (
          <button
            key={m.id}
            onClick={m.action}
            className="flex flex-col items-center justify-center p-2 bg-[#09090b] border border-[#2e2e31]/70 hover:border-[var(--accent)] hover:bg-[#121216] transition-all group cursor-pointer relative"
          >
            <div className="text-[#6d6d69] group-hover:text-[var(--accent)] transition-colors mb-1">
              {m.icon}
            </div>
            <span className="font-hud text-[11px] font-bold text-[#cfcfca] tracking-wider group-hover:text-[var(--accent)]">
              {m.label}
            </span>
            <span className="font-mono text-[9px] text-[#46464a] group-hover:text-[#6d6d69]">
              {m.sub}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
