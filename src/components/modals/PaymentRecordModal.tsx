import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChitFund } from '../../context/ChitFundContext';
import { FinancialEngine, UniversalFinancialCore } from '../../services/financialEngine';
import { Fund, Share, PaymentMethod } from '../../types';
import { X, CreditCard, PlusCircle, MinusCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

interface PaymentRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
  shares: Share[];
  initialShareId?: string;
}

export const PaymentRecordModal: React.FC<PaymentRecordModalProps> = ({
  isOpen,
  onClose,
  fund,
  shares,
  initialShareId,
}) => {
  const { tenant } = useAuth();
  const { recordPayment, showAcknowledgement, isOnline } = useChitFund();

  const [selectedShareId, setSelectedShareId] = useState<string>(initialShareId || (shares[0]?.shareId || ''));
  const [recordType, setRecordType] = useState<'credit' | 'debit'>('credit');
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formSessionId, setFormSessionId] = useState<string>(() => FinancialEngine.generateCryptoToken());

  useEffect(() => {
    if (isOpen) {
      setFormSessionId(FinancialEngine.generateCryptoToken());
    }
  }, [isOpen, selectedShareId]);

  if (!isOpen) return null;

  const currentShare = shares.find(s => s.shareId === selectedShareId) || shares[0];

  const managerDisplay = tenant?.email
    ? tenant.email.replace(/(.{3})(.*)(@.*)/, '$1***$3')
    : tenant?.name || 'Authorized Manager';

  const shareDisplayId = currentShare?.displayId || '----';

  const currentTotalBilled = currentShare?.totalBilled || 0;
  const netCredits = (currentShare?.totalCredits || 0) - (currentShare?.totalDebits || 0);
  const currentArrears = currentShare?.arrears || 0;
  const currentAdvance = currentShare?.advance || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShareId) {
      setError('Please select a member share.');
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const type = recordType.toUpperCase() as 'CREDIT' | 'DEBIT';
      const idempotencyKey = `pay_${fund.fundId}_${selectedShareId}_${formSessionId}`;
      const finalReference = reference.trim() || `${type}-${formSessionId.slice(0, 6).toUpperCase()}`;

      await recordPayment({
        fundId: fund.fundId,
        shareId: selectedShareId,
        amount: Number(amount),
        type,
        paymentMethod,
        paymentDate,
        reference: finalReference,
        notes: `[${type}] Payment entry`,
        idempotencyKey,
      });

      setLoading(false);
      onClose();

      showAcknowledgement({
        isSuccess: true,
        title: 'Payment Successfully Recorded',
        message: 'Your payment was successfully received and updated in the ledger.',
        operationType: `${type} PAYMENT`,
        referenceId: finalReference,
        ackTime: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setLoading(false);
      setError(err?.message || 'Failed to record transaction');
      showAcknowledgement({
        isSuccess: false,
        title: 'Payment Record Failed',
        message: err?.message || 'The payment transaction could not be confirmed.',
        operationType: `${recordType.toUpperCase()} PAYMENT`,
        referenceId: `ERR-${Date.now().toString().slice(-6)}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="w-full h-full sm:h-auto sm:max-w-lg bg-white sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 sm:max-h-[92vh]">
        
        {/* Header - Dark Design */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide">RECORD PAYMENT</h2>
              <p className="text-[10px] text-slate-400 font-mono-nums uppercase tracking-tight">
                {currentShare?.memberName} · {shareDisplayId}
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

        {/* Read-Only Context Strip */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 font-mono-nums text-[10px] text-slate-600 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <span><strong className="text-slate-800">Manager:</strong> {managerDisplay}</span>
          <span><strong className="text-slate-800">Fund:</strong> {fund.displayId || '----'}</span>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 rounded-xl font-mono-nums">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. CURRENT POSITION SECTION */}
          <div className="space-y-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block font-sans ml-1">
              CURRENT FINANCIAL POSITION
            </span>
            <div className="grid grid-cols-3 gap-2.5 text-xs font-mono-nums">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                <span className="text-[9px] text-slate-500 font-sans uppercase tracking-wider block">Total Billed</span>
                <span className="text-sm font-bold text-slate-900 mt-1 block">
                  {FinancialEngine.formatCurrency(currentTotalBilled)}
                </span>
              </div>

              <div className={`border rounded-xl p-3 text-center ${
                currentArrears > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="text-[9px] text-slate-500 font-sans uppercase tracking-wider block">Arrears</span>
                <span className={`text-sm font-bold mt-1 block ${
                  currentArrears > 0 ? 'text-rose-600' : 'text-slate-700'
                }`}>
                  {FinancialEngine.formatCurrency(currentArrears)}
                </span>
              </div>

              <div className={`border rounded-xl p-3 text-center ${
                currentAdvance > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
              }`}>
                <span className="text-[9px] text-slate-500 font-sans uppercase tracking-wider block">Advance</span>
                <span className={`text-sm font-bold mt-1 block ${
                  currentAdvance > 0 ? 'text-emerald-700' : 'text-slate-700'
                }`}>
                  {FinancialEngine.formatCurrency(currentAdvance)}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 2. PAYMENT INPUT SECTION */}
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-sans ml-1">
                  PAYMENT INPUT
                </span>
              </div>

              {/* Transaction Type */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setRecordType('credit')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px] ${
                    recordType === 'credit'
                      ? 'bg-sky-600 text-white shadow-md ring-2 ring-sky-500/20'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Credit</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRecordType('debit')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 min-h-[44px] ${
                    recordType === 'debit'
                      ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-500/20'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                  }`}
                >
                  <MinusCircle className="w-4 h-4" />
                  <span>Debit</span>
                </button>
              </div>

              {/* Amount (+₹) */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  Amount ({recordType === 'credit' ? '+₹' : '-₹'})
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 text-slate-400 font-mono-nums text-sm font-bold">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full pl-9 pr-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums font-bold transition-all"
                  />
                </div>
              </div>

              {/* Method & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e: any) => setPaymentMethod(e.target.value)}
                    className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition-all bg-white"
                  >
                    <option value="UPI">UPI / GPay / PhonePe</option>
                    <option value="Bank">Bank Wire / IMPS</option>
                    <option value="Cash">Cash Handover</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                    Reference / Txn ID
                  </label>
                  <input
                    type="text"
                    placeholder="Optional reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums font-medium transition-all"
                  />
                </div>
              </div>
            </div>

            {/* 3. AFTER PAYMENT (FINANCIAL CONSEQUENCE PREVIEW) */}
            {currentShare && (
              <div className="bg-[#0f172a] text-white rounded-2xl p-5 space-y-3 text-xs font-mono-nums border border-slate-800 shadow-inner">
                <div className="text-[9px] uppercase font-bold tracking-widest text-sky-400 font-sans border-b border-slate-800 pb-2 flex items-center justify-between">
                  <span>POST-TRANSACTION PROJECTION</span>
                  <span className="text-slate-500 font-normal">Calculated</span>
                </div>

                {(() => {
                  const numericAmount = Number(amount) || 0;
                  const type = recordType.toUpperCase() as 'CREDIT' | 'DEBIT';
                  
                  // Use new stateful logic for projection
                  const nextState = UniversalFinancialCore.calculateNextState(
                    {
                      totalBilled: currentShare.totalBilled,
                      totalCredits: currentShare.totalCredits,
                      totalDebits: currentShare.totalDebits,
                      arrears: currentShare.arrears,
                      advance: currentShare.advance
                    },
                    { type, amount: numericAmount }
                  );

                  const projectedNetCredits = nextState.totalCredits - nextState.totalDebits;

                  return (
                    <div className="space-y-2.5 pt-1 text-[11px]">
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="font-sans">Projected Net Paid:</span>
                        <span className="font-bold text-white">
                          {FinancialEngine.formatCurrency(projectedNetCredits)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-2.5 border-t border-slate-800 font-semibold">
                        <span className="font-sans text-slate-400">Net Balance Remaining:</span>
                        <span className={nextState.arrears > 0 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                          {nextState.arrears > 0 
                            ? `-${FinancialEngine.formatCurrency(nextState.arrears)} Arrears` 
                            : `+${FinancialEngine.formatCurrency(nextState.advance)} Advance`}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="py-3 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[48px]"
              >
                Cancel
              </button>
              <div className="flex flex-col">
                <button
                  type="submit"
                  disabled={loading || !isOnline}
                  className="w-full py-3 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 transition cursor-pointer shadow-md min-h-[48px]"
                >
                  {!isOnline ? 'Online Required' : loading ? 'Recording...' : 'Record Payment'}
                </button>
                {!isOnline && (
                  <span className="text-[9px] text-rose-500 font-bold text-center mt-1">
                    Internet connection required
                  </span>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
