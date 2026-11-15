export type MayaMode =
  | 'COMMAND'
  | 'BUILDER'
  | 'SENTINEL'
  | 'BRIEF'
  | 'CHILL'
  | 'CYBER'
  | 'BUILD'
  | 'STRATEGY'
  | 'FOCUS';

export type LiveSessionState = 'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface ActionLogItem {
  id: string;
  toolName: string;
  summary: string;
  timestamp: number;
  undoAction?: {
    type:
      | 'delete_task'
      | 'uncomplete_task'
      | 'revert_task'
      | 'cancel_reminder'
      | 'forget_memory'
      | 'delete_note'
      | 'delete_expense'
      | 'delete_event';
    payload: any;
  };
}

export interface ChatMessage {
  id: string;
  sender: 'sirius' | 'maya' | 'system';
  text: string;
  timestamp: string | number;
  mode: MayaMode;
  isSpoken?: boolean;
  sources?: GroundingSource[];
  actionLogs?: ActionLogItem[];
  isReminderAlert?: boolean;
  metadata?: {
    isRiskyAction?: boolean;
    confirmed?: boolean;
    builderPlatform?: 'Lovable' | 'v0.dev' | 'Bolt.new' | 'Raw Code';
    projectRef?: string;
    actionDetails?: string;
    viaLiveApi?: boolean;
    citationPages?: number[];
  };
}

export interface AppSettings {
  voice: 'Aoede' | 'Kore' | 'Zephyr' | 'Fenrir' | 'Puck' | 'Charon' | string;
  searchGrounding: boolean;
  saveTranscript: boolean;
  wakeWordEnabled: boolean;
  sensitivity: 'strict' | 'normal' | 'loose';
  userName: string;
  greetingLanguage: 'English' | 'Tamil' | 'Mix';
  speakingRate: number;
  affectionLevel: 0 | 1 | 2 | 3;
  checkInFrequency: 'off' | 'low' | 'normal';
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  dndEnabled: boolean;
  waterAndStretch: boolean;
  eyeRest: boolean;
  mealTimes: boolean;
  sleepWindDown: boolean;
  dailyBrief: boolean;
  dailyBriefTime: string;
  ollamaModel: string;
  selectedModelSize: string;
  geminiModel: 'gemini-2.5-flash' | 'gemini-2.5-pro' | 'gemini-3.8-flash';
  customApiKey?: string;
  morningRoutineTime: string;
  middayCheckInTime: string;
  eveningReviewTime: string;
  easeOffActive: boolean;
  remindersPaused: boolean;
  personaIntensity: 'gentle' | 'firm' | 'strict';
  timeZone: string;
  securityPasscode?: string;
  securityEncryptionEnabled?: boolean;
  onboardingCompleted?: boolean;

  // Background Push & Scheduler Settings
  backendUrl?: string;
  backendToken?: string;
  pushEnabled?: boolean;
  useServerProxy?: boolean;
  privateNotifications?: boolean;
  hoursOfSilence?: number;
  maxCheckinsPerDay?: number;
  checkinsTone?: 'friendly' | 'firm';
  muteCheckinsToday?: boolean;
  inactivityCheckIntervalMinutes?: number;
  adaptiveCheckInsEnabled?: boolean;

  // Voice Biometrics & Speaker Verification
  voiceLockEnabled?: boolean;
  voiceLockSensitivity?: number;
}

export interface TacticalSubtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TacticalTask {
  id: string;
  title: string;
  priority: 'high' | 'med' | 'low';
  due: string | null; // ISO 8601 or natural descriptor
  project?: string;
  repeat?: 'none' | 'daily' | 'weekly';
  completed: boolean;
  createdAt: number;
  updatedAt?: number;
  estimateMinutes?: number;
  actualMinutes?: number;
  subtasks?: TacticalSubtask[];
  status?: 'todo' | 'in_progress' | 'done' | 'blocked';
  movesCount?: number; // Procrastination detector: moved 3 times triggers split/drop suggestion
  notes?: string;
}

export interface ReminderItem {
  id: string;
  text: string;
  at: string; // ISO 8601
  repeat?: 'none' | 'daily' | 'weekly';
  taskId?: string;
  escalationLevel: 0 | 1 | 2; // 0: initial, 1: +10 min, 2: +30 min (re-plan lowest priority)
  acknowledged: boolean;
  lastFiredAt?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface HabitItem {
  id: string;
  name: string;
  category: 'health' | 'code' | 'focus' | 'study';
  targetDaysPerWeek: number;
  currentStreak: number;
  bestStreak: number;
  history: Record<string, boolean>; // 'YYYY-MM-DD': boolean
  reminderTime?: string;
  lastCompletedDate?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface FocusSession {
  id: string;
  startTime: number;
  endTime?: number;
  durationMinutes: number;
  type: 'pomodoro' | 'custom';
  taskTitle?: string;
  notes?: string;
  completed: boolean;
}

export interface TacticalNote {
  id: string;
  title: string;
  content: string;
  tag: string;
  timestamp: number;
}

export interface AscProject {
  id: string;
  name: string;
  tagline: string;
  category: 'Attendance' | 'IoT / Utilities' | 'Web Portal' | 'Security / CTF' | 'AI / CV';
  status: 'In Progress' | 'Staging Review' | 'Lab Testing' | 'Active';
  deadline: string;
  lead: string;
  progressPercent: number;
  description: string;
  techStack: string[];
  health?: 'green' | 'amber' | 'red';
  overdueTaskCount?: number;
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  focus: string;
  status: 'Active' | 'In Lab' | 'Reviewing' | 'Standby';
  recentTask: string;
}

export interface MemoryItem {
  id: string;
  key: string;
  value: string;
  category: 'preference' | 'project' | 'team' | 'security' | 'personal';
  savedAt: string;
}

export interface TacticalAlert {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  category: 'security' | 'deadline' | 'brief' | 'team';
  read: boolean;
}

export interface ExpenseItem {
  id: string;
  title: string;
  amount: number;
  category: 'hardware' | 'food' | 'transport' | 'hosting' | 'tools' | 'education' | 'general';
  timestamp: number;
  notes?: string;
  isRecurringBill?: boolean;
  dueDate?: string;
}

export interface DecisionLogItem {
  id: string;
  title: string;
  rationale: string;
  alternativesConsidered?: string;
  outcome?: string;
  timestamp: number;
}

export interface FollowUpItem {
  id: string;
  who: string;
  about: string;
  dueDate: string;
  draftedMessage?: string;
  completed: boolean;
  createdAt: number;
}

export interface DocumentChunk {
  id: string;
  docId: string;
  fileName: string;
  fileType: string;
  pageNumber?: number;
  chunkText: string;
  embedding?: number[];
  uploadedAt: number;
}

export interface FlashcardItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  intervalDays: number;
  easeFactor: number;
  nextReviewDate: string;
  reviewsCount: number;
}

export interface ExamUnit {
  id: string;
  name: string;
  confidence: 'low' | 'med' | 'high';
  notes?: string;
}

export interface ExamPlanItem {
  id: string;
  subject: string;
  examDate: string;
  units: ExamUnit[];
  revisionSchedule?: { date: string; unitName: string }[];
}

export interface HardwareReading {
  id: string;
  device: 'serial' | 'ble';
  label: string;
  value: number;
  unit?: string;
  timestamp: number;
  anomaly?: boolean;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  description?: string;
  location?: string;
  isGoogleEvent?: boolean;
  googleEventId?: string;
}
