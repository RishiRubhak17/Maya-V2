import { useState, useEffect, useRef, useCallback } from 'react';
import { MayaMode } from '../types';
import { playWakeChime, playModeChime } from '../utils/audioEffects';

interface UseWakeWordOptions {
  enabled: boolean;
  isSessionActive: boolean;
  onWakeWord: () => void;
  onModeSwitch: (mode: MayaMode) => void;
  onSpokenCommand: (command: string) => void;
}

export function useWakeWord({
  enabled,
  isSessionActive,
  onWakeWord,
  onModeSwitch,
  onSpokenCommand,
}: UseWakeWordOptions) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [supported, setSupported] = useState<boolean>(false);
  const [lastDetectedPhrase, setLastDetectedPhrase] = useState<string>('');

  const recognitionRef = useRef<any>(null);
  const shouldRunRef = useRef<boolean>(enabled && !isSessionActive);
  shouldRunRef.current = enabled && !isSessionActive;

  // Mode detection regex
  const parseModeFromSpeech = (text: string): MayaMode | null => {
    const lower = text.toLowerCase();
    if (/maya.*(?:mode to chill|switch to chill|chill mode|to chill)/i.test(lower)) return 'CHILL';
    if (/maya.*(?:mode to builder|switch to builder|builder mode|to builder)/i.test(lower)) return 'BUILDER';
    if (/maya.*(?:mode to sentinel|switch to sentinel|sentinel mode|to sentinel)/i.test(lower)) return 'SENTINEL';
    if (/maya.*(?:mode to brief|switch to brief|brief mode|to brief)/i.test(lower)) return 'BRIEF';
    if (/maya.*(?:mode to command|switch to command|command mode|to command)/i.test(lower)) return 'COMMAND';
    return null;
  };

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    setSupported(true);

    try {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-IN';
      recognitionRef.current = rec;

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript.trim().toLowerCase();
          setLastDetectedPhrase(transcript);

          // 1. Check for mode switch voice commands like "Maya, mode to chill"
          const targetMode = parseModeFromSpeech(transcript);
          if (targetMode) {
            playModeChime();
            onModeSwitch(targetMode);
            return;
          }

          // 2. Check for Wake Word "Maya"
          if (/\b(maya|hey maya|ok maya)\b/i.test(transcript)) {
            // Check if there is follow-up command in the same sentence
            const afterMaya = transcript.replace(/.*?\b(maya|hey maya|ok maya)\b\s*/i, '').trim();

            playWakeChime();

            if (afterMaya.length > 2) {
              onSpokenCommand(afterMaya);
            } else {
              onWakeWord();
            }
            return;
          }
        }
      };

      rec.onerror = (event: any) => {
        // If aborted or not-allowed, ignore silently or wait
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('Wake-word recognition error:', event.error);
        }
      };

      rec.onend = () => {
        setIsListening(false);
        // Automatically restart if wake word should remain running
        if (shouldRunRef.current && recognitionRef.current) {
          setTimeout(() => {
            if (shouldRunRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                // ignore
              }
            }
          }, 300);
        }
      };
    } catch (err) {
      console.warn('Failed to initialize wake word detection:', err);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [onWakeWord, onModeSwitch, onSpokenCommand]);

  // Manage start/stop based on enabled & sessionActive state
  useEffect(() => {
    if (!recognitionRef.current) return;

    if (enabled && !isSessionActive) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // already started or busy
      }
    } else {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
  }, [enabled, isSessionActive]);

  return {
    isListening,
    supported,
    lastDetectedPhrase,
  };
}
