import { MayaEmotion, EmotionHistoryEntry, EMOTION_MAP } from './types';

type Listener = (state: EmotionState) => void;

export interface EmotionState {
  current: MayaEmotion;
  intensity: number; // 0 - 100
  lastUpdated: number;
  history: EmotionHistoryEntry[];
}

class EmotionStore {
  private state: EmotionState = {
    current: 'calm',
    intensity: 60,
    lastUpdated: Date.now(),
    history: [
      { timestamp: Date.now() - 30000, emotion: 'calm', intensity: 50 },
      { timestamp: Date.now() - 15000, emotion: 'focused', intensity: 70 },
      { timestamp: Date.now(), emotion: 'calm', intensity: 60 },
    ],
  };

  private listeners: Set<Listener> = new Set();
  private driftTimer: any = null;

  constructor() {
    this.applyCssVariables();
    this.scheduleDriftCheck();
  }

  public getState(): EmotionState {
    return { ...this.state, history: [...this.state.history] };
  }

  public setEmotion(emotion: MayaEmotion | string, intensity: number = 70, logEvent?: (msg: string) => void) {
    const validEmotion: MayaEmotion = (
      emotion in EMOTION_MAP ? emotion : 'calm'
    ) as MayaEmotion;

    const clampedIntensity = Math.max(10, Math.min(100, Math.round(intensity)));

    if (this.state.current === validEmotion && Math.abs(this.state.intensity - clampedIntensity) < 5) {
      this.state.lastUpdated = Date.now();
      return;
    }

    const prev = this.state.current;
    this.state.current = validEmotion;
    this.state.intensity = clampedIntensity;
    this.state.lastUpdated = Date.now();

    this.state.history.push({
      timestamp: Date.now(),
      emotion: validEmotion,
      intensity: clampedIntensity,
    });

    if (this.state.history.length > 30) {
      this.state.history.shift();
    }

    this.applyCssVariables();
    this.notify();
    this.scheduleDriftCheck();

    if (logEvent && prev !== validEmotion) {
      logEvent(`EMOTION SHIFT: ${prev.toUpperCase()} -> ${validEmotion.toUpperCase()} (INTENSITY ${clampedIntensity}%)`);
    }
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const current = this.getState();
    this.listeners.forEach((l) => l(current));
  }

  private applyCssVariables() {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const profile = EMOTION_MAP[this.state.current] || EMOTION_MAP.calm;
    const normIntensity = this.state.intensity / 100;

    // Soft glow (max 12px, max 25% opacity)
    const glowAlpha = Math.min(0.25, 0.12 + normIntensity * 0.13);
    const glowValue = profile.glowRgba(glowAlpha);

    root.style.setProperty('--accent', profile.color);
    root.style.setProperty('--glow', glowValue);
    root.style.setProperty('--anim-speed', `${profile.speed * (0.8 + normIntensity * 0.4)}`);
    root.style.setProperty('--brightness', `${profile.brightness}`);
  }

  private scheduleDriftCheck() {
    if (this.driftTimer) {
      clearTimeout(this.driftTimer);
    }

    // 90s without update drifts smoothly back to calm
    this.driftTimer = setTimeout(() => {
      if (this.state.current !== 'calm') {
        this.setEmotion('calm', 50);
      }
    }, 90000);
  }
}

export const emotionStore = new EmotionStore();
