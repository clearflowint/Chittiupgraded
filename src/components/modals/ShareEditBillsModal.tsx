import React, { useState, useEffect } from 'react';
import { useChitFund } from '../../context/ChitFundContext';
import { Fund, Share, Cycle, Payment } from '../../types';
import { FinancialEngine } from '../../services/financialEngine';
import { X, FileText, AlertCircle, Save, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';

interface ShareEditBillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
  share: Share;
  cycles: Cycle[];
  payments: Payment[];
}

export const ShareEditBillsModal: React.FC<ShareEditBillsModalProps> = ({
  isOpen,
  onClose,
  fund,
  share,
  cycles,
  payments,
}) => {
  const { saveCycleBills, payouts, showAcknowledgement } = useChitFund();

  const fundCycles = cycles.filter((c) => c.fundId === fund.fundId).sort((a, b) => a.cycleNumber - b.cycleNumber);

  // Map of cycleId -> billAmount
  const [cycleBillMap, setCycleBillMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Confirmation state
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initialMap: Record<string, number> = {};
      fundCycles.forEach((c) => {
        initialMap[c.cycleId] = c.netInstallmentDue || 0;
      });
      setCycleBillMap(initialMap);
      setError(null);
      setIsConfirming(false);
    }
  }, [isOpen, share.shareId, fund.fundId]);

  if (!isOpen) return null;

  // Find payout for this specific share
  const sharePayout = payouts.find((p) => p.shareId === share.shareId && p.status === 'disbursed');

  const handleBillChange = (cycleId: string, val: number) => {
    setCycleBillMap((prev) => ({
      ...prev,
      [cycleId]: Math.max(0, val),
    }));
  };

  const shareDisplayId = share.displayId || '----';

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsConfirming(true);
  };

  const handleConfirmSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Save bills for each cycle using the centralized billing reconciliation path
      for (const cycle of fundCycles) {
        const billVal = cycleBillMap[cycle.cycleId] ?? cycle.netInstallmentDue;
        await saveCycleBills({
          fundId: fund.fundId,
          cycleId: cycle.cycleId,
          shareBills: { [share.shareId]: billVal },
        });
      }

      setLoading(false);
      onClose();

      showAcknowledgement({
        isSuccess: true,
        title: 'Share Bills Updated',
        message: `Successfully adjusted and reconciled ledger bills for ${share.memberName} (${shareDisplayId}).`,
        operationType: 'EDIT SHARE BILLS',
        referenceId: `REF-${Date.now().toString().slice(-6)}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to update share cycle bills');
      setLoading(false);
      setIsConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-2 overflow-y-auto">
      <div className="w-full h-full sm:h-auto sm:max-h-[98vh] sm:max-w-2xl bg-white flex flex-col sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-4 py-3 sm:px-5 sm:py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-sky-600/30 border border-sky-400/30 text-sky-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] sm:text-[10px] uppercase font-mono-nums tracking-widest text-sky-400 font-semibold block">
                {fund.fundName} · MEMBER BILLING
              </span>
              <h2 className="text-xs sm:text-sm font-bold text-white">
                Edit Bills for Share [{shareDisplayId}]
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
          <div className="px-4 pt-3 shrink-0">
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 rounded-xl font-mono-nums">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* --- STEP 1: BILLING INPUTS VIEW --- */}
        {!isConfirming ? (
          <form onSubmit={handlePreSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 font-sans">
            
            {/* Detailed Member Info Strip with Drawn/Undrawn Status */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 sm:p-4 text-xs space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <span className="font-extrabold text-slate-900 block text-sm sm:text-base">{share.memberName}</span>
                  <span className="text-[10px] text-slate-500 font-mono-nums block mt-0.5">
                    Contact ID: {share.contactId} · Display ID: {shareDisplayId}
                  </span>
                </div>
                
                {/* Drawn / Undrawn Status Badge */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[9px] font-bold font-mono-nums px-2.5 py-1 rounded-lg border ${
                    share.hasClaimedPrize 
                      ? 'bg-amber-50 text-amber-700 border-amber-200' 
                      : 'bg-teal-50 text-emerald-700 border-teal-200'
                  }`}>
                    {share.hasClaimedPrize ? 'STATUS: DRAWN MEMBER' : 'STATUS: UNDRAWN'}
                  </span>
                  <span className={`text-[9px] font-bold font-mono-nums px-2.5 py-1 rounded-lg border ${
                    share.arrears > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                    {share.arrears > 0 ? `ARREARS: ₹${share.arrears.toLocaleString('en-IN')}` : `ADVANCE: ₹${share.advance.toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>

              {/* Draw details if member is drawn */}
              {share.hasClaimedPrize && (
                <div className="p-2.5 bg-amber-50/50 border border-amber-200/50 rounded-xl text-[10px] sm:text-xs text-amber-900 leading-normal flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block text-amber-950">Draw Ledger Record Found:</span>
                    <span>
                      This member won the prize in <strong>Cycle #{share.wonCycleNumber || 'N/A'}</strong>. 
                      {sharePayout && (
                        <span> Disbursed payout amount of <strong>₹{sharePayout.amount.toLocaleString('en-IN')}</strong> on {sharePayout.payoutDate}.</span>
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Cycles Billing List */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block ml-1">
                Historical Billing Matrix (Cycles 1 to {fundCycles.length})
              </span>

              {fundCycles.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-8 text-center">No cycles operated for this scheme yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  {fundCycles.map((c) => {
                    const billVal = cycleBillMap[c.cycleId] ?? c.netInstallmentDue;

                    return (
                      <div key={c.cycleId} className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-slate-50/30 transition-colors">
                        <div className="flex-1">
                          <span className="font-bold text-slate-800 block">
                            Cycle #{c.cycleNumber} — {c.cycleName || 'Auction'}
                          </span>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-mono-nums">
                              {c.startDate}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0">
                          <div className="text-right font-mono-nums">
                            <span className="text-[9px] text-slate-400 block font-sans font-bold uppercase tracking-tighter">Billed Obligation</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] text-slate-400 font-bold">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={billVal}
                              onChange={(e) => handleBillChange(c.cycleId, Number(e.target.value))}
                              className="w-24 px-2 py-1.5 text-xs sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl font-bold font-mono-nums text-slate-900 focus:outline-none focus:border-sky-500 transition-all min-h-[38px] text-right"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Accidental click protection: Buttons scroll naturally with form content */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2.5 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 transition cursor-pointer shadow-xs min-h-[44px] flex items-center justify-center gap-1.5"
              >
                <span>Review &amp; Confirm</span>
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>

          </form>
        ) : (
          /* --- STEP 2: SUMMARY CONFIRMATION SCREEN --- */
          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 font-sans">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-900 leading-normal">
                <span className="font-bold block text-amber-950">PROPOSED BILLING CONFIRMATION POP-UP</span>
                Please review the proposed billing changes below before submitting to the ledger database.
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
              <div className="bg-[#0f172a] text-white px-4 py-2.5 text-xs font-bold tracking-wider">
                PROPOSED SUMMARY FOR {share.memberName.toUpperCase()} ({shareDisplayId})
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-y-2 text-xs border-b border-slate-100 pb-3">
                  <div className="text-slate-500 font-medium">Member Name:</div>
                  <div className="text-slate-900 font-extrabold text-right">{share.memberName}</div>
                  <div className="text-slate-500 font-medium">Allotment Group:</div>
                  <div className="text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      share.hasClaimedPrize ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-emerald-800'
                    }`}>
                      {share.hasClaimedPrize ? 'Drawn Member' : 'Undrawn Member'}
                    </span>
                  </div>
                  {share.hasClaimedPrize && (
                    <>
                      <div className="text-slate-500 font-medium font-sans">Drawn Details:</div>
                      <div className="text-slate-900 font-bold text-right">Cycle #{share.wonCycleNumber} ({FinancialEngine.formatCurrency(sharePayout?.amount || 0)})</div>
                    </>
                  )}
                </div>

                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block font-mono-nums">Proposed Billings:</span>
                  <div className="max-h-[180px] overflow-y-auto divide-y divide-slate-100 bg-slate-50 border border-slate-200/60 rounded-xl px-3 py-1 font-mono-nums text-[11px]">
                    {fundCycles.map((c) => {
                      const billVal = cycleBillMap[c.cycleId] ?? c.netInstallmentDue;
                      return (
                        <div key={c.cycleId} className="py-2 flex justify-between gap-4">
                          <span className="text-slate-600 font-medium">Cycle #{c.cycleNumber} ({c.cycleName || 'Auction'})</span>
                          <span className="font-extrabold text-slate-900">₹{billVal.toLocaleString('en-IN')}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                type="button"
                onClick={() => setIsConfirming(false)}
                className="py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Go Back &amp; Edit</span>
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmSubmit}
                className="py-2.5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 transition cursor-pointer shadow-md min-h-[44px] flex items-center justify-center gap-1.5"
              >
                <span>{loading ? 'Committing...' : 'Yes, Confirm & Add'}</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
