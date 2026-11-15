import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, Volume2, VolumeX, Sparkles, CornerDownLeft } from 'lucide-react';
import { MayaMode } from '../types';

interface CommandDockProps {
  onSendMessage: (message: string) => void;
  isListening: boolean;
  onToggleMic: () => void;
  recognitionSupported: boolean;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  currentMode: MayaMode;
  isGenerating: boolean;
  activeProjectName?: string;
  onClearActiveProject?: () => void;
}

export const CommandDock: React.FC<CommandDockProps> = ({
  onSendMessage,
  isListening,
  onToggleMic,
  recognitionSupported,
  audioEnabled,
  onToggleAudio,
  currentMode,
  isGenerating,
  activeProjectName,
  onClearActiveProject,
}) => {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() || isGenerating) return;
    onSendMessage(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <footer className="sticky bottom-0 z-20 bg-[#090a0f]/95 backdrop-blur-md border-t border-slate-800/80 p-3 lg:px-8 pb-4">
      <div className="max-w-4xl mx-auto space-y-2">
        {/* Active Project Ribbon (if focused) */}
        {activeProjectName && (
          <div className="flex items-center justify-between px-3 py-1 bg-cyan-950/40 border border-cyan-800/50 rounded-lg text-xs font-mono text-cyan-300">
            <span>Focused Pipeline: {activeProjectName}</span>
            {onClearActiveProject && (
              <button
                onClick={onClearActiveProject}
                className="hover:text-white underline cursor-pointer text-[11px]"
              >
                Clear Focus
              </button>
            )}
          </div>
        )}

        {/* Input Bar */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 bg-[#0e121d] border border-slate-700/80 rounded-xl p-1.5 focus-within:border-emerald-500/80 transition-colors shadow-lg"
        >
          {/* Mode Pill Indicator */}
          <div className="hidden sm:flex items-center px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-400 shrink-0">
            {currentMode}
          </div>

          {/* Voice Input Button */}
          {recognitionSupported && (
            <button
              type="button"
              onClick={onToggleMic}
              title={isListening ? 'Stop listening' : 'Start voice input (Speech to Text)'}
              className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-all cursor-pointer ${
                isListening
                  ? 'bg-cyan-500 text-slate-950 animate-pulse shadow-[0_0_12px_rgba(6,182,212,0.8)]'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
          )}

          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            placeholder={
              isListening
                ? 'Listening to Sirius... Speak now.'
                : `Enter command or ask Maya in ${currentMode} mode...`
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
            className="flex-1 bg-transparent px-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none min-h-[44px]"
          />

          {/* Audio Output Toggle */}
          <button
            type="button"
            onClick={onToggleAudio}
            title={audioEnabled ? 'Voice playback enabled' : 'Voice playback muted'}
            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
              audioEnabled
                ? 'text-emerald-400 hover:bg-slate-800/80'
                : 'text-slate-500 hover:bg-slate-800/80'
            }`}
          >
            {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Send Action Trigger */}
          <button
            type="submit"
            disabled={!text.trim() || isGenerating}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-30 disabled:hover:bg-emerald-500 text-slate-950 font-bold transition-all shadow-sm cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Tactical Shortcuts Ribbon */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="shrink-0">Shortcuts:</span>
            <button
              onClick={() => onSendMessage('Maya, brief mode')}
              className="hover:text-slate-300 transition-colors shrink-0 cursor-pointer"
            >
              [Brief]
            </button>
            <button
              onClick={() => onSendMessage('Maya, sentinel mode')}
              className="hover:text-slate-300 transition-colors shrink-0 cursor-pointer"
            >
              [Sentinel]
            </button>
            <button
              onClick={() => onSendMessage('Maya, builder mode')}
              className="hover:text-slate-300 transition-colors shrink-0 cursor-pointer"
            >
              [Builder]
            </button>
            <button
              onClick={() => onSendMessage('Maya, chill mode')}
              className="hover:text-slate-300 transition-colors shrink-0 cursor-pointer"
            >
              [Chill]
            </button>
          </div>
          <span className="hidden sm:inline">Press Enter to send</span>
        </div>
      </div>
    </footer>
  );
};
