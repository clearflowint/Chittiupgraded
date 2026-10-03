import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useChitFund } from '../context/ChitFundContext';
import { ChittiSwitcher } from './ChittiSwitcher';
import { Fund } from '../types';

interface ManagerHeaderProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  onOpenNewFundModal: () => void;
  activeSubTab?: string;
  onSubTabNavigate?: (subTab: any) => void;
  fundSharesCount?: number;
  nextCycleNum?: number;
}

export const ManagerHeader: React.FC<ManagerHeaderProps> = ({
  currentTab,
  onNavigate,
  onOpenNewFundModal,
  activeSubTab,
  onSubTabNavigate,
  fundSharesCount = 0,
  nextCycleNum = 1,
}) => {
  const { tenant } = useAuth();
  const { activeFund } = useChitFund();

  const isInsideChitti = currentTab === 'fund_workspace' || currentTab.startsWith('funds/') || currentTab.startsWith('/funds/') || currentTab.startsWith('fund_');

  return (
    <div className="w-full bg-[#0f172a] text-white border-b border-slate-800 shadow-sm shrink-0">
      <div className="max-w-7xl mx-auto px-3 py-1.5">
        {/* Chitti Selection Tabs (Always visible if inside chitti context) */}
        {isInsideChitti && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <ChittiSwitcher
              activeFundId={activeFund?.fundId || null}
              onSelectFund={(f: Fund) => onNavigate(`funds/${f.fundId}`)}
              onOpenNewFundModal={onOpenNewFundModal}
            />
          </div>
        )}
      </div>
    </div>
  );
};
