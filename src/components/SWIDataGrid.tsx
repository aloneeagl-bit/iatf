/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Plus, Trash2, Copy, Search, Filter, ArrowUpDown, Sparkles, 
  RefreshCw, FileSpreadsheet, Eye, Database, Link, Unlink, ChevronDown, Check, X, LayoutGrid, HelpCircle
} from 'lucide-react';
import { SWIStep, SWIBlock, DEFAULT_SWI_BLOCKS } from '../types/swi';
import { QmsDatabase } from '../lib/qmsDatabase';
import { documentTemplates } from '../data/documentTemplates';
import * as XLSX from 'xlsx';

interface SWIDataGridProps {
  steps: SWIStep[];
  onStepsChange: (steps: SWIStep[]) => void;
  onSelectStep: (stepId: string) => void;
  selectedStepId: string | null;
  blocks: SWIBlock[];
  onBlocksChange?: (blocks: SWIBlock[]) => void;
  columnDbLinks: Record<string, { dbTable: string; dbColumn: string }>;
  onColumnDbLinksChange: (colDbLinks: Record<string, { dbTable: string; dbColumn: string }>) => void;
  lang: 'fa' | 'en';
  localDraftStep?: Partial<SWIStep>;
  setLocalDraftStep?: React.Dispatch<React.SetStateAction<Partial<SWIStep>>>;
  isDraftingNewStep?: boolean;
  setIsDraftingNewStep?: React.Dispatch<React.SetStateAction<boolean>>;
}

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

export default function SWIDataGrid({ 
  steps, 
  onStepsChange, 
  onSelectStep, 
  selectedStepId,
  blocks,
  onBlocksChange,
  columnDbLinks,
  onColumnDbLinksChange,
  lang,
  localDraftStep = {},
  setLocalDraftStep,
  isDraftingNewStep = false,
  setIsDraftingNewStep
}: SWIDataGridProps) {
  const isRtl = lang === 'fa';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStationFilter, setSelectedStationFilter] = useState('ALL');
  const [sortField, setSortField] = useState<keyof SWIStep | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // AI Generator state
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAiDbModalOpen, setIsAiDbModalOpen] = useState(false);
  const [aiDataSources, setAiDataSources] = useState<{ id: string; tableId: string; columns: string[] }[]>([]);
  const [aiCustomContext, setAiCustomContext] = useState('');
  const [aiDbSelectedTable, setAiDbSelectedTable] = useState('');
  const [aiDbSelectedColumns, setAiDbSelectedColumns] = useState<string[]>([]);
  const [isAiTableSelectOpen, setIsAiTableSelectOpen] = useState(false);
  const [aiTableSearch, setAiTableSearch] = useState('');
  
  // Inline edit state
  const [editingCell, setEditingCell] = useState<{ rowId: string; colField: keyof SWIStep } | null>(null);
  const [editingValue, setEditingValue] = useState('');

  // DB config state
  const [configColField, setConfigColField] = useState<string | null>(null);
  const [dbSelectedTable, setDbSelectedTable] = useState('');
  const [dbSelectedColumn, setDbSelectedColumn] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [isTableSelectOpen, setIsTableSelectOpen] = useState(false);

  // Row bind state
  const [bindRowStepId, setBindRowStepId] = useState<string | null>(null);
  const [bindRowColField, setBindRowColField] = useState<string | null>(null);
  const [rowSearchTerm, setRowSearchTerm] = useState('');

  // Symbol selector state
  const [symbolStepId, setSymbolStepId] = useState<string | null>(null);

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



  // Extract unique stations for filter
  const uniqueStations = useMemo(() => {
    const stations = new Set(steps.map(s => s.station).filter(Boolean));
    return ['ALL', ...Array.from(stations)];
  }, [steps]);

  // Compute dynamic columns list from layout blocks
  const dynamicColumns = useMemo(() => {
    if (steps.length === 0) return [];
    return blocks
      .filter(b => b.visible && b.columnMapping && b.columnMapping !== 'doc_info' && b.columnMapping !== 'signatures')
      .map(b => ({
        id: b.id,
        field: b.columnMapping!,
        label: b.title,
        type: b.type
      }));
  }, [blocks, steps.length]);

  // Resolve Cell DB value (Single Source of Truth)
  const getResolvedCellValue = (step: SWIStep, colField: string) => {
    const dbLink = columnDbLinks?.[colField];
    if (dbLink && dbLink.dbTable && dbLink.dbColumn) {
      const rowId = step.dbRowIds?.[colField];
      if (rowId) {
        try {
          const targetRow = QmsDatabase.selectRow<any>(dbLink.dbTable as any, rowId);
          if (targetRow) {
            const val = targetRow[dbLink.dbColumn];
            return val !== undefined && val !== null ? String(val) : '';
          }
        } catch (e) {
          console.warn('Error resolving DB cell value', e);
        }
      }
      return '';
    }
    return step[colField] !== undefined && step[colField] !== null ? String(step[colField]) : '';
  };

  // Handle cell edit save
  const handleCellSave = (rowId: string, colField: keyof SWIStep, value: any) => {
    if (rowId === 'draft-step-id') {
      let finalVal = value;
      if (colField === 'stdTime') {
        finalVal = parseInt(value, 10) || 0;
      }
      setLocalDraftStep?.(prev => ({ ...prev, [colField]: finalVal }));
      setEditingCell(null);
      return;
    }
    const updated = steps.map(step => {
      if (step.id === rowId) {
        let finalVal = value;
        if (colField === 'stdTime') {
          finalVal = parseInt(value, 10) || 0;
        }
        return { ...step, [colField]: finalVal };
      }
      return step;
    });
    onStepsChange(updated);
    setEditingCell(null);
  };

  const isAnyColumnDbLinked = useMemo(() => {
    return Object.values(columnDbLinks || {}).some(link => link && link.dbTable && link.dbColumn);
  }, [columnDbLinks]);

  // Add blank step
  const handleAddStep = () => {
    if (isAnyColumnDbLinked) return;
    const newStep: SWIStep = {
      id: `swi-step-${Date.now()}`,
      station: isRtl ? 'ایستگاه کاری جدید' : 'New Station',
      partNo: steps[0]?.partNo || (isRtl ? 'شماره فنی قطعه' : 'PART-1000'),
      operation: isRtl ? 'شرح عملیات جدید' : 'New Operation Description',
      jobElements: isRtl ? 'توضیحات و گام‌های تفصیلی کار' : 'Detailed job element descriptions',
      keyPoints: isRtl ? 'نکات کلیدی فنی و مهندسی' : 'Technical key points',
      reasonWhy: isRtl ? 'دلیل ایمنی و کیفیت این کار' : 'Safety and quality reason why',
      equipment: isRtl ? 'ابزار، گیج و تجهیزات کمکی' : 'Tooling & inspection gauges',
      safety: isRtl ? 'تجهیزات حفاظتی لازم (PPE)' : 'Required PPE',
      stdTime: 60,
      imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80',
      images: ['https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80'],
      activeImageIndex: 0,
      annotations: [],
      symbols: []
    };
    onStepsChange([...steps, newStep]);
    onSelectStep(newStep.id);
  };

  // Duplicate step
  const handleDuplicateStep = (step: SWIStep, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAnyColumnDbLinked) return;
    const duplicated: SWIStep = {
      ...step,
      id: `swi-step-${Date.now()}`,
      operation: `${step.operation} (${isRtl ? 'کپی' : 'Copy'})`,
      annotations: step.annotations ? [...step.annotations] : [],
      symbols: step.symbols ? [...step.symbols] : []
    };
    const index = steps.findIndex(s => s.id === step.id);
    const nextSteps = [...steps];
    nextSteps.splice(index + 1, 0, duplicated);
    onStepsChange(nextSteps);
  };

  // Delete step
  const handleDeleteStep = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = steps.filter(s => s.id !== id);
    onStepsChange(filtered);
    if (selectedStepId === id && filtered.length > 0) {
      onSelectStep(filtered[0].id);
    }
  };

  // AI Fill / Generator
  const handleAiGenerate = async () => {
    if (isAnyColumnDbLinked || aiDataSources.length === 0) return;
    setIsAiLoading(true);
    
    try {
      const persona = isRtl 
        ? "شما یک متخصص خبره در طراحی و ایجاد دستورالعمل‌های کار استاندارد شده (SWI) بر اساس الزامات JES (Job Element Sheet)، SOS (Standard Operation Sheet) و استانداردهای IATF 16949 هستید."
        : "You are an expert specialist in designing and creating Standard Work Instructions (SWI) based on JES (Job Element Sheet), SOS (Standard Operation Sheet), and IATF 16949 requirements.";

      const instructions = isRtl
        ? "وظیفه شما استخراج داده‌های فنی از جداول دیتابیس QMS و تبدیل آن‌ها به گام‌های عملیاتی دقیق و استاندارد است. خروجی باید کاملا حرفه‌ای و مطابق با استانداردهای مهندسی باشد."
        : "Your task is to extract technical data from QMS database tables and transform them into precise, standardized operational steps. The output must be professional and follow engineering standards.";

      // Construct context from all selected sources
      let contextStr = "";
      for (const source of aiDataSources) {
        const tableData = QmsDatabase.selectAll(source.tableId as any);
        if (tableData) {
          const rows = Object.values(tableData).slice(0, 10); // Representative sample
          const filteredRows = rows.map((row: any) => {
            if (source.columns.length > 0) {
              const obj: any = {};
              source.columns.forEach(col => { if (col in row) obj[col] = row[col]; });
              return obj;
            }
            return row;
          });
          contextStr += `\n- Table: ${source.tableId}\n- Data Context: ${JSON.stringify(filteredRows)}\n`;
        }
      }

      const finalPrompt = `${persona}\n${instructions}\n\nUser Context/Prompt: ${aiCustomContext || 'Generate SWI steps based on data'}\n\nAvailable QMS Data Sources:\n${contextStr}\n\nGenerate a JSON array of SWI steps. Each object must have: station, operation, jobElements, keyPoints, reasonWhy, equipment, safety, stdTime. Response must be ONLY the JSON array. Language: ${isRtl ? 'Persian' : 'English'}`;

      const aiResponse = await fetch('/api/iatf-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          model: 'gemini-3.5-flash'
        })
      });

      const aiResult = await aiResponse.json();
      
      if (aiResult.success && aiResult.text) {
        const jsonMatch = aiResult.text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          try {
            const parsedSteps = JSON.parse(jsonMatch[0]);
            if (Array.isArray(parsedSteps)) {
              const newSteps: SWIStep[] = parsedSteps.map((s: any, idx: number) => ({
                id: `swi-ai-${Date.now()}-${idx}`,
                station: s.station || '',
                partNo: steps[0]?.partNo || 'AUTO-GEN',
                operation: s.operation || '',
                jobElements: s.jobElements || '',
                keyPoints: s.keyPoints || '',
                reasonWhy: s.reasonWhy || '',
                equipment: s.equipment || '',
                safety: s.safety || '',
                stdTime: Number(s.stdTime) || 60,
                imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80',
                images: ['https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80'],
                activeImageIndex: 0,
                annotations: [],
                symbols: [],
                dbRowIds: {}
              }));

              onStepsChange([...steps, ...newSteps]);
              setAiCustomContext('');
              setAiDataSources([]);
              setIsAiDbModalOpen(false);
              return;
            }
          } catch (e) {
            console.error('Failed to parse AI JSON', e);
          }
        }
      }

      // Fallback
      setIsAiLoading(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Import from Excel file
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isAnyColumnDbLinked) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Parse rows as raw JSON array
        const rawRows = XLSX.utils.sheet_to_json<any>(worksheet);
        
        if (!Array.isArray(rawRows) || rawRows.length === 0) {
          alert(isRtl ? 'فایل اکسل تهی است یا قالب نامعتبر دارد.' : 'Excel file is empty or has an invalid format.');
          return;
        }

        const newSteps: SWIStep[] = rawRows.map((row, idx) => {
          const findVal = (possibleKeys: string[]) => {
            const key = Object.keys(row).find(k => 
              possibleKeys.some(pk => k.trim().toLowerCase() === pk.toLowerCase())
            );
            return key ? String(row[key]) : undefined;
          };

          const station = findVal(['station', 'ایستگاه', 'ایستگاه کاری', 'work station']) || (isRtl ? 'ایستگاه کاری جدید' : 'New Station');
          const partNo = findVal(['partNo', 'part_no', 'part number', 'شماره فنی', 'قطعه']) || (isRtl ? 'شماره فنی' : 'PART-1000');
          const operation = findVal(['operation', 'عملیات', 'نام عملیات', 'نام عملیات ساخت']) || (isRtl ? 'شرح عملیات جدید' : 'New Operation');
          const jobElements = findVal(['jobElements', 'job_elements', 'جزئیات کار', 'توضیحات']) || (isRtl ? 'جزئیات کار' : 'Job element details');
          const keyPoints = findVal(['keyPoints', 'key_points', 'نکات کلیدی', 'نکته کلیدی']) || '';
          const reasonWhy = findVal(['reasonWhy', 'reason_why', 'دلیل ایمنی', 'دلیل کیفیت']) || '';
          const equipment = findVal(['equipment', 'ابزار', 'تجهیزات']) || '';
          const safety = findVal(['safety', 'حفاظتی', 'تجهیزات حفاظتی']) || '';
          
          const stdTime = parseInt(findVal(['stdTime', 'std_time', 'زمان استاندارد', 'زمان']) || '60', 10) || 60;
          const taktTime = parseInt(findVal(['taktTime', 'takt_time', 'تکت تایم']) || '0', 10) || 0;
          const cycleTime = parseInt(findVal(['cycleTime', 'cycle_time', 'زمان سیکل']) || '0', 10) || 0;
          const manualTime = parseInt(findVal(['manualTime', 'manual_time', 'زمان دستی']) || '0', 10) || 0;
          const machineTime = parseInt(findVal(['machineTime', 'machine_time', 'زمان ماشین']) || '0', 10) || 0;
          const loadUnloadTime = parseInt(findVal(['loadUnloadTime', 'load_unload_time', 'تخلیه']) || '0', 10) || 0;
          const waitingTime = parseInt(findVal(['waitingTime', 'waiting_time', 'انتظار']) || '0', 10) || 0;
          const setupTime = parseInt(findVal(['setupTime', 'setup_time', 'تنظیم']) || '0', 10) || 0;

          const symbolsStr = findVal(['symbols', 'نشان‌ها', 'نشان']) || '';
          const symbols = symbolsStr ? symbolsStr.split(',').map(s => s.trim()) : [];

          return {
            id: `swi-step-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
            station,
            partNo,
            operation,
            jobElements,
            keyPoints,
            reasonWhy,
            equipment,
            safety,
            stdTime,
            taktTime,
            cycleTime,
            manualTime,
            machineTime,
            loadUnloadTime,
            waitingTime,
            setupTime,
            imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80',
            images: ['https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80'],
            activeImageIndex: 0,
            annotations: [],
            symbols,
            dbRowIds: {}
          };
        });

        onStepsChange([...steps, ...newSteps]);
        alert(isRtl ? `${newSteps.length} گام جدید با موفقیت از فایل اکسل وارد شد.` : `Successfully imported ${newSteps.length} steps from Excel.`);
      } catch (err) {
        console.error('Error parsing excel', err);
        alert(isRtl ? 'خطا در خواندن فایل اکسل. لطفا از معتبر بودن ساختار فایل مطمئن شوید.' : 'Error reading Excel file. Make sure format is correct.');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  // Export to Excel
  const handleExportExcel = () => {
    const formatted = steps.map((step, index) => {
      const obj: Record<string, any> = {
        [isRtl ? 'ردیف' : 'Index']: index + 1
      };
      dynamicColumns.forEach(col => {
        obj[col.label] = getResolvedCellValue(step, col.field);
      });
      return obj;
    });

    const worksheet = XLSX.utils.json_to_sheet(formatted);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Standard Work');
    XLSX.writeFile(workbook, `Standard_Work_Instructions_${steps[0]?.partNo || 'QMS'}.xlsx`);
  };

  // Sorting logic
  const handleSort = (field: keyof SWIStep) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedAndFilteredSteps = useMemo(() => {
    return steps
      .filter(step => {
        const stationVal = getResolvedCellValue(step, 'station');
        const operationVal = getResolvedCellValue(step, 'operation');
        const partNoVal = getResolvedCellValue(step, 'partNo');
        const elementsVal = getResolvedCellValue(step, 'jobElements');

        const matchesSearch = 
          stationVal.toLowerCase().includes(searchTerm.toLowerCase()) ||
          operationVal.toLowerCase().includes(searchTerm.toLowerCase()) ||
          elementsVal.toLowerCase().includes(searchTerm.toLowerCase()) ||
          partNoVal.toLowerCase().includes(searchTerm.toLowerCase());
          
        const matchesStation = selectedStationFilter === 'ALL' || stationVal === selectedStationFilter;
        
        return matchesSearch && matchesStation;
      })
      .sort((a, b) => {
        if (!sortField) return 0;
        const valA = getResolvedCellValue(a, sortField);
        const valB = getResolvedCellValue(b, sortField);
        
        if (sortField === 'stdTime') {
          const numA = parseInt(valA, 10) || 0;
          const numB = parseInt(valB, 10) || 0;
          return sortDirection === 'asc' ? numA - numB : numB - numA;
        }
        
        return sortDirection === 'asc' 
          ? String(valA).localeCompare(String(valB), 'fa') 
          : String(valB).localeCompare(String(valA), 'fa');
      });
  }, [steps, searchTerm, selectedStationFilter, sortField, sortDirection, columnDbLinks]);

  const draftRow = useMemo<SWIStep>(() => {
    return {
      id: 'draft-step-id',
      station: localDraftStep.station || '',
      partNo: localDraftStep.partNo || '',
      operation: localDraftStep.operation || '',
      jobElements: localDraftStep.jobElements || '',
      keyPoints: localDraftStep.keyPoints || '',
      reasonWhy: localDraftStep.reasonWhy || '',
      equipment: localDraftStep.equipment || '',
      safety: localDraftStep.safety || '',
      stdTime: Number(localDraftStep.stdTime) || 60,
      taktTime: Number(localDraftStep.taktTime) || 0,
      cycleTime: Number(localDraftStep.cycleTime) || 0,
      manualTime: Number(localDraftStep.manualTime) || 0,
      machineTime: Number(localDraftStep.machineTime) || 0,
      loadUnloadTime: Number(localDraftStep.loadUnloadTime) || 0,
      waitingTime: Number(localDraftStep.waitingTime) || 0,
      setupTime: Number(localDraftStep.setupTime) || 0,
      imageUrl: localDraftStep.imageUrl || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80',
      images: [localDraftStep.imageUrl || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80'],
      activeImageIndex: 0,
      annotations: [],
      symbols: localDraftStep.symbols || [],
      dbRowIds: {},
      isDraft: true,
      ...localDraftStep
    } as SWIStep;
  }, [localDraftStep]);

  const finalVisibleSteps = useMemo(() => {
    const list = [...sortedAndFilteredSteps];
    if (isDraftingNewStep) {
      if (!list.some(s => s.id === 'draft-step-id')) {
        list.push(draftRow);
      }
    }
    return list;
  }, [sortedAndFilteredSteps, isDraftingNewStep, draftRow]);

  // Database Connection Actions
  const handleOpenDbConfig = (field: string) => {
    setConfigColField(field);
    const existing = columnDbLinks?.[field];
    if (existing) {
      setDbSelectedTable(existing.dbTable);
      setDbSelectedColumn(existing.dbColumn);
    } else {
      setDbSelectedTable('');
      setDbSelectedColumn('');
    }
  };

  const handleSaveDbConfig = () => {
    if (!configColField) return;
    
    const saveConfigAction = () => {
      const current = { ...columnDbLinks };
      if (dbSelectedTable && dbSelectedColumn) {
        current[configColField] = { dbTable: dbSelectedTable, dbColumn: dbSelectedColumn };
      } else {
        delete current[configColField];
      }
      onColumnDbLinksChange(current);
      setConfigColField(null);
    };

    // Warn user about data overwrite when establishing a DB connection
    if (dbSelectedTable && dbSelectedColumn) {
      setConfirmModal({
        isOpen: true,
        title: isRtl ? '⚠️ هشدار مهم اتصال پایگاه داده' : '⚠️ Database Overwrite Warning',
        message: isRtl
          ? `در صورت اتصال ستون «${configColField}» به پایگاه داده QMS، کلیه اطلاعات محلی وارد شده قبلی در این ستون پاکسازی شده و با داده‌های زنده دیتابیس جایگزین خواهند شد. آیا از برقراری این ارتباط مطمئن هستید؟`
          : `Connecting the column "${configColField}" to the QMS database will wipe out and overwrite any previous local grid inputs for this column with live database records. Are you sure you want to proceed?`,
        onConfirm: () => {
          saveConfigAction();
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      });
    } else {
      saveConfigAction();
    }
  };

  const handleOpenRowSelector = (stepId: string, colField: string) => {
    setBindRowStepId(stepId);
    setBindRowColField(colField);
    setRowSearchTerm('');
  };

  const handleBindRowId = (rowId: string) => {
    if (!bindRowStepId || !bindRowColField) return;
    const updated = steps.map(s => {
      if (s.id === bindRowStepId) {
        const dbRowIds = { ...(s.dbRowIds || {}) };
        dbRowIds[bindRowColField] = rowId;
        return { ...s, dbRowIds };
      }
      return s;
    });
    onStepsChange(updated);
    setBindRowStepId(null);
    setBindRowColField(null);
  };

  const handleUnbindRowId = (stepId: string, colField: string) => {
    const updated = steps.map(s => {
      if (s.id === stepId) {
        const dbRowIds = { ...(s.dbRowIds || {}) };
        delete dbRowIds[colField];
        return { ...s, dbRowIds };
      }
      return s;
    });
    onStepsChange(updated);
  };

  // Symbol Management
  const handleToggleStepSymbolSelector = (stepId: string) => {
    setSymbolStepId(symbolStepId === stepId ? null : stepId);
  };

  const handleToggleStepSymbol = (stepId: string, symbol: string) => {
    if (stepId === 'draft-step-id') {
      const currentSymbols = localDraftStep.symbols || [];
      const nextSymbols = currentSymbols.includes(symbol)
        ? currentSymbols.filter(sym => sym !== symbol)
        : [...currentSymbols, symbol];
      setLocalDraftStep?.(prev => ({ ...prev, symbols: nextSymbols }));
      return;
    }
    const updated = steps.map(s => {
      if (s.id === stepId) {
        const currentSymbols = s.symbols || [];
        const nextSymbols = currentSymbols.includes(symbol)
          ? currentSymbols.filter(sym => sym !== symbol)
          : [...currentSymbols, symbol];
        return { ...s, symbols: nextSymbols };
      }
      return s;
    });
    onStepsChange(updated);
  };

  // List of tables for DB Binding
  const qmsTables = useMemo(() => {
    const core = [
      { id: 'document_control_table', label: isRtl ? '📝 کنترل مستندات و شناسنامه اسناد' : '📝 Document Control Registry', clause: '7.5' },
      { id: 'indicators_table', label: isRtl ? '📊 شاخص‌های کلیدی عملکرد فرآیند (KPI)' : '📊 Monitoring Indicators (KPI)', clause: '9.1' },
      { id: 'nc_items_table', label: isRtl ? '🛠️ عدم انطباق‌ها و اقدامات اصلاحی (CAPA)' : '🛠️ CAPA Corrective Actions', clause: '10.2' },
      { id: 'strategic_items_table', label: isRtl ? '🎯 کارت‌های برنامه‌ریزی استراتژیک' : '🎯 Strategic Cards Register', clause: '6.1' },
      { id: 'workstations_db', label: isRtl ? '⚙️ بانک اطلاعات ایستگاه‌های کاری صنعتی' : '⚙️ Master Workstations DB', clause: '8.5.1' }
    ];
    try {
      const docs = QmsDatabase.selectAll('documents_table') || {};
      Object.keys(docs).forEach(title => {
        if (!title.toLowerCase().startsWith('document')) {
          core.push({
            id: `doc_${title}`,
            label: isRtl ? `📋 فرم اطلاعات: ${title}` : `📋 Form Document: ${title}`,
            clause: '7.5.3'
          });
        }
      });
    } catch (e) {}
    return core;
  }, [isRtl]);

  // Filtered tables for AI dropdown selection with ISO/IATF clause support
  const filteredAiTables = useMemo(() => {
    if (!aiTableSearch.trim()) return qmsTables;
    const term = aiTableSearch.toLowerCase();
    return qmsTables.filter(t => 
      t.label.toLowerCase().includes(term) || 
      (t.clause && t.clause.toLowerCase().includes(term))
    );
  }, [qmsTables, aiTableSearch]);

  const activeTableColumns = useMemo(() => {
    return getDatabaseTableColumns(dbSelectedTable, isRtl);
  }, [dbSelectedTable, isRtl]);

  // List of rows in bound table for binding selection
  const boundTableRows = useMemo(() => {
    if (!bindRowColField) return [];
    const link = columnDbLinks?.[bindRowColField];
    if (!link) return [];
    try {
      const allRows = QmsDatabase.selectAll(link.dbTable as any) || {};
      return Object.values(allRows).filter((r: any) => {
        if (!rowSearchTerm) return true;
        const stringified = JSON.stringify(r).toLowerCase();
        return stringified.includes(rowSearchTerm.toLowerCase());
      });
    } catch (e) {
      return [];
    }
  }, [bindRowColField, columnDbLinks, rowSearchTerm]);

  return (
    <div className="flex flex-col gap-4" dir={isRtl ? 'rtl' : 'ltr'}>
      {isAnyColumnDbLinked && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-xl p-3 text-xs font-bold leading-relaxed flex items-center gap-3 shadow">
          <Database size={16} className="shrink-0 text-amber-500 animate-pulse" />
          <div className="flex-1">
            <p className="font-black text-amber-400 mb-0.5">
              {isRtl ? 'حالت پیوند داده فعال (قفل جدول)' : 'Active Data-Link Mode (Grid Locked)'}
            </p>
            <p className="text-zinc-400 text-[10px] font-medium leading-normal">
              {isRtl 
                ? 'به دلیل اتصال ستون‌ها به دیتابیس کیفیت مرجع، جهت حفظ یکپارچگی داده‌ها افزودن یا حذف ردیف‌ها غیرفعال است. ویرایش فقط برای فیلدهای غیرمتصل امکان‌پذیر است.'
                : 'Because columns are linked to the QMS database, adding/deleting rows is locked to preserve integrity. Manual editing is restricted to unlinked fields.'}
            </p>
          </div>
        </div>
      )}

      {/* Top action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D0D11] border border-[#212126] rounded-2xl p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isAnyColumnDbLinked}
            onClick={handleAddStep}
            className={`flex items-center gap-1.5 font-extrabold text-xs px-4 py-2.5 rounded-xl cursor-pointer select-none shadow-md transition-all active:scale-95 ${
              isAnyColumnDbLinked
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/30'
                : 'bg-amber-500 hover:bg-amber-400 text-black'
            }`}
            title={isAnyColumnDbLinked ? (isRtl ? 'در زمان اتصال ستون‌ها به دیتابیس، امکان افزودن سطر دستی غیرفعال است.' : 'Adding rows is disabled while columns are connected to the database.') : ''}
          >
            <Plus size={14} strokeWidth={3} />
            <span>{isRtl ? 'افزودن گام جدید' : 'Add New Step'}</span>
          </button>



          {/* Hidden Excel File Loader */}
          <input
            type="file"
            id="excel-import-input"
            accept=".xlsx, .xls"
            onChange={handleImportExcel}
            className="hidden"
            disabled={isAnyColumnDbLinked}
          />

          <button
            type="button"
            disabled={isAnyColumnDbLinked}
            onClick={() => document.getElementById('excel-import-input')?.click()}
            className={`flex items-center gap-1.5 font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer select-none transition-all border ${
              isAnyColumnDbLinked
                ? 'bg-zinc-850 border-zinc-700/20 text-zinc-500 cursor-not-allowed'
                : 'bg-[#121216] hover:bg-[#1E1E24] border-amber-500/30 text-amber-400'
            }`}
            title={isAnyColumnDbLinked ? (isRtl ? 'در زمان اتصال ستون‌ها به دیتابیس، ایمپورت اکسل غیرفعال است.' : 'Excel import is disabled while columns are connected to the database.') : ''}
          >
            <FileSpreadsheet size={13} />
            <span>{isRtl ? 'ایمپورت از اکسل' : 'Excel Import'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 bg-[#121216] hover:bg-[#1E1E24] border border-emerald-500/30 text-emerald-400 font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer select-none transition-all"
            title={isRtl ? 'خروجی اکسل' : 'Export Excel'}
          >
            <FileSpreadsheet size={13} />
            <span>{isRtl ? 'خروجی اکسل' : 'Excel Export'}</span>
          </button>
        </div>

        {/* AI Generator Button */}
        <button
          type="button"
          onClick={() => setIsAiDbModalOpen(true)}
          disabled={isAiLoading || isAnyColumnDbLinked}
          className={`flex items-center gap-2 border rounded-xl px-4 py-2.5 transition-all shadow-md ${
            isAnyColumnDbLinked 
              ? 'bg-zinc-900/40 border-zinc-800/30 opacity-50 cursor-not-allowed' 
              : 'bg-[#14141A] border-amber-500/30 hover:border-amber-500 text-amber-500 hover:bg-amber-500/5'
          }`}
        >
          {isAiLoading ? <RefreshCw className="animate-spin" size={14} /> : <Sparkles size={14} className="animate-pulse" />}
          <span className="text-xs font-black uppercase tracking-wider">
            {isAiLoading ? (isRtl ? 'در حال پردازش...' : 'Processing...') : (isRtl ? 'هوش مصنوعی طراح SWI' : 'AI SWI Designer')}
          </span>
        </button>
      </div>

      {/* Filter and Search Section */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0A0A0D] border border-[#1E1E23] rounded-xl p-3.5">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className={`absolute top-2.5 ${isRtl ? 'right-3' : 'left-3'} text-slate-500`} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={isRtl ? "جستجو در ایستگاه‌ها، قطعات و ردیف‌های کار استاندارد شده..." : "Search stations, part numbers, and standardized steps..."}
            className={`w-full bg-[#141418] border border-zinc-800/80 rounded-lg py-1.5 ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'} text-xs text-white outline-none focus:border-amber-500/40`}
          />
        </div>

        {/* Station Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 font-bold">{isRtl ? 'فیلتر ایستگاه:' : 'Filter Station:'}</span>
          <select
            value={selectedStationFilter}
            onChange={(e) => setSelectedStationFilter(e.target.value)}
            className="bg-[#141418] border border-zinc-800/80 rounded-lg py-1 px-3 text-xs text-white outline-none focus:border-amber-500/40"
          >
            {uniqueStations.map(station => (
              <option key={station} value={station}>
                {station === 'ALL' ? (isRtl ? 'همه ایستگاه‌ها' : 'All Stations') : station}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dynamic Columns Data Grid */}
      <div className="bg-[#0A0A0D] border border-[#1E1E23] rounded-2xl overflow-hidden shadow-xl relative">
        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse">
            <thead>
              <tr className="bg-[#121216] border-b border-[#1E1E23] text-slate-400 text-[10.5px] font-extrabold uppercase">
                <th className="py-3 px-3 text-center w-12 border border-[#1E1E24]">#</th>
                
                {dynamicColumns.map((col) => {
                  const isDbLinked = !!columnDbLinks?.[col.field];
                  return (
                    <th key={col.id} className="py-3 px-3 min-w-[140px] select-none border border-[#1E1E24] relative">
                      <div className="flex items-center justify-between gap-1.5">
                        <div 
                          onClick={() => handleSort(col.field as any)}
                          className="flex items-center gap-1 cursor-pointer hover:text-zinc-200"
                        >
                          <span>{col.label}</span>
                          <ArrowUpDown size={11} className="text-slate-500" />
                        </div>
                        
                        <div className="flex items-center gap-1.5">


                          <button
                            type="button"
                            onClick={() => handleOpenDbConfig(col.field)}
                            className={`p-1 rounded hover:bg-zinc-800 transition-colors ${
                              isDbLinked ? 'text-amber-500 bg-amber-500/10 border border-amber-500/20' : 'text-zinc-500 hover:text-zinc-300'
                            }`}
                            title={isRtl ? 'تنظیمات اتصال دیتابیس ستون' : 'Column database settings'}
                          >
                            <Database size={11} />
                          </button>
                        </div>
                      </div>
                    </th>
                  );
                })}
                
                <th className="py-3 px-3 text-center w-36 text-amber-500 border border-[#1E1E24]">{isRtl ? 'نشان‌های کیفیت/ایمنی' : 'Safety/Quality Symbols'}</th>
                <th className="py-3 px-3 text-center w-28 border border-[#1E1E24]">{isRtl ? 'اقدامات' : 'Actions'}</th>
              </tr>
            </thead>
            
            <tbody className="divide-y divide-[#16161B]">
              {sortedAndFilteredSteps.length === 0 && (
                <tr>
                  <td colSpan={dynamicColumns.length + 5} className="py-12 text-center text-zinc-500 border border-[#1E1E24]">
                    <div className="flex flex-col items-center justify-center p-8 bg-[#0E0E12]/50 rounded-2xl max-w-md mx-auto border border-dashed border-zinc-800 my-4">
                      <HelpCircle size={28} className="text-amber-500 animate-pulse mb-3" />
                      <p className="font-black text-xs text-zinc-200 mb-1.5">
                        {isRtl ? 'هیچ گام عملیاتی تعریف نشده است' : 'No operational steps defined'}
                      </p>
                      <p className="text-[10px] text-zinc-500 max-w-xs mb-5 leading-relaxed">
                        {isRtl 
                          ? 'شما می‌توانید گام‌های تولید کارگاه خود را با استفاده از دکمه «افزودن گام عملیاتی جدید» در زیر ایجاد کنید یا فایل اکسل را به جدول ایمپورت کنید.'
                          : 'Create operational production steps with the "Add operational step" button below, or import an existing Excel template.'}
                      </p>
                      <button
                        type="button"
                        onClick={handleAddStep}
                        className="bg-amber-500 hover:bg-amber-400 text-black font-black text-[10.5px] px-4 py-2 rounded-xl transition-all shadow-md cursor-pointer select-none"
                      >
                        {isRtl ? 'افزودن اولین گام عملیاتی' : 'Add First Operational Step'}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {finalVisibleSteps.map((step, index) => {
                const isSelected = selectedStepId === step.id;
                const isDraftRow = step.isDraft;
                return (
                  <tr 
                    key={step.id}
                    onClick={() => {
                      onSelectStep(step.id);
                      if (step.id !== 'draft-step-id') {
                        setIsDraftingNewStep?.(false);
                      }
                    }}
                    className={`text-[11.5px] transition-colors cursor-pointer ${
                      isDraftRow
                        ? 'bg-amber-500/[0.01] border-2 border-dashed border-amber-500/20 text-amber-400/90 hover:bg-amber-500/[0.03]'
                        : isSelected 
                          ? 'bg-amber-500/[0.03] border-l-2 border-amber-500 text-zinc-300' 
                          : 'text-zinc-300 hover:bg-zinc-800/20'
                    }`}
                  >
                    {/* Index */}
                    <td className="py-3 px-3 text-center font-mono font-bold text-zinc-500 border border-[#1E1E24]">
                      {isDraftRow ? (
                        <span className="text-[9px] bg-amber-500/10 text-amber-500 font-extrabold px-1.5 py-0.5 rounded border border-amber-500/30 animate-pulse">
                          {isRtl ? 'پیش‌نویس' : 'DRAFT'}
                        </span>
                      ) : (
                        index + 1
                      )}
                    </td>

                    {/* Dynamic columns cell */}
                    {dynamicColumns.map((col) => {
                      const field = col.field;
                      const dbLink = columnDbLinks?.[field];
                      const isDbLinked = !!(dbLink && dbLink.dbTable && dbLink.dbColumn);
                      const resolvedVal = getResolvedCellValue(step, field);
                      
                      return (
                        <td key={col.id} className="py-2 px-3 border border-[#1E1E24]">
                          {isDbLinked ? (
                            /* DB Connected: Read-only visual display with Row selector dropdown popup */
                            <div className="flex items-center gap-1.5 bg-amber-500/[0.02] border border-amber-500/15 rounded-lg px-2.5 py-1.5 min-h-[34px]" onClick={(e) => e.stopPropagation()}>
                              <Database size={11} className="text-amber-500 shrink-0 animate-pulse" title={isRtl ? 'همگام از دیتابیس (غیرقابل ویرایش دستی)' : 'Synced from DB (Read-only)'} />
                              
                              <div className="flex-1 text-[11px] font-bold text-zinc-200 truncate" title={resolvedVal}>
                                {resolvedVal || <span className="text-zinc-600 italic text-[10px]">{isRtl ? '-- کلیک برای پیوند --' : '-- Bind Row --'}</span>}
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenRowSelector(step.id, field)}
                                  className="p-1 hover:bg-amber-500/20 text-amber-500 hover:text-amber-400 rounded transition-colors"
                                  title={isRtl ? 'پیوند به ردیف دیتابیس' : 'Bind to DB row'}
                                >
                                  <Link size={11} />
                                </button>
                                {step.dbRowIds?.[field] && (
                                  <button
                                    type="button"
                                    onClick={() => handleUnbindRowId(step.id, field)}
                                    className="p-1 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 rounded transition-all"
                                    title={isRtl ? 'قطع اتصال ردیف' : 'Unbind row'}
                                  >
                                    <Unlink size={11} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ) : (
                            /* Normal: Fully Editable inline */
                            <div onClick={(e) => e.stopPropagation()}>
                              {editingCell?.rowId === step.id && editingCell?.colField === field ? (
                                <textarea
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onBlur={() => handleCellSave(step.id, field as any, editingValue)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleCellSave(step.id, field as any, editingValue);
                                    }
                                  }}
                                  autoFocus
                                  rows={2}
                                  className="w-full bg-[#181820] border border-amber-500/60 rounded px-2 py-1 outline-none text-xs text-white custom-scrollbar resize-none"
                                />
                              ) : (
                                <div 
                                  onDoubleClick={() => {
                                    setEditingCell({ rowId: step.id, colField: field as any });
                                    setEditingValue(String(step[field] || ''));
                                  }}
                                  className="hover:bg-zinc-800/50 px-2 py-1.5 rounded-lg min-h-[34px] break-words line-clamp-2"
                                  title={isRtl ? "دوبار کلیک برای ویرایش" : "Double click to edit"}
                                >
                                  {step[field] !== undefined && step[field] !== null ? String(step[field]) : ''}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Symbols Badge column */}
                    <td className="py-2 px-3 text-center relative border border-[#1E1E24]" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        {step.symbols && step.symbols.length > 0 ? (
                          step.symbols.map((sym: string) => (
                            <span 
                              key={sym} 
                              className="text-xs px-1.5 py-0.5 rounded-md bg-zinc-800/80 border border-zinc-700/60 font-black text-amber-400 select-none cursor-pointer hover:bg-zinc-700/80"
                              title={sym === 'Safety' ? (isRtl ? 'مشخصه ایمنی بحرانی' : 'Safety Characteristic') : (isRtl ? 'مشخصه کیفی بحرانی' : 'Critical Quality')}
                              onClick={() => handleToggleStepSymbolSelector(step.id)}
                            >
                              {sym === 'Safety' ? '⚠️' : sym === 'CC' ? '💎' : sym === 'SC' ? '⚙️' : sym === 'Inspection' ? '🔍' : sym === 'PPE' ? '🛡️' : '★'}
                            </span>
                          ))
                        ) : (
                          <span className="text-zinc-600 text-[10px] italic">{isRtl ? 'فاقد نشان' : 'No symbols'}</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleStepSymbolSelector(step.id)}
                          className="p-1 hover:bg-zinc-800 text-slate-500 hover:text-amber-500 rounded ml-1 transition-colors"
                          title={isRtl ? 'افزودن نشان کیفی/ایمنی' : 'Add Quality/Safety symbol'}
                        >
                          <Plus size={11} />
                        </button>
                      </div>

                      {/* Symbols Dropdown Selector */}
                      {symbolStepId === step.id && (
                        <div className={`absolute bottom-10 ${isRtl ? 'left-4' : 'right-4'} bg-[#131317] border border-zinc-800 rounded-xl p-2 shadow-2xl z-20 flex flex-col gap-1 w-44 text-right`}>
                          <div className="text-[9px] text-zinc-500 font-extrabold mb-1 px-1">{isRtl ? 'انتخاب نشان‌های گام تولید:' : 'Select symbols:'}</div>
                          {[
                            { key: 'Safety', label: isRtl ? '⚠️ ایمنی کلاس A' : '⚠️ Safety Class A' },
                            { key: 'CC', label: isRtl ? '💎 مشخصه بحرانی (CC)' : '💎 Critical (CC)' },
                            { key: 'SC', label: isRtl ? '⚙️ مشخصه کلیدی (SC)' : '⚙️ Significant (SC)' },
                            { key: 'Inspection', label: isRtl ? '🔍 بازرسی ویژه' : '🔍 Inspection Point' },
                            { key: 'PPE', label: isRtl ? '🛡️ تجهیزات ایمنی PPE' : '🛡️ PPE Required' }
                          ].map(item => {
                            const isToggled = (step.symbols || []).includes(item.key);
                            return (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => handleToggleStepSymbol(step.id, item.key)}
                                className={`flex items-center justify-between w-full text-right px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                  isToggled ? 'bg-amber-500/10 text-amber-500' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                                }`}
                              >
                                <span>{item.label}</span>
                                {isToggled && <Check size={11} />}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-center border border-[#1E1E24]" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectStep(step.id)}
                          className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-zinc-800/60 rounded-lg transition-all"
                          title={isRtl ? 'مشاهده در بوم طراحی' : 'View in block designer'}
                        >
                          <Eye size={13} />
                        </button>
                        
                        <button
                          type="button"
                          disabled={isAnyColumnDbLinked || isDraftRow}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isDraftRow) return;
                            handleDuplicateStep(step, e);
                          }}
                          className={`p-1.5 rounded-lg transition-all ${
                            isAnyColumnDbLinked || isDraftRow
                              ? 'text-zinc-600 cursor-not-allowed opacity-40' 
                              : 'text-slate-400 hover:text-amber-500 hover:bg-zinc-800/60'
                          }`}
                          title={isRtl ? 'کپی گام' : 'Duplicate step'}
                        >
                          <Copy size={13} />
                        </button>

                        <button
                          type="button"
                          disabled={isAnyColumnDbLinked}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isDraftRow) {
                              setLocalDraftStep?.({});
                              setIsDraftingNewStep?.(false);
                              return;
                            }
                            setConfirmModal({
                              isOpen: true,
                              title: isRtl ? '🗑️ حذف گام' : '🗑️ Delete Step',
                              message: isRtl ? 'آیا از حذف این گام از جدول دستورالعمل اطمینان دارید؟' : 'Are you sure you want to delete this step from the work instructions?',
                              onConfirm: () => {
                                onStepsChange(steps.filter(s => s.id !== step.id));
                                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                              }
                            });
                          }}
                          className={`p-1.5 rounded-lg transition-all ${
                            isAnyColumnDbLinked 
                              ? 'text-zinc-600 cursor-not-allowed opacity-40' 
                              : 'text-slate-400 hover:text-red-500 hover:bg-red-500/10'
                          }`}
                          title={isDraftRow ? (isRtl ? 'پاکسازی پیش‌نویس' : 'Clear Draft') : (isRtl ? 'حذف گام' : 'Delete step')}
                        >
                          <Trash2 size={13} />
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

      {/* Floating DB Config Dialog */}
      {configColField && (
        <div className="fixed inset-0 z-[300] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" dir="rtl">
          <div className="bg-[#0F0F12] border border-[#27272C] rounded-2xl p-5 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2 text-amber-500 font-extrabold text-xs">
                <Database size={15} className="animate-pulse" />
                <span>{isRtl ? 'اتصال ستون بوم به پایگاه داده کیفیت' : 'Connect Column to QMS Database'}</span>
              </div>
              <button 
                type="button"
                onClick={() => setConfigColField(null)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-zinc-400 leading-relaxed">
              {isRtl 
                ? `ستون انتخابی شما به صورت هوشمند با فیلدهای دیتابیس یکپارچه QMS پروژه همگام خواهد شد و مقادیر مستقیم بدون دخالت دست اعمال می‌شوند.`
                : `Connect this column dynamically with the project QMS database. Text edits will be fetched directly from database tables.`}
            </div>

            {/* Table select dropdown */}
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-zinc-500 font-extrabold uppercase">{isRtl ? 'جدول هدف دیتابیس:' : 'Target Database Table:'}</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsTableSelectOpen(!isTableSelectOpen)}
                  className="w-full bg-[#18181D] border border-zinc-800 rounded-lg p-2.5 text-xs text-white text-right flex items-center justify-between cursor-pointer"
                >
                  <span>
                    {qmsTables.find(t => t.id === dbSelectedTable)?.label || (isRtl ? '-- انتخاب جدول --' : '-- Choose Table --')}
                  </span>
                  <ChevronDown size={14} className="text-zinc-500" />
                </button>

                {isTableSelectOpen && (
                  <div className="absolute top-11 left-0 right-0 bg-[#121215] border border-zinc-800 rounded-xl shadow-2xl z-30 max-h-48 overflow-y-auto p-1.5 flex flex-col gap-0.5">
                    <input
                      type="text"
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      placeholder={isRtl ? "جستجوی جدول..." : "Search tables..."}
                      className="bg-[#18181F] border border-zinc-800 rounded-lg p-1.5 text-xs text-white outline-none mb-1.5"
                    />
                    {qmsTables
                      .filter(t => !tableSearch || t.label.toLowerCase().includes(tableSearch.toLowerCase()))
                      .map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setDbSelectedTable(t.id);
                            setDbSelectedColumn('');
                            setIsTableSelectOpen(false);
                          }}
                          className={`w-full text-right px-2.5 py-2 rounded-lg text-xs font-bold transition-all ${
                            dbSelectedTable === t.id ? 'bg-amber-500 text-black' : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Column select dropdown */}
            {dbSelectedTable && (
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-zinc-500 font-extrabold uppercase">{isRtl ? 'ستون فیلد هدف دیتابیس:' : 'Target Database Field:'}</label>
                <select
                  value={dbSelectedColumn}
                  onChange={(e) => setDbSelectedColumn(e.target.value)}
                  className="w-full bg-[#18181D] border border-zinc-800 rounded-lg p-2.5 text-xs text-white outline-none"
                >
                  <option value="">{isRtl ? '-- انتخاب ستون --' : '-- Choose Field --'}</option>
                  {activeTableColumns.map(col => (
                    <option key={col.id} value={col.id}>
                      {col.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {dbSelectedTable && dbSelectedColumn && (
              <div className="bg-red-500/10 border border-dashed border-red-500/30 text-red-400 rounded-xl p-3 text-[10px] font-bold leading-relaxed mt-1 flex items-start gap-2">
                <span className="text-xs">⚠️</span>
                <div>
                  <p className="font-extrabold mb-0.5">{isRtl ? 'توجه: بازنویسی اطلاعات محلی جدول' : 'Attention: Local Data Overwrite'}</p>
                  <p className="text-[9.5px] text-zinc-400 font-medium leading-normal">
                    {isRtl 
                      ? 'با تایید نهایی این اتصال، مقادیر محلی فعلی این ستون پاکسازی شده و زنده از فیلدهای دیتابیس مرجع بارگذاری خواهند شد.' 
                      : 'Connecting this column will discard and overwrite existing custom local entries in favor of the QMS database records.'}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 border-t border-white/5 pt-3.5 mt-1">
              <button
                type="button"
                onClick={handleSaveDbConfig}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs py-2 rounded-xl transition-all"
              >
                {isRtl ? 'ثبت و برقراری ارتباط' : 'Save Connection'}
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setDbSelectedTable('');
                  setDbSelectedColumn('');
                  const current = { ...columnDbLinks };
                  delete current[configColField];
                  onColumnDbLinksChange(current);
                  setConfigColField(null);
                }}
                className="bg-red-950/30 border border-red-900/40 text-red-400 text-xs font-bold py-2 px-3.5 rounded-xl hover:bg-red-950/55 transition-all"
              >
                {isRtl ? 'حذف اتصال' : 'Disconnect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating DB Row Selector Dialog */}
      {bindRowStepId && bindRowColField && (
        <div className="fixed inset-0 z-[300] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 text-right" dir="rtl">
          <div className="bg-[#0F0F12] border border-[#27272C] rounded-2xl p-5 max-w-lg w-full shadow-2xl flex flex-col gap-4 max-h-[80vh]">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex items-center gap-2 text-amber-500 font-extrabold text-xs">
                <Database size={15} className="animate-bounce" />
                <span>{isRtl ? 'انتخاب ردیف پایگاه داده کیفیت جهت انتساب' : 'Bind Row from Database'}</span>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setBindRowStepId(null);
                  setBindRowColField(null);
                }}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              value={rowSearchTerm}
              onChange={(e) => setRowSearchTerm(e.target.value)}
              placeholder={isRtl ? "جستجوی مقادیر در ردیف‌های پایگاه داده..." : "Search values in database..."}
              className="bg-[#18181F] border border-zinc-800 rounded-lg p-2 text-xs text-white outline-none w-full"
            />

            <div className="flex-1 overflow-y-auto max-h-[50vh] flex flex-col gap-1.5 pr-0.5 custom-scrollbar">
              {boundTableRows.map((row: any) => {
                const uniqueId = row.id || row.row_id || row.rowId || row.indicator_id || Object.values(row)[0];
                const displayLabel = row.indicator_name || row.nc_title || row.card_title || row.station || row.operation || JSON.stringify(row).slice(0, 80);
                
                return (
                  <button
                    key={uniqueId}
                    type="button"
                    onClick={() => handleBindRowId(uniqueId)}
                    className="w-full text-right bg-[#141418] border border-zinc-800/80 hover:border-amber-500/45 p-3 rounded-xl flex flex-col gap-1 transition-all cursor-pointer group"
                  >
                    <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                      {displayLabel}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500">
                      ID: {uniqueId}
                    </div>
                  </button>
                );
              })}

              {boundTableRows.length === 0 && (
                <div className="py-8 text-center text-zinc-600 text-xs italic">
                  {isRtl ? 'هیچ ردیفی در جدول هدف یافت نشد.' : 'No rows found in target table.'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI DB Multi-Source Config Dialog */}
      {isAiDbModalOpen && (
        <div className="fixed inset-0 z-[400] bg-black/85 backdrop-blur-md flex items-center justify-center p-4" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0D0D11] border border-[#212126] rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2 text-amber-500 font-extrabold text-xs">
                <Sparkles size={16} className="animate-pulse" />
                <span>{isRtl ? 'پورتال طراحی هوشمند SWI (مبتنی بر JES & SOS)' : 'Expert AI SWI Design Portal (JES & SOS)'}</span>
              </div>
              <button 
                type="button"
                onClick={() => setIsAiDbModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors p-1"
              >
                <X size={16} />
              </button>
            </div>

            <div className="text-[10px] text-zinc-400 leading-relaxed bg-amber-500/5 p-3 rounded-xl border border-amber-500/20">
              {isRtl 
                ? 'هوش مصنوعی به عنوان متخصص IATF، داده‌های شما را تحلیل کرده و دستورالعمل‌های کاری استاندارد را مطابق با الزامات مهندسی تولید می‌کند.'
                : 'Acting as an IATF expert, the AI analyzes your data to generate standardized work instructions meeting all engineering requirements.'}
            </div>

            {/* Selected Sources List */}
            <div className="flex flex-col gap-2">
              <label className="text-[9px] text-zinc-500 font-black uppercase tracking-wider">{isRtl ? 'منابع داده انتخاب شده:' : 'SELECTED DATA SOURCES:'}</label>
              <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-zinc-900/50 rounded-xl border border-white/5">
                {aiDataSources.length === 0 ? (
                  <span className="text-[9px] text-zinc-600 italic m-auto">{isRtl ? 'هیچ منبعی انتخاب نشده است' : 'No sources selected yet'}</span>
                ) : (
                  aiDataSources.map(src => {
                    const tableObj = qmsTables.find(t => t.id === src.tableId);
                    const tableLabel = tableObj?.label || src.tableId;
                    const tableClause = tableObj?.clause ? ` (${isRtl ? 'بند' : 'Clause'} ${tableObj.clause})` : '';
                    const colsText = src.columns.length > 0 
                      ? `${isRtl ? 'ستون‌ها' : 'Cols'}: ${src.columns.join(', ')}`
                      : `(${isRtl ? 'تمامی ستون‌ها / کل جدول' : 'All Columns / Entire Table'})`;
                    return (
                      <div key={src.id} className="flex flex-col gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 px-2.5 py-1.5 rounded-lg text-[9px] font-bold w-full min-w-0">
                        <div className="flex items-center justify-between gap-1.5 w-full">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Database size={10} className="shrink-0 text-amber-500/70" />
                            <span className="truncate max-w-[280px] text-zinc-100">{tableLabel}{tableClause}</span>
                          </div>
                          <button 
                            type="button"
                            onClick={() => setAiDataSources(prev => prev.filter(s => s.id !== src.id))} 
                            className="hover:text-red-500 ml-1 shrink-0 p-0.5"
                          >
                            <X size={11} />
                          </button>
                        </div>
                        <div className="text-[8px] text-zinc-400 font-mono font-medium truncate pl-4">
                          {colsText}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Add Table Section */}
              <div className="flex flex-col gap-2 p-3 bg-zinc-900/30 rounded-xl border border-white/5">
                <label className="text-[9px] text-zinc-500 font-bold uppercase">{isRtl ? 'افزودن مرجع جدید:' : 'ADD NEW REFERENCE:'}</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsAiTableSelectOpen(!isAiTableSelectOpen)}
                    className="w-full bg-[#141418] border border-zinc-800 rounded-lg p-2 text-[10px] text-white flex items-center justify-between hover:border-amber-500/30 transition-all"
                  >
                    <span className="truncate max-w-[120px]">
                      {aiDbSelectedTable 
                        ? (() => {
                            const found = qmsTables.find(t => t.id === aiDbSelectedTable);
                            return found ? `${found.label} (${isRtl ? 'بند' : 'Clause'} ${found.clause})` : aiDbSelectedTable;
                          })()
                        : (isRtl ? '-- انتخاب جدول --' : '-- Select Table --')}
                    </span>
                    <ChevronDown size={12} className="text-zinc-500" />
                  </button>
                  {isAiTableSelectOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-[#121215] border border-zinc-800 rounded-lg shadow-2xl z-[410] max-h-52 overflow-hidden p-1 flex flex-col gap-1">
                      <div className="p-1 border-b border-zinc-800/60" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={aiTableSearch}
                          onChange={(e) => setAiTableSearch(e.target.value)}
                          placeholder={isRtl ? "جستجوی جدول یا شماره بند..." : "Search table or clause..."}
                          className="w-full bg-[#16161a] border border-zinc-800 rounded px-2 py-1 text-[10px] text-white outline-none focus:border-amber-500/40"
                        />
                      </div>
                      <div className="overflow-y-auto max-h-36 flex flex-col gap-0.5 custom-scrollbar">
                        {filteredAiTables.map(t => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => { 
                              setAiDbSelectedTable(t.id); 
                              setAiDbSelectedColumns([]); 
                              setIsAiTableSelectOpen(false); 
                              setAiTableSearch('');
                            }}
                            className={`w-full text-right px-2 py-1.5 rounded-md text-[10px] transition-all flex items-center justify-between gap-2 ${
                              aiDbSelectedTable === t.id 
                                ? 'bg-amber-500 text-black font-bold' 
                                : 'text-zinc-300 hover:bg-zinc-800/60'
                            }`}
                          >
                            <span className="truncate">{t.label}</span>
                            <span className={`text-[8px] font-mono px-1 py-0.5 rounded shrink-0 ${
                              aiDbSelectedTable === t.id ? 'bg-black/20 text-black font-extrabold' : 'bg-zinc-800 text-amber-500/90'
                            }`}>
                              {isRtl ? `بند ${t.clause}` : `Cl. ${t.clause}`}
                            </span>
                          </button>
                        ))}
                        {filteredAiTables.length === 0 && (
                          <div className="text-center py-2 text-zinc-600 text-[9px] italic">
                            {isRtl ? 'موردی یافت نشد' : 'No tables found'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                
                {aiDbSelectedTable && (
                  <div className="flex flex-col gap-1.5 mt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] text-zinc-400 font-bold uppercase">
                        {isRtl ? 'انتخاب ستون‌های مرجع (اختیاری):' : 'SELECT COLUMNS (OPTIONAL):'}
                      </label>
                      <span className="text-[8px] text-amber-500 font-medium">
                        {aiDbSelectedColumns.length > 0 
                          ? (isRtl ? `${aiDbSelectedColumns.length} ستون انتخاب شده` : `${aiDbSelectedColumns.length} selected`)
                          : (isRtl ? 'انتخاب تمامی ستون‌ها' : 'Sends entire table')}
                      </span>
                    </div>
                    <div className="bg-[#141418] border border-zinc-800 rounded-lg p-2 max-h-24 overflow-y-auto custom-scrollbar flex flex-wrap gap-1.5">
                      {(() => {
                        let cols: string[] = [];
                        try {
                          if (aiDbSelectedTable.startsWith('doc_')) {
                            const docTitle = aiDbSelectedTable.substring(4);
                            const template = documentTemplates[docTitle];
                            const foundKeys = new Set<string>();
                            
                            if (template) {
                              if (template.headers) {
                                template.headers.forEach((_, idx) => {
                                  foundKeys.add(`field${idx + 1}`);
                                });
                              }
                              if (template.smartType === 'SWOT') {
                                ['type', 'weight', 'rating'].forEach(k => foundKeys.add(k));
                              } else if (template.smartType === 'RISK' || template.smartType === 'PFMEA') {
                                ['severity', 'occurrence', 'detection', 'rpn'].forEach(k => foundKeys.add(k));
                              } else if (template.smartType === 'CALIBRATION') {
                                ['refValue', 'readValue', 'mpe'].forEach(k => foundKeys.add(k));
                              } else if (template.smartType === 'KPI') {
                                ['target', 'actual', 'unit', 'clauseId'].forEach(k => foundKeys.add(k));
                              } else if (template.smartType === 'SPC') {
                                ['usl', 'lsl', 'measurements'].forEach(k => foundKeys.add(k));
                              } else if (template.smartType === 'COQ') {
                                ['coqCategory', 'coqAmount'].forEach(k => foundKeys.add(k));
                              } else if (template.smartType === 'MSA') {
                                ['evValue', 'avValue', 'ndiv'].forEach(k => foundKeys.add(k));
                              }
                            }
                            
                            // Scan actual database items if any
                            const allDocs = QmsDatabase.selectAll('documents_table') || {};
                            const docItems = allDocs[docTitle];
                            if (Array.isArray(docItems)) {
                              docItems.forEach((row: any) => {
                                if (row && typeof row === 'object') {
                                  Object.keys(row).forEach(k => {
                                    if (k !== 'id' && k !== 'items') {
                                      foundKeys.add(k);
                                    }
                                  });
                                }
                              });
                            }
                            
                            cols = Array.from(foundKeys);
                          } else {
                            const foundKeys = new Set<string>();
                            
                            if (aiDbSelectedTable === 'indicators_table') {
                              ['indicator_id', 'indicator_name', 'target_val', 'freq_val', 'owner_role'].forEach(k => foundKeys.add(k));
                            } else if (aiDbSelectedTable === 'document_control_table') {
                              ['id', 'code', 'title', 'version', 'releaseDate', 'docType', 'author', 'approver', 'status'].forEach(k => foundKeys.add(k));
                            } else if (aiDbSelectedTable === 'nc_items_table') {
                              ['id', 'nc_title', 'root_cause', 'capa_action', 'owner', 'status', 'date'].forEach(k => foundKeys.add(k));
                            } else if (aiDbSelectedTable === 'strategic_items_table') {
                              ['id', 'card_title', 'objective', 'kpi', 'target', 'clauseId', 'linkedDoc'].forEach(k => foundKeys.add(k));
                            } else if (aiDbSelectedTable === 'workstations_db') {
                              ['id', 'workstation_name', 'operator_name', 'status', 'last_check', 'station_id', 'operation_name'].forEach(k => foundKeys.add(k));
                            }
                            
                            const tableData = QmsDatabase.selectAll(aiDbSelectedTable as any);
                            Object.values(tableData || {}).forEach((row: any) => {
                              if (row && typeof row === 'object') {
                                Object.keys(row).forEach(k => {
                                  if (k !== 'id' && k !== 'items') {
                                    foundKeys.add(k);
                                  }
                                });
                              }
                            });
                            
                            cols = Array.from(foundKeys);
                          }
                        } catch (e) {
                          console.error("Error retrieving AI columns", e);
                        }

                        if (cols.length === 0) {
                          return (
                            <div className="text-[9px] text-zinc-600 italic m-auto py-1">
                              {isRtl ? 'هیچ ستونی برای این جدول یافت نشد' : 'No columns found for this table'}
                            </div>
                          );
                        }

                        return cols.map(col => {
                          const isSel = aiDbSelectedColumns.includes(col);
                          let displayLabel = col;
                          
                          if (aiDbSelectedTable.startsWith('doc_')) {
                            const docTitle = aiDbSelectedTable.substring(4);
                            const template = documentTemplates[docTitle];
                            if (template && col.startsWith('field')) {
                              const match = col.match(/^field(\d+)$/);
                              if (match) {
                                const idx = parseInt(match[1], 10) - 1;
                                if (template.headers && template.headers[idx]) {
                                  displayLabel = `${col} (${template.headers[idx]})`;
                                }
                              }
                            }
                          }
                          
                          return (
                            <button
                              key={col}
                              type="button"
                              onClick={() => {
                                if (isSel) setAiDbSelectedColumns(prev => prev.filter(c => c !== col));
                                else setAiDbSelectedColumns(prev => [...prev, col]);
                              }}
                              className={`px-2 py-1 rounded border text-[8px] font-bold transition-all flex items-center gap-1 ${
                                isSel 
                                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-500' 
                                  : 'bg-[#1a1a20]/60 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                              }`}
                            >
                              <span>{displayLabel}</span>
                            </button>
                          );
                        });
                      })()}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAiDataSources(prev => [...prev, { id: Date.now().toString(), tableId: aiDbSelectedTable, columns: aiDbSelectedColumns }]);
                        setAiDbSelectedTable('');
                        setAiDbSelectedColumns([]);
                      }}
                      className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-[9px] py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 mt-1"
                    >
                      <Plus size={10} />
                      {isRtl ? 'افزودن به لیست مراجع' : 'Add to References'}
                    </button>
                  </div>
                )}
              </div>

              {/* Custom Prompt / Context Section */}
              <div className="flex flex-col gap-2 p-3 bg-zinc-900/30 rounded-xl border border-white/5">
                <label className="text-[9px] text-zinc-500 font-bold uppercase">{isRtl ? 'توضیحات تکمیلی (اختیاری):' : 'ADDITIONAL CONTEXT (OPTIONAL):'}</label>
                <textarea
                  value={aiCustomContext}
                  onChange={(e) => setAiCustomContext(e.target.value)}
                  placeholder={isRtl ? "مثلا: تمرکز بر نکات ایمنی در ایستگاه جوشکاری..." : "e.g. Focus on safety in the welding station..."}
                  className="w-full bg-[#141418] border border-zinc-800 rounded-lg p-2 text-[10px] text-white outline-none focus:border-amber-500/40 resize-none h-[110px]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-white/5 pt-5 mt-2">
              <button
                type="button"
                onClick={() => setIsAiDbModalOpen(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs py-2.5 rounded-xl transition-all"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
              
              <button
                type="button"
                disabled={isAiLoading || aiDataSources.length === 0}
                onClick={handleAiGenerate}
                className={`flex-1 font-extrabold text-xs py-2.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 ${
                  aiDataSources.length > 0 && !isAiLoading
                    ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-500/10' 
                    : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                }`}
              >
                {isAiLoading ? (
                  <RefreshCw className="animate-spin" size={14} />
                ) : (
                  <Sparkles size={14} />
                )}
                {isAiLoading ? (isRtl ? 'در حال ایجاد...' : 'Generating...') : (isRtl ? 'شروع تولید محتوای هوشمند' : 'Start Intelligent Generation')}
              </button>
            </div>
          </div>
        </div>
      )}
    {/* Custom Confirmation Dialog Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0F0F12] border border-[#27272C] rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150 font-sans">
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
                {isRtl ? 'تأیید' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
