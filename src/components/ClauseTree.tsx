/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { IATFClause } from '../data/iatfData';
import { ChevronDown, ChevronRight, FileText, AlertTriangle, Lock } from 'lucide-react';
import React, { useState, MouseEvent, memo, useEffect } from 'react';
import { QmsDatabase } from '../lib/qmsDatabase';
import { User } from './TeamManagement';

interface Props {
  clauses: IATFClause[];
  selectedId: string | null;
  onSelect: (clause: IATFClause) => void;
  getProgress: (clause: IATFClause) => number;
  level?: number;
  isSearching?: boolean;
  lang: 'fa' | 'en';
  currentUser?: User | null;
  csrComparisons?: any[];
  expanded?: Record<string, boolean>;
  onExpandedChange?: React.Dispatch<React.SetStateAction<Record<string, boolean>>> | ((expanded: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void);
}

const ClauseTree = memo(function ClauseTree({ clauses, selectedId, onSelect, getProgress, level = 0, isSearching = false, lang, currentUser, csrComparisons = [], expanded, onExpandedChange }: Props) {
  const [localExpanded, setLocalExpanded] = useState<Record<string, boolean>>({});
  const [updateTick, setUpdateTick] = useState(0);

  const activeExpanded = expanded !== undefined && onExpandedChange !== undefined ? expanded : localExpanded;
  const setActiveExpanded = expanded !== undefined && onExpandedChange !== undefined ? onExpandedChange : setLocalExpanded;

  // Listen to dependency state changes from local storage or QmsDatabase writes
  useEffect(() => {
    const handleUpdate = () => {
      setTimeout(() => {
        setUpdateTick(prev => prev + 1);
      }, 0);
    };
    window.addEventListener('iatf-dependency-updated', handleUpdate);
    window.addEventListener('qms-db-mutated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('iatf-dependency-updated', handleUpdate);
      window.removeEventListener('qms-db-mutated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const toggleExpand = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    setActiveExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isRtl = lang === 'fa';

  // Get map of outdated documents and their reference targets
  const getClauseOutdatedDeps = (item: IATFClause): Record<string, string[]> => {
    const docOutdatedMap: Record<string, string[]> = {};
    if (!item.documents) return docOutdatedMap;
    for (const doc of item.documents) {
      const cleanDoc = doc.replace(/\s*\(ارجاع به بند.*\)/, '').trim();
      const res = QmsDatabase.checkDocumentDiscrepancies(cleanDoc);
      if (res.isOutOfSync) {
        docOutdatedMap[cleanDoc] = res.details;
      }
    }
    return docOutdatedMap;
  };

  return (
    <div 
      className={`flex flex-col gap-1 ${level > 0 ? (isRtl ? 'mr-4 border-r' : 'ml-4 border-l') + ' border-[#2A2A2D]' : ''}`} 
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {clauses.map((clause) => {
        const isSelected = selectedId === clause.id;
        const hasSub = clause.subClauses && clause.subClauses.length > 0;
        const isOpen = isSearching || activeExpanded[clause.id];
        const progress = getProgress(clause);
        
        // Granular permission check
        const clausePerm = currentUser?.role === 'user' ? currentUser?.permissions?.clauses?.[clause.id] : undefined;
        const isRestrictedView = clausePerm && clausePerm.view === false;

        // Compute active outdated dependencies for visual warnings
        const outdatedMap = getClauseOutdatedDeps(clause);
        const hasOutdated = Object.keys(outdatedMap).length > 0;

        // Calculate matched CSRs count
        const matchedCsrsCount = csrComparisons?.filter((c: any) => c.mappedIatfClauseId === clause.id).length || 0;

        return (
          <div key={clause.id} className="flex flex-col">
            <button
              onClick={() => {
                if (isRestrictedView) {
                  alert(isRtl ? 'دسترسی محدود شده: شما مجوز دسترسی به این بند استاندارد را ندارید.' : 'Access restricted: You do not have permission to view this clause.');
                  return;
                }
                onSelect(clause);
              }}
              className={`
                group flex items-center gap-2 px-3 py-2 rounded transition-all relative overflow-visible
                ${isRtl ? 'text-right' : 'text-left'}
                ${isRestrictedView ? 'opacity-40 cursor-not-allowed select-none' : ''}
                ${isSelected 
                  ? 'bg-amber-500/10 text-white font-medium ' + (isRtl ? 'border-r-2 border-amber-500' : 'border-l-2 border-amber-500')
                  : 'text-[#888] hover:text-[#BBB] hover:bg-[#1A1A1D]'}
              `}
            >
              <div 
                onClick={(e) => {
                  if (isRestrictedView) {
                    e.stopPropagation();
                    return;
                  }
                  hasSub && toggleExpand(clause.id, e);
                }}
                className="w-5 h-5 flex items-center justify-center text-amber-500/50 hover:text-amber-500 cursor-pointer z-10"
              >
                {isRestrictedView ? (
                  <Lock size={12} className="text-red-500" />
                ) : hasSub ? (
                  isOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} className={isRtl ? 'rotate-180' : ''} />
                  )
                ) : (
                  <FileText size={14} className="opacity-20" />
                )}
              </div>
              
              <span className={`font-mono text-xs min-w-[64px] shrink-0 z-10 relative ${isSelected ? 'text-amber-500 font-bold text-opacity-100' : 'text-zinc-400'}`}>
                {clause.number}

                {/* Stylish Blinking Warning Icon positioned precisely in the top-right corner of the clause/subclause number */}
                {hasOutdated && !isRestrictedView && (
                  <span 
                    className="absolute -top-1.5 -right-1.5 flex h-2.5 w-2.5 cursor-help z-[100] scale-110"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(clause);
                    }}
                  >
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500 items-center justify-center">
                      <AlertTriangle size={7} className="text-white font-bold stroke-[3px]" />
                    </span>

                    {/* Exquisite Floating Hover Tooltip */}
                    <span className={`absolute ${isRtl ? 'right-4' : 'left-4'} -top-2 z-[99999] hidden group-hover:block w-72 bg-gradient-to-b from-[#0F0F12] to-[#070709] border border-rose-500/35 text-rose-200 text-[10.5px] p-3 rounded-xl shadow-2xl leading-relaxed select-text font-sans text-right animate-in fade-in slide-in-from-top-1 duration-150`} dir={isRtl ? 'rtl' : 'ltr'}>
                      <span className="font-black border-b border-rose-500/20 pb-1.5 mb-1.5 text-rose-400 flex items-center gap-2">
                        <AlertTriangle size={13} className="shrink-0 text-rose-500 animate-bounce" />
                        <span>
                          {isRtl ? "هشدار عدم تطابق مراجع دیتابیس" : "Database Reference Out of Sync"}
                        </span>
                      </span>
                      <span>
                        {isRtl ? (
                          <>
                            تغییراتی در مستند مبدأ کشف شده است! <br />
                            مستند فعال این بند: <strong className="text-white font-black">«{Object.keys(outdatedMap).join(', ')}»</strong> <br />
                            به اطلاعات مستند <strong className="text-amber-400 font-black">«{Object.values(outdatedMap).flat().join(', ')}»</strong> وابسته است که اخیراً ویرایش گردیده.<br />
                            <span className="text-zinc-400 font-bold mt-1.5 block">💡 راهکار: روی این بند کلیک کنید، مستند وابسته را باز کـرده و دکمه نارنجی «تایید و به‌روزرسانی مراجع» را بزنید تا این هشدار جادویی خاموش شود.</span>
                          </>
                        ) : (
                          <>
                            Reference sources have updated! <br />
                            Active document <strong className="text-white font-black">"{Object.keys(outdatedMap).join(', ')}"</strong> <br />
                            relies on <strong className="text-amber-400 font-black">"{Object.values(outdatedMap).flat().join(', ')}"</strong> which has been modified.<br />
                            <span className="text-zinc-400 font-bold mt-1.5 block">💡 Solution: Double-click to open this document, and click "Sync References" to clear this warning permanently.</span>
                          </>
                        )}
                      </span>
                    </span>
                  </span>
                )}
              </span>
              <div className="flex flex-col flex-1 min-w-0 z-10 text-right">
                <span className="text-sm line-clamp-1">{clause.title}</span>
                {csrComparisons?.filter((c: any) => c.mappedIatfClauseId === clause.id).map((csrItem: any) => (
                  <span 
                    key={csrItem.customerId} 
                    className="text-[9px] text-amber-500 font-bold bg-amber-500/5 px-1.5 py-0.5 mt-1 rounded border border-amber-500/10 self-start truncate max-w-full font-sans flex items-center gap-1"
                  >
                    <span>📌</span>
                    <span>{csrItem.customerTitle} ({csrItem.customerNumber})</span>
                  </span>
                ))}
              </div>
              
              {matchedCsrsCount > 0 && (
                <span 
                  className="bg-amber-500/20 text-amber-400 text-[8px] font-black px-1.5 py-0.5 rounded-full border border-amber-500/25 shrink-0 z-10 self-center" 
                  title={isRtl ? 'الزامات خاص مشتری همگام‌سازی شده با این بند' : 'Customer Specific Requirements (CSR) Synchronized'}
                >
                  CSR: {matchedCsrsCount}
                </span>
              )}

              {/* Progress indicator */}
              <div className={`absolute bottom-0 h-0.5 bg-amber-500/10 w-full z-0 ${isRtl ? 'right-0' : 'left-0'}`}>
                <div 
                  style={{ width: `${progress}%` }}
                  className="h-full bg-amber-500/40"
                />
              </div>

              {progress > 0 && (
                <span className={`text-[8px] font-mono opacity-40 z-10 ${isRtl ? 'ml-1' : 'mr-1'}`}>{Math.round(progress)}%</span>
              )}
            </button>

            {hasSub && isOpen && !isRestrictedView && (
              <div className="mt-1">
                <ClauseTree 
                  clauses={clause.subClauses!} 
                  selectedId={selectedId} 
                  onSelect={onSelect} 
                  getProgress={getProgress}
                  level={level + 1} 
                  isSearching={isSearching}
                  lang={lang}
                  currentUser={currentUser}
                  csrComparisons={csrComparisons}
                  expanded={activeExpanded}
                  onExpandedChange={setActiveExpanded}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export default ClauseTree;
