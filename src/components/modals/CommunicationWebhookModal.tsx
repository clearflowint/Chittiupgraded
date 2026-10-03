import React, { useState } from 'react';
import { 
  CommunicationDispatcher, 
  DEFAULT_PLACEHOLDER_WEBHOOK_URL 
} from '../../services/communicationDispatcher';
import { CommunicationEvent, CommunicationWebhookPayload } from '../../types/communication';
import { 
  X, 
  Webhook, 
  Copy, 
  Check, 
  ExternalLink, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Terminal
} from 'lucide-react';

interface CommunicationWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommunicationWebhookModal: React.FC<CommunicationWebhookModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [webhookUrl, setWebhookUrlState] = useState<string>(() => CommunicationDispatcher.getWebhookUrl());
  const [selectedEvent, setSelectedEvent] = useState<CommunicationEvent>('share_reminder');
  const [copied, setCopied] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const currentPayload: CommunicationWebhookPayload = CommunicationDispatcher.getSamplePayload(selectedEvent);
  const payloadJson = JSON.stringify(currentPayload, null, 2);

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    CommunicationDispatcher.setWebhookUrl(webhookUrl);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleResetToDefault = () => {
    setWebhookUrlState(DEFAULT_PLACEHOLDER_WEBHOOK_URL);
    CommunicationDispatcher.setWebhookUrl('');
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(payloadJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendTestDispatch = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await CommunicationDispatcher.dispatch(currentPayload);
      setTesting(false);
      if (res.success) {
        setTestResult(res.simulated 
          ? '✓ Simulated successfully (Placeholder URL)' 
          : `✓ Accepted with HTTP ${res.status || 200}`
        );
      } else {
        setTestResult(`✗ Failed: ${res.error || 'Server error'}`);
      }
    } catch (e: any) {
      setTesting(false);
      setTestResult(`✗ Error: ${e.message}`);
    }
  };

  const isLive = CommunicationDispatcher.isLiveConfigured();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Webhook className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-purple-400 block leading-tight">n8n Integration</span>
              <h2 className="text-base font-black tracking-wide">CENTRALIZED COMMUNICATION WEBHOOK</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 sm:p-6 space-y-5 text-slate-800 text-xs overflow-y-auto">
          
          {/* Status Badge */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span className="font-bold text-slate-700">
                {isLive ? 'Live Webhook Connected' : 'Development Simulation Mode'}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono-nums">
              ONE Endpoint · 5 Events
            </span>
          </div>

          {/* Webhook URL Configuration Form */}
          <form onSubmit={handleSaveUrl} className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="webhook-url-input" className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                COMMUNICATION_WEBHOOK_URL
              </label>
              {webhookUrl !== DEFAULT_PLACEHOLDER_WEBHOOK_URL && (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="text-[10px] text-slate-400 hover:text-slate-600 underline cursor-pointer"
                >
                  Reset to default
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                id="webhook-url-input"
                type="text"
                value={webhookUrl}
                onChange={(e) => setWebhookUrlState(e.target.value)}
                placeholder="https://your-n8n-instance.com/webhook/clearflow-comm"
                className="flex-1 px-3 py-2 text-xs font-mono border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-purple-500 transition min-h-[40px]"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition cursor-pointer min-h-[40px] shrink-0"
              >
                {savedSuccess ? 'Saved!' : 'Save URL'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              ClearFlow triggers this single URL for individual reminders, broadcast reminders, individual statements, bulk statements, and CRM campaigns.
            </p>
          </form>

          {/* Test Payload Preview Tabs */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                Standard n8n Variable Contract Previews (Section 53)
              </span>
              <button
                type="button"
                onClick={handleCopyJson}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-700 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy JSON for n8n'}</span>
              </button>
            </div>

            {/* Event Tabs */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {(['share_reminder', 'bulk_reminder', 'share_statement', 'bulk_statement', 'campaign_launch'] as CommunicationEvent[]).map((ev) => (
                <button
                  key={ev}
                  type="button"
                  onClick={() => setSelectedEvent(ev)}
                  className={`py-1.5 px-2 text-[10px] font-bold rounded-lg transition cursor-pointer text-center truncate ${
                    selectedEvent === ev
                      ? 'bg-white text-purple-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {ev}
                </button>
              ))}
            </div>

            {/* JSON Code Viewer */}
            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 text-slate-200 font-mono text-[11px]">
              <div className="px-3.5 py-1.5 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between text-[10px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Terminal className="w-3 h-3 text-purple-400" />
                  <span>Payload Contract: {selectedEvent}</span>
                </div>
                <span>JSON</span>
              </div>
              <pre className="p-3.5 max-h-56 overflow-y-auto leading-relaxed scrollbar-thin">
                {payloadJson}
              </pre>
            </div>
          </div>

          {/* Test Trigger Button */}
          <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="font-bold text-purple-950 block">Test Dispatch to Webhook</span>
              <span className="text-[10px] text-purple-700">Sends the active test payload to {webhookUrl.slice(0, 45)}...</span>
            </div>
            
            <div className="flex items-center gap-2">
              {testResult && (
                <span className={`text-[10px] font-bold font-mono px-2 py-1 rounded-lg ${
                  testResult.startsWith('✓') ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {testResult}
                </span>
              )}
              <button
                type="button"
                onClick={handleSendTestDispatch}
                disabled={testing}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition cursor-pointer text-xs flex items-center gap-1"
              >
                <Send className="w-3 h-3" />
                <span>{testing ? 'Testing...' : 'Send Test'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-200 hover:bg-slate-300 transition cursor-pointer min-h-[40px]"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
