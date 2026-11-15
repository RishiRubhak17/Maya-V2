export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  isJson: boolean;
  error?: string;
}

/**
 * Fetches an API endpoint and safely parses JSON only when the server
 * returns an actual JSON response (preventing HTML SPA fallbacks from throwing SyntaxError).
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(input, init);
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.toLowerCase().includes('application/json');

    if (!isJson) {
      return {
        ok: false,
        status: res.status,
        data: null,
        isJson: false,
        error: `Non-JSON response (${res.status})`,
      };
    }

    const data = (await res.json()) as T;
    return {
      ok: res.ok,
      status: res.status,
      data,
      isJson: true,
      error: res.ok ? undefined : (data as any)?.error || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      isJson: false,
      error: err?.message || 'Network error',
    };
  }
}
