import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChitFund } from '../../context/ChitFundContext';
import { Fund, Share, Cycle, Billing, Payment } from '../../types';
import { CommunicationDispatcher, isUsablePhone } from '../../services/communicationDispatcher';
import { 
  X, 
  Send, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  ShieldCheck, 
  Clock, 
  Zap, 
  Radio
} from 'lucide-react';

interface BulkStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
  shares: Share[];
  cycles: Cycle[];
  billings: Billing[];
  payments: Payment[];
}

export const BulkStatementModal: React.FC<BulkStatementModalProps> = ({
  isOpen,
  onClose,
  fund,
  shares,
  cycles,
  billings,
  payments,
}) => {
  const { tenant } = useAuth();
  const { showAcknowledgement, recordDispatch } = useChitFund();

  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<'whatsapp' | 'email' | 'sms'>('whatsapp');
  const [resultStatus, setResultStatus] = useState<string | null>(null);

  if (!isOpen || !fund) return null;

  const managerId = tenant?.managerId || fund.managerId;
  const managerName = tenant?.name || 'Operations Manager';
  const managerPhone = tenant?.phone || '';
  const managerEmail = tenant?.email || '';

  // Filter strictly to current authenticated tenant and active fund
  const fundShares = shares.filter((s) => s.fundId === fund.fundId && s.managerId === managerId);
  const eligibleShares = fundShares.filter((s) => isUsablePhone(s.memberPhone));
  const skippedShares = fundShares.filter((s) => !isUsablePhone(s.memberPhone));

  const handleDispatchBulk = async () => {
    if (eligibleShares.length === 0) return;

    setLoading(true);
    setResultStatus(null);

    try {
      const res = await CommunicationDispatcher.dispatchBulkStatement({
        tenantId: managerId,
        managerId,
        managerName,
        managerPhone,
        managerEmail,
        fund,
        shares: fundShares,
        cycles,
        billings,
        payments,
        channel,
      });

      if (res.dispatchRecord) {
        await recordDispatch(res.dispatchRecord);
      }

      setLoading(false);
      const isSim = res.simulated;
      const statusMsg = isSim 
        ? 'Accepted in simulation mode' 
        : 'Accepted by automation webhook';
      setResultStatus(statusMsg);

      showAcknowledgement({
        isSuccess: res.success,
        title: res.success ? 'Dispatch Received' : 'Dispatch Failed',
        message: res.success 
          ? 'Dispatch received and queued for processing.' 
          : res.error || 'Dispatch failed to start.',
        operationType: 'BULK STATEMENT WEBHOOK TRIGGER',
        referenceId: res.dispatchId,
        ackTime: new Date().toLocaleTimeString(),
      });

      setTimeout(() => {
        onClose();
      }, 600);
    } catch (e: any) {
      setLoading(false);
      setResultStatus('Dispatch failed');
      showAcknowledgement({
        isSuccess: false,
        title: 'Dispatch Failed',
        message: 'Dispatch failed to start.',
        operationType: 'BULK STATEMENT WEBHOOK TRIGGER',
        referenceId: `ERR-${Date.now().toString().slice(-6)}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400 block leading-tight">Batch Automation</span>
              <h2 className="text-base font-black tracking-wide">SEND STATEMENT TO ALL</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-4 text-slate-800 text-xs overflow-y-auto">
          
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Chitti Workspace</span>
            <p className="font-extrabold text-slate-900 text-sm">{fund.fundName}</p>
            <p className="text-slate-500 text-[11px]">Operations Manager: <strong className="text-slate-700">{managerName}</strong></p>
          </div>

          {/* Recipient Eligibility Breakdown */}
          <div className="grid grid-cols-3 gap-2.5 text-center font-mono-nums">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">Total Shares</span>
              <span className="text-lg font-black text-slate-800 block mt-0.5">{fundShares.length}</span>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900">
              <span className="text-[9px] uppercase font-bold text-emerald-700 block font-sans">Eligible</span>
              <span className="text-lg font-black text-emerald-700 block mt-0.5">{eligibleShares.length}</span>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
              <span className="text-[9px] uppercase font-bold text-amber-700 block font-sans">Skipped</span>
              <span className="text-lg font-black text-amber-700 block mt-0.5">{skippedShares.length}</span>
            </div>
          </div>

          {skippedShares.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-[11px] text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>{skippedShares.length} member(s) will be skipped:</strong> Missing or invalid phone number.
              </div>
            </div>
          )}

          {/* Channel selector */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Delivery Channel</span>
            <div className="grid grid-cols-3 gap-2">
              {(['whatsapp', 'sms', 'email'] as const).map((ch) => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => setChannel(ch)}
                  className={`py-2 px-3 rounded-xl border text-center font-bold text-xs uppercase transition cursor-pointer ${
                    channel === ch 
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20' 
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  {ch === 'whatsapp' ? 'WhatsApp' : ch === 'sms' ? 'SMS' : 'Email'}
                </button>
              ))}
            </div>
          </div>

          {/* Architecture Handoff Guarantee Notice */}
          <div className="p-3.5 bg-sky-50 border border-sky-100 rounded-xl space-y-1.5 text-[11px] text-sky-900">
            <div className="flex items-center gap-1.5 font-bold text-sky-950">
              <Zap className="w-3.5 h-3.5 text-sky-600" />
              <span>Centralized Automation Contract</span>
            </div>
            <p className="text-sky-800 leading-normal">
              ClearFlow will compile individualized, isolated statement records for each eligible member and send <strong>ONE structured webhook trigger</strong> to n8n.
            </p>
            <p className="text-sky-700 text-[10px]">
              n8n manages recipient loop, queuing, provider rate limits, and delivery. ClearFlow records remain 100% read-only.
            </p>
          </div>

          {resultStatus && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-center text-xs font-bold text-emerald-800 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{resultStatus}</span>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 transition cursor-pointer min-h-[42px]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDispatchBulk}
            disabled={loading || eligibleShares.length === 0}
            className="flex-1 max-w-xs flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs transition cursor-pointer shadow-md min-h-[42px]"
          >
            <Send className="w-4 h-4" />
            <span>{loading ? 'Transmitting Batch...' : `Dispatch to All (${eligibleShares.length})`}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
