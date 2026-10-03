import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Lock, 
  Building,
  AlertCircle,
  Mail,
  CheckCircle2,
  Info
} from 'lucide-react';

interface LandingViewProps {
  onEnterApp: () => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onEnterApp }) => {
  const { 
    signInWithEmail,
    signInWithDemoManager,
    sendPasswordReset,
  } = useAuth();

  const [isResetMode, setIsResetMode] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setFormError('Please fill in all credentials.');
      return;
    }
    
    setFormLoading(true);
    setFormError(null);
    
    try {
      await signInWithEmail(email, password);
      setFormLoading(false);
      onEnterApp();
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      setFormError('Email or password is incorrect.');
      setFormLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setFormError('Please provide your email address to reset password.');
      return;
    }

    setFormLoading(true);
    setFormError(null);
    setResetSuccess(null);

    try {
      await sendPasswordReset(email.trim());
      setResetSuccess('Password reset email sent! Please check your inbox.');
      setFormLoading(false);
    } catch (err: any) {
      console.error('Reset password error:', err);
      setFormError(err?.message || 'Failed to send password reset email.');
      setFormLoading(false);
    }
  };

  const handleDemoLogin = async (name: string, email: string) => {
    if (!import.meta.env.DEV) {
      alert('Demo mode is strictly restricted to development environments.');
      return;
    }
    setFormError(null);
    await signInWithDemoManager(name, email, '+91 98450 12345');
    onEnterApp();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      
      {/* Hero Header & Card Section */}
      <section className="pt-8 pb-14 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Brand Presentation Left Column (Streamlined & Non-technical description) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-mono-nums font-bold tracking-wider uppercase text-sky-800 bg-sky-50 px-3 py-1 border border-sky-200 rounded-lg select-none">
              <Building className="w-3.5 h-3.5 text-sky-700" />
              <span>CLEARFLOW AUTOMATIONS</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-950 tracking-tight leading-[1.15]">
              Automate your daily operations with ClearFlow.
            </h1>

            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-xl font-normal font-sans">
              Manage members, billing, payments, payouts, reminders and records — all in one simple workspace. Crafted to ensure absolute clarity for operations of all sizes.
            </p>

            <div className="hidden sm:flex items-center gap-4 text-xs text-slate-400 font-mono-nums pt-1">
              <span>✓ Members</span>
              <span>·</span>
              <span>✓ Billing</span>
              <span>·</span>
              <span>✓ Payments</span>
              <span>·</span>
              <span>✓ Payouts</span>
              <span>·</span>
              <span>✓ Reminders</span>
              <span>·</span>
              <span>✓ Records</span>
            </div>
          </div>

          {/* Secure Login Form Right Column (Direct Inputs inside the Card) */}
          <div className="lg:col-span-5 flex items-center justify-center">
            <div className="w-full max-w-sm bg-white border border-slate-200 shadow-md rounded-2xl overflow-hidden font-sans">
              
              {/* Header */}
              <div className="bg-[#0f172a] text-white px-5 py-4 flex items-center gap-2.5 border-b border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-sky-600/20 border border-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] uppercase font-mono-nums tracking-widest text-sky-400 font-bold block leading-none">
                    SECURE HUB
                  </span>
                  <h2 className="text-xs font-bold text-white tracking-wider mt-0.5">
                    CLEARFLOW MANAGER LOGIN
                  </h2>
                </div>
              </div>

              <div className="p-5 space-y-4">
                
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2 rounded-xl">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {resetSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>{resetSuccess}</span>
                  </div>
                )}

                {/* Direct Fields Form */}
                <form onSubmit={isResetMode ? handleResetSubmit : handleLoginSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-0.5">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="manager@example.com"
                        className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition-all h-10"
                      />
                    </div>
                  </div>

                  {!isResetMode && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-0.5">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                        <input
                          type="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-200 bg-slate-50 focus:bg-white rounded-xl focus:outline-none focus:border-sky-500 font-medium transition-all h-10"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={formLoading}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition cursor-pointer shadow-xs min-h-[44px] flex items-center justify-center"
                  >
                    {formLoading ? 'Processing...' : (isResetMode ? 'Send Reset Link' : 'LOGIN')}
                  </button>
                </form>

                {/* Password Reset Trigger Link */}
                <div className="text-center pt-1 border-t border-slate-100 flex items-center justify-center gap-2 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(!isResetMode);
                      setFormError(null);
                      setResetSuccess(null);
                    }}
                    className="text-[10px] font-bold text-sky-700 hover:text-sky-800 uppercase tracking-wider transition cursor-pointer min-h-[32px]"
                  >
                    {isResetMode ? 'Back to Login' : 'Forgot password?'}
                  </button>
                </div>

                {/* Google Sign-In Disabled Alternate */}
                <div className="relative flex items-center justify-center py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                  <span className="relative px-2 bg-white text-[9px] font-bold uppercase text-slate-400 font-mono-nums">
                    OR SECURE OAUTH
                  </span>
                </div>

                {/* Visibly Disabled Google Sign-In Button */}
                <div className="relative">
                  <button
                    disabled
                    className="w-full py-3 bg-slate-50 text-slate-400 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2.5 min-h-[44px] cursor-not-allowed font-sans select-none opacity-60"
                  >
                    <svg className="w-4 h-4 opacity-50" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"/>
                      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"/>
                      <path fill="#FBBC05" d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7s.1-2 .4-2.7L1.6 6.4C.6 8.3 0 10.1 0 12s.6 3.7 1.6 5.6l3.7-2.9z"/>
                      <path fill="#34A853" d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 15.9C3.5 19.7 7.4 23 12 23z"/>
                    </svg>
                    <span>Continue with Google</span>
                  </button>
                  <span className="absolute right-3.5 top-3.5 text-[8px] font-bold text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded uppercase leading-none select-none">
                    Coming Soon
                  </span>
                </div>

                {/* Demo Mode for Dev */}
                {import.meta.env.DEV && (
                  <div className="pt-2 border-t border-slate-100 flex flex-col gap-1.5 animate-in fade-in">
                    <span className="text-[9px] text-slate-400 font-mono-nums block text-center uppercase tracking-wider font-semibold">Dev Mode Bypass</span>
                    <button
                      type="button"
                      onClick={() => handleDemoLogin('Lakshmi Finance Group', 'manager@lakshmichits.com')}
                      className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg font-semibold text-[10px] transition cursor-pointer flex items-center justify-center gap-1 font-mono-nums"
                    >
                      <Building className="w-3.5 h-3.5 text-amber-700" />
                      <span>Launch Mock Manager (Lakshmi)</span>
                    </button>
                  </div>
                )}

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 bg-slate-900 text-slate-400 text-xs px-4 border-t border-slate-800 shrink-0 select-none">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-sans font-bold text-white text-[11px]">ClearFlow Automations</span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-500">Operational Workspace Management</span>
          </div>
          <div className="font-mono-nums text-slate-500 text-[10px]">
            Zero-Drift Multi-Tenant Accounting
          </div>
        </div>
      </footer>

    </div>
  );
};
