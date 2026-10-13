/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { IATFClause, iatfData } from '../data/iatfData';

// Helper to recursively find the parent clause of a standard clause
const findParentClause = (clauses: IATFClause[], childId: string, parent: IATFClause | null = null): IATFClause | null => {
  for (const c of clauses) {
    if (c.id === childId) return parent;
    if (c.subClauses) {
      const found = findParentClause(c.subClauses, childId, c);
      if (found) return found;
    }
  }
  return null;
};
import { BookOpen, Lightbulb, FileCheck, ShieldCheck, Sparkles, Activity, Target, ArrowLeftRight, Plus, Trash2, Archive, Eye, AlertTriangle, Clock, HelpCircle, Info, X, FileText, Lock, RefreshCw } from 'lucide-react';
import { CsrComparisonItem, CsrDocument } from '../types';
import { uiTranslations } from '../lib/translations';
import { QmsDatabase } from '../lib/qmsDatabase';
import { isClauseAssociated, flattenIatfClauses } from '../lib/matrixGenerator';
import { getJalaliDate } from '../lib/dateUtils';
import RecordViewerModal from './RecordViewerModal';
import CsrManager from './CsrManager';
import CorrectiveActionPortal from './CorrectiveActionPortal';
import { User } from './TeamManagement';
import InternalAuditCalendar from './InternalAuditCalendar';
import InternalAuditModule from './InternalAuditModule';
import JobSetupModule from './JobSetupModule';
import InProcessControlModule from './InProcessControlModule';
import BlankTemplatesModal from './BlankTemplatesModal';

interface Props {
  clause: IATFClause | null;
  onDocumentClick: (docName: string) => void;
  csrComparisons?: CsrComparisonItem[];
  lang: 'fa' | 'en';
  indicators?: any[];
  onSelectIndicatorsTab?: () => void;
  onAddClauseDocument?: (clauseId: string, docName: string) => void;
  onEditClauseDocument?: (clauseId: string, oldDocName: string, newDocName: string) => void;
  onDeleteClauseDocument?: (clauseId: string, docName: string) => void;
  onUpdateInterpretation?: (clauseId: string, newInterpretation: string) => void;
  records?: any[];
  onArchiveDocument?: (clauseId: string, docName: string) => void;
  onDeleteRecord?: (recordId: string) => void;
  setCsrComparisons?: React.Dispatch<React.SetStateAction<CsrComparisonItem[]>>;
  csrDocuments?: CsrDocument[];
  setCsrDocuments?: React.Dispatch<React.SetStateAction<CsrDocument[]>>;
  onSelectClauseId?: (clauseId: string) => void;
  currentUser?: User | null;
  onPinToDashboard?: () => void;
  onOpenCorrectiveActions?: () => void;
}

export default function ClauseDetail({ 
  clause, 
  onDocumentClick, 
  csrComparisons = [], 
  lang, 
  indicators = [], 
  onSelectIndicatorsTab,
  onAddClauseDocument,
  onEditClauseDocument,
  onDeleteClauseDocument,
  onUpdateInterpretation,
  records = [],
  onArchiveDocument,
  onDeleteRecord,
  setCsrComparisons,
  csrDocuments = [],
  setCsrDocuments,
  onSelectClauseId,
  currentUser,
  onPinToDashboard,
  onOpenCorrectiveActions
}: Props) {
  const isRtl = lang === 'fa';
  const t = uiTranslations[lang];

  const clausePerm = currentUser?.role === 'user' ? currentUser?.permissions?.clauses?.[clause?.id || ''] : undefined;
  const isRestrictedView = clausePerm && clausePerm.view === false;
  const isRestrictedDocList = clausePerm && clausePerm.docList === false;
  const isRestrictedArchive = clausePerm && clausePerm.archive === false;

  const parentClause = React.useMemo(() => {
    if (!clause) return null;
    return findParentClause(iatfData, clause.id);
  }, [clause?.id]);

  const [isAddingDoc, setIsAddingDoc] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [editingDocName, setEditingDocName] = useState<string | null>(null);
  const [editedDocValue, setEditedDocValue] = useState('');
  const [docToDelete, setDocToDelete] = useState<string | null>(null);

  const [isEditingInterpretation, setIsEditingInterpretation] = useState(false);
  const [editedInterpretation, setEditedInterpretation] = useState('');
  const [subTab, setSubTab] = useState<'calendar' | 'requirements' | 'audit_module' | 'job_setup' | 'in_process_control'>('in_process_control');

  const [selectedRecordToView, setSelectedRecordToView] = useState<any | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [archivedSuccessToast, setArchivedSuccessToast] = useState<string | null>(null);
  const [expandedProcessId, setExpandedProcessId] = useState<string | null>(null);
  const [isBlankTemplatesModalOpen, setIsBlankTemplatesModalOpen] = useState(false);

  // States and handler for dedicated clause notes
  const [clauseNotes, setClauseNotes] = useState('');
  const [notesSavedNotice, setNotesSavedNotice] = useState(false);
  const [dbTick, setDbTick] = useState(0);

  // Sync / load stored notes for the selected clause
  React.useEffect(() => {
    const handleDbMutated = () => {
      setTimeout(() => {
        setDbTick(tick => tick + 1);
      }, 0);
    };
    window.addEventListener('qms-db-mutated', handleDbMutated);
    window.addEventListener('storage', handleDbMutated);
    return () => {
      window.removeEventListener('qms-db-mutated', handleDbMutated);
      window.removeEventListener('storage', handleDbMutated);
    };
  }, []);

  React.useEffect(() => {
    if (clause) {
      if (clause.id === '8.5.1.1') {
        setSubTab('in_process_control');
      } else if (clause.id === '9.2.2.2') {
        setSubTab('audit_module');
      } else if (clause.id === '9.2.2.1') {
        setSubTab('calendar');
      } else if (clause.id === '8.5.1.3') {
        setSubTab('job_setup');
      } else {
        setSubTab('requirements');
      }
      try {
        const savedNotes = localStorage.getItem(`qms_clause_notes_${clause.id}`);
        setClauseNotes(savedNotes || '');
      } catch (err) {
        setClauseNotes('');
      }
    } else {
      setClauseNotes('');
    }
  }, [clause?.id]);

  const handleSaveNotes = () => {
    if (!clause) return;
    try {
      localStorage.setItem(`qms_clause_notes_${clause.id}`, clauseNotes);
      setNotesSavedNotice(true);
      setTimeout(() => setNotesSavedNotice(false), 2000);
    } catch (err) {
      console.error('Failed to save clause notes', err);
    }
  };

  // Non-conformance reporting state
  const [isDeclaringNc, setIsDeclaringNc] = useState(false);
  const [ncDescription, setNcDescription] = useState('');
  const [ncSource, setNcSource] = useState(isRtl ? 'کنترل کیفیت خط تولید (QC)' : 'Line Quality Control (QC)');
  const [ncReporter, setNcReporter] = useState('');
  const [ncTargetDate, setNcTargetDate] = useState('1405/03/30');
  const [ncResponseType, setNcResponseType] = useState<'CAPA' | 'INFO_ONLY'>('CAPA');
  const [ncSuccessToast, setNcSuccessToast] = useState<string | null>(null);

  const handleDeclareNcSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clause || !ncDescription.trim()) return;

    try {
      const stored = localStorage.getItem('qmsdb_v3_nc_items');
      let list = [];
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            list = parsed.filter(item => item && typeof item === 'object');
          }
        } catch (parseErr) {
          console.error('Failed parsing qmsdb_v3_nc_items from localStorage:', parseErr);
        }
      }
      
      const newNc = {
        id: `NC-2026-${(list.length + 1).toString().padStart(3, '0')}`,
        clauseId: clause.id,
        clauseNumber: clause.number,
        clauseTitle: clause.title,
        description: ncDescription.trim(),
        declaredAt: getJalaliDate(), // Real dynamic Persian date
        source: ncSource,
        reporter: ncReporter || (isRtl ? 'کارشناس واحد' : 'Supervisor'),
        targetDate: ncTargetDate,
        status: 'NEW' as const,
        responseType: ncResponseType
      };

      const updated = [newNc, ...list];
      localStorage.setItem('qmsdb_v3_nc_items', JSON.stringify(updated));
      
      // Toast notice
      setNcSuccessToast(newNc.id);
      
      // Reset states
      setIsDeclaringNc(false);
      setNcDescription('');
      setNcReporter('');
      setNcResponseType('CAPA');

      // Auto-hide toast after 6 seconds
      setTimeout(() => {
        setNcSuccessToast(null);
      }, 6000);
      
    } catch (err) {
      console.error('Failed declaring NC:', err);
    }
  };



  // Find processes linked to this standard clause in the Process-Requirements Matrix
  const matchedProcesses = React.useMemo(() => {
    if (!clause) return [];
    try {
      let turtleItems: any[] = [];
      const dbDocs = QmsDatabase.selectAll(QmsDatabase.TABLES.DOCUMENTS);
      const processesDoc = dbDocs['شناسنامه فرآیندها (Process Cards - Turtle)'] || 
                           dbDocs['شناسنامه فرآیندها'] || 
                           dbDocs['لاک‌پشتی فرایندها (Turtle Diagrams)'];
      
      if (Array.isArray(processesDoc) && processesDoc.length > 0) {
        turtleItems = processesDoc;
      } else {
        const sourceKeys = [
          'iatf_draft_items_شناسنامه فرآیندها (Process Cards - Turtle)',
          'iatf_draft_items_شناسنامه فرآیندها',
          'iatf_draft_items_لاک‌پشتی فرایندها (Turtle Diagrams)'
        ];
        for (const key of sourceKeys) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              turtleItems = parsed;
              break;
            }
          }
        }
      }

      // Load manual clause overrides to align exactly with the Process-Requirements Matrix
      let manualMappings: Record<string, string[]> = {};
      try {
        const dbMappings = QmsDatabase.selectAll(QmsDatabase.TABLES.PROCESS_MAPPINGS);
        if (dbMappings && Object.keys(dbMappings).length > 0) {
          manualMappings = dbMappings;
        } else {
          const rawMappings = localStorage.getItem('iatf_manual_clause_mappings');
          if (rawMappings) {
            manualMappings = JSON.parse(rawMappings);
          }
        }
      } catch (e) {
        console.warn('Error fetching manual mappings in ClauseDetail:', e);
      }

      // Load process-risk clauses mappings for the hybrid FMEA system
      let riskAndOpportunityMappings: Record<string, string[]> = {};
      try {
        const rawMapping = localStorage.getItem('process_risk_clauses_matrix');
        if (rawMapping) {
          riskAndOpportunityMappings = JSON.parse(rawMapping);
        } else {
          const dbMappings = QmsDatabase.selectAll(QmsDatabase.TABLES.PROCESS_MAPPINGS);
          if (dbMappings && dbMappings.risk_clauses_mapping) {
            riskAndOpportunityMappings = dbMappings.risk_clauses_mapping;
          }
        }
      } catch (e) {
        console.warn('Error fetching risk mappings in ClauseDetail:', e);
      }

      // Filter processes that are associated with the current clause in either map or base clauseId
      return turtleItems.filter(proc => {
        const procNameClean = (proc.field1 || '').trim();
        const procIdClean = (proc.id || '').trim();

        // 1. Check in Risk & Opportunity mappings (Hybrid structure) - HIGHEST PRIORITY for 6.1 and sub-clauses
        const riskClauses = riskAndOpportunityMappings[procIdClean] || riskAndOpportunityMappings[procNameClean];
        if (riskClauses && Array.isArray(riskClauses) && riskClauses.includes(clause.id)) {
          return true;
        }

        // 2. Check in standard/manual mappings
        const manualClauses = manualMappings[procIdClean] || manualMappings[procNameClean];
        if (manualClauses && Array.isArray(manualClauses) && manualClauses.includes(clause.id)) {
          return true;
        }
        
        // 3. Fallback to standard base clauseId associated in turtle definition
        const procClauseExpr = proc.clauseId || '4.4';
        return isClauseAssociated(clause.id, procClauseExpr);
      });
    } catch (e) {
      console.warn('Error fetching matched processes in ClauseDetail:', e);
      return [];
    }
  }, [clause]);

  const handleArchiveClick = (docName: string) => {
    if (onArchiveDocument && clause) {
      onArchiveDocument(clause.id, docName);
      setArchivedSuccessToast(docName.replace(/\s*\(ارجاع به بند.*\)/, '').trim());
      setTimeout(() => setArchivedSuccessToast(null), 3500);
    }
  };

  // Sync editedInterpretation whenever chosen clause updates
  React.useEffect(() => {
    if (clause) {
      setEditedInterpretation(clause.interpretation || '');
    }
    setIsEditingInterpretation(false);
  }, [clause?.id, clause?.interpretation]);

  // Find any CSR items mapping to the current IATF clause ID
  const matchedCsrs = clause 
    ? csrComparisons.filter(c => c.mappedIatfClauseId === clause.id)
    : [];

  // Find any indicators mapping to the current IATF clause ID (except clause 4.4 and its children)
  const matchedIndicators = clause && clause.id !== '4.4' && !clause.id.startsWith('4.4.')
    ? indicators.filter(ind => ind.clauseId === clause.id || clause.id === ind.clauseId)
    : [];

  return (
    <>
      {!clause ? (
        <div 
          className="h-full flex flex-col items-center justify-center text-[#444] gap-4 py-20" 
          dir={isRtl ? "rtl" : "ltr"}
        >
          <ShieldCheck size={64} className="opacity-10" />
          <p className={`text-sm sm:text-base md:text-lg text-center text-slate-500 ${isRtl ? "font-sans font-medium" : "font-serif italic"}`}>
            {t.unselectedClauseHelp}
          </p>
        </div>
      ) : isRestrictedView ? (
        <div className="max-w-xl mx-auto py-16 text-center space-y-6 bg-[#0E0E11] border border-red-500/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden" dir={isRtl ? "rtl" : "ltr"}>
          <div className="absolute inset-0 bg-gradient-to-b from-red-500/5 to-transparent opacity-60 pointer-events-none" />
          <div className="inline-flex p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl shadow-inner">
            <Lock size={32} className="animate-pulse" />
          </div>
          <h2 className="text-base sm:text-lg font-black text-white">دسترسی محدود شده است</h2>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
            کاربر گرامی، حساب کاربری شما مجوز مشاهده جزئیات بند استاندارد {clause.number} را ندارد. لطفاً در صورت نیاز با مدیریت سیستم تماس حاصل فرمایید.
          </p>
          <div className="text-[10px] font-mono text-zinc-600">
            CLAUSE: {clause.id.toUpperCase()} • STATUS: RESTRICTED
          </div>
        </div>
      ) : (
        <div
          className="max-w-6xl mx-auto space-y-8 animate-fade-in"
          dir={isRtl ? "rtl" : "ltr"}
        >
          {/* NC Success Toast Alert */}
          {ncSuccessToast && (
            <div className="p-4 bg-green-500/15 border border-green-500/20 text-green-400 rounded-xl text-xs flex justify-between items-center gap-3 animate-fade-in leading-relaxed">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                <strong>
                  {isRtl 
                    ? `⚠️ اعلام عدم انطباق با موفقیت ثبت شد! شناسه پرونده صادر شده: ${ncSuccessToast}` 
                    : `⚠️ Non-conformance registered successfully! Case ID: ${ncSuccessToast}`}
                </strong>
                <span className="text-slate-400 block sm:inline sm:pr-1">
                  {isRtl 
                    ? `(پرونده جهت فرآیند 8D به کارتابل اقدامات اصلاحی در زیربند 10.2.1 منتقل شد)` 
                    : `(Routed to corrective action inbox in section 10.2.1)`}
                </span>
              </div>
              <button onClick={() => setNcSuccessToast(null)} className="hover:text-white text-slate-500 font-bold transition-colors cursor-pointer">
                ✕
              </button>
            </div>
          )}

          <header className={`flex flex-col md:flex-row justify-between items-start gap-4 ${isRtl ? 'text-right' : 'text-left'}`}>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-amber-500 font-bold text-xs tracking-[0.2em] uppercase text-nowrap">
                  CLAUSE • {clause.number}
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                {parentClause && (
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 bg-[#161619] border border-[#2A2A2D]/60 px-2.5 py-0.5 rounded-full">
                    <span className="text-zinc-500 text-[10px] font-bold">{isRtl ? 'بند والد:' : 'Parent:'}</span>
                    <button 
                      type="button"
                      onClick={() => onSelectClauseId && onSelectClauseId(parentClause.id)}
                      className="text-amber-500 hover:text-amber-400 font-bold hover:underline transition-all cursor-pointer bg-transparent border-none p-0 text-[10.5px] font-sans leading-none flex items-center gap-1"
                    >
                      <BookOpen size={10} />
                      <span>{parentClause.number} — {parentClause.title}</span>
                    </button>
                  </div>
                )}
              </div>
              <h1 className={`text-base sm:text-lg md:text-xl text-white leading-tight ${isRtl ? "font-sans font-extrabold" : "font-sans font-semibold"}`}>
                {clause.title}
              </h1>
            </div>
            
            <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start md:self-auto">
              <button
                onClick={() => setIsDeclaringNc(true)}
                className="bg-red-500 hover:bg-red-400 text-black font-extrabold text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-full flex items-center gap-1.5 transition-all shadow-lg hover:shadow-red-500/20 cursor-pointer"
              >
                <AlertTriangle size={13} />
                <span>{isRtl ? '⚠️ اعلام عدم انطباق جدید (NC)' : '⚠️ Declare NC'}</span>
              </button>

              <div className="bg-[#1A1A1D] border border-[#333] px-4 py-2 rounded-full text-[10px] uppercase tracking-widest text-amber-500/80 font-bold">
                Standard: IATF 16949:2016
              </div>
            </div>
          </header>

          {clause.id === '8.5.1.1' && (
            <div className="flex border-b border-[#2D2D31] pb-0.5 gap-2 select-none overflow-x-auto whitespace-nowrap">
              <button
                type="button"
                onClick={() => setSubTab('in_process_control')}
                className={`px-4 py-2 rounded-t-xl text-xs font-black transition-all cursor-pointer border-t border-x ${
                  subTab === 'in_process_control'
                    ? 'bg-[#0E0E11] border-[#2D2D31] text-amber-500 border-b-[#0E0E11] -mb-[1px]'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                🛡️ {isRtl ? 'کنترل‌های حین تولید (AI In-Process Control Checklist)' : 'AI In-Process Control Checklist (Clause 8.5.1.1)'}
              </button>
              <button
                type="button"
                onClick={() => setSubTab('requirements')}
                className={`px-4 py-2 rounded-t-xl text-xs font-black transition-all cursor-pointer border-t border-x ${
                  subTab === 'requirements'
                    ? 'bg-[#0E0E11] border-[#2D2D31] text-amber-500 border-b-[#0E0E11] -mb-[1px]'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                📋 {isRtl ? 'جزئیات بند، الزامات استاندارد و مدارک لازم' : 'Standard Requirements & Documents Checklist'}
              </button>
            </div>
          )}

          {clause.id === '8.5.1.3' && (
            <div className="flex border-b border-[#2D2D31] pb-0.5 gap-2 select-none overflow-x-auto whitespace-nowrap">
              <button
                type="button"
                onClick={() => setSubTab('job_setup')}
                className={`px-4 py-2 rounded-t-xl text-xs font-black transition-all cursor-pointer border-t border-x ${
                  subTab === 'job_setup'
                    ? 'bg-[#0E0E11] border-[#2D2D31] text-amber-500 border-b-[#0E0E11] -mb-[1px]'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                ⚙️ {isRtl ? 'ماژول راه‌اندازی و تنظیمات کار (Job Setup)' : 'Job Setup Module (Clause 8.5.1.3)'}
              </button>
              <button
                type="button"
                onClick={() => setSubTab('requirements')}
                className={`px-4 py-2 rounded-t-xl text-xs font-black transition-all cursor-pointer border-t border-x ${
                  subTab === 'requirements'
                    ? 'bg-[#0E0E11] border-[#2D2D31] text-amber-500 border-b-[#0E0E11] -mb-[1px]'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                📋 {isRtl ? 'جزئیات بند، الزامات استاندارد و مدارک لازم' : 'Standard Requirements & Documents Checklist'}
              </button>
            </div>
          )}

          {clause.id === '9.2.2.1' && (
            <div className="flex border-b border-[#2D2D31] pb-0.5 gap-2 select-none overflow-x-auto whitespace-nowrap">
              <button
                type="button"
                onClick={() => setSubTab('calendar')}
                className={`px-4 py-2 rounded-t-xl text-xs font-black transition-all cursor-pointer border-t border-x ${
                  subTab === 'calendar'
                    ? 'bg-[#0E0E11] border-[#2D2D31] text-amber-500 border-b-[#0E0E11] -mb-[1px]'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                🗓️ {isRtl ? 'تقویم برنامه‌ریزی ممیزی (بند ۹.۲.۲.۱)' : 'Audit Planning Calendar (Clause 9.2.2.1)'}
              </button>
              <button
                type="button"
                onClick={() => setSubTab('requirements')}
                className={`px-4 py-2 rounded-t-xl text-xs font-black transition-all cursor-pointer border-t border-x ${
                  subTab === 'requirements'
                    ? 'bg-[#0E0E11] border-[#2D2D31] text-amber-500 border-b-[#0E0E11] -mb-[1px]'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                📋 {isRtl ? 'جزئیات بند، الزامات استاندارد و مدارک لازم' : 'Standard Requirements & Documents Checklist'}
              </button>
            </div>
          )}

          {clause.id === '9.2.2.2' && (
            <div className="flex border-b border-[#2D2D31] pb-0.5 gap-2 select-none overflow-x-auto whitespace-nowrap">
              <button
                type="button"
                onClick={() => setSubTab('audit_module')}
                className={`px-4 py-2 rounded-t-xl text-xs font-black transition-all cursor-pointer border-t border-x ${
                  subTab === 'audit_module'
                    ? 'bg-[#0E0E11] border-[#2D2D31] text-amber-500 border-b-[#0E0E11] -mb-[1px]'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                🛡️ {isRtl ? 'ماژول جامع ممیزی داخلی سیستم مدیریت کیفیت (بند ۹.۲.۲.۲)' : 'Comprehensive Quality Internal Audit (Clause 9.2.2.2)'}
              </button>
              <button
                type="button"
                onClick={() => setSubTab('requirements')}
                className={`px-4 py-2 rounded-t-xl text-xs font-black transition-all cursor-pointer border-t border-x ${
                  subTab === 'requirements'
                    ? 'bg-[#0E0E11] border-[#2D2D31] text-amber-500 border-b-[#0E0E11] -mb-[1px]'
                    : 'border-transparent text-zinc-400 hover:text-white'
                }`}
              >
                📋 {isRtl ? 'جزئیات بند، الزامات استاندارد و مدارک لازم' : 'Standard Requirements & Documents Checklist'}
              </button>
            </div>
          )}

          {clause.id === '8.5.1.1' && subTab === 'in_process_control' ? (
            <InProcessControlModule lang={lang} onOpenCorrectiveActions={onOpenCorrectiveActions} onPinToDashboard={onPinToDashboard} />
          ) : clause.id === '9.2.2.2' && subTab === 'audit_module' ? (
            <InternalAuditModule 
              lang={lang} 
              currentUser={currentUser}
              onOpenCorrectiveActions={onOpenCorrectiveActions}
              onPinToDashboard={onPinToDashboard}
            />
          ) : clause.id === '9.2.2.1' && subTab === 'calendar' ? (
            <InternalAuditCalendar lang={lang} onPinToDashboard={onPinToDashboard} />
          ) : clause.id === '8.5.1.3' && subTab === 'job_setup' ? (
            <JobSetupModule lang={lang} onPinToDashboard={onPinToDashboard} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left: Text & Interpretation */}
            <div className="lg:col-span-7 space-y-6">
              {matchedCsrs.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Standard Requirement */}
                  <section className="border border-[#2A2A2D] bg-[#0F0F11]/50 rounded-xl p-5 relative overflow-hidden flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-amber-500"></div>
                          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#666]">
                            {t.standardRequirements}
                          </h3>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 bg-[#141417] px-2 py-0.5 rounded border border-white/5">
                          IATF {clause.id}
                        </span>
                      </div>
                      <div className={`text-xs sm:text-sm leading-relaxed text-[#BBB] italic ${isRtl ? 'text-justify' : 'text-left'}`}>
                        "{clause.text}"
                      </div>
                    </div>
                    <div className="absolute top-0 left-0 w-full h-full bg-amber-500/[0.01] pointer-events-none"></div>
                  </section>

                  {/* Parallel Customer Specific Requirements (CSR) */}
                  <section className="border border-amber-500/30 bg-amber-500/[0.02] rounded-xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-[#2A2A2D]/60 pb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles size={13} className="text-amber-500 animate-pulse" />
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
                          {isRtl ? 'الزامات خاص مشتری (CSR موازی)' : 'Parallel Customer-Specific Requirements (CSR)'}
                        </h3>
                      </div>
                      <span className="text-[9px] text-[#777] font-black uppercase tracking-widest">
                        {isRtl ? 'انطباق همگام‌سازی شده' : 'Synchronized Alignment'}
                      </span>
                    </div>

                    <div className="space-y-3 max-h-56 overflow-y-auto custom-scrollbar">
                      {matchedCsrs.map((matchingCsr, index) => (
                        <div key={matchingCsr.customerId} className={`pb-3 ${index !== matchedCsrs.length - 1 ? 'border-b border-[#2A2A2D]/40' : ''}`}>
                          <div className="flex justify-between items-start mb-1.5 gap-2">
                            <span className="text-[11px] font-black text-white leading-tight">
                              {matchingCsr.documentTitle} — {matchingCsr.customerNumber}
                            </span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.3 rounded-full shrink-0 ${
                              matchingCsr.status === "fully_aligned"
                                ? "bg-green-500/10 text-green-400"
                                : matchingCsr.status === "partially_aligned"
                                ? "bg-amber-500/10 text-amber-400"
                                : "bg-red-500/10 text-red-500"
                            }`}>
                              {matchingCsr.alignmentScore}%
                            </span>
                          </div>
                          <p className="text-[11px] text-amber-500/95 leading-relaxed bg-[#0F0F12]/90 border border-amber-500/10 p-2.5 rounded-lg italic">
                            "{matchingCsr.customerText}"
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              ) : (
                <section className="border border-[#2A2A2D] bg-[#0F0F11]/50 rounded-xl p-6 relative overflow-hidden group">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 bg-amber-500"></div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#666]">
                      {t.standardRequirements}
                    </h3>
                  </div>
                  <div className={`text-xs sm:text-sm leading-relaxed text-[#BBB] italic ${isRtl ? 'text-justify' : 'text-left'}`}>
                    "{clause.text}"
                  </div>
                  <div className="absolute top-0 left-0 w-full h-full bg-amber-500/[0.02] pointer-events-none"></div>
                </section>
              )}

              <section className="border border-[#2A2A2D] bg-[#0F0F11]/50 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4 gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-4 bg-amber-500"></div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#666]">
                      {t.expertAnalysis}
                    </h3>
                  </div>
                  {currentUser?.role === 'admin' && !isEditingInterpretation && (
                    <button
                      onClick={() => setIsEditingInterpretation(true)}
                      className="text-amber-500 hover:text-amber-400 text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 transition-all cursor-pointer bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20 hover:border-amber-500/40 select-none"
                    >
                      <Sparkles size={11} className="shrink-0" />
                      <span>{isRtl ? "ویرایش تفسیر" : "Edit Interpretation"}</span>
                    </button>
                  )}
                </div>

                {isEditingInterpretation ? (
                  <div className="space-y-4 animate-fade-in">
                    <textarea
                      value={editedInterpretation}
                      onChange={(e) => setEditedInterpretation(e.target.value)}
                      rows={8}
                      className="w-full bg-[#0A0A0C] border border-amber-500/30 rounded-lg p-3 text-xs sm:text-sm text-slate-200 focus:border-amber-500 outline-none leading-relaxed transition-all font-sans custom-scrollbar"
                      placeholder={isRtl ? "متن تفسیر را در اینجا بنویسید..." : "Write your interpretation here..."}
                    />
                    <div className="flex justify-end gap-2 text-xs">
                      <button
                        onClick={() => {
                          setIsEditingInterpretation(false);
                          setEditedInterpretation(clause.interpretation || '');
                        }}
                        className="text-slate-400 hover:text-white px-3 py-1.5 rounded transition-all cursor-pointer bg-[#1A1A1D] hover:bg-[#252529]"
                      >
                        {isRtl ? "انصراف" : "Cancel"}
                      </button>
                      <button
                        onClick={() => {
                          if (onUpdateInterpretation) {
                            onUpdateInterpretation(clause.id, editedInterpretation);
                          }
                          setIsEditingInterpretation(false);
                        }}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-5 py-1.5 rounded transition-all cursor-pointer shadow-lg shadow-amber-500/10"
                      >
                        {isRtl ? "ذخیره تغییرات" : "Save Changes"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`text-xs sm:text-sm leading-relaxed text-[#BBB] whitespace-pre-line space-y-4 ${isRtl ? 'text-justify' : 'text-left'}`}>
                    {clause.interpretation}
                  </div>
                )}
              </section>

              {/* Dedicated clause notes section */}
              <section className="border border-[#2A2A2D] bg-[#0F0F11]/50 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between gap-2 border-b border-[#2A2A2D]/60 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-amber-500 animate-pulse" />
                    <h3 className="text-xs font-bold uppercase tracking-widest text-[#AAA]">
                      {isRtl ? "یادداشت‌های اختصاصی بند" : "Dedicated Clause Notes"}
                    </h3>
                  </div>
                  {notesSavedNotice && (
                    <span className="text-[10px] text-green-400 font-sans font-bold flex items-center gap-1 animate-fade-in">
                      ● {isRtl ? "تغییرات ذخیره شد" : "Notes saved"}
                    </span>
                  )}
                </div>

                <div className="space-y-3.5">
                  <textarea
                    value={clauseNotes}
                    onChange={(e) => setClauseNotes(e.target.value)}
                    rows={4}
                    className="w-full bg-[#070709] border border-[#2D2D31] hover:border-amber-500/20 focus:border-amber-500/40 rounded-lg p-3 text-xs sm:text-sm text-slate-200 outline-none leading-relaxed transition-all font-sans custom-scrollbar"
                    placeholder={isRtl ? "یادداشت‌ها و نکات مربوط به این بند یا پیاده‌سازی آن را در اینجا یادداشت کنید..." : "Write down implementation notes, audit remarks, or tasks related to this clause here..."}
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>
                      {isRtl ? "کاربر گرامی، این یادداشت‌ها به صورت خودکار و ایمن در مرورگر شما بازیابی و ذخیره می‌شوند." : "Notes are recovered and stored securely on your local device."}
                    </span>
                    <button
                      onClick={handleSaveNotes}
                      className="bg-[#212124] hover:bg-amber-500 hover:text-black text-slate-300 font-bold px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 border border-[#333]/60 hover:border-amber-500/50"
                    >
                      <FileCheck size={13} />
                      <span>{isRtl ? "ثبت یادداشت" : "Save Notes"}</span>
                    </button>
                  </div>
                </div>
              </section>

              {matchedIndicators.length > 0 && (
                <section className="border border-amber-500/15 bg-[#121214] rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#2A2A2D] pb-3">
                    <div className="flex items-center gap-2">
                      <Activity size={15} className="text-amber-500 animate-pulse" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500">
                        {isRtl ? "شاخص‌های عملکردی تراز با این بند" : "Mapped Performance Indicators"}
                      </h3>
                    </div>
                    <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-mono font-bold tracking-widest">
                      {isRtl ? "پایش زنده هدف" : "LIVE TARGET PROGRESS"}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {matchedIndicators.map((ind) => {
                      const lastRecord = ind.records && ind.records.length > 0 ? ind.records[ind.records.length - 1] : null;
                      const activeRecs = ind.records ? ind.records.filter((r: any) => !r.isArchived) : [];
                      const archivedRecs = ind.records ? ind.records.filter((r: any) => r.isArchived) : [];

                      return (
                        <div key={ind.id} className="p-4 bg-[#0A0A0C] rounded-xl border border-[#212124] flex flex-col justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              <h4 className="text-xs font-bold text-white line-clamp-1">{isRtl ? ind.titleFa : ind.titleEn}</h4>
                            </div>
                            <div className="space-y-1 text-[10px] text-slate-400">
                              <div className="flex justify-between">
                                <span>{isRtl ? "هدف توافقی سازمان:" : "Organizational target:"}</span>
                                <strong className="text-white font-mono">{ind.target} {ind.unit}</strong>
                              </div>
                              {lastRecord && (
                                <div className="flex justify-between">
                                  <span>{isRtl ? "آخرین مقدار بازرسی:" : "Latest field reading:"}</span>
                                  <strong className="text-amber-400 font-mono">{lastRecord.value} {ind.unit} ({lastRecord.period})</strong>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[9px] border-t border-[#1C1C1F] pt-2.5 mt-1">
                            <span className="text-[#666]">
                              {isRtl 
                                ? `${archivedRecs.length} آرشیو • ${activeRecs.length} جاری`
                                : `${archivedRecs.length} arch. • ${activeRecs.length} active`}
                            </span>
                            {onSelectIndicatorsTab && (
                              <button
                                onClick={onSelectIndicatorsTab}
                                className="text-amber-500 font-bold hover:underline cursor-pointer flex items-center gap-0.5"
                              >
                                <span>{isRtl ? "ویرایش و ترسیم" : "Plot & update"}</span>
                                <span>→</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Related Organizational Processes List (User Requirement 1) */}
              {matchedProcesses && matchedProcesses.length > 0 && (
                <section className="border border-amber-500/20 bg-[#121214] rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#2A2A2D] pb-3">
                    <div className="flex items-center gap-2">
                      <Target size={15} className="text-amber-500 animate-pulse" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500">
                        {isRtl ? "فرآیندهای مرتبط سازمان (ماتریس تعاملات)" : "Related Organizational Processes"}
                      </h3>
                    </div>
                    <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded font-mono font-bold tracking-widest">
                      {isRtl ? "فرآیندها و شناسنامه‌ها" : "PROCESS CARDS & MATRIX"}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {matchedProcesses.map((proc, idx) => {
                      return (
                        <div 
                          key={proc.id || `proc-clause-${idx}`} 
                          className="bg-[#0A0A0C] rounded-xl border border-[#212124] overflow-hidden transition-all hover:border-amber-500/30 p-4 animate-fade-in"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            {/* Process Info (Clicking Name opens process card) */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                                <button
                                  onClick={() => {
                                    const procName = proc.field1 || '';
                                    localStorage.setItem('iatf_filter_شناسنامه فرآیندها (Process Cards - Turtle)', procName);
                                    localStorage.setItem('iatf_filter_شناسنامه فرآیندها', procName);
                                    onDocumentClick('شناسنامه فرآیندها (Process Cards - Turtle)');
                                  }}
                                  className="text-xs sm:text-sm font-extrabold text-white hover:text-amber-400 transition-colors text-right cursor-pointer hover:underline"
                                  title={isRtl ? "کلیک جهت ورود مستقیم به شناسنامه فرآیند" : "Click to view Process Card"}
                                >
                                  {proc.field1 || (isRtl ? "فرآیند بدون نام" : "Unnamed Process")}
                                </button>
                              </div>
                              
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] text-slate-400">
                                <span>
                                  {isRtl ? `نوع فرآیند: ` : `Process Type: `}
                                  <strong className="text-amber-500/80 font-mono">{proc.processType || proc.field2 || 'COPs'}</strong>
                                </span>
                                {proc.clauseId && (
                                  <span className="border-r border-[#222] pr-2 mr-2">
                                    {isRtl ? "بند مرجع: " : "Ref Clause: " }
                                    <strong className="text-slate-300 font-mono">{proc.clauseId}</strong>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              {/* Open Turtle Diagram Process Card */}
                              <button
                                onClick={() => {
                                  const procName = proc.field1 || '';
                                  localStorage.setItem('iatf_filter_شناسنامه فرآیندها (Process Cards - Turtle)', procName);
                                  localStorage.setItem('iatf_filter_شناسنامه فرآیندها', procName);
                                  onDocumentClick('شناسنامه فرآیندها (Process Cards - Turtle)');
                                }}
                                className="bg-[#18181c] hover:bg-[#25252b] border border-[#2d2d34] text-[#aaa] hover:text-white text-[9px] font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                                title={isRtl ? "مشاهده شناسنامه فرآیند (کارت لاک‌پشتی)" : "View Process Card (Turtle)"}
                              >
                                <BookOpen size={11} className="shrink-0 text-blue-400" />
                                <span>{isRtl ? "🐢 شناسنامه فرآیند" : "🐢 Process Card"}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {matchedCsrs.length > 0 && (
                <section className="border border-amber-500/30 bg-[#161618] rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#2A2A2D] pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-4 bg-amber-500 rounded-sm"></div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500">
                        {t.mappedCsr}
                      </h3>
                    </div>
                    <span className="text-[9px] text-[#555] font-black uppercase tracking-widest">
                      {t.concurrentAlignments}
                    </span>
                  </div>

                  <div className="space-y-4 divide-y divide-[#2A2A2D]">
                    {matchedCsrs.map((matchingCsr, index) => (
                      <div key={matchingCsr.customerId} className={`pt-3 ${index === 0 ? 'pt-0' : 'mt-3'}`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Sparkles size={12} className="text-amber-500" />
                            {matchingCsr.documentTitle} — {matchingCsr.customerNumber}
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            matchingCsr.status === "fully_aligned"
                              ? "bg-green-500/10 text-green-400"
                              : matchingCsr.status === "partially_aligned"
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-red-500/10 text-red-500"
                          }`}>
                            {matchingCsr.status === "fully_aligned" 
                              ? t.statusFullyAligned 
                              : matchingCsr.status === "partially_aligned" 
                              ? t.statusPartiallyAligned 
                              : t.statusGapDetected} • {matchingCsr.alignmentScore}% {t.matchScore}
                          </span>
                        </div>
                        <p className={`text-xs text-amber-500/90 italic bg-[#0F0F11]/80 p-3.5 rounded border border-[#2A2A2D]/40 leading-relaxed ${isRtl ? 'text-right' : 'text-left'}`}>
                          "{matchingCsr.customerText}"
                        </p>
                        <div className={`text-xs text-[#999] mt-2 bg-[#0A0A0B]/40 p-3.5 rounded leading-relaxed border border-[#2A2A2D]/20 ${isRtl ? 'text-justify' : 'text-left'}`}>
                          <strong className="text-[9px] text-[#555] uppercase font-black block mb-1">
                            {t.complianceGuidance}
                          </strong>
                          {matchingCsr.comparisonText}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            {/* Right: Documents Checklist */}
            <section className="lg:col-span-5 border border-amber-500/20 bg-[#121214] rounded-xl overflow-hidden shadow-2xl">
              <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 flex justify-between items-center">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-500">
                  {t.requiredDocs}
                </h3>
                <div className="flex items-center gap-2">
                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => {
                        setIsAddingDoc(prev => !prev);
                        setEditingDocName(null);
                        setNewDocName('');
                      }}
                      className="bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 px-2 py-1 rounded text-[9px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title={isRtl ? "افزودن مدرک جدید" : "Add New Document"}
                    >
                      <Plus size={10} />
                      <span>{isRtl ? "افزودن مدرک" : "Add Doc"}</span>
                    </button>
                  )}
                  <FileCheck size={16} className="text-amber-500/50" />
                </div>
              </div>
              {isRestrictedDocList ? (
                <div className="p-8 text-center bg-red-500/5 py-12 space-y-3">
                  <div className="inline-flex p-3 bg-red-500/10 text-red-500 rounded-xl">
                    <Lock size={18} />
                  </div>
                  <h4 className="text-xs font-bold text-white">لیست مدارک مسدود شده است</h4>
                  <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xs mx-auto">
                    حساب کاربری شما مجوز مشاهده و مدیریت مدارک و اسناد این بند استاندارد را ندارد.
                  </p>
                </div>
              ) : (
                <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto custom-scrollbar">
                  {isAddingDoc && (
                    <div className="bg-[#18181B] border border-amber-500/30 p-3 rounded-lg space-y-2 mb-2 animate-fade-in">
                    <input
                      type="text"
                      value={newDocName}
                      onChange={(e) => setNewDocName(e.target.value)}
                      placeholder={isRtl ? "نام جدید مدرک را وارد کنید..." : "Enter document name..."}
                      className="w-full bg-[#09090B] border border-[#2D2D30] text-xs text-white p-2 rounded focus:border-amber-500 outline-none"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => setIsAddingDoc(false)}
                        className="text-[9px] text-slate-400 hover:text-white px-2 py-1 cursor-pointer"
                      >
                        {isRtl ? "انصراف" : "Cancel"}
                      </button>
                      <button
                        onClick={() => {
                          if (newDocName.trim() && onAddClauseDocument) {
                            onAddClauseDocument(clause.id, newDocName.trim());
                            setNewDocName('');
                            setIsAddingDoc(false);
                          }
                        }}
                        className="text-[9px] bg-amber-500 text-black px-2.5 py-1 rounded font-bold hover:bg-amber-400 transition-colors cursor-pointer"
                      >
                        {isRtl ? "ذخیره" : "Save"}
                      </button>
                    </div>
                  </div>
                )}

                {clause.documents.map((doc, i) => {
                  const cleanDocName = doc.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
                  const dbRow = QmsDatabase.selectRow<any>('document_control_table', cleanDocName);
                  
                  let docCode = dbRow ? dbRow.code : '';
                  let docReleaseDate = dbRow ? dbRow.releaseDate : '';
                  
                  if (!docCode) {
                    const normTitle = cleanDocName.toLowerCase();
                    let initialType = 'procedure';
                    if (normTitle.includes('روش اجرایی') || normTitle.includes('رویه')) initialType = 'procedure';
                    else if (normTitle.includes('دستورالعمل')) initialType = 'work_instruction';
                    else if (normTitle.includes('فرم')) initialType = 'form';
                    else if (normTitle.includes('لیست') || normTitle.includes('ماتریس')) initialType = 'list_matrix';
                    else if (normTitle.includes('نظام‌نامه')) initialType = 'manual';
                    else initialType = 'record';

                    let prefix = 'QMS-REC';
                    if (initialType === 'procedure') prefix = 'QMS-PR';
                    else if (initialType === 'work_instruction') prefix = 'QMS-WI';
                    else if (initialType === 'form') prefix = 'QMS-FM';
                    else if (initialType === 'list_matrix') prefix = 'QMS-LS';
                    else if (initialType === 'manual') prefix = 'QMS-QM';

                    const sequence = (Math.abs(cleanDocName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 45 + 1)
                      .toString()
                      .padStart(2, '0');
                    docCode = `${prefix}-${clause.id.replace(/\./g, '_')}-${sequence}`;
                    docReleaseDate = '1405/03/01';
                  }

                  return (
                    <div
                      key={`${clause.id}-doc-${i}`}
                      onClick={() => onDocumentClick(doc)}
                      className="group flex items-start gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer border border-transparent hover:border-amber-500/20"
                    >
                      <div className="mt-1 relative flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          readOnly 
                          checked 
                          className="w-4 h-4 rounded border-[#333] bg-[#0A0A0B] text-amber-500 focus:ring-0 focus:ring-offset-0 transition-all appearance-none border checked:bg-amber-500 checked:border-amber-500" 
                        />
                        <div className="absolute text-black font-bold text-[10px] pointer-events-none font-sans">✓</div>
                      </div>
                      <div className="min-w-0 flex-1">
                        {editingDocName === doc ? (
                          <div className="py-1 space-y-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editedDocValue}
                              onChange={(e) => setEditedDocValue(e.target.value)}
                              className="w-full bg-[#09090B] border border-amber-500/50 text-xs text-white p-1.5 rounded focus:ring-0 outline-none"
                            />
                            <div className="flex justify-end gap-1.5">
                              <button
                                onClick={() => setEditingDocName(null)}
                                className="text-[9px] text-slate-400 hover:text-white px-1.5 py-1"
                              >
                                {isRtl ? "انصراف" : "Cancel"}
                              </button>
                              <button
                                onClick={() => {
                                  if (editedDocValue.trim() && onEditClauseDocument) {
                                    onEditClauseDocument(clause.id, doc, editedDocValue.trim());
                                    setEditingDocName(null);
                                  }
                                }}
                                className="text-[9px] bg-amber-500 text-black px-2 py-1 rounded font-bold hover:bg-amber-400 transition-colors"
                              >
                                {isRtl ? "ویرایش" : "Save"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex flex-col gap-1 min-w-0">
                                <span className="text-xs sm:text-sm font-semibold text-white group-hover:text-amber-500 transition-colors block leading-tight">
                                  {(() => {
                                    const cleanDoc = doc.replace(/\s*\(ارجاع به بند.*\)/, '').trim().toLowerCase();
                                    
                                    if (clause.id === '8.5.1.1' && (cleanDoc === 'control plan' || cleanDoc === 'طرح کنترلی (control plan)')) {
                                      return (
                                        <span className="flex items-center gap-1.5 flex-wrap">
                                          <span>{doc}</span>
                                          <span className="text-[10px] text-zinc-400 font-normal normal-case font-mono bg-zinc-800/40 px-1.5 py-0.5 rounded border border-zinc-700/30">
                                            (mass production)
                                          </span>
                                        </span>
                                      );
                                    }
                                    
                                    // General differentiation for multi-clause documents
                                    try {
                                      const flatClauses = flattenIatfClauses(iatfData);
                                      const matchingClauses = flatClauses.filter(c => {
                                        return c.documents && Array.isArray(c.documents) && c.documents.some(d => {
                                          const cleanD = d.replace(/\s*\(ارجاع به بند.*\)/, '').trim().toLowerCase();
                                          const cleanDocTarget = doc.replace(/\s*\(ارجاع به بند.*\)/, '').trim().toLowerCase();
                                          return cleanD === cleanDocTarget || cleanDocTarget.includes(cleanD) || cleanD.includes(cleanDocTarget);
                                        });
                                      });

                                      if (matchingClauses.length > 1) {
                                        return (
                                          <span className="flex flex-col gap-0.5">
                                            <span>{doc}</span>
                                            <span className="text-[10px] text-amber-500/85 font-normal font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
                                              {isRtl ? `(زیربند ${clause.number}: ${clause.title})` : `(Subclause ${clause.number}: ${clause.title})`}
                                            </span>
                                          </span>
                                        );
                                      }
                                    } catch (e) {
                                      // ignore
                                    }

                                    return doc;
                                  })()}
                                </span>
                                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                  <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/25 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                                    {docCode}
                                  </span>
                                  {docReleaseDate && (
                                    <span className="text-[9px] text-[#777] font-mono">
                                      {docReleaseDate}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {currentUser?.role === 'admin' && (
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleArchiveClick(doc);
                                    }}
                                    className="text-slate-400 hover:text-green-400 p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                                    title={isRtl ? "افزودن به سوابق و بایگانی همزمان" : "Archive Snapshot / Add to Records"}
                                  >
                                    <Archive size={11} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingDocName(doc);
                                      setEditedDocValue(doc.replace(/\s*\(ارجاع به بند.*\)/, '').trim());
                                    }}
                                    className="text-slate-400 hover:text-amber-400 p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                                    title={isRtl ? "ویرایش نام مدرک" : "Edit Name"}
                                  >
                                    <Sparkles size={11} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDocToDelete(doc);
                                    }}
                                    className="text-slate-400 hover:text-red-400 p-1 rounded hover:bg-white/5 transition-colors cursor-pointer"
                                    title={isRtl ? "حذف مدرک" : "Delete"}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              )}
                            </div>
                            <p className="text-[9px] text-[#555] uppercase tracking-tighter mt-1">
                              {doc.includes('(ارجاع به بند') 
                                ? (isRtl ? "سند اصلی ردیابی‌شده در بند بالا" : "REFERENCED SYSTEM RECORD")
                                : t.requiredRecord}
                            </p>

                            {(() => {
                              const discrepancyResult = QmsDatabase.checkDocumentDiscrepancies(cleanDocName);
                              if (!discrepancyResult.isOutOfSync) return null;
                              return (
                                <div 
                                  onClick={(e) => e.stopPropagation()} 
                                  className="mt-2.5 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-lg flex flex-col gap-2 relative z-50 animate-pulse hover:animate-none text-right"
                                  dir={isRtl ? "rtl" : "ltr"}
                                >
                                  <div className="flex items-start gap-1.5">
                                    <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                                    <div className="text-[10px] text-[#E4E4E7] leading-relaxed font-sans">
                                      <strong className="block text-amber-400 font-bold mb-1">
                                        {isRtl ? "⚠️ مغایرت در مراجع داده فعال ثبت شده است" : "⚠️ Reference Data Discrepancy Found"}
                                      </strong>
                                      {isRtl ? (
                                        <span>
                                          مقادیر مرجع این سند با دیتابیس همخوانی ندارند. تغییراتی در مستند مبدأ رخ داده است.
                                        </span>
                                      ) : (
                                        <span>
                                          Saved lookup values do not match original source records due to updates in reference tables.
                                        </span>
                                      )}
                                      
                                      <div className="mt-1.5 space-y-1 text-[9px] text-zinc-400 max-h-24 overflow-y-auto pr-1">
                                        {discrepancyResult.details.map((detail, dIdx) => (
                                          <div key={dIdx} className="flex gap-1">
                                            <span>•</span>
                                            <span>{detail}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const ok = QmsDatabase.synchronizeDocument(cleanDocName);
                                      if (ok) {
                                        alert(isRtl ? "همگام‌سازی مراجع با موفقیت انجام شد و اطلاعات سند به‌روز گردید!" : "References synchronized successfully! Document cells updated.");
                                      }
                                    }}
                                    className="text-[9.5px] bg-amber-500 hover:bg-amber-400 text-black font-bold py-1 px-2.5 rounded transition-all flex items-center justify-center gap-1 self-start cursor-pointer hover:shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                                  >
                                    <span>{isRtl ? "تایید و به‌روزرسانی مراجع داده" : "Approve & Update Reference Data"}</span>
                                  </button>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Dynamic linked sections from Risk & Opportunity Management (FMEA) */}
                {matchedProcesses.map((proc, pIdx) => {
                  const procName = proc.field1 || proc.id || '';
                  const linkTitle = isRtl
                    ? `★ مدیریت ریسک و فرصت‌ها (بخش مرتبط با بند ${clause.id} سطر فرآیند «${procName}»)`
                    : `★ Risk & Opportunity FMEA (Clause ${clause.id} - process: "${procName}")`;
                  const linkCode = `QMS-RSK-${clause.id.replace(/\./g, '_')}-${(pIdx+1).toString().padStart(2, '0')}`;
                  
                  return (
                    <div
                      key={`fmea-link-${clause.id}-${pIdx}`}
                      onClick={() => {
                        localStorage.setItem('qms_focused_risk_process', procName);
                        localStorage.setItem('qms_focused_risk_clause', clause.id);
                        onDocumentClick(isRtl ? 'مدیریت ریسک و فرصت‌ها' : 'Risk and Opportunity Management');
                      }}
                      className="group flex items-start gap-4 p-3 rounded-lg bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer border border-amber-500/10 hover:border-amber-500/30"
                    >
                      <div className="mt-1 relative flex items-center justify-center">
                        <span className="w-4 h-4 rounded bg-amber-500/20 border border-amber-500/40 text-amber-500 flex items-center justify-center font-bold text-[10px]">★</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-col gap-1 min-w-0">
                            <span className="text-xs sm:text-sm font-semibold text-amber-400 group-hover:text-amber-300 transition-colors block leading-tight">
                              {linkTitle}
                            </span>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/25 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                                {linkCode}
                              </span>
                              <span className="text-[9px] text-amber-500/60 font-medium">
                                {isRtl ? 'لینک مستقیم مرجع ریسک FMEA' : 'Direct Risk Reference Link'}
                              </span>
                            </div>
                          </div>
                          <div className="text-[10px] text-amber-500 font-black shrink-0">
                            {isRtl ? 'کلیک کنید ←' : 'Click ←'}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              )}

              {/* Action Feedbacks / Toasts inside side column */}
              {archivedSuccessToast && (
                <div className="mx-6 my-2 p-3 bg-green-500/10 border border-green-500/30 text-green-400 rounded-lg text-xs flex items-center gap-2 animate-fade-in leading-relaxed">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
                  <span>
                    {isRtl 
                      ? `سند "${archivedSuccessToast}" به همراه آخرین محتویات به سوابق و شواهد انطباق این بند با موفقیت پیوست شد.` 
                      : `Snapshot of "${archivedSuccessToast}" was registered to this clause's compliance records.`}
                  </span>
                </div>
              )}

              {/* SECTION B: Archived Records & Compliance Evidence */}
              <div className="p-4 bg-green-500/10 border-t border-b border-green-500/20 flex justify-between items-center">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-green-400">
                  {isRtl ? "سوابق ثبت شده و شواهد انطباق آرشیو شده" : "Archived Records & compliance evidence"}
                </h3>
                <span className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded font-mono font-bold">
                  {records.filter(r => r.clauseId === clause.id).length} {isRtl ? "سند" : "recs"}
                </span>
              </div>



              {isRestrictedArchive ? (
                <div className="p-8 text-center bg-red-500/5 py-12 space-y-3">
                  <div className="inline-flex p-3 bg-red-500/10 text-red-500 rounded-xl">
                    <Lock size={18} />
                  </div>
                  <h4 className="text-xs font-bold text-white">بایگانی مدارک مسدود شده است</h4>
                  <p className="text-[11px] text-zinc-400 leading-relaxed max-w-xs mx-auto">
                    حساب کاربری شما مجوز مشاهده و دسترسی به بایگانی و سوابق آرشیو شده این بند را ندارد.
                  </p>
                </div>
              ) : (
                <div className="p-6 space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar bg-black/20 divide-y divide-[#202022]">
                  {records.filter(r => r.clauseId === clause.id).length === 0 ? (
                    <div className="text-center py-6 text-slate-500 italic text-[11px]">
                      {isRtl 
                        ? "هیچ سابقه یا شواهد انطباقی برای این بند بایگانی نشده است. برای ایجاد بایگانی، روی آیکون سبز رنگ بایگانی در کنار مستندات مقتضی کلیک کنید." 
                        : "No records have been archived for this clause yet. Use the green archive icon next to documents."}
                    </div>
                  ) : (
                    records.filter(r => r.clauseId === clause.id).map((rec, rIdx) => (
                      <div 
                        key={rec.id} 
                        className={`group/rec flex items-start justify-between gap-3 pt-3 ${rIdx === 0 ? 'pt-0' : ''}`}
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                            <span className="text-xs font-bold text-white group-hover/rec:text-green-400 transition-colors block truncate leading-tight" title={rec.documentName}>
                              {rec.documentName}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[8px] bg-green-500/15 text-green-400 border border-green-500/20 px-1 py-0.2 rounded font-mono">
                              {rec.code}
                            </span>
                            <span className="text-[8px] text-slate-400">
                              {isRtl ? `ویرایش ${rec.revision}` : `Rev ${rec.revision}`}
                            </span>
                            <span className="text-[8px] text-[#555] font-mono leading-none">
                              {rec.archivedAt}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {(rec.isCumulativeAuditFile || rec.savedAuditProgram || (rec.items && (rec.items.programs || rec.items.savedAuditProgram))) && (
                            <button
                              onClick={() => {
                                if (confirm(isRtl 
                                  ? 'آیا از بازیابی و بارگذاری مجدد این سابقه ممیزی اطمینان دارید؟ داده‌های فعلی بخش ممیزی بازنویسی خواهند شد.' 
                                  : 'Are you sure you want to restore and reload this audit record? Current audit module data will be overwritten.'
                                )) {
                                  try {
                                    let program = null;
                                    let checklist = [];
                                    let ncs = [];
                                    let ofis = [];
                                    let reports = [];

                                    // Support direct structure
                                    if (rec.savedAuditProgram) {
                                      program = rec.savedAuditProgram;
                                      checklist = rec.savedAuditChecklist || [];
                                      ncs = rec.savedNcs || [];
                                      ofis = rec.savedOfis || [];
                                      reports = rec.savedReports || [];
                                    } 
                                    // Support items structure
                                    else if (rec.items) {
                                      const payload = rec.items;
                                      program = payload.savedAuditProgram || (payload.programs && payload.programs[0]) || null;
                                      checklist = payload.savedAuditChecklist || payload.checklists || [];
                                      ncs = payload.savedNcs || payload.ncs || [];
                                      ofis = payload.savedOfis || payload.ofis || [];
                                      reports = payload.savedReports || payload.reports || [];
                                    }

                                    if (!program) {
                                      alert(isRtl ? 'برنامه ممیزی معتبری در این سابقه یافت نشد.' : 'No valid audit program found in this record.');
                                      return;
                                    }

                                    // Dispatch restore-audit-session custom event
                                    const payload = {
                                      program,
                                      checklist,
                                      ncs,
                                      ofis,
                                      reports
                                    };
                                    
                                    window.dispatchEvent(new CustomEvent('restore-audit-session', { detail: payload }));
                                    
                                    alert(isRtl ? 'سابقه ممیزی با موفقیت بازیابی و بارگذاری مجدد شد!' : 'Audit record successfully restored and reloaded!');
                                  } catch (err) {
                                    console.error(err);
                                    alert(isRtl ? 'خطا در بازیابی سابقه ممیزی.' : 'Error restoring audit record.');
                                  }
                                }
                              }}
                              className="text-slate-400 hover:text-amber-400 p-1.5 rounded hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-amber-500/20"
                              title={isRtl ? "بازیابی و بارگذاری مجدد اطلاعات ممیزی" : "Restore / Reload Audit Record State"}
                            >
                              <RefreshCw size={12} />
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedRecordToView(rec)}
                            className="text-slate-400 hover:text-green-400 p-1.5 rounded hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-green-500/20"
                            title={isRtl ? "مشاهده و بازخوانی اطلاعات سابقه" : "Inspect Archived Record"}
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            onClick={() => setRecordToDelete(rec.id)}
                            className="text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-white/5 transition-all cursor-pointer border border-transparent hover:border-red-500/20"
                            title={isRtl ? "حذف همیشگی سابقه" : "Delete compliance evidence"}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              <div className="p-4 border-t border-[#2A2A2D] bg-[#0A0A0B]">
                <button 
                  onClick={() => setIsBlankTemplatesModalOpen(true)}
                  className="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-black font-bold py-3 rounded text-[10px] uppercase tracking-widest transition-all shadow-lg hover:shadow-amber-500/20 cursor-pointer"
                >
                  {t.getBlankTemplates}
                </button>
              </div>
            </section>
          </div>
          )}

          {clause.id === '4.3.2' && setCsrComparisons && setCsrDocuments && (
            <div className="border border-amber-500/20 bg-[#121214] rounded-xl p-6 shadow-2xl animate-fade-in space-y-4">
              <div className="flex items-center gap-2 border-b border-[#2A2A2D] pb-3 mb-4">
                <ArrowLeftRight className="text-amber-500" size={18} />
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-amber-500">
                  {isRtl ? 'سامانه همگام‌سازی و تحلیل انطباق الزامات خاص مشتری (CSR)' : 'Customer-Specific Requirements (CSR) Compliance Platform'}
                </h3>
              </div>
              <CsrManager
                onSelectClauseId={onSelectClauseId || (() => {})}
                comparisons={csrComparisons}
                setComparisons={setCsrComparisons}
                documents={csrDocuments}
                setDocuments={setCsrDocuments}
                lang={lang}
                onPinToDashboard={onPinToDashboard}
              />
            </div>
          )}
        </div>
      )}
      
      {/* State-based custom confirm modal */}
      {docToDelete && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setDocToDelete(null)}>
          <div className="bg-[#0C0C0E] border-2 border-red-500/30 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-red-500">
              <Trash2 size={24} />
              <h3 className="text-sm font-black text-white">
                {isRtl ? 'تایید حذف سند / مدرک' : 'Confirm Document Deletion'}
              </h3>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              {isRtl 
                ? `آیا از حذف مدرک "${docToDelete.replace(/\s*\(ارجاع به بند.*\)/, '').trim()}" اطمینان دارید؟ با حذف این سند، این عنوان از فهرست اسناد بند جاری سیستم خارج خواهد شد.` 
                : `Are you sure you want to permanently delete "${docToDelete.replace(/\s*\(ارجاع به بند.*\)/, '').trim()}" from this clause?`}
            </p>
            
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  if (onDeleteClauseDocument && clause) {
                    onDeleteClauseDocument(clause.id, docToDelete);
                  }
                  setDocToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-black bg-red-500 hover:bg-red-400 rounded transition-colors cursor-pointer"
              >
                {isRtl ? 'حذف نهایی' : 'Delete Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation modal for deleting records */}
      {recordToDelete && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={() => setRecordToDelete(null)}>
          <div className="bg-[#0C0C0E] border-2 border-red-500/30 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-red-500">
              <Trash2 size={24} />
              <h3 className="text-sm font-black text-white">
                {isRtl ? 'حذف دائمی برگه سابقه ممیزی' : 'Confirm Record Deletion'}
              </h3>
            </div>
            
            <p className="text-xs text-slate-200 leading-relaxed">
              {isRtl 
                ? 'آیا از حذف برگ این سابقه اطمینان دارید؟ تغییرات بلافاصله از پایگاه داده سوابق و شواهد انطباق ممیزی سازمان حذف می‌شوند و غیر قابل بازگشت است.' 
                : 'Are you sure you want to permanently delete this archived snapshot evidence? This transaction cannot be undone.'}
            </p>
            
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-[#1A1A1D] hover:bg-[#202024] rounded transition-colors cursor-pointer"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  if (onDeleteRecord) {
                    onDeleteRecord(recordToDelete);
                  }
                  setRecordToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-black bg-red-500 hover:bg-red-400 rounded transition-colors cursor-pointer"
              >
                {isRtl ? 'حذف سابقه' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record snapshots reader/viewer modal */}
      <RecordViewerModal 
        isOpen={!!selectedRecordToView}
        onClose={() => setSelectedRecordToView(null)}
        record={selectedRecordToView}
        lang={lang}
      />

      {/* ⚠️ Non-Conformance Declaration Modal */}
      {isDeclaringNc && clause && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in text-right" onClick={() => setIsDeclaringNc(false)}>
          <div className="bg-[#0C0C0E] border-2 border-red-500/30 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle size={20} className="animate-pulse" />
              <h3 className="text-sm font-black text-white">
                {isRtl ? 'اعلام رسمی عدم انطباق جدید (NC)' : 'Report Non-Conformance'}
              </h3>
            </div>
            
            <p className="text-[11px] text-slate-400 leading-normal">
              {isRtl 
                ? `در حال ثبت عدم انطباق برای بند ممیزی "${clause.number} - ${clause.title}". اطلاعات ثبت شده بلافاصله به کارتابل ۸دی در بند ۱۰.۲.۱ متصل خواهند شد.` 
                : `Adding deviation details under clause ${clause.number}. Action routes automatically to 10.2.1 portal.`}
            </p>

            <form onSubmit={handleDeclareNcSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-zinc-[#888] text-[10px] block font-bold">{isRtl ? 'شرح عدم انطباق و عیوب مشاهده شده (الزامی):' : 'NC Details (Required):'}</label>
                <textarea
                  required
                  value={ncDescription}
                  onChange={(e) => setNcDescription(e.target.value)}
                  placeholder={isRtl ? 'مثال: مغایرت در بوش فولادی ایستگاه پرسکاری به علت شکستگی سنبه...' : 'Explain the quality deviation details...'}
                  rows={4}
                  className="w-full bg-[#131316] border border-[#2D2D31] text-xs text-white p-2.5 rounded-lg outline-none focus:border-red-500 custom-scrollbar"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-zinc-[888] text-[10px] block font-bold">{isRtl ? 'منبع اعلام:' : 'Source:'}</label>
                  <select
                    value={ncSource}
                    onChange={(e) => setNcSource(e.target.value)}
                    className="w-full bg-[#131316] border border-[#2D2D31] text-xs text-[#E4E4E5] p-2 rounded-lg outline-none"
                  >
                    <option value={isRtl ? "کنترل کیفیت خط تولید (QC)" : "Production Quality (QC)"}>
                      {isRtl ? "کنترل کیفیت خط تولید (QC)" : "Production Quality (QC)"}
                    </option>
                    <option value={isRtl ? "ممیزی داخلی فرآیند" : "Internal Process Audit"}>
                      {isRtl ? "ممیزی داخلی فرآیند" : "Internal Process Audit"}
                    </option>
                    <option value={isRtl ? "شکایات و بازخورد مشتری" : "Customer Claims"}>
                      {isRtl ? "شکایات و بازخورد مشتری" : "Customer Claims"}
                    </option>
                    <option value={isRtl ? "واحد مهندسی و ابزارها" : "Engineering & Tooling"}>
                      {isRtl ? "واحد مهندسی و ابزارها" : "Engineering & Tooling"}
                    </option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-zinc-[#888] text-[10px] block font-bold">{isRtl ? 'سررسید تخمینی اقدام:' : 'Target Date:'}</label>
                  <input
                    type="text"
                    required
                    value={ncTargetDate}
                    onChange={(e) => setNcTargetDate(e.target.value)}
                    placeholder="1405/03/30"
                    className="w-full bg-[#131316] border border-[#2D2D31] text-xs text-white p-2 rounded-lg outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-zinc-[#888] text-[10px] block font-bold">{isRtl ? 'نام گزارش‌دهنده / بازرس:' : 'Reporter / Inspector:'}</label>
                <input
                  type="text"
                  value={ncReporter}
                  onChange={(e) => setNcReporter(e.target.value)}
                  placeholder={isRtl ? 'مثال: مهندس رحیمی' : 'Inspector name'}
                  className="w-full bg-[#131316] border border-[#2D2D31] text-xs text-white p-2 rounded-lg outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[#888] text-[10px] block font-bold">
                  {isRtl ? 'نوع گزارش عدم انطباق:' : 'Response Action Type:'}
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setNcResponseType('CAPA')}
                    className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      ncResponseType === 'CAPA'
                        ? 'border-red-500 bg-red-950/20 text-red-400 font-black'
                        : 'border-[#2D2D31] bg-[#131316] text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>{isRtl ? 'نیاز به تعریف اقدام اصلاحی دارد' : 'Requires CAPA'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNcResponseType('INFO_ONLY')}
                    className={`px-3 py-2 rounded-lg text-[10px] font-bold border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      ncResponseType === 'INFO_ONLY'
                        ? 'border-indigo-500 bg-indigo-950/20 text-indigo-400 font-black'
                        : 'border-[#2D2D31] bg-[#131316] text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>{isRtl ? 'صرفا جهت اطلاع' : 'For Info Only'}</span>
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3">
                <button
                  type="button"
                  onClick={() => setIsDeclaringNc(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  {isRtl ? 'انصراف' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-black bg-red-500 hover:bg-red-400 rounded-lg transition-all cursor-pointer shadow-md shadow-red-500/10"
                >
                  {isRtl ? 'ثبت و ارسال به کارتابل دیسیپلین' : 'Register NC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BlankTemplatesModal
        isOpen={isBlankTemplatesModalOpen}
        onClose={() => setIsBlankTemplatesModalOpen(false)}
        clause={clause}
        lang={lang}
        onAddClauseDocument={onAddClauseDocument}
      />
    </>
  );
}
