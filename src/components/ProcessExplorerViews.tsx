/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { IATFClause } from '../data/iatfData';
import { DocItem } from '../data/documentTemplates';
import { QmsDatabase } from '../lib/qmsDatabase';
import { TrendingUp, BookOpen, Settings, Users, FileText, BarChart, ExternalLink, Archive, ChevronLeft } from 'lucide-react';
import RecordViewerModal from './RecordViewerModal';

// ==========================================
// 1. PROCESS SPECIFICATION SHEET VIEWER
// ==========================================
interface ProcessSpecViewerProps {
  processName: string;
  processId: string;
  lang: 'fa' | 'en';
  onDocumentClick: (docName: string) => void;
  processItems: DocItem[];
}

export function ProcessSpecViewer({ processName, processId, lang, onDocumentClick, processItems }: ProcessSpecViewerProps) {
  const isRtl = lang === 'fa';
  
  const proc = useMemo(() => {
    return processItems.find(item => item.id === processId || item.field1 === processName) || null;
  }, [processItems, processId, processName]);

  if (!proc) {
    return (
      <div className="text-center py-20 text-slate-500" dir={isRtl ? 'rtl' : 'ltr'}>
        <p>{isRtl ? 'شناسنامه فرآیند یافت نشد.' : 'Process specification not found.'}</p>
      </div>
    );
  }

  const handleOpenDirectly = () => {
    localStorage.setItem('iatf_filter_شناسنامه فرآیندها (Process Cards - Turtle)', proc.field1 || '');
    localStorage.setItem('iatf_filter_شناسنامه فرآیندها', proc.field1 || '');
    onDocumentClick('شناسنامه فرآیندها (Process Cards - Turtle)');
  };

  const targetValue = proc.target || 100;
  const actualValue = proc.actual || 95;
  const unitStr = proc.unit || '%';
  const progressPercent = Math.min(100, Math.max(0, (actualValue / targetValue) * 100));

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in text-right" dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#2A2A2D] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-amber-500 font-bold text-xs tracking-[0.2em] uppercase">
              {isRtl ? 'شناسنامه فرآیند سازمان' : 'ORGANIZATION PROCESS SPECIFICATION'}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 font-mono font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
              {proc.processType || proc.field2 || 'COPs'}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">
            {proc.field1}
          </h1>
          {proc.clauseId && (
            <p className="text-xs text-slate-400 mt-1">
              {isRtl ? 'بند مرجع ممیزی: ' : 'Reference Audit Clause: '}
              <strong className="text-amber-500 font-mono">{proc.clauseId}</strong>
            </p>
          )}
        </div>

        <button
          onClick={handleOpenDirectly}
          className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[11px] uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-lg hover:shadow-amber-500/20 cursor-pointer self-start md:self-auto shrink-0"
        >
          <ExternalLink size={13} />
          <span>{isRtl ? '🐢 ویرایش مستقیم فرآیند' : '🐢 Edit Process Card'}</span>
        </button>
      </header>

      {/* Bento-style Grid of Turtle 6-Axis */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Box 1: Inputs */}
        <div className="bg-[#121214] border border-[#2A2A2D]/60 rounded-xl p-5 hover:border-amber-500/20 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
                <TrendingUp size={16} />
              </div>
              <h3 className="text-xs font-black text-white">{isRtl ? '۱. ورودی‌های فرآیند (چه چیزهایی وارد می‌شود؟)' : '1. Process Inputs'}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed min-h-[60px]">
              {proc.field2 || (isRtl ? 'ثبت نشده است' : 'Not recorded')}
            </p>
          </div>
          <div className="text-[10px] text-zinc-500 uppercase font-mono mt-3 text-left">INPUTS</div>
        </div>

        {/* Box 2: Outputs */}
        <div className="bg-[#121214] border border-[#2A2A2D]/60 rounded-xl p-5 hover:border-amber-500/20 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <BookOpen size={16} />
              </div>
              <h3 className="text-xs font-black text-white">{isRtl ? '۲. خروجی‌های فرآیند (چه چیزهایی خارج می‌شود؟)' : '2. Process Outputs'}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed min-h-[60px]">
              {proc.field3 || (isRtl ? 'ثبت نشده است' : 'Not recorded')}
            </p>
          </div>
          <div className="text-[10px] text-zinc-500 uppercase font-mono mt-3 text-left">OUTPUTS</div>
        </div>

        {/* Box 3: Equipment */}
        <div className="bg-[#121214] border border-[#2A2A2D]/60 rounded-xl p-5 hover:border-amber-500/20 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                <Settings size={16} />
              </div>
              <h3 className="text-xs font-black text-white">{isRtl ? '۳. با چه ابزاری؟ (ماشین‌آلات و تجهیزات)' : '3. With What (Equipment)'}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed min-h-[60px]">
              {proc.field4 || (isRtl ? 'ثبت نشده است' : 'Not recorded')}
            </p>
          </div>
          <div className="text-[10px] text-zinc-500 uppercase font-mono mt-3 text-left">EQUIPMENT</div>
        </div>

        {/* Box 4: Resources / Personnel */}
        <div className="bg-[#121214] border border-[#2A2A2D]/60 rounded-xl p-5 hover:border-amber-500/20 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                <Users size={16} />
              </div>
              <h3 className="text-xs font-black text-white">{isRtl ? '۴. با چه کسانی؟ (مهارت‌ها و منابع انسانی)' : '4. With Whom (Personnel)'}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed min-h-[60px]">
              {proc.field5 || (isRtl ? 'ثبت نشده است' : 'Not recorded')}
            </p>
          </div>
          <div className="text-[10px] text-zinc-500 uppercase font-mono mt-3 text-left">RESOURCES</div>
        </div>

        {/* Box 5: Methods */}
        <div className="bg-[#121214] border border-[#2A2A2D]/60 rounded-xl p-5 hover:border-amber-500/20 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-pink-500/10 text-pink-400 rounded-lg">
                <FileText size={16} />
              </div>
              <h3 className="text-xs font-black text-white">{isRtl ? '۵. چگونه؟ (روش‌های اجرایی و دستورالعمل‌ها)' : '5. How (Methods)'}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed min-h-[60px]">
              {proc.field6 || (isRtl ? 'ثبت نشده است' : 'Not recorded')}
            </p>
          </div>
          <div className="text-[10px] text-zinc-500 uppercase font-mono mt-3 text-left">METHODS</div>
        </div>

        {/* Box 6: KPI Metrics */}
        <div className="bg-[#121214] border border-[#2A2A2D]/60 rounded-xl p-5 hover:border-amber-500/20 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-rose-500/10 text-rose-400 rounded-lg">
                <BarChart size={16} />
              </div>
              <h3 className="text-xs font-black text-white">{isRtl ? '۶. با چه معیاری؟ (شاخص ارزیابی عملکرد)' : '6. KPI Performance Metric'}</h3>
            </div>
            <div className="space-y-3 min-h-[60px]">
              <p className="text-xs text-slate-300 leading-relaxed">
                {proc.field7 || (isRtl ? 'ثبت نشده است' : 'Not recorded')}
              </p>
              
              {proc.field7 && (
                <div className="bg-[#0A0A0C] border border-[#1E1E22] p-2.5 rounded-lg space-y-1.5">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400">{isRtl ? 'هدف توافقی سازمان:' : 'Organizational Target:'}</span>
                    <strong className="text-white font-mono">{targetValue} {unitStr}</strong>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400">{isRtl ? 'عملکرد واقعی فعلی:' : 'Current Actual Performance:'}</span>
                    <strong className="text-amber-500 font-mono">{actualValue} {unitStr}</strong>
                  </div>
                  
                  {/* Visual Progress Bar */}
                  <div className="relative w-full h-1.5 bg-[#1C1C1F] rounded-full overflow-hidden mt-1">
                    <div 
                      className="absolute top-0 right-0 h-full bg-amber-500 rounded-full transition-all duration-500" 
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 uppercase font-mono mt-3 text-left">METRICS</div>
        </div>

      </div>
    </div>
  );
}


// ==========================================
// 2. PROCESS SUB-CLAUSE DOCUMENTS CARD VIEWER
// ==========================================
interface ProcessClauseDocsViewerProps {
  clause: IATFClause;
  processName: string;
  processId: string;
  lang: 'fa' | 'en';
  onDocumentClick: (docName: string) => void;
  records: any[];
}

export function ProcessClauseDocsViewer({ clause, processName, processId, lang, onDocumentClick, records }: ProcessClauseDocsViewerProps) {
  const isRtl = lang === 'fa';
  const [selectedRecordToView, setSelectedRecordToView] = useState<any | null>(null);

  // Filter archived records matching this sub-clause
  const clauseRecords = useMemo(() => {
    return records.filter(r => r.clauseId === clause.id);
  }, [records, clause.id]);

  // Document formatting helper similar to ClauseDetail to produce stable document codes
  const getDocMeta = (docName: string) => {
    const cleanDocName = docName.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
    const dbRow = QmsDatabase.selectRow<any>('document_control_table', cleanDocName);
    
    let docCode = dbRow ? dbRow.code : '';
    let docReleaseDate = dbRow ? dbRow.releaseDate : '';
    
    if (!docCode) {
      const normTitle = cleanDocName.toLowerCase();
      let initialType = 'procedure';
      if (normTitle.includes('روش اجرایی') || normTitle.includes('رویه')) initialType = 'procedure';
      else if (normTitle.includes('دستورالعمل')) initialType = 'work_instruction';
      else if (normTitle.includes('فرم')) initialType = 'form';
      else if (normTitle.includes('لیست') || normTitle.includes('ماتریس')) initialType = 'list_matrix';
      else if (normTitle.includes('نظام‌نامه')) initialType = 'manual';
      else initialType = 'record';

      let prefix = 'QMS-REC';
      if (initialType === 'procedure') prefix = 'QMS-PR';
      else if (initialType === 'work_instruction') prefix = 'QMS-WI';
      else if (initialType === 'form') prefix = 'QMS-FM';
      else if (initialType === 'list_matrix') prefix = 'QMS-LS';
      else if (initialType === 'manual') prefix = 'QMS-QM';

      const sequence = (Math.abs(cleanDocName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 45 + 1)
        .toString()
        .padStart(2, '0');
      docCode = `${prefix}-${clause.id.replace(/\./g, '_')}-${sequence}`;
      docReleaseDate = '1405/03/01';
    }

    return { docCode, docReleaseDate };
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in text-right" dir={isRtl ? 'rtl' : 'ltr'}>
      <header className="border-b border-[#2A2A2D] pb-5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-amber-500 font-bold text-xs tracking-[0.2em] uppercase">
            {isRtl ? 'مدارک و مستندات زیرگروه فرآیند' : 'PROCESS SUB-CLAUSE DOCUMENTS'}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
          <span className="text-[10px] bg-amber-500/10 text-amber-400 font-bold px-2 py-0.5 rounded-full border border-amber-500/20">
            {processName}
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
          <span className="text-amber-500 font-mono font-bold">{clause.number}</span>
          <span>{clause.title}</span>
        </h1>
        <p className="text-xs text-slate-400 mt-2 italic max-w-4xl leading-relaxed">
          "{clause.text}"
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Column 1: System Document Templates */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#2A2A2D] pb-2">
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              <FileText size={16} className="text-amber-500" />
              <span>{isRtl ? 'مستندات مرجع و دستورالعمل‌ها' : 'Reference Documents & WIs'}</span>
            </h2>
            <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md font-bold">
              {clause.documents?.length || 0} {isRtl ? 'مدرک الزامی' : 'docs'}
            </span>
          </div>

          {!clause.documents || clause.documents.length === 0 ? (
            <div className="text-center py-10 bg-[#121214] rounded-xl border border-[#2A2A2D]/40 text-xs text-slate-500 italic">
              {isRtl ? 'هیچ مدرکی برای این بند تعریف نشده است.' : 'No documents defined for this clause.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {clause.documents.map((doc, idx) => {
                const { docCode, docReleaseDate } = getDocMeta(doc);
                return (
                  <div
                    key={`proc-clause-doc-${idx}`}
                    onClick={() => onDocumentClick(doc)}
                    className="group bg-[#121214] hover:bg-[#1A1A1F] border border-[#2A2A2D]/60 hover:border-amber-500/30 p-4 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 active:translate-y-0 flex justify-between items-center"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="p-2.5 bg-amber-500/5 text-amber-500 rounded-lg group-hover:bg-amber-500/10 transition-colors">
                        <FileText size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-amber-400 transition-colors truncate">
                          {doc}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] bg-[#1A1A1D] border border-[#2D2D30] text-amber-500/80 font-mono font-bold px-1.5 py-0.5 rounded">
                            {docCode}
                          </span>
                          {docReleaseDate && (
                            <span className="text-[9px] text-[#777] font-mono">
                              {docReleaseDate}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <span className="text-[10px] text-amber-500 font-extrabold shrink-0 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1">
                      <span>{isRtl ? 'مشاهده سند' : 'Open'}</span>
                      <ChevronLeft size={12} className={`transform ${isRtl ? 'rotate-0' : 'rotate-180'}`} />
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Column 2: Archived Compliance Records */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#2A2A2D] pb-2">
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              <Archive size={16} className="text-emerald-500" />
              <span>{isRtl ? 'سوابق آرشیو شده و شواهد انطباق' : 'Archived Records & Compliance Evidence'}</span>
            </h2>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md font-bold">
              {clauseRecords.length} {isRtl ? 'سند بایگانی' : 'archived'}
            </span>
          </div>

          {clauseRecords.length === 0 ? (
            <div className="text-center py-10 bg-[#121214] rounded-xl border border-[#2A2A2D]/40 text-xs text-slate-500 italic">
              {isRtl ? 'هنوز هیچ شواهد یا سندی برای این بند ممیزی آرشیو نشده است.' : 'No compliance evidence has been archived yet.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {clauseRecords.map((rec, idx) => (
                <div
                  key={`proc-clause-rec-${idx}`}
                  onClick={() => setSelectedRecordToView(rec)}
                  className="group bg-[#121214] hover:bg-[#151D18] border border-[#2A2A2D]/60 hover:border-emerald-500/30 p-4 rounded-xl cursor-pointer transition-all hover:-translate-y-0.5 active:translate-y-0 flex justify-between items-center"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="p-2.5 bg-emerald-500/5 text-emerald-500 rounded-lg group-hover:bg-emerald-500/10 transition-colors">
                      <Archive size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-emerald-400 transition-colors truncate">
                        {rec.documentName}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] bg-[#1A1A1D] border border-emerald-500/20 text-emerald-400/80 font-mono font-bold px-1.5 py-0.5 rounded">
                          {rec.code}
                        </span>
                        <span className="text-[9px] text-[#777] font-mono">
                          {isRtl ? `ویرایش ${rec.revision}` : `Rev ${rec.revision}`}
                        </span>
                        <span className="text-[9px] text-[#555] font-mono leading-none">
                          {rec.archivedAt}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <span className="text-[10px] text-emerald-400 font-extrabold shrink-0 opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1">
                    <span>{isRtl ? 'باز کردن سابقه' : 'View Record'}</span>
                    <ChevronLeft size={12} className={`transform ${isRtl ? 'rotate-0' : 'rotate-180'}`} />
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Record snapshots reader/viewer modal */}
      <RecordViewerModal 
        isOpen={!!selectedRecordToView}
        onClose={() => setSelectedRecordToView(null)}
        record={selectedRecordToView}
        lang={lang}
      />
    </div>
  );
}
