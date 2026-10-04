import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChitFund } from '../../context/ChitFundContext';
import { Fund, Share, Cycle, Billing, Payment } from '../../types';
import { FinancialEngine } from '../../services/financialEngine';
import { generateShareStatement } from '../../services/statementService';
import { CommunicationDispatcher, normalizeRecipientPhone } from '../../services/communicationDispatcher';
import { 
  X, 
  FileText, 
  Send, 
  CheckCircle2, 
  Printer, 
  Clock, 
  User, 
  Building2, 
  Phone, 
  ShieldCheck, 
  Copy,
  AlertCircle
} from 'lucide-react';

interface ShareStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  share: Share;
  fund: Fund;
  cycles: Cycle[];
  billings: Billing[];
  payments: Payment[];
}

export const ShareStatementModal: React.FC<ShareStatementModalProps> = ({
  isOpen,
  onClose,
  share,
  fund,
  cycles,
  billings,
  payments,
}) => {
  const { tenant } = useAuth();
  const { showAcknowledgement, recordDispatch } = useChitFund();

  const [isSending, setIsSending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  const managerName = tenant?.name || 'Operations Manager';
  const managerPhone = tenant?.phone || '';
  const managerEmail = tenant?.email || '';

  // Generate authoritative read-only statement data using centralized service
  const statement = useMemo(() => {
    return generateShareStatement({
      share,
      fund,
      cycles,
      billings,
      payments,
      managerName,
      managerPhone,
    });
  }, [share, fund, cycles, billings, payments, managerName, managerPhone]);

  if (!isOpen) return null;

  const handleSendStatement = async () => {
    setIsSending(true);
    setSendStatus(null);
    try {
      const result = await CommunicationDispatcher.dispatchShareStatement({
        tenantId: tenant?.managerId || share.managerId,
        managerId: share.managerId,
        managerName,
        managerPhone,
        managerEmail,
        fund,
        share,
        cycles,
        billings,
        payments,
        channel: 'whatsapp',
      });

      if (result.dispatchRecord) {
        await recordDispatch(result.dispatchRecord);
      }

      setIsSending(false);
      setSendStatus(result.simulated ? 'Triggered (Simulated)' : 'Triggered & Queued by Automation');

      showAcknowledgement({
        isSuccess: result.success,
        title: result.success ? 'Dispatch Received' : 'Dispatch Failed',
        message: result.success 
          ? 'Dispatch received and queued for processing.' 
          : result.error || 'Dispatch failed to start.',
        operationType: 'SHARE STATEMENT DISPATCH',
        referenceId: result.dispatchId,
        ackTime: new Date().toLocaleTimeString(),
      });
    } catch (e: any) {
      setIsSending(false);
      setSendStatus('Dispatch failed');
      showAcknowledgement({
        isSuccess: false,
        title: 'Dispatch Failed',
        message: 'Dispatch failed to start.',
        operationType: 'SHARE STATEMENT DISPATCH',
        referenceId: `ERR-${Date.now().toString().slice(-6)}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    }
  };

  const handleCopyMessage = () => {
    navigator.clipboard.writeText(statement.personalizedTextMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenDirectWhatsApp = () => {
    const cleanPhone = normalizeRecipientPhone(share.memberPhone).replace(/[^0-9]/g, '');
    if (!cleanPhone) return;
    const encoded = encodeURIComponent(statement.personalizedTextMessage);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  };

  const isDrawn = share.hasClaimedPrize;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-sky-400 block leading-tight">Official Record</span>
              <h2 className="text-base sm:text-lg font-black tracking-wide">SHARE ACCOUNT STATEMENT</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable / Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800">
          
          {/* Header Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Fund Scheme &amp; Organization</span>
              </div>
              <p className="font-extrabold text-slate-900 text-sm">{statement.fundName}</p>
              <p className="text-slate-600 font-medium">Operations Manager: <span className="font-bold text-slate-800">{statement.managerName}</span></p>
              {statement.fundStartDate && (
                <p className="text-slate-500">Scheme Start: <span className="font-mono-nums font-semibold">{statement.fundStartDate}</span></p>
              )}
            </div>

            <div className="space-y-1.5 sm:border-l sm:border-slate-200 sm:pl-4">
              <div className="flex items-center gap-1.5 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Member &amp; Share Allotment</span>
              </div>
              <p className="font-extrabold text-slate-900 text-sm">{statement.memberName}</p>
              <p className="text-slate-600 font-medium">
                Share ID: <span className="font-mono-nums font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">{statement.shareDisplayId}</span>
                <span className="ml-2 text-slate-400">(Allotment #{statement.shareNumber})</span>
              </p>
              <p className="text-slate-500 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-400" />
                <span className="font-mono-nums font-semibold">{statement.memberPhone}</span>
              </p>
            </div>
          </div>

          {/* Operational Cycle Progress */}
          <div className="p-3.5 bg-sky-50/50 border border-sky-100 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-[10px] font-black uppercase text-sky-700 tracking-wider block">Cycle Progression</span>
              <span className="font-extrabold text-slate-900 text-sm font-mono-nums">
                {statement.currentCycle !== null 
                  ? (statement.totalCycles !== null ? `Cycle #${statement.currentCycle} of ${statement.totalCycles}` : `Cycle #${statement.currentCycle}`)
                  : 'Pre-Auction Period'}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono-nums">
              <div className="text-center px-2 py-1 bg-white rounded-lg border border-sky-100">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Cycles Completed</span>
                <span className="font-black text-slate-800">{statement.cyclesCompleted}</span>
              </div>
              {statement.totalCycles !== null && (
                <div className="text-center px-2 py-1 bg-white rounded-lg border border-sky-100">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Cycles Remaining</span>
                  <span className="font-black text-slate-800">{statement.cyclesLeft}</span>
                </div>
              )}
              <div className="text-center px-2 py-1 bg-white rounded-lg border border-sky-100">
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Prize Status</span>
                <span className={`font-black ${isDrawn ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {isDrawn ? `Drawn (Cycle #${share.wonCycleNumber || '?'})` : 'Undrawn'}
                </span>
              </div>
            </div>
          </div>

          {/* Current Financial Position (UniversalFinancialCore Materialized) */}
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">Current Financial Position</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono-nums">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Total Billed</span>
                <span className="text-base font-black text-slate-900 block mt-0.5">
                  {FinancialEngine.formatCurrency(statement.totalBilled)}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Total Paid</span>
                <span className="text-base font-black text-emerald-600 block mt-0.5">
                  {FinancialEngine.formatCurrency(statement.totalPaid)}
                </span>
              </div>

              <div className={`p-3 rounded-xl border col-span-2 ${
                statement.pendingAmount > 0 
                  ? 'bg-rose-50 border-rose-200 text-rose-900' 
                  : statement.advanceAmount > 0 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                  : 'bg-teal-50 border-teal-200 text-teal-900'
              }`}>
                <span className="text-[10px] uppercase font-bold block font-sans opacity-80">Settlement Status</span>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-base font-black">
                    {statement.statusSummaryText}
                  </span>
                  <span className="text-[10px] font-bold font-sans uppercase px-2 py-0.5 rounded-full bg-white/70">
                    {statement.currentStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Billing History (Obligations: Share × Cycle) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                Billing Obligations ({statement.billingHistory.length})
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Domain: Share × Cycle</span>
            </div>
            
            {statement.billingHistory.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                No billing obligations recorded for this share yet.
              </p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs font-mono-nums">
                <div className="bg-slate-50 px-3.5 py-2 flex items-center justify-between text-[10px] font-bold uppercase text-slate-400 font-sans">
                  <span>Cycle &amp; Period</span>
                  <span>Billed Amount</span>
                </div>
                {statement.billingHistory.map((b) => (
                  <div key={b.billingId} className="px-3.5 py-2.5 flex items-center justify-between bg-white hover:bg-slate-50/50 transition">
                    <div>
                      <span className="font-black text-slate-800">Cycle #{b.cycleNumber}</span>
                      {b.cycleName && <span className="text-slate-500 font-sans ml-1.5">({b.cycleName})</span>}
                    </div>
                    <span className="font-extrabold text-slate-900 font-mono-nums">
                      {FinancialEngine.formatCurrency(b.billAmount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Financial Activity (Share-level Payments - NO Cycle Association) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                Financial Activity / Payments ({statement.financialActivity.length})
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Domain: Share-level Only</span>
            </div>

            {statement.financialActivity.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-4 bg-slate-50 rounded-xl border border-slate-200 text-center">
                No payment transactions recorded for this share yet.
              </p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs font-mono-nums">
                <div className="bg-slate-50 px-3.5 py-2 grid grid-cols-4 text-[10px] font-bold uppercase text-slate-400 font-sans">
                  <span>Date &amp; Receipt</span>
                  <span>Channel</span>
                  <span>Reference</span>
                  <span className="text-right">Amount</span>
                </div>
                {statement.financialActivity.map((p) => (
                  <div key={p.paymentId} className="px-3.5 py-2.5 grid grid-cols-4 items-center bg-white hover:bg-slate-50/50 transition">
                    <div>
                      <span className="font-bold text-slate-800 block">{p.date}</span>
                      <span className="text-[10px] text-slate-400 font-sans">{p.displayId || p.paymentId.slice(-6)}</span>
                    </div>
                    <div>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 font-sans">
                        {p.paymentMethod}
                      </span>
                    </div>
                    <div className="truncate text-slate-500 text-[11px] font-sans">
                      {p.reference}
                    </div>
                    <div className="text-right">
                      <span className={`font-black text-sm ${p.type === 'DEBIT' ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {p.type === 'DEBIT' ? '-' : '+'}{FinancialEngine.formatCurrency(p.amount)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Statement Generation Timestamp and Security Badge */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 font-sans">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Statement Generated: <strong className="text-slate-600 font-mono-nums">{new Date(statement.statementGeneratedAt).toLocaleString()}</strong></span>
            </div>
            <div className="flex items-center gap-1 text-slate-500 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>UniversalFinancialCore Reconciled · Tenant Scoped</span>
            </div>
          </div>
        </div>

        {/* Modal Actions Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition cursor-pointer flex items-center gap-1.5 min-h-[40px]"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>Print / PDF</span>
            </button>
            <button
              onClick={handleCopyMessage}
              className="px-3 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition cursor-pointer flex items-center gap-1.5 min-h-[40px]"
            >
              <Copy className="w-4 h-4 text-slate-500" />
              <span>{copied ? 'Copied!' : 'Copy Summary'}</span>
            </button>
            <button
              onClick={handleOpenDirectWhatsApp}
              className="px-3 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer flex items-center gap-1.5 min-h-[40px]"
              title="Open WhatsApp chat directly on web/device"
            >
              <span>WhatsApp Direct</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSendStatement}
              disabled={isSending}
              className="px-4 py-2 rounded-xl text-xs font-black text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 transition cursor-pointer shadow-md flex items-center gap-1.5 min-h-[40px]"
            >
              <Send className="w-4 h-4" />
              <span>{isSending ? 'Triggering Webhook...' : 'Send Statement via Webhook'}</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 transition cursor-pointer min-h-[40px]"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
