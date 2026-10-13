/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, CheckCircle2, AlertTriangle, TrendingUp, Plus, Trash2, Edit2, Save, 
  FileText, ExternalLink, Layers, Sparkles, Check, X, RefreshCw, BarChart2, 
  Activity, ShieldAlert, Award, ArrowLeftRight, Clock, UserCheck, Star, Search, PlusCircle, AlertCircle,
  Download, Upload, Database, Printer, ChevronDown, ChevronUp
} from 'lucide-react';
import { generateProcessRequirementsMatrix } from '../lib/matrixGenerator';
import { QmsDatabase } from '../lib/qmsDatabase';
import { getJalaliDate } from '../lib/dateUtils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export interface AuditProgram {
  id: string;
  title: string;
  cycle: string; // e.g., پاییز ۱۴۰۵
  scope: string; // e.g., دامنه ممیزی
  leadAuditor: string;
  auditDate: string; // YYYY-MM-DD or Jalali string
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed';
  processSchedules: {
    processId: string;
    processName: string;
    timeframe: string; // e.g., ۰۸:۳۰ الی ۱۰:۰۰
    clauses: string;   // Scope clauses (from Process-Req matrix)
  }[];
}

export interface ChecklistItem {
  id: string;
  programId: string;
  processId: string;
  processName: string;
  clauseId: string; // IATF clause e.g. 8.5.2.1
  clauseTitle: string; // IATF clause title
  csrText: string;     // Customers aligned requirements text
  question: string;
  guide: string;
  status: 'C' | 'Major_NC' | 'Minor_NC' | 'OFI'; // Compliance verdict
  evidence: string;
}

export interface Nonconformity {
  id: string;
  programId: string;
  processId: string;
  processName: string;
  clauseId: string;
  clauseTitle: string;
  csrText: string;
  title: string;
  description: string;
  classification: 'Major' | 'Minor';
  evidence: string;
  registeredAt: string;
  actionCode?: string; // Links to 8D Corrective Action portal
  actionStatus?: string; // Loaded dynamically
}

export interface OFIItem {
  id: string;
  programId: string;
  processId: string;
  processName: string;
  clauseId: string;
  title: string;
  suggestion: string;
  registeredAt: string;
}

export interface AuditReport {
  id: string;
  programId: string;
  programTitle: string;
  summary: string;
  strengths: string;
  weaknesses: string;
  managementNotes: string;
  generatedAt: string;
}

export interface CustomAuditorColumn {
  id: string;
  title: string;
}

export interface AuditorQualification {
  id: string;
  name: string;
  role: string;
  standardsCertified: boolean;
  coreToolsCertified: boolean;
  processApproachCertified: boolean;
  auditExperienceHours: number;
  certificateUploaded: boolean;
  status: 'fully_qualified' | 'needs_training' | 'apprentice';
  notes: string;
  customFields?: Record<string, boolean>;
}

interface Props {
  lang: 'fa' | 'en';
  currentUser?: any;
  onOpenCorrectiveActions?: () => void;
  onPinToDashboard?: () => void;
}

export default function InternalAuditModule({ lang, currentUser, onOpenCorrectiveActions, onPinToDashboard }: Props) {
  const isRtl = lang === 'fa';
  
  // --- DATABASE & STORAGE KEYS ---
  const KEYS = {
    PROGRAMS: 'qms_audit_module_programs_v1',
    CHECKLISTS: 'qms_audit_module_checklists_v1',
    NONCONFORMITIES: 'qms_audit_module_ncs_v1',
    OFIS: 'qms_audit_module_ofis_v1',
    REPORTS: 'qms_audit_module_reports_v1'
  };

  // --- COMPONENT STATES ---
  const [activeSubTab, setActiveSubTab] = useState<'program' | 'execution' | 'nc' | 'ofi' | 'report' | 'followup' | 'dashboard' | 'auditor_qualification' | 'archive_sync'>('program');
  const [programs, setPrograms] = useState<AuditProgram[]>([]);
  const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
  const [ncs, setNcs] = useState<Nonconformity[]>([]);
  const [ofis, setOfis] = useState<OFIItem[]>([]);
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [centralNcs, setCentralNcs] = useState<any[]>([]);
  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'success' | 'warn' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'error' | 'success' | 'warn' | 'info' = 'info') => {
    console.log(`[Notification] ${type.toUpperCase()}: ${message}`);
    setNotification({ message, type });
    // Keep it longer if it's an error to help user read
    const duration = type === 'error' ? 12000 : 6000;
    setTimeout(() => setNotification(prev => prev?.message === message ? null : prev), duration);
  };
  const [pearScores, setPearScores] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('qms_audit_module_pears_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const savePearScore = (processId: string, score: number) => {
    const next = { ...pearScores, [processId]: score };
    setPearScores(next);
    localStorage.setItem('qms_audit_module_pears_v1', JSON.stringify(next));
  };

  // --- AUDITOR QUALIFICATION STATES ---
  const [auditors, setAuditors] = useState<AuditorQualification[]>(() => {
    try {
      const saved = localStorage.getItem('qms_audit_module_auditors_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const saveAuditors = (next: AuditorQualification[]) => {
    setAuditors(next);
    localStorage.setItem('qms_audit_module_auditors_v1', JSON.stringify(next));
  };

  // --- DYNAMIC COLUMNS STATES & HANDLERS ---
  const [customColumns, setCustomColumns] = useState<CustomAuditorColumn[]>(() => {
    try {
      const saved = localStorage.getItem('qms_audit_module_auditor_columns_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const saveCustomColumns = (next: CustomAuditorColumn[]) => {
    setCustomColumns(next);
    localStorage.setItem('qms_audit_module_auditor_columns_v1', JSON.stringify(next));
  };

  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');

  const handleAddColumn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColumnTitle.trim()) return;
    const colId = `col_${Date.now()}`;
    const nextCols = [...customColumns, { id: colId, title: newColumnTitle.trim() }];
    saveCustomColumns(nextCols);
    
    // Update all existing auditors to have false for this new column
    const nextAuditors = auditors.map(aud => ({
      ...aud,
      customFields: {
        ...(aud.customFields || {}),
        [colId]: false
      }
    }));
    saveAuditors(nextAuditors);

    setNewColumnTitle('');
    setIsAddColumnModalOpen(false);
  };

  const handleDeleteColumn = (colId: string, title: string) => {
    if (confirm(isRtl ? `آیا از حذف ستون "${title}" اطمینان دارید؟` : `Are you sure you want to delete column "${title}"?`)) {
      const nextCols = customColumns.filter(c => c.id !== colId);
      saveCustomColumns(nextCols);
      
      // Clean up auditors custom fields
      const nextAuditors = auditors.map(aud => {
        const nextFields = { ...(aud.customFields || {}) };
        delete nextFields[colId];
        return {
          ...aud,
          customFields: nextFields
        };
      });
      saveAuditors(nextAuditors);
    }
  };

  const [isAuditorModalOpen, setIsAuditorModalOpen] = useState(false);
  const [editingAuditor, setEditingAuditor] = useState<AuditorQualification | null>(null);
  const [auditorForm, setAuditorForm] = useState<Omit<AuditorQualification, 'id'>>({
    name: '',
    role: '',
    standardsCertified: false,
    coreToolsCertified: false,
    processApproachCertified: false,
    auditExperienceHours: 0,
    certificateUploaded: false,
    status: 'needs_training',
    notes: '',
    customFields: {}
  });

  const [isAiAuditLoading, setIsAiAuditLoading] = useState(false);
  const [aiAuditResult, setAiAuditResult] = useState<any>(null);
  const [isAiReviewModalOpen, setIsAiReviewModalOpen] = useState(false);

  const handleRunAiAudit = async () => {
    console.log("AI Audit Triggered - Checking preconditions");
    
    if (isAiAuditLoading) {
      showNotification(isRtl ? 'ممیزی قبلاً شروع شده است.' : 'Audit already in progress.', 'info');
      return;
    }

    if (!programs || programs.length === 0) {
      const msg = isRtl 
        ? 'پروژه شما خالی است. برای شروع ممیزی هوشمند، ابتدا باید در تب "برنامه ممیزی" یک برنامه جدید (Audit Program) ایجاد کنید. هوش مصنوعی بدون برنامه و دامنه ممیزی قادر به فعالیت نیست.' 
        : 'Your project is empty. To start AI audit, first create an "Audit Program" in the programs tab. AI cannot function without a defined scope and program.';
      showNotification(msg, 'error');
      return;
    }

    const currentProgram = programs.find(p => p.id === selectedProgramId) || programs[0];
    const currentChecklists = checklists.filter(c => c.programId === currentProgram.id);

    if (currentChecklists.length === 0) {
      const msg = isRtl 
        ? 'چک‌لیست سوالات یافت نشد. لطفاً ابتدا در تب "اجرای ممیزی" سوالات را بر اساس فرآیندها تولید کنید (دکمه تولید سوالات) تا هوش مصنوعی بتواند آن‌ها را ممیزی کند.' 
        : 'Checklist not found. Please generate questions in the "Audit Execution" tab first so AI can audit them.';
      showNotification(msg, 'error');
      return;
    }

    setIsAiAuditLoading(true);
    showNotification(isRtl ? 'در حال جمع‌آوری اطلاعات پروژه و شروع تحلیل هوشمند...' : 'Gathering project context and starting AI analysis...', 'info');

    try {
      // Gather Context Data from various modules
      const kpisRaw = localStorage.getItem('qms_performance_dashboard_v1');
      const risksRaw = localStorage.getItem('iatf_risk_items');
      const csrsRaw = localStorage.getItem('iatf_csr_comparisons');
      const processMatrix = generateProcessRequirementsMatrix();

      const contextData = {
        kpis: kpisRaw ? JSON.parse(kpisRaw) : [],
        risks: risksRaw ? JSON.parse(risksRaw) : [],
        csrs: csrsRaw ? JSON.parse(csrsRaw) : [],
        processes: processMatrix
      };

      const hasCriticalData = contextData.kpis.length > 0 || contextData.risks.length > 0;
      
      if (!hasCriticalData) {
        const warnMsg = isRtl 
          ? 'پروژه فاقد داده‌های عملکردی (KPI) یا ریسک است. ممیزی فقط بر اساس ساختار انجام می‌شود. اگر می‌خواهید ممیزی دقیق باشد، ابتدا داده‌ها را در بخش شاخص‌ها و ریسک‌ها وارد کنید. آیا ادامه می‌دهید؟'
          : 'Project lacks KPI or Risk data. Audit will be structural only. For better results, fill KPIs and Risks first. Continue?';
        
        if (!window.confirm(warnMsg)) {
          setIsAiAuditLoading(false);
          return;
        }
      }

      console.log("Calling Backend /api/iatf/ai-internal-audit...");
      const response = await fetch('/api/iatf/ai-internal-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program: currentProgram,
          checklists: currentChecklists,
          contextData
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.success) {
        setAiAuditResult(result.data);
        setIsAiReviewModalOpen(true);
        showNotification(isRtl ? 'تحلیل هوشمند با موفقیت انجام شد. نتایج را بازبینی کنید.' : 'AI Analysis completed successfully. Review the results.', 'success');
      } else {
        throw new Error(result.error || 'Unknown AI Error');
      }
    } catch (err: any) {
      console.error("AI Audit Error:", err);
      showNotification(isRtl 
        ? `خطا در ممیزی هوشمند: ${err.message}. راهنمایی: اتصال اینترنت و کلید API را بررسی کنید.` 
        : `AI Audit failed: ${err.message}. Check internet and API key.`, 'error');
    } finally {
      setIsAiAuditLoading(false);
    }
  };

  const handleConfirmAiAudit = () => {
    if (!aiAuditResult) return;
    const currentProgram = programs.find(p => p.id === selectedProgramId) || programs[0];
    if (!currentProgram) return;

    // 1. Update Checklists
    const updatedChecklists = checklists.map(c => {
      const update = aiAuditResult.checklistUpdates.find((u: any) => u.id === c.id);
      if (update) {
        return { ...c, status: update.status, evidence: update.evidence };
      }
      return c;
    });
    saveChecklists(updatedChecklists);

    // 2. Add NCs
    const newNcs: Nonconformity[] = aiAuditResult.newNCs.map((nc: any) => ({
      id: `NC-AI-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      programId: currentProgram.id,
      processId: nc.processId,
      processName: processes.find(p => p.id === nc.processId)?.field1 || 'فرآیند نامشخص',
      clauseId: nc.clauseId,
      clauseTitle: getClauseTitle(nc.clauseId),
      csrText: '',
      title: nc.title,
      description: nc.description,
      classification: nc.classification,
      evidence: nc.evidence,
      registeredAt: getJalaliDate(new Date())
    }));
    saveNcs([...newNcs, ...ncs]);

    // 3. Add OFIs
    const newOfis: OFIItem[] = aiAuditResult.newOFIs.map((ofi: any) => ({
      id: `OFI-AI-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      programId: currentProgram.id,
      processId: ofi.processId,
      processName: processes.find(p => p.id === ofi.processId)?.field1 || 'فرآیند نامشخص',
      clauseId: ofi.clauseId,
      title: ofi.title,
      suggestion: ofi.suggestion,
      registeredAt: getJalaliDate(new Date())
    }));
    saveOfis([...newOfis, ...ofis]);

    // 4. Create/Update Report
    const newReport: AuditReport = {
      id: `REP-AI-${Date.now()}`,
      programId: currentProgram.id,
      programTitle: currentProgram.title,
      summary: aiAuditResult.report.summary,
      strengths: aiAuditResult.report.strengths,
      weaknesses: aiAuditResult.report.weaknesses,
      managementNotes: aiAuditResult.report.managementNotes,
      generatedAt: getJalaliDate(new Date())
    };
    saveReports([newReport, ...reports]);

    setIsAiReviewModalOpen(false);
    showNotification(isRtl ? 'نتایج ممیزی هوشمند با موفقیت ثبت گردید.' : 'AI Audit results successfully registered.', 'success');
    setActiveSubTab('execution');
  };

  //Selection states
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');
  const [selectedProcessId, setSelectedProcessId] = useState<string>('');

  // Modals / Editors
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<AuditProgram | null>(null);
  const [isNcModalOpen, setIsNcModalOpen] = useState(false);
  const [newNcData, setNewNcData] = useState<{
    checklistRowId?: string;
    processId: string;
    processName: string;
    clauseId: string;
    clauseTitle: string;
    csrText: string;
    title: string;
    description: string;
    classification: 'Major' | 'Minor';
    evidence: string;
  }>({
    processId: '',
    processName: '',
    clauseId: '',
    clauseTitle: '',
    csrText: '',
    title: '',
    description: '',
    classification: 'Minor',
    evidence: ''
  });

  // Program Form States
  const [programForm, setProgramForm] = useState({
    title: '',
    cycle: 'پاییز ۱۴۰۵',
    scope: 'کلیه فرآیندهای سازمان بر اساس ماتریس فرآیندها-الزامات',
    leadAuditor: 'جناب مهندس رضایی (سرممیز کیفیت)',
    auditDate: '۱۴۰۵/۰۷/۱۵',
    status: 'draft' as AuditProgram['status'],
    processSchedules: [] as AuditProgram['processSchedules']
  });

  // CSR Comparisons Cache (loaded from main CSR module storage)
  const csrComparisons = useMemo(() => {
    try {
      const raw = localStorage.getItem('iatf_csr_comparisons');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }, []);

  // Fetch Processes from Process-Requirements Matrix
  const processes = useMemo(() => {
    return generateProcessRequirementsMatrix();
  }, []);

  // --- UTILS FOR DATE HANDLING ---
  const toEnglishDigits = (str: string): string => {
    return str.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
  };

  const parseJalaliString = (dateStr: string): { jy: number, jm: number, jd: number } | null => {
    if (!dateStr) return null;
    const cleaned = toEnglishDigits(dateStr);
    const parts = cleaned.split('/').map(p => parseInt(p, 10));
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return { jy: parts[0], jm: parts[1], jd: parts[2] };
    }
    return null;
  };

  const syncProgramsToCalendar = (data: AuditProgram[]) => {
    try {
      const STORAGE_KEY = 'iatf_qms_internal_audit_tasks';
      const savedTasksRaw = localStorage.getItem(STORAGE_KEY);
      let calendarTasks: any[] = [];
      if (savedTasksRaw) {
        calendarTasks = JSON.parse(savedTasksRaw);
      }
      if (!Array.isArray(calendarTasks)) {
        calendarTasks = [];
      }

      // Filter out previous program tasks to avoid duplicates, then rebuild them
      const otherTasks = calendarTasks.filter((t: any) => !t.id?.startsWith('audit-prog-'));

      const programTasks = data.map((prog) => {
        const parsedDate = parseJalaliString(prog.auditDate);
        const month = parsedDate ? parsedDate.jm : 4; // default to Tir if parsing fails
        const day = parsedDate ? parsedDate.jd : 15;   // default to 15 if parsing fails

        let taskStatus: 'todo' | 'in_progress' | 'completed' = 'todo';
        if (prog.status === 'completed') taskStatus = 'completed';
        else if (prog.status === 'in_progress') taskStatus = 'in_progress';

        return {
          id: `audit-prog-${prog.id}`,
          title: `ممیزی سیستم: ${prog.title}`,
          category: 'internal_audit' as const,
          month,
          day,
          auditor: prog.leadAuditor || 'سرممیز ممیزی داخلی',
          leadNotifyDays: 5,
          priority: 'high' as const,
          status: taskStatus,
          description: `دامنه ممیزی: ${prog.scope}`,
          processName: prog.processSchedules[0]?.processName || 'سیستم مدیریت کیفیت'
        };
      });

      const updatedTasks = [...otherTasks, ...programTasks];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
      window.dispatchEvent(new Event('qms-internal-audit-tasks-updated'));
    } catch (e) {
      console.error('Error syncing programs to calendar:', e);
    }
  };

  const syncCalendarToPrograms = () => {
    try {
      const pRaw = localStorage.getItem(KEYS.PROGRAMS);
      if (!pRaw) return;
      const currentPrograms: AuditProgram[] = JSON.parse(pRaw);
      if (!Array.isArray(currentPrograms)) return;

      const savedTasksRaw = localStorage.getItem('iatf_qms_internal_audit_tasks');
      if (!savedTasksRaw) return;
      const calendarTasks: any[] = JSON.parse(savedTasksRaw);
      if (!Array.isArray(calendarTasks)) return;

      let hasChanges = false;
      const updatedPrograms = currentPrograms.map(prog => {
        const correspondingTask = calendarTasks.find((t: any) => t.id === `audit-prog-${prog.id}`);
        if (correspondingTask) {
          // Construct the Jalali string from task month and day
          const tMonth = String(correspondingTask.month).padStart(2, '0');
          const tDay = String(correspondingTask.day).padStart(2, '0');
          const expectedDateStr = `۱۴۰۵/${tMonth}/${tDay}`;
          const currentCleanDate = toEnglishDigits(prog.auditDate);
          const taskCleanDate = toEnglishDigits(expectedDateStr);

          if (currentCleanDate !== taskCleanDate) {
            hasChanges = true;
            return {
              ...prog,
              auditDate: expectedDateStr // Sync to program!
            };
          }
        }
        return prog;
      });

      if (hasChanges) {
        setPrograms(updatedPrograms);
        localStorage.setItem(KEYS.PROGRAMS, JSON.stringify(updatedPrograms));
        window.dispatchEvent(new Event('qms-internal-audit-programs-updated'));
      }
    } catch (e) {
      console.error('Error syncing calendar to programs:', e);
    }
  };

  // --- INITIAL LOAD & SYNC EVENT LISTENERS ---
  useEffect(() => {
    const loadData = () => {
      try {
        const p = localStorage.getItem(KEYS.PROGRAMS);
        const c = localStorage.getItem(KEYS.CHECKLISTS);
        const n = localStorage.getItem(KEYS.NONCONFORMITIES);
        const o = localStorage.getItem(KEYS.OFIS);
        const r = localStorage.getItem(KEYS.REPORTS);

        if (p) setPrograms(JSON.parse(p));
        if (c) setChecklists(JSON.parse(c));
        if (n) setNcs(JSON.parse(n));
        if (o) setOfis(JSON.parse(o));
        if (r) setReports(JSON.parse(r));

        // Load central 8D NCs list to synchronize corrective action status
        const dbNcs = QmsDatabase.selectAll('nc_items_table');
        if (dbNcs) {
          setCentralNcs(Object.values(dbNcs));
        }
      } catch (e) {
        console.error('Failed to load Internal Audit data:', e);
      }
    };

    loadData();

    // Event listener for live updates from central NCs
    const handleSync = () => {
      const dbNcs = QmsDatabase.selectAll('nc_items_table');
      if (dbNcs) setCentralNcs(Object.values(dbNcs));
    };

    // Event listener for Calendar Tasks updates
    const handleCalendarTasksSync = () => {
      syncCalendarToPrograms();
    };

    // Event listener for Programs updates (re-load programs if another component changed them)
    const handleProgramsSync = () => {
      try {
        const p = localStorage.getItem(KEYS.PROGRAMS);
        if (p) setPrograms(JSON.parse(p));
      } catch (e) {
        console.error(e);
      }
    };

    // Event listener for restoring active audit session from record files
    const handleRestoreSession = (e: Event) => {
      try {
        const detail = (e as CustomEvent).detail;
        if (!detail) return;
        
        // Save to state & storage
        if (detail.program) {
          savePrograms([detail.program]);
          setSelectedProgramId(detail.program.id);
        } else {
          savePrograms([]);
          setSelectedProgramId('');
        }
        
        saveChecklists(detail.checklist || []);
        saveNcs(detail.ncs || []);
        saveOfis(detail.ofis || []);
        saveReports(detail.reports || []);
        
        setActiveSubTab('archive_sync');
        
        // Show success alert
        console.log('InternalAuditModule: Audit session restored successfully from custom event.');
      } catch (err) {
        console.error('Failed to restore session inside InternalAuditModule:', err);
      }
    };

    window.addEventListener('qms_nc_updated', handleSync);
    window.addEventListener('qms-internal-audit-tasks-updated', handleCalendarTasksSync);
    window.addEventListener('qms-internal-audit-programs-updated', handleProgramsSync);
    window.addEventListener('restore-audit-session', handleRestoreSession);

    return () => {
      window.removeEventListener('qms_nc_updated', handleSync);
      window.removeEventListener('qms-internal-audit-tasks-updated', handleCalendarTasksSync);
      window.removeEventListener('qms-internal-audit-programs-updated', handleProgramsSync);
      window.removeEventListener('restore-audit-session', handleRestoreSession);
    };
  }, []);

  const handleReloadAuditData = (silent = false) => {
    try {
      const p = localStorage.getItem(KEYS.PROGRAMS);
      const c = localStorage.getItem(KEYS.CHECKLISTS);
      const n = localStorage.getItem(KEYS.NONCONFORMITIES);
      const o = localStorage.getItem(KEYS.OFIS);
      const r = localStorage.getItem(KEYS.REPORTS);

      if (p) setPrograms(JSON.parse(p));
      else setPrograms([]);

      if (c) setChecklists(JSON.parse(c));
      else setChecklists([]);

      if (n) setNcs(JSON.parse(n));
      else setNcs([]);

      if (o) setOfis(JSON.parse(o));
      else setOfis([]);

      if (r) setReports(JSON.parse(r));
      else setReports([]);

      // Load central 8D NCs list to synchronize corrective action status
      const dbNcs = QmsDatabase.selectAll('nc_items_table');
      if (dbNcs) {
        setCentralNcs(Object.values(dbNcs));
      }

      // Sync archived cumulative records list
      syncArchivedRecords();

      if (!silent) {
        alert(isRtl ? 'سوابق ممیزی با موفقیت مجدداً بارگذاری و بازیابی شدند!' : 'Audit records successfully reloaded!');
      }
    } catch (e) {
      if (!silent) {
        alert(isRtl ? 'خطا در بارگذاری مجدد اطلاعات ممیزی.' : 'Error reloading audit data.');
      }
    }
  };

  // --- SAVE HELPERS ---
  const savePrograms = (data: AuditProgram[]) => {
    setPrograms(data);
    localStorage.setItem(KEYS.PROGRAMS, JSON.stringify(data));
    // Trigger sync to QMS calendar
    syncProgramsToCalendar(data);
    window.dispatchEvent(new Event('qms-internal-audit-programs-updated'));
  };

  const saveChecklists = (data: ChecklistItem[]) => {
    setChecklists(data);
    localStorage.setItem(KEYS.CHECKLISTS, JSON.stringify(data));
  };

  const saveNcs = (data: Nonconformity[]) => {
    setNcs(data);
    localStorage.setItem(KEYS.NONCONFORMITIES, JSON.stringify(data));
  };

  const saveOfis = (data: OFIItem[]) => {
    setOfis(data);
    localStorage.setItem(KEYS.OFIS, JSON.stringify(data));
  };

  const saveReports = (data: AuditReport[]) => {
    setReports(data);
    localStorage.setItem(KEYS.REPORTS, JSON.stringify(data));
  };

  // --- CUMULATIVE DATABASE ARCHIVE HANDLERS ---
  const [archivedRecords, setArchivedRecords] = useState<any[]>([]);

  // Sync / retrieve saved cumulative records from QmsDatabase
  const syncArchivedRecords = () => {
    try {
      const allRecords = QmsDatabase.selectAll('records_table') || {};
      const cumulative = Object.values(allRecords).filter((r: any) => 
        r.clauseId === '9.2.2.2' && (r.isCumulativeAuditFile || (r.code && r.code.startsWith('QMS-AUDIT-CUMULATIVE')))
      );
      setArchivedRecords(cumulative);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    syncArchivedRecords();
    const handleDbMutated = () => syncArchivedRecords();
    window.addEventListener('qms-db-mutated', handleDbMutated);
    return () => window.removeEventListener('qms-db-mutated', handleDbMutated);
  }, []);

  const handleSaveCumulativeRecord = () => {
    if (programs.length === 0) {
      showNotification(isRtl ? 'هیچ برنامه ممیزی تعریف نشده است. ابتدا یک برنامه ممیزی اضافه کنید.' : 'No audit program is defined yet.', 'warn');
      return;
    }
    
    // Find selected program or default to first
    const mainProgram = programs.find(p => p.id === selectedProgramId) || programs[0];
    if (!mainProgram) return;

    // Enforce uniqueness: Use program ID to form a unique record key
    const recordId = `CUMULATIVE-AUDIT-${mainProgram.id}`;
    
    // Enforce data integrity: Partition checklists, NCs, OFIs, and reports for this program specifically
    const relatedChecklists = checklists.filter(c => c.programId === mainProgram.id);
    const relatedNcs = ncs.filter(n => n.programId === mainProgram.id);
    const relatedOfis = ofis.filter(o => o.programId === mainProgram.id);
    const relatedReports = reports.filter(r => r.programId === mainProgram.id);

    // Check if record already exists to prevent duplicate entries in the database
    const allRecords = QmsDatabase.selectAll('records_table') || {};
    const exists = !!allRecords[recordId];

    if (exists) {
      const confirmOverwrite = confirm(isRtl
        ? `⚠️ توجه: پرونده جامع ممیزی برای برنامه ممیزی «${mainProgram.title}» قبلاً در سوابق ثبت و بایگانی شده است!\n\nآیا تمایل دارید سابقه بایگانی قبلی را با آخرین ویرایش و تغییرات جدید ممیزی به‌روزرسانی و بازنویسی (Overwrite) نمایید؟`
        : `⚠️ Warning: The audit dossier for "${mainProgram.title}" has already been archived!\n\nDo you want to overwrite and update the existing archive with the latest changes?`
      );
      if (!confirmOverwrite) {
        return;
      }
    }

    const recordObj = {
      id: recordId,
      documentName: isRtl 
        ? `پرونده ممیزی تجمعی: ${mainProgram.title} (${mainProgram.cycle})` 
        : `Cumulative Audit File: ${mainProgram.title} (${mainProgram.cycle})`,
      clauseId: '9.2.2.2',
      archivedAt: new Date().toLocaleDateString('fa-IR'),
      code: `QMS-AUDIT-CUMULATIVE-${mainProgram.id}`,
      revision: exists ? String(parseInt(allRecords[recordId].revision || '01', 10) + 1).padStart(2, '0') : '01',
      preparedBy: currentUser?.fullName || currentUser?.username || (isRtl ? 'سرممیز ارشد سیستم مدیریت کیفیت (IATF)' : 'Lead QMS IATF Auditor'),
      approvedBy: isRtl ? 'نماینده مدیریت در سیستم مدیریت کیفیت' : 'QMS Management Representative',
      isCumulativeAuditFile: true,
      savedAuditProgram: mainProgram,
      savedAuditChecklist: relatedChecklists,
      savedNcs: relatedNcs,
      savedOfis: relatedOfis,
      savedReports: relatedReports,
      items: {
        programs: [mainProgram],
        checklists: relatedChecklists,
        ncs: relatedNcs,
        ofis: relatedOfis,
        reports: relatedReports,
        savedAt: new Date().toISOString()
      }
    };

    try {
      QmsDatabase.writeRow('records_table', recordId, recordObj);
      
      const successMsg = exists
        ? (isRtl 
            ? `🔄 پرونده بایگانی قبلی «${mainProgram.title}» با آخرین تغییرات به‌روزرسانی شد و از ایجاد داده‌های تکراری جلوگیری گردید!` 
            : `🔄 The existing archive for "${mainProgram.title}" was updated successfully, preventing duplicates!`)
        : (isRtl 
            ? `📂 پرونده جامع ممیزی جدید «${mainProgram.title}» با موفقیت بایگانی گردید!` 
            : `📂 Comprehensive audit dossier "${mainProgram.title}" archived successfully!`);

      showNotification(successMsg, 'success');
      syncArchivedRecords();
      // Dispatch database mutation event so records components will reload their lists!
      window.dispatchEvent(new Event('qms-db-mutated'));
    } catch (err) {
      alert(isRtl ? 'خطا در ثبت رکورد تجمعی.' : 'Error writing cumulative record.');
    }
  };

  const handleRestoreCumulativeRecord = (record: any) => {
    if (confirm(isRtl 
      ? 'آیا از بازگردانی این پرونده تجمعی ممیزی اطمینان دارید؟ داده‌های فعلی مربوط به این برنامه ممیزی بازنویسی خواهد شد.' 
      : 'Restore this cumulative audit record? This will merge with and overwrite existing data for this program.'
    )) {
      try {
        const payload = record.items || {
          programs: record.savedAuditProgram ? [record.savedAuditProgram] : [],
          checklists: record.savedAuditChecklist || [],
          ncs: record.savedNcs || [],
          ofis: record.savedOfis || [],
          reports: record.savedReports || []
        };
        
        // Data Integrity merge: Overwrite only elements of this program to keep other programs intact!
        const restoredProgIds = (payload.programs || []).map((p: any) => p.id);
        
        if (payload.programs && payload.programs.length > 0) {
          const nextPrograms = [
            ...programs.filter(p => !restoredProgIds.includes(p.id)),
            ...payload.programs
          ];
          savePrograms(nextPrograms);
          setSelectedProgramId(payload.programs[0].id);
        }

        if (payload.checklists) {
          const nextChecklists = [
            ...checklists.filter(c => !restoredProgIds.includes(c.programId)),
            ...payload.checklists
          ];
          saveChecklists(nextChecklists);
        }

        if (payload.ncs) {
          const nextNcs = [
            ...ncs.filter(n => !restoredProgIds.includes(n.programId)),
            ...payload.ncs
          ];
          saveNcs(nextNcs);
        }

        if (payload.ofis) {
          const nextOfis = [
            ...ofis.filter(o => !restoredProgIds.includes(o.programId)),
            ...payload.ofis
          ];
          saveOfis(nextOfis);
        }

        if (payload.reports) {
          const nextReports = [
            ...reports.filter(r => !restoredProgIds.includes(r.programId)),
            ...payload.reports
          ];
          saveReports(nextReports);
        }

        showNotification(isRtl ? 'پرونده ممیزی تجمعی با حفظ یکپارچگی سایر داده‌ها با موفقیت بازیابی و ادغام شد!' : 'Cumulative Audit File restored and merged successfully!', 'success');
      } catch (e) {
        alert(isRtl ? 'ساختار فایل پرونده ممیزی نامعتبر است.' : 'Invalid file payload structure.');
      }
    }
  };

  const handleDeleteCumulativeRecord = (recordId: string) => {
    if (confirm(isRtl ? 'آیا از حذف این سابقه تجمعی اطمینان دارید؟' : 'Delete this archived cumulative record?')) {
      try {
        QmsDatabase.deleteRow('records_table', recordId);
        syncArchivedRecords();
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDownloadCumulativeFile = () => {
    if (programs.length === 0) {
      alert(isRtl ? 'برنامه‌ای جهت دانلود یافت نشد.' : 'No audit program to download.');
      return;
    }
    const mainProgram = programs[0];
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      version: 'IATF-QMS-CUMULATIVE-AUDIT-V1',
      exportedAt: new Date().toISOString(),
      programs,
      checklists,
      ncs,
      ofis,
      reports
    }, null, 2));

    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    const filename = `cumulative_qms_audit_${mainProgram.id}_${Date.now()}.json`;
    downloadAnchor.setAttribute("download", filename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleUploadCumulativeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.programs || !parsed.checklists) {
          alert(isRtl ? 'فرمت فایل پرونده ممیزی نامعتبر است. ساختار باید شامل برنامه و چک‌لیست باشد.' : 'Invalid file. Must contain program and checklist payloads.');
          return;
        }

        if (confirm(isRtl 
          ? 'پرونده ممیزی تجمعی شناسایی شد. آیا مایل به بارگذاری این داده‌ها و بازنویسی وضعیت فعلی ماژول هستید؟' 
          : 'Cumulative QMS audit file detected. Overwrite current states?'
        )) {
          savePrograms(parsed.programs || []);
          saveChecklists(parsed.checklists || []);
          saveNcs(parsed.ncs || []);
          saveOfis(parsed.ofis || []);
          saveReports(parsed.reports || []);

          if (parsed.programs && parsed.programs.length > 0) {
            setSelectedProgramId(parsed.programs[0].id);
          }

          showNotification(isRtl ? 'پرونده تجمعی ممیزی با موفقیت از روی فایل وارد شد!' : 'Cumulative Audit File imported successfully from file!', 'success');
        }
      } catch (err) {
        alert(isRtl ? 'خطا در تحلیل و پارس فایل متنی.' : 'Error parsing the JSON file.');
      }
    };
    reader.readAsText(file);
  };

  // Synchronize dynamic status of nonconformities from central 8D portal
  const activeNcs = useMemo(() => {
    return ncs.map(nc => {
      const matchedCentral = centralNcs.find(c => c.id === nc.actionCode);
      return {
        ...nc,
        actionStatus: matchedCentral ? matchedCentral.status : nc.actionStatus || 'NEW'
      };
    });
  }, [ncs, centralNcs]);

  // --- 1. AUDIT PROGRAM (CRUD & SUGGESTION ENGINE) ---
  const handleOpenAddProgram = () => {
    setEditingProgram(null);
    
    // Automatically suggest timeframes and fetch scopes dynamically from Matrix
    const suggestedSchedules = processes.map((proc, index) => {
      // Fetch IATF Clauses and extract all specific ones mapped in matrix
      const clausesList: string[] = [];
      const regex = /\b\d+(\.\d+)+\b/g;
      let match;
      const searchSource = (proc.clauseId || '') + ' ' + (proc.field3 || '');
      while ((match = regex.exec(searchSource)) !== null) {
        if (!clausesList.includes(match[0])) {
          clausesList.push(match[0]);
        }
      }
      if (clausesList.length === 0) {
        clausesList.push(proc.clauseId || '4.4');
      }
      const clausesStr = clausesList.join(', ');
      
      // Calculate smart timeframe (2-hour blocks starting at 08:30)
      const startHour = 8 + Math.floor(index * 2);
      const startMin = index % 2 === 0 ? '30' : '00';
      // Calculate smart timeframe (make empty so user has to fill it)
      const timeframeStr = '';

      return {
        processId: proc.id || `proc-${index}`,
        processName: proc.field1 || 'فرآیند بدون نام',
        timeframe: timeframeStr,
        clauses: clausesStr
      };
    });

    setProgramForm({
      title: '',
      cycle: '',
      scope: '',
      leadAuditor: '',
      auditDate: '',
      status: 'draft',
      processSchedules: suggestedSchedules
    });
    setIsProgramModalOpen(true);
  };

  const handleOpenEditProgram = (prog: AuditProgram) => {
    setEditingProgram(prog);
    setProgramForm({
      title: prog.title,
      cycle: prog.cycle,
      scope: prog.scope,
      leadAuditor: prog.leadAuditor,
      auditDate: prog.auditDate,
      status: prog.status,
      processSchedules: prog.processSchedules
    });
    setIsProgramModalOpen(true);
  };

  const handleSaveProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!programForm.title.trim()) {
      showNotification(isRtl ? '⚠️ خطا: فیلد «عنوان ممیزی» خالی است! لطفاً آن را پر کنید.' : '⚠️ Error: "Audit Title" is empty! Please fill it.', 'error');
      return;
    }
    if (!programForm.cycle.trim()) {
      showNotification(isRtl ? '⚠️ خطا: فیلد «دوره ممیزی» خالی است! لطفاً آن را پر کنید.' : '⚠️ Error: "Audit Cycle" is empty! Please fill it.', 'error');
      return;
    }
    if (!programForm.scope.trim()) {
      showNotification(isRtl ? '⚠️ خطا: فیلد «دامنه ممیزی» خالی است! لطفاً آن را پر کنید.' : '⚠️ Error: "Audit Scope" is empty! Please fill it.', 'error');
      return;
    }
    if (!programForm.leadAuditor.trim()) {
      showNotification(isRtl ? '⚠️ خطا: فیلد «سرممیز / تیم ممیزی» خالی است! لطفاً آن را پر کنید.' : '⚠️ Error: "Lead Auditor" is empty! Please fill it.', 'error');
      return;
    }
    if (!programForm.auditDate.trim()) {
      showNotification(isRtl ? '⚠️ خطا: فیلد «تاریخ اصلی ممیزی» خالی است! لطفاً آن را پر کنید.' : '⚠️ Error: "Target Date" is empty! Please fill it.', 'error');
      return;
    }

    const emptySchedule = programForm.processSchedules.find(ps => !ps.timeframe.trim() || !ps.clauses.trim());
    if (emptySchedule) {
      alert(isRtl 
        ? `⚠️ خطا: فیلد زمان‌بندی یا محدوده بندها برای فرآیند «${emptySchedule.processName}» خالی است! لطفاً آن را پر کنید.` 
        : `⚠️ Error: Time slot or clauses for "${emptySchedule.processName}" is empty! Please fill it.`);
      return;
    }

    if (editingProgram) {
      // Edit
      const updated = programs.map(p => p.id === editingProgram.id ? {
        ...p,
        title: programForm.title,
        cycle: programForm.cycle,
        scope: programForm.scope,
        leadAuditor: programForm.leadAuditor,
        auditDate: programForm.auditDate,
        status: programForm.status,
        processSchedules: programForm.processSchedules
      } : p);
      savePrograms(updated);
    } else {
      // Add
      const newProg: AuditProgram = {
        id: `PROG-${Date.now()}`,
        title: programForm.title,
        cycle: programForm.cycle,
        scope: programForm.scope,
        leadAuditor: programForm.leadAuditor,
        auditDate: programForm.auditDate,
        status: programForm.status,
        processSchedules: programForm.processSchedules
      };
      savePrograms([newProg, ...programs]);
      
      // Auto-populate checklist questions from matrix and CSR
      initializeChecklistForProgram(newProg);
    }
    setIsProgramModalOpen(false);
  };

  const handleDeleteProgram = (id: string) => {
    if (confirm(isRtl ? 'آیا از حذف این برنامه ممیزی اطمینان دارید؟ تمام چک‌لیست‌های مربوطه نیز پاک خواهند شد.' : 'Delete this audit program? Associated checklists will be deleted.')) {
      savePrograms(programs.filter(p => p.id !== id));
      saveChecklists(checklists.filter(c => c.programId !== id));
      saveNcs(ncs.filter(n => n.programId !== id));
      saveOfis(ofis.filter(o => o.programId !== id));
    }
  };

  // Helper to construct checklists with IATF and Aligned CSR elements side-by-side
  const initializeChecklistForProgram = (prog: AuditProgram) => {
    const freshChecklist: ChecklistItem[] = [];

    prog.processSchedules.forEach(sched => {
      // Extract mapped clauses for this process
      const clauseList = sched.clauses.split(/[،,;\s]+/).map(c => c.trim()).filter(Boolean);
      
      clauseList.forEach(clauseId => {
        // Find corresponding CSR requirements
        const matchedCsrs = csrComparisons.filter((csr: any) => csr.mappedIatfClauseId === clauseId);
        const csrText = matchedCsrs.length > 0
          ? matchedCsrs.map((c: any) => `[${c.documentTitle || 'الزام خاص'}] بند ${c.customerNumber}: ${c.customerText}`).join(' | \n')
          : 'الزام خاص همگام‌سازی شده ثبت نشده است. ممیزی منطبق با استانداردهای عمومی انجام می‌شود.';

        // Create standard questions based on clause ID
        const questions = getQuestionsForClause(clauseId, sched.processName);
        
        questions.forEach((q, idx) => {
          freshChecklist.push({
            id: `CHK-${sched.processId}-${clauseId}-${idx}-${Date.now()}`,
            programId: prog.id,
            processId: sched.processId,
            processName: sched.processName,
            clauseId: clauseId,
            clauseTitle: getClauseTitle(clauseId),
            csrText: csrText,
            question: q.question,
            guide: q.guide,
            status: 'C',
            evidence: 'بررسی شواهد و نمونه‌گیری انجام شد و انطباق فرآیند احراز گردید.'
          });
        });
      });
    });

    saveChecklists([...freshChecklist, ...checklists]);
  };

  const getClauseTitle = (id: string): string => {
    const titles: Record<string, string> = {
      '4.4': 'فرآیندهای سیستم مدیریت کیفیت (لاک‌پشتی فرآیند)',
      '6.1': 'ریسک‌ها و فرصت‌های فرآیندی',
      '7.1.5': 'کالیبراسیون و پایش ابزارهای اندازه‌گیری',
      '7.2': 'شایستگی و مهارت‌های فنی کارکنان',
      '7.5': 'کنترل اسناد، مدارک و فرم‌های سیستمی',
      '8.1': 'برنامه‌ریزی عملیاتی و کنترل کیفیت سالن ساخت',
      '8.3': 'تکوین و تایید فرآیندهای ساخت (PPAP / APQP)',
      '8.4': 'ارزیابی و عملکرد ممیزی پیمانکاران زنجیره تامین',
      '8.5.1': 'طرح‌های کنترلی (Control Plan) و دستورالعمل‌های کاری (WI)',
      '8.5.1.3': 'تأییدیه تنظیمات کاری (Setup Verification)',
      '8.5.1.5': 'نگهداری و تعمیرات بهره‌ور جامع (TPM)',
      '8.5.2': 'شناسایی و ردیابی قطعات بحرانی ذوب تکی',
      '8.5.6.1': 'مدیریت تغییرات موقت فرآیند (Temporary changes)',
      '8.7': 'کنترل خروجی‌های نامنطبق و زون‌های قرنطینه کارگاهی',
      '9.1': 'پایش آماری فرآیند (SPC) و توانمندی فرآیندها',
      '10.2': 'اقدامات اصلاحی و حل علمی مسئله (RCA / 8D)',
      '10.2.4': 'خطاناشدنی‌سازی فیزیکی (Poka-Yoke)'
    };
    return titles[id] || 'سایر بندهای تکمیلی استاندارد IATF';
  };

  const getQuestionsForClause = (id: string, processName: string) => {
    const clauseStr = id.trim();
    
    if (clauseStr.startsWith('4.4')) {
      return [
        { question: `آیا فرآیند «${processName}» بر اساس ساختار استاندارد شناسنامه فرآیندها (نمودار لاک‌پشتی Turtle Diagram) دارای ورودی‌ها، خروجی‌ها، منابع، مالکان و شاخص‌های پایش معین است؟`, guide: 'بررسی زنده شناسنامه فرآیند و انطباق آن با ورودی و خروجی فیزیکی کارگاه.' },
        { question: `آیا ریسک‌ها و فرصت‌های فرآیندی مرتبط با این فرآیند شناسایی شده و اثربخشی اقدامات مهار آنها بررسی می‌گردد؟`, guide: 'مشاهده جدول FMEA فرآیندی و مطابقت با رخدادهای توقف خط.' }
      ];
    }
    if (clauseStr.startsWith('6.1') || clauseStr.startsWith('6.2')) {
      return [
        { question: `آیا تجزیه و تحلیل حالات شکست بالقوه فرآیند (PFMEA) برای «${processName}» به صورت CFT بازنگری شده و RPNهای بالای حد بحرانی دارای اقدامات اصلاحی اثربخش هستند؟`, guide: 'کنترل آخرین مدرک PFMEA، تاییدیه CFT و بررسی اقدامات تعریف شده برای شماره‌های اولویت ریسک بالا.' },
        { question: `آیا اهداف کیفیت (KPI) تعریف شده برای این فرآیند بر اساس الزامات مشتری پایش شده و انحرافات به گشایش پرونده‌های اقدام اصلاحی ۸D منجر شده است؟`, guide: 'بررسی چارت‌های تابلوی کایزن کارگاه و سوابق پیگیری اهداف محقق نشده.' }
      ];
    }
    if (clauseStr.startsWith('7.1.5')) {
      return [
        { question: `آیا کلیه تجهیزات اندازه‌گیری، سنسورهای کنترلی، کولیس‌ها و فیکسچرهای تست به کار رفته در «${processName}» دارای برچسب کالیبراسیون معتبر، شناسه ردیابی یکتا و تاریخ انقضا هستند؟`, guide: 'بررسی شناسنامه ابزار، تطابق کد حک شده با کارت کالیبراسیون و اعتبار گواهینامه آزمایشگاه مرجع.' },
        { question: `آیا فرآیند صحت‌سنجی ابزارهای تست در ایستگاه‌های کاری (مسترسنجی روزانه) توسط اپراتور شیفت به درستی انجام و مستند می‌گردد؟`, guide: 'مشاهده برگه مستر کالیبره کارگاهی و تست تجربی با بلوک سنگ مرجع.' }
      ];
    }
    if (clauseStr.startsWith('7.2') || clauseStr.startsWith('7.3')) {
      return [
        { question: `آیا اپراتورهای شاغل در ایستگاه‌های کلیدی فرآیند «${processName}» دارای گواهینامه شایستگی فنی تایید شده و آموزش‌های بدو خدمت و حین خدمت مرتبط با الزامات خاص مشتری هستند؟`, guide: 'کنترل ماتریس مهارت (Skills Matrix)، پرونده آموزشی پرسنل منتخب و نمونه‌گیری مصاحبه‌ای در حین کار.' },
        { question: `آیا مکانیزم‌های جایگزینی اپراتورها در صورت غیبت ناگهانی، بدون آسیب به ایمنی و کیفیت فرآیند تولید پیش‌بینی شده است؟`, guide: 'کنترل دستورالعمل مالتی‌اسکیل اپراتورهای کمکی و لیست صلاحیت‌های چندمنظوره خط.' }
      ];
    }
    if (clauseStr.startsWith('7.5')) {
      return [
        { question: `آیا آخرین نسخه بازنگری شده روش‌های اجرایی، نقشه‌های مهندسی و فرم‌های کیفی در دپارتمان «${processName}» در دسترس بوده و نسخه‌های منسوخ شده جمع‌آوری و قرنطینه گردیده‌اند؟`, guide: 'نمونه‌گیری از کدهای مندرج در فرم‌های در حال پر شدن کارگاهی و مطابقت با لیست مستندات معتبر در سیستم تضمین کیفیت.' }
      ];
    }
    if (clauseStr.startsWith('8.1') || clauseStr.startsWith('8.2')) {
      return [
        { question: `آیا الزامات خاص مشتریان (CSR) مربوط به خودروسازان (نظیر ساپکو، مگا موتور، سازه‌گستر) به درستی در طرح کیفیت (Quality Plan) فرآیند «${processName}» گنجانده و پیاده‌سازی شده است؟`, guide: 'بررسی مدارک هماهنگ‌سازی و صحه‌گذاری کیفیت محصول و فیلدهای فرم‌های خروجی.' }
      ];
    }
    if (clauseStr.startsWith('8.3')) {
      return [
        { question: `آیا سوابق تایید نهایی تکوین محصول و فرآیند (نظیر مدارک PPAP، برگه تایید نمونه PSW و تست‌های دوام آزمایشگاهی) برای فرآیند «${processName}» کامل و در دسترس ممیز است؟`, guide: 'واکاوی پوشه تکوین APQP و سوابق بازنگری دروازه‌های تایید فرآیند تولید انبوه.' }
      ];
    }
    if (clauseStr.startsWith('8.4')) {
      return [
        { question: `آیا مواد اولیه، خدمات فرعی یا ملزومات ورودی به فرآیند «${processName}» از سازندگان زنجیره تامین تایید شده (AVL) تهیه شده و عملکرد کیفی آنها به صورت دوره‌ای ارزیابی می‌شود؟`, guide: 'نمونه‌برداری از بهر مواد ورودی خط، سوابق ارزیابی تامین‌کنندگان و گواهی آزمون COA.' }
      ];
    }
    if (clauseStr.startsWith('8.5.1.3')) {
      return [
        { question: `آیا فرآیند تاییدیه تنظیمات کاری (Setup Verification) در ایستگاه‌های کلیدی فرآیند «${processName}» پس از توقف‌های طولانی، تعویض قالب یا سایز، طبق چک‌لیست مربوطه انجام و قطعه اول تایید می‌شود؟`, guide: 'بررسی گزارشات تایید اولین قطعه تولیدی (First-Off) و امضای سرپرست خط و QC.' },
        { question: `آیا ابزارها یا نمونه‌های تست ردیابی خطا (Red Rabbit / قطعات تست) در فرآیند راه‌اندازی برای صحه‌گذاری مکانیزم کشف به کار می‌روند؟`, guide: 'مشاهده نمونه‌های قرمز مرجع با عیوب مصنوعی و تست واقعی عبور آنها از گیت اسکن.' }
      ];
    }
    if (clauseStr.startsWith('8.5.1.5')) {
      return [
        { question: `آیا چک‌لیست پایش روزانه TPM فرآیند «${processName}» شامل بازرسی‌های اپراتوری، سطوح روغن و فرسودگی قطعات مصرفی به درستی انجام شده و شاخص‌های OEE، MTBF و MTTR پایش می‌شوند؟`, guide: 'بررسی فیزیکی تگ‌های زرد و قرمز روی پرس‌ها و ماشین‌آلات، و آرشیو سوابق نگهداری پیشگیرانه.' }
      ];
    }
    if (clauseStr.startsWith('8.5.1')) {
      return [
        { question: `آیا فرآیند تولید «${processName}» دقیقاً منطبق بر آخرین ویرایش مصوب «طرح کنترل» (Control Plan) اجرا شده و دستورالعمل‌های کاری (Work Instructions) در دیدرس اپراتورها قرار دارند؟`, guide: 'تطبیق پارامترهای تنظیمی دستگاه (دما، فشار، سرعت) با مقادیر مندرج در کنترل پلن زنده.' },
        { question: `آیا پارامترهای کنترل محصول (پایش ابعادی، تست‌های غیرمخرب) بر اساس توالی و حجم نمونه تعریف شده در طرح کنترل به درستی در این فرآیند پایش و ثبت می‌گردد؟`, guide: 'کنترل برگه‌های کنترل فرآیندی و مطابقت حجم نمونه با شیفت کاری تولید شده.' }
      ];
    }
    if (clauseStr.startsWith('8.5.2')) {
      return [
        { question: `آیا برای قطعات ایمنی خودرویی در فرآیند «${processName}»، اصول شناسایی و ردیابی کامل بچ مواد اولیه و شماره کوره ذوب در تمام مراحل سالن رعایت می‌شود؟`, guide: 'بررسی ثبت فیزیکی بارکدها و سوابق کوره و تگ‌های انبار.' },
        { question: `آیا هرگونه عدم تطابق بارکد با مستندات فیزیکی به عنوان مغایرت جدی تلقی و فورا قرنطینه اعمال می‌شود؟`, guide: 'مشاهده فیزیکی ایستگاه اسکن بارکد و نحوه واکنش اپراتور.' }
      ];
    }
    if (clauseStr.startsWith('8.5.6.1')) {
      return [
        { question: `آیا در صورت بروز خرابی در تجهیزات خودکار یا فیکسچرهای اصلی فرآیند «${processName}»، دستورالعمل کاری کنترل‌های موقت فرآیند (Temporary Control Plan) فعال شده و سطح نمونه‌برداری افزایش می‌یابد؟`, guide: 'بررسی لیست بک‌آپ‌های مجاز، تایید مشتری برای تولید دستی، و امضای شیفت ارشد ممیزی.' }
      ];
    }
    if (clauseStr.startsWith('8.7') || clauseStr.startsWith('8.5.6')) {
      return [
        { question: `آیا قطعات نامنطبق، معیوب، مشکوک یا ضایعات حاصل از فرآیند «${processName}» فورا در جعبه‌ها/پالت‌های قرمز رنگ با برچسب مشخص قرار گرفته و به زون قرنطینه منتقل می‌شوند؟`, guide: 'بازدید میدانی از وضعیت و درب قفل‌دار زون قرنطینه، رنگ‌آمیزی پالت‌های قرمز و پایش سوابق ردگیری ضایعات.' }
      ];
    }
    if (clauseStr.startsWith('9.1')) {
      return [
        { question: `آیا پایش آماری فرآیند (SPC) بر روی ابعاد بحرانی قطعات فرآیند «${processName}» به کمک نمودارهای کنترل میانگین (X-bar) و دامنه (R) انجام شده و شاخص توانمندی فرآیند (Cpk >= 1.33) احراز می‌گردد؟`, guide: 'بررسی نمودارهای پایش آماری متصل به سیستم هوشمند و تحلیل علت خروج از کنترل نقاط دورافتاده.' }
      ];
    }
    if (clauseStr.startsWith('10.2.4')) {
      return [
        { question: `آیا سیستم‌های خطاناشدنی‌سازی فیزیکی (Poka-Yoke) تعبیه شده در خط «${processName}» در شروع هر شیفت با کیت‌های تایید شده (Red Rabbit) بررسی می‌شوند؟`, guide: 'مشاهده فرم ثبت روزانه اپراتور و سوابق آرشیو بیش از ۱۰ سال.' },
        { question: `آیا در صورت خرابی سنسور پوکایوکه، دستورالعمل مهار جایگزین طبق تایید مشتری فعال می‌گردد؟`, guide: 'بررسی روش اجرایی سناریوهای مهار جایگزین و تایید کیفیت.' }
      ];
    }
    if (clauseStr.startsWith('10.2')) {
      return [
        { question: `آیا پرونده‌های اقدامات اصلاحی (8D) صادر شده برای مغایرت‌های پیشین فرآیند «${processName}» دارای ریشه‌یابی علمی مسئله به روش‌های Ishikawa یا 5Why هستند؟`, guide: 'بررسی پرونده‌های ۸D متصل، واکاوی اثربخشی اقدام مهار اولیه و کارهای پیشگیرانه نهایی.' }
      ];
    }

    // Generic fallback questions
    return [
      { question: `آیا الزامات عمومی استاندارد IATF و بند اختصاصی ${clauseStr} در اجرای فرآیند «${processName}» پایش و مستند می‌گردد؟`, guide: 'بررسی آخرین نسخه دستورالعمل کار، آموزش پرسنل و کارکرد فرم‌های کیفیت.' },
      { question: `آیا شاخص‌های کلیدی عملکرد (KPI) تعریف شده برای «${processName}» در دوره‌های مشخص تحلیل و اقدامات اصلاحی لازم انجام می‌شود؟`, guide: 'مشاهده برد کیفیت دپارتمان و واکاوی داده‌های ماهانه.' }
    ];
  };

  // --- 2. AUDIT EXECUTION (INTERACTIVE CHECKLIST EVALUATION) ---
  const activeProgram = useMemo(() => {
    return programs.find(p => p.id === selectedProgramId) || null;
  }, [programs, selectedProgramId]);

  const activeProcessSched = useMemo(() => {
    if (!activeProgram) return null;
    return activeProgram.processSchedules.find(p => p.processId === selectedProcessId) || null;
  }, [activeProgram, selectedProcessId]);

  const filteredChecklistItems = useMemo(() => {
    if (!selectedProgramId) return [];
    let items = checklists.filter(c => c.programId === selectedProgramId);
    if (selectedProcessId) {
      items = items.filter(c => c.processId === selectedProcessId);
    }
    return items;
  }, [checklists, selectedProgramId, selectedProcessId]);

  const handleUpdateChecklistRow = (id: string, field: 'status' | 'evidence', value: string) => {
    const updated = checklists.map(c => {
      if (c.id === id) {
        return { ...c, [field]: value };
      }
      return c;
    });
    saveChecklists(updated);
  };

  const handleAddCustomQuestion = () => {
    if (!selectedProgramId || !selectedProcessId) {
      alert(isRtl ? 'لطفاً ابتدا برنامه و فرآیند مورد نظر را انتخاب کنید.' : 'Please select program and process first.');
      return;
    }
    const processName = activeProcessSched?.processName || '';
    const newQuestion: ChecklistItem = {
      id: `CHK-CUST-${Date.now()}`,
      programId: selectedProgramId,
      processId: selectedProcessId,
      processName: processName,
      clauseId: activeProcessSched?.clauses.split(',')[0] || '4.4',
      clauseTitle: 'سوالات و الزامات سفارشی تکمیلی کارگاه',
      csrText: 'سوال اختصاصی ممیز براساس گزارش‌های فنی ',
      question: isRtl ? 'سوال ممیزی سفارشی جدید...' : 'New custom audit question...',
      guide: isRtl ? 'راهنمای نمونه‌گیری و مشاهده فیزیکی شواهد ممیزی.' : 'Auditor guidelines.',
      status: 'C',
      evidence: isRtl ? 'شواهد ممیزی با نمونه‌گیری از سوابق ثبت شد.' : 'Audit evidence registered.'
    };
    saveChecklists([newQuestion, ...checklists]);
  };

  const handleDeleteChecklistRow = (id: string) => {
    if (confirm(isRtl ? 'آیا از حذف این ردیف چک‌لیست اطمینان دارید؟' : 'Delete this checklist row?')) {
      saveChecklists(checklists.filter(c => c.id !== id));
    }
  };

  // --- 3. NONCONFORMITIES (WITH DIRECT 8D INTEGRATION) ---
  const handleOpenRegisterNcFromChecklist = (row: ChecklistItem) => {
    setNewNcData({
      checklistRowId: row.id,
      processId: row.processId,
      processName: row.processName,
      clauseId: row.clauseId,
      clauseTitle: row.clauseTitle,
      csrText: row.csrText,
      title: isRtl ? `عدم انطباق در فرآیند ${row.processName} - بند ${row.clauseId}` : `Nonconformity in ${row.processName} - Clause ${row.clauseId}`,
      description: row.question + '\n\n' + (isRtl ? 'شواهد خطا: ' : 'Evidence: '),
      classification: 'Minor',
      evidence: row.evidence
    });
    setIsNcModalOpen(true);
  };

  const handleOpenManualNc = () => {
    if (processes.length === 0) {
      alert(isRtl ? 'هیچ فرآیندی جهت ثبت خطا یافت نشد!' : 'No processes found!');
      return;
    }
    setNewNcData({
      processId: processes[0].id || 'pmx-1',
      processName: processes[0].field1 || '',
      clauseId: '8.5.2.1',
      clauseTitle: 'ردیابی و شناسایی قطعات ایمنی',
      csrText: 'الزامات خاص مرتبط',
      title: '',
      description: '',
      classification: 'Minor',
      evidence: ''
    });
    setIsNcModalOpen(true);
  };

  const handleSaveNc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNcData.title.trim()) {
      alert(isRtl ? '⚠️ خطا: فیلد «عنوان خطای کیفی» خالی است! لطفاً آن را پر کنید.' : '⚠️ Error: "NC Title" is empty! Please fill it.');
      return;
    }
    if (!newNcData.description.trim()) {
      alert(isRtl ? '⚠️ خطا: فیلد «شرح و شواهد عینی خطا» خالی است! لطفاً آن را پر کنید.' : '⚠️ Error: "Description & Objective Evidence" is empty! Please fill it.');
      return;
    }

    const code = `NC-AUD-${Date.now().toString().slice(-4)}`;
    const newNcItem: Nonconformity = {
      id: `NC-AUD-${Date.now()}`,
      programId: selectedProgramId || 'MANUAL',
      processId: newNcData.processId,
      processName: newNcData.processName,
      clauseId: newNcData.clauseId,
      clauseTitle: newNcData.clauseTitle,
      csrText: newNcData.csrText,
      title: newNcData.title,
      description: newNcData.description,
      classification: newNcData.classification,
      evidence: newNcData.evidence,
      registeredAt: getJalaliDate()
    };

    saveNcs([newNcItem, ...ncs]);

    // If registered from checklist row, automatically update status of that row to Major_NC or Minor_NC
    if (newNcData.checklistRowId) {
      handleUpdateChecklistRow(
        newNcData.checklistRowId, 
        'status', 
        newNcData.classification === 'Major' ? 'Major_NC' : 'Minor_NC'
      );
    }

    setIsNcModalOpen(false);
  };

  const handleDeleteNc = (id: string) => {
    if (confirm(isRtl ? 'آیا از حذف این مغایرت اطمینان دارید؟' : 'Delete this NC?')) {
      saveNcs(ncs.filter(n => n.id !== id));
    }
  };

  // Push to Central 8D Corrective Action portal in real-time
  const handlePushTo8DPortal = (nc: Nonconformity) => {
    try {
      const dbNcs = QmsDatabase.selectAll('nc_items_table') || {};
      const nextId = `NC-8D-${Date.now().toString().slice(-4).toUpperCase()}`;

      const newCentralNc = {
        id: nextId,
        clauseId: nc.clauseId,
        clauseNumber: nc.clauseId,
        clauseTitle: nc.clauseTitle,
        description: `[ممیزی داخلی سیستم] ${nc.title}\nشرح خطا: ${nc.description}\nالزامات خاص متناظر: ${nc.csrText}\nشواهد عینی: ${nc.evidence}`,
        declaredAt: getJalaliDate(),
        source: isRtl ? 'ممیزی داخلی سیستم مدیریت کیفیت ' : 'QMS Internal Audit',
        reporter: currentUser?.fullName || currentUser?.username || 'سرممیز ممیزی داخلی',
        targetDate: '۱۴۰۵/۰۹/۳۰',
        status: 'NEW',
        responseType: 'CAPA'
      };

      dbNcs[nextId] = newCentralNc;
      QmsDatabase.writeAll('nc_items_table', dbNcs);
      window.dispatchEvent(new Event('qms_nc_updated'));

      // Save the generated 8D action link locally
      const updated = ncs.map(n => n.id === nc.id ? { ...n, actionCode: nextId, actionStatus: 'NEW' } : n);
      saveNcs(updated);

      alert(isRtl 
        ? `پرونده اقدام اصلاحی ۸D با موفقیت در کارتابل مرکزی ایجاد گردید.\nکد پیگیری: ${nextId}` 
        : `8D Corrective Action case created successfully in the central portal.\nTracking code: ${nextId}`
      );
    } catch (err) {
      console.error('Push to 8D failed:', err);
    }
  };

  // --- 4. OPPORTUNITIES FOR IMPROVEMENT (OFI) ---
  const handleAddManualOfi = () => {
    const fresh: OFIItem = {
      id: `OFI-${Date.now()}`,
      programId: selectedProgramId || 'MANUAL',
      processId: processes[0]?.id || 'proc-1',
      processName: processes[0]?.field1 || 'تولید سگدست',
      clauseId: '10.2.4',
      title: isRtl ? 'بهبود فرآیند با ضدخطاسازی هوشمند' : 'Improvement via smart Poka-Yoke',
      suggestion: isRtl ? 'پیشنهاد می‌شود سیستم‌های Pick-to-Light نوری در مخزن واشرها نصب گردد.' : 'Implement Pick-to-Light optical barriers.',
      registeredAt: getJalaliDate()
    };
    saveOfis([fresh, ...ofis]);
  };

  const handleGenerateSmartOfis = () => {
    if (!selectedProgramId) {
      alert(isRtl ? 'لطفاً ابتدا یک برنامه ممیزی را انتخاب نمایید.' : 'Please select an audit program first.');
      return;
    }

    // Smart heuristic generator that inspects current program's checklist & NCs
    const currentNcs = ncs.filter(n => n.programId === selectedProgramId);
    
    const suggestedOfis: OFIItem[] = [];
    
    if (currentNcs.some(n => n.clauseId.startsWith('8.5.2'))) {
      suggestedOfis.push({
        id: `OFI-SMART-1-${Date.now()}`,
        programId: selectedProgramId,
        processId: 'proc-trace',
        processName: 'سالن ساخت و فورجینگ شفت',
        clauseId: '8.5.2.1',
        title: 'ردیابی هوشمند قطعات با کدهای ماتریس داده (DataMatrix)',
        suggestion: 'با توجه به ثبت عدم انطباق روی بارکدهای خط‌خورده در ممیزی، پیشنهاد می‌گردد چاپگر لیزری مستقیم روی فلز (DPM) جایگزین تگ‌های کاغذی در فرآیند ردیابی ذوب گردد تا نوسانات اسکن حذف شود.',
        registeredAt: getJalaliDate()
      });
    }

    if (currentNcs.some(n => n.clauseId.startsWith('10.2.4'))) {
      suggestedOfis.push({
        id: `OFI-SMART-2-${Date.now()}`,
        programId: selectedProgramId,
        processId: 'proc-poka',
        processName: 'خط مونتاژ و مجموعه سازی ترمز',
        clauseId: '10.2.4',
        title: 'استقرار حسگرهای فتوالکتریک خودکار در فیکسچرهای پرس',
        suggestion: 'با توجه به یافته‌های ممیزی در ایستگاه خاربندی، پیشنهاد می‌شود گیج هوشمند پنوماتیک به سنسور کنترل عمق مجهز شود تا از مونتاژ نیمه‌کاره خار پیش از فعال شدن جک جلوگیری به عمل آید.',
        registeredAt: getJalaliDate()
      });
    }

    // Always provide at least one general great automotive QMS suggestion
    suggestedOfis.push({
      id: `OFI-SMART-GEN-${Date.now()}`,
      programId: selectedProgramId,
      processId: 'proc-gen',
      processName: 'واحد ابزار تیزکنی و آزمایشگاه',
      clauseId: '7.1.5.1',
      title: 'دیجیتالی‌سازی و برچسب‌های QR ابزارهای ممیزی شده',
      suggestion: 'جهت تسریع ممیزی‌های دوره‌ای و ردیابی کالیبراسیون، پیشنهاد می‌شود بر روی هر یک از میکرومترها و کولیس‌های کارگاه، بارکد QR فلزی چسبانده شود تا اپراتور با اسکن آن مستقیما تاریخ اعتبار را مشاهده کند.',
      registeredAt: getJalaliDate()
    });

    saveOfis([...suggestedOfis, ...ofis]);
    alert(isRtl ? 'فرصت‌های بهبود به صورت هوشمند و بر اساس تحلیل یافته‌های ممیزی ایجاد شدند!' : 'Opportunities for improvement dynamically generated!');
  };

  const handleDeleteOfi = (id: string) => {
    if (confirm(isRtl ? 'آیا از حذف این فرصت بهبود (OFI) اطمینان دارید؟' : 'Are you sure you want to delete this opportunity for improvement (OFI)?')) {
      saveOfis(ofis.filter(o => o.id !== id));
    }
  };

  // --- AUDITOR COMPETENCY HANDLERS ---
  const handleOpenAddAuditor = () => {
    setEditingAuditor(null);
    const initialCustomFields: Record<string, boolean> = {};
    customColumns.forEach(c => {
      initialCustomFields[c.id] = false;
    });
    setAuditorForm({
      name: '',
      role: '',
      standardsCertified: false,
      coreToolsCertified: false,
      processApproachCertified: false,
      auditExperienceHours: 0,
      certificateUploaded: false,
      status: 'needs_training',
      notes: '',
      customFields: initialCustomFields
    });
    setIsAuditorModalOpen(true);
  };

  const handleOpenEditAuditor = (aud: AuditorQualification) => {
    setEditingAuditor(aud);
    const mergedCustomFields = { ...(aud.customFields || {}) };
    customColumns.forEach(c => {
      if (mergedCustomFields[c.id] === undefined) {
        mergedCustomFields[c.id] = false;
      }
    });
    setAuditorForm({
      name: aud.name,
      role: aud.role,
      standardsCertified: aud.standardsCertified,
      coreToolsCertified: aud.coreToolsCertified,
      processApproachCertified: aud.processApproachCertified,
      auditExperienceHours: aud.auditExperienceHours,
      certificateUploaded: aud.certificateUploaded,
      status: aud.status,
      notes: aud.notes,
      customFields: mergedCustomFields
    });
    setIsAuditorModalOpen(true);
  };

  const handleSaveAuditor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auditorForm.name.trim() || !auditorForm.role.trim()) {
      alert(isRtl ? 'لطفاً نام ممیز و نقش ممیزی را وارد کنید.' : 'Please enter auditor name and role.');
      return;
    }

    if (editingAuditor) {
      const updated = auditors.map(a => a.id === editingAuditor.id ? { ...a, ...auditorForm } : a);
      saveAuditors(updated);
    } else {
      const newAud: AuditorQualification = {
        id: `aud-${Date.now()}`,
        ...auditorForm
      };
      saveAuditors([...auditors, newAud]);
    }
    setIsAuditorModalOpen(false);
  };

  const handleDeleteAuditor = (id: string) => {
    if (confirm(isRtl ? 'آیا از حذف این ممیز و سوابق احراز صلاحیت وی اطمینان دارید؟' : 'Are you sure you want to delete this auditor?')) {
      const filtered = auditors.filter(a => a.id !== id);
      saveAuditors(filtered);
    }
  };

  // --- 5. AUDIT REPORT ---
  const currentReport = useMemo(() => {
    if (!selectedProgramId) return null;
    return reports.find(r => r.programId === selectedProgramId) || null;
  }, [reports, selectedProgramId]);

  const [reportForm, setReportForm] = useState({
    summary: '',
    strengths: '',
    weaknesses: '',
    managementNotes: ''
  });

  useEffect(() => {
    if (currentReport) {
      setReportForm({
        summary: currentReport.summary,
        strengths: currentReport.strengths,
        weaknesses: currentReport.weaknesses,
        managementNotes: currentReport.managementNotes
      });
    } else if (activeProgram) {
      // Suggest template based on current NC counts
      const progNcs = activeNcs.filter(n => n.programId === selectedProgramId);
      const majorCount = progNcs.filter(n => n.classification === 'Major').length;
      const minorCount = progNcs.filter(n => n.classification === 'Minor').length;

      setReportForm({
        summary: `گزارش جامع ممیزی داخلی سیستم مدیریت کیفیت در دوره ${activeProgram.cycle} در تاریخ ${activeProgram.auditDate} توسط تیم ممیزی به سرپرستی ${activeProgram.leadAuditor} در کلیه فرآیندهای کارگاه پیاده‌سازی گردید. فرآیندهای مورد ممیزی از حیث الزامات مرجع IATF 16949 و همگام‌سازی بندهای الزامات خاص مشتریان ممیزی شدند.`,
        strengths: '۱. تعهد جدی پرسنل کارگاه به پیاده‌سازی دستورالعمل‌های کاری مکتوب.\n۲. نگهداری و بایگانی مناسب سوابق کالیبراسیون و ابزارهای ممیزی در آزمایشگاه.',
        weaknesses: `در جریان ممیزی تعداد ${majorCount} عدم انطباق عمده و ${minorCount} عدم انطباق جزئی شناسایی و در بخش مغایرت‌ها به ثبت رسید که نیازمند صدور اقدامات اصلاحی ۸D فوری می‌باشد.`,
        managementNotes: 'پیشنهاد می‌شود جهت اثربخشی کامل اقدامات مهار خطاهای ردیابی بچ ذوب، سرمایه‌گذاری برای استقرار بارکد خوان‌های ثابت در گلوگاه‌های سالن ساخت تسریع گردد.'
      });
    }
  }, [currentReport, activeProgram, selectedProgramId, ncs]);

  const handleSaveReport = () => {
    if (!selectedProgramId || !activeProgram) return;

    const freshReport: AuditReport = {
      id: currentReport?.id || `REP-${Date.now()}`,
      programId: selectedProgramId,
      programTitle: activeProgram.title,
      summary: reportForm.summary,
      strengths: reportForm.strengths,
      weaknesses: reportForm.weaknesses,
      managementNotes: reportForm.managementNotes,
      generatedAt: getJalaliDate()
    };

    if (currentReport) {
      saveReports(reports.map(r => r.id === currentReport.id ? freshReport : r));
    } else {
      saveReports([freshReport, ...reports]);
    }

    showNotification(isRtl ? 'گزارش نهایی ممیزی با موفقیت ذخیره گردید.' : 'Audit report saved successfully.', 'success');
  };

  // --- 6. FOLLOW-UP (EFFECTIVENESS TRACKING) ---
  const handleUpdateFollowup = (ncId: string, rating: number, notes: string) => {
    const updated = ncs.map(n => {
      if (n.id === ncId) {
        // We will store effectiveness details inside evidence or custom fields
        return {
          ...n,
          evidence: notes, // reuse evidence text box
          classification: n.classification // keep intact
        };
      }
      return n;
    });
    saveNcs(updated);
    alert(isRtl ? 'وضعیت پایش اثربخشی اقدام اصلاحی به‌روزرسانی شد.' : 'Effectiveness follow-up updated.');
  };

  // --- 7. MANAGEMENT DASHBOARD DATA ---
  const dashboardStats = useMemo(() => {
    const totalPrograms = programs.length;
    const totalNcs = ncs.length;
    const majorNcs = ncs.filter(n => n.classification === 'Major').length;
    const minorNcs = ncs.filter(n => n.classification === 'Minor').length;
    const totalOfis = ofis.length;

    // Charts data: NCs by Process
    const processMap: Record<string, number> = {};
    ncs.forEach(n => {
      processMap[n.processName] = (processMap[n.processName] || 0) + 1;
    });
    const ncByProcessData = Object.keys(processMap).map(k => ({
      name: k.length > 20 ? k.substring(0, 20) + '...' : k,
      تعداد: processMap[k]
    }));

    // Status distributions
    const statusMap: Record<string, number> = {};
    activeNcs.forEach(n => {
      const s = n.actionStatus || 'NEW';
      statusMap[s] = (statusMap[s] || 0) + 1;
    });
    const closureData = [
      { name: 'جدید (شروع ۸D)', value: statusMap['NEW'] || 0, color: '#EF4444' },
      { name: 'در جریان اقدام (۸D)', value: (statusMap['8D_IN_PROGRESS'] || 0) + (statusMap['OPEN_CA'] || 0), color: '#F59E0B' },
      { name: 'بسته شده و موفق', value: statusMap['CLOSED_CA'] || 0, color: '#10B981' }
    ].filter(v => v.value > 0);

    return {
      totalPrograms,
      totalNcs,
      majorNcs,
      minorNcs,
      totalOfis,
      ncByProcessData,
      closureData
    };
  }, [programs, ncs, activeNcs]);

  return (
    <div className="bg-[#09090B] border border-zinc-800 rounded-2xl p-6 shadow-2xl overflow-hidden text-right" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* HEADER SECTION */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-zinc-800 pb-5 mb-6 gap-4">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <ShieldAlert size={22} className="text-amber-500 shrink-0" />
            {isRtl ? 'ممیزی داخلی سیستم مدیریت کیفیت ' : 'QMS Internal Audit Dashboard (Clause 9.2.2.2)'}
          </h2>
          <p className="text-xs text-zinc-500 mt-1.5 leading-relaxed max-w-2xl font-sans">
            {isRtl 
              ? 'برنامه‌ریزی ممیزی‌های سالانه، اجرای چک‌لیست‌های انطباق IATF و الزامات خاص مشتریان (CSR) به صورت ستون‌های همگام، ثبت عدم انطباق‌ها و ردیابی اقدامات اصلاحی متصل به کارتابل ۸D.'
              : 'Schedule QMS audits, execute dynamic checklists aligned with IATF & CSR side-by-side, log nonconformities, and follow-up effectiveness on the 8D Corrective Action portal.'}
          </p>
        </div>
        
        <div className="flex items-center gap-2 self-end sm:self-center">
          {onPinToDashboard && (
            <button
              onClick={onPinToDashboard}
              title={isRtl ? 'سنجاق به ابزارها' : 'Pin to Tools'}
              className="p-2 bg-[#1C1C1F] hover:bg-[#252529] border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center shadow-md hover:shadow-rose-500/5 group"
            >
              <span className="text-base text-rose-500 animate-pulse group-hover:scale-110 transition-transform">📌</span>
            </button>
          )}
        </div>
      </header>

      {/* CORE MODULE TABS */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[#1C1C1F] pb-0.5 mb-6 select-none overflow-x-auto">
        {[
          { id: 'program', label: isRtl ? '🗓️ برنامه ممیزی' : '🗓️ Audit Program' },
          { id: 'execution', label: isRtl ? '⚡ اجرای ممیزی' : '⚡ Audit Execution' },
          { id: 'report', label: isRtl ? '📄 گزارش نهایی ممیزی' : '📄 Final Audit Report' },
          { id: 'followup', label: isRtl ? '🔍 پیگیری و اثربخشی' : '🔍 Follow-up & Effectiveness' },
          { id: 'dashboard', label: isRtl ? '📊 داشبورد مدیریتی' : '📊 Management Dashboard' },
          { id: 'auditor_qualification', label: isRtl ? '🎖️ احراز صلاحیت ممیزان' : '🎖️ Auditor Qualifications' },
          { id: 'archive_sync', label: isRtl ? '💾 ثبت و بایگانی پرونده‌ها' : '💾 File Dossier & Archive' }
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`px-3.5 py-2 text-[11.5px] font-black rounded-t-xl transition-all cursor-pointer border-t border-x border-transparent whitespace-nowrap ${
              activeSubTab === tab.id
                ? 'bg-[#0E0E11] border-zinc-800 text-amber-500 border-b-[#0E0E11] -mb-[1px]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT RENDERING */}
      {activeSubTab === 'program' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-zinc-300 flex items-center gap-1.5">
              <Calendar size={16} className="text-amber-500" />
              {isRtl ? 'برنامه‌های ممیزی سالانه کیفیت' : 'Annual Audit Programs'}
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRunAiAudit}
                disabled={isAiAuditLoading}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-black text-xs font-black rounded-xl shadow-lg shadow-amber-600/20 transition-all cursor-pointer flex items-center gap-2 group disabled:opacity-50"
              >
                {isAiAuditLoading ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <Sparkles size={15} className="group-hover:scale-125 transition-transform" />
                )}
                {isRtl ? 'ممیزی هوشمند کل پروژه (AI)' : 'AI Smart Audit Project'}
              </button>

              <button
                onClick={handleOpenAddProgram}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-black rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-1"
              >
                <Plus size={15} />
                {isRtl ? 'ایجاد برنامه ممیزی جدید' : 'Create New Program'}
              </button>
            </div>
          </div>


          {programs.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl bg-[#09090B]/30">
              <Calendar size={36} className="text-zinc-600 mx-auto mb-3" />
              <p className="text-xs text-zinc-500 font-sans">
                {isRtl ? 'هیچ برنامه ممیزی تاکنون تعریف نشده است. جهت اجرای فرآیند، برنامه ممیزی جدیدی ایجاد کنید.' : 'No audit programs created yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {programs.map((prog) => (
                <div key={prog.id} className="border border-zinc-800 bg-[#0E0E11] rounded-2xl p-5 hover:border-zinc-700 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-[10px] font-mono">
                        {prog.cycle}
                      </span>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${
                        prog.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        prog.status === 'in_progress' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}>
                        {prog.status === 'completed' ? 'کامل شده' :
                         prog.status === 'in_progress' ? 'در حال اجرا' :
                         prog.status === 'scheduled' ? 'زمان‌بندی شده' : 'پیش‌نویس'}
                      </span>
                    </div>

                    <h4 className="text-xs font-black text-white mb-2 leading-relaxed">{prog.title}</h4>
                    <p className="text-[11px] text-zinc-500 mb-3 leading-relaxed font-sans">{prog.scope}</p>

                    <div className="space-y-1.5 border-t border-zinc-900 pt-3 text-[11px] text-zinc-400 font-sans">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-zinc-600" />
                        <span>{isRtl ? `تاریخ ممیزی: ${prog.auditDate}` : `Audit Date: ${prog.auditDate}`}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <UserCheck size={12} className="text-zinc-600" />
                        <span>{isRtl ? `سرممیز: ${prog.leadAuditor}` : `Lead: ${prog.leadAuditor}`}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Layers size={12} className="text-zinc-600" />
                        <span>{isRtl ? `${prog.processSchedules.length} فرآیند برنامه‌ریزی شده` : `${prog.processSchedules.length} Processes`}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-zinc-900">
                    <button
                      onClick={() => {
                        setSelectedProgramId(prog.id);
                        if (prog.processSchedules.length > 0) {
                          setSelectedProcessId(prog.processSchedules[0].processId);
                        }
                        setActiveSubTab('execution');
                      }}
                      className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-lg text-[10px] font-black cursor-pointer"
                    >
                      ⚡ {isRtl ? 'شروع و ارزیابی' : 'Start Audit'}
                    </button>
                    <button
                      onClick={() => handleOpenEditProgram(prog)}
                      className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded transition-colors cursor-pointer"
                      title={isRtl ? 'ویرایش برنامه' : 'Edit'}
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteProgram(prog.id)}
                      className="p-1.5 hover:bg-zinc-800 text-rose-500 hover:bg-rose-500/10 rounded transition-colors cursor-pointer"
                      title={isRtl ? 'حذف برنامه' : 'Delete'}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 2. AUDIT EXECUTION CHECKLIST */}
      {activeSubTab === 'execution' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-zinc-800 bg-[#0E0E11] p-4 rounded-2xl select-none font-sans">
            <div>
              <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'انتخاب دوره ممیزی' : 'Audit Program'}</label>
              <select
                value={selectedProgramId}
                onChange={(e) => {
                  setSelectedProgramId(e.target.value);
                  const prog = programs.find(p => p.id === e.target.value);
                  if (prog && prog.processSchedules.length > 0) {
                    setSelectedProcessId(prog.processSchedules[0].processId);
                  } else {
                    setSelectedProcessId('');
                  }
                }}
                className="w-full bg-[#161618] border border-zinc-800 text-zinc-300 hover:text-white text-xs rounded-xl p-2 focus:outline-none"
              >
                <option value="">{isRtl ? '-- برنامه ممیزی را انتخاب کنید --' : '-- Select Audit Program --'}</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.title} ({p.cycle})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'فرآیند مورد ممیزی' : 'Process Under Audit'}</label>
              <select
                value={selectedProcessId}
                onChange={(e) => setSelectedProcessId(e.target.value)}
                disabled={!selectedProgramId}
                className="w-full bg-[#161618] border border-zinc-800 text-zinc-300 hover:text-white text-xs rounded-xl p-2 focus:outline-none disabled:opacity-50"
              >
                <option value="">{isRtl ? '-- فرآیند را انتخاب کنید --' : '-- Select Process --'}</option>
                {activeProgram?.processSchedules.map(ps => (
                  <option key={ps.processId} value={ps.processId}>{ps.processName} ({ps.timeframe})</option>
                ))}
              </select>
            </div>

            <div className="flex items-end justify-start md:justify-end gap-2">
              <button
                onClick={handleAddCustomQuestion}
                className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-black rounded-xl cursor-pointer"
              >
                ➕ {isRtl ? 'افزودن سوال اختصاصی' : 'Add Custom Question'}
              </button>
            </div>
          </div>

          {!selectedProgramId ? (
            <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl">
              <Activity size={32} className="text-zinc-600 mx-auto mb-3" />
              <p className="text-xs text-zinc-500 font-sans">
                {isRtl ? 'جهت شروع ارزیابی انطباق، لطفا ابتدا یکی از دوره‌های ممیزی بالا را انتخاب نمایید.' : 'Please select an audit program above.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                <div>
                  <h4 className="text-xs font-black text-white">{activeProcessSched?.processName}</h4>
                  <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                    {isRtl 
                      ? `بازه زمانی مصوب: ${activeProcessSched?.timeframe} | دامنه بندها: ${activeProcessSched?.clauses}` 
                      : `Scheduled: ${activeProcessSched?.timeframe} | Clauses: ${activeProcessSched?.clauses}`}
                  </p>
                </div>
                <span className="text-[10px] px-3 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/10 rounded-xl font-mono">
                  {filteredChecklistItems.length} {isRtl ? 'سوال ممیزی تکوین شده' : 'Questions'}
                </span>
              </div>

              {filteredChecklistItems.length === 0 ? (
                <div className="text-center py-10 text-zinc-500 text-xs font-sans">
                  {isRtl ? 'سوال ممیزی برای این فرآیند ثبت نشده است.' : 'No questions recorded.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredChecklistItems.map((item) => (
                    <div key={item.id} className="border border-zinc-800 bg-[#0A0A0C] rounded-2xl p-5 space-y-4 hover:border-zinc-700 transition-all">
                      {/* Side-by-side IATF vs CSR Requirements section */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 border-b border-zinc-900 pb-4">
                        {/* IATF Clause details */}
                        <div className="bg-[#101014] border border-zinc-900 p-3.5 rounded-xl flex flex-col justify-between">
                          <div>
                            <span className="text-[9px] font-bold text-amber-400 tracking-wider block mb-1">استاندارد IATF 16949</span>
                            <span className="text-xs font-bold text-white block">بند {item.clauseId}</span>
                            <span className="text-[10px] text-zinc-400 leading-relaxed mt-1 block font-sans">{item.clauseTitle}</span>
                          </div>
                        </div>

                        {/* Customer Aligned Requirement (CSR) details */}
                        <div className="bg-[#1C1212]/30 border border-rose-950/20 p-3.5 rounded-xl flex flex-col justify-between">
                          <div>
                            <span className="text-[9px] font-bold text-rose-400 tracking-wider block mb-1">همگام‌سازی الزامات خاص مشتریان (CSR)</span>
                            <p className="text-[10px] text-zinc-300 leading-relaxed font-sans whitespace-pre-line">
                              {item.csrText}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Main evaluation section */}
                      <div className="space-y-3">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                          <p className="text-xs font-bold text-white flex-1 leading-relaxed">{item.question}</p>
                          
                          <div className="flex flex-wrap items-center gap-1.5 self-end md:self-center select-none font-sans">
                            {[
                              { code: 'C', label: 'منطبق (C)', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
                              { code: 'Major_NC', label: 'عدم انطباق عمده', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
                              { code: 'Minor_NC', label: 'عدم انطباق جزئی', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
                              { code: 'OFI', label: 'فرصت بهبود (OFI)', color: 'bg-sky-500/15 text-sky-400 border-sky-500/30' }
                            ].map(opt => (
                              <button
                                key={opt.code}
                                onClick={() => handleUpdateChecklistRow(item.id, 'status', opt.code as any)}
                                className={`px-2.5 py-1 border rounded-lg text-[9.5px] font-black transition-all cursor-pointer ${
                                  item.status === opt.code
                                    ? opt.color + ' ring-1 ring-amber-500/50 scale-[1.03]'
                                    : 'bg-[#141416] border-zinc-800 text-zinc-500 hover:text-white'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="text-[10px] text-zinc-500 font-sans bg-[#111] p-2.5 rounded-lg border border-zinc-900 leading-relaxed">
                          💡 <span className="font-bold text-zinc-400">راهنمای ممیز:</span> {item.guide}
                        </div>

                        {/* Evidence, observations and action tools */}
                        <div className="flex flex-col md:flex-row items-center gap-3 pt-2">
                          <div className="flex-1 w-full relative">
                            <input
                              type="text"
                              value={item.evidence}
                              onChange={(e) => handleUpdateChecklistRow(item.id, 'evidence', e.target.value)}
                              placeholder={isRtl ? 'شواهد عینی، مصاحبه‌ها، گزارشات و کدهای ابزار اندازه‌گیری چک شده...' : 'Evidence description...'}
                              className="w-full bg-[#121215] border border-zinc-800 text-zinc-300 placeholder-zinc-600 rounded-xl p-2 text-xs focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                            {(item.status === 'Major_NC' || item.status === 'Minor_NC') && (
                              <button
                                onClick={() => handleOpenRegisterNcFromChecklist(item)}
                                className="px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-lg shadow-rose-600/10"
                              >
                                <AlertTriangle size={12} />
                                {isRtl ? 'ثبت در لیست مغایرت‌ها' : 'Log NC Record'}
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteChecklistRow(item.id)}
                              className="p-2 hover:bg-rose-500/15 text-zinc-500 hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                              title={isRtl ? 'حذف سوال' : 'Delete'}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. AUDIT REPORT TEMPLATE */}
      {activeSubTab === 'report' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <div>
              <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                <FileText size={15} className="text-zinc-400" />
                {isRtl ? 'گزارش نهایی و مکتوب ممیزی داخلی سیستم مدیریت کیفیت' : 'Final QMS Internal Audit Report'}
              </h3>
              <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                {isRtl ? 'تنظیم گزارش رسمی، آمارها، عدم انطباق‌ها و نقاط قوت  جهت ارسال به بازنگری مدیریت.' : 'Audit summary reports.'}
              </p>
            </div>

            <div className="flex items-center gap-2 select-none">
              <select
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="bg-[#141416] border border-zinc-800 text-zinc-300 text-xs rounded-xl p-2 focus:outline-none"
              >
                <option value="">{isRtl ? '-- انتخاب برنامه ممیزی --' : '-- Select Audit Program --'}</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          </div>

          {!selectedProgramId ? (
            <div className="text-center py-20 border border-dashed border-zinc-800 rounded-2xl">
              <FileText size={32} className="text-zinc-600 mx-auto mb-3" />
              <p className="text-xs text-zinc-500 font-sans">
                {isRtl ? 'جهت تنظیم گزارش، لطفاً ابتدا یکی از برنامه‌های ممیزی بالا را انتخاب کنید.' : 'Please select an audit program.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
              {/* Report Editor Form */}
              <div className="lg:col-span-8 space-y-4">
                <div className="border border-zinc-800 bg-[#0E0E11] p-5 rounded-2xl space-y-4">
                  <div>
                    <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'خلاصه مدیریتی ممیزی' : 'Executive Summary'}</label>
                    <textarea
                      value={reportForm.summary}
                      onChange={(e) => setReportForm({ ...reportForm, summary: e.target.value })}
                      className="w-full bg-[#121215] border border-zinc-800 text-zinc-300 rounded-xl p-3 text-xs leading-relaxed focus:outline-none"
                      rows={4}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] text-emerald-500 mb-1.5 font-bold uppercase">{isRtl ? 'نقاط قوت احراز شده ' : 'Strengths'}</label>
                      <textarea
                        value={reportForm.strengths}
                        onChange={(e) => setReportForm({ ...reportForm, strengths: e.target.value })}
                        className="w-full bg-[#121215] border border-zinc-800 text-zinc-300 rounded-xl p-3 text-xs leading-relaxed focus:outline-none"
                        rows={4}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-rose-500 mb-1.5 font-bold uppercase">{isRtl ? 'نقاط ضعف و نواقص فرآیندی' : 'Weaknesses'}</label>
                      <textarea
                        value={reportForm.weaknesses}
                        onChange={(e) => setReportForm({ ...reportForm, weaknesses: e.target.value })}
                        className="w-full bg-[#121215] border border-zinc-800 text-zinc-300 rounded-xl p-3 text-xs leading-relaxed focus:outline-none"
                        rows={4}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'توصیه‌ها و اقدامات تکمیلی برای مدیریت ارشد' : 'Management Recommendation Notes'}</label>
                    <textarea
                      value={reportForm.managementNotes}
                      onChange={(e) => setReportForm({ ...reportForm, managementNotes: e.target.value })}
                      className="w-full bg-[#121215] border border-zinc-800 text-zinc-300 rounded-xl p-3 text-xs leading-relaxed focus:outline-none"
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      onClick={handleSaveReport}
                      className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-black text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-lg shadow-amber-600/10"
                    >
                      <Save size={14} />
                      {isRtl ? 'ثبت و تولید گزارش نهایی' : 'Save and Generate Report'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic summary panel including linked nonconformities */}
              <div className="lg:col-span-4 space-y-4">
                <div className="border border-zinc-800 bg-[#0E0E11] p-5 rounded-2xl space-y-4">
                  <h4 className="text-xs font-black text-zinc-300 pb-2 border-b border-zinc-900">
                    📊 {isRtl ? 'خلاصه یافته‌های ممیزی جاری' : 'Findings Summary'}
                  </h4>

                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="bg-[#121215] p-3 rounded-xl border border-zinc-900">
                      <span className="text-lg font-mono text-rose-500 font-bold block">
                        {ncs.filter(n => n.programId === selectedProgramId && n.classification === 'Major').length}
                      </span>
                      <span className="text-[10px] text-zinc-500 block mt-1">{isRtl ? 'خطای عمده' : 'Major NCs'}</span>
                    </div>
                    <div className="bg-[#121215] p-3 rounded-xl border border-zinc-900">
                      <span className="text-lg font-mono text-amber-500 font-bold block">
                        {ncs.filter(n => n.programId === selectedProgramId && n.classification === 'Minor').length}
                      </span>
                      <span className="text-[10px] text-zinc-500 block mt-1">{isRtl ? 'خطای جزئی' : 'Minor NCs'}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-[11px] font-bold text-zinc-400 block mb-2">{isRtl ? 'عدم انطباق‌های متناظر در این برنامه:' : 'Associated NCs:'}</h5>
                    {ncs.filter(n => n.programId === selectedProgramId).length === 0 ? (
                      <span className="text-[10px] text-zinc-600 block">{isRtl ? 'عدم انطباقی ثبت نشده است.' : 'No NCs.'}</span>
                    ) : (
                      ncs.filter(n => n.programId === selectedProgramId).map(nc => (
                        <div key={nc.id} className="bg-[#121215] border border-zinc-900 p-2.5 rounded-lg text-[10px] space-y-1">
                          <div className="flex items-center justify-between font-bold text-zinc-300">
                            <span>{nc.title}</span>
                            <span className={nc.classification === 'Major' ? 'text-rose-400' : 'text-amber-400'}>
                              {nc.classification === 'Major' ? 'عمده' : 'جزئی'}
                            </span>
                          </div>
                          <span className="text-zinc-500 block text-[9.5px]">فرآیند: {nc.processName} | بند: {nc.clauseId}</span>
                          {nc.actionCode && (
                            <span className="text-[9px] text-emerald-400 block font-mono font-bold mt-1 bg-emerald-500/5 px-1.5 py-0.5 rounded border border-emerald-500/10 w-fit">
                              🔗 کد ۸D: {nc.actionCode}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic findings and OFIs sections embedded inside the Report tab */}
              <div className="lg:col-span-12 border-t border-zinc-800/85 pt-8 mt-4 space-y-8 select-none">
                
                {/* Embedded NC Section */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-3">
                    <div>
                      <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                        <ShieldAlert size={15} className="text-rose-500 animate-pulse" />
                        {isRtl ? '۱. مغایرت‌ها و عدم انطباق‌های ثبت شده در این ممیزی' : '1. Registered Audit Nonconformities'}
                      </h4>
                      <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                        {isRtl ? 'مغایرت‌های استخراج شده ممیزی کیفیت با قابلیت اتصال مستقیم به کارتابل ۸D اقدامات اصلاحی.' : 'Identified audit variances linked to 8D.'}
                      </p>
                    </div>
                    <button
                      onClick={handleOpenManualNc}
                      className="px-3.5 py-2 bg-[#1C1212] hover:bg-rose-950/20 text-rose-400 border border-rose-950/20 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-center"
                    >
                      <Plus size={15} />
                      {isRtl ? 'ثبت مغایرت دستی جدید' : 'Create NC Manually'}
                    </button>
                  </div>

                  {activeNcs.filter(n => n.programId === selectedProgramId).length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl bg-[#09090B]/30">
                      <CheckCircle2 size={28} className="text-emerald-500/40 mx-auto mb-2 animate-pulse" />
                      <p className="text-[11px] text-zinc-400 font-sans">
                        {isRtl ? 'هیچ عدم انطباقی ثبت نشده است! وضعیت انطباق این ممیزی کامل است.' : 'No nonconformities found.'}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-zinc-800 font-sans">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-[#0E0E11] text-zinc-400 text-[10px] uppercase font-bold border-b border-zinc-800">
                          <tr>
                            <th className="p-3">{isRtl ? 'کد مغایرت' : 'Code'}</th>
                            <th className="p-3">{isRtl ? 'شرح خطای کیفی' : 'Description'}</th>
                            <th className="p-3">{isRtl ? 'فرآیند مربوطه' : 'Process'}</th>
                            <th className="p-3">{isRtl ? 'بند IATF / الزامات مشتری (CSR)' : 'Clause / CSR'}</th>
                            <th className="p-3 text-center">{isRtl ? 'طبقه‌بندی' : 'Class'}</th>
                            <th className="p-3 text-center">{isRtl ? 'پیوند ۸D کارتابل' : '8D Link'}</th>
                            <th className="p-3 text-center">{isRtl ? 'اقدام' : 'Action'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-900 bg-[#070709] text-zinc-300">
                          {activeNcs.filter(n => n.programId === selectedProgramId).map((nc) => (
                            <tr key={nc.id} className="hover:bg-[#121215]/50 transition-colors">
                              <td className="p-3 font-mono text-amber-500 font-bold whitespace-nowrap">{nc.id.split('-').pop()}</td>
                              <td className="p-3 max-w-xs leading-relaxed">
                                <span className="font-black text-white block text-[11px] mb-1">{nc.title}</span>
                                <span className="text-[10px] text-zinc-500 block line-clamp-2">{nc.description}</span>
                              </td>
                              <td className="p-3 font-bold whitespace-nowrap text-[#FAFAFA]">{nc.processName}</td>
                              <td className="p-3">
                                <span className="bg-[#121215] px-2 py-0.5 rounded border border-zinc-800 text-zinc-400 text-[10px] font-mono">
                                  IATF {nc.clauseId}
                                </span>
                                <span className="text-[10px] text-zinc-500 block mt-1 leading-relaxed max-w-xs line-clamp-1">{nc.csrText}</span>
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black ${
                                  nc.classification === 'Major' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                  {nc.classification === 'Major' ? 'عمده Major' : 'جزئی Minor'}
                                </span>
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                {nc.actionCode ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="text-[10px] font-mono text-zinc-400 font-bold bg-[#141416] px-2 py-0.5 rounded border border-white/5">
                                      {nc.actionCode}
                                    </span>
                                    <span className={`text-[9px] font-black ${
                                      nc.actionStatus === 'CLOSED_CA' ? 'text-emerald-500' :
                                      nc.actionStatus === '8D_IN_PROGRESS' || nc.actionStatus === 'OPEN_CA' ? 'text-amber-500' : 'text-rose-500'
                                    }`}>
                                      {nc.actionStatus === 'CLOSED_CA' ? '✓ بسته شده' :
                                       nc.actionStatus === '8D_IN_PROGRESS' ? '⚙️ در حال حل ریشه‌ای' : '🚨 خام / بررسی نشده'}
                                    </span>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => handlePushTo8DPortal(nc)}
                                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-0.5 mx-auto"
                                  >
                                    <ExternalLink size={11} />
                                    {isRtl ? 'ارجاع به ۸D' : 'Push to 8D'}
                                  </button>
                                )}
                              </td>
                              <td className="p-3 text-center whitespace-nowrap">
                                <button
                                  onClick={() => handleDeleteNc(nc.id)}
                                  className="p-1 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Embedded OFI Section */}
                <div className="space-y-4 pt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-800 gap-3">
                    <div>
                      <h4 className="text-sm font-black text-white flex items-center gap-1.5">
                        <Sparkles size={15} className="text-sky-400" />
                        {isRtl ? '۲. فرصت‌های بهبود و پیشنهادهای توسعه کیفیت (OFI)' : '2. Opportunities for Improvement (OFI)'}
                      </h4>
                      <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                        {isRtl ? 'کایزن‌های بهبودی برای ارتقای فرآیندها به سمت استانداردهای هوشمند نسل جدید خودرویی.' : 'Kaizen improvement opportunities.'}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <button
                        onClick={handleGenerateSmartOfis}
                        disabled={!selectedProgramId}
                        className="px-3.5 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black text-xs font-black rounded-xl shadow-lg shadow-amber-600/15 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Sparkles size={14} className="animate-spin text-black shrink-0" />
                        {isRtl ? '✨ تولید هوشمند فرصت‌های بهبود' : 'Generate Smart OFIs'}
                      </button>
                      <button
                        onClick={handleAddManualOfi}
                        className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-black rounded-xl transition-all cursor-pointer"
                      >
                        ➕ {isRtl ? 'افزودن OFI دستی' : 'Add OFI Manually'}
                      </button>
                    </div>
                  </div>

                  {ofis.filter(o => o.programId === selectedProgramId).length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-zinc-800 rounded-2xl bg-[#09090B]/30">
                      <Sparkles size={28} className="text-zinc-600 mx-auto mb-2" />
                      <p className="text-[11px] text-zinc-500 font-sans">
                        {isRtl ? 'پیشنهاد بهبودی ثبت نشده است. از دکمه بالا برای تحلیل هوشمند و پیشنهاد کایزن‌های پیشرفته کیفیت خودرو استفاده کنید.' : 'No improvement opportunities registered.'}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ofis.filter(o => o.programId === selectedProgramId).map((ofi) => (
                        <div key={ofi.id} className="border border-zinc-800 bg-[#0E0E11] p-5 rounded-2xl space-y-3 relative overflow-hidden flex flex-col justify-between">
                          <div className="absolute top-0 right-0 w-1 bg-sky-500 h-full"></div>
                          
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[9px] text-zinc-500 font-mono">{ofi.registeredAt}</span>
                              <span className="bg-sky-500/10 text-sky-400 border border-sky-500/10 rounded px-2 py-0.5 text-[9px] font-bold">
                                IATF {ofi.clauseId}
                              </span>
                            </div>

                            <h5 className="text-xs font-black text-white leading-relaxed">{ofi.title}</h5>
                            <span className="text-[10px] text-amber-500 font-bold block mt-1 font-sans">{ofi.processName}</span>
                            <p className="text-[11px] text-zinc-400 leading-relaxed font-sans mt-2 whitespace-pre-line">{ofi.suggestion}</p>
                          </div>

                          <div className="flex items-center justify-end mt-4 pt-3 border-t border-zinc-900">
                            <button
                              onClick={() => handleDeleteOfi(ofi.id)}
                              className="p-1 text-zinc-500 hover:text-rose-500 rounded cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Process Effectiveness Assessment (PEAR) */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
                    <h4 className="text-xs font-black text-white flex items-center gap-1.5 font-sans">
                      <Star size={14} className="text-amber-500" />
                      {isRtl ? '۲. ارزیابی اثربخشی فرآیندهای ممیزی شده (PEAR)' : 'Process Effectiveness Assessment (PEAR)'}
                    </h4>
                    <span className="text-[9.5px] text-zinc-500 font-sans print:hidden">{isRtl ? 'کلیک روی ستاره‌ها برای تعیین سطح PEAR' : 'Click stars to assign PEAR scores'}</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800 text-zinc-500 font-bold">
                          <th className="pb-2">{isRtl ? 'فرآیند سازمان' : 'QMS Process'}</th>
                          <th className="pb-2">{isRtl ? 'برنامه زمانی' : 'Timeframe'}</th>
                          <th className="pb-2">{isRtl ? 'بندهای استاندارد مربوطه' : 'Clauses Scope'}</th>
                          <th className="pb-2 text-center">{isRtl ? 'ریسک فرآیند' : 'Process Risk'}</th>
                          <th className="pb-2 text-center">{isRtl ? 'یافته‌ها' : 'Findings'}</th>
                          <th className="pb-2 text-left">{isRtl ? 'سطح اثربخشی فرآیند (PEAR)' : 'Process Effectiveness Level'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900 text-[10.5px] text-zinc-300">
                        {programs[0] && programs[0].processSchedules.map((sched) => {
                          const processNcs = ncs.filter(n => n.programId === programs[0].id && n.processId === sched.processId);
                          const processOfis = ofis.filter(o => o.programId === programs[0].id && o.processId === sched.processId);
                          const currentScore = pearScores[sched.processId] || 3; // default to 3 (Effective with minor issues)

                          return (
                            <tr key={sched.processId} className="hover:bg-zinc-900/30">
                              <td className="py-2.5 font-bold text-white print:text-black">{sched.processName}</td>
                              <td className="py-2.5 font-mono">{sched.timeframe}</td>
                              <td className="py-2.5 font-mono text-zinc-400">{sched.clauses}</td>
                              <td className="py-2.5 text-center">
                                <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-500/5 text-amber-500 border border-amber-500/10">
                                  {isRtl ? 'متوسط (Medium)' : 'Medium'}
                                </span>
                              </td>
                              <td className="py-2.5 text-center font-mono">
                                <span className={processNcs.length > 0 ? 'text-rose-400' : 'text-zinc-500'}>{processNcs.length} NC</span>
                                <span className="text-zinc-500 px-1">|</span>
                                <span className={processOfis.length > 0 ? 'text-sky-400' : 'text-zinc-500'}>{processOfis.length} OFI</span>
                              </td>
                              <td className="py-2.5 text-left">
                                <div className="inline-flex items-center gap-1">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <button
                                      key={star}
                                      type="button"
                                      onClick={() => savePearScore(sched.processId, star)}
                                      className="hover:scale-120 transition-all cursor-pointer print:pointer-events-none"
                                    >
                                      <Star 
                                        size={12} 
                                        fill={star <= currentScore ? '#F59E0B' : 'none'} 
                                        className={star <= currentScore ? 'text-amber-500' : 'text-zinc-800 print:text-zinc-300'} 
                                      />
                                    </button>
                                  ))}
                                  <span className="font-mono text-[10px] text-amber-500 font-bold ml-1.5 bg-amber-500/5 px-1 rounded">
                                    PEAR {currentScore}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 3. Nonconformities Ledger details */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-rose-500 border-b border-zinc-900 pb-1.5 uppercase tracking-wider">
                    {isRtl ? '۳. عدم انطباق‌های ممیزی به تفکیک یافته‌های عینی' : '3. Audit Nonconformities Logs & Evidence'}
                  </h4>

                  {ncs.length === 0 ? (
                    <div className="text-[10.5px] text-zinc-500 font-sans">
                      {isRtl ? 'هیچ مغایرت و عدم انطباقی در جریان ممیزی ثبت نگردیده است.' : 'No QMS nonconformities registered for this audit.'}
                    </div>
                  ) : (
                    <div className="space-y-3 font-sans">
                      {ncs.map((nc, idx) => (
                        <div key={nc.id} className="border border-zinc-800 bg-[#0E0E11]/30 p-4 rounded-xl space-y-2">
                          <div className="flex items-center justify-between border-b border-zinc-900/60 pb-2">
                            <span className="font-bold text-white text-[11px] print:text-black">
                              {idx + 1}. {nc.title} ({nc.classification === 'Major' ? (isRtl ? 'عمده Major' : 'Major') : (isRtl ? 'جزئی Minor' : 'Minor')})
                            </span>
                            <span className="text-[9.5px] text-zinc-500 font-mono">فرآیند: {nc.processName} | بند: {nc.clauseId}</span>
                          </div>
                          <p className="text-[10.5px] text-zinc-400 print:text-black leading-relaxed">{nc.description}</p>
                          {nc.actionCode && (
                            <div className="flex justify-between items-center text-[9px] border-t border-zinc-900/40 pt-2 text-zinc-500">
                              <span>🔗 {isRtl ? 'کد اقدام اصلاحی ۸D:' : 'Corrective Action Code:'} <b className="font-mono text-emerald-400">{nc.actionCode}</b></span>
                              <span>{isRtl ? 'وضعیت پیگیری:' : '8D Status:'} <b className="text-amber-500">{nc.actionStatus || 'IN_PROGRESS'}</b></span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. Opportunities for Improvement */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-sky-500 border-b border-zinc-900 pb-1.5 uppercase tracking-wider">
                    {isRtl ? '۴. فرصت‌های بهبود شناسایی شده (OFI)' : '4. Opportunities for Improvement (OFI)'}
                  </h4>

                  {ofis.length === 0 ? (
                    <div className="text-[10.5px] text-zinc-500 font-sans">
                      {isRtl ? 'هیچ فرصت بهبودی در فرآیندها پیشنهاد نگردیده است.' : 'No improvement suggestions compiled.'}
                    </div>
                  ) : (
                    <div className="space-y-2 font-sans text-[10.5px] text-zinc-300">
                      {ofis.map((o, idx) => (
                        <div key={o.id} className="border border-zinc-900 bg-[#0E0E11]/10 p-3 rounded-lg flex justify-between items-start">
                          <div>
                            <span className="font-bold text-white print:text-black block">{idx + 1}. {o.title}</span>
                            <span className="text-zinc-400 mt-1 block">{o.suggestion}</span>
                          </div>
                          <span className="text-[9px] text-zinc-500 font-mono shrink-0">فرآیند: {o.processName} | بند: {o.clauseId}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Final Report Summary */}
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-amber-500 border-b border-zinc-900 pb-1.5 uppercase tracking-wider">
                    {isRtl ? '۵. خلاصه گزارش نهایی ممیزی سیستم' : '5. Audit Executive Report Summary'}
                  </h4>

                  {reports.length === 0 ? (
                    <div className="text-[10.5px] text-zinc-500 font-sans">
                      {isRtl ? 'گزارش نهایی صادر نشده است. ابتدا به تب "گزارش نهایی ممیزی" مراجعه کنید و متن گزارش را ثبت کنید.' : 'No final executive report summary has been compiled yet.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans text-[10.5px]">
                      <div className="bg-[#0E0E11]/30 p-4 border border-zinc-900 rounded-xl space-y-2">
                        <span className="font-bold text-white print:text-black block border-b border-zinc-900/60 pb-1">{isRtl ? 'خلاصه ممیزی و دستاوردهای فرآیندی:' : 'Audit Summary:'}</span>
                        <p className="text-zinc-400 print:text-black leading-relaxed whitespace-pre-line">{reports[0].summary}</p>
                        
                        <span className="font-bold text-white print:text-black block border-b border-zinc-900/60 pb-1 pt-2">{isRtl ? 'نقاط قوت سازمان:' : 'Strengths:'}</span>
                        <p className="text-emerald-400 leading-relaxed whitespace-pre-line">{reports[0].strengths}</p>
                      </div>

                      <div className="bg-[#0E0E11]/30 p-4 border border-zinc-900 rounded-xl space-y-2">
                        <span className="font-bold text-white print:text-black block border-b border-zinc-900/60 pb-1">{isRtl ? 'نقاط ضعف و ریسک‌های بحرانی:' : 'Weaknesses:'}</span>
                        <p className="text-rose-400 leading-relaxed whitespace-pre-line">{reports[0].weaknesses}</p>

                        <span className="font-bold text-white print:text-black block border-b border-zinc-900/60 pb-1 pt-2">{isRtl ? 'توصیه‌های بهبود مدیریت ارشد:' : 'Management Recommendations:'}</span>
                        <p className="text-zinc-400 print:text-black leading-relaxed whitespace-pre-line">{reports[0].managementNotes}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. Legal / Approval Signature Lines */}
                <div className="grid grid-cols-3 gap-4 pt-12 border-t border-zinc-900 text-center font-sans select-none text-[10.5px]">
                  <div className="space-y-8">
                    <span className="text-zinc-500 block font-bold">{isRtl ? 'تهیه کننده (تیم سرممیزی)' : 'Prepared By (Auditor Team)'}</span>
                    <span className="font-bold text-white print:text-black block">{programs[0] && programs[0].leadAuditor}</span>
                  </div>

                  <div className="space-y-8 border-x border-zinc-900">
                    <span className="text-zinc-500 block font-bold">{isRtl ? 'تایید کننده (مدیر تضمین کیفیت)' : 'Approved By (QA Manager)'}</span>
                    <span className="font-bold text-white print:text-black block">{isRtl ? 'نماینده مدیریت در کیفیت' : 'QA Representative'}</span>
                  </div>

                  <div className="space-y-8">
                    <span className="text-zinc-500 block font-bold">{isRtl ? 'تصویب کننده (مدیریت ارشد سازمان)' : 'Authorized By (General Manager)'}</span>
                    <span className="font-bold text-white print:text-black block">{isRtl ? 'مدیریت ارشد کارخانه' : 'General Manager'}</span>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. FOLLOW-UP AND EFFECTIVENESS */}
      {activeSubTab === 'followup' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <div>
              <h3 className="text-xs font-black text-white flex items-center gap-1.5 font-sans">
                <Search size={15} className="text-amber-500" />
                {isRtl ? 'کنترل وضعیت اقدامات اصلاحی و اثربخشی یافته‌های ممیزی' : 'Follow-up & Effectiveness Controls'}
              </h3>
              <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                {isRtl ? 'ارزیابی اثربخشی اقدامات ۸D ثبت شده بر اساس نمره‌دهی و سوابق آزمایشگاهی.' : 'Validate 8D actions and rate effectiveness.'}
              </p>
            </div>
          </div>

          {activeNcs.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl bg-[#09090B]/30 font-sans">
              <CheckCircle2 size={36} className="text-emerald-500/40 mx-auto mb-3" />
              <p className="text-xs text-zinc-500">
                {isRtl ? 'هیچ مغایرتی ثبت نشده است، پیگیری اقدام اصلاحی لازم نیست.' : 'No NCs to follow up.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeNcs.map((nc) => (
                <div key={nc.id} className="border border-zinc-800 bg-[#0E0E11] p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-zinc-900 pb-3 font-sans">
                    <div>
                      <h4 className="text-xs font-black text-white leading-relaxed">{nc.title}</h4>
                      <span className="text-[10px] text-zinc-500 font-bold block mt-1">فرآیند: {nc.processName} | بند: {nc.clauseId}</span>
                    </div>
                    <span className={`text-[10px] font-black ${
                      nc.classification === 'Major' ? 'text-rose-400' : 'text-amber-400'
                    }`}>
                      {nc.classification === 'Major' ? 'عمده Major' : 'جزئی Minor'}
                    </span>
                  </div>

                  <div className="bg-[#121215] p-3 rounded-xl border border-zinc-900 text-[11px] text-zinc-400 font-sans space-y-2">
                    <p className="leading-relaxed whitespace-pre-line">{nc.description}</p>
                    <div className="flex items-center justify-between border-t border-zinc-900 pt-2 text-[10px] text-zinc-500">
                      <span>{isRtl ? `تاریخ ثبت: ${nc.registeredAt}` : `Registered: ${nc.registeredAt}`}</span>
                      <span>{isRtl ? 'منشا: ممیزی سیستم' : 'Source: System Audit'}</span>
                    </div>
                  </div>

                  {/* 8D Link and Central Status sync */}
                  <div className="flex items-center justify-between text-xs border-t border-zinc-900 pt-3 select-none font-sans">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-zinc-500">{isRtl ? 'پیوند اقدامات اصلاحی:' : '8D Status:'}</span>
                      {nc.actionCode ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                          nc.actionStatus === 'CLOSED_CA' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}>
                          {nc.actionCode} ({nc.actionStatus === 'CLOSED_CA' ? 'بسته شده' : 'در حال حل'})
                        </span>
                      ) : (
                        <span className="text-rose-500 text-[10px] font-black">{isRtl ? 'فاقد اقدام ۸D' : 'No 8D linked'}</span>
                      )}
                    </div>

                    {nc.actionCode && onOpenCorrectiveActions && (
                      <button
                        onClick={onOpenCorrectiveActions}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-0.5"
                      >
                        <ExternalLink size={11} />
                        {isRtl ? 'انتقال به کارتابل ۸D' : 'Go to 8D Portal'}
                      </button>
                    )}
                  </div>

                  {/* Effectiveness validation rating and logs */}
                  <div className="border-t border-zinc-900 pt-3 space-y-3 font-sans">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] text-zinc-400 font-bold">{isRtl ? 'ارزیابی اثربخشی اقدام اصلاحی (مدیریت ممیزی)' : 'Effectiveness Rating'}</span>
                      <div className="flex items-center gap-1 text-amber-500 select-none">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            onClick={() => handleUpdateFollowup(nc.id, star, nc.evidence)}
                            className="hover:scale-115 transition-all cursor-pointer"
                          >
                            <Star size={13} fill={star <= 4 ? 'currentColor' : 'none'} className={star <= 4 ? 'text-amber-500' : 'text-zinc-700'} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        defaultValue={nc.evidence}
                        onBlur={(e) => handleUpdateFollowup(nc.id, 4, e.target.value)}
                        placeholder={isRtl ? 'یادداشت ممیز کیفیت در خصوص اثربخشی فیزیکی اقدام اصلاحی بر روی شواهد عینی...' : 'Effectiveness notes...'}
                        className="w-full bg-[#121215] border border-zinc-800 text-zinc-300 placeholder-zinc-600 rounded-xl p-2 text-[10.5px] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. AUDITOR QUALIFICATION SECTION */}
      {activeSubTab === 'auditor_qualification' && (
        <div className="space-y-6 animate-fade-in text-right" dir="rtl">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-900 pb-4 gap-4">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                <Award size={16} className="text-amber-500 animate-pulse" />
                {isRtl ? 'سیستم جامع سنجش و احراز صلاحیت هوشمند ممیزان داخلی IATF' : 'Automotive QMS Auditor Competency Matrix'}
              </h3>
              <p className="text-[10.5px] text-zinc-500 mt-1 leading-relaxed max-w-2xl font-sans">
                {isRtl 
                  ? 'ارزیابی هوشمند ممیزان بر اساس سرفصل‌های بند ۷.۲.۳ و ۷.۲.۴ استاندارد IATF 16949، همگام‌سازی شده با کارنامه آموزشی پرسنل و شواهد ساعت ممیزی انجام‌شده.'
                  : 'Automotive auditor credentials validation against IATF 16949 clause 7.2.3 & 7.2.4 requirements, linked with central training registries.'}
              </p>
            </div>
            
            <div className="flex items-center gap-2 self-start">
              <button
                onClick={() => setIsAddColumnModalOpen(true)}
                className="px-3.5 py-2 bg-[#1C1C1F] hover:bg-[#252529] border border-zinc-800 text-amber-500 hover:text-amber-400 text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 font-sans"
              >
                <Plus size={14} />
                {isRtl ? '➕ افزودن ستون صلاحیت جدید' : 'Add Competency Column'}
              </button>

              <button
                onClick={handleOpenAddAuditor}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-black text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1.5 hover:shadow-[0_0_12px_rgba(217,119,6,0.3)] font-sans"
              >
                <Plus size={14} />
                {isRtl ? '👤 ثبت ممیز جدید (سطر)' : 'Register New Auditor (Row)'}
              </button>
            </div>
          </div>

          {/* Standards & Competency Guideline Reference Card */}
          <div className="border border-zinc-800 bg-[#0E0E11]/30 p-4 rounded-xl flex flex-col md:flex-row gap-4 items-start font-sans">
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-lg shrink-0">
              <Award size={20} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-amber-500">
                {isRtl ? '⚠️ خلاصه راهنمای ممیز با صلاحیت IATF 16949 (بندهای ۷.۲.۳ و ۷.۲.۴)' : 'IATF 16949 Auditor Competency Requirements Guidance'}
              </h4>
              <p className="text-[10px] text-zinc-400 leading-relaxed text-justify">
                {isRtl 
                  ? 'ممیزان داخلی ممیزی سیستم مدیریت کیفیت، ممیزی فرآیند ساخت و ممیزی محصول باید حداقل معیارهای صلاحیت زیر را داشته باشند: درک رویکرد فرآیندی خودروسازی (تفکر مبتنی بر ریسک)، درک الزامات خاص مشتریان (CSR) مرتبط، شناخت الزامات استاندارد ISO 9001 و IATF 16949، شناخت کامل ابزارهای مهندسی کیفیت (Core Tools شامل SPC، MSA، FMEA، APQP، PPAP) و آشنایی با نحوه هدایت و گزارش‌دهی ممیزی.'
                  : 'Automotive internal auditors must possess: understanding of automotive process approach, customer-specific requirements (CSRs), ISO 9001 and IATF 16949 requirements, Core Quality Tools (FMEA, SPC, MSA, APQP) and audit conduction rules.'}
              </p>
            </div>
          </div>

          {/* Competency Matrix Table */}
          <div className="border border-zinc-800 bg-[#0A0A0C]/80 rounded-2xl p-5 overflow-hidden">
            <h4 className="text-xs font-black text-zinc-300 flex items-center gap-1.5 mb-4 select-none font-sans">
              <UserCheck size={14} className="text-amber-500" />
              {isRtl ? 'ماتریس صلاحیت و احراز صلاحیت ممیزان ممیزی داخلی سیستم مدیریت کیفیت IATF 16949' : 'Auditor Competency Validation Matrix'}
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs font-sans">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 font-bold">
                    <th className="pb-3 pr-2">{isRtl ? 'نام ممیز' : 'Auditor Name'}</th>
                    <th className="pb-3">{isRtl ? 'سمت / نقش ممیزی' : 'Audit Position'}</th>
                    <th className="pb-3 text-center">{isRtl ? 'الزامات IATF' : 'IATF Course'}</th>
                    <th className="pb-3 text-center">{isRtl ? 'ابزارهای مهندسی FMEA/SPC' : 'Core Tools'}</th>
                    <th className="pb-3 text-center">{isRtl ? 'رویکرد فرآیندی' : 'Process Appr.'}</th>
                    <th className="pb-3 text-center">{isRtl ? 'مدرک رسمی' : 'Official Cert'}</th>
                    {customColumns.map(col => (
                      <th key={col.id} className="pb-3 text-center group/col text-amber-500 font-semibold bg-amber-500/5 border-l border-r border-zinc-800/50 px-2 min-w-[120px]">
                        <div className="flex items-center justify-center gap-1">
                          <span className="truncate max-w-[100px]" title={col.title}>{col.title}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteColumn(col.id, col.title)}
                            className="text-zinc-600 hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer"
                            title={isRtl ? 'حذف ستون' : 'Delete column'}
                          >
                            <X size={10} />
                          </button>
                        </div>
                      </th>
                    ))}
                    <th className="pb-3 text-center">{isRtl ? 'ساعت ممیزی عملیاتی' : 'Audit Hours'}</th>
                    <th className="pb-3 text-center">{isRtl ? 'وضعیت صلاحیت' : 'Status'}</th>
                    <th className="pb-3 text-left pl-2">{isRtl ? 'عملیات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 text-zinc-300">
                  {auditors.map((aud) => {
                    // Calculate operative audit questions from checklist
                    const liveQuestionsCount = checklists.filter(item => {
                      if (!item.evidence) return false;
                      const p = programs.find(prog => prog.id === item.programId);
                      return p ? (p.leadAuditor === aud.name || p.leadAuditor?.includes(aud.name)) : false;
                    }).length;
                    
                    const dynamicHours = aud.auditExperienceHours + (liveQuestionsCount * 2);

                    // Cross-reference with central Training records to check if training is passed
                    const trainingLogs = [
                      { personnelName: 'علیرضا رضایی', courseTitle: 'الزامات و ممیزی داخلی IATF 16949:2016', isPassed: true },
                      { personnelName: 'مریم قاسمی', courseTitle: 'ابزارهای مهندسی کیفیت Core Tools', isPassed: true },
                      { personnelName: 'سارا احمدی', courseTitle: 'الزامات خاص مشتریان سازه‌گستر و ساپکو (CSR)', isPassed: true }
                    ];
                    const hasCentralTraining = trainingLogs.some(log => log.personnelName === aud.name && log.isPassed);

                    return (
                      <tr key={aud.id} className="hover:bg-[#121215]/50 transition-colors group">
                        {/* Name & training badge */}
                        <td className="py-3.5 pr-2 font-bold text-white text-[11.5px] max-w-[180px]">
                          <div className="flex flex-col gap-1">
                            <span>{aud.name}</span>
                            {hasCentralTraining && (
                              <span className="inline-flex items-center gap-1 text-[8.5px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded-full self-start font-sans">
                                <span>🔗</span>
                                <span>{isRtl ? 'تایید آموزش بند ۷.۲' : 'Competency Approved'}</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Role */}
                        <td className="py-3.5 text-zinc-400 text-[11px]">{aud.role}</td>

                        {/* IATF Certified */}
                        <td className="py-3.5 text-center">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${aud.standardsCertified ? 'bg-green-500/10 text-green-400' : 'bg-rose-500/10 text-rose-500'}`}>
                            {aud.standardsCertified ? <CheckCircle2 size={13} /> : <X size={13} />}
                          </span>
                        </td>

                        {/* Core Tools */}
                        <td className="py-3.5 text-center">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${aud.coreToolsCertified ? 'bg-green-500/10 text-green-400' : 'bg-rose-500/10 text-rose-500'}`}>
                            {aud.coreToolsCertified ? <CheckCircle2 size={13} /> : <X size={13} />}
                          </span>
                        </td>

                        {/* Process Approach */}
                        <td className="py-3.5 text-center">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${aud.processApproachCertified ? 'bg-green-500/10 text-green-400' : 'bg-rose-500/10 text-rose-500'}`}>
                            {aud.processApproachCertified ? <CheckCircle2 size={13} /> : <X size={13} />}
                          </span>
                        </td>

                        {/* Official Cert */}
                        <td className="py-3.5 text-center">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${aud.certificateUploaded ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-600'}`}>
                            {aud.certificateUploaded ? <Check size={13} /> : <X size={13} />}
                          </span>
                        </td>

                        {/* Custom columns cell values (interactive toggles!) */}
                        {customColumns.map(col => {
                          const val = aud.customFields?.[col.id] || false;
                          return (
                            <td key={col.id} className="py-3.5 text-center bg-amber-500/5 border-l border-r border-zinc-800/20">
                              <button
                                type="button"
                                onClick={() => {
                                  const nextAuditors = auditors.map(a => {
                                    if (a.id === aud.id) {
                                      return {
                                        ...a,
                                        customFields: {
                                          ...(a.customFields || {}),
                                          [col.id]: !val
                                        }
                                      };
                                    }
                                    return a;
                                  });
                                  saveAuditors(nextAuditors);
                                }}
                                className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition-all cursor-pointer ${
                                  val 
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30' 
                                    : 'bg-zinc-900 text-zinc-600 border-zinc-800 hover:text-zinc-400 hover:border-zinc-700'
                                }`}
                                title={isRtl ? `تغییر وضعیت ${col.title}` : `Toggle ${col.title}`}
                              >
                                {val ? <Check size={11} /> : <X size={11} />}
                              </button>
                            </td>
                          );
                        })}

                        {/* Dynamic Experience Hours */}
                        <td className="py-3.5 text-center font-mono font-bold text-white text-[11px]">
                          <div className="flex flex-col items-center gap-0.5">
                            <span>{dynamicHours} {isRtl ? 'ساعت' : 'hrs'}</span>
                            {liveQuestionsCount > 0 && (
                              <span className="text-[8px] text-green-400 bg-green-500/5 px-1 rounded">
                                +{liveQuestionsCount * 2} {isRtl ? 'از اجرای فعال' : 'from active checklist'}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black ${
                            aud.status === 'fully_qualified' 
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                              : aud.status === 'needs_training'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            <span>
                              {aud.status === 'fully_qualified' && (isRtl ? 'صلاحیت ممیز سیستم IATF' : 'Fully Certified')}
                              {aud.status === 'needs_training' && (isRtl ? 'نیاز به آموزش مکمل' : 'Needs Coursework')}
                              {aud.status === 'apprentice' && (isRtl ? 'کارآموز ممیزی' : 'Audit Apprentice')}
                            </span>
                          </span>
                        </td>

                        {/* Action buttons */}
                        <td className="py-3.5 text-left pl-2">
                          <div className="inline-flex items-center gap-2">
                            <button
                              onClick={() => handleOpenEditAuditor(aud)}
                              className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-amber-500 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-zinc-700"
                              title={isRtl ? 'ویرایش احراز صلاحیت' : 'Edit Credentials'}
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              onClick={() => handleDeleteAuditor(aud.id)}
                              className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-rose-500 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-zinc-700"
                              title={isRtl ? 'حذف ممیز' : 'Delete Auditor'}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 9. REGISTER & ARCHIVE AUDIT RECORDS (CUMULATIVE DOSSIER FILE CONTROLS PANEL) */}
      {activeSubTab === 'archive_sync' && (
        <div className="space-y-6 animate-fade-in text-right" dir="rtl">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
            <div>
              <h3 className="text-xs font-black text-white flex items-center gap-1.5 font-sans">
                💾 {isRtl ? 'بایگانی، ثبت سوابق و تبادل پرونده تجمعی ممیزی سیستم' : 'Register & Archive Cumulative Audit Dossier'}
              </h3>
              <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                {isRtl 
                  ? 'ثبت، تجمیع و دانلود پرونده‌های ممیزی داخلی سیستم مدیریت کیفیت در قالب یک فایل منسجم، یا بارگذاری مجدد فایل پرونده جهت بازیابی اطلاعات.' 
                  : 'Archive and download quality management system internal audit records in a single cohesive file, or upload a backup file to re-host.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start font-sans">
            {/* Left Column: Archive Actions & Import/Export */}
            <div className="lg:col-span-5 space-y-5">
              {/* Card 1: Archive Current Audit */}
              <div className="border border-zinc-800 bg-[#0E0E11] p-5 rounded-2xl space-y-4 text-right">
                <div className="border-b border-[#1C1C1F] pb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <h4 className="text-xs font-black text-white">
                    {isRtl ? 'فریز و بایگانی ممیزی جاری' : 'Archive Current Audit Dossier'}
                  </h4>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1.5 font-bold">
                      {isRtl ? 'انتخاب برنامه ممیزی جهت ثبت در سوابق:' : 'Select Audit Program to Archive:'}
                    </label>
                    <select
                      value={selectedProgramId}
                      onChange={(e) => setSelectedProgramId(e.target.value)}
                      className="w-full bg-[#151518] border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                    >
                      <option value="">{isRtl ? '-- انتخاب برنامه ممیزی --' : '-- Select Audit Program --'}</option>
                      {programs.map(prog => (
                        <option key={prog.id} value={prog.id}>
                          {prog.title} ({prog.cycle})
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedProgramId ? (
                    <div className="bg-[#121215] border border-zinc-850 rounded-xl p-3.5 space-y-2.5">
                      <div className="text-[10.5px] text-zinc-300 font-semibold leading-relaxed">
                        {isRtl ? '📊 مشخصات بسته اطلاعاتی آماده بایگانی:' : '📊 Package Details Ready for Archiving:'}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
                        <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/50">
                          <span className="text-zinc-500 block mb-0.5">{isRtl ? 'چک‌لیست‌ها' : 'Checklists'}</span>
                          <span className="text-xs font-bold text-amber-500 font-mono">
                            {checklists.filter(c => c.programId === selectedProgramId).length} {isRtl ? 'مورد' : 'items'}
                          </span>
                        </div>
                        <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/50">
                          <span className="text-zinc-500 block mb-0.5">{isRtl ? 'عدم انطباق‌ها (NC)' : 'Nonconformities'}</span>
                          <span className="text-xs font-bold text-rose-500 font-mono">
                            {ncs.filter(n => n.programId === selectedProgramId).length} {isRtl ? 'خطا' : 'errors'}
                          </span>
                        </div>
                        <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/50">
                          <span className="text-zinc-500 block mb-0.5">{isRtl ? 'فرصت‌های بهبود (OFI)' : 'Opportunities'}</span>
                          <span className="text-xs font-bold text-blue-400 font-mono">
                            {ofis.filter(o => o.programId === selectedProgramId).length} {isRtl ? 'مورد' : 'items'}
                          </span>
                        </div>
                        <div className="bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/50">
                          <span className="text-zinc-500 block mb-0.5">{isRtl ? 'گزارش‌های ممیزی' : 'Audit Reports'}</span>
                          <span className="text-xs font-bold text-green-400 font-mono">
                            {reports.filter(r => r.programId === selectedProgramId).length} {isRtl ? 'گزارش' : 'reports'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl text-amber-300 text-[10px] leading-relaxed">
                      ⚠️ {isRtl 
                        ? 'جهت ثبت پرونده ممیزی در سوابق آرشیو، ابتدا یکی از برنامه‌های ممیزی تعریف شده را از لیست بالا انتخاب کنید.' 
                        : 'To file the audit package, please select an active audit program from the dropdown above.'}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveCumulativeRecord}
                    disabled={!selectedProgramId}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-850 disabled:text-zinc-500 disabled:opacity-50 text-black text-xs font-black rounded-xl transition-all cursor-pointer shadow-lg disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <Save size={14} className="stroke-[2.5]" />
                    <span>{isRtl ? '📂 ثبت پرونده جامع و انتقال به بایگانی سوابق' : 'Save & Archive Audit Dossier'}</span>
                  </button>
                </div>
              </div>

              {/* Card 2: Backup Import/Export */}
              <div className="border border-zinc-800 bg-[#0E0E11] p-5 rounded-2xl space-y-4 text-right">
                <div className="border-b border-[#1C1C1F] pb-2 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                  <h4 className="text-xs font-black text-white">
                    {isRtl ? 'تبادل خارجی و پشتیبان‌گیری' : 'External File Backup & Import'}
                  </h4>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                      {isRtl 
                        ? 'کل داده‌های ممیزی داخلی سیستم (برنامه‌ها، چک‌لیست‌ها، خطاها، فرصت‌های بهبود و گزارش‌ها) را در قالب یک فایل پشتیبان JSON صادر کنید.' 
                        : 'Export the complete set of QMS internal audit states as a portable JSON file.'}
                    </p>
                    <button
                      type="button"
                      onClick={handleDownloadCumulativeFile}
                      className="w-full py-2 bg-[#151518] hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Download size={13} />
                      <span>{isRtl ? '📤 دانلود فایل پشتیبان کامل (JSON)' : 'Export JSON Backup'}</span>
                    </button>
                  </div>

                  <div className="border-t border-zinc-850 pt-3.5 space-y-2">
                    <label className="block text-[10px] text-indigo-400 font-bold mb-1">
                      {isRtl ? '📥 بارگذاری فایل پشتیبان (JSON):' : '📥 Import Backup (JSON):'}
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleUploadCumulativeFile}
                        className="w-full text-zinc-400 bg-[#121215] border border-zinc-800 rounded-xl px-2.5 py-1.5 text-[10px] focus:outline-none file:ml-2.5 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[10px] file:bg-zinc-800 file:text-white file:font-bold hover:file:bg-zinc-700 file:cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Listed Archived Cumulative Records */}
            <div className="lg:col-span-7 border border-zinc-800 bg-[#0E0E11] p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#1C1C1F] pb-2">
                <h4 className="text-xs font-black text-zinc-300">
                  📂 {isRtl ? 'فهرست پرونده‌های ممیزی آرشیو شده (بند ۹.۲.۲.۲)' : 'Archived Cumulative Audit Records (9.2.2.2)'}
                </h4>
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
                  {archivedRecords.length} {isRtl ? 'پرونده' : 'files'}
                </span>
              </div>

              {archivedRecords.length === 0 ? (
                <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl bg-[#09090B]/30 text-zinc-500 italic text-xs font-sans">
                  {isRtl 
                    ? 'تاکنون هیچ پرونده جامع ممیزی ثبت یا آرشیو نشده است. جهت ثبت پرونده جاری، از بخش «فریز و بایگانی ممیزی جاری» در سمت راست استفاده نمایید.' 
                    : 'No cumulative audit files recorded yet. Use the "Archive Current Audit Dossier" panel on the right to store cumulative files.'}
                </div>
              ) : (
                <div className="space-y-3.5 max-h-[500px] overflow-y-auto custom-scrollbar divide-y divide-zinc-900">
                  {archivedRecords.map((rec, rIdx) => (
                    <div 
                      key={rec.id} 
                      className={`flex items-start justify-between gap-3 pt-3.5 ${rIdx === 0 ? 'pt-0' : ''} font-sans`}
                    >
                      <div className="min-w-0 flex-1 space-y-1 text-right">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          <span className="text-xs font-bold text-white block truncate leading-tight">
                            {rec.documentName}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.2 rounded font-mono font-bold">
                            {rec.code}
                          </span>
                          <span className="text-[9px] text-zinc-400">
                            {isRtl ? `ویرایش ${rec.revision}` : `Rev ${rec.revision}`}
                          </span>
                          <span className="text-[9px] text-zinc-500 font-mono">
                            {isRtl ? `ثبت شده در: ${rec.archivedAt}` : `Archived: ${rec.archivedAt}`}
                          </span>
                          <span className="text-[9px] text-zinc-500">
                            {isRtl ? `توسط: ${rec.preparedBy}` : `By: ${rec.preparedBy}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* Restore button */}
                        <button
                          onClick={() => handleRestoreCumulativeRecord(rec)}
                          className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-500 text-[10px] font-black rounded-lg transition-all cursor-pointer"
                          title={isRtl ? 'بازیابی و بارگذاری مجدد در وضعیت فعال ممیزی' : 'Restore and Load session'}
                        >
                          🔄 {isRtl ? 'بازیابی' : 'Restore'}
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={() => handleDeleteCumulativeRecord(rec.id)}
                          className="p-1.5 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                          title={isRtl ? 'حذف دائمی پرونده' : 'Delete file'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- ADD / EDIT PROGRAM DIALOG MODAL --- */}
      {isProgramModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0D0D10] border border-zinc-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4 select-none">
              <h4 className="text-sm font-black text-white">
                {editingProgram ? '📝 ویرایش برنامه ممیزی داخلی سالانه' : '➕ تعریف برنامه ممیزی داخلی جدید (۹.۲.۲.۱)'}
              </h4>
              <button
                type="button"
                onClick={() => setIsProgramModalOpen(false)}
                className="text-zinc-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveProgram} className="space-y-4 text-xs font-sans">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'عنوان ممیزی' : 'Audit Title'}</label>
                  <input
                    type="text"
                    required
                    value={programForm.title}
                    onChange={(e) => setProgramForm({ ...programForm, title: e.target.value })}
                    className="w-full bg-[#141416] border border-zinc-800 text-zinc-300 rounded-xl p-2 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'دوره ممیزی (مثلاً پاییز ۱۴۰۵)' : 'Cycle'}</label>
                  <input
                    type="text"
                    required
                    value={programForm.cycle}
                    onChange={(e) => setProgramForm({ ...programForm, cycle: e.target.value })}
                    className="w-full bg-[#141416] border border-zinc-800 text-zinc-300 rounded-xl p-2 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'دامنه ممیزی' : 'Audit Scope Description'}</label>
                <input
                  type="text"
                  required
                  value={programForm.scope}
                  onChange={(e) => setProgramForm({ ...programForm, scope: e.target.value })}
                  className="w-full bg-[#141416] border border-zinc-800 text-zinc-300 rounded-xl p-2 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'سرممیز / تیم ممیزی' : 'Lead Auditor'}</label>
                  <input
                    type="text"
                    required
                    value={programForm.leadAuditor}
                    onChange={(e) => setProgramForm({ ...programForm, leadAuditor: e.target.value })}
                    className="w-full bg-[#141416] border border-zinc-800 text-zinc-300 rounded-xl p-2 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'تاریخ اصلی ممیزی' : 'Target Date'}</label>
                  <input
                    type="text"
                    required
                    value={programForm.auditDate}
                    onChange={(e) => setProgramForm({ ...programForm, auditDate: e.target.value })}
                    className="w-full bg-[#141416] border border-zinc-800 text-zinc-300 rounded-xl p-2 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'وضعیت اجرا' : 'Status'}</label>
                  <select
                    value={programForm.status}
                    onChange={(e) => setProgramForm({ ...programForm, status: e.target.value as any })}
                    className="w-full bg-[#141416] border border-zinc-800 text-zinc-300 rounded-xl p-2 focus:outline-none"
                  >
                    <option value="draft">{isRtl ? 'پیش‌نویس' : 'Draft'}</option>
                    <option value="scheduled">{isRtl ? 'زمان‌بندی شده' : 'Scheduled'}</option>
                    <option value="in_progress">{isRtl ? 'در حال اجرا' : 'In Progress'}</option>
                    <option value="completed">{isRtl ? 'کامل شده' : 'Completed'}</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Schedules Table with editable timelines */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden mt-4">
                <div className="bg-[#0E0E11] p-2.5 border-b border-zinc-800 text-[10px] font-bold text-zinc-400 text-right">
                  🗓️ {isRtl ? 'زمان‌بندی هوشمند و تعیین محدوده فرآیندهای ممیزی' : 'Dynamic Processes Timelines & Scopes'}
                </div>
                
                <div className="max-h-48 overflow-y-auto divide-y divide-zinc-900 bg-[#070709] px-2">
                  {programForm.processSchedules.map((ps, idx) => (
                    <div key={idx} className="py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                      <div className="font-bold text-white w-40">{ps.processName}</div>
                      
                      <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                        <div className="flex-1">
                          <label className="text-[8px] text-zinc-500 block mb-0.5">{isRtl ? 'بازه زمانی انجام ممیزی' : 'Time slot'}</label>
                          <input
                            type="text"
                            required
                            value={ps.timeframe}
                            onChange={(e) => {
                              const updated = [...programForm.processSchedules];
                              updated[idx].timeframe = e.target.value;
                              setProgramForm({ ...programForm, processSchedules: updated });
                            }}
                            className="w-full bg-[#121214] border border-zinc-800 text-zinc-300 text-[10.5px] p-1 rounded-lg focus:outline-none"
                          />
                        </div>

                        <div className="flex-1">
                          <label className="text-[8px] text-zinc-500 block mb-0.5">{isRtl ? 'محدوده بندهای ممیزی' : 'Audit Scope'}</label>
                          <input
                            type="text"
                            required
                            value={ps.clauses}
                            onChange={(e) => {
                              const updated = [...programForm.processSchedules];
                              updated[idx].clauses = e.target.value;
                              setProgramForm({ ...programForm, processSchedules: updated });
                            }}
                            className="w-full bg-[#121214] border border-zinc-800 text-zinc-300 text-[10.5px] p-1 rounded-lg focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Validation Warning Box */}
              {!(
                programForm.title.trim() &&
                programForm.cycle.trim() &&
                programForm.scope.trim() &&
                programForm.leadAuditor.trim() &&
                programForm.auditDate.trim() &&
                programForm.processSchedules.every(ps => ps.timeframe && ps.timeframe.trim())
              ) && (
                <div className="p-3.5 bg-rose-950/30 border border-rose-800/40 rounded-xl text-rose-300 text-[11px] leading-relaxed text-right mt-4 font-bold font-sans">
                  ⚠️ {isRtl 
                    ? 'توجه: جهت فعال‌سازی دکمه ثبت، لطفاً تمامی فیلدها (عنوان، دوره، دامنه، سرممیز، تاریخ و زمان‌بندی تمام فرآیندها) را به طور کامل پر نمایید.' 
                    : 'Attention: Please complete all fields (title, cycle, scope, lead auditor, date, and timelines) to activate the save button.'}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsProgramModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-black rounded-xl transition-all cursor-pointer"
                >
                  {isRtl ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={!(
                    programForm.title.trim() &&
                    programForm.cycle.trim() &&
                    programForm.scope.trim() &&
                    programForm.leadAuditor.trim() &&
                    programForm.auditDate.trim() &&
                    programForm.processSchedules.every(ps => ps.timeframe && ps.timeframe.trim())
                  )}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-850 disabled:text-zinc-500 disabled:opacity-50 text-black text-xs font-black rounded-xl transition-all cursor-pointer shadow-lg disabled:cursor-not-allowed"
                >
                  {isRtl ? 'تأیید و ذخیره' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD / REGISTER NONCONFORMITY MODAL --- */}
      {isNcModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0D0D10] border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4 select-none">
              <h4 className="text-sm font-black text-white flex items-center gap-1">
                <AlertTriangle size={15} className="text-rose-500" />
                {isRtl ? 'ثبت مغایرت و عدم انطباق (Audit NC)' : 'Log Audit Nonconformity'}
              </h4>
              <button
                type="button"
                onClick={() => setIsNcModalOpen(false)}
                className="text-zinc-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveNc} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'عنوان خطای کیفی' : 'NC Title'}</label>
                <input
                  type="text"
                  required
                  value={newNcData.title}
                  onChange={(e) => setNewNcData({ ...newNcData, title: e.target.value })}
                  className="w-full bg-[#141416] border border-zinc-800 text-zinc-300 rounded-xl p-2 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'شرح و شواهد عینی خطا' : 'Description & Objective Evidence'}</label>
                <textarea
                  required
                  value={newNcData.description}
                  onChange={(e) => setNewNcData({ ...newNcData, description: e.target.value })}
                  className="w-full bg-[#141416] border border-zinc-800 text-zinc-300 rounded-xl p-2.5 focus:outline-none"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'طبقه‌بندی مغایرت' : 'Classification'}</label>
                  <select
                    value={newNcData.classification}
                    onChange={(e) => setNewNcData({ ...newNcData, classification: e.target.value as any })}
                    className="w-full bg-[#141416] border border-zinc-800 text-zinc-300 rounded-xl p-2 focus:outline-none"
                  >
                    <option value="Minor">{isRtl ? 'جزئی (Minor)' : 'Minor'}</option>
                    <option value="Major">{isRtl ? 'عمده (Major)' : 'Major'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'فرآیند مربوطه' : 'Associated Process'}</label>
                  <select
                    value={newNcData.processId}
                    onChange={(e) => {
                      const matched = processes.find(p => p.id === e.target.value);
                      setNewNcData({ 
                        ...newNcData, 
                        processId: e.target.value,
                        processName: matched?.field1 || ''
                      });
                    }}
                    className="w-full bg-[#141416] border border-zinc-800 text-zinc-300 rounded-xl p-2 focus:outline-none"
                  >
                    {processes.map(p => (
                      <option key={p.id} value={p.id}>{p.field1}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsNcModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-black rounded-xl cursor-pointer"
                >
                  {isRtl ? 'انصراف' : 'Cancel'}
                </button>
                {/* Validation Warning Box */}
                {!(newNcData.title.trim() && newNcData.description.trim()) && (
                  <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl text-rose-300 text-[10.5px] leading-relaxed text-right font-semibold font-sans mb-3 w-full">
                    ⚠️ {isRtl 
                      ? 'توجه: لطفاً فیلدهای عنوان عدم انطباق و شرح کامل خطا را تکمیل نمایید تا دکمه ثبت فعال گردد.' 
                      : 'Attention: Please complete the NC Title and Description to activate the register button.'}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={!(newNcData.title.trim() && newNcData.description.trim())}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-850 disabled:text-zinc-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-lg disabled:cursor-not-allowed"
                >
                  {isRtl ? 'تأیید و ثبت رکورد' : 'Register'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD / REGISTER AUDITOR MODAL --- */}
      {isAuditorModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0D0D10] border border-zinc-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4 select-none">
              <h4 className="text-sm font-black text-white flex items-center gap-1.5 font-sans">
                <Award size={15} className="text-amber-500" />
                {editingAuditor ? (isRtl ? 'ویرایش پرونده صلاحیت ممیز IATF' : 'Edit Auditor Profile') : (isRtl ? 'ثبت و احراز صلاحیت ممیز جدید' : 'Register New Quality Auditor')}
              </h4>
              <button
                type="button"
                onClick={() => setIsAuditorModalOpen(false)}
                className="text-zinc-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveAuditor} className="space-y-4 text-xs font-sans text-right" dir="rtl">
              {/* Name & Role */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'نام و نام خانوادگی' : 'Auditor Full Name'}</label>
                  <input
                    type="text"
                    required
                    value={auditorForm.name}
                    onChange={(e) => setAuditorForm({ ...auditorForm, name: e.target.value })}
                    className="w-full bg-[#141416] border border-zinc-800 text-white rounded-xl p-2.5 focus:outline-none"
                    placeholder="مثال: علیرضا رضایی"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'سمت / نقش در تیم ممیزی' : 'Auditor Position'}</label>
                  <input
                    type="text"
                    required
                    value={auditorForm.role}
                    onChange={(e) => setAuditorForm({ ...auditorForm, role: e.target.value })}
                    className="w-full bg-[#141416] border border-zinc-800 text-white rounded-xl p-2.5 focus:outline-none"
                    placeholder="مثال: سرممیز ارشد کیفیت"
                  />
                </div>
              </div>

              {/* Checkboxes matrix of requirements */}
              <div className="bg-[#101012] border border-zinc-900 rounded-xl p-4 space-y-3 text-right">
                <span className="block text-[10px] text-zinc-500 font-bold uppercase">{isRtl ? 'حداقل چک‌لیست صلاحیت ممیز طبق بند ۷.۲.۳ استاندارد IATF' : 'Auditor Minimal Qualifications'}</span>
                
                <label className="flex items-center gap-2.5 cursor-pointer select-none text-zinc-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={auditorForm.standardsCertified}
                    onChange={(e) => setAuditorForm({ ...auditorForm, standardsCertified: e.target.checked })}
                    className="rounded border-zinc-800 bg-[#141416] text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-[11px]">{isRtl ? 'گذراندن دوره آموزشی الزامات و ممیزی داخلی IATF 16949:2016' : 'Passed ISO 9001 & IATF 16949 Auditing Course'}</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none text-zinc-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={auditorForm.coreToolsCertified}
                    onChange={(e) => setAuditorForm({ ...auditorForm, coreToolsCertified: e.target.checked })}
                    className="rounded border-zinc-800 bg-[#141416] text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-[11px]">{isRtl ? 'تسلط بر ابزارهای پنج‌گانه مهندسی کیفیت Core Tools (FMEA, SPC, MSA)' : 'Mastery of Quality Core Tools'}</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none text-zinc-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={auditorForm.processApproachCertified}
                    onChange={(e) => setAuditorForm({ ...auditorForm, processApproachCertified: e.target.checked })}
                    className="rounded border-zinc-800 bg-[#141416] text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-[11px]">{isRtl ? 'آشنایی کامل با رویکرد فرآیندی خودروسازی و تفکر مبتنی بر ریسک' : 'Understanding of Automotive Process Approach'}</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer select-none text-zinc-300 hover:text-white">
                  <input
                    type="checkbox"
                    checked={auditorForm.certificateUploaded}
                    onChange={(e) => setAuditorForm({ ...auditorForm, certificateUploaded: e.target.checked })}
                    className="rounded border-zinc-800 bg-[#141416] text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-[11px]">{isRtl ? 'ثبت و آرشیو شواهد رسمی و فیزیکی صلاحیت در پرونده پرسنلی' : 'Archived physical credentials in official QMS records'}</span>
                </label>

                {/* Custom qualifications columns checklist */}
                {customColumns.map(col => (
                  <label key={col.id} className="flex items-center gap-2.5 cursor-pointer select-none text-amber-400 hover:text-amber-300 border-t border-zinc-900/40 pt-2.5 mt-2">
                    <input
                      type="checkbox"
                      checked={!!(auditorForm.customFields && auditorForm.customFields[col.id])}
                      onChange={(e) => {
                        const nextFields = { ...(auditorForm.customFields || {}) };
                        nextFields[col.id] = e.target.checked;
                        setAuditorForm({ ...auditorForm, customFields: nextFields });
                      }}
                      className="rounded border-zinc-800 bg-[#141416] text-amber-500 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold">{col.title} ({isRtl ? 'ستون سفارشی' : 'Custom Field'})</span>
                  </label>
                ))}
              </div>

              {/* Hours & Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'ساعت تجربه ممیزی پایه (قبلی)' : 'Previous Audit Experience Hours'}</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={auditorForm.auditExperienceHours}
                    onChange={(e) => setAuditorForm({ ...auditorForm, auditExperienceHours: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-[#141416] border border-zinc-800 text-white rounded-xl p-2.5 font-mono text-left focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'وضعیت صلاحیت' : 'Competency Grade'}</label>
                  <select
                    value={auditorForm.status}
                    onChange={(e) => setAuditorForm({ ...auditorForm, status: e.target.value as any })}
                    className="w-full bg-[#141416] border border-zinc-800 text-white rounded-xl p-2.5 focus:outline-none"
                  >
                    <option value="fully_qualified">{isRtl ? '🎖️ صلاحیت ممیزی سیستم IATF' : 'Fully Certified'}</option>
                    <option value="needs_training">{isRtl ? '⚠️ نیازمند دوره مکمل آموزشی' : 'Needs Coursework'}</option>
                    <option value="apprentice">{isRtl ? '🌱 ممیز تحت آموزش / کارآموز' : 'Audit Apprentice'}</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">{isRtl ? 'سوابق، ملاحظات و دوره‌های تکمیلی گذرانده شده' : 'Auditor Notes & Training Logs'}</label>
                <textarea
                  value={auditorForm.notes}
                  onChange={(e) => setAuditorForm({ ...auditorForm, notes: e.target.value })}
                  className="w-full bg-[#141416] border border-zinc-800 text-zinc-300 rounded-xl p-2.5 focus:outline-none font-sans"
                  rows={3}
                  placeholder={isRtl ? 'مثال: دوره کالیبراسیون و عدم قطعیت اندازه‌گیری را در آزمایشگاه مرجع گذرانده است.' : 'Training and certifications...'}
                />
              </div>

              {/* Validation Warning Box */}
              {!(auditorForm.name.trim() && auditorForm.role.trim()) && (
                <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl text-rose-300 text-[10.5px] leading-relaxed text-right font-semibold font-sans mt-2">
                  ⚠️ {isRtl 
                    ? 'توجه: لطفاً فیلدهای نام ممیز و سمت/نقش ممیز را تکمیل نمایید تا دکمه ثبت فعال گردد.' 
                    : 'Attention: Please complete the Auditor Name and Role to activate the save button.'}
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800 font-sans">
                <button
                  type="button"
                  onClick={() => setIsAuditorModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-black rounded-xl transition-all cursor-pointer"
                >
                  {isRtl ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={!(auditorForm.name.trim() && auditorForm.role.trim())}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-850 disabled:text-zinc-500 disabled:opacity-50 text-black text-xs font-black rounded-xl transition-all cursor-pointer shadow-lg disabled:cursor-not-allowed"
                >
                  {isRtl ? 'تایید و ذخیره پرونده ممیز' : 'Save Competency Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD CUSTOM COLUMN MODAL --- */}
      {isAddColumnModalOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0D0D10] border border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col animate-fade-in text-right" dir="rtl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-4 select-none">
              <h4 className="text-sm font-black text-white flex items-center gap-1.5 font-sans">
                <Plus size={15} className="text-amber-500" />
                {isRtl ? 'تعریف ستون صلاحیت جدید در ماتریس' : 'Add New Qualification Column'}
              </h4>
              <button
                type="button"
                onClick={() => setIsAddColumnModalOpen(false)}
                className="text-zinc-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleAddColumn} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[10px] text-zinc-500 mb-1.5 font-bold uppercase">
                  {isRtl ? 'عنوان ستون جدید (مثلاً دوره VDA 6.3 یا الزامات خاص مشتری ساپکو)' : 'New Column Title'}
                </label>
                <input
                  type="text"
                  required
                  value={newColumnTitle}
                  onChange={(e) => setNewColumnTitle(e.target.value)}
                  className="w-full bg-[#141416] border border-zinc-800 text-white rounded-xl p-2.5 focus:outline-none focus:border-amber-500 font-sans text-right"
                  placeholder={isRtl ? 'عنوان ستون را وارد کنید...' : 'Enter column title...'}
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800 font-sans">
                <button
                  type="button"
                  onClick={() => setIsAddColumnModalOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-black rounded-xl transition-all cursor-pointer"
                >
                  {isRtl ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black text-xs font-black rounded-xl transition-all cursor-pointer shadow-lg shadow-amber-600/10"
                >
                  {isRtl ? 'ایجاد ستون' : 'Create Column'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI AUDIT REVIEW MODAL */}
      {isAiReviewModalOpen && aiAuditResult && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0D0D10] border border-zinc-800 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col animate-fade-in my-8">
            <div className="flex items-center justify-between border-b border-zinc-800 p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-600/20 rounded-lg">
                  <Sparkles size={24} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">
                    {isRtl ? 'پیش‌نویس ممیزی هوشمند (Senior Lead Auditor)' : 'AI Smart Audit Draft'}
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {isRtl ? 'نتایج تحلیل شده توسط هوش مصنوعی بر اساس کل پروژه IATF' : 'AI analyzed results based on full IATF project data'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiReviewModalOpen(false)}
                className="text-zinc-500 hover:text-white p-2 rounded-xl transition-colors cursor-pointer bg-zinc-900"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[65vh] space-y-6 custom-scrollbar">
              {/* Summary Section */}
              <div className="p-4 bg-amber-900/10 border border-amber-900/20 rounded-xl">
                <h4 className="text-xs font-bold text-amber-500 mb-2 flex items-center gap-1.5">
                  <FileText size={14} />
                  {isRtl ? 'خلاصه مدیریتی ممیزی' : 'Audit Executive Summary'}
                </h4>
                <p className="text-xs text-zinc-300 leading-relaxed italic">
                  {aiAuditResult.summary}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Findings Stats */}
                <div className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-center justify-around">
                  <div className="text-center">
                    <div className="text-xl font-black text-red-500">{aiAuditResult.newNCs.length}</div>
                    <div className="text-[9px] text-zinc-500 uppercase">{isRtl ? 'عدم انطباق (NC)' : 'Nonconformities'}</div>
                  </div>
                  <div className="w-px h-8 bg-zinc-800" />
                  <div className="text-center">
                    <div className="text-xl font-black text-blue-500">{aiAuditResult.newOFIs.length}</div>
                    <div className="text-[9px] text-zinc-500 uppercase">{isRtl ? 'فرصت بهبود (OFI)' : 'OFI Items'}</div>
                  </div>
                  <div className="w-px h-8 bg-zinc-800" />
                  <div className="text-center">
                    <div className="text-xl font-black text-green-500">
                      {aiAuditResult.checklistUpdates.filter((u: any) => u.status === 'C').length}
                    </div>
                    <div className="text-[9px] text-zinc-500 uppercase">{isRtl ? 'انطباق (OK)' : 'Conformities'}</div>
                  </div>
                </div>

                <div className="p-4 bg-indigo-900/10 border border-indigo-900/20 rounded-xl">
                  <h4 className="text-[10px] font-bold text-indigo-400 mb-1 flex items-center gap-1.5 uppercase">
                    <Award size={12} />
                    {isRtl ? 'نقاط قوت شناسایی شده' : 'Identified Strengths'}
                  </h4>
                  <p className="text-[11px] text-zinc-400 line-clamp-2">
                    {aiAuditResult.report.strengths}
                  </p>
                </div>
              </div>

              {/* Detailed Findings List */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-zinc-400 flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-red-500" />
                  {isRtl ? 'مشروح عدم انطباق‌های پیشنهادی' : 'Proposed Nonconformities'}
                </h4>
                {aiAuditResult.newNCs.length === 0 ? (
                  <div className="text-[10px] text-zinc-600 italic py-2">
                    {isRtl ? 'عدم انطباقی توسط هوش مصنوعی شناسایی نگردید.' : 'No nonconformities identified by AI.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {aiAuditResult.newNCs.map((nc: any, idx: number) => (
                      <div key={idx} className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                            <ShieldAlert size={12} />
                            {nc.classification === 'Major' ? (isRtl ? 'بحرانی / عمده' : 'Major NC') : (isRtl ? 'جزئی' : 'Minor NC')}
                          </span>
                          <span className="text-[9px] text-zinc-500 font-mono">IATF {nc.clauseId}</span>
                        </div>
                        <div className="text-xs font-black text-zinc-200 mb-1">{nc.title}</div>
                        <div className="text-[10px] text-zinc-400 leading-relaxed">{nc.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Checklist Evidence Preview */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-zinc-400 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-green-500" />
                  {isRtl ? 'نمونه شواهد ممیزی و وضعیت سوالات' : 'Audit Evidence & Checklist Sample'}
                </h4>
                <div className="bg-zinc-900/30 rounded-xl overflow-hidden border border-zinc-800">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-zinc-900 border-b border-zinc-800">
                        <th className="p-2 text-[10px] text-zinc-500 font-bold">{isRtl ? 'شناسه سوال' : 'ID'}</th>
                        <th className="p-2 text-[10px] text-zinc-500 font-bold">{isRtl ? 'وضعیت' : 'Status'}</th>
                        <th className="p-2 text-[10px] text-zinc-500 font-bold">{isRtl ? 'شواهد پیشنهادی هوش مصنوعی' : 'AI Evidence'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiAuditResult.checklistUpdates.slice(0, 5).map((upd: any, idx: number) => (
                        <tr key={idx} className="border-b border-zinc-800/50">
                          <td className="p-2 text-[9px] text-zinc-600 font-mono">{upd.id.split('-')[1] || upd.id}</td>
                          <td className="p-2">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                              upd.status === 'C' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                            }`}>
                              {upd.status}
                            </span>
                          </td>
                          <td className="p-2 text-[10px] text-zinc-400 leading-tight italic truncate max-w-xs">{upd.evidence}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {aiAuditResult.checklistUpdates.length > 5 && (
                    <div className="p-2 text-center text-[9px] text-zinc-600">
                      {isRtl ? `+ ${aiAuditResult.checklistUpdates.length - 5} سوال دیگر تکمیل شده است` : `+ ${aiAuditResult.checklistUpdates.length - 5} more questions completed`}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-800 flex items-center justify-between bg-zinc-900/20 rounded-b-2xl">
              <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                <AlertTriangle size={14} className="text-amber-500" />
                {isRtl 
                  ? 'توجه: این نتایج پیشنهادی است. لطفاً قبل از تایید نهایی و ثبت در دیتابیس، آنها را بررسی کنید.' 
                  : 'Note: These are AI suggestions. Review before final database registration.'}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsAiReviewModalOpen(false)}
                  className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs font-black rounded-xl transition-all cursor-pointer"
                >
                  {isRtl ? 'انصراف و لغو' : 'Discard & Cancel'}
                </button>
                <button
                  onClick={handleConfirmAiAudit}
                  className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-lg shadow-green-600/20 flex items-center gap-2"
                >
                  <Check size={16} />
                  {isRtl ? 'تایید و ثبت نهایی در دیتابیس' : 'Confirm & Register in DB'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed bottom-6 right-6 z-[9999] max-w-md p-4 rounded-2xl shadow-2xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-5 duration-300 ${
          notification.type === 'error' ? 'bg-red-950/90 border border-red-500/50 text-red-100' :
          notification.type === 'success' ? 'bg-emerald-950/90 border border-emerald-500/50 text-emerald-100' :
          notification.type === 'warn' ? 'bg-amber-950/90 border border-amber-500/50 text-amber-100' :
          'bg-zinc-900/90 border border-zinc-700/50 text-zinc-100'
        }`}>
          {notification.type === 'error' ? <AlertCircle size={20} className="shrink-0" /> :
           notification.type === 'success' ? <CheckCircle2 size={20} className="shrink-0" /> :
           notification.type === 'warn' ? <AlertTriangle size={20} className="shrink-0" /> :
           <Sparkles size={20} className="shrink-0" />}
          <div className="flex-1">
            <p className="text-xs font-medium leading-relaxed">{notification.message}</p>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
            <X size={14} />
          </button>
        </div>
      )}

    </div>
  );
}
