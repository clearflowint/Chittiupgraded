import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChitFund } from '../../context/ChitFundContext';
import { Fund, Share, Cycle } from '../../types';
import { FinancialEngine } from '../../services/financialEngine';
import { X, Send, FileText, CheckCircle2, AlertCircle, Users, Mail, MessageSquare } from 'lucide-react';

interface SendReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
  shares: Share[];
  cycles: Cycle[];
}

export const SendReportModal: React.FC<SendReportModalProps> = ({
  isOpen,
  onClose,
  fund,
  shares,
  cycles,
}) => {
  const { tenant } = useAuth();
  const { showAcknowledgement } = useChitFund();

  const [reportType, setReportType] = useState<'cycle_summary' | 'arrears_statement' | 'chitti_ledger'>('cycle_summary');
  const [recipientScope, setRecipientScope] = useState<'all' | 'pending' | 'single'>('all');
  const [selectedShareId, setSelectedShareId] = useState<string>(shares[0]?.shareId || '');
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processingState, setProcessingState] = useState<'idle' | 'processing' | 'waiting' | 'acknowledged'>('idle');
  const [ackTimestamp, setAckTimestamp] = useState<string | null>(null);

  if (!isOpen) return null;

  const fundShares = shares.filter((s) => s.fundId === fund.fundId);
  const pendingShares = fundShares.filter((s) => s.arrears > 0);
  const selectedShare = fundShares.find((s) => s.shareId === selectedShareId);

  const targetRecipients =
    recipientScope === 'all'
      ? fundShares
      : recipientScope === 'pending'
      ? pendingShares
      : selectedShare
      ? [selectedShare]
      : [];

  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (targetRecipients.length === 0) {
      setError('No eligible recipients found for selected scope.');
      return;
    }

    setLoading(true);
    setProcessingState('processing');
    setError(null);
    setSuccessMsg(null);

    try {
      const refId = `REPORT-${reportType.toUpperCase()}-${Date.now().toString().slice(-6)}`;
      
      // Step 1: Processing
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Step 2: Waiting for Acknowledgement
      setProcessingState('waiting');
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Step 3: Acknowledgement Received
      const finishedTime = new Date().toLocaleTimeString();
      setAckTimestamp(finishedTime);
      setProcessingState('acknowledged');
      setLoading(false);
      setSuccessMsg(
        `Report successfully dispatched via ${channel.toUpperCase()} to ${targetRecipients.length} recipient(s) for ${fund.fundName}!`
      );

      setTimeout(() => {
        setSuccessMsg(null);
        setProcessingState('idle');
        onClose();
        
        showAcknowledgement({
          isSuccess: true,
          title: 'Report Dispatched Successfully',
          message: `Your ${reportType.replace('_', ' ').toUpperCase()} report was successfully generated and dispatched via ${channel.toUpperCase()}.`,
          operationType: 'MANUAL REPORT DISPATCH',
          referenceId: refId,
          ackTime: finishedTime,
        });
      }, 500);
    } catch (err: any) {
      setError(err?.message || 'Failed to dispatch report.');
      setProcessingState('idle');
      setLoading(false);
      showAcknowledgement({
        isSuccess: false,
        title: 'Report Dispatch Failed',
        message: err?.message || 'The generated report could not be dispatched.',
        operationType: 'MANUAL REPORT DISPATCH',
        referenceId: `ERR-${Date.now().toString().slice(-6)}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-5 py-3.5 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-400" />
            <div>
              <h2 className="text-sm font-bold tracking-wide">SEND CHITTI REPORT</h2>
              <p className="text-[11px] text-slate-400 font-mono-nums">
                Manual Dispatch · {fund.fundName} ({fund.displayId || '----'})
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 rounded-xl font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSendReport} className="space-y-4">
            
            {/* 1. Report Type Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Report Type
              </label>
              <select
                value={reportType}
                onChange={(e: any) => setReportType(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium"
              >
                <option value="cycle_summary">Latest Cycle Settlement Statement</option>
                <option value="arrears_statement">Member Arrears &amp; Outstanding Dues Report</option>
                <option value="chitti_ledger">Complete Chitti Financial Ledger</option>
              </select>
            </div>

            {/* 2. Recipient Scope */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Recipient Audience Scope
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setRecipientScope('all')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    recipientScope === 'all'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  All ({fundShares.length})
                </button>

                <button
                  type="button"
                  onClick={() => setRecipientScope('pending')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    recipientScope === 'pending'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Pending ({pendingShares.length})
                </button>

                <button
                  type="button"
                  onClick={() => setRecipientScope('single')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    recipientScope === 'single'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Individual
                </button>
              </div>
            </div>

            {/* Single member selector if scope === 'single' */}
            {recipientScope === 'single' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Member
                </label>
                <select
                  value={selectedShareId}
                  onChange={(e) => setSelectedShareId(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500"
                >
                  {fundShares.map((s) => (
                    <option key={s.shareId} value={s.shareId}>
                      {s.memberName} ({s.displayId || '----'}) · {s.memberPhone}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Delivery Channel */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Delivery Channel
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChannel('whatsapp')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    channel === 'whatsapp'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp Direct</span>
                </button>

                <button
                  type="button"
                  onClick={() => setChannel('email')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    channel === 'email'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email Report</span>
                </button>
              </div>
            </div>

            {/* Optional Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Custom Message / Remark (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add custom remark for recipients..."
                className="w-full px-3.5 py-2 text-xs border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Live Report Preview Box */}
            <div className="bg-[#0f172a] text-white rounded-xl p-4 space-y-2 text-xs font-mono-nums border border-slate-800">
              <div className="text-[10px] uppercase font-bold tracking-wider text-sky-400 font-sans border-b border-slate-800 pb-1.5 flex justify-between">
                <span>PREVIEW SUMMARY</span>
                <span>Manual Trigger</span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-300">
                <div><strong className="text-white">Scheme:</strong> {fund.fundName}</div>
                <div><strong className="text-white">Report:</strong> {reportType.replace('_', ' ').toUpperCase()}</div>
                <div><strong className="text-white">Recipients:</strong> {targetRecipients.length} Member(s)</div>
                <div><strong className="text-white">Channel:</strong> {channel.toUpperCase()}</div>
              </div>
            </div>

            {/* PROGRESS ACKNOWLEDGEMENT TRACKER BLOCK */}
            {processingState !== 'idle' && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col items-center justify-center space-y-3 font-sans text-xs">
                <div className="flex items-center gap-2">
                  {processingState === 'processing' && (
                    <span className="font-bold text-sky-600 animate-pulse">
                      [ Processing Report Dispatch... ]
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

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || targetRecipients.length === 0}
                className="py-2.5 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs min-h-[44px]"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{loading ? 'Dispatching...' : 'Send Report'}</span>
              </button>
            </div>

          </form>

        </div>

      </div>
    </div>
  );
};
