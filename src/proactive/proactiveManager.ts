import { ProactiveSettings, CheckInLogEntry } from './types';
import { relationshipMemoryStore } from './relationshipMemoryStore';
import { safeFetchJson } from '../utils/safeFetch';

export type ProactiveTriggerType =
  | 'idle_10m'
  | 'continuous_work_2h'
  | 'water_stretch'
  | 'eye_rest'
  | 'meal_time'
  | 'sleep_winddown'
  | 'daily_brief'
  | 'task_deadline';

interface ProactiveCallback {
  onCheckIn: (reason: ProactiveTriggerType, line: string, inactivityMinutes?: number) => Promise<boolean | void>;
  onLog: (message: string) => void;
  getOpenTasks?: () => Array<{ title: string; priority?: string }>;
  getCurrentMode?: () => string;
}

const CHECK_IN_LINES: Record<ProactiveTriggerType, string[]> = {
  idle_10m: [
    'Still at your desk, Sirius? Just making sure you haven\'t turned into a caffeine elemental.',
    'Taking a breather, Chief, or lost in the architecture again?',
    'Everything quiet on the ASC perimeter. Standing by whenever you need a sounding board.',
    'Just checking in softly. Don\'t forget to blink once in a while.',
    'Sirius? I\'m right here if you want to run through those container specs.',
    'Checking on you. Remember, even lead architects need oxygen.',
  ],
  continuous_work_2h: [
    'Sirius, you\'ve been heads-down for two hours straight. Step away for five minutes—let your eyes rest.',
    'Two-hour focus block reached. Grab some water and stretch your shoulders, Chief.',
    'You\'ve been locked into the terminal for two hours. Stand up for a minute; your code will wait for you.',
  ],
  water_stretch: [
    'Hydration check, Sirius. Have you had a glass of water recently?',
    'Quick reminder to drink some water and roll your shoulders.',
  ],
  eye_rest: [
    'Twenty-twenty-twenty check: look at something 20 feet away for 20 seconds, Chief.',
    'Quick eye break, Sirius. Give the screen glare a rest.',
  ],
  meal_time: [
    'It\'s meal time, Chief. Step away from the keyboard and get some proper food.',
    'Fuel check, Sirius. Working through meals won\'t make the packets travel faster.',
  ],
  sleep_winddown: [
    'It\'s getting late, Sirius. Start winding down so you\'re sharp for tomorrow.',
    'Night cycle approaching. Even ASC mainframes go into low-power mode, Chief.',
  ],
  daily_brief: [
    'Good morning, Sirius. Operational brief is ready whenever you want to review today\'s priorities.',
    'Morning, Chief. ASC telemetry is live. Let\'s conquer today\'s milestones.',
  ],
  task_deadline: [
    'Friendly ping on your high-priority items. Let me know if you want to cross anything off.',
    'Just a soft heads-up on your pending deadlines, Sirius.',
  ],
};

export class ProactiveManager {
  private settings: ProactiveSettings;
  private callbacks: ProactiveCallback;
  private lastActivityTimestamp: number = Date.now();
  private lastCheckInTimestamp: number = 0;
  private checkInsTodayCount: number = 0;
  private lastCheckInDay: number = new Date().getDate();
  private lastInactivityIntervalFired: number = 0; // Tracks which 10m stage (1=10m, 2=20m, 3=30m...) was fired
  private currentBackoffMinutes: number = 10; // Baseline check-in cadence in minutes
  private snoozedUntilTimestamp: number = 0;
  private continuousWorkStart: number = Date.now();
  private lastContinuousWorkNudge: number = 0;
  private timerId: any = null;
  private isAwaitingResponse: boolean = false;
  private responseTimeoutId: any = null;
  private lastSpokenLine: string = '';
  private lastSpokenIndex: Record<string, number> = {};

  constructor(settings: ProactiveSettings, callbacks: ProactiveCallback) {
    this.settings = settings;
    this.callbacks = callbacks;
    this.setupUserActivityListeners();
  }

  public updateSettings(newSettings: Partial<ProactiveSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    this.callbacks.onLog(`PROACTIVE: Settings updated. Interval=${this.settings.inactivityIntervalMinutes || 10}m, Frequency=${this.settings.frequency}, Affection=${this.settings.affectionLevel}`);
  }

  public getSettings(): ProactiveSettings {
    return { ...this.settings };
  }

  private setupUserActivityListeners(): void {
    if (typeof window === 'undefined') return;

    const recordActivity = () => {
      this.recordUserActivity();
    };

    window.addEventListener('mousemove', recordActivity, { passive: true });
    window.addEventListener('keydown', recordActivity, { passive: true });
    window.addEventListener('mousedown', recordActivity, { passive: true });
    window.addEventListener('touchstart', recordActivity, { passive: true });
  }

  /**
   * Called whenever user types, moves mouse, or speaks
   */
  public recordUserActivity(): void {
    this.lastActivityTimestamp = Date.now();
    this.lastInactivityIntervalFired = 0; // Reset inactivity cycle upon user interaction

    // If user responded within the 20s window of a check-in, clear awaiting state
    if (this.isAwaitingResponse) {
      this.isAwaitingResponse = false;
      if (this.responseTimeoutId) {
        clearTimeout(this.responseTimeoutId);
        this.responseTimeoutId = null;
      }
      this.callbacks.onLog('PROACTIVE: Sirius acknowledged check-in. Inactivity cycle reset.');
    }
  }

  public start(): void {
    if (this.timerId) clearInterval(this.timerId);
    // Tick every 10 seconds to check idle and time-based conditions
    this.timerId = setInterval(() => {
      this.tick();
    }, 10000);
    const intervalMins = this.settings.inactivityIntervalMinutes || 10;
    this.callbacks.onLog(`PROACTIVE MONITOR: Engaged (adaptive check-in every ${intervalMins} minutes of inactivity).`);
  }

  public stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.responseTimeoutId) {
      clearTimeout(this.responseTimeoutId);
      this.responseTimeoutId = null;
    }
  }

  /**
   * Voice / Text command parser for snooze & control
   */
  public handleCommand(rawText: string): boolean {
    const text = rawText.toLowerCase().trim();

    // "not now" -> snooze 1 hour
    if (text.includes('not now')) {
      this.snooze(60);
      this.callbacks.onLog('PROACTIVE: Snoozed for 60 minutes via "not now".');
      return true;
    }

    // Frustration / Distress detection ("oh my god", "damn it", "so frustrated", etc.)
    const frustrationMatch = /\b(oh my god|omg|what the hell|damn it|dammit|so frustrated|i hate this|ugh+|i can'?t do this|are you kidding me|this is driving me crazy|i'?m so tired|why is this happening|for god'?s sake)\b/i.test(text);
    if (frustrationMatch) {
      const relMem = relationshipMemoryStore.getMemory();
      const name = this.settings.affectionLevel >= 2 ? (relMem.nicknames[0] || 'Sirius') : 'Sirius';
      const empathyResponses = [
        `Oh no, ${name}... what happened? Are you okay? Take a breath, talk to me.`,
        `Hey, easy there, ${name}... what went wrong? I'm right here with you. Did something break?`,
        `Take a breath, Chief. Talk to me—did the code fight back or is something else stressing you?`,
      ];
      const selected = empathyResponses[Math.floor(Math.random() * empathyResponses.length)];
      this.callbacks.onLog(`EMPATHY DETECTED: Sirius expressed frustration ("${rawText}"). Maya offering comfort.`);
      this.callbacks.onCheckIn('idle_10m', selected, 0);
      return true;
    }

    // "leave me alone for [duration]"
    const leaveMatch = text.match(/leave me alone for\s+(\d+)\s*(minute|min|hour|hr)?/i);
    if (leaveMatch) {
      const val = parseInt(leaveMatch[1], 10) || 60;
      const unit = leaveMatch[2] || 'min';
      const mins = unit.startsWith('hour') || unit.startsWith('hr') ? val * 60 : val;
      this.snooze(mins);
      this.callbacks.onLog(`PROACTIVE: Snoozed for ${mins} minutes via "leave me alone".`);
      return true;
    }

    // "stop check-ins" / "disable check-ins"
    if (text.includes('stop check-in') || text.includes('stop check in') || text.includes('disable check-in')) {
      this.updateSettings({ enabled: false });
      this.callbacks.onLog('PROACTIVE: Check-ins disabled by voice directive.');
      return true;
    }

    // "check-ins back on" / "enable check-ins"
    if (text.includes('check-in back on') || text.includes('check in back on') || text.includes('enable check-in')) {
      this.updateSettings({ enabled: true });
      this.snoozedUntilTimestamp = 0;
      this.callbacks.onLog('PROACTIVE: Check-ins re-enabled.');
      return true;
    }

    return false;
  }

  public snooze(minutes: number): void {
    this.snoozedUntilTimestamp = Date.now() + minutes * 60 * 1000;
  }

  private isQuietHours(): boolean {
    if (!this.settings.quietHoursEnabled) return false;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = this.settings.quietHoursStart.split(':').map(Number);
    const [endH, endM] = this.settings.quietHoursEnd.split(':').map(Number);

    const startMins = startH * 60 + (startM || 0);
    const endMins = endH * 60 + (endM || 0);

    if (startMins > endMins) {
      // Over midnight (e.g. 23:00 to 07:00)
      return currentMins >= startMins || currentMins < endMins;
    } else {
      return currentMins >= startMins && currentMins < endMins;
    }
  }

  private isFullscreenOrMeeting(): boolean {
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      return true;
    }
    return false;
  }

  /**
   * Get system idle time in seconds, querying desktop Electron bridge if available
   */
  private getIdleSeconds(): number {
    // If desktop Electron bridge has powerMonitor
    const desktopBridge = (window as any).maya;
    if (typeof desktopBridge?.getSystemIdleTime === 'function') {
      try {
        const electronIdle = desktopBridge.getSystemIdleTime();
        if (typeof electronIdle === 'number') return electronIdle;
      } catch (e) {
        // ignore
      }
    }
    // Web fallback
    return Math.floor((Date.now() - this.lastActivityTimestamp) / 1000);
  }

  /**
   * Generates a context-aware, adaptive check-in line tailored to the exact inactivity duration
   */
  private async generateAdaptiveLine(inactivityMinutes: number): Promise<string> {
    const openTasks = this.callbacks.getOpenTasks ? this.callbacks.getOpenTasks() : [];
    const topTask = openTasks[0]?.title || '';
    const currentMode = this.callbacks.getCurrentMode ? this.callbacks.getCurrentMode() : 'COMMAND';

    // 1. Attempt dynamic generation via server Gemini proxy
    try {
      const res = await safeFetchJson('/api/maya/adaptive-checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inactivityMinutes,
          tasks: openTasks.slice(0, 3).map((t) => t.title),
          mode: currentMode,
          userName: 'Sirius',
          affectionLevel: this.settings.affectionLevel,
          lastSpoken: this.lastSpokenLine,
        }),
      });

      if (res.ok && res.data?.ok && res.data?.text) {
        this.lastSpokenLine = res.data.text;
        return res.data.text;
      }
    } catch (e) {
      // Server fetch failed, proceed to local contextual engine
    }

    // 2. Local resilient contextual generation based on elapsed inactivity
    const relMem = relationshipMemoryStore.getMemory();
    const name = this.settings.affectionLevel >= 2 ? (relMem.nicknames[0] || 'Sirius') : 'Sirius';

    const stageFallbacks: Record<number, string[]> = {
      15: [
        topTask
          ? `Hey ${name}, 15 minutes away from the keyboard. Ready to jump back into "${topTask}" or taking a breather?`
          : `Hey ${name}, 15-minute pause detected. Standing by whenever you want to resume the sprint.`,
        `15 minutes away, ${name}. Grab a sip of water, then let's knock out the next milestone.`,
        topTask
          ? `Quick 15m check: "${topTask}" is waiting on deck whenever you're ready.`
          : `Everything quiet on the perimeter for 15 minutes, Chief. Standing by.`,
      ],
      30: [
        topTask
          ? `30 minutes away, ${name}. "${topTask}" is primed and ready when you're back.`
          : `30-minute breather, ${name}. Hope you're stretching your shoulders and resting your eyes; I'm here when you're ready.`,
        `Checking in at 30 minutes, Chief. Let me know if you want to kick off a 25-minute Pomodoro.`,
      ],
      45: [
        `45 minutes away, ${name}. Hydration and eye-rest check. Standing by at the terminal.`,
        topTask
          ? `45-minute mark, ${name}. When you return, shall we tackle "${topTask}" or review notes?`
          : `45 minutes inactive, Chief. Systems are idle and ready whenever you want to re-engage.`,
      ],
      60: [
        `An hour away from the desk, ${name}. Systems are secure. Take a proper rest; I'm keeping everything safe.`,
      ],
    };

    const pool =
      stageFallbacks[inactivityMinutes] ||
      stageFallbacks[15] || [
        `Hey ${name}, ${inactivityMinutes} minutes away. Standing by whenever you're ready to roll.`,
      ];

    const line = pool.find((item) => item !== this.lastSpokenLine) || pool[0];
    this.lastSpokenLine = line;
    return line;
  }

  private selectLine(type: ProactiveTriggerType): string {
    const list = CHECK_IN_LINES[type] || CHECK_IN_LINES.idle_10m;
    const lastIdx = this.lastSpokenIndex[type] ?? -1;

    let nextIdx = Math.floor(Math.random() * list.length);
    if (list.length > 1 && nextIdx === lastIdx) {
      nextIdx = (nextIdx + 1) % list.length;
    }
    this.lastSpokenIndex[type] = nextIdx;

    let line = list[nextIdx];

    // Personalize with relationship memory if affection level is warm/high
    if (this.settings.affectionLevel >= 2) {
      const memory = relationshipMemoryStore.getMemory();
      const nickname = memory.nicknames[0] || 'Sirius';
      line = line.replace(/Sirius|Chief/g, nickname);
    }

    return line;
  }

  /**
   * Triggers an adaptive check-in for a specific inactivity interval (e.g. 15m, 30m, 45m)
   */
  public async triggerAdaptiveCheckIn(inactivityMinutes: number = 15): Promise<void> {
    const now = Date.now();
    this.lastCheckInTimestamp = now;
    this.checkInsTodayCount++;

    const line = await this.generateAdaptiveLine(inactivityMinutes);
    this.callbacks.onLog(`PROACTIVE ADAPTIVE TRIGGER: [${inactivityMinutes}m inactivity] -> "${line}"`);

    // Flag awaiting response for 20 seconds
    this.isAwaitingResponse = true;
    if (this.responseTimeoutId) clearTimeout(this.responseTimeoutId);
    this.responseTimeoutId = setTimeout(() => {
      if (this.isAwaitingResponse) {
        this.isAwaitingResponse = false;
        this.callbacks.onLog(`PROACTIVE: No response in 20s. Maya returns to standby.`);
      }
    }, 20000);

    await this.callbacks.onCheckIn('idle_10m', line, inactivityMinutes);
  }

  private async triggerCheckIn(reason: ProactiveTriggerType): Promise<void> {
    const now = Date.now();
    this.lastCheckInTimestamp = now;
    this.checkInsTodayCount++;

    const line = this.selectLine(reason);
    this.callbacks.onLog(`PROACTIVE TRIGGER: [${reason}] -> Maya speaking check-in.`);

    // Flag awaiting response for 20 seconds
    this.isAwaitingResponse = true;
    if (this.responseTimeoutId) clearTimeout(this.responseTimeoutId);
    this.responseTimeoutId = setTimeout(() => {
      if (this.isAwaitingResponse) {
        this.isAwaitingResponse = false;
        this.callbacks.onLog(`PROACTIVE: No response in 20s. Maya returns to standby.`);
      }
    }, 20000);

    await this.callbacks.onCheckIn(reason, line);
  }

  private tick(): void {
    if (!this.settings.enabled) return;
    if (this.settings.dndEnabled) return;
    if (this.settings.frequency === 'off') return;

    // Daily reset check
    const today = new Date().getDate();
    if (today !== this.lastCheckInDay) {
      this.lastCheckInDay = today;
      this.checkInsTodayCount = 0;
    }

    // High daily cap to support periodic 10-minute check-ins across the working day
    if (this.checkInsTodayCount >= 48) return;

    const now = Date.now();

    // Snooze check
    if (now < this.snoozedUntilTimestamp) return;

    // Quiet hours & Fullscreen check
    if (this.isQuietHours() || this.isFullscreenOrMeeting()) return;

    // Check 1: Adaptive Check-in for every 15 minutes of inactivity
    const intervalMins = this.settings.inactivityIntervalMinutes || 15;
    const intervalSecs = intervalMins * 60;
    const idleSecs = this.getIdleSeconds();
    const currentStage = Math.floor(idleSecs / intervalSecs);

    if (currentStage >= 1 && currentStage > this.lastInactivityIntervalFired) {
      this.lastInactivityIntervalFired = currentStage;
      const inactivityMinutes = currentStage * intervalMins;
      this.triggerAdaptiveCheckIn(inactivityMinutes);
      return;
    }

    // Check 2: 2-Hour Continuous Working Nudge
    if (this.settings.reminders.waterAndStretch || this.settings.reminders.eyeRest) {
      const continuousSecs = Math.floor((now - this.continuousWorkStart) / 1000);
      const twoHoursSecs = 2 * 60 * 60;
      if (continuousSecs >= twoHoursSecs && now - this.lastContinuousWorkNudge > 60 * 60 * 1000) {
        this.lastContinuousWorkNudge = now;
        this.continuousWorkStart = now; // reset focus clock
        this.triggerCheckIn('continuous_work_2h');
        return;
      }
    }
  }
}
