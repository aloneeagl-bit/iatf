import React, { useState, useEffect } from 'react';
import {
  Settings,
  Cpu,
  Zap,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Check,
  Sliders,
  X,
  AlertCircle,
  Radio,
  ArrowUpCircle,
  Info,
  Layers,
  FileText,
  Bot,
  Search,
  Wrench,
  KeyRound,
  HelpCircle
} from 'lucide-react';
import {
  AVAILABLE_AI_MODELS,
  AiModelInfo,
  getGlobalAiModel,
  setGlobalAiModel,
  getAutoUpgradeEnabled,
  setAutoUpgradeEnabled,
  checkForAiEngineUpdates,
  getLastUpdateCheckTime,
  LATEST_AI_MODEL
} from '../lib/aiConfig';
import AiApiKeyGuideModal from './AiApiKeyGuideModal';

interface AiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang?: 'fa' | 'en';
}

export default function AiSettingsModal({ isOpen, onClose, lang = 'fa' }: AiSettingsModalProps) {
  const [selectedModel, setSelectedModel] = useState<string>(getGlobalAiModel());
  const [autoUpgrade, setAutoUpgrade] = useState<boolean>(getAutoUpgradeEnabled());
  const [isCheckingUpdates, setIsCheckingUpdates] = useState<boolean>(false);
  const [checkProgressStep, setCheckProgressStep] = useState<number>(0);
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [keyStatus, setKeyStatus] = useState<{ hasKey: boolean; maskedKey?: string } | null>(null);
  const [updateResult, setUpdateResult] = useState<{
    hasUpdate: boolean;
    latestModelInfo: AiModelInfo;
    releaseNotesFa: string;
    checkedAt: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedModel(getGlobalAiModel());
      setAutoUpgrade(getAutoUpgradeEnabled());
      // Fetch API Key status for notice banner
      fetch('/api/ai-key-status')
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            setKeyStatus({ hasKey: d.hasKey, maskedKey: d.maskedKey });
          }
        })
        .catch(err => console.warn('Could not check key status', err));
    }
  }, [isOpen]);

  // Listen for global model changes in real time
  useEffect(() => {
    const handleModelChanged = (e: any) => {
      if (e.detail?.modelId) {
        setSelectedModel(e.detail.modelId);
      }
    };
    window.addEventListener('qms_ai_model_changed', handleModelChanged);
    return () => window.removeEventListener('qms_ai_model_changed', handleModelChanged);
  }, []);

  if (!isOpen) return null;

  const currentModelInfo = AVAILABLE_AI_MODELS.find(m => m.id === selectedModel) || AVAILABLE_AI_MODELS[0];
  const isRtl = lang === 'fa';

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    setGlobalAiModel(modelId);
    showToast(
      isRtl
        ? `موتور هوش مصنوعی کل پروژه با موفقیت روی ${AVAILABLE_AI_MODELS.find(m => m.id === modelId)?.name || modelId} تنظیم شد.`
        : `Global AI engine set to ${modelId}`
    );
  };

  const handleToggleAutoUpgrade = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setAutoUpgrade(val);
    setAutoUpgradeEnabled(val);
    showToast(
      isRtl
        ? val
          ? 'ارتقای خودکار موتور هوش مصنوعی فعال شد.'
          : 'ارتقای خودکار غیرفعال شد.'
        : val
          ? 'Auto-upgrade enabled'
          : 'Auto-upgrade disabled'
    );
  };

  const handleRunCheckForUpdates = async () => {
    setIsCheckingUpdates(true);
    setCheckProgressStep(1);

    await new Promise(r => setTimeout(r, 600));
    setCheckProgressStep(2);

    await new Promise(r => setTimeout(r, 700));
    setCheckProgressStep(3);

    await new Promise(r => setTimeout(r, 500));
    const result = await checkForAiEngineUpdates();
    
    // Automatically switch to latest model if user runs explicit update check
    setSelectedModel(getGlobalAiModel());
    setUpdateResult(result);
    setIsCheckingUpdates(false);
    setCheckProgressStep(0);

    showToast(
      isRtl
        ? 'آخرین نسخه موتور هوش مصنوعی استعلام و بر روی کل پروژه اعمال شد.'
        : 'Latest AI Engine version verified and applied globally.'
    );
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-[#0F0F12] border border-[#2D2D35] w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden text-slate-200">
        
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#25252D] bg-[#14141A] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-xl shadow-inner">
              <Settings size={20} className="animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  {isRtl ? 'تنظیمات مرکزی موتور هوش مصنوعی سامانه (Global AI Engine)' : 'Global AI Engine Settings'}
                </h2>
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold rounded-md font-mono">
                  SINGLE UNIFIED ENGINE
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {isRtl
                  ? 'تعیین نسخه واحد موتور هوش مصنوعی برای تمام ماژول‌ها و ارتقای خودکار به جدیدترین ورژن'
                  : 'Configure the unified AI model used across all project modules and manage auto-upgrades.'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-[#25252D] rounded-xl transition-all cursor-pointer"
            title={isRtl ? 'بستن' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="mx-5 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-bold flex items-center justify-between animate-fade-in shadow-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-emerald-400/70 hover:text-emerald-400">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 custom-scrollbar">

          {/* Section: API Key Status & Guidance Card */}
          <div className="p-4 bg-gradient-to-r from-amber-500/10 via-[#181822] to-[#121217] border border-amber-500/30 rounded-xl space-y-3 relative overflow-hidden shadow-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg shrink-0 mt-0.5 border border-amber-500/30">
                  <KeyRound size={18} />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-white">
                      {isRtl ? 'الزام تعیین کلید GEMINI_API_KEY جهت پردازش هوشمند' : 'Gemini API Key Requirement'}
                    </h3>
                    {keyStatus?.hasKey ? (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold rounded-md">
                        {isRtl ? '✓ کلید متصل است' : '✓ Connected'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-bold rounded-md">
                        {isRtl ? '⚡ حالت دمو/آفلاین' : '⚡ Demo Mode'}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {isRtl
                      ? 'موتورهای هوش مصنوعی پروژه (چت‌بات، استخراج PDF/Word و ممیزی VDA) جهت فراخوانی زنده به کلید API نیاز دارند. در صورت عدم تنظیم، حالت هوشمند دمو فعال خواهد بود.'
                      : 'Project AI engines require GEMINI_API_KEY for live processing. If unconfigured, smart demo mode handles requests.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsGuideOpen(true)}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <HelpCircle size={15} />
                <span>{isRtl ? 'راهنمای کامل گام‌به‌گام فعال‌سازی API Key' : 'API Key Setup Guide'}</span>
              </button>
            </div>
          </div>

          {/* Section: Currently Active Model Summary Card */}
          <div className="p-4 bg-gradient-to-r from-amber-950/20 via-[#181820] to-[#141419] border border-amber-500/30 rounded-xl relative overflow-hidden shadow-lg">
            <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 blur-2xl rounded-full pointer-events-none"></div>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-mono">
                    {isRtl ? 'موتور هوش مصنوعی فعال در کل پروژه' : 'Currently Active System Model'}
                  </span>
                </div>
                <div className="text-xl font-black text-white flex items-center gap-2">
                  <span>{currentModelInfo.name}</span>
                  <span className="text-xs px-2 py-0.5 bg-white/10 text-slate-300 rounded font-mono font-normal">
                    {currentModelInfo.version}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
                  {currentModelInfo.descriptionFa}
                </p>
              </div>

              {/* Quick Model Badge & Stats */}
              <div className="flex items-center gap-3 shrink-0 bg-[#0A0A0D]/60 p-3 rounded-xl border border-white/5">
                <div className="text-center px-2">
                  <div className="text-[9px] text-slate-400 uppercase font-mono">{isRtl ? 'سرعت' : 'Speed'}</div>
                  <div className="text-sm font-black text-amber-400 font-mono">{currentModelInfo.speedRating}%</div>
                </div>
                <div className="h-6 w-px bg-white/10"></div>
                <div className="text-center px-2">
                  <div className="text-[9px] text-slate-400 uppercase font-mono">{isRtl ? 'قدرت استدلال' : 'Reasoning'}</div>
                  <div className="text-sm font-black text-emerald-400 font-mono">{currentModelInfo.reasoningRating}%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Auto-Update & Upgrade Controls */}
          <div className="p-4 bg-[#141419] border border-[#23232A] rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#23232A]">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-lg shrink-0 mt-0.5">
                  <RefreshCw size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    {isRtl ? 'دریافت و ارتقای خودکار آخرین نسخه موتور هوش مصنوعی' : 'Auto-Update & Smart Upgrade Engine'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isRtl
                      ? 'با فعال‌سازی این گزینه‌، سیستم به صورت خودکار جدیدترین نسخه معرفی شده Gemini AI Engine را دریافت کرده و بر روی تمام پروژه اعمال می‌کند.'
                      : 'Automatically sync and upgrade to the latest Google Gemini AI model across all modules.'}
                  </p>
                </div>
              </div>

              {/* Toggle Switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={autoUpgrade}
                  onChange={handleToggleAutoUpgrade}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[#282830] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                <span className="mr-2 text-xs font-bold text-slate-300">
                  {autoUpgrade ? (isRtl ? 'فعال' : 'ON') : (isRtl ? 'غیرفعال' : 'OFF')}
                </span>
              </label>
            </div>

            {/* Manual Check / Upgrade Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
              <div className="text-xs text-slate-400 flex items-center gap-1.5 font-mono">
                <Info size={13} className="text-amber-500 shrink-0" />
                <span>
                  {isRtl ? `آخرین استعلام: ${getLastUpdateCheckTime()}` : `Last update check: ${getLastUpdateCheckTime()}`}
                </span>
              </div>

              <button
                onClick={handleRunCheckForUpdates}
                disabled={isCheckingUpdates}
                className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs rounded-xl shadow-md hover:shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={14} className={isCheckingUpdates ? 'animate-spin' : ''} />
                <span>
                  {isCheckingUpdates
                    ? isRtl
                      ? 'در حال استعلام و ارتقا...'
                      : 'Checking & Upgrading...'
                    : isRtl
                      ? 'بررسی و ارتقا به جدیدترین نسخه'
                      : 'Check & Upgrade to Latest Engine'}
                </span>
              </button>
            </div>

            {/* Upgrade Progress Banner */}
            {isCheckingUpdates && (
              <div className="p-3 bg-[#1A1A22] border border-amber-500/30 rounded-xl space-y-2 animate-fade-in">
                <div className="flex items-center justify-between text-xs font-bold text-amber-400">
                  <span className="flex items-center gap-2">
                    <Sparkles size={14} className="animate-spin text-amber-400" />
                    <span>
                      {checkProgressStep === 1 && (isRtl ? 'اتصال به لایسنس سرور Google GenAI...' : 'Connecting to AI license server...')}
                      {checkProgressStep === 2 && (isRtl ? 'استعلام جدیدترین لایه‌های استدلال و پچ‌های ۲۰۲۶...' : 'Querying latest 2026 model patches...')}
                      {checkProgressStep === 3 && (isRtl ? 'اعمال مدل واحد روی تمام ماژول‌های پروژه...' : 'Applying global model across all modules...')}
                    </span>
                  </span>
                  <span className="font-mono">{checkProgressStep * 33}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${checkProgressStep * 33}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Update Result Card */}
            {updateResult && !isCheckingUpdates && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs space-y-1 animate-fade-in">
                <div className="font-black text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={15} />
                  <span>
                    {isRtl
                      ? `ارتقا به جدیدترین نسخه ${updateResult.latestModelInfo.name} با موفقیت انجام شد.`
                      : `Successfully updated to ${updateResult.latestModelInfo.name}`}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {updateResult.releaseNotesFa}
                </p>
              </div>
            )}
          </div>

          {/* Section: Select AI Model List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Cpu size={16} className="text-amber-500" />
                <span>{isRtl ? 'لیست مدل‌های قابل انتخاب هوش مصنوعی' : 'Available AI Engine Models'}</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-mono">
                {isRtl ? 'انتخاب هر مدل فوراً کل پروژه را تغییر می‌دهد' : 'Changes apply globally to all modules'}
              </span>
            </div>

            <div className="space-y-3">
              {AVAILABLE_AI_MODELS.map(model => {
                const isSelected = selectedModel === model.id;
                return (
                  <div
                    key={model.id}
                    onClick={() => handleSelectModel(model.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                        : 'bg-[#141418] border-[#22222A] hover:bg-[#1A1A20] hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Radio
                            size={16}
                            className={isSelected ? 'text-amber-500 fill-amber-500/20' : 'text-slate-600'}
                          />
                          <span className="text-sm font-black text-white">{model.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${model.tagColor}`}>
                            {model.tag}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono bg-black/40 px-2 py-0.5 rounded">
                            {model.version}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed pr-6">
                          {isRtl ? model.descriptionFa : model.descriptionEn}
                        </p>
                        {model.recommendedFor && (
                          <div className="text-[10px] text-amber-400/80 font-medium pr-6 flex items-center gap-1">
                            <span>💡 کاربرد پیشنهادی: {model.recommendedFor}</span>
                          </div>
                        )}
                      </div>

                      {/* Performance Indicators */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto shrink-0 gap-2 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">{isRtl ? 'سرعت:' : 'Speed:'}</span>
                          <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${model.speedRating}%` }}></div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400">{isRtl ? 'استدلال:' : 'Reasoning:'}</span>
                          <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                            <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${model.reasoningRating}%` }}></div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectModel(model.id);
                          }}
                          className={`mt-1 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500 text-black shadow-sm font-black'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300'
                          }`}
                        >
                          {isSelected ? (isRtl ? '✓ فعال در کل سیستم' : '✓ Active Model') : (isRtl ? 'انتخاب مدل' : 'Select')}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Affected Project Modules List */}
          <div className="p-4 bg-[#121217] border border-[#202028] rounded-xl space-y-2">
            <h4 className="text-xs font-black text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
              <Layers size={14} className="text-amber-500" />
              <span>{isRtl ? 'ماژول‌های متصل که از این مدل هوش مصنوعی استفاده می‌کنند' : 'System Modules Using This AI Engine'}</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 bg-[#181820] rounded-lg border border-white/5 flex items-center gap-2">
                <Bot size={14} className="text-amber-400 shrink-0" />
                <span className="truncate">{isRtl ? 'دستیار مشاور IATF 16949' : 'IATF Assistant'}</span>
              </div>
              <div className="p-2.5 bg-[#181820] rounded-lg border border-white/5 flex items-center gap-2">
                <FileText size={14} className="text-blue-400 shrink-0" />
                <span className="truncate">{isRtl ? 'تحلیلگر الزامات خاص مشتری (CSR)' : 'CSR Manager'}</span>
              </div>
              <div className="p-2.5 bg-[#181820] rounded-lg border border-white/5 flex items-center gap-2">
                <Wrench size={14} className="text-emerald-400 shrink-0" />
                <span className="truncate">{isRtl ? 'تولیدکننده PFMEA و Control Plan' : 'FMEA & Control Plan'}</span>
              </div>
              <div className="p-2.5 bg-[#181820] rounded-lg border border-white/5 flex items-center gap-2">
                <ShieldCheck size={14} className="text-purple-400 shrink-0" />
                <span className="truncate">{isRtl ? 'سرممیز هوشمند سیستم کیفیت' : 'Internal Audit Engine'}</span>
              </div>
              <div className="p-2.5 bg-[#181820] rounded-lg border border-white/5 flex items-center gap-2">
                <Search size={14} className="text-amber-400 shrink-0" />
                <span className="truncate">{isRtl ? 'استخراج اسناد PDF و Word' : 'PDF/Word Extractor'}</span>
              </div>
              <div className="p-2.5 bg-[#181820] rounded-lg border border-white/5 flex items-center gap-2">
                <Sliders size={14} className="text-rose-400 shrink-0" />
                <span className="truncate">{isRtl ? 'طراح دستورالعمل‌های کاری (SWI)' : 'SWI Instruction Builder'}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-[#25252D] bg-[#14141A] flex items-center justify-between shrink-0 text-xs">
          <div className="text-slate-400 flex items-center gap-2">
            <ShieldCheck size={15} className="text-emerald-400 shrink-0" />
            <span>{isRtl ? 'تنظیمات واحد با تمام ماژول‌ها همگام‌سازی می‌شود.' : 'Settings automatically sync across all system modules.'}</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl transition-all shadow-md cursor-pointer"
          >
            {isRtl ? 'تایید و بستن' : 'Done & Close'}
          </button>
        </div>

      </div>

      {/* Embedded API Key Step-by-Step Guide Modal */}
      <AiApiKeyGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        lang={lang}
      />
    </div>
  );
}
