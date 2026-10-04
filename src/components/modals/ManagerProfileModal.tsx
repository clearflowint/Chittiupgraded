import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChitFund } from '../../context/ChitFundContext';
import { normalizePhoneNumber, isValidPhoneNumber, extract10Digits, formatPhoneDisplay } from '../../utils/phone';
import { X, UserCheck, Phone, Mail, AlertCircle, ShieldCheck } from 'lucide-react';

interface ManagerProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManagerProfileModal: React.FC<ManagerProfileModalProps> = ({ isOpen, onClose }) => {
  const { tenant, currentUser, updateManagerProfile } = useAuth();
  const { showAcknowledgement } = useChitFund();

  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const managerEmail = tenant?.email || currentUser?.email || 'manager@clearflow.internal';

  useEffect(() => {
    if (isOpen) {
      setManagerName(tenant?.name || '');
      setManagerPhone(tenant?.phone ? extract10Digits(tenant.phone) : '');
      setError(null);
    }
  }, [isOpen, tenant]);

  if (!isOpen) return null;

  const isPhoneValid = isValidPhoneNumber(managerPhone);
  const isFormValid = Boolean(managerName.trim()) && isPhoneValid && !isSaving;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerName.trim()) {
      setError('Manager name is required.');
      return;
    }

    if (!isValidPhoneNumber(managerPhone)) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const normalizedPhone = normalizePhoneNumber(managerPhone);
      await updateManagerProfile({
        name: managerName.trim(),
        phone: normalizedPhone,
      });

      setIsSaving(false);
      onClose();

      showAcknowledgement({
        isSuccess: true,
        title: 'Manager Profile Updated',
        message: `Profile updated for ${managerName.trim()} (${formatPhoneDisplay(normalizedPhone)}).`,
        operationType: 'UPDATE MANAGER PROFILE',
        referenceId: `MGR-${tenant?.managerId?.slice(-6) || 'OK'}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setIsSaving(false);
      setError(err?.message || 'Failed to update manager profile.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 font-sans">
        
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-600/30 border border-sky-400/30 text-sky-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono-nums tracking-widest text-sky-400 font-semibold block">
                ADMINISTRATION
              </span>
              <h2 className="text-sm font-bold text-white">
                Manager Profile
              </h2>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
              Manager Full Name *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={managerName}
                onChange={(e) => {
                  setManagerName(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. Anand Mahindra"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition-all min-h-[44px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
              Manager Phone (10-Digit Mobile) *
            </label>
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 font-mono-nums">
                +91
              </span>
              <input
                type="tel"
                required
                value={managerPhone}
                onChange={(e) => {
                  setManagerPhone(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="9845010009"
                className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums min-h-[44px]"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1 ml-1">
              Must be exactly 10 valid mobile digits used for official communications.
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
              Manager Account Email (Authenticated)
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100/80 border border-slate-200 rounded-xl text-xs font-mono-nums text-slate-600">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{managerEmail}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isFormValid}
              className="py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-xs min-h-[44px] flex items-center justify-center gap-1.5"
            >
              {isSaving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
