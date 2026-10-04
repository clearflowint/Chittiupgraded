import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChitFund } from '../../context/ChitFundContext';
import { FinancialEngine } from '../../services/financialEngine';
import { ImpactEngine } from '../../services/impactEngine';
import { Fund, Cycle, Share } from '../../types';
import { X, Award, AlertTriangle, ShieldAlert } from 'lucide-react';

interface DrawStatusCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
  cycles: Cycle[];
  shares: Share[];
  targetShare?: Share | null;
}

export const DrawStatusCorrectionModal: React.FC<DrawStatusCorrectionModalProps> = ({
  isOpen,
  onClose,
  fund,
  cycles,
  shares,
  targetShare: initialTargetShare,
}) => {
  const { tenant } = useAuth();
  const { updateDrawStatus } = useChitFund();

  const [selectedShareId, setSelectedShareId] = useState<string>(
    initialTargetShare?.shareId || shares[0]?.shareId || ''
  );

  const availableCycles = cycles
    .filter((c) => c.fundId === fund.fundId)
    .sort((a, b) => a.cycleNumber - b.cycleNumber);

  const currentShare = shares.find((s) => s.shareId === selectedShareId) || shares[0];

  const [selectedMonth, setSelectedMonth] = useState<string>(
    currentShare?.hasClaimedPrize && currentShare?.wonCycleNumber
      ? currentShare.wonCycleNumber.toString()
      : 'undrawn'
  );

  const [reason, setReason] = useState<string>('Audit correction of auction record');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const managerDisplay = tenant?.email
    ? tenant.email.replace(/(.{3})(.*)(@.*)/, '$1***$3')
    : tenant?.name || 'Authorized Manager';

  const shareDisplayId = currentShare ? (currentShare.displayId || '----') : '----';

  const willBeDrawn = selectedMonth !== 'undrawn';
  const targetWonMonthNum = willBeDrawn ? parseInt(selectedMonth, 10) : null;
  const targetCycle = targetWonMonthNum
    ? availableCycles.find((c) => c.cycleNumber === targetWonMonthNum) || availableCycles[0]
    : availableCycles[0];

  // Impact analysis
  const impact = currentShare && targetCycle
    ? ImpactEngine.analyzeDrawChange(
        fund,
        availableCycles,
        targetCycle,
        currentShare,
        shares,
        targetCycle?.winningBidAmount || Math.round(fund.totalPool * 0.2)
      )
    : null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await updateDrawStatus({
        fundId: fund.fundId,
        cycleId: targetCycle.cycleId,
        shareId: currentShare.shareId,
        action: willBeDrawn ? 'SET_DRAWN' : 'SET_UNDRAWN',
        winningBidAmount: targetCycle.winningBidAmount,
        reason: reason.trim() || 'Winner status adjustment',
      });

      setLoading(false);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update winner status');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold tracking-wide">Assign or Revoke Winner Status</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Read-Only Context Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 font-mono-nums text-xs space-y-1 text-slate-800 shrink-0">
          <div>
            <span className="font-semibold">Tenant / Manager ID: </span>
            <span className="text-slate-600">{managerDisplay}</span>
          </div>
          <div>
            <span className="font-semibold">Fund ID: </span>
            <span className="text-slate-600">{fund.displayId || fund.fundId} ({fund.fundName})</span>
          </div>
          <div>
            <span className="font-semibold">Share ID: </span>
            <span className="text-slate-600">[{shareDisplayId}]</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          
          {/* Member Box */}
          {currentShare && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-sm">
                  {currentShare.memberName}
                </span>
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono-nums font-bold bg-slate-200 text-slate-800">
                  {shareDisplayId}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Select a cycle up to Active Cycle (Cycle #{fund.currentCycle}) to assign win status, or revoke draw status in case of wrong entry.
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-xl">
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            
            {/* Winning Cycle Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Winning Cycle (Cycle 1 to Cycle #{fund.currentCycle})
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 min-h-[44px]"
              >
                <option value="undrawn">-- Undrawn (No Win Yet) --</option>
                {availableCycles.slice(0, fund.currentCycle).map((c) => (
                  <option key={c.cycleId} value={c.cycleNumber.toString()}>
                    Cycle {c.cycleNumber}
                  </option>
                ))}
              </select>
            </div>

            {/* Impact / Conflict Preview */}
            {impact && impact.warnings.length > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-amber-800">
                  <ShieldAlert className="w-4 h-4 shrink-0 text-amber-700" />
                  <span>Historical Change Detected</span>
                </div>
                <p className="text-xs leading-relaxed text-amber-800">
                  Changing winner for Cycle #{targetWonMonthNum || currentShare?.wonCycleNumber} will trigger authoritative re-calculation across all affected subsequent cycles.
                </p>
                {impact.warnings.map((w, idx) => (
                  <div key={idx} className="text-xs font-mono-nums pl-2">· {w}</div>
                ))}
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
                disabled={loading}
                className="py-2.5 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 transition cursor-pointer shadow-xs min-h-[44px]"
              >
                {loading ? 'Saving...' : 'Save Winner'}
              </button>
            </div>

          </form>

        </div>

      </div>
    </div>
  );
};
