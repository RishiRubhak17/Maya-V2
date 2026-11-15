export type WakeEngineState =
  | 'BOOT'
  | 'UNARMED'
  | 'ARMED'
  | 'WAKE_HEARD'
  | 'ACTIVE'
  | 'COOLDOWN';

export type WakeSensitivity = 'strict' | 'normal' | 'loose';

export interface WakeEngineConfig {
  sensitivity: WakeSensitivity;
  enabled: boolean;
  onWake: (trailingCommand: string) => void;
  onHeardText?: (text: string) => void;
  onStateChange: (state: WakeEngineState) => void;
  onError?: (error: string) => void;
  onLog?: (message: string) => void;
}

export interface WakeEngine {
  init(): Promise<boolean>;
  arm(): Promise<void>;
  disarm(): void;
  pauseForLiveSession(): Promise<void>;
  resumeAfterLiveSession(): Promise<void>;
  getState(): WakeEngineState;
  isSupported(): boolean;
  destroy(): void;
}
