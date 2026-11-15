import React from 'react';
import { AlertTriangle, X, Check, ShieldAlert } from 'lucide-react';

interface RiskyActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  reason: string;
  details?: string;
}

export const RiskyActionModal: React.FC<RiskyActionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  reason,
  details,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#0e121b] border border-amber-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-100">{title}</h3>
            <p className="text-xs text-amber-300/90 mt-1">{reason}</p>
          </div>
        </div>

        {details && (
          <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-300">
            {details}
          </div>
        )}

        <div className="pt-2 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Abort Action
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>Confirm & Execute</span>
          </button>
        </div>
      </div>
    </div>
  );
};
