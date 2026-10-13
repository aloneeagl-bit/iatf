import React, { useState, useEffect } from 'react';
import {
  Key,
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  Bot,
  FileText,
  ShieldCheck,
  Zap,
  Info,
  X,
  Sliders,
  Terminal,
  Settings,
  HelpCircle,
  Activity
} from 'lucide-react';
import { getGlobalAiModel } from '../lib/aiConfig';

interface AiApiKeyGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'fa' | 'en';
}

interface KeyStatusData {
  hasKey: boolean;
  maskedKey: string | null;
  currentModel: string;
  requirementNotice?: {
    titleFa: string;
    messageFa: string;
    setupGuideStepsFa: Array<{
      step: number;
      title: string;
      description: string;
      link?: string;
    }>;
  };
}

export default function AiApiKeyGuideModal({ isOpen, onClose, lang = 'fa' }: AiApiKeyGuideModalProps) {
  const [status, setStatus] = useState<KeyStatusData | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testLog, setTestLog] = useState<{ success: boolean; message: string; snippet?: string } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'guide' | 'capabilities' | 'env'>('guide');

  const isRtl = lang === 'fa';

  const fetchKeyStatus = async (runTest = false) => {
    if (runTest) setIsTesting(true);
    else setIsLoadingStatus(true);

    try {
      const url = runTest ? '/api/ai-key-status?test=true' : '/api/ai-key-status';
      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setStatus({
          hasKey: data.hasKey,
          maskedKey: data.maskedKey,
          currentModel: data.currentModel || getGlobalAiModel(),
          requirementNotice: data.requirementNotice
        });

        if (data.testResult) {
          setTestLog(data.testResult);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch AI key status:', err);
      if (runTest) {
        setTestLog({
          success: false,
          message: 'خطا در ارتباط با سرور برنامه برای تست API Key.'
        });
      }
    } finally {
      setIsLoadingStatus(false);
      setIsTesting(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setTestLog(null);
      fetchKeyStatus(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyCode = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fade-in" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-[#0D0D10] border border-[#2A2A35] w-full max-w-4xl max-h-[92vh] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden text-slate-200">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#25252E] bg-[#131318] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/15 border border-amber-500/35 text-amber-400 rounded-xl shadow-inner">
              <KeyRound size={22} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  {isRtl ? 'راهنمای جامع فعال‌سازی کلید API هوش مصنوعی' : 'AI Engine API Key Activation Guide'}
                </h2>
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-extrabold rounded-md font-mono">
                  GEMINI_API_KEY
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRtl 
                  ? 'راهنمای کامل دریافت، تنظیم و اعتبارسنجی کلید API برای تمام موتورهای هوش مصنوعی پروژه'
                  : 'Complete step-by-step setup and verification for Google Gemini AI Engine.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-[#25252E] rounded-xl transition-all cursor-pointer"
            title={isRtl ? 'بستن' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Live Status Banner */}
        <div className="px-5 py-3 border-b border-[#23232C] bg-[#0A0A0E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            {isLoadingStatus ? (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <RefreshCw size={14} className="animate-spin text-amber-400" />
                <span>{isRtl ? 'در حال بررسی وضعیت کلید API در سرور...' : 'Checking API Key status...'}</span>
              </div>
            ) : status?.hasKey ? (
              <div className="flex items-center gap-2.5">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <div className="text-xs">
                  <span className="font-black text-emerald-400">
                    {isRtl ? 'کلید API هوش مصنوعی فعال و متصل است' : 'AI API Key is Active & Connected'}
                  </span>
                  {status.maskedKey && (
                    <span className="mr-2 px-2 py-0.5 bg-emerald-500/10 text-emerald-300 font-mono text-[11px] rounded border border-emerald-500/20">
                      {status.maskedKey}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5">
                <div className="p-1 bg-amber-500/20 text-amber-400 rounded-md border border-amber-500/30 shrink-0">
                  <AlertTriangle size={15} />
                </div>
                <div className="text-xs">
                  <span className="font-black text-amber-400">
                    {isRtl ? 'کلید API هنوز تنظیم نشده است (حالت دمو/آفلاین فعال است)' : 'API Key is not configured (Demo Mode Active)'}
                  </span>
                  <p className="text-[11px] text-slate-400">
                    {isRtl ? 'موتورهای هوش مصنوعی سیستم از شبیه‌سازی هوشمند دمو استفاده می‌کنند.' : 'Fallback demo simulator is currently serving responses.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Test connection button */}
          <button
            onClick={() => fetchKeyStatus(true)}
            disabled={isTesting || isLoadingStatus}
            className="px-3.5 py-1.5 bg-[#1B1B22] hover:bg-[#252530] border border-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isTesting ? 'animate-spin text-amber-400' : 'text-slate-400'} />
            <span>{isTesting ? (isRtl ? 'در حال تست ارتباط...' : 'Testing...') : (isRtl ? 'تست زنده اتصال API Key' : 'Test Live Connection')}</span>
          </button>
        </div>

        {/* Test Result Log if run */}
        {testLog && (
          <div className={`mx-5 mt-3 p-3 rounded-xl border text-xs flex items-start gap-2.5 animate-fade-in ${
            testLog.success 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            {testLog.success ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-1">
              <div className="font-bold">{testLog.message}</div>
              {testLog.snippet && (
                <div className="font-mono text-[10px] opacity-80 bg-black/40 p-2 rounded border border-white/5">
                  تکه پاسخ دریافتی: {testLog.snippet}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tabs Bar */}
        <div className="px-5 pt-3 bg-[#111116] border-b border-[#22222B] flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2 text-xs font-black rounded-t-xl transition-all border-t border-x cursor-pointer flex items-center gap-2 ${
              activeTab === 'guide'
                ? 'bg-[#0D0D10] text-amber-400 border-amber-500/40 border-b-[#0D0D10]'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <HelpCircle size={14} />
            <span>{isRtl ? 'راهنمای ۳ گام فعال‌سازی' : '3-Step Setup Guide'}</span>
          </button>

          <button
            onClick={() => setActiveTab('capabilities')}
            className={`px-4 py-2 text-xs font-black rounded-t-xl transition-all border-t border-x cursor-pointer flex items-center gap-2 ${
              activeTab === 'capabilities'
                ? 'bg-[#0D0D10] text-amber-400 border-amber-500/40 border-b-[#0D0D10]'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Sparkles size={14} />
            <span>{isRtl ? 'قابلیت‌های متصل به هوش مصنوعی' : 'AI Capabilities'}</span>
          </button>

          <button
            onClick={() => setActiveTab('env')}
            className={`px-4 py-2 text-xs font-black rounded-t-xl transition-all border-t border-x cursor-pointer flex items-center gap-2 ${
              activeTab === 'env'
                ? 'bg-[#0D0D10] text-amber-400 border-amber-500/40 border-b-[#0D0D10]'
                : 'bg-transparent text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Terminal size={14} />
            <span>{isRtl ? 'تنظیمات .env و توسعه‌دهنده' : '.env Developer Config'}</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-6">

          {/* TAB 1: STEP-BY-STEP GUIDANCE */}
          {activeTab === 'guide' && (
            <div className="space-y-6 animate-fade-in">

              {/* Requirement Notice Box */}
              <div className="p-4 bg-gradient-to-r from-amber-500/10 via-[#181822] to-[#14141A] border border-amber-500/30 rounded-2xl relative overflow-hidden space-y-2">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl shrink-0 mt-0.5 border border-amber-500/30">
                    <Info size={20} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-amber-300">
                      {isRtl ? 'اطلاعیه مهم: نیاز موتورهای هوش مصنوعی پروژه به API Key' : 'Notice: AI Engines Require an API Key'}
                    </h3>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {isRtl
                        ? 'کلیه پردازش‌های هوشمند پروژه (اعم از پردازش اسناد PDF و Word، دستیار ارشد IATF 16949، سرممیزی VDA 6.3 و ماتریس الزامات مشتری) جهت ارتباط مستقیم با سرورهای پردازشی گوگل نیاز به تعیین کلید API دارند.'
                        : 'All project AI modules require a valid Gemini API Key to make live calls. When unconfigured, smart fallback algorithms provide baseline responses.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 3 Steps Visual Timeline */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <Sliders size={15} className="text-amber-500" />
                  <span>{isRtl ? 'مراحل گام به گام تنظیم و دریافت کلید API' : 'Step-by-Step Setup Guide'}</span>
                </h3>

                {/* Step 1 Card */}
                <div className="p-4 bg-[#14141A] border border-[#23232E] rounded-xl hover:border-amber-500/30 transition-all space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-amber-500 text-black font-black text-xs flex items-center justify-center shrink-0 shadow-md">
                        ۱
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-white">
                        {isRtl ? 'دریافت رایگان کلید API از پورتال رسمی Google AI Studio' : 'Get a Free API Key from Google AI Studio'}
                      </h4>
                    </div>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-400 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <span>{isRtl ? 'پورتال دریافت کلید' : 'Open Portal'}</span>
                      <ExternalLink size={13} />
                    </a>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed pr-10">
                    {isRtl
                      ? 'وارد اکانت گوگل خود در لینک فوق شوید، سپس روی دکمه "Create API Key" کلیک کنید. کلید تولید شده (که با عبارت AIzaSy شروع می‌شود) را کپی کنید.'
                      : 'Sign into your Google account, click "Create API key", and copy the generated key string starting with AIzaSy.'}
                  </p>
                </div>

                {/* Step 2 Card */}
                <div className="p-4 bg-[#14141A] border border-[#23232E] rounded-xl hover:border-amber-500/30 transition-all space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-amber-500 text-black font-black text-xs flex items-center justify-center shrink-0 shadow-md">
                      ۲
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-white">
                      {isRtl ? 'تنظیم کلید در پنل Secrets محیط AI Studio' : 'Configure Key in AI Studio Secrets Panel'}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed pr-10">
                    {isRtl
                      ? 'در بالای همین صفحه روی آیکون تنظیمات Settings (چرخ‌دنده) کلیک نموده، وارد زبانه Secrets شوید. نام متغیر را GEMINI_API_KEY قرار داده و کلید کپی‌شده را جای‌گذاری فرمایید.'
                      : 'Click the Settings gear icon in the AI Studio platform header, navigate to the Secrets tab, add variable GEMINI_API_KEY and paste your key.'}
                  </p>
                  <div className="pr-10">
                    <div className="p-3 bg-[#0B0B0E] border border-white/10 rounded-lg text-xs font-mono text-amber-300 flex items-center justify-between">
                      <span>Variable Name: GEMINI_API_KEY</span>
                      <button
                        onClick={() => handleCopyCode('GEMINI_API_KEY', 1)}
                        className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white cursor-pointer"
                        title="کپی اسم متغیر"
                      >
                        {copiedIndex === 1 ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 3 Card */}
                <div className="p-4 bg-[#14141A] border border-[#23232E] rounded-xl hover:border-amber-500/30 transition-all space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-amber-500 text-black font-black text-xs flex items-center justify-center shrink-0 shadow-md">
                      ۳
                    </span>
                    <h4 className="text-xs sm:text-sm font-black text-white">
                      {isRtl ? 'تنظیم در فایل .env (مخصوص سیستم‌های محلی و سرورهای Node)' : 'Configure in .env File for Local Development'}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed pr-10">
                    {isRtl
                      ? 'اگر پروژه را روی کامپیوتر شخصی یا سرور اختصاصی اجرا می‌کنید، فایل .env موجود در ریشه پروژه را باز کرده و کد زیر را جای‌گذاری نمایید:'
                      : 'If running locally or on a custom server, open the root .env file and add:'}
                  </p>
                  <div className="pr-10">
                    <div className="p-3 bg-[#0B0B0E] border border-white/10 rounded-lg text-xs font-mono text-emerald-400 flex items-center justify-between">
                      <span>GEMINI_API_KEY="AIzaSy_YOUR_SECRET_KEY_HERE"</span>
                      <button
                        onClick={() => handleCopyCode('GEMINI_API_KEY="AIzaSy_YOUR_SECRET_KEY_HERE"', 2)}
                        className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white cursor-pointer"
                        title="کپی"
                      >
                        {copiedIndex === 2 ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: AI CAPABILITIES LIST */}
          {activeTab === 'capabilities' && (
            <div className="space-y-4 animate-fade-in">
              <div className="p-3 bg-[#131318] border border-[#22222A] rounded-xl text-xs text-slate-300 leading-relaxed">
                {isRtl
                  ? 'این پروژه دارای چندین بخش پردازش هوش مصنوعی تخصصی در حوزه مدیریت کیفیت صنعت خودرو است که پس از ثبت کلید API فعال می‌شوند:'
                  : 'Key quality management AI capabilities unlocked by configuring GEMINI_API_KEY:'}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 bg-[#141419] border border-[#23232B] rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-black text-xs">
                    <Bot size={16} />
                    <span>{isRtl ? 'دستیار مشاور IATF 16949 و VDA' : 'IATF & VDA Senior Consultant'}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    پاسخ‌دهی به تمام پرسش‌های تخصصی، تحلیل 8D، طراحی ایده‌های خطاناشدنی‌سازی (Poka-Yoke) و ممیزی VDA 6.3.
                  </p>
                </div>

                <div className="p-4 bg-[#141419] border border-[#23232B] rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-blue-400 font-black text-xs">
                    <FileText size={16} />
                    <span>{isRtl ? 'استخراج اسناد PDF و Word اسناد کیفی' : 'PDF & Word Document Parser'}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    استخراج ۱۰۰٪ متون، الزامات خاص مشتری و کدهای IATF از فایل‌های PDF متنی یا اسناد Word (.docx).
                  </p>
                </div>

                <div className="p-4 bg-[#141419] border border-[#23232B] rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-black text-xs">
                    <ShieldCheck size={16} />
                    <span>{isRtl ? 'سرممیز هوشمند ممیزی‌های داخلی' : 'AI Internal Audit Supervisor'}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    تحلیل هوشمند چک‌لیست‌های ممیزی داخلی، ثبت شواهد فنی، تولید گزارش عدم انطباق‌ها (NC) و فرصت‌های بهبود (OFI).
                  </p>
                </div>

                <div className="p-4 bg-[#141419] border border-[#23232B] rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 font-black text-xs">
                    <Zap size={16} />
                    <span>{isRtl ? 'تحلیل ماتریس الزامات خاص مشتری (CSR)' : 'CSR Requirements Matrix'}</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    تطابق خودکار بند به بند الزامات خاص مشتریان (ساپکو، سازه‌گستر، کروز، و...) با زیربندهای مرجع IATF.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DEVELOPER & .ENV SPEC */}
          {activeTab === 'env' && (
            <div className="space-y-4 animate-fade-in text-xs">
              <div className="p-4 bg-[#0A0A0D] border border-white/10 rounded-xl space-y-2 font-mono">
                <div className="text-amber-400 font-bold flex items-center gap-2">
                  <Terminal size={15} />
                  <span>/.env.example</span>
                </div>
                <pre className="text-slate-300 bg-[#121216] p-3 rounded-lg overflow-x-auto text-[11px] leading-relaxed">
{`# GEMINI_API_KEY: Required for Gemini AI API calls.
# AI Studio automatically injects this at runtime from user secrets.
# Users configure this via the Secrets panel in the AI Studio UI.
GEMINI_API_KEY="AIzaSy_YOUR_ACTUAL_KEY_HERE"`}
                </pre>
              </div>

              <div className="p-4 bg-[#14141A] border border-[#22222A] rounded-xl space-y-2">
                <h4 className="font-black text-white text-xs">{isRtl ? 'نکات امنیتی کلید API' : 'API Key Security Guidelines'}</h4>
                <ul className="list-disc list-inside space-y-1 text-slate-300 text-xs leading-relaxed">
                  <li>کلید API به هیچ عنوان در مرورگر کاربر (Client-side) لود نمی‌شود و تمام فراخوانی‌ها از طریق سرور امن Node.js انجام می‌پذیرد.</li>
                  <li>هیچ کلید واقعی در گیت یا فایل‌های مخزن پروژه ذخیره نخواهد شد.</li>
                  <li>در صورت انقضا یا نامعتبر بودن کلید، سامانه بدون کرش کردن به طور هوشمند به حالت دمو سوئیچ می‌کند.</li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-[#25252E] bg-[#131318] flex items-center justify-between shrink-0 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <span>{isRtl ? 'راهنمای موتور هوش مصنوعی IATF 16949 QMS' : 'IATF 16949 QMS AI Engine Guide'}</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl transition-all shadow-md cursor-pointer"
          >
            {isRtl ? 'متوجه شدم و بستن' : 'Got it & Close'}
          </button>
        </div>

      </div>
    </div>
  );
}
