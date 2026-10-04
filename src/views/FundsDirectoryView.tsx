import React, { useState } from 'react';
import { useChitFund } from '../context/ChitFundContext';
import { FinancialEngine } from '../services/financialEngine';
import { FundStatus } from '../types';
import { 
  Plus, 
  Search, 
  Gavel, 
  BookOpen, 
  ArrowRight, 
  RotateCw, 
  Layers, 
  Calendar,
  Users
} from 'lucide-react';

interface FundsDirectoryViewProps {
  onNavigate: (tab: string) => void;
  onOpenNewFundModal: () => void;
}

export const FundsDirectoryView: React.FC<FundsDirectoryViewProps> = ({
  onNavigate,
  onOpenNewFundModal,
}) => {
  const { funds, shares, cycles, setActiveFundId } = useChitFund();
  const [selectedFilter, setSelectedFilter] = useState<'all' | FundStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filterTabs: { id: 'all' | FundStatus; label: string }[] = [
    { id: 'all', label: 'All Funds' },
    { id: 'active', label: 'Active Schemes' },
    { id: 'auction_pending', label: 'Cycle Pending' },
    { id: 'completed', label: 'Completed' },
    { id: 'draft', label: 'Draft' },
  ];

  const filteredFunds = funds.filter((f) => {
    const matchesFilter = selectedFilter === 'all' || f.status === selectedFilter;
    const matchesSearch = f.fundName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-[10px] font-mono-nums font-semibold uppercase tracking-wider text-slate-500">
            SCHEME DIRECTORY
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-950">Chit Funds Portfolio</h1>
        </div>

        <button
          onClick={onOpenNewFundModal}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Scheme Wizard</span>
        </button>
      </div>

      {/* Controls: Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-1 sm:pb-0">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium tracking-wide transition cursor-pointer whitespace-nowrap ${
                selectedFilter === tab.id
                  ? 'text-emerald-800 border-b-2 border-emerald-700 font-semibold'
                  : 'text-slate-500 hover:text-slate-800 border-b-2 border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search scheme name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 focus:outline-none focus:border-emerald-600 bg-white"
          />
        </div>

      </div>

      {/* Funds Grid */}
      {filteredFunds.length === 0 ? (
        <div className="bg-white border border-slate-200 p-12 text-center space-y-3">
          <Layers className="w-8 h-8 text-slate-300 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800">No Chit Schemes Found</h3>
          <p className="text-xs text-slate-500">
            {searchQuery ? 'Try altering your search keywords or filter.' : 'Launch a new Chit Fund using the wizard.'}
          </p>
          <button
            onClick={onOpenNewFundModal}
            className="mt-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create First Scheme</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFunds.map((f) => {
            const fundShares = shares.filter(s => s.fundId === f.fundId);
            const prizeClaimedCount = fundShares.filter(s => s.hasClaimedPrize).length;
            const currentCycleVal = f.currentCycle ?? 1;
            const totalCyclesVal = f.totalCycles ?? 12;
            const progress = Math.round((currentCycleVal / totalCyclesVal) * 100);

            return (
              <div 
                key={f.fundId} 
                className="bg-white border border-slate-200 p-5 flex flex-col justify-between hover:border-slate-400 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-serif font-bold text-slate-950 leading-tight">
                        {f.fundName}
                      </h3>
                      <span className="text-[10px] font-mono-nums text-slate-500 uppercase mt-0.5 block">
                        Start: {f.startDate} · {f.cycleFrequency}
                      </span>
                    </div>
                    <span className="text-[10px] uppercase font-mono-nums font-semibold tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 border border-emerald-200 shrink-0">
                      {f.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Financial Grid */}
                  <div className="mt-4 grid grid-cols-2 gap-3 font-mono-nums text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-sans">Pool Value</span>
                      <span className="font-bold text-slate-900 text-sm">{FinancialEngine.formatCurrency(f.totalPool)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-sans">Gross Installment</span>
                      <span className="font-semibold text-slate-700">
                        {FinancialEngine.formatCurrency(Math.round(f.totalPool / totalCyclesVal))}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-sans">Organizer Fee</span>
                      <span className="font-semibold text-emerald-800">{f.commissionPercent}%</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase block font-sans">Prizes Awarded</span>
                      <span className="font-semibold text-slate-700">{prizeClaimedCount} / {f.numberOfShares}</span>
                    </div>
                  </div>

                  {/* Progress Indicator */}
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between text-xs text-slate-600 font-mono-nums mb-1">
                      <span>Cycle Progression</span>
                      <span className="font-medium text-slate-900">Cycle {currentCycleVal} of {totalCyclesVal} ({progress}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5">
                      <div 
                        className="bg-emerald-700 h-full transition-all"
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setActiveFundId(f.fundId);
                      onNavigate(`funds/${f.fundId}/cycles`);
                    }}
                    className="flex-1 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 transition cursor-pointer flex items-center justify-center gap-1 font-mono-nums"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-slate-500" />
                    <span>Cycles</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveFundId(f.fundId);
                      onNavigate(`funds/${f.fundId}/ledger`);
                    }}
                    className="flex-1 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 transition cursor-pointer flex items-center justify-center gap-1 font-mono-nums"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ledger</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveFundId(f.fundId);
                      onNavigate(`funds/${f.fundId}`);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer flex items-center justify-center"
                    title="Fund Overview"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
