import React from 'react';
import { useChitFund } from '../context/ChitFundContext';
import { Fund } from '../types';
import { Plus } from 'lucide-react';

interface ChittiSwitcherProps {
  activeFundId: string | null;
  onSelectFund: (fund: Fund) => void;
  onOpenNewFundModal: () => void;
}

export const ChittiSwitcher: React.FC<ChittiSwitcherProps> = ({
  activeFundId,
  onSelectFund,
  onOpenNewFundModal,
}) => {
  const { funds } = useChitFund();

  return (
    <div className="w-full grid grid-cols-3 sm:flex sm:flex-wrap items-stretch gap-2 py-1">
      {funds.map((f) => {
        const isSelected = activeFundId === f.fundId;
        const shortId = f.displayId || '----';

        return (
          <button
            key={f.fundId}
            onClick={() => onSelectFund(f)}
            className={`min-w-0 w-full px-2 py-2.5 rounded-xl transition cursor-pointer border flex flex-col items-center justify-center ${
              isSelected
                ? 'bg-sky-600 text-white border-sky-500 shadow-sm font-bold'
                : 'bg-slate-800 text-slate-100 border-slate-700 hover:text-white hover:bg-slate-700 font-semibold'
            }`}
          >
            <div className="flex flex-col items-center sm:items-start justify-center gap-0.5 w-full">
              <span className="text-[10px] sm:text-[11px] leading-tight truncate w-full text-center">
                {f.fundName}
              </span>
              <span className={`text-[8px] sm:text-[9px] font-sans uppercase ${isSelected ? 'text-sky-100 opacity-80' : 'text-slate-400'} block truncate w-full text-center`}>
                {shortId}
              </span>
            </div>
          </button>
        );
      })}
      
      <button
        onClick={onOpenNewFundModal}
        className="min-w-0 w-full px-2 py-2.5 rounded-xl transition cursor-pointer border border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-400 hover:border-emerald-400 flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-black shadow-md shrink-0"
      >
        <Plus className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
        <span>+ New Chitti</span>
      </button>
    </div>
  );
};
