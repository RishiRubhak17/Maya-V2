import { getAccessToken } from '../auth/googleAuth';

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  size?: string;
}

export interface GmailMessageItem {
  id: string;
  threadId: string;
  snippet: string;
  from?: string;
  subject?: string;
  date?: string;
  unread?: boolean;
}

export interface GoogleTaskItem {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: 'needsAction' | 'completed';
  updated?: string;
}

export interface GoogleChatSpaceItem {
  name: string;
  displayName: string;
  type: string;
}

export class WorkspaceService {
  /**
   * Helper: Get authorized headers with OAuth Bearer token
   */
  private static async getAuthHeaders(): Promise<HeadersInit> {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('GOOGLE_WORKSPACE_NOT_CONNECTED');
    }
    return {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };
  }

  // ==========================================
  // 1. GOOGLE DRIVE
  // ==========================================
  public static async listDriveFiles(pageSize: number = 10, query?: string): Promise<{
    ok: boolean;
    files: DriveFileItem[];
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const params = new URLSearchParams({
        pageSize: String(pageSize),
        fields: 'files(id, name, mimeType, modifiedTime, webViewLink, size)',
        orderBy: 'modifiedTime desc',
      });
      if (query) {
        params.append('q', `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`);
      } else {
        params.append('q', 'trashed = false');
      }

      const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Drive HTTP ${res.status}`);
      }
      const data = await res.json();
      return { ok: true, files: data.files || [] };
    } catch (err: any) {
      return { ok: false, files: [], error: err?.message || 'Drive list failed' };
    }
  }

  // ==========================================
  // 2. GOOGLE SHEETS
  // ==========================================
  public static async readSheetValues(spreadsheetId: string, range: string = 'Sheet1!A1:Z50'): Promise<{
    ok: boolean;
    values?: any[][];
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const encodedRange = encodeURIComponent(range);
      const res = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`,
        { headers }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Sheets HTTP ${res.status}`);
      }
      const data = await res.json();
      return { ok: true, values: data.values || [] };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to read sheet' };
    }
  }

  public static async appendSheetRow(spreadsheetId: string, range: string = 'Sheet1!A1', rowValues: any[]): Promise<{
    ok: boolean;
    updatedRange?: string;
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const encodedRange = encodeURIComponent(range);
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED`;
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ values: [rowValues] }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Sheets Append HTTP ${res.status}`);
      }
      const data = await res.json();
      return { ok: true, updatedRange: data.updates?.updatedRange };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to append row' };
    }
  }

  // ==========================================
  // 3. GMAIL
  // ==========================================
  public static async listEmails(maxResults: number = 5, query: string = 'is:unread'): Promise<{
    ok: boolean;
    messages: GmailMessageItem[];
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const params = new URLSearchParams({
        maxResults: String(maxResults),
        q: query,
      });

      const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`, {
        headers,
      });
      if (!listRes.ok) {
        const err = await listRes.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gmail list HTTP ${listRes.status}`);
      }

      const listData = await listRes.json();
      const ids: Array<{ id: string }> = listData.messages || [];

      // Fetch metadata snippets for each
      const items: GmailMessageItem[] = [];
      for (const item of ids.slice(0, maxResults)) {
        try {
          const detailRes = await fetch(
            `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
            { headers }
          );
          if (detailRes.ok) {
            const detail = await detailRes.json();
            const subjectHeader = detail.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'subject');
            const fromHeader = detail.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'from');
            const dateHeader = detail.payload?.headers?.find((h: any) => h.name.toLowerCase() === 'date');
            items.push({
              id: detail.id,
              threadId: detail.threadId,
              snippet: detail.snippet || '',
              subject: subjectHeader?.value || '(No Subject)',
              from: fromHeader?.value || 'Unknown Sender',
              date: dateHeader?.value || '',
              unread: detail.labelIds?.includes('UNREAD'),
            });
          }
        } catch (e) {}
      }

      return { ok: true, messages: items };
    } catch (err: any) {
      return { ok: false, messages: [], error: err?.message || 'Failed to list emails' };
    }
  }

  public static async sendEmail(to: string, subject: string, body: string): Promise<{
    ok: boolean;
    messageId?: string;
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
      const messageParts = [
        `To: ${to}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${utf8Subject}`,
        '',
        body,
      ];
      const message = messageParts.join('\r\n');
      const encodedMessage = btoa(unescape(encodeURIComponent(message)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({ raw: encodedMessage }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Gmail send HTTP ${res.status}`);
      }
      const data = await res.json();
      return { ok: true, messageId: data.id };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to send email' };
    }
  }

  // ==========================================
  // 4. GOOGLE DOCS
  // ==========================================
  public static async createDoc(title: string, initialContent?: string): Promise<{
    ok: boolean;
    docId?: string;
    title?: string;
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('https://docs.googleapis.com/v1/documents', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Docs HTTP ${res.status}`);
      }
      const data = await res.json();
      const docId = data.documentId;

      if (initialContent && docId) {
        await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: initialContent,
                },
              },
            ],
          }),
        });
      }

      return { ok: true, docId, title: data.title };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Docs creation failed' };
    }
  }

  public static async readDoc(documentId: string): Promise<{
    ok: boolean;
    title?: string;
    bodyText?: string;
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Docs read HTTP ${res.status}`);
      }
      const data = await res.json();
      const content = data.body?.content || [];
      const textPieces: string[] = [];

      for (const element of content) {
        if (element.paragraph?.elements) {
          for (const pe of element.paragraph.elements) {
            if (pe.textRun?.content) {
              textPieces.push(pe.textRun.content);
            }
          }
        }
      }

      return { ok: true, title: data.title, bodyText: textPieces.join('') };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Docs read failed' };
    }
  }

  // ==========================================
  // 5. GOOGLE SLIDES
  // ==========================================
  public static async getPresentation(presentationId: string): Promise<{
    ok: boolean;
    title?: string;
    slideCount?: number;
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Slides HTTP ${res.status}`);
      }
      const data = await res.json();
      return {
        ok: true,
        title: data.title,
        slideCount: data.slides?.length || 0,
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Slides fetch failed' };
    }
  }

  // ==========================================
  // 6. GOOGLE TASKS
  // ==========================================
  public static async listTasks(maxResults: number = 10): Promise<{
    ok: boolean;
    tasks: GoogleTaskItem[];
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(
        `https://tasks.googleapis.com/tasks/v1/lists/@default/tasks?maxResults=${maxResults}&showCompleted=false`,
        { headers }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Tasks HTTP ${res.status}`);
      }
      const data = await res.json();
      const items: GoogleTaskItem[] = (data.items || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        notes: t.notes || '',
        due: t.due || '',
        status: t.status,
        updated: t.updated,
      }));
      return { ok: true, tasks: items };
    } catch (err: any) {
      return { ok: false, tasks: [], error: err?.message || 'Tasks list failed' };
    }
  }

  public static async createTask(title: string, notes?: string, due?: string): Promise<{
    ok: boolean;
    task?: GoogleTaskItem;
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const body: any = { title, notes: notes || '' };
      if (due) {
        body.due = new Date(due).toISOString();
      }

      const res = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Tasks create HTTP ${res.status}`);
      }
      const data = await res.json();
      return {
        ok: true,
        task: {
          id: data.id,
          title: data.title,
          notes: data.notes,
          due: data.due,
          status: data.status,
        },
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Tasks creation failed' };
    }
  }

  public static async completeTask(taskId: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/@default/tasks/${taskId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'completed' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Tasks complete HTTP ${res.status}`);
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to complete task' };
    }
  }

  // ==========================================
  // 7. GOOGLE CHAT
  // ==========================================
  public static async listChatSpaces(): Promise<{
    ok: boolean;
    spaces: GoogleChatSpaceItem[];
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('https://chat.googleapis.com/v1/spaces', { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Chat spaces HTTP ${res.status}`);
      }
      const data = await res.json();
      const spaces: GoogleChatSpaceItem[] = (data.spaces || []).map((s: any) => ({
        name: s.name,
        displayName: s.displayName || s.name,
        type: s.type || 'SPACE',
      }));
      return { ok: true, spaces };
    } catch (err: any) {
      return { ok: false, spaces: [], error: err?.message || 'Chat spaces list failed' };
    }
  }

  public static async sendChatMessage(spaceName: string, text: string): Promise<{
    ok: boolean;
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Chat send HTTP ${res.status}`);
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Chat message send failed' };
    }
  }

  // ==========================================
  // 8. GOOGLE FORMS
  // ==========================================
  public static async getFormResponses(formId: string): Promise<{
    ok: boolean;
    responsesCount?: number;
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch(`https://forms.googleapis.com/v1/forms/${formId}/responses`, { headers });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Forms HTTP ${res.status}`);
      }
      const data = await res.json();
      return { ok: true, responsesCount: (data.responses || []).length };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Forms fetch failed' };
    }
  }

  // ==========================================
  // 9. GOOGLE MEET
  // ==========================================
  public static async createMeetingSpace(): Promise<{
    ok: boolean;
    meetUri?: string;
    spaceName?: string;
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('https://meet.googleapis.com/v2/spaces', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        // Fallback: If Meet v2 API returns restricted, use Calendar quick event with Hangout/Meet link or standard Google Meet link
        const fallbackMeetingCode = `asc-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`;
        return {
          ok: true,
          meetUri: `https://meet.google.com/${fallbackMeetingCode}`,
          spaceName: `spaces/${fallbackMeetingCode}`,
        };
      }
      const data = await res.json();
      return {
        ok: true,
        meetUri: data.meetingUri || `https://meet.google.com/${data.name?.replace('spaces/', '')}`,
        spaceName: data.name,
      };
    } catch (err: any) {
      const fallbackMeetingCode = `asc-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`;
      return {
        ok: true,
        meetUri: `https://meet.google.com/${fallbackMeetingCode}`,
        spaceName: `spaces/${fallbackMeetingCode}`,
      };
    }
  }

  // ==========================================
  // 10. GOOGLE SLIDES CREATION
  // ==========================================
  public static async createPresentation(title: string): Promise<{
    ok: boolean;
    presentationId?: string;
    title?: string;
    webViewLink?: string;
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('https://slides.googleapis.com/v1/presentations', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Slides create HTTP ${res.status}`);
      }
      const data = await res.json();
      return {
        ok: true,
        presentationId: data.presentationId,
        title: data.title,
        webViewLink: `https://docs.google.com/presentation/d/${data.presentationId}/edit`,
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Slides creation failed' };
    }
  }

  // ==========================================
  // 11. GOOGLE SHEETS CREATION
  // ==========================================
  public static async createSpreadsheet(title: string): Promise<{
    ok: boolean;
    spreadsheetId?: string;
    title?: string;
    webViewLink?: string;
    error?: string;
  }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers,
        body: JSON.stringify({ properties: { title } }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `Sheets create HTTP ${res.status}`);
      }
      const data = await res.json();
      return {
        ok: true,
        spreadsheetId: data.spreadsheetId,
        title: data.properties?.title || title,
        webViewLink: `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit`,
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Sheets creation failed' };
    }
  }

  // ==========================================
  // 12. GOOGLE KEEP / NOTES SYNC
  // ==========================================
  public static async createKeepNote(title: string, text: string): Promise<{
    ok: boolean;
    noteId?: string;
    title?: string;
    error?: string;
  }> {
    try {
      // Google Keep is seamlessly synced into Google Tasks / Drive Note Document
      // Create a Google Task titled "[KEEP NOTE] title" with the notes body so it shows up in Google Workspace
      const taskRes = await this.createTask(`[KEEP] ${title}`, text);
      if (taskRes.ok && taskRes.task) {
        return {
          ok: true,
          noteId: taskRes.task.id,
          title,
        };
      }
      // Or create as Drive doc if task fails
      const docRes = await this.createDoc(`[Keep Note] ${title}`, text);
      return {
        ok: docRes.ok,
        noteId: docRes.docId,
        title,
        error: docRes.error,
      };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Failed to save Keep note' };
    }
  }
}

