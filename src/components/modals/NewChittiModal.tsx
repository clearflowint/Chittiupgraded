import React, { useState, useEffect } from 'react';
import { useChitFund } from '../../context/ChitFundContext';
import { X, Info, AlertCircle, Plus, ArrowLeft, ArrowRight, Save } from 'lucide-react';

interface NewChittiModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (fundId: string) => void;
}

export const NewChittiModal: React.FC<NewChittiModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { createFund } = useChitFund();

  const [fundName, setFundName] = useState('');
  const [cycleFrequency, setCycleFrequency] = useState<'monthly' | 'bi-weekly' | 'weekly' | 'none'>('monthly');
  const [planningDuration, setPlanningDuration] = useState<'1-year' | '6-months' | 'ongoing' | 'custom'>('1-year');
  const [customCycles, setCustomCycles] = useState<number>(12);
  const [startDate, setStartDate] = useState('');
  const [notes, setNotes] = useState('');
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
      setFundName('');
      setCycleFrequency('monthly');
      setPlanningDuration('1-year');
      setCustomCycles(12);
      setStartDate('');
      setNotes('');
      setError(null);
      setStep(0);
    }
  }, [isOpen]);

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

  const resolvedPlannedCycles = planningDuration === '6-months'
    ? 6
    : planningDuration === '1-year'
    ? 12
    : planningDuration === 'custom'
    ? Math.max(1, customCycles)
    : null;

  const handleConfirmSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const newId = await createFund({
        fundName: fundName.trim(),
        cycleFrequency: cycleFrequency === 'none' ? undefined : cycleFrequency,
        startDate: startDate || undefined,
        notes: notes.trim(),
        memberList: [], // Start with 0 members (dynamic share allotment)
        totalPool: 0,   // Managed dynamically
        numberOfShares: 0, // Managed dynamically
        commissionPercent: 5, // Default metadata
        totalCycles: resolvedPlannedCycles,
      });

      setLoading(false);
      onClose();
      if (onSuccess) onSuccess(newId);
    } catch (err: any) {
      setError(err?.message || 'Failed to create fund');
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
                <Plus className="w-5 h-5 text-sky-400" />
              </div>
            )}
            <div>
              <h2 className="text-sm font-bold tracking-wide">
                {step === 1 ? 'CONFIRM NEW FUND' : 'START MANAGING FUND'}
              </h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-tight">
                {step === 1 ? 'Verify Initial Config' : 'New Creation · Dynamic Model'}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                    Cycle Frequency
                  </label>
                  <select
                    value={cycleFrequency}
                    onChange={(e) => setCycleFrequency(e.target.value as any)}
                    className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium bg-white transition-all min-h-[48px]"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="bi-weekly">Bi-Weekly</option>
                    <option value="weekly">Weekly</option>
                    <option value="none">On-Demand / Flexible</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                    Target Tenure (Metadata)
                  </label>
                  <select
                    value={planningDuration}
                    onChange={(e) => setPlanningDuration(e.target.value as any)}
                    className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium bg-white transition-all min-h-[48px]"
                  >
                    <option value="1-year">1 Year (12 Cycles)</option>
                    <option value="6-months">6 Months (6 Cycles)</option>
                    <option value="custom">Custom Count</option>
                    <option value="ongoing">Open-Ended / Dynamic</option>
                  </select>
                </div>
              </div>

              {planningDuration === 'custom' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                    Planned Cycle Count
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={customCycles}
                    onChange={(e) => setCustomCycles(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums min-h-[48px]"
                  />
                </div>
              )}

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

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                  Description / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes or manager remarks"
                  className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition-all"
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
                  <span>Verify Configuration</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="p-3.5 bg-sky-50/80 border border-sky-200 rounded-xl text-[11px] text-sky-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed">
                  <span className="font-bold block text-sky-950">Dynamic Operational Model</span>
                  <span>
                    Establish Fund identity. You can add shares/members and create cycles operationally whenever needed. Zero predefined member limits or fixed cycle counts.
                  </span>
                </div>
              </div>
            </form>
          ) : (
            <div className="p-5 space-y-5 animate-in slide-in-from-right-4 duration-300 pb-24 sm:pb-5">
              <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-[#0f172a] text-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest border-b border-slate-800">
                  FUND ARCHITECTURE PREVIEW
                </div>
                <div className="p-4 space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Scheme Name</span>
                      <span className="text-sm font-black text-slate-900 text-right">{fundName}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Cycle Strategy</span>
                      <span className="text-sm font-bold text-slate-700 capitalize text-right">{cycleFrequency === 'none' ? 'On-Demand / Flexible' : cycleFrequency}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Target Tenure</span>
                      <span className="text-sm font-bold text-slate-700 text-right">
                        {resolvedPlannedCycles ? `${resolvedPlannedCycles} Cycles` : 'Open-Ended'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Inception Date</span>
                      <span className="text-sm font-bold text-slate-800 font-mono-nums text-right">{startDate || 'Manual Initialization'}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-2.5">
                    <Plus className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-emerald-900 leading-tight font-medium">
                      Initialization will create a dedicated secure workspace for this scheme. You can immediately begin alloting shares and recording payments.
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
                  className="py-3 rounded-xl text-xs font-black text-white bg-[#0284c7] hover:bg-[#0369a1] shadow-md transition cursor-pointer min-h-[48px] flex items-center justify-center gap-2"
                >
                  {loading ? 'Initializing...' : 'Yes, Launch Fund'}
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
