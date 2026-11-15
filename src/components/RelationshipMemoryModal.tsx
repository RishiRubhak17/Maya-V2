import React, { useState } from 'react';
import { X, Trash2, Plus, Heart, Shield, Sparkles, Check, AlertTriangle } from 'lucide-react';
import { relationshipMemoryStore } from '../proactive/relationshipMemoryStore';
import { RelationshipMemory } from '../proactive/types';

interface RelationshipMemoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLog?: (msg: string) => void;
}

export const RelationshipMemoryModal: React.FC<RelationshipMemoryModalProps> = ({
  isOpen,
  onClose,
  onLog,
}) => {
  const [memory, setMemory] = useState<RelationshipMemory>(() => relationshipMemoryStore.getMemory());
  const [forgetQuery, setForgetQuery] = useState('');
  const [forgetStatus, setForgetStatus] = useState<string | null>(null);

  const [newNickname, setNewNickname] = useState('');
  const [newJoke, setNewJoke] = useState('');
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [newMilestoneNote, setNewMilestoneNote] = useState('');
  const [confirmWipe, setConfirmWipe] = useState(false);

  if (!isOpen) return null;

  const refreshMemory = () => {
    setMemory(relationshipMemoryStore.getMemory());
  };

  const handleToggleApproval = () => {
    const updated = { ...memory, approved: !memory.approved };
    setMemory(updated);
    if (!updated.approved) {
      onLog?.('RELATIONSHIP MEMORY: Disabled by Sirius. No memories will be recorded.');
    } else {
      onLog?.('RELATIONSHIP MEMORY: Enabled by Sirius. Local-only encrypted context active.');
    }
    relationshipMemoryStore.saveMemory();
  };

  const handleAddNickname = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNickname.trim()) return;
    relationshipMemoryStore.addNickname(newNickname.trim());
    setNewNickname('');
    refreshMemory();
    onLog?.(`MEMORY: Added nickname "${newNickname.trim()}".`);
  };

  const handleAddJoke = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJoke.trim()) return;
    relationshipMemoryStore.addInsideJoke(newJoke.trim());
    setNewJoke('');
    refreshMemory();
    onLog?.(`MEMORY: Added inside joke.`);
  };

  const handleAddMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMilestoneTitle.trim()) return;
    relationshipMemoryStore.addMilestone(newMilestoneTitle.trim(), newMilestoneNote.trim() || 'ASC Milestone');
    setNewMilestoneTitle('');
    setNewMilestoneNote('');
    refreshMemory();
    onLog?.(`MEMORY: Added milestone "${newMilestoneTitle.trim()}".`);
  };

  const handleForgetQuery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgetQuery.trim()) return;
    const found = relationshipMemoryStore.forgetItem(forgetQuery.trim());
    if (found) {
      setForgetStatus(`Forgotten: "${forgetQuery.trim()}" successfully removed.`);
      onLog?.(`MEMORY: "Forget that" executed for "${forgetQuery.trim()}".`);
      refreshMemory();
    } else {
      setForgetStatus(`No matching memory found for "${forgetQuery.trim()}".`);
    }
    setForgetQuery('');
    setTimeout(() => setForgetStatus(null), 3000);
  };

  const handleWipeEverything = () => {
    relationshipMemoryStore.wipeEverything();
    refreshMemory();
    setConfirmWipe(false);
    onLog?.('MEMORY: "Forget everything" executed. All relationship memories wiped clean.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 select-none">
      <div className="bg-[#0d0d0f] border border-[#2e2e31] max-w-2xl w-full p-5 font-mono text-xs flex flex-col gap-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2e2e31] pb-2">
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-[#e3a1b0]" />
            <span className="font-hud text-sm font-bold tracking-wider text-[#cfcfca]">
              MAYA RELATIONSHIP MEMORY // PRIVATE LOCAL CONTEXT
            </span>
          </div>
          <button onClick={onClose} className="text-[#6d6d69] hover:text-[#cfcfca] cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <p className="text-[11px] text-[#6d6d69]">
          Maya stores relationship memory locally in browser/desktop sandbox only with your approval:
          nicknames, inside jokes, proud milestones, and favorite aesthetics. Never mood histories or private logs.
        </p>

        {/* Approval Banner */}
        <div className="bg-[#09090b] border border-[#2e2e31] p-3 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="font-hud text-xs text-[#cfcfca] font-bold flex items-center gap-1.5">
              <Shield size={13} className="text-[var(--accent)]" />
              LOCAL MEMORY RETENTION STATUS
            </div>
            <div className="text-[10px] text-[#6d6d69]">
              {memory.approved
                ? 'Authorized by Sirius. Maya personalizes tone and recalls milestones.'
                : 'Disabled. Maya will operate without persistent relationship context.'}
            </div>
          </div>
          <button
            onClick={handleToggleApproval}
            className={`px-3 py-1 font-hud text-[11px] font-bold cursor-pointer ${
              memory.approved ? 'bg-[var(--accent)] text-[#070708]' : 'bg-[#1a1a20] text-[#6d6d69]'
            }`}
          >
            {memory.approved ? 'AUTHORIZED' : 'OFF'}
          </button>
        </div>

        {/* 'Forget that' Quick Action */}
        <form onSubmit={handleForgetQuery} className="bg-[#09090b] border border-[#2e2e31] p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-hud text-xs text-[#cfcfca] font-bold">
              &quot;FORGET THAT&quot; DIRECTIVE
            </span>
            <span className="text-[9px] text-[#6d6d69]">Targeted memory redaction</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. coffee, ScantriX, specific nickname..."
              value={forgetQuery}
              onChange={(e) => setForgetQuery(e.target.value)}
              className="flex-1 bg-[#141418] border border-[#2e2e31] px-2.5 py-1 text-xs text-[#cfcfca] outline-hidden"
            />
            <button
              type="submit"
              className="px-3 py-1 bg-[#1a1a20] text-[#cfcfca] hover:bg-[#25252d] font-hud text-[11px] font-bold cursor-pointer"
            >
              FORGET
            </button>
          </div>
          {forgetStatus && <div className="text-[10px] text-[var(--accent)]">{forgetStatus}</div>}
        </form>

        {/* Memory Categories */}
        <div className="space-y-3 max-h-[45vh] overflow-y-auto no-scrollbar pr-1">
          {/* Nicknames */}
          <div className="bg-[#09090b] border border-[#2e2e31] p-3 space-y-2">
            <div className="flex items-center justify-between font-hud text-xs text-[#cfcfca] font-bold">
              <span>NICKNAMES FOR SIRIUS</span>
              <span className="text-[10px] text-[#6d6d69]">{memory.nicknames.length} registered</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {memory.nicknames.map((n) => (
                <span
                  key={n}
                  className="px-2 py-0.5 bg-[#141418] border border-[#2e2e31] text-[11px] text-[var(--accent)] flex items-center gap-1.5"
                >
                  {n}
                  <button
                    onClick={() => {
                      relationshipMemoryStore.forgetItem(n);
                      refreshMemory();
                    }}
                    className="text-[#6d6d69] hover:text-[#c4524f] cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <form onSubmit={handleAddNickname} className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="Add nickname..."
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                className="flex-1 bg-[#141418] border border-[#2e2e31] px-2 py-0.5 text-xs text-[#cfcfca] outline-hidden"
              />
              <button
                type="submit"
                className="px-2.5 py-0.5 bg-[#1a1a20] text-[#cfcfca] hover:bg-[#25252d] font-hud text-[10px] font-bold cursor-pointer"
              >
                + ADD
              </button>
            </form>
          </div>

          {/* Milestones */}
          <div className="bg-[#09090b] border border-[#2e2e31] p-3 space-y-2">
            <div className="flex items-center justify-between font-hud text-xs text-[#cfcfca] font-bold">
              <span>PROUD MILESTONES & WINS</span>
              <span className="text-[10px] text-[#6d6d69]">{memory.milestones.length} logged</span>
            </div>
            <div className="space-y-1.5">
              {memory.milestones.map((m) => (
                <div
                  key={m.id}
                  className="p-2 bg-[#141418] border border-[#2e2e31] flex justify-between items-start gap-2"
                >
                  <div>
                    <div className="text-[11px] text-[#cfcfca] font-bold">{m.title}</div>
                    <div className="text-[10px] text-[#6d6d69]">{m.note}</div>
                  </div>
                  <button
                    onClick={() => {
                      relationshipMemoryStore.forgetItem(m.title);
                      refreshMemory();
                    }}
                    className="text-[#6d6d69] hover:text-[#c4524f] cursor-pointer text-[10px]"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddMilestone} className="grid grid-cols-3 gap-1.5 pt-1">
              <input
                type="text"
                placeholder="Milestone title..."
                value={newMilestoneTitle}
                onChange={(e) => setNewMilestoneTitle(e.target.value)}
                className="col-span-1 bg-[#141418] border border-[#2e2e31] px-2 py-0.5 text-xs text-[#cfcfca] outline-hidden"
              />
              <input
                type="text"
                placeholder="Details / note..."
                value={newMilestoneNote}
                onChange={(e) => setNewMilestoneNote(e.target.value)}
                className="col-span-1 bg-[#141418] border border-[#2e2e31] px-2 py-0.5 text-xs text-[#cfcfca] outline-hidden"
              />
              <button
                type="submit"
                className="col-span-1 py-0.5 bg-[#1a1a20] text-[#cfcfca] hover:bg-[#25252d] font-hud text-[10px] font-bold cursor-pointer"
              >
                + ADD MILESTONE
              </button>
            </form>
          </div>

          {/* Inside Jokes */}
          <div className="bg-[#09090b] border border-[#2e2e31] p-3 space-y-2">
            <div className="flex items-center justify-between font-hud text-xs text-[#cfcfca] font-bold">
              <span>INSIDE JOKES & BANTER</span>
              <span className="text-[10px] text-[#6d6d69]">{memory.insideJokes.length} entries</span>
            </div>
            <div className="space-y-1">
              {memory.insideJokes.map((j, idx) => (
                <div
                  key={idx}
                  className="p-1.5 bg-[#141418] border border-[#2e2e31] flex justify-between items-center text-[11px] text-[#cfcfca]"
                >
                  <span className="italic">&quot;{j}&quot;</span>
                  <button
                    onClick={() => {
                      relationshipMemoryStore.forgetItem(j);
                      refreshMemory();
                    }}
                    className="text-[#6d6d69] hover:text-[#c4524f] cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
            <form onSubmit={handleAddJoke} className="flex gap-2 pt-1">
              <input
                type="text"
                placeholder="New inside joke..."
                value={newJoke}
                onChange={(e) => setNewJoke(e.target.value)}
                className="flex-1 bg-[#141418] border border-[#2e2e31] px-2 py-0.5 text-xs text-[#cfcfca] outline-hidden"
              />
              <button
                type="submit"
                className="px-2.5 py-0.5 bg-[#1a1a20] text-[#cfcfca] hover:bg-[#25252d] font-hud text-[10px] font-bold cursor-pointer"
              >
                + ADD JOKE
              </button>
            </form>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-[#2e2e31] flex justify-between items-center">
          <div>
            {!confirmWipe ? (
              <button
                onClick={() => setConfirmWipe(true)}
                className="px-3 py-1 text-[#c4524f] hover:bg-[#c4524f]/15 font-hud text-[11px] font-bold cursor-pointer border border-[#c4524f]/40"
              >
                [ FORGET EVERYTHING ]
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#c4524f]">Confirm full wipe?</span>
                <button
                  onClick={handleWipeEverything}
                  className="px-2.5 py-0.5 bg-[#c4524f] text-white font-hud text-[10px] font-bold cursor-pointer"
                >
                  YES, WIPE
                </button>
                <button
                  onClick={() => setConfirmWipe(false)}
                  className="px-2 py-0.5 bg-[#1a1a20] text-[#6d6d69] font-hud text-[10px] cursor-pointer"
                >
                  CANCEL
                </button>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-[var(--accent)] text-[#070708] font-hud text-xs font-bold cursor-pointer hover:brightness-110"
          >
            [ CLOSE MEMORY ]
          </button>
        </div>
      </div>
    </div>
  );
};
