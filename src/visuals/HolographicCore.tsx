import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MayaEmotion, EMOTION_MAP } from '../emotion/types';
import { ThemeSkin, THEME_SKINS } from '../theme/skins';
import { coreAudioFx } from '../utils/coreAudioFx';
import { Radio, Mic, Palette, Subtitles, Volume2, VolumeX, RotateCcw } from 'lucide-react';

export type CoreState =
  | 'idle'
  | 'sleeping'
  | 'waking'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'working'
  | 'follow_up'
  | 'error'
  | 'offline';

interface HolographicCoreProps {
  emotion: MayaEmotion;
  liveState: 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';
  isArmed: boolean;
  isWorking?: boolean;
  audioLevel: number; // 0.0 - 1.0 real RMS level
  onToggleVoice: () => void;
  activeSkinId?: 'ash' | 'stark';
  onChangeSkin?: (skinId: 'ash' | 'stark') => void;
  captionText?: string;
  isDetached?: boolean; // When true, rendered as floating desktop overlay
  onDockToggle?: () => void;
}

export const HolographicCore: React.FC<HolographicCoreProps> = ({
  emotion,
  liveState,
  isArmed,
  isWorking = false,
  audioLevel,
  onToggleVoice,
  activeSkinId = 'ash',
  onChangeSkin,
  captionText = '',
  isDetached = false,
  onDockToggle,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dataState, setDataState] = useState<CoreState>('idle');
  const [showCaptions, setShowCaptions] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  // Dragging state for desktop presence
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const saved = localStorage.getItem('maya_core_pos');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      // ignore
    }
    return { x: 0, y: 0 };
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number }>({
    x: 0,
    y: 0,
    posX: 0,
    posY: 0,
  });

  const skin = THEME_SKINS[activeSkinId] || THEME_SKINS.ash;
  const emotionProfile = EMOTION_MAP[emotion] || EMOTION_MAP.calm;

  // Derive core state from live session, armed state, and working flags
  useEffect(() => {
    if (!navigator.onLine) {
      setDataState('offline');
      return;
    }
    if (isWorking) {
      setDataState('working');
      coreAudioFx.playWorkingChirp();
      return;
    }
    if (liveState === 'SPEAKING') {
      setDataState('speaking');
    } else if (liveState === 'LISTENING') {
      setDataState('listening');
    } else if (liveState === 'THINKING') {
      setDataState('thinking');
    } else if (isArmed) {
      setDataState('idle');
    } else {
      setDataState('sleeping');
    }
  }, [liveState, isArmed, isWorking]);

  // Real-time animation loop updating --level and --breath ~60fps
  useEffect(() => {
    let animId: number;
    let time = 0;

    const loop = () => {
      const container = containerRef.current;
      if (container) {
        // Natural subtle breath curve (0.97 to 1.03)
        time += 0.035;
        const breath = 1 + Math.sin(time) * 0.03;

        // Reactive level from real audio
        const currentLevel = Math.max(0, Math.min(1, audioLevel));

        container.style.setProperty('--level', currentLevel.toFixed(3));
        container.style.setProperty('--breath', breath.toFixed(3));

        // Speed and glow determined by active emotion and skin
        const targetSpeed = (emotionProfile.speed * skin.ring2SpeedMultiplier).toFixed(2);
        const targetGlow = emotionProfile.glow.toFixed(2);
        const targetAccent = activeSkinId === 'stark' ? skin.baseAccent : emotionProfile.color;

        container.style.setProperty('--speed', targetSpeed);
        container.style.setProperty('--glow', targetGlow);
        container.style.setProperty('--accent', targetAccent);
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [audioLevel, emotionProfile, skin, activeSkinId]);

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    if (!isDetached) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: pos.x,
      posY: pos.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.x;
      const dy = moveEvent.clientY - dragStartRef.current.y;
      const newPos = {
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      };
      setPos(newPos);
      try {
        localStorage.setItem('maya_core_pos', JSON.stringify(newPos));
      } catch (e) {
        // ignore
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Double-click wakes / toggles voice
  const handleDoubleClick = () => {
    coreAudioFx.playWakeChime();
    onToggleVoice();
  };

  // Right-click opens custom context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = useCallback(() => {
    setContextMenuPos(null);
  }, []);

  useEffect(() => {
    const handleClickOutside = () => closeContextMenu();
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [closeContextMenu]);

  const toggleSoundFx = () => {
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    coreAudioFx.setMuted(next);
  };

  const resetPosition = () => {
    setPos({ x: 0, y: 0 });
    try {
      localStorage.removeItem('maya_core_pos');
    } catch (e) {
      // ignore
    }
  };

  return (
    <div
      className={`relative select-none ${
        isDetached
          ? 'fixed z-50 pointer-events-auto transition-shadow'
          : 'flex items-center justify-center'
      }`}
      style={
        isDetached
          ? {
              transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
              top: '80px',
              right: '80px',
            }
          : undefined
      }
    >
      {/* THE CORE VISUAL CONTAINER */}
      <div
        ref={containerRef}
        className="maya"
        data-state={dataState}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        title="Double-click to Wake/Talk. Right-click for Context Menu. Drag core to reposition."
      >
        {/* Faint Dark Halo Backdrop */}
        <div className="maya-halo" />

        {/* Ring 1: Thin dashed outer ring rotating slowly */}
        <div className="ring r1" />

        {/* Ring 2: Segmented arcs (counter-rotates, spins fast in thinking) */}
        <div className="ring r2" />

        {/* Ring 3: Fine tick marks like arc reactor and HUD dials */}
        <div className="ring r3" />

        {/* Scan sweep: Rotating sector of light appearing only while working on task */}
        <div className="ring scan" />

        {/* Voice Ring: Ripples outward with speech audio level */}
        <div className="voice-ring" />

        {/* Core: Glowing center pulsing with voice and breath */}
        <div
          className="ring core"
          onClick={(e) => {
            // Single click toggles voice if not dragging
            if (!isDraggingRef.current) {
              onToggleVoice();
            }
          }}
        />
      </div>

      {/* Optional Accessibility Caption Mode Floating Banner (OFF by default) */}
      {showCaptions && (
        <div className="absolute top-[230px] left-1/2 -translate-x-1/2 w-64 max-w-xs bg-[#09090b]/90 border border-[#2e2e31] p-2 text-center text-[10px] font-mono text-[#cfcfca] shadow-xl backdrop-blur-xs pointer-events-none z-30">
          <div className="text-[9px] text-[#6d6d69] font-hud tracking-wider border-b border-[#2e2e31]/60 pb-1 mb-1">
            MAYA SYNAPSE CAPTION
          </div>
          <p className="line-clamp-3 italic">
            {captionText || (liveState === 'LISTENING' ? 'Listening to Sirius...' : 'Standing by.')}
          </p>
        </div>
      )}

      {/* Tactical Right-Click Context Menu */}
      {contextMenuPos && (
        <div
          className="fixed z-50 bg-[#0d0d0f] border border-[#2e2e31] p-1.5 shadow-[0_0_20px_rgba(0,0,0,0.8)] font-mono text-xs w-48 space-y-1 backdrop-blur-md"
          style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-1 text-[9px] font-hud text-[#6d6d69] tracking-widest border-b border-[#2e2e31]/50">
            HOLOGRAPHIC CORE // CONTROLS
          </div>

          <button
            onClick={() => {
              onToggleVoice();
              closeContextMenu();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[#cfcfca] hover:bg-[#1a1a20] hover:text-[var(--accent)] cursor-pointer"
          >
            <Mic size={13} />
            <span>{liveState !== 'IDLE' ? 'Disconnect Voice' : 'Wake / Start Voice'}</span>
          </button>

          <button
            onClick={() => {
              if (onChangeSkin) {
                onChangeSkin(activeSkinId === 'ash' ? 'stark' : 'ash');
                coreAudioFx.playConfirmTone();
              }
              closeContextMenu();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[#cfcfca] hover:bg-[#1a1a20] hover:text-[var(--accent)] cursor-pointer"
          >
            <Palette size={13} />
            <span>Skin: {activeSkinId === 'ash' ? 'Stark (Gold/Red)' : 'Ash (Default)'}</span>
          </button>

          <button
            onClick={() => {
              setShowCaptions(!showCaptions);
              closeContextMenu();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[#cfcfca] hover:bg-[#1a1a20] hover:text-[var(--accent)] cursor-pointer"
          >
            <Subtitles size={13} />
            <span>Captions: {showCaptions ? 'Enabled' : 'Disabled'}</span>
          </button>

          <button
            onClick={() => {
              toggleSoundFx();
              closeContextMenu();
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[#cfcfca] hover:bg-[#1a1a20] hover:text-[var(--accent)] cursor-pointer"
          >
            {isAudioMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
            <span>Sound FX: {isAudioMuted ? 'Muted' : 'Audible'}</span>
          </button>

          {onDockToggle && (
            <button
              onClick={() => {
                onDockToggle();
                closeContextMenu();
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[#cfcfca] hover:bg-[#1a1a20] hover:text-[var(--accent)] cursor-pointer"
            >
              <Radio size={13} />
              <span>{isDetached ? 'Dock to HUD Header' : 'Detach to Desktop'}</span>
            </button>
          )}

          {isDetached && (
            <button
              onClick={() => {
                resetPosition();
                closeContextMenu();
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-[#6d6d69] hover:bg-[#1a1a20] hover:text-[#cfcfca] cursor-pointer border-t border-[#2e2e31]/40 mt-1"
            >
              <RotateCcw size={13} />
              <span>Reset Position</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
