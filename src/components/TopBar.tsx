import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChitFund } from '../context/ChitFundContext';
import { PWAInstallButton } from './PWAInstallButton';
import { notificationService, AppNotification } from '../services/notifications';
import { 
  Building2, 
  Bell, 
  Plus, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  User, 
  Layers
} from 'lucide-react';

interface TopBarProps {
  currentTab: string;
  onNavigate: (tab: string) => void;
  onOpenNewFundModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ currentTab, onNavigate, onOpenNewFundModal }) => {
  const { tenant, signOut, hasPendingSyncs } = useAuth();
  const { activeFund } = useChitFund();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    const unsub = notificationService.subscribe((list) => {
      setNotifications(list);
    });
    return () => unsub();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications && unreadCount > 0) {
      notificationService.markAllAsRead();
    }
  };

  const handleSignOut = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    
    try {
      const pendingCount = await hasPendingSyncs();
      if (pendingCount > 0) {
        const confirmLogout = window.confirm(
          `Warning: You have ${pendingCount} unsynchronized offline changes. \n\nLogging out will preserve these changes, but they will not be replayed until you sign in again. \n\nContinue with logout?`
        );
        if (!confirmLogout) {
          setIsLoggingOut(false);
          return;
        }
      }
      
      const success = await signOut();
      if (success) {
        onNavigate('landing');
      }
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="z-40 w-full bg-[#0f172a] text-white border-b border-slate-800 shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Link - Prominent button style for easy touch and high-contrast clicks on mobile/desktop */}
        <div className="flex items-center gap-4 sm:gap-8">
          <button 
            onClick={() => onNavigate('dashboard')} 
            className="flex items-center gap-2.5 px-3 py-1.5 sm:px-4.5 sm:py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-900 border-2 border-slate-600 hover:border-slate-500 transition text-left cursor-pointer min-h-[46px] shadow-sm shrink-0"
          >
            <Building2 className="w-5 h-5 text-sky-400 shrink-0 self-center" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] sm:text-xs font-black tracking-tight text-white leading-tight">Manager Dashboard</span>
              <span className="text-[8px] sm:text-[9px] font-sans text-slate-300 leading-none mt-0.5 truncate max-w-[100px] sm:max-w-[150px]">
                {tenant?.name || 'Operations Manager'}
              </span>
            </div>
          </button>
          
          {tenant && (
            <nav className="hidden md:flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border-2 border-slate-800 animate-in fade-in">
              <button
                onClick={() => onNavigate('dashboard')}
                className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer min-h-[36px] ${
                  currentTab === 'dashboard' ? 'bg-sky-600 text-white shadow-md border border-sky-500' : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                Portfolio
              </button>
              <button
                onClick={() => onNavigate('contacts')}
                className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer min-h-[36px] ${
                  currentTab === 'contacts' ? 'bg-sky-600 text-white shadow-md border border-sky-500' : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                Contacts
              </button>
              <button
                onClick={() => onNavigate('treasury')}
                className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer min-h-[36px] ${
                  currentTab === 'treasury' ? 'bg-sky-600 text-white shadow-md border border-sky-500' : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                Treasury
              </button>
              <button
                onClick={() => onNavigate('audits')}
                className={`px-3.5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer min-h-[36px] ${
                  currentTab === 'audits' ? 'bg-sky-600 text-white shadow-md border border-sky-500' : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                Audits
              </button>
            </nav>
          )}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          <PWAInstallButton />

          {tenant ? (
            <>
              {/* Notification Alerts Bell - Placed first (left) */}
              <div className="relative">
                <button
                  onClick={handleNotificationClick}
                  className="p-2.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 active:bg-slate-900 rounded-xl transition cursor-pointer relative min-h-[44px] min-w-[44px] flex items-center justify-center border-2 border-slate-600 shadow-sm"
                  title="Notifications & Alerts"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-sky-500 rounded-full ring-2 ring-[#0f172a]"></span>
                  )}
                </button>

                {showNotifications && (
                  <div className="fixed inset-x-4 top-[70px] sm:absolute sm:right-[-40px] md:right-0 sm:inset-x-auto sm:mt-2.5 sm:top-auto w-auto sm:w-96 bg-white text-slate-900 border border-slate-200 rounded-2xl shadow-2xl p-0 z-50 animate-in fade-in zoom-in-95 duration-100 overflow-hidden font-sans">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider font-mono-nums">
                        Real-time Alerts ({notifications.length})
                      </span>
                      <button 
                        onClick={() => notificationService.clear()}
                        className="text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer font-medium"
                      >
                        Clear all
                      </button>
                    </div>
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {notifications.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-400">
                          No notifications yet. Operational alerts will appear here.
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className="p-3.5 hover:bg-slate-50 transition text-left">
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-xs font-semibold text-slate-900">{n.title}</span>
                              <span className="text-[10px] text-slate-400 font-mono-nums shrink-0">{n.timestamp}</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.body}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 1 Primary Action Button: + New Fund Wizard */}
              <button
                onClick={onOpenNewFundModal}
                className="hidden sm:inline-flex items-center gap-2 px-4.5 py-2.5 text-xs font-black tracking-wide text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 border-2 border-sky-500 hover:border-sky-400 transition cursor-pointer shadow-md min-h-[44px] rounded-xl font-sans"
              >
                <Plus className="w-4 h-4 shrink-0 stroke-[2.5]" />
                <span>New Fund</span>
              </button>

              {/* Direct Visible Sign Out Text Button - Placed last (right) */}
              <button
                onClick={handleSignOut}
                disabled={isLoggingOut}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-rose-600 bg-rose-950/80 text-rose-300 hover:bg-rose-900 hover:text-white transition cursor-pointer min-h-[44px] text-xs font-black whitespace-nowrap shadow-md font-sans disabled:opacity-50"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">{isLoggingOut ? 'Signing Out...' : 'Sign Out'}</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => onNavigate('landing')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold tracking-wide text-white bg-sky-600 hover:bg-sky-500 transition cursor-pointer rounded-xl min-h-[38px] font-sans"
            >
              Manager Portal
            </button>
          )}

        </div>

      </div>
    </header>
  );
};
