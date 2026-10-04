import React from 'react';
import { Share, Fund, Cycle } from '../types';
import { FinancialEngine } from '../services/financialEngine';
import { 
  CreditCard, 
  MessageSquare, 
  FileText, 
  Edit3, 
  Phone, 
  User, 
  AlertCircle,
  CheckCircle2,
  Award,
  Calculator,
  Send
} from 'lucide-react';

interface MemberCardProps {
  share: Share;
  fund: Fund;
  currentCycle?: Cycle | null;
  isOnline?: boolean;
  onEdit: (share: Share) => void;
  onStatement: (share: Share) => void;
  onDrawCorrection: (share: Share) => void;
  onReminder: (share: Share) => void;
  onWhatsApp?: (share: Share) => void;
  onRecordPayment: (share: Share) => void;
  onRecordPayout?: (share: Share) => void;
  onEditBills?: (share: Share) => void;
}

export const MemberCard: React.FC<MemberCardProps> = ({
  share,
  fund,
  currentCycle,
  isOnline = true,
  onEdit,
  onStatement,
  onDrawCorrection,
  onReminder,
  onWhatsApp,
  onRecordPayment,
  onRecordPayout,
  onEditBills,
}) => {
  const isDrawn = share.hasClaimedPrize;
  const currentCycleDue = currentCycle
    ? currentCycle.netInstallmentDue
    : Math.round(fund.totalPool / fund.totalCycles);

  const shareDisplayId = share.displayId || '----';
  const fundDisplayId = fund.displayId || '----';
  const cleanPhone = share.memberPhone.replace(/[^0-9]/g, '');

  return (
    <div className="bg-white border border-slate-200 rounded-[24px] shadow-sm overflow-hidden p-4 space-y-4 font-sans">
      
      {/* Header Row: Share ID, Member Info, Arrears Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-4 min-w-0">
          {/* Col 1: Share ID & Fund ID */}
          <div className="shrink-0 space-y-1.5">
            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-[#f1f5f9] border border-slate-200 text-slate-900 text-[12px] font-black font-mono-nums leading-none uppercase">
              {shareDisplayId}
            </span>
            <div className="text-[10px] text-sky-600 font-black tracking-tight truncate max-w-[85px] leading-tight px-0.5 uppercase">
              {fundDisplayId}
            </div>
          </div>

          {/* Col 2: Member Name & Phone */}
          <div className="min-w-0 pt-0.5 space-y-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <h3 className="font-black text-slate-900 text-sm truncate leading-tight">
                {share.memberName}
              </h3>
            </div>
            <div className="flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-slate-400 shrink-0" />
              <a
                href={`https://wa.me/${cleanPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-bold text-slate-500 font-mono-nums hover:text-sky-600 transition-colors"
              >
                {share.memberPhone}
              </a>
            </div>
          </div>
        </div>

        {/* Col 3: Arrears / Advance status badge - BIGGER AS REQUESTED */}
        {share.arrears > 0 ? (
          <div className="shrink-0 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-2 text-center min-w-[100px] shadow-xs">
            <div className="text-[15px] font-black text-rose-600 font-mono-nums leading-none mb-1">
              -{FinancialEngine.formatCurrency(share.arrears)}
            </div>
            <div className="flex items-center justify-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter">Pending</span>
            </div>
          </div>
        ) : share.advance > 0 ? (
          <div className="shrink-0 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-2 text-center min-w-[100px] shadow-xs">
            <div className="text-[15px] font-black text-emerald-600 font-mono-nums leading-none mb-1">
              +{FinancialEngine.formatCurrency(share.advance)}
            </div>
            <div className="flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-tighter">Advance</span>
            </div>
          </div>
        ) : (
          <div className="shrink-0 bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2 text-center min-w-[100px] shadow-xs">
            <div className="text-[15px] font-black text-slate-500 font-mono-nums leading-none mb-1">
              ₹0
            </div>
            <div className="flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Settled</span>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="bg-[#f8fafc] border border-slate-100 rounded-[20px] p-4 grid grid-cols-2 gap-y-4 gap-x-6 text-[12px] font-mono-nums">
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 font-sans">Current Due</span>
          <span className="font-black text-slate-900">
            {FinancialEngine.formatCurrency(currentCycleDue)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 font-sans">Total Billed</span>
          <span className="font-black text-slate-900">
            {FinancialEngine.formatCurrency(share.totalBilled)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 font-sans">Cash Paid</span>
          <span className={`font-black ${((share.totalCredits || 0) - (share.totalDebits || 0)) > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
            {FinancialEngine.formatCurrency((share.totalCredits || 0) - (share.totalDebits || 0))}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1 font-sans">Cycle Status</span>
          <span className="font-black text-slate-900 font-sans">
            {isDrawn ? `Drawn (C${share.wonCycleNumber ?? '?'})` : 'Undrawn (U)'}
          </span>
        </div>
      </div>

      {/* Actions: Horizontal Buttons matching reference style */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onEdit(share)}
          disabled={!isOnline}
          title={!isOnline ? "Editing member info requires internet connection" : "Edit member info"}
          className={`flex items-center gap-1.5 py-2 px-3 rounded-xl border transition shadow-xs min-h-[40px] ${
            isOnline 
              ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer' 
              : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          <span className="text-[11px] font-bold">Edit Info</span>
        </button>

        <button
          onClick={() => onStatement(share)}
          className="flex items-center gap-1.5 py-2 px-3 rounded-xl border border-sky-100 bg-white hover:bg-sky-50 text-sky-600 transition cursor-pointer shadow-xs min-h-[40px]"
        >
          <FileText className="w-4 h-4" />
          <span className="text-[11px] font-bold">Statement</span>
        </button>

        <button
          onClick={() => onDrawCorrection(share)}
          disabled={!isOnline}
          title={!isOnline ? "Correcting draw status requires internet connection" : "Correct draw status"}
          className={`flex items-center gap-1.5 py-2 px-3 rounded-xl border transition shadow-xs min-h-[40px] ${
            !isOnline
              ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
              : isDrawn 
                ? 'border-emerald-100 bg-emerald-50/30 text-emerald-600 hover:bg-emerald-50 cursor-pointer' 
                : 'border-orange-100 bg-orange-50/30 text-orange-600 hover:bg-orange-50 cursor-pointer'
          }`}
        >
          <Award className="w-4 h-4" />
          <span className="text-[11px] font-bold">{isDrawn ? 'Drawn' : 'Undrawn'}</span>
        </button>

        {onEditBills && (
          <button
            onClick={() => onEditBills(share)}
            disabled={!isOnline}
            title={!isOnline ? "Editing bills requires internet connection" : "Edit individual bills"}
            className={`flex items-center gap-1.5 py-2 px-3 rounded-xl border transition shadow-xs min-h-[40px] ${
              isOnline 
                ? 'border-sky-100 bg-white hover:bg-sky-50 text-sky-600 cursor-pointer' 
                : 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span className="text-[11px] font-bold">Bills</span>
          </button>
        )}

        <button
          onClick={() => onReminder(share)}
          disabled={!isOnline}
          title={!isOnline ? "Sending reminders requires internet connection" : "Send WhatsApp reminder"}
          className={`flex items-center gap-1.5 py-2 px-3 rounded-xl text-white transition shadow-sm min-h-[40px] ${
            isOnline 
              ? 'bg-emerald-500 hover:bg-emerald-600 cursor-pointer' 
              : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span className="text-[11px] font-bold">Reminder</span>
        </button>

        {onWhatsApp && (
          <button
            onClick={() => onWhatsApp(share)}
            disabled={!isOnline}
            title={!isOnline ? "Sending WhatsApp updates requires internet connection" : "Send WhatsApp update to member"}
            className={`flex items-center gap-1.5 py-2 px-3 rounded-xl text-white transition shadow-sm min-h-[40px] ${
              isOnline 
                ? 'bg-[#25D366] hover:bg-[#20bd5a] cursor-pointer' 
                : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
            }`}
          >
            <Send className="w-4 h-4" />
            <span className="text-[11px] font-bold">WhatsApp</span>
          </button>
        )}

        <button
          onClick={() => onRecordPayment(share)}
          disabled={!isOnline}
          title={!isOnline ? "Recording payment requires internet connection" : "Record Payment"}
          className={`flex-1 min-w-[130px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-white transition shadow-md min-h-[40px] ${
            isOnline 
              ? 'bg-sky-600 hover:bg-sky-500 cursor-pointer' 
              : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-60'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span className="text-[11px] font-black">{isOnline ? 'Record Payment' : 'Offline'}</span>
        </button>
      </div>

    </div>
  );
};
