import React from 'react';
import { X, Shield, Users, Code, Terminal } from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const team = [
    { name: 'Sirius', role: 'Founder & CEO (Lead Architect)' },
    { name: 'Ahamadhu Aaqil I', role: 'Co-founder & Chairman' },
    { name: 'Hari Vishnu A', role: 'Chief Operating Officer (COO)' },
    { name: 'Mohamed Nufail M', role: 'Chief Technology Officer (CTO)' },
    { name: 'Muhamed Jamal K', role: 'Chief Marketing Officer (CMO)' },
    { name: 'Mohammad Anas S', role: 'Technical Associate' },
  ];

  const projects = [
    'AttendLink (Automated attendance tracking)',
    'BSDCAS Attendance Pipeline',
    'MinMeter (Telemetry dashboard)',
    'PONNI MUN 3.0 Portal',
    'Beginner CTF & Workshop Challenge Environment',
    'Kairo & ScantriX Vulnerability Scanners',
    'MediaPipe Gesture Control Tools',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="bg-[#0d0d0f] border border-[#2e2e31] max-w-2xl w-full p-5 font-mono text-xs flex flex-col gap-4 shadow-2xl max-h-[85vh] overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2e2e31] pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
            <span className="font-hud text-sm font-bold tracking-wider text-[#cfcfca]">
              AXIOM INTELLIGENCE // ABOUT MAYA
            </span>
          </div>
          <button onClick={onClose} className="text-[#6d6d69] hover:text-[#cfcfca] cursor-pointer">
            <X size={16} />
          </button>
        </div>

        {/* Identity Section */}
        <div className="bg-[#09090b] border border-[#2e2e31] p-3 space-y-2">
          <div className="flex items-center gap-2 text-[var(--accent)] font-hud text-xs font-bold">
            <Shield size={16} />
            <span>MISSION-DRIVEN ASSISTANT FOR YOUR AXIOM (MAYA)</span>
          </div>
          <p className="text-[#cfcfca] leading-relaxed text-[11px]">
            MAYA is Sirius&apos;s personal executive AI assistant and chief of staff on Axiom Intelligence, engineered for Axiom Secure Crafts (ASC) in Trichy, Tamil Nadu, India. Operating across 5 operational protocols, Maya integrates real-time voice synthesis, autonomous risk-tiered tool execution, and Google Search grounding.
          </p>
        </div>

        {/* Team Section */}
        <div className="bg-[#09090b] border border-[#2e2e31] p-3 space-y-2">
          <div className="flex items-center gap-2 text-[#cfcfca] font-hud text-xs font-bold">
            <Users size={16} className="text-[var(--accent)]" />
            <span>ASC LEADERSHIP TEAM // TRICHY</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {team.map((m) => (
              <div key={m.name} className="p-1.5 bg-[#0e0e12] border border-[#2e2e31]/60">
                <div className="text-[#cfcfca] font-bold">{m.name}</div>
                <div className="text-[10px] text-[#6d6d69]">{m.role}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Projects */}
        <div className="bg-[#09090b] border border-[#2e2e31] p-3 space-y-2">
          <div className="flex items-center gap-2 text-[#cfcfca] font-hud text-xs font-bold">
            <Code size={16} className="text-[var(--accent)]" />
            <span>ACTIVE ASC PROJECTS & SYSTEMS</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 pt-1 text-[11px] text-[#6d6d69]">
            {projects.map((p, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[var(--accent)] font-bold">▸</span>
                <span className="text-[#cfcfca]">{p}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop Ready Architecture */}
        <div className="bg-[#09090b] border border-[#2e2e31] p-3 space-y-2">
          <div className="flex items-center gap-2 text-[#cfcfca] font-hud text-xs font-bold">
            <Terminal size={16} className="text-[var(--accent)]" />
            <span>DESKTOP-READY ARCHITECTURE (ELECTRON WRAPPER)</span>
          </div>
          <p className="text-[10px] text-[#6d6d69] leading-relaxed">
            All OS interactions route through the unified <code className="text-[#cfcfca]">ToolBridge</code>. When packaged in Electron on Windows or Linux, Maya interfaces directly with host OS APIs via <code className="text-[#cfcfca]">window.maya.runTool</code> and the native Porcupine wake engine with zero UI rewrites.
          </p>
        </div>

        <div className="pt-2 border-t border-[#2e2e31] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-[var(--accent)] text-[#070708] font-hud text-xs font-bold cursor-pointer hover:brightness-110"
          >
            [ DISMISS ]
          </button>
        </div>
      </div>
    </div>
  );
};
