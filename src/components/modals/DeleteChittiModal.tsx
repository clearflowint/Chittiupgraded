import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChitFund } from '../../context/ChitFundContext';
import { Fund } from '../../types';
import { X, AlertTriangle, ShieldAlert, Trash2 } from 'lucide-react';

interface DeleteChittiModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
  onDeleted: () => void;
}

export const DeleteChittiModal: React.FC<DeleteChittiModalProps> = ({
  isOpen,
  onClose,
  fund,
  onDeleted,
}) => {
  const { tenant } = useAuth();
  const { shares, cycles, payments, deleteFund } = useChitFund();

  const [confirmName, setConfirmName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const fundShares = shares.filter((s) => s.fundId === fund.fundId);
  const fundCycles = cycles.filter((c) => c.fundId === fund.fundId);
  const fundPayments = payments.filter((p) => p.fundId === fund.fundId);

  const isConfirmed = confirmName.trim().toLowerCase() === fund.fundName.trim().toLowerCase();

  const handleDelete = async () => {
    if (!isConfirmed) {
      setError(`Please type "${fund.fundName}" exactly to confirm.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await deleteFund(fund.fundId);
      setLoading(false);
      onClose();
      onDeleted();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete scheme.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-2 overflow-y-auto">
      <div className="w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-lg bg-white sm:rounded-2xl shadow-2xl border border-rose-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2 text-rose-400">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <div>
              <span className="text-[10px] uppercase font-mono-nums tracking-widest text-rose-400 font-bold block">
                DANGER ZONE · HIGH-RISK DESTRUCTION
              </span>
              <h2 className="text-sm font-bold text-white">Delete Chitti Scheme</h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 rounded-xl">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-xs text-slate-600 leading-relaxed">
            This action will permanently delete this Chitti scheme, all member allotments, all cycle records, and materialized ledger entries from your tenant account.
          </p>

          {/* Scheme Impact Summary Table */}
          <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-4 space-y-2 text-xs font-mono-nums">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-sans">Chitti Name:</span>
              <span className="font-bold text-slate-900">{fund.fundName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-sans">Chitti ID:</span>
              <span className="text-slate-700">{fund.fundId} ({fund.displayId || '----'})</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-sans">Member Shares:</span>
              <span className="font-semibold text-slate-900">{fundShares.length} Allotted Shares</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-sans">Cycles:</span>
              <span className="font-semibold text-slate-900">{fundCycles.length} Cycles</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-sans">Financial Records Affected:</span>
              <span className="font-semibold text-rose-600">{fundPayments.length} Payments + Ledger Matrix</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Type <span className="font-mono text-rose-600 select-all font-bold">"{fund.fundName}"</span> to confirm deletion:
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={fund.fundName}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 font-medium min-h-[44px]"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isConfirmed || loading}
              onClick={handleDelete}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-40 rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-xs min-h-[44px]"
            >
              <Trash2 className="w-4 h-4" />
              <span>{loading ? 'Deleting...' : 'Delete Chitti Permanently'}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
