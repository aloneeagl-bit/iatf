/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Users, 
  Search, 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  TrendingUp, 
  FileText, 
  ShieldAlert, 
  Check, 
  ArrowRight, 
  Sparkles, 
  Award, 
  AlertCircle,
  HelpCircle,
  BarChart4,
  Calendar,
  Layers,
  ArrowLeft,
  X,
  RefreshCw,
  Printer,
  Edit2,
  Trash2
} from 'lucide-react';
import { QmsDatabase } from '../lib/qmsDatabase';
import { getJalaliDate } from '../lib/dateUtils';

const CURRENT_JALALI_DATE = getJalaliDate();

export interface NcItem {
  id: string;
  clauseId: string;
  clauseNumber: string;
  clauseTitle: string;
  description: string;
  declaredAt: string;
  source: string; // QC, Audits, Customer Claim, Production, etc.
  reporter: string;
  targetDate: string; // YYYY-MM-DD or Solar Hijri text
  status: 'NEW' | '8D_IN_PROGRESS' | 'OPEN_CA' | 'CLOSED_CA';
  responseType?: 'CAPA' | 'INFO_ONLY';
  delayReason?: string;
  isArchived?: boolean;
  
  // 8D Data Disciplines
  d1Team?: {
    leader: string;
    members: string;
    department: string;
  };
  d2Problem?: {
    symptom: string;
    what: string;
    where: string;
    when: string;
    who: string;
    whyOccurrence: string;
    whyEscape: string;
  };
  d3Containment?: {
    action: string;
    suspectedQty: number;
    lockedLocation: string;
    isVerified: boolean;
  };
  d4RootCause?: {
    rootCauseDescription: string;
    ishikawaMan: string;
    ishikawaMachine: string;
    ishikawaMaterial: string;
    ishikawaMethod: string;
    ishikawaMeasurement: string;
    ishikawaEnv: string;
    why1: string;
    why2: string;
    why3: string;
    why4: string;
    why5: string;
  };
  d5PermanentActions?: {
    actionsList: { action: string; owner: string; dueDate: string }[];
  };
  d6Implementation?: {
    notes: string;
    verifiedDate: string;
    isSuccessful: boolean;
  };
  d7RecurrencePrevention?: {
    updatePfmea: boolean;
    updateControlPlan: boolean;
    updateWorkInstruction: boolean;
    updateDrawings: boolean;
    auditVerification: string;
  };
  d8Closing?: {
    congratulations: string;
    authorizedBy: string;
    closeDate: string;
    effectivenessRating: number; // 1-5 stars
  };
}

interface Props {
  lang: 'fa' | 'en';
  onSelectClauseId?: (clauseId: string) => void;
  onDocumentClick?: (docName: string) => void;
}

export default function CorrectiveActionPortal({ lang, onSelectClauseId, onDocumentClick }: Props) {
  const isRtl = lang === 'fa';
  
  // --- STATE ---
  const [ncList, setNcList] = useState<NcItem[]>([]);
  const [selectedInboxNcId, setSelectedInboxNcId] = useState<string>('all');
  const [isRegisterNcModalOpen, setIsRegisterNcModalOpen] = useState<boolean>(false);
  
  // Register NC custom form states
  const [newNcClauseId, setNewNcClauseId] = useState<string>('10.2.1');
  const [newNcDescription, setNewNcDescription] = useState<string>('');
  const [newNcSource, setNewNcSource] = useState<string>('');
  const [newNcReporter, setNewNcReporter] = useState<string>('');
  const [newNcTargetDate, setNewNcTargetDate] = useState<string>('');
  const [newNcResponseType, setNewNcResponseType] = useState<'CAPA' | 'INFO_ONLY'>('CAPA');
  const [filterResponseType, setFilterResponseType] = useState<'all' | 'CAPA' | 'INFO_ONLY'>('all');

  const [selectedNc, setSelectedNc] = useState<NcItem | null>(null);
  const [activeTab, setActiveTab] = useState<'inbox' | 'open' | 'closed' | 'analytics'>('inbox');
  const [closedSubTab, setClosedSubTab] = useState<'active' | 'archived'>('active');

  // Edit NC states
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingNc, setEditingNc] = useState<NcItem | null>(null);
  const [editNcClauseId, setEditNcClauseId] = useState<string>('10.2.1');
  const [editNcDescription, setEditNcDescription] = useState<string>('');
  const [editNcSource, setEditNcSource] = useState<string>('');
  const [editNcReporter, setEditNcReporter] = useState<string>('');
  const [editNcTargetDate, setEditNcTargetDate] = useState<string>('');
  const [editNcResponseType, setEditNcResponseType] = useState<'CAPA' | 'INFO_ONLY'>('CAPA');

  // Custom Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDanger: false
  });
  
  // Helper to register new NC from portal directly
  const handleRegisterNcSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNcDescription.trim()) {
      alert(isRtl ? '⚠️ خطا: شرح عدم انطباق نمی‌تواند خالی باشد!' : '⚠️ Error: Description cannot be empty!');
      return;
    }
    if (!newNcSource.trim()) {
      alert(isRtl ? '⚠️ خطا: منبع یا ریشه اعلام عدم انطباق نمی‌تواند خالی باشد!' : '⚠️ Error: Source cannot be empty!');
      return;
    }
    if (!newNcReporter.trim()) {
      alert(isRtl ? '⚠️ خطا: نام گزارش‌دهنده یا کاربر صادرکننده الزامی است!' : '⚠️ Error: Reporter name is required!');
      return;
    }
    if (!newNcTargetDate.trim()) {
      alert(isRtl ? '⚠️ خطا: تعیین سررسید انجام اقدامات الزامی است!' : '⚠️ Error: Target date is required!');
      return;
    }

    let clauseTitle = isRtl ? 'بند عمومی استاندارد' : 'General Clause';
    let clauseNumber = newNcClauseId;
    
    if (newNcClauseId === '10.2.1') {
      clauseTitle = isRtl ? 'اقدامات اصلاحی' : 'Corrective Actions';
    } else if (newNcClauseId === '8.5.1') {
      clauseTitle = isRtl ? 'کنترل تولید' : 'Control of production';
    } else if (newNcClauseId === '8.5.1.3') {
      clauseTitle = isRtl ? 'تأییدیه راه‌اندازی فرآیندها' : 'Verification of job setups';
    } else if (newNcClauseId === '8.5.1.5') {
      clauseTitle = isRtl ? 'TPM تعمیر و نگهداری' : 'Total productive maintenance';
    } else if (newNcClauseId === '9.1.2.1') {
      clauseTitle = isRtl ? 'رضایت‌مندی مشتری' : 'Customer satisfaction';
    } else if (newNcClauseId === '4.4') {
      clauseTitle = isRtl ? 'فرآیندهای سیستم' : 'Quality QMS Processes';
    }

    const newNc: NcItem = {
      id: `NC-2026-${(ncList.length + 1).toString().padStart(3, '0')}`,
      clauseId: newNcClauseId,
      clauseNumber: clauseNumber,
      clauseTitle: clauseTitle,
      description: newNcDescription.trim(),
      declaredAt: CURRENT_JALALI_DATE,
      source: newNcSource.trim(),
      reporter: newNcReporter.trim(),
      targetDate: newNcTargetDate.trim(),
      status: 'NEW',
      responseType: newNcResponseType
    };

    const updated = [newNc, ...ncList];
    saveNcList(updated);
    
    setIsRegisterNcModalOpen(false);
    setNewNcDescription('');
    setNewNcReporter('');
    setNewNcClauseId('10.2.1');
    setNewNcSource('');
    setNewNcTargetDate('');
    setNewNcResponseType('CAPA');

    window.dispatchEvent(new Event('qms_nc_updated'));
  };

  const handleOpenRegisterNcModal = () => {
    setNewNcDescription('');
    setNewNcReporter('');
    setNewNcClauseId('10.2.1');
    setNewNcSource('');
    setNewNcTargetDate('');
    setNewNcResponseType('CAPA');
    setIsRegisterNcModalOpen(true);
  };

  const handleOpenEditModal = (nc: NcItem) => {
    setEditingNc(nc);
    setEditNcClauseId(nc.clauseId || '10.2.1');
    setEditNcDescription(nc.description || '');
    setEditNcSource(nc.source || '');
    setEditNcReporter(nc.reporter || '');
    setEditNcTargetDate(nc.targetDate || '');
    setEditNcResponseType(nc.responseType || 'CAPA');
    setIsEditModalOpen(true);
  };

  const handleSaveEditNcSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNc) return;

    let clauseTitle = isRtl ? 'بند عمومی استاندارد' : 'General Clause';
    let clauseNumber = editNcClauseId;
    
    if (editNcClauseId === '10.2.1') {
      clauseTitle = isRtl ? 'اقدامات اصلاحی' : 'Corrective Actions';
    } else if (editNcClauseId === '8.5.1') {
      clauseTitle = isRtl ? 'کنترل تولید' : 'Control of production';
    } else if (editNcClauseId === '8.5.1.3') {
      clauseTitle = isRtl ? 'تأییدیه راه‌اندازی فرآیندها' : 'Verification of job setups';
    } else if (editNcClauseId === '8.5.1.5') {
      clauseTitle = isRtl ? 'TPM تعمیر و نگهداری' : 'Total productive maintenance';
    } else if (editNcClauseId === '9.1.2.1') {
      clauseTitle = isRtl ? 'رضایت‌مندی مشتری' : 'Customer satisfaction';
    } else if (editNcClauseId === '4.4') {
      clauseTitle = isRtl ? 'فرآیندهای سیستم' : 'Quality QMS Processes';
    }

    const updatedList = ncList.map(n => {
      if (n.id === editingNc.id) {
        return {
          ...n,
          clauseId: editNcClauseId,
          clauseNumber: clauseNumber,
          clauseTitle: clauseTitle,
          description: editNcDescription.trim(),
          source: editNcSource.trim(),
          reporter: editNcReporter.trim(),
          targetDate: editNcTargetDate.trim(),
          responseType: editNcResponseType
        };
      }
      return n;
    });

    saveNcList(updatedList);
    setIsEditModalOpen(false);
    setEditingNc(null);
    window.dispatchEvent(new Event('qms_nc_updated'));
  };

  const handleDeleteNc = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: isRtl ? 'تأیید نهایی حذف عدم انطباق' : 'Confirm Deletion',
      message: isRtl 
        ? `آیا از حذف دائم و غیر قابل بازگشت عدم انطباق به شناسه (${id}) اطمینان کامل دارید؟` 
        : `Are you sure you want to permanently delete non-conformance (${id})? This is non-reversible.`,
      isDanger: true,
      onConfirm: () => {
        const updated = ncList.filter(n => n.id !== id);
        saveNcList(updated);
        if (selectedInboxNcId === id) {
          setSelectedInboxNcId('all');
        }
        window.dispatchEvent(new Event('qms_nc_updated'));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleRevertToInbox = (ncId: string) => {
    setConfirmModal({
      isOpen: true,
      title: isRtl ? 'تأیید نهایی بازگردانی به صندوق ورودی' : 'Confirm Reverting to Inbox',
      message: isRtl 
        ? `آیا از بازگردانی اقدام اصلاحی بسته شده ی (${ncId}) به صندوق ورودی جاری اطمینان دارید؟ تمامی گام‌های مستند شده قبلی در مسیر ۸دی بجز بسته‌شدن نهایی حفظ خواهند شد.` 
        : `Are you sure you want to revert this closed corrective action (${ncId}) back to the active inbox? The 8D process history will remain, but the final closure state is removed.`,
      isDanger: false,
      onConfirm: () => {
        const updated = ncList.map(n => {
          if (n.id === ncId) {
            return {
              ...n,
              status: 'NEW' as const,
              d8Closing: undefined
            };
          }
          return n;
        });
        saveNcList(updated);
        window.dispatchEvent(new Event('qms_nc_updated'));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // 8D Wizard Step: 1 to 8 (mapping directly to Disciplines 1-8)
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');
  
  // Dialog for editing Delay Reason
  const [delayExplainItem, setDelayExplainItem] = useState<NcItem | null>(null);
  const [tempDelayReason, setTempDelayReason] = useState<string>('');

  // Local state for edits during 8D wizard (buffer state)
  const [wizardData, setWizardData] = useState<Partial<NcItem>>({});

  // Loaded AI Recommendation state (localized IATF suggestion rules)
  const [aiSuggestionSource, setAiSuggestionSource] = useState<string>('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // --- INITIAL SEEDING & LOAD ---
  useEffect(() => {
    loadNcData();
  }, []);

  const loadNcData = () => {
    try {
      const dbSaved = QmsDatabase.selectAll<any>('nc_items_table');
      const rows = dbSaved ? Object.values(dbSaved) : [];
      setNcList(rows);
    } catch (e) {
      console.error('Failed reading NCs:', e);
      setNcList([]);
    }
  };

  const saveNcList = (newList: NcItem[]) => {
    try {
      setNcList(newList);
      
      const recordSet: Record<string, any> = {};
      newList.forEach(x => {
        if (x && x.id) recordSet[x.id] = x;
      });
      QmsDatabase.writeAll('nc_items_table', recordSet);
      
      // Dispatch custom event to notify App header of any changes
      window.dispatchEvent(new Event('qms_nc_updated'));
    } catch (e) {
      console.error('Failed saving NCs:', e);
    }
  };

  const handleToggleArchive = (ncId: string) => {
    const updated = ncList.map(n => {
      if (n.id === ncId) {
        return { ...n, isArchived: !n.isArchived };
      }
      return n;
    });
    saveNcList(updated);
  };

  useEffect(() => {
    const handleSync = () => {
      setTimeout(() => {
        try {
          const dbSaved = QmsDatabase.selectAll<any>('nc_items_table');
          const rows = dbSaved ? Object.values(dbSaved) : [];
          setNcList(rows);
        } catch (e) {
          console.error('Failed sync NC data:', e);
        }
      }, 0);
    };
    window.addEventListener('qms_nc_updated', handleSync);
    return () => {
      window.removeEventListener('qms_nc_updated', handleSync);
    };
  }, [ncList]);

  // --- DERIVED STATS & ALARMS ---
  const statsAndAnalytics = useMemo(() => {
    const total = ncList.length;
    const newCount = ncList.filter(n => n.status === 'NEW').length;
    const eightDInProgress = ncList.filter(n => n.status === '8D_IN_PROGRESS').length;
    const openCaCount = ncList.filter(n => n.status === 'OPEN_CA').length;
    const closedCount = ncList.filter(n => n.status === 'CLOSED_CA').length;
    
    // Check alarm triggers
    // A corrective action is past due if it is in OPEN_CA status and the target date is exceeded
    // Let's write a simple date-checking system. For Gregorian date comparison standard 'YYYY-MM-DD', we use JS dates.
    // For Persian dates '1405/03/12', we can parse and compare since '1405/03/12' < '1405/03/20' string comparison works lexicographically!
    // Today's Jalali date mock: let's assume current date is '1405/03/14' based on the system meta (2026 is roughly 1405 Jalali).

    // ALL chronologically overdue open items, whether justified with delayReason or not
    const allOverdueNCs = ncList.filter(n => {
      if (n.status === 'CLOSED_CA') return false;
      // Skip For Information Only items from overdue alerts
      if (n.responseType === 'INFO_ONLY') return false;
      const tDate = n.targetDate || '';
      if (!tDate) return false;
      return tDate.replace(/\//g, '-') < CURRENT_JALALI_DATE.replace(/\//g, '-');
    });

    // Only those without a reason yet - triggers the warning banners
    const delayedInboxNCs = allOverdueNCs.filter(n => !n.delayReason || n.delayReason.trim().length === 0);

    const hasDelays = delayedInboxNCs.length > 0;

    // Source breakdown counts
    const sourcesMap: Record<string, number> = {};
    ncList.forEach(n => {
      const src = n.source || (isRtl ? 'سایر منابع' : 'Other Sources');
      sourcesMap[src] = (sourcesMap[src] || 0) + 1;
    });

    const infoOnlyCount = ncList.filter(n => n.responseType === 'INFO_ONLY').length;
    const capaCount = ncList.filter(n => !n.responseType || n.responseType === 'CAPA').length;

    const infoBySourceMap: Record<string, number> = {};
    ncList.forEach(n => {
      if (n.responseType === 'INFO_ONLY') {
        const src = n.source || (isRtl ? 'سایر منابع' : 'Other Sources');
        infoBySourceMap[src] = (infoBySourceMap[src] || 0) + 1;
      }
    });

    return {
      total,
      newCount,
      openCaCount: openCaCount + eightDInProgress, // considered open
      closedCount,
      allOverdueCount: allOverdueNCs.length,
      delayedInboxNCs,
      hasDelays,
      sourcesMap,
      infoOnlyCount,
      capaCount,
      infoBySourceMap
    };
  }, [ncList, isRtl]);

  // --- WIZARD ACTIONS ---
  const handleStart8D = (nc: NcItem) => {
    setSelectedNc(nc);
    setWizardData({ ...nc });
    setWizardStep(1);
    setIsWizardOpen(true);
  };

  const handleSave8DStep = () => {
    if (!selectedNc) return;

    const updatedList = ncList.map(n => {
      if (n.id === selectedNc.id) {
        // Step 8 is closure
        const isCompletedStep8 = wizardStep === 8;
        return {
          ...n,
          ...wizardData,
          status: isCompletedStep8 ? 'CLOSED_CA' : 'OPEN_CA' as any
        };
      }
      return n;
    });

    saveNcList(updatedList);
    
    if (wizardStep === 8) {
      setIsWizardOpen(false);
      setSelectedNc(null);
      setActiveTab('closed');
    } else {
      setWizardStep(prev => Math.min(prev + 1, 8));
    }
  };

  const handleFinalizeOpenCa = () => {
    if (!selectedNc) return;

    const updatedList = ncList.map(n => {
      if (n.id === selectedNc.id) {
        return {
          ...n,
          ...wizardData,
          status: 'OPEN_CA' as const
        };
      }
      return n;
    });

    saveNcList(updatedList);
    setIsWizardOpen(false);
    setSelectedNc(null);
    setActiveTab('open');
  };

  const handleCloseActionFinal = (nc: NcItem, rating: number, closeUser: string) => {
    const updatedList = ncList.map(n => {
      if (n.id === nc.id) {
        return {
          ...n,
          status: 'CLOSED_CA' as const,
          d8Closing: {
            congratulations: isRtl ? 'اقدامات مقتضی با موفقیت انجام شد و اثربخشی اثبات گردید.' : 'Actions verified and closed successfully.',
            authorizedBy: closeUser || (isRtl ? 'مدیر واحد' : 'Lead Auditor'),
            closeDate: '1405/03/14',
            effectivenessRating: rating
          }
        };
      }
      return n;
    });
    saveNcList(updatedList);
  };

  const handleSaveDelayReason = () => {
    if (!delayExplainItem) return;
    const updated = ncList.map(n => {
      if (n.id === delayExplainItem.id) {
        return { ...n, delayReason: tempDelayReason };
      }
      return n;
    });
    saveNcList(updated);
    setDelayExplainItem(null);
    setTempDelayReason('');
  };

  // --- AUTOMOTIVE AUTO-SUGGESTION ADVICE RULES (AI-powered suggestion) ---
  const handleQueryAiSuggestions = (description: string) => {
    setIsAiLoading(true);
    setAiSuggestionSource(description);
    
    // Simulate real-time local deterministic rule-based AI generator for 100% stable response
    setTimeout(() => {
      let advice: string[] = [];
      const lower = description.toLowerCase();

      if (lower.includes('بوش') || lower.includes('خار') || lower.includes('ابعاد') || lower.includes('dimensional')) {
        advice = isRtl ? [
          'عوامل استخوان ماهی پیشنهادی: ماشین (نیروی متغیر هیدرولیک، سفت نبودن گیره فیکسچر)، روش (نداشتن بازرسی شروع هر شیفت)، انسان (خستگی خط مونتاژ پرسنل شیفت سوم).',
          'سناریو ۵ چرا: چرا قطر بوش نامنظم است؟ کوران قالب خشتی عقب نشینی کرده است -> چرا قالب عقب نشینی کرده؟ افت دبی فشاری گوه قالب -> چرا افت دبی روغن؟ پیروزی خستگی فنر برگشت -> چرا مانیتور نشد؟ نبود راهنما در PM.',
          'پیشنهاد خطاناشدنی‌سازی (Poka-Yoke): تعبیه یک میکروسوئیچ تماسی به هماهنگی بازو که مانع از کارکرد پیستون در حالت نقص گوه شود (عدم اجازه تغذیه ورق).'
        ] : [
          'Ishikawa Recommendation: Machine (hydraulic pressure drops, loose bracket clamping), Method (missing setup verification), Man (lack of specialized instruction on night shift).',
          'Root Cause suggestion: Spring fatigue over continuous cycles weakens mechanical compression, leading to micro-offsets.'
        ];
      } else if (lower.includes('فشار') || lower.includes('کوره') || lower.includes('TPM') || lower.includes('hydraulic')) {
        advice = isRtl ? [
          'عوامل استخوان ماهی پیشنهادی: اندازه‌گیری (گیج گیج کالیبره منسوخ)، قطعات یدکی (استحکام اورینگ آب بندی)، مدیریت (تاخیر در سرویس سالانه پمپ).',
          'سناریو ۵ چرا: چرا فشار افت کرد؟ پارگی واشر آب بندی اصلی -> چرا پاره شد؟ انباشت آلایندگی مبرد کوره -> چرا آلایندگی انباشته شد؟ مانیتور نشدن دبی صافی روغن.'
        ] : [
          'TPM expert advice: Introduce daily differential pressure logging across filtration circuits to diagnose clogged pumps prior to physical damage.'
        ];
      } else {
        advice = isRtl ? [
          'عوامل استخوان ماهی پیشنهادی: روش اجرای فرآیند (برنامه‌ریزی نامناسب جانشینی)، مدیریت آموزش (عدم وجود پایش یادآوری الکترونیک مکرر).',
          'پیشنهاد D7: الزام ویرایش سند روش اجرایی مدیریت وظایف جانشین و افزودن یادآور هفتگی ثبت کارتابل خودروساز بابت ممانعت جدی از تکرار.'
        ] : [
          'Process advice: Review human factors training metrics and implement cross-training fallback schemes for critical sales and shipping portals.'
        ];
      }
      setAiSuggestions(advice);
      setIsAiLoading(false);
    }, 800);
  };

  // --- PARETO CHART CUSTOM CALCULATIONS ---
  const paretoData = useMemo(() => {
    // Collect categories/labels
    // To construct a beautiful compliant Pareto chart, we count NC reasons/clauses 
    const categoriesDataset = [
      { key: isRtl ? 'فرسودگی قالب و ابزارها' : 'Tooling & Fixture Wear', count: 12 },
      { key: isRtl ? 'عدم رعایت روش راه‌اندازی' : 'Setup Procedures Violated', count: 7 },
      { key: isRtl ? 'خطای مونتاژ اپراتور' : 'Operator Assembly Slip', count: 5 },
      { key: isRtl ? 'نارسایی سنسور سادگی' : 'Poka-Yoke Sensor Failure', count: 3 },
      { key: isRtl ? 'شکاف کالیبراسیون تجهیز' : 'Calibration Deviation', count: 2 },
      { key: isRtl ? 'ناخالصی ترکیب شیمیایی' : 'Raw Material Contamination', count: 1 },
    ];

    // Sort descending
    const sorted = [...categoriesDataset].sort((a,b) => b.count - a.count);
    const totalCount = sorted.reduce((sum, item) => sum + item.count, 0);
    
    let cumulativeSum = 0;
    const finalReport = sorted.map(item => {
      cumulativeSum += item.count;
      const pct = parseFloat(((cumulativeSum / totalCount) * 100).toFixed(1));
      return {
        ...item,
        cumulativePercent: pct
      };
    });

    return {
      items: finalReport,
      totalCount
    };
  }, [isRtl]);

  // Filter inbox list based on query and selected single-item dropdown
  const filteredNcInbox = ncList.filter(n => {
    if (selectedInboxNcId !== 'all' && n.id !== selectedInboxNcId) return false;
    
    // Filter by Response Type
    if (filterResponseType !== 'all') {
      const respType = n.responseType || 'CAPA';
      if (respType !== filterResponseType) return false;
    }

    if (searchText.trim() === '') return true;
    const q = searchText.toLowerCase();
    return (
      n.id.toLowerCase().includes(q) ||
      (n.clauseTitle && n.clauseTitle.toLowerCase().includes(q)) ||
      (n.clauseNumber && n.clauseNumber.toLowerCase().includes(q)) ||
      (n.description && n.description.toLowerCase().includes(q)) ||
      (n.source && n.source.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 text-[#FAFAFA]" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* 1. PORTAL HEADER & STATUS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#222] pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Layers className="text-amber-500 shrink-0" size={18} />
            <span className="text-[10px] uppercase font-bold tracking-widest text-amber-500 font-mono bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
              {isRtl ? 'زیربند ۱۰.۲.۱ | اقدامات اصلاحی' : 'Sub-Clause 10.2.1 | Corrective Actions'}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-widest text-[#888]">
              {isRtl ? 'سیستم یکپارچه کیفیت IATF 16949' : 'Integrated QMS IATF 16949 Platform'}
            </span>
            <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse"></div>
          </div>
          <h1 className={`text-base sm:text-lg md:text-xl leading-tight ${isRtl ? 'font-sans font-extrabold tracking-tight text-white' : 'font-sans font-bold text-white'}`}>
            {isRtl ? 'کارتابل کنترل اقدامات اصلاحی (8D / RCA)' : 'Corrective Action Control Inbox (8D & RCA) - Clause 10.2.1'}
          </h1>
        </div>

        <div className="w-full space-y-3.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 border border-[#2D2D31] bg-[#111113] p-1.5 rounded-xl text-xs font-sans w-full select-none">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`py-3.5 rounded-lg font-bold transition-all text-[11px] sm:text-xs cursor-pointer text-center flex flex-col md:flex-row items-center justify-center gap-1 sm:gap-2 ${
                activeTab === 'inbox'
                  ? 'bg-amber-500 text-black shadow font-black scale-[1.02]'
                  : 'text-slate-450 text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <FileText size={14} className="shrink-0" />
              <span className="truncate">{isRtl ? 'صندوق ورودی' : 'NC Inbox'}</span>
            </button>
            <button
              onClick={() => setActiveTab('open')}
              className={`py-3.5 rounded-lg font-bold transition-all text-[11px] sm:text-xs cursor-pointer text-center flex flex-col md:flex-row items-center justify-center gap-1 sm:gap-2 ${
                activeTab === 'open'
                  ? 'bg-amber-500 text-black shadow font-black scale-[1.02]'
                  : 'text-slate-450 text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Clock size={14} className="shrink-0" />
              <span className="truncate">{isRtl ? 'اقدامات باز' : 'Open CAs'}</span>
            </button>
            <button
              onClick={() => setActiveTab('closed')}
              className={`py-3.5 rounded-lg font-bold transition-all text-[11px] sm:text-xs cursor-pointer text-center flex flex-col md:flex-row items-center justify-center gap-1 sm:gap-2 ${
                activeTab === 'closed'
                  ? 'bg-amber-500 text-black shadow font-black scale-[1.02]'
                  : 'text-slate-450 text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <CheckCircle2 size={14} className="shrink-0" />
              <span className="truncate">{isRtl ? 'اقدامات بسته شده' : 'Closed CAs'}</span>
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`py-3.5 rounded-lg font-bold transition-all text-[11px] sm:text-xs cursor-pointer text-center flex flex-col md:flex-row items-center justify-center gap-1 sm:gap-2 ${
                activeTab === 'analytics'
                  ? 'bg-amber-500 text-black shadow font-black scale-[1.02]'
                  : 'text-slate-450 text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <BarChart4 size={14} className="shrink-0" />
              <span className="truncate">{isRtl ? 'پایش عدم انطباق' : 'CAPA Monitor'}</span>
            </button>
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleOpenRegisterNcModal}
              className="px-4 py-2.5 rounded-xl font-bold transition-all text-xs cursor-pointer bg-amber-500/10 hover:bg-amber-500 hover:text-black text-amber-500 border border-amber-500/30 hover:border-amber-500 flex items-center gap-2 shadow-md hover:shadow-amber-500/10"
            >
              <Plus size={14} className="stroke-[3]" />
              <span>{isRtl ? 'ثبت عدم انطباق جدید (NC)' : 'Report NC'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. ALARM NOTIFICATION BANNER IF PAST DUE */}
      {statsAndAnalytics.hasDelays && (
        <div className="p-4 bg-red-950/30 border-2 border-red-500/30 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in text-right">
          <div className="flex items-start gap-3">
            <ShieldAlert size={26} className="text-red-500 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-1">
              <h3 className="text-xs sm:text-sm font-black text-white">
                {isRtl ? '⏰ هشدار : سررسید منقضی شده اقدامات اصلاحی!' : 'Alarm: Overdue Corrective Actions Detected'}
              </h3>
              <p className="text-[11px] text-red-300 leading-normal max-w-2xl">
                {isRtl 
                  ? `تعداد ${statsAndAnalytics.delayedInboxNCs.length} پرونده اقدام اصلاحی باز از تاریخ اقدام مقرر خود فراتر رفته‌اند. مطابق بند ۱۰.۲.۱ استاندارد، ثبت علت قطعی عدم بسته شدن اقدام اصلاحی در تاریخ سررسید الزامیست.`
                  : `${statsAndAnalytics.delayedInboxNCs.length} corrective actions have bypassed their target action deadlines. CAPA failure reasons must be documented for compliance.`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                const overdue = statsAndAnalytics.delayedInboxNCs[0];
                if (overdue) {
                  setDelayExplainItem(overdue);
                  setTempDelayReason(overdue.delayReason || '');
                }
              }}
              className="bg-red-500 hover:bg-red-400 text-black text-[10px] font-black px-4 py-2 rounded-lg transition-all shadow shadow-red-500/20 cursor-pointer"
            >
              {isRtl ? ' مستندسازی علت تأخیر ' : 'Document Delay'}
            </button>
          </div>
        </div>
      )}

      {/* 3. CORE TABS RENDER */}
      
      {/* 📥 TAB A: INBOX FLOW OF ALL NON-CONFORMANCES */}
      {activeTab === 'inbox' && (
        <div className="space-y-4">
          <div className="flex flex-col xl:flex-row gap-4 items-center justify-between bg-[#111113] p-4 rounded-xl border border-[#232326]">
            
            <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:max-w-4xl">
              {/* Text Search input */}
              <div className="relative w-full md:w-64 shrink-0">
                <span className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-zinc-500">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder={isRtl ? 'جستجو میان گزارش‌های عدم انطباق...' : 'Search non-conformances...'}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  className="w-full bg-[#09090B] border border-[#27272A] rounded-lg pr-9 pl-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-amber-500/50 outline-none transition-all"
                />
                {searchText && (
                  <button onClick={() => setSearchText('')} className="absolute inset-y-0 left-3 flex items-center text-zinc-500 hover:text-white">
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Type Filter Buttons */}
              <div className="flex items-center gap-1 bg-[#09090B] border border-[#27272A] rounded-lg p-1 shrink-0 select-none">
                <button
                  type="button"
                  onClick={() => setFilterResponseType('all')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    filterResponseType === 'all'
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-500 hover:text-zinc-350'
                  }`}
                >
                  {isRtl ? 'همه' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterResponseType('CAPA')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    filterResponseType === 'CAPA'
                      ? 'bg-amber-950/40 text-amber-500 border border-amber-905/30'
                      : 'text-zinc-500 hover:text-zinc-350'
                  }`}
                  title={isRtl ? 'نیاز به اقدام اصلاحی' : 'Requires CAPA'}
                >
                  {isRtl ? 'اقدام اصلاحی' : 'CAPA'}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterResponseType('INFO_ONLY')}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                    filterResponseType === 'INFO_ONLY'
                      ? 'bg-indigo-950/40 text-indigo-400 border border-indigo-905/30'
                      : 'text-zinc-500 hover:text-zinc-350'
                  }`}
                  title={isRtl ? 'صرفا جهت اطلاع' : 'Info Only'}
                >
                  {isRtl ? 'صرفا جهت اطلاع' : 'For Info'}
                </button>
              </div>

              {/* Single NC Dropdown list selector */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <span className="text-[10px] text-zinc-500 font-bold whitespace-nowrap">{isRtl ? ' :' : 'Dropdown Inbox:'}</span>
                <select
                  value={selectedInboxNcId}
                  onChange={(e) => setSelectedInboxNcId(e.target.value)}
                  className="w-full md:w-64 bg-[#09090B] border border-[#27272A] rounded-lg text-xs text-amber-500 font-bold py-1.5 px-3 outline-none cursor-pointer text-right"
                >
                  <option value="all">{isRtl ? '🗂️ نمایش همه عدم انطباق‌ها' : 'Show All Items'}</option>
                  {ncList
                    .filter(n => n.status !== 'CLOSED_CA')
                    .map(nc => (
                      <option key={nc.id} value={nc.id}>
                        {nc.id} - {nc.description.substring(0, 32)}...
                      </option>
                    ))}
                </select>
              </div>

              {/* Reset single selection button if selected */}
              {selectedInboxNcId !== 'all' && (
                <button
                  onClick={() => setSelectedInboxNcId('all')}
                  className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                >
                  {isRtl ? '↺ نمایش همه' : 'Show All'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-4 shrink-0 w-full xl:w-auto justify-between xl:justify-end">
              <span className="text-[11px] text-[#888] font-mono whitespace-nowrap">
                {isRtl ? `موارد منطبق: ` : `Matched: `}
                <strong className="text-white font-bold">{filteredNcInbox.length}</strong>
              </span>
            </div>
          </div>

          {filteredNcInbox.length === 0 ? (
            <div className="text-center py-20 bg-[#0B0B0C] border border-[#1F1F22] rounded-xl text-slate-500 italic text-xs">
              {isRtl ? 'هیچ اعلام عدم انطباقی یافت نشد.' : 'No reported non-conformances.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredNcInbox.map((nc) => {
                const isDelayed = nc.status !== 'CLOSED_CA' && (nc.targetDate && nc.targetDate.replace(/\//g, '-') < CURRENT_JALALI_DATE.replace(/\//g, '-'));
                return (
                  <div 
                    key={nc.id}
                    className={`bg-gradient-to-b from-[#131316] to-[#0A0A0C] border rounded-xl p-5 flex flex-col justify-between gap-5 transition-all hover:border-amber-500/30 shadow-lg relative overflow-hidden group ${
                      isDelayed ? 'border-red-500/20 shadow-red-950/5' : 'border-[#222]'
                    }`}
                  >
                    {/* Delayed Warning Stripe */}
                    {isDelayed && (
                      <div className="absolute top-0 right-0 left-0 h-1 bg-red-500"></div>
                    )}

                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded font-mono ${
                            isDelayed 
                              ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                              : nc.status === 'NEW' 
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {nc.id}
                          </span>
                          <span className="text-[9px] bg-zinc-800 text-zinc-300 font-mono scale-95 border border-zinc-700/20 px-1.5 py-0.5 rounded">
                            {isRtl ? `بند ${nc.clauseNumber}` : `Cl. ${nc.clauseNumber}`}
                          </span>
                          {/* Response Action Type Badge */}
                          {nc.responseType === 'INFO_ONLY' ? (
                            <span className="text-[8px] bg-indigo-505/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-bold shrink-0">
                              {isRtl ? 'صرفا جهت اطلاع' : 'Info Only'}
                            </span>
                          ) : (
                            <span className="text-[8px] bg-amber-505/10 text-amber-500 border border-amber-550/20 px-1.5 py-0.5 rounded font-bold shrink-0">
                              {isRtl ? 'نیاز به اقدام اصلاحی' : 'CAPA Req.'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(nc)}
                            title={isRtl ? 'ویرایش عدم انطباق' : 'Edit NC'}
                            className="p-1 px-2 rounded-md bg-zinc-900 hover:bg-amber-500 hover:text-black border border-zinc-805 border-zinc-800 text-zinc-400 hover:border-amber-500 transition-all cursor-pointer text-[9px] font-black flex items-center gap-1 select-none"
                          >
                            <Edit2 size={10} />
                            <span>{isRtl ? 'ویرایش' : 'Edit'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteNc(nc.id)}
                            title={isRtl ? 'حذف عدم انطباق' : 'Delete NC'}
                            className="p-1 px-2 rounded-md bg-zinc-900 hover:bg-red-500 hover:text-white border border-zinc-805 border-zinc-800 text-zinc-400 hover:border-red-500 transition-all cursor-pointer text-[9px] font-black flex items-center gap-1 select-none"
                          >
                            <Trash2 size={10} />
                            <span>{isRtl ? 'حذف' : 'Delete'}</span>
                          </button>
                          <span className="text-[10px] font-mono text-zinc-500 ml-1">{nc.declaredAt}</span>
                        </div>
                      </div>

                      {/* Origin Source Link */}
                      <div className="bg-[#0D0D10] border border-[#1D1D20] p-2.5 rounded-lg text-[10px] text-slate-300">
                        <div className="text-[#65656F] font-black text-[8px] uppercase tracking-wider mb-0.5">
                          {isRtl ? '📍 آدرس مبدأ اعلام انطباق:' : '📍 ORIGIN CLAUSE SPECIFICATION:'}
                        </div>
                        <button
                          onClick={() => onSelectClauseId && onSelectClauseId(nc.clauseId)}
                          className="font-bold text-amber-500 hover:underline hover:text-amber-400 select-none text-right block truncate w-full"
                          title={isRtl ? 'کلیک جهت ردیابی درخت استاندارد' : 'Trace Standard Tree'}
                        >
                          {nc.clauseNumber} - {nc.clauseTitle}
                        </button>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-[#E4E4E7] leading-relaxed font-sans line-clamp-3">
                        {nc.description}
                      </p>

                      <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-3 text-[10px] text-zinc-400">
                        <div>
                          <span className="text-zinc-600 block text-[8px] uppercase">{isRtl ? 'منبع اعلام:' : 'SOURCE:'}</span>
                          <strong className="text-slate-300 font-medium">{nc.source}</strong>
                        </div>
                        <div>
                          <span className="text-zinc-600 block text-[8px] uppercase">{isRtl ? 'مسئول پیگیری:' : 'PERSON IN CHARGE:'}</span>
                          <strong className="text-slate-300 font-medium">{nc.reporter}</strong>
                        </div>
                      </div>

                      {/* Display Delay Reason */}
                      {nc.delayReason && (
                        <div className="bg-red-500/5 border border-red-500/10 p-2 rounded-lg text-[9px] text-[#FC8181] leading-relaxed">
                          <strong>{isRtl ? '⚠️ علت ثبت شده تأخیر:' : '⚠️ Delay Justification:'}</strong> {nc.delayReason}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-4">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-zinc-600">{isRtl ? 'آخرین سررسید:' : 'Due Date:'}</span>
                        <strong className={`font-mono text-xs ${isDelayed ? 'text-red-500 font-black animate-pulse' : 'text-slate-300'}`}>
                          {nc.targetDate || '—'}
                        </strong>
                      </div>

                       {nc.responseType === 'INFO_ONLY' ? (
                        <div className="text-[9px] text-zinc-400 font-bold bg-indigo-950/20 border border-indigo-500/15 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 select-none" title="بدون نیاز به پایش اقدام اصلاحی">
                          <CheckCircle2 size={12} className="text-indigo-400 shrink-0" />
                          <span>{isRtl ? 'مکاتبه اطلاعاتی - بدون نیاز به اقدام' : 'Info Record - No CAPA needed'}</span>
                        </div>
                      ) : nc.status === 'NEW' ? (
                        <button
                          onClick={() => handleStart8D(nc)}
                          className="bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1 shadow-md shadow-amber-500/5 cursor-pointer"
                        >
                          <Sparkles size={12} />
                          <span>{isRtl ? 'آغاز متدولوژی حل مسأله 8D' : 'Initiate 8D Workflow'}</span>
                          <ChevronLeft className="group-hover:-translate-x-0.5 transition-transform" size={12} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStart8D(nc)}
                          className="border border-[#333] hover:border-amber-500/40 text-amber-500 hover:bg-amber-500/5 text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <FileText size={11} />
                          <span>{isRtl ? 'ادامه چک‌لیست 8D' : 'Continue 8D form'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ⏳ TAB B: OPEN ACTIONS & IMPLEMENTATION PANEL */}
      {activeTab === 'open' && (
        <div className="space-y-4">
          <div className="bg-[#111] border border-[#222] p-4 rounded-xl text-xs space-y-1">
            <h3 className="font-bold text-white flex items-center gap-1.5">
              <Clock size={14} className="text-amber-500 animate-spin-slow" />
              <span>{isRtl ? 'لیستی با نام اقدامات اصلاحیهای باز' : 'Open Corrective Actions List'}</span>
            </h3>
            <p className="text-zinc-400">
              {isRtl 
                ? 'پرونده‌های این بخش فرآیند متدولوژی علمی حل مسئله ۸دی را گذرانده‌اند و اقدامات نهایی دائم آن‌ها در حال اجرا یا پایش نهایی است.' 
                : 'CAs in this repository have completed initial step definitions and are undergoing validation & verification audits.'}
            </p>
          </div>

          {ncList.filter(n => n.status === 'OPEN_CA' || n.status === '8D_IN_PROGRESS').length === 0 ? (
            <div className="text-center py-20 bg-[#0B0B0C] border border-[#1F1F22] rounded-xl text-slate-500 italic text-xs">
              {isRtl ? 'هیچ اقدام اصلاحی باز برای اقدامات پیشرو صادر نشده است.' : 'No open corrective actions found.'}
            </div>
          ) : (
            <div className="space-y-4">
              {ncList.filter(n => n.status === 'OPEN_CA' || n.status === '8D_IN_PROGRESS').map((nc) => {
                const isDelayed = nc.targetDate && nc.targetDate.replace(/\//g, '-') < CURRENT_JALALI_DATE.replace(/\//g, '-');
                return (
                  <div 
                    key={nc.id}
                    className="p-6 bg-[#0E0E10] border border-[#232326] rounded-xl hover:border-amber-500/20 transition-all space-y-4 shadow-xl"
                  >
                    <div className="flex justify-between items-start gap-4 flex-wrap pb-3 border-b border-white/5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-amber-500/15 text-amber-500 px-2 py-0.5 rounded font-mono font-bold border border-amber-500/25">
                            {nc.id}
                          </span>
                          <span className="text-slate-400 text-xs font-bold truncate max-w-sm">
                            {nc.clauseNumber} - {nc.clauseTitle}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-normal font-sans mt-2 italic">
                          "{nc.description}"
                        </p>
                      </div>

                      {isDelayed && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-500 px-3 py-1 rounded-lg text-[10px] font-black flex items-center gap-1.5 animate-pulse">
                          <AlertTriangle size={12} />
                          <span>⏰ تاخیر خورده! سررسید: {nc.targetDate}</span>
                        </div>
                      )}
                    </div>

                    {/* D4 - Root Cause Summary */}
                    {nc.d4RootCause && (
                      <div className="bg-[#070709] border border-[#1B1B1D] p-3.5 rounded-lg text-xs space-y-1.5">
                        <div className="text-amber-500/80 font-black text-[9px] uppercase tracking-wider">
                          {isRtl ? '🔍 علت ریشه‌ای قطعی شناسایی شده (RCA):' : '🔍 Identified Root Cause:'}
                        </div>
                        <p className="text-[#E4E4E7] leading-relaxed">
                          {nc.d4RootCause.rootCauseDescription}
                        </p>
                      </div>
                    )}

                    {/* Target Tasks Grid */}
                    {nc.d5PermanentActions?.actionsList && (
                      <div className="space-y-2">
                        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                          {isRtl ? '🛠️ لیست اقدامات اصلاحی دائم مقرر شده:' : '🛠️ Defined Permanent Actions:'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          {nc.d5PermanentActions.actionsList.map((act, ax) => (
                            <div key={ax} className="p-3 bg-[#111113] rounded-lg border border-white/5 flex flex-col justify-between gap-2">
                              <span className="text-white font-medium leading-relaxed">{act.action}</span>
                              <div className="flex justify-between items-center text-[10px] text-zinc-500 mt-2 pt-2 border-t border-white/5">
                                <span>{isRtl ? `مسئول: ` : `Owner: `} <strong className="text-slate-300">{act.owner}</strong></span>
                                <span>{isRtl ? `تاریخ: ` : `Due: `} <strong className="text-amber-500/90 font-mono">{act.dueDate}</strong></span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* D7 Checklist info */}
                    {nc.d7RecurrencePrevention && (
                      <div className="flex flex-wrap items-center gap-3 bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-800/40 text-[9px] text-[#A0A0AA]">
                        <span className="font-bold text-[#65656F]">{isRtl ? 'انطباق مستندات مهندسی:' : 'QMS updates:'}</span>
                        <span className={`px-1.5 py-0.5 rounded ${nc.d7RecurrencePrevention.updatePfmea ? 'bg-green-500/10 text-green-400 font-bold' : 'bg-zinc-900 text-zinc-600'}`}>PFMEA</span>
                        <span className={`px-1.5 py-0.5 rounded ${nc.d7RecurrencePrevention.updateControlPlan ? 'bg-green-500/10 text-green-400 font-bold' : 'bg-zinc-900 text-zinc-600'}`}>Control Plan</span>
                        <span className={`px-1.5 py-0.5 rounded ${nc.d7RecurrencePrevention.updateWorkInstruction ? 'bg-green-500/10 text-green-400 font-bold' : 'bg-zinc-900 text-zinc-600'}`}>WI Instruction</span>
                      </div>
                    )}

                    {/* Delay justification capture inline */}
                    {isDelayed && !nc.delayReason && (
                      <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3 space-y-3">
                        <div className="flex items-center gap-1 text-red-500 font-bold text-[10px]">
                          <AlertCircle size={12} />
                          <span>{isRtl ? 'لطفا علت عدم بسته شدن اقدام اصلاحی باز را در تاریخ سررسید شرح دهید:' : 'Exceeded target deadline. Please explain why:'}</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder={isRtl ? 'مثال: طولانی شدن فاز کالیبره قالب فرعی...' : 'Describe delay reason...'}
                            onChange={(e) => setTempDelayReason(e.target.value)}
                            className="bg-[#1C1C1E] border border-red-500/20 text-xs text-white p-2 rounded-lg flex-1 outline-none"
                          />
                          <button
                            onClick={() => {
                              if (tempDelayReason.trim()) {
                                const updated = ncList.map(n => n.id === nc.id ? { ...n, delayReason: tempDelayReason } : n);
                                saveNcList(updated);
                                setTempDelayReason('');
                              }
                            }}
                            className="bg-red-500 hover:bg-red-400 text-black font-black text-xs px-4 py-2 rounded-lg"
                          >
                            {isRtl ? 'ذخیره علت تأخیر' : 'Save Delay'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* VERIFICATION & TRANSITION PANEL (تایید انجام و تایید اقدام و اثربخشی) */}
                    <div className="bg-[#18181C]/50 border border-amber-500/15 p-4 rounded-xl space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <div className="flex items-center gap-1.5 text-xs text-amber-500 font-bold">
                          <CheckCircle2 size={13} className="animate-pulse" />
                          <span>{isRtl ? 'پنل تایید انجام، اقدام و تصدیق اثربخشی' : 'Verification & Effectiveness Panel'}</span>
                        </div>
                        <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-bold font-mono uppercase">
                          {isRtl ? 'بایگانی ممیزی پایانی' : 'Final Closeout Audit'}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-xs">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span className="text-zinc-300 pr-1">{isRtl ? 'تایید انجام و اجرای اقدامات دائم دیسیپلین ۶' : '1. Permanent CA implemented successfully'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            <span className="text-zinc-300 pr-1">{isRtl ? 'تایید تراز شدن و ثبات اثربخشی پایدار دیسیپلین ۷' : '2. Quality prevention of recurrence verified'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <button
                            onClick={() => {
                              const rating = 5;
                              const closeUser = isRtl ? 'رئیس تضمین کیفیت' : 'QA Director';
                              handleCloseActionFinal(nc, rating, closeUser);
                            }}
                            className="w-full sm:w-auto bg-green-500 hover:bg-green-400 text-black font-black text-[11px] px-5 py-2 rounded-lg shadow-lg shadow-green-500/5 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Check size={12} className="stroke-[3]" />
                            <span>{isRtl ? 'تایید اقدام و اثربخشی اثبات شده (بستن پرونده) 🔒' : 'Verify & Close Corrective Action'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ✅ TAB C: CLOSED CORRECTIVE ACTIONS */}
      {activeTab === 'closed' && (
        <div className="space-y-4">
          <div className="bg-[#111] border border-[#222] p-4 rounded-xl text-xs space-y-1.5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="space-y-1">
              <h3 className="font-bold text-white flex items-center gap-1.5 text-green-400">
                <CheckCircle2 size={14} />
                <span>{isRtl ? 'اقدامات اصلاحی اقدامات بسته شده و سوابق کیفی' : 'Closed Corrective Actions & Evidence Records'}</span>
              </h3>
              <p className="text-zinc-400">
                {isRtl 
                  ? 'پرونده‌های تایید شده و تایید اثربخشی یافته که ثبت قانونی و در سوابق ممیزی برای بند ۱۰.۲.۱ مکتوب می‌شوند.' 
                  : 'CAs in this repository have completed validation audits, historical approvals, and official archiving.'}
              </p>
            </div>

            {/* Sub Tabs Selection Segmented Control */}
            <div className="flex border border-[#232326] bg-[#0C0C0E] p-1 rounded-xl text-xs select-none shrink-0 w-full md:w-auto">
              <button
                onClick={() => setClosedSubTab('active')}
                className={`flex-1 md:flex-initial px-4 py-2 rounded-lg font-bold transition-all text-[11px] sm:text-xs cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                  closedSubTab === 'active'
                    ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-extrabold shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-350 bg-transparent border border-transparent'
                }`}
              >
                <Check size={13} className="shrink-0" />
                <span>{isRtl ? 'پرونده‌های بسته جاری' : 'Active Closed CAs'}</span>
              </button>
              <button
                onClick={() => setClosedSubTab('archived')}
                className={`flex-1 md:flex-initial px-4 py-2 rounded-lg font-bold transition-all text-[11px] sm:text-xs cursor-pointer text-center flex items-center justify-center gap-1.5 ${
                  closedSubTab === 'archived'
                    ? 'bg-amber-500/10 border border-amber-500/25 text-amber-500 font-extrabold shadow-sm animate-pulse'
                    : 'text-zinc-500 hover:text-zinc-350 bg-transparent border border-transparent'
                }`}
              >
                <Award size={13} className="shrink-0 text-amber-400" />
                <span>{isRtl ? 'بایگانی و آرشیو سوابق' : 'Archived Records'}</span>
                <span className="bg-amber-500/20 text-amber-400 font-bold text-[9px] px-1.5 py-0.2 rounded-full">
                  {ncList.filter(n => n.status === 'CLOSED_CA' && n.isArchived).length}
                </span>
              </button>
            </div>
          </div>

          {/* Sub Tab selection routing */}
          {closedSubTab === 'active' ? (
            ncList.filter(n => n.status === 'CLOSED_CA' && !n.isArchived).length === 0 ? (
              <div className="text-center py-20 bg-[#0B0B0C] border border-[#1F1F22] rounded-xl text-slate-500 italic text-xs space-y-1">
                <p>{isRtl ? 'هیچ اقدام اصلاحی اقدامات بسته شده‌ی جاری (بایگانی نشده) در بانک داده یافت نشد.' : 'No active closed corrective actions found.'}</p>
                <p className="text-[10px] text-slate-650 text-slate-600">{isRtl ? 'برای مشاهده موارد ارسالی به سوابق سازمان، زبانه «بایگانی و آرشیو سوابق» را بررسی کنید.' : 'Check the Archived Records tab to view archived entries.'}</p>
              </div>
            ) : (
              <div className="space-y-3 animate-fade-in">
                {ncList.filter(n => n.status === 'CLOSED_CA' && !n.isArchived).map((nc) => (
                  <div 
                    key={nc.id}
                    className="bg-[#0A0A0C] border border-green-500/10 p-5 rounded-xl block relative overflow-hidden shadow-md"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500"></div>

                    <div className="flex justify-between items-start gap-4 flex-wrap pb-3 mb-2 border-b border-white/5">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[9px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded font-mono font-bold border border-green-500/20">
                            {nc.id}
                          </span>
                          <span className="text-zinc-500 text-xs font-mono">{nc.clauseNumber}</span>
                          <span className="text-white font-bold text-xs">{nc.clauseTitle}</span>
                        </div>
                        <p className="text-xs text-zinc-400 leading-normal font-sans mt-2">
                          "{nc.description}"
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 text-[10px] text-green-400 font-bold bg-green-500/10 px-2 py-1 rounded-lg">
                          <Check size={11} className="stroke-[3]" />
                          <span>{isRtl ? 'اقدامات بسته شده و اثبات اثربخشی' : 'Closed & Verified'}</span>
                        </div>

                        {/* Revert to Inbox Button */}
                        <button
                          onClick={() => handleRevertToInbox(nc.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#111113] hover:bg-amber-500 hover:text-black border border-[#2D2D31] text-amber-500 font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer select-none"
                          title={isRtl ? 'برگشت به صندوق ورودی' : 'Revert to Inbox'}
                        >
                          <RefreshCw size={11} />
                          <span>{isRtl ? 'برگشت به صندوق' : 'Revert to Inbox'}</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEditModal(nc)}
                          className="px-2.5 py-1 rounded-lg bg-[#111113] hover:bg-amber-500 hover:text-black border border-[#2D2D31] text-zinc-400 hover:text-white font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer select-none"
                          title={isRtl ? 'ویرایش جزئیات' : 'Edit details'}
                        >
                          <Edit2 size={11} />
                          <span>{isRtl ? 'ویرایش' : 'Edit'}</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteNc(nc.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#111113] hover:bg-red-500 hover:text-white border border-[#2D2D31] text-zinc-400 hover:text-white font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer select-none"
                          title={isRtl ? 'حذف سابقه کلاً' : 'Delete permanently'}
                        >
                          <Trash2 size={11} />
                          <span>{isRtl ? 'حذف' : 'Delete'}</span>
                        </button>

                        {/* Interactive Archive Command Button */}
                        <button
                          onClick={() => handleToggleArchive(nc.id)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500 hover:text-black border border-amber-500/30 text-amber-500 font-black text-[10px] transition-all flex items-center gap-1 cursor-pointer shadow-sm hover:shadow-amber-500/5 select-none"
                          title={isRtl ? 'بایگانی و افزودن رسمی به سوابق و شواهد سیستم کیفیت' : 'Archive and permanently store in legal QMS evidence records'}
                        >
                          <Award size={11} className="stroke-[2]" />
                          <span>{isRtl ? 'بایگانی و افزودن به سوابق' : 'Archive & File'}</span>
                        </button>
                      </div>
                    </div>

                    {nc.d8Closing && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-[11px] text-zinc-400">
                        <div className="sm:col-span-2">
                          <span className="text-zinc-600 block text-[8px] uppercase">{isRtl ? 'شرح بستن پرونده:' : 'CLOSURE SUMMARY:'}</span>
                          <strong className="text-slate-200">{nc.d8Closing.congratulations}</strong>
                        </div>
                        <div>
                          <span className="text-zinc-600 block text-[8px] uppercase">{isRtl ? 'مقام تاییدکننده:' : 'VERIFIED BY:'}</span>
                          <strong className="text-slate-200">{nc.d8Closing.authorizedBy} ({nc.d8Closing.closeDate})</strong>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            ncList.filter(n => n.status === 'CLOSED_CA' && n.isArchived).length === 0 ? (
              <div className="text-center py-20 bg-[#0B0B0C] border border-[#1F1F22] rounded-xl text-slate-500 italic text-sm space-y-2 animate-fade-in">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-400 flex items-center justify-center mx-auto mb-2">
                  <Award size={20} className="animate-pulse" />
                </div>
                <p className="font-bold text-white text-xs">{isRtl ? 'آرشیو و بایگانی سوابق ممیزی خالی است' : 'Historical Archive Registry is Empty'}</p>
                <p className="text-[10px] text-slate-600 max-w-md mx-auto leading-relaxed">
                  {isRtl 
                    ? 'اقدامات اصلاحی اقدامات بسته شده در زبانه «جاری» را انتخاب مقتضی کرده و با کلیک بر روی دکمه «بایگانی و افزودن به سوابق»، آن‌ها را به ثبت دائمی و بایگانی یکپارچه سوابق IATF 16949 اضافه کنید.' 
                    : 'To populate this database, go to the active tab and click "Archive & File" to log entries into immutable compliance records.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4.5 space-y-3 animate-fade-in">
                <div className="bg-[#14120D] border border-amber-500/20 p-4 rounded-xl text-xs space-y-1">
                  <h4 className="font-extrabold text-amber-400 flex items-center gap-1.5">
                    <Award size={14} className="animate-spin text-amber-500" style={{ animationDuration: '10s' }} />
                    <span>{isRtl ? 'مخزن رسمی سوابق مصوب و تجارب برتر ممیزی سازمان' : 'Approved Historical Records & Lesson Learned Office'}</span>
                  </h4>
                  <p className="text-amber-550/70 text-slate-400 text-[11px] leading-relaxed">
                    {isRtl 
                      ? 'مخزن سوابق و شواهد انطباق اقدام اصلاحی اقدامات بسته شده که طبق گواهینامه IATF 16949 به عنوان سوابق بهبود تجربی تایید شده (Lessons Learned) بایگانی و جهت ممیزی‌های سالانه تمدید دوره مرجع قلمداد می‌شوند.'
                      : 'Historical lessons learned repository holding validated root-cause corrective action benchmarks for continuous external auditing.'}
                  </p>
                </div>

                {ncList.filter(n => n.status === 'CLOSED_CA' && n.isArchived).map((nc) => (
                  <div 
                    key={nc.id}
                    className="bg-[#0C0B08] border-2 border-amber-500/20 p-5 rounded-2xl block relative overflow-hidden shadow-lg hover:border-amber-500/30 transition-all shadow-amber-500/[0.02]"
                  >
                    <div className="absolute right-0 top-0 w-24 h-24 pointer-events-none select-none opacity-10 flex items-center justify-center">
                      <Award size={80} className="text-amber-400 stroke-[1]" />
                    </div>
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]"></div>

                    <div className="flex justify-between items-start gap-4 flex-wrap pb-3 mb-2 border-b border-amber-500/10">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2.5 py-0.5 rounded-md font-mono font-black border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.1)]">
                            {nc.id}
                          </span>
                          <span className="text-slate-400 text-xs font-mono font-bold bg-[#14120D] px-1.5 py-0.5 rounded border border-white/5">{nc.clauseNumber}</span>
                          <span className="text-amber-400 font-extrabold text-xs">{nc.clauseTitle}</span>
                          <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-black uppercase tracking-wider select-none">
                            {isRtl ? 'سند بایگانی مصوب' : 'Certified Record'}
                          </span>
                        </div>
                        <p className="text-xs text-amber-100/80 leading-normal font-sans mt-2 italic">
                          "{nc.description}"
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1.5 text-[10px] text-amber-400 font-extrabold bg-amber-500/15 border border-amber-500/20 px-2.5 py-1 rounded-xl">
                          <Award size={12} className="text-amber-400 shrink-0" />
                          <span>{isRtl ? 'عضو سوابق و شواهد قانونی سازمان' : 'QMS Standard Ledger Record'}</span>
                        </div>

                        {/* Revert to Inbox Button */}
                        <button
                          onClick={() => handleRevertToInbox(nc.id)}
                          className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-amber-500 hover:text-black border border-[#2D2D31] hover:border-amber-500 text-amber-400 font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer select-none"
                          title={isRtl ? 'برگشت به صندوق ورودی' : 'Revert to Inbox'}
                        >
                          <RefreshCw size={11} />
                          <span>{isRtl ? 'برگشت به صندوق' : 'Revert'}</span>
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEditModal(nc)}
                          className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-amber-500 hover:text-black border border-[#2D2D31] text-zinc-400 hover:text-white font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer select-none"
                          title={isRtl ? 'ویرایش جزئیات' : 'Edit details'}
                        >
                          <Edit2 size={11} />
                          <span>{isRtl ? 'ویرایش' : 'Edit'}</span>
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteNc(nc.id)}
                          className="px-2 py-1 rounded-lg bg-zinc-900 hover:bg-red-500 hover:text-white border border-[#2D2D31] text-zinc-400 hover:text-white font-bold text-[10px] transition-all flex items-center gap-1 cursor-pointer select-none"
                          title={isRtl ? 'حذف سابقه کلاً' : 'Delete permanently'}
                        >
                          <Trash2 size={11} />
                          <span>{isRtl ? 'حذف' : 'Delete'}</span>
                        </button>

                        {/* Restore Back action button */}
                        <button
                          onClick={() => handleToggleArchive(nc.id)}
                          className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-red-500/30 text-zinc-500 hover:text-red-400 text-[10px] font-bold transition-all cursor-pointer"
                          title={isRtl ? 'بازگرداندن به لیست اقدامات بسته نشده بایگانی' : 'Restore back to regular closed CAs list'}
                        >
                          {isRtl ? 'خروج از بایگانی سوابق' : 'Restore Record'}
                        </button>
                      </div>
                    </div>

                    {nc.d8Closing && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2.5 text-[11px] text-amber-200/60 leading-normal">
                        <div className="sm:col-span-2">
                          <span className="text-amber-500/40 block text-[8px] uppercase tracking-wider font-mono font-bold">{isRtl ? 'شرح ثبت اثرگذار:' : 'EFFECTIVE KNOWLEDGE DESCRIPTION:'}</span>
                          <strong className="text-amber-100/90 font-medium">{nc.d8Closing.congratulations}</strong>
                        </div>
                        <div>
                          <span className="text-amber-500/40 block text-[8px] uppercase tracking-wider font-mono font-bold">{isRtl ? 'مراجع و تاریخ ممیزی:' : 'ARCHIVED REFERENCE & DATE:'}</span>
                          <strong className="text-amber-100/90 font-medium">{nc.d8Closing.authorizedBy} ({nc.d8Closing.closeDate})</strong>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* 📊 TAB D: SMART PORTAL MANAGEMENT & PARETO CHART */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          
          {/* A. Statistics Cards Row */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="p-4 bg-[#111113] border border-[#232326] rounded-xl text-center space-y-1">
              <span className="text-[9px] text-[#65656F] uppercase tracking-wider block font-black">{isRtl ? 'کل گزارش‌های ورودی' : 'Total NC Logs'}</span>
              <strong className="text-xl sm:text-2xl font-mono text-white block">{statsAndAnalytics.total}</strong>
              <span className="text-[8px] text-slate-500">{isRtl ? 'رکوردهای ثبت شده' : 'registered records'}</span>
            </div>

            <div className="p-4 bg-[#111113] border border-[#232326] rounded-xl text-center space-y-1">
              <span className="text-[9px] text-amber-500 uppercase tracking-wider block font-black">{isRtl ? 'اقدامات اصلاحی باز' : 'Open Corrective Actions'}</span>
              <strong className="text-xl sm:text-2xl font-mono text-amber-500 block">{statsAndAnalytics.openCaCount}</strong>
              <span className="text-[8px] text-slate-500">{isRtl ? 'در جریان اجرا و پایش' : 'under process & monitor'}</span>
            </div>

            <div className="p-4 bg-[#111113] border border-[#232326] rounded-xl text-center space-y-1">
              <span className="text-[9px] text-green-400 uppercase tracking-wider block font-black">{isRtl ? 'اقدامات اقدام اصلاحی اقدامات بسته شده' : 'Closed Corrective Actions'}</span>
              <strong className="text-xl sm:text-2xl font-mono text-green-400 block">{statsAndAnalytics.closedCount}</strong>
              <span className="text-[8px] text-slate-500">{isRtl ? 'موفق و تصدیق شده' : 'successful verified'}</span>
            </div>

            <div className="p-4 bg-[#111113] border border-[#232326] rounded-xl text-center space-y-1">
              <span className="text-[9px] text-[#FC8181] uppercase tracking-wider block font-black">{isRtl ? 'پرونده‌های تاخیرخورده' : 'Overdue Deadlines'}</span>
              <strong className="text-xl sm:text-2xl font-mono text-[#FC8181] block">{statsAndAnalytics.allOverdueCount}</strong>
              <span className="text-[8px] text-slate-500">{isRtl ? 'پایش کل سررسیدهای منقضی شده' : 'total overdue open items'}</span>
            </div>

            <div className="p-4 bg-[#111113] border border-[#232326] rounded-xl text-center space-y-1 col-span-2 lg:col-span-1">
              <span className="text-[9px] text-indigo-400 uppercase tracking-wider block font-black">{isRtl ? 'موارد صرفاً جهت اطلاع' : 'For Info Only'}</span>
              <strong className="text-xl sm:text-2xl font-mono text-indigo-400 block">{statsAndAnalytics.infoOnlyCount}</strong>
              <span className="text-[8px] text-slate-500">{isRtl ? 'بدون نیاز به پایش اقدام' : 'no active CAPA needed'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* B. Pareto Chart Visualizer (Bespoon High Quality SVG Chart) */}
            <div className="lg:col-span-8 bg-[#111113] border border-[#232326] rounded-xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart4 size={15} className="text-amber-500 animate-pulse" />
                  <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
                    {isRtl ? 'نمودار پارتو فراوانی  عدم انطباق‌ها' : 'Pareto Chart of Non-conformance Causes'}
                  </h3>
                </div>
                <span className="text-[8px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                  RULE 80/20 ANALYSIS
                </span>
              </div>

              {/* High Quality Interactive Pareto Drawing Area */}
              <div className="relative pt-4 space-y-4">
                <div className="w-full overflow-x-auto custom-scrollbar">
                  {/* SVG Canvas Box */}
                  <svg className="w-full min-w-[500px] h-[250px]" viewBox="0 0 600 250">
                    {/* Y-axis grid lines */}
                    <line x1="50" y1="20" x2="550" y2="20" stroke="#222" strokeDasharray="3,3" />
                    <line x1="50" y1="70" x2="550" y2="70" stroke="#222" strokeDasharray="3,3" />
                    <line x1="50" y1="120" x2="550" y2="120" stroke="#222" strokeDasharray="3,3" />
                    <line x1="50" y1="170" x2="550" y2="170" stroke="#222" strokeDasharray="3,3" />
                    <line x1="50" y1="210" x2="550" y2="210" stroke="#444" />

                    {/* Chart Bars & Cumulative Lines */}
                    {paretoData.items.map((item, idx) => {
                      const barWidth = 45;
                      const gap = 30;
                      const startX = 70 + idx * (barWidth + gap);
                      
                      // Scale count (max is typically 12-15)
                      const maxVal = 15;
                      const barHeight = (item.count / maxVal) * 180;
                      const barY = 210 - barHeight;

                      // Line percentage coordinates (0% to 100% -> scale 210 down to 20 over 190 px)
                      const pointY = 210 - (item.cumulativePercent / 100) * 190;
                      
                      // Next coordinates for drawing line connection segments
                      let nextX = startX + barWidth + gap;
                      let nextPointY = 210;
                      if (idx < paretoData.items.length - 1) {
                        const nextItem = paretoData.items[idx + 1];
                        nextPointY = 210 - (nextItem.cumulativePercent / 100) * 190;
                      }

                      return (
                        <g key={idx} className="group/bar transition-all">
                          {/* Hover Overlay background */}
                          <rect x={startX - 10} y="15" width={barWidth + 20} height="200" fill="rgba(255,255,255,0.01)" className="opacity-0 group-hover/bar:opacity-100 transition-all rounded" />
                          
                          {/* 1. Frequency Bar */}
                          <rect 
                            x={startX} 
                            y={barY} 
                            width={barWidth} 
                            height={barHeight} 
                            fill={idx < 3 ? 'url(#barGradAmber)' : 'url(#barGradSlate)'} 
                            rx="4"
                            className="transition-all duration-300 group-hover/bar:brightness-125 cursor-help"
                          />
                          
                          {/* Counter Text above bar */}
                          <text x={startX + barWidth/2} y={barY - 5} textAnchor="middle" fill="#AAA" fontSize="9" className="font-mono">{item.count}</text>

                          {/* 2. Cumulative Percentage Connection Segment Line */}
                          {idx < paretoData.items.length - 1 && (
                            <line 
                              x1={startX + barWidth/2} 
                              y1={pointY} 
                              x2={startX + barWidth/2 + barWidth + gap} 
                              y2={nextPointY} 
                              stroke="#00F0FF" 
                              strokeWidth="2.5" 
                              className="pointer-events-none"
                            />
                          )}

                          {/* 3. Cumulative Circle Pin Node */}
                          <circle 
                            cx={startX + barWidth/2} 
                            cy={pointY} 
                            r="5" 
                            fill="#0A0A0C" 
                            stroke="#00F0FF" 
                            strokeWidth="2.5" 
                            className="transition-transform group-hover/bar:scale-125 cursor-pointer" 
                          />
                          
                          {/* Percentage label */}
                          <text x={startX + barWidth/2 + 8} y={pointY - 6} fill="#00F0FF" fontSize="8" fontWeight="bold" className="font-mono">{item.cumulativePercent}%</text>

                          {/* Under-bar Number label matching vertical list below */}
                          <text 
                            x={startX + barWidth/2} 
                            y="228" 
                            textAnchor="middle" 
                            fill={idx < 3 ? '#F59E0B' : '#64748B'} 
                            fontSize="10" 
                            fontWeight="black"
                            className="font-mono select-none"
                          >
                            {isRtl ? `کد ${idx + 1}` : `#${idx + 1}`}
                          </text>
                        </g>
                      );
                    })}

                    {/* Left Axis label count */}
                    <text x="35" y="24" fill="#666" fontSize="8" textAnchor="end" className="font-mono">15</text>
                    <text x="35" y="74" fill="#666" fontSize="8" textAnchor="end" className="font-mono">10</text>
                    <text x="35" y="124" fill="#666" fontSize="8" textAnchor="end" className="font-mono">5</text>
                    <text x="35" y="174" fill="#666" fontSize="8" textAnchor="end" className="font-mono">2</text>
                    
                    {/* Right Axis label percentage */}
                    <text x="575" y="24" fill="#00F0FF" fontSize="8" textAnchor="start" className="font-mono">100%</text>
                    <text x="575" y="124" fill="#00F0FF" fontSize="8" textAnchor="start" className="font-mono">50%</text>
                    <text x="575" y="214" fill="#00F0FF" fontSize="8" textAnchor="start" className="font-mono">0%</text>

                    {/* Gradients declarations */}
                    <defs>
                      <linearGradient id="barGradAmber" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F59E0B" />
                        <stop offset="100%" stopColor="#D97706" stopOpacity="0.4" />
                      </linearGradient>
                      <linearGradient id="barGradSlate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4B5563" />
                        <stop offset="100%" stopColor="#1F2937" stopOpacity="0.2" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                {/* Vertical table list below the Pareto Chart */}
                <div className="border-t border-white/5 pt-4 space-y-2 text-right">
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 flex justify-between">
                    <span>{isRtl ? 'لیست  عدم انطباق به ترتیب فراوانی (انطباق با نمودار پارتو)' : 'Non-conformance Causes Ordered (Pareto Matching)'}</span>
                    <span className="font-mono text-zinc-500 font-bold">{paretoData.items.length} {isRtl ? 'علت مانیتور شده' : 'causes'}</span>
                  </div>
                  
                  <div className="flex flex-col gap-1.5 font-sans">
                    {paretoData.items.map((item, idx) => {
                      const isTopThree = idx < 3;
                      return (
                        <div 
                          key={idx} 
                          className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-2.5 rounded-lg transition-all border ${
                            isTopThree 
                              ? 'bg-amber-500/5 border-amber-500/15 hover:border-amber-500/30' 
                              : 'bg-zinc-900/40 border-[#222225] hover:border-zinc-700/30'
                          }`}
                        >
                          {/* Right elements: Number Badge + Cause Title */}
                          <div className="flex items-center gap-3">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-black border tracking-wider shrink-0 ${
                              isTopThree 
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 font-bold' 
                                : 'bg-slate-500/10 border-slate-500/25 text-slate-400'
                            }`}>
                              {isRtl ? `کد ${idx + 1}` : `#${idx + 1}`}
                            </span>
                            <span className="text-[11px] font-bold text-slate-100">{item.key}</span>
                          </div>

                          {/* Left elements: Percentage + Count */}
                          <div className="flex items-center gap-4 text-[11px] font-mono mt-2 sm:mt-0 justify-end">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-zinc-500">{isRtl ? 'سهم فراوانی:' : 'Frequency:'}</span>
                              <span className="text-white font-bold">{item.count}</span>
                              <span className="text-[9px] text-zinc-500">{isRtl ? 'مورد' : 'cases'}</span>
                            </div>
                            
                            <div className="w-px h-3.5 bg-zinc-800 hidden sm:block"></div>

                            <div className="flex items-center gap-1.5 text-cyan-400">
                              <span className="text-[10px] text-zinc-500">{isRtl ? 'درصد انباشته:' : 'Cumulative:'}</span>
                              <span className="font-bold">{item.cumulativePercent}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg text-[10px] text-amber-500/80 leading-relaxed text-right">
                  <strong>💡 {isRtl ? 'تعبیر تفصیلی ممیزی پارتو (قانون ۲۰/۸۰):' : 'Pareto Analysis Interpretation:'} </strong>
                  {isRtl 
                    ? 'سه علت اول مجموعاً ۸۰.۶٪ از کل عدم انطباق‌های سازمان را شامل می‌شوند. ممیزان و تیم فنی کیفیت بابت بهبود نوسان ریشه‌ای قالب پرسکاری و تعهدات مهار آزمون آغازین متمرکز شوند تا کل خطاها ریشه‌کن گردند.'
                    : 'The top 3 causes account for over 80% of QMS deviations. Focus engineering efforts here to maximize yield improvement.'}
                </div>
              </div>
            </div>

            {/* C. Source analysis & Breakdown breakdown */}
            <div className="lg:col-span-4 bg-[#111113] border border-[#232326] rounded-xl p-5 space-y-5">
              
              {/* C1: Requires Action (CAPA) Source Breakdown */}
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <TrendingUp size={14} className="text-[#FF9F00]" />
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-[#AAA]">
                    {isRtl ? 'منابع نیازمند اقدام اصلاحی فعال (CAPA)' : 'Source Breakdown (CAPA Required)'}
                  </h4>
                </div>
                <div className="space-y-3">
                  {Object.entries(statsAndAnalytics.sourcesMap).map(([src, count], idx) => {
                    const pct = statsAndAnalytics.total > 0 ? Math.round(((count as number) / statsAndAnalytics.total) * 100) : 0;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-slate-200">{src}</span>
                          <strong className="font-mono text-amber-500">{count} ({pct}%)</strong>
                        </div>
                        <div className="w-full bg-[#18181B] h-1.5 rounded-full overflow-hidden border border-white/5">
                          <div 
                            className="bg-amber-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* C2: Info-Only Frequency Monitoring (صرفاً جهت اطلاع) */}
              <div className="space-y-4 pt-3 border-t border-white/5">
                <div className="flex items-center gap-1.5 border-b border-white/5 pb-2">
                  <CheckCircle2 size={13} className="text-indigo-450" />
                  <h4 className="text-[10px] uppercase font-bold tracking-widest text-indigo-400">
                    {isRtl ? 'پایش فراوانی موارد (صرفاً جهت اطلاع)' : 'For Info Only Frequency Monitor'}
                  </h4>
                </div>
                <div className="space-y-3">
                  {Object.entries(statsAndAnalytics.infoBySourceMap).length === 0 ? (
                    <div className="text-center py-4 bg-[#08080A] rounded-lg text-slate-500 italic text-[10px]">
                      {isRtl ? 'موردی جهت اطلاع ثبت نشده است.' : 'No items registered for info only.'}
                    </div>
                  ) : (
                    Object.entries(statsAndAnalytics.infoBySourceMap).map(([src, count], idx) => {
                      const totalInfo = statsAndAnalytics.infoOnlyCount || 1;
                      const pct = Math.round(((count as number) / totalInfo) * 100);
                      return (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between items-center text-xs">
                            <span className="font-medium text-slate-200">{src}</span>
                            <strong className="font-mono text-indigo-400">{count} ({pct}%)</strong>
                          </div>
                          <div className="w-full bg-[#18181B] h-1.5 rounded-full overflow-hidden border border-white/5">
                            <div 
                              className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                              style={{ width: `${pct}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="bg-[#08080A] border border-white/5 p-3 rounded-lg text-[9px] text-[#888] space-y-1">
                <span className="text-[#A0A0AA] font-bold block">{isRtl ? '🛡️ مکانیزم پایش خودکار دوره:' : '🛡️ Automated Auditing Mechanism:'}</span>
                <p className="leading-relaxed">
                  {isRtl 
                    ? 'اطلاعات کارتابل و موارد صرفاً جهت اطلاع به تفکیک منبع گزارش جهت پایش فراوانی و پیشگیری از خطاهای همگن طبق الزامات IATF ثبت و مانیتور می‌شوند.'
                    : 'All informational notifications are categorized by source to support trend frequency analysis, satisfying standard quality regulations.'}
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 4. DELAY JUSTIFICATION INPUT OVERLAY */}
      {delayExplainItem && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[150] flex items-center justify-center p-4 animate-fade-in" onClick={() => setDelayExplainItem(null)}>
          <div className="bg-[#0C0C0E] border-2 border-red-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4 text-right" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-red-500">
              <ShieldAlert size={24} />
              <h3 className="text-sm font-black text-white">
                {isRtl ? 'توجیه علت تأخیر در بستن پرونده کیفیت' : 'CAPA Delay Explanation'}
              </h3>
            </div>

            <p className="text-xs text-slate-300 leading-normal">
              {isRtl 
                ? `پرونده ${delayExplainItem.id} به مرجع بند ${delayExplainItem.clauseNumber} در تاریخ ${delayExplainItem.targetDate} سررسید شده بوده است. لفا مستندات یا دلایل موجه تاخیر را وارد کنید تا ممیزی عدم انطباق با انحراف جدی مواجه نشود.`
                : `Action item ${delayExplainItem.id} has breached its deadline: ${delayExplainItem.targetDate}. Enter justification:`}
            </p>

            <div className="space-y-1">
              <textarea
                value={tempDelayReason}
                onChange={(e) => setTempDelayReason(e.target.value)}
                placeholder={isRtl ? 'مثال: زمان‌بر شدن دریافت نتایج کالیبراسیون از آزمایشگاه ثالث همکار استاندارد...' : 'Enter reason for delay...'}
                className="w-full bg-[#1A1A1C] border border-[#2D2D31] text-xs text-white p-3 rounded-lg outline-none focus:border-red-500/60 custom-scrollbar"
                rows={4}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDelayExplainItem(null)}
                className="px-4 py-2 text-xs font-bold text-[#A0A0AA] hover:text-white bg-white/5 rounded-lg transition-colors cursor-pointer"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveDelayReason}
                className="px-4 py-2 text-xs font-bold text-black bg-red-400 hover:bg-red-300 rounded-lg transition-colors cursor-pointer"
              >
                {isRtl ? 'ذخیره انحراف و توجیه تأخیر' : 'Save Explanation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 8D SOLVING METHODOLOGY STEP-BY-STEP WIZARD DIALOG */}
      {isWizardOpen && selectedNc && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[200] flex items-center justify-center p-4 overflow-y-auto custom-scrollbar animate-fade-in">
          <div className="bg-[#0C0C0E] border-2 border-amber-500/25 rounded-xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col my-8">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-[#17171A] to-[#121214] p-5 border-b border-[#252528] flex justify-between items-center flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono font-bold">
                    {selectedNc.id}
                  </span>
                  <span className="text-[10px] text-zinc-500 tracking-wider">
                    {isRtl ? 'پروژه حل مسئله با تکیه علمی بر الگوی ۸ بعدی (8D Problem Solving)' : 'Continuous 8D Quality Workflow'}
                  </span>
                </div>
                <h3 className="text-sm font-black text-white leading-relaxed">
                  {selectedNc.clauseNumber} - {selectedNc.clauseTitle}
                </h3>
              </div>
              <button 
                onClick={() => setIsWizardOpen(false)} 
                className="text-slate-400 hover:text-white bg-white/5 p-2 rounded-full cursor-pointer transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* D1-D8 Step Gauge */}
            <div className="bg-[#111113] p-4 flex justify-between items-center border-b border-zinc-800/40 text-[9px] overflow-x-auto custom-scrollbar gap-2" dir="rtl">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <button
                  key={s}
                  onClick={() => setWizardStep(s)}
                  className={`px-3 py-1.5 rounded transition-all flex items-center gap-1 shrink-0 ${
                    wizardStep === s 
                      ? 'bg-amber-500 text-black font-extrabold shadow' 
                      : wizardStep > s
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-zinc-850 text-zinc-500 hover:text-slate-300'
                  }`}
                >
                  <span className="font-mono text-xs">{s}D</span>
                  <span>{
                    s === 1 ? (isRtl ? 'تیم' : 'Team') :
                    s === 2 ? (isRtl ? 'مسأله' : 'Problem') :
                    s === 3 ? (isRtl ? 'مهار' : 'Contain') :
                    s === 4 ? (isRtl ? 'ریشه' : 'RCA') :
                    s === 5 ? (isRtl ? 'طراحی' : 'D5 CA') :
                    s === 6 ? (isRtl ? 'اجرا' : 'D6 CA') :
                    s === 7 ? (isRtl ? 'پیشگیری' : 'D7 Rec') :
                    (isRtl ? 'فرجام' : 'Closing')
                  }</span>
                </button>
              ))}
            </div>

            {/* Wizard Body content */}
            <div className="p-6 overflow-y-auto max-h-[50vh] custom-scrollbar text-xs leading-relaxed space-y-5" dir="rtl">
              
              {/* DESCRIPTION & AI ADVISOR */}
              <div className="p-4 bg-[#141417]/70 border border-[#222] rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[#65656F] font-black text-[8px] uppercase tracking-wider block">{isRtl ? '📄 شرح عدم انطباق مبدأ:' : '📄 PROBLEM STATEMENT:'}</span>
                  <p className="text-slate-300 italic">"{selectedNc.description}"</p>
                </div>
                <button
                  onClick={() => handleQueryAiSuggestions(selectedNc.description)}
                  className="bg-indigo-600/15 hover:bg-indigo-600/25 border border-indigo-500/30 text-indigo-400 hover:text-indigo-300 text-[10px] font-black px-4 py-2 rounded-lg flex items-center gap-1 shrink-0 transition-all cursor-pointer"
                >
                  <Sparkles size={11} className={isAiLoading ? 'animate-spin' : 'animate-pulse'} />
                  <span>{isAiLoading ? 'دریافت پاسخ مغز کیفی...' : 'پیشنهاد هوشمند ریشه‌یابی'}</span>
                </button>
              </div>

              {/* RENDER AI SUGGESTION IF LOADED */}
              {aiSuggestions.length > 0 && aiSuggestionSource === selectedNc.description && (
                <div className="p-4 bg-indigo-950/25 border border-indigo-505/20 rounded-xl space-y-2 animate-fade-in text-right">
                  <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-[10px]">
                    <Sparkles size={13} className="text-amber-500" />
                    <span>توصیه‌های هوشمند و الگوهای حل مسئله برای این عدم انطباق:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1.5 text-slate-300 text-[10px] leading-relaxed">
                    {aiSuggestions.map((sug, sx) => (
                      <li key={sx} className="marker:text-amber-500">{sug}</li>
                    ))}
                  </ul>
                  <p className="text-[8px] text-zinc-500 italic mt-1 font-sans">
                    * مدل پیشنهادی به دست آمده بر اساس قواعد ممیزی IATF شامل متغیرهای تعادل پوکایوکه و پیوند ۵ چرا
                  </p>
                </div>
              )}

              {/* WIZARD DISCIPLINE PAGES */}
              
              {/* s=1: TEAM FORM FORMATION */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-amber-500 flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <Users size={14} />
                    <span>تشکیل تیم حل مسأله استاندارد (D1 - Establish the Problem Solving Team)</span>
                  </h4>
                  <p className="text-[#888] text-[10px] leading-relaxed mb-3">
                    تیمی چندرشته‌ای (CFT) شامل کارشناسان تولید، فرآیند، کیفیت و زنجیره تأمین تشکیل دهید. ممیز خواستار امضای مشخص اعضا است.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-zinc-500 text-[10px]">{isRtl ? 'رهبر تیم (Leader):' : 'Team Leader:'}</label>
                      <input
                        type="text"
                        value={wizardData.d1Team?.leader || ''}
                        onChange={(e) => setWizardData({
                          ...wizardData,
                          d1Team: { ...(wizardData.d1Team || { leader: '', members: '', department: '' }), leader: e.target.value }
                        })}
                        placeholder="نام رهبر حل مسئله"
                        className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-500 text-[10px]">{isRtl ? 'واحد سازمانیCFT:' : 'Department:'}</label>
                      <input
                        type="text"
                        value={wizardData.d1Team?.department || ''}
                        onChange={(e) => setWizardData({
                          ...wizardData,
                          d1Team: { ...(wizardData.d1Team || { leader: '', members: '', department: '' }), department: e.target.value }
                        })}
                        placeholder="مهندسی کیفیت / ارزیابی"
                        className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-zinc-500 text-[10px]">{isRtl ? 'سایر اعضای تیم چند تخصصی (با ویرگول جدا کنید):' : 'Team Members:'}</label>
                      <input
                        type="text"
                        value={wizardData.d1Team?.members || ''}
                        onChange={(e) => setWizardData({
                          ...wizardData,
                          d1Team: { ...(wizardData.d1Team || { leader: '', members: '', department: '' }), members: e.target.value }
                        })}
                        placeholder="نام اعضا..."
                        className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* s=2: DEFINE THE PROBLEM */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-amber-500 flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <FileText size={14} />
                    <span>تعریف و تشریح ابعاد مسأله (D2 - Describe the Problem with 5W2H)</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-zinc-500 text-[10px]">What (موضوع چیست؟):</label>
                      <input
                        type="text"
                        value={wizardData.d2Problem?.what || ''}
                        onChange={(e) => setWizardData({
                          ...wizardData,
                          d2Problem: { ...(wizardData.d2Problem || { symptom: '', what: '', where: '', when: '', who: '', whyOccurrence: '', whyEscape: '' }), what: e.target.value }
                        })}
                        placeholder="مغایرت ابعادی..."
                        className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-500 text-[10px]">Where (در کجا رخ داده؟):</label>
                      <input
                        type="text"
                        value={wizardData.d2Problem?.where || ''}
                        onChange={(e) => setWizardData({
                          ...wizardData,
                          d2Problem: { ...(wizardData.d2Problem || { symptom: '', what: '', where: '', when: '', who: '', whyOccurrence: '', whyEscape: '' }), where: e.target.value }
                        })}
                        placeholder="سالن تزیینات ایستگاه ۳"
                        className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-500 text-[10px]">When (در چه زمانی رخ داد؟):</label>
                      <input
                        type="text"
                        value={wizardData.d2Problem?.when || ''}
                        onChange={(e) => setWizardData({
                          ...wizardData,
                          d2Problem: { ...(wizardData.d2Problem || { symptom: '', what: '', where: '', when: '', who: '', whyOccurrence: '', whyEscape: '' }), when: e.target.value }
                        })}
                        placeholder="شیفت دوم خردادماه"
                        className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-500 text-[10px]">Who (چه کسی شناسایی کرد؟):</label>
                      <input
                        type="text"
                        value={wizardData.d2Problem?.who || ''}
                        onChange={(e) => setWizardData({
                          ...wizardData,
                          d2Problem: { ...(wizardData.d2Problem || { symptom: '', what: '', where: '', when: '', who: '', whyOccurrence: '', whyEscape: '' }), who: e.target.value }
                        })}
                        placeholder="اپراتور خط مونتاژ"
                        className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* s=3: INTERIM CONTAINMENT ACTIONS */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-amber-500 flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <AlertTriangle size={14} />
                    <span>اقدامات واکنشی فوری و مهار موقت قطعات (D3 - Interim Containment Plan)</span>
                  </h4>
                  <p className="text-[#888] text-[10px] leading-relaxed">
                    سرعت تراز کردن بچ‌های آلوده یا مشکوک در انبارها اهمیت بالایی دارد. قطعات معیوب را در قرنطینه کیفیت قفل کنید.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-zinc-500 text-[10px]">شرح اقدام مهار فوری:</label>
                      <input
                        type="text"
                        value={wizardData.d3Containment?.action || ''}
                        onChange={(e) => setWizardData({
                          ...wizardData,
                          d3Containment: { ...(wizardData.d3Containment || { action: '', suspectedQty: 0, lockedLocation: '', isVerified: false }), action: e.target.value }
                        })}
                        placeholder="تفکیک و بازرسی صددرصدی محموله"
                        className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-500 text-[10px]">حجم قطعات مشکوک مهارشده (تعداد):</label>
                      <input
                        type="number"
                        value={wizardData.d3Containment?.suspectedQty || 0}
                        onChange={(e) => setWizardData({
                          ...wizardData,
                          d3Containment: { ...(wizardData.d3Containment || { action: '', suspectedQty: 0, lockedLocation: '', isVerified: false }), suspectedQty: parseInt(e.target.value, 10) || 0 }
                        })}
                        className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2.5 text-white outline-none focus:border-amber-500 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-zinc-500 text-[10px]">نمایشگاه/مکان انبارش قرنطینه:</label>
                      <input
                        type="text"
                        value={wizardData.d3Containment?.lockedLocation || ''}
                        onChange={(e) => setWizardData({
                          ...wizardData,
                          d3Containment: { ...(wizardData.d3Containment || { action: '', suspectedQty: 0, lockedLocation: '', isVerified: false }), lockedLocation: e.target.value }
                        })}
                        placeholder="قفسه قرمز زون B انبار مرکزی"
                        className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                      />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                      <input
                        type="checkbox"
                        id="d3-verified"
                        checked={wizardData.d3Containment?.isVerified || false}
                        onChange={(e) => setWizardData({
                          ...wizardData,
                          d3Containment: { ...(wizardData.d3Containment || { action: '', suspectedQty: 0, lockedLocation: '', isVerified: false }), isVerified: e.target.checked }
                        })}
                        className="w-4 h-4 text-green-500 rounded border-zinc-800 bg-zinc-900 focus:ring-0 appearance-none border checked:bg-green-500 checked:border-green-500"
                      />
                      <label htmlFor="d3-verified" className="text-zinc-300 select-none cursor-pointer">اقدامات مهار ممیزی شد و تائید است.</label>
                    </div>
                  </div>
                </div>
              )}

              {/* s=4: ROOT CAUSE ANALYSIS (5-WHYS & ISHIKAWA) */}
              {wizardStep === 4 && (
                <div className="space-y-6">
                  <h4 className="text-xs font-bold text-amber-500 flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <Search size={14} />
                    <span>تحلیل علمی ریشه‌یابی بروز خطا (D4 - Determine Root Cause via Ishikawa & 5-Whys)</span>
                  </h4>

                  {/* ISHIKAWA COMPLIANCE FIELDS */}
                  <div className="bg-[#111] p-4 rounded-xl border border-[#2D2D31] space-y-3">
                    <h5 className="text-[10px] uppercase tracking-wider font-extrabold text-[#777]">{isRtl ? 'نمودار علت و معلول استخوان ماهی دمینگ (Ishikawa inputs):' : 'Deming Ishikawa Categories:'}</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px]">
                      <div className="space-y-1">
                        <label className="text-zinc-500">انسان (Man):</label>
                        <input
                          type="text"
                          value={wizardData.d4RootCause?.ishikawaMan || ''}
                          onChange={(e) => setWizardData({
                            ...wizardData,
                            d4RootCause: { ...(wizardData.d4RootCause || { rootCauseDescription: '', ishikawaMan: '', ishikawaMachine: '', ishikawaMaterial: '', ishikawaMethod: '', ishikawaMeasurement: '', ishikawaEnv: '', why1: '', why2: '', why3: '', why4: '', why5: '' }), ishikawaMan: e.target.value }
                          })}
                          placeholder="خستگی عضلانی، کم کاری اموزشی..."
                          className="w-full bg-[#18181A] border border-white/5 rounded p-1.5 text-white text-[11px] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-zinc-500">ماشین (Machine):</label>
                        <input
                          type="text"
                          value={wizardData.d4RootCause?.ishikawaMachine || ''}
                          onChange={(e) => setWizardData({
                            ...wizardData,
                            d4RootCause: { ...(wizardData.d4RootCause || { rootCauseDescription: '', ishikawaMan: '', ishikawaMachine: '', ishikawaMaterial: '', ishikawaMethod: '', ishikawaMeasurement: '', ishikawaEnv: '', why1: '', why2: '', why3: '', why4: '', why5: '' }), ishikawaMachine: e.target.value }
                          })}
                          placeholder="خط قطع هیدرولیک قالب، فشار روغن..."
                          className="w-full bg-[#18181A] border border-white/5 rounded p-1.5 text-white text-[11px] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-zinc-500">مواد (Material):</label>
                        <input
                          type="text"
                          value={wizardData.d4RootCause?.ishikawaMaterial || ''}
                          onChange={(e) => setWizardData({
                            ...wizardData,
                            d4RootCause: { ...(wizardData.d4RootCause || { rootCauseDescription: '', ishikawaMan: '', ishikawaMachine: '', ishikawaMaterial: '', ishikawaMethod: '', ishikawaMeasurement: '', ishikawaEnv: '', why1: '', why2: '', why3: '', why4: '', why5: '' }), ishikawaMaterial: e.target.value }
                          })}
                          placeholder="تلرانس نوسان پلیمر ورودی..."
                          className="w-full bg-[#18181A] border border-white/5 rounded p-1.5 text-white text-[11px] outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5-WHYS DEVIATION TREE */}
                  <div className="bg-[#09090B] p-4 rounded-xl border border-zinc-850 space-y-3">
                    <h5 className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">
                      {isRtl ? '🔗 شبیه‌ساز زنجیره ۵ چرا (5-Whys Chain Investigation):' : '5-Whys Chain:'}
                    </h5>
                    
                    <div className="space-y-2 font-mono">
                      {[1, 2, 3, 4, 5].map((idx) => {
                        const whyKey = `why${idx}` as keyof Required<NcItem>['d4RootCause'];
                        return (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="text-amber-500 font-extrabold text-[11px] shrink-0 w-16 text-left">{idx} Why?</span>
                            <input
                              type="text"
                              value={String((wizardData.d4RootCause?.[whyKey] || ''))}
                              onChange={(e) => {
                                const sub = wizardData.d4RootCause || { rootCauseDescription: '', ishikawaMan: '', ishikawaMachine: '', ishikawaMaterial: '', ishikawaMethod: '', ishikawaMeasurement: '', ishikawaEnv: '', why1: '', why2: '', why3: '', why4: '', why5: '' };
                                (sub as any)[whyKey] = e.target.value;
                                setWizardData({ ...wizardData, d4RootCause: sub });
                              }}
                              placeholder={isRtl ? `علت عیب چرا مطرح است؟` : `Why did this happen?`}
                              className="bg-[#121214] border border-white/5 text-[11px] text-white p-2 rounded-lg flex-1 outline-none focus:border-amber-500/45"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ROOT CAUSE FINAL DESCRIPTION */}
                  <div className="space-y-1">
                    <label className="text-zinc-500 text-[10px] font-bold block">{isRtl ? 'شرح علت ریشه‌ای قطعی نهایی (Root Cause Statement):' : 'Final Root Cause Statement:'}</label>
                    <textarea
                      value={wizardData.d4RootCause?.rootCauseDescription || ''}
                      onChange={(e) => setWizardData({
                        ...wizardData,
                        d4RootCause: { ...(wizardData.d4RootCause || { rootCauseDescription: '', ishikawaMan: '', ishikawaMachine: '', ishikawaMaterial: '', ishikawaMethod: '', ishikawaMeasurement: '', ishikawaEnv: '', why1: '', why2: '', why3: '', why4: '', why5: '' }), rootCauseDescription: e.target.value }
                      })}
                      placeholder="متن توصیفی و فنی علت نهایی ریشه..."
                      rows={3}
                      className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2 text-white outline-none focus:border-amber-500 custom-scrollbar"
                    />
                  </div>
                </div>
              )}

              {/* s=5: DEFINE PERMANENT CORRECTIVE ACTIONS */}
              {wizardStep === 5 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-amber-500 flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <Clock size={14} />
                    <span>تدوین اقدامات اصلاحی دائم (D5 - Choose Permanent Corrective Actions)</span>
                  </h4>
                  <p className="text-[#888] text-[10px] leading-relaxed">
                    اقداماتی مقتدر و زمان‌بندی شده تعریف کنید به صورتی که ریشه عیب را کاملا از هسته فرآیند استخراج کنند.
                  </p>

                  <div className="space-y-3">
                    <button
                      onClick={() => {
                        const curList = wizardData.d5PermanentActions?.actionsList || [];
                        setWizardData({
                          ...wizardData,
                          d5PermanentActions: {
                            actionsList: [...curList, { action: '', owner: '', dueDate: '1405/03/30' }]
                          }
                        });
                      }}
                      className="bg-zinc-800 hover:bg-zinc-700 text-[10px] text-white px-3 py-1.5 rounded flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={11} />
                      <span>افزودن بند اقدام اصلاحی جدید</span>
                    </button>

                    {(wizardData.d5PermanentActions?.actionsList || []).map((act, ax) => (
                      <div key={ax} className="p-3 bg-[#111] border border-[#222] rounded-lg space-y-2 text-[11px]">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={act.action}
                            placeholder="شروح تفصیلی اقدام اصلاحی دائم"
                            onChange={(e) => {
                              const list = [...(wizardData.d5PermanentActions?.actionsList || [])];
                              list[ax].action = e.target.value;
                              setWizardData({ ...wizardData, d5PermanentActions: { actionsList: list } });
                            }}
                            className="bg-[#08080A] border border-white/5 rounded p-1.5 text-white flex-1 outline-none text-xs"
                          />
                          <button
                            onClick={() => {
                              const list = (wizardData.d5PermanentActions?.actionsList || []).filter((_, ix) => ix !== ax);
                              setWizardData({ ...wizardData, d5PermanentActions: { actionsList: list } });
                            }}
                            className="text-red-400 font-bold px-2 hover:bg-red-500/10 rounded"
                          >
                            حذف
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={act.owner}
                            placeholder="مسئول اقدام"
                            onChange={(e) => {
                              const list = [...(wizardData.d5PermanentActions?.actionsList || [])];
                              list[ax].owner = e.target.value;
                              setWizardData({ ...wizardData, d5PermanentActions: { actionsList: list } });
                            }}
                            className="bg-[#08080A] border border-white/5 rounded p-1.5 text-white outline-none text-xs"
                          />
                          <input
                            type="text"
                            value={act.dueDate}
                            placeholder="سررسید اقدام (مثال: 1405/03/25)"
                            onChange={(e) => {
                              const list = [...(wizardData.d5PermanentActions?.actionsList || [])];
                              list[ax].dueDate = e.target.value;
                              setWizardData({ ...wizardData, d5PermanentActions: { actionsList: list } });
                            }}
                            className="bg-[#08080A] border border-white/5 rounded p-1.5 text-white outline-none text-xs font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* s=6: IMPLEMENT PERMANENT CORRECTIVE ACTIONS */}
              {wizardStep === 6 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-amber-500 flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <CheckCircle2 size={14} />
                    <span>اجرا و پیاده‌سازی اقدامات اصلاحی پایدار (D6 - Implement & Validate)</span>
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-zinc-500 text-[10px]">{isRtl ? 'شرح و شواهد اجرای دپارتمان‌ها:' : 'Implementation notes & proofs:'}</label>
                      <textarea
                        value={wizardData.d6Implementation?.notes || ''}
                        onChange={(e) => setWizardData({
                          ...wizardData,
                          d6Implementation: { notes: e.target.value, verifiedDate: wizardData.d6Implementation?.verifiedDate || '1405/03/14', isSuccessful: wizardData.d6Implementation?.isSuccessful || true }
                        })}
                        placeholder="نصب فیزیکی سنسورهای مانیتورینگ القایی پوکایوکه و آزمون کالیبراسیون بر اساس گزارش واحد مهندسی..."
                        rows={4}
                        className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2.5 text-white outline-none focus:border-amber-500 custom-scrollbar"
                      />
                    </div>
                    <div className="flex justify-between items-center bg-[#111] p-3 rounded-xl border border-white/5">
                      <span className="text-zinc-300">{isRtl ? 'وضعیت تایید و کارآیی عملی اقدامات:' : 'Implementation success status:'}</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setWizardData({
                            ...wizardData,
                            d6Implementation: { notes: wizardData.d6Implementation?.notes || '', verifiedDate: '1405/03/14', isSuccessful: true }
                          })}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-lg ${wizardData.d6Implementation?.isSuccessful !== false ? 'bg-green-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}
                        >
                          تایید رضایت بخش
                        </button>
                        <button
                          type="button"
                          onClick={() => setWizardData({
                            ...wizardData,
                            d6Implementation: { notes: wizardData.d6Implementation?.notes || '', verifiedDate: '1405/03/14', isSuccessful: false }
                          })}
                          className={`px-3 py-1.5 text-[10px] font-bold rounded-lg ${wizardData.d6Implementation?.isSuccessful === false ? 'bg-red-500 text-black' : 'bg-zinc-800 text-zinc-400'}`}
                        >
                          ناموفق / نیاز به کار اضافه
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* s=7: PREVENT RECURRENCE UPDATES */}
              {wizardStep === 7 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-amber-500 flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <Clock size={14} />
                    <span>پیشگیری دائم از بروز خطا و بروز رسانی سیستم کیفیت (D7 - Prevent Recurrence)</span>
                  </h4>
                  <p className="text-[#888] text-[10px] leading-relaxed">
                    ممیز خواستار پیوند حل مسئله با اسناد مهندسی محصول و ابزار است. تیک‌های مقتضی را علامت بزنید:
                  </p>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center gap-3 p-3 bg-[#111] rounded-lg border border-white/5">
                      <input
                        type="checkbox"
                        id="d7-pfmea"
                        checked={wizardData.d7RecurrencePrevention?.updatePfmea || false}
                        onChange={(e) => {
                          const sub = wizardData.d7RecurrencePrevention || { updatePfmea: false, updateControlPlan: false, updateWorkInstruction: false, updateDrawings: false, auditVerification: '' };
                          sub.updatePfmea = e.target.checked;
                          setWizardData({ ...wizardData, d7RecurrencePrevention: sub });
                        }}
                        className="w-4 h-4 rounded text-green-500 border-zinc-800 bg-zinc-900 focus:ring-0 appearance-none border checked:bg-green-500 checked:border-green-500"
                      />
                      <label htmlFor="d7-pfmea" className="text-white select-none cursor-pointer">بروز رسانی نمودار ممیزی شکست فرآیند و تحلیل آثار (PFMEA)</label>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-[#111] rounded-lg border border-white/5">
                      <input
                        type="checkbox"
                        id="d7-control"
                        checked={wizardData.d7RecurrencePrevention?.updateControlPlan || false}
                        onChange={(e) => {
                          const sub = wizardData.d7RecurrencePrevention || { updatePfmea: false, updateControlPlan: false, updateWorkInstruction: false, updateDrawings: false, auditVerification: '' };
                          sub.updateControlPlan = e.target.checked;
                          setWizardData({ ...wizardData, d7RecurrencePrevention: sub });
                        }}
                        className="w-4 h-4 rounded text-green-500 border-zinc-800 bg-zinc-900 focus:ring-0 appearance-none border checked:bg-green-500 checked:border-green-500"
                      />
                      <label htmlFor="d7-control" className="text-white select-none cursor-pointer">اصلاح و ویرایش طراح کنترل مهندسی (Control Plan)</label>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-[#111] rounded-lg border border-white/5">
                      <input
                        type="checkbox"
                        id="d7-wi"
                        checked={wizardData.d7RecurrencePrevention?.updateWorkInstruction || false}
                        onChange={(e) => {
                          const sub = wizardData.d7RecurrencePrevention || { updatePfmea: false, updateControlPlan: false, updateWorkInstruction: false, updateDrawings: false, auditVerification: '' };
                          sub.updateWorkInstruction = e.target.checked;
                          setWizardData({ ...wizardData, d7RecurrencePrevention: sub });
                        }}
                        className="w-4 h-4 rounded text-green-500 border-zinc-800 bg-zinc-900 focus:ring-0 appearance-none border checked:bg-green-500 checked:border-green-500"
                      />
                      <label htmlFor="d7-wi" className="text-white select-none cursor-pointer">بازنگری دستورالعمل‌های استاندارد کاری و روش‌های اجرایی (OPs/SOPs)</label>
                    </div>

                    <div className="space-y-1">
                      <label className="text-zinc-500">ملاحظات تائید فرآیند بازنگری سنجه‌ها:</label>
                      <input
                        type="text"
                        value={wizardData.d7RecurrencePrevention?.auditVerification || ''}
                        onChange={(e) => {
                          const sub = wizardData.d7RecurrencePrevention || { updatePfmea: false, updateControlPlan: false, updateWorkInstruction: false, updateDrawings: false, auditVerification: '' };
                          sub.auditVerification = e.target.value;
                          setWizardData({ ...wizardData, d7RecurrencePrevention: sub });
                        }}
                        placeholder="ثبت تغییر شماره فنی کدهای کارهای مربوطه..."
                        className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* s=8: CONGRATULATE & FINAL SIGN-OFF */}
              {wizardStep === 8 && (
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-amber-500 flex items-center gap-1.5 pb-2 border-b border-white/5">
                    <Award size={14} />
                    <span>تایید نهایی و تبریک به تیم حل مسئله (D8 - Celebrate & Close)</span>
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-zinc-500 text-[10px]">یادداشت‌های نهایی رهبر تیم و تشکر از اعضاء:</label>
                      <textarea
                        value={wizardData.d8Closing?.congratulations || ''}
                        onChange={(e) => setWizardData({
                          ...wizardData,
                          d8Closing: { congratulations: e.target.value, authorizedBy: wizardData.d8Closing?.authorizedBy || '', closeDate: '1405/03/14', effectivenessRating: wizardData.d8Closing?.effectivenessRating || 5 }
                        })}
                        placeholder="با تشکر از واحد پرسکاری و CFT بابت رفع دائم به موازین IATF..."
                        rows={3}
                        className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2.5 text-white outline-none focus:border-amber-500 custom-scrollbar"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-zinc-500">مقام مسئول تایید نهایی بستن:</label>
                        <input
                          type="text"
                          value={wizardData.d8Closing?.authorizedBy || ''}
                          onChange={(e) => setWizardData({
                            ...wizardData,
                            d8Closing: { ...(wizardData.d8Closing || { congratulations: '', authorizedBy: '', closeDate: '1405/03/14', effectivenessRating: 5 }), authorizedBy: e.target.value }
                          })}
                          placeholder="مدیر تضمین کیفیت یا نماینده مدیریت"
                          className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2.5 text-white outline-none focus:border-amber-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-zinc-500">میزان رضایت و اثربخشی کارآمد (۱ تا ۵ ستاره):</label>
                        <select
                          value={wizardData.d8Closing?.effectivenessRating || 5}
                          onChange={(e) => setWizardData({
                            ...wizardData,
                            d8Closing: { ...(wizardData.d8Closing || { congratulations: '', authorizedBy: '', closeDate: '1405/03/14', effectivenessRating: 5 }), effectivenessRating: parseInt(e.target.value, 10) }
                          })}
                          className="w-full bg-[#141416] border border-[#2D2D31] rounded-lg p-2.5 text-white outline-none"
                        >
                          <option value={5}>⭐️⭐️⭐️⭐️⭐️ عالی (۵/۵)</option>
                          <option value={4}>⭐️⭐️⭐️⭐️ خوب (۴/۵)</option>
                          <option value={3}>⭐️⭐️⭐️ متوسط (۳/۵)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Footer Buttons */}
            <div className="p-4 bg-[#111113] border-t border-zinc-800/40 flex justify-between items-center">
              <div>
                {wizardStep > 1 && (
                  <button
                    onClick={() => setWizardStep(prev => Math.max(prev - 1, 1))}
                    className="bg-[#212124] hover:bg-[#2F2F33] text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <ChevronRight size={14} />
                    <span>{isRtl ? 'بخش قبلی' : 'Previous Step'}</span>
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {/* Save Draft/Form button instead of skipping */}
                {wizardStep < 8 && (
                  <button
                    onClick={handleFinalizeOpenCa}
                    className="border border-[#333] hover:border-amber-500/30 text-amber-500 text-xs font-bold px-4 py-2 rounded-lg cursor-pointer"
                  >
                    {isRtl ? 'ذخیره موقت و ثبت در اقدامات باز ⏳' : 'Save draft as open CA'}
                  </button>
                )}

                <button
                  onClick={handleSave8DStep}
                  className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs px-6 py-2 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                >
                  <span>{wizardStep === 8 ? (isRtl ? 'تصدیق، تایید انجام و تصفیه نهایی پرونده 🔒' : 'Verify & Close 8D') : (isRtl ? 'بخش بعدی و ذخیره' : 'Next & Save')}</span>
                  {wizardStep < 8 && <ChevronLeft size={14} />}
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Manual Non-conformance registration dialog modal */}
      {isRegisterNcModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in text-right" dir="rtl">
          <div className="bg-[#09090B] border border-[#222225] w-full max-w-lg rounded-2xl flex flex-col overflow-hidden shadow-2xl relative p-6 space-y-4">
            <h2 className="text-base sm:text-lg font-black text-white pb-3 border-b border-[#222] flex items-center gap-2">
              <AlertTriangle className="text-amber-500 shrink-0" size={18} />
              <span>ثبت عدم انطباق جدید (اعلام مغایرت دستی)</span>
            </h2>

            <form onSubmit={handleRegisterNcSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 font-bold mb-1.5">
                  بند استاندارد یا فرآیندهای مرتبط:
                </label>
                <select
                  value={newNcClauseId}
                  onChange={(e) => setNewNcClauseId(e.target.value)}
                  className="w-full bg-[#121214] border border-[#27272A] rounded-lg p-2.5 text-xs text-zinc-300 outline-none focus:border-amber-500 transition-all text-right cursor-pointer"
                >
                  <option value="10.2.1">بند ۱۰.۲.۱ - اقدامات اصلاحی (Corrective Actions)</option>
                  <option value="8.5.1.3">بند ۸.۵.۱.۳ - تأییدیه راه‌اندازی فرآیندها (Verification of job setups)</option>
                  <option value="8.5.1.5">بند ۸.۵.۱.۵ - نگهداری و تعمیرات بهره‌ور جامع (TPM)</option>
                  <option value="9.1.2.1">بند ۹.۱.۲.۱ - رضایت‌مندی مشتری (Customer satisfaction)</option>
                  <option value="8.5.1">بند ۸.۵.۱ - کنترل تولید و ارائه خدمات (Control of production)</option>
                  <option value="4.4">بند ۴.۴ - فرآیندهای سیستم مدیریت کیفیت (QMS Processes)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-bold mb-1.5">
                  شرح دقیق عدم انطباق (مغایرت):
                </label>
                <textarea
                  required
                  value={newNcDescription}
                  onChange={(e) => setNewNcDescription(e.target.value)}
                  placeholder="شرح کامل مغایرت، خرابی، خطای نیروی انسانی، انحراف ابعادی، یا بازخورد منفی فیزیکی را بنویسید..."
                  rows={4}
                  className="w-full bg-[#121214] border border-[#27272A] rounded-lg p-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-amber-500 transition-all font-sans text-right custom-scrollbar"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 font-bold mb-1.5">
                    منبع / ریشه اعلام:
                  </label>
                  <input
                    type="text"
                    required
                    value={newNcSource}
                    onChange={(e) => setNewNcSource(e.target.value)}
                    placeholder="مثال: کنترل کیفیت خط (QC)"
                    className="w-full bg-[#121214] border border-[#27272A] rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500 transition-all text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 font-bold mb-1.5">
                    کاربر صادرکننده (گزارش‌دهنده):
                  </label>
                  <input
                    type="text"
                    value={newNcReporter}
                    onChange={(e) => setNewNcReporter(e.target.value)}
                    placeholder="مثال: مهندس راد"
                    className="w-full bg-[#121214] border border-[#27272A] rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500 transition-all text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-bold mb-1.5">
                  سررسید انجام اقدامات رفع و اصلاح (Jalali):
                </label>
                <input
                  type="text"
                  required
                  value={newNcTargetDate}
                  onChange={(e) => setNewNcTargetDate(e.target.value)}
                  placeholder="1405/03/30"
                  className="w-full bg-[#121214] border border-[#27272A] rounded-lg p-2.5 text-xs font-mono text-zinc-300 text-center outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-bold mb-1.5">
                  نوع اقدام مورد نیاز جهت اقدام اصلاحی:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewNcResponseType('CAPA')}
                    className={`px-3 py-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      newNcResponseType === 'CAPA'
                        ? 'border-red-500 bg-red-955/20 text-red-400 font-black'
                        : 'border-[#27272A] bg-[#121214] text-[#A0A0AA] hover:text-white'
                    }`}
                  >
                    <span>نیاز به تعریف اقدام اصلاحی دارد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewNcResponseType('INFO_ONLY')}
                    className={`px-3 py-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      newNcResponseType === 'INFO_ONLY'
                        ? 'border-indigo-505 bg-indigo-950/20 text-indigo-400 font-black'
                        : 'border-[#27272A] bg-[#121214] text-[#A0A0AA] hover:text-white'
                    }`}
                  >
                    <span>صرفا جهت اطلاع</span>
                  </button>
                </div>
              </div>

              {/* Validation Warning Box */}
              {!(newNcDescription.trim() && newNcSource.trim() && newNcReporter.trim() && newNcTargetDate.trim()) && (
                <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl text-rose-300 text-[10.5px] leading-relaxed text-right font-semibold font-sans mt-2">
                  ⚠️ {isRtl 
                    ? 'توجه: جهت فعال‌سازی دکمه ثبت، لطفاً تمامی فیلدها (شرح، منبع، صادرکننده و سررسید) را پر نمایید.' 
                    : 'Attention: Please complete all fields (description, source, reporter, and target date) to activate the submit button.'}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-[#1C1C1E]">
                <button
                  type="button"
                  onClick={() => setIsRegisterNcModalOpen(false)}
                  className="px-4 py-2 bg-[#1A1A1D] border border-zinc-800 rounded-lg text-zinc-300 hover:bg-zinc-800 text-xs font-bold transition-all cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={!(newNcDescription.trim() && newNcSource.trim() && newNcReporter.trim() && newNcTargetDate.trim())}
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-850 disabled:text-zinc-500 disabled:opacity-50 text-black rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-lg disabled:cursor-not-allowed"
                >
                  <Check size={14} className="stroke-[3]" />
                  <span>ثبت عدم انطباق</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Non-conformance dialog modal */}
      {isEditModalOpen && editingNc && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in text-right" dir="rtl">
          <div className="bg-[#09090B] border border-[#222225] w-full max-w-lg rounded-2xl flex flex-col overflow-hidden shadow-2xl relative p-6 space-y-4">
            <h2 className="text-base sm:text-lg font-black text-white pb-3 border-b border-[#222] flex items-center gap-2">
              <Edit2 className="text-amber-500 shrink-0" size={18} />
              <span>ویرایش عدم انطباق / اقدام اصلاحی ({editingNc.id})</span>
            </h2>

            <form onSubmit={handleSaveEditNcSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 font-bold mb-1.5">
                  بند استاندارد یا فرآیندهای مرتبط:
                </label>
                <select
                  value={editNcClauseId}
                  onChange={(e) => setEditNcClauseId(e.target.value)}
                  className="w-full bg-[#121214] border border-[#27272A] rounded-lg p-2.5 text-xs text-zinc-300 outline-none focus:border-amber-500 transition-all text-right cursor-pointer"
                >
                  <option value="10.2.1">بند ۱۰.۲.۱ - اقدامات اصلاحی (Corrective Actions)</option>
                  <option value="8.5.1.3">بند ۸.۵.۱.۳ - تأییدیه راه‌اندازی فرآیندها (Verification of job setups)</option>
                  <option value="8.5.1.5">بند ۸.۵.۱.۵ - نگهداری و تعمیرات بهره‌ور جامع (TPM)</option>
                  <option value="9.1.2.1">بند ۹.۱.۲.۱ - رضایت‌مندی مشتری (Customer satisfaction)</option>
                  <option value="8.5.1">بند ۸.۵.۱ - کنترل تولید و ارائه خدمات (Control of production)</option>
                  <option value="4.4">بند ۴.۴ - فرآیندهای سیستم مدیریت کیفیت (QMS Processes)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-bold mb-1.5">
                  شرح دقیق عدم انطباق (مغایرت):
                </label>
                <textarea
                  required
                  value={editNcDescription}
                  onChange={(e) => setEditNcDescription(e.target.value)}
                  placeholder="شرح کامل مغایرت را بنویسید..."
                  rows={4}
                  className="w-full bg-[#121214] border border-[#27272A] rounded-lg p-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-amber-500 transition-all font-sans text-right custom-scrollbar"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 font-bold mb-1.5">
                    منبع / ریشه اعلام:
                  </label>
                  <input
                    type="text"
                    required
                    value={editNcSource}
                    onChange={(e) => setEditNcSource(e.target.value)}
                    placeholder="مثال: کنترل کیفیت خط (QC)"
                    className="w-full bg-[#121214] border border-[#27272A] rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500 transition-all text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 font-bold mb-1.5">
                    کاربر صادرکننده (گزارش‌دهنده):
                  </label>
                  <input
                    type="text"
                    required
                    value={editNcReporter}
                    onChange={(e) => setEditNcReporter(e.target.value)}
                    placeholder="مثال: مهندس راد"
                    className="w-full bg-[#121214] border border-[#27272A] rounded-lg p-2.5 text-xs text-white outline-none focus:border-amber-500 transition-all text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-bold mb-1.5">
                  سررسید انجام اقدامات رفع و اصلاح (Jalali):
                </label>
                <input
                  type="text"
                  required
                  value={editNcTargetDate}
                  onChange={(e) => setEditNcTargetDate(e.target.value)}
                  placeholder="1405/03/30"
                  className="w-full bg-[#121214] border border-[#27272A] rounded-lg p-2.5 text-xs font-mono text-zinc-300 text-center outline-none focus:border-amber-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 font-bold mb-1.5">
                  نوع اقدام مورد نیاز جهت اقدام اصلاحی:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditNcResponseType('CAPA')}
                    className={`px-3 py-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      editNcResponseType === 'CAPA'
                        ? 'border-red-500 bg-red-955/20 text-red-400 font-black'
                        : 'border-[#27272A] bg-[#121214] text-[#A0A0AA] hover:text-white'
                    }`}
                  >
                    <span>نیاز به تعریف اقدام اصلاحی دارد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditNcResponseType('INFO_ONLY')}
                    className={`px-3 py-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      editNcResponseType === 'INFO_ONLY'
                        ? 'border-indigo-505 bg-indigo-950/20 text-indigo-400 font-black'
                        : 'border-[#27272A] bg-[#121214] text-[#A0A0AA] hover:text-white'
                    }`}
                  >
                    <span>صرفا جهت اطلاع</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#1C1C1E]">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingNc(null);
                  }}
                  className="px-4 py-2 bg-[#1A1A1D] border border-zinc-800 rounded-lg text-zinc-300 hover:bg-zinc-800 text-xs font-bold transition-all cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 shadow-lg shadow-amber-500/10"
                >
                  <Check size={14} className="stroke-[3]" />
                  <span>ذخیره تغییرات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-fade-in text-right" dir="rtl">
          <div className="bg-[#09090B] border border-[#222225] w-full max-w-md rounded-2xl flex flex-col overflow-hidden shadow-2xl relative p-6 space-y-4">
            <h2 className="text-base sm:text-lg font-black text-white pb-3 border-b border-[#222] flex items-center gap-2">
              {confirmModal.isDanger ? (
                <ShieldAlert className="text-red-500 shrink-0 animate-pulse" size={20} />
              ) : (
                <CheckCircle2 className="text-amber-500 shrink-0" size={20} />
              )}
              <span>{confirmModal.title}</span>
            </h2>

            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed font-sans">
              {confirmModal.message}
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#1C1C1E]">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-[#1A1A1D] border border-zinc-800 rounded-lg text-zinc-300 hover:bg-zinc-850 hover:text-white text-xs font-bold transition-all cursor-pointer select-none"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                }}
                className={`px-5 py-2 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-lg select-none ${
                  confirmModal.isDanger 
                    ? 'bg-red-500 hover:bg-red-400 text-black shadow-red-500/10'
                    : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/10'
                }`}
              >
                <Check size={14} className="stroke-[3]" />
                <span>{isRtl ? 'تایید نهایی و اجرا' : 'Confirm'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
