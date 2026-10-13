/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, FileText, Printer, Download, Check, Sparkles, FileCheck, ArrowDownToLine, Info, UploadCloud } from 'lucide-react';
import { IATFClause } from '../data/iatfData';
import { uiTranslations } from '../lib/translations';
import { QmsDatabase } from '../lib/qmsDatabase';
import { getJalaliDate } from '../lib/dateUtils';

interface BlankTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  clause: IATFClause | null;
  lang: 'fa' | 'en';
  onAddClauseDocument?: (clauseId: string, docName: string) => void;
}

export default function BlankTemplatesModal({ isOpen, onClose, clause, lang, onAddClauseDocument }: BlankTemplatesModalProps) {
  const isRtl = lang === 'fa';
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<string | null>(null);

  // PDF Upload state variables
  const [activeTab, setActiveTab] = useState<'download' | 'upload_pdf'>('download');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState('');
  const [pdfDocType, setPdfDocType] = useState<'DOCUMENT' | 'RECORD'>('RECORD');
  const [pdfSelectedDoc, setPdfSelectedDoc] = useState('');
  const [pdfCustomDocName, setPdfCustomDocName] = useState('');
  const [pdfUploadSuccess, setPdfUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  if (!isOpen || !clause) return null;

  const t = uiTranslations[lang];
  const docsList = clause.documents || [];

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setUploadError(isRtl ? 'خطا: فقط فایل‌های با فرمت PDF مجاز هستند.' : 'Error: Only PDF format files are allowed.');
        setPdfFile(null);
        return;
      }
      setPdfFile(file);
      setPdfName(file.name.replace(/\.[^/.]+$/, "")); // Strip extension
      setUploadError(null);
    }
  };

  const handleSavePdfUpload = () => {
    if (!pdfFile) {
      alert(isRtl ? 'لطفا ابتدا یک فایل PDF انتخاب کنید.' : 'Please select a PDF file first.');
      return;
    }

    const finalDocName = pdfSelectedDoc === 'custom' || !pdfSelectedDoc
      ? (pdfCustomDocName.trim() || pdfName || (isRtl ? 'پیوست مستندات سفارشی' : 'Custom Attachment'))
      : pdfSelectedDoc;

    if (pdfDocType === 'DOCUMENT') {
      // Add as standard document to the required doc list
      if (onAddClauseDocument) {
        onAddClauseDocument(clause.id, finalDocName);
        setPdfUploadSuccess(true);
        setPdfFile(null);
        setPdfCustomDocName('');
        setTimeout(() => {
          setPdfUploadSuccess(false);
          onClose();
        }, 2000);
      } else {
        alert(isRtl ? 'خطا در افزودن مستند. تابع افزودن مستند در دسترس نیست.' : 'Cannot add document. Callback is unavailable.');
      }
      return;
    }

    // Save as Archived Record/Compliance Evidence
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const base64Data = reader.result as string;
        const recordId = `PDF-REC-${Date.now()}`;
        const recordObj = {
          id: recordId,
          documentName: `${finalDocName} (${isRtl ? 'سند PDF پیوست شده' : 'Attached PDF Document'})`,
          clauseId: clause.id,
          archivedAt: getJalaliDate() + ' ' + new Date().toTimeString().split(' ')[0],
          code: `QMS-PDF-${clause.id.replace(/\./g, '_')}-${Math.floor(Math.random() * 900 + 100)}`,
          revision: '01',
          preparedBy: isRtl ? 'کارشناس واحد سیستم‌ها' : 'Systems Specialist',
          approvedBy: isRtl ? 'مدیر تضمین کیفیت کارگاه' : 'QA Factory Manager',
          items: [
            {
              id: 'pdf-meta-row',
              field1: isRtl ? 'محتویات و مشخصات فایل پی‌دی‌اف' : 'PDF File contents and details',
              field2: pdfFile.name,
              field3: `${(pdfFile.size / 1024).toFixed(1)} KB`,
              field4: getJalaliDate(),
              field5: isRtl ? 'ممهور به مهر سیستم مدیریت کیفیت' : 'Stamped by QMS'
            }
          ],
          fileData: base64Data,
          fileName: pdfFile.name,
          fileSize: pdfFile.size,
          isPdfAttachment: true
        };

        // Write row
        QmsDatabase.writeRow('records_table', recordId, recordObj);
        
        // Dispatch mutate event so ClauseDetail side list reloads dynamically
        window.dispatchEvent(new Event('qms-db-mutated'));
        
        setPdfUploadSuccess(true);
        setPdfFile(null);
        setPdfCustomDocName('');
        setTimeout(() => {
          setPdfUploadSuccess(false);
          onClose();
        }, 2000);
      } catch (err) {
        setUploadError(isRtl ? 'خطا در ذخیره‌سازی داده‌های فایل.' : 'Error storing file payload.');
      }
    };
    reader.onerror = () => {
      setUploadError(isRtl ? 'خطا در خواندن فایل PDF.' : 'Error reading PDF file content.');
    };
    reader.readAsDataURL(pdfFile);
  };

  // Detect the archetype of a document based on its name to generate custom-tailored schemas
  const getDocumentArchetype = (docName: string): 'swot' | 'fmea' | 'calibration' | 'kpi' | 'spc' | 'general' => {
    const name = docName.toLowerCase();
    if (name.includes('swot') || name.includes('بافت') || name.includes('محیط')) return 'swot';
    if (name.includes('risk') || name.includes('fmea') || name.includes('ریسک') || name.includes('فرصت')) return 'fmea';
    if (name.includes('calib') || name.includes('کالیبر') || name.includes('ابزار')) return 'calibration';
    if (name.includes('kpi') || name.includes('شاخص') || name.includes('اهداف')) return 'kpi';
    if (name.includes('spc') || name.includes('آماری') || name.includes('کنترل فرآیند')) return 'spc';
    return 'general';
  };

  // 1. DYNAMIC EXCEL TEMPLATE GENERATION (.xls)
  const handleDownloadExcel = (docName: string) => {
    const archetype = getDocumentArchetype(docName);
    const docCode = `QMS-FM-${clause.id.replace(/\./g, '_')}-01`;
    const docTitle = docName.replace(/\s*\(ارجاع به بند.*\)/, '').trim();

    let columnsHtml = '';
    let rowsHtml = '';

    if (archetype === 'swot') {
      columnsHtml = `
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:50px;">ردیف</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:150px;">دسته‌بندی SWOT</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:200px;">عنوان عامل استراتژیک</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:350px;">شرح تاثیر و پیامد عامل در زنجیره ارزش</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:80px;">وزن (0-1)</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:80px;">امتیاز (1-10)</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:100px;">نمره نهایی</th>
      `;
      for (let i = 1; i <= 5; i++) {
        rowsHtml += `
          <tr>
            <td style="border:1px solid #000; padding:8px; text-align:center;">${i}</td>
            <td style="border:1px solid #000; padding:8px; text-align:right; color:#777;">[نقاط قوت / نقاط ضعف / فرصت‌ها / تهدیدها]</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center; font-weight:bold; background-color:#F8FAFC;">=E${i+12}*F${i+12}</td>
          </tr>
        `;
      }
    } else if (archetype === 'fmea') {
      columnsHtml = `
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:50px;">ردیف</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:200px;">شرح حالت شکست یا ریسک بالقوه</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:70px;">شدت (S)</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:250px;">کنترل‌های پیشگیرانه فعلی</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:70px;">وقوع (O)</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:250px;">روش‌های کشف فعلی</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:70px;">کشف (D)</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:90px;">اولویت (RPN)</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:200px;">اقدام اصلاحی/پیشگیرانه پیشنهادی</th>
      `;
      for (let i = 1; i <= 5; i++) {
        rowsHtml += `
          <tr>
            <td style="border:1px solid #000; padding:8px; text-align:center;">${i}</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center; font-weight:bold; background-color:#F8FAFC;">=C${i+12}*E${i+12}*G${i+12}</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"></td>
          </tr>
        `;
      }
    } else if (archetype === 'calibration') {
      columnsHtml = `
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:50px;">ردیف</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:180px;">نام ابزار / شناسه</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:120px;">خطای مجاز MPE</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:150px;">مرجع کالیبراسیون</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:100px;">قرائت مرجع</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:100px;">قرائت ابزار تحت تست</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:100px;">میزان خطای محاسباتی</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:120px;">وضعیت انطباق (پذیرش/عدم)</th>
      `;
      for (let i = 1; i <= 5; i++) {
        rowsHtml += `
          <tr>
            <td style="border:1px solid #000; padding:8px; text-align:center;">${i}</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center; font-weight:bold; background-color:#F8FAFC;">=F${i+12}-E${i+12}</td>
            <td style="border:1px solid #000; padding:8px; text-align:center; color:#777;">[قبول / مشروط / رد]</td>
          </tr>
        `;
      }
    } else if (archetype === 'kpi') {
      columnsHtml = `
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:50px;">ردیف</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:220px;">عنوان شاخص کلیدی عملکرد (KPI)</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:100px;">واحد اندازه‌گیری</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:120px;">هدف مصوب (Target)</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:120px;">عملکرد واقعی (Actual)</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:120px;">درصد تحقق</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:250px;">تحلیل انحراف و اقدام اصلاحی لازم</th>
      `;
      for (let i = 1; i <= 5; i++) {
        rowsHtml += `
          <tr>
            <td style="border:1px solid #000; padding:8px; text-align:center;">${i}</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center; font-weight:bold; background-color:#F8FAFC;">=E${i+12}/D${i+12}*100</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"></td>
          </tr>
        `;
      }
    } else if (archetype === 'spc') {
      columnsHtml = `
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:50px;">ردیف</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:200px;">ویژگی کیفی تحت پایش</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:100px;">حد بالا USL</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:100px;">حد پایین LSL</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:220px;">قرائت‌های اندازه‌گیری (زیرگروه‌ها)</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:100px;">میانگین محاسباتی</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:100px;">انحراف معیار (σ)</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:100px;">شاخص توانمندی Cpk</th>
      `;
      for (let i = 1; i <= 5; i++) {
        rowsHtml += `
          <tr>
            <td style="border:1px solid #000; padding:8px; text-align:center;">${i}</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center; font-family:monospace; color:#555;">12.02, 11.98, 12.05, 12.01, 11.99</td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center; font-weight:bold; background-color:#F8FAFC;">1.33</td>
          </tr>
        `;
      }
    } else {
      columnsHtml = `
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:50px;">ردیف</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:300px;">شرح فعالیت / پارامتر یا بند کنترلی</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:250px;">معیار پذیرش یا روش اجرایی مرجع</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:150px;">مسئول فرآیند / بررسی</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:150px;">وضعیت تحقق (پذیرش/عدم انطباق)</th>
        <th style="background-color:#E2E8F0; border:1px solid #000; padding:8px; font-weight:bold; width:200px;">شواهد اثباتی و شماره آرشیو پیوست</th>
      `;
      for (let i = 1; i <= 6; i++) {
        rowsHtml += `
          <tr>
            <td style="border:1px solid #000; padding:8px; text-align:center;">${i}</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center;"></td>
            <td style="border:1px solid #000; padding:8px; text-align:center; color:#999;">[انطباق کامل / مغایرت جزیی / شکاف سیستماتیک]</td>
            <td style="border:1px solid #000; padding:8px; text-align:right;"></td>
          </tr>
        `;
      }
    }

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <style>
          body { font-family: Tahoma, Arial, sans-serif; direction: rtl; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .header-table td { border: 2px solid #000; padding: 10px; font-weight: bold; text-align: center; }
          .main-table { width: 100%; border-collapse: collapse; }
          .main-table th { border: 1px solid #000; padding: 10px; text-align: center; font-size: 11pt; background-color: #E2E8F0; }
          .main-table td { border: 1px solid #000; padding: 10px; font-size: 10pt; }
        </style>
      </head>
      <body>
        <!-- QUALITY ASSURANCE SYSTEM STANDARD DOCUMENT HEADER -->
        <table class="header-table">
          <tr>
            <td rowspan="2" style="width: 25%; font-size: 14pt; color: #D97706; font-family:Impact,sans-serif; text-align:center;">
              IATF 16949<br/><span style="font-size: 9pt; color:#555;">سیستم مدیریت کیفیت خودرو</span>
            </td>
            <td style="width: 50%; font-size: 13pt;">فرم خام: ${docTitle}</td>
            <td style="width: 25%; font-size: 10pt; text-align: right;">کد سند: ${docCode}</td>
          </tr>
          <tr>
            <td style="font-size: 9pt; font-weight: normal;">مرتبط با بند استاندارد: ${clause.number} (${clause.title})</td>
            <td style="font-size: 9pt; text-align: right; font-weight: normal;">تاریخ بازنگری: 1405/01/15<br/>شماره ویرایش: 01<br/>صفحه: ۱ از ۱</td>
          </tr>
        </table>

        <!-- MASTER BLANK SPREADSHEET GRID -->
        <table class="main-table">
          <thead>
            <tr>${columnsHtml}</tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="margin-top: 30px; font-size: 9pt; text-align: left; font-style: italic;">
          تهیه کننده: کارشناس سیستم‌ها و روش‌ها -------------------- تایید کننده: مدیریت تضمین کیفیت کارخانه
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${docTitle.replace(/\s+/g, '_')}_خام.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(docName);
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  // 2. DYNAMIC WORK INSTRUCTION WORD TEMPLATE GENERATION (.doc)
  const handleDownloadWord = (docName: string) => {
    const archetype = getDocumentArchetype(docName);
    const docCode = `QMS-WI-${clause.id.replace(/\./g, '_')}-01`;
    const docTitle = docName.replace(/\s*\(ارجاع به بند.*\)/, '').trim();

    let methodStepsHtml = '';
    if (archetype === 'swot') {
      methodStepsHtml = `
        <li><b>گام اول (تشکیل کارگروه CFT):</b> دعوت از مدیران تضمین کیفیت، تولید، نگهداری و بازرگانی جهت طوفان فکری SWOT.</li>
        <li><b>گام دوم (شناسایی قوت‌ها و ضعف‌های داخلی):</b> بررسی شاخص‌های OEE، درصد ضایعات خطوط، راندمان مهندسی و فرسودگی ماشین‌آلات.</li>
        <li><b>گام سوم (شناسایی فرصت‌ها و تهدیدهای بیرونی):</b> تحلیل الزامات جدید ایران خودرو و سایپا، نوسانات نرخ ارز و پتانسیل‌های صادراتی.</li>
        <li><b>گام چهارم (وزن‌دهی و امتیازدهی):</b> به هر عامل وزنی بین 0 تا 1 اختصاص داده و میزان اهمیت آن را در موفقیت سازمان از 1 تا 10 امتیازدهی کنید.</li>
        <li><b>گام پنجم (تدوین اقدامات استراتژیک):</b> برای کاهش تهدیدها و بهبود نقاط ضعف، کدهای اقدام اصلاحی (اقدام استراتژیک) صادر نمایید.</li>
      `;
    } else if (archetype === 'fmea') {
      methodStepsHtml = `
        <li><b>گام اول (تعیین کارگروه ارزیابی ریسک):</b> تشکیل تیم با حضور مهندس فرآیند، سرپرست کارگاه، کارشناس QC و نگهداری تجهیزات.</li>
        <li><b>گام دوم (نقشه‌برداری فرآیند):</b> تفکیک فرآیند تولید به مراحل جزیی طبق فرآیندنامه (Process Flow).</li>
        <li><b>گام سوم (شناسایی حالات شکست بالقوه):</b> شناسایی عیوب احتمالی قطعه (مثلا ترک، انحراف ابعادی) یا تجهیز (مثلا افت فشار هیدرولیک).</li>
        <li><b>گام چهارم (امتیازدهی S, O, D):</b> بر اساس راهنماهای استاندارد IATF، شدت (Severity)، وقوع (Occurrence) و کشف (Detection) را بین 1 تا 10 امتیازدهی کنید.</li>
        <li><b>گام پنجم (محاسبه RPN و اقدام اصلاحی):</b> در صورت فراتر رفتن حاصلضرب RPN از 100 یا دارا بودن شدت اثر بحرانی (S>=8)، بلافاصله سناریوی اقدام مهار جایگزین یا پوکایوکه را مستقر کنید.</li>
      `;
    } else if (archetype === 'calibration') {
      methodStepsHtml = `
        <li><b>گام اول (ثبت ابزار در لیست کالیبراسیون):</b> ثبت کلیه کولیس‌ها، میکرومترها، گِیج‌ها و سنسورهای خط در شناسنامه ابزار.</li>
        <li><b>گام دوم (تعیین فواصل زمانی):</b> تعیین دوره تناوب کالیبراسیون (مثلا ۶ ماهه یا یکساله) متناسب با فراوانی کاربری و حساسیت اندازه‌گیری.</li>
        <li><b>گام سوم (صحت‌سنجی روزانه):</b> قبل از شروع کار در هر شیفت، صحت‌سنجی ابزار با بلوک‌های تست استاندارد (مسترکیب) انجام شود.</li>
        <li><b>گام چهارم (ارزیابی انحراف و تصمیم‌گیری):</b> در صورتی که انحراف قرائت ابزار بیش از حد مجاز MPE باشد، ابزار بلافاصله با برچسب قرمز قرنطینه شده و کلیه سوابق تولیدی شیفت گذشته تحت بررسی مجدد قرار می‌گیرد.</li>
      `;
    } else if (archetype === 'kpi') {
      methodStepsHtml = `
        <li><b>گام اول (تعریف اهداف کیفیت):</b> استخراج شاخص‌های فرآیندی شامل درصد ضایعات، راندمان کارگاه (OEE) و بازگشتی مشتری (PPM).</li>
        <li><b>گام دوم (فرمول‌نویسی یکتا):</b> تعریف دقیق متغیرهای ریاضی فرمول پایش به صورت کاملا شفاف جهت جلوگیری از رفتارهای متناقض اپراتورها.</li>
        <li><b>گام سوم (پایش ماهانه عملکرد واقعی):</b> تجمیع کارکرد روزانه خطوط در پایان هر ماه توسط مالکان فرآیندها.</li>
        <li><b>گام چهارم (بررسی انحرافات):</b> در صورتی که درصد تحقق اهداف فرآیند زیر ۹۰ درصد باشد، مالک فرآیند ملزم به گشایش پورتال اقدام اصلاحی و ثبت گزارش ریشه‌یابی ۸D است.</li>
      `;
    } else if (archetype === 'spc') {
      methodStepsHtml = `
        <li><b>گام اول (تعیین ویژگی کلیدی فرآیند):</b> انتخاب ابعاد بحرانی قطعه (دارای علامت CC یا SC در نقشه‌های مهندسی).</li>
        <li><b>گام دوم (نمونه‌برداری دوره‌ای):</b> اندازه‌گیری و ثبت ابعاد قطعات در فواصل زمانی ثابت (مثلا ۵ قطعه متوالی در هر ۲ ساعت).</li>
        <li><b>گام سوم (رسم نمودارهای کنترل):</b> ثبت مقادیر روی نمودار کنترل میانگین (X-bar) و دامنه تغییرات (R).</li>
        <li><b>گام چهارم (تحلیل روندها):</b> پایش فرآیند بر اساس قوانین آماری (قوانین وسترن الکتریک) جهت ردیابی علل خاص قبل از خروج فرآیند از کنترل.</li>
        <li><b>گام پنجم (بررسی شاخص Cpk):</b> فرآیند تولید انبوه خودروسازان باید توانمندی بالا داشته و Cpk بزرگتر یا مساوی 1.33 را تضمین کند.</li>
      `;
    } else {
      methodStepsHtml = `
        <li><b>گام اول (برنامه‌ریزی مستندات):</b> بررسی دقیق الزامات ممیزی بند ${clause.number} استاندارد IATF 16949 و شناسایی شکاف‌های موجود.</li>
        <li><b>گام دوم (تدوین پیش‌نویس):</b> طراحی فیلدهای ثبت داده و تایید ساختار توسط مهندسین ارشد کیفیت.</li>
        <li><b>گام سوم (آموزش پرسنل):</b> ابلاغ روش کار و فرم مربوطه به پرسنل مرتبط و تفهیم پیامدهای عدم رعایت رویه‌های کیفی.</li>
        <li><b>گام چهارم (ثبت و بازنگری مداوم):</b> تکمیل روزانه سوابق و اطمینان از خوانا بودن، دسترسی سریع، ایمنی در بایگانی و حفاظت در برابر مفقودی.</li>
      `;
    }

    const htmlContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <style>
          body { font-family: 'B Nazanin', 'Times New Roman', serif; direction: rtl; line-height: 1.6; }
          .header-box { border: 3px double #000; padding: 15px; margin-bottom: 25px; text-align: center; }
          .title-lg { font-size: 16pt; font-weight: bold; margin-bottom: 5px; }
          .section-title { font-size: 12pt; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 4px; margin-top: 20px; color: #1E3A8A; }
          .paragraph { font-size: 11pt; text-align: justify; margin-top: 8px; text-indent: 15px; }
          .steps-list { font-size: 11pt; margin-top: 8px; padding-right: 20px; }
          .steps-list li { margin-bottom: 8px; text-align: justify; }
          .table-style { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .table-style th { border: 1px solid #000; padding: 6px; background-color: #F1F5F9; font-size: 10pt; text-align: center; }
          .table-style td { border: 1px solid #000; padding: 6px; font-size: 10pt; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div style="font-size: 10pt; font-weight: bold; float: left; text-align: left;">کد سند: ${docCode}<br/>نسخه: 01</div>
          <div class="title-lg">دستورالعمل کاری و روش اجرایی استاندارد (WI)</div>
          <div style="font-size: 13pt; font-weight: bold; margin-top: 10px;">موضوع: روش اجرای تدوین و پایش ${docTitle}</div>
          <div style="font-size: 10pt; margin-top: 5px; font-weight: normal;">مرتبط با الزامات ممیزی بند ${clause.number} استاندارد IATF 16949:2016</div>
        </div>

        <div class="section-title">۱. هدف (Purpose)</div>
        <p class="paragraph">
          هدف از تدوین این دستورالعمل کاری، تشریح جامع گام‌های اجرایی، حدود اختیارات، روش پایش و پدیدآوری سوابق مرتبط با سند «${docTitle}» منطبق بر الزامات خاص خودروسازان و استانداردهای زنجیره تامین IATF 16949 است تا از پایداری کیفیت فرآیندها، پیشگیری از عیوب و پایش ریسک‌ها اطمینان حاصل گردد.
        </p>

        <div class="section-title">۲. دامنه کاربرد (Scope)</div>
        <p class="paragraph">
          این روش اجرایی و استاندارد در سطح کلیه کارگاه‌های تولیدی، آزمایشگاه‌ها، دپارتمان مهندسی فرآیند، برنامه‌ریزی تولید و تضمین کیفیت مستقر در کارخانجات زنجیره تامین خودروسازی جاری و لازم‌الاجرا می‌باشد.
        </p>

        <div class="section-title">۳. مسئولیت‌ها (Responsibilities)</div>
        <p class="paragraph">
          مسئولیت نظارت عالیه بر حسن اجرای فرآیند بر عهده <b>مدیریت تضمین کیفیت کارخانه (QA)</b> است. مالکان فرآیندها، سرپرستان خطوط، بازرسان کنترل کیفیت و پرسنل کارگاه موظف به اجرای دقیق گام‌های تشریح شده و تکمیل کامل برگه فرم‌های ثبت داده وابسته هستند.
        </p>

        <div class="section-title">۴. شرح روش اجرا و گام‌های کلیدی (Procedure Steps)</div>
        <ul class="steps-list">
          ${methodStepsHtml}
        </ul>

        <div class="section-title">۵. مراجع، اصطلاحات و تعاریف وابسته</div>
        <p class="paragraph">
          - <b>استاندارد مرجع:</b> الزامات فنی ممیزی بند ${clause.number} الزامات زنجیره تامین خودروسازی IATF 16949.<br/>
          - <b>فرم وابسته:</b> هرگونه سوابق حاصل از این دستورالعمل کاری باید در فرم استاندارد به شماره <b>QMS-FM-${clause.id.replace(/\./g, '_')}-01</b> ثبت و به صورت زنده یا فیزیکی بایگانی شود.
        </p>

        <div class="section-title">۶. تاریخچه بازنگری و تغییرات سند (Revision History)</div>
        <table class="table-style">
          <thead>
            <tr>
              <th>شماره بازنگری</th>
              <th>تاریخ اصلاح</th>
              <th>علت تغییرات و بازنگری</th>
              <th>تدوین‌کننده</th>
              <th>تاییدکننده نهایی</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>01</td>
              <td>1405/01/15</td>
              <td>انتشار اولیه متناسب با ویرایش جدید الزامات ممیزی IATF</td>
              <td>کارشناس مهندسی کیفیت</td>
              <td>مدیر تضمین کیفیت کارخانه</td>
            </tr>
          </tbody>
        </table>

        <div style="margin-top: 40px; border-top: 1px solid #000; padding-top: 10px; font-size: 10pt; text-align: center;">
          <b>سند طبقه‌بندی شده • صادر شده توسط سیستم مکانیزه ارزیابی جامع کیفیت خودرو</b>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob(['\uFEFF' + htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${docTitle.replace(/\s+/g, '_')}_دستورالعمل.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(docName);
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  // 3. PRINT BLANK TEMPLATE (Opens dedicated printer-friendly window)
  const handlePrintTemplate = (docName: string) => {
    const archetype = getDocumentArchetype(docName);
    const docCode = `QMS-FM-${clause.id.replace(/\./g, '_')}-01`;
    const docTitle = docName.replace(/\s*\(ارجاع به بند.*\)/, '').trim();

    let columns = [];
    if (archetype === 'swot') {
      columns = ['ردیف', 'دسته‌بندی SWOT', 'عنوان عامل استراتژیک', 'شرح تاثیر و پیامد عامل در زنجیره ارزش', 'وزن (0-1)', 'امتیاز (1-10)', 'نمره نهایی'];
    } else if (archetype === 'fmea') {
      columns = ['ردیف', 'شرح حالت شکست یا ریسک بالقوه', 'شدت (S)', 'کنترل‌های پیشگیرانه جاری', 'وقوع (O)', 'روش‌های کشف جاری', 'کشف (D)', 'اولویت (RPN)', 'اقدام اصلاحی پیشنهادی'];
    } else if (archetype === 'calibration') {
      columns = ['ردیف', 'نام ابزار / شناسه', 'خطای مجاز MPE', 'مرجع کالیبراسیون', 'قرائت مرجع', 'قرائت تحت تست', 'میزان خطا', 'وضعیت انطباق'];
    } else if (archetype === 'kpi') {
      columns = ['ردیف', 'عنوان شاخص کلیدی عملکرد (KPI)', 'واحد اندازه‌گیری', 'حد اهداف (Target)', 'عملکرد واقعی (Actual)', 'درصد تحقق', 'تحلیل ریشه و اقدام اصلاحی'];
    } else if (archetype === 'spc') {
      columns = ['ردیف', 'ویژگی کیفی تحت پایش', 'حد بالا USL', 'حد پایین LSL', 'قرائت‌های نمونه‌برداری', 'میانگین', 'انحراف معیار (σ)', 'شاخص Cpk'];
    } else {
      columns = ['ردیف', 'شرح فعالیت یا بند کنترلی', 'معیار پذیرش یا روش اجرایی مرجع', 'مسئول فرآیند', 'وضعیت انطباق نهایی', 'شواهد فیزیکی و شماره آرشیو'];
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tableHeaders = columns.map(col => `<th style="border:1px solid #000; padding:10px; background-color:#f1f5f9; font-weight:bold; text-align:center; font-size:10pt;">${col}</th>`).join('');
    let tableRows = '';
    for (let i = 1; i <= 8; i++) {
      tableRows += `
        <tr>
          <td style="border:1px solid #000; padding:12px; text-align:center; font-size:10pt;">${i}</td>
          ${columns.slice(1).map(() => `<td style="border:1px solid #000; padding:12px; text-align:right; font-size:10pt;"></td>`).join('')}
        </tr>
      `;
    }

    printWindow.document.write(`
      <html>
      <head>
        <title>چاپ فرم خام: ${docTitle}</title>
        <style>
          @media print {
            body { margin: 1.5cm; }
            .no-print { display: none; }
          }
          body { font-family: Tahoma, Arial, sans-serif; direction: rtl; margin: 20px; line-height: 1.5; color:#000; background:#fff; }
          .header-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          .header-table td { border: 2px solid #000; padding: 12px; font-weight: bold; text-align: center; }
          .main-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .btn-print-now { background-color: #D97706; color: #fff; border: none; padding: 10px 20px; font-weight: bold; border-radius: 5px; cursor: pointer; font-family: Tahoma; }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; text-align: left;">
          <button class="btn-print-now" onclick="window.print();">🖨️ تایید و ارسال به پرینتر</button>
        </div>

        <table class="header-table">
          <tr>
            <td rowspan="2" style="width: 25%; font-size: 15pt; color: #b45309; text-align:center;">
              IATF 16949<br/><span style="font-size: 8pt; color:#555; font-weight:normal;">سیستم مدیریت کیفیت خودروسازی</span>
            </td>
            <td style="width: 50%; font-size: 14pt;">برگه خام ممیزی: ${docTitle}</td>
            <td style="width: 25%; font-size: 9pt; text-align: right;">کد سند: ${docCode}</td>
          </tr>
          <tr>
            <td style="font-size: 9pt; font-weight: normal;">مرتبط با بند استاندارد: ${clause.number} - ${clause.title}</td>
            <td style="font-size: 9pt; text-align: right; font-weight: normal;">تاریخ بازنگری: 1405/01/15<br/>ویرایش: 01<br/>صفحه: ۱ از ۱</td>
          </tr>
        </table>

        <table class="main-table">
          <thead>
            <tr>${tableHeaders}</tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div style="margin-top: 50px; font-size: 9.5pt; text-align: right; font-style: italic; width: 100%; display: flex; justify-content: space-between;">
          <span>تهیه کننده: کارشناس تضمین کیفیت کارخانه</span>
          <span>تایید کننده: نماینده مدیریت در سیستم کیفیت (QA)</span>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-[#0b0b0d] border border-zinc-800/80 w-full max-w-2xl rounded-2xl flex flex-col overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.9)] max-h-[85vh] select-none">
        
        {/* Header */}
        <header className="bg-[#111114] border-b border-zinc-800 p-4 sm:p-5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center shrink-0">
              <FileText size={18} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-black text-white tracking-wider truncate">
                {isRtl ? 'سامانه مدارک خام و بارگذاری پی‌دی‌اف اسناد' : 'Document Boilerplates & PDF Loader'}
              </h1>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 mt-1 truncate">
                {isRtl ? `بند ${clause.number}: ${clause.title}` : `Clause ${clause.number}: ${clause.title}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="hover:bg-zinc-800 text-zinc-400 hover:text-white p-2 rounded-xl border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer"
            title={isRtl ? 'بستن' : 'Close'}
          >
            <X size={16} />
          </button>
        </header>

        {/* SUB-TABS */}
        <div className="flex items-center border-b border-zinc-800 bg-[#0e0e11] px-4 shrink-0">
          <button
            onClick={() => setActiveTab('download')}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer ${
              activeTab === 'download'
                ? 'border-amber-500 text-amber-500 bg-amber-500/5'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            {isRtl ? '📥 دریافت فرم‌های خام و دستورالعمل‌ها' : '📥 Download Templates'}
          </button>
          <button
            onClick={() => setActiveTab('upload_pdf')}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all cursor-pointer ${
              activeTab === 'upload_pdf'
                ? 'border-amber-500 text-amber-500 bg-amber-500/5'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            {isRtl ? '📤 بارگذاری و الحاق فایل PDF به سوابق' : '📤 Upload PDF Record'}
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar bg-[#070709]">
          
          {activeTab === 'download' ? (
            <>
              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl text-right flex items-start gap-2.5">
                <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-[10px] sm:text-[11px] text-zinc-400 leading-relaxed">
                  {isRtl 
                    ? 'در این بخش می‌توانید قالب تهی‌شده کلیه فرم‌های خام اکسل و رویه‌های کاری متناسب با ممیزی این بند استاندارد را جهت پرینت فیزیکی یا استفاده آفلاین به صورت کاملا پویا دریافت نمایید. همچنین می‌توانید گام‌های اجرای هر سند را مکتوب دریافت کنید.'
                    : 'Download dynamic boilerplate Excel-formatted spreadsheets or standard Word work procedures for the required compliance artifacts of this IATF clause.'}
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider pr-1">
                  {isRtl ? 'مستندات و فرم‌های قابل دریافت این بند:' : 'Downloadable compliance documents:'}
                </h3>

                {docsList.length === 0 ? (
                  <div className="text-center py-8 text-zinc-600 italic text-[11px]">
                    {isRtl ? 'هیچ سند یا فرم مورد نیازی برای این بند تعریف نشده است.' : 'No compliance documents are defined for this clause.'}
                  </div>
                ) : (
                  docsList.map((docName, idx) => {
                    const archetype = getDocumentArchetype(docName);
                    const codePrefix = archetype === 'general' ? 'QMS-FM' : `QMS-${archetype.toUpperCase()}`;
                    const docCode = `${codePrefix}-${clause.id.replace(/\./g, '_')}-${(idx + 1).toString().padStart(2, '0')}`;
                    const cleanName = docName.replace(/\s*\(ارجاع به بند.*\)/, '').trim();

                    return (
                      <div 
                        key={idx} 
                        className="p-3.5 bg-[#0e0e11] border border-zinc-800/60 rounded-xl hover:border-zinc-750 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-right"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-1.5 justify-start">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                            <span className="text-xs font-bold text-white block truncate leading-tight" title={cleanName}>
                              {cleanName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 justify-start">
                            <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/25 px-1.5 py-0.2 rounded font-mono font-bold tracking-wider">
                              {docCode}
                            </span>
                            <span className="text-[9px] text-zinc-500">
                              {isRtl ? 'نسخه فعال ۰۱' : 'Rev 01'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 justify-end self-end sm:self-auto">
                          {downloadSuccess === docName ? (
                            <div className="flex items-center gap-1 text-[10px] text-green-400 font-bold bg-green-500/10 border border-green-500/20 py-1.5 px-2.5 rounded-lg">
                              <Check size={11} className="animate-bounce" />
                              <span>{isRtl ? 'دریافت شد!' : 'Downloaded!'}</span>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => handleDownloadExcel(docName)}
                                className="bg-zinc-900 hover:bg-zinc-800 text-amber-500 hover:text-amber-400 border border-zinc-800 hover:border-zinc-700 py-1.5 px-2.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer"
                                title={isRtl ? 'دریافت فرم خام اکسل' : 'Download Blank Excel (.xls)'}
                              >
                                <Download size={11} />
                                <span>{isRtl ? 'اکسل خام' : 'XLS Sheet'}</span>
                              </button>
                              
                              <button
                                onClick={() => handleDownloadWord(docName)}
                                className="bg-zinc-900 hover:bg-zinc-800 text-amber-500 hover:text-amber-400 border border-zinc-800 hover:border-zinc-700 py-1.5 px-2.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 cursor-pointer"
                                title={isRtl ? 'دریافت دستورالعمل کاری ورد' : 'Download WI Procedure Word (.doc)'}
                              >
                                <Download size={11} />
                                <span>{isRtl ? 'دستورالعمل ورد' : 'Word WI'}</span>
                              </button>

                              <button
                                onClick={() => handlePrintTemplate(docName)}
                                className="bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 py-1.5 px-2 rounded-lg text-[10px] font-black transition-all flex items-center justify-center cursor-pointer"
                                title={isRtl ? 'چاپ فرم خام کاغذی' : 'Print Blank Template'}
                              >
                                <Printer size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* PDF UPLOADER TAB PANEL */
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="p-3 bg-green-500/5 border border-green-500/10 rounded-xl text-right flex items-start gap-2.5">
                <UploadCloud size={14} className="text-green-500 shrink-0 mt-0.5" />
                <p className="text-[10px] sm:text-[11px] text-zinc-400 leading-relaxed">
                  {isRtl 
                    ? 'از این بخش می‌توانید فایل‌های اسناد رسمی، دستورالعمل‌های محلی، نقشه مهندسی، یا سوابق نتایج آزمون خط تولید خود را با فرمت PDF آپلود کرده و مستقیماً به سوابق انطباق رسمی این بند ضمیمه کنید.'
                    : 'Upload any PDF documentation, work instruction, design sketch, or factory test reports directly into this clause’s compliance folder.'}
                </p>
              </div>

              {pdfUploadSuccess ? (
                <div className="p-8 text-center bg-green-500/10 border border-green-500/20 rounded-xl space-y-3 animate-pulse">
                  <span className="text-3xl">🎉</span>
                  <h4 className="text-xs font-black text-white">{isRtl ? 'سند PDF با موفقیت الحاق و بایگانی شد!' : 'PDF Document Successfully Archived!'}</h4>
                  <p className="text-[10px] text-zinc-400">{isRtl ? 'این سند اکنون در منوی سوابق بند فعال و قابل نمایش است.' : 'It has been integrated in Clause Records & compliance evidence panel.'}</p>
                </div>
              ) : (
                <div className="space-y-4 text-right">
                  {/* File drop zone */}
                  <div className="border-2 border-dashed border-zinc-800 bg-[#0c0c0e] rounded-xl p-6 hover:border-amber-500/50 transition-all text-center relative cursor-pointer group">
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handlePdfFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <UploadCloud size={32} className="mx-auto text-zinc-500 mb-2 group-hover:text-amber-500 transition-colors" />
                    <p className="text-xs font-bold text-white">
                      {pdfFile ? pdfFile.name : (isRtl ? 'کلیک کنید یا فایل PDF را به اینجا بکشید' : 'Click or Drag PDF file here')}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-1 font-sans">
                      {pdfFile ? `${(pdfFile.size / 1024).toFixed(1)} KB` : (isRtl ? 'حداکثر حجم مجاز: ۱۵ مگابایت' : 'Supported format: .pdf (Max 15MB)')}
                    </p>
                  </div>

                  {uploadError && (
                    <div className="text-[10px] text-rose-500 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg text-right font-sans">
                      ⚠️ {uploadError}
                    </div>
                  )}

                  {pdfFile && (
                    <div className="space-y-3 p-4 bg-[#0a0a0d] border border-zinc-850 rounded-xl">
                      {/* Destination settings */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 block">{isRtl ? 'نوع الحاق در سامانه کیفیت:' : 'Association Type:'}</label>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => setPdfDocType('RECORD')}
                            className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              pdfDocType === 'RECORD'
                                ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold'
                                : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white'
                            }`}
                          >
                            <span>📝 {isRtl ? 'افزودن به عنوان سوابق اجرا (شواهد)' : 'Add to Execution Evidence'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPdfDocType('DOCUMENT')}
                            className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                              pdfDocType === 'DOCUMENT'
                                ? 'border-amber-500 bg-amber-500/10 text-amber-500 font-bold'
                                : 'border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:text-white'
                            }`}
                          >
                            <span>📂 {isRtl ? 'افزودن به لیست مستندات الزامی' : 'Add to Required Docs list'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Document Name map */}
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400 block">{isRtl ? 'انطباق و نگاشت به مستند مرجع:' : 'Mapping to required document name:'}</label>
                        <select
                          value={pdfSelectedDoc}
                          onChange={(e) => setPdfSelectedDoc(e.target.value)}
                          className="w-full bg-[#131316] border border-zinc-800 text-xs text-white p-2.5 rounded-lg focus:outline-none"
                        >
                          <option value="">{isRtl ? '-- انتخاب مستند یا تعریف آزاد --' : '-- Choose Document or custom --'}</option>
                          {docsList.map((d, dIdx) => (
                            <option key={dIdx} value={d}>{d.replace(/\s*\(ارجاع به بند.*\)/, '').trim()}</option>
                          ))}
                          <option value="custom">{isRtl ? '✏️ تعریف نام سند به صورت دلخواه...' : '✏️ Enter Custom Document Name...'}</option>
                        </select>
                      </div>

                      {/* Custom document input */}
                      {(pdfSelectedDoc === 'custom' || !pdfSelectedDoc) && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-zinc-400 block">{isRtl ? 'نام سند دلخواه (الزامی):' : 'Custom Document Title (Required):'}</label>
                          <input
                            type="text"
                            value={pdfCustomDocName}
                            onChange={(e) => setPdfCustomDocName(e.target.value)}
                            placeholder={isRtl ? 'مثال: دستورالعمل کالیبراسیون سنسورهای خلاء' : 'Enter a clear title for this PDF'}
                            className="w-full bg-[#131316] border border-zinc-800 text-xs text-white p-2.5 rounded-lg focus:outline-none"
                          />
                        </div>
                      )}

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setPdfFile(null)}
                          className="px-4 py-2 bg-zinc-900 text-zinc-400 hover:text-white text-xs rounded-lg cursor-pointer"
                        >
                          {isRtl ? 'پاک کردن' : 'Clear'}
                        </button>
                        <button
                          type="button"
                          onClick={handleSavePdfUpload}
                          className="px-5 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-black rounded-lg cursor-pointer"
                        >
                          💾 {isRtl ? 'ثبت نهایی و الحاق سند PDF' : 'Save & Attach PDF'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="bg-[#111114] border-t border-zinc-800 p-4 flex justify-between items-center shrink-0">
          <span className="text-[10px] text-zinc-600 font-mono">
            IATF 16949 COMPLIANCE AUTOMATION v2.4
          </span>
          <button
            onClick={onClose}
            className="bg-amber-600 hover:bg-amber-500 text-black font-bold py-2 px-4 rounded text-[10px] uppercase tracking-widest transition-all shadow-md hover:shadow-amber-500/10 cursor-pointer"
          >
            {isRtl ? 'بستن' : 'Close'}
          </button>
        </footer>

      </div>
    </div>
  );
}
