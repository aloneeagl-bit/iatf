/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Briefcase, Plus, Edit2, Trash2, Link2, ExternalLink, 
  Sliders, Database, FileText, CheckCircle2, RefreshCw, Grid, X,
  Search, ChevronDown
} from 'lucide-react';
import { iatfData, IATFClause } from '../data/iatfData';
import { documentTemplates } from '../data/documentTemplates';
import { flattenIatfClauses, isClauseAssociated, generateProcessRequirementsMatrix } from '../lib/matrixGenerator';
import { QmsDatabase } from '../lib/qmsDatabase';

const STRATEGIC_CLAUSE_IDS = ['4.1', '4.2', '4.3', '4.4', '5.1.1', '6.1', '6.2.1', '6.2.2', '9.3'];

const getDocRowsFromDb = (docName: string): any[] => {
  if (!docName) return [];
  try {
    const dbDocs = QmsDatabase.selectAll('documents_table') || {};
    const val = dbDocs[docName] || QmsDatabase.selectRow<any>('documents_table', docName);
    if (val) {
      if (Array.isArray(val)) {
        return val;
      }
      if (typeof val === 'object') {
        if (Array.isArray(val.items)) {
          return val.items;
        }
        if (Array.isArray(val.sections)) {
          return val.sections.flatMap((s: any) => s.items || []);
        }
      }
    }
  } catch {}
  return [];
};

const getClauseNumberForDocument = (docName: string): string => {
  // 1. Search in QmsDatabase's clause_links_table - EXACT match first
  try {
    const clauseLinks = QmsDatabase.selectAll('clause_links_table') || {};
    for (const [clauseId, docs] of Object.entries(clauseLinks)) {
      if (Array.isArray(docs)) {
        const match = docs.some(d => {
          const cleanD = d.replace(/\s*\(ارجاع به بند.*\)/, '').trim().toLowerCase();
          const cleanDoc = docName.replace(/\s*\(ارجاع به بند.*\)/, '').trim().toLowerCase();
          return cleanD === cleanDoc;
        });
        if (match) {
          return clauseId;
        }
      }
    }
  } catch (e) {
    // ignore
  }

  // 2. Search in flattened iatfData from data/iatfData - EXACT match first
  try {
    const allClauses = flattenIatfClauses(iatfData);
    for (const c of allClauses) {
      if (c.documents && Array.isArray(c.documents)) {
        const match = c.documents.some(d => {
          const cleanD = d.replace(/\s*\(ارجاع به بند.*\)/, '').trim().toLowerCase();
          const cleanDoc = docName.replace(/\s*\(ارجاع به بند.*\)/, '').trim().toLowerCase();
          return cleanD === cleanDoc;
        });
        if (match) {
          return c.number;
        }
      }
    }
  } catch (e) {
    // ignore
  }

  // Fallbacks by naming
  const lower = docName.toLowerCase();
  if (lower.includes('سوات') || lower.includes('swot') || lower.includes('استراتژیک')) return '4.1';
  if (lower.includes('ذینفعان') || lower.includes('stakeholder') || lower.includes('parties')) return '4.2';
  if (lower.includes('دامنه') || lower.includes('scope')) return '4.3';
  if (lower.includes('فرآیند') || lower.includes('process') || lower.includes('turtle') || lower.includes('لاک پشت')) return '4.4';
  if (lower.includes('خط مشی') || lower.includes('policy') || lower.includes('رهبری')) return '5.1.1';
  if (lower.includes('ریسک') || lower.includes('fmea') || lower.includes('risk') || lower.includes('فرصت')) return '6.1';
  if (lower.includes('اهداف') || lower.includes('objective')) return '6.2.1';
  if (lower.includes('ممیزی داخلی') || lower.includes('audit')) return '9.2';
  if (lower.includes('بازنگری مدیریت') || lower.includes('review')) return '9.3';
  if (lower.includes('اقدام اصلاحی') || lower.includes('عدم انطباق') || lower.includes('capa')) return '10.2';
  return '';
};

const STRATEGIC_CLAUSE_TITLES: Record<string, { fa: string; en: string }> = {
  '4.1': { fa: 'بافت و محتوای سازمان (SWOT)', en: 'Context of Org (SWOT)' },
  '4.2': { fa: 'نیازها و انتظارات ذینفعان', en: 'Needs of Interested Parties' },
  '4.3': { fa: 'تعیین دامنه کاربرد QMS', en: 'Scope of QMS' },
  '4.4': { fa: 'فرآیندهای سازمان (بند ۴.۴)', en: 'QMS Processes (4.4)' },
  '5.1.1': { fa: 'رهبری و تعهد مدیریت', en: 'Leadership & Commitment' },
  '6.1': { fa: 'ریسک‌ها و فرصت‌های فرآیند', en: 'Risks & Opportunities (6.1)' },
  '6.2.1': { fa: 'اهداف کیفی و کلان', en: 'Quality Objectives (6.2.1)' },
  '6.2.2': { fa: 'برنامه‌های دستیابی به اهداف', en: 'Planning Objectives (6.2.2)' },
  '9.3': { fa: 'ورودی/خروجی بازنگری مدیریت', en: 'Management Review (9.3)' }
};

interface StrategicItem {
  id: string;
  title: string;
  clauseId: string;
  linkedDoc?: string;
  isCustom?: boolean;
}

interface StrategicManagementProps {
  lang: 'fa' | 'en';
  onOpenDocument: (docTitle: string) => void;
  onSelectClauseId?: (clauseId: string) => void;
  onNotifyDbModified?: () => void;
  currentUser?: any;
  proposals?: any[];
  onProposeChange?: (module: string, type: 'CREATE' | 'UPDATE' | 'DELETE', targetId: string, targetName: string, proposedData: any) => void;
  onPinToDashboard?: () => void;
}

export default function StrategicManagement({ 
  lang, 
  onOpenDocument, 
  onSelectClauseId, 
  onNotifyDbModified,
  currentUser,
  proposals = [],
  onProposeChange,
  onPinToDashboard
}: StrategicManagementProps) {
  const isRtl = lang === 'fa';

  // --- PERSISTENT STATE FOR ITEMS ---
  const [itemsState, setItemsState] = useState<StrategicItem[]>([]);

  // Effect to load items from database on mount or when tenant changes
  useEffect(() => {
    try {
      const dbSaved = QmsDatabase.selectAll<any>(QmsDatabase.TABLES.STRATEGIC_ITEMS);
      const rows = dbSaved ? Object.values(dbSaved) : [];
      
      if (rows && rows.length > 0) {
        setItemsState(rows);
      } else {
        setItemsState([]);
      }
    } catch (e) {
      console.error('Failed loading strategic items:', e);
    }
  }, [isRtl]);

  // Save changes to database
  useEffect(() => {
    if (itemsState.length === 0) return;
    
    const recordsMap: Record<string, StrategicItem> = {};
    itemsState.forEach(i => {
      recordsMap[i.id] = i;
    });
    QmsDatabase.writeAll(QmsDatabase.TABLES.STRATEGIC_ITEMS, recordsMap);

    window.dispatchEvent(new Event('qms_db_updated'));
    if (onNotifyDbModified) onNotifyDbModified();
  }, [itemsState]);

  // Merge proposals for submenu items
  const items = useMemo(() => {
    if (!currentUser || currentUser.role === 'admin') return itemsState;
    const list = [...itemsState];
    const activeProposals = proposals.filter(p => p.status === 'pending' && p.module === 'strategic_management_items');
    
    activeProposals.forEach(p => {
      if (p.type === 'CREATE') {
        if (!list.some(item => item.id === p.targetId)) {
          list.push({
            ...p.proposedData,
            id: p.targetId,
            isPendingApproval: true,
            proposalId: p.id
          });
        }
      } else if (p.type === 'UPDATE') {
        const idx = list.findIndex(item => item.id === p.targetId);
        if (idx !== -1) {
          list[idx] = {
            ...list[idx],
            ...p.proposedData,
            isPendingApproval: true,
            proposalId: p.id
          };
        }
      } else if (p.type === 'DELETE') {
        const idx = list.findIndex(item => item.id === p.targetId);
        if (idx !== -1) {
          list[idx] = {
            ...list[idx],
            isPendingDeletion: true,
            isPendingApproval: true,
            proposalId: p.id
          };
        }
      }
    });
    return list;
  }, [itemsState, currentUser, proposals]);

  const setItems = (valOrFunc: any) => {
    if (currentUser && currentUser.role === 'user') {
      const prev = itemsState;
      const next = typeof valOrFunc === 'function' ? valOrFunc(prev) : valOrFunc;
      
      if (next.length > prev.length) {
        const added = next.filter((n: any) => !prev.some((p: any) => p.id === n.id));
        added.forEach((item: any) => {
          onProposeChange?.('strategic_management_items', 'CREATE', item.id, item.title, item);
        });
      } else if (next.length < prev.length) {
        const deleted = prev.filter((p: any) => !next.some((n: any) => p.id === n.id));
        deleted.forEach((item: any) => {
          onProposeChange?.('strategic_management_items', 'DELETE', item.id, item.title, item);
        });
      } else {
        next.forEach((item: any) => {
          const original = prev.find((p: any) => p.id === item.id);
          if (original && JSON.stringify(original) !== JSON.stringify(item)) {
            onProposeChange?.('strategic_management_items', 'UPDATE', item.id, item.title, item);
          }
        });
      }
      alert(isRtl ? 'درخواست ویرایش بخش استراتژیک ثبت شد و پس از تایید مدیریت اعمال می‌شود.' : 'Change proposed and is pending approval.');
    } else {
      setItemsState(valOrFunc);
    }
  };

  // --- STATE FOR CRUD MODALS & FORMS ---
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StrategicItem | null>(null);

  const [stratConfirmModal, setStratConfirmModal] = useState<{
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

  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formClauseId, setFormClauseId] = useState('');
  const [formLinkedDoc, setFormLinkedDoc] = useState('');

  // --- DOCUMENT LINKING POPOVER STATE ---
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);

  // All documents currently generated or available in standard templates
  const allDocList = useMemo(() => {
    return Array.from(new Set([
      ...Object.keys(documentTemplates),
      ...Object.keys(QmsDatabase.selectAll('documents_table') || {})
    ]))
      .filter(doc => {
        const clean = doc.trim().toLowerCase();
        const isPlaceholder = /^(سند|document|doc|sheet|table)\s*_?[\u0660-\u0669\u06f0-\u06f9\d]+$/i.test(clean) || 
                              /^(سند|document|doc|sheet|table)$/i.test(clean);
        return !isPlaceholder;
      })
      .sort();
  }, []);

  // Flattened standard clause nodes to help searching docs
  const standardClausesFlat = useMemo<IATFClause[]>(() => {
    return flattenIatfClauses(iatfData);
  }, []);

  // Helper to determine the standard clause associated with a connected database table or document sheet
  const getClauseForSource = (source: string | undefined): string => {
    if (!source) return '4.1';
    
    const cleanSource = source.replace(/^doc_/, '').trim();
    const lc = cleanSource.toLowerCase();
    
    // Direct matches for well-known core tables and documents
    if (lc.includes('swot') || lc.includes('بافت') || lc.includes('بافت سازمان')) return '4.1';
    if (lc.includes('control_table') || lc.includes('کنترل مدرک') || lc.includes('کنترل مستندات')) return '7.5';
    if (lc === 'clause_links_table') return '7.5';
    if (lc.includes('indicator') || lc.includes('شاخص') || lc.includes('kpi_vars_table') || lc.includes('فرمول') || lc.includes('kpi')) return '6.2.1';
    if (lc.includes('strategic_evaluations_table')) return '6.1';
    if (lc.includes('strategic_items_table') || lc.includes('کارت‌های برنامه‌ریزی استراتژیک')) return '6.2.1';
    if (lc.includes('nc_items_table') || lc.includes('qmsdb_v3_nc_items') || lc.includes('اقدامات اصلاحی') || lc.includes('8d') || lc.includes('rca') || lc.includes('عدم انطباق')) return '10.2';
    if (lc.includes('records_table') || lc.includes('آرشیو') || lc.includes('شواهد')) return '7.5.3';
    if (lc.includes('csr') || lc.includes('الزامات خاص مشتریان')) return '4.3';
    if (lc.includes('process_mappings_table') || lc.includes('نقشه‌برداری فرآیندها') || lc.includes('فرآیندها') || lc.includes('لاک‌پشتی') || lc.includes('turtle') || lc.includes('process-requirements matrix')) return '4.4';
    if (lc.includes('strategic_threshold_matrix_table')) return '6.1';
    
    // Quality Document Templates specific mappings
    if (lc.includes('pfmea')) return '8.3';
    if (lc.includes('dfmea') || lc.includes('طراحی محصول')) return '8.3';
    if (lc.includes('طرح کنترلی') || lc.includes('control plan')) return '8.5.1';
    if (lc.includes('کالیبراسیون') || lc.includes('calibration')) return '7.1.5';
    if (lc.includes('آماری فرآیند') || lc.includes('spc') || lc.includes('کنترل آماری')) return '9.1.1';
    if (lc.includes('سیستم اندازه‌گیری') || lc.includes('msa')) return '7.1.5';
    if (lc.includes('ممیزی داخلی') || lc.includes('internal_audit') || lc.includes('ممیزی')) return '9.2';
    if (lc.includes('هزینه‌های کیفیت') || lc.includes('coq')) return '9.1.1';
    if (lc.includes('تجارب آموخته') || lc.includes('lessons learned') || lc.includes('lesson')) return '10.3';
    if (lc.includes('psw') || lc.includes('تاییدیه قطعات')) return '8.9';
    if (lc.includes('تغییرات مهندسی') || lc.includes('engineering change')) return '8.5.6';
    if (lc.includes('اهداف کیفیت')) return '6.2.1';
    
    // Look up in flat standard clauses to match title explicitly
    if (standardClausesFlat) {
      const match = standardClausesFlat.find(c => 
        c.documents && c.documents.some(d => d.trim().toLowerCase() === cleanSource.toLowerCase())
      );
      if (match && match.number) {
        const cleanNo = match.number.trim();
        for (const candidate of STRATEGIC_CLAUSE_IDS) {
          if (cleanNo.startsWith(candidate)) {
            return candidate;
          }
        }
        return cleanNo;
      }
    }
    
    return '4.1';
  };

  // Fetch standard documents declared under a clause number
  const getStandardDocsForClause = (clauseId: string) => {
    const cleanClauseId = clauseId.trim();
    // Search flat standard list
    const found = standardClausesFlat.find(c => c.number === cleanClauseId || c.id === cleanClauseId);
    if (found && found.documents) {
      return found.documents;
    }
    return [];
  };

  // Switch or route directly to clause
  const handleGoToClauseInTree = (clauseId: string) => {
    if (onSelectClauseId) {
      onSelectClauseId(clauseId);
    }
  };

  // --- CRUD ACTIONS ---
  const handleOpenAdd = () => {
    setFormTitle('');
    setFormClauseId('');
    setFormLinkedDoc('');
    setIsAddOpen(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    const newItem: StrategicItem = {
      id: `custom-strat-${Date.now()}`,
      title: formTitle,
      clauseId: formClauseId.trim() || '4.1',
      linkedDoc: formLinkedDoc,
      isCustom: true
    };
    setItems([...items, newItem]);
    setIsAddOpen(false);
  };

  const handleOpenEdit = (item: StrategicItem) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormClauseId(item.clauseId);
    setFormLinkedDoc(item.linkedDoc || '');
    setIsEditOpen(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !formTitle.trim()) return;
    setItems(items.map(i => i.id === editingItem.id ? {
      ...i,
      title: formTitle,
      clauseId: formClauseId.trim() || '4.1',
      linkedDoc: formLinkedDoc
    } : i));
    setIsEditOpen(false);
    setEditingItem(null);
  };

  const handleDelete = (id: string) => {
    setStratConfirmModal({
      isOpen: true,
      title: isRtl ? '🗑️ حذف بخش مدیریت استراتژیک' : '🗑️ Delete Strategic Item',
      message: isRtl ? 'آیا از حذف این بخش مدیریت استراتژیک اطمینان دارید؟' : 'Are you sure you want to delete this strategic item?',
      onConfirm: () => {
        setItems(items.filter(i => i.id !== id));
        setStratConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // --- STRATEGIC EVALUATION MODULE INTERFACES & STATES ---
  interface EvaluationRow {
    id: string;
    title: string;
    desc: string;
    source: string;
    sourceKey?: string; // Optional foreign key link to a row in the source database table
    sourceTitleCol?: string; // Optional mapped column for row title
    sourceDescCol?: string; // Optional mapped column for row description
    clause: string;
    impactCustomer: number; // 1-5
    impactQuality: number; // 1-5
    impactProcess: number; // 1-5
    impactGoals: number; // 1-5
    impactLegal: number; // 1-5
    probability: number; // 1-5
    nature: 'risk' | 'opportunity';
  }

  // --- STRATEGIC INTERACTIVE TAB & MATRIX STATES ---
  const [activeTab, setActiveTab ] = useState<'dashboard' | 'matrix' | 'evaluation'>('dashboard');
  const [notification, setNotification] = useState<string | null>(null);
  const [dbTick, setDbTick ] = useState<number>(0);

  // States for live database connector popover on title column
  const [activeConnRowId, setActiveConnRowId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [connTable, setConnTable] = useState<string>('');
  const [connKey, setConnKey] = useState<string>('');
  const [connTitleCol, setConnTitleCol] = useState<string>('');
  const [connDescCol, setConnDescCol] = useState<string>('');

  // Header-level database connection configuration for the "Topic Title" column
  const [headerConnTable, setHeaderConnTable] = useState<string>(() => {
    return localStorage.getItem('qms_strategic_evaluations_header_conn_table') || '';
  });
  const [headerConnTitleCol, setHeaderConnTitleCol] = useState<string>(() => {
    return localStorage.getItem('qms_strategic_evaluations_header_conn_title_col') || '';
  });
  const [headerConnDescCol, setHeaderConnDescCol] = useState<string>(() => {
    return localStorage.getItem('qms_strategic_evaluations_header_conn_desc_col') || '';
  });
  const [headerConnRowId, setHeaderConnRowId] = useState<string>(() => {
    return localStorage.getItem('qms_strategic_evaluations_header_conn_row_id') || '';
  });
  const [isHeaderDbModalOpen, setIsHeaderDbModalOpen] = useState<boolean>(false);
  const [headerDbSearch, setHeaderDbSearch] = useState<string>('');
  const [isHeaderDbTableSelectOpen, setIsHeaderDbTableSelectOpen] = useState<boolean>(false);
  const [connRowId, setConnRowId] = useState<string>('');

  const [evalRowsState, setEvalRowsState] = useState<EvaluationRow[]>(() => {
    try {
      const saved = localStorage.getItem('qms_strategic_evaluations');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return [];
  });

  // Merge proposals for SWOT evaluation rows
  const evalRows = useMemo(() => {
    if (!currentUser || currentUser.role === 'admin') return evalRowsState;
    const list = [...evalRowsState];
    const activeProposals = proposals.filter(p => p.status === 'pending' && p.module === 'strategic_management_evaluations');
    
    activeProposals.forEach(p => {
      if (p.type === 'CREATE') {
        if (!list.some(r => r.id === p.targetId)) {
          list.push({
            ...p.proposedData,
            id: p.targetId,
            isPendingApproval: true,
            proposalId: p.id
          });
        }
      } else if (p.type === 'UPDATE') {
        const idx = list.findIndex(r => r.id === p.targetId);
        if (idx !== -1) {
          list[idx] = {
            ...list[idx],
            ...p.proposedData,
            isPendingApproval: true,
            proposalId: p.id
          };
        }
      } else if (p.type === 'DELETE') {
        const idx = list.findIndex(r => r.id === p.targetId);
        if (idx !== -1) {
          list[idx] = {
            ...list[idx],
            isPendingApproval: true,
            isProposedDelete: true,
            proposalId: p.id
          };
        }
      }
    });
    return list;
  }, [evalRowsState, proposals, currentUser]);

  const setEvalRows = (valOrFunc: any) => {
    if (currentUser && currentUser.role === 'user') {
      const prev = evalRowsState;
      const next = typeof valOrFunc === 'function' ? valOrFunc(prev) : valOrFunc;
      
      if (next.length > prev.length) {
        const added = next.filter((n: any) => !prev.some((p: any) => p.id === n.id));
        added.forEach((item: any) => {
          onProposeChange?.('strategic_management_evaluations', 'CREATE', item.id, item.title || item.desc || 'سطر ارزیابی جدید', item);
        });
      } else if (next.length < prev.length) {
        const deleted = prev.filter((p: any) => !next.some((n: any) => n.id === p.id));
        deleted.forEach((item: any) => {
          onProposeChange?.('strategic_management_evaluations', 'DELETE', item.id, item.title || item.desc || 'حذف سطر ارزیابی', item);
        });
      } else {
        next.forEach((item: any) => {
          const original = prev.find((p: any) => p.id === item.id);
          if (original && JSON.stringify(original) !== JSON.stringify(item)) {
            onProposeChange?.('strategic_management_evaluations', 'UPDATE', item.id, item.title || item.desc || 'ویرایش سطر ارزیابی', item);
          }
        });
      }
      alert(isRtl ? 'درخواست ویرایش ارزیابی ثبت شد و پس از تایید مدیریت اعمال می‌شود.' : 'Evaluation change proposed and is pending approval.');
    } else {
      setEvalRowsState(valOrFunc);
    }
  };

  // Grouped list of database tables and custom documents we can connect to
  const dbConnectedOptions = useMemo(() => {
    const list: { id: string; name: string; label: string; clauseNumber?: string }[] = [];
    
    // Core database tables
    const core = [
      { id: 'document_control_table', label: isRtl ? '📝 کنترل مستندات (ISO9001)' : '📝 Doc Control' },
      { id: 'indicators_table', label: isRtl ? '📊 شاخص‌های کلیدی (KPI)' : '📊 KPI Indicators' },
      { id: 'documents_table', label: isRtl ? '📂 مستندات و فرم‌ها (QMS)' : '📂 Custom Docs' },
      { id: 'clause_links_table', label: isRtl ? '📚 لینک‌های بند سازمانی' : '📚 Clause Links' },
      { id: 'strategic_evaluations_table', label: isRtl ? '🎯 ارزیابی استراتژیک (SWOT/PESTEL)' : '🎯 Strategic SWOT/PEST' },
      { id: 'strategic_items_table', label: isRtl ? '🎯 کارت‌های برنامه‌ریزی استراتژیک' : '🎯 Strategic Cards' },
      { id: 'nc_items_table', label: isRtl ? '🛠️ اقدامات اصلاحی و عدم انطباق‌ها (CAPA)' : '🛠️ CAPA Corrective Actions' },
      { id: 'records_table', label: isRtl ? '⚙️ آرشیو سوابق و مستندات' : '⚙️ Archives & Records' },
      { id: 'csr_mappings_table', label: isRtl ? '🗂️ مقایسه الزامات خاص مشتریان (CSR)' : '🗂️ Customer Specific Requirements (CSR)' },
      { id: 'process_mappings_table', label: isRtl ? '🗺️ نقشه فرآیندهای سازمانی' : '🗺️ Process Mapping Matrix' },
      { id: 'kpi_vars_table', label: isRtl ? '📈 متغیرهای محاسباتی آمارها' : '📈 KPI Variables' },
      { id: 'strategic_threshold_matrix_table', label: isRtl ? '⚙️ تنظیمات آستانه ماتریس ریسک' : '⚙️ Strategic Threshold Matrix' }
    ];

    core.forEach(t => {
      let searchName = t.id;
      if (t.id === 'document_control_table') searchName = 'کنترل مستندات';
      else if (t.id === 'indicators_table') searchName = 'شاخص‌های کلیدی عملکرد (KPI)';
      else if (t.id === 'documents_table') searchName = 'مستندات و فرم‌ها';
      else if (t.id === 'clause_links_table') searchName = 'لینک‌های بند سازمانی';
      else if (t.id === 'strategic_evaluations_table') searchName = 'ارزیابی استراتژیک';
      else if (t.id === 'nc_items_table') searchName = 'اقدامات اصلاحی و عدم انطباق‌ها';
      else if (t.id === 'process_mappings_table') searchName = 'نقشه فرآیندهای سازمان';
      
      list.push({
        id: t.id,
        name: t.label,
        label: t.label,
        clauseNumber: getClauseNumberForDocument(searchName) || undefined
      });
    });
    
    // Quality Documents / Sheets
    allDocList.forEach(doc => {
      list.push({
        id: `doc_${doc}`,
        name: isRtl ? `📋 سند: ${doc}` : `📋 Document: ${doc}`,
        label: isRtl ? `📋 سند: ${doc}` : `📋 Document: ${doc}`,
        clauseNumber: getClauseNumberForDocument(doc) || undefined
      });
    });
    
    return list;
  }, [allDocList, isRtl]);

  // List of actual records / rows for the currently chosen connect table
  const connRecords = useMemo(() => {
    if (!connTable) return [];
    try {
      if (connTable === 'nc_items_table' || connTable === 'qmsdb_v3_nc_items') {
        const stored = localStorage.getItem('qmsdb_v3_nc_items');
        if (stored) {
          const list = JSON.parse(stored);
          return list.map((n: any) => ({
            id: String(n.id),
            title: `${n.code || ''} - ${n.description || ''}`
          }));
        }
      }
      if (connTable === 'indicators_table') {
        const dbTableData = QmsDatabase.selectAll('indicators_table') || {};
        return Object.entries(dbTableData).map(([key, val]) => {
          const item = val as any;
          return {
            id: String(key),
            title: String(item?.titleFa || item?.titleEn || key)
          };
        });
      }
      if (connTable === 'records_table') {
        const dbTableData = QmsDatabase.selectAll('records_table') || {};
        return Object.entries(dbTableData).map(([key, val]) => {
          const item = val as any;
          return {
            id: String(key),
            title: `${item?.documentName || ''} (${item?.code || ''})`
          };
        });
      }
      if (connTable === 'document_control_table') {
        const dbTableData = QmsDatabase.selectAll('document_control_table') || {};
        return Object.entries(dbTableData).map(([key, val]) => {
          const item = val as any;
          return {
            id: String(key),
            title: `${item?.title || item?.code || key} (Rev: ${item?.revision || '۱'})`
          };
        });
      }

      // Quality document sub-rows
      if (connTable.startsWith('doc_')) {
        const docName = connTable.substring(4);
        let docRows = getDocRowsFromDb(docName);
        if (docRows.length === 0) {
          try {
            const draftItemsRaw = localStorage.getItem(`iatf_draft_items_${docName}`);
            if (draftItemsRaw) {
              docRows = JSON.parse(draftItemsRaw);
            }
          } catch {}
        }

        // Fallback for SWOT and other document name variations
        const lowerDoc = docName.toLowerCase();
        if ((!Array.isArray(docRows) || docRows.length === 0) && (lowerDoc.includes('swot') || lowerDoc.includes('سوات'))) {
          const altNames = [
            'ماتریس SWOT سازمان',
            'ماتریس SWOT (نقاط قوت، ضعف، فرصت‌ها و تهدیدها)',
            'SWOT Matrix'
          ];
          for (const alt of altNames) {
            if (alt !== docName) {
              try {
                let altRows = getDocRowsFromDb(alt);
                if (Array.isArray(altRows) && altRows.length > 0) {
                  docRows = altRows;
                  break;
                }
              } catch (e) {}
              try {
                const altDraft = localStorage.getItem(`iatf_draft_items_${alt}`);
                if (altDraft) {
                  docRows = JSON.parse(altDraft);
                  break;
                }
              } catch (e) {}
            }
          }
        }

        if (!Array.isArray(docRows)) {
          docRows = [];
        }

        return docRows.map((r: any, idx) => ({
          id: String(r.id || `row_${idx}`),
          title: String(r.title || r.clause || r.description || r.item || r.field1 || r.field2 || r.name || r.id || idx)
        })).filter(Boolean);
      }

      // Fallback for custom or direct database tables
      const dbTableData = QmsDatabase.selectAll(connTable) || {};
      return Object.entries(dbTableData).map(([key, val]) => {
        const item = val as any;
        let title = '';
        if (connTable === 'clause_links_table') {
          const docs = Array.isArray(item?.documents_list) ? item.documents_list.join(', ') : (Array.isArray(item) ? item.join(', ') : String(item));
          title = `${key}: ${docs}`;
        } else if (connTable === 'csr_mappings_table') {
          title = String(item?.customer || item?.reqFa || item?.requirement || key);
        } else if (connTable === 'process_mappings_table') {
          const clauses = Array.isArray(item) ? item.join(', ') : String(item);
          title = `${key}: ${clauses}`;
        } else if (connTable === 'kpi_vars_table') {
          const valStr = typeof item === 'object' && item !== null ? (item.value !== undefined ? String(item.value) : JSON.stringify(item)) : String(item);
          title = `${key}: ${valStr}`;
        } else {
          title = String(item?.title || item?.description || item?.name || item?.code || key);
        }
        return {
          id: String(key),
          title
        };
      }).filter(Boolean);
    } catch {}
    return [];
  }, [connTable, isRtl]);

// Helper to retrieve user friendly display names for database table columns, filtering internal keys like id, index, unmapped fields
const getDatabaseTableColumns = (tableId: string, isRtl: boolean): { id: string; label: string }[] => {
  if (!tableId) return [];
  const isFa = isRtl;

  const colsSet = new Set<string>();

  if (tableId.startsWith('doc_')) {
    const docTitle = tableId.substring(4);
    let tpl = documentTemplates[docTitle];
    if (!tpl) {
      const cleanTitle = docTitle.replace(/\s*\(ارجاع به بند.*\)/, '').replace(/\s*\(Process Cards.*\)/, '').trim();
      const foundKey = Object.keys(documentTemplates).find(k => 
        k.includes(cleanTitle) || cleanTitle.includes(k) ||
        k.replace(/\s*\(.*\)/, '').trim() === cleanTitle.replace(/\s*\(.*\)/, '').trim()
      );
      if (foundKey) {
        tpl = documentTemplates[foundKey];
      }
    }

    const smartType = tpl?.smartType;
    let docColumns: any[] = [];
    try {
      let savedColsRaw = localStorage.getItem(`iatf_draft_cols_${docTitle}`);
      if (!savedColsRaw && smartType === 'SWOT') {
        savedColsRaw = localStorage.getItem('iatf_draft_cols_ماتریس SWOT سازمان') || localStorage.getItem('iatf_draft_cols_ماتریس SWOT (نقاط قوت، ضعف، فرصت‌ها و تهدیدها)');
      }
      if (savedColsRaw) {
        docColumns = JSON.parse(savedColsRaw);
      } else if (tpl) {
        // Fallback to tpl headers
        if (tpl.headers && tpl.headers.length > 0) {
          tpl.headers.forEach((h, i) => {
            colsSet.add(`field${i + 1}`);
          });
        }
        // Also add smartType columns
        if (smartType === 'SWOT') {
          ['type', 'field1', 'field2', 'field3', 'field4', 'weight', 'rating', 'final_score'].forEach(c => colsSet.add(c));
        } else if (smartType === 'RISK') {
          ['field1', 'field2', 'severity', 'occurrence', 'detection', 'rpn', 'actions'].forEach(c => colsSet.add(c));
        } else if (smartType === 'PFMEA') {
          ['field2', 'field3', 'field4', 'severity', 'field5', 'field6', 'occurrence', 'field7', 'field8', 'detection', 'rpn'].forEach(c => colsSet.add(c));
        } else if (smartType === 'CALIBRATION') {
          ['field1', 'mpe', 'refValue', 'readValue', 'measured_error', 'calibration_status'].forEach(c => colsSet.add(c));
        } else if (smartType === 'KPI' || smartType === 'KPI_PROCESS' || smartType === 'KPI_OBJECTIVE') {
          ['field1', 'target', 'actual', 'unit', 'clauseId', 'kpi_rate'].forEach(c => colsSet.add(c));
        } else if (smartType === 'SPC') {
          ['field1', 'usl', 'lsl', 'measurements', 'spc_stats', 'spc_cpk'].forEach(c => colsSet.add(c));
        } else if (smartType === 'COQ') {
          ['coqCategory', 'field1', 'coqAmount'].forEach(c => colsSet.add(c));
        }
      }
    } catch (e) {}

    if (Array.isArray(docColumns)) {
      docColumns.forEach(c => {
        if (c.field && c.field !== 'id' && c.field !== 'index' && c.field !== 'image' && !c.field.endsWith('_fk')) {
          colsSet.add(c.field);
        }
      });
    }

    try {
      let docRows = [];
      let draftItemsRaw = localStorage.getItem(`iatf_draft_items_${docTitle}`);
      if (!draftItemsRaw && smartType === 'SWOT') {
        draftItemsRaw = localStorage.getItem('iatf_draft_items_ماتریس SWOT سازمان') || localStorage.getItem('iatf_draft_items_ماتریس SWOT (نقاط قوت، ضعف، فرصت‌ها و تهدیدها)');
      }
      if (draftItemsRaw) {
        docRows = JSON.parse(draftItemsRaw);
      }
      
      if (Array.isArray(docRows)) {
        docRows.forEach((item) => {
          if (item && typeof item === 'object') {
            Object.keys(item).forEach(prop => {
              if (prop.startsWith('custom_') || prop.startsWith('field')) {
                colsSet.add(prop);
              }
            });
          }
        });
      }
    } catch (e) {}

  } else {
    // Core database tables
    if (tableId === 'document_control_table') {
      ['title', 'code', 'revision', 'preparedBy', 'approvedBy', 'lifecycle_status', 'status'].forEach(c => colsSet.add(c));
    } else if (tableId === 'indicators_table') {
      ['type', 'titleFa', 'titleEn', 'clauseId', 'owner', 'target', 'unit', 'formula', 'period'].forEach(c => colsSet.add(c));
    } else if (tableId === 'documents_table') {
      ['title', 'rowCount', 'lastUpdatedTime'].forEach(c => colsSet.add(c));
    } else if (tableId === 'clause_links_table') {
      ['documents_list', 'interpretation'].forEach(c => colsSet.add(c));
    } else if (tableId === 'strategic_evaluations_table') {
      ['id', 'title', 'desc', 'source', 'clause', 'impactCustomer', 'impactQuality', 'impactProcess', 'impactGoals', 'impactLegal', 'probability', 'nature'].forEach(c => colsSet.add(c));
    } else if (tableId === 'strategic_items_table') {
      ['id', 'title', 'description', 'isActive', 'clauseNumber', 'lastReview'].forEach(c => colsSet.add(c));
    } else if (tableId === 'nc_items_table' || tableId === 'qmsdb_v3_nc_items') {
      ['id', 'clauseId', 'clauseNumber', 'clauseTitle', 'description', 'declaredAt', 'source', 'reporter', 'targetDate', 'status', 'delayReason'].forEach(c => colsSet.add(c));
    } else if (tableId === 'records_table') {
      ['title', 'code', 'preparedBy', 'approvedBy', 'status', 'revision'].forEach(c => colsSet.add(c));
    }

    try {
      const dbTableData = QmsDatabase.selectAll(tableId as any) || {};
      const dbKeys = Object.keys(dbTableData);
      dbKeys.slice(0, 10).forEach(k => {
        const rowVal = dbTableData[k];
        if (rowVal && typeof rowVal === 'object' && !Array.isArray(rowVal)) {
          Object.keys(rowVal).forEach(prop => {
            if (prop !== 'id' && prop !== 'index' && prop !== 'image' && !prop.endsWith('_fk')) {
              colsSet.add(prop);
            }
          });
        }
      });
    } catch {}
  }

  const getColumnFriendlyName = (colName: string, dbTable: string) => {
    if (dbTable && dbTable.startsWith('doc_')) {
      const targetDocName = dbTable.substring(4);
      try {
        let savedColsRaw = localStorage.getItem(`iatf_draft_cols_${targetDocName}`);
        if (!savedColsRaw) {
          const tpl = documentTemplates[targetDocName];
          if (tpl?.smartType === 'SWOT') {
            savedColsRaw = localStorage.getItem('iatf_draft_cols_ماتریس SWOT سازمان') || localStorage.getItem('iatf_draft_cols_ماتریس SWOT (نقاط قوت، ضعف، فرصت‌ها و تهدیدها)');
          }
        }
        if (savedColsRaw) {
          const savedCols = JSON.parse(savedColsRaw);
          if (Array.isArray(savedCols)) {
            const colDef = savedCols.find(co => co.field === colName);
            if (colDef && colDef.label && colDef.label.trim() !== '') {
              return `${colDef.label} (${colName})`;
            }
          }
        }
        
        const tpl = documentTemplates[targetDocName];
        if (tpl) {
          if (tpl.headers && tpl.headers.length > 0) {
            const hIndex = parseInt(colName.replace('field', '')) - 1;
            if (!isNaN(hIndex) && tpl.headers[hIndex]) {
              return `${tpl.headers[hIndex]} (${colName})`;
            }
          }
          if (tpl.smartType === 'SWOT') {
            if (colName === 'type') return isFa ? `دسته‌بندی SWOT (S/W/O/T)` : 'SWOT Category';
            if (colName === 'field3') return isFa ? `حوزه` : 'Domain';
            if (colName === 'field4') return isFa ? `اثر بر QMS` : 'Impact on QMS';
            if (colName === 'weight') return isFa ? `وزن عامل` : 'Weight';
            if (colName === 'rating') return isFa ? `رتبه/امتیاز` : 'Rating';
            if (colName === 'final_score') return isFa ? `نمره نهایی` : 'Final Score';
          } else if (tpl.smartType === 'RISK') {
            if (colName === 'severity') return isFa ? 'شدت (S)' : 'Severity';
            if (colName === 'occurrence') return isFa ? 'وقوع (O)' : 'Occurrence';
            if (colName === 'detection') return isFa ? 'تشخیص (D)' : 'Detection';
            if (colName === 'rpn') return isFa ? 'RPN' : 'RPN';
            if (colName === 'actions') return isFa ? 'اقدامات اصلاحی پیشنهادی' : 'Proposed Actions';
          }
        }
      } catch (e) {}
      return colName;
    }
    
    const translations: Record<string, string> = {
      code: isFa ? 'کد سند' : 'Code',
      revision: isFa ? 'نسخه بازنگری' : 'Revision',
      preparedBy: isFa ? 'تهیه‌کننده' : 'Prepared By',
      approvedBy: isFa ? 'تاییدکننده' : 'Approved By',
      lifecycle_status: isFa ? 'وضعیت چرخه سند' : 'Lifecycle Status',
      type: isFa ? 'نوع شاخص/عامل' : 'Type',
      titleFa: isFa ? 'عنوان فارسی موضوع' : 'Title (Fa)',
      titleEn: isFa ? 'عنوان انگلیسی موضوع' : 'Title (En)',
      target: isFa ? 'هدف گذاری' : 'Target',
      unit: isFa ? 'واحد سنجش' : 'Unit',
      rowCount: isFa ? 'تعداد ردیف‌ها' : 'Row Count',
      lastUpdatedTime: isFa ? 'زمان بروزرسانی' : 'Last Updated',
      documents_list: isFa ? 'لیست مستندات' : 'Documents List',
      id: isFa ? 'شناسه (ID)' : 'ID',
      title: isFa ? 'عنوان / شرح عامل' : 'Title',
      description: isFa ? 'شرح / توضیحات' : 'Description',
      isActive: isFa ? 'وضعیت فعال بودن' : 'Is Active',
      clauseNumber: isFa ? 'شماره بند' : 'Clause Number',
      lastReview: isFa ? 'آخرین ممیزی' : 'Last Review',
      clauseId: isFa ? 'کد بند استاندارد' : 'Clause ID',
      clauseTitle: isFa ? 'عنوان بند استاندارد' : 'Clause Title',
      declaredAt: isFa ? 'تاریخ صدور / اعلام' : 'Declared At',
      source: isFa ? 'منبع عیب' : 'Source',
      reporter: isFa ? 'گزارش‌دهنده' : 'Reporter',
      targetDate: isFa ? 'تاریخ اقدام (سررسید)' : 'Target Date',
      status: isFa ? 'وضعیت پرونده' : 'Status',
      delayReason: isFa ? 'علت انحراف/تاخیر' : 'Delay Reason',
      evaluation: isFa ? 'شرح ارزیابی' : 'Evaluation Description',
      weight: isFa ? 'وزن اهمیت عامل' : 'Weight',
      rating: isFa ? 'رتبه تأثیر (Rating)' : 'Rating',
      score: isFa ? 'نمره نهایی (Score)' : 'Final Score',
      desc: isFa ? 'توصیف تفصیلی عامل' : 'Description Details',
      clause: isFa ? 'کد بند انتسابی' : 'Associated Clause',
      impactCustomer: isFa ? 'تاثیر روی مشتری (Severity)' : 'Customer Impact',
      impactQuality: isFa ? 'تاثیر روی کیفیت' : 'Quality Impact',
      impactProcess: isFa ? 'تاثیر روی فرآیند' : 'Process Impact',
      impactGoals: isFa ? 'تاثیر روی اهداف' : 'Goals Impact',
      impactLegal: isFa ? 'تاثیر قانونی و الزامات' : 'Legal Impact',
      probability: isFa ? 'احتمال وقوع (O)' : 'Probability',
      nature: isFa ? 'ماهیت (ریسک/فرصت)' : 'Nature'
    };
    return translations[colName] || colName;
  };

  return Array.from(colsSet)
    .map(c => ({
      id: c,
      label: getColumnFriendlyName(c, tableId)
    }))
    .filter(item => item.label && item.label.trim() !== '');
};

  // Dynamically inspect selected table/document records to list available columns (fields) for selection
  const connColumns = useMemo(() => {
    return getDatabaseTableColumns(connTable, isRtl);
  }, [connTable, isRtl]);

  const getSourceRecords = (source: string): { id: string; title: string }[] => {
    if (!source) return [];
    try {
      // Core tables direct handling
      if (source === 'nc_items_table' || source === 'qmsdb_v3_nc_items') {
        const stored = localStorage.getItem('qmsdb_v3_nc_items');
        if (stored) {
          const list = JSON.parse(stored);
          return list.map((n: any) => ({
            id: String(n.id),
            title: `${n.code || ''} - ${n.description || ''}`
          }));
        }
      }
      if (source === 'indicators_table') {
        const dbTableData = QmsDatabase.selectAll('indicators_table') || {};
        return Object.entries(dbTableData).map(([key, val]) => {
          const item = val as any;
          return {
            id: String(key),
            title: String(item?.titleFa || item?.titleEn || key)
          };
        });
      }
      if (source === 'records_table') {
        const dbTableData = QmsDatabase.selectAll('records_table') || {};
        return Object.entries(dbTableData).map(([key, val]) => {
          const item = val as any;
          return {
            id: String(key),
            title: `${item?.documentName || ''} (${item?.code || ''})`
          };
        });
      }
      if (source === 'document_control_table') {
        const dbTableData = QmsDatabase.selectAll('document_control_table') || {};
        return Object.entries(dbTableData).map(([key, val]) => {
          const item = val as any;
          return {
            id: String(key),
            title: `${item?.title || item?.code || key} (Rev: ${item?.revision || '۱'})`
          };
        });
      }

      const card = items.find(i => i.title === source || i.id === source);
      let targetSource = source;
      if (card && card.linkedDoc) {
        targetSource = 'doc_' + card.linkedDoc;
      } else if (card) {
        return [];
      }

      if (targetSource.startsWith('doc_')) {
        const docName = targetSource.substring(4);
        let docRows = getDocRowsFromDb(docName);
        if (docRows.length === 0) {
          try {
            const draftItemsRaw = localStorage.getItem(`iatf_draft_items_${docName}`);
            if (draftItemsRaw) {
              docRows = JSON.parse(draftItemsRaw);
            }
          } catch {}
        }
        return docRows.map((r: any, idx) => ({
          id: String(r.id || r.code || r.title || idx),
          title: String(r.title || r.clause || r.description || r.item || r.field1 || r.field2 || r.name || r.id || idx)
        })).filter(Boolean);
      } else {
        const dbTableData = QmsDatabase.selectAll(targetSource as any) || {};
        return Object.entries(dbTableData).map(([key, val]) => {
          const item = val as any;
          return {
            id: String(key),
            title: String(item?.title || item?.description || item?.name || item?.code || key)
          };
        }).filter(Boolean);
      }
    } catch (e) {
      console.warn('Error fetching source records list:', e);
      return [];
    }
  };

  const getReferencedRowData = (source: string, sourceKey: string, titleCol?: string, descCol?: string) => {
    if (!source) return null;
    const isRealDb = source.startsWith('doc_') || 
                     source.endsWith('_table') || 
                     source === 'kpi_vars_table' || 
                     source === 'qmsdb_v3_nc_items' || 
                     source === 'db_system';
    if (!isRealDb) return null;
    try {
      if (!sourceKey) {
        // Return full column dynamic summary if sourceKey is not selected (optional row selection)
        const dbCols = getDatabaseTableColumns(source, isRtl);
        const colDef = dbCols.find(c => c.id === titleCol);
        const colLabel = colDef ? colDef.label : (titleCol || '');
        
        let vals: string[] = [];
        try {
          if (source.startsWith('doc_')) {
            const docName = source.substring(4);
            let docRows = getDocRowsFromDb(docName);
            if (docRows.length === 0) {
              const draftItemsRaw = localStorage.getItem(`iatf_draft_items_${docName}`);
              if (draftItemsRaw) {
                docRows = JSON.parse(draftItemsRaw);
              }
            }
            if (titleCol) {
              vals = docRows.map((r: any) => r[titleCol]).filter(v => v !== undefined && v !== null && v !== '');
            }
          } else {
            const dbTableData = QmsDatabase.selectAll(source) || {};
            if (titleCol) {
              vals = Object.values(dbTableData).map((r: any) => r[titleCol]).filter(v => v !== undefined && v !== null && v !== '');
            }
          }
        } catch {}

        const joinedVals = vals.join(' | ');
        return {
          title: joinedVals ? (joinedVals.length > 80 ? joinedVals.substring(0, 80) + '...' : joinedVals) : (isRtl ? `داده کامل ستون: ${colLabel}` : `Whole Column: ${colLabel}`),
          desc: isRtl ? `متصل به ستون ${colLabel} بدون فیلتر سطر • سنکرون کل ستون` : `Connected to column ${colLabel} with no row filter • Column Sync`
        };
      }

      let foundRecord: any = null;
      if (source === 'nc_items_table' || source === 'qmsdb_v3_nc_items') {
        const stored = localStorage.getItem('qmsdb_v3_nc_items');
        if (stored) {
          const list = JSON.parse(stored);
          foundRecord = list.find((n: any) => String(n.id) === String(sourceKey));
        }
      } else if (source.startsWith('doc_')) {
        const docName = source.substring(4);
        let docRows = getDocRowsFromDb(docName);
        if (docRows.length === 0) {
          const draftItemsRaw = localStorage.getItem(`iatf_draft_items_${docName}`);
          if (draftItemsRaw) {
            docRows = JSON.parse(draftItemsRaw);
          }
        }
        foundRecord = docRows.find((r: any, idx) => String(r.id || r.code || r.title || idx) === String(sourceKey));
      } else {
        const dbTableData = QmsDatabase.selectAll(source) || {};
        foundRecord = dbTableData[sourceKey] as any;
      }

      if (foundRecord) {
        let titleVal = '';
        if (titleCol && foundRecord[titleCol] !== undefined) {
          titleVal = Array.isArray(foundRecord[titleCol]) ? foundRecord[titleCol].join(', ') : String(foundRecord[titleCol] || '');
        } else {
          // Defaults mapping based on source
          if (source === 'nc_items_table' || source === 'qmsdb_v3_nc_items') {
            titleVal = String(foundRecord.code || '') + ' - ' + String(foundRecord.description || '');
          } else if (source === 'indicators_table') {
            titleVal = String(foundRecord.titleFa || foundRecord.titleEn || sourceKey);
          } else if (source === 'records_table') {
            titleVal = String(foundRecord.documentName || '') + ' (' + String(foundRecord.code || '') + ')';
          } else if (source === 'document_control_table') {
            titleVal = String(foundRecord.title || foundRecord.code || sourceKey);
          } else if (source === 'clause_links_table') {
            titleVal = isRtl ? `پیوندهای بند ${sourceKey}` : `Links for Clause ${sourceKey}`;
          } else if (source === 'csr_mappings_table') {
            titleVal = String(foundRecord.customer || foundRecord.requirement || sourceKey);
          } else if (source === 'process_mappings_table') {
            titleVal = isRtl ? `ماتریس فرآیند ${sourceKey}` : `Matrix for process ${sourceKey}`;
          } else if (source === 'kpi_vars_table') {
            titleVal = isRtl ? `متغیر کلیدی ${sourceKey}` : `Key variable ${sourceKey}`;
          } else {
            titleVal = String(foundRecord.title || foundRecord.clause || foundRecord.name || foundRecord.code || sourceKey);
          }
        }

        let descVal = '';
        if (descCol && foundRecord[descCol] !== undefined) {
          descVal = Array.isArray(foundRecord[descCol]) ? foundRecord[descCol].join(', ') : String(foundRecord[descCol] || '');
        } else {
          // Defaults mapping based on source
          if (source === 'nc_items_table' || source === 'qmsdb_v3_nc_items') {
            descVal = isRtl 
              ? `گزارش‌دهنده: ${foundRecord.reporter || 'تیم CFT'} • وضعیت: ${foundRecord.status === 'CLOSED_CA' ? 'بسته شد ✅' : 'فعال ⚠️'}`
              : `Reporter: ${foundRecord.reporter || 'CFT Team'} • Status: ${foundRecord.status === 'CLOSED_CA' ? 'Closed' : 'Active'}`;
          } else if (source === 'indicators_table') {
            descVal = String(foundRecord.target || '');
          } else if (source === 'records_table') {
            descVal = isRtl ? `بایگانی در تاریخ: ${foundRecord.archivedAt}` : `Archived on: ${foundRecord.archivedAt}`;
          } else if (source === 'document_control_table') {
            descVal = isRtl ? `گیرنده: ${foundRecord.preparedBy || '—'} • رتبه: ویرایش ${foundRecord.revision || '۱'}` : `Rev: ${foundRecord.revision || '1'} • Holder: ${foundRecord.preparedBy || ''}`;
          } else if (source === 'clause_links_table') {
            const docsStr = Array.isArray(foundRecord?.documents_list) ? foundRecord.documents_list.join(', ') : (Array.isArray(foundRecord) ? foundRecord.join(', ') : String(foundRecord));
            descVal = isRtl ? `مستندات متصل: ${docsStr}` : `Linked docs: ${docsStr}`;
          } else if (source === 'csr_mappings_table') {
            descVal = String(foundRecord.reqFa || foundRecord.details || '');
          } else if (source === 'process_mappings_table') {
            const clausesStr = Array.isArray(foundRecord) ? foundRecord.join(', ') : String(foundRecord);
            descVal = isRtl ? `بندهای متناظر: ${clausesStr}` : `Associated clauses: ${clausesStr}`;
          } else if (source === 'kpi_vars_table') {
            const valStr = typeof foundRecord === 'object' && foundRecord !== null ? (foundRecord.value !== undefined ? String(foundRecord.value) : JSON.stringify(foundRecord)) : String(foundRecord);
            descVal = isRtl ? `مقدار فعلی: ${valStr}` : `Current value: ${valStr}`;
          } else if (source === 'strategic_evaluations_table') {
            descVal = String(foundRecord.desc || foundRecord.source || '');
          } else if (source === 'strategic_items_table') {
            descVal = isRtl ? `بند: ${foundRecord.clauseId || ''} • مستند: ${foundRecord.linkedDoc || '—'}` : `Clause: ${foundRecord.clauseId || ''} • Doc: ${foundRecord.linkedDoc || ''}`;
          } else {
            descVal = String(foundRecord.desc || foundRecord.description || foundRecord.field2 || foundRecord.details || '');
          }
        }

        return {
          title: titleVal,
          desc: descVal
        };
      }
    } catch (e) {
      console.warn('Error mapping referenced row data:', e);
    }
    return null;
  };

  const [thresholdMatrixState, setThresholdMatrixState] = useState<('important' | 'minor')[][]>(() => {
    const saved = localStorage.getItem('qms_strategic_threshold_matrix');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((row: any[]) => row.map((cell: any) => {
            if (cell === 'risk' || cell === 'opportunity' || cell === 'important') {
              return 'important';
            }
            return 'minor';
          }));
        }
      } catch {}
    }
    return [
      ['minor', 'minor', 'minor', 'minor', 'important'], // S=1
      ['minor', 'minor', 'minor', 'important', 'important'], // S=2
      ['minor', 'minor', 'important', 'important', 'important'], // S=3
      ['minor', 'important', 'important', 'important', 'important'], // S=4
      ['minor', 'important', 'important', 'important', 'important']  // S=5
    ];
  });

  const thresholdMatrix = thresholdMatrixState;

  const setThresholdMatrix = (valOrFunc: any) => {
    if (currentUser && currentUser.role === 'user') {
      alert(isRtl 
        ? 'خطا: ویرایش ماتریس آستانه ریسک‌ها تنها در حیطه اختیارات ادمین سیستم است.' 
        : 'Error: Editing risk threshold matrix is restricted to system administrators.');
    } else {
      setThresholdMatrixState(valOrFunc);
    }
  };

  const hasIncompleteReplicated = useMemo(() => {
    try {
      if (!evalRows || evalRows.length === 0) {
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
  }, [evalRows, thresholdMatrix, notification, dbTick]);

  useEffect(() => {
    const handleSync = () => {
      setTimeout(() => {
        setDbTick(prev => prev + 1);
      }, 0);
    };
    window.addEventListener('qms-db-mutated', handleSync);
    window.addEventListener('qms_db_updated', handleSync);
    window.addEventListener('storage', handleSync);
    window.addEventListener('qms_nc_updated', handleSync);
    return () => {
      window.removeEventListener('qms-db-mutated', handleSync);
      window.removeEventListener('qms_db_updated', handleSync);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('qms_nc_updated', handleSync);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('qms_strategic_evaluations', JSON.stringify(evalRowsState));
    
    // Add real database table persistence
    const recordsMap: Record<string, EvaluationRow> = {};
    evalRowsState.forEach(r => {
      recordsMap[r.id] = r;
    });
    QmsDatabase.writeAll(QmsDatabase.TABLES.STRATEGIC_EVALUATIONS, recordsMap);

    window.dispatchEvent(new Event('qms_db_updated'));
    onNotifyDbModified?.();
  }, [evalRowsState]);

  useEffect(() => {
    localStorage.setItem('qms_strategic_threshold_matrix', JSON.stringify(thresholdMatrixState));
    
    // Add database matrix configuration persistence
    QmsDatabase.writeRow(QmsDatabase.TABLES.STRATEGIC_THRESHOLD, 'active_matrix', thresholdMatrixState);

    window.dispatchEvent(new Event('qms_db_updated'));
    onNotifyDbModified?.();
  }, [thresholdMatrixState]);

  // Compute metrics for a row
  const getRowMetrics = (row: EvaluationRow) => {
    const sumImpact = row.impactCustomer + row.impactQuality + row.impactProcess + row.impactGoals + row.impactLegal;
    const avgImpact = sumImpact / 5;
    const S = Math.max(1, Math.min(5, Math.round(avgImpact)));
    const O = Math.max(1, Math.min(5, row.probability));
    const totalScore = row.impactCustomer * row.impactQuality * row.impactProcess * row.impactGoals * row.impactLegal * row.probability;
    
    const cellValue = thresholdMatrix[S - 1]?.[O - 1] || 'minor';
    
    let statusType: 'risk' | 'opportunity' | 'minor' = 'minor';
    if (cellValue === 'important') {
      statusType = row.nature === 'opportunity' ? 'opportunity' : 'risk';
    }
    
    return { S, O, totalScore, statusType };
  };

  // Replicate to "Strategic Risks & Opportunities" tab of Risk module
  const syncToRiskManagement = (rowsList: EvaluationRow[]) => {
    try {
      let riskItems: any[] = [];
      const savedRisks = localStorage.getItem('iatf_draft_items_مدیریت ریسک و فرصت‌ها');
      if (savedRisks) {
        try {
          riskItems = JSON.parse(savedRisks);
        } catch {}
      } else {
        const dbVal = QmsDatabase.selectRow('documents_table', 'مدیریت ریسک و فرصت‌ها');
        if (dbVal && Array.isArray(dbVal)) riskItems = dbVal;
      }

      const activeEvalKeys = new Set<string>();
      const updatedRiskItems = [...riskItems];
      let newlyAddedCount = 0;

      for (const row of rowsList) {
        const { S, O, statusType } = getRowMetrics(row);
        const replicatedId = `strat-eval-replicated-${row.id}`;

        const refData = row.source ? getReferencedRowData(row.source, row.sourceKey || '', row.sourceTitleCol, row.sourceDescCol) : null;
        const displayTitle = refData ? refData.title : row.title;
        const displayDesc = row.desc || '';
        const isLinked = !!refData;
        const finalClause = isLinked ? (getClauseForSource(row.source) || row.clause || '4.1') : (row.clause || '4.1');

        if ((statusType === 'risk' || statusType === 'opportunity') && displayTitle && displayTitle.trim()) {
          activeEvalKeys.add(replicatedId);

          const existingIdx = updatedRiskItems.findIndex(i => i.id === replicatedId);
          
          if (existingIdx === -1) {
            newlyAddedCount++;
          }
          
          const activeNature: 'risk' | 'opportunity' = (row.nature === 'opportunity' || statusType === 'opportunity' || (displayTitle && (displayTitle.includes('فرصت') || displayTitle.toLowerCase().includes('opportunity'))) || (displayDesc && (displayDesc.includes('فرصت') || displayDesc.toLowerCase().includes('opportunity')))) ? 'opportunity' : 'risk';

          const replicatedItem = {
            id: replicatedId,
            associatedProcess: 'STRATEGIC_RISK_ASSOCIATED',
            type: 'strategic_risk',
            clauseId: finalClause,
            field1: activeNature === 'risk' ? `[جدول ارزیابی استراتژیک] ${displayTitle}: ${displayDesc}` : '',
            numeric1: O,
            numeric2: S,
            numeric3: O * S,
            field2: activeNature === 'risk' ? '[نیاز به تعیین اقدام اصلاحی / مهار ریسک استراتژیک]' : '',
            numeric4: 1,
            numeric5: 1,
            numeric6: 1,
            field3: activeNature === 'opportunity' ? `[جدول ارزیابی استراتژیک] ${displayTitle}: ${displayDesc}` : '',
            field4: activeNature === 'opportunity' ? '[نیاز به تعیین اقدام بهره‌برداری از فرصت استراتژیک]' : ''
          };

          if (existingIdx !== -1) {
            const existingItem = updatedRiskItems[existingIdx];
            const oldField2 = existingItem.field2 || '';
            const oldField4 = existingItem.field4 || '';
            const isUserAct2 = oldField2 && !oldField2.includes('[نیاز به') && oldField2.trim() !== '';
            const isUserAct4 = oldField4 && !oldField4.includes('[نیاز به') && oldField4.trim() !== '';

            updatedRiskItems[existingIdx] = {
              ...existingItem,
              clauseId: finalClause,
              numeric1: O,
              numeric2: S,
              numeric3: O * S,
              numeric4: 1,
              numeric5: 1,
              numeric6: 1,
              field1: activeNature === 'risk' ? `[جدول ارزیابی استراتژیک] ${displayTitle}: ${displayDesc}` : '',
              field2: activeNature === 'risk'
                ? (isUserAct2 ? oldField2 : '[نیاز به تعیین اقدام اصلاحی / مهار ریسک استراتژیک]')
                : '',
              field3: activeNature === 'opportunity' ? `[جدول ارزیابی استراتژیک] ${displayTitle}: ${displayDesc}` : '',
              field4: activeNature === 'opportunity'
                ? (isUserAct4 ? oldField4 : '[نیاز به تعیین اقدام بهره‌برداری از فرصت استراتژیک]')
                : ''
            };
          } else {
            updatedRiskItems.push(replicatedItem);
          }
        }
      }

      // Cleanup stale evaluations
      const finalRiskItems = updatedRiskItems.filter(item => {
        if (item.id && item.id.startsWith('strat-eval-replicated-')) {
          return activeEvalKeys.has(item.id);
        }
        return true;
      });

      localStorage.setItem('iatf_draft_items_مدیریت ریسک و فرصت‌ها', JSON.stringify(finalRiskItems));
      QmsDatabase.writeRow('documents_table', 'مدیریت ریسک و فرصت‌ها', finalRiskItems);
      
      if (newlyAddedCount > 0) {
        setNotification(isRtl
          ? `⚠️ تعداد ${newlyAddedCount} موضوع استراتژیک جدید به عنوان ریسک یا فرصت به مخزن ریسک‌ها کپی شد! جهت تکمیل کنترل، وارد این بخش شوید.`
          : `⚠️ Expanded! Copied ${newlyAddedCount} strategic items to the corporate risk register.`);
      }

      window.dispatchEvent(new Event('qms_db_updated'));
      onNotifyDbModified?.();
    } catch (e) {
      console.error('Error during automatic replication to risk FMEA module:', e);
    }
  };

  useEffect(() => {
    syncToRiskManagement(evalRows);
  }, [evalRows, thresholdMatrix]);

  const handleAddEvalRow = () => {
    const newId = `eval-${Date.now()}`;
    const newRow: EvaluationRow = {
      id: newId,
      title: '',
      desc: '',
      source: '',
      clause: '4.2',
      impactCustomer: 1,
      impactQuality: 1,
      impactProcess: 1,
      impactGoals: 1,
      impactLegal: 1,
      probability: 1,
      nature: 'risk'
    };
    setEvalRows([...evalRows, newRow]);
    setNotification(isRtl ? 'سطر جدید ارزیابی استراتژیک اضافه نائل آمد.' : 'New evaluation row added.');
  };

  const SOURCE_TO_CLAUSE_MAP: Record<string, string> = {
    'بافت سازمان (SWOT) - تهدید': '4.1',
    'بافت سازمان (SWOT) - قوت': '4.1',
    'بافت سازمان (SWOT) - ضعف': '4.1',
    'بافت سازمان (SWOT) - فرصت': '4.1',
    'تحلیل ذینفعان (بند ۴.۲)': '4.2',
    'بازنگری مدیریت (بند ۹.۳)': '9.3',
    'اهداف کیفیت': '6.2.1',
    'SWOT Threat (Context 4.1)': '4.1',
    'SWOT Strength (Context 4.1)': '4.1',
    'SWOT Weakness (Context 4.1)': '4.1',
    'SWOT Opportunity (Context 4.1)': '4.1',
    'Interested Parties (4.2)': '4.2',
    'Management Review (9.3)': '9.3',
    'Quality Targets': '6.2.1'
  };

  const handleUpdateEvalRow = (id: string, field: keyof EvaluationRow, val: any) => {
    setEvalRows(prev => prev.map(r => {
      if (r.id === id) {
        const updated = { ...r, [field]: val };
        if (field === 'source') {
          const matchedItem = items.find(i => i.title === val);
          if (matchedItem) {
            updated.clause = matchedItem.clauseId;
          } else {
            const autoClause = SOURCE_TO_CLAUSE_MAP[val];
            if (autoClause) {
              updated.clause = autoClause;
            }
          }
        }
        return updated;
      }
      return r;
    }));
  };

  const handleDisconnectRow = (evalRow: EvaluationRow) => {
    const ref = getReferencedRowData(evalRow.source, evalRow.sourceKey || '', evalRow.sourceTitleCol, evalRow.sourceDescCol);
    setEvalRows(prev => prev.map(r => {
      if (r.id === evalRow.id) {
        return {
          ...r,
          source: '',
          sourceKey: '',
          title: ref ? ref.title : r.title,
          desc: r.desc
        };
      }
      return r;
    }));
    setNotification(isRtl ? 'اتصال با دیتابیس قطع و داده‌ها به متن معمولی تبدیل شدند.' : 'Connection released. Synced data preserved as local text.');
  };

  const handleSaveConnection = (rowId: string) => {
    if (!connTable || !connTitleCol) return;
    
    let finalTitleCol = connTitleCol;
    let finalDescCol = connDescCol;
    
    if (!finalTitleCol && connColumns.length > 0) {
      const titleCandidates = ['title', 'titleFa', 'name', 'code', 'customer', 'item', 'documentName'];
      const matched = connColumns.find(c => titleCandidates.includes(c.id));
      finalTitleCol = matched ? matched.id : connColumns[0].id;
    }
    
    if (!finalDescCol && connColumns.length > 0) {
      const descCandidates = ['desc', 'description', 'target', 'preparedBy', 'reqFa', 'details'];
      const matched = connColumns.find(c => descCandidates.includes(c.id) && c.id !== finalTitleCol);
      finalDescCol = matched ? matched.id : (connColumns[1] ? connColumns[1].id : connColumns[0].id);
    }

    setEvalRows(prev => prev.map(r => {
      if (r.id === rowId) {
        const mappedClause = getClauseForSource(connTable);
        return {
          ...r,
          source: connTable,
          sourceKey: connKey || '', 
          sourceTitleCol: finalTitleCol,
          sourceDescCol: finalDescCol,
          title: '', 
          clause: mappedClause || r.clause || '4.1'
        };
      }
      return r;
    }));
    
    setActiveConnRowId(null);
    setConnTable('');
    setConnKey('');
    setConnTitleCol('');
    setConnDescCol('');
    setNotification(isRtl ? 'اتصال به دیتابیس با موفقیت برقرار شد!' : 'Database connection established successfully!');
  };

  const openHeaderConnModal = () => {
    setConnTable(headerConnTable || '');
    setConnTitleCol(headerConnTitleCol || '');
    setConnDescCol(headerConnDescCol || '');
    setConnRowId(headerConnRowId || '');
    setIsHeaderDbModalOpen(true);
  };

  const handleSaveHeaderConnection = (table: string, titleCol: string, descCol: string, rowId?: string) => {
    setHeaderConnTable(table);
    setHeaderConnTitleCol(titleCol);
    setHeaderConnDescCol(descCol || '');
    setHeaderConnRowId(rowId || '');
    localStorage.setItem('qms_strategic_evaluations_header_conn_table', table);
    localStorage.setItem('qms_strategic_evaluations_header_conn_title_col', titleCol);
    localStorage.setItem('qms_strategic_evaluations_header_conn_desc_col', descCol || '');
    localStorage.setItem('qms_strategic_evaluations_header_conn_row_id', rowId || '');
    
    if (rowId) {
      setEvalRows(prev => prev.map(r => ({
        ...r,
        source: table,
        sourceKey: rowId,
        sourceTitleCol: titleCol,
        sourceDescCol: descCol || '',
        title: '',
        desc: ''
      })));
    } else {
      setEvalRows(prev => prev.map(r => {
        if (!r.source || r.source === table) {
          return {
            ...r,
            source: table,
            sourceTitleCol: titleCol,
            sourceDescCol: descCol || ''
          };
        }
        return r;
      }));
    }

    setIsHeaderDbModalOpen(false);
    setIsHeaderDbTableSelectOpen(false);
    setNotification(isRtl ? 'اتصال دیتابیس ستون عنوان با موفقیت پیکربندی شد!' : 'Title column database connection configured successfully!');
  };

  const handleDisconnectHeaderConnection = () => {
    setHeaderConnTable('');
    setHeaderConnTitleCol('');
    setHeaderConnDescCol('');
    setHeaderConnRowId('');
    localStorage.removeItem('qms_strategic_evaluations_header_conn_table');
    localStorage.removeItem('qms_strategic_evaluations_header_conn_title_col');
    localStorage.removeItem('qms_strategic_evaluations_header_conn_desc_col');
    localStorage.removeItem('qms_strategic_evaluations_header_conn_row_id');
    
    setEvalRows(prev => prev.map(r => {
      if (r.source) {
        const ref = getReferencedRowData(r.source, r.sourceKey || '', r.sourceTitleCol, r.sourceDescCol);
        return {
          ...r,
          source: '',
          sourceKey: '',
          sourceTitleCol: '',
          sourceDescCol: '',
          title: ref ? ref.title : r.title,
          desc: ref ? ref.desc : r.desc
        };
      }
      return r;
    }));

    setIsHeaderDbModalOpen(false);
    setIsHeaderDbTableSelectOpen(false);
    setNotification(isRtl ? 'اتصال دیتابیس ستون عنوان قطع و داده‌ها به متن معمولی تبدیل شدند.' : 'Title column database connection released. Synced data preserved as local text.');
  };

  const handleDeleteEvalRow = (id: string) => {
    setDeleteConfirmId(id);
  };

  const handleCycleThresholdCell = (rIdx: number, cIdx: number) => {
    const updated = [...thresholdMatrix.map(row => [...row])];
    const current = updated[rIdx][cIdx];
    const next: 'important' | 'minor' = current === 'minor' ? 'important' : 'minor';
    
    updated[rIdx][cIdx] = next;
    setThresholdMatrix(updated);
  };

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Load manual mappings
  const manualMappings = useMemo<Record<string, string[]>>(() => {
    try {
      const dbMappings = QmsDatabase.selectAll(QmsDatabase.TABLES.PROCESS_MAPPINGS);
      if (dbMappings && Object.keys(dbMappings).length > 0) {
        return dbMappings as Record<string, string[]>;
      }
    } catch {}
    try {
      const rawMappings = localStorage.getItem('iatf_manual_clause_mappings');
      if (rawMappings) {
        return JSON.parse(rawMappings);
      }
    } catch {}
    return {};
  }, []);

  // Fetch Processes from Process-Requirements Matrix
  const processRows = useMemo(() => {
    try {
      return generateProcessRequirementsMatrix();
    } catch (e) {
      console.error('Error generating process requirements matrix:', e);
      return [];
    }
  }, []);

  // Check if process maps to strategic clause
  const isAssociated = (proc: any, clauseId: string) => {
    const procKey = proc.id || proc.field1;
    const manual = manualMappings[procKey] || manualMappings[proc.field1];
    if (manual && Array.isArray(manual)) {
      return manual.includes(clauseId);
    }
    const procClauseExpr = proc.clauseId || '4.4';
    return isClauseAssociated(clauseId, procClauseExpr);
  };

  // Get matching existing card from items state
  const getExistingCard = (procName: string, clauseId: string) => {
    const cleanProcName = procName.trim().toLowerCase();
    return items.find(item => {
      if (item.clauseId !== clauseId) return false;
      const cleanTitle = item.title.toLowerCase();
      return cleanTitle.includes(cleanProcName) || 
             cleanTitle.replace(/\s+/g, '').includes(cleanProcName.replace(/\s+/g, ''));
    });
  };

  // Generate cards for standard clause helper
  const handleCreateCardForIntersection = (procName: string, clauseId: string) => {
    const existing = getExistingCard(procName, clauseId);
    if (existing) return;

    const standardDocs = getStandardDocsForClause(clauseId);
    let linkedDoc = '';
    if (standardDocs && standardDocs.length > 0) {
      linkedDoc = standardDocs[0];
    }

    const title = isRtl 
      ? `ارزیابی استراتژیک ${procName} • بند ${clauseId}`
      : `Strategic Evaluation of ${procName} • Clause ${clauseId}`;

    const newId = `intersection-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    const newItem: StrategicItem = {
      id: newId,
      title,
      clauseId,
      linkedDoc,
      isCustom: true
    };

    setItems(prev => [...prev, newItem]);
    setNotification(isRtl 
      ? `کارت استراتژیک برای فرآیند "${procName}" (بند ${clauseId}) با موفقیت ایجاد گردید.`
      : `Strategic card created for process "${procName}" (Clause ${clauseId}) successfully.`
    );
  };

  // Batch generate all missing active intersection cards
  const handleBatchCreateCards = () => {
    const generated: StrategicItem[] = [];
    let count = 0;

    for (const proc of processRows) {
      const procName = (proc.field1 || '').trim();
      if (!procName) continue;

      for (const clauseId of STRATEGIC_CLAUSE_IDS) {
        if (isAssociated(proc, clauseId)) {
          const existing = getExistingCard(procName, clauseId);
          if (!existing) {
            const standardDocs = getStandardDocsForClause(clauseId);
            let linkedDoc = '';
            if (standardDocs && standardDocs.length > 0) {
              linkedDoc = standardDocs[0];
            }

            const title = isRtl 
              ? `ارزیابی استراتژیک ${procName} • بند ${clauseId}`
              : `Strategic Evaluation of ${procName} • Clause ${clauseId}`;

            const newId = `intersection-${Date.now()}-${count}-${Math.random().toString(36).substr(2, 5)}`;
            generated.push({
              id: newId,
              title,
              clauseId,
              linkedDoc,
              isCustom: true
            });
            count++;
          }
        }
      }
    }

    if (count > 0) {
      setItems(prev => [...prev, ...generated]);
      setNotification(isRtl 
        ? `تعداد ${count} کارت استراتژیک هوشمند جدید با موفقیت ایجاد گردید.` 
        : `Successfully created ${count} new smart strategic cards.`
      );
    } else {
      setNotification(isRtl 
        ? 'تمامی کارت‌های تقاطع این ماتریس از قبل وجود دارند و نیازی به کارت جدید نیست.' 
        : 'All intersection cards already exist, no new cards needed.'
      );
    }
  };

  // Automatically create cards for intersections in the Strategic Management-Requirements Matrix
  useEffect(() => {
    const generated: StrategicItem[] = [];
    let count = 0;

    for (const proc of processRows) {
      const procName = (proc.field1 || '').trim();
      if (!procName) continue;

      for (const clauseId of STRATEGIC_CLAUSE_IDS) {
        if (isAssociated(proc, clauseId)) {
          const existing = getExistingCard(procName, clauseId);
          if (!existing) {
            const standardDocs = getStandardDocsForClause(clauseId);
            let linkedDoc = '';
            if (standardDocs && standardDocs.length > 0) {
              linkedDoc = standardDocs[0];
            }

            const title = isRtl 
              ? `ارزیابی استراتژیک ${procName} • بند ${clauseId}`
              : `Strategic Evaluation of ${procName} • Clause ${clauseId}`;

            const newId = `intersection-auto-${Date.now()}-${count}-${Math.random().toString(36).substr(2, 5)}`;
            generated.push({
              id: newId,
              title,
              clauseId,
              linkedDoc,
              isCustom: true
            });
            count++;
          }
        }
      }
    }

    if (generated.length > 0) {
      setItems(prev => {
        const filteredNew: StrategicItem[] = [];
        for (const g of generated) {
          const match = prev.some(item => {
            if (item.clauseId !== g.clauseId) return false;
            const cleanTitleA = item.title.toLowerCase().replace(/\s+/g, '');
            const cleanTitleB = g.title.toLowerCase().replace(/\s+/g, '');
            return cleanTitleA === cleanTitleB;
          });
          if (!match) {
            filteredNew.push(g);
          }
        }
        if (filteredNew.length === 0) return prev;
        return [...prev, ...filteredNew];
      });
    }
  }, [processRows, manualMappings]);

  return (
    <div className="space-y-8 animate-fadeIn" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* DELETE CONFIRMATION DIALOG MODAL */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-[9999] animate-fade-in" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0F0F12] border border-zinc-800 p-6 rounded-2xl max-w-sm w-full mx-4 shadow-2xl space-y-4 text-right">
            <div className="flex items-center gap-3">
              <Trash2 size={24} className="text-rose-500 shrink-0" />
              <h3 className="text-sm font-black text-rose-500">
                {isRtl ? 'تایید حذف نهایی سطر ارزیابی' : 'Confirm Deletion'}
              </h3>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed font-sans">
              {isRtl
                ? 'آیا از حذف این سطر در جدول ارزیابی استراتژیک اطمینان دارید؟ با تایید شما، این سطر برای همیشه حذف خواهد شد.'
                : 'Are you sure you want to delete this strategic evaluation row? This action is permanent and cannot be undone.'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 text-xs bg-[#1D1D20] hover:bg-zinc-805 text-zinc-300 font-bold rounded-xl border border-zinc-800 transition-all cursor-pointer"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEvalRows(prev => prev.filter(r => r.id !== deleteConfirmId));
                  setDeleteConfirmId(null);
                  setNotification(isRtl ? 'سطر ارزیابی با موفقیت حذف گردید.' : 'Evaluation row deleted successfully.');
                }}
                className="px-4 py-2 text-xs bg-rose-500 hover:bg-rose-600 text-white font-black rounded-xl border border-rose-600/30 transition-all cursor-pointer shadow-lg shadow-rose-500/10"
              >
                {isRtl ? 'بله، حذف شود' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER COLUMN DATABASE CONNECTION MODAL */}
      {isHeaderDbModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 text-right" dir="rtl">
          <div className="bg-[#0F0F12] border border-[#27272C] rounded-2xl p-5 max-w-md w-full shadow-2xl flex flex-col max-h-[90vh] overflow-hidden gap-4 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-3 shrink-0">
              <div className="flex items-center gap-2 text-amber-500 font-extrabold text-xs">
                <Database size={16} className="text-amber-500 animate-pulse animate-duration-1000" />
                <span>{isRtl ? 'تنظیمات اتصال دیتابیس (پایگاه داده کیفیت QMS)' : 'QMS Database Connection Settings'}</span>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsHeaderDbModalOpen(false);
                  setIsHeaderDbTableSelectOpen(false);
                }}
                className="text-xs font-bold text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded-lg cursor-pointer transition-all"
              >
                {isRtl ? '✕ بستن' : '✕ Close'}
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4 custom-scrollbar max-h-[70vh]">
              {/* Column Info */}
              <div className="bg-[#16161B] border border-[#222225] p-3 rounded-lg flex flex-col gap-1 shrink-0">
                <div className="text-[10px] text-zinc-500">{isRtl ? 'ستون انتخابی شما:' : 'Selected Column:'}</div>
                <div className="text-xs font-black text-white flex items-center gap-1.5">
                  <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                    B
                  </span>
                  <span>{isRtl ? 'عنوان موضوع (ارزیابی استراتژیک)' : 'Topic Title (Strategic Evaluation)'}</span>
                </div>
              </div>

              {/* Target Table Dropdown */}
              <div className="flex flex-col gap-1 relative">
                <span className="text-[#65656F] text-[10px] font-bold">{isRtl ? 'جدول یا سند هدف جهت برقراری اتصال:' : 'Target Database Table:'}</span>
                <div className="relative w-full">
                  <button
                    type="button"
                    onClick={() => setIsHeaderDbTableSelectOpen(!isHeaderDbTableSelectOpen)}
                    className="bg-[#1A1A1C] border border-[#232326] hover:border-[#3A3A3F] text-xs text-white p-2.5 rounded-lg outline-none w-full text-right flex items-center justify-between cursor-pointer transition-all font-bold"
                  >
                    <span className="truncate">
                      {(() => {
                        const selected = dbConnectedOptions.find(t => t.id === connTable);
                        if (selected) {
                          return selected.name;
                        }
                        return isRtl ? '-- انتخاب جدول یا سند مرجع دیتابیس --' : '-- Choose Database Table --';
                      })()}
                    </span>
                    <ChevronDown size={14} className="text-[#65656F] shrink-0 mr-1" />
                  </button>

                  {isHeaderDbTableSelectOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#151518] border border-[#2B2B30] rounded-xl shadow-2xl z-50 flex flex-col max-h-[220px] overflow-hidden text-right w-full animate-fade-in">
                      {/* Search Box */}
                      <div className="p-1.5 border-b border-[#232326] flex items-center gap-1 bg-[#0E0E10]">
                        <Search size={12} className="text-zinc-500 shrink-0 ml-1" />
                        <input
                          type="text"
                          value={headerDbSearch}
                          onChange={(e) => setHeaderDbSearch(e.target.value)}
                          placeholder={isRtl ? "جستجوی جدول یا بند ممیزی..." : "Search table or clause..."}
                          className="bg-transparent border-none text-xs text-white w-full outline-none focus:ring-0 p-1 placeholder-zinc-600 font-bold"
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                        {headerDbSearch && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setHeaderDbSearch('');
                            }}
                            className="text-zinc-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-white/5 shrink-0"
                          >
                            {isRtl ? '✕ پاک کردن' : '✕ Clear'}
                          </button>
                        )}
                      </div>

                      {/* Options List */}
                      <div className="overflow-y-auto flex-1">
                        {(() => {
                          const filtered = dbConnectedOptions.filter(t => {
                            if (!headerDbSearch) return true;
                            const query = headerDbSearch.toLowerCase();
                            return t.name.toLowerCase().includes(query) || t.id.toLowerCase().includes(query);
                          });

                          if (filtered.length === 0) {
                            return (
                              <div className="p-4 text-center text-[10px] text-zinc-500">
                                {isRtl ? 'هیچ جدول یا سندی یافت نشد.' : 'No matching tables found.'}
                              </div>
                            );
                          }

                          return filtered.map(t => {
                            const clauseBadge = t.clauseNumber ? (
                              <span className="bg-[#FFA000]/10 text-[#FFB300] border border-[#FFB300]/25 text-[8px] font-bold px-1 py-0.5 rounded">
                                {isRtl ? `بند ${t.clauseNumber}` : `Cl. ${t.clauseNumber}`}
                              </span>
                            ) : null;

                            return (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => {
                                  setConnTable(t.id);
                                  setConnTitleCol('');
                                  setConnDescCol('');
                                  setConnRowId('');
                                  setIsHeaderDbTableSelectOpen(false);
                                  setHeaderDbSearch('');
                                }}
                                className={`w-full text-right px-3 py-2 hover:bg-amber-500/10 hover:text-white flex items-center justify-between text-xs border-b border-white/5 last:border-0 cursor-pointer ${connTable === t.id ? 'bg-amber-500/10 text-amber-400 font-bold' : 'text-[#A0A0AA]'}`}
                              >
                                <span>{t.name}</span>
                                {clauseBadge}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Mapped Database Column Dropdown */}
              {connTable && (
                <div className="flex flex-col gap-1 animate-fade-in">
                  <span className="text-[#65656F] text-[10px] font-bold">{isRtl ? 'ستون دیتابیس جهت تطابق و نمایش مقادیر:' : 'Column:'}</span>
                  <select
                    value={connTitleCol}
                    onChange={(e) => setConnTitleCol(e.target.value)}
                    className="bg-[#1A1A1C] border border-[#232326] text-xs text-white p-2.5 rounded-lg outline-none w-full text-right cursor-pointer font-bold focus:border-amber-500 hover:border-zinc-700 transition-all"
                  >
                    <option value="">{isRtl ? '-- انتخاب ستون دیتابیس --' : '-- Choose Column --'}</option>
                    {connColumns.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Target Row/Document Selector */}
              {connTable && connTitleCol && (
                <div className="flex flex-col gap-1 animate-fade-in">
                  {(() => {
                    const rows = getSourceRecords(connTable);
                    const hasRows = rows.length > 0;
                    return (
                      <>
                        <span className={`text-[#65656F] text-[10px] font-bold ${!hasRows ? 'opacity-50' : ''}`}>
                          {isRtl ? 'انتخاب ردیف / مدرک هدف (جهت اتصال به سلول قطعی):' : 'Target Row/Document (for static cell link):'}
                        </span>
                        <select
                          disabled={!hasRows}
                          value={connRowId}
                          onChange={(e) => setConnRowId(e.target.value)}
                          className={`bg-[#1A1A1C] border text-xs text-white p-2.5 rounded-lg outline-none w-full text-right transition-all font-bold ${
                            !hasRows 
                              ? 'border-[#232326] text-zinc-600 cursor-not-allowed opacity-50 bg-[#0E0E10]' 
                              : 'border-[#232326] cursor-pointer focus:border-amber-500 hover:border-zinc-700'
                          }`}
                        >
                          <option value="">{isRtl ? '-- انتخاب ردیف (اختیاری - جهت اتصال به سلول قطعی) --' : '-- Choose Row (Optional - for static cell link) --'}</option>
                          {rows.map((r, idx) => (
                            <option key={r.id} value={r.id}>
                              {`[${idx + 1}] ${r.title}`}
                            </option>
                          ))}
                        </select>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 border-t border-white/5 pt-3 shrink-0">
              <button
                type="button"
                disabled={!connTable || !connTitleCol}
                onClick={() => handleSaveHeaderConnection(connTable, connTitleCol, connDescCol, connRowId)}
                className="flex-1 py-2 bg-amber-500 disabled:bg-zinc-800 hover:bg-amber-400 text-black disabled:text-zinc-500 font-extrabold text-xs rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed text-center"
              >
                {isRtl ? 'تایید و ذخیره اتصال ستون' : 'Save Connection'}
              </button>
              {headerConnTable && (
                <button
                  type="button"
                  onClick={handleDisconnectHeaderConnection}
                  className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  {isRtl ? 'حذف اتصال' : 'Disconnect'}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsHeaderDbModalOpen(false);
                  setIsHeaderDbTableSelectOpen(false);
                }}
                className="px-4 py-2 bg-[#27272A] hover:bg-[#3F3F46] text-zinc-400 hover:text-zinc-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER BANNER */}
      <div className="bg-[#0E0E10] border border-[#1F1F22] rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl flex items-center justify-center">
                <Briefcase size={22} className="animate-pulse" />
              </div>
              <div>
                <span className="text-[9px] text-amber-500 font-extrabold uppercase tracking-widest bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded-full">
                  {isRtl ? 'مدیریت استراتژیک و تفکر مبتنی بر ریسک' : 'Strategic Management Suite'}
                </span>
                <h1 className="text-lg sm:text-xl font-black text-[#FAFAFA] mt-1.5 leading-none flex items-center gap-1.5">
                  <span>{isRtl ? 'داشبورد کنترل و پایش مدیریت استراتژیک' : 'Strategic Management Control Terminal'}</span>
                  {onPinToDashboard && (
                    <button
                      type="button"
                      onClick={onPinToDashboard}
                      className="text-amber-500 hover:text-amber-400 p-1 transition-all select-none text-xs sm:text-sm cursor-pointer ml-1 animate-pulse"
                      title={isRtl ? 'پین به داشبورد ابزار IATF' : 'Pin to IATF Tools Dashboard'}
                    >
                      📌
                    </button>
                  )}
                </h1>
              </div>
            </div>
            <p className="text-xs text-zinc-400 max-w-3xl leading-relaxed mt-2 pt-1">
              {isRtl 
                ? 'استخراج، مدلسازی و مانیتورینگ بیست و چهار ساعته تلاقی اهداف استراتژیک، نیازهای ذینفعان، تحلیل SWOT و بندهای متناظر در درگاه درختی کیفیت ملی IATF 16949 در ترکیب زنجیره‌ ارزش کارخانه.'
                : 'Enterprise tools for mapping and optimizing top-tier corporate SWOT criteria, stakeholder concerns, and Quality Targets aligned structure.'}
            </p>
          </div>
          <button 
            onClick={handleOpenAdd}
            className="self-start md:self-center bg-amber-500 hover:bg-amber-400 text-black font-black text-xs py-2.5 px-5 rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/10 select-none whitespace-nowrap"
          >
            <Plus size={15} />
            <span>{isRtl ? 'افزودن آیتم استراتژیک جدید' : 'Add Strategic Section'}</span>
          </button>
        </div>
      </div>

      {/* TAB SELECTOR */}
      <div className="flex flex-wrap border border-[#1A1A1D]/80 bg-[#121215] p-1 gap-2 self-start rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sliders size={13} />
          <span>{isRtl ? 'داشبورد کارت‌های استراتژیک' : 'Strategic Cards Dashboard'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
            activeTab === 'matrix'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Grid size={13} />
          <span>{isRtl ? 'ماتریس مدیریت استراتژیک - الزامات' : 'Strategic-Requirements Matrix'}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('evaluation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
            activeTab === 'evaluation'
              ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <FileText size={13} />
          <span>{isRtl ? 'جدول ارزیابی استراتژیک' : 'Strategic Evaluation Table'}</span>
        </button>
      </div>

      {/* SUCCESS NOTIFICATION TOAST */}
      {notification && (
        <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs py-3.5 px-4 rounded-xl flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0 animate-pulse" />
            <span className="font-bold">{notification}</span>
          </div>
          <button 
            type="button"
            onClick={() => setNotification(null)}
            className="text-emerald-500 hover:text-emerald-300 p-1 rounded-full hover:bg-emerald-500/10 transition-colors"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* STRATEGIC REGISTRY SECTION */}
      {activeTab === 'dashboard' && (
        <div className="bg-[#0E0E10] border border-[#1F1F22] rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex justify-between items-center border-b border-[#222225] pb-4">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-[#FAFAFA] tracking-wide flex items-center gap-2">
                <Sliders size={16} className="text-amber-500" />
                <span>{isRtl ? 'بخش‌های فعال مدیریت استراتژیک' : 'Strategic Directory'}</span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                {isRtl 
                  ? 'ثبت و مدیریت ابعاد تفکر استراتژیک و تطبیق آن‌ها با بندهای استاندارد IATF 16949 و فایل‌های مستندات سیستمی.' 
                  : 'Explore and manage strategic elements aligned with IATF 16949 standard sections and dynamic spreadsheets.'}
              </p>
            </div>
            <span className="text-xs bg-zinc-800 text-zinc-400 font-mono px-3 py-1 rounded-full border border-zinc-700/50">
              {isRtl ? `${items.length} بخش` : `${items.length} Sections`}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => {
              const standardDocs = getStandardDocsForClause(item.clauseId);
              const isLinked = !!item.linkedDoc;
              
              return (
                <div 
                  key={item.id} 
                  className={`p-5 rounded-xl border transition-all relative group flex flex-col justify-between min-h-[220px] ${
                    item.isPendingApproval
                      ? 'bg-amber-500/[0.04] border-amber-500/20 shadow-lg'
                      : isLinked || standardDocs.length > 0
                        ? 'bg-[#121215]/65 border-[#28282D] hover:border-amber-500/40 shadow-lg' 
                        : 'bg-zinc-900/10 border-[#1B1B1D] hover:border-zinc-800'
                  }`}
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.isPendingApproval && (
                          <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                            <span className="animate-pulse">⏳</span>
                            <span>{isRtl ? 'پیشنهادی' : 'Proposed'}</span>
                          </span>
                        )}
                        <span className="text-[10px] font-black text-amber-500 bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded font-mono shrink-0">
                          {isRtl ? `بند ${item.clauseId}` : `Clause ${item.clauseId}`}
                        </span>
                        <span className="text-xs font-black text-slate-200 line-clamp-1">{item.title}</span>
                      </div>
                      
                      {/* CRUD Controls */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => handleOpenEdit(item)}
                          className="text-zinc-500 hover:text-amber-400 p-1.5 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                          title={isRtl ? 'ویرایش بخش' : 'Edit'}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="text-zinc-500 hover:text-red-400 p-1.5 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer"
                          title={isRtl ? 'حذف بخش' : 'Delete'}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Requirement details: Clause Title */}
                    <div className="bg-[#18181C]/50 border border-zinc-800/30 p-2.5 rounded-lg space-y-1">
                      <div className="text-[10px] text-zinc-500 font-bold active:text-zinc-400">
                        {isRtl ? 'عنوان و شرح بند الزامات QMS:' : 'QMS Standard Clause Name:'}
                      </div>
                      <div className="text-[11px] text-zinc-300 font-extrabold leading-relaxed">
                        {STRATEGIC_CLAUSE_TITLES[item.clauseId]?.[lang] || item.clauseId}
                      </div>
                    </div>

                    {/* Created Document Links under standard clause */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-zinc-500 font-bold">
                        {isRtl ? '📄 مستندات فعال و ایجادشده در صفحه بند:' : '📄 Active Documents under Clause:'}
                      </div>
                      {standardDocs.length === 0 ? (
                        <div className="text-[10px] text-zinc-600 bg-zinc-950/20 p-2 rounded border border-dashed border-zinc-800/30">
                          {isRtl ? 'هیچ مستندی مستقل در این بند ایجاد نشده است' : 'No document created under this standard clause yet.'}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                          {standardDocs.map((doc, dIdx) => (
                            <button
                              key={dIdx}
                              onClick={() => {
                                onOpenDocument(doc);
                                if (onSelectClauseId) {
                                  onSelectClauseId(item.clauseId);
                                }
                              }}
                              className="w-full text-right text-[10.5px] font-bold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/30 px-2.5 py-1.5 rounded-lg flex items-center justify-between gap-2 cursor-pointer transition-all hover:translate-x-1"
                              title={isRtl ? 'کلیک جهت گشودن و ویرایش فوری مستند فنی' : 'Click to edit document'}
                            >
                              <span className="truncate">{doc}</span>
                              <ExternalLink size={10} className="shrink-0 text-amber-500" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Manual Mapped Document Conn */}
                  <div className="mt-4 pt-4 border-t border-[#1C1C1F] flex items-center justify-between gap-2">
                    {isLinked ? (
                      <button
                        onClick={() => onOpenDocument(item.linkedDoc!)}
                        className="text-xs font-bold text-teal-400 flex items-center gap-2 hover:text-teal-300 transition-colors bg-teal-500/5 border border-teal-500/10 hover:border-teal-500/20 px-3 py-2 rounded-lg w-full justify-center group-hover:bg-teal-500/10 cursor-pointer text-center"
                        title={isRtl ? `کلیک جهت ورود و ویرایش مستند: ${item.linkedDoc}` : `Click to open sheet: ${item.linkedDoc}`}
                      >
                        <FileText size={14} className="shrink-0 text-teal-400" />
                        <span className="truncate max-w-[180px]">{item.linkedDoc}</span>
                        <ExternalLink size={10} className="shrink-0 text-teal-500" />
                      </button>
                    ) : (
                      <div className="relative w-full">
                        <button
                          onClick={() => setLinkingItemId(linkingItemId === item.id ? null : item.id)}
                          className="text-xs bg-[#1E1E24] hover:bg-[#2A2A33] text-zinc-400 border border-zinc-700/50 font-bold px-3 py-2 rounded-lg flex items-center justify-center gap-2 transition-all cursor-pointer w-full"
                        >
                          <Link2 size={13} />
                          <span>{isRtl ? 'پیوند دستی به اسناد فرعی دیگر' : 'Link Other Document Manually'}</span>
                        </button>

                        {linkingItemId === item.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setLinkingItemId(null)} />
                            <div className="absolute bottom-full left-0 right-0 mb-2 bg-[#121215] border border-[#2B2B2F] rounded-xl shadow-2xl p-2.5 z-50 animate-fadeIn text-right max-h-48 overflow-y-auto custom-scrollbar">
                              <div className="text-[10px] text-zinc-500 font-bold mb-1.5 border-b border-white/5 pb-1">
                                {isRtl ? 'مستندات بند همنام در درخت استاندارد:' : 'Standard matched Documents:'}
                              </div>
                              {standardDocs.length === 0 ? (
                                <div className="p-2 text-[10px] text-zinc-500">
                                  {isRtl ? 'سندی در بند همنام ثبت نشده است.' : 'No docs under this item.'}
                                </div>
                              ) : (
                                standardDocs.map((doc, dIdx) => (
                                  <button
                                    key={dIdx}
                                    onClick={() => {
                                      setItems(items.map(i => i.id === item.id ? { ...i, linkedDoc: doc } : i));
                                      setLinkingItemId(null);
                                    }}
                                    className="w-full text-right p-1.5 text-[11px] text-zinc-300 hover:text-white hover:bg-white/5 rounded transition-all flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <span>🔗</span>
                                    <span className="truncate">{doc}</span>
                                  </button>
                                ))
                              )}

                              <div className="text-[10px] text-zinc-500 font-bold mt-2.5 mb-1.5 border-b border-white/5 pb-1">
                                {isRtl ? 'سایر اسناد فعال کل سیستم:' : 'All Active QMS Documents:'}
                              </div>
                              {allDocList.map((doc, dIdx) => (
                                <button
                                  key={`all-${dIdx}`}
                                  onClick={() => {
                                    setItems(items.map(i => i.id === item.id ? { ...i, linkedDoc: doc } : i));
                                    setLinkingItemId(null);
                                  }}
                                  className="w-full text-right p-1.5 text-[11px] text-zinc-300 hover:text-white hover:bg-[#202024] rounded transition-all flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>📄</span>
                                  <span className="truncate">{doc}</span>
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[#1C1C1F] flex justify-end">
            <button
              onClick={() => handleGoToClauseInTree('4.4')}
              className="bg-[#18181B] hover:bg-[#202024] text-zinc-300 border border-zinc-800 hover:border-zinc-700 text-xs font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Database size={14} className="text-amber-500" />
              <span>{isRtl ? 'مشاهده نقشه فرآیندها (بند 4.4)' : 'View Process Map (Clause 4.4)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* MATRIC TAB VIEW */}
      {activeTab === 'matrix' && (
        <div className="bg-[#0E0E10] border border-[#1F1F22] rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222225] pb-4">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-[#FAFAFA] tracking-wide flex items-center gap-2">
                <Grid size={16} className="text-amber-500" />
                <span>{isRtl ? 'ماتریس مدیریت استراتژیک - الزامات (سطر و ستون متناظر)' : 'Strategic Management - Requirements Matrix (Transposed)'}</span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                {isRtl 
                  ? 'انطباق و تعیین تلاقی فرآیندهای ده‌گانه با بندها و اهداف استراتژیک (ستون فرآیندها، سطر الزامات سیستم).' 
                  : 'Traceability and intersection matrix: Columns represent business processes, Rows represent standard/strategic requirements.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleBatchCreateCards}
              className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[11px] py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-amber-500/15"
              title={isRtl ? 'تولید گروهی کارت‌های استراتژیک در داشبورد' : 'Generate all active mappings'}
            >
              <RefreshCw size={13} />
              <span>{isRtl ? 'همگام‌سازی و تولید گروهی کارت‌های تلاقی' : 'Sync & Batch Create Intersections'}</span>
            </button>
          </div>

          <div className="overflow-x-auto custom-scrollbar -mx-6 sm:mx-0">
            <table className="w-full text-right border-collapse min-w-[1240px]">
              <thead>
                <tr className="border-b border-[#202023] bg-[#121215]/80">
                  <th className="p-3.5 text-xs text-[#FAFAFA] font-black w-[20%]">
                    {isRtl ? 'بند استراتژیک IATF 16949 / الزامات' : 'Strategic Standard Clause / Requirements'}
                  </th>
                  {processRows.map((proc, index) => {
                    const procName = (proc.field1 || '').trim();
                    const procType = proc.field2 || 'COPs';
                    return (
                      <th key={proc.id || index} className="p-3 text-center border-l border-[#1B1B1E] min-w-[110px] max-w-[140px]">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className="text-[10px] font-black text-amber-500 font-mono bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                            {procType}
                          </span>
                          <span className="text-[9.5px] text-[#FAFAFA] font-bold text-center line-clamp-2 max-h-[2.4rem] overflow-hidden leading-snug" title={procName}>
                            {procName}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {processRows.length === 0 ? (
                  <tr>
                    <td colSpan={processRows.length + 1} className="p-12 text-center text-xs text-zinc-500">
                      {isRtl 
                        ? 'هیچ فرآیندی در سیستم تعریف نشده است. لطفاً ابتدا شناسنامه فرآیندها را تعریف کنید.'
                        : 'No business processes defined.'}
                    </td>
                  </tr>
                ) : (
                  STRATEGIC_CLAUSE_IDS.map((clauseId) => {
                    const titleObj = STRATEGIC_CLAUSE_TITLES[clauseId] || { fa: '', en: '' };
                    return (
                      <tr key={clauseId} className="hover:bg-[#121215]/40 border-b border-[#1A1A1D] transition-colors">
                        <td className="p-3.5 text-right">
                          <div className="flex items-start gap-2">
                            <span className="text-[10px] font-black text-amber-400 font-mono bg-amber-400/10 border border-amber-500/20 px-1.5 py-0.5 rounded mt-0.5">
                              {clauseId}
                            </span>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-200 leading-tight">
                                {isRtl ? titleObj.fa : titleObj.en}
                              </span>
                            </div>
                          </div>
                        </td>
                        {processRows.map((proc, pIndex) => {
                          const procName = (proc.field1 || '').trim();
                          const associated = isAssociated(proc, clauseId);
                          
                          if (!associated) {
                            return (
                              <td key={`${clauseId}-${pIndex}`} className="p-3 text-center border-l border-[#1A1A1D]/80">
                                <span className="text-zinc-700 font-mono text-xs select-none">—</span>
                              </td>
                            );
                          }

                          const existingCard = getExistingCard(procName, clauseId);

                          return (
                            <td key={`${clauseId}-${pIndex}`} className="p-3 text-center border-l border-[#1A1A1D]/80 bg-amber-500/[0.015]">
                              {existingCard ? (
                                <div className="flex flex-col items-center justify-center gap-1.5">
                                  <span 
                                    onClick={() => setActiveTab('dashboard')}
                                    className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded cursor-pointer transition-all hover:bg-emerald-500/20"
                                    title={isRtl ? 'مشاهده در داشبورد کارت‌ها' : 'View in dashboard'}
                                  >
                                    <span className="text-[10px]">✓</span>
                                    <span>{isRtl ? 'فعال' : 'Active'}</span>
                                  </span>
                                  {existingCard.linkedDoc && (
                                    <button
                                      type="button"
                                      onClick={() => onOpenDocument(existingCard.linkedDoc!)}
                                      className="text-[9px] text-amber-500 hover:text-amber-400 underline cursor-pointer truncate max-w-[90px] font-bold block"
                                      title={existingCard.linkedDoc}
                                    >
                                      {isRtl ? 'مشاهده سند' : 'Open Sheet'}
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleCreateCardForIntersection(procName, clauseId)}
                                  className="inline-flex items-center gap-1 text-[9px] font-black text-amber-500 hover:text-black bg-amber-500/5 hover:bg-amber-500 border border-amber-500/25 hover:border-amber-500/50 px-2 py-0.5 rounded transition-all cursor-pointer shadow-sm shadow-amber-500/5"
                                  title={isRtl ? 'ایجاد کارت استراتژیک منفرد' : 'Generate card'}
                                >
                                  <Plus size={10} strokeWidth={3} />
                                  <span>{isRtl ? 'ساخت کارت' : 'Add Card'}</span>
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="pt-4 border-t border-[#1C1C1F] flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] text-zinc-500 font-bold">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-amber-500/20 border border-amber-500/30 inline-block"></span>
                <span>{isRtl ? 'فرآیند به بند متصل است' : 'Correlation active'}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 inline-block"></span>
                <span>{isRtl ? 'فاقد ارتباط تعریف شده' : 'No relation'}</span>
              </span>
            </div>
            <button
              onClick={() => handleGoToClauseInTree('4.4')}
              className="bg-[#18181B] hover:bg-[#202024] text-zinc-300 border border-zinc-800 hover:border-zinc-700 text-xs font-bold py-2.5 px-6 rounded-xl flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Database size={14} className="text-amber-500" />
              <span>{isRtl ? 'مشاهده نقشه فرآیندها (بند 4.4)' : 'View Process Map (Clause 4.4)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* EVALUATION TAB VIEW */}
      {activeTab === 'evaluation' && (
        <div className="bg-[#0E0E10] border border-[#1F1F22] rounded-2xl p-6 sm:p-8 shadow-xl space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#222225] pb-4">
            <div className="space-y-1">
              <h3 className="text-sm font-black text-[#FAFAFA] tracking-wide flex items-center gap-2">
                <FileText size={16} className="text-amber-500" />
                <span>{isRtl ? 'جدول ارزیابی استراتژیک' : 'Strategic Evaluation Table'}</span>
              </h3>
              <p className="text-[11px] text-zinc-400">
                {isRtl 
                  ? 'برآورد و ارزیابی چندبعدی موضوعات استراتژیک بر اساس تحلیل ریسک و فرصت و بندهای ۹۰۰۱ و IATF' 
                  : 'Multi-dimensional strategic evaluation based on SWOT and risk analyses'}
              </p>
            </div>
            <button
              onClick={handleAddEvalRow}
              className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/10 cursor-pointer active:scale-95 shrink-0"
              type="button"
            >
              <Plus size={14} strokeWidth={2.5} />
              <span>{isRtl ? 'ایجاد سطر ارزیابی جدید' : 'New Evaluation Row'}</span>
            </button>
          </div>

                    <div className="overflow-x-auto custom-scrollbar -mx-6 sm:mx-0">
            <table className="w-full text-right border-collapse min-w-[1400px] border border-zinc-800">
              <thead>
                <tr className="border-b border-zinc-800 bg-[#121215]/80 text-[10.5px]">
                  <th className="p-3 text-center text-zinc-400 font-bold w-[3%] border border-zinc-800">{isRtl ? 'ردیف' : 'Row'}</th>
                  <th className="p-3 text-zinc-300 font-black w-[15%] border border-zinc-800 text-right">
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{isRtl ? 'عنوان موضوع' : 'Topic Title'}</span>
                      {headerConnTable ? (
                        <button
                          type="button"
                          onClick={openHeaderConnModal}
                          className="text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg p-1 transition-all cursor-pointer flex items-center gap-1.5 text-[9px] font-black animate-pulse animate-duration-1000"
                          title={isRtl ? 'اتصال ستون برقرار است. ویرایش پیکربندی دیتابیس ستون' : 'Active Title Column DB Link. Configure column database link.'}
                        >
                          <Database size={11} className="text-emerald-400" />
                          <span>{isRtl ? 'متصل' : 'Linked'}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={openHeaderConnModal}
                          className="text-zinc-500 hover:text-amber-500 bg-zinc-500/5 hover:bg-amber-500/10 border border-zinc-700 hover:border-amber-500/30 rounded-lg p-1 transition-all cursor-pointer flex items-center gap-1 text-[9px] font-bold"
                          title={isRtl ? 'اتصال کل ستون عنوان به یکی از جداول دیتابیس QMS' : 'Connect this whole column to live database records'}
                        >
                          <Database size={10} />
                          <span>{isRtl ? 'اتصال دیتابیس' : 'DB Link'}</span>
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="p-3 text-right text-zinc-300 font-black w-[25%] border border-zinc-800">{isRtl ? 'شرح موضوع' : 'Description'}</th>
                  <th className="p-3 text-center text-[#FAFAFA] font-black w-[8%] border border-zinc-800">{isRtl ? 'ماهیت موضوع' : 'Nature'}</th>
                  <th className="p-2.5 text-center text-amber-500 font-bold w-[5%] border border-zinc-800">{isRtl ? 'اثر بر مشتری (۱-۵)' : 'Customer Impact'}</th>
                  <th className="p-2.5 text-center text-amber-500 font-bold w-[5%] border border-zinc-800">{isRtl ? 'اثر بر کیفیت (۱-۵)' : 'Quality Impact'}</th>
                  <th className="p-2.5 text-center text-amber-500 font-bold w-[5%] border border-zinc-800">{isRtl ? 'اثر بر فرآیندها (۱-۵)' : 'Process Impact'}</th>
                  <th className="p-2.5 text-center text-amber-500 font-bold w-[5%] border border-zinc-800">{isRtl ? 'اثر بر اهداف (۱-۵)' : 'Goals Impact'}</th>
                  <th className="p-2.5 text-center text-amber-500 font-bold w-[5%] border border-zinc-800">{isRtl ? 'الزام قانونی (۱-۵)' : 'Legal Impact'}</th>
                  <th className="p-2.5 text-center text-emerald-400 font-bold w-[5%] border border-zinc-800">{isRtl ? 'احتمال وقوع (۱-۵)' : 'Probability'}</th>
                  <th className="p-3 text-center text-zinc-300 font-black w-[6%] border border-zinc-800">{isRtl ? 'امتیاز کل' : 'Total Score'}</th>
                  <th className="p-3 text-center text-[#FAFAFA] font-black w-[10%] border border-zinc-800">{isRtl ? 'وضعیت نهایی' : 'Status'}</th>
                  <th className="p-3 text-center w-[4%] border border-zinc-800"></th>
                </tr>
              </thead>
              <tbody>
                {evalRows.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="p-12 text-center text-xs text-zinc-500">
                      {isRtl 
                        ? 'هیچ موضوع ارزیابی استراتژیک ثبت نشده است. دکمه بالا را برای ایجاد سطر جدید فشار دهید.'
                        : 'No strategic evaluations recorded yet.'}
                    </td>
                  </tr>
                ) : (
                  evalRows.map((row, idx) => {
                    const { S, O, totalScore, statusType } = getRowMetrics(row);
                    const formattedScore = new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US').format(totalScore);
                    const refData = row.source ? getReferencedRowData(row.source, row.sourceKey || '', row.sourceTitleCol, row.sourceDescCol) : null;
                    const displayTitle = refData ? refData.title : row.title;
                    const displayDesc = refData ? refData.desc : row.desc;
                    const isLinked = !!refData;
                    const isSourceTable = row.source && (row.source.startsWith('doc_') || row.source.endsWith('_table') || items.some(i => i.title === row.source && i.linkedDoc));
                    const linkedRecords = isSourceTable ? getSourceRecords(row.source) : [];
                    const sourceOption = dbConnectedOptions.find(opt => opt.id === row.source);
                    const sourceLabel = sourceOption ? sourceOption.name : (row.source || (isRtl ? 'کارت استراتژیک' : 'Strategic Card'));

                    return (
                      <tr key={row.id} className={`hover:bg-[#121215]/50 border-b border-zinc-800 transition-all text-xs ${row.isPendingApproval ? 'bg-amber-500/[0.04] border-amber-500/20' : ''}`}>
                        {/* 1. Row Index */}
                        <td className="p-3 text-center text-zinc-500 font-mono font-bold w-[3%] border border-zinc-800">
                          {idx + 1}
                        </td>

                         {/* 2. Topic Title */}
                        <td className="p-1.5 min-w-[220px] w-[15%] border border-zinc-800">
                          {row.isPendingApproval && (
                            <div className="mb-1 text-[10px] font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-1 w-max">
                              <span className="animate-pulse">⏳</span>
                              <span>{isRtl ? 'در انتظار تأیید ادمین' : 'Pending Admin Approval'}</span>
                            </div>
                          )}
                          {headerConnTable ? (
                            <div className="flex flex-col gap-1 w-full relative">
                              <div className="relative w-full flex items-center">
                                <span className={isRtl ? "absolute right-2 text-emerald-400 text-xs" : "absolute left-2 text-emerald-400 text-xs"} title={isRtl ? 'اتصال برقرار است' : 'Link Active'}>🔗</span>
                                <select
                                  value={row.sourceKey || ''}
                                  onChange={(e) => {
                                    const keyVal = e.target.value;
                                    if (keyVal) {
                                      setEvalRows(prev => prev.map(r => {
                                        if (r.id === row.id) {
                                          return {
                                            ...r,
                                            source: headerConnTable,
                                            sourceKey: keyVal,
                                            sourceTitleCol: headerConnTitleCol,
                                            sourceDescCol: headerConnDescCol || '',
                                            title: '', // dynamically resolved
                                            desc: headerConnDescCol ? '' : r.desc // dynamically resolved if desc col is set
                                          };
                                        }
                                        return r;
                                      }));
                                    } else {
                                      // Disconnect this specific row
                                      setEvalRows(prev => prev.map(r => {
                                        if (r.id === row.id) {
                                          return {
                                            ...r,
                                            source: '',
                                            sourceKey: '',
                                            sourceTitleCol: '',
                                            sourceDescCol: '',
                                            title: displayTitle, // preserve the resolved value as normal text
                                            desc: displayDesc
                                          };
                                        }
                                        return r;
                                      }));
                                    }
                                  }}
                                  className={`w-full bg-[#101F18]/70 border border-emerald-500/40 text-xs text-emerald-400 font-black rounded-lg p-1.5 outline-none cursor-pointer ${isRtl ? 'pr-7' : 'pl-7'}`}
                                >
                                  <option value="" className="text-zinc-500 bg-[#121215]">{isRtl ? '-- انتخاب ردیف دیتابیس QMS --' : '-- Choose Record --'}</option>
                                  {getSourceRecords(headerConnTable).map(rec => (
                                    <option key={rec.id} value={rec.id} className="text-zinc-300 bg-[#121215]">
                                      {rec.title}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {row.sourceKey && (
                                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                  <span className="text-[9px] text-emerald-400 font-black bg-emerald-500/10 px-1 py-0.5 rounded flex items-center gap-0.5 font-mono">
                                    <span>{isRtl ? 'منبع: ' : 'Src: '}</span>
                                    {(() => {
                                      const connectedClause = getClauseForSource(row.source);
                                      const displaySourceLabel = connectedClause 
                                        ? `${sourceLabel} • ${isRtl ? 'بند' : 'Clause'} ${connectedClause}` 
                                        : sourceLabel;
                                      return (
                                        <span className="truncate max-w-[240px]" title={displaySourceLabel}>
                                          {displaySourceLabel}
                                        </span>
                                      );
                                    })()}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      // Disconnect
                                      setEvalRows(prev => prev.map(r => {
                                        if (r.id === row.id) {
                                          return {
                                            ...r,
                                            source: '',
                                            sourceKey: '',
                                            sourceTitleCol: '',
                                            sourceDescCol: '',
                                            title: displayTitle,
                                            desc: displayDesc
                                          };
                                        }
                                        return r;
                                      }));
                                    }}
                                    className="text-[9px] text-rose-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/20 font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer"
                                    title={isRtl ? 'قطع اتصال این ردیف' : 'Disconnect this row'}
                                  >
                                    {isRtl ? 'قطع اتصال' : 'Disconnect'}
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            isLinked ? (
                              <div className="flex flex-col gap-1 w-full relative">
                                <div className="relative w-full flex items-center">
                                  <span className={isRtl ? "absolute right-2 text-emerald-400 text-xs" : "absolute left-2 text-emerald-400 text-xs"} title={isRtl ? 'اتصال برقرار است' : 'Link Active'}>🔗</span>
                                  <input
                                    type="text"
                                    value={displayTitle}
                                    disabled
                                    className={`w-full bg-[#101F18]/70 border border-emerald-500/40 text-xs text-emerald-400 font-black rounded-lg p-1.5 outline-none cursor-not-allowed select-all ${isRtl ? 'pr-7' : 'pl-7'}`}
                                    title={isRtl ? 'این بخش به دیتابیس متصل است' : 'Connected to live database.'}
                                  />
                                </div>
                                <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                  <span className="text-[9px] text-emerald-400 font-black bg-emerald-500/10 px-1 py-0.5 rounded flex items-center gap-0.5 font-mono">
                                    <span>{isRtl ? 'منبع: ' : 'Src: '}</span>
                                    {(() => {
                                      const connectedClause = getClauseForSource(row.source);
                                      const displaySourceLabel = connectedClause 
                                        ? `${sourceLabel} • ${isRtl ? 'بند' : 'Clause'} ${connectedClause}` 
                                        : sourceLabel;
                                      return (
                                        <span className="truncate max-w-[240px]" title={displaySourceLabel}>
                                          {displaySourceLabel}
                                        </span>
                                      );
                                    })()}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDisconnectRow(row)}
                                    className="text-[9px] text-rose-400 hover:text-rose-300 bg-rose-500/5 hover:bg-rose-500/15 border border-rose-500/20 font-bold px-1.5 py-0.5 rounded transition-all cursor-pointer"
                                    title={isRtl ? 'قطع اتصال زنده دیتابیس' : 'Disconnect live database connection'}
                                  >
                                    {isRtl ? 'قطع اتصال' : 'Disconnect'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={row.title}
                                onChange={(e) => handleUpdateEvalRow(row.id, 'title', e.target.value)}
                                className="w-full bg-[#141417] border border-zinc-800 focus:border-amber-500/50 text-xs text-white rounded-lg p-1.5 outline-none font-bold text-slate-200"
                                placeholder={isRtl ? 'موضوع ریسک یا فرصت...' : 'Enter topic...'}
                              />
                            )
                          )}
                        </td>

                        {/* 3. Description */}
                        <td className="p-1.5 min-w-[250px] w-[25%] border border-zinc-800">
                          <textarea
                            value={row.desc}
                            rows={1}
                            onChange={(e) => handleUpdateEvalRow(row.id, 'desc', e.target.value)}
                            className="w-full min-h-[32px] bg-[#141417] border border-zinc-800 focus:border-amber-500/40 text-xs text-zinc-300 rounded p-1.5 outline-none resize-y text-slate-200"
                            placeholder={isRtl ? 'ابعاد و پیامدهای این سناریو...' : 'Enter details...'}
                          />
                        </td>



                        {/* 4.5. Nature of Subject (Risk / Opportunity) */}
                        <td className="p-1.5 text-center w-[8%] border border-zinc-800">
                          <select
                            value={row.nature || 'risk'}
                            onChange={(e) => handleUpdateEvalRow(row.id, 'nature', e.target.value as any)}
                            className="bg-[#141417] border border-zinc-800 focus:border-[#F59E0B]/30 text-xs text-[#FAFAFA] font-black rounded p-1.5 outline-none cursor-pointer text-center w-full min-w-[70px]"
                          >
                            <option value="risk" className="text-red-400 font-bold">{isRtl ? 'ریسک ⚠️' : 'Risk ⚠️'}</option>
                            <option value="opportunity" className="text-emerald-400 font-bold">{isRtl ? 'فرصت 🎯' : 'Opportunity 🎯'}</option>
                          </select>
                        </td>



                        {/* 6. Impact Customer */}
                        <td className="p-1 text-center w-[5%] border border-zinc-800">
                          <select
                            value={row.impactCustomer}
                            onChange={(e) => handleUpdateEvalRow(row.id, 'impactCustomer', parseInt(e.target.value, 10))}
                            className="bg-[#141417] border border-zinc-800 hover:border-amber-500/30 text-xs font-bold text-center text-slate-300 rounded p-1 outline-none cursor-pointer"
                          >
                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>

                        {/* 7. Impact Product Quality */}
                        <td className="p-1 text-center w-[5%] border border-zinc-800">
                          <select
                            value={row.impactQuality}
                            onChange={(e) => handleUpdateEvalRow(row.id, 'impactQuality', parseInt(e.target.value, 10))}
                            className="bg-[#141417] border border-zinc-800 hover:border-amber-500/30 text-xs font-bold text-center text-slate-300 rounded p-1 outline-none cursor-pointer"
                          >
                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>

                        {/* 8. Impact Processes */}
                        <td className="p-1 text-center w-[5%] border border-zinc-800">
                          <select
                            value={row.impactProcess}
                            onChange={(e) => handleUpdateEvalRow(row.id, 'impactProcess', parseInt(e.target.value, 10))}
                            className="bg-[#141417] border border-zinc-800 hover:border-amber-500/30 text-xs font-bold text-center text-slate-300 rounded p-1 outline-none cursor-pointer"
                          >
                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>

                        {/* 9. Impact Goals */}
                        <td className="p-1 text-center w-[5%] border border-zinc-800">
                          <select
                            value={row.impactGoals}
                            onChange={(e) => handleUpdateEvalRow(row.id, 'impactGoals', parseInt(e.target.value, 10))}
                            className="bg-[#141417] border border-zinc-800 hover:border-amber-500/30 text-xs font-bold text-center text-slate-300 rounded p-1 outline-none cursor-pointer"
                          >
                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>

                        {/* 10. Impact Legal Requirements */}
                        <td className="p-1 text-center w-[5%] border border-zinc-800">
                          <select
                            value={row.impactLegal}
                            onChange={(e) => handleUpdateEvalRow(row.id, 'impactLegal', parseInt(e.target.value, 10))}
                            className="bg-[#141417] border border-zinc-800 hover:border-amber-500/30 text-xs font-bold text-center text-slate-300 rounded p-1 outline-none cursor-pointer"
                          >
                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>

                        {/* 11. Probability */}
                        <td className="p-1 text-center w-[5%] border border-zinc-800">
                          <select
                            value={row.probability}
                            onChange={(e) => handleUpdateEvalRow(row.id, 'probability', parseInt(e.target.value, 10))}
                            className="bg-[#141417] border border-[#10B981]/20 hover:border-[#10B981]/50 text-xs font-black text-center text-emerald-400 rounded p-1 outline-none cursor-pointer"
                          >
                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </td>

                        {/* 12. Computed Product Score */}
                        <td className="p-3 text-center font-mono font-bold text-blue-400 w-[6%] border border-zinc-800">
                          {formattedScore}
                        </td>

                        {/* 13. Threshold computed Status */}
                        <td className="p-3 text-center w-[10%] border border-zinc-800">
                          {statusType === 'risk' && (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2.5 py-1 rounded-full animate-pulse">
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                              <span>{isRtl ? 'ریسک استراتژیک' : 'Strategic Risk'}</span>
                            </span>
                          )}
                          {statusType === 'opportunity' && (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              <span>{isRtl ? 'فرصت استراتژیک' : 'Strategic Opportunity'}</span>
                            </span>
                          )}
                          {statusType === 'minor' && (
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-black text-zinc-500 bg-zinc-500/5 border border-zinc-500/10 px-2.5 py-1 rounded-full">
                              <span className="h-1 w-1 rounded-full bg-zinc-500" />
                              <span>{isRtl ? 'کم اهمیت' : 'Low Importance'}</span>
                            </span>
                          )}
                        </td>

                        {/* 14. Actions */}
                        <td className="p-3 text-center w-[4%] border border-zinc-800">
                          <button
                            type="button"
                            onClick={() => handleDeleteEvalRow(row.id)}
                            className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-red-500/5 transition-all cursor-pointer"
                            title={isRtl ? 'حذف سطر ممیزی' : 'Delete row'}
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* LOWER SECTION: Interactive 5x5 Threshold Matrix & Explanations */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 border-t border-[#1C1C1F]">
            {/* Standard instruction & sync statistics */}
            <div className="lg:col-span-7 space-y-4 text-right">
              <div className="bg-[#121215]/60 border border-zinc-800/40 p-5 rounded-2xl space-y-3">
                <h4 className="text-xs font-black text-[#FAFAFA] flex items-center gap-2">
                  <RefreshCw size={13} className="text-amber-500 animate-spin animate-infinite" style={{ animationDuration: '6s' }} />
                  <span>{isRtl ? 'درگاه توزیع هوشمند ارزیابی‌های استراتژیک' : 'Real-time Strategic Distribution Hub'}</span>
                </h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  {isRtl
                    ? 'سیستم به صورت هوشمند میانگین شدت‌های ثبت شده موضوع را محاسبه کرده و بر اساس محور احتمال وقوع با ماتریس آستانه زیر پایش می‌کند. رکوردهایی که وضعیت نهایی آن‌ها تبدیل به «ریسک» یا «فرصت» شود، بلافاصله و با حفظ اتصال، به مخزن اصلی «مدیریت ریسک و فرصت‌ها» بخش ریسک‌های استراتژیک صادر و متبادل می‌گردند.'
                    : 'The QMS system calculates average severity dimensions, maps against occurrence probability, compiles scores and instantly replicates Risk or Opportunity items to the FMEA corporate risk directory.'}
                </p>
                <div className="flex flex-wrap gap-4 pt-1">
                  <div className="bg-amber-500/5 border border-amber-500/10 px-3 py-2 rounded-xl text-center">
                    <span className="text-[10px] text-zinc-500 block font-bold">{isRtl ? 'کل ردیف‌های ارزیابی‌شده' : 'Total Items'}</span>
                    <span className="text-sm font-black text-amber-500 font-mono">
                      {new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US').format(evalRows.length)}
                    </span>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/10 px-3 py-2 rounded-xl text-center">
                    <span className="text-[10px] text-zinc-500 block font-bold">{isRtl ? 'رکوردهای انتقال یافته' : 'Replicated Risks/Opps'}</span>
                    <span className="text-sm font-black text-emerald-400 font-mono">
                      {new Intl.NumberFormat(lang === 'fa' ? 'fa-IR' : 'en-US').format(
                        evalRows.filter(r => {
                          const { statusType } = getRowMetrics(r);
                          return statusType === 'risk' || statusType === 'opportunity';
                        }).length
                      )}
                    </span>
                  </div>
                  <div className="bg-[#18181C] border border-zinc-800 px-3 py-2 rounded-xl flex items-center">
                    <span className="text-[10px] text-zinc-400 leading-normal">
                      {isRtl ? '🔒 همگام‌ساز خودکار فعال است' : '🔒 Live Auto-Sync Active'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Dynamic explanations */}
              <div className="p-3 border-l-2 border-amber-500 bg-amber-500/[0.02] text-[11px] text-zinc-400 leading-normal">
                <strong>{isRtl ? 'مبنای محاسباتی شدت اثر (Severity):' : 'Severity Calculation Formula:'}</strong><br />
                {isRtl
                  ? 'شدت اثر در ماتریس برابر است با میانگین گردشده ۵ پارامتر: اثر بر مشتری، اثر بر کیفیت محصول، اثر بر فرآیندها، اثر بر اهداف سازمان، و اثر بر الزام قانونی/مشتری. حاصل ضرب نهایی امتیازات در ستون امتیاز کل نمایش داده می‌شود.'
                  : 'Severity (S) is computed as the rounded average of five distinct impacts. Total Score equals the algebraic product of all 6 numeric criteria.'}
              </div>
            </div>

            {/* Interactive 5x5 Matrix Block */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 bg-[#111113] border border-[#1E1E22] rounded-2xl relative">
              <span className="text-[10px] text-zinc-500 block font-black absolute top-3 right-4">
                {isRtl ? 'تنظیم دستی ماتریس ۵×۵ آستانه (مهم / کم اهمیت)' : 'Customizable 5x5 Decision Matrix (Important / Minor)'}
              </span>

              <div className="space-y-4 pt-6 w-full max-w-[280px]">
                {/* 5x5 Grid */}
                <div className="grid grid-cols-6 gap-1.5" dir="ltr">
                  {/* Empty top-left cell */}
                  <div className="text-[9px] font-black text-zinc-500 flex items-center justify-center">
                    S \ O
                  </div>
                  {/* Occurrence Headers */}
                  {[1, 2, 3, 4, 5].map(o => (
                    <div key={`col-${o}`} className="text-[9px] font-bold text-center text-zinc-500">
                      O={o}
                    </div>
                  ))}

                  {/* Rows for Severity S=5 down to S=1 */}
                  {[5, 4, 3, 2, 1].map((s) => {
                    const rowIdx = s - 1;
                    return (
                      <React.Fragment key={`row-s-${s}`}>
                        {/* Severity Header */}
                        <div className="text-[9px] font-bold text-zinc-500 flex items-center justify-center">
                          S={s}
                        </div>
                        {/* Cells */}
                        {[1, 2, 3, 4, 5].map((o) => {
                          const colIdx = o - 1;
                          const cellType = thresholdMatrix[rowIdx][colIdx];
                          
                          let bgClass = 'bg-zinc-800 text-zinc-400';
                          if (cellType === 'important') bgClass = 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
                          else bgClass = 'bg-zinc-500/5 text-zinc-500 border border-zinc-500/10';

                          return (
                            <button
                              key={`cell-${s}-${o}`}
                              type="button"
                              onClick={() => handleCycleThresholdCell(rowIdx, colIdx)}
                              className={`aspect-square text-[8px] font-black rounded-lg flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 ${bgClass}`}
                              title={
                                isRtl
                                  ? `شدت ${s} و احتمال ${o} • کلیک برای تغییر وضعیت`
                                  : `S=${s}, O=${o} • Click to toggle`
                              }
                            >
                              {cellType === 'important' ? (isRtl ? 'مهم' : 'IMP') : (isRtl ? 'فرعی' : 'MINOR')}
                            </button>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Grid legend with click controls */}
                <div className="flex justify-around items-center text-[9px] text-zinc-400 font-bold border-t border-zinc-800 pt-3 flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500/20 border border-amber-500/30 block shrink-0" />
                    <span>{isRtl ? 'مهم (ریسک/فرصت استراتژیک)' : 'Important (Strategic)'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded bg-zinc-500/10 border border-zinc-500/20 block shrink-0" />
                    <span>{isRtl ? 'کم اهمیت' : 'Less Important / Minor'}</span>
                  </div>
                </div>

                <p className="text-[8px] text-zinc-500 leading-normal text-center bg-zinc-950/40 p-2 rounded-lg border border-zinc-900">
                  {isRtl
                    ? '💡 بر روی خانه‌های ماتریس آستانه ۵×۵ کلیک کنید تا مرز اهمیت استراتژیک تغییر کند. خانه‌های «مهم» بر اساس ماهیت به ریسک یا فرصت صادر می‌شوند.'
                    : '💡 Click cells in the 5x5 chart to dynamically tune whether a threshold combination registers as Important or Minor.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD DIALOG MODAL */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09090B] border border-[#222225] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <header className="bg-[#121215] border-b border-[#212124] p-4 flex justify-between items-center text-right">
              <h2 className="text-xs sm:text-sm font-bold text-white">
                {isRtl ? 'افزودن آیتم استراتژیک جدید' : 'New Strategic Entry'}
              </h2>
              <button onClick={() => setIsAddOpen(false)} className="hover:bg-white/5 text-slate-400 hover:text-white p-1 rounded">✕</button>
            </header>
            <form onSubmit={handleCreate} className="p-5 space-y-4 text-right">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold block">{isRtl ? 'عنوان بخش ممیزی / استراتژیک' : 'Section Name'}</label>
                <input 
                  type="text" 
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-[#161619] border border-[#2D2D31] text-xs text-white rounded-lg p-2.5 outline-none focus:border-amber-500/50"
                  placeholder={isRtl ? 'SWOT، نیازها، اهداف کیفیت یا ردیف ممیزی...' : 'Enter title...'}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold block">{isRtl ? 'شماره بند استاندارد در ساختار درختی' : 'Clause ID (e.g. 4.1, 6.2.1)'}</label>
                <input 
                  type="text" 
                  value={formClauseId}
                  onChange={(e) => setFormClauseId(e.target.value)}
                  className="w-full bg-[#161619] border border-[#2D2D31] text-xs font-mono text-white rounded-lg p-2.5 outline-none focus:border-amber-500/50"
                  placeholder="e.g. 4.2"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold block">{isRtl ? 'مستند متصل (پیش‌فرض اختیاری)' : 'Linked Document Template (Optional)'}</label>
                <select
                  value={formLinkedDoc}
                  onChange={(e) => setFormLinkedDoc(e.target.value)}
                  className="w-full bg-[#161619] border border-[#2D2D31] text-xs text-white rounded-lg p-2.5 outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  <option value="">-- {isRtl ? 'بدون مستند ارتباطی اولیه' : 'No document linked'} --</option>
                  {allDocList.map((doc, idx) => (
                    <option key={idx} value={doc}>{doc}</option>
                  ))}
                </select>
              </div>

              {/* Validation Warning Box */}
              {!(formTitle.trim() && formClauseId.trim()) && (
                <div className="p-3 bg-rose-950/30 border border-rose-800/40 rounded-xl text-rose-300 text-[10.5px] leading-relaxed text-right font-semibold font-sans mt-2">
                  ⚠️ {isRtl 
                    ? 'توجه: لطفاً فیلدهای عنوان بخش و شماره بند استاندارد را پر نمایید تا دکمه ایجاد فعال گردد.' 
                    : 'Attention: Please complete the Section Name and Clause ID fields to activate the create button.'}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddOpen(false)}
                  className="bg-transparent hover:bg-white/5 border border-transparent font-bold text-xs py-2 px-4 rounded-lg text-zinc-400 hover:text-white"
                >
                  {isRtl ? 'انصراف' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  disabled={!(formTitle.trim() && formClauseId.trim())}
                  className="bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-850 disabled:text-zinc-500 disabled:opacity-50 text-black font-black text-xs py-2 px-4 rounded-lg cursor-pointer disabled:cursor-not-allowed"
                >
                  {isRtl ? 'ایجاد بخش' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT DIALOG MODAL */}
      {isEditOpen && editingItem && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#09090B] border border-[#222225] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <header className="bg-[#121215] border-b border-[#212124] p-4 flex justify-between items-center text-right">
              <h2 className="text-xs sm:text-sm font-bold text-white">
                {isRtl ? 'ویرایش بخش استراتژیک' : 'Edit Strategic Entry'}
              </h2>
              <button onClick={() => { setIsEditOpen(false); setEditingItem(null); }} className="hover:bg-white/5 text-slate-400 hover:text-white p-1 rounded">✕</button>
            </header>
            <form onSubmit={handleSaveEdit} className="p-5 space-y-4 text-right">
              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold block">{isRtl ? 'عنوان بخش ممیزی / استراتژیک' : 'Section Name'}</label>
                <input 
                  type="text" 
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-[#161619] border border-[#2D2D31] text-xs text-white rounded-lg p-2.5 outline-none focus:border-amber-500/50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold block">{isRtl ? 'شماره بند در ساختار استاندارد' : 'Clause ID'}</label>
                <input 
                  type="text" 
                  value={formClauseId}
                  onChange={(e) => setFormClauseId(e.target.value)}
                  className="w-full bg-[#161619] border border-[#2D2D31] text-xs font-mono text-white rounded-lg p-2.5 outline-none focus:border-amber-500/50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-zinc-400 font-bold block">{isRtl ? 'مستند متصل' : 'Linked Document Template'}</label>
                <select
                  value={formLinkedDoc}
                  onChange={(e) => setFormLinkedDoc(e.target.value)}
                  className="w-full bg-[#161619] border border-[#2D2D31] text-xs text-white rounded-lg p-2.5 outline-none focus:border-amber-500/50 cursor-pointer"
                >
                  <option value="">-- {isRtl ? 'بدون مستند ارتباطی اولیه' : 'No document linked'} --</option>
                  {allDocList.map((doc, idx) => (
                    <option key={idx} value={doc}>{doc}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button 
                  type="button" 
                  onClick={() => { setIsEditOpen(false); setEditingItem(null); }}
                  className="bg-transparent hover:bg-white/5 border border-transparent font-bold text-xs py-2 px-4 rounded-lg text-zinc-400 hover:text-white"
                >
                  {isRtl ? 'انصراف' : 'Cancel'}
                </button>
                <button 
                  type="submit" 
                  className="bg-amber-500 hover:bg-amber-400 text-black font-black text-xs py-2 px-4 rounded-lg"
                >
                  {isRtl ? 'ذخیره تغییرات' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog Modal */}
      {stratConfirmModal.isOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0F0F12] border border-[#27272C] rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
              <span className="text-red-500">{stratConfirmModal.title}</span>
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
              {stratConfirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setStratConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={stratConfirmModal.onConfirm}
                className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-red-500/10"
              >
                {isRtl ? 'تأیید حذف' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
