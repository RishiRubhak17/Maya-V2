import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BootSequence } from './boot/BootSequence';
import { SystemPanel } from './panels/SystemPanel';
import { ConsolePanel, ConsoleTab } from './panels/ConsolePanel';
import { NetworkPanel } from './panels/NetworkPanel';
import { ModulesPanel } from './panels/ModulesPanel';
import { KeyboardPanel } from './panels/KeyboardPanel';
import { HolographicCore } from './visuals/HolographicCore';
import { THEME_SKINS } from './theme/skins';
import { ApprovalDialog } from './tools/ApprovalDialog';
import { SettingsModal } from './components/SettingsModal';
import { ModesModal } from './components/ModesModal';
import { AboutModal } from './components/AboutModal';
import { RelationshipMemoryModal } from './components/RelationshipMemoryModal';
import { VoiceEnrollmentModal } from './components/VoiceEnrollmentModal';
import { VoiceprintEngine } from './voice/voiceprintEngine';
import { VerificationResult } from './voice/types';
import { WebSpeechWakeEngine } from './wake/WebSpeechWakeEngine';
import { WakeEngineState } from './wake/types';
import { LiveSessionManager, LiveVoiceState } from './live/liveSessionManager';
import { emotionStore } from './emotion/emotionStore';
import { MayaEmotion, EmotionHistoryEntry } from './emotion/types';
import { toolBridge } from './tools/toolBridge';
import { ToolRiskTier } from './tools/toolDefinitions';
import { ProactiveManager } from './proactive/proactiveManager';
import { relationshipMemoryStore } from './proactive/relationshipMemoryStore';
import {
  ChatMessage,
  MayaMode,
  AppSettings,
  TacticalTask,
  TacticalNote,
} from './types';
import {
  Mic,
  ShieldAlert,
  ShieldCheck,
  Radio,
  Terminal,
  Settings,
  LayoutGrid,
  Disc,
  Calendar,
  HardDrive,
  Cloud,
  Bell,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { initAuth, googleSignIn, hasWorkspaceAccessToken } from './auth/googleAuth';
import { User } from 'firebase/auth';
import { useMayaStore } from './store/useMayaStore';
import { ServerSyncService, SyncState } from './services/serverSyncService';
import { PushNotificationService } from './services/pushNotificationService';
import { voiceSynthesisService } from './services/voiceSynthesisService';
import { safeFetchJson } from './utils/safeFetch';
import { getFallbackResponse } from './shared/mayaCore';

export default function App() {
  const [hasBooted, setHasBooted] = useState<boolean>(() => {
    return sessionStorage.getItem('maya_booted') === 'true';
  });

  const [currentMode, setCurrentMode] = useState<MayaMode>('COMMAND');
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>('MAIN');
  const [inputLineValue, setInputLineValue] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [hasWorkspaceToken, setHasWorkspaceToken] = useState<boolean>(() => hasWorkspaceAccessToken());
  const [isSigningInGoogle, setIsSigningInGoogle] = useState<boolean>(false);
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [inAppToast, setInAppToast] = useState<{ title: string; body: string } | null>(null);

  // Holographic Core Theme & Desktop Detached state
  const [activeSkinId, setActiveSkinId] = useState<'ash' | 'stark'>(() => {
    try {
      const stored = localStorage.getItem('maya_skin_id');
      if (stored === 'ash' || stored === 'stark') return stored;
    } catch (e) {
      // ignore
    }
    return 'ash';
  });
  const [isCoreDetached, setIsCoreDetached] = useState<boolean>(() => {
    try {
      return localStorage.getItem('maya_core_detached') === 'true';
    } catch (e) {
      return false;
    }
  });

  // Emotion state
  const [emotion, setEmotion] = useState<MayaEmotion>('calm');
  const [intensity, setIntensity] = useState<number>(60);
  const [emotionHistory, setEmotionHistory] = useState<EmotionHistoryEntry[]>([]);

  // Wake state
  const [wakeState, setWakeState] = useState<WakeEngineState>('BOOT');
  const [heardText, setHeardText] = useState<string>('');
  const [isArmed, setIsArmed] = useState<boolean>(false);

  // Live session state
  const [liveVoiceState, setLiveVoiceState] = useState<LiveVoiceState>('IDLE');
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [audioInRate, setAudioInRate] = useState<number>(5);
  const [audioOutRate, setAudioOutRate] = useState<number>(2);
  const [apiMessageRate, setApiMessageRate] = useState<number>(1);

  // System logs
  const [systemLogs, setSystemLogs] = useState<string[]>([
    'AXIOM CORE v1.0 ONLINE // SECURE BOOT VERIFIED',
    'HOST: SIRIUS // AXIOM SECURE CRAFTS (ASC)',
    'SYNAPSE BUS READY. AWAITING EXECUTIVE DISPATCH.',
  ]);

  // Kill switch & Settings
  const [isKillSwitchActive, setIsKillSwitchActive] = useState<boolean>(false);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  const [settings, setSettings] = useState<AppSettings>(() => {
    const defaultSettings: AppSettings = {
      voice: 'Aoede',
      searchGrounding: true,
      saveTranscript: true,
      wakeWordEnabled: true,
      sensitivity: 'normal',
      userName: 'Sirius',
      greetingLanguage: 'Mix',
      speakingRate: 1.0,
      affectionLevel: 2,
      checkInFrequency: 'normal',
      inactivityCheckIntervalMinutes: 15,
      quietHoursEnabled: true,
      quietHoursStart: '23:00',
      quietHoursEnd: '07:00',
      dndEnabled: false,
      waterAndStretch: true,
      eyeRest: true,
      mealTimes: true,
      sleepWindDown: true,
      dailyBrief: true,
      dailyBriefTime: '09:00',
      ollamaModel: 'qwen2.5:7b',
      selectedModelSize: '7b',
      geminiModel: 'gemini-2.5-flash',
      personaIntensity: 'strict',
      timeZone: 'Asia/Kolkata',
      morningRoutineTime: '08:00',
      middayCheckInTime: '13:00',
      eveningReviewTime: '19:00',
      easeOffActive: false,
      remindersPaused: false,
    };
    try {
      const stored = localStorage.getItem('maya_settings');
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          ...defaultSettings,
          ...parsed,
          wakeWordEnabled: parsed.wakeWordEnabled !== undefined ? parsed.wakeWordEnabled : true,
          inactivityCheckIntervalMinutes: parsed.inactivityCheckIntervalMinutes || 15,
        };
      }
    } catch (e) {
      // ignore
    }
    return defaultSettings;
  });

  // Helper to generate guaranteed collision-free IDs
  const createId = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Tasks & Notes
  const [tasks, setTasks] = useState<TacticalTask[]>(() => {
    try {
      const stored = localStorage.getItem('maya_tasks');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const seen = new Set<string>();
          return parsed.map((t: any, idx: number) => {
            let id = t.id || createId('task');
            if (seen.has(id)) {
              id = `${id}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
            }
            seen.add(id);
            return { ...t, id };
          });
        }
      }
    } catch (e) {
      // ignore
    }
    return [
      {
        id: 'task-1',
        title: 'Review PONNI MUN 3.0 registration portal staging',
        priority: 'high',
        due: 'Today',
        completed: false,
        createdAt: Date.now() - 3600000,
      },
      {
        id: 'task-2',
        title: 'Verify AttendLink sensor telemetry with Hari Vishnu',
        priority: 'medium',
        due: 'Tomorrow',
        completed: false,
        createdAt: Date.now() - 7200000,
      },
      {
        id: 'task-3',
        title: 'Audit Beginner CTF steganography containers',
        priority: 'high',
        due: 'Friday',
        completed: true,
        createdAt: Date.now() - 86400000,
      },
    ];
  });

  const [notes, setNotes] = useState<TacticalNote[]>(() => {
    try {
      const stored = localStorage.getItem('maya_notes');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const seen = new Set<string>();
          return parsed.map((n: any, idx: number) => {
            let id = n.id || createId('note');
            if (seen.has(id)) {
              id = `${id}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
            }
            seen.add(id);
            return { ...n, id };
          });
        }
      }
    } catch (e) {
      // ignore
    }
    return [
      {
        id: 'note-1',
        title: 'Bishop Heber College CS Prep',
        content: 'Review OS process scheduling algorithms and discrete mathematics notes for upcoming lab evaluation.',
        tag: 'BHC',
        timestamp: Date.now() - 43200000,
      },
      {
        id: 'note-2',
        title: 'ScantriX Architecture Memo',
        content: 'Containerize port scanning probes with minimal footprint. Verify zero unauthorized subnet queries.',
        tag: 'SECURITY',
        timestamp: Date.now() - 172800000,
      },
    ];
  });

  // Conversation turns
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = localStorage.getItem('maya_chat_history');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const seen = new Set<string>();
          return parsed.map((m: any, idx: number) => {
            let id = m.id || createId('msg');
            if (seen.has(id)) {
              id = `${id}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
            }
            seen.add(id);
            return { ...m, id };
          });
        }
      }
    } catch (e) {
      // ignore
    }
    return [
      {
        id: 'm-init',
        sender: 'maya',
        text: 'Good morning, Sirius. Axiom Intelligence is armed and all ASC security telemetry channels are operational. What are our objectives today?',
        timestamp: Date.now(),
        mode: 'COMMAND',
      },
    ];
  });

  // Modals state
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showModesModal, setShowModesModal] = useState<boolean>(false);
  const [showAboutModal, setShowAboutModal] = useState<boolean>(false);
  const [showRelationshipMemoryModal, setShowRelationshipMemoryModal] = useState<boolean>(false);
  const [showVoiceEnrollmentModal, setShowVoiceEnrollmentModal] = useState<boolean>(false);

  // Voice Biometrics State
  const [voiceVerificationScore, setVoiceVerificationScore] = useState<number | null>(null);
  const [isSpeakerVerified, setIsSpeakerVerified] = useState<boolean | null>(null);
  const [unauthorizedAlert, setUnauthorizedAlert] = useState<{ message: string; timestamp: number } | null>(null);

  // Approval modal state
  const [approvalModalState, setApprovalModalState] = useState<{
    isOpen: boolean;
    toolName: string;
    args: any;
    tier: ToolRiskTier;
    reason: string;
    resolve: (approved: boolean) => void;
  }>({
    isOpen: false,
    toolName: '',
    args: null,
    tier: 1,
    reason: '',
    resolve: () => {},
  });

  // Mobile layout tab
  const [mobileActiveView, setMobileActiveView] = useState<'CONSOLE' | 'SYSTEM' | 'NETWORK' | 'MODULES' | 'KEYBOARD'>('CONSOLE');

  // References for engines
  const wakeEngineRef = useRef<WebSpeechWakeEngine | null>(null);
  const liveManagerRef = useRef<LiveSessionManager | null>(null);
  const proactiveManagerRef = useRef<ProactiveManager | null>(null);
  const currentModeRef = useRef(currentMode);
  currentModeRef.current = currentMode;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  // Append system log helper
  const addSystemLog = useCallback((log: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setSystemLogs((prev) => {
      const updated = [...prev, `[${time}] ${log}`];
      return updated.slice(-100);
    });
  }, []);

  // Save to LocalStorage
  useEffect(() => {
    try {
      localStorage.setItem('maya_tasks', JSON.stringify(tasks));
      localStorage.setItem('maya_notes', JSON.stringify(notes));
      localStorage.setItem('maya_settings', JSON.stringify(settings));
      if (settings.saveTranscript) {
        localStorage.setItem('maya_chat_history', JSON.stringify(messages.slice(-50)));
      }
    } catch (e) {
      // ignore
    }
  }, [tasks, notes, settings, messages]);

  // Initialize Firebase Google Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setHasWorkspaceToken(Boolean(token || hasWorkspaceAccessToken()));
      },
      () => {
        setGoogleUser(null);
        setHasWorkspaceToken(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Check URL parameters for prefilled check-in reply or task intent
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const prefill = params.get('prefill');
      if (prefill) {
        setInputLineValue(prefill);
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (e) {}
  }, []);

  // Listen for Service Worker Push Arrival (deduplication while app is open and focused)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'MAYA_PUSH_ARRIVED') {
        const payload = event.data.payload;
        setInAppToast({
          title: payload.title || 'Maya Notification',
          body: payload.body || 'You have an active reminder.',
        });
        addSystemLog(`PUSH ALERT [IN-APP]: ${payload.title} - ${payload.body}`);
        setTimeout(() => setInAppToast(null), 8000);
      } else if (event.data?.type === 'MAYA_PREFILL_PROMPT') {
        if (event.data.prompt) {
          setInputLineValue(event.data.prompt);
        }
      }
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [addSystemLog]);

  // Activity reporting on mount and on window focus
  useEffect(() => {
    const reportActivity = () => {
      ServerSyncService.reportActivity(
        settings.backendUrl || window.location.origin,
        settings.backendToken || 'maya_sec_c08b49e35f8d42398b71d9a04a6012e8'
      );
    };

    reportActivity();
    window.addEventListener('focus', reportActivity);
    const interval = setInterval(reportActivity, 60000);
    return () => {
      window.removeEventListener('focus', reportActivity);
      clearInterval(interval);
    };
  }, [settings.backendUrl, settings.backendToken]);

  // Bidirectional sync with backend
  const syncWithServer = useCallback(async () => {
    if (!navigator.onLine) {
      setSyncState('offline');
      return;
    }
    setSyncState('syncing');
    try {
      const res = await ServerSyncService.sync(
        settings.backendUrl || window.location.origin,
        settings.backendToken || 'maya_sec_c08b49e35f8d42398b71d9a04a6012e8',
        {
          tasks,
          settings,
        }
      );
      if (res.ok) {
        setSyncState('synced');
      } else {
        setSyncState('offline');
      }
    } catch (e) {
      setSyncState('offline');
    }
  }, [tasks, settings]);

  useEffect(() => {
    syncWithServer();
  }, [syncWithServer]);

  const handleGoogleConnect = async (loginHint?: string) => {
    setIsSigningInGoogle(true);
    try {
      const res = await googleSignIn({ loginHint });
      if (res) {
        setGoogleUser(res.user);
        setHasWorkspaceToken(res.hasWorkspaceToken);
        addSystemLog(
          `GOOGLE AUTH: Signed in as ${res.user.email}. Entire Google Workspace (Calendar, Drive, Gmail, Docs, Sheets, Slides, Tasks, Cloud Memory) connected.`
        );
        setConsoleTab('WORKSPACE');
        setMobileActiveView('CONSOLE');
      } else {
        setConsoleTab('WORKSPACE');
        setMobileActiveView('CONSOLE');
      }
    } catch (err: any) {
      if (
        err?.code !== 'auth/popup-closed-by-user' &&
        err?.code !== 'auth/cancelled-popup-request' &&
        !err?.message?.includes('popup-closed-by-user')
      ) {
        console.error('Google sign in error:', err);
        const msg = err?.message || 'Authentication cancelled or failed.';
        addSystemLog(`GOOGLE AUTH NOTICE: ${msg}`);
        setInAppToast({
          title: 'Google Sign-In Notice',
          body: msg,
        });
        setTimeout(() => setInAppToast(null), 9000);
      }
      setConsoleTab('WORKSPACE');
      setMobileActiveView('CONSOLE');
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  // Subscribe to emotion store
  useEffect(() => {
    const unsubscribe = emotionStore.subscribe((state) => {
      setEmotion(state.current);
      setIntensity(state.intensity);
      setEmotionHistory(state.history);
    });
    return unsubscribe;
  }, []);

  // Subscribe to kill switch events
  useEffect(() => {
    const handleKillSwitch = (e: any) => {
      setIsKillSwitchActive(e.detail.active);
      addSystemLog(`TOOL KILL SWITCH EVENT: ${e.detail.active ? 'ENGAGED' : 'DISENGAGED'}`);
    };
    window.addEventListener('maya-killswitch-changed', handleKillSwitch);
    return () => window.removeEventListener('maya-killswitch-changed', handleKillSwitch);
  }, [addSystemLog]);

  // Register Approval Handler in ToolBridge
  useEffect(() => {
    toolBridge.registerApprovalHandler((toolName, args, tier, reason, resolve) => {
      setApprovalModalState({
        isOpen: true,
        toolName,
        args,
        tier,
        reason,
        resolve,
      });
    });
  }, []);

  // Toggle Live Session
  const toggleLiveSession = useCallback(async () => {
    if (liveVoiceState !== 'IDLE') {
      liveManagerRef.current?.disconnect();
      return;
    }

    if (!liveManagerRef.current) return;

    // Mic arbitration: pause wake engine first
    if (wakeEngineRef.current) {
      await wakeEngineRef.current.pauseForLiveSession();
    }

    const relMem = relationshipMemoryStore.getMemory();
    const memoryContext = relMem.approved
      ? `Nicknames: ${relMem.nicknames.join(', ')}. Milestones: ${relMem.milestones.map((m) => m.title).join('; ')}. Inside jokes: ${relMem.insideJokes.join('; ')}`
      : '';

    const ok = await liveManagerRef.current.connect({
      mode: currentMode,
      voice: settings.voice,
      userName: settings.userName,
      affectionLevel: settings.affectionLevel,
      memoryContext,
    });

    if (ok) {
      addSystemLog('LIVE SESSION: Connected. Sirius is on live microphone.');
    }
  }, [liveVoiceState, currentMode, settings.voice, settings.userName, settings.affectionLevel, addSystemLog]);

  // Spacebar Push-To-Talk Toggle Fallback
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If user is focused on an input or textarea, don't hijack spacebar
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        toggleLiveSession();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleLiveSession]);

  // Send message via terminal input
  const handleSendMessage = useCallback(
    async (text: string, useSearch: boolean = false) => {
      const userText = text.trim();
      if (!userText || isProcessing) return;

      proactiveManagerRef.current?.recordUserActivity();
      ServerSyncService.reportActivity(
        settings.backendUrl || window.location.origin,
        settings.backendToken || 'maya_sec_c08b49e35f8d42398b71d9a04a6012e8'
      );

      const userMsg: ChatMessage = {
        id: createId('msg-user'),
        sender: 'sirius',
        text: userText,
        timestamp: Date.now(),
        mode: currentMode,
      };

      setMessages((prev) => [...prev, userMsg]);

      // Human Empathy Interceptor: detect distress, irritation, or exclamation ("oh my god", "damn it", "ugh", etc.)
      const frustrationRegex = /\b(oh my god|omg|what the hell|damn it|dammit|so frustrated|i hate this|ugh+|i can'?t do this|are you kidding me|this is driving me crazy|i'?m so tired|why is this happening|for god'?s sake|i feel like crying|i'?m so stressed|god dammit)\b/i;
      if (frustrationRegex.test(userText)) {
        emotionStore.setEmotion('caring', 90, addSystemLog);
        addSystemLog('EMPATHY TRIGGER: Detected Sirius in distress/frustration. Maya offering genuine care.');
        proactiveManagerRef.current?.handleCommand(userText);
        return;
      }

      // Check proactive voice/text commands ("not now", "stop check-ins", "check-ins back on", "leave me alone")
      if (proactiveManagerRef.current?.handleCommand(userText)) {
        const ackMsg: ChatMessage = {
          id: createId('msg-ack'),
          sender: 'maya',
          text: 'Understood, Sirius. Adjusted check-in parameters immediately.',
          timestamp: Date.now(),
          mode: currentMode,
        };
        setMessages((prev) => [...prev, ackMsg]);
        addSystemLog('PROACTIVE DIRECTIVE: Sirius adjusted check-in schedule.');
        return;
      }

      setIsProcessing(true);
      setApiMessageRate((prev) => Math.min(100, prev + 25));
      addSystemLog(`USER INPUT: "${userText}" dispatched to Maya.`);

      try {
        const relMem = relationshipMemoryStore.getMemory();
        const relationshipContext = relMem.approved
          ? `Nicknames: ${relMem.nicknames.join(', ')}. Milestones: ${relMem.milestones.map((m) => m.title).join('; ')}. Inside jokes: ${relMem.insideJokes.join('; ')}`
          : '';

        const fetchRes = await safeFetchJson('/api/maya/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userText,
            mode: currentMode,
            history: messages.slice(-6),
            userName: settings.userName,
            useSearch: useSearch || settings.searchGrounding,
            affectionLevel: settings.affectionLevel,
            relationshipContext,
          }),
        });

        const data =
          fetchRes.ok && fetchRes.data
            ? fetchRes.data
            : {
                reply: getFallbackResponse(userText, currentMode, settings.userName),
                sources: [],
                functionCalls: [],
                detectedEmotion: null,
              };

        // Handle detected emotion
        if (data.detectedEmotion) {
          emotionStore.setEmotion(
            data.detectedEmotion.emotion,
            data.detectedEmotion.intensity,
            addSystemLog
          );
        }

        // Handle tool calls returned
        const toolSummaries: string[] = [];
        if (Array.isArray(data.functionCalls) && data.functionCalls.length > 0) {
          for (const fc of data.functionCalls) {
            const res = await toolBridge.executeTool(fc.name, fc.args || {}, {
              onLog: addSystemLog,
              onModeChange: (m) => setCurrentMode(m),
              onAddTask: (t) =>
                setTasks((prev) => [
                  ...prev,
                  {
                    id: createId('task'),
                    title: t.title,
                    priority: t.priority || 'medium',
                    due: t.due || 'Today',
                    completed: false,
                    createdAt: Date.now(),
                  },
                ]),
              onCompleteTask: (idOrTitle) => {
                const lower = idOrTitle.toLowerCase();
                setTasks((prev) =>
                  prev.map((t) =>
                    t.id === idOrTitle || t.title.toLowerCase().includes(lower)
                      ? { ...t, completed: true }
                      : t
                  )
                );
              },
              onSaveNote: (n) =>
                setNotes((prev) => [
                  ...prev,
                  {
                    id: createId('note'),
                    title: n.title,
                    content: n.content,
                    tag: n.tag || 'SECURITY',
                    timestamp: Date.now(),
                  },
                ]),
              onListTasks: () => tasks,
              onListReminders: () => useMayaStore.getState().reminders,
              onListMemory: () => notes,
            });

            if (res.toolName === 'list_calendar_events') {
              if (res.ok && res.result) {
                const events = res.result.events || [];
                if (events.length === 0) {
                  toolSummaries.push('📅 **Google Calendar**: No upcoming events found on your primary calendar.');
                } else {
                  const list = events.slice(0, 5).map((e: any) => {
                    const dateStr = e.start ? new Date(e.start).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Scheduled';
                    return `• **${e.summary || '(Untitled Event)'}** — ${dateStr}${e.location && e.location !== 'N/A' ? ` (${e.location})` : ''}`;
                  }).join('\n');
                  toolSummaries.push(`📅 **Google Calendar (${events.length} upcoming events)**:\n${list}`);
                }
              } else if (res.error === 'GOOGLE_CALENDAR_NOT_CONNECTED') {
                toolSummaries.push('⚠️ **Google Workspace Not Connected**: Click "SIGN IN WITH GOOGLE" (or "RECONNECT WORKSPACE") in the top bar or WORKSPACE tab to authorize access.');
              } else {
                toolSummaries.push(`⚠️ **Calendar Error**: ${res.message || res.error}`);
              }
            } else if (res.toolName === 'create_calendar_event') {
              if (res.ok && res.result) {
                const dateStr = res.result.start ? new Date(res.result.start).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';
                toolSummaries.push(`✅ **Scheduled on Google Calendar**: "${res.result.summary}" for ${dateStr}.`);
              } else if (res.error === 'GOOGLE_CALENDAR_NOT_CONNECTED') {
                toolSummaries.push('⚠️ **Google Workspace Not Connected**: Click "SIGN IN WITH GOOGLE" (or "RECONNECT WORKSPACE") in the top bar or WORKSPACE tab to schedule events.');
              } else {
                toolSummaries.push(`⚠️ **Scheduling Error**: ${res.message || res.error}`);
              }
            } else if (res.toolName === 'delete_calendar_event') {
              if (res.ok) {
                toolSummaries.push('🗑️ **Calendar Event Removed**: The event was deleted from your Google Calendar.');
              } else {
                toolSummaries.push(`⚠️ **Calendar Delete Error**: ${res.message || res.error}`);
              }
            } else if (res.toolName === 'add_task') {
              toolSummaries.push(`📋 **Task Added**: "${res.result.title}" added to your priority queue (${res.result.priority}, due ${res.result.due}).`);
            } else if (res.toolName === 'complete_task') {
              toolSummaries.push(`✅ **Task Completed**: "${res.result.target}" marked finished in your ASC task queue.`);
            } else if (res.toolName === 'save_note') {
              toolSummaries.push(`📝 **Note Saved**: "${res.result.title}" stored under [${res.result.tag}] memory.`);
            } else if (res.toolName === 'set_timer') {
              toolSummaries.push(`⏱️ **Timer Set**: ${res.result.minutes} minute(s) for "${res.result.label}". Alert scheduled for ${res.result.firesAt}.`);
            } else if (res.toolName === 'get_time') {
              toolSummaries.push(`🕒 **System Time**: ${res.result.localString} (${res.result.timeZone}).`);
            } else if (res.toolName === 'open_app') {
              toolSummaries.push(`🚀 **Application Launched**: Opened ${res.result.app}.`);
            } else if (res.toolName === 'open_website') {
              toolSummaries.push(`🌐 **Opened Webpage**: ${res.result.url}.`);
            } else if (res.toolName === 'system_info') {
              toolSummaries.push(`💻 **Host Telemetry**: ${res.result.platform} | Cores: ${res.result.cpuCores} | Memory: ${res.result.deviceMemory} | Screen: ${res.result.screen}.`);
            } else if (res.toolName === 'list_drive_files') {
              if (res.ok && res.result) {
                const files = res.result.files || [];
                if (files.length === 0) {
                  toolSummaries.push('📁 **Google Drive**: No files found.');
                } else {
                  const list = files.slice(0, 5).map((f: any) => `• **${f.name}** (${f.mimeType?.split('.').pop() || 'file'})`).join('\n');
                  toolSummaries.push(`📁 **Google Drive (${files.length} files)**:\n${list}`);
                }
              } else {
                toolSummaries.push(`⚠️ **Drive**: ${res.message || res.error}`);
              }
            } else if (res.toolName === 'read_sheet') {
              if (res.ok && res.result) {
                const rows = (res.result.values || []).slice(0, 5).map((r: any[]) => `| ${r.join(' | ')} |`).join('\n');
                toolSummaries.push(`📊 **Google Sheets (${res.result.rowsCount} rows)**:\n${rows || 'Empty sheet range.'}`);
              } else {
                toolSummaries.push(`⚠️ **Sheets**: ${res.message || res.error}`);
              }
            } else if (res.toolName === 'append_sheet') {
              toolSummaries.push(res.ok ? `📊 **Google Sheets**: Row appended to ${res.result.updatedRange || 'sheet'}.` : `⚠️ **Sheets**: ${res.message || res.error}`);
            } else if (res.toolName === 'list_emails') {
              if (res.ok && res.result) {
                const emails = res.result.messages || [];
                if (emails.length === 0) {
                  toolSummaries.push('✉️ **Gmail**: No unread emails in inbox.');
                } else {
                  const list = emails.map((m: any) => `• **${m.subject}** from *${m.from}*\n  > ${m.snippet?.slice(0, 90)}...`).join('\n');
                  toolSummaries.push(`✉️ **Gmail Inbox (${emails.length} emails)**:\n${list}`);
                }
              } else {
                toolSummaries.push(`⚠️ **Gmail**: ${res.message || res.error}`);
              }
            } else if (res.toolName === 'send_email') {
              toolSummaries.push(res.ok ? `✉️ **Gmail Dispatched**: Email successfully sent to ${res.result.to}.` : `⚠️ **Gmail**: ${res.message || res.error}`);
            } else if (res.toolName === 'create_doc') {
              toolSummaries.push(res.ok ? `📄 **Google Docs Created**: [${res.result.title}](${res.result.link})` : `⚠️ **Docs**: ${res.message || res.error}`);
            } else if (res.toolName === 'read_doc') {
              toolSummaries.push(res.ok ? `📄 **Google Doc [${res.result.title}]**:\n${res.result.bodyPreview || 'No text content.'}` : `⚠️ **Docs**: ${res.message || res.error}`);
            } else if (res.toolName === 'list_google_tasks') {
              if (res.ok && res.result) {
                const tasks = res.result.tasks || [];
                const list = tasks.map((t: any) => `• [${t.status === 'completed' ? 'x' : ' '}] ${t.title}${t.due ? ` (Due: ${new Date(t.due).toLocaleDateString()})` : ''}`).join('\n');
                toolSummaries.push(`📋 **Google Tasks (${tasks.length} tasks)**:\n${list || 'No tasks found.'}`);
              } else {
                toolSummaries.push(`⚠️ **Tasks**: ${res.message || res.error}`);
              }
            } else if (res.toolName === 'create_google_task') {
              toolSummaries.push(res.ok ? `📋 **Google Task Added**: "${res.result.task?.title || 'Task'}" synced to your Google account.` : `⚠️ **Tasks**: ${res.message || res.error}`);
            } else if (res.toolName === 'complete_google_task') {
              toolSummaries.push(res.ok ? `✅ **Google Task Finished**: Task marked complete in Google Tasks.` : `⚠️ **Tasks**: ${res.message || res.error}`);
            } else if (res.toolName === 'list_chat_spaces') {
              if (res.ok && res.result) {
                const spaces = (res.result.spaces || []).map((s: any) => `• ${s.displayName} (${s.name})`).join('\n');
                toolSummaries.push(`💬 **Google Chat Spaces**:\n${spaces || 'No active spaces.'}`);
              } else {
                toolSummaries.push(`⚠️ **Chat**: ${res.message || res.error}`);
              }
            } else if (res.toolName === 'send_chat_message') {
              toolSummaries.push(res.ok ? `💬 **Google Chat**: Message posted to space.` : `⚠️ **Chat**: ${res.message || res.error}`);
            } else if (res.toolName === 'create_meet_space') {
              toolSummaries.push(res.ok ? `🎥 **Google Meet Created**: [Join Meeting](${res.result.meetUri})\nLink: \`${res.result.meetUri}\`` : `⚠️ **Meet**: ${res.message || res.error}`);
            } else if (res.toolName === 'save_cloud_memory') {
              toolSummaries.push(res.ok ? `☁️ **Cloud Memory**: Saved "${res.result.key}" to Maya Firestore cloud storage.` : `⚠️ **Cloud Memory**: ${res.message || res.error}`);
            } else if (res.toolName === 'list_cloud_memory') {
              if (res.ok && res.result) {
                const mems = (res.result.memories || []).map((m: any) => `• **${m.key}** [${m.category}]: ${m.value}`).join('\n');
                toolSummaries.push(`☁️ **Maya Cloud Memory (${res.result.count} items)**:\n${mems || 'Cloud memory is empty.'}`);
              } else {
                toolSummaries.push(`⚠️ **Cloud Memory**: ${res.message || res.error}`);
              }
            } else if (res.toolName === 'create_presentation') {
              toolSummaries.push(res.ok ? `🖼️ **Google Slides Created**: [Open Presentation](${res.result.webViewLink})` : `⚠️ **Slides**: ${res.message || res.error}`);
            } else if (res.toolName === 'get_presentation') {
              toolSummaries.push(res.ok ? `🖼️ **Google Slides**: "${res.result.title}" contains ${res.result.slideCount} slides.` : `⚠️ **Slides**: ${res.message || res.error}`);
            } else if (res.toolName === 'create_spreadsheet') {
              toolSummaries.push(res.ok ? `📊 **Google Sheets Created**: [Open Sheet](${res.result.webViewLink})` : `⚠️ **Sheets**: ${res.message || res.error}`);
            } else if (res.toolName === 'get_form_responses') {
              toolSummaries.push(res.ok ? `📋 **Google Forms**: Form ${res.result.formId} has received ${res.result.responsesCount} responses.` : `⚠️ **Forms**: ${res.message || res.error}`);
            } else if (res.toolName === 'create_keep_note') {
              toolSummaries.push(res.ok ? `💡 **Google Keep Note Saved**: "${res.result.title}" organized into workspace ideas & notes.` : `⚠️ **Keep**: ${res.message || res.error}`);
            } else if (res.toolName === 'get_dashboard_overview') {
              toolSummaries.push(`🎛️ **Dashboard Telemetry**: ${res.result?.summary}`);
            }
          }
        }

        let replyText = data.reply || 'Acknowledged, Sirius.';
        if (toolSummaries.length > 0) {
          if (!data.reply || data.reply.trim().startsWith('Executing command:')) {
            replyText = toolSummaries.join('\n\n');
          } else {
            replyText = `${data.reply}\n\n${toolSummaries.join('\n\n')}`;
          }
        }

        const mayaMsg: ChatMessage = {
          id: createId('msg-maya'),
          sender: 'maya',
          text: replyText,
          timestamp: Date.now(),
          mode: currentMode,
          sources: data.sources || [],
        };

        setMessages((prev) => [...prev, mayaMsg]);
        addSystemLog(`MAYA RESPONSE: [${currentMode}] response delivered.`);

        // Vocal TTS feedback when not muted / in quiet hours (emotion-modulated prosody & pitch)
        if (!settingsRef.current.dndEnabled && liveVoiceState === 'IDLE') {
          void voiceSynthesisService.speak({
            text: replyText,
            voice: settingsRef.current.voice,
            mode: currentMode,
            speakingRate: settingsRef.current.speakingRate,
            maxLength: 220,
          });
        }
      } catch (err: any) {
        addSystemLog(`COMM ERROR: ${err?.message || err}`);
        const errorMsg: ChatMessage = {
          id: createId('msg-err'),
          sender: 'maya',
          text: 'Communication link interrupted, Sirius. System operational in local buffer mode.',
          timestamp: Date.now(),
          mode: currentMode,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, currentMode, messages, settings.userName, settings.searchGrounding, addSystemLog]
  );

  // Initialize LiveSessionManager
  useEffect(() => {
    const manager = new LiveSessionManager({
      onStateChange: (st) => {
        setLiveVoiceState(st);
        if (st === 'IDLE') {
          setIsSpeakerVerified(null);
          setVoiceVerificationScore(null);
        }
      },
      onVoiceVerified: (result: VerificationResult) => {
        setIsSpeakerVerified(true);
        setVoiceVerificationScore(result.confidence);
      },
      onVoiceRejected: (result: VerificationResult) => {
        setIsSpeakerVerified(false);
        setVoiceVerificationScore(result.confidence);
        setUnauthorizedAlert({
          message: `UNAUTHORIZED SPEAKER REFUSED (${result.confidence}% match). Verbal refusal issued: "Voice unverified, Sirius only."`,
          timestamp: Date.now(),
        });
        addSystemLog(`SECURITY ALERT: Unauthorized voice (${result.confidence}% match) rejected. Frame dropped.`);
        setTimeout(() => setUnauthorizedAlert(null), 5000);
      },
      onTranscript: (sender, text, isFinal) => {
        if (!text.trim()) return;
        if (sender === 'sirius') {
          proactiveManagerRef.current?.recordUserActivity();
          proactiveManagerRef.current?.handleCommand(text);
        }
        if (isFinal) {
          setMessages((prev) => [
            ...prev,
            {
              id: createId(`msg-${sender}`),
              sender,
              text,
              timestamp: Date.now(),
              mode: currentModeRef.current,
            },
          ]);
        }
      },
      onLog: addSystemLog,
      onAudioLevel: (lvl) => {
        setAudioLevel(lvl);
        setAudioInRate(Math.min(100, Math.round(lvl * 120)));
      },
      onSessionEnded: async () => {
        addSystemLog('LIVE SESSION: Disengaged. Resuming Wake Engine.');
        if (wakeEngineRef.current && settingsRef.current.wakeWordEnabled) {
          await wakeEngineRef.current.resumeAfterLiveSession();
        }
      },
      onEmotionChange: (em, inten) => emotionStore.setEmotion(em, inten, addSystemLog),
      onModeChange: (m: any) => setCurrentMode(m),
      onAddTask: (t) =>
        setTasks((prev) => [
          ...prev,
          {
            id: createId('task'),
            title: t.title,
            priority: t.priority || 'medium',
            due: t.due || 'Today',
            completed: false,
            createdAt: Date.now(),
          },
        ]),
      onCompleteTask: (idOrTitle: string) => {
        const lower = idOrTitle.toLowerCase();
        setTasks((prev) =>
          prev.map((t) =>
            t.id === idOrTitle || t.title.toLowerCase().includes(lower)
              ? { ...t, completed: true }
              : t
          )
        );
      },
      onSaveNote: (n) =>
        setNotes((prev) => [
          ...prev,
          {
            id: createId('note'),
            title: n.title,
            content: n.content,
            tag: n.tag || 'SECURITY',
            timestamp: Date.now(),
          },
        ]),
    });

    manager.setVoiceLockConfig(
      settings.voiceLockEnabled !== false,
      settings.voiceLockSensitivity ?? 70
    );

    liveManagerRef.current = manager;

    return () => {
      manager.disconnect();
    };
  }, [addSystemLog]);

  // Keep live manager mode in sync dynamically without tearing down session
  useEffect(() => {
    liveManagerRef.current?.setMode(currentMode);
  }, [currentMode]);

  // Keep live manager voice lock config in sync dynamically
  useEffect(() => {
    liveManagerRef.current?.setVoiceLockConfig(
      settings.voiceLockEnabled !== false,
      settings.voiceLockSensitivity ?? 70
    );
  }, [settings.voiceLockEnabled, settings.voiceLockSensitivity]);

  // Initialize Wake Engine & Mobile Microphone Access on Boot
  useEffect(() => {
    if (!hasBooted) return;

    // Keep hardware microphone locked and active continuously whenever Maya is opened & initialized
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        .then((_stream) => {
          addSystemLog('HARDWARE MIC: Continuous low-latency audio capture engaged. Zero-buffer listener active.');
          // Stream kept open and warm to eliminate audio device spin-up delay and glitching
        })
        .catch((err) => {
          addSystemLog(`HARDWARE MIC NOTICE: ${err?.message || err}`);
        });
    }

    const wakeEngine = new WebSpeechWakeEngine({
      sensitivity: settings.sensitivity,
      enabled: settings.wakeWordEnabled,
      onWake: async (trailingCommand) => {
        addSystemLog(`VOICE TRIGGER: Command received: "${trailingCommand || 'LIVE VOICE'}"`);
        // Mic arbitration: pause wake engine, open Live session
        if (wakeEngineRef.current) {
          await wakeEngineRef.current.pauseForLiveSession();
        }
        if (liveManagerRef.current) {
          const relMem = relationshipMemoryStore.getMemory();
          const memoryContext = relMem.approved
            ? `Nicknames: ${relMem.nicknames.join(', ')}. Milestones: ${relMem.milestones.map((m) => m.title).join('; ')}. Inside jokes: ${relMem.insideJokes.join('; ')}`
            : '';
          await liveManagerRef.current.connect({
            mode: currentMode,
            voice: settings.voice,
            userName: settings.userName,
            initialCommand: trailingCommand,
            affectionLevel: settings.affectionLevel,
            memoryContext,
          });
        }
      },
      onHeardText: (t) => setHeardText(t),
      onStateChange: (st) => {
        setWakeState(st);
        setIsArmed(st === 'ARMED');
      },
      onLog: addSystemLog,
      onError: (err) => addSystemLog(`WAKE ENGINE ERROR: ${err}`),
    });

    wakeEngineRef.current = wakeEngine;

    wakeEngine.init().then((supported) => {
      if (supported && settings.wakeWordEnabled) {
        wakeEngine.arm();
      }
    });

    return () => {
      wakeEngine.destroy();
    };
  }, [hasBooted, settings.sensitivity, settings.wakeWordEnabled, currentMode, settings.voice, settings.userName, settings.affectionLevel, addSystemLog]);

  // Initialize Proactive Check-Ins & Idle Auto-Wake
  useEffect(() => {
    if (!hasBooted) return;

    const manager = new ProactiveManager(
      {
        enabled: settings.checkInFrequency !== 'off',
        frequency: settings.checkInFrequency,
        affectionLevel: settings.affectionLevel,
        quietHoursEnabled: settings.quietHoursEnabled,
        quietHoursStart: settings.quietHoursStart,
        quietHoursEnd: settings.quietHoursEnd,
        dndEnabled: settings.dndEnabled,
        inactivityIntervalMinutes: settings.inactivityCheckIntervalMinutes || 15,
        idleTimeoutSeconds: (settings.inactivityCheckIntervalMinutes || 15) * 60,
        reminders: {
          tasksAndDeadlines: true,
          waterAndStretch: settings.waterAndStretch,
          eyeRest: settings.eyeRest,
          mealTimes: settings.mealTimes,
          sleepWindDown: settings.sleepWindDown,
          dailyBrief: settings.dailyBrief,
          dailyBriefTime: settings.dailyBriefTime,
          upcomingEventPrep: true,
        },
      },
      {
        onCheckIn: async (reason, line, inactivityMinutes) => {
          const mins = inactivityMinutes || settings.inactivityCheckIntervalMinutes || 15;
          emotionStore.setEmotion(
            mins >= 20 ? 'caring' : 'missing_you',
            75,
            addSystemLog
          );
          addSystemLog(`PROACTIVE ADAPTIVE CHECK-IN [${mins}m inactivity]: ${line}`);

          // Render in chat history
          const checkInMsg: ChatMessage = {
            id: createId('msg-proactive'),
            sender: 'maya',
            text: line,
            timestamp: Date.now(),
            mode: currentModeRef.current,
          };
          setMessages((prev) => [...prev, checkInMsg]);

          // Show in-app toast notification
          setInAppToast({
            title: `Maya // Inactivity Check (${mins}m)`,
            body: line,
          });
          setTimeout(() => setInAppToast(null), 8000);

          // If document is backgrounded or hidden, display native browser notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
            try {
              new Notification(`Maya // Inactivity Check (${mins}m)`, {
                body: line,
                icon: '/favicon.ico',
                tag: `maya-inactivity-${Date.now()}`,
              });
            } catch (e) {
              // ignore
            }
          }

          // Play spoken voice alert if DND is not enabled (emotion-modulated prosody & pitch)
          if (!settingsRef.current.dndEnabled) {
            await voiceSynthesisService.speak({
              text: line,
              voice: settingsRef.current.voice,
              mode: currentModeRef.current,
              speakingRate: settingsRef.current.speakingRate,
            });
          }
        },
        onLog: addSystemLog,
        getOpenTasks: () => tasks.filter((t) => !t.completed).map((t) => ({ title: t.title, priority: t.priority })),
        getCurrentMode: () => currentModeRef.current,
      }
    );

    proactiveManagerRef.current = manager;
    manager.start();

    // Listener for manual test trigger from Settings UI
    const handleTestTrigger = (e: any) => {
      const testMins = e.detail?.minutes || settings.inactivityCheckIntervalMinutes || 15;
      addSystemLog(`MANUAL TEST: Triggering ${testMins}-minute adaptive inactivity check.`);
      manager.triggerAdaptiveCheckIn(testMins);
    };
    window.addEventListener('maya-test-inactivity-checkin', handleTestTrigger);

    return () => {
      window.removeEventListener('maya-test-inactivity-checkin', handleTestTrigger);
      manager.stop();
    };
  }, [
    hasBooted,
    settings.checkInFrequency,
    settings.inactivityCheckIntervalMinutes,
    settings.affectionLevel,
    settings.quietHoursEnabled,
    settings.quietHoursStart,
    settings.quietHoursEnd,
    settings.dndEnabled,
    settings.waterAndStretch,
    settings.eyeRest,
    settings.mealTimes,
    settings.sleepWindDown,
    settings.dailyBrief,
    settings.dailyBriefTime,
    tasks,
    addSystemLog,
  ]);

  // Task handlers
  const handleAddTask = (title: string, priority: 'high' | 'med' | 'low' | 'medium', due: string) => {
    const normalizedPriority: 'high' | 'med' | 'low' = priority === 'medium' ? 'med' : priority;
    const newTask: TacticalTask = {
      id: createId('task'),
      title,
      priority: normalizedPriority,
      due,
      completed: false,
      createdAt: Date.now(),
    };
    setTasks((prev) => [newTask, ...prev]);
    addSystemLog(`TASK ADDED: "${title}" [${priority.toUpperCase()}]`);
  };

  const handleToggleTask = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  // Note handlers
  const handleAddNote = (title: string, content: string, tag: string) => {
    const newNote: TacticalNote = {
      id: createId('note'),
      title,
      content,
      tag,
      timestamp: Date.now(),
    };
    setNotes((prev) => [newNote, ...prev]);
    addSystemLog(`NOTE SAVED: "${title}" [#${tag}]`);
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  // Keyboard handlers
  const handleKeyboardChar = (char: string) => {
    setInputLineValue((prev) => prev + char);
  };
  const handleKeyboardBackspace = () => {
    setInputLineValue((prev) => prev.slice(0, -1));
  };
  const handleKeyboardSpace = () => {
    setInputLineValue((prev) => prev + ' ');
  };
  const handleKeyboardEnter = () => {
    if (inputLineValue.trim()) {
      handleSendMessage(inputLineValue);
      setInputLineValue('');
    }
  };

  if (!hasBooted) {
    return <BootSequence onBootComplete={() => setHasBooted(true)} />;
  }

  return (
    <div
      className={`h-screen w-screen overflow-hidden bg-[#0A0A0A] text-[#EDEDED] flex flex-col select-none hud-vignette hud-grid-bg relative ${
        reduceMotion ? '' : 'ambient-glitch'
      }`}
    >
      {/* Scanline sweep layers */}
      {!reduceMotion && (
        <>
          <div className="hud-scanline" />
          <div className="hud-scanline-sweep" />
        </>
      )}

      {/* TOP HUD BAR - Frosted Glass Panel */}
      <header className="h-11 glass-panel border-b border-white/[0.08] px-3 flex items-center justify-between text-xs font-hud z-30 select-none">
        {/* Left System Title */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] animate-pulse shadow-[0_0_10px_#00E5FF]" />
            <span className="font-bold text-sm tracking-widest text-[#EDEDED]">
              AXIOM INTELLIGENCE
            </span>
          </div>
          <span className="text-[#525252] font-mono">::</span>
          <span className="font-bold text-sm tracking-wider text-[#00E5FF] neon-glow">
            MAYA
          </span>
          <span className="text-[10px] text-[#9E9E9E] font-mono border border-white/[0.08] bg-[#1E1E1E]/60 px-2 py-0.5 hidden sm:inline rounded">
            SIRIUS@ASC
          </span>
        </div>

        {/* Center: Live Wake State & Orb */}
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1E1E1E] border border-white/[0.08] rounded interactive-hover">
            <Radio size={12} className={isArmed ? 'text-[#00E5FF] animate-pulse' : 'text-[#6d6d69]'} />
            <span className="text-[#9E9E9E] font-hud text-[10px]">WAKE:</span>
            <span className="text-[#00E5FF] font-bold">{wakeState}</span>
          </div>

          {heardText && (
            <div className="hidden md:flex items-center gap-1 text-[10px] text-[#9E9E9E] truncate max-w-xs">
              <span>HEARD:</span>
              <span className="text-[#EDEDED] truncate">&quot;{heardText}&quot;</span>
            </div>
          )}

          {/* Mode Pill */}
          <button
            onClick={() => setShowModesModal(true)}
            className="px-2.5 py-1 bg-[#1E1E1E] border border-[#00E5FF]/40 text-[#00E5FF] font-hud text-[11px] font-bold tracking-wider rounded interactive-hover hover:border-[#00E5FF] neon-glow cursor-pointer"
          >
            MODE: {currentMode}
          </button>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 font-mono text-xs">
          {/* Server Sync Indicator */}
          <div
            title={`Backend Status: ${syncState.toUpperCase()}`}
            className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-[#1E1E1E] border border-white/[0.08] text-[10px] rounded"
          >
            <Cloud
              size={11}
              className={
                syncState === 'synced'
                  ? 'text-emerald-400'
                  : syncState === 'syncing'
                  ? 'text-[#00E5FF] animate-spin'
                  : 'text-amber-400'
              }
            />
            <span
              className={
                syncState === 'synced'
                  ? 'text-emerald-400 font-bold'
                  : syncState === 'syncing'
                  ? 'text-[#00E5FF]'
                  : 'text-amber-400'
              }
            >
              {syncState === 'synced' && 'SYNCED'}
              {syncState === 'syncing' && 'SYNCING...'}
              {syncState === 'offline' && 'OFFLINE, WILL SYNC'}
              {syncState === 'error' && 'SYNC ERROR'}
            </span>
          </div>

          {/* Voice Biometrics Speaker Lock Badge */}
          <button
            onClick={() => setShowVoiceEnrollmentModal(true)}
            title={
              VoiceprintEngine.hasProfile()
                ? `Voice Biometric Lock Active: Calibrated for Sirius (${settings.voiceLockSensitivity ?? 70}% threshold). Click to recalibrate.`
                : 'Voice Lock Not Calibrated: Click to enroll your voiceprint (Sirius).'
            }
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 border text-[10px] font-hud tracking-wider cursor-pointer rounded interactive-hover transition-all ${
              !VoiceprintEngine.hasProfile()
                ? 'border-amber-600/70 bg-[#161208] text-amber-300 hover:border-amber-400'
                : isSpeakerVerified === false
                ? 'border-red-600 bg-red-950/80 text-red-300 animate-pulse font-bold'
                : isSpeakerVerified === true
                ? 'border-emerald-500 bg-emerald-950/70 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                : 'border-white/[0.08] bg-[#1E1E1E] text-[#00E5FF] hover:border-[#00E5FF]/60'
            }`}
          >
            <ShieldCheck
              size={12}
              className={
                !VoiceprintEngine.hasProfile()
                  ? 'text-amber-400'
                  : isSpeakerVerified === false
                  ? 'text-red-400'
                  : 'text-emerald-400'
              }
            />
            <span>
              {!VoiceprintEngine.hasProfile()
                ? 'VOICE LOCK: ENROLL'
                : isSpeakerVerified === false
                ? `UNVERIFIED [${voiceVerificationScore ?? 0}%]`
                : isSpeakerVerified === true
                ? `SIRIUS [${voiceVerificationScore ?? 95}%]`
                : 'VOICE LOCK: SIRIUS'}
            </span>
          </button>

          {/* Spacebar Push-to-Talk Badge */}
          <button
            onClick={toggleLiveSession}
            title="Press SPACE or click to toggle voice session"
            className={`hidden sm:flex items-center gap-1 px-2.5 py-1 border text-[10px] font-hud tracking-wider cursor-pointer rounded interactive-hover transition-all ${
              liveVoiceState !== 'IDLE'
                ? 'border-[#00E5FF] bg-[#00E5FF] text-[#0A0A0A] font-bold neon-glow-strong'
                : 'border-white/[0.08] bg-[#1E1E1E] text-[#EDEDED] hover:border-white/20'
            }`}
          >
            <Mic size={12} />
            <span>{liveVoiceState !== 'IDLE' ? 'VOICE LIVE' : '[SPACE] PUSH-TO-TALK'}</span>
          </button>

          {/* Desktop Core Detach / Dock Toggle */}
          <button
            onClick={() => {
              const next = !isCoreDetached;
              setIsCoreDetached(next);
              try {
                localStorage.setItem('maya_core_detached', String(next));
              } catch (e) {}
            }}
            title={isCoreDetached ? 'Dock Holographic Core to Console' : 'Detach Core to Desktop Overlay (Draggable)'}
            className={`hidden md:flex items-center gap-1 px-2.5 py-1 border text-[10px] font-hud tracking-wider cursor-pointer rounded interactive-hover transition-all ${
              isCoreDetached
                ? 'border-[#00E5FF] bg-[#00E5FF] text-[#0A0A0A] font-bold neon-glow'
                : 'border-white/[0.08] bg-[#1E1E1E] text-[#EDEDED] hover:border-white/20'
            }`}
          >
            <Disc size={12} />
            <span>{isCoreDetached ? 'CORE DETACHED' : 'CORE DOCKED'}</span>
          </button>

          {/* Kill switch indicator */}
          <button
            onClick={() => toolBridge.setKillSwitch(!isKillSwitchActive)}
            title="Emergency Tool Kill Switch (Ctrl+Alt+K)"
            className={`px-2 py-0.5 border text-[10px] font-hud cursor-pointer ${
              isKillSwitchActive
                ? 'bg-[#c4524f] text-white border-[#c4524f] animate-pulse font-bold'
                : 'bg-[#141418] text-[#6d6d69] border-[#2e2e31]'
            }`}
          >
            <ShieldAlert size={12} className="inline mr-1" />
            <span>{isKillSwitchActive ? 'TOOLS LOCKED' : 'KILL SWITCH'}</span>
          </button>

          {/* Unified Google Sign-In & Entire Workspace Status Pill */}
          {googleUser && hasWorkspaceToken ? (
            <button
              onClick={() => {
                setConsoleTab('WORKSPACE');
                setMobileActiveView('CONSOLE');
              }}
              title={`Signed in as ${googleUser.email || googleUser.displayName}. Entire Google Workspace (Calendar, Drive, Gmail, Docs, Sheets, Slides, Tasks & Cloud Memory) connected.`}
              className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0d1612] border border-[#3e7b5c] text-[#5cb887] text-[10px] font-hud tracking-wider cursor-pointer hover:bg-[#14231c] transition-all"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#5cb887] animate-pulse" />
              <HardDrive size={11} className="text-[#5cb887]" />
              <span className="hidden sm:inline">WORKSPACE SYNCED</span>
            </button>
          ) : googleUser ? (
            <button
              onClick={() => handleGoogleConnect(googleUser.email || undefined)}
              disabled={isSigningInGoogle}
              title={`Signed in as ${googleUser.email || googleUser.displayName}. Click to refresh Google Workspace access token for this session.`}
              className="flex items-center gap-1.5 px-2 py-0.5 bg-[#18140d] border border-[#7a5b28] text-[#e0a84c] text-[10px] font-hud tracking-wider cursor-pointer hover:bg-[#261f14] transition-all disabled:opacity-60"
            >
              <RefreshCw size={11} className={isSigningInGoogle ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{isSigningInGoogle ? 'RECONNECTING...' : 'RECONNECT WORKSPACE'}</span>
            </button>
          ) : (
            <button
              onClick={() => handleGoogleConnect()}
              disabled={isSigningInGoogle}
              title="Single Sign-In with Google to connect your mail ID to the entire Google Workspace & Cloud Memory"
              className="flex items-center gap-1.5 px-2 py-0.5 bg-[#18140d] border border-[#7a5b28] text-[#e0a84c] text-[10px] font-hud tracking-wider cursor-pointer hover:bg-[#261f14] transition-all disabled:opacity-60"
            >
              <svg className="w-3 h-3 shrink-0" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span className="hidden sm:inline">{isSigningInGoogle ? 'SIGNING IN...' : 'SIGN IN WITH GOOGLE'}</span>
            </button>
          )}

          {/* Settings button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-1 text-[#6d6d69] hover:text-[#cfcfca] cursor-pointer"
            title="Preferences"
          >
            <Settings size={15} />
          </button>
        </div>
      </header>

      {/* Unauthorized Speaker Security Alert Toast */}
      {unauthorizedAlert && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 max-w-md bg-[#160808] border border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.4)] p-3 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <ShieldAlert size={18} className="text-red-400 shrink-0 mt-0.5 animate-bounce" />
          <div className="space-y-1">
            <div className="font-hud text-xs font-bold text-red-300 tracking-wider flex items-center justify-between">
              <span>SPEAKER VERIFICATION REJECTED</span>
              <span className="text-[10px] text-red-400 font-mono">CODE: REFUSAL_ISSUED</span>
            </div>
            <p className="text-[11px] text-red-200 font-mono leading-tight">
              {unauthorizedAlert.message}
            </p>
            <div className="text-[10px] text-red-400 font-hud">
              ACTION: Query discarded. Refusal spoken: &quot;Voice unverified, Sirius only.&quot;
            </div>
          </div>
          <button
            onClick={() => setUnauthorizedAlert(null)}
            className="text-red-400 hover:text-red-200 text-xs cursor-pointer ml-auto"
          >
            ✕
          </button>
        </div>
      )}

      {/* In-app Push Notification Toast (Deduplication while tab is focused) */}
      {inAppToast && (
        <div className="absolute top-12 right-4 z-50 max-w-sm bg-[#0d0d10] border border-[#00E5FF]/80 shadow-[0_0_20px_rgba(0,229,255,0.3)] p-3 flex items-start gap-2.5 animate-in slide-in-from-top-2">
          <Bell size={16} className="text-[#00E5FF] shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="font-hud text-xs font-bold text-[#cfcfca] tracking-wide">
              {inAppToast.title}
            </div>
            <div className="text-[11px] text-[#8e8e88] mt-0.5 leading-snug">
              {inAppToast.body}
            </div>
          </div>
          <button
            onClick={() => setInAppToast(null)}
            className="text-[#6d6d69] hover:text-[#cfcfca] text-xs cursor-pointer ml-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* FLOATING DETACHED HOLOGRAPHIC CORE (Always on top when detached) */}
      {isCoreDetached && (
        <HolographicCore
          emotion={emotion}
          liveState={liveVoiceState}
          isArmed={isArmed}
          isWorking={isProcessing}
          audioLevel={audioLevel}
          onToggleVoice={toggleLiveSession}
          activeSkinId={activeSkinId}
          onChangeSkin={(skinId) => {
            setActiveSkinId(skinId);
            try {
              localStorage.setItem('maya_skin_id', skinId);
            } catch (e) {}
          }}
          captionText={messages[messages.length - 1]?.text}
          isDetached={true}
          onDockToggle={() => {
            setIsCoreDetached(false);
            try {
              localStorage.setItem('maya_core_detached', 'false');
            } catch (e) {}
          }}
        />
      )}

      {/* DESKTOP eDEX-UI MAIN VIEWPORT (CSS GRID) */}
      <div className="flex-1 hidden lg:grid grid-cols-[18%_1fr_21%] grid-rows-[64%_36%] gap-2 p-2 min-h-0 overflow-hidden">
        {/* ROW 1 LEFT: SYSTEM PANEL (~18%) */}
        <div className="col-start-1 row-start-1 min-h-0 overflow-hidden">
          <SystemPanel
            currentMode={currentMode}
            wakeActive={isArmed}
            liveActive={liveVoiceState !== 'IDLE'}
            searchActive={consoleTab === 'SEARCH'}
            transcribeActive={consoleTab === 'TRANSCRIBE'}
          />
        </div>

        {/* ROW 1 CENTER: TABBED CONSOLE WITH HOLOGRAPHIC CORE */}
        <div className="col-start-2 row-start-1 min-h-0 overflow-hidden relative flex flex-col">
          {/* Holographic Core docked at top-right of center HUD when not detached */}
          {!isCoreDetached && (
            <div className="absolute top-1 right-2 z-20 pointer-events-auto scale-75 origin-top-right">
              <HolographicCore
                emotion={emotion}
                liveState={liveVoiceState}
                isArmed={isArmed}
                isWorking={isProcessing}
                audioLevel={audioLevel}
                onToggleVoice={toggleLiveSession}
                activeSkinId={activeSkinId}
                onChangeSkin={(skinId) => {
                  setActiveSkinId(skinId);
                  try {
                    localStorage.setItem('maya_skin_id', skinId);
                  } catch (e) {}
                }}
                captionText={messages[messages.length - 1]?.text}
                isDetached={false}
                onDockToggle={() => {
                  setIsCoreDetached(true);
                  try {
                    localStorage.setItem('maya_core_detached', 'true');
                  } catch (e) {}
                }}
              />
            </div>
          )}

          <ConsolePanel
            currentTab={consoleTab}
            onTabChange={(tab) => setConsoleTab(tab)}
            messages={messages}
            emotion={emotion}
            isProcessing={isProcessing}
            onSendMessage={handleSendMessage}
            systemLogs={systemLogs}
            tasks={tasks}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            notes={notes}
            onAddNote={handleAddNote}
            onDeleteNote={handleDeleteNote}
            inputLineValue={inputLineValue}
            setInputLineValue={setInputLineValue}
            reduceMotion={reduceMotion}
          />
        </div>

        {/* ROW 1 RIGHT: NETWORK PANEL */}
        <div className="col-start-3 row-start-1 min-h-0 overflow-hidden">
          <NetworkPanel
            emotion={emotion}
            intensity={intensity}
            emotionHistory={emotionHistory}
            audioInRate={audioInRate}
            audioOutRate={audioOutRate}
            apiMessageRate={apiMessageRate}
          />
        </div>

        {/* ROW 2 LEFT: MODULES GRID (FILESYSTEM STYLE) */}
        <div className="col-start-1 row-start-2 min-h-0 overflow-hidden">
          <ModulesPanel
            onSelectTab={(tab) => {
              setConsoleTab(tab);
              setMobileActiveView('CONSOLE');
            }}
            onOpenSettings={() => setShowSettingsModal(true)}
            onOpenVoice={() => setShowSettingsModal(true)}
            onOpenAbout={() => setShowAboutModal(true)}
            onOpenModes={() => setShowModesModal(true)}
            onOpenMemory={() => setShowRelationshipMemoryModal(true)}
            currentMode={currentMode}
          />
        </div>

        {/* ROW 2 CENTER & RIGHT: FUNCTIONAL eDEX-UI ON-SCREEN KEYBOARD */}
        <div className="col-span-2 col-start-2 row-start-2 min-h-0 overflow-hidden">
          <KeyboardPanel
            onKeyPress={handleKeyboardChar}
            onBackspace={handleKeyboardBackspace}
            onSpace={handleKeyboardSpace}
            onEnter={handleKeyboardEnter}
          />
        </div>
      </div>

      {/* MOBILE / TABLET VIEW (Responsive Stacking) */}
      <div className="flex-1 flex flex-col lg:hidden p-2 gap-2 min-h-0 overflow-hidden">
        {/* Mobile Holographic Core Bar */}
        <div className="flex items-center justify-between bg-[#09090b] border border-[#2e2e31] p-2">
          <div className="flex items-center gap-2">
            <div className="scale-[0.55] -m-10 origin-center">
              <HolographicCore
                emotion={emotion}
                liveState={liveVoiceState}
                isArmed={isArmed}
                isWorking={isProcessing}
                audioLevel={audioLevel}
                onToggleVoice={toggleLiveSession}
                activeSkinId={activeSkinId}
                onChangeSkin={setActiveSkinId}
                isDetached={false}
              />
            </div>
            <div className="flex flex-col ml-4">
              <span className="font-hud text-xs font-bold text-[#cfcfca]">{currentMode} PROTOCOL</span>
              <span className="text-[10px] text-[#6d6d69] font-mono">
                EMOTION: {emotion.toUpperCase()} ({intensity}%)
              </span>
            </div>
          </div>
          <button
            onClick={toggleLiveSession}
            className={`px-3 py-1 font-hud text-xs font-bold ${
              liveVoiceState !== 'IDLE' ? 'bg-[var(--accent)] text-[#070708]' : 'bg-[#18181c] text-[#cfcfca]'
            }`}
          >
            {liveVoiceState !== 'IDLE' ? 'DISCONNECT' : 'TALK'}
          </button>
        </div>

        {/* Mobile View Switcher */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar font-hud text-[11px] pb-1">
          {(['CONSOLE', 'SYSTEM', 'NETWORK', 'MODULES', 'KEYBOARD'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setMobileActiveView(v)}
              className={`px-2.5 py-1 ${
                mobileActiveView === v
                  ? 'bg-[var(--accent)] text-[#070708] font-bold'
                  : 'bg-[#141417] text-[#6d6d69]'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Mobile Dynamic View Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {mobileActiveView === 'CONSOLE' && (
            <ConsolePanel
              currentTab={consoleTab}
              onTabChange={(tab) => setConsoleTab(tab)}
              messages={messages}
              emotion={emotion}
              isProcessing={isProcessing}
              onSendMessage={handleSendMessage}
              systemLogs={systemLogs}
              tasks={tasks}
              onAddTask={handleAddTask}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              notes={notes}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
              inputLineValue={inputLineValue}
              setInputLineValue={setInputLineValue}
              reduceMotion={reduceMotion}
            />
          )}

          {mobileActiveView === 'SYSTEM' && (
            <SystemPanel
              currentMode={currentMode}
              wakeActive={isArmed}
              liveActive={liveVoiceState !== 'IDLE'}
              searchActive={consoleTab === 'SEARCH'}
              transcribeActive={consoleTab === 'TRANSCRIBE'}
            />
          )}

          {mobileActiveView === 'NETWORK' && (
            <NetworkPanel
              emotion={emotion}
              intensity={intensity}
              emotionHistory={emotionHistory}
              audioInRate={audioInRate}
              audioOutRate={audioOutRate}
              apiMessageRate={apiMessageRate}
            />
          )}

          {mobileActiveView === 'MODULES' && (
            <ModulesPanel
              onSelectTab={(tab) => {
                setConsoleTab(tab);
                setMobileActiveView('CONSOLE');
              }}
              onOpenSettings={() => setShowSettingsModal(true)}
              onOpenVoice={() => setShowSettingsModal(true)}
              onOpenAbout={() => setShowAboutModal(true)}
              onOpenModes={() => setShowModesModal(true)}
              onOpenMemory={() => setShowRelationshipMemoryModal(true)}
              currentMode={currentMode}
            />
          )}

          {mobileActiveView === 'KEYBOARD' && (
            <KeyboardPanel
              onKeyPress={handleKeyboardChar}
              onBackspace={handleKeyboardBackspace}
              onSpace={handleKeyboardSpace}
              onEnter={handleKeyboardEnter}
            />
          )}
        </div>
      </div>

      {/* DIALOGS & MODALS */}
      <ApprovalDialog
        isOpen={approvalModalState.isOpen}
        toolName={approvalModalState.toolName}
        args={approvalModalState.args}
        tier={approvalModalState.tier}
        reason={approvalModalState.reason}
        onApprove={() => {
          approvalModalState.resolve(true);
          setApprovalModalState((prev) => ({ ...prev, isOpen: false }));
        }}
        onReject={() => {
          approvalModalState.resolve(false);
          setApprovalModalState((prev) => ({ ...prev, isOpen: false }));
        }}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={settings}
        onUpdateSettings={(newSet) => setSettings((prev) => ({ ...prev, ...newSet }))}
        wakeState={wakeState}
        heardText={heardText}
        isKillSwitchActive={isKillSwitchActive}
        onToggleKillSwitch={() => toolBridge.setKillSwitch(!isKillSwitchActive)}
        reduceMotion={reduceMotion}
        onToggleReduceMotion={() => setReduceMotion(!reduceMotion)}
        activeSkinId={activeSkinId}
        onChangeSkin={(skinId) => {
          setActiveSkinId(skinId);
          try {
            localStorage.setItem('maya_skin_id', skinId);
          } catch (e) {}
        }}
        onOpenRelationshipMemory={() => setShowRelationshipMemoryModal(true)}
        onOpenVoiceEnrollment={() => setShowVoiceEnrollmentModal(true)}
      />

      <ModesModal
        isOpen={showModesModal}
        onClose={() => setShowModesModal(false)}
        currentMode={currentMode}
        onSelectMode={(m) => {
          setCurrentMode(m);
          addSystemLog(`PROTOCOL SHIFT: Switched to ${m} mode.`);
        }}
      />

      <AboutModal isOpen={showAboutModal} onClose={() => setShowAboutModal(false)} />

      <RelationshipMemoryModal
        isOpen={showRelationshipMemoryModal}
        onClose={() => setShowRelationshipMemoryModal(false)}
        onLog={addSystemLog}
      />

      <VoiceEnrollmentModal
        isOpen={showVoiceEnrollmentModal}
        onClose={() => setShowVoiceEnrollmentModal(false)}
        onEnrollmentComplete={(profile) => {
          addSystemLog(
            `BIOMETRICS: Voiceprint calibrated for Sirius (F0: ${profile.features.fundamentalFrequency}Hz, Formants: ${profile.features.formant1}Hz/${profile.features.formant2}Hz).`
          );
          setSettings((prev) => ({ ...prev, voiceLockEnabled: true }));
          liveManagerRef.current?.setVoiceLockConfig(true, settings.voiceLockSensitivity ?? 70);
          setIsSpeakerVerified(true);
        }}
      />
    </div>
  );
}
