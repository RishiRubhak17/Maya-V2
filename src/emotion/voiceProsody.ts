import { MayaEmotion } from './types';
import { MayaMode } from '../types';

export interface EmotionProsodyBase {
  /** Target Web Speech API pitch multiplier (1.0 = neutral, >1 = higher, <1 = lower) */
  pitch: number;
  /** Target speaking rate multiplier (1.0 = neutral, >1 = faster, <1 = slower) */
  rate: number;
  /** Target output volume (0.0 - 1.0) */
  volume: number;
  /** Vocal delivery instruction for Gemini TTS speechMetadata.style */
  stylePrompt: string;
}

export interface ResolvedVoiceProsody {
  emotion: MayaEmotion;
  intensity: number;
  pitch: number;
  rate: number;
  audioPlaybackRate: number;
  volume: number;
  stylePrompt: string;
}

export const EMOTION_PROSODY_MAP: Record<MayaEmotion, EmotionProsodyBase> = {
  calm: {
    pitch: 0.94,
    rate: 0.92,
    volume: 0.92,
    stylePrompt: 'Composed, grounded, slightly lower pitch, unhurried and steady executive cadence',
  },
  happy: {
    pitch: 1.09,
    rate: 1.06,
    volume: 0.98,
    stylePrompt: 'Warm, cheerful, gently lifted pitch, bright and welcoming cadence',
  },
  excited: {
    pitch: 1.18,
    rate: 1.15,
    volume: 1.0,
    stylePrompt: 'Energetic, upbeat, noticeably higher bright pitch, lively and enthusiastic pace',
  },
  playful: {
    pitch: 1.12,
    rate: 1.08,
    volume: 0.96,
    stylePrompt: 'Lighthearted, expressive, subtly higher pitch with playful rhythmic inflection',
  },
  shy: {
    pitch: 1.04,
    rate: 0.9,
    volume: 0.84,
    stylePrompt: 'Soft-spoken, gentle, slightly tentative and delicate tone at an unhurried pace',
  },
  caring: {
    pitch: 0.91,
    rate: 0.87,
    volume: 0.9,
    stylePrompt: 'Warm, tender, soothing lower-mid pitch, unhurried and deeply empathetic cadence',
  },
  focused: {
    pitch: 0.97,
    rate: 1.02,
    volume: 0.96,
    stylePrompt: 'Crisp, articulate, balanced mid-low pitch, clean and purposeful delivery',
  },
  serious: {
    pitch: 0.87,
    rate: 0.93,
    volume: 0.98,
    stylePrompt: 'Deep, grave, lowered authoritative pitch, deliberate and measured tactical delivery',
  },
  sad: {
    pitch: 0.85,
    rate: 0.82,
    volume: 0.85,
    stylePrompt: 'Quiet, subdued, lower melancholic pitch, slow and gentle cadence',
  },
  surprised: {
    pitch: 1.2,
    rate: 1.12,
    volume: 1.0,
    stylePrompt: 'Alert, bright, elevated pitch with crisp inquisitive energy and quick onset',
  },
  annoyed: {
    pitch: 0.95,
    rate: 1.09,
    volume: 0.97,
    stylePrompt: 'Curt, dry, slightly clipped cadence with firm mid-low edge',
  },
  sleepy: {
    pitch: 0.84,
    rate: 0.78,
    volume: 0.8,
    stylePrompt: 'Drowsy, hushed, low relaxed pitch, very slow and soft late-night delivery',
  },
  missing_you: {
    pitch: 0.93,
    rate: 0.88,
    volume: 0.88,
    stylePrompt: 'Soft, affectionate, warm lower-mid tone with gentle unhurried pacing',
  },
  proud: {
    pitch: 1.07,
    rate: 1.04,
    volume: 1.0,
    stylePrompt: 'Confident, beaming, uplifted warm tone with poised and resonant delivery',
  },
  playful_pout: {
    pitch: 1.08,
    rate: 0.98,
    volume: 0.94,
    stylePrompt: 'Lightly teasing, expressive inflection with a brief mock-serious lilt',
  },
  comforting: {
    pitch: 0.89,
    rate: 0.85,
    volume: 0.88,
    stylePrompt: 'Reassuring, calm, low velvety tone, slow and grounding empathetic cadence',
  },
};

const MODE_PROSODY_OFFSET: Partial<Record<MayaMode, { pitchDelta: number; rateDelta: number; cue: string }>> = {
  COMMAND: { pitchDelta: -0.02, rateDelta: 0.04, cue: 'decisive executive clarity' },
  BUILDER: { pitchDelta: 0.0, rateDelta: 0.0, cue: 'precise technical articulation' },
  SENTINEL: { pitchDelta: -0.05, rateDelta: -0.04, cue: 'vigilant security briefing tone' },
  BRIEF: { pitchDelta: 0.02, rateDelta: 0.06, cue: 'crisp concise briefing pace' },
  CHILL: { pitchDelta: 0.03, rateDelta: -0.03, cue: 'relaxed conversational ease' },
};

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

/**
 * Compute dynamic pitch, rate, volume, and Gemini TTS style metadata
 * from the active MayaEmotion, intensity (0-100), operational mode, and user baseline rate.
 */
export function getEmotionProsody(
  emotion: MayaEmotion | string = 'calm',
  intensity: number = 60,
  mode?: MayaMode,
  baseSpeakingRate: number = 1.0
): ResolvedVoiceProsody {
  const validEmotion: MayaEmotion =
    emotion in EMOTION_PROSODY_MAP ? (emotion as MayaEmotion) : 'calm';
  const base = EMOTION_PROSODY_MAP[validEmotion];

  const clampedIntensity = clamp(Number.isFinite(intensity) ? intensity : 60, 0, 100);
  // Scale deviation from neutral (1.0) smoothly by emotional intensity (0.45 floor -> 1.0 full)
  const scale = 0.45 + (clampedIntensity / 100) * 0.55;

  let pitch = 1.0 + (base.pitch - 1.0) * scale;
  let rate = 1.0 + (base.rate - 1.0) * scale;

  const modeOffset = mode ? MODE_PROSODY_OFFSET[mode] : undefined;
  if (modeOffset) {
    pitch += modeOffset.pitchDelta;
    rate += modeOffset.rateDelta;
  }

  const safeBaseRate = clamp(Number.isFinite(baseSpeakingRate) ? baseSpeakingRate : 1.0, 0.7, 1.5);
  const finalRate = clamp(Number((rate * safeBaseRate).toFixed(3)), 0.65, 1.5);
  const finalPitch = clamp(Number(pitch.toFixed(3)), 0.7, 1.4);

  // Subtle playbackRate adjustment for pre-rendered Gemini WAV audio (keeps vocal quality natural)
  const audioPlaybackRate = clamp(Number((rate * safeBaseRate).toFixed(3)), 0.84, 1.22);

  const intensityCue =
    clampedIntensity >= 80 ? 'strongly' : clampedIntensity <= 35 ? 'subtly' : 'naturally';
  const stylePrompt = modeOffset
    ? `${base.stylePrompt}, expressed ${intensityCue}, with ${modeOffset.cue}`
    : `${base.stylePrompt}, expressed ${intensityCue}`;

  return {
    emotion: validEmotion,
    intensity: clampedIntensity,
    pitch: finalPitch,
    rate: finalRate,
    audioPlaybackRate,
    volume: clamp(base.volume, 0.7, 1.0),
    stylePrompt,
  };
}
