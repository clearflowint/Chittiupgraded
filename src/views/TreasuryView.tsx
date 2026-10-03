import React, { useState } from 'react';
import { useChitFund } from '../context/ChitFundContext';
import { FinancialEngine } from '../services/financialEngine';
import { Payment, PaymentMethod } from '../types';
import { 
  Download, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard, 
  Coins, 
  Building2, 
  Calendar,
  Filter
} from 'lucide-react';

interface TreasuryViewProps {
  onOpenPaymentModal: () => void;
}

export const TreasuryView: React.FC<TreasuryViewProps> = ({ onOpenPaymentModal }) => {
  const { payments, cycles, funds, ledgers, shares, fetchPaymentsPage } = useChitFund();

  const [filterMethod, setFilterMethod] = useState<'all' | PaymentMethod>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [extraPayments, setExtraPayments] = useState<Payment[]>([]);
  const [nextCursorDoc, setNextCursorDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Combine real-time recent payments and loaded historical pages without duplicates
  const allLoadedPayments = React.useMemo(() => {
    const map = new Map<string, Payment>();
    payments.forEach((p) => map.set(p.paymentId, p));
    extraPayments.forEach((p) => map.set(p.paymentId, p));
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.paymentDate || b.createdAt).getTime() - new Date(a.paymentDate || a.createdAt).getTime()
    );
  }, [payments, extraPayments]);

  const loadMorePayments = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const result = await fetchPaymentsPage(nextCursorDoc, 50);
      setExtraPayments((prev) => [...prev, ...result.items]);
      setNextCursorDoc(result.nextCursorDoc);
      setHasMore(result.hasMore);
    } catch (e) {
      console.warn('Error fetching payments page:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  // Materialized Total Inflows (Derived from Ledger / Shares state - zero need to download all historical payments)
  const chittiLedgerTotal = ledgers.find((l) => l.ledgerType === 'CHITTI_LEDGER')?.totalCollected;
  const totalInflows = chittiLedgerTotal ?? shares.reduce((acc, s) => acc + (s.totalPaid || 0), 0);

  // Total Outflows (Cycle winner payouts disbursed)
  const totalOutflows = cycles
    .filter(c => c.isAuctionClosed && c.winnerNetPayout)
    .reduce((acc, c) => acc + (c.winnerNetPayout || 0), 0);

  // Net Liquidity
  const netLiquidity = totalInflows - totalOutflows;

  // Breakdown by channel
  const upiTotal = allLoadedPayments.filter(p => p.paymentMethod === 'UPI').reduce((a, b) => a + b.amount, 0);
  const bankTotal = allLoadedPayments.filter(p => p.paymentMethod === 'Bank').reduce((a, b) => a + b.amount, 0);
  const cashTotal = allLoadedPayments.filter(p => p.paymentMethod === 'Cash').reduce((a, b) => a + b.amount, 0);

  const filteredPayments = allLoadedPayments.filter((p) => {
    const matchesMethod = filterMethod === 'all' || p.paymentMethod === filterMethod;
    const matchesSearch = (p.memberName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.reference || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesMethod && matchesSearch;
  });

  const exportCSV = () => {
    const headers = ['Payment ID', 'Member', 'Share #', 'Amount (INR)', 'Method', 'Date', 'Reference', 'Status'];
    const rows = filteredPayments.map(p => [
      p.displayId || p.paymentId,
      p.memberName || 'N/A',
      p.shareNumber || 1,
      p.amount,
      p.paymentMethod,
      p.paymentDate,
      p.reference || '',
      p.verificationStatus,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ClearFlow_Treasury_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-[10px] font-mono-nums font-semibold uppercase tracking-wider text-slate-500">
            TREASURY &amp; CASH FLOW
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-950">
            Comprehensive Financial Ledger
          </h1>
          <p className="text-xs text-slate-500 font-mono-nums mt-0.5">
            Real-time cash flow verification, collection ledger, and liquidity positioning
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportCSV}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 transition cursor-pointer flex items-center gap-1.5 font-mono-nums"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={onOpenPaymentModal}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 font-mono-nums"
          >
            <CreditCard className="w-3.5 h-3.5" />
            <span>Record Receipt</span>
          </button>
        </div>
      </div>

      {/* Aggregate Position Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 p-5 font-mono-nums">
          <div className="flex items-center justify-between text-xs text-slate-500 uppercase font-semibold">
            <span>Total Inflow (Collections)</span>
            <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-950">
            {FinancialEngine.formatCurrency(totalInflows)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-sans">
            {payments.length} verified transactions
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 font-mono-nums">
          <div className="flex items-center justify-between text-xs text-slate-500 uppercase font-semibold">
            <span>Total Outflow (Disbursements)</span>
            <ArrowUpRight className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {FinancialEngine.formatCurrency(totalOutflows)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-sans">
            Settled prize payouts to winners
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-5 font-mono-nums">
          <div className="flex items-center justify-between text-xs text-slate-500 uppercase font-semibold">
            <span>Net Treasury Balance</span>
            <Coins className="w-4 h-4 text-emerald-700" />
          </div>
          <div className={`mt-2 text-2xl font-bold ${netLiquidity >= 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
            {FinancialEngine.formatCurrency(netLiquidity)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-sans">
            Available working liquidity
          </div>
        </div>
      </div>

      {/* Payment Channel Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-mono-nums text-xs">
        <div className="bg-slate-50 border border-slate-200 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-sans">UPI Collections</span>
            <span className="font-bold text-slate-900 text-sm">{FinancialEngine.formatCurrency(upiTotal)}</span>
          </div>
          <span className="text-slate-400 text-[11px]">
            {payments.filter(p => p.paymentMethod === 'UPI').length} txns
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-sans">Bank Transfers</span>
            <span className="font-bold text-slate-900 text-sm">{FinancialEngine.formatCurrency(bankTotal)}</span>
          </div>
          <span className="text-slate-400 text-[11px]">
            {payments.filter(p => p.paymentMethod === 'Bank').length} txns
          </span>
        </div>

        <div className="bg-slate-50 border border-slate-200 p-3.5 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase block font-sans">Cash Receipts</span>
            <span className="font-bold text-slate-900 text-sm">{FinancialEngine.formatCurrency(cashTotal)}</span>
          </div>
          <span className="text-slate-400 text-[11px]">
            {payments.filter(p => p.paymentMethod === 'Cash').length} txns
          </span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1 border-b border-slate-200 pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All Channels' },
            { id: 'UPI', label: 'UPI' },
            { id: 'Bank', label: 'Bank Wire' },
            { id: 'Cash', label: 'Cash' },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setFilterMethod(m.id as any)}
              className={`px-3 py-1.5 text-xs font-medium tracking-wide transition cursor-pointer ${
                filterMethod === m.id
                  ? 'text-emerald-800 border-b-2 border-emerald-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 border-b-2 border-transparent'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search member or reference..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 focus:outline-none focus:border-emerald-600 bg-white"
          />
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider bg-slate-50/70">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Member &amp; Share</th>
                <th className="py-3 px-3">Payment ID</th>
                <th className="py-3 px-3">Channel</th>
                <th className="py-3 px-3">Reference / Txn ID</th>
                <th className="py-3 px-3 text-right">Amount (₹)</th>
                <th className="py-3 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-nums">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-slate-400 font-sans">
                    No transactions found matching criteria.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.paymentId} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 text-slate-600">
                      {p.paymentDate}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-sans font-medium text-slate-900">{p.memberName}</div>
                      <div className="text-[11px] text-slate-400">Share #{p.shareNumber}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-mono-nums text-[11px]">
                      {p.displayId || p.paymentId.slice(-8)}
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-sans text-[11px] font-semibold text-slate-700">
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 text-[11px]">
                      {p.reference || '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-800 text-sm">
                      +{FinancialEngine.formatCurrency(p.amount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="text-[10px] font-sans uppercase font-semibold text-emerald-800">
                        {p.verificationStatus}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex justify-center">
            <button
              onClick={loadMorePayments}
              disabled={loadingMore}
              className="px-4 py-2 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 transition cursor-pointer disabled:opacity-50 font-mono-nums"
            >
              {loadingMore ? 'Loading Next Page...' : 'Load More Historical Payments (Cursor Pagination)'}
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
