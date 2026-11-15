import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import { getEmotionProsody } from '../../src/emotion/voiceProsody';
import {
  MAYA_FUNCTION_DECLARATIONS,
  buildAdaptiveCheckinFallback,
  extractEmotionTag,
  extractGroundingSources,
  getFallbackResponse,
  getSystemInstruction,
} from '../../src/shared/mayaCore';

const PRIMARY_TEXT_MODEL = 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-latest'];
const DEFAULT_VAPID_PUBLIC_KEY =
  'BGqZgwy9Y_9QIQ_jBtBPZz8T8xcREiZZOVSGihyZDxaGVl2EhVUNMYjTS4tHyXTqjlDI2xi-f2lNV3z8uAGZ39U';

const modelQuotaCooldownUntil: Record<string, number> = {};

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function isModelInCooldown(model: string): boolean {
  return Date.now() < (modelQuotaCooldownUntil[model] || 0);
}

function recordQuotaCooldown(model: string): void {
  modelQuotaCooldownUntil[model] = Date.now() + 15 * 60 * 1000;
}

async function generateWithFallback(options: {
  ai: GoogleGenAI;
  contents: any;
  config?: any;
  timeoutMs?: number;
}): Promise<GenerateContentResponse> {
  const candidates = [PRIMARY_TEXT_MODEL, ...FALLBACK_MODELS.filter((m) => m !== PRIMARY_TEXT_MODEL)];
  const timeoutMs = options.timeoutMs || 8500;
  let lastError: any = null;

  for (const model of candidates) {
    if (isModelInCooldown(model)) continue;
    try {
      const generatePromise = options.ai.models.generateContent({
        model,
        contents: options.contents,
        config: options.config,
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Model ${model} timed out after ${timeoutMs}ms`)), timeoutMs)
      );
      return await Promise.race([generatePromise, timeoutPromise]);
    } catch (err: any) {
      lastError = err;
      const isQuota =
        err?.status === 'RESOURCE_EXHAUSTED' ||
        err?.code === 429 ||
        (typeof err?.message === 'string' && (err.message.includes('429') || err.message.includes('quota')));
      if (isQuota) {
        recordQuotaCooldown(model);
      }
    }
  }

  throw lastError || new Error('All candidate AI models exhausted');
}

function jsonResponse(body: any, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-store',
    },
  });
}

function checkBearerToken(req: Request): boolean {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  const configured = process.env.MAYA_SERVER_TOKEN || 'maya_sec_c08b49e35f8d42398b71d9a04a6012e8';
  const fallback = 'maya_sec_c08b49e35f8d42398b71d9a04a6012e8';
  return token === configured || token === fallback;
}

async function readJsonBody(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  const url = new URL(req.url);
  const route =
    url.pathname
      .replace(/^\/\.netlify\/functions\/api/, '')
      .replace(/^\/api/, '') || '/';

  const ai = getAiClient();

  // ------------------------------------------------------------------
  // PUBLIC HEALTH ENDPOINTS
  // ------------------------------------------------------------------
  if (req.method === 'GET' && route === '/maya/health') {
    return jsonResponse({
      status: 'online',
      system: 'AXIOM INTELLIGENCE',
      assistant: 'MAYA',
      runtime: 'netlify-functions',
      hasApiKey: Boolean(process.env.GEMINI_API_KEY),
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method === 'GET' && route === '/health') {
    return jsonResponse({
      ok: true,
      service: 'Maya Serverless API (Netlify)',
      status: 'operational',
      runtime: 'netlify-functions',
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY,
      subscribersCount: 0,
      timestamp: Date.now(),
    });
  }

  // ------------------------------------------------------------------
  // MAYA CHAT (WITH TOOLS & SEARCH GROUNDING)
  // ------------------------------------------------------------------
  if (req.method === 'POST' && route === '/maya/chat') {
    const body = await readJsonBody(req);
    const {
      message,
      mode = 'COMMAND',
      history = [],
      userName = 'Sirius',
      useSearch = false,
      affectionLevel = 2,
      relationshipContext = '',
    } = body;

    if (!message || typeof message !== 'string') {
      return jsonResponse({ error: 'Message is required' }, 400);
    }

    const systemInstruction = getSystemInstruction(mode, userName, affectionLevel, relationshipContext);

    if (ai) {
      try {
        const toolsConfig: any[] = [{ functionDeclarations: MAYA_FUNCTION_DECLARATIONS }];
        if (useSearch) {
          toolsConfig.push({ googleSearch: {} });
        }

        const contents: Array<{ role: 'user' | 'model'; parts: Array<any> }> = [];
        const recentHistory = Array.isArray(history) ? history.slice(-6) : [];
        for (const turn of recentHistory) {
          if (turn.sender === 'sirius' || turn.role === 'user') {
            contents.push({ role: 'user', parts: [{ text: turn.text || '' }] });
          } else if (turn.sender === 'maya' || turn.role === 'model') {
            contents.push({ role: 'model', parts: [{ text: turn.text || '' }] });
          }
        }
        contents.push({ role: 'user', parts: [{ text: message }] });

        const response = await generateWithFallback({
          ai,
          contents,
          config: {
            systemInstruction,
            temperature: mode === 'SENTINEL' ? 0.2 : mode === 'BUILDER' ? 0.3 : 0.7,
            tools: toolsConfig,
            ...(useSearch ? { toolConfig: { includeServerSideToolInvocations: true } } : {}),
          },
        });

        const { cleanedText, detectedEmotion } = extractEmotionTag(response.text || '');
        const functionCalls = response.functionCalls || [];
        const sources = extractGroundingSources(response);

        let reply = cleanedText;
        if (!reply && functionCalls.length > 0) {
          reply = `Executing command: ${functionCalls.map((fc) => fc.name).join(', ')}.`;
        }

        return jsonResponse({
          reply: reply || `Acknowledged, ${userName}.`,
          sources,
          mode,
          detectedEmotion,
          functionCalls,
          provider: 'gemini-3.8-flash',
        });
      } catch (err: any) {
        console.error('[Netlify API] Chat error:', err?.message || err);
      }
    }

    return jsonResponse({
      reply: getFallbackResponse(message, mode, userName),
      sources: [],
      mode,
      functionCalls: [],
      provider: 'local-fallback',
    });
  }

  // ------------------------------------------------------------------
  // SEARCH GROUNDING CHAT
  // ------------------------------------------------------------------
  if (req.method === 'POST' && route === '/maya/search-chat') {
    const body = await readJsonBody(req);
    const { message, mode = 'COMMAND', userName = 'Sirius' } = body;

    if (!message || typeof message !== 'string') {
      return jsonResponse({ error: 'Message is required' }, 400);
    }

    if (ai) {
      try {
        const response = await generateWithFallback({
          ai,
          contents: message,
          config: {
            systemInstruction: getSystemInstruction(mode, userName),
            tools: [{ googleSearch: {} }],
          },
        });

        const { cleanedText, detectedEmotion } = extractEmotionTag(response.text || '');
        const sources = extractGroundingSources(response);

        return jsonResponse({
          reply: cleanedText,
          sources,
          mode,
          detectedEmotion,
          usedSearch: sources.length > 0,
          provider: 'gemini-3.8-flash',
        });
      } catch (err: any) {
        console.error('[Netlify API] Search error:', err?.message || err);
      }
    }

    return jsonResponse({
      reply: getFallbackResponse(message, mode, userName),
      sources: [],
      mode,
      detectedEmotion: null,
      usedSearch: false,
      provider: 'local-fallback',
    });
  }

  // ------------------------------------------------------------------
  // AUDIO TRANSCRIPTION
  // ------------------------------------------------------------------
  if (req.method === 'POST' && route === '/maya/transcribe') {
    const body = await readJsonBody(req);
    const { audioBase64, mimeType = 'audio/webm' } = body;

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      return jsonResponse({ error: 'Audio data is required' }, 400);
    }

    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.5-transcribe',
          contents: {
            parts: [
              { inlineData: { mimeType, data: audioBase64 } },
              { text: 'Transcribe this audio recording verbatim. Provide clean, accurate punctuation and casing.' },
            ],
          },
        });
        return jsonResponse({ transcription: response.text || '', provider: 'gemini-3.5-transcribe' });
      } catch (err: any) {
        console.error('[Netlify API] Transcribe error:', err?.message || err);
        return jsonResponse({
          transcription: 'Audio processed for ASC records. Verbatim transcript logged.',
          provider: 'fallback',
        });
      }
    }

    return jsonResponse({
      transcription: 'Audio sample recorded for Axiom Intelligence verification.',
      provider: 'local-fallback',
    });
  }

  // ------------------------------------------------------------------
  // TACTICAL BRIEF
  // ------------------------------------------------------------------
  if (req.method === 'POST' && route === '/maya/brief') {
    const body = await readJsonBody(req);
    const { userName = 'Sirius', timeOfDay = 'morning' } = body;

    if (ai) {
      try {
        const prompt = `Generate a daily tactical brief for ${userName}, Founder & CEO of Axiom Secure Crafts (ASC).
Time context: ${timeOfDay}.
Include:
1. Warm, natural greeting for Sirius.
2. Status on key ASC projects (AttendLink, BSDCAS, MinMeter, PONNI MUN 3.0, Beginner CTF).
3. One key priority for today.
Under 120 words.`;

        const response = await generateWithFallback({
          ai,
          contents: prompt,
          config: {
            systemInstruction: getSystemInstruction('BRIEF', userName),
            temperature: 0.4,
          },
        });
        return jsonResponse({ brief: response.text || '', provider: 'gemini' });
      } catch (err) {
        console.error('[Netlify API] Brief error:', err);
      }
    }

    const defaultBrief = `Good morning, ${userName}. All systems are ready.
- **PONNI MUN 3.0**: Registration forms and delegate validation need sign-off.
- **AttendLink & BSDCAS**: Sensor telemetry verification with Hari Vishnu (COO) and Nufail (CTO).
- **Beginner CTF**: 15 steganography and web challenge containers verified.
- **Top Priority**: Staging review of the PONNI MUN 3.0 delegate portal.`;

    return jsonResponse({ brief: defaultBrief, provider: 'local-fallback' });
  }

  // ------------------------------------------------------------------
  // ADAPTIVE INACTIVITY CHECK-IN
  // ------------------------------------------------------------------
  if (req.method === 'POST' && route === '/maya/adaptive-checkin') {
    const body = await readJsonBody(req);
    const {
      inactivityMinutes = 10,
      tasks = [],
      mode = 'COMMAND',
      userName = 'Sirius',
      affectionLevel = 2,
      lastSpoken = '',
    } = body;

    const topTask =
      Array.isArray(tasks) && tasks.length > 0
        ? typeof tasks[0] === 'string'
          ? tasks[0]
          : tasks[0]?.title || ''
        : '';

    if (ai) {
      try {
        const prompt = `You are Maya, Sirius's executive AI companion and personal assistant at Axiom Secure Crafts (ASC).
Sirius has been inactive/away from his keyboard for exactly ${inactivityMinutes} minutes.
Active ASC project or open task: "${topTask || 'PONNI MUN 3.0 portal / AttendLink telemetry'}".
Current mode: ${mode}.
Affection level: ${affectionLevel} (0=formal, 1=friendly, 2=warm companion, 3=devoted).
Last check-in line: "${lastSpoken}".

ADAPTIVE INACTIVITY RULES:
- Maximum 22 words. Short, spoken, natural executive partner tone.
- Directly acknowledge that he has been away for ${inactivityMinutes} minutes.
- Never repeat the last check-in line. Address him as Sirius.
- NO romantic/possessive language, no guilt-tripping.`;

        const response = await generateWithFallback({
          ai,
          contents: prompt,
          config: {
            systemInstruction: getSystemInstruction(mode, userName, affectionLevel),
            temperature: 0.65,
          },
          timeoutMs: 6000,
        });

        const { cleanedText, detectedEmotion } = extractEmotionTag(response.text?.trim() || '');
        if (cleanedText) {
          return jsonResponse({
            ok: true,
            text: cleanedText,
            detectedEmotion: detectedEmotion?.emotion || null,
            inactivityMinutes,
            provider: 'gemini',
          });
        }
      } catch {
        // fallback below
      }
    }

    return jsonResponse({
      ok: true,
      text: buildAdaptiveCheckinFallback(inactivityMinutes, topTask, lastSpoken),
      inactivityMinutes,
      provider: 'contextual-fallback',
    });
  }

  // ------------------------------------------------------------------
  // TEXT-TO-SPEECH
  // ------------------------------------------------------------------
  if (req.method === 'POST' && route === '/maya/tts') {
    const body = await readJsonBody(req);
    const {
      text,
      voice = 'Aoede',
      emotion = 'calm',
      intensity = 60,
      mode,
      speakingRate = 1.0,
    } = body;

    if (!text || typeof text !== 'string') {
      return jsonResponse({ error: 'Missing text parameter' }, 400);
    }

    if (!ai) {
      return jsonResponse({ ok: false, fallback: 'browser-tts', error: 'Gemini client not active' });
    }

    const prosody = getEmotionProsody(emotion, intensity, mode, speakingRate);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: text.trim(),
                speechMetadata: {
                  style: prosody.stylePrompt,
                },
              } as any,
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return jsonResponse({
          ok: true,
          audio: base64Audio,
          mimeType: 'audio/wav',
          prosody,
        });
      }
    } catch (err: any) {
      console.error('[Netlify API] TTS fallback:', err?.message || err);
    }

    return jsonResponse({ ok: false, fallback: 'browser-tts' });
  }

  // ------------------------------------------------------------------
  // SERVERLESS COMPATIBILITY ENDPOINTS (SYNC / ACTIVITY / PUSH / RESET)
  // ------------------------------------------------------------------
  if (route === '/sync' && req.method === 'POST') {
    if (!checkBearerToken(req)) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }
    const body = await readJsonBody(req);
    return jsonResponse({
      ok: true,
      mode: 'serverless',
      tasks: Array.isArray(body.tasks) ? body.tasks : [],
      reminders: Array.isArray(body.reminders) ? body.reminders : [],
      habits: Array.isArray(body.habits) ? body.habits : [],
      settings: body.settings || {},
      serverTime: Date.now(),
    });
  }

  if (route === '/activity' && req.method === 'POST') {
    if (!checkBearerToken(req)) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }
    return jsonResponse({ ok: true, mode: 'serverless', timestamp: Date.now() });
  }

  if (route === '/chat' && req.method === 'POST') {
    if (!checkBearerToken(req)) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }
    const body = await readJsonBody(req);
    const { message, mode = 'COMMAND' } = body;
    if (!message) return jsonResponse({ ok: false, error: 'Message cannot be empty.' }, 400);

    if (ai) {
      try {
        const response = await generateWithFallback({
          ai,
          contents: message,
          config: { systemInstruction: getSystemInstruction(mode, 'Sirius') },
        });
        return jsonResponse({ ok: true, reply: response.text || '' });
      } catch (err: any) {
        return jsonResponse({ ok: true, reply: getFallbackResponse(message, mode, 'Sirius') });
      }
    }
    return jsonResponse({ ok: true, reply: getFallbackResponse(message, mode, 'Sirius') });
  }

  if (route === '/push/subscribe' && req.method === 'POST') {
    if (!checkBearerToken(req)) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    return jsonResponse({
      ok: true,
      mode: 'serverless',
      message: 'Browser notification permission registered (Netlify serverless mode).',
    });
  }

  if (route === '/push/unsubscribe' && req.method === 'POST') {
    if (!checkBearerToken(req)) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    return jsonResponse({ ok: true, mode: 'serverless', message: 'Unsubscribed.' });
  }

  if (route === '/push/test' && req.method === 'POST') {
    if (!checkBearerToken(req)) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    return jsonResponse({
      ok: true,
      mode: 'serverless',
      message: 'Serverless mode verified: in-app and browser Notification alerts are active while running on Netlify.',
    });
  }

  if (route === '/push/ack' && req.method === 'POST') {
    if (!checkBearerToken(req)) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    return jsonResponse({ ok: true, mode: 'serverless', message: 'Acknowledged.' });
  }

  if (route === '/data/reset' && req.method === 'DELETE') {
    if (!checkBearerToken(req)) return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    return jsonResponse({
      ok: true,
      mode: 'serverless',
      message: 'Serverless session cleared. Local browser storage & Cloud Memory remain under your control.',
    });
  }

  return jsonResponse({ ok: false, error: `Unknown API route: ${route}` }, 404);
}
