import React, { useState, useEffect } from 'react';
import { useChitFund } from '../../context/ChitFundContext';
import { Fund } from '../../types';
import { X, Edit3, AlertCircle, Info, ArrowLeft, ArrowRight, Save } from 'lucide-react';

interface EditChittiNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
}

export const EditChittiNameModal: React.FC<EditChittiNameModalProps> = ({ isOpen, onClose, fund }) => {
  const { updateFundNameAndFrequency, showAcknowledgement } = useChitFund();

  const [fundName, setFundName] = useState('');
  const [cycleFrequency, setCycleFrequency] = useState<string>('none');
  const [startDate, setStartDate] = useState('');
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
    if (isOpen && fund) {
      setFundName(fund.fundName);
      setCycleFrequency(fund.cycleFrequency || 'none');
      setStartDate(fund.startDate ? fund.startDate.split('T')[0] : '');
      setError(null);
      setStep(0);
    }
  }, [isOpen, fund]);

  if (!isOpen) return null;

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundName.trim()) {
      setError('Please provide a scheme name');
      return;
    }
    setStep(1);
    setError(null);
  };

  const handleConfirmSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      await updateFundNameAndFrequency(
        fund.fundId, 
        fundName.trim(), 
        cycleFrequency, 
        startDate || null
      );
      setLoading(false);
      onClose();
      
      showAcknowledgement({
        isSuccess: true,
        title: 'Scheme Identity Updated',
        message: `Successfully updated identity of ${fundName.trim()} in the network database.`,
        operationType: 'UPDATE SCHEME IDENTITY',
        referenceId: `REF-${Date.now().toString().slice(-6)}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to update scheme identity');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 overflow-y-auto font-sans animate-in fade-in duration-200">
      <div className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-lg bg-white flex flex-col sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header - Dark Design */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            {step === 1 ? (
              <button 
                onClick={() => setStep(0)}
                className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 flex items-center justify-center hover:text-white transition"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-sky-600/20 flex items-center justify-center">
                <Edit3 className="w-5 h-5 text-sky-400" />
              </div>
            )}
            <div>
              <h2 className="text-sm font-bold tracking-wide">
                {step === 1 ? 'CONFIRM CHANGES' : 'EDIT FUND SCHEME'}
              </h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-tight">
                {fund.fundName} · IDENTITY
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

        <div className="p-0 overflow-y-auto flex-1">
          {error && (
            <div className="px-5 pt-4">
              <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {step === 0 ? (
            <form onSubmit={handlePreSubmit} className="p-5 space-y-5 pb-24 sm:pb-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  Fund / Scheme Name *
                </label>
                <input
                  type="text"
                  required
                  value={fundName}
                  onChange={(e) => setFundName(e.target.value)}
                  placeholder="Enter scheme name (e.g. Laxmi Series A)"
                  className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition-all min-h-[48px]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  Cycle Frequency (Optional)
                </label>
                <select
                  value={cycleFrequency}
                  onChange={(e: any) => setCycleFrequency(e.target.value)}
                  className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium bg-white transition-all min-h-[48px]"
                >
                  <option value="none">-- Not Specified / Optional --</option>
                  <option value="6-months">6 Months</option>
                  <option value="1-year">1 Year</option>
                  <option value="monthly">Monthly</option>
                  <option value="bi-weekly">Bi-Weekly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  Start Date (Optional)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition-all min-h-[48px]"
                />
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
                  className="py-3 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 transition cursor-pointer shadow-md min-h-[48px] flex items-center justify-center gap-2"
                >
                  <span>Verify Changes</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          ) : (
            <div className="p-5 space-y-5 animate-in slide-in-from-right-4 duration-300 pb-24 sm:pb-5">
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-[#0f172a] text-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest border-b border-slate-800">
                  IDENTITY CHANGE SUMMARY
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">New Scheme Name</span>
                      <span className="text-sm font-black text-slate-900 text-right">{fundName}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Frequency Policy</span>
                      <span className="text-sm font-bold text-slate-700 capitalize text-right">{cycleFrequency === 'none' ? 'Optional' : cycleFrequency}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Baseline Date</span>
                      <span className="text-sm font-bold text-slate-800 font-mono-nums text-right">{startDate || 'Not Set'}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-sky-50 border border-sky-100 rounded-xl flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-sky-900 leading-tight font-medium">
                      Updating scheme identity will sync across all manager views. Existing cycle records and member bills remain unaffected by these metadata changes.
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
                  className="py-3 rounded-xl text-xs font-black text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 shadow-md transition cursor-pointer min-h-[48px] flex items-center justify-center gap-2"
                >
                  {loading ? 'Saving...' : 'Yes, Confirm Identity'}
                  <Save className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
