import cron from 'node-cron';
import { db, settingsModel, activityModel } from './db.ts';
import { WebPushService } from './webPushService.ts';
import { generateWithFallback } from './geminiService.ts';

// Cache last generated check-in message to ensure we never repeat twice in a row
let lastCheckinMessage = '';

/**
 * Check if the given time in the user's timezone falls within quiet hours.
 * quietStart (e.g. "22:00"), quietEnd (e.g. "07:00"), timezone (e.g. "Asia/Kolkata")
 */
function isQuietHours(timezone: string, quietStart: string, quietEnd: string): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
    const currentMinutes = hour * 60 + minute;

    const [startH, startM] = quietStart.split(':').map((v) => parseInt(v, 10));
    const [endH, endM] = quietEnd.split(':').map((v) => parseInt(v, 10));
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes > endMinutes) {
      // Overnight quiet hours, e.g. 22:00 to 07:00
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    } else {
      // Same-day quiet hours, e.g. 13:00 to 15:00
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }
  } catch (e) {
    return false;
  }
}

/**
 * Get current time string (HH:mm) and date string (YYYY-MM-DD) in specified timezone
 */
function getTimeAndDateInTimezone(timezone: string): { timeStr: string; dateStr: string; hour: number; minute: number } {
  const now = new Date();
  const timeFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = timeFormatter.formatToParts(now);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const dateStr = dateFormatter.format(now);

  return { timeStr, dateStr, hour, minute };
}

/**
 * Main Scheduler execution tick running once every minute
 */
export async function runSchedulerTick() {
  const settings = settingsModel.get();
  if (!settings) return;

  // 1. If global pause switch is active, suppress all automated pushes
  if (settings.paused) {
    return;
  }

  const tz = settings.timezone || 'Asia/Kolkata';
  const { timeStr, dateStr, hour, minute } = getTimeAndDateInTimezone(tz);
  const inQuietHours = isQuietHours(tz, settings.quietStart || '22:00', settings.quietEnd || '07:00');
  const now = Date.now();

  // Reset daily check-in counter at midnight
  activityModel.resetDailyCheckinsIfNeeded(dateStr);

  // ----------------------------------------------------
  // 2. REMINDER ESCALATION LADDER
  // ----------------------------------------------------
  // Find pending reminders whose nextFireAt <= now
  const pendingReminders = db
    .prepare(
      `SELECT * FROM reminders WHERE status = 'pending' AND nextFireAt <= ?`
    )
    .all(now) as any[];

  for (const rem of pendingReminders) {
    // If quiet hours and item is not marked critical, defer fire time to quietEnd
    if (inQuietHours && !rem.critical) {
      continue;
    }

    const fireCount = rem.fireCount || 0;
    let pushTitle = '';
    let pushBody = '';
    let nextFireAt = rem.nextFireAt;
    let newStatus = 'pending';

    if (fireCount === 0) {
      // Step 1: At due time
      pushTitle = `Maya: Reminder`;
      pushBody = rem.text;
      // Schedule Step 2 (+10 minutes)
      nextFireAt = now + 10 * 60 * 1000;
    } else if (fireCount === 1) {
      // Step 2: +10 minutes firmer wording
      pushTitle = `Maya: Follow-up`;
      pushBody = `Still pending: "${rem.text}". Let's get this knocked out, Sirius.`;
      // Schedule Step 3 (+20 minutes to reach +30 min total)
      nextFireAt = now + 20 * 60 * 1000;
    } else if (fireCount === 2) {
      // Step 3: +30 minutes final escalation
      pushTitle = `Maya: Urgent Notice`;
      pushBody = `Priority reminder: "${rem.text}". I'm not asking twice, Sirius!`;
      // Stop further escalations and mark as missed
      newStatus = 'missed';
      nextFireAt = now + 24 * 60 * 60 * 1000; // Far future / dormant
    } else {
      continue;
    }

    // Dispatch Web Push
    await WebPushService.broadcast({
      title: pushTitle,
      body: pushBody,
      kind: 'reminder',
      id: rem.id,
      requireInteraction: true,
      tag: `reminder-${rem.id}`,
      actions: [
        { action: 'done', title: 'Done' },
        { action: 'snooze_15', title: 'Snooze 15m' },
        { action: 'open', title: 'Open' },
      ],
      data: {
        reminderId: rem.id,
        fireCount: fireCount + 1,
      },
    });

    // Update reminder state in SQLite
    db.prepare(`
      UPDATE reminders
      SET fireCount = fireCount + 1, lastFiredAt = ?, nextFireAt = ?, status = ?, updatedAt = ?
      WHERE id = ?
    `).run(now, nextFireAt, newStatus, now, rem.id);
  }

  // ----------------------------------------------------
  // 3. TASK DEADLINES & OVERDUE NOTIFICATIONS
  // ----------------------------------------------------
  // a) 30 minutes before due time
  const upcomingTasks = db
    .prepare(
      `SELECT * FROM tasks
       WHERE completed = 0 AND dueTimestamp IS NOT NULL
       AND preReminderFired = 0
       AND dueTimestamp > ? AND dueTimestamp <= ?`
    )
    .all(now, now + 30 * 60 * 1000) as any[];

  for (const task of upcomingTasks) {
    if (inQuietHours) continue;

    await WebPushService.broadcast({
      title: `Maya: Upcoming Deadline in 30m`,
      body: `"${task.title}" is due soon. Want to wrap it up?`,
      kind: 'task_deadline',
      id: task.id,
      tag: `task-pre-${task.id}`,
      actions: [
        { action: 'done', title: 'Mark Done' },
        { action: 'open', title: 'Open' },
      ],
      data: { taskId: task.id, type: 'pre_due' },
    });

    db.prepare('UPDATE tasks SET preReminderFired = 1, updatedAt = ? WHERE id = ?').run(now, task.id);
  }

  // b) At due time
  const dueTasks = db
    .prepare(
      `SELECT * FROM tasks
       WHERE completed = 0 AND dueTimestamp IS NOT NULL
       AND dueReminderFired = 0
       AND dueTimestamp <= ?`
    )
    .all(now) as any[];

  for (const task of dueTasks) {
    if (inQuietHours) continue;

    await WebPushService.broadcast({
      title: `Maya: Task Due Now`,
      body: `Deadline reached: "${task.title}". Tap to check in.`,
      kind: 'task_deadline',
      id: task.id,
      tag: `task-due-${task.id}`,
      actions: [
        { action: 'done', title: 'Mark Done' },
        { action: 'open', title: 'Open' },
      ],
      data: { taskId: task.id, type: 'due' },
    });

    db.prepare('UPDATE tasks SET dueReminderFired = 1, updatedAt = ? WHERE id = ?').run(now, task.id);
  }

  // c) Overdue notification (once per morning at 08:30 IST)
  if (timeStr === '08:30') {
    const overdueTasks = db
      .prepare(
        `SELECT * FROM tasks
         WHERE completed = 0 AND dueTimestamp IS NOT NULL
         AND dueTimestamp < ? AND (overdueFiredDate IS NULL OR overdueFiredDate != ?)`
      )
      .all(now - 30 * 60 * 1000, dateStr) as any[];

    if (overdueTasks.length > 0) {
      const taskNames = overdueTasks.slice(0, 2).map((t) => t.title).join(', ');
      const extraCount = overdueTasks.length > 2 ? ` and ${overdueTasks.length - 2} more` : '';
      await WebPushService.broadcast({
        title: `Maya: Overdue Tasks Alert`,
        body: `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''}: ${taskNames}${extraCount}.`,
        kind: 'task_deadline',
        tag: `task-overdue-${dateStr}`,
        actions: [{ action: 'open', title: 'Review Tasks' }],
        data: { count: overdueTasks.length },
      });

      db.prepare(`
        UPDATE tasks
        SET overdueFiredDate = ?, updatedAt = ?
        WHERE completed = 0 AND dueTimestamp IS NOT NULL AND dueTimestamp < ?
      `).run(dateStr, now, now);
    }
  }

  // ----------------------------------------------------
  // 4. SCHEDULED BRIEFINGS (08:00 IST Morning & 21:00 IST Evening)
  // ----------------------------------------------------
  const morningTime = settings.briefingMorningTime || '08:00';
  const eveningTime = settings.briefingEveningTime || '21:00';

  if (timeStr === morningTime) {
    await sendMorningBriefing();
  } else if (timeStr === eveningTime) {
    await sendEveningReview();
  }

  // ----------------------------------------------------
  // 5. FRIENDLY ADAPTIVE CHECK-IN ENGINE (EVERY 10 MINS INACTIVITY)
  // ----------------------------------------------------
  if (settings.checkinsEnabled && !inQuietHours) {
    const activity = activityModel.get();
    const intervalMinutes = settings.inactivityCheckIntervalMinutes || 10;
    const intervalMs = intervalMinutes * 60 * 1000;
    const maxPerDay = settings.maxCheckinsPerDay || 24;
    const lastActiveAt = activity?.lastActiveAt || now;
    const timeSinceActive = now - lastActiveAt;
    const checkinsToday = activity?.checkinsToday || 0;
    const consecutiveIgnored = activity?.consecutiveIgnoredCheckins || 0;

    // Check if user has been inactive for at least intervalMinutes (e.g. 10m)
    // and at least intervalMinutes have elapsed since the last check-in
    if (timeSinceActive >= intervalMs && checkinsToday < maxPerDay) {
      const lastCheckinAt = activity?.lastCheckinAt || 0;
      if (now - lastCheckinAt >= intervalMs) {
        const inactivityMins = Math.max(intervalMinutes, Math.floor(timeSinceActive / 60000));
        await sendAdaptiveCheckin(activity, settings, dateStr, inactivityMins);
      }
    }
  }
}

/**
 * Generate and dispatch Morning Briefing push via Gemini with template fallback
 */
async function sendMorningBriefing() {
  const openTasks = db.prepare('SELECT title, priority FROM tasks WHERE completed = 0 LIMIT 5').all() as any[];
  const activeHabits = db.prepare('SELECT name, streak FROM habits LIMIT 4').all() as any[];

  let briefText = '';

  if (process.env.GEMINI_API_KEY) {
    try {
      const taskList = openTasks.map((t) => `- ${t.title} (${t.priority})`).join('\n') || 'No critical tasks logged';
      const habitList = activeHabits.map((h) => `- ${h.name} (${h.streak}d streak)`).join('\n') || 'None';

      const prompt = `You are Maya, Sirius's personal AI secretary and close friend at Axiom Secure Crafts.
Draft a short, energizing morning briefing for him at 8:00 AM.
Tasks today:
${taskList}
Habits:
${habitList}

RULES:
- Maximum 25 words.
- Warm, focused, executive tone.
- Reference one high-priority task.
- Address him as Sirius.`;

      const response = await generateWithFallback({
        contents: prompt,
        primaryModel: 'gemini-3.8-flash',
        timeoutMs: 5000,
      });

      briefText = response.text?.trim() || '';
    } catch (err) {
      // Clean fallback without logging raw quota dumps
    }
  }

  if (!briefText) {
    const taskCount = openTasks.length;
    briefText = `Good morning, Sirius. You have ${taskCount} open item${taskCount === 1 ? '' : 's'} on deck today. Ready to plan the sprint?`;
  }

  await WebPushService.broadcast({
    title: 'Maya // Morning Briefing',
    body: briefText,
    kind: 'morning_briefing',
    tag: `briefing-morning-${Date.now()}`,
    actions: [{ action: 'open', title: 'Open Maya' }],
    data: { prefill: 'Plan my morning schedule' },
  });
}

/**
 * Generate and dispatch Evening Review push via Gemini with template fallback
 */
async function sendEveningReview() {
  const completedToday = db.prepare('SELECT count(*) as count FROM tasks WHERE completed = 1').get() as any;
  const remainingTasks = db.prepare('SELECT count(*) as count FROM tasks WHERE completed = 0').get() as any;

  let reviewText = '';

  if (process.env.GEMINI_API_KEY) {
    try {
      const prompt = `You are Maya, Sirius's personal AI secretary and close friend.
Draft a brief 9:00 PM evening check-in / review.
Completed tasks: ${completedToday?.count || 0}. Remaining tasks: ${remainingTasks?.count || 0}.

RULES:
- Maximum 22 words.
- Warm, supportive friend tone.
- Acknowledge his progress, suggest closing open loops or resting.
- Address him as Sirius.`;

      const response = await generateWithFallback({
        contents: prompt,
        primaryModel: 'gemini-3.8-flash',
        timeoutMs: 5000,
      });

      reviewText = response.text?.trim() || '';
    } catch (err) {
      // Clean fallback without logging raw quota dumps
    }
  }

  if (!reviewText) {
    reviewText = `Evening, Sirius. ${completedToday?.count || 0} tasks cleared today. Quick debrief or wrapping up for tonight?`;
  }

  await WebPushService.broadcast({
    title: 'Maya // Evening Debrief',
    body: reviewText,
    kind: 'evening_review',
    tag: `briefing-evening-${Date.now()}`,
    actions: [{ action: 'open', title: 'Open Maya' }],
    data: { prefill: 'Debrief my day' },
  });
}

/**
 * Generate and dispatch Friendly Check-in push via Gemini with strict persona guardrails
 */
async function sendAdaptiveCheckin(activity: any, settings: any, dateStr: string, inactivityMins: number = 10) {
  const openTasks = db.prepare('SELECT title FROM tasks WHERE completed = 0 LIMIT 3').all() as any[];
  const sampleTask = openTasks[0]?.title || '';

  let message = '';

  if (process.env.GEMINI_API_KEY) {
    try {
      const prompt = `You are Maya, Sirius's executive AI assistant and close friend at Axiom Secure Crafts (ASC).
Sirius has been inactive or away from his desk for ${inactivityMins} minutes.
One open task on his queue: "${sampleTask || 'ASC project sprint'}".
Last message sent: "${lastCheckinMessage}".

PERSONA & ADAPTIVE RULES:
- Tone: ${settings.tone === 'firm' ? 'Direct and motivating' : 'Warm, executive, and encouraging'}.
- Acknowledge his ${inactivityMins}-minute break or pause naturally.
- Inactivity duration context:
  * 10m: Quick breather check, ask if he wants a 25-minute focus session or to wrap up "${sampleTask}".
  * 20m: Context reminder, check if he needs a quick stretch or coffee.
  * 30m+: Posture and hydration reminder, standing by for when he returns.
- Hard constraint: UNDER 22 WORDS.
- Reference the open task if possible.
- NEVER repeat the exact phrasing of the last message.
- Friendly and supportive only. NO romantic/possessive language, no guilt-tripping. Address him as Sirius.`;

      const response = await generateWithFallback({
        contents: prompt,
        primaryModel: 'gemini-3.8-flash',
        timeoutMs: 5000,
      });

      message = response.text?.trim() || '';
    } catch (err) {
      // Clean fallback without logging raw quota dumps
    }
  }

  if (!message || message === lastCheckinMessage) {
    const fallbacks = [
      sampleTask
        ? `Hey Sirius, ${inactivityMins}m away. Ready to jump back into "${sampleTask}" or taking a quick breather?`
        : `Hey Sirius, ${inactivityMins} minutes inactive. Ready for a quick focus session, or still taking five?`,
      `Quick check-in (${inactivityMins}m): Remember to hydrate and stretch, Sirius. Standing by when you're ready.`,
      sampleTask
        ? `"${sampleTask}" is queued up whenever you're back at the keys, Sirius.`
        : `Checking in after ${inactivityMins}m, Sirius. What's our next milestone?`,
    ];
    message = fallbacks.find((f) => f !== lastCheckinMessage) || fallbacks[0];
  }

  lastCheckinMessage = message;

  await WebPushService.broadcast({
    title: `Maya // Inactivity Check (${inactivityMins}m)`,
    body: message,
    kind: 'checkin',
    tag: `maya-checkin-${Date.now()}`,
    actions: [
      { action: 'open', title: 'Resume Focus' },
      { action: 'snooze_15', title: 'Resting 15m' },
    ],
    data: { prefill: 'I am back at my desk, Maya', inactivityMins },
  });

  activityModel.recordCheckinSent(dateStr);
}

/**
 * Start background cron scheduler running every minute
 */
export function startScheduler() {
  console.log('[Scheduler] Initializing automated minute cron scheduler (Asia/Kolkata timezone support)...');
  // Runs once every minute: * * * * *
  cron.schedule('* * * * *', async () => {
    try {
      await runSchedulerTick();
    } catch (err) {
      console.error('[Scheduler] Error during minute tick:', err);
    }
  });
}
