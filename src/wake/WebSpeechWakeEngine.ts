import { WakeEngine, WakeEngineConfig, WakeEngineState } from './types';
import { matchWakeWord } from './fuzzyMatcher';

// Polyfill SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export class WebSpeechWakeEngine implements WakeEngine {
  private config: WakeEngineConfig;
  private state: WakeEngineState = 'BOOT';
  private recognition: any = null;
  private isDestroyed: boolean = false;
  private shouldBeListening: boolean = false;
  private lastTriggerTime: number = 0;
  private lastActivityTime: number = 0;
  private watchdogInterval: any = null;
  private restartTimeout: any = null;
  private restartBackoffMs: number = 250;
  private isStoppingForLive: boolean = false;
  private stopPromiseResolve: (() => void) | null = null;
  private keepAliveStream: MediaStream | null = null;

  constructor(config: WakeEngineConfig) {
    this.config = config;
  }

  public isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  public getState(): WakeEngineState {
    return this.state;
  }

  public async init(): Promise<boolean> {
    if (!this.isSupported()) {
      this.config.onError?.(
        'Web Speech API is not supported in this browser. Please use Google Chrome, Brave, or Microsoft Edge.'
      );
      this.setState('UNARMED');
      return false;
    }

    this.setState('UNARMED');
    return true;
  }

  public async arm(): Promise<void> {
    if (!this.isSupported()) return;
    this.shouldBeListening = true;
    this.restartBackoffMs = 50;

    // Maintain a warm hardware microphone handle to eliminate audio device spin-up pops and latency
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia && !this.keepAliveStream) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        this.keepAliveStream = stream;
        this.config.onLog?.('HARDWARE MIC: Continuous hardware stream locked. Zero-buffer listener ready.');
      } catch (e: any) {
        this.config.onLog?.(`HARDWARE MIC: Hardware lock notice: ${e?.message || e}`);
      }
    }

    this.createAndStartRecognizer();
    this.startWatchdog();
    this.setState('ARMED');
    this.config.onLog?.('WAKE ENGINE: Armed in listen mode (Lang: en-IN, continuous).');
  }

  public disarm(): void {
    this.shouldBeListening = false;
    this.clearWatchdog();
    this.clearRestartTimeout();
    this.stopRecognizer();
    this.setState('UNARMED');
    this.config.onLog?.('WAKE ENGINE: Disarmed.');
  }

  /**
   * Mic arbitration: Stop the recognizer completely and wait for onend
   * before live audio stream takes over the hardware mic.
   */
  public async pauseForLiveSession(): Promise<void> {
    this.shouldBeListening = false;
    this.isStoppingForLive = true;
    this.clearWatchdog();
    this.clearRestartTimeout();

    if (this.recognition) {
      await new Promise<void>((resolve) => {
        this.stopPromiseResolve = resolve;
        try {
          this.recognition.stop();
        } catch (e) {
          resolve();
        }
        // Safety fallback if onend fails to trigger
        setTimeout(() => {
          if (this.stopPromiseResolve) {
            this.stopPromiseResolve();
            this.stopPromiseResolve = null;
          }
        }, 600);
      });
    }

    this.isStoppingForLive = false;
    this.setState('ACTIVE');
    this.config.onLog?.('WAKE ENGINE: Paused for active Live Audio session (Mic arbitrated).');
  }

  /**
   * Resume wake listener after Live audio stream is released.
   */
  public async resumeAfterLiveSession(): Promise<void> {
    this.setState('COOLDOWN');
    this.config.onLog?.('WAKE ENGINE: Entering cooldown phase before re-arming.');

    setTimeout(() => {
      if (!this.isDestroyed && this.config.enabled) {
        this.arm();
      } else {
        this.setState('UNARMED');
      }
    }, 1500);
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.disarm();
  }

  private setState(newState: WakeEngineState) {
    this.state = newState;
    this.config.onStateChange(newState);
  }

  private createAndStartRecognizer() {
    if (this.isDestroyed || !this.shouldBeListening) return;

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) return;

      if (this.recognition) {
        try {
          this.recognition.abort();
        } catch (e) {
          // ignore
        }
        this.recognition = null;
      }

      const rec = new SpeechRecognition();
      rec.lang = 'en-IN';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 5;

      rec.onstart = () => {
        this.lastActivityTime = Date.now();
        this.restartBackoffMs = 250;
      };

      rec.onresult = (event: any) => {
        this.lastActivityTime = Date.now();
        if (!this.shouldBeListening || this.state !== 'ARMED') return;

        let detectedWake = false;
        let trailingCmd = '';

        // Iterate through all results and all alternatives
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          for (let a = 0; a < res.length; ++a) {
            const transcript = res[a].transcript || '';
            if (transcript.trim()) {
              this.config.onHeardText?.(transcript);
            }

            const match = matchWakeWord(transcript, this.config.sensitivity);
            if (match.matched) {
              const now = Date.now();
              // 2.5s cooldown against double triggers
              if (now - this.lastTriggerTime > 2500) {
                this.lastTriggerTime = now;
                detectedWake = true;
                trailingCmd = match.trailingCommand;
                break;
              }
            }
          }
          if (detectedWake) break;
        }

        if (detectedWake) {
          this.config.onLog?.(`WAKE DETECTED: "Hey Maya" recognized. Trailing command: "${trailingCmd || '(none)'}"`);
          this.setState('WAKE_HEARD');
          this.config.onWake(trailingCmd);
        }
      };

      rec.onerror = (event: any) => {
        const err = event.error;
        if (err === 'no-speech' || err === 'aborted') {
          // Silent restart
          return;
        }

        if (err === 'not-allowed' || err === 'service-not-allowed') {
          this.config.onError?.(
            'Microphone access denied. Please click the padlock icon in your browser address bar to allow microphone access.'
          );
          this.shouldBeListening = false;
          this.setState('UNARMED');
          return;
        }

        if (err === 'network') {
          this.config.onLog?.('WAKE ENGINE: Speech recognition network timeout, auto-retrying with backoff.');
        } else {
          this.config.onLog?.(`WAKE ENGINE NOTICE: Recognition event '${err}'`);
        }
      };

      rec.onend = () => {
        if (this.stopPromiseResolve) {
          this.stopPromiseResolve();
          this.stopPromiseResolve = null;
        }

        if (!this.shouldBeListening || this.isDestroyed || this.isStoppingForLive) {
          return;
        }

        // Instant 50ms seamless restart to keep microphone active with zero gaps
        this.clearRestartTimeout();
        this.restartTimeout = setTimeout(() => {
          if (this.shouldBeListening && !this.isDestroyed && !this.isStoppingForLive) {
            this.createAndStartRecognizer();
          }
        }, 50);
      };

      this.recognition = rec;
      rec.start();
      this.lastActivityTime = Date.now();
    } catch (err: any) {
      this.config.onLog?.(`WAKE ENGINE: Start notice: ${err?.message || err}`);
      // Retry in 200ms if initial start threw (e.g. rapid succession)
      this.clearRestartTimeout();
      this.restartTimeout = setTimeout(() => {
        if (this.shouldBeListening && !this.isDestroyed && !this.isStoppingForLive) {
          this.createAndStartRecognizer();
        }
      }, 200);
    }
  }

  private stopRecognizer() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        try {
          this.recognition.abort();
        } catch (e2) {
          // ignore
        }
      }
      this.recognition = null;
    }
  }

  private startWatchdog() {
    this.clearWatchdog();
    this.lastActivityTime = Date.now();

    // Check every 5s: if stalled for 15s while supposed to be listening, recreate recognizer
    this.watchdogInterval = setInterval(() => {
      if (!this.shouldBeListening || this.state !== 'ARMED') return;

      const elapsed = Date.now() - this.lastActivityTime;
      if (elapsed > 15000) {
        this.config.onLog?.('WAKE WATCHDOG: Re-syncing recognizer after 15s inactivity.');
        this.createAndStartRecognizer();
      }
    }, 5000);
  }

  private clearWatchdog() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }
  }

  private clearRestartTimeout() {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
  }
}
