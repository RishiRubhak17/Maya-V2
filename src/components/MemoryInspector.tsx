import React, { useState } from 'react';
import { X, Trash2, Plus, BrainCircuit, ShieldAlert } from 'lucide-react';
import { MemoryItem } from '../types';

interface MemoryInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  memories: MemoryItem[];
  onAddMemory: (key: string, value: string, category: MemoryItem['category']) => void;
  onDeleteMemory: (id: string) => void;
}

export const MemoryInspector: React.FC<MemoryInspectorProps> = ({
  isOpen,
  onClose,
  memories,
  onAddMemory,
  onDeleteMemory,
}) => {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [category, setCategory] = useState<MemoryItem['category']>('preference');
  const [isAdding, setIsAdding] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim() || !newValue.trim()) return;
    onAddMemory(newKey.trim(), newValue.trim(), category);
    setNewKey('');
    setNewValue('');
    setIsAdding(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-xl h-full bg-[#0b0e17] border-l border-slate-800 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#0e121d]">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
              <h2 className="text-base font-bold text-slate-100">
                Maya Memory Bank & Directives
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Persistent preferences, project boundaries, and stored context for Sirius
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="p-4 border-b border-slate-800 bg-[#0d101a] flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            {memories.length} Retained Directives
          </span>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 border border-emerald-800/60 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAdding ? 'Cancel' : 'Teach Directive'}</span>
          </button>
        </div>

        {/* Add Memory Form */}
        {isAdding && (
          <form onSubmit={handleSave} className="p-4 border-b border-slate-800 bg-[#121624] space-y-3">
            <h4 className="text-xs font-semibold text-slate-200">Record New Permanent Memory</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Directive Key</label>
                <input
                  type="text"
                  placeholder="e.g. offensive_tool_limit"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="preference">Preference</option>
                  <option value="project">Project</option>
                  <option value="team">Team</option>
                  <option value="security">Security</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Directive Value</label>
              <textarea
                placeholder="Describe what Maya must remember or adhere to..."
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                rows={2}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              className="w-full py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors cursor-pointer"
            >
              Commit to Maya Memory
            </button>
          </form>
        )}

        {/* Memory Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {memories.map((mem) => (
            <div
              key={mem.id}
              className="p-3.5 rounded-xl bg-[#111624] border border-slate-800 hover:border-slate-700 transition-all space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-xs font-mono font-semibold text-purple-300">
                    {mem.key}
                  </span>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Category: {mem.category}
                  </div>
                </div>
                <button
                  onClick={() => onDeleteMemory(mem.id)}
                  title="Forget this"
                  className="flex items-center gap-1 text-[11px] font-mono text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-2 py-1 rounded transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Forget this</span>
                </button>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-[#0b0e17] p-2.5 rounded border border-slate-800/80">
                {mem.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
