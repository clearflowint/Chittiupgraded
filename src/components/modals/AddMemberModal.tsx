import React, { useState } from 'react';
import { useChitFund } from '../../context/ChitFundContext';
import { Fund } from '../../types';
import { X, UserPlus, AlertCircle, Search } from 'lucide-react';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  fund: Fund;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({ isOpen, onClose, fund }) => {
  const { addShare, contacts, showAcknowledgement } = useChitFund();

  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contactSearch, setContactSearch] = useState('');
  const [showContactResults, setShowContactSearch] = useState(false);

  if (!isOpen) return null;

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim()) {
      setError('Member name is required.');
      return;
    }

    if (memberPhone.length !== 10) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const finalName = memberName.trim();
      const finalPhone = `+91${memberPhone}`;
      const shareId = await addShare({
        fundId: fund.fundId,
        memberName: finalName,
        memberPhone: finalPhone,
        contactId: selectedContactId || undefined,
      });

      setLoading(false);
      setMemberName('');
      setMemberPhone('');
      setSelectedContactId('');
      onClose();

      showAcknowledgement({
        isSuccess: true,
        title: 'Member Allotted Successfully',
        message: `Successfully registered member "${finalName}" to the Chitti scheme.`,
        operationType: 'ADD MEMBER ALLOTMENT',
        referenceId: shareId || `REF-${Date.now().toString().slice(-6)}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to add share allotment');
      setLoading(false);
      showAcknowledgement({
        isSuccess: false,
        title: 'Member Allotment Failed',
        message: err?.message || 'Could not allocate new share allotment.',
        operationType: 'ADD MEMBER ALLOTMENT',
        referenceId: `ERR-${Date.now().toString().slice(-6)}`,
        ackTime: new Date().toLocaleTimeString(),
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header - Dark Design matching example */}
        <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-600/20 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-sky-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-wide">ADD MEMBER ALLOTMENT</h2>
              <p className="text-[10px] text-slate-400 font-mono-nums uppercase tracking-tight truncate max-w-[200px]">
                {fund.fundName}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Contact Search Field (Section 1) */}
            <div className="relative group">
              <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                Search CRM Contacts
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
                  placeholder={contacts.length === 0 ? "No CRM contacts available..." : "Type name or phone..."}
                  className="w-full pl-10 pr-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 transition-all font-medium placeholder-slate-400 shadow-sm disabled:opacity-50"
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
                  Tip: Add contacts in the CRM tab to use this quick-fill feature.
                </p>
              )}

              {contacts.length > 0 && (
                <div className="mt-1.5 flex items-center justify-between px-1">
                  <p className="text-[9px] text-slate-400 italic font-medium">Auto-populates fields below</p>
                  {selectedContactId && (
                    <button 
                      type="button"
                      onClick={() => {
                        setSelectedContactId('');
                        setContactSearch('');
                      }}
                      className="text-[9px] font-bold text-rose-500 hover:text-rose-600 underline"
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 my-2"></div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                Member Full Name
              </label>
              <input
                type="text"
                required
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                placeholder="e.g. Vikramaditya Singh"
                className="w-full px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                Phone Number (10 Digits)
              </label>
              <div className="flex items-center gap-2">
                <div className="px-3.5 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 font-mono-nums">
                  +91
                </div>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={memberPhone}
                  onChange={(e) => setMemberPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234567890"
                  className="flex-1 px-4 py-3 text-base sm:text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums font-medium transition-all"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1.5 ml-1 block font-medium">Exactly 10 digits required for WhatsApp automation</span>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="py-3 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[48px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="py-3 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 active:bg-sky-700 disabled:opacity-50 transition cursor-pointer shadow-md min-h-[48px]"
              >
                {loading ? 'Allotting...' : 'Allot Share'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
