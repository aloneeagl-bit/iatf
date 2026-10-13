/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Printer, FileText, ChevronLeft, ChevronRight, Eye, CheckCircle, 
  Settings, Layers, Download, CheckSquare, Square, Clock, Award, Layout, Zap
} from 'lucide-react';
import { SWIStep, SWIBlock } from '../types/swi';
import { QmsDatabase } from '../lib/qmsDatabase';

interface SWIPrintViewProps {
  steps: SWIStep[];
  blocks: SWIBlock[];
  lang: 'fa' | 'en';
  documentTitle: string;
}

export default function SWIPrintView({ steps, blocks, lang, documentTitle }: SWIPrintViewProps) {
  const isRtl = lang === 'fa';
  
  // Filtering and selection states
  const [selectedStation, setSelectedStation] = useState('ALL');
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [selectedStepIds, setSelectedStepIds] = useState<string[]>(steps.map(s => s.id));
  const [highContrast, setHighContrast] = useState(false);
  
  // Print Mode Layout Selector
  // 'preset' = Traditional Standard layout
  // 'optimal_blocks' = Optimal block layout (renders designed blocks sorted by Y with optional padding compression)
  const [printLayoutMode, setPrintLayoutMode] = useState<'preset' | 'optimal_blocks'>('optimal_blocks');
  const [compressPadding, setCompressPadding] = useState(false);

  // Extract filters
  const uniqueStations = useMemo(() => {
    const stations = new Set(steps.map(s => s.station).filter(Boolean));
    return ['ALL', ...Array.from(stations)];
  }, [steps]);

  const uniqueProducts = useMemo(() => {
    const products = new Set(steps.map(s => s.partNo).filter(Boolean));
    return ['ALL', ...Array.from(products)];
  }, [steps]);

  // Determine active print steps
  const activePrintSteps = useMemo(() => {
    return steps.filter(step => {
      const matchesStation = selectedStation === 'ALL' || step.station === selectedStation;
      const matchesProduct = selectedProduct === 'ALL' || step.partNo === selectedProduct;
      const isChecked = selectedStepIds.includes(step.id);
      return matchesStation && matchesProduct && isChecked;
    });
  }, [steps, selectedStation, selectedProduct, selectedStepIds]);

  // Toggle step selection
  const toggleStepSelection = (id: string) => {
    if (selectedStepIds.includes(id)) {
      setSelectedStepIds(selectedStepIds.filter(sid => sid !== id));
    } else {
      setSelectedStepIds([...selectedStepIds, id]);
    }
  };

  const toggleAllSteps = () => {
    if (selectedStepIds.length === steps.length) {
      setSelectedStepIds([]);
    } else {
      setSelectedStepIds(steps.map(s => s.id));
    }
  };

  // Direct print action
  const handlePrint = () => {
    window.print();
  };

  // Resolve DB cell or standard step cell
  const getStepValue = (step: SWIStep, colField: string) => {
    if (!step) return '';
    // If it is custom, let the block render its preset
    return step[colField as keyof SWIStep] !== undefined && step[colField as keyof SWIStep] !== null 
      ? String(step[colField as keyof SWIStep]) 
      : '';
  };

  // Sort blocks by Y coordinate for optimal top-to-bottom layout sequence
  const sortedBlocks = useMemo(() => {
    return [...blocks].sort((a, b) => a.y - b.y);
  }, [blocks]);

  // General Quality Report summary calculation
  const reportSummary = useMemo(() => {
    const totalSteps = steps.length;
    const totalStations = new Set(steps.map(s => s.station)).size;
    const totalCycleTime = steps.reduce((acc, s) => acc + (s.stdTime || 0), 0);
    const averageCycleTime = totalSteps > 0 ? Math.round(totalCycleTime / totalSteps) : 0;
    
    let safetyCount = 0;
    let qualityCount = 0;
    steps.forEach(s => {
      if (s.symbols?.includes('Safety')) safetyCount++;
      if (s.symbols?.includes('CC') || s.symbols?.includes('SC')) qualityCount++;
    });

    return { totalSteps, totalStations, totalCycleTime, averageCycleTime, safetyCount, qualityCount };
  }, [steps]);

  return (
    <div className="flex flex-col xl:flex-row gap-5" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* Print Controls Sidebar */}
      <div className="w-full xl:w-80 bg-[#09090D] border border-[#1E1E23] rounded-2xl p-5 shrink-0 shadow-lg print:hidden flex flex-col gap-4">
        <div>
          <h3 className="text-xs font-black text-amber-500 mb-4 pb-2 border-b border-zinc-800 flex items-center gap-2 uppercase tracking-wider">
            <Settings size={13} />
            <span>{isRtl ? 'پیکربندی و فیلتر چاپ گام‌ها' : 'Workstation Print Config'}</span>
          </h3>

          <div className="flex flex-col gap-4">
            {/* Station Filter */}
            <div>
              <label className="text-[10px] text-zinc-500 font-extrabold uppercase block mb-1.5">{isRtl ? 'فیلتر بر اساس ایستگاه کاری:' : 'Filter by Station:'}</label>
              <select
                value={selectedStation}
                onChange={(e) => setSelectedStation(e.target.value)}
                className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1.5 px-3 text-xs text-white outline-none focus:border-amber-500/40 font-bold"
              >
                {uniqueStations.map(st => (
                  <option key={st} value={st}>
                    {st === 'ALL' ? (isRtl ? 'همه ایستگاه‌ها' : 'All Stations') : st}
                  </option>
                ))}
              </select>
            </div>

            {/* Product Filter */}
            <div>
              <label className="text-[10px] text-zinc-500 font-extrabold uppercase block mb-1.5">{isRtl ? 'فیلتر بر اساس قطعه / شماره فنی:' : 'Filter by Product/Part:'}</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1.5 px-3 text-xs text-white outline-none focus:border-amber-500/40 font-bold"
              >
                {uniqueProducts.map(prod => (
                  <option key={prod} value={prod}>
                    {prod === 'ALL' ? (isRtl ? 'همه قطعات' : 'All Products') : prod}
                  </option>
                ))}
              </select>
            </div>

            {/* Print Layout Mode Toggle */}
            <div className="border-t border-zinc-800/40 pt-3">
              <label className="text-[10px] text-zinc-500 font-extrabold uppercase block mb-1.5">{isRtl ? 'حالت چیدمان خروجی چاپی:' : 'Print Layout Method:'}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPrintLayoutMode('preset')}
                  className={`py-2 px-2.5 rounded-lg text-[10.5px] font-black border transition-all cursor-pointer ${
                    printLayoutMode === 'preset'
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-500'
                      : 'bg-[#131317] border-zinc-800 text-zinc-400'
                  }`}
                >
                  {isRtl ? 'طرح استاندارد سازمانی' : 'Standard Sheet'}
                </button>
                <button
                  type="button"
                  onClick={() => setPrintLayoutMode('optimal_blocks')}
                  className={`py-2 px-2.5 rounded-lg text-[10.5px] font-black border transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    printLayoutMode === 'optimal_blocks'
                      ? 'bg-amber-500/10 border-amber-500 text-amber-500'
                      : 'bg-[#131317] border-zinc-800 text-zinc-400'
                  }`}
                >
                  <Layout size={10} />
                  <span>{isRtl ? 'چیدمان بهینه طراحی' : 'Optimal Blocks'}</span>
                </button>
              </div>
            </div>

            {/* Smart Compression Toggle for Optimal Layout Sheet Economy */}
            {printLayoutMode === 'optimal_blocks' && (
              <div className="flex items-center justify-between bg-zinc-950/40 border border-zinc-850 p-2.5 rounded-xl">
                <div className="flex flex-col text-right">
                  <span className="text-[10.5px] font-bold text-zinc-300">{isRtl ? 'فشرده‌سازی هوشمند فاصله‌ها' : 'Smart Sheet Compression'}</span>
                  <span className="text-[9px] text-zinc-500">{isRtl ? 'بهینه‌سازی فضا برای برگ کمتر' : 'Minimize padding for paper saver'}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCompressPadding(!compressPadding)}
                  className={`text-[10px] font-extrabold py-1 px-2 rounded-lg border transition-all ${
                    compressPadding ? 'bg-amber-500 text-black border-amber-500' : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {compressPadding ? (isRtl ? 'روشن' : 'ON') : (isRtl ? 'خاموش' : 'OFF')}
                </button>
              </div>
            )}

            {/* Toggle contrast */}
            <div className="flex items-center justify-between border-t border-zinc-800/40 pt-3">
              <span className="text-[10px] text-zinc-400 font-bold">{isRtl ? 'حالت کنتراست بالا (سیاه و سفید):' : 'High Contrast (B&W):'}</span>
              <button
                type="button"
                onClick={() => setHighContrast(!highContrast)}
                className={`text-xs font-bold px-3 py-1 rounded-lg border transition-all ${
                  highContrast 
                    ? 'bg-amber-500/10 border-amber-500 text-amber-500' 
                    : 'bg-[#131317] border-zinc-800 text-zinc-400'
                }`}
              >
                {highContrast ? (isRtl ? 'کنتراست فعال' : 'Active') : (isRtl ? 'خاموش' : 'Inactive')}
              </button>
            </div>

            {/* Steps checklist */}
            <div className="border-t border-zinc-800/40 pt-3 mt-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-zinc-500 font-extrabold uppercase">{isRtl ? 'انتخاب تکی گام‌ها:' : 'Select Steps:'}</span>
                <button 
                  type="button" 
                  onClick={toggleAllSteps}
                  className="text-[9px] text-amber-500 hover:text-amber-400 font-bold cursor-pointer"
                >
                  {selectedStepIds.length === steps.length ? (isRtl ? 'لغو انتخاب همه' : 'Deselect All') : (isRtl ? 'انتخاب همه' : 'Select All')}
                </button>
              </div>

              <div className="flex flex-col gap-1.5 max-h-[22vh] overflow-y-auto pr-1 custom-scrollbar">
                {steps.map((st) => {
                  const isChecked = selectedStepIds.includes(st.id);
                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => toggleStepSelection(st.id)}
                      className="flex items-center gap-2 text-right text-[11px] text-zinc-300 hover:text-white py-1.5 px-2.5 rounded bg-[#131317] border border-zinc-800/40 cursor-pointer"
                    >
                      {isChecked ? <CheckSquare size={12} className="text-amber-500 shrink-0" /> : <Square size={12} className="text-zinc-600 shrink-0" />}
                      <span className="truncate">{(st.station || '')} - {(st.operation || '').slice(0, 16)}...</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Direct Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-extrabold text-xs py-3 rounded-xl select-none cursor-pointer transition-all active:scale-95 shadow-lg mt-1"
            >
              <Printer size={14} strokeWidth={3} />
              <span>{isRtl ? 'ارسال به پرینتر / PDF' : 'Print Workstations / PDF'}</span>
            </button>
          </div>
        </div>

        {/* Unified Quality Audit Report Card */}
        <div className="bg-[#121216] border border-zinc-850 p-3.5 rounded-2xl flex flex-col gap-2 mt-2">
          <span className="text-[10px] text-amber-500 font-extrabold flex items-center gap-1.5 uppercase">
            <Zap size={11} />
            <span>{isRtl ? 'سیستم یکپارچه گزارش کیفیت' : 'Unified Quality Report'}</span>
          </span>

          <div className="grid grid-cols-2 gap-2 text-[10.5px] text-zinc-400 mt-1">
            <div>
              <span className="text-zinc-500 block text-[9px]">{isRtl ? 'تعداد کل مراحل:' : 'Total Steps:'}</span>
              <span className="font-bold text-white">{reportSummary.totalSteps}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[9px]">{isRtl ? 'ایستگاه‌ها:' : 'Stations:'}</span>
              <span className="font-bold text-white">{reportSummary.totalStations}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[9px]">{isRtl ? 'زمان کل چرخه:' : 'Total Cycle Time:'}</span>
              <span className="font-bold text-emerald-400 font-mono">{reportSummary.totalCycleTime}s</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[9px]">{isRtl ? 'نشان‌های ایمنی:' : 'Safety Badges:'}</span>
              <span className="font-bold text-rose-400 font-mono">{reportSummary.safetyCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. The Flawless Standardized Work Instruction Document Sheet */}
      <div className="flex-1 bg-zinc-950/20 p-4 border border-zinc-800/40 rounded-3xl overflow-auto max-h-[85vh] shadow-inner">
        {/* Style tag to inject print CSS styles */}
        <style>{`
          @media print {
            body {
              background-color: white !important;
              color: black !important;
            }
            .print-container {
              background-color: white !important;
              color: black !important;
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
            }
            .print-page {
              page-break-after: always !important;
              page-break-inside: avoid !important;
              margin-bottom: 0 !important;
              border: 2px solid black !important;
              padding: 15px !important;
              min-height: 100vh !important;
              display: flex !important;
              flex-direction: column !important;
              justify-content: space-between !important;
              background-color: white !important;
              color: black !important;
            }
            .print-page * {
              color: black !important;
              border-color: black !important;
            }
            .print-page select, .print-page button {
              display: none !important;
            }
            .print\\:hidden {
              display: none !important;
            }
          }
        `}</style>

        <div className="print-container flex flex-col gap-8 w-full max-w-3xl mx-auto">
          {activePrintSteps.map((step, index) => (
            <div 
              key={step.id} 
              className={`print-page border rounded-2xl p-6 flex flex-col justify-between shadow-md ${
                highContrast 
                  ? 'bg-white text-black border-zinc-950' 
                  : 'bg-[#111115] text-zinc-200 border-zinc-800/60'
              }`}
              style={{ minHeight: '800px', pageBreakAfter: 'always' }}
            >
              {/* ISO 9001 standard document control header */}
              <div className={`grid grid-cols-3 border-b-2 pb-4 mb-4 ${highContrast ? 'border-zinc-950 text-zinc-950' : 'border-zinc-800 text-zinc-300'}`}>
                {/* Column 1 - Title */}
                <div className="flex flex-col gap-1 text-right justify-center">
                  <div className="flex items-center gap-1.5">
                    <Award size={15} className="text-amber-500 shrink-0" />
                    <span className="font-black text-sm">{documentTitle}</span>
                  </div>
                  <span className="text-[9.5px] text-zinc-500 font-bold">{isRtl ? 'الزامات کار استاندارد فیزیکی IATF 16949 بند 8.5.1.2' : 'IATF 16949 Clause 8.5.1.2 Compliant SOS'}</span>
                </div>

                {/* Column 2 - Station */}
                <div className="flex flex-col justify-center items-center text-center border-x px-3 border-zinc-800">
                  <span className="text-xs font-black text-amber-500">{step.station}</span>
                  <span className="text-[9px] font-mono font-bold tracking-wider text-zinc-500 mt-1">{step.partNo}</span>
                </div>

                {/* Column 3 - Doc Control Info */}
                <div className="flex flex-col text-left justify-center text-[9px] font-bold text-zinc-500 leading-tight">
                  <div className="flex justify-between"><span>کد سند:</span><span className="font-mono text-zinc-300">QMS-WI-8.5.1.2</span></div>
                  <div className="flex justify-between"><span>بازنگری:</span><span className="font-mono text-zinc-300">03</span></div>
                  <div className="flex justify-between"><span>برگ پیشروی:</span><span className="text-zinc-300">{index + 1} از {activePrintSteps.length}</span></div>
                  <div className="flex justify-between"><span>زمان کار:</span><span className="font-mono text-zinc-300">{step.stdTime}s</span></div>
                </div>
              </div>

              {/* RENDER METHOD A: PRESET TRADITIONAL SHEET */}
              {printLayoutMode === 'preset' ? (
                <>
                  {/* Step Main Operation Title */}
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-4 text-center">
                    <span className="text-[10px] text-zinc-500 block mb-0.5 uppercase tracking-wide font-extrabold">{isRtl ? 'عملیات اصلی کار استاندارد شده' : 'Main Standardized Operation'}</span>
                    <span className="text-xs md:text-sm font-black text-amber-500">{step.operation}</span>
                  </div>

                  {/* Main Visual Image Box */}
                  <div className="relative w-full h-64 bg-zinc-950 border rounded-xl overflow-hidden mb-4 border-zinc-800/80">
                    <img 
                      src={step.imageUrl} 
                      alt="Print layout" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />

                    {/* Annotation overlays */}
                    {step.annotations?.map((ann) => (
                      <div 
                        key={ann.id} 
                        className="absolute flex items-center justify-center p-1.5 font-extrabold text-[9px] rounded-lg shadow-md border"
                        style={{
                          left: `${ann.x}%`,
                          top: `${ann.y}%`,
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: `${ann.color}25`,
                          borderColor: ann.color,
                          color: '#FFFFFF'
                        }}
                      >
                        {ann.text}
                      </div>
                    ))}
                  </div>

                  {/* Elements details grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    {/* Job Elements */}
                    <div className={`p-3.5 rounded-xl border ${highContrast ? 'bg-white border-zinc-950' : 'bg-zinc-900/40 border-zinc-800/50'}`}>
                      <span className="text-[9.5px] text-zinc-500 block mb-1 uppercase tracking-wide font-extrabold">{isRtl ? 'شرح جزئیات کار (Job Elements)' : 'Job Elements'}</span>
                      <p className="text-xs leading-relaxed text-zinc-300">{step.jobElements}</p>
                    </div>

                    {/* Key Points */}
                    <div className={`p-3.5 rounded-xl border ${highContrast ? 'bg-white border-zinc-950' : 'bg-sky-950/10 border-sky-900/30 text-sky-400'}`}>
                      <span className="text-[9.5px] block mb-1 uppercase tracking-wide font-extrabold text-sky-500">{isRtl ? 'نکات کلیدی کیفی/فنی (Key Points)' : 'Key Points'}</span>
                      <p className="text-xs leading-relaxed text-zinc-300">{step.keyPoints}</p>
                    </div>

                    {/* Reason Why */}
                    <div className={`p-3.5 rounded-xl border ${highContrast ? 'bg-white border-zinc-950' : 'bg-amber-950/10 border-amber-900/30 text-amber-500'}`}>
                      <span className="text-[9.5px] block mb-1 uppercase tracking-wide font-extrabold text-amber-500">{isRtl ? 'دلیل و چرایی ایمنی (Reason Why)' : 'Reason Why'}</span>
                      <p className="text-xs leading-relaxed text-zinc-300">{step.reasonWhy}</p>
                    </div>
                  </div>

                  {/* Auxiliary elements footer */}
                  <div className="grid grid-cols-3 gap-3 text-center border-t border-zinc-800/40 pt-4 text-[10px] text-zinc-500">
                    <div>
                      <span className="block text-zinc-600 mb-0.5 font-extrabold">{isRtl ? 'ابزارها و فیکسچرها:' : 'Tools & Equipment:'}</span>
                      <span className="text-zinc-300 font-bold">{step.equipment}</span>
                    </div>
                    <div>
                      <span className="block text-zinc-600 mb-0.5 font-extrabold">{isRtl ? 'تجهیزات ایمنی PPE:' : 'Required PPE:'}</span>
                      <span className="text-rose-400 font-bold">{step.safety}</span>
                    </div>
                    <div>
                      <span className="block text-zinc-600 mb-0.5 font-extrabold">{isRtl ? 'زمان استاندارد عملیات:' : 'Standard Cycle Time:'}</span>
                      <span className="text-emerald-400 font-mono font-bold">{step.stdTime} ثانیه</span>
                    </div>
                  </div>
                </>
              ) : (
                /* RENDER METHOD B: OPTIMAL DESIGNER BLOCKS FLOW WITH COMPRESSION SAVER */
                <div className="flex flex-col gap-3 flex-1">
                  {sortedBlocks.filter(b => b.visible).map((block) => {
                    // Fetch dynamic values bound to steps
                    let valStr = '';
                    if (block.columnMapping && block.columnMapping !== 'doc_info' && block.columnMapping !== 'signatures' && block.columnMapping !== 'custom') {
                      valStr = getStepValue(step, block.columnMapping);
                    } else if (block.columnMapping === 'custom') {
                      valStr = block.customText || '';
                    }

                    // Apply smart compression if toggled
                    const padVal = compressPadding ? Math.max(3, Math.round(block.padding * 0.4)) : block.padding;
                    const fsVal = compressPadding ? Math.max(9, block.fontSize - 2) : block.fontSize;
                    const blockHeight = block.type === 'image' && compressPadding 
                      ? Math.max(110, Math.round((block.imageHeight || 176) * 0.7)) 
                      : (block.imageHeight || 176);

                    return (
                      <div
                        key={block.id}
                        className="rounded-lg border p-3 flex flex-col transition-all page-break-inside-avoid"
                        style={{
                          backgroundColor: highContrast ? '#FFFFFF' : block.bgColor,
                          color: highContrast ? '#000000' : block.textColor,
                          fontSize: `${fsVal}px`,
                          padding: `${padVal}px`,
                          borderWidth: `${block.borderThickness}px`,
                          borderColor: highContrast ? '#000000' : block.borderColor,
                        }}
                      >
                        {/* Title bar */}
                        <div className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 mb-1 border-b border-zinc-800/10 pb-0.5">
                          {block.title}
                        </div>

                        {/* Badges for operation block inside optimal print */}
                        {block.columnMapping === 'operation' && step.symbols && step.symbols.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {step.symbols.map((sym: string) => (
                              <span key={sym} className="text-[9px] font-black px-1 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-500 flex items-center gap-1">
                                <span>{sym === 'Safety' ? '⚠️' : sym === 'CC' ? '💎' : sym === 'SC' ? '⚙️' : sym === 'Inspection' ? '🔍' : sym === 'PPE' ? '🛡️' : '★'}</span>
                                <span>{sym}</span>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Rendering blocks according to design types */}
                        {block.type === 'doc_info' && (
                          <div className="grid grid-cols-4 gap-2 text-[10px] text-zinc-400 font-bold" dir="rtl">
                            <div><span className="text-zinc-500 block text-[8px]">کد سند:</span><span className="font-mono">QMS-WI-8.5.1.2</span></div>
                            <div><span className="text-zinc-500 block text-[8px]">تاریخ صدور:</span><span>1405/03/01</span></div>
                            <div><span className="text-zinc-500 block text-[8px]">شماره بازنگری:</span><span className="font-mono">03</span></div>
                            <div><span className="text-zinc-500 block text-[8px]">وضعیت:</span><span className="text-emerald-500">جاری</span></div>
                          </div>
                        )}

                        {block.type === 'image' && (
                          <div 
                            className="relative w-full rounded overflow-hidden bg-zinc-950 border border-zinc-800"
                            style={{ height: `${blockHeight}px` }}
                          >
                            <img 
                              src={step.imageUrl} 
                              alt="Operation visual" 
                              className="w-full h-full"
                              style={{ objectFit: block.objectFit || 'cover' }}
                              referrerPolicy="no-referrer"
                            />
                            {/* Annotations layer */}
                            {step.annotations?.map((ann) => (
                              <div 
                                key={ann.id} 
                                className="absolute flex items-center justify-center p-1 font-black text-[8.5px] rounded"
                                style={{
                                  left: `${ann.x}%`,
                                  top: `${ann.y}%`,
                                  transform: 'translate(-50%, -50%)',
                                  backgroundColor: `${ann.color}35`,
                                  borderColor: ann.color,
                                  borderWidth: '1px',
                                  color: '#FFFFFF'
                                }}
                              >
                                {ann.text}
                              </div>
                            ))}
                          </div>
                        )}

                        {block.type === 'signatures' && (
                          <div className="grid grid-cols-3 gap-1 text-[9px] text-zinc-400 text-center" dir="rtl">
                            <div className="border border-zinc-800/40 p-1.5 rounded">
                              <span className="text-zinc-600 block mb-0.5">تدوین:</span>
                              <span className="font-bold text-zinc-300">مهندسی فرآیند</span>
                            </div>
                            <div className="border border-zinc-800/40 p-1.5 rounded">
                              <span className="text-zinc-600 block mb-0.5">تایید:</span>
                              <span className="font-bold text-zinc-300">تضمین کیفیت / QA</span>
                            </div>
                            <div className="border border-zinc-800/40 p-1.5 rounded">
                              <span className="text-zinc-600 block mb-0.5">تصویب:</span>
                              <span className="font-bold text-zinc-300">مدیریت کارگاه</span>
                            </div>
                          </div>
                        )}

                        {block.type === 'std_time' && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-center text-[9px] font-bold" dir="rtl">
                            <div className="bg-emerald-500/10 p-1 rounded border border-emerald-500/20">
                              <span className="text-emerald-500 block text-[7.5px] mb-0.5">زمان استاندارد:</span>
                              <span className="text-emerald-400 font-mono font-bold">{step.stdTime || 0}s</span>
                            </div>
                            <div className="bg-zinc-950/40 p-1 rounded border border-zinc-850">
                              <span className="text-zinc-500 block text-[7.5px] mb-0.5">تکت تایم (Takt):</span>
                              <span className="text-zinc-300 font-mono">{step.taktTime || 0}s</span>
                            </div>
                            <div className="bg-zinc-950/40 p-1 rounded border border-zinc-850">
                              <span className="text-zinc-500 block text-[7.5px] mb-0.5">زمان سیکل:</span>
                              <span className="text-zinc-300 font-mono">{step.cycleTime || 0}s</span>
                            </div>
                            <div className="bg-zinc-950/40 p-1 rounded border border-zinc-850">
                              <span className="text-zinc-500 block text-[7.5px] mb-0.5">زمان دستی:</span>
                              <span className="text-zinc-300 font-mono">{step.manualTime || 0}s</span>
                            </div>
                            <div className="bg-zinc-950/40 p-1 rounded border border-zinc-850">
                              <span className="text-zinc-500 block text-[7.5px] mb-0.5">خودکار ماشین:</span>
                              <span className="text-zinc-300 font-mono">{step.machineTime || 0}s</span>
                            </div>
                            <div className="bg-zinc-950/40 p-1 rounded border border-zinc-850">
                              <span className="text-zinc-500 block text-[7.5px] mb-0.5">بارگذاری/تخلیه:</span>
                              <span className="text-zinc-300 font-mono">{step.loadUnloadTime || 0}s</span>
                            </div>
                            <div className="bg-zinc-950/40 p-1 rounded border border-zinc-850">
                              <span className="text-zinc-500 block text-[7.5px] mb-0.5">زمان انتظار:</span>
                              <span className="text-zinc-300 font-mono">{step.waitingTime || 0}s</span>
                            </div>
                            <div className="bg-zinc-950/40 p-1 rounded border border-zinc-850">
                              <span className="text-zinc-500 block text-[7.5px] mb-0.5">تنظیم/تعویض:</span>
                              <span className="text-zinc-300 font-mono">{step.setupTime || 0}s</span>
                            </div>
                          </div>
                        )}

                        {block.type !== 'doc_info' && block.type !== 'image' && block.type !== 'signatures' && block.type !== 'std_time' && (
                          <p className="text-xs leading-relaxed text-zinc-300 whitespace-pre-line">
                            {valStr}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Standard approval signatures footer block (Fallback QA checklist signoffs) */}
              <div className="grid grid-cols-3 gap-2 mt-4 text-[9px] text-zinc-500 text-center border-t border-zinc-800/10 pt-3">
                <div><span>تهیه کننده: مهندسی فرآیند ساخت</span></div>
                <div><span>تایید کننده: رئیس تضمین کیفیت</span></div>
                <div><span>تصویب کننده: مدیر تضمین کیفیت و مهندسی</span></div>
              </div>
            </div>
          ))}

          {activePrintSteps.length === 0 && (
            <div className="text-center py-16 text-slate-500 text-xs">
              {isRtl ? 'لطفاً حداقل یک گام کار استاندارد شده را برای تولید نسخه چاپی انتخاب کنید.' : 'Please select at least one step to display print layout.'}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
