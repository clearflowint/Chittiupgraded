import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChitFund } from '../../context/ChitFundContext';
import { FinancialEngine } from '../../services/financialEngine';
import { normalizePhoneNumber } from '../../utils/phone';
import { Contact, Share, PaymentMethod } from '../../types';
import { 
  X, 
  Search, 
  CreditCard, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Phone, 
  Layers, 
  Calendar, 
  Receipt,
  FileText
} from 'lucide-react';

interface QuickRecordPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickRecordPaymentModal: React.FC<QuickRecordPaymentModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { tenant } = useAuth();
  const { 
    contacts, 
    shares, 
    funds, 
    recordPayment, 
    showAcknowledgement 
  } = useChitFund();

  // Tenant Isolation
  const currentManagerId = tenant?.managerId;
  const tenantContacts = useMemo(
    () => contacts.filter(c => !currentManagerId || c.managerId === currentManagerId),
    [contacts, currentManagerId]
  );
  const tenantShares = useMemo(
    () => shares.filter(s => !currentManagerId || s.managerId === currentManagerId),
    [shares, currentManagerId]
  );
  const tenantFunds = useMemo(
    () => funds.filter(f => !currentManagerId || f.managerId === currentManagerId),
    [funds, currentManagerId]
  );

  // Flow State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedShareId, setSelectedShareId] = useState<string>('');

  // Payment Details State
  const [amount, setAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('UPI');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Helper to find all Shares linked to a given Contact
  const getLinkedSharesForContact = (c: Contact): Share[] => {
    const norm = normalizePhoneNumber(c.phone);
    return tenantShares.filter(s => 
      s.contactId === c.contactId ||
      s.memberId === c.contactId ||
      (s.memberPhone && normalizePhoneNumber(s.memberPhone) === norm) ||
      s.memberName.trim().toLowerCase() === c.name.trim().toLowerCase()
    );
  };

  // Search Results: Active when searchQuery >= 2 characters, max 8 results
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2 || selectedContact) return [];
    
    return tenantContacts
      .filter(c => {
        const normPhone = normalizePhoneNumber(c.phone);
        const nameMatch = c.name.toLowerCase().includes(q);
        const phoneMatch = c.phone.includes(q) || normPhone.includes(q);
        return nameMatch || phoneMatch;
      })
      .slice(0, 8);
  }, [searchQuery, tenantContacts, selectedContact]);

  // Shares linked to currently selected contact
  const contactShares = useMemo(() => {
    if (!selectedContact) return [];
    return getLinkedSharesForContact(selectedContact);
  }, [selectedContact, tenantShares]);

  // Currently selected Share object
  const currentSelectedShare = useMemo(() => {
    return contactShares.find(s => s.shareId === selectedShareId) || null;
  }, [contactShares, selectedShareId]);

  // Currently selected Fund object
  const currentSelectedFund = useMemo(() => {
    if (!currentSelectedShare) return null;
    return tenantFunds.find(f => f.fundId === currentSelectedShare.fundId) || null;
  }, [currentSelectedShare, tenantFunds]);

  // Handle selecting a Contact
  const handleSelectContact = (c: Contact) => {
    setSelectedContact(c);
    setSearchQuery('');
    setError(null);
    setSuccessMsg(null);

    const linked = getLinkedSharesForContact(c);
    if (linked.length === 1) {
      // Exactly ONE Share: Automatically select that Share
      setSelectedShareId(linked[0].shareId);
      if (linked[0].arrears > 0) {
        setAmount(linked[0].arrears);
      } else {
        setAmount('');
      }
    } else {
      // Multiple Shares: Manager must explicitly select exactly one
      setSelectedShareId('');
      setAmount('');
    }
  };

  // Handle clearing selected contact to search again
  const handleClearSelectedContact = () => {
    setSelectedContact(null);
    setSelectedShareId('');
    setAmount('');
    setError(null);
    setSuccessMsg(null);
  };

  // Handle selecting a Share
  const handleSelectShare = (s: Share) => {
    setSelectedShareId(s.shareId);
    setError(null);
    if (s.arrears > 0 && (!amount || Number(amount) <= 0)) {
      setAmount(s.arrears);
    }
  };

  // Reset all state when closing
  const handleClose = () => {
    setSelectedContact(null);
    setSelectedShareId('');
    setSearchQuery('');
    setAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('UPI');
    setReference('');
    setNotes('');
    setIsSubmitting(false);
    setError(null);
    setSuccessMsg(null);
    onClose();
  };

  if (!isOpen) return null;

  // Validation rules for Record Payment button
  const isValidContact = Boolean(selectedContact);
  const isValidShare = Boolean(selectedShareId && currentSelectedShare);
  const isPositiveAmount = typeof amount === 'number' && amount > 0;
  const isFormValid = isValidContact && isValidShare && isPositiveAmount && !isSubmitting;

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Validate again before writing (Requirement 6)
    if (!tenant?.managerId) {
      setError('Payment could not be recorded. Authenticated manager is invalid.');
      return;
    }
    if (!selectedContact || selectedContact.managerId !== currentManagerId) {
      setError('Payment could not be recorded. Selected Contact does not belong to your tenant.');
      return;
    }
    if (!currentSelectedShare || currentSelectedShare.managerId !== currentManagerId) {
      setError('Payment could not be recorded. Selected Share does not belong to your tenant.');
      return;
    }
    if (!currentSelectedFund || currentSelectedFund.managerId !== currentManagerId) {
      setError('Payment could not be recorded. Associated Chitti does not belong to your tenant.');
      return;
    }
    if (!isPositiveAmount) {
      setError('Amount must be greater than ₹0.');
      return;
    }

    setIsSubmitting(true);

    try {
      const finalAmount = Number(amount);
      const idempotencyKey = `qpay_${currentSelectedFund.fundId}_${currentSelectedShare.shareId}_${Date.now()}`;
      const finalReference = reference.trim() || `QPAY-${Date.now().toString().slice(-6)}`;

      // Use EXISTING authoritative payment-recording operation (Share-level financial activity)
      await recordPayment({
        fundId: currentSelectedFund.fundId,
        shareId: currentSelectedShare.shareId,
        amount: finalAmount,
        paymentMethod,
        paymentDate,
        reference: finalReference,
        notes: notes.trim() || `[QUICK PAYMENT] Installment for Share #${currentSelectedShare.shareNumber} (${currentSelectedShare.memberName})`,
        idempotencyKey,
      });

      setIsSubmitting(false);
      setSuccessMsg('Payment recorded successfully.');

      showAcknowledgement({
        isSuccess: true,
        title: 'Payment Successfully Recorded',
        message: 'Payment recorded successfully.',
        operationType: 'QUICK RECORD PAYMENT',
        referenceId: finalReference,
        ackTime: new Date().toLocaleTimeString(),
      });

      // Auto close after brief acknowledgement
      setTimeout(() => {
        handleClose();
      }, 1200);
    } catch (err: any) {
      setIsSubmitting(false);
      setError('Payment could not be recorded. No changes were committed.');
      showAcknowledgement({
        isSuccess: false,
        title: 'Payment Record Failed',
        message: 'Payment could not be recorded. No changes were committed.',
        operationType: 'QUICK RECORD PAYMENT',
        referenceId: `ERR-${Date.now().toString().slice(-6)}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 flex flex-col max-h-[92vh]">
        
        {/* Header - Compact Dark Header */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-400/30 text-emerald-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono-nums tracking-widest text-emerald-400 font-semibold block">
                DASHBOARD SHORTCUT
              </span>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                QUICK RECORD PAYMENT
              </h2>
            </div>
          </div>
          <button 
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          
          {/* Notifications */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-semibold leading-relaxed">{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">{successMsg}</span>
            </div>
          )}

          {/* STEP 1: Search Member / Show Selected Contact */}
          {!selectedContact ? (
            <div className="space-y-2">
              <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest ml-0.5">
                Search Member *
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Type member name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 transition-all font-sans min-h-[44px]"
                />
              </div>
              <p className="text-[10px] text-slate-400 ml-1">
                Type at least 2 characters to search across members by name or phone.
              </p>

              {/* Search Results Dropdown List (Max 5-8 contacts) */}
              {searchQuery.trim().length >= 2 && (
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto bg-white shadow-xs">
                  {searchResults.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No contacts found matching "{searchQuery}"
                    </div>
                  ) : (
                    searchResults.map((c) => {
                      const linked = getLinkedSharesForContact(c);
                      const normPhone = normalizePhoneNumber(c.phone);
                      const linkedChittiCount = new Set(linked.map(s => s.fundId)).size;
                      return (
                        <button
                          key={c.contactId}
                          type="button"
                          onClick={() => handleSelectContact(c)}
                          className="w-full text-left p-3 hover:bg-slate-50 transition cursor-pointer flex items-center justify-between gap-3"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate font-sans">
                              {c.name}
                            </span>
                            <div className="flex items-center gap-1.5 text-[11px] font-mono-nums text-slate-500">
                              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{normPhone}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="inline-block text-[11px] font-mono-nums font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                              {linked.length} {linked.length === 1 ? 'Share' : 'Shares'} · {linkedChittiCount} {linkedChittiCount === 1 ? 'Chitti' : 'Chittis'}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Selected Contact Summary Card */
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-mono-nums font-bold tracking-wider text-slate-400 block">
                    SELECTED CONTACT
                  </span>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm truncate font-sans">
                    {selectedContact.name}
                  </div>
                  <div className="text-[11px] font-mono-nums text-slate-600 flex items-center gap-2 mt-0.5">
                    <span>{normalizePhoneNumber(selectedContact.phone)}</span>
                    <span className="text-slate-300">·</span>
                    <span className="font-semibold text-slate-700">
                      {contactShares.length} {contactShares.length === 1 ? 'Share' : 'Shares'} · {new Set(contactShares.map(s => s.fundId)).size} Chittis
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleClearSelectedContact}
                className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition cursor-pointer shrink-0"
              >
                Change
              </button>
            </div>
          )}

          {/* STEP 2: SELECT ONE SHARE */}
          {selectedContact && (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest ml-0.5">
                  SELECT ONE SHARE *
                </label>
                {contactShares.length > 1 && !selectedShareId && (
                  <span className="text-[10px] text-amber-600 font-semibold font-sans">
                    Select one Share to continue.
                  </span>
                )}
              </div>

              {contactShares.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs space-y-1">
                  <p className="font-bold">No active shares found for this contact.</p>
                  <p className="text-[11px] text-amber-700">
                    To record payments, this contact must be enrolled in an active Chitti fund.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {contactShares.map((s) => {
                    const fund = tenantFunds.find(f => f.fundId === s.fundId);
                    const isSelected = selectedShareId === s.shareId;
                    const shareDisplay = s.displayId || `SH-${s.shareId.slice(-4).toUpperCase()}`;

                    return (
                      <div
                        key={s.shareId}
                        onClick={() => handleSelectShare(s)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-2 border-emerald-600 bg-emerald-50/80 shadow-xs'
                            : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {/* Radio Circle Indicator */}
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected
                              ? 'border-emerald-600 bg-emerald-600'
                              : 'border-slate-400 bg-white'
                          }`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>

                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 text-xs sm:text-sm font-sans truncate">
                                {fund?.fundName || 'Chitti Scheme'}
                              </span>
                            </div>
                            <div className="text-[11px] font-mono-nums text-slate-500">
                              Share <strong className="text-slate-800">{shareDisplay}</strong> (Share #{s.shareNumber})
                            </div>
                          </div>
                        </div>

                        {/* Balance Status (Pending / Advance) */}
                        <div className="text-right shrink-0">
                          {s.arrears > 0 ? (
                            <div className="text-rose-600 font-mono-nums font-bold text-xs sm:text-sm">
                              Pending ₹{s.arrears.toLocaleString('en-IN')}
                            </div>
                          ) : s.advance > 0 ? (
                            <div className="text-emerald-700 font-mono-nums font-bold text-xs sm:text-sm">
                              Advance ₹{s.advance.toLocaleString('en-IN')}
                            </div>
                          ) : (
                            <div className="text-slate-500 font-mono-nums text-[11px]">
                              Up to date
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 3: PAYMENT DETAILS (Visible once a valid share is selected) */}
          {selectedContact && selectedShareId && currentSelectedShare && (
            <div className="space-y-3 pt-2 border-t border-slate-100 animate-in fade-in">
              {/* Amount */}
              <div>
                <div className="flex items-center justify-between mb-1.5 ml-0.5">
                  <label className="text-[10px] font-bold text-sky-700 uppercase tracking-widest">
                    Amount *
                  </label>
                  {currentSelectedShare.arrears > 0 && (
                    <button
                      type="button"
                      onClick={() => setAmount(currentSelectedShare.arrears)}
                      className="text-[10px] font-mono-nums font-bold text-emerald-700 hover:text-emerald-800 transition cursor-pointer underline"
                    >
                      Fill Pending: ₹{currentSelectedShare.arrears.toLocaleString('en-IN')}
                    </button>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold font-mono-nums text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    placeholder="Enter amount..."
                    value={amount}
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                      setAmount(val);
                      if (error) setError(null);
                    }}
                    className="w-full pl-8 pr-3.5 py-2.5 text-sm sm:text-base border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 transition-all font-mono-nums font-bold min-h-[44px]"
                  />
                </div>
              </div>

              {/* Payment Date & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Payment Date */}
                <div>
                  <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-0.5">
                    Payment Date *
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums min-h-[42px]"
                    />
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-0.5">
                    Payment Method *
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['UPI', 'Bank', 'Cash'] as PaymentMethod[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaymentMethod(m)}
                        className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all cursor-pointer min-h-[42px] ${
                          paymentMethod === m
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 shadow-xs'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Reference */}
              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-0.5">
                  Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI-9842104 or Bank Cheque #..."
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums min-h-[40px]"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-0.5">
                  Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Received at office"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-sans min-h-[40px]"
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid}
              className={`py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[44px] shadow-xs ${
                isFormValid
                  ? 'text-white bg-emerald-700 hover:bg-emerald-800 cursor-pointer'
                  : 'text-slate-400 bg-slate-200 cursor-not-allowed border border-slate-300/40 shadow-none'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Recording...' : 'Record Payment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
