import { useState, useRef, useCallback, useEffect } from 'react';
import { LiveSessionState, MayaMode } from '../types';

interface UseGeminiLiveOptions {
  mode: MayaMode;
  voice: string;
  userName: string;
  onTranscript: (sender: 'sirius' | 'maya', text: string) => void;
  onStateChange?: (state: LiveSessionState) => void;
}

// Convert Float32 array (-1.0 to 1.0) to base64 16-bit PCM
function floatTo16BitPCMBase64(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); // little-endian
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 16-bit PCM to AudioBuffer for 24kHz output
function base64ToAudioBuffer(
  audioCtx: AudioContext,
  base64: string,
  sampleRate: number = 24000
): AudioBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const pcm16 = new Int16Array(bytes.buffer);
  const audioBuffer = audioCtx.createBuffer(1, pcm16.length, sampleRate);
  const channelData = audioBuffer.getChannelData(0);

  for (let i = 0; i < pcm16.length; i++) {
    channelData[i] = pcm16[i] / 32768.0;
  }

  return audioBuffer;
}

export function useGeminiLive({
  mode,
  voice,
  userName,
  onTranscript,
  onStateChange,
}: UseGeminiLiveOptions) {
  const [sessionState, setSessionState] = useState<LiveSessionState>('IDLE');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const inputAnalyserRef = useRef<AnalyserNode | null>(null);

  // Audio queue tracking for gapless playback
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const isSpeakingRef = useRef<boolean>(false);

  // Accumulated transcript buffers
  const currentMayaTurnRef = useRef<string>('');
  const currentSiriusTurnRef = useRef<string>('');

  const updateState = useCallback(
    (newState: LiveSessionState) => {
      setSessionState(newState);
      if (onStateChange) onStateChange(newState);
    },
    [onStateChange]
  );

  // Stop all actively queued audio (barge-in interruption)
  const stopAudioPlayback = useCallback(() => {
    activeSourcesRef.current.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch (e) {
        // ignore
      }
    });
    activeSourcesRef.current = [];
    isSpeakingRef.current = false;
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
  }, []);

  // End live voice session
  const stopLiveSession = useCallback(() => {
    stopAudioPlayback();

    if (scriptProcessorRef.current) {
      try {
        scriptProcessorRef.current.disconnect();
      } catch (e) {
        // ignore
      }
      scriptProcessorRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== 'closed') {
      inputAudioCtxRef.current.close().catch(() => {});
      inputAudioCtxRef.current = null;
    }

    if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== 'closed') {
      outputAudioCtxRef.current.close().catch(() => {});
      outputAudioCtxRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (inputAnalyserRef.current) {
      try {
        inputAnalyserRef.current.disconnect();
      } catch (e) {
        // ignore
      }
      inputAnalyserRef.current = null;
    }
    setAnalyserNode(null);

    setIsConnected(false);
    updateState('IDLE');
    setAudioLevel(0);
  }, [stopAudioPlayback, updateState]);

  // Start live voice session
  const startLiveSession = useCallback(async () => {
    setErrorMessage(null);
    updateState('LISTENING');

    try {
      // 1. Request microphone permissions
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Initialize Audio Contexts
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      inputAudioCtxRef.current = inputCtx;

      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 24000,
      });
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = outputCtx.currentTime;

      // 3. Connect to server WebSocket bridge on /live
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/live?mode=${encodeURIComponent(
        mode
      )}&voice=${encodeURIComponent(voice)}&user=${encodeURIComponent(userName)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        updateState('LISTENING');
      };

      ws.onerror = (e) => {
        console.warn('WebSocket live session error:', e);
        setErrorMessage('Live session connection interrupted.');
      };

      ws.onclose = () => {
        setIsConnected(false);
        updateState('IDLE');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          // Server or session status
          if (msg.type === 'status') {
            if (msg.status === 'ready') {
              setIsConnected(true);
            }
          }

          // Interruption event (barge-in)
          if (msg.type === 'interrupted' || msg.interrupted) {
            stopAudioPlayback();
            updateState('LISTENING');
          }

          // Model Audio chunk
          if (msg.type === 'audio' && msg.audio) {
            updateState('SPEAKING');
            isSpeakingRef.current = true;

            if (outputAudioCtxRef.current) {
              const ctx = outputAudioCtxRef.current;
              if (ctx.state === 'suspended') {
                ctx.resume();
              }

              const buffer = base64ToAudioBuffer(ctx, msg.audio, 24000);
              const source = ctx.createBufferSource();
              source.buffer = buffer;

              // Analyzer for output audio level
              const analyzer = ctx.createAnalyser();
              analyzer.fftSize = 64;
              source.connect(analyzer);
              analyzer.connect(ctx.destination);

              // Update output volume level
              const dataArray = new Uint8Array(analyzer.frequencyBinCount);
              const checkLevel = () => {
                if (isSpeakingRef.current) {
                  analyzer.getByteFrequencyData(dataArray);
                  let sum = 0;
                  for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
                  const avg = sum / dataArray.length / 255;
                  setAudioLevel(Math.min(1, avg * 1.8));
                  requestAnimationFrame(checkLevel);
                }
              };
              checkLevel();

              // Scheduled playback for gapless streaming
              const startTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
              source.start(startTime);
              nextStartTimeRef.current = startTime + buffer.duration;

              activeSourcesRef.current.push(source);

              source.onended = () => {
                const idx = activeSourcesRef.current.indexOf(source);
                if (idx !== -1) activeSourcesRef.current.splice(idx, 1);
                if (activeSourcesRef.current.length === 0) {
                  isSpeakingRef.current = false;
                  updateState('LISTENING');
                  setAudioLevel(0);
                }
              };
            }
          }

          // Transcripts
          if (msg.type === 'input_transcript' && msg.text) {
            currentSiriusTurnRef.current += msg.text;
          }

          if (msg.type === 'output_transcript' && msg.text) {
            currentMayaTurnRef.current += msg.text;
          }

          if (msg.type === 'text' && msg.text) {
            currentMayaTurnRef.current += (currentMayaTurnRef.current ? ' ' : '') + msg.text;
          }

          if (msg.type === 'turn_complete') {
            if (currentSiriusTurnRef.current.trim()) {
              onTranscript('sirius', currentSiriusTurnRef.current.trim());
              currentSiriusTurnRef.current = '';
            }
            if (currentMayaTurnRef.current.trim()) {
              onTranscript('maya', currentMayaTurnRef.current.trim());
              currentMayaTurnRef.current = '';
            }
            if (!isSpeakingRef.current) {
              updateState('LISTENING');
            }
          }
        } catch (err) {
          console.warn('Error handling WebSocket message:', err);
        }
      };

      // 4. Hook up microphone capture -> AnalyserNode & ScriptProcessor -> 16kHz PCM Base64
      const source = inputCtx.createMediaStreamSource(stream);

      // Web Audio API AnalyserNode for real-time mic frequency analysis
      const inputAnalyser = inputCtx.createAnalyser();
      inputAnalyser.fftSize = 64; // 32 frequency bins
      inputAnalyser.smoothingTimeConstant = 0.8;
      source.connect(inputAnalyser);
      inputAnalyserRef.current = inputAnalyser;
      setAnalyserNode(inputAnalyser);

      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      scriptProcessorRef.current = processor;

      source.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);

        // Compute input audio volume level
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        const micLevel = Math.min(1, rms * 5);

        // If Maya is not speaking, update audioLevel with mic input
        if (!isSpeakingRef.current) {
          setAudioLevel(micLevel);
          if (micLevel > 0.15) {
            updateState('LISTENING');
          }
        } else if (micLevel > 0.25) {
          // Sirius barged in / spoke over Maya: trigger local interruption immediately
          stopAudioPlayback();
          updateState('LISTENING');
        }

        // Send to Live WebSocket if open
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const base64PCM = floatTo16BitPCMBase64(inputData);
          wsRef.current.send(
            JSON.stringify({
              type: 'audio',
              audio: base64PCM,
            })
          );
        }
      };
    } catch (err: any) {
      console.error('Error starting live session:', err);
      let userFriendly = 'Could not access microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        userFriendly = 'Microphone permission denied. Please allow microphone access in your browser.';
      } else if (err.name === 'NotFoundError') {
        userFriendly = 'No microphone device found on this system.';
      }
      setErrorMessage(userFriendly);
      stopLiveSession();
    }
  }, [mode, voice, userName, updateState, stopAudioPlayback, stopLiveSession, onTranscript]);

  const toggleLiveSession = useCallback(() => {
    if (sessionState === 'IDLE') {
      startLiveSession();
    } else {
      stopLiveSession();
    }
  }, [sessionState, startLiveSession, stopLiveSession]);

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, [stopLiveSession]);

  return {
    sessionState,
    isConnected,
    errorMessage,
    audioLevel,
    analyserNode,
    startLiveSession,
    stopLiveSession,
    toggleLiveSession,
  };
}
