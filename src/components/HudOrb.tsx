import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Sparkles, Radio, Zap, AlertCircle, ShieldCheck, Activity } from 'lucide-react';
import { LiveSessionState, MayaMode } from '../types';

interface HudOrbProps {
  sessionState: LiveSessionState;
  currentMode: MayaMode;
  audioLevel: number; // 0 to 1
  isConnected: boolean;
  onToggleSession: () => void;
  errorMessage: string | null;
  wakeWordListening: boolean;
  wakeWordPhrase: string;
  accentColor: string;
  analyserNode?: AnalyserNode | null;
  systemAccessGranted?: boolean;
}

export const HudOrb: React.FC<HudOrbProps> = ({
  sessionState,
  currentMode,
  audioLevel,
  isConnected: _isConnected,
  onToggleSession,
  errorMessage,
  wakeWordListening,
  wakeWordPhrase,
  accentColor,
  analyserNode,
  systemAccessGranted = true,
}) => {
  const orbCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Peak hold array for frequency bars
  const barPeaksRef = useRef<number[]>(new Array(24).fill(0));
  const [currentDecibel, setCurrentDecibel] = useState<number>(-48);
  const [dominantFrequency, setDominantFrequency] = useState<string>('IDLE');

  // Local fallback mic analyser for standalone visualizer if live session analyser is pending
  const localAudioCtxRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const [localMicActive, setLocalMicActive] = useState<boolean>(false);

  // Listen with local mic if user explicitly toggles spectrum without Gemini socket
  const toggleLocalSpectrum = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (localMicActive) {
      if (localAudioCtxRef.current) {
        localAudioCtxRef.current.close().catch(() => {});
        localAudioCtxRef.current = null;
      }
      localAnalyserRef.current = null;
      setLocalMicActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.8;
        src.connect(analyser);
        localAudioCtxRef.current = ctx;
        localAnalyserRef.current = analyser;
        setLocalMicActive(true);
      } catch (err) {
        console.warn('Could not start local spectrum analyser:', err);
      }
    }
  };

  // Main animation loop for both Orb and Frequency Spectrum Bars
  useEffect(() => {
    const orbCanvas = orbCanvasRef.current;
    const spectrumCanvas = spectrumCanvasRef.current;
    if (!orbCanvas || !spectrumCanvas) return;

    const orbCtx = orbCanvas.getContext('2d');
    const specCtx = spectrumCanvas.getContext('2d');
    if (!orbCtx || !specCtx) return;

    let animId: number;
    let angle = 0;
    let lastStatsUpdate = performance.now();

    // Active analyser is either passed in from Gemini Live or local mic
    const activeAnalyser = analyserNode || localAnalyserRef.current;
    const frequencyData = activeAnalyser
      ? new Uint8Array(activeAnalyser.frequencyBinCount)
      : null;

    const render = () => {
      angle += 0.02;
      const now = performance.now();

      // Read real-time frequency data if AnalyserNode is available
      let hasRealAudio = false;
      let avgLevel = 0;
      let maxVal = 0;
      let maxIndex = 0;

      if (activeAnalyser && frequencyData) {
        activeAnalyser.getByteFrequencyData(frequencyData);
        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
          sum += frequencyData[i];
          if (frequencyData[i] > maxVal) {
            maxVal = frequencyData[i];
            maxIndex = i;
          }
        }
        avgLevel = sum / frequencyData.length / 255;
        if (avgLevel > 0.02) hasRealAudio = true;
      }

      // Update decibels every 150ms
      if (now - lastStatsUpdate > 150) {
        lastStatsUpdate = now;
        if (hasRealAudio) {
          const db = Math.round(20 * Math.log10(Math.max(avgLevel, 0.001)));
          setCurrentDecibel(Math.min(0, Math.max(-60, db)));

          // Approximate frequency for 16kHz sample rate / 64 FFT (bin resolution ~250Hz)
          const approxHz = Math.round(maxIndex * 250);
          if (approxHz < 200) setDominantFrequency('LOW ~120Hz');
          else if (approxHz < 600) setDominantFrequency('VOICE ~340Hz');
          else if (approxHz < 2000) setDominantFrequency(`MID ~${approxHz}Hz`);
          else setDominantFrequency(`HIGH ~${approxHz}Hz`);
        } else if (sessionState === 'SPEAKING') {
          setCurrentDecibel(-12);
          setDominantFrequency('MAYA VOICE');
        } else {
          setCurrentDecibel(-54);
          setDominantFrequency(sessionState === 'LISTENING' ? 'LISTENING...' : 'STANDBY');
        }
      }

      // -------------------------------------------------------------
      // 1. RENDER CIRCULAR HUD ORB
      // -------------------------------------------------------------
      const orbW = orbCanvas.width;
      const orbH = orbCanvas.height;
      const cx = orbW / 2;
      const cy = orbH / 2;

      orbCtx.clearRect(0, 0, orbW, orbH);

      const dynamicLevel = hasRealAudio ? avgLevel : audioLevel;
      const pulse = 1 + dynamicLevel * 0.35;
      const baseR = 46;

      // Outer dashed reticle ring (clockwise)
      orbCtx.save();
      orbCtx.translate(cx, cy);
      orbCtx.rotate(angle * 0.4);
      orbCtx.strokeStyle = '#2e2e31';
      orbCtx.lineWidth = 1;
      orbCtx.setLineDash([8, 6, 2, 6]);
      orbCtx.beginPath();
      orbCtx.arc(0, 0, (baseR + 22) * pulse, 0, Math.PI * 2);
      orbCtx.stroke();

      // Corner accent tick marks
      for (let i = 0; i < 4; i++) {
        const theta = (i * Math.PI) / 2;
        const rx = Math.cos(theta) * (baseR + 24) * pulse;
        const ry = Math.sin(theta) * (baseR + 24) * pulse;
        orbCtx.fillStyle = accentColor;
        orbCtx.fillRect(rx - 2, ry - 2, 4, 4);
      }
      orbCtx.restore();

      // Middle counter-rotating ring
      orbCtx.save();
      orbCtx.translate(cx, cy);
      orbCtx.rotate(-angle * 0.6);
      orbCtx.strokeStyle = accentColor;
      orbCtx.globalAlpha = sessionState !== 'IDLE' ? 0.5 : 0.25;
      orbCtx.lineWidth = 1.2;
      orbCtx.setLineDash([12, 6, 3, 6]);
      orbCtx.beginPath();
      orbCtx.arc(0, 0, (baseR + 10) * pulse, 0, Math.PI * 2);
      orbCtx.stroke();
      orbCtx.restore();

      // Radial Audio Spikes linked to real Web Audio AnalyserNode frequency bins
      const totalSpikes = 32;
      for (let i = 0; i < totalSpikes; i++) {
        const theta = (i / totalSpikes) * Math.PI * 2 + angle * 0.2;
        let spikeLen = 2;

        if (sessionState === 'LISTENING') {
          if (frequencyData && frequencyData.length > 0) {
            // Map radial spike directly to frequency bin
            const binIdx = i % frequencyData.length;
            const normFreq = frequencyData[binIdx] / 255;
            spikeLen = 3 + normFreq * 26 + (Math.sin(angle * 4 + i) * 3);
          } else {
            spikeLen = 3 + Math.abs(Math.sin(angle * 4 + i * 0.5)) * 16 * (dynamicLevel + 0.3);
          }
        } else if (sessionState === 'SPEAKING') {
          spikeLen = 4 + Math.abs(Math.sin(angle * 5 + i * 0.6)) * 24 * (dynamicLevel + 0.5);
        } else if (sessionState === 'THINKING') {
          spikeLen = 3 + Math.sin(angle * 6 + i * 0.5) * 8;
        } else {
          spikeLen = 2 + Math.sin(angle * 1.5 + i * 0.4) * 3;
        }

        const rIn = baseR - 3;
        const rOut = rIn + spikeLen;

        const sx1 = cx + Math.cos(theta) * rIn;
        const sy1 = cy + Math.sin(theta) * rIn;
        const sx2 = cx + Math.cos(theta) * rOut;
        const sy2 = cy + Math.sin(theta) * rOut;

        orbCtx.strokeStyle = accentColor;
        orbCtx.globalAlpha = sessionState === 'IDLE' ? 0.25 : 0.9;
        orbCtx.lineWidth = 1.6;
        orbCtx.beginPath();
        orbCtx.moveTo(sx1, sy1);
        orbCtx.lineTo(sx2, sy2);
        orbCtx.stroke();
      }

      // Inner subtle breathing halo
      orbCtx.globalAlpha = sessionState === 'LISTENING' ? 0.18 : 0.08;
      orbCtx.fillStyle = accentColor;
      orbCtx.beginPath();
      orbCtx.arc(cx, cy, (baseR - 6) * pulse, 0, Math.PI * 2);
      orbCtx.fill();
      orbCtx.globalAlpha = 1.0;

      // -------------------------------------------------------------
      // 2. RENDER FREQUENCY VISUALIZER BARS (Web Audio AnalyserNode)
      // -------------------------------------------------------------
      const specW = spectrumCanvas.width;
      const specH = spectrumCanvas.height;
      specCtx.clearRect(0, 0, specW, specH);

      const barCount = 24;
      const gap = 2;
      const barWidth = Math.max(2, Math.floor((specW - (barCount - 1) * gap) / barCount));
      const peaks = barPeaksRef.current;

      // Draw horizontal baseline grid
      specCtx.strokeStyle = '#1a1a1e';
      specCtx.lineWidth = 1;
      for (let y = 8; y < specH; y += 10) {
        specCtx.beginPath();
        specCtx.moveTo(0, y);
        specCtx.lineTo(specW, y);
        specCtx.stroke();
      }

      for (let i = 0; i < barCount; i++) {
        let barNorm = 0;

        if (sessionState === 'LISTENING') {
          if (frequencyData && frequencyData.length > 0) {
            // Map bar index to frequency spectrum bins (spread across low -> mid -> high)
            const binIdx = Math.min(
              frequencyData.length - 1,
              Math.floor((i / barCount) * frequencyData.length)
            );
            // Apply human voice perceptual curve (boost speech formants)
            const rawVal = frequencyData[binIdx] / 255;
            barNorm = Math.min(1, rawVal * 1.3);
          } else {
            // Fallback animated wave during mic listen if stream pending
            barNorm = Math.max(0.08, Math.abs(Math.sin(angle * 3 + i * 0.35)) * (dynamicLevel + 0.3));
          }
        } else if (sessionState === 'SPEAKING') {
          // Playback vocal harmonics
          const wave = Math.abs(Math.sin(angle * 4 + i * 0.45));
          barNorm = Math.min(1, (dynamicLevel + 0.3) * wave);
        } else if (sessionState === 'THINKING') {
          // Scanning radar sweep effect across spectrum
          const sweep = Math.sin(angle * 5 - i * 0.4);
          barNorm = sweep > 0 ? sweep * 0.55 : 0.05;
        } else {
          // Idle low baseline flicker
          barNorm = 0.04 + Math.sin(angle * 1.5 + i * 0.25) * 0.02;
        }

        const barHeight = Math.max(2, Math.round(barNorm * (specH - 4)));
        const x = i * (barWidth + gap);
        const y = specH - barHeight;

        // Update Peak hold
        if (barNorm >= peaks[i]) {
          peaks[i] = barNorm;
        } else {
          peaks[i] = Math.max(0, peaks[i] - 0.018); // smooth decay
        }

        // Draw segmented / gradient bar
        specCtx.fillStyle = accentColor;
        specCtx.globalAlpha = sessionState === 'LISTENING' ? 0.85 : 0.45;
        specCtx.fillRect(x, y, barWidth, barHeight);

        // Draw Peak Cap Tick
        const peakY = Math.max(1, Math.round(specH - peaks[i] * (specH - 4)));
        specCtx.fillStyle = '#ffffff';
        specCtx.globalAlpha = sessionState === 'LISTENING' ? 0.95 : 0.3;
        specCtx.fillRect(x, peakY - 1, barWidth, 1.5);
      }

      specCtx.globalAlpha = 1.0;
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [sessionState, audioLevel, accentColor, analyserNode, localMicActive]);

  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between px-3 py-2 bg-[#09090c] border-b border-[#2e2e31] text-xs font-mono select-none gap-2">
      {/* Left: Waveform Orb + Action Button + Status Details */}
      <div className="flex items-center gap-3">
        <div className="relative w-22 h-22 flex items-center justify-center shrink-0">
          <canvas
            ref={orbCanvasRef}
            width={96}
            height={96}
            className="absolute inset-0 pointer-events-none"
          />

          <button
            onClick={onToggleSession}
            title={
              sessionState === 'IDLE'
                ? 'Engage Gemini Live Voice Session'
                : 'Stop Live Voice Session'
            }
            style={{
              borderColor: accentColor,
              boxShadow: sessionState !== 'IDLE' ? `0 0 16px ${accentColor}40` : 'none',
            }}
            className="relative z-10 w-11 h-11 rounded-full bg-[#111114] border flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer group"
          >
            {sessionState === 'SPEAKING' ? (
              <Volume2 className="w-5 h-5 animate-pulse" style={{ color: accentColor }} />
            ) : sessionState === 'LISTENING' ? (
              <Radio className="w-5 h-5 animate-pulse" style={{ color: accentColor }} />
            ) : sessionState === 'THINKING' ? (
              <Sparkles className="w-5 h-5 animate-spin" style={{ color: accentColor }} />
            ) : (
              <Zap
                className="w-5 h-5 transition-transform group-hover:scale-110"
                style={{ color: accentColor }}
              />
            )}
          </button>
        </div>

        {/* Status Details */}
        <div className="flex flex-col gap-0.5 min-w-[170px]">
          <div className="flex items-center gap-1.5">
            <span className="font-bold tracking-wider text-[#cfcfca]">
              MAYA // {sessionState}
            </span>
            <span
              className="text-[9px] px-1.5 py-0.2 rounded-[2px] border font-bold"
              style={{
                borderColor: `${accentColor}60`,
                color: accentColor,
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
              }}
            >
              {currentMode}
            </span>
          </div>

          <p className="text-[10px] text-[#6d6d69]">
            {sessionState === 'IDLE'
              ? (wakeWordListening ? 'Click orb or say "Maya" to speak' : 'Click orb or press Space to talk to Maya')
              : sessionState === 'LISTENING'
              ? 'Active mic listening · Sirius speaks'
              : sessionState === 'THINKING'
              ? 'Synthesizing response & executing tools...'
              : 'Speaking response (interruption enabled)'}
          </p>

          {/* Voice Model State & System Access indicator */}
          <div className="flex items-center gap-2 text-[9px] text-[#46464a] mt-0.5">
            <div className="flex items-center gap-1">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: sessionState !== 'IDLE' ? accentColor : (wakeWordListening ? accentColor : '#00ff66'),
                  boxShadow: sessionState !== 'IDLE' ? `0 0 6px ${accentColor}` : (wakeWordListening ? `0 0 6px ${accentColor}` : '0 0 4px #00ff6640'),
                }}
              />
              <span className={sessionState !== 'IDLE' ? 'text-[#cfcfca] font-bold' : 'text-[#8a8a86]'}>
                {wakeWordListening ? 'WAKE: ACTIVE' : (sessionState === 'IDLE' ? 'VOICE MODEL: READY' : `VOICE: ${sessionState}`)}
              </span>
            </div>

            {systemAccessGranted && (
              <span
                className="flex items-center gap-1 px-1 py-0.2 rounded-[2px] border border-[#2e2e31] bg-[#111114] text-[8px] font-bold"
                style={{ color: accentColor }}
                title="System Level Root Access Granted (Clearance Level 5 - Sirius)"
              >
                <ShieldCheck className="w-2.5 h-2.5" />
                <span>ROOT ACCESS</span>
              </span>
            )}

            {wakeWordPhrase && (
              <span className="text-[#cfcfca] truncate max-w-[100px]">[{wakeWordPhrase}]</span>
            )}
          </div>
        </div>
      </div>

      {/* Center / Right: Real-time Web Audio AnalyserNode Frequency Visualizer */}
      <div className="flex-1 max-w-sm flex flex-col justify-center px-2 py-1 bg-[#0d0d10] border border-[#202024] rounded-[2px]">
        {/* Visualizer Header */}
        <div className="flex items-center justify-between text-[9px] text-[#6d6d69] mb-1">
          <div className="flex items-center gap-1.5 font-bold">
            <Activity className="w-3 h-3" style={{ color: accentColor }} />
            <span style={{ color: sessionState === 'LISTENING' ? accentColor : '#cfcfca' }}>
              REAL-TIME MIC FREQUENCY VISUALIZER
            </span>
            <span
              className={`text-[8px] px-1 rounded-[1px] border ${
                sessionState === 'LISTENING'
                  ? 'border-[#38bdf8]/40 text-[#38bdf8] bg-[#38bdf8]/10'
                  : 'border-[#2e2e31] text-[#6d6d69]'
              }`}
              style={
                sessionState === 'LISTENING'
                  ? { borderColor: `${accentColor}50`, color: accentColor, backgroundColor: 'rgba(255,255,255,0.04)' }
                  : {}
              }
            >
              {sessionState === 'LISTENING'
                ? 'MIC LIVE'
                : localMicActive
                ? 'LOCAL TEST'
                : 'STANDBY'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono text-[#cfcfca]">{currentDecibel} dBFS</span>
            <button
              onClick={toggleLocalSpectrum}
              title={localMicActive ? 'Stop Standalone Mic Spectrum' : 'Test Mic Frequency Spectrum'}
              className="text-[8px] px-1 py-0.5 rounded-[2px] bg-[#141418] hover:bg-[#1f1f26] border border-[#2e2e31] text-[#6d6d69] hover:text-[#cfcfca] cursor-pointer"
            >
              {localMicActive ? 'STOP TEST' : 'TEST MIC'}
            </button>
          </div>
        </div>

        {/* 24-Bin Canvas Frequency Spectrum Bars with Peak Holds */}
        <div className="w-full h-8 relative bg-[#070709] border border-[#1a1a1e] rounded-[1px] overflow-hidden">
          <canvas
            ref={spectrumCanvasRef}
            width={240}
            height={32}
            className="w-full h-full block"
          />
        </div>

        {/* Frequency Range Legend */}
        <div className="flex items-center justify-between text-[8px] text-[#46464a] mt-0.5 font-mono">
          <span>60 Hz</span>
          <span>250 Hz</span>
          <span style={{ color: sessionState === 'LISTENING' ? accentColor : undefined }}>
            {dominantFrequency}
          </span>
          <span>2 kHz</span>
          <span>8 kHz</span>
        </div>
      </div>

      {/* Far Right: Error message or System Clearance Telemetry */}
      <div className="hidden lg:flex flex-col items-end text-right justify-center shrink-0">
        {errorMessage ? (
          <div className="flex items-center gap-1 text-[10px] text-[#c4524f] bg-[#1a0e0e] border border-[#3d1817] px-2 py-0.5 rounded-[2px]">
            <AlertCircle className="w-3 h-3" />
            <span>{errorMessage}</span>
          </div>
        ) : (
          <div className="text-[10px] text-[#6d6d69] flex flex-col items-end gap-0.5 font-mono">
            <div className="flex items-center gap-1.5">
              <span>CLEARANCE:</span>
              <span className="font-bold text-[#cfcfca]" style={{ color: accentColor }}>
                LEVEL 5 // SYS-ADMIN
              </span>
            </div>
            <div className="text-[9px] text-[#46464a] flex items-center gap-1">
              <span>EXEC: SIRIUS (CEO)</span>
              <span>·</span>
              <span>GEMINI LIVE 16kHz</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
