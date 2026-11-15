import React, { useEffect, useRef } from 'react';

interface TrafficChartProps {
  audioInRate: number; // 0 - 100
  audioOutRate: number; // 0 - 100
  apiMessageRate: number; // 0 - 100
}

export const TrafficChart: React.FC<TrafficChartProps> = ({
  audioInRate,
  audioOutRate,
  apiMessageRate,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const historyRef = useRef<{
    audioIn: number[];
    audioOut: number[];
    api: number[];
  }>({
    audioIn: Array(24).fill(4),
    audioOut: Array(24).fill(2),
    api: Array(24).fill(1),
  });

  // Push new data every second
  useEffect(() => {
    const interval = setInterval(() => {
      const h = historyRef.current;
      h.audioIn.push(Math.min(100, Math.max(0, audioInRate)));
      h.audioOut.push(Math.min(100, Math.max(0, audioOutRate)));
      h.api.push(Math.min(100, Math.max(0, apiMessageRate)));

      if (h.audioIn.length > 24) h.audioIn.shift();
      if (h.audioOut.length > 24) h.audioOut.shift();
      if (h.api.length > 24) h.api.shift();
    }, 1000);

    return () => clearInterval(interval);
  }, [audioInRate, audioOutRate, apiMessageRate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Draw dotted grid lines
      ctx.setLineDash([2, 4]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;

      // Horizontal lines
      for (let y = 15; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Vertical lines
      for (let x = 10; x < width; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      ctx.setLineDash([]); // Reset line dash

      const drawSeries = (data: number[], strokeStyle: string, fillStyle: string) => {
        if (data.length < 2) return;
        const step = width / (data.length - 1);

        ctx.beginPath();
        ctx.moveTo(0, height - (data[0] / 100) * (height - 10));

        for (let i = 1; i < data.length; i++) {
          const x = i * step;
          const y = height - (data[i] / 100) * (height - 10) - 4;
          ctx.lineTo(x, y);
        }

        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Subtle gradient under line
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.fillStyle = fillStyle;
        ctx.fill();
      };

      const h = historyRef.current;

      // Read accent
      const computedStyle = getComputedStyle(document.documentElement);
      const accent = computedStyle.getPropertyValue('--accent').trim() || '#d6d3cc';

      // 1. Audio IN (Accent color)
      drawSeries(h.audioIn, accent, 'rgba(214, 211, 204, 0.04)');

      // 2. Audio OUT (Muted warm amber)
      drawSeries(h.audioOut, '#e6c27a', 'rgba(230, 194, 122, 0.03)');

      // 3. API message rate (Dim slate)
      drawSeries(h.api, '#6d6d69', 'transparent');

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="w-full flex flex-col gap-1">
      <div className="flex items-center justify-between text-[10px] text-[#6d6d69] font-hud tracking-wider">
        <span>TRAFFIC // I/O TELEMETRY</span>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" /> IN
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#e6c27a]" /> OUT
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6d6d69]" /> API
          </span>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={220}
        height={65}
        className="w-full h-[65px] bg-[#09090b] border border-[#2e2e31]/60"
      />
    </div>
  );
};
