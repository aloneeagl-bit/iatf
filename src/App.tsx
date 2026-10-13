/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { iatfData, IATFClause } from './data/iatfData';
import { documentTemplates, getGenericTemplate, DocItem, DocTemplate } from './data/documentTemplates';
import ClauseTree from './components/ClauseTree';
import ClauseDetail from './components/ClauseDetail';
import DocumentEditor, { ColumnDefinition } from './components/DocumentEditor';
import CorrectiveActionPortal from './components/CorrectiveActionPortal';
import CsrManager from './components/CsrManager';
import IatfAssistant from './components/IatfAssistant';
import KpiIndicators from './components/KpiIndicators';
import IsoDocsManager from './components/IsoDocsManager';
import HomeView from './components/HomeView';
import LoginView from './components/LoginView';
import { AuthManager } from './lib/auth';
import { QmsDatabase, TaskWorkflowObserver } from './lib/qmsDatabase';
import { getJalaliDate } from './lib/dateUtils';
import { CloudDriveSyncService } from './lib/cloudDriveSync';
import DbExplorer from './components/DbExplorer';
import RecordsDashboard from './components/RecordsDashboard';
import StrategicManagement from './components/StrategicManagement';
import IatfToolsDashboard from './components/IatfToolsDashboard';
import TeamManagement, { User, Task, Proposal } from './components/TeamManagement';
import { Product, Organization } from './components/TeamManagementTypes';
import { CsrDocument, CsrComparisonItem, Indicator } from './types';
import { generateProcessRequirementsMatrix, generateInternalAuditChecklist, flattenIatfClauses, isClauseAssociated } from './lib/matrixGenerator';
import { ProcessSpecViewer, ProcessClauseDocsViewer } from './components/ProcessExplorerViews';
import { calculateIncompleteRecords, AuditResults } from './lib/auditHelper';
import { Shield, Search, Menu, X, ArrowLeftRight, Edit2, Image as ImageIcon, Calendar, Clock, Trash2, Check, LayoutDashboard, Bot, Activity, ChevronDown, FileText, Database, History, AlertTriangle, Siren, Bell, Home, Sliders, ShieldAlert, Briefcase, PlusCircle, Plus, Users, Package, Globe, Link2, LogIn, FolderTree, Settings, Cpu } from 'lucide-react';
import { uiTranslations, iatfEnglishData } from './lib/translations';
import { ErrorSupervisorProvider, useErrorSupervisor } from './components/ErrorSupervisor';
import { AuditTask, getActiveAlerts, JALALI_MONTHS, jalaliToGregorian } from './components/InternalAuditCalendar';
import AiSettingsModal from './components/AiSettingsModal';
import { getGlobalAiModel } from './lib/aiConfig';

// Live Jalali / Gregorain Clock Component for the Header
function ShamsiClock({ lang }: { lang: 'fa' | 'en' }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatted = useMemo(() => {
    try {
      if (lang === 'fa') {
        return new Intl.DateTimeFormat('fa-IR', {
          calendar: 'persian',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).format(time);
      } else {
        return new Intl.DateTimeFormat('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).format(time);
      }
    } catch (e) {
      return time.toLocaleString();
    }
  }, [time, lang]);

  return (
    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#161618]/30 border border-[#2D2D31]/30 rounded-md text-[9px] sm:text-[10px] text-amber-500 font-medium font-mono whitespace-nowrap shadow-sm h-5">
      <Clock size={11} className="animate-pulse text-amber-500 shrink-0" />
      <span className="tracking-tight">{formatted}</span>
    </div>
  );
}

// Helper function to recursively find a clause by ID within a tree of clauses
const findClauseById = (clauses: IATFClause[], id: string): IATFClause | null => {
  for (const c of clauses) {
    if (c.id === id) return c;
    if (c.subClauses) {
      const found = findClauseById(c.subClauses, id);
      if (found) return found;
    }
  }
  return null;
};

// Helper to map and format a Closed/Archived 8D NC Item to a standard Qms Record Structure
const mapNcItemToRecord = (nc: any, isRtl: boolean): any => {
  return {
    id: `nc-rec-${nc.id}`,
    documentName: 'کاربرگ جامع حل مسئله به روش 8D',
    clauseId: '10.2.1',
    archivedAt: nc.d8Closing?.closeDate || nc.declaredAt || '۱۴۰۵/۰۳/۲۰',
    code: nc.code || `NC-8D-${nc.id.toUpperCase()}`,
    revision: '۰۱',
    preparedBy: nc.reporter || (isRtl ? 'تیم حل مسئله ۸D' : '8D Solving Team'),
    approvedBy: nc.d8Closing?.authorizedBy || (isRtl ? 'مدیر فرآیند / تضمین کیفیت' : 'Process Owner / QA Manager'),
    timestamp: nc.timestamp || Date.now(),
    isNcPortalRecord: true,
    ncId: nc.id,
    items: [
      {
        id: 'd1',
        field1: isRtl ? 'گام D1 - تشکیل تیم رسمی حل مسئله' : 'Phase D1 - Form the Team',
        field2: isRtl ? `تیم کاری منتخب متشکل از: ${nc.d1Team?.members || 'پرونده بدون عضو فعال'} دپارتمان ذیربط.` : `Authorized problem solving group: ${nc.d1Team?.members || 'No active members'}.`,
        field3: isRtl ? `رهبر تیم: ${nc.d1Team?.leader || 'تضمین کیفیت'}` : `Team Leader: ${nc.d1Team?.leader || 'QC'}`,
        field4: nc.declaredAt || '۱۴۰۵/۰۳/۱۴',
        field5: '۱۰۰٪'
      },
      {
        id: 'd2',
        field1: isRtl ? 'گام D2 - تعریف و تشریح تفصیلی خطا' : 'Phase D2 - Describe the Problem',
        field2: isRtl ? `شرح رویداد: ${nc.description}. سناریو: ${nc.d2Problem?.what || 'مشخص نشده'} (${nc.d2Problem?.where || 'بدون لوکیشن'} - ${nc.d2Problem?.when || 'بدون زمان'})` : `Error details: ${nc.description}. Scenario: ${nc.d2Problem?.what || 'unspecified'} (${nc.d2Problem?.where || 'no location'} - ${nc.d2Problem?.when || 'no time'})`,
        field3: nc.reporter || (isRtl ? 'گزارش گر پرونده' : 'Reporter'),
        field4: nc.declaredAt || '۱۴۰۵/۰۳/۱۴',
        field5: '۱۰۰٪'
      },
      {
        id: 'd3',
        field1: isRtl ? 'گام D3 - اقدامات مهار فوری و موقت (Containment)' : 'Phase D3 - Interim Containment',
        field2: isRtl ? `اقدامات ضربتی مهار: ${nc.d3Containment?.action || 'تفکیک ایستگاهی محلی'}. تعداد مشکوک: ${nc.d3Containment?.suspectedQty || 0} عدد در محل قرنطینه ${nc.d3Containment?.lockedLocation || 'انبار ضایعات'}.` : `Containment action: ${nc.d3Containment?.action || 'interim lock'}. Suspected Qty: ${nc.d3Containment?.suspectedQty || 0} unit(s) at location: ${nc.d3Containment?.lockedLocation || 'scrap warehouse'}.`,
        field3: isRtl ? 'سرپرست تولید / انباردار' : 'Warehouse / Prod Supervisor',
        field4: nc.declaredAt || '۱۴۰۵/۰۳/۱۴',
        field5: nc.d3Containment?.isVerified ? '۱۰۰٪' : '۹۰٪'
      },
      {
        id: 'd4',
        field1: isRtl ? 'گام D4 - آنالیز علمی ریشه خطا (RCA)' : 'Phase D4 - Root Cause Analysis (RCA)',
        field2: isRtl ? `شرح علت ریشه‌ای: ${nc.d4RootCause?.rootCauseDescription || 'خطای فرآیندی و عدم مهار منبع عیب'}. استخوان ماهی: انسان: [${nc.d4RootCause?.ishikawaMan || 'نیاز مبرم به آموزش مجدد'}] | تجهیزات: [${nc.d4RootCause?.ishikawaMachine || 'سالم/کالیبره'}] | متدها: [${nc.d4RootCause?.ishikawaMethod || 'سالم'}]. ۵چرا: ۱. ${nc.d4RootCause?.why1 || '—'} ← ۲. ${nc.d4RootCause?.why2 || '—'} ← ۳. ${nc.d4RootCause?.why3 || '—'} ← ۴. ${nc.d4RootCause?.why4 || '—'} ← ۵. ${nc.d4RootCause?.why5 || '—'}` : `Root cause: ${nc.d4RootCause?.rootCauseDescription || 'Method/Operator variance'}. Ishikawa: Man: [${nc.d4RootCause?.ishikawaMan || 'Needs training'}], Machine: [${nc.d4RootCause?.ishikawaMachine || 'OK'}], Material: [${nc.d4RootCause?.ishikawaMaterial || 'OK'}], Method: [${nc.d4RootCause?.ishikawaMethod || 'OK'}]. 5-Why: 1. ${nc.d4RootCause?.why1 || '-'} -> 2. ${nc.d4RootCause?.why2 || '-'} -> 3. ${nc.d4RootCause?.why3 || '-'} -> 4. ${nc.d4RootCause?.why4 || '-'} -> 5. ${nc.d4RootCause?.why5 || '-'}`,
        field3: isRtl ? 'مدیر تضمین کیفیت / تحلیلگر' : 'QC Manager / Analyst',
        field4: nc.declaredAt || '۱۴۰۵/۰۳/۱۴',
        field5: '۱۰۰٪'
      },
      {
        id: 'd5',
        field1: isRtl ? 'گام D5 - تعیین اقدامات اصلاحی دائم (PCA)' : 'Phase D5 - Permanent Actions (PCA)',
        field2: nc.d5PermanentActions?.actionsList && nc.d5PermanentActions.actionsList.length > 0
          ? nc.d5PermanentActions.actionsList.map((a: any, ai: number) => `[اقدام دائم ${ai+1}]: ${a.action} (مسئول: ${a.owner || '—'} • سررسید: ${a.dueDate || '—'})`).join(' • ')
          : (isRtl ? 'تضمین اجرای روش‌های حل مسئله پیشرفته کلو کالیبره.' : 'Implement advanced systemized poka-yoke checkmarks.'),
        field3: isRtl ? 'تیم چندتخصصی CFT' : 'CFT Multi-disciplinary Team',
        field4: nc.targetDate || '۱۴۰۵/۰۳/۲۰',
        field5: '۱۰۰٪'
      },
      {
        id: 'd6',
        field1: isRtl ? 'گام D6 - اجرا و مانیتورینگ کارایی اقدامات اصلاحی' : 'Phase D6 - Action Implementation',
        field2: isRtl ? `شرح اجرای عملیاتی دائم: ${nc.d6Implementation?.notes || 'بروزرسانی فرمول و نصب ابزار کمکی مهار خط در ایستگاه'} با اثربخشی کاملاً مستمر و موفقیت‌آمیز.` : `Operational notes: ${nc.d6Implementation?.notes || 'Systemic fix implemented and validated successfully.'}`,
        field3: isRtl ? 'سرپرست ممیزی / ناظر' : 'Verification Lead / Auditor',
        field4: nc.d6Implementation?.verifiedDate || '—',
        field5: nc.d6Implementation?.isSuccessful ? '۱۰۰٪' : '۸۰٪'
      },
      {
        id: 'd7',
        field1: isRtl ? 'گام D7 - پیشگیری سیستماتیک تکرار خطا' : 'Phase D7 - Prevent Recurrence',
        field2: isRtl ? `به‌روزرسانی اسناد پشتیبان: [PFMEA: ${nc.d7RecurrencePrevention?.updatePfmea ? 'شد':'نشد'}] • [کنترل‌پلان: ${nc.d7RecurrencePrevention?.updateControlPlan ? 'شد':'نشد'}] • [دستورالعمل‌های استاندارد: ${nc.d7RecurrencePrevention?.updateWorkInstruction ? 'شد':'نشد'}] • [نقشه‌های فنی: ${nc.d7RecurrencePrevention?.updateDrawings ? 'شد':'نشد'}]. شیوه تصدیق ممیزی: ${nc.d7RecurrencePrevention?.auditVerification || 'تضمین کیفیت دوره بعد'}.` : `Supportive updates: [PFMEA: ${nc.d7RecurrencePrevention?.updatePfmea ? 'Yes':'No'}] [Control Plan: ${nc.d7RecurrencePrevention?.updateControlPlan ? 'Yes':'No'}] [SOPs/WI: ${nc.d7RecurrencePrevention?.updateWorkInstruction ? 'Yes':'No'}] [Technical Drawings: ${nc.d7RecurrencePrevention?.updateDrawings ? 'Yes':'No'}]. Audit Verification: ${nc.d7RecurrencePrevention?.auditVerification || 'Quality assurance follow-up'}.`,
        field3: isRtl ? 'مسئول متد و مهندسی کیفیت' : 'Methods / Quality Engineer',
        field4: nc.d8Closing?.closeDate || '—',
        field5: '۱۰۰٪'
      },
      {
        id: 'd8',
        field1: isRtl ? 'گام D8 - تقدیر رسمی از تیم و تایید بستن پرونده' : 'Phase D8 - Team Recognition & Closure',
        field2: isRtl ? `پیام تایید مدیر: ${nc.d8Closing?.congratulations || 'با تقدیر فراوان از همکاری تشکیلاتی CFT و رفع دائم ریسک خطر.'} | نرخ امتیاز اثربخشی کلی: ${nc.d8Closing?.effectivenessRating || 5} از ۵ ⭐️` : `Director congratulations: ${nc.d8Closing?.congratulations || 'Outstanding cooperation across teams to eliminate recurrence risk.'} | System effectiveness rating: ${nc.d8Closing?.effectivenessRating || 5}/5 stars`,
        field3: nc.d8Closing?.authorizedBy || (isRtl ? 'مدیریت ارشد تضمین کیفیت' : 'Senior QA Director'),
        field4: nc.d8Closing?.closeDate || '—',
        field5: '۱۰۰٪'
      }
    ]
  };
};

// Helper to merge standard QMS records with mapped archived NC items
const getMergedRecordsLatest = (langSetting: 'fa' | 'en', baseRecords?: any[]): any[] => {
  try {
    const recordsToUse = baseRecords || Object.values(QmsDatabase.selectAll(QmsDatabase.TABLES.RECORDS) || {});
    const storedNc = localStorage.getItem('qmsdb_v3_nc_items');
    if (storedNc) {
      const ncItems = JSON.parse(storedNc);
      if (Array.isArray(ncItems)) {
        const archivedNcs = ncItems.filter((n: any) => n && n.status === 'CLOSED_CA' && n.isArchived);
        const mappedNcs = archivedNcs.map((n: any) => mapNcItemToRecord(n, langSetting === 'fa'));
        const standardRecords = recordsToUse.filter((r: any) => !r.id?.startsWith('nc-rec-') && !r.isNcPortalRecord);
        return [...standardRecords, ...mappedNcs];
      }
    }
    return recordsToUse;
  } catch {
    return baseRecords || [];
  }
};

export function AppContent({ lang, setLang }: { lang: 'fa' | 'en'; setLang: React.Dispatch<React.SetStateAction<'fa' | 'en'>> }) {
  const { setTerminalOpen, logs } = useErrorSupervisor();
  const [viewMode, setViewMode] = useState<'home' | 'iatf' | 'csr' | 'indicators' | 'assistant' | 'iso9001_docs' | 'db_explorer' | 'records' | 'strategic_management' | 'iatf_tools' | 'team_management'>('home');
  const [toastNotification, setToastNotification] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);
  
  // --- AI SETTINGS MODAL & GLOBAL MODEL STATE ---
  const [isAiSettingsOpen, setIsAiSettingsOpen] = useState<boolean>(false);
  const [currentAiModel, setCurrentAiModel] = useState<string>(getGlobalAiModel());

  useEffect(() => {
    const handleModelChange = (e: any) => {
      if (e.detail?.modelId) {
        setCurrentAiModel(e.detail.modelId);
      }
    };
    window.addEventListener('qms_ai_model_changed', handleModelChange);
    return () => window.removeEventListener('qms_ai_model_changed', handleModelChange);
  }, []);
  
  // --- TEAM MANAGEMENT & ROLE CONTROL STATES ---
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return AuthManager.getCurrentUser();
  });

  const [users, setUsers] = useState<User[]>(() => {
    try {
      const saved = localStorage.getItem('qms_users');
      if (saved) {
        let parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {}
    return [];
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('qms_tasks');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [proposals, setProposals] = useState<Proposal[]>(() => {
    try {
      const saved = localStorage.getItem('qms_proposals');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // --- MULTI-ORG & MULTI-PRODUCT ENTERPRISE WORKSPACE ---
  const [organizations, setOrganizations] = useState<Organization[]>(() => {
    try {
      const saved = localStorage.getItem('qms_organizations');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [products, setProducts] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('qms_products');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [selectedOrgId, setSelectedOrgId] = useState<string>(() => {
    return localStorage.getItem('qms_selected_org_id') || '';
  });

  const [selectedProductId, setSelectedProductId] = useState<string>(() => {
    return localStorage.getItem('qms_selected_product_id') || '';
  });

  useEffect(() => {
    localStorage.setItem('qms_organizations', JSON.stringify(organizations));
  }, [organizations]);

  useEffect(() => {
    localStorage.setItem('qms_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('qms_selected_org_id', selectedOrgId);
    localStorage.setItem('qms_selected_product_id', selectedProductId);
    
    if (selectedOrgId && selectedProductId) {
      QmsDatabase.setTenant(selectedOrgId, selectedProductId);
      // Ensure the partitioned tables exist for this tenant
      QmsDatabase.initAndSynchronize(selectedOrgId, selectedProductId);
    } else {
      QmsDatabase.setTenant('', '');
    }
  }, [selectedOrgId, selectedProductId]);

  // Register Task-Workflow Observer pattern for real-time task status & document workflow state propagation
  useEffect(() => {
    const unsubscribe = QmsDatabase.subscribeTaskWorkflowObserver((event) => {
      setTasks(prev => prev.map(t => t.id === event.taskId ? { ...t, status: event.status as any, feedback: event.comment } : t));
    });
    return () => unsubscribe();
  }, []);

  // Global confirmation dialog state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const activeOrg = useMemo(() => organizations.find(o => o.id === selectedOrgId) || null, [organizations, selectedOrgId]);
  const activeProduct = useMemo(() => products.find(p => p.id === selectedProductId) || null, [products, selectedProductId]);

  // Handle module access validation
  const validateAccess = useCallback((targetMode: typeof viewMode) => {
    // Access restrictions are disabled during development/construction as per user request
    return true;
  }, []);

  const handleSetViewMode = (mode: typeof viewMode) => {
    if (validateAccess(mode)) {
      setViewMode(mode);
      setIsSidebarOpen(false);
    }
  };

  const handleAddOrg = useCallback((newOrgData: Omit<Organization, 'id' | 'createdAt'>) => {
    const isFarsi = lang === 'fa';
    const nowJalali = isFarsi ? '۱۴۰۵/' + String(new Date().getMonth() + 1).padStart(2, '0') + '/' + String(new Date().getDate()).padStart(2, '0') : new Date().toLocaleDateString();
    const newOrg: Organization = {
      ...newOrgData,
      id: 'org-' + Date.now(),
      createdAt: nowJalali
    };
    setOrganizations(prev => [...prev, newOrg]);
    setSelectedOrgId(newOrg.id);
  }, [lang]);

  const handleEditOrg = useCallback((id: string, updatedData: Partial<Organization>) => {
    const org = organizations.find(o => o.id === id);
    const confirmTitle = lang === 'fa' ? '📝 تأیید ویرایش سازمان' : '📝 Confirm Org Edit';
    const confirmMsg = lang === 'fa' 
      ? `آیا از ویرایش اطلاعات سازمان "${org?.nameFa || org?.name}" اطمینان دارید؟` 
      : `Are you sure you want to edit organization "${org?.name}"?`;
    
    setAppConfirmDialog({
      isOpen: true,
      title: confirmTitle,
      message: confirmMsg,
      onConfirm: () => {
        setOrganizations(prev => prev.map(o => o.id === id ? { ...o, ...updatedData } : o));
        setAppConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, [organizations, lang]);

  const handleDeleteOrg = useCallback((id: string) => {
    const org = organizations.find(o => o.id === id);
    if (!org) return;

    const confirmTitle = lang === 'fa' ? '⚠️ حذف بحرانی سازمان' : '⚠️ Critical Org Deletion';
    const confirmMsg = lang === 'fa' 
      ? `هشدار بحرانی: آیا از حذف دائمی سازمان "${org.nameFa || org.name}" اطمینان دارید؟ تمام محصولات و داده‌های مرتبط بک‌آپ گرفته شده و سپس حذف خواهند شد. این عمل غیرقابل بازگشت است.` 
      : `CRITICAL WARNING: Are you sure you want to PERMANENTLY delete "${org.name}"? All associated products and data will be backed up and then deleted. This action cannot be undone.`;
    
    setAppConfirmDialog({
      isOpen: true,
      title: confirmTitle,
      message: confirmMsg,
      onConfirm: () => {
        // Archive all products under this organization first
        const orgProducts = products.filter(p => p.organizationId === id);
        orgProducts.forEach(p => {
          QmsDatabase.archiveTenantData(id, p.id, { 
            type: 'AUTO_BACKUP_ON_ORG_DELETE', 
            orgName: org.name, 
            prodName: p.name 
          });
        });

        setOrganizations(prev => {
          const remaining = prev.filter(o => o.id !== id);
          if (selectedOrgId === id) {
            setSelectedOrgId(remaining.length > 0 ? remaining[0].id : '');
          }
          return remaining;
        });
        // Also delete associated products
        setProducts(prev => prev.filter(p => p.organizationId !== id));
        setAppConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, [selectedOrgId, organizations, products, lang]);

  const handleAddProduct = useCallback((newProductData: Omit<Product, 'id' | 'createdAt'>) => {
    const isFarsi = lang === 'fa';
    const nowJalali = isFarsi ? '۱۴۰۵/' + String(new Date().getMonth() + 1).padStart(2, '0') + '/' + String(new Date().getDate()).padStart(2, '0') : new Date().toLocaleDateString();
    const newProd: Product = {
      ...newProductData,
      id: 'prod-' + Date.now(),
      createdAt: nowJalali
    };
    setProducts(prev => [...prev, newProd]);
    setSelectedProductId(newProd.id);
  }, [lang]);

  const handleEditProduct = useCallback((id: string, updatedData: Partial<Product>) => {
    const prod = products.find(p => p.id === id);
    const confirmTitle = lang === 'fa' ? '📝 تأیید ویرایش محصول' : '📝 Confirm Product Edit';
    const confirmMsg = lang === 'fa' 
      ? `آیا از ویرایش مشخصات فنی محصول "${prod?.name}" اطمینان دارید؟` 
      : `Are you sure you want to edit product "${prod?.name}"?`;
    
    setAppConfirmDialog({
      isOpen: true,
      title: confirmTitle,
      message: confirmMsg,
      onConfirm: () => {
        setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updatedData } : p));
        setAppConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, [products, lang]);

  const handleDeleteProduct = useCallback((id: string) => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;

    const confirmTitle = lang === 'fa' ? '🗑️ حذف محصول' : '🗑️ Delete Product';
    const confirmMsg = lang === 'fa' 
      ? `آیا از حذف محصول "${prod.name}" اطمینان دارید؟ بک‌آپ سیستمی از داده‌ها تهیه خواهد شد.` 
      : `Are you sure you want to delete product "${prod.name}"? A system backup will be created.`;
    
    setAppConfirmDialog({
      isOpen: true,
      title: confirmTitle,
      message: confirmMsg,
      onConfirm: () => {
        QmsDatabase.archiveTenantData(prod.organizationId, prod.id, { 
          type: 'AUTO_BACKUP_ON_PROD_DELETE', 
          prodName: prod.name 
        });

        setProducts(prev => {
          const remaining = prev.filter(p => p.id !== id);
          if (selectedProductId === id && remaining.length > 0) {
            setSelectedProductId(remaining[0].id);
          }
          return remaining;
        });
        setAppConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, [selectedProductId, products, lang]);

  // Keep LocalStorage in sync
  useEffect(() => {
    localStorage.setItem('qms_current_user', JSON.stringify(currentUser));
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('qms_users', JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem('qms_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('qms_proposals', JSON.stringify(proposals));
  }, [proposals]);

  const handleProposeChange = useCallback((module: string, type: 'CREATE' | 'UPDATE' | 'DELETE', targetId: string, targetName: string, proposedData: any) => {
    const newProposal: Proposal = {
      id: 'prop-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      userId: currentUser?.id || 'anonymous',
      userFullName: currentUser?.fullName || 'ناشناس',
      timestamp: new Date().toLocaleDateString('fa-IR') + ' ' + new Date().toLocaleTimeString('fa-IR'),
      type,
      module: module as any,
      targetId,
      targetName,
      proposedData,
      status: 'pending'
    };
    setProposals(prev => [...prev, newProposal]);
  }, [currentUser]);

  const handleLogin = useCallback((usernameStr: string, passwordStr?: string) => {
    const trimmed = usernameStr.trim();
    if (!trimmed) return { success: false, error: 'نام کاربری وارد نشده است.' };

    // If no users exist, the first login creates the Administrator!
    if (users.length === 0) {
      const firstAdmin: User = {
        id: 'usr-admin-' + Date.now(),
        username: trimmed.toLowerCase(),
        password: passwordStr || 'admin',
        fullName: trimmed === 'admin' ? 'مدیر سیستم' : trimmed,
        role: 'admin',
        permissions: {
          home: true,
          iatf: true,
          iatf_tools: true,
          csr: true,
          indicators: true,
          strategic_management: true,
          iso9001_docs: true,
          db_explorer: true,
          records: true
        }
      };
      setUsers([firstAdmin]);
      setCurrentUser(firstAdmin);
      return { success: true };
    }

    const found = users.find(u => u.username.toLowerCase() === trimmed.toLowerCase());
    if (found) {
      if (found.isBlocked) {
        return { success: false, error: 'این حساب کاربری توسط مدیریت مسدود شده است.' };
      }
      if (found.password && found.password !== passwordStr) {
        return { success: false, error: 'رمز عبور وارد شده اشتباه است.' };
      }
      // Update status
      const updatedUsers = users.map(u => u.id === found.id ? { ...u, isOnline: true, lastLoginAt: new Date().toISOString() } : u);
      setUsers(updatedUsers);
      setCurrentUser({ ...found, isOnline: true, lastLoginAt: new Date().toISOString() });
      return { success: true };
    }
    return { success: false, error: 'کاربری با این نام کاربری یافت نشد.' };
  }, [users]);

  const handleLogout = useCallback(() => {
    AuthManager.logout();
    setCurrentUser(null);
  }, []);

  const handleAddUser = useCallback((userToCreate: Omit<User, 'id'>) => {
    const newUser: User = {
      ...userToCreate,
      id: 'usr-' + Date.now()
    };
    setUsers(prev => [...prev, newUser]);
  }, []);

  const handleDeleteUser = useCallback((idToDelete: string) => {
    const user = users.find(u => u.id === idToDelete);
    const confirmTitle = lang === 'fa' ? '👤 حذف کاربر' : '👤 Delete User';
    const confirmMsg = lang === 'fa' 
      ? `آیا از حذف کاربر "${user?.fullName}" اطمینان دارید؟ دسترسی وی به تمام سیستم قطع خواهد شد.` 
      : `Are you sure you want to delete user "${user?.fullName}"? All system access will be revoked.`;
    
    setAppConfirmDialog({
      isOpen: true,
      title: confirmTitle,
      message: confirmMsg,
      onConfirm: () => {
        setUsers(prev => prev.filter(u => u.id !== idToDelete));
        setAppConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, [users, lang]);

  const handleUpdatePermissions = useCallback((userId: string, updatedPerms: User['permissions']) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, permissions: updatedPerms } : u));
  }, []);

  const handleUpdateUser = useCallback((updatedUser: User) => {
    const confirmTitle = lang === 'fa' ? '👤 تأیید ویرایش کاربر' : '👤 Confirm User Edit';
    const confirmMsg = lang === 'fa' 
      ? `آیا از ذخیره تغییرات برای کاربر "${updatedUser.fullName}" اطمینان دارید؟` 
      : `Are you sure you want to save changes for user "${updatedUser.fullName}"?`;
    
    setAppConfirmDialog({
      isOpen: true,
      title: confirmTitle,
      message: confirmMsg,
      onConfirm: () => {
        setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
        setCurrentUser(prev => prev && prev.id === updatedUser.id ? updatedUser : prev);
        setAppConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, [lang]);

  const handleAddTask = useCallback((taskToCreate: Omit<Task, 'id' | 'createdAt'>) => {
    setTasks(prev => {
      const uniqueId = QmsDatabase.enforceUniqueTaskAssignmentKey({
        assignedToUserId: taskToCreate.assignedTo,
        title: taskToCreate.title
      });

      const isDuplicate = prev.some(t => 
        t.id === uniqueId || 
        (t.assignedTo === taskToCreate.assignedTo && t.title === taskToCreate.title && t.status === 'pending')
      );

      if (isDuplicate) {
        console.warn('Duplicate task assignment prevented by Unique ID constraint.');
        return prev;
      }

      const newTask: Task = {
        ...taskToCreate,
        id: uniqueId,
        createdAt: new Date().toLocaleDateString('fa-IR')
      };
      return [...prev, newTask];
    });
  }, []);

  const handleUpdateTaskStatus = useCallback((taskId: string, status: Task['status'], feedback?: string) => {
    setTasks(prev => {
      const updated = prev.map(t => t.id === taskId ? { ...t, status, feedback } : t);
      const targetTask = updated.find(t => t.id === taskId);
      if (targetTask) {
        QmsDatabase.notifyTaskWorkflowStatusChange({
          taskId: targetTask.id,
          documentId: (targetTask as any).documentId,
          status: status as any,
          comment: feedback
        });
      }
      return updated;
    });
  }, []);

  const handleRejectProposal = useCallback((proposalId: string) => {
    setProposals(prev => prev.map(p => p.id === proposalId ? { ...p, status: 'rejected' as const } : p));
  }, []);

  const handleApproveProposal = useCallback((proposalId: string) => {
    setProposals(prev => {
      const updated = prev.map(p => p.id === proposalId ? { ...p, status: 'approved' as const } : p);
      const prop = prev.find(p => p.id === proposalId);
      
      if (prop) {
        // 1. STRATEGIC ITEMS
        if (prop.module === 'strategic_management' && prop.targetId.startsWith('clause_')) {
          try {
            const raw = localStorage.getItem('qms_strategic_items');
            let itemsList = raw ? JSON.parse(raw) : [];
            if (prop.type === 'CREATE') {
              itemsList.push(prop.proposedData);
            } else if (prop.type === 'UPDATE') {
              itemsList = itemsList.map((i: any) => i.id === prop.targetId ? { ...i, ...prop.proposedData } : i);
            } else if (prop.type === 'DELETE') {
              itemsList = itemsList.filter((i: any) => i.id !== prop.targetId);
            }
            localStorage.setItem('qms_strategic_items', JSON.stringify(itemsList));
            QmsDatabase.writeRow(QmsDatabase.TABLES.DOCUMENTS, 'qms_strategic_items_data', itemsList);
          } catch (err) {
            console.error(err);
          }
        }
        
        // 2. STRATEGIC EVALUATIONS
        if (prop.module === 'strategic_management' && prop.targetId.startsWith('eval_')) {
          try {
            const raw = localStorage.getItem('qms_strategic_evaluations');
            let evalList = raw ? JSON.parse(raw) : [];
            if (prop.type === 'CREATE') {
              evalList.push(prop.proposedData);
            } else if (prop.type === 'UPDATE') {
              evalList = evalList.map((r: any) => r.id === prop.targetId ? { ...r, ...prop.proposedData } : r);
            } else if (prop.type === 'DELETE') {
              evalList = evalList.filter((r: any) => r.id !== prop.targetId);
            }
            localStorage.setItem('qms_strategic_evaluations', JSON.stringify(evalList));
            
            const recordsMap: Record<string, any> = {};
            evalList.forEach((r: any) => {
              recordsMap[r.id] = r;
            });
            QmsDatabase.writeAll(QmsDatabase.TABLES.STRATEGIC_EVALUATIONS, recordsMap);
          } catch (err) {
            console.error(err);
          }
        }

        // 3. KPI INDICATORS
        if (prop.module === 'indicators') {
          setIndicatorsState(prevIndicators => {
            let nextIndicators = [...prevIndicators];
            if (prop.type === 'CREATE') {
              if (!nextIndicators.some(ind => ind.id === prop.targetId)) {
                nextIndicators.push(prop.proposedData);
              }
            } else if (prop.type === 'UPDATE') {
              nextIndicators = nextIndicators.map(ind => ind.id === prop.targetId ? { ...ind, ...prop.proposedData } : ind);
            } else if (prop.type === 'DELETE') {
              nextIndicators = nextIndicators.filter(ind => ind.id !== prop.targetId);
            }
            return nextIndicators;
          });
        }

        // 4. IATF TOOL SECTIONS
        if (prop.module === 'iatf_tools') {
          setIatfToolItems(prevTools => {
            let nextTools = [...prevTools];
            if (prop.type === 'CREATE') {
              if (!nextTools.some(t => t.id === prop.targetId)) {
                nextTools.push(prop.proposedData);
              }
            } else if (prop.type === 'UPDATE') {
              nextTools = nextTools.map(t => t.id === prop.targetId ? { ...t, ...prop.proposedData } : t);
            } else if (prop.type === 'DELETE') {
              nextTools = nextTools.filter(t => t.id !== prop.targetId);
            }
            return nextTools;
          });
        }
        
        setTimeout(() => {
          window.dispatchEvent(new Event('qms_db_updated'));
          window.dispatchEvent(new Event('qms-db-mutated'));
        }, 10);
      }
      return updated;
    });
  }, []);
  const [isCorrectiveActionPortalOpen, setIsCorrectiveActionPortalOpen] = useState(false);
  const [isDashboardDropdownOpen, setIsDashboardDropdownOpen] = useState(false);
  const [isIatfToolsDropdownOpen, setIsIatfToolsDropdownOpen] = useState(false);

  // Lifted IATF Tool list states
  const [iatfToolItems, setIatfToolItems] = useState<any[]>(() => {
    let baseList = [];
    try {
      QmsDatabase.initAndSynchronize();
      const dbSaved = QmsDatabase.selectRow<any[]>('documents_table', 'iatf_tooling_items_list');
      if (dbSaved && dbSaved.length > 0) {
        baseList = dbSaved;
      } else {
        const saved = localStorage.getItem('iatf_tooling_items');
        if (saved) {
          baseList = JSON.parse(saved);
        }
      }
    } catch (e) {
      console.error(e);
    }

    const initialLang = (typeof localStorage !== 'undefined' && localStorage.getItem('iatf_qms_lang') === 'en') ? 'en' : 'fa';
    const defaults = [
      {
        id: 'shortcut_audit_module_default',
        name: initialLang === 'fa' ? '🛡️ ماژول ممیزی داخلی کیفیت (بند 9.2.2.2)' : '🛡️ QMS Internal Audit Module (Clause 9.2.2.2)',
        description: initialLang === 'fa' ? 'برنامه ممیزی جامع، چک‌لیست‌های هوشمند همگام با CSR، گزارش‌دهی نهایی و ردیابی اقدامات اصلاحی متصل به ۸D' : 'Comprehensive audit programme, smart checklists aligned with CSR, report generation, and RCA-8D integration.',
        selectedClauses: ['9.2.2.2'],
        createdAt: new Date().toISOString(),
        shortcutType: 'portal',
        shortcutTarget: 'clause:9.2.2.2'
      },
      {
        id: 'shortcut_audit_calendar_default',
        name: initialLang === 'fa' ? 'تقویم داخلی سیستم (بند 9.2.2.1)' : 'Internal System Calendar (Clause 9.2.2.1)',
        description: initialLang === 'fa' ? 'برنامه‌ریزی، زمان‌بندی و پایش ممیزی‌های داخلی و انطباق استاندارد ممیزی با بند ۹.۲.۲.۱' : 'Schedule, track and review QMS internal audits, compliance milestones and notifications.',
        selectedClauses: ['9.2.2.1'],
        createdAt: new Date().toISOString(),
        shortcutType: 'portal',
        shortcutTarget: 'audit_calendar'
      },
      {
        id: 'shortcut_csr_default',
        name: initialLang === 'fa' ? 'همگام‌سازی و تحلیل انطباق الزامات خاص مشتری (بند 4.3.2)' : 'Customer Specific Requirements Compliance & Sync Hub (Clause 4.3.2)',
        description: initialLang === 'fa' ? 'سیستم مدیریت، انطباق‌سنجی و ردیابی الزامات خاص مشتریان صنعت خودرو' : 'Automotive Customer-Specific Requirements compliance analysis, mapping & synchronization ledger.',
        selectedClauses: ['4.3.2'],
        createdAt: new Date().toISOString(),
        shortcutType: 'portal',
        shortcutTarget: 'csr'
      },
      {
        id: 'shortcut_swi_default',
        name: initialLang === 'fa' ? 'دستالعمل‌های کاری استاندارد (SWI - بند 8.5.1.2)' : 'Standardized Work Instructions (SWI - Clause 8.5.1.2)',
        description: initialLang === 'fa' ? 'طراحی هوشمند گام‌های فرآیند، نمودار زمان‌سنجی چرخه‌ای و بوم SOS/JES' : 'Digital sequence planning, takt-cycle time balancing, and SOS/JES visual designer.',
        selectedClauses: ['8.5.1.2'],
        createdAt: new Date().toISOString(),
        shortcutType: 'document',
        shortcutTarget: 'دستورالعمل‌های کاری استاندارد (SWI)'
      },
      {
        id: 'shortcut_swot_default',
        name: initialLang === 'fa' ? 'ماتریس SWOT (بند 4.1)' : 'SWOT Matrix (Clause 4.1)',
        description: initialLang === 'fa' ? 'تحلیل نقاط قوت، ضعف، فرصت‌ها و تهدیدها بر اساس الزامات بند 4.1' : 'SWOT matrix analysis (Strengths, Weaknesses, Opportunities, Threats) for clause 4.1.',
        selectedClauses: ['4.1'],
        createdAt: new Date().toISOString(),
        shortcutType: 'document',
        shortcutTarget: 'ماتریس SWOT (نقاط قوت، ضعف، فرصت‌ها و تهدیدها)'
      },
      {
        id: 'shortcut_process_map_default',
        name: initialLang === 'fa' ? 'نقشه فرآیندهای سازمان (بند 4.4)' : 'Organization Process Map (Clause 4.4)',
        description: initialLang === 'fa' ? 'تعیین توالی، تعامل و پایش هوشمند فرآیندهای سازمان' : 'Interactions, sequences and KPIs mapping of organization processes.',
        selectedClauses: ['4.4'],
        createdAt: new Date().toISOString(),
        shortcutType: 'document',
        shortcutTarget: 'نقشه فرآیندهای سازمان'
      },
      {
        id: 'shortcut_process_profile_default',
        name: initialLang === 'fa' ? 'شناسنامه فرآیندها (بند 4.4)' : 'Process Profiles (Clause 4.4)',
        description: initialLang === 'fa' ? 'تعریف اهداف، ورودی‌ها/خروجی‌ها و شاخص‌های فرآیند بر اساس طرح لاک‌پشتی' : 'Process goals, inputs, outputs, competencies, resources & turtle diagrams.',
        selectedClauses: ['4.4'],
        createdAt: new Date().toISOString(),
        shortcutType: 'document',
        shortcutTarget: 'شناسنامه فرآیندها'
      },
      {
        id: 'shortcut_process_requirements_default',
        name: initialLang === 'fa' ? 'ماتریس فرآیندها-الزامات (بند 4.4)' : 'Process-Requirements Matrix (Clause 4.4)',
        description: initialLang === 'fa' ? 'ماتریس پویای انطباق فرآیندهای سازمان با بندهای استاندارد IATF 16949' : 'Dynamic compliance matrix connecting QMS processes to standard clauses.',
        selectedClauses: ['4.4'],
        createdAt: new Date().toISOString(),
        shortcutType: 'document',
        shortcutTarget: 'ماتریس فرآیندها-الزامات'
      },
      {
        id: 'shortcut_pfmea_default',
        name: initialLang === 'fa' ? 'تجزیه و تحلیل حالات خرابی (PFMEA - بند 8.3.5.2)' : 'Process FMEA (PFMEA - Clause 8.3.5.2)',
        description: initialLang === 'fa' ? 'شناسایی، ارزیابی ریسک و برنامه‌ریزی اقدامات کاهشی خرابی‌های بالقوه فرآیند تولید' : 'Process Failure Mode & Effects Analysis, risk evaluation, RPN calculation and containment.',
        selectedClauses: ['8.3.5.2'],
        createdAt: new Date().toISOString(),
        shortcutType: 'document',
        shortcutTarget: 'تجزیه و تحلیل حالات خرابی بالقوه فرآیند (PFMEA)'
      },
      {
        id: 'shortcut_pfd_default',
        name: initialLang === 'fa' ? 'نمودار جریان فرآیند (PFD - بند 8.3.5.2)' : 'Process Flow Diagram (PFD - Clause 8.3.5.2)',
        description: initialLang === 'fa' ? 'نمودار توالی گام‌های تولید، انتقال، کنترل و انبار ایستگاه‌های کاری' : 'Visual workplace stations flow sequence layout mapping with ASME symbols.',
        selectedClauses: ['8.3.5.2'],
        createdAt: new Date().toISOString(),
        shortcutType: 'document',
        shortcutTarget: 'نمودارجریان فرآیند(PFD)'
      },
      {
        id: 'shortcut_control_plan_default',
        name: initialLang === 'fa' ? 'طرح کنترل - تولید انبوه (Control Plan - بند 8.5.1.1)' : 'Control Plan - Mass Production (Clause 8.5.1.1)',
        description: initialLang === 'fa' ? 'طرح کنترل جامع فرآیند ساخت و ایستگاه‌های کنترلی فاز تولید انبوه' : 'Comprehensive Control Plan for manufacturing stages and inspection specifications.',
        selectedClauses: ['8.5.1.1'],
        createdAt: new Date().toISOString(),
        shortcutType: 'document',
        shortcutTarget: 'طرح کنترلی (Control Plan)'
      },
      {
        id: 'shortcut_coq_default',
        name: initialLang === 'fa' ? 'سند هزینه کیفیت (COQ - بند 9.1.3.1)' : 'Cost of Quality (COQ - Clause 9.1.3.1)',
        description: initialLang === 'fa' ? 'محاسبه، پایش و تحلیل هزینه‌های پیشگیری، ارزیابی، شکست‌های داخلی و خارجی بر اساس مدل PAF' : 'Identify, measure and optimize Prevention, Appraisal and Failure costs (PAF model).',
        selectedClauses: ['9.1.3.1'],
        createdAt: new Date().toISOString(),
        shortcutType: 'document',
        shortcutTarget: 'هزینه‌های کیفیت (Cost of Quality - COQ)'
      },
      {
        id: 'shortcut_job_setup_default',
        name: initialLang === 'fa' ? '📌 ماژول راه‌اندازی و تنظیمات کار (Job Setup - بند 8.5.1.3)' : '📌 Job Setup Verification (Clause 8.5.1.3)',
        description: initialLang === 'fa' ? 'ماژول داده‌محور، هوشمند، مبتنی بر Single Source of Truth و قوانین Rule Engine بر اساس IATF 16949 بند 8.5.1.3' : 'Data-driven, AI-integrated smart Job Setup Verification module compliant with IATF 16949 clause 8.5.1.3.',
        selectedClauses: ['8.5.1.3'],
        createdAt: new Date().toISOString(),
        shortcutType: 'document',
        shortcutTarget: 'JOB SETUP'
      },
      {
        id: 'shortcut_in_process_control_default',
        name: initialLang === 'fa' ? '📌 ماژول کنترل حین تولید (بند 8.5.1.1)' : '📌 In-Process Control Module (Clause 8.5.1.1)',
        description: initialLang === 'fa' ? 'ماژول داده‌محور، هوشمند و چک‌لیست ثبت نتایج کنترل حین تولید به تفکیک تجهیزات، اقلام ورودی و محصول خروجی هر ایستگاه کاری بر اساس IATF 16949 بند 8.5.1.1' : 'Workstation In-Process Control & Inspection Logging module compliant with IATF 16949 clause 8.5.1.1.',
        selectedClauses: ['8.5.1.1'],
        createdAt: new Date().toISOString(),
        shortcutType: 'portal',
        shortcutTarget: 'clause:8.5.1.1'
      }
    ];

    if (baseList.length === 0) {
      return defaults;
    }

    const mergedList = [...baseList];
    defaults.forEach(def => {
      const hasItem = mergedList.some(item => 
        item.id === def.id || 
        (item.shortcutType === def.shortcutType && item.shortcutTarget === def.shortcutTarget)
      );
      if (!hasItem) {
        mergedList.push(def);
      }
    });

    return mergedList;
  });

  const [activeIatfToolId, setActiveIatfToolId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('active_iatf_tool_id');
      if (saved) return saved;
    } catch {}
    return 'tool_1';
  });

  const [isAddToolModalOpen, setIsAddToolModalOpen] = useState(false);
  const [isEditToolModalOpen, setIsEditToolModalOpen] = useState(false);
  const [editingTool, setEditingTool] = useState<any | null>(null);
  const [newToolName, setNewToolName] = useState('');
  const [newToolDesc, setNewToolDesc] = useState('');

  const [appConfirmDialog, setAppConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Auto-sync tool items and active tool ID to LocalStorage and database
  useEffect(() => {
    try {
      localStorage.setItem('iatf_tooling_items', JSON.stringify(iatfToolItems));
      localStorage.setItem('active_iatf_tool_id', activeIatfToolId);
      QmsDatabase.writeRow('documents_table', 'iatf_tooling_items_list', iatfToolItems);
    } catch (e) {
      console.error(e);
    }
  }, [iatfToolItems, activeIatfToolId]);

  // Archived snapshots state
  const [records, setRecords] = useState<any[]>(() => {
    try {
      QmsDatabase.initAndSynchronize();
      const dbSaved = QmsDatabase.selectAll(QmsDatabase.TABLES.RECORDS);
      const list = Object.values(dbSaved || {});
      const initialLang = localStorage.getItem('iatf_qms_lang') === 'en' ? 'en' : 'fa';
      return getMergedRecordsLatest(initialLang, list);
    } catch {
      return [];
    }
  });

  // Indicators persistent state list
  const [indicatorsState, setIndicatorsState] = useState<Indicator[]>(() => {
    try {
      QmsDatabase.initAndSynchronize();
      const saved = QmsDatabase.selectAll(QmsDatabase.TABLES.INDICATORS);
      const list = Object.values(saved || {});
      if (list.length > 0) {
        return list.filter((ind: any) => ind && ind.id?.startsWith("doc-"));
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const indicators = useMemo(() => {
    if (!currentUser || currentUser.role === 'admin') return indicatorsState;
    const list = [...indicatorsState];
    const activeProposals = proposals.filter(p => p.status === 'pending' && p.module === 'indicators');
    
    activeProposals.forEach(p => {
      if (p.type === 'CREATE') {
        if (!list.some(i => i.id === p.targetId)) {
          list.push({
            ...p.proposedData,
            id: p.targetId,
            isPendingApproval: true,
            proposalId: p.id
          } as any);
        }
      } else if (p.type === 'UPDATE') {
        const idx = list.findIndex(i => i.id === p.targetId);
        if (idx !== -1) {
          list[idx] = {
            ...list[idx],
            ...p.proposedData,
            isPendingApproval: true,
            proposalId: p.id
          };
        }
      } else if (p.type === 'DELETE') {
        const idx = list.findIndex(i => i.id === p.targetId);
        if (idx !== -1) {
          list[idx] = {
            ...list[idx],
            isPendingDeletion: true,
            isPendingApproval: true,
            proposalId: p.id
          } as any;
        }
      }
    });
    return list;
  }, [indicatorsState, currentUser, proposals]);

  const setIndicators = (valOrFunc: any) => {
    if (currentUser && currentUser.role === 'user') {
      const prev = indicatorsState;
      const next = typeof valOrFunc === 'function' ? valOrFunc(prev) : valOrFunc;
      
      if (next.length > prev.length) {
        const added = next.filter((n: any) => !prev.some((p: any) => p.id === n.id));
        added.forEach((item: any) => {
          handleProposeChange('indicators', 'CREATE', item.id, item.titleFa || item.titleEn, item);
        });
      } else if (next.length < prev.length) {
        const deleted = prev.filter((p: any) => !next.some((n: any) => p.id === n.id));
        deleted.forEach((item: any) => {
          handleProposeChange('indicators', 'DELETE', item.id, item.titleFa || item.titleEn, item);
        });
      } else {
        next.forEach((item: any) => {
          const original = prev.find((p: any) => p.id === item.id);
          if (original && JSON.stringify(original) !== JSON.stringify(item)) {
            handleProposeChange('indicators', 'UPDATE', item.id, item.titleFa || item.titleEn, item);
          }
        });
      }
      alert(lang === 'fa' 
        ? 'تغییرات شما به عنوان یک پیشنهاد کاری با موفقیت ثبت شد و به کارتابل تأییدیه ادمین ارسال گردید.' 
        : 'Your changes have been registered as a work proposal and sent to the administrator queue.');
    } else {
      setIndicatorsState(valOrFunc);
    }
  };

  useEffect(() => {
    try {
      const recordsMap: Record<string, any> = {};
      indicatorsState.forEach(ind => {
        if (ind && ind.id) {
          recordsMap[ind.id] = ind;
        }
      });
      QmsDatabase.writeAll(QmsDatabase.TABLES.INDICATORS, recordsMap);
    } catch {}
  }, [indicatorsState]);

  // Language is provided as prop from master App provider wrapper

  // Dynamic Audit results for identifying incomplete records across tables with alerts
  const [auditResults, setAuditResults] = useState<AuditResults>(() => {
    return calculateIncompleteRecords();
  });

  const [documentInitialRiskTab, setDocumentInitialRiskTab] = useState<'processes' | 'matrix' | 'lessons' | 'risk_clause_matrix' | 'strategic_risks' | undefined>(undefined);

  const [hasIncompleteReplicatedRisks, setHasIncompleteReplicatedRisks] = useState<boolean>(() => {
    try {
      const savedStratEval = localStorage.getItem('qms_strategic_evaluations');
      const evalRows = savedStratEval ? JSON.parse(savedStratEval) : [];
      if (!Array.isArray(evalRows) || evalRows.length === 0) {
        return false;
      }

      const rawRisks = localStorage.getItem('iatf_draft_items_مدیریت ریسک و فرصت‌ها');
      if (rawRisks) {
        const items = JSON.parse(rawRisks);
        if (Array.isArray(items)) {
          return items.some(item => {
            if (item.type === 'strategic_risk') {
              const isReplicated = item.id && item.id.startsWith('strat-eval-replicated-');
              if (isReplicated) {
                const isRiskPending = item.field1 && item.field1.trim() !== '' && (!item.field2 || item.field2.includes('[نیاز به') || item.field2.trim() === '');
                const isOppPending = item.field3 && item.field3.trim() !== '' && (!item.field4 || item.field4.includes('[نیاز به') || item.field4.trim() === '');
                return isRiskPending || isOppPending;
              }
            }
            return false;
          });
        }
      }
    } catch {}
    return false;
  });

  const refreshAuditStatus = useCallback(() => {
    try {
      setAuditResults(calculateIncompleteRecords());
      
      const savedStratEval = localStorage.getItem('qms_strategic_evaluations');
      const evalRows = savedStratEval ? JSON.parse(savedStratEval) : [];
      if (!Array.isArray(evalRows) || evalRows.length === 0) {
        setHasIncompleteReplicatedRisks(false);
        return;
      }
      
      // Also check for pending replicated strategic risks for special warnings
      const rawRisks = localStorage.getItem('iatf_draft_items_مدیریت ریسک و فرصت‌ها');
      if (rawRisks) {
        const items = JSON.parse(rawRisks);
        if (Array.isArray(items)) {
          const incomplete = items.some(item => {
            if (item.type === 'strategic_risk') {
              const isReplicated = item.id && item.id.startsWith('strat-eval-replicated-');
              if (isReplicated) {
                const isRiskPending = item.field1 && item.field1.trim() !== '' && (!item.field2 || item.field2.includes('[نیاز به') || item.field2.trim() === '');
                const isOppPending = item.field3 && item.field3.trim() !== '' && (!item.field4 || item.field4.includes('[نیاز به') || item.field4.trim() === '');
                return isRiskPending || isOppPending;
              }
            }
            return false;
          });
          setHasIncompleteReplicatedRisks(incomplete);
          return;
        }
      }
      setHasIncompleteReplicatedRisks(false);
    } catch (e) {
      console.error("Error recalculating incomplete records: ", e);
    }
  }, []);

  // Sync state on external modifications or storage events
  useEffect(() => {
    const handleStorageChange = () => {
      setTimeout(() => {
        refreshAuditStatus();
      }, 0);
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('qms_db_updated', handleStorageChange);
    window.addEventListener('qms-db-mutated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('qms_db_updated', handleStorageChange);
      window.removeEventListener('qms-db-mutated', handleStorageChange);
    };
  }, [refreshAuditStatus]);

  const [globalTooltip, setGlobalTooltip] = useState<{
    text: string;
    x: number;
    y: number;
    visible: boolean;
  }>({ text: '', x: 0, y: 0, visible: false });

  // Global Hover Tooltip Listener for Long/Overflowing Texts
  useEffect(() => {
    let hoverTimer: any = null;
    let currentHoveredElement: HTMLElement | null = null;
    let currentHoveredText = '';

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const candidates = [target];
      if (target.parentElement) candidates.push(target.parentElement);
      if (target.parentElement?.parentElement) candidates.push(target.parentElement.parentElement);

      let foundOverflow = false;
      let overflowText = '';
      let foundElement: HTMLElement | null = null;

      for (const el of candidates) {
        if (!el) continue;
        const { isOverflowing, text } = checkIfElementOverflows(el);
        if (isOverflowing && text && text.trim().length > 0) {
          foundOverflow = true;
          overflowText = text;
          foundElement = el;
          break;
        }
      }

      if (foundOverflow && foundElement) {
        if (currentHoveredElement === foundElement && currentHoveredText === overflowText) {
          return;
        }

        clearTimeout(hoverTimer);
        currentHoveredElement = foundElement;
        currentHoveredText = overflowText;

        hoverTimer = setTimeout(() => {
          if (currentHoveredElement === foundElement) {
            const rect = foundElement.getBoundingClientRect();
            setGlobalTooltip({
              text: overflowText,
              x: rect.left + rect.width / 2,
              y: rect.top - 8,
              visible: true
            });
          }
        }, 120);
      } else {
        clearTimeout(hoverTimer);
        if (currentHoveredElement !== null || currentHoveredText !== '') {
          currentHoveredElement = null;
          currentHoveredText = '';
          setGlobalTooltip({ text: '', x: 0, y: 0, visible: false });
        }
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (currentHoveredElement && (!relatedTarget || !currentHoveredElement.contains(relatedTarget))) {
        clearTimeout(hoverTimer);
        currentHoveredElement = null;
        currentHoveredText = '';
        setGlobalTooltip({ text: '', x: 0, y: 0, visible: false });
      }
    };

    window.addEventListener('mouseover', handleMouseOver);
    window.addEventListener('mouseout', handleMouseOut);
    return () => {
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('mouseout', handleMouseOut);
      clearTimeout(hoverTimer);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('iatf_qms_lang', lang);
    } catch {}
  }, [lang]);

  // Sync archived NCs from the portal into records on NC updates
  useEffect(() => {
    const handleNcUpdated = () => {
      setTimeout(() => {
        try {
          const dbSaved = QmsDatabase.selectAll(QmsDatabase.TABLES.RECORDS);
          const list = Object.values(dbSaved || {});
          setRecords(getMergedRecordsLatest(lang, list));
        } catch (e) {
          console.error('Failed to sync NC records in App.tsx', e);
        }
      }, 0);
    };
    window.addEventListener('qms_nc_updated', handleNcUpdated);
    return () => {
      window.removeEventListener('qms_nc_updated', handleNcUpdated);
    };
  }, [lang]);

  const [hasOverdueCAPA, setHasOverdueCAPA] = useState<boolean>(false);
  const [overdueItems, setOverdueItems] = useState<any[]>([]);

  const checkOverdueCAPAAlarms = useCallback(() => {
    try {
      let stored = localStorage.getItem('qmsdb_v3_nc_items');
      const isRtl = lang === 'fa';
      
      if (!stored) {
        const initialSeed: any[] = [];
        localStorage.setItem('qmsdb_v3_nc_items', JSON.stringify(initialSeed));
        stored = JSON.stringify(initialSeed);
      }

      const list = JSON.parse(stored);
      if (Array.isArray(list)) {
        const CURRENT_MOCK_JALALI = getJalaliDate();
        const overdueUnjustifiedList = list.filter((n: any) => {
          if (!n) return false;
          if (n.status === 'CLOSED_CA') return false;
          // Ignore "For Information Only" items for overdue alarms
          if (n.responseType === 'INFO_ONLY') return false;
          // Turn off warning if has justification / delayReason set
          if (n.delayReason && n.delayReason.trim().length > 0) return false;
          
          const tDate = n.targetDate || '';
          if (!tDate) return false;
          // Lexicographical compare
          return tDate.replace(/\//g, '-') < CURRENT_MOCK_JALALI.replace(/\//g, '-');
        });
        setOverdueItems(overdueUnjustifiedList);
        setHasOverdueCAPA(overdueUnjustifiedList.length > 0);
      } else {
        setOverdueItems([]);
        setHasOverdueCAPA(false);
      }
    } catch (e) {
      setOverdueItems([]);
      setHasOverdueCAPA(false);
    }
  }, [lang]);

  useEffect(() => {
    checkOverdueCAPAAlarms();
    const timer = setInterval(() => {
      checkOverdueCAPAAlarms();
    }, 1500);

    const handleCheckOverdue = () => {
      setTimeout(() => {
        checkOverdueCAPAAlarms();
      }, 0);
    };

    window.addEventListener('storage', handleCheckOverdue);
    window.addEventListener('qms_nc_updated', handleCheckOverdue);

    return () => {
      clearInterval(timer);
      window.removeEventListener('storage', handleCheckOverdue);
      window.removeEventListener('qms_nc_updated', handleCheckOverdue);
    };
  }, [checkOverdueCAPAAlarms]);

  const t = uiTranslations[lang];

  // Custom Editable Header Title state with LocalStorage persistence
  const [headerTitle, setHeaderTitle] = useState(() => {
    try {
      return localStorage.getItem('iatf_project_header_title') || '';
    } catch {
      return '';
    }
  });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInputValue, setTitleInputValue] = useState('');

  const activeHeaderTitle = useMemo(() => {
    if (headerTitle) return headerTitle;
    return lang === 'fa' 
      ? 'سامانه مدیریت و ارزیابی جامع کیفیت خودرو (IATF 16949)' 
      : 'Automotive QMS & Standard Auditing Portal (IATF 16949)';
  }, [headerTitle, lang]);

  // Custom Logo uploader state with LocalStorage persistence
  const [logoUrl, setLogoUrl] = useState(() => {
    try {
      return localStorage.getItem('iatf_project_logo_url') || '';
    } catch {
      return '';
    }
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setLogoUrl(base64);
        try {
          localStorage.setItem('iatf_project_logo_url', base64);
        } catch (err) {
          console.error('Storage quota exceeded or unavailable', err);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLogoUrl('');
    try {
      localStorage.removeItem('iatf_project_logo_url');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveTitle = () => {
    const trimmed = titleInputValue.trim();
    setHeaderTitle(trimmed);
    setTitleInputValue(trimmed);
    try {
      localStorage.setItem('iatf_project_header_title', trimmed);
    } catch (err) {
      console.error(err);
    }
    setIsEditingTitle(false);
  };
  
  // Selected Clause ID state with on-the-fly translation references
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('iatf_selected_clause_id') || '4.1';
    } catch {
      return '4.1';
    }
  });

  useEffect(() => {
    if (selectedClauseId) {
      try {
        localStorage.setItem('iatf_selected_clause_id', selectedClauseId);
      } catch {}
    }
  }, [selectedClauseId]);

  // Organization Process Structure Tab & selections states
  const [sidebarTab, setSidebarTab] = useState<'iatf' | 'process'>('iatf');
  const [expandedProcesses, setExpandedProcesses] = useState<Record<string, boolean>>({});
  const [expandedClauses, setExpandedClauses] = useState<Record<string, boolean>>({});
  const [processSelection, setProcessSelection] = useState<{ type: 'process' | 'clause'; processId: string; processName: string; clauseId?: string | null } | null>(null);
  const [processTick, setProcessTick] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setTimeout(() => {
        setProcessTick(prev => prev + 1);
      }, 0);
    };
    window.addEventListener('qms-db-mutated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('qms-db-mutated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const expandAllClauses = () => {
    const all = flattenIatfClauses(iatfData);
    const newExpanded: Record<string, boolean> = {};
    for (const c of all) {
      newExpanded[c.id] = true;
    }
    setExpandedClauses(newExpanded);
  };

  const collapseAllClauses = () => {
    setExpandedClauses({});
  };

  const expandAllProcesses = () => {
    const matrixItems = generateProcessRequirementsMatrix();
    const newExpanded: Record<string, boolean> = {};
    for (const proc of matrixItems) {
      newExpanded[proc.id] = true;
    }
    setExpandedProcesses(newExpanded);
  };

  const collapseAllProcesses = () => {
    setExpandedProcesses({});
  };

  // Recent Activities (Views) states - strictly in-memory per user request
  const [recentViews, setRecentViews] = useState<Array<{
    id: string;
    type: 'clause' | 'document' | 'view';
    idOrName: string;
    labelFa: string;
    labelEn: string;
    timestamp: number;
  }>>([
    // Logical seed so it doesn't look empty initially
    {
      id: 'init-1',
      type: 'view',
      idOrName: 'home',
      labelFa: 'صفحه اصلی پورتال کیفیت',
      labelEn: 'Quality Portal Home Page',
      timestamp: Date.now() - 3600000
    },
    {
      id: 'init-2',
      type: 'clause',
      idOrName: '4.1',
      labelFa: 'بند ۴.۱: شناخت سازمان و بافت آن',
      labelEn: 'Clause 4.1: Understanding Organization and Context',
      timestamp: Date.now() - 1800000
    }
  ]);

  const [isRecentDropdownOpen, setIsRecentDropdownOpen] = useState(false);
  const [isAuditAlertsOpen, setIsAuditAlertsOpen] = useState(false);

  const trackRecentActivity = (
    type: 'clause' | 'document' | 'view',
    idOrName: string,
    labelFa: string,
    labelEn: string
  ) => {
    setRecentViews(prev => {
      // Filter out duplicates of same idOrName to keep it clean and top-ranked
      const filtered = prev.filter(item => !(item.type === type && item.idOrName === idOrName));
      const newItem = {
        id: `recent-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type,
        idOrName,
        labelFa,
        labelEn,
        timestamp: Date.now()
      };
      return [newItem, ...filtered].slice(0, 10);
    });
  };

  useEffect(() => {
    if (selectedClauseId) {
      trackRecentActivity(
        'clause',
        selectedClauseId,
        `بند ${selectedClauseId}: کاوشگر الزامات`,
        `Clause ${selectedClauseId}: Requirement Explorer`
      );
    }
  }, [selectedClauseId]);

  useEffect(() => {
    if (viewMode === 'home') {
      trackRecentActivity('view', 'home', 'صفحه اصلی پورتال کیفیت', 'Quality Portal Home Page');
    } else if (viewMode === 'iatf') {
      trackRecentActivity('view', 'iatf', 'راهنمای الزامات IATF 16949', 'IATF 16949 Requirements Guide');
    } else if (viewMode === 'csr') {
      trackRecentActivity('view', 'csr', 'مقایسه الزامات تکمیلی مشتریان (CSR)', 'Customer Specific Requirements (CSR)');
    } else if (viewMode === 'indicators') {
      trackRecentActivity('view', 'indicators', 'شاخص‌های کلیدی عملکرد (KPI)', 'Key Performance Indicators (KPI)');
    } else if (viewMode === 'assistant') {
      trackRecentActivity('view', 'assistant', 'دستیار هوشمند ارتقای کیفیت', 'AI Quality Assistant');
    } else if (viewMode === 'iso9001_docs') {
      trackRecentActivity('view', 'iso9001_docs', 'مدیریت مستندات ایزو ۹۰۰۱', 'ISO 9001 Document Manager');
    } else if (viewMode === 'db_explorer') {
      trackRecentActivity('view', 'db_explorer', 'مدیریت و مهندسی پایگاه داده QMS', 'QMS Database Engineering Console');
    } else if (viewMode === 'records') {
      trackRecentActivity('view', 'records', 'کتابخانه سوابق و مدارک سیستم', 'System Records & Documents Library');
    } else if (viewMode === 'strategic_management') {
      trackRecentActivity('view', 'strategic_management', 'برنامه‌ریزی استراتژیک (SWOT & PESTEL)', 'Strategic Management (SWOT & PESTEL)');
    } else if (viewMode === 'iatf_tools') {
      trackRecentActivity('view', 'iatf_tools', 'داشبورد ابزار IATF', 'IATF Tooling Dashboard');
    } else if (viewMode === 'team_management') {
      trackRecentActivity('view', 'team_management', 'مدیریت کاربری و تیمی', 'Team & User Management');
    }
  }, [viewMode]);

  useEffect(() => {
    if (isCorrectiveActionPortalOpen) {
      trackRecentActivity('view', 'corrective_actions', 'کارتابل کنترل اقدامات اصلاحی (8D)', 'Corrective Actions Portal (8D)');
    }
  }, [isCorrectiveActionPortalOpen]);

  // Internal Audit Calendar Tasks State & Warning calculation
  const [auditTasks, setAuditTasks] = useState<AuditTask[]>([]);
  
  useEffect(() => {
    const loadTasks = () => {
      const saved = localStorage.getItem('iatf_qms_internal_audit_tasks');
      if (saved) {
        try {
          setAuditTasks(JSON.parse(saved));
        } catch (e) {}
      }
    };
    loadTasks();
    
    // Listen for calendar updates
    window.addEventListener('qms-internal-audit-tasks-updated', loadTasks);
    return () => {
      window.removeEventListener('qms-internal-audit-tasks-updated', loadTasks);
    };
  }, []);

  const activeAuditAlerts = useMemo(() => {
    return getActiveAlerts(auditTasks);
  }, [auditTasks]);

  // State to store custom documents listed for each clause
  const [clauseDocuments, setClauseDocuments] = useState<Record<string, string[]>>(() => {
    try {
      QmsDatabase.initAndSynchronize();
      const dbSaved = QmsDatabase.selectAll(QmsDatabase.TABLES.CLAUSE_LINKS);
      let data: Record<string, string[]> = {};
      if (dbSaved && Object.keys(dbSaved).length > 0) {
        data = { ...dbSaved } as Record<string, string[]>;
      } else {
        const saved = localStorage.getItem('iatf_clause_documents');
        if (saved) {
          data = JSON.parse(saved);
        }
      }

      // Perform turtle rename migration
      if (data['4.4'] && data['4.4'].includes('لاک‌پشتی فرایندها (Turtle Diagrams)')) {
        data['4.4'] = data['4.4'].map((d: string) => 
          d === 'لاک‌پشتی فرایندها (Turtle Diagrams)' ? 'شناسنامه فرآیندها' : d
        );
      }

      // Perform internal audit checklist migration from 9.2.2.1 to 9.2.1
      let migrated = false;
      if (data['9.2.2.1'] && data['9.2.2.1'].includes('چک لیست ممیزی داخلی سیستم')) {
        data['9.2.2.1'] = data['9.2.2.1'].filter(d => d !== 'چک لیست ممیزی داخلی سیستم');
        const list921 = data['9.2.1'] || [];
        if (!list921.includes('چک لیست ممیزی داخلی سیستم')) {
          list921.push('چک لیست ممیزی داخلی سیستم');
        }
        data['9.2.1'] = list921;
        migrated = true;
      }

      // Remove Job Setup Verification from clause 8.5.1.3 documents if present in stored data
      if (data['8.5.1.3']) {
        const prevLen = data['8.5.1.3'].length;
        data['8.5.1.3'] = data['8.5.1.3'].filter(
          d => !d.includes('دستورالعمل و چک‌لیست راه‌اندازی و تنظیمات کار') && !d.includes('Job Setup Verification')
        );
        if (data['8.5.1.3'].length !== prevLen) {
          migrated = true;
        }
      }

      if (migrated) {
        QmsDatabase.writeAll(QmsDatabase.TABLES.CLAUSE_LINKS, data);
        try {
          localStorage.setItem('iatf_clause_documents', JSON.stringify(data));
        } catch {}
      }

      return data;
    } catch {
      return {};
    }
  });

  // State to store custom interpretations for clauses
  const [clauseInterpretations, setClauseInterpretations] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('iatf_clause_interpretations');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const handleUpdateInterpretation = useCallback((clauseId: string, newInterpretation: string) => {
    setClauseInterpretations(prev => {
      const next = { ...prev, [clauseId]: newInterpretation };
      try {
        localStorage.setItem('iatf_clause_interpretations', JSON.stringify(next));
      } catch (err) {
        console.error('Failed to save custom interpretation', err);
      }
      return next;
    });
  }, []);

  const handleAddClauseDocument = useCallback((clauseId: string, docName: string) => {
    if (!docName.trim()) return;
    setClauseDocuments(prev => {
      const clause = findClauseById(iatfData, clauseId);
      const existing = prev[clauseId] || clause?.documents || [];
      if (existing.includes(docName)) return prev;
      const updated = [...existing, docName];
      const next = { ...prev, [clauseId]: updated };
      QmsDatabase.writeAll(QmsDatabase.TABLES.CLAUSE_LINKS, next);
      return next;
    });
  }, []);

  const handleEditClauseDocument = useCallback((clauseId: string, oldDocName: string, newDocName: string) => {
    if (!newDocName.trim()) return;
    
    const confirmTitle = lang === 'fa' ? '📝 ویرایش نام مستند' : '📝 Edit Document Name';
    const confirmMsg = lang === 'fa' 
      ? `آیا از تغییر نام مستند از "${oldDocName}" به "${newDocName}" اطمینان دارید؟` 
      : `Are you sure you want to change document name from "${oldDocName}" to "${newDocName}"?`;

    setAppConfirmDialog({
      isOpen: true,
      title: confirmTitle,
      message: confirmMsg,
      onConfirm: () => {
        setClauseDocuments(prev => {
          const clause = findClauseById(iatfData, clauseId);
          const existing = prev[clauseId] || clause?.documents || [];
          const cleanOld = oldDocName.replace(/\s*\(ارجاع به بند.*\)/, '').trim().toLowerCase();
          const updated = existing.map(d => {
            const cleanD = d.replace(/\s*\(ارجاع به بند.*\)/, '').trim().toLowerCase();
            return cleanD === cleanOld ? newDocName : d;
          });
          const next = { ...prev, [clauseId]: updated };
          QmsDatabase.writeAll(QmsDatabase.TABLES.CLAUSE_LINKS, next);
          return next;
        });
        setAppConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, [lang]);

  const handleDeleteClauseDocument = useCallback((clauseId: string, docName: string) => {
    const confirmTitle = lang === 'fa' ? '📄 حذف مستند' : '📄 Delete Document';
    const confirmMsg = lang === 'fa' 
      ? `آیا از حذف سند "${docName}" از این بند استاندارد اطمینان دارید؟` 
      : `Are you sure you want to delete document "${docName}" from this clause?`;
    
    setAppConfirmDialog({
      isOpen: true,
      title: confirmTitle,
      message: confirmMsg,
      onConfirm: () => {
        setClauseDocuments(prev => {
          const clause = findClauseById(iatfData, clauseId);
          const existing = prev[clauseId] || clause?.documents || [];
          const cleanDocToDelete = docName.replace(/\s*\(ارجاع به بند.*\)/, '').trim().toLowerCase();
          const updated = existing.filter(d => {
            const cleanD = d.replace(/\s*\(ارجاع به بند.*\)/, '').trim().toLowerCase();
            return cleanD !== cleanDocToDelete;
          });
          const next = { ...prev, [clauseId]: updated };
          QmsDatabase.writeAll(QmsDatabase.TABLES.CLAUSE_LINKS, next);
          return next;
        });
        setAppConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, [lang]);

  const handleArchiveDocument = useCallback((clauseId: string, docName: string) => {
    try {
      const cleanDocName = docName.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
      
      // 1. Fetch live document table content
      const dbDocs = QmsDatabase.selectAll(QmsDatabase.TABLES.DOCUMENTS);
      const docItems = dbDocs[cleanDocName] || [];
      
      let finalItems = docItems;
      if (!Array.isArray(finalItems) || finalItems.length === 0) {
        const localDraft = localStorage.getItem(`iatf_draft_items_${cleanDocName}`);
        if (localDraft) {
          finalItems = JSON.parse(localDraft);
        } else {
          const tpl = documentTemplates[cleanDocName];
          if (tpl) {
            finalItems = tpl.items || [];
          }
        }
      }

      // 2. Fetch control metadata for this document
      const controlData = QmsDatabase.selectRow<any>(QmsDatabase.TABLES.DOCUMENT_CONTROL, cleanDocName);
      const code = controlData?.code || `QMS-REC-${clauseId.replace(/\./g, '_')}-${Math.floor(Math.random() * 90 + 10)}`;
      const revision = controlData?.revision || '۰۱';
      const preparedBy = controlData?.preparedBy || 'مدیر تضمین کیفیت';
      const approvedBy = controlData?.approvedBy || 'مدیریت ارشد';

      // 3. Create the record structure
      const recordId = `rec-${Date.now()}`;
      const JalaliDate = new Intl.DateTimeFormat('fa-IR', {
        calendar: 'persian',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }).format(new Date());

      const newRecord = {
        id: recordId,
        documentName: cleanDocName,
        clauseId,
        archivedAt: JalaliDate,
        items: JSON.parse(JSON.stringify(finalItems)),
        code,
        revision,
        preparedBy,
        approvedBy,
        timestamp: Date.now()
      };

      // 4. Update the records table
      QmsDatabase.writeRow(QmsDatabase.TABLES.RECORDS, recordId, newRecord);
      
      // Refresh local state
      const dbSaved = QmsDatabase.selectAll(QmsDatabase.TABLES.RECORDS);
      const list = Object.values(dbSaved || {});
      setRecords(getMergedRecordsLatest(lang, list));

      return true;
    } catch (e) {
      console.error('Failed to archive document snapshot:', e);
      return false;
    }
  }, [lang]);

  const handleDeleteRecord = useCallback((recordId: string) => {
    const confirmTitle = lang === 'fa' ? '🗄️ حذف رکورد' : '🗄️ Delete Record';
    const confirmMsg = lang === 'fa' 
      ? `آیا از حذف دائمی این رکورد اطلاعاتی اطمینان دارید؟` 
      : `Are you sure you want to permanently delete this data record?`;
    
    setAppConfirmDialog({
      isOpen: true,
      title: confirmTitle,
      message: confirmMsg,
      onConfirm: () => {
        try {
          if (recordId.startsWith('nc-rec-')) {
            const ncId = recordId.replace('nc-rec-', '');
            const storedNc = localStorage.getItem('qmsdb_v3_nc_items');
            if (storedNc) {
              const ncItems = JSON.parse(storedNc);
              if (Array.isArray(ncItems)) {
                const updated = ncItems.map((n: any) => {
                  if (n && n.id === ncId) {
                    return { ...n, isArchived: false };
                  }
                  return n;
                });
                localStorage.setItem('qmsdb_v3_nc_items', JSON.stringify(updated));
                window.dispatchEvent(new Event('qms_nc_updated'));
              }
            }
          } else {
            QmsDatabase.deleteRow(QmsDatabase.TABLES.RECORDS, recordId);
            // Refresh local state
            const dbSaved = QmsDatabase.selectAll(QmsDatabase.TABLES.RECORDS);
            const list = Object.values(dbSaved || {});
            setRecords(getMergedRecordsLatest(lang, list));
          }
        } catch (e) {
          console.error('Failed to delete record:', e);
        }
        setAppConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  }, [lang]);

  // Lifted Tool CRUD handlers
  const handleCreateTool = () => {
    if (!newToolName.trim()) {
      alert(lang === 'fa' ? 'لطفاً نام ابزار را وارد نمایید.' : 'Please enter a tool name.');
      return;
    }
    const newTool = {
      id: `tool_${Date.now()}`,
      name: newToolName.trim(),
      description: newToolDesc.trim(),
      selectedClauses: [],
      createdAt: new Date().toISOString()
    };
    const nextItems = [...iatfToolItems, newTool];
    setIatfToolItems(nextItems);
    setActiveIatfToolId(newTool.id);
    setViewMode('iatf_tools');
    setNewToolName('');
    setNewToolDesc('');
    setIsAddToolModalOpen(false);
  };

  const handleEditToolSave = () => {
    if (!editingTool || !editingTool.name.trim()) return;
    const nextItems = iatfToolItems.map(item => {
      if (item.id === editingTool.id) {
        return {
          ...item,
          name: editingTool.name.trim(),
          description: editingTool.description.trim()
        };
      }
      return item;
    });
    setIatfToolItems(nextItems);
    setIsEditToolModalOpen(false);
    setEditingTool(null);
  };

  const handleDeleteTool = (idToDelete: string, name: string) => {
    const confirmTitle = lang === 'fa' ? '🗑️ حذف ابزار تخصصی' : '🗑️ Delete Specialized Tool';
    const confirmMsg = lang === 'fa' 
      ? `آیا مطمئن هستید که می‌خواهید ابزار تخصصی "${name}" را به طور کامل حذف کنید؟ این عمل غیرقابل بازگشت است.`
      : `Are you sure you want to permanently delete the tool "${name}"? This action cannot be undone.`;

    setAppConfirmDialog({
      isOpen: true,
      title: confirmTitle,
      message: confirmMsg,
      onConfirm: () => {
        const nextItems = iatfToolItems.filter(i => i.id !== idToDelete);
        setIatfToolItems(nextItems);
        if (activeIatfToolId === idToDelete) {
          setActiveIatfToolId(nextItems[0]?.id || '');
        }
        setAppConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleCreateShortcutToIatfTools = () => {
    let shortcutName = '';
    let shortcutDesc = '';
    let shortcutType: 'document' | 'portal' = 'portal';
    let shortcutTarget = '';

    const isRtl = lang === 'fa';

    if (isCorrectiveActionPortalOpen) {
      shortcutName = isRtl ? 'کارتابل کنترل اقدامات اصلاحی (8D / RCA)' : 'Corrective Actions Control Portal (8D / RCA)';
      shortcutDesc = isRtl ? 'میانبر مستقیم به سیستم اقدامات اصلاحی و RCA' : 'Direct shortcut to Corrective Actions & RCA';
      shortcutType = 'portal';
      shortcutTarget = 'corrective_actions';
    } else if (editingDoc) {
      shortcutName = editingDoc.title;
      shortcutDesc = isRtl ? `میانبر به سند کیفیت: ${editingDoc.title}` : `Shortcut to document: ${editingDoc.title}`;
      shortcutType = 'document';
      shortcutTarget = editingDoc.title;
    } else if (viewMode === 'csr') {
      shortcutName = isRtl ? 'مدیریت و انطباق هوشمند الزامات خاص مشتریان' : 'Smart Management & Alignment of Customer-Specific Requirements';
      shortcutDesc = isRtl ? 'میانبر به تحلیل انطباق الزامات خاص مشتری' : 'Direct shortcut to CSR Gap Analysis';
      shortcutType = 'portal';
      shortcutTarget = 'csr';
    } else if (viewMode === 'indicators') {
      shortcutName = isRtl ? 'داشبورد هوشمند پایش شاخص‌های عملکرد پایانه' : 'QMS Performance & Measurement Indicators Portal';
      shortcutDesc = isRtl ? 'میانبر به مانیتورینگ شاخص‌های کلیدی عملکرد' : 'Direct shortcut to KPI Indicators';
      shortcutType = 'portal';
      shortcutTarget = 'indicators';
    } else if (viewMode === 'iso9001_docs') {
      shortcutName = isRtl ? 'کنترل اسناد و مدارک جامع بر اساس الزامات ISO 9001 (بند ۷.۵)' : 'ISO 9001 Comprehensive Document Control & Coding (Clause 7.5)';
      shortcutDesc = isRtl ? 'میانبر به سامانه مستندات ایزو' : 'Direct shortcut to ISO Documents';
      shortcutType = 'portal';
      shortcutTarget = 'iso9001_docs';
    } else if (viewMode === 'db_explorer') {
      shortcutName = isRtl ? 'مرکز مدیریت و کاوشگر پایگاه داده یکپارچه (QMS-DB)' : 'Relational QMS-DB Explorer & Core Engine';
      shortcutDesc = isRtl ? 'میانبر به پایگاه داده و جداول سیستم' : 'Direct shortcut to QMS Relational DB';
      shortcutType = 'portal';
      shortcutTarget = 'db_explorer';
    } else if (viewMode === 'records') {
      shortcutName = isRtl ? 'بایگانی و سوابق هوشمند کیفیت' : 'QMS Quality Records & Snapshots';
      shortcutDesc = isRtl ? 'میانبر به بایگانی سوابق ممیزی و کیفیت' : 'Direct shortcut to Records Ledger';
      shortcutType = 'portal';
      shortcutTarget = 'records';
    } else if (viewMode === 'strategic_management') {
      shortcutName = isRtl ? 'داشبورد کنترل و پایش مدیریت استراتژیک' : 'Strategic Management Control Terminal';
      shortcutDesc = isRtl ? 'میانبر به ذینفعان، SWOT و ریسک‌های استراتژیک' : 'Direct shortcut to SWOT & Strategic Management';
      shortcutType = 'portal';
      shortcutTarget = 'strategic_management';
    } else if (viewMode === 'iatf' && selectedClauseId === '9.2.2.1') {
      shortcutName = isRtl ? 'تقویم داخلی سیستم (بند 9.2.2.1)' : 'Internal System Calendar (Clause 9.2.2.1)';
      shortcutDesc = isRtl ? 'برنامه‌ریزی، زمان‌بندی و پایش ممیزی‌های داخلی و انطباق استاندارد ممیزی با بند ۹.۲.۲.۱' : 'Schedule, track and review QMS internal audits, compliance milestones and notifications.';
      shortcutType = 'portal';
      shortcutTarget = 'audit_calendar';
    } else if (viewMode === 'audit_calendar') {
      shortcutName = isRtl ? 'تقویم داخلی سیستم (بند 9.2.2.1)' : 'Internal System Calendar (Clause 9.2.2.1)';
      shortcutDesc = isRtl ? 'برنامه‌ریزی، زمان‌بندی و پایش ممیزی‌های داخلی و انطباق استاندارد ممیزی با بند ۹.۲.۲.۱' : 'Schedule, track and review QMS internal audits, compliance milestones and notifications.';
      shortcutType = 'portal';
      shortcutTarget = 'audit_calendar';
    } else if (viewMode === 'iatf') {
      if (selectedClauseId === '8.5.1.1') {
        shortcutName = isRtl ? 'کنترل حین تولید' : 'In-Process Control';
        shortcutDesc = isRtl ? 'چک‌لیست هوشمند و فرم ثبت نتایج کنترل حین تولید به تفکیک تجهیزات، اقلام ورودی و محصول خروجی هر ایستگاه کاری' : 'Workstation In-Process Control Checklist & Results';
        shortcutType = 'portal';
        shortcutTarget = 'clause:8.5.1.1';
      } else if (selectedClauseId === '8.5.1.3') {
        shortcutName = isRtl ? 'صحه گذاری تنظیمات و راه‌اندازی (Job Setup)' : 'Verification of Job Setups (Clause 8.5.1.3)';
        shortcutDesc = isRtl ? 'تست و صحه‌گذاری راه‌اندازی، مجوزهای شروع تولید و کنترل حین تولید' : 'Job Setup verification, production permits, and control checklists';
        shortcutType = 'portal';
        shortcutTarget = 'clause:8.5.1.3';
      } else if (selectedClauseId) {
        shortcutName = isRtl ? `بند استاندارد ${selectedClauseId}` : `IATF Clause ${selectedClauseId}`;
        shortcutDesc = isRtl ? `میانبر به بند ${selectedClauseId} و مستندات مربوطه` : `Shortcut to clause ${selectedClauseId}`;
        shortcutType = 'portal';
        shortcutTarget = `clause:${selectedClauseId}`;
      } else {
        shortcutName = isRtl ? 'ساختار درختی IATF' : 'IATF Clause Tree';
        shortcutDesc = isRtl ? 'میانبر به درختواره الزامات استاندارد IATF' : 'Direct shortcut to IATF Clause Tree';
        shortcutType = 'portal';
        shortcutTarget = 'iatf';
      }
    } else {
      shortcutName = isRtl ? 'میز کار هوم' : 'Home Desk';
      shortcutDesc = isRtl ? 'میانبر به کارتابل اصلی سیستم' : 'Direct shortcut to Home Dashboard';
      shortcutType = 'portal';
      shortcutTarget = 'home';
    }

    // Check if shortcut already exists
    const exists = iatfToolItems.some(item => item.shortcutType === shortcutType && item.shortcutTarget === shortcutTarget);
    if (exists) {
      setToastNotification({
        message: isRtl 
          ? 'میانبر این صفحه قبلاً در داشبورد ابزار IATF ایجاد شده است.' 
          : 'A shortcut for this page already exists in the IATF Tools Dashboard.',
        type: 'warning'
      });
      return;
    }

    const newShortcut = {
      id: `shortcut_${Date.now()}`,
      name: shortcutName,
      description: shortcutDesc,
      selectedClauses: selectedClauseId ? [selectedClauseId] : [],
      createdAt: new Date().toISOString(),
      shortcutType,
      shortcutTarget
    };

    const updatedTools = [...iatfToolItems, newShortcut];
    setIatfToolItems(updatedTools);
    
    setToastNotification({
      message: isRtl 
        ? `میانبر «${shortcutName}» با موفقیت ساخته شد و به منوی داشبورد ابزارهای IATF اضافه گردید.` 
        : `Shortcut for "${shortcutName}" has been successfully added to the IATF Tools Dashboard.`,
      type: 'success'
    });

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setToastNotification(null);
    }, 5000);
  };

  // Localize standard standard clauses and dynamically deduplicate documents
  const localizedIatfData = useMemo(() => {
    const seenDocs = new Map<string, string>(); // lowercase clean name -> original clause number

    const translateList = (list: IATFClause[]): IATFClause[] => {
      return list.map(c => {
        const eng = iatfEnglishData[c.id];
        
        // Load customized documents list if present, otherwise fall back to clause.documents
        const baseDocs = clauseDocuments[c.id] || c.documents || [];
        
        // Deduplicate and rewrite referencing strings to ensure absolute global uniqueness
        const nextDocs: string[] = [];
        baseDocs.forEach(doc => {
          const cleanName = doc.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
          const lowerClean = cleanName.toLowerCase();
          
          if (!seenDocs.has(lowerClean)) {
            seenDocs.set(lowerClean, c.number);
            nextDocs.push(cleanName);
          }
        });

        // Determine correct interpretation text (prioritize custom edited one of current clause)
        const defaultInterp = lang === 'en' ? (eng?.interpretation || c.interpretation) : c.interpretation;
        const currentInterp = clauseInterpretations[c.id] || defaultInterp;

        return {
          ...c,
          title: lang === 'en' ? (eng?.title || c.title) : c.title,
          text: lang === 'en' ? (eng?.text || c.text) : c.text,
          interpretation: currentInterp,
          documents: nextDocs,
          subClauses: c.subClauses ? translateList(c.subClauses) : undefined
        };
      });
    };
    return translateList(iatfData);
  }, [lang, clauseDocuments, clauseInterpretations]);

  const selectedClause = useMemo(() => {
    if (!selectedClauseId) return null;
    return findClauseById(localizedIatfData, selectedClauseId);
  }, [localizedIatfData, selectedClauseId]);

  const totalClausesCount = useMemo(() => {
    const countAll = (list: IATFClause[]): number => {
      let count = 0;
      list.forEach(c => {
        count += 1;
        if (c.subClauses) {
          count += countAll(c.subClauses);
        }
      });
      return count;
    };
    return countAll(iatfData);
  }, []);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Project Mode State (Development / Construction vs User / Public Mode)
  const [projectMode, setProjectMode] = useState<'development' | 'user'>(() => {
    try {
      const saved = localStorage.getItem('iatf_project_mode');
      return (saved === 'user') ? 'user' : 'development';
    } catch {
      return 'development';
    }
  });

  // Track documents created during development mode (cannot be deleted in user mode)
  const [devCreatedDocs, setDevCreatedDocs] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('iatf_docs_created_in_dev');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  
  // Document interaction state
  const [editingDoc, setEditingDoc] = useState<DocTemplate | null>(null);
  const [customDocuments, setCustomDocuments] = useState<Record<string, any>>(() => {
    try {
      QmsDatabase.initAndSynchronize();
      const dbDocs = QmsDatabase.selectAll(QmsDatabase.TABLES.DOCUMENTS);
      if (dbDocs && Object.keys(dbDocs).length > 0) {
        return dbDocs;
      }
      const saved = localStorage.getItem('iatf_docs');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.error('Initial load failed', e);
      return {};
    }
  });

  // CSR state persistent lists
  const [csrDocuments, setCsrDocuments] = useState<CsrDocument[]>(() => {
    try {
      QmsDatabase.initAndSynchronize();
      // Clear old legacy localStorage keys to ensure complete cleanliness
      localStorage.removeItem('iatf_csr_docs');
      
      const dbSaved = QmsDatabase.selectRow<CsrDocument[]>(QmsDatabase.TABLES.DOCUMENTS, 'csr_documents_store');
      if (dbSaved && Array.isArray(dbSaved)) return dbSaved;
      return [];
    } catch (e) {
      console.error(e);
      return [];
    }
  });

  const [csrComparisons, setCsrComparisons] = useState<CsrComparisonItem[]>(() => {
    try {
      QmsDatabase.initAndSynchronize();
      // Clear old legacy localStorage keys to ensure complete cleanliness
      localStorage.removeItem('iatf_csr_comparisons');

      const dbAll = QmsDatabase.selectAll<CsrComparisonItem>(QmsDatabase.TABLES.CSR_MAPPINGS);
      if (dbAll && Object.keys(dbAll).length > 0) {
        return Object.values(dbAll);
      }
      return [];
    } catch (e) {
      console.error(e);
      return [];
    }
  });

  // Save CSR data strictly to database on transition
  useEffect(() => {
    try {
      QmsDatabase.writeRow(QmsDatabase.TABLES.DOCUMENTS, 'csr_documents_store', csrDocuments);
    } catch (e) {
      console.error(e);
    }
  }, [csrDocuments]);

  useEffect(() => {
    try {
      // Replicate strictly to standard relational tables in QA/QMS Db Engine
      const recordSet: Record<string, any> = {};
      csrComparisons.forEach((item, idx) => {
        const rid = item.id || item.customerId || `csr-${idx}-${Date.now()}`;
        recordSet[rid] = { ...item, id: rid };
      });
      // Import into standard DB table directly to trigger schema counts & transactions logging
      QmsDatabase.writeAll(QmsDatabase.TABLES.CSR_MAPPINGS, recordSet);
    } catch (e) {
      console.error(e);
    }
  }, [csrComparisons]);

  // Sync smart indicators across process specification cards (شناسنامه فرآیندها) and Quality Objectives (اهداف کیفی)
  useEffect(() => {
    const extracted: Array<{
      id: string;
      type: 'process' | 'quality_objective' | 'short_term' | 'long_term';
      titleFa: string;
      titleEn: string;
      clauseId: string;
      target: number;
      unit: string;
      actual?: number;
    }> = [];

    const allDocNames = Object.keys(customDocuments);

    allDocNames.forEach(docName => {
      const cleanDocName = docName.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
      const template = documentTemplates[cleanDocName];
      const items = customDocuments[docName];
      if (!Array.isArray(items)) return;

      const isTurtleDoc = template?.smartType === 'TURTLE';
      const isKpiObjectiveDoc = template?.smartType === 'KPI_OBJECTIVE';

      if (isTurtleDoc || isKpiObjectiveDoc) {
        items.forEach(item => {
          let clauseId = item.clauseId || '';
          if (!clauseId) {
            if (isTurtleDoc) {
              clauseId = '4.4';
            } else if (isKpiObjectiveDoc) {
              clauseId = '6.2';
            }
          }

          let type: 'process' | 'quality_objective' | 'short_term' | 'long_term' = 'process';
          if (isKpiObjectiveDoc) {
            type = 'quality_objective';
          } else if (isTurtleDoc) {
            type = 'process';
          }

          if (isTurtleDoc && item.indicators && Array.isArray(item.indicators) && item.indicators.length > 0) {
            // Extract multiple performance indicators defined inside this process
            item.indicators.forEach((ind: any) => {
              const kpiTitle = ind.title || ind.field7 || '';
              if (!kpiTitle || typeof kpiTitle !== 'string' || !kpiTitle.trim()) return;
              extracted.push({
                id: `doc-${docName}-${item.id}-kpi-${ind.id}`,
                type: 'process',
                titleFa: kpiTitle.trim(),
                titleEn: ind.titleEn ? ind.titleEn.trim() : kpiTitle.trim(),
                clauseId: item.clauseId || clauseId,
                target: typeof ind.target === 'number' ? ind.target : parseFloat(ind.target) ?? 100,
                actual: typeof ind.actual === 'number' ? ind.actual : parseFloat(ind.actual) ?? 0,
                unit: ind.unit || '%',
              });
            });
          } else {
            // Default single-indicator matching
            let rawTitle = '';
            if (isTurtleDoc) {
              rawTitle = item.field7 || item.field1;
            } else {
              rawTitle = item.field1;
            }

            if (!rawTitle || typeof rawTitle !== 'string' || !rawTitle.trim()) return;

            const titleFa = rawTitle.trim();
            const titleEn = item.field1_en || titleFa;

            const target = typeof item.target === 'number' ? item.target : parseFloat(item.target) || 100;
            const actual = typeof item.actual === 'number' ? item.actual : parseFloat(item.actual) || 0;
            const unit = item.unit || '%';

            extracted.push({
              id: `doc-${docName}-${item.id}`,
              type,
              titleFa,
              titleEn,
              clauseId,
              target,
              unit,
              actual
            });
          }
        });
      }
    });

    if (extracted.length === 0) {
      setIndicators([]);
      return;
    }

    setIndicators(prev => {
      const extractedMap = new Map(extracted.map(e => [e.id, e]));
      const docIdsSet = new Set(extracted.map(e => e.id));

      // Filter out any indicators that do NOT belong to current list of extracted document indicators
      const baseIndicators = prev.filter(ind => {
        return docIdsSet.has(ind.id);
      });

      // Update existing ones
      const updatedIndicators = baseIndicators.map(ind => {
        const fresh = extractedMap.get(ind.id);
        if (fresh) {
          extractedMap.delete(ind.id);

          const periodLabel = "ارزیابی جاری";
          const recordsCopy = [...ind.records];
          const existingRecordIndex = recordsCopy.findIndex(r => r.period === periodLabel);

          if (typeof fresh.actual === 'number') {
            if (existingRecordIndex > -1) {
              recordsCopy[existingRecordIndex] = {
                ...recordsCopy[existingRecordIndex],
                value: fresh.actual
              };
            } else {
              recordsCopy.push({
                period: periodLabel,
                value: fresh.actual,
                isArchived: false
              });
            }
          }

          return {
            ...ind,
            type: fresh.type,
            titleFa: fresh.titleFa,
            titleEn: fresh.titleEn,
            clauseId: fresh.clauseId,
            target: fresh.target,
            unit: fresh.unit,
            records: recordsCopy
          };
        }
        return ind;
      });

      // Add brand new ones
      const newIndicators: Indicator[] = [];
      extractedMap.forEach(fresh => {
        const records = typeof fresh.actual === 'number' ? [
          { period: "شروع / پایه", value: fresh.actual * 0.95, isArchived: true },
          { period: "ارزیابی جاری", value: fresh.actual, isArchived: false }
        ] : [];

        newIndicators.push({
          id: fresh.id,
          type: fresh.type,
          titleFa: fresh.titleFa,
          titleEn: fresh.titleEn,
          clauseId: fresh.clauseId,
          target: fresh.target,
          unit: fresh.unit,
          records
        });
      });

      return [...updatedIndicators, ...newIndicators];
    });
  }, [customDocuments]);

  // Synchronize created documents in development mode
  useEffect(() => {
    if (projectMode === 'development') {
      const createdInDev = Object.entries(customDocuments)
        .filter(([_, items]) => Array.isArray(items) && items.length > 0)
        .map(([title, _]) => title.replace(/\s*\(ارجاع به بند.*\)/, '').trim());
      
      const merged = Array.from(new Set([...devCreatedDocs, ...createdInDev]));
      if (JSON.stringify(merged) !== JSON.stringify(devCreatedDocs)) {
        setDevCreatedDocs(merged);
        try {
          localStorage.setItem('iatf_docs_created_in_dev', JSON.stringify(merged));
        } catch (e) {
          console.error('Failed to save iatf_docs_created_in_dev', e);
        }
      }
    }
  }, [customDocuments, projectMode, devCreatedDocs]);

  // Handle deletion of document content
  const handleDeleteDocument = (docName: string) => {
    let cleanDocName = docName.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
    if (
      cleanDocName === 'Risk and Opportunity Management' ||
      cleanDocName === 'Risk & Opportunity FMEA' ||
      cleanDocName === 'مدیریت ریسک‌ها و فرصت‌ها' ||
      cleanDocName === 'مدیریت ریسک و فرصت‌ها'
    ) {
      cleanDocName = 'مدیریت ریسک و فرصت‌ها';
    }

    if (projectMode === 'user' && devCreatedDocs.includes(cleanDocName)) {
      alert(lang === 'fa'
        ? 'خطای امنیتی: این مستند در حالت ساخت و توسعه پروژه ایجاد شده است و در حالت استفاده کاربری و عمومی قابل حذف نمی‌باشد!'
        : 'Security Error: This document was created during project construction & development mode and cannot be deleted in public user mode!'
      );
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: lang === 'fa' ? '🗑️ حذف کامل سند' : '🗑️ Delete Document Content',
      message: lang === 'fa'
        ? `آیا مطمئن هستید که می‌خواهید کل محتوای سند "${cleanDocName}" را حذف کنید؟ این عمل غیرقابل بازگشت است.`
        : `Are you sure you want to delete all content for the document "${cleanDocName}"? This action is irreversible.`,
      onConfirm: () => {
        // Remove from customDocuments state
        const updated = { ...customDocuments };
        delete updated[cleanDocName];
        delete updated[docName];
        setCustomDocuments(updated);

        // Delete row from database
        QmsDatabase.deleteRow(QmsDatabase.TABLES.DOCUMENTS, cleanDocName);
        QmsDatabase.deleteRow(QmsDatabase.TABLES.DOCUMENTS, docName);

        // Also remove from devCreatedDocs tracker if deleted in development mode
        if (projectMode === 'development') {
          const nextDevDocs = devCreatedDocs.filter(d => d !== cleanDocName);
          setDevCreatedDocs(nextDevDocs);
          try {
            localStorage.setItem('iatf_docs_created_in_dev', JSON.stringify(nextDevDocs));
          } catch {}
        }

        handleDbModifiedRefresh();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Handle resetting a document back to default template
  const handleResetDocumentToDefault = (docName: string) => {
    let cleanDocName = docName.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
    if (
      cleanDocName === 'Risk and Opportunity Management' ||
      cleanDocName === 'Risk & Opportunity FMEA' ||
      cleanDocName === 'مدیریت ریسک‌ها و فرصت‌ها' ||
      cleanDocName === 'مدیریت ریسک و فرصت‌ها'
    ) {
      cleanDocName = 'مدیریت ریسک و فرصت‌ها';
    }

    setConfirmModal({
      isOpen: true,
      title: lang === 'fa' ? '🔄 بازنشانی سند به پیش‌فرض' : '🔄 Reset Document to Default',
      message: lang === 'fa'
        ? `آیا مطمئن هستید که می‌خواهید سند "${cleanDocName}" را به قالب پیش‌فرض اولیه بازگردانید؟ تمامی تغییرات اعمال شده روی سطرهای این سند پاک خواهند شد.`
        : `Are you sure you want to revert the document "${cleanDocName}" to its original default template? All your modifications to this document rows will be cleared.`,
      onConfirm: () => {
        const success = QmsDatabase.restoreTableToDefault('doc_' + cleanDocName);
        if (success) {
          const dbDocs = QmsDatabase.selectAll(QmsDatabase.TABLES.DOCUMENTS);
          setCustomDocuments(dbDocs || {});
          handleDbModifiedRefresh();
          
          alert(lang === 'fa'
            ? `سند "${cleanDocName}" با موفقیت به حالت پیش‌فرض اولیه بازنشانی شد.`
            : `Document "${cleanDocName}" successfully reset to standard template defaults.`
          );
        } else {
          alert(lang === 'fa'
            ? 'خطا در بازنشانی سند به قالب پیش‌فرض.'
            : 'Error resetting document to template defaults.'
          );
        }
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const updateDocKpiValue = useCallback((indicatorId: string, newValue: number) => {
    setCustomDocuments(prevDocs => {
      const updatedDocs = { ...prevDocs };
      let foundAndUpdated = false;

      for (const docName of Object.keys(updatedDocs)) {
        const items = updatedDocs[docName];
        if (!Array.isArray(items)) continue;

        const updatedItems = items.map(item => {
          const simpleId = `doc-${docName}-${item.id}`;
          if (indicatorId === simpleId) {
            foundAndUpdated = true;
            return {
              ...item,
              actual: newValue
            };
          }

          if (item.indicators && Array.isArray(item.indicators)) {
            let nestedUpdated = false;
            const updatedIndicators = item.indicators.map((ind: any) => {
              const nestedId = `doc-${docName}-${item.id}-kpi-${ind.id}`;
              if (indicatorId === nestedId) {
                foundAndUpdated = true;
                nestedUpdated = true;
                return {
                  ...ind,
                  actual: newValue
                };
              }
              return ind;
            });

            if (nestedUpdated) {
              return {
                ...item,
                indicators: updatedIndicators,
                actual: newValue
              };
            }
          }

          return item;
        });

        if (foundAndUpdated) {
          updatedDocs[docName] = updatedItems;
          try {
            localStorage.setItem('iatf_docs', JSON.stringify(updatedDocs));
          } catch (e) {
            console.error('Failed to save updated docs', e);
          }
          break;
        }
      }

      return updatedDocs;
    });
  }, []);

  const getProgress = useCallback((clause: IATFClause): number => {
    const getAllDocs = (c: IATFClause): string[] => {
      let docs = [...(c.documents || [])];
      if (c.subClauses) {
        c.subClauses.forEach(sub => {
          docs = [...docs, ...getAllDocs(sub)];
        });
      }
      return Array.from(new Set(docs));
    };

    const targetDocs = getAllDocs(clause);
    if (targetDocs.length === 0) return 0;

    let satisfiedCount = 0;
    targetDocs.forEach(docName => {
      if (customDocuments[docName] && customDocuments[docName].length > 0) {
        satisfiedCount++;
      }
    });

    return (satisfiedCount / targetDocs.length) * 100;
  }, [customDocuments]);

  const handleDocumentClick = (docName: string) => {
    setIsSidebarOpen(false);
    let cleanDocName = docName.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
    if (
      cleanDocName === 'Risk and Opportunity Management' ||
      cleanDocName === 'Risk & Opportunity FMEA' ||
      cleanDocName === 'مدیریت ریسک‌ها و فرصت‌ها' ||
      cleanDocName === 'مدیریت ریسک و فرصت‌ها'
    ) {
      cleanDocName = 'مدیریت ریسک و فرصت‌ها';
    }
    trackRecentActivity('document', cleanDocName, `سند کیفیت: ${cleanDocName}`, `Quality Doc: ${cleanDocName}`);
    if (
      cleanDocName === 'JOB SETUP' || 
      cleanDocName === 'Job Setup' || 
      cleanDocName.toLowerCase().includes('job setup') || 
      cleanDocName.includes('راه‌اندازی و تنظیمات کار') ||
      cleanDocName.includes('8.5.1.3')
    ) {
      setViewMode('iatf');
      setSelectedClauseId('8.5.1.3');
      setIsCorrectiveActionPortalOpen(false);
      return;
    }
    if (cleanDocName.includes('کارتابل کنترل اقدامات اصلاحی') || cleanDocName === 'Corrective Actions Control Portal (8D / RCA)') {
      setIsCorrectiveActionPortalOpen(true);
      return;
    }
    const template = documentTemplates[cleanDocName] || Object.values(documentTemplates).find((t: any) => t.title === cleanDocName) || getGenericTemplate(cleanDocName);
    
    // Look up in Relational Core Database directly to load real records fresh
    const dbItems = QmsDatabase.selectRow<DocItem[]>(QmsDatabase.TABLES.DOCUMENTS, cleanDocName);
    const existingItems = dbItems || customDocuments[cleanDocName] || customDocuments[docName];
    
    // Inject drafted items if already available, else use template defaults
    const activeTemplate = {
      ...template,
      title: cleanDocName, // Ensure we use the clean title
      items: existingItems || template.items
    };

    setEditingDoc(activeTemplate);
  };

  const handleSaveDocument = (items: DocItem[], columns?: ColumnDefinition[], newTitle?: string, optionalTemplateTitle?: string, optionalSmartType?: string) => {
    let key = optionalTemplateTitle || (editingDoc ? editingDoc.title : '');
    if (!key) return;
    if (
      key === 'Risk and Opportunity Management' ||
      key === 'Risk & Opportunity FMEA' ||
      key === 'مدیریت ریسک‌ها و فرصت‌ها' ||
      key === 'مدیریت ریسک و فرصت‌ها'
    ) {
      key = 'مدیریت ریسک و فرصت‌ها';
    }
    let finalKey = newTitle ? newTitle.trim() : key;
    if (
      finalKey === 'Risk and Opportunity Management' ||
      finalKey === 'Risk & Opportunity FMEA' ||
      finalKey === 'مدیریت ریسک‌ها و فرصت‌ها' ||
      finalKey === 'مدیریت ریسک و فرصت‌ها'
    ) {
      finalKey = 'مدیریت ریسک و فرصت‌ها';
    }

    const updated = {
      ...customDocuments,
      [finalKey]: items
    };
    if (key !== finalKey) {
      delete updated[key];
      QmsDatabase.deleteRow(QmsDatabase.TABLES.DOCUMENTS, key);
    }
    setCustomDocuments(updated);
    
    // Write inside Relational Emulator database row
    QmsDatabase.writeRow(QmsDatabase.TABLES.DOCUMENTS, finalKey, items);

    const sType = optionalSmartType || (editingDoc ? editingDoc.smartType : '');

    // If saving process definitions, auto-generate the Process-Requirements-Matrix!
    if (sType === 'TURTLE' || finalKey.includes('شناسنامه') || finalKey.includes('لاک‌پشتی')) {
      try {
        const matrixRows = generateProcessRequirementsMatrix();
        const matrixKey = 'ماتریس فرآیندها-الزامات';
        QmsDatabase.writeRow(QmsDatabase.TABLES.DOCUMENTS, matrixKey, matrixRows);
        localStorage.setItem(`iatf_draft_items_${matrixKey}`, JSON.stringify(matrixRows));
        updated[matrixKey] = matrixRows;
      } catch (e) {
        console.error('Failed to auto-generate process matrix upon save:', e);
      }
    }

    // Auto-generate Quality Management System Internal Audit Checklist
    if (
      sType === 'TURTLE' || 
      sType === 'PROCESS_MATRIX' || 
      finalKey.includes('شناسنامه') || 
      finalKey.includes('لاک‌پشتی') || 
      finalKey === 'ماتریس فرآیندها-الزامات'
    ) {
      try {
        const auditRows = generateInternalAuditChecklist();
        const auditKey = 'چک لیست ممیزی داخلی سیستم';
        QmsDatabase.writeRow(QmsDatabase.TABLES.DOCUMENTS, auditKey, auditRows);
        localStorage.setItem(`iatf_draft_items_${auditKey}`, JSON.stringify(auditRows));
        updated[auditKey] = auditRows;

        // Ensure 9.2.1 contains the new checklist instead of 9.2.2.1
        setClauseDocuments(prev => {
          const next = { ...prev };
          
          // Remove from 9.2.2.1 if present
          if (next['9.2.2.1']) {
            next['9.2.2.1'] = next['9.2.2.1'].filter(d => d !== 'چک لیست ممیزی داخلی سیستم');
          }

          // Add to 9.2.1
          const existing = next['9.2.1'] || [];
          if (!existing.includes('چک لیست ممیزی داخلی سیستم')) {
            const updatedDocs = [...existing, 'چک لیست ممیزی داخلی سیستم'];
            next['9.2.1'] = updatedDocs;
          }
          
          QmsDatabase.writeAll(QmsDatabase.TABLES.CLAUSE_LINKS, next);
          return next;
        });
      } catch (e) {
        console.error('Failed to auto-generate internal audit checklist upon save:', e);
      }
    }

    if (columns) {
      try {
        localStorage.setItem(`iatf_draft_cols_${finalKey}`, JSON.stringify(columns));
        if (key !== finalKey) {
          localStorage.removeItem(`iatf_draft_cols_${key}`);
        }
      } catch (e) {
        console.error('Failed to save custom columns schema', e);
      }
    }
    
    // Log the update timestamp for dependency tracking
    QmsDatabase.logDocumentSaved(finalKey);
    
    // Trigger database states refresh seamlessly
    handleDbModifiedRefresh();
    if (sType !== 'SWI') {
      setEditingDoc(null);
    }
  };

  const handleDbModifiedRefresh = useCallback(() => {
    QmsDatabase.initAndSynchronize();
    const dbDocs = QmsDatabase.selectAll(QmsDatabase.TABLES.DOCUMENTS);
    setCustomDocuments(dbDocs || {});
    const dbClauseLinks = QmsDatabase.selectAll(QmsDatabase.TABLES.CLAUSE_LINKS);
    setClauseDocuments(dbClauseLinks || {});
    const dbIndicators = QmsDatabase.selectAll(QmsDatabase.TABLES.INDICATORS);
    const indicatorsList = Object.values(dbIndicators || {});
    setIndicators(indicatorsList.filter((ind: any) => ind && ind.id?.startsWith("doc-")));
    
    // Refresh records
    const dbRecords = QmsDatabase.selectAll(QmsDatabase.TABLES.RECORDS);
    const list = Object.values(dbRecords || {});
    setRecords(getMergedRecordsLatest(lang, list));
    refreshAuditStatus();
  }, [lang, refreshAuditStatus]);

  // Quiet Startup Auto-Pull synchronizer for Google Drive & OneDrive (Live Shell Mode)
  useEffect(() => {
    const runStartupCloudPull = async () => {
      try {
        const config = QmsDatabase.getSyncConfig();
        if (!config || !config.liveShell || config.mode === 'local') return;

        if (config.mode === 'gdrive' && config.gdrive?.accessToken) {
          console.log('[Startup Sync] Checking Google Drive for updates...');
          let fileId = config.gdrive.fileId;
          const token = config.gdrive.accessToken;
          const fileName = config.gdrive.fileName || 'qms_database_store.json';
          
          if (!fileId) {
            fileId = await CloudDriveSyncService.findGDriveFile(token, fileName);
          }
          if (fileId) {
            const cloudData = await CloudDriveSyncService.downloadGDriveFile(token, fileId);
            if (cloudData) {
              const successful = QmsDatabase.restoreFullSchemaJson(JSON.stringify(cloudData));
              if (successful) {
                console.log('[Startup Sync] Successfully auto-pulled QMS database from Google Drive.');
                handleDbModifiedRefresh();
              }
            }
          }
        } else if (config.mode === 'onedrive' && config.onedrive?.accessToken) {
          console.log('[Startup Sync] Checking OneDrive for updates...');
          const token = config.onedrive.accessToken;
          const fileName = config.onedrive.fileName || 'qms_database_store.json';
          const cloudData = await CloudDriveSyncService.downloadOneDriveFile(token, fileName);
          if (cloudData) {
            const successful = QmsDatabase.restoreFullSchemaJson(JSON.stringify(cloudData));
            if (successful) {
              console.log('[Startup Sync] Successfully auto-pulled QMS database from OneDrive.');
              handleDbModifiedRefresh();
            }
          }
        }
      } catch (err) {
        console.warn('[Quiet Startup Cloud Sync Pull omitted/unauthenticated]', err);
      }
    };

    if (typeof window !== 'undefined' && navigator.onLine) {
      // Delay slightly on startup to let local storage stabilize first
      const startTimer = setTimeout(() => {
        runStartupCloudPull();
      }, 800);
      return () => clearTimeout(startTimer);
    }
  }, [handleDbModifiedRefresh]);

  // Clause tree filter on localized database objects
  const filteredClauses = useMemo(() => {
    if (!searchQuery.trim()) return localizedIatfData;
    const query = searchQuery.toLowerCase();

    // Helper to search string/number values inside any array or object recursively
    const searchInObject = (obj: any): boolean => {
      if (!obj) return false;
      if (typeof obj === 'string') {
        return obj.toLowerCase().includes(query);
      }
      if (typeof obj === 'number' || typeof obj === 'boolean') {
        return String(obj).toLowerCase().includes(query);
      }
      if (Array.isArray(obj)) {
        return obj.some(item => searchInObject(item));
      }
      if (typeof obj === 'object') {
        return Object.values(obj).some(val => searchInObject(val));
      }
      return false;
    };

    const checkMatch = (item: IATFClause): boolean => {
      // 1. Direct clause fields
      const inNumber = item.number.toLowerCase().includes(query);
      const inTitle = item.title.toLowerCase().includes(query);
      const inText = item.text.toLowerCase().includes(query);
      const inInterpretation = item.interpretation.toLowerCase().includes(query);
      const inDocs = (item.documents || []).some(doc => doc.toLowerCase().includes(query));
      
      if (inNumber || inTitle || inText || inInterpretation || inDocs) {
        return true;
      }

      // 2. Custom document files content (created by users under customDocuments state or DB)
      let matchesCustomDocs = false;
      if (item.documents && item.documents.length > 0) {
        for (const docName of item.documents) {
          const cleanDocName = docName.replace(/\s*\(ارجاع به بند.*\)/, '').replace(/\s*\(.*\)/, '').trim();
          
          const customDocItems = customDocuments[docName] || customDocuments[cleanDocName];
          if (customDocItems && searchInObject(customDocItems)) {
            matchesCustomDocs = true;
            break;
          }

          try {
            const dbDocItems = QmsDatabase.selectRow<any[]>('documents_table', docName) || 
                               QmsDatabase.selectRow<any[]>('documents_table', cleanDocName);
            if (dbDocItems && searchInObject(dbDocItems)) {
              matchesCustomDocs = true;
              break;
            }
          } catch {}
        }
      }
      if (matchesCustomDocs) return true;

      // 3. Compliance evidence & archived records
      const clauseRecords = records.filter(r => r && r.clauseId === item.id);
      if (clauseRecords.length > 0 && searchInObject(clauseRecords)) {
        return true;
      }

      // 4. Indicators and metrics
      const clauseIndicators = indicators.filter(ind => ind && ind.clauseId === item.id);
      if (clauseIndicators.length > 0 && searchInObject(clauseIndicators)) {
        return true;
      }

      // 5. Corrective action/NC records
      let matchesNcs = false;
      try {
        const ncItems = QmsDatabase.selectAll<any>('nc_items_table') || {};
        const ncList = Object.values(ncItems);
        const clauseNcs = ncList.filter((nc: any) => nc && (nc.clauseId === item.id || nc.clause === item.id));
        if (clauseNcs.length > 0 && searchInObject(clauseNcs)) {
          matchesNcs = true;
        }
      } catch {}
      if (matchesNcs) return true;

      // 6. Annual internal audit calendar tasks (for clause 9.2.2.1)
      let matchesCalendarTasks = false;
      if (item.id === '9.2.2.1') {
        try {
          const savedTasks = localStorage.getItem('iatf_qms_internal_audit_tasks');
          if (savedTasks) {
            const tasksArray = JSON.parse(savedTasks);
            if (searchInObject(tasksArray)) {
              matchesCalendarTasks = true;
            }
          }
        } catch {}
      }
      if (matchesCalendarTasks) return true;

      return false;
    };

    const filterFn = (list: IATFClause[]): IATFClause[] => {
      return list.reduce((acc: IATFClause[], item) => {
        const matchesSelf = checkMatch(item);
        const filteredSubs = item.subClauses ? filterFn(item.subClauses) : [];
        
        if (matchesSelf || filteredSubs.length > 0) {
          acc.push({
            ...item,
            subClauses: filteredSubs.length > 0 ? filteredSubs : undefined
          });
        }
        return acc;
      }, []);
    };
    
    return filterFn(localizedIatfData);
  }, [searchQuery, localizedIatfData, customDocuments, records, indicators]);

  if (!currentUser) {
    return <LoginView onLoginSuccess={(u) => setCurrentUser(u)} logoUrl={logoUrl} />;
  }

  return (
    <div 
      className="h-screen bg-[#0A0A0B] text-[#E0E0E0] flex flex-col font-sans overflow-hidden" 
      dir={lang === 'fa' ? 'rtl' : 'ltr'}
    >
      {/* Exquisite Top-Center Toast Notifications */}
      {toastNotification && (
        <div 
          className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] max-w-md w-[90%] bg-[#121215] border border-amber-500/35 text-white px-5 py-4 rounded-xl shadow-2xl flex items-center gap-3.5 select-none cursor-pointer"
          style={{ animation: 'fadeInDown 0.3s ease-out' }}
          onClick={() => setToastNotification(null)}
        >
          <div className="flex h-7 w-7 rounded-full bg-amber-500/10 items-center justify-center text-amber-400 border border-amber-500/25 shrink-0">
            📌
          </div>
          <div className="flex-1 text-right">
            <p className="text-xs font-bold leading-relaxed">{toastNotification.message}</p>
          </div>
          <button 
            type="button" 
            className="text-zinc-500 hover:text-white transition-colors cursor-pointer text-xs ml-1"
            onClick={(e) => {
              e.stopPropagation();
              setToastNotification(null);
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="h-20 border-b border-[#2A2A2D] bg-[#121214] flex items-center justify-between px-4 sm:px-8 gap-4 shrink-0 relative z-50">
        <div className="flex items-center gap-3 overflow-hidden">
          {/* Custom Logo Image Box with File Upload capability */}
          <div className="relative group w-12 h-12 bg-[#1A1A1D] border border-dashed border-[#3E3E43] rounded-lg overflow-hidden flex items-center justify-center transition-all hover:border-amber-500/50 shrink-0">
            {logoUrl ? (
              <>
                <img src={logoUrl} alt="logo" className="w-full h-full object-contain p-1" />
                {currentUser?.role === 'admin' && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    title={t.uploadLogo}
                    className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-500 transition-opacity cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </>
            ) : currentUser?.role === 'admin' ? (
              <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer gap-0.5 select-none text-center">
                <ImageIcon size={15} className="text-slate-500 group-hover:text-amber-500 transition-colors" />
                <span className="text-[7px] text-slate-500 group-hover:text-amber-500 transition-colors tracking-tight">
                  {lang === 'fa' ? 'آپلود لوگو' : 'LOGO'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            ) : (
              <Shield size={18} className="text-amber-500" />
            )}
          </div>

          {/* Org Name / Project Title with Live inline Editor */}
          <div className="flex flex-col justify-center min-w-0">
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5 animate-fade-in">
                <input
                  type="text"
                  value={titleInputValue}
                  onChange={(e) => setTitleInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') {
                      setTitleInputValue(activeHeaderTitle);
                      setIsEditingTitle(false);
                    }
                  }}
                  autoFocus
                  className="bg-[#1A1A1D] text-white border border-amber-500/50 rounded px-2 py-0.5 text-xs font-sans outline-none focus:ring-1 focus:ring-amber-500 w-44 sm:w-72"
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1 bg-green-500 hover:bg-green-400 text-black rounded transition-colors cursor-pointer"
                  title="Save"
                >
                  <Check size={11} />
                </button>
                <button
                  onClick={() => {
                    setTitleInputValue(activeHeaderTitle);
                    setIsEditingTitle(false);
                  }}
                  className="p-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors cursor-pointer"
                  title="Cancel"
                >
                  <X size={11} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 group/title">
                {hasOverdueCAPA && (
                  <span className="flex h-2.5 w-2.5 shrink-0 relative" title={lang === 'fa' ? "هشدار کیفیتی: اقدام اصلاحی معوق" : "Quality Alarm: Overdue Corrective Action"}>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-650 bg-red-600"></span>
                  </span>
                )}
                <h1 
                  className={`text-xs sm:text-sm md:text-base font-bold text-white line-clamp-1 ${currentUser?.role === 'admin' ? 'transition-colors cursor-pointer hover:text-amber-400' : ''}`}
                  onClick={() => {
                    if (currentUser?.role === 'admin') {
                      setTitleInputValue(activeHeaderTitle);
                      setIsEditingTitle(true);
                    }
                  }}
                >
                  {activeHeaderTitle}
                </h1>
                {currentUser?.role === 'admin' && (
                  <button
                    onClick={() => {
                      setTitleInputValue(activeHeaderTitle);
                      setIsEditingTitle(true);
                    }}
                    className="opacity-0 group-hover/title:opacity-100 p-0.5 hover:bg-[#1A1A1D] rounded text-amber-500 transition-all shrink-0 cursor-pointer"
                    title="Rename portal"
                  >
                    <Edit2 size={11} />
                  </button>
                )}
              </div>
            )}
            <span className="text-[8px] text-[#666] font-mono tracking-wider hidden sm:block uppercase">
              IATF 16949:2016 QUALITY SYSTEM PORTAL • CUSTOM ENTERPRISE VIEW
            </span>
          </div>
        </div>

        {/* Live clock, language toggle, and navigation switchers */}
        <div className="flex items-center gap-1.5 sm:gap-3 z-40 max-w-full whitespace-nowrap">
          {/* Active Product Selector Badge & Dropdown in Header */}
          <div className="relative group/prod shrink-0 z-50">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 rounded-xl text-[11px] font-bold transition-all cursor-pointer shadow">
              <Package size={12} className="shrink-0 text-amber-500" />
              <span className="truncate max-w-[120px] sm:max-w-[200px]">
                {activeProduct ? activeProduct.name : (lang === 'fa' ? 'بدون محصول' : 'No Product')}
              </span>
              <ChevronDown size={11} className="shrink-0 opacity-60 group-hover/prod:rotate-180 transition-transform" />
            </div>

            {/* Dropdown panel */}
            <div className={`absolute top-full mt-1.5 w-60 sm:w-72 bg-[#0c0c0e] border border-[#232328] rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.85)] p-2 hidden group-hover/prod:block transition-all duration-200 ${lang === 'fa' ? 'left-0' : 'right-0'}`}>
              <div className="px-2.5 py-1.5 text-[9px] text-zinc-500 border-b border-[#1b1b20] font-black uppercase tracking-wider mb-1.5 text-right">
                {lang === 'fa' ? 'انتخاب و تعویض محصول فعال' : 'Switch Active Workspace Product'}
              </div>

              <div className="space-y-1 max-h-56 overflow-y-auto">
                {products.map(p => {
                  const isActive = p.id === selectedProductId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelectedProductId(p.id)}
                      className={`w-full text-right px-2.5 py-2 rounded-lg text-xs transition-all flex items-center justify-between cursor-pointer ${
                        isActive 
                          ? 'bg-amber-500/10 text-amber-500 font-bold border border-amber-500/25' 
                          : 'text-zinc-350 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      {isActive && <Check size={11} className="text-amber-500 shrink-0" />}
                      <div className="min-w-0 flex-1 pl-2 text-right">
                        <div className="font-bold truncate text-white">{p.name}</div>
                        <div className="text-[9px] text-[#666] font-mono mt-0.5">PN: {p.technicalNumber}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-[#1b1b20] pt-2 mt-2 px-1 text-center">
                <button
                  onClick={() => {
                    setViewMode('home');
                  }}
                  className="w-full py-1 text-[10px] text-zinc-400 hover:text-white transition-all font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Home size={10} />
                  <span>{lang === 'fa' ? 'تعریف و پایش محصولات در صفحه هوم' : 'Manage Products on Home'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Overdue CAPA Hazard/Security Alert Icon - Beautiful Solid Red Warning Indicator (Only Icon per user request) */}
          {hasOverdueCAPA && (
            <div className="relative group z-30">
              <button
                onClick={() => {
                  setViewMode('iatf');
                  setSelectedClauseId('10.2.1');
                }}
                className="flex items-center justify-center p-2 bg-red-950/20 hover:bg-red-950/55 border border-red-500 text-red-500 rounded-lg select-none cursor-pointer transition-all shrink-0 shadow-sm relative group"
                title={lang === 'fa' ? "⚠️ هشدار عدم انطباق معوق و فاقد توجیه - کلیک جهت هدایت به کارتابل" : "⚠️ Unresolved Overdue Corrective Actions - Click to navigate"}
              >
                <AlertTriangle size={15} className="text-red-500 shrink-0" />
                <span className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-red-600 border border-[#0D0D10] text-[8px] font-black text-white leading-none shadow-sm">
                  {overdueItems.length}
                </span>
              </button>

              {/* Enhanced Tooltip Popover detailing overdue items */}
              <div className={`absolute top-full mt-2.5 w-72 bg-[#101012] border border-red-500/40 rounded-xl shadow-[0_15px_35px_rgba(0,0,0,0.9)] p-3.5 z-50 hidden group-hover:block transition-all duration-300 animate-fade-in ${lang === 'fa' ? 'left-0' : 'right-0'}`}>
                <div className="text-[10px] font-bold text-red-500 mb-2 pb-1.5 border-b border-red-500/20 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <AlertTriangle size={11} className="text-red-500 shrink-0" />
                    <strong>{lang === 'fa' ? 'لیست موارد دارای تأخیر ممیزی:' : 'Audit Overdue Alert List:'}</strong>
                  </span>
                  <span className="text-[9px] bg-red-500/10 text-red-500 border border-red-500/25 px-1.5 py-0.5 rounded-full font-mono">{overdueItems.length} {lang === 'fa' ? 'مورد' : 'NCs'}</span>
                </div>
                
                <div className="space-y-2 max-h-44 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-red-500">
                  {overdueItems.map(item => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setViewMode('iatf');
                        setSelectedClauseId('10.2.1');
                      }}
                      className="p-2 bg-red-950/15 hover:bg-red-950/35 border border-red-500/10 hover:border-red-500/30 rounded-lg cursor-pointer transition-all"
                    >
                      <div className="flex justify-between items-center text-[10px] font-black text-red-400 mb-1">
                        <span>{item.id}</span>
                        <span className="font-mono bg-red-950/70 border border-red-500/30 px-1.5 py-0.4 rounded text-[8px] text-red-350">{item.targetDate}</span>
                      </div>
                      <p className="text-[10px] text-slate-350 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-2.5 pt-2 border-t border-white/5 text-center">
                  <span className="text-[9px] text-amber-500 animate-pulse font-bold tracking-tight">
                    {lang === 'fa' ? 'برای ثبت علت تأخیر یا بستن کلیک کنید' : 'Click to rectify or close'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Internal Audit Planning Notification Icon & Alerts Dropdown */}
          <div className="relative z-30">
            <button
              onClick={() => setIsAuditAlertsOpen(!isAuditAlertsOpen)}
              className={`flex items-center justify-center p-2.5 rounded-lg border transition-all cursor-pointer select-none shrink-0 shadow-sm relative ${
                activeAuditAlerts.length > 0
                  ? 'bg-amber-500/10 border-amber-500 hover:bg-amber-500/20 text-amber-500 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'bg-[#1A1A1D] border-[#2D2D31] text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
              title={lang === 'fa' ? "برنامه زمان‌بندی و سررسیدهای ممیزی داخلی" : "Internal Audit Schedules & Deadlines"}
            >
              <Bell size={14} className={activeAuditAlerts.length > 0 ? 'animate-bounce' : ''} />
              
              {auditTasks.length > 0 && (
                <span className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full border text-[8px] font-black text-white leading-none shadow-sm ${
                  activeAuditAlerts.length > 0
                    ? 'bg-red-600 border-red-500 animate-ping'
                    : 'bg-zinc-700 border-[#0D0D10]'
                }`}>
                  {auditTasks.length}
                </span>
              )}
              {auditTasks.length > 0 && (
                <span className={`absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full border text-[8px] font-black text-white leading-none shadow-sm ${
                  activeAuditAlerts.length > 0
                    ? 'bg-red-600 border-[#0D0D10]'
                    : 'bg-zinc-700 border-[#0D0D10]'
                }`}>
                  {auditTasks.length}
                </span>
              )}
            </button>

            {isAuditAlertsOpen && (
              <div className={`absolute top-full mt-2.5 w-80 bg-[#0F0F12] border border-[#2D2D31] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] p-4 z-50 animate-fade-in ${lang === 'fa' ? 'left-0' : 'right-0'}`} dir={lang === 'fa' ? 'rtl' : 'ltr'}>
                <div className="flex items-center justify-between pb-2.5 border-b border-[#222] mb-3">
                  <div className="flex items-center gap-1.5 text-xs font-black text-white">
                    <Bell size={13} className="text-amber-500" />
                    <span>{lang === 'fa' ? 'سررسید ممیزی‌ها و وظایف داخلی' : 'Audit Schedules & Milestones'}</span>
                  </div>
                  <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold">
                    {auditTasks.length} {lang === 'fa' ? 'برنامه فعال' : 'Schedules'}
                  </span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {auditTasks.length === 0 ? (
                    <div className="text-center py-6 text-zinc-500 text-xs italic">
                      {lang === 'fa' ? 'هیچ برنامه‌ ممیزی تنظیم نشده است.' : 'No audit schedules configured.'}
                    </div>
                  ) : (
                    [...auditTasks]
                      .map(task => {
                        const taskDate = jalaliToGregorian(1405, task.month, task.day);
                        const diffTime = taskDate.getTime() - new Date(2026, 6, 15).getTime(); // July 15, 2026
                        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        return { task, daysLeft };
                      })
                      .sort((a, b) => {
                        if (a.task.status === 'completed' && b.task.status !== 'completed') return 1;
                        if (a.task.status !== 'completed' && b.task.status === 'completed') return -1;
                        return a.daysLeft - b.daysLeft;
                      })
                      .map(({ task, daysLeft }) => {
                        const isWarning = daysLeft >= 0 && daysLeft <= task.leadNotifyDays && task.status !== 'completed';
                        return (
                          <button
                            key={task.id}
                            onClick={() => {
                              setViewMode('iatf');
                              setSelectedClauseId('9.2.2.1');
                              setIsAuditAlertsOpen(false);
                            }}
                            className={`w-full text-right p-2.5 rounded-xl border text-xs flex flex-col gap-1 cursor-pointer transition-all ${
                              isWarning
                                ? 'bg-[#EF4444]/[0.03] border-red-500/25 hover:border-red-500/40 shadow-sm shadow-red-500/5'
                                : 'bg-[#151518]/60 border-zinc-800/80 hover:border-zinc-700 hover:bg-[#1A1A20]'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2 w-full">
                              <span className="font-extrabold text-white text-[11px] leading-tight line-clamp-1">{task.title}</span>
                              <span className="text-[9px] text-zinc-500 shrink-0 font-mono">
                                {task.month}/{String(task.day).padStart(2, '0')}
                              </span>
                            </div>

                            <div className="flex justify-between items-center text-[9.5px] mt-1 pt-1.5 border-t border-zinc-900/60">
                              <span className="text-zinc-400 truncate max-w-[150px]">
                                {lang === 'fa' ? `ممیز: ${task.auditor}` : `Auditor: ${task.auditor}`}
                              </span>

                              {task.status === 'completed' ? (
                                <span className="text-emerald-400 font-bold bg-emerald-500/5 px-1.5 py-0.2 rounded border border-emerald-500/10">
                                  {lang === 'fa' ? 'انجام شد' : 'Closed'}
                                </span>
                              ) : daysLeft > 0 ? (
                                <span className={`font-black ${isWarning ? 'text-red-400 animate-pulse font-black' : 'text-zinc-500'}`}>
                                  {lang === 'fa' ? `${daysLeft} روز مانده` : `${daysLeft} days left`}
                                </span>
                              ) : daysLeft === 0 ? (
                                <span className="text-amber-500 font-black animate-bounce">
                                  ⚠️ {lang === 'fa' ? 'امروز سررسید است' : 'Due today'}
                                </span>
                              ) : (
                                <span className="text-red-500 font-black animate-pulse">
                                  ⚠️ {lang === 'fa' ? `${Math.abs(daysLeft)} روز تأخیر` : `${Math.abs(daysLeft)} days overdue`}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                  )}
                </div>

                <div className="mt-3 pt-2.5 border-t border-zinc-800 text-center">
                  <button
                    onClick={() => {
                      setViewMode('iatf');
                      setSelectedClauseId('9.2.2.1');
                      setIsAuditAlertsOpen(false);
                    }}
                    className="text-[10px] text-amber-500 hover:text-amber-400 font-black transition-all cursor-pointer inline-flex items-center gap-1 bg-transparent border-none p-0"
                  >
                    <span>{lang === 'fa' ? 'مشاهده و مدیریت در تقویم ممیزی (بند ۹.۲.۲.۱) ➔' : 'View Calendar (Clause 9.2.2.1) ➔'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* AI Engine Settings Gear Button */}
          <button
            onClick={() => setIsAiSettingsOpen(true)}
            className="p-2.5 rounded-lg border bg-[#1A1A1D] border-[#2D2D31] text-amber-500 hover:text-amber-400 hover:border-amber-500/50 hover:bg-amber-500/10 transition-all cursor-pointer shadow-sm select-none shrink-0 flex items-center justify-center relative group/gear"
            title={lang === 'fa' ? `تنظیمات یکپارچه موتور هوش مصنوعی (مدل فعال: ${currentAiModel})` : `Global AI Engine Settings (Active: ${currentAiModel})`}
            id="ai-engine-settings-btn"
          >
            <Settings size={15} className="group-hover/gear:rotate-90 transition-transform duration-300" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 border border-[#0D0D10]"></span>
            </span>
          </button>

          {/* Bilingual language switcher toggle */}
          <button
            onClick={() => setLang(lang === 'fa' ? 'en' : 'fa')}
            className="p-2.5 rounded-lg border bg-[#1A1A1D] border-[#2D2D31] text-slate-400 hover:text-amber-500 hover:border-amber-500/30 transition-all cursor-pointer shadow-sm select-none shrink-0 flex items-center justify-center"
            title={lang === 'fa' ? "Switch to English" : "تغییر به زبان فارسی"}
          >
            <Globe size={14} />
          </button>

          {/* Home Icon Button */}
          <button
            onClick={() => handleSetViewMode('home')}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all select-none shrink-0 shadow-sm flex items-center justify-center ${
              viewMode === 'home'
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-500 hover:bg-amber-500/25'
                : 'bg-[#1A1A1D] border-[#2D2D31] text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
            title={lang === 'fa' ? 'صفحه اصلی' : 'Home Page'}
            id="home-page-header-btn"
          >
            <Home size={14} />
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="p-2.5 rounded-lg border bg-red-500/5 border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/40 transition-all cursor-pointer shadow-sm select-none shrink-0 flex items-center justify-center"
            title={lang === 'fa' ? 'خروج از سیستم' : 'Logout'}
          >
            <LogIn size={14} className="rotate-180" />
          </button>

          {/* Recent Activities Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsRecentDropdownOpen(!isRecentDropdownOpen)}
              className={`p-2.5 rounded-lg border cursor-pointer transition-all select-none shrink-0 shadow-sm flex items-center justify-center ${
                isRecentDropdownOpen
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-500 hover:bg-amber-500/25'
                  : 'bg-[#1A1A1D] border-[#2D2D31] text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
              title={lang === 'fa' ? "فعالیت‌های اخیر" : "Recent Activities"}
            >
              <History size={14} className={isRecentDropdownOpen ? 'animate-pulse' : ''} />
            </button>

            {isRecentDropdownOpen && (
              <>
                {/* Click outside listener */}
                <div className="fixed inset-0 z-40" onClick={() => setIsRecentDropdownOpen(false)} />
                
                {/* Dropdown Menu Container */}
                <div className={`absolute top-full bottom-auto mt-2 w-80 bg-[#111113]/95 backdrop-blur border border-[#303033] rounded-xl shadow-2xl py-2.5 z-50 animate-fade-in max-h-[65vh] overflow-y-auto custom-scrollbar ${lang === 'fa' ? 'left-0' : 'right-0'}`}>
                  <div className="px-3.5 pb-2 border-b border-[#232326] mb-2 flex justify-between items-center text-[9px] text-[#888] font-black uppercase tracking-wider">
                    <span>{lang === 'fa' ? 'صفحات بازدید شده اخیر' : 'RECENTLY VISITED PAGES'}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]"></span>
                  </div>

                  {/* Recent activities layout inside the popover */}
                  <div className="px-2 pb-1 space-y-2">
                    <div className="space-y-1">
                      <p className="text-[10px] text-amber-500 font-bold px-2 flex items-center gap-1">
                        <Activity size={10} />
                        <span>{lang === 'fa' ? 'تاریخچه بازدیدهای اخیر شما' : 'Your Visit History'}</span>
                      </p>
                      
                      <div className="max-h-72 overflow-y-auto space-y-0.5 custom-scrollbar">
                        {recentViews.length === 0 ? (
                          <p className="text-[10px] text-zinc-500 italic px-2 py-1">{lang === 'fa' ? 'بدون تاریخچه بازدید' : 'No visit history'}</p>
                        ) : (
                          recentViews.map(item => (
                            <button
                              key={item.id}
                              onClick={() => {
                                setIsRecentDropdownOpen(false);
                                setIsSidebarOpen(false);
                                if (item.type === 'clause') {
                                  setViewMode('iatf');
                                  setSelectedClauseId(item.idOrName);
                                  setIsCorrectiveActionPortalOpen(false);
                                } else if (item.type === 'document') {
                                  handleDocumentClick(item.idOrName);
                                  setIsCorrectiveActionPortalOpen(false);
                                } else if (item.type === 'view') {
                                  if (item.idOrName === 'corrective_actions') {
                                    setIsCorrectiveActionPortalOpen(true);
                                  } else {
                                    setViewMode(item.idOrName as any);
                                    setIsCorrectiveActionPortalOpen(false);
                                  }
                                }
                              }}
                              className="w-full text-right px-2.5 py-2 text-[11px] text-slate-300 hover:text-white hover:bg-white/5 rounded-md flex items-center justify-between transition-all cursor-pointer border border-transparent hover:border-[#2a2a2d]"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-[9px] text-[#666] font-mono shrink-0 uppercase">
                                  {item.type === 'clause' ? 'Clause' : item.type === 'document' ? 'Doc' : 'View'}
                                </span>
                                <span className="truncate max-w-[180px] font-medium">
                                  {lang === 'fa' ? item.labelFa : item.labelEn}
                                </span>
                              </div>
                              <span className="text-[8px] text-zinc-500 font-mono">
                                {new Date(item.timestamp).toLocaleTimeString(lang === 'fa' ? 'fa-IR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Dashboard IATF Tooling Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsIatfToolsDropdownOpen(!isIatfToolsDropdownOpen)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all border cursor-pointer select-none ${
                isIatfToolsDropdownOpen || viewMode === 'iatf_tools'
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-500 hover:bg-amber-500/25 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                  : 'bg-[#1A1A1D] border-[#2D2D31] text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
              title={lang === 'fa' ? 'داشبورد ابزار IATF' : 'IATF Tooling Dashboard'}
            >
              <Sliders size={14} className={isIatfToolsDropdownOpen || viewMode === 'iatf_tools' ? 'text-amber-500 animate-pulse' : 'text-slate-500'} />
              <span className="hidden md:inline">{lang === 'fa' ? 'داشبورد ابزار IATF' : 'IATF Tooling Dashboard'}</span>
              <span className="md:hidden">{lang === 'fa' ? 'ابزارها' : 'Tools'}</span>
              <ChevronDown size={11} className={`transition-transform duration-200 ${isIatfToolsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isIatfToolsDropdownOpen && (
              <>
                {/* Click outside listener */}
                <div className="fixed inset-0 z-40" onClick={() => setIsIatfToolsDropdownOpen(false)} />
                
                {/* Dropdown Menu Container */}
                <div className={`absolute top-full bottom-auto mt-2 w-72 bg-[#111113]/95 backdrop-blur border border-[#303033] rounded-xl shadow-2xl py-2 z-50 animate-fade-in max-h-[60vh] overflow-y-auto custom-scrollbar ${lang === 'fa' ? 'left-0' : 'right-0'}`}>
                  <div className="px-3 pb-1.5 border-b border-[#232326] mb-1.5 flex justify-between items-center text-[8px] text-[#666] font-bold uppercase tracking-wider">
                    <span>{lang === 'fa' ? 'مخزن ابزارهای IATF' : 'IATF TOOL CLOSET'}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]"></span>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                    {iatfToolItems.length === 0 ? (
                      <div className="p-4 text-center text-zinc-500 text-xs italic">
                        {lang === 'fa' ? 'هیچ ابزاری وجود ندارد' : 'No tools found'}
                      </div>
                    ) : (
                      iatfToolItems.map(item => {
                        const isActive = item.id === activeIatfToolId;
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              setIsSidebarOpen(false);
                              if (item.shortcutType) {
                                setIsIatfToolsDropdownOpen(false);
                                if (item.shortcutType === 'document') {
                                  handleDocumentClick(item.shortcutTarget || '');
                                } else if (item.shortcutType === 'portal') {
                                  if (item.shortcutTarget === 'corrective_actions') {
                                    setIsCorrectiveActionPortalOpen(true);
                                  } else if (item.shortcutTarget === 'audit_calendar') {
                                    setViewMode('iatf');
                                    setSelectedClauseId('9.2.2.1');
                                  } else if (item.shortcutTarget?.startsWith('clause:')) {
                                    const clauseId = item.shortcutTarget.split(':')[1];
                                    setViewMode('iatf');
                                    setSelectedClauseId(clauseId);
                                  } else {
                                    setViewMode(item.shortcutTarget as any);
                                  }
                                }
                              } else {
                                setActiveIatfToolId(item.id);
                                setViewMode('iatf_tools');
                                setIsIatfToolsDropdownOpen(false);
                              }
                            }}
                            className={`w-full text-right px-4 py-2.5 text-xs flex items-center justify-between transition-colors hover:bg-white/5 cursor-pointer group relative ${
                              isActive && viewMode === 'iatf_tools' ? 'text-amber-400 font-extrabold bg-amber-500/5' : 'text-slate-300'
                            }`}
                          >
                            <div className="flex flex-col min-w-0 flex-1 pl-2 text-right">
                              <span className="truncate block font-semibold">{item.name}</span>
                              <span className="text-[9px] text-zinc-500 truncate mt-0.5">{item.description}</span>
                            </div>
                            
                            {/* Actions */}
                            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTool(item);
                                  setIsEditToolModalOpen(true);
                                  setIsIatfToolsDropdownOpen(false);
                                }}
                                className="p-1 hover:bg-white/10 rounded text-zinc-500 hover:text-amber-400 transition-all cursor-pointer"
                                title={lang === 'fa' ? 'ویرایش' : 'Edit'}
                              >
                                <Edit2 size={11} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTool(item.id, item.name);
                                  setIsIatfToolsDropdownOpen(false);
                                }}
                                className="p-1 hover:bg-red-500/10 rounded text-zinc-500 hover:text-red-400 transition-all cursor-pointer"
                                title={lang === 'fa' ? 'حذف' : 'Delete'}
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="border-t border-white/5 mt-1.5 pt-1.5 px-3">
                    <button
                      onClick={() => {
                        setIsAddToolModalOpen(true);
                        setIsIatfToolsDropdownOpen(false);
                      }}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-black py-1.5 rounded-lg text-[10px] font-extrabold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-amber-500/10"
                    >
                      <PlusCircle size={12} className="stroke-[3]" />
                      <span>{lang === 'fa' ? 'افزودن ابزار جدید' : 'Add New Tool'}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Dashboard Collapsible Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setIsDashboardDropdownOpen(!isDashboardDropdownOpen)}
              className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all border cursor-pointer select-none ${
                isDashboardDropdownOpen || viewMode !== 'iatf'
                  ? 'bg-amber-500/15 border-amber-500/50 text-amber-500 hover:bg-amber-500/25'
                  : 'bg-[#1A1A1D] border-[#2D2D31] text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
              title={lang === 'fa' ? "داشبورد و تب‌ها" : "Dashboard and tabs"}
            >
              <LayoutDashboard size={14} className={isDashboardDropdownOpen ? 'animate-pulse' : ''} />
              <span className="hidden md:inline">{lang === 'fa' ? 'داشبورد هوشمند سیستم' : 'Smart QMS Dashboard'}</span>
              <span className="md:hidden">{lang === 'fa' ? 'داشبورد' : 'QMS'}</span>
              {auditResults.total > 0 && (
                <span className="bg-red-500/20 text-red-400 ring-1 ring-red-500/35 text-[9px] font-black px-1.5 py-0.5 rounded-full font-mono shrink-0" title={lang === 'fa' ? `${auditResults.total} بند تکمیل نشده` : `${auditResults.total} incomplete clauses`}>
                  {auditResults.total}
                </span>
              )}
              <ChevronDown size={11} className={`transition-transform duration-200 ${isDashboardDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDashboardDropdownOpen && (
              <>
                {/* Click outside listener */}
                <div className="fixed inset-0 z-40" onClick={() => setIsDashboardDropdownOpen(false)} />
                
                {/* Dropdown Menu Container */}
                <div className={`absolute top-full bottom-auto mt-2 w-64 bg-[#111113]/95 backdrop-blur border border-[#303033] rounded-xl shadow-2xl py-2 z-50 animate-fade-in max-h-[60vh] overflow-y-auto custom-scrollbar ${lang === 'fa' ? 'left-0' : 'right-0'}`}>
                  <div className="px-3 pb-1.5 border-b border-[#232326] mb-1.5 flex justify-between items-center text-[8px] text-[#666] font-bold uppercase tracking-wider">
                    <span>{lang === 'fa' ? 'هدایت به بخش‌های سیستم' : 'SWITCH PORTAL SECTION'}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]"></span>
                  </div>

                  {/* 0. Home Page */}
                  <button
                    onClick={() => {
                      setViewMode('home');
                      setIsDashboardDropdownOpen(false);
                    }}
                    className={`w-full text-right px-4 py-2 text-xs flex items-center justify-between transition-colors hover:bg-white/5 cursor-pointer ${
                      viewMode === 'home' ? 'text-amber-500 font-extrabold bg-amber-500/5' : 'text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Home size={13} className={viewMode === 'home' ? 'text-amber-500' : 'text-slate-500'} />
                      <span>{lang === 'fa' ? 'صفحه اصلی' : 'Home Page'}</span>
                    </div>
                    {viewMode === 'home' && <span className="text-[10px]">✓</span>}
                  </button>

                  {/* 1. Clause Explorer */}
                  <button
                    onClick={() => {
                      handleSetViewMode('iatf');
                      setIsDashboardDropdownOpen(false);
                    }}
                    className={`w-full text-right px-4 py-2 text-xs flex items-center justify-between transition-colors hover:bg-white/5 cursor-pointer ${
                      viewMode === 'iatf' ? 'text-amber-500 font-extrabold bg-amber-500/5' : 'text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield size={13} className={viewMode === 'iatf' ? 'text-amber-500' : 'text-slate-500'} />
                      <span>{lang === 'fa' ? '۱. کاوشگر بندهای IATF' : '1. Standard Clause Explorer'}</span>
                    </div>
                    {viewMode === 'iatf' && <span className="text-[10px]">✓</span>}
                  </button>

                  {/* FMEA & Process Risk & Opportunity link */}
                  <div className="flex flex-col bg-amber-500/5 border-y border-amber-500/10">
                    <button
                      onClick={() => {
                        setIsDashboardDropdownOpen(false);
                        handleDocumentClick(lang === 'fa' ? 'مدیریت ریسک و فرصت‌ها' : 'Risk and Opportunity Management');
                      }}
                      className="w-full text-right px-4 py-2 text-xs flex items-center justify-between transition-colors hover:bg-white/5 cursor-pointer text-amber-500 font-extrabold"
                      title={lang === 'fa' ? 'مدیریت موقعیت، آستانه و درس‌آموخته هوشمند ریسک‌ها و فرصت‌ها (بند ۶.۱)' : 'Interactive FMEA Risk Analyzer'}
                    >
                      <div className="flex items-center gap-2">
                        <ShieldAlert size={13} className="text-amber-500 animate-pulse" />
                        <span>{lang === 'fa' ? '★ مدیریت ریسک و فرصت‌ها (۶.۱)' : '★ Risk & Opportunity FMEA'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {auditResults.riskCount > 0 && (
                          <span className="inline-flex items-center text-[9px] font-black text-rose-400 bg-rose-500/10 ring-1 ring-rose-500/25 px-1.5 py-[1px] rounded font-mono animate-pulse" title={lang === 'fa' ? `${auditResults.riskCount} رکورد تکمیل نشده` : `${auditResults.riskCount} incomplete items`}>
                            <span>⚠️ {auditResults.riskCount}</span>
                          </span>
                        )}
                        <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1.5 py-[0.5px] rounded font-extrabold">FMEA</span>
                      </div>
                    </button>
                    {hasIncompleteReplicatedRisks && (
                      <button
                        onClick={() => {
                          alert(lang === 'fa'
                            ? '🏁 راهنمای قدم‌به‌قدم جهت رفع خطا:\n\n۱. هم‌اکنون وارد مخزن اصلی «مدیریت ریسک‌ها و فرصت‌ها» می‌شوید.\n۲. سیستم به صورت خودکار تب «ریسک‌ها و فرصت‌های استراتژیک» را برای شما فعال می‌کند.\n۳. ردیف جدید کپی شده از جدول ارزیابی استراتژیک را پیدا کنید.\n۴. ستون مربوط به فعالیت کنترلی («اقدام مهار ریسک» یا «اقدام بهره‌برداری فرصت») را با وارد کردن برنامه اقدام مقتضی تکمیل نمایید تا این اخطار خودکار خاموش شود.'
                            : '🏁 Step-by-step guide to complete evaluation:\n\n1. You will now be directed to the Risk & Opportunity Register.\n2. Tab "Strategic Risks & Opportunities" will automatically activate.\n3. Find the newly replicated item with prefix [جدول ارزیابی استراتژیک].\n4. Complete the respective control action column to turn off this automatic warning.'
                          );
                          setDocumentInitialRiskTab('strategic_risks');
                          handleDocumentClick(lang === 'fa' ? 'مدیریت ریسک و فرصت‌ها' : 'Risk and Opportunity Management');
                        }}
                        className="w-full text-right px-4 pb-2 text-[9px] text-rose-400 leading-relaxed font-bold animate-pulse hover:text-rose-300 transition-colors cursor-pointer bg-transparent border-0"
                        dir="rtl"
                      >
                        {lang === 'fa' 
                          ? '⚠️ توجه: ریسک/فرصت استراتژیک جدید اضافه شد. جهت راهنمای قدم‌به‌قدم و پر کردن اقدام کنترلی، اینجا را کلیک کنید.'
                          : '⚠️ Notice: New strategic risk/opp added! Click here for step-by-step guide to complete its control.'}
                      </button>
                    )}
                  </div>

                  {/* Corrective Actions Portal Link */}
                  <button
                    onClick={() => {
                      setIsDashboardDropdownOpen(false);
                      setIsSidebarOpen(false);
                      setIsCorrectiveActionPortalOpen(true);
                    }}
                    className="w-full text-right px-4 py-2 text-xs flex items-center justify-between transition-colors hover:bg-white/5 cursor-pointer text-emerald-400 font-extrabold bg-emerald-500/5 border-b border-emerald-500/10"
                    title={lang === 'fa' ? 'مدیریت و کنترل پیشرفت اقدامات اصلاحی و کارتابل 8D (بند ۱۰.۲.۱)' : 'Corrective Actions Portal (10.2.1)'}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={13} className="text-emerald-400 animate-pulse" />
                      <span>{lang === 'fa' ? '★ کارتابل اقدامات اصلاحی (۱۰.۲.۱)' : '★ Corrective Actions (10.2.1)'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {auditResults.caCount > 0 && (
                        <span className="inline-flex items-center text-[9px] font-black text-rose-400 bg-rose-500/10 ring-1 ring-rose-500/25 px-1.5 py-[1px] rounded font-mono animate-pulse" title={lang === 'fa' ? `${auditResults.caCount} رکورد جدید یا باز` : `${auditResults.caCount} open actions`}>
                          <span>⚠️ {auditResults.caCount}</span>
                        </span>
                      )}
                      <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1.5 py-[0.5px] rounded font-extrabold">CAPA</span>
                    </div>
                  </button>

                  {/* Strategic Management */}
                  <button
                    onClick={() => {
                      handleSetViewMode('strategic_management');
                      setIsDashboardDropdownOpen(false);
                    }}
                    className={`w-full text-right px-4 py-2 text-xs flex items-center justify-between transition-colors hover:bg-white/5 cursor-pointer ${
                      viewMode === 'strategic_management' ? 'text-amber-500 font-extrabold bg-amber-500/5 border-b border-amber-500/10' : 'text-slate-300 border-b border-white/5'
                    }`}
                    title={lang === 'fa' ? 'مدیریت استراتژیک، SWOT، ذینفعان، اهداف کیفیت و ماتریس استراتژیک' : 'Strategic SWOT, targets, objectives & requirements matrix'}
                  >
                    <div className="flex items-center gap-2">
                      <Briefcase size={13} className={viewMode === 'strategic_management' ? 'text-amber-500' : 'text-slate-500'} />
                      <span>{lang === 'fa' ? '★ مدیریت استراتژیک' : '★ Strategic Management'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {auditResults.strategicCount > 0 && (
                        <span className="inline-flex items-center text-[9px] font-black text-rose-400 bg-rose-500/10 ring-1 ring-rose-500/25 px-1.5 py-[1px] rounded font-mono animate-pulse" title={lang === 'fa' ? `${auditResults.strategicCount} رکورد ارزیابی ناقص` : `${auditResults.strategicCount} incomplete items`}>
                          <span>⚠️ {auditResults.strategicCount}</span>
                        </span>
                      )}
                      {viewMode === 'strategic_management' ? <span className="text-[10px]">✓</span> : <span className="text-[9px] bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1.5 py-[0.5px] rounded font-mono">STRAT</span>}
                    </div>
                  </button>

                  {/* 3. Monitoring Performance KPI / Indicators */}
                  <button
                    onClick={() => {
                      handleSetViewMode('indicators');
                      setIsDashboardDropdownOpen(false);
                    }}
                    className={`w-full text-right px-4 py-2 text-xs flex items-center justify-between transition-colors hover:bg-white/5 cursor-pointer ${
                      viewMode === 'indicators' ? 'text-amber-500 font-extrabold bg-amber-500/5' : 'text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Activity size={13} className={viewMode === 'indicators' ? 'text-amber-500' : 'text-slate-500'} />
                      <span>{lang === 'fa' ? '۳. پایش هوشمند شاخص‌ها' : '3. Quality Indicators'}</span>
                    </div>
                    {viewMode === 'indicators' && <span className="text-[10px]">✓</span>}
                  </button>

                  {/* 4. AI Consultant Assistant */}
                  <button
                    onClick={() => {
                      handleSetViewMode('assistant');
                      setIsDashboardDropdownOpen(false);
                    }}
                    className={`w-full text-right px-4 py-2 text-xs flex items-center justify-between transition-colors hover:bg-white/5 cursor-pointer ${
                      viewMode === 'assistant' ? 'text-amber-500 font-extrabold bg-amber-500/5' : 'text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Bot size={13} className={viewMode === 'assistant' ? 'text-amber-500' : 'text-slate-500'} />
                      <span>{lang === 'fa' ? '۴. دستیار هوشمند ارشد IATF' : '4. AI Auditor Assistant'}</span>
                    </div>
                    {viewMode === 'assistant' && <span className="text-[10px]">✓</span>}
                  </button>

                  {/* 5. ISO 9001 Document Control */}
                  <button
                    onClick={() => {
                      handleSetViewMode('iso9001_docs');
                      setIsDashboardDropdownOpen(false);
                    }}
                    className={`w-full text-right px-4 py-2 text-xs flex items-center justify-between transition-colors hover:bg-white/5 cursor-pointer ${
                      viewMode === 'iso9001_docs' ? 'text-amber-500 font-extrabold bg-amber-500/5' : 'text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText size={13} className={viewMode === 'iso9001_docs' ? 'text-amber-500' : 'text-slate-500'} />
                      <span>{lang === 'fa' ? '۵. مدیریت و کنترل اسناد (ISO 9001)' : '5. ISO 9001 Document Control'}</span>
                    </div>
                    {viewMode === 'iso9001_docs' && <span className="text-[10px]">✓</span>}
                  </button>

                  {/* 6. Embedded Relational Database Explorer */}
                  <button
                    onClick={() => {
                      handleSetViewMode('db_explorer');
                      setIsDashboardDropdownOpen(false);
                    }}
                    className={`w-full text-right px-4 py-2 text-xs flex items-center justify-between transition-colors hover:bg-white/5 cursor-pointer ${
                      viewMode === 'db_explorer' ? 'text-amber-500 font-extrabold bg-amber-500/5' : 'text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Database size={13} className={viewMode === 'db_explorer' ? 'text-amber-500' : 'text-slate-500'} />
                      <span>{lang === 'fa' ? '۶. مرکز مدیریت پایگاه داده (QMS-DB)' : '6. Relational QMS-DB Explorer'}</span>
                    </div>
                    {viewMode === 'db_explorer' && <span className="text-[10px]">✓</span>}
                  </button>

                  {/* 7. QC Archived Records Snapshot Ledger */}
                  <button
                    onClick={() => {
                      handleSetViewMode('records');
                      setIsDashboardDropdownOpen(false);
                    }}
                    className={`w-full text-right px-4 py-2 text-xs flex items-center justify-between transition-colors hover:bg-white/5 cursor-pointer ${
                      viewMode === 'records' ? 'text-amber-500 font-extrabold bg-amber-500/5' : 'text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <History size={13} className={viewMode === 'records' ? 'text-amber-500' : 'text-slate-500'} />
                      <span>{lang === 'fa' ? '۷. سامانه مدیریت و بایگانی سوابق' : '7. Records & Compliance Archive'}</span>
                    </div>
                    {viewMode === 'records' && <span className="text-[10px]">✓</span>}
                  </button>

                  {/* 8. User / Team Management */}
                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => {
                        handleSetViewMode('team_management' as any);
                        setIsDashboardDropdownOpen(false);
                      }}
                      className={`w-full text-right px-4 py-2.5 text-xs flex items-center justify-between transition-colors hover:bg-white/5 cursor-pointer border-t border-[#232326] mt-1 ${
                        viewMode === 'team_management' ? 'text-amber-500 font-extrabold bg-amber-500/5' : 'text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Users size={13} className={viewMode === 'team_management' ? 'text-amber-500 animate-pulse' : 'text-slate-500'} />
                        <span className="font-sans font-black text-amber-500">{lang === 'fa' ? '★ مدیریت کاربری و تیمی' : '★ Team & User Management'}</span>
                      </div>
                      {viewMode === 'team_management' ? <span className="text-[10px]">✓</span> : <span className="text-[8px] bg-amber-500/10 text-amber-500 font-black border border-amber-500/20 px-1 rounded">ADMIN</span>}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>


      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Backdrop Overlay - closes mobile drawer when backdrop clicked */}
        {viewMode === 'iatf' && isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-30 md:hidden transition-opacity cursor-pointer"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar (With smooth horizontal sliding transition drawer on both desktop and mobile) */}
        {viewMode === 'iatf' && (
          <aside
            className={`fixed md:relative inset-y-0 ${lang === 'fa' ? 'right-0' : 'left-0'} z-40 h-full md:h-auto bg-[#0F0F11] flex flex-col shadow-2xl md:shadow-none border-[#2A2A2D] transition-all duration-300 ease-in-out shrink-0 select-none overflow-hidden ${
              isSidebarOpen 
                ? `w-[85vw] max-w-[340px] md:w-80 lg:w-96 opacity-100 translate-x-0 pointer-events-auto ${lang === 'fa' ? 'border-l' : 'border-r'}` 
                : `w-0 max-w-0 opacity-0 ${lang === 'fa' ? 'translate-x-full' : '-translate-x-full'} pointer-events-none border-0 p-0`
            }`}
          >
            {/* Two-tab menu header for the sidebar with close button */}
            <div className="flex bg-[#0A0A0C] border-b border-[#2A2A2D] p-1 select-none shrink-0 items-center">
              <button
                type="button"
                onClick={() => setSidebarTab('iatf')}
                className={`flex-1 py-2.5 px-1 text-center text-[10.5px] font-extrabold tracking-tight transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'iatf'
                    ? 'text-amber-500 border-amber-500 bg-amber-500/5'
                    : 'text-zinc-500 hover:text-zinc-300 border-transparent hover:bg-white/5'
                }`}
              >
                <LayoutDashboard size={12} />
                <span>{lang === 'fa' ? 'ساختار درختی IATF' : 'IATF Clause Tree'}</span>
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab('process')}
                className={`flex-1 py-2.5 px-1 text-center text-[10.5px] font-extrabold tracking-tight transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
                  sidebarTab === 'process'
                    ? 'text-amber-500 border-amber-500 bg-amber-500/5'
                    : 'text-zinc-500 hover:text-zinc-300 border-transparent hover:bg-white/5'
                }`}
              >
                <ArrowLeftRight size={12} />
                <span>{lang === 'fa' ? 'ساختار فرآیندی' : 'Process Structure'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 text-zinc-400 hover:text-amber-400 hover:bg-white/10 rounded-lg transition-all cursor-pointer shrink-0"
                title={lang === 'fa' ? 'بستن منوی کشویی' : 'Close Drawer'}
              >
                <X size={16} />
              </button>
            </div>

            {sidebarTab === 'iatf' ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-4 border-b border-[#2A2A2D] space-y-3">
                  <div className="relative">
                    <Search size={14} className={`absolute top-1/2 -translate-y-1/2 text-slate-500 ${lang === 'fa' ? 'right-3' : 'left-3'}`} />
                    <input 
                      type="text" 
                      placeholder={t.searchPlaceholder} 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full bg-[#1A1A1D] border border-transparent focus:border-amber-500/30 rounded-lg py-2 text-xs text-slate-300 transition-all outline-none ${lang === 'fa' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                    />
                  </div>
                  {/* Expand/Collapse All Buttons */}
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="text-zinc-500">{lang === 'fa' ? 'عملیات درختی:' : 'Tree actions:'}</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={expandAllClauses}
                        className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded transition-all font-bold cursor-pointer"
                      >
                        {lang === 'fa' ? 'باز کردن همه' : 'Expand All'}
                      </button>
                      <button
                        type="button"
                        onClick={collapseAllClauses}
                        className="px-2 py-1 bg-[#1A1A1D] hover:bg-zinc-800 text-zinc-400 rounded transition-all cursor-pointer border border-[#2D2D30]"
                      >
                        {lang === 'fa' ? 'بستن همه' : 'Collapse All'}
                      </button>
                    </div>
                  </div>
                </div>

                <nav className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                <ClauseTree 
                  clauses={filteredClauses} 
                  selectedId={selectedClauseId} 
                  onSelect={(clause) => {
                    setSelectedClauseId(clause.id);
                    setProcessSelection(null);
                    setIsSidebarOpen(false);
                  }}
                  getProgress={getProgress}
                  isSearching={!!searchQuery}
                  lang={lang}
                  currentUser={currentUser}
                  csrComparisons={csrComparisons}
                  expanded={expandedClauses}
                  onExpandedChange={setExpandedClauses}
                />
                </nav>
              </div>
            ) : (
              // Organization Process Tree
              <div className="flex-1 flex flex-col min-h-0">
                <div className="p-4 border-b border-[#2A2A2D] space-y-3">
                  <div className="relative">
                    <Search size={14} className={`absolute top-1/2 -translate-y-1/2 text-slate-500 ${lang === 'fa' ? 'right-3' : 'left-3'}`} />
                    <input 
                      type="text" 
                      placeholder={lang === 'fa' ? 'جستجوی فرآیندها...' : 'Search processes...'} 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className={`w-full bg-[#1A1A1D] border border-transparent focus:border-amber-500/30 rounded-lg py-2 text-xs text-slate-300 transition-all outline-none ${lang === 'fa' ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
                    />
                  </div>
                  {/* Expand/Collapse All Buttons */}
                  <div className="flex items-center justify-between gap-2 text-[10px]">
                    <span className="text-zinc-500">{lang === 'fa' ? 'عملیات فرآیندی:' : 'Process actions:'}</span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={expandAllProcesses}
                        className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded transition-all font-bold cursor-pointer"
                      >
                        {lang === 'fa' ? 'باز کردن همه' : 'Expand All'}
                      </button>
                      <button
                        type="button"
                        onClick={collapseAllProcesses}
                        className="px-2 py-1 bg-[#1A1A1D] hover:bg-zinc-800 text-zinc-400 rounded transition-all cursor-pointer border border-[#2D2D30]"
                      >
                        {lang === 'fa' ? 'بستن همه' : 'Collapse All'}
                      </button>
                    </div>
                  </div>
                </div>
                
                <nav className="flex-grow overflow-y-auto p-2 custom-scrollbar space-y-1.5">
                  {(() => {
                    const matrixItems = generateProcessRequirementsMatrix();
                    const filteredItems = searchQuery ? matrixItems.filter(item => 
                      (item.field1 || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                      (item.field2 || '').toLowerCase().includes(searchQuery.toLowerCase())
                    ) : matrixItems;

                    const allStandardClauses = flattenIatfClauses(iatfData);
                    
                    if (matrixItems.length === 0) {
                      return (
                        <div className="text-center py-12 px-4 text-xs text-slate-500 italic flex flex-col items-center justify-center gap-3" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
                          <AlertTriangle className="text-amber-500 animate-pulse" size={24} />
                          <span className="font-bold text-zinc-300">
                            {lang === 'fa' ? 'ماتریس فرآیندها-الزامات خالی است.' : 'Process-Requirements Matrix is empty.'}
                          </span>
                          <span className="text-[10px] text-zinc-500 leading-normal max-w-[200px] text-center">
                            {lang === 'fa' 
                              ? 'هیچ فرآیندی در بند ۴.۴ یا شناسنامه فرآیندها تعریف نشده است.' 
                              : 'No processes are defined in clause 4.4 or process cards.'}
                          </span>
                        </div>
                      );
                    }

                    if (filteredItems.length === 0) {
                      return (
                        <div className="text-center py-10 text-xs text-slate-500 italic">
                          {lang === 'fa' ? 'هیچ فرآیندی یافت نشد.' : 'No processes found.'}
                        </div>
                      );
                    }

                    return filteredItems.map((proc, index) => {
                      const isExpanded = !!expandedProcesses[proc.id];
                      const procClauseExpr = proc.clauseId || '4.4';
                      
                      // Resolve mapped standard clauses
                      let manualClauses: string[] | undefined = undefined;
                      try {
                        const dbMappings = QmsDatabase.selectAll(QmsDatabase.TABLES.PROCESS_MAPPINGS);
                        if (dbMappings && dbMappings[proc.id]) {
                          manualClauses = dbMappings[proc.id];
                        } else if (dbMappings && dbMappings[proc.field1]) {
                          manualClauses = dbMappings[proc.field1];
                        }
                      } catch {}

                      const associatedClauses = (manualClauses && Array.isArray(manualClauses))
                        ? allStandardClauses.filter(clause => manualClauses.includes(clause.id))
                        : allStandardClauses.filter(clause => isClauseAssociated(clause.id, procClauseExpr));

                      const isSelectedProc = processSelection?.type === 'process' && processSelection?.processId === proc.id;

                      return (
                        <div key={proc.id || `proc-node-${index}`} className="space-y-1">
                          <div 
                            onClick={() => {
                              setProcessSelection({
                                type: 'process',
                                processId: proc.id,
                                processName: proc.field1
                              });
                              setIsSidebarOpen(false);
                            }}
                            className={`flex items-center justify-between p-2.5 rounded-lg transition-all cursor-pointer border ${
                              isSelectedProc
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold'
                                : 'bg-[#141417]/40 border-[#2A2A2D]/40 text-slate-300 hover:bg-[#1C1C1F]/60'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedProcesses(prev => ({ ...prev, [proc.id]: !prev[proc.id] }));
                                }}
                                className="text-slate-500 hover:text-white p-1 hover:bg-white/5 rounded transition-all cursor-pointer"
                              >
                                <ChevronDown 
                                  size={13} 
                                  className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-0' : (lang === 'fa' ? 'rotate-90' : '-rotate-90')}`} 
                                />
                              </button>
                              
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                              <span className="text-xs font-black truncate leading-tight" title={proc.field1}>
                                {proc.field1}
                              </span>
                            </div>

                            <span className="text-[9px] bg-[#1A1A1D]/80 border border-[#2D2D30]/60 text-amber-500 font-mono px-1.5 py-0.5 rounded-md shrink-0">
                              {associatedClauses.length} {lang === 'fa' ? 'بند' : 'cls'}
                            </span>
                          </div>

                          {isExpanded && (
                            <div className={`mt-1 space-y-1 ${lang === 'fa' ? 'pr-5 border-r border-[#2A2A2D]/60' : 'pl-5 border-l border-[#2A2A2D]/60'}`}>
                              {associatedClauses.length === 0 ? (
                                <div className="text-[10px] text-slate-500 italic py-1 px-2">
                                  {lang === 'fa' ? 'بدون بند متناظر' : 'No mapped clauses'}
                                </div>
                              ) : (
                                associatedClauses.map((cls) => {
                                  const isSelectedSubClause = processSelection?.type === 'clause' && processSelection?.processId === proc.id && processSelection?.clauseId === cls.id;
                                  
                                  return (
                                    <div
                                      key={`${proc.id}-subcls-${cls.id}`}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setProcessSelection({
                                          type: 'clause',
                                          processId: proc.id,
                                          processName: proc.field1,
                                          clauseId: cls.id
                                        });
                                        setIsSidebarOpen(false);
                                      }}
                                      className={`p-2 rounded-md text-[11px] transition-all cursor-pointer flex items-center justify-between border ${
                                        isSelectedSubClause
                                          ? 'bg-[#1C1C1F] border-amber-500/40 text-amber-400 font-extrabold'
                                          : 'bg-transparent border-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5 truncate">
                                        <span className="text-[10px] font-mono font-bold text-amber-500/70">{cls.number}</span>
                                        <span className="truncate" title={cls.title}>{cls.title}</span>
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </nav>
              </div>
            )}
          </aside>
        )}

        {/* Persistent Floating Drawer Flap Toggle - Visible when sidebar drawer is closed */}
        {viewMode === 'iatf' && !isSidebarOpen && (
          <button
            type="button"
            className={`flex items-center justify-center bg-[#0F0F11] border-[#2A2A2D] hover:bg-amber-500/10 text-amber-500 hover:text-amber-400 h-40 w-9 cursor-pointer select-none transition-all absolute top-1/4 z-30 shadow-2xl hover:border-amber-500/50 group ${
              lang === 'fa' ? 'right-0 border-l border-y rounded-l-xl' : 'left-0 border-r border-y rounded-r-xl'
            }`}
            onClick={() => setIsSidebarOpen(true)}
            title={lang === 'fa' ? 'باز کردن کشویی ساختار درختی و فرآیندی' : 'Open Tree & Process Drawer'}
          >
            <div className={`vertical-text font-black text-[10px] tracking-wider flex items-center justify-center gap-2 ${lang === 'fa' ? 'rotate-180' : ''}`}>
              <Menu size={14} className="rotate-90 text-amber-500 group-hover:scale-125 transition-transform" />
              <span className="whitespace-nowrap">{lang === 'fa' ? 'ساختار درختی / فرآیندی' : 'Tree & Process'}</span>
            </div>
          </button>
        )}
 
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto bg-gradient-to-br from-[#0A0A0B] to-[#161618] custom-scrollbar">
          {viewMode === 'home' ? (
            <HomeView
              lang={lang}
              logoUrl={logoUrl}
              organizations={organizations}
              products={products}
              selectedOrgId={selectedOrgId}
              selectedProductId={selectedProductId}
              onSelectOrg={setSelectedOrgId}
              onSelectProduct={setSelectedProductId}
              activeHeaderTitle={activeHeaderTitle}
              onNavigate={handleSetViewMode}
              onOpenDocument={handleDocumentClick}
              currentUser={currentUser}
              onAddOrg={handleAddOrg}
              onEditOrg={handleEditOrg}
              onDeleteOrg={handleDeleteOrg}
              onAddProduct={handleAddProduct}
              onEditProduct={handleEditProduct}
              onDeleteProduct={handleDeleteProduct}
              tasks={tasks}
            />
          ) : viewMode === 'iatf' ? (
            sidebarTab === 'process' && generateProcessRequirementsMatrix().length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-[#09090B]/30 border border-[#222225] rounded-2xl shadow-xl" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full mb-4">
                  <AlertTriangle size={32} className="animate-pulse" />
                </div>
                <h3 className="text-lg font-black text-[#FAFAFA] mb-2">
                  {lang === 'fa' ? 'ماتریس فرآیندها-الزامات خالی است!' : 'Process-Requirements Matrix is Empty!'}
                </h3>
                <p className="text-xs text-zinc-500 max-w-md leading-relaxed">
                  {lang === 'fa' 
                    ? 'هیچ فرآیندی در سازمان تعریف نشده یا شناسنامه فرآیندها (لاک‌پشتی) ذیل بند ۴.۴ ایجاد نشده است. لطفا ابتدا شناسنامه‌های فرآیند را تکمیل نمایید.'
                    : 'No processes are defined in the organization or process cards under clause 4.4 have not been created. Please complete process turtle cards first.'}
                </p>
              </div>
            ) : sidebarTab === 'process' && processSelection ? (
              (() => {
                if (processSelection.type === 'process') {
                  return (
                    <ProcessSpecViewer 
                      processName={processSelection.processName} 
                      processId={processSelection.processId} 
                      lang={lang} 
                      onDocumentClick={handleDocumentClick} 
                      processItems={generateProcessRequirementsMatrix()} 
                    />
                  );
                } else if (processSelection.type === 'clause' && processSelection.clauseId) {
                  const targetClauseObj = findClauseById(localizedIatfData, processSelection.clauseId);
                  if (targetClauseObj) {
                    return (
                      <ProcessClauseDocsViewer 
                        clause={targetClauseObj} 
                        processName={processSelection.processName} 
                        processId={processSelection.processId} 
                        lang={lang} 
                        onDocumentClick={handleDocumentClick} 
                        records={records} 
                      />
                    );
                  }
                }
                return (
                  <div className="text-center py-20 text-slate-500" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
                    <p>{lang === 'fa' ? 'بند یا فرآیند یافت نشد.' : 'Sub-clause or Process not found.'}</p>
                  </div>
                );
              })()
            ) : (
              <ClauseDetail 
                clause={selectedClause} 
                onDocumentClick={handleDocumentClick} 
                csrComparisons={csrComparisons}
                setCsrComparisons={setCsrComparisons}
                csrDocuments={csrDocuments}
                setCsrDocuments={setCsrDocuments}
                onSelectClauseId={(clauseId) => setSelectedClauseId(clauseId)}
                lang={lang}
                indicators={indicators}
                onSelectIndicatorsTab={() => setViewMode('indicators')}
                onAddClauseDocument={handleAddClauseDocument}
                onEditClauseDocument={handleEditClauseDocument}
                onDeleteClauseDocument={handleDeleteClauseDocument}
                onUpdateInterpretation={handleUpdateInterpretation}
                records={records}
                onArchiveDocument={handleArchiveDocument}
                onDeleteRecord={handleDeleteRecord}
                currentUser={currentUser}
                onPinToDashboard={handleCreateShortcutToIatfTools}
                onOpenCorrectiveActions={() => setIsCorrectiveActionPortalOpen(true)}
              />
            )
          ) : viewMode === 'csr' ? (
            <CsrManager
              onSelectClauseId={(clauseId) => {
                setSelectedClauseId(clauseId);
                setViewMode('iatf');
                setIsSidebarOpen(false);
              }}
              comparisons={csrComparisons}
              setComparisons={setCsrComparisons}
              documents={csrDocuments}
              setDocuments={setCsrDocuments}
              lang={lang}
              onPinToDashboard={handleCreateShortcutToIatfTools}
            />
          ) : viewMode === 'indicators' ? (
            <KpiIndicators
              indicators={indicators}
              setIndicators={setIndicators}
              lang={lang}
              onSelectClauseId={(clauseId) => {
                setSelectedClauseId(clauseId);
                setViewMode('iatf');
                setIsSidebarOpen(false);
              }}
              updateDocKpiValue={updateDocKpiValue}
              onPinToDashboard={handleCreateShortcutToIatfTools}
            />
          ) : viewMode === 'iso9001_docs' ? (
            <IsoDocsManager
              lang={lang}
              customDocuments={customDocuments}
              localizedIatfData={localizedIatfData}
              onDocumentClick={handleDocumentClick}
              onSelectClauseId={(clauseId) => {
                setSelectedClauseId(clauseId);
                setViewMode('iatf');
                setIsSidebarOpen(false);
              }}
              onPinToDashboard={handleCreateShortcutToIatfTools}
              projectMode={projectMode}
              devCreatedDocs={devCreatedDocs}
              onDeleteDocument={handleDeleteDocument}
              onResetDocumentToDefault={handleResetDocumentToDefault}
            />
          ) : viewMode === 'db_explorer' ? (
            <DbExplorer
              lang={lang}
              onStateChangeNotify={handleDbModifiedRefresh}
              onPinToDashboard={handleCreateShortcutToIatfTools}
            />
          ) : viewMode === 'records' ? (
            <RecordsDashboard
              lang={lang}
              records={records}
              onDeleteRecord={handleDeleteRecord}
              onSelectClauseId={(clauseId) => {
                setSelectedClauseId(clauseId);
                setViewMode('iatf');
                setIsSidebarOpen(false);
              }}
              onPinToDashboard={handleCreateShortcutToIatfTools}
            />
          ) : viewMode === 'strategic_management' ? (
            <StrategicManagement
              lang={lang}
              onOpenDocument={handleDocumentClick}
              onSelectClauseId={(clauseId) => {
                setSelectedClauseId(clauseId);
                setViewMode('iatf');
                setIsSidebarOpen(false);
              }}
              onNotifyDbModified={handleDbModifiedRefresh}
              currentUser={currentUser}
              proposals={proposals}
              onProposeChange={handleProposeChange}
              onPinToDashboard={handleCreateShortcutToIatfTools}
            />
          ) : viewMode === 'iatf_tools' ? (
            <IatfToolsDashboard
              lang={lang}
              localizedIatfData={localizedIatfData}
              customDocuments={customDocuments}
              onDocumentClick={handleDocumentClick}
              onSaveDocument={handleSaveDocument}
              items={iatfToolItems}
              setItems={setIatfToolItems}
              activeItemId={activeIatfToolId}
              setActiveItemId={setActiveIatfToolId}
              csrComparisons={csrComparisons}
              onOpenPortal={(target) => {
                setIsSidebarOpen(false);
                if (target === 'corrective_actions') {
                  setIsCorrectiveActionPortalOpen(true);
                } else if (target === 'audit_calendar') {
                  setViewMode('iatf');
                  setSelectedClauseId('9.2.2.1');
                } else if (target === 'job_setup' || target === 'JOB SETUP') {
                  setViewMode('iatf');
                  setSelectedClauseId('8.5.1.3');
                  setIsCorrectiveActionPortalOpen(false);
                } else if (target.startsWith('clause:')) {
                  const clauseId = target.split(':')[1];
                  setViewMode('iatf');
                  setSelectedClauseId(clauseId);
                } else {
                  setViewMode(target as any);
                }
              }}
            />
          ) : viewMode === 'team_management' ? (
            <TeamManagement
              lang={lang}
              currentUser={currentUser}
              users={users}
              tasks={tasks}
              proposals={proposals}
              onLogin={handleLogin}
              onLogout={handleLogout}
              onAddUser={handleAddUser}
              onDeleteUser={handleDeleteUser}
              onUpdatePermissions={handleUpdatePermissions}
              onUpdateUser={handleUpdateUser}
              onAddTask={handleAddTask}
              onUpdateTaskStatus={handleUpdateTaskStatus}
              onApproveProposal={handleApproveProposal}
              onRejectProposal={handleRejectProposal}
              products={products}
            />
          ) : (
            <IatfAssistant
              lang={lang}
              onNavigateToClause={(clauseId) => {
                setSelectedClauseId(clauseId);
                setViewMode('iatf');
              }}
            />
          )}
        </main>
      </div>

      {/* Document Editor Modal */}
      {editingDoc && (
        <DocumentEditor
          isOpen={!!editingDoc}
          onClose={() => {
            setEditingDoc(null);
            setDocumentInitialRiskTab(undefined);
          }}
          template={editingDoc}
          onSave={handleSaveDocument}
          lang={lang}
          onNavigateToClause={(clauseId) => {
            setSelectedClauseId(clauseId);
            setViewMode('iatf');
            setEditingDoc(null);
            setDocumentInitialRiskTab(undefined);
          }}
          initialRiskActiveViewTab={documentInitialRiskTab}
          onOpenDocument={handleDocumentClick}
          requireMetadata={viewMode === 'iatf' || viewMode === 'iso9001_docs'}
          onPinToDashboard={handleCreateShortcutToIatfTools}
        />
      )}

      {/* Corrective Action Portal Modal */}
      {isCorrectiveActionPortalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-hidden animate-fade-in"
          dir={lang === 'fa' ? 'rtl' : 'ltr'}
        >
          <div className="bg-[#09090B] border border-[#222225] w-full max-w-7xl h-full max-h-[92vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
            {/* Header */}
            <header className="bg-[#121215] border-b border-[#212124] p-4 sm:p-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500 border border-amber-500/20 flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                </div>
                <div className={lang === 'fa' ? 'text-right' : 'text-left'}>
                  <h1 className="text-sm sm:text-base font-bold text-white tracking-tight leading-tight flex items-center gap-1.5">
                    <span>{lang === 'fa' ? 'کارتابل کنترل اقدامات اصلاحی (8D / RCA)' : 'Corrective Actions Control Portal (8D / RCA)'}</span>
                    <button
                      type="button"
                      onClick={handleCreateShortcutToIatfTools}
                      className="text-amber-500 hover:text-amber-400 p-1 transition-all select-none text-xs sm:text-sm cursor-pointer ml-1 animate-pulse"
                      title={lang === 'fa' ? 'پین به داشبورد ابزار IATF' : 'Pin to IATF Tools Dashboard'}
                    >
                      📌
                    </button>
                  </h1>
                  <p className="text-[10px] text-[#777] mt-0.5">
                    {lang === 'fa' 
                      ? 'مدیریت و مانیتورینگ عدم انطباق‌ها و ردیابی اقدامات تکمیلی و پیشگیرانه ذیل بند ۱۰.۲.۱' 
                      : 'Audit cases, RCA containment tracking, and nonconformance management under ISO 10.2.1'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCorrectiveActionPortalOpen(false)}
                className="hover:bg-white/5 text-slate-400 hover:text-white p-2 rounded-xl border border-transparent hover:border-[#2A2A2F] transition-all cursor-pointer select-none font-bold text-sm w-8 h-8 flex items-center justify-center"
                title={lang === 'fa' ? 'بستن' : 'Close'}
              >
                ✕
              </button>
            </header>

            {/* Portal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-[#0E0E10]">
              <CorrectiveActionPortal 
                lang={lang} 
                onSelectClauseId={(clauseId) => {
                  setSelectedClauseId(clauseId);
                  setViewMode('iatf');
                  setIsCorrectiveActionPortalOpen(false);
                }}
                onDocumentClick={(docName) => {
                  setIsCorrectiveActionPortalOpen(false);
                  handleDocumentClick(docName);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Add Tool Modal */}
      {isAddToolModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
          <div className="bg-[#0F0F12] border border-[#27272C] rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Sliders size={15} className="text-amber-500" />
                <span>{lang === 'fa' ? 'افزودن ابزار تخصصی جدید' : 'Add New Specialized Tool'}</span>
              </h3>
              <button
                onClick={() => setIsAddToolModalOpen(false)}
                className="text-zinc-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400">{lang === 'fa' ? 'نام ابزار یا موضوع ماتریس' : 'Tool Name'}</label>
                <input
                  type="text"
                  value={newToolName}
                  onChange={(e) => setNewToolName(e.target.value)}
                  placeholder={lang === 'fa' ? 'مثال: ماتریس کنترل حین تولید فاز ساخت' : 'e.g. In-Process Fabrication Control Matrix'}
                  className="bg-[#141418] border border-[#2A2A2E] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 text-right"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400">{lang === 'fa' ? 'توضیحات و اهداف ابزار' : 'Description / Objectives'}</label>
                <textarea
                  value={newToolDesc}
                  onChange={(e) => setNewToolDesc(e.target.value)}
                  placeholder={lang === 'fa' ? 'شرح مختصری از هدف پایش الزامات استاندارد...' : 'Brief description of target monitoring objectives...'}
                  rows={3}
                  className="bg-[#141418] border border-[#2A2A2E] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 resize-none text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/5 mt-1">
              <button
                onClick={() => setIsAddToolModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                {lang === 'fa' ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={handleCreateTool}
                className="bg-amber-500 hover:bg-amber-600 text-black px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-amber-500/10"
              >
                {lang === 'fa' ? 'ثبت و ایجاد ابزار' : 'Create Tool'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tool Modal */}
      {isEditToolModalOpen && editingTool && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
          <div className="bg-[#0F0F12] border border-[#27272C] rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Edit2 size={14} className="text-amber-500" />
                <span>{lang === 'fa' ? 'ویرایش مشخصات ابزار' : 'Edit Tool Specifications'}</span>
              </h3>
              <button
                onClick={() => {
                  setIsEditToolModalOpen(false);
                  setEditingTool(null);
                }}
                className="text-zinc-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400">{lang === 'fa' ? 'نام ابزار یا موضوع ماتریس' : 'Tool Name'}</label>
                <input
                  type="text"
                  value={editingTool.name}
                  onChange={(e) => setEditingTool({ ...editingTool, name: e.target.value })}
                  placeholder={lang === 'fa' ? 'نام ابزار را وارد نمایید' : 'Enter tool name'}
                  className="bg-[#141418] border border-[#2A2A2E] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 text-right"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-400">{lang === 'fa' ? 'توضیحات و اهداف ابزار' : 'Description / Objectives'}</label>
                <textarea
                  value={editingTool.description}
                  onChange={(e) => setEditingTool({ ...editingTool, description: e.target.value })}
                  placeholder={lang === 'fa' ? 'توضیحات ابزار را وارد نمایید' : 'Enter tool description'}
                  rows={3}
                  className="bg-[#141418] border border-[#2A2A2E] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 resize-none text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/5 mt-1">
              <button
                onClick={() => {
                  setIsEditToolModalOpen(false);
                  setEditingTool(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                {lang === 'fa' ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={handleEditToolSave}
                className="bg-amber-500 hover:bg-amber-600 text-black px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-amber-500/10"
              >
                {lang === 'fa' ? 'ذخیره تغییرات' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global State-based Confirmation Dialog Modal */}
      {appConfirmDialog.isOpen && (
        <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
          <div className="bg-[#0F0F12] border border-[#27272C] rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150 text-right">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
              <span className="text-red-500">{appConfirmDialog.title}</span>
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
              {appConfirmDialog.message}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setAppConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                {lang === 'fa' ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={appConfirmDialog.onConfirm}
                className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-red-500/10"
              >
                {lang === 'fa' ? 'تأیید حذف' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="h-8 bg-[#121214] border-t border-[#2A2A2D] flex items-center px-4 sm:px-8 justify-between shrink-0" dir="ltr">
        {/* Left Side: Live Shamsi Clock (Always on left) */}
        <div className="flex items-center">
          <ShamsiClock lang={lang} />
        </div>

        {/* Right Side: Identity information and update stamp (Always on right) */}
        <div className="text-[10px] text-[#555] flex gap-4 uppercase tracking-widest font-bold items-center" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
          <span>{isFaOrEn(lang === 'fa', "کاربر: کارشناس ارشد", "User: Lead Expert")}</span>
          <span>{isFaOrEn(lang === 'fa', "نسخه: سازمانی", "Release: Enterprise")}</span>
          <span className="text-zinc-700">|</span>
          <span className="text-amber-500/50 italic font-mono normal-case">
            Last standard update: 2026-06-09
          </span>
        </div>
      </footer>

      {/* Floating Hover Tooltip overlay for Long/Overflowing Cell Text globally */}
      {globalTooltip.visible && (
        <div 
          className="fixed z-[99999] max-w-md bg-gradient-to-b from-[#18181C] to-[#0D0D10] border border-amber-500/45 text-zinc-100 text-[11px] sm:text-[12px] p-3 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] leading-relaxed pointer-events-none text-right font-sans -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in-95 duration-100"
          style={{
            left: `${globalTooltip.x}px`,
            top: `${globalTooltip.y}px`,
          }}
          dir={lang === 'fa' ? 'rtl' : 'ltr'}
        >
          {/* Glowing subtle amber dot */}
          <div className="flex items-center gap-1.5 mb-2 pb-1.5 border-b border-white/[0.08] text-[9.5px] text-zinc-400 font-bold uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0 shadow-[0_0_5px_rgba(245,158,11,0.6)]"></span>
            <span>{lang === 'fa' ? 'مشاهده متن کامل بند یا عبارت' : 'Full Narrative'}</span>
          </div>
          <div className="whitespace-pre-wrap break-words text-zinc-200 select-text leading-relaxed font-medium">
            {globalTooltip.text}
          </div>
          {/* Subtle arrow tip below */}
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-full w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-amber-500/40"></div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #2A2A2D;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
        .vertical-text {
          writing-mode: vertical-rl;
          text-orientation: mixed;
          transform: rotate(180deg);
        }
      `}</style>

      {/* Global AI Engine Settings Modal */}
      <AiSettingsModal
        isOpen={isAiSettingsOpen}
        onClose={() => setIsAiSettingsOpen(false)}
        lang={lang}
      />
    </div>
  );
}

export default function App() {
  const [lang, setLang] = useState<'fa' | 'en'>(() => {
    try {
      const saved = localStorage.getItem('iatf_qms_lang');
      return (saved === 'fa' || saved === 'en') ? saved : 'fa';
    } catch {
      return 'fa';
    }
  });

  return (
    <ErrorSupervisorProvider isRtl={lang === 'fa'}>
      <AppContent lang={lang} setLang={setLang} />
    </ErrorSupervisorProvider>
  );
}

function isFaOrEn(isFa: boolean, faVal: string, enVal: string) {
  return isFa ? faVal : enVal;
}

// Global overflow checker helper function
function checkIfElementOverflows(el: HTMLElement): { isOverflowing: boolean; text: string } {
  if (!el) return { isOverflowing: false, text: '' };

  // 1. Explicit data attribute for custom forced tooltips
  const explicitText = el.getAttribute('data-hover-tooltip') || el.getAttribute('alias');
  if (explicitText && explicitText.trim().length > 0) {
    return { isOverflowing: true, text: explicitText.trim() };
  }

  // Identify tag name
  const tagName = el.tagName.toUpperCase();

  // Guard against layout containers or panels that contain form controls, lists, buttons, or other layout structures.
  // This completely stops container popups from displaying concatenated inputs or text blocks when mouse is over empty spaces.
  const isInputOrSelectOrTextArea = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
  if (!isInputOrSelectOrTextArea) {
    const hasLayoutOrControlChildren = el.querySelector('div, p, ul, ol, li, section, table, thead, tbody, tr, form, input, textarea, select, button, svg, iframe') !== null;
    if (hasLayoutOrControlChildren) {
      return { isOverflowing: false, text: '' };
    }
  }

  // 2. Extract inner text or input content based on tag type
  let text = '';
  if (tagName === 'INPUT') {
    text = (el as HTMLInputElement).value || '';
  } else if (tagName === 'TEXTAREA') {
    text = (el as HTMLTextAreaElement).value || '';
  } else if (tagName === 'SELECT') {
    const sel = el as HTMLSelectElement;
    if (sel.selectedIndex >= 0) {
      text = sel.options[sel.selectedIndex]?.text || '';
    } else {
      text = sel.value || '';
    }
  } else {
    text = el.innerText || el.textContent || '';
  }

  text = text.trim();
  // Filter out empty, extremely short, or single-digit numbers which obviously fit
  if (!text || text.length <= 4) {
    return { isOverflowing: false, text: '' };
  }

  // Skip tiny standard UI labels, buttons, or standalone counters
  if (/^(حذف|ویرایش|Del|Edit|Row|تایید|لغو|Save|Close|\d+%|[\d۰-۹٪]+|[\d\s:.-]+)$/i.test(text)) {
    return { isOverflowing: false, text: '' };
  }

  // 3. Precision overflow detection
  const style = window.getComputedStyle(el);
  const isNowrap = style.whiteSpace === 'nowrap' || style.whiteSpace === 'pre' || style.whiteSpace === 'pre-wrap';
  const hasEllipsis = style.textOverflow === 'ellipsis';
  const isOverflowHidden = style.overflow === 'hidden' || style.overflowX === 'hidden' || style.overflowY === 'hidden';
  
  // Detect Tailwind line-clamp utility classes or computed line clamp properties
  const hasLineClamp = (style.webkitLineClamp !== 'none' && style.webkitLineClamp !== '') || 
                       el.classList.contains('line-clamp-1') || 
                       el.classList.contains('line-clamp-2') || 
                       el.classList.contains('line-clamp-3');

  let isOverflowing = false;

  if (isInputOrSelectOrTextArea) {
    // Normal scroll check with 3px buffer to ignore browser sizing rounding errors
    isOverflowing = el.scrollWidth > el.clientWidth + 3;
    
    // Character approximation as robust fallback for single-line inputs
    if (!isOverflowing && tagName === 'INPUT') {
      const charWidth = 7.5;
      const estWidth = text.length * charWidth;
      if (estWidth > el.clientWidth) {
        isOverflowing = true;
      }
    }
  } else {
    // For standard HTML tags (div, span, button, th, td, labels), check if constrained text bounds actually exceed client bounds
    const isConstrained = hasLineClamp || isOverflowHidden || isNowrap || tagName === 'TH' || tagName === 'TD' || el.classList.contains('truncate') || el.classList.contains('flex-1') || el.classList.contains('shrink-0');
    
    if (isConstrained) {
      // scrollWidth checks horizontal truncation, scrollHeight checks vertical line clamp limits
      const horizontalOverflow = el.scrollWidth > el.clientWidth + 2;
      const verticalOverflow = el.scrollHeight > el.clientHeight + 2;
      isOverflowing = horizontalOverflow || verticalOverflow;

      // Safe character duration fallback for nowrap layouts
      if (!isOverflowing && (isNowrap || el.classList.contains('truncate'))) {
        const charWidth = 6.8;
        if (text.length * charWidth > el.clientWidth) {
          isOverflowing = true;
        }
      }
    }
  }

  return { isOverflowing, text };
}
