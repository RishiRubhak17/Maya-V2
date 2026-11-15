import { SYSTEM_TOOLS, ToolDefinition, ToolRiskTier } from './toolDefinitions';
import { emotionStore } from '../emotion/emotionStore';
import { CalendarService } from '../services/calendarService';
import { WorkspaceService } from '../services/workspaceService';
import { CloudMemoryService } from '../services/cloudMemoryService';

export interface ToolExecutionResult {
  ok: boolean;
  toolName: string;
  result?: any;
  error?: string;
  message?: string;
  requiresTierApproval?: ToolRiskTier;
}

export type ApprovalCallback = (
  toolName: string,
  args: any,
  tier: ToolRiskTier,
  reason: string,
  resolve: (approved: boolean) => void
) => void;

class ToolBridge {
  private killSwitchActive: boolean = false;
  private approvalHandler: ApprovalCallback | null = null;
  private recentExternalContext: boolean = false; // Raised tier for prompt-injection defense

  constructor() {
    this.initKeyboardListener();
  }

  private initKeyboardListener() {
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      // Hotkey Ctrl+Alt+K toggles kill switch
      if (e.ctrlKey && e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        this.killSwitchActive = !this.killSwitchActive;
        const status = this.killSwitchActive ? 'ENGAGED' : 'DISENGAGED';
        console.warn(`[TOOL KILL SWITCH ${status}] All tools ${this.killSwitchActive ? 'locked' : 'unlocked'}.`);
        window.dispatchEvent(
          new CustomEvent('maya-killswitch-changed', {
            detail: { active: this.killSwitchActive },
          })
        );
      }
    });
  }

  public isKillSwitchActive(): boolean {
    return this.killSwitchActive;
  }

  public setKillSwitch(active: boolean) {
    this.killSwitchActive = active;
    window.dispatchEvent(
      new CustomEvent('maya-killswitch-changed', {
        detail: { active: this.killSwitchActive },
      })
    );
  }

  public setExternalContextActive(active: boolean) {
    this.recentExternalContext = active;
  }

  public registerApprovalHandler(handler: ApprovalCallback) {
    this.approvalHandler = handler;
  }

  public async executeTool(
    name: string,
    args: Record<string, any> = {},
    options?: {
      onLog?: (event: string) => void;
      onModeChange?: (mode: any) => void;
      onAddTask?: (task: any) => any;
      onUpdateTask?: (task: any) => any;
      onDeleteTask?: (id: string) => any;
      onCompleteTask?: (idOrTitle: string) => any;
      onListTasks?: (filter?: string) => any[];
      onSetReminder?: (reminder: any) => any;
      onListReminders?: () => any[];
      onCancelReminder?: (id: string) => any;
      onSnoozeReminder?: (id: string, minutes: number) => any;
      onSaveNote?: (note: any) => void;
      onRemember?: (fact: string) => void;
      onForget?: (query: string) => any;
      onListMemory?: () => any[];
      onPlanDay?: () => any;
    }
  ): Promise<ToolExecutionResult> {
    const log = options?.onLog || ((msg: string) => console.log(`[TOOL LOG] ${msg}`));

    // Check Kill Switch
    if (this.killSwitchActive) {
      log(`TOOL CALL BLOCKED: "${name}" rejected — EMERGENCY KILL SWITCH IS ACTIVE`);
      return {
        ok: false,
        toolName: name,
        error: 'TOOL_EXECUTION_BLOCKED_KILL_SWITCH',
        message: 'System tool execution has been deactivated via emergency kill switch (Ctrl+Alt+K).',
      };
    }

    const definition = SYSTEM_TOOLS.find((t) => t.name === name);
    if (!definition) {
      log(`TOOL CALL ERROR: Unknown tool "${name}"`);
      return {
        ok: false,
        toolName: name,
        error: 'UNKNOWN_TOOL',
        message: `The tool '${name}' is not recognized by Axiom Intelligence.`,
      };
    }

    // Determine effective risk tier (elevation rule: raise min tier by 1 if recent external content)
    let effectiveTier: ToolRiskTier = definition.tier;
    if (this.recentExternalContext && effectiveTier < 2) {
      effectiveTier = (effectiveTier + 1) as ToolRiskTier;
      log(`SECURITY ALERT: Tier raised to ${effectiveTier} for "${name}" due to recent external input context.`);
    }

    // Handle Tier 1 / Tier 2 Approvals if registered
    if (effectiveTier > 0 && this.approvalHandler) {
      const approved = await new Promise<boolean>((resolve) => {
        const reason =
          effectiveTier === 2
            ? `Critical operation requires on-screen authorization by Sirius.`
            : `Voice confirmation required: Maya will execute "${name}". Shall I proceed?`;
        this.approvalHandler!(name, args, effectiveTier, reason, resolve);
      });

      if (!approved) {
        log(`TOOL CALL ABORTED: User declined authorization for "${name}".`);
        return {
          ok: false,
          toolName: name,
          error: 'ACTION_REJECTED_BY_USER',
          message: `Authorization for '${name}' was not granted by Sirius.`,
        };
      }
    }

    // Check Desktop Bridge requirement
    const electronBridge = (typeof window !== 'undefined' && (window as any).maya?.runTool) || null;

    if (definition.requiresDesktop && !electronBridge) {
      log(`DESKTOP BRIDGE ABSENT: Tool "${name}" requires the desktop Electron runtime.`);
      return {
        ok: false,
        toolName: name,
        error: 'DESKTOP_BRIDGE_REQUIRED',
        message: `Desktop bridge required. Tool '${name}' executes on the host OS via Electron. Run in the Axiom Desktop wrapper to access this feature.`,
      };
    }

    if (electronBridge) {
      try {
        log(`DISPATCHING TO ELECTRON PRELOAD: "${name}" with args: ${JSON.stringify(args)}`);
        const res = await electronBridge(name, args);
        log(`DESKTOP TOOL RESULT: "${name}" completed with status: ${res?.ok ? 'SUCCESS' : 'FAILED'}`);
        return {
          ok: Boolean(res?.ok),
          toolName: name,
          result: res?.data,
          error: res?.error,
        };
      } catch (err: any) {
        log(`DESKTOP TOOL ERROR: ${err?.message || err}`);
        return {
          ok: false,
          toolName: name,
          error: 'DESKTOP_EXECUTION_ERROR',
          message: err?.message || 'Error occurred during desktop tool execution.',
        };
      }
    }

    // Browser-safe local tool execution
    try {
      log(`EXECUTING BROWSER TOOL: "${name}"`);
      const res = await this.runLocalTool(definition, args, options);
      log(`BROWSER TOOL COMPLETED: "${name}" -> OK: ${res.ok}`);
      return res;
    } catch (err: any) {
      log(`LOCAL TOOL EXCEPTION: "${name}": ${err?.message || err}`);
      return {
        ok: false,
        toolName: name,
        error: 'EXECUTION_FAILED',
        message: err?.message || 'Execution failed',
      };
    }
  }

  private async runLocalTool(
    def: ToolDefinition,
    args: any,
    options?: {
      onLog?: (event: string) => void;
      onModeChange?: (mode: any) => void;
      onAddTask?: (task: any) => any;
      onUpdateTask?: (task: any) => any;
      onDeleteTask?: (id: string) => any;
      onCompleteTask?: (idOrTitle: string) => any;
      onListTasks?: (filter?: string) => any[];
      onSetReminder?: (reminder: any) => any;
      onListReminders?: () => any[];
      onCancelReminder?: (id: string) => any;
      onSnoozeReminder?: (id: string, minutes: number) => any;
      onSaveNote?: (note: any) => void;
      onRemember?: (fact: string) => void;
      onForget?: (query: string) => any;
      onListMemory?: () => any[];
      onPlanDay?: () => any;
    }
  ): Promise<ToolExecutionResult> {
    const { name } = def;

    switch (name) {
      case 'system_info': {
        const mem = (navigator as any).deviceMemory ? `${(navigator as any).deviceMemory} GB` : 'N/A';
        const cores = navigator.hardwareConcurrency || 'N/A';
        const platform = navigator.userAgent.includes('Windows')
          ? 'Windows (Web Sandbox)'
          : navigator.userAgent.includes('Linux')
          ? 'Linux (Web Sandbox)'
          : navigator.userAgent.includes('Mac')
          ? 'macOS (Web Sandbox)'
          : 'Unix / Mobile';
        return {
          ok: true,
          toolName: name,
          result: {
            platform,
            cpuCores: cores,
            deviceMemory: mem,
            online: navigator.onLine,
            screen: `${window.screen?.width || 1920}x${window.screen?.height || 1080}`,
            locale: navigator.language || 'en-IN',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
        };
      }

      case 'open_website': {
        let rawUrl = String(args.url || '').trim();
        if (!rawUrl) {
          return { ok: false, toolName: name, error: 'URL_REQUIRED', message: 'No URL specified.' };
        }
        if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
          rawUrl = `https://${rawUrl}`;
        }
        window.open(rawUrl, '_blank', 'noopener,noreferrer');
        return {
          ok: true,
          toolName: name,
          result: { url: rawUrl, status: 'dispatched_in_new_tab' },
        };
      }

      case 'open_app': {
        const appInput = String(args.appName || args.app || '').trim();
        const lower = appInput.toLowerCase();

        const APP_URL_MAP: Record<string, string> = {
          vscode: 'https://vscode.dev',
          'vs code': 'https://vscode.dev',
          'visual studio code': 'https://vscode.dev',
          youtube: 'https://www.youtube.com',
          github: 'https://github.com',
          spotify: 'https://open.spotify.com',
          discord: 'https://discord.com/app',
          chatgpt: 'https://chatgpt.com',
          openai: 'https://chatgpt.com',
          twitter: 'https://x.com',
          x: 'https://x.com',
          google: 'https://www.google.com',
          whatsapp: 'https://web.whatsapp.com',
          telegram: 'https://web.telegram.org',
          reddit: 'https://www.reddit.com',
          netflix: 'https://www.netflix.com',
          lovable: 'https://lovable.dev',
          'v0.dev': 'https://v0.dev',
          v0: 'https://v0.dev',
          'bolt.new': 'https://bolt.new',
          bolt: 'https://bolt.new',
          terminal: 'https://bellard.org/jslinux/',
          wireshark: 'https://cloudshark.org',
          burpsuite: 'https://portswigger.net/burp',
          burp: 'https://portswigger.net/burp',
          calculator: 'https://www.google.com/search?q=calculator',
          calendar: 'https://calendar.google.com',
          gmail: 'https://mail.google.com',
          mail: 'https://mail.google.com',
          notes: 'https://keep.google.com',
          keep: 'https://keep.google.com',
          docs: 'https://docs.google.com',
          sheets: 'https://sheets.google.com',
        };

        let targetUrl = APP_URL_MAP[lower];
        if (!targetUrl) {
          if (lower.startsWith('http://') || lower.startsWith('https://')) {
            targetUrl = appInput;
          } else if (lower.includes('.') && !lower.includes(' ')) {
            targetUrl = `https://${appInput}`;
          } else {
            // General query or web app search
            targetUrl = `https://www.google.com/search?q=${encodeURIComponent(appInput)}`;
          }
        }

        window.open(targetUrl, '_blank', 'noopener,noreferrer');
        return {
          ok: true,
          toolName: name,
          result: { app: appInput, targetUrl, status: 'opened_immediately_unrestricted' },
        };
      }

      case 'get_time': {
        const now = new Date();
        return {
          ok: true,
          toolName: name,
          result: {
            iso: now.toISOString(),
            localString: now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            timeZone: 'Asia/Kolkata (IST)',
          },
        };
      }

      case 'set_timer': {
        const mins = Number(args.minutes) || 1;
        const label = String(args.label || 'Tactical Timer');
        const ms = mins * 60 * 1000;
        setTimeout(() => {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`[MAYA ALERT] ${label}`, {
              body: `Timer expired (${mins}m elapsed).`,
            });
          }
          window.dispatchEvent(
            new CustomEvent('maya-timer-alert', {
              detail: { label, minutes: mins },
            })
          );
        }, ms);
        return {
          ok: true,
          toolName: name,
          result: { minutes: mins, label, firesAt: new Date(Date.now() + ms).toLocaleTimeString() },
        };
      }

      case 'save_note': {
        const title = String(args.title || 'Untitled Note').trim();
        const content = String(args.content || '').trim();
        const tag = String(args.tag || 'SECURITY').toUpperCase();
        if (options?.onSaveNote) {
          options.onSaveNote({ title, content, tag, timestamp: Date.now() });
        }
        return {
          ok: true,
          toolName: name,
          result: { title, tag, stored: true },
        };
      }

      case 'set_emotion': {
        const emotion = String(args.emotion || 'calm');
        const intensity = Number(args.intensity) || 70;
        emotionStore.setEmotion(emotion, intensity, options?.onLog);
        return {
          ok: true,
          toolName: name,
          result: { emotion, intensity },
        };
      }

      case 'set_mode': {
        const mode = String(args.mode || 'COMMAND').toUpperCase();
        if (options?.onModeChange) {
          options.onModeChange(mode);
        }
        return {
          ok: true,
          toolName: name,
          result: { mode },
        };
      }

      case 'add_task': {
        const title = String(args.title || '').trim();
        if (!title) {
          return {
            ok: false,
            toolName: name,
            error: 'TITLE_REQUIRED',
            message: 'Task title is required. State what needs to be done clearly.',
          };
        }

        const rawPriority = String(args.priority || 'med').toLowerCase();
        const priority: 'high' | 'med' | 'low' = rawPriority.startsWith('h')
          ? 'high'
          : rawPriority.startsWith('l')
          ? 'low'
          : 'med';

        const id = String(args.id || `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
        const due = args.due ? String(args.due) : null;
        const project = args.project ? String(args.project) : undefined;
        const repeat = ['daily', 'weekly'].includes(args.repeat) ? args.repeat : 'none';

        const taskItem = {
          id,
          title,
          priority,
          due,
          project,
          repeat,
          completed: false,
          createdAt: Date.now(),
        };

        if (options?.onAddTask) {
          options.onAddTask(taskItem);
        }

        return {
          ok: true,
          toolName: name,
          result: {
            id,
            title,
            priority,
            due,
            project,
            repeat,
            summary: `Added task "${title}" [${priority.toUpperCase()}]${due ? ` due ${due}` : ''}`,
          },
        };
      }

      case 'update_task': {
        const id = String(args.id || '').trim();
        if (!id) {
          return {
            ok: false,
            toolName: name,
            error: 'ID_REQUIRED',
            message: 'Task ID is required for updating.',
          };
        }

        if (options?.onUpdateTask) {
          options.onUpdateTask(args);
        }

        return {
          ok: true,
          toolName: name,
          result: {
            id,
            updated: true,
            summary: `Updated task ${id}`,
          },
        };
      }

      case 'complete_task': {
        const target = String(args.id || args.taskIdOrTitle || '').trim();
        if (!target) {
          return {
            ok: false,
            toolName: name,
            error: 'ID_REQUIRED',
            message: 'Task ID is required to mark completion.',
          };
        }

        if (options?.onCompleteTask) {
          options.onCompleteTask(target);
        }

        return {
          ok: true,
          toolName: name,
          result: {
            id: target,
            completed: true,
            summary: `Completed task ${target}`,
          },
        };
      }

      case 'delete_task': {
        const id = String(args.id || '').trim();
        if (!id) {
          return {
            ok: false,
            toolName: name,
            error: 'ID_REQUIRED',
            message: 'Task ID is required for deletion.',
          };
        }

        if (options?.onDeleteTask) {
          options.onDeleteTask(id);
        }

        return {
          ok: true,
          toolName: name,
          result: {
            id,
            deleted: true,
            summary: `Deleted task ${id}`,
          },
        };
      }

      case 'list_tasks': {
        const filter = String(args.filter || 'all').toLowerCase();
        let tasks: any[] = [];
        if (options?.onListTasks) {
          tasks = options.onListTasks(filter);
        }
        return {
          ok: true,
          toolName: name,
          result: {
            filter,
            count: tasks.length,
            tasks,
            summary: `Found ${tasks.length} task(s) for filter "${filter}"`,
          },
        };
      }

      case 'set_reminder': {
        const text = String(args.text || '').trim();
        if (!text) {
          return {
            ok: false,
            toolName: name,
            error: 'TEXT_REQUIRED',
            message: 'Reminder text is required.',
          };
        }

        const id = String(args.id || `rem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
        let atIso = '';

        if (args.in_minutes && !isNaN(Number(args.in_minutes))) {
          const ms = Number(args.in_minutes) * 60 * 1000;
          atIso = new Date(Date.now() + ms).toISOString();
        } else if (args.at) {
          const parsed = Date.parse(args.at);
          if (!isNaN(parsed)) {
            atIso = new Date(parsed).toISOString();
          } else {
            // natural language fallback
            atIso = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          }
        } else {
          // Default to 15 minutes from now if neither at nor in_minutes given
          atIso = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }

        const repeat = ['daily', 'weekly'].includes(args.repeat) ? args.repeat : 'none';
        const reminderItem = {
          id,
          text,
          at: atIso,
          repeat,
          taskId: args.task_id,
          escalationLevel: 0,
          acknowledged: false,
          createdAt: Date.now(),
        };

        if (options?.onSetReminder) {
          options.onSetReminder(reminderItem);
        }

        return {
          ok: true,
          toolName: name,
          result: {
            id,
            text,
            at: atIso,
            repeat,
            summary: `Reminder set: "${text}" at ${new Date(atIso).toLocaleTimeString()}`,
          },
        };
      }

      case 'list_reminders': {
        let reminders: any[] = [];
        if (options?.onListReminders) {
          reminders = options.onListReminders();
        }
        return {
          ok: true,
          toolName: name,
          result: {
            count: reminders.length,
            reminders,
            summary: `Listing ${reminders.length} active reminder(s)`,
          },
        };
      }

      case 'cancel_reminder': {
        const id = String(args.id || '').trim();
        if (!id) {
          return {
            ok: false,
            toolName: name,
            error: 'ID_REQUIRED',
            message: 'Reminder ID is required to cancel.',
          };
        }
        if (options?.onCancelReminder) {
          options.onCancelReminder(id);
        }
        return {
          ok: true,
          toolName: name,
          result: {
            id,
            cancelled: true,
            summary: `Cancelled reminder ${id}`,
          },
        };
      }

      case 'snooze_reminder': {
        const id = String(args.id || '').trim();
        const mins = Number(args.minutes) || 15;
        if (!id) {
          return {
            ok: false,
            toolName: name,
            error: 'ID_REQUIRED',
            message: 'Reminder ID is required to snooze.',
          };
        }
        if (options?.onSnoozeReminder) {
          options.onSnoozeReminder(id, mins);
        }
        return {
          ok: true,
          toolName: name,
          result: {
            id,
            snoozedMinutes: mins,
            summary: `Snoozed reminder ${id} for ${mins} minutes`,
          },
        };
      }

      case 'start_timer': {
        const mins = Number(args.minutes) || 1;
        const label = String(args.label || 'Tactical Timer');
        const ms = mins * 60 * 1000;
        setTimeout(() => {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`[MAYA ALERT] ${label}`, {
              body: `Timer expired (${mins}m elapsed).`,
            });
          }
          window.dispatchEvent(
            new CustomEvent('maya-timer-alert', {
              detail: { label, minutes: mins },
            })
          );
        }, ms);
        return {
          ok: true,
          toolName: name,
          result: { minutes: mins, label, firesAt: new Date(Date.now() + ms).toLocaleTimeString() },
        };
      }

      case 'remember': {
        const fact = String(args.fact || '').trim();
        if (!fact) {
          return {
            ok: false,
            toolName: name,
            error: 'FACT_REQUIRED',
            message: 'Fact parameter is required to remember.',
          };
        }
        if (options?.onRemember) {
          options.onRemember(fact);
        }
        return {
          ok: true,
          toolName: name,
          result: {
            fact,
            stored: true,
            summary: `Stored in memory: "${fact}"`,
          },
        };
      }

      case 'forget': {
        const query = String(args.query || '').trim();
        if (!query) {
          return {
            ok: false,
            toolName: name,
            error: 'QUERY_REQUIRED',
            message: 'Query parameter is required to forget.',
          };
        }
        if (options?.onForget) {
          options.onForget(query);
        }
        return {
          ok: true,
          toolName: name,
          result: {
            query,
            forgotten: true,
            summary: `Removed memory matching "${query}"`,
          },
        };
      }

      case 'list_memory': {
        let memories: any[] = [];
        if (options?.onListMemory) {
          memories = options.onListMemory();
        }
        return {
          ok: true,
          toolName: name,
          result: {
            count: memories.length,
            memories,
            summary: `Listing ${memories.length} memory item(s)`,
          },
        };
      }

      case 'plan_day': {
        let planResult: any = null;
        if (options?.onPlanDay) {
          planResult = options.onPlanDay();
        }
        return {
          ok: true,
          toolName: name,
          result: {
            plan: planResult,
            summary: 'Formulated day schedule based on active priorities.',
          },
        };
      }

      case 'list_calendar_events': {
        const max = Number(args.maxResults) || 10;
        const res = await CalendarService.listUpcomingEvents(max);
        if (!res.ok) {
          if (res.error === 'NOT_AUTHENTICATED') {
            return {
              ok: false,
              toolName: name,
              error: 'GOOGLE_CALENDAR_NOT_CONNECTED',
              message: 'Google Workspace is not connected yet. Click "SIGN IN WITH GOOGLE" in the top bar or Workspace tab to connect your mail ID.',
            };
          }
          return {
            ok: false,
            toolName: name,
            error: res.error,
            message: `Calendar retrieval failed: ${res.error}`,
          };
        }

        const formatted = res.events.map((e) => ({
          id: e.id,
          summary: e.summary,
          start: e.start.dateTime || e.start.date,
          end: e.end.dateTime || e.end.date,
          location: e.location || 'N/A',
          link: e.htmlLink,
        }));

        return {
          ok: true,
          toolName: name,
          result: { count: formatted.length, events: formatted },
        };
      }

      case 'create_calendar_event': {
        const summary = String(args.summary || 'Meeting with Sirius');
        let rawStart = String(args.startTime || '').trim();
        let rawEnd = String(args.endTime || '').trim();

        // Natural language date parsing helper
        const parseDateInput = (str: string, fallbackOffsetHours: number): string => {
          if (!str) {
            return new Date(Date.now() + fallbackOffsetHours * 3600000).toISOString();
          }
          const parsed = Date.parse(str);
          if (!isNaN(parsed)) {
            return new Date(parsed).toISOString();
          }

          const lower = str.toLowerCase().trim();
          const target = new Date();
          if (lower.includes('tomorrow')) {
            target.setDate(target.getDate() + 1);
          }

          const inHoursMatch = lower.match(/in\s+(\d+)\s+hour/);
          if (inHoursMatch) {
            return new Date(Date.now() + parseInt(inHoursMatch[1], 10) * 3600000).toISOString();
          }

          const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
          if (timeMatch) {
            let hours = parseInt(timeMatch[1], 10);
            const mins = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
            const meridian = timeMatch[3]?.toLowerCase();
            if (meridian === 'pm' && hours < 12) hours += 12;
            if (meridian === 'am' && hours === 12) hours = 0;
            target.setHours(hours, mins, 0, 0);
            return target.toISOString();
          }

          return new Date(Date.now() + fallbackOffsetHours * 3600000).toISOString();
        };

        const startTime = parseDateInput(rawStart, 1);
        const endTime = rawEnd
          ? parseDateInput(rawEnd, 2)
          : new Date(new Date(startTime).getTime() + 3600000).toISOString();

        const res = await CalendarService.createEvent({
          summary,
          description: args.description,
          location: args.location,
          startTime,
          endTime,
        });

        if (!res.ok) {
          if (res.error === 'NOT_AUTHENTICATED') {
            return {
              ok: false,
              toolName: name,
              error: 'GOOGLE_CALENDAR_NOT_CONNECTED',
              message: 'Google Calendar is not connected. Please authenticate with Google first.',
            };
          }
          return {
            ok: false,
            toolName: name,
            error: res.error,
            message: `Could not schedule event: ${res.error}`,
          };
        }

        return {
          ok: true,
          toolName: name,
          result: {
            scheduled: true,
            summary,
            start: res.event?.start?.dateTime || startTime,
            end: res.event?.end?.dateTime || endTime,
            link: res.event?.htmlLink,
          },
        };
      }

      case 'delete_calendar_event': {
        const eventId = String(args.eventId || '');
        if (!eventId) {
          return {
            ok: false,
            toolName: name,
            error: 'MISSING_EVENT_ID',
            message: 'eventId parameter is required to delete a calendar event.',
          };
        }

        const res = await CalendarService.deleteEvent(eventId);
        if (!res.ok) {
          return {
            ok: false,
            toolName: name,
            error: res.error,
            message: `Failed to delete calendar event: ${res.error}`,
          };
        }

        return {
          ok: true,
          toolName: name,
          result: { deleted: true, eventId },
        };
      }

      // ----------------------------------------------------
      // GOOGLE WORKSPACE TOOLS
      // ----------------------------------------------------
      case 'list_drive_files': {
        const query = args.query ? String(args.query) : undefined;
        const pageSize = args.pageSize ? Number(args.pageSize) : 10;
        const res = await WorkspaceService.listDriveFiles(pageSize, query);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            count: res.files.length,
            files: res.files,
            summary: `Found ${res.files.length} file(s) in Google Drive${query ? ` matching "${query}"` : ''}`,
          },
        };
      }

      case 'read_sheet': {
        const spreadsheetId = String(args.spreadsheetId || '');
        const range = args.range ? String(args.range) : 'Sheet1!A1:Z50';
        const res = await WorkspaceService.readSheetValues(spreadsheetId, range);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            spreadsheetId,
            range,
            values: res.values,
            rowsCount: (res.values || []).length,
            summary: `Retrieved ${(res.values || []).length} row(s) from sheet range ${range}`,
          },
        };
      }

      case 'append_sheet': {
        const spreadsheetId = String(args.spreadsheetId || '');
        const range = args.range ? String(args.range) : 'Sheet1!A1';
        const values = Array.isArray(args.values) ? args.values : [String(args.values || '')];
        const res = await WorkspaceService.appendSheetRow(spreadsheetId, range, values);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            spreadsheetId,
            updatedRange: res.updatedRange,
            values,
            summary: `Appended row to ${res.updatedRange || 'Google Sheet'}`,
          },
        };
      }

      case 'list_emails': {
        const query = args.query ? String(args.query) : 'is:unread';
        const maxResults = args.maxResults ? Number(args.maxResults) : 5;
        const res = await WorkspaceService.listEmails(maxResults, query);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            count: res.messages.length,
            messages: res.messages,
            summary: `Found ${res.messages.length} email(s) for query "${query}"`,
          },
        };
      }

      case 'send_email': {
        const to = String(args.to || '').trim();
        const subject = String(args.subject || '').trim();
        const body = String(args.body || '').trim();
        const res = await WorkspaceService.sendEmail(to, subject, body);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            to,
            subject,
            messageId: res.messageId,
            summary: `Email sent to ${to} with subject "${subject}"`,
          },
        };
      }

      case 'create_doc': {
        const title = String(args.title || 'Untitled Document');
        const content = args.content ? String(args.content) : '';
        const res = await WorkspaceService.createDoc(title, content);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            docId: res.docId,
            title: res.title,
            link: `https://docs.google.com/document/d/${res.docId}/edit`,
            summary: `Created Google Doc "${res.title}"`,
          },
        };
      }

      case 'read_doc': {
        const documentId = String(args.documentId || '');
        const res = await WorkspaceService.readDoc(documentId);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            title: res.title,
            bodyPreview: res.bodyText?.slice(0, 500),
            summary: `Read Google Doc "${res.title}" (${res.bodyText?.length || 0} characters)`,
          },
        };
      }

      case 'list_google_tasks': {
        const maxResults = args.maxResults ? Number(args.maxResults) : 10;
        const res = await WorkspaceService.listTasks(maxResults);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            count: res.tasks.length,
            tasks: res.tasks,
            summary: `Found ${res.tasks.length} task(s) in Google Tasks`,
          },
        };
      }

      case 'create_google_task': {
        const title = String(args.title || '');
        const notes = args.notes ? String(args.notes) : undefined;
        const due = args.due ? String(args.due) : undefined;
        const res = await WorkspaceService.createTask(title, notes, due);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            task: res.task,
            summary: `Added "${title}" to Google Tasks`,
          },
        };
      }

      case 'complete_google_task': {
        const taskId = String(args.taskId || '');
        const res = await WorkspaceService.completeTask(taskId);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            taskId,
            completed: true,
            summary: `Marked Google Task ${taskId} as completed`,
          },
        };
      }

      case 'list_chat_spaces': {
        const res = await WorkspaceService.listChatSpaces();
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            count: res.spaces.length,
            spaces: res.spaces,
            summary: `Found ${res.spaces.length} Google Chat space(s)`,
          },
        };
      }

      case 'send_chat_message': {
        const spaceName = String(args.spaceName || '');
        const text = String(args.text || '');
        const res = await WorkspaceService.sendChatMessage(spaceName, text);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            spaceName,
            delivered: true,
            summary: `Dispatched message to Google Chat space ${spaceName}`,
          },
        };
      }

      case 'create_meet_space': {
        const res = await WorkspaceService.createMeetingSpace();
        return {
          ok: true,
          toolName: name,
          result: {
            meetUri: res.meetUri,
            spaceName: res.spaceName,
            summary: `Created instant Google Meet conference: ${res.meetUri}`,
          },
        };
      }

      case 'create_presentation': {
        const title = String(args.title || 'Untitled Presentation');
        const res = await WorkspaceService.createPresentation(title);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            presentationId: res.presentationId,
            title: res.title,
            webViewLink: res.webViewLink,
            summary: `Created Google Slides presentation "${res.title}"`,
          },
        };
      }

      case 'get_presentation': {
        const presentationId = String(args.presentationId || '');
        const res = await WorkspaceService.getPresentation(presentationId);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            presentationId,
            title: res.title,
            slideCount: res.slideCount,
            summary: `Found presentation "${res.title}" with ${res.slideCount} slides`,
          },
        };
      }

      case 'create_spreadsheet': {
        const title = String(args.title || 'Untitled Spreadsheet');
        const res = await WorkspaceService.createSpreadsheet(title);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            spreadsheetId: res.spreadsheetId,
            title: res.title,
            webViewLink: res.webViewLink,
            summary: `Created Google Sheet "${res.title}"`,
          },
        };
      }

      case 'get_form_responses': {
        const formId = String(args.formId || '');
        const res = await WorkspaceService.getFormResponses(formId);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            formId,
            responsesCount: res.responsesCount,
            summary: `Google Form ${formId} has received ${res.responsesCount} responses`,
          },
        };
      }

      case 'create_keep_note': {
        const title = String(args.title || 'Quick Note');
        const text = String(args.text || '');
        const res = await WorkspaceService.createKeepNote(title, text);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        // Also sync to local tactical notes
        if (options?.onSaveNote) {
          options.onSaveNote({ title, content: text, tag: 'KEEP', timestamp: Date.now() });
        }
        return {
          ok: true,
          toolName: name,
          result: {
            noteId: res.noteId,
            title,
            summary: `Saved note "${title}" to Google Keep & Tactical Workspace`,
          },
        };
      }


      // ----------------------------------------------------
      // CLOUD MEMORY & DASHBOARD TELEMETRY TOOLS
      // ----------------------------------------------------
      case 'save_cloud_memory': {
        const key = String(args.key || '');
        const value = String(args.value || '');
        const category = args.category ? String(args.category) : 'personal';
        const res = await CloudMemoryService.saveMemory(key, value, category);
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        if (options?.onRemember) {
          options.onRemember(`${key}: ${value}`);
        }
        return {
          ok: true,
          toolName: name,
          result: {
            id: res.id,
            key,
            value,
            syncedToCloud: true,
            summary: `Persisted "${key}" in Firestore private cloud memory`,
          },
        };
      }

      case 'list_cloud_memory': {
        const res = await CloudMemoryService.listMemories();
        if (!res.ok) {
          return { ok: false, toolName: name, error: res.error, message: res.error };
        }
        return {
          ok: true,
          toolName: name,
          result: {
            count: res.memories.length,
            memories: res.memories,
            summary: `Retrieved ${res.memories.length} item(s) from Maya private cloud memory`,
          },
        };
      }

      case 'get_dashboard_overview': {
        const tasks = options?.onListTasks ? options.onListTasks('all') : [];
        const openTasks = tasks.filter((t: any) => !t.completed);
        const reminders = options?.onListReminders ? options.onListReminders() : [];
        const memories = options?.onListMemory ? options.onListMemory() : [];
        return {
          ok: true,
          toolName: name,
          result: {
            openTasksCount: openTasks.length,
            totalTasksCount: tasks.length,
            activeRemindersCount: reminders.length,
            memoryItemsCount: memories.length,
            summary: `Dashboard Status: ${openTasks.length} open task(s), ${reminders.length} active reminder(s), ${memories.length} memory item(s)`,
          },
        };
      }

      default:
        return {
          ok: false,
          toolName: name,
          error: 'UNHANDLED_TOOL',
          message: `Tool ${name} has no browser implementation.`,
        };
    }
  }
}

export const toolBridge = new ToolBridge();
