/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { iatfData, IATFClause } from '../data/iatfData';
import { DocItem } from '../data/documentTemplates';
import { CsrComparisonItem } from '../types';
import { QmsDatabase } from './qmsDatabase';

/**
 * Recursively flattens standard IATF tree clauses
 */
export function flattenIatfClauses(clauses: IATFClause[]): IATFClause[] {
  let result: IATFClause[] = [];
  for (const c of clauses) {
    result.push(c);
    if (c.subClauses && c.subClauses.length > 0) {
      result.push(...flattenIatfClauses(c.subClauses));
    }
  }
  return result;
}

/**
 * Checks if a standard clause is associated with a given process's clauseId expression
 */
export function isClauseAssociated(standardId: string, processClauseExpr: string): boolean {
  if (!processClauseExpr || !standardId) return false;
  
  // Normalize the strings (replace Persian digits, trim)
  const normExpr = processClauseExpr.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).trim();
  const normStd = standardId.trim();
  
  // Support multiple clause IDs separated by commas or semi-colons
  const parts = normExpr.split(/[،,;\s]+/).map(p => p.trim()).filter(Boolean);
  
  for (const part of parts) {
    // Exact match
    if (part === normStd) return true;
    
    // Prefix match - e.g. process is 8.5, standard clause is 8.5.1
    if (normStd.startsWith(part + '.')) return true;
    
    // Parent match - e.g. process is 8.5.1.1, standard clause is 8.5
    if (part.startsWith(normStd + '.')) return true;
  }
  
  return false;
}

/**
 * Synthesizes the Process-Requirements Matrix from the latest Turtle diagram process cards
 * and mapped Customer-Specific Requirements (CSR).
 */
export function generateProcessRequirementsMatrix(): DocItem[] {
  // 1. Fetch Turtle diagrams / Process cards defined under clause 4.4
  let turtleItems: DocItem[] = [];
  const sourceKeys = [
    'iatf_draft_items_شناسنامه فرآیندها (Process Cards - Turtle)',
    'iatf_draft_items_شناسنامه فرآیندها',
    'iatf_draft_items_لاک‌پشتی فرایندها (Turtle Diagrams)'
  ];
  
  for (const key of sourceKeys) {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          turtleItems = parsed;
          break;
        }
      } catch (e) {
        console.warn('Failed parsing raw turtle items for matrix generation:', e);
      }
    }
  }
  
  // Fallback: If localStorage is empty, try to fetch from custom documents or default
  if (turtleItems.length === 0) {
    try {
      const qmsdbPrefix = 'qmsdb_v3_';
      const rawDb = localStorage.getItem(`${qmsdbPrefix}documents_table`);
      if (rawDb) {
        const dbDocs = JSON.parse(rawDb);
        const turtleDoc = dbDocs['شناسنامه فرآیندها (Process Cards - Turtle)'] || 
                          dbDocs['شناسنامه فرآیندها'] || 
                          dbDocs['لاک‌پشتی فرایندها (Turtle Diagrams)'];
        if (Array.isArray(turtleDoc) && turtleDoc.length > 0) {
          turtleItems = turtleDoc;
        }
      }
    } catch {}
  }
  
  // If still empty, return layout with no rows
  if (turtleItems.length === 0) {
    return [];
  }

  // Try to load any existing Process-Requirements Matrix items to merge changes seamlessly!
  let existingMatrixItems: DocItem[] = [];
  const matrixKeys = [
    'iatf_draft_items_ماتریس فرآیندها-الزامات',
    'iatf_draft_items_ماتریس فرآیندها-الزامات (Process-Requirements Matrix)'
  ];
  for (const key of matrixKeys) {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          existingMatrixItems = parsed;
          break;
        }
      } catch {}
    }
  }
  if (existingMatrixItems.length === 0) {
    try {
      const qmsdbPrefix = 'qmsdb_v3_';
      const rawDb = localStorage.getItem(`${qmsdbPrefix}documents_table`);
      if (rawDb) {
        const dbDocs = JSON.parse(rawDb);
        const matrixDoc = dbDocs['ماتریس فرآیندها-الزامات'] || dbDocs['ماتریس فرآیندها-الزامات (Process-Requirements Matrix)'];
        if (Array.isArray(matrixDoc) && matrixDoc.length > 0) {
          existingMatrixItems = matrixDoc;
        }
      }
    } catch {}
  }
  
  // 2. Fetch IATF Standard clauses (flattened)
  const allClauses = flattenIatfClauses(iatfData);
  
  // 3. Fetch CSR items
  let csrItems: CsrComparisonItem[] = [];
  try {
    const rawCsr = localStorage.getItem('iatf_csr_comparisons');
    if (rawCsr) {
      csrItems = JSON.parse(rawCsr);
    }
  } catch {}

  // Try to load manual clause overrides from QmsDatabase standard relational tables
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
  } catch {}

  // 4. Construct merged matrix rows based on turtle processes
  return turtleItems.map((proc, index) => {
    const procName = (proc.field1 || '').trim();
    
    // Check if we already have a matching row by process name (case/whitespace-insensitive)
    const existing = existingMatrixItems.find(item => (item.field1 || '').trim().toLowerCase() === procName.toLowerCase());
    
    if (existing) {
      // Re-calculate the dynamically updated fields if needed, but preserve standard edits!
      return {
        ...existing,
        id: existing.id || proc.id || `pmx-${index + 1}`,
        field2: proc.processType || proc.field2 || existing.field2 || 'COPs', // sync type
        field5: proc.field7 || existing.field5 || 'تعریف نشده', // sync KPI
        clauseId: proc.clauseId || existing.clauseId || '4.4'
      };
    }
    
    // Otherwise, generate a fresh new row for this new process
    const procClauseExpr = proc.clauseId || '4.4';
    const procKey = proc.id || proc.field1;
    const manualClauses = manualMappings[procKey] || manualMappings[proc.field1];
    
    // Find associated standard clauses (respect manual mappings if they exist)
    const matchedClauses = (manualClauses && Array.isArray(manualClauses))
      ? allClauses.filter(clause => manualClauses.includes(clause.id))
      : allClauses.filter(clause => isClauseAssociated(clause.id, procClauseExpr));
    
    // Find associated CSR items mapped to any of the matched standard clauses
    const matchedClauseIds = matchedClauses.map(c => c.id);
    const matchedCsrs = csrItems.filter(csr => 
      csr.mappedIatfClauseId && matchedClauseIds.includes(csr.mappedIatfClauseId)
    );
    
    // Format IATF clause descriptions list
    const iatfTextList = matchedClauses.map(c => 
      `بند ${c.id}: ${c.title}`
    );
    const iatfText = iatfTextList.length > 0 
      ? iatfTextList.join(' | ') 
      : `بند ${procClauseExpr} (تعریف نشده در درخت)`;
      
    // Format CSR description list
    const csrTextList = matchedCsrs.map(c => {
      const docLabel = c.documentTitle ? `[${c.documentTitle}] ` : '';
      return `${docLabel}بند ${c.customerNumber || 'نامشخص'}: ${c.customerTitle || c.customerText?.substring(0, 30) || ''}`;
    });
    const csrText = csrTextList.length > 0
      ? csrTextList.join(' | ')
      : 'الزام خاص مشتری یافت نشد (آماده همگام‌سازی)';

    // Determine type label
    const procType = proc.processType || 'COPs';

    return {
      id: proc.id || `pmx-${index + 1}`,
      field1: procName || 'فرآیند بدون نام', // Process Name
      field2: procType, // Process Type
      field3: iatfText, // Matched standard tree clauses
      field4: csrText, // Associated CSR requirements
      field5: proc.field7 || 'تعریف نشده', // KPI
      field6: matchedCsrs.length > 0 ? 'مطبق با الزامات خاص و عمومی' : 'منطبق با الزامات مرجع IATF',
      clauseId: procClauseExpr
    };
  });
}

/**
 * Dynamically maps a standard IATF clause ID to automotive checklist questions
 */
function getQuestionsForIatfClause(clauseId: string, processName: string): { question: string; guide: string }[] {
  const c = clauseId.trim();

  if (c.startsWith('4.4') || c === '4.4') {
    return [
      {
        question: `آیا شناسنامه فرآیند (کارت لاک‌پشتی) برای «${processName}» تعریف شده و ورودی‌ها، خروجی‌ها تدوین و پایش مستمر می‌شوند؟`,
        guide: 'بررسی فیزیکی شناسنامه فرآیند، نمودار جریان اطلاعات و تایید آخرین نسخه سند سیستم.'
      },
      {
        question: `آیا ریسک‌ها و فرصت‌های فرآیند «${processName}» شناسایی شده و اقدامات مهارتی آن ارزیابی می‌گردد؟`,
        guide: 'بررسی ثبت در رجیستر ریسک‌های سازمانی، انطباق مفاد FMEA با سوابق اجرایی تولید.'
      }
    ];
  }

  if (c.startsWith('5.1') || c === '5.1' || c.startsWith('5.3')) {
    return [
      {
        question: `آیا خط‌مشی کیفیت و اهداف استراتژیک واحد «${processName}» توسط مدیریت ارشد ابلاغ شده و پرسنل آگاهی دارند؟`,
        guide: 'مصاحبه با پرسنل کارگاه، کنترل آگاهی پرسنلی از اهداف خرد دپارتمان.'
      }
    ];
  }

  if (c.startsWith('6.1') || c === '6.1' || c.startsWith('6.2') || c === '6.2') {
    return [
      {
        question: `آیا برنامه‌های دستیابی به اهداف کیفیت برای فرآیند «${processName}» تدوین شده و درصد تحقق آن ارزیابی می‌گردد؟`,
        guide: 'مشاهده فرم پایش اهداف خرد دپارتمان و واکاوی نمودارها.'
      }
    ];
  }

  if (c.startsWith('7.1.5') || c === '7.1.5') {
    return [
      {
        question: `آیا تمام تجهیزات اندازه‌گیری و پایش مورد استفاده در فرآیند «${processName}» دارای کالیبراسیون نافذ هستند؟`,
        guide: 'بازبینی کد فیزیکی ابزار ممیزی شده (میکرومتر، کولیس) و انطباق با کارت ثبت کالیبراسیون.'
      }
    ];
  }

  if (c.startsWith('7.2') || c === '7.2' || c.startsWith('7.3') || c === '7.3') {
    return [
      {
        question: `آیا سوابق آموزشی و صلاحیت پرسنل کلیدی و اپراتورهای فرآیند «${processName}» طبق الزامات مکتوب احراز شده است؟`,
        guide: 'بازبینی پرونده تست مهارت اپراتور، تطابق با نیازسنجی صلاحیت سالانه.'
      }
    ];
  }

  if (c.startsWith('7.5') || c === '7.5') {
    return [
      {
        question: `آیا نسخ معتبر فرآیندی و فرم‌های پر شده در واحد «${processName}» مطابق آخرین ویرایش جدول کنترل مدارک است؟`,
        guide: 'کنترل انطباق شماره ویرایش فرم‌ها با هدر مدارک در پرتال تضمین کیفیت.'
      }
    ];
  }

  if (c.startsWith('8.1') || c === '8.1' || c.startsWith('8.2') || c === '8.2') {
    return [
      {
        question: `آیا الزامات مشتری مکتوب (CSR) مرتبط با فرآیند «${processName}» شناسایی شده و در دپارتمان استفاده می‌شود؟`,
        guide: 'کنترل نسخه مکتوب الزامات خودرویی و نحوه انطباق با چک لیست بازنگری فنی.'
      }
    ];
  }

  if (c.startsWith('8.3') || c === '8.3') {
    return [
      {
        question: `آیا مستندات طراحی یا تغییرات مهندسی دپارتمان «${processName}» به تایید معتبر مشتری (AAR/PSW/S-PAS) رسیده است؟`,
        guide: 'کنترل پرونده APQP قطعه، زمان اعمال تغییر و اصالت امضای مشتری خودرویی.'
      }
    ];
  }

  if (c.startsWith('8.4') || c === '8.4') {
    return [
      {
        question: `آیا ارزیابی دوره‌ای زنجیره تامین و تامین‌کنندگان فرآیند «${processName}» بر اساس گریدهای کیفی خودرویی انجام می‌گیرد؟`,
        guide: 'بررسی گزارش ممیزی تامین‌کنندگان خط، نتایج ارزیابی گرید دوره‌ای پیمانکاران.'
      }
    ];
  }

  if (c.startsWith('8.5.1') || c === '8.5.1' || c === '8.5') {
    return [
      {
        question: `آیا طرح کنترلی (Control Plan) فرآیند «${processName}» در ایستگاه‌ها مستقر شده و اپراتورها مطابق آن پایش می‌کنند؟`,
        guide: 'مشاهده طرح کنترلی در محل کارگاه، انطباق نحوه تکمیل کاربرگ پایش فرآیند توسط شیفت.'
      },
      {
        question: `آیا شرایط نگهداری فیزیکی، ردیابی و انبار تخصصی قطعات در حین تولید فرآیند «${processName}» مطابقت دارد؟`,
        guide: 'کنترل برچسب ردیابی سبد محصولات، برچسب زرد/قرمز ضایعات و انطباق استاندارد لجستیک.'
      }
    ];
  }

  if (c.startsWith('8.5.1.5') || c === '8.5.1.5') {
    return [
      {
        question: `آیا پایش تعمیرات پیشگیرانه فعال (TPM) برای ماشین‌آلات فرآیند «${processName}» اجرا شده و سوابق آن مکتوب است؟`,
        guide: 'بررسی تگ فیزیکی آلومینیومی TPM ماشین‌آلات و ثبت سوابق روغن‌کاری دوره.'
      }
    ];
  }

  if (c.startsWith('8.5.6') || c === '8.5.6' || c.startsWith('8.7') || c === '8.7') {
    return [
      {
        question: `آیا قطعات معیوب و نامنطبق در فرآیند «${processName}» به سرعت ایزوله شده و در قرنطینه قفل‌دار قرار می‌گیرند؟`,
        guide: 'مشاهده بصری قفسه قرنطینه ضایعات دپارتمان تایید شده و کنترل فرم‌های صادر شده.'
      }
    ];
  }

  if (c.startsWith('9.1') || c === '9.1') {
    return [
      {
        question: `آیا مراجع آماری فرآیندی (نمودارهای پایش SPC) در فرآیند «${processName}» ثبت شده و توانمندی فرآیند تحلیل می‌گردد؟`,
        guide: 'رویت نمودارهای میانگین و دامنه تغییرات (X-bar R)، بررسی رویکرد اقدام در نقاط بحرانی.'
      }
    ];
  }

  if (c.startsWith('10.2') || c === '10.2' || c === '10') {
    return [
      {
        question: `آیا سوابق اقدامات اصلاحی صادر شده (کاربرگ 8D) دپارتمان «${processName}» جهت تثبیت اثربخشی پیگیری می‌شود؟`,
        guide: 'بازبینی فرآیند بازخورد اقدامات اصلاحی و زمان نهایی‌سازی گام‌های رفع ریشه‌ای عدم انتباق.'
      }
    ];
  }

  return [
    {
      question: `آیا تطبیق کامل الزامات بند ${clauseId} در جریان روزمره فرآیند «${processName}» صورت می‌گیرد؟`,
      guide: `بررسی شواهد عینی، مصاحبه با متولیان فرآیند و انطباق عملکرد با اهداف بند ${clauseId} استاندارد.`
    }
  ];
}

/**
 * Helper to check if two standard IATF clause IDs are hierarchical relatives (equal or ancestor/descendant relationship)
 */
export function areClausesRelated(c1: string, c2: string): boolean {
  const norm1 = c1.trim();
  const norm2 = c2.trim();
  return norm1 === norm2 || norm1.startsWith(norm2 + '.') || norm2.startsWith(norm1 + '.');
}

/**
 * Dynamically synthesizes the QMS Internal Audit Checklist for all processes combined
 */
export function generateInternalAuditChecklist(): DocItem[] {
  // 1. Fetch Process-Requirements Matrix rows
  let matrixItems: DocItem[] = [];
  const matrixKeys = [
    'iatf_draft_items_ماتریس فرآیندها-الزامات',
    'iatf_draft_items_ماتریس فرآیندها-الزامات (Process-Requirements Matrix)'
  ];

  for (const key of matrixKeys) {
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          matrixItems = parsed;
          break;
        }
      } catch (e) {
        console.warn('Failed parsing raw matrix items for audit generator:', e);
      }
    }
  }

  // Fallback DB
  if (matrixItems.length === 0) {
    try {
      const qmsdbPrefix = 'qmsdb_v3_';
      const rawDb = localStorage.getItem(`${qmsdbPrefix}documents_table`);
      if (rawDb) {
        const dbDocs = JSON.parse(rawDb);
        const matrixDoc = dbDocs['ماتریس فرآیندها-الزامات'] || dbDocs['ماتریس فرآیندها-الزامات (Process-Requirements Matrix)'];
        if (Array.isArray(matrixDoc) && matrixDoc.length > 0) {
          matrixItems = matrixDoc;
        }
      }
    } catch {}
  }

  // Fallback to active runtime generation
  if (matrixItems.length === 0) {
    matrixItems = generateProcessRequirementsMatrix();
  }

  // Load Customer-Specific Requirements (CSR) comparisons to dynamically synch questions
  let csrItems: CsrComparisonItem[] = [];
  try {
    const rawCsr = localStorage.getItem('iatf_csr_comparisons');
    if (rawCsr) {
      csrItems = JSON.parse(rawCsr);
    }
  } catch {}

  // Safe fallback to load real-world dynamic alignments if empty
  if (csrItems.length === 0) {
    csrItems = [
      {
        customerId: "comp-1",
        customerNumber: "بند ۱-۲",
        customerTitle: "ردیابی ذوب قطعات ایمنی ترمز",
        customerText: "کلیه قطعات چدنی ایمنی ترمز دیسک باید تا سطح بچ ذوب ذوب‌آهن ردیابی شوند. شماره بچ و نام کوره بایستی بر روی پیشانی قطعه به صورت دائم حکاکی چشمی‌گردد و مغایرت بین مستندات و قطعه فیزیکی خط قرمز است.",
        mappedIatfClauseId: "8.5.2.1",
        alignmentScore: 92,
        status: "fully_aligned",
        comparisonText: "این الزام ارزیابی گردید. فرآیند ردیابی بچ‌های ذوب در فرم شناسنامه فرآیند تولید و تکوین گنجانده شده و سوابق بچ‌ها در برگه سوابق ممیزی به طور کامل ثبت می‌شود. سیستم بچ‌نامبرینگ قالب‌ها کاملاً منطبق است.",
        documentId: "sapco-trace",
        documentTitle: "الزامات خاص ساپکو"
      },
      {
        customerId: "comp-2",
        customerNumber: "بند ۲-۱",
        customerTitle: "سیستم‌های خطاناشدنی‌سازی پوکایوکه",
        customerText: "سیستم‌های خطاناشدنی‌سازی (Poka-Yoke) فیزیکی باید برای کلیه فرآیندهای پرسکاری و دایکست قطعات تعلیق نصب شوند. سنسورهای پوکایوکه باید در شروع هر شیفت با استفاده از کیت نمونه خراب (Red rabbit) تست و سوابق آن بایستی بیش از ۱۰ سال آرشیو گردد.",
        mappedIatfClauseId: "10.2.4",
        alignmentScore: 88,
        status: "partially_aligned",
        comparisonText: "سیستم خطاناشدنی‌سازی فیزیکی بر روی قالب‌های دایکست و پرسکاری مستقر است، لکن دستورالعمل کارکرد آزمون روزانه به همراه نمونه کیت‌های خراب (Red Rabbit) در ایستگاه‌های کارگاهی نیاز به بازنگری دارد و بایستی پایش پایداری آن در چک‌لیست ممیزی داخلی لحاظ گردد.",
        documentId: "saipa-poka",
        documentTitle: "الزامات خاص سایپا"
      },
      {
        customerId: "comp-3",
        customerNumber: "بند ۴-۳",
        customerTitle: "تغییرات مهندسی ابزارآلات و سالن سالن تولید",
        customerText: "هرگونه تغییر در قالب، فرآیند، تامین‌کننده ثانویه مواد آلیاژی یا جابجایی سالن تولید فیزیکی با ترانسفر ماشین‌آلات، باید پیش از پیاده‌سازی ارزیابی ریسک با ابزار FMEA شده و از طریق سامانه ECR بهمن‌موتور درخواست و نمونه‌های آزمایشی جدید با تایید مستقیم ممیز بهمن تولید شود.",
        mappedIatfClauseId: "8.5.6.1",
        alignmentScore: 95,
        status: "fully_aligned",
        comparisonText: "فرآیند درخواست مدیریت تغییرات مهندسی (MOC) به طور زنده در سیستم پیاده شده و رکوردهای FMEA مربوط به تغییرات قالب‌ها و فیکسچرهای مونتاژی به تایید بهمن موتور رسیده است.",
        documentId: "bahman-motor",
        documentTitle: "الزامات خاص گروه بهمن"
      }
    ];
  }

  const checklist: DocItem[] = [];
  let idCounter = 1;

  for (const proc of matrixItems) {
    const processName = proc.field1 || 'فرآیند بدون نام';
    const iatfClausesText = proc.field3 || '';
    const clauseIdStr = proc.clauseId || '';

    // Parse all clause IDs
    const clauses: string[] = [];
    const regex = /\b\d+(\.\d+)+\b/g;
    let match;
    const searchSource = clauseIdStr + ' ' + iatfClausesText;
    while ((match = regex.exec(searchSource)) !== null) {
      if (!clauses.includes(match[0])) {
        clauses.push(match[0]);
      }
    }

    // Default general check
    if (clauses.length === 0) {
      clauses.push('4.4.1');
    }

    // Accumulate checklist rows for each process and its clause IDs
    for (const clauseId of clauses) {
      // 1. Standard IATF questions
      const questions = getQuestionsForIatfClause(clauseId, processName);
      for (const q of questions) {
        checklist.push({
          id: `aud-${idCounter++}`,
          field1: processName, // Process Name
          field2: `بند ${clauseId}`, // Associated Clause
          field3: q.question, // Audit Question
          field4: q.guide, // Auditor Guide
          field5: 'منطبق (C)', // Default compliance verdict
          field6: 'در دست ممیزی میدانی - شواهد و نمونه‌گیری انجام خواهد شد', // default notes
          clauseId: clauseId
        });
      }

      // 2. Mapped Customer-Specific Requirements questions (CSR)
      const matchedCsrs = csrItems.filter(csr => 
        csr.mappedIatfClauseId && areClausesRelated(csr.mappedIatfClauseId, clauseId)
      );

      for (const csr of matchedCsrs) {
        const docLabel = csr.documentTitle ? ` [الزام خاص ${csr.documentTitle}]` : ' [الزام خاص مشتری]';
        checklist.push({
          id: `aud-${idCounter++}`,
          field1: processName, // Process Name
          field2: `بند ${clauseId}${docLabel}`, // Associated Clause (with CSR indicator)
          field3: `آیا الزامات خاص مکتوب بند ${csr.customerNumber || 'نامشخص'} (${csr.customerTitle || 'بدون عنوان'}) در فرآیند «${processName}» پایش و رعایت می‌شود؟`,
          field4: `بررسی شواهد انطباق با سند مرجع مشتری: "${csr.customerTitle || ''}". اصل الزام: ${csr.customerText || ''}`,
          field5: 'منطبق (C)', // Default compliance verdict
          field6: `بررسی شواهد الزامات خاص مشتری (${csr.documentTitle || 'مشتری'}) انجام خواهد شد.`,
          clauseId: clauseId
        });
      }
    }
  }

  return checklist;
}
