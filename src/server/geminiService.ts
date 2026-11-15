import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';

/**
 * Valid active models per @google/genai specification:
 * - 'gemini-3.8-flash' (Primary high-efficiency model)
 * - 'gemini-3.1-flash-lite' (Lightweight model with independent free quota tier)
 * - 'gemini-flash-latest' (General fallback alias)
 */
export const PRIMARY_TEXT_MODEL = 'gemini-3.8-flash';
export const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-latest'];

// Circuit-breaker timestamps to prevent 429 quota spamming
const modelQuotaCooldownUntil: Record<string, number> = {};

// Singleton AI client
export const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

/**
 * Check if a specific model is currently cooling down due to a 429 quota exhaustion.
 */
export function isModelInCooldown(model: string): boolean {
  const cooldownUntil = modelQuotaCooldownUntil[model] || 0;
  return Date.now() < cooldownUntil;
}

/**
 * Record a quota exhaustion (429 RESOURCE_EXHAUSTED) and engage the circuit breaker.
 */
function recordQuotaCooldown(model: string, error: any): void {
  let delayMs = 15 * 60 * 1000; // default 15 minutes

  try {
    const errStr = typeof error?.message === 'string' ? error.message : JSON.stringify(error || '');
    // Try to extract retry delay in seconds
    const retryMatch = errStr.match(/retryDelay"?\s*:\s*"?(\d+)s?"?/i) || errStr.match(/retry in (?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?/i);
    if (retryMatch) {
      if (retryMatch[1] && !retryMatch[2]) {
        // e.g. "76883s"
        const secs = parseInt(retryMatch[1], 10);
        if (!isNaN(secs) && secs > 0) {
          delayMs = Math.min(secs * 1000, 24 * 60 * 60 * 1000);
        }
      }
    }
  } catch (e) {
    // ignore parse errors
  }

  modelQuotaCooldownUntil[model] = Date.now() + delayMs;
  const minutes = Math.round(delayMs / 60000);
  console.log(`[Axiom Intelligence // AI] Free-tier daily quota reached on ${model}. Circuit breaker active for ${minutes}m. Utilizing fallback.`);
}

export interface GenerateWithFallbackOptions {
  contents: any;
  config?: any;
  primaryModel?: string;
  fallbackModel?: string;
  timeoutMs?: number;
}

/**
 * Resilient multi-model generation pipeline with automatic circuit breaker and quota recovery.
 */
export async function generateWithFallback(
  options: GenerateWithFallbackOptions
): Promise<GenerateContentResponse> {
  if (!ai) {
    throw new Error('AI client not initialized (missing GEMINI_API_KEY)');
  }

  const primary = options.primaryModel || PRIMARY_TEXT_MODEL;
  const candidates = [primary, ...FALLBACK_MODELS.filter((m) => m !== primary)];
  const timeoutMs = options.timeoutMs || 8000;

  let lastError: any = null;

  for (const model of candidates) {
    if (isModelInCooldown(model)) {
      // Model is in cooldown, silently skip to next candidate
      continue;
    }

    try {
      const generatePromise = ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Model ${model} request timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      const response = await Promise.race([generatePromise, timeoutPromise]);
      return response;
    } catch (err: any) {
      lastError = err;
      const isQuota =
        err?.status === 'RESOURCE_EXHAUSTED' ||
        err?.code === 429 ||
        (typeof err?.message === 'string' && (err.message.includes('429') || err.message.includes('quota')));

      if (isQuota) {
        recordQuotaCooldown(model, err);
      } else {
        const brief = err?.message?.slice(0, 120) || 'Unknown generation failure';
        console.warn(`[Axiom Intelligence // AI] Model ${model} generation skipped: ${brief}`);
      }
    }
  }

  throw lastError || new Error('All candidate AI models exhausted');
}
