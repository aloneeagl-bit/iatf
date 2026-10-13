import React, { useState, useMemo, useEffect } from 'react';
import { 
  Folder, Plus, Trash, Edit3, Layers, Grid, FileText, CheckCircle, 
  Search, ChevronDown, ChevronRight, Sparkles, Link2, Settings, 
  Download, Upload, PlusCircle, X, HelpCircle, AlertCircle, Edit2, Trash2, LayoutGrid, FileSpreadsheet
} from 'lucide-react';
import { IATFClause } from '../data/iatfData';
import { QmsDatabase } from '../lib/qmsDatabase';
import { documentTemplates, getGenericTemplate, DocItem, DocTemplate } from '../data/documentTemplates';
import DocumentEditor, { ColumnDefinition } from './DocumentEditor';

interface IatfToolItem {
  id: string;
  name: string;
  description: string;
  selectedClauses: string[]; // List of clause numbers/IDs
  createdAt: string;
  shortcutType?: 'document' | 'portal';
  shortcutTarget?: string;
}

interface IatfToolsDashboardProps {
  lang: 'fa' | 'en';
  localizedIatfData: IATFClause[];
  customDocuments: Record<string, any>;
  onDocumentClick: (docName: string) => void;
  onSaveDocument?: (items: any[], columns?: any[], newTitle?: string, optionalTemplateTitle?: string, optionalSmartType?: string) => void;
  items: IatfToolItem[];
  setItems: React.Dispatch<React.SetStateAction<IatfToolItem[]>>;
  activeItemId: string;
  setActiveItemId: (id: string) => void;
  onOpenPortal?: (target: string) => void;
  csrComparisons?: any[];
}

// Convert column index to letters like Excel (A, B, C...)
const colIndexToLetter = (index: number) => {
  return String.fromCharCode(65 + index);
};

// Default columns for the item's custom table, using field1-field7 for native parity with DocumentEditor
const DEFAULT_TABLE_HEADERS = [
  { id: 'field1', labelFa: 'کد ردیف', labelEn: 'Row Code' },
  { id: 'field2', labelFa: 'عنوان موضوع پایش', labelEn: 'Monitoring Subject' },
  { id: 'field3', labelFa: 'روش کنترل و ابزار پایش', labelEn: 'Control Method & Tool' },
  { id: 'field4', labelFa: 'حدود پذیرش / معیار پذیرش', labelEn: 'Acceptance Criteria' },
  { id: 'field5', labelFa: 'مسئول پیگیری', labelEn: 'Owner' },
  { id: 'field6', labelFa: 'دوره تناوب', labelEn: 'Frequency' },
  { id: 'field7', labelFa: 'آخرین وضعیت / نتیجه اقدامات', labelEn: 'Status / Outcome' }
];

export default function IatfToolsDashboard({
  lang,
  localizedIatfData,
  customDocuments,
  onDocumentClick,
  onSaveDocument,
  items,
  setItems,
  activeItemId,
  setActiveItemId,
  onOpenPortal,
  csrComparisons = []
}: IatfToolsDashboardProps) {
  const isRtl = lang === 'fa';

  const activeItem = useMemo(() => {
    return items.find(i => i.id === activeItemId) || null;
  }, [items, activeItemId]);

  const inlineDocTemplate = useMemo(() => {
    if (!activeItem) return null;
    const docName = activeItem.name;
    let cleanDocName = docName.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
    if (
      cleanDocName === 'Risk and Opportunity Management' ||
      cleanDocName === 'Risk & Opportunity FMEA' ||
      cleanDocName === 'مدیریت ریسک‌ها و فرصت‌ها' ||
      cleanDocName === 'مدیریت ریسک و فرصت‌ها'
    ) {
      cleanDocName = 'مدیریت ریسک و فرصت‌ها';
    }
    const template = documentTemplates[cleanDocName] || Object.values(documentTemplates).find((t: any) => t.title === cleanDocName) || getGenericTemplate(cleanDocName);
    
    // Look up in Relational Core Database directly to load real records fresh
    const dbItems = QmsDatabase.selectRow<DocItem[]>(QmsDatabase.TABLES.DOCUMENTS, cleanDocName);
    const existingItems = dbItems || customDocuments[cleanDocName];
    
    return {
      ...template,
      title: cleanDocName, // Ensure we use the clean title
      items: existingItems || template.items
    } as DocTemplate;
  }, [activeItem, customDocuments]);

  // --- Active Tab State ---
  // Tabs: 'matrix' (ماتریس), 'cards' (کارت‌ها), 'table' (جدول)
  const [activeTab, setActiveTab] = useState<'matrix' | 'cards' | 'table'>('matrix');

  // --- Clause Tree Search & Expansion ---
  const [clauseSearch, setClauseSearch] = useState('');
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({
    '4': true, '8': true // Default expand chapters 4 and 8
  });

  // Custom confirmation dialog state
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

  // --- Custom Table State for Active Item ---
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [tableHeaders, setTableHeaders] = useState<any[]>(DEFAULT_TABLE_HEADERS);
  const [tableSearchQuery, setTableSearchQuery] = useState('');

  // Load custom table rows and headers when active item changes
  useEffect(() => {
    if (!activeItemId || !activeItem) return;
    try {
      // Load custom headers if saved
      const savedHeadersKey = `iatf_tool_cols_${activeItemId}`;
      const dbHeaders = QmsDatabase.selectRow<any[]>('documents_table', savedHeadersKey);
      if (dbHeaders && dbHeaders.length > 0) {
        setTableHeaders(dbHeaders);
      } else {
        const localHeaders = localStorage.getItem(savedHeadersKey);
        if (localHeaders) {
          try {
            setTableHeaders(JSON.parse(localHeaders));
          } catch {
            setTableHeaders(DEFAULT_TABLE_HEADERS);
          }
        } else {
          setTableHeaders(DEFAULT_TABLE_HEADERS);
        }
      }

      // Load custom table rows from documents_table under the active tool's name
      // This is the peak of elegance: it shares data natively with the QMS document database!
      const savedRows = QmsDatabase.selectRow<any[]>('documents_table', activeItem.name) || 
                        QmsDatabase.selectRow<any[]>('documents_table', `iatf_tool_table_${activeItemId}`) ||
                        JSON.parse(localStorage.getItem(`iatf_tool_rows_${activeItemId}`) || '[]');
                        
      if (savedRows && savedRows.length > 0) {
        setTableRows(savedRows);
      } else {
        setTableRows([]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [activeItemId, activeItem, isRtl]);

  // Save custom table rows when updated
  const saveTableRows = (nextRows: any[]) => {
    setTableRows(nextRows);
    if (!activeItemId || !activeItem) return;
    localStorage.setItem(`iatf_tool_rows_${activeItemId}`, JSON.stringify(nextRows));
    // Write natively to both keys to maintain absolute safety
    QmsDatabase.writeRow('documents_table', `iatf_tool_table_${activeItemId}`, nextRows);
    QmsDatabase.writeRow('documents_table', activeItem.name, nextRows);
  };

  // Save headers when updated
  const saveTableHeaders = (nextHeaders: any[]) => {
    setTableHeaders(nextHeaders);
    if (!activeItemId) return;
    localStorage.setItem(`iatf_tool_cols_${activeItemId}`, JSON.stringify(nextHeaders));
    QmsDatabase.writeRow('documents_table', `iatf_tool_cols_${activeItemId}`, nextHeaders);
  };

  // --- Fetch Processes-Requirements Matrix Data ---
  const processRequirementsMatrix = useMemo(() => {
    const dbRows = QmsDatabase.selectRow<any[]>('documents_table', 'ماتریس فرآیندها-الزامات') || 
                   QmsDatabase.selectRow<any[]>('documents_table', 'ماتریس فرآیندها-الزامات (Process-Requirements Matrix)') || [];
    return dbRows;
  }, []);

  // --- Map Selected Clauses to Columns (Processes) ---
  const activeColumns = useMemo(() => {
    if (!activeItem) return [];
    
    // Find all processes where at least one of their associated clauses matches the item's selected clauses
    const matchedProcesses = processRequirementsMatrix.filter(proc => {
      const procClauses = (proc.field3 || '').split(',').map((s: string) => s.trim());
      return activeItem.selectedClauses.some(selClause => {
        // Direct match or parent match
        return procClauses.some(pCl => pCl === selClause || selClause.startsWith(pCl + '.') || pCl.startsWith(selClause + '.'));
      });
    });

    return matchedProcesses.map(proc => ({
      id: proc.id || `proc_${Math.random()}`,
      title: proc.field1,
      type: proc.field2,
      rawClauseField: proc.field3
    }));
  }, [activeItem, processRequirementsMatrix]);

  // --- Map Selected Clauses into Flat Array ---
  const activeClauses = useMemo(() => {
    if (!activeItem) return [];
    const flat: IATFClause[] = [];
    const searchRecursively = (list: IATFClause[]) => {
      list.forEach(c => {
        if (activeItem.selectedClauses.includes(c.id)) {
          flat.push(c);
        }
        if (c.subClauses && c.subClauses.length > 0) {
          searchRecursively(c.subClauses);
        }
      });
    };
    searchRecursively(localizedIatfData);
    return flat;
  }, [activeItem, localizedIatfData]);

  // --- Standardize Dynamic Spreadsheet Handlers ---
  const handleAddTableRow = () => {
    const newRowId = `row_${Date.now()}`;
    const newRow: any = { id: newRowId };
    tableHeaders.forEach(h => {
      newRow[h.id] = '';
    });
    newRow.field1 = `CTRL-${tableRows.length + 1}`;
    saveTableRows([...tableRows, newRow]);
  };

  const handleUpdateTableCell = (rowId: string, colId: string, value: string) => {
    const nextRows = tableRows.map(r => {
      if (r.id === rowId) {
        return { ...r, [colId]: value };
      }
      return r;
    });
    saveTableRows(nextRows);
  };

  const handleDeleteTableRow = (rowId: string) => {
    const confirmMsg = isRtl
      ? 'آیا از حذف این سطر جدول اطمینان دارید؟ این عملیات قابل بازگشت نیست.'
      : 'Are you sure you want to delete this table row? This action cannot be undone.';
    if (!window.confirm(confirmMsg)) return;
    saveTableRows(tableRows.filter(r => r.id !== rowId));
  };

  const handleUpdateColumnHeader = (colId: string, value: string) => {
    const next = tableHeaders.map(h => {
      if (h.id === colId) {
        return {
          ...h,
          labelFa: isRtl ? value : h.labelFa,
          labelEn: !isRtl ? value : h.labelEn
        };
      }
      return h;
    });
    saveTableHeaders(next);
  };

  const handleAddTableColumn = () => {
    const nextIdx = tableHeaders.length + 1;
    const newId = `field${nextIdx}`;
    const newCol = {
      id: newId,
      labelFa: isRtl ? `ستون ${nextIdx}` : `Column ${nextIdx}`,
      labelEn: `Column ${nextIdx}`
    };
    const nextCols = [...tableHeaders, newCol];
    saveTableHeaders(nextCols);
    
    // Seed blank keys in rows
    const nextRows = tableRows.map(r => ({ ...r, [newId]: '' }));
    saveTableRows(nextRows);
  };

  const handleDeleteTableColumn = (colId: string) => {
    if (tableHeaders.length <= 1) {
      alert(isRtl ? 'حداقل وجود یک ستون در جدول الزامی است.' : 'At least one column is required.');
      return;
    }
    const colName = tableHeaders.find(h => h.id === colId)?.labelFa || colId;
    const confirmMsg = isRtl
      ? `آیا از حذف ستون "${colName}" و کلیه داده‌های سطرها اطمینان دارید؟`
      : `Are you sure you want to delete column "${colName}" and all associated data?`;
    if (!window.confirm(confirmMsg)) return;
    const nextCols = tableHeaders.filter(h => h.id !== colId);
    saveTableHeaders(nextCols);
    
    // Remove data from rows
    const nextRows = tableRows.map(r => {
      const clone = { ...r };
      delete clone[colId];
      return clone;
    });
    saveTableRows(nextRows);
  };

  // Filter custom table rows based on search
  const filteredTableRows = useMemo(() => {
    if (!tableSearchQuery.trim()) return tableRows;
    return tableRows.filter(row => {
      return Object.values(row).some(val => 
        String(val).toLowerCase().includes(tableSearchQuery.toLowerCase())
      );
    });
  }, [tableRows, tableSearchQuery]);

  // Export Table to CSV
  const handleExportCSV = () => {
    let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Farsi
    csvContent += tableHeaders.map(h => `"${isRtl ? h.labelFa : h.labelEn}"`).join(',') + '\n';
    tableRows.forEach(row => {
      const line = tableHeaders.map(h => `"${(row[h.id] || '').replace(/"/g, '""')}"`).join(',');
      csvContent += line + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `iatf_table_${activeItem?.name || 'export'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import Table from CSV
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) return;

        const importedRows: any[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.replace(/^"|"$/g, '').trim());
          if (cells.length === 0) continue;
          const rowObj: any = { id: `imported_${Date.now()}_${i}` };
          tableHeaders.forEach((h, colIndex) => {
            rowObj[h.id] = cells[colIndex] || '';
          });
          importedRows.push(rowObj);
        }
        if (importedRows.length > 0) {
          saveTableRows([...tableRows, ...importedRows]);
        }
      } catch (err) {
        console.error(err);
        alert(isRtl ? 'خطا در بارگذاری فایل CSV. لطفاً ساختار فایل را بررسی کنید.' : 'Failed to import CSV.');
      }
    };
    reader.readAsText(file);
  };

  // --- Clause Tree UI Rendering (Recursive) ---
  const renderClauseNode = (clause: IATFClause, level = 0) => {
    const hasChildren = clause.subClauses && clause.subClauses.length > 0;
    const isExpanded = !!expandedChapters[clause.id];
    const isSelected = activeItem?.selectedClauses.includes(clause.id);

    const matchesSearch = !clauseSearch.trim() || 
      clause.id.includes(clauseSearch) || 
      clause.title.toLowerCase().includes(clauseSearch.toLowerCase());

    const toggleExpand = (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedChapters(prev => ({ ...prev, [clause.id]: !prev[clause.id] }));
    };

    const handleToggleSelect = () => {
      if (!activeItem) return;
      let nextClauses = [...activeItem.selectedClauses];
      if (isSelected) {
        nextClauses = nextClauses.filter(id => id !== clause.id);
      } else {
        nextClauses.push(clause.id);
      }
      setItems(prev => prev.map(item => {
        if (item.id === activeItem.id) {
          return { ...item, selectedClauses: nextClauses };
        }
        return item;
      }));
    };

    // Render this node only if it matches search or has matching children
    if (!matchesSearch && !hasChildren) return null;

    return (
      <div key={clause.id} className="flex flex-col select-none" style={{ marginRight: isRtl ? `${level * 12}px` : '0px', marginLeft: !isRtl ? `${level * 12}px` : '0px' }}>
        <div 
          onClick={handleToggleSelect}
          className={`flex items-center gap-2 py-1.5 px-2.5 rounded-lg transition-all cursor-pointer group ${
            isSelected 
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/15' 
              : 'hover:bg-white/5 border border-transparent text-zinc-400 hover:text-zinc-200'
          }`}
        >
          {hasChildren ? (
            <button 
              onClick={toggleExpand} 
              className="p-1 hover:bg-white/10 rounded-md transition-colors text-zinc-500 hover:text-zinc-300"
            >
              {isExpanded ? <ChevronDown size={14} /> : (isRtl ? <ChevronRight size={14} className="rotate-180" /> : <ChevronRight size={14} />)}
            </button>
          ) : (
            <div className="w-6 h-6 flex items-center justify-center shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 group-hover:bg-amber-400 transition-colors"></span>
            </div>
          )}

          <div className="flex flex-col min-w-0 flex-1 text-right">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-black font-mono tracking-tight text-zinc-500 group-hover:text-amber-400/80 transition-colors">{clause.id}</span>
              {csrComparisons?.filter(c => c.mappedIatfClauseId === clause.id).map(c => (
                <span key={c.customerId} className="text-[9px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.2 rounded font-sans font-bold flex items-center gap-0.5 scale-90">
                  📌 {c.customerTitle} ({c.customerNumber})
                </span>
              ))}
            </div>
            <span className="text-xs font-medium truncate leading-tight mt-0.5">{clause.title}</span>
          </div>

          <input 
            type="checkbox"
            checked={!!isSelected}
            onChange={handleToggleSelect}
            className="w-3.5 h-3.5 rounded border-zinc-800 bg-[#121215] text-amber-500 focus:ring-0 cursor-pointer shrink-0 ml-1"
          />
        </div>

        {hasChildren && isExpanded && (
          <div className="border-r border-dashed border-zinc-800/80 mr-3 pr-2 my-1 flex flex-col gap-1">
            {clause.subClauses?.map(child => renderClauseNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 text-right animate-fade-in pb-12" dir={isRtl ? "rtl" : "ltr"}>
      {/* Top Banner & Active Tool Details */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#2A2A2D] pb-5 gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-amber-500/20 to-amber-600/5 rounded-2xl border border-amber-500/20 text-amber-500">
            <Layers size={22} className="animate-pulse" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-black text-white tracking-tight">{isRtl ? 'داشبورد تخصصی ابزارهای IATF' : 'IATF Advanced Tools Dashboard'}</h1>
              <span className="text-[9px] bg-amber-500 text-black px-1.5 py-0.5 rounded-md font-extrabold uppercase shrink-0 font-mono tracking-wider">v4.0</span>
            </div>
            <p className="text-xs text-zinc-500 mt-1">
              {isRtl 
                ? 'محیط طراحی ماتریس‌ها، جدول کنترل و پایش انطباق الزامات بندهای استاندارد IATF 16949' 
                : 'Formulate, trace, and inspect QMS compliance matrices and in-process controls.'}
            </p>
          </div>
        </div>
      </div>

      {/* Check if any tool exists */}
      {!activeItem ? (
        <div className="space-y-6">
          <div className="bg-[#0F0F12] border border-[#27272C] rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4 text-right">
              <div className="p-4 bg-amber-500/10 rounded-2xl text-amber-500 border border-amber-500/20">
                <LayoutGrid size={28} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">{isRtl ? 'پیشخوان جامع ابزارها و میانبرهای سیستم' : 'Comprehensive System Tools & Shortcuts Desk'}</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  {isRtl 
                    ? 'لیست کامل ابزارهای تخصصی طراحی شده و میانبرهای پین شده به سامانه جهت دسترسی فوق‌سریع' 
                    : 'A consolidated list of all specialized compliance tools and custom pinned shortcuts.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                alert(isRtl 
                  ? 'لطفاً برای ایجاد ابزار تخصصی جدید، از منوی کشویی «داشبورد ابزار IATF» در بالای صفحه استفاده کنید.' 
                  : 'Please use the "IATF Tooling Dashboard" dropdown at the top of the page to add a new specialized tool.'
                );
              }}
              className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10px] uppercase tracking-widest px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <PlusCircle size={13} />
              <span>{isRtl ? 'افزودن ابزار تخصصی جدید' : 'Create New Specialized Tool'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Render standard tools */}
            {items.map((item) => {
              const isShortcut = !!item.shortcutType;
              return (
                <div 
                  key={item.id}
                  onClick={() => {
                    if (isShortcut) {
                      if (item.shortcutType === 'document' && onDocumentClick) {
                        onDocumentClick(item.shortcutTarget || '');
                      } else if (item.shortcutType === 'portal' && onOpenPortal) {
                        onOpenPortal(item.shortcutTarget || '');
                      }
                    } else {
                      setActiveItemId(item.id);
                    }
                  }}
                  className={`border rounded-2xl p-5 bg-[#0F0F12]/80 hover:bg-[#151518]/90 transition-all duration-350 cursor-pointer flex flex-col justify-between h-40 group hover:scale-[1.01] hover:shadow-2xl ${
                    isShortcut 
                      ? 'border-amber-500/10 hover:border-amber-500/30 shadow-lg shadow-amber-500/[0.01]' 
                      : 'border-zinc-850 hover:border-zinc-700 shadow-sm'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isShortcut 
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {isShortcut 
                          ? (item.shortcutType === 'document' ? (isRtl ? '📌 میانبر سند' : '📌 Doc Pin') : (isRtl ? '⚡ میانبر سامانه' : '⚡ System Pin'))
                          : (isRtl ? '🛠️ ابزار کنترلی' : '🛠️ Compliance Tool')
                        }
                      </span>
                      <span className="text-[8px] text-zinc-500 font-mono">
                        {new Date(item.createdAt).toLocaleDateString(isRtl ? 'fa-IR' : 'en-US')}
                      </span>
                    </div>

                    <h4 className="text-xs font-black text-white group-hover:text-amber-400 transition-colors line-clamp-1">
                      {item.name}
                    </h4>
                    <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-3">
                    <span className="text-[10px] text-amber-500/80 font-bold group-hover:text-amber-400 transition-all flex items-center gap-1">
                      {isShortcut ? (isRtl ? 'ورود مستقیم ➔' : 'Navigate ➔') : (isRtl ? 'باز کردن ابزار ➔' : 'Open Tool ➔')}
                    </span>
                    
                    {/* Delete Shortcut */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmModal({
                          isOpen: true,
                          title: isRtl ? '⚠️ حذف میانبر / ابزار' : '⚠️ Delete Shortcut',
                          message: isRtl ? `آیا می‌خواهید این مورد (${item.name}) را حذف کنید؟` : `Are you sure you want to delete ${item.name}?`,
                          onConfirm: () => {
                            const updated = items.filter(i => i.id !== item.id);
                            setItems(updated);
                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                          }
                        });
                      }}
                      className="p-1 hover:bg-red-500/10 rounded text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                      title={isRtl ? 'حذف' : 'Delete'}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}

            {items.length === 0 && (
              <div className="col-span-full bg-[#0F0F12] border border-[#27272C] rounded-2xl p-12 text-center flex flex-col items-center justify-center gap-3 text-zinc-500">
                <Folder size={40} className="text-zinc-700 stroke-[1]" />
                <p className="text-xs font-bold">{isRtl ? 'مخزن ابزارها و میانبرها خالی است' : 'Inventory is empty'}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Active Workspace Header and Details */}
          <div className="flex flex-col gap-5 bg-[#0F0F12] border border-[#27272C] rounded-2xl p-5 md:p-6 shadow-xl animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div className="flex flex-col gap-1 text-right">
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <span className="bg-amber-500/10 text-amber-500 px-2.5 py-1 rounded-xl text-xs font-mono font-black border border-amber-500/15">
                    {isRtl ? 'پایش ابزار فعال' : 'Active Tool'}
                  </span>
                  <span>{activeItem.name}</span>
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  {activeItem.description}
                </p>
              </div>

              {/* Tab Navigation */}
              <div className="flex bg-[#141418] border border-[#232326] p-1 rounded-xl shrink-0 self-end md:self-center">
                <button
                  onClick={() => setActiveTab('matrix')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'matrix' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10 font-extrabold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Layers size={13} />
                  <span>{isRtl ? 'ماتریس انطباق فرآیندها' : 'Compliance Matrix'}</span>
                </button>
                <button
                  onClick={() => setActiveTab('cards')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'cards' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10 font-extrabold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid size={13} />
                  <span>{isRtl ? 'کارت‌های الزامات ساخت' : 'Process Cards'}</span>
                </button>
                <button
                  onClick={() => setActiveTab('table')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'table' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10 font-extrabold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet size={13} />
                  <span>{isRtl ? `جدول ${activeItem.name}` : `Table: ${activeItem.name}`}</span>
                </button>
              </div>
            </div>

            {/* TAB CONTENT: MATRIX */}
            {activeTab === 'matrix' && (
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 animate-fade-in">
                {/* Right: Clause Picker Tree (2 Columns on Large Screens) */}
                <div className="lg:col-span-2 bg-[#141418] border border-[#252529] p-4 rounded-xl flex flex-col gap-4 max-h-[500px] overflow-hidden">
                  <div className="flex flex-col gap-2 border-b border-white/5 pb-3">
                    <span className="text-[11px] font-black text-amber-500 uppercase tracking-widest">{isRtl ? '۱. انتخاب بندهای استاندارد IATF' : '1. SELECT STANDARD CLAUSES'}</span>
                    <p className="text-[10px] text-zinc-500">{isRtl ? 'بندهای مد نظر برای پایش در ماتریس کنترل حین تولید را انتخاب کنید' : 'Check standard clauses to monitor in this matrix.'}</p>
                    <div className="relative mt-2">
                      <Search size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        placeholder={isRtl ? 'جستجو در بندها و عناوین...' : 'Search clauses...'}
                        value={clauseSearch}
                        onChange={(e) => setClauseSearch(e.target.value)}
                        className="w-full bg-[#0D0D10] border border-[#212124] rounded-lg pl-3 pr-8 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500/50 text-right"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 custom-scrollbar text-right">
                    {localizedIatfData.map(chapter => renderClauseNode(chapter))}
                  </div>
                </div>

                {/* Left: Auto compliance Matrix (3 Columns) */}
                <div className="lg:col-span-3 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-amber-500 uppercase tracking-widest">{isRtl ? '۲. ماتریس زنده فرآیندها-الزامات' : '2. LIVE PROCESS-REQUIREMENTS MATRIX'}</span>
                  </div>

                  {activeColumns.length === 0 ? (
                    <div className="p-8 text-center bg-amber-500/5 border border-amber-500/10 rounded-xl flex flex-col items-center gap-2">
                      <AlertCircle size={28} className="text-amber-500" />
                      <p className="text-xs font-bold text-zinc-400">{isRtl ? 'هیچ فرآیندی مرتبط با بندهای انتخابی شما یافت نشد.' : 'No matching processes for selected clauses.'}</p>
                      <p className="text-[10px] text-zinc-500">
                        {isRtl 
                          ? 'ستون‌های ماتریس به صورت خودکار بر اساس فرآیندهایی که در ماتریس فرآیندها-الزامات (بند ۴.۴) به این بندها متصل شده‌اند استخراج می‌شوند.' 
                          : 'Matrix columns are dynamically retrieved based on corresponding processes linked to the selected clauses in the Process-Requirements Matrix.'}
                      </p>
                    </div>
                  ) : (
                    <div className="border border-[#1E1E22] rounded-xl overflow-hidden shadow-lg bg-[#0A0A0C]">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-right border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#121215] border-b border-[#252529]">
                              <th className="p-3 font-black text-zinc-400 text-right w-[110px]">{isRtl ? 'بند استاندارد' : 'IATF Clause'}</th>
                              <th className="p-3 font-black text-zinc-400 text-right min-w-[150px]">{isRtl ? 'شرح بند انتخابی' : 'Clause Title'}</th>
                              {activeColumns.map(col => (
                                <th key={col.id} className="p-3 font-black text-zinc-400 text-center min-w-[80px]">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-[10px] text-white font-extrabold">{col.title}</span>
                                    <span className="text-[8px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 font-mono font-black scale-90 border border-amber-500/15">
                                      {col.type}
                                    </span>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {activeClauses.length === 0 ? (
                              <tr>
                                <td colSpan={activeColumns.length + 2} className="p-8 text-center text-zinc-500 italic">
                                  {isRtl ? 'لطفاً حداقل یک بند را از درخت استاندارد انتخاب کنید.' : 'Please check at least one clause in the standard tree.'}
                                </td>
                              </tr>
                            ) : (
                              activeClauses.map(clauseNum => {
                                return (
                                  <tr key={clauseNum.id} className="border-b border-[#18181B] hover:bg-white/5 transition-colors">
                                    <td className="p-3 font-mono font-extrabold text-amber-500">{clauseNum.id}</td>
                                    <td className="p-3 font-medium text-zinc-300">
                                      <div className="flex flex-col gap-1">
                                        <span title={clauseNum.title}>{clauseNum.title}</span>
                                        {csrComparisons?.filter(c => c.mappedIatfClauseId === clauseNum.id).map(c => (
                                          <span key={c.customerId} className="text-[10px] text-amber-400 font-bold bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10 self-start mt-0.5" title={c.customerText}>
                                            📌 {c.customerTitle} ({c.customerNumber}) — {lang === 'fa' ? 'الزام خاص مشتری' : 'Customer Requirement'}
                                          </span>
                                        ))}
                                      </div>
                                    </td>
                                    {activeColumns.map(col => {
                                      // Check if this process supports this clause
                                      const rawClauses = (col.rawClauseField || '').split(',').map((s: string) => s.trim());
                                      const hasLink = rawClauses.some((pCl: string) => 
                                        pCl === clauseNum.id || 
                                        clauseNum.id.startsWith(pCl + '.') || 
                                        pCl.startsWith(clauseNum.id + '.')
                                      );

                                      return (
                                        <td key={col.id} className="p-3 text-center">
                                          {hasLink ? (
                                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-black text-[9px] shadow-[0_0_8px_rgba(16,185,129,0.1)]">
                                              ✓
                                            </span>
                                          ) : (
                                            <span className="text-zinc-700 font-mono">-</span>
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
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: CARDS */}
            {activeTab === 'cards' && (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-3">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-amber-500 uppercase tracking-widest">{isRtl ? 'شناسنامه الزامات و فرآیندهای ساخت ابزار' : 'Process Requirement Cards'}</span>
                    <p className="text-[10px] text-zinc-500 mt-1">{isRtl ? 'کارت‌های فرآیندی شامل تحلیل گام به گام و انطباق الزامات بندهای انتخاب شده' : 'Individual process sheets detailing step analysis and controls.'}</p>
                  </div>
                </div>

                {activeClauses.length === 0 ? (
                  <div className="p-8 text-center bg-amber-500/5 border border-amber-500/10 rounded-xl flex flex-col items-center gap-2">
                    <AlertCircle size={24} className="text-amber-500" />
                    <p className="text-xs font-bold text-zinc-400">{isRtl ? 'بند انتخابی یافت نشد.' : 'No clauses checked.'}</p>
                    <p className="text-[10px] text-zinc-500">{isRtl ? 'ابتدا در تب ماتریس، بندهای مورد نظر را از درخت انتخاب کنید.' : 'Check standard clauses in the Matrix tab first.'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeClauses.map(cl => {
                      // Find matched processes for this clause
                      const clauseProcesses: any[] = [];
                      processRequirementsMatrix.forEach(col => {
                        const rawClauses = (col.field3 || '').split(',').map((s: string) => s.trim());
                        const hasLink = rawClauses.some((pCl: string) => 
                          pCl === cl.id || 
                          cl.id.startsWith(pCl + '.') || 
                          pCl.startsWith(cl.id + '.')
                        );
                        if (hasLink) {
                          clauseProcesses.push({
                            id: col.id,
                            name: col.field1,
                            type: col.field2
                          });
                        }
                      });

                      if (clauseProcesses.length === 0) {
                        return (
                          <div key={cl.id} className="bg-[#141418] border border-[#252529] rounded-xl p-4 flex flex-col justify-between gap-3 opacity-60">
                            <div>
                              <span className="text-[10px] font-mono font-black text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">{cl.id}</span>
                              <h4 className="text-xs font-black text-white mt-2 line-clamp-1">{cl.title}</h4>
                              <p className="text-[10px] text-zinc-500 italic mt-2">{isRtl ? 'فرآیند مرتبطی در ماتریس فرآیندها ثبت نشده است.' : 'No process links.'}</p>
                            </div>
                          </div>
                        );
                      }

                      return clauseProcesses.map((pr, idx) => (
                        <div key={`${cl.id}_${pr.id}_${idx}`} className="bg-[#141418] border border-[#252529] rounded-xl p-4 flex flex-col gap-3 shadow-md hover:border-amber-500/20 transition-all group">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-black text-amber-500 bg-amber-500/5 px-2 py-0.5 rounded border border-amber-500/10">
                              {cl.id}
                            </span>
                            <span className="text-[8px] bg-amber-500 text-black px-1.5 py-0.2 rounded font-extrabold uppercase scale-90 font-mono">
                              {pr.type}
                            </span>
                          </div>

                          <h4 className="text-xs font-black text-white line-clamp-1 group-hover:text-amber-400 transition-colors">
                            {cl.title}
                          </h4>

                          <div className="border-t border-white/5 pt-2 flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                              <span className="text-[10px] text-zinc-500">{isRtl ? 'فرآیند درگیر:' : 'Linked Process:'}</span>
                              <span className="text-[10px] text-zinc-300 font-bold">{pr.name}</span>
                            </div>

                            <div className="flex flex-col gap-1">
                              <span className="text-[9px] text-zinc-500">{isRtl ? 'روش پایش و انطباق استاندارد:' : 'Standard audit check:'}</span>
                              <span className="text-[10px] text-zinc-400 font-semibold leading-relaxed bg-[#0D0D10] p-1.5 rounded-lg border border-white/5">
                                {isRtl 
                                  ? `ارزیابی روش اجرایی تولید بر اساس کنترل‌های پیشگیرانه بند ${cl.id} و پایش انطباق فرآیند ${pr.name}`
                                  : `Audit and validation of production instruction under preventive controls of clause ${cl.id} and process ${pr.name}`}
                              </span>
                            </div>

                            {csrComparisons?.filter(c => c.mappedIatfClauseId === cl.id).map(c => (
                              <div key={c.customerId} className="flex flex-col gap-1 bg-amber-500/[0.03] border border-amber-500/10 p-2 rounded-lg mt-1">
                                <span className="text-[9px] text-amber-500 font-black flex items-center gap-1">
                                  <span>📌</span>
                                  <span>{isRtl ? 'الزام خاص مشتری (موازی):' : 'Parallel CSR requirement:'} {c.customerTitle}</span>
                                </span>
                                <span className="text-[9.5px] text-zinc-400 font-medium leading-relaxed">
                                  {c.customerText}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAB CONTENT: INLINE DOCUMENT EDITOR */}
            {activeTab === 'table' && inlineDocTemplate && (
              <div className="w-full animate-fade-in">
                <DocumentEditor
                  isOpen={true}
                  onClose={() => {}}
                  template={inlineDocTemplate}
                  onSave={(items, columns, newTitle) => {
                    if (onSaveDocument) {
                      onSaveDocument(items, columns, newTitle, inlineDocTemplate.title, inlineDocTemplate.smartType);
                    }
                  }}
                  lang={lang}
                  isInline={true}
                  requireMetadata={false}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom Confirmation Dialog Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0F0F12] border border-[#27272C] rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
              <span className="text-red-500">{confirmModal.title}</span>
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="bg-red-500 hover:bg-red-650 text-white px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg"
              >
                {isRtl ? 'بله، حذف شود' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
