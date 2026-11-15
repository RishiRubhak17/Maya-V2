import { useState, useEffect, useRef, useCallback } from 'react';
import { MayaMode } from '../types';
import { emotionStore } from '../emotion/emotionStore';
import { MayaEmotion } from '../emotion/types';
import { getEmotionProsody, ResolvedVoiceProsody } from '../emotion/voiceProsody';
import { voiceSynthesisService } from '../services/voiceSynthesisService';

type IWindow = Window & typeof globalThis & {
  webkitSpeechRecognition?: any;
  SpeechRecognition?: any;
};

export interface SpeakHookOptions {
  emotion?: MayaEmotion;
  intensity?: number;
  speakingRate?: number;
  voice?: string;
  useServerTts?: boolean;
}

export function useVoiceSynthesis() {
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechSupported, setSpeechSupported] = useState<boolean>(false);
  const [recognitionSupported, setRecognitionSupported] = useState<boolean>(false);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const [currentEmotion, setCurrentEmotion] = useState<MayaEmotion>(() => emotionStore.getState().current);
  const [emotionIntensity, setEmotionIntensity] = useState<number>(() => emotionStore.getState().intensity);

  const recognitionRef = useRef<any>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const unsubscribeEmotion = emotionStore.subscribe((state) => {
      setCurrentEmotion(state.current);
      setEmotionIntensity(state.intensity);
    });
    return () => unsubscribeEmotion();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSpeechSupported(true);

      const updateVoices = () => {
        const available = window.speechSynthesis.getVoices();
        voicesRef.current = available;

        // Preference order for Maya: Indian English female voice -> British female -> standard natural
        const indianVoice =
          available.find(
            (v) => (v.lang === 'en-IN' || v.lang === 'ta-IN') && /female|priya|sangeeta|veena/i.test(v.name)
          ) || available.find((v) => v.lang === 'en-IN');

        const britishOrSoftVoice = available.find((v) =>
          /google uk english female|samantha|karen|moira|victoria|fiona/i.test(v.name)
        );

        const chosen =
          indianVoice || britishOrSoftVoice || available.find((v) => v.lang.startsWith('en')) || available[0];
        if (chosen) {
          setSelectedVoiceName(chosen.name);
        }
      };

      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    const win = window as unknown as IWindow;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (SpeechRec) {
      setRecognitionSupported(true);
      try {
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = true;
        rec.lang = 'en-IN';
        recognitionRef.current = rec;
      } catch (err) {
        console.warn('SpeechRecognition initialization error:', err);
      }
    }

    return () => {
      voiceSynthesisService.stop();
    };
  }, []);

  // Speak text with Maya persona parameters dynamically modulated by current emotion & active Mode
  const speak = useCallback(
    (
      text: string,
      mode: MayaMode = 'COMMAND',
      onEnd?: () => void,
      options?: SpeakHookOptions
    ) => {
      if (!audioEnabled || typeof window === 'undefined') {
        if (onEnd) onEnd();
        return;
      }

      if (options?.useServerTts) {
        void voiceSynthesisService.speak({
          text,
          mode,
          voice: options.voice || 'Aoede',
          emotion: options.emotion,
          intensity: options.intensity,
          speakingRate: options.speakingRate ?? 1.0,
          onStart: () => setIsSpeaking(true),
          onEnd: () => {
            setIsSpeaking(false);
            onEnd?.();
          },
        });
        return;
      }

      if (!speechSupported) {
        if (onEnd) onEnd();
        return;
      }

      window.speechSynthesis.cancel();

      // Extract spoken-friendly prose (first 1-3 sentences)
      let cleanText = text
        .replace(/```[\s\S]*?```/g, 'Code block generated for review.')
        .replace(/[#*`_~>[\]()]/g, '')
        .trim();

      const sentences = cleanText.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 3) {
        cleanText = sentences.slice(0, 3).join(' ');
      }

      if (!cleanText) {
        if (onEnd) onEnd();
        return;
      }

      const liveState = emotionStore.getState();
      const prosody: ResolvedVoiceProsody = getEmotionProsody(
        options?.emotion ?? liveState.current,
        options?.intensity ?? liveState.intensity,
        mode,
        options?.speakingRate ?? 1.0
      );

      const utterance = new SpeechSynthesisUtterance(cleanText);

      const voice = voicesRef.current.find((v) => v.name === selectedVoiceName);
      if (voice) {
        utterance.voice = voice;
      }

      // Dynamic emotion + mode prosody & pitch modulation
      utterance.rate = prosody.rate;
      utterance.pitch = prosody.pitch;
      utterance.volume = prosody.volume;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
    },
    [audioEnabled, speechSupported, selectedVoiceName]
  );

  const stopSpeaking = useCallback(() => {
    voiceSynthesisService.stop();
    setIsSpeaking(false);
  }, []);

  const startListening = useCallback(
    (onResult: (transcript: string) => void, onComplete?: (final: string) => void) => {
      if (!recognitionRef.current) return;

      stopSpeaking();
      const rec = recognitionRef.current;

      let finalAccumulated = '';

      rec.onstart = () => setIsListening(true);
      rec.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalAccumulated += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        onResult(finalAccumulated || interim);
      };

      rec.onerror = (e: any) => {
        console.warn('SpeechRecognition error:', e);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
        if (onComplete && finalAccumulated) {
          onComplete(finalAccumulated);
        }
      };

      try {
        rec.start();
      } catch (err) {
        console.warn('Could not start recognition:', err);
      }
    },
    [stopSpeaking]
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
      setIsListening(false);
    }
  }, []);

  const currentProsody = getEmotionProsody(currentEmotion, emotionIntensity);

  return {
    audioEnabled,
    setAudioEnabled,
    isSpeaking,
    isListening,
    speechSupported,
    recognitionSupported,
    selectedVoiceName,
    currentEmotion,
    emotionIntensity,
    currentProsody,
    speak,
    stopSpeaking,
    startListening,
    stopListening,
  };
}
