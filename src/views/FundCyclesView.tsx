import React, { useState } from 'react';
import { useChitFund } from '../context/ChitFundContext';
import { FinancialEngine } from '../services/financialEngine';
import { ImpactEngine } from '../services/impactEngine';
import { Fund } from '../types';
import { 
  ArrowLeft, 
  RotateCw, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Award, 
  DollarSign,
  ArrowRight
} from 'lucide-react';

interface FundCyclesViewProps {
  fund: Fund;
  onNavigate: (tab: string) => void;
}

export const FundCyclesView: React.FC<FundCyclesViewProps> = ({ fund, onNavigate }) => {
  const { cycles, shares, finalizeCycleSettlement } = useChitFund();

  // Find active/bidding cycle or latest
  const fundCycles = cycles.filter(c => c.fundId === fund.fundId);
  const activeCycle = fundCycles.find(c => !c.isAuctionClosed && c.status === 'bidding') ||
    fundCycles.find(c => c.cycleNumber === fund.currentMonth) ||
    fundCycles[0];

  const fundShares = shares.filter(s => s.fundId === fund.fundId);
  const eligibleShares = fundShares.filter(s => !s.hasClaimedPrize);

  const [selectedShareId, setSelectedShareId] = useState<string>(eligibleShares[0]?.shareId || '');
  const [currentBidAmount, setCurrentBidAmount] = useState<number>(
    activeCycle?.winningBidAmount || Math.round(fund.totalPool * 0.18) // 18% default bid discount
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const minBid = Math.round(fund.totalPool * (fund.commissionPercent / 100)); // Organizer Commission
  const maxBid = Math.round(fund.totalPool * 0.35); // 35% cap

  // Real-time mathematical calculation
  const calc = FinancialEngine.calculateCycle({
    totalPool: fund.totalPool,
    totalMonths: fund.totalMonths,
    totalShares: fund.numberOfShares,
    winningBidAmount: currentBidAmount,
    commissionPercent: fund.commissionPercent,
  });

  const selectedShare = fundShares.find(s => s.shareId === selectedShareId);

  const handleFinalize = async () => {
    if (!activeCycle) {
      setError('No active cycle found to finalize');
      return;
    }
    if (!selectedShareId) {
      setError('Please select an eligible winner share.');
      return;
    }
    if (currentBidAmount < minBid) {
      setError(`Bid discount cannot be lower than the organizer commission (${FinancialEngine.formatCurrency(minBid)})`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await finalizeCycleSettlement({
        fundId: fund.fundId,
        cycleNumber: activeCycle.cycleNumber,
        winnerShareId: selectedShareId,
        winningBidAmount: currentBidAmount,
      });

      setLoading(false);
      setSuccessMsg(`Month #${activeCycle.cycleNumber} successfully finalized! Winner: ${selectedShare?.memberName}`);
      setTimeout(() => {
        onNavigate(`fund_ledger_${fund.fundId}`);
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'Failed to finalize cycle settlement');
      setLoading(false);
    }
  };

  if (fundCycles.length === 0) {
    return (
      <div className="space-y-6 pb-16">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <button
            onClick={() => onNavigate(`fund_${fund.fundId}`)}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-950">
            Cycle Settlement &amp; Billing Room
          </h1>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 shadow-xs">
          <div className="w-16 h-16 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center">
            <RotateCw className="w-8 h-8 text-slate-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">NO CYCLE AVAILABLE</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Create a cycle first to access cycle-specific settlement operations.
            </p>
          </div>
          <button
            onClick={() => onNavigate(`fund_${fund.fundId}`)}
            className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer shadow-xs"
          >
            Go to Chitti Workspace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate(`fund_${fund.fundId}`)}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-950">
                Monthly Cycle &amp; Billing Room
              </h1>
              <span className="text-xs font-mono-nums text-slate-400">·</span>
              <span className="text-xs font-mono-nums font-semibold text-emerald-800">
                Month #{activeCycle?.cycleNumber || 1}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono-nums mt-0.5">
              Cycle settlement room · Auto-calculation of next month's dividend and installment obligations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono-nums font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 border border-slate-200">
            Pool: {FinancialEngine.formatCurrency(fund.totalPool)}
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Split: Bidding Room vs Live Settlement Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Bidding Console (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="bg-white border border-slate-200 p-6 space-y-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-mono-nums uppercase tracking-widest text-slate-400 font-semibold">
                  CYCLE SETTLEMENT
                </span>
                <h2 className="text-base font-serif font-bold text-slate-950 mt-0.5">
                  Cycle Discount Input (Reverse Bidding)
                </h2>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono-nums font-semibold text-slate-900 block">
                  Eligible Bidders: {eligibleShares.length} / {fundShares.length}
                </span>
                <span className="text-[10px] text-slate-400 font-mono-nums">Undrawn members only</span>
              </div>
            </div>

            {/* Bid Discount Controller */}
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span>Winning Bid Discount Amount:</span>
                  <span className="font-mono-nums text-xl font-bold text-slate-950">
                    {FinancialEngine.formatCurrency(currentBidAmount)}
                  </span>
                </div>
                <input
                  type="range"
                  min={minBid}
                  max={maxBid}
                  step="1000"
                  value={currentBidAmount}
                  onChange={(e) => setCurrentBidAmount(Number(e.target.value))}
                  className="w-full mt-2 accent-emerald-700 cursor-pointer"
                />
                <div className="flex justify-between text-[11px] font-mono-nums text-slate-400 mt-1">
                  <span>Min: {FinancialEngine.formatCurrency(minBid)} (Comm.)</span>
                  <span>Max Cap: {FinancialEngine.formatCurrency(maxBid)} (35%)</span>
                </div>
              </div>

              {/* Quick Bid Increment Buttons */}
              <div className="space-y-1.5 pt-1">
                <span className="text-xs text-slate-500 font-sans block">Quick Bid:</span>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                  {[50000, 75000, 80000, 90000, 100000, 120000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCurrentBidAmount(amt)}
                      className="px-2.5 py-2 text-xs font-semibold font-mono-nums border border-slate-200 bg-slate-50 hover:bg-slate-100 transition cursor-pointer rounded-lg text-center min-h-[40px] flex items-center justify-center"
                    >
                      {FinancialEngine.formatCurrency(amt)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Select Winner Share */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
                Assign Winning Bidder Share
              </label>
              <select
                value={selectedShareId}
                onChange={(e) => setSelectedShareId(e.target.value)}
                className="mt-1.5 w-full px-3 py-2 text-sm border border-slate-300 focus:outline-none focus:border-emerald-600 bg-white"
              >
                {eligibleShares.map((s) => (
                  <option key={s.shareId} value={s.shareId}>
                    Share #{s.shareNumber} · {s.memberName} ({s.memberPhone})
                  </option>
                ))}
              </select>
            </div>

            {/* Commit Settlement Button */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="text-xs text-slate-500 font-mono-nums">
                Settlement Date: {activeCycle?.auctionDate || new Date().toISOString().split('T')[0]}
              </div>

              <button
                type="button"
                disabled={loading || eligibleShares.length === 0}
                onClick={handleFinalize}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer flex items-center gap-2 shadow-xs"
              >
                <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                <span>{loading ? 'Finalizing Cycle...' : `Close Cycle & Disburse Month #${activeCycle?.cycleNumber}`}</span>
              </button>
            </div>

          </div>

          {/* Eligible Member List */}
          <div className="bg-white border border-slate-200 p-5 space-y-3">
            <h3 className="text-sm font-serif font-bold text-slate-950">
              Eligible Undrawn Participants ({eligibleShares.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {eligibleShares.map((s) => (
                <div 
                  key={s.shareId}
                  onClick={() => setSelectedShareId(s.shareId)}
                  className={`p-2.5 border cursor-pointer transition flex items-center justify-between ${
                    selectedShareId === s.shareId
                      ? 'border-emerald-600 bg-emerald-50/50'
                      : 'border-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div>
                    <span className="font-semibold text-slate-900">Share #{s.shareNumber}</span>
                    <span className="text-slate-600 font-sans block">{s.memberName}</span>
                  </div>
                  <span className="text-[11px] font-mono-nums text-slate-400">
                    Paid: {FinancialEngine.formatCurrency(s.totalPaid)}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right: Live Mathematical Settlement Preview (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          
          <div className="bg-slate-900 text-white p-5 space-y-4">
            <div className="border-b border-slate-800 pb-2">
              <span className="text-[10px] font-mono-nums uppercase tracking-widest text-emerald-400 font-semibold">
                FINANCIAL OUTCOMES
              </span>
              <h3 className="text-base font-serif font-bold text-white mt-0.5">
                Settlement Matrix
              </h3>
            </div>

            <div className="space-y-3 font-mono-nums text-xs">
              
              {/* Winner Net Payout */}
              <div className="bg-slate-800/80 p-3.5 border border-slate-700/60 space-y-1">
                <span className="text-[10px] uppercase text-emerald-400 font-semibold block font-sans">
                  Winner Net Prize Payout
                </span>
                <span className="text-xl font-bold text-white block">
                  {FinancialEngine.formatCurrency(calc.winnerNetPayout)}
                </span>
                <span className="text-[10px] text-slate-400 font-sans block">
                  Pool ({FinancialEngine.formatCurrency(fund.totalPool)}) − Discount ({FinancialEngine.formatCurrency(currentBidAmount)})
                </span>
              </div>

              {/* Dividend Per Member */}
              <div className="bg-slate-800/80 p-3.5 border border-slate-700/60 space-y-1">
                <span className="text-[10px] uppercase text-slate-400 font-semibold block font-sans">
                  Dividend Benefit / Member
                </span>
                <span className="text-xl font-bold text-emerald-400 block">
                  +{FinancialEngine.formatCurrency(calc.dividendPerShare)}
                </span>
                <span className="text-[10px] text-slate-400 font-sans block">
                  Dividend Pool ({FinancialEngine.formatCurrency(calc.dividendPool)}) ÷ {fund.numberOfShares} Shares
                </span>
              </div>

              {/* Next Net Monthly Installment */}
              <div className="bg-slate-800/80 p-3.5 border border-slate-700/60 space-y-1">
                <span className="text-[10px] uppercase text-slate-400 font-semibold block font-sans">
                  Net Monthly Payable / Member
                </span>
                <span className="text-xl font-bold text-white block">
                  {FinancialEngine.formatCurrency(calc.netInstallmentDue)}
                </span>
                <span className="text-[10px] text-slate-400 font-sans block">
                  Gross ({FinancialEngine.formatCurrency(calc.grossInstallment)}) − Dividend ({FinancialEngine.formatCurrency(calc.dividendPerShare)})
                </span>
              </div>

              {/* Organizer Commission */}
              <div className="bg-slate-800/80 p-3.5 border border-slate-700/60 space-y-1">
                <span className="text-[10px] uppercase text-slate-400 font-semibold block font-sans">
                  Organizer Commission ({fund.commissionPercent}%)
                </span>
                <span className="text-lg font-bold text-slate-200 block">
                  {FinancialEngine.formatCurrency(calc.organizerCommission)}
                </span>
                <span className="text-[10px] text-slate-400 font-sans block">
                  Retained by Manager
                </span>
              </div>

            </div>
          </div>

          <div className="p-4 bg-white border border-slate-200 text-xs text-slate-600 leading-relaxed space-y-2">
            <span className="font-semibold text-slate-900 block font-serif">Mathematical Guarantee:</span>
            <p>
              Under Chit Funds Act formulas, total collection equals <span className="font-mono-nums font-semibold text-slate-900">{FinancialEngine.formatCurrency(calc.netInstallmentDue * fund.numberOfShares)}</span>, perfectly balancing the net payout outflow and organizer fee.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
};
