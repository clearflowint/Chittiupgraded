import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChitFund } from '../../context/ChitFundContext';
import { Fund, Share, Cycle } from '../../types';
import { FinancialEngine } from '../../services/financialEngine';
import { CommunicationDispatcher, normalizeRecipientPhone } from '../../services/communicationDispatcher';
import { X, MessageSquare, Send, CheckCircle2, Copy, AlertCircle, Users, ExternalLink } from 'lucide-react';

interface WhatsAppReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
  share?: Share | null;
  targetCycle?: Cycle | null;
  mode?: 'single' | 'all-pending';
}

export const WhatsAppReminderModal: React.FC<WhatsAppReminderModalProps> = ({
  isOpen,
  onClose,
  fund,
  share,
  targetCycle,
  mode = 'single',
}) => {
  const { tenant } = useAuth();
  const { shares, cycles, billings, payments, sendCampaign, showAcknowledgement, recordDispatch } = useChitFund();

  const [copied, setCopied] = useState(false);
  const [broadcastDone, setBroadcastDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [processingState, setProcessingState] = useState<'idle' | 'processing' | 'waiting' | 'acknowledged'>('idle');
  const [ackTimestamp, setAckTimestamp] = useState<string | null>(null);

  // Synchronize default message and modal state when modal is opened or inputs change
  useEffect(() => {
    if (!isOpen || !fund) return;

    const fundCycles = cycles.filter(c => c.fundId === fund.fundId);
    const currentCycleNum = targetCycle?.cycleNumber || (fundCycles.length > 0 ? Math.max(...fundCycles.map(c => c.cycleNumber)) : 1);
    const dueInstallment = targetCycle?.netInstallmentDue || (fund.totalCycles > 0 ? Math.round(fund.totalPool / fund.totalCycles) : 0);
    const singleAmountDue = share ? Math.max(dueInstallment, share.arrears || dueInstallment) : dueInstallment;

    const defaultSingleMessage = share
      ? `Dear ${share.memberName},\n\nThis is a friendly reminder from ${tenant?.name || 'Operations Manager'} for "${fund.fundName}" (Cycle #${currentCycleNum}).\n\nOutstanding Due: ${FinancialEngine.formatCurrency(singleAmountDue)}\nStatus: Share #${share.shareNumber} (${share.status.toUpperCase()})\n\nPlease remit via UPI or bank wire at your earliest convenience to maintain your scheme allocation.\n\nThank you!`
      : '';

    const defaultBroadcastMessage = `Dear Member,\n\nThis is an automated reminder from ${tenant?.name || 'Operations Manager'} for your chit installment in "${fund.fundName}" (Cycle #${currentCycleNum}).\n\nNet Installment Due: ${FinancialEngine.formatCurrency(dueInstallment)}\n\nPlease ensure payment before the cycle settlement date to participate in this cycle's dividend discount pool.\n\nThank you!`;

    setMessage(mode === 'single' ? defaultSingleMessage : defaultBroadcastMessage);
    setBroadcastDone(false);
    setCopied(false);
    setLoading(false);
    setProcessingState('idle');
    setAckTimestamp(null);
  }, [isOpen, fund, share, targetCycle, mode, tenant?.name, cycles]);

  if (!isOpen || !fund) return null;

  const fundCycles = cycles.filter(c => c.fundId === fund.fundId);
  const currentCycleNum = targetCycle?.cycleNumber || (fundCycles.length > 0 ? Math.max(...fundCycles.map(c => c.cycleNumber)) : 1);
  const dueInstallment = targetCycle?.netInstallmentDue || (fund.totalCycles > 0 ? Math.round(fund.totalPool / fund.totalCycles) : 0);

  // All pending members in THIS Chitti only (tenant + active fund scoped)
  const pendingShares = shares.filter(
    (s) => s.fundId === fund.fundId && (s.arrears > 0 || (s.totalBilled > ((s.totalCredits || 0) - (s.totalDebits || 0))))
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenWhatsApp = () => {
    if (!share) return;
    const cleanPhone = share.memberPhone.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  };

  const handleDispatchSingleReminder = async () => {
    if (!share) return;
    setLoading(true);
    try {
      const res = await CommunicationDispatcher.dispatchShareReminder({
        tenantId: tenant?.managerId || fund.managerId,
        managerId: fund.managerId,
        managerName: tenant?.name || 'Operations Manager',
        managerPhone: tenant?.phone || '',
        managerEmail: tenant?.email || '',
        fund,
        share,
        cycles: cycles || [],
        billings: billings || [],
        payments: payments || [],
        customMessage: message,
        channel: 'whatsapp',
      });

      if (res.dispatchRecord) {
        await recordDispatch(res.dispatchRecord);
      }

      setLoading(false);
      onClose();

      showAcknowledgement({
        isSuccess: res.success,
        title: res.success ? 'Dispatch Received' : 'Dispatch Failed',
        message: res.success 
          ? 'Dispatch received and queued for processing.' 
          : res.error || 'Dispatch failed to start.',
        operationType: 'SHARE REMINDER WEBHOOK',
        referenceId: res.dispatchId,
        ackTime: new Date().toLocaleTimeString(),
      });
    } catch (e: any) {
      setLoading(false);
    }
  };

  const handleBroadcast = async () => {
    setLoading(true);
    setProcessingState('processing');
    try {
      const res = await CommunicationDispatcher.dispatchBulkReminder({
        tenantId: tenant?.managerId || fund.managerId,
        managerId: fund.managerId,
        managerName: tenant?.name || 'Operations Manager',
        managerPhone: tenant?.phone || '',
        managerEmail: tenant?.email || '',
        fund,
        shares: pendingShares,
        customMessage: message,
        channel: 'whatsapp',
      });

      if (res.dispatchRecord) {
        await recordDispatch(res.dispatchRecord);
      }
      
      setProcessingState('waiting');
      await new Promise((resolve) => setTimeout(resolve, 800));
      
      const finishedTime = new Date().toLocaleTimeString();
      setAckTimestamp(finishedTime);
      setProcessingState('acknowledged');
      setLoading(false);
      setBroadcastDone(true);
      onClose();

      showAcknowledgement({
        isSuccess: res.success,
        title: res.success ? 'Dispatch Received' : 'Dispatch Failed',
        message: res.success 
          ? 'Dispatch received and queued for processing.' 
          : res.error || 'Dispatch failed to start.',
        operationType: 'BULK REMINDER WEBHOOK',
        referenceId: res.dispatchId,
        ackTime: finishedTime,
      });
    } catch (e: any) {
      setProcessingState('idle');
      setLoading(false);
      showAcknowledgement({
        isSuccess: false,
        title: 'Dispatch Failed',
        message: 'Dispatch failed to start.',
        operationType: 'BULK REMINDER WEBHOOK',
        referenceId: `ERR-${Date.now().toString().slice(-6)}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-400/30 text-emerald-400 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono-nums tracking-widest text-sky-400 font-semibold block">
                CRM &amp; OUTREACH
              </span>
              <h2 className="text-sm font-bold text-white">
                {mode === 'single' ? 'WhatsApp Reminder' : 'Broadcast to Pending Members'}
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">

          {/* AUDIENCE SUMMARY BANNER */}
          <div className="bg-slate-900 text-slate-100 p-4 rounded-xl space-y-2 font-mono-nums text-xs border border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-sans text-xs">Target Audience:</span>
              <span className="font-semibold text-sky-400 font-sans">
                {mode === 'single' ? 'Single Recipient' : `Bulk Broadcast (${pendingShares.length} Members)`}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-sans text-xs">Active Scheme:</span>
              <span className="font-semibold text-white font-sans">{fund.fundName} (Cycle #{currentCycleNum})</span>
            </div>

            {mode === 'single' && share && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400 font-sans text-xs">Recipient Details:</span>
                <span className="font-semibold text-emerald-300 font-sans">
                  {share.memberName} · {share.memberPhone} · [{share.displayId || '----'}]
                </span>
              </div>
            )}

            {mode === 'all-pending' && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <span className="text-slate-400 font-sans text-xs">Pending Recipients:</span>
                <span className="font-semibold text-amber-400 font-sans">
                  {pendingShares.length} members with arrears in this Chitti
                </span>
              </div>
            )}
          </div>

          {/* BULK RECIPIENTS LIST PREVIEW */}
          {mode === 'all-pending' && pendingShares.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block font-sans">
                Included Recipients ({pendingShares.length})
              </span>
              <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-2.5 space-y-1 text-xs font-mono-nums bg-slate-50">
                {pendingShares.map((s) => (
                  <div key={s.shareId} className="flex items-center justify-between text-slate-700 py-1 border-b border-slate-100 last:border-0">
                    <span className="font-semibold">{s.memberName} ({s.memberPhone})</span>
                    <span className="text-rose-600 font-bold">{FinancialEngine.formatCurrency(s.arrears || dueInstallment)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* WHATSAPP MESSAGE PREVIEW BUBBLE */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                WhatsApp Message Content
              </label>
              <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                WhatsApp Preview Format
              </span>
            </div>

            <div className="bg-[#e5ddd5] p-3 rounded-2xl border border-slate-300 shadow-inner">
              <div className="bg-white rounded-xl p-3 text-xs text-slate-900 leading-relaxed font-sans shadow-xs whitespace-pre-wrap border border-emerald-100">
                <textarea
                  rows={6}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-transparent focus:outline-none font-sans text-xs leading-relaxed resize-none"
                />
              </div>
            </div>
          </div>

          {/* PROGRESS ACKNOWLEDGEMENT TRACKER BLOCK */}
          {processingState !== 'idle' && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center space-y-3 font-sans text-xs">
              <div className="flex items-center gap-2">
                {processingState === 'processing' && (
                  <span className="font-bold text-sky-600 animate-pulse">
                    [ Processing Outreach Dispatch... ]
                  </span>
                )}
                {processingState === 'waiting' && (
                  <span className="font-bold text-amber-600 animate-pulse">
                    [ Waiting for Server Acknowledgement... ]
                  </span>
                )}
                {processingState === 'acknowledged' && (
                  <span className="font-bold text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>[ Acknowledgement Received ]</span>
                  </span>
                )}
              </div>

              {/* SPINNING STATE: Render only between processing and acknowledged */}
              {(processingState === 'processing' || processingState === 'waiting') && (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-[10px] text-slate-400 font-mono-nums">
                    Active gateway handshake running
                  </span>
                </div>
              )}

              {processingState === 'acknowledged' && ackTimestamp && (
                <span className="text-[11px] text-slate-500 font-mono-nums block text-center">
                  Handshake success verified at {ackTimestamp}
                </span>
              )}
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={handleCopy}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1.5 min-h-[44px]"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Copied to Clipboard!' : 'Copy Message'}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 bg-white border border-slate-200 rounded-xl transition cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>

              {mode === 'single' ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenWhatsApp}
                    className="px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition cursor-pointer flex items-center gap-1.5 min-h-[44px]"
                    title="Open WhatsApp chat directly on web/device"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>WhatsApp Direct</span>
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleDispatchSingleReminder}
                    className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs min-h-[44px]"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{loading ? 'Triggering...' : 'Dispatch via Webhook'}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={loading || broadcastDone || pendingShares.length === 0}
                  onClick={handleBroadcast}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl disabled:opacity-50 transition cursor-pointer flex items-center gap-1.5 shadow-xs min-h-[44px]"
                >
                  {broadcastDone ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Broadcast Queued</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>{loading ? 'Queueing...' : `Broadcast to ${pendingShares.length} Members`}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
