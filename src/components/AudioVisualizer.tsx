import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  isSpeaking: boolean;
  isListening: boolean;
  audioEnabled: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isSpeaking,
  isListening,
  audioEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const render = () => {
      phase += 0.08;
      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      const numBars = 36;
      const barWidth = Math.floor(width / numBars) - 2;

      for (let i = 0; i < numBars; i++) {
        const x = i * (barWidth + 2);
        let amplitude = 4; // idle baseline

        if (isSpeaking) {
          // Dynamic harmonic wave simulation for Maya speaking
          amplitude = Math.abs(
            Math.sin(phase + i * 0.3) * 18 +
            Math.cos(phase * 1.5 + i * 0.2) * 10 +
            Math.sin(phase * 0.5) * 6
          );
        } else if (isListening) {
          // Reacting to Sirius's voice input
          amplitude = Math.abs(
            Math.sin(phase * 2 + i * 0.4) * 22 +
            Math.cos(phase * 0.8) * 8
          );
        } else if (audioEnabled) {
          // Subtle resting heartbeat
          amplitude = 3 + Math.sin(phase * 0.4 + i * 0.15) * 2;
        }

        const barHeight = Math.min(height - 4, Math.max(3, amplitude));
        const y = (height - barHeight) / 2;

        // Color coding based on status
        if (isListening) {
          // Cyan for voice input
          ctx.fillStyle = i % 2 === 0 ? '#38bdf8' : '#0284c7';
        } else if (isSpeaking) {
          // Emerald for Maya voice output
          ctx.fillStyle = i % 2 === 0 ? '#34d399' : '#059669';
        } else {
          // Muted carbon green
          ctx.fillStyle = '#1e293b';
        }

        ctx.fillRect(x, y, barWidth, barHeight);
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isSpeaking, isListening, audioEnabled]);

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#0e121b] border border-slate-800/80">
      <div className="flex flex-col text-[11px] leading-tight">
        <span className="font-mono text-slate-400">
          {isListening ? 'VOICE IN' : isSpeaking ? 'MAYA AUDIO' : 'AUDIO CORE'}
        </span>
        <span className={`font-mono text-[9px] ${isListening ? 'text-cyan-400' : isSpeaking ? 'text-emerald-400' : 'text-slate-600'}`}>
          {isListening ? 'TRANSCRIBING' : isSpeaking ? 'SYNTHESIZING' : audioEnabled ? 'ONLINE' : 'MUTED'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={130}
        height={26}
        className="block rounded opacity-90"
      />
    </div>
  );
};
