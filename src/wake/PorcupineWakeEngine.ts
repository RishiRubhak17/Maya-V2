import { WakeEngine, WakeEngineConfig, WakeEngineState } from './types';

/**
 * PorcupineWakeEngine (Desktop / Electron Target Stub)
 *
 * NOTE FOR ELECTRON DESKTOP PACKAGING:
 * In Chromium / Electron runtimes on Windows and Linux, `window.SpeechRecognition`
 * is disabled or requires proprietary Google Cloud speech credentials.
 *
 * For native desktop packaging:
 * 1. Install `@picovoice/porcupine-node` or `@picovoice/porcupine-web` + `@picovoice/web-voice-processor`.
 * 2. In `preload.js` or main process, initialize Porcupine with custom keyword model `hey_maya_windows.ppn`.
 * 3. Stream microphone frames from native PortAudio / node-record-lpcm16.
 * 4. When keyword index >= 0 triggers, dispatch `onWake(trailingSpeech)`.
 */
export class PorcupineWakeEngine implements WakeEngine {
  private config: WakeEngineConfig;
  private state: WakeEngineState = 'BOOT';

  constructor(config: WakeEngineConfig) {
    this.config = config;
  }

  public isSupported(): boolean {
    // True when running inside Electron with native Porcupine preload bridge
    return typeof window !== 'undefined' && Boolean((window as any).maya?.porcupine);
  }

  public getState(): WakeEngineState {
    return this.state;
  }

  public async init(): Promise<boolean> {
    // TODO (Desktop Phase):
    // const porcupine = await window.maya.porcupine.init({
    //   accessKey: process.env.PICOVOICE_ACCESS_KEY,
    //   keywordPath: 'resources/models/hey_maya.ppn',
    //   sensitivity: this.config.sensitivity === 'strict' ? 0.4 : 0.7
    // });
    this.config.onLog?.('[PORCUPINE STUB] Native engine ready for Electron packaging.');
    this.state = 'UNARMED';
    this.config.onStateChange(this.state);
    return true;
  }

  public async arm(): Promise<void> {
    // TODO (Desktop Phase):
    // window.maya.porcupine.startListening();
    this.state = 'ARMED';
    this.config.onStateChange(this.state);
  }

  public disarm(): void {
    // TODO (Desktop Phase):
    // window.maya.porcupine.stopListening();
    this.state = 'UNARMED';
    this.config.onStateChange(this.state);
  }

  public async pauseForLiveSession(): Promise<void> {
    // TODO (Desktop Phase):
    // window.maya.porcupine.pause();
    this.state = 'ACTIVE';
    this.config.onStateChange(this.state);
  }

  public async resumeAfterLiveSession(): Promise<void> {
    // TODO (Desktop Phase):
    // window.maya.porcupine.resume();
    this.state = 'COOLDOWN';
    this.config.onStateChange(this.state);
    setTimeout(() => {
      this.state = 'ARMED';
      this.config.onStateChange(this.state);
    }, 1500);
  }

  public destroy(): void {
    this.disarm();
  }
}
