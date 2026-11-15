import React from 'react';
import { X, Send, UserCheck, Briefcase } from 'lucide-react';
import { TeamMember } from '../types';

interface TeamRosterProps {
  isOpen: boolean;
  onClose: () => void;
  team: TeamMember[];
  onDispatchTask: (member: TeamMember) => void;
}

export const TeamRoster: React.FC<TeamRosterProps> = ({
  isOpen,
  onClose,
  team,
  onDispatchTask,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl h-full bg-[#0b0e17] border-l border-slate-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0e121d]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <h2 className="text-base font-bold text-slate-100">
                ASC Executive Command Roster
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Axiom Secure Crafts core leadership & technical staff
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Team List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {team.map((member) => (
            <div
              key={member.id}
              className="p-4 rounded-xl bg-[#111624] border border-slate-800/80 hover:border-slate-700 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">{member.name}</h3>
                  <p className="text-xs font-mono text-emerald-400 mt-0.5">{member.role}</p>
                </div>
                <span className="text-[11px] font-mono text-slate-300">
                  {member.status}
                </span>
              </div>

              <div className="text-xs text-slate-400 space-y-1">
                <div>
                  <span className="text-slate-500 font-medium">Domain: </span>
                  <span className="text-slate-300">{member.focus}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Current Focus: </span>
                  <span className="text-slate-300">{member.recentTask}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex justify-end">
                <button
                  onClick={() => {
                    onDispatchTask(member);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Assign Directive via Maya</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
