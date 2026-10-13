/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, LayoutGrid, Printer, Sparkles, CheckSquare, 
  Settings, Layers, RefreshCw, Save, Info 
} from 'lucide-react';
import { SWIStep, SWIBlock, DEFAULT_SWI_BLOCKS, AUTOMOTIVE_SWI_PRESETS } from '../types/swi';
import SWIDataGrid from './SWIDataGrid';
import SWIBlockDesigner from './SWIBlockDesigner';
import SWIPrintView from './SWIPrintView';
import SWIImageEditor from './SWIImageEditor';
import { QmsDatabase } from '../lib/qmsDatabase';

interface StandardWorkInstructionDesignerProps {
  documentTitle: string;
  items: any[];
  onSave: (items: any[]) => void;
  lang: 'fa' | 'en';
}

export default function StandardWorkInstructionDesigner({
  documentTitle,
  items,
  onSave,
  lang
}: StandardWorkInstructionDesignerProps) {
  const isRtl = lang === 'fa';
  
  // View states: 'grid' (Data Grid), 'designer' (Block Designer), 'print' (Print & Report View)
  const [activeView, setActiveView] = useState<'grid' | 'designer' | 'print'>('grid');
  
  // Shared synchronized states (Single Source of Truth)
  const [steps, setSteps] = useState<SWIStep[]>([]);
  const [blocks, setBlocks] = useState<SWIBlock[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [columnDbLinks, setColumnDbLinks] = useState<Record<string, { dbTable: string; dbColumn: string }>>({});
  
  // Shared state for drafting a new step directly from the design canvas
  const [localDraftStep, setLocalDraftStep] = useState<Partial<SWIStep>>({});
  const [isDraftingNewStep, setIsDraftingNewStep] = useState(false);

  const isAnyColumnDbLinked = useMemo(() => {
    return Object.values(columnDbLinks || {}).some((link: any) => link && link.dbTable && link.dbColumn);
  }, [columnDbLinks]);

  useEffect(() => {
    if (steps.length === 0 && !isAnyColumnDbLinked) {
      setIsDraftingNewStep(true);
    }
  }, [steps.length, isAnyColumnDbLinked]);
  
  // Image Editor Modal state
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false);

  // Initialize column DB links from localStorage if available
  useEffect(() => {
    const savedLinks = localStorage.getItem(`swi_column_db_links_${documentTitle}`);
    if (savedLinks) {
      try {
        setColumnDbLinks(JSON.parse(savedLinks));
      } catch (e) {
        console.error('Failed to parse saved column DB links', e);
      }
    }
  }, [documentTitle]);

  const handleColumnDbLinksChange = (updatedLinks: Record<string, { dbTable: string; dbColumn: string }>) => {
    setColumnDbLinks(updatedLinks);
    localStorage.setItem(`swi_column_db_links_${documentTitle}`, JSON.stringify(updatedLinks));
  };

  // Initialize steps from document items or load defaults if empty
  useEffect(() => {
    if (items && items.length > 0) {
      setSteps(items as SWIStep[]);
      setSelectedStepId(prev => {
        if (prev && items.some(item => item.id === prev)) {
          return prev;
        }
        return items[0].id;
      });
    } else {
      // Empty by default as requested by the user
      setSteps([]);
      setSelectedStepId(null);
    }
  }, [items]);

  // Handle saving back to database
  const handlePersistChanges = (updatedSteps: SWIStep[]) => {
    setSteps(updatedSteps);
    onSave(updatedSteps);
  };

  const handleBlocksChange = (updatedBlocks: SWIBlock[]) => {
    setBlocks(updatedBlocks);
    // Persist block layouts in localStorage and central database to preserve user configurations across sessions
    localStorage.setItem(`swi_layout_blocks_${documentTitle}`, JSON.stringify(updatedBlocks));
    QmsDatabase.writeRow(QmsDatabase.TABLES.DOCUMENTS, `swi_layout_blocks_${documentTitle}`, updatedBlocks);
  };

  // Load custom block layouts on mount if saved
  useEffect(() => {
    const dbBlocks = QmsDatabase.selectRow<SWIBlock[]>(QmsDatabase.TABLES.DOCUMENTS, `swi_layout_blocks_${documentTitle}`);
    if (dbBlocks && dbBlocks.length > 0) {
      setBlocks(dbBlocks);
    } else {
      const saved = localStorage.getItem(`swi_layout_blocks_${documentTitle}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.length > 0) {
            setBlocks(parsed);
          } else {
            setBlocks([]);
          }
        } catch (err) {
          console.error('Failed to parse saved blocks', err);
          setBlocks([]);
        }
      } else {
        setBlocks([]);
      }
    }
  }, [documentTitle]);

  const activeStepForAnnotation = steps.find(s => s.id === selectedStepId) || steps[0] || null;

  return (
    <div className="flex flex-col gap-6" dir={isRtl ? 'rtl' : 'ltr'}>

      {/* 2. Beautiful Primary View Selector Tabs */}
      <div className="bg-[#0B0B0E]/80 border border-zinc-800/80 rounded-2xl p-1.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-1.5 p-1 bg-[#121215] rounded-xl border border-zinc-800/50">
          
          {/* Tab 1: Data Grid */}
          <button
            type="button"
            onClick={() => setActiveView('grid')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer select-none ${
              activeView === 'grid'
                ? 'bg-gradient-to-r from-amber-500/10 to-amber-500/20 border border-amber-500/30 text-amber-400 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
            }`}
          >
            <FileSpreadsheet size={14} className={activeView === 'grid' ? 'text-amber-500' : 'text-zinc-500'} />
            <span>{isRtl ? 'نمای جدولی (Data Grid)' : 'Data Grid (Source of Truth)'}</span>
            <span className={`text-[9.5px] px-1.5 py-0.5 rounded-full font-bold ${
              activeView === 'grid' ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-500'
            }`}>
              {steps.length}
            </span>
          </button>

          {/* Tab 2: Block Designer */}
          <button
            type="button"
            onClick={() => setActiveView('designer')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer select-none ${
              activeView === 'designer'
                ? 'bg-gradient-to-r from-amber-500/10 to-amber-500/20 border border-amber-500/30 text-amber-400 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
            }`}
          >
            <LayoutGrid size={14} className={activeView === 'designer' ? 'text-amber-500' : 'text-zinc-500'} />
            <span>{isRtl ? 'طراحی بلوکی (Block Designer)' : 'Block Designer (WYSIWYG)'}</span>
          </button>

          {/* Tab 3: Print / Shop floor Layout */}
          <button
            type="button"
            onClick={() => setActiveView('print')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer select-none ${
              activeView === 'print'
                ? 'bg-gradient-to-r from-amber-500/10 to-amber-500/20 border border-amber-500/30 text-amber-400 shadow-md'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
            }`}
          >
            <Printer size={14} className={activeView === 'print' ? 'text-amber-500' : 'text-zinc-500'} />
            <span>{isRtl ? 'نسخه چاپی کارگاه (Print View)' : 'Print Sheet & Report'}</span>
          </button>

        </div>

        {/* Informative advice */}
        <div className="hidden md:flex items-center gap-1.5 px-4 text-[10px] text-zinc-500 font-extrabold uppercase">
          <Info size={11} className="text-amber-500 animate-bounce" />
          <span>{isRtl ? 'مستقیماً متصل به پایگاه اسناد کیفیت' : 'DIRECT QUALITY DOC LINK'}</span>
        </div>
      </div>

      {/* 3. Render Active Tab View */}
      <div className="transition-all duration-200">
        {activeView === 'grid' && (
          <SWIDataGrid
            steps={steps}
            onStepsChange={handlePersistChanges}
            onSelectStep={setSelectedStepId}
            selectedStepId={selectedStepId}
            blocks={blocks}
            onBlocksChange={handleBlocksChange}
            columnDbLinks={columnDbLinks}
            onColumnDbLinksChange={handleColumnDbLinksChange}
            lang={lang}
            localDraftStep={localDraftStep}
            setLocalDraftStep={setLocalDraftStep}
            isDraftingNewStep={isDraftingNewStep}
            setIsDraftingNewStep={setIsDraftingNewStep}
          />
        )}

        {activeView === 'designer' && (
          <SWIBlockDesigner
            steps={steps}
            onStepsChange={handlePersistChanges}
            blocks={blocks}
            onBlocksChange={handleBlocksChange}
            selectedStepId={selectedStepId}
            onSelectStep={setSelectedStepId}
            columnDbLinks={columnDbLinks}
            lang={lang}
            onOpenImageEditor={() => setIsImageEditorOpen(true)}
            onSwitchView={setActiveView}
            localDraftStep={localDraftStep}
            setLocalDraftStep={setLocalDraftStep}
            isDraftingNewStep={isDraftingNewStep}
            setIsDraftingNewStep={setIsDraftingNewStep}
          />
        )}

        {activeView === 'print' && (
          <SWIPrintView
            steps={steps}
            blocks={blocks}
            lang={lang}
            documentTitle={documentTitle}
          />
        )}
      </div>

      {/* 4. VECTOR ANNOTATING IMAGE EDITOR MODAL */}
      {isImageEditorOpen && activeStepForAnnotation && (
        <SWIImageEditor
          step={activeStepForAnnotation}
          onClose={() => setIsImageEditorOpen(false)}
          lang={lang}
          onSave={(annotations, images, activeIndex) => {
            const updated = steps.map(s => {
              if (s.id === activeStepForAnnotation.id) {
                return { 
                  ...s, 
                  annotations, 
                  images, 
                  activeImageIndex: activeIndex,
                  imageUrl: images[activeIndex] || s.imageUrl
                };
              }
              return s;
            });
            handlePersistChanges(updated);
            setIsImageEditorOpen(false);
          }}
        />
      )}

    </div>
  );
}
