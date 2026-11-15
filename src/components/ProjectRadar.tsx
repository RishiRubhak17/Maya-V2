import React, { useState } from 'react';
import { X, Search, ChevronRight, CheckCircle2, Shield, Code, Sparkles } from 'lucide-react';
import { AscProject } from '../types';

interface ProjectRadarProps {
  isOpen: boolean;
  onClose: () => void;
  projects: AscProject[];
  onSelectProjectForChat: (project: AscProject, intent: 'focus' | 'builder' | 'sentinel') => void;
}

export const ProjectRadar: React.FC<ProjectRadarProps> = ({
  isOpen,
  onClose,
  projects,
  onSelectProjectForChat,
}) => {
  const [filter, setFilter] = useState<string>('All');
  const [search, setSearch] = useState<string>('');

  if (!isOpen) return null;

  const categories = ['All', 'Attendance', 'IoT / Utilities', 'Web Portal', 'Security / CTF', 'AI / CV'];

  const filtered = projects.filter((p) => {
    const matchesCat = filter === 'All' || p.category === filter;
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.tagline.toLowerCase().includes(search.toLowerCase()) ||
      p.lead.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-2xl h-full bg-[#0b0e17] border-l border-slate-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0e121d]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              <h2 className="text-base font-bold text-slate-100">
                ASC Project Radar
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Active engineering pipelines and deadlines for Axiom Secure Crafts
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Controls */}
        <div className="p-4 border-b border-slate-800 space-y-3 bg-[#0d101a]">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search projects by name, lead, or keyword..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700/80 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/80"
            />
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                  filter === cat
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No matching projects in current radar scan.
            </div>
          ) : (
            filtered.map((proj) => (
              <div
                key={proj.id}
                className="p-4 rounded-xl bg-[#111624] border border-slate-800/80 hover:border-slate-700 transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <span>{proj.name}</span>
                    </h3>
                    <p className="text-xs text-slate-300 mt-0.5">{proj.tagline}</p>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-emerald-400 whitespace-nowrap">
                    {proj.status}
                  </span>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed">
                  {proj.description}
                </p>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Engineering Progress</span>
                    <span className="text-slate-200 tabular-nums">{proj.progressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full transition-all"
                      style={{ width: `${proj.progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Metadata - Zero Pill Discipline */}
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span>{proj.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>Lead: {proj.lead}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-400/90">Target: {proj.deadline}</span>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                  <button
                    onClick={() => {
                      onSelectProjectForChat(proj, 'focus');
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 rounded-lg transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Focus with Maya</span>
                  </button>

                  <button
                    onClick={() => {
                      onSelectProjectForChat(proj, 'builder');
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 rounded-lg transition-colors cursor-pointer"
                  >
                    <Code className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Generate Builder Prompt</span>
                  </button>

                  <button
                    onClick={() => {
                      onSelectProjectForChat(proj, 'sentinel');
                      onClose();
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-300 bg-rose-950/40 hover:bg-rose-900/40 border border-rose-900/50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Shield className="w-3.5 h-3.5 text-rose-400" />
                    <span>Security Audit</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
