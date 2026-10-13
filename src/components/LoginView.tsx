import React, { useState, useEffect } from 'react';
import { AuthManager } from '../lib/auth';
import { User } from './TeamManagementTypes';
import { 
  Lock, 
  User as UserIcon, 
  LogIn, 
  HelpCircle, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
  logoUrl?: string;
}

type AuthMode = 'login' | 'forgot' | 'reset_success';

export default function LoginView({ onLoginSuccess, logoUrl }: LoginViewProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Forgot password states (Upgraded to email OTP recovery)
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [simulatedReceivedCode, setSimulatedReceivedCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const isRtl = true; // Hardcoded to Persian as per user request style

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const user = await AuthManager.login(username, password);
      if (user) {
        onLoginSuccess(user);
      } else {
        setError(isRtl ? 'نام کاربری یا رمز عبور اشتباه است' : 'Invalid username or password');
      }
    } catch (err) {
      setError(isRtl ? 'خطایی در سیستم رخ داد' : 'A system error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResetCode = async () => {
    if (!emailOrUsername) {
      setError(isRtl ? 'لطفا آدرس ایمیل یا نام کاربری خود را وارد کنید' : 'Please enter email or username');
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const res = await AuthManager.sendResetCode(emailOrUsername);
      if (res.success && res.code) {
        setIsCodeSent(true);
        setSimulatedReceivedCode(res.code);
      } else {
        setError(res.error || (isRtl ? 'حساب کاربری یافت نشد' : 'User not found'));
      }
    } catch (err) {
      setError(isRtl ? 'خطایی در ارسال ایمیل رخ داد' : 'Error sending email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otpCode) {
      setError(isRtl ? 'لطفا کد تایید را وارد کنید' : 'Please enter verification code');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(isRtl ? 'رمز عبور و تاییدیه آن مطابقت ندارند' : 'Passwords do not match');
      return;
    }

    if (newPassword.length < 3) {
      setError(isRtl ? 'رمز عبور باید حداقل ۳ کاراکتر باشد' : 'Password must be at least 3 characters');
      return;
    }

    setIsLoading(true);
    try {
      const success = await AuthManager.verifyResetCodeAndChangePassword(emailOrUsername, otpCode, newPassword);
      if (success) {
        setMode('reset_success');
      } else {
        setError(isRtl ? 'کد تایید اشتباه است یا منقضی شده است' : 'Incorrect or expired verification code');
      }
    } catch (err) {
      setError(isRtl ? 'خطایی در ثبت رمز عبور رخ داد' : 'Error updating password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center p-4 font-sans select-none overflow-hidden relative text-[#E0E0E0]">
      {/* Decorative background elements consistent with project's ambient feel */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-[#121214] border border-[#2A2A2D] rounded-[32px] shadow-2xl overflow-hidden backdrop-blur-md">
          {/* Top Branding Section */}
          <div className="p-8 pb-4 text-center">
            <div className="flex justify-center mb-6">
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-600/20 p-4 overflow-hidden"
              >
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-contain filter brightness-0 invert" />
                ) : (
                  <ShieldCheck className="w-full h-full text-white" />
                )}
              </motion.div>
            </div>
            <h1 className="text-2xl font-black text-white mb-2 tracking-tight">
              {isRtl ? 'سامانه مدیریت کیفیت IATF' : 'IATF Quality Management System'}
            </h1>
            <p className="text-zinc-500 text-sm font-medium">
              {isRtl ? 'پورتال یکپارچه مدیریت فرآیندها' : 'Integrated Process Management Portal'}
            </p>
          </div>

          <div className="p-8 pt-4">
            <AnimatePresence mode="wait">
              {mode === 'login' && (
                <motion.form 
                  key="login"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={handleLogin}
                  className="space-y-5"
                >
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block px-1">
                      {isRtl ? 'شناسه کاربری' : 'Username'}
                    </label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-amber-500 transition-colors">
                        <UserIcon size={18} />
                      </div>
                      <input 
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-[#1A1A1D] border border-[#2A2A2D] rounded-2xl py-4 pr-12 pl-4 text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500/40 transition-all text-sm"
                        placeholder={isRtl ? 'نام کاربری را وارد کنید' : 'Enter username'}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block">
                        {isRtl ? 'گذرواژه' : 'Password'}
                      </label>
                      <button 
                        type="button"
                        onClick={() => setMode('forgot')}
                        className="text-[10px] font-bold text-amber-500 hover:text-amber-400 transition-colors"
                      >
                        {isRtl ? 'فراموشی رمز عبور؟' : 'Forgot Password?'}
                      </button>
                    </div>
                    <div className="relative group">
                      <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-amber-500 transition-colors">
                        <Lock size={18} />
                      </div>
                      <input 
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-[#1A1A1D] border border-[#2A2A2D] rounded-2xl py-4 pr-12 pl-12 text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-amber-500/10 focus:border-amber-500/40 transition-all text-sm"
                        placeholder={isRtl ? '••••••••' : '••••••••'}
                        required
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 left-3.5 flex items-center text-zinc-500 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 flex items-center gap-3 text-red-400 text-xs font-bold"
                    >
                      <AlertCircle size={16} className="shrink-0" />
                      {error}
                    </motion.div>
                  )}

                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 text-white font-black py-4 rounded-2xl shadow-xl shadow-amber-600/10 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <LogIn size={18} />
                        {isRtl ? 'ورود به پنل کاربری' : 'Sign in to Panel'}
                      </>
                    )}
                  </button>

                  <div className="pt-6 border-t border-[#2A2A2D] text-center">
                    <p className="text-[10px] text-zinc-600 font-black tracking-widest uppercase">
                      {isRtl ? 'مدیریت دسترسی‌های ادمین: admin / 123' : 'Admin Access: admin / 123'}
                    </p>
                  </div>
                </motion.form>
              )}

              {mode === 'forgot' && (
                <motion.div 
                  key="forgot"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <button 
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setIsCodeSent(false);
                        setEmailOrUsername('');
                        setOtpCode('');
                        setNewPassword('');
                        setConfirmPassword('');
                        setError(null);
                      }}
                      className="p-2.5 bg-[#1A1A1D] border border-[#2A2A2D] rounded-xl text-zinc-400 hover:text-white transition-colors"
                    >
                      <ArrowLeft size={16} />
                    </button>
                    <h2 className="text-lg font-bold text-white">
                      {isRtl ? 'بازیابی هویت و گذرواژه' : 'Identity & Password Recovery'}
                    </h2>
                  </div>

                  {!isCodeSent ? (
                    <div className="space-y-5">
                      <p className="text-zinc-500 text-xs leading-relaxed font-medium">
                        {isRtl 
                          ? 'جهت بازیابی رمز عبور، لطفا آدرس ایمیل یا نام کاربری ثبت شده خود را وارد نمایید تا کد تایید برای شما ارسال شود.' 
                          : 'To recover your password, please enter your registered email or username.'}
                      </p>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block px-1">
                          {isRtl ? 'ایمیل یا نام کاربری ثبت شده' : 'Registered Email or Username'}
                        </label>
                        <input 
                          type="text"
                          value={emailOrUsername}
                          onChange={(e) => setEmailOrUsername(e.target.value)}
                          className="w-full bg-[#1A1A1D] border border-[#2A2A2D] rounded-2xl py-4 px-4 text-white placeholder-zinc-750 focus:outline-none focus:border-amber-500/40 transition-all text-sm text-right"
                          placeholder={isRtl ? 'مثال: aloneeagl@gmail.com یا admin' : 'e.g. aloneeagl@gmail.com'}
                        />
                      </div>
                      
                      {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 flex items-center gap-2 text-red-400 text-xs font-bold">
                          <AlertCircle size={14} />
                          {error}
                        </div>
                      )}

                      <button 
                        onClick={handleSendResetCode}
                        disabled={isLoading}
                        className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 text-white font-black py-4 rounded-2xl shadow-xl shadow-amber-600/10 transition-all flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          isRtl ? 'ارسال کد تایید به ایمیل' : 'Send Recovery Code'
                        )}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleVerifyAndReset} className="space-y-5">
                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center gap-2 text-emerald-500 font-black text-[10px] uppercase tracking-wider">
                          <CheckCircle2 size={14} />
                          {isRtl ? 'کد تایید ارسال شد' : 'Verification Code Sent'}
                        </div>
                        <p className="text-zinc-400 text-[11px] leading-relaxed">
                          {isRtl 
                            ? `کد تایید ۶ رقمی با موفقیت به ایمیل ثبت شده کاربری شما ارسال گردید.` 
                            : `A 6-digit verification code has been successfully sent to your email.`}
                        </p>
                      </div>

                      {/* Simulated email inbox notification helper for flawless sandbox preview experience */}
                      <div className="bg-amber-500/10 border border-dashed border-amber-500/30 rounded-2xl p-4 space-y-2 animate-pulse">
                        <div className="flex items-center gap-2 text-amber-500 font-bold text-[10.5px] uppercase tracking-wider">
                          <span>📬</span>
                          <span>{isRtl ? 'صندوق دریافت ایمیل فرضی (محیط تست)' : 'Simulated Email Inbox'}</span>
                        </div>
                        <p className="text-zinc-200 text-xs leading-relaxed">
                          {isRtl ? 'کد تایید یکبار مصرف تولید شده شما:' : 'Your generated verification OTP:'}{' '}
                          <span className="font-mono text-amber-400 font-black text-sm bg-black/40 px-2 py-0.5 rounded border border-amber-500/20">{simulatedReceivedCode}</span>
                        </p>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-zinc-400 block px-1 uppercase tracking-widest">
                          {isRtl ? 'کد تایید ۶ رقمی' : '6-Digit Verification Code'}
                        </label>
                        <input 
                          type="text"
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-[#1A1A1D] border border-[#2A2A2D] rounded-2xl py-3 px-4 text-white placeholder-zinc-700 focus:outline-none focus:border-amber-500/40 transition-all text-sm font-mono tracking-[0.5em] text-center"
                          placeholder="******"
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-zinc-400 block px-1 uppercase tracking-widest">
                            {isRtl ? 'رمز عبور جدید' : 'New Password'}
                          </label>
                          <input 
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-[#1A1A1D] border border-[#2A2A2D] rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-amber-500/40 transition-all text-sm text-right"
                            required
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-bold text-zinc-400 block px-1 uppercase tracking-widest">
                            {isRtl ? 'تکرار رمز عبور' : 'Confirm Password'}
                          </label>
                          <input 
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-[#1A1A1D] border border-[#2A2A2D] rounded-2xl py-3 px-4 text-white focus:outline-none focus:border-amber-500/40 transition-all text-sm text-right"
                            required
                          />
                        </div>
                      </div>

                      {error && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 flex items-center gap-2 text-red-400 text-xs font-bold">
                          <AlertCircle size={14} />
                          {error}
                        </div>
                      )}

                      <button 
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-800 text-white font-black py-4 rounded-2xl shadow-xl shadow-amber-600/10 transition-all flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          isRtl ? 'بروزرسانی گذرواژه و ورود' : 'Update Password & Login'
                        )}
                      </button>
                    </form>
                  )}
                </motion.div>
              )}

              {mode === 'reset_success' && (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-8 space-y-6"
                >
                  <div className="flex justify-center">
                    <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500">
                      <CheckCircle2 size={48} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-white">
                      {isRtl ? 'گذرواژه با موفقیت تغییر کرد' : 'Password Successfully Changed'}
                    </h3>
                    <p className="text-zinc-500 text-sm font-medium">
                      {isRtl 
                        ? 'اطلاعات امنیتی شما بروزرسانی شد. اکنون می‌توانید وارد سیستم شوید.' 
                        : 'Your security credentials have been updated. You can now login.'}
                    </p>
                  </div>
                  <button 
                    onClick={() => setMode('login')}
                    className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-2xl shadow-lg transition-all"
                  >
                    {isRtl ? 'بازگشت به صفحه ورود' : 'Return to Login'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="mt-10 text-center">
          <p className="text-zinc-700 text-[10px] uppercase tracking-[0.2em] font-black">
            Automotive Quality Management System • Enterprise v2.5
          </p>
        </div>
      </motion.div>
    </div>
  );
}
