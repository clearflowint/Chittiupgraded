import React, { useEffect, useState } from 'react';
import { useChitFund } from '../context/ChitFundContext';
import { FinancialEngine } from '../services/financialEngine';
import { Share, Fund, Payment } from '../types';
import { 
  ArrowLeft, 
  Printer, 
  ShieldAlert, 
  Receipt, 
  CheckCircle2,
  Lock,
  X
} from 'lucide-react';

interface MemberPortalViewProps {
  token?: string;
  onBackToApp: () => void;
}

export const MemberPortalView: React.FC<MemberPortalViewProps> = ({ token, onBackToApp }) => {
  const { getShareByPortalToken } = useChitFund();

  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [memberData, setMemberData] = useState<{ share: Share; fund: Fund; payments: Payment[] } | null>(null);
  const [activeReceiptPayment, setActiveReceiptPayment] = useState<Payment | null>(null);

  useEffect(() => {
    async function verifyAndLoad() {
      if (!token || token.trim().length < 8) {
        setAuthError('Authentication Error: Missing or invalid cryptographic passbook token.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setAuthError(null);
      try {
        const result = await getShareByPortalToken(token);
        if (!result) {
          setAuthError('Access Denied: The provided passbook token is invalid, expired, or has been revoked by the manager.');
          setMemberData(null);
        } else {
          setMemberData(result);
        }
      } catch (err: any) {
        setAuthError('Unable to authenticate member passbook token.');
      } finally {
        setLoading(false);
      }
    }

    verifyAndLoad();
  }, [token]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-3 font-mono-nums text-xs text-slate-500">
        <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p>Verifying cryptographic passbook credentials...</p>
      </div>
    );
  }

  // Strict Authorization Guard: Never fall back to another member's records
  if (authError || !memberData) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center space-y-4">
        <div className="w-12 h-12 bg-red-50 text-red-700 flex items-center justify-center mx-auto border border-red-200">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-serif font-bold text-slate-950">Portal Authentication Failed</h2>
        <p className="text-xs text-slate-600 leading-relaxed font-sans">
          {authError || 'You do not have permission to view this passbook.'}
        </p>
        <div className="pt-2">
          <button
            onClick={onBackToApp}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer"
          >
            Return to Operations
          </button>
        </div>
      </div>
    );
  }

  const { share, fund, payments: memberPayments } = memberData;
  const shareDisplayId = share.displayId || '----';
  const fundDisplayId = fund.displayId || '----';

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      
      {/* Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <button
          onClick={onBackToApp}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit Passbook [{fundDisplayId}]</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono-nums text-emerald-800 bg-emerald-50 px-2.5 py-1 border border-emerald-200 flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-700" />
            <span>Encrypted Token Verified</span>
          </span>
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 transition cursor-pointer flex items-center gap-1.5 font-mono-nums"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600" />
            <span>Print Passbook</span>
          </button>
        </div>
      </div>

      {/* Verified Member Passbook Card */}
      <div className="bg-white border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-mono-nums uppercase tracking-widest text-emerald-800 font-semibold">
              OFFICIAL MEMBER DIGITAL PASSBOOK
            </span>
            <h1 className="text-2xl font-serif font-bold text-slate-950 mt-0.5">
              {share.memberName}
            </h1>
            <p className="text-xs text-slate-500 font-mono-nums mt-0.5">
              Phone: {share.memberPhone} · Share ID: {shareDisplayId}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs font-serif font-bold text-slate-900 block">{fund.fundName}</span>
            <span className="text-xs font-mono-nums text-slate-500 block">
              Scheme Pool: {FinancialEngine.formatCurrency(fund.totalPool)} ({fund.totalCycles} Cycles)
            </span>
            <span className={`text-[10px] font-mono-nums uppercase tracking-wider font-semibold mt-1 inline-block ${
              share.hasClaimedPrize ? 'text-emerald-800 bg-emerald-50 px-2 py-0.5 border border-emerald-200' : 'text-slate-600'
            }`}>
              {share.hasClaimedPrize ? `Prize Awarded (Cycle #${share.wonCycleNumber})` : 'Undrawn Participant'}
            </span>
          </div>
        </div>

        {/* Member Financial Balances */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono-nums text-xs">
          <div className="bg-slate-50 border border-slate-200 p-3.5">
            <span className="text-[10px] text-slate-400 uppercase block font-sans">Total Contributed</span>
            <span className="text-base font-bold text-slate-950 mt-1 block">
              {FinancialEngine.formatCurrency((share.totalCredits || 0) - (share.totalDebits || 0))}
            </span>
            <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
              Billed: {FinancialEngine.formatCurrency(share.totalBilled)}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5">
            <span className="text-[10px] text-slate-400 uppercase block font-sans">Pending Arrears</span>
            <span className={`text-base font-bold mt-1 block ${share.arrears > 0 ? 'text-amber-800' : 'text-slate-700'}`}>
              {FinancialEngine.formatCurrency(share.arrears)}
            </span>
            <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
              {share.arrears > 0 ? 'Due for clearance' : 'Fully settled'}
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5">
            <span className="text-[10px] text-slate-400 uppercase block font-sans">Advance Credit</span>
            <span className="text-base font-bold text-emerald-800 mt-1 block">
              {FinancialEngine.formatCurrency(share.advance)}
            </span>
            <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
              Available for next cycle
            </span>
          </div>

          <div className="bg-slate-50 border border-slate-200 p-3.5">
            <span className="text-[10px] text-slate-400 uppercase block font-sans">Prize Status</span>
            <span className="text-base font-bold text-slate-900 mt-1 block">
              {share.hasClaimedPrize ? 'Disbursed' : 'Upcoming'}
            </span>
            <span className="text-[10px] text-slate-400 font-sans block mt-0.5">
              {share.hasClaimedPrize ? `Awarded in Cycle #${share.wonCycleNumber}` : 'Eligible for next cycle'}
            </span>
          </div>
        </div>
      </div>

      {/* Member Payment History & Receipts */}
      <div className="bg-white border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-serif font-bold text-slate-950">
            Payment Receipts &amp; Contribution Records
          </h2>
          <span className="text-xs font-mono-nums text-slate-400">
            {memberPayments.length} verified transactions
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider bg-slate-50/70">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Receipt ID</th>
                <th className="py-2.5 px-3">Payment Channel</th>
                <th className="py-2.5 px-3">Reference / Txn #</th>
                <th className="py-2.5 px-3 text-right">Amount Paid</th>
                <th className="py-2.5 px-3 text-center">Voucher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono-nums">
              {memberPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-slate-400 font-sans">
                    No payment transactions recorded for this share allotment yet.
                  </td>
                </tr>
              ) : (
                memberPayments.map((p) => (
                  <tr key={p.paymentId} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-3 text-slate-600">
                      {p.paymentDate}
                    </td>
                    <td className="py-3 px-3 text-slate-800">
                      {p.displayId || p.paymentId.slice(-8)}
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-700">
                      {p.paymentMethod}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">
                      {p.reference || '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-800 text-sm">
                      {FinancialEngine.formatCurrency(p.amount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => setActiveReceiptPayment(p)}
                        className="px-2.5 py-1 text-[11px] font-sans font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 transition cursor-pointer inline-flex items-center gap-1"
                      >
                        <Receipt className="w-3 h-3 text-slate-500" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Official Voucher Modal */}
      {activeReceiptPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-400/30 text-emerald-400 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono-nums tracking-widest text-emerald-400 font-semibold block">
                    PAYMENT RECEIPT
                  </span>
                  <h2 className="text-sm font-bold text-white">
                    Official Voucher
                  </h2>
                </div>
              </div>
              <button 
                onClick={() => setActiveReceiptPayment(null)}
                className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="space-y-2.5 font-mono-nums text-[11px]">
                <div className="flex justify-between text-slate-500 border-b border-slate-50 pb-2">
                  <span className="font-sans font-medium uppercase text-[9px] tracking-tight">Receipt Reference</span>
                  <span className="font-bold text-slate-700">{activeReceiptPayment.displayId || activeReceiptPayment.paymentId.slice(-12).toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="font-sans">Transaction Date:</span>
                  <span className="font-bold text-slate-800">{activeReceiptPayment.paymentDate}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="font-sans">Member Name:</span>
                  <span className="font-bold text-slate-900">{share.memberName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="font-sans">Fund Scheme:</span>
                  <span className="font-bold text-slate-800">{fund.fundName}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="font-sans">Receipt ID:</span>
                  <span className="font-bold text-slate-800">
                    {activeReceiptPayment.displayId || activeReceiptPayment.paymentId.slice(-8)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="font-sans">Channel:</span>
                  <span className="font-bold text-slate-800">{activeReceiptPayment.paymentMethod}</span>
                </div>
                
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex justify-between items-center text-slate-900 font-bold mt-4 shadow-sm">
                  <span className="font-sans text-xs uppercase tracking-wide text-emerald-800">Amount Received</span>
                  <span className="text-lg text-emerald-900">{FinancialEngine.formatCurrency(activeReceiptPayment.amount)}</span>
                </div>
              </div>

              <div className="text-center">
                <span className="text-[9px] text-slate-400 font-mono-nums uppercase tracking-widest leading-relaxed">
                  Verified Digital Handshake · Multi-Tenant Ledger Protected
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  onClick={() => setActiveReceiptPayment(null)}
                  className="w-full py-3 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer min-h-[44px]"
                >
                  Close Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
