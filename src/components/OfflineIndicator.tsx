import React from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-1.5 bg-slate-900 text-slate-100 px-4 py-3 text-xs font-medium border border-amber-500/40 shadow-2xl max-w-sm rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
        </span>
        <WifiOff className="w-3.5 h-3.5 text-amber-400" />
        <span className="font-bold tracking-wide">Offline — Read-only mode</span>
      </div>
      <p className="text-slate-400 text-[10.5px] leading-relaxed">
        Your cached data is available for viewing. Changes require an internet connection.
      </p>
    </div>
  );
};
