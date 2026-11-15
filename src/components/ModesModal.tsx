import React from 'react';
import { MayaMode } from '../types';
import { X, Zap, Hammer, Shield, FileText, Coffee } from 'lucide-react';

interface ModesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: MayaMode;
  onSelectMode: (mode: MayaMode) => void;
}

export const ModesModal: React.FC<ModesModalProps> = ({
  isOpen,
  onClose,
  currentMode,
  onSelectMode,
}) => {
  if (!isOpen) return null;

  const modes: Array<{
    id: MayaMode;
    label: string;
    icon: React.ReactNode;
    desc: string;
    behavior: string;
    defaultEmotion: string;
  }> = [
    {
      id: 'COMMAND',
      label: 'COMMAND PROTOCOL',
      icon: <Zap size={18} />,
      desc: 'Short, fast, high-velocity executive cadence.',
      behavior: '1-2 sentence replies, instantaneous tool execution, zero fluff.',
      defaultEmotion: 'focused',
    },
    {
      id: 'BUILDER',
      label: 'BUILDER PROTOCOL',
      icon: <Hammer size={18} />,
      desc: 'Architectural precision for web apps, code, and master prompts.',
      behavior: 'Structured technical specifications for Bolt.new, Lovable, v0.dev.',
      defaultEmotion: 'focused',
    },
    {
      id: 'SENTINEL',
      label: 'SENTINEL PROTOCOL',
      icon: <Shield size={18} />,
      desc: 'Cybersecurity defense, CTF challenges, forensics, threat modeling.',
      behavior: 'Strict ethical scope verification. Defensive audits and CTFs only.',
      defaultEmotion: 'serious',
    },
    {
      id: 'BRIEF',
      label: 'BRIEF PROTOCOL',
      icon: <FileText size={18} />,
      desc: 'Daily tactical executive summary and priorities.',
      behavior: 'Structured status on ASC projects (PONNI MUN 3.0, AttendLink) + top priority.',
      defaultEmotion: 'calm',
    },
    {
      id: 'CHILL',
      label: 'CHILL PROTOCOL',
      icon: <Coffee size={18} />,
      desc: 'Casual best-friend mode with warmth and dry humor.',
      behavior: 'Relaxed banter, subtle Tamil warmth, caring for Sirius wellbeing.',
      defaultEmotion: 'caring',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="bg-[#0d0d0f] border border-[#2e2e31] max-w-lg w-full p-5 font-mono text-xs flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#2e2e31] pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
            <span className="font-hud text-sm font-bold tracking-wider text-[#cfcfca]">
              TACTICAL OPERATIONAL MODES
            </span>
          </div>
          <button onClick={onClose} className="text-[#6d6d69] hover:text-[#cfcfca] cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2">
          {modes.map((m) => {
            const isSelected = currentMode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  onSelectMode(m.id);
                  onClose();
                }}
                className={`w-full p-3 border text-left flex items-start gap-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[#cfcfca]'
                    : 'border-[#2e2e31]/70 bg-[#09090b] text-[#6d6d69] hover:border-[#6d6d69] hover:text-[#cfcfca]'
                }`}
              >
                <div
                  className={`p-2 border ${
                    isSelected
                      ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/20'
                      : 'border-[#2e2e31] text-[#6d6d69]'
                  }`}
                >
                  {m.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-hud font-bold text-xs tracking-wider text-[#cfcfca]">
                      {m.label}
                    </span>
                    {isSelected && (
                      <span className="font-hud text-[10px] text-[var(--accent)] font-bold">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#cfcfca] mt-0.5">{m.desc}</div>
                  <div className="text-[10px] text-[#6d6d69] mt-1">{m.behavior}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
