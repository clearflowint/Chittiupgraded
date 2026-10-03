import React, { useState, useEffect } from 'react';
import { useChitFund } from '../../context/ChitFundContext';
import { FinancialEngine } from '../../services/financialEngine';
import { Fund, Cycle, Share } from '../../types';
import { X, Calculator, CheckCircle2, AlertCircle, ArrowRight, DollarSign } from 'lucide-react';

interface CycleBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
  cycle: Cycle;
  shares: Share[];
}

export const CycleBillingModal: React.FC<CycleBillingModalProps> = ({
  isOpen,
  onClose,
  fund,
  cycle,
  shares,
}) => {
  const { finalizeCycleSettlement, showAcknowledgement } = useChitFund();

  // Actual Manager Inputs for this Cycle
  const [netInstallmentDue, setNetInstallmentDue] = useState<number>(
    cycle.netInstallmentDue || 15000
  );
  const [winnerNetPayout, setWinnerNetPayout] = useState<number>(
    cycle.winnerNetPayout || 800000
  );
  const [organizerCommission, setOrganizerCommission] = useState<number>(
    cycle.organizerCommission || 25000
  );
  const [selectedShareId, setSelectedShareId] = useState<string>(
    cycle.winnerShareId || (shares.find(s => !s.hasClaimedPrize)?.shareId || '')
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lock body scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const drawnShares = shares.filter(s => s.hasClaimedPrize);
  const undrawnShares = shares.filter(s => !s.hasClaimedPrize);

  const totalExpectedCollection = netInstallmentDue * fund.numberOfShares;

  const handleApply = async () => {
    if (netInstallmentDue < 0) {
      setError('Billing amount per share cannot be negative');
      return;
    }
    if (winnerNetPayout < 0) {
      setError('Payout amount cannot be negative');
      return;
    }
    if (organizerCommission < 0) {
      setError('Manager commission cannot be negative');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await finalizeCycleSettlement({
        fundId: fund.fundId,
        cycleNumber: cycle.cycleNumber,
        winnerShareId: selectedShareId || '',
        winningBidAmount: 0,
        netInstallmentDueOverride: netInstallmentDue,
        winnerNetPayoutOverride: winnerNetPayout,
        organizerCommissionOverride: organizerCommission,
      });
      setLoading(false);
      onClose();

      showAcknowledgement({
        isSuccess: true,
        title: 'Billing Reconciled Successfully',
        message: `Successfully finalized and materialized billing of ₹${netInstallmentDue} per share for Month #${cycle.cycleNumber}.`,
        operationType: 'FINALIZE CYCLE BILLINGS',
        referenceId: `CY-BILL-${cycle.cycleNumber}-${Date.now().toString().slice(-6)}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to finalize cycle billing');
      setLoading(false);
      showAcknowledgement({
        isSuccess: false,
        title: 'Billing Reconciliation Failed',
        message: err?.message || 'Could not finalize cycle billing state.',
        operationType: 'FINALIZE CYCLE BILLINGS',
        referenceId: `ERR-${Date.now().toString().slice(-6)}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header - Dark Design */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center">
              <Calculator className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide">CYCLE #{cycle.cycleNumber} FINANCIAL INPUT</h2>
              <p className="text-[10px] text-slate-400 font-mono-nums uppercase tracking-tight">
                {fund.fundName} · Settlement
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Manager Actual Cycle Inputs */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Input 1: Billing per Share */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  Installment / Billing (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={netInstallmentDue}
                  onChange={(e) => setNetInstallmentDue(Number(e.target.value))}
                  className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums font-bold transition-all"
                />
                <span className="text-[10px] text-slate-400 mt-1.5 ml-1 block font-mono-nums">
                  Total: {FinancialEngine.formatCurrency(totalExpectedCollection)}
                </span>
              </div>

              {/* Input 2: Winner Net Payout */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  Winner Net Payout (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5000"
                  required
                  value={winnerNetPayout}
                  onChange={(e) => setWinnerNetPayout(Number(e.target.value))}
                  className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums font-bold text-emerald-700 transition-all"
                />
                <span className="text-[10px] text-slate-400 mt-1.5 ml-1 block">
                  Actual prize awarded
                </span>
              </div>

              {/* Input 3: Manager Commission */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  Manager Commission (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={organizerCommission}
                  onChange={(e) => setOrganizerCommission(Number(e.target.value))}
                  className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums font-bold transition-all"
                />
                <span className="text-[10px] text-slate-400 mt-1.5 ml-1 block">
                  Actual fee earned
                </span>
              </div>
            </div>

            {/* Winner Share Allotment */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                Assign Prize Winner Share (Optional)
              </label>
              <select
                value={selectedShareId}
                onChange={(e) => setSelectedShareId(e.target.value)}
                className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium bg-white transition-all"
              >
                <option value="">-- No Winner Assigned --</option>
                {undrawnShares.map((s) => (
                  <option key={s.shareId} value={s.shareId}>
                    Share #{s.shareNumber} · {s.memberName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Financial Consequence Summary */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 space-y-3 font-mono-nums text-xs border border-slate-800 shadow-inner">
            <div className="text-[10px] uppercase font-bold tracking-widest text-sky-400 font-sans border-b border-slate-800 pb-2 flex justify-between">
              <span>Settlement Summary</span>
              <span className="text-slate-500">Auto-Calculated</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
              <div className="min-w-0">
                <span className="text-slate-400 block font-sans text-[9px] uppercase tracking-wider">Per-Share</span>
                <span className="font-bold text-white text-sm truncate block">
                  {FinancialEngine.formatCurrency(netInstallmentDue)}
                </span>
              </div>

              <div className="min-w-0">
                <span className="text-slate-400 block font-sans text-[9px] uppercase tracking-wider">Total Collection</span>
                <span className="font-bold text-sky-300 text-sm truncate block">
                  {FinancialEngine.formatCurrency(totalExpectedCollection)}
                </span>
              </div>

              <div className="min-w-0">
                <span className="text-slate-400 block font-sans text-[9px] uppercase tracking-wider">Prize Payout</span>
                <span className="font-bold text-emerald-400 text-sm truncate block">
                  {FinancialEngine.formatCurrency(winnerNetPayout)}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="py-3 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[48px]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleApply}
              className="py-3 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2 shadow-md min-h-[48px]"
            >
              {loading ? 'Finalizing...' : 'Confirm Settlement'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
