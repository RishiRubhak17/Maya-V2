// Types for Maya Voice Biometrics and Speaker Verification

export interface AcousticFeatures {
  fundamentalFrequency: number; // Pitch F0 in Hz (autocorrelation)
  spectralCentroid: number; // Frequency center of mass in Hz
  spectralRolloff: number; // 85% energy concentration frequency
  spectralFlux: number; // Rate of spectral change
  zeroCrossingRate: number; // Noisiness / fricative detection
  formant1: number; // First vocal tract resonance peak (~300 - 900 Hz)
  formant2: number; // Second vocal tract resonance peak (~900 - 2500 Hz)
  energyProfile: number; // Root mean square energy
}

export interface VoiceprintProfile {
  id: string;
  userName: string;
  createdAt: number;
  updatedAt: number;
  samplePhrasesCount: number;
  features: AcousticFeatures;
  tolerance: {
    pitchTolerance: number;
    spectralTolerance: number;
    formantTolerance: number;
  };
}

export interface VerificationResult {
  isVerified: boolean;
  confidence: number; // 0 to 100
  speakerName: string;
  details: {
    pitchDeltaHz: number;
    spectralSimilarity: number;
    formantSimilarity: number;
  };
  reason?: string;
}

export type EnrollmentStep = 1 | 2 | 3 | 'complete';
