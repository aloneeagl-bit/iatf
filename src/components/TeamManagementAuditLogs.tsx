import React, { useState, useMemo } from 'react';
import { 
  History, Search, Filter, Download, ArrowLeftRight, Eye, AlertCircle, Calendar, X
} from 'lucide-react';
import { ImmutableAuditLog } from './TeamManagementTypes';

interface TeamManagementAuditLogsProps {
  lang: 'fa' | 'en';
  auditLogs: ImmutableAuditLog[];
  isRtl: boolean;
}

export function TeamManagementAuditLogs({
  lang,
  auditLogs,
  isRtl
}: TeamManagementAuditLogsProps) {

  // Search & Filter state
  const [logSearch, setLogSearch] = useState('');
  const [logActionFilter, setLogActionFilter] = useState('');
  const [logModuleFilter, setLogModuleFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<ImmutableAuditLog | null>(null);

  // Computed unique actions and modules for filters
  const uniqueActions = useMemo(() => {
    return Array.from(new Set(auditLogs.map(l => l.action).filter(Boolean)));
  }, [auditLogs]);

  const uniqueModules = useMemo(() => {
    return Array.from(new Set(auditLogs.map(l => l.module).filter(Boolean)));
  }, [auditLogs]);

  // Filtered list
  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      const matchSearch = 
        (log.userFullName || '').toLowerCase().includes(logSearch.toLowerCase()) ||
        (log.username || '').toLowerCase().includes(logSearch.toLowerCase()) ||
        (log.recordId || '').toLowerCase().includes(logSearch.toLowerCase()) ||
        (log.actionFa || '').toLowerCase().includes(logSearch.toLowerCase()) ||
        (log.action || '').toLowerCase().includes(logSearch.toLowerCase());

      const matchAction = !logActionFilter || log.action === logActionFilter;
      const matchModule = !logModuleFilter || log.module === logModuleFilter;

      return matchSearch && matchAction && matchModule;
    });
  }, [auditLogs, logSearch, logActionFilter, logModuleFilter]);

  // Export audit logs as a downloadable JSON file
  const handleExportJSON = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(auditLogs, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `qms_audit_trail_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      console.error('Failed exporting QMS logs', e);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      
      {/* 1. Filter and Search panel */}
      <div className="bg-[#121215] border border-[#232326] p-4 rounded-2xl shadow-xl flex flex-col md:flex-row gap-3.5 items-center justify-between">
        
        <div className="flex flex-col md:flex-row gap-2.5 items-center w-full md:w-auto flex-1">
          <div className="relative w-full md:w-72">
            <Search size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              placeholder={isRtl ? 'جستجو در نام کاربر، عملیات یا کد سند...' : 'Search logs user, action, ID...'}
              className="w-full bg-[#18181c] border border-zinc-850 hover:border-zinc-700 focus:border-amber-500 rounded-xl pr-9 pl-3.5 py-1.5 text-xs text-white outline-none transition-all placeholder:text-zinc-600"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <select
              value={logActionFilter}
              onChange={(e) => setLogActionFilter(e.target.value)}
              className="bg-[#18181c] border border-zinc-850 rounded-xl px-3 py-1.5 text-xs text-white outline-none cursor-pointer text-right"
            >
              <option value="">{isRtl ? 'همه عملیات‌ها' : 'All Actions'}</option>
              {uniqueActions.map(act => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>

            <select
              value={logModuleFilter}
              onChange={(e) => setLogModuleFilter(e.target.value)}
              className="bg-[#18181c] border border-zinc-850 rounded-xl px-3 py-1.5 text-xs text-white outline-none cursor-pointer text-right"
            >
              <option value="">{isRtl ? 'همه بخش‌ها' : 'All Sections'}</option>
              {uniqueModules.map(mod => (
                <option key={mod} value={mod}>{mod.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleExportJSON}
          className="w-full md:w-auto bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 px-4 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-sm"
          title={isRtl ? 'خروجی کامل لاگ‌ها به فرمت JSON' : 'Export Logs to JSON'}
        >
          <Download size={13} />
          <span>{isRtl ? 'دانلود کامل گزارش ممیزی' : 'Export Audit Log (JSON)'}</span>
        </button>
      </div>

      {/* 2. Grid Table of logs */}
      <div className="bg-[#121215] border border-[#232326] rounded-2xl p-5 shadow-xl">
        <div className="flex justify-between items-center border-b border-white/5 pb-3.5 mb-4">
          <h3 className="text-xs font-black text-white flex items-center gap-2">
            <History size={14} className="text-amber-500" />
            <span>{isRtl ? 'دفتر ثبت دائمی وقایع و لاگ بازرسی سیستم (Immutable Audit Trail)' : 'Enterprise Immutable Audit Trail'}</span>
          </h3>
          <span className="text-[9.5px] text-zinc-500 font-mono">COUNT: {filteredLogs.length}</span>
        </div>

        <div className="overflow-x-auto custom-scrollbar -mx-5 sm:mx-0">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#202023] bg-[#121215]/80 text-[#FAFAFA] font-black">
                <th className="p-3 w-[15%]">{isRtl ? 'زمان وقوع' : 'Timestamp'}</th>
                <th className="p-3 w-[20%]">{isRtl ? 'کاربر مسئول' : 'Identity'}</th>
                <th className="p-3 w-[20%]">{isRtl ? 'عملیات' : 'Operation'}</th>
                <th className="p-3 w-[15%]">{isRtl ? 'ماژول' : 'Module'}</th>
                <th className="p-3 w-[20%]">{isRtl ? 'جزئیات فنی محیط' : 'Technical Specs'}</th>
                <th className="p-3 text-center w-[10%]">{isRtl ? 'مقادیر' : 'Values'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-xs text-zinc-500 italic">
                    {isRtl ? 'هیچ رکوردی منطبق با فیلتر شما یافت نشد.' : 'No audit records match the current filters.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-3 text-zinc-400 font-mono text-[10.5px]">
                      {new Date(log.timestamp).toLocaleString('fa-IR')}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-zinc-200">{log.userFullName}</span>
                        <span className="text-[9px] text-zinc-500 font-mono">@{log.username}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col">
                        <span className="font-black text-amber-500">{isRtl ? log.actionFa : log.action}</span>
                        <span className="text-[8.5px] text-zinc-500 font-mono uppercase">{log.action}</span>
                      </div>
                    </td>
                    <td className="p-3 text-zinc-400 font-bold font-mono text-[10px]">
                      {log.module.toUpperCase()}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-[8.5px] font-mono text-zinc-500 leading-tight">
                        <span>IP: {log.ipAddress}</span>
                        <span>|</span>
                        <span>{log.os} / {log.browser}</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="p-1.5 bg-zinc-900 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1 mx-auto text-[10px]"
                        title={isRtl ? 'مشاهده مقادیر قبل و بعد از تغییر' : 'Inspect Old & New State JSON'}
                      >
                        <Eye size={12} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Pre/Post Comparison Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#121215] border border-amber-500/30 rounded-2xl p-6 max-w-4xl w-full max-h-[85vh] overflow-y-auto shadow-2xl relative" dir="rtl">
            
            <button 
              onClick={() => setSelectedLog(null)}
              className="absolute top-4 left-4 p-1 hover:bg-white/5 rounded text-zinc-500 hover:text-white"
            >
              <X size={16} />
            </button>

            <h3 className="text-xs font-black text-white flex items-center gap-2 border-b border-white/5 pb-3 mb-4">
              <ArrowLeftRight size={14} className="text-amber-500" />
              <span>تحلیل مقادیر دیتابیس (قبل / بعد) - کد رکورد: {selectedLog.recordId}</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Pre Value Panel */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black text-rose-400 block uppercase tracking-widest">
                  {isRtl ? '« مقدار اولیه (قبل از وقوع تغییر)' : 'STATE PRE-VALUE (OLD)'}
                </span>
                <div className="bg-[#0f0f12] border border-zinc-900 rounded-xl p-3.5 max-h-96 overflow-y-auto custom-scrollbar font-mono text-[10.5px] text-zinc-400 leading-relaxed text-left" dir="ltr">
                  {selectedLog.preValue && selectedLog.preValue !== '{}' ? (
                    <pre>{JSON.stringify(JSON.parse(selectedLog.preValue), null, 2)}</pre>
                  ) : (
                    <span className="text-zinc-650 italic">None (Record created or no historic value)</span>
                  )}
                </div>
              </div>

              {/* Post Value Panel */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black text-emerald-400 block uppercase tracking-widest">
                  {isRtl ? 'مقدار ثبت شده نهایی (بعد از تغییر) »' : 'STATE POST-VALUE (NEW)'}
                </span>
                <div className="bg-[#0f0f12] border border-zinc-900 rounded-xl p-3.5 max-h-96 overflow-y-auto custom-scrollbar font-mono text-[10.5px] text-zinc-400 leading-relaxed text-left" dir="ltr">
                  {selectedLog.postValue && selectedLog.postValue !== '{}' ? (
                    <pre>{JSON.stringify(JSON.parse(selectedLog.postValue), null, 2)}</pre>
                  ) : (
                    <span className="text-zinc-650 italic">None (Record deleted or cleared)</span>
                  )}
                </div>
              </div>

            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 p-3.5 rounded-xl text-zinc-400 text-[10.5px] leading-relaxed flex items-start gap-2 mt-4">
              <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <p>
                {isRtl 
                  ? 'این فایل لاگ به روش متامدل و تغییرات سطری دیتابیس (Row-level tracking) ثبت گردیده و از ساختار اصلی کوئری‌های لوکال دیتابیس پشتیبانی می‌کند.'
                  : 'Immutable change vector metadata registered using automatic row-level structural serializers.'}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
