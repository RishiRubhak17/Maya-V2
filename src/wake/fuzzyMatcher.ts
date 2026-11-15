import { WakeSensitivity } from './types';

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

const EXACT_WAKE_PATTERNS = [
  'maya',
  'hey maya',
  'hi maya',
  'ok maya',
  'okay maya',
  'maia',
  'mya',
  'miya',
  'maaya',
  'mayaa',
  'my a',
  'மாயா',
  'माया',
  'my uh',
  'mai ya',
  'my-uh',
];

export interface WakeMatchResult {
  matched: boolean;
  wakePhrase: string;
  trailingCommand: string;
}

export function matchWakeWord(
  rawInput: string,
  sensitivity: WakeSensitivity = 'normal'
): WakeMatchResult {
  const text = (rawInput || '')
    .trim()
    .toLowerCase()
    .replace(/[,\.\?!;:]+/g, ' ');

  if (!text) {
    return { matched: false, wakePhrase: '', trailingCommand: '' };
  }

  // 1. Direct sub-phrase search for exact variants
  for (const pattern of EXACT_WAKE_PATTERNS) {
    const idx = text.indexOf(pattern);
    if (idx !== -1) {
      const trailing = text.slice(idx + pattern.length).trim();
      return {
        matched: true,
        wakePhrase: pattern,
        trailingCommand: trailing,
      };
    }
  }

  // 2. Token based fuzzy match
  const words = text.split(/\s+/).filter(Boolean);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    // Check if word is 4+ letters and within Levenshtein distance 1 of "maya"
    if (word.length >= 3) {
      const dist = levenshteinDistance(word, 'maya');
      const maxAllowedDist = sensitivity === 'strict' ? 0 : sensitivity === 'loose' ? 2 : 1;

      if (dist <= maxAllowedDist) {
        // Matched! Check if previous word was "hey", "hi", "ok", or "okay"
        let wakePhrase = word;
        if (i > 0 && ['hey', 'hi', 'ok', 'okay'].includes(words[i - 1])) {
          wakePhrase = `${words[i - 1]} ${word}`;
        }
        const trailing = words.slice(i + 1).join(' ').trim();
        return {
          matched: true,
          wakePhrase,
          trailingCommand: trailing,
        };
      }
    }

    // Two-word phonetic combos: "my a", "my uh", "mai ya"
    if (i < words.length - 1) {
      const pair = `${words[i]} ${words[i + 1]}`;
      if (['my a', 'my uh', 'mai ya'].includes(pair)) {
        const trailing = words.slice(i + 2).join(' ').trim();
        return {
          matched: true,
          wakePhrase: pair,
          trailingCommand: trailing,
        };
      }
    }
  }

  return { matched: false, wakePhrase: '', trailingCommand: '' };
}
