import React, { useState } from 'react';
import { useChitFund } from '../../context/ChitFundContext';
import { FinancialEngine } from '../../services/financialEngine';
import { ImpactEngine } from '../../services/impactEngine';
import { Fund, Cycle, Share } from '../../types';
import { X, Award, AlertTriangle, ArrowRight, AlertCircle } from 'lucide-react';

interface DrawEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
  cycles: Cycle[];
  shares: Share[];
}

export const DrawEntryModal: React.FC<DrawEntryModalProps> = ({
  isOpen,
  onClose,
  fund,
  cycles,
  shares,
}) => {
  const { finalizeCycleSettlement } = useChitFund();

  const fundCycles = cycles.filter((c) => c.fundId === fund.fundId).sort((a, b) => a.cycleNumber - b.cycleNumber);
  const highestCycleNum = fundCycles.length > 0 ? fundCycles[fundCycles.length - 1].cycleNumber : 1;

  const [selectedCycleNumber, setSelectedCycleNumber] = useState<number>(highestCycleNum);
  const [selectedShareId, setSelectedShareId] = useState<string>(shares[0]?.shareId || '');
  const [winningBidAmount, setWinningBidAmount] = useState<number>(85000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const targetCycle = cycles.find(c => c.fundId === fund.fundId && c.cycleNumber === selectedCycleNumber) || {
    cycleId: `cy_${fund.fundId}_${selectedCycleNumber}`,
    managerId: fund.managerId,
    fundId: fund.fundId,
    cycleNumber: selectedCycleNumber,
    auctionDate: new Date().toISOString(),
    winningBidAmount: 0,
    organizerCommission: fund.totalPool * (fund.commissionPercent / 100),
    dividendPool: 0,
    dividendPerShare: 0,
    grossInstallment: Math.round(fund.totalPool / fund.totalCycles),
    netInstallmentDue: Math.round(fund.totalPool / fund.totalCycles),
    winnerNetPayout: fund.totalPool,
    isAuctionClosed: false,
    status: 'bidding' as const,
    createdAt: new Date().toISOString(),
  };

  const targetShare = shares.find(s => s.shareId === selectedShareId) || shares[0];

  // Run Impact Analyzer from ImpactEngine
  const impact = targetShare
    ? ImpactEngine.analyzeDrawChange(
        fund,
        cycles,
        targetCycle,
        targetShare,
        shares,
        winningBidAmount
      )
    : null;

  const handleConfirm = async () => {
    if (!targetShare) {
      setError('Please select a member share.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await finalizeCycleSettlement({
        fundId: fund.fundId,
        cycleNumber: selectedCycleNumber,
        winnerShareId: targetShare.shareId,
        winningBidAmount,
      });

      setLoading(false);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to assign draw winner');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header - Dark Design */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center">
              <Award className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide">RECORD DRAW WINNER</h2>
              <p className="text-[10px] text-slate-400 font-mono-nums uppercase tracking-tight">
                {fund.fundName} · Assignment
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

          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  Target Cycle (#)
                </label>
                <select
                  value={selectedCycleNumber}
                  onChange={(e) => setSelectedCycleNumber(Number(e.target.value))}
                  className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums font-medium transition-all bg-white"
                >
                  {(fundCycles.length > 0 ? fundCycles.map(c => c.cycleNumber) : [1]).map((m) => (
                    <option key={m} value={m}>
                      Cycle #{m} {m === highestCycleNum ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  Winning Bid Discount (₹)
                </label>
                <input
                  type="number"
                  min="5000"
                  max={fund.totalPool}
                  step="1000"
                  value={winningBidAmount}
                  onChange={(e) => setWinningBidAmount(Number(e.target.value))}
                  className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums font-bold transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                Select Candidate Share
              </label>
              <select
                value={selectedShareId}
                onChange={(e) => setSelectedShareId(e.target.value)}
                className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition-all bg-white"
              >
                {shares.map((s) => (
                  <option key={s.shareId} value={s.shareId}>
                    Share #{s.shareNumber} · {s.memberName} {s.hasClaimedPrize ? `(Won Cycle #${s.wonCycleNumber})` : '(Eligible)'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Impact Analyzer Feedback */}
          {impact && (
            <div className="space-y-4">
              {/* Warnings / Conflicts */}
              {impact.warnings.length > 0 && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] text-amber-900 space-y-2 shadow-sm">
                  <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Integrity Check</span>
                  </div>
                  <ul className="space-y-1 ml-6 list-disc marker:text-amber-400">
                    {impact.warnings.map((w, i) => (
                      <li key={i} className="leading-relaxed font-medium">{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recalculation Preview */}
              <div className="bg-[#0f172a] text-white rounded-2xl p-5 space-y-3 font-mono-nums border border-slate-800 shadow-inner">
                <div className="text-[9px] uppercase font-bold tracking-widest text-sky-400 font-sans border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span>IMPACT ANALYSIS PROJECTION</span>
                  <span className="text-slate-500 font-normal">Calculated</span>
                </div>
                
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-1">
                  <div className="min-w-0">
                    <span className="text-slate-400 block font-sans text-[9px] uppercase tracking-wider">Winner Payout</span>
                    <span className="font-bold text-emerald-400 text-sm block truncate">
                      {FinancialEngine.formatCurrency(fund.totalPool - winningBidAmount)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block font-sans text-[9px] uppercase tracking-wider">Dividend / Share</span>
                    <span className="font-bold text-white text-sm block truncate">
                      {FinancialEngine.formatCurrency(impact.newDividendPerShare)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block font-sans text-[9px] uppercase tracking-wider">Net Payable</span>
                    <span className="font-bold text-white text-sm block truncate">
                      {FinancialEngine.formatCurrency(impact.newNetPayable)}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-400 block font-sans text-[9px] uppercase tracking-wider">Affected Shares</span>
                    <span className="font-bold text-sky-400 text-sm block truncate">
                      {impact.affectedShareCount} ALLOTMENTS
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action buttons */}
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
              disabled={loading || (impact ? !impact.canProceed : false)}
              onClick={handleConfirm}
              className="py-3 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2 shadow-md min-h-[48px]"
            >
              {loading ? 'Processing...' : 'Confirm Winner'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
