import React, { useState, useMemo, useEffect } from 'react';
import { useChitFund } from '../../context/ChitFundContext';
import { useAuth } from '../../context/AuthContext';
import { FinancialEngine } from '../../services/financialEngine';
import { Fund, Cycle, Share, Payment, Payout } from '../../types';
import { X, Award, AlertTriangle, ArrowRight, AlertCircle, Save, Info, Calculator, CreditCard } from 'lucide-react';

interface DrawAssignmentBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
  share: Share;
  cycles: Cycle[];
  payments: Payment[];
  payouts: Payout[];
}

export const DrawAssignmentBillingModal: React.FC<DrawAssignmentBillingModalProps> = ({
  isOpen,
  onClose,
  fund,
  share,
  cycles,
  payments,
  payouts,
}) => {
  const { tenant } = useAuth();
  const { executeDrawAssignment, billings } = useChitFund();

  const fundCycles = useMemo(() => 
    cycles.filter(c => c.fundId === fund.fundId).sort((a, b) => a.cycleNumber - b.cycleNumber),
  [cycles, fund.fundId]);

  const latestCycleNum = fundCycles.length > 0 ? fundCycles[fundCycles.length - 1].cycleNumber : 1;

  // 1. Initial State based on current Share status
  const existingPayout = useMemo(() => 
    payouts.find(p => p.shareId === share.shareId && p.status === 'disbursed'),
  [payouts, share.shareId]);

  const [drawStatus, setDrawStatus] = useState<'drawn' | 'undrawn'>(share.status === 'drawn' ? 'drawn' : 'undrawn');
  const [selectedCycleNum, setSelectedCycleNum] = useState<number>(share.wonMonth || fund.currentMonth || 1);
  const [payoutAmount, setPayoutAmount] = useState<number>(existingPayout?.amount || fund.totalPool);
  
  // billingChanges: map of cycleNumber -> new billAmount (empty means no change)
  const [billingChanges, setBillingChanges] = useState<Record<number, string>>({});

  // 2. Helper to get existing bill amount
  const getExistingBill = (cycleId: string) => {
    const existing = billings.find(b => b.shareId === share.shareId && b.cycleId === cycleId);
    return existing ? existing.billAmount : 0;
  };

  // 3. Affected Billing Window Logic
  const affectedCycles = useMemo(() => {
    if (drawStatus === 'undrawn') {
      // If revoking, we show from the PREVIOUS draw cycle to latest
      const startNum = share.wonMonth || 1;
      return fundCycles.filter(c => c.cycleNumber >= startNum && c.cycleNumber <= latestCycleNum);
    } else {
      // If assigning or reassigning, we show from the NEW selected draw cycle to latest
      return fundCycles.filter(c => c.cycleNumber >= selectedCycleNum && c.cycleNumber <= latestCycleNum);
    }
  }, [drawStatus, selectedCycleNum, fundCycles, latestCycleNum, share.wonMonth]);

  // Sync billing changes state (reset overrides when window or share changes)
  useEffect(() => {
    if (isOpen) {
      setBillingChanges({});
    }
  }, [isOpen, share.shareId, selectedCycleNum, drawStatus]);

  // Reset to current share state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDrawStatus(share.status === 'drawn' ? 'drawn' : 'undrawn');
      setSelectedCycleNum(share.wonMonth || fund.currentMonth || 1);
      setPayoutAmount(existingPayout?.amount || fund.totalPool);
    }
  }, [isOpen, share, existingPayout, fund.currentMonth]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const shareDisplayId = share.displayId || '----';

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const newDrawCycle = drawStatus === 'drawn' 
        ? fundCycles.find(c => c.cycleNumber === selectedCycleNum)
        : null;

      const previousDrawCycle = share.wonMonth 
        ? fundCycles.find(c => c.cycleNumber === share.wonMonth)
        : null;

      // Filter and convert billingChanges to numeric overrides
      const numericChanges: Record<number, number> = {};
      Object.entries(billingChanges).forEach(([num, val]) => {
        if (val !== '') {
          numericChanges[Number(num)] = Number(val);
        }
      });

      await executeDrawAssignment({
        managerId: fund.managerId,
        fundId: fund.fundId,
        shareId: share.shareId,
        previousDrawCycleId: previousDrawCycle?.cycleId || null,
        newDrawCycleId: newDrawCycle?.cycleId || null,
        payoutAmount: drawStatus === 'drawn' ? payoutAmount : 0,
        billingChanges: numericChanges,
      });

      setLoading(false);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update draw and billing records');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header - Consolidated Title */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 flex items-center justify-center">
              <Award className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide uppercase">Draw Assignment & Billing</h2>
              <p className="text-[10px] text-slate-400 font-mono-nums uppercase tracking-tight">
                {fund.fundName} · {shareDisplayId} · Authoritative Operation
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

        {/* Share Information Strip */}
        <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Affected Share</span>
            <span className="text-sm font-black text-slate-900 truncate block">{share.memberName}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Current Status</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border uppercase ${
              share.status === 'drawn' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-teal-50 text-teal-700 border-teal-200'
            }`}>
              {share.status === 'drawn' ? `Drawn (M${share.wonMonth})` : 'Undrawn'}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Draw Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                Target Status
              </label>
              <select
                value={drawStatus}
                onChange={(e) => setDrawStatus(e.target.value as any)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-bold transition-all"
              >
                <option value="undrawn">Undrawn / Revoke</option>
                <option value="drawn">Drawn / Assigned</option>
              </select>
            </div>

            {drawStatus === 'drawn' && (
              <>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                    Draw Cycle (Month #)
                  </label>
                  <select
                    value={selectedCycleNum}
                    onChange={(e) => setSelectedCycleNum(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums font-bold transition-all"
                  >
                    {fundCycles.map(c => (
                      <option key={c.cycleId} value={c.cycleNumber}>
                        Cycle #{c.cycleNumber} {c.cycleNumber === fund.currentMonth ? '(Active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                    Payout Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={payoutAmount}
                    onChange={(e) => setPayoutAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums font-bold text-emerald-700 transition-all"
                  />
                </div>
              </>
            )}
          </div>

          {/* Affected Billing Matrix */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2">
                <Calculator className="w-3.5 h-3.5" />
                <span>Affected Billing Window</span>
              </h3>
              <span className="text-[9px] text-slate-400 font-bold uppercase">M{affectedCycles[0]?.cycleNumber || 1} — M{latestCycleNum}</span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/30">
              <div className="divide-y divide-slate-100">
                {affectedCycles.map((c) => {
                  const prevBill = getExistingBill(c.cycleId);
                  const newBillStr = billingChanges[c.cycleNumber] ?? '';
                  const hasChange = newBillStr !== '';
                  const newBillNum = hasChange ? Number(newBillStr) : prevBill;
                  
                  return (
                    <div key={c.cycleId} className="p-4 bg-white hover:bg-slate-50/50 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        {/* Cycle Title & Change Indicator */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-900">Cycle #{c.cycleNumber}</span>
                            <span className="text-[10px] text-slate-400 font-medium">({c.startDate})</span>
                          </div>
                          {hasChange && (
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 bg-sky-50 text-sky-700 rounded-lg border border-sky-100">
                              <ArrowRight className="w-2.5 h-2.5" />
                              <span className="text-[10px] font-bold font-mono-nums">
                                ₹{FinancialEngine.formatNumber(prevBill)} → ₹{FinancialEngine.formatNumber(newBillNum)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Comparison Inputs */}
                        <div className="flex items-center gap-4">
                          <div className="space-y-1">
                            <label className="block text-[9px] font-black text-slate-400 uppercase tracking-tighter ml-1">Previous Bill</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">₹</span>
                              <div className="w-28 pl-6 pr-3 py-2 text-xs border border-slate-100 bg-slate-50 text-slate-500 rounded-lg font-mono-nums font-bold text-right cursor-not-allowed">
                                {FinancialEngine.formatNumber(prevBill)}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[9px] font-black text-sky-500 uppercase tracking-tighter ml-1">New Bill</label>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-sky-400">₹</span>
                              <input
                                type="number"
                                value={newBillStr}
                                placeholder="No Change"
                                onChange={(e) => setBillingChanges(prev => ({ ...prev, [c.cycleNumber]: e.target.value }))}
                                className={`w-32 pl-6 pr-3 py-2 text-xs border rounded-lg focus:outline-none transition-all font-mono-nums font-black text-right ${
                                  hasChange 
                                    ? 'border-sky-300 bg-sky-50/30 focus:border-sky-500' 
                                    : 'border-slate-200 bg-white focus:border-sky-500'
                                }`}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Operation Consequences Summary */}
          <div className="bg-[#0f172a] text-white rounded-2xl p-5 space-y-3 font-mono-nums shadow-inner border border-slate-800">
            <div className="text-[9px] uppercase font-bold tracking-widest text-sky-400 font-sans border-b border-slate-800 pb-2 flex items-center justify-between">
              <span>Authoritative Operation Summary</span>
              <Info className="w-3.5 h-3.5 text-slate-500" />
            </div>
            
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 pt-1 text-xs">
              <div>
                <span className="text-slate-400 block font-sans text-[9px] uppercase tracking-wider mb-0.5">Final Status</span>
                <span className="font-bold uppercase tracking-tight">
                  {drawStatus === 'drawn' ? `Drawn (Month #${selectedCycleNum})` : 'Undrawn / Revoked'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-sans text-[9px] uppercase tracking-wider mb-0.5">Payout Impact</span>
                <span className={`font-bold ${drawStatus === 'drawn' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {drawStatus === 'drawn' ? FinancialEngine.formatCurrency(payoutAmount) : 'Revoked'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-sans text-[9px] uppercase tracking-wider mb-0.5">Billing Changes</span>
                <span className="font-bold text-sky-300">
                  {Object.values(billingChanges).filter(v => v !== '').length} Modified
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-sans text-[9px] uppercase tracking-wider mb-0.5">Atomic Safety</span>
                <span className="font-bold text-emerald-500 uppercase tracking-tighter">Verified Commit</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 p-5 border-t border-slate-100 bg-white shrink-0">
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
            onClick={handleSave}
            className="py-3 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 transition cursor-pointer flex items-center justify-center gap-2 shadow-md min-h-[48px]"
          >
            {loading ? 'Committing...' : 'Confirm & Save Changes'}
            <Save className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
