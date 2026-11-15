import React, { useState } from 'react';
import { Volume2, VolumeX, Copy, Check, Terminal, Code2, ShieldAlert, FileText, Coffee, Sparkles } from 'lucide-react';
import { ChatMessage, MayaMode } from '../types';

interface ChatFeedProps {
  messages: ChatMessage[];
  isMayaGenerating: boolean;
  onReplayAudio: (text: string) => void;
  onTriggerActionConfirmation?: (actionText: string) => void;
  onQuickPrompt: (prompt: string, mode?: MayaMode) => void;
}

export const ChatFeed: React.FC<ChatFeedProps> = ({
  messages,
  isMayaGenerating,
  onReplayAudio,
  onQuickPrompt,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getModeIcon = (mode: MayaMode) => {
    switch (mode) {
      case 'BUILDER':
        return Code2;
      case 'SENTINEL':
        return ShieldAlert;
      case 'BRIEF':
        return FileText;
      case 'CHILL':
        return Coffee;
      default:
        return Terminal;
    }
  };

  const formatText = (text: string) => {
    // If text contains code blocks or markdown headers, format nicely
    const parts = text.split(/(```[\s\S]*?```)/g);
    return parts.map((part, index) => {
      if (part.startsWith('```')) {
        const lines = part.slice(3, -3).trim().split('\n');
        const lang = lines[0].match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : '';
        const codeContent = lang ? lines.slice(1).join('\n') : lines.join('\n');

        return (
          <div key={index} className="my-2.5 rounded-xl bg-[#090b10] border border-slate-800 overflow-hidden font-mono text-xs">
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#0e121a] border-b border-slate-800 text-[11px] text-slate-400">
              <span>{lang ? lang.toUpperCase() : 'CODE BLOCK'}</span>
              <button
                onClick={() => handleCopy(`block-${index}`, codeContent)}
                className="flex items-center gap-1 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                {copiedId === `block-${index}` ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 overflow-x-auto text-emerald-300/90 leading-relaxed font-mono">
              <code>{codeContent}</code>
            </pre>
          </div>
        );
      }

      // Normal text with bold support
      return (
        <span key={index} className="whitespace-pre-wrap leading-relaxed">
          {part.split(/(\*\*.*?\*\*)/g).map((chunk, cIdx) => {
            if (chunk.startsWith('**') && chunk.endsWith('**')) {
              return (
                <strong key={cIdx} className="font-semibold text-slate-100">
                  {chunk.slice(2, -2)}
                </strong>
              );
            }
            return chunk;
          })}
        </span>
      );
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 lg:px-8 py-6 space-y-5">
      {messages.length === 0 ? (
        <div className="max-w-3xl mx-auto py-10 space-y-6">
          <div className="p-6 rounded-2xl bg-[#0d1017] border border-slate-800/80 space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
              <h2 className="text-base font-bold text-slate-100">
                Axiom Intelligence Systems Online // Maya
              </h2>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Vanakkam, Sirius. Personal executive assistant initialized for Axiom Secure Crafts. Five operational protocols active (Command, Builder, Sentinel, Brief, Chill).
            </p>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-mono text-slate-500 block uppercase tracking-wider">
              Tactical Quick Directives //
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => onQuickPrompt('Good morning briefing, Maya. What are the key deadlines today?', 'BRIEF')}
                className="p-3 text-left rounded-xl bg-[#111520] hover:bg-[#161c2c] border border-slate-800/80 hover:border-cyan-500/40 transition-all text-xs text-slate-300 cursor-pointer"
              >
                <div className="font-semibold text-cyan-300 mb-0.5 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Morning Tactical Brief</span>
                </div>
                Deadlines, workshop prep, and today's top priority
              </button>

              <button
                onClick={() => onQuickPrompt('Generate a master prompt for AttendLink offline biometric kiosk in Lovable format.', 'BUILDER')}
                className="p-3 text-left rounded-xl bg-[#111520] hover:bg-[#161c2c] border border-slate-800/80 hover:border-emerald-500/40 transition-all text-xs text-slate-300 cursor-pointer"
              >
                <div className="font-semibold text-emerald-300 mb-0.5 flex items-center gap-1.5">
                  <Code2 className="w-3.5 h-3.5" />
                  <span>AttendLink Master Prompt</span>
                </div>
                Lovable / Bolt.new prompt with full offline architecture
              </button>

              <button
                onClick={() => onQuickPrompt('Run a Sentinel defensive perimeter audit on ScantriX lab scopes.', 'SENTINEL')}
                className="p-3 text-left rounded-xl bg-[#111520] hover:bg-[#161c2c] border border-slate-800/80 hover:border-rose-500/40 transition-all text-xs text-slate-300 cursor-pointer"
              >
                <div className="font-semibold text-rose-300 mb-0.5 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Sentinel Security Audit</span>
                </div>
                Authorized boundaries, lab sandboxes, ethical limits
              </button>

              <button
                onClick={() => onQuickPrompt('Maya, chill mode. How are the Bishop Heber semester labs looking?', 'CHILL')}
                className="p-3 text-left rounded-xl bg-[#111520] hover:bg-[#161c2c] border border-slate-800/80 hover:border-indigo-500/40 transition-all text-xs text-slate-300 cursor-pointer"
              >
                <div className="font-semibold text-indigo-300 mb-0.5 flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Executive Check-in</span>
                </div>
                College workload balance and ASC strategy
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg, index) => {
            const isSirius = msg.sender === 'sirius';
            const ModeIcon = getModeIcon(msg.mode);

            return (
              <div
                key={`${msg.id || 'msg'}-${index}`}
                className={`flex flex-col ${isSirius ? 'items-end' : 'items-start'} transition-all`}
              >
                {/* Message Container */}
                <div
                  className={`max-w-2xl lg:max-w-3xl rounded-2xl p-4 transition-all text-xs sm:text-sm ${
                    isSirius
                      ? 'bg-[#141b2a] border border-cyan-500/30 text-slate-100 rounded-tr-sm'
                      : 'bg-[#0f131d] border border-slate-800/90 text-slate-200 rounded-tl-sm shadow-md'
                  }`}
                >
                  {/* Message Header (Unboxed metadata) */}
                  <div className="flex items-center justify-between gap-3 mb-2 text-[11px] font-mono text-slate-400 border-b border-slate-800/50 pb-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${isSirius ? 'text-cyan-400' : 'text-emerald-400'}`}>
                        {isSirius ? 'SIRIUS' : 'MAYA // AXIOM'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <div className="flex items-center gap-1 text-slate-400">
                        <ModeIcon className="w-3 h-3" />
                        <span>{msg.mode}</span>
                      </div>
                    </div>
                    <span>{msg.timestamp}</span>
                  </div>

                  {/* Body Text */}
                  <div className="leading-relaxed">
                    {formatText(msg.text)}
                  </div>

                  {/* Footer Bar for Maya messages */}
                  {!isSirius && (
                    <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onReplayAudio(msg.text)}
                          title="Speak reply"
                          className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-emerald-400 transition-colors p-1 rounded cursor-pointer"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Voice</span>
                        </button>
                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          title="Copy text"
                          className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-cyan-400 transition-colors p-1 rounded cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>

                      {msg.mode === 'BUILDER' && (
                        <span className="text-[10px] font-mono text-cyan-400/80">
                          Ready for Lovable / v0 / Bolt
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Generating Indicator */}
          {isMayaGenerating && (
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 p-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>MAYA synthesizing response...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
