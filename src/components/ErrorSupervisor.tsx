import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ShieldAlert, AlertTriangle, Activity, X, Check, RefreshCw, Terminal, Sparkles, Siren, Flame, AlertCircle, Trash2 } from 'lucide-react';

export type ErrorSeverity = 'critical' | 'warning' | 'info';

export interface SupervisorLog {
  id: string;
  timestamp: string;
  category: string;
  title: string;
  message: string;
  stack?: string;
  severity: ErrorSeverity;
  module?: string;
  recommendation?: string;
}

interface ErrorSupervisorContextType {
  logs: SupervisorLog[];
  reportError: (title: string, message: string, severity?: ErrorSeverity, module?: string, stack?: string) => void;
  clearLogs: () => void;
  isTerminalOpen: boolean;
  setTerminalOpen: (open: boolean) => void;
  activeToast: SupervisorLog | null;
  setActiveToast: (toast: SupervisorLog | null) => void;
}

const ErrorSupervisorContext = createContext<ErrorSupervisorContextType | undefined>(undefined);

export function useErrorSupervisor() {
  const context = useContext(ErrorSupervisorContext);
  if (!context) {
    throw new Error('useErrorSupervisor must be used within an ErrorSupervisorProvider');
  }
  return context;
}

// Custom hook to automatically wrap async actions with error reporting
export function useRunnableAction() {
  const { reportError } = useErrorSupervisor();
  
  return useCallback(async <T extends unknown>(
    action: () => Promise<T>, 
    contextTitle: string, 
    moduleName: string,
    fallbackValue?: T
  ): Promise<T | undefined> => {
    try {
      return await action();
    } catch (err: any) {
      const msg = err?.message || String(err);
      const stack = err?.stack || '';
      reportError(contextTitle, msg, 'warning', moduleName, stack);
      return fallbackValue;
    }
  }, [reportError]);
}

export const ErrorSupervisorProvider: React.FC<{ children: React.ReactNode; isRtl: boolean }> = ({ children, isRtl }) => {
  const [logs, setLogs] = useState<SupervisorLog[]>(() => {
    try {
      const saved = localStorage.getItem('qms_supervisor_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  const [isTerminalOpen, setTerminalOpen] = useState(false);
  const [activeToast, setActiveToast] = useState<SupervisorLog | null>(null);

  // Persist logs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('qms_supervisor_logs', JSON.stringify(logs.slice(0, 100))); // Keep last 100
    } catch (e) {
      console.error('Failed to save supervisor logs', e);
    }
  }, [logs]);

  // Unified Error Repoter
  const reportError = useCallback((
    title: string, 
    message: string, 
    severity: ErrorSeverity = 'warning', 
    module = 'General',
    stack?: string
  ) => {
    // Ignore benign cross-origin script errors or platform layout notifications
    if (
      message.includes('Script error.') || 
      message.includes('Script error') || 
      title.includes('Script error') ||
      message.includes('ResizeObserver') ||
      message.includes('extension') ||
      title.includes('ResizeObserver')
    ) {
      return;
    }

    const timestamp = new Date().toLocaleTimeString('fa-IR', { hour12: false });
    
    // Get Persian smart action recommendation based on error context or type
    let recommendation = isRtl 
      ? 'لطفاً وضعیت اتصال شبکه را بررسی کرده یا ورودی‌ها را طبق ساختار IATF 16949 ویرایش کنید.'
      : 'Verify connection stability and check that fields correspond to IATF-16949 standards.';
      
    const lowerMessage = message.toLowerCase();
    const lowerTitle = title.toLowerCase();
    
    if (lowerMessage.includes('validation') || lowerTitle.includes('validation')) {
      recommendation = isRtl
        ? 'خطای اعتبارسنجی فرمت رخ داده است. مقادیر تهی یا خارج از دامنه مجاز (مانند امتیازهای غیر عددی یا زیر صفر) را تصحیح بفرمایید.'
        : 'Out-of-bound or null inputs detected. Correct the numeric ranges to prevent calculations skewing.';
    } else if (lowerMessage.includes('formula') || lowerMessage.includes('calculation') || lowerMessage.includes('rpn')) {
      recommendation = isRtl
        ? 'محاسبه متغیر ریسک با شکست مواجه شد. فرمول RPN بر اساس حاصلضرب (شدت × وقوع × تشخیص) را متناسب‌سازی کنید.'
        : 'Inconsistent formula multiplier. Check that S, O, D rates are within [1-10] and non-empty.';
    } else if (lowerMessage.includes('database') || lowerMessage.includes('sql') || lowerMessage.includes('store') || lowerMessage.includes('localstorage')) {
      recommendation = isRtl
        ? 'خطای واکشی یا ذخیره‌سازی محلی. فضای حافظه مرورگر را بازکرده یا کش‌های متداخل را بازنشانی کنید.'
        : 'Storage write failure. Check client storage quotas and clear obsolete browser cache sessions.';
    } else if (lowerMessage.includes('fetch') || lowerMessage.includes('network') || lowerMessage.includes('api')) {
      recommendation = isRtl
        ? 'سیستم موفق به ثبت درخواست با پایگاه داده یا سرور نشد. پهنای باند را کنترل نموده و دکمه تلاش مجدد را کلیک کنید.'
        : 'Remote sync failed. Network trace timed out. Verify your internet status or click the Retry button.';
    } else if (lowerMessage.includes('criteria') || lowerMessage.includes('excel') || lowerMessage.includes('parse')) {
      recommendation = isRtl
        ? 'فایل بارگذاری شده حاوی هدرهای نامعتبر بود. فایلی حاوی ستون‌های امتیازدهی (مانند Rating، Severity، شرح اثر) انتخاب کنید.'
        : 'The criteria spreadsheet layout holds abnormal headers. Please download the standard sheet structure and re-upload.';
    }

    const newLog: SupervisorLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp,
      category: severity === 'critical' ? 'CRITICAL_FAULT' : severity === 'warning' ? 'OPERATIONAL_WARN' : 'RUNTIME_TELEMETRY',
      title,
      message,
      stack,
      severity,
      module,
      recommendation
    };

    setLogs(prev => [newLog, ...prev]);
    setActiveToast(newLog);

    // Auto dismiss toast after 9 seconds of warning
    setTimeout(() => {
      setActiveToast(current => current?.id === newLog.id ? null : current);
    }, 9000);
  }, [isRtl]);

  const clearLogs = useCallback(() => {
    setLogs([]);
    localStorage.removeItem('qms_supervisor_logs');
  }, []);

  // Global Handlers
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      // Prevent infinite loops on own logging
      if (event.filename && event.filename.includes('ErrorSupervisor')) return;
      
      // Ignore cross-origin third-party script errors, benign ResizeObserver notifications, or extension noise
      const msg = event.message || '';
      const filename = event.filename || '';
      if (
        !msg ||
        msg.includes('Script error') ||
        msg.includes('ResizeObserver') ||
        !filename ||
        filename.includes('extension') ||
        event.lineno === 0
      ) {
        return;
      }
      
      reportError(
        isRtl ? 'خطای ثبت نشده در لایه اسکریپت' : 'Uncaught Script Execution Fault',
        msg || 'Unknown runtime anomaly',
        'critical',
        'EngineModule',
        event.error?.stack || ''
      );
    };

    const handlePromiseRejection = (event: PromiseRejectionEvent) => {
      const reasonMsg = event.reason?.message || String(event.reason || '');
      if (
        !reasonMsg ||
        reasonMsg.includes('Script error') ||
        reasonMsg.includes('extension') ||
        reasonMsg.includes('ResizeObserver')
      ) {
        return;
      }
      reportError(
        isRtl ? 'خطای پاسخ ناموفق در عملیات پس‌زمینه' : 'Unhandled Unresolved Promise Rejection',
        reasonMsg || 'Promise rejected with no detailed reason',
        'warning',
        'AsyncWorker',
        event.reason?.stack || ''
      );
    };

    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      
      const btn = target.closest('button, a, [role="button"]') as HTMLElement | null;
      if (!btn) return;
      
      if (btn.hasAttribute('disabled') || btn.classList.contains('cursor-not-allowed') || btn.hasAttribute('data-action-allowed')) return;
      
      const btnText = (btn.innerText || btn.textContent || '').trim();
      const hasHref = btn.tagName === 'A' && btn.getAttribute('href');
      const isPlaceholderLink = btn.tagName === 'A' && (hasHref === '#' || hasHref === 'javascript:void(0)' || !hasHref);
      
      if (isPlaceholderLink || btn.classList.contains('inactive') || btnText.includes('تکمیل نشده') || btnText.includes('غیر فعال')) {
        e.preventDefault();
        reportError(
          isRtl ? 'سامانه هوشمند مهار کلیک‌های نامعتبر' : 'Aegis Intelligent Dead-Click Deflector',
          isRtl 
            ? `کلیک روی بخش غیرفعال یا تکمیل‌نشده «${btnText || 'لینک فرعی'}» با موفقیت توسط سیستم نظارتی مهار شد. این رخداد در کارتابل عیب‌یابی ثبت گردید تا از تکرار مجدد چنین رفتارهایی جلوگیری شود.`
            : `Click on inactive or unfinished segment '${btnText || 'placeholder'}' intercepted. Event logged in Supervisor.`,
          'info',
          'AegisGuard'
        );
      }
    };

    // Override fetch to automatically log remote failure syncs gracefully without breaking app performance
    const originalFetch = window.fetch;
    let fetchOverridden = false;
    
    try {
      const desc = Object.getOwnPropertyDescriptor(window, 'fetch');
      if (!desc || desc.writable || desc.set) {
        window.fetch = async function(...args) {
          const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url || '';
          if (url.includes('3050') || url.includes('localhost:3050') || url.includes('127.0.0.1:3050')) {
            return originalFetch.apply(this, args);
          }
          try {
            const response = await originalFetch.apply(this, args);
            if (!response.ok) {
              const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url || 'API';
              reportError(
                isRtl ? `پیام تداخل سرور: ${response.status}` : `Server Interface Desync: ${response.status}`,
                isRtl ? `درگاه فراخوانی ${url} با خطا مواجه شد.` : `API call to endpoint '${url}' returned status code ${response.status}.`,
                'warning',
                'NetworkSync'
              );
            }
            return response;
          } catch (err: any) {
            reportError(
              isRtl ? 'عدم امکان برقراری ارتباط با وب‌سرویس' : 'Endpoint Connectivity Interrupted',
              err?.message || String(err),
              'warning',
              'NetworkSync'
            );
            throw err;
          }
        };
        fetchOverridden = true;
      }
    } catch (err) {
      console.warn('Unable to patch window.fetch in this read-only or restricted environment:', err);
    }

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handlePromiseRejection);
    window.addEventListener('click', handleGlobalClick);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handlePromiseRejection);
      window.removeEventListener('click', handleGlobalClick);
      if (fetchOverridden) {
        try {
          window.fetch = originalFetch; // restore
        } catch {}
      }
    };
  }, [reportError, isRtl]);

  return (
    <ErrorSupervisorContext.Provider value={{
      logs,
      reportError,
      clearLogs,
      isTerminalOpen,
      setTerminalOpen,
      activeToast,
      setActiveToast
    }}>
      {children}

      {/* Global Interactive Notification Toaster */}
      {activeToast && (
        <div 
          className="fixed bottom-12 right-4 sm:right-6 lg:right-8 z-[1000] max-w-sm sm:max-w-md bg-[#0b0c0e] border border-amber-500/50 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-3.5 text-right animate-in slide-in-from-bottom duration-300"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
              activeToast.severity === 'critical' 
                ? 'bg-red-500/10 text-red-500 border border-red-500/25 animate-bounce' 
                : 'bg-amber-500/10 text-amber-500 border border-amber-500/25 animate-pulse'
            }`}>
              {activeToast.severity === 'critical' ? <Flame size={18} /> : <Siren size={18} />}
            </div>
            <div className="flex-1 space-y-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                  activeToast.severity === 'critical' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-500'
                }`}>
                  {activeToast.category}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">{activeToast.timestamp}</span>
              </div>
              <h4 className="text-zinc-150 font-black text-xs leading-tight text-white pr-1">
                {activeToast.title}
              </h4>
              <p className="text-[10.5px] text-zinc-400 leading-relaxed truncate-2-lines break-all pr-1">
                {activeToast.message}
              </p>
              
              <div className="pt-1 select-none flex items-center justify-between">
                <button
                  onClick={() => setTerminalOpen(true)}
                  className="text-[9.5px] text-amber-500 hover:text-amber-400 font-black flex items-center gap-1 cursor-pointer transition-all hover:underline"
                >
                  <Terminal size={11} />
                  <span>{isRtl ? '🔎 باز نمودن اتاق کنترل خطاها و تحلیل علت' : '🔎 Open Interactive Cause & Resolution Terminal'}</span>
                </button>
                <span className="text-[9px] text-zinc-600 font-mono">[{activeToast.module}]</span>
              </div>
            </div>
            
            <button 
              onClick={() => setActiveToast(null)}
              className="text-zinc-500 hover:text-zinc-350 p-1 rounded hover:bg-zinc-800 transition-all cursor-pointer shrink-0"
              title={isRtl ? 'بستن پیام' : 'Dismiss'}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Embedded Terminal Dashboard overlay */}
      {isTerminalOpen && (
        <div 
          className="fixed inset-0 z-[1100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-hidden animate-fade-in"
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          <div className="bg-[#09090b] border-2 border-[#1c1c1f] w-full max-w-4xl h-full max-h-[85vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl relative select-none">
            
            {/* Header */}
            <header className="bg-[#111114] border-b border-[#202023] p-4 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center">
                  <Activity size={20} className="className-rotating animate-pulse" />
                </div>
                <div>
                  <h1 className="text-xs sm:text-sm font-black text-white tracking-wider flex items-center gap-1.5 string-shimmer">
                    <span>{isRtl ? 'هسته مرکزی مانیتورینگ خطاها و پایش فعالیت‌ها' : 'Central Global Error & Operation Supervisor Hub'}</span>
                    <span className="text-[9px] bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded border border-red-500/20 font-black">SUPERVISOR LIVE</span>
                  </h1>
                  <p className="text-[9.5px] text-zinc-500 mt-1">
                    {isRtl 
                      ? 'سیستم هوشمند پایش برخط عملکرد، تحلیل علل ریشه‌ای خطاها و ارائه پیشنهادات پیشگیرانه' 
                      : 'Real-time validation tracking, telemetry failure traps, and proactive resolution logic'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setTerminalOpen(false)}
                className="hover:bg-zinc-800 text-zinc-400 hover:text-white px-3 py-1.5 rounded-xl border border-transparent hover:border-zinc-700 transition-all cursor-pointer font-bold text-xs"
              >
                {isRtl ? 'بستن پنجره ✕' : 'Close Terminal ✕'}
              </button>
            </header>

            {/* Logs Body */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-[#070709] space-y-3">
              {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 text-lg">
                    <Check size={22} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-zinc-150 font-black text-xs leading-normal text-white">
                      {isRtl ? 'سازمان در وضعیت سبز و بدون خطا قرار داد' : 'Workspace completely healthy.'}
                    </h3>
                    <p className="text-[10px] text-zinc-500 mt-1 max-w-[340px] leading-relaxed mx-auto">
                      {isRtl 
                        ? 'تمام ماژول‌ها، ممیزی‌ها، ابزارهای FMEA و اتصالات شبکه به خوبی کار می‌کنند. هیچ عیبی توسط هسته هوشمند مانیتورینگ ثبت نگردیده است.'
                        : 'No exceptions or failure reports registered. The global IATF workspace is currently in active state.'}
                    </p>
                  </div>
                </div>
              ) : (
                logs.map((log) => (
                  <div 
                    key={log.id}
                    className={`p-3.5 rounded-xl border text-right transition-all group ${
                      log.severity === 'critical'
                        ? 'bg-red-500/5 border-red-500/25 shadow-sm'
                        : 'bg-[#101013] border-[#1d1d21]'
                    }`}
                  >
                    {/* Log status meta */}
                    <div className="flex items-center justify-between border-b border-[#1c1c1f] pb-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 text-[9px] font-black rounded ${
                          log.severity === 'critical' 
                            ? 'bg-red-500/20 text-red-500' 
                            : 'bg-amber-500/20 text-amber-500'
                        }`}>
                          {log.category}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">[{log.module}]</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono font-bold">{log.timestamp}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-zinc-100 font-black text-xs group-hover:text-amber-400 transition-colors duration-150">
                      {log.title}
                    </h3>

                    {/* Message detail */}
                    <p className="text-[11px] text-zinc-400 mt-1.5 leading-relaxed font-mono font-medium select-text break-all">
                      {log.message}
                    </p>

                    {/* Recommendations Block */}
                    {log.recommendation && (
                      <div className="mt-3 p-2.5 bg-[#0a0a0c] border border-white/[0.04] rounded-lg">
                        <div className="flex items-center gap-1 text-[10px] text-green-400 font-black mb-1">
                          <Sparkles size={11} className="animate-spin duration-3000" />
                          <span>{isRtl ? 'راهکار رفع ناهماهنگی مانیتور:' : 'Proactive Target Resolution:'}</span>
                        </div>
                        <p className="text-[10.5px] text-zinc-300 leading-normal font-sans font-bold">
                          {log.recommendation}
                        </p>
                      </div>
                    )}

                    {/* Internal stack detail if available */}
                    {log.stack && (
                      <div className="mt-2 text-[9.5px] text-zinc-600 bg-black/60 p-2 rounded border border-white/[0.01] overflow-x-auto font-mono max-h-24 select-text">
                        {log.stack}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Footer Control Panel */}
            <footer className="bg-[#111114] border-t border-[#1e1e21] p-3 flex justify-between items-center shrink-0 select-none">
              <span className="text-[10px] text-zinc-500 font-bold">
                {isRtl 
                  ? `تعداد بارهای پایش کل پروژه: ${logs.length} مورد` 
                  : `Telemetry items: ${logs.length}`}
              </span>
              <button
                onClick={clearLogs}
                className="p-1 px-3 text-[10px] font-black bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-rose-400 rounded-lg shrink-0 flex items-center gap-1 transition-all cursor-pointer"
              >
                <Trash2 size={11} />
                <span>{isRtl ? 'پاک‌سازی تمام تاریخچه مانیتورینگ' : 'Flush Log Buffer'}</span>
              </button>
            </footer>

          </div>
        </div>
      )}
    </ErrorSupervisorContext.Provider>
  );
};
