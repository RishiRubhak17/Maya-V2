import React, { useEffect, useRef } from 'react';
import { MayaEmotion } from '../emotion/types';

interface DottedGlobeProps {
  emotion: MayaEmotion;
  isOnline: boolean;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

interface ArcPoint {
  from: Point3D;
  to: Point3D;
  progress: number;
  speed: number;
}

export const DottedGlobe: React.FC<DottedGlobeProps> = ({ emotion, isOnline }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angleY = 0;
    const numPoints = 280;
    const points: Point3D[] = [];

    // Golden spiral (Fibonacci sphere)
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < numPoints; i++) {
      const y = 1 - (i / (numPoints - 1)) * 2; // -1 to 1
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;
      const x = Math.cos(theta) * radiusAtY;
      const z = Math.sin(theta) * radiusAtY;
      points.push({ x, y, z });
    }

    // Dynamic arcs between points
    const arcs: ArcPoint[] = [
      { from: points[15], to: points[120], progress: 0, speed: 0.008 },
      { from: points[80], to: points[200], progress: 0.4, speed: 0.006 },
      { from: points[140], to: points[260], progress: 0.7, speed: 0.01 },
    ];

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const sphereRadius = Math.min(width, height) * 0.42;

      // Read accent color from root CSS variable
      const computedStyle = getComputedStyle(document.documentElement);
      const accent = computedStyle.getPropertyValue('--accent').trim() || '#d6d3cc';

      angleY += 0.007;

      // Draw faint globe outline
      ctx.beginPath();
      ctx.arc(centerX, centerY, sphereRadius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Transform and sort points by Z for depth
      const rotatedPoints = points.map((p) => {
        const cos = Math.cos(angleY);
        const sin = Math.sin(angleY);
        const rx = p.x * cos - p.z * sin;
        const rz = p.x * sin + p.z * cos;
        return { x: rx, y: p.y, z: rz };
      });

      // Draw connection arcs
      arcs.forEach((arc) => {
        arc.progress = (arc.progress + arc.speed) % 1;
        const cos = Math.cos(angleY);
        const sin = Math.sin(angleY);

        const fx = arc.from.x * cos - arc.from.z * sin;
        const fz = arc.from.x * sin + arc.from.z * cos;
        const tx = arc.to.x * cos - arc.to.z * sin;
        const tz = arc.to.x * sin + arc.to.z * cos;

        if (fz > -0.2 && tz > -0.2) {
          const sx = centerX + fx * sphereRadius;
          const sy = centerY + arc.from.y * sphereRadius;
          const ex = centerX + tx * sphereRadius;
          const ey = centerY + arc.to.y * sphereRadius;

          ctx.beginPath();
          ctx.moveTo(sx, sy);
          const mx = (sx + ex) / 2;
          const my = (sy + ey) / 2 - 12;
          ctx.quadraticCurveTo(mx, my, ex, ey);
          ctx.strokeStyle = `rgba(214, 211, 204, 0.15)`;
          ctx.lineWidth = 1;
          ctx.stroke();

          // Arc traveling dot
          const t = arc.progress;
          const dotX = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * ex;
          const dotY = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * my + t * t * ey;

          ctx.beginPath();
          ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
          ctx.fillStyle = accent;
          ctx.fill();
        }
      });

      // Render dots
      rotatedPoints.forEach((p, idx) => {
        // Perspective projection
        const alpha = Math.max(0.08, (p.z + 1) / 2);
        const size = Math.max(0.8, (p.z + 1.2) * 1.3);

        const screenX = centerX + p.x * sphereRadius;
        const screenY = centerY + p.y * sphereRadius;

        ctx.beginPath();
        ctx.arc(screenX, screenY, size, 0, Math.PI * 2);

        if (p.z > 0.4) {
          ctx.fillStyle = accent;
          ctx.globalAlpha = Math.min(1, alpha * 0.9);
        } else {
          ctx.fillStyle = '#6d6d69';
          ctx.globalAlpha = alpha * 0.4;
        }

        // Tiny playful sparkles
        if (emotion === 'playful' && idx % 19 === 0) {
          ctx.fillStyle = '#d98fa0';
          ctx.globalAlpha = 0.9;
        }

        ctx.fill();
        ctx.globalAlpha = 1.0;
      });

      // Offline overlay
      if (!isOnline) {
        ctx.fillStyle = 'rgba(7, 7, 8, 0.75)';
        ctx.fillRect(0, 0, width, height);

        ctx.font = '700 13px Rajdhani';
        ctx.fillStyle = '#c4524f';
        ctx.textAlign = 'center';
        ctx.fillText('NETWORK OFFLINE // STANDBY', centerX, centerY);
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [emotion, isOnline]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        width={220}
        height={180}
        className="w-full h-full max-h-[190px] block"
      />
    </div>
  );
};
