import {
  floatTo16BitPCM,
  arrayBufferToBase64,
  resampleAudioBuffer,
  BufferedAudioPlayer,
} from './pcmAudio';
import { toolBridge } from '../tools/toolBridge';
import { emotionStore } from '../emotion/emotionStore';
import { VoiceprintEngine } from '../voice/voiceprintEngine';
import { VerificationResult } from '../voice/types';
import { safeFetchJson } from '../utils/safeFetch';
import { getFallbackResponse } from '../shared/mayaCore';
import { voiceSynthesisService } from '../services/voiceSynthesisService';
import { MayaMode } from '../types';

export type LiveVoiceState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';

export interface LiveSessionCallbacks {
  onStateChange: (state: LiveVoiceState) => void;
  onTranscript: (sender: 'sirius' | 'maya', text: string, isFinal?: boolean) => void;
  onLog: (message: string) => void;
  onAudioLevel?: (level: number) => void;
  onSessionEnded?: () => void;
  onEmotionChange?: (emotion: string, intensity: number) => void;
  onModeChange?: (mode: string) => void;
  onAddTask?: (task: any) => void;
  onCompleteTask?: (idOrTitle: string) => void;
  onSaveNote?: (note: any) => void;
  onVoiceVerified?: (result: VerificationResult) => void;
  onVoiceRejected?: (result: VerificationResult) => void;
}

export class LiveSessionManager {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private muteGain: GainNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private audioPlayer: BufferedAudioPlayer;
  private currentState: LiveVoiceState = 'IDLE';
  private callbacks: LiveSessionCallbacks;
  private silenceTimer: any = null;
  private levelAnimFrame: number | null = null;
  private isConnected: boolean = false;
  private isDisconnecting: boolean = false;
  private serverlessMode: boolean = false;
  private wsConnectTimeout: any = null;
  private recognition: any = null;
  private isHandlingTurn: boolean = false;
  private lastVoiceRejectedAt: number = 0;
  private serverlessHistory: Array<{ sender: 'sirius' | 'maya'; text: string }> = [];
  private voice: string = 'Aoede';
  private mode: string = 'COMMAND';
  private userName: string = 'Sirius';
  private affectionLevel: number = 2;
  private memoryContext: string = '';
  private voiceLockEnabled: boolean = true;
  private voiceLockSensitivity: number = 70;
  private unverifiedSpeechFrames: number = 0;

  constructor(callbacks: LiveSessionCallbacks) {
    this.callbacks = callbacks;
    this.audioPlayer = new BufferedAudioPlayer((isSpeaking) => {
      if (isSpeaking) {
        this.setState('SPEAKING');
      } else if (this.currentState === 'SPEAKING') {
        this.setState('LISTENING');
      }
    });
  }

  public setVoiceLockConfig(enabled: boolean, sensitivity: number = 70) {
    this.voiceLockEnabled = enabled;
    this.voiceLockSensitivity = sensitivity;
  }

  public updateCallbacks(newCallbacks: Partial<LiveSessionCallbacks>) {
    this.callbacks = { ...this.callbacks, ...newCallbacks };
  }

  public setMode(mode: string) {
    this.mode = mode;
  }

  public getState(): LiveVoiceState {
    return this.currentState;
  }

  public getAnalysers(): { input: AnalyserNode | null; output: AnalyserNode | null } {
    return {
      input: this.inputAnalyser,
      output: this.outputAnalyser || this.audioPlayer.getAnalyser(),
    };
  }

  public async connect(options?: {
    mode?: string;
    voice?: string;
    userName?: string;
    initialCommand?: string;
    affectionLevel?: number;
    memoryContext?: string;
  }): Promise<boolean> {
    this.mode = options?.mode || this.mode;
    this.voice = options?.voice || this.voice;
    this.userName = options?.userName || this.userName;
    this.affectionLevel = options?.affectionLevel ?? 2;
    this.memoryContext = options?.memoryContext || '';

    this.disconnect();
    this.isDisconnecting = false;
    this.serverlessMode = false;
    this.serverlessHistory = [];
    this.lastVoiceRejectedAt = 0;
    this.unverifiedSpeechFrames = 0;

    this.callbacks.onLog('LIVE SESSION: Connecting to Gemini Live bridge...');
    this.setState('THINKING');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live?mode=${encodeURIComponent(
        this.mode
      )}&voice=${encodeURIComponent(this.voice)}&user=${encodeURIComponent(
        this.userName
      )}&affection=${this.affectionLevel}${
        this.memoryContext ? `&memory=${encodeURIComponent(this.memoryContext)}` : ''
      }`;

      this.ws = new WebSocket(wsUrl);

      // Fallback cleanly to Serverless Voice Mode when hosted statically (e.g., Netlify) without WebSocket server
      this.wsConnectTimeout = setTimeout(() => {
        if (!this.isConnected && !this.isDisconnecting && !this.serverlessMode) {
          void this.activateServerlessVoiceMode(options?.initialCommand);
        }
      }, 2200);

      this.ws.onopen = async () => {
        if (this.wsConnectTimeout) {
          clearTimeout(this.wsConnectTimeout);
          this.wsConnectTimeout = null;
        }
        this.isConnected = true;
        this.callbacks.onLog('LIVE SESSION: WebSocket stream established. Activating microphone pipeline.');
        await this.startMicrophoneCapture();
        this.resetSilenceTimer();
        this.startLevelMonitoring();

        // If a command followed the wake word, send as initial turn
        if (options?.initialCommand && options.initialCommand.trim()) {
          const cmd = options.initialCommand.trim();
          this.callbacks.onLog(`LIVE SESSION: Forwarding wake command: "${cmd}"`);
          this.sendTextMessage(cmd);
          this.callbacks.onTranscript('sirius', cmd, true);
        } else {
          this.setState('LISTENING');
        }
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          this.resetSilenceTimer();

          if (data.type === 'audio' && data.audio) {
            // Queue model speech chunk
            const playerAnalyser = this.audioPlayer.getAnalyser();
            if (playerAnalyser) {
              this.outputAnalyser = playerAnalyser;
            }
            this.audioPlayer.queuePcmChunk(data.audio, this.outputAnalyser || undefined);
          } else if (data.type === 'text' && data.text) {
            // Text chunk
            this.callbacks.onTranscript('maya', data.text, false);
            this.checkExitCommand(data.text);
          } else if (data.type === 'output_transcript' && data.text) {
            // Clean output transcript
            let cleaned = data.text;
            const emotionMatch = cleaned.match(/\[emotion:([a-z]+):?(\d+)?\]/i);
            if (emotionMatch) {
              const em = emotionMatch[1].toLowerCase();
              const intensity = emotionMatch[2] ? parseInt(emotionMatch[2], 10) : 75;
              emotionStore.setEmotion(em, intensity, this.callbacks.onLog);
              this.callbacks.onEmotionChange?.(em, intensity);
              cleaned = cleaned.replace(/\[emotion:[a-z]+:?\d*\]/gi, '').trim();
            }
            if (cleaned) {
              this.callbacks.onTranscript('maya', cleaned, true);
            }
          } else if (data.type === 'input_transcript' && data.text) {
            this.callbacks.onTranscript('sirius', data.text, true);
            this.checkExitCommand(data.text);
          } else if (data.type === 'interrupted') {
            this.callbacks.onLog('LIVE SESSION: Barge-in acknowledged by model. Playback flushed.');
            this.audioPlayer.stopAll();
            this.setState('LISTENING');
          } else if (data.type === 'turn_complete') {
            if (this.currentState === 'THINKING') {
              this.setState('LISTENING');
            }
          } else if (data.type === 'tool_call' && data.toolCall) {
            await this.handleToolCall(data.toolCall);
          } else if (data.type === 'status') {
            this.callbacks.onLog(`LIVE SESSION STATUS: ${data.status} ${data.message || ''}`);
          } else if (data.type === 'error') {
            this.callbacks.onLog(`LIVE SESSION NOTICE: ${data.error}`);
          }
        } catch (err) {
          console.error('Error handling live socket message:', err);
        }
      };

      this.ws.onerror = () => {
        if (!this.isConnected && !this.isDisconnecting && !this.serverlessMode) {
          void this.activateServerlessVoiceMode(options?.initialCommand);
        } else {
          this.callbacks.onLog('LIVE SESSION WS ERROR: Transport event.');
        }
      };

      this.ws.onclose = () => {
        if (!this.isConnected && !this.isDisconnecting && !this.serverlessMode) {
          void this.activateServerlessVoiceMode(options?.initialCommand);
          return;
        }
        if (this.isConnected && !this.serverlessMode && !this.isDisconnecting) {
          this.callbacks.onLog('LIVE SESSION: Socket closed.');
          this.disconnect();
        }
      };

      return true;
    } catch (err: any) {
      this.callbacks.onLog(`LIVE SESSION FALLBACK: ${err?.message || err}`);
      await this.activateServerlessVoiceMode(options?.initialCommand);
      return true;
    }
  }

  private async activateServerlessVoiceMode(initialCommand?: string): Promise<void> {
    if (this.serverlessMode || this.isDisconnecting) return;
    this.serverlessMode = true;
    this.isConnected = true;

    if (this.wsConnectTimeout) {
      clearTimeout(this.wsConnectTimeout);
      this.wsConnectTimeout = null;
    }

    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    this.callbacks.onLog('LIVE SESSION: Serverless Voice Mode engaged (Speech Recognition + /api/maya/chat).');
    await this.startMicrophoneCapture();
    this.startLevelMonitoring();
    this.resetSilenceTimer();

    if (initialCommand && initialCommand.trim()) {
      await this.handleServerlessTurn(initialCommand.trim());
    } else {
      this.setState('LISTENING');
      this.startServerlessRecognition();
    }
  }

  private startServerlessRecognition(): void {
    if (!this.serverlessMode || this.isDisconnecting || this.currentState === 'SPEAKING' || this.isHandlingTurn) {
      return;
    }

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      this.callbacks.onLog('LIVE SESSION: Browser SpeechRecognition unavailable; type commands or use Chrome/Edge.');
      this.setState('LISTENING');
      return;
    }

    this.stopServerlessRecognition();

    try {
      const rec = new SpeechRec();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'en-IN';
      rec.maxAlternatives = 1;

      rec.onresult = (event: any) => {
        if (!this.serverlessMode || this.isDisconnecting || this.isHandlingTurn) return;
        const resultIdx = event.results.length - 1;
        const transcript = event.results[resultIdx]?.[0]?.transcript?.trim();
        if (!transcript) return;

        // If Voice Biometrics rejected the active speaker within the last 4 seconds, discard transcript
        if (this.voiceLockEnabled && VoiceprintEngine.hasProfile() && Date.now() - this.lastVoiceRejectedAt < 4000) {
          this.callbacks.onLog('VOICE LOCK: Discarded speech transcript from unverified speaker.');
          return;
        }

        this.resetSilenceTimer();
        void this.handleServerlessTurn(transcript);
      };

      rec.onerror = (event: any) => {
        if (event?.error && event.error !== 'no-speech' && event.error !== 'aborted') {
          this.callbacks.onLog(`VOICE RECOGNITION NOTICE: ${event.error}`);
        }
      };

      rec.onend = () => {
        if (
          this.serverlessMode &&
          !this.isDisconnecting &&
          this.currentState === 'LISTENING' &&
          !this.isHandlingTurn
        ) {
          setTimeout(() => this.startServerlessRecognition(), 250);
        }
      };

      this.recognition = rec;
      rec.start();
    } catch (err: any) {
      this.callbacks.onLog(`VOICE RECOGNITION ERROR: ${err?.message || err}`);
    }
  }

  private stopServerlessRecognition(): void {
    if (this.recognition) {
      try {
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
  }

  private async handleServerlessTurn(transcript: string): Promise<void> {
    if (!transcript.trim() || this.isDisconnecting) return;

    this.isHandlingTurn = true;
    this.stopServerlessRecognition();
    this.setState('THINKING');
    this.callbacks.onTranscript('sirius', transcript, true);
    this.serverlessHistory.push({ sender: 'sirius', text: transcript });

    const isExiting = this.checkExitCommand(transcript);

    try {
      const res = await safeFetchJson('/api/maya/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: transcript,
          mode: this.mode,
          history: this.serverlessHistory.slice(-6),
          userName: this.userName,
          affectionLevel: this.affectionLevel,
          relationshipContext: this.memoryContext,
        }),
      });

      const data =
        res.ok && res.data
          ? res.data
          : {
              reply: getFallbackResponse(transcript, this.mode, this.userName),
              functionCalls: [],
              detectedEmotion: null,
            };

      if (data.detectedEmotion) {
        emotionStore.setEmotion(data.detectedEmotion.emotion, data.detectedEmotion.intensity, this.callbacks.onLog);
        this.callbacks.onEmotionChange?.(data.detectedEmotion.emotion, data.detectedEmotion.intensity);
      }

      if (Array.isArray(data.functionCalls) && data.functionCalls.length > 0) {
        for (const fc of data.functionCalls) {
          await toolBridge.executeTool(fc.name, fc.args || {}, {
            onLog: this.callbacks.onLog,
            onModeChange: this.callbacks.onModeChange,
            onAddTask: this.callbacks.onAddTask,
            onCompleteTask: this.callbacks.onCompleteTask,
            onSaveNote: this.callbacks.onSaveNote,
          });
        }
      }

      const reply = (data.reply || `Acknowledged, ${this.userName}.`).trim();
      this.callbacks.onTranscript('maya', reply, true);
      this.serverlessHistory.push({ sender: 'maya', text: reply });
      this.resetSilenceTimer();

      await new Promise<void>((resolve) => {
        void voiceSynthesisService.speak({
          text: reply,
          voice: this.voice,
          mode: this.mode as MayaMode,
          maxLength: 260,
          onStart: () => {
            if (!this.isDisconnecting) {
              this.setState('SPEAKING');
            }
          },
          onEnd: () => resolve(),
        });
        setTimeout(resolve, 15000);
      });
    } catch (err: any) {
      this.callbacks.onLog(`SERVERLESS VOICE ERROR: ${err?.message || err}`);
    } finally {
      this.isHandlingTurn = false;
      if (!this.isDisconnecting && this.serverlessMode && !isExiting) {
        this.setState('LISTENING');
        this.resetSilenceTimer();
        this.startServerlessRecognition();
      }
    }
  }

  public sendTextMessage(text: string) {
    if (this.serverlessMode && this.isConnected) {
      void this.handleServerlessTurn(text);
      return;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.setState('THINKING');
      this.ws.send(JSON.stringify({ type: 'text', text }));
      this.resetSilenceTimer();
    }
  }

  public interrupt() {
    this.audioPlayer.stopAll();
    voiceSynthesisService.stop();
    this.setState('LISTENING');
    if (this.serverlessMode && !this.isHandlingTurn) {
      this.startServerlessRecognition();
    }
  }

  public disconnect() {
    const wasActive = this.isConnected || this.currentState !== 'IDLE' || this.ws !== null;
    this.isDisconnecting = true;
    this.isConnected = false;
    this.serverlessMode = false;
    this.isHandlingTurn = false;

    if (this.wsConnectTimeout) {
      clearTimeout(this.wsConnectTimeout);
      this.wsConnectTimeout = null;
    }

    this.clearSilenceTimer();
    this.stopServerlessRecognition();

    if (this.levelAnimFrame) {
      cancelAnimationFrame(this.levelAnimFrame);
      this.levelAnimFrame = null;
    }

    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }

    this.stopMicrophoneCapture();
    this.audioPlayer.stopAll();
    voiceSynthesisService.stop();
    this.setState('IDLE');
    if (wasActive) {
      this.callbacks.onSessionEnded?.();
    }
  }

  private setState(state: LiveVoiceState) {
    this.currentState = state;
    this.callbacks.onStateChange(state);
  }

  private async startMicrophoneCapture() {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtxClass();

      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      this.micSource = this.inputAudioCtx.createMediaStreamSource(this.micStream);
      this.inputAnalyser = this.inputAudioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 256;

      // 4096 buffer size for smooth processing
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);

      // Create a zero-gain node so scriptProcessor executes without echoing mic into speakers
      this.muteGain = this.inputAudioCtx.createGain();
      this.muteGain.gain.value = 0;

      this.micSource.connect(this.inputAnalyser);
      this.inputAnalyser.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.muteGain);
      this.muteGain.connect(this.inputAudioCtx.destination);

      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isConnected) return;
        const canSendWs = !this.serverlessMode && this.ws && this.ws.readyState === WebSocket.OPEN;
        if (!this.serverlessMode && !canSendWs) {
          return;
        }

        const inputChannel = e.inputBuffer.getChannelData(0);
        const actualRate = this.inputAudioCtx?.sampleRate || 16000;

        // Check RMS volume level
        let sum = 0;
        for (let i = 0; i < inputChannel.length; i++) {
          sum += inputChannel[i] * inputChannel[i];
        }
        const rms = Math.sqrt(sum / inputChannel.length);

        if (rms > 0.015) {
          this.resetSilenceTimer();
        }

        // Voice Biometric Verification Filter
        if (this.voiceLockEnabled && VoiceprintEngine.hasProfile() && rms > 0.025) {
          const features = VoiceprintEngine.extractFeatures(inputChannel, actualRate);
          const result = VoiceprintEngine.verifySpeaker(features, null, this.voiceLockSensitivity);

          if (result.isVerified) {
            this.unverifiedSpeechFrames = 0;
            this.callbacks.onVoiceVerified?.(result);
          } else {
            this.unverifiedSpeechFrames++;
            this.lastVoiceRejectedAt = Date.now();
            // When an unauthorized voice speaks (detected across 3 consecutive frames)
            if (this.unverifiedSpeechFrames === 3) {
              this.callbacks.onVoiceRejected?.(result);
              VoiceprintEngine.playVerbalRefusal();
            }
            // Drop unverified audio frames so Maya ignores unauthorized speech
            return;
          }
        }

        // Acoustic Echo Cancellation Guard:
        // When Maya is speaking through the device speakers, prevent her voice from looping
        // back into the mic unless Sirius intentionally speaks loudly (> 0.075 RMS) to barge in.
        if (this.currentState === 'SPEAKING') {
          if (rms > 0.075) {
            this.interrupt();
          } else {
            return;
          }
        }

        if (canSendWs && this.ws) {
          // Resample from hardware rate (e.g. 48000Hz or 44100Hz) to 16000Hz expected by Gemini Live
          const resampled = actualRate !== 16000
            ? resampleAudioBuffer(inputChannel, actualRate, 16000)
            : inputChannel;

          // Convert Float32 to 16-bit PCM little-endian
          const pcmBuffer = floatTo16BitPCM(resampled);
          const base64Audio = arrayBufferToBase64(pcmBuffer);

          this.ws.send(JSON.stringify({ type: 'audio', audio: base64Audio }));
        }
      };
    } catch (err: any) {
      this.callbacks.onLog(`MIC CAPTURE ERROR: ${err?.message || err}`);
    }
  }

  private stopMicrophoneCapture() {
    if (this.scriptProcessor) {
      try {
        this.scriptProcessor.disconnect();
      } catch (e) {
        // ignore
      }
      this.scriptProcessor = null;
    }
    if (this.muteGain) {
      try {
        this.muteGain.disconnect();
      } catch (e) {
        // ignore
      }
      this.muteGain = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch (e) {
        // ignore
      }
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.inputAudioCtx) {
      try {
        this.inputAudioCtx.close();
      } catch (e) {
        // ignore
      }
      this.inputAudioCtx = null;
    }
    this.inputAnalyser = null;
  }

  private startLevelMonitoring() {
    const updateLevel = () => {
      let level = 0;
      if (this.currentState === 'SPEAKING' && this.outputAnalyser) {
        const data = new Uint8Array(this.outputAnalyser.frequencyBinCount);
        this.outputAnalyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        level = avg / 255;
      } else if (this.inputAnalyser) {
        const data = new Uint8Array(this.inputAnalyser.frequencyBinCount);
        this.inputAnalyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        level = avg / 255;
      }

      this.callbacks.onAudioLevel?.(level);
      this.levelAnimFrame = requestAnimationFrame(updateLevel);
    };
    this.levelAnimFrame = requestAnimationFrame(updateLevel);
  }

  private resetSilenceTimer() {
    this.clearSilenceTimer();
    // 30s mutual silence timeout
    this.silenceTimer = setTimeout(() => {
      this.callbacks.onLog('LIVE SESSION: Mutual silence threshold reached. Standing by.');
      this.callbacks.onTranscript(
        'maya',
        "Standing by, Sirius. Call my name whenever you're ready.",
        true
      );
      setTimeout(() => {
        this.disconnect();
      }, 2000);
    }, 30000);
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private checkExitCommand(text: string): boolean {
    const lower = text.toLowerCase().trim();
    if (
      lower.includes('bye maya') ||
      lower.includes("that's all") ||
      lower.includes('thats all') ||
      lower.includes('go to sleep') ||
      lower.includes('good night')
    ) {
      this.callbacks.onLog('LIVE SESSION: User issued departure command. Returning to ARMED.');
      setTimeout(() => {
        this.disconnect();
      }, 1500);
      return true;
    }
    return false;
  }

  private async handleToolCall(toolCall: any) {
    const functionCalls = toolCall.functionCalls || [];
    const responses: any[] = [];

    for (const fc of functionCalls) {
      this.callbacks.onLog(`LIVE TOOL CALL: Invoking "${fc.name}" with args: ${JSON.stringify(fc.args || {})}`);
      const res = await toolBridge.executeTool(fc.name, fc.args || {}, {
        onLog: this.callbacks.onLog,
        onModeChange: this.callbacks.onModeChange,
        onAddTask: this.callbacks.onAddTask,
        onCompleteTask: this.callbacks.onCompleteTask,
        onSaveNote: this.callbacks.onSaveNote,
      });

      responses.push({
        id: fc.id || `call_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: fc.name,
        response: res.ok ? { output: res.result || 'Success' } : { error: res.error || res.message },
      });
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'tool_response',
          toolResponse: { functionResponses: responses },
        })
      );
    }
  }
}
