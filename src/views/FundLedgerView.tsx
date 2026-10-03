import React, { useState } from 'react';
import { useChitFund } from '../context/ChitFundContext';
import { FinancialEngine } from '../services/financialEngine';
import { Fund } from '../types';
import { 
  FileText, 
  CheckCircle2, 
  ArrowUpRight, 
  DollarSign, 
  Plus, 
  Trash2, 
  Download, 
  FileCode, 
  Receipt,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface FundLedgerViewProps {
  fund: Fund;
  onNavigate?: (tab: string) => void;
  onDeleteChitti?: (fund: Fund) => void;
}

export const FundLedgerView: React.FC<FundLedgerViewProps> = ({ 
  fund, 
  onNavigate,
  onDeleteChitti 
}) => {
  const { cycles, shares, payments } = useChitFund();

  const [isExpanded, setIsExpanded] = useState(true);
  const [otherTitle, setOtherTitle] = useState('');
  const [otherType, setOtherType] = useState<'debit' | 'credit'>('debit');
  const [otherAmount, setOtherAmount] = useState<number | ''>('');
  const [otherEntries, setOtherEntries] = useState<
    { id: string; title: string; type: 'debit' | 'credit'; amount: number }[]
  >([]);

  const fundShares = shares.filter((s) => s.fundId === fund.fundId);
  const fundCycles = cycles
    .filter((c) => c.fundId === fund.fundId)
    .sort((a, b) => a.cycleNumber - b.cycleNumber);
  const fundPayments = payments.filter((p) => p.fundId === fund.fundId);

  // 1. Total Actual Cash Collected
  const totalActualCashCollected = fundShares.reduce((acc, s) => acc + (s.totalPaid || 0), 0);

  // 2. Cumulative Disbursed (Prize payouts to winners up to currentMonth)
  const cumulativeDisbursed = fundCycles
    .filter((c) => c.isAuctionClosed && c.winnerNetPayout)
    .reduce((acc, c) => acc + (c.winnerNetPayout || 0), 0);

  // 3. Cumulative Commission
  const monthlyCommission = Math.round(fund.totalPool * (fund.commissionPercent / 100));
  const cumulativeCommission = monthlyCommission * fundCycles.length;

  // 4. Others Net
  const othersNet = otherEntries.reduce(
    (acc, e) => (e.type === 'credit' ? acc + e.amount : acc - e.amount),
    0
  );

  // 5. Up-to-date Net Cashflow Position
  const netCashflowPosition = totalActualCashCollected - cumulativeDisbursed - cumulativeCommission + othersNet;
  const isDeficit = netCashflowPosition < 0;

  const handleAddOtherEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otherTitle.trim() || !otherAmount || otherAmount <= 0) return;
    setOtherEntries((prev) => [
      ...prev,
      {
        id: `oth_${Date.now()}`,
        title: otherTitle.trim(),
        type: otherType,
        amount: Number(otherAmount),
      },
    ]);
    setOtherTitle('');
    setOtherAmount('');
  };

  const handleExportCSV = () => {
    const headers = [
      'Month',
      'Cycle Status',
      'Winner Member',
      'Cycle Discount',
      'Commission',
      'Dividend / Share',
      'Net Installment Due',
      'Winner Net Payout',
    ];

    const rows = fundCycles.map((c) => [
      `M${c.cycleNumber}`,
      c.status,
      c.winnerMemberName || 'Pending',
      c.winningBidAmount,
      c.organizerCommission,
      c.dividendPerShare,
      c.netInstallmentDue,
      c.winnerNetPayout,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fund.fundName.replace(/\s+/g, '_')}_Ledger_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportHTML = () => {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${fund.fundName} - Ledger Statement</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 24px; color: #0f172a; max-width: 800px; margin: 0 auto; }
          h1 { color: #0284c7; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 12px; text-align: left; }
          th { background: #f1f5f9; }
          .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 16px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; }
        </style>
      </head>
      <body>
        <h1>${fund.fundName} (${fund.displayId || fund.fundId})</h1>
        <p>Operational Month: M${fund.currentMonth} of ${fund.totalMonths} | Generated: ${new Date().toLocaleDateString()}</p>
        <div class="summary">
          <div class="card"><strong>Total Collected:</strong> ₹${totalActualCashCollected.toLocaleString('en-IN')}</div>
          <div class="card"><strong>Total Disbursed:</strong> ₹${cumulativeDisbursed.toLocaleString('en-IN')}</div>
          <div class="card"><strong>Commission:</strong> ₹${cumulativeCommission.toLocaleString('en-IN')}</div>
          <div class="card"><strong>Net Cashflow:</strong> ₹${netCashflowPosition.toLocaleString('en-IN')}</div>
        </div>
        <h2>Monthly Cycles</h2>
        <table>
          <thead>
            <tr><th>Month</th><th>Winner</th><th>Cycle Discount</th><th>Net Due</th><th>Winner Payout</th></tr>
          </thead>
          <tbody>
            ${fundCycles
              .map(
                (c) =>
                  `<tr><td>M${c.cycleNumber}</td><td>${c.winnerMemberName || 'Undrawn'}</td><td>₹${c.winningBidAmount?.toLocaleString('en-IN') || 0}</td><td>₹${c.netInstallmentDue?.toLocaleString('en-IN') || 0}</td><td>₹${c.winnerNetPayout?.toLocaleString('en-IN') || 0}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${fund.fundName.replace(/\s+/g, '_')}_Report.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[#0b1329] text-white border border-slate-800 rounded-2xl shadow-xl overflow-hidden font-sans">
      
      {/* Header Bar matching IMG_3180 and IMG_3181 */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-900/60 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#0369a1]/30 text-cyan-400 flex items-center justify-center border border-cyan-800/40">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-white">
                Chitti Ledger: {fund.fundName} ...
              </h3>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full font-mono-nums uppercase ${
                isDeficit ? 'bg-red-950/80 text-red-400 border border-red-800' : 'bg-emerald-950/80 text-emerald-400 border border-emerald-800'
              }`}>
                {isDeficit ? 'Deficit' : 'Surplus'}
              </span>
            </div>
            <div className="text-xs font-mono-nums mt-0.5">
              <span className="text-slate-400">Net Cashflow Position: </span>
              <span className={`font-bold ${isDeficit ? 'text-red-400' : 'text-emerald-400'}`}>
                {isDeficit ? '-' : '+'}₹{Math.abs(netCashflowPosition).toLocaleString('en-IN')}
              </span>
              <span className="text-slate-500 ml-1.5">(M1–M{fund.currentMonth})</span>
            </div>
          </div>
        </div>

        <button className="text-slate-400 hover:text-white p-1">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* Expanded Ledger Detail matching IMG_3181 */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-slate-800/80">
          
          {/* 4 Dark Metric Cards (Matching IMG_3181) */}
          <div className="space-y-3 font-mono-nums">
            
            {/* Card 1: Total Actual Cash Collected */}
            <div className="bg-[#101935] border border-slate-800/90 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-sans">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Total Actual Cash Collected</span>
              </div>
              <div className="text-2xl font-bold text-emerald-400">
                ₹{totalActualCashCollected.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 font-sans">
                Sum of all actual member payments recorded (M1 to M{fund.currentMonth})
              </div>
            </div>

            {/* Card 2: Cumulative Disbursed */}
            <div className="bg-[#101935] border border-slate-800/90 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-sans">
                <ArrowUpRight className="w-4 h-4 text-rose-400" />
                <span>Cumulative Disbursed (M1–M{fund.currentMonth})</span>
              </div>
              <div className="text-2xl font-bold text-white">
                ₹{cumulativeDisbursed.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 font-sans">
                Total prize money paid out to winners up to Month {fund.currentMonth}
              </div>
            </div>

            {/* Card 3: Cumulative Commission */}
            <div className="bg-[#101935] border border-slate-800/90 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-sans">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>Cumulative Commission ({fund.currentMonth} Months)</span>
              </div>
              <div className="text-2xl font-bold text-cyan-300">
                ₹{cumulativeCommission.toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 font-sans">
                ({fund.currentMonth} months × ₹{monthlyCommission.toLocaleString('en-IN')} flat)
              </div>
            </div>

            {/* Card 4: Up-to-date Net Cashflow Position */}
            <div className="bg-[#101935] border border-slate-800/90 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-sans">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <span>Up-to-date Net Cashflow Position</span>
              </div>
              <div className={`text-2xl font-bold ${isDeficit ? 'text-rose-400' : 'text-emerald-400'}`}>
                {isDeficit ? '-' : '+'}₹{Math.abs(netCashflowPosition).toLocaleString('en-IN')}
              </div>
              <div className="text-[11px] text-slate-400 font-sans">
                Actual Cash Collected - Disbursed - Commission
              </div>
            </div>

          </div>

          {/* Section 5: OTHERS (CREDIT / DEBIT) matching IMG_3181 */}
          <div className="bg-[#101935] border border-slate-800/90 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <Receipt className="w-4 h-4 text-purple-400" />
                <span>OTHERS (CREDIT / DEBIT)</span>
              </div>
              <span className="text-emerald-400 font-mono-nums font-semibold">
                Net (Credit - Debit): ₹{othersNet.toLocaleString('en-IN')}
              </span>
            </div>

            <form onSubmit={handleAddOtherEntry} className="space-y-2">
              <input
                type="text"
                value={otherTitle}
                onChange={(e) => setOtherTitle(e.target.value)}
                placeholder="Record title / description"
                className="w-full px-3 py-2 text-xs rounded-lg bg-[#070d1e] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />

              <div className="flex items-center gap-2">
                <select
                  value={otherType}
                  onChange={(e: any) => setOtherType(e.target.value)}
                  className="px-3 py-2 text-xs rounded-lg bg-[#070d1e] border border-slate-700 text-white focus:outline-none focus:border-cyan-500 w-36"
                >
                  <option value="debit">Debit (-)</option>
                  <option value="credit">Credit (+)</option>
                </select>

                <input
                  type="number"
                  min="1"
                  value={otherAmount}
                  onChange={(e) => setOtherAmount(e.target.value ? Number(e.target.value) : '')}
                  placeholder="Amount (₹)"
                  className="flex-1 px-3 py-2 text-xs rounded-lg bg-[#070d1e] border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono-nums"
                />

                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition cursor-pointer shadow-xs shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </form>

            {otherEntries.length > 0 && (
              <div className="divide-y divide-slate-800 text-xs font-mono-nums pt-1">
                {otherEntries.map((item) => (
                  <div key={item.id} className="py-1.5 flex items-center justify-between text-slate-300">
                    <span>{item.title}</span>
                    <span className={item.type === 'credit' ? 'text-emerald-400' : 'text-rose-400'}>
                      {item.type === 'credit' ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 6: Danger Zone Row matching IMG_3181 */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-slate-400 font-medium">Danger Zone: Remove this Chitti ID</span>
            {onDeleteChitti && (
              <button
                type="button"
                onClick={() => onDeleteChitti(fund)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#991b1b] hover:bg-red-700 text-white text-xs font-semibold transition cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Chitti</span>
              </button>
            )}
          </div>

          {/* Section 7: Export Buttons matching IMG_3180 and IMG_3181 */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <span className="block text-[11px] text-slate-400 text-center font-sans">
              Export full ledger &amp; member status report
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={handleExportHTML}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-[#6366f1] hover:bg-[#4f46e5] text-white transition cursor-pointer shadow-xs"
              >
                <FileCode className="w-4 h-4" />
                <span>View/Save Web Report (.html)</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-[#0284c7] hover:bg-[#0369a1] text-white transition cursor-pointer shadow-xs"
              >
                <Download className="w-4 h-4" />
                <span>CSV (Excel)</span>
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
};
