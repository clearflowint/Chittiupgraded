import React, { useState, useMemo, useEffect } from 'react';
import { useChitFund } from '../context/ChitFundContext';
import { useAuth } from '../context/AuthContext';
import { FinancialEngine } from '../services/financialEngine';
import { Fund, Share, Cycle } from '../types';
import { ChittiSwitcher } from '../components/ChittiSwitcher';
import { MemberCard } from '../components/MemberCard';
import { CycleCard } from '../components/CycleCard';
import { TreasuryView } from './TreasuryView';
import { CrmView } from './CrmView';
import { AuditView } from './AuditView';
import { FundsDirectoryView } from './FundsDirectoryView';
import { SendReportModal } from '../components/modals/SendReportModal';
import { AddMemberModal } from '../components/modals/AddMemberModal';
import { QuickRecordPaymentModal } from '../components/modals/QuickRecordPaymentModal';
import { ShareStatementModal } from '../components/modals/ShareStatementModal';
import { BulkStatementModal } from '../components/modals/BulkStatementModal';
import { CommunicationWebhookModal } from '../components/modals/CommunicationWebhookModal';
import { ManagerProfileModal } from '../components/modals/ManagerProfileModal';
import { CommunicationDispatcher } from '../services/communicationDispatcher';
import { formatPhoneDisplay } from '../utils/phone';
import { 
  Plus, 
  Gavel, 
  CreditCard, 
  Calendar,
  Layers,
  Send,
  CheckCircle2,
  Search,
  RotateCw,
  MessageSquare,
  BookOpen,
  Trash2,
  ShieldAlert,
  ArrowRight,
  LogOut,
  ArrowLeft,
  Users,
  AlertTriangle,
  Phone,
  Coins,
  ShieldCheck,
  FolderOpen,
  X,
  Edit3,
  FileText,
  Webhook,
  UserCheck
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onOpenNewFundModal: () => void;
  onOpenPaymentModal: (shareId?: string) => void;
  onOpenDrawCorrectionModal: (share: Share) => void;
  onOpenEditMemberModal: (share: Share) => void;
  onOpenWhatsAppReminderModal: (share?: Share, mode?: 'single' | 'all-pending') => void;
  onOpenDeleteChittiModal: (fund: Fund) => void;
  onOpenShareEditBillsModal: (share: Share) => void;
  onOpenEditCycleModal: (cycle: Cycle) => void;
  onOpenCreateCycleModal: () => void;
  onOpenEditChittiNameModal?: () => void;
  onOpenDeleteShareModal?: () => void;
  initialSubTab?: string;
  isPortfolioOverview?: boolean;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenNewFundModal,
  onOpenPaymentModal,
  onOpenDrawCorrectionModal,
  onOpenEditMemberModal,
  onOpenWhatsAppReminderModal,
  onOpenDeleteChittiModal,
  onOpenShareEditBillsModal,
  onOpenEditCycleModal,
  onOpenCreateCycleModal,
  onOpenEditChittiNameModal,
  onOpenDeleteShareModal,
  initialSubTab = 'members',
  isPortfolioOverview = false,
}) => {
  const { tenant, signOut } = useAuth();
  const { 
    funds, 
    shares, 
    cycles, 
    billings,
    payments, 
    activeFund, 
    setActiveFundId, 
    endFund,
    revokeEndFund,
    updateFundMetadata,
    showAcknowledgement,
    campaigns,
    sendCampaign,
    deleteCurrentCycle,
    isOnline
  } = useChitFund();

  // Search & Filter state for members
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'undrawn' | 'drawn' | 'pending'>('all');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isSendReportOpen, setIsSendReportOpen] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isTotalCyclesModalOpen, setIsTotalCyclesModalOpen] = useState(false);
  const [inputTotalCycles, setInputTotalCycles] = useState<number | ''>('');
  const [isQuickPaymentOpen, setIsQuickPaymentOpen] = useState(false);
  const [statementShare, setStatementShare] = useState<Share | null>(null);
  const [isBulkStatementOpen, setIsBulkStatementOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const hasProfile = Boolean(
    tenant?.name &&
    tenant?.phone &&
    tenant.phone.trim() !== ''
  );

  // Selected Chitti Context
  const currentFund = activeFund;

  // Reset filters when active Chitti changes
  useEffect(() => {
    setSearchQuery('');
    setStatusFilter('all');
  }, [currentFund?.fundId]);

  // Switcher Handler: switches active Chitti and updates authoritative URL
  const handleSelectChitti = (fund: Fund) => {
    setActiveFundId(fund.fundId);
    setSearchQuery('');
    setStatusFilter('all');
    onNavigate(`funds/${fund.fundId}`);
  };

  const fundShares = useMemo(() => {
    if (!currentFund) return [];
    return shares.filter((s) => s.fundId === currentFund.fundId);
  }, [shares, currentFund]);

  const currentFundDisplayId = currentFund?.displayId || '----';

  // Cycle navigation state
  const [viewedCycleId, setViewedCycleId] = useState<string | null>(null);

  const fundCycles = useMemo(() => {
    if (!currentFund) return [];
    return cycles
      .filter((c) => c.fundId === currentFund.fundId)
      .sort((a, b) => a.cycleNumber - b.cycleNumber);
  }, [cycles, currentFund]);

  // Sync viewedCycleId to latest by default
  useEffect(() => {
    if (fundCycles.length > 0 && !viewedCycleId) {
      setViewedCycleId(fundCycles[fundCycles.length - 1].cycleId);
    }
  }, [fundCycles, viewedCycleId]);

  const currentViewedCycle = useMemo(() => {
    if (!viewedCycleId) return fundCycles[fundCycles.length - 1] || null;
    return fundCycles.find(c => c.cycleId === viewedCycleId) || fundCycles[fundCycles.length - 1] || null;
  }, [fundCycles, viewedCycleId]);

  const currentViewedIndex = useMemo(() => {
    if (!currentViewedCycle) return -1;
    return fundCycles.findIndex(c => c.cycleId === currentViewedCycle.cycleId);
  }, [fundCycles, currentViewedCycle]);

  const handlePrevCycle = () => {
    if (currentViewedIndex > 0) {
      setViewedCycleId(fundCycles[currentViewedIndex - 1].cycleId);
    }
  };

  const handleNextCycle = () => {
    if (currentViewedIndex < fundCycles.length - 1) {
      setViewedCycleId(fundCycles[currentViewedIndex + 1].cycleId);
    }
  };

  const currentCycle = useMemo(() => {
    if (!currentFund || fundCycles.length === 0) return null;
    return fundCycles[fundCycles.length - 1];
  }, [fundCycles, currentFund]);

  // Operational metrics for active Chitti
  const drawnCount = fundShares.filter((s) => s.hasClaimedPrize).length;
  const undrawnCount = fundShares.length - drawnCount;
  const pendingArrearsCount = fundShares.filter((s) => s.arrears > 0).length;

  const totalArrears = fundShares.reduce((a, s) => a + s.arrears, 0);
  const totalAdvances = fundShares.reduce((a, s) => a + s.advance, 0);
  const payoutAmount = currentCycle?.winnerNetPayout || Math.round(currentFund ? currentFund.totalPool * 0.8 : 0);

  // Filtered members list
  const filteredShares = useMemo(() => {
    return fundShares.filter((s) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        s.memberName.toLowerCase().includes(query) ||
        s.memberPhone.includes(query) ||
        s.shareNumber.toString().includes(query) ||
        (s.displayId && s.displayId.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      if (statusFilter === 'undrawn') return !s.hasClaimedPrize;
      if (statusFilter === 'drawn') return s.hasClaimedPrize;
      if (statusFilter === 'pending') return s.arrears > 0;
      return true;
    });
  }, [fundShares, searchQuery, statusFilter, refreshTrigger]);

  // ... (rest of Portfolio Overview logic kept as is)
  const totalPortfolioPool = funds.reduce((acc, f) => acc + (f.totalPool || 0), 0);
  const totalPortfolioOutflows = cycles
    .filter((c) => c.isAuctionClosed && c.winnerNetPayout)
    .reduce((acc, c) => acc + (c.winnerNetPayout || 0), 0);
  const totalPortfolioBilled = shares.reduce((acc, s) => acc + (s.totalBilled || 0), 0);
  const totalPortfolioPaid = shares.reduce((acc, s) => acc + ((s.totalCredits || 0) - (s.totalDebits || 0)), 0);
  const portfolioHealthRate = totalPortfolioBilled > 0 ? Math.round((totalPortfolioPaid / totalPortfolioBilled) * 100) : 100;
  const overdueMembersCount = shares.filter((s) => s.arrears > 0).length;

  const handleSignOut = async () => {
    try {
      const success = await signOut();
      if (success) {
        onNavigate('landing');
      }
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  // ----------------------------------------------------
  // MODE 1: Top-Level Manager Dashboard Portfolio Router (Section 2)
  // When explicitly on #/dashboard without an active Chitti focus
  // ----------------------------------------------------
  if (isPortfolioOverview) {
    const activeFunds = funds.filter((f) => f.status !== 'ended');

    return (
      <div className="space-y-6 pb-20">
        {/* Profile Incomplete Notification Banner */}
        {!hasProfile && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-200 animate-in fade-in shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-amber-300 font-sans">
                  Complete Your Manager Profile
                </h3>
                <p className="text-[11px] text-amber-200/80 font-sans">
                  Please set your manager name and 10-digit mobile number for official fund communications.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              disabled={!isOnline}
              title={!isOnline ? "Completing profile requires internet connection" : "Complete profile"}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 shadow-xs ${
                isOnline 
                  ? 'text-slate-900 bg-amber-400 hover:bg-amber-300 cursor-pointer' 
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
              }`}
            >
              {isOnline ? 'Complete Profile' : 'Offline'}
            </button>
          </div>
        )}

        {/* 1. Manager Dashboard Card with Heading and 4 manager level ledger values */}
        <div className="bg-[#0f172a] text-white border border-slate-800 rounded-2xl p-3.5 sm:p-4.5 shadow-md space-y-3.5">
          <div className="flex items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
            <div className="min-w-0">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-white truncate">
                {tenant?.name || 'Operations Manager'}
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400 font-sans truncate mt-0.5 font-medium lowercase">
                {tenant?.email || 'manager@clearflow.internal'}
              </p>
            </div>
            <div className="text-xs sm:text-sm font-sans text-sky-400 bg-sky-950/40 border border-sky-800/40 px-3 py-1.5 rounded-xl font-extrabold shrink-0 shadow-xs">
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono-nums">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 uppercase block tracking-wider font-sans">Portfolio Assets</span>
              <span className="text-sm font-bold text-white mt-0.5 block truncate font-mono-nums">
                {FinancialEngine.formatCurrency(totalPortfolioPool)}
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 uppercase block tracking-wider font-sans">Total Disbursed</span>
              <span className="text-sm font-bold text-emerald-400 mt-0.5 block truncate font-mono-nums">
                {FinancialEngine.formatCurrency(totalPortfolioOutflows)}
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 uppercase block tracking-wider font-sans">Collection Health</span>
              <span className="text-sm font-bold text-white mt-0.5 block truncate font-mono-nums">
                {portfolioHealthRate}%
              </span>
            </div>

            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 uppercase block tracking-wider font-sans">Total Arrears</span>
              <span className="text-sm font-bold text-rose-400 mt-0.5 block truncate font-mono-nums">
                {overdueMembersCount} Overdue
              </span>
            </div>
          </div>
        </div>

        {/* 2. Dashboard Actions: Quick Record Payment & Launch New Scheme */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Prominent Quick Record Payment Card */}
          <div className="flex items-center justify-between bg-white border border-emerald-200/90 hover:border-emerald-400 rounded-2xl p-3.5 shadow-2xs transition">
            <div className="space-y-0.5 min-w-0 pr-2">
              <div className="flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
                <h4 className="text-xs font-bold text-slate-900 font-sans truncate">Collect Member Payment</h4>
              </div>
              <p className="text-[10px] text-slate-500 font-sans truncate">Record installment without opening a Fund.</p>
            </div>
            <button
              onClick={() => setIsQuickPaymentOpen(true)}
              disabled={!isOnline}
              title={!isOnline ? "Payment recording requires internet connection" : "Record a payment"}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition shadow-xs min-h-[38px] whitespace-nowrap shrink-0 ${
                isOnline 
                  ? 'bg-emerald-700 hover:bg-emerald-800 cursor-pointer' 
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
              <span>{isOnline ? '+ RECORD' : 'OFFLINE'}</span>
            </button>
          </div>

          {/* New Chitti option */}
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs">
            <div className="space-y-0.5 min-w-0 pr-2">
              <h4 className="text-xs font-bold text-slate-900 font-sans truncate">Launch New Scheme</h4>
              <p className="text-[10px] text-slate-500 font-sans truncate">Create a tenant-isolated Fund workspace.</p>
            </div>
            <button
              onClick={onOpenNewFundModal}
              disabled={!isOnline}
              title={!isOnline ? "Fund scheme creation requires internet connection" : "Launch new fund scheme"}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition shadow-xs min-h-[38px] whitespace-nowrap shrink-0 ${
                isOnline 
                  ? 'bg-[#0284c7] hover:bg-[#0369a1] cursor-pointer' 
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
              }`}
            >
              <Plus className="w-3.5 h-3.5 text-white shrink-0" />
              <span>{isOnline ? '+ New Fund' : 'OFFLINE'}</span>
            </button>
          </div>
        </div>

        {/* 3. Chitti workspaces listing */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 font-sans pl-1">
            Fund Workspaces
          </h2>
          
          {activeFunds.length === 0 ? (
            <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-6 text-center">
              <span className="text-xs font-bold text-slate-500 font-sans block">No Active Funds</span>
              <p className="text-[11px] text-slate-400 font-sans mt-1">Initialize your first Fund scheme above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {activeFunds.map((f) => {
                const fShortId = f.displayId || '----';
                return (
                  <div
                    key={f.fundId}
                    className="bg-white border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-2xs hover:border-sky-500 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono-nums font-bold bg-slate-100 text-slate-600 shrink-0 border border-slate-200 uppercase">
                        {fShortId}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-xs font-bold text-slate-900 truncate">
                          {f.fundName}
                        </h3>
                        <span className="text-[9px] text-slate-400 font-mono-nums font-semibold block uppercase">
                          ID: {fShortId}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectChitti(f)}
                      className="py-1.5 px-3 rounded-xl text-[10px] font-extrabold text-white bg-[#0284c7] hover:bg-[#0369a1] transition cursor-pointer shrink-0 min-h-[32px] flex items-center"
                    >
                      <span>Enter Workspace →</span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. CRM & outreach campaign block underneath */}
        <div className="pt-4 border-t border-slate-200">
          <CrmView />
        </div>

        {/* Manager Profile Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 font-sans">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">System Administration</span>
                <h3 className="text-xs font-bold text-slate-900">Manager Profile</h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              className="px-3.5 py-1.5 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition shadow-2xs"
            >
              <Edit3 className="w-3.5 h-3.5 text-sky-600" />
              <span>{hasProfile ? 'Edit Profile' : 'Add Profile'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono-nums">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 uppercase block tracking-wider font-sans font-semibold">Manager Name</span>
              <span className="font-bold text-slate-800 font-sans text-xs truncate block mt-0.5">
                {tenant?.name ? tenant.name : (
                  <span className="text-amber-600 font-normal italic font-sans">Not set</span>
                )}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 uppercase block tracking-wider font-sans font-semibold">Manager Phone</span>
              <span className="font-bold text-slate-800 text-xs truncate block mt-0.5">
                {tenant?.phone && tenant.phone.trim() !== '' ? (
                  formatPhoneDisplay(tenant.phone)
                ) : (
                  <span className="text-amber-600 font-normal italic font-sans">Not set</span>
                )}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 uppercase block tracking-wider font-sans font-semibold">Manager Email</span>
              <span className="font-medium text-slate-600 text-xs truncate block mt-0.5 lowercase font-mono">
                {tenant?.email || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Operational Modal: Quick Record Payment Shortcut */}
        <QuickRecordPaymentModal
          isOpen={isQuickPaymentOpen}
          onClose={() => setIsQuickPaymentOpen(false)}
        />

        {/* Manager Profile Modal */}
        <ManagerProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
        />
      </div>
    );
  }

  // ----------------------------------------------------
  // INVALID / NON-OWNED FUND STATE: When a fundId was explicitly requested in URL
  // but does not exist or user doesn't have access to it
  // ----------------------------------------------------
  if (!currentFund) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
          <ShieldAlert className="w-7 h-7 text-slate-500" />
        </div>
        <div className="space-y-1.5 max-w-md">
          <h2 className="text-xl font-bold font-serif text-slate-900">
            Fund Not Found
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed font-mono-nums">
            The requested Fund does not exist or you don't have access to it.
          </p>
        </div>
        <button
          onClick={() => onNavigate('dashboard')}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#0284c7] hover:bg-[#0369a1] transition cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>
    );
  }

  // ----------------------------------------------------
  // MODE 2: ACTIVE CHITTI WORKSPACE (Section 3, 5, 6, 7)
  // ----------------------------------------------------
  return (
    <div className="space-y-6 pb-20">
      
      {/* ACTIVE FUND WORKSPACE IDENTITY HEADER */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs font-sans">
        <h1 className="text-lg font-black text-slate-900 tracking-tight font-sans leading-snug">
          {currentFund.fundName}
        </h1>
        <div className="text-xs font-semibold text-slate-500 font-mono-nums mt-0.5 flex items-center gap-1">
          <span>Fund ID:</span>
          <span className="font-bold text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px] border border-slate-200/60">
            {currentFund.displayId || '----'}
          </span>
        </div>
      </div>

      {/* GLOBAL CHITTI KPIS - MOVED ABOVE CYCLE CONTEXT */}
      <div className="grid grid-cols-3 gap-2 px-0.5">
        <div className="bg-white border border-slate-200 rounded-2xl px-2 py-3.5 text-center shadow-xs">
          <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest block font-sans mb-1.5">Members / Cycle</span>
          <span className="text-[19px] font-black text-slate-900 block leading-none font-mono-nums">
            {fundShares.length}{currentFund.totalCycles ? ` / ${currentFund.totalCycles}` : ''}
          </span>
        </div>

        <div className="bg-rose-50 border border-rose-200 rounded-2xl px-2 py-3.5 text-center shadow-xs">
          <span className="text-[11px] font-black text-rose-500 uppercase tracking-widest block font-sans mb-1.5">Arrears</span>
          <span className="text-[19px] font-black text-rose-600 block leading-none font-mono-nums">
            {FinancialEngine.formatCurrency(totalArrears)}
          </span>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-2 py-3.5 text-center shadow-xs">
          <span className="text-[11px] font-black text-emerald-600 uppercase tracking-widest block font-sans mb-1.5">Advances</span>
          <span className="text-[19px] font-black text-emerald-700 block leading-none font-mono-nums">
            {FinancialEngine.formatCurrency(totalAdvances)}
          </span>
        </div>
      </div>

      {/* COMPACT CYCLES NAVIGATION SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 font-sans flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" />
            <span>Cycle Context {fundCycles.length > 0 ? `(${currentViewedIndex + 1} of ${fundCycles.length})` : '0/0'}</span>
          </h2>
        </div>

        {fundCycles.length === 0 ? (
          <div className="bg-white border border-dashed border-slate-300 rounded-[24px] p-10 text-center flex flex-col items-center justify-center space-y-4 shadow-sm animate-in fade-in duration-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
              <Calendar className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-600 font-sans">No financial cycles recorded</p>
              <p className="text-[10px] text-slate-400 font-sans max-w-[200px] mx-auto">Initialize your first billing cycle to start tracking member distributions.</p>
            </div>
            <button
              onClick={onOpenCreateCycleModal}
              disabled={!isOnline}
              title={!isOnline ? "Initializing a cycle requires internet connection" : "Initialize Cycle #1"}
              className={`py-3 px-6 rounded-xl font-black text-xs shadow-md transition min-h-[44px] ${
                isOnline 
                  ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer' 
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
              }`}
            >
              {isOnline ? '+ Initialize Cycle #1' : 'Cycle Init (Offline)'}
            </button>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            {currentViewedCycle && (
              <CycleCard
                cycle={currentViewedCycle}
                onEdit={onOpenEditCycleModal}
                onDelete={(c) => {
                  if (window.confirm(`Are you sure you want to delete Cycle #${c.cycleNumber}? This action is permanent.`)) {
                    deleteCurrentCycle(c.fundId, c.cycleId);
                  }
                }}
                onAddNew={onOpenCreateCycleModal}
                onPrev={handlePrevCycle}
                onNext={handleNextCycle}
                isFirst={currentViewedIndex === 0}
                isLast={currentViewedIndex === fundCycles.length - 1}
              />
            )}
          </div>
        )}
      </div>

      {/* MEMBERS SECTION */}
      <div className="space-y-3.5">
        
        {/* Compact Search Bar with Refresh Icon */}
        <div className="flex items-center gap-2 font-sans">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by member name, share ID, or phone"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-[12px] font-bold focus:outline-none focus:border-sky-500 transition shadow-xs placeholder-slate-400 h-[42px]"
            />
          </div>
          <button 
            onClick={() => {
              setSearchQuery('');
              setRefreshTrigger(prev => prev + 1);
            }}
            className="w-[42px] h-[42px] shrink-0 flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-sky-600 transition shadow-xs cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Seamless Compact Filter Tabs - GRID LAYOUT TO FIT DISPLAY WITHOUT SCROLLING */}
        <div className="grid grid-cols-4 gap-1.5 py-1 font-sans w-full">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-1 py-2 text-[11px] font-black rounded-xl transition-all cursor-pointer border text-center truncate ${
              statusFilter === 'all'
                ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            All ({fundShares.length})
          </button>

          <button
            onClick={() => setStatusFilter('undrawn')}
            className={`px-1 py-2 text-[11px] font-black rounded-xl transition-all cursor-pointer border text-center truncate ${
              statusFilter === 'undrawn'
                ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            Undrawn ({undrawnCount})
          </button>

          <button
            onClick={() => setStatusFilter('drawn')}
            className={`px-1 py-2 text-[11px] font-black rounded-xl transition-all cursor-pointer border text-center truncate ${
              statusFilter === 'drawn'
                ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            Drawn ({drawnCount})
          </button>

          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-1 py-2 text-[11px] font-black rounded-xl transition-all cursor-pointer border text-center truncate ${
              statusFilter === 'pending'
                ? 'bg-rose-600 border-rose-600 text-white shadow-sm'
                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            Pending ({pendingArrearsCount})
          </button>
        </div>

        {/* Member Cards Stack */}
        <div className="space-y-2.5">
          {fundShares.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center space-y-2.5">
              <span className="text-xs font-bold text-emerald-800 uppercase block tracking-wider">
                No Members Allotted Yet
              </span>
              <p className="text-xs text-emerald-700 max-w-sm mx-auto leading-relaxed font-sans">
                Add your first member to start operating this Fund and managing cycle billing allotments!
              </p>
              <button
                onClick={() => setIsAddMemberOpen(true)}
                disabled={!isOnline}
                title={!isOnline ? "Adding members requires internet connection" : "Add Your First Member"}
                className={`mx-auto px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 min-h-[40px] ${
                  isOnline 
                    ? 'bg-slate-900 hover:bg-slate-800 text-white cursor-pointer' 
                    : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                }`}
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isOnline ? '+ Add Your First Member' : 'Offline'}</span>
              </button>
            </div>
          ) : filteredShares.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
              No members found matching the selected filter.
            </div>
          ) : (
            filteredShares.map((share) => (
              <MemberCard
                key={share.shareId}
                share={share}
                fund={currentFund!}
                currentCycle={currentCycle}
                isOnline={isOnline}
                onEdit={onOpenEditMemberModal}
                onStatement={(s) => setStatementShare(s)}
                onWhatsApp={(s) => onOpenWhatsAppReminderModal(s, 'single')}
                onDrawCorrection={onOpenDrawCorrectionModal}
                onReminder={(s) => onOpenWhatsAppReminderModal(s, 'single')}
                onRecordPayment={(s) => onOpenPaymentModal(s.shareId)}
                onRecordPayout={(s) => onOpenPaymentModal(s.shareId)} // Use same modal for payout record flow
                onEditBills={onOpenShareEditBillsModal}
              />
            ))
          )}
        </div>

        {/* Dual Actions: Send Reminder to All & Send Statement to All */}
        <div className="pt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => onOpenWhatsAppReminderModal(undefined, 'all-pending')}
            disabled={!isOnline}
            title={!isOnline ? "Reminders require internet connection" : "Send Reminder to All"}
            className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs min-h-[44px] ${
              isOnline 
                ? 'bg-[#16a34a] hover:bg-[#15803d] text-white' 
                : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{isOnline ? `Send Reminder to All (${pendingArrearsCount})` : 'Reminders Disabled (Offline)'}</span>
          </button>

          <button
            onClick={() => setIsBulkStatementOpen(true)}
            disabled={!isOnline}
            title={!isOnline ? "Bulk statements require internet connection" : "Send Statement to All"}
            className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs min-h-[44px] ${
              isOnline 
                ? 'bg-sky-600 hover:bg-sky-500 text-white' 
                : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isOnline ? `Send Statement to All (${filteredShares.length})` : 'Bulk Statements Disabled (Offline)'}</span>
          </button>
        </div>

        {/* Add Member / Share button */}
        <div className="pt-1.5">
          <button
            onClick={() => setIsAddMemberOpen(true)}
            disabled={!isOnline}
            title={!isOnline ? "Adding members requires internet connection" : "Add Member / Share Allotment"}
            className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs min-h-[44px] ${
              isOnline 
                ? 'bg-slate-900 hover:bg-slate-800 text-white' 
                : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
            }`}
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>{isOnline ? '+ Add Member / Share Allotment' : 'Add Member (Offline Required)'}</span>
          </button>
        </div>
      </div>

      {/* SCHEME CONTROLS SECTION */}
      <div className="pt-6 border-t border-slate-200 space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 font-mono-nums">
          SCHEME LIFECYCLE & SECURITY
        </h2>
        
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 font-sans">
          <div className="flex items-center gap-2 text-slate-700">
            <Calendar className="w-4 h-4 text-sky-600" />
            <span className="text-xs font-bold uppercase tracking-wider">Total Planned Cycles:</span>
            <span className="text-sm font-black text-slate-900 font-mono-nums px-2.5 py-1 bg-slate-100 rounded-lg">
              {currentFund.totalCycles || 'Not Set'}
            </span>
          </div>
          
          <button
            onClick={() => {
              setInputTotalCycles(currentFund.totalCycles || '');
              setIsTotalCyclesModalOpen(true);
            }}
            disabled={!isOnline}
            title={!isOnline ? "Editing planned cycles requires internet connection" : "Edit planned cycles"}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs h-10 ${
              isOnline 
                ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer' 
                : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-sky-100" />
            <span>{isOnline ? 'Edit' : 'Offline'}</span>
          </button>
        </div>

        {/* Chitti Identity & Frequency Edit Option */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 font-sans">
          <div className="flex items-center gap-2 text-slate-700 min-w-0">
            <Edit3 className="w-4 h-4 text-sky-600 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Fund Identity &amp; Frequency</span>
              <span className="text-xs font-black text-slate-900 truncate block">
                {currentFund.fundName} · <span className="capitalize">{currentFund.cycleFrequency || 'monthly'}</span>
              </span>
            </div>
          </div>
          
          <button
            onClick={onOpenEditChittiNameModal}
            disabled={!isOnline}
            title={!isOnline ? "Editing fund identity requires internet connection" : "Edit fund identity"}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs h-10 shrink-0 ${
              isOnline 
                ? 'bg-sky-600 hover:bg-sky-500 text-white cursor-pointer' 
                : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-sky-100" />
            <span>{isOnline ? 'Edit' : 'Offline'}</span>
          </button>
        </div>

        {/* Delete Share Option (Danger Zone) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4 font-sans">
          <div className="flex items-center gap-2 text-slate-700 min-w-0">
            <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Danger Zone Ops</span>
              <span className="text-xs font-black text-slate-900 truncate block">
                Delete Member Share Allotment
              </span>
            </div>
          </div>
          
          <button
            onClick={onOpenDeleteShareModal}
            disabled={!isOnline}
            title={!isOnline ? "Deleting share requires internet connection" : "Delete share"}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs h-10 shrink-0 ${
              isOnline 
                ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer' 
                : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-100" />
            <span>{isOnline ? 'Delete Share' : 'Offline'}</span>
          </button>
        </div>

        {/* Manager Profile Section */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3 font-sans">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">System Administration</span>
                <h3 className="text-xs font-bold text-slate-900">Manager Profile</h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              disabled={!isOnline}
              title={!isOnline ? "Editing profile requires internet connection" : "Edit profile"}
              className={`px-3.5 py-1.5 border rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-2xs ${
                isOnline 
                  ? 'bg-sky-50 hover:bg-sky-100 border-sky-200 text-sky-800 cursor-pointer' 
                  : 'bg-slate-700 border-slate-600 text-slate-400 cursor-not-allowed opacity-50'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 text-sky-600" />
              <span>{isOnline ? (hasProfile ? 'Edit Profile' : 'Add Profile') : 'Offline'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono-nums">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 uppercase block tracking-wider font-sans font-semibold">Manager Name</span>
              <span className="font-bold text-slate-800 font-sans text-xs truncate block mt-0.5">
                {tenant?.name ? tenant.name : (
                  <span className="text-amber-600 font-normal italic font-sans">Not set</span>
                )}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 uppercase block tracking-wider font-sans font-semibold">Manager Phone</span>
              <span className="font-bold text-slate-800 text-xs truncate block mt-0.5">
                {tenant?.phone && tenant.phone.trim() !== '' ? (
                  formatPhoneDisplay(tenant.phone)
                ) : (
                  <span className="text-amber-600 font-normal italic font-sans">Not set</span>
                )}
              </span>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
              <span className="text-[9px] text-slate-400 uppercase block tracking-wider font-sans font-semibold">Manager Email</span>
              <span className="font-medium text-slate-600 text-xs truncate block mt-0.5 lowercase font-mono">
                {tenant?.email || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={handleSignOut}
          className="w-full py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs sm:text-sm transition cursor-pointer shadow-sm"
        >
          Sign Out of Manager Session
        </button>
      </div>

      {/* Manager Profile Modal */}
      <ManagerProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />

      {/* Modals */}
      {currentFund && (
        <SendReportModal
          isOpen={isSendReportOpen}
          onClose={() => setIsSendReportOpen(false)}
          fund={currentFund}
          shares={fundShares}
          cycles={fundCycles}
        />
      )}

      {currentFund && (
        <AddMemberModal
          isOpen={isAddMemberOpen}
          onClose={() => setIsAddMemberOpen(false)}
          fund={currentFund}
        />
      )}

      {/* Simple Total Cycles Modal Pop-up */}
      {isTotalCyclesModalOpen && currentFund && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-150 overflow-hidden flex flex-col p-5 space-y-4 animate-in zoom-in-95 duration-200 font-sans">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                Update Planned Cycles
              </h3>
              <button
                onClick={() => setIsTotalCyclesModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-0.5">
                Total Planned Cycles
              </label>
              <input
                type="number"
                min="1"
                value={inputTotalCycles}
                onChange={(e) => setInputTotalCycles(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 20"
                className="w-full px-3 py-2 text-sm font-bold border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums transition-all"
              />
              <p className="text-[10px] text-slate-400 leading-normal ml-0.5">
                Fund ID: <span className="font-mono-nums font-semibold text-slate-600">{currentFund.displayId || '----'}</span> · Isolated
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsTotalCyclesModalOpen(false)}
                className="py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition cursor-pointer min-h-[38px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const val = inputTotalCycles === '' ? null : Number(inputTotalCycles);
                  await updateFundMetadata(currentFund.fundId, { totalCycles: val });
                  setIsTotalCyclesModalOpen(false);
                  showAcknowledgement({
                    isSuccess: true,
                    title: 'Planned Cycles Updated',
                    message: `Successfully set total planned cycles to ${val || 'unlimited'} for this isolated scheme.`,
                    operationType: 'UPDATE SCHEME METADATA',
                    referenceId: `REF-${Date.now().toString().slice(-6)}`,
                    ackTime: new Date().toLocaleTimeString(),
                  });
                }}
                className="py-2 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 transition cursor-pointer flex items-center justify-center gap-1.5 shadow-xs min-h-[38px]"
              >
                <span>Save Changes</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Operational Modal: Quick Record Payment Shortcut */}
      <QuickRecordPaymentModal
        isOpen={isQuickPaymentOpen}
        onClose={() => setIsQuickPaymentOpen(false)}
      />

      {/* Share Account Statement Modal (Section 7 & 8) */}
      {statementShare && currentFund && (
        <ShareStatementModal
          isOpen={Boolean(statementShare)}
          onClose={() => setStatementShare(null)}
          share={statementShare}
          fund={currentFund}
          cycles={cycles}
          billings={billings}
          payments={payments}
        />
      )}

      {/* Bulk Statement Dispatch Modal (Section 10 & 23) */}
      {isBulkStatementOpen && currentFund && (
        <BulkStatementModal
          isOpen={isBulkStatementOpen}
          onClose={() => setIsBulkStatementOpen(false)}
          fund={currentFund}
          shares={shares}
          cycles={cycles}
          billings={billings}
          payments={payments}
        />
      )}

      {/* Centralized Communication Webhook Configuration & n8n Test Payloads (Section 13, 15, 53) */}
      <CommunicationWebhookModal
        isOpen={isWebhookModalOpen}
        onClose={() => setIsWebhookModalOpen(false)}
      />

    </div>
  );
};
