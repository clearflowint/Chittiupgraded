import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChitFund } from '../context/ChitFundContext';
import { Contact, Group, Campaign, CampaignTargetAudience, CampaignChannel } from '../types';
import { 
  Users, 
  Send, 
  Plus, 
  FolderPlus, 
  MessageSquare, 
  CheckCircle2, 
  Search, 
  Mail, 
  Phone,
  Tag,
  X,
  UserCheck,
  User,
  AlertCircle,
  Edit2,
  Trash2,
  ShieldAlert,
  Folder
} from 'lucide-react';
import { normalizePhoneNumber, isValidPhoneNumber } from '../utils/phone';

export const CrmView: React.FC = () => {
  const { tenant } = useAuth();
  const { 
    contacts, 
    groups, 
    campaigns, 
    createContact, 
    updateContact,
    deleteContact,
    createGroup, 
    updateGroup,
    deleteGroup,
    updateGroupMembers,
    sendCampaign, 
    funds, 
    shares 
  } = useChitFund();

  // Tenant Isolation: Only show Contacts & Groups belonging to the currently authenticated manager/tenant
  const currentManagerId = tenant?.managerId;
  const tenantContacts = contacts.filter(c => !currentManagerId || c.managerId === currentManagerId);
  const tenantGroups = groups.filter(g => !currentManagerId || g.managerId === currentManagerId);
  const tenantCampaigns = campaigns.filter(c => !currentManagerId || c.managerId === currentManagerId);

  const [activeTab, setActiveTab] = useState<'contacts' | 'groups' | 'campaigns'>('contacts');
  const [searchContact, setSearchContact] = useState('');
  const [contactFilter, setContactFilter] = useState<'ALL' | 'EXISTING_MEMBER' | 'NON_MEMBER'>('ALL');

  // Add Contact Form State
  const [showContactModal, setShowContactModal] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactMembership, setNewContactMembership] = useState<'Existing Member' | 'Non-Member'>('Existing Member');
  const [contactError, setContactError] = useState<string | null>(null);

  // Edit Contact Form State
  const [showEditContactModal, setShowEditContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editContactName, setEditContactName] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editContactEmail, setNewContactEmailEdit] = useState('');
  const [editContactMembership, setEditContactMembership] = useState<'Existing Member' | 'Non-Member'>('Existing Member');
  const [editContactError, setEditContactError] = useState<string | null>(null);

  // Delete Contact State
  const [showDeleteContactModal, setShowDeleteContactModal] = useState(false);
  const [deletingContact, setDeletingContact] = useState<Contact | null>(null);
  const [deleteContactError, setDeleteContactError] = useState<string | null>(null);

  // Create Group Form State
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  // Edit Group Form State
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDesc, setEditGroupDesc] = useState('');
  const [editGroupError, setEditGroupError] = useState<string | null>(null);

  // Delete Group State
  const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);

  // Manage Group Members State
  const [showManageGroupModal, setShowManageGroupModal] = useState(false);
  const [managingGroup, setManagingGroup] = useState<Group | null>(null);
  const [searchManageText, setSearchManageText] = useState('');

  // Launch Campaign Form State
  const [showCampaignModal, setShowCampaignModal] = useState(false);
  const [campaignTitle, setCampaignTitle] = useState('Apex Wealth Series III - Early Invitation');
  const [campaignMsg, setCampaignMsg] = useState(
    'Dear Investor, Registration for our next ₹10 Lakhs monthly Chitti pool is now open. Average monthly dividend savings: ₹4,200. Secure your share allotment today!'
  );
  const [selectedChannels, setSelectedChannels] = useState<CampaignChannel[]>(['WHATSAPP']);
  const [targetAudience, setTargetAudience] = useState<string>('ALL');

  // Toggle channel selection (multi-select)
  const toggleChannel = (channel: CampaignChannel) => {
    setSelectedChannels((prev) => 
      prev.includes(channel) 
        ? prev.filter((c) => c !== channel) 
        : [...prev, channel]
    );
  };

  // Helper to determine if a contact is an Existing Member or Non-Member
  const isExistingMember = (c: Contact) => {
    if (c.tags?.includes('Non-Member')) return false;
    if (c.tags?.includes('Existing Member')) return true;
    const norm = normalizePhoneNumber(c.phone);
    return shares.some(s => 
      s.managerId === currentManagerId && 
      (s.memberName.trim().toLowerCase() === c.name.trim().toLowerCase() ||
       (s.memberPhone && normalizePhoneNumber(s.memberPhone) === norm))
    );
  };

  // Check if contact is linked to an active member/share (for deletion safety check)
  const isLinkedToShare = (c: Contact) => {
    const norm = normalizePhoneNumber(c.phone);
    return shares.some(s => 
      s.managerId === currentManagerId && 
      (s.contactId === c.contactId || (s.memberPhone && normalizePhoneNumber(s.memberPhone) === norm))
    );
  };

  // Contact count helper for a specific manager-created Contact Group
  const getGroupCount = (g: Group) => {
    if (Array.isArray(g.memberIds)) {
      return g.memberIds.length;
    }
    const nameLower = g.name.toLowerCase();
    if (nameLower.includes('existing') && nameLower.includes('member')) {
      return tenantContacts.filter(c => isExistingMember(c) && c.communicationStatus !== 'unsubscribed').length;
    }
    if (nameLower.includes('non') || nameLower.includes('prospect')) {
      return tenantContacts.filter(c => !isExistingMember(c) && c.communicationStatus !== 'unsubscribed').length;
    }
    const tagged = tenantContacts.filter(c => c.tags?.some(t => t.toLowerCase() === nameLower) && c.communicationStatus !== 'unsubscribed').length;
    return tagged;
  };

  // Pre-calculate counts for audience groups
  const subscribedContacts = tenantContacts.filter(c => c.communicationStatus !== 'unsubscribed');
  const allAudienceCount = subscribedContacts.length;
  const membersAudienceCount = subscribedContacts.filter(c => isExistingMember(c)).length;
  const nonMembersAudienceCount = subscribedContacts.filter(c => !isExistingMember(c)).length;

  const selectedCustomGroup = tenantGroups.find(g => g.groupId === targetAudience);

  const activeRecipientCount = 
    targetAudience === 'ALL' 
      ? allAudienceCount 
      : targetAudience === 'MEMBERS' 
        ? membersAudienceCount 
        : targetAudience === 'NON_MEMBERS'
          ? nonMembersAudienceCount
          : selectedCustomGroup 
            ? getGroupCount(selectedCustomGroup) 
            : 0;

  const targetAudienceName = 
    targetAudience === 'ALL' 
      ? 'All Contacts' 
      : targetAudience === 'MEMBERS' 
        ? 'Existing Members' 
        : targetAudience === 'NON_MEMBERS' 
          ? 'Non-Members' 
          : selectedCustomGroup 
            ? selectedCustomGroup.name 
            : 'Contact Group';

  // Filtered contacts for list view
  const allContactsCount = tenantContacts.length;
  const existingMembersCount = tenantContacts.filter(c => isExistingMember(c)).length;
  const nonMembersCount = tenantContacts.filter(c => !isExistingMember(c)).length;

  // Submission validation rules:
  // channels.length >= 1 AND recipientCount >= 1
  const hasChannels = selectedChannels.length >= 1;
  const hasRecipients = activeRecipientCount >= 1;
  const hasTitle = campaignTitle.trim().length > 0;
  const hasMessage = campaignMsg.trim().length > 0;
  const isCampaignValid = hasChannels && hasRecipients && hasTitle && hasMessage;

  const getValidationWarning = (): string | null => {
    if (!hasChannels && !hasRecipients) {
      return 'Select at least one delivery channel and ensure target group has recipients.';
    }
    if (!hasChannels) {
      return 'Select at least one delivery channel (WhatsApp, SMS, or Email).';
    }
    if (!hasRecipients) {
      return 'Target contact group has 0 eligible recipients.';
    }
    if (!hasTitle) {
      return 'Please enter a campaign title.';
    }
    if (!hasMessage) {
      return 'Please enter a message body.';
    }
    return null;
  };

  const filteredContacts = tenantContacts.filter(c => {
    const norm = normalizePhoneNumber(c.phone);
    const matchesSearch = 
      c.name.toLowerCase().includes(searchContact.toLowerCase()) ||
      c.phone.includes(searchContact) ||
      norm.includes(searchContact) ||
      (c.email && c.email.toLowerCase().includes(searchContact.toLowerCase()));
    
    if (!matchesSearch) return false;
    if (contactFilter === 'EXISTING_MEMBER') return isExistingMember(c);
    if (contactFilter === 'NON_MEMBER') return !isExistingMember(c);
    return true;
  });

  // Contact Creation Handler with Phone Normalization and Duplicate Check
  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError(null);

    if (!newContactName.trim()) {
      setContactError('Contact Name is required.');
      return;
    }

    const normPhone = normalizePhoneNumber(newContactPhone);
    if (!isValidPhoneNumber(newContactPhone)) {
      setContactError('Please enter a valid phone number (minimum 10 digits).');
      return;
    }

    // Check if phone number already exists for this tenant
    const duplicate = tenantContacts.find(c => normalizePhoneNumber(c.phone) === normPhone);
    if (duplicate) {
      setContactError('A contact with this phone number already exists.');
      return;
    }

    try {
      await createContact({
        name: newContactName.trim(),
        phone: normPhone,
        email: newContactEmail.trim() || undefined,
        tags: [newContactMembership],
        communicationStatus: 'subscribed',
      });
      setNewContactName('');
      setNewContactPhone('');
      setNewContactEmail('');
      setNewContactMembership('Existing Member');
      setContactError(null);
      setShowContactModal(false);
    } catch (err: any) {
      setContactError(err.message || 'Failed to save contact.');
    }
  };

  // Contact Edit Open Handler
  const handleOpenEditContact = (c: Contact) => {
    setEditingContact(c);
    setEditContactName(c.name);
    // Display phone without +91 prefix for comfortable editing
    const cleanPhone = c.phone.replace(/^\+91/, '').replace(/\D/g, '');
    setEditContactPhone(cleanPhone || c.phone);
    setNewContactEmailEdit(c.email || '');
    setEditContactMembership(c.tags?.includes('Non-Member') ? 'Non-Member' : 'Existing Member');
    setEditContactError(null);
    setShowEditContactModal(true);
  };

  // Contact Edit Submit Handler
  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingContact) return;
    setEditContactError(null);

    if (!editContactName.trim()) {
      setEditContactError('Contact Name is required.');
      return;
    }

    const normPhone = normalizePhoneNumber(editContactPhone);
    if (!isValidPhoneNumber(editContactPhone)) {
      setEditContactError('Please enter a valid phone number (minimum 10 digits).');
      return;
    }

    // Check if another contact for this tenant already has this phone number
    const duplicate = tenantContacts.find(
      c => c.contactId !== editingContact.contactId && normalizePhoneNumber(c.phone) === normPhone
    );
    if (duplicate) {
      setEditContactError('A contact with this phone number already exists.');
      return;
    }

    try {
      await updateContact(editingContact.contactId, {
        name: editContactName.trim(),
        phone: normPhone,
        email: editContactEmail.trim() || undefined,
        tags: [editContactMembership],
      });
      setShowEditContactModal(false);
      setEditingContact(null);
    } catch (err: any) {
      setEditContactError(err.message || 'Failed to update contact.');
    }
  };

  // Contact Delete Open Handler
  const handleOpenDeleteContact = (c: Contact) => {
    setDeletingContact(c);
    setDeleteContactError(null);
    setShowDeleteContactModal(true);
  };

  // Contact Delete Confirm Handler
  const handleConfirmDeleteContact = async () => {
    if (!deletingContact) return;
    setDeleteContactError(null);
    try {
      await deleteContact(deletingContact.contactId);
      setShowDeleteContactModal(false);
      setDeletingContact(null);
    } catch (err: any) {
      setDeleteContactError(err.message || 'Failed to delete contact.');
    }
  };

  // Group Create Handler
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    await createGroup(newGroupName.trim(), newGroupDesc.trim(), []);
    setNewGroupName('');
    setNewGroupDesc('');
    setShowGroupModal(false);
  };

  // Group Edit Open Handler
  const handleOpenEditGroup = (g: Group) => {
    setEditingGroup(g);
    setEditGroupName(g.name);
    setEditGroupDesc(g.description || '');
    setEditGroupError(null);
    setShowEditGroupModal(true);
  };

  // Group Edit Submit Handler
  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup || !editGroupName.trim()) return;
    try {
      await updateGroup(editingGroup.groupId, {
        name: editGroupName.trim(),
        description: editGroupDesc.trim(),
      });
      setShowEditGroupModal(false);
      setEditingGroup(null);
    } catch (err: any) {
      setEditGroupError(err.message || 'Failed to update group.');
    }
  };

  // Group Delete Open Handler
  const handleOpenDeleteGroup = (g: Group) => {
    setDeletingGroup(g);
    setShowDeleteGroupModal(true);
  };

  // Group Delete Confirm Handler
  const handleConfirmDeleteGroup = async () => {
    if (!deletingGroup) return;
    // If the currently selected campaign target is this group, reset to 'ALL'
    if (targetAudience === deletingGroup.groupId) {
      setTargetAudience('ALL');
    }
    await deleteGroup(deletingGroup.groupId);
    setShowDeleteGroupModal(false);
    setDeletingGroup(null);
  };

  // Manage Group Members Open Handler
  const handleOpenManageGroup = (g: Group) => {
    setManagingGroup(g);
    setSearchManageText('');
    setShowManageGroupModal(true);
  };

  // Toggle Contact in Group Member List
  const handleToggleGroupMember = async (contactId: string, add: boolean) => {
    if (!managingGroup) return;
    const currentMembers = managingGroup.memberIds || [];
    const nextMembers = add
      ? currentMembers.includes(contactId) ? currentMembers : [...currentMembers, contactId]
      : currentMembers.filter(id => id !== contactId);
    
    // Update local state copy immediately
    setManagingGroup({
      ...managingGroup,
      memberIds: nextMembers,
    });

    await updateGroupMembers(managingGroup.groupId, nextMembers);
  };

  // Campaign Dispatch Handler
  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCampaignValid) return;

    const isSystemClassification = targetAudience === 'ALL' || targetAudience === 'MEMBERS' || targetAudience === 'NON_MEMBERS';

    await sendCampaign({
      title: campaignTitle.trim(),
      message: campaignMsg.trim(),
      channels: selectedChannels,
      targetAudience: isSystemClassification ? (targetAudience as CampaignTargetAudience) : undefined,
      targetGroupIds: !isSystemClassification ? [targetAudience] : undefined,
      recipientCount: activeRecipientCount,
    });
    setShowCampaignModal(false);
  };

  // Format channels label for campaign history
  const formatCampaignChannels = (cmp: Campaign) => {
    if (cmp.channels && Array.isArray(cmp.channels) && cmp.channels.length > 0) {
      return cmp.channels.map(c => {
        const u = String(c).toUpperCase();
        if (u === 'WHATSAPP') return 'WhatsApp';
        if (u === 'SMS') return 'SMS';
        if (u === 'EMAIL') return 'Email';
        return c;
      }).join(' + ');
    }
    return cmp.channel || 'WhatsApp';
  };

  // Audience label for campaign history
  const formatCampaignAudience = (cmp: Campaign) => {
    if (cmp.targetGroupIds && cmp.targetGroupIds.length > 0) {
      const match = tenantGroups.find(g => cmp.targetGroupIds?.includes(g.groupId));
      if (match) return `Group: ${match.name}`;
      return 'Contact Group';
    }
    if (cmp.targetAudience === 'MEMBERS') return 'Existing Members';
    if (cmp.targetAudience === 'NON_MEMBERS') return 'Non-Members';
    return 'All Contacts';
  };

  return (
    <div className="space-y-6 pb-16">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <span className="text-[10px] font-mono-nums font-semibold uppercase tracking-wider text-slate-500">
            CRM &amp; OUTREACH
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-950">
            Contacts &amp; Marketing Campaigns
          </h1>
          <p className="text-xs text-slate-500 font-mono-nums mt-0.5">
            Tenant-isolated directory · Prospective member pools · Broadcast marketing campaigns
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setContactError(null);
              setShowContactModal(true);
            }}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-800 bg-white hover:bg-slate-50 border border-slate-300 transition cursor-pointer flex items-center gap-1.5 rounded-lg shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-slate-600" />
            <span>Add Contact</span>
          </button>

          <button
            onClick={() => setShowCampaignModal(true)}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1.5 rounded-lg shadow-xs"
          >
            <Send className="w-3.5 h-3.5 text-emerald-400" />
            <span>Launch Campaign</span>
          </button>
        </div>
      </div>

      {/* Tabs - Mobile-friendly 3-column equal grid with 64px min touch target */}
      <div className="grid grid-cols-3 w-full sm:flex sm:w-auto sm:items-center sm:gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('contacts')}
          className={`w-full min-w-0 sm:w-auto px-1.5 sm:px-3 py-2 sm:py-1.5 min-h-[64px] sm:min-h-0 flex flex-col sm:flex-row items-center justify-center text-center sm:text-left transition cursor-pointer select-none border-b-2 -mb-px ${
            activeTab === 'contacts'
              ? 'text-emerald-800 border-emerald-700 font-semibold'
              : 'text-slate-500 hover:text-slate-800 border-transparent font-medium'
          }`}
        >
          <span className="text-[11px] sm:text-xs leading-tight sm:leading-normal tracking-tight sm:tracking-wide">
            All Contacts
          </span>
          <span className="text-[10px] sm:text-xs font-mono-nums sm:ml-1 mt-0.5 sm:mt-0 opacity-80">
            ({allContactsCount})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('groups')}
          className={`w-full min-w-0 sm:w-auto px-1.5 sm:px-3 py-2 sm:py-1.5 min-h-[64px] sm:min-h-0 flex flex-col sm:flex-row items-center justify-center text-center sm:text-left transition cursor-pointer select-none border-b-2 -mb-px ${
            activeTab === 'groups'
              ? 'text-emerald-800 border-emerald-700 font-semibold'
              : 'text-slate-500 hover:text-slate-800 border-transparent font-medium'
          }`}
        >
          <span className="text-[11px] sm:text-xs leading-tight sm:leading-normal tracking-tight sm:tracking-wide">
            Contact Groups
          </span>
          <span className="text-[10px] sm:text-xs font-mono-nums sm:ml-1 mt-0.5 sm:mt-0 opacity-80">
            ({tenantGroups.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('campaigns')}
          className={`w-full min-w-0 sm:w-auto px-1.5 sm:px-3 py-2 sm:py-1.5 min-h-[64px] sm:min-h-0 flex flex-col sm:flex-row items-center justify-center text-center sm:text-left transition cursor-pointer select-none border-b-2 -mb-px ${
            activeTab === 'campaigns'
              ? 'text-emerald-800 border-emerald-700 font-semibold'
              : 'text-slate-500 hover:text-slate-800 border-transparent font-medium'
          }`}
        >
          <span className="text-[11px] sm:text-xs leading-tight sm:leading-normal tracking-tight sm:tracking-wide">
            Campaign Dispatches
          </span>
          <span className="text-[10px] sm:text-xs font-mono-nums sm:ml-1 mt-0.5 sm:mt-0 opacity-80">
            ({tenantCampaigns.length})
          </span>
        </button>
      </div>

      {/* TAB 1: Contacts Directory */}
      {activeTab === 'contacts' && (
        <div className="bg-white border border-slate-200 p-5 space-y-4 rounded-xl shadow-xs">
          {/* Search Bar & Membership Classification Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search contact by name or phone..."
                value={searchContact}
                onChange={(e) => setSearchContact(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 focus:outline-none focus:border-emerald-600 bg-white rounded-md"
              />
            </div>

            {/* Direct selectable buttons for system classification filters: All / Existing Members / Non-Members */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setContactFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  contactFilter === 'ALL'
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 border border-slate-200/60'
                }`}
              >
                <span>All</span>
                <span className={`text-[10px] font-mono-nums px-1.5 py-0.2 rounded-full ${
                  contactFilter === 'ALL' ? 'bg-slate-800 text-slate-300' : 'bg-slate-200 text-slate-600'
                }`}>
                  {allContactsCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setContactFilter('EXISTING_MEMBER')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  contactFilter === 'EXISTING_MEMBER'
                    ? 'bg-emerald-700 text-white font-semibold shadow-xs'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100/70 border border-emerald-200/60'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Existing Members</span>
                <span className={`text-[10px] font-mono-nums px-1.5 py-0.2 rounded-full ${
                  contactFilter === 'EXISTING_MEMBER' ? 'bg-emerald-800 text-emerald-100' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {existingMembersCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setContactFilter('NON_MEMBER')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  contactFilter === 'NON_MEMBER'
                    ? 'bg-sky-800 text-white font-semibold shadow-xs'
                    : 'bg-sky-50 text-sky-800 hover:bg-sky-100/70 border border-sky-200/60'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Non-Members</span>
                <span className={`text-[10px] font-mono-nums px-1.5 py-0.2 rounded-full ${
                  contactFilter === 'NON_MEMBER' ? 'bg-sky-900 text-sky-100' : 'bg-sky-100 text-sky-800'
                }`}>
                  {nonMembersCount}
                </span>
              </button>
            </div>
          </div>

          {/* Card list on mobile */}
          <div className="block sm:hidden space-y-3">
            {filteredContacts.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No contacts match your current filter. Click "+ Add Contact" to add one.
              </div>
            ) : (
              filteredContacts.map((c) => {
                const isMember = isExistingMember(c);
                const normPhone = normalizePhoneNumber(c.phone);
                return (
                  <div key={c.contactId} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs font-mono-nums">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 font-sans text-sm">{c.name}</span>
                        <span className="text-[11px] text-slate-600 font-mono-nums font-semibold">{normPhone}</span>
                      </div>
                      <span className="text-[10px] font-sans uppercase font-semibold text-emerald-800">
                        {c.communicationStatus || 'Subscribed'}
                      </span>
                    </div>

                    <div className="text-slate-500 text-[11px]">
                      <span className="block text-[10px] uppercase font-sans font-semibold text-slate-400">Email</span>
                      <span className="text-slate-700 truncate max-w-[200px] block font-sans">{c.email || '—'}</span>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400 font-sans">
                      <div>
                        {isMember ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Existing Member
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            <User className="w-3 h-3 text-slate-400" /> Non-Member
                          </span>
                        )}
                      </div>

                      {/* Compact actions: Edit & Delete */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditContact(c)}
                          className="px-2 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition cursor-pointer flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3 text-slate-500" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteContact(c)}
                          className="px-2 py-1 text-[11px] font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-md transition cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Table on desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px] tracking-wider bg-slate-50/70">
                  <th className="py-2.5 px-3">Contact Name</th>
                  <th className="py-2.5 px-3">Phone (Normalized ID)</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Membership Type</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-nums">
                {filteredContacts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                      No contacts match your current filter. Click "+ Add Contact" to add one.
                    </td>
                  </tr>
                ) : (
                  filteredContacts.map((c) => {
                    const isMember = isExistingMember(c);
                    const normPhone = normalizePhoneNumber(c.phone);
                    return (
                      <tr key={c.contactId} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-3 font-medium text-slate-900 font-sans">
                          {c.name}
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-mono-nums font-semibold">
                          {normPhone}
                        </td>
                        <td className="py-3 px-3 text-slate-500 font-sans">
                          {c.email || '—'}
                        </td>
                        <td className="py-3 px-3">
                          {isMember ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-sans font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Existing Member
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-sans font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              <User className="w-3 h-3 text-slate-400" /> Non-Member
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] font-sans uppercase font-semibold text-emerald-800">
                            {c.communicationStatus || 'Subscribed'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-sans">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEditContact(c)}
                              className="px-2 py-1 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition cursor-pointer flex items-center gap-1"
                            >
                              <Edit2 className="w-3 h-3 text-slate-500" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteContact(c)}
                              className="px-2 py-1 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-md transition cursor-pointer flex items-center gap-1"
                            >
                              <Trash2 className="w-3 h-3 text-rose-500" />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Contact Groups (Manager-Created Groups from /groups) */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
            <div>
              <span className="text-[10px] font-mono-nums font-semibold uppercase tracking-wider text-slate-400 block">
                MANAGER REUSABLE LISTS
              </span>
              <h2 className="text-base font-bold text-slate-900 font-sans tracking-tight">
                CONTACT GROUPS
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setShowGroupModal(true)}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Create Contact Group</span>
            </button>
          </div>

          {/* Empty State or Manager-Created Groups List */}
          {tenantGroups.length === 0 ? (
            <div className="bg-white border border-slate-200 p-8 sm:p-12 text-center space-y-4 rounded-xl shadow-xs">
              <FolderPlus className="w-10 h-10 text-slate-300 mx-auto" />
              <div className="space-y-1">
                <p className="text-base font-bold text-slate-800">No Contact Groups yet.</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Create manager contact groups to organize contacts into reusable groups for targeted campaigns.
                </p>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowGroupModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Create Contact Group</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {tenantGroups.map((g) => {
                const count = getGroupCount(g);
                const displayId = g.displayId || `GRP-${g.groupId.slice(-4).toUpperCase()}`;
                return (
                  <div 
                    key={g.groupId} 
                    className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 shadow-xs hover:border-slate-300 transition flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Folder className="w-4 h-4 text-emerald-600 shrink-0" />
                          <h3 className="font-bold text-slate-950 text-base leading-snug">
                            {g.name}
                          </h3>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-block text-base sm:text-lg font-bold font-mono-nums text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                            {count}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11px] font-mono-nums text-slate-400">
                        ID: {displayId}
                      </p>

                      {g.description && (
                        <p className="text-xs text-slate-600 leading-relaxed pt-1">
                          {g.description}
                        </p>
                      )}
                    </div>

                    {/* Compact actions: Manage Contacts, Edit, Delete, Launch Campaign */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenManageGroup(g)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                          title="Manage group member contacts"
                        >
                          <Users className="w-3.5 h-3.5 text-slate-500" />
                          <span>Manage Contacts</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditGroup(g)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 border border-slate-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                          title="Edit group name or description"
                        >
                          <Edit2 className="w-3 h-3 text-slate-500" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteGroup(g)}
                          className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/80 border border-rose-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                          title="Delete contact group"
                        >
                          <Trash2 className="w-3 h-3 text-rose-500" />
                          <span>Delete</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setTargetAudience(g.groupId);
                          setShowCampaignModal(true);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 border border-slate-200 rounded-lg transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Send className="w-3 h-3 text-emerald-600" />
                        <span>Launch Campaign</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Campaigns History */}
      {activeTab === 'campaigns' && (
        <div className="bg-white border border-slate-200 p-5 space-y-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-serif font-bold text-slate-950">Marketing &amp; Outreach History</h2>
            <button
              onClick={() => setShowCampaignModal(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer flex items-center gap-1 rounded-lg shadow-xs"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              <span>New Campaign</span>
            </button>
          </div>

          {tenantCampaigns.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">No campaigns dispatched yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 space-y-3">
              {tenantCampaigns.map((cmp) => (
                <div key={cmp.campaignId} className="pt-3 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900 text-sm font-serif">{cmp.title}</span>
                    <span className="text-[10px] font-mono-nums text-slate-400">{cmp.createdAt.split('T')[0]}</span>
                  </div>
                  <p className="text-slate-600 bg-slate-50 p-2.5 border border-slate-200 text-xs leading-relaxed rounded-lg">
                    "{cmp.message}"
                  </p>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-mono-nums text-slate-500">
                    <span className="font-medium text-slate-700">Channels: {formatCampaignChannels(cmp)}</span>
                    <span>·</span>
                    <span>Audience: {formatCampaignAudience(cmp)}</span>
                    <span>·</span>
                    <span>Recipients: {cmp.recipientCount}</span>
                    <span>·</span>
                    <span className="text-emerald-800 font-semibold uppercase">{cmp.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal 1: Add Contact (Normalized Phone Unique ID) */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-600/30 border border-sky-400/30 text-sky-400 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono-nums tracking-widest text-sky-400 font-semibold block">
                    CRM DIRECTORY
                  </span>
                  <h2 className="text-sm font-bold text-white">
                    Add New CRM Contact
                  </h2>
                </div>
              </div>
              <button 
                onClick={() => setShowContactModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateContact} className="p-5 space-y-4">
              {contactError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-semibold">{contactError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                  Contact Name *
                </label>
                <input
                  type="text"
                  required
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 transition-all min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                  Phone Number (Unique Identifier) *
                </label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 font-mono-nums">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    value={newContactPhone}
                    onChange={(e) => {
                      setNewContactPhone(e.target.value);
                      if (contactError) setContactError(null);
                    }}
                    placeholder="9845010009"
                    className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums min-h-[44px]"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 ml-1">
                  The normalized phone number serves as the unique contact identifier.
                </p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={newContactEmail}
                  onChange={(e) => setNewContactEmail(e.target.value)}
                  placeholder="ramesh@example.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums min-h-[44px]"
                />
              </div>

              {/* Membership Classification */}
              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                  Membership Classification *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setNewContactMembership('Existing Member')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between min-h-[48px] ${
                      newContactMembership === 'Existing Member'
                        ? 'border-2 border-emerald-600 bg-emerald-50/80 text-emerald-950 font-semibold shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <UserCheck className={`w-4 h-4 ${newContactMembership === 'Existing Member' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="text-xs font-sans font-medium">Existing Member</span>
                    </div>
                    {newContactMembership === 'Existing Member' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewContactMembership('Non-Member')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between min-h-[48px] ${
                      newContactMembership === 'Non-Member'
                        ? 'border-2 border-emerald-600 bg-emerald-50/80 text-emerald-950 font-semibold shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <User className={`w-4 h-4 ${newContactMembership === 'Non-Member' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="text-xs font-sans font-medium">Non-Member</span>
                    </div>
                    {newContactMembership === 'Non-Member' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer shadow-xs min-h-[44px]"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Edit Contact */}
      {showEditContactModal && editingContact && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-600/30 border border-sky-400/30 text-sky-400 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono-nums tracking-widest text-sky-400 font-semibold block">
                    CRM CONTACT
                  </span>
                  <h2 className="text-sm font-bold text-white">
                    Edit Contact
                  </h2>
                </div>
              </div>
              <button 
                onClick={() => setShowEditContactModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateContact} className="p-5 space-y-4">
              {editContactError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-semibold">{editContactError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                  Contact Name *
                </label>
                <input
                  type="text"
                  required
                  value={editContactName}
                  onChange={(e) => setEditContactName(e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 transition-all min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                  Phone Number *
                </label>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 font-mono-nums">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    value={editContactPhone}
                    onChange={(e) => {
                      setEditContactPhone(e.target.value);
                      if (editContactError) setEditContactError(null);
                    }}
                    placeholder="9845010009"
                    className="flex-1 px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={editContactEmail}
                  onChange={(e) => setNewContactEmailEdit(e.target.value)}
                  placeholder="ramesh@example.com"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-mono-nums min-h-[44px]"
                />
              </div>

              {/* Membership Classification */}
              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                  Membership Classification *
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEditContactMembership('Existing Member')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between min-h-[48px] ${
                      editContactMembership === 'Existing Member'
                        ? 'border-2 border-emerald-600 bg-emerald-50/80 text-emerald-950 font-semibold shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <UserCheck className={`w-4 h-4 ${editContactMembership === 'Existing Member' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="text-xs font-sans font-medium">Existing Member</span>
                    </div>
                    {editContactMembership === 'Existing Member' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditContactMembership('Non-Member')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between min-h-[48px] ${
                      editContactMembership === 'Non-Member'
                        ? 'border-2 border-emerald-600 bg-emerald-50/80 text-emerald-950 font-semibold shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <User className={`w-4 h-4 ${editContactMembership === 'Non-Member' ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <span className="text-xs font-sans font-medium">Non-Member</span>
                    </div>
                    {editContactMembership === 'Non-Member' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditContactModal(false)}
                  className="py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer shadow-xs min-h-[44px]"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Delete Contact Confirmation */}
      {showDeleteContactModal && deletingContact && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95">
            <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-600/30 border border-rose-400/30 text-rose-400 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono-nums tracking-widest text-rose-400 font-semibold block">
                    CONFIRMATION
                  </span>
                  <h2 className="text-sm font-bold text-white">
                    Delete this contact?
                  </h2>
                </div>
              </div>
              <button 
                onClick={() => setShowDeleteContactModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                This will remove the contact from your CRM. Existing financial/member records must not be deleted.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 text-xs font-mono-nums">
                <div className="font-bold text-slate-900 font-sans text-sm">{deletingContact.name}</div>
                <div className="text-slate-600">{normalizePhoneNumber(deletingContact.phone)}</div>
                {deletingContact.email && (
                  <div className="text-slate-500 font-sans text-[11px]">{deletingContact.email}</div>
                )}
              </div>

              {isLinkedToShare(deletingContact) ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Active Member Record Linked</p>
                    <p className="leading-relaxed">
                      This contact is linked to an active member/share record and cannot be deleted from financial history. You can edit their contact details instead.
                    </p>
                  </div>
                </div>
              ) : null}

              {deleteContactError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{deleteContactError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeleteContactModal(false)}
                  className="py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isLinkedToShare(deletingContact)}
                  onClick={handleConfirmDeleteContact}
                  className={`py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 min-h-[44px] ${
                    isLinkedToShare(deletingContact)
                      ? 'text-slate-400 bg-slate-200 cursor-not-allowed border border-slate-300'
                      : 'text-white bg-rose-600 hover:bg-rose-700 cursor-pointer shadow-xs'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Contact</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Create Contact Group */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95">
            <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-600/30 border border-sky-400/30 text-sky-400 flex items-center justify-center">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono-nums tracking-widest text-sky-400 font-semibold block">
                    CONTACT GROUPS
                  </span>
                  <h2 className="text-sm font-bold text-white">
                    Create Contact Group
                  </h2>
                </div>
              </div>
              <button 
                onClick={() => setShowGroupModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="e.g. VIP Customers, Follow Up"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 transition-all min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Members targeted for specific pools or high-priority follow up..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer shadow-xs min-h-[44px]"
                >
                  Create Contact Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 5: Edit Contact Group */}
      {showEditGroupModal && editingGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95">
            <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-600/30 border border-sky-400/30 text-sky-400 flex items-center justify-center">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono-nums tracking-widest text-sky-400 font-semibold block">
                    CONTACT GROUP
                  </span>
                  <h2 className="text-sm font-bold text-white">
                    Edit Contact Group
                  </h2>
                </div>
              </div>
              <button 
                onClick={() => setShowEditGroupModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateGroup} className="p-5 space-y-4">
              {editGroupError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editGroupError}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                  Group ID (Read-Only)
                </label>
                <input
                  type="text"
                  disabled
                  value={editingGroup.displayId || editingGroup.groupId}
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-100 text-slate-500 rounded-xl font-mono-nums min-h-[44px] cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  value={editGroupName}
                  onChange={(e) => setEditGroupName(e.target.value)}
                  placeholder="e.g. VIP Customers"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 transition-all min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                  Description
                </label>
                <textarea
                  rows={3}
                  value={editGroupDesc}
                  onChange={(e) => setEditGroupDesc(e.target.value)}
                  placeholder="Description of this group..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditGroupModal(false)}
                  className="py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer shadow-xs min-h-[44px]"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 6: Delete Contact Group Confirmation */}
      {showDeleteGroupModal && deletingGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95">
            <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-600/30 border border-rose-400/30 text-rose-400 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono-nums tracking-widest text-rose-400 font-semibold block">
                    CONFIRMATION
                  </span>
                  <h2 className="text-sm font-bold text-white">
                    Delete Contact Group?
                  </h2>
                </div>
              </div>
              <button 
                onClick={() => setShowDeleteGroupModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                This removes the group only. Contacts will not be deleted.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1 text-xs">
                <div className="font-bold text-slate-900 text-sm">{deletingGroup.name}</div>
                <div className="text-slate-500 font-mono-nums">
                  Members: {getGroupCount(deletingGroup)}
                </div>
                {deletingGroup.description && (
                  <div className="text-slate-500 text-[11px] pt-1">{deletingGroup.description}</div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowDeleteGroupModal(false)}
                  className="py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteGroup}
                  className="py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 transition cursor-pointer shadow-xs min-h-[44px] flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Group</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 7: Manage Group Contacts Membership */}
      {showManageGroupModal && managingGroup && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-400/30 text-emerald-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono-nums tracking-widest text-sky-400 font-semibold block">
                    CONTACT GROUP: {managingGroup.name}
                  </span>
                  <h2 className="text-sm font-bold text-white">
                    Members ({managingGroup.memberIds?.length || 0})
                  </h2>
                </div>
              </div>
              <button 
                onClick={() => setShowManageGroupModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 flex-1 flex flex-col overflow-hidden">
              <div className="relative w-full">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search contacts to add or remove..."
                  value={searchManageText}
                  onChange={(e) => setSearchManageText(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 focus:outline-none focus:border-emerald-600 bg-white rounded-md"
                />
              </div>

              {/* Contacts list */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl pr-1">
                {tenantContacts
                  .filter(c => {
                    const norm = normalizePhoneNumber(c.phone);
                    const q = searchManageText.toLowerCase();
                    return c.name.toLowerCase().includes(q) || c.phone.includes(q) || norm.includes(q);
                  })
                  .map((c) => {
                    const isMember = (managingGroup.memberIds || []).includes(c.contactId);
                    const normPhone = normalizePhoneNumber(c.phone);
                    const isExisting = isExistingMember(c);
                    return (
                      <div 
                        key={c.contactId}
                        className={`p-3 flex items-center justify-between gap-3 transition ${
                          isMember ? 'bg-emerald-50/40' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-xs truncate">{c.name}</span>
                            {isExisting ? (
                              <span className="text-[9px] font-sans font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 shrink-0">
                                Member
                              </span>
                            ) : (
                              <span className="text-[9px] font-sans font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200 shrink-0">
                                Non-Member
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-mono-nums text-slate-500">
                            {normPhone}
                          </p>
                        </div>

                        <div className="shrink-0">
                          {isMember ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-1 rounded-md border border-emerald-200/80 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Added</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleGroupMember(c.contactId, false)}
                                className="px-2.5 py-1 text-xs font-medium text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-200 rounded-md transition cursor-pointer"
                              >
                                Remove
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleGroupMember(c.contactId, true)}
                              className="px-3 py-1 text-xs font-semibold text-slate-900 hover:text-white hover:bg-slate-900 bg-white border border-slate-300 rounded-md transition cursor-pointer flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs font-mono-nums text-slate-500">
                  Total in group: <strong className="text-slate-900">{managingGroup.memberIds?.length || 0}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setShowManageGroupModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition cursor-pointer shadow-xs min-h-[40px]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 8: Launch Campaign (MULTI-CHANNEL, COMPACT MOBILE TARGET CHIPS) */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-600/30 border border-emerald-400/30 text-emerald-400 flex items-center justify-center">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono-nums tracking-widest text-sky-400 font-semibold block">
                    OUTREACH BROADCAST
                  </span>
                  <h2 className="text-sm font-bold text-white">
                    Launch Marketing Campaign
                  </h2>
                </div>
              </div>
              <button 
                onClick={() => setShowCampaignModal(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendCampaign} className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                  Campaign Title *
                </label>
                <input
                  type="text"
                  required
                  value={campaignTitle}
                  onChange={(e) => setCampaignTitle(e.target.value)}
                  placeholder="e.g. Apex Wealth Series III - Early Invitation"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition-all min-h-[44px]"
                />
              </div>

              {/* Multi-Channel Selection: WhatsApp Business, SMS, Email */}
              <div>
                <div className="flex items-center justify-between mb-1.5 ml-1">
                  <label className="text-[10px] font-bold text-sky-700 uppercase tracking-widest">
                    Channels * (Multi-Select)
                  </label>
                  <span className={`text-[10px] font-mono-nums font-semibold ${
                    selectedChannels.length === 0 ? 'text-amber-600' : 'text-slate-500'
                  }`}>
                    {selectedChannels.length === 0 ? 'None selected (min 1 required)' : `${selectedChannels.length} Selected`}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                  {/* WhatsApp Business */}
                  <button
                    type="button"
                    onClick={() => toggleChannel('WHATSAPP')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 min-h-[58px] relative ${
                      selectedChannels.includes('WHATSAPP')
                        ? 'border-2 border-emerald-600 bg-emerald-50/80 text-emerald-950 font-semibold shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {selectedChannels.includes('WHATSAPP') && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 absolute top-2 right-2" />
                    )}
                    <MessageSquare className={`w-4 h-4 ${selectedChannels.includes('WHATSAPP') ? 'text-emerald-600' : 'text-slate-500'}`} />
                    <span className="text-xs font-sans font-medium">WhatsApp Business</span>
                  </button>

                  {/* SMS */}
                  <button
                    type="button"
                    onClick={() => toggleChannel('SMS')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 min-h-[58px] relative ${
                      selectedChannels.includes('SMS')
                        ? 'border-2 border-emerald-600 bg-emerald-50/80 text-emerald-950 font-semibold shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {selectedChannels.includes('SMS') && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 absolute top-2 right-2" />
                    )}
                    <Phone className={`w-4 h-4 ${selectedChannels.includes('SMS') ? 'text-emerald-600' : 'text-slate-500'}`} />
                    <span className="text-xs font-sans font-medium">SMS</span>
                  </button>

                  {/* Email */}
                  <button
                    type="button"
                    onClick={() => toggleChannel('EMAIL')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 min-h-[58px] relative ${
                      selectedChannels.includes('EMAIL')
                        ? 'border-2 border-emerald-600 bg-emerald-50/80 text-emerald-950 font-semibold shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    {selectedChannels.includes('EMAIL') && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 absolute top-2 right-2" />
                    )}
                    <Mail className={`w-4 h-4 ${selectedChannels.includes('EMAIL') ? 'text-emerald-600' : 'text-slate-500'}`} />
                    <span className="text-xs font-sans font-medium">Email</span>
                  </button>
                </div>
              </div>

              {/* Target Contact Group Direct Selection (System Classifications + Manager Contact Groups) */}
              <div>
                <div className="flex items-center justify-between mb-2 ml-1">
                  <label className="text-[10px] font-bold text-sky-700 uppercase tracking-widest">
                    Target Contact Group *
                  </label>
                  <span className="text-[11px] font-mono-nums font-semibold text-slate-700">
                    {activeRecipientCount} {activeRecipientCount === 1 ? 'Recipient' : 'Recipients'}
                  </span>
                </div>

                {/* Unified, compact responsive wrapping grid for all target options (44-56px high chips) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {/* System: All Contacts */}
                  <button
                    type="button"
                    onClick={() => setTargetAudience('ALL')}
                    className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 min-h-[46px] sm:min-h-[50px] relative ${
                      targetAudience === 'ALL'
                        ? 'border-2 border-emerald-600 bg-emerald-50/90 text-emerald-950 font-semibold shadow-xs'
                        : 'border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="text-xs sm:text-[13px] font-sans font-medium leading-tight break-words">
                      All Contacts
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[11px] font-mono-nums font-semibold px-1.5 py-0.5 rounded-md ${
                        targetAudience === 'ALL' ? 'bg-emerald-200/80 text-emerald-900' : 'bg-slate-200/70 text-slate-600'
                      }`}>
                        ({allAudienceCount})
                      </span>
                      {targetAudience === 'ALL' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      )}
                    </div>
                  </button>

                  {/* System: Existing Members */}
                  <button
                    type="button"
                    onClick={() => setTargetAudience('MEMBERS')}
                    className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 min-h-[46px] sm:min-h-[50px] relative ${
                      targetAudience === 'MEMBERS'
                        ? 'border-2 border-emerald-600 bg-emerald-50/90 text-emerald-950 font-semibold shadow-xs'
                        : 'border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="text-xs sm:text-[13px] font-sans font-medium leading-tight break-words">
                      Existing Members
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[11px] font-mono-nums font-semibold px-1.5 py-0.5 rounded-md ${
                        targetAudience === 'MEMBERS' ? 'bg-emerald-200/80 text-emerald-900' : 'bg-slate-200/70 text-slate-600'
                      }`}>
                        ({membersAudienceCount})
                      </span>
                      {targetAudience === 'MEMBERS' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      )}
                    </div>
                  </button>

                  {/* System: Non-Members */}
                  <button
                    type="button"
                    onClick={() => setTargetAudience('NON_MEMBERS')}
                    className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 min-h-[46px] sm:min-h-[50px] relative ${
                      targetAudience === 'NON_MEMBERS'
                        ? 'border-2 border-emerald-600 bg-emerald-50/90 text-emerald-950 font-semibold shadow-xs'
                        : 'border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <span className="text-xs sm:text-[13px] font-sans font-medium leading-tight break-words">
                      Non-Members
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className={`text-[11px] font-mono-nums font-semibold px-1.5 py-0.5 rounded-md ${
                        targetAudience === 'NON_MEMBERS' ? 'bg-emerald-200/80 text-emerald-900' : 'bg-slate-200/70 text-slate-600'
                      }`}>
                        ({nonMembersAudienceCount})
                      </span>
                      {targetAudience === 'NON_MEMBERS' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      )}
                    </div>
                  </button>

                  {/* Manager-Created Contact Groups - Same selection area with small group indicator */}
                  {tenantGroups.map((g) => {
                    const count = getGroupCount(g);
                    const isSelected = targetAudience === g.groupId;
                    return (
                      <button
                        key={g.groupId}
                        type="button"
                        onClick={() => setTargetAudience(g.groupId)}
                        className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-1.5 min-h-[46px] sm:min-h-[50px] relative ${
                          isSelected
                            ? 'border-2 border-emerald-600 bg-emerald-50/90 text-emerald-950 font-semibold shadow-xs'
                            : 'border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-1">
                          <Users className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-700' : 'text-slate-400'}`} />
                          <span className="text-xs sm:text-[13px] font-sans font-medium leading-tight break-words">
                            {g.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className={`text-[11px] font-mono-nums font-semibold px-1.5 py-0.5 rounded-md ${
                            isSelected ? 'bg-emerald-200/80 text-emerald-900' : 'bg-slate-200/70 text-slate-600'
                          }`}>
                            ({count})
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-sky-700 uppercase tracking-widest mb-1.5 ml-1">
                  Message Body *
                </label>
                <textarea
                  rows={5}
                  required
                  value={campaignMsg}
                  onChange={(e) => setCampaignMsg(e.target.value)}
                  placeholder="Enter broadcast message text..."
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 leading-relaxed font-sans min-h-[120px]"
                />
              </div>

              {/* Targeting, Channels Summary & Inline Validation Feedback */}
              <div className={`p-3 rounded-xl text-xs font-mono-nums flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border transition-all ${
                !hasChannels || !hasRecipients
                  ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <div className="flex items-center gap-2">
                  {!hasChannels || !hasRecipients ? (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  )}
                  <div>
                    {!hasChannels || !hasRecipients ? (
                      <span className="font-semibold font-sans text-amber-900 text-xs">
                        {getValidationWarning()}
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-sans">
                        <span>
                          Target: <strong className="text-slate-900 font-bold">{targetAudienceName}</strong>
                        </span>
                        <span className="text-slate-300">·</span>
                        <span>
                          Recipients: <strong className="text-slate-900 font-bold font-mono-nums">{activeRecipientCount}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-[10px] font-medium text-slate-500 flex items-center gap-1.5 shrink-0">
                  <span className="text-slate-400">Channels:</span>
                  {selectedChannels.length === 0 ? (
                    <span className="text-amber-700 font-bold">None</span>
                  ) : (
                    <span className="text-slate-800 font-semibold">
                      {selectedChannels.map(c => c === 'WHATSAPP' ? 'WhatsApp' : c === 'EMAIL' ? 'Email' : 'SMS').join(' + ')}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCampaignModal(false)}
                  className="py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition cursor-pointer min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isCampaignValid}
                  className={`py-2.5 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5 min-h-[44px] ${
                    isCampaignValid
                      ? 'text-white bg-slate-900 hover:bg-slate-800 cursor-pointer shadow-xs'
                      : 'text-slate-400 bg-slate-200 cursor-not-allowed border border-slate-300/40 shadow-none'
                  }`}
                >
                  <Send className={`w-3.5 h-3.5 ${isCampaignValid ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>Launch Campaign</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
