import { create } from 'zustand';
import {
  TacticalTask,
  AscProject,
  ReminderItem,
  HabitItem,
  TacticalNote,
  ExpenseItem,
  DecisionLogItem,
  FollowUpItem,
  FocusSession,
  MemoryItem,
  ChatMessage,
  ActionLogItem,
  AppSettings,
  FlashcardItem,
  ExamPlanItem,
  HardwareReading,
  CalendarEvent,
  DocumentChunk,
  MayaMode,
  LiveSessionState,
} from '../types';
import {
  putToStore,
  deleteFromStore,
  clearStore,
  hydrateAllStores,
  bulkPutToStore,
} from '../db/indexedDb';
import { ASC_PROJECTS } from '../data/ascData';

interface DestructiveConfirmation {
  id: string;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export interface MayaStoreState {
  // Navigation & UI
  currentMode: MayaMode;
  activePanel: string; // 'CONSOLE' | 'TASKS' | 'CALENDAR' | 'HABITS' | 'DOCS' | 'HARDWARE' | 'NOTES' | 'EXPENSES' | 'SETTINGS' | 'SECURITY'
  liveVoiceState: LiveSessionState;
  isProcessing: boolean;
  isOffline: boolean;
  isLocked: boolean;
  systemLogs: string[];
  destructiveConfirmation: DestructiveConfirmation | null;

  // Domain Entities
  tasks: TacticalTask[];
  projects: AscProject[];
  reminders: ReminderItem[];
  habits: HabitItem[];
  notes: TacticalNote[];
  expenses: ExpenseItem[];
  decisions: DecisionLogItem[];
  followups: FollowUpItem[];
  focusSessions: FocusSession[];
  memory: MemoryItem[];
  chatMessages: ChatMessage[];
  actionLogs: ActionLogItem[];
  flashcards: FlashcardItem[];
  examPlans: ExamPlanItem[];
  hardwareReadings: HardwareReading[];
  calendarEvents: CalendarEvent[];
  documentChunks: DocumentChunk[];
  settings: AppSettings;

  // Actions
  initializeStore: () => Promise<void>;
  setCurrentMode: (mode: MayaMode) => void;
  setActivePanel: (panel: string) => void;
  setLiveVoiceState: (state: LiveSessionState) => void;
  setIsProcessing: (val: boolean) => void;
  setIsOffline: (val: boolean) => void;
  setIsLocked: (val: boolean) => void;
  addSystemLog: (msg: string) => void;
  setDestructiveConfirmation: (conf: DestructiveConfirmation | null) => void;

  // Task Actions
  addTask: (task: Omit<TacticalTask, 'id' | 'createdAt'> & { id?: string }) => TacticalTask;
  updateTask: (id: string, updates: Partial<TacticalTask>) => TacticalTask | null;
  toggleTask: (id: string) => void;
  completeTask: (idOrTitle: string) => TacticalTask | null;
  deleteTask: (id: string) => boolean;
  clearAllTasks: (force?: boolean) => void;

  // Reminder Actions
  addReminder: (reminder: Omit<ReminderItem, 'id' | 'createdAt' | 'escalationLevel' | 'acknowledged'> & { id?: string }) => ReminderItem;
  cancelReminder: (id: string) => boolean;
  acknowledgeReminder: (id: string) => void;
  snoozeReminder: (id: string, minutes: number) => void;
  escalateReminder: (id: string, newLevel: 0 | 1 | 2) => void;

  // Habit Actions
  addHabit: (habit: Omit<HabitItem, 'id' | 'currentStreak' | 'bestStreak' | 'history'>) => HabitItem;
  toggleHabitDay: (habitId: string, dateStr?: string) => void;
  deleteHabit: (id: string) => void;

  // Notes Actions
  addNote: (note: Omit<TacticalNote, 'id' | 'timestamp'>) => TacticalNote;
  deleteNote: (id: string) => void;

  // Expenses Actions
  addExpense: (expense: Omit<ExpenseItem, 'id' | 'timestamp'>) => ExpenseItem;
  deleteExpense: (id: string) => void;

  // Decisions Actions
  addDecision: (decision: Omit<DecisionLogItem, 'id' | 'timestamp'>) => DecisionLogItem;

  // Follow-ups Actions
  addFollowUp: (followUp: Omit<FollowUpItem, 'id' | 'createdAt'>) => FollowUpItem;
  completeFollowUp: (id: string) => void;

  // Focus Session
  recordFocusSession: (session: Omit<FocusSession, 'id'>) => FocusSession;

  // Memory
  rememberFact: (key: string, value: string, category?: MemoryItem['category']) => MemoryItem;
  forgetFact: (query: string) => boolean;
  clearAllMemory: (force?: boolean) => void;

  // Flashcards & Exam Plans
  addFlashcard: (card: Omit<FlashcardItem, 'id' | 'reviewsCount' | 'intervalDays' | 'easeFactor' | 'nextReviewDate'>) => FlashcardItem;
  reviewFlashcard: (id: string, rating: 'again' | 'hard' | 'good' | 'easy') => void;
  addExamPlan: (plan: Omit<ExamPlanItem, 'id'>) => ExamPlanItem;

  // Hardware Readings
  addHardwareReading: (reading: Omit<HardwareReading, 'id' | 'timestamp'>) => void;
  clearHardwareLogs: () => void;

  // Calendar
  addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => CalendarEvent;
  deleteCalendarEvent: (id: string) => void;

  // Chat & Undo
  addChatMessage: (msg: ChatMessage) => void;
  clearChatHistory: () => void;
  recordAction: (action: ActionLogItem) => void;
  undoLastAction: () => string | null;

  // Settings
  updateSettings: (updates: Partial<AppSettings>) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  voice: 'Aoede',
  searchGrounding: true,
  saveTranscript: true,
  wakeWordEnabled: false,
  sensitivity: 'normal',
  userName: 'Sirius',
  greetingLanguage: 'Mix',
  speakingRate: 1.0,
  affectionLevel: 2,
  checkInFrequency: 'normal',
  quietHoursEnabled: true,
  quietHoursStart: '23:00',
  quietHoursEnd: '07:00',
  dndEnabled: false,
  waterAndStretch: true,
  eyeRest: true,
  mealTimes: true,
  sleepWindDown: true,
  dailyBrief: true,
  dailyBriefTime: '08:30',
  ollamaModel: 'qwen2.5:7b',
  selectedModelSize: '7b',
  geminiModel: 'gemini-2.5-flash',
  morningRoutineTime: '08:30',
  middayCheckInTime: '13:00',
  eveningReviewTime: '19:30',
  easeOffActive: false,
  remindersPaused: false,
  personaIntensity: 'strict',
  timeZone: 'Asia/Kolkata',
  onboardingCompleted: true,
  backendUrl: typeof window !== 'undefined' ? window.location.origin : '',
  backendToken: 'maya_sec_c08b49e35f8d42398b71d9a04a6012e8',
  pushEnabled: false,
  useServerProxy: true,
  privateNotifications: false,
  hoursOfSilence: 4,
  maxCheckinsPerDay: 3,
  checkinsTone: 'friendly',
  muteCheckinsToday: false,
  voiceLockEnabled: true,
  voiceLockSensitivity: 70,
};

export const useMayaStore = create<MayaStoreState>((set, get) => ({
  currentMode: 'COMMAND',
  activePanel: 'CONSOLE',
  liveVoiceState: 'IDLE',
  isProcessing: false,
  isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  isLocked: false,
  systemLogs: [
    'AXIOM INTELLIGENCE // MAYA KERNEL INITIALIZED.',
    'CENTRAL STATE STORE ACTIVE (INDEXEDDB BACKED).',
    'TIMEZONE SYNCED: ASIA/KOLKATA.',
  ],
  destructiveConfirmation: null,

  tasks: [],
  projects: ASC_PROJECTS,
  reminders: [],
  habits: [],
  notes: [],
  expenses: [],
  decisions: [],
  followups: [],
  focusSessions: [],
  memory: [],
  chatMessages: [],
  actionLogs: [],
  flashcards: [],
  examPlans: [],
  hardwareReadings: [],
  calendarEvents: [],
  documentChunks: [],
  settings: DEFAULT_SETTINGS,

  initializeStore: async () => {
    try {
      const data = await hydrateAllStores();
      set((state) => ({
        tasks: data.tasks.length > 0 ? data.tasks : state.tasks,
        reminders: data.reminders,
        habits: data.habits,
        notes: data.notes,
        memory: data.memory,
        projects: data.projects.length > 0 ? data.projects : ASC_PROJECTS,
        expenses: data.expenses,
        decisions: data.decisions,
        followups: data.followups,
        focusSessions: data.focusSessions,
        chatMessages: data.chatMessages,
        actionLogs: data.actionLogs,
        flashcards: data.flashcards,
        examPlans: data.examPlans,
        hardwareReadings: data.hardwareReadings,
        calendarEvents: data.calendarEvents,
        documentChunks: data.documentChunks,
        settings: data.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : DEFAULT_SETTINGS,
      }));
    } catch (err) {
      console.warn('Store hydration failed, keeping default in-memory state:', err);
    }
  },

  setCurrentMode: (mode) => set({ currentMode: mode }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setLiveVoiceState: (liveVoiceState) => set({ liveVoiceState }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  setIsOffline: (isOffline) => set({ isOffline }),
  setIsLocked: (isLocked) => set({ isLocked }),
  addSystemLog: (msg) => {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false });
    set((state) => ({
      systemLogs: [`[${timestamp}] ${msg}`, ...state.systemLogs.slice(0, 150)],
    }));
  },
  setDestructiveConfirmation: (destructiveConfirmation) => set({ destructiveConfirmation }),

  // Tasks
  addTask: (taskInput) => {
    const id = taskInput.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newTask: TacticalTask = {
      ...taskInput,
      id,
      completed: false,
      createdAt: Date.now(),
      movesCount: 0,
      subtasks: taskInput.subtasks || [],
      status: taskInput.status || 'todo',
    };

    set((state) => {
      const updated = [newTask, ...state.tasks];
      putToStore('tasks', newTask);
      return { tasks: updated };
    });

    get().recordAction({
      id: `act-${Date.now()}`,
      toolName: 'add_task',
      summary: `Created task "${newTask.title}"`,
      timestamp: Date.now(),
      undoAction: {
        type: 'delete_task',
        payload: { id: newTask.id },
      },
    });

    return newTask;
  },

  updateTask: (id, updates) => {
    let result: TacticalTask | null = null;
    set((state) => {
      const updated = state.tasks.map((t) => {
        if (t.id === id) {
          // Procrastination detector: if due date changes
          let movesCount = t.movesCount || 0;
          if (updates.due !== undefined && updates.due !== t.due) {
            movesCount += 1;
          }
          result = { ...t, ...updates, movesCount };
          putToStore('tasks', result);
          return result;
        }
        return t;
      });
      return { tasks: updated };
    });
    return result;
  },

  toggleTask: (id) => {
    set((state) => {
      const updated = state.tasks.map((t) => {
        if (t.id === id) {
          const next = { ...t, completed: !t.completed, status: (!t.completed ? 'done' : 'todo') as any };
          putToStore('tasks', next);
          return next;
        }
        return t;
      });
      return { tasks: updated };
    });
  },

  completeTask: (idOrTitle) => {
    let completedTask: TacticalTask | null = null;
    const lower = idOrTitle.toLowerCase().trim();
    set((state) => {
      const updated = state.tasks.map((t) => {
        if (t.id === idOrTitle || t.title.toLowerCase().includes(lower)) {
          completedTask = { ...t, completed: true, status: 'done' };
          putToStore('tasks', completedTask);
          return completedTask;
        }
        return t;
      });
      return { tasks: updated };
    });

    if (completedTask) {
      get().recordAction({
        id: `act-${Date.now()}`,
        toolName: 'complete_task',
        summary: `Marked completed: "${(completedTask as TacticalTask).title}"`,
        timestamp: Date.now(),
        undoAction: {
          type: 'uncomplete_task',
          payload: { id: (completedTask as TacticalTask).id },
        },
      });
    }

    return completedTask;
  },

  deleteTask: (id) => {
    const existing = get().tasks.find((t) => t.id === id);
    if (!existing) return false;

    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));
    deleteFromStore('tasks', id);

    get().recordAction({
      id: `act-${Date.now()}`,
      toolName: 'delete_task',
      summary: `Deleted task "${existing.title}"`,
      timestamp: Date.now(),
      undoAction: {
        type: 'revert_task',
        payload: existing,
      },
    });

    return true;
  },

  clearAllTasks: (force = false) => {
    if (!force) {
      get().setDestructiveConfirmation({
        id: 'clear-tasks',
        title: 'CONFIRM: PURGE ALL TASKS',
        description: 'Maya requires explicit confirmation before deleting all tasks from your queue.',
        onConfirm: () => {
          set({ tasks: [] });
          clearStore('tasks');
          get().addSystemLog('TACTICAL PURGE: All tasks cleared by Sirius.');
          get().setDestructiveConfirmation(null);
        },
        onCancel: () => get().setDestructiveConfirmation(null),
      });
      return;
    }
    set({ tasks: [] });
    clearStore('tasks');
  },

  // Reminders
  addReminder: (remInput) => {
    const id = remInput.id || `rem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newRem: ReminderItem = {
      ...remInput,
      id,
      escalationLevel: 0,
      acknowledged: false,
      createdAt: Date.now(),
    };

    set((state) => {
      const updated = [newRem, ...state.reminders];
      putToStore('reminders', newRem);
      return { reminders: updated };
    });

    get().recordAction({
      id: `act-${Date.now()}`,
      toolName: 'set_reminder',
      summary: `Set reminder: "${newRem.text}"`,
      timestamp: Date.now(),
      undoAction: {
        type: 'cancel_reminder',
        payload: { id: newRem.id },
      },
    });

    return newRem;
  },

  cancelReminder: (id) => {
    const existing = get().reminders.find((r) => r.id === id);
    if (!existing) return false;

    set((state) => ({
      reminders: state.reminders.filter((r) => r.id !== id),
    }));
    deleteFromStore('reminders', id);
    return true;
  },

  acknowledgeReminder: (id) => {
    set((state) => {
      const updated = state.reminders.map((r) => {
        if (r.id === id) {
          const next = { ...r, acknowledged: true };
          putToStore('reminders', next);
          return next;
        }
        return r;
      });
      return { reminders: updated };
    });
  },

  snoozeReminder: (id, minutes) => {
    const newAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    set((state) => {
      const updated = state.reminders.map((r) => {
        if (r.id === id) {
          const next = { ...r, at: newAt, acknowledged: false, escalationLevel: 0 as any };
          putToStore('reminders', next);
          return next;
        }
        return r;
      });
      return { reminders: updated };
    });
    get().addSystemLog(`REMINDER SNOOZED: Reminder deferred for ${minutes} minutes.`);
  },

  escalateReminder: (id, newLevel) => {
    set((state) => {
      const updated = state.reminders.map((r) => {
        if (r.id === id) {
          const next = { ...r, escalationLevel: newLevel, lastFiredAt: Date.now() };
          putToStore('reminders', next);
          return next;
        }
        return r;
      });
      return { reminders: updated };
    });
  },

  // Habits
  addHabit: (habitInput) => {
    const id = `habit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newHabit: HabitItem = {
      ...habitInput,
      id,
      currentStreak: 0,
      bestStreak: 0,
      history: {},
    };

    set((state) => {
      const updated = [...state.habits, newHabit];
      putToStore('habits', newHabit);
      return { habits: updated };
    });
    return newHabit;
  },

  toggleHabitDay: (habitId, dateStr) => {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    set((state) => {
      const updated = state.habits.map((h) => {
        if (h.id === habitId) {
          const current = !!h.history[targetDate];
          const newHistory = { ...h.history, [targetDate]: !current };
          // Calculate streak
          const newStreak = !current ? h.currentStreak + 1 : Math.max(0, h.currentStreak - 1);
          const best = Math.max(h.bestStreak, newStreak);
          const next = {
            ...h,
            history: newHistory,
            currentStreak: newStreak,
            bestStreak: best,
            lastCompletedDate: !current ? targetDate : h.lastCompletedDate,
          };
          putToStore('habits', next);
          return next;
        }
        return h;
      });
      return { habits: updated };
    });
  },

  deleteHabit: (id) => {
    set((state) => ({
      habits: state.habits.filter((h) => h.id !== id),
    }));
    deleteFromStore('habits', id);
  },

  // Notes
  addNote: (noteInput) => {
    const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newNote: TacticalNote = {
      ...noteInput,
      id,
      timestamp: Date.now(),
    };

    set((state) => {
      const updated = [newNote, ...state.notes];
      putToStore('notes', newNote);
      return { notes: updated };
    });

    get().recordAction({
      id: `act-${Date.now()}`,
      toolName: 'save_note',
      summary: `Saved note "${newNote.title}"`,
      timestamp: Date.now(),
      undoAction: {
        type: 'delete_note',
        payload: { id: newNote.id },
      },
    });

    return newNote;
  },

  deleteNote: (id) => {
    set((state) => ({
      notes: state.notes.filter((n) => n.id !== id),
    }));
    deleteFromStore('notes', id);
  },

  // Expenses
  addExpense: (expInput) => {
    const id = `exp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newExp: ExpenseItem = {
      ...expInput,
      id,
      timestamp: Date.now(),
    };

    set((state) => {
      const updated = [newExp, ...state.expenses];
      putToStore('expenses', newExp);
      return { expenses: updated };
    });

    get().recordAction({
      id: `act-${Date.now()}`,
      toolName: 'add_expense',
      summary: `Logged expense: ₹${newExp.amount} for "${newExp.title}"`,
      timestamp: Date.now(),
      undoAction: {
        type: 'delete_expense',
        payload: { id: newExp.id },
      },
    });

    return newExp;
  },

  deleteExpense: (id) => {
    set((state) => ({
      expenses: state.expenses.filter((e) => e.id !== id),
    }));
    deleteFromStore('expenses', id);
  },

  // Decisions
  addDecision: (decInput) => {
    const id = `dec-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newDec: DecisionLogItem = {
      ...decInput,
      id,
      timestamp: Date.now(),
    };

    set((state) => {
      const updated = [newDec, ...state.decisions];
      putToStore('decisions', newDec);
      return { decisions: updated };
    });
    return newDec;
  },

  // Follow-ups
  addFollowUp: (fuInput) => {
    const id = `fu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newFu: FollowUpItem = {
      ...fuInput,
      id,
      completed: false,
      createdAt: Date.now(),
    };

    set((state) => {
      const updated = [newFu, ...state.followups];
      putToStore('followups', newFu);
      return { followups: updated };
    });
    return newFu;
  },

  completeFollowUp: (id) => {
    set((state) => {
      const updated = state.followups.map((f) => {
        if (f.id === id) {
          const next = { ...f, completed: true };
          putToStore('followups', next);
          return next;
        }
        return f;
      });
      return { followups: updated };
    });
  },

  // Focus Sessions
  recordFocusSession: (sessionInput) => {
    const id = `foc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newSession: FocusSession = {
      ...sessionInput,
      id,
    };

    set((state) => {
      const updated = [newSession, ...state.focusSessions];
      putToStore('focus_sessions', newSession);
      return { focusSessions: updated };
    });
    return newSession;
  },

  // Memory
  rememberFact: (key, value, category = 'personal') => {
    const id = `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newMem: MemoryItem = {
      id,
      key,
      value,
      category,
      savedAt: new Date().toISOString(),
    };

    set((state) => {
      const updated = [newMem, ...state.memory];
      putToStore('memory', newMem);
      return { memory: updated };
    });

    get().recordAction({
      id: `act-${Date.now()}`,
      toolName: 'remember',
      summary: `Stored memory: "${key}"`,
      timestamp: Date.now(),
      undoAction: {
        type: 'forget_memory',
        payload: { key },
      },
    });

    return newMem;
  },

  forgetFact: (query) => {
    const lower = query.toLowerCase();
    const existing = get().memory.find(
      (m) => m.key.toLowerCase().includes(lower) || m.value.toLowerCase().includes(lower)
    );
    if (!existing) return false;

    set((state) => ({
      memory: state.memory.filter((m) => m.id !== existing.id),
    }));
    deleteFromStore('memory', existing.id);
    return true;
  },

  clearAllMemory: (force = false) => {
    if (!force) {
      get().setDestructiveConfirmation({
        id: 'clear-memory',
        title: 'CONFIRM: PURGE SYSTEM MEMORY',
        description: 'Maya will forget all saved personal preferences and directives. Confirm this directive?',
        onConfirm: () => {
          set({ memory: [] });
          clearStore('memory');
          get().addSystemLog('SECURITY PURGE: Memory completely cleared.');
          get().setDestructiveConfirmation(null);
        },
        onCancel: () => get().setDestructiveConfirmation(null),
      });
      return;
    }
    set({ memory: [] });
    clearStore('memory');
  },

  // Flashcards & Exam Plans
  addFlashcard: (cardInput) => {
    const id = `fc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newCard: FlashcardItem = {
      ...cardInput,
      id,
      reviewsCount: 0,
      intervalDays: 1,
      easeFactor: 2.5,
      nextReviewDate: new Date().toISOString().split('T')[0],
    };

    set((state) => {
      const updated = [...state.flashcards, newCard];
      putToStore('flashcards', newCard);
      return { flashcards: updated };
    });
    return newCard;
  },

  reviewFlashcard: (id, rating) => {
    set((state) => {
      const updated = state.flashcards.map((fc) => {
        if (fc.id === id) {
          let interval = fc.intervalDays;
          let ease = fc.easeFactor;

          if (rating === 'again') {
            interval = 1;
            ease = Math.max(1.3, ease - 0.2);
          } else if (rating === 'hard') {
            interval = Math.max(1, Math.round(interval * 1.2));
            ease = Math.max(1.3, ease - 0.15);
          } else if (rating === 'good') {
            interval = Math.round(interval * ease);
          } else if (rating === 'easy') {
            interval = Math.round(interval * ease * 1.3);
            ease += 0.15;
          }

          const nextDate = new Date();
          nextDate.setDate(nextDate.getDate() + interval);

          const next = {
            ...fc,
            intervalDays: interval,
            easeFactor: ease,
            reviewsCount: fc.reviewsCount + 1,
            nextReviewDate: nextDate.toISOString().split('T')[0],
          };
          putToStore('flashcards', next);
          return next;
        }
        return fc;
      });
      return { flashcards: updated };
    });
  },

  addExamPlan: (planInput) => {
    const id = `exam-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newPlan: ExamPlanItem = {
      ...planInput,
      id,
    };

    set((state) => {
      const updated = [...state.examPlans, newPlan];
      putToStore('exam_plans', newPlan);
      return { examPlans: updated };
    });
    return newPlan;
  },

  // Hardware Readings
  addHardwareReading: (readingInput) => {
    const id = `hw-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newReading: HardwareReading = {
      ...readingInput,
      id,
      timestamp: Date.now(),
    };

    set((state) => {
      const updated = [newReading, ...state.hardwareReadings.slice(0, 499)];
      putToStore('hardware_readings', newReading);
      return { hardwareReadings: updated };
    });
  },

  clearHardwareLogs: () => {
    set({ hardwareReadings: [] });
    clearStore('hardware_readings');
  },

  // Calendar Events
  addCalendarEvent: (eventInput) => {
    const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newEvt: CalendarEvent = {
      ...eventInput,
      id,
    };

    set((state) => {
      const updated = [newEvt, ...state.calendarEvents];
      putToStore('calendar_events', newEvt);
      return { calendarEvents: updated };
    });

    get().recordAction({
      id: `act-${Date.now()}`,
      toolName: 'create_calendar_event',
      summary: `Scheduled event: "${newEvt.summary}"`,
      timestamp: Date.now(),
      undoAction: {
        type: 'delete_event',
        payload: { id: newEvt.id },
      },
    });

    return newEvt;
  },

  deleteCalendarEvent: (id) => {
    set((state) => ({
      calendarEvents: state.calendarEvents.filter((e) => e.id !== id),
    }));
    deleteFromStore('calendar_events', id);
  },

  // Chat & Undo
  addChatMessage: (msg) => {
    set((state) => {
      const updated = [...state.chatMessages, msg];
      putToStore('chat_messages', msg as any);
      return { chatMessages: updated };
    });
  },

  clearChatHistory: () => {
    set({ chatMessages: [] });
    clearStore('chat_messages');
  },

  recordAction: (action) => {
    set((state) => {
      const updated = [action, ...state.actionLogs.slice(0, 9)]; // Keep last 10 actions
      putToStore('action_logs', action);
      return { actionLogs: updated };
    });
  },

  undoLastAction: () => {
    const actions = get().actionLogs;
    if (actions.length === 0) return null;

    const [lastAction, ...remaining] = actions;
    if (!lastAction.undoAction) return null;

    const { type, payload } = lastAction.undoAction;

    if (type === 'delete_task') {
      get().deleteTask(payload.id);
    } else if (type === 'uncomplete_task') {
      get().updateTask(payload.id, { completed: false, status: 'todo' });
    } else if (type === 'revert_task') {
      get().addTask(payload);
    } else if (type === 'cancel_reminder') {
      get().cancelReminder(payload.id);
    } else if (type === 'forget_memory') {
      get().forgetFact(payload.key);
    } else if (type === 'delete_note') {
      get().deleteNote(payload.id);
    } else if (type === 'delete_expense') {
      get().deleteExpense(payload.id);
    } else if (type === 'delete_event') {
      get().deleteCalendarEvent(payload.id);
    }

    set({ actionLogs: remaining });
    deleteFromStore('action_logs', lastAction.id);
    const msg = `UNDO EXECUTED: Reverted action "${lastAction.summary}".`;
    get().addSystemLog(msg);
    return msg;
  },

  // Settings
  updateSettings: (updates) => {
    set((state) => {
      const nextSettings = { ...state.settings, ...updates };
      putToStore('settings', { id: 'app_settings', ...nextSettings } as any);
      try {
        localStorage.setItem('maya_settings', JSON.stringify(nextSettings));
      } catch (e) {}
      return { settings: nextSettings };
    });
  },
}));
