/**
 * PCM Audio Processing Utilities for Gemini Live API
 * Input: 16 kHz 16-bit PCM LE mono
 * Output: 24 kHz 16-bit PCM LE mono
 */

/**
 * Resamples a Float32Array from fromSampleRate to toSampleRate
 * using linear interpolation. Essential because browser AudioContext
 * on macOS, Windows, and Linux hardware defaults to 44.1kHz or 48kHz,
 * whereas Gemini Live expects exactly 16000 Hz.
 */
export function resampleAudioBuffer(
  input: Float32Array,
  fromSampleRate: number,
  toSampleRate: number
): Float32Array {
  if (fromSampleRate === toSampleRate || input.length === 0) {
    return input;
  }

  const ratio = fromSampleRate / toSampleRate;
  const newLength = Math.round(input.length / ratio);
  const result = new Float32Array(newLength);

  for (let i = 0; i < newLength; i++) {
    const origIndex = i * ratio;
    const indexLow = Math.floor(origIndex);
    const indexHigh = Math.min(indexLow + 1, input.length - 1);
    const weight = origIndex - indexLow;
    result[i] = input[indexLow] * (1 - weight) + input[indexHigh] * weight;
  }

  return result;
}

/**
 * Converts Float32 [-1.0, 1.0] samples to 16-bit little-endian PCM ArrayBuffer.
 */
export function floatTo16BitPCM(input: Float32Array): ArrayBuffer {
  const output = new DataView(new ArrayBuffer(input.length * 2));
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); // little-endian
  }
  return output.buffer;
}

/**
 * Converts an ArrayBuffer to a base64 string.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Decodes a base64-encoded 16-bit little-endian PCM chunk to Float32Array.
 */
export function base64ToFloat32Array(base64: string): Float32Array {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const dataView = new DataView(bytes.buffer);
  const samples = new Float32Array(bytes.length / 2);
  for (let i = 0; i < samples.length; i++) {
    const int16 = dataView.getInt16(i * 2, true);
    samples[i] = int16 < 0 ? int16 / 0x8000 : int16 / 0x7fff;
  }
  return samples;
}

/**
 * Gapless, jitter-buffered PCM audio player for 24kHz model output.
 */
export class BufferedAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private nextStartTime: number = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private onSpeakingChange: ((isSpeaking: boolean) => void) | null = null;
  private speakingDebounceTimer: any = null;
  private isCurrentlySpeaking: boolean = false;

  constructor(onSpeakingChange?: (isSpeaking: boolean) => void) {
    if (onSpeakingChange) {
      this.onSpeakingChange = onSpeakingChange;
    }
  }

  public getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass({ sampleRate: 24000 });
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.connect(this.audioCtx.destination);
    }

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  public getAnalyser(): AnalyserNode | null {
    if (!this.analyser) {
      this.getAudioContext();
    }
    return this.analyser;
  }

  public queuePcmChunk(base64Chunk: string, externalAnalyser?: AnalyserNode) {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const float32 = base64ToFloat32Array(base64Chunk);
      if (float32.length === 0) return;

      const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      // Connect source once through the analyser to destination
      const targetAnalyser = externalAnalyser || this.analyser;
      if (targetAnalyser) {
        source.connect(targetAnalyser);
      } else {
        source.connect(ctx.destination);
      }

      const now = ctx.currentTime;
      // Add a small 20ms lookahead safety buffer against audio pipeline underruns
      const startTime = Math.max(now + 0.02, this.nextStartTime);
      source.start(startTime);
      this.nextStartTime = startTime + audioBuffer.duration;

      this.activeSources.push(source);
      this.setSpeaking(true);

      source.onended = () => {
        const index = this.activeSources.indexOf(source);
        if (index > -1) {
          this.activeSources.splice(index, 1);
        }

        // Only transition to not speaking if all chunks finished and buffer drained
        if (this.activeSources.length === 0 && ctx.currentTime >= this.nextStartTime - 0.08) {
          this.setSpeaking(false);
        }
      };
    } catch (err) {
      console.error('[PCM Audio Player] Error queueing chunk:', err);
    }
  }

  public stopAll() {
    if (this.speakingDebounceTimer) {
      clearTimeout(this.speakingDebounceTimer);
      this.speakingDebounceTimer = null;
    }

    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch (e) {
        // ignore
      }
    }
    this.activeSources = [];

    if (this.audioCtx) {
      this.nextStartTime = this.audioCtx.currentTime;
    } else {
      this.nextStartTime = 0;
    }

    this.isCurrentlySpeaking = false;
    this.onSpeakingChange?.(false);
  }

  public close() {
    this.stopAll();
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (e) {
        // ignore
      }
      this.audioCtx = null;
      this.analyser = null;
    }
  }

  private setSpeaking(speaking: boolean) {
    if (!this.onSpeakingChange) return;

    if (speaking) {
      if (this.speakingDebounceTimer) {
        clearTimeout(this.speakingDebounceTimer);
        this.speakingDebounceTimer = null;
      }
      if (!this.isCurrentlySpeaking) {
        this.isCurrentlySpeaking = true;
        this.onSpeakingChange(true);
      }
    } else {
      // 220ms grace window to bridge brief network packet intervals
      if (this.speakingDebounceTimer) clearTimeout(this.speakingDebounceTimer);
      this.speakingDebounceTimer = setTimeout(() => {
        if (this.activeSources.length === 0) {
          this.isCurrentlySpeaking = false;
          this.onSpeakingChange?.(false);
        }
      }, 220);
    }
  }
}
