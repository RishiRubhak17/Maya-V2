import React, { useState, useEffect, useRef } from 'react';
import { X, Mic, ShieldCheck, Check, AlertCircle, RefreshCw, AudioWaveform } from 'lucide-react';
import { VoiceprintEngine } from '../voice/voiceprintEngine';
import { AcousticFeatures, EnrollmentStep, VoiceprintProfile } from '../voice/types';

interface VoiceEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEnrollmentComplete: (profile: VoiceprintProfile) => void;
}

const ENROLLMENT_PHRASES = [
  {
    step: 1 as const,
    title: 'PHRASE 1 // BASELINE HARMONICS',
    instruction: 'Speak clearly into your microphone:',
    phrase: 'Maya, authenticate Sirius on Axiom terminal.',
    purpose: 'Calibrates nominal pitch (F0) and vocal cord resonance.',
  },
  {
    step: 2 as const,
    title: 'PHRASE 2 // CADENCE & FORMANTS',
    instruction: 'Speak naturally at normal conversational pace:',
    phrase: 'Confirm my biometric voiceprint for mission control.',
    purpose: 'Calibrates vocal tract formants (F1, F2) and spectral spread.',
  },
  {
    step: 3 as const,
    title: 'PHRASE 3 // DYNAMIC INFLECTION',
    instruction: 'Speak with executive intent:',
    phrase: 'System operational, acknowledge executive access.',
    purpose: 'Calibrates timbre envelope, harmonic decay, and dynamic range.',
  },
];

export const VoiceEnrollmentModal: React.FC<VoiceEnrollmentModalProps> = ({
  isOpen,
  onClose,
  onEnrollmentComplete,
}) => {
  const [currentStep, setCurrentStep] = useState<EnrollmentStep>(1);
  const [isRecording, setIsRecording] = useState(false);
  const [samples, setSamples] = useState<AcousticFeatures[]>([]);
  const [currentFeatures, setCurrentFeatures] = useState<AcousticFeatures | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);

  // Start microphone and canvas oscilloscope
  const startRecording = async () => {
    setErrorMessage(null);
    setStatusMessage('Listening... Speak the phrase above now.');
    pcmChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Real-time audio processor to collect PCM samples
      const bufferSize = 2048;
      const scriptProcessor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
      source.connect(scriptProcessor);
      scriptProcessor.connect(audioCtx.destination);

      scriptProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        pcmChunksRef.current.push(new Float32Array(inputData));
      };

      setIsRecording(true);
      drawOscilloscope();
    } catch (err: any) {
      console.error('[VoiceEnrollment] Mic error:', err);
      setErrorMessage(err?.message || 'Microphone access denied. Please allow microphone permissions.');
      setIsRecording(false);
    }
  };

  // Stop recording and process phrase features
  const stopRecording = () => {
    setIsRecording(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    const sampleRate = audioContextRef.current?.sampleRate || 44100;
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }

    // Merge recorded PCM chunks
    const chunks = pcmChunksRef.current;
    if (chunks.length === 0) {
      setErrorMessage('No audio captured. Please try speaking again.');
      return;
    }

    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const combinedPcm = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combinedPcm.set(chunk, offset);
      offset += chunk.length;
    }

    // Extract features
    const features = VoiceprintEngine.extractFeatures(combinedPcm, sampleRate);
    if (features.energyProfile < 0.01) {
      setErrorMessage('Volume too low. Please speak louder into the microphone.');
      return;
    }

    setCurrentFeatures(features);
    const newSamples = [...samples, features];
    setSamples(newSamples);
    setStatusMessage('Phrase analyzed successfully!');

    // Advance step or finalize
    if (typeof currentStep === 'number') {
      if (currentStep < 3) {
        setTimeout(() => {
          setCurrentStep((currentStep + 1) as EnrollmentStep);
          setStatusMessage(null);
        }, 800);
      } else {
        setTimeout(() => {
          finalizeEnrollment(newSamples);
        }, 800);
      }
    }
  };

  const finalizeEnrollment = (allSamples: AcousticFeatures[]) => {
    try {
      const profile = VoiceprintEngine.createProfileFromSamples(allSamples, 'Sirius');
      VoiceprintEngine.saveProfile(profile);
      setCurrentStep('complete');
      setStatusMessage('Voiceprint successfully synthesized and stored!');
      onEnrollmentComplete(profile);
    } catch (e: any) {
      setErrorMessage(e?.message || 'Failed to generate voice profile.');
    }
  };

  const resetEnrollment = () => {
    setSamples([]);
    setCurrentFeatures(null);
    setCurrentStep(1);
    setStatusMessage(null);
    setErrorMessage(null);
  };

  // Draw real-time oscilloscope on canvas
  const drawOscilloscope = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationFrameRef.current = requestAnimationFrame(render);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#090a0f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00E5FF';
      ctx.beginPath();

      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    render();
  };

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  const activePhrase =
    typeof currentStep === 'number' ? ENROLLMENT_PHRASES[currentStep - 1] : null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 select-none font-mono">
      <div className="bg-[#0d0d10] border border-[#00E5FF]/40 max-w-lg w-full p-5 flex flex-col gap-4 shadow-[0_0_30px_rgba(0,229,255,0.2)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2e2e31] pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] animate-pulse" />
            <span className="font-hud text-sm font-bold tracking-wider text-[#cfcfca]">
              VOICE BIOMETRICS // SPEAKER ENROLLMENT
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-[#6d6d69] hover:text-[#cfcfca] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Step Indicators */}
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((stepNum) => {
            const isDone = samples.length >= stepNum;
            const isCurrent = currentStep === stepNum;
            return (
              <div
                key={stepNum}
                className={`p-2 border text-center transition-all ${
                  isCurrent
                    ? 'border-[#00E5FF] bg-cyan-950/30 text-[#00E5FF]'
                    : isDone
                    ? 'border-emerald-800 bg-emerald-950/20 text-emerald-400'
                    : 'border-[#2e2e31] bg-[#09090b] text-[#6d6d69]'
                }`}
              >
                <div className="text-[10px] font-hud font-bold">STEP {stepNum} OF 3</div>
                <div className="text-[9px] mt-0.5">
                  {isDone ? 'CALIBRATED' : isCurrent ? 'RECORDING' : 'PENDING'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Feedback Messages */}
        {errorMessage && (
          <div className="p-2.5 bg-red-950/40 border border-red-800 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}
        {statusMessage && !errorMessage && (
          <div className="p-2.5 bg-cyan-950/40 border border-cyan-800 text-[#00E5FF] text-xs flex items-center gap-2">
            <Check size={14} className="shrink-0 text-[#00E5FF]" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Main Content Area */}
        {currentStep !== 'complete' && activePhrase && (
          <div className="space-y-3">
            <div className="bg-[#09090b] border border-[#2e2e31] p-3 space-y-2">
              <div className="text-[10px] text-[#6d6d69] font-hud font-bold tracking-wide">
                {activePhrase.title}
              </div>
              <div className="text-xs text-[#8e8e88]">{activePhrase.instruction}</div>
              <div className="p-2.5 bg-[#141418] border border-[#00E5FF]/40 text-[#cfcfca] text-sm font-semibold tracking-wide">
                &quot;{activePhrase.phrase}&quot;
              </div>
              <div className="text-[10px] text-[#6d6d69] italic">
                {activePhrase.purpose}
              </div>
            </div>

            {/* Audio Oscilloscope Canvas */}
            <div className="relative border border-[#2e2e31] bg-[#090a0f] h-20 overflow-hidden">
              <canvas
                ref={canvasRef}
                width={480}
                height={80}
                className="w-full h-full block"
              />
              <div className="absolute top-1 right-2 text-[9px] text-[#6d6d69] flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${isRecording ? 'bg-red-500 animate-ping' : 'bg-neutral-600'}`} />
                <span>{isRecording ? 'LIVE INPUT ACTIVE' : 'MIC READY'}</span>
              </div>
            </div>

            {/* Acoustic Telemetry Metrics */}
            {currentFeatures && (
              <div className="grid grid-cols-4 gap-1.5 text-[9px] bg-[#09090b] p-2 border border-[#2e2e31]">
                <div>
                  <span className="text-[#6d6d69] block">PITCH (F0)</span>
                  <span className="text-[#00E5FF] font-bold">{currentFeatures.fundamentalFrequency} Hz</span>
                </div>
                <div>
                  <span className="text-[#6d6d69] block">CENTROID</span>
                  <span className="text-[#cfcfca] font-bold">{currentFeatures.spectralCentroid} Hz</span>
                </div>
                <div>
                  <span className="text-[#6d6d69] block">FORMANT 1</span>
                  <span className="text-[#cfcfca] font-bold">{currentFeatures.formant1} Hz</span>
                </div>
                <div>
                  <span className="text-[#6d6d69] block">FORMANT 2</span>
                  <span className="text-[#cfcfca] font-bold">{currentFeatures.formant2} Hz</span>
                </div>
              </div>
            )}

            {/* Recording Controls */}
            <div className="flex items-center gap-2 pt-1">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="flex-1 py-2 bg-[#00E5FF] text-[#070708] font-hud text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:brightness-110 shadow-[0_0_12px_rgba(0,229,255,0.3)]"
                >
                  <Mic size={14} />
                  <span>START PHRASE {currentStep} RECORDING</span>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex-1 py-2 bg-red-600 text-white font-hud text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-red-500 animate-pulse"
                >
                  <Mic size={14} />
                  <span>FINISH SPEAKING PHRASE {currentStep}</span>
                </button>
              )}

              {samples.length > 0 && (
                <button
                  onClick={resetEnrollment}
                  className="p-2 border border-[#2e2e31] hover:border-[#6d6d69] text-[#6d6d69] hover:text-[#cfcfca] cursor-pointer"
                  title="Reset and re-enroll from Step 1"
                >
                  <RefreshCw size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Completion Screen */}
        {currentStep === 'complete' && (
          <div className="bg-[#09090b] border border-emerald-800 p-4 space-y-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-950/60 border border-emerald-500 flex items-center justify-center mx-auto text-emerald-400">
              <ShieldCheck size={24} />
            </div>
            <div className="space-y-1">
              <div className="font-hud text-sm font-bold text-emerald-300">
                VOICEPRINT BIOMETRIC ENROLLED // SIRIUS
              </div>
              <p className="text-[11px] text-[#8e8e88] leading-relaxed">
                Maya has successfully calibrated your pitch baseline, vocal tract formants, and spectral envelope.
                Speaker Verification Lock is now active. Any unauthorized speaker will be verbally refused.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={onClose}
                className="w-full py-2 bg-emerald-500 text-[#070708] font-hud text-xs font-bold cursor-pointer hover:bg-emerald-400"
              >
                [ ENGAGE BIOMETRIC LOCK &amp; RETURN ]
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-[#2e2e31] flex justify-between items-center text-[10px] text-[#6d6d69]">
          <span>Security Standard: Biometric Acoustic Autocorrelation</span>
          <button onClick={onClose} className="hover:text-[#cfcfca] cursor-pointer">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
