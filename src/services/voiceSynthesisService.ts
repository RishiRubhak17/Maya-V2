import { emotionStore } from '../emotion/emotionStore';
import { MayaEmotion } from '../emotion/types';
import { getEmotionProsody, ResolvedVoiceProsody } from '../emotion/voiceProsody';
import { MayaMode } from '../types';
import { safeFetchJson } from '../utils/safeFetch';

export interface SpeakOptions {
  text: string;
  voice?: string;
  mode?: MayaMode;
  emotion?: MayaEmotion;
  intensity?: number;
  speakingRate?: number;
  maxLength?: number;
  preferServerTts?: boolean;
  onStart?: (prosody: ResolvedVoiceProsody) => void;
  onEnd?: () => void;
}

class VoiceSynthesisService {
  private activeAudio: HTMLAudioElement | null = null;

  public getCurrentProsody(
    mode?: MayaMode,
    speakingRate: number = 1.0,
    emotionOverride?: MayaEmotion,
    intensityOverride?: number
  ): ResolvedVoiceProsody {
    const state = emotionStore.getState();
    const activeEmotion = emotionOverride ?? state.current;
    const activeIntensity = intensityOverride ?? state.intensity;
    return getEmotionProsody(activeEmotion, activeIntensity, mode, speakingRate);
  }

  public sanitizeSpeechText(text: string, maxLength: number = 240): string {
    const cleaned = text
      .replace(/```[\s\S]*?```/g, 'Code block generated for review.')
      .replace(/[#*`_~>[\]()📅✅⚠️📋📝⏱️🕒🚀🌐💻]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    if (!cleaned) return '';

    const firstLine = cleaned.split('\n').filter(Boolean)[0] || cleaned;
    return firstLine.slice(0, maxLength).trim();
  }

  public stop(): void {
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch {
        // ignore
      }
      this.activeAudio = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }

  public async speak(options: SpeakOptions): Promise<void> {
    const {
      text,
      voice = 'Aoede',
      mode,
      emotion,
      intensity,
      speakingRate = 1.0,
      maxLength = 240,
      preferServerTts = true,
      onStart,
      onEnd,
    } = options;

    const spoken = this.sanitizeSpeechText(text, maxLength);
    if (!spoken) {
      onEnd?.();
      return;
    }

    const prosody = this.getCurrentProsody(mode, speakingRate, emotion, intensity);
    this.stop();

    if (preferServerTts) {
      try {
        const res = await safeFetchJson('/api/maya/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: spoken,
            voice,
            emotion: prosody.emotion,
            intensity: prosody.intensity,
            mode,
            speakingRate,
          }),
        });
        const data = res.data;

        if (res.ok && data?.ok && data?.audio) {
          const audio = new Audio(`data:${data.mimeType || 'audio/wav'};base64,${data.audio}`);
          const targetPlaybackRate =
            typeof data?.prosody?.audioPlaybackRate === 'number'
              ? data.prosody.audioPlaybackRate
              : prosody.audioPlaybackRate;

          if ('preservesPitch' in audio) {
            (audio as HTMLAudioElement & { preservesPitch: boolean }).preservesPitch = true;
          }
          audio.playbackRate = targetPlaybackRate;
          audio.volume = prosody.volume;

          this.activeAudio = audio;
          audio.onended = () => {
            if (this.activeAudio === audio) {
              this.activeAudio = null;
            }
            onEnd?.();
          };
          audio.onerror = () => {
            if (this.activeAudio === audio) {
              this.activeAudio = null;
            }
            this.speakWithBrowserSynthesis(spoken, prosody, onStart, onEnd);
          };

          onStart?.(prosody);
          await audio.play();
          return;
        }
      } catch {
        // Fall through to browser speechSynthesis with emotion prosody
      }
    }

    this.speakWithBrowserSynthesis(spoken, prosody, onStart, onEnd);
  }

  public speakWithBrowserSynthesis(
    text: string,
    prosody: ResolvedVoiceProsody,
    onStart?: (prosody: ResolvedVoiceProsody) => void,
    onEnd?: () => void
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);

      const available = window.speechSynthesis.getVoices();
      const preferred =
        available.find(
          (v) => (v.lang === 'en-IN' || v.lang === 'ta-IN') && /female|priya|sangeeta|veena/i.test(v.name)
        ) ||
        available.find((v) => v.lang === 'en-IN') ||
        available.find((v) =>
          /google uk english female|samantha|karen|moira|victoria|fiona/i.test(v.name)
        ) ||
        available.find((v) => v.lang.startsWith('en')) ||
        available[0];

      if (preferred) {
        utterance.voice = preferred;
      }

      utterance.pitch = prosody.pitch;
      utterance.rate = prosody.rate;
      utterance.volume = prosody.volume;

      utterance.onstart = () => onStart?.(prosody);
      utterance.onend = () => onEnd?.();
      utterance.onerror = () => onEnd?.();

      window.speechSynthesis.speak(utterance);
    } catch {
      onEnd?.();
    }
  }
}

export const voiceSynthesisService = new VoiceSynthesisService();
