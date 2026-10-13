export interface AiModelInfo {
  id: string;
  name: string;
  version: string;
  releaseDate: string;
  descriptionFa: string;
  descriptionEn: string;
  speedRating: number;
  reasoningRating: number;
  tag: string;
  tagColor: string;
  isLatest?: boolean;
  recommendedFor?: string;
}

export const AVAILABLE_AI_MODELS: AiModelInfo[] = [
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    version: 'v3.6.0-stable',
    releaseDate: 'ژوئن ۲۰۲۶ (جدیدترین)',
    descriptionFa: 'موتور ارشد و جدیدترین پرچمدار هوش مصنوعی با استدلال فوق‌العاده عمیق، سرعت پردازش دوبرابر و انطباق کامل با الزامات IATF 16949:2016 و استاندارد VDA',
    descriptionEn: 'Flagship AI engine with ultra-fast speed, deep reasoning for IATF 16949 and VDA 6.3 standards.',
    speedRating: 98,
    reasoningRating: 98,
    tag: 'پرچمدار اصلی / پیشنهاد اول',
    tagColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    isLatest: true,
    recommendedFor: 'تمام بخش‌های سیستم کیفیت، تحلیل FMEA، ممیزی و چت'
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash (Auto-Updating Latest)',
    version: 'rolling-latest-release',
    releaseDate: 'به‌روزرسانی پیوسته',
    descriptionFa: 'ارجاع خودکار دائم به جدیدترین نسخه معرفی شده توسط گوگل بدون نیاز به تغییر دستی تنظیمات',
    descriptionEn: 'Auto-rolling pointer to the latest production release by Google Cloud AI Studio.',
    speedRating: 100,
    reasoningRating: 99,
    tag: 'ارتقای دائم هوشمند',
    tagColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    isLatest: true,
    recommendedFor: 'دریافت همیشگی آخرین آپدیت‌ها به صورت خودکار'
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    version: 'v3.1.0-pro',
    releaseDate: 'مه ۲۰۲۶',
    descriptionFa: 'موتور استدلال سنگین و محاسباتی برای آنالیزهای ریاضی پیچیده، خطایابی ریشه‌ای 8D و تحلیل نمره Cpk/Ppk',
    descriptionEn: 'Heavy computational reasoning engine for complex 8D root-cause and statistical quality analysis.',
    speedRating: 85,
    reasoningRating: 100,
    tag: 'استدلال پیشرفته',
    tagColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    isLatest: false,
    recommendedFor: 'محاسبات پیشرفته SPC و تحلیل ریشه‌ای 8D'
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    version: 'v3.1.0-lite',
    releaseDate: 'آوریل ۲۰۲۶',
    descriptionFa: 'موتور سبک و فوق‌سریع برای خلاصه‌سازی آنی، خواندن سریع اسناد PDF/Word و پاسخ‌دهی لحظه‌ای',
    descriptionEn: 'Ultra-lightweight engine for instant PDF/Word text parsing and rapid summaries.',
    speedRating: 100,
    reasoningRating: 88,
    tag: 'سرعت فوق‌العاده',
    tagColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    isLatest: false,
    recommendedFor: 'استخراج متون PDF و خلاصه‌سازی سریع'
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    version: 'v3.5.0-standard',
    releaseDate: 'دسامبر ۲۰۲۵',
    descriptionFa: 'نسخه استاندارد پیشین سیستم برای کارهای متنی عمومی و پاسخ‌دهی به سوالات کاتالوگ IATF',
    descriptionEn: 'Standard baseline model for general document processing and IATF clause consultation.',
    speedRating: 90,
    reasoningRating: 90,
    tag: 'نسخه عمومی',
    tagColor: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    isLatest: false,
    recommendedFor: 'پاسخ‌دهی عمومی و اسناد استاندارد'
  }
];

export const DEFAULT_AI_MODEL = 'gemini-3.6-flash';
export const LATEST_AI_MODEL = 'gemini-3.6-flash';

const LOCAL_STORAGE_KEY_MODEL = 'qms_global_ai_model';
const LOCAL_STORAGE_KEY_AUTO_UPGRADE = 'qms_ai_auto_upgrade_enabled';
const LOCAL_STORAGE_KEY_LAST_CHECK = 'qms_ai_last_update_check';

export function getGlobalAiModel(): string {
  if (typeof window === 'undefined') return DEFAULT_AI_MODEL;
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_MODEL);
    if (saved && AVAILABLE_AI_MODELS.some(m => m.id === saved)) {
      return saved;
    }
  } catch (e) {
    console.error('Failed to read AI model from localStorage', e);
  }
  return DEFAULT_AI_MODEL;
}

export function setGlobalAiModel(modelId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_MODEL, modelId);
    // Dispatch custom event to notify all components in the tab
    window.dispatchEvent(new CustomEvent('qms_ai_model_changed', { detail: { modelId } }));

    // Sync with server as well
    fetch('/api/ai-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: modelId, autoUpgrade: getAutoUpgradeEnabled() })
    }).catch(err => console.warn('Could not sync AI model to server:', err));

  } catch (e) {
    console.error('Failed to set AI model in localStorage', e);
  }
}

export function getAutoUpgradeEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_AUTO_UPGRADE);
    if (saved !== null) {
      return saved === 'true';
    }
  } catch (e) {}
  return true; // Default to true
}

export function setAutoUpgradeEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY_AUTO_UPGRADE, String(enabled));
    // Sync with server
    fetch('/api/ai-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: getGlobalAiModel(), autoUpgrade: enabled })
    }).catch(err => console.warn('Could not sync AI autoUpgrade to server:', err));
  } catch (e) {}
}

export function getLastUpdateCheckTime(): string {
  if (typeof window === 'undefined') return '—';
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY_LAST_CHECK);
    if (saved) return saved;
  } catch (e) {}
  return '—';
}

export async function checkForAiEngineUpdates(): Promise<{
  hasUpdate: boolean;
  currentModel: string;
  latestModel: string;
  latestModelInfo: AiModelInfo;
  releaseNotesFa: string;
  checkedAt: string;
}> {
  const current = getGlobalAiModel();
  const latestInfo = AVAILABLE_AI_MODELS.find(m => m.id === LATEST_AI_MODEL) || AVAILABLE_AI_MODELS[0];
  const nowStr = new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
  
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_LAST_CHECK, nowStr);
    } catch (e) {}
  }

  // Check if current model is older than latest
  const hasUpdate = current !== LATEST_AI_MODEL && current !== 'gemini-flash-latest';

  // If auto-upgrade is enabled and an update is found, auto-upgrade immediately!
  if (hasUpdate && getAutoUpgradeEnabled()) {
    setGlobalAiModel(LATEST_AI_MODEL);
  }

  return {
    hasUpdate,
    currentModel: getGlobalAiModel(),
    latestModel: LATEST_AI_MODEL,
    latestModelInfo: latestInfo,
    releaseNotesFa: `نسخه ${latestInfo.name} با ۵۰٪ افزایش سرعت پاسخ‌دهی، درک عمیق‌تر از فرمت جدید FMEA VDA-AIAG، ممیزی هوشمند VDA 6.3 و انطباق کامل با استاندارد IATF 16949:2016 ارائه گردید.`,
    checkedAt: nowStr
  };
}
