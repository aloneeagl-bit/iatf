import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, Search, Filter, Check, X, Edit, Calendar, User, 
  Settings, CheckCircle, Clock, AlertTriangle, FileWarning, 
  ExternalLink, Layers, ArrowLeftRight, ChevronRight, Activity, Bot,
  RotateCcw, Lock, Unlock, Trash2
} from 'lucide-react';
import { documentTemplates, getGenericTemplate, DocItem, DocTemplate } from '../data/documentTemplates';
import { iatfData, IATFClause } from '../data/iatfData';

interface Iso9001DocControl {
  id: string; // Document clean title
  code: string; // Unique QMS designator (e.g. QMS-PR-04.4-02)
  revision: string; // Revision number (e.g. 00, 01)
  releaseDate: string; // Standard date
  preparedBy: string; // Department or person
  approvedBy: string; // Manager
  status: 'draft' | 'approved' | 'review' | 'obsolete'; // ISO 9001 workflow states
  docType: 'manual' | 'procedure' | 'work_instruction' | 'form' | 'list_matrix' | 'record';
  notes?: string;
}

interface IsoDocsManagerProps {
  lang: 'fa' | 'en';
  customDocuments: Record<string, DocItem[]>;
  localizedIatfData: IATFClause[];
  onDocumentClick: (docName: string) => void;
  onSelectClauseId: (clauseId: string) => void;
  onPinToDashboard?: () => void;
  projectMode?: 'development' | 'user';
  devCreatedDocs?: string[];
  onDeleteDocument?: (docName: string) => void;
  onResetDocumentToDefault?: (docName: string) => void;
}

// Function to recursively collect all documents recommended within clauses
const collectClauseDocuments = (clauses: IATFClause[]): Array<{ title: string; clauseId: string; clauseNumber: string }> => {
  let list: Array<{ title: string; clauseId: string; clauseNumber: string }> = [];
  clauses.forEach(c => {
    if (c.documents && Array.isArray(c.documents)) {
      c.documents.forEach(doc => {
        list.push({
          title: doc.replace(/\s*\(ارجاع به بند.*\)/, '').trim(),
          clauseId: c.id,
          clauseNumber: c.number
        });
      });
    }
    if (c.subClauses) {
      list = [...list, ...collectClauseDocuments(c.subClauses)];
    }
  });
  return list;
};

// Generates beautiful standard ISO 9001 compliance codes based on titles and chapters
const generateDefaultCode = (title: string, clauseNumber: string = '4'): { code: string; type: Iso9001DocControl['docType'] } => {
  const normTitle = title.toLowerCase();
  let type: Iso9001DocControl['docType'] = 'record';
  let prefix = 'QMS-REC';

  if (normTitle.includes('روش اجرایی') || normTitle.includes('رویه')) {
    type = 'procedure';
    prefix = 'QMS-PR';
  } else if (normTitle.includes('دستورالعمل')) {
    type = 'work_instruction';
    prefix = 'QMS-WI';
  } else if (normTitle.includes('فرم') || normTitle.includes('کاربرگ') || normTitle.includes('اظهارنامه') || normTitle.includes('شواهد')) {
    type = 'form';
    prefix = 'QMS-FM';
  } else if (normTitle.includes('ماتریس') || normTitle.includes('لیست') || normTitle.includes('نقشه') || normTitle.includes('طرح کنترلی')) {
    type = 'list_matrix';
    prefix = 'QMS-LS';
  } else if (normTitle.includes('نظام‌نامه') || normTitle.includes('سند دامنه شمول')) {
    type = 'manual';
    prefix = 'QMS-QM';
  }

  // Generate sequence using characters or standard numbering based on title hash length
  const sequence = (Math.abs(title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 45 + 1)
    .toString()
    .padStart(2, '0');

  const clauseStr = clauseNumber ? clauseNumber.replace(/\./g, '_') : '4';
  const code = `${prefix}-${clauseStr}-${sequence}`;

  return { code, type };
};

export default function IsoDocsManager({ 
  lang, 
  customDocuments, 
  localizedIatfData, 
  onDocumentClick,
  onSelectClauseId,
  onPinToDashboard,
  projectMode = 'development',
  devCreatedDocs = [],
  onDeleteDocument,
  onResetDocumentToDefault
}: IsoDocsManagerProps) {

  const isFa = lang === 'fa';

  // State to hold document control details conforming to ISO 9001 standard
  const [docControlStore, setDocControlStore] = useState<Record<string, Iso9001DocControl>>(() => {
    try {
      const saved = localStorage.getItem('iatf_iso9001_doc_control_v2');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // State to handle document metadata edition under ISO 9001 rules
  const [editingMetadataId, setEditingMetadataId] = useState<string | null>(null);
  const [metaCode, setMetaCode] = useState('');
  const [metaRevision, setMetaRevision] = useState('');
  const [metaReleaseDate, setMetaReleaseDate] = useState('');
  const [metaPreparedBy, setMetaPreparedBy] = useState('');
  const [metaApprovedBy, setMetaApprovedBy] = useState('');
  const [metaStatus, setMetaStatus] = useState<'draft' | 'approved' | 'review' | 'obsolete'>('draft');
  const [metaType, setMetaType] = useState<Iso9001DocControl['docType']>('record');
  const [metaNotes, setMetaNotes] = useState('');

  // Save metadata to localStorage on alterations
  const saveDocControl = (updated: Record<string, Iso9001DocControl>) => {
    setDocControlStore(updated);
    try {
      localStorage.setItem('iatf_iso9001_doc_control_v2', JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save QMS metadata store', e);
    }
  };

  // Synchronize dynamic store modifications from document editor
  useEffect(() => {
    try {
      const saved = localStorage.getItem('iatf_iso9001_doc_control_v2');
      if (saved) {
        setDocControlStore(JSON.parse(saved));
      }
    } catch (e) {
      console.error('Failed to sync updated metadata store', e);
    }
  }, [customDocuments]);

  // Compile full set of QMS documents (Created / Recommended in IATF / Predefined templates)
  const fullDocumentList = useMemo(() => {
    const listMap = new Map<string, {
      title: string;
      source: 'template' | 'clause' | 'custom';
      clauseId?: string;
      clauseNumber?: string;
      isCreated: boolean;
      recordCount: number;
    }>();

    const getMatchKey = (titleStr: string): string => {
      const clean = titleStr.trim().toLowerCase();
      if (clean.includes('ماتریس فرآیندها-الزامات') || clean.includes('ماتریس فرآیندها - الزامات')) {
        return 'ماتریس فرآیندها-الزامات (Process-Requirements Matrix)';
      }
      if (clean.includes('نمودار جریان فرآیند') || clean.includes('نمودارجریان فرآیند')) {
        return 'نمودار جریان فرآیند (Process Flow Diagram)';
      }
      for (const k of Object.keys(documentTemplates)) {
        if (k.toLowerCase() === clean || documentTemplates[k].title.toLowerCase() === clean) {
          return documentTemplates[k].title;
        }
      }
      return titleStr.trim();
    };

    // 1. Load predefined document templates
    Object.keys(documentTemplates).forEach(k => {
      const title = documentTemplates[k].title;
      const canonical = getMatchKey(title);
      listMap.set(canonical, {
        title: canonical,
        source: 'template',
        isCreated: false,
        recordCount: 0
      });
    });

    // 2. Load clause-recommended documents recursively
    const clauseDocsAll = collectClauseDocuments(localizedIatfData);
    clauseDocsAll.forEach(cd => {
      const canonical = getMatchKey(cd.title);
      const existing = listMap.get(canonical);
      if (existing) {
        listMap.set(canonical, {
          ...existing,
          clauseId: cd.clauseId,
          clauseNumber: cd.clauseNumber,
          source: 'clause'
        });
      } else {
        listMap.set(canonical, {
          title: canonical,
          source: 'clause',
          clauseId: cd.clauseId,
          clauseNumber: cd.clauseNumber,
          isCreated: false,
          recordCount: 0
        });
      }
    });

    // 3. Update creation statuses and record counts from customDocuments state
    Object.entries(customDocuments).forEach(([rawTitle, items]) => {
      const title = rawTitle.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
      const canonical = getMatchKey(title);
      const existing = listMap.get(canonical);
      const isCreatedStatus = Array.isArray(items) && items.length > 0;
      const count = Array.isArray(items) ? items.length : 0;

      if (existing) {
        listMap.set(canonical, {
          ...existing,
          isCreated: isCreatedStatus || existing.isCreated,
          recordCount: count || existing.recordCount
        });
      } else {
        listMap.set(canonical, {
          title: canonical,
          source: 'custom',
          isCreated: isCreatedStatus,
          recordCount: count
        });
      }
    });

    // Map each compiled item to its ISO 9001 properties (loaded or default coded)
    return Array.from(listMap.values()).map(doc => {
      const stored = docControlStore[doc.title];
      let itemControl: Iso9001DocControl;

      if (stored) {
        itemControl = stored;
      } else {
        // Auto-generate standard compliant codings if missing
        const { code, type } = generateDefaultCode(doc.title, doc.clauseNumber);
        itemControl = {
          id: doc.title,
          code,
          revision: '00',
          releaseDate: '1405/03/01',
          preparedBy: isFa ? 'تضمین کیفیت' : 'Quality Assurance',
          approvedBy: isFa ? 'مدیر ارشد مهندسی' : 'QMS Management Rep',
          status: doc.isCreated ? 'approved' : 'draft',
          docType: type,
          notes: isFa ? 'کدگذاری خودکار سیستمی تحت استاندارد ISO 9001:2015' : 'Auto ISO 9001 coding'
        };
      }

      return {
        ...doc,
        control: itemControl
      };
    });
  }, [customDocuments, localizedIatfData, docControlStore, isFa]);

  // Filters and queries
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterCreation, setFilterCreation] = useState<string>('all');

  // Multi-criteria filter execution
  const filteredDocuments = useMemo(() => {
    return fullDocumentList.filter(doc => {
      // 1. Text search on title, code, preparedBy, etc.
      const matchText = searchQuery.trim() === '' || 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.control.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.control.preparedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.control.approvedBy.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.clauseNumber && doc.clauseNumber.includes(searchQuery));

      // 2. ISO 9001 State Filter
      const matchStatus = filterStatus === 'all' || doc.control.status === filterStatus;

      // 3. Document Category Type
      const matchType = filterType === 'all' || doc.control.docType === filterType;

      // 4. Creation status (Created vs Proposed)
      let matchCreation = true;
      if (filterCreation === 'created') {
        matchCreation = doc.isCreated;
      } else if (filterCreation === 'planned') {
        matchCreation = !doc.isCreated;
      }

      return matchText && matchStatus && matchType && matchCreation;
    });
  }, [fullDocumentList, searchQuery, filterStatus, filterType, filterCreation]);

  // Document metadata editing management
  const handleStartEditMetadata = (doc: typeof fullDocumentList[0]) => {
    setEditingMetadataId(doc.title);
    setMetaCode(doc.control.code);
    setMetaRevision(doc.control.revision);
    setMetaReleaseDate(doc.control.releaseDate);
    setMetaPreparedBy(doc.control.preparedBy);
    setMetaApprovedBy(doc.control.approvedBy);
    setMetaStatus(doc.control.status);
    setMetaType(doc.control.docType);
    setMetaNotes(doc.control.notes || '');
  };

  const handleSaveMetadata = () => {
    if (!editingMetadataId) return;

    const updated = {
      ...docControlStore,
      [editingMetadataId]: {
        id: editingMetadataId,
        code: metaCode.trim() || generateDefaultCode(editingMetadataId).code,
        revision: metaRevision.trim() || '00',
        releaseDate: metaReleaseDate.trim() || '1405/03/01',
        preparedBy: metaPreparedBy.trim() || (isFa ? 'تضمین کیفیت' : 'QA'),
        approvedBy: metaApprovedBy.trim() || (isFa ? 'مدیرعامل' : 'CEO'),
        status: metaStatus,
        docType: metaType,
        notes: metaNotes.trim()
      }
    };

    saveDocControl(updated);
    setEditingMetadataId(null);
  };

  // Status visual decorations helper
  const getStatusBadge = (status: Iso9001DocControl['status']) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/25">
            <CheckCircle size={11} />
            {isFa ? 'مصوب (نهایی)' : 'Approved'}
          </span>
        );
      case 'review':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#F59E0B]/10 text-[#F59E0B] border border-[#F59E0B]/25">
            <Clock size={11} />
            {isFa ? 'در حال بازنگری' : 'Under Review'}
          </span>
        );
      case 'obsolete':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#EF4444]/10 text-[#EF4444] border border-[#EF4444]/25">
            <FileWarning size={11} />
            {isFa ? 'منسوخ شده' : 'Obsolete'}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-400/10 text-slate-300 border border-slate-500/20">
            <Edit size={11} />
            {isFa ? 'پیش‌نویس' : 'Draft'}
          </span>
        );
    }
  };

  // Category translate helper
  const getCategoryLabel = (type: Iso9001DocControl['docType']) => {
    switch (type) {
      case 'manual': return isFa ? 'نظام‌نامه کیفیت' : 'Quality Manual';
      case 'procedure': return isFa ? 'روش اجرایی (PR)' : 'Procedure';
      case 'work_instruction': return isFa ? 'دستورالعمل کاری (WI)' : 'Work Instruction';
      case 'form': return isFa ? 'فرم / پیوست (FM)' : 'Form / Template';
      case 'list_matrix': return isFa ? 'لیست / ماتریس (LS)' : 'List / Matrix';
      default: return isFa ? 'شواهد ممیزی (REC)' : 'Record / Evidence';
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in w-full pb-10">
      
      {/* Dynamic Header Badge and Explanation of ISO 9001 Requirement */}
      <div className="bg-gradient-to-r from-amber-500/10 to-transparent border-l-4 border-amber-500 p-5 rounded-r-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
            <Layers size={22} className="animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-base sm:text-xl font-bold text-white font-sans flex items-center gap-1.5">
              <span>{isFa ? 'کنترل اسناد و مدارک جامع بر اساس الزامات ISO 9001 (بند ۷.۵)' : 'ISO 9001 Comprehensive Document Control & Coding (Clause 7.5)'}</span>
              {onPinToDashboard && (
                <button
                  type="button"
                  onClick={onPinToDashboard}
                  className="text-amber-500 hover:text-amber-400 p-1 transition-all select-none text-xs sm:text-sm cursor-pointer ml-1 animate-pulse"
                  title={isFa ? 'پین به داشبورد ابزار IATF' : 'Pin to IATF Tools Dashboard'}
                >
                  📌
                </button>
              )}
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {isFa 
                ? 'مطابق با استاندارد ایزو ۹۰۰۱، اطلاعات مستند باید به گونه‌ای مدیریت شوند که از شناسایی منحصر‌به‌فرد (کدگذاری مستقل)، ویرایش ساختاریافته، تایید اثربخشی قبل از صدور و کنترل امنیت داده‌ها اطمینان حاصل شود. روی هر سند کلیک کنید تا الگوهای رسمی آن بازگردانده شده و تکمیل گردد.'
                : 'Under ISO 9001:2105 requirements (Clause 7.5.3), documented information must be controlled regarding distribution, access, retrieval, storage, and change control. Customize codes and double click to start auditing.'}
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Quick-grid cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#121214] border border-[#2D2D31] p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase text-slate-500 font-bold block">{isFa ? 'کل شناسنامه‌ها و رکوردهای در دست توسعه' : 'Total Documents Compiled'}</span>
            <span className="text-lg sm:text-2xl font-black text-amber-500 mt-1 block">{fullDocumentList.length}</span>
          </div>
          <FileText className="text-slate-600 shrink-0" size={24} />
        </div>
        
        <div className="bg-[#121214] border border-[#254F3F] p-4 rounded-xl flex items-center justify-between bg-[#10B981]/5 shadow-sm">
          <div>
            <span className="text-[10px] uppercase text-emerald-500 font-bold block">{isFa ? 'اسناد ایجاد شده و فعال شده' : 'Active & Created Docs'}</span>
            <span className="text-lg sm:text-2xl font-black text-emerald-400 mt-1 block">
              {fullDocumentList.filter(d => d.isCreated).length}
            </span>
          </div>
          <CheckCircle className="text-emerald-500/60 shrink-0" size={24} />
        </div>

        <div className="bg-[#121214] border border-[#523E1A] p-4 rounded-xl flex items-center justify-between bg-[#F59E0B]/5 shadow-sm">
          <div>
            <span className="text-[10px] uppercase text-amber-500 font-bold block">{isFa ? 'سیاهه اسناد در حال تدوین (نیاز به اقدام)' : 'Planned / Draft Docs'}</span>
            <span className="text-lg sm:text-2xl font-black text-amber-400 mt-1 block">
              {fullDocumentList.filter(d => !d.isCreated).length}
            </span>
          </div>
          <Clock className="text-amber-500/60 shrink-0" size={24} />
        </div>

        <div className="bg-[#121214] border border-[#4C2020] p-4 rounded-xl flex items-center justify-between bg-red-500/5 shadow-sm">
          <div>
            <span className="text-[10px] uppercase text-red-400 font-bold block">{isFa ? 'درصد پیشرفت تحقق مستندسازی سیستم' : 'Documentation Progress'}</span>
            <span className="text-lg sm:text-2xl font-black text-red-400 mt-1 block">
              {fullDocumentList.length > 0
                ? Math.round((fullDocumentList.filter(d => d.isCreated).length / fullDocumentList.length) * 100)
                : 0}%
            </span>
          </div>
          <Activity className="text-red-500/60 shrink-0" size={24} />
        </div>
      </div>

      {/* Smart Search, Filter, and View Layouts Panel */}
      <div className="bg-[#121214] border border-[#2D2D31] p-5 rounded-xl shadow-md flex flex-col gap-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Main search field */}
          <div className="relative flex-1">
            <Search size={14} className={`absolute top-1/2 -translate-y-1/2 text-slate-500 ${isFa ? 'right-3' : 'left-3'}`} />
            <input
              type="text"
              placeholder={isFa ? 'جستجو بر اساس عنوان مستند، کد کنترلی ایزو، نام مسئول بررسی...' : 'Search docs by title, compliance code, author...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full bg-[#18181C] border border-[#2E2E32] focus:border-amber-500/50 rounded-lg py-2 text-xs outline-none text-white ${isFa ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 shrink-0">
            {/* Status Selector */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[#18181C] border border-[#2E2E32] focus:border-amber-500/30 rounded-lg py-1.5 px-2.5 text-xs text-slate-300 outline-none"
            >
              <option value="all">{isFa ? 'همه وضعیت‌ها (ISO)' : 'All States'}</option>
              <option value="draft">{isFa ? 'فقط پیش‌نویس‌ها' : 'Draft'}</option>
              <option value="approved">{isFa ? 'فقط بندهای مصوب' : 'Approved'}</option>
              <option value="review">{isFa ? 'در حال بازنگری' : 'Under Review'}</option>
              <option value="obsolete">{isFa ? 'منسوخ شده' : 'Obsolete'}</option>
            </select>

            {/* Creation status */}
            <select
              value={filterCreation}
              onChange={(e) => setFilterCreation(e.target.value)}
              className="bg-[#18181C] border border-[#2E2E32] focus:border-amber-500/30 rounded-lg py-1.5 px-2.5 text-xs text-slate-300 outline-none"
            >
              <option value="all">{isFa ? 'همه مستندات' : 'All Docs'}</option>
              <option value="created">{isFa ? 'ایجاد شده (دارای محتوا)' : 'Created (With data)'}</option>
              <option value="planned">{isFa ? 'در دست تدوین (فاقد محتوا)' : 'Planned / Proposed'}</option>
            </select>

            {/* Document Type */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-[#18181C] border border-[#2E2E32] focus:border-amber-500/30 rounded-lg py-1.5 px-2.5 text-xs text-slate-300 outline-none"
            >
              <option value="all">{isFa ? 'همه قالب‌ها' : 'All Formats'}</option>
              <option value="manual">{isFa ? 'نظام‌نامه‌های کیفیت' : 'Quality Manual'}</option>
              <option value="procedure">{isFa ? 'روش‌های اجرایی (PR)' : 'Procedures'}</option>
              <option value="work_instruction">{isFa ? 'دستورالعمل‌ها (WI)' : 'Work Instructions'}</option>
              <option value="form">{isFa ? 'فرم‌های کاری (FM)' : 'Forms'}</option>
              <option value="list_matrix">{isFa ? 'لیست‌ها و ماتریس‌ها' : 'Lists / Matrices'}</option>
              <option value="record">{isFa ? 'سجلات ممیزی' : 'Auditable Records'}</option>
            </select>
          </div>
        </div>

        {/* Clear query indicator */}
        {(searchQuery || filterStatus !== 'all' || filterType !== 'all' || filterCreation !== 'all') && (
          <div className="flex justify-between items-center bg-[#1D1D22] py-1.5 px-3 rounded-lg text-xs">
            <span className="text-slate-400">
              {isFa ? `تعداد ${filteredDocuments.length} مورد یافت شد.` : `Filtered: Found ${filteredDocuments.length} items.`}
            </span>
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('all');
                setFilterType('all');
                setFilterCreation('all');
              }}
              className="text-amber-500 hover:text-amber-400 text-xs font-bold cursor-pointer"
            >
              {isFa ? 'پاک کردن فیلترها' : 'Clear Filters'}
            </button>
          </div>
        )}
      </div>

      {/* Primary document inventory table list split with ISO 9001 metadata configure layout */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        <div className="flex-1 w-full bg-[#121214] border border-[#2D2D31] rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-[#2D2D31] bg-[#161619] flex justify-between items-center">
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
              <FileText size={15} className="text-amber-500" />
              {isFa ? 'سیاهه یکپارچه و فهرست منسجم مستندات و الزامات کاربری' : 'Unified Document Control Register'}
            </h3>
            <span className="text-[10px] text-slate-500 font-mono tracking-wider">
              {filteredDocuments.length} / {fullDocumentList.length}
            </span>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-right text-xs" dir={isFa ? 'rtl' : 'ltr'}>
              <thead>
                <tr className="bg-[#1A1A1D] border-b border-[#2D2D31] text-slate-400 select-none">
                  <th className="p-3.5 font-bold">{isFa ? 'شناسه / کد استاندارد (ISO 9001)' : 'ISO Code'}</th>
                  <th className="p-3.5 font-bold">{isFa ? 'عنوان و شرح ثبتی سند عملیاتی' : 'Document Title'}</th>
                  <th className="p-3.5 font-bold text-center">{isFa ? 'وضعیت (بند ۷.۵)' : 'Status / Stage'}</th>
                  <th className="p-3.5 font-bold text-center">{isFa ? 'ویرایش (Rev)' : 'Rev'}</th>
                  <th className="p-3.5 font-bold text-center">{isFa ? 'رکوردهای ثبت‌شده' : 'Records'}</th>
                  <th className="p-3.5 font-bold text-center">{isFa ? 'تنظیمات و ممیزی' : 'Operation'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#232326]">
                {filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-10 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <FileWarning size={32} className="text-slate-600 animate-pulse" />
                        <span>{isFa ? 'هیچ مستندی منطبق با معیارهای فیلتر یافت نشد.' : 'No compliance documents found.'}</span>
                        <p className="text-[11px] text-[#555] max-w-sm">
                          {isFa ? 'امکان استفاده از فیلترهای بالا جهت تطبیق مجدد یا جستجوی کلمات روان‌تر فرآهم است.' : 'Try adjusting the filters above to find what you are looking for.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map(doc => {
                    const hasData = doc.isCreated;
                    const isSelectedMeta = editingMetadataId === doc.title;

                    return (
                      <tr 
                        key={doc.title} 
                        className={`hover:bg-white/5 transition-colors group cursor-pointer ${
                          isSelectedMeta ? 'bg-amber-500/5 hover:bg-amber-500/10' : ''
                        }`}
                        onDoubleClick={() => onDocumentClick(doc.title)}
                        title={isFa ? "برای باز کردن الگو و ویرایش محتوا، دبل کلیک کنید" : "Double click to open & edit items"}
                      >
                        {/* 1. Document compliance code */}
                        <td className="p-3 text-amber-500 font-mono font-semibold tracking-wider selection:bg-amber-500/20">
                          {doc.control.code}
                        </td>

                        {/* 2. Title with category details */}
                        <td className="p-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-bold text-white group-hover:text-amber-400 transition-colors inline-flex items-center gap-1.5 flex-wrap">
                              {doc.title}
                              {devCreatedDocs.includes(doc.title) && (
                                <span 
                                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-black leading-none ${
                                    projectMode === 'user' 
                                      ? 'bg-red-500/15 text-red-400 border border-red-500/20' 
                                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                  }`}
                                  title={isFa ? 'سند ساخته شده در حالت توسعه (غیرقابل حذف در حالت استفاده کاربری)' : 'Document created in dev mode (locked in user mode)'}
                                >
                                  {projectMode === 'user' ? <Lock size={8} /> : <Unlock size={8} />}
                                  {isFa ? 'ساخت توسعه (قفل)' : 'Dev-Created'}
                                </span>
                              )}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-slate-500 bg-[#1D1D22] px-1.5 py-0.5 rounded">
                                {getCategoryLabel(doc.control.docType)}
                              </span>
                              {doc.clauseNumber && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (doc.clauseId) onSelectClauseId(doc.clauseId);
                                  }}
                                  className="text-[9px] text-amber-500 hover:text-amber-400 hover:underline flex items-center gap-0.5"
                                  title={isFa ? "ناوبری به بند مرتبط در استاندارد" : "Navigate to clause"}
                                >
                                  <span>⛓</span>
                                  {isFa ? `بند ${doc.clauseNumber}` : `Clause ${doc.clauseNumber}`}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 3. Status workflow badge */}
                        <td className="p-3 text-center align-middle whitespace-nowrap">
                          {getStatusBadge(doc.control.status)}
                        </td>

                        {/* 4. Revision index */}
                        <td className="p-3 text-center text-slate-400 font-mono font-medium">
                          {doc.control.revision.padStart(2, '0')}
                        </td>

                        {/* 5. Number of rows / records completed */}
                        <td className="p-3 text-center">
                          {hasData ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold font-mono text-[11px]" title={isFa ? `${doc.recordCount} سطر داده ممیزی` : `${doc.recordCount} rows`}>
                              {doc.recordCount} {isFa ? 'سطر' : 'rows'}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#555] font-bold">
                              {isFa ? 'فاقد داده (سیال)' : 'Uncreated'}
                            </span>
                          )}
                        </td>

                         {/* 6. Quick Control settings */}
                         <td className="p-3 text-center">
                           <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                             {/* Editor Opener */}
                             <button
                               onClick={() => onDocumentClick(doc.title)}
                               className="p-1.5 hover:bg-[#1A1A1E] text-slate-300 hover:text-amber-400 rounded border border-[#28282C] hover:border-amber-500/20 cursor-pointer transition-colors"
                               title={isFa ? 'باز کردن و تکمیل محتوای سند' : 'Open document template editor'}
                             >
                               <ExternalLink size={12} />
                             </button>

                             {/* Metadata Editor popup */}
                             <button
                               onClick={() => handleStartEditMetadata(doc)}
                               className="p-1.5 hover:bg-[#1A1A1E] text-slate-300 hover:text-blue-400 rounded border border-[#28282C] hover:border-blue-500/20 cursor-pointer transition-colors"
                               title={isFa ? 'ویرایش شناسنامه کنترل سند (ISO 9001)' : 'Edit QMS Document control metadata'}
                             >
                               <Settings size={12} />
                             </button>

                             {/* Reset to Default */}
                             <button
                               onClick={() => onResetDocumentToDefault?.(doc.title)}
                               className="p-1.5 hover:bg-[#1A1A1E] text-slate-300 hover:text-yellow-500 rounded border border-[#28282C] hover:border-yellow-500/20 cursor-pointer transition-colors"
                               title={isFa ? 'بازنشانی کامل به الگوی پیش‌فرض اولیه' : 'Reset to default template'}
                             >
                               <RotateCcw size={12} />
                             </button>

                             {/* Delete Button / Lock Indicator */}
                             {projectMode === 'user' && devCreatedDocs.includes(doc.title) ? (
                               <div 
                                 className="p-1.5 text-slate-500 bg-[#1A1A1D] rounded border border-[#232326] cursor-not-allowed flex items-center justify-center"
                                 title={isFa ? 'غیرقابل حذف: این سند در حالت توسعه ایجاد شده است' : 'Locked: This document was created in dev mode and cannot be deleted'}
                               >
                                 <Lock size={12} className="text-red-500" />
                               </div>
                             ) : (
                               <button
                                 onClick={() => onDeleteDocument?.(doc.title)}
                                 className="p-1.5 hover:bg-[#1A1A1E] text-slate-300 hover:text-red-500 rounded border border-[#28282C] hover:border-red-500/20 cursor-pointer transition-colors"
                                 title={isFa ? 'حذف و پاکسازی محتوای سند' : 'Delete/Clear document data'}
                               >
                                 <Trash2 size={12} />
                               </button>
                             )}
                           </div>
                         </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right ISO 9001 Metadata Sidebar Configurator Component */}
        {editingMetadataId && (
          <div className="w-full lg:w-80 bg-[#121214] border border-[#2D2D31] rounded-xl overflow-hidden shadow-2xl shrink-0 animate-slide-in">
            <div className="p-4 border-b border-[#2D2D31] bg-amber-500/5 flex justify-between items-center">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Settings size={14} className="text-amber-500" />
                {isFa ? 'کنترل اسناد ISO 9001' : 'ISO 9001 Compliance Desk'}
              </span>
              <button 
                onClick={() => setEditingMetadataId(null)}
                className="text-slate-500 hover:text-white cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-4 flex flex-col gap-4">
              <div className="text-[11px]">
                <span className="text-[#666] uppercase block font-mono font-bold tracking-wider">{isFa ? 'عنوان منتخب کیفی' : 'Target Document Title'}</span>
                <span className="text-amber-400 font-bold block mt-1 leading-normal">
                  {editingMetadataId}
                </span>

                {editingMetadataId && (
                  <div className="flex gap-2 mt-3 pt-2.5 border-t border-[#232326]">
                    {/* Reset to Default button */}
                    <button
                      onClick={() => onResetDocumentToDefault?.(editingMetadataId)}
                      className="flex-1 flex items-center justify-center gap-1 bg-yellow-550/10 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 text-yellow-500 py-1.5 rounded text-[10px] font-bold transition-all cursor-pointer"
                      title={isFa ? 'برگشت کامل سند به قالب استاندارد اولیه' : 'Reset document to factory standard default'}
                    >
                      <RotateCcw size={11} />
                      <span>{isFa ? 'برگشت به پیش‌فرض' : 'Reset Default'}</span>
                    </button>

                    {/* Delete button or locked indicator */}
                    {projectMode === 'user' && devCreatedDocs.includes(editingMetadataId) ? (
                      <div 
                        className="flex-1 flex items-center justify-center gap-1 bg-red-950/20 border border-red-500/20 text-red-400 py-1.5 rounded text-[10px] font-bold cursor-not-allowed"
                        title={isFa ? 'غیرقابل حذف: این سند در حالت توسعه و ساخت پروژه ایجاد شده است' : 'Locked: This document was created in dev mode and cannot be deleted'}
                      >
                        <Lock size={11} className="text-red-500" />
                        <span>{isFa ? 'حذف قفل شده' : 'Delete Locked'}</span>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          onDeleteDocument?.(editingMetadataId);
                          setEditingMetadataId(null);
                        }}
                        className="flex-1 flex items-center justify-center gap-1 bg-red-550/10 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 py-1.5 rounded text-[10px] font-bold transition-all cursor-pointer"
                        title={isFa ? 'حذف و پاکسازی کامل محتوای سند' : 'Delete/Clear entire document content'}
                      >
                        <Trash2 size={11} />
                        <span>{isFa ? 'حذف سند' : 'Delete Doc'}</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 1. Document compliance code Input */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">
                  {isFa ? 'کد کنترل سند (ISO Code)' : 'Document Classification Code'}
                </label>
                <input
                  type="text"
                  value={metaCode}
                  onChange={(e) => setMetaCode(e.target.value)}
                  placeholder="e.g. QMS-PR-04.4-02"
                  className="w-full bg-[#18181C] border border-[#2A2A2E] focus:border-amber-500/50 rounded p-2 text-xs font-mono outline-none text-white tracking-wider"
                />
              </div>

              {/* 2. Revision Index Input */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">
                    {isFa ? 'ویرایش سند (Rev)' : 'Revision Index'}
                  </label>
                  <input
                    type="text"
                    value={metaRevision}
                    onChange={(e) => setMetaRevision(e.target.value)}
                    placeholder="00"
                    maxLength={3}
                    className="w-full bg-[#18181C] border border-[#2A2A2E] focus:border-amber-500/50 rounded p-2 text-xs outline-none text-white font-mono text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 font-bold block mb-1">
                    {isFa ? 'تاریخ صدور / پذیرش' : 'Release Date'}
                  </label>
                  <input
                    type="text"
                    value={metaReleaseDate}
                    onChange={(e) => setMetaReleaseDate(e.target.value)}
                    placeholder="1405/03/01"
                    className="w-full bg-[#18181C] border border-[#2A2A2E] focus:border-amber-500/50 rounded p-2 text-xs outline-none text-white font-mono text-center"
                  />
                </div>
              </div>

              {/* 3. Document type select */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">
                  {isFa ? 'رده مستند (اطلاعات مستند)' : 'Document Category Type'}
                </label>
                <select
                  value={metaType}
                  onChange={(e) => setMetaType(e.target.value as Iso9001DocControl['docType'])}
                  className="w-full bg-[#18181C] border border-[#2A2A2E] focus:border-amber-500/30 rounded p-2 text-xs text-slate-300 outline-none"
                >
                  <option value="manual">{isFa ? 'نظام‌نامه کیفیت (Manual)' : 'Quality Manual'}</option>
                  <option value="procedure">{isFa ? 'روش اجرایی (Procedure)' : 'Procedure'}</option>
                  <option value="work_instruction">{isFa ? 'دستورالعمل کاری (WI)' : 'Work Instruction'}</option>
                  <option value="form">{isFa ? 'فرم / چک‌لیست (Form)' : 'Form / checklist'}</option>
                  <option value="list_matrix">{isFa ? 'لیست / ماتریس (List)' : 'List / Matrix'}</option>
                  <option value="record">{isFa ? 'سند ثبتی / ادله ممیزی (Record)' : 'Evidence Record'}</option>
                </select>
              </div>

              {/* 4. Prepared by / Approved by */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">
                  {isFa ? 'تهیه‌کننده سند' : 'Prepared / Authored By'}
                </label>
                <input
                  type="text"
                  value={metaPreparedBy}
                  onChange={(e) => setMetaPreparedBy(e.target.value)}
                  className="w-full bg-[#18181C] border border-[#2A2A2E] focus:border-amber-500/50 rounded p-2 text-xs outline-none text-white"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">
                  {isFa ? 'تاییدکننده نهایی سند' : 'Approved / Released By'}
                </label>
                <input
                  type="text"
                  value={metaApprovedBy}
                  onChange={(e) => setMetaApprovedBy(e.target.value)}
                  className="w-full bg-[#18181C] border border-[#2A2A2E] focus:border-amber-500/50 rounded p-2 text-xs outline-none text-white"
                />
              </div>

              {/* 5. Status select under ISO 9001 workflow */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">
                  {isFa ? 'وضعیت سند (چرخه حیات)' : 'ISO 9001 Revision Lifecycle'}
                </label>
                <select
                  value={metaStatus}
                  onChange={(e) => setMetaStatus(e.target.value as Iso9001DocControl['status'])}
                  className="w-full bg-[#18181C] border border-[#2A2A2E] focus:border-amber-500/30 rounded p-2 text-xs text-slate-300 outline-none"
                >
                  <option value="draft">{isFa ? 'پیش‌نویس کارشناسی (Draft)' : 'Draft (Under development)'}</option>
                  <option value="approved">{isFa ? 'منظم و مصوب نهایی (Approved)' : 'Approved & Active'}</option>
                  <option value="review">{isFa ? 'در دست بازنگری دوره‌ای (Under review)' : 'Under Review'}</option>
                  <option value="obsolete">{isFa ? 'منسوخ شده / باطل (Obsolete)' : 'Obsolete (Deactive)'}</option>
                </select>
              </div>

              {/* 6. Control Notes */}
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">
                  {isFa ? 'توضیحات و سوابق ویرایش سند' : 'Auditing / Modification Notes'}
                </label>
                <textarea
                  rows={2}
                  value={metaNotes}
                  onChange={(e) => setMetaNotes(e.target.value)}
                  className="w-full bg-[#18181C] border border-[#2A2A2E] focus:border-amber-500/50 rounded p-2 text-xs outline-none text-white resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2.5 mt-2">
                <button
                  onClick={handleSaveMetadata}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-2 rounded text-xs font-bold transition-colors cursor-pointer"
                >
                  {isFa ? 'بروزرسانی شناسنامه سند' : 'Save & Publish Control'}
                </button>
                <button
                  onClick={() => setEditingMetadataId(null)}
                  className="bg-[#2D2D31] hover:bg-[#3E3E43] text-slate-300 py-2 px-3 rounded text-xs px-2.5 transition-colors cursor-pointer"
                >
                  {isFa ? 'انصراف' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
