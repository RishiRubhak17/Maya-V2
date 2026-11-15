import React from 'react';
import { ToolRiskTier } from './toolDefinitions';
import { AlertTriangle, ShieldCheck, X } from 'lucide-react';

interface ApprovalDialogProps {
  isOpen: boolean;
  toolName: string;
  args: any;
  tier: ToolRiskTier;
  reason: string;
  onApprove: () => void;
  onReject: () => void;
}

export const ApprovalDialog: React.FC<ApprovalDialogProps> = ({
  isOpen,
  toolName,
  args,
  tier,
  reason,
  onApprove,
  onReject,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="bg-[#0d0d0f] border-2 border-[#c4524f] max-w-lg w-full p-5 shadow-[0_0_24px_rgba(196,82,79,0.3)] font-mono text-xs flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#2e2e31] pb-2">
          <div className="flex items-center gap-2 text-[#c4524f]">
            <AlertTriangle size={18} />
            <span className="font-hud text-sm font-bold tracking-wider text-[#cfcfca]">
              TACTICAL AUTHORIZATION REQUIRED // TIER {tier}
            </span>
          </div>
          <button
            onClick={onReject}
            className="text-[#6d6d69] hover:text-[#cfcfca] cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Reason / Details */}
        <div className="text-[#cfcfca] leading-relaxed bg-[#070708] p-3 border border-[#2e2e31]">
          <div className="text-[#6d6d69] text-[10px] mb-1 font-hud">ACTION TARGET:</div>
          <div className="font-bold text-[var(--accent)] text-sm mb-2">{toolName}</div>
          <p className="text-xs">{reason}</p>
        </div>

        {/* Parameters */}
        {args && Object.keys(args).length > 0 && (
          <div className="bg-[#070708] p-3 border border-[#2e2e31]">
            <div className="text-[#6d6d69] text-[10px] mb-1 font-hud">SUBMITTED PARAMETERS:</div>
            <pre className="text-[11px] text-[#cfcfca] overflow-x-auto no-scrollbar max-h-32">
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>
        )}

        <div className="text-[10px] text-[#6d6d69] italic">
          Axiom Security Protocol: This authorization prompt is rendered strictly by the client application. The AI model cannot bypass or approve this decision.
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#2e2e31]">
          <button
            onClick={onReject}
            className="px-4 py-2 bg-[#1a1a1f] text-[#cfcfca] hover:bg-[#25252b] font-hud text-xs font-bold transition-all cursor-pointer"
          >
            [ REJECT / ABORT ]
          </button>
          <button
            onClick={onApprove}
            className="px-5 py-2 bg-[#c4524f] text-white hover:brightness-110 font-hud text-xs font-bold tracking-wider transition-all shadow-[0_0_12px_rgba(196,82,79,0.4)] cursor-pointer flex items-center gap-1.5"
          >
            <ShieldCheck size={14} />
            <span>[ AUTHORIZE EXECUTION ]</span>
          </button>
        </div>
      </div>
    </div>
  );
};
