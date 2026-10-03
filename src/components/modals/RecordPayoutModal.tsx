import React, { useState, useEffect } from 'react';
import { useChitFund } from '../../context/ChitFundContext';
import { Fund, Share, Cycle } from '../../types';
import { FinancialEngine } from '../../services/financialEngine';
import { X, Award, AlertCircle, Calendar, FileText, RotateCcw } from 'lucide-react';

interface RecordPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
  share: Share;
  cycles: Cycle[];
  onOpenEditBills?: () => void;
}

export const RecordPayoutModal: React.FC<RecordPayoutModalProps> = ({
  isOpen,
  onClose,
  fund,
  share,
  cycles,
  onOpenEditBills,
}) => {
  const { recordSharePayout, showAcknowledgement } = useChitFund();

  const fundCycles = cycles.filter((c) => c.fundId === fund.fundId).sort((a, b) => a.cycleNumber - b.cycleNumber);
  const maxCycle = fundCycles.length > 0 ? Math.max(...fundCycles.map((c) => c.cycleNumber)) : 1;

  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [payoutAmount, setPayoutAmount] = useState<number>(800000);
  const [payoutDate, setPayoutDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && fundCycles.length > 0) {
      const matchCycle = fundCycles.find((c) => c.cycleNumber === (share.wonMonth || maxCycle)) || fundCycles[0];
      setSelectedCycleId(matchCycle.cycleId);
      setPayoutAmount(matchCycle.winnerNetPayout || fund.totalPool || 800000);
      setPayoutDate(new Date().toISOString().split('T')[0]);
      setNotes('');
      setError(null);
    }
  }, [isOpen, fund.fundId, share.shareId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCycleId) {
      setError('Please select a cycle for this payout.');
      return;
    }
    if (payoutAmount < 0) {
      setError('Payout amount cannot be negative.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const refId = notes || `PAYOUT-${share.displayId || share.shareId.slice(0, 4)}-${Date.now().toString().slice(-6)}`;
      await recordSharePayout({
        fundId: fund.fundId,
        shareId: share.shareId,
        cycleId: selectedCycleId,
        payoutAmount,
        payoutDate,
        notes,
      });

      setLoading(false);
      onClose();

      showAcknowledgement({
        isSuccess: true,
        title: 'Payout Recorded Successfully',
        message: `Successfully registered prize payout of ₹${payoutAmount.toLocaleString('en-IN')} for member ${share.memberName}.`,
        operationType: 'RECORD MEMBER PAYOUT',
        referenceId: refId,
        ackTime: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to record payout');
      setLoading(false);
      showAcknowledgement({
        isSuccess: false,
        title: 'Payout Registration Failed',
        message: err?.message || 'The payout transaction could not be authorized.',
        operationType: 'RECORD MEMBER PAYOUT',
        referenceId: `ERR-${Date.now().toString().slice(-6)}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    }
  };

  const shareDisplayId = share.displayId || '----';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-400/30 text-emerald-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono-nums tracking-widest text-emerald-400 font-semibold block">
                {fund.fundName} · SETTLEMENT
              </span>
              <h2 className="text-sm font-bold text-white">
                Record Member Payout
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="px-5 pt-4 shrink-0">
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 rounded-xl font-mono-nums">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4 font-mono-nums overflow-y-auto flex-1">
          
          {/* Member Card Summary */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <div className="flex items-center justify-between text-xs font-sans">
              <span className="font-bold text-slate-900">{share.memberName}</span>
              <span className="font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200 font-mono-nums">
                {shareDisplayId}
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-sans block">
              Phone: {share.memberPhone} · Status: {share.hasClaimedPrize ? `Drawn (Month #${share.wonMonth})` : 'Undrawn'}
            </span>
          </div>

          {/* SHARE CONSECUTIVE CYCLE BILLING HISTORY CONTEXT */}
          <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
            <div className="flex items-center justify-between border-b border-slate-200/60 pb-1.5 font-sans">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                SHARE BILLING HISTORY CONTEXT
              </span>
              {onOpenEditBills && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEditBills();
                  }}
                  className="text-[11px] font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1 cursor-pointer"
                >
                  <FileText className="w-3 h-3" />
                  <span>[ Edit Bills ]</span>
                </button>
              )}
            </div>

            <div className="space-y-1 text-xs max-h-32 overflow-y-auto pr-1 font-mono-nums">
              {fundCycles.length === 0 ? (
                <span className="text-[11px] text-slate-400 italic font-sans">No cycles created yet.</span>
              ) : (
                fundCycles.map((c) => (
                  <div key={c.cycleId} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0 text-[11px]">
                    <span className="font-bold text-slate-800">Cycle #{c.cycleNumber}</span>
                    <span className="text-slate-600 font-medium">Bill: ₹{c.netInstallmentDue?.toLocaleString('en-IN') || FinancialEngine.formatCurrency(10000)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1 font-sans">
              Select Cycle Payout Belongs To *
            </label>
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition-all min-h-[44px]"
            >
              {fundCycles.length === 0 ? (
                <option value="">No cycles created yet</option>
              ) : (
                fundCycles.map((c) => (
                  <option key={c.cycleId} value={c.cycleId}>
                    Cycle #{c.cycleNumber} — {c.cycleName || 'Auction'} ({c.startDate})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1 font-sans">
              Payout Amount (₹) *
            </label>
            <input
              type="number"
              min="0"
              required
              value={payoutAmount}
              onChange={(e) => setPayoutAmount(Number(e.target.value))}
              placeholder="e.g. 800000"
              className="w-full px-3.5 py-2.5 text-base border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-emerald-500 font-bold text-emerald-800 min-h-[44px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                Payout Date
              </label>
              <input
                type="date"
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                Notes / Reference
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Bank Ref #88123"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 min-h-[44px]"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100 font-sans shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedCycleId}
              className="py-2.5 rounded-xl text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 disabled:opacity-50 transition cursor-pointer shadow-xs min-h-[44px]"
            >
              {loading ? 'Recording...' : 'Save Payout'}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
