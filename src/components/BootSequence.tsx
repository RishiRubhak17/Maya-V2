import React, { useState, useEffect } from 'react';
import { Terminal, Shield } from 'lucide-react';

interface BootSequenceProps {
  userName: string;
  onComplete: () => void;
  accentColor?: string;
}

export const BootSequence: React.FC<BootSequenceProps> = ({
  userName,
  onComplete,
  accentColor = '#d6d3cc',
}) => {
  const [step, setStep] = useState<number>(0);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Good morning';
    if (hour >= 12 && hour < 17) return 'Good afternoon';
    if (hour >= 17 && hour < 21) return 'Iniya maalai vanakkam (Good evening)';
    return 'Good evening';
  };

  const lines = [
    'AXIOM INTELLIGENCE v1.0 // INITIALIZING eDEX-UI TERMINAL',
    'MAYA: Mission-driven Assistant for Your Axiom',
    `"${getGreeting()}, ${userName}. All tactical systems ready."`,
  ];

  useEffect(() => {
    const timer1 = setTimeout(() => setStep(1), 350);
    const timer2 = setTimeout(() => setStep(2), 900);
    const timer3 = setTimeout(() => setStep(3), 1600);
    const timer4 = setTimeout(() => onComplete(), 2400);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070708] text-[#cfcfca] p-6 font-mono select-none">
      <div className="max-w-lg w-full p-6 rounded-sm bg-[#0d0d0f] border border-[#2e2e31] shadow-2xl space-y-4 relative">
        <div className="flex items-center justify-between border-b border-[#2e2e31] pb-3">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-[1px]"
              style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
            />
            <span className="text-xs font-bold text-[#cfcfca] tracking-wider">
              AXIOM INTELLIGENCE // BOOTLOADER
            </span>
          </div>
          <span className="text-[10px] text-[#6d6d69]">TRICHY NODE [10.79°N, 78.70°E]</span>
        </div>

        <div className="space-y-2 text-xs">
          {step >= 1 && (
            <div className="font-bold tracking-wider flex items-center gap-2" style={{ color: accentColor }}>
              <span>&gt;</span>
              <span>{lines[0]}</span>
            </div>
          )}

          {step >= 2 && (
            <div className="text-[#cfcfca] flex items-center gap-2">
              <span className="text-[#6d6d69]">&gt;</span>
              <span>{lines[1]}</span>
            </div>
          )}

          {step >= 3 && (
            <div className="text-[#e6c27a] font-medium flex items-center gap-2 italic">
              <span className="text-[#6d6d69]">&gt;</span>
              <span>{lines[2]}</span>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-[#2e2e31] flex items-center justify-between text-[10px] text-[#6d6d69]">
          <span>HOST: SIRIUS // ASC EXECUTIVE</span>
          <button
            onClick={onComplete}
            className="hover:text-[#cfcfca] underline cursor-pointer"
          >
            SKIP [ESC]
          </button>
        </div>
      </div>
    </div>
  );
};
