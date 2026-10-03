import React, { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChitFundProvider, useChitFund } from './context/ChitFundContext';
import { TopBar } from './components/TopBar';
import { ManagerHeader } from './components/ManagerHeader';
import { OfflineIndicator } from './components/OfflineIndicator';
import { notificationService } from './services/notifications';

// Operational Modals
import { NewChittiModal } from './components/modals/NewChittiModal';
import { CycleBillingModal } from './components/modals/CycleBillingModal';
import { PaymentRecordModal } from './components/modals/PaymentRecordModal';
import { DrawAssignmentBillingModal } from './components/modals/DrawAssignmentBillingModal';
import { EditMemberModal } from './components/modals/EditMemberModal';
import { WhatsAppReminderModal } from './components/modals/WhatsAppReminderModal';
import { DeleteChittiModal } from './components/modals/DeleteChittiModal';
import { ShareEditBillsModal } from './components/modals/ShareEditBillsModal';
import { EditCycleModal } from './components/modals/EditCycleModal';
import { CreateCycleModal } from './components/modals/CreateCycleModal';
import { EditChittiNameModal } from './components/modals/EditChittiNameModal';
import { DeleteShareModal } from './components/modals/DeleteShareModal';

// Views
import { LandingView } from './views/LandingView';
import { DashboardView } from './views/DashboardView';
import { FundsDirectoryView } from './views/FundsDirectoryView';
import { NewFundWizardView } from './views/NewFundWizardView';
import { TreasuryView } from './views/TreasuryView';
import { CrmView } from './views/CrmView';
import { AuditView } from './views/AuditView';
import { MemberPortalView } from './views/MemberPortalView';

import { Share, Fund, Cycle } from './types';

// Helper to parse route from URL hash or pathname
const parseRouteFromLocation = (): { route: string; fundId?: string; subTab?: string } => {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const path = hash || window.location.pathname.replace(/^\//, '');

  if (!path || path === 'dashboard') {
    return { route: 'dashboard' };
  }

  if (path.startsWith('funds/') || path.startsWith('fund_')) {
    const cleanPath = path.startsWith('fund_') ? path.replace('fund_', 'funds/') : path;
    const parts = cleanPath.split('/');
    // e.g. funds/chit_001/ledger
    const fundId = parts[1];
    const subTab = parts[2];
    if (fundId && fundId !== 'new') {
      return { route: 'fund_workspace', fundId, subTab };
    }
  }

  return { route: path };
};

const MainAppContent: React.FC = () => {
  const { tenant, loading: authLoading, authState } = useAuth();
  const { funds, shares, cycles, billings, payments, payouts, activeFund, setActiveFundId, acknowledgementState, closeAcknowledgement } = useChitFund();

  // Navigation route tab state
  const [currentTab, setCurrentTab] = useState<string>('landing');
  const [activeSubTab, setActiveSubTab] = useState<string>('members');

  // Modal open states
  const [isNewFundModalOpen, setIsNewFundModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [initialPaymentShareId, setInitialPaymentShareId] = useState<string | undefined>(undefined);
  const [isCycleBillingModalOpen, setIsCycleBillingModalOpen] = useState(false);
  const [isDrawAssignmentModalOpen, setIsDrawAssignmentModalOpen] = useState(false);
  const [targetShareForDraw, setTargetShareForDraw] = useState<Share | null>(null);
  const [isEditMemberModalOpen, setIsEditMemberModalOpen] = useState(false);
  const [targetShareForEdit, setTargetShareForEdit] = useState<Share | null>(null);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [whatsAppShare, setWhatsAppShare] = useState<Share | null>(null);
  const [whatsAppMode, setWhatsAppMode] = useState<'single' | 'all-pending'>('single');
  const [isDeleteChittiModalOpen, setIsDeleteChittiModalOpen] = useState(false);
  const [targetFundForDelete, setTargetFundForDelete] = useState<Fund | null>(null);

  // New Cycle & Bills Modals
  const [isShareEditBillsModalOpen, setIsShareEditBillsModalOpen] = useState(false);
  const [targetShareForBills, setTargetShareForBills] = useState<Share | null>(null);
  const [isEditCycleModalOpen, setIsEditCycleModalOpen] = useState(false);
  const [targetCycleForEdit, setTargetCycleForEdit] = useState<Cycle | null>(null);
  const [isCreateCycleModalOpen, setIsCreateCycleModalOpen] = useState(false);
  const [isEditChittiNameModalOpen, setIsEditChittiNameModalOpen] = useState(false);
  const [isDeleteShareModalOpen, setIsDeleteShareModalOpen] = useState(false);

  // Authoritative URL Navigation Synchronizer
  const handleNavigate = useCallback(
    (target: string) => {
      let route = target;
      let fundId: string | undefined;
      let subTab: string | undefined;

      if (target === 'dashboard') {
        window.location.hash = '#/dashboard';
        setCurrentTab('dashboard');
        return;
      }

      if (target.startsWith('funds/') || target.startsWith('/funds/')) {
        const parts = target.replace(/^\/?funds\//, '').split('/');
        fundId = parts[0];
        subTab = parts[1];
        if (fundId === 'new') {
          route = 'funds/new';
          window.location.hash = '#/funds/new';
        } else {
          route = 'fund_workspace';
          if (fundId) {
            setActiveFundId(fundId);
            window.location.hash = `#/funds/${fundId}${subTab ? '/' + subTab : ''}`;
          }
        }
      } else if (target.startsWith('fund_')) {
        const clean = target.replace('fund_', '');
        if (clean.startsWith('ledger_')) {
          fundId = clean.replace('ledger_', '');
          subTab = 'ledger';
        } else if (clean.startsWith('cycles_')) {
          fundId = clean.replace('cycles_', '');
          subTab = 'cycles';
        } else {
          fundId = clean;
          subTab = 'members';
        }
        route = 'fund_workspace';
        if (fundId) {
          setActiveFundId(fundId);
          window.location.hash = `#/funds/${fundId}${subTab ? '/' + subTab : ''}`;
        }
      } else {
        window.location.hash = `#/${target}`;
      }

      setCurrentTab(route);
      if (subTab) setActiveSubTab(subTab);
    },
    [setActiveFundId]
  );

  // Initialize Route from URL on Mount or Tenant Login
  useEffect(() => {
    const syncRouteFromURL = () => {
      const { route, fundId, subTab } = parseRouteFromLocation();
      if (tenant && authState === 'AUTHORIZED') {
        if (route === 'landing' || !route) {
          setCurrentTab('dashboard');
        } else {
          setCurrentTab(route);
        }
        if (fundId) {
          setActiveFundId(fundId);
        }
        if (subTab) {
          setActiveSubTab(subTab === 'auction' ? 'cycles' : subTab);
        } else if (route === 'fund_workspace') {
          setActiveSubTab('members');
        }
      } else {
        if (route.startsWith('portal_')) {
          setCurrentTab(route);
        } else {
          setCurrentTab('landing');
        }
      }
    };

    syncRouteFromURL();
    window.addEventListener('hashchange', syncRouteFromURL);
    window.addEventListener('popstate', syncRouteFromURL);
    return () => {
      window.removeEventListener('hashchange', syncRouteFromURL);
      window.removeEventListener('popstate', syncRouteFromURL);
    };
  }, [tenant, authState, setActiveFundId]);

  // Request browser push notification permission gracefully on startup
  useEffect(() => {
    notificationService.requestPermission();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-mono-nums text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></div>
          <span>Loading Operations Environment...</span>
        </div>
      </div>
    );
  }

  // Active Fund Context
  const currentFund = activeFund;
  const currentFundCycles = currentFund ? cycles.filter(c => c.fundId === currentFund.fundId) : [];
  const currentFundShares = currentFund ? shares.filter(s => s.fundId === currentFund.fundId) : [];
  const currentCycle = currentFundCycles.find(c => c.cycleNumber === currentFund?.currentMonth) || currentFundCycles[0];

  const handleOpenPayment = (shareId?: string) => {
    setInitialPaymentShareId(shareId);
    setIsPaymentModalOpen(true);
  };

  const handleOpenDrawCorrection = (share: Share) => {
    setTargetShareForDraw(share);
    setIsDrawAssignmentModalOpen(true);
  };

  const handleOpenEditMember = (share: Share) => {
    setTargetShareForEdit(share);
    setIsEditMemberModalOpen(true);
  };

  const handleOpenWhatsAppReminder = (share?: Share, mode: 'single' | 'all-pending' = 'single') => {
    setWhatsAppShare(share || null);
    setWhatsAppMode(mode);
    setIsWhatsAppModalOpen(true);
  };

  const handleOpenDeleteChitti = (fund: Fund) => {
    setTargetFundForDelete(fund);
    setIsDeleteChittiModalOpen(true);
  };

  const handleOpenShareEditBills = (share: Share) => {
    setTargetShareForBills(share);
    setIsShareEditBillsModalOpen(true);
  };

  const handleOpenEditCycle = (cycle: Cycle) => {
    setTargetCycleForEdit(cycle);
    setIsCreateCycleModalOpen(true);
  };

  const handleOpenCreateCycle = () => {
    setTargetCycleForEdit(null);
    setIsCreateCycleModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col antialiased overflow-x-hidden">
      
      {/* Top Bar Navigation Contract - Visible for authenticated managers */}
      {tenant && authState === 'AUTHORIZED' && !currentTab.startsWith('portal_') && (
        <TopBar
          currentTab={currentTab}
          onNavigate={handleNavigate}
          onOpenNewFundModal={() => setIsNewFundModalOpen(true)}
        />
      )}

      {/* Persistent Manager Dashboard Header (Section 2) */}
      {tenant && authState === 'AUTHORIZED' && !currentTab.startsWith('portal_') && (currentTab === 'fund_workspace' || currentTab.startsWith('funds/')) && (
        <ManagerHeader
          currentTab={currentTab}
          onNavigate={handleNavigate}
          onOpenNewFundModal={() => setIsNewFundModalOpen(true)}
          activeSubTab={activeSubTab}
          onSubTabNavigate={(sub) => {
            if (activeFund) {
              handleNavigate(`funds/${activeFund.fundId}/${sub}`);
            }
          }}
          fundSharesCount={currentFundShares.length}
          nextCycleNum={(currentFundCycles.length > 0 ? Math.max(...currentFundCycles.map((c) => c.cycleNumber)) : 0) + 1}
        />
      )}

      {/* Offline Connectivity Notification */}
      <OfflineIndicator />

      {/* Main View Router */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 w-full">
        {currentTab === 'landing' && (
          <LandingView onEnterApp={() => handleNavigate('dashboard')} />
        )}

        {currentTab === 'dashboard' && (
          <DashboardView
            onNavigate={handleNavigate}
            onOpenNewFundModal={() => setIsNewFundModalOpen(true)}
            onOpenPaymentModal={handleOpenPayment}
            onOpenDrawCorrectionModal={handleOpenDrawCorrection}
            onOpenEditMemberModal={handleOpenEditMember}
            onOpenWhatsAppReminderModal={handleOpenWhatsAppReminder}
            onOpenDeleteChittiModal={handleOpenDeleteChitti}
            onOpenShareEditBillsModal={handleOpenShareEditBills}
            onOpenEditCycleModal={handleOpenEditCycle}
            onOpenCreateCycleModal={handleOpenCreateCycle}
            onOpenEditChittiNameModal={() => setIsEditChittiNameModalOpen(true)}
            onOpenDeleteShareModal={() => setIsDeleteShareModalOpen(true)}
            initialSubTab={activeSubTab}
            isPortfolioOverview={true}
          />
        )}

        {currentTab === 'fund_workspace' && (
          <DashboardView
            onNavigate={handleNavigate}
            onOpenNewFundModal={() => setIsNewFundModalOpen(true)}
            onOpenPaymentModal={handleOpenPayment}
            onOpenDrawCorrectionModal={handleOpenDrawCorrection}
            onOpenEditMemberModal={handleOpenEditMember}
            onOpenWhatsAppReminderModal={handleOpenWhatsAppReminder}
            onOpenDeleteChittiModal={handleOpenDeleteChitti}
            onOpenShareEditBillsModal={handleOpenShareEditBills}
            onOpenEditCycleModal={handleOpenEditCycle}
            onOpenCreateCycleModal={handleOpenCreateCycle}
            onOpenEditChittiNameModal={() => setIsEditChittiNameModalOpen(true)}
            onOpenDeleteShareModal={() => setIsDeleteShareModalOpen(true)}
            initialSubTab={activeSubTab}
            isPortfolioOverview={false}
          />
        )}

        {currentTab === 'funds' && (
          <FundsDirectoryView
            onNavigate={handleNavigate}
            onOpenNewFundModal={() => setIsNewFundModalOpen(true)}
          />
        )}

        {currentTab === 'funds/new' && (
          <NewFundWizardView onNavigate={handleNavigate} />
        )}

        {currentTab === 'treasury' && (
          <TreasuryView onOpenPaymentModal={() => handleOpenPayment()} />
        )}

        {currentTab === 'crm' && (
          <CrmView />
        )}

        {currentTab === 'audits' && (
          <AuditView />
        )}

        {currentTab.startsWith('portal_') && (
          <MemberPortalView
            token={currentTab.replace('portal_', '')}
            onBackToApp={() => handleNavigate(tenant && authState === 'AUTHORIZED' ? 'dashboard' : 'landing')}
          />
        )}
      </main>

      {/* Small font Powered by ClearFlow Automations at bottom of every page */}
      <footer className="py-6 text-center text-[10px] text-slate-400 font-sans tracking-wide shrink-0 select-none">
        Powered by ClearFlow Automations
      </footer>

      {/* Operational Modal 1: New Chitti Creation */}
      <NewChittiModal
        isOpen={isNewFundModalOpen}
        onClose={() => setIsNewFundModalOpen(false)}
        onSuccess={(newId) => {
          setActiveFundId(newId);
          handleNavigate(`funds/${newId}`);
        }}
      />

      {/* Operational Modal 2: Cycle Billing Input + Advance */}
      {currentFund && currentCycle && (
        <CycleBillingModal
          isOpen={isCycleBillingModalOpen}
          onClose={() => setIsCycleBillingModalOpen(false)}
          fund={currentFund}
          cycle={currentCycle}
          shares={currentFundShares}
        />
      )}

      {/* Operational Modal 3: Payment Record / Correction (Section 8) */}
      {currentFund && (
        <PaymentRecordModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          fund={currentFund}
          shares={currentFundShares}
          initialShareId={initialPaymentShareId}
        />
      )}

      {/* Operational Modal 4: Authoritative Draw Assignment & Billing */}
      {currentFund && targetShareForDraw && (
        <DrawAssignmentBillingModal
          isOpen={isDrawAssignmentModalOpen}
          onClose={() => {
            setIsDrawAssignmentModalOpen(false);
            setTargetShareForDraw(null);
          }}
          fund={currentFund}
          share={targetShareForDraw}
          cycles={currentFundCycles}
          payments={payments.filter(p => p.shareId === targetShareForDraw.shareId)}
          payouts={payouts.filter(p => p.shareId === targetShareForDraw.shareId)}
        />
      )}

      {/* Operational Modal 6: Edit Member Info (Section 10) */}
      {currentFund && (
        <EditMemberModal
          isOpen={isEditMemberModalOpen}
          onClose={() => setIsEditMemberModalOpen(false)}
          fund={currentFund}
          share={targetShareForEdit}
        />
      )}

      {/* Operational Modal 7: WhatsApp Reminder / Broadcast (Section 18) */}
      {currentFund && (
        <WhatsAppReminderModal
          isOpen={isWhatsAppModalOpen}
          onClose={() => setIsWhatsAppModalOpen(false)}
          fund={currentFund}
          share={whatsAppShare}
          targetCycle={currentCycle}
          mode={whatsAppMode}
        />
      )}

      {/* Operational Modal 8: Delete Chitti (Danger Zone - Section 13) */}
      {targetFundForDelete && (
        <DeleteChittiModal
          isOpen={isDeleteChittiModalOpen}
          onClose={() => setIsDeleteChittiModalOpen(false)}
          fund={targetFundForDelete}
          onDeleted={() => {
            handleNavigate('dashboard');
          }}
        />
      )}

      {/* Operational Modal 9: Share Multi-Cycle Billing */}
      {currentFund && targetShareForBills && (
        <ShareEditBillsModal
          isOpen={isShareEditBillsModalOpen}
          onClose={() => setIsShareEditBillsModalOpen(false)}
          fund={currentFund}
          share={targetShareForBills}
          cycles={currentFundCycles}
          payments={[]} // context handles this usually or it's not strictly needed for the form
        />
      )}

      {/* Operational Modal 10: Edit Cycle */}
      {currentFund && targetCycleForEdit && (
        <EditCycleModal
          isOpen={isEditCycleModalOpen}
          onClose={() => setIsEditCycleModalOpen(false)}
          fundId={currentFund.fundId}
          cycle={targetCycleForEdit}
        />
      )}

      {/* Operational Modal 11: Create / Edit Cycle Billing */}
      {currentFund && (
        <CreateCycleModal
          isOpen={isCreateCycleModalOpen}
          onClose={() => {
            setIsCreateCycleModalOpen(false);
            setTargetCycleForEdit(null);
          }}
          fund={currentFund}
          cycles={currentFundCycles}
          initialSelectedCycleId={targetCycleForEdit?.cycleId}
          mode={targetCycleForEdit ? 'edit' : 'create'}
        />
      )}

      {/* Operational Modal 12: Edit Chitti Name & Frequency */}
      {currentFund && (
        <EditChittiNameModal
          isOpen={isEditChittiNameModalOpen}
          onClose={() => setIsEditChittiNameModalOpen(false)}
          fund={currentFund}
        />
      )}

      {/* Operational Modal 13: Delete Share Allotment */}
      {currentFund && (
        <DeleteShareModal
          isOpen={isDeleteShareModalOpen}
          onClose={() => setIsDeleteShareModalOpen(false)}
          fund={currentFund}
          shares={currentFundShares}
        />
      )}

      {/* GLOBAL PERSISTENT ACKNOWLEDGEMENT CONFIRMATION DIALOG */}
      {acknowledgementState && acknowledgementState.isOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 my-auto">
            
            {/* Visual Icon Header */}
            <div className="flex justify-center">
              {acknowledgementState.isSuccess ? (
                <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              )}
            </div>

            {/* Title and Message */}
            <div className="space-y-1.5">
              <h3 className={`text-base font-bold uppercase tracking-wide ${acknowledgementState.isSuccess ? 'text-slate-900' : 'text-rose-700'}`}>
                {acknowledgementState.title}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {acknowledgementState.message}
              </p>
            </div>

            {/* Optional Metadata Details Card */}
            {(acknowledgementState.operationType || acknowledgementState.referenceId || acknowledgementState.ackTime) && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left space-y-1.5 font-mono-nums text-[11px] text-slate-500">
                {acknowledgementState.operationType && (
                  <div className="flex justify-between">
                    <span>Operation:</span>
                    <span className="font-bold text-slate-700 font-sans uppercase">{acknowledgementState.operationType}</span>
                  </div>
                )}
                {acknowledgementState.referenceId && (
                  <div className="flex justify-between">
                    <span>Reference ID:</span>
                    <span className="font-bold text-slate-700">{acknowledgementState.referenceId}</span>
                  </div>
                )}
                {acknowledgementState.ackTime && (
                  <div className="flex justify-between">
                    <span>Ack Time:</span>
                    <span className="font-bold text-slate-700">{acknowledgementState.ackTime}</span>
                  </div>
                )}
              </div>
            )}

            {/* Unified 44px touch-target OK dismissal button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  closeAcknowledgement();
                }}
                className={`w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm text-white shadow-xs transition cursor-pointer min-h-[44px] flex items-center justify-center ${
                  acknowledgementState.isSuccess
                    ? 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700'
                }`}
              >
                OK, I Acknowledge
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ChitFundProvider>
        <MainAppContent />
      </ChitFundProvider>
    </AuthProvider>
  );
}
