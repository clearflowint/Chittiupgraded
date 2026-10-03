import React from 'react';
import { Fund, Share, Cycle } from '../../types';
import { FinancialEngine } from '../../services/financialEngine';
import { X, FileText, CheckCircle2, ShieldCheck, Printer } from 'lucide-react';

interface FinalReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
  shares: Share[];
  cycles: Cycle[];
}

export const FinalReportModal: React.FC<FinalReportModalProps> = ({
  isOpen,
  onClose,
  fund,
  shares,
  cycles,
}) => {
  if (!isOpen) return null;

  const fundShares = shares.filter((s) => s.fundId === fund.fundId);
  const fundCycles = cycles.filter((c) => c.fundId === fund.fundId);

  const snapshot = fund.finalReportSnapshot;

  const totalBilled = snapshot?.totalBilled ?? fundShares.reduce((a, s) => a + s.totalBilled, 0);
  const totalCollected = snapshot?.totalCollected ?? fundShares.reduce((a, s) => a + s.totalPaid, 0);
  const totalDisbursed = snapshot?.totalDisbursed ?? fundCycles.filter((c) => c.isAuctionClosed).reduce((a, c) => a + c.winnerNetPayout, 0);
  const totalCommission = snapshot?.totalCommission ?? fundCycles.filter((c) => c.isAuctionClosed).reduce((a, c) => a + c.organizerCommission, 0);
  const totalArrears = snapshot?.totalArrears ?? fundShares.reduce((a, s) => a + s.arrears, 0);
  const totalAdvance = snapshot?.totalAdvance ?? fundShares.reduce((a, s) => a + s.advance, 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-sky-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono-nums tracking-widest text-sky-400 font-semibold block">
                {fund.fundName} · FINAL REPORT
              </span>
              <h2 className="text-sm font-bold text-white">
                Closing Audit Statement
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handlePrint}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white transition cursor-pointer rounded-lg hover:bg-slate-800"
              title="Print Final Report"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-white transition cursor-pointer rounded-lg hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
          {/* Status Banner */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg font-mono-nums">
              STATUS: {fund.status.toUpperCase()}
            </span>
            <span className="text-[10px] text-slate-400 font-mono-nums">
              ID: {fund.fundId}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-950 font-serif -mt-2">
            {fund.fundName}
          </h1>

          {/* Operational Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono-nums text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-sm">
              <span className="text-[9px] text-slate-500 uppercase font-sans font-bold block mb-1">Total Shares</span>
              <span className="text-sm font-bold text-slate-900 block">{fundShares.length} Shares</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-sm">
              <span className="text-[9px] text-slate-500 uppercase font-sans font-bold block mb-1">Cycles Run</span>
              <span className="text-sm font-bold text-slate-900 block">{fundCycles.length} Cycles</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-sm">
              <span className="text-[9px] text-slate-500 uppercase font-sans font-bold block mb-1">Collections</span>
              <span className="text-sm font-bold text-emerald-700 block">{FinancialEngine.formatCurrency(totalCollected)}</span>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 shadow-sm">
              <span className="text-[9px] text-slate-500 uppercase font-sans font-bold block mb-1">Disbursements</span>
              <span className="text-sm font-bold text-slate-900 block">{FinancialEngine.formatCurrency(totalDisbursed)}</span>
            </div>
          </div>

          {/* Financial Reconciliation Summary */}
          <div className="bg-[#0f172a] text-white rounded-2xl p-5 font-mono-nums text-xs space-y-3 shadow-lg border border-slate-800">
            <div className="flex items-center justify-between text-slate-400 pb-2.5 border-b border-slate-800">
              <span className="font-sans font-bold text-sky-400 uppercase tracking-widest text-[10px]">Reconciliation Matrix</span>
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="text-slate-400 block text-[9px] font-sans uppercase tracking-tight mb-0.5">Total Billed</span>
                <span className="font-bold text-slate-100 text-sm">{FinancialEngine.formatCurrency(totalBilled)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] font-sans uppercase tracking-tight mb-0.5">Manager Comm.</span>
                <span className="font-bold text-sky-400 text-sm">{FinancialEngine.formatCurrency(totalCommission)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] font-sans uppercase tracking-tight mb-0.5">Net Arrears</span>
                <span className={`font-bold text-sm ${totalArrears > 0 ? 'text-rose-400' : 'text-slate-100'}`}>{FinancialEngine.formatCurrency(totalArrears)}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[9px] font-sans uppercase tracking-tight mb-0.5">Net Advance</span>
                <span className="font-bold text-emerald-400 text-sm">{FinancialEngine.formatCurrency(totalAdvance)}</span>
              </div>
            </div>
          </div>

          {/* Cycle History Breakdown */}
          <div className="space-y-3 pt-2">
            <h2 className="text-sm font-bold font-serif text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>Cycle Audit Breakdown</span>
              <span className="text-[10px] text-slate-400 font-sans font-normal uppercase tracking-widest">{fundCycles.length} Events</span>
            </h2>
            <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0 scrollbar-thin">
              <table className="w-full text-left text-[11px] border-collapse font-mono-nums min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px] bg-slate-50/50">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Dates</th>
                    <th className="py-2.5 px-3 text-right">Bill</th>
                    <th className="py-2.5 px-3 text-right">Payout</th>
                    <th className="py-2.5 px-3 text-right">Comm.</th>
                    <th className="py-2.5 px-3">Winner</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fundCycles.map((c) => (
                    <tr key={c.cycleId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{c.cycleNumber}</td>
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-900">{c.cycleName || `Cycle #${c.cycleNumber}`}</td>
                      <td className="py-2.5 px-3 text-slate-500 text-[10px]">
                        {c.startDate || c.auctionDate} {c.endDate ? `→ ${c.endDate}` : ''}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-900">{FinancialEngine.formatCurrency(c.netInstallmentDue)}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">{FinancialEngine.formatCurrency(c.winnerNetPayout)}</td>
                      <td className="py-2.5 px-3 text-right text-sky-700">{FinancialEngine.formatCurrency(c.organizerCommission)}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-600 truncate max-w-[120px]">{c.winnerMemberName || 'Unassigned'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Member Share Allotment Breakdown */}
          <div className="space-y-3 pt-2">
            <h2 className="text-sm font-bold font-serif text-slate-900 border-b border-slate-100 pb-2 flex items-center justify-between">
              <span>Member Share Statements</span>
              <span className="text-[10px] text-slate-400 font-sans font-normal uppercase tracking-widest">{fundShares.length} Allotments</span>
            </h2>
            <div className="overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0 scrollbar-thin">
              <table className="w-full text-left text-[11px] border-collapse font-mono-nums min-w-[600px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px] bg-slate-50/50">
                    <th className="py-2.5 px-3">Share</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Billed</th>
                    <th className="py-2.5 px-3 text-right">Paid</th>
                    <th className="py-2.5 px-3 text-right">Arrears</th>
                    <th className="py-2.5 px-3 text-right">Advance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {fundShares.map((s) => (
                    <tr key={s.shareId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-slate-900">{s.displayId || '----'}</td>
                      <td className="py-2.5 px-3 font-sans font-medium text-slate-900">{s.memberName}</td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${s.hasClaimedPrize ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'}`}>
                          {s.hasClaimedPrize ? `DRAWN M#${s.wonMonth}` : 'UNDRAWN'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-900 font-medium">{FinancialEngine.formatCurrency(s.totalBilled)}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">{FinancialEngine.formatCurrency(s.totalPaid)}</td>
                      <td className="py-2.5 px-3 text-right text-rose-600 font-bold">{FinancialEngine.formatCurrency(s.arrears)}</td>
                      <td className="py-2.5 px-3 text-right text-sky-600 font-bold">{FinancialEngine.formatCurrency(s.advance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-slate-100 text-[10px] text-slate-400 font-mono-nums shrink-0">
          <span>Final Audit Report (System Generated) · {new Date().toLocaleDateString()}</span>
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-900 text-white font-sans font-bold text-xs rounded-xl hover:bg-slate-800 transition cursor-pointer min-h-[44px] shadow-sm"
          >
            Close Statement
          </button>
        </div>

      </div>
    </div>
  );
};
