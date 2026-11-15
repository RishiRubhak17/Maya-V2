export type AffectionLevel = 0 | 1 | 2 | 3;
export type CheckInFrequency = 'off' | 'low' | 'normal';

export interface ProactiveReminderConfig {
  tasksAndDeadlines: boolean;
  waterAndStretch: boolean;
  eyeRest: boolean;
  mealTimes: boolean;
  sleepWindDown: boolean;
  dailyBrief: boolean;
  dailyBriefTime: string; // e.g. "09:00"
  upcomingEventPrep: boolean;
}

export interface ProactiveSettings {
  enabled: boolean;
  frequency: CheckInFrequency;
  affectionLevel: AffectionLevel;
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "23:00"
  quietHoursEnd: string;   // "07:00"
  dndEnabled: boolean;
  reminders: ProactiveReminderConfig;
  idleTimeoutSeconds: number; // 600s = 10 mins
  inactivityIntervalMinutes?: number; // 10 mins default
  adaptiveAiEnabled?: boolean;
}

export interface CheckInLogEntry {
  id: string;
  timestamp: number;
  reason: string;
  lineSpoken: string;
  response: 'replied' | 'ignored' | 'snoozed' | 'dismissed';
  intervalMinutes: number;
}

export interface RelationshipMemory {
  approved: boolean;
  nicknames: string[];
  insideJokes: string[];
  milestones: Array<{ id: string; title: string; date: string; note: string }>;
  favoriteThings: Array<{ id: string; category: string; value: string }>;
}
