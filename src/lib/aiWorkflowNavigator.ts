import { Role, WorkflowStep } from '../components/TeamManagementTypes';
import { documentTemplates } from '../data/documentTemplates';
import { QmsDatabase } from './qmsDatabase';
import { iatfData } from '../data/iatfData';
import {
  EventType,
  EventClassification,
  RouteStep,
  WorkflowRoute,
  NavigatorAnalysisResult
} from '../types/aiNavigator';

/**
 * 1. AI Event Classifier
 * Automatically analyzes the selected document title or entity record to determine event type.
 */
export function classifyEvent(eventEntityName: string, lang: 'fa' | 'en' = 'fa'): EventClassification {
  const nameLower = (eventEntityName || '').toLowerCase().trim();

  if (!eventEntityName || nameLower === '') {
    return {
      eventType: 'DOCUMENT_REVISION',
      titleFa: 'تغییر یا بازنگری عمومی اسناد کیفی',
      titleEn: 'General Quality Document Revision',
      confidence: 85,
      reasonFa: 'به علت عدم انتخاب سند مشخص، چرخه عمومی تاییدات اسناد IATF 16949 اعمال گردید.',
      reasonEn: 'Default IATF 16949 document approval cycle applied.',
      detectedEntities: ['اطلاعات مستند (7.5)'],
      primaryClauseId: '7.5'
    };
  }

  if (
    nameLower.includes('complaint') ||
    nameLower.includes('ادعای مشتری') ||
    nameLower.includes('مشتری') ||
    nameLower.includes('بازخورد مشتری') ||
    nameLower.includes('نقص مشتری')
  ) {
    return {
      eventType: 'CUSTOMER_COMPLAINT',
      titleFa: 'ادعای کیفی مشتری / عدم انطباق محصول',
      titleEn: 'Customer Quality Complaint / Nonconformity',
      confidence: 96,
      reasonFa: 'شناسایی عیب کیفی ارسالی از طرف مشتری. نیازمند پاسخ فوری 8D، تحلیل ریشه و ارزیابی اثر بر PFMEA و طرح کنترل.',
      reasonEn: 'Detected customer quality issue requiring 8D problem solving and downstream PFMEA/Control Plan impact analysis.',
      detectedEntities: ['ادعای مشتری (10.2.3)', 'کاربرگ 8D (10.2.3)', 'تحلیل ریشه RCA', 'طرح کنترل (8.5.1.1)'],
      primaryClauseId: '10.2.3'
    };
  }

  if (
    nameLower.includes('nonconformity') ||
    nameLower.includes('عدم انطباق') ||
    nameLower.includes('8d') ||
    nameLower.includes('اصلاحی') ||
    nameLower.includes('capa')
  ) {
    return {
      eventType: 'NONCONFORMITY_8D',
      titleFa: 'عدم انطباق و اقدام اصلاحی سیستماتیک (CAPA)',
      titleEn: 'Nonconformity & Systematic CAPA (8D)',
      confidence: 94,
      reasonFa: 'شناسایی عدم انطباق فرآیندی یا محصولی. مستلزم اقدامات مهار فوری، ریشه‌یابی ۵ چرا و صحه‌گذاری اثربخشی.',
      reasonEn: 'Identified process or product nonconformity requiring interim containment, 5-Why RCA, and effectiveness verification.',
      detectedEntities: ['اقدام اصلاحی (10.2.1)', 'تحلیل علت ریشه‌ای', 'تایید اثربخشی'],
      primaryClauseId: '10.2.1'
    };
  }

  if (
    nameLower.includes('fmea') ||
    nameLower.includes('ریسک') ||
    nameLower.includes('risk') ||
    nameLower.includes('خطا')
  ) {
    return {
      eventType: 'PFMEA_CHANGE',
      titleFa: 'ارزیابی ریسک فرآیند و آنالیز حالات خطا (PFMEA)',
      titleEn: 'Process Risk Assessment & Failure Modes (PFMEA)',
      confidence: 95,
      reasonFa: 'شناسایی تغییر در حالات خطای فرآیند. تغییرات شدت، وقوع یا کشف مستقیماً نیازمند بازنگری طرح کنترل و WI است.',
      reasonEn: 'Detected failure mode variance directly triggering Control Plan and Work Instruction (WI) alignment.',
      detectedEntities: ['PFMEA (8.3.5.2)', 'تحلیل ریسک (6.1.2.1)', 'طرح کنترل (8.5.1.1)'],
      primaryClauseId: '8.3.5.2'
    };
  }

  if (
    nameLower.includes('control plan') ||
    nameLower.includes('طرح کنترل')
  ) {
    return {
      eventType: 'CONTROL_PLAN_REVISION',
      titleFa: 'بازنگری طرح کنترل خط تولید (Control Plan)',
      titleEn: 'Production Control Plan Revision',
      confidence: 93,
      reasonFa: 'تغییر در ویژگی‌های کنترلی یا ابزارهای پایش. مستلزم بازنگری ایستگاه‌های کاری، WI و تاییدیه تنظیمات (Job Setup).',
      reasonEn: 'Changes in control characteristics requiring updates to Work Instructions and Job Setup verification.',
      detectedEntities: ['طرح کنترل (8.5.1.1)', 'دستورالعمل کاری (8.5.1.2)', 'تنظیمات کاری (8.5.1.3)'],
      primaryClauseId: '8.5.1.1'
    };
  }

  if (
    nameLower.includes('audit') ||
    nameLower.includes('ممیزی') ||
    nameLower.includes('vda')
  ) {
    return {
      eventType: 'AUDIT_FINDING',
      titleFa: 'یافته ممیزی داخلی یا ممیزی فرآیند ساخت (VDA 6.3)',
      titleEn: 'Internal Audit Finding / Process Audit (VDA 6.3)',
      confidence: 92,
      reasonFa: 'یافته ممیزی عدم انطباق یا فرصت بهبود. مستلزم تدوین گزارش عدم انطباق، اقدام اصلاحی و بازپایش ممیز.',
      reasonEn: 'Audit nonconformity finding triggering corrective action workflow and auditor re-verification.',
      detectedEntities: ['برنامه ممیزی (9.2.2.1)', 'ممیزی فرآیند (9.2.2.3)', 'عدم انطباق ممیزی'],
      primaryClauseId: '9.2.2.3'
    };
  }

  if (
    nameLower.includes('setup') ||
    nameLower.includes('تنظیمات') ||
    nameLower.includes('تجهیز') ||
    nameLower.includes('قالب')
  ) {
    return {
      eventType: 'JOB_SETUP_VARIANCE',
      titleFa: 'تاییدیه تنظیمات اولیه و راه‌اندازی تولید (Job Setup)',
      titleEn: 'Job Setup Verification & Production Release',
      confidence: 90,
      reasonFa: 'تغییر یا تنظیم جدید در ایستگاه ساخت. مستلزم نمونه‌برداری اولیه، کنترل ابعادی و صدور مجوز تولید توسط کیفیت.',
      reasonEn: 'Setup changes requiring first-piece inspection and production release sign-off.',
      detectedEntities: ['تاییدیه تنظیمات (8.5.1.3)', 'دستورالعمل کاری (8.5.1.2)', 'کنترل آماری (9.1.1.1)'],
      primaryClauseId: '8.5.1.3'
    };
  }

  if (
    nameLower.includes('supplier') ||
    nameLower.includes('تامین') ||
    nameLower.includes('پیمانکار') ||
    nameLower.includes('خرید')
  ) {
    return {
      eventType: 'SUPPLIER_QUALITY_ISSUE',
      titleFa: 'عدم انطباق مواد و قطعات ورودی زنجیره تامین',
      titleEn: 'Supplier Material & Component Quality Issue',
      confidence: 91,
      reasonFa: 'نقص در محموله ورودی. مستلزم صدور عدم انطباق تامین‌کننده، قرنطینه کالا، گزارش SCAR و ارزیابی عملکرد.',
      reasonEn: 'Inbound material defect requiring supplier corrective action request (SCAR) and vendor rating review.',
      detectedEntities: ['پایش تامین‌کنندگان (8.4.2.4)', 'عدم انطباق ورودی (8.7)'],
      primaryClauseId: '8.4.2.4'
    };
  }

  if (
    nameLower.includes('kpi') ||
    nameLower.includes('شاخص') ||
    nameLower.includes('هدف')
  ) {
    return {
      eventType: 'KPI_DEVIATION',
      titleFa: 'انحراف شاخص‌های کلیدی عملکرد و اهداف کیفیت',
      titleEn: 'Quality Objective & KPI Deviation',
      confidence: 89,
      reasonFa: 'عدم تحقق هدف KPI کیفیت. مستلزم تحلیل روند، جلسه بازنگری مدیریت و تعریف پروژه بهبود مستمر.',
      reasonEn: 'KPI target drop triggering trend analysis, management review, and continuous improvement project.',
      detectedEntities: ['اهداف کیفیت (6.2)', 'بازنگری مدیریت (9.3)', 'بهبود مستمر (10.3)'],
      primaryClauseId: '6.2'
    };
  }

  // Default fallback classification
  return {
    eventType: 'DOCUMENT_REVISION',
    titleFa: `گردش کار تخصصی اسناد و فرآیند (${eventEntityName})`,
    titleEn: `Specialized Quality Flow (${eventEntityName})`,
    confidence: 88,
    reasonFa: 'تحلیل ساختار اسناد و الزامات متناظر IATF 16949 برای تعیین بهترین مسیر تصویب و صحه‌گذاری.',
    reasonEn: 'Automated structure analysis mapping to authoritative IATF 16949 approval graph.',
    detectedEntities: [eventEntityName, 'اطلاعات مستند (7.5)', 'تصویب و صحه‌گذاری'],
    primaryClauseId: '7.5'
  };
}

/**
 * Helper to match role names from system role library
 */
function findRoleIdByName(roles: Role[], nameKeyword: string, defaultId: string): string {
  const kw = nameKeyword.toLowerCase();
  const match = roles.find(
    r =>
      r.name.toLowerCase().includes(kw) ||
      r.nameFa.includes(kw) ||
      (r.id && r.id.toLowerCase().includes(kw))
  );
  return match ? match.id : defaultId;
}

/**
 * 2. AI Route Planner
 * Computes candidate workflow routes using actual QMS graph entities and roles.
 */
export function calculateWorkflowRoutes(
  eventEntityName: string,
  existingSteps: WorkflowStep[],
  roles: Role[],
  lang: 'fa' | 'en' = 'fa'
): WorkflowRoute[] {
  const classification = classifyEvent(eventEntityName, lang);

  // System roles helpers
  const qaRoleId = findRoleIdByName(roles, 'تضمین', roles[0]?.id || 'role-qa');
  const qcRoleId = findRoleIdByName(roles, 'کیفیت', qaRoleId);
  const prodRoleId = findRoleIdByName(roles, 'تولید', qaRoleId);
  const cftRoleId = findRoleIdByName(roles, 'cft', qaRoleId);
  const managerRoleId = findRoleIdByName(roles, 'مدیر', qaRoleId);

  let primaryRouteSteps: Omit<RouteStep, 'status'>[] = [];
  let altRouteSteps: Omit<RouteStep, 'status'>[] = [];
  let minimalRouteSteps: Omit<RouteStep, 'status'>[] = [];

  switch (classification.eventType) {
    case 'CUSTOMER_COMPLAINT':
      primaryRouteSteps = [
        {
          id: 'step-d1-team',
          stepNumber: 1,
          name: 'Form 8D CFT Problem Solving Team',
          nameFa: 'تشکیل تیم رسمی حل مسئله CFT (D1)',
          proposedRoleId: cftRoleId,
          affectedEntity: 'Customer Complaint #1042',
          affectedEntityFa: 'ادعای کیفی مشتری / ثبت اولیه 8D',
          whyFa: 'تعیین اعضای تیم چندتخصصی (تولید، مهندسی، تضمین کیفیت) جهت مسئولیت‌پذیری در گام‌های هشت‌گانه.',
          whyEn: 'Cross-functional team assignment for 8D execution under IATF clause 10.2.3.',
          clauseId: '10.2.3',
          expectedInputFa: 'ثبت کد ادعای مشتری و شرح ایراد قطعه',
          expectedOutputFa: 'لیست اعضا و انتصاب رهبر تیم 8D',
          dependencies: [],
          isMandatory: true,
          confidence: 98
        },
        {
          id: 'step-d3-containment',
          stepNumber: 2,
          name: 'Interim Containment & Quarantine (D3)',
          nameFa: 'اقدامات مهار فوری و قرنطینه محموله (D3)',
          proposedRoleId: qcRoleId,
          affectedEntity: 'Warehouse & Line Inspection',
          affectedEntityFa: 'انبار محصولات و ایستگاه‌های مونتاژ',
          whyFa: 'کاهش ریسک خروج مجدد قطعه معیوب به سمت خط مشتری با تفکیک ۱۰۰٪ و قرنطینه برچسب قرمز.',
          whyEn: 'Immediate containment to stop nonconforming product from reaching customer.',
          clauseId: '8.7',
          expectedInputFa: 'شماره محموله مشکوک و متراژ انبار',
          expectedOutputFa: 'فرم قرنطینه و آمار جداسازی قطعات',
          dependencies: ['step-d1-team'],
          isMandatory: true,
          confidence: 96
        },
        {
          id: 'step-d4-rca',
          stepNumber: 3,
          name: 'Root Cause Analysis (Fishbone & 5-Why) (D4)',
          nameFa: 'تحلیل علمی علت ریشه‌ای خطا (D4)',
          proposedRoleId: qaRoleId,
          affectedEntity: 'RCA Analysis Matrix',
          affectedEntityFa: 'آنالیز استخوان ماهی و ۵ چرای ریشه‌ای',
          whyFa: 'یافتن علت اصلی بروز عیب و علت عدم کشف آن در خط تولید جهت جلوگیری از تکرار مجدد.',
          whyEn: 'Scientific root cause identification for systemic nonconformity resolution.',
          clauseId: '10.2.3',
          expectedInputFa: 'نتایج بازرسی قطعات مهار شده',
          expectedOutputFa: 'گزارش تایید شده علت ریشه‌ای عیب',
          dependencies: ['step-d3-containment'],
          isMandatory: true,
          confidence: 95
        },
        {
          id: 'step-d5-pca',
          stepNumber: 4,
          name: 'Permanent Corrective Actions (PCA) (D5)',
          nameFa: 'تعیین اقدامات اصلاحی دائم و پوکایوکه (D5)',
          proposedRoleId: prodRoleId,
          affectedEntity: 'Corrective Action Plan (CAPA)',
          affectedEntityFa: 'برنامه اقدامات اصلاحی دائم',
          whyFa: 'تعریف تغییرات فیزیکی در ابزار، فیکسچر، سنسور یا متد کاری برای حذف کامل منبع عیب.',
          whyEn: 'Implementation of permanent corrective actions and mistake-proofing controls.',
          clauseId: '10.2.4',
          expectedInputFa: 'گزارش علت ریشه‌ای گام D4',
          expectedOutputFa: 'لیست اقدامات دائم با سررسید و مسئول',
          dependencies: ['step-d4-rca'],
          isMandatory: true,
          confidence: 94
        },
        {
          id: 'step-pfmea-review',
          stepNumber: 5,
          name: 'PFMEA Risk Impact Review',
          nameFa: 'بازنگری تحلیل ریسک فرآیند (PFMEA)',
          proposedRoleId: cftRoleId,
          affectedEntity: 'PFMEA Document',
          affectedEntityFa: 'جدول آنالیز حالات و اثرات خطای فرآیند',
          whyFa: 'بروزرسانی عدد اولویت ریسک (RPN/AP) و ثبت حالت خطای جدید در PFMEA به روزرسانی شده.',
          whyEn: 'PFMEA updates to incorporate new failure mode insights as mandated by IATF 8.3.5.2.',
          clauseId: '8.3.5.2',
          expectedInputFa: 'شرح عیب مشتری و اقدام اصلاحی D5',
          expectedOutputFa: 'نسخه جدید PFMEA با رتبه ریسک اصلاح‌شده',
          dependencies: ['step-d5-pca'],
          isMandatory: true,
          confidence: 96
        },
        {
          id: 'step-cp-review',
          stepNumber: 6,
          name: 'Production Control Plan Update',
          nameFa: 'به‌روزرسانی طرح کنترل خط (Control Plan)',
          proposedRoleId: qaRoleId,
          affectedEntity: 'Control Plan Document',
          affectedEntityFa: 'طرح کنترل تولید انبوه کارخانه',
          whyFa: 'افزایش فرکانس پایش یا افزودن ایستگاه جدید بازرسی بر اساس تغییرات صورت‌گرفته در PFMEA.',
          whyEn: 'Control Plan alignment to reflect new controls and sampling rates.',
          clauseId: '8.5.1.1',
          expectedInputFa: 'نسخه اصلاح‌شده PFMEA',
          expectedOutputFa: 'نسخه به روزشده Control Plan با تایید کیفیت',
          dependencies: ['step-pfmea-review'],
          isMandatory: true,
          confidence: 95
        },
        {
          id: 'step-wi-review',
          stepNumber: 7,
          name: 'Work Instruction (WI/JES) Update',
          nameFa: 'بازنگری دستورالعمل‌های کاری اپراتور (WI/JES)',
          proposedRoleId: prodRoleId,
          affectedEntity: 'Standard Work Instructions (SWI)',
          affectedEntityFa: 'دستورالعمل کاری فیزیکی ایستگاه مونتاژ',
          whyFa: 'آموزش و نصب دستورالعمل کاری جدید در ایستگاه برای الزام اپراتور به روش اصلاح‌شده.',
          whyEn: 'Operational work instruction updates to ensure operator compliance at the workstation.',
          clauseId: '8.5.1.2',
          expectedInputFa: 'طرح کنترل اصلاح‌شده',
          expectedOutputFa: 'دستورالعمل کاری جدید مستقر روی خط',
          dependencies: ['step-cp-review'],
          isMandatory: true,
          confidence: 92
        },
        {
          id: 'step-d8-effectiveness',
          stepNumber: 8,
          name: 'Effectiveness Verification & Closure (D8)',
          nameFa: 'تصدیق اثربخشی مستمر و بستن پرونده (D8)',
          proposedRoleId: managerRoleId,
          affectedEntity: '8D Closure Sign-Off',
          affectedEntityFa: 'ممیزی اثربخشی و لوح تقدیر تیم',
          whyFa: 'ارزیابی نرخ عدم تکرار خطای مشتری پس از ۳ شیفت کاری و تایید مدیریت ارشد کیفیت جهت بستن نهایی.',
          whyEn: 'Formal verification of zero recurrence before executive closure sign-off.',
          clauseId: '10.2.3',
          expectedInputFa: 'سوابق تولید ۳ دوره بدون عیب',
          expectedOutputFa: 'امضای بستن پرونده و بایگانی سوابق',
          dependencies: ['step-wi-review'],
          isMandatory: true,
          confidence: 97
        }
      ];

      altRouteSteps = [
        primaryRouteSteps[0], // D1
        primaryRouteSteps[1], // Containment
        primaryRouteSteps[2], // RCA
        primaryRouteSteps[3], // PCA
        primaryRouteSteps[5], // Control Plan
        primaryRouteSteps[7]  // Closure
      ];

      minimalRouteSteps = [
        primaryRouteSteps[0],
        primaryRouteSteps[1],
        primaryRouteSteps[3],
        primaryRouteSteps[7]
      ];
      break;

    case 'PFMEA_CHANGE':
    case 'CONTROL_PLAN_REVISION':
      primaryRouteSteps = [
        {
          id: 'step-pfmea-init',
          stepNumber: 1,
          name: 'CFT Risk Assessment & Failure Modes',
          nameFa: 'ارزیابی ریسک فرآیند و آنالیز حالات خطا (PFMEA)',
          proposedRoleId: cftRoleId,
          affectedEntity: 'PFMEA Matrix',
          affectedEntityFa: 'ماتریس آنالیز حالات و اثرات خطا',
          whyFa: 'شناسایی و نمره‌دهی خطاهای احتمالی فرآیند ساخت، علت‌های وقوع و مکانیزم‌های کشف.',
          whyEn: 'Identification and scoring of process failure modes and detection mechanisms.',
          clauseId: '8.3.5.2',
          expectedInputFa: 'نقشه فنی و دیاگرام جریان فرآیند (OPC)',
          expectedOutputFa: 'جدول کامل PFMEA با محاسبه RPN',
          dependencies: [],
          isMandatory: true,
          confidence: 97
        },
        {
          id: 'step-cp-draft',
          stepNumber: 2,
          name: 'Draft Production Control Plan',
          nameFa: 'تدوین و انطباق طرح کنترل خط (Control Plan)',
          proposedRoleId: qaRoleId,
          affectedEntity: 'Control Plan',
          affectedEntityFa: 'طرح کنترل تولید انبوه',
          whyFa: 'استخراج مستقیم مشخصات کنترلی محصول و فرآیند از حالات خطای با ریسک بالا در PFMEA.',
          whyEn: 'Direct extraction of control characteristics from high-risk failure modes.',
          clauseId: '8.5.1.1',
          expectedInputFa: 'جدول تایید شده PFMEA',
          expectedOutputFa: 'پیش‌نویس طرح کنترل با حدود پذیرش',
          dependencies: ['step-pfmea-init'],
          isMandatory: true,
          confidence: 96
        },
        {
          id: 'step-wi-design',
          stepNumber: 3,
          name: 'Standard Work Instructions (JES/WI)',
          nameFa: 'طراحی دستورالعمل استاندارد کاری ایستگاه (WI)',
          proposedRoleId: prodRoleId,
          affectedEntity: 'Workstation WI Sheets',
          affectedEntityFa: 'دستورالعمل‌های کاری اپراتور ایستگاه',
          whyFa: 'تبدیل بندهای طرح کنترل به گام‌های ساده تصویری و اجرایی برای اپراتورهای خط.',
          whyEn: 'Translating Control Plan requirements into step-by-step visual operator sheets.',
          clauseId: '8.5.1.2',
          expectedInputFa: 'طرح کنترل مصوب',
          expectedOutputFa: 'دستورالعمل کاری تصویری مستقر روی خط',
          dependencies: ['step-cp-draft'],
          isMandatory: true,
          confidence: 94
        },
        {
          id: 'step-job-setup',
          stepNumber: 4,
          name: 'First Piece Job Setup Verification',
          nameFa: 'تاییدیه تنظیمات کاری و قطعه اول (Job Setup)',
          proposedRoleId: qcRoleId,
          affectedEntity: 'Job Setup Verification Record',
          affectedEntityFa: 'فرم تایید راه‌اندازی و قطعه اول',
          whyFa: 'اطمینان از صحت تنظیمات قالب، ابزار و ابعاد قطعه اول قبل از صدور مجوز تولید انبوه.',
          whyEn: 'Ensuring machine parameters and first-piece measurements comply before full run.',
          clauseId: '8.5.1.3',
          expectedInputFa: 'دستورالعمل کاری و گیج‌های ابعادی',
          expectedOutputFa: 'تاییدیه امضا شده قطعه اول',
          dependencies: ['step-wi-design'],
          isMandatory: true,
          confidence: 93
        },
        {
          id: 'step-process-audit',
          stepNumber: 5,
          name: 'Process Audit & Capability Verification',
          nameFa: 'ممیزی فرآیند ساخت و ارزیابی Cpk',
          proposedRoleId: managerRoleId,
          affectedEntity: 'Process Capability & Audit Log',
          affectedEntityFa: 'گزارش قابلیت فرآیند و ممیزی داخلی',
          whyFa: 'صحه‌گذاری پایداری فرآیند جدید با اندازه‌گیری شاخص‌های آماری Cpk > 1.67.',
          whyEn: 'Validation of process stability and statistical capability.',
          clauseId: '9.1.1.1',
          expectedInputFa: 'سوابق اندازه‌گیری ۳۰ قطعه متوالی',
          expectedOutputFa: 'گزارش پایداری آماری و مجوز نهایی',
          dependencies: ['step-job-setup'],
          isMandatory: true,
          confidence: 95
        }
      ];

      altRouteSteps = [
        primaryRouteSteps[0],
        primaryRouteSteps[1],
        primaryRouteSteps[2],
        primaryRouteSteps[4]
      ];

      minimalRouteSteps = [
        primaryRouteSteps[0],
        primaryRouteSteps[1],
        primaryRouteSteps[2]
      ];
      break;

    default:
      primaryRouteSteps = [
        {
          id: 'step-gen-1',
          stepNumber: 1,
          name: 'Document Draft & Peer Review',
          nameFa: 'بازبینی اولیه و کارشناسی مدرک',
          proposedRoleId: cftRoleId,
          affectedEntity: eventEntityName || 'اطلاعات مستند',
          affectedEntityFa: eventEntityName || 'اطلاعات مستند',
          whyFa: 'ارزیابی انطباق محتوای مدرک با الزامات بند ۷.۵ استاندارد IATF 16949.',
          whyEn: 'Draft verification against IATF 16949 documentation requirements.',
          clauseId: '7.5',
          expectedInputFa: 'پیش‌نویس مدرک کیفی',
          expectedOutputFa: 'نظرات اصلاحی کارشناسی',
          dependencies: [],
          isMandatory: true,
          confidence: 90
        },
        {
          id: 'step-gen-2',
          stepNumber: 2,
          name: 'Department Head Approval',
          nameFa: 'تایید مدیر واحد ذیربط',
          proposedRoleId: qaRoleId,
          affectedEntity: 'Department Review',
          affectedEntityFa: 'تایید فرآیندی واحد',
          whyFa: 'تایید امکان‌پذیری اجرایی متدولوژی پیشنهادی توسط مسئول فرآیند.',
          whyEn: 'Operational feasibility approval by process owner.',
          clauseId: '5.3.1',
          expectedInputFa: 'نسخه اصلاح‌شده مدرک',
          expectedOutputFa: 'تاییدیه فرآیندی',
          dependencies: ['step-gen-1'],
          isMandatory: true,
          confidence: 92
        },
        {
          id: 'step-gen-3',
          stepNumber: 3,
          name: 'Quality Manager Final Authorization',
          nameFa: 'تصویب نهایی و ابلاغ توسط مدیریت کیفیت',
          proposedRoleId: managerRoleId,
          affectedEntity: 'QMS Document Release',
          affectedEntityFa: 'انتشار رسمی در پورتال اسناد',
          whyFa: 'ثبت کد سند، تاریخ اعتبار و ابلاغ الکترونیکی به تمامی ایستگاه‌های کاری.',
          whyEn: 'Official document numbering, validity date, and release into QMS repository.',
          clauseId: '7.5.3',
          expectedInputFa: 'مدرک امضا شده',
          expectedOutputFa: 'نسخه فعال و توزیع شده مدرک',
          dependencies: ['step-gen-2'],
          isMandatory: true,
          confidence: 96
        }
      ];

      altRouteSteps = [primaryRouteSteps[0], primaryRouteSteps[2]];
      minimalRouteSteps = [primaryRouteSteps[2]];
      break;
  }

  // Match current workflow steps against suggested steps to assign statuses
  const mapStepsToRoute = (stepsPool: Omit<RouteStep, 'status'>[]): RouteStep[] => {
    return stepsPool.map((s, idx) => {
      // Check if user already has a step matching this intent or approver
      const existingMatch = existingSteps.find(
        ex =>
          ex.name.toLowerCase().includes(s.name.toLowerCase()) ||
          ex.nameFa.includes(s.nameFa) ||
          (s.proposedRoleId && ex.approverRoleId === s.proposedRoleId)
      );

      let status: RouteStep['status'] = 'Recommended';
      if (existingMatch) {
        status = 'Existing';
      } else if (s.isMandatory) {
        status = 'Missing';
      } else {
        status = 'Recommended';
      }

      return {
        ...s,
        stepNumber: idx + 1,
        status
      };
    });
  };

  const primarySteps = mapStepsToRoute(primaryRouteSteps);
  const altSteps = mapStepsToRoute(altRouteSteps);
  const minimalSteps = mapStepsToRoute(minimalRouteSteps);

  const calcMetrics = (stepsList: RouteStep[]) => {
    const existingCount = stepsList.filter(s => s.status === 'Existing').length;
    const recommendedCount = stepsList.filter(s => s.status === 'Recommended').length;
    const missingCount = stepsList.filter(s => s.status === 'Missing').length;
    const coverageScore = Math.round((existingCount / Math.max(1, stepsList.length)) * 100);

    const gapsFa: string[] = [];
    const gapsEn: string[] = [];

    stepsList.forEach(s => {
      if (s.status === 'Missing') {
        gapsFa.push(`مرحله بحرانی «${s.nameFa}» در گردش کار فعلی شما وجود ندارد.`);
        gapsEn.push(`Missing required step "${s.name}".`);
      }
    });

    return { existingCount, recommendedCount, missingCount, coverageScore, gapsFa, gapsEn };
  };

  const pMetrics = calcMetrics(primarySteps);
  const aMetrics = calcMetrics(altSteps);
  const mMetrics = calcMetrics(minimalSteps);

  const primaryRoute: WorkflowRoute = {
    id: 'route-primary',
    titleFa: 'مسیر پیشنهادی اصلی (پوشش کامل زنجیره اثر IATF 16949)',
    titleEn: 'Primary Route (Full IATF 16949 Impact Chain)',
    type: 'PRIMARY',
    descriptionFa: 'پوشش کامل تمام الزامات استاندارد از ریشه‌یابی عیب تا به‌روزرسانی PFMEA، طرح کنترل و WI.',
    descriptionEn: 'Full IATF compliance covering 8D RCA down to PFMEA, Control Plan, and Work Instruction updates.',
    steps: primarySteps,
    totalSteps: primarySteps.length,
    ...pMetrics
  };

  const altRoute: WorkflowRoute = {
    id: 'route-alt',
    titleFa: 'مسیر جایگزین (تمرکز بر مهار و کنترل سریع)',
    titleEn: 'Alternative Route (Containment & Fast-Track)',
    type: 'ALTERNATIVE',
    descriptionFa: 'مسیر فشرده‌تر برای عدم انطباق‌های با ریسک متوسط با محوریت مهار و اصلاح طرح کنترل.',
    descriptionEn: 'Streamlined path focused on fast containment and Control Plan updates.',
    steps: altSteps,
    totalSteps: altSteps.length,
    ...aMetrics
  };

  const minimalRoute: WorkflowRoute = {
    id: 'route-minimal',
    titleFa: 'مسیر مینیمال (حل مسئله و بستن سریع)',
    titleEn: 'Minimal Route (Basic CAPA & Closure)',
    type: 'MINIMAL',
    descriptionFa: 'حداقل مراحل تاییدات رسمی جهت ثبت اقدام اصلاحی و امضای بستن پرونده.',
    descriptionEn: 'Basic approval steps for simple document updates and sign-off.',
    steps: minimalSteps,
    totalSteps: minimalSteps.length,
    ...mMetrics
  };

  return [primaryRoute, altRoute, minimalRoute];
}

/**
 * Main navigator orchestrator function
 */
export async function analyzeWorkflowNavigation(
  eventEntityName: string,
  existingSteps: WorkflowStep[],
  roles: Role[],
  lang: 'fa' | 'en' = 'fa'
): Promise<NavigatorAnalysisResult> {
  const classification = classifyEvent(eventEntityName, lang);
  const routes = calculateWorkflowRoutes(eventEntityName, existingSteps, roles, lang);

  // Try calling server-side AI endpoint for enhanced Gemini reasoning if available
  try {
    const res = await fetch('/api/ai/navigate-workflow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventEntityName,
        existingSteps,
        rolesCount: roles.length,
        eventType: classification.eventType
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.routes) {
        // Merge server insights if available
        return {
          eventClassification: data.classification || classification,
          selectedGoalFa: 'تحقق انطباق ۱۰۰٪ با الزامات IATF 16949 و صفر شدن ریسک تکرار',
          selectedGoalEn: '100% IATF 16949 compliance and zero-defect recurrence',
          routes: data.routes || routes,
          activeRouteId: data.routes[0]?.id || 'route-primary',
          isRecalculating: false,
          lastUpdated: new Date().toLocaleTimeString()
        };
      }
    }
  } catch (e) {
    // Graceful client fallback
  }

  return {
    eventClassification: classification,
    selectedGoalFa: 'تحقق انطباق ۱۰۰٪ با الزامات IATF 16949 و صفر شدن ریسک تکرار',
    selectedGoalEn: '100% IATF 16949 compliance and zero-defect recurrence',
    routes,
    activeRouteId: 'route-primary',
    isRecalculating: false,
    lastUpdated: new Date().toLocaleTimeString()
  };
}
