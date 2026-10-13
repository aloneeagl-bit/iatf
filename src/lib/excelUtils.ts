import * as XLSX from 'xlsx';
import { QmsDatabase } from './qmsDatabase';
import { iatfData, IATFClause } from '../data/iatfData';
import { documentTemplates } from '../data/documentTemplates';

/**
 * Programmatically fits the spreadsheet column widths to the maximum text length of cell contents.
 * Safe for Persian/RTL characters and multiline cell texts.
 */
export function autofitColumns(worksheet: XLSX.WorkSheet) {
  if (!worksheet || !worksheet['!ref']) return;
  try {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    const cols: { wch: number }[] = [];
    
    for (let C = range.s.c; C <= range.e.c; ++C) {
      let maxLen = 8; // default min width
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const cell_address = { c: C, r: R };
        const cell_ref = XLSX.utils.encode_cell(cell_address);
        const cell = worksheet[cell_ref];
        if (cell && cell.v !== undefined && cell.v !== null) {
          const valStr = String(cell.v);
          let visualLen = 0;
          for (let i = 0; i < valStr.length; i++) {
            const code = valStr.charCodeAt(i);
            // Persian/Arabic letters are wider than ASCII letters in typical fonts/Excel
            visualLen += code > 128 ? 1.4 : 1;
          }
          if (visualLen > maxLen) {
            maxLen = visualLen;
          }
        }
      }
      // Cap at 50, specify minimum of 10
      cols.push({ wch: Math.min(Math.max(Math.ceil(maxLen) + 4, 10), 50) });
    }
    worksheet['!cols'] = cols;
  } catch (err) {
    console.warn("Autofit columns failed:", err);
  }
}

/**
 * Programmatically pre-seeds missing 'id' and 'index' columns to prevent DB validation conflicts.
 */
export function preprocessExcelRowsBeforeImport(tableName: string, rawRows: any[]): void {
  if (!Array.isArray(rawRows)) return;
  
  const seenIds = new Set<string>();
  
  rawRows.forEach((row, idx) => {
    if (!row || typeof row !== 'object') return;
    
    // Resolve or compute key / ID
    let currentId = resolveRowValue(row, 'id');
    
    if (tableName === 'documents_table' || tableName.startsWith('doc_')) {
      // Find row_id / Row_ID in candidates
      const actualId = resolveRowValue(row, 'Row_ID') || resolveRowValue(row, 'row_id') || currentId || resolveRowValue(row, 'Row ID') || resolveRowValue(row, 'شناسه');
      let originalId = String(actualId || '').trim();
      if (!originalId || seenIds.has(originalId)) {
        const suffix = originalId ? `-dup-${idx + 1}` : `item-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000000)}`;
        const generated = originalId ? `${originalId}${suffix}` : suffix;
        row['id'] = generated;
        row['Row_ID'] = generated;
        row['row_id'] = generated;
      } else {
        row['id'] = originalId;
        row['Row_ID'] = originalId;
        row['row_id'] = originalId;
      }
      seenIds.add(row['id']);
      
      row['index'] = idx + 1;
      row['Row_Index'] = idx + 1;
      row['row_index'] = idx + 1;
    }
    
    else if (tableName === 'document_control_table') {
      const docName = resolveRowValue(row, 'document_name', 'document_control_table') || resolveRowValue(row, 'Document_Name') || resolveRowValue(row, 'Document Name') || `doc-${idx + 1}`;
      let cleanDocName = String(docName).trim();
      if (seenIds.has(cleanDocName)) {
        cleanDocName = `${cleanDocName}-dup-${idx + 1}`;
      }
      row['document_name'] = cleanDocName;
      row['id'] = cleanDocName;
      row['index'] = idx + 1;
      seenIds.add(cleanDocName);
    }
    
    else if (tableName === 'indicators_table') {
      const indId = resolveRowValue(row, 'indicator_id', 'indicators_table') || resolveRowValue(row, 'id') || resolveRowValue(row, 'indicatorId') || `ind-${idx + 1}-${Math.floor(Math.random() * 10000)}`;
      let cleanIndId = String(indId).trim();
      if (seenIds.has(cleanIndId)) {
        cleanIndId = `${cleanIndId}-dup-${idx + 1}`;
      }
      row['indicator_id'] = cleanIndId;
      row['id'] = cleanIndId;
      row['index'] = idx + 1;
      seenIds.add(cleanIndId);
    }
    
    else if (tableName === 'clause_links_table') {
      const clauseId = resolveRowValue(row, 'clause_id', 'clause_links_table') || resolveRowValue(row, 'clauseId') || resolveRowValue(row, 'id') || `clause-link-${idx + 1}`;
      let cleanClauseId = String(clauseId).trim();
      if (seenIds.has(cleanClauseId)) {
        cleanClauseId = `${cleanClauseId}-dup-${idx + 1}`;
      }
      row['clause_id'] = cleanClauseId;
      row['id'] = cleanClauseId;
      row['index'] = idx + 1;
      seenIds.add(cleanClauseId);
    }
    
    else if (tableName === 'records_table') {
      const recId = resolveRowValue(row, 'record_id', 'records_table') || resolveRowValue(row, 'recordId') || resolveRowValue(row, 'id') || `rec-${Date.now()}-${idx}`;
      let cleanRecId = String(recId).trim();
      if (seenIds.has(cleanRecId)) {
        cleanRecId = `${cleanRecId}-dup-${idx + 1}`;
      }
      row['record_id'] = cleanRecId;
      row['id'] = cleanRecId;
      row['index'] = idx + 1;
      seenIds.add(cleanRecId);
    }
    
    else if (tableName === 'csr_mappings_table') {
      const csrId = resolveRowValue(row, 'id') || resolveRowValue(row, 'csr_id') || `csr-${Date.now()}-${idx}`;
      let cleanCsrId = String(csrId).trim();
      if (seenIds.has(cleanCsrId)) {
        cleanCsrId = `${cleanCsrId}-dup-${idx + 1}`;
      }
      row['id'] = cleanCsrId;
      row['index'] = idx + 1;
      seenIds.add(cleanCsrId);
    }
    
    else if (tableName === 'process_mappings_table') {
      const procKey = resolveRowValue(row, 'process_key') || resolveRowValue(row, 'processKey') || resolveRowValue(row, 'id') || `proc-${idx + 1}`;
      let cleanProcKey = String(procKey).trim();
      if (seenIds.has(cleanProcKey)) {
        cleanProcKey = `${cleanProcKey}-dup-${idx + 1}`;
      }
      row['process_key'] = cleanProcKey;
      row['id'] = cleanProcKey;
      row['index'] = idx + 1;
      seenIds.add(cleanProcKey);
    }
    
    else if (tableName === 'kpi_vars_table') {
      const varKey = resolveRowValue(row, 'var_key') || resolveRowValue(row, 'varKey') || resolveRowValue(row, 'id') || `var-${idx + 1}`;
      let cleanVarKey = String(varKey).trim();
      if (seenIds.has(cleanVarKey)) {
        cleanVarKey = `${cleanVarKey}-dup-${idx + 1}`;
      }
      row['var_key'] = cleanVarKey;
      row['id'] = cleanVarKey;
      row['index'] = idx + 1;
      seenIds.add(cleanVarKey);
    }
    
    else {
      let cleanId = String(currentId || '').trim();
      if (!cleanId || seenIds.has(cleanId)) {
        const generated = cleanId ? `${cleanId}-dup-${idx + 1}` : `item-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`;
        row['id'] = generated;
      } else {
        row['id'] = cleanId;
      }
      row['index'] = idx + 1;
      seenIds.add(row['id']);
    }
  });
}

/**
 * Traverses standard IATF clauses to collect all valid clause IDs.
 */
export function getAllStandardClauseIds(): Set<string> {
  const ids = new Set<string>();
  const traverse = (clauses: IATFClause[]) => {
    clauses.forEach(c => {
      ids.add(c.id);
      if (c.subClauses && c.subClauses.length > 0) {
        traverse(c.subClauses);
      }
    });
  };
  traverse(iatfData);
  return ids;
}

/**
 * Collects all custom document names present in the database or drafting localStorage.
 */
export function getAvailableDocumentNames(): Set<string> {
  const names = new Set<string>();
  
  // 1. Read from committed database
  try {
    const committed = QmsDatabase.selectAll('documents_table') || {};
    Object.keys(committed).forEach(k => names.add(k));
  } catch {}

  // 2. Read from legacy/draft keys in localStorage
  try {
    const legacyRaw = localStorage.getItem('iatf_docs');
    if (legacyRaw) {
      const parsed = JSON.parse(legacyRaw);
      Object.keys(parsed || {}).forEach(k => names.add(k));
    }
  } catch {}

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('iatf_draft_items_')) {
        const docName = key.substring('iatf_draft_items_'.length);
        if (docName) {
          names.add(docName);
        }
      }
    }
  } catch {}

  return names;
}

/**
 * Utility helper to filter out 'id' and 'index' columns from Excel export rows.
 */
export function cleanExportRows(rows: any[]): any[] {
  if (!Array.isArray(rows)) return [];
  return rows.map(row => {
    if (!row || typeof row !== 'object') return row;
    const cleanRow = { ...row };
    const keysToOmit = [
      'id', 'index', 'ID', 'Index', 
      'Row ID', 'Row Index', 'Row_ID', 'Row_Index',
      'ردیف یا شناسه سطر / Row ID', 'شماره ردیف / Row Index',
      'ردیف یا شناسه سطر', 'شماره ردیف'
    ];
    keysToOmit.forEach(k => {
      delete cleanRow[k];
    });
    return cleanRow;
  });
}

/**
 * Resolves standard/relational table columns to their visual bilingual Farsi/English labels.
 */
export function getTableColumns(tableName: string): { id: string; label: string; field: string }[] {
  const isFa = true;
  if (tableName === 'document_control_table') {
    return [
      { id: 'document_name', label: isFa ? 'نام سند / Document Name' : 'Document Name', field: 'document_name' },
      { id: 'code', label: isFa ? 'کد سند / Document Code' : 'Document Code', field: 'code' },
      { id: 'revision', label: isFa ? 'نسخه ویرایش / Revision' : 'Revision', field: 'revision' },
      { id: 'preparedBy', label: isFa ? 'تهیه کننده / Prepared By' : 'Prepared By', field: 'preparedBy' },
      { id: 'approvedBy', label: isFa ? 'تایید کننده / Approved By' : 'Approved By', field: 'approvedBy' },
      { id: 'lifecycle_status', label: isFa ? 'وضعیت چرخه سند / Lifecycle Status' : 'Lifecycle Status', field: 'lifecycle_status' }
    ];
  }
  if (tableName === 'indicators_table') {
    return [
      { id: 'indicator_id', label: isFa ? 'شناسه شاخص / Indicator ID' : 'Indicator ID', field: 'indicator_id' },
      { id: 'type', label: isFa ? 'نوع شاخص / Type' : 'Type', field: 'type' },
      { id: 'titleFa', label: isFa ? 'عنوان فارسی / Title Fa' : 'Title Fa', field: 'titleFa' },
      { id: 'titleEn', label: isFa ? 'عنوان انگلیسی / Title En' : 'Title En', field: 'titleEn' },
      { id: 'target', label: isFa ? 'حد هدف واقعی / Target' : 'Target', field: 'target' },
      { id: 'unit', label: isFa ? 'واحد اندازه‌گیری / Unit' : 'Unit', field: 'unit' },
      { id: 'records_count', label: isFa ? 'تعداد ثبتی‌ها / Records Count' : 'Records Count', field: 'records_count' },
      { id: 'evaluation_records_json', label: isFa ? 'سوابق ارزیابی (JSON) / Evaluation Records JSON' : 'Evaluation Records JSON', field: 'evaluation_records_json' }
    ];
  }
  if (tableName === 'clause_links_table') {
    return [
      { id: 'clause_id', label: isFa ? 'بند استاندارد / Clause ID' : 'Clause ID', field: 'clause_id' },
      { id: 'linked_documents', label: isFa ? 'اسناد مرتبط / Linked Documents' : 'Linked Documents', field: 'linked_documents' }
    ];
  }
  if (tableName === 'records_table') {
    return [
      { id: 'record_id', label: isFa ? 'شناسه سابقه / Record ID' : 'Record ID', field: 'record_id' },
      { id: 'documentName', label: isFa ? 'نام سند مرجع / Document Name' : 'Document Name', field: 'documentName' },
      { id: 'clauseId', label: isFa ? 'بند مرتبط استاندارد / Clause ID' : 'Clause ID', field: 'clauseId' },
      { id: 'archivedAt', label: isFa ? 'تاریخ بایگانی / Archived At' : 'Archived At', field: 'archivedAt' },
      { id: 'code', label: isFa ? 'کد / Code' : 'Code', field: 'code' },
      { id: 'revision', label: isFa ? 'نسخه / Revision' : 'Revision', field: 'revision' },
      { id: 'preparedBy', label: isFa ? 'تهیه کننده / Prepared By' : 'Prepared By', field: 'preparedBy' },
      { id: 'approvedBy', label: isFa ? 'تایید کننده / Approved By' : 'Approved By', field: 'approvedBy' },
      { id: 'items_json', label: isFa ? 'محتوای اقلام سابقه (JSON) / Items JSON' : 'Items JSON', field: 'items_json' }
    ];
  }
  if (tableName === 'csr_mappings_table') {
    return [
      { id: 'id', label: isFa ? 'شناسه الزامات / ID' : 'ID', field: 'id' },
      { id: 'documentId', label: isFa ? 'شناسه مستند / Document ID' : 'Document ID', field: 'documentId' },
      { id: 'customerNumber', label: isFa ? 'شماره یا کد مشتری / Customer Code' : 'Customer Code', field: 'customerNumber' },
      { id: 'customerTitle', label: isFa ? 'عنوان مشتری / Customer Title' : 'Customer Title', field: 'customerTitle' },
      { id: 'mappedIatfClauseId', label: isFa ? 'بند استاندارد IATF / Mapped IATF Clause' : 'Mapped IATF Clause', field: 'mappedIatfClauseId' },
      { id: 'analysisText', label: isFa ? 'متن تجزیه و تحلیل الزامات / Requirement Analysis' : 'Requirement Analysis', field: 'analysisText' },
      { id: 'status', label: isFa ? 'وضعیت همراستایی / Compliance Status' : 'Compliance Status', field: 'status' },
      { id: 'documentTitle', label: isFa ? 'عنوان سند پیوست / Annex Document Title' : 'Annex Document Title', field: 'documentTitle' }
    ];
  }
  if (tableName === 'process_mappings_table') {
    return [
      { id: 'process_key', label: isFa ? 'کلید فرآیند / Process Key' : 'Process Key', field: 'process_key' },
      { id: 'clause_ids', label: isFa ? 'بندهای مرتبط / Associated Clauses' : 'Associated Clauses', field: 'clause_ids' }
    ];
  }
  if (tableName === 'kpi_vars_table') {
    return [
      { id: 'var_key', label: isFa ? 'کلید متغیر فرمولی / Constant Key' : 'Constant Key', field: 'var_key' },
      { id: 'value', label: isFa ? 'مقدار عددی متغیر / Numeric Value' : 'Numeric Value', field: 'value' },
      { id: 'updatedAt', label: isFa ? 'تاریخ بروزرسانی / Updated At' : 'Updated At', field: 'updatedAt' }
    ];
  }
  return [];
}

/**
 * Robustly matches visual or raw database keys from raw Excel cell values.
 */
export function resolveRowValue(row: any, fieldName: string, tableName?: string): any {
  if (!row) return undefined;
  
  if (tableName) {
    const cols = getTableColumns(tableName);
    const col = cols.find(c => c.field === fieldName || c.id === fieldName);
    if (col && row[col.label] !== undefined) {
      return row[col.label];
    }
  }

  const candidates = [
    fieldName,
    fieldName.toLowerCase(),
    fieldName.toUpperCase(),
    fieldName.charAt(0).toUpperCase() + fieldName.slice(1),
  ];

  const snake = fieldName.replace(/([A-Z])/g, "_$1").toLowerCase();
  const pascal = fieldName.charAt(0).toUpperCase() + fieldName.slice(1);
  candidates.push(snake, snake.toUpperCase(), snake.charAt(0).toUpperCase() + snake.slice(1));
  candidates.push(pascal);

  for (const c of candidates) {
    if (row[c] !== undefined) return row[c];
  }

  const cleanTarget = fieldName.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
  for (const k of Object.keys(row)) {
    const cleanK = k.toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
    if (cleanK === cleanTarget) {
      return row[k];
    }
  }

  return undefined;
}

/**
 * Audits Excel data against deep database principles, uniqueness, and referential integrity (foreign key checks).
 * Returns validity status and a list of detailed error descriptions in Persian.
 */
export function auditExcelData(tableName: string, rawRows: any[]): { isValid: boolean; errors: string[] } {
  preprocessExcelRowsBeforeImport(tableName, rawRows);
  const errors: string[] = [];
  
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { isValid: false, errors: ['کلا فایلی با سطر معتبر برای پردازش یافت نشد یا داده‌ها خالی هستند.'] };
  }

  const standardClauseIds = getAllStandardClauseIds();
  const availableDocs = getAvailableDocumentNames();

  // Helper to check standard clause format/existence
  const isValidClause = (cId: any): boolean => {
    if (cId === undefined || cId === null || cId === '') return true; // allow empty if nullable
    const str = String(cId).trim();
    return str === '' || standardClauseIds.has(str);
  };

  // Helper to check if document exists
  const isValidDocumentName = (docName: any): boolean => {
    if (docName === undefined || docName === null || docName === '') return false;
    return availableDocs.has(String(docName).trim());
  };

  if (tableName === 'documents_table') {
    const docRowIds = new Map<string, Set<string>>(); // document_name -> Set of item ids

    rawRows.forEach((row, idx) => {
      // For global documents_table, it has Document_Name, Row_ID, etc.
      const docName = resolveRowValue(row, 'Document_Name') || resolveRowValue(row, 'document_name') || '';
      const rId = resolveRowValue(row, 'Row_ID') || resolveRowValue(row, 'row_id') || resolveRowValue(row, 'id') || '';
      
      const rowNum = idx + 2; // Excel row index visual helper (header starts at row 1)

      if (!docName) {
        errors.push(`[ردیف ${rowNum}]: فاقد مقدار برای ستون نام سند (Document_Name) است.`);
        return;
      }

      // Check item uniqueness per document
      if (rId && rId !== 'N/A') {
        if (!docRowIds.has(docName)) {
          docRowIds.set(docName, new Set());
        }
        const docSet = docRowIds.get(docName)!;
        if (docSet.has(String(rId))) {
          errors.push(`[ردیف ${rowNum}]: مقدار شناسه سطر تکراری '${rId}' در سند '${docName}' یافت شد. اصل یکتایی داده در هر سند باید رعایت شود.`);
        } else {
          docSet.add(String(rId));
        }
      }

      // Check standard clause references if row has target clauseId
      const clauseVal = resolveRowValue(row, 'clauseId') || resolveRowValue(row, 'clause_id') || resolveRowValue(row, 'Clause_ID') || '';
      if (clauseVal && !isValidClause(clauseVal)) {
        errors.push(`[ردیف ${rowNum}]: بند آدرس‌دهی شده '${clauseVal}' در سند '${docName}' نامعتبر است. بند وارد شده در مراجع استاندارد IATF 16949 وجود ندارد.`);
      }
    });
  }

  else if (tableName === 'document_control_table') {
    const keys = new Set<string>();
    
    rawRows.forEach((row, idx) => {
      const docName = resolveRowValue(row, 'document_name', 'document_control_table');
      const rowNum = idx + 2;

      if (!docName) {
        errors.push(`[ردیف ${rowNum}]: ستون کلید اصلی نام سند (Document_Name) خالی است.`);
        return;
      }

      const trimmedName = String(docName).trim();

      // Uniqueness check for primary key
      if (keys.has(trimmedName)) {
        errors.push(`[ردیف ${rowNum}]: نام سند تکراری '${docName}' در شناسه کنترل اسناد یافت شد. فاقد رعایت اصل یکتایی.`);
      } else {
        keys.add(trimmedName);
      }

      // Foreign key validation (doc control refers to document in documents_table)
      if (!isValidDocumentName(docName)) {
        errors.push(`[ردیف ${rowNum}]: ارجاع نامعتبر؛ مستندی به نام سنجش قطبی «${docName}» در جدول مستندات اصلی (documents_table) وجود ندارد. ابتدا سند اصلی را ایجاد نمایید.`);
      }
    });
  }

  else if (tableName === 'indicators_table') {
    const keys = new Set<string>();

    rawRows.forEach((row, idx) => {
      const indicatorId = resolveRowValue(row, 'indicator_id', 'indicators_table');
      const rowNum = idx + 2;

      if (!indicatorId) {
        errors.push(`[ردیف ${rowNum}]: فاقد مقدار برای کلید اصلی شناسه شاخص (Indicator_ID) است.`);
        return;
      }

      const trimmedId = String(indicatorId).trim();

      // Primary Key unique check
      if (keys.has(trimmedId)) {
        errors.push(`[ردیف ${rowNum}]: شناسه شاخص تکراری '${indicatorId}' یافت شد. اصل کلید اصلی نقض گردیده است.`);
      } else {
        keys.add(trimmedId);
      }

      // Foreign key / clauseId check
      const clauseId = resolveRowValue(row, 'clauseId', 'indicators_table') || resolveRowValue(row, 'clause_id') || resolveRowValue(row, 'Clause_ID') || '';
      if (clauseId && !isValidClause(clauseId)) {
        errors.push(`[ردیف ${rowNum}]: شاخص '${indicatorId}' به بند استاندارد نامعتبر '${clauseId}' متصل شده است.`);
      }
    });
  }

  else if (tableName === 'clause_links_table') {
    const keys = new Set<string>();

    rawRows.forEach((row, idx) => {
      const clauseId = resolveRowValue(row, 'clause_id', 'clause_links_table');
      const rowNum = idx + 2;

      if (!clauseId) {
        errors.push(`[ردیف ${rowNum}]: ستون کلید اصلی بند استاندارد (Clause_ID) خالی است.`);
        return;
      }

      const trimmedId = String(clauseId).trim();

      // Primary Key uniqueness
      if (keys.has(trimmedId)) {
        errors.push(`[ردیف ${rowNum}]: بند استاندارد تکراری '${clauseId}' در مپینگ لینک‌ها کشف شد.`);
      } else {
        keys.add(trimmedId);
      }

      // Code integrity check (must be valid clause)
      if (!standardClauseIds.has(trimmedId)) {
        errors.push(`[ردیف ${rowNum}]: بند استاندارد '${clauseId}' در مراجع اصلی استاندارد IATF وجود ندارد.`);
      }

      // Related documents array exist check
      const docsRaw = resolveRowValue(row, 'linked_documents', 'clause_links_table') || '';
      if (docsRaw) {
        const docs = String(docsRaw).split(',').map(s => s.trim()).filter(Boolean);
        docs.forEach(doc => {
          if (!isValidDocumentName(doc)) {
            errors.push(`[ردیف ${rowNum}]: مستند لینک‌شده «${doc}» برای بند '${clauseId}' در مخزن اسناد پروژه (documents_table) وجود ندارد.`);
          }
        });
      }
    });
  }

  else if (tableName === 'records_table') {
    const keys = new Set<string>();

    rawRows.forEach((row, idx) => {
      const recId = resolveRowValue(row, 'record_id', 'records_table');
      const docName = resolveRowValue(row, 'documentName', 'records_table');
      const clauseId = resolveRowValue(row, 'clauseId', 'records_table');
      const rowNum = idx + 2;

      if (!recId) {
        errors.push(`[ردیف ${rowNum}]: شناسه سوابق (Record_ID) خالی است.`);
        return;
      }

      const trimmedId = String(recId).trim();

      // Unique Record_ID check
      if (keys.has(trimmedId)) {
        errors.push(`[ردیف ${rowNum}]: شناسه سابقه تکراری '${recId}' یافت شد.`);
      } else {
        keys.add(trimmedId);
      }

      // Referential integration checks
      if (docName && !isValidDocumentName(docName)) {
        errors.push(`[ردیف ${rowNum}]: سند مرجع سابقه '${recId}' به نام «${docName}» در جدول مستندات اصلی یافت نشد.`);
      }

      if (clauseId && !isValidClause(clauseId)) {
        errors.push(`[ردیف ${rowNum}]: بند استاندارد متصل به سابقه '${recId}' با شناسه '${clauseId}' نامعتبر است.`);
      }
    });
  }

  else if (tableName === 'csr_mappings_table') {
    const keys = new Set<string>();

    rawRows.forEach((row, idx) => {
      const id = resolveRowValue(row, 'id', 'csr_mappings_table');
      const docId = resolveRowValue(row, 'documentId', 'csr_mappings_table');
      const mappedClause = resolveRowValue(row, 'mappedIatfClauseId', 'csr_mappings_table');
      const rowNum = idx + 2;

      if (!id) {
        errors.push(`[ردیف ${rowNum}]: شناسه ردیف CSR تکی (ID) خالی است.`);
        return;
      }

      const trimmedId = String(id).trim();

      if (keys.has(trimmedId)) {
        errors.push(`[ردیف ${rowNum}]: شناسه تکراری مپینگ الزامات خاص مشتری '${id}' یافت شد.`);
      } else {
        keys.add(trimmedId);
      }

      // Relation checks
      if (docId && !isValidDocumentName(docId)) {
        errors.push(`[ردیف ${rowNum}]: سند CSR مرجع '${docId}' برای ردیف '${id}' در مستندات اصلی پروژه وجود ندارد.`);
      }

      if (mappedClause && !isValidClause(mappedClause)) {
        errors.push(`[ردیف ${rowNum}]: بند استاندارد IATF آدرس‌دهی شده '${mappedClause}' برای این مپینگ یافت نشد.`);
      }
    });
  }

  else if (tableName === 'process_mappings_table') {
    const keys = new Set<string>();

    rawRows.forEach((row, idx) => {
      const procKey = resolveRowValue(row, 'process_key', 'process_mappings_table');
      const rowNum = idx + 2;

      if (!procKey) {
        errors.push(`[ردیف ${rowNum}]: ستون کلید اصلی فرآیند (Process_Key) خالی است.`);
        return;
      }

      const trimmedKey = String(procKey).trim();

      if (keys.has(trimmedKey)) {
        errors.push(`[ردیف ${rowNum}]: کلید فرآیندی تکراری '${procKey}' در مپینگ فرآیندها نقض‌کننده یکتایی است.`);
      } else {
        keys.add(trimmedKey);
      }

      // Check linked clause codes in CSV
      const clausesRaw = resolveRowValue(row, 'clause_ids', 'process_mappings_table') || '';
      if (clausesRaw) {
        const cIds = String(clausesRaw).split(',').map(s => s.trim()).filter(Boolean);
        cIds.forEach(cid => {
          if (!isValidClause(cid)) {
            errors.push(`[ردیف ${rowNum}]: بند استاندارد نامعتبر '${cid}' برای فرآیند «${procKey}» یافت نشد.`);
          }
        });
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Audits Excel inputs for individual custom document tables inside the Document Editor.
 */
export function auditCustomDocExcelData(
  templateTitle: string, 
  rawRows: any[], 
  columns: any[]
): { isValid: boolean; errors: string[] } {
  preprocessExcelRowsBeforeImport('documents_table', rawRows);
  const errors: string[] = [];
  const standardClauseIds = getAllStandardClauseIds();

  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return { isValid: false, errors: ['داده‌های فایل اکسل خالی یا نامعتبر می‌باشند.'] };
  }

  const ids = new Set<string>();

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const rId = row.id || row.id || row['ردیف / Index'] || row['Index'] || row['Row_ID'] || '';
    
    if (rId) {
      const strId = String(rId).trim();
      if (ids.has(strId)) {
        errors.push(`[ردیف ${rowNum}]: سطر تکرار شده با ردیف/شناسه '${rId}'. اصل یکتایی رعایت نشده است.`);
      } else {
        ids.add(strId);
      }
    }

    // Relationship check for standard clause reference inside custom items
    columns.forEach(col => {
      const fieldVal = row[col.label] ?? row[col.field] ?? '';
      
      // If column is designated for clauseId, audit it
      const isClauseCol = col.field === 'clauseId' || col.id === 'clauseId' || col.label.includes('بند مرتبط') || col.label.toLowerCase().includes('clause');
      if (isClauseCol && fieldVal) {
        const strVal = String(fieldVal).trim();
        if (strVal && !standardClauseIds.has(strVal)) {
          errors.push(`[ردیف ${rowNum}]: بند استاندارد IATF وارد شده '${fieldVal}' به صورت مپینگ نامعتبر است و در مراجع سیستم یافت نشد.`);
        }
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Normalizes table rows into a flat layout suitable for a spreadsheet table.
 * Resolves rule #2: If a table is empty, exports the header layout with empty cells.
 */
export function getFlatTableData(tableName: string): any[] {
  const rawData = QmsDatabase.selectAll(tableName as any) || {};
  const entries = Object.entries(rawData);
  const rows: any[] = [];

  const addEmptyRowSchema = (columnsList: Record<string, any>) => {
    rows.push(columnsList);
  };

  if (entries.length === 0) {
    // Return sample/empty headers as requested by rule #2
    if (tableName === 'documents_table') {
      addEmptyRowSchema({
        'نام سند / Document Name': 'نمونه: شناسنامه فرآیندها (Process Cards - Turtle)',
        'ردیف یا شناسه سطر / Row ID': 'N/A',
        'شماره ردیف / Row Index': '',
        'عامل ذینفع / Factor Detail': '',
        'بند مرتبط': '',
        'نوع': 'context/risk_and_opp/lesson'
      });
    } else if (tableName === 'document_control_table') {
      addEmptyRowSchema({
        'نام سند / Document Name': 'مثال: روش اجرایی کنترل مستندات',
        'کد سند / Document Code': 'QMS-PR-01',
        'نسخه ویرایش / Revision': '01',
        'تهیه کننده / Prepared By': 'تضمین کیفیت',
        'تایید کننده / Approved By': 'نماینده مدیریت',
        'وضعیت چرخه سند / Lifecycle Status': 'Approved'
      });
    } else if (tableName === 'indicators_table') {
      addEmptyRowSchema({
        'شناسه شاخص / Indicator ID': 'KPI-1',
        'نوع شاخص / Type': 'process',
        'عنوان فارسی / Title Fa': 'راندمان تولید کوره دایکست',
        'عنوان انگلیسی / Title En': 'Die-casting efficiency',
        'حد هدف واقعی / Target': '95',
        'واحد اندازه‌گیری / Unit': '%',
        'تعداد ثبتی‌ها / Records Count': 0,
        'سوابق ارزیابی (JSON) / Evaluation Records JSON': '[]'
      });
    } else if (tableName === 'clause_links_table') {
      addEmptyRowSchema({
        'بند استاندارد / Clause ID': '7.5.1',
        'اسناد مرتبط / Linked Documents': 'روش اجرایی کنترل مستندات'
      });
    } else if (tableName === 'records_table') {
      addEmptyRowSchema({
        'شناسه سابقه / Record ID': 'REC-1234',
        'نام سند مرجع / Document Name': 'کاربرگ جامع حل مسئله به روش 8D',
        'بند مرتبط استاندارد / Clause ID': '10.2.1',
        'تاریخ بایگانی / Archived At': '1405/03/14',
        'کد / Code': '8D-NC-10',
        'نسخه / Revision': '01',
        'تهیه کننده / Prepared By': 'مدیر تضمین کیفیت',
        'تایید کننده / Approved By': 'مدیریت ارشد',
        'محتوای اقلام سابقه (JSON) / Items JSON': '[]'
      });
    } else if (tableName === 'csr_mappings_table') {
      addEmptyRowSchema({
        'شناسه الزامات / ID': 'CSR-1',
        'شناسه مستند / Document ID': 'برنامه واکنش اضطراری',
        'شماره یا کد مشتری / Customer Code': 'SAIPA',
        'عنوان مشتری / Customer Title': 'S-PAS SAIPA Special requirements',
        'بند استاندارد IATF / Mapped IATF Clause': '6.1.2.3',
        'متن تجزیه و تحلیل الزامات / Requirement Analysis': 'برنامه‌های واکنش اضطراری تایید صلاحیت شده',
        'وضعیت همراستایی / Compliance Status': 'fully_aligned',
        'عنوان سند پیوست / Annex Document Title': 'برنامه واکنش اضطراری'
      });
    } else if (tableName === 'process_mappings_table') {
      addEmptyRowSchema({
        'کلید فرآیند / Process Key': 'فرآیند دایکست و تزریق فلز',
        'بندهای مرتبط / Associated Clauses': '8.5.1, 8.5.1.1, 8.5.1.2'
      });
    } else if (tableName === 'kpi_vars_table') {
      addEmptyRowSchema({
        'کلید متغیر فرمولی / Constant Key': 'TOTAL_SCRAP_QTY',
        'مقدار عددی متغیر / Numeric Value': '0',
        'تاریخ بروزرسانی / Updated At': '1405/03/01'
      });
    } else {
      addEmptyRowSchema({
        'Key': 'Empty',
        'Payload': ''
      });
    }
    return rows;
  }

  for (const [key, val] of entries) {
    if (tableName === 'documents_table') {
      const itemsList = Array.isArray(val) ? val : [];
      if (itemsList.length === 0) {
        rows.push({
          'نام سند / Document Name': key,
          'ردیف یا شناسه سطر / Row ID': 'N/A',
          'شماره ردیف / Row Index': '',
          'جزئیات / Details': 'No items populated yet.'
        });
      } else {
        const columns = getDocColumns(key);
        itemsList.forEach((item: any) => {
          const flatRow: Record<string, any> = {
            'نام سند / Document Name': key,
            'ردیف یا شناسه سطر / Row ID': item.id || '',
            'شماره ردیف / Row Index': item.index !== undefined ? item.index : ''
          };
          
          columns.forEach(col => {
            const val = item[col.field] !== undefined ? item[col.field] : item[col.id];
            if (val !== undefined) {
              flatRow[col.label] = val;
            } else {
              flatRow[col.label] = '';
            }
          });

          // Fallback for any other properties
          Object.keys(item).forEach(prop => {
            if (!['id', 'index', 'image'].includes(prop) && !prop.endsWith('_fk')) {
              const mappedCol = columns.find(c => c.field === prop || c.id === prop);
              if (!mappedCol) {
                flatRow[prop] = item[prop];
              }
            }
          });
          rows.push(flatRow);
        });
      }
    } else if (tableName === 'document_control_table') {
      const info = val as any;
      rows.push({
        'نام سند / Document Name': key,
        'کد سند / Document Code': info?.code || '',
        'نسخه ویرایش / Revision': info?.revision || '1',
        'تهیه کننده / Prepared By': info?.preparedBy || '',
        'تایید کننده / Approved By': info?.approvedBy || '',
         'وضعیت چرخه سند / Lifecycle Status': info?.lifecycle_status || 'Draft'
      });
    } else if (tableName === 'indicators_table') {
      const info = val as any;
      rows.push({
        'شناسه شاخص / Indicator ID': key,
        'نوع شاخص / Type': info?.type || '',
        'عنوان فارسی / Title Fa': info?.titleFa || '',
        'عنوان انگلیسی / Title En': info?.titleEn || '',
        'حد هدف واقعی / Target': info?.target || '',
        'واحد اندازه‌گیری / Unit': info?.unit || '',
        'تعداد ثبتی‌ها / Records Count': Array.isArray(info?.records) ? info.records.length : 0,
        'سوابق ارزیابی (JSON) / Evaluation Records JSON': Array.isArray(info?.records) ? JSON.stringify(info.records) : '[]'
      });
    } else if (tableName === 'clause_links_table') {
      const docList = Array.isArray(val) ? val : (val as any)?.documents_list || [];
      rows.push({
        'بند استاندارد / Clause ID': key,
        'اسناد مرتبط / Linked Documents': docList.join(', ')
      });
    } else if (tableName === 'records_table') {
      const info = val as any;
      rows.push({
        'شناسه سابقه / Record ID': key,
        'نام سند مرجع / Document Name': info?.documentName || '',
        'بند مرتبط استاندارد / Clause ID': info?.clauseId || '',
        'تاریخ بایگانی / Archived At': info?.archivedAt || '',
        'کد / Code': info?.code || '',
        'نسخه / Revision': info?.revision || '',
        'تهیه کننده / Prepared By': info?.preparedBy || '',
        'تایید کننده / Approved By': info?.approvedBy || '',
        'محتوای اقلام سابقه (JSON) / Items JSON': info?.items ? JSON.stringify(info.items) : '[]'
      });
    } else if (tableName === 'csr_mappings_table') {
      const info = val as any;
      rows.push({
        'شناسه الزامات / ID': key,
        'شناسه مستند / Document ID': info?.documentId || '',
         'شماره یا کد مشتری / Customer Code': info?.customerNumber || '',
         'عنوان مشتری / Customer Title': info?.customerTitle || '',
         'بند استاندارد IATF / Mapped IATF Clause': info?.mappedIatfClauseId || '',
         'متن تجزیه و تحلیل الزامات / Requirement Analysis': info?.customerText || info?.analysisText || '',
         'وضعیت همراستایی / Compliance Status': info?.status || '',
         'عنوان سند پیوست / Annex Document Title': info?.documentTitle || ''
      });
    } else if (tableName === 'process_mappings_table') {
      const listVal = Array.isArray(val) ? val : (val as any)?.clause_ids || [];
      rows.push({
        'کلید فرآیند / Process Key': key,
        'بندهای مرتبط / Associated Clauses': listVal.join(', ')
      });
    } else if (tableName === 'kpi_vars_table') {
      const info = val as any;
      rows.push({
        'کلید متغیر فرمولی / Constant Key': key,
        'مقدار عددی متغیر / Numeric Value': String(info?.value ?? ''),
        'تاریخ بروزرسانی / Updated At': info?.updatedAt || ''
      });
    } else {
      rows.push({
        'Key': key,
        'Payload': typeof val === 'object' ? JSON.stringify(val) : String(val)
      });
    }
  }

  return rows;
}

/**
 * Exports a specific database table to an Excel file (.xlsx)
 */
export function exportTableToExcel(tableName: string) {
  const flatData = getFlatTableData(tableName);
  const worksheet = XLSX.utils.json_to_sheet(cleanExportRows(flatData));
  autofitColumns(worksheet);
  const workbook = XLSX.utils.book_new();
  
  let sheetName = tableName.slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  
  const formattedDate = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${tableName}_export_${formattedDate}.xlsx`);
}

/**
 * Exports ALL relational tables of the QMS-DB database as worksheets inside a single Excel workbook
 */
export function exportAllTablesToExcel() {
  const workbook = XLSX.utils.book_new();
  
  const tables = [
    { name: 'documents_table', sheet: 'Custom_QMS_Documents' },
    { name: 'document_control_table', sheet: 'ISO9001_Doc_Control' },
    { name: 'indicators_table', sheet: 'KPI_Indicators' },
    { name: 'clause_links_table', sheet: 'Clause_Reference_Mappings' },
    { name: 'records_table', sheet: 'Audit_Compliance_Records' },
    { name: 'csr_mappings_table', sheet: 'Customer_CSR_Alignments' },
    { name: 'process_mappings_table', sheet: 'Process_Matrix_Reference' },
    { name: 'kpi_vars_table', sheet: 'KPI_Formula_Constants' }
  ];

  tables.forEach(t => {
    const data = getFlatTableData(t.name);
    const ws = XLSX.utils.json_to_sheet(cleanExportRows(data));
    autofitColumns(ws);
    XLSX.utils.book_append_sheet(workbook, ws, t.sheet);
  });

  const formattedDate = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `QMS_COMPLETE_DATABASE_${formattedDate}.xlsx`);
}

/**
 * Imports Excel sheet rows back into the database table, restoring relational consistency with constraint diagnostics.
 */
export function importExcelToTable(tableName: string, rawRows: any[]): { success: boolean; count: number; error?: string } {
  try {
    preprocessExcelRowsBeforeImport(tableName, rawRows);
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      return { success: false, count: 0, error: 'هیچ داده معتبری در فایل اکسل یافت نشد.' };
    }

    // Programmatic DB level relational mapping validation
    const audit = auditExcelData(tableName, rawRows);
    if (!audit.isValid) {
      const errorMsg = 'مغایرت دیتابیسی زیر کشف شد:\n' + audit.errors.join('\n');
      return { success: false, count: 0, error: errorMsg };
    }

    if (tableName === 'documents_table') {
      const grouped: Record<string, any[]> = {};
      
      rawRows.forEach(row => {
        const docName = resolveRowValue(row, 'Document_Name') || resolveRowValue(row, 'document_name');
        if (!docName) return;
        
        if (!grouped[docName]) {
          grouped[docName] = [];
        }
        
        const item: any = {
          id: resolveRowValue(row, 'id') || resolveRowValue(row, 'row_id') || resolveRowValue(row, 'Row_ID') || `item-${Math.floor(Math.random() * 1000000)}`,
          index: Number(resolveRowValue(row, 'index') ?? resolveRowValue(row, 'row_index') ?? resolveRowValue(row, 'Row_Index') ?? grouped[docName].length + 1)
        };

        const columns = getDocColumns(docName);

        // Map visual labels back to database fields
        columns.forEach(col => {
          const valByLabel = row[col.label];
          const valByField = row[col.field] ?? row[col.id];
          const val = valByLabel !== undefined ? valByLabel : valByField;
          if (val !== undefined) {
            const num = Number(val);
            item[col.field] = (!isNaN(num) && val !== '' && typeof val !== 'string') ? num : val;
          }
        });

        // Also map anything that is not mapped but might belong to metadata
        Object.keys(row).forEach(k => {
          if (!['Document_Name', 'document_name', 'Row_ID', 'row_id', 'Row_Index', 'row_index', 'id', 'index'].includes(k)) {
            const isLabel = columns.some(c => c.label === k);
            if (!isLabel) {
              const val = row[k];
              const num = Number(val);
              item[k] = (!isNaN(num) && val !== '' && typeof val !== 'string') ? num : val;
            }
          }
        });

        if (item.id !== 'N/A' && row.Details !== 'No items populated yet.') {
          grouped[docName].push(item);
        }
      });

      let count = 0;
      Object.entries(grouped).forEach(([docName, list]) => {
        QmsDatabase.writeRow('documents_table', docName, list);
        count++;
      });

      return { success: true, count };
    }

    if (tableName === 'document_control_table') {
      let count = 0;
      rawRows.forEach(row => {
        const docName = resolveRowValue(row, 'document_name', 'document_control_table');
        if (!docName) return;
        
        const controlObj = {
          code: resolveRowValue(row, 'code', 'document_control_table') || '',
          revision: String(resolveRowValue(row, 'revision', 'document_control_table') || '1'),
          preparedBy: resolveRowValue(row, 'preparedBy', 'document_control_table') || '',
          approvedBy: resolveRowValue(row, 'approvedBy', 'document_control_table') || '',
          lifecycle_status: resolveRowValue(row, 'lifecycle_status', 'document_control_table') || 'Draft'
        };

        QmsDatabase.writeRow('document_control_table', docName, controlObj);
        count++;
      });
      return { success: true, count };
    }

    if (tableName === 'indicators_table') {
      let count = 0;
      rawRows.forEach(row => {
        const indicatorId = resolveRowValue(row, 'indicator_id', 'indicators_table');
        if (!indicatorId) return;

        let records = [];
        try {
          const rawRecordsJson = resolveRowValue(row, 'evaluation_records_json', 'indicators_table');
          if (rawRecordsJson) {
            records = typeof rawRecordsJson === 'string' ? JSON.parse(rawRecordsJson) : rawRecordsJson;
          }
        } catch {}

        const indicatorObj = {
          id: indicatorId,
          type: resolveRowValue(row, 'type', 'indicators_table') || 'process',
          titleFa: resolveRowValue(row, 'titleFa', 'indicators_table') || '',
          titleEn: resolveRowValue(row, 'titleEn', 'indicators_table') || '',
          target: Number(resolveRowValue(row, 'target', 'indicators_table') || 0),
          unit: resolveRowValue(row, 'unit', 'indicators_table') || '',
          records: Array.isArray(records) ? records : []
        };

        QmsDatabase.writeRow('indicators_table', indicatorId, indicatorObj);
        count++;
      });
      return { success: true, count };
    }

    if (tableName === 'clause_links_table') {
      let count = 0;
      rawRows.forEach(row => {
        const clauseId = resolveRowValue(row, 'clause_id', 'clause_links_table');
        if (!clauseId) return;

        const docsRaw = resolveRowValue(row, 'linked_documents', 'clause_links_table') || '';
        const list = docsRaw ? String(docsRaw).split(',').map((s: string) => s.trim()).filter(Boolean) : [];

        QmsDatabase.writeRow('clause_links_table', clauseId, list);
        count++;
      });
      return { success: true, count };
    }

    if (tableName === 'records_table') {
      let count = 0;
      rawRows.forEach(row => {
        const recId = resolveRowValue(row, 'record_id', 'records_table');
        if (!recId) return;

        let recordsList = [];
        try {
          const rawItemsJson = resolveRowValue(row, 'items_json', 'records_table');
          if (rawItemsJson) {
            recordsList = typeof rawItemsJson === 'string' ? JSON.parse(rawItemsJson) : rawItemsJson;
          }
        } catch {}

        const recordObj = {
          id: recId,
          documentName: resolveRowValue(row, 'documentName', 'records_table') || '',
          clauseId: resolveRowValue(row, 'clauseId', 'records_table') || '',
          archivedAt: resolveRowValue(row, 'archivedAt', 'records_table') || '',
          code: resolveRowValue(row, 'code', 'records_table') || '',
          revision: resolveRowValue(row, 'revision', 'records_table') || '01',
          preparedBy: resolveRowValue(row, 'preparedBy', 'records_table') || '',
          approvedBy: resolveRowValue(row, 'approvedBy', 'records_table') || '',
          items: Array.isArray(recordsList) ? recordsList : []
        };

        QmsDatabase.writeRow('records_table', recId, recordObj);
        count++;
      });
      return { success: true, count };
    }

    if (tableName === 'csr_mappings_table') {
      let count = 0;
      rawRows.forEach(row => {
        const id = resolveRowValue(row, 'id', 'csr_mappings_table');
        if (!id) return;

        const csrObj = {
          id: id,
          documentId: resolveRowValue(row, 'documentId', 'csr_mappings_table') || '',
          customerNumber: resolveRowValue(row, 'customerNumber', 'csr_mappings_table') || '',
          customerTitle: resolveRowValue(row, 'customerTitle', 'csr_mappings_table') || '',
          mappedIatfClauseId: resolveRowValue(row, 'mappedIatfClauseId', 'csr_mappings_table') || '',
          customerText: resolveRowValue(row, 'analysisText', 'csr_mappings_table') || '',
          status: resolveRowValue(row, 'status', 'csr_mappings_table') || 'fully_aligned',
          documentTitle: resolveRowValue(row, 'documentTitle', 'csr_mappings_table') || ''
        };

        QmsDatabase.writeRow('csr_mappings_table', id, csrObj);
        count++;
      });
      return { success: true, count };
    }

    if (tableName === 'process_mappings_table') {
      let count = 0;
      rawRows.forEach(row => {
        const procKey = resolveRowValue(row, 'process_key', 'process_mappings_table');
        if (!procKey) return;

        const csv = resolveRowValue(row, 'clause_ids', 'process_mappings_table') || '';
        const clauseArray = csv ? String(csv).split(',').map((s: string) => s.trim()).filter(Boolean) : [];

        QmsDatabase.writeRow('process_mappings_table', procKey, clauseArray);
        count++;
      });
      return { success: true, count };
    }

    if (tableName === 'kpi_vars_table') {
      let count = 0;
      rawRows.forEach(row => {
        const varKey = resolveRowValue(row, 'var_key', 'kpi_vars_table');
        if (!varKey) return;

        const varObj = {
          value: String(resolveRowValue(row, 'value', 'kpi_vars_table') ?? '0'),
          updatedAt: resolveRowValue(row, 'updatedAt', 'kpi_vars_table') || '1405/03/01'
        };

        QmsDatabase.writeRow('kpi_vars_table', varKey, varObj);
        count++;
      });
      return { success: true, count };
    }

    // Support dynamic custom document templates starting with doc_
    if (tableName.startsWith('doc_')) {
      const docName = tableName.substring(4);
      const grouped: Record<string, any[]> = { [docName]: [] };
      
      rawRows.forEach(row => {
        const item: any = {
          id: resolveRowValue(row, 'id') || resolveRowValue(row, 'row_id') || resolveRowValue(row, 'Row_ID') || `item-${Math.floor(Math.random() * 1000000)}`,
          index: Number(resolveRowValue(row, 'index') ?? resolveRowValue(row, 'row_index') ?? resolveRowValue(row, 'Row_Index') ?? (grouped[docName].length + 1))
        };

        const columns = getDocColumns(docName);

        // Map visual labels back to database fields
        columns.forEach(col => {
          const valByLabel = row[col.label];
          const valByField = row[col.field] ?? row[col.id];
          const val = valByLabel !== undefined ? valByLabel : valByField;
          if (val !== undefined) {
            const num = Number(val);
            item[col.field] = (!isNaN(num) && val !== '' && typeof val !== 'string') ? num : val;
          }
        });

        // Also map anything that is not mapped but might belong to metadata
        Object.keys(row).forEach(k => {
          if (!['Row_ID', 'row_id', 'Row_Index', 'row_index', 'id', 'index'].includes(k)) {
            const isLabel = columns.some(c => c.label === k);
            if (!isLabel) {
              const val = row[k];
              const num = Number(val);
              item[k] = (!isNaN(num) && val !== '' && typeof val !== 'string') ? num : val;
            }
          }
        });

        if (item.id !== 'N/A' && row.Details !== 'No items populated yet.') {
          grouped[docName].push(item);
        }
      });

      QmsDatabase.writeRow('documents_table', docName, grouped[docName]);
      return { success: true, count: grouped[docName].length };
    }

    if (tableName === 'strategic_items_table') {
      let count = 0;
      rawRows.forEach(row => {
        const id = resolveRowValue(row, 'id', 'strategic_items_table') || resolveRowValue(row, 'Row_ID') || resolveRowValue(row, 'row_id') || `strat-${count}-${Math.floor(Math.random() * 1000000)}`;
        if (!id) return;

        const stratObj = {
          id: id,
          goal: resolveRowValue(row, 'goal', 'strategic_items_table') || '',
          operation: resolveRowValue(row, 'operation', 'strategic_items_table') || '',
          responsible: resolveRowValue(row, 'responsible', 'strategic_items_table') || '',
          progress: Number(resolveRowValue(row, 'progress', 'strategic_items_table') || 0),
          remarks: resolveRowValue(row, 'remarks', 'strategic_items_table') || ''
        };

        QmsDatabase.writeRow('strategic_items_table', id, stratObj);
        count++;
      });
      return { success: true, count };
    }

    if (tableName === 'strategic_evaluations_table') {
      let count = 0;
      rawRows.forEach(row => {
        const id = resolveRowValue(row, 'id', 'strategic_evaluations_table') || resolveRowValue(row, 'Row_ID') || resolveRowValue(row, 'row_id') || `eval-${count}-${Math.floor(Math.random() * 1000000)}`;
        if (!id) return;

        const evalObj = {
          id: id,
          type: resolveRowValue(row, 'type', 'strategic_evaluations_table') || 'strength',
          factor: resolveRowValue(row, 'factor', 'strategic_evaluations_table') || '',
          weight: Number(resolveRowValue(row, 'weight', 'strategic_evaluations_table') || 0),
          rating: Number(resolveRowValue(row, 'rating', 'strategic_evaluations_table') || 0),
          score: Number(resolveRowValue(row, 'score', 'strategic_evaluations_table') || 0),
          strategy: resolveRowValue(row, 'strategy', 'strategic_evaluations_table') || ''
        };

        QmsDatabase.writeRow('strategic_evaluations_table', id, evalObj);
        count++;
      });
      return { success: true, count };
    }

    if (tableName === 'strategic_threshold_matrix_table') {
      let count = 0;
      rawRows.forEach(row => {
        const activeMatrix = resolveRowValue(row, 'active_matrix', 'strategic_threshold_matrix_table') || 'default';
        
        let cellColors = {};
        try {
          const rawColors = resolveRowValue(row, 'cell_colors', 'strategic_threshold_matrix_table');
          if (rawColors) {
            cellColors = typeof rawColors === 'string' ? JSON.parse(rawColors) : rawColors;
          }
        } catch {}

        const thresholdObj = {
          active_matrix: activeMatrix,
          yellow_threshold: Number(resolveRowValue(row, 'yellow_threshold', 'strategic_threshold_matrix_table') || 3),
          red_threshold: Number(resolveRowValue(row, 'red_threshold', 'strategic_threshold_matrix_table') || 8),
          cell_colors: cellColors,
          lastUpdated: resolveRowValue(row, 'lastUpdated', 'strategic_threshold_matrix_table') || Date.now()
        };

        QmsDatabase.writeRow('strategic_threshold_matrix_table', activeMatrix, thresholdObj);
        count++;
      });
      return { success: true, count };
    }

    if (tableName === 'nc_items_table') {
      let count = 0;
      rawRows.forEach(row => {
        const id = resolveRowValue(row, 'id', 'nc_items_table') || resolveRowValue(row, 'Row_ID') || resolveRowValue(row, 'row_id') || `nc-${count}-${Math.floor(Math.random() * 1000000)}`;
        if (!id) return;

        const ncObj = {
          id: id,
          ncTitle: resolveRowValue(row, 'ncTitle', 'nc_items_table') || '',
          rootCause: resolveRowValue(row, 'rootCause', 'nc_items_table') || '',
          correctiveAction: resolveRowValue(row, 'correctiveAction', 'nc_items_table') || '',
          responsible: resolveRowValue(row, 'responsible', 'nc_items_table') || '',
          status: resolveRowValue(row, 'status', 'nc_items_table') || 'open',
          progress: Number(resolveRowValue(row, 'progress', 'nc_items_table') || 0)
        };

        QmsDatabase.writeRow('nc_items_table', id, ncObj);
        count++;
      });
      return { success: true, count };
    }

    return { success: false, count: 0, error: 'نام جدول ناشناخته است.' };
  } catch (e: any) {
    return { success: false, count: 0, error: e?.message || String(e) };
  }
}

/**
 * Dynamically resolves columns list for any dynamic document template, prioritizing saved custom layouts or falling back to defaults.
 */
export function getDocColumns(docName: string): any[] {
  try {
    const savedColsRaw = localStorage.getItem(`iatf_draft_cols_${docName}`);
    if (savedColsRaw) {
      const parsed = JSON.parse(savedColsRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}

  const isFa = true;
  const tpl = documentTemplates[docName] || Object.values(documentTemplates).find(t => t.title === docName);
  
  if (tpl) {
    const isProcM = tpl.title.includes('Process Map') || tpl.title.includes('نقشه فرایند') || tpl.title.includes('نقشه فرآیند');
    if (isProcM) {
      return [
        { id: 'field1', label: isFa ? 'نام فرآیند QMS' : 'Process Name', field: 'field1', type: 'text' },
        { id: 'field2', label: isFa ? 'ورودی‌های فرآیند' : 'Process Inputs', field: 'field2', type: 'textarea' },
        { id: 'field3', label: isFa ? 'خروجی‌های فرآیند' : 'Process Outputs', field: 'field3', type: 'textarea' },
        { id: 'field4', label: isFa ? 'شاخص کلیدی (KPI)' : 'Process KPI', field: 'field4', type: 'text' },
        { id: 'x', label: isFa ? 'موقعیت افقی (X)' : 'Horizontal Pos (X)', field: 'x', type: 'number' },
        { id: 'y', label: isFa ? 'موقعیت عمودی (Y)' : 'Vertical Pos (Y)', field: 'y', type: 'number' }
      ];
    }

    if (tpl.smartType === 'SWOT') {
      return [
        { id: 'type', label: isFa ? 'دسته‌بندی SWOT' : 'SWOT Category', field: 'type', type: 'select' },
        { id: 'field1', label: isFa ? (tpl.headers[0] || 'عامل ذینفع') : 'Factor Detail', field: 'field1', type: 'text' },
        { id: 'field2', label: isFa ? (tpl.headers[1] || 'شرح عامل و تاثیر آن') : 'Analysis & Impact Strategy', field: 'field2', type: 'text' },
        { id: 'field3', label: isFa ? 'حوزه' : 'Domain', field: 'field3', type: 'text' },
        { id: 'field4', label: isFa ? 'اثر بر QMS' : 'Impact on QMS', field: 'field4', type: 'text' },
        { id: 'weight', label: isFa ? (tpl.headers[2] || 'وزن عامل') : 'Critical Weight', field: 'weight', type: 'number' },
        { id: 'rating', label: isFa ? (tpl.headers[3] || 'امتیاز') : 'Rating (1-10)', field: 'rating', type: 'number' },
        { id: 'final_score', label: isFa ? (tpl.headers[4] || 'نمره نهایی') : 'Weighted Score', field: 'final_score', type: 'display', isReadOnly: true }
      ];
    }

    if (tpl.smartType === 'RISK') {
      return [
        { id: 'field1', label: isFa ? (tpl.headers[0] || 'مراحل فرایند / گام') : 'Process Step / Activity', field: 'field1', type: 'text' },
        { id: 'field2', label: isFa ? (tpl.headers[1] || 'حالت خرابی بالقوه (Failure)') : 'Potential Failure Mode', field: 'field2', type: 'text' },
        { id: 'severity', label: isFa ? (tpl.headers[2] || 'شدت (S)') : 'Severity (S)', field: 'severity', type: 'number' },
        { id: 'occurrence', label: isFa ? (tpl.headers[3] || 'وقوع (O)') : 'Occurrence (O)', field: 'occurrence', type: 'number' },
        { id: 'detection', label: isFa ? (tpl.headers[4] || 'تشخیص (D)') : 'Detection (D)', field: 'detection', type: 'number' },
        { id: 'rpn', label: isFa ? 'شاخص اولویت ریسک (RPN)' : 'Risk Priority Number (RPN)', field: 'rpn', type: 'display', isReadOnly: true },
        { id: 'actions', label: isFa ? 'اقدامات اصلاحی پیشنهادی' : 'Proposed Countermeasures', field: 'actions', type: 'text' }
      ];
    }

    if (tpl.smartType === 'PFMEA') {
      return [
        { id: 'field2', label: isFa ? 'عملیات' : 'Operation', field: 'field2', type: 'textarea' },
        { id: 'field3', label: isFa ? 'حالات خرابی بالقوه' : 'Potential Failure Mode', field: 'field3', type: 'textarea' },
        { id: 'field4', label: isFa ? 'آثار خرابی بالقوه' : 'Potential Failure Effects', field: 'field4', type: 'textarea' },
        { id: 'severity', label: isFa ? 'شدت(s)' : 'Severity (S)', field: 'severity', type: 'number' },
        { id: 'field5', label: isFa ? 'درجه اهمیت' : 'Classification', field: 'field5', type: 'text' },
        { id: 'field6', label: isFa ? 'علل بالقوه خرابی' : 'Potential Cause(s)', field: 'field6', type: 'textarea' },
        { id: 'occurrence', label: isFa ? 'احتمال وقوع(O)' : 'Occurrence (O)', field: 'occurrence', type: 'number' },
        { id: 'field7', label: isFa ? 'کنترلهای پیشگیرانه(فرآیندی)' : 'Prevention Controls', field: 'field7', type: 'textarea' },
        { id: 'field8', label: isFa ? 'کنترلهای تشخیصی(محصولی)' : 'Detection Controls', field: 'field8', type: 'textarea' },
        { id: 'detection', label: isFa ? 'تشخیص(D)' : 'Detection (D)', field: 'detection', type: 'number' },
        { id: 'so', label: isFa ? 'SO' : 'SO', field: 'so', type: 'formula', formula: '=D*G', isReadOnly: true },
        { id: 'rpn', label: isFa ? 'RPN' : 'RPN', field: 'rpn', type: 'formula', formula: '=D*G*J', isReadOnly: true },
        { id: 'field9', label: isFa ? 'اقدامات پیشنهادی' : 'Recommended Actions', field: 'field9', type: 'textarea' },
        { id: 'field10', label: isFa ? 'مسئولیت' : 'Responsibility', field: 'field10', type: 'text' },
        { id: 'field11', label: isFa ? 'تاریخ تکمیل' : 'Completion Date', field: 'field11', type: 'text' },
        { id: 'field12', label: isFa ? 'اقدامات صورت گرفته' : 'Actions Taken', field: 'field12', type: 'textarea' },
        { id: 'severity2', label: isFa ? 'S2' : 'S2', field: 'severity2', type: 'number' },
        { id: 'occurrence2', label: isFa ? 'O2' : 'O2', field: 'occurrence2', type: 'number' },
        { id: 'detection2', label: isFa ? 'D2' : 'D2', field: 'detection2', type: 'number' },
        { id: 'so2', label: isFa ? 'SO2' : 'SO2', field: 'so2', type: 'formula', formula: '=Q*R', isReadOnly: true },
        { id: 'rpn2', label: isFa ? '2RPN' : '2RPN', field: 'rpn2', type: 'formula', formula: '=Q*R*S', isReadOnly: true }
      ];
    }

    if (tpl.smartType === 'CALIBRATION') {
      return [
        { id: 'field1', label: isFa ? (tpl.headers[0] || 'کد/نام ابزار کنترلی') : 'Instrument Code / Tag', field: 'field1', type: 'text' },
        { id: 'mpe', label: isFa ? (tpl.headers[1] || 'حداکثر خطای مجاز MPE') : 'Maximum Permissible Error (MPE)', field: 'mpe', type: 'number' },
        { id: 'refValue', label: isFa ? (tpl.headers[2] || 'مقدار مرجع (بلوک سنجه)') : 'Reference Master Value', field: 'refValue', type: 'number' },
        { id: 'readValue', label: isFa ? (tpl.headers[3] || 'مقدار قرائت شده') : 'Observed Read Value', field: 'readValue', type: 'number' },
        { id: 'measured_error', label: isFa ? 'خطای محاسبه شده' : 'Measured Absolute Error', field: 'measured_error', type: 'display', isReadOnly: true },
        { id: 'calibration_status', label: isFa ? 'وضعیت انطباق ابزار' : 'Calibration QC Verdict', field: 'calibration_status', type: 'display', isReadOnly: true }
      ];
    }

    if (tpl.smartType === 'KPI') {
      return [
        { id: 'field1', label: isFa ? (tpl.headers[0] || 'عنوان شاخص عملکردی (KPI)') : 'KPI Attribute Description', field: 'field1', type: 'text' },
        { id: 'target', label: isFa ? (tpl.headers[2] || 'تارگت هدف') : 'Target Limit', field: 'target', type: 'number' },
        { id: 'actual', label: isFa ? (tpl.headers[3] || 'عملکرد واقعی') : 'Actual Performance', field: 'actual', type: 'number' },
        { id: 'unit', label: isFa ? (tpl.headers[1] || 'واحد اندازه‌گیری') : 'Unit Of Measure', field: 'unit', type: 'text' },
        { id: 'clauseId', label: isFa ? 'بند مرتبطه استاندارد (مثال: 9.1)' : 'Mapped Clause ID', field: 'clauseId', type: 'text' },
        { id: 'kpi_rate', label: isFa ? 'درصد تحقق شاخص' : 'Fulfillment Achievement Rate', field: 'kpi_rate', type: 'display', isReadOnly: true }
      ];
    }

    if (tpl.smartType === 'TURTLE') {
      return [
        { id: 'field1', label: isFa ? 'عنوان و هدف فرآیند' : 'Process Title & Objective', field: 'field1', type: 'text' },
        { id: 'field2', label: isFa ? 'ورودی‌ها (اطلاعات / مواد)' : 'Inputs (Data / Materials)', field: 'field2', type: 'textarea' },
        { id: 'field3', label: isFa ? 'خروجی‌ها (نتایج / محصولات)' : 'Outputs (Results / Deliverables)', field: 'field3', type: 'textarea' },
        { id: 'field4', label: isFa ? 'با چه تجهیزاتی؟ (سخت‌افزار / ماشین)' : 'With What? (Equipment / Facilities)', field: 'field4', type: 'textarea' },
        { id: 'field5', label: isFa ? 'با چه کسانی؟ (منابع انسانی / شایستگی)' : 'With Whom? (Personnel / Competency)', field: 'field5', type: 'textarea' },
        { id: 'field6', label: isFa ? 'چگونه؟ (روش‌های اجرایی / دستورالعمل‌ها)' : 'How? (Methods / Procedures)', field: 'field6', type: 'textarea' },
        { id: 'field7', label: isFa ? 'شاخص عملکردی فرآیند (KPI)' : 'Process KPI Metric', field: 'field7', type: 'text' },
        { id: 'target', label: isFa ? 'حد هدف‌گذاری شده کیفی' : 'KPI Target Limit', field: 'target', type: 'number' },
        { id: 'actual', label: isFa ? 'عملکرد واقعی جاری' : 'Actual Measured KPI', field: 'actual', type: 'number' },
        { id: 'unit', label: isFa ? 'واحد اندازه‌گیری' : 'Unit', field: 'unit', type: 'text' },
        { id: 'clauseId', label: isFa ? 'بند مرتبطه استاندارد (مثال: 4.4)' : 'Mapped Clause ID', field: 'clauseId', type: 'text' },
        { id: 'kpi_rate', label: isFa ? 'درصد تحقق' : 'Performance Rate', field: 'kpi_rate', type: 'display', isReadOnly: true }
      ];
    }

    if (tpl.smartType === 'KPI_PROCESS') {
      return [
        { id: 'field1', label: isFa ? 'عنوان فرآیند' : 'Process Title', field: 'field1', type: 'text' },
        { id: 'field2', label: isFa ? 'صاحب فرآیند' : 'Process Owner', field: 'field2', type: 'text' },
        { id: 'field3', label: isFa ? 'ورودی‌ها و خروجی‌ها' : 'Inputs & Outputs', field: 'field3', type: 'textarea' },
        { id: 'field4', label: isFa ? 'شاخص عملکردی فرآیند (KPI)' : 'Process KPI Metric', field: 'field4', type: 'text' },
        { id: 'target', label: isFa ? 'حد هدف‌گذاری شده' : 'Approved Target Limit', field: 'target', type: 'number' },
        { id: 'actual', label: isFa ? 'عملکرد واقعی جاری' : 'Actual Measured Output', field: 'actual', type: 'number' },
        { id: 'unit', label: isFa ? 'واحد' : 'Unit', field: 'unit', type: 'text' },
        { id: 'clauseId', label: isFa ? 'بند مرتبط استاندارد (مثال: 4.4)' : 'Mapped Clause ID', field: 'clauseId', type: 'text' },
        { id: 'kpi_rate', label: isFa ? 'درصد تحقق فرآیند' : 'Process Performance Rate', field: 'kpi_rate', type: 'display', isReadOnly: true }
      ];
    }

    if (tpl.smartType === 'KPI_OBJECTIVE') {
      return [
        { id: 'field1', label: isFa ? 'عنوان هدف کیفی سازمان' : 'Quality Objective Description', field: 'field1', type: 'text' },
        { id: 'field2', label: isFa ? 'برنامه و اقدام دستیابی' : 'Action and Workprogram', field: 'field2', type: 'textarea' },
        { id: 'field3', label: isFa ? 'واحد مسئول دستیابی' : 'Responsible Department', field: 'field3', type: 'text' },
        { id: 'target', label: isFa ? 'حد هدف' : 'QMS Target Expectation', field: 'target', type: 'number' },
        { id: 'actual', label: isFa ? 'عملکرد واقعی هم‌اکنون' : 'Observed Quality Status', field: 'actual', type: 'number' },
        { id: 'unit', label: isFa ? 'واحد تفصیلی' : 'Unit Of Goal', field: 'unit', type: 'text' },
        { id: 'clauseId', label: isFa ? 'بند مرتبط استاندارد (مثال: 6.2)' : 'Mapped Clause ID', field: 'clauseId', type: 'text' },
        { id: 'kpi_rate', label: isFa ? 'درصد تحقق هدف' : 'Objective Fulfillment Rate', field: 'kpi_rate', type: 'display', isReadOnly: true }
      ];
    }

    if (tpl.smartType === 'SPC') {
      return [
        { id: 'field1', label: isFa ? (tpl.headers[0] || 'نام مشخصه ابعادی/کیفی') : 'Critical Product Characteristic', field: 'field1', type: 'text' },
        { id: 'usl', label: isFa ? (tpl.headers[1] || 'حد بالا رواداری (USL)') : 'Upper Spec Limit (USL)', field: 'usl', type: 'number' },
        { id: 'lsl', label: isFa ? (tpl.headers[2] || 'حد پایین رواداری (LSL)') : 'Lower Spec Limit (LSL)', field: 'lsl', type: 'number' },
        { id: 'measurements', label: isFa ? (tpl.headers[3] || 'اندازه‌گیری‌ها (جدا شده با ویرگول)') : 'Sample Study Log (Comma separated)', field: 'measurements', type: 'text' },
        { id: 'spc_stats', label: isFa ? 'خلاصه آماری متغیرها' : 'Averages Study Summary', field: 'spc_stats', type: 'display', isReadOnly: true },
        { id: 'spc_cpk', label: isFa ? 'شاخص توانمندی فرآیند Cp/Cpk' : 'Machine Capability Index (Cp / Cpk)', field: 'spc_cpk', type: 'display', isReadOnly: true }
      ];
    }

    if (tpl.smartType === 'COQ') {
      return [
        { id: 'coqCategory', label: isFa ? 'دسته‌بندی هزینه‌های کیفیت (PAF)' : 'COQ Category (PAF)', field: 'coqCategory', type: 'select' },
        { id: 'field1', label: isFa ? (tpl.headers[1] || 'شرح هزینه و فعالیت مرتبط کیفی') : 'Activity / Expense Detail', field: 'field1', type: 'text' },
        { id: 'coqAmount', label: isFa ? (tpl.headers[2] || 'مبلغ هزینه واقعی (ریال)') : 'Quality Cost Amount (Rials)', field: 'coqAmount', type: 'number' },
        { id: 'field2', label: isFa ? (tpl.headers[3] || 'دپارتمان / واحد سازمانی اثرپذیر') : 'Impacted Custodian Dept', field: 'field2', type: 'text' },
        { id: 'field3', label: isFa ? (tpl.headers[4] || 'وضعیت اثربخشی کاهش هزینه') : 'Optimization & Effectiveness status', field: 'field3', type: 'text' }
      ];
    }

    if (tpl.smartType === 'MSA') {
      return [
        { id: 'field1', label: isFa ? (tpl.headers[0] || 'نام ابزار اندازه‌گیری / گیج صلب') : 'Measuring Instrument / Gauge Name', field: 'field1', type: 'text' },
        { id: 'evValue', label: isFa ? (tpl.headers[1] || 'تکرارپذیری EV (%)') : 'Equipment Variation EV (%)', field: 'evValue', type: 'number' },
        { id: 'avValue', label: isFa ? (tpl.headers[2] || 'تکثیرپذیری AV (%)') : 'Appraiser Variation AV (%)', field: 'avValue', type: 'number' },
        { id: 'grr', label: isFa ? (tpl.headers[3] || 'میزان انحراف سیستم GR&R (%)') : 'Gauge R&R Error (%)', field: 'grr', type: 'display', isReadOnly: true },
        { id: 'msa_status', label: isFa ? (tpl.headers[4] || 'وضعیت تایید آماری MSA') : 'MSA Verdict status', field: 'msa_status', type: 'display', isReadOnly: true },
        { id: 'ndiv', label: isFa ? 'شاخص تفکیک‌پذیری ndc' : 'Distinct Categories ndc', field: 'ndiv', type: 'number' }
      ];
    }

    if (tpl.smartType === 'DIMENSION') {
      return [
        { id: 'field1', label: isFa ? (tpl.headers[0] || 'کد موقعیت ابعادی نقشه فنی') : 'Drawing Dimension Tag', field: 'field1', type: 'text' },
        { id: 'refValue', label: isFa ? (tpl.headers[1] || 'اندازه اسمی نقشه (میلی‌متر)') : 'Nominal Spec Ref mm', field: 'refValue', type: 'number' },
        { id: 'mpe', label: isFa ? (tpl.headers[2] || 'حد رواداری مجاز (+/-)') : 'Max Tolerance MPE (+/-)', field: 'mpe', type: 'number' },
        { id: 'readValue', label: isFa ? (tpl.headers[3] || 'قرائت اندازه واقعی نمونه') : 'Observed Value mm', field: 'readValue', type: 'number' },
        { id: 'measured_error', label: isFa ? (tpl.headers[4] || 'میزان خطا / انحراف واقعی') : 'Actual Deviation', field: 'measured_error', type: 'display', isReadOnly: true },
        { id: 'calibration_status', label: isFa ? (tpl.headers[5] || 'وضعیت پذیرش فنی کلو') : 'Acceptance QC Status', field: 'calibration_status', type: 'display', isReadOnly: true }
      ];
    }

    if (tpl.smartType === 'PROCESS_MATRIX') {
      return [
        { id: 'field1', label: isFa ? 'عنوان فرآیند' : 'Process Title', field: 'field1', type: 'text' },
        { id: 'field2', label: isFa ? 'نوع فرآیند (COPs/MOPs/SOPs)' : 'Process Type', field: 'field2', type: 'text' },
        { id: 'field3', label: isFa ? 'بندهای استاندارد IATF مرتبط' : 'Associated IATF Clauses', field: 'field3', type: 'textarea' },
        { id: 'field4', label: isFa ? 'الزامات خاص مشتری مرتبط (CSR)' : 'Associated Customer Specific Requirements (CSR)', field: 'field4', type: 'textarea' },
        { id: 'field5', label: isFa ? 'شاخص عملکردی (KPI)' : 'Process KPI', field: 'field5', type: 'text' },
        { id: 'field6', label: isFa ? 'وضعیت انطباق سیستمی' : 'System Compliance Status', field: 'field6', type: 'text' }
      ];
    }

    if (tpl.smartType === 'INTERNAL_AUDIT') {
      return [
        { id: 'field1', label: isFa ? 'شناسه فرآیند ممیزی' : 'Audit Process ID', field: 'field1', type: 'text' },
        { id: 'field2', label: isFa ? 'محدوده و گام‌های عملیاتی تحت ممیزی' : 'Process Scope under Audit', field: 'field2', type: 'textarea' },
        { id: 'field3', label: isFa ? 'بند ممیزی سیستم IATF 16949' : 'Target Standards/Cl', field: 'field3', type: 'text' },
        { id: 'field4', label: isFa ? 'سوالات کلیدی و چک لیست ممیزی' : 'Audit Checklist Questions', field: 'field4', type: 'textarea' },
        { id: 'field5', label: isFa ? 'شواهد عینی مشاهده شده کارگاهی / یافته‌ها' : 'Objective Audit Evidence / Findings', field: 'field5', type: 'textarea' },
        { id: 'field6', label: isFa ? 'مغایرت کشف شده (انحراف غیرمنطبق NC)' : 'Non-Conformance (NC) Details', field: 'field6', type: 'textarea' },
        { id: 'field7', label: isFa ? 'شدت مغایرت (عمده Major / جزئی Minor)' : 'NC Classification', field: 'field7', type: 'text' },
        { id: 'field8', label: isFa ? 'وضعیت نهایی ممیزی (منطبق / غیرمنطبق)' : 'Audit Verdict status', field: 'field8', type: 'text' }
      ];
    }
  }

  const genericHeaders = (tpl as any)?.headers || [];
  if (genericHeaders.length > 0) {
    return genericHeaders.map((hdr: string, idx: number) => ({
      id: `field${idx + 1}`,
      field: `field${idx + 1}`,
      label: hdr
    }));
  }

  return [];
}

/**
 * Exports a specific custom document from the documents_table to its own Excel file.
 * Fulfills rule #2: If the document is empty, exports the header row.
 */
export function exportCustomDocToExcel(docName: string) {
  const rawData = QmsDatabase.selectRow<any[]>('documents_table', docName) || [];
  let items = rawData;
  if (items.length === 0) {
    try {
      const draftItemsRaw = localStorage.getItem(`iatf_draft_items_${docName}`);
      if (draftItemsRaw) {
        items = JSON.parse(draftItemsRaw);
      }
    } catch {}
  }

  const columns = getDocColumns(docName);

  const rows: any[] = [];
  items.forEach((item: any) => {
    const flatRow: Record<string, any> = {};
    flatRow['id'] = item.id || '';
    flatRow['index'] = item.index !== undefined ? item.index : '';
    
    columns.forEach(col => {
      const val = item[col.field] !== undefined ? item[col.field] : item[col.id];
      if (val !== undefined) {
        flatRow[col.label] = val;
      } else {
        flatRow[col.label] = '';
      }
    });

    Object.keys(item).forEach(prop => {
      if (!['id', 'index', 'image'].includes(prop) && !prop.endsWith('_fk')) {
        const mappedCol = columns.find(c => c.field === prop || c.id === prop);
        if (!mappedCol) {
          flatRow[prop] = item[prop];
        }
      }
    });
    rows.push(flatRow);
  });

  // Rule #2 fulfillment: If document is empty, design and columns export
  if (rows.length === 0) {
    const emptyRow: Record<string, any> = {};
    emptyRow['id'] = '';
    emptyRow['index'] = '';
    if (columns && columns.length > 0) {
      columns.forEach(c => {
        emptyRow[c.label] = '';
      });
    } else {
      emptyRow['field1'] = '';
      emptyRow['field2'] = '';
    }
    rows.push(emptyRow);
  }

  const worksheet = XLSX.utils.json_to_sheet(cleanExportRows(rows));
  autofitColumns(worksheet);
  const workbook = XLSX.utils.book_new();
  
  let cleanSheetName = docName.replace(/[\[\]\*\?\:\/\\ ]/g, '_').substring(0, 31);
  if (!cleanSheetName) cleanSheetName = "Sheet1";
  
  XLSX.utils.book_append_sheet(workbook, worksheet, cleanSheetName);
  
  const formattedDate = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `${docName.replace(/\s+/g, '_')}_${formattedDate}.xlsx`);
}

/**
 * Creates a single Excel file containing only the explicitly checked tables or custom documents
 */
export function exportSelectiveTablesToExcel(selectedTables: string[], selectedCustomDocs: string[]) {
  const workbook = XLSX.utils.book_new();
  let sheetsCount = 0;

  selectedTables.forEach(tableName => {
    const flatData = getFlatTableData(tableName);
    const worksheet = XLSX.utils.json_to_sheet(cleanExportRows(flatData));
    autofitColumns(worksheet);
    
    let sheetName = tableName;
    if (tableName === 'documents_table') sheetName = 'DB_All_Custom_Docs';
    if (tableName === 'document_control_table') sheetName = 'DB_Doc_Control_ISO9001';
    if (tableName === 'indicators_table') sheetName = 'DB_KPI_Indicators';
    if (tableName === 'clause_links_table') sheetName = 'DB_Clause_Links';
    if (tableName === 'records_table') sheetName = 'DB_Records_Store';
    if (tableName === 'csr_mappings_table') sheetName = 'DB_CSR_Mappings';
    if (tableName === 'process_mappings_table') sheetName = 'DB_Process_Matrix';
    if (tableName === 'kpi_vars_table') sheetName = 'DB_KPI_Variables';
    
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));
    sheetsCount++;
  });

  selectedCustomDocs.forEach(docName => {
    let items = QmsDatabase.selectRow<any[]>('documents_table', docName) || [];
    if (items.length === 0) {
      try {
        const draftItemsRaw = localStorage.getItem(`iatf_draft_items_${docName}`);
        if (draftItemsRaw) {
          items = JSON.parse(draftItemsRaw);
        }
      } catch {}
    }

    const columns = getDocColumns(docName);

    const rows: any[] = [];
    items.forEach((item: any) => {
      const flatRow: Record<string, any> = {};
      flatRow['id'] = item.id || '';
      flatRow['index'] = item.index !== undefined ? item.index : '';
      
      columns.forEach(col => {
        const val = item[col.field] !== undefined ? item[col.field] : item[col.id];
        if (val !== undefined) {
          flatRow[col.label] = val;
        } else {
          flatRow[col.label] = '';
        }
      });

      Object.keys(item).forEach(prop => {
        if (!['id', 'index', 'image'].includes(prop) && !prop.endsWith('_fk')) {
          const mappedCol = columns.find(c => c.field === prop || c.id === prop);
          if (!mappedCol) {
            flatRow[prop] = item[prop];
          }
        }
      });
      rows.push(flatRow);
    });

    // Rule #2
    if (rows.length === 0) {
      const emptyRow: Record<string, any> = {};
      emptyRow['id'] = '';
      emptyRow['index'] = '';
      if (columns && columns.length > 0) {
        columns.forEach(c => {
          emptyRow[c.label] = '';
        });
      } else {
        emptyRow['field1'] = '';
      }
      rows.push(emptyRow);
    }

    const worksheet = XLSX.utils.json_to_sheet(cleanExportRows(rows));
    autofitColumns(worksheet);
    
    let cleanSheetName = docName.replace(/[\[\]\*\?\:\/\\ ]/g, '_').substring(0, 31);
    if (!cleanSheetName) cleanSheetName = `Doc_${sheetsCount + 1}`;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, cleanSheetName);
    sheetsCount++;
  });

  if (sheetsCount === 0) {
    throw new Error("No tables or documents were selected for export.");
  }

  const formattedDate = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `QMS_SELECTIVE_EXPORT_${formattedDate}.xlsx`);
}
