/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, FileText, Calendar, Shield, Users, Clock, Database, Tag, Download, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { documentTemplates } from '../data/documentTemplates';

interface RecordViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: {
    id: string;
    documentName: string;
    clauseId: string;
    archivedAt: string;
    items: any[];
    tables?: any[];
    code: string;
    revision: string;
    preparedBy: string;
    approvedBy: string;
    isPdfAttachment?: boolean;
    fileData?: string;
    fileName?: string;
    fileSize?: number;
    isCumulativeAuditFile?: boolean;
    savedAuditProgram?: any;
    savedAuditChecklist?: any[];
    savedNcs?: any[];
    savedOfis?: any[];
    savedReports?: any[];
  } | null;
  lang: 'fa' | 'en';
}

export default function RecordViewerModal({ isOpen, onClose, record, lang }: RecordViewerModalProps) {
  if (!isOpen || !record) return null;
  const isRtl = lang === 'fa';

  const tables = record.tables || [];
  const [activeTableId, setActiveTableId] = React.useState<string>('default');

  React.useEffect(() => {
    if (record) {
      if (record.tables && record.tables.length > 0) {
        setActiveTableId(record.tables[0].id);
      } else {
        setActiveTableId('default');
      }
    }
  }, [record]);

  const activeTable = React.useMemo(() => {
    return tables.find(t => t.id === activeTableId) || (tables.length > 0 ? tables[0] : null);
  }, [tables, activeTableId]);

  // Find template for headers
  const headers = React.useMemo(() => {
    if (activeTable && activeTable.columns && activeTable.columns.length > 0) {
      return activeTable.columns.map((c: any) => c.label || c.name);
    }
    const templateName = record.documentName.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
    const template = documentTemplates[templateName];
    return template?.headers || ['ستون ۱', 'ستون ۲', 'ستون ۳', 'ستون ۴', 'ستون ۵', 'ستون ۶'];
  }, [record.documentName, activeTable]);

  const displayItems = React.useMemo(() => {
    return activeTable ? activeTable.items : record.items;
  }, [activeTable, record.items]);

  const handleDownloadPdf = () => {
    if (record.fileData) {
      const link = document.createElement('a');
      link.href = record.fileData;
      link.download = record.fileName || 'compliance_document.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleRestoreAuditSession = () => {
    if (confirm(isRtl ? 'آیا مطمئن هستید که می‌خواهید اطلاعات این ممیزی را به عنوان کارتابل فعال بازیابی کنید؟ داده‌های ممیزی فعال فعلی شما با این اطلاعات جایگزین خواهند شد.' : 'Are you sure you want to restore this audit session? Your active workspace will be replaced.')) {
      // Dispatch custom restore event
      const restoreEvent = new CustomEvent('restore-audit-session', {
        detail: {
          program: record.savedAuditProgram,
          checklist: record.savedAuditChecklist,
          ncs: record.savedNcs,
          ofis: record.savedOfis,
          reports: record.savedReports
        }
      });
      window.dispatchEvent(restoreEvent);
      alert(isRtl ? 'اطلاعات جلسه ممیزی با موفقیت در فضای کاری بارگذاری شد! لطفا به زبانه ممیزی داخلی بروید.' : 'Audit session restored successfully! Please check the Internal Audit tab.');
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-[1100] flex items-center justify-center p-4 animate-fade-in sm:p-6 md:p-10"
      onClick={onClose}
    >
      <div 
        className="bg-[#0B0B0C] border border-[#2D2D31] rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-scale-up"
        onClick={(e) => e.stopPropagation()}
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* Header bar */}
        <header className="px-6 py-4 border-b border-[#212124] bg-[#0E0E10] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shadow-inner">
              <Database size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono tracking-widest text-amber-500 font-extrabold uppercase bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {record.isCumulativeAuditFile 
                    ? (isRtl ? 'پرونده جامع ممیزی داخلی IATF' : 'IATF Comprehensive Audit Dossier')
                    : record.isPdfAttachment
                    ? (isRtl ? `پیوست مدرک PDF بند ${record.clauseId}` : `Attached PDF • Clause ${record.clauseId}`)
                    : (isRtl ? `بایگانی رسمی سند • بند ${record.clauseId}` : `Official Snapshot • Clause ${record.clauseId}`)}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              </div>
              <h2 className={`text-base sm:text-lg text-white tracking-tight mt-0.5 ${isRtl ? "fa-heavy" : "font-serif font-semibold"}`}>
                {record.documentName}
              </h2>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#161619] hover:bg-[#202024] text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-[#2D2D31]/30 hover:border-[#2D2D31]"
          >
            <X size={16} />
          </button>
        </header>

        {/* Content scrolling container */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
          
          {/* ISO 9001/IATF control block (Traditional Top-Box Header) */}
          <div className="grid grid-cols-2 md:grid-cols-4 border border-[#2A2A2D] bg-[#0F0F11]/60 rounded-xl overflow-hidden divide-x divide-y divide-[#2A2A2D] text-xs [direction:ltr] md:[direction:inherit]">
            <div className="p-4 flex flex-col justify-center gap-1 min-w-0">
              <span className="text-[9px] text-[#666] font-bold uppercase tracking-wider block">
                {isRtl ? "کد یکتای شناسایی" : "Unique Doc Code"}
              </span>
              <strong className="text-amber-500 font-mono tracking-wider font-extrabold truncate" title={record.code}>
                {record.code}
              </strong>
            </div>
            <div className="p-4 flex flex-col justify-center gap-1 min-w-0">
              <span className="text-[9px] text-[#666] font-bold uppercase tracking-wider block">
                {isRtl ? "نسخه ویرایش بایگانی" : "Archived Revision"}
              </span>
              <strong className="text-white font-mono font-black truncate" title={record.revision}>
                {record.revision}
              </strong>
            </div>
            <div className="p-4 flex flex-col justify-center gap-1 min-w-0">
              <span className="text-[9px] text-[#666] font-bold uppercase tracking-wider block">
                {isRtl ? "زمان دقیق ثبت و امضا" : "Archived Timestamp"}
              </span>
              <div className="flex items-center gap-1.5 text-slate-300 font-medium font-sans truncate" title={record.archivedAt}>
                <Clock size={12} className="text-slate-500 shrink-0" />
                <span className="font-mono text-[11px]">{record.archivedAt}</span>
              </div>
            </div>
            <div className="p-4 flex flex-col justify-center gap-1 min-w-0">
              <span className="text-[9px] text-[#666] font-bold uppercase tracking-wider block">
                {isRtl ? "تایید صلاحیت نهایی" : "Approver Sign-off"}
              </span>
              <div className="flex items-center gap-1.5 text-[#BBB] font-medium truncate" title={record.approvedBy}>
                <Shield size={12} className="text-green-500 shrink-0" />
                <span>{record.approvedBy}</span>
              </div>
            </div>
          </div>

          {/* Render PDF Attachment Panel */}
          {record.isPdfAttachment ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-500/5 border border-green-500/10 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 text-right">
                  <h3 className="text-xs font-black text-white flex items-center gap-2">
                    <FileText size={14} className="text-green-500" />
                    <span>{record.fileName || 'document.pdf'}</span>
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    {isRtl 
                      ? `سند الحاق شده به حجم ${((record.fileSize || 0) / 1024).toFixed(1)} کیلوبایت • این فایل بر روی سیستم کیفیت ثبت شده است.` 
                      : `Attached document size: ${((record.fileSize || 0) / 1024).toFixed(1)} KB`}
                  </p>
                </div>
                <button
                  onClick={handleDownloadPdf}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow-md shadow-green-600/10 cursor-pointer"
                >
                  <Download size={14} />
                  <span>{isRtl ? '📥 دانلود فایل PDF اصلی' : '📥 Download PDF'}</span>
                </button>
              </div>

              {/* PDF Document Viewer Simulation */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-[#121214] flex flex-col h-[420px]">
                {/* Simulated Viewer Menu */}
                <div className="bg-[#18181b] border-b border-zinc-800 px-4 py-2 flex items-center justify-between text-xs text-zinc-400 font-sans">
                  <div className="flex items-center gap-3">
                    <FileText size={14} className="text-amber-500" />
                    <span className="font-bold text-zinc-300">{record.fileName || 'Preview.pdf'}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">Page 1 of 1</span>
                    <span className="text-[10px] text-zinc-500">|</span>
                    <span className="text-[10px] text-zinc-400">Zoom 100%</span>
                  </div>
                </div>

                {/* Simulated Sheet Paper */}
                <div className="flex-1 bg-zinc-900 p-8 overflow-y-auto flex justify-center custom-scrollbar">
                  <div className="bg-white text-black p-8 max-w-2xl w-full aspect-[1/1.4] shadow-2xl flex flex-col justify-between select-text" style={{ fontFamily: 'Tahoma, Arial, sans-serif' }}>
                    {/* Sheet Header */}
                    <div className="border-2 border-black p-4 flex justify-between items-center text-center">
                      <div className="text-xs font-bold text-amber-700 font-mono">
                        IATF 16949 COMPLIANT
                      </div>
                      <div className="text-sm font-black tracking-tight">
                        {record.documentName.replace(/\(.*\)/, '').trim()}
                      </div>
                      <div className="text-[10px] text-right text-zinc-600 font-mono">
                        CODE: {record.code}<br/>
                        REV: {record.revision}
                      </div>
                    </div>

                    {/* Sheet Content */}
                    <div className="flex-1 py-12 space-y-6 text-right" dir="rtl">
                      <h3 className="text-xs font-bold border-b border-zinc-300 pb-1 text-zinc-800">📌 تاییدیه و مستندات الحاق الکترونیکی</h3>
                      <p className="text-[11px] text-zinc-700 leading-relaxed text-justify">
                        این فایل با مشخصات فنی پیوست شده، به عنوان یکی از مدارک مرجع و شواهد عینی منطبق با نیازمندی‌های کیفی در بند <b>{record.clauseId}</b> ارزیابی و در پایگاه داده مرکزی سیستم مدیریت کیفیت خودروسازی کارخانه ذخیره گردیده است.
                      </p>

                      <div className="bg-zinc-50 p-4 border border-zinc-200 rounded text-[11px] space-y-2">
                        <div className="flex justify-between">
                          <span className="font-bold text-zinc-600">نام فایل مبدا:</span>
                          <span className="font-mono">{record.fileName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold text-zinc-600">اندازه کل بایت:</span>
                          <span className="font-mono">{((record.fileSize || 0) / 1024).toFixed(1)} KB</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold text-zinc-600">تاریخ آپلود و بایگانی:</span>
                          <span>{record.archivedAt}</span>
                        </div>
                      </div>

                      <div className="pt-6 text-[10px] text-zinc-500 italic text-center">
                        فایل اصلی رمزنگاری شده و از طریق کلید «دانلود فایل PDF اصلی» در بالا قابل دسترسی و استخراج مستقیم است.
                      </div>
                    </div>

                    {/* Sheet Footer */}
                    <div className="border-t border-black pt-2 flex justify-between items-center text-[9px] text-zinc-500">
                      <span>سیستم مدیریت کیفیت خودروسازی کارخانه</span>
                      <span>سند رسمی بایگانی • غیر قابل ویرایش</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : record.isCumulativeAuditFile ? (
            /* Cumulative Audit Dossier View */
            <div className="space-y-6">
              <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1 text-right">
                  <h3 className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                    <RefreshCw size={14} className="animate-spin-slow" />
                    <span>قابلیت ویژه: بازیابی زنده جلسه ممیزی</span>
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    {isRtl 
                      ? 'می‌توانید اطلاعات کامل این پرونده تجمعی ممیزی (شامل تقویم برنامه، چک لیست‌ها، نمرات ارزیابی و مغایرت‌ها) را مجدداً به فضای کاری فعال سیستم بازیابی کنید.' 
                      : 'You can restore this entire compliance dossier back into your active workspace as the active session.'}
                  </p>
                </div>
                <button
                  onClick={handleRestoreAuditSession}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-black text-xs font-black rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-lg hover:shadow-amber-500/10"
                >
                  <RefreshCw size={13} />
                  <span>{isRtl ? '🔄 بازیابی به کارتابل فعال جاری' : '🔄 Restore Active Session'}</span>
                </button>
              </div>

              {/* Audit Program Details */}
              {record.savedAuditProgram && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-white border-r-2 border-amber-500 pr-2">{isRtl ? '📅 برنامه ممیزی اجرا شده' : 'Calendar Program'}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 bg-[#0e0e11] border border-zinc-800 p-4 rounded-xl text-right">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-zinc-500 block">{isRtl ? 'شناسه / عنوان دوره ممیزی:' : 'Audit ID / Title:'}</span>
                      <strong className="text-xs text-white">{record.savedAuditProgram.id} - {record.savedAuditProgram.title}</strong>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-zinc-500 block">{isRtl ? 'تاریخ برنامه‌ریزی شده:' : 'Planned Date:'}</span>
                      <strong className="text-xs text-amber-500 font-mono">{record.savedAuditProgram.date || record.savedAuditProgram.auditDate}</strong>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-zinc-500 block">{isRtl ? 'سرممیز رسمی دوره:' : 'Lead Auditor:'}</span>
                      <strong className="text-xs text-green-400">{record.savedAuditProgram.leadAuditor || 'سرممیز ارشد تضمین کیفیت'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Checklist questions & Findings matrix */}
              {record.savedAuditChecklist && record.savedAuditChecklist.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-white border-r-2 border-amber-500 pr-2">{isRtl ? '📋 چک‌لیست فرآیندها و ارزیابی انطباق' : 'Audit Checklist Findings'}</h3>
                  <div className="border border-zinc-800 rounded-xl overflow-hidden bg-[#0A0A0B]">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="bg-zinc-900 border-b border-zinc-800 text-zinc-400 font-bold">
                          <th className="px-3 py-2.5 w-12 text-center border-l border-zinc-800">#</th>
                          <th className="px-3 py-2.5 border-l border-zinc-800">{isRtl ? 'فرآیند مورد ممیزی' : 'Process Audited'}</th>
                          <th className="px-3 py-2.5 border-l border-zinc-800">{isRtl ? 'بند استاندارد / الزام' : 'Clause Requirement'}</th>
                          <th className="px-3 py-2.5 border-l border-zinc-800 text-center">{isRtl ? 'وضعیت انطباق' : 'Compliance'}</th>
                          <th className="px-3 py-2.5 border-l border-zinc-800">{isRtl ? 'شواهد عینی و یافته‌های ممیز' : 'Auditor Findings'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-850 text-zinc-300">
                        {record.savedAuditChecklist.map((chk, idx) => {
                          const clauseNum = chk.clauseNumber || chk.clauseId;
                          const reqText = chk.requirement || chk.question;
                          const evidenceText = chk.finding || chk.evidence;
                          const scoreVal = chk.score !== undefined ? chk.score : (chk.status === 'C' ? 100 : chk.status === 'PC' ? 50 : 0);
                          
                          return (
                            <tr key={idx} className="hover:bg-zinc-900/40">
                              <td className="px-3 py-2.5 text-center text-zinc-500 font-mono border-l border-zinc-800">{idx + 1}</td>
                              <td className="px-3 py-2.5 font-bold text-white border-l border-zinc-800">{chk.processName}</td>
                              <td className="px-3 py-2.5 border-l border-zinc-800 font-mono text-zinc-400">بند {clauseNum} - {reqText}</td>
                              <td className="px-3 py-2.5 border-l border-zinc-800 text-center">
                                {scoreVal === 100 ? (
                                  <span className="inline-block text-[9px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded font-black">✓ {isRtl ? 'منطبق کامل' : 'Full'}</span>
                                ) : scoreVal === 50 ? (
                                  <span className="inline-block text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-black">⚠ {isRtl ? 'منطبق جزیی' : 'Partial'}</span>
                                ) : (
                                  <span className="inline-block text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-black">✗ {isRtl ? 'عدم انطباق' : 'NC'}</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 border-l border-zinc-800 italic text-zinc-400">{evidenceText || (isRtl ? 'انطباق کامل با شواهد فیزیکی تایید گردید.' : 'Full compliance confirmed.')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Declared Non-Conformances */}
              {record.savedNcs && record.savedNcs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-rose-400 border-r-2 border-rose-500 pr-2 flex items-center gap-1.5">
                    <AlertTriangle size={14} />
                    <span>{isRtl ? '⚠️ مغایرت‌ها و عدم‌انطباق‌های ثبت شده (NC)' : 'Registered Quality Deviations'}</span>
                  </h3>
                  <div className="grid grid-cols-1 gap-3 text-right">
                    {record.savedNcs.map((nc, idx) => (
                      <div key={idx} className="bg-red-950/10 border border-red-500/20 p-4 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono font-bold bg-red-500/10 border border-red-500/25 text-red-400 px-2 py-0.5 rounded">
                            {isRtl ? `بند ${nc.clauseId}` : `Clause ${nc.clauseId}`}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono">{nc.id}</span>
                        </div>
                        <p className="text-xs font-black text-white">{nc.description || nc.title}</p>
                        <div className="grid grid-cols-2 gap-4 text-[10px] text-zinc-400 pt-1.5 border-t border-zinc-800/60">
                          <div>{isRtl ? 'فرآیند مربوطه:' : 'Process:'} <span className="text-zinc-200">{nc.source || nc.processName || 'ممیزی سیستم'}</span></div>
                          <div>{isRtl ? 'تاریخ ثبت:' : 'Registered At:'} <span className="text-amber-500 font-mono">{nc.targetDate || nc.registeredAt}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Captured Data Table (Standard View) */
            <div className="space-y-4">
              {/* Tab Selector for multi-sheet records */}
              {tables.length > 1 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-[#212124]" style={{ scrollbarWidth: 'none' }}>
                  {tables.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setActiveTableId(t.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                        activeTableId === t.id
                          ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30 font-black shadow-[0_0_12px_rgba(245,158,11,0.05)]'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent'
                      }`}
                    >
                      📁 {t.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="border border-[#212124] rounded-xl overflow-hidden bg-[#0A0A0B]/80 shadow-inner">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-xs text-right border-collapse" dir={isRtl ? "rtl" : "ltr"}>
                    <thead>
                      <tr className="bg-[#101012] border-b border-[#212124] text-slate-400 font-bold">
                        <th className="px-4 py-3 w-12 text-center border-l border-[#212124]">
                          #
                        </th>
                        {headers.map((h, index) => (
                          <th 
                            key={index} 
                            className={`px-4 py-3 font-semibold ${
                              index === 0 ? 'text-white' : 'text-slate-400'
                            } border-l border-[#212124]`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1D1D21]">
                      {displayItems.length === 0 ? (
                        <tr>
                          <td colSpan={headers.length + 1} className="p-8 text-center text-slate-500 italic">
                            {isRtl ? "هیچ رکوردی در زمان ثبت این آرشیو ضبط نشده بود." : "No entries recorded in this archive snapshot."}
                          </td>
                        </tr>
                      ) : (
                        displayItems.map((row, index) => (
                          <tr 
                            key={row.id || index} 
                            className="hover:bg-white/[0.02] text-slate-300 transition-colors"
                          >
                            <td className="px-4 py-3 text-center text-slate-500 font-mono border-l border-[#212124]">
                              {index + 1}
                            </td>
                            {headers.map((h, hIdx) => {
                              const fieldName = `field${hIdx + 1}`;
                              let val = row[fieldName] || '';
                              
                              // Custom checks for nested structured fields or numbers
                              if (hIdx === 0 && row.title && typeof val !== 'string') {
                                val = row.title;
                              }
                              
                              return (
                                <td 
                                  key={hIdx} 
                                  className={`px-4 py-3 border-l border-[#212124] leading-relaxed break-words max-w-[280px] ${
                                    hIdx === 0 ? 'font-medium text-white' : ''
                                  }`}
                                >
                                  {String(val)}
                                  {/* Extra inline detail chips for specialized records */}
                                  {fieldName === 'field1' && row.type && (
                                    <span className="inline-block mx-1.5 text-[8px] font-mono px-1 py-0.2 select-none bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded">
                                      {row.type}
                                    </span>
                                  )}
                                  {fieldName === 'field1' && row.processType && (
                                    <span className="inline-block mx-1.5 text-[8px] font-mono px-1 py-0.2 select-none bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded">
                                      {row.processType}
                                    </span>
                                  )}
                                  {fieldName === 'field3' && row.severity && (
                                    <span className="block text-[8px] text-[#777] font-sans mt-0.5">
                                      {isRtl ? `شدت: ${row.severity} * وقوع: ${row.occurrence} = RPN: ${row.severity * (row.occurrence || 1) * (row.detection || 1)}` : `S: ${row.severity} * O: ${row.occurrence} = RPN: ${row.severity * (row.occurrence || 1) * (row.detection || 1)}`}
                                    </span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer bar */}
        <footer className="px-6 py-4 border-t border-[#212124] bg-[#0E0E10] flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-5 py-2.5 bg-[#1B1B1F] hover:bg-[#252529] border border-[#2D2D31] text-xs font-bold rounded-lg text-slate-300 transition-colors cursor-pointer"
          >
            {isRtl ? "خروج و بازگشت" : "Close Viewer"}
          </button>
        </footer>
      </div>
    </div>
  );
}
