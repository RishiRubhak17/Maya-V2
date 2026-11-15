import React, { useState, useRef } from 'react';
import { X, Mic, Square, Upload, Copy, Download, Check, FileAudio, Sparkles, RefreshCw } from 'lucide-react';

interface AudioTranscribeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToChat?: (text: string) => void;
  accentColor?: string;
}

export const AudioTranscribeModal: React.FC<AudioTranscribeModalProps> = ({
  isOpen,
  onClose,
  onInsertToChat,
  accentColor = '#d6d3cc',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  // Convert Blob to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Start microphone recording
  const startRecording = async () => {
    setError(null);
    setTranscription('');
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4',
      });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
        stream.getTracks().forEach((track) => track.stop());
        await processAudioBlob(audioBlob, 'Microphone Recording');
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingSeconds(0);

      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to access microphone:', err);
      setError('Microphone access denied. Please allow microphone permissions.');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  // Handle uploaded audio file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setTranscription('');
    setFileName(file.name);
    await processAudioBlob(file, file.name);
  };

  // Process audio blob via backend Gemini 3.5 Transcribe
  const processAudioBlob = async (blob: Blob, sourceLabel: string) => {
    setIsTranscribing(true);
    setError(null);

    try {
      const base64 = await blobToBase64(blob);
      const mimeType = blob.type || 'audio/webm';

      const response = await fetch('/api/maya/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      setTranscription(data.transcription || 'No audible speech recognized in this audio sample.');
    } catch (err: any) {
      console.error('Transcription failed:', err);
      setError('Transcription failed. Please check your audio format or try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Copy to clipboard
  const handleCopy = () => {
    if (!transcription) return;
    navigator.clipboard.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download as .txt file
  const handleDownload = () => {
    if (!transcription) return;
    const blob = new Blob([transcription], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `maya_transcript_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl bg-[#0d0d0f] border border-[#2e2e31] rounded-sm shadow-2xl flex flex-col max-h-[85vh] font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2e2e31] bg-[#111114]">
          <div className="flex items-center gap-2.5">
            <div
              className="p-1.5 rounded-[2px] border"
              style={{
                borderColor: `${accentColor}50`,
                color: accentColor,
                backgroundColor: 'rgba(255,255,255,0.03)',
              }}
            >
              <FileAudio className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#cfcfca] tracking-wider uppercase">
                AUDIO TRANSCRIBER // GEMINI 3.5
              </h3>
              <p className="text-[10px] text-[#6d6d69]">
                Verbatim speech-to-text using gemini-3.5-transcribe
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#6d6d69] hover:text-[#cfcfca] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Input Methods */}
        <div className="p-4 space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Record Option */}
            <div className="p-3 rounded-[2px] bg-[#111114] border border-[#2e2e31] flex flex-col items-center justify-center text-center space-y-2.5">
              <span className="text-[10px] font-bold text-[#6d6d69] uppercase">
                RECORD MIC
              </span>

              {isRecording ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="text-base font-bold text-[#c4524f] animate-pulse">
                    {formatSeconds(recordingSeconds)}
                  </div>
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#c4524f] text-black text-xs font-bold transition-all cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-black" />
                    <span>Stop & Transcribe</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={startRecording}
                  disabled={isTranscribing}
                  style={{
                    borderColor: accentColor,
                    color: accentColor,
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#16161a] border hover:bg-[#1f1f24] text-xs font-bold transition-all cursor-pointer"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Start Recording</span>
                </button>
              )}
            </div>

            {/* Upload Option */}
            <div className="p-3 rounded-[2px] bg-[#111114] border border-[#2e2e31] flex flex-col items-center justify-center text-center space-y-2.5">
              <span className="text-[10px] font-bold text-[#6d6d69] uppercase">
                UPLOAD AUDIO FILE
              </span>

              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isTranscribing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[2px] bg-[#16161a] hover:bg-[#1f1f24] border border-[#2e2e31] text-[#cfcfca] text-xs font-medium transition-all cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Choose .mp3 / .wav</span>
              </button>
              {fileName && <span className="text-[9px] text-[#6d6d69] truncate max-w-[160px]">{fileName}</span>}
            </div>
          </div>

          {/* Loading indicator */}
          {isTranscribing && (
            <div className="flex items-center justify-center gap-2 py-4 text-xs" style={{ color: accentColor }}>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Transcribing via Gemini API...</span>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className="p-2.5 rounded-[2px] bg-[#1a0e0e] border border-[#3d1817] text-[#c4524f] text-[11px]">
              {error}
            </div>
          )}

          {/* Results Box */}
          {transcription && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] text-[#6d6d69]">
                <span className="font-bold uppercase tracking-wider text-[#cfcfca]">TRANSCRIPTION RESULT</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 hover:text-[#cfcfca] transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-[#e6c27a]" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1 hover:text-[#cfcfca] transition-colors cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>.txt</span>
                  </button>
                </div>
              </div>

              <div className="p-3 rounded-[2px] bg-[#070708] border border-[#2e2e31] text-xs text-[#cfcfca] whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed select-text font-mono">
                {transcription}
              </div>

              {onInsertToChat && (
                <button
                  onClick={() => {
                    onInsertToChat(transcription);
                    onClose();
                  }}
                  style={{
                    backgroundColor: accentColor,
                  }}
                  className="w-full py-2 rounded-[2px] text-black font-bold text-xs transition-opacity hover:opacity-90 cursor-pointer"
                >
                  Insert Transcription into Maya Prompt
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
