import React, { useState, useEffect } from 'react';
import { useChitFund } from '../../context/ChitFundContext';
import { Fund, Share } from '../../types';
import { X, Trash2, AlertTriangle, Info, ArrowLeft, ArrowRight, Save } from 'lucide-react';

interface DeleteShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
  shares: Share[];
}

export const DeleteShareModal: React.FC<DeleteShareModalProps> = ({ isOpen, onClose, fund, shares }) => {
  const { deleteShare, showAcknowledgement } = useChitFund();

  const [selectedShareId, setSelectedShareId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<0 | 1>(0);

  // Lock body scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSelectedShareId('');
      setError(null);
      setStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const targetShare = shares.find((s) => s.shareId === selectedShareId);

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShareId) {
      setError('Please select a Member Share to delete');
      return;
    }
    if (!targetShare) {
      setError('Selected share was not found');
      return;
    }
    setStep(1);
    setError(null);
  };

  const handleConfirmSubmit = async () => {
    if (!targetShare) return;

    setLoading(true);
    setError(null);

    try {
      await deleteShare(fund.fundId, selectedShareId);
      setLoading(false);
      onClose();

      showAcknowledgement({
        isSuccess: true,
        title: 'Share Deleted Successfully',
        message: `Successfully deleted Share #${targetShare.shareNumber} (${targetShare.memberName}) from this scheme. Materialized ledger has been rebuilt.`,
        operationType: 'DELETE SHARE ALLOTMENT',
        referenceId: `REF-${Date.now().toString().slice(-6)}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to delete share allotment');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 overflow-y-auto font-sans animate-in fade-in duration-200">
      <div className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-lg bg-white flex flex-col sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header - Danger Red Design */}
        <div className="bg-rose-950 text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-rose-900">
          <div className="flex items-center gap-2.5">
            {step === 1 ? (
              <button 
                onClick={() => setStep(0)}
                className="w-8 h-8 rounded-xl bg-rose-900 border border-rose-800 text-rose-300 flex items-center justify-center hover:text-white transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
            )}
            <div>
              <h2 className="text-sm font-bold tracking-wide text-rose-100">
                {step === 1 ? 'CONFIRM DELETION' : 'DELETE SHARE ALLOTMENT'}
              </h2>
              <p className="text-[10px] text-rose-300 uppercase tracking-tight font-medium">
                {fund.fundName} · DANGER ZONE
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-rose-300 hover:text-white transition cursor-pointer p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-0 overflow-y-auto flex-1">
          {error && (
            <div className="px-5 pt-4">
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 rounded-xl">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {step === 0 ? (
            <form onSubmit={handlePreSubmit} className="p-5 space-y-5 pb-24 sm:pb-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  Select Member Share Allotment *
                </label>
                <select
                  required
                  value={selectedShareId}
                  onChange={(e) => setSelectedShareId(e.target.value)}
                  className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-rose-500 font-medium bg-white transition-all min-h-[48px]"
                >
                  <option value="">-- Choose Member to Delete --</option>
                  {shares.map((s) => {
                    const shareLabel = s.displayId || '----';
                    return (
                      <option key={s.shareId} value={s.shareId}>
                        Share #{s.shareNumber} - {s.memberName} ({shareLabel})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-900 space-y-2.5 leading-relaxed">
                <div className="flex items-center gap-2 font-black text-rose-950 uppercase tracking-tight">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>Irreversible System Operation</span>
                </div>
                <p>
                  Deleting a member share removes their ledger balances, billing invoices, and payment references from this scheme. All associated portal logins will be revoked permanently.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-3 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 transition cursor-pointer shadow-md min-h-[48px] flex items-center justify-center gap-2"
                >
                  <span>Verify Selection</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          ) : (
            <div className="p-5 space-y-5 animate-in slide-in-from-right-4 duration-300 pb-24 sm:pb-5">
              <div className="bg-white border border-rose-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-rose-950 text-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest border-b border-rose-900">
                  DELETION SUMMARY AUDIT
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Member Name</span>
                      <span className="text-sm font-black text-slate-900">{targetShare?.memberName}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Share Allotment</span>
                      <span className="text-sm font-bold text-slate-700 font-mono-nums">Share #{targetShare?.shareNumber}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Current Balance</span>
                      <span className="text-sm font-bold text-rose-600 font-mono-nums">
                        {targetShare?.arrears && targetShare.arrears > 0 ? `₹${targetShare.arrears} Arrears` : `₹${targetShare?.advance || 0} Advance`}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-900 leading-tight font-medium">
                      Proceeding will permanently purge this member's financial presence from the {fund.fundName} ledger. This cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="py-3 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer min-h-[48px] flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Go Back
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleConfirmSubmit}
                  className="py-3 rounded-xl text-xs font-black text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 shadow-md transition cursor-pointer min-h-[48px] flex items-center justify-center gap-2"
                >
                  {loading ? 'Purging...' : 'Yes, Permanently Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
