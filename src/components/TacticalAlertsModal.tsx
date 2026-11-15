import React from 'react';
import { X, Bell, BellRing, ShieldAlert, CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { TacticalAlert } from '../types';

interface TacticalAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: TacticalAlert[];
  permission: NotificationPermission;
  onRequestPermission: () => Promise<NotificationPermission | undefined>;
  onTriggerTestAlert: () => void;
  onMarkAllRead: () => void;
}

export const TacticalAlertsModal: React.FC<TacticalAlertsModalProps> = ({
  isOpen,
  onClose,
  alerts,
  permission,
  onRequestPermission,
  onTriggerTestAlert,
  onMarkAllRead,
}) => {
  if (!isOpen) return null;

  const getSeverityStyle = (severity: TacticalAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'text-rose-400 bg-rose-950/40 border-rose-800/60';
      case 'high':
        return 'text-amber-400 bg-amber-950/40 border-amber-800/60';
      case 'medium':
        return 'text-cyan-400 bg-cyan-950/40 border-cyan-800/60';
      default:
        return 'text-emerald-400 bg-emerald-950/40 border-emerald-800/60';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#0e121b] border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#121624]">
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Tactical Alerts & Push Dispatch
              </h3>
              <p className="text-xs text-slate-400">
                Axiom operational notifications, deadlines & security signals
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Permission Banner */}
        <div className="p-4 border-b border-slate-800 bg-[#0b0e17] flex items-center justify-between gap-3">
          <div className="text-xs text-slate-300">
            <span className="text-slate-400">Web Push Status: </span>
            <span className={`font-mono font-semibold ${permission === 'granted' ? 'text-emerald-400' : permission === 'denied' ? 'text-rose-400' : 'text-amber-400'}`}>
              {permission.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {permission !== 'granted' ? (
              <button
                onClick={onRequestPermission}
                className="px-3 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors cursor-pointer"
              >
                Enable Push Alerts
              </button>
            ) : (
              <button
                onClick={onTriggerTestAlert}
                className="px-3 py-1.5 text-xs font-semibold text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800 rounded-lg transition-colors cursor-pointer"
              >
                Trigger Test Alert
              </button>
            )}
            <button
              onClick={onMarkAllRead}
              className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Mark Read
            </button>
          </div>
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {alerts.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              Zero pending alerts. All Axiom operational vectors clear.
            </div>
          ) : (
            alerts.map((alt) => (
              <div
                key={alt.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  alt.read
                    ? 'bg-[#111624]/60 border-slate-800/80 text-slate-400'
                    : 'bg-[#141a29] border-slate-700/80 text-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${getSeverityStyle(
                        alt.severity
                      )}`}
                    >
                      {alt.severity}
                    </span>
                    <h4 className="text-xs font-bold text-slate-100">{alt.title}</h4>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 shrink-0">
                    {new Date(alt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                  {alt.description}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
