import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Smartphone, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running as an installed PWA, hide the button
  if (isInstalled) {
    return null;
  }

  const handleInstallClick = () => {
    if (isInstallable) {
      install();
    } else {
      setShowGuide(true);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
      <div className="w-[90%] max-w-sm bg-white border border-slate-200 p-5 shadow-2xl rounded-2xl h-fit my-auto flex flex-col justify-start">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">Install Operations App</h3>
          <button
            onClick={() => setShowGuide(false)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <p className="mt-4 text-xs text-slate-600 leading-relaxed">
          {isIOS ? (
            "To install this app on your iOS device for offline operations:"
          ) : (
            "To install this app on your device for offline operations:"
          )}
        </p>
        
        {isIOS ? (
          <ol className="mt-3 space-y-2 text-xs text-slate-700 list-decimal list-inside bg-slate-50 p-3 border border-slate-200 rounded-xl">
            <li>Tap the <span className="font-semibold text-slate-900">Share</span> button in Safari toolbar</li>
            <li>Scroll down and select <span className="font-semibold text-slate-900">Add to Home Screen</span></li>
            <li>Tap <span className="font-semibold text-emerald-700">Add</span> in the top right</li>
          </ol>
        ) : (
          <ul className="mt-3 space-y-2 text-xs text-slate-700 list-disc list-inside bg-slate-50 p-3 border border-slate-200 rounded-xl">
            <li>In your browser menu (usually three dots on top right), select <span className="font-semibold text-slate-900">Install app</span> or <span className="font-semibold text-slate-900">Add to Home screen</span>.</li>
            <li>Follow the on-screen prompts to complete.</li>
          </ul>
        )}
        
        <button
          onClick={() => setShowGuide(false)}
          className="mt-5 w-full py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition cursor-pointer min-h-[40px]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-black text-slate-100 bg-slate-800 hover:bg-slate-700 hover:text-white hover:border-slate-500 active:bg-slate-900 transition cursor-pointer border-2 border-slate-600 rounded-xl min-h-[38px] shadow-md shrink-0"
      >
        <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span className="hidden xs:inline">Install App</span>
      </button>

      {showGuide && createPortal(modalContent, document.body)}
    </>
  );
};
