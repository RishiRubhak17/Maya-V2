// Maya Voice Biometric Verification Engine
// Analyzes human acoustic features (F0 pitch, formants F1/F2, spectral centroid) to verify speaker identity

import { AcousticFeatures, VoiceprintProfile, VerificationResult } from './types';

const STORAGE_KEY = 'maya_voiceprint_profile';
const VERBAL_REFUSAL_TEXT = 'Voice unverified, Sirius only.';

export class VoiceprintEngine {
  private static cachedProfile: VoiceprintProfile | null = null;
  private static lastRefusalTimestamp = 0;

  /**
   * Load stored voiceprint profile from local storage
   */
  public static getEnrolledProfile(): VoiceprintProfile | null {
    if (this.cachedProfile) return this.cachedProfile;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.cachedProfile = JSON.parse(stored);
        return this.cachedProfile;
      }
    } catch (e) {
      console.warn('[Voiceprint] Failed to parse enrolled voiceprint:', e);
    }
    return null;
  }

  /**
   * Check if a voiceprint is currently enrolled
   */
  public static hasProfile(): boolean {
    return this.getEnrolledProfile() !== null;
  }

  /**
   * Save a newly calibrated voiceprint profile
   */
  public static saveProfile(profile: VoiceprintProfile): void {
    this.cachedProfile = profile;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (e) {
      console.warn('[Voiceprint] Failed to persist profile:', e);
    }
  }

  /**
   * Delete enrolled voiceprint
   */
  public static clearProfile(): void {
    this.cachedProfile = null;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  }

  /**
   * Extract acoustic features from a raw PCM audio buffer (Float32Array)
   */
  public static extractFeatures(audioData: Float32Array, sampleRate: number): AcousticFeatures {
    const n = audioData.length;
    if (n === 0) {
      return {
        fundamentalFrequency: 0,
        spectralCentroid: 0,
        spectralRolloff: 0,
        spectralFlux: 0,
        zeroCrossingRate: 0,
        formant1: 0,
        formant2: 0,
        energyProfile: 0,
      };
    }

    // 1. Root Mean Square (RMS) Energy
    let sumSquares = 0;
    let zeroCrossings = 0;
    for (let i = 0; i < n; i++) {
      const val = audioData[i];
      sumSquares += val * val;
      if (i > 0 && ((audioData[i] >= 0 && audioData[i - 1] < 0) || (audioData[i] < 0 && audioData[i - 1] >= 0))) {
        zeroCrossings++;
      }
    }
    const rms = Math.sqrt(sumSquares / n);
    const zcr = zeroCrossings / n;

    // 2. Fundamental Frequency (F0 Pitch) via Normalized Autocorrelation
    // Typical adult voice pitch: 85 Hz to 280 Hz
    const minPeriod = Math.floor(sampleRate / 300); // ~300 Hz
    const maxPeriod = Math.floor(sampleRate / 80);  // ~80 Hz
    let bestCorrelation = -1;
    let bestPeriod = 0;

    for (let period = minPeriod; period <= maxPeriod; period++) {
      let correlation = 0;
      let norm1 = 0;
      let norm2 = 0;
      const step = 2; // Optimization step
      for (let i = 0; i < n - period; i += step) {
        correlation += audioData[i] * audioData[i + period];
        norm1 += audioData[i] * audioData[i];
        norm2 += audioData[i + period] * audioData[i + period];
      }
      const denom = Math.sqrt(norm1 * norm2);
      if (denom > 0) {
        const normalized = correlation / denom;
        if (normalized > bestCorrelation) {
          bestCorrelation = normalized;
          bestPeriod = period;
        }
      }
    }

    const f0 = bestPeriod > 0 && bestCorrelation > 0.35 ? sampleRate / bestPeriod : 140; // Default fallback in human speech range

    // 3. Spectral Analysis via Discrete Fourier Transform on windowed subframe
    const fftSize = 512;
    const windowed = new Float32Array(fftSize);
    const startIdx = Math.max(0, Math.floor((n - fftSize) / 2));
    for (let i = 0; i < fftSize; i++) {
      if (startIdx + i < n) {
        // Hamming window
        const windowCoeff = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (fftSize - 1));
        windowed[i] = audioData[startIdx + i] * windowCoeff;
      }
    }

    // Magnitude spectrum estimation
    const halfFft = fftSize / 2;
    const spectrum = new Float32Array(halfFft);
    const freqBinSize = sampleRate / fftSize;

    let totalEnergy = 0;
    let weightedFreqSum = 0;

    for (let k = 0; k < halfFft; k++) {
      let real = 0;
      let imag = 0;
      const angleStep = (2 * Math.PI * k) / fftSize;
      for (let t = 0; t < fftSize; t += 2) {
        const angle = angleStep * t;
        real += windowed[t] * Math.cos(angle);
        imag -= windowed[t] * Math.sin(angle);
      }
      const mag = Math.sqrt(real * real + imag * imag);
      spectrum[k] = mag;
      const freq = k * freqBinSize;
      totalEnergy += mag;
      weightedFreqSum += freq * mag;
    }

    // Spectral Centroid
    const centroid = totalEnergy > 0 ? weightedFreqSum / totalEnergy : 1500;

    // Spectral Rolloff (85% energy concentration)
    let accumEnergy = 0;
    const thresholdEnergy = 0.85 * totalEnergy;
    let rolloff = 3000;
    for (let k = 0; k < halfFft; k++) {
      accumEnergy += spectrum[k];
      if (accumEnergy >= thresholdEnergy) {
        rolloff = k * freqBinSize;
        break;
      }
    }

    // Formant 1 (~300 - 900 Hz) and Formant 2 (~900 - 2500 Hz) peak detection
    let f1Peak = 500;
    let f1MaxMag = -1;
    let f2Peak = 1500;
    let f2MaxMag = -1;

    for (let k = 1; k < halfFft - 1; k++) {
      const freq = k * freqBinSize;
      const mag = spectrum[k];
      const isPeak = mag > spectrum[k - 1] && mag > spectrum[k + 1];

      if (isPeak) {
        if (freq >= 280 && freq <= 950 && mag > f1MaxMag) {
          f1MaxMag = mag;
          f1Peak = freq;
        } else if (freq > 950 && freq <= 2500 && mag > f2MaxMag) {
          f2MaxMag = mag;
          f2Peak = freq;
        }
      }
    }

    return {
      fundamentalFrequency: Math.round(f0),
      spectralCentroid: Math.round(centroid),
      spectralRolloff: Math.round(rolloff),
      spectralFlux: Math.round(rms * 1000) / 1000,
      zeroCrossingRate: Math.round(zcr * 1000) / 1000,
      formant1: Math.round(f1Peak),
      formant2: Math.round(f2Peak),
      energyProfile: Math.round(rms * 100) / 100,
    };
  }

  /**
   * Synthesize an authoritative profile from multiple enrollment phrases
   */
  public static createProfileFromSamples(
    samples: AcousticFeatures[],
    userName: string = 'Sirius'
  ): VoiceprintProfile {
    const count = samples.length;
    if (count === 0) throw new Error('No calibration samples provided.');

    const meanF0 = samples.reduce((acc, s) => acc + s.fundamentalFrequency, 0) / count;
    const meanCentroid = samples.reduce((acc, s) => acc + s.spectralCentroid, 0) / count;
    const meanRolloff = samples.reduce((acc, s) => acc + s.spectralRolloff, 0) / count;
    const meanFlux = samples.reduce((acc, s) => acc + s.spectralFlux, 0) / count;
    const meanZcr = samples.reduce((acc, s) => acc + s.zeroCrossingRate, 0) / count;
    const meanF1 = samples.reduce((acc, s) => acc + s.formant1, 0) / count;
    const meanF2 = samples.reduce((acc, s) => acc + s.formant2, 0) / count;
    const meanEnergy = samples.reduce((acc, s) => acc + s.energyProfile, 0) / count;

    // Compute standard deviations for tolerances
    const f0Variance = Math.sqrt(
      samples.reduce((acc, s) => acc + Math.pow(s.fundamentalFrequency - meanF0, 2), 0) / count
    );

    return {
      id: `vp-${Date.now()}`,
      userName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      samplePhrasesCount: count,
      features: {
        fundamentalFrequency: Math.round(meanF0),
        spectralCentroid: Math.round(meanCentroid),
        spectralRolloff: Math.round(meanRolloff),
        spectralFlux: Math.round(meanFlux * 1000) / 1000,
        zeroCrossingRate: Math.round(meanZcr * 1000) / 1000,
        formant1: Math.round(meanF1),
        formant2: Math.round(meanF2),
        energyProfile: Math.round(meanEnergy * 100) / 100,
      },
      tolerance: {
        pitchTolerance: Math.max(25, Math.round(f0Variance * 1.8)),
        spectralTolerance: 400,
        formantTolerance: 300,
      },
    };
  }

  /**
   * Verify an incoming acoustic signature against the enrolled voiceprint profile.
   * Returns a match confidence score between 0% and 100%.
   */
  public static verifySpeaker(
    input: AcousticFeatures,
    profile?: VoiceprintProfile | null,
    sensitivityThreshold: number = 70
  ): VerificationResult {
    const targetProfile = profile || this.getEnrolledProfile();
    if (!targetProfile) {
      // If no voiceprint is enrolled yet, allow open access with warning
      return {
        isVerified: true,
        confidence: 100,
        speakerName: 'Sirius (Unenrolled)',
        details: { pitchDeltaHz: 0, spectralSimilarity: 1, formantSimilarity: 1 },
      };
    }

    const enrolled = targetProfile.features;
    const tol = targetProfile.tolerance;

    // 1. Pitch match (F0 delta)
    const pitchDelta = Math.abs(input.fundamentalFrequency - enrolled.fundamentalFrequency);
    // Gaussian decay around enrolled mean pitch
    const pitchScore = Math.max(0, 100 * Math.exp(-Math.pow(pitchDelta / tol.pitchTolerance, 2)));

    // 2. Formant vocal tract resonance match (F1 & F2)
    const f1Delta = Math.abs(input.formant1 - enrolled.formant1);
    const f2Delta = Math.abs(input.formant2 - enrolled.formant2);
    const formantScore = Math.max(
      0,
      100 * (0.5 * Math.exp(-Math.pow(f1Delta / tol.formantTolerance, 2)) +
             0.5 * Math.exp(-Math.pow(f2Delta / (tol.formantTolerance * 1.5), 2)))
    );

    // 3. Spectral Timbre & Centroid match
    const centroidDelta = Math.abs(input.spectralCentroid - enrolled.spectralCentroid);
    const rolloffDelta = Math.abs(input.spectralRolloff - enrolled.spectralRolloff);
    const spectralScore = Math.max(
      0,
      100 * (0.6 * Math.exp(-Math.pow(centroidDelta / tol.spectralTolerance, 2)) +
             0.4 * Math.exp(-Math.pow(rolloffDelta / (tol.spectralTolerance * 2), 2)))
    );

    // Composite weighted match score: Pitch (35%), Formants (35%), Spectral Timbre (30%)
    const rawConfidence = 0.35 * pitchScore + 0.35 * formantScore + 0.30 * spectralScore;
    const confidence = Math.min(100, Math.max(0, Math.round(rawConfidence)));

    const isVerified = confidence >= sensitivityThreshold;

    return {
      isVerified,
      confidence,
      speakerName: isVerified ? targetProfile.userName : 'Unverified Speaker',
      details: {
        pitchDeltaHz: Math.round(pitchDelta),
        spectralSimilarity: Math.round(spectralScore) / 100,
        formantSimilarity: Math.round(formantScore) / 100,
      },
      reason: isVerified
        ? `Acoustic match confirmed (${confidence}%).`
        : `Voiceprint mismatch (${confidence}% < ${sensitivityThreshold}%).`,
    };
  }

  /**
   * Speak the verbal rejection notice: "Voice unverified, Sirius only."
   * Rate limited to once every 4 seconds to avoid audio overlapping.
   */
  public static playVerbalRefusal(): Promise<void> {
    const now = Date.now();
    if (now - this.lastRefusalTimestamp < 4000) {
      return Promise.resolve();
    }
    this.lastRefusalTimestamp = now;

    return new Promise((resolve) => {
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(VERBAL_REFUSAL_TEXT);
          utterance.rate = 1.05;
          utterance.pitch = 1.0;
          utterance.volume = 1.0;

          // Attempt to find an English voice
          const voices = window.speechSynthesis.getVoices();
          const preferredVoice = voices.find(
            (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha'))
          ) || voices.find((v) => v.lang.startsWith('en'));

          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }

          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
          window.speechSynthesis.speak(utterance);
        } else {
          resolve();
        }
      } catch (e) {
        resolve();
      }
    });
  }
}
