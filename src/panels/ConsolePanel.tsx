import React, { useState, useEffect, useRef } from 'react';
import { MayaEmotion } from '../emotion/types';
import { ChatMessage, TacticalTask, TacticalNote } from '../types';
import {
  Search,
  Copy,
  Download,
  Check,
  Trash2,
  Plus,
  Clock,
  ExternalLink,
  Terminal,
  Calendar,
  CalendarPlus,
  RefreshCw,
  AlertTriangle,
  LogOut,
  MapPin,
  Video,
  Sparkles,
  Mail,
  FileSpreadsheet,
  HardDrive,
  CheckSquare,
  Cloud,
  Database,
  Send,
  MessageSquare,
} from 'lucide-react';
import {
  initAuth,
  googleSignIn,
  googleSignOut,
  hasWorkspaceAccessToken,
} from '../auth/googleAuth';
import { CalendarService, CalendarEventItem } from '../services/calendarService';
import { WorkspaceService, DriveFileItem, GmailMessageItem, GoogleTaskItem } from '../services/workspaceService';
import { CloudMemoryService, CloudMemoryEntry } from '../services/cloudMemoryService';
import { safeFetchJson } from '../utils/safeFetch';
import firebaseConfig from '../../firebase-applet-config.json';
import type { User } from 'firebase/auth';

export type ConsoleTab = 'MAIN' | 'CALENDAR' | 'WORKSPACE' | 'CLOUD_MEMORY' | 'SEARCH' | 'TRANSCRIBE' | 'TASKS' | 'LOG';

interface ConsolePanelProps {
  currentTab: ConsoleTab;
  onTabChange: (tab: ConsoleTab) => void;
  messages: ChatMessage[];
  emotion: MayaEmotion;
  isProcessing: boolean;
  onSendMessage: (text: string, useSearch?: boolean) => void;
  systemLogs: string[];
  tasks: TacticalTask[];
  onAddTask: (title: string, priority: 'high' | 'medium' | 'low', due: string) => void;
  onToggleTask: (id: string) => void;
  onDeleteTask: (id: string) => void;
  notes: TacticalNote[];
  onAddNote: (title: string, content: string, tag: string) => void;
  onDeleteNote: (id: string) => void;
  inputLineValue: string;
  setInputLineValue: (val: string) => void;
  reduceMotion?: boolean;
}

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  currentTab,
  onTabChange,
  messages,
  emotion,
  isProcessing,
  onSendMessage,
  systemLogs,
  tasks,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  notes,
  onAddNote,
  onDeleteNote,
  inputLineValue,
  setInputLineValue,
  reduceMotion = false,
}) => {
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(
    new Set(messages.map((m, idx) => m.id || `msg-${idx}`))
  );
  const animatingMessageIdsRef = useRef<Set<string>>(new Set());

  // Search Tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    query: string;
    answer: string;
    sources: Array<{ title: string; uri: string }>;
  } | null>(null);

  // Transcribe Tab state
  const [transcribeAudioBase64, setTranscribeAudioBase64] = useState<string | null>(null);
  const [transcribeMimeType, setTranscribeMimeType] = useState<string>('audio/webm');
  const [transcribeFileName, setTranscribeFileName] = useState<string>('');
  const [transcriptionResult, setTranscriptionResult] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [isRecordingTranscribe, setIsRecordingTranscribe] = useState<boolean>(false);
  const [copiedTranscribe, setCopiedTranscribe] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Task creation state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newTaskDue, setNewTaskDue] = useState('Today');
  const [taskFilter, setTaskFilter] = useState<'ALL' | 'ACTIVE' | 'DONE'>('ALL');

  // Google Calendar & Workspace authentication state
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [hasWorkspaceToken, setHasWorkspaceToken] = useState<boolean>(() => hasWorkspaceAccessToken());
  const [loginEmailHint, setLoginEmailHint] = useState<string>('');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState<boolean>(false);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState<boolean>(false);
  const [calendarAuthError, setCalendarAuthError] = useState<string | null>(null);
  const [calendarSyncSuccess, setCalendarSyncSuccess] = useState<string | null>(null);

  // Quick schedule form state
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [newEventTime, setNewEventTime] = useState('10:00');
  const [newEventDurationMins, setNewEventDurationMins] = useState(60);
  const [newEventLocation, setNewEventLocation] = useState('');
  const [newEventNotes, setNewEventNotes] = useState('');
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  // Destructive Delete Confirmation Modal (MANDATORY per workspace integration skill)
  const [deleteTargetEvent, setDeleteTargetEvent] = useState<CalendarEventItem | null>(null);
  const [isDeletingEvent, setIsDeletingEvent] = useState(false);

  // Initialize Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setCalendarAuthError(null);
        const hasToken = Boolean(token || hasWorkspaceAccessToken());
        setHasWorkspaceToken(hasToken);
        if (hasToken) {
          loadCalendarEvents();
        }
      },
      () => {
        setGoogleUser(null);
        setHasWorkspaceToken(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const loadCalendarEvents = async () => {
    setIsLoadingCalendar(true);
    setCalendarAuthError(null);
    try {
      const res = await CalendarService.listUpcomingEvents(20);
      if (res.ok) {
        setCalendarEvents(res.events);
        setHasWorkspaceToken(true);
        setCalendarSyncSuccess(`Synced ${res.events.length} upcoming events`);
        setTimeout(() => setCalendarSyncSuccess(null), 4000);
      } else {
        if (res.error === 'NOT_AUTHENTICATED') {
          setHasWorkspaceToken(false);
        } else {
          setCalendarAuthError(res.error || 'Failed to sync calendar');
        }
      }
    } catch (err: any) {
      setCalendarAuthError(err?.message || 'Failed to load events');
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const handleGoogleLogin = async (overrideHint?: string) => {
    setIsSigningInGoogle(true);
    setCalendarAuthError(null);
    setWorkspaceError(null);
    try {
      const hint = overrideHint !== undefined ? overrideHint : loginEmailHint;
      const res = await googleSignIn({ loginHint: hint || undefined });
      if (res) {
        setGoogleUser(res.user);
        setHasWorkspaceToken(res.hasWorkspaceToken);
        setLoginEmailHint('');
        const acctLabel = res.user.email || res.user.displayName || 'Google Account';
        if (res.hasWorkspaceToken) {
          const msg = `Connected entire Google Workspace & Cloud Memory as ${acctLabel}`;
          setWorkspaceSuccess(msg);
          setCalendarSyncSuccess(msg);
          setTimeout(() => {
            setWorkspaceSuccess(null);
            setCalendarSyncSuccess(null);
          }, 4000);
          await Promise.all([loadCalendarEvents(), loadWorkspaceData()]);
        } else {
          setWorkspaceSuccess(`Signed in as ${acctLabel}`);
          setCalendarSyncSuccess(`Signed in as ${acctLabel}`);
          setTimeout(() => {
            setWorkspaceSuccess(null);
            setCalendarSyncSuccess(null);
          }, 4000);
        }
      }
    } catch (err: any) {
      if (
        err?.code !== 'auth/popup-closed-by-user' &&
        err?.code !== 'auth/cancelled-popup-request' &&
        !err?.message?.includes('popup-closed-by-user')
      ) {
        console.error('Google sign in error:', err);
        const msg = err?.message || 'Google sign-in failed. Please try again.';
        setCalendarAuthError(msg);
        setWorkspaceError(msg);
      }
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleGoogleLogout = async () => {
    await googleSignOut();
    setGoogleUser(null);
    setHasWorkspaceToken(false);
    setCalendarEvents([]);
    setDriveFiles([]);
    setEmails([]);
    setGoogleTasksList([]);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim()) return;
    setIsCreatingEvent(true);
    setCalendarAuthError(null);

    try {
      const startIso = `${newEventDate}T${newEventTime}:00`;
      const startTime = new Date(startIso);
      const endTime = new Date(startTime.getTime() + newEventDurationMins * 60 * 1000);

      const res = await CalendarService.createEvent({
        summary: newEventTitle.trim(),
        description: newEventNotes.trim(),
        location: newEventLocation.trim(),
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      if (res.ok) {
        setNewEventTitle('');
        setNewEventNotes('');
        setNewEventLocation('');
        setCalendarSyncSuccess('Event scheduled successfully on Google Calendar');
        setTimeout(() => setCalendarSyncSuccess(null), 4000);
        await loadCalendarEvents();
      } else {
        setCalendarAuthError(res.error || 'Failed to schedule event');
      }
    } catch (err: any) {
      setCalendarAuthError(err?.message || 'Failed to schedule event');
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const confirmDeleteEvent = async () => {
    if (!deleteTargetEvent) return;
    setIsDeletingEvent(true);
    try {
      const res = await CalendarService.deleteEvent(deleteTargetEvent.id);
      if (res.ok) {
        setCalendarEvents((prev) => prev.filter((e) => e.id !== deleteTargetEvent.id));
        setDeleteTargetEvent(null);
        setCalendarSyncSuccess('Event removed from Google Calendar');
        setTimeout(() => setCalendarSyncSuccess(null), 3000);
      } else {
        setCalendarAuthError(res.error || 'Failed to delete event');
      }
    } catch (err: any) {
      setCalendarAuthError(err?.message || 'Failed to delete event');
    } finally {
      setIsDeletingEvent(false);
    }
  };

  // Google Workspace States
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [isLoadingDrive, setIsLoadingDrive] = useState(false);
  const [driveQuery, setDriveQuery] = useState('');
  const [emails, setEmails] = useState<GmailMessageItem[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [googleTasksList, setGoogleTasksList] = useState<GoogleTaskItem[]>([]);
  const [isLoadingGoogleTasks, setIsLoadingGoogleTasks] = useState(false);
  const [newGoogleTaskTitle, setNewGoogleTaskTitle] = useState('');
  const [meetLink, setMeetLink] = useState<string | null>(null);
  const [isCreatingMeet, setIsCreatingMeet] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [workspaceSuccess, setWorkspaceSuccess] = useState<string | null>(null);
  const [createdResourceLink, setCreatedResourceLink] = useState<{ title: string; url: string; type: string } | null>(null);
  const [isCreatingResource, setIsCreatingResource] = useState(false);

  // Cloud Memory States
  const [cloudMemories, setCloudMemories] = useState<CloudMemoryEntry[]>([]);
  const [isLoadingCloudMemory, setIsLoadingCloudMemory] = useState(false);
  const [newCloudKey, setNewCloudKey] = useState('');
  const [newCloudValue, setNewCloudValue] = useState('');
  const [newCloudCategory, setNewCloudCategory] = useState('personal');
  const [cloudMemoryError, setCloudMemoryError] = useState<string | null>(null);
  const [cloudMemorySuccess, setCloudMemorySuccess] = useState<string | null>(null);

  const loadWorkspaceData = async () => {
    if (!googleUser || !hasWorkspaceAccessToken()) return;
    setWorkspaceError(null);
    setIsLoadingDrive(true);
    setIsLoadingEmails(true);
    setIsLoadingGoogleTasks(true);

    try {
      const [driveRes, emailRes, tasksRes] = await Promise.all([
        WorkspaceService.listDriveFiles(8, driveQuery || undefined),
        WorkspaceService.listEmails(5, 'is:unread'),
        WorkspaceService.listTasks(8),
      ]);
      if (driveRes.ok) setDriveFiles(driveRes.files);
      if (emailRes.ok) setEmails(emailRes.messages);
      if (tasksRes.ok) setGoogleTasksList(tasksRes.tasks);
    } catch (e: any) {
      setWorkspaceError(e?.message || 'Failed to load Workspace data');
    } finally {
      setIsLoadingDrive(false);
      setIsLoadingEmails(false);
      setIsLoadingGoogleTasks(false);
    }
  };

  const handleCreateMeet = async () => {
    setIsCreatingMeet(true);
    setWorkspaceError(null);
    try {
      const res = await WorkspaceService.createMeetingSpace();
      if (res.ok && res.meetUri) {
        setMeetLink(res.meetUri);
        setWorkspaceSuccess(`Google Meet created: ${res.meetUri}`);
        setTimeout(() => setWorkspaceSuccess(null), 4000);
      }
    } catch (e: any) {
      setWorkspaceError(e?.message || 'Failed to create Meet link');
    } finally {
      setIsCreatingMeet(false);
    }
  };

  const handleAddGoogleTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoogleTaskTitle.trim()) return;
    const title = newGoogleTaskTitle.trim();
    setNewGoogleTaskTitle('');
    try {
      const res = await WorkspaceService.createTask(title);
      if (res.ok && res.task) {
        setGoogleTasksList((prev) => [res.task!, ...prev]);
        setWorkspaceSuccess(`Task "${title}" added to Google Tasks`);
        setTimeout(() => setWorkspaceSuccess(null), 3000);
      }
    } catch (e: any) {
      setWorkspaceError(e?.message || 'Failed to add task');
    }
  };

  const handleCompleteGoogleTask = async (taskId: string) => {
    try {
      const res = await WorkspaceService.completeTask(taskId);
      if (res.ok) {
        setGoogleTasksList((prev) => prev.filter((t) => t.id !== taskId));
        setWorkspaceSuccess('Task marked completed in Google Tasks');
        setTimeout(() => setWorkspaceSuccess(null), 3000);
      }
    } catch (e: any) {
      setWorkspaceError(e?.message || 'Failed to complete task');
    }
  };

  const handleQuickCreateDoc = async () => {
    setIsCreatingResource(true);
    setWorkspaceError(null);
    try {
      const title = `Axiom Note ${new Date().toLocaleDateString()}`;
      const res = await WorkspaceService.createDoc(title);
      if (res.ok && res.docId) {
        setCreatedResourceLink({
          title: res.title || title,
          url: `https://docs.google.com/document/d/${res.docId}/edit`,
          type: 'Google Doc',
        });
        setWorkspaceSuccess(`Created Google Doc "${title}"`);
        setTimeout(() => setWorkspaceSuccess(null), 4000);
      } else {
        setWorkspaceError(res.error || 'Failed to create Google Doc');
      }
    } catch (e: any) {
      setWorkspaceError(e?.message || 'Failed to create doc');
    } finally {
      setIsCreatingResource(false);
    }
  };

  const handleQuickCreateSheet = async () => {
    setIsCreatingResource(true);
    setWorkspaceError(null);
    try {
      const title = `Axiom Tracker ${new Date().toLocaleDateString()}`;
      const res = await WorkspaceService.createSpreadsheet(title);
      if (res.ok && res.spreadsheetId) {
        setCreatedResourceLink({
          title: res.title || title,
          url: res.webViewLink || `https://docs.google.com/spreadsheets/d/${res.spreadsheetId}/edit`,
          type: 'Google Sheet',
        });
        setWorkspaceSuccess(`Created Google Sheet "${title}"`);
        setTimeout(() => setWorkspaceSuccess(null), 4000);
      } else {
        setWorkspaceError(res.error || 'Failed to create Google Sheet');
      }
    } catch (e: any) {
      setWorkspaceError(e?.message || 'Failed to create sheet');
    } finally {
      setIsCreatingResource(false);
    }
  };

  const handleQuickCreateSlide = async () => {
    setIsCreatingResource(true);
    setWorkspaceError(null);
    try {
      const title = `Executive Deck ${new Date().toLocaleDateString()}`;
      const res = await WorkspaceService.createPresentation(title);
      if (res.ok && res.presentationId) {
        setCreatedResourceLink({
          title: res.title || title,
          url: res.webViewLink || `https://docs.google.com/presentation/d/${res.presentationId}/edit`,
          type: 'Google Slides',
        });
        setWorkspaceSuccess(`Created Google Slides deck "${title}"`);
        setTimeout(() => setWorkspaceSuccess(null), 4000);
      } else {
        setWorkspaceError(res.error || 'Failed to create presentation');
      }
    } catch (e: any) {
      setWorkspaceError(e?.message || 'Failed to create presentation');
    } finally {
      setIsCreatingResource(false);
    }
  };

  const handleQuickCreateKeep = async () => {
    setIsCreatingResource(true);
    setWorkspaceError(null);
    try {
      const title = `Idea Note [${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}]`;
      const res = await WorkspaceService.createKeepNote(title, 'Priority executive idea captured by Maya.');
      if (res.ok) {
        setWorkspaceSuccess(`Saved Keep Note "${title}" to Google Workspace.`);
        loadWorkspaceData();
        setTimeout(() => setWorkspaceSuccess(null), 4000);
      } else {
        setWorkspaceError(res.error || 'Failed to save Keep note');
      }
    } catch (e: any) {
      setWorkspaceError(e?.message || 'Failed to save Keep note');
    } finally {
      setIsCreatingResource(false);
    }
  };

  const loadCloudMemoryData = async () => {
    setIsLoadingCloudMemory(true);
    setCloudMemoryError(null);
    try {
      const res = await CloudMemoryService.listMemories();
      if (res.ok) {
        setCloudMemories(res.memories);
      } else {
        setCloudMemoryError(res.error || 'Failed to load cloud memory');
      }
    } catch (e: any) {
      setCloudMemoryError(e?.message || 'Cloud memory connection failed');
    } finally {
      setIsLoadingCloudMemory(false);
    }
  };

  const handleAddCloudMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCloudKey.trim() || !newCloudValue.trim()) return;
    const key = newCloudKey.trim();
    const val = newCloudValue.trim();
    const cat = newCloudCategory;
    setNewCloudKey('');
    setNewCloudValue('');

    try {
      const res = await CloudMemoryService.saveMemory(key, val, cat);
      if (res.ok) {
        setCloudMemorySuccess(`Saved "${key}" to Firestore cloud memory`);
        setTimeout(() => setCloudMemorySuccess(null), 3000);
        loadCloudMemoryData();
      } else {
        setCloudMemoryError(res.error || 'Failed to save cloud memory');
      }
    } catch (e: any) {
      setCloudMemoryError(e?.message || 'Cloud memory save failed');
    }
  };

  const handleDeleteCloudMemory = async (id: string) => {
    try {
      const res = await CloudMemoryService.deleteMemory(id);
      if (res.ok) {
        setCloudMemories((prev) => prev.filter((m) => m.id !== id));
        setCloudMemorySuccess('Deleted memory from Firestore cloud');
        setTimeout(() => setCloudMemorySuccess(null), 3000);
      }
    } catch (e: any) {
      setCloudMemoryError(e?.message || 'Failed to delete');
    }
  };

  useEffect(() => {
    if (currentTab === 'WORKSPACE' && googleUser && hasWorkspaceAccessToken()) {
      loadWorkspaceData();
    } else if (currentTab === 'CLOUD_MEMORY') {
      loadCloudMemoryData();
    }
  }, [currentTab, googleUser, hasWorkspaceToken]);

  // Track newly added messages in MAIN chat so only new arrivals animate
  useEffect(() => {
    if (currentTab === 'MAIN') {
      messages.forEach((m, idx) => {
        const key = m.id || `msg-${idx}`;
        if (!seenMessageIdsRef.current.has(key)) {
          seenMessageIdsRef.current.add(key);
          if (!reduceMotion) {
            animatingMessageIdsRef.current.add(key);
          }
        }
      });
    } else {
      animatingMessageIdsRef.current.clear();
    }
  }, [messages, currentTab, reduceMotion]);

  // Auto-scroll terminal
  useEffect(() => {
    if (currentTab === 'MAIN') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (currentTab === 'LOG') {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, systemLogs, currentTab]);

  // Handle Search Tab query
  const handleRunSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;

    setIsSearching(true);
    try {
      const res = await safeFetchJson<{ reply?: string; sources?: Array<{ title: string; uri: string }> }>(
        '/api/maya/search-chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: searchQuery, mode: 'COMMAND', userName: 'Sirius' }),
        }
      );
      if (res.ok && res.data) {
        setSearchResults({
          query: searchQuery,
          answer: res.data.reply || 'No information retrieved.',
          sources: res.data.sources || [],
        });
      } else {
        setSearchResults({
          query: searchQuery,
          answer: 'Live Search Grounding backend unavailable in static preview. Deploy Netlify Functions with GEMINI_API_KEY to enable live web grounding.',
          sources: [],
        });
      }
    } catch {
      setSearchResults({
        query: searchQuery,
        answer: 'Search grounding failed. Verify network connectivity.',
        sources: [],
      });
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Transcribe File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setTranscribeFileName(file.name);
    setTranscribeMimeType(file.type || 'audio/webm');

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      setTranscribeAudioBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  // Toggle Transcribe Mic Recording
  const toggleTranscribeRecording = async () => {
    if (isRecordingTranscribe) {
      mediaRecorderRef.current?.stop();
      setIsRecordingTranscribe(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(stream);

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        setTranscribeFileName(`recording_${Date.now()}.webm`);
        setTranscribeMimeType('audio/webm');
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result as string;
          setTranscribeAudioBase64(res.split(',')[1]);
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setIsRecordingTranscribe(true);
    } catch (err) {
      alert('Microphone access required for audio recording.');
    }
  };

  // Run Transcription via /api/maya/transcribe
  const handleTranscribeAudio = async () => {
    if (!transcribeAudioBase64 || isTranscribing) return;

    setIsTranscribing(true);
    try {
      const res = await safeFetchJson<{ transcription?: string }>('/api/maya/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: transcribeAudioBase64,
          mimeType: transcribeMimeType,
        }),
      });
      if (res.ok && res.data) {
        setTranscriptionResult(res.data.transcription || 'Transcription complete.');
      } else {
        setTranscriptionResult('Transcription endpoint unavailable. Verify backend / Netlify function configuration.');
      }
    } catch {
      setTranscriptionResult('Transcription failed. Check network link.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopyTranscription = () => {
    if (!transcriptionResult) return;
    navigator.clipboard.writeText(transcriptionResult);
    setCopiedTranscribe(true);
    setTimeout(() => setCopiedTranscribe(false), 2000);
  };

  const handleDownloadTranscription = () => {
    if (!transcriptionResult) return;
    const blob = new Blob([transcriptionResult], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maya_transcript_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: Array<{ id: ConsoleTab; label: string }> = [
    { id: 'MAIN', label: '01 // MAIN' },
    { id: 'CALENDAR', label: '02 // CALENDAR' },
    { id: 'WORKSPACE', label: '03 // WORKSPACE' },
    { id: 'CLOUD_MEMORY', label: '04 // CLOUD MEMORY' },
    { id: 'SEARCH', label: '05 // SEARCH' },
    { id: 'TRANSCRIBE', label: '06 // TRANSCRIBE' },
    { id: 'TASKS', label: '07 // TASKS' },
    { id: 'LOG', label: '08 // LOG' },
  ];

  const filteredTasks = tasks.filter((t) => {
    if (taskFilter === 'ACTIVE') return !t.completed;
    if (taskFilter === 'DONE') return t.completed;
    return true;
  });

  return (
    <div className="glass-panel h-full flex flex-col overflow-hidden relative border border-white/[0.08] shadow-2xl">
      {/* Console Tab Navigation Bar (Frosted Glass & High Contrast) */}
      <div className="flex items-center bg-[#121212]/90 backdrop-blur-md border-b border-white/[0.08] px-3 pt-2 gap-2 overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 text-xs font-hud tracking-wider transition-all rounded-t interactive-hover cursor-pointer ${
                isActive
                  ? 'bg-[#00E5FF] text-[#0A0A0A] font-bold shadow-[0_0_15px_rgba(0,229,255,0.3)]'
                  : 'bg-[#1E1E1E] text-[#9E9E9E] hover:text-[#EDEDED] hover:bg-[#252525] border-t border-x border-white/[0.05]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: MAIN CONSOLE (Live Typewriter Terminal) */}
      {currentTab === 'MAIN' && (
        <div className="flex-1 flex flex-col p-4 overflow-hidden bg-[#0A0A0A]/95 font-mono text-xs">
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-3.5 pr-1">
            <div className="text-[11px] text-[#9E9E9E] border-b border-white/[0.08] pb-2 flex justify-between font-hud tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00E5FF] animate-pulse" />
                AXIOM INTELLIGENCE TERMINAL v1.0 [AUTHORIZED SESSION]
              </span>
              <span className="text-[#00E5FF] font-bold">HOST: SIRIUS@ASC</span>
            </div>

            {messages.length === 0 && (
              <div className="text-[#9E9E9E] py-8 text-center surface-card p-6 rounded-lg border border-white/[0.08]">
                Awaiting input from Sirius. Say &quot;Hey Maya&quot; or type below.
              </div>
            )}

            {messages.map((msg, index) => {
              const isMaya = msg.sender === 'maya';
              const msgKey = msg.id || `msg-${index}`;
              const shouldAnimate =
                !reduceMotion &&
                (!seenMessageIdsRef.current.has(msgKey) ||
                  animatingMessageIdsRef.current.has(msgKey));
              const enterClass = shouldAnimate
                ? isMaya
                  ? 'chat-message-enter-maya'
                  : 'chat-message-enter'
                : '';

              return (
                <div
                  key={msgKey}
                  onAnimationEnd={(e) => {
                    if (e.target === e.currentTarget) {
                      animatingMessageIdsRef.current.delete(msgKey);
                    }
                  }}
                  className={`p-3 rounded-lg border transition-all ${enterClass} ${
                    isMaya
                      ? 'bg-[#1E1E1E] border-white/[0.08] shadow-sm'
                      : 'bg-[#141416] border-white/[0.05]'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] pb-1.5 mb-1.5 border-b border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <span className={`font-hud tracking-wider font-bold ${isMaya ? 'text-[#00E5FF]' : 'text-[#EDEDED]'}`}>
                        {isMaya ? 'MAYA AI' : 'SIRIUS@AXIOM'}
                      </span>
                      {isMaya && (
                        <span className="px-1.5 py-0.2 text-[9px] bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/30 rounded">
                          SECURE CORE
                        </span>
                      )}
                    </div>
                    <span className="text-[#6d6d69] text-[9px] font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div
                    className={`chat-message-body leading-relaxed whitespace-pre-wrap ${
                      isMaya
                        ? 'text-[#EDEDED] font-sans text-[13px]'
                        : 'text-[#EDEDED] font-mono text-[12px]'
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* Search citations if present */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-white/[0.06] text-[10px] space-y-1">
                      <span className="text-[#9E9E9E] font-hud tracking-wider">GROUNDED SOURCES:</span>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((src, i) => (
                          <a
                            key={i}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[#00E5FF] hover:underline bg-[#141418] px-2 py-1 border border-white/[0.08] rounded interactive-hover"
                          >
                            <ExternalLink size={10} />
                            <span className="truncate max-w-[200px]">{src.title}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Sleek Pulsing Skeleton Loader replacing abrupt spinner */}
            {isProcessing && (
              <div
                className={`space-y-2 py-3 px-3.5 surface-card rounded-lg border border-white/[0.08] shadow-[0_0_20px_rgba(0,229,255,0.1)] ${
                  reduceMotion ? '' : 'chat-message-enter'
                }`}
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-ping" />
                    <span className="text-[#00E5FF] font-bold font-hud tracking-wider">MAYA COGNITIVE SYNAPSE</span>
                  </div>
                  <span className="text-[10px] text-[#9E9E9E] font-mono">NEURAL_DECODING...</span>
                </div>
                {/* Pulsing skeleton bars */}
                <div className="space-y-1.5 pt-1">
                  <div className="skeleton-shimmer h-3.5 w-4/5 rounded" />
                  <div className="skeleton-shimmer h-3.5 w-full rounded" />
                  <div className="skeleton-shimmer h-3.5 w-2/3 rounded" />
                </div>
              </div>
            )}

            <div ref={terminalEndRef} />
          </div>

          {/* Terminal Input Line */}
          <div className="mt-3 pt-2.5 border-t border-white/[0.08] flex items-center gap-2 bg-[#121212] px-3 py-2 rounded-lg border border-white/[0.08] shadow-inner focus-within:border-[#00E5FF]/60 focus-within:shadow-[0_0_15px_rgba(0,229,255,0.2)] transition-all">
            <span className="text-[#00E5FF] font-bold select-none text-xs font-mono">SIRIUS@AXIOM:~$</span>
            <input
              type="text"
              value={inputLineValue}
              onChange={(e) => setInputLineValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && inputLineValue.trim()) {
                  onSendMessage(inputLineValue);
                  setInputLineValue('');
                }
              }}
              placeholder="Enter command or query (ENTER to dispatch)..."
              className="flex-1 bg-transparent border-none outline-hidden text-[#EDEDED] font-mono text-xs placeholder:text-[#525252]"
            />
            <span className="terminal-cursor" />
          </div>
        </div>
      )}

      {/* Tab: GOOGLE CALENDAR & SCHEDULE */}
      {currentTab === 'CALENDAR' && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto no-scrollbar gap-3 bg-[#070708]/90 font-mono text-xs">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#2e2e31]/60 pb-2">
            <div>
              <div className="font-hud text-sm font-bold text-[#cfcfca] flex items-center gap-2">
                <Calendar size={16} className="text-[var(--accent)]" />
                <span>GOOGLE CALENDAR // EXECUTIVE SCHEDULE</span>
              </div>
              <div className="text-[10px] text-[#6d6d69]">
                Live Google Calendar sync, scheduling with Maya, and conflict analysis.
              </div>
            </div>
            <div className="flex items-center gap-2">
              {googleUser && (
                <>
                  <button
                    onClick={loadCalendarEvents}
                    disabled={isLoadingCalendar}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-[#141418] hover:bg-[#1a1a20] border border-[#2e2e31] text-[var(--accent)] text-[10px] font-hud font-bold cursor-pointer transition-all disabled:opacity-50"
                  >
                    <RefreshCw size={11} className={isLoadingCalendar ? 'animate-spin' : ''} />
                    <span>SYNC NOW</span>
                  </button>
                  <button
                    onClick={handleGoogleLogout}
                    title="Disconnect Google account"
                    className="flex items-center gap-1 px-2 py-1 bg-[#141418] hover:bg-[#c4524f]/20 border border-[#2e2e31] hover:border-[#c4524f] text-[#6d6d69] hover:text-[#c4524f] text-[10px] font-hud cursor-pointer transition-all"
                  >
                    <LogOut size={11} />
                    <span className="hidden sm:inline">DISCONNECT</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Status Banners */}
          {calendarSyncSuccess && (
            <div className="p-2 bg-[#0d1612] border border-[#3e7b5c] text-[#5cb887] text-[11px] flex items-center gap-2">
              <Check size={14} />
              <span>{calendarSyncSuccess}</span>
            </div>
          )}

          {calendarAuthError && (
            <div className="p-2 bg-[#180d0d] border border-[#8b3a3a] text-[#c4524f] text-[11px] flex items-center gap-2">
              <AlertTriangle size={14} />
              <span>{calendarAuthError}</span>
            </div>
          )}

          {/* Not Authenticated: Single Unified Google Sign-In Card */}
          {!googleUser && (
            <div className="p-5 bg-[#09090b] border border-[#2e2e31] flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-[#141418] border border-[#2e2e31] flex items-center justify-center text-[var(--accent)]">
                <Calendar size={20} />
              </div>
              <div className="max-w-md space-y-1">
                <div className="font-hud text-sm font-bold text-[#cfcfca]">
                  SIGN IN WITH GOOGLE // ENTIRE WORKSPACE
                </div>
                <p className="text-[11px] text-[#6d6d69] leading-relaxed">
                  One sign-in connects Calendar, Drive, Gmail, Docs, Sheets, Slides, Tasks, Meet &amp; Cloud Memory for your mail ID.
                </p>
              </div>

              <div className="w-full max-w-xs">
                <input
                  type="email"
                  value={loginEmailHint}
                  onChange={(e) => setLoginEmailHint(e.target.value)}
                  placeholder="Optional mail ID (leave blank to pick any account)"
                  className="w-full bg-[#141418] border border-[#2e2e31] px-3 py-1.5 text-[11px] text-[#cfcfca] placeholder:text-[#525252] outline-hidden focus:border-[var(--accent)] text-center"
                />
              </div>

              <div className="flex items-center justify-center pt-1">
                <button
                  onClick={() => handleGoogleLogin()}
                  disabled={isSigningInGoogle}
                  className="flex items-center gap-3 px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-800 rounded font-sans text-xs font-medium shadow-md transition-all cursor-pointer disabled:opacity-60"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  <span>{isSigningInGoogle ? 'Connecting Google Workspace...' : 'Sign in with Google'}</span>
                </button>
              </div>

              <div className="text-[10px] text-[#46464a] pt-1">
                Supports all Gmail &amp; Google Workspace mail IDs. OAuth tokens stay strictly in memory.
              </div>
            </div>
          )}

          {/* Signed in after page refresh where in-memory token needs quick 1-click restore */}
          {googleUser && !hasWorkspaceToken && (
            <div className="p-3 bg-[#09090b] border border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px]">
              <div className="text-amber-200/90">
                Signed in as <span className="font-bold text-white">{googleUser.email}</span>. Session token refreshed — click to reconnect your Google Workspace.
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleGoogleLogin(googleUser.email || undefined)}
                  disabled={isSigningInGoogle}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-hud text-[10px] font-bold cursor-pointer"
                >
                  {isSigningInGoogle ? 'RECONNECTING...' : 'RECONNECT WORKSPACE'}
                </button>
                <button
                  onClick={() => handleGoogleLogin('')}
                  disabled={isSigningInGoogle}
                  className="px-2.5 py-1 bg-[#141418] hover:bg-[#1f1f26] border border-[#2e2e31] text-[#cfcfca] font-hud text-[10px] cursor-pointer"
                >
                  SWITCH MAIL ID
                </button>
              </div>
            </div>
          )}

          {/* Authenticated View */}
          {googleUser && (
            <>
              {/* Account Bar */}
              <div className="p-2.5 bg-[#09090b] border border-[#2e2e31] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {googleUser.photoURL ? (
                    <img src={googleUser.photoURL} alt="User" className="w-6 h-6 rounded-full border border-[var(--accent)]" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[var(--accent)] text-[#070708] font-bold flex items-center justify-center text-xs">
                      {googleUser.displayName?.charAt(0) || 'U'}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-[#cfcfca] font-bold text-xs">{googleUser.displayName || 'Google Account'}</span>
                    <span className="text-[#6d6d69] text-[10px]">{googleUser.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[var(--accent)] font-hud">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                  <span>ONLINE // CALENDAR READY</span>
                </div>
              </div>

              {/* AI Agent Quick Prompts */}
              <div className="p-2.5 bg-[#09090b] border border-[#2e2e31]/80 space-y-1.5">
                <div className="font-hud text-[11px] text-[#6d6d69] font-bold flex items-center gap-1.5">
                  <Sparkles size={12} className="text-[var(--accent)]" />
                  <span>AI AGENT VOICE & COMMAND SHORTCUTS</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'What events do I have scheduled today?',
                    'Check my upcoming meetings this week',
                    'Schedule PONNI MUN review tomorrow at 4 PM',
                    'Check for any meeting conflicts tomorrow',
                  ].map((promptText, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSendMessage(promptText)}
                      className="px-2 py-1 bg-[#141418] hover:bg-[#1f1f26] border border-[#2e2e31] hover:border-[var(--accent)] text-[10px] text-[#cfcfca] cursor-pointer transition-all"
                    >
                      &quot;{promptText}&quot;
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid: Events List & Quick Scheduler */}
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
                {/* Events Column (3 cols) */}
                <div className="lg:col-span-3 space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-[#2e2e31]/60">
                    <span className="font-hud text-xs font-bold text-[#cfcfca]">
                      UPCOMING CALENDAR EVENTS ({calendarEvents.length})
                    </span>
                    <span className="text-[10px] text-[#6d6d69]">
                      {isLoadingCalendar ? 'Syncing...' : 'Primary Calendar'}
                    </span>
                  </div>

                  {calendarEvents.length === 0 && !isLoadingCalendar && (
                    <div className="p-6 bg-[#09090b] border border-[#2e2e31]/60 text-center text-[#6d6d69] text-xs">
                      No upcoming events found on your primary calendar. Use the scheduler on the right or ask Maya to book an appointment.
                    </div>
                  )}

                  <div className="space-y-2 max-h-[50vh] overflow-y-auto no-scrollbar pr-1">
                    {calendarEvents.map((ev, evIdx) => {
                      const startDate = ev.start?.dateTime ? new Date(ev.start.dateTime) : ev.start?.date ? new Date(ev.start.date) : null;
                      const timeStr = startDate
                        ? startDate.toLocaleDateString(undefined, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          }) +
                          (ev.start.dateTime
                            ? ` @ ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                            : ' (All day)')
                        : 'No date';

                      return (
                        <div
                          key={`${ev.id || 'cal'}-${evIdx}`}
                          className="p-2.5 bg-[#09090b] border border-[#2e2e31]/70 hover:border-[var(--accent)]/50 transition-colors flex flex-col gap-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-bold text-[#cfcfca] text-xs line-clamp-1">{ev.summary || '(Untitled Event)'}</div>
                            <button
                              onClick={() => setDeleteTargetEvent(ev)}
                              title="Delete event from Google Calendar"
                              className="text-[#6d6d69] hover:text-[#c4524f] p-1 cursor-pointer transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--accent)] font-mono">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {timeStr}
                            </span>
                            {ev.location && (
                              <span className="flex items-center gap-1 text-[#6d6d69] truncate max-w-xs">
                                <MapPin size={12} />
                                {ev.location}
                              </span>
                            )}
                          </div>

                          {ev.description && (
                            <div className="text-[10px] text-[#6d6d69] line-clamp-2 bg-[#070708] p-1.5 border border-[#2e2e31]/40">
                              {ev.description}
                            </div>
                          )}

                          {ev.htmlLink && (
                            <div className="pt-1 flex justify-end">
                              <a
                                href={ev.htmlLink}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1 text-[10px] text-[#6d6d69] hover:text-[var(--accent)]"
                              >
                                <span>Open in Google Calendar</span>
                                <ExternalLink size={10} />
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quick Scheduler Column (2 cols) */}
                <div className="lg:col-span-2 bg-[#09090b] border border-[#2e2e31]/80 p-3 space-y-2.5">
                  <span className="font-hud text-xs font-bold text-[#cfcfca] flex items-center gap-1.5">
                    <CalendarPlus size={14} className="text-[var(--accent)]" />
                    <span>SCHEDULE NEW EVENT</span>
                  </span>

                  <form onSubmit={handleCreateEvent} className="space-y-2 text-xs">
                    <div>
                      <label className="text-[10px] text-[#6d6d69] block mb-1">EVENT TITLE</label>
                      <input
                        type="text"
                        placeholder="e.g. PONNI MUN 3.0 Registration Review"
                        value={newEventTitle}
                        onChange={(e) => setNewEventTitle(e.target.value)}
                        required
                        className="w-full bg-[#141418] border border-[#2e2e31] px-2.5 py-1.5 text-xs text-[#cfcfca] outline-hidden focus:border-[var(--accent)]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-[#6d6d69] block mb-1">DATE</label>
                        <input
                          type="date"
                          value={newEventDate}
                          onChange={(e) => setNewEventDate(e.target.value)}
                          required
                          className="w-full bg-[#141418] border border-[#2e2e31] px-2 py-1 text-xs text-[#cfcfca] outline-hidden"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[#6d6d69] block mb-1">TIME</label>
                        <input
                          type="time"
                          value={newEventTime}
                          onChange={(e) => setNewEventTime(e.target.value)}
                          required
                          className="w-full bg-[#141418] border border-[#2e2e31] px-2 py-1 text-xs text-[#cfcfca] outline-hidden"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-[#6d6d69] block mb-1">DURATION</label>
                      <div className="grid grid-cols-4 gap-1">
                        {[
                          { mins: 15, label: '15m' },
                          { mins: 30, label: '30m' },
                          { mins: 60, label: '1h' },
                          { mins: 120, label: '2h' },
                        ].map((item) => (
                          <button
                            key={item.mins}
                            type="button"
                            onClick={() => setNewEventDurationMins(item.mins)}
                            className={`py-1 text-center font-hud text-[10px] cursor-pointer ${
                              newEventDurationMins === item.mins
                                ? 'bg-[var(--accent)] text-[#070708] font-bold'
                                : 'bg-[#141418] text-[#6d6d69] hover:text-[#cfcfca]'
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-[#6d6d69] block mb-1">LOCATION / LINK</label>
                      <input
                        type="text"
                        placeholder="Google Meet, Trichy HQ, or Zoom"
                        value={newEventLocation}
                        onChange={(e) => setNewEventLocation(e.target.value)}
                        className="w-full bg-[#141418] border border-[#2e2e31] px-2.5 py-1 text-xs text-[#cfcfca] outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-[#6d6d69] block mb-1">AGENDA / DESCRIPTION</label>
                      <textarea
                        rows={2}
                        placeholder="Key points or meeting deliverables..."
                        value={newEventNotes}
                        onChange={(e) => setNewEventNotes(e.target.value)}
                        className="w-full bg-[#141418] border border-[#2e2e31] px-2.5 py-1 text-xs text-[#cfcfca] outline-hidden resize-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isCreatingEvent}
                      className="w-full py-2 bg-[var(--accent)] text-[#070708] font-hud font-bold text-xs hover:brightness-110 cursor-pointer disabled:opacity-50 tracking-wider"
                    >
                      {isCreatingEvent ? 'DISPATCHING TO GOOGLE CALENDAR...' : 'SCHEDULE EVENT VIA MAYA'}
                    </button>
                  </form>
                </div>
              </div>
            </>
          )}

          {/* Delete Confirmation Modal (MANDATORY per Workspace Skill) */}
          {deleteTargetEvent && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
              <div className="bg-[#0e0e12] border-2 border-[#c4524f] max-w-md w-full p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center gap-2 text-[#c4524f] font-hud text-sm font-bold">
                  <AlertTriangle size={18} />
                  <span>CONFIRM CALENDAR EVENT DELETION</span>
                </div>
                <div className="text-[#cfcfca] leading-relaxed bg-[#070708] p-3 border border-[#2e2e31]">
                  <p>Are you sure you want to delete this event from Google Calendar?</p>
                  <div className="mt-2 text-[var(--accent)] font-bold text-sm">
                    &quot;{deleteTargetEvent.summary}&quot;
                  </div>
                  <div className="mt-1 text-[10px] text-[#6d6d69]">
                    Time: {deleteTargetEvent.start?.dateTime || deleteTargetEvent.start?.date || 'N/A'}
                  </div>
                  <p className="mt-2 text-[#c4524f] text-[10px]">
                    This action will permanently remove the event from your Google Calendar.
                  </p>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2e2e31]">
                  <button
                    onClick={() => setDeleteTargetEvent(null)}
                    disabled={isDeletingEvent}
                    className="px-3 py-1.5 bg-[#141418] text-[#cfcfca] hover:bg-[#1a1a20] font-hud text-xs cursor-pointer"
                  >
                    CANCEL
                  </button>
                  <button
                    onClick={confirmDeleteEvent}
                    disabled={isDeletingEvent}
                    className="px-4 py-1.5 bg-[#c4524f] text-white hover:brightness-110 font-hud text-xs font-bold cursor-pointer"
                  >
                    {isDeletingEvent ? 'DELETING...' : 'YES, DELETE EVENT'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: GOOGLE WORKSPACE */}
      {currentTab === 'WORKSPACE' && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto no-scrollbar gap-3 bg-[#070708]/90 font-mono text-xs">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2e2e31]/60 pb-2">
            <div>
              <div className="font-hud text-sm font-bold text-[#cfcfca] flex items-center gap-2">
                <HardDrive size={15} className="text-[#00E5FF]" />
                <span>GOOGLE WORKSPACE // INTEGRATED PROTOCOLS</span>
              </div>
              <div className="text-[10px] text-[#6d6d69]">
                Live cloud connection to Google Drive, Sheets, Gmail, Docs, Slides, Tasks, Chat, Forms & Meet.
              </div>
            </div>

            <div className="flex items-center gap-2">
              {googleUser ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded-sm flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {googleUser.email || 'CONNECTED'}
                  </span>
                  <button
                    onClick={() => handleGoogleLogin('')}
                    disabled={isSigningInGoogle}
                    title="Switch to another Google mail ID"
                    className="px-2 py-0.5 bg-[#141418] border border-[#2e2e31] hover:border-[var(--accent)] text-[#cfcfca] hover:text-[var(--accent)] text-[10px] font-hud cursor-pointer"
                  >
                    SWITCH MAIL ID
                  </button>
                  <button
                    onClick={loadWorkspaceData}
                    disabled={isLoadingDrive || isLoadingEmails || !hasWorkspaceToken}
                    className="p-1 border border-[#2e2e31] hover:border-[#6d6d69] text-[#cfcfca] cursor-pointer disabled:opacity-40"
                    title="Refresh Workspace Data"
                  >
                    <RefreshCw size={13} className={isLoadingDrive ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={handleGoogleLogout}
                    title="Disconnect Google account"
                    className="p-1 border border-[#2e2e31] hover:border-[#c4524f] text-[#6d6d69] hover:text-[#c4524f] cursor-pointer"
                  >
                    <LogOut size={13} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleGoogleLogin()}
                  disabled={isSigningInGoogle}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#18140d] border border-[#7a5b28] text-[#e0a84c] text-xs font-hud tracking-wider cursor-pointer hover:bg-[#261f14]"
                >
                  <HardDrive size={13} />
                  <span>{isSigningInGoogle ? 'CONNECTING...' : 'SIGN IN WITH GOOGLE'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Feedback messages */}
          {workspaceError && (
            <div className="p-2 bg-red-950/40 border border-red-800/60 text-red-300 text-[11px] flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
              <span>{workspaceError}</span>
            </div>
          )}
          {workspaceSuccess && (
            <div className="p-2 bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[11px] flex items-center gap-2">
              <Check size={14} className="text-emerald-400 shrink-0" />
              <span>{workspaceSuccess}</span>
            </div>
          )}

          {/* Single Unified Google Sign-In Card when signed out */}
          {!googleUser && (
            <div className="p-4 bg-[#09090b] border border-[#2e2e31] flex flex-col items-center text-center space-y-3">
              <div className="max-w-lg space-y-1">
                <div className="font-hud text-sm font-bold text-[#cfcfca]">
                  CONNECT ENTIRE GOOGLE WORKSPACE WITH ONE SIGN-IN
                </div>
                <p className="text-[11px] text-[#6d6d69] leading-relaxed">
                  Sign in once with your Google or Gmail mail ID to immediately connect Calendar, Drive, Sheets, Gmail, Docs, Slides, Tasks, Chat, Meet &amp; Cloud Memory.
                </p>
              </div>

              <div className="w-full max-w-xs">
                <input
                  type="email"
                  value={loginEmailHint}
                  onChange={(e) => setLoginEmailHint(e.target.value)}
                  placeholder="Optional mail ID (leave blank to pick any account)"
                  className="w-full bg-[#141418] border border-[#2e2e31] px-3 py-1.5 text-[11px] text-[#cfcfca] placeholder:text-[#525252] outline-hidden focus:border-[var(--accent)] text-center"
                />
              </div>

              <div className="flex items-center justify-center">
                <button
                  onClick={() => handleGoogleLogin()}
                  disabled={isSigningInGoogle}
                  className="flex items-center gap-2.5 px-4 py-2 bg-white hover:bg-neutral-100 text-neutral-800 rounded font-sans text-xs font-medium shadow-md transition-all cursor-pointer disabled:opacity-60"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  <span>{isSigningInGoogle ? 'Connecting Workspace...' : 'Sign in with Google'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Signed in after page refresh where in-memory token needs quick 1-click restore */}
          {googleUser && !hasWorkspaceToken && (
            <div className="p-3 bg-[#09090b] border border-amber-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px]">
              <div className="text-amber-200/90">
                Signed in as <span className="font-bold text-white">{googleUser.email}</span>. Session token refreshed — reconnect to activate Drive, Gmail, Calendar, Docs &amp; Tasks.
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => handleGoogleLogin(googleUser.email || undefined)}
                  disabled={isSigningInGoogle}
                  className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-hud text-[10px] font-bold cursor-pointer"
                >
                  {isSigningInGoogle ? 'RECONNECTING...' : 'RECONNECT GOOGLE WORKSPACE'}
                </button>
              </div>
            </div>
          )}

          {/* Instant Meet Section */}
          <div className="bg-[#09090b] border border-[#2e2e31] p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="font-hud text-xs font-bold text-[#cfcfca] flex items-center gap-1.5">
                <Video size={13} className="text-[#00E5FF]" />
                <span>GOOGLE MEET // INSTANT VIDEO CALL</span>
              </div>
              <div className="text-[10px] text-[#6d6d69]">
                Generate a ready-to-join video conference link for executive or client meetings.
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {meetLink && (
                <a
                  href={meetLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-emerald-950/50 border border-emerald-700 text-emerald-300 text-[11px] font-mono flex items-center gap-1 truncate max-w-xs hover:underline"
                >
                  <ExternalLink size={12} />
                  <span className="truncate">{meetLink}</span>
                </a>
              )}
              <button
                onClick={handleCreateMeet}
                disabled={isCreatingMeet || !googleUser || !hasWorkspaceToken}
                className="px-3 py-1 bg-[var(--accent)] text-[#070708] font-hud font-bold text-xs hover:brightness-110 cursor-pointer disabled:opacity-40 whitespace-nowrap"
              >
                {isCreatingMeet ? 'CREATING...' : meetLink ? 'NEW MEET' : 'GENERATE MEET LINK'}
              </button>
            </div>
          </div>

          {/* Quick Workspace Creators Bar */}
          <div className="bg-[#09090b] border border-[#2e2e31] p-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div>
              <div className="font-hud text-xs font-bold text-[#cfcfca] flex items-center gap-1.5">
                <Sparkles size={13} className="text-[var(--accent)]" />
                <span>WORKSPACE ACTIONS // DOCS, SHEETS, SLIDES & KEEP</span>
              </div>
              <div className="text-[10px] text-[#6d6d69]">
                Trigger cloud-native documents or ask Maya directly: "Create a sheet for expenses", "Draft a slide deck", or "Save an idea to Keep".
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {createdResourceLink && (
                <a
                  href={createdResourceLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 bg-cyan-950/50 border border-cyan-700 text-cyan-300 text-[11px] font-mono flex items-center gap-1 truncate max-w-xs hover:underline"
                >
                  <ExternalLink size={12} />
                  <span className="truncate">Open {createdResourceLink.title}</span>
                </a>
              )}
              <button
                onClick={handleQuickCreateDoc}
                disabled={isCreatingResource || !googleUser || !hasWorkspaceToken}
                className="px-2.5 py-1 bg-[#141418] border border-[#2e2e31] hover:border-[#00E5FF] text-[#cfcfca] hover:text-[#00E5FF] text-[11px] font-hud tracking-wider cursor-pointer disabled:opacity-40"
              >
                + DOC
              </button>
              <button
                onClick={handleQuickCreateSheet}
                disabled={isCreatingResource || !googleUser || !hasWorkspaceToken}
                className="px-2.5 py-1 bg-[#141418] border border-[#2e2e31] hover:border-[#00ff66] text-[#cfcfca] hover:text-[#00ff66] text-[11px] font-hud tracking-wider cursor-pointer disabled:opacity-40"
              >
                + SHEET
              </button>
              <button
                onClick={handleQuickCreateSlide}
                disabled={isCreatingResource || !googleUser || !hasWorkspaceToken}
                className="px-2.5 py-1 bg-[#141418] border border-[#2e2e31] hover:border-amber-400 text-[#cfcfca] hover:text-amber-400 text-[11px] font-hud tracking-wider cursor-pointer disabled:opacity-40"
              >
                + SLIDES
              </button>
              <button
                onClick={handleQuickCreateKeep}
                disabled={isCreatingResource || !googleUser || !hasWorkspaceToken}
                className="px-2.5 py-1 bg-[#141418] border border-[#2e2e31] hover:border-yellow-400 text-[#cfcfca] hover:text-yellow-400 text-[11px] font-hud tracking-wider cursor-pointer disabled:opacity-40"
              >
                + KEEP NOTE
              </button>
            </div>
          </div>

          {/* Three-Column Workspace Dashboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            {/* Column 1: Google Drive */}
            <div className="bg-[#09090b] border border-[#2e2e31] p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#2e2e31]/60 pb-1.5">
                <div className="font-hud text-xs font-bold text-[#cfcfca] flex items-center gap-1.5">
                  <HardDrive size={13} className="text-amber-400" />
                  <span>GOOGLE DRIVE ({driveFiles.length})</span>
                </div>
                {isLoadingDrive && <RefreshCw size={11} className="animate-spin text-[#6d6d69]" />}
              </div>

              {driveFiles.length === 0 ? (
                <div className="text-[11px] text-[#6d6d69] py-4 text-center">
                  {!googleUser
                    ? 'Sign in with Google to access Drive files.'
                    : !hasWorkspaceToken
                    ? 'Click "RECONNECT GOOGLE WORKSPACE" above to refresh Drive session.'
                    : 'No Drive files loaded.'}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto no-scrollbar">
                  {driveFiles.map((file, fIdx) => (
                    <a
                      key={`${file.id || 'drive'}-${fIdx}`}
                      href={file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-1.5 bg-[#0e0e12] border border-[#2e2e31]/50 hover:border-[#00E5FF]/60 transition-colors"
                    >
                      <div className="text-[11px] font-semibold text-[#cfcfca] truncate">{file.name}</div>
                      <div className="text-[9px] text-[#6d6d69] flex justify-between">
                        <span>{file.mimeType.split('.').pop() || 'file'}</span>
                        {file.modifiedTime && <span>{new Date(file.modifiedTime).toLocaleDateString()}</span>}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Column 2: Gmail Inbox */}
            <div className="bg-[#09090b] border border-[#2e2e31] p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#2e2e31]/60 pb-1.5">
                <div className="font-hud text-xs font-bold text-[#cfcfca] flex items-center gap-1.5">
                  <Mail size={13} className="text-[#FF0077]" />
                  <span>GMAIL INBOX ({emails.length})</span>
                </div>
                {isLoadingEmails && <RefreshCw size={11} className="animate-spin text-[#6d6d69]" />}
              </div>

              {emails.length === 0 ? (
                <div className="text-[11px] text-[#6d6d69] py-4 text-center">
                  {!googleUser
                    ? 'Sign in with Google to view Gmail.'
                    : !hasWorkspaceToken
                    ? 'Click "RECONNECT GOOGLE WORKSPACE" above to refresh Gmail session.'
                    : 'No unread emails in inbox.'}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-64 overflow-y-auto no-scrollbar">
                  {emails.map((msg, eIdx) => (
                    <div
                      key={`${msg.id || 'email'}-${eIdx}`}
                      className="p-1.5 bg-[#0e0e12] border border-[#2e2e31]/50 hover:border-[#FF0077]/60 transition-colors"
                    >
                      <div className="text-[11px] font-semibold text-[#cfcfca] truncate">{msg.subject}</div>
                      <div className="text-[10px] text-[#00E5FF] truncate">{msg.from}</div>
                      <div className="text-[9px] text-[#6d6d69] truncate mt-0.5">{msg.snippet}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Column 3: Google Tasks */}
            <div className="bg-[#09090b] border border-[#2e2e31] p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between border-b border-[#2e2e31]/60 pb-1.5">
                <div className="font-hud text-xs font-bold text-[#cfcfca] flex items-center gap-1.5">
                  <CheckSquare size={13} className="text-emerald-400" />
                  <span>GOOGLE TASKS ({googleTasksList.length})</span>
                </div>
                {isLoadingGoogleTasks && <RefreshCw size={11} className="animate-spin text-[#6d6d69]" />}
              </div>

              {/* Add Task input */}
              <form onSubmit={handleAddGoogleTask} className="flex gap-1.5">
                <input
                  type="text"
                  value={newGoogleTaskTitle}
                  onChange={(e) => setNewGoogleTaskTitle(e.target.value)}
                  placeholder="Add to Google Tasks..."
                  disabled={!googleUser || !hasWorkspaceToken}
                  className="flex-1 bg-[#0d0d10] border border-[#2e2e31] px-2 py-1 text-[11px] text-[#cfcfca] outline-hidden focus:border-emerald-500 disabled:opacity-40"
                />
                <button
                  type="submit"
                  disabled={!googleUser || !hasWorkspaceToken}
                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-hud text-[10px] font-bold cursor-pointer disabled:opacity-40"
                >
                  ADD
                </button>
              </form>

              {googleTasksList.length === 0 ? (
                <div className="text-[11px] text-[#6d6d69] py-4 text-center">
                  {!googleUser
                    ? 'Sign in with Google to sync Tasks.'
                    : !hasWorkspaceToken
                    ? 'Click "RECONNECT GOOGLE WORKSPACE" above to refresh Tasks session.'
                    : 'No active Google tasks.'}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-56 overflow-y-auto no-scrollbar">
                  {googleTasksList.map((t, tIdx) => (
                    <div
                      key={`${t.id || 'gtask'}-${tIdx}`}
                      className="p-1.5 bg-[#0e0e12] border border-[#2e2e31]/50 flex items-center justify-between gap-2 hover:border-emerald-500/60 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-[#cfcfca] truncate">{t.title}</div>
                        {t.due && (
                          <div className="text-[9px] text-[#6d6d69]">
                            Due: {new Date(t.due).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleCompleteGoogleTask(t.id)}
                        title="Mark task completed"
                        className="p-1 text-[#6d6d69] hover:text-emerald-400 border border-transparent hover:border-emerald-800 cursor-pointer"
                      >
                        <Check size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab: CLOUD MEMORY (FIRESTORE) */}
      {currentTab === 'CLOUD_MEMORY' && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto no-scrollbar gap-3 bg-[#070708]/90 font-mono text-xs">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2e2e31]/60 pb-2">
            <div>
              <div className="font-hud text-sm font-bold text-[#cfcfca] flex items-center gap-2">
                <Database size={15} className="text-[#00E5FF]" />
                <span>MAYA CLOUD MEMORY // FIRESTORE PERSISTENCE</span>
              </div>
              <div className="text-[10px] text-[#6d6d69]">
                Private persistent cloud memory stored in Firestore database{' '}
                <span className="text-[#00E5FF]">{firebaseConfig.firestoreDatabaseId}</span>.
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#00E5FF] bg-cyan-950/40 border border-cyan-800/60 px-2 py-0.5 rounded-sm flex items-center gap-1">
                <Cloud size={11} className="text-[#00E5FF]" />
                <span>CLOUD SYNC ACTIVE</span>
              </span>
              <button
                onClick={loadCloudMemoryData}
                disabled={isLoadingCloudMemory}
                className="p-1 border border-[#2e2e31] hover:border-[#6d6d69] text-[#cfcfca] cursor-pointer"
                title="Refresh Cloud Memory"
              >
                <RefreshCw size={13} className={isLoadingCloudMemory ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* Feedback messages */}
          {cloudMemoryError && (
            <div className="p-2 bg-red-950/40 border border-red-800/60 text-red-300 text-[11px] flex items-center gap-2">
              <AlertTriangle size={14} className="text-red-400 shrink-0" />
              <span>{cloudMemoryError}</span>
            </div>
          )}
          {cloudMemorySuccess && (
            <div className="p-2 bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-[11px] flex items-center gap-2">
              <Check size={14} className="text-emerald-400 shrink-0" />
              <span>{cloudMemorySuccess}</span>
            </div>
          )}

          {/* New Cloud Memory Form */}
          <form onSubmit={handleAddCloudMemory} className="bg-[#09090b] border border-[#2e2e31] p-3 flex flex-col gap-2">
            <div className="font-hud text-xs font-bold text-[#cfcfca] flex items-center gap-1.5">
              <Plus size={13} className="text-[var(--accent)]" />
              <span>STORE NEW PRIVATE MEMORY IN CLOUD</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={newCloudKey}
                onChange={(e) => setNewCloudKey(e.target.value)}
                placeholder="Fact / Directive Label (e.g. Exam Schedule, Wifi Key)"
                className="bg-[#0d0d10] border border-[#2e2e31] px-2.5 py-1.5 text-xs text-[#cfcfca] outline-hidden focus:border-[var(--accent)]"
              />
              <input
                type="text"
                value={newCloudValue}
                onChange={(e) => setNewCloudValue(e.target.value)}
                placeholder="Memory value / details"
                className="bg-[#0d0d10] border border-[#2e2e31] px-2.5 py-1.5 text-xs text-[#cfcfca] outline-hidden focus:border-[var(--accent)]"
              />
              <div className="flex gap-2">
                <select
                  value={newCloudCategory}
                  onChange={(e) => setNewCloudCategory(e.target.value)}
                  className="bg-[#0d0d10] border border-[#2e2e31] px-2 py-1.5 text-xs text-[#cfcfca] outline-hidden focus:border-[var(--accent)]"
                >
                  <option value="personal">Personal</option>
                  <option value="project">Project</option>
                  <option value="preference">Preference</option>
                  <option value="security">Security</option>
                </select>
                <button
                  type="submit"
                  className="flex-1 px-3 py-1.5 bg-[var(--accent)] text-[#070708] font-hud font-bold text-xs hover:brightness-110 cursor-pointer"
                >
                  SAVE CLOUD
                </button>
              </div>
            </div>
          </form>

          {/* Stored Cloud Memories List */}
          <div className="bg-[#09090b] border border-[#2e2e31] p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-[#2e2e31]/60 pb-1.5">
              <div className="font-hud text-xs font-bold text-[#cfcfca]">
                STORED FIRESTORE MEMORIES ({cloudMemories.length})
              </div>
              <span className="text-[10px] text-[#6d6d69]">Encrypted at Rest</span>
            </div>

            {cloudMemories.length === 0 ? (
              <div className="text-[11px] text-[#6d6d69] py-8 text-center">
                {googleUser
                  ? 'No cloud memories stored yet. Tell Maya "Maya, remember..." or add a memory above.'
                  : 'Sign in to Google to sync and view private cloud memories.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {cloudMemories.map((mem, mIdx) => (
                  <div
                    key={`${mem.id || 'cloudmem'}-${mIdx}`}
                    className="p-2.5 bg-[#0e0e12] border border-[#2e2e31]/60 flex flex-col justify-between gap-1.5 hover:border-[#00E5FF]/60 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-[#cfcfca] text-xs">{mem.key}</span>
                        <span className="text-[9px] uppercase px-1 py-0.2 bg-[#1b1b22] text-[#00E5FF] border border-[#2e2e31]">
                          {mem.category}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#a0a0a5] mt-1 break-words">{mem.value}</div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#2e2e31]/40 text-[9px] text-[#6d6d69]">
                      <span>{new Date(mem.updatedAt).toLocaleString()}</span>
                      <button
                        onClick={() => handleDeleteCloudMemory(mem.id)}
                        className="text-[#6d6d69] hover:text-[#c4524f] cursor-pointer"
                        title="Delete from Firestore"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: SEARCH GROUNDING */}
      {currentTab === 'SEARCH' && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto no-scrollbar gap-3 bg-[#070708]/90 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#2e2e31]/60 pb-2">
            <div>
              <div className="font-hud text-sm font-bold text-[#cfcfca]">GOOGLE SEARCH GROUNDING</div>
              <div className="text-[10px] text-[#6d6d69]">
                Live web retrieval with verified citations and structured source attribution.
              </div>
            </div>
            <Search size={16} className="text-[var(--accent)]" />
          </div>

          <form onSubmit={handleRunSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search current events, CVE vulnerabilities, tech specs..."
              className="flex-1 bg-[#0d0d10] border border-[#2e2e31] px-3 py-1.5 text-xs text-[#cfcfca] outline-hidden focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="px-4 py-1.5 bg-[var(--accent)] text-[#070708] font-hud font-bold text-xs hover:brightness-110 cursor-pointer disabled:opacity-50"
            >
              {isSearching ? 'SEARCHING...' : 'DISPATCH'}
            </button>
          </form>

          {searchResults && (
            <div className="space-y-3 bg-[#09090b] border border-[#2e2e31] p-3">
              <div className="text-[11px] text-[#6d6d69]">QUERY: &quot;{searchResults.query}&quot;</div>
              <div className="text-[#cfcfca] leading-relaxed whitespace-pre-wrap">{searchResults.answer}</div>

              {searchResults.sources.length > 0 && (
                <div className="pt-2 border-t border-[#2e2e31]/60 space-y-1.5">
                  <span className="font-hud text-[11px] text-[#6d6d69] tracking-wider">GROUNDED SOURCES</span>
                  <div className="space-y-1">
                    {searchResults.sources.map((s, idx) => (
                      <a
                        key={idx}
                        href={s.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between p-1.5 bg-[#0e0e11] border border-[#2e2e31]/50 hover:border-[var(--accent)] transition-colors group"
                      >
                        <span className="text-[#cfcfca] group-hover:text-[var(--accent)] truncate max-w-[85%]">
                          {s.title}
                        </span>
                        <ExternalLink size={12} className="text-[#6d6d69] group-hover:text-[var(--accent)]" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: TRANSCRIBE */}
      {currentTab === 'TRANSCRIBE' && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto no-scrollbar gap-3 bg-[#070708]/90 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#2e2e31]/60 pb-2">
            <div>
              <div className="font-hud text-sm font-bold text-[#cfcfca]">GEMINI AUDIO TRANSCRIBER</div>
              <div className="text-[10px] text-[#6d6d69]">
                Verbatim transcription powered by gemini-3.5-transcribe with copy and file export.
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Upload File */}
            <div className="bg-[#09090b] border border-[#2e2e31] p-3 flex flex-col gap-2">
              <span className="font-hud text-xs text-[#cfcfca] font-bold">1. UPLOAD AUDIO CLIP</span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                className="text-[10px] text-[#6d6d69] file:mr-2 file:py-1 file:px-2 file:border-0 file:bg-[#1f1f23] file:text-[#cfcfca] file:font-hud file:cursor-pointer"
              />
              {transcribeFileName && (
                <div className="text-[10px] text-[var(--accent)] truncate">FILE: {transcribeFileName}</div>
              )}
            </div>

            {/* Direct Record */}
            <div className="bg-[#09090b] border border-[#2e2e31] p-3 flex flex-col gap-2">
              <span className="font-hud text-xs text-[#cfcfca] font-bold">2. DIRECT MIC RECORD</span>
              <button
                onClick={toggleTranscribeRecording}
                className={`py-1.5 px-3 font-hud text-xs font-bold transition-all cursor-pointer ${
                  isRecordingTranscribe
                    ? 'bg-[#c4524f] text-white animate-pulse'
                    : 'bg-[#1a1a1e] text-[#cfcfca] hover:bg-[#25252b]'
                }`}
              >
                {isRecordingTranscribe ? 'STOP RECORDING' : 'START RECORDING'}
              </button>
            </div>
          </div>

          <button
            onClick={handleTranscribeAudio}
            disabled={!transcribeAudioBase64 || isTranscribing}
            className="w-full py-2 bg-[var(--accent)] text-[#070708] font-hud font-bold text-xs tracking-wider hover:brightness-110 cursor-pointer disabled:opacity-40"
          >
            {isTranscribing ? 'PROCESSING AUDIO WITH GEMINI...' : 'TRANSCRIBE AUDIO DATA'}
          </button>

          {transcriptionResult && (
            <div className="bg-[#09090b] border border-[#2e2e31] p-3 flex flex-col gap-2 flex-1">
              <div className="flex items-center justify-between border-b border-[#2e2e31]/40 pb-1.5">
                <span className="font-hud text-xs text-[#6d6d69]">TRANSCRIPT OUTPUT</span>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyTranscription}
                    className="flex items-center gap-1 text-[10px] text-[#cfcfca] hover:text-[var(--accent)] cursor-pointer"
                  >
                    {copiedTranscribe ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedTranscribe ? 'COPIED' : 'COPY'}</span>
                  </button>
                  <button
                    onClick={handleDownloadTranscription}
                    className="flex items-center gap-1 text-[10px] text-[#cfcfca] hover:text-[var(--accent)] cursor-pointer"
                  >
                    <Download size={12} />
                    <span>DOWNLOAD .TXT</span>
                  </button>
                </div>
              </div>
              <div className="p-2 bg-[#070708] border border-[#2e2e31]/40 text-[#cfcfca] leading-relaxed whitespace-pre-wrap flex-1 overflow-y-auto no-scrollbar">
                {transcriptionResult}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: TASKS & NOTES */}
      {currentTab === 'TASKS' && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto no-scrollbar gap-3 bg-[#070708]/90 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#2e2e31]/60 pb-2">
            <div>
              <div className="font-hud text-sm font-bold text-[#cfcfca]">TACTICAL TASKS & NOTES</div>
              <div className="text-[10px] text-[#6d6d69]">
                Persistent ASC project deliverables, reminders, and classified logs.
              </div>
            </div>
            <div className="flex gap-1 text-[10px] font-hud">
              {(['ALL', 'ACTIVE', 'DONE'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTaskFilter(filter)}
                  className={`px-2 py-0.5 cursor-pointer ${
                    taskFilter === filter
                      ? 'bg-[var(--accent)] text-[#070708] font-bold'
                      : 'bg-[#141417] text-[#6d6d69]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* New Task Row */}
          <div className="flex gap-2 bg-[#09090b] p-2 border border-[#2e2e31]/60">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Add actionable task for Sirius..."
              className="flex-1 bg-transparent border-b border-[#2e2e31] px-2 py-1 text-xs text-[#cfcfca] outline-hidden focus:border-[var(--accent)]"
            />
            <select
              value={newTaskPriority}
              onChange={(e: any) => setNewTaskPriority(e.target.value)}
              className="bg-[#141418] border border-[#2e2e31] px-2 py-1 text-[10px] text-[#cfcfca] outline-hidden"
            >
              <option value="high">HIGH</option>
              <option value="medium">MEDIUM</option>
              <option value="low">LOW</option>
            </select>
            <button
              onClick={() => {
                if (newTaskTitle.trim()) {
                  onAddTask(newTaskTitle.trim(), newTaskPriority, newTaskDue);
                  setNewTaskTitle('');
                }
              }}
              className="px-3 py-1 bg-[var(--accent)] text-[#070708] font-hud font-bold text-xs hover:brightness-110 cursor-pointer"
            >
              ADD
            </button>
          </div>

          {/* Task List */}
          <div className="space-y-1.5">
            {filteredTasks.map((t, taskIdx) => (
              <div
                key={`${t.id || 'task'}-${taskIdx}`}
                className="flex items-center justify-between bg-[#09090b] border border-[#2e2e31]/60 px-3 py-2 hover:border-[var(--accent)]/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleTask(t.id)}
                    className={`w-4 h-4 border flex items-center justify-center cursor-pointer ${
                      t.completed
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-[#070708]'
                        : 'border-[#46464a]'
                    }`}
                  >
                    {t.completed && <Check size={12} />}
                  </button>
                  <span
                    className={`text-xs ${
                      t.completed ? 'line-through text-[#6d6d69]' : 'text-[#cfcfca]'
                    }`}
                  >
                    {t.title}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 border font-hud ${
                      t.priority === 'high'
                        ? 'border-[#c4524f] text-[#c4524f]'
                        : t.priority === 'med' || (t.priority as string) === 'medium'
                        ? 'border-[#e6c27a] text-[#e6c27a]'
                        : 'border-[#6d6d69] text-[#6d6d69]'
                    }`}
                  >
                    {t.priority.toUpperCase()}
                  </span>
                  <button
                    onClick={() => onDeleteTask(t.id)}
                    className="text-[#6d6d69] hover:text-[#c4524f] cursor-pointer"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Notes Section */}
          <div className="pt-2 border-t border-[#2e2e31]/60">
            <span className="font-hud text-xs font-bold text-[#6d6d69] tracking-wider">
              SAVED MEMORY NOTES ({notes.length})
            </span>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {notes.map((n, noteIdx) => (
                <div
                  key={`${n.id || 'note'}-${noteIdx}`}
                  className="bg-[#09090b] border border-[#2e2e31]/60 p-2 flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-[#cfcfca] text-[11px] truncate">{n.title}</span>
                    <button
                      onClick={() => onDeleteNote(n.id)}
                      className="text-[#6d6d69] hover:text-[#c4524f] cursor-pointer"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                  <div className="text-[10px] text-[#6d6d69] mt-1 line-clamp-2">{n.content}</div>
                  <div className="flex justify-between items-center mt-2 pt-1 border-t border-[#2e2e31]/30 text-[9px] text-[#46464a]">
                    <span>#{n.tag}</span>
                    <span>{new Date(n.timestamp).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: SYSTEM LOG */}
      {currentTab === 'LOG' && (
        <div className="flex-1 flex flex-col p-3 overflow-hidden bg-[#070708]/90 font-mono text-xs">
          <div className="flex items-center justify-between border-b border-[#2e2e31]/60 pb-2 mb-2">
            <div>
              <div className="font-hud text-sm font-bold text-[#cfcfca]">AXIOM SYSTEM AUDIT LOG</div>
              <div className="text-[10px] text-[#6d6d69]">
                Real-time daemon events, wake captures, security elevations, and tool bridge dispatches.
              </div>
            </div>
            <span className="text-[10px] text-[var(--accent)] font-mono">{systemLogs.length} EVENTS</span>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar space-y-1 pr-1 font-mono text-[11px]">
            {systemLogs.map((log, index) => {
              const isError = log.includes('ERROR') || log.includes('BLOCKED');
              const isWake = log.includes('WAKE');
              const isShift = log.includes('SHIFT');
              return (
                <div
                  key={index}
                  className={`p-1 border-l-2 bg-[#09090b]/40 ${
                    isError
                      ? 'border-[#c4524f] text-[#c4524f]'
                      : isWake
                      ? 'border-[var(--accent)] text-[var(--accent)]'
                      : isShift
                      ? 'border-[#e6c27a] text-[#e6c27a]'
                      : 'border-[#2e2e31] text-[#cfcfca]'
                  }`}
                >
                  {log}
                </div>
              );
            })}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};
