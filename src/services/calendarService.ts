import { getAccessToken } from '../auth/googleAuth';

export interface CalendarEventItem {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  htmlLink?: string;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  conferenceData?: any;
}

export class CalendarService {
  private static BASE_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

  public static async listUpcomingEvents(maxResults: number = 10): Promise<{
    ok: boolean;
    events: CalendarEventItem[];
    error?: string;
  }> {
    const token = await getAccessToken();
    if (!token) {
      return { ok: false, events: [], error: 'NOT_AUTHENTICATED' };
    }

    try {
      const now = new Date().toISOString();
      const params = new URLSearchParams({
        timeMin: now,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: String(maxResults),
      });

      const res = await fetch(`${this.BASE_URL}?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${res.status}`);
      }

      const data = await res.json();
      return {
        ok: true,
        events: data.items || [],
      };
    } catch (err: any) {
      console.error('[CalendarService] listUpcomingEvents error:', err);
      return { ok: false, events: [], error: err?.message || 'Failed to fetch calendar events' };
    }
  }

  public static async createEvent(event: {
    summary: string;
    description?: string;
    location?: string;
    startTime: string; // ISO string
    endTime: string;   // ISO string
  }): Promise<{ ok: boolean; event?: CalendarEventItem; error?: string }> {
    const token = await getAccessToken();
    if (!token) {
      return { ok: false, error: 'NOT_AUTHENTICATED' };
    }

    try {
      const payload = {
        summary: event.summary,
        description: event.description || '',
        location: event.location || '',
        start: {
          dateTime: new Date(event.startTime).toISOString(),
        },
        end: {
          dateTime: new Date(event.endTime).toISOString(),
        },
      };

      const res = await fetch(this.BASE_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${res.status}`);
      }

      const created = await res.json();
      return { ok: true, event: created };
    } catch (err: any) {
      console.error('[CalendarService] createEvent error:', err);
      return { ok: false, error: err?.message || 'Failed to create calendar event' };
    }
  }

  public static async deleteEvent(eventId: string): Promise<{ ok: boolean; error?: string }> {
    const token = await getAccessToken();
    if (!token) {
      return { ok: false, error: 'NOT_AUTHENTICATED' };
    }

    try {
      const res = await fetch(`${this.BASE_URL}/${encodeURIComponent(eventId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok && res.status !== 204) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${res.status}`);
      }

      return { ok: true };
    } catch (err: any) {
      console.error('[CalendarService] deleteEvent error:', err);
      return { ok: false, error: err?.message || 'Failed to delete calendar event' };
    }
  }

  public static async quickAddEvent(text: string): Promise<{ ok: boolean; event?: CalendarEventItem; error?: string }> {
    const token = await getAccessToken();
    if (!token) {
      return { ok: false, error: 'NOT_AUTHENTICATED' };
    }

    try {
      const params = new URLSearchParams({ text });
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events/quickAdd?${params.toString()}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${res.status}`);
      }

      const created = await res.json();
      return { ok: true, event: created };
    } catch (err: any) {
      console.error('[CalendarService] quickAddEvent error:', err);
      return { ok: false, error: err?.message || 'Failed to add event' };
    }
  }
}
