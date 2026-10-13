/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SWIAnnotation {
  id: string;
  type: 'arrow' | 'circle' | 'rect' | 'text' | 'hotspot' | 'ok' | 'ng';
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  text?: string;
  color?: string;
  size?: number;
}

export interface SWIStep {
  id: string;
  station: string;       // ایستگاه کاری
  partNo: string;        // محصول / شماره قطعه
  operation: string;     // عملیات / مرحله کار
  jobElements: string;   // شرح جزئیات (Job Elements)
  keyPoints: string;     // نکات کلیدی (Key Points)
  reasonWhy: string;     // دلیل و چرایی (Reason Why)
  equipment: string;     // ابزار و تجهیزات
  safety: string;        // مشخصه ایمنی و کیفیت (PPE)
  stdTime: number;       // زمان کار استاندارد (ثانیه)
  taktTime?: number;     // تکت تایم (Takt Time)
  cycleTime?: number;    // زمان سیکل (Cycle Time)
  manualTime?: number;   // زمان دستی (Manual Time)
  machineTime?: number;  // زمان خودکار ماشین (Machine Time)
  loadUnloadTime?: number; // زمان بارگذاری/تخلیه (Load/Unload Time)
  waitingTime?: number;  // زمان انتظار (Waiting Time)
  setupTime?: number;    // زمان تنظیم یا تعویض (Setup/Changeover Time)
  imageUrl: string;      // تصویر مرحله
  images?: string[];     // پشتیبانی از چند تصویر
  activeImageIndex?: number;
  annotations?: SWIAnnotation[]; // ترسیمات روی تصویر
  dbRowIds?: Record<string, string>; // Mapping of field name to target QmsDatabase rowId
  [key: string]: any;    // Index signature for dynamic columns
}

export interface SWIBlock {
  id: string;
  type: string;
  title: string;
  x: number; // percentage or grid position
  y: number;
  w: number; // grid width (1-12) or percentage
  h: number; // grid height or percentage
  bgColor: string;
  textColor: string;
  fontSize: number;
  padding: number;
  borderThickness: number;
  borderColor: string;
  locked: boolean;
  visible: boolean;
  columnMapping?: string; // Relaxed mapping to string to support any dynamic custom block field
  customText?: string;
  imageHeight?: number; // Optional height of image block in pixels
  objectFit?: 'cover' | 'contain' | 'fill'; // Optional image fit configuration
}

// Default layout blocks representing standard SOS (Safety Operation Sheet) / JES templates
export const DEFAULT_SWI_BLOCKS: SWIBlock[] = [
  {
    id: 'block_doc_info',
    type: 'doc_info',
    title: 'اطلاعات سند و کنترل کیفی (ISO 9001)',
    x: 0, y: 0, w: 12, h: 80,
    bgColor: '#18181C', textColor: '#FFFFFF', fontSize: 13, padding: 12, borderThickness: 1, borderColor: '#333338',
    locked: true, visible: true, columnMapping: 'doc_info'
  },
  {
    id: 'block_station',
    type: 'station',
    title: 'ایستگاه کاری',
    x: 0, y: 90, w: 6, h: 50,
    bgColor: '#1C1C1E', textColor: '#F59E0B', fontSize: 14, padding: 10, borderThickness: 1, borderColor: '#F59E0B',
    locked: false, visible: true, columnMapping: 'station'
  },
  {
    id: 'block_part_no',
    type: 'part_no',
    title: 'محصول / شماره قطعه',
    x: 6, y: 90, w: 6, h: 50,
    bgColor: '#1C1C1E', textColor: '#F59E0B', fontSize: 14, padding: 10, borderThickness: 1, borderColor: '#F59E0B',
    locked: false, visible: true, columnMapping: 'partNo'
  },
  {
    id: 'block_operation',
    type: 'operation',
    title: 'عملیات / مرحله کار اصلی',
    x: 0, y: 150, w: 12, h: 60,
    bgColor: '#18181B', textColor: '#F59E0B', fontSize: 15, padding: 12, borderThickness: 1, borderColor: '#27272A',
    locked: false, visible: true, columnMapping: 'operation'
  },
  {
    id: 'block_image',
    type: 'image',
    title: 'تصویر اصلی مرحله (JES Visual Capture)',
    x: 0, y: 220, w: 12, h: 280,
    bgColor: '#0F0F11', textColor: '#FFFFFF', fontSize: 12, padding: 4, borderThickness: 1, borderColor: '#1E1E22',
    locked: false, visible: true, columnMapping: 'imageUrl'
  },
  {
    id: 'block_job_elements',
    type: 'job_elements',
    title: 'شرح جزئیات کار (Job Elements)',
    x: 0, y: 510, w: 12, h: 90,
    bgColor: '#18181C', textColor: '#E4E4E7', fontSize: 12, padding: 10, borderThickness: 1, borderColor: '#2D2D34',
    locked: false, visible: true, columnMapping: 'jobElements'
  },
  {
    id: 'block_key_points',
    type: 'key_points',
    title: 'نکات کلیدی کیفی/فنی (Key Points)',
    x: 0, y: 610, w: 6, h: 100,
    bgColor: '#1E293B', textColor: '#38BDF8', fontSize: 12, padding: 10, borderThickness: 1, borderColor: '#0284C7',
    locked: false, visible: true, columnMapping: 'keyPoints'
  },
  {
    id: 'block_reason_why',
    type: 'reason_why',
    title: 'دلیل و چرایی ایمنی (Reason Why)',
    x: 6, y: 610, w: 6, h: 100,
    bgColor: '#451A03', textColor: '#FDBA74', fontSize: 12, padding: 10, borderThickness: 1, borderColor: '#C2410C',
    locked: false, visible: true, columnMapping: 'reasonWhy'
  },
  {
    id: 'block_equipment',
    type: 'equipment',
    title: 'ابزار و تجهیزات کارگاه',
    x: 0, y: 720, w: 4, h: 80,
    bgColor: '#1C1C1E', textColor: '#E4E4E7', fontSize: 11, padding: 8, borderThickness: 1, borderColor: '#2E2E33',
    locked: false, visible: true, columnMapping: 'equipment'
  },
  {
    id: 'block_safety',
    type: 'safety',
    title: 'الزامات ایمنی و تجهیزات حفاظتی (PPE)',
    x: 4, y: 720, w: 4, h: 80,
    bgColor: '#1C1C1E', textColor: '#EF4444', fontSize: 11, padding: 8, borderThickness: 1, borderColor: '#EF4444',
    locked: false, visible: true, columnMapping: 'safety'
  },
  {
    id: 'block_std_time',
    type: 'std_time',
    title: 'زمان‌های عملیات',
    x: 8, y: 720, w: 4, h: 80,
    bgColor: '#1C1C1E', textColor: '#10B981', fontSize: 12, padding: 8, borderThickness: 1, borderColor: '#10B981',
    locked: false, visible: true, columnMapping: 'stdTime'
  },
  {
    id: 'block_signatures',
    type: 'signatures',
    title: 'تأییدکنندگان و امضاهای مجاز (Signatures)',
    x: 0, y: 810, w: 12, h: 60,
    bgColor: '#18181B', textColor: '#A1A1AA', fontSize: 11, padding: 8, borderThickness: 1, borderColor: '#27272A',
    locked: true, visible: true, columnMapping: 'signatures'
  }
];

// High-Fidelity Automotive Machining Presets (JES/SOS compliant for Sapco & Saipa)
export const AUTOMOTIVE_SWI_PRESETS: SWIStep[] = [];
