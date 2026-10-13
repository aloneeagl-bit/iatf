/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Layers, Lock, Unlock, Eye, EyeOff, Trash2, Plus, LayoutGrid, 
  Settings, Type, FileText, Image as ImageIcon, Sparkles, Check, 
  HelpCircle, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Copy, Database
} from 'lucide-react';
import { SWIStep, SWIBlock, DEFAULT_SWI_BLOCKS } from '../types/swi';
import { QmsDatabase } from '../lib/qmsDatabase';

interface SWIBlockDesignerProps {
  steps: SWIStep[];
  onStepsChange: (steps: SWIStep[]) => void;
  blocks: SWIBlock[];
  onBlocksChange: (blocks: SWIBlock[]) => void;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  columnDbLinks?: Record<string, { dbTable: string; dbColumn: string }>;
  lang: 'fa' | 'en';
  onOpenImageEditor: () => void;
  onSwitchView?: (view: 'grid' | 'designer' | 'print') => void;
  localDraftStep?: Partial<SWIStep>;
  setLocalDraftStep?: React.Dispatch<React.SetStateAction<Partial<SWIStep>>>;
  isDraftingNewStep?: boolean;
  setIsDraftingNewStep?: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function SWIBlockDesigner({
  steps,
  onStepsChange,
  blocks,
  onBlocksChange,
  selectedStepId,
  onSelectStep,
  columnDbLinks,
  lang,
  onOpenImageEditor,
  onSwitchView,
  localDraftStep = {},
  setLocalDraftStep,
  isDraftingNewStep = false,
  setIsDraftingNewStep
}: SWIBlockDesignerProps) {
  const isRtl = lang === 'fa';
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(blocks[0]?.id || null);

  const isAnyColumnDbLinked = React.useMemo(() => {
    return Object.values(columnDbLinks || {}).some(link => link && link.dbTable && link.dbColumn);
  }, [columnDbLinks]);

  // Turn off drafting mode when a specific step is selected
  useEffect(() => {
    if (selectedStepId && selectedStepId !== 'draft-step-id') {
      setIsDraftingNewStep?.(false);
    }
  }, [selectedStepId, setIsDraftingNewStep]);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Custom confirmation dialog state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showSuccessToast = (message: string) => {
    setToast({ message, type: 'success' });
  };

  useEffect(() => {
    if (blocks.length > 0) {
      const exists = blocks.some(b => b.id === selectedBlockId);
      if (!exists) {
        setSelectedBlockId(blocks[0].id);
      }
    } else {
      setSelectedBlockId(null);
    }
  }, [blocks, selectedBlockId]);

  // Custom block creator state
  const [isCustomCreatorOpen, setIsCustomCreatorOpen] = useState(false);
  const [newBlockTitle, setNewBlockTitle] = useState('');
  const [newBlockField, setNewBlockField] = useState('');

  // Saved templates state
  const [savedTemplates, setSavedTemplates] = useState<{ id: string; name: string; blocks: SWIBlock[] }[]>(() => {
    try {
      const saved = localStorage.getItem('swi_custom_layout_templates');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [templateSaveName, setTemplateSaveName] = useState('');

  const handleSaveCurrentLayout = () => {
    if (!templateSaveName.trim()) {
      alert(isRtl ? 'لطفا نامی برای قالب وارد کنید.' : 'Please enter a name for the template.');
      return;
    }
    const newTemplate = {
      id: `template_${Date.now()}`,
      name: templateSaveName.trim(),
      blocks: JSON.parse(JSON.stringify(blocks))
    };
    const nextTemplates = [...savedTemplates, newTemplate];
    setSavedTemplates(nextTemplates);
    localStorage.setItem('swi_custom_layout_templates', JSON.stringify(nextTemplates));
    setTemplateSaveName('');
  };

  const handleApplyTemplate = (tpl: { id: string; name: string; blocks: SWIBlock[] }) => {
    onBlocksChange(tpl.blocks);
  };

  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const tplName = savedTemplates.find(t => t.id === id)?.name || '';
    const confirmMsg = isRtl
      ? `آیا از حذف قالب چیدمان "${tplName}" اطمینان دارید؟`
      : `Are you sure you want to delete template "${tplName}"?`;
    if (!window.confirm(confirmMsg)) return;
    const nextTemplates = savedTemplates.filter(t => t.id !== id);
    setSavedTemplates(nextTemplates);
    localStorage.setItem('swi_custom_layout_templates', JSON.stringify(nextTemplates));
  };

  const handleConfirmAndAddStep = () => {
    // Check if they entered at least some content
    const hasData = Object.values(localDraftStep).some(val => val !== undefined && val !== null && String(val).trim() !== '');
    if (!hasData) {
      setToast({
        message: isRtl 
          ? '⚠️ خطا: لطفا ابتدا حداقل یکی از فیلدهای بوم طراحی را پر کنید.' 
          : '⚠️ Error: Please fill in at least one field on the canvas first.',
        type: 'error'
      });
      return;
    }

    const newStepId = `swi-step-${Date.now()}`;
    const newStep: SWIStep = {
      id: newStepId,
      station: localDraftStep.station || '',
      partNo: localDraftStep.partNo || '',
      operation: localDraftStep.operation || (isRtl ? `عملیات شماره ${steps.length + 1}` : `Operation #${steps.length + 1}`),
      jobElements: localDraftStep.jobElements || '',
      keyPoints: localDraftStep.keyPoints || '',
      reasonWhy: localDraftStep.reasonWhy || '',
      equipment: localDraftStep.equipment || '',
      safety: localDraftStep.safety || '',
      stdTime: Number(localDraftStep.stdTime) || 60,
      taktTime: Number(localDraftStep.taktTime) || 0,
      cycleTime: Number(localDraftStep.cycleTime) || 0,
      manualTime: Number(localDraftStep.manualTime) || 0,
      machineTime: Number(localDraftStep.machineTime) || 0,
      loadUnloadTime: Number(localDraftStep.loadUnloadTime) || 0,
      waitingTime: Number(localDraftStep.waitingTime) || 0,
      setupTime: Number(localDraftStep.setupTime) || 0,
      imageUrl: localDraftStep.imageUrl || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80',
      images: [localDraftStep.imageUrl || 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=600&q=80'],
      activeImageIndex: 0,
      annotations: [],
      symbols: [],
      dbRowIds: {}
    };

    const updatedSteps = [...steps, newStep];
    onStepsChange(updatedSteps);
    onSelectStep(newStepId);
    
    // Clear local fields for next input
    setLocalDraftStep?.({});
    setIsDraftingNewStep?.(false);

    showSuccessToast(
      isRtl
        ? `✅ گام عملیاتی جدید با موفقیت به نمای جدولی اضافه و بوم پاکسازی شد.`
        : `✅ New operational step added successfully and canvas fields cleared.`
    );
  };

  // Dropdown accordions state for Station & Operation selection helper
  const [isStationListOpen, setIsStationListOpen] = useState(false);
  const [isOperationListOpen, setIsOperationListOpen] = useState(false);

  // Active preview step (Single Source of Truth)
  const activeStep = !isDraftingNewStep ? (steps.find(s => s.id === selectedStepId) || steps[0] || null) : null;

  const selectedBlock = blocks.find(b => b.id === selectedBlockId) || null;

  // Resolve Cell DB value (Single Source of Truth)
  const getResolvedCellValue = (colField: string) => {
    const stepToUse = !isDraftingNewStep ? activeStep : localDraftStep;
    if (!stepToUse) return '';
    
    const dbLink = columnDbLinks?.[colField];
    if (dbLink && dbLink.dbTable && dbLink.dbColumn && !isDraftingNewStep && activeStep) {
      const rowId = activeStep.dbRowIds?.[colField];
      if (rowId) {
        try {
          const targetRow = QmsDatabase.selectRow<any>(dbLink.dbTable as any, rowId);
          if (targetRow) {
            const val = targetRow[dbLink.dbColumn];
            return val !== undefined && val !== null ? String(val) : '';
          }
        } catch (e) {
          console.warn('Error resolving DB block value', e);
        }
      }
      return '';
    }
    return stepToUse[colField] !== undefined && stepToUse[colField] !== null ? String(stepToUse[colField]) : '';
  };

  // Color options for properties panel
  const COLOR_PRESETS = [
    { name: 'Dark Slate', bg: '#18181C', text: '#FFFFFF' },
    { name: 'Charcoal Card', bg: '#1C1C1E', text: '#E4E4E7' },
    { name: 'Safety Yellow', bg: '#451A03', text: '#FDBA74' },
    { name: 'Sky Technical', bg: '#1E293B', text: '#38BDF8' },
    { name: 'Deep Metal', bg: '#0F0F11', text: '#FFFFFF' },
    { name: 'Industrial Red', bg: '#450A0A', text: '#FECACA' },
    { name: 'Clean White', bg: '#F8FAFC', text: '#0F172A' }
  ];

  // Block Library definition
  const BLOCK_TEMPLATES = [
    { type: 'station', title: 'ایستگاه کاری (SOS)', colMap: 'station' },
    { type: 'part_no', title: 'شماره فنی قطعه (Part No)', colMap: 'partNo' },
    { type: 'operation', title: 'نام عملیات ساخت', colMap: 'operation' },
    { type: 'image', title: 'تصاویر و نقشه فنی (JES Image)', colMap: 'imageUrl' },
    { type: 'job_elements', title: 'جزئیات کار (Job Elements)', colMap: 'jobElements' },
    { type: 'key_points', title: 'نکات کلیدی (Key Points)', colMap: 'keyPoints' },
    { type: 'reason_why', title: 'دلیل ایمنی (Reason Why)', colMap: 'reasonWhy' },
    { type: 'equipment', title: 'ابزارها و فیکسچرها', colMap: 'equipment' },
    { type: 'safety', title: 'تجهیزات حفاظتی (PPE)', colMap: 'safety' },
    { type: 'std_time', title: 'زمان‌های عملیات', colMap: 'stdTime' },
    { type: 'signatures', title: 'امضاهای مجاز کنترل کیفیت', colMap: 'signatures' },
    { type: 'custom', title: 'بلوک متن سفارشی', colMap: 'custom' }
  ];

  // Add block to canvas
  const handleAddBlock = (template: typeof BLOCK_TEMPLATES[0]) => {
    const newBlock: SWIBlock = {
      id: `block-${Date.now()}`,
      type: template.type,
      title: template.title,
      x: 0,
      y: 850, // bottom by default
      w: 6,
      h: 60,
      bgColor: '#1C1C1E',
      textColor: '#E4E4E7',
      fontSize: 12,
      padding: 10,
      borderThickness: 1,
      borderColor: '#333338',
      locked: false,
      visible: true,
      columnMapping: template.colMap as any,
      customText: template.type === 'custom' ? (isRtl ? 'یک متن دلخواه کارگاهی اینجا بنویسید' : 'Write custom text here') : undefined
    };
    onBlocksChange([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    showSuccessToast(
      isRtl 
        ? `بلوک «${template.title}» با موفقیت به بوم طراحی اضافه شد.` 
        : `Block "${template.title}" successfully added to the canvas.`
    );
  };

  // Create custom field block
  const handleCreateCustomBlock = () => {
    if (!newBlockTitle.trim() || !newBlockField.trim()) return;
    const cleanField = newBlockField.trim().replace(/[^a-zA-Z0-9_]/g, '');
    const newBlock: SWIBlock = {
      id: `block-custom-${Date.now()}`,
      type: 'custom',
      title: newBlockTitle.trim(),
      x: 0,
      y: 900,
      w: 6,
      h: 60,
      bgColor: '#1C1C1E',
      textColor: '#E4E4E7',
      fontSize: 12,
      padding: 10,
      borderThickness: 1,
      borderColor: '#333338',
      locked: false,
      visible: true,
      columnMapping: cleanField
    };
    onBlocksChange([...blocks, newBlock]);
    setSelectedBlockId(newBlock.id);
    const titleVal = newBlockTitle.trim();
    setNewBlockTitle('');
    setNewBlockField('');
    setIsCustomCreatorOpen(false);
    showSuccessToast(
      isRtl 
        ? `بلوک سفارشی جدید «${titleVal}» با موفقیت به بوم اضافه شد.` 
        : `New custom block "${titleVal}" successfully added to the canvas.`
    );
  };

  // Modify block properties
  const handleUpdateBlock = (blockId: string, updates: Partial<SWIBlock>) => {
    onBlocksChange(blocks.map(b => b.id === blockId ? { ...b, ...updates } : b));
  };

  // Delete block
  const handleDeleteBlock = (blockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const blockTitle = blocks.find(b => b.id === blockId)?.title || '';
    const confirmMsg = isRtl
      ? `آیا از حذف بلوک/ستون "${blockTitle}" از بوم طراحی اطمینان دارید؟`
      : `Are you sure you want to delete block "${blockTitle}" from the canvas?`;
    if (!window.confirm(confirmMsg)) return;
    onBlocksChange(blocks.filter(b => b.id !== blockId));
    if (selectedBlockId === blockId) {
      setSelectedBlockId(blocks[0]?.id || null);
    }
  };

  // Duplicate block
  const handleDuplicateBlock = (block: SWIBlock, e: React.MouseEvent) => {
    e.stopPropagation();
    const duplicated: SWIBlock = {
      ...block,
      id: `block-${Date.now()}`,
      title: `${block.title} (${isRtl ? 'کپی' : 'Copy'})`,
      y: block.y + 70, // offset a bit downwards
      locked: false
    };
    onBlocksChange([...blocks, duplicated]);
    setSelectedBlockId(duplicated.id);
    showSuccessToast(
      isRtl 
        ? `کپی از بلوک «${block.title}» با موفقیت به بوم اضافه شد.` 
        : `Duplicated block of "${block.title}" successfully added to the canvas.`
    );
  };

  // Single Source of Truth edit handler: updating text directly in block updates active step row
  const handleStepValueChange = (field: keyof SWIStep, value: any) => {
    if (isDraftingNewStep || !activeStep) {
      setLocalDraftStep?.(prev => ({ ...prev, [field]: value }));
      return;
    }
    onStepsChange(steps.map(s => s.id === activeStep.id ? { ...s, [field]: value } : s));
  };

  // Dropdown list computation
  const uniqueStationsList = Array.from(new Set(steps.map(s => s.station).filter(Boolean)));
  const uniqueOperationsList = Array.from(new Set(steps.map(s => s.operation).filter(Boolean)));

  const handleApplyQuickValue = (field: keyof SWIStep, val: string) => {
    if (!isDraftingNewStep && !activeStep) return;
    const link = columnDbLinks?.[field as string];
    if (link && link.dbTable && link.dbColumn) {
      alert(isRtl ? 'این فیلد با دیتابیس همگام است و قابل تغییر دستی نیست.' : 'This field is database-connected and read-only.');
      return;
    }
    handleStepValueChange(field, val);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* 1. Left Panel - Block Library */}
      <div className="w-full lg:w-72 bg-[#09090D] border border-[#1E1E23] rounded-2xl p-4 shrink-0 shadow-lg flex flex-col gap-4">
        <div>
          <h3 className="text-xs font-black text-amber-500 mb-3 flex items-center gap-2 uppercase tracking-wider">
            <Layers size={13} />
            <span>{isRtl ? 'کتابخانه بلوک‌های JES/SOS' : 'Block Library'}</span>
          </h3>

          <div className="bg-amber-500/10 border border-dashed border-amber-500/30 text-amber-500 rounded-xl p-3 mb-3 text-[10px] font-bold leading-relaxed flex items-start gap-2 shadow">
            <LayoutGrid size={14} className="shrink-0 text-amber-500 mt-0.5" />
            <div>
              <p className="font-black text-amber-400 mb-0.5">{isRtl ? 'حالت بوم‌پایه (طراحی مستقل)' : 'Canvas-First Design Mode'}</p>
              <p className="text-zinc-400 text-[8.5px] font-medium leading-normal">
                {isRtl 
                  ? 'بلوک‌های طراحی مستقیماً ستون‌های دیتابیس بوم را تعریف می‌کنند. می‌توانید بلوک اضافه کرده و از پیش‌نویس گام جدید استفاده کنید.'
                  : 'Design blocks directly establish layout columns. Add components freely and draft steps dynamically.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {/* Create custom block library button */}
            <button
              type="button"
              onClick={() => setIsCustomCreatorOpen(!isCustomCreatorOpen)}
              className="w-full mb-1.5 flex items-center justify-center gap-1 bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] py-2 rounded-xl transition-all shadow-md cursor-pointer select-none"
            >
            <Plus size={11} strokeWidth={3} />
            <span>{isRtl ? 'تعریف بلوک سفارشی جدید' : 'Create Custom Block'}</span>
          </button>

          <div className="flex gap-1.5 mb-3">
            <button
              type="button"
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  title: isRtl ? '⚠️ بارگذاری قالب پیش‌فرض' : '⚠️ Load Preset',
                  message: isRtl ? 'آیا از بارگذاری قالب کامل پیش‌فرض SOS اطمینان دارید؟ تمام طراحی فعلی بوم شما با قالب استاندارد جایگزین می‌شود.' : 'Are you sure you want to load the default SOS template? This will replace your current design canvas.',
                  onConfirm: () => {
                    onBlocksChange(DEFAULT_SWI_BLOCKS);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  }
                });
              }}
              className="flex-1 flex items-center justify-center gap-1 bg-[#131317] border border-zinc-800 hover:bg-zinc-800/60 text-amber-500 hover:text-amber-400 font-extrabold text-[9.5px] py-1.5 rounded-xl transition-all cursor-pointer select-none"
            >
              <span>{isRtl ? 'قالب پیش‌فرض SOS' : 'SOS Preset'}</span>
            </button>
            
            <button
              type="button"
              onClick={() => {
                setConfirmModal({
                  isOpen: true,
                  title: isRtl ? '⚠️ پاک‌سازی بوم' : '⚠️ Clear Canvas',
                  message: isRtl ? 'آیا از پاک‌سازی بوم طراحی و حذف تمامی ستون‌ها اطمینان دارید؟' : 'Are you sure you want to clear the design canvas and remove all columns?',
                  onConfirm: () => {
                    onBlocksChange([]);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                  }
                });
              }}
              className="flex-1 flex items-center justify-center gap-1 bg-[#131317] border border-zinc-800 hover:bg-zinc-800/60 text-red-400 hover:text-red-300 font-extrabold text-[9.5px] py-1.5 rounded-xl transition-all cursor-pointer select-none"
            >
              <span>{isRtl ? 'پاک‌سازی بوم' : 'Clear Canvas'}</span>
            </button>
          </div>

          {isCustomCreatorOpen && (
            <div className="bg-[#121216] border border-zinc-800 rounded-xl p-3 mb-3.5 flex flex-col gap-2 shadow-inner">
              <div>
                <label className="text-[9px] text-zinc-500 font-extrabold block mb-0.5">{isRtl ? 'عنوان بلوک:' : 'Block Display Title:'}</label>
                <input
                  type="text"
                  value={newBlockTitle}
                  onChange={(e) => setNewBlockTitle(e.target.value)}
                  placeholder={isRtl ? "مثلا: مشخصات فنی کوره" : "e.g. Furnace Spec"}
                  className="w-full bg-[#1A1A22] border border-zinc-850 rounded-lg p-1.5 text-xs text-white outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] text-zinc-500 font-extrabold block mb-0.5">{isRtl ? 'کد متغیر (انگلیسی):' : 'Variable Field Code:'}</label>
                <input
                  type="text"
                  value={newBlockField}
                  onChange={(e) => setNewBlockField(e.target.value)}
                  placeholder="e.g. furnace_spec"
                  className="w-full bg-[#1A1A22] border border-zinc-850 rounded-lg p-1.5 text-xs text-white outline-none font-mono"
                />
              </div>
              <div className="flex gap-1.5 mt-1">
                <button
                  type="button"
                  onClick={handleCreateCustomBlock}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-[9.5px] py-1.5 rounded-lg"
                >
                  {isRtl ? 'ثبت بلوک' : 'Add Block'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsCustomCreatorOpen(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-extrabold text-[9.5px] py-1.5 px-2 rounded-lg"
                >
                  {isRtl ? 'لغو' : 'Cancel'}
                </button>
              </div>
            </div>
          )}
          
          <div className="flex flex-col gap-1.5 max-h-[35vh] overflow-y-auto pr-1 custom-scrollbar">
            {BLOCK_TEMPLATES.map((tpl) => (
              <button
                key={tpl.type}
                type="button"
                onClick={() => handleAddBlock(tpl)}
                className="flex items-center justify-between w-full text-right bg-[#131317] hover:bg-[#1C1C22] border border-zinc-800/80 hover:border-zinc-700 text-zinc-300 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer select-none group"
              >
                <div className="flex items-center gap-2">
                  {tpl.type === 'image' ? (
                    <ImageIcon size={12} className="text-amber-500" />
                  ) : tpl.type === 'signatures' ? (
                    <Check size={12} className="text-emerald-500" />
                  ) : (
                    <FileText size={12} className="text-sky-500" />
                  )}
                  <span>{tpl.title}</span>
                </div>
                <Plus size={11} className="text-zinc-600 group-hover:text-amber-500 transition-colors" />
              </button>
            ))}
          </div>
          </div>
        </div>

        {/* Selected Step quick switcher */}
        <div className="border-t border-zinc-800/60 pt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-[9px] text-zinc-500 font-extrabold uppercase block">{isRtl ? 'وضعیت نگارش بوم:' : 'Canvas Drafting Mode:'}</label>
            {isAnyColumnDbLinked ? (
              <span className="text-[8.5px] font-bold text-red-400 flex items-center gap-1">
                <Lock size={10} />
                {isRtl ? 'قفل دیتابیس (SSOT)' : 'DB Locked (SSOT)'}
              </span>
            ) : (
              steps.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDraftingNewStep(!isDraftingNewStep);
                    if (!isDraftingNewStep) {
                      setLocalDraftStep({});
                    }
                  }}
                  className={`text-[8.5px] font-black px-2 py-0.5 rounded transition-all cursor-pointer ${
                    isDraftingNewStep 
                      ? 'bg-amber-500/20 border border-amber-500/30 text-amber-500 font-bold' 
                      : 'bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {isDraftingNewStep ? (isRtl ? 'حالت ثبت عملیات جدید' : 'Drafting New') : (isRtl ? 'سویچ به ثبت جدید' : 'Draft New Step')}
                </button>
              )
            )}
          </div>

          {!isDraftingNewStep && steps.length > 0 ? (
            <select
              value={selectedStepId || ''}
              onChange={(e) => onSelectStep(e.target.value)}
              className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1.5 px-2 text-xs text-white outline-none focus:border-amber-500/40 font-bold cursor-pointer"
            >
              {steps.map((s, idx) => (
                <option key={s.id} value={s.id}>
                  {idx + 1}. {(s.station || (isRtl ? 'ایستگاه' : 'Station'))} - {(s.operation || '').slice(0, 25)}
                </option>
              ))}
            </select>
          ) : (
            <div className="bg-amber-500/5 border border-dashed border-amber-500/20 rounded-xl p-2.5 text-[9.5px] font-semibold text-amber-400/90 leading-relaxed">
              📝 {isRtl 
                ? 'در حال نگارش گام عملیاتی جدید. فیلدهای بوم را پر کنید و دکمه تایید گام را در زیر کلیک کنید.' 
                : 'Drafting mode: Fill in block inputs on the canvas, then confirm to add to your grid.'}
            </div>
          )}
        </div>

        {/* Dynamic Accordions for Station & Operation Select Helper */}
        <div className="border-t border-zinc-800/60 pt-3 flex flex-col gap-2">
          {/* Station Accordion */}
          <div>
            <button
              type="button"
              onClick={() => setIsStationListOpen(!isStationListOpen)}
              className="flex items-center justify-between w-full text-right bg-[#131317] hover:bg-[#1C1C22] p-2 rounded-lg text-xs font-bold text-zinc-400"
            >
              <span>{isRtl ? '📋 ایستگاه‌های کاری وارد شده' : '📋 Active Stations'}</span>
              <span>{isStationListOpen ? '▼' : '▲'}</span>
            </button>
            {isStationListOpen && (
              <div className="bg-[#0D0D11] border border-zinc-850 rounded-lg p-2 mt-1 max-h-28 overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                {uniqueStationsList.map((st, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyQuickValue('station', st)}
                    className="w-full text-right text-[11px] text-zinc-400 hover:text-white px-1.5 py-1 rounded hover:bg-zinc-850/60 transition-colors"
                  >
                    {st}
                  </button>
                ))}
                {uniqueStationsList.length === 0 && (
                  <span className="text-[10px] text-zinc-600 text-center py-1">{isRtl ? 'خالی' : 'Empty'}</span>
                )}
              </div>
            )}
          </div>

          {/* Operation Accordion */}
          <div>
            <button
              type="button"
              onClick={() => setIsOperationListOpen(!isOperationListOpen)}
              className="flex items-center justify-between w-full text-right bg-[#131317] hover:bg-[#1C1C22] p-2 rounded-lg text-xs font-bold text-zinc-400"
            >
              <span>{isRtl ? '⚡ عملیات‌های جاری ثبت‌شده' : '⚡ Current Operations'}</span>
              <span>{isOperationListOpen ? '▼' : '▲'}</span>
            </button>
            {isOperationListOpen && (
              <div className="bg-[#0D0D11] border border-zinc-850 rounded-lg p-2 mt-1 max-h-28 overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                {uniqueOperationsList.map((op, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyQuickValue('operation', op)}
                    className="w-full text-right text-[11px] text-zinc-400 hover:text-white px-1.5 py-1 rounded hover:bg-zinc-850/60 transition-colors"
                  >
                    {op}
                  </button>
                ))}
                {uniqueOperationsList.length === 0 && (
                  <span className="text-[10px] text-zinc-600 text-center py-1">{isRtl ? 'خالی' : 'Empty'}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Confirm New Step drafting controls for Canvas-First design */}
        {isDraftingNewStep && (
          <div className="border-t border-zinc-800/60 pt-3 mt-1 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleConfirmAndAddStep}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs py-2.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-1.5 cursor-pointer animate-pulse"
            >
              <Check size={14} strokeWidth={3} />
              <span>{isRtl ? 'تایید و ثبت گام به جدول' : 'Confirm & Add Step to Grid'}</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Center Panel - Figma-Style Interactive Canvas */}
      <div className="flex-1 flex flex-col gap-3 bg-[#050507] border border-[#18181D] rounded-3xl p-6 min-h-[75vh] relative overflow-x-auto shadow-inner">
        {/* Canvas Header metadata info */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4 w-full">
          <div className="flex items-center gap-2">
            <LayoutGrid size={15} className="text-amber-500" />
            <span className="text-[11px] font-black tracking-wide text-zinc-400 uppercase">{isRtl ? 'بوم پیش‌نمایش و چیدمان کار استاندارد شده (JES)' : 'JES Work Instruction Sheet Canvas'}</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500 bg-zinc-900/60 px-3 py-1 rounded border border-zinc-800/40">
            <span>TAKT TIME: 90s</span>
            <span>|</span>
            <span>CYCLE TIME: {steps.reduce((acc, curr) => acc + (curr.stdTime || 0), 0)}s</span>
          </div>
        </div>

        {isAnyColumnDbLinked && (
          <div className="bg-amber-500/10 border border-dashed border-amber-500/20 text-amber-500 rounded-2xl p-3.5 text-xs font-bold leading-relaxed flex items-center gap-3 shadow-md mb-2">
            <Database size={15} className="shrink-0 text-amber-500 animate-pulse" />
            <div>
              <p className="font-black text-amber-400 mb-0.5">
                {isRtl ? 'حالت پیوند داده فعال (قفل افزودن گام)' : 'Active Data-Link Mode (Adding Steps Locked)'}
              </p>
              <p className="text-zinc-400 text-[9.5px] font-semibold leading-normal">
                {isRtl 
                  ? 'ستون‌های بوم به دیتابیس کیفیت متصل هستند. ویرایش برای ستون‌های متصل غیرفعال بوده و سطر جدید فقط از طریق دیتابیس قابل اضافه شدن است.'
                  : 'Canvas columns are linked to the database. Manual editing is restricted to unlinked fields, and adding/deleting steps is locked.'}
              </p>
            </div>
          </div>
        )}

        {/* The Standard Sheet Canvas */}
        <div 
          className="relative bg-[#0E0E12] border border-zinc-800/60 rounded-3xl p-6 w-full max-w-2xl mx-auto flex flex-col gap-3.5 shadow-2xl"
          style={{ minHeight: '850px' }}
        >
          {blocks.filter(b => b.visible).length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center my-auto p-8 bg-[#121216]/50 border border-dashed border-zinc-800 rounded-2xl min-h-[300px]">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4 animate-pulse">
                <Layers size={20} />
              </div>
              <h4 className="text-xs font-black text-zinc-300 mb-1.5">
                {isRtl ? 'بوم فاقد هرگونه بلوک طراحی است' : 'No Design Blocks on Canvas'}
              </h4>
              <p className="text-[10.5px] text-zinc-500 max-w-sm leading-relaxed mb-4">
                {isRtl 
                  ? 'لطفاً دکمه «قالب پیش‌فرض SOS» را کلیک کنید یا از کتابخانه سمت چپ، بلوک‌های دلخواه خود را یکی‌یکی به بوم اضافه نمایید تا فوراً روی بوم نمایش داده شوند.'
                  : 'Please click the "SOS Preset" button or add desired blocks one by one from the left Block Library to display them instantly.'}
              </p>
            </div>
          ) : (
            blocks.filter(b => b.visible).map((block) => {
              const isBlockSelected = selectedBlockId === block.id;
              const link = block.columnMapping ? columnDbLinks?.[block.columnMapping] : null;
              const isDbConnected = !!(link && link.dbTable && link.dbColumn);
              
              // Resolve database-driven value (Single Source of Truth!)
              let resolvedValue: any = '';
              if ((activeStep || isDraftingNewStep) && block.columnMapping && block.columnMapping !== 'doc_info' && block.columnMapping !== 'signatures' && block.columnMapping !== 'custom') {
                resolvedValue = getResolvedCellValue(block.columnMapping);
              } else if (block.columnMapping === 'custom') {
                resolvedValue = block.customText;
              }

              return (
                <div
                  key={block.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBlockId(block.id);
                  }}
                  className={`relative group rounded-xl border p-4 transition-all ${
                    isBlockSelected 
                      ? 'ring-2 ring-amber-500 border-transparent shadow-lg' 
                      : 'border-zinc-800 hover:border-zinc-700'
                  }`}
                  style={{
                    backgroundColor: block.bgColor,
                    color: block.textColor,
                    fontSize: `${block.fontSize}px`,
                    padding: `${block.padding}px`,
                    borderWidth: `${block.borderThickness}px`,
                    borderColor: block.borderColor,
                  }}
                >
                  {/* Block header title */}
                  <div className="text-[10px] uppercase font-extrabold tracking-wider text-slate-500 mb-1.5 border-b border-slate-500/10 pb-1 flex items-center justify-between select-none">
                    <span className="flex items-center gap-1">
                      {block.title}
                      {isDbConnected && <Database size={10} className="text-amber-500 animate-pulse" title={isRtl ? 'متصل به پایگاه داده' : 'Database connected'} />}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {block.locked && <Lock size={9} className="text-amber-500" />}
                      <span className="text-[8px] bg-zinc-800 text-zinc-400 px-1 py-0.5 rounded font-mono font-bold">GRID</span>
                    </div>
                  </div>

                  {/* Badges row for Special Characteristics on Operation block */}
                  {block.columnMapping === 'operation' && activeStep?.symbols && activeStep.symbols.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {activeStep.symbols.map((sym: string) => (
                        <span key={sym} className="text-[9.5px] font-black px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-amber-500 flex items-center gap-1 select-none">
                          <span>{sym === 'Safety' ? '⚠️' : sym === 'CC' ? '💎' : sym === 'SC' ? '⚙️' : sym === 'Inspection' ? '🔍' : sym === 'PPE' ? '🛡️' : '★'}</span>
                          <span>{sym === 'Safety' ? (isRtl ? 'ایمنی' : 'Safety') : sym}</span>
                        </span>
                      ))}
                    </div>
                  )}

                {/* Block content / fields based on block.type */}
                {block.type === 'doc_info' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-[11px] text-zinc-400 font-bold" dir="rtl">
                    <div>
                      <span className="text-zinc-600 block text-[9.5px] mb-0.5">کد سند:</span>
                      <span className="font-mono text-amber-500">QMS-WI-8.5.1.2-04</span>
                    </div>
                    <div>
                      <span className="text-zinc-600 block text-[9.5px] mb-0.5">تاریخ صدور:</span>
                      <span>1405/03/01</span>
                    </div>
                    <div>
                      <span className="text-zinc-600 block text-[9.5px] mb-0.5">شماره بازنگری:</span>
                      <span className="font-mono">03</span>
                    </div>
                    <div>
                      <span className="text-zinc-600 block text-[9.5px] mb-0.5">وضعیت سند:</span>
                      <span className="text-emerald-500">معتبر / جاری</span>
                    </div>
                  </div>
                )}

                {block.type === 'image' && activeStep && (
                  <div 
                    className="relative w-full rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800/80 group/img"
                    style={{ height: `${block.imageHeight || 176}px` }}
                  >
                    <img 
                      src={activeStep.imageUrl} 
                      alt="Operation visual" 
                      className="w-full h-full rounded-lg"
                      style={{ objectFit: block.objectFit || 'cover' }}
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Visual annotations representation */}
                    {activeStep.annotations?.map((ann) => (
                      <div 
                        key={ann.id} 
                        className="absolute flex items-center justify-center p-1 font-extrabold text-[8px] rounded"
                        style={{
                          left: `${ann.x}%`,
                          top: `${ann.y}%`,
                          transform: 'translate(-50%, -50%)',
                          backgroundColor: `${ann.color}40`,
                          borderColor: ann.color,
                          borderWidth: '1px',
                          color: '#FFFFFF'
                        }}
                      >
                        {ann.text}
                      </div>
                    ))}

                    {(() => {
                      const isImageDbConnected = !!(columnDbLinks?.imageUrl?.dbTable && columnDbLinks?.imageUrl?.dbColumn);
                      return isImageDbConnected ? (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                          <Lock size={15} className="text-amber-500" />
                          <span className="text-[10px] text-zinc-300 font-bold">
                            {isRtl ? 'تصویر با دیتابیس کیفیت همگام است.' : 'Image synced from DB (Read-only)'}
                          </span>
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button 
                            type="button" 
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenImageEditor();
                            }}
                            className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10.5px] px-3 py-1.5 rounded-lg select-none cursor-pointer transition-all"
                          >
                            {isRtl ? 'نشانه‌گذاری و ویرایش تصویر' : 'Annotate & Edit Photograph'}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {block.type === 'signatures' && (
                  <div className="grid grid-cols-3 gap-2 text-[10px] text-zinc-400 text-center select-none" dir="rtl">
                    <div className="border border-zinc-800/40 p-1.5 rounded bg-zinc-950/20">
                      <span className="text-zinc-600 block mb-1">تدوین کننده:</span>
                      <span className="font-bold text-zinc-300">مهندسی فرآیند</span>
                    </div>
                    <div className="border border-zinc-800/40 p-1.5 rounded bg-zinc-950/20">
                      <span className="text-zinc-600 block mb-1">تایید کننده:</span>
                      <span className="font-bold text-zinc-300">تضمین کیفیت / QA</span>
                    </div>
                    <div className="border border-zinc-800/40 p-1.5 rounded bg-zinc-950/20">
                      <span className="text-zinc-600 block mb-1">تصویب کننده:</span>
                      <span className="font-bold text-zinc-300">مدیریت کارگاه ساخت</span>
                    </div>
                  </div>
                )}

                {block.type === 'std_time' && activeStep && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-center text-[9px] font-bold mt-1.5" dir="rtl">
                    <div className="bg-emerald-500/10 p-1.5 rounded border border-emerald-500/30">
                      <span className="text-emerald-400 block text-[7.5px] mb-0.5">زمان استاندارد:</span>
                      <span className="text-emerald-300 font-mono text-[11px]">{activeStep.stdTime || 0}s</span>
                    </div>
                    <div className="bg-[#161619] p-1.5 rounded border border-zinc-800">
                      <span className="text-zinc-500 block text-[7.5px] mb-0.5">تکت تایم (Takt):</span>
                      <span className="text-zinc-300 font-mono text-[11px]">{activeStep.taktTime || 0}s</span>
                    </div>
                    <div className="bg-[#161619] p-1.5 rounded border border-zinc-800">
                      <span className="text-zinc-500 block text-[7.5px] mb-0.5">زمان سیکل (Cycle):</span>
                      <span className="text-zinc-300 font-mono text-[11px]">{activeStep.cycleTime || 0}s</span>
                    </div>
                    <div className="bg-[#161619] p-1.5 rounded border border-zinc-800">
                      <span className="text-zinc-500 block text-[7.5px] mb-0.5">زمان دستی:</span>
                      <span className="text-zinc-300 font-mono text-[11px]">{activeStep.manualTime || 0}s</span>
                    </div>
                    <div className="bg-[#161619] p-1.5 rounded border border-zinc-800">
                      <span className="text-zinc-500 block text-[7.5px] mb-0.5">خودکار ماشین:</span>
                      <span className="text-zinc-300 font-mono text-[11px]">{activeStep.machineTime || 0}s</span>
                    </div>
                    <div className="bg-[#161619] p-1.5 rounded border border-zinc-800">
                      <span className="text-zinc-500 block text-[7.5px] mb-0.5">بارگذاری/تخلیه:</span>
                      <span className="text-zinc-300 font-mono text-[11px]">{activeStep.loadUnloadTime || 0}s</span>
                    </div>
                    <div className="bg-[#161619] p-1.5 rounded border border-zinc-800">
                      <span className="text-zinc-500 block text-[7.5px] mb-0.5">زمان انتظار:</span>
                      <span className="text-zinc-300 font-mono text-[11px]">{activeStep.waitingTime || 0}s</span>
                    </div>
                    <div className="bg-[#161619] p-1.5 rounded border border-zinc-800">
                      <span className="text-zinc-500 block text-[7.5px] mb-0.5">تنظیم/تعویض:</span>
                      <span className="text-zinc-300 font-mono text-[11px]">{activeStep.setupTime || 0}s</span>
                    </div>
                  </div>
                )}

                {/* Database dynamic bound text area (Direct inline writing back to Single Source of Truth!) */}
                {block.type !== 'doc_info' && block.type !== 'image' && block.type !== 'signatures' && block.type !== 'std_time' && (
                  <div className="w-full">
                    {block.columnMapping ? (
                      <textarea
                        value={resolvedValue || ''}
                        disabled={block.locked || isDbConnected}
                        onChange={(e) => handleStepValueChange(block.columnMapping as keyof SWIStep, e.target.value)}
                        placeholder={
                          isDbConnected 
                            ? (isRtl ? 'این فیلد از دیتابیس همگام می‌شود.' : 'Synced from database (Read-only).')
                            : (isRtl ? `درج اطلاعات ${block.title}...` : `Enter ${block.title} details...`)
                        }
                        className={`w-full bg-transparent border border-transparent hover:border-zinc-800 focus:border-amber-500/50 rounded p-1 text-xs text-zinc-200 outline-none resize-none ${
                          isDbConnected ? 'opacity-70 cursor-not-allowed italic text-zinc-400' : ''
                        }`}
                        rows={2}
                      />
                    ) : (
                      <div className="text-xs text-zinc-300">
                        {resolvedValue !== undefined ? `${resolvedValue}` : ''}
                      </div>
                    )}
                  </div>
                )}

                {/* Move / Coordinate adjustment helper layout overlays */}
                {isBlockSelected && !block.locked && (
                  <div className="absolute -top-3.5 left-2 bg-amber-500 text-black text-[9px] px-2 py-0.5 rounded font-black flex items-center gap-1.5 select-none shadow-md">
                    <span>{isRtl ? 'لایه فعال' : 'ACTIVE BLOCK'}</span>
                    <span>|</span>
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateBlock(block.id, { y: Math.max(0, block.y - 40) });
                      }}
                      className="hover:scale-125 cursor-pointer font-bold"
                    >
                      ▲
                    </button>
                    <button 
                      type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateBlock(block.id, { y: block.y + 40 });
                      }}
                      className="hover:scale-125 cursor-pointer font-bold"
                    >
                      ▼
                    </button>
                  </div>
                )}
              </div>
            );
          }))}
        </div>
      </div>

      {/* 3. Right Panel - Properties & Saved Templates Column */}
      <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0">
        
        {/* Properties Panel Box */}
        <div className="bg-[#09090D] border border-[#1E1E23] rounded-2xl p-4 shadow-lg flex flex-col justify-between min-h-[500px]">
        
        {selectedBlock ? (
          <div className="flex flex-col gap-5">
            <h3 className="text-xs font-black text-amber-500 pb-2 border-b border-zinc-800 flex items-center gap-2 uppercase tracking-wider select-none">
              <Settings size={13} />
              <span>{isRtl ? 'تنظیمات و ویژگی‌های بلوک' : 'Block Settings'}</span>
            </h3>

            {/* Title config */}
            <div>
              <label className="text-[10px] text-zinc-500 font-extrabold block mb-1 uppercase">{isRtl ? 'عنوان بلوک:' : 'Block Title:'}</label>
              <input
                type="text"
                value={selectedBlock.title}
                onChange={(e) => handleUpdateBlock(selectedBlock.id, { title: e.target.value })}
                className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1.5 px-3 text-xs text-white outline-none focus:border-amber-500/40"
              />
            </div>

            {/* Column map config (SSOT) */}
            <div>
              <label className="text-[10px] text-zinc-500 font-extrabold block mb-1 uppercase">{isRtl ? 'اتصال به ستون دیتابیس (SSOT):' : 'Database Field Bind (SSOT):'}</label>
              <select
                value={selectedBlock.columnMapping || ''}
                onChange={(e) => handleUpdateBlock(selectedBlock.id, { columnMapping: e.target.value as any })}
                className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1.5 px-2.5 text-xs text-white outline-none focus:border-amber-500/40 font-bold"
              >
                <option value="custom">{isRtl ? 'متن آزاد مستقل' : 'Custom Independent Text'}</option>
                <option value="station">{isRtl ? 'ایستگاه کاری (station)' : 'Work Station (station)'}</option>
                <option value="partNo">{isRtl ? 'محصول/شماره فنی (partNo)' : 'Part Number (partNo)'}</option>
                <option value="operation">{isRtl ? 'نام عملیات (operation)' : 'Operation (operation)'}</option>
                <option value="jobElements">{isRtl ? 'جزئیات کار (jobElements)' : 'Job Elements (jobElements)'}</option>
                <option value="keyPoints">{isRtl ? 'نکات کلیدی (keyPoints)' : 'Key Points (keyPoints)'}</option>
                <option value="reasonWhy">{isRtl ? 'دلیل ایمنی (reasonWhy)' : 'Reason Why (reasonWhy)'}</option>
                <option value="equipment">{isRtl ? 'ابزار و تجهیزات (equipment)' : 'Equipment (equipment)'}</option>
                <option value="safety">{isRtl ? 'تجهیزات حفاظتی (safety)' : 'PPE / Safety (safety)'}</option>
                <option value="stdTime">{isRtl ? 'زمان استاندارد (stdTime)' : 'Standard Time (stdTime)'}</option>
                <option value="imageUrl">{isRtl ? 'تصویر مرحله (imageUrl)' : 'Image URL (imageUrl)'}</option>
              </select>
            </div>

            {/* Image block configurations */}
            {selectedBlock.type === 'image' && (
              <div className="border-t border-zinc-800/40 pt-4 flex flex-col gap-3">
                <span className="text-[10px] text-zinc-400 font-extrabold uppercase">{isRtl ? 'ابعاد و چیدمان تصویر:' : 'Image Height & Fit:'}</span>
                <div>
                  <label className="text-[9px] text-zinc-500 font-extrabold block mb-1">{isRtl ? 'ارتفاع تصویر (px):' : 'Image Height (px):'}</label>
                  <input
                    type="range"
                    min="100"
                    max="500"
                    step="10"
                    value={selectedBlock.imageHeight || 176}
                    onChange={(e) => handleUpdateBlock(selectedBlock.id, { imageHeight: parseInt(e.target.value, 10) })}
                    className="w-full accent-amber-500 h-1 bg-zinc-800 rounded-lg appearance-none"
                  />
                  <div className="text-[9.5px] text-zinc-400 font-mono mt-1 text-left">{selectedBlock.imageHeight || 176}px</div>
                </div>

                <div>
                  <label className="text-[9px] text-zinc-500 font-extrabold block mb-1">{isRtl ? 'حالت قرارگیری (Fit):' : 'Object Fit:'}</label>
                  <select
                    value={selectedBlock.objectFit || 'cover'}
                    onChange={(e) => handleUpdateBlock(selectedBlock.id, { objectFit: e.target.value as any })}
                    className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white outline-none"
                  >
                    <option value="cover">Cover (پر کردن مناسب)</option>
                    <option value="contain">Contain (کل تصویر بدون برش)</option>
                    <option value="fill">Fill (کشیدن کامل)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Standard time breakdown settings */}
            {selectedBlock.type === 'std_time' && activeStep && (
              <div className="border-t border-zinc-800/40 pt-4 flex flex-col gap-3">
                <span className="text-[10px] text-zinc-400 font-extrabold uppercase">{isRtl ? 'زمان‌های عملیات:' : 'Operation Times:'}</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] text-zinc-500 font-extrabold block mb-0.5">{isRtl ? 'زمان استاندارد:' : 'Standard Time:'}</label>
                    <input
                      type="number"
                      min="0"
                      value={activeStep.stdTime || 0}
                      onChange={(e) => handleStepValueChange('stdTime', parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 font-extrabold block mb-0.5">{isRtl ? 'تکت تایم (Takt):' : 'Takt Time:'}</label>
                    <input
                      type="number"
                      min="0"
                      value={activeStep.taktTime || 0}
                      onChange={(e) => handleStepValueChange('taktTime', parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 font-extrabold block mb-0.5">{isRtl ? 'زمان سیکل:' : 'Cycle Time:'}</label>
                    <input
                      type="number"
                      min="0"
                      value={activeStep.cycleTime || 0}
                      onChange={(e) => handleStepValueChange('cycleTime', parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 font-extrabold block mb-0.5">{isRtl ? 'زمان دستی:' : 'Manual Time:'}</label>
                    <input
                      type="number"
                      min="0"
                      value={activeStep.manualTime || 0}
                      onChange={(e) => handleStepValueChange('manualTime', parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 font-extrabold block mb-0.5">{isRtl ? 'زمان خودکار ماشین:' : 'Machine Time:'}</label>
                    <input
                      type="number"
                      min="0"
                      value={activeStep.machineTime || 0}
                      onChange={(e) => handleStepValueChange('machineTime', parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 font-extrabold block mb-0.5">{isRtl ? 'بارگذاری/تخلیه:' : 'Load/Unload:'}</label>
                    <input
                      type="number"
                      min="0"
                      value={activeStep.loadUnloadTime || 0}
                      onChange={(e) => handleStepValueChange('loadUnloadTime', parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 font-extrabold block mb-0.5">{isRtl ? 'زمان انتظار:' : 'Waiting Time:'}</label>
                    <input
                      type="number"
                      min="0"
                      value={activeStep.waitingTime || 0}
                      onChange={(e) => handleStepValueChange('waitingTime', parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-zinc-500 font-extrabold block mb-0.5">{isRtl ? 'تنظیم یا تعویض:' : 'Setup Time:'}</label>
                    <input
                      type="number"
                      min="0"
                      value={activeStep.setupTime || 0}
                      onChange={(e) => handleStepValueChange('setupTime', parseInt(e.target.value, 10) || 0)}
                      className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white"
                    />
                  </div>
                </div>
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-lg text-center text-xs font-bold text-emerald-400">
                  {isRtl ? `زمان کل استاندارد: ${activeStep.stdTime || 0} ثانیه` : `Standard Time: ${activeStep.stdTime || 0}s`}
                </div>
              </div>
            )}

            {/* Special Quality/Safety Emblem toggles */}
            {activeStep && (
              <div className="border-t border-zinc-800/40 pt-4 flex flex-col gap-2">
                <span className="text-[10px] text-zinc-400 font-extrabold uppercase">{isRtl ? 'نشان‌های کیفیت و ایمنی گام:' : 'Step Quality/Safety Symbols:'}</span>
                <div className="flex flex-wrap gap-1">
                  {[
                    { key: 'Safety', char: '⚠️', label: isRtl ? 'ایمنی' : 'Safety' },
                    { key: 'CC', char: '💎', label: isRtl ? 'بحرانی CC' : 'CC' },
                    { key: 'SC', char: '⚙️', label: isRtl ? 'کلیدی SC' : 'SC' },
                    { key: 'Inspection', char: '🔍', label: isRtl ? 'بازرسی' : 'Inspect' },
                    { key: 'PPE', char: '🛡️', label: isRtl ? 'حفاظتی' : 'PPE' }
                  ].map(sym => {
                    const activeSymbols = activeStep.symbols || [];
                    const isToggled = activeSymbols.includes(sym.key);
                    return (
                      <button
                        key={sym.key}
                        type="button"
                        onClick={() => {
                          const nextSymbols = isToggled
                            ? activeSymbols.filter(s => s !== sym.key)
                            : [...activeSymbols, sym.key];
                          handleStepValueChange('symbols', nextSymbols);
                        }}
                        className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg border transition-all cursor-pointer ${
                          isToggled 
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
                            : 'bg-[#121216] border-zinc-800 text-zinc-400 hover:text-zinc-300'
                        }`}
                      >
                        <span>{sym.char}</span>
                        <span>{sym.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Preset Color Themes */}
            <div>
              <label className="text-[10px] text-zinc-500 font-extrabold block mb-2 uppercase">{isRtl ? 'قالب رنگی سریع:' : 'Quick Color Themes:'}</label>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleUpdateBlock(selectedBlock.id, { bgColor: preset.bg, textColor: preset.text })}
                    className="w-6 h-6 rounded-full border border-zinc-800 relative transition-transform hover:scale-110 cursor-pointer"
                    style={{ backgroundColor: preset.bg }}
                    title={preset.name}
                  >
                    {selectedBlock.bgColor === preset.bg && (
                      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-amber-500">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Sizing adjustments (Padding, Font size, Borders) */}
            <div className="grid grid-cols-2 gap-3 border-t border-zinc-800/40 pt-4 mt-1">
              <div>
                <label className="text-[9px] text-zinc-500 font-extrabold block mb-1 uppercase">{isRtl ? 'اندازه فونت (px):' : 'Font Size:'}</label>
                <input
                  type="number"
                  min="9"
                  max="24"
                  value={selectedBlock.fontSize}
                  onChange={(e) => handleUpdateBlock(selectedBlock.id, { fontSize: parseInt(e.target.value, 10) || 12 })}
                  className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1 px-2.5 text-xs text-white outline-none"
                />
              </div>

              <div>
                <label className="text-[9px] text-zinc-500 font-extrabold block mb-1 uppercase">{isRtl ? 'فاصله‌گذاری داخلی:' : 'Padding (px):'}</label>
                <input
                  type="number"
                  min="2"
                  max="30"
                  value={selectedBlock.padding}
                  onChange={(e) => handleUpdateBlock(selectedBlock.id, { padding: parseInt(e.target.value, 10) || 10 })}
                  className="w-full bg-[#131317] border border-zinc-800 rounded-lg py-1 px-2.5 text-xs text-white outline-none"
                />
              </div>
            </div>

            {/* Lock/Visibility triggers */}
            <div className="flex items-center justify-between border-t border-zinc-800/40 pt-4 mt-1">
              <span className="text-[10px] text-zinc-400 font-bold">{isRtl ? 'قفل کردن محتوا:' : 'Lock Block Content:'}</span>
              <button
                type="button"
                onClick={() => handleUpdateBlock(selectedBlock.id, { locked: !selectedBlock.locked })}
                className="p-1 text-slate-400 hover:text-amber-500 rounded transition-colors cursor-pointer"
              >
                {selectedBlock.locked ? <Lock size={14} className="text-amber-500" /> : <Unlock size={14} />}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[10px] text-zinc-400 font-bold">{isRtl ? 'نمایش در نسخه چاپی:' : 'Print Visibility:'}</span>
              <button
                type="button"
                onClick={() => handleUpdateBlock(selectedBlock.id, { visible: !selectedBlock.visible })}
                className="p-1 text-slate-400 hover:text-amber-500 rounded transition-colors cursor-pointer"
              >
                {selectedBlock.visible ? <Eye size={14} className="text-emerald-500" /> : <EyeOff size={14} />}
              </button>
            </div>

            {/* Quick Actions (Delete / Duplicate) */}
            <div className="flex items-center gap-2 border-t border-zinc-800/40 pt-4 mt-2">
              <button
                type="button"
                onClick={(e) => handleDuplicateBlock(selectedBlock, e)}
                className="flex-1 flex items-center justify-center gap-1 bg-[#131317] hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 py-2 rounded-xl text-[10.5px] font-bold cursor-pointer"
              >
                <Copy size={12} />
                <span>{isRtl ? 'تکثیر بلوک' : 'Duplicate'}</span>
              </button>

              <button
                type="button"
                onClick={(e) => handleDeleteBlock(selectedBlock.id, e)}
                className="flex-1 flex items-center justify-center gap-1 bg-red-950/25 border border-red-900/40 text-red-400 hover:text-red-300 py-2 rounded-xl text-[10.5px] font-bold cursor-pointer"
              >
                <Trash2 size={12} />
                <span>{isRtl ? 'حذف بلوک' : 'Delete'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-zinc-500 text-xs font-bold leading-relaxed">
            {isRtl ? 'برای مشاهده ویژگی‌ها، روی یکی از بلوک‌های بوم کلیک کنید.' : 'Click on a block inside the canvas to edit its properties.'}
          </div>
        )}

        <div className="text-[8.5px] text-zinc-600 font-bold mt-12 pt-4 border-t border-zinc-800/20 text-center uppercase tracking-wider select-none">
          {isRtl ? 'بخش ویرایشگر ویژگی‌های بلوک های استاندارد شده' : 'SOS/JES Standard Formatter Panel'}
        </div>
      </div>

      {/* Saved Layout Templates Box */}
      <div className="bg-[#09090D] border border-[#1E1E23] rounded-2xl p-4 shadow-lg flex flex-col gap-3">
        <h3 className="text-xs font-black text-amber-500 pb-2 border-b border-zinc-800 flex items-center gap-2 uppercase tracking-wider select-none">
          <LayoutGrid size={13} />
          <span>{isRtl ? 'قالب‌های طراحی ذخیره شده' : 'Saved Design Templates'}</span>
        </h3>

        {/* Save new template input and button */}
        <div className="flex flex-col gap-2 bg-[#121216]/50 border border-zinc-800/65 rounded-xl p-3">
          <label className="text-[9.5px] text-zinc-400 font-extrabold uppercase">{isRtl ? 'ذخیره قالب فعلی:' : 'Save Current Layout:'}</label>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={templateSaveName}
              onChange={(e) => setTemplateSaveName(e.target.value)}
              placeholder={isRtl ? 'نام قالب (مثلاً خط مونتاژ)' : 'Template name (e.g. final_assembly)'}
              className="flex-1 bg-[#131317] border border-zinc-850 rounded-lg py-1 px-2.5 text-xs text-white outline-none focus:border-amber-500/40"
            />
            <button
              type="button"
              onClick={handleSaveCurrentLayout}
              className="bg-amber-500 hover:bg-amber-400 text-black px-3 py-1 rounded-lg text-xs font-black select-none transition-all cursor-pointer"
            >
              {isRtl ? 'ذخیره' : 'Save'}
            </button>
          </div>
        </div>

        {/* Vertical card layout list */}
        <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
          {savedTemplates.length === 0 ? (
            <div className="text-[10.5px] text-zinc-600 font-bold text-center py-4 bg-[#121215]/20 border border-dashed border-zinc-800 rounded-xl">
              {isRtl ? 'هیچ قالب طراحی ذخیره شده‌ای وجود ندارد' : 'No saved templates yet.'}
            </div>
          ) : (
            savedTemplates.map((tpl) => (
              <div 
                key={tpl.id}
                onClick={() => handleApplyTemplate(tpl)}
                className="flex flex-col gap-2 p-3 bg-[#121216]/90 hover:bg-[#18181E] border border-zinc-800 rounded-xl transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-zinc-200 group-hover:text-amber-400 transition-colors">{tpl.name}</span>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteTemplate(tpl.id, e)}
                    className="p-1 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                    title={isRtl ? 'حذف قالب' : 'Delete template'}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
                <div className="flex items-center justify-between text-[9px] text-zinc-500 font-mono">
                  <span>{tpl.blocks.length} {isRtl ? 'بلوک چیدمان' : 'Layout Blocks'}</span>
                  <span className="text-amber-500/80 font-bold group-hover:underline">{isRtl ? 'اعمال قالب ⚡' : 'Apply template ⚡'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Dynamic Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#121216] border border-amber-500/40 text-amber-400 px-4 py-3 rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.25)] font-bold text-xs" dir={isRtl ? 'rtl' : 'ltr'}>
          <span className="text-sm">✨</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Custom Confirmation Dialog Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0F0F12] border border-[#27272C] rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
              <span className="text-red-500">{confirmModal.title}</span>
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className="bg-red-500 hover:bg-red-650 text-white px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg"
              >
                {isRtl ? 'تأیید' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>

  );
}
