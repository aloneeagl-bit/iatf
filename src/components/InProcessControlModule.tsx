import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles, Layers, Sliders, Database, CheckCircle2, AlertTriangle, XCircle, Plus,
  Trash2, Edit3, ArrowUp, ArrowDown, Eye, FileText, Printer, ShieldCheck,
  Cpu, RefreshCw, Filter, Search, ChevronDown, ChevronUp, Link2, Activity,
  Zap, BarChart2, FileSpreadsheet, Lock, UserCheck, AlertCircle, Wrench,
  Gauge, ClipboardCheck, ArrowUpRight, Copy, Check, Building, FileCheck,
  History, Settings, Play, X, Tag, Shield, Pin, Clock, Grid, Download,
  Maximize2, Minimize2, ChevronRight, ChevronLeft, Columns, HelpCircle, Package, BookmarkPlus
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart as RePieChart, Pie, Cell
} from 'recharts';
import { QmsDatabase } from '../lib/qmsDatabase';

interface InProcessControlModuleProps {
  lang?: string;
  onOpenCorrectiveActions?: () => void;
  onPinToDashboard?: () => void;
}

// -----------------------------------------------------------------------------
// TYPES & INTERFACES
// -----------------------------------------------------------------------------

export interface ControlChecklistItem {
  id: string;
  blockId: string;
  paramName: string;
  specType: 'SC' | 'CC' | 'Standard';
  controlMethod: string;
  gaugeEquipment: string;
  gaugeStatus: 'valid' | 'expired' | 'warning' | 'unknown';
  sampleSize: string;
  frequency: string;
  targetValue: string;
  lowerLimit: number | null;
  upperLimit: number | null;
  unit: string;
  acceptLimit: string;
  rejectLimit: string;
  reactionPlan: string;
  controllerRole: string;
  recordingType: 'Variable' | 'Attribute' | 'Visual';
  status: 'active' | 'needs_review' | 'proposed_add' | 'proposed_edit' | 'proposed_delete';
  traceability: {
    sourceTable: string;
    sourceColumn: string;
    referenceRecord: string;
    aiSelectionReason: string;
  };
  // Hourly inspection measurements per time slot (e.g. { "08:00": "32.04", "10:00": "32.05" })
  hourlySlots?: Record<string, string>;
  // Direct result logging inside the block checklist
  latestResult?: 'pass' | 'fail' | 'pending';
  latestMeasuredVal?: string;
  operatorNotes?: string;
}

export interface ControlBlock {
  id: string;
  title: string;
  category: string;
  iconName: string;
  color: string;
  isMandatory: boolean;
  order: number;
  isExpanded: boolean;
  stationId?: string;
  stationCode?: string;
  stationName?: string;
  processName?: string;
  operationName?: string;
  equipmentList?: string[];
  inputItems?: string[];
  outputProduct?: string;
  machineNo?: string;
  fixtureNo?: string;
  shiftNo?: string;
  inspectionIntervalHours?: number;
  timeSlots?: string[];
  dbBinding: {
    tableName: string;
    sourceColumn: string;
    displayRule: string;
  };
  items: ControlChecklistItem[];
}

export interface WorkstationRecord {
  id: string;
  stationCode: string;
  stationName: string;
  processName: string;
  operationName: string;
  equipmentList: string[];
  inputItems: string[];
  outputProduct: string;
  machineNo?: string;
  fixtureNo?: string;
}

export interface LoggedControlResult {
  id: string;
  checklistItemId: string;
  blockTitle: string;
  paramName: string;
  specType: 'SC' | 'CC' | 'Standard';
  targetValue: string;
  lowerLimit: number | null;
  upperLimit: number | null;
  unit: string;
  result: 'pass' | 'fail' | 'pending';
  measuredValue: string;
  isOutOfSpec: boolean;
  operatorName: string;
  inspectorName: string;
  date: string;
  time: string;
  shiftNo: string;
  batchNo: string;
  lotNo: string;
  machineNo: string;
  gaugeNo: string;
  timeSlot?: string;
  remarks: string;
  defectCause: string;
  correctiveAction: string;
  reactionPlan: string;
  capaCreated: boolean;
  escalated: boolean;
}

export interface AiDataSource {
  id: string;
  name: string;
  type: 'Table' | 'View';
  tableName: string;
  description: string;
  usingModules: string[];
  connectionStatus: 'Connected' | 'Disconnected' | 'Needs Mapping';
  lastSync: string;
  columnCount: number;
  dependentRulesCount: number;
  columnMappings: Array<{ sourceCol: string; targetField: string }>;
}

export interface RevisionHistoryRecord {
  id: string;
  version: string;
  date: string;
  author: string;
  changesSummary: string;
  approvedBy: string;
  status: 'Approved' | 'Draft' | 'Archived';
  itemCount: number;
}

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export default function InProcessControlModule({
  lang = 'fa',
  onOpenCorrectiveActions,
  onPinToDashboard
}: InProcessControlModuleProps) {
  const isRtl = lang === 'fa';

  // ---------------------------------------------------------------------------
  // STATE DEFINITIONS
  // ---------------------------------------------------------------------------

  // Module Pinning State
  const [isPinned, setIsPinned] = useState<boolean>(false);

  // Selection Filters State
  const [productsList, setProductsList] = useState<Array<{ name: string; partNo: string }>>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [selectedPartNo, setSelectedPartNo] = useState<string>('');
  const [selectedProcess, setSelectedProcess] = useState<string>('');
  const [selectedOperation, setSelectedOperation] = useState<string>('');

  // Workstations State
  const [workstations, setWorkstations] = useState<WorkstationRecord[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [selectedRevision, setSelectedRevision] = useState<string>('1.0');

  // Active View Tab State
  const [activeTab, setActiveTab] = useState<'checklist' | 'results' | 'ai_sources' | 'dashboard' | 'history'>('checklist');

  // Control Blocks & Checklist State
  const [blocks, setBlocks] = useState<ControlBlock[]>([]);
  const [activeBlockForEdit, setActiveBlockForEdit] = useState<ControlBlock | null>(null);
  const [isBlockSettingsOpen, setIsBlockSettingsOpen] = useState<boolean>(false);

  // Hourly Inspection Rounds Settings State
  const [inspectionIntervalHours, setInspectionIntervalHours] = useState<number>(2); // Default every 2 hours
  const [shiftDurationHours, setShiftDurationHours] = useState<number>(8); // Default 8 hours
  const [timeSlots, setTimeSlots] = useState<string[]>(['08:00', '10:00', '12:00', '14:00']);

  // Results & Shop Floor Logging Metadata
  const [loggedResults, setLoggedResults] = useState<LoggedControlResult[]>([]);
  const [shiftNo, setShiftNo] = useState<string>('');
  const [activeInspector, setActiveInspector] = useState<string>('');
  const [activeOperator, setActiveOperator] = useState<string>('');
  const [batchNo, setBatchNo] = useState<string>('');
  const [lotNo, setLotNo] = useState<string>('');

  // Manual Add Workstation Modal State
  const [isAddStationModalOpen, setIsAddStationModalOpen] = useState<boolean>(false);
  const [newStationForm, setNewStationForm] = useState<{
    stationCode: string;
    stationName: string;
    processName: string;
    operationName: string;
    equipmentInput: string;
    inputItemsInput: string;
    outputProduct: string;
    machineNo: string;
    fixtureNo: string;
  }>({
    stationCode: '',
    stationName: '',
    processName: '',
    operationName: '',
    equipmentInput: '',
    inputItemsInput: '',
    outputProduct: '',
    machineNo: '',
    fixtureNo: ''
  });

  // AI Data Sources State
  const [aiDataSources, setAiDataSources] = useState<AiDataSource[]>([]);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState<boolean>(false);
  const [newSourceForm, setNewSourceForm] = useState<{
    name: string;
    type: 'Table' | 'View';
    tableName: string;
    description: string;
  }>({ name: '', type: 'Table', tableName: '', description: '' });

  // Column Management Modal State (Replaces window.prompt for browser/iframe compatibility)
  const [columnModalState, setColumnModalState] = useState<{
    isOpen: boolean;
    mode: 'add_single' | 'add_global' | 'delete_single' | 'delete_global';
    blockId?: string;
    columnName: string;
    selectedSlotToDelete: string;
  }>({
    isOpen: false,
    mode: 'add_global',
    columnName: '۱۶:۰۰',
    selectedSlotToDelete: ''
  });

  // Rule Engine Subtab & State
  const [aiSubTab, setAiSubTab] = useState<'sources' | 'rules'>('sources');
  const [ruleEngineRules, setRuleEngineRules] = useState<{
    id: string;
    name: string;
    category: string;
    conditionText: string;
    actionText: string;
    targetSource: string;
    isActive: boolean;
  }>([
    {
      id: 'rule_cc',
      name: 'قاعده ۱: اجباری‌سازی کنترل ویژگی‌های بحرانی (CC / Critical Characteristics)',
      category: 'مشخصه‌های ویژه (CC)',
      conditionText: 'اگر مشخصه فنی از نوع CC (Critical) باشد یا RPN > 100 باشد',
      actionText: 'افزودن خودکار Reaction Plan، الزام ثبت متغیر با مقدار عددی و نمونه‌گیری ۱۰۰٪ یا فرکانس ۱ ساعته',
      targetSource: 'Control Plan & PFMEA',
      isActive: true
    },
    {
      id: 'rule_csr',
      name: 'قاعده ۲: اعمال خودکار الزامات ویژه مشتری (CSR / Customer Specifics)',
      category: 'الزامات مشتری (CSR)',
      conditionText: 'اگر محصول تولیدی دارای سند CSR فعال در سیستم QMS باشد',
      actionText: 'ایجاد بلوک اختصاصی چک‌لیست CSR با پارامترهای تایید تحویل و بسته‌بندی ویژه مشتری',
      targetSource: 'Customer Requirements (CSR)',
      isActive: true
    },
    {
      id: 'rule_pfmea',
      name: 'قاعده ۳: کنترل ریسک‌های بالای PFMEA و حالت‌های خرابی بحرانی',
      category: 'ریسک PFMEA',
      conditionText: 'اگر حالت خرابی در PFMEA دارای رتبه شدت (Severity) >= 8 باشد',
      actionText: 'افزودن کنترل پیشگیرانه Poka-Yoke و چک‌لیست ثبت نتیجه مجزای اپراتور با امضای تایید',
      targetSource: 'PFMEA Table',
      isActive: true
    },
    {
      id: 'rule_gauge',
      name: 'قاعده ۴: اعتبارسنجی خودکار کالیبراسیون تجهیزات و ابزار گیج',
      category: 'ابزار و کالیبراسیون',
      conditionText: 'اگر وضعیت اعتبار کالیبراسیون گیج منقضی شده یا ناکافی باشد',
      actionText: 'تغییر وضعیت گیج به هشدار قرمز، صادر کردن درخواست کالیبراسیون فوری و پیشنهاد گیج جایگزین',
      targetSource: 'Calibration & Gauges DB',
      isActive: true
    },
    {
      id: 'rule_pm',
      name: 'قاعده ۵: هشدار PM معوق و شرایط فنی ماشین‌الات',
      category: 'نگهداری و تعمیرات (PM)',
      conditionText: 'اگر سرویس PM معوق برای ماشین یا قالب وجود داشته باشد',
      actionText: 'افزودن آیتم کنترلی پارامترهای فیزیکی ماشین (دما/فشار/سایش) به بلوک تجهیزات',
      targetSource: 'Preventative Maintenance (PM)',
      isActive: true
    }
  ]);

  // Missing Table AI Alert Modal State
  const [missingTableAlert, setMissingTableAlert] = useState<{
    name: string;
    reason: string;
    expectedData: string;
    usingModule: string;
    status: string;
  } | null>(null);
  const [isDbMapperModalOpen, setIsDbMapperModalOpen] = useState<boolean>(false);

  // AI Generation State
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);

  // Print & Print Customizer State (Full Screen Modal)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isPrintConfigPanelOpen, setIsPrintConfigPanelOpen] = useState<boolean>(false);
  const [activeDbPickerTab, setActiveDbPickerTab] = useState<'products' | 'docs' | 'orgs' | 'signers' | null>(null);
  const [printMode, setPrintMode] = useState<'single' | 'bulk'>('single');
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('landscape');
  const [printOrgName, setPrintOrgName] = useState<string>('شرکت صنعتی تولید قطعات خودرویی (ISO/IATF 16949)');
  const [printDocCode, setPrintDocCode] = useState<string>('QMS-IPC-FRM-085');
  const [printReportTitle, setPrintReportTitle] = useState<string>('شناسنامه و چک‌لیست کنترل حین تولید ایستگاه کاری');
  const [printSigner1Name, setPrintSigner1Name] = useState<string>('کارشناس کنترل کیفیت');
  const [printSigner2Name, setPrintSigner2Name] = useState<string>('سرپرست خط تولید');
  const [printSigner3Name, setPrintSigner3Name] = useState<string>('مدیر تضمین کیفیت');
  const [printLogoUrl, setPrintLogoUrl] = useState<string>(() => {
    try { return localStorage.getItem('qms_company_logo') || ''; } catch (e) { return ''; }
  });

  const getQmsDbPrintData = () => {
    let products: Array<{ name: string; partNo: string; source: string }> = [];
    try {
      const rawProds = localStorage.getItem('qms_products');
      if (rawProds) {
        const parsed = JSON.parse(rawProds);
        if (Array.isArray(parsed)) {
          parsed.forEach((p: any) => {
            if (p && (p.name || p.title)) {
              products.push({
                name: p.name || p.title,
                partNo: p.partNo || p.code || p.partNumber || '',
                source: 'جدول محصولات QMS'
              });
            }
          });
        }
      }
    } catch (e) {}

    try {
      const wsData = QmsDatabase.selectAll(QmsDatabase.TABLES.WORKSTATIONS);
      if (wsData && typeof wsData === 'object') {
        Object.values(wsData).forEach((w: any) => {
          if (w && (w.productName || w.partNo)) {
            products.push({
              name: w.productName || w.stationName || 'ایستگاه کاری',
              partNo: w.partNo || w.stationCode || '',
              source: 'دیتابیس ایستگاه‌های کاری'
            });
          }
        });
      }
    } catch (e) {}

    const uniqueProducts = Array.from(
      new Map(products.map(p => [p.name + '___' + p.partNo, p])).values()
    );

    let docControls: Array<{ code: string; title: string; revision: string; status: string }> = [];
    try {
      const docCtrlMap = QmsDatabase.selectAll(QmsDatabase.TABLES.DOCUMENT_CONTROL);
      if (docCtrlMap && typeof docCtrlMap === 'object') {
        Object.values(docCtrlMap).forEach((d: any) => {
          if (d && (d.code || d.docCode || d.title || d.docTitle)) {
            docControls.push({
              code: d.code || d.docCode || 'QMS-IPC-FRM-085',
              title: d.title || d.docTitle || 'شناسنامه و چک‌لیست کنترل حین تولید',
              revision: d.revision || d.rev || '1.0',
              status: d.status || 'مصوب و فعال'
            });
          }
        });
      }
    } catch (e) {}

    let orgs: Array<{ name: string; code?: string }> = [];
    try {
      const rawOrgs = localStorage.getItem('qms_organizations');
      if (rawOrgs) {
        const parsed = JSON.parse(rawOrgs);
        if (Array.isArray(parsed)) {
          parsed.forEach((o: any) => {
            if (o && o.name) orgs.push({ name: o.name, code: o.code });
          });
        }
      }
    } catch (e) {}

    let personnel: Array<{ name: string; role: string }> = [];
    try {
      const rawUsers = localStorage.getItem('qms_users');
      if (rawUsers) {
        const parsed = JSON.parse(rawUsers);
        if (Array.isArray(parsed)) {
          parsed.forEach((u: any) => {
            if (u && (u.username || u.fullName)) {
              personnel.push({
                name: u.fullName || u.username,
                role: u.role === 'admin' ? 'مدیر ارشد کیفیت' : 'کارشناس کیفی (ممیز)'
              });
            }
          });
        }
      }
    } catch (e) {}

    return {
      products: uniqueProducts,
      docControls: docControls.length > 0 ? docControls : [{ code: 'QMS-IPC-FRM-085', title: 'شناسنامه و چک‌لیست کنترل حین تولید', revision: '1.0', status: 'مصوب' }],
      orgs,
      personnel
    };
  };

  const handleAutoDetectQmsDbData = () => {
    const data = getQmsDbPrintData();
    let loadedItems: string[] = [];

    if (data.products.length > 0) {
      const firstP = data.products[0];
      if (firstP.name) setSelectedProduct(firstP.name);
      if (firstP.partNo) setSelectedPartNo(firstP.partNo);
      loadedItems.push(`محصول: ${firstP.name}`);
    }

    if (data.docControls.length > 0) {
      const firstDoc = data.docControls[0];
      setPrintDocCode(firstDoc.code);
      setSelectedRevision(firstDoc.revision);
      loadedItems.push(`کد سند: ${firstDoc.code}`);
    }

    if (data.orgs.length > 0) {
      setPrintOrgName(data.orgs[0].name);
      loadedItems.push(`سازمان: ${data.orgs[0].name}`);
    }

    if (data.personnel.length > 0) {
      if (data.personnel[0]?.name) setPrintSigner1Name(data.personnel[0].name);
      if (data.personnel[1]?.name) setPrintSigner2Name(data.personnel[1].name);
      if (data.personnel[2]?.name) setPrintSigner3Name(data.personnel[2].name);
      loadedItems.push(`امضاکنندگان: ${data.personnel.map(p => p.name).join('، ')}`);
    }

    showToast(loadedItems.length > 0 ? 'شناسایی و استخراج خودکار اطلاعات دیتابیس QMS با موفقیت انجام شد.' : 'اطلاعات دیتابیس بازیابی شد.', 'success');
  };

  const handleSavePdfToRecordsLedger = () => {
    try {
      const folderName = "سوابق کنترل حین تولید (In-Process Control)";
      const recordId = `rec_ipc_${Date.now()}`;
      const stationName = currentStation?.stationName || selectedStationId;
      const docTitle = `${printReportTitle || 'شناسنامه و چک‌لیست کنترل حین تولید'} - ${stationName}`;
      const docCode = printDocCode || 'QMS-IPC-FRM-085';
      const rev = selectedRevision || '1.0';
      const archiveDate = new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

      const newRecord = {
        id: recordId,
        folder: folderName,
        documentName: docTitle,
        clauseId: '8.5.1.1',
        code: docCode,
        revision: rev,
        version: rev,
        preparedBy: printSigner1Name || 'کارشناس کنترل کیفیت',
        approvedBy: printSigner3Name || printSigner2Name || 'مدیر کیفیت',
        archivedAt: archiveDate,
        timestamp: Date.now(),
        isPdfSaved: true,
        pdfFileName: `${docCode}_Rev${rev}_${Date.now()}.pdf`,
        items: blocks.flatMap(b => b.items.map(item => ({
          blockTitle: b.title,
          paramName: item.paramName,
          specType: item.specType,
          controlMethod: item.controlMethod,
          gaugeEquipment: item.gaugeEquipment,
          targetValue: item.targetValue,
          lowerLimit: item.lowerLimit,
          upperLimit: item.upperLimit,
          unit: item.unit,
          hourlySlots: item.hourlySlots || {},
          latestResult: item.latestResult || 'pending'
        })))
      };

      QmsDatabase.writeRow(QmsDatabase.TABLES.RECORDS, recordId, newRecord);

      showToast(`✅ نسخه PDF و شناسنامه سابقه با موفقیت در پوشه "${folderName}" در لیست سوابق (Records Ledger) ذخیره گردید.`, 'success');

      // Trigger browser print
      window.print();
    } catch (e) {
      console.error('Failed to save record:', e);
      showToast('خطا در ذخیره سابقه در دیتابیس!', 'warning');
    }
  };

  // Dynamic Header/Footer DB Field Selectors
  const [headerFields, setHeaderFields] = useState<string[]>([
    'شرکت / کارخانه', 'نام محصول', 'شماره قطعه', 'ایستگاه کاری', 'نام فرآیند', 'شماره سند', 'نسخه', 'تاریخ', 'شیفت'
  ]);
  const [footerFields, setFooterFields] = useState<string[]>([
    'اپراتور ایستگاه', 'بازرس کیفیت', 'تأییدکننده', 'کد QR ردیابی', 'وضعیت سند'
  ]);

  // Revision History & Proposed Changes State
  const [revisions, setRevisions] = useState<RevisionHistoryRecord[]>([]);
  const [hasPendingProposedChanges, setHasPendingProposedChanges] = useState<boolean>(false);

  // Toast Banner Notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // ---------------------------------------------------------------------------
  // INITIALIZATION & DATABASE SYNC
  // ---------------------------------------------------------------------------

  // Generate hourly time slots based on inspection interval and shift duration
  useEffect(() => {
    const slots: string[] = [];
    const totalSlots = Math.floor(shiftDurationHours / Math.max(1, inspectionIntervalHours));
    let currentHour = 8; // Shift starts at 08:00

    for (let i = 0; i < totalSlots; i++) {
      const hh = String(currentHour).padStart(2, '0');
      slots.push(`${hh}:00`);
      currentHour += inspectionIntervalHours;
    }
    setTimeSlots(slots.length > 0 ? slots : ['08:00', '10:00', '12:00', '14:00']);
  }, [inspectionIntervalHours, shiftDurationHours]);

  // Load Products, Workstations & AI Data Sources
  useEffect(() => {
    try {
      // 1. Products
      const rawProducts = localStorage.getItem('qms_products');
      let prodsArr: Array<{ name: string; partNo: string }> = [];
      if (rawProducts) {
        const parsed = JSON.parse(rawProducts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          prodsArr = parsed.map((p: any) => ({
            name: p.name || p.title || '',
            partNo: p.partNo || p.code || p.partNumber || ''
          })).filter(p => p.name);
        }
      }
      setProductsList(prodsArr);
      if (prodsArr.length > 0) {
        setSelectedProduct(prodsArr[0].name);
        setSelectedPartNo(prodsArr[0].partNo);
      } else {
        setSelectedProduct('');
        setSelectedPartNo('');
      }

      // 2. Workstations from QmsDatabase & LocalStorage
      const wsMap = QmsDatabase.selectAll(QmsDatabase.TABLES.WORKSTATIONS);
      let loadedStations: WorkstationRecord[] = [];

      if (wsMap && typeof wsMap === 'object' && Object.keys(wsMap).length > 0) {
        Object.entries(wsMap).forEach(([id, obj]: [string, any]) => {
          if (obj) {
            loadedStations.push({
              id,
              stationCode: obj.stationCode || id,
              stationName: obj.stationName || obj.title || `ایستگاه ${id}`,
              processName: obj.processName || '',
              operationName: obj.operationName || '',
              equipmentList: Array.isArray(obj.equipmentList) ? obj.equipmentList : [],
              inputItems: Array.isArray(obj.inputItems) ? obj.inputItems : [],
              outputProduct: obj.outputProduct || '',
              machineNo: obj.machineNo || '',
              fixtureNo: obj.fixtureNo || ''
            });
          }
        });
      }

      const rawCustomStations = localStorage.getItem('qms_custom_workstations');
      if (rawCustomStations) {
        const parsedCustom = JSON.parse(rawCustomStations);
        if (Array.isArray(parsedCustom)) {
          loadedStations = [...loadedStations, ...parsedCustom];
        }
      }

      setWorkstations(loadedStations);
      if (loadedStations.length > 0) {
        setSelectedStationId(loadedStations[0].id);
      } else {
        setSelectedStationId('');
      }

      // 3. AI Data Sources (All 11 QMS Sources)
      const savedSources = localStorage.getItem('qms_ai_data_sources');
      if (savedSources) {
        setAiDataSources(JSON.parse(savedSources));
      } else {
        const defaultSources: AiDataSource[] = [
          {
            id: 'src_cp',
            name: '۱. طرح کنترل (Control Plan - منبع اصلی)',
            type: 'Table',
            tableName: QmsDatabase.TABLES.DOCUMENTS,
            description: 'استخراج مشخصه‌های کنترلی، SC/CC، روش کنترل، ابزار اندازه‌گیری، گیج، اندازه نمونه، فرکانس، حدود پذیرش/رد، Reaction Plan، مسئول کنترل و نوع ثبت نتایج',
            usingModules: ['کنترل حین تولید', 'Control Plan', 'Audit'],
            connectionStatus: 'Connected',
            lastSync: new Date().toLocaleDateString('fa-IR'),
            columnCount: 14,
            dependentRulesCount: 12,
            columnMappings: []
          },
          {
            id: 'src_pfd',
            name: '۲. نمودار جریان فرآیند (PFD - Process Flow Diagram)',
            type: 'Table',
            tableName: 'pfd_operations_table',
            description: 'استخراج فرآیند، عملیات، شماره عملیات، ترتیب عملیات، ایستگاه کاری و ماشین متناظر',
            usingModules: ['کنترل حین تولید', 'PFD Engine'],
            connectionStatus: 'Connected',
            lastSync: new Date().toLocaleDateString('fa-IR'),
            columnCount: 8,
            dependentRulesCount: 6,
            columnMappings: []
          },
          {
            id: 'src_pfmea',
            name: '۳. آنالیز حالات و آثار خطای فرآیند (PFMEA)',
            type: 'Table',
            tableName: 'pfmea_risks_table',
            description: 'استخراج ریسک‌های فرآیند، حالت‌های خرابی، علل خرابی، کنترل‌های پیشگیرانه، کنترل‌های کشف و اقدامات پیشنهادی',
            usingModules: ['کنترل حین تولید', 'PFMEA Risk Module'],
            connectionStatus: 'Connected',
            lastSync: new Date().toLocaleDateString('fa-IR'),
            columnCount: 12,
            dependentRulesCount: 9,
            columnMappings: []
          },
          {
            id: 'src_swi',
            name: '۴. دستورالعمل کاری استاندارد (SWI - Standard Work Instruction)',
            type: 'Table',
            tableName: 'swi_instructions_table',
            description: 'منبع اطلاعاتی جهت استخراج مراحل عملیات، تصاویر راهنما، پارامترهای فرآیند، هشدارهای کیفیت و ایمنی',
            usingModules: ['کنترل حین تولید', 'SWI Viewer'],
            connectionStatus: 'Connected',
            lastSync: new Date().toLocaleDateString('fa-IR'),
            columnCount: 10,
            dependentRulesCount: 4,
            columnMappings: []
          },
          {
            id: 'src_equip',
            name: '۵. بانک تجهیزات و ابزارآلات (Equipment & Tooling DB)',
            type: 'Table',
            tableName: 'workstation_equipment_table',
            description: 'استخراج مشخصات ماشین، ابزار برشی/شکل‌دهی، فیکسچر، قالب و شماره اموال تجهیزات',
            usingModules: ['کنترل حین تولید', 'PM & Tooling'],
            connectionStatus: 'Connected',
            lastSync: new Date().toLocaleDateString('fa-IR'),
            columnCount: 9,
            dependentRulesCount: 7,
            columnMappings: []
          },
          {
            id: 'src_gauge',
            name: '۶. ابزار کنترلی و کالیبراسیون (Calibration & Gauges)',
            type: 'Table',
            tableName: 'gauges_calibration_table',
            description: 'استخراج شماره گیج، وضعیت اعتبار کالیبراسیون، تاریخ انقضا و گواهینامه صحت',
            usingModules: ['کنترل حین تولید', 'Calibration Module'],
            connectionStatus: 'Connected',
            lastSync: new Date().toLocaleDateString('fa-IR'),
            columnCount: 7,
            dependentRulesCount: 8,
            columnMappings: []
          },
          {
            id: 'src_pm',
            name: '۷. نگهداری و تعمیرات پیشگیرانه (PM System)',
            type: 'Table',
            tableName: 'preventative_maintenance_table',
            description: 'پایش وضعیت ماشین، سرویس‌های PM معوق و هشدارهای فنی تعمیراتی',
            usingModules: ['کنترل حین تولید', 'PM Service'],
            connectionStatus: 'Connected',
            lastSync: new Date().toLocaleDateString('fa-IR'),
            columnCount: 6,
            dependentRulesCount: 5,
            columnMappings: []
          },
          {
            id: 'src_materials',
            name: '۸. مواد اولیه و اقلام ورودی (Raw Materials & Inputs)',
            type: 'Table',
            tableName: 'station_inputs_table',
            description: 'استخراج نوع ماده، گرید فنی، شماره بچ ورودی، برچسب QC و وضعیت تأییدیه آنالیز',
            usingModules: ['کنترل حین تولید', 'IQC'],
            connectionStatus: 'Connected',
            lastSync: new Date().toLocaleDateString('fa-IR'),
            columnCount: 8,
            dependentRulesCount: 6,
            columnMappings: []
          },
          {
            id: 'src_csr',
            name: '۹. الزامات ویژه مشتری (CSR - Customer Specific Requirements)',
            type: 'Table',
            tableName: 'customer_csr_table',
            description: 'استخراج کنترل‌های ویژه مشتری، مشخصه‌های خاص و الزامات بسته‌بندی و تحویل',
            usingModules: ['کنترل حین تولید', 'CSR Portal'],
            connectionStatus: 'Connected',
            lastSync: new Date().toLocaleDateString('fa-IR'),
            columnCount: 8,
            dependentRulesCount: 7,
            columnMappings: []
          },
          {
            id: 'src_ncr',
            name: '۱۰. عدم انطباق‌ها و اقدامات اصلاحی (NCR / CAPA System)',
            type: 'Table',
            tableName: 'ncr_capa_records_table',
            description: 'پایش عدم انطباق‌های مرتبط قبلی، انحرافات کیفیت و اقدامات اصلاحی باز ایستگاه',
            usingModules: ['کنترل حین تولید', 'CAPA System'],
            connectionStatus: 'Connected',
            lastSync: new Date().toLocaleDateString('fa-IR'),
            columnCount: 11,
            dependentRulesCount: 8,
            columnMappings: []
          },
          {
            id: 'src_lessons',
            name: '۱۱. بانک دانش و تجربیات گذشته (Lessons Learned DB)',
            type: 'Table',
            tableName: 'lessons_learned_table',
            description: 'استخراج خطاهای پرتکرار، تجربیات گذشته تولید و هشدارهای کیفی پیشگیرانه',
            usingModules: ['کنترل حین تولید', 'Knowledge Base'],
            connectionStatus: 'Connected',
            lastSync: new Date().toLocaleDateString('fa-IR'),
            columnCount: 6,
            dependentRulesCount: 4,
            columnMappings: []
          }
        ];
        setAiDataSources(defaultSources);
        localStorage.setItem('qms_ai_data_sources', JSON.stringify(defaultSources));
      }

      // 4. Load Revision History
      const savedRevisions = localStorage.getItem('qms_ipc_revisions');
      if (savedRevisions) {
        setRevisions(JSON.parse(savedRevisions));
      } else {
        setRevisions([]);
      }

    } catch (err) {
      console.error('Error loading IPC module data:', err);
    }
  }, []);

  // Selected Active Station Object
  const currentStation = useMemo(() => {
    if (!selectedStationId || workstations.length === 0) return null;
    return workstations.find(w => w.id === selectedStationId) || workstations[0] || null;
  }, [workstations, selectedStationId]);

  // Load Saved Blocks & Results when currentStation changes
  useEffect(() => {
    if (currentStation) {
      const savedChecklist = localStorage.getItem(`qms_ipc_checklist_${currentStation.id}`);
      if (savedChecklist) {
        setBlocks(JSON.parse(savedChecklist));
      } else {
        // Automatically trigger AI block generator for selected station if empty
        generateStationBlocks(currentStation);
      }

      const savedResults = localStorage.getItem(`qms_ipc_results_${currentStation.id}`);
      if (savedResults) {
        setLoggedResults(JSON.parse(savedResults));
      } else {
        setLoggedResults([]);
      }
    }
  }, [currentStation?.id]);

  // Save Blocks & Results
  useEffect(() => {
    if (currentStation && blocks.length > 0) {
      localStorage.setItem(`qms_ipc_checklist_${currentStation.id}`, JSON.stringify(blocks));
    }
  }, [blocks, currentStation?.id]);

  useEffect(() => {
    if (currentStation && loggedResults.length > 0) {
      localStorage.setItem(`qms_ipc_results_${currentStation.id}`, JSON.stringify(loggedResults));
    }
  }, [loggedResults, currentStation?.id]);

  // Check for proposed changes
  useEffect(() => {
    let hasProposed = false;
    blocks.forEach(b => {
      b.items.forEach(item => {
        if (item.status.startsWith('proposed_')) {
          hasProposed = true;
        }
      });
    });
    setHasPendingProposedChanges(hasProposed);
  }, [blocks]);

  // ---------------------------------------------------------------------------
  // GENERATE DYNAMIC CHECKLIST FOR STATION
  // ---------------------------------------------------------------------------

  const generateStationBlocks = (station: WorkstationRecord) => {
    const eqListStr = station.equipmentList ? station.equipmentList.join('، ') : '';
    const inputsStr = station.inputItems ? station.inputItems.join('، ') : '';
    const outputStr = station.outputProduct || '';

    const generatedBlocks: ControlBlock[] = [
      {
        id: 'blk_materials',
        title: '۱. کنترل مواد اولیه و اقلام ورودی به ایستگاه (Station Inputs & Raw Materials)',
        category: 'materials',
        iconName: 'Package',
        color: 'blue',
        isMandatory: true,
        order: 1,
        isExpanded: true,
        dbBinding: { tableName: 'station_inputs_table', sourceColumn: 'input_item_spec', displayRule: 'Always' },
        items: inputsStr ? [
          {
            id: `itm_in_1_${station.id}`,
            blockId: 'blk_materials',
            paramName: `تأییدیه کیفیت و گواهی آنالیز اقلام ورودی (${inputsStr})`,
            specType: 'SC',
            controlMethod: 'چشمی و تطبیق برچسب کد بچ ورودی با برگه ردیابی',
            gaugeEquipment: 'برچسب ردیابی و گواهی آنالیز',
            gaugeStatus: 'valid',
            sampleSize: '۱۰۰٪ محموله‌ها',
            frequency: 'ابتدای شیفت و ورود محموله جدید',
            targetValue: 'تطبیق کامل گرید و کد بچ',
            lowerLimit: null,
            upperLimit: null,
            unit: '—',
            acceptLimit: 'تطبیق ۱۰۰٪ کد اقلام ورودی',
            rejectLimit: 'عدم تطبیق کد یا عدم وجود برچسب QC',
            reactionPlan: 'توقف استفاده از اقلام، قرنطینه و صدور گزارش عدم انطباق (NCR)',
            controllerRole: 'اپراتور / بازرس کیفیت',
            recordingType: 'Attribute',
            status: 'active',
            traceability: {
              sourceTable: 'station_inputs_table',
              sourceColumn: 'input_items_list',
              referenceRecord: `INP-STATION-${station.stationCode}`,
              aiSelectionReason: `استخراج هوشمند بر اساس اقلام ورودی ایستگاه: ${inputsStr}`
            },
            hourlySlots: {},
            latestResult: 'pending',
            latestMeasuredVal: ''
          }
        ] : []
      },
      {
        id: 'blk_machine',
        title: '۲. کنترل ماشین‌آلات و تجهیزات تولید ایستگاه (Production Equipment Check)',
        category: 'machine',
        iconName: 'Cpu',
        color: 'emerald',
        isMandatory: true,
        order: 2,
        isExpanded: true,
        dbBinding: { tableName: 'workstation_equipment_table', sourceColumn: 'equipment_control_item', displayRule: 'Always' },
        items: eqListStr ? [
          {
            id: `itm_eq_1_${station.id}`,
            blockId: 'blk_machine',
            paramName: `پارامترهای عملکردی تجهیز تولید (${eqListStr})`,
            specType: 'Standard',
            controlMethod: 'پایش آنلاین گیج و نمایشگر دیجیتال ماشین',
            gaugeEquipment: 'سنسور و مانومتر دیجیتال دستگاه',
            gaugeStatus: 'valid',
            sampleSize: '۱ بار',
            frequency: 'هر ۲ ساعت یک‌بار',
            targetValue: 'مطابق مشخصه فنی تجهیز',
            lowerLimit: null,
            upperLimit: null,
            unit: '—',
            acceptLimit: 'در محدوده مجاز دفترچه راهنما',
            rejectLimit: 'انحراف از حد مجاز',
            reactionPlan: 'تنظیم مجدد توسط واحد نت یا سرپرست تولید',
            controllerRole: 'تنظیم‌کار / اپراتور ماشین',
            recordingType: 'Attribute',
            status: 'active',
            traceability: {
              sourceTable: 'workstation_equipment_table',
              sourceColumn: 'equipment_list',
              referenceRecord: `EQ-${station.machineNo || station.stationCode}`,
              aiSelectionReason: `استخراج اختصاصی بر اساس تجهیزات تولید این ایستگاه: ${eqListStr}`
            },
            hourlySlots: {},
            latestResult: 'pending',
            latestMeasuredVal: ''
          }
        ] : []
      },
      {
        id: 'blk_tooling',
        title: '۳. کنترل ابزارآلات، قالب‌ها و فیکسچرهای ایستگاه (Tooling & Fixtures)',
        category: 'tooling',
        iconName: 'Wrench',
        color: 'amber',
        isMandatory: true,
        order: 3,
        isExpanded: true,
        dbBinding: { tableName: QmsDatabase.TABLES.WORKSTATIONS, sourceColumn: 'fixture_code', displayRule: 'Always' },
        items: station.fixtureNo ? [
          {
            id: `itm_tl_1_${station.id}`,
            blockId: 'blk_tooling',
            paramName: `وضعیت سائیدگی ابزار و تثبیت فیکسچر (کد: ${station.fixtureNo})`,
            specType: 'CC',
            controlMethod: 'بازرسی چشمی با ذره‌بین و چک لقی فیکسچر',
            gaugeEquipment: 'ذره‌بین کارگاهی / میکروسکوپ',
            gaugeStatus: 'valid',
            sampleSize: '۱۰۰٪ ابزارها',
            frequency: 'پس از تولید هر پارت',
            targetValue: 'بدون سایش و شکستگی',
            lowerLimit: null,
            upperLimit: null,
            unit: '—',
            acceptLimit: 'عدم وجود لب‌پریدگی ابزار',
            rejectLimit: 'سایش یا آسیب فیزیکی ابزار',
            reactionPlan: 'تعویض فوری اینسرت/ابزار و کنترل قطعات قبلی',
            controllerRole: 'اپراتور / بازرس کیفیت',
            recordingType: 'Attribute',
            status: 'active',
            traceability: {
              sourceTable: QmsDatabase.TABLES.WORKSTATIONS,
              sourceColumn: 'fixtureNo',
              referenceRecord: station.fixtureNo,
              aiSelectionReason: 'پیشگیری از خرابی ابزار بر اساس سوابق PFMEA'
            },
            hourlySlots: {},
            latestResult: 'pending',
            latestMeasuredVal: ''
          }
        ] : []
      },
      {
        id: 'blk_station_output',
        title: '۴. کنترل محصول و خروجی ایستگاه (Station Output Product Check)',
        category: 'station_output',
        iconName: 'FileCheck',
        color: 'rose',
        isMandatory: true,
        order: 4,
        isExpanded: true,
        dbBinding: { tableName: 'station_outputs_table', sourceColumn: 'output_product_spec', displayRule: 'Always' },
        items: outputStr ? [
          {
            id: `itm_out_1_${station.id}`,
            blockId: 'blk_station_output',
            paramName: `سلامت ظاهری و عدم وجود پلیسه محصول خروجی (${outputStr})`,
            specType: 'SC',
            controlMethod: 'بازرسی ۱۰۰٪ چشمی و لمسی',
            gaugeEquipment: 'دستگاه پلیسه‌گیر / لبه‌سنج',
            gaugeStatus: 'valid',
            sampleSize: '۱۰۰٪ قطعات تولیدی',
            frequency: 'پیوسته حین تولید',
            targetValue: 'کاملاً صاف، بدون پلیسه و آسیب',
            lowerLimit: null,
            upperLimit: null,
            unit: '—',
            acceptLimit: 'عاری از پلیسه و آسیب فیزیکی',
            rejectLimit: 'وجود پلیسه یا لکه و خراش روی سطح',
            reactionPlan: 'پلیسه‌گیری دستی و تنظیم مجدد لبه برشی ماشین',
            controllerRole: 'اپراتور ایستگاه',
            recordingType: 'Attribute',
            status: 'active',
            traceability: {
              sourceTable: 'station_outputs_table',
              sourceColumn: 'outputProduct',
              referenceRecord: `OUT-${station.stationCode}`,
              aiSelectionReason: `پایش انطباق محصول خروجی ایستگاه: ${outputStr}`
            },
            hourlySlots: {},
            latestResult: 'pending',
            latestMeasuredVal: ''
          }
        ] : []
      },
      {
        id: 'blk_first_piece',
        title: '۵. کنترل صحه‌گذاری اولین قطعه راه‌اندازی (First Piece Setup Verification)',
        category: 'first_piece',
        iconName: 'ClipboardCheck',
        color: 'sky',
        isMandatory: true,
        order: 5,
        isExpanded: true,
        dbBinding: { tableName: QmsDatabase.TABLES.DOCUMENTS, sourceColumn: 'setup_verification', displayRule: 'Always' },
        items: [
          {
            id: `itm_fp_1_${station.id}`,
            blockId: 'blk_first_piece',
            paramName: 'صحه‌گذاری و صدور پروانه شروع تولید برای اول قطعه (First Off Approval)',
            specType: 'CC',
            controlMethod: 'اندازه‌گیری کامل ابعادی و آزمایشگاهی',
            gaugeEquipment: 'تجهیزات کامل آزمایشگاه کالیبراسیون و CMM',
            gaugeStatus: 'valid',
            sampleSize: '۳ قطعه متوالی',
            frequency: 'ابتدای شیفت، تعویض ابزار/قالب و توقف تولید',
            targetValue: 'تأیید ۱۰۰٪ نقشه مهندسی',
            lowerLimit: null,
            upperLimit: null,
            unit: '—',
            acceptLimit: 'امضای شناسه صحه‌گذاری توسط QC',
            rejectLimit: 'عدم انطباق حتی ۱ پارامتر',
            reactionPlan: 'ممنوعیت شروع تولید انبوه تا رفع عیب و صدور مجدد پروانه',
            controllerRole: 'سرپرست کیفیت و تنظیم‌کار',
            recordingType: 'Attribute',
            status: 'active',
            traceability: {
              sourceTable: QmsDatabase.TABLES.DOCUMENTS,
              sourceColumn: 'first_piece_signoff',
              referenceRecord: 'JS-FRM-001',
              aiSelectionReason: 'الزام بند ۸.۵.۱.۳ IATF 16949 (تصدیق تنظیم راه‌اندازی)'
            },
            hourlySlots: {},
            latestResult: 'pending',
            latestMeasuredVal: ''
          }
        ]
      }
    ];

    setBlocks(generatedBlocks);
    setLoggedResults([]);
  };

  const generateInitialResultsList = (blks: ControlBlock[], station: WorkstationRecord) => {
    setLoggedResults([]);
  };

  // ---------------------------------------------------------------------------
  // TOGGLE PIN TO DASHBOARD (Under exact title: "کنترل حین تولید")
  // ---------------------------------------------------------------------------

  const handleTogglePin = () => {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    
    // Call parent handler
    if (onPinToDashboard) {
      onPinToDashboard();
    }

    showToast(
      nextPinned 
        ? 'ماژول "کنترل حین تولید" با موفقیت به داشبورد ابزار پین شد.' 
        : 'سنجاق ماژول "کنترل حین تولید" برداشته شد.',
      'success'
    );
  };

  // ---------------------------------------------------------------------------
  // AI RULE ENGINE TRIGGER
  // ---------------------------------------------------------------------------

  const handleGenerateAiChecklist = () => {
    if (!currentStation) {
      showToast('لطفاً ابتدا یک ایستگاه کاری را انتخاب فرمایید.', 'warning');
      return;
    }

    setIsAiGenerating(true);

    setTimeout(() => {
      generateStationBlocks(currentStation);
      setIsAiGenerating(false);
      showToast(`چک‌لیست و جدول ثبت نتایج ایستگاه "${currentStation.stationName}" بر اساس تجهیزات، اقلام ورودی و خروجی به‌روزرسانی شد.`, 'success');
    }, 900);
  };

  // ---------------------------------------------------------------------------
  // ADD MANUAL WORKSTATION
  // ---------------------------------------------------------------------------

  const handleCreateCustomWorkstation = () => {
    if (!newStationForm.stationName || !newStationForm.stationCode) {
      showToast('لطفاً کد و نام ایستگاه کاری را وارد کنید.', 'warning');
      return;
    }

    const newWs: WorkstationRecord = {
      id: `ws_custom_${Date.now()}`,
      stationCode: newStationForm.stationCode,
      stationName: `${newStationForm.stationCode} - ${newStationForm.stationName}`,
      processName: newStationForm.processName || 'تولید و ماشین‌کاری',
      operationName: newStationForm.operationName || 'عملیات جدید',
      equipmentList: newStationForm.equipmentInput ? newStationForm.equipmentInput.split('،').map(s => s.trim()) : ['تجهیزات عمومی تولید'],
      inputItems: newStationForm.inputItemsInput ? newStationForm.inputItemsInput.split('،').map(s => s.trim()) : ['مواد ورودی اولیه'],
      outputProduct: newStationForm.outputProduct || 'قطعه خروجی ایستگاه',
      machineNo: newStationForm.machineNo || 'MC-NEW',
      fixtureNo: newStationForm.fixtureNo || 'FIX-NEW'
    };

    const updatedStations = [...workstations, newWs];
    setWorkstations(updatedStations);
    setSelectedStationId(newWs.id);

    // Save to localStorage & QmsDatabase
    const customList = updatedStations.filter(s => s.id.startsWith('ws_custom_'));
    localStorage.setItem('qms_custom_workstations', JSON.stringify(customList));
    QmsDatabase.writeRow(QmsDatabase.TABLES.WORKSTATIONS, newWs.id, newWs);

    setIsAddStationModalOpen(false);
    setNewStationForm({
      stationCode: '',
      stationName: '',
      processName: 'تولید و ماشین‌کاری',
      operationName: 'عملیات شماره ۱۰',
      equipmentInput: '',
      inputItemsInput: '',
      outputProduct: '',
      machineNo: '',
      fixtureNo: ''
    });

    generateStationBlocks(newWs);
    showToast(`ایستگاه کاری جدید "${newWs.stationName}" ایجاد و چک‌لیست و جدول ثبت نتایج آن تولید گردید.`, 'success');
  };

  // ---------------------------------------------------------------------------
  // INTERACTIVE ITEM & BLOCK EDITING WORKFLOW
  // ---------------------------------------------------------------------------

  const handleAddItemToBlock = (blockId: string) => {
    const newItem: ControlChecklistItem = {
      id: `itm_custom_${Date.now()}`,
      blockId,
      paramName: 'پارامتر جدید کنترلی ایستگاه (پیشنهادی)',
      specType: 'Standard',
      controlMethod: 'بازرسی چشمی و گیج',
      gaugeEquipment: 'کولیس / میکرومتر',
      gaugeStatus: 'valid',
      sampleSize: '۵ قطعه',
      frequency: 'هر ۲ ساعت یک‌بار',
      targetValue: 'مطابق نقشه',
      lowerLimit: null,
      upperLimit: null,
      unit: 'mm',
      acceptLimit: 'عدم وجود پلیسه و انحراف',
      rejectLimit: 'وجود دفرمه‌شدگی',
      reactionPlan: 'توقف تولید و اطلاع به مسئول کیفیت',
      controllerRole: 'اپراتور ایستگاه',
      recordingType: 'Attribute',
      status: 'proposed_add',
      traceability: {
        sourceTable: 'کاربر (دستی)',
        sourceColumn: 'افزوده شده توسط کاربر',
        referenceRecord: 'USR-EDIT-NEW',
        aiSelectionReason: 'پیشنهاد کاربر جهت ارتقای چک‌لیست ایستگاه'
      },
      hourlySlots: {},
      latestResult: 'pending',
      latestMeasuredVal: ''
    };

    setBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        return { ...b, items: [...b.items, newItem] };
      }
      return b;
    }));

    showToast('آیتم جدید با رنگ سبز به عنوان تغییر پیشنهادی اضافه گردید.', 'info');
  };

  const handleDeleteItem = (itemId: string) => {
    if (!window.confirm('آیا از علامت‌گذاری این آیتم برای حذف مطمئن هستید؟ (تغییر با رنگ قرمز مشخص خواهد شد)')) {
      return;
    }

    setBlocks(prev => prev.map(b => {
      return {
        ...b,
        items: b.items.map(item => {
          if (item.id === itemId) {
            return { ...item, status: 'proposed_delete' };
          }
          return item;
        })
      };
    }));

    showToast('آیتم با رنگ قرمز به عنوان پیشنهادی برای حذف علامت‌گذاری گردید.', 'warning');
  };

  // Column Management Modal Handlers (Interactive In-App Modal)
  const openAddColumnModal = (blockId?: string) => {
    setColumnModalState({
      isOpen: true,
      mode: blockId ? 'add_single' : 'add_global',
      blockId,
      columnName: '۱۶:۰۰',
      selectedSlotToDelete: ''
    });
  };

  const openDeleteColumnModal = (blockId?: string) => {
    const targetBlock = blocks.find(b => b.id === blockId);
    const slots = blockId ? (targetBlock?.timeSlots || timeSlots) : timeSlots;
    if (!slots || slots.length === 0) {
      showToast('هیچ ستونی برای حذف وجود ندارد.', 'warning');
      return;
    }
    setColumnModalState({
      isOpen: true,
      mode: blockId ? 'delete_single' : 'delete_global',
      blockId,
      columnName: '',
      selectedSlotToDelete: slots[slots.length - 1] || ''
    });
  };

  const handleConfirmColumnAction = () => {
    const { mode, blockId, columnName, selectedSlotToDelete } = columnModalState;

    if (mode === 'add_single' && blockId) {
      if (!columnName || !columnName.trim()) {
        showToast('لطفاً عنوان یا زمان ستون جدید را وارد فرمایید.', 'warning');
        return;
      }
      const trimmedName = columnName.trim();
      setBlocks(prev => prev.map(b => {
        if (b.id === blockId) {
          const currentSlots = b.timeSlots || timeSlots;
          if (currentSlots.includes(trimmedName)) {
            showToast('این ستون قبلاً در جدول ایستگاه وجود دارد.', 'warning');
            return b;
          }
          const updatedSlots = [...currentSlots, trimmedName];
          const updatedItems = b.items.map(item => ({
            ...item,
            hourlySlots: {
              ...(item.hourlySlots || {}),
              [trimmedName]: 'تأیید'
            }
          }));
          return { ...b, timeSlots: updatedSlots, items: updatedItems };
        }
        return b;
      }));
      showToast(`ستون جدید "${trimmedName}" با موفقیت به این ایستگاه اضافه شد.`, 'success');
    } else if (mode === 'add_global') {
      if (!columnName || !columnName.trim()) {
        showToast('لطفاً عنوان یا زمان ستون جدید را وارد فرمایید.', 'warning');
        return;
      }
      const trimmedName = columnName.trim();
      setTimeSlots(prev => prev.includes(trimmedName) ? prev : [...prev, trimmedName]);
      setBlocks(prev => prev.map(b => {
        const currentSlots = b.timeSlots || timeSlots;
        const updatedSlots = currentSlots.includes(trimmedName) ? currentSlots : [...currentSlots, trimmedName];
        const updatedItems = b.items.map(item => ({
          ...item,
          hourlySlots: {
            ...(item.hourlySlots || {}),
            [trimmedName]: 'تأیید'
          }
        }));
        return { ...b, timeSlots: updatedSlots, items: updatedItems };
      }));
      showToast(`ستون جدید "${trimmedName}" با موفقیت به تمامی ایستگاه‌ها اضافه گردید.`, 'success');
    } else if (mode === 'delete_single' && blockId && selectedSlotToDelete) {
      const confirmed = window.confirm(`آیا از حذف ستون بازرسی "${selectedSlotToDelete}" از چک‌لیست این ایستگاه مطمئن هستید؟`);
      if (!confirmed) return;

      setBlocks(prev => prev.map(b => {
        if (b.id === blockId) {
          const currentSlots = b.timeSlots || timeSlots;
          const updatedSlots = currentSlots.filter(s => s !== selectedSlotToDelete);
          const updatedItems = b.items.map(item => {
            const newSlotsObj = { ...(item.hourlySlots || {}) };
            delete newSlotsObj[selectedSlotToDelete];
            return { ...item, hourlySlots: newSlotsObj };
          });
          return { ...b, timeSlots: updatedSlots, items: updatedItems };
        }
        return b;
      }));
      showToast(`ستون "${selectedSlotToDelete}" از این ایستگاه حذف گردید.`, 'info');
    } else if (mode === 'delete_global' && selectedSlotToDelete) {
      const confirmed = window.confirm(`آیا از حذف عمومی ستون بازرسی "${selectedSlotToDelete}" از تمامی ایستگاه‌های کاری اطمینان دارید؟`);
      if (!confirmed) return;

      setTimeSlots(prev => prev.filter(s => s !== selectedSlotToDelete));
      setBlocks(prev => prev.map(b => {
        const currentSlots = b.timeSlots || timeSlots;
        const updatedSlots = currentSlots.filter(s => s !== selectedSlotToDelete);
        const updatedItems = b.items.map(item => {
          const newSlotsObj = { ...(item.hourlySlots || {}) };
          delete newSlotsObj[selectedSlotToDelete];
          return { ...item, hourlySlots: newSlotsObj };
        });
        return { ...b, timeSlots: updatedSlots, items: updatedItems };
      }));
      showToast(`ستون "${selectedSlotToDelete}" از تمامی ایستگاه‌های کاری حذف شد.`, 'success');
    }

    setColumnModalState(prev => ({ ...prev, isOpen: false }));
  };

  // Delete Column from Specific Block (Direct Header Button)
  const handleDeleteColumnFromBlock = (blockId: string, slotToDelete: string) => {
    const confirmed = window.confirm(`آیا از حذف ستون بازرسی "${slotToDelete}" از جدول چک‌لیست این ایستگاه اطمینان دارید؟`);
    if (!confirmed) return;

    setBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        const currentSlots = b.timeSlots || timeSlots;
        const updatedSlots = currentSlots.filter(s => s !== slotToDelete);
        const updatedItems = b.items.map(item => {
          const newSlotsObj = { ...(item.hourlySlots || {}) };
          delete newSlotsObj[slotToDelete];
          return { ...item, hourlySlots: newSlotsObj };
        });
        return { ...b, timeSlots: updatedSlots, items: updatedItems };
      }
      return b;
    }));

    showToast(`ستون "${slotToDelete}" با موفقیت از این ایستگاه حذف گردید.`, 'info');
  };

  // Update Item Reaction Plan
  const handleUpdateItemReactionPlan = (itemId: string, newPlan: string) => {
    setBlocks(prev => prev.map(b => ({
      ...b,
      items: b.items.map(item => item.id === itemId ? { ...item, reactionPlan: newPlan } : item)
    })));
  };

  // Update Specific Block Shift
  const handleUpdateBlockShift = (blockId: string, newShift: string) => {
    setBlocks(prev => prev.map(b => b.id === blockId ? { ...b, shiftNo: newShift } : b));
    showToast(`شیفت کاری این ایستگاه به "${newShift}" تغییر یافت.`, 'info');
  };

  // Update Specific Block Inspection Interval
  const handleUpdateBlockInterval = (blockId: string, intervalHours: number) => {
    let newSlots: string[] = [];
    if (intervalHours === 1) {
      newSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
    } else if (intervalHours === 2) {
      newSlots = ['08:00', '10:00', '12:00', '14:00'];
    } else if (intervalHours === 4) {
      newSlots = ['08:00', '12:00'];
    } else if (intervalHours === 8) {
      newSlots = ['میانه شیفت (12:00)'];
    } else {
      newSlots = ['08:00', '10:00', '12:00', '14:00'];
    }

    setBlocks(prev => prev.map(b => {
      if (b.id === blockId) {
        const updatedItems = b.items.map(item => {
          const slotsObj: Record<string, string> = {};
          newSlots.forEach(s => {
            slotsObj[s] = item.hourlySlots?.[s] || 'تأیید';
          });
          return { ...item, hourlySlots: slotsObj };
        });

        return {
          ...b,
          inspectionIntervalHours: intervalHours,
          timeSlots: newSlots,
          items: updatedItems
        };
      }
      return b;
    }));

    showToast(`دوره بازرسی این ایستگاه به ${intervalHours} ساعته تغییر یافت.`, 'info');
  };

  // Direct results logging inside the Block Checklist table
  const handleUpdateHourlySlotValue = (itemId: string, slotTime: string, val: string) => {
    setBlocks(prev => prev.map(b => {
      return {
        ...b,
        items: b.items.map(item => {
          if (item.id === itemId) {
            const currentSlots = item.hourlySlots || {};
            const newSlots = { ...currentSlots, [slotTime]: val };

            // Check if value is out of spec
            const valNum = parseFloat(val);
            let isOut = false;
            if (!isNaN(valNum) && item.lowerLimit !== null && item.upperLimit !== null) {
              if (valNum < item.lowerLimit || valNum > item.upperLimit) {
                isOut = true;
              }
            }

            return {
              ...item,
              hourlySlots: newSlots,
              latestMeasuredVal: val,
              latestResult: isOut ? 'fail' : 'pass'
            };
          }
          return item;
        })
      };
    }));
  };

  const handleToggleBlockItemResult = (itemId: string) => {
    setBlocks(prev => prev.map(b => {
      return {
        ...b,
        items: b.items.map(item => {
          if (item.id === itemId) {
            const nextRes = item.latestResult === 'pass' ? 'fail' : 'pass';
            return {
              ...item,
              latestResult: nextRes
            };
          }
          return item;
        })
      };
    }));
  };

  const handleApproveProposedChanges = () => {
    if (!window.confirm('آیا از تأیید نهایی تغییرات پیشنهادی، ثبت Audit Trail و ایجاد نسخه جدید چک‌لیست اطمینان دارید؟')) {
      return;
    }

    let totalItems = 0;
    const updatedBlocks = blocks.map(b => {
      const activeItems = b.items
        .filter(item => item.status !== 'proposed_delete')
        .map(item => ({ ...item, status: 'active' as const }));
      totalItems += activeItems.length;
      return { ...b, items: activeItems };
    });

    setBlocks(updatedBlocks);

    const nextRevNum = (parseFloat(selectedRevision) + 0.1).toFixed(1);
    setSelectedRevision(nextRevNum);

    const newRevRecord: RevisionHistoryRecord = {
      id: `rev_${Date.now()}`,
      version: nextRevNum,
      date: new Date().toLocaleDateString('fa-IR'),
      author: 'کارشناس ارشد کیفیت',
      changesSummary: 'اعمال و تصویب تغییرات پیشنهادی کاربر روی چک‌لیست کنترلی ایستگاه',
      approvedBy: 'مدیر کیفیت / ممیز ارشد',
      status: 'Approved',
      itemCount: totalItems
    };

    const updatedRevisions = [newRevRecord, ...revisions];
    setRevisions(updatedRevisions);
    localStorage.setItem('qms_ipc_revisions', JSON.stringify(updatedRevisions));

    showToast(`تغییرات با موفقیت تصویب شد و نسخه جدید ${nextRevNum} در تاریخچه Audit Trail ثبت گردید.`, 'success');
  };

  // ---------------------------------------------------------------------------
  // RESULTS LOGGING & OUT OF SPEC HANDLING
  // ---------------------------------------------------------------------------

  const handleUpdateMeasuredValue = (resultId: string, valStr: string) => {
    setLoggedResults(prev => prev.map(res => {
      if (res.id === resultId) {
        const valNum = parseFloat(valStr);
        let outOfSpec = false;
        let finalResult: 'pass' | 'fail' = 'pass';

        if (!isNaN(valNum) && res.lowerLimit !== null && res.upperLimit !== null) {
          if (valNum < res.lowerLimit || valNum > res.upperLimit) {
            outOfSpec = true;
            finalResult = 'fail';
          }
        }

        return {
          ...res,
          measuredValue: valStr,
          isOutOfSpec: outOfSpec,
          result: finalResult
        };
      }
      return res;
    }));
  };

  const handleToggleResultStatus = (resultId: string) => {
    setLoggedResults(prev => prev.map(res => {
      if (res.id === resultId) {
        const nextRes = res.result === 'pass' ? 'fail' : 'pass';
        return {
          ...res,
          result: nextRes,
          isOutOfSpec: nextRes === 'fail'
        };
      }
      return res;
    }));
  };

  const handleTriggerQuickCapa = (res: LoggedControlResult | ControlChecklistItem) => {
    const param = 'paramName' in res ? res.paramName : 'مشخصه ایستگاه';
    showToast(`اقدام اصلاحی (CAPA) برای خطای "${param}" صادر گردید. منتقل به پورتال اقدامات اصلاحی...`, 'warning');
    if (onOpenCorrectiveActions) {
      onOpenCorrectiveActions();
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER DYNAMIC ICON
  // ---------------------------------------------------------------------------

  const renderCategoryIcon = (iconName: string, colorClass: string) => {
    switch (iconName) {
      case 'Cpu': return <Cpu className={colorClass} size={18} />;
      case 'Wrench': return <Wrench className={colorClass} size={18} />;
      case 'ShieldCheck': return <ShieldCheck className={colorClass} size={18} />;
      case 'FileCheck': return <FileCheck className={colorClass} size={18} />;
      case 'ClipboardCheck': return <ClipboardCheck className={colorClass} size={18} />;
      default: return <Package className={colorClass} size={18} />;
    }
  };

  // Calculate Statistics for Dashboard
  const stats = useMemo(() => {
    let totalItemsCount = 0;
    let ccCount = 0;
    let scCount = 0;
    let proposedAdd = 0;
    let proposedDel = 0;

    blocks.forEach(b => {
      b.items.forEach(itm => {
        if (itm.status !== 'proposed_delete') totalItemsCount++;
        if (itm.specType === 'CC') ccCount++;
        if (itm.specType === 'SC') scCount++;
        if (itm.status === 'proposed_add') proposedAdd++;
        if (itm.status === 'proposed_delete') proposedDel++;
      });
    });

    const passResults = loggedResults.filter(r => r.result === 'pass').length;
    const failResults = loggedResults.filter(r => r.result === 'fail').length;
    const totalResults = loggedResults.length;
    const passRate = totalResults > 0 ? Math.round((passResults / totalResults) * 100) : 100;

    return { totalItemsCount, ccCount, scCount, proposedAdd, proposedDel, passResults, failResults, passRate };
  }, [blocks, loggedResults]);

  // ---------------------------------------------------------------------------
  // MAIN RENDER RETURN
  // ---------------------------------------------------------------------------

  return (
    <div className="w-full bg-[#0B0B0E] text-zinc-100 min-h-screen p-3 md:p-6 font-farsi space-y-6">

      {/* TOAST BANNER NOTIFICATION */}
      {toastMessage && (
        <div className={`fixed bottom-6 left-6 z-[10000] px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border backdrop-blur-md transition-all animate-bounce ${
          toastMessage.type === 'success' ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40' :
          toastMessage.type === 'error' ? 'bg-rose-950/90 text-rose-200 border-rose-500/40' :
          toastMessage.type === 'warning' ? 'bg-amber-950/90 text-amber-200 border-amber-500/40' :
          'bg-cyan-950/90 text-cyan-200 border-cyan-500/40'
        }`}>
          {toastMessage.type === 'success' && <CheckCircle2 size={20} className="text-emerald-400" />}
          {toastMessage.type === 'error' && <XCircle size={20} className="text-rose-400" />}
          {toastMessage.type === 'warning' && <AlertTriangle size={20} className="text-amber-400" />}
          {toastMessage.type === 'info' && <Sparkles size={20} className="text-cyan-400" />}
          <span className="text-xs font-black">{toastMessage.text}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* HEADER BAR (Module Title: کنترل حین تولید)                         */}
      {/* =================================================================== */}
      <header className="relative bg-[#121216] border border-zinc-800/80 rounded-3xl p-5 md:p-6 shadow-2xl overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-gradient-to-br from-amber-500/20 via-orange-500/20 to-amber-600/10 border border-amber-500/40 rounded-2xl text-amber-400 shadow-lg shadow-amber-500/5">
              <ShieldCheck size={32} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Pin Button (Using exact pin pattern from Job Setup Module) */}
                <button
                  type="button"
                  onClick={handleTogglePin}
                  className="p-1 cursor-pointer flex items-center justify-center transition-transform hover:scale-125"
                  title={isPinned ? 'پین شده به داشبورد ابزار IATF (جهت لغو کلیک کنید)' : 'پین کردن ماژول به داشبورد ابزار IATF'}
                >
                  <span className="text-2xl animate-pulse inline-block select-none leading-none drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]">📌</span>
                </button>

                <h1 className="text-xl md:text-2xl font-black text-white tracking-wide">
                  کنترل حین تولید
                </h1>

                <span className="text-[10px] font-black px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  IATF 16949 § 8.5.1.1
                </span>
                <span className="text-[10px] font-bold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  نسخه {selectedRevision} (Audit Trail Ready)
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-3xl leading-relaxed">
                چک‌لیست هوشمند و فرم ثبت نتایج کنترل حین تولید به تفکیک تجهیزات، اقلام ورودی و محصول خروجی هر ایستگاه کاری با قابلیت بازرسی ساعتی و ثبت سوابق کارگاهی.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto justify-end flex-wrap">
            {/* Manual Workstation Add Button next to AI Button */}
            <button
              onClick={() => setIsAddStationModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
            >
              <Plus size={16} className="text-emerald-400" />
              <span>افزودن دستی ایستگاه کاری</span>
            </button>

            {/* Smart AI Generator Button */}
            <button
              onClick={handleGenerateAiChecklist}
              disabled={isAiGenerating}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-black rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={16} className={isAiGenerating ? 'animate-spin' : ''} />
              <span>{isAiGenerating ? 'در حال استخراج هوشمند...' : 'استخراج هوشمند چک‌لیست AI'}</span>
            </button>

            {/* Print & Customizer Full Screen Button */}
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
            >
              <Printer size={16} className="text-amber-400" />
              <span>پیش‌نمایش و چاپ تمام‌صفحه</span>
            </button>
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* WORKSTATION & PRODUCT SELECTION BAR                                */}
      {/* =================================================================== */}
      <section className="bg-[#121216] border border-zinc-800/80 rounded-2xl p-4 md:p-5 shadow-lg grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Workstation Selector */}
        <div>
          <label className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5 mb-1.5">
            <Building size={14} />
            <span>انتخاب ایستگاه کاری (Workstation):</span>
          </label>
          <select
            value={selectedStationId}
            onChange={(e) => setSelectedStationId(e.target.value)}
            className="w-full bg-[#18181E] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-bold"
          >
            {workstations.map(ws => (
              <option key={ws.id} value={ws.id}>
                {ws.stationName} ({ws.stationCode})
              </option>
            ))}
          </select>
        </div>

        {/* Product & Part No */}
        <div>
          <label className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5 mb-1.5">
            <Package size={14} />
            <span>محصول و شماره قطعه:</span>
          </label>
          <select
            value={selectedProduct}
            onChange={(e) => {
              setSelectedProduct(e.target.value);
              const found = productsList.find(p => p.name === e.target.value);
              if (found) setSelectedPartNo(found.partNo);
            }}
            className="w-full bg-[#18181E] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            {productsList.map((p, idx) => (
              <option key={idx} value={p.name}>
                {p.name} [{p.partNo}]
              </option>
            ))}
          </select>
        </div>

        {/* Process & Operation */}
        <div>
          <label className="text-[11px] font-bold text-zinc-300 flex items-center gap-1.5 mb-1.5">
            <Layers size={14} />
            <span>فرآیند و شماره عملیات:</span>
          </label>
          <input
            type="text"
            value={selectedOperation}
            onChange={(e) => setSelectedOperation(e.target.value)}
            className="w-full bg-[#18181E] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
            placeholder="نام و شماره عملیات..."
          />
        </div>

        {/* Inspection Interval Settings */}
        <div>
          <label className="text-[11px] font-bold text-cyan-400 flex items-center gap-1.5 mb-1.5">
            <Clock size={14} />
            <span>دوره ساعتی بازرسی و شیفت:</span>
          </label>
          <div className="flex items-center gap-2">
            <select
              value={inspectionIntervalHours}
              onChange={(e) => setInspectionIntervalHours(Number(e.target.value))}
              className="w-1/2 bg-[#18181E] border border-zinc-700 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
            >
              <option value={1}>هر ۱ ساعت</option>
              <option value={2}>هر ۲ ساعت</option>
              <option value={3}>هر ۳ ساعت</option>
              <option value={4}>هر ۴ ساعت</option>
            </select>
            <select
              value={shiftDurationHours}
              onChange={(e) => setShiftDurationHours(Number(e.target.value))}
              className="w-1/2 bg-[#18181E] border border-zinc-700 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-bold"
            >
              <option value={8}>شیفت ۸ ساعته</option>
              <option value={10}>شیفت ۱۰ ساعته</option>
              <option value={12}>شیفت ۱۲ ساعته</option>
            </select>
          </div>
        </div>

      </section>

      {/* ACTIVE WORKSTATION BOUND SUMMARY CARD */}
      {currentStation && (
        <section className="bg-[#121216] border border-amber-500/20 rounded-2xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/30">
              <Activity size={18} />
            </span>
            <div>
              <div className="font-black text-white flex items-center gap-2">
                <span>تجهیزات فعال ایستگاه:</span>
                <span className="text-amber-300 font-bold">{currentStation.equipmentList.join(' | ')}</span>
              </div>
              <div className="text-zinc-400 text-[11px] mt-0.5 flex items-center gap-3">
                <span>اقلام ورودی: <strong className="text-zinc-200">{currentStation.inputItems.join('، ')}</strong></span>
                <span>•</span>
                <span>محصول خروجی: <strong className="text-emerald-400">{currentStation.outputProduct}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
            <span className="text-zinc-400">کد ماشین: <strong className="text-white">{currentStation.machineNo || 'N/A'}</strong></span>
            <span className="text-zinc-700">|</span>
            <span className="text-zinc-400">فیکسچر: <strong className="text-white">{currentStation.fixtureNo || 'N/A'}</strong></span>
          </div>
        </section>
      )}

      {/* =================================================================== */}
      {/* MAIN NAVIGATION TABS                                              */}
      {/* =================================================================== */}
      <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('checklist')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'checklist'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
        >
          <ClipboardCheck size={16} />
          <span>چک‌لیست و ثبت نتایج بلوک‌های کنترلی</span>
          <span className="bg-amber-500/30 text-amber-200 text-[10px] px-2 py-0.5 rounded-full">
            {stats.totalItemsCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('results')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'results'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-lg'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
        >
          <CheckCircle2 size={16} />
          <span>سوابق و لاگ کامل ثبت نتایج</span>
          {stats.failResults > 0 && (
            <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
              {stats.failResults} خطا
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-lg'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
        >
          <BarChart2 size={16} />
          <span>داشبورد تحلیلی و شاخص‌ها</span>
        </button>

        <button
          onClick={() => setActiveTab('ai_sources')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'ai_sources'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-lg'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
        >
          <Database size={16} />
          <span>منابع داده و جداول متصل AI</span>
          <span className="bg-purple-500/30 text-purple-200 text-[10px] px-2 py-0.5 rounded-full">
            {aiDataSources.length} جدول
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'history'
              ? 'bg-zinc-700 text-zinc-100 border border-zinc-600 shadow-lg'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
          }`}
        >
          <History size={16} />
          <span>تاریخچه تغییرات و Audit Trail</span>
          <span className="bg-zinc-800 text-zinc-300 text-[10px] px-2 py-0.5 rounded-full">
            v{selectedRevision}
          </span>
        </button>
      </div>

      {/* PROPOSED CHANGES APPROVAL BANNER */}
      {hasPendingProposedChanges && (
        <section className="bg-amber-950/40 border border-amber-500/50 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-400" size={22} />
            <div>
              <h4 className="text-xs font-black text-amber-200">تغییرات و آیتم‌های پیشنهادی در انتظار تصویب نهایی</h4>
              <p className="text-[11px] text-amber-300/80 mt-0.5">
                آیتم‌های جدید با رنگ سبز و آیتم‌های علامت‌گذاری شده برای حذف با رنگ قرمز مشخص شده‌اند.
              </p>
            </div>
          </div>
          <button
            onClick={handleApproveProposedChanges}
            className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl transition-all cursor-pointer shadow-lg"
          >
            <CheckCircle2 size={16} />
            <span>تصویب نهایی تغییرات و ثبت نسخه جدید (Audit Trail)</span>
          </button>
        </section>
      )}

      {/* =================================================================== */}
      {/* TAB 1: BLOCK CHECKLIST & DIRECT RESULTS LOGGING                    */}
      {/* =================================================================== */}
      {activeTab === 'checklist' && (
        <div className="space-y-6">

          {/* Shop Floor Active Operator / Shift & Interval Info Bar */}
          <div className="bg-[#121216] border border-zinc-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <UserCheck size={16} />
                <span>تنظیمات ثبت کارگاهی و ابزار:</span>
              </span>

              {/* Work Shift Selector */}
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
                <span className="text-zinc-400">شیفت کاری عمومی:</span>
                <select
                  value={shiftNo}
                  onChange={(e) => {
                    const newShift = e.target.value;
                    setShiftNo(newShift);
                    setBlocks(prev => prev.map(b => ({ ...b, shiftNo: newShift })));
                    showToast(`شیفت عمومی به "${newShift}" به‌روزرسانی شد.`, 'info');
                  }}
                  className="bg-zinc-950 text-amber-300 font-bold border border-zinc-700 rounded-lg px-2 py-0.5 text-xs focus:outline-none focus:border-amber-500"
                >
                  <option value="شیفت ۱ (روز)">شیفت ۱ (روز)</option>
                  <option value="شیفت ۲ (عصر)">شیفت ۲ (عصر)</option>
                  <option value="شیفت ۳ (شب)">شیفت ۳ (شب)</option>
                </select>
              </div>

              {/* Inspection Interval Selector */}
              <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl">
                <span className="text-zinc-400">دوره بازرسی عمومی:</span>
                <select
                  value={inspectionIntervalHours}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setInspectionIntervalHours(val);
                    let newSlots: string[] = [];
                    if (val === 1) newSlots = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00'];
                    else if (val === 2) newSlots = ['08:00', '10:00', '12:00', '14:00'];
                    else if (val === 4) newSlots = ['08:00', '12:00'];
                    else if (val === 8) newSlots = ['میانه شیفت (12:00)'];
                    else newSlots = ['08:00', '10:00', '12:00', '14:00'];

                    setTimeSlots(newSlots);
                    setBlocks(prev => prev.map(b => ({
                      ...b,
                      inspectionIntervalHours: val,
                      timeSlots: newSlots,
                      items: b.items.map(item => {
                        const slotsObj: Record<string, string> = {};
                        newSlots.forEach(s => {
                          slotsObj[s] = item.hourlySlots?.[s] || 'تأیید';
                        });
                        return { ...item, hourlySlots: slotsObj };
                      })
                    })));
                    showToast(`دوره زمانی بازرسی به ${val} ساعته به‌روزرسانی شد.`, 'info');
                  }}
                  className="bg-zinc-950 text-cyan-300 font-bold border border-zinc-700 rounded-lg px-2 py-0.5 text-xs focus:outline-none focus:border-cyan-500"
                >
                  <option value={1}>هر ۱ ساعت (۸ نوبت)</option>
                  <option value={2}>هر ۲ ساعت (۴ نوبت)</option>
                  <option value={4}>هر ۴ ساعت (۲ نوبت)</option>
                  <option value={8}>هر شیفت (۱ نوبت)</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-zinc-400">اپراتور:</span>
                <input
                  type="text"
                  value={activeOperator}
                  onChange={(e) => setActiveOperator(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-white text-xs font-bold"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-zinc-400">بازرس کیفیت:</span>
                <input
                  type="text"
                  value={activeInspector}
                  onChange={(e) => setActiveInspector(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-white text-xs font-bold"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-zinc-400">شماره بچ:</span>
                <input
                  type="text"
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-amber-300 text-xs font-bold w-36"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => openAddColumnModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-600/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                <Columns size={15} />
                <span>+ افزودن ستون جدید عمومی</span>
              </button>

              <button
                onClick={() => openDeleteColumnModal()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-600/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
              >
                <Trash2 size={14} />
                <span>- حذف ستون عمومی</span>
              </button>
            </div>
          </div>

          {/* CONTROL BLOCKS LIST WITH PROPER GRIDLINES */}
          {blocks.map((block) => {
            const currentBlockSlots = block.timeSlots || timeSlots;

            return (
              <div key={block.id} className="bg-[#121216] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden transition-all">
                
                {/* Block Header */}
                <div className="bg-zinc-900/90 border-b border-zinc-800 p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
                      {renderCategoryIcon(block.iconName, 'text-amber-400')}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white flex items-center gap-2">
                        <span>{block.title}</span>
                        {block.isMandatory && (
                          <span className="text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-full font-bold">
                            الزامی IATF
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        مرجع داده: <span className="text-zinc-300 font-bold">{block.dbBinding.tableName}</span> | {block.items.length} آیتم کنترلی
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Add Control Item Button */}
                    <button
                      onClick={() => handleAddItemToBlock(block.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      <Plus size={14} />
                      <span>افزودن آیتم کنترلی</span>
                    </button>

                    {/* Add New Column Button Next to Add Item Button */}
                    <button
                      onClick={() => openAddColumnModal(block.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-600/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      <Columns size={14} />
                      <span>افزودن ستون جدید</span>
                    </button>

                    {/* Delete Column Button */}
                    <button
                      onClick={() => openDeleteColumnModal(block.id)}
                      className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-600/40 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      <Trash2 size={13} />
                      <span>حذف ستون</span>
                    </button>

                    {/* Per-Workstation Block Shift & Interval Specific Overrides */}
                    <div className="flex items-center gap-2 bg-zinc-950 px-2.5 py-1 rounded-xl border border-zinc-800 text-[11px]">
                      <span className="text-zinc-400">شیفت:</span>
                      <select
                        value={block.shiftNo || shiftNo}
                        onChange={(e) => handleUpdateBlockShift(block.id, e.target.value)}
                        className="bg-zinc-900 text-amber-300 font-bold border border-zinc-700 rounded px-1.5 py-0.5 text-[11px]"
                      >
                        <option value="شیفت ۱ (روز)">شیفت ۱ (روز)</option>
                        <option value="شیفت ۲ (عصر)">شیفت ۲ (عصر)</option>
                        <option value="شیفت ۳ (شب)">شیفت ۳ (شب)</option>
                      </select>

                      <span className="text-zinc-400 mr-1">دوره:</span>
                      <select
                        value={block.inspectionIntervalHours || inspectionIntervalHours}
                        onChange={(e) => handleUpdateBlockInterval(block.id, Number(e.target.value))}
                        className="bg-zinc-900 text-cyan-300 font-bold border border-zinc-700 rounded px-1.5 py-0.5 text-[11px]"
                      >
                        <option value={1}>۱ ساعته</option>
                        <option value={2}>۲ ساعته</option>
                        <option value={4}>۴ ساعته</option>
                        <option value={8}>هر شیفت</option>
                      </select>
                    </div>

                    <button
                      onClick={() => {
                        setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, isExpanded: !b.isExpanded } : b));
                      }}
                      className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all cursor-pointer"
                    >
                      {block.isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* Block Table with Gridlines */}
                {block.isExpanded && (
                  <div className="p-4 overflow-x-auto">
                    <table className="w-full text-right border-collapse border border-zinc-700/80 divide-y divide-x divide-zinc-700/80 text-xs">
                      <thead>
                        <tr className="bg-zinc-900/90 text-zinc-300 font-bold border-b border-zinc-700">
                          <th className="p-2.5 border border-zinc-700/80 text-center w-10">#</th>
                          <th className="p-2.5 border border-zinc-700/80 min-w-[180px]">آیتم / مشخصه کنترلی</th>
                          <th className="p-2.5 border border-zinc-700/80 text-center w-20">کلاس</th>
                          <th className="p-2.5 border border-zinc-700/80 min-w-[140px]">روش کنترل و گیج</th>
                          <th className="p-2.5 border border-zinc-700/80 min-w-[120px]">هدف / حدود مجاز</th>
                          <th className="p-2.5 border border-zinc-700/80 text-center w-28">فرکانس و نمونه</th>

                          {/* Hourly Inspection Time Slots with Direct Column Delete Buttons */}
                          {currentBlockSlots.map(slot => (
                            <th key={slot} className="p-2 border border-zinc-700/80 text-center bg-cyan-950/40 text-cyan-300 min-w-[80px] group/col">
                              <div className="flex items-center justify-between gap-1 px-1">
                                <span>{slot}</span>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteColumnFromBlock(block.id, slot)}
                                  title={`حذف ستون ${slot}`}
                                  className="text-zinc-500 hover:text-rose-400 hover:bg-rose-950/80 p-0.5 rounded transition-all cursor-pointer opacity-70 group-hover/col:opacity-100"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </th>
                          ))}

                        <th className="p-2.5 border border-zinc-700/80 text-center min-w-[180px] bg-amber-950/30 text-amber-300">
                          اقدام واکنشی (Reaction Plan)
                        </th>
                        <th className="p-2.5 border border-zinc-700/80 text-center w-20">اقدام / حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-700/80 text-zinc-200">
                      {block.items.map((item, idx) => {
                        const isProposedAdd = item.status === 'proposed_add';
                        const isProposedDelete = item.status === 'proposed_delete';

                        return (
                          <tr
                            key={item.id}
                            className={`transition-colors hover:bg-zinc-800/40 ${
                              isProposedAdd ? 'bg-emerald-950/30 text-emerald-200 border-emerald-500/50' :
                              isProposedDelete ? 'bg-rose-950/30 text-rose-300 line-through border-rose-500/50' :
                              'even:bg-zinc-900/30'
                            }`}
                          >
                            {/* Row Index */}
                            <td className="p-2.5 border border-zinc-700/80 text-center font-bold text-zinc-400">
                              {idx + 1}
                            </td>

                            {/* Parameter Name */}
                            <td className="p-2.5 border border-zinc-700/80 font-bold">
                              <div className="flex flex-col gap-1">
                                <span className="text-white">{item.paramName}</span>
                                <span className="text-[10px] text-zinc-400 font-normal">
                                  نقش: <strong className="text-amber-400">{item.controllerRole}</strong>
                                </span>
                              </div>
                            </td>

                            {/* Class Badge */}
                            <td className="p-2.5 border border-zinc-700/80 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                item.specType === 'CC' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                                item.specType === 'SC' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                                'bg-zinc-800 text-zinc-400 border border-zinc-700'
                              }`}>
                                {item.specType}
                              </span>
                            </td>

                            {/* Control Method & Gauge */}
                            <td className="p-2.5 border border-zinc-700/80">
                              <div className="flex flex-col text-[11px]">
                                <span>{item.controlMethod}</span>
                                <span className="text-zinc-400 text-[10px] flex items-center gap-1 mt-0.5">
                                  <Gauge size={12} className="text-amber-400" />
                                  <span>{item.gaugeEquipment}</span>
                                </span>
                              </div>
                            </td>

                            {/* Target Value & Limits */}
                            <td className="p-2.5 border border-zinc-700/80 font-mono text-center text-[11px]">
                              <div className="flex flex-col">
                                <span className="text-emerald-400 font-bold">{item.targetValue}</span>
                                {item.lowerLimit !== null && item.upperLimit !== null && (
                                  <span className="text-[10px] text-zinc-400">
                                    [{item.lowerLimit} ~ {item.upperLimit}] {item.unit}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Frequency & Sample */}
                            <td className="p-2.5 border border-zinc-700/80 text-center text-[11px] text-zinc-300">
                              <div>{item.frequency}</div>
                              <div className="text-[10px] text-amber-300 font-bold">نمونه: {item.sampleSize}</div>
                            </td>

                            {/* Hourly Inspection Slot Direct Inputs */}
                            {currentBlockSlots.map(slot => {
                              const val = item.hourlySlots?.[slot] || '';
                              const valNum = parseFloat(val);
                              let isOut = false;
                              if (!isNaN(valNum) && item.lowerLimit !== null && item.upperLimit !== null) {
                                if (valNum < item.lowerLimit || valNum > item.upperLimit) {
                                  isOut = true;
                                }
                              }

                              return (
                                <td key={slot} className={`p-1 border border-zinc-700/80 text-center ${isOut ? 'bg-rose-950/60' : ''}`}>
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={(e) => handleUpdateHourlySlotValue(item.id, slot, e.target.value)}
                                    placeholder="—"
                                    className={`w-full text-center bg-zinc-950 border rounded py-1 text-xs font-mono font-bold focus:outline-none ${
                                      isOut ? 'border-rose-500 text-rose-300 animate-pulse' : 'border-zinc-700 text-white focus:border-amber-500'
                                    }`}
                                  />
                                </td>
                              );
                            })}

                            {/* Reaction Plan Column (Replaces Shift Result) */}
                            <td className="p-2 border border-zinc-700/80 bg-zinc-950/60 min-w-[180px]">
                              <input
                                type="text"
                                value={item.reactionPlan || ''}
                                onChange={(e) => handleUpdateItemReactionPlan(item.id, e.target.value)}
                                placeholder="مثال: توقف خط و اطلاع به سرپرست..."
                                className="w-full bg-zinc-900 border border-zinc-700 focus:border-amber-500 rounded px-2.5 py-1.5 text-xs text-amber-200 placeholder:text-zinc-600 focus:outline-none font-bold"
                              />
                            </td>

                            {/* Actions & Delete */}
                            <td className="p-2 border border-zinc-700/80 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {item.latestResult === 'fail' && (
                                  <button
                                    onClick={() => handleTriggerQuickCapa(item)}
                                    title="صدور CAPA برای خطای کنترل حین تولید"
                                    className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg transition-all cursor-pointer"
                                  >
                                    <AlertTriangle size={14} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  title="علامت‌گذاری برای حذف"
                                  className="p-1.5 hover:bg-rose-950/80 text-zinc-400 hover:text-rose-400 rounded-lg transition-all cursor-pointer"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

            </div>
          );
        })}

        </div>
      )}



      {/* =================================================================== */}
      {/* TAB 3: LOGGED RESULTS LOG SHEET                                    */}
      {/* =================================================================== */}
      {activeTab === 'results' && (
        <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="flex items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <CheckCircle2 className="text-emerald-400" size={18} />
                <span>سوابق و فرم لاگ ثبت نتایج کنترل حین تولید (Inspection Log Records)</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                لیست سوابق اندازه‌گیری شده، انحرافات ابداعی و وضعیت صدور گزارش‌های عدم انطباق (CAPA/NCR)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-300 bg-emerald-950 px-3 py-1 rounded-xl border border-emerald-800 font-bold">
                نرخ انطباق: {stats.passRate}٪
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse border border-zinc-700/80 divide-y divide-x divide-zinc-700/80 text-xs">
              <thead>
                <tr className="bg-zinc-900 text-zinc-300 font-bold border-b border-zinc-700">
                  <th className="p-3 border border-zinc-700/80 text-center w-10">#</th>
                  <th className="p-3 border border-zinc-700/80">عنوان مشخصه</th>
                  <th className="p-3 border border-zinc-700/80 text-center w-20">کلاس</th>
                  <th className="p-3 border border-zinc-700/80 text-center">حدود مجاز</th>
                  <th className="p-3 border border-zinc-700/80 text-center min-w-[120px]">مقدار اندازه‌گیری شده</th>
                  <th className="p-3 border border-zinc-700/80 text-center w-28">نتیجه</th>
                  <th className="p-3 border border-zinc-700/80">اپراتور / بازرس</th>
                  <th className="p-3 border border-zinc-700/80 text-center">تاریخ و زمان</th>
                  <th className="p-3 border border-zinc-700/80 text-center w-24">اقدام CAPA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/80 text-zinc-200">
                {loggedResults.map((res, idx) => (
                  <tr key={res.id} className="hover:bg-zinc-800/40">
                    <td className="p-3 border border-zinc-700/80 text-center font-bold text-zinc-400">{idx + 1}</td>
                    <td className="p-3 border border-zinc-700/80 font-bold text-white">{res.paramName}</td>
                    <td className="p-3 border border-zinc-700/80 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        res.specType === 'CC' ? 'bg-rose-500/20 text-rose-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {res.specType}
                      </span>
                    </td>
                    <td className="p-3 border border-zinc-700/80 text-center font-mono text-emerald-400">{res.targetValue}</td>
                    <td className="p-3 border border-zinc-700/80 text-center">
                      <input
                        type="text"
                        value={res.measuredValue}
                        onChange={(e) => handleUpdateMeasuredValue(res.id, e.target.value)}
                        className={`w-full text-center bg-zinc-950 border rounded py-1 text-xs font-mono font-bold focus:outline-none ${
                          res.isOutOfSpec ? 'border-rose-500 text-rose-300 animate-pulse' : 'border-zinc-700 text-white'
                        }`}
                      />
                    </td>
                    <td className="p-3 border border-zinc-700/80 text-center">
                      <button
                        onClick={() => handleToggleResultStatus(res.id)}
                        className={`px-3 py-1 rounded-xl text-xs font-black cursor-pointer ${
                          res.result === 'pass' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300 animate-pulse'
                        }`}
                      >
                        {res.result === 'pass' ? 'قبول' : 'مردود'}
                      </button>
                    </td>
                    <td className="p-3 border border-zinc-700/80 text-[11px]">
                      <div>{res.operatorName}</div>
                      <div className="text-[10px] text-zinc-400">{res.inspectorName}</div>
                    </td>
                    <td className="p-3 border border-zinc-700/80 text-center text-[11px] text-zinc-400 font-mono">
                      {res.date} - {res.time}
                    </td>
                    <td className="p-3 border border-zinc-700/80 text-center">
                      <button
                        onClick={() => handleTriggerQuickCapa(res)}
                        className="p-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        <AlertTriangle size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: DASHBOARD & ANALYTICS                                       */}
      {/* =================================================================== */}
      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-6 shadow-2xl col-span-2 space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
              <BarChart2 className="text-indigo-400" size={18} />
              <span>توزیع مشخصه‌های کنترلی به تفکیک دسته‌بندی بلوک‌ها</span>
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={blocks.map(b => ({ name: b.title.slice(3, 20), count: b.items.length }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={10} />
                  <YAxis stroke="#a1a1aa" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46' }} />
                  <Bar dataKey="count" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-zinc-800 pb-3">
              <ShieldCheck className="text-amber-400" size={18} />
              <span>نسبت مشخصه‌های ویژه (CC / SC)</span>
            </h3>
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={[
                      { name: 'بحرانی CC', value: stats.ccCount, color: '#f43f5e' },
                      { name: 'مهم SC', value: stats.scCount, color: '#f59e0b' },
                      { name: 'استاندارد', value: stats.totalItemsCount - stats.ccCount - stats.scCount, color: '#3b82f6' }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    <Cell fill="#f43f5e" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#3b82f6" />
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#3f3f46' }} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 5: AI DATA SOURCES & RULE ENGINE                                */}
      {/* =================================================================== */}
      {activeTab === 'ai_sources' && (
        <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6">
          {/* Subtabs Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setAiSubTab('sources')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  aiSubTab === 'sources'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-lg'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <Database size={16} />
                <span>۱۱ منبع اصلی داده QMS ({aiDataSources.length})</span>
              </button>

              <button
                onClick={() => setAiSubTab('rules')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                  aiSubTab === 'rules'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-lg'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                }`}
              >
                <Sparkles size={16} />
                <span>موتور قوانین هوشمند (Rule Engine)</span>
                <span className="bg-amber-500/30 text-amber-200 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {ruleEngineRules.length} قاعده فعال
                </span>
              </button>
            </div>

            {aiSubTab === 'sources' ? (
              <button
                onClick={() => setIsAddSourceModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-900/60 hover:bg-purple-900 text-purple-200 border border-purple-500/40 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <Plus size={16} />
                <span>اتصال منبع داده جدید</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  const currentStation = workstations.find(w => w.id === selectedStationId);
                  if (currentStation) {
                    generateStationBlocks(currentStation);
                    showToast('موتور قوانین با موفقیت بر روی ایستگاه کاری فعال اجرا و چک‌لیست بازتولید گردید.', 'success');
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs rounded-xl transition-all cursor-pointer shadow-lg"
              >
                <Zap size={16} />
                <span>ارزیابی و اجرای فوری موتور قوانین (Run Rules Now)</span>
              </button>
            )}
          </div>

          {/* SUBTAB 1: 11 DATA SOURCES */}
          {aiSubTab === 'sources' && (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400">
                موتور هوش مصنوعی سیستم QMS جهت تولید چک‌لیست‌های بلوکی و استخراج آیتم‌های کنترلی، داده‌های خود را از ۱۱ منبع زیر تحلیل و استخراج می‌نماید:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {aiDataSources.map(src => (
                  <div key={src.id} className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md hover:border-purple-500/40 transition-all">
                    <div>
                      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2.5">
                        <h4 className="text-xs font-black text-white flex items-center gap-2">
                          <Database size={15} className="text-purple-400 shrink-0" />
                          <span className="line-clamp-1">{src.name}</span>
                        </h4>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold whitespace-nowrap">
                          {src.connectionStatus}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">{src.description}</p>
                    </div>

                    <div className="space-y-2 border-t border-zinc-800/80 pt-2.5 text-[10px]">
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>جدول دیتابیس:</span>
                        <strong className="text-purple-300 font-mono">{src.tableName}</strong>
                      </div>
                      <div className="flex items-center justify-between text-zinc-400">
                        <span>ماژول‌های وابسته:</span>
                        <span className="text-zinc-300 font-bold">{src.usingModules.join(' ، ')}</span>
                      </div>
                      <div className="flex items-center justify-between text-zinc-500 pt-1 border-t border-zinc-800/50">
                        <span>قوانین وابسته: <strong className="text-amber-400">{src.dependentRulesCount}</strong></span>
                        <span>آخرین همگام‌سازی: {src.lastSync}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUBTAB 2: RULE ENGINE */}
          {aiSubTab === 'rules' && (
            <div className="space-y-5">
              <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 flex items-start gap-3 text-xs">
                <Sparkles className="text-amber-400 shrink-0 mt-0.5" size={20} />
                <div className="space-y-1">
                  <h4 className="font-black text-amber-200">موتور قوانین استخراج آیتم‌های کنترلی (QMS Rule Engine)</h4>
                  <p className="text-amber-300/80 text-[11px] leading-relaxed">
                    این قوانین بر اساس مشخصات ایستگاه کاری، نوع محصول، نوع عملیات، ماشین، مشخصه‌های ویژه (SC/CC)، ریسک‌های PFMEA و CSR مشتری، آیتم‌های کنترلی چک‌لیست را به صورت هوشمند ایجاد یا به‌روزرسانی می‌کنند.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {ruleEngineRules.map(rule => (
                  <div key={rule.id} className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-black">
                          {rule.category}
                        </span>
                        <h4 className="text-xs font-black text-white">{rule.name}</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                        <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                          <span className="text-zinc-500 font-bold block mb-0.5">شرط تحریک (Condition):</span>
                          <span className="text-zinc-300 font-medium">{rule.conditionText}</span>
                        </div>
                        <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800/80">
                          <span className="text-emerald-400 font-bold block mb-0.5">اقدام قانون (Action):</span>
                          <span className="text-emerald-200 font-medium">{rule.actionText}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 border-t md:border-t-0 md:border-r border-zinc-800 pt-3 md:pt-0 md:pr-4 shrink-0">
                      <span className="text-[10px] text-zinc-400 font-bold">منبع: {rule.targetSource}</span>
                      <button
                        onClick={() => {
                          setRuleEngineRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r));
                          showToast(`وضعیت قانون "${rule.name}" تغییر یافت.`, 'info');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          rule.isActive
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                        }`}
                      >
                        {rule.isActive ? 'فعال' : 'غیرفعال'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 6: REVISION HISTORY & AUDIT TRAIL                               */}
      {/* =================================================================== */}
      {activeTab === 'history' && (
        <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-6 shadow-2xl space-y-6">
          <div className="border-b border-zinc-800 pb-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <History className="text-amber-400" size={18} />
              <span>تاریخچه سوابق بازنگری سند و ردیابی تغییرات (Audit Trail & Revision History)</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              ثبت غیرقابل تغییر تمام بازنگری‌ها، تغییرات تصویب شده توسط کاربر و نسخه‌های سند
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse border border-zinc-700/80 divide-y divide-x divide-zinc-700/80 text-xs">
              <thead>
                <tr className="bg-zinc-900 text-zinc-300 font-bold border-b border-zinc-700">
                  <th className="p-3 border border-zinc-700/80 text-center w-20">نسخه</th>
                  <th className="p-3 border border-zinc-700/80 text-center">تاریخ تصویب</th>
                  <th className="p-3 border border-zinc-700/80">شرح تغییرات</th>
                  <th className="p-3 border border-zinc-700/80">ایجادکننده / نویسنده</th>
                  <th className="p-3 border border-zinc-700/80">تأییدکننده</th>
                  <th className="p-3 border border-zinc-700/80 text-center">تعداد آیتم‌ها</th>
                  <th className="p-3 border border-zinc-700/80 text-center">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-700/80 text-zinc-200">
                {revisions.map((rev) => (
                  <tr key={rev.id} className="hover:bg-zinc-800/40">
                    <td className="p-3 border border-zinc-700/80 text-center font-black text-amber-400">v{rev.version}</td>
                    <td className="p-3 border border-zinc-700/80 text-center font-mono">{rev.date}</td>
                    <td className="p-3 border border-zinc-700/80">{rev.changesSummary}</td>
                    <td className="p-3 border border-zinc-700/80">{rev.author}</td>
                    <td className="p-3 border border-zinc-700/80">{rev.approvedBy}</td>
                    <td className="p-3 border border-zinc-700/80 text-center font-bold">{rev.itemCount}</td>
                    <td className="p-3 border border-zinc-700/80 text-center">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {rev.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: ADD MANUAL WORKSTATION                                     */}
      {/* =================================================================== */}
      {isAddStationModalOpen && (
        <div className="fixed inset-0 z-[9990] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141418] border border-zinc-700 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Building className="text-emerald-400" size={18} />
                <span>تعریف و افزودن دستی ایستگاه کاری جدید</span>
              </h3>
              <button
                onClick={() => setIsAddStationModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-300 font-bold block mb-1">کد ایستگاه:</label>
                  <input
                    type="text"
                    value={newStationForm.stationCode}
                    onChange={(e) => setNewStationForm({ ...newStationForm, stationCode: e.target.value })}
                    placeholder="مثال: WS-40"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-zinc-300 font-bold block mb-1">نام ایستگاه کاری:</label>
                  <input
                    type="text"
                    value={newStationForm.stationName}
                    onChange={(e) => setNewStationForm({ ...newStationForm, stationName: e.target.value })}
                    placeholder="مثال: مونتاژ و تست نشتی"
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-300 font-bold block mb-1">تجهیزات تولیدی مورد استفاده (با «،» جدا کنید):</label>
                <input
                  type="text"
                  value={newStationForm.equipmentInput}
                  onChange={(e) => setNewStationForm({ ...newStationForm, equipmentInput: e.target.value })}
                  placeholder="مثال: پرس هیدرولیک ۵۰ تن، دستگاه تست نشتی فشار هوا"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-zinc-300 font-bold block mb-1">اقلام و مواد ورودی به ایستگاه:</label>
                <input
                  type="text"
                  value={newStationForm.inputItemsInput}
                  onChange={(e) => setNewStationForm({ ...newStationForm, inputItemsInput: e.target.value })}
                  placeholder="مثال: پوسته آلومینیومی، واشر آب‌بندی لاستیکی"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="text-zinc-300 font-bold block mb-1">محصول / قطعه خروجی ایستگاه:</label>
                <input
                  type="text"
                  value={newStationForm.outputProduct}
                  onChange={(e) => setNewStationForm({ ...newStationForm, outputProduct: e.target.value })}
                  placeholder="مثال: پوسته مونتاژ شده تست شده آماده مونتاژ نهایی"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-4">
              <button
                onClick={() => setIsAddStationModalOpen(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                onClick={handleCreateCustomWorkstation}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg"
              >
                ایجاد ایستگاه و تولید چک‌لیست
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: FULL-SCREEN PRINT & CUSTOMIZER OVERLAY                      */}
      {/* =================================================================== */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-[100] bg-[#0A0A0D] flex flex-col w-full h-full overflow-hidden" dir="rtl">
          {/* Inject Dynamic CSS Print Page Size Rule & Smart Page Breaking */}
          <style>
            {`
              @media print {
                @page {
                  size: ${printOrientation};
                  margin: 6mm 6mm 8mm 6mm;
                }
                body {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  background-color: #ffffff !important;
                }
                .print-block-card {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                  margin-bottom: 12px !important;
                }
                .print-header-card {
                  page-break-after: avoid !important;
                  break-after: avoid !important;
                }
                .print-footer-signatures {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                table {
                  page-break-inside: auto !important;
                  width: 100% !important;
                  table-layout: auto !important;
                }
                tr {
                  page-break-inside: avoid !important;
                  break-inside: avoid !important;
                }
                th, td {
                  word-break: break-word !important;
                  overflow-wrap: break-word !important;
                }
              }
            `}
          </style>

          {/* Top Sticky Bar - Fullscreen Navigation & Range Controls */}
          <div className="bg-[#14141A] border-b border-[#25252D] px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-white shrink-0 shadow-xl print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
                <Printer size={22} />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <span>
                    پیش‌نمایش و چاپ کنترل حین تولید - ایستگاه ({currentStation?.stationName || selectedStationId})
                  </span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    تمام صفحه
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 mt-0.5">IATF 16949 § 8.5.1.1 & 9.1.1.1 - In-Process Control Checklist Dossier</p>
              </div>
            </div>

            {/* Print Mode & Orientation & Customizer Controls */}
            <div className="flex flex-wrap items-center gap-2 bg-[#1A1A22] p-1.5 rounded-2xl border border-[#2A2A35]">
              {/* Orientation Selector */}
              <div className="flex items-center gap-1 bg-[#0F0F12] p-1 rounded-xl border border-[#2A2A35]">
                <button
                  onClick={() => setPrintOrientation('portrait')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    printOrientation === 'portrait' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                  title="جهت چاپ عمودی (Portrait)"
                >
                  <FileText size={13} />
                  <span>عمودی</span>
                </button>
                <button
                  onClick={() => setPrintOrientation('landscape')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    printOrientation === 'landscape' ? 'bg-amber-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                  title="جهت چاپ افقی (Landscape)"
                >
                  <FileSpreadsheet size={13} />
                  <span>افقی</span>
                </button>
              </div>

              <div className="h-4 w-px bg-[#2A2A35] mx-1" />

              {/* Customize Drawer Toggle */}
              <button
                onClick={() => setIsPrintConfigPanelOpen(!isPrintConfigPanelOpen)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
                  isPrintConfigPanelOpen
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold shadow-md'
                    : 'bg-[#252530] text-slate-200 border-[#323240] hover:bg-[#2A2A38]'
                }`}
              >
                <Sliders size={14} />
                <span>ویرایش هدر، فوتر و لوگو</span>
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSavePdfToRecordsLedger}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 transition-all cursor-pointer flex items-center gap-2"
                title="ذخیره خودکار سابقه و فایل PDF در پوشه اختصاصی سوابق کیفیت"
              >
                <BookmarkPlus size={16} />
                <span>ذخیره فایل PDF در لیست سوابق</span>
              </button>

              <button
                onClick={() => window.print()}
                className="px-6 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/30 transition-all cursor-pointer flex items-center gap-2"
              >
                <Printer size={16} />
                <span>چاپ / خروجی PDF</span>
              </button>

              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-[#252530] hover:bg-[#2A2A38] text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 border border-[#323240]"
              >
                <X size={16} />
                <span>خروج از پیش‌نمایش</span>
              </button>
            </div>
          </div>

          {/* Collapsible Customization Config Panel */}
          {isPrintConfigPanelOpen && (
            <div className="bg-[#111827] border-b border-amber-500/30 px-6 py-5 text-white shrink-0 shadow-2xl print:hidden animate-in slide-in-from-top-2">
              <div className="max-w-7xl mx-auto flex flex-col gap-4">
                
                {/* Header Title + Auto-Detect Master Button */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sliders size={18} className="text-amber-400" />
                    <div>
                      <h3 className="text-xs font-black text-amber-400">
                        تنظیمات دیتابیس محور هدر، شناسنامه سند، کد ISO و امضاکنندگان کنترل حین تولید
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        قابلیت بارگذاری خودکار و انتخاب مستقیم از منوهای کشویی دیتابیس QMS
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleAutoDetectQmsDbData}
                      className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition-all cursor-pointer flex items-center gap-2 border border-amber-300 active:scale-95"
                      title="استخراج و جایگذاری خودکار اطلاعات از جدول محصولات، کنترل اسناد ISO و کاربران"
                    >
                      <Sparkles size={14} className="animate-spin" />
                      <span>شناسایی و بارگذاری خودکار از دیتابیس QMS</span>
                    </button>

                    <button
                      onClick={() => setIsPrintConfigPanelOpen(false)}
                      className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 transition-all border border-slate-700 cursor-pointer"
                    >
                      بستن ×
                    </button>
                  </div>
                </div>

                {/* Collapsible Database Accordion Selector Bar */}
                {(() => {
                  const dbData = getQmsDbPrintData();
                  return (
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 ml-2">
                          <Database size={13} className="text-amber-400" />
                          <span>منوهای کشویی بازشونده دیتابیس:</span>
                        </span>

                        <button
                          onClick={() => setActiveDbPickerTab(activeDbPickerTab === 'products' ? null : 'products')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                            activeDbPickerTab === 'products'
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          <span>📦 دیتابیس محصولات ({dbData.products.length})</span>
                          <ChevronDown size={14} className={`transition-transform ${activeDbPickerTab === 'products' ? 'rotate-180' : ''}`} />
                        </button>

                        <button
                          onClick={() => setActiveDbPickerTab(activeDbPickerTab === 'docs' ? null : 'docs')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                            activeDbPickerTab === 'docs'
                              ? 'bg-emerald-600 text-white border-emerald-400 font-black shadow-md'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          <span>📄 کنترل اسناد ISO ({dbData.docControls.length})</span>
                          <ChevronDown size={14} className={`transition-transform ${activeDbPickerTab === 'docs' ? 'rotate-180' : ''}`} />
                        </button>

                        <button
                          onClick={() => setActiveDbPickerTab(activeDbPickerTab === 'orgs' ? null : 'orgs')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                            activeDbPickerTab === 'orgs'
                              ? 'bg-indigo-600 text-white border-indigo-400 font-black shadow-md'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          <span>🏢 لیست سازمان‌ها ({dbData.orgs.length})</span>
                          <ChevronDown size={14} className={`transition-transform ${activeDbPickerTab === 'orgs' ? 'rotate-180' : ''}`} />
                        </button>

                        <button
                          onClick={() => setActiveDbPickerTab(activeDbPickerTab === 'signers' ? null : 'signers')}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                            activeDbPickerTab === 'signers'
                              ? 'bg-amber-600 text-white border-amber-400 font-black shadow-md'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          <span>✍️ کاربران و امضاکنندگان ({dbData.personnel.length})</span>
                          <ChevronDown size={14} className={`transition-transform ${activeDbPickerTab === 'signers' ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      {/* Expanded Accordion Drawer for Products */}
                      {activeDbPickerTab === 'products' && (
                        <div className="bg-slate-900/95 border border-amber-500/40 p-4 rounded-2xl animate-in fade-in zoom-in-95 mt-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                              <Database size={14} />
                              <span>انتخاب محصول و شماره فنی مستقیم از رکورد دیتابیس:</span>
                            </span>
                            <span className="text-[10px] text-slate-400">با کلیک روی هر مورد، نام محصول و شماره فنی تنظیم می‌گردند.</span>
                          </div>
                          {dbData.products.length === 0 ? (
                            <p className="text-xs text-slate-400 italic p-2">محصولی در دیتابیس یافت نشد. می‌توانید نام محصول را به صورت دستی در فرم زیر وارد نمایید.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                              {dbData.products.map((prod, pIdx) => (
                                <button
                                  key={pIdx}
                                  onClick={() => {
                                    if (prod.name) setSelectedProduct(prod.name);
                                    if (prod.partNo) setSelectedPartNo(prod.partNo);
                                    showToast(`محصول "${prod.name}" با پارت‌نامبر "${prod.partNo || '—'}" انتخاب گردید.`, 'success');
                                  }}
                                  className="text-right p-2.5 rounded-xl bg-slate-950 hover:bg-amber-950/60 border border-slate-800 hover:border-amber-500 transition-all cursor-pointer flex flex-col gap-1 group"
                                >
                                  <span className="font-extrabold text-white text-xs group-hover:text-amber-300">{prod.name}</span>
                                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                                    <span>Part No: <strong className="font-mono text-amber-300">{prod.partNo || '—'}</strong></span>
                                    <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300">{prod.source}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expanded Accordion Drawer for ISO Docs */}
                      {activeDbPickerTab === 'docs' && (
                        <div className="bg-slate-900/95 border border-emerald-500/40 p-4 rounded-2xl animate-in fade-in zoom-in-95 mt-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                              <FileCheck size={14} />
                              <span>انتخاب کد سند رسمی و ویرایش از جدول کنترل اسناد ISO:</span>
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                            {dbData.docControls.map((doc, dIdx) => (
                              <button
                                key={dIdx}
                                onClick={() => {
                                  setPrintDocCode(doc.code);
                                  setSelectedRevision(doc.revision);
                                  if (doc.title) setPrintReportTitle(doc.title);
                                  showToast(`کد سند "${doc.code}" با ویرایش "${doc.revision}" تنظیم شد.`, 'success');
                                }}
                                className="text-right p-2.5 rounded-xl bg-slate-950 hover:bg-emerald-950/60 border border-slate-800 hover:border-emerald-500 transition-all cursor-pointer flex flex-col gap-1 group"
                              >
                                <span className="font-extrabold text-amber-300 font-mono text-xs group-hover:text-emerald-300">{doc.code}</span>
                                <span className="text-[11px] text-slate-200 line-clamp-1">{doc.title}</span>
                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                  <span>ویرایش: <strong className="text-emerald-400 font-mono">{doc.revision}</strong></span>
                                  <span className="text-[9px] bg-emerald-900/40 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-500/30">{doc.status}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Manual Text Inputs Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800 text-xs">
                  <div>
                    <label className="text-slate-300 font-extrabold block mb-1">نام سازمان / کارخانه:</label>
                    <input
                      type="text"
                      value={printOrgName}
                      onChange={(e) => setPrintOrgName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-extrabold block mb-1">عنوان فرم کنترل:</label>
                    <input
                      type="text"
                      value={printReportTitle}
                      onChange={(e) => setPrintReportTitle(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-extrabold block mb-1">کد سند ISO:</label>
                    <input
                      type="text"
                      value={printDocCode}
                      onChange={(e) => setPrintDocCode(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-amber-300 font-mono font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-slate-300 font-extrabold block mb-1">شماره بازنگری / نسخه:</label>
                    <input
                      type="text"
                      value={selectedRevision}
                      onChange={(e) => setSelectedRevision(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-emerald-300 font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Signatures Inputs Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800 text-xs">
                  <div>
                    <label className="text-slate-300 font-extrabold block mb-1">تکمیل‌کننده (کارشناس کیفی):</label>
                    <input
                      type="text"
                      value={printSigner1Name}
                      onChange={(e) => setPrintSigner1Name(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-extrabold block mb-1">تأییدکننده فنی (سرپرست خط):</label>
                    <input
                      type="text"
                      value={printSigner2Name}
                      onChange={(e) => setPrintSigner2Name(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-extrabold block mb-1">تصویب‌کننده (مدیر تضمین کیفیت):</label>
                    <input
                      type="text"
                      value={printSigner3Name}
                      onChange={(e) => setPrintSigner3Name(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-bold"
                    />
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* PRINT DOCUMENT PREVIEW CANVAS (A4 PRINT VIEW WITH FULL GRIDLINES) */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 flex justify-center bg-[#070709]">
            <div className={`bg-white text-slate-950 p-6 sm:p-8 rounded-lg shadow-2xl font-farsi border-2 border-slate-900 ${
              printOrientation === 'landscape' ? 'w-[1120px] min-h-[790px]' : 'w-[820px] min-h-[1080px]'
            }`}>
              
              {/* PRINT HEADER BLOCK */}
              <div className="print-header-card border-2 border-slate-900 p-3 mb-4 grid grid-cols-4 items-center gap-2 text-center text-xs bg-slate-50">
                <div className="border-l-2 border-slate-900 p-2 font-black text-slate-900 flex flex-col items-center justify-center gap-1">
                  {printLogoUrl && (
                    <img src={printLogoUrl} alt="Logo" className="h-10 max-w-[100px] object-contain mb-1" />
                  )}
                  <span>{printOrgName}</span>
                </div>
                <div className="col-span-2 border-l-2 border-slate-900 p-2">
                  <h1 className="text-base font-black text-slate-900">{printReportTitle}</h1>
                  <p className="text-[11px] font-extrabold text-slate-700 mt-1">ایستگاه کاری: {currentStation?.stationName || selectedStationId}</p>
                </div>
                <div className="p-2 text-[11px] space-y-1 text-slate-900 font-bold">
                  <div>شماره سند: <strong className="font-mono text-blue-900">{printDocCode}</strong></div>
                  <div>نسخه: <strong className="font-mono text-emerald-800">{selectedRevision}</strong></div>
                  <div>تاریخ: <strong className="font-mono">{new Date().toLocaleDateString('fa-IR')}</strong></div>
                </div>
              </div>

              {/* STATION METADATA SUMMARY TABLE */}
              <div className="print-header-card border-2 border-slate-900 p-3 mb-4 text-[11px] grid grid-cols-3 gap-2 bg-slate-100 font-extrabold border-collapse">
                <div className="border-b border-slate-400 pb-1">کد ایستگاه: <strong className="text-slate-950">{currentStation?.stationCode || selectedStationId}</strong></div>
                <div className="border-b border-slate-400 pb-1">محصول: <strong className="text-slate-950">{selectedProduct}</strong></div>
                <div className="border-b border-slate-400 pb-1">کد قطعه: <strong className="text-slate-950">{selectedPartNo}</strong></div>
                <div>تجهیزات ایستگاه: <strong className="text-slate-950">{currentStation?.equipmentList?.join('، ') || 'دستگاه‌های تولیدی ایستگاه'}</strong></div>
                <div>مواد ورودی: <strong className="text-slate-950">{currentStation?.inputItems?.join('، ') || 'اقلام ورودی ایستگاه'}</strong></div>
                <div>محصول خروجی: <strong className="text-slate-950">{currentStation?.outputProduct || 'محصول نهایی ایستگاه'}</strong></div>
              </div>

              {/* PRINT BLOCKS & CHECKLIST TABLE WITH GRIDLINES */}
              <div className="space-y-4">
                {blocks.map((b) => {
                  const currentBlockSlots = b.timeSlots || timeSlots;
                  return (
                    <div key={b.id} className="print-block-card border-2 border-slate-900 p-2.5 bg-white rounded-sm">
                      <h3 className="text-xs font-black bg-slate-200 p-2 border border-slate-900 mb-2.5 text-slate-950 flex items-center justify-between">
                        <span>{b.title}</span>
                        <span className="text-[10px] font-bold text-slate-700">تعداد آیتم‌های کنترلی: {b.items.length}</span>
                      </h3>
                      <table className="w-full text-right border-collapse border-2 border-slate-900 text-[10px]">
                        <thead>
                          <tr className="bg-slate-200 border-b-2 border-slate-900 font-black text-slate-950">
                            <th className="p-1.5 border border-slate-900 text-center w-7">#</th>
                            <th className="p-1.5 border border-slate-900">مشخصه کنترلی</th>
                            <th className="p-1.5 border border-slate-900 text-center w-10">کلاس</th>
                            <th className="p-1.5 border border-slate-900">روش کنترل و تجهیز گیج</th>
                            <th className="p-1.5 border border-slate-900 text-center">حدود مجاز / Target</th>
                            <th className="p-1.5 border border-slate-900 text-center">نمونه / فرکانس</th>
                            {currentBlockSlots.map(s => (
                              <th key={s} className="p-1 border border-slate-900 text-center font-mono">{s}</th>
                            ))}
                            <th className="p-1.5 border border-slate-900 text-center min-w-[120px]">اقدام واکنشی</th>
                          </tr>
                        </thead>
                        <tbody>
                          {b.items.map((itm, i) => (
                            <tr key={itm.id} className="border-b border-slate-900 hover:bg-slate-50 font-bold">
                              <td className="p-1.5 border border-slate-900 text-center font-black">{i + 1}</td>
                              <td className="p-1.5 border border-slate-900 font-extrabold text-slate-900">{itm.paramName}</td>
                              <td className="p-1.5 border border-slate-900 text-center font-black">
                                <span className={`px-1 py-0.5 rounded text-[9px] ${
                                  itm.specType === 'CC' ? 'bg-red-200 text-red-900 border border-red-500' :
                                  itm.specType === 'SC' ? 'bg-amber-200 text-amber-900 border border-amber-500' : 'bg-slate-100 text-slate-800'
                                }`}>
                                  {itm.specType}
                                </span>
                              </td>
                              <td className="p-1.5 border border-slate-900 text-slate-800">{itm.controlMethod} ({itm.gaugeEquipment})</td>
                              <td className="p-1.5 border border-slate-900 text-center font-mono font-bold text-slate-950">{itm.targetValue}</td>
                              <td className="p-1.5 border border-slate-900 text-center text-slate-800">{itm.sampleSize} / {itm.frequency}</td>
                              {currentBlockSlots.map(s => (
                                <td key={s} className="p-1 border border-slate-900 text-center font-bold font-mono text-slate-950">
                                  {itm.hourlySlots?.[s] || '—'}
                                </td>
                              ))}
                              <td className="p-1.5 border border-slate-900 text-right font-medium text-slate-900 text-[10px]">
                                {itm.reactionPlan || 'توقف خط و اطلاع به سرپرست'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>

              {/* PRINT FOOTER SIGNATURE BLOCK */}
              <div className="print-footer-signatures border-2 border-slate-900 p-3 mt-6 grid grid-cols-3 gap-4 text-center text-xs bg-slate-50 font-extrabold">
                <div className="border-l-2 border-slate-900 p-3 flex flex-col justify-between h-28">
                  <div className="font-black text-slate-900">تنظیم / بازرس کیفی</div>
                  <div className="text-slate-800 font-extrabold">{printSigner1Name}</div>
                  <div className="text-[10px] text-slate-500">امضا و تاریخ: .............................</div>
                </div>
                <div className="border-l-2 border-slate-900 p-3 flex flex-col justify-between h-28">
                  <div className="font-black text-slate-900">تأییدکننده فنی / سرپرست خط</div>
                  <div className="text-slate-800 font-extrabold">{printSigner2Name}</div>
                  <div className="text-[10px] text-slate-500">امضا و تاریخ: .............................</div>
                </div>
                <div className="p-3 flex flex-col justify-between h-28">
                  <div className="font-black text-slate-900">تصویب‌کننده / مدیر تضمین کیفیت</div>
                  <div className="text-slate-800 font-extrabold">{printSigner3Name}</div>
                  <div className="text-[10px] text-slate-500">امضا و تاریخ: .............................</div>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: COLUMN MANAGEMENT (ADD / DELETE COLUMN)                     */}
      {/* =================================================================== */}
      {columnModalState.isOpen && (
        <div className="fixed inset-0 z-[9995] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#141418] border border-zinc-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                {columnModalState.mode.startsWith('add') ? (
                  <>
                    <Columns className="text-cyan-400" size={18} />
                    <span>
                      {columnModalState.mode === 'add_single'
                        ? 'افزودن ستون جدید بازرسی به این ایستگاه'
                        : 'افزودن عمومی ستون جدید بازرسی به تمامی ایستگاه‌ها'}
                    </span>
                  </>
                ) : (
                  <>
                    <Trash2 className="text-rose-400" size={18} />
                    <span>
                      {columnModalState.mode === 'delete_single'
                        ? 'حذف ستون بازرسی از چک‌لیست این ایستگاه'
                        : 'حذف عمومی ستون بازرسی از تمامی ایستگاه‌ها'}
                    </span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setColumnModalState(prev => ({ ...prev, isOpen: false }))}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {columnModalState.mode.startsWith('add') ? (
                <div>
                  <label className="text-zinc-300 font-bold block mb-1.5">
                    عنوان یا زمان نوبت بازرسی (مثال: ۱۶:۰۰ یا نوبت بازرسی ۵):
                  </label>
                  <input
                    type="text"
                    value={columnModalState.columnName}
                    onChange={(e) => setColumnModalState(prev => ({ ...prev, columnName: e.target.value }))}
                    placeholder="عنوان ستون را وارد کنید..."
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-cyan-300 font-bold focus:outline-none focus:border-cyan-500"
                  />
                  <p className="text-[11px] text-zinc-400 mt-2">
                    پس از افزودن، این ستون در جدول ثبت نتایج شیفت اضافه شده و سلول‌های آن آماده درج مقادیر تأیید/رد یا عددی خواهند بود.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="text-zinc-300 font-bold block mb-1.5">
                    انتخاب ستونی که قصد حذف آن را دارید:
                  </label>
                  <select
                    value={columnModalState.selectedSlotToDelete}
                    onChange={(e) => setColumnModalState(prev => ({ ...prev, selectedSlotToDelete: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-rose-300 font-bold focus:outline-none focus:border-rose-500"
                  >
                    {(() => {
                      const targetBlock = blocks.find(b => b.id === columnModalState.blockId);
                      const availableSlots = columnModalState.blockId ? (targetBlock?.timeSlots || timeSlots) : timeSlots;
                      return availableSlots.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ));
                    })()}
                  </select>
                  <p className="text-[11px] text-rose-400/80 mt-2">
                    هشدار: با حذف ستون، تمام داده‌های ثبت‌شده مرتبط با این زمان در جدول پاک خواهد شد.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-zinc-800 pt-4">
              <button
                onClick={() => setColumnModalState(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-bold"
              >
                انصراف
              </button>
              <button
                onClick={handleConfirmColumnAction}
                className={`px-5 py-2 rounded-xl text-xs font-black shadow-lg cursor-pointer ${
                  columnModalState.mode.startsWith('add')
                    ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                    : 'bg-rose-600 hover:bg-rose-500 text-white'
                }`}
              >
                {columnModalState.mode.startsWith('add') ? 'افزودن ستون' : 'حذف ستون'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
