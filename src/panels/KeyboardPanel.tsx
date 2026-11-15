import React, { useState, useEffect } from 'react';

interface KeyboardPanelProps {
  onKeyPress: (char: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  onSpace: () => void;
}

interface KeyConfig {
  code: string;
  label: string;
  width?: string;
  action?: 'char' | 'enter' | 'backspace' | 'space' | 'noop';
  char?: string;
}

export const KeyboardPanel: React.FC<KeyboardPanelProps> = ({
  onKeyPress,
  onBackspace,
  onEnter,
  onSpace,
}) => {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

  // Listen to physical keyboard events to light keys with 200ms fade
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code.toUpperCase();
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.add(code);
        return next;
      });

      // Clear after 200ms
      setTimeout(() => {
        setActiveKeys((prev) => {
          const next = new Set(prev);
          next.delete(code);
          return next;
        });
      }, 200);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const triggerKey = (k: KeyConfig) => {
    // Light key on screen
    setActiveKeys((prev) => {
      const next = new Set(prev);
      next.add(k.code);
      return next;
    });

    setTimeout(() => {
      setActiveKeys((prev) => {
        const next = new Set(prev);
        next.delete(k.code);
        return next;
      });
    }, 200);

    // Perform action
    if (k.action === 'enter') {
      onEnter();
    } else if (k.action === 'backspace') {
      onBackspace();
    } else if (k.action === 'space') {
      onSpace();
    } else if (k.action === 'char' && k.char) {
      onKeyPress(k.char);
    }
  };

  const keyboardRows: KeyConfig[][] = [
    // Row 1: ESC + Function row
    [
      { code: 'ESCAPE', label: 'ESC', action: 'noop' },
      { code: 'F1', label: 'F1', action: 'noop' },
      { code: 'F2', label: 'F2', action: 'noop' },
      { code: 'F3', label: 'F3', action: 'noop' },
      { code: 'F4', label: 'F4', action: 'noop' },
      { code: 'F5', label: 'F5', action: 'noop' },
      { code: 'F6', label: 'F6', action: 'noop' },
      { code: 'F7', label: 'F7', action: 'noop' },
      { code: 'F8', label: 'F8', action: 'noop' },
      { code: 'F9', label: 'F9', action: 'noop' },
      { code: 'F10', label: 'F10', action: 'noop' },
      { code: 'F11', label: 'F11', action: 'noop' },
      { code: 'F12', label: 'F12', action: 'noop' },
      { code: 'DELETE', label: 'DEL', action: 'backspace' },
    ],
    // Row 2: Numbers row
    [
      { code: 'BACKQUOTE', label: '`', action: 'char', char: '`' },
      { code: 'DIGIT1', label: '1', action: 'char', char: '1' },
      { code: 'DIGIT2', label: '2', action: 'char', char: '2' },
      { code: 'DIGIT3', label: '3', action: 'char', char: '3' },
      { code: 'DIGIT4', label: '4', action: 'char', char: '4' },
      { code: 'DIGIT5', label: '5', action: 'char', char: '5' },
      { code: 'DIGIT6', label: '6', action: 'char', char: '6' },
      { code: 'DIGIT7', label: '7', action: 'char', char: '7' },
      { code: 'DIGIT8', label: '8', action: 'char', char: '8' },
      { code: 'DIGIT9', label: '9', action: 'char', char: '9' },
      { code: 'DIGIT0', label: '0', action: 'char', char: '0' },
      { code: 'MINUS', label: '-', action: 'char', char: '-' },
      { code: 'EQUAL', label: '=', action: 'char', char: '=' },
      { code: 'BACKSPACE', label: 'BKSP', width: 'flex-1.5', action: 'backspace' },
    ],
    // Row 3: QWERTY
    [
      { code: 'TAB', label: 'TAB', width: 'flex-1.2', action: 'noop' },
      { code: 'KEYQ', label: 'Q', action: 'char', char: 'q' },
      { code: 'KEYW', label: 'W', action: 'char', char: 'w' },
      { code: 'KEYE', label: 'E', action: 'char', char: 'e' },
      { code: 'KEYR', label: 'R', action: 'char', char: 'r' },
      { code: 'KEYT', label: 'T', action: 'char', char: 't' },
      { code: 'KEYY', label: 'Y', action: 'char', char: 'y' },
      { code: 'KEYU', label: 'U', action: 'char', char: 'u' },
      { code: 'KEYI', label: 'I', action: 'char', char: 'i' },
      { code: 'KEYO', label: 'O', action: 'char', char: 'o' },
      { code: 'KEYP', label: 'P', action: 'char', char: 'p' },
      { code: 'BRACKETLEFT', label: '[', action: 'char', char: '[' },
      { code: 'BRACKETRIGHT', label: ']', action: 'char', char: ']' },
      { code: 'BACKSLASH', label: '\\', action: 'char', char: '\\' },
    ],
    // Row 4: ASDF
    [
      { code: 'CAPSLOCK', label: 'CAPS', width: 'flex-1.4', action: 'noop' },
      { code: 'KEYA', label: 'A', action: 'char', char: 'a' },
      { code: 'KEYS', label: 'S', action: 'char', char: 's' },
      { code: 'KEYD', label: 'D', action: 'char', char: 'd' },
      { code: 'KEYF', label: 'F', action: 'char', char: 'f' },
      { code: 'KEYG', label: 'G', action: 'char', char: 'g' },
      { code: 'KEYH', label: 'H', action: 'char', char: 'h' },
      { code: 'KEYJ', label: 'J', action: 'char', char: 'j' },
      { code: 'KEYK', label: 'K', action: 'char', char: 'k' },
      { code: 'KEYL', label: 'L', action: 'char', char: 'l' },
      { code: 'SEMICOLON', label: ';', action: 'char', char: ';' },
      { code: 'QUOTE', label: "'", action: 'char', char: "'" },
      { code: 'ENTER', label: 'ENTER', width: 'flex-1.8', action: 'enter' },
    ],
    // Row 5: ZXCV
    [
      { code: 'SHIFTLEFT', label: 'SHIFT', width: 'flex-1.6', action: 'noop' },
      { code: 'KEYZ', label: 'Z', action: 'char', char: 'z' },
      { code: 'KEYX', label: 'X', action: 'char', char: 'x' },
      { code: 'KEYC', label: 'C', action: 'char', char: 'c' },
      { code: 'KEYV', label: 'V', action: 'char', char: 'v' },
      { code: 'KEYB', label: 'B', action: 'char', char: 'b' },
      { code: 'KEYN', label: 'N', action: 'char', char: 'n' },
      { code: 'KEYM', label: 'M', action: 'char', char: 'm' },
      { code: 'COMMA', label: ',', action: 'char', char: ',' },
      { code: 'PERIOD', label: '.', action: 'char', char: '.' },
      { code: 'SLASH', label: '/', action: 'char', char: '/' },
      { code: 'ARROWUP', label: '▲', action: 'noop' },
      { code: 'SHIFTRIGHT', label: 'SHIFT', width: 'flex-1.2', action: 'noop' },
    ],
    // Row 6: Space + Modifiers
    [
      { code: 'CONTROLLEFT', label: 'CTRL', action: 'noop' },
      { code: 'FN', label: 'FN', action: 'noop' },
      { code: 'METALEFT', label: 'WIN', action: 'noop' },
      { code: 'ALTLEFT', label: 'ALT', action: 'noop' },
      { code: 'SPACE', label: 'SPACE', width: 'flex-5', action: 'space' },
      { code: 'ALTRIGHT', label: 'ALT GR', action: 'noop' },
      { code: 'ARROWLEFT', label: '◄', action: 'noop' },
      { code: 'ARROWDOWN', label: '▼', action: 'noop' },
      { code: 'ARROWRIGHT', label: '►', action: 'noop' },
    ],
  ];

  return (
    <div className="edex-panel h-full flex flex-col p-2 select-none border border-[#2e2e31] bg-[#09090b]/90">
      <div className="flex items-center justify-between border-b border-[#2e2e31]/60 pb-1 mb-1 font-hud text-[10px] text-[#6d6d69]">
        <span>HARDWARE TERMINAL // KEYBOARD</span>
        <span className="font-mono text-[9px] text-[var(--accent)]">PHYSICAL SYNC: ACTIVE</span>
      </div>

      <div className="flex flex-col gap-1 flex-1 justify-between py-0.5">
        {keyboardRows.map((row, rIdx) => (
          <div key={rIdx} className="flex gap-1 w-full flex-1">
            {row.map((k) => {
              const isLit = activeKeys.has(k.code);
              return (
                <button
                  key={k.code}
                  onClick={() => triggerKey(k)}
                  className={`flex-1 h-full min-h-[22px] border text-[10px] font-mono flex items-center justify-center transition-colors duration-200 cursor-pointer ${
                    k.width ? k.width : ''
                  } ${
                    isLit
                      ? 'bg-[var(--accent)] text-[#070708] border-[var(--accent)] font-bold shadow-[0_0_8px_var(--glow)]'
                      : 'bg-[#111114] text-[#cfcfca] border-[#2e2e31]/60 hover:border-[#6d6d69] hover:bg-[#1a1a20]'
                  }`}
                >
                  {k.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
