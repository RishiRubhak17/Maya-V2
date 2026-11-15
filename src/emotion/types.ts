export type MayaEmotion =
  | 'calm'
  | 'happy'
  | 'excited'
  | 'playful'
  | 'shy'
  | 'caring'
  | 'focused'
  | 'serious'
  | 'sad'
  | 'surprised'
  | 'annoyed'
  | 'sleepy'
  | 'missing_you'
  | 'proud'
  | 'playful_pout'
  | 'comforting';

export interface EmotionProfile {
  color: string;
  glowRgba: (alpha: number) => string;
  speed: number;
  glow: number;
  brightness: number;
  description: string;
  typingDelayMin: number;
  typingDelayMax: number;
  coreBehavior?: string;
}

export interface EmotionHistoryEntry {
  timestamp: number;
  emotion: MayaEmotion;
  intensity: number; // 0 - 100
}

export const EMOTION_MAP: Record<MayaEmotion, EmotionProfile> = {
  calm: {
    color: '#d6d3cc',
    glowRgba: (a) => `rgba(214, 211, 204, ${a})`,
    speed: 1.0,
    glow: 0.35,
    brightness: 1.0,
    description: 'Speed 1, slow breathing, steady rings',
    typingDelayMin: 12,
    typingDelayMax: 18,
    coreBehavior: 'slow-breathing',
  },
  happy: {
    color: '#e6c27a',
    glowRgba: (a) => `rgba(230, 194, 122, ${a})`,
    speed: 1.3,
    glow: 0.5,
    brightness: 1.1,
    description: 'Speed 1.3, warm glow up, brief ring flutter',
    typingDelayMin: 9,
    typingDelayMax: 14,
    coreBehavior: 'ring-flutter',
  },
  excited: {
    color: '#efa45f',
    glowRgba: (a) => `rgba(239, 164, 95, ${a})`,
    speed: 2.0,
    glow: 0.7,
    brightness: 1.25,
    description: 'Speed 2, bright glow, fast core pulses',
    typingDelayMin: 7,
    typingDelayMax: 11,
    coreBehavior: 'fast-pulses',
  },
  playful: {
    color: '#d98fa0',
    glowRgba: (a) => `rgba(217, 143, 160, ${a})`,
    speed: 1.25,
    glow: 0.45,
    brightness: 1.05,
    description: 'Ring segments shift unevenly, light wobble',
    typingDelayMin: 10,
    typingDelayMax: 15,
    coreBehavior: 'wobble',
  },
  shy: {
    color: '#e3a1b0',
    glowRgba: (a) => `rgba(227, 161, 176, ${a})`,
    speed: 0.75,
    glow: 0.25,
    brightness: 0.85,
    description: 'Core shrinks and dims, rings slow, soft flicker',
    typingDelayMin: 16,
    typingDelayMax: 24,
    coreBehavior: 'shrink-flicker',
  },
  caring: {
    color: '#c9b08f',
    glowRgba: (a) => `rgba(201, 176, 143, ${a})`,
    speed: 0.9,
    glow: 0.45,
    brightness: 1.0,
    description: 'Slow warm pulse, glow up gently',
    typingDelayMin: 13,
    typingDelayMax: 19,
    coreBehavior: 'warm-pulse',
  },
  focused: {
    color: '#bdbdb8',
    glowRgba: (a) => `rgba(189, 189, 184, ${a})`,
    speed: 1.0,
    glow: 0.38,
    brightness: 1.0,
    description: 'Tight steady rings, sharp tick marks, minimal motion',
    typingDelayMin: 10,
    typingDelayMax: 14,
    coreBehavior: 'tight-steady',
  },
  serious: {
    color: '#c4524f',
    glowRgba: (a) => `rgba(196, 82, 79, ${a})`,
    speed: 0.85,
    glow: 0.4,
    brightness: 0.95,
    description: 'Segments lock, brief double-flash',
    typingDelayMin: 15,
    typingDelayMax: 22,
    coreBehavior: 'lock-flash',
  },
  sad: {
    color: '#8f8a99',
    glowRgba: (a) => `rgba(143, 138, 153, ${a})`,
    speed: 0.6,
    glow: 0.2,
    brightness: 0.7,
    description: 'Slow rotation, dim glow, drooping core scale',
    typingDelayMin: 20,
    typingDelayMax: 30,
    coreBehavior: 'droop-dim',
  },
  surprised: {
    color: '#efe3b0',
    glowRgba: (a) => `rgba(239, 227, 176, ${a})`,
    speed: 1.6,
    glow: 0.65,
    brightness: 1.25,
    description: 'One-frame flash, core expands then settles',
    typingDelayMin: 8,
    typingDelayMax: 13,
    coreBehavior: 'expand-settle',
  },
  annoyed: {
    color: '#b8603f',
    glowRgba: (a) => `rgba(184, 96, 63, ${a})`,
    speed: 1.35,
    glow: 0.4,
    brightness: 0.95,
    description: 'Small jitter on ring 2, quick scan sweeps',
    typingDelayMin: 11,
    typingDelayMax: 16,
    coreBehavior: 'ring2-jitter',
  },
  sleepy: {
    color: '#6a665e',
    glowRgba: (a) => `rgba(106, 102, 94, ${a})`,
    speed: 0.25,
    glow: 0.12,
    brightness: 0.6,
    description: 'Very slow rotation, dim, slow blink of the core',
    typingDelayMin: 22,
    typingDelayMax: 34,
    coreBehavior: 'slow-blink',
  },
  missing_you: {
    color: '#e0b0b8',
    glowRgba: (a) => `rgba(224, 176, 184, ${a})`,
    speed: 0.85,
    glow: 0.45,
    brightness: 1.05,
    description: 'Missing you softly, gentle warm breathing',
    typingDelayMin: 13,
    typingDelayMax: 20,
    coreBehavior: 'gentle-breathing',
  },
  proud: {
    color: '#f0c27a',
    glowRgba: (a) => `rgba(240, 194, 122, ${a})`,
    speed: 1.35,
    glow: 0.65,
    brightness: 1.2,
    description: "Proud of Sirius's wins, bright confident core",
    typingDelayMin: 9,
    typingDelayMax: 14,
    coreBehavior: 'bright-core',
  },
  playful_pout: {
    color: '#df8f9f',
    glowRgba: (a) => `rgba(223, 143, 159, ${a})`,
    speed: 1.1,
    glow: 0.4,
    brightness: 1.0,
    description: 'Mild playful pout for one beat, then a warm smile',
    typingDelayMin: 11,
    typingDelayMax: 16,
    coreBehavior: 'wobble-smile',
  },
  comforting: {
    color: '#d2bba0',
    glowRgba: (a) => `rgba(210, 187, 160, ${a})`,
    speed: 0.8,
    glow: 0.5,
    brightness: 1.05,
    description: 'Soothing warm embrace, empathetic listener',
    typingDelayMin: 14,
    typingDelayMax: 21,
    coreBehavior: 'warm-pulse',
  },
};
