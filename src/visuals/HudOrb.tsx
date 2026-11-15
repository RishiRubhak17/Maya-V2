import React, { useEffect, useRef } from 'react';
import { MayaEmotion, EMOTION_MAP } from '../emotion/types';

interface HudOrbProps {
  emotion: MayaEmotion;
  intensity: number; // 0 - 100
  audioLevel: number; // 0.0 - 1.0 real RMS level
  liveState: 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';
  onClick: () => void;
  isArmed: boolean;
}

export const HudOrb: React.FC<HudOrbProps> = ({
  emotion,
  intensity,
  audioLevel,
  liveState,
  onClick,
  isArmed,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;

      // Emotion profile parameters
      const profile = EMOTION_MAP[emotion] || EMOTION_MAP.calm;
      const baseRadius = emotion === 'shy' ? 28 : emotion === 'sleepy' ? 30 : 36;
      const speed = profile.speed * (emotion === 'excited' ? 0.045 : emotion === 'sleepy' ? 0.01 : 0.025);
      time += speed;

      const normIntensity = intensity / 100;
      const reactiveLevel = Math.max(0, audioLevel * 1.8);

      // Compute dynamic breath and wobble
      let breath = Math.sin(time) * (4 + normIntensity * 6);
      if (emotion === 'calm') {
        breath = Math.sin(time * 0.7) * 4; // 4s slow breath
      } else if (emotion === 'happy') {
        breath = Math.abs(Math.sin(time * 1.2)) * 6;
      } else if (emotion === 'annoyed') {
        breath = Math.sin(time * 3) * (2 + Math.random() * 2); // jitter
      }

      const currentRadius = baseRadius + breath + reactiveLevel * 18;

      // Color from CSS variable
      const computedStyle = getComputedStyle(document.documentElement);
      const accent = computedStyle.getPropertyValue('--accent').trim() || profile.color;

      // Outer soft glow aura
      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        currentRadius * 0.3,
        centerX,
        centerY,
        currentRadius * 1.9
      );

      const glowOpacity = Math.min(
        0.28,
        (emotion === 'shy' ? 0.08 : 0.16) + normIntensity * 0.12 + reactiveLevel * 0.2
      );

      gradient.addColorStop(0, profile.glowRgba(glowOpacity));
      gradient.addColorStop(0.6, profile.glowRgba(glowOpacity * 0.4));
      gradient.addColorStop(1, 'rgba(7, 7, 8, 0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius * 1.9, 0, Math.PI * 2);
      ctx.fill();

      // Audio-reactive undulating waveform ring
      const numPoints = 64;
      ctx.beginPath();

      for (let i = 0; i < numPoints; i++) {
        const theta = (i / numPoints) * Math.PI * 2;
        // Harmonic noise based on audio and state
        const wave1 = Math.sin(theta * 4 + time * 2) * (2 + reactiveLevel * 10);
        const wave2 = Math.cos(theta * 7 - time * 3) * (1.5 + reactiveLevel * 6);
        const r = currentRadius + wave1 + wave2;

        const x = centerX + Math.cos(theta) * r;
        const y = centerY + Math.sin(theta) * r;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.closePath();
      ctx.strokeStyle = accent;
      ctx.lineWidth = emotion === 'serious' ? 2 : 1.5;
      ctx.stroke();

      // Inner tactical core
      ctx.beginPath();
      ctx.arc(centerX, centerY, currentRadius * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = '#0d0d0f';
      ctx.fill();
      ctx.strokeStyle = profile.glowRgba(0.3);
      ctx.lineWidth = 1;
      ctx.stroke();

      // Rotating dashed ring
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(time * 0.5);
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, currentRadius * 0.85, 0, Math.PI * 2);
      ctx.strokeStyle = profile.glowRgba(0.4);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // Center state dot or live indicator
      ctx.beginPath();
      const dotRadius = liveState === 'SPEAKING' ? 6 + reactiveLevel * 8 : liveState === 'LISTENING' ? 5 : 3.5;
      ctx.arc(centerX, centerY, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [emotion, intensity, audioLevel, liveState]);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      title="Click or press SPACE to toggle Maya voice session"
      className="relative flex flex-col items-center justify-center cursor-pointer group select-none transition-transform active:scale-95"
    >
      <canvas
        ref={canvasRef}
        width={140}
        height={140}
        className="w-[140px] h-[140px] block filter drop-shadow-md group-hover:brightness-110"
      />
      <div className="absolute bottom-1 flex items-center gap-1.5 px-2 py-0.5 rounded-xs bg-[#09090b]/80 border border-[#2e2e31] text-[10px] font-hud tracking-wider text-[#cfcfca]">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            liveState === 'SPEAKING'
              ? 'bg-[var(--accent)] animate-ping'
              : liveState === 'LISTENING'
              ? 'bg-[var(--accent)] animate-pulse'
              : liveState === 'THINKING'
              ? 'bg-[#e6c27a] animate-spin'
              : isArmed
              ? 'bg-[var(--accent)]'
              : 'bg-[#6d6d69]'
          }`}
        />
        <span>{liveState !== 'IDLE' ? liveState : isArmed ? 'ARMED' : 'STANDBY'}</span>
      </div>
    </div>
  );
};
