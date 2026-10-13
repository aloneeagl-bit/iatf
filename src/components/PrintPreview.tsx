/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ColumnDefinition, DocumentTable } from './DocumentEditor';
import { DocTemplate, DocItem } from '../data/documentTemplates';
import { Printer, X, Sliders, Info, CheckCircle2, Sparkles, Cpu, Download, FileSpreadsheet, FileText, Image, Calendar, Layout, Settings } from 'lucide-react';
import { useState, useMemo } from 'react';
import { uiTranslations } from '../lib/translations';
import { QmsDatabase } from '../lib/qmsDatabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  template: DocTemplate;
  columns: ColumnDefinition[];
  items: DocItem[];
  sections?: DocumentTable[];
  lang: 'fa' | 'en';
  swotMode?: 'visual' | 'table';
  turtleMode?: 'visual' | 'table';
  processMapMode?: 'visual' | 'table';
}

export default function PrintPreview({ 
  isOpen, 
  onClose, 
  template, 
  columns, 
  items, 
  sections,
  lang,
  swotMode = 'visual',
  turtleMode = 'visual',
  processMapMode = 'visual'
}: Props) {
  const [rowsPerPage, setRowsPerPage] = useState<number>(8);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [fontSize, setFontSize] = useState<number>(10);
  const isRtl = lang === 'fa';
  const t = uiTranslations[lang];

  const getShamsiDate = () => {
    try {
      return new Intl.DateTimeFormat('fa-IR-u-ca-persian', { dateStyle: 'long' }).format(new Date());
    } catch (e) {
      return "۲۲ خرداد ۱۴۰۵";
    }
  };

  const getGregorianDate = () => {
    try {
      return new Date().toISOString().split('T')[0];
    } catch (e) {
      return "2026-06-11";
    }
  };

  const [headerFooterConfig, setHeaderFooterConfig] = useState({
    showHeader: true,
    showFooter: true,
    logoType: 'preset_iatf', // 'preset_iatf' | 'preset_iso' | 'upload' | 'none'
    uploadedLogoUrl: '',
    customTitle: '',
    subTitle: isRtl ? 'ساختار پایش یکپارچه منطبق بر الزامات ممیزی ارشد خودرو IATF 16949:2016' : 'Integrated QMS dashboard mapped to IATF 16949:2016 Automotive Specific Limits',
    docCode: 'IATF-QMR-16949',
    showShamsiDate: true,
    showGregorianDate: true,
    customShamsiDate: getShamsiDate(),
    customGregorianDate: getGregorianDate(),
    customFooterText: isRtl ? 'این سند ممیزی به صورت مکانیزه با کالیبراسیون و فرم محاسباتی هوشمند پدیده ثبت شده است.' : 'This audit document is logged with integrated quality algorithms.',
    showSignatures: true,
    showPageNumbers: true,
    logoSize: 45
  });

  const [isCustomizePanelOpen, setIsCustomizePanelOpen] = useState(true);

  const isProcessMap = useMemo(() => {
    return template.title.toLowerCase().includes('process map') || 
           template.title.includes('نقشه فرایند') || 
           template.title.includes('نقشه فرآیند');
  }, [template.title]);

  const isSwotVisual = useMemo(() => template.smartType === 'SWOT' && swotMode === 'visual', [template.smartType, swotMode]);
  const isTurtleVisual = useMemo(() => template.smartType === 'TURTLE' && turtleMode === 'visual', [template.smartType, turtleMode]);
  const isProcessMapVisual = useMemo(() => isProcessMap && processMapMode === 'visual', [isProcessMap, processMapMode]);

  const maxCoords = useMemo(() => {
    let maxX = 800;
    let maxY = 500;
    items.forEach(node => {
      if (node.x && node.x > maxX) maxX = node.x;
      if (node.y && node.y > maxY) maxY = node.y;
    });
    return { x: maxX + 160, y: maxY + 100 };
  }, [items]);

  // Load Turtle processes defined under standard turtle document templates
  const turtleProcesses = useMemo(() => {
    let list: string[] = [];
    try {
      const docTitles = [
        'شناسنامه فرآیندها (Process Cards - Turtle)',
        'شناسنامه فرآیندها',
        'لاک‌پشتی فرایندها (Turtle Diagrams)'
      ];
      for (const title of docTitles) {
        const rows = QmsDatabase.selectRow<any[]>('documents_table', title);
        if (Array.isArray(rows) && rows.length > 0) {
          list = rows.map(p => p.field1 || '').filter(Boolean);
          if (list.length > 0) break;
        }
      }
    } catch (e) {
      console.warn('QmsDatabase selectRow failed for شناسنامه فرآیندها:', e);
    }

    if (list.length === 0) {
      try {
        const qmsdbPrefix = 'qmsdb_v3_';
        const rawDb = localStorage.getItem(`${qmsdbPrefix}documents_table`);
        if (rawDb) {
          const dbDocs = JSON.parse(rawDb);
          const turtleDoc = dbDocs['شناسنامه فرآیندها (Process Cards - Turtle)'] || 
                            dbDocs['شناسنامه فرآیندها'] || 
                            dbDocs['لاک‌پشتی فرایندها (Turtle Diagrams)'];
          if (Array.isArray(turtleDoc)) {
            list = turtleDoc.map(p => p.field1 || '').filter(Boolean);
          }
        }
      } catch {}
    }

    if (list.length === 0) {
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
              list = parsed.map(p => p.field1 || '').filter(Boolean);
              break;
            }
          } catch {}
        }
      }
    }
    const uniq = Array.from(new Set(list.map(name => name.trim()).filter(Boolean)));
    return uniq.length > 0 ? uniq : ['فرآیند تولید عمومی'];
  }, []);

  // Divide items into pages based on user selection
  const pagesData = useMemo(() => {
    // If multiple sections are provided, flatten them into printable pages
    if (sections && sections.length > 0) {
      const allPages: Array<{ 
        sectionName: string; 
        items: DocItem[]; 
        columns: ColumnDefinition[]; 
        pageIdx: number; 
        totalPages: number;
        isSectionStart: boolean;
      }> = [];
      
      sections.forEach((section) => {
        const sectionItems = section.items;
        const sectionCols = section.columns || columns;
        const sectionChunks: DocItem[][] = [];
        
        if (template.smartType === 'SWOT' && swotMode === 'visual') {
          sectionChunks.push(sectionItems);
        } else if (template.smartType === 'TURTLE' && turtleMode === 'visual') {
          sectionItems.forEach(item => sectionChunks.push([item]));
          if (sectionItems.length === 0) sectionChunks.push([]);
        } else {
          for (let i = 0; i < sectionItems.length; i += rowsPerPage) {
            sectionChunks.push(sectionItems.slice(i, i + rowsPerPage));
          }
          if (sectionItems.length === 0) sectionChunks.push([]);
        }
        
        sectionChunks.forEach((chunk, idx) => {
          allPages.push({
            sectionName: section.name,
            items: chunk,
            columns: sectionCols,
            pageIdx: idx + 1,
            totalPages: sectionChunks.length,
            isSectionStart: idx === 0
          });
        });
      });
      return allPages;
    }

    if (template.smartType === 'RISK_MANAGEMENT') {
      return turtleProcesses.map((proc, idx) => ({
        sectionName: proc,
        items: items.filter(i => i.associatedProcess === proc || i.field7 === proc),
        columns: columns,
        pageIdx: 1,
        totalPages: 1,
        isSectionStart: true,
        isLegacyRisk: true
      }));
    }
    if (isSwotVisual) {
      return [{ sectionName: '', items, columns, pageIdx: 1, totalPages: 1, isSectionStart: true }];
    }
    if (isTurtleVisual) {
      return (items.length > 0 ? items.map((item, idx) => ({ sectionName: '', items: [item], columns, pageIdx: idx + 1, totalPages: items.length, isSectionStart: idx === 0 })) : [{ sectionName: '', items: [], columns, pageIdx: 1, totalPages: 1, isSectionStart: true }]);
    }
    if (isProcessMapVisual) {
      return [{ sectionName: '', items, columns, pageIdx: 1, totalPages: 1, isSectionStart: true }];
    }
    const chunks: any[] = [];
    for (let i = 0; i < items.length; i += rowsPerPage) {
      chunks.push({
        sectionName: '',
        items: items.slice(i, i + rowsPerPage),
        columns: columns,
        pageIdx: Math.floor(i / rowsPerPage) + 1,
        totalPages: Math.ceil(items.length / rowsPerPage),
        isSectionStart: i === 0
      });
    }
    if (chunks.length === 0) {
      chunks.push({ sectionName: '', items: [], columns, pageIdx: 1, totalPages: 1, isSectionStart: true });
    }
    return chunks;
  }, [sections, items, columns, rowsPerPage, isSwotVisual, isTurtleVisual, isProcessMapVisual, template.smartType, turtleProcesses, swotMode, turtleMode]);

  const swotAnalysis = useMemo(() => {
    let sScore = 0;
    let wScore = 0;
    let oScore = 0;
    let tScore = 0;
    
    items.forEach(item => {
      const score = (item.weight || 0) * (item.rating || 0);
      if (item.type === 'S') sScore += score;
      else if (item.type === 'W') wScore += score;
      else if (item.type === 'O') oScore += score;
      else if (item.type === 'T') tScore += score;
    });

    let strategyTitle = '';
    let strategyClass = '';
    let strategyDesc = '';

    if (lang === 'fa') {
      if (sScore >= wScore && oScore >= tScore) {
        strategyTitle = 'استراتژی تهاجمی (SO - Maxi-Maxi)';
        strategyClass = 'bg-green-50 text-green-800 border-green-200';
        strategyDesc = 'تمرکز بر پیوند نقاط قوت داخلی با فرصت‌های محیط بیرونی. با اتکیه بر تیم تحقیق و توسعه ماهر کارخانه و هم‌راستایی لجستیکی مطلوب با ساپکو، ظرفیت‌های خالی را ارتقا داده و سهم بالایی از بازار تعلیق اوراسیا را فتح کنید.';
      } else if (sScore >= wScore && oScore < tScore) {
        strategyTitle = 'استراتژی رقابتی (ST - Maxi-Mini)';
        strategyClass = 'bg-amber-50 text-amber-800 border-amber-250';
        strategyDesc = 'به کارگیری توان مهندسی بومی جهت مهار و خنثی‌سازی تهدیدهای خارجی. سازمان باید زنجیره تامین ورق آلیاژی خودروساز را با تکیه بر خودکفایی و پورتال مهار و کنترل نوسانات، در برابر افت تیراژ ناگهانی ایمن سازد.';
      } else if (sScore < wScore && oScore >= tScore) {
        strategyTitle = 'استراتژی تجدید نظر (WO - Mini-Maxi)';
        strategyClass = 'bg-blue-50 text-blue-800 border-blue-200';
        strategyDesc = 'برطرف کردن نقاط ضعف داخلی به منظور بهره‌گیری مقتدر از فرصت‌های کلیدی. از سود بالقوه حاصل از مگاموتور یا مشتریان غربی جهت اورهال سریع کوره‌های ریخته‌گری دایکاست و نوسازی قالب‌های پرس استفاده کنید.';
      } else {
        strategyTitle = 'استراتژی تدافعی (WT - Mini-Mini)';
        strategyClass = 'bg-red-50 text-red-800 border-red-200';
        strategyDesc = 'کاهش نقاط ضعف داخلی و گریز از تهدیدهای ملموس بیرونی (بحرانی‌ترین سناریو). نوسازی فوری قالب‌ها، برپایی سیستم‌های خطاناشدنی‌سازی مته و توقف خواب‌های طولانی خط جهت پایداری تعهد خودروساز ضروری است.';
      }
    } else {
      if (sScore >= wScore && oScore >= tScore) {
        strategyTitle = 'Aggressive Strategy (SO - Maxi-Maxi)';
        strategyClass = 'bg-green-50 text-green-800 border-green-200';
        strategyDesc = 'Use internal strengths to capture outer opportunities. Deploy skilled local engineering to utilize assembly capabilities and aggressively secure Eurasian supply contracts.';
      } else if (sScore >= wScore && oScore < tScore) {
        strategyTitle = 'Competitive Strategy (ST - Maxi-Mini)';
        strategyClass = 'bg-amber-50 text-amber-800 border-amber-250';
        strategyDesc = 'Leverage core engineering assets to shield from outer threats like exchange fluctuations or materials import crises.';
      } else if (sScore < wScore && oScore >= tScore) {
        strategyTitle = 'Turnaround Strategy (WO - Mini-Maxi)';
        strategyClass = 'bg-blue-50 text-blue-800 border-blue-200';
        strategyDesc = 'Focus on upgrading aging machinery (foundry and pressing lines) to capture export margins and stabilize high-margin passenger assembly operations.';
      } else {
        strategyTitle = 'Defensive Strategy (WT - Mini-Mini)';
        strategyClass = 'bg-red-50 text-red-800 border-red-200';
        strategyDesc = 'Critical. Reallocate urgent reserves to secure die upkeep and run contingency processes to prevent supplier penalties or line standstills.';
      }
    }

    return { sScore, wScore, oScore, tScore, strategyTitle, strategyClass, strategyDesc };
  }, [items, lang]);

  const swotAnalysisExtra = useMemo(() => {
    const xVal = swotAnalysis.sScore - swotAnalysis.wScore;
    const yVal = swotAnalysis.oScore - swotAnalysis.tScore;
    const maxVal = 5.0;
    const xPos = 100 + Math.max(-1, Math.min(1, xVal / maxVal)) * 70;
    const yPos = 100 - Math.max(-1, Math.min(1, yVal / maxVal)) * 70;

    let dotColor = '#16a34a';
    let quadName = '';
    const isFa = lang === 'fa';
    if (xVal >= 0 && yVal >= 0) { dotColor = '#16a34a'; quadName = isFa ? 'SO (رشد و توسعه تهاجمی)' : 'SO (Aggressive Expansion)'; }
    else if (xVal >= 0 && yVal < 0) { dotColor = '#d97706'; quadName = isFa ? 'ST (رقابتی و مهار تهدیدها)' : 'ST (Competitive Shielding)'; }
    else if (xVal < 0 && yVal >= 0) { dotColor = '#2563eb'; quadName = isFa ? 'WO (بازنگری و بهبود ضعف‌ها)' : 'WO (Strategic Turnaround)'; }
    else { dotColor = '#dc2626'; quadName = isFa ? 'WT (تدافعی و پایداری بقا)' : 'WT (Defensive Survival)'; }

    return { xVal, yVal, maxVal, xPos, yPos, dotColor, quadName };
  }, [swotAnalysis, lang]);

  const handlePrint = () => {
    window.print();
  };

  const getCellPrintValue = (col: ColumnDefinition, item: DocItem) => {
    const value = item[col.field] ?? '';
    
    if (col.isReadOnly) {
      if (col.id === 'final_score') {
        return ((item.weight || 0) * (item.rating || 0)).toFixed(2);
      } else if (col.id === 'rpn') {
        return (item.severity || 1) * (item.occurrence || 1) * (item.detection || 1);
      } else if (col.id === 'measured_error') {
        return Math.abs(Number(item.readValue || 0) - Number(item.refValue || 0)).toFixed(4);
      } else if (col.id === 'calibration_status') {
        const errorVal = Math.abs(Number(item.readValue || 0) - Number(item.refValue || 0));
        const mpe = Number(item.mpe || 0.001);
        if (errorVal <= mpe) {
          return isRtl ? 'بر اساس تولرانس (Pass)' : 'Within Tolerance (Pass)';
        } else {
          return isRtl ? 'نامنطبق (Fail)' : 'Out of Tolerance (Fail)';
        }
      } else if (col.id === 'kpi_rate') {
        const target = Number(item.target || 0);
        const actual = Number(item.actual || 0);
        let rate = 0;
        if (target > 0) {
          const isPPM = item.unit === 'PPM' || 
            (item.field1 && item.field1.includes('PPM')) || 
            (item.field1 && item.field1.includes('ضایعات')) || 
            (item.field1 && item.field1.includes('خرابی')) ||
            (item.field1 && item.field1.toLowerCase().includes('scrap')) ||
            (item.field1 && item.field1.toLowerCase().includes('defect'));

          if (isPPM) {
            rate = actual <= target ? 100 : (target / actual) * 100;
          } else {
            rate = (actual / target) * 100;
          }
          if (rate > 100) rate = 100;
        }
        return `${rate.toFixed(1)}%`;
      } else if (col.id === 'spc_stats') {
        const vals = (item.measurements || '').split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
        if (vals.length >= 3) {
          const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
          const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (vals.length - 1);
          const sigma = Math.sqrt(variance);
          return isRtl 
            ? `میانگین: ${mean.toFixed(2)} | انحراف: ${sigma.toFixed(3)}`
            : `Mean: ${mean.toFixed(2)} | StdDev: ${sigma.toFixed(3)}`;
        }
        return isRtl ? 'داده ناکافی' : 'Insufficient Data';
      } else if (col.id === 'spc_cpk') {
        const vals = (item.measurements || '').split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
        if (vals.length >= 3) {
          const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
          const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (vals.length - 1);
          const sigma = Math.sqrt(variance);
          if (sigma > 0) {
            const usl = Number(item.usl || 0);
            const lsl = Number(item.lsl || 0);
            const cpu = (usl - mean) / (3 * sigma);
            const cpl = (mean - lsl) / (3 * sigma);
            const cpk = Math.min(cpu, cpl);
            return `Cp: ${( (usl - lsl) / (6 * sigma) ).toFixed(2)} | Cpk: ${cpk.toFixed(2)}`;
          }
        }
        return 'N/A';
      }
    }

    if (col.type === 'select') {
      const match = (col.options || []).find(o => o.value === value);
      if (match) {
        return match.label;
      }
    }

    return value;
  };

  if (!isOpen) return null;

  // Localized template title & description for printing
  const templateTitleMap: Record<string, string> = {
    'ماتریس SWOT سازمان': 'SWOT Analysis Matrix',
    'سجل مخاطرات و ریسک‌های فرایندها (FMEA)': 'Process Failure Modes & Effects Analysis (FMEA) Register',
    'سوابق کالیبراسیون و پایش تجهیزات تست': 'Instrument Calibration & Traceability Ledger',
    'پایش و اندازه‌گیری شاخص‌های عملکردی ممیزی (KPI)': 'Key Performance Indicators (KPI) Audit Tracker',
    'اندازه‌گیری پایداری و توانمندی فرایند (SPC)': 'Statistical Process Control (SPC) Capability Studies',
    'طرح کنترلی خط تولید (Control Plan)': 'Manufacturing Quality Control Plan (Control Plan)',
    'کاربرگ جامع حل مسئله به روش 8D': '8D Comprehensive Problem Solving Worksheet',
    'لیست ذینفعان و انتظارات کیفی آن‌ها': 'Stakeholder Needs & QMS Quality Expectations'
  };

  const printTitle = isRtl ? template.title : (templateTitleMap[template.title] || template.title);

  const downloadExcel = () => {
    let headersHtml = columns.map(col => `<th>${col.label}</th>`).join('');
    let rowsHtml = items.map((item, idx) => {
      let cells = columns.map(col => `<td>${getCellPrintValue(col, item)}</td>`).join('');
      return `<tr><td>${idx + 1}</td>${cells}</tr>`;
    }).join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="text/plain; charset=UTF-8"/>
        <style>
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #000; padding: 6px; text-align: ${isRtl ? 'right' : 'left'}; font-family: Tahoma, Arial; font-size: 10pt; }
          th { background-color: #f2f2f2; font-weight: bold; }
        </style>
      </head>
      <body>
        <h3>${headerFooterConfig.customTitle || printTitle}</h3>
        <p>${headerFooterConfig.subTitle}</p>
        <table>
          <thead>
            <tr><th>${isRtl ? 'ردیف' : 'No.'}</th>${headersHtml}</tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template.title.replace(/\s+/g, '_')}_export.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadWord = () => {
    let logoImgTag = '';
    if (headerFooterConfig.logoType === 'preset_iatf') {
      logoImgTag = `<div style="font-weight:bold; color:#D97706; font-size:16pt; font-family:Impact,sans-serif;">IATF</div>`;
    } else if (headerFooterConfig.logoType === 'preset_iso') {
      logoImgTag = `<div style="font-weight:bold; color:#2563EB; font-size:16pt; font-family:Impact,sans-serif;">ISO 9001</div>`;
    } else if (headerFooterConfig.logoType === 'upload' && headerFooterConfig.uploadedLogoUrl) {
      logoImgTag = `<img src="${headerFooterConfig.uploadedLogoUrl}" style="max-height:45px; max-width:120px;" />`;
    }

    const pagesHtml = pagesData.map((page: any, pageIdx) => {
      if (page.isLegacyRisk) {
        const procName = page.sectionName;
        const contextRows = items.filter(idx => idx.type === 'context' && (idx.associatedProcess === procName || idx.field7 === procName));
        const riskRows = items.filter(idx => idx.type === 'risk_and_opp' && (idx.associatedProcess === procName || idx.field7 === procName));

        const contextTrs = contextRows.length === 0 ? `<tr><td colspan="6" style="text-align:center; color:#999; font-style:italic;">ردیف موقعیت ثبت نگردیده است.</td></tr>` : contextRows.map((cr, idx) => `
          <tr>
            <td style="text-align:center; border:1px solid #000; padding:6px;">${idx + 1}</td>
            <td style="border:1px solid #000; padding:6px; text-align:right;">${cr.field1 || ''}</td>
            <td style="border:1px solid #000; padding:6px; text-align:right;">${cr.field2 || ''}</td>
            <td style="border:1px solid #000; padding:6px; text-align:right;">${cr.field3 || ''}</td>
            <td style="border:1px solid #000; padding:6px; text-align:right;">${cr.field4 || ''}</td>
            <td style="border:1px solid #000; padding:6px; text-align:right;">${cr.field5 || ''}</td>
          </tr>
        `).join('');

        const riskTrs = riskRows.length === 0 ? `<tr><td colspan="12" style="text-align:center; color:#999; font-style:italic;">هیچ ریسک یا فرصتی ثبت نگردیده است.</td></tr>` : riskRows.map((rr, idx) => {
          const o1 = Number(rr.numeric1 || 1);
          const s1 = Number(rr.numeric2 || 1);
          const rpn1 = o1 * s1;
          const o2 = Number(rr.numeric4 || 1);
          const s2 = Number(rr.numeric5 || 1);
          const rpn2 = o2 * s2;
          return `
            <tr>
              <td style="text-align:center; border:1px solid #000; padding:6px;">${idx + 1}</td>
              <td style="text-align:center; border:1px solid #000; padding:6px; font-weight:bold; color:#B45309;">${rr.clauseId || '--'}</td>
              <td style="border:1px solid #000; padding:6px; text-align:right;">${rr.field1 || ''}</td>
              <td style="text-align:center; border:1px solid #000; padding:6px;">${o1}</td>
              <td style="text-align:center; border:1px solid #000; padding:6px;">${s1}</td>
              <td style="text-align:center; border:1px solid #000; padding:6px; font-weight:bold;">${rpn1}</td>
              <td style="border:1px solid #000; padding:6px; text-align:right;">${rr.actions || rr.field3 || ''}</td>
              <td style="text-align:center; border:1px solid #000; padding:6px;">${o2}</td>
              <td style="text-align:center; border:1px solid #000; padding:6px;">${s2}</td>
              <td style="text-align:center; border:1px solid #000; padding:6px; font-weight:bold;">${rpn2}</td>
              <td style="border:1px solid #000; padding:6px; text-align:right;">${rr.field4 || ''}</td>
              <td style="border:1px solid #000; padding:6px; text-align:right;">${rr.field5 || ''}</td>
            </tr>
          `;
        }).join('');

        return `
          <div style="page-break-after:always; margin-bottom:40px;">
            <!-- Header block -->
            ${headerFooterConfig.showHeader ? `
            <table style="width:100%; border:2px solid #000; margin-bottom:15px; border-collapse:collapse;">
              <tr>
                <td style="width:25%; border:none; padding:10px; text-align:center; vertical-align:middle;">
                  ${logoImgTag}
                </td>
                <td style="width:50%; border-left:1px solid #ccc; border-right:1px solid #ccc; padding:10px; text-align:center;">
                  <h2 style="font-size:13pt; margin:0; font-family:tahoma, Arial;">${headerFooterConfig.customTitle || printTitle}</h2>
                  <div style="font-size:8.5pt; color:#444; margin-top:4px;">${headerFooterConfig.subTitle}</div>
                </td>
                <td style="width:25%; border:none; padding:10px; font-size:8pt; line-height:1.4;">
                  <div>Doc ID: <b>${headerFooterConfig.docCode}</b></div>
                  ${headerFooterConfig.showShamsiDate ? `<div>Shamsi: <b>${headerFooterConfig.customShamsiDate}</b></div>` : ''}
                  ${headerFooterConfig.showGregorianDate ? `<div>Gregorian: <b>${headerFooterConfig.customGregorianDate}</b></div>` : ''}
                  ${headerFooterConfig.showPageNumbers ? `<div>Page: <b>${pageIdx + 1} / ${pagesData.length}</b></div>` : ''}
                </td>
              </tr>
            </table>
            ` : ''}

            <h3 style="font-size:11pt; border-bottom:1px solid #000; padding-bottom:5px; margin-top:10px; text-align:right; direction:rtl;">🛡️ فرآیند: ${procName}</h3>

            <!-- Context Table -->
            <div style="font-size:9.5pt; font-weight:bold; margin-top:15px; margin-bottom:6px; text-align:right; direction:rtl;">۱. شناسنامه و موقعیت فرآیند (Process Context Board)</div>
            <table style="width:100%; border-collapse:collapse; margin-bottom:20px; direction:rtl;">
              <thead>
                <tr style="background-color:#f2f2f2; font-weight:bold;">
                  <th style="border:1px solid #000; padding:6px; width:40px; text-align:center;">No.</th>
                  <th style="border:1px solid #000; padding:6px; text-align:right;">تأمین‌کنندگان</th>
                  <th style="border:1px solid #000; padding:6px; text-align:right;">ورودی‌ها</th>
                  <th style="border:1px solid #000; padding:6px; text-align:right;">فعالیت‌های فرآیند</th>
                  <th style="border:1px solid #000; padding:6px; text-align:right;">خروجی‌ها</th>
                  <th style="border:1px solid #000; padding:6px; text-align:right;">مشتریان</th>
                </tr>
              </thead>
              <tbody>
                ${contextTrs}
              </tbody>
            </table>

            <!-- Risk Register Table -->
            <div style="font-size:9.5pt; font-weight:bold; margin-top:15px; margin-bottom:6px; text-align:right; direction:rtl;">۲. شناسایی و ارزیابی ریسک‌ها و فرصت‌های فرآیند (Risk & Opportunities Register)</div>
            <table style="width:100%; border-collapse:collapse; margin-bottom:20px; direction:rtl;">
              <thead>
                <tr style="background-color:#f2f2f2; font-weight:bold; font-size:8.5pt;">
                  <th style="border:1px solid #000; padding:6px; width:30px; text-align:center;">No.</th>
                  <th style="border:1px solid #000; padding:6px; text-align:center; width:40px;">بند</th>
                  <th style="border:1px solid #000; padding:6px; text-align:right;">مخاطره بالقوه</th>
                  <th style="border:1px solid #000; padding:6px; text-align:center; width:25px;">O1</th>
                  <th style="border:1px solid #000; padding:6px; text-align:center; width:25px;">S1</th>
                  <th style="border:1px solid #000; padding:6px; text-align:center; width:35px;">RPN1</th>
                  <th style="border:1px solid #000; padding:6px; text-align:right;">اقدام مهار ریسک پیشگیرانه</th>
                  <th style="border:1px solid #000; padding:6px; text-align:center; width:25px;">O2</th>
                  <th style="border:1px solid #000; padding:6px; text-align:center; width:25px;">S2</th>
                  <th style="border:1px solid #000; padding:6px; text-align:center; width:35px;">RPN2</th>
                  <th style="border:1px solid #000; padding:6px; text-align:right;">فرصت‌ها</th>
                  <th style="border:1px solid #000; padding:6px; text-align:right;">اقدام فرصت</th>
                </tr>
              </thead>
              <tbody>
                ${riskTrs}
              </tbody>
            </table>

            <!-- Footer Block -->
            ${headerFooterConfig.showFooter ? `
            <table style="width:100%; border-top:1px solid #777; padding-top:10px; border-collapse:collapse; border:none; font-size:8pt; color:#555;">
              <tr>
                <td style="border:none; text-align:${isRtl ? 'right' : 'left'};">
                  ${headerFooterConfig.customFooterText}
                </td>
                ${headerFooterConfig.showSignatures ? `
                <td style="border:none; text-align:${isRtl ? 'left' : 'right'}; font-weight:bold;">
                  ${isRtl ? 'محل امضا و مهر تایید:' : 'Approved/Authorized Signature:'} ___________________
                </td>
                ` : ''}
              </tr>
            </table>
            ` : ''}
          </div>
        `;
      }

      // Default layout
      const currentItems = page.items || [];
      const currentColumns = page.columns || columns;

      let sectionTitleHtml = '';
      if (page.sectionName && page.isSectionStart) {
        sectionTitleHtml = `
          <div style="background-color:#f8fafc; border:2px solid #000; padding:10px; margin-bottom:15px; border-radius:8px; font-weight:bold;">
            ${isRtl ? 'بخش / جدول: ' : 'Section / Table: '} ${page.sectionName}
          </div>
        `;
      }

      let rows = currentItems.map((item: any, localIdx: number) => {
        const globalIdx = (page.pageIdx - 1) * rowsPerPage + localIdx + 1;
        let cells = currentColumns.map((col: any) => `<td style="border:1px solid #000; padding:6px; text-align:${isRtl ? 'right' : 'left'}; font-size:${fontSize}pt;">${getCellPrintValue(col, item)}</td>`).join('');
        return `<tr><td style="text-align:center; border:1px solid #000; padding:6px; font-size:${fontSize}pt;">${globalIdx}</td>${cells}</tr>`;
      }).join('');

      return `
        <div style="page-break-after:always; margin-bottom:40px; font-family:tahoma, Arial;">
          <!-- Header block -->
          ${headerFooterConfig.showHeader ? `
          <table style="width:100%; border:2px solid #000; margin-bottom:15px; border-collapse:collapse;">
            <tr>
              <td style="width:25%; border:none; padding:10px; vertical-align:middle; text-align:center;">
                ${logoImgTag}
              </td>
              <td style="width:50%; border-left:1px solid #ccc; border-right:1px solid #ccc; padding:10px; text-align:center;">
                <h2 style="font-size:13pt; margin:0;">${headerFooterConfig.customTitle || printTitle}</h2>
                <div style="font-size:8.5pt; color:#444; margin-top:4px;">${headerFooterConfig.subTitle}</div>
              </td>
              <td style="width:25%; border:none; padding:10px; font-size:8pt; line-height:1.4;">
                <div>Doc ID: <b>${headerFooterConfig.docCode}</b></div>
                ${headerFooterConfig.showShamsiDate ? `<div>Shamsi: <b>${headerFooterConfig.customShamsiDate}</b></div>` : ''}
                ${headerFooterConfig.showGregorianDate ? `<div>Gregorian: <b>${headerFooterConfig.customGregorianDate}</b></div>` : ''}
                ${headerFooterConfig.showPageNumbers ? `<div>Page: <b>${pageIdx + 1} / ${pagesData.length}</b></div>` : ''}
              </td>
            </tr>
          </table>
          ` : ''}

          ${sectionTitleHtml}

          <!-- Table -->
          <table style="width:100%; border-collapse:collapse; margin-bottom:20px; border:1px solid #000;">
            <thead>
              <tr style="background-color:#f2f2f2; font-weight:bold;">
                <th style="border:1px solid #000; padding:6px; width:40px;">No.</th>
                ${currentColumns.map((col: any) => `<th style="border:1px solid #000; padding:6px; text-align:${isRtl ? 'right' : 'left'}; font-size:${fontSize}pt;">${col.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <!-- Footer Block -->
          ${headerFooterConfig.showFooter ? `
          <table style="width:100%; border-top:1px solid #777; padding-top:10px; border-collapse:collapse; border:none; font-size:8pt; color:#555;">
            <tr>
              <td style="border:none; text-align:${isRtl ? 'right' : 'left'};">
                ${headerFooterConfig.customFooterText}
              </td>
              ${headerFooterConfig.showSignatures ? `
              <td style="border:none; text-align:${isRtl ? 'left' : 'right'}; font-weight:bold;">
                ${isRtl ? 'محل امضا و مهر تایید:' : 'Approved/Authorized Signature:'} ___________________
              </td>
              ` : ''}
            </tr>
          </table>
          ` : ''}
        </div>
      `;
    }).join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <title>${headerFooterConfig.customTitle || printTitle}</title>
        <style>
          @page WordSection1 { size:595.3pt 841.9pt; margin:45.0pt 45.0pt 45.0pt 45.0pt; }
          div.WordSection1 { page:WordSection1; }
          body { direction: ${isRtl ? 'rtl' : 'ltr'}; text-align: ${isRtl ? 'right' : 'left'}; font-family: tahoma, Arial; }
          table { width:100%; border-collapse:collapse; }
          td, th { border: 1px solid #333; padding:6px; font-size:9.5pt; }
          th { font-weight:bold; }
        </style>
      </head>
      <body>
        <div class="WordSection1">
          ${pagesHtml}
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template.title.replace(/\s+/g, '_')}_export.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#070708] select-none" dir={isRtl ? 'rtl' : 'ltr'} id="print-preview-modal">
      {/* Top Controls Bar - Hidden when printing */}
      <div className="bg-[#0D0D0F] border-b border-[#212124] p-4 flex flex-wrap gap-4 items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 rounded-lg text-amber-500 border border-amber-500/20">
            <Printer size={18} />
          </div>
          <div className={isRtl ? 'text-right' : 'text-left'}>
            <h3 className="text-sm font-bold text-white">
              {isRtl ? 'صفحه‌بندی هوشمند و پیش‌نمایش چاپ' : 'Smart Pagination & Print Preview'}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {isRtl ? 'سند با استاندارد رسمی ممیزی‌های زنجیره تامین خودرو IATF منطبق گردیده است.' : 'This report conforms to the official automotive supply-chain audit layout.'}
            </p>
          </div>
        </div>

        {/* Adjust rows with interactive page chunks */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 bg-[#121215] border border-[#232326] px-3 py-1.5 rounded-lg">
            <Sliders size={14} className="text-amber-500" />
            <span className="text-xs text-slate-400">
              {isRtl ? 'تعداد سطر در هر صفحه:' : 'Rows per page:'}
            </span>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(Number(e.target.value))}
              className="bg-transparent text-xs text-white font-bold outline-none border-none cursor-pointer pr-1"
            >
              <option value={4} className="bg-[#121215]">{isRtl ? '۴ سطر' : '4 rows'}</option>
              <option value={6} className="bg-[#121215]">{isRtl ? '۶ سطر' : '6 rows'}</option>
              <option value={8} className="bg-[#121215]">{isRtl ? '۸ سطر' : '8 rows'}</option>
              <option value={10} className="bg-[#121215]">{isRtl ? '۱۰ سطر' : '10 rows'}</option>
              <option value={15} className="bg-[#121215]">{isRtl ? '۱۵ سطر' : '15 rows'}</option>
              <option value={20} className="bg-[#121215]">{isRtl ? '۲۰ سطر' : '20 rows'}</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 hidden md:block">
            <span>{isFaOrEn(isRtl, "تعداد کل رکوردها برای چاپ: ", "Total records: ")}</span>
            <span className="text-white font-mono font-bold bg-slate-800/50 px-2 py-1 rounded">
              {items.length} {isFaOrEn(isRtl, "ردیف", "rows")}
            </span>
            <span className="mx-2">|</span>
            <span>{isFaOrEn(isRtl, "تعداد صفحات خروجی: ", "Total print pages: ")}</span>
            <span className="text-amber-500 font-mono font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded">
              {pagesData.length || 1} {isFaOrEn(isRtl, "صفحه", "pages")}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Customizer sidebar toggler */}
          <button
            onClick={() => setIsCustomizePanelOpen(p => !p)}
            className={`p-2 px-3 rounded-lg border transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 ${isCustomizePanelOpen ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-[#1C1C1E] text-slate-400 border-[#2A2A2D] hover:bg-[#2A2A2D]'}`}
            title={isRtl ? 'نمایش / مخفی‌سازی پنل تنظیمات هדר و فوتر' : 'Show / hide customizer panel'}
          >
            <Settings size={14} className={isCustomizePanelOpen ? 'animate-spin' : ''} style={{ animationDuration: '6s' }} />
            <span>{isRtl ? 'تنظیمات هدر و فوتر' : 'Header / Footer Tool'}</span>
          </button>

          {/* Word Export Button */}
          <button
            onClick={downloadWord}
            className="p-2 px-3 bg-[#2B579A]/15 hover:bg-[#2B579A]/30 text-[#2B579A] border border-[#2B579A]/30 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
            title={isRtl ? 'خروجی استاندارد مایکروسافت ورد' : 'Export Word version'}
          >
            <FileText size={14} />
            <span>{isRtl ? 'خروجی Word' : 'Word Doc'}</span>
          </button>

          {/* Excel Export Button */}
          <button
            onClick={downloadExcel}
            className="p-2 px-3 bg-[#217346]/15 hover:bg-[#217346]/30 text-[#217346] border border-[#217346]/30 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
            title={isRtl ? 'خروجی رسمی مایکروسافت اکسل' : 'Export Excel spreadsheet'}
          >
            <FileSpreadsheet size={14} />
            <span>{isRtl ? 'خروجی Excel' : 'Excel Sheet'}</span>
          </button>

          {/* PDF Export Button */}
          <button
            onClick={() => {
              alert(isRtl 
                ? "جهت خروجی گرفتن نهایی با فرمت PDF:\nپس از کلیک روی دکمه چاپ و باز شدن پنجره پرینتر ممیزی مروگر، مقدار کادر فیلد 'Destination' را روی 'Save as PDF' (یا ذخیره با فرمت PDF) تنظیم کرده و دکمه Save را بزنید." 
                : "To export as PDF:\nAfter clicking and opening the print window, set 'Destination' to 'Save as PDF' and then click 'Save'.");
              handlePrint();
            }}
            className="bg-red-650 hover:bg-red-500 text-white font-black px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-red-500/15 shrink-0 cursor-pointer text-right"
            title={isRtl ? 'خروجی استاندارد PDF جهت چاپ یا ارسال مکانیزه' : 'Export as standard PDF'}
          >
            <FileText size={14} />
            <span>{isRtl ? 'خروجی PDF' : 'PDF Export'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="bg-amber-500 hover:bg-amber-400 text-black font-black px-5 py-2 rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/15 shrink-0 cursor-pointer text-right"
          >
            <Printer size={14} />
            <span>{t.printPreview}</span>
          </button>
          
          <button
            onClick={onClose}
            className="p-2 bg-[#1C1C1E] border border-[#2A2A2D] hover:bg-[#2A2A2D] text-slate-300 rounded-lg transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Printing Notification Banner */}
      <div className="bg-amber-500/5 border-b border-amber-500/10 px-8 py-2 text-[10px] text-amber-500/80 flex items-center gap-1.5 print:hidden">
        <Info size={12} className="shrink-0" />
        <span>
          {isRtl 
            ? 'پیشنهاد: در کادر تنظیمات مرورگر، گزینه‌های Header & Footer را خاموش و Background graphics را جهت زیبایی چاپ رنگی روشن نمایید.'
            : 'Tip: In browser print dialog, disable "Headers and footers" and enable "Background graphics" to preserve elegant status badges.'}
        </span>
      </div>

      {/* Dual-Pane Customizer Flex Parent */}
      <div className="flex-1 flex overflow-hidden print:block">
        
        {/* Customize Panel - Hidden when printing */}
        {isCustomizePanelOpen && (
          <div className="w-[330px] shrink-0 border-r border-[#1C1C1E] bg-[#0A0A0C] p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4 print:hidden" dir={isRtl ? 'rtl' : 'ltr'}>
            <div className="flex items-center gap-1.5 border-b border-[#1C1C1E] pb-3">
              <Settings size={15} className="text-amber-500" />
              <h4 className="text-xs font-black text-white">{isRtl ? 'پیکربندی هوشمند هدر و فوتر' : 'Header / Footer Config'}</h4>
            </div>

            {/* Visibility switches */}
            <div className="space-y-2.5 bg-[#121215] p-3 rounded-xl border border-white/[0.03]">
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-slate-300">{isRtl ? 'نمایش سربرگ (Header):' : 'Show Header block:'}</span>
                <input
                  type="checkbox"
                  checked={headerFooterConfig.showHeader}
                  onChange={(e) => setHeaderFooterConfig(prev => ({ ...prev, showHeader: e.target.checked }))}
                  className="accent-amber-500 scale-100 cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] font-bold text-slate-300">{isRtl ? 'نمایش پابرگ (Footer):' : 'Show Footer block:'}</span>
                <input
                  type="checkbox"
                  checked={headerFooterConfig.showFooter}
                  onChange={(e) => setHeaderFooterConfig(prev => ({ ...prev, showFooter: e.target.checked }))}
                  className="accent-amber-500 scale-100 cursor-pointer"
                />
              </div>
            </div>

            {/* Page Orientation Selection & Font Sizing */}
            <div className="space-y-3 bg-[#121215] p-3 rounded-xl border border-white/[0.03] text-right font-sans">
              <div className="flex flex-col gap-1.5 text-right">
                <label className="text-[10px] text-zinc-400 font-extrabold">{isRtl ? 'جهت‌گیری چاپ صفحه (A4):' : 'Page Output Orientation:'}</label>
                <div className="flex gap-2 bg-[#08080A] p-0.5 rounded border border-[#1E1E22]">
                  <button
                    type="button"
                    onClick={() => setOrientation('portrait')}
                    className={`flex-1 py-1.5 text-[10.5px] font-bold rounded transition-all cursor-pointer ${orientation === 'portrait' ? 'bg-amber-500 text-black font-black' : 'text-slate-400 hover:text-white'}`}
                  >
                    {isRtl ? 'عمودی (Portrait)' : 'Portrait'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrientation('landscape')}
                    className={`flex-1 py-1.5 text-[10.5px] font-bold rounded transition-all cursor-pointer ${orientation === 'landscape' ? 'bg-amber-500 text-black font-black' : 'text-slate-400 hover:text-white'}`}
                  >
                    {isRtl ? 'افقی (Landscape)' : 'Landscape'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1 text-right mt-1.5">
                <div className="flex justify-between items-center text-[10px] text-zinc-400 font-extrabold">
                  <span>{isRtl ? 'اندازه قلم جدول:' : 'Table Font Size:'}</span>
                  <span className="text-amber-500 font-mono">{fontSize}px</span>
                </div>
                <input
                  type="range"
                  min="7"
                  max="14"
                  step="0.5"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 mt-1 cursor-pointer"
                />
              </div>
            </div>

            {/* Logo select preset */}
            <div className="space-y-1.5">
              <label className="text-[9.5px] text-amber-500 font-extrabold uppercase tracking-wider block">{isRtl ? 'انتخاب نشان‌واره / لوگو:' : 'Document Symbol / Logo:'}</label>
              <select
                value={headerFooterConfig.logoType}
                onChange={(e) => setHeaderFooterConfig(prev => ({ ...prev, logoType: e.target.value }))}
                className="w-full bg-[#121215] border border-[#212124] text-xs text-white p-2 rounded-lg outline-none cursor-pointer font-sans"
              >
                <option value="preset_iatf">{isRtl ? 'پیش‌فرض زنجیره خودرو (IATF)' : 'Automotive Preset (IATF)'}</option>
                <option value="preset_iso">{isRtl ? 'پیش‌فرض ممیزی صنف (ISO 9001)' : 'Quality Preset (ISO 9001)'}</option>
                <option value="upload">{isRtl ? 'آپلود عکس لوگوی اختصاصی شرکت' : 'Upload custom PNG/JPG image'}</option>
                <option value="none">{isRtl ? 'بدون لوگو (فقط عنوان متنی)' : 'No Logo / Text only'}</option>
              </select>
            </div>

            {/* Image upload handler */}
            {headerFooterConfig.logoType === 'upload' && (
              <div className="space-y-2 p-3 bg-[#111114] border border-[#1E1E22] rounded-lg animate-fadeIn">
                <span className="text-[9.5px] text-zinc-400 font-bold block">{isRtl ? 'آپلود فایل لوگو (PNG/JPG):' : 'Select local image file:'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setHeaderFooterConfig(prev => ({ ...prev, uploadedLogoUrl: event.target?.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="text-[10px] text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-black file:bg-amber-500 file:text-black hover:file:bg-amber-400 cursor-pointer w-full"
                />
                {headerFooterConfig.uploadedLogoUrl && (
                  <div className="mt-2 text-center bg-black/40 p-2 rounded border border-white/5">
                    <img src={headerFooterConfig.uploadedLogoUrl} className="max-h-12 mx-auto object-contain" alt="Uploaded Thumbnail" />
                    <button
                      type="button"
                      onClick={() => setHeaderFooterConfig(prev => ({ ...prev, uploadedLogoUrl: '' }))}
                      className="text-[9px] text-red-400 mt-1 hover:underline"
                    >
                      {isRtl ? 'حذف لوگو' : 'Clear Logo'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Custom fields */}
            <div className="space-y-1.5">
              <label className="text-[9.5px] text-amber-500 font-extrabold block">{isRtl ? 'عنوان اختصاصی سربرگ:' : 'Custom Title:'}</label>
              <input
                type="text"
                value={headerFooterConfig.customTitle}
                placeholder={printTitle}
                onChange={(e) => setHeaderFooterConfig(prev => ({ ...prev, customTitle: e.target.value }))}
                className="w-full bg-[#121215] border border-[#212124] text-xs text-white p-2 rounded-lg outline-none font-sans"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9.5px] text-amber-500 font-extrabold block">{isRtl ? 'زیرنویس و دامنه تایید مستند:' : 'Subtitle:'}</label>
              <textarea
                value={headerFooterConfig.subTitle}
                onChange={(e) => setHeaderFooterConfig(prev => ({ ...prev, subTitle: e.target.value }))}
                className="w-full bg-[#121215] border border-[#212124] text-xs text-white p-2 rounded-lg outline-none h-14 resize-none font-sans leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[9.5px] text-amber-500 font-extrabold block">{isRtl ? 'شماره مستند / کد ردیابی:' : 'Document Tracking Code:'}</label>
              <input
                type="text"
                value={headerFooterConfig.docCode}
                onChange={(e) => setHeaderFooterConfig(prev => ({ ...prev, docCode: e.target.value }))}
                className="w-full bg-[#121215] border border-[#212124] text-xs text-white p-2 rounded-lg outline-none font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 bg-[#121215] p-3 rounded-lg border border-[#1E1E22]">
              <div className="space-y-1">
                <div className="flex items-center gap-1 mb-1">
                  <input
                    type="checkbox"
                    id="chk-shamsi"
                    checked={headerFooterConfig.showShamsiDate}
                    onChange={(e) => setHeaderFooterConfig(prev => ({ ...prev, showShamsiDate: e.target.checked }))}
                    className="accent-amber-500 scale-90 cursor-pointer"
                  />
                  <label htmlFor="chk-shamsi" className="text-[9px] text-zinc-400 font-extrabold select-none cursor-pointer">{isRtl ? 'تاریخ شمسی:' : 'Shamsi Date:'}</label>
                </div>
                <input
                  type="text"
                  disabled={!headerFooterConfig.showShamsiDate}
                  value={headerFooterConfig.customShamsiDate}
                  onChange={(e) => setHeaderFooterConfig(prev => ({ ...prev, customShamsiDate: e.target.value }))}
                  className="w-full bg-[#09090C] border border-[#212124] text-[10.5px] text-white p-1.5 rounded outline-none disabled:opacity-40 font-bold font-sans"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1 mb-1">
                  <input
                    type="checkbox"
                    id="chk-gregorian"
                    checked={headerFooterConfig.showGregorianDate}
                    onChange={(e) => setHeaderFooterConfig(prev => ({ ...prev, showGregorianDate: e.target.checked }))}
                    className="accent-amber-500 scale-90 cursor-pointer"
                  />
                  <label htmlFor="chk-gregorian" className="text-[9px] text-zinc-400 font-extrabold select-none cursor-pointer">{isRtl ? 'تاریخ میلادی:' : 'Gregorian:'}</label>
                </div>
                <input
                  type="text"
                  disabled={!headerFooterConfig.showGregorianDate}
                  value={headerFooterConfig.customGregorianDate}
                  onChange={(e) => setHeaderFooterConfig(prev => ({ ...prev, customGregorianDate: e.target.value }))}
                  className="w-full bg-[#09090C] border border-[#212124] text-[10.5px] text-white p-1.5 rounded outline-none disabled:opacity-40 font-bold font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5 mt-2">
              <label className="text-[9.5px] text-amber-500 font-extrabold block">{isRtl ? 'توضیحات پادرج سند (Footer text):' : 'Legal / Footer Text:'}</label>
              <textarea
                value={headerFooterConfig.customFooterText}
                onChange={(e) => setHeaderFooterConfig(prev => ({ ...prev, customFooterText: e.target.value }))}
                className="w-full bg-[#121215] border border-[#212124] text-xs text-white p-2 rounded-lg outline-none h-14 resize-none font-sans leading-relaxed"
              />
            </div>

            <div className="space-y-2.5 border-t border-[#1C1C1E] pt-3 bg-[#111114]/50 p-2 rounded mt-2">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-slate-300">{isRtl ? 'کادر امضا و مهر سازان:' : 'Approval Sign Box:'}</span>
                <input
                  type="checkbox"
                  checked={headerFooterConfig.showSignatures}
                  onChange={(e) => setHeaderFooterConfig(prev => ({ ...prev, showSignatures: e.target.checked }))}
                  className="accent-amber-500 scale-95 cursor-pointer"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-slate-300">{isRtl ? 'نمایش شماره صفحه:' : 'Show Page Numbering:'}</span>
                <input
                  type="checkbox"
                  checked={headerFooterConfig.showPageNumbers}
                  onChange={(e) => setHeaderFooterConfig(prev => ({ ...prev, showPageNumbers: e.target.checked }))}
                  className="accent-amber-500 scale-95 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* Scrollable pages list container */}
        <div className="flex-1 overflow-y-auto p-8 bg-[#070708] custom-scrollbar flex flex-col items-center gap-8 print:p-0 print:bg-white print:block">
          
          {/* Render pages (chunks) */}
          {pagesData.map((page: any, pageIdx) => (
            <div
              key={`page-${pageIdx}`}
              className={`print-page bg-white text-black rounded shadow-2xl relative border border-slate-200/50 flex flex-col justify-between print:shadow-none print:border-none print:p-0 print:w-full print:min-h-0 print:rounded-none page-break ${
                orientation === 'portrait' ? 'w-[210mm] min-h-[297mm] p-[15mm]' : 'w-[297mm] min-h-[210mm] p-[15mm]'
              }`}
              style={{ boxSizing: 'border-box' }}
              dir={isRtl ? "rtl" : "ltr"}
            >
              <div className={isRtl ? 'text-right' : 'text-left'}>
                {/* Official Customizable Standard Report Header Block */}
                {headerFooterConfig.showHeader && (
                  <div className="border-[2px] border-black p-4 flex justify-between items-center mb-6">
                    <div className={`w-[130px] flex flex-col justify-center items-center ${isRtl ? 'text-right' : 'text-left'} shrink-0`}>
                      {headerFooterConfig.logoType === 'preset_iatf' && (
                        <div className="text-amber-500 font-extrabold text-[23px] tracking-tighter leading-none pr-1">IATF</div>
                      )}
                      {headerFooterConfig.logoType === 'preset_iso' && (
                        <div className="text-blue-600 font-extrabold text-[20px] tracking-tighter leading-none pr-1">ISO 9001</div>
                      )}
                      {headerFooterConfig.logoType === 'upload' && headerFooterConfig.uploadedLogoUrl && (
                        <img src={headerFooterConfig.uploadedLogoUrl} style={{ maxHeight: "36px", maxWidth: "120px" }} className="object-contain" alt="Corp" />
                      )}
                      {headerFooterConfig.logoType === 'upload' && !headerFooterConfig.uploadedLogoUrl && (
                        <div className="text-slate-400 text-[10px] italic border border-dashed border-slate-300 p-1">{isRtl ? 'لوگو آپلود نشده' : 'No custom logo'}</div>
                      )}
                      {headerFooterConfig.logoType === 'none' && (
                        <div className="text-black font-extrabold text-xs">{isRtl ? 'تاییدیه سازمانی' : 'OFFICIAL'}</div>
                      )}
                    </div>
                    
                    <div className="text-center flex-1 pr-3 pl-3 border-r border-l border-slate-300">
                      <h1 className="text-sm font-black tracking-tight">{headerFooterConfig.customTitle || printTitle}</h1>
                      <p className="text-[9px] text-slate-600 font-bold mt-1 line-clamp-2">
                        {headerFooterConfig.subTitle}
                      </p>
                    </div>

                    <div className={`w-[145px] leading-normal text-[8px] text-slate-600 font-sans tracking-tight shrink-0 ${isRtl ? 'text-left' : 'text-right'}`}>
                      <div>{isFaOrEn(isRtl, "شماره مستند: ", "Doc ID: ")} <strong className="text-black font-mono font-extrabold">{headerFooterConfig.docCode}</strong></div>
                      {headerFooterConfig.showShamsiDate && (
                        <div>{isFaOrEn(isRtl, "تاریخ شمسی: ", "Shamsi: ")} <strong className="text-black font-sans font-extrabold">{headerFooterConfig.customShamsiDate}</strong></div>
                      )}
                      {headerFooterConfig.showGregorianDate && (
                        <div>{isFaOrEn(isRtl, "تاریخ صدور: ", "Issued: ")} <strong className="text-black font-mono font-extrabold">{headerFooterConfig.customGregorianDate}</strong></div>
                      )}
                      {headerFooterConfig.showPageNumbers && (
                        <div>{isFaOrEn(isRtl, "صفحه ممیزی: ", "Page: ")} <strong className="text-black font-mono font-extrabold">{pageIdx + 1} / {pagesData.length}</strong></div>
                      )}
                    </div>
                  </div>
                )}

                {/* Section Title Header */}
                {page.sectionName && page.isSectionStart && (
                  <div className="mb-4 bg-slate-100 p-3 rounded-lg border-2 border-black flex items-center gap-2">
                     <Layout size={16} className="text-amber-600" />
                     <h2 className="text-xs font-black text-black">
                       {isFaOrEn(isRtl, "بخش / جدول: ", "Section / Table: ")} {page.sectionName}
                     </h2>
                  </div>
                )}

                {/* Document Info Paragraph */}
                {pageIdx === 0 && (
                  <div className="mb-4 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[10px] text-slate-700 leading-relaxed text-left">
                    <strong>{isFaOrEn(isRtl, "توضیحات و دامنه شمول ممیزی: ", "Audit Description & Scope: ")}</strong>
                    <span>{template.description}</span>
                  </div>
                )}

                {/* Check Active Visual View versus Custom Tabular layout */}
                {isSwotVisual ? (
                  <div className="flex-1 flex flex-col justify-center my-auto py-4">
                    <div className="mb-6 p-6 border-2 border-black bg-slate-50 rounded-2xl">
                      <div className="flex items-center gap-2 border-b-2 border-black pb-3 mb-5">
                        <Sparkles size={20} className="text-amber-600 shrink-0" />
                        <span className="text-xs font-black text-black uppercase tracking-wider">
                          {isFaOrEn(isRtl, "نمای ممیزی خلاصه ارزیابی و استراتژی هوشمند تحلیل SWOT سازمان دال", "High Definition SWOT Strategic Analytical Dashboard")}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                        <div className="md:col-span-8 space-y-4">
                          <div className={`p-4 rounded-xl border-2 leading-relaxed ${swotAnalysis.strategyClass} text-xs font-bold shadow-sm text-right`}>
                            <div className="flex items-center gap-2 mb-2 justify-start">
                              <Cpu size={18} className="text-amber-600" />
                              <h4 className="font-extrabold text-[#111] text-xs uppercase tracking-wide">{swotAnalysis.strategyTitle}</h4>
                            </div>
                            <p className="text-[11.5px] font-medium text-slate-800 leading-relaxed mt-1">
                              {swotAnalysis.strategyDesc}
                            </p>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-[10.5px] bg-white p-3 rounded-xl border-2 border-black/80">
                            <div className="flex flex-col items-center">
                              <span className="text-green-700 font-extrabold">{isFaOrEn(isRtl, 'قوت‌ها (Strengths):', 'Strengths (S):')}</span>
                              <span className="font-mono text-sm font-black mt-1 bg-green-50 px-2 py-0.5 rounded border border-green-200">{swotAnalysis.sScore.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col items-center border-r border-[#eee]">
                              <span className="text-red-700 font-extrabold">{isFaOrEn(isRtl, 'ضعف‌ها (Weaknesses):', 'Weaknesses (W):')}</span>
                              <span className="font-mono text-sm font-black mt-1 bg-red-50 px-2 py-0.5 rounded border border-red-200">{swotAnalysis.wScore.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col items-center border-r border-[#eee]">
                              <span className="text-blue-700 font-extrabold">{isFaOrEn(isRtl, 'فرصت‌ها (Opportunities):', 'Opportunities (O):')}</span>
                              <span className="font-mono text-sm font-black mt-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{swotAnalysis.oScore.toFixed(2)}</span>
                            </div>
                            <div className="flex flex-col items-center border-r border-[#eee]">
                              <span className="text-amber-700 font-extrabold">{isFaOrEn(isRtl, 'تهدیدها (Threats):', 'Threats (T):')}</span>
                              <span className="font-mono text-sm font-black mt-1 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{swotAnalysis.tScore.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-white border-2 border-black rounded-xl">
                          <div className="relative flex justify-center items-center w-full max-w-[160px] aspect-square">
                            <svg width="150" height="150" className="overflow-visible select-none">
                              <rect x={75} y={15} width={60} height={60} fill={swotAnalysisExtra.xVal >= 0 && swotAnalysisExtra.yVal >= 0 ? "rgba(34, 197, 94, 0.15)" : "transparent"} />
                              <rect x={15} y={15} width={60} height={60} fill={swotAnalysisExtra.xVal < 0 && swotAnalysisExtra.yVal >= 0 ? "rgba(59, 130, 246, 0.15)" : "transparent"} />
                              <rect x={15} y={75} width={60} height={60} fill={swotAnalysisExtra.xVal < 0 && swotAnalysisExtra.yVal < 0 ? "rgba(239, 68, 68, 0.15)" : "transparent"} />
                              <rect x={75} y={75} width={60} height={60} fill={swotAnalysisExtra.xVal >= 0 && swotAnalysisExtra.yVal < 0 ? "rgba(217, 119, 6, 0.15)" : "transparent"} />

                              <line x1={15} y1={75} x2={135} y2={75} stroke="#000" strokeWidth={1.5} />
                              <line x1={75} y1={15} x2={75} y2={135} stroke="#000" strokeWidth={1.5} />

                              <text x={105} y={45} fill={swotAnalysisExtra.xVal >= 0 && swotAnalysisExtra.yVal >= 0 ? "#16a34a" : "#777"} fontSize={9} fontWeight="black" textAnchor="middle">SO</text>
                              <text x={45} y={45} fill={swotAnalysisExtra.xVal < 0 && swotAnalysisExtra.yVal >= 0 ? "#2563eb" : "#777"} fontSize={9} fontWeight="black" textAnchor="middle">WO</text>
                              <text x={45} y={105} fill={swotAnalysisExtra.xVal < 0 && swotAnalysisExtra.yVal < 0 ? "#dc2626" : "#777"} fontSize={9} fontWeight="black" textAnchor="middle">WT</text>
                              <text x={105} y={105} fill={swotAnalysisExtra.xVal >= 0 && swotAnalysisExtra.yVal < 0 ? "#d97706" : "#777"} fontSize={9} fontWeight="black" textAnchor="middle">ST</text>

                              <text x={140} y={78} fill="#333" fontSize={7} textAnchor="start" fontWeight="bold">S-W</text>
                              <text x={75} y={9} fill="#333" fontSize={7} textAnchor="middle" fontWeight="bold">O-T</text>

                              {(() => {
                                const printXPos = 75 + Math.max(-1, Math.min(1, swotAnalysisExtra.xVal / swotAnalysisExtra.maxVal)) * 55;
                                const printYPos = 75 - Math.max(-1, Math.min(1, swotAnalysisExtra.yVal / swotAnalysisExtra.maxVal)) * 55;
                                return (
                                  <g key="swot-marker">
                                    <circle cx={printXPos} cy={printYPos} r={9} fill={swotAnalysisExtra.dotColor} opacity={0.3} />
                                    <circle cx={printXPos} cy={printYPos} r={5} fill={swotAnalysisExtra.dotColor} stroke="#000" strokeWidth={1.5} />
                                  </g>
                                );
                              })()}
                            </svg>
                          </div>

                          <div className="mt-3 text-center">
                            <span className="text-[8px] text-slate-500 font-bold block">{isFaOrEn(isRtl, 'موقعیت برآیند استراتژیک:', 'Strategic Decision Point:')}</span>
                            <span className="text-[10px] font-black mt-1 block" style={{ color: swotAnalysisExtra.dotColor }}>
                              {swotAnalysisExtra.quadName}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : isTurtleVisual && page.items[0] ? (() => {
                  const activeProcess = page.items[0];
                  const processKpis = activeProcess?.indicators && Array.isArray(activeProcess.indicators) ? activeProcess.indicators : [];
                  return (
                    <div className="flex-1 flex flex-col justify-center my-auto py-[10px]">
                      {/* Header */}
                      <div className="mb-5 border-b-2 border-black pb-2 flex justify-between items-center text-right" dir="rtl">
                        <span className="text-xs font-black text-black flex items-center gap-1.5 leading-none">
                          <span className="text-base select-none">🐢</span>
                          <span>{isFaOrEn(isRtl, `نمای تعاملی فرآیند: ${activeProcess.field1 || 'نامشخص'}`, `Interactive Turtle View: ${activeProcess.field1 || 'Untitled'}`)}</span>
                        </span>
                        <span className="text-[10px] font-extrabold bg-[#F5F5F7] px-2.5 py-1 border border-black/20 rounded font-mono text-black select-none shrink-0 leading-none">
                          {isFaOrEn(isRtl, `بند مرتبط: ${activeProcess.clauseId || '۷.۵'}`, `Clause Mapped: ${activeProcess.clauseId || '7.5'}`)}
                        </span>
                      </div>

                      {/* Classic 3x3 Turtle Diagram Layout Grid - HD quality printable with double-border black lines */}
                      <div className="grid grid-cols-3 gap-3 text-right" dir="rtl">
                        
                        {/* Row 1 / Left Box: How (Resources - Machine/Hardware) */}
                        <div className="border-[2.5px] border-black p-3 bg-slate-50 flex flex-col justify-between min-h-[140px] rounded-xl self-stretch relative">
                          <div className="border-b border-black pb-1 mb-2 font-black text-[10.5px] text-purple-800 flex items-center gap-1.5 justify-start">
                            <span className="text-xs">⚙️</span>
                            <span>{isFaOrEn(isRtl, 'با چه چیزی؟ (سخت‌افزار و ماشین‌آلات)', 'With what? (Equipment & Hardware)')}</span>
                          </div>
                          <p className="text-[10.5px] text-slate-800 leading-relaxed font-semibold whitespace-pre-wrap flex-1">
                            {activeProcess.field4 || isFaOrEn(isRtl, "تجهیزات و ماشین‌آلات تولید دایکاست، ابزار کنترلی، قالب‌های فرآیند و سیستم کالیبراسیون و پایش خطوط مربوطه", "Die-cast and stamping machinery, production lines, standard tools and sensors")}
                          </p>
                          <span className="absolute bottom-1 left-2 text-[7.5px] font-bold text-slate-400">BOX 4</span>
                        </div>

                        {/* Row 1 / Center Box: Main Process Header Symbol */}
                        <div className="border-[2.5px] border-black p-3 bg-amber-500/5 flex flex-col justify-center items-center rounded-xl relative self-stretch">
                          <div className="w-14 h-14 rounded-full bg-amber-500 text-black flex items-center justify-center font-extrabold text-2xl shadow-md border-2 border-black mb-2 select-none">
                            🐢
                          </div>
                          <h4 className="font-black text-xs text-center text-black px-1 leading-normal line-clamp-2">
                            {activeProcess.field1}
                          </h4>
                          <span className="text-[8px] font-bold text-amber-855 tracking-tight text-center mt-1">
                            {isFaOrEn(isRtl, "تحلیل لاک‌پشتی ارزش ممیزی", "Core Enterprise Process Block")}
                          </span>
                        </div>

                        {/* Row 1 / Right Box: Who (Resources - People/Competence) */}
                        <div className="border-[2.5px] border-black p-3 bg-slate-50 flex flex-col justify-between min-h-[140px] rounded-xl self-stretch relative">
                          <div className="border-b border-black pb-1 mb-2 font-black text-[10.5px] text-blue-800 flex items-center gap-1.5 justify-start">
                            <span className="text-xs">👥</span>
                            <span>{isFaOrEn(isRtl, 'با چه کسی؟ (نیروی انسانی و شایستگی)', 'With whom? (People & Skills)')}</span>
                          </div>
                          <p className="text-[10.5px] text-slate-800 leading-relaxed font-semibold whitespace-pre-wrap flex-1">
                            {activeProcess.field5 || isFaOrEn(isRtl, "اپراتورهای ماهر تولید، سرپرست سالن ریخته‌گری، ممیز مقیم تضمین کیفیت و مهندسی نگهداری پیشگیرانه مجهز", "Skilled operators, foundry supervisors, QMS resident auditor")}
                          </p>
                          <span className="absolute bottom-1 left-2 text-[7.5px] font-bold text-slate-400">BOX 5</span>
                        </div>

                        {/* Row 2 / Left Box: Input (What goes in) */}
                        <div className="border-[2.5px] border-black p-3 bg-emerald-500/[0.03] flex flex-col justify-between min-h-[140px] rounded-xl self-stretch relative">
                          <div className="border-b border-emerald-900/30 pb-1 mb-2 font-black text-[10.5px] text-emerald-800 flex items-center gap-1.5 justify-start">
                            <span className="text-xs">📥</span>
                            <span>{isFaOrEn(isRtl, 'ورودی‌های فرآیند (Inputs)', 'Process Inputs')}</span>
                          </div>
                          <p className="text-[10.5px] text-slate-800 leading-relaxed font-semibold whitespace-pre-wrap flex-1">
                            {activeProcess.field2}
                          </p>
                          <span className="absolute bottom-1 left-2 text-[7.5px] font-bold text-slate-400">BOX 2</span>
                        </div>

                        {/* Row 2 / Center Box: Middle decorative bridge / Arrow line */}
                        <div className="flex flex-col justify-center items-center py-2 self-stretch relative">
                          <svg width="100%" height="80" className="overflow-visible select-none">
                            <line x1="5%" y1="40" x2="95%" y2="40" stroke="#000" strokeWidth={2} strokeDasharray="4 4" />
                            <polygon points="5,4 12,40 22,25 22,55" fill="#000" className="hidden" />
                            <polygon points="90,32 105,40 90,48" fill="#111" />
                            <text x="50%" y="28" textAnchor="middle" fill="#555" fontSize={8.5} fontWeight="bold">
                              {isFaOrEn(isRtl, "جریان ارزش افزوده فرآیند", "Analytical Value Stream Flow")}
                            </text>
                          </svg>
                        </div>

                        {/* Row 2 / Right Box: Output (What comes out) */}
                        <div className="border-[2.5px] border-black p-3 bg-emerald-500/[0.03] flex flex-col justify-between min-h-[140px] rounded-xl self-stretch relative">
                          <div className="border-b border-emerald-900/30 pb-1 mb-2 font-black text-[10.5px] text-emerald-800 flex items-center gap-1.5 justify-start">
                            <span className="text-xs">📤</span>
                            <span>{isFaOrEn(isRtl, 'خروجی‌های فرآیند (Outputs)', 'Process Outputs')}</span>
                          </div>
                          <p className="text-[10.5px] text-slate-800 leading-relaxed font-semibold whitespace-pre-wrap flex-1">
                            {activeProcess.field3}
                          </p>
                          <span className="absolute bottom-1 left-2 text-[7.5px] font-bold text-slate-400">BOX 3</span>
                        </div>

                        {/* Row 3 / Left Box: Methods (Instructions, Procedure) */}
                        <div className="border-[2.5px] border-black p-3 bg-slate-50 flex flex-col justify-between min-h-[140px] rounded-xl self-stretch relative">
                          <div className="border-b border-black pb-1 mb-2 font-black text-[10.5px] text-indigo-800 flex items-center gap-1.5 justify-start">
                            <span className="text-xs">📜</span>
                            <span>{isFaOrEn(isRtl, 'چگونه؟ (روش‌های کار و مراجع)', 'How? (Methods, Instructions)')}</span>
                          </div>
                          <p className="text-[10.5px] text-slate-800 leading-relaxed font-semibold whitespace-pre-wrap flex-1">
                            {activeProcess.field6 || isFaOrEn(isRtl, "دستورالعمل‌های استاندارد کاربری، چک‌لیست بازرسی سالن، مراجع کنترل فرآیند تولید و دستورالعمل ممیزی نظام", "Stamping instruction manual, QMS checklist")}
                          </p>
                          <span className="absolute bottom-1 left-2 text-[7.5px] font-bold text-slate-400">BOX 6</span>
                        </div>

                        {/* Row 3 / Center Box: Footer status anchor */}
                        <div className="flex flex-col justify-center items-center self-stretch rounded-xl p-2.5">
                          <div dir="ltr" className="text-[#111] font-black text-[10px] text-center border-2 border-black bg-slate-50 px-3 py-1.5 rounded-lg w-full flex items-center justify-center gap-1">
                            <span>🛡️</span>
                            <span>ISO 9001:215 Approved</span>
                          </div>
                        </div>

                        {/* Row 3 / Right Box: KPIs / Indicators */}
                        <div className="border-[2.5px] border-black p-3 bg-amber-500/[0.03] flex flex-col justify-between min-h-[140px] rounded-xl self-stretch relative">
                          <div className="border-b border-black pb-1 mb-2 font-black text-[10.5px] text-amber-850 flex items-center gap-1.5 justify-start">
                            <span className="text-xs">📈</span>
                            <span>{isFaOrEn(isRtl, 'شاخص‌های فرآیند (KPI)', 'Performance Indicators (KPI)')}</span>
                          </div>
                          
                          {processKpis.length > 0 ? (
                            <div className="space-y-1 bg-white p-1 rounded border border-black/10 flex-1">
                              {processKpis.map((k, kIdx) => (
                                <div key={kIdx} className="flex justify-between items-center text-[9px] py-1 border-b border-dashed border-slate-100 last:border-0 font-sans leading-none">
                                  <span className="font-extrabold text-slate-700 truncate max-w-[130px]" title={k.field1}>{k.field1}</span>
                                  <span className="text-[8.5px] text-amber-700 font-extrabold shrink-0 bg-amber-500/10 px-1 rounded">{k.actual || '0'} / {k.target || '10'}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10.5px] text-slate-800 leading-relaxed font-semibold whitespace-pre-wrap flex-1">
                              {activeProcess.field7 || activeProcess.field4 || isFaOrEn(isRtl, "نرخ قطعات سالم تولید، خواب برنامه‌ریزی‌نشده خطوط و میانگین زمان توقف فرآیند", "Scrap rate, downtime indices, production performance targets")}
                            </p>
                          )}
                          <span className="absolute bottom-1 left-2 text-[7.5px] font-bold text-slate-400">BOX 7 / KPI</span>
                        </div>

                      </div>
                    </div>
                  );
                })() : isProcessMapVisual ? (
                  <div className="flex-1 flex flex-col justify-center my-auto py-2">
                    <div className="mb-4 border-b-2 border-black pb-1 flex justify-between items-center text-[11px] text-right" dir="rtl">
                      <span className="font-black text-black">
                        🗺️ {isFaOrEn(isRtl, "نقشه تعاملی جریان فرآیندهای کسب و کار و ارزش ممیزی", "Business Process Value Stream Map")}
                      </span>
                      <span className="text-[9.5px] font-extrabold bg-[#F5F5F7] px-2 py-0.5 border border-black/20 rounded shrink-0">
                        ISO 9001:2015 Clause 4.4
                      </span>
                    </div>

                    {/* Relative SVG and node positioning map with automatic scale to avoid overflow */}
                    <div className="relative w-full overflow-hidden bg-slate-50 border-[2.5px] border-black rounded-2xl flex items-center justify-center p-4 h-[440px]">
                      {(() => {
                        const scaleFactor = Math.min(1.0, 715 / maxCoords.x);
                        return (
                          <div 
                            style={{ 
                              position: 'relative', 
                              width: `${maxCoords.x}px`, 
                              height: `${maxCoords.y}px`, 
                              transform: `scale(${scaleFactor})`, 
                              transformOrigin: 'top center' 
                            }}
                          >
                            {/* 1. Connections Lines Layer */}
                            <svg width={maxCoords.x} height={maxCoords.y} className="absolute inset-0 z-10 pointer-events-none select-none overflow-visible">
                              <defs>
                                <marker id="print-arrow-marker" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#1e293b" />
                                </marker>
                              </defs>
                              {items.map((node) => {
                                const connections = Array.isArray(node.connections) ? node.connections : [];
                                return connections.map((targetId) => {
                                  const target = items.find(n => n.id === targetId);
                                  if (!target) return null;

                                  const startX = (node.x || 150) + 120;
                                  const startY = (node.y || 120) + 60;
                                  const endX = (target.x || 150) + 120;
                                  const endY = (target.y || 120) + 60;

                                  const dx = endX - startX;
                                  const dy = endY - startY;
                                  const dist = Math.hypot(dx, dy);

                                  let targetX = endX;
                                  let targetY = endY;

                                  if (dist > 140) {
                                    targetX = startX + (dx * (dist - 125)) / dist;
                                    targetY = startY + (dy * (dist - 65)) / dist;
                                  }

                                  return (
                                    <g key={`${node.id}-${targetId}`}>
                                      <path
                                        d={`M ${startX} ${startY} L ${targetX} ${targetY}`}
                                        stroke="#475569"
                                        strokeWidth="2"
                                        fill="none"
                                        markerEnd="url(#print-arrow-marker)"
                                      />
                                      {/* Middle connector dot */}
                                      <circle cx={(startX+targetX)/2} cy={(startY+targetY)/2} r="2.5" fill="#f59e0b" stroke="#000" strokeWidth="0.5" />
                                    </g>
                                  );
                                });
                              })}
                            </svg>

                            {/* 2. Process Nodes div widgets */}
                            {items.map((node) => {
                              const titleLower = node.field1.toLowerCase();
                              let nodeBg = "bg-amber-50/70 border-amber-500/80";
                              if (titleLower.includes('تولید') || titleLower.includes('ساخت') || titleLower.includes('دایکاست') || titleLower.includes('تزریق') || titleLower.includes('manufacturing')) {
                                nodeBg = "bg-emerald-50/70 border-emerald-500/80";
                              } else if (titleLower.includes('کیفیت') || titleLower.includes('تضمین') || titleLower.includes('کنترل') || titleLower.includes('آزمایشگاه') || titleLower.includes('کالیبر') || titleLower.includes('audit') || titleLower.includes('quality')) {
                                nodeBg = "bg-blue-50/70 border-blue-500/80";
                              }

                              return (
                                <div
                                  key={node.id}
                                  style={{
                                    position: 'absolute',
                                    left: `${node.x || 150}px`,
                                    top: `${node.y || 120}px`,
                                    width: '240px',
                                    zIndex: 20
                                  }}
                                  className={`rounded-xl border-[2px] p-3 shadow-md flex flex-col justify-between ${nodeBg} bg-white text-right font-sans`}
                                >
                                  <div className="border-b border-black/10 pb-1.5 mb-2 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 overflow-hidden justify-start">
                                      <span className="w-2 h-2 rounded bg-amber-500 shrink-0"></span>
                                      <h4 className="text-[10.5px] font-black text-black truncate max-w-[200px]" title={node.field1}>
                                        {node.field1}
                                      </h4>
                                    </div>
                                  </div>

                                  <div className="space-y-1 text-right font-sans">
                                    {node.field2 && (
                                      <div className="text-[9px] text-slate-700 truncate font-semibold">
                                        <strong className="text-purple-700">{isRtl ? '📥 ورودی: ' : 'In: '}</strong>
                                        {node.field2}
                                      </div>
                                    )}
                                    {node.field3 && (
                                      <div className="text-[9px] text-slate-700 truncate font-semibold">
                                        <strong className="text-emerald-700">{isRtl ? '📤 خروجی: ' : 'Out: '}</strong>
                                        {node.field3}
                                      </div>
                                    )}
                                    {node.field4 && (
                                      <div className="text-[9px] text-slate-700 truncate font-semibold">
                                        <strong className="text-amber-700">{isRtl ? '📈 شاخص: ' : 'KPI: '}</strong>
                                        {node.field4}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                ) : page.isLegacyRisk ? (() => {
                  const procName = page.sectionName;
                  const contextRows = items.filter(idx => idx.type === 'context' && (idx.associatedProcess === procName || idx.field7 === procName));
                  const riskRows = items.filter(idx => idx.type === 'risk_and_opp' && (idx.associatedProcess === procName || idx.field7 === procName));

                  return (
                    <div className="flex-1 flex flex-col justify-start py-[5px] text-right" dir="rtl">
                      {/* Section Title */}
                      <div className="mb-4 border-b-2 border-black pb-1.5 flex justify-between items-center bg-[#F8FAFC] p-2 border border-slate-200 rounded">
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          🛡️ {isFaOrEn(isRtl, `فرآیند: ${procName}`, `Process: ${procName}`)}
                        </span>
                        <span className="text-[9px] font-bold bg-amber-500/10 text-amber-800 px-2 py-0.5 border border-amber-500/20 rounded">
                          {isFaOrEn(isRtl, 'شناسنامه موقعیت و ارزیابی ریسک‌ها', 'Context & Risk Registry')}
                        </span>
                      </div>

                      {/* 1. TABLE A - Process Context Board */}
                      <div className="mb-6">
                        <h4 className="text-[10px] font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                          <span>۱. شناسنامه و موقعیت فرآیند (Process Context Board)</span>
                        </h4>
                        <table className="w-full border-collapse border border-black text-[9.5px]">
                          <thead>
                            <tr className="bg-slate-100/80 border-b border-black font-bold">
                              <th className="p-1.5 border border-black text-center w-8">#</th>
                              <th className="p-1.5 border border-black w-[15%] text-right">{isRtl ? 'تأمین‌کنندگان' : 'Suppliers'}</th>
                              <th className="p-1.5 border border-black w-[20%] text-right">{isRtl ? 'ورودی‌ها' : 'Inputs'}</th>
                              <th className="p-1.5 border border-black w-[30%] text-right">{isRtl ? 'فعالیت‌های فرآیند' : 'Activities'}</th>
                              <th className="p-1.5 border border-black w-[20%] text-right">{isRtl ? 'خروجی‌ها' : 'Outputs'}</th>
                              <th className="p-1.5 border border-black w-[15%] text-right">{isRtl ? 'مشتریان' : 'Customers'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {contextRows.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                                  {isRtl ? 'ردیف موقعیت ثبت نگردیده است.' : 'No context rows logged.'}
                                </td>
                              </tr>
                            ) : (
                              contextRows.map((cr, idx) => (
                                <tr key={cr.id} className="border-b border-black">
                                  <td className="p-1.5 border border-black text-center font-mono">{idx + 1}</td>
                                  <td className="p-1.5 border border-black text-right whitespace-pre-wrap">{cr.field1}</td>
                                  <td className="p-1.5 border border-black text-right whitespace-pre-wrap">{cr.field2}</td>
                                  <td className="p-1.5 border border-black text-right whitespace-pre-wrap">{cr.field3}</td>
                                  <td className="p-1.5 border border-black text-right whitespace-pre-wrap">{cr.field4}</td>
                                  <td className="p-1.5 border border-black text-right whitespace-pre-wrap">{cr.field5}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* 2. TABLE B - FMEA Assessment Registry */}
                      <div>
                        <h4 className="text-[10px] font-bold text-slate-800 mb-1.5 flex items-center gap-1">
                          <span>۲. جدول شناسایی و ارزیابی ریسک‌ها و فرصت‌های فرآیند (Risk & Opportunities Register)</span>
                        </h4>
                        <table className="w-full border-collapse border border-black text-[9px]">
                          <thead>
                            <tr className="bg-slate-100 border-b border-black font-bold">
                              <th className="p-1 border border-black text-center w-7">#</th>
                              <th className="p-1 border border-black w-14 text-center">{isRtl ? 'بند' : 'Clause'}</th>
                              <th className="p-1 border border-black text-right w-[15%]">{isRtl ? 'مخاطره و پیامد بالقوه' : 'Identified Risk'}</th>
                              <th className="p-1 border border-black text-center w-8">O1</th>
                              <th className="p-1 border border-black text-center w-8">S1</th>
                              <th className="p-1 border border-black text-center w-10">RPN1</th>
                              <th className="p-1 border border-black text-right w-[18%]">{isRtl ? 'اقدام مهار ریسک پیشگیرانه' : 'Preventative Risk Action'}</th>
                              <th className="p-1 border border-black text-center w-8">O2</th>
                              <th className="p-1 border border-black text-center w-8">S2</th>
                              <th className="p-1 border border-black text-center w-10">RPN2</th>
                              <th className="p-1 border border-black text-right w-[15%]">{isRtl ? 'فرصت بالقوه بهبود' : 'Potential Opp.'}</th>
                              <th className="p-1 border border-black text-right w-[15%]">{isRtl ? 'اقدام استفاده از فرصت' : 'Action for Opp.'}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {riskRows.length === 0 ? (
                              <tr>
                                <td colSpan={12} className="p-4 text-center text-slate-400 italic">
                                  {isRtl ? 'هیچ ریسک یا فرصتی ثبت نگردیده است.' : 'No risk rows logged.'}
                                </td>
                              </tr>
                            ) : (
                              riskRows.map((rr, idx) => {
                                const o1 = Number(rr.numeric1 || 1);
                                const s1 = Number(rr.numeric2 || 1);
                                const rpn1 = o1 * s1;

                                const o2 = Number(rr.numeric4 || 1);
                                const s2 = Number(rr.numeric5 || 1);
                                const rpn2 = o2 * s2;

                                return (
                                  <tr key={rr.id} className="border-b border-black">
                                    <td className="p-1 border border-black text-center font-mono">{idx + 1}</td>
                                    <td className="p-1 border border-black text-center font-mono text-amber-700 font-bold">{rr.clauseId || '--'}</td>
                                    <td className="p-1 border border-black text-right whitespace-pre-wrap">{rr.field1}</td>
                                    <td className="p-1 border border-black text-center font-mono">{o1}</td>
                                    <td className="p-1 border border-black text-center font-mono">{s1}</td>
                                    <td className="p-1 border border-black text-center font-mono font-bold bg-amber-500/5">{rpn1}</td>
                                    <td className="p-1 border border-black text-right whitespace-pre-wrap">{rr.actions || rr.field3}</td>
                                    <td className="p-1 border border-black text-center font-mono">{o2}</td>
                                    <td className="p-1 border border-black text-center font-mono">{s2}</td>
                                    <td className="p-1 border border-black text-center font-mono font-bold bg-amber-500/5">{rpn2}</td>
                                    <td className="p-1 border border-black text-right whitespace-pre-wrap">{rr.field4}</td>
                                    <td className="p-1 border border-black text-right whitespace-pre-wrap">{rr.field5}</td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })() : (
                  <>
                    {/* Standard repeating Column Table with clean layout */}
                    <table className="w-full border-collapse border border-black mb-6">
                      <thead>
                        <tr className="bg-slate-100 border-b border-black text-black font-bold uppercase" style={{ fontSize: `${fontSize + 1}px` }}>
                          <th className="p-2 border border-black text-center w-10">
                            {isFaOrEn(isRtl, "ردیف", "No.")}
                          </th>
                          {page.columns.map((col: any) => (
                            <th key={col.id} className={`p-2 border border-black font-bold ${isRtl ? 'text-right' : 'text-left'}`}>{col.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {page.items.map((item: any, localIdx: number) => {
                          const globalIdx = (page.pageIdx - 1) * rowsPerPage + localIdx + 1;
                          return (
                            <tr key={item.id} className="border-b border-slate-300 align-top text-black" style={{ fontSize: `${fontSize}px` }}>
                              {/* Serial */}
                              <td className="p-2 border border-black text-center font-mono font-bold bg-slate-50/50">
                                {globalIdx}
                              </td>

                              {/* Cells */}
                              {page.columns.map((col: any) => {
                                const displayVal = getCellPrintValue(col, item);
                                
                                return (
                                  <td key={col.id} className={`p-2 border border-black whitespace-pre-wrap leading-tight ${isRtl ? 'text-right' : 'text-left'}`}>
                                    {/* Attached Image inside custom cell or row flow inline */}
                                    {col.field === 'field1' && item.image && (
                                      <div className="mb-2 inline-block">
                                        <img
                                          src={item.image}
                                          alt="Verification Evidence"
                                          referrerPolicy="no-referrer"
                                          className="max-h-16 max-w-[100px] object-cover rounded border border-black/40 shadow-sm block"
                                        />
                                      </div>
                                    )}
                                    
                                    <span className="block font-medium text-slate-900">{displayVal}</span>
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </>
                )}
              </div>

              {/* Official Audit Bottom Footer panel on each page */}
              {headerFooterConfig.showFooter && (
                <div className={`border-t border-slate-400 pt-3 flex flex-col md:flex-row items-start md:items-center justify-between text-[9px] text-slate-500 font-sans gap-2 ${isRtl ? 'text-right' : 'text-left'}`}>
                  <div className="flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-green-600 shrink-0" />
                    <span>
                      {headerFooterConfig.customFooterText}
                    </span>
                  </div>
                  {headerFooterConfig.showSignatures && (
                    <div className="flex gap-4 sm:gap-8 text-slate-705 font-bold shrink-0">
                      <span>{isFaOrEn(isRtl, "تایید ممیز ارشد سازمان", "Lead QMS Auditor Sign: ________________")}</span>
                      <span>{isFaOrEn(isRtl, "تایید نماینده مدیریت", "Management Approval: ________________")}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

        {items.length === 0 && (
          <div className="bg-white p-12 text-center rounded border border-slate-200 w-[210mm] text-slate-500 font-bold">
            {isFaOrEn(isRtl, "هیچ رکوردی منطبق یا انتخاب شده‌ای جهت صدور پی دی اف یافت نشد.", "No records checked or available to load into the PDF document.")}
          </div>
        )}
      </div>
      
      {/* End of Dual-Pane Customizer Flex Parent */}
      </div>

      <style>{`
        #print-preview-modal .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        #print-preview-modal .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        #print-preview-modal .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #232326;
          border-radius: 10px;
        }
        
        @media print {
          /* Hide standard non-print elements */
          body * {
            visibility: hidden;
            background: none !important;
          }
          #root {
            display: none !important;
          }
          /* Show print content */
          .print-page, .print-page * {
            visibility: visible;
          }
          .print-page {
            position: relative;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            width: 100% !important;
            height: auto !important;
            padding: 0 !important;
            margin: 0 !important;
            page-break-after: always;
            break-after: page;
            background: white !important;
            color: black !important;
          }
          body {
            background-color: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print:hidden, .print-elements-to-hide {
            display: none !important;
          }
          
          /* Force page break after each chunk wrapper */
          .page-break {
            page-break-after: always !important;
            break-after: page !important;
          }
        }
      `}</style>
    </div>
  );
}

function isFaOrEn(isFa: boolean, faVal: string, enVal: string) {
  return isFa ? faVal : enVal;
}
