import React, { useState } from 'react';
import { useChitFund } from '../context/ChitFundContext';
import { Layers, AlertCircle, CheckCircle2 } from 'lucide-react';

interface NewFundWizardViewProps {
  onNavigate: (tab: string) => void;
}

export const NewFundWizardView: React.FC<NewFundWizardViewProps> = ({ onNavigate }) => {
  const { createFund, setActiveFundId, isOnline } = useChitFund();

  const [fundName, setFundName] = useState('Chit Fund Premium Series');
  const [cycleFrequency, setCycleFrequency] = useState<'monthly' | 'bi-weekly' | 'weekly'>('monthly');
  const [totalCycles, setTotalCycles] = useState('');
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFinish = async () => {
    if (!fundName.trim()) {
      setError('Please enter a valid Fund / Scheme Name.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Identity-Only Chitti creation
      const fundId = await createFund({
        fundName: fundName.trim(),
        cycleFrequency,
        notes: notes.trim(),
        memberList: [], // Start with 0 members
        totalPool: 0,   // Managed dynamically
        numberOfShares: 0, // Managed dynamically
        commissionPercent: 5, // Default metadata
        totalCycles: totalCycles.trim() ? parseInt(totalCycles, 10) : null,
      });
      setActiveFundId(fundId);
      onNavigate(`funds/${fundId}`);
    } catch (err: any) {
      setError(err?.message || 'Failed to create Fund scheme.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">
      
      {/* Workspace Header */}
      <div className="border-b border-slate-200 pb-5">
        <span className="text-[10px] font-mono-nums font-semibold uppercase tracking-wider text-emerald-800">
          IDENTITY-ONLY WORKFLOW
        </span>
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-950">
          Start Managing Fund
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Establish the identity of your new Fund scheme. Members and billing cycles are created dynamically as you operate.
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Parameters Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Layers className="w-4 h-4 text-emerald-700" />
          <span>Fund Scheme Specifications</span>
        </h2>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Fund / Scheme Name *
          </label>
          <input
            type="text"
            required
            value={fundName}
            onChange={(e) => setFundName(e.target.value)}
            className="mt-1.5 w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition"
            placeholder="e.g. Apex Series, Gold Star Fund"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Cycle Frequency (Scheduling Metadata)
          </label>
          <select
            value={cycleFrequency}
            onChange={(e: any) => setCycleFrequency(e.target.value)}
            className="mt-1.5 w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition"
          >
            <option value="monthly">Monthly Cycle</option>
            <option value="bi-weekly">Bi-Weekly Cycle</option>
            <option value="weekly">Weekly Cycle</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Total Cycles (Optional — Reporting Only)
          </label>
          <input
            type="number"
            min="1"
            value={totalCycles}
            onChange={(e) => setTotalCycles(e.target.value)}
            className="mt-1.5 w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition font-mono-nums"
            placeholder="e.g. 20 (Planned cycles expectation)"
          />
          <span className="text-[10px] text-slate-400 mt-1 block font-sans">
            Optional planning information. It does not create or limit cycles.
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Description / Operational Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="mt-1.5 w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition"
            placeholder="Describe the operational rules, pool targets, or unique notes for this scheme..."
          />
        </div>
      </div>

      <div className="p-4 bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 rounded-xl leading-relaxed">
        <strong>Dynamic Initialization Principle:</strong> This action establishes the Fund record immediately with zero pre-loaded members and cycles. You can add member shares and start billing whenever you are ready.
      </div>

      {/* Navigation and Launch Actions */}
      <div className="flex items-center justify-between border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={() => onNavigate('funds')}
          className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
        >
          Cancel
        </button>

        <button
          type="button"
          disabled={loading || !isOnline}
          onClick={handleFinish}
          className={`px-6 py-2.5 text-xs font-bold text-white disabled:opacity-50 rounded-xl transition flex items-center gap-1.5 shadow-sm ${
            isOnline 
              ? 'bg-emerald-700 hover:bg-emerald-800 cursor-pointer' 
              : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
          }`}
        >
          {loading ? 'Launching Scheme...' : isOnline ? 'Launch Fund' : 'Offline (Launch Disabled)'}
          <CheckCircle2 className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
