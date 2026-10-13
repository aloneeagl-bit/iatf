/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Database, Search, Filter, Calendar, Tag, Shield, Eye, Trash2, ShieldCheck, Layers, FileSpreadsheet, Clock, ArrowLeftRight, Folder } from 'lucide-react';
import { QmsDatabase } from '../lib/qmsDatabase';
import RecordViewerModal from './RecordViewerModal';

interface RecordsDashboardProps {
  lang: 'fa' | 'en';
  records: any[];
  onDeleteRecord: (id: string) => void;
  onSelectClauseId: (clauseId: string) => void;
  onPinToDashboard?: () => void;
}

export default function RecordsDashboard({ lang, records, onDeleteRecord, onSelectClauseId, onPinToDashboard }: RecordsDashboardProps) {
  const isRtl = lang === 'fa';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClauseFilter, setSelectedClauseFilter] = useState('all');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState('all');
  const [selectedRecordToView, setSelectedRecordToView] = useState<any | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [colFilters, setColFilters] = useState<Record<string, string>>({});

  // Calculate distinct folders
  const distinctFolders = useMemo(() => {
    const defaults = [
      'سوابق کنترل حین تولید (In-Process Control)',
      'سوابق صهه‌گذاری و راه‌اندازی (Job Setup)'
    ];
    const recFolders = records.map(r => r.folder).filter(Boolean);
    return Array.from(new Set([...defaults, ...recFolders]));
  }, [records]);

  // 1. Filtered Records calculation with global search and specific column filters
  const filteredRecords = useMemo(() => {
    let result = records;

    if (selectedFolderFilter !== 'all') {
      result = result.filter(r => (r.folder || 'عمومی') === selectedFolderFilter);
    }

    // Apply column specific filters
    Object.entries(colFilters).forEach(([colKey, rawVal]) => {
      const filterVal = rawVal as string;
      if (filterVal && filterVal.trim() !== '') {
        const query = filterVal.toLowerCase().trim();
        result = result.filter(r => {
          let fieldVal = '';
          if (colKey === 'documentName') fieldVal = r.documentName || '';
          else if (colKey === 'clauseId') fieldVal = r.clauseId || '';
          else if (colKey === 'code') fieldVal = r.code || r.id || '';
          else if (colKey === 'folder') fieldVal = r.folder || '';
          else if (colKey === 'version') fieldVal = String(r.version || '');
          else if (colKey === 'timestamp') fieldVal = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
          else if (colKey === 'approvedBy') fieldVal = r.approvedBy || '';
          
          return fieldVal.toLowerCase().includes(query);
        });
      }
    });

    return result.filter(r => {
      const matchSearch = r.documentName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (r.code && r.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (r.folder && r.folder.toLowerCase().includes(searchTerm.toLowerCase())) ||
                          (r.clauseId && r.clauseId.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchClause = selectedClauseFilter === 'all' || r.clauseId === selectedClauseFilter;
      return matchSearch && matchClause;
    }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [records, searchTerm, selectedClauseFilter, selectedFolderFilter, colFilters]);

  // 2. Statistics and aggregates
  const stats = useMemo(() => {
    const total = records.length;
    
    // Unique Clauses active
    const clausesSet = new Set(records.map(r => r.clauseId));
    const activeClausesCount = clausesSet.size;

    // Unique core templates archived
    const templateSet = new Set(records.map(r => r.documentName));
    const activeTemplatesCount = templateSet.size;

    // Latest archive timestamp
    const latest = records.length > 0
      ? records.reduce((latest, current) => (current.timestamp > latest.timestamp ? current : latest), records[0])
      : null;

    return {
      total,
      activeClausesCount,
      activeTemplatesCount,
      latest
    };
  }, [records]);

  // Distinct clauses for filtering
  const distinctClauses = useMemo(() => {
    const clauses = records.map(r => r.clauseId).filter(Boolean);
    return Array.from(new Set(clauses)).sort();
  }, [records]);

  return (
    <div className="space-y-6 animate-fade-in" dir={isRtl ? "rtl" : "ltr"}>
      
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-[#222] pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-green-400 uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-ping"></span>
            <span>{isRtl ? "پایگاه داده مستقل سوابق و شواهد انطباق ممیزی" : "Independent Audit Evidence & Records Ledger"}</span>
          </div>
          <h1 className={`text-xl sm:text-2xl text-white tracking-tight mt-1 ${isRtl ? "font-sans font-extrabold" : "font-serif font-extrabold"} flex items-center gap-1.5`}>
            <span>{isRtl ? "بایگانی و سوابق هوشمند کیفیت" : "QMS Quality Records & Snapshots"}</span>
            {onPinToDashboard && (
              <button
                type="button"
                onClick={onPinToDashboard}
                className="text-amber-500 hover:text-amber-400 p-1 transition-all select-none text-xs sm:text-sm cursor-pointer ml-1 animate-pulse"
                title={isRtl ? 'پین به داشبورد ابزار IATF' : 'Pin to IATF Tools Dashboard'}
              >
                📌
              </button>
            )}
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl mt-1 leading-relaxed">
            {isRtl
              ? "سامانه مستقل نگهداری شواهد کیفیت، ویرایش‌های منجمد شده (Snapshots) و سوابق اجرای فرآیندها جهت پاسخگویی در بررسی ممیزی رسمی IATF 16949 و مراجع صدور گواهی‌نامه."
              : "An immutable registry holding production quality records, frozen snapshots, and compliance logs of QMS processes designed for formal certification audits."}
          </p>
        </div>
        
        {/* Total Badge */}
        <div className="flex gap-3 justify-start items-center">
          <div className="bg-[#0F0F11] border border-green-500/30 rounded-xl p-4 flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 flex items-center justify-center">
              <Database size={18} />
            </div>
            <div>
              <span className="text-[10px] text-[#666] font-bold block uppercase tracking-wider">
                {isRtl ? "کل بانک سوابق" : "Total Evidence"}
              </span>
              <strong className="text-xl text-white font-mono font-black">{stats.total}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Widget Boxes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Records Snapshot Counter */}
        <div className="bg-[#0F0F11] border border-[#212124] rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
              {isRtl ? "شواهد ثبت‌شده" : "Logged Evidence"}
            </span>
            <strong className="text-2xl text-white font-mono font-black">{stats.total}</strong>
            <span className="text-[9px] text-slate-500 block">
              {isRtl ? "برش ثبت شده از فرم‌ها" : "Snapshots of live checklists"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#161619] border border-[#212124] text-slate-400 flex items-center justify-center">
            <Layers size={18} />
          </div>
        </div>

        {/* Clauses Mapped Counter */}
        <div className="bg-[#0F0F11] border border-[#212124] rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
              {isRtl ? "پوشش الزامات بندها" : "Clauses Covered"}
            </span>
            <strong className="text-2xl text-green-400 font-mono font-black">
              {stats.activeClausesCount}
            </strong>
            <span className="text-[9px] text-[#555] block">
              {isRtl ? "بندهای بی‌آسیب و منطبق" : "Compliant standard clauses"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#161619] border border-[#212124] text-green-500/80 flex items-center justify-center">
            <ShieldCheck size={18} />
          </div>
        </div>

        {/* Templates Archived Counter */}
        <div className="bg-[#0F0F11] border border-[#212124] rounded-xl p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
              {isRtl ? "نوع ساختارهای مدل‌شده" : "Unique Profiles"}
            </span>
            <strong className="text-2xl text-cyan-400 font-mono font-black">
              {stats.activeTemplatesCount}
            </strong>
            <span className="text-[9px] text-[#555] block">
              {isRtl ? "قالب کارهای تفکیک شده" : "Unique formats documented"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#161619] border border-[#212124] text-cyan-500/80 flex items-center justify-center">
            <FileSpreadsheet size={18} />
          </div>
        </div>

        {/* Latest Activity Feed */}
        <div className="bg-[#0F0F11] border border-[#212124] rounded-xl p-4 flex items-between justify-between col-span-1 sm:col-span-2 lg:col-span-1">
          <div className="space-y-1 min-w-0 flex-1">
            <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">
              {isRtl ? "آخرین رکورد نهایی" : "Latest Certified Capture"}
            </span>
            {stats.latest ? (
              <>
                <strong className="text-xs text-white block truncate leading-tight mt-1 font-bold" title={stats.latest.documentName}>
                  {stats.latest.documentName}
                </strong>
                <span className="text-[9px] text-amber-500 font-mono mt-0.5 block truncate" title={`${stats.latest.code} (${stats.latest.archivedAt})`}>
                  {stats.latest.code} ({stats.latest.archivedAt})
                </span>
              </>
            ) : (
              <span className="text-xs text-slate-500 italic block pt-1">
                {isRtl ? "بدون فعالیت اخیر" : "No activity capture"}
              </span>
            )}
          </div>
          <div className="w-10 h-10 rounded-lg bg-[#161619] border border-[#212124] text-amber-500 shrink-0 flex items-center justify-center self-center">
            <Clock size={16} />
          </div>
        </div>
      </div>

      {/* Folder Navigation Tabs Bar */}
      <div className="bg-[#0D0D10] border border-[#222228] p-3 rounded-2xl flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 ml-2">
          <Folder size={15} className="text-amber-400" />
          <span>{isRtl ? "پوشه‌های اختصاصی بایگانی سوابق:" : "Archive Record Folders:"}</span>
        </div>

        <button
          onClick={() => setSelectedFolderFilter('all')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
            selectedFolderFilter === 'all'
              ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
              : 'bg-[#16161A] text-slate-300 border-[#282830] hover:bg-[#202026]'
          }`}
        >
          <Folder size={13} className={selectedFolderFilter === 'all' ? 'text-slate-950' : 'text-amber-400'} />
          <span>{isRtl ? "همه پوشه‌ها" : "All Folders"}</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
            selectedFolderFilter === 'all' ? 'bg-slate-900 text-amber-300' : 'bg-slate-800 text-slate-400'
          }`}>
            {records.length}
          </span>
        </button>

        {distinctFolders.map(folderName => {
          const isSelected = selectedFolderFilter === folderName;
          const count = records.filter(r => (r.folder || 'عمومی') === folderName).length;
          return (
            <button
              key={folderName}
              onClick={() => setSelectedFolderFilter(folderName)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-black shadow-md'
                  : 'bg-[#16161A] text-slate-300 border-[#282830] hover:bg-[#202026]'
              }`}
            >
              <Folder size={13} className={isSelected ? 'text-slate-950' : 'text-amber-400'} />
              <span>{folderName}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isSelected ? 'bg-slate-900 text-amber-300' : 'bg-slate-800 text-slate-400'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Interactive Controls & Filters */}
      <div className="bg-[#0A0A0B] border border-[#212124] rounded-xl p-4 flex flex-col sm:flex-row items-center gap-3 justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder={isRtl ? "جستجو در اسناد، کدها یا بندها..." : "Search document name, code, clause..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#111] hover:bg-[#151518] border border-[#2A2A2D] focus:border-amber-500/50 rounded-lg py-2 pl-9 pr-4 text-xs text-slate-200 outline-none transition-all placeholder:text-slate-600 font-sans"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-slate-500 shrink-0 text-xs flex items-center gap-1">
            <Filter size={12} />
            <span>{isRtl ? "بند استاندارد:" : "Standard Clause:"}</span>
          </span>
          <select
            value={selectedClauseFilter}
            onChange={(e) => setSelectedClauseFilter(e.target.value)}
            className="w-full sm:w-44 bg-[#111] border border-[#2A2A2D] focus:border-amber-500/50 rounded-lg py-2 px-3 text-xs text-slate-300 outline-none transition-all"
          >
            <option value="all">{isRtl ? "همه بندها" : "All Clauses"}</option>
            {distinctClauses.map(clauseId => (
              <option key={clauseId} value={clauseId}>
                {isRtl ? `بند ${clauseId}` : `Clause ${clauseId}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Primary Records Grid / Table */}
      <div className="border border-[#1D1D21] rounded-2xl overflow-hidden bg-[#0A0A0B] shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-xs text-right border-collapse">
            <thead>
              <tr className="bg-[#101012] border-b border-[#1D1D21] text-slate-400 font-bold">
                <th className="px-5 py-4 text-center border-l border-[#1D1D21] w-12">#</th>
                <th className="px-5 py-4 border-l border-[#1D1D21]">{isRtl ? "نام سند سابقه" : "Document Title"}</th>
                <th className="px-5 py-4 border-l border-[#1D1D21] w-48">{isRtl ? "پوشه بایگانی" : "Folder"}</th>
                <th className="px-5 py-4 border-l border-[#1D1D21] w-24 text-center">{isRtl ? "بند ارجاعی" : "Linked Clause"}</th>
                <th className="px-5 py-4 border-l border-[#1D1D21] w-36">{isRtl ? "شناسه یکتا (کد)" : "Doc Code"}</th>
                <th className="px-5 py-4 border-l border-[#1D1D21] w-20 text-center">{isRtl ? "ویرایش" : "Revision"}</th>
                <th className="px-5 py-4 border-l border-[#1D1D21] w-48">{isRtl ? "زمان اصیل ثبت سابقه" : "Captured At"}</th>
                <th className="px-5 py-4 border-l border-[#1D1D21] w-36">{isRtl ? "تایید کننده نهایی" : "Approved By"}</th>
                <th className="px-5 py-4 text-center w-24">{isRtl ? "عملیات" : "Actions"}</th>
              </tr>
              {/* Column Filter row */}
              <tr className="border-b border-[#1D1D21] bg-[#070709]">
                <th className="p-2 border-l border-[#1D1D21] text-center text-zinc-600 font-mono text-[10px]">🔍</th>
                <th className="p-2 border-l border-[#1D1D21]">
                  <input
                    type="text"
                    value={colFilters['documentName'] || ''}
                    onChange={(e) => setColFilters(prev => ({ ...prev, documentName: e.target.value }))}
                    placeholder={isRtl ? "فیلتر نام..." : "Filter name..."}
                    className="w-full bg-[#111113] hover:bg-[#18181B]/70 focus:bg-[#161619] border border-zinc-800 text-zinc-350 text-[10.5px] px-2 py-1.5 rounded outline-none"
                  />
                </th>
                <th className="p-2 border-l border-[#1D1D21]">
                  <input
                    type="text"
                    value={colFilters['folder'] || ''}
                    onChange={(e) => setColFilters(prev => ({ ...prev, folder: e.target.value }))}
                    placeholder={isRtl ? "فیلتر پوشه..." : "Folder..."}
                    className="w-full bg-[#111113] hover:bg-[#18181B]/70 focus:bg-[#161619] border border-zinc-800 text-zinc-350 text-[10.5px] px-2 py-1.5 rounded outline-none"
                  />
                </th>
                <th className="p-2 border-l border-[#1D1D21]">
                  <input
                    type="text"
                    value={colFilters['clauseId'] || ''}
                    onChange={(e) => setColFilters(prev => ({ ...prev, clauseId: e.target.value }))}
                    placeholder={isRtl ? "فیلتر بند..." : "Filter..."}
                    className="w-full bg-[#111113] hover:bg-[#18181B]/70 focus:bg-[#161619] border border-zinc-800 text-zinc-350 text-[10.5px] px-2 py-1.5 rounded outline-none text-center font-mono"
                  />
                </th>
                <th className="p-2 border-l border-[#1D1D21]">
                  <input
                    type="text"
                    value={colFilters['code'] || ''}
                    onChange={(e) => setColFilters(prev => ({ ...prev, code: e.target.value }))}
                    placeholder={isRtl ? "فیلتر کد..." : "Filter..."}
                    className="w-full bg-[#111113] hover:bg-[#18181B]/70 focus:bg-[#161619] border border-zinc-800 text-zinc-350 text-[10.5px] px-2 py-1.5 rounded outline-none text-center font-mono"
                  />
                </th>
                <th className="p-2 border-l border-[#1D1D21]">
                  <input
                    type="text"
                    value={colFilters['version'] || ''}
                    onChange={(e) => setColFilters(prev => ({ ...prev, version: e.target.value }))}
                    placeholder={isRtl ? "ویرایش..." : "Rev..."}
                    className="w-full bg-[#111113] hover:bg-[#18181B]/70 focus:bg-[#161619] border border-zinc-800 text-zinc-350 text-[10.5px] px-2 py-1.5 rounded outline-none text-center font-mono"
                  />
                </th>
                <th className="p-2 border-l border-[#1D1D21]">
                  <input
                    type="text"
                    value={colFilters['timestamp'] || ''}
                    onChange={(e) => setColFilters(prev => ({ ...prev, timestamp: e.target.value }))}
                    placeholder={isRtl ? "زمان..." : "Time..."}
                    className="w-full bg-[#111113] hover:bg-[#18181B]/70 focus:bg-[#161619] border border-zinc-800 text-zinc-350 text-[10.5px] px-2 py-1.5 rounded outline-none text-right font-mono"
                  />
                </th>
                <th className="p-2 border-l border-[#1D1D21]">
                  <input
                    type="text"
                    value={colFilters['approvedBy'] || ''}
                    onChange={(e) => setColFilters(prev => ({ ...prev, approvedBy: e.target.value }))}
                    placeholder={isRtl ? "تایید کننده..." : "Approved..."}
                    className="w-full bg-[#111113] hover:bg-[#18181B]/70 focus:bg-[#161619] border border-zinc-800 text-zinc-350 text-[10.5px] px-2 py-1.5 rounded outline-none text-right"
                  />
                </th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#18181A]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-12 text-center text-slate-500 italic">
                    {isRtl 
                      ? "هیچ سابقه یا شواهد انطباقی با شرایط جستجوی شما پیدا نشد." 
                      : "No archived snapshots match your active search filter requirements."}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec, index) => (
                  <tr 
                    key={rec.id} 
                    className="hover:bg-white/[0.01] text-slate-300 transition-colors"
                  >
                    <td className="px-5 py-4 text-center text-slate-500 font-mono border-l border-[#1D1D21]">
                      {index + 1}
                    </td>
                    <td className="px-5 py-4 border-l border-[#1D1D21] font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                        <span>{rec.documentName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 border-l border-[#1D1D21] text-[#A0A0AB] font-sans text-xs">
                      <div className="flex items-center gap-1.5">
                        <Folder size={12} className="text-amber-400/80 shrink-0" />
                        <span className="truncate max-w-[180px] font-medium" title={rec.folder || "عمومی"}>
                          {rec.folder || "عمومی"}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 border-l border-[#1D1D21] text-center">
                      <button
                        onClick={() => onSelectClauseId(rec.clauseId)}
                        className="text-amber-500 hover:text-amber-400 hover:underline font-mono text-[11px] bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded cursor-pointer transition-colors"
                        title={isRtl ? "مشاهده جزئیات بند در استاندارد" : "View Standard Clause Detail"}
                      >
                        {rec.clauseId}
                      </button>
                    </td>
                    <td className="px-5 py-4 border-l border-[#1D1D21] font-mono font-bold text-[10px] text-green-400">
                      {rec.code}
                    </td>
                    <td className="px-5 py-4 border-l border-[#1D1D21] text-center text-white font-mono font-bold">
                      {rec.revision}
                    </td>
                    <td className="px-5 py-4 border-l border-[#1D1D21] text-slate-400 text-[11px] font-sans">
                      <div className="flex items-center gap-1.5 direction-[ltr] text-right">
                        <Clock size={11} className="text-[#555]" />
                        <span>{rec.archivedAt}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 border-l border-[#1D1D21] text-slate-400">
                      <span>{rec.approvedBy}</span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedRecordToView(rec)}
                          className="bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 p-2 rounded-lg transition-all cursor-pointer"
                          title={isRtl ? "مشاهده و بازخوانی پرونده سابقه" : "Inspect Document Snapshot"}
                        >
                          <Eye size={13} />
                        </button>
                        <button
                          onClick={() => setRecordToDelete(rec.id)}
                          className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 p-2 rounded-lg transition-all cursor-pointer"
                          title={isRtl ? "حذف سابقه از بایگانی" : "Delete Compliance Record"}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deletion confirmations modals */}
      {recordToDelete && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[120] flex items-center justify-center p-4 animate-fade-in" onClick={() => setRecordToDelete(null)}>
          <div className="bg-[#0C0C0E] border-2 border-red-500/30 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 text-red-500">
              <Trash2 size={24} />
              <h3 className="text-sm font-black text-white">
                {isRtl ? 'حذف دائمی برگه سابقه ممیزی' : 'Confirm Record Deletion'}
              </h3>
            </div>
            
            <p className="text-xs text-slate-200 leading-relaxed">
              {isRtl 
                ? 'آیا از حذف برگ این سابقه اطمینان دارید؟ تغییرات بلافاصله از پایگاه داده سوابق و شواهد انطباق ممیزی سازمان حذف می‌شوند و غیر قابل بازگشت است.' 
                : 'Are you sure you want to permanently delete this archived snapshot evidence? This transaction cannot be undone.'}
            </p>
            
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white bg-[#1A1A1D] hover:bg-[#202024] rounded transition-colors cursor-pointer"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={() => {
                  onDeleteRecord(recordToDelete);
                  setRecordToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-black bg-red-500 hover:bg-red-400 rounded transition-colors cursor-pointer"
              >
                {isRtl ? 'حذف سابقه' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}

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
