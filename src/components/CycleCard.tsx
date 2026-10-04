import React, { useState, useMemo } from 'react';
import { Cycle } from '../types';
import { useChitFund } from '../context/ChitFundContext';
import { FinancialEngine } from '../services/financialEngine';
import { 
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

interface CycleCardProps {
  cycle: Cycle;
  onEdit: (cycle: Cycle) => void;
  onDelete: (cycle: Cycle) => void;
  onAddNew: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const CycleDetailsModal: React.FC<{
  cycle: Cycle;
  totalCycleBill: number;
  dividendPool: number;
  totalPayout: number;
  drawnMembersList: { shareId: string; name: string; amount: number }[];
  onClose: () => void;
}> = ({ cycle, totalCycleBill, dividendPool, totalPayout, drawnMembersList, onClose }) => (
  <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
    <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-150 overflow-hidden flex flex-col p-5 space-y-4 animate-in zoom-in-95 duration-200 font-sans">
      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
        <div>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block leading-none">Scheme Cycle Analysis</span>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide mt-1">
            {cycle.cycleName || `Cycle #${cycle.cycleNumber}`} (M#{cycle.cycleNumber})
          </h3>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">Start Date</span>
            <span className="font-mono-nums font-semibold text-slate-700">{cycle.startDate}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-0.5">End Date</span>
            <span className="font-mono-nums font-semibold text-slate-700">{cycle.endDate || 'Not Set'}</span>
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-0.5">Cycle Financial Summary</span>
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white text-xs font-mono-nums">
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="font-sans font-medium text-slate-600">Total Billed</span>
              <span className="font-black text-slate-900">{FinancialEngine.formatCurrency(totalCycleBill)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="font-sans font-medium text-slate-600">Dividend Pool</span>
              <span className="font-black text-emerald-600">{FinancialEngine.formatCurrency(dividendPool)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="font-sans font-medium text-slate-600">Total Payout</span>
              <span className="font-black text-rose-600">{FinancialEngine.formatCurrency(totalPayout)}</span>
            </div>
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="font-sans font-medium text-slate-600">Commission</span>
              <span className="font-black text-slate-900">{FinancialEngine.formatCurrency(cycle.organizerCommission || 0)}</span>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-0.5">Drawn / Payout Details</span>
          {drawnMembersList.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-3 text-center bg-slate-50/50 rounded-xl border border-slate-100">No members drawn.</p>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-36 overflow-y-auto">
              {drawnMembersList.map((m, idx) => (
                <div key={idx} className="flex items-center justify-between px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono-nums font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{m.shareId}</span>
                    <span className="font-bold text-slate-800 truncate">{m.name}</span>
                  </div>
                  <span className="font-mono-nums font-black text-rose-600">{FinancialEngine.formatCurrency(m.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="pt-2 border-t border-slate-100">
        <button onClick={onClose} className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition cursor-pointer">Close View</button>
      </div>
    </div>
  </div>
);

export const CycleCard: React.FC<CycleCardProps> = ({
  cycle,
  onEdit,
  onDelete,
  onAddNew,
  onPrev,
  onNext,
  isFirst,
  isLast,
}) => {
  const { shares, billings, payouts, cycles } = useChitFund();
  
  // Modals visibility states
  const [isDetailsOpen, setIsExpandedDetails] = useState(false);

  const fundCycles = useMemo(() => cycles.filter((c) => c.fundId === cycle.fundId), [cycles, cycle.fundId]);
  
  // Rule 7/8: Determine latest cycle by highest actual cycleNumber
  const maxCycleNumber = useMemo(() => {
    return fundCycles.length > 0 ? Math.max(...fundCycles.map(c => c.cycleNumber)) : 0;
  }, [fundCycles]);

  const isAuthoritativeLatest = cycle.cycleNumber === maxCycleNumber;

  // 1. Authoritative Billings & Calculations
  const cycleBillings = useMemo(() => billings.filter((b) => b.fundId === cycle.fundId && b.cycleId === cycle.cycleId), [billings, cycle.fundId, cycle.cycleId]);
  const totalCycleBill = useMemo(() => cycleBillings.reduce((sum, b) => sum + b.billAmount, 0), [cycleBillings]);

  // 2. Authoritative Cycle Operational Metrics
  const dividendPool = cycle.dividendPool || 0;

  // 3. Authoritative Payouts & Calculations
  const cyclePayouts = useMemo(() => payouts.filter((po) => po.fundId === cycle.fundId && po.cycleId === cycle.cycleId), [payouts, cycle.fundId, cycle.cycleId]);
  const totalPayout = useMemo(() => cyclePayouts.reduce((sum, po) => sum + po.amount, 0), [cyclePayouts]);

  // 4. Drawn Members List from payouts
  const drawnMembersList = useMemo(() => cyclePayouts.map((po) => {
    const shareObj = shares.find((s) => s.shareId === po.shareId);
    return {
      shareId: shareObj ? (shareObj.displayId || '----') : '----',
      name: shareObj ? shareObj.memberName : 'Unknown Member',
      amount: po.amount,
    };
  }), [cyclePayouts, shares]);

  return (
    <div 
      className="backdrop-blur-md border border-amber-200/50 rounded-[22px] shadow-sm p-3.5 space-y-3.5 font-sans animate-in fade-in duration-300 overflow-hidden"
      style={{ backgroundColor: 'rgba(255, 244, 180, 0.35)' }}
    >
      
      {/* 4. COMPACT HEADER */}
      <div className="flex items-center justify-between px-0.5">
        <button 
          onClick={onPrev}
          disabled={isFirst}
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition ${isFirst ? 'text-amber-200 cursor-not-allowed' : 'text-amber-600 hover:bg-white/50 hover:text-amber-700 cursor-pointer'}`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="text-center min-w-0 flex-1">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2">
              <h3 className="text-[17px] font-black uppercase tracking-widest text-slate-800 leading-none">
                Cycle #{cycle.cycleNumber}
              </h3>
              {isAuthoritativeLatest && (
                <span className="text-[11px] font-black text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded-sm leading-none tracking-tighter">
                  LATEST
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <p className="text-[14px] font-bold text-slate-500 truncate max-w-[120px]">
                {cycle.cycleName || `Cycle #${cycle.cycleNumber}`}
              </p>
              <span className="text-[12px] text-slate-300">·</span>
              <p className="text-[13px] font-mono-nums font-bold text-slate-400 uppercase tracking-tighter">
                {cycle.startDate}
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={onNext}
          disabled={isLast}
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition ${isLast ? 'text-amber-200 cursor-not-allowed' : 'text-amber-600 hover:bg-white/50 hover:text-amber-700 cursor-pointer'}`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 4. FINANCIAL METRICS — THREE IN ONE ROW */}
      <div className="grid grid-cols-3 gap-1 px-0.5">
        <div className="space-y-1 text-center">
          <span className="text-[12px] font-black text-slate-400 uppercase tracking-tighter block">Bill</span>
          <span className="text-[21px] font-black text-slate-900 font-mono-nums block leading-none">
            {FinancialEngine.formatCurrency(totalCycleBill)}
          </span>
        </div>

        <div className="space-y-1 text-center border-x border-amber-200/50">
          <span className="text-[12px] font-black text-slate-400 uppercase tracking-tighter block">Dividend</span>
          <span className="text-[21px] font-black text-emerald-600 font-mono-nums block leading-none">
            {FinancialEngine.formatCurrency(dividendPool)}
          </span>
        </div>

        <div className="space-y-1 text-center">
          <span className="text-[12px] font-black text-slate-400 uppercase tracking-tighter block">Payout</span>
          <span className="text-[21px] font-black text-rose-600 font-mono-nums block leading-none">
            {FinancialEngine.formatCurrency(totalPayout)}
          </span>
        </div>
      </div>

      {/* 5. COMMISSION + DRAWN MEMBERS IN ONE ROW */}
      <div className="px-1.5 py-2.5 bg-white/40 border border-amber-200/30 rounded-xl grid grid-cols-2 gap-2">
        <div className="min-w-0">
          <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1.5">Commission</span>
          <span className="text-[17px] font-black text-slate-700 font-mono-nums block">
            {FinancialEngine.formatCurrency(cycle.organizerCommission || 0)}
          </span>
        </div>
        <div className="min-w-0 border-l border-amber-200/30 pl-2.5">
          <span className="text-[12px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1.5">Drawn Members</span>
          {drawnMembersList.length === 0 ? (
            <span className="text-[13px] text-slate-400 font-bold italic truncate block">None</span>
          ) : (
            <div className="max-h-12 overflow-y-auto scrollbar-none space-y-0.5">
              {drawnMembersList.map((m, idx) => (
                <p key={idx} className="text-[12px] font-black text-slate-600 truncate leading-tight">
                  <span className="text-slate-400">{m.shareId}</span> · {m.name}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 6. COMPACT ACTIONS — TEXT ONLY, SOLID COLORS */}
      <div className="flex items-center gap-1 px-0.5">
        <button
          onClick={() => onEdit(cycle)}
          className="flex-1 flex items-center justify-center py-2 rounded-xl bg-sky-600 text-white hover:bg-sky-500 active:bg-sky-700 transition cursor-pointer shadow-sm text-[10px] sm:text-[11px] font-black min-h-[42px] px-0.5 whitespace-nowrap"
        >
          Edit Bills
        </button>
        
        <button
          onClick={() => setIsExpandedDetails(true)}
          className="flex-1 flex items-center justify-center rounded-xl bg-slate-600 text-white hover:bg-slate-500 active:bg-slate-700 transition cursor-pointer shadow-sm text-[10px] sm:text-[11px] font-black min-h-[42px] px-0.5 whitespace-nowrap"
        >
          Details
        </button>

        {/* 7. DELETE RULE */}
        {isAuthoritativeLatest && (
          <button
            onClick={() => onDelete(cycle)}
            className="flex-1 flex items-center justify-center rounded-xl bg-rose-600 text-white hover:bg-rose-500 active:bg-rose-700 transition cursor-pointer shadow-sm text-[10px] sm:text-[11px] font-black min-h-[42px] px-0.5 whitespace-nowrap"
          >
            Delete
          </button>
        )}

        {/* 2. ADD NEW CYCLE */}
        {isAuthoritativeLatest && (
          <button
            onClick={onAddNew}
            className="flex-1 flex items-center justify-center py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 transition cursor-pointer shadow-sm text-[10px] sm:text-[11px] font-black min-h-[42px] px-0.5 whitespace-nowrap"
          >
            + New Cycle
          </button>
        )}
      </div>

      {isDetailsOpen && (
        <CycleDetailsModal 
          cycle={cycle} 
          totalCycleBill={totalCycleBill} 
          dividendPool={dividendPool} 
          totalPayout={totalPayout} 
          drawnMembersList={drawnMembersList} 
          onClose={() => setIsExpandedDetails(false)} 
        />
      )}
    </div>
  );
};
