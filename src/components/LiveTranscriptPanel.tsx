import React, { useState, useRef, useEffect } from 'react';
import { Volume2, Copy, Check, ExternalLink, Globe, Sparkles, Download, Trash2, Radio } from 'lucide-react';
import { ChatMessage, LiveSessionState } from '../types';

interface LiveTranscriptPanelProps {
  messages: ChatMessage[];
  sessionState: LiveSessionState;
  onReplayAudio: (text: string) => void;
  onClearHistory: () => void;
}

export const LiveTranscriptPanel: React.FC<LiveTranscriptPanelProps> = ({
  messages,
  sessionState,
  onReplayAudio,
  onClearHistory,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExport = () => {
    if (messages.length === 0) return;
    const lines = messages.map(
      (m) => `[${m.timestamp}] ${m.sender.toUpperCase()} (${m.mode}):\n${m.text}\n`
    );
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `maya_session_transcript_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="w-full lg:w-96 xl:w-[420px] h-full flex flex-col bg-[#070a12] border-t lg:border-t-0 lg:border-l border-slate-800/80">
      {/* Transcript Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-[#090e18]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
          <h2 className="text-xs font-mono font-bold text-slate-200 tracking-wider uppercase">
            LIVE TRANSCRIPT FEED
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExport}
            title="Download Transcript"
            className="p-1 rounded text-slate-400 hover:text-[#00E5FF] transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClearHistory}
            title="Clear History"
            className="p-1 rounded text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 select-text">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 font-mono text-xs">
            <Radio className="w-8 h-8 text-slate-700 mb-2 animate-pulse" />
            <span>NO ACTIVE TRANSCRIPT TURNS</span>
            <span className="text-[10px] text-slate-600 mt-1">
              Start a live voice conversation or send a prompt to begin
            </span>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSirius = msg.sender === 'sirius';

            return (
              <div
                key={`${msg.id || 'msg'}-${index}`}
                className={`p-3 rounded-xl border text-xs leading-relaxed transition-all ${
                  isSirius
                    ? 'bg-[#0e1626] border-[#00E5FF]/30 text-slate-100 ml-3'
                    : 'bg-[#090d16] border-slate-800 text-slate-200 mr-3'
                }`}
              >
                {/* Header (unboxed text) */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5 border-b border-slate-800/50 pb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold ${isSirius ? 'text-[#00E5FF]' : 'text-[#FF0077]'}`}>
                      {isSirius ? 'SIRIUS' : 'MAYA'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{msg.mode}</span>
                  </div>
                  <span>{msg.timestamp}</span>
                </div>

                {/* Content */}
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Google Search Grounding Sources (if used) */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1 bg-[#05080e] p-2 rounded-lg">
                    <div className="flex items-center gap-1 text-[10px] font-mono text-[#00E5FF] font-semibold">
                      <Globe className="w-3 h-3" />
                      <span>SOURCES (SEARCH GROUNDING)</span>
                    </div>
                    <div className="space-y-1">
                      {msg.sources.map((src, sIdx) => (
                        <a
                          key={sIdx}
                          href={src.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] text-cyan-300 hover:text-cyan-200 hover:underline truncate"
                        >
                          <ExternalLink className="w-3 h-3 shrink-0" />
                          <span className="truncate">{src.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action footer */}
                <div className="mt-2 flex items-center justify-end gap-2 pt-1">
                  {!isSirius && (
                    <button
                      onClick={() => onReplayAudio(msg.text)}
                      title="Speak"
                      className="p-1 rounded text-slate-400 hover:text-[#00E5FF] transition-colors cursor-pointer"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={() => handleCopy(msg.id, msg.text)}
                    title="Copy text"
                    className="p-1 rounded text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copiedId === msg.id ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Live Audio Activity Ticker */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-[#060910] text-[10px] font-mono text-slate-500 flex items-center justify-between">
        <span>SESSION: {sessionState}</span>
        <span className="text-[#00E5FF]">AXIOM CORE // GEMINI LIVE 3.8</span>
      </div>
    </aside>
  );
};
