import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useChitFund } from '../../context/ChitFundContext';
import { Fund, Share } from '../../types';
import { normalizePhoneNumber, isValidPhoneNumber } from '../../utils/phone';
import { X, Edit3, User, Phone, AlertCircle, Search } from 'lucide-react';

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
  share: Share | null;
}

export const EditMemberModal: React.FC<EditMemberModalProps> = ({
  isOpen,
  onClose,
  fund,
  share,
}) => {
  const { tenant } = useAuth();
  const { updateShare, contacts, showAcknowledgement } = useChitFund();

  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contactSearch, setContactSearch] = useState('');
  const [showContactResults, setShowContactSearch] = useState(false);

  useEffect(() => {
    if (share) {
      setMemberName(share.memberName || '');
      // Strip leading country code if present for cleaner input
      const phoneDigits = share.memberPhone.replace(/^\+91\s?/, '');
      setMemberPhone(phoneDigits);
      setSelectedContactId(share.contactId || '');
      setContactSearch(share.contactId ? (contacts.find(c => c.contactId === share.contactId)?.name || '') : '');
      setError(null);
    }
  }, [share, contacts]);

  if (!isOpen || !share) return null;

  const filteredContacts = contacts.filter(c => 
    c.name.toLowerCase().includes(contactSearch.toLowerCase()) || 
    c.phone.includes(contactSearch)
  );

  const handleSelectContact = (c: any) => {
    setSelectedContactId(c.contactId);
    setMemberName(c.name);
    // Strip leading country code if present for cleaner input
    const phoneDigits = c.phone.replace(/^\+91\s?/, '');
    setMemberPhone(phoneDigits);
    setContactSearch(c.name);
    setShowContactSearch(false);
  };

  const managerDisplay = tenant?.email
    ? tenant.email.replace(/(.{3})(.*)(@.*)/, '$1***$3')
    : tenant?.name || 'Authorized Manager';

  const shareDisplayId = share.displayId || '----';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) {
      setError('Member name is required.');
      return;
    }
    if (!isValidPhoneNumber(memberPhone)) {
      setError('Phone number must be exactly 10 valid digits.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fullPhone = normalizePhoneNumber(memberPhone);
      await updateShare({
        fundId: fund.fundId,
        shareId: share.shareId,
        memberName: memberName.trim(),
        memberPhone: fullPhone,
        contactId: selectedContactId || undefined,
      });

      setLoading(false);
      onClose();

      showAcknowledgement({
        isSuccess: true,
        title: 'Member Info Updated',
        message: `Member details for "${memberName.trim()}" have been successfully saved.`,
        operationType: 'EDIT MEMBER INFO',
        referenceId: share.shareId,
        ackTime: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to update member info');
      setLoading(false);
      showAcknowledgement({
        isSuccess: false,
        title: 'Edit Member Failed',
        message: err?.message || 'Could not commit updated member details.',
        operationType: 'EDIT MEMBER INFO',
        referenceId: share.shareId,
        ackTime: new Date().toLocaleTimeString(),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Edit3 className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-bold tracking-wide">Edit Member Info</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Read-Only Context Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 font-mono-nums text-xs space-y-1 text-slate-800 shrink-0">
          <div>
            <span className="font-semibold">Tenant / Manager ID: </span>
            <span className="text-slate-600">{managerDisplay}</span>
          </div>
          <div>
            <span className="font-semibold">Fund ID: </span>
            <span className="text-slate-600">{fund.displayId || fund.fundId} ({fund.fundName})</span>
          </div>
          <div>
            <span className="font-semibold">Share ID: </span>
            <span className="text-slate-600">[{shareDisplayId}]</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Contact Search Field (Section 1) */}
            <div className="relative group">
              <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                Link to CRM Contact
              </label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 group-focus-within:text-sky-500 transition-colors" />
                <input
                  type="text"
                  value={contactSearch}
                  onFocus={() => setShowContactSearch(true)}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setShowContactSearch(true);
                  }}
                  disabled={contacts.length === 0}
                  placeholder={contacts.length === 0 ? "No CRM contacts available..." : "Type name or phone to find contact..."}
                  className="w-full pl-10 pr-4 py-3 text-sm border-2 border-slate-100 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 transition-all font-medium placeholder-slate-400 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {showContactResults && contactSearch.trim() !== '' && contacts.length > 0 && (
                <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-60 overflow-y-auto divide-y divide-slate-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  {filteredContacts.length === 0 ? (
                    <div className="p-4 text-xs text-slate-500 italic flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>No contacts matching "{contactSearch}"</span>
                    </div>
                  ) : (
                    filteredContacts.map((c) => (
                      <button
                        key={c.contactId}
                        type="button"
                        onClick={() => handleSelectContact(c)}
                        className="w-full text-left p-3.5 hover:bg-sky-50 transition-colors flex items-center justify-between group/item"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold text-slate-900 group-hover/item:text-sky-700">{c.name}</span>
                          <span className="text-[10px] font-mono-nums text-slate-500">{c.phone}</span>
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 group-hover/item:text-sky-500 uppercase tracking-tighter">
                          Select +
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}

              {contacts.length === 0 && (
                <p className="mt-1.5 text-[9px] text-amber-600 font-medium px-1">
                  Tip: Add contacts in the CRM tab to use this quick-link feature.
                </p>
              )}

              {contacts.length > 0 && (
                <div className="mt-1.5 flex items-center justify-between px-1">
                  <p className="text-[9px] text-slate-400 italic">Updates fields below; remaining editable</p>
                  {selectedContactId && (
                    <button 
                      type="button"
                      onClick={() => {
                        setSelectedContactId('');
                        setContactSearch('');
                      }}
                      className="text-[9px] font-bold text-rose-500 hover:text-rose-600 underline"
                    >
                      Clear Link
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 my-2 pt-2"></div>

            {/* Member Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Member Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Member Name"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 min-h-[44px]"
                />
              </div>
            </div>

            {/* Phone Number / WhatsApp */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number / WhatsApp (10 Digits)
              </label>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 font-mono-nums">
                  +91
                </span>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234567890"
                  className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Exactly 10 digits required</span>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !memberName.trim() || !isValidPhoneNumber(memberPhone)}
                className="py-2.5 rounded-xl text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-xs min-h-[44px]"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

          </form>

        </div>

      </div>
    </div>
  );
};
