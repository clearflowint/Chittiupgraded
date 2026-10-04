import React, { useState, useMemo, useEffect } from 'react';
import { useChitFund } from '../../context/ChitFundContext';
import { Fund, Cycle, Share } from '../../types';
import { X, Calendar, AlertCircle, PlusCircle, ArrowRight, Save, ArrowLeft } from 'lucide-react';
import { FinancialEngine } from '../../services/financialEngine';

interface CreateCycleModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
  cycles: Cycle[];
  initialSelectedCycleId?: string; 
  mode?: 'create' | 'edit';
}

export const CreateCycleModal: React.FC<CreateCycleModalProps> = ({ 
  isOpen, 
  onClose, 
  fund, 
  cycles, 
  initialSelectedCycleId,
  mode = 'create'
}) => {
  const { createCycle, saveCycleBills, shares, billings, showAcknowledgement } = useChitFund();

  // Filter cycles belonging only to this fund
  const fundCycles = useMemo(() => {
    return cycles
      .filter((c) => c.fundId === fund.fundId)
      .sort((a, b) => b.cycleNumber - a.cycleNumber); // Newest first for dropdown
  }, [cycles, fund.fundId]);

  const nextCycleNum = (fundCycles.length > 0 ? Math.max(...fundCycles.map((c) => c.cycleNumber)) : 0) + 1;

  // Selected Cycle State
  // If mode is 'create', we force 'new'. If 'edit', we default to initial or latest.
  const [selectedCycleId, setSelectedCycleId] = useState<string | 'new'>(
    mode === 'create' ? 'new' : (initialSelectedCycleId || (fundCycles[0]?.cycleId || 'new'))
  );

  // Sync selectedCycleId when props change or modal opens
  useEffect(() => {
    if (isOpen) {
      if (mode === 'create') {
        setSelectedCycleId('new');
      } else {
        setSelectedCycleId(initialSelectedCycleId || (fundCycles[0]?.cycleId || 'new'));
      }
    }
  }, [isOpen, initialSelectedCycleId, mode, fundCycles]);

  // Authoritative Active Cycle Data
  const activeCycle = useMemo(() => {
    if (selectedCycleId === 'new') return null;
    return fundCycles.find(c => c.cycleId === selectedCycleId) || null;
  }, [selectedCycleId, fundCycles]);

  const activeCycleNum = activeCycle ? activeCycle.cycleNumber : nextCycleNum;

  // Form states
  const [cycleName, setCycleName] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [organizerCommission, setOrganizerCommission] = useState<number>(0);
  const [shareBills, setShareBills] = useState<Record<string, number>>({});

  // Bulk Apply helpers
  const [group1ApplyVal, setGroup1ApplyVal] = useState<string>('');
  const [group2ApplyVal, setGroup2ApplyVal] = useState<string>('');
  const [group3ApplyVal, setGroup3ApplyVal] = useState<string>('');

  // UI Flow states
  const [step, setStep] = useState<0 | 1>(0); // 0: Input, 1: Confirm
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shares lists
  const fundShares = useMemo(() => {
    return shares.filter((s) => s.fundId === fund.fundId).sort((a, b) => a.shareNumber - b.shareNumber);
  }, [shares, fund.fundId]);

  // Lock body scroll
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

  // Sync state when selectedCycleId changes
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setStep(0);

    if (selectedCycleId === 'new') {
      setCycleName(`Cycle #${nextCycleNum}`);
      setStartDate(new Date().toISOString().split('T')[0]);
      setEndDate('');
      setOrganizerCommission(0);
      
      const initialBills: Record<string, number> = {};
      fundShares.forEach((s) => {
        initialBills[s.shareId] = 0;
      });
      setShareBills(initialBills);
    } else if (activeCycle) {
      setCycleName(activeCycle.cycleName || `Cycle #${activeCycle.cycleNumber}`);
      setStartDate(activeCycle.startDate || activeCycle.auctionDate || '');
      setEndDate(activeCycle.endDate || '');
      setOrganizerCommission(activeCycle.organizerCommission || 0);

      const cycleBillings = billings.filter((b) => b.cycleId === activeCycle.cycleId);
      const initialBills: Record<string, number> = {};
      fundShares.forEach((s) => {
        const b = cycleBillings.find((bill) => bill.shareId === s.shareId);
        initialBills[s.shareId] = b ? b.billAmount : 0;
      });
      setShareBills(initialBills);
    }
  }, [selectedCycleId, activeCycle, isOpen, nextCycleNum, fundShares, billings]);

  // Initialize selectedCycleId when prop changes
  useEffect(() => {
    if (isOpen) {
      setSelectedCycleId(initialSelectedCycleId || 'new');
    }
  }, [initialSelectedCycleId, isOpen]);

  // --- CLASSIFICATION LOGIC (Relative to activeCycleNum) ---
  const group1Shares = useMemo(() => {
    return fundShares.filter((s) => {
      const wonNum = s.wonCycleNumber;
      return s.hasClaimedPrize && wonNum !== null && wonNum !== undefined && wonNum < activeCycleNum;
    });
  }, [fundShares, activeCycleNum]);

  const group2Shares = useMemo(() => {
    return fundShares.filter((s) => {
      const wonNum = s.wonCycleNumber;
      return s.hasClaimedPrize && wonNum !== null && wonNum !== undefined && wonNum === activeCycleNum;
    });
  }, [fundShares, activeCycleNum]);

  const group3Shares = useMemo(() => {
    return fundShares.filter((s) => {
      const wonNum = s.wonCycleNumber;
      return !s.hasClaimedPrize || wonNum === null || wonNum === undefined || wonNum > activeCycleNum;
    });
  }, [fundShares, activeCycleNum]);

  const totalCycleBill = useMemo(() => {
    return Object.values(shareBills).reduce((sum, val) => sum + (val || 0), 0);
  }, [shareBills]);

  const handleApplyGroup1 = () => {
    const val = Number(group1ApplyVal) || 0;
    setShareBills(prev => {
      const updated = { ...prev };
      group1Shares.forEach(s => updated[s.shareId] = val);
      return updated;
    });
  };

  const handleApplyGroup2 = () => {
    const val = Number(group2ApplyVal) || 0;
    setShareBills(prev => {
      const updated = { ...prev };
      group2Shares.forEach(s => updated[s.shareId] = val);
      return updated;
    });
  };

  const handleApplyGroup3 = () => {
    const val = Number(group3ApplyVal) || 0;
    setShareBills(prev => {
      const updated = { ...prev };
      group3Shares.forEach(s => updated[s.shareId] = val);
      return updated;
    });
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cycleName.trim()) {
      setError('Cycle Name is required.');
      return;
    }
    if (!startDate) {
      setError('Start Date is required.');
      return;
    }
    setStep(1);
    setError(null);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      let cycleIdResult = '';
      if (selectedCycleId !== 'new' && activeCycle) {
        await saveCycleBills({
          fundId: fund.fundId,
          cycleId: activeCycle.cycleId,
          shareBills,
          cycleName: cycleName.trim(),
          startDate,
          endDate: endDate ? endDate : null,
          organizerCommission,
        });
        cycleIdResult = activeCycle.cycleId;
      } else {
        cycleIdResult = await createCycle({
          fundId: fund.fundId,
          cycleName: cycleName.trim(),
          startDate,
          endDate: endDate ? endDate : null,
          organizerCommission,
          shareBills,
        });
      }

      setLoading(false);
      onClose();

      showAcknowledgement({
        isSuccess: true,
        title: activeCycle ? 'Cycle Records Updated' : 'Fund Cycle Initialized',
        message: activeCycle 
          ? `Successfully updated individual bills and metadata for Cycle #${activeCycle.cycleNumber}.`
          : `Cycle #${nextCycleNum} ("${cycleName}") and individual Share bills have been successfully persisted.`,
        operationType: activeCycle ? 'UPDATE CYCLE BILLS' : 'CREATE FUND CYCLE',
        referenceId: cycleIdResult || `CY-OP-${Date.now().toString().slice(-6)}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to process cycle operational records');
      setLoading(false);
      setStep(0);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4 overflow-y-auto font-sans animate-in fade-in duration-200">
      <div className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl bg-white flex flex-col sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
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
              <div className="w-8 h-8 rounded-xl bg-sky-600/30 border border-sky-400/30 text-sky-400 flex items-center justify-center">
                <PlusCircle className="w-4 h-4" />
              </div>
            )}
            <div>
              <span className="text-[10px] uppercase font-mono-nums tracking-widest text-sky-400 font-bold block">
                {fund.fundName} · OPERATION
              </span>
              <h2 className="text-sm font-black text-white">
                {step === 1 ? 'REVIEW & CONFIRM BILLING' : (selectedCycleId === 'new' ? 'CREATE NEXT CYCLE' : 'EDIT CYCLE BILLING')}
              </h2>
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
              
              {/* CYCLE SELECTOR / DROPDOWN */}
              {mode === 'edit' ? (
                <div className="space-y-2 bg-slate-50 border border-slate-200 p-3.5 rounded-2xl shadow-sm">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">
                    Select Cycle to Edit
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCycleId}
                      onChange={(e) => setSelectedCycleId(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-sky-500 font-black text-slate-900 text-sm appearance-none shadow-xs transition-all"
                    >
                      {fundCycles.map((c) => (
                        <option key={c.cycleId} value={c.cycleId}>
                          Cycle #{c.cycleNumber} — {c.cycleName || `Cycle #${c.cycleNumber}`} ({c.startDate})
                        </option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-sky-500"></div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Operational Cycle: <span className="text-slate-700 font-mono-nums">#{activeCycleNum}</span> (Read-Only)
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 bg-sky-50/50 border border-sky-100 p-3.5 rounded-2xl shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-sky-600 uppercase tracking-[0.15em] ml-1">
                      New Operational Cycle
                    </span>
                    <span className="text-[10px] font-black text-sky-800 bg-sky-100 px-2 py-0.5 rounded-lg">
                      SEQUENCE #{nextCycleNum}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 ml-1">
                    System-controlled cycle number. Manager cannot edit sequence.
                  </p>
                </div>
              )}

              {/* Metadata Section */}
              <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-4 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-tight mb-1.5 ml-0.5">
                      Cycle Name / Label *
                    </label>
                    <input
                      type="text"
                      required
                      value={cycleName}
                      onChange={(e) => setCycleName(e.target.value)}
                      placeholder="e.g. October Installment"
                      className="w-full px-4 py-3 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-bold text-slate-800 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-tight mb-1.5 ml-0.5">
                      Organizer Commission (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={organizerCommission || ''}
                      onChange={(e) => setOrganizerCommission(Math.max(0, Number(e.target.value)))}
                      placeholder="0"
                      className="w-full px-4 py-3 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-tight mb-1.5 ml-0.5">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-tight mb-1.5 ml-0.5">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-3 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums font-bold text-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* THREE BILLING GROUPS */}

              {/* GROUP 1: PREVIOUSLY DRAWN MEMBERS */}
              <div className="space-y-3 border border-emerald-200 rounded-2xl p-3.5 bg-emerald-50/5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-100 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 block">
                      PREVIOUSLY DRAWN MEMBERS ({group1Shares.length})
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">
                      Won in cycles BEFORE Cycle #{activeCycleNum}
                    </span>
                  </div>

                  {group1Shares.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="Amt"
                          value={group1ApplyVal}
                          onChange={(e) => setGroup1ApplyVal(e.target.value)}
                          className="w-24 pl-6 pr-2 py-1.5 text-xs border border-slate-200 bg-white rounded-lg font-mono-nums font-black h-8 shadow-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyGroup1}
                        className="px-3 py-1.5 text-[9px] font-black text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition uppercase tracking-tight h-8"
                      >
                        Apply All
                      </button>
                    </div>
                  )}
                </div>

                {group1Shares.length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-2 italic text-center">No previously drawn members.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                    {group1Shares.map((s) => (
                      <div key={s.shareId} className="flex items-center justify-between gap-3 p-2.5 bg-white border border-slate-100 rounded-xl text-xs hover:border-emerald-200 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono-nums font-black text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 shrink-0 text-[9px]">
                              {s.displayId || '----'}
                            </span>
                            <span className="font-black text-slate-800 truncate">{s.memberName}</span>
                          </div>
                          <span className="text-[9px] font-bold text-emerald-600 block mt-1 uppercase tracking-tighter bg-emerald-50 w-fit px-1 rounded">
                            WON CYCLE #{s.wonCycleNumber}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 font-mono-nums">
                          <span className="text-[10px] text-slate-400 font-bold">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={shareBills[s.shareId] ?? 0}
                            onChange={(e) => setShareBills(prev => ({ ...prev, [s.shareId]: Number(e.target.value) }))}
                            className="w-24 px-2 py-1.5 text-xs border border-slate-200 bg-slate-50 focus:bg-white rounded-lg font-black text-slate-900 focus:outline-none focus:border-emerald-500 h-8 text-right transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* GROUP 2: CURRENT CYCLE — DRAWN MEMBERS */}
              <div className="space-y-3 border border-amber-200 rounded-2xl p-3.5 bg-amber-50/5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-100 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-800 block">
                      CURRENT CYCLE — DRAWN MEMBERS ({group2Shares.length})
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">
                      Members winning in Cycle #{activeCycleNum}
                    </span>
                  </div>

                  {group2Shares.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="Amt"
                          value={group2ApplyVal}
                          onChange={(e) => setGroup2ApplyVal(e.target.value)}
                          className="w-24 pl-6 pr-2 py-1.5 text-xs border border-slate-200 bg-white rounded-lg font-mono-nums font-black h-8 shadow-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyGroup2}
                        className="px-3 py-1.5 text-[9px] font-black text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition uppercase tracking-tight h-8"
                      >
                        Apply All
                      </button>
                    </div>
                  )}
                </div>

                {group2Shares.length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-2 italic text-center">No members drawn specifically in this cycle.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                    {group2Shares.map((s) => (
                      <div key={s.shareId} className="flex items-center justify-between gap-3 p-2.5 bg-white border border-slate-100 rounded-xl text-xs hover:border-amber-200 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono-nums font-black text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 shrink-0 text-[9px]">
                              {s.displayId || '----'}
                            </span>
                            <span className="font-black text-slate-800 truncate">{s.memberName}</span>
                          </div>
                          <span className="text-[9px] font-bold text-amber-600 block mt-1 uppercase tracking-tighter bg-amber-50 w-fit px-1 rounded animate-pulse">
                            CURRENT WINNER
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 font-mono-nums">
                          <span className="text-[10px] text-slate-400 font-bold">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={shareBills[s.shareId] ?? 0}
                            onChange={(e) => setShareBills(prev => ({ ...prev, [s.shareId]: Number(e.target.value) }))}
                            className="w-24 px-2 py-1.5 text-xs border border-slate-200 bg-slate-50 focus:bg-white rounded-lg font-black text-slate-900 focus:outline-none focus:border-amber-500 h-8 text-right transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* GROUP 3: CURRENT CYCLE — UNDRAWN MEMBERS */}
              <div className="space-y-3 border border-sky-200 rounded-2xl p-3.5 bg-sky-50/5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-sky-100 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-sky-800 block">
                      CURRENT CYCLE — UNDRAWN MEMBERS ({group3Shares.length})
                    </span>
                    <span className="text-[9px] text-slate-400 font-medium">
                      Not yet drawn as of Cycle #{activeCycleNum}
                    </span>
                  </div>

                  {group3Shares.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          placeholder="Amt"
                          value={group3ApplyVal}
                          onChange={(e) => setGroup3ApplyVal(e.target.value)}
                          className="w-24 pl-6 pr-2 py-1.5 text-xs border border-slate-200 bg-white rounded-lg font-mono-nums font-black h-8 shadow-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyGroup3}
                        className="px-3 py-1.5 text-[9px] font-black text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition uppercase tracking-tight h-8"
                      >
                        Apply All
                      </button>
                    </div>
                  )}
                </div>

                {group3Shares.length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-2 italic text-center">No undrawn members remaining.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                    {group3Shares.map((s) => (
                      <div key={s.shareId} className="flex items-center justify-between gap-3 p-2.5 bg-white border border-slate-100 rounded-xl text-xs hover:border-sky-200 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono-nums font-black text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 shrink-0 text-[9px]">
                              {s.displayId || '----'}
                            </span>
                            <span className="font-black text-slate-800 truncate">{s.memberName}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 font-mono-nums">
                          <span className="text-[10px] text-slate-400 font-bold">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={shareBills[s.shareId] ?? 0}
                            onChange={(e) => setShareBills(prev => ({ ...prev, [s.shareId]: Number(e.target.value) }))}
                            className="w-24 px-2 py-1.5 text-xs border border-slate-200 bg-slate-50 focus:bg-white rounded-lg font-black text-slate-900 focus:outline-none focus:border-sky-500 h-8 text-right transition-all"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer with Total and Actions */}
              <div className="pt-5 border-t border-slate-150 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 shrink-0 font-sans">
                <div className="bg-slate-900 px-4 py-3 rounded-2xl border border-slate-800 shadow-inner flex items-center justify-between sm:block sm:w-auto w-full">
                  <span className="text-[9px] font-black text-sky-400 uppercase tracking-[0.2em] block leading-none">Derived Total Cycle Bill</span>
                  <span className="text-base font-black text-white font-mono-nums mt-1 block">
                    {FinancialEngine.formatCurrency(totalCycleBill)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:w-auto w-full">
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-3 px-6 rounded-2xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer min-h-[48px] text-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="py-3 px-6 rounded-2xl text-xs font-black text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 transition cursor-pointer shadow-md min-h-[48px] flex items-center justify-center gap-2"
                  >
                    <span>{activeCycle ? 'Review Changes' : 'Review & Confirm'}</span>
                    <ArrowRight className="w-4 h-4 shrink-0" />
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* STEP 2: SUMMARY CONFIRMATION SCREEN */
            <div className="p-5 space-y-5 animate-in slide-in-from-right-4 duration-300 pb-24 sm:pb-5 font-sans">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 shadow-xs">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-normal">
                  <span className="font-black block text-amber-950 text-[13px] mb-1 uppercase tracking-tight">Pre-Submission Verification</span>
                  You are about to materialise authoritative operational records for <strong>{cycleName}</strong>. Please verify the billing totals and member distributions below.
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
                <div className="bg-slate-900 text-white px-5 py-3 text-[10px] font-black uppercase tracking-[0.25em] border-b border-slate-800">
                  Cycle #{activeCycleNum} Operational Summary
                </div>
                <div className="p-5 space-y-6">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 pb-5 border-b border-slate-100">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cycle Name</span>
                      <span className="text-sm font-black text-slate-800">{cycleName}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Start Date</span>
                      <span className="text-sm font-bold text-slate-800 font-mono-nums">{startDate}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Manager Commission</span>
                      <span className="text-sm font-bold text-slate-800 font-mono-nums">{FinancialEngine.formatCurrency(organizerCommission)}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Billing Pool</span>
                      <span className="text-base font-black text-sky-700 font-mono-nums">{FinancialEngine.formatCurrency(totalCycleBill)}</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest block">Group Distributions Audit:</span>
                    
                    <div className="space-y-2.5">
                      {/* Group 1 Summary */}
                      <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
                        <div>
                          <span className="text-[10px] font-black text-emerald-800 block uppercase">Previously Drawn Members</span>
                          <span className="text-[10px] text-emerald-600 font-bold">{group1Shares.length} Allotments</span>
                        </div>
                        <span className="text-sm font-black text-slate-700 font-mono-nums">
                          {FinancialEngine.formatCurrency(group1Shares.reduce((sum, s) => sum + (shareBills[s.shareId] || 0), 0))}
                        </span>
                      </div>

                      {/* Group 2 Summary */}
                      <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-100 rounded-2xl">
                        <div>
                          <span className="text-[10px] font-black text-amber-800 block uppercase">Current Cycle — Drawn Members</span>
                          <span className="text-[10px] text-amber-600 font-bold">{group2Shares.length} Allotments</span>
                        </div>
                        <span className="text-sm font-black text-slate-700 font-mono-nums">
                          {FinancialEngine.formatCurrency(group2Shares.reduce((sum, s) => sum + (shareBills[s.shareId] || 0), 0))}
                        </span>
                      </div>

                      {/* Group 3 Summary */}
                      <div className="flex items-center justify-between p-3 bg-sky-50 border border-sky-100 rounded-2xl">
                        <div>
                          <span className="text-[10px] font-black text-sky-800 block uppercase">Current Cycle — Undrawn Members</span>
                          <span className="text-[10px] text-sky-600 font-bold">{group3Shares.length} Allotments</span>
                        </div>
                        <span className="text-sm font-black text-slate-700 font-mono-nums">
                          {FinancialEngine.formatCurrency(group3Shares.reduce((sum, s) => sum + (shareBills[s.shareId] || 0), 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-5">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="flex-1 py-4 px-6 rounded-2xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Go Back & Correct
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleSubmit}
                  className="flex-[1.5] py-4 px-6 rounded-2xl text-xs font-black text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 shadow-md transition cursor-pointer flex items-center justify-center gap-2"
                >
                  {loading ? 'Processing...' : (activeCycle ? 'Confirm & Update Records' : 'Yes, Create Operational Cycle')}
                  <Save className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
