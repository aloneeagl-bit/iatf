import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  CheckCircle2, XCircle, AlertTriangle, Database, Search, Plus, Trash2, Edit3, 
  Printer, Download, QrCode, Barcode, ShieldCheck, Layers, Settings, Cpu, 
  FileText, RefreshCw, History, UserCheck, FilePlus, HelpCircle, Filter, 
  Sliders, ChevronDown, ChevronUp, Copy, Check, Eye, Link2, X, ArrowUp, ArrowDown,
  Sparkles, AlertCircle, FileCheck, Shield, Lock, FileSpreadsheet, Share2, Activity,
  Award, Terminal, CheckSquare, Square, Maximize2, Minimize2, ClipboardCheck, Gauge, Zap, Wrench, Pin, PlusCircle, Upload, Image, Building, BookmarkPlus
} from 'lucide-react';
import { QmsDatabase } from '../lib/qmsDatabase';
import { documentTemplates, DocItem } from '../data/documentTemplates';
import InProcessControlModule from './InProcessControlModule';

export interface SetupCustomColumn {
  id: string;
  name: string;
}

export interface SetupCheckItem {
  id: string;
  stepNo: number;
  stationId: string; // e.g., 'WS-101', 'WS-102', 'WS-104', 'WS-106', 'WS-108'
  category: 'safety' | 'tooling' | 'parameters' | 'material' | 'quality_first_off';
  parameterName: string;
  controlType: 'Safety' | 'CC' | 'SC' | 'Standard' | 'Legal';
  targetValue: string;
  measuredValue?: string;
  gaugeTool: string;
  calibrationStatus?: 'valid' | 'expired' | 'pending' | 'na';
  calibrationExpiry?: string;
  methodFrequency: string;
  reactionPlan: string;
  sourceModule: string; // e.g. 'KPC/CC Spec', 'KCC/SC Spec', 'Product-Process Matrix', 'Control Plan', 'PFD', 'PFMEA', 'SWI', 'Calibration', 'PM'
  sourceTable: string;
  sourceColumn: string;
  sourceRecordKey: string;
  selectionLogic: string;
  verified: boolean;
  notes?: string;
  diffStatus?: 'unchanged' | 'added' | 'edited' | 'deleted';
  originalValue?: Partial<SetupCheckItem>;
  customFields?: Record<string, string>;
}

export interface ReferenceDocMetadata {
  clauseNo: string;      // e.g. "بند ۱"
  clauseCode: string;    // e.g. "S-01"
  shortCode: string;     // e.g. "PFD"
  badgeText: string;     // e.g. "[S-01] PFD"
  fullTitle: string;     // e.g. "نمودار جریان فرآیند (PFD)"
  clauseLabel: string;   // e.g. "بند ۱ - PFD"
}

export const DOC_TYPE_METADATA: Record<string, ReferenceDocMetadata> = {
  PFD: { clauseNo: 'بند ۸.۳.۵.۲ IATF', clauseCode: 'IATF 8.3.5.2', shortCode: 'PFD', badgeText: '[IATF 8.3.5.2] PFD', fullTitle: 'نمودار جریان فرآیند (PFD / Process Flow Diagram)', clauseLabel: 'بند ۸.۳.۵.۲ IATF - نمودار جریان فرآیند (PFD)' },
  ControlPlan: { clauseNo: 'بند ۸.۵.۱.۱ IATF', clauseCode: 'IATF 8.5.1.1', shortCode: 'CP', badgeText: '[IATF 8.5.1.1] ControlPlan', fullTitle: 'طرح کنترل (Control Plan)', clauseLabel: 'بند ۸.۵.۱.۱ IATF - طرح کنترل (Control Plan)' },
  PFMEA: { clauseNo: 'بند ۸.۳.۵.۲ IATF', clauseCode: 'IATF 8.3.5.2', shortCode: 'PFMEA', badgeText: '[IATF 8.3.5.2] PFMEA', fullTitle: 'آنالیز حالات و آثار خرابی فرآیند (PFMEA)', clauseLabel: 'بند ۸.۳.۵.۲ IATF - آنالیز حالات و آثار خرابی (PFMEA)' },
  SWI: { clauseNo: 'بند ۸.۵.۱.۲ IATF', clauseCode: 'IATF 8.5.1.2', shortCode: 'SWI', badgeText: '[IATF 8.5.1.2] SWI', fullTitle: 'دستورالعمل‌های کاری استاندارد (SWI)', clauseLabel: 'بند ۸.۵.۱.۲ IATF - دستورالعمل‌های کاری (SWI)' },
  MasterData: { clauseNo: 'بند ۸.۵.۱.۵ IATF', clauseCode: 'IATF 8.5.1.5', shortCode: 'Master', badgeText: '[IATF 8.5.1.5] MasterData', fullTitle: 'اطلاعات پایه تجهیزات و ابزارآلات (Master Data)', clauseLabel: 'بند ۸.۵.۱.۵ IATF - اطلاعات پایه (Master Data)' },
  Calibration: { clauseNo: 'بند ۷.۱.۵.۲ IATF', clauseCode: 'IATF 7.1.5.2', shortCode: 'Calib', badgeText: '[IATF 7.1.5.2] Calibration', fullTitle: 'جدول کالیبراسیون تجهیزات و گیج‌ها (Calibration)', clauseLabel: 'بند ۷.۱.۵.۲ IATF - کالیبراسیون گیج‌ها' },
  PM: { clauseNo: 'بند ۸.۵.۱.۵ IATF', clauseCode: 'IATF 8.5.1.5', shortCode: 'PM', badgeText: '[IATF 8.5.1.5] PM', fullTitle: 'جدول نگهداری و تعمیرات پیشگیرانه (PM)', clauseLabel: 'بند ۸.۵.۱.۵ IATF - نت پیشگیرانه (PM)' },
  Material: { clauseNo: 'بند ۸.۴.۲.۴ IATF', clauseCode: 'IATF 8.4.2.4', shortCode: 'Material', badgeText: '[IATF 8.4.2.4] Material', fullTitle: 'سرتیفیکیت و شناسنامه مواد اولیه (Raw Materials)', clauseLabel: 'بند ۸.۴.۲.۴ IATF - شناسنامه مواد اولیه' },
  CSR: { clauseNo: 'بند ۴.۳.۲ IATF', clauseCode: 'IATF 4.3.2', shortCode: 'CSR', badgeText: '[IATF 4.3.2] CSR', fullTitle: 'الزامات خاص مشتریان (CSR)', clauseLabel: 'بند ۴.۳.۲ IATF - الزامات خاص مشتری (CSR)' },
  ECN: { clauseNo: 'بند ۸.۵.۶.۱ IATF', clauseCode: 'IATF 8.5.6.1', shortCode: 'ECN', badgeText: '[IATF 8.5.6.1] ECN/ECR', fullTitle: 'جدول تغییرات مهندسی (ECN / ECR)', clauseLabel: 'بند ۸.۵.۶.۱ IATF - تغییرات مهندسی (ECN)' },
  CAPA: { clauseNo: 'بند ۱۰.۲.۳ IATF', clauseCode: 'IATF 10.2.3', shortCode: 'CAPA', badgeText: '[IATF 10.2.3] NCR/CAPA', fullTitle: 'گزارش‌های عدم انطباق و اقدامات اصلاحی (NCR / CAPA)', clauseLabel: 'بند ۱۰.۲.۳ IATF - گزارش‌های NCR/CAPA' },
  LessonLearned: { clauseNo: 'بند ۷.۱.۶ IATF', clauseCode: 'IATF 7.1.6', shortCode: 'Lesson', badgeText: '[IATF 7.1.6] Lessons', fullTitle: 'پایگاه دانش و دروس آموخته (Lessons Learned)', clauseLabel: 'بند ۷.۱.۶ IATF - دروس آموخته (Lessons)' },
  KPC: { clauseNo: 'بند ۸.۳.۳.۳ IATF', clauseCode: 'IATF 8.3.3.3', shortCode: 'KPC', badgeText: '[IATF 8.3.3.3] KPC', fullTitle: 'مشخصه‌های مهم محصول (KPC)', clauseLabel: 'بند ۸.۳.۳.۳ IATF - مشخصه‌های محصول (KPC)' },
  KCC: { clauseNo: 'بند ۸.۳.۳.۳ IATF', clauseCode: 'IATF 8.3.3.3', shortCode: 'KCC', badgeText: '[IATF 8.3.3.3] KCC', fullTitle: 'مشخصه‌های مهم فرآیند (KCC)', clauseLabel: 'بند ۸.۳.۳.۳ IATF - مشخصه‌های فرآیند (KCC)' },
  Matrix: { clauseNo: 'بند ۸.۳.۵.۲ IATF', clauseCode: 'IATF 8.3.5.2', shortCode: 'Matrix', badgeText: '[IATF 8.3.5.2] Matrix', fullTitle: 'ماتریس فرآیند - محصول (Product-Process Matrix)', clauseLabel: 'بند ۸.۳.۵.۲ IATF - ماتریس فرآیند-محصول' },
};

export interface AiRequiredDocRequirement {
  id: string;
  clauseNo: string;
  name: string;
  type: string;
  shortCode: string;
  selectedColumns?: string[];
  isCustom?: boolean;
  contentsByStation: Array<{
    stationId: string;
    contentName: string;
    keyword?: string;
  }>;
}

export const DEFAULT_AI_REQUIRED_DOCS: AiRequiredDocRequirement[] = [
  {
    id: 'ref_pfd',
    clauseNo: 'بند ۸.۳.۵.۲ IATF',
    name: 'نمودار جریان فرآیند (PFD / Process Flow Diagram)',
    type: 'PFD',
    shortCode: 'IATF 8.3.5.2',
    contentsByStation: [
      { stationId: 'WS-101', contentName: 'ترتیب عملیات و ماشین‌های ایستگاه تزریق دایکست (OP-010)', keyword: 'دایکست' },
      { stationId: 'WS-104', contentName: 'ترتیب عملیات و تجهیزات ایستگاه فرزکاری CNC (OP-030)', keyword: 'CNC' }
    ]
  },
  {
    id: 'ref_control_plan',
    clauseNo: 'بند ۸.۵.۱.۱ IATF',
    name: 'طرح کنترل (Control Plan)',
    type: 'ControlPlan',
    shortCode: 'IATF 8.5.1.1',
    contentsByStation: [
      { stationId: 'WS-101', contentName: 'مشخصه‌های کنترلی و حدود پذیرش ایستگاه دایکست', keyword: 'دایکست' },
      { stationId: 'WS-104', contentName: 'روش کنترل، فرکانس و ابزار اندازه‌گیری تراش CNC', keyword: 'CNC' },
      { stationId: 'WS-108', contentName: 'مشخصات بسته‌بندی، واکنش‌ها و الزامات راه‌اندازی', keyword: 'بسته‌بندی' }
    ]
  },
  {
    id: 'ref_pfmea',
    clauseNo: 'بند ۸.۳.۵.۲ IATF',
    name: 'آنالیز حالات و آثار خرابی فرآیند (PFMEA)',
    type: 'PFMEA',
    shortCode: 'IATF 8.3.5.2',
    contentsByStation: [
      { stationId: 'WS-101', contentName: 'ریسک‌های راه‌اندازی و مکانیزم قفل قالب دایکست', keyword: 'قفل قالب' },
      { stationId: 'WS-106', contentName: 'حالات خرابی افت فشار و اقدامات پیشنهادی تست نشتی', keyword: 'نشتی' }
    ]
  },
  {
    id: 'ref_swi',
    clauseNo: 'بند ۸.۵.۱.۲ IATF',
    name: 'دستورالعمل‌های کاری استاندارد (SWI)',
    type: 'SWI',
    shortCode: 'IATF 8.5.1.2',
    contentsByStation: [
      { stationId: 'WS-102', contentName: 'مراحل راه‌اندازی و هشدار‌های شات‌بلاست و پلیسه‌گیری', keyword: 'شات‌بلاست' },
      { stationId: 'WS-106', contentName: 'پارامترهای تنظیم و نکات بحرانی شستشوی التراسونیک', keyword: 'التراسونیک' }
    ]
  },
  {
    id: 'ref_master_data',
    clauseNo: 'بند ۸.۵.۱.۵ IATF',
    name: 'اطلاعات پایه تجهیزات و ابزارآلات (Master Data)',
    type: 'MasterData',
    shortCode: 'IATF 8.5.1.5',
    contentsByStation: [
      { stationId: 'WS-104', contentName: 'اطلاعات قالب، فیکسچر و برنامه CNC/PLC ایستگاه فرزکاری', keyword: 'FIX-' }
    ]
  },
  {
    id: 'ref_calibration',
    clauseNo: 'بند ۷.۱.۵.۲ IATF',
    name: 'جدول کالیبراسیون تجهیزات و گیج‌ها (Calibration)',
    type: 'Calibration',
    shortCode: 'IATF 7.1.5.2',
    contentsByStation: [
      { stationId: 'WS-106', contentName: 'وضعیت و اعتبار کالیبراسیون گیج فشار مانومتر نشت‌سنج', keyword: 'گیج فشار' },
      { stationId: 'WS-108', contentName: 'گواهی کالیبراسیون دستگاه CMM Zeiss و ترکمتر', keyword: 'Zeiss' }
    ]
  },
  {
    id: 'ref_pm',
    clauseNo: 'بند ۸.۵.۱.۵ IATF',
    name: 'جدول نگهداری و تعمیرات پیشگیرانه (PM)',
    type: 'PM',
    shortCode: 'IATF 8.5.1.5',
    contentsByStation: [
      { stationId: 'WS-101', contentName: 'وضعیت سرویس تجهیزات و هشدارهای تعمیراتی ماشین دایکست', keyword: 'PM' }
    ]
  },
  {
    id: 'ref_material',
    clauseNo: 'بند ۸.۴.۲.۴ IATF',
    name: 'سرتیفیکیت و شناسنامه مواد اولیه (Raw Materials)',
    type: 'Material',
    shortCode: 'IATF 8.4.2.4',
    contentsByStation: [
      { stationId: 'WS-101', contentName: 'نوع ماده، گرید A380 و شماره بچ شمش آلومینیوم', keyword: 'آلومینیوم' }
    ]
  },
  {
    id: 'ref_csr',
    clauseNo: 'بند ۴.۳.۲ IATF',
    name: 'الزامات خاص مشتریان (CSR)',
    type: 'CSR',
    shortCode: 'IATF 4.3.2',
    contentsByStation: [
      { stationId: 'WS-108', contentName: 'الزامات خاص مشتری CSR در بسته‌بندی و نشانه‌گذاری بارکد', keyword: 'CSR' }
    ]
  },
  {
    id: 'ref_ecn',
    clauseNo: 'بند ۸.۵.۶.۱ IATF',
    name: 'جدول تغییرات مهندسی (ECN / ECR)',
    type: 'ECN',
    shortCode: 'IATF 8.5.6.1',
    contentsByStation: [
      { stationId: 'WS-104', contentName: 'آخرین تغییرات مهندسی ECN در سوراخ‌کاری و رزوه CNC', keyword: 'ECN' }
    ]
  },
  {
    id: 'ref_capa',
    clauseNo: 'بند ۱۰.۲.۳ IATF',
    name: 'گزارش‌های عدم انطباق و اقدامات اصلاحی (NCR / CAPA)',
    type: 'CAPA',
    shortCode: 'IATF 10.2.3',
    contentsByStation: [
      { stationId: 'WS-106', contentName: 'عدم انطباق‌های مرتبط با راه‌اندازی و اقدامات اصلاحی CAPA', keyword: 'CAPA' }
    ]
  },
  {
    id: 'ref_lessons',
    clauseNo: 'بند ۷.۱.۶ IATF',
    name: 'پایگاه دانش و دروس آموخته (Lessons Learned)',
    type: 'LessonLearned',
    shortCode: 'IATF 7.1.6',
    contentsByStation: [
      { stationId: 'WS-102', contentName: 'تجربیات و خطاهای تکرارشونده در راه‌اندازی شات‌بلاست', keyword: 'دروس آموخته' }
    ]
  },
  {
    id: 'ref_kpc',
    clauseNo: 'بند ۸.۳.۳.۳ IATF',
    name: 'مشخصه‌های مهم محصول (KPC / Special Characteristics)',
    type: 'KPC',
    shortCode: 'IATF 8.3.3.3',
    contentsByStation: [
      { stationId: 'WS-101', contentName: 'استحکام کششی و مشخصه‌های بحرانی پوسته دایکست', keyword: 'استحکام' },
      { stationId: 'WS-104', contentName: 'مشخصه‌های مهم KPC فرزکاری CNC و جای بلبرینگ', keyword: 'KPC' }
    ]
  },
  {
    id: 'ref_kcc',
    clauseNo: 'بند ۸.۳.۳.۳ IATF',
    name: 'مشخصه‌های مهم فرآیند (KCC / Special Process Characteristics)',
    type: 'KCC',
    shortCode: 'IATF 8.3.3.3',
    contentsByStation: [
      { stationId: 'WS-101', contentName: 'پارامترهای انجماد و خنک‌کاری تزریق دایکست', keyword: 'انجماد' }
    ]
  },
  {
    id: 'ref_matrix',
    clauseNo: 'بند ۸.۳.۵.۲ IATF',
    name: 'ماتریس فرآیند - محصول (Product-Process Matrix)',
    type: 'Matrix',
    shortCode: 'IATF 8.3.5.2',
    contentsByStation: [
      { stationId: 'WS-104', contentName: 'ماتریس فرآیند-محصول ایستگاه فرزکاری CNC', keyword: 'Matrix' }
    ]
  }
];

export function getRefDocMeta(str: string): ReferenceDocMetadata {
  if (!str) return { clauseNo: 'بند ۸.۵.۱ IATF', clauseCode: 'IATF 8.5.1', shortCode: 'CP', badgeText: '[IATF 8.5.1]', fullTitle: 'جدول ورودی دیتابیس', clauseLabel: 'بند ۸.۵.۱ IATF - طرح کنترل' };
  
  if (DOC_TYPE_METADATA[str]) {
    return DOC_TYPE_METADATA[str];
  }

  const found = Object.values(DOC_TYPE_METADATA).find(m => 
    str.includes(m.fullTitle) || str.includes(m.shortCode) || str.includes(m.clauseNo) || str.includes(m.clauseCode)
  );
  if (found) return found;

  if (str.includes('دستی') || str === 'custom_table') {
    return { clauseNo: 'بند سفارشی', clauseCode: 'MANUAL', shortCode: 'دستی', badgeText: 'ورودی دستی', fullTitle: 'ورودی دستی کارشناس', clauseLabel: 'ورودی دستی' };
  }

  return { clauseNo: 'بند IATF 16949', clauseCode: 'IATF', shortCode: 'Ref', badgeText: `[IATF] ${str.slice(0, 10)}`, fullTitle: str, clauseLabel: `بند IATF - ${str}` };
}

export interface WorkstationBlockData {
  stationId: string;
  stationName: string;
  operationCode: string;
  operationTitle: string;
  machineCode: string;
  machineTitle: string;
  operatorName: string;
  shiftName: string;
  permitStatus: 'approved' | 'rejected' | 'pending';
  permitNo?: string;
  issuedBy?: string;
  issuedAt?: string;
  inspectorNotes?: string;
  missingDocuments: Array<{
    docName: string;
    docType: 'PFD' | 'ControlPlan' | 'PFMEA' | 'SWI' | 'MasterData' | 'Calibration' | 'PM' | 'Material' | 'CSR' | 'ECN' | 'CAPA' | 'LessonLearned' | 'KPC' | 'KCC' | 'Matrix';
    type: 'MISSING_TABLE' | 'MISSING_CONTENT';
    contentName?: string;
    reason: string;
  }>;
}

export interface RuleEngineItem {
  id: string;
  ruleName: string;
  conditionType: 'machine_type' | 'process_type' | 'special_char' | 'mold_change' | 'pm_status';
  conditionValue: string;
  action: 'add_item' | 'require_approval' | 'flag_high_risk';
  itemToAdd?: Partial<SetupCheckItem>;
  enabled: boolean;
}

export interface SetupRevision {
  version: string;
  createdAt: string;
  createdBy: string;
  changeSummary: string;
  itemsCount: number;
  approvedBy?: string;
}

interface JobSetupModuleProps {
  documentTitle?: string;
  items?: DocItem[];
  onSave?: (updatedItems: DocItem[], updatedColumns?: any[], docTitle?: string) => void;
  lang?: 'fa' | 'en';
  onPinToDashboard?: () => void;
}

export default function JobSetupModule({
  documentTitle = ' Job Setup Verification',
  items = [],
  onSave,
  lang = 'fa',
  onPinToDashboard
}: JobSetupModuleProps) {
  const isRtl = lang === 'fa';

  // ---------------------------------------------------------------------------
  // 1. SELECTION & FILTER STATES
  // ---------------------------------------------------------------------------
  const [selectedProduct, setSelectedProduct] = useState<string>(() => {
    try {
      return localStorage.getItem('qms_job_setup_product') || '';
    } catch (e) {
      return '';
    }
  });
  const [selectedPartNo, setSelectedPartNo] = useState<string>(() => {
    try {
      return localStorage.getItem('qms_job_setup_partno') || '';
    } catch (e) {
      return '';
    }
  });
  const [activeVersion, setActiveVersion] = useState<string>(() => {
    try {
      return localStorage.getItem('qms_job_setup_version') || 'v1.0';
    } catch (e) {
      return 'v1.0';
    }
  });
  const [inspectorName, setInspectorName] = useState<string>(() => {
    try {
      return localStorage.getItem('qms_job_setup_inspector') || '';
    } catch (e) {
      return '';
    }
  });

  // Dashboard Pinning State
  const [isPinned, setIsPinned] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('iatf_tooling_items');
      if (saved) {
        const list = JSON.parse(saved);
        return list.some((i: any) => i.id === 'shortcut_job_setup_default' || i.shortcutTarget === 'JOB SETUP');
      }
    } catch (e) {}
    return true; // Default pinned
  });

  const handleTogglePin = () => {
    const nextPinned = !isPinned;
    setIsPinned(nextPinned);
    try {
      const saved = localStorage.getItem('iatf_tooling_items');
      let list = saved ? JSON.parse(saved) : [];
      if (nextPinned) {
        if (!list.some((i: any) => i.id === 'shortcut_job_setup_default' || i.shortcutTarget === 'JOB SETUP')) {
          list.push({
            id: 'shortcut_job_setup_default',
            name: isRtl ? '📌 ماژول راه‌اندازی و تنظیمات کار (Job Setup - بند 8.5.1.3)' : '📌 Job Setup Verification (Clause 8.5.1.3)',
            description: isRtl ? 'ماژول داده‌محور، هوشمند، مبتنی بر Single Source of Truth و قوانین Rule Engine بر اساس IATF 16949 بند 8.5.1.3' : 'Data-driven, AI-integrated smart Job Setup Verification module compliant with IATF 16949 clause 8.5.1.3.',
            selectedClauses: ['8.5.1.3'],
            createdAt: new Date().toISOString(),
            shortcutType: 'document',
            shortcutTarget: 'JOB SETUP'
          });
        }
        showToast('📌 ماژول Job Setup با موفقیت به داشبورد ابزار IATF پین شد!', 'success');
      } else {
        list = list.filter((i: any) => i.id !== 'shortcut_job_setup_default' && i.shortcutTarget !== 'JOB SETUP');
        showToast('📌 ماژول Job Setup از داشبورد ابزار IATF خارج شد.', 'info');
      }
      localStorage.setItem('iatf_tooling_items', JSON.stringify(list));
      QmsDatabase.writeRow('documents_table', 'iatf_tooling_items_list', list);
    } catch (e) {
      console.error(e);
    }
  };

  // Selected Station Filter ('all' or specific station ID like 'WS-104')
  const [activeStationFilter, setActiveStationFilter] = useState<string>('all');

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<'station_blocks' | 'in_process_control' | 'rules' | 'permits' | 'history'>('station_blocks');

  // Inspection Walkthrough Mode (Shop Floor Tablet View)
  const [isInspectorWalkthrough, setIsInspectorWalkthrough] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedControlTypeFilter, setSelectedControlTypeFilter] = useState<string>('all');

  // Edit / Draft changes states
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasDraftChanges, setHasDraftChanges] = useState(false);

  // Modals & Popups
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<SetupCheckItem | null>(null);

  // Custom Columns State
  const [customColumns, setCustomColumns] = useState<SetupCustomColumn[]>(() => {
    try {
      const saved = localStorage.getItem('qms_job_setup_custom_columns');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('qms_job_setup_custom_columns', JSON.stringify(customColumns));
    } catch (e) {}
  }, [customColumns]);
  const [isCustomColumnModalOpen, setIsCustomColumnModalOpen] = useState(false);
  const [newColumnNameInput, setNewColumnNameInput] = useState('');

  // Helper to format sourceModule to concise Source Number Badge (e.g. "منبع [۱]")
  const formatSourceToNumberBadge = (srcStr: string) => {
    if (!srcStr) return 'منبع [۱]';
    if (srcStr.includes('دستی') || srcStr === 'custom_table') return 'ورودی دستی';

    const persianNums = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹', '۱۰', '۱۱', '۱۲', '۱۳', '۱۴', '۱۵', '۱۶', '۱۷'];

    // Check direct number match inside brackets or raw number
    const bracketMatch = srcStr.match(/\[(\d+)\]/) || srcStr.match(/^(\d+)$/);
    if (bracketMatch && bracketMatch[1]) {
      const num = parseInt(bracketMatch[1], 10);
      if (num >= 1 && num <= 17) {
        return `منبع [${persianNums[num - 1] || num}]`;
      }
    }

    if (srcStr.startsWith('منبع [')) return srcStr;

    return `منبع [${srcStr}]`;
  };

  const getSourceFullName = (srcStr: string) => {
    if (!srcStr || srcStr.includes('دستی') || srcStr === 'custom_table') return 'ورودی دستی کارشناس';
    return srcStr;
  };

  const [isRejectPermitModalOpen, setIsRejectPermitModalOpen] = useState(false);
  const [rejectingStationId, setRejectingStationId] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('');

  const [singleStationPrintId, setSingleStationPrintId] = useState<string | null>(null);
  const [printStationSelection, setPrintStationSelection] = useState<string>('all');
  
  // Manual Table & Content Linker State
  const [selectedMissingForLink, setSelectedMissingForLink] = useState<{
    stationId: string;
    docName: string;
    docType: string;
    type: 'MISSING_TABLE' | 'MISSING_CONTENT';
    contentName?: string;
    reason?: string;
  } | null>(null);

  const [isManualLinkModalOpen, setIsManualLinkModalOpen] = useState(false);
  const [linkModalSearch, setLinkModalSearch] = useState('');
  const [selectedTargetTableTitle, setSelectedTargetTableTitle] = useState<string>('');

  // Inline Connection Drawer State
  const [activeInlineLinkKey, setActiveInlineLinkKey] = useState<string | null>(null);
  const [inlineSearch, setInlineSearch] = useState('');
  const [inlineSelectedTable, setInlineSelectedTable] = useState('');

  // AI Reference Requirements State (User can add / remove tables used by AI)
  const [aiReferenceRequirements, setAiReferenceRequirements] = useState<AiRequiredDocRequirement[]>(() => {
    try {
      const saved = localStorage.getItem('qms_job_setup_ai_ref_docs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_AI_REQUIRED_DOCS;
  });

  const [isAiRefDocsModalOpen, setIsAiRefDocsModalOpen] = useState(false);
  const [aiSourceToDeleteId, setAiSourceToDeleteId] = useState<string>('');
  const [selectedDbTableToAddTitle, setSelectedDbTableToAddTitle] = useState<string>('');
  const [selectedColumnsToAdd, setSelectedColumnsToAdd] = useState<string[]>([]);
  const [newAiDocClauseNo, setNewAiDocClauseNo] = useState('بند ۸.۵.۱ IATF');
  const [newAiDocName, setNewAiDocName] = useState('');
  const [newAiDocShortCode, setNewAiDocShortCode] = useState('IATF 8.5.1');
  const [newAiDocStation, setNewAiDocStation] = useState('WS-101');
  const [newAiDocContentName, setNewAiDocContentName] = useState('');
  const [newAiDocKeyword, setNewAiDocKeyword] = useState('');

  // Dynamic Revision History
  const [setupHistory, setSetupHistory] = useState<Array<{
    version: string;
    summary: string;
    timestamp: string;
    author: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem('qms_job_setup_revision_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [manualDocLinks, setManualDocLinks] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('qms_jobsetup_manual_doc_links');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [manualContentLinks, setManualContentLinks] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('qms_jobsetup_manual_content_links');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  const [capaLogs, setCapaLogs] = useState<Array<{
    id: string;
    stationId: string;
    reason: string;
    timestamp: string;
    status: 'open' | 'closed';
  }>>([]);

  const [selectedStationForNewItem, setSelectedStationForNewItem] = useState<string>('WS-104');
  const [editingItem, setEditingItem] = useState<SetupCheckItem | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // New Workstation Block Management States
  const [isAddStationModalOpen, setIsAddStationModalOpen] = useState(false);
  const [newStationForm, setNewStationForm] = useState({
    stationId: '',
    stationName: '',
    operationCode: '',
    operationTitle: '',
    machineCode: '',
    machineTitle: '',
    operatorName: '',
    shiftName: 'شیفت روز (A)'
  });

  const [isEditStationModalOpen, setIsEditStationModalOpen] = useState(false);
  const [editingStationForm, setEditingStationForm] = useState<WorkstationBlockData | null>(null);

  // Print settings & customization states
  const [printOrientation, setPrintOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [printLogoUrl, setPrintLogoUrl] = useState<string>(() => {
    try {
      return localStorage.getItem('qms_company_logo') || '';
    } catch (e) {
      return '';
    }
  });
  const [printOrgName, setPrintOrgName] = useState<string>(() => {
    try {
      return localStorage.getItem('qms_print_org_name') || '';
    } catch (e) {
      return '';
    }
  });
  const [printReportTitle, setPrintReportTitle] = useState<string>('شناسنامه جامع صحه‌گذاری راه‌اندازی خط تولید (Job Setup Verification Dossier)');
  const [printDocCode, setPrintDocCode] = useState<string>(() => {
    try {
      return localStorage.getItem('qms_print_doc_code') || 'QMS-FRM-JS-001';
    } catch (e) {
      return 'QMS-FRM-JS-001';
    }
  });
  const [printRevision, setPrintRevision] = useState<string>('1.0');
  const [printFooterDisclaimer, setPrintFooterDisclaimer] = useState<string>('سند محرمانه سیستم مدیریت کیفیت - تکثیر و استفاده بدون مجوز واحد مدیریت کیفیت ممنوع می‌باشد.');
  const [printSigner1, setPrintSigner1] = useState<string>('کارشناس کیفی (ممیز)');
  const [printSigner1Name, setPrintSigner1Name] = useState<string>(() => {
    try {
      return localStorage.getItem('qms_print_signer1_name') || '';
    } catch (e) {
      return '';
    }
  });
  const [printSigner2, setPrintSigner2] = useState<string>('سرپرست تولید / راه‌اندازی');
  const [printSigner2Name, setPrintSigner2Name] = useState<string>(() => {
    try {
      return localStorage.getItem('qms_print_signer2_name') || '';
    } catch (e) {
      return '';
    }
  });
  const [printSigner3, setPrintSigner3] = useState<string>('مدیر تضمین کیفیت (QMS)');
  const [printSigner3Name, setPrintSigner3Name] = useState<string>(() => {
    try {
      return localStorage.getItem('qms_print_signer3_name') || '';
    } catch (e) {
      return '';
    }
  });
  const [isPrintConfigPanelOpen, setIsPrintConfigPanelOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // QMS DATABASE PRINT CUSTOMIZATION & AUTO-DETECTION HELPERS
  // ---------------------------------------------------------------------------
  const [activeDbPickerTab, setActiveDbPickerTab] = useState<'products' | 'docs' | 'orgs' | 'signers' | null>(null);

  const getQmsDbPrintData = () => {
    // 1. Products & Part Numbers from QmsDatabase & LocalStorage
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

    // 2. ISO Document Control Records
    let docControls: Array<{ code: string; title: string; revision: string; status: string }> = [];
    try {
      const docCtrlMap = QmsDatabase.selectAll(QmsDatabase.TABLES.DOCUMENT_CONTROL);
      if (docCtrlMap && typeof docCtrlMap === 'object') {
        Object.values(docCtrlMap).forEach((d: any) => {
          if (d && (d.code || d.docCode || d.title || d.docTitle)) {
            docControls.push({
              code: d.code || d.docCode || 'QMS-FRM-001',
              title: d.title || d.docTitle || 'شناسنامه صحه‌گذاری راه‌اندازی',
              revision: d.revision || d.rev || '1.0',
              status: d.status || 'مصوب و فعال'
            });
          }
        });
      }
    } catch (e) {}

    try {
      const docsMap = QmsDatabase.selectAll(QmsDatabase.TABLES.DOCUMENTS);
      if (docsMap && typeof docsMap === 'object') {
        Object.keys(docsMap).forEach((docTitle, idx) => {
          if (docTitle) {
            docControls.push({
              code: `QMS-FRM-JS-${String(idx + 1).padStart(3, '0')}`,
              title: docTitle,
              revision: '1.0',
              status: 'فرم استاندارد'
            });
          }
        });
      }
    } catch (e) {}

    const uniqueDocControls = Array.from(
      new Map(docControls.map(d => [d.code + '___' + d.title, d])).values()
    );

    // 3. Organizations
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

    // 4. Personnel & Signers
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
      docControls: uniqueDocControls,
      orgs,
      personnel
    };
  };

  const handleAutoDetectQmsDbData = () => {
    const data = getQmsDbPrintData();
    let loadedItems: string[] = [];

    if (data.products.length > 0) {
      const firstP = data.products[0];
      if (firstP.name) {
        setSelectedProduct(firstP.name);
        try { localStorage.setItem('qms_job_setup_product', firstP.name); } catch(e){}
      }
      if (firstP.partNo) {
        setSelectedPartNo(firstP.partNo);
        try { localStorage.setItem('qms_job_setup_partno', firstP.partNo); } catch(e){}
      }
      loadedItems.push(`محصول: ${firstP.name} (${firstP.partNo || 'بدون کد'})`);
    }

    if (data.docControls.length > 0) {
      const firstDoc = data.docControls[0];
      setPrintDocCode(firstDoc.code);
      setPrintRevision(firstDoc.revision);
      if (firstDoc.title) setPrintReportTitle(`شناسنامه صحه‌گذاری - ${firstDoc.title}`);
      try { localStorage.setItem('qms_print_doc_code', firstDoc.code); } catch(e){}
      loadedItems.push(`کد سند: ${firstDoc.code} (ویرایش ${firstDoc.revision})`);
    }

    if (data.orgs.length > 0) {
      setPrintOrgName(data.orgs[0].name);
      try { localStorage.setItem('qms_print_org_name', data.orgs[0].name); } catch(e){}
      loadedItems.push(`سازمان: ${data.orgs[0].name}`);
    }

    if (data.personnel.length > 0) {
      if (data.personnel[0]?.name) {
        setPrintSigner1Name(data.personnel[0].name);
        try { localStorage.setItem('qms_print_signer1_name', data.personnel[0].name); } catch(e){}
      }
      if (data.personnel[1]?.name) {
        setPrintSigner2Name(data.personnel[1].name);
        try { localStorage.setItem('qms_print_signer2_name', data.personnel[1].name); } catch(e){}
      } else if (data.personnel[0]?.name) {
        setPrintSigner2Name(data.personnel[0].name);
      }
      if (data.personnel[2]?.name) {
        setPrintSigner3Name(data.personnel[2].name);
        try { localStorage.setItem('qms_print_signer3_name', data.personnel[2].name); } catch(e){}
      } else if (data.personnel[0]?.name) {
        setPrintSigner3Name(data.personnel[0].name);
      }
      loadedItems.push(`امضاکنندگان: ${data.personnel.map(p => p.name).slice(0, 3).join(' / ')}`);
    }

    if (loadedItems.length > 0) {
      showToast('شناسایی و بارگذاری خودکار از دیتابیس QMS با موفقیت انجام شد.', 'success');
    } else {
      showToast('اطلاعات قبلی از دیتابیس استخراج شد. می‌توانید از منوهای کشویی پایین موارد دلخواه را انتخاب کنید.', 'info');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const result = uploadEvent.target?.result as string;
        if (result) {
          setPrintLogoUrl(result);
          try {
            localStorage.setItem('qms_company_logo', result);
          } catch (err) {}
          showToast('لوگوی سازمان با موفقیت بارگذاری شد.', 'success');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setPrintLogoUrl('');
    try {
      localStorage.removeItem('qms_company_logo');
    } catch (e) {}
    showToast('لوگوی سازمان حذف گردید.', 'info');
  };

  const handleSavePdfToRecordsLedger = () => {
    try {
      const folderName = "سوابق صهه‌گذاری و راه‌اندازی (Job Setup)";
      const recordId = `rec_jsu_${Date.now()}`;
      const stationInfo = printStationSelection === 'all'
        ? 'تجمعی (کلیه ایستگاه‌ها)'
        : (workstationBlocks[printStationSelection]?.stationName || printStationSelection);

      const docTitle = `تست و صحه‌گذاری راه‌اندازی - ${stationInfo}`;
      const docCode = printDocCode || 'FM-JSU-8513';
      const rev = printRevision || '1.0';
      const archiveDate = new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

      const newRecord = {
        id: recordId,
        folder: folderName,
        documentName: docTitle,
        clauseId: '8.5.1.3',
        code: docCode,
        revision: rev,
        version: rev,
        preparedBy: printSigner1Name || 'کارشناس راه‌اندازی',
        approvedBy: printSigner3Name || printSigner2Name || 'مدیر کیفیت',
        archivedAt: archiveDate,
        timestamp: Date.now(),
        isPdfSaved: true,
        pdfFileName: `${docCode}_Rev${rev}_${Date.now()}.pdf`,
        items: [
          {
            title: 'خلاصه پرونده صحه‌گذاری راه‌اندازی و تنظیمات کارگاه',
            product: selectedProduct,
            partNo: selectedPartNo,
            stationSelection: printStationSelection,
            orientation: printOrientation,
            organization: printOrgName,
            headerCode: docCode,
            revision: rev,
            archivedAt: archiveDate
          }
        ]
      };

      QmsDatabase.writeRow(QmsDatabase.TABLES.RECORDS, recordId, newRecord);

      showToast(`✅ نسخه PDF و شناسنامه سابقه با موفقیت در پوشه "${folderName}" در لیست سوابق (Records Ledger) ذخیره گردید.`, 'success');

      // Trigger browser print dialog for direct PDF save
      window.print();
    } catch (e) {
      console.error('Failed to save record:', e);
      showToast('خطا در ذخیره سابقه در دیتابیس!', 'warning');
    }
  };

  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [notificationToast, setNotificationToast] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);

  const handleAddAiRefDocRequirement = () => {
    if (!newAiDocName.trim()) return;
    const reqId = `ref_custom_${Date.now()}`;
    const newReq: AiRequiredDocRequirement = {
      id: reqId,
      clauseNo: newAiDocClauseNo.trim() || `بند ۸.۵.۱ IATF`,
      name: newAiDocName.trim(),
      type: newAiDocShortCode.trim() || 'CUSTOM',
      shortCode: newAiDocShortCode.trim() || `IATF`,
      isCustom: true,
      contentsByStation: [
        {
          stationId: newAiDocStation,
          contentName: newAiDocContentName.trim() || newAiDocName.trim(),
          keyword: newAiDocKeyword.trim() || undefined
        }
      ]
    };

    setAiReferenceRequirements(prev => {
      const updated = [...prev, newReq];
      try {
        localStorage.setItem('qms_job_setup_ai_ref_docs', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    setNewAiDocName('');
    setNewAiDocContentName('');
    setNewAiDocKeyword('');
    setNewAiDocClauseNo('بند ۸.۵.۱ IATF');
    showToast(`✅ جدول مرجع «${newReq.name}» به استخراج هوش مصنوعی اضافه شد.`, 'success');
  };

  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const handleDeleteAiRefDocRequirement = (reqId: string) => {
    const targetReq = aiReferenceRequirements.find(r => r.id === reqId || r.name === reqId);
    const targetName = targetReq?.name || 'این منبع';
    
    setDeleteConfirmModal({
      isOpen: true,
      title: 'تأیید حذف منبع هوش مصنوعی',
      message: `آیا از حذف منبع «${targetName}» از لیست منابع هوش مصنوعی اطمینان دارید؟ این عمل غیرقابل بازگشت است.`,
      onConfirm: () => {
        setAiReferenceRequirements(prev => {
          const updated = prev.filter(r => r.id !== reqId && r.name !== reqId);
          try {
            localStorage.setItem('qms_job_setup_ai_ref_docs', JSON.stringify(updated));
          } catch (e) {}
          return updated;
        });
        setAiSourceToDeleteId('');
        showToast(`منبع «${targetName}» با موفقیت حذف گردید.`, 'info');
        setDeleteConfirmModal(null);
      }
    });
  };

  const handleRemoveSelectedAiSource = () => {
    if (!aiSourceToDeleteId) {
      showToast('لطفا یک منبع را برای حذف انتخاب نمایید.', 'warning');
      return;
    }
    handleDeleteAiRefDocRequirement(aiSourceToDeleteId);
  };

  const handleTableSelectForAiAdd = (tableTitle: string) => {
    setSelectedDbTableToAddTitle(tableTitle);
    const tableObj = availableDbTablesForLinking.find(t => t.title === tableTitle);
    if (tableObj && Array.isArray(tableObj.rawData) && tableObj.rawData.length > 0) {
      const keysSet = new Set<string>();
      tableObj.rawData.forEach((row: any) => {
        if (row && typeof row === 'object') {
          Object.keys(row).forEach(k => {
            if (!k.startsWith('_') && k !== 'id') keysSet.add(k);
          });
        }
      });
      const keys = Array.from(keysSet);
      setSelectedColumnsToAdd(keys.length > 0 ? keys : ['عنوان پارامتر / مشخصه', 'مقدار هدف / حد پذیرش', 'روش و فرکانس کنترل']);
    } else {
      setSelectedColumnsToAdd(['عنوان پارامتر / مشخصه', 'مقدار هدف / حد پذیرش', 'روش و فرکانس کنترل']);
    }
  };

  const handleToggleColumnSelection = (colName: string) => {
    setSelectedColumnsToAdd(prev => 
      prev.includes(colName) ? prev.filter(c => c !== colName) : [...prev, colName]
    );
  };

  const handleSelectAllColumns = () => {
    const tableObj = availableDbTablesForLinking.find(t => t.title === selectedDbTableToAddTitle);
    if (tableObj && Array.isArray(tableObj.rawData) && tableObj.rawData.length > 0) {
      const keysSet = new Set<string>();
      tableObj.rawData.forEach((row: any) => {
        if (row && typeof row === 'object') {
          Object.keys(row).forEach(k => {
            if (!k.startsWith('_') && k !== 'id') keysSet.add(k);
          });
        }
      });
      setSelectedColumnsToAdd(Array.from(keysSet));
    }
  };

  const handleDeselectAllColumns = () => {
    setSelectedColumnsToAdd([]);
  };

  const handleAddSelectedTableToAiSources = () => {
    if (!selectedDbTableToAddTitle) {
      showToast('لطفا یک جدول از دیتابیس پروژه انتخاب کنید.', 'warning');
      return;
    }
    const tableObj = availableDbTablesForLinking.find(t => t.title === selectedDbTableToAddTitle);
    if (!tableObj) return;

    if (selectedColumnsToAdd.length === 0) {
      showToast('لطفا حداقل یک ستون از جدول را انتخاب کنید.', 'warning');
      return;
    }

    const reqId = `ref_db_${Date.now()}`;
    const newReq: AiRequiredDocRequirement = {
      id: reqId,
      clauseNo: tableObj.clauseNo || 'بند ۸.۵.۱ IATF',
      name: tableObj.title,
      type: tableObj.shortCode || 'TABLE',
      shortCode: tableObj.shortCode || 'IATF',
      selectedColumns: selectedColumnsToAdd,
      isCustom: true,
      contentsByStation: [
        {
          stationId: 'WS-101',
          contentName: `استخراج اطلاعات بر اساس ستون‌های: ${selectedColumnsToAdd.join('، ')}`,
          keyword: tableObj.title
        }
      ]
    };

    setAiReferenceRequirements(prev => {
      const filtered = prev.filter(p => p.name !== tableObj.title);
      const updated = [...filtered, newReq];
      try {
        localStorage.setItem('qms_job_setup_ai_ref_docs', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });

    showToast(`✅ جدول «${tableObj.title}» با ${selectedColumnsToAdd.length} ستون انتخابی به منابع هوش مصنوعی اضافه شد.`, 'success');
  };

  // ---------------------------------------------------------------------------
  // 2. WORKSTATIONS MASTER DEFINITION (Dynamic, User-Authored Storage)
  // ---------------------------------------------------------------------------
  const [workstationBlocks, setWorkstationBlocks] = useState<Record<string, WorkstationBlockData>>(() => {
    try {
      const saved = localStorage.getItem('qms_job_setup_workstation_blocks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch (e) {}
    return {};
  });

  useEffect(() => {
    try {
      localStorage.setItem('qms_job_setup_workstation_blocks', JSON.stringify(workstationBlocks));
    } catch (e) {}
  }, [workstationBlocks]);

  const handleCreateStationBlock = () => {
    const stId = newStationForm.stationId.trim().toUpperCase();
    if (!stId) {
      showToast('لطفاً شناسه ایستگاه (مانند WS-101) را وارد کنید.', 'warning');
      return;
    }
    if (!newStationForm.stationName.trim()) {
      showToast('لطفاً عنوان ایستگاه کاری را وارد کنید.', 'warning');
      return;
    }
    if (workstationBlocks[stId]) {
      showToast(`ایستگاه کاری با شناسه «${stId}» قبلاً تعریف شده است.`, 'warning');
      return;
    }

    const newBlock: WorkstationBlockData = {
      stationId: stId,
      stationName: newStationForm.stationName.trim(),
      operationCode: newStationForm.operationCode.trim() || 'OP-010',
      operationTitle: newStationForm.operationTitle.trim() || newStationForm.stationName.trim(),
      machineCode: newStationForm.machineCode.trim() || '-',
      machineTitle: newStationForm.machineTitle.trim() || '-',
      operatorName: newStationForm.operatorName.trim() || '-',
      shiftName: newStationForm.shiftName || 'شیفت روز (A)',
      permitStatus: 'pending',
      missingDocuments: []
    };

    setWorkstationBlocks(prev => ({ ...prev, [stId]: newBlock }));
    showToast(`ایستگاه کاری «${stId} - ${newStationForm.stationName}» با موفقیت ثبت گردید.`, 'success');
    setIsAddStationModalOpen(false);
    setNewStationForm({
      stationId: '',
      stationName: '',
      operationCode: '',
      operationTitle: '',
      machineCode: '',
      machineTitle: '',
      operatorName: '',
      shiftName: 'شیفت روز (A)'
    });
  };

  const handleUpdateStationBlock = () => {
    if (!editingStationForm) return;
    const stId = editingStationForm.stationId;
    if (!editingStationForm.stationName.trim()) {
      showToast('لطفاً عنوان ایستگاه کاری را وارد کنید.', 'warning');
      return;
    }

    setWorkstationBlocks(prev => ({
      ...prev,
      [stId]: {
        ...prev[stId],
        ...editingStationForm
      }
    }));
    showToast(`اطلاعات ایستگاه کاری «${stId}» به‌روزرسانی شد.`, 'success');
    setIsEditStationModalOpen(false);
    setEditingStationForm(null);
  };

  const handleDeleteStationBlock = (stId: string) => {
    const stName = workstationBlocks[stId]?.stationName || stId;
    setDeleteConfirmModal({
      isOpen: true,
      title: 'تأیید حذف ایستگاه کاری',
      message: `آیا از حذف کامل ایستگاه کاری «${stId} - ${stName}» و تمامی مشخصه‌های کنترلی آن اطمینان دارید؟`,
      onConfirm: () => {
        setWorkstationBlocks(prev => {
          const updated = { ...prev };
          delete updated[stId];
          return updated;
        });
        setChecklistItems(prev => prev.filter(item => item.stationId !== stId));
        showToast(`ایستگاه کاری «${stId}» و مشخصه‌های آن حذف گردید.`, 'info');
        setDeleteConfirmModal(null);
      }
    });
  };

  // ---------------------------------------------------------------------------
  // 3. CHECKLIST ITEMS BY STATION
  // ---------------------------------------------------------------------------
  const [checklistItems, setChecklistItems] = useState<SetupCheckItem[]>(() => {
    try {
      const saved = localStorage.getItem('qms_job_setup_checklist_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem('qms_job_setup_checklist_items', JSON.stringify(checklistItems));
    } catch (e) {}
  }, [checklistItems]);

  // Database Search Logs & Found Docs Tracking
  const [dbQueryLogs, setDbQueryLogs] = useState<Array<{
    timestamp: string;
    docName: string;
    docType: string;
    status: 'FOUND' | 'NOT_FOUND' | 'CREATED_BLANK';
    rowCount: number;
    details: string;
  }>>([]);

  // Toast trigger helper
  const showToast = (message: string, type: 'success' | 'warning' | 'info' = 'info') => {
    setNotificationToast({ message, type });
    setTimeout(() => {
      setNotificationToast(null);
    }, 5000);
  };

  // Custom Columns Handlers
  const handleAddCustomColumn = () => {
    if (!newColumnNameInput.trim()) return;
    const colId = `col_${Date.now()}`;
    setCustomColumns(prev => [...prev, { id: colId, name: newColumnNameInput.trim() }]);
    setNewColumnNameInput('');
    showToast(`✅ ستون جدید «${newColumnNameInput.trim()}» به جدول بلوک‌ها اضافه شد.`, 'success');
  };

  const handleDeleteCustomColumn = (id: string) => {
    const col = customColumns.find(c => c.id === id);
    const colName = col?.name || 'این ستون';
    setDeleteConfirmModal({
      isOpen: true,
      title: 'تأیید حذف ستون سفارشی',
      message: `آیا از حذف ستون سفارشی «${colName}» اطمینان دارید؟`,
      onConfirm: () => {
        setCustomColumns(prev => prev.filter(c => c.id !== id));
        showToast('ستون سفارشی حذف گردید.', 'info');
        setDeleteConfirmModal(null);
      }
    });
  };

  const handleUpdateItemCustomField = (itemId: string, colId: string, val: string) => {
    setChecklistItems(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          customFields: {
            ...(item.customFields || {}),
            [colId]: val
          }
        };
      }
      return item;
    }));
    setHasDraftChanges(true);
  };

  // ---------------------------------------------------------------------------
  // MANUAL DATABASE TABLE & CONTENT LINKERS
  // ---------------------------------------------------------------------------
  const availableDbTablesForLinking = useMemo(() => {
    const docsMap = QmsDatabase.selectAll(QmsDatabase.TABLES.DOCUMENTS) || {};
    const list: Array<{ title: string; recordCount: number; sampleItems: string[]; source: string; rawData: any }> = [];

    // Add items from QmsDatabase DOCUMENTS table
    Object.entries(docsMap).forEach(([title, data]: [string, any]) => {
      let items: any[] = [];
      if (Array.isArray(data)) {
        items = data;
      } else if (data && typeof data === 'object' && Array.isArray(data.items)) {
        items = data.items;
      }
      const sampleItems = items.slice(0, 3).map((it: any) => {
        if (typeof it === 'string') return it;
        return it.field1 || it.field2 || it.title || it.parameterName || it.processStep || it.machine || it.kpcName || it.controlMethod || it.docName || JSON.stringify(it).slice(0, 50);
      }).filter(Boolean);

      list.push({
        title,
        recordCount: items.length,
        sampleItems,
        source: 'دیتابیس QMS (تخصصی)',
        rawData: items
      });
    });

    // Add items from documentTemplates if not already present
    Object.values(documentTemplates).forEach(tpl => {
      if (!list.some(l => l.title === tpl.title)) {
        const items = tpl.items || [];
        const sampleItems = items.slice(0, 3).map((it: any) => it.field1 || it.field2 || it.field3 || '').filter(Boolean);
        list.push({
          title: tpl.title,
          recordCount: items.length,
          sampleItems,
          source: 'قالب استاندارد QMS',
          rawData: items
        });
      }
    });

    return list.map((item, idx) => {
      const meta = getRefDocMeta(item.title);
      // Look up if user defined a clauseNo in aiReferenceRequirements
      const aiReqMatch = aiReferenceRequirements.find(r => item.title.includes(r.name) || r.name.includes(item.title));
      const clauseNo = aiReqMatch ? aiReqMatch.clauseNo : (meta.clauseNo === 'بند مرجع' ? `بند ${idx + 1}` : meta.clauseNo);
      const shortCode = aiReqMatch ? aiReqMatch.shortCode : meta.shortCode;
      
      return {
        ...item,
        clauseNo,
        clauseLabel: meta.clauseLabel,
        shortCode,
        badgeText: meta.badgeText,
        indexNo: idx + 1
      };
    });
  }, [isManualLinkModalOpen, activeInlineLinkKey, aiReferenceRequirements]);

  const handleSaveManualLink = (targetTableTitle: string, overrideMissing?: typeof selectedMissingForLink) => {
    const missingObj = overrideMissing || selectedMissingForLink;
    if (!missingObj || !targetTableTitle) return;

    const { docName, stationId, contentName, type } = missingObj;

    // 1. Update doc links map
    const updatedDocLinks = { ...manualDocLinks, [docName]: targetTableTitle };
    setManualDocLinks(updatedDocLinks);
    localStorage.setItem('qms_jobsetup_manual_doc_links', JSON.stringify(updatedDocLinks));

    // 2. If content link, update content links map
    let updatedContentLinks = { ...manualContentLinks };
    if (type === 'MISSING_CONTENT' && contentName) {
      const key = `${docName}_${stationId}_${contentName}`;
      updatedContentLinks[key] = targetTableTitle;
      setManualContentLinks(updatedContentLinks);
      localStorage.setItem('qms_jobsetup_manual_content_links', JSON.stringify(updatedContentLinks));
    }

    // 3. Get target data from QmsDatabase or templates and clone into reqDoc.name
    const allDocs = QmsDatabase.selectAll(QmsDatabase.TABLES.DOCUMENTS) || {};
    let targetData = allDocs[targetTableTitle];
    if (!targetData) {
      const tpl = documentTemplates[targetTableTitle] || Object.values(documentTemplates).find(t => t.title === targetTableTitle);
      if (tpl) {
        targetData = tpl.items || [];
      }
    }

    if (targetData) {
      QmsDatabase.writeRow(QmsDatabase.TABLES.DOCUMENTS, docName, targetData);
    }

    showToast(
      type === 'MISSING_TABLE'
        ? `✅ جدول «${targetTableTitle}» با موفقیت به منبع «${docName}» پیوند داده شد.`
        : `✅ محتوای «${contentName}» با موفقیت به جدول «${targetTableTitle}» پیوند داده شد.`,
      'success'
    );

    setIsManualLinkModalOpen(false);
    setSelectedMissingForLink(null);
    setSelectedTargetTableTitle('');
    setActiveInlineLinkKey(null);

    // Reload setup data and dispatch DB mutation event
    setTimeout(() => {
      loadInitialSetupData();
      window.dispatchEvent(new Event('qms-db-mutated'));
    }, 100);
  };

  const handleRemoveManualLink = (docName: string, contentKey?: string) => {
    setDeleteConfirmModal({
      isOpen: true,
      title: 'تأیید لغو پیوند دستی',
      message: `آیا از لغو پیوند دستی برای «${docName}» اطمینان دارید؟`,
      onConfirm: () => {
        const updatedDocLinks = { ...manualDocLinks };
        delete updatedDocLinks[docName];
        setManualDocLinks(updatedDocLinks);
        localStorage.setItem('qms_jobsetup_manual_doc_links', JSON.stringify(updatedDocLinks));

        if (contentKey) {
          const updatedContentLinks = { ...manualContentLinks };
          delete updatedContentLinks[contentKey];
          setManualContentLinks(updatedContentLinks);
          localStorage.setItem('qms_jobsetup_manual_content_links', JSON.stringify(updatedContentLinks));
        }

        showToast(`پیوند دستی برای «${docName}» لغو گردید.`, 'info');
        setTimeout(() => {
          loadInitialSetupData();
        }, 100);
        setDeleteConfirmModal(null);
      }
    });
  };

  // ---------------------------------------------------------------------------
  // 4. AI SMART JOB SETUP GENERATOR & INITIAL DATA ENGINE
  // ---------------------------------------------------------------------------
  const handleGenerateAiSmartJobSetup = async () => {
    setIsAiGenerating(true);
    showToast('🤖 در حال بررسی و استخراج هوشمند داده‌های واقعی برای ایستگاه‌ها...', 'info');

    try {
      const generatedItems: SetupCheckItem[] = [];
      const stepCounter: Record<string, number> = {};
      const validStationIds = Object.keys(workstationBlocks);
      validStationIds.forEach(stId => { stepCounter[stId] = 1; });

      // System tables that must NEVER be extracted as workstation checklist items
      const SYSTEM_EXCLUDED_TABLES = [
        'iatf_tooling_items_list',
        'qms_organizations',
        'qms_products',
        'records_table',
        'document_control_table',
        'clause_links_table',
        'tenant_archive',
        'nc_items_table',
        'indicators_table',
        'strategic_evaluations_table',
        'strategic_items'
      ];

      const allDocs = QmsDatabase.selectAll(QmsDatabase.TABLES.DOCUMENTS) || {};

      // Identify allowed document titles based on aiReferenceRequirements and manual links
      const allowedDocTitles = new Set<string>();
      aiReferenceRequirements.forEach(req => {
        allowedDocTitles.add(req.name);
        if (manualDocLinks[req.name]) {
          allowedDocTitles.add(manualDocLinks[req.name]);
        }
      });

      Object.entries(allDocs).forEach(([docTitle, data]: [string, any]) => {
        // Skip system/internal non-JobSetup tables
        if (SYSTEM_EXCLUDED_TABLES.includes(docTitle)) return;

        // Check if docTitle matches allowed references or manual links
        const isAllowedDoc = allowedDocTitles.has(docTitle) ||
          aiReferenceRequirements.some(req => docTitle.toLowerCase().includes(req.name.toLowerCase()) || docTitle.toLowerCase().includes(req.type.toLowerCase())) ||
          Object.values(manualDocLinks).includes(docTitle);

        if (!isAllowedDoc) return;

        let rows: any[] = [];
        if (Array.isArray(data)) {
          rows = data;
        } else if (data && typeof data === 'object' && Array.isArray(data.items)) {
          rows = data.items;
        }

        if (!rows || rows.length === 0) return;

        rows.forEach((row: any, rIdx: number) => {
          if (!row || typeof row !== 'object') return;

          // Determine target station ONLY if explicitly matching a valid station ID or keyword rule
          let stId: string | null = null;

          // 1. Explicit stationId on row
          if (row.stationId && validStationIds.includes(row.stationId)) {
            stId = row.stationId;
          } else if (row.station && validStationIds.includes(row.station)) {
            stId = row.station;
          } else {
            // 2. Regex match for WS-xxx in stringified row if it matches a valid station
            const match = JSON.stringify(row).match(/WS-\d+/i);
            if (match) {
              const matchedSt = match[0].toUpperCase();
              if (validStationIds.includes(matchedSt)) {
                stId = matchedSt;
              }
            }
          }

          // 3. Keyword matching from aiReferenceRequirements contentsByStation
          if (!stId) {
            for (const req of aiReferenceRequirements) {
              for (const item of req.contentsByStation) {
                if (validStationIds.includes(item.stationId)) {
                  const kw = (item.keyword || item.contentName || '').trim().toLowerCase();
                  if (kw && JSON.stringify(row).toLowerCase().includes(kw)) {
                    stId = item.stationId;
                    break;
                  }
                }
              }
              if (stId) break;
            }
          }

          // STRICT RULE: If no valid workstation match, DO NOT DEFAULT TO WS-101 OR ANY OTHER STATION! Skip this row!
          if (!stId || !validStationIds.includes(stId)) {
            return;
          }

          const paramName = row.parameterName || row.field1 || row.title || row.name || row.description;
          if (!paramName || typeof paramName !== 'string' || paramName.trim() === '') return;

          const step = stepCounter[stId] || 1;
          stepCounter[stId] = step + 1;

          const targetVal = row.targetValue || row.field2 || row.value || row.spec || 'مطابق مشخصات فنی';
          const gaugeTool = row.gaugeTool || row.field3 || row.tool || 'ابزار کالیبره سنجش';
          const methodFreq = row.methodFrequency || row.field4 || row.frequency || 'بر اساس طرح کنترل';
          const reaction = row.reactionPlan || row.field5 || row.reaction || 'توقف خط و اقدام اصلاحی';
          const ctrlType = (row.controlType || row.class || 'Standard') as any;

          const itemCustomFields: Record<string, string> = {};
          customColumns.forEach(c => {
            itemCustomFields[c.id] = row[c.id] || row[c.name] || '';
          });

          generatedItems.push({
            id: `ai_ext_real_${stId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_${rIdx}`,
            stepNo: step,
            stationId: stId,
            category: (row.category || 'parameters') as any,
            parameterName: paramName,
            controlType: ctrlType,
            targetValue: targetVal,
            measuredValue: 'تایید شد',
            gaugeTool: gaugeTool,
            calibrationStatus: 'valid' as const,
            methodFrequency: methodFreq,
            reactionPlan: reaction,
            sourceModule: docTitle,
            sourceTable: 'qms_db',
            sourceColumn: 'record',
            sourceRecordKey: row.id || `REC-${rIdx + 1}`,
            selectionLogic: `استخراج مستقیم از داده‌های مرجع سند ${docTitle} ایستگاه ${stId}`,
            verified: true,
            notes: `استخراج شده از رکورد واقعی دیتابیس QMS`,
            diffStatus: 'added' as const,
            customFields: itemCustomFields
          });
        });
      });

      if (generatedItems.length === 0) {
        showToast('اطلاعات مرجع منطبق با ایستگاه‌های کاری در دیتابیس QMS ثبت نشده است. لطفاً ابتدا اسناد مربوط به ایستگاه‌ها (طرح کنترل، SWI، PFMEA و...) را در دیتابیس ثبت و پیوند دهید.', 'warning');
      } else {
        setChecklistItems(generatedItems);
        setHasDraftChanges(true);
        showToast(`🎉 تعداد ${generatedItems.length} مشخصه کنترلی واقعی با موفقیت بر اساس ایستگاه‌های مربوطه استخراج گردید.`, 'success');
      }
    } catch (e) {
      console.error(e);
      showToast('خطا در بررسی و استخراج داده‌های دیتابیس.', 'warning');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const loadInitialSetupData = () => {
    const logs: typeof dbQueryLogs = [];

    // Required reference document titles & required contents dynamically from user-configured aiReferenceRequirements
    const requiredDocs = aiReferenceRequirements.map(req => ({
      name: req.name,
      type: req.type as any,
      contentsByStation: req.contentsByStation.map(item => ({
        stationId: item.stationId,
        contentName: item.contentName,
        checkFn: (rows: any[]) => {
          if (!rows || rows.length === 0) return false;
          const kw = (item.keyword || item.contentName || '').trim().toLowerCase();
          if (!kw) return rows.length > 0;
          return rows.some(r => JSON.stringify(r).toLowerCase().includes(kw));
        }
      }))
    }));

    const updatedBlocks = { ...workstationBlocks };

    // Reset missing documents array per block
    Object.keys(updatedBlocks).forEach(stId => {
      updatedBlocks[stId].missingDocuments = [];
    });

    requiredDocs.forEach(reqDoc => {
      // Resolve mapped table name if manually linked
      const mappedDocTitle = manualDocLinks[reqDoc.name] || reqDoc.name;

      // Search in QmsDatabase documents_table using selectRow or mappedDocTitle
      let dbRow = QmsDatabase.selectRow(QmsDatabase.TABLES.DOCUMENTS, mappedDocTitle);
      if (!dbRow && manualDocLinks[reqDoc.name]) {
        const allDocs = QmsDatabase.selectAll(QmsDatabase.TABLES.DOCUMENTS) || {};
        const foundKey = Object.keys(allDocs).find(k => k === mappedDocTitle || k.includes(mappedDocTitle));
        if (foundKey) {
          dbRow = allDocs[foundKey];
        }
      }

      let rows: any[] = [];
      if (Array.isArray(dbRow)) {
        rows = dbRow;
      } else if (dbRow && typeof dbRow === 'object' && Array.isArray((dbRow as any).items)) {
        rows = (dbRow as any).items;
      }
      
      const isTableFound = (rows && rows.length > 0) || !!manualDocLinks[reqDoc.name];

      // 1. Check Table Identification
      if (!isTableFound) {
        logs.push({
          timestamp: new Date().toLocaleTimeString('fa-IR'),
          docName: reqDoc.name,
          docType: reqDoc.type,
          status: 'NOT_FOUND',
          rowCount: 0,
          details: `❌ عدم شناسایی جدول: جدول یا سند '${reqDoc.name}' در دیتابیس QMS یافت نشد.`
        });

        // Report table missing to all relevant stations
        reqDoc.contentsByStation.forEach(item => {
          if (updatedBlocks[item.stationId]) {
            const exists = updatedBlocks[item.stationId].missingDocuments.some(m => m.docName === reqDoc.name && m.type === 'MISSING_TABLE');
            if (!exists) {
              updatedBlocks[item.stationId].missingDocuments.push({
                docName: reqDoc.name,
                docType: reqDoc.type,
                type: 'MISSING_TABLE',
                reason: `جدول/سند «${reqDoc.name}» در دیتابیس QMS شناسایی نشد.`
              });
            }
          }
        });
      } else {
        // Table exists or is manually linked!
        logs.push({
          timestamp: new Date().toLocaleTimeString('fa-IR'),
          docName: reqDoc.name,
          docType: reqDoc.type,
          status: 'FOUND',
          rowCount: rows.length,
          details: manualDocLinks[reqDoc.name]
            ? `🔗 پیوند دستی: جدول '${reqDoc.name}' به '${manualDocLinks[reqDoc.name]}' متصل گردید (شامل ${rows.length} رکورد).`
            : `✅ جدول '${reqDoc.name}' شناسایی شد (شامل ${rows.length} رکورد).`
        });

        // 2. Check Content Existence within the existing table or via manual content link
        reqDoc.contentsByStation.forEach(item => {
          const contentKey = `${reqDoc.name}_${item.stationId}_${item.contentName}`;
          const isContentLinked = !!manualContentLinks[contentKey];
          // AI actively checks row content for both auto-identified and manually linked tables
          const contentFoundInRows = rows && rows.length > 0 && item.checkFn(rows);
          const hasContent = isContentLinked || contentFoundInRows;

          if (!hasContent) {
            const isManuallyLinked = !!manualDocLinks[reqDoc.name];
            const activeTableName = isManuallyLinked ? manualDocLinks[reqDoc.name] : reqDoc.name;

            const detailMsg = isManuallyLinked
              ? `⚠️ عدم وجود محتوا: هوش مصنوعی محتوای «${item.contentName}» را در جدول پیوند داده شده «${activeTableName}» پیدا نکرد.`
              : `⚠️ عدم وجود محتوا: هوش مصنوعی محتوای «${item.contentName}» را در جدول «${reqDoc.name}» پیدا نکرد.`;

            logs.push({
              timestamp: new Date().toLocaleTimeString('fa-IR'),
              docName: reqDoc.name,
              docType: reqDoc.type,
              status: 'NOT_FOUND',
              rowCount: rows.length,
              details: detailMsg
            });

            if (updatedBlocks[item.stationId]) {
              updatedBlocks[item.stationId].missingDocuments.push({
                docName: reqDoc.name,
                docType: reqDoc.type,
                type: 'MISSING_CONTENT',
                contentName: item.contentName,
                reason: isManuallyLinked
                  ? `هوش مصنوعی محتوای «${item.contentName}» را در جدول پیوند داده شده «${activeTableName}» پیدا نکرد.`
                  : `هوش مصنوعی محتوای «${item.contentName}» را در جدول «${reqDoc.name}» پیدا نکرد.`
              });
            }
          }
        });
      }
    });

    setWorkstationBlocks(updatedBlocks);
    setDbQueryLogs(logs);

    // Load existing items from localStorage if available, otherwise keep current state
    try {
      const saved = localStorage.getItem('qms_job_setup_checklist_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setChecklistItems(parsed);
        }
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadInitialSetupData();

    // Auto-listen for document creation or changes in QmsDatabase
    const handleDbMutated = () => {
      loadInitialSetupData();
      showToast('🤖 هوش مصنوعی سند جدید ایجادشده در دیتابیس را شناسایی کرد و در حال استخراج اطلاعات است...', 'info');
      handleGenerateAiSmartJobSetup();
    };

    window.addEventListener('qms-db-mutated', handleDbMutated);
    return () => {
      window.removeEventListener('qms-db-mutated', handleDbMutated);
    };
  }, [selectedProduct, selectedPartNo]);

  // ---------------------------------------------------------------------------
  // 5. HELPER FOR CREATING BLANK TEMPLATE IN DATABASE
  // ---------------------------------------------------------------------------
  const handleSeedBlankDocumentToDb = (docName: string, stationId: string) => {
    // Write blank template row into QmsDatabase
    QmsDatabase.writeRow(QmsDatabase.TABLES.DOCUMENTS, docName, [
      {
        id: `blank-seed-${Date.now()}`,
        field1: `سند جدید ${docName}`,
        field2: `ایجاد شده جهت پشتیبانی از چک‌لیست راه‌اندازی ایستگاه ${stationId}`,
        field3: 'نسخه خام (Draft)',
        field4: new Date().toLocaleDateString('fa-IR')
      }
    ]);

    // Update workstation missing list
    setWorkstationBlocks(prev => {
      const copy = { ...prev };
      if (copy[stationId]) {
        copy[stationId].missingDocuments = copy[stationId].missingDocuments.filter(d => d.docName !== docName);
      }
      return copy;
    });

    // Add to DB query logs
    setDbQueryLogs(prev => [
      {
        timestamp: new Date().toLocaleTimeString('fa-IR'),
        docName,
        docType: 'BLANK_SEED',
        status: 'CREATED_BLANK',
        rowCount: 1,
        details: `سند خام '${docName}' توسط کارشناس کیفی ایجاد و در دیتابیس QMS پیوند داده شد.`
      },
      ...prev
    ]);

    showToast(`✅ سند خام '${docName}' با موفقیت در دیتابیس QMS ثبت و پیوند داده شد.`, 'success');
  };

  // ---------------------------------------------------------------------------
  // 6. FILTERING ITEMS BY STATION & SEARCH
  // ---------------------------------------------------------------------------
  const filteredItems = useMemo(() => {
    return checklistItems.filter(item => {
      // Station Filter
      if (activeStationFilter !== 'all' && item.stationId !== activeStationFilter) return false;
      // Category Filter
      if (selectedCategoryFilter !== 'all' && item.category !== selectedCategoryFilter) return false;
      // Control Type Filter
      if (selectedControlTypeFilter !== 'all' && item.controlType !== selectedControlTypeFilter) return false;
      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.parameterName.toLowerCase().includes(q) ||
          item.gaugeTool.toLowerCase().includes(q) ||
          item.targetValue.toLowerCase().includes(q) ||
          item.sourceModule.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [checklistItems, activeStationFilter, selectedCategoryFilter, selectedControlTypeFilter, searchQuery]);

  // Group items by station for All Workstations Block View
  const itemsByStation = useMemo(() => {
    const map: Record<string, SetupCheckItem[]> = {};
    Object.keys(workstationBlocks).forEach(stId => {
      map[stId] = filteredItems.filter(item => item.stationId === stId);
    });
    return map;
  }, [filteredItems, workstationBlocks]);

  // Overall Statistics & Station Readiness Scores
  const stationStats = useMemo(() => {
    const statsMap: Record<string, { total: number; verified: number; score: number; criticalCount: number; hasUnverifiedCritical: boolean }> = {};

    Object.keys(workstationBlocks).forEach(stId => {
      const stItems = checklistItems.filter(i => i.stationId === stId && i.diffStatus !== 'deleted');
      const total = stItems.length;
      const verified = stItems.filter(i => i.verified).length;
      const criticalCount = stItems.filter(i => i.controlType === 'Safety' || i.controlType === 'CC').length;
      const hasUnverifiedCritical = stItems.some(i => (i.controlType === 'Safety' || i.controlType === 'CC') && !i.verified);
      const score = total > 0 ? Math.round((verified / total) * 100) : 0;

      statsMap[stId] = { total, verified, score, criticalCount, hasUnverifiedCritical };
    });

    const grandTotal = checklistItems.filter(i => i.diffStatus !== 'deleted').length;
    const grandVerified = checklistItems.filter(i => i.verified && i.diffStatus !== 'deleted').length;
    const grandScore = grandTotal > 0 ? Math.round((grandVerified / grandTotal) * 100) : 0;

    return { statsMap, grandTotal, grandVerified, grandScore };
  }, [checklistItems, workstationBlocks]);

  // ---------------------------------------------------------------------------
  // 7. PERMIT ISSUANCE, VERIFICATION, REJECTION & CRUD HANDLERS
  // ---------------------------------------------------------------------------
  const handleToggleVerify = (id: string) => {
    setChecklistItems(prev => prev.map(item => {
      if (item.id === id) {
        const nextVerified = !item.verified;
        if (!nextVerified && workstationBlocks[item.stationId]?.permitStatus === 'approved') {
          showToast(`⚠️ درصد آمادگی ایستگاه ${item.stationId} به علت لغو تایید '${item.parameterName}' کاهش یافت.`, 'warning');
        }
        return { ...item, verified: nextVerified };
      }
      return item;
    }));
    setHasDraftChanges(true);
  };

  const handlePassAllStationItems = (stId: string) => {
    setChecklistItems(prev => prev.map(item => {
      if (item.stationId === stId) {
        return { ...item, verified: true };
      }
      return item;
    }));
    setHasDraftChanges(true);
    showToast(`✅ تمامی آیتم‌های کنترلی ایستگاه ${stId} به صورت گروهی تایید شدند.`, 'success');
  };

  const handleIssueFirstOffPermit = (stId: string) => {
    const stStat = stationStats.statsMap[stId];
    if (stStat.hasUnverifiedCritical) {
      showToast(`❌ امکان صدور مجوز راه‌اندازی وجود ندارد! مشخصه‌های بحرانی (KPC/KCC/Safety) در ایستگاه ${stId} هنوز تایید نشده‌اند.`, 'warning');
      return;
    }

    setWorkstationBlocks(prev => {
      const copy = { ...prev };
      if (copy[stId]) {
        copy[stId] = {
          ...copy[stId],
          permitStatus: 'approved',
          permitNo: `JS-PERMIT-${stId}-${Math.floor(1000 + Math.random() * 9000)}`,
          issuedBy: inspectorName,
          issuedAt: new Date().toLocaleString('fa-IR'),
          inspectorNotes: 'مجوز شروع تولید (First-Off Production Release Permit) با تایید کامل مشخصه‌های مهم صادر شد.'
        };
      }
      return copy;
    });

    showToast(`🎉 پروانه و مجوز رسمی شروع کار برای ایستگاه ${stId} با موفقیت صادر شد.`, 'success');
  };

  // Reject / Non-Approval of Station Permit
  const handleRejectFirstOffPermit = (stId: string, reason: string) => {
    setWorkstationBlocks(prev => ({
      ...prev,
      [stId]: {
        ...prev[stId],
        permitStatus: 'rejected',
        issuedBy: inspectorName,
        issuedAt: new Date().toLocaleString('fa-IR'),
        inspectorNotes: `عدم تایید / رد مجوز: ${reason || 'عدم انطباق ابعادی یا پارامتری قطعه اول'}`
      }
    }));

    // Auto trigger CAPA Non-conformance log in QMS
    setCapaLogs(prev => [
      {
        id: `CAPA-SETUP-${Date.now()}`,
        stationId: stId,
        reason: reason || 'عدم انطباق مشخصات مهم در راه‌اندازی اولیه',
        timestamp: new Date().toLocaleString('fa-IR'),
        status: 'open'
      },
      ...prev
    ]);

    showToast(`❌ پروانه و مجوز راه‌اندازی ایستگاه ${stId} رد شد و گزارش اقدام اصلاحی (CAPA) در دیتابیس ثبت شد.`, 'warning');
    setIsRejectPermitModalOpen(false);
    setRejectReasonInput('');
  };

  // Revoke Approved Permit back to Pending
  const handleRevokePermit = (stId: string) => {
    setWorkstationBlocks(prev => ({
      ...prev,
      [stId]: {
        ...prev[stId],
        permitStatus: 'pending',
        inspectorNotes: 'تاییدیه صادر شده لغو گردید. ایستگاه مجدداً نیازمند صحت‌سنجی کامل است.'
      }
    }));
    showToast(`🔄 پروانه ایستگاه ${stId} با موفقیت لغو شد و به حالت در انتظار بازگشت.`, 'info');
  };

  // Add Item to Station
  const handleAddItemToStation = () => {
    if (!editingItem?.parameterName || !editingItem?.targetValue) return;

    const newItem: SetupCheckItem = {
      id: `chk-custom-${Date.now()}`,
      stepNo: checklistItems.filter(i => i.stationId === selectedStationForNewItem).length + 1,
      stationId: selectedStationForNewItem,
      category: editingItem.category || 'parameters',
      parameterName: editingItem.parameterName,
      controlType: editingItem.controlType || 'CC',
      targetValue: editingItem.targetValue,
      measuredValue: editingItem.measuredValue || 'کنترل شد',
      gaugeTool: editingItem.gaugeTool || 'کالیپر / گیج چشمی',
      calibrationStatus: 'valid',
      methodFrequency: editingItem.methodFrequency || '۱۰۰٪ راه‌اندازی',
      reactionPlan: editingItem.reactionPlan || 'توقف خط و گزارش به کیفی',
      sourceModule: 'ورودی دستی کارشناس (Manual Entry)',
      sourceTable: 'custom_setup_table',
      sourceColumn: 'custom_param',
      sourceRecordKey: 'CUSTOM-ENTRY',
      selectionLogic: 'افزوده شده به صورت سفارشی توسط کارشناس کیفی',
      verified: false,
      diffStatus: 'added'
    };

    setChecklistItems(prev => [...prev, newItem]);
    setHasDraftChanges(true);
    setIsAddModalOpen(false);
    setEditingItem(null);
    showToast(`✅ آیتم جدید با موفقیت به ایستگاه ${selectedStationForNewItem} افزوده شد.`, 'info');
  };

  // Save Edit Item
  const handleSaveEditedItem = () => {
    if (!itemToEdit) return;
    setChecklistItems(prev => prev.map(i => i.id === itemToEdit.id ? { ...itemToEdit, diffStatus: 'edited' } : i));
    setHasDraftChanges(true);
    setIsEditModalOpen(false);
    setItemToEdit(null);
    showToast('✅ ویرایش مشخصه کنترلی با موفقیت ثبت شد.', 'success');
  };

  const handleMarkForDelete = (id: string) => {
    const item = checklistItems.find(i => i.id === id);
    const isDeleting = item?.diffStatus !== 'deleted';
    const itemName = item?.parameterName || 'این مشخصه کنترلی';

    if (isDeleting) {
      setDeleteConfirmModal({
        isOpen: true,
        title: 'تأیید حذف مشخصه کنترلی',
        message: `آیا از حذف مشخصه کنترلی «${itemName}» اطمینان دارید؟`,
        onConfirm: () => {
          setChecklistItems(prev => prev.map(it => {
            if (it.id === id) {
              if (it.diffStatus === 'added') {
                return null as any;
              }
              return { ...it, diffStatus: 'deleted' as const };
            }
            return it;
          }).filter(Boolean));
          setHasDraftChanges(true);
          showToast(`مشخصه کنترلی «${itemName}» حذف گردید.`, 'info');
          setDeleteConfirmModal(null);
        }
      });
    } else {
      setChecklistItems(prev => prev.map(it => {
        if (it.id === id) {
          return { ...it, diffStatus: 'unchanged' as const };
        }
        return it;
      }));
      setHasDraftChanges(true);
      showToast('مشخصه کنترلی بازیابی گردید.', 'success');
    }
  };

  // Export Station CSV Data
  const handleExportStationCSV = (stId: string) => {
    const stItems = checklistItems.filter(i => i.stationId === stId && i.diffStatus !== 'deleted');
    const stBlock = workstationBlocks[stId];
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += `ایستگاه کاری,${stBlock?.stationName || stId}\n`;
    csvContent += `کد عملیات,${stBlock?.operationCode},دستگاه,${stBlock?.machineTitle}\n`;
    csvContent += `شماره پروانه,${stBlock?.permitNo || '---'},وضعیت پروانه,${stBlock?.permitStatus || '---'}\n\n`;
    csvContent += "گام,عنوان مشخصه,کلاس کنترل,حد هدف,مقدار اندازه‌گیری شده,ابزار گیج,وضعیت صحت‌سنجی,منبع داده\n";
    stItems.forEach((item, idx) => {
      csvContent += `${idx + 1},"${item.parameterName}",${item.controlType},"${item.targetValue}","${item.measuredValue || ''}","${item.gaugeTool}",${item.verified ? 'تایید' : 'عدم تایید'},"${item.sourceModule}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `JobSetup_${stId}_${selectedPartNo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`📊 خروجی Excel/CSV ایستگاه ${stId} با موفقیت دریافت شد.`, 'success');
  };

  // 1-Click Shift Handover Reset
  const handleShiftHandoverReset = () => {
    setChecklistItems(prev => prev.map(item => ({ ...item, verified: false })));
    setWorkstationBlocks(prev => {
      const copy = { ...prev };
      Object.keys(copy).forEach(k => {
        copy[k] = { ...copy[k], permitStatus: 'pending', inspectorNotes: 'بازنشانی شیفت جدید انجام شد. تایید مجدد راه‌اندازی قطعه اول الزامی است.' };
      });
      return copy;
    });
    showToast('🔄 بازنشانی شیفت جدید انجام شد. تایید مجدد چک‌لیست‌ها فعال گردید.', 'info');
  };

  // Save changes back to QMS / parent
  const handleSaveToQmsDatabase = () => {
    const finalItems = checklistItems.filter(i => i.diffStatus !== 'deleted');
    setChecklistItems(finalItems.map(i => ({ ...i, diffStatus: 'unchanged' })));
    setHasDraftChanges(false);

    if (onSave) {
      const docItemsToSave: DocItem[] = finalItems.map(item => ({
        id: item.id,
        field1: `[${item.stationId}] گام ${item.stepNo}: ${item.parameterName}`,
        field2: item.targetValue,
        field3: item.gaugeTool,
        field4: item.methodFrequency,
        field5: item.reactionPlan,
        field6: item.sourceModule,
        field7: item.controlType,
        verified: item.verified ? 'بله' : 'خیر'
      }));
      onSave(docItemsToSave, undefined, documentTitle);
    }

    showToast('✅ تمامی تغییرات در دیتابیس QMS و سوابق راه‌اندازی ذخیره شدند.', 'success');
  };

  // ---------------------------------------------------------------------------
  // RENDER UI
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col gap-6 text-right w-full text-zinc-100 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>

      {/* =================================================================== */}
      {/* TOAST NOTIFICATION FLOATING BANNER                                  */}
      {/* =================================================================== */}
      {notificationToast && (
        <div className={`fixed bottom-6 left-6 z-50 px-5 py-3.5 rounded-2xl border shadow-2xl flex items-center gap-3 animate-bounce backdrop-blur-xl ${
          notificationToast.type === 'success'
            ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
            : notificationToast.type === 'warning'
            ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
            : 'bg-cyan-950/90 border-cyan-500/50 text-cyan-200'
        }`}>
          {notificationToast.type === 'success' && <CheckCircle2 size={18} className="text-emerald-400" />}
          {notificationToast.type === 'warning' && <AlertTriangle size={18} className="text-amber-400" />}
          {notificationToast.type === 'info' && <Sparkles size={18} className="text-cyan-400" />}
          <span className="text-xs font-bold">{notificationToast.message}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* HEADER & TOP CONTROL BAR                                            */}
      {/* =================================================================== */}
      <div className="bg-[#0D0D10]/95 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative backdrop-blur-2xl">
        <div className="absolute -top-12 -left-12 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 border-b border-zinc-800/80 pb-5">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/40 rounded-2xl text-emerald-400 shadow-inner">
              <ClipboardCheck size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleTogglePin}
                  className="p-1 cursor-pointer flex items-center justify-center transition-transform hover:scale-125"
                  title={isPinned ? 'پین شده به داشبورد ابزار IATF (جهت لغو کلیک کنید)' : 'پین کردن به داشبورد ابزار IATF'}
                >
                  <span className="text-2xl animate-pulse inline-block select-none leading-none drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]">📌</span>
                </button>

                <h1 className="text-lg font-black text-white tracking-wide">{documentTitle}</h1>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  IATF 16949 § 8.5.1.3
                </span>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {activeVersion}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                ابزار جامع ممیزی، صحت‌سنجی داده‌محور و صدور پروانه رسمی اجازه شروع تولید بر اساس الزامات استاندارد IATF 16949
              </p>
            </div>
          </div>

          {/* Main Action Bar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/20 border border-blue-400/40 transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="پیش‌نمایش چاپی شناسنامه، تنظیم هدر/فوتر و خروجی PDF"
            >
              <Printer size={16} />
              <span>پیش‌نمایش و چاپ / PDF</span>
            </button>

            <button
              onClick={handleGenerateAiSmartJobSetup}
              disabled={isAiGenerating}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-lg shadow-amber-500/20 border border-amber-300/40 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50"
              title="استخراج هوشمند مشخصه‌های کنترلی از اسناد واقعی دیتابیس QMS"
            >
              <Sparkles size={16} className={isAiGenerating ? 'animate-spin' : ''} />
              <span>{isAiGenerating ? 'در حال استخراج واقعی...' : 'ایجاد هوشمند Job Setup (AI)'}</span>
            </button>

            <button
              onClick={() => setIsAiRefDocsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-lg shadow-indigo-500/20 border border-indigo-400/40 transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="افزودن یا حذف جداول مرجع مورد استفاده هوش مصنوعی"
            >
              <Database size={16} className="text-indigo-200" />
              <span>مدیریت منابع AI ({aiReferenceRequirements.length} جدول)</span>
            </button>

            <button
              onClick={() => {
                setNewStationForm({
                  stationId: '',
                  stationName: '',
                  operationCode: '',
                  operationTitle: '',
                  machineCode: '',
                  machineTitle: '',
                  operatorName: '',
                  shiftName: 'شیفت روز (A)'
                });
                setIsAddStationModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-black bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <Plus size={16} />
              <span>تعریف ایستگاه کاری</span>
            </button>

            <button
              onClick={handleSaveToQmsDatabase}
              className="flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all cursor-pointer hover:scale-105 active:scale-95"
            >
              <FileCheck size={16} />
              <span>ذخیره تغییرات</span>
            </button>
          </div>
        </div>
      </div>


      {/* =================================================================== */}
      {/* OVERALL PRODUCTION LINE READINESS METRICS                           */}
      {/* =================================================================== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0D0D10]/90 border border-zinc-800/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-xl">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <div className="text-xl font-black text-white">{stationStats.grandVerified} / {stationStats.grandTotal}</div>
            <div className="text-[11px] text-zinc-400 font-bold">آیتم‌های تایید شده راه‌اندازی</div>
          </div>
        </div>

        <div className="bg-[#0D0D10]/90 border border-zinc-800/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-xl">
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="text-xl font-black text-white">
              {Object.values(workstationBlocks).filter((b: WorkstationBlockData) => b.permitStatus === 'approved').length} / {Object.keys(workstationBlocks).length} ایستگاه
            </div>
            <div className="text-[11px] text-zinc-400 font-bold">پروانه شروع کار صادر شده</div>
          </div>
        </div>

        <div className="bg-[#0D0D10]/90 border border-zinc-800/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-xl">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-2xl border border-cyan-500/20">
            <Gauge size={22} />
          </div>
          <div>
            <div className="text-xl font-black text-white">{stationStats.grandScore}%</div>
            <div className="text-[11px] text-zinc-400 font-bold">شاخص آمادگی خط تولید (Readiness)</div>
          </div>
        </div>

        <div className="bg-[#0D0D10]/90 border border-zinc-800/90 rounded-2xl p-4 flex items-center gap-3.5 shadow-xl">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
            <Database size={22} />
          </div>
          <div>
            <div className="text-xl font-black text-white">
              {dbQueryLogs.filter(l => l.status === 'FOUND').length} سند
            </div>
            <div className="text-[11px] text-zinc-400 font-bold">اسناد مرجع همگام با دیتابیس QMS</div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* TABS NAVIGATION                                                     */}
      {/* =================================================================== */}
      <div className="bg-[#131317]/80 backdrop-blur-md border border-zinc-800 rounded-2xl p-2 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 overflow-x-auto shadow-xl">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveTab('station_blocks')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer whitespace-nowrap hover:scale-[1.02] active:scale-95 ${
              activeTab === 'station_blocks'
                ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-teal-500/5 text-emerald-300 border border-emerald-500/40 shadow-md shadow-emerald-500/5'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <Layers size={15} className={activeTab === 'station_blocks' ? 'text-emerald-400' : ''} />
            <span>بلوک‌های اختصاصی ایستگاه‌های کاری (Workstation Blocks)</span>
            <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold transition-all ${
              activeTab === 'station_blocks' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-800 text-zinc-500'
            }`}>
              {Object.keys(workstationBlocks).length} ایستگاه
            </span>
          </button>

          <button
            onClick={() => setActiveTab('in_process_control')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer whitespace-nowrap hover:scale-[1.02] active:scale-95 ${
              activeTab === 'in_process_control'
                ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-500/5 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-500/5'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <ShieldCheck size={15} className={activeTab === 'in_process_control' ? 'text-amber-400' : ''} />
            <span>کنترل حین تولید</span>
            <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold transition-all ${
              activeTab === 'in_process_control' ? 'bg-amber-500/20 text-amber-300' : 'bg-zinc-800 text-zinc-500'
            }`}>
              IATF 8.5.1.1
            </span>
          </button>

          <button
            onClick={() => setActiveTab('permits')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer whitespace-nowrap hover:scale-[1.02] active:scale-95 ${
              activeTab === 'permits'
                ? 'bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-orange-500/5 text-amber-300 border border-amber-500/40 shadow-md shadow-amber-500/5'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <Award size={15} className={activeTab === 'permits' ? 'text-amber-400 animate-pulse' : ''} />
            <span>پروانه‌ها و مجوزهای صادره شروع تولید</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer whitespace-nowrap hover:scale-[1.02] active:scale-95 ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-indigo-500/20 via-purple-500/15 to-purple-500/5 text-indigo-300 border border-indigo-500/40 shadow-md shadow-indigo-500/5'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            <History size={15} className={activeTab === 'history' ? 'text-indigo-400' : ''} />
            <span>تاریخچه نسخ و Audit Trail</span>
          </button>
        </div>

        {hasDraftChanges && (
          <button
            onClick={handleSaveToQmsDatabase}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg hover:shadow-emerald-500/10 cursor-pointer transition-all duration-200 hover:scale-[1.02]"
          >
            <CheckCircle2 size={14} />
            <span>ذخیره تغییرات در دیتابیس</span>
          </button>
        )}
      </div>

      {/* =================================================================== */}
      {/* TAB 1: WORKSTATION BLOCKS MAIN VIEW                                 */}
      {/* =================================================================== */}
      {activeTab === 'station_blocks' && (
        <div className="flex flex-col gap-6">

          {/* Quick Toolbar & Category Filters */}
          <div className="bg-[#0D0D10]/80 border border-zinc-800/80 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <div className="relative w-full md:w-64">
                <Search size={14} className="absolute right-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="جستجوی مشخصه، گیج، منبع..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#141418] border border-zinc-800 rounded-xl pr-9 pl-3 py-1.5 text-xs text-zinc-200 outline-none focus:border-emerald-500"
                />
              </div>

              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-[#141418] border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 outline-none font-medium"
              >
                <option value="all">همه دسته‌ها (ایمنی، پارامتر، ابزار...)</option>
                <option value="safety">ایمنی و HSE</option>
                <option value="tooling">ابزارها و قالب‌ها</option>
                <option value="parameters">پارامترهای دستگاه</option>
                <option value="material">مواد اولیه</option>
                <option value="quality_first_off">قطعه اول (First-Off Approval)</option>
              </select>

              <select
                value={selectedControlTypeFilter}
                onChange={(e) => setSelectedControlTypeFilter(e.target.value)}
                className="bg-[#141418] border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-300 outline-none font-medium"
              >
                <option value="all">همه کلاس‌های کنترل (CC / SC / Safety)</option>
                <option value="Safety">ایمنی (Safety)</option>
                <option value="CC">مشخصه بحرانی محصول (CC / KPC)</option>
                <option value="SC">مشخصه بحرانی فرآیند (SC / KCC)</option>
                <option value="Standard">استاندارد عمومی</option>
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setSelectedStationForNewItem(activeStationFilter !== 'all' ? activeStationFilter : 'WS-104');
                  setEditingItem({
                    id: '',
                    stepNo: 1,
                    stationId: activeStationFilter !== 'all' ? activeStationFilter : 'WS-104',
                    category: 'parameters',
                    parameterName: '',
                    controlType: 'CC',
                    targetValue: '',
                    gaugeTool: '',
                    methodFrequency: '۱۰۰٪ قطعه اول راه‌اندازی',
                    reactionPlan: 'توقف خط و گزارش به کیفی',
                    sourceModule: 'ورودی دستی کارشناس',
                    sourceTable: 'custom_table',
                    sourceColumn: '',
                    sourceRecordKey: '',
                    selectionLogic: '',
                    verified: false
                  });
                  setIsAddModalOpen(true);
                }}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 transition-all cursor-pointer"
              >
                <Plus size={14} />
                <span>افزودن سطر به جدول</span>
              </button>

              <button
                onClick={() => setIsCustomColumnModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-teal-500/20 hover:bg-teal-500/30 text-teal-200 border border-teal-500/40 transition-all cursor-pointer"
                title="افزودن ستون جدید به جدول بلوک‌های ایستگاه‌ها"
              >
                <PlusCircle size={14} className="text-teal-400" />
                <span>افزودن ستون به جدول</span>
              </button>
            </div>
          </div>

          {/* RENDER EACH WORKSTATION BLOCK */}
          {(Object.entries(workstationBlocks) as [string, WorkstationBlockData][])
            .filter(([stId]) => activeStationFilter === 'all' || activeStationFilter === stId)
            .map(([stId, block]) => {
              const stItems = itemsByStation[stId] || [];
              const stStat = stationStats.statsMap[stId] || { total: 0, verified: 0, score: 0, criticalCount: 0, hasUnverifiedCritical: false };

              return (
                <div
                  key={stId}
                  className={`bg-[#0D0D10]/95 border rounded-3xl p-6 shadow-2xl relative overflow-hidden transition-all ${
                    block.permitStatus === 'approved'
                      ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
                      : stStat.hasUnverifiedCritical
                      ? 'border-amber-500/40'
                      : 'border-zinc-800'
                  }`}
                >
                  {/* WORKSTATION BLOCK HEADER */}
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-zinc-800 pb-4 mb-5">
                    <div className="flex items-center gap-3.5">
                      <div className={`p-3 rounded-2xl border font-black text-sm flex items-center justify-center w-12 h-12 ${
                        block.permitStatus === 'approved'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                      }`}>
                        {stId}
                      </div>

                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h2 className="text-base font-black text-white">{block.stationName}</h2>
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                            عملیات: {block.operationCode} ({block.operationTitle})
                          </span>
                          <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                            دستگاه: {block.machineTitle}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-zinc-400 mt-1 font-medium">
                          <span>اپراتور: <strong className="text-zinc-200">{block.operatorName}</strong></span>
                          <span>•</span>
                          <span>شیفت: <strong className="text-zinc-200">{block.shiftName}</strong></span>
                          <span>•</span>
                          <span>آمادگی ایستگاه: <strong className="text-emerald-400 font-bold">{stStat.score}%</strong> ({stStat.verified} از {stStat.total} آیتم)</span>
                        </div>
                      </div>
                    </div>

                    {/* PERMIT STATUS & ACTION PER WORKSTATION */}
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {block.permitStatus === 'approved' ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/40 text-emerald-300">
                            <CheckCircle2 size={16} />
                            <div className="flex flex-col text-right">
                              <span className="text-xs font-black">پروانه اجازه شروع کار صادر شد</span>
                              <span className="text-[9px] text-emerald-400/80">{block.permitNo} | {block.issuedBy}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleRevokePermit(stId)}
                            className="px-3 py-2 rounded-2xl text-xs font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 transition-all cursor-pointer flex items-center gap-1"
                            title="لغو پروانه صادر شده"
                          >
                            <XCircle size={14} />
                            <span>لغو تایید</span>
                          </button>
                        </div>
                      ) : block.permitStatus === 'rejected' ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-rose-500/10 border border-rose-500/40 text-rose-300">
                            <XCircle size={16} />
                            <div className="flex flex-col text-right">
                              <span className="text-xs font-black">مجوز راه‌اندازی عدم تایید (رد شد)</span>
                              <span className="text-[9px] text-rose-400/80">{block.inspectorNotes}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleIssueFirstOffPermit(stId)}
                            className="px-3 py-2 rounded-2xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer flex items-center gap-1"
                          >
                            <CheckCircle2 size={14} />
                            <span>بررسی و تایید مجدد</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => handleIssueFirstOffPermit(stId)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-black shadow-lg transition-all cursor-pointer ${
                              stStat.hasUnverifiedCritical
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                                : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-900/40 hover:from-emerald-500 hover:to-teal-500'
                            }`}
                          >
                            <Award size={15} />
                            <span>صدور پروانه اجازه شروع کار</span>
                          </button>

                          <button
                            onClick={() => {
                              setRejectingStationId(stId);
                              setIsRejectPermitModalOpen(true);
                            }}
                            className="px-3 py-2 rounded-2xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-all cursor-pointer flex items-center gap-1"
                            title="عدم تایید و ثبت عدم انطباق"
                          >
                            <XCircle size={14} />
                            <span>عدم تایید مجوز</span>
                          </button>
                        </div>
                      )}

                      <button
                        onClick={() => handlePassAllStationItems(stId)}
                        className="px-2.5 py-2 rounded-2xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all cursor-pointer whitespace-nowrap"
                        title="تایید گروهی تمام آیتم‌های این ایستگاه"
                      >
                        تایید ۱۰۰٪
                      </button>

                      {/* Station Edit & Delete Action Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setEditingStationForm(block);
                            setIsEditStationModalOpen(true);
                          }}
                          className="p-2 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-all cursor-pointer"
                          title="ویرایش مشخصات این ایستگاه کاری"
                        >
                          <Edit3 size={14} />
                        </button>

                        <button
                          onClick={() => handleDeleteStationBlock(stId)}
                          className="p-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-all cursor-pointer"
                          title="حذف کامل این ایستگاه کاری"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* DATABASE MISSING DOCUMENTS & CONTENT ALERT BANNER INSIDE STATION BLOCK */}
                  {(block.missingDocuments.length > 0 || Object.keys(manualDocLinks).length > 0) && (
                    <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-amber-950/80 border border-amber-500/50 shadow-xl flex flex-col gap-3">
                      <div className="flex items-start gap-3 w-full">
                        <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400 shrink-0 mt-0.5">
                          <AlertTriangle size={20} />
                        </div>
                        <div className="w-full">
                          {block.missingDocuments.length > 0 && (
                            <>
                              <h4 className="text-xs font-black text-amber-200">
                                📢 هشدار دیتابیس (بررسی شناسایی جدول و محتوای مورد نیاز ایستگاه {stId}):
                              </h4>
                              <p className="text-[10px] text-amber-300/80 mt-0.5">
                                در صورت وجود جدول در دیتابیس، با کلیک روی دکمه «پیوند به جدول دیتابیس» می‌توانید جدول و محتوای مربوطه را به‌صورت دستی متصل نمایید.
                              </p>
                              <div className="flex flex-col gap-2.5 mt-2.5">
                                {block.missingDocuments.map((missing, idx) => {
                                  const inlineKey = `${stId}_${missing.docName}_${missing.contentName || ''}_${idx}`;
                                  const isInlineOpen = activeInlineLinkKey === inlineKey;

                                  return (
                                    <div key={idx} className="flex flex-col gap-2 p-2.5 rounded-xl bg-amber-950/60 border border-amber-500/40 transition-all">
                                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                                        <div className="flex items-start gap-2">
                                          {missing.type === 'MISSING_TABLE' ? (
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500/30 text-rose-300 border border-rose-500/50 shrink-0">
                                              عدم شناسایی جدول
                                            </span>
                                          ) : (
                                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/30 text-amber-300 border border-amber-500/50 shrink-0">
                                              محتوای یافت‌نشده
                                            </span>
                                          )}
                                          <p className="text-[11px] text-amber-200/90 font-medium">
                                            {missing.type === 'MISSING_TABLE' ? (
                                              <>
                                                • جدول/سند مرجع <strong className="underline text-rose-200">{missing.docName}</strong> در دیتابیس QMS شناسایی نشد.
                                              </>
                                            ) : (
                                              <>
                                                {missing.reason ? (
                                                  <>• {missing.reason}</>
                                                ) : manualDocLinks[missing.docName] ? (
                                                  <>
                                                    • هوش مصنوعی محتوای «<strong className="underline text-amber-100">{missing.contentName}</strong>» را در جدول پیوند داده شده «<strong className="underline text-emerald-200">{manualDocLinks[missing.docName]}</strong>» پیدا نکرد.
                                                  </>
                                                ) : (
                                                  <>
                                                    • هوش مصنوعی محتوای «<strong className="underline text-amber-100">{missing.contentName}</strong>» را در جدول «<strong className="underline text-amber-100">{missing.docName}</strong>» پیدا نکرد.
                                                  </>
                                                )}
                                              </>
                                            )}
                                          </p>
                                        </div>

                                        <button
                                          onClick={() => {
                                            if (isInlineOpen) {
                                              setActiveInlineLinkKey(null);
                                            } else {
                                              setActiveInlineLinkKey(inlineKey);
                                              setInlineSearch('');
                                              setInlineSelectedTable('');
                                              setSelectedMissingForLink({
                                                stationId: stId,
                                                docName: missing.docName,
                                                docType: missing.docType,
                                                type: missing.type,
                                                contentName: missing.contentName,
                                                reason: missing.reason
                                              });
                                            }
                                          }}
                                          className={`px-3 py-1.5 rounded-xl text-[10px] font-black border shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0 self-end sm:self-auto ${
                                            isInlineOpen
                                              ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400'
                                              : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white border-indigo-400/40'
                                          }`}
                                        >
                                          <Link2 size={13} />
                                          <span>{isInlineOpen ? 'بستن منوی اتصال' : 'پیوند به جدول دیتابیس'}</span>
                                        </button>
                                      </div>

                                      {/* Inline Connection Menu Block */}
                                      {isInlineOpen && (
                                        <div className="w-full mt-2 p-3.5 rounded-2xl bg-[#12121a] border-2 border-indigo-500/70 shadow-2xl flex flex-col gap-3 text-right">
                                          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                                            <div className="flex items-center gap-2 text-indigo-400">
                                              <Link2 size={16} />
                                              <span className="text-xs font-black text-white">
                                                منوی اتصال دستی منبع دیتابیس (پیوند در کادر فعال)
                                              </span>
                                            </div>
                                            <button
                                              onClick={() => setActiveInlineLinkKey(null)}
                                              className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer"
                                            >
                                              <X size={14} />
                                            </button>
                                          </div>

                                          <p className="text-[11px] text-zinc-300 leading-relaxed">
                                            {missing.type === 'MISSING_TABLE' ? (
                                              <>
                                                جدول مورد نظر برای پیوند به سند <strong className="text-rose-300 underline">{missing.docName}</strong> را از دیتابیس انتخاب کنید:
                                              </>
                                            ) : (
                                              <>
                                                جدول حاوی محتوای «<strong className="text-amber-200 underline">{missing.contentName}</strong>» برای سند <strong className="text-rose-300 underline">{missing.docName}</strong> را از دیتابیس انتخاب کنید:
                                              </>
                                            )}
                                          </p>

                                          {/* Inline Search Box */}
                                          <div className="relative">
                                            <Search size={14} className="absolute right-3 top-2.5 text-zinc-500" />
                                            <input
                                              type="text"
                                              placeholder="جستجوی نام جدول، کد سند یا محتوا در دیتابیس..."
                                              value={inlineSearch}
                                              onChange={(e) => setInlineSearch(e.target.value)}
                                              className="w-full bg-[#1a1a26] border border-zinc-700 rounded-xl pr-8 pl-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500 font-medium"
                                            />
                                          </div>

                                          {/* Inline List of Available Tables */}
                                          <div className="max-h-48 overflow-y-auto flex flex-col gap-2 pr-1">
                                            {availableDbTablesForLinking
                                              .filter(t => !inlineSearch || t.title.toLowerCase().includes(inlineSearch.toLowerCase()) || t.source.toLowerCase().includes(inlineSearch.toLowerCase()) || t.sampleItems.some(s => s.toLowerCase().includes(inlineSearch.toLowerCase())))
                                              .map((tbl, tIdx) => {
                                                const isSelected = inlineSelectedTable === tbl.title;
                                                return (
                                                  <div
                                                    key={tIdx}
                                                    onClick={() => setInlineSelectedTable(tbl.title)}
                                                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                                                      isSelected
                                                        ? 'bg-indigo-950/90 border-indigo-500 ring-2 ring-indigo-500/40 text-white'
                                                        : 'bg-[#181822] border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:bg-[#20202e]'
                                                    }`}
                                                  >
                                                    <div className="flex items-center justify-between">
                                                      <div className="flex items-center gap-2">
                                                        <Database size={14} className={isSelected ? 'text-indigo-400' : 'text-zinc-500'} />
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/40 shrink-0 font-mono">
                                                          {tbl.clauseNo}
                                                        </span>
                                                        <span className={`text-xs font-black ${isSelected ? 'text-indigo-200' : 'text-white'}`}>
                                                          {tbl.title}
                                                        </span>
                                                      </div>
                                                      <div className="flex items-center gap-1.5">
                                                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
                                                          #{tbl.indexNo} | {tbl.recordCount} رکورد
                                                        </span>
                                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-extrabold">
                                                          {tbl.badgeText || tbl.source}
                                                        </span>
                                                      </div>
                                                    </div>
                                                    {tbl.sampleItems.length > 0 && (
                                                      <div className="text-[9px] text-zinc-400 truncate dir-rtl text-right">
                                                        نمونه محتوا: {tbl.sampleItems.join(' | ')}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                          </div>

                                          {/* Inline Selected Table Info & Action Buttons */}
                                          <div className="flex items-center justify-between pt-2 border-t border-zinc-800 gap-2">
                                            <div className="text-[10px] text-zinc-400 truncate">
                                              {inlineSelectedTable ? (
                                                <span className="text-emerald-400 font-bold">انتخاب‌شده: {inlineSelectedTable}</span>
                                              ) : (
                                                <span>یک جدول را انتخاب کنید...</span>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <button
                                                onClick={() => setActiveInlineLinkKey(null)}
                                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
                                              >
                                                انصراف
                                              </button>
                                              <button
                                                onClick={() => {
                                                  handleSaveManualLink(inlineSelectedTable, {
                                                    stationId: stId,
                                                    docName: missing.docName,
                                                    docType: missing.docType,
                                                    type: missing.type,
                                                    contentName: missing.contentName,
                                                    reason: missing.reason
                                                  });
                                                }}
                                                disabled={!inlineSelectedTable}
                                                className="px-4 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                                              >
                                                <CheckCircle2 size={14} />
                                                <span>ثبت و اتصال به جاب‌ستاپ</span>
                                              </button>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}

                          {/* Active Manual Links Badges */}
                          {Object.keys(manualDocLinks).length > 0 && (
                            <div className={`${block.missingDocuments.length > 0 ? 'mt-3 pt-2.5 border-t border-amber-500/30' : ''}`}>
                              <span className="text-[11px] font-extrabold text-emerald-400 flex items-center gap-1.5 mb-1.5">
                                <Link2 size={13} />
                                <span>منابع پیوند داده شده دستی به دیتابیس (Manual DB Links):</span>
                              </span>
                              <div className="flex flex-wrap items-center gap-2">
                                {Object.entries(manualDocLinks).map(([reqName, targetName]) => (
                                  <div key={reqName} className="flex items-center gap-2 px-2.5 py-1 rounded-xl bg-emerald-950/80 border border-emerald-500/40 text-[11px] text-emerald-200 font-bold shadow-sm">
                                    <span>{reqName} ← <strong className="text-white underline">{targetName}</strong></span>
                                    <button
                                      onClick={() => handleRemoveManualLink(reqName)}
                                      className="text-rose-400 hover:text-rose-200 cursor-pointer p-0.5 rounded hover:bg-rose-500/20"
                                      title="حذف این پیوند دستی"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* CHECKLIST ITEMS TABLE FOR THIS STATION */}
                  <div className="overflow-x-auto rounded-2xl border border-zinc-700/80 bg-[#121216]">
                    <table className="w-full text-right text-xs border-collapse border border-zinc-700/80">
                      <thead>
                        <tr className="bg-[#17171d] border-b-2 border-zinc-700 text-zinc-300 font-extrabold text-[11px]">
                          <th className="p-3 text-center w-12 border-l border-zinc-700/70">صحه</th>
                          <th className="p-3 text-center w-12 border-l border-zinc-700/70">گام</th>
                          <th className="p-3 border-l border-zinc-700/70">عنوان پارامتر / مشخصه کنترلی ایستگاه</th>
                          <th className="p-3 text-center w-24 border-l border-zinc-700/70">کلاس کنترل</th>
                          <th className="p-3 border-l border-zinc-700/70">حد حدود و مقدار هدف</th>
                          <th className="p-3 border-l border-zinc-700/70">مقدار اندازه‌گیری شده قطعه اول</th>
                          <th className="p-3 border-l border-zinc-700/70">ابزار / گیج سنجش</th>
                          <th className="p-3 border-l border-zinc-700/70">روش و فرکانس</th>
                          <th className="p-3 border-l border-zinc-700/70">واکنش به عدم انطباق</th>
                          {/* Dynamic Custom Columns */}
                          {customColumns.map(col => (
                            <th key={col.id} className="p-3 text-teal-300 font-black bg-teal-950/20 border-l border-teal-500/30">
                              <div className="flex items-center justify-between gap-1">
                                <span>{col.name}</span>
                                <button
                                  onClick={() => handleDeleteCustomColumn(col.id)}
                                  className="text-zinc-500 hover:text-rose-400 p-0.5 rounded cursor-pointer"
                                  title="حذف این ستون"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </div>
                            </th>
                          ))}
                          <th className="p-3 text-center border-l border-zinc-700/70">منبع داده دیتابیس</th>
                          <th className="p-3 text-center w-16">اقدام</th>
                        </tr>
                      </thead>
                      <tbody className="font-medium">
                        {stItems.length === 0 ? (
                          <tr>
                            <td colSpan={11 + customColumns.length} className="p-6 text-center text-zinc-500 font-bold border-b border-zinc-700/60">
                              هیچ آیتم کنترلی برای این ایستگاه ثبت نشده است.
                            </td>
                          </tr>
                        ) : (
                          stItems.map((item, idx) => {
                            const isCritical = item.controlType === 'Safety' || item.controlType === 'CC';

                            return (
                              <tr
                                key={item.id}
                                className={`border-b border-zinc-700/60 transition-all hover:bg-zinc-800/40 ${
                                  item.verified
                                    ? 'bg-emerald-950/10'
                                    : isCritical
                                    ? 'bg-amber-950/20'
                                    : ''
                                } ${item.diffStatus === 'deleted' ? 'line-through opacity-40 bg-rose-950/20' : ''}`}
                              >
                                {/* Checkbox */}
                                <td className="p-3 text-center border-l border-zinc-700/60">
                                  <button
                                    onClick={() => handleToggleVerify(item.id)}
                                    className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                                      item.verified
                                        ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/20'
                                        : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-emerald-500'
                                    }`}
                                  >
                                    <Check size={14} strokeWidth={3} />
                                  </button>
                                </td>

                                {/* Step No */}
                                <td className="p-3 text-center font-bold text-zinc-400 border-l border-zinc-700/60">
                                  {idx + 1}
                                </td>

                                {/* Parameter Name */}
                                <td className="p-3 font-bold text-zinc-100 border-l border-zinc-700/60">
                                  <div className="flex items-center gap-2">
                                    <span>{item.parameterName}</span>
                                    {item.diffStatus === 'added' && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold">جدید</span>
                                    )}
                                  </div>
                                </td>

                                {/* Control Class Badge */}
                                <td className="p-3 text-center border-l border-zinc-700/60">
                                  {item.controlType === 'Safety' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/40 font-black text-[10px]">
                                      <Shield size={10} />
                                      <span>Safety</span>
                                    </span>
                                  )}
                                  {item.controlType === 'CC' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black text-[10px]">
                                      <Sparkles size={10} />
                                      <span>CC (KPC)</span>
                                    </span>
                                  )}
                                  {item.controlType === 'SC' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-black text-[10px]">
                                      <Zap size={10} />
                                      <span>SC (KCC)</span>
                                    </span>
                                  )}
                                  {item.controlType === 'Standard' && (
                                    <span className="px-2.5 py-1 rounded-lg bg-zinc-800 text-zinc-300 border border-zinc-700 font-bold text-[10px]">
                                      استاندارد
                                    </span>
                                  )}
                                </td>

                                {/* Target Value */}
                                <td className="p-3 font-mono dir-ltr text-right text-emerald-300 font-extrabold text-[11px] border-l border-zinc-700/60">
                                  {item.targetValue}
                                </td>

                                {/* Measured Value */}
                                <td className="p-3 border-l border-zinc-700/60">
                                  <input
                                    type="text"
                                    value={item.measuredValue || ''}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setChecklistItems(prev => prev.map(i => i.id === item.id ? { ...i, measuredValue: val } : i));
                                    }}
                                    placeholder="ثبت اندازه قطعه اول..."
                                    className="bg-[#18181f] border border-zinc-700 rounded-xl px-2.5 py-1 text-xs text-zinc-100 outline-none focus:border-emerald-500 w-full"
                                  />
                                </td>

                                {/* Gauge / Tool */}
                                <td className="p-3 text-zinc-300 text-[11px] border-l border-zinc-700/60">
                                  <div className="flex items-center gap-1.5">
                                    <Gauge size={13} className="text-zinc-400 shrink-0" />
                                    <span>{item.gaugeTool}</span>
                                  </div>
                                </td>

                                {/* Method & Frequency */}
                                <td className="p-3 text-zinc-400 text-[11px] border-l border-zinc-700/60">
                                  {item.methodFrequency}
                                </td>

                                {/* Reaction Plan */}
                                <td className="p-3 text-rose-300/90 text-[11px] border-l border-zinc-700/60">
                                  {item.reactionPlan}
                                </td>

                                {/* Custom Column Values */}
                                {customColumns.map(col => (
                                  <td key={col.id} className="p-3 bg-teal-950/10 border-l border-teal-500/20">
                                    <input
                                      type="text"
                                      value={item.customFields?.[col.id] || ''}
                                      onChange={(e) => handleUpdateItemCustomField(item.id, col.id, e.target.value)}
                                      placeholder={`مقدار ${col.name}...`}
                                      className="bg-[#18181f] border border-teal-800/60 rounded-xl px-2 py-1 text-xs text-teal-100 outline-none focus:border-teal-400 w-full"
                                    />
                                  </td>
                                ))}

                                {/* Source Module Badge (Space-Optimized) */}
                                <td className="p-3 text-center border-l border-zinc-700/60">
                                  {(() => {
                                    const meta = getRefDocMeta(item.sourceModule);
                                    return (
                                      <span
                                        title={`منبع داده: ${meta.fullTitle} (${meta.clauseNo})`}
                                        className="inline-block px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono font-black text-[10px] whitespace-nowrap cursor-help shadow-sm"
                                      >
                                        {meta.badgeText || formatSourceToNumberBadge(item.sourceModule)}
                                      </span>
                                    );
                                  })()}
                                </td>

                                {/* Delete / Edit Action */}
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => {
                                        setItemToEdit(item);
                                        setIsEditModalOpen(true);
                                      }}
                                      className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all cursor-pointer"
                                      title="ویرایش آیتم"
                                    >
                                      <Edit3 size={14} />
                                    </button>

                                    <button
                                      onClick={() => handleMarkForDelete(item.id)}
                                      className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                                      title="حذف آیتم"
                                    >
                                      <Trash2 size={14} />
                                    </button>
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
              );
            })}

          {Object.keys(workstationBlocks).length === 0 && (
            <div className="bg-[#0D0D10]/90 border border-dashed border-zinc-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Layers size={32} />
              </div>
              <div>
                <h3 className="text-base font-black text-white">هیچ ایستگاه کاری تعریف نشده است</h3>
                <p className="text-xs text-zinc-400 mt-1 max-w-md">
                  جهت شروع فرایند صحت‌سنجی راه‌اندازی خط تولید، یک ایستگاه کاری جدید تعریف کنید یا از قابلیت «استخراج هوشمند AI» برای بارگذاری خودکار اسناد QMS استفاده کنید.
                </p>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={() => {
                    setNewStationForm({
                      stationId: '',
                      stationName: '',
                      operationCode: '',
                      operationTitle: '',
                      machineCode: '',
                      machineTitle: '',
                      operatorName: '',
                      shiftName: 'شیفت روز (A)'
                    });
                    setIsAddStationModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all cursor-pointer"
                >
                  <Plus size={16} />
                  <span>تعریف اولین ایستگاه کاری</span>
                </button>

                <button
                  onClick={handleGenerateAiSmartJobSetup}
                  disabled={isAiGenerating}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sparkles size={16} className={isAiGenerating ? 'animate-spin' : ''} />
                  <span>استخراج هوشمند از دیتابیس QMS</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}



      {/* =================================================================== */}
      {/* TAB 2: AI IN-PROCESS CONTROL CHECKLIST MODULE                      */}
      {/* =================================================================== */}
      {activeTab === 'in_process_control' && (
        <InProcessControlModule lang={lang} onPinToDashboard={onPinToDashboard} />
      )}

      {/* =================================================================== */}
      {/* TAB 3: FIRST-OFF PRODUCTION PERMITS LOG                             */}
      {/* =================================================================== */}
      {activeTab === 'permits' && (
        <div className="bg-[#0D0D10]/95 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
          <div className="border-b border-zinc-800 pb-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Award size={18} className="text-emerald-400" />
              <span>پروانه‌ها و مجوزهای صادره اجازه شروع کار (First-Off Production Release Permits)</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              سوابق مجوزهای صادر شده توسط کارشناس کیفی برای شروع تولید انبوه در هر ایستگاه کاری موضوع بند 8.5.1.3
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(Object.entries(workstationBlocks) as [string, WorkstationBlockData][]).map(([stId, block]) => (
              <div
                key={stId}
                className={`p-5 rounded-3xl border flex flex-col justify-between gap-4 relative overflow-hidden ${
                  block.permitStatus === 'approved'
                    ? 'bg-gradient-to-br from-[#121915] to-[#0D0D10] border-emerald-500/40'
                    : 'bg-[#121216] border-zinc-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-emerald-400">{stId}: {block.stationName}</span>
                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                      block.permitStatus === 'approved'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      {block.permitStatus === 'approved' ? 'پروانه صادر شد' : 'در انتظار تایید'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs text-zinc-300">
                    <div>شماره پروانه: <strong className="font-mono text-emerald-300">{block.permitNo}</strong></div>
                    <div>صادرکننده: <strong className="text-zinc-100">{block.issuedBy || 'ثبت نشده'}</strong></div>
                    <div>زمان صدور: <strong className="text-zinc-100">{block.issuedAt || 'ثبت نشده'}</strong></div>
                    <div className="text-[11px] text-zinc-400 mt-2 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-800">
                      ملاحظات کیفی: {block.inspectorNotes || 'بدون ملاحظات'}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold">
                    <ShieldCheck size={14} />
                    <span>تاییدیه ISO/IATF 16949</span>
                  </div>

                  <QrCode size={32} className="text-zinc-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TAB 4: REVISION HISTORY & AUDIT TRAIL                               */}
      {/* =================================================================== */}
      {activeTab === 'history' && (
        <div className="bg-[#0D0D10]/95 border border-zinc-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
          <div className="border-b border-zinc-800 pb-4">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <History size={18} className="text-emerald-400" />
              <span>تاریخچه نسخه‌های سوابق راه‌اندازی (Setup Revisions & Audit Log)</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              ردیابی کامل تغییرات، ویرایش‌ها و تاییدهای انجام شده روی چک‌لیست و پروانه‌های راه‌اندازی
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {setupHistory.length === 0 ? (
              <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 text-center text-xs text-zinc-400">
                هیچ سابقه ویرایش یا تغییرات قبلی ثبت نشده است. با ثبت تغییرات یا ذخیره‌سازی، رکوردهای جدید به صورت خودکار در این بخش ارشیو می‌گردند.
              </div>
            ) : (
              setupHistory.map((rev, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-black text-emerald-400">نسخه {rev.version} {idx === 0 ? '(نسخه جاری)' : ''}</span>
                    <p className="text-zinc-300 mt-1">{rev.summary}</p>
                  </div>
                  <div className="text-left text-zinc-400">
                    <div>تاریخ: {rev.timestamp}</div>
                    <div>توسط: {rev.author}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* ADD NEW ITEM MODAL                                                  */}
      {/* =================================================================== */}
      {isAddModalOpen && editingItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-6 max-w-lg w-full text-right shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-black text-white">افزودن مشخصه کنترلی جدید به ایستگاه</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="text-zinc-400 font-bold block mb-1">انتخاب ایستگاه کاری:</label>
                <select
                  value={selectedStationForNewItem}
                  onChange={(e) => setSelectedStationForNewItem(e.target.value)}
                  className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                >
                  {(Object.entries(workstationBlocks) as [string, WorkstationBlockData][]).map(([id, block]) => (
                    <option key={id} value={id}>{id}: {block.stationName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-zinc-400 font-bold block mb-1">عنوان مشخصه / پارامتر کنترلی:</label>
                <input
                  type="text"
                  placeholder="مثلا: کنترل زبری سطح، کنترل تورک پیچ..."
                  value={editingItem.parameterName}
                  onChange={(e) => setEditingItem({ ...editingItem, parameterName: e.target.value })}
                  className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">کلاس کنترل:</label>
                  <select
                    value={editingItem.controlType}
                    onChange={(e) => setEditingItem({ ...editingItem, controlType: e.target.value as any })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  >
                    <option value="CC">CC (مشخصه مهم محصول KPC)</option>
                    <option value="SC">SC (مشخصه مهم فرآیند KCC)</option>
                    <option value="Safety">Safety (ایمنی)</option>
                    <option value="Standard">استاندارد عمومی</option>
                  </select>
                </div>

                <div>
                  <label className="text-zinc-400 font-bold block mb-1">دسته‌بندی:</label>
                  <select
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value as any })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  >
                    <option value="parameters">پارامتر دستگاه</option>
                    <option value="tooling">ابزار و قالب</option>
                    <option value="safety">ایمنی</option>
                    <option value="quality_first_off">قطعه اول (First-Off)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-zinc-400 font-bold block mb-1">حدود و مقدار هدف استاندارد:</label>
                <input
                  type="text"
                  placeholder="مثلا: Tol: ±0.02mm یا 320 Bar"
                  value={editingItem.targetValue}
                  onChange={(e) => setEditingItem({ ...editingItem, targetValue: e.target.value })}
                  className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                />
              </div>

              <div>
                <label className="text-zinc-400 font-bold block mb-1">ابزار / گیج اندازه‌گیری:</label>
                <input
                  type="text"
                  placeholder="مثلا: کالیپر دیجیتال 150mm"
                  value={editingItem.gaugeTool}
                  onChange={(e) => setEditingItem({ ...editingItem, gaugeTool: e.target.value })}
                  className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-xl text-xs bg-zinc-800 text-zinc-300 cursor-pointer">
                انصراف
              </button>
              <button onClick={handleAddItemToStation} className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">
                افزودن به چک‌لیست
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* EDIT ITEM MODAL                                                     */}
      {/* =================================================================== */}
      {isEditModalOpen && itemToEdit && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-6 max-w-lg w-full text-right shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Edit3 size={16} className="text-emerald-400" />
                <span>ویرایش مشخصه کنترلی راه‌اندازی (گام {itemToEdit.stepNo})</span>
              </h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="text-zinc-400 font-bold block mb-1">عنوان مشخصه / پارامتر کنترلی:</label>
                <input
                  type="text"
                  value={itemToEdit.parameterName}
                  onChange={(e) => setItemToEdit({ ...itemToEdit, parameterName: e.target.value })}
                  className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">کلاس کنترل:</label>
                  <select
                    value={itemToEdit.controlType}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, controlType: e.target.value as any })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none font-bold"
                  >
                    <option value="CC">CC (مشخصه مهم محصول KPC)</option>
                    <option value="SC">SC (مشخصه مهم فرآیند KCC)</option>
                    <option value="Safety">Safety (ایمنی)</option>
                    <option value="Standard">استاندارد عمومی</option>
                  </select>
                </div>

                <div>
                  <label className="text-zinc-400 font-bold block mb-1">دسته‌بندی:</label>
                  <select
                    value={itemToEdit.category}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, category: e.target.value as any })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  >
                    <option value="parameters">پارامتر دستگاه</option>
                    <option value="tooling">ابزار و قالب</option>
                    <option value="safety">ایمنی</option>
                    <option value="quality_first_off">قطعه اول (First-Off)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-zinc-400 font-bold block mb-1">حدود و مقدار هدف استاندارد:</label>
                <input
                  type="text"
                  value={itemToEdit.targetValue}
                  onChange={(e) => setItemToEdit({ ...itemToEdit, targetValue: e.target.value })}
                  className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none font-mono text-emerald-300"
                />
              </div>

              <div>
                <label className="text-zinc-400 font-bold block mb-1">مقدار اندازه‌گیری شده قطعه اول:</label>
                <input
                  type="text"
                  value={itemToEdit.measuredValue || ''}
                  onChange={(e) => setItemToEdit({ ...itemToEdit, measuredValue: e.target.value })}
                  className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">ابزار / گیج اندازه‌گیری:</label>
                  <input
                    type="text"
                    value={itemToEdit.gaugeTool}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, gaugeTool: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  />
                </div>

                <div>
                  <label className="text-zinc-400 font-bold block mb-1">منبع سند در دیتابیس:</label>
                  <input
                    type="text"
                    value={itemToEdit.sourceModule}
                    onChange={(e) => setItemToEdit({ ...itemToEdit, sourceModule: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 font-bold block mb-1">واکنش به عدم انطباق (Reaction Plan):</label>
                <input
                  type="text"
                  value={itemToEdit.reactionPlan}
                  onChange={(e) => setItemToEdit({ ...itemToEdit, reactionPlan: e.target.value })}
                  className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 rounded-xl text-xs bg-zinc-800 text-zinc-300 cursor-pointer">
                انصراف
              </button>
              <button onClick={handleSaveEditedItem} className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">
                ذخیره تغییرات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* REJECT PERMIT REASON MODAL                                          */}
      {/* =================================================================== */}
      {isRejectPermitModalOpen && rejectingStationId && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-rose-500/40 rounded-3xl p-6 max-w-md w-full text-right shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-black text-rose-300 flex items-center gap-2">
                <AlertTriangle size={18} />
                <span>عدم تایید پروانه اجازه شروع کار - ایستگاه {rejectingStationId}</span>
              </h3>
              <button onClick={() => setIsRejectPermitModalOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <p className="text-zinc-300">
                لطفا علت عدم تایید مجوز راه‌اندازی را جهت ثبت در سوابق عدم انطباق و صدور اقدام اصلاحی (CAPA) وارد کنید:
              </p>
              <textarea
                rows={3}
                placeholder="مثلا: ابعاد قطر داخلی رزوه خارج از حد تولرانس استاندارد است و ابزار نیاز به تعویض دارد..."
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                className="w-full bg-[#18181f] border border-zinc-800 rounded-xl p-3 text-zinc-100 outline-none focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button onClick={() => setIsRejectPermitModalOpen(false)} className="px-4 py-2 rounded-xl text-xs bg-zinc-800 text-zinc-300 cursor-pointer">
                انصراف
              </button>
              <button
                onClick={() => handleRejectFirstOffPermit(rejectingStationId, rejectReasonInput)}
                className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white cursor-pointer"
              >
                ثبت عدم تایید و صدور CAPA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* COMPREHENSIVE JOB SETUP & PERMITS PRINT MODAL (FULLSCREEN PREVIEW)  */}
      {/* =================================================================== */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-[100] bg-[#0A0A0D] flex flex-col w-full h-full overflow-hidden" dir="rtl">
          {/* Inject Dynamic CSS Print Page Size Rule */}
          <style>
            {`
              @media print {
                @page {
                  size: ${printOrientation};
                  margin: 8mm;
                }
                body {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  background-color: #ffffff !important;
                }
              }
            `}
          </style>

          {/* Top Sticky Bar - Fullscreen Navigation & Range Controls */}
          <div className="bg-[#14141A] border-b border-[#25252D] px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-white shrink-0 shadow-xl print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30">
                <Printer size={22} />
              </div>
              <div>
                <h1 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                  <span>
                    {printStationSelection === 'all'
                      ? 'پیش‌نمایش و چاپ تجمعی (کلیه ایستگاه‌ها)'
                      : `پیش‌نمایش و چاپ تکی (${printStationSelection}: ${workstationBlocks[printStationSelection]?.stationName || ''})`}
                  </span>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-500/30 font-bold">
                    تمام صفحه
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 mt-0.5">IATF 16949 § 8.5.1.3 - First-Off Production Release Dossier</p>
              </div>
            </div>

            {/* Print Mode & Orientation & Customizer Controls */}
            <div className="flex flex-wrap items-center gap-2 bg-[#1A1A22] p-1.5 rounded-2xl border border-[#2A2A35]">
              {/* Workstation Selection */}
              <button
                onClick={() => setPrintStationSelection('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  printStationSelection === 'all'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-[#252530]'
                }`}
              >
                🖨️ همه ایستگاه‌ها
              </button>
              <div className="h-4 w-px bg-[#2A2A35] mx-0.5" />
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-slate-300 font-extrabold">تکی:</span>
                <select
                  value={printStationSelection === 'all' ? '' : printStationSelection}
                  onChange={(e) => {
                    if (e.target.value) {
                      setPrintStationSelection(e.target.value);
                    }
                  }}
                  className={`bg-[#0F0F12] text-white border rounded-xl px-2.5 py-1.5 text-xs font-black outline-none transition-all cursor-pointer ${
                    printStationSelection !== 'all' ? 'border-blue-500 ring-1 ring-blue-500/50' : 'border-[#2A2A35]'
                  }`}
                >
                  <option value="" disabled>-- انتخاب --</option>
                  {(Object.entries(workstationBlocks) as [string, WorkstationBlockData][]).map(([sId, b]) => (
                    <option key={sId} value={sId}>
                      {sId} - {b.stationName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="h-4 w-px bg-[#2A2A35] mx-1" />

              {/* Orientation Selector */}
              <div className="flex items-center gap-1 bg-[#0F0F12] p-1 rounded-xl border border-[#2A2A35]">
                <button
                  onClick={() => setPrintOrientation('portrait')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    printOrientation === 'portrait' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                  title="جهت چاپ عمودی (Portrait)"
                >
                  <FileText size={13} />
                  <span>عمودی</span>
                </button>
                <button
                  onClick={() => setPrintOrientation('landscape')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    printOrientation === 'landscape' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
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
                className="px-6 py-2.5 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer flex items-center gap-2"
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
                        تنظیمات دیتابیس محور هدر، شناسنامه سند، کد ISO و امضاکنندگان
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        قابلیت بارگذاری خودکار و انتخاب مستقیم از منوهای کشویی دیتابیس QMS
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Auto Detect Master Button */}
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
                              ? 'bg-blue-600 text-white border-blue-400 shadow-md'
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
                              ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
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
                              ? 'bg-indigo-600 text-white border-indigo-400 shadow-md'
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
                              ? 'bg-amber-600 text-white border-amber-400 shadow-md'
                              : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          <span>✍️ کاربران و امضاکنندگان ({dbData.personnel.length})</span>
                          <ChevronDown size={14} className={`transition-transform ${activeDbPickerTab === 'signers' ? 'rotate-180' : ''}`} />
                        </button>
                      </div>

                      {/* Expanded Accordion Drawer for Products */}
                      {activeDbPickerTab === 'products' && (
                        <div className="bg-slate-900/95 border border-blue-500/40 p-4 rounded-2xl animate-in fade-in zoom-in-95 mt-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-blue-300 flex items-center gap-1.5">
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
                                    try {
                                      localStorage.setItem('qms_job_setup_product', prod.name);
                                      localStorage.setItem('qms_job_setup_partno', prod.partNo);
                                    } catch(e){}
                                    showToast(`محصول "${prod.name}" با پارت‌نامبر "${prod.partNo || '—'}" انتخاب گردید.`, 'success');
                                  }}
                                  className="text-right p-2.5 rounded-xl bg-slate-950 hover:bg-blue-950/60 border border-slate-800 hover:border-blue-500 transition-all cursor-pointer flex flex-col gap-1 group"
                                >
                                  <span className="font-extrabold text-white text-xs group-hover:text-blue-300">{prod.name}</span>
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
                              <span>انتخاب کد سند رسمی و ویرایش از جدول کنترل اسناد ISO 9001:</span>
                            </span>
                            <span className="text-[10px] text-slate-400">تنظیم مستقیم کد سند، شماره بازنگری و عنوان شناسنامه</span>
                          </div>
                          {dbData.docControls.length === 0 ? (
                            <p className="text-xs text-slate-400 italic p-2">سندی در جدول کنترل اسناد یافت نشد. می‌توانید کد سند را دستی وارد کنید.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                              {dbData.docControls.map((doc, dIdx) => (
                                <button
                                  key={dIdx}
                                  onClick={() => {
                                    setPrintDocCode(doc.code);
                                    setPrintRevision(doc.revision);
                                    if (doc.title) setPrintReportTitle(`شناسنامه صحه‌گذاری - ${doc.title}`);
                                    try { localStorage.setItem('qms_print_doc_code', doc.code); } catch(e){}
                                    showToast(`کد سند "${doc.code}" با ویرایش "${doc.revision}" بارگذاری شد.`, 'success');
                                  }}
                                  className="text-right p-2.5 rounded-xl bg-slate-950 hover:bg-emerald-950/60 border border-slate-800 hover:border-emerald-500 transition-all cursor-pointer flex flex-col gap-1 group"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-mono font-bold text-emerald-300 text-xs">{doc.code}</span>
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">ویرایش {doc.revision}</span>
                                  </div>
                                  <span className="text-[11px] text-slate-300 font-medium truncate">{doc.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expanded Accordion Drawer for Orgs */}
                      {activeDbPickerTab === 'orgs' && (
                        <div className="bg-slate-900/95 border border-indigo-500/40 p-4 rounded-2xl animate-in fade-in zoom-in-95 mt-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-indigo-300 flex items-center gap-1.5">
                              <Building size={14} />
                              <span>انتخاب شرکت / سازمان از دیتابیس QMS:</span>
                            </span>
                          </div>
                          {dbData.orgs.length === 0 ? (
                            <p className="text-xs text-slate-400 italic p-2">سازمانی در سیستم تعریف نشده است. نام شرکت را دستی وارد کنید.</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {dbData.orgs.map((org, oIdx) => (
                                <button
                                  key={oIdx}
                                  onClick={() => {
                                    setPrintOrgName(org.name);
                                    try { localStorage.setItem('qms_print_org_name', org.name); } catch(e){}
                                    showToast(`سازمان "${org.name}" انتخاب گردید.`, 'success');
                                  }}
                                  className="px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-indigo-950/60 border border-slate-800 hover:border-indigo-500 transition-all cursor-pointer text-xs font-bold text-slate-200"
                                >
                                  🏢 {org.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Expanded Accordion Drawer for Signers */}
                      {activeDbPickerTab === 'signers' && (
                        <div className="bg-slate-900/95 border border-amber-500/40 p-4 rounded-2xl animate-in fade-in zoom-in-95 mt-1">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                              <UserCheck size={14} />
                              <span>انتخاب سریع صاحبان امضا از اعضای تیم کیفیت:</span>
                            </span>
                          </div>
                          {dbData.personnel.length === 0 ? (
                            <p className="text-xs text-slate-400 italic p-2">کاربری در سیستم یافت نشد. اسامی را در فرم پایین وارد کنید.</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {dbData.personnel.map((p, pIdx) => (
                                <div key={pIdx} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col gap-2">
                                  <div className="flex items-center justify-between">
                                    <span className="font-extrabold text-white text-xs">{p.name}</span>
                                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">{p.role}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        setPrintSigner1Name(p.name);
                                        try { localStorage.setItem('qms_print_signer1_name', p.name); } catch(e){}
                                        showToast(`امضاکننده اول: ${p.name}`, 'info');
                                      }}
                                      className="flex-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 py-1 rounded-lg text-center"
                                    >
                                      امضا ۱
                                    </button>
                                    <button
                                      onClick={() => {
                                        setPrintSigner2Name(p.name);
                                        try { localStorage.setItem('qms_print_signer2_name', p.name); } catch(e){}
                                        showToast(`امضاکننده دوم: ${p.name}`, 'info');
                                      }}
                                      className="flex-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 py-1 rounded-lg text-center"
                                    >
                                      امضا ۲
                                    </button>
                                    <button
                                      onClick={() => {
                                        setPrintSigner3Name(p.name);
                                        try { localStorage.setItem('qms_print_signer3_name', p.name); } catch(e){}
                                        showToast(`امضاکننده سوم: ${p.name}`, 'info');
                                      }}
                                      className="flex-1 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 py-1 rounded-lg text-center"
                                    >
                                      امضا ۳
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Form Fields Grid with Direct Dropdown Selectors */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 text-xs">
                  {/* Logo Upload Box */}
                  <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex flex-col gap-2">
                    <span className="font-bold text-slate-300 flex items-center gap-1.5">
                      <Image size={14} className="text-amber-400" />
                      <span>لوگوی رسمی سازمان</span>
                    </span>
                    <div className="flex items-center gap-3 mt-1">
                      {printLogoUrl ? (
                        <div className="relative group shrink-0">
                          <img src={printLogoUrl} alt="Logo" className="h-12 w-12 object-contain bg-white rounded-lg p-1 border border-slate-700" />
                          <button
                            onClick={handleRemoveLogo}
                            className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full p-0.5 shadow hover:bg-rose-500"
                            title="حذف لوگو"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-lg border-2 border-dashed border-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                          <Image size={18} />
                        </div>
                      )}
                      <label className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl px-3 py-2 text-[11px] font-bold text-center cursor-pointer transition-all flex items-center justify-center gap-1">
                        <Upload size={12} />
                        <span>{printLogoUrl ? 'تغییر لوگو' : 'بارگذاری لوگو'}</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                      </label>
                    </div>
                  </div>

                  {/* Product & Part Info Box */}
                  <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex flex-col gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300">نام محصول / پروژه:</label>
                        {getQmsDbPrintData().products.length > 0 && (
                          <select
                            onChange={(e) => {
                              const found = getQmsDbPrintData().products.find(p => p.name === e.target.value);
                              if (found) {
                                setSelectedProduct(found.name);
                                if (found.partNo) setSelectedPartNo(found.partNo);
                                try {
                                  localStorage.setItem('qms_job_setup_product', found.name);
                                  localStorage.setItem('qms_job_setup_partno', found.partNo);
                                } catch(e){}
                              }
                            }}
                            className="text-[10px] bg-slate-950 text-amber-300 border border-slate-700 rounded px-1 py-0.5 max-w-[110px]"
                            value=""
                          >
                            <option value="" disabled>▼ انتخاب DB</option>
                            {getQmsDbPrintData().products.map((p, idx) => (
                              <option key={idx} value={p.name}>{p.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="نام محصول"
                        value={selectedProduct}
                        onChange={(e) => {
                          setSelectedProduct(e.target.value);
                          try { localStorage.setItem('qms_job_setup_product', e.target.value); } catch(err){}
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 mb-1 block">شماره فنی (Part No):</label>
                      <input
                        type="text"
                        placeholder="شماره فنی قطعه"
                        value={selectedPartNo}
                        onChange={(e) => {
                          setSelectedPartNo(e.target.value);
                          try { localStorage.setItem('qms_job_setup_partno', e.target.value); } catch(err){}
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Organization & Title Box */}
                  <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex flex-col gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300">نام شرکت / سازمان:</label>
                        {getQmsDbPrintData().orgs.length > 0 && (
                          <select
                            onChange={(e) => {
                              setPrintOrgName(e.target.value);
                              try { localStorage.setItem('qms_print_org_name', e.target.value); } catch(e){}
                            }}
                            className="text-[10px] bg-slate-950 text-indigo-300 border border-slate-700 rounded px-1 py-0.5 max-w-[110px]"
                            value=""
                          >
                            <option value="" disabled>▼ انتخاب DB</option>
                            {getQmsDbPrintData().orgs.map((o, idx) => (
                              <option key={idx} value={o.name}>{o.name}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="نام سازمان"
                        value={printOrgName}
                        onChange={(e) => {
                          setPrintOrgName(e.target.value);
                          try { localStorage.setItem('qms_print_org_name', e.target.value); } catch(err){}
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 mb-1 block">عنوان شناسنامه / گزارش:</label>
                      <input
                        type="text"
                        value={printReportTitle}
                        onChange={(e) => setPrintReportTitle(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Doc Code & Revision Box */}
                  <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex flex-col gap-2">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-300">کد رسمی سند ISO:</label>
                        {getQmsDbPrintData().docControls.length > 0 && (
                          <select
                            onChange={(e) => {
                              const found = getQmsDbPrintData().docControls.find(d => d.code === e.target.value);
                              if (found) {
                                setPrintDocCode(found.code);
                                setPrintRevision(found.revision);
                                if (found.title) setPrintReportTitle(`شناسنامه صحه‌گذاری - ${found.title}`);
                                try { localStorage.setItem('qms_print_doc_code', found.code); } catch(e){}
                              }
                            }}
                            className="text-[10px] bg-slate-950 text-emerald-300 border border-slate-700 rounded px-1 py-0.5 max-w-[110px]"
                            value=""
                          >
                            <option value="" disabled>▼ انتخاب ISO</option>
                            {getQmsDbPrintData().docControls.map((d, idx) => (
                              <option key={idx} value={d.code}>{d.code} ({d.revision})</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <input
                        type="text"
                        value={printDocCode}
                        onChange={(e) => {
                          setPrintDocCode(e.target.value);
                          try { localStorage.setItem('qms_print_doc_code', e.target.value); } catch(e){}
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-300 mb-1 block">شماره بازنگری / ویرایش:</label>
                      <input
                        type="text"
                        value={printRevision}
                        onChange={(e) => setPrintRevision(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  {/* Disclaimer Box */}
                  <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-slate-300 block">متن دیسکلایمر / پاورقی سند:</label>
                    <textarea
                      rows={3}
                      value={printFooterDisclaimer}
                      onChange={(e) => setPrintFooterDisclaimer(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-[11px] text-white outline-none focus:border-amber-400 resize-none"
                    />
                  </div>
                </div>

                {/* Signers Config */}
                <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="flex flex-col gap-1.5">
                    <span className="font-extrabold text-amber-300 text-[11px]">امضاکننده اول (ممیز/بازرس):</span>
                    <input
                      type="text"
                      value={printSigner1}
                      onChange={(e) => setPrintSigner1(e.target.value)}
                      placeholder="عنوان مسئولیت"
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={printSigner1Name}
                        onChange={(e) => {
                          setPrintSigner1Name(e.target.value);
                          try { localStorage.setItem('qms_print_signer1_name', e.target.value); } catch(err){}
                        }}
                        placeholder="نام و نام خانوادگی مسئول"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                      />
                      {getQmsDbPrintData().personnel.length > 0 && (
                        <select
                          onChange={(e) => {
                            setPrintSigner1Name(e.target.value);
                            try { localStorage.setItem('qms_print_signer1_name', e.target.value); } catch(err){}
                          }}
                          className="text-[10px] bg-slate-950 text-amber-300 border border-slate-700 rounded px-1 py-1 max-w-[80px]"
                          value=""
                        >
                          <option value="" disabled>▼ کاربر</option>
                          {getQmsDbPrintData().personnel.map((p, idx) => (
                            <option key={idx} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="font-extrabold text-amber-300 text-[11px]">امضاکننده دوم (سرپرست تولید):</span>
                    <input
                      type="text"
                      value={printSigner2}
                      onChange={(e) => setPrintSigner2(e.target.value)}
                      placeholder="عنوان مسئولیت"
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={printSigner2Name}
                        onChange={(e) => {
                          setPrintSigner2Name(e.target.value);
                          try { localStorage.setItem('qms_print_signer2_name', e.target.value); } catch(err){}
                        }}
                        placeholder="نام و نام خانوادگی مسئول"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                      />
                      {getQmsDbPrintData().personnel.length > 0 && (
                        <select
                          onChange={(e) => {
                            setPrintSigner2Name(e.target.value);
                            try { localStorage.setItem('qms_print_signer2_name', e.target.value); } catch(err){}
                          }}
                          className="text-[10px] bg-slate-950 text-amber-300 border border-slate-700 rounded px-1 py-1 max-w-[80px]"
                          value=""
                        >
                          <option value="" disabled>▼ کاربر</option>
                          {getQmsDbPrintData().personnel.map((p, idx) => (
                            <option key={idx} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <span className="font-extrabold text-amber-300 text-[11px]">امضاکننده سوم (مدیریت کیفیت):</span>
                    <input
                      type="text"
                      value={printSigner3}
                      onChange={(e) => setPrintSigner3(e.target.value)}
                      placeholder="عنوان مسئولیت"
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        value={printSigner3Name}
                        onChange={(e) => {
                          setPrintSigner3Name(e.target.value);
                          try { localStorage.setItem('qms_print_signer3_name', e.target.value); } catch(err){}
                        }}
                        placeholder="نام و نام خانوادگی مسئول"
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                      />
                      {getQmsDbPrintData().personnel.length > 0 && (
                        <select
                          onChange={(e) => {
                            setPrintSigner3Name(e.target.value);
                            try { localStorage.setItem('qms_print_signer3_name', e.target.value); } catch(err){}
                          }}
                          className="text-[10px] bg-slate-950 text-amber-300 border border-slate-700 rounded px-1 py-1 max-w-[80px]"
                          value=""
                        >
                          <option value="" disabled>▼ کاربر</option>
                          {getQmsDbPrintData().personnel.map((p, idx) => (
                            <option key={idx} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* Document Fullscreen Container */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#0A0A0D] print:bg-white print:p-0 print:overflow-visible">
            <div className={`w-full mx-auto bg-white text-black p-6 sm:p-10 rounded-2xl shadow-2xl border border-slate-300 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none ${
              printOrientation === 'landscape' ? 'max-w-7xl' : 'max-w-4xl'
            }`}>
              
              {/* PRINTABLE REPORT HEADER */}
              <div className="border border-gray-800 rounded-xl p-4 mb-6 bg-gray-50">
                <div className="flex items-center justify-between border-b border-gray-300 pb-3 mb-3 gap-4">
                  {/* Right Side: Logo & Org Name */}
                  <div className="flex items-center gap-3">
                    {printLogoUrl && (
                      <img src={printLogoUrl} alt="Company Logo" className="h-14 w-auto object-contain max-w-[120px]" />
                    )}
                    <div>
                      <div className="text-xs font-black text-gray-500">{printOrgName || 'سازمان / واحد صنعتی'}</div>
                      <h2 className="text-sm sm:text-base font-black text-gray-900 mt-0.5">
                        {printStationSelection === 'all'
                          ? printReportTitle
                          : `پروانه و چک‌لیست تکی صحه‌گذاری راه‌اندازی ایستگاه ${printStationSelection}`}
                      </h2>
                    </div>
                  </div>

                  {/* Left Side: Doc Info */}
                  <div className="text-left font-mono text-xs shrink-0">
                    <div>کد سند: <strong>{printDocCode || '—'}</strong></div>
                    <div>ویرایش: <strong>{printRevision || '1.0'}</strong></div>
                    <div>تاریخ صدور: <strong>{new Date().toLocaleDateString('fa-IR')}</strong></div>
                  </div>
                </div>

                {printStationSelection === 'all' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>نام محصول / پروژه: <strong className="text-gray-900">{selectedProduct || '—'}</strong></div>
                    <div>شماره فنی قطعه: <strong className="text-gray-900 font-mono">{selectedPartNo || '—'}</strong></div>
                    <div>کارشناس ممیز کیفیت: <strong className="text-gray-900">{inspectorName || '—'}</strong></div>
                    <div>تعداد ایستگاه‌ها: <strong className="text-gray-900">{Object.keys(workstationBlocks).length} ایستگاه</strong></div>
                    <div>کل چک‌لیست‌ها: <strong className="text-gray-900">{checklistItems.length} مشخصه</strong></div>
                    <div>درصد آمادگی کل: <strong className="text-emerald-700 font-bold">{stationStats.overallScore}%</strong></div>
                    <div>تعداد پروانه‌های صادره: <strong className="text-emerald-700 font-bold">{(Object.values(workstationBlocks) as WorkstationBlockData[]).filter(b => b.permitStatus === 'approved').length} از {Object.keys(workstationBlocks).length}</strong></div>
                    <div>وضعیت نهایی: <strong className={stationStats.overallScore === 100 ? 'text-emerald-700' : 'text-amber-700'}>{stationStats.overallScore === 100 ? '✓ تایید کامل' : 'در حال ممیزی'}</strong></div>
                  </div>
                ) : workstationBlocks[printStationSelection] ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>نام محصول: <strong className="text-gray-900">{selectedProduct || '—'}</strong></div>
                    <div>شماره فنی: <strong className="text-gray-900 font-mono">{selectedPartNo || '—'}</strong></div>
                    <div>ایستگاه: <strong className="text-gray-900">{printStationSelection} ({workstationBlocks[printStationSelection].stationName})</strong></div>
                    <div>کد عملیات: <strong className="text-gray-900">{workstationBlocks[printStationSelection].operationCode} ({workstationBlocks[printStationSelection].operationTitle})</strong></div>
                    <div>دستگاه: <strong className="text-gray-900">{workstationBlocks[printStationSelection].machineTitle}</strong></div>
                    <div>اپراتور: <strong className="text-gray-900">{workstationBlocks[printStationSelection].operatorName}</strong></div>
                    <div>شیفت کاری: <strong className="text-gray-900">{workstationBlocks[printStationSelection].shiftName}</strong></div>
                    <div>وضعیت پروانه: <strong className={workstationBlocks[printStationSelection].permitStatus === 'approved' ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>{workstationBlocks[printStationSelection].permitStatus === 'approved' ? `✓ صادر شده (${workstationBlocks[printStationSelection].permitNo})` : 'در انتظار تایید'}</strong></div>
                  </div>
                ) : null}
              </div>

              {/* PRINTABLE CONTENT FOR SELECTED WORKSTATION BLOCKS */}
              <div className="flex flex-col gap-6">
                {(Object.entries(workstationBlocks) as [string, WorkstationBlockData][])
                  .filter(([stId]) => printStationSelection === 'all' || printStationSelection === stId)
                  .map(([stId, block]) => {
                    const stItems = itemsByStation[stId] || [];
                    return (
                      <div key={stId} className="border border-gray-300 rounded-xl p-4 bg-white page-break-inside-avoid">
                        <div className="flex items-center justify-between border-b border-gray-300 pb-2 mb-3">
                          <div>
                            <h3 className="text-xs font-black text-gray-900">{stId}: {block.stationName}</h3>
                            <p className="text-[11px] text-gray-600 mt-0.5">
                              عملیات: {block.operationCode} ({block.operationTitle}) | دستگاه: {block.machineTitle} | اپراتور: {block.operatorName} | شیفت: {block.shiftName}
                            </p>
                          </div>
                          <div className="text-left text-xs font-bold">
                            <span className={block.permitStatus === 'approved' ? 'text-emerald-700' : 'text-amber-700'}>
                              {block.permitStatus === 'approved' ? `پروانه: ${block.permitNo}` : 'در انتظار تایید پروانه'}
                            </span>
                          </div>
                        </div>

                        <table className="w-full text-xs text-right border-collapse border border-gray-300 mb-3">
                          <thead>
                            <tr className="bg-gray-100 border-b border-gray-300 font-bold text-[11px]">
                              <th className="p-1.5 border border-gray-300 text-center w-8">گام</th>
                              <th className="p-1.5 border border-gray-300">مشخصه کنترلی</th>
                              <th className="p-1.5 border border-gray-300 text-center w-12">کلاس</th>
                              <th className="p-1.5 border border-gray-300">حد استاندارد</th>
                              <th className="p-1.5 border border-gray-300">اندازه قطعه اول</th>
                              <th className="p-1.5 border border-gray-300">گیج / ابزار</th>
                              <th className="p-1.5 border border-gray-300 text-center w-16">وضعیت</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stItems.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="p-2 border border-gray-300 text-center text-gray-500 italic">
                                  هیچ مشخصه‌ای برای این ایستگاه ثبت نشده است.
                                </td>
                              </tr>
                            ) : (
                              stItems.map((item, idx) => (
                                <tr key={item.id} className="border-b border-gray-200 text-[11px]">
                                  <td className="p-1.5 border border-gray-300 text-center font-mono">{idx + 1}</td>
                                  <td className="p-1.5 border border-gray-300 font-bold text-gray-900">{item.parameterName}</td>
                                  <td className="p-1.5 border border-gray-300 text-center font-mono font-bold">{item.controlType}</td>
                                  <td className="p-1.5 border border-gray-300 font-mono dir-ltr text-right">{item.targetValue}</td>
                                  <td className="p-1.5 border border-gray-300">{item.measuredValue || '---'}</td>
                                  <td className="p-1.5 border border-gray-300">{item.gaugeTool}</td>
                                  <td className="p-1.5 border border-gray-300 text-center font-bold">
                                    {item.verified ? <span className="text-emerald-700">✓ تایید</span> : <span className="text-amber-700">---</span>}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>

                        {block.inspectorNotes && (
                          <div className="text-[11px] text-gray-700 bg-gray-50 p-2 rounded border border-gray-200">
                            ملاحظات ممیز: {block.inspectorNotes}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Printable Signatures Footer */}
              <div className="grid grid-cols-3 gap-4 mt-8 pt-4 border-t border-gray-400 text-xs text-center font-bold text-gray-800">
                <div className="flex flex-col gap-6">
                  <span className="text-gray-600">{printSigner1}:</span>
                  <span className="text-gray-900 font-black">{printSigner1Name}</span>
                </div>
                <div className="flex flex-col gap-6">
                  <span className="text-gray-600">{printSigner2}:</span>
                  <span className="text-gray-900 font-black">{printSigner2Name}</span>
                </div>
                <div className="flex flex-col gap-6">
                  <span className="text-gray-600">{printSigner3}:</span>
                  <span className="text-gray-900 font-black">{printSigner3Name}</span>
                </div>
              </div>

              {/* Printable Disclaimer Footer */}
              {printFooterDisclaimer && (
                <div className="mt-6 pt-3 border-t border-gray-200 text-center text-[10px] text-gray-500 font-medium">
                  {printFooterDisclaimer}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: CUSTOM COLUMNS MANAGER MODAL                               */}
      {/* =================================================================== */}
      {isCustomColumnModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121218] border border-zinc-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <PlusCircle size={18} className="text-teal-400" />
                <span>مدیریت و افزودن ستون‌های سفارشی به جدول بلوک‌ها</span>
              </h3>
              <button
                onClick={() => setIsCustomColumnModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              با افزودن ستون‌های سفارشی می‌توانید فیلدهای دلخواه مانند کد فیکسچر، شماره دستورالعمل، نام اپراتور، یا توضیحات اضافی را به جداول همه ایستگاه‌ها اضافه کنید.
            </p>

            {/* Add New Column Form */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newColumnNameInput}
                onChange={(e) => setNewColumnNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddCustomColumn();
                }}
                placeholder="نام ستون جدید (مثلا: کد فیکسچر، زمان‌سنجی...)"
                className="flex-1 bg-[#181820] border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 outline-none focus:border-teal-500 font-medium"
              />
              <button
                onClick={handleAddCustomColumn}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-black font-extrabold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap"
              >
                + افزودن ستون
              </button>
            </div>

            {/* List of Existing Custom Columns */}
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              <span className="text-[11px] font-bold text-zinc-400">ستون‌های فعال در جدول:</span>
              {customColumns.length === 0 ? (
                <p className="text-xs text-zinc-500 italic p-3 text-center border border-dashed border-zinc-800 rounded-xl">
                  هیچ ستون سفارشی تعریف نشده است.
                </p>
              ) : (
                customColumns.map(col => (
                  <div
                    key={col.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-[#181820] border border-zinc-800 text-xs"
                  >
                    <span className="font-bold text-zinc-200">{col.name}</span>
                    <button
                      onClick={() => handleDeleteCustomColumn(col.id)}
                      className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Trash2 size={13} />
                      <span className="text-[10px]">حذف ستون</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-800">
              <button
                onClick={() => setIsCustomColumnModalOpen(false)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
              >
                بستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MANUAL DATABASE TABLE & CONTENT LINKING MODAL                       */}
      {/* =================================================================== */}
      {isManualLinkModalOpen && selectedMissingForLink && createPortal(
        <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#121216] border border-zinc-700 rounded-3xl p-6 max-w-2xl w-full text-right shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-hidden my-auto animate-in fade-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-indigo-400">
                <Link2 size={20} />
                <h3 className="text-sm font-black text-white">
                  اتصال و پیوند دستی منبع دیتابیس (Manual DB Link)
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsManualLinkModalOpen(false);
                  setSelectedMissingForLink(null);
                }}
                className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer transition-all"
              >
                <X size={16} />
              </button>
            </div>

            {/* Target Missing Info Banner */}
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs">
              <div className="flex items-center gap-2 text-amber-300 font-extrabold mb-1">
                <AlertTriangle size={15} />
                <span>منبع اعلام‌نشده یا یافت‌نشده در سیستم:</span>
              </div>
              <p className="text-zinc-300 text-[11px] leading-relaxed">
                {selectedMissingForLink.type === 'MISSING_TABLE' ? (
                  <>
                    جدول مرجع: <strong className="text-rose-300 underline">{selectedMissingForLink.docName}</strong> (ایستگاه کاری: <strong className="text-amber-200">{selectedMissingForLink.stationId}</strong>)
                  </>
                ) : (
                  <>
                    محتوای: <strong className="text-amber-300 underline">{selectedMissingForLink.contentName}</strong> در جدول <strong className="text-rose-300 underline">{selectedMissingForLink.docName}</strong> (ایستگاه: <strong className="text-amber-200">{selectedMissingForLink.stationId}</strong>)
                  </>
                )}
              </p>
              <p className="text-[10px] text-zinc-400 mt-1">
                جدول موجود در دیتابیس پروژه را که حاوی این اطلاعات است پیدا کرده و انتخاب نمایید تا هوش مصنوعی آن را پیوند داده و پارامترها را استخراج کند.
              </p>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search size={15} className="absolute right-3 top-3 text-zinc-500" />
              <input
                type="text"
                placeholder="جستجوی نام جدول، کد سند یا محتوا در دیتابیس QMS..."
                value={linkModalSearch}
                onChange={(e) => setLinkModalSearch(e.target.value)}
                className="w-full bg-[#181820] border border-zinc-700 rounded-2xl pr-9 pl-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            {/* List of Available Database Tables */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 max-h-64 pr-1">
              {availableDbTablesForLinking
                .filter(t => !linkModalSearch || t.title.toLowerCase().includes(linkModalSearch.toLowerCase()) || t.source.toLowerCase().includes(linkModalSearch.toLowerCase()) || t.sampleItems.some(s => s.toLowerCase().includes(linkModalSearch.toLowerCase())))
                .map((tbl, idx) => {
                  const isSelected = selectedTargetTableTitle === tbl.title;
                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedTargetTableTitle(tbl.title)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isSelected
                          ? 'bg-indigo-950/60 border-indigo-500 ring-2 ring-indigo-500/30'
                          : 'bg-[#181820] border-zinc-800 hover:border-zinc-700 hover:bg-[#1f1f2a]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Database size={15} className={isSelected ? 'text-indigo-400' : 'text-zinc-500'} />
                          <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold border border-amber-500/40 shrink-0 font-mono">
                            {tbl.clauseNo}
                          </span>
                          <span className={`text-xs font-black ${isSelected ? 'text-indigo-200' : 'text-white'}`}>
                            {tbl.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 font-mono">
                            #{tbl.indexNo} | {tbl.recordCount} رکورد
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 font-extrabold">
                            {tbl.badgeText || tbl.source}
                          </span>
                        </div>
                      </div>

                      {tbl.sampleItems.length > 0 && (
                        <div className="text-[10px] text-zinc-400 font-mono bg-zinc-900/60 p-1.5 rounded-lg truncate dir-rtl text-right">
                          نمونه محتوا: {tbl.sampleItems.join(' | ')}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>

            {/* Selected Table Preview */}
            {selectedTargetTableTitle && (
              <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-indigo-300">
                    جدول انتخابی برای پیوند: <strong className="text-white underline">{selectedTargetTableTitle}</strong>
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold">✓ آماده اتصال به جاب‌ستاپ</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                onClick={() => {
                  setIsManualLinkModalOpen(false);
                  setSelectedMissingForLink(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
              >
                انصراف
              </button>

              <button
                onClick={() => handleSaveManualLink(selectedTargetTableTitle)}
                disabled={!selectedTargetTableTitle}
                className="px-6 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                <CheckCircle2 size={15} />
                <span>ثبت و پیوند به جاب‌ستاپ</span>
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* =================================================================== */}
      {/* MODAL 3: AI REFERENCE DOCUMENTS & TABLES MANAGER MODAL              */}
      {/* =================================================================== */}
      {isAiRefDocsModalOpen && createPortal(
        <div className="fixed inset-0 z-[999999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-[#121218] border border-indigo-500/50 rounded-3xl p-5 sm:p-6 max-w-5xl w-full text-right shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-hidden my-auto animate-in fade-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 shrink-0">
              <div className="flex items-center gap-3 text-indigo-400 min-w-0">
                <Database size={24} className="shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-base font-black text-white truncate">
                    مدیریت منابع و جداول هوش مصنوعی (AI Data Sources)
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-medium truncate">
                    تنظیم منابع دیتابیس و ستون‌های مرتبط جهت استخراج خودکار الزامات جاب‌ستاپ بر اساس ساختار درختی IATF 16949
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAiRefDocsModalOpen(false)}
                className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer transition-all shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* Banner info */}
            <div className="p-3 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 text-xs text-zinc-300 leading-relaxed flex flex-col gap-1 shrink-0">
              <div className="flex items-center gap-2 text-indigo-300 font-black">
                <Sparkles size={16} className="shrink-0" />
                <span>الگوریتم هوش مصنوعی و ساختار درختی IATF:</span>
              </div>
              <p className="text-[11px] text-zinc-300 leading-normal">
                هوش مصنوعی جاب‌ستاپ، ستون‌های جداول انتخابی شما را پردازش کرده و بر اساس شماره بند مرتبط در ساختار استاندارد IATF 16949، الزامات هر ایستگاه کاری را هوشمندانه استخراج و تطبیق می‌دهد.
              </p>
            </div>

            {/* Content Container with Two Clear Sections */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start overflow-y-auto pr-1 flex-1 min-h-0">
              
              {/* SECTION 1: REMOVE USED AI SOURCES */}
              <div className="p-4 rounded-2xl bg-[#161622] border border-rose-500/30 flex flex-col gap-3 min-w-0">
                <div className="flex items-center justify-between border-b border-rose-500/20 pb-2.5 gap-2 flex-wrap">
                  <span className="text-xs font-black text-rose-300 flex items-center gap-2">
                    <Trash2 size={16} className="text-rose-400 shrink-0" />
                    <span>۱. حذف منابع مورد استفاده هوش مصنوعی (Remove AI Sources)</span>
                  </span>
                  <span className="text-[10px] bg-rose-500/10 text-rose-300 px-2.5 py-0.5 rounded-full border border-rose-500/20 font-bold shrink-0">
                    {aiReferenceRequirements.length} منبع فعال
                  </span>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  جهت حذف یک منبع، می‌توانید آن را از لیست کشویی زیر انتخاب کرده و دکمه حذف را بزنید یا مستقیماً روی آیکون سطل زباله در لیست کلیک کنید:
                </p>

                {/* Dropdown & Button for Deletion */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value={aiSourceToDeleteId}
                    onChange={(e) => setAiSourceToDeleteId(e.target.value)}
                    className="flex-1 bg-[#1c1c28] border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-200 outline-none focus:border-rose-500 font-medium min-w-0"
                  >
                    <option value="">-- انتخاب منبع جهت حذف از هوش مصنوعی --</option>
                    {aiReferenceRequirements.map((req) => (
                      <option key={req.id} value={req.id}>
                        [{req.clauseNo}] {req.name} {req.selectedColumns && req.selectedColumns.length > 0 ? `(${req.selectedColumns.length} ستون انتخابی)` : ''}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleRemoveSelectedAiSource}
                    disabled={!aiSourceToDeleteId}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-md"
                  >
                    <Trash2 size={14} />
                    <span>حذف منبع</span>
                  </button>
                </div>

                {/* Active Resources Cards Grid */}
                <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto pr-1 mt-1">
                  {aiReferenceRequirements.map((req, rIdx) => (
                    <div
                      key={req.id || rIdx}
                      className="p-3 rounded-xl bg-[#1a1a26] border border-zinc-800 hover:border-zinc-700 transition-all flex items-start justify-between gap-3 min-w-0"
                    >
                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black font-mono shrink-0">
                            {req.clauseNo}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-black font-mono shrink-0">
                            [{req.shortCode}]
                          </span>
                          <span className="text-xs font-black text-white break-words">{req.name}</span>
                        </div>
                        {req.selectedColumns && req.selectedColumns.length > 0 ? (
                          <div className="text-[10px] text-indigo-300 font-mono bg-indigo-950/40 px-2 py-1 rounded-lg border border-indigo-500/20 leading-relaxed break-words">
                            ستون‌های پردازش: {req.selectedColumns.join(' | ')}
                          </div>
                        ) : (
                          <div className="text-[10px] text-zinc-400">
                            محتوای مرجع: {req.contentsByStation?.[0]?.contentName || 'کامل'}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteAiRefDocRequirement(req.id)}
                        className="p-1.5 rounded-lg text-rose-400 hover:text-white hover:bg-rose-500/20 transition-all cursor-pointer border border-rose-500/20 shrink-0 self-start"
                        title="حذف فوری"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>


              {/* SECTION 2: ADD NEW SOURCE FROM PROJECT DATABASE */}
              <div className="p-4 rounded-2xl bg-[#161622] border border-indigo-500/30 flex flex-col gap-3.5 min-w-0">
                <div className="flex items-center justify-between border-b border-indigo-500/20 pb-2.5 gap-2 flex-wrap">
                  <span className="text-xs font-black text-indigo-300 flex items-center gap-2">
                    <PlusCircle size={16} className="text-indigo-400 shrink-0" />
                    <span>۲. افزودن منبع جدید از جداول دیتابیس پروژه (Add Database Table to AI)</span>
                  </span>
                  <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/20 font-bold shrink-0">
                    {availableDbTablesForLinking.length} جدول موجود در دیتابیس
                  </span>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  جدول مورد نظر خود را از لیست کل جداول دیتابیس پروژه انتخاب کرده و ستون‌های پردازشی هوش مصنوعی را تعیین کنید:
                </p>

                {/* Database Table Select */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-zinc-300">
                    انتخاب جدول دیتابیس پروژه (همراه شماره بند مرتبط در درخت IATF):
                  </label>
                  <select
                    value={selectedDbTableToAddTitle}
                    onChange={(e) => handleTableSelectForAiAdd(e.target.value)}
                    className="w-full bg-[#1c1c28] border border-indigo-500/40 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-400 font-bold min-w-0"
                  >
                    <option value="">-- کلیک کنید و جدول دیتابیس پروژه را انتخاب کنید --</option>
                    {availableDbTablesForLinking.map((tbl) => (
                      <option key={tbl.title} value={tbl.title}>
                        [{tbl.clauseNo}] {tbl.title} — ({tbl.recordCount} رکورد - {tbl.source})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Selected Table Info & Column Picker */}
                {selectedDbTableToAddTitle && (
                  <div className="p-3.5 rounded-xl bg-[#1a1a28] border border-indigo-500/40 flex flex-col gap-3 animate-in fade-in min-w-0">
                    
                    {/* Table Info Badge */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-indigo-950/50 p-2.5 rounded-lg border border-indigo-500/30">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-black font-mono shrink-0">
                          {availableDbTablesForLinking.find(t => t.title === selectedDbTableToAddTitle)?.clauseNo}
                        </span>
                        <span className="text-xs font-black text-white break-words">
                          {selectedDbTableToAddTitle}
                        </span>
                      </div>
                      <span className="text-[10px] text-indigo-300 font-mono shrink-0">
                        تعداد رکوردها: {availableDbTablesForLinking.find(t => t.title === selectedDbTableToAddTitle)?.recordCount || 0}
                      </span>
                    </div>

                    {/* Column Selection Area */}
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5">
                        <span className="text-[11px] font-black text-amber-300 flex items-center gap-1">
                          <CheckSquare size={14} className="shrink-0" />
                          <span>انتخاب ستون‌های جدول جهت استخراج هوش مصنوعی:</span>
                        </span>
                        <div className="flex items-center gap-2 text-[10px] shrink-0">
                          <button
                            type="button"
                            onClick={handleSelectAllColumns}
                            className="text-indigo-400 hover:text-white underline cursor-pointer"
                          >
                            انتخاب همه ستون‌ها
                          </button>
                          <span className="text-zinc-600">|</span>
                          <button
                            type="button"
                            onClick={handleDeselectAllColumns}
                            className="text-rose-400 hover:text-white underline cursor-pointer"
                          >
                            پاکسازی
                          </button>
                        </div>
                      </div>

                      {/* Column Checkboxes Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded-lg bg-[#14141f] border border-zinc-800 max-h-44 overflow-y-auto">
                        {(() => {
                          const tableObj = availableDbTablesForLinking.find(t => t.title === selectedDbTableToAddTitle);
                          let columns: string[] = [];
                          if (tableObj && Array.isArray(tableObj.rawData) && tableObj.rawData.length > 0) {
                            const keysSet = new Set<string>();
                            tableObj.rawData.forEach((row: any) => {
                              if (row && typeof row === 'object') {
                                Object.keys(row).forEach(k => {
                                  if (!k.startsWith('_') && k !== 'id') keysSet.add(k);
                                });
                              }
                            });
                            columns = Array.from(keysSet);
                          }
                          if (columns.length === 0) {
                            columns = ['عنوان پارامتر / مشخصه', 'مقدار هدف / حد پذیرش', 'روش و فرکانس کنترل', 'ابزار سنجش', 'طرح واکنش'];
                          }

                          return columns.map(col => {
                            const isChecked = selectedColumnsToAdd.includes(col);
                            return (
                              <label
                                key={col}
                                onClick={() => handleToggleColumnSelection(col)}
                                className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all select-none min-w-0 ${
                                  isChecked
                                    ? 'bg-indigo-600/20 border-indigo-500 text-white font-bold'
                                    : 'bg-[#1a1a24] border-zinc-800 text-zinc-400 hover:border-zinc-700'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="rounded border-zinc-700 text-indigo-600 focus:ring-0 cursor-pointer mt-0.5 shrink-0"
                                />
                                <span className="font-mono text-[11px] leading-snug break-words flex-1 min-w-0">{col}</span>
                              </label>
                            );
                          });
                        })()}
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        {selectedColumnsToAdd.length} ستون انتخاب شده است.
                      </span>
                    </div>

                    {/* Add Button */}
                    <div className="flex justify-end pt-2">
                      <button
                        onClick={handleAddSelectedTableToAiSources}
                        className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg cursor-pointer flex items-center justify-center gap-1.5 transition-all w-full sm:w-auto"
                      >
                        <Plus size={16} />
                        <span>افزودن این جدول و ستون‌ها به منابع هوش مصنوعی</span>
                      </button>
                    </div>

                  </div>
                )}

              </div>

            </div>

            {/* Footer Close Button */}
            <div className="flex justify-end pt-3 border-t border-zinc-800 shrink-0">
              <button
                onClick={() => setIsAiRefDocsModalOpen(false)}
                className="px-6 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
              >
                بستن و اعمال تغییرات
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmModal && deleteConfirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#181824] border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 text-right dir-rtl">
            <div className="flex items-center gap-3 text-rose-400 font-black text-base border-b border-rose-500/20 pb-3">
              <AlertTriangle size={22} className="shrink-0 text-rose-500" />
              <span>{deleteConfirmModal.title}</span>
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
              {deleteConfirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setDeleteConfirmModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={deleteConfirmModal.onConfirm}
                className="px-5 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white shadow-lg cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 size={14} />
                <span>بله، حذف شود</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* ADD WORKSTATION BLOCK MODAL                                         */}
      {/* =================================================================== */}
      {isAddStationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-6 max-w-lg w-full text-right shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Plus size={18} className="text-emerald-400" />
                <span>تعریف ایستگاه کاری جدید</span>
              </h3>
              <button onClick={() => setIsAddStationModalOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">شناسه ایستگاه (کد یکتا): *</label>
                  <input
                    type="text"
                    placeholder="مثلا: WS-101"
                    value={newStationForm.stationId}
                    onChange={(e) => setNewStationForm({ ...newStationForm, stationId: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">عنوان ایستگاه کاری: *</label>
                  <input
                    type="text"
                    placeholder="مثلا: ایستگاه تزریق دایکست"
                    value={newStationForm.stationName}
                    onChange={(e) => setNewStationForm({ ...newStationForm, stationName: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">کد عملیات:</label>
                  <input
                    type="text"
                    placeholder="مثلا: OP-010"
                    value={newStationForm.operationCode}
                    onChange={(e) => setNewStationForm({ ...newStationForm, operationCode: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">عنوان فرآیند / عملیات:</label>
                  <input
                    type="text"
                    placeholder="مثلا: تزریق و شکل‌دهی آلومینیوم"
                    value={newStationForm.operationTitle}
                    onChange={(e) => setNewStationForm({ ...newStationForm, operationTitle: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">کد دستگاه / تجهیز:</label>
                  <input
                    type="text"
                    placeholder="مثلا: MCH-DC-800T"
                    value={newStationForm.machineCode}
                    onChange={(e) => setNewStationForm({ ...newStationForm, machineCode: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">نام دستگاه:</label>
                  <input
                    type="text"
                    placeholder="مثلا: ماشین دایکست ۸۰۰ تن Buhler"
                    value={newStationForm.machineTitle}
                    onChange={(e) => setNewStationForm({ ...newStationForm, machineTitle: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">اپراتور / تنظیم‌کار:</label>
                  <input
                    type="text"
                    placeholder="نام مسئول ایستگاه"
                    value={newStationForm.operatorName}
                    onChange={(e) => setNewStationForm({ ...newStationForm, operatorName: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">شیفت کاری:</label>
                  <select
                    value={newStationForm.shiftName}
                    onChange={(e) => setNewStationForm({ ...newStationForm, shiftName: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  >
                    <option value="شیفت روز (A)">شیفت روز (A)</option>
                    <option value="شیفت عصر (B)">شیفت عصر (B)</option>
                    <option value="شیفت شب (C)">شیفت شب (C)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button onClick={() => setIsAddStationModalOpen(false)} className="px-4 py-2 rounded-xl text-xs bg-zinc-800 text-zinc-300 cursor-pointer">
                انصراف
              </button>
              <button onClick={handleCreateStationBlock} className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">
                ایجاد ایستگاه کاری
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* EDIT WORKSTATION BLOCK MODAL                                        */}
      {/* =================================================================== */}
      {isEditStationModalOpen && editingStationForm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-6 max-w-lg w-full text-right shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Edit3 size={18} className="text-emerald-400" />
                <span>ویرایش مشخصات ایستگاه کاری ({editingStationForm.stationId})</span>
              </h3>
              <button onClick={() => setIsEditStationModalOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <label className="text-zinc-400 font-bold block mb-1">عنوان ایستگاه کاری: *</label>
                <input
                  type="text"
                  value={editingStationForm.stationName}
                  onChange={(e) => setEditingStationForm({ ...editingStationForm, stationName: e.target.value })}
                  className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">کد عملیات:</label>
                  <input
                    type="text"
                    value={editingStationForm.operationCode}
                    onChange={(e) => setEditingStationForm({ ...editingStationForm, operationCode: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">عنوان فرآیند / عملیات:</label>
                  <input
                    type="text"
                    value={editingStationForm.operationTitle}
                    onChange={(e) => setEditingStationForm({ ...editingStationForm, operationTitle: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">کد دستگاه / تجهیز:</label>
                  <input
                    type="text"
                    value={editingStationForm.machineCode}
                    onChange={(e) => setEditingStationForm({ ...editingStationForm, machineCode: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">نام دستگاه:</label>
                  <input
                    type="text"
                    value={editingStationForm.machineTitle}
                    onChange={(e) => setEditingStationForm({ ...editingStationForm, machineTitle: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">اپراتور / تنظیم‌کار:</label>
                  <input
                    type="text"
                    value={editingStationForm.operatorName}
                    onChange={(e) => setEditingStationForm({ ...editingStationForm, operatorName: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 font-bold block mb-1">شیفت کاری:</label>
                  <select
                    value={editingStationForm.shiftName}
                    onChange={(e) => setEditingStationForm({ ...editingStationForm, shiftName: e.target.value })}
                    className="w-full bg-[#18181f] border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 outline-none"
                  >
                    <option value="شیفت روز (A)">شیفت روز (A)</option>
                    <option value="شیفت عصر (B)">شیفت عصر (B)</option>
                    <option value="شیفت شب (C)">شیفت شب (C)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
              <button onClick={() => setIsEditStationModalOpen(false)} className="px-4 py-2 rounded-xl text-xs bg-zinc-800 text-zinc-300 cursor-pointer">
                انصراف
              </button>
              <button onClick={handleUpdateStationBlock} className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">
                ذخیره تغییرات ایستگاه
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
