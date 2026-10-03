import React, { useState } from 'react';
import { useChitFund } from '../../context/ChitFundContext';
import { Cycle } from '../../types';
import { X, Edit3, AlertCircle } from 'lucide-react';

interface EditCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  cycle: Cycle | null;
  fundId: string;
}

export const EditCycleModal: React.FC<EditCycleModalProps> = ({ isOpen, onClose, cycle, fundId }) => {
  const { updateCycleMetadata } = useChitFund();

  const [cycleName, setCycleName] = useState<string>(cycle?.cycleName || `Cycle #${cycle?.cycleNumber || 1}`);
  const [startDate, setStartDate] = useState<string>(cycle?.startDate || cycle?.auctionDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(cycle?.endDate || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !cycle) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycleName.trim()) {
      setError('Cycle Name is required.');
      return;
    }
    if (!startDate) {
      setError('Start Date is required.');
      return;
    }
    if (endDate && endDate < startDate) {
      setError('End Date cannot be earlier than Start Date.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updateCycleMetadata({
        fundId,
        cycleId: cycle.cycleId,
        cycleName,
        startDate,
        endDate: endDate ? endDate : null,
      });

      setLoading(false);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update cycle metadata');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-2 overflow-y-auto">
      <div className="w-full h-full sm:h-auto sm:max-h-[95vh] sm:max-w-md bg-white sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-600/30 border border-sky-400/30 text-sky-400 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono-nums tracking-widest text-sky-400 font-semibold block">
                CYCLE #{cycle.cycleNumber} · METADATA
              </span>
              <h2 className="text-sm font-bold text-white">
                Edit Cycle Metadata
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="px-5 pt-4 shrink-0">
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
              Cycle Name *
            </label>
            <input
              type="text"
              required
              value={cycleName}
              onChange={(e) => setCycleName(e.target.value)}
              placeholder="e.g. January Auction"
              className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition-all min-h-[44px]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums min-h-[44px]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums min-h-[44px]"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="py-2.5 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 transition cursor-pointer shadow-xs min-h-[44px]"
            >
              {loading ? 'Saving...' : 'Save Metadata'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
