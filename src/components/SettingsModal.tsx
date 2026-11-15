import React, { useState, useEffect } from 'react';
import { WakeSensitivity } from '../wake/types';
import { AppSettings } from '../types';
import {
  X,
  Volume2,
  Mic,
  ShieldAlert,
  Cpu,
  Heart,
  Bell,
  Moon,
  Clock,
  Cloud,
  Send,
  Trash2,
  RefreshCw,
  Smartphone,
  Check,
  AlertCircle,
  Key,
  Shield,
  Fingerprint,
  ShieldCheck,
} from 'lucide-react';
import { PushNotificationService, PushStatus } from '../services/pushNotificationService';
import { ServerSyncService } from '../services/serverSyncService';
import { VoiceprintEngine } from '../voice/voiceprintEngine';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  wakeState: string;
  heardText: string;
  isKillSwitchActive: boolean;
  onToggleKillSwitch: () => void;
  reduceMotion: boolean;
  onToggleReduceMotion: () => void;
  activeSkinId?: 'ash' | 'stark';
  onChangeSkin?: (skinId: 'ash' | 'stark') => void;
  onOpenRelationshipMemory?: () => void;
  onOpenVoiceEnrollment?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  wakeState,
  heardText,
  isKillSwitchActive,
  onToggleKillSwitch,
  reduceMotion,
  onToggleReduceMotion,
  activeSkinId = 'ash',
  onChangeSkin,
  onOpenRelationshipMemory,
  onOpenVoiceEnrollment,
}) => {
  const [testMode, setTestMode] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>('loading');
  const [pushActionMsg, setPushActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isTestingPush, setIsTestingPush] = useState(false);
  const [isPurgingData, setIsPurgingData] = useState(false);

  // Check iOS Safari standalone state
  const isIosSafari =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent) &&
    !(window as any).MSStream &&
    !(navigator as any).standalone;

  useEffect(() => {
    let mounted = true;
    PushNotificationService.getStatus().then((status) => {
      if (mounted) setPushStatus(status);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleTogglePush = async () => {
    const backendUrl = settings.backendUrl || window.location.origin;
    const backendToken = settings.backendToken || 'maya_sec_c08b49e35f8d42398b71d9a04a6012e8';

    if (pushStatus === 'subscribed') {
      setIsSubscribing(true);
      setPushActionMsg(null);
      const res = await PushNotificationService.unsubscribe(backendUrl, backendToken);
      setIsSubscribing(false);
      if (res.ok) {
        setPushStatus('unsubscribed');
        onUpdateSettings({ pushEnabled: false });
        setPushActionMsg({ type: 'success', text: 'Background push notifications unsubscribed.' });
      } else {
        setPushActionMsg({ type: 'error', text: res.error || 'Failed to unsubscribe.' });
      }
    } else {
      setIsSubscribing(true);
      setPushActionMsg(null);
      const res = await PushNotificationService.subscribe(backendUrl, backendToken);
      setIsSubscribing(false);
      if (res.ok) {
        setPushStatus('subscribed');
        onUpdateSettings({ pushEnabled: true });
        setPushActionMsg({ type: 'success', text: 'Web Push active! Maya will reach you even when tab is closed.' });
      } else {
        setPushActionMsg({ type: 'error', text: res.error || 'Subscription failed.' });
      }
    }
  };

  const handleSendTestPush = async () => {
    const backendUrl = settings.backendUrl || window.location.origin;
    const backendToken = settings.backendToken || 'maya_sec_c08b49e35f8d42398b71d9a04a6012e8';

    setIsTestingPush(true);
    setPushActionMsg(null);
    const res = await PushNotificationService.sendTestPush(backendUrl, backendToken);
    setIsTestingPush(false);
    if (res.ok) {
      setPushActionMsg({ type: 'success', text: res.message || 'Test notification dispatched to your device!' });
    } else {
      setPushActionMsg({ type: 'error', text: res.error || 'Failed to dispatch test notification.' });
    }
  };

  const handlePurgeServerData = async () => {
    if (!window.confirm('Are you sure you want to delete all tasks, reminders, subscriptions, and logs from the server?')) {
      return;
    }
    const backendUrl = settings.backendUrl || window.location.origin;
    const backendToken = settings.backendToken || 'maya_sec_c08b49e35f8d42398b71d9a04a6012e8';

    setIsPurgingData(true);
    setPushActionMsg(null);
    const res = await ServerSyncService.purgeServerData(backendUrl, backendToken);
    setIsPurgingData(false);
    if (res.ok) {
      setPushActionMsg({ type: 'success', text: 'All server-side data wiped successfully.' });
    } else {
      setPushActionMsg({ type: 'error', text: res.error || 'Failed to purge data.' });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="bg-[#0d0d0f] border border-[#2e2e31] max-w-xl w-full p-5 font-mono text-xs flex flex-col gap-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2e2e31] pb-2">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
            <span className="font-hud text-sm font-bold tracking-wider text-[#cfcfca]">
              SYSTEM PREFERENCES // CONFIGURATION
            </span>
          </div>
          <button onClick={onClose} className="text-[#6d6d69] hover:text-[#cfcfca] cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto no-scrollbar pr-1">
          {/* Action Feedback Banner */}
          {pushActionMsg && (
            <div
              className={`p-2.5 border text-[11px] flex items-center justify-between gap-2 ${
                pushActionMsg.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                  : 'bg-red-950/40 border-red-800/60 text-red-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {pushActionMsg.type === 'success' ? (
                  <Check size={14} className="text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle size={14} className="text-red-400 shrink-0" />
                )}
                <span>{pushActionMsg.text}</span>
              </div>
              <button
                onClick={() => setPushActionMsg(null)}
                className="text-[10px] opacity-70 hover:opacity-100 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* iOS Safari Home Screen Notice */}
          {isIosSafari && (
            <div className="p-2.5 bg-amber-950/40 border border-amber-800/60 text-amber-200 text-[11px] space-y-1">
              <div className="font-hud font-bold flex items-center gap-1.5">
                <Smartphone size={13} className="text-amber-400" />
                <span>IOS SAFARI NOTICE // WEB PUSH REQUIREMENT</span>
              </div>
              <p className="text-[10px] text-amber-300/80 leading-relaxed">
                On iPhone & iPad, Web Push notifications only operate when Maya is installed to your Home Screen. Tap the Safari Share button <span className="font-bold">⎋</span> and select <span className="font-bold">&quot;Add to Home Screen&quot;</span>, then launch Maya from your home screen icon.
              </p>
            </div>
          )}

          {/* 1. BACKGROUND WEB PUSH & SERVER SOURCE OF TRUTH */}
          <div className="bg-[#09090b] p-3 border border-[#2e2e31] space-y-3">
            <div className="flex items-center justify-between border-b border-[#2e2e31]/60 pb-2">
              <span className="font-hud text-xs text-[#cfcfca] font-bold flex items-center gap-1.5">
                <Cloud size={14} className="text-[#00E5FF]" />
                BACKGROUND WEB PUSH // TIME ENGINE &amp; SOURCE OF TRUTH
              </span>
              <span
                className={`text-[9px] px-2 py-0.5 border font-mono font-bold ${
                  pushStatus === 'subscribed'
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                    : pushStatus === 'blocked'
                    ? 'bg-red-950/40 border-red-800 text-red-400'
                    : pushStatus === 'unsupported'
                    ? 'bg-neutral-900 border-neutral-700 text-neutral-500'
                    : 'bg-amber-950/40 border-amber-800 text-amber-400'
                }`}
              >
                {pushStatus === 'subscribed' && '● PUSH ACTIVE'}
                {pushStatus === 'unsubscribed' && '○ NOT SUBSCRIBED'}
                {pushStatus === 'blocked' && '✕ PERMISSION BLOCKED'}
                {pushStatus === 'unsupported' && 'UNSUPPORTED'}
                {pushStatus === 'loading' && 'CHECKING...'}
              </span>
            </div>

            <p className="text-[10px] text-[#6d6d69] leading-relaxed">
              Enables Maya to reach you via lock-screen Web Push with VAPID keys even when the browser and tab are fully closed, governed by the server-side cron scheduler.
            </p>

            {/* Backend URL & Secret Token */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <label className="text-[10px] text-[#6d6d69] flex items-center gap-1">
                  <Cloud size={11} className="text-[#00E5FF]" />
                  BACKEND SERVER URL
                </label>
                <input
                  type="text"
                  value={settings.backendUrl ?? ''}
                  onChange={(e) => onUpdateSettings({ backendUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-[#0d0d10] border border-[#2e2e31] px-2.5 py-1 text-xs text-[#cfcfca] outline-hidden focus:border-[var(--accent)] font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-[#6d6d69] flex items-center gap-1">
                  <Key size={11} className="text-[var(--accent)]" />
                  SERVER BEARER TOKEN
                </label>
                <input
                  type="password"
                  value={settings.backendToken ?? ''}
                  onChange={(e) => onUpdateSettings({ backendToken: e.target.value })}
                  placeholder="Secret token"
                  className="w-full bg-[#0d0d10] border border-[#2e2e31] px-2.5 py-1 text-xs text-[#cfcfca] outline-hidden focus:border-[var(--accent)] font-mono"
                />
              </div>
            </div>

            {/* Push Action Controls */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleTogglePush}
                disabled={isSubscribing || pushStatus === 'blocked' || pushStatus === 'unsupported'}
                className={`px-3 py-1.5 font-hud text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all ${
                  pushStatus === 'subscribed'
                    ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    : 'bg-[#00E5FF] text-[#070708] hover:brightness-110 shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                }`}
              >
                <Bell size={13} />
                {isSubscribing
                  ? 'COMMUNICATING...'
                  : pushStatus === 'subscribed'
                  ? 'DISABLE BACKGROUND PUSH'
                  : 'ENABLE BACKGROUND REMINDERS'}
              </button>

              <button
                onClick={handleSendTestPush}
                disabled={isTestingPush || pushStatus !== 'subscribed'}
                className="px-3 py-1.5 bg-[#141418] border border-[#2e2e31] hover:border-[#6d6d69] text-[#cfcfca] font-hud text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Send size={12} className={isTestingPush ? 'animate-pulse' : ''} />
                {isTestingPush ? 'DISPATCHING...' : 'SEND TEST NOTIFICATION'}
              </button>
            </div>

            {/* Privacy & AI Proxy Toggles */}
            <div className="pt-2 border-t border-[#2e2e31]/40 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="flex items-center justify-between bg-[#0d0d10] p-2 border border-[#2e2e31]">
                <div className="space-y-0.5 pr-2">
                  <span className="text-[11px] text-[#cfcfca] font-medium block">Private Lock Screen</span>
                  <span className="text-[9px] text-[#6d6d69] block">Hides task titles on lock screen</span>
                </div>
                <button
                  onClick={() => onUpdateSettings({ privateNotifications: !settings.privateNotifications })}
                  className={`px-2.5 py-1 font-hud text-[10px] font-bold cursor-pointer ${
                    settings.privateNotifications ? 'bg-[var(--accent)] text-[#070708]' : 'bg-[#1a1a20] text-[#6d6d69]'
                  }`}
                >
                  {settings.privateNotifications ? 'PRIVATE' : 'STANDARD'}
                </button>
              </div>

              <div className="flex items-center justify-between bg-[#0d0d10] p-2 border border-[#2e2e31]">
                <div className="space-y-0.5 pr-2">
                  <span className="text-[11px] text-[#cfcfca] font-medium block">Use Server AI Proxy</span>
                  <span className="text-[9px] text-[#6d6d69] block">Calls Gemini via server secret</span>
                </div>
                <button
                  onClick={() => onUpdateSettings({ useServerProxy: !settings.useServerProxy })}
                  className={`px-2.5 py-1 font-hud text-[10px] font-bold cursor-pointer ${
                    settings.useServerProxy !== false ? 'bg-[#00E5FF] text-[#070708]' : 'bg-[#1a1a20] text-[#6d6d69]'
                  }`}
                >
                  {settings.useServerProxy !== false ? 'ACTIVE' : 'DIRECT CLIENT'}
                </button>
              </div>
            </div>
          </div>

          {/* 2. ADAPTIVE FRIENDLY CHECK-INS (WHEN INACTIVE) */}
          <div className="bg-[#09090b] p-3 border border-[#2e2e31] space-y-3">
            <div className="flex items-center justify-between border-b border-[#2e2e31]/60 pb-2">
              <span className="font-hud text-xs text-[#cfcfca] font-bold flex items-center gap-1.5">
                <Heart size={14} className="text-[#e3a1b0]" />
                ADAPTIVE CHECK-INS // ACCOUNTABILITY COACH
              </span>
              <button
                onClick={() => onUpdateSettings({ checkInFrequency: settings.checkInFrequency === 'off' ? 'normal' : 'off' })}
                className={`px-2.5 py-0.5 font-hud text-[10px] font-bold cursor-pointer ${
                  settings.checkInFrequency !== 'off'
                    ? 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                    : 'bg-neutral-900 border border-neutral-700 text-neutral-500'
                }`}
              >
                {settings.checkInFrequency !== 'off' ? 'ENABLED' : 'PAUSED'}
              </button>
            </div>

            <p className="text-[10px] text-[#6d6d69] leading-relaxed">
              When you have not interacted with Maya for a while, the server composes an upbeat, supportive accountability check-in referencing your real open tasks. Backs off adaptively if ignored.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <div className="space-y-1 bg-[#0d0d10] p-2 border border-[#2e2e31]">
                <label className="text-[10px] text-[#6d6d69] block">SILENCE THRESHOLD</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={settings.hoursOfSilence ?? 4}
                    onChange={(e) => onUpdateSettings({ hoursOfSilence: parseInt(e.target.value, 10) || 4 })}
                    className="w-16 bg-[#141418] border border-[#2e2e31] px-2 py-1 text-xs text-[#cfcfca] font-mono text-center"
                  />
                  <span className="text-[10px] text-[#cfcfca]">hours</span>
                </div>
              </div>

              <div className="space-y-1 bg-[#0d0d10] p-2 border border-[#2e2e31]">
                <label className="text-[10px] text-[#6d6d69] block">DAILY MAX CAP</label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={settings.maxCheckinsPerDay ?? 3}
                    onChange={(e) => onUpdateSettings({ maxCheckinsPerDay: parseInt(e.target.value, 10) || 3 })}
                    className="w-16 bg-[#141418] border border-[#2e2e31] px-2 py-1 text-xs text-[#cfcfca] font-mono text-center"
                  />
                  <span className="text-[10px] text-[#cfcfca]">pushes/day</span>
                </div>
              </div>

              <div className="space-y-1 bg-[#0d0d10] p-2 border border-[#2e2e31]">
                <label className="text-[10px] text-[#6d6d69] block">COACHING TONE</label>
                <div className="flex gap-1 pt-0.5">
                  {(['friendly', 'firm'] as const).map((tone) => (
                    <button
                      key={tone}
                      onClick={() => onUpdateSettings({ checkinsTone: tone })}
                      className={`flex-1 py-1 font-hud text-[10px] uppercase font-bold cursor-pointer ${
                        (settings.checkinsTone || 'friendly') === tone
                          ? 'bg-[var(--accent)] text-[#070708]'
                          : 'bg-[#141418] text-[#6d6d69]'
                      }`}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-[#6d6d69]">Mute check-ins for the rest of today:</span>
              <button
                onClick={() => onUpdateSettings({ muteCheckinsToday: !settings.muteCheckinsToday })}
                className={`px-3 py-1 font-hud text-[10px] font-bold cursor-pointer ${
                  settings.muteCheckinsToday ? 'bg-[#c4524f] text-white' : 'bg-[#141418] text-[#6d6d69]'
                }`}
              >
                {settings.muteCheckinsToday ? 'MUTED TODAY' : 'UNMUTED'}
              </button>
            </div>
          </div>

          {/* 3. PRIVACY & SERVER DATA PURGE */}
          <div className="bg-[#09090b] p-3 border border-[#2e2e31] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-hud text-xs text-[#cfcfca] font-bold flex items-center gap-1.5">
                <Shield size={14} className="text-[var(--accent)]" />
                DATA MINIMIZATION &amp; SERVER PRIVACY
              </span>
              <button
                onClick={handlePurgeServerData}
                disabled={isPurgingData}
                className="px-3 py-1 bg-red-950/40 border border-red-800 text-red-300 hover:bg-red-900/60 font-hud text-[10px] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Trash2 size={12} />
                {isPurgingData ? 'PURGING...' : 'PURGE ALL SERVER DATA'}
              </button>
            </div>
            <p className="text-[10px] text-[#6d6d69]">
              Instantly deletes all push subscriptions, SQLite tasks, reminders, activity logs, and briefing history from the backend database.
            </p>
          </div>

          {/* 4. VOICE BIOMETRICS & SPEAKER VERIFICATION */}
          <div className="bg-[#09090b] p-3 border border-[#2e2e31] space-y-3">
            <div className="flex items-center justify-between border-b border-[#2e2e31]/60 pb-2">
              <span className="font-hud text-xs text-[#cfcfca] font-bold flex items-center gap-1.5">
                <Fingerprint size={14} className="text-[#00E5FF]" />
                VOICE BIOMETRICS // SPEAKER LOCK
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[9px] px-2 py-0.5 border font-mono font-bold ${
                    VoiceprintEngine.hasProfile()
                      ? 'bg-emerald-950/40 border-emerald-800 text-emerald-400'
                      : 'bg-amber-950/40 border-amber-800 text-amber-400'
                  }`}
                >
                  {VoiceprintEngine.hasProfile() ? '● ENROLLED (SIRIUS)' : '○ NOT CALIBRATED'}
                </span>
                <button
                  onClick={() => onUpdateSettings({ voiceLockEnabled: settings.voiceLockEnabled === false ? true : false })}
                  className={`px-2.5 py-0.5 font-hud text-[10px] font-bold cursor-pointer ${
                    settings.voiceLockEnabled !== false
                      ? 'bg-[var(--accent)] text-[#070708]'
                      : 'bg-[#141418] text-[#6d6d69]'
                  }`}
                >
                  {settings.voiceLockEnabled !== false ? 'ACTIVE' : 'BYPASS'}
                </button>
              </div>
            </div>

            <p className="text-[10px] text-[#6d6d69] leading-relaxed">
              When enabled, Maya verifies fundamental frequency (F0 pitch), vocal tract formants (F1, F2), and harmonic centroid in real time. She answers exclusively to your voice. Any unauthorized speaker is blocked and verbally refused: <span className="text-[#cfcfca] italic">&quot;Voice unverified, Sirius only.&quot;</span>
            </p>

            {/* Sensitivity Threshold Selection */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-[#6d6d69]">Verification Sensitivity:</span>
              <div className="flex gap-1">
                {[
                  { val: 60, label: 'LOOSE (60%)' },
                  { val: 70, label: 'BALANCED (70%)' },
                  { val: 80, label: 'STRICT (80%)' },
                ].map((item) => (
                  <button
                    key={item.val}
                    onClick={() => onUpdateSettings({ voiceLockSensitivity: item.val })}
                    className={`px-2 py-1 font-hud text-[10px] font-bold cursor-pointer ${
                      (settings.voiceLockSensitivity ?? 70) === item.val
                        ? 'bg-[#00E5FF] text-[#070708]'
                        : 'bg-[#141418] text-[#6d6d69] hover:text-[#cfcfca]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1 border-t border-[#2e2e31]/40">
              <button
                onClick={() => onOpenVoiceEnrollment && onOpenVoiceEnrollment()}
                className="flex-1 py-1.5 bg-[#00E5FF] text-[#070708] font-hud text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:brightness-110 shadow-[0_0_10px_rgba(0,229,255,0.25)]"
              >
                <ShieldCheck size={13} />
                <span>{VoiceprintEngine.hasProfile() ? 'RE-CALIBRATE 3-PHRASE VOICEPRINT' : 'START 3-PHRASE VOICE ENROLLMENT'}</span>
              </button>
              {VoiceprintEngine.hasProfile() && (
                <button
                  onClick={() => {
                    VoiceprintEngine.clearProfile();
                    setPushActionMsg({ type: 'success', text: 'Voiceprint profile cleared.' });
                  }}
                  className="px-3 py-1.5 bg-neutral-900 border border-[#2e2e31] hover:border-red-800 hover:text-red-300 text-[#6d6d69] font-hud text-xs cursor-pointer"
                  title="Clear voiceprint profile"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Affection Level & Emotional Depth */}
          <div className="bg-[#09090b] p-3 border border-[#2e2e31] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-hud text-xs text-[#cfcfca] font-bold flex items-center gap-1.5">
                <Heart size={14} className="text-[#e3a1b0]" />
                AFFECTION & EMOTIONAL DEPTH
              </span>
              <span className="text-[10px] text-[var(--accent)]">
                {settings.affectionLevel === 0 && 'OFF (STRICT BUSINESS)'}
                {settings.affectionLevel === 1 && 'FRIENDLY'}
                {settings.affectionLevel === 2 && 'WARM (PARTNER-IN-CRIME)'}
                {settings.affectionLevel === 3 && 'EXTRA AFFECTIONATE'}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 pt-1">
              {[
                { lvl: 0 as const, label: '0: OFF' },
                { lvl: 1 as const, label: '1: FRIENDLY' },
                { lvl: 2 as const, label: '2: WARM' },
                { lvl: 3 as const, label: '3: DEVOTED' },
              ].map((item) => (
                <button
                  key={item.lvl}
                  onClick={() => onUpdateSettings({ affectionLevel: item.lvl })}
                  className={`py-1 font-hud text-[10px] cursor-pointer text-center ${
                    settings.affectionLevel === item.lvl
                      ? 'bg-[var(--accent)] text-[#070708] font-bold'
                      : 'bg-[#141418] text-[#6d6d69] hover:text-[#cfcfca]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[#6d6d69]">
              Controls Maya&apos;s personal closeness with Sirius: playful teasing, soft reactions to compliments, and empathy-first responses.
            </p>
            {onOpenRelationshipMemory && (
              <div className="pt-2 border-t border-[#2e2e31]/60 flex justify-between items-center">
                <span className="text-[10px] text-[#cfcfca]">Private Nicknames, Milestones &amp; Jokes:</span>
                <button
                  onClick={onOpenRelationshipMemory}
                  className="px-2.5 py-1 bg-[#1a1a20] hover:bg-[#25252d] text-[var(--accent)] font-hud text-[10px] font-bold cursor-pointer"
                >
                  MANAGE RELATIONSHIP MEMORY
                </button>
              </div>
            )}
          </div>

          {/* Proactive Check-Ins & 15-Min Adaptive Inactivity Monitor */}
          <div className="surface-card p-3.5 border border-white/[0.08] rounded-lg space-y-3 shadow-sm">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
              <span className="font-hud text-xs text-[#EDEDED] font-bold flex items-center gap-1.5">
                <Bell size={14} className="text-[#00E5FF]" />
                PROACTIVE CHECK-INS // 15-MIN ADAPTIVE MONITOR
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] px-2 py-0.5 border font-mono font-bold bg-cyan-950/40 border-[#00E5FF]/40 text-[#00E5FF] rounded">
                  ● EVERY {settings.inactivityCheckIntervalMinutes || 15}M INACTIVITY
                </span>
                <span className="text-[10px] text-[#00E5FF] uppercase font-mono font-bold">{settings.checkInFrequency}</span>
              </div>
            </div>

            {/* Inactivity Cadence Selection */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-[#EDEDED] font-mono">Inactivity Interval:</span>
              <div className="flex flex-wrap gap-1">
                {[
                  { mins: 5, label: '5 MINS' },
                  { mins: 10, label: '10 MINS' },
                  { mins: 15, label: '15 MINS (DEFAULT)' },
                  { mins: 20, label: '20 MINS' },
                  { mins: 30, label: '30 MINS' },
                ].map((item) => (
                  <button
                    key={item.mins}
                    onClick={() => onUpdateSettings({ inactivityCheckIntervalMinutes: item.mins })}
                    className={`px-2.5 py-1 font-hud text-[10px] font-bold rounded interactive-hover cursor-pointer ${
                      (settings.inactivityCheckIntervalMinutes || 15) === item.mins
                        ? 'bg-[#00E5FF] text-[#0A0A0A] neon-glow'
                        : 'bg-[#141418] text-[#9E9E9E] hover:text-[#EDEDED] border border-white/[0.05]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Check-in Frequency */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-[#9E9E9E]">Check-in State:</span>
              <div className="flex gap-1">
                {(['off', 'low', 'normal'] as const).map((freq) => (
                  <button
                    key={freq}
                    onClick={() => onUpdateSettings({ checkInFrequency: freq })}
                    className={`px-2.5 py-0.5 font-hud text-[10px] uppercase rounded interactive-hover cursor-pointer ${
                      settings.checkInFrequency === freq
                        ? 'bg-[#00E5FF] text-[#0A0A0A] font-bold neon-glow'
                        : 'bg-[#141418] text-[#9E9E9E] border border-white/[0.05]'
                    }`}
                  >
                    {freq}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[10px] text-[#9E9E9E] leading-relaxed">
              Every 15 minutes of inactivity (keyboard/mouse/voice idle), Maya delivers an adaptive, context-aware check-in customized to your active ASC projects, open deadlines, and current time of day. Moving the mouse, typing, or speaking resets the inactivity timer.
            </p>

            {/* Manual Test Trigger */}
            <div className="pt-2 border-t border-white/[0.08] flex justify-between items-center">
              <span className="text-[10px] text-[#EDEDED]">Test Inactivity Response:</span>
              <button
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('maya-test-inactivity-checkin', {
                      detail: { minutes: settings.inactivityCheckIntervalMinutes || 15 },
                    })
                  );
                  setPushActionMsg({
                    type: 'success',
                    text: `Triggered ${settings.inactivityCheckIntervalMinutes || 15}-min adaptive check-in. Maya is speaking.`,
                  });
                }}
                className="px-3 py-1 bg-[#1E1E1E] border border-[#00E5FF]/40 text-[#00E5FF] hover:border-[#00E5FF] rounded interactive-hover font-hud text-[10px] font-bold cursor-pointer"
              >
                TRIGGER {settings.inactivityCheckIntervalMinutes || 15}M TEST
              </button>
            </div>
          </div>

          {/* Quiet Hours & Do Not Disturb */}
          <div className="bg-[#09090b] p-3 border border-[#2e2e31] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-hud text-xs text-[#cfcfca] font-bold flex items-center gap-1.5">
                <Moon size={14} className="text-[var(--accent)]" />
                QUIET HOURS &amp; DO NOT DISTURB
              </span>
              <button
                onClick={() => onUpdateSettings({ dndEnabled: !settings.dndEnabled })}
                className={`px-2.5 py-0.5 font-hud text-[10px] font-bold cursor-pointer ${
                  settings.dndEnabled ? 'bg-[#c4524f] text-white' : 'bg-[#141418] text-[#6d6d69]'
                }`}
              >
                {settings.dndEnabled ? 'DND ENGAGED' : 'DND OFF'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="flex items-center justify-between bg-[#141418] px-2 py-1 border border-[#2e2e31]">
                <span className="text-[10px] text-[#6d6d69]">Start Time:</span>
                <input
                  type="text"
                  value={settings.quietHoursStart ?? '23:00'}
                  onChange={(e) => onUpdateSettings({ quietHoursStart: e.target.value })}
                  className="w-14 text-right bg-transparent text-[#cfcfca] font-mono text-[11px] outline-hidden"
                />
              </div>
              <div className="flex items-center justify-between bg-[#141418] px-2 py-1 border border-[#2e2e31]">
                <span className="text-[10px] text-[#6d6d69]">End Time:</span>
                <input
                  type="text"
                  value={settings.quietHoursEnd ?? '07:00'}
                  onChange={(e) => onUpdateSettings({ quietHoursEnd: e.target.value })}
                  className="w-14 text-right bg-transparent text-[#cfcfca] font-mono text-[11px] outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Health & Executive Reminders */}
          <div className="bg-[#09090b] p-3 border border-[#2e2e31] space-y-2">
            <span className="font-hud text-xs text-[#cfcfca] font-bold flex items-center gap-1.5">
              <Clock size={14} className="text-[var(--accent)]" />
              EXECUTIVE &amp; HEALTH NUDGES
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <label className="flex items-center gap-2 text-[#cfcfca] cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.waterAndStretch)}
                  onChange={(e) => onUpdateSettings({ waterAndStretch: e.target.checked })}
                  className="accent-[var(--accent)]"
                />
                <span>Water &amp; Stretch (2h Focus)</span>
              </label>
              <label className="flex items-center gap-2 text-[#cfcfca] cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.eyeRest)}
                  onChange={(e) => onUpdateSettings({ eyeRest: e.target.checked })}
                  className="accent-[var(--accent)]"
                />
                <span>Eye Rest (20-20-20 Rule)</span>
              </label>
              <label className="flex items-center gap-2 text-[#cfcfca] cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.mealTimes)}
                  onChange={(e) => onUpdateSettings({ mealTimes: e.target.checked })}
                  className="accent-[var(--accent)]"
                />
                <span>Meal Times (Lunch/Dinner)</span>
              </label>
              <label className="flex items-center gap-2 text-[#cfcfca] cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(settings.sleepWindDown)}
                  onChange={(e) => onUpdateSettings({ sleepWindDown: e.target.checked })}
                  className="accent-[var(--accent)]"
                />
                <span>Sleep Wind-Down Nudge</span>
              </label>
            </div>
          </div>
          {/* Wake Word Configuration */}
          <div className="bg-[#09090b] p-3 border border-[#2e2e31] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-hud text-xs text-[#cfcfca] font-bold flex items-center gap-1.5">
                <Mic size={14} className="text-[var(--accent)]" />
                WAKE ENGINE // &quot;HEY MAYA&quot;
              </span>
              <span className="text-[10px] text-[var(--accent)]">{wakeState}</span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[#6d6d69]">Wake Detection Enabled:</span>
              <button
                onClick={() => onUpdateSettings({ wakeWordEnabled: !settings.wakeWordEnabled })}
                className={`px-3 py-1 font-hud text-[11px] font-bold cursor-pointer ${
                  settings.wakeWordEnabled
                    ? 'bg-[var(--accent)] text-[#070708]'
                    : 'bg-[#1a1a20] text-[#6d6d69]'
                }`}
              >
                {settings.wakeWordEnabled ? 'ACTIVE' : 'DISABLED'}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[#6d6d69]">Wake Sensitivity:</span>
              <div className="flex gap-1">
                {(['strict', 'normal', 'loose'] as WakeSensitivity[]).map((sens) => (
                  <button
                    key={sens}
                    onClick={() => onUpdateSettings({ sensitivity: sens })}
                    className={`px-2 py-0.5 font-hud text-[10px] uppercase cursor-pointer ${
                      settings.sensitivity === sens
                        ? 'bg-[var(--accent)] text-[#070708] font-bold'
                        : 'bg-[#141418] text-[#6d6d69]'
                    }`}
                  >
                    {sens}
                  </button>
                ))}
              </div>
            </div>

            {/* Test Wake Word */}
            <div className="pt-2 border-t border-[#2e2e31]/60 flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setTestMode(!testMode)}
                  className="px-2 py-1 bg-[#1a1a20] text-[#cfcfca] hover:bg-[#25252d] font-hud text-[10px] font-bold cursor-pointer"
                >
                  {testMode ? 'HIDE TEST MONITOR' : 'TEST WAKE WORD LIVE'}
                </button>
                <span className="text-[9px] text-[#46464a]">Lang: en-IN (Levenshtein d=1)</span>
              </div>
              {testMode && (
                <div className="p-2 bg-[#070708] border border-[#2e2e31] text-[10px]">
                  <span className="text-[#6d6d69]">RECENTLY HEARD PHRASE: </span>
                  <span className="text-[var(--accent)] font-bold">{heardText || '(listening...)'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Voice & Synthesis */}
          <div className="bg-[#09090b] p-3 border border-[#2e2e31] space-y-2">
            <span className="font-hud text-xs text-[#cfcfca] font-bold flex items-center gap-1.5">
              <Volume2 size={14} className="text-[var(--accent)]" />
              VOICE SYNTHESIS MODEL (LIVE API)
            </span>
            <div className="flex items-center justify-between">
              <span className="text-[#6d6d69]">Voice Profile:</span>
              <select
                value={settings.voice}
                onChange={(e) => onUpdateSettings({ voice: e.target.value })}
                className="bg-[#141418] border border-[#2e2e31] px-2 py-1 text-xs text-[#cfcfca] outline-hidden cursor-pointer"
              >
                <option value="Aoede">Aoede (Natural Female Warm)</option>
                <option value="Kore">Kore (Clear Professional)</option>
                <option value="Zephyr">Zephyr (Bright Confident)</option>
                <option value="Puck">Puck (Fast Direct)</option>
                <option value="Fenrir">Fenrir (Authoritative Deep)</option>
              </select>
            </div>
          </div>

          {/* Holographic Core Theme Skin */}
          <div className="bg-[#09090b] p-3 border border-[#2e2e31] space-y-2">
            <span className="font-hud text-xs text-[#cfcfca] font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--accent)]" />
              HOLOGRAPHIC CORE PALETTE // SKIN
            </span>
            <div className="flex items-center justify-between">
              <span className="text-[#6d6d69]">Active Preset:</span>
              <div className="flex gap-1.5">
                <button
                  onClick={() => onChangeSkin && onChangeSkin('ash')}
                  className={`px-2.5 py-1 font-hud text-[11px] font-bold cursor-pointer ${
                    activeSkinId === 'ash'
                      ? 'bg-[var(--accent)] text-[#070708]'
                      : 'bg-[#141418] text-[#6d6d69] hover:text-[#cfcfca]'
                  }`}
                >
                  ASH & BONE
                </button>
                <button
                  onClick={() => onChangeSkin && onChangeSkin('stark')}
                  className={`px-2.5 py-1 font-hud text-[11px] font-bold cursor-pointer ${
                    activeSkinId === 'stark'
                      ? 'bg-[#f5b041] text-[#070708]'
                      : 'bg-[#141418] text-[#6d6d69] hover:text-[#cfcfca]'
                  }`}
                >
                  STARK (GOLD/RED)
                </button>
              </div>
            </div>
            <p className="text-[10px] text-[#6d6d69]">
              Ash is the default bone-white/ash base with emotion-tinted accents. Stark provides the classic gold/metallic-red arc reactor palette.
            </p>
          </div>

          {/* Safety & Kill Switch */}
          <div className="bg-[#09090b] p-3 border border-[#2e2e31] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-hud text-xs text-[#cfcfca] font-bold flex items-center gap-1.5">
                <ShieldAlert size={14} className="text-[#c4524f]" />
                EMERGENCY TOOL KILL SWITCH
              </span>
              <span className="text-[10px] text-[#6d6d69]">HOTKEY: Ctrl+Alt+K</span>
            </div>
            <p className="text-[10px] text-[#6d6d69]">
              Instantly prevents Maya from dispatching any local or OS system tools.
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[#cfcfca]">Emergency Lockdown:</span>
              <button
                onClick={onToggleKillSwitch}
                className={`px-4 py-1.5 font-hud text-xs font-bold cursor-pointer transition-all ${
                  isKillSwitchActive
                    ? 'bg-[#c4524f] text-white shadow-[0_0_12px_rgba(196,82,79,0.5)]'
                    : 'bg-[#1a1a20] text-[#6d6d69]'
                }`}
              >
                {isKillSwitchActive ? 'ENGAGED (LOCKED)' : 'DISENGAGED (NORMAL)'}
              </button>
            </div>
          </div>

          {/* Accessibility & Motion */}
          <div className="bg-[#09090b] p-3 border border-[#2e2e31] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-hud text-xs text-[#cfcfca] font-bold flex items-center gap-1.5">
                <Cpu size={14} className="text-[var(--accent)]" />
                ACCESSIBILITY & MOTION
              </span>
              <button
                onClick={onToggleReduceMotion}
                className={`px-3 py-1 font-hud text-[11px] font-bold cursor-pointer ${
                  reduceMotion ? 'bg-[var(--accent)] text-[#070708]' : 'bg-[#1a1a20] text-[#6d6d69]'
                }`}
              >
                {reduceMotion ? 'REDUCED MOTION' : '60 FPS DYNAMIC'}
              </button>
            </div>
            <p className="text-[10px] text-[#6d6d69]">
              Disables scanline sweeps, rapid orb undulation, and micro-glitches for motion-sensitive users.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[#2e2e31] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-1.5 bg-[var(--accent)] text-[#070708] font-hud text-xs font-bold cursor-pointer hover:brightness-110"
          >
            [ CLOSE PREFERENCES ]
          </button>
        </div>
      </div>
    </div>
  );
};
