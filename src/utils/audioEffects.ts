// Futuristic eDEX-UI / Maya Web Audio Synthesizer
let audioCtx: AudioContext | null = null;
let isSoundMuted = false;

export function setSoundMuted(muted: boolean) {
  isSoundMuted = muted;
}

export function getSoundMuted(): boolean {
  return isSoundMuted;
}

function getAudioContext(): AudioContext | null {
  if (isSoundMuted) return null;
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Mechanical sci-fi keyboard click tick (eDEX-UI style)
 */
export function playKeyClick() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.04, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
  gain.connect(ctx.destination);

  // Short noise burst + high resonant click
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1400 + Math.random() * 400, now);
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.03);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.035);
}

/**
 * HUD Wake Chime: Rising cyber harmonic pulse
 */
export function playWakeChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.14, now);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
  masterGain.connect(ctx.destination);

  // Tone 1: 880 Hz
  const osc1 = ctx.createOscillator();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880, now);
  osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
  osc1.connect(masterGain);
  osc1.start(now);
  osc1.stop(now + 0.35);

  // Tone 2: 1760 Hz shimmer
  const osc2 = ctx.createOscillator();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(1320, now + 0.08);
  osc2.frequency.exponentialRampToValueAtTime(1760, now + 0.22);
  osc2.connect(masterGain);
  osc2.start(now + 0.08);
  osc2.stop(now + 0.45);
}

/**
 * Tactical Mode Switch Chime: Resonant low-frequency cyber sweep
 */
export function playModeChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0.16, now);
  masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
  masterGain.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(640, now + 0.15);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(1100, now);

  osc.connect(filter);
  filter.connect(masterGain);
  osc.start(now);
  osc.stop(now + 0.38);
}

/**
 * Confirmation Chime
 */
export function playConfirmChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  gain.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1046.5, now);
  osc.frequency.setValueAtTime(1318.5, now + 0.08);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.25);
}

/**
 * Session Connect Chime
 */
export function playConnectChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
  gain.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(587.33, now); // D5
  osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
  osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.25); // D6
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.35);
}

/**
 * Session Disconnect Chime
 */
export function playDisconnectChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.1, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
  gain.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(440, now + 0.22);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.28);
}

/**
 * Error / Warning Buzz
 */
export function playErrorChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
  gain.connect(ctx.destination);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.setValueAtTime(140, now + 0.1);
  osc.connect(gain);
  osc.start(now);
  osc.stop(now + 0.3);
}
