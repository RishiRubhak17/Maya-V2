import React, { useState, useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';

interface BootSequenceProps {
  onBootComplete: () => void;
}

export const BootSequence: React.FC<BootSequenceProps> = ({ onBootComplete }) => {
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [showLogo, setShowLogo] = useState(false);
  const [showArmPrompt, setShowArmPrompt] = useState(false);
  const [greetingText, setGreetingText] = useState('');
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  const rawLogs = [
    'AXIOM INTELLIGENCE v1.0 // INIT SEQUENCE START',
    'BIOS FIRMWARE INTEGRITY CHECK... [PASSED]',
    'SECURE HARDWARE ENCLAVE INITIALIZED',
    'ALLOCATING TACTICAL MEMORY BUFFER... OK',
    'WAKE ENGINE [WebSpeech en-IN]... INITIALIZED',
    'PORCUPINE DESKTOP STUB BINDINGS... MOUNTED',
    'GEMINI LIVE AUDIO BRIDGE (16kHz PCM IN / 24kHz OUT)... READY',
    'SEARCH GROUNDING API PROVIDER... LINKED',
    'TRANSCRIBER (gemini-3.5-transcribe)... ONLINE',
    'EMOTION CORE & SYNAPSE ACCENT BUS... LOADED',
    'SECURITY RISK TIERS & DEFENSE POLICY... ENFORCED',
    'USER VERIFIED: SIRIUS // FOUNDER & CEO ASC',
    'ALL SYSTEM SUBSYSTEMS NOMINAL',
  ];

  // Adjust greeting for time of day
  useEffect(() => {
    const hour = new Date().getHours();
    const timeOfDay = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    setGreetingText(`MAYA: ${timeOfDay}, Sirius. All systems are ready.`);
  }, []);

  // Keyboard shortcut to skip
  useEffect(() => {
    const handleKey = () => {
      completeBoot();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Scrolling typewriter boot lines
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < rawLogs.length) {
        const time = new Date().toISOString().split('T')[1].slice(0, 12);
        setBootLines((prev) => [...prev, `[${time}] ${rawLogs[index]}`]);
        index++;
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
      } else {
        clearInterval(interval);
        setShowLogo(true);
      }
    }, 280);

    return () => clearInterval(interval);
  }, []);

  // Animate SVG Logo when ready
  useEffect(() => {
    if (showLogo) {
      try {
        animate('.boot-svg-path', {
          strokeDashoffset: [300, 0],
          ease: 'inOutCubic',
          duration: 1600,
          delay: stagger(120),
          onComplete: () => {
            setShowArmPrompt(true);
          },
        });
      } catch (e) {
        setShowArmPrompt(true);
      }
    }
  }, [showLogo]);

  const completeBoot = () => {
    // Unlock AudioContext and notify parent
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const tempCtx = new AudioContextClass();
        tempCtx.resume();
      }
    } catch (e) {
      // ignore
    }

    sessionStorage.setItem('maya_booted', 'true');
    onBootComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#070708] text-[#cfcfca] flex flex-col items-center justify-between p-8 font-mono select-none overflow-hidden hud-vignette hud-grid-bg">
      {/* Header */}
      <div className="w-full max-w-4xl flex justify-between items-center border-b border-[#2e2e31] pb-2 text-xs font-hud text-[#6d6d69]">
        <span className="tracking-widest">AXIOM INTELLIGENCE // CODENAME: MAYA</span>
        <span className="text-[var(--accent)] animate-pulse">PRESS ANY KEY TO BYPASS BOOT</span>
      </div>

      {/* Center Display: Logo and scrolling console */}
      <div className="w-full max-w-3xl flex-1 flex flex-col items-center justify-center my-4 gap-6">
        {/* SVG Tactical Logo */}
        <div className="relative flex items-center justify-center">
          <svg
            width="140"
            height="140"
            viewBox="0 0 100 100"
            className="filter drop-shadow-[0_0_12px_rgba(214,211,204,0.25)]"
          >
            {/* Outer Hexagon */}
            <polygon
              points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5"
              fill="none"
              stroke="#2e2e31"
              strokeWidth="1.5"
            />
            {/* Inner Emblem with animated paths */}
            <polygon
              className="boot-svg-path"
              points="50,15 80,32 80,68 50,85 20,68 20,32"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
            />
            <circle
              className="boot-svg-path"
              cx="50"
              cy="50"
              r="18"
              fill="none"
              stroke="#cfcfca"
              strokeWidth="1.5"
            />
            <path
              className="boot-svg-path"
              d="M 50 32 L 50 68 M 32 50 L 68 50"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Scrolling Boot Output */}
        <div
          ref={logContainerRef}
          className="w-full h-44 bg-[#09090b]/90 border border-[#2e2e31] p-3 overflow-y-auto no-scrollbar font-mono text-xs space-y-1 shadow-inner"
        >
          {bootLines.map((line, idx) => (
            <div key={idx} className="text-[#6d6d69] hover:text-[#cfcfca] transition-colors">
              {line}
            </div>
          ))}
          <div className="flex items-center gap-2 text-[var(--accent)] pt-1">
            <span>&gt;</span>
            <span className="terminal-cursor" />
          </div>
        </div>

        {/* Greeting & Arm Prompt */}
        {showArmPrompt && (
          <div className="flex flex-col items-center gap-3 animate-fade-in text-center">
            <div className="font-hud text-lg tracking-wider text-[#cfcfca] font-bold">
              {greetingText}
            </div>

            <button
              onClick={completeBoot}
              className="px-8 py-3 bg-[var(--accent)] text-[#070708] font-hud font-bold text-sm tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-[0_0_16px_var(--glow)] cursor-pointer"
            >
              [ TAP TO ARM SYSTEM & UNLOCK AUDIO ]
            </button>
            <span className="text-[10px] text-[#6d6d69]">
              Initializes hardware microphone access and speech synthesizer.
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="w-full max-w-4xl flex justify-between items-center border-t border-[#2e2e31] pt-2 text-[10px] font-mono text-[#46464a]">
        <span>ASC SECURE ENCLAVE // TRICHY, TAMIL NADU</span>
        <span>NODE ID: 8B863E5A // ARCH: X86_64</span>
      </div>
    </div>
  );
};
