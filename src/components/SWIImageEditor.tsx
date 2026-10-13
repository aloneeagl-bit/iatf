/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  X, RotateCw, ZoomIn, ZoomOut, Trash2, Check, AlertTriangle, 
  Image as ImageIcon, Plus, Sparkles, HelpCircle, Eye, RefreshCw, Type, Info
} from 'lucide-react';
import { SWIStep, SWIAnnotation } from '../types/swi';

interface SWIImageEditorProps {
  step: SWIStep;
  onSave: (annotations: SWIAnnotation[], images: string[], activeImageIndex: number) => void;
  onClose: () => void;
  lang: 'fa' | 'en';
}

interface LibrarySymbol {
  id: string;
  label: string;
  symbol: string; // Emoji or visual character
  color: string;
  type: 'badge' | 'circle' | 'rect' | 'arrow';
}

export default function SWIImageEditor({ step, onSave, onClose, lang }: SWIImageEditorProps) {
  const isRtl = lang === 'fa';
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // in degrees
  const [activeImageIndex, setActiveImageIndex] = useState(step.activeImageIndex || 0);
  const [images, setImages] = useState<string[]>(step.images && step.images.length > 0 ? [...step.images] : [step.imageUrl]);
  const [annotations, setAnnotations] = useState<SWIAnnotation[]>(step.annotations ? [...step.annotations] : []);
  
  // Custom symbol library state
  const [symbolsLibrary, setSymbolsLibrary] = useState<LibrarySymbol[]>([
    { id: 'sym-ok', label: isRtl ? 'صحیح / OK' : 'Correct / OK', symbol: '✓', color: '#10B981', type: 'badge' },
    { id: 'sym-ng', label: isRtl ? 'خطا / NG' : 'Incorrect / NG', symbol: '✗', color: '#EF4444', type: 'badge' },
    { id: 'sym-safety', label: isRtl ? 'مورد ایمنی / Safety' : 'Safety Hazard', symbol: '⚠️', color: '#F59E0B', type: 'badge' },
    { id: 'sym-cc', label: isRtl ? 'مشخصه بحرانی (CC)' : 'Critical (CC)', symbol: '💎', color: '#0EA5E9', type: 'badge' },
    { id: 'sym-sc', label: isRtl ? 'مشخصه کلیدی (SC)' : 'Key Quality (SC)', symbol: '⚙️', color: '#8B5CF6', type: 'badge' },
    { id: 'sym-inspect', label: isRtl ? 'کنترل ابعادی / گیج' : 'Dimensional Inspect', symbol: '🔍', color: '#EC4899', type: 'badge' },
    { id: 'sym-ppe', label: isRtl ? 'الزام تجهیزات حفاظتی' : 'Required PPE', symbol: '🛡️', color: '#3B82F6', type: 'badge' },
    { id: 'sym-arrow', label: isRtl ? 'فلش راهنما / جهت' : 'Directional Arrow', symbol: '➔', color: '#F59E0B', type: 'arrow' },
    { id: 'sym-circle', label: isRtl ? 'دایره تمرکز / محدوده' : 'Focus Circle', symbol: '◯', color: '#EF4444', type: 'circle' },
    { id: 'sym-rect', label: isRtl ? 'کادر مستطیلی' : 'Bounding Box', symbol: '⬜', color: '#10B981', type: 'rect' },
    { id: 'sym-text', label: isRtl ? 'یادداشت متنی' : 'Text Callout', symbol: '✎', color: '#A855F7', type: 'badge' },
  ]);

  const [selectedSymbolId, setSelectedSymbolId] = useState<string>('sym-ok');
  const [annotationCustomText, setAnnotationCustomText] = useState('');
  const [newImgUrl, setNewImgUrl] = useState('');
  
  // Custom Symbol Creator state
  const [newSymLabel, setNewSymLabel] = useState('');
  const [newSymChar, setNewSymChar] = useState('🔩');
  const [newSymColor, setNewSymColor] = useState('#EF4444');
  const [newSymType, setNewSymType] = useState<'badge' | 'circle' | 'rect' | 'arrow'>('badge');
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);

  const imageContainerRef = useRef<HTMLDivElement>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
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

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // Quick Emoji preset selection list
  const EMOJI_PRESETS = ['🔩', '⚡', '🛠️', '🚨', '🛑', '📏', '🌡️', '💧', '⚖️', '🧪', '🔋', '📦', '⚙️', '💎', '⚠️', '🛡️', '🔍'];
  
  // Color presets for custom symbols
  const COLOR_PRESETS = [
    '#EF4444', // Red
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#3B82F6', // Blue
    '#0EA5E9', // Sky Cyan
    '#8B5CF6', // Purple/Violet
    '#EC4899', // Pink
    '#E11D48', // Crimson Rose
  ];

  const handleAddCustomSymbol = () => {
    if (!newSymLabel.trim()) return;
    
    const newSymbol: LibrarySymbol = {
      id: `custom-sym-${Date.now()}`,
      label: newSymLabel.trim(),
      symbol: newSymChar || '★',
      color: newSymColor,
      type: newSymType
    };

    setSymbolsLibrary([...symbolsLibrary, newSymbol]);
    setSelectedSymbolId(newSymbol.id);
    setNewSymLabel('');
    setIsCreatorOpen(false);
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedSymbolId || !imageContainerRef.current) return;
    
    const selectedSymbol = symbolsLibrary.find(s => s.id === selectedSymbolId);
    if (!selectedSymbol) return;

    const rect = imageContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    let finalLabel = '';
    
    // Construct rich text that displays beautifully in all views
    if (annotationCustomText.trim()) {
      finalLabel = `${selectedSymbol.symbol} ${selectedSymbol.label}: ${annotationCustomText.trim()}`;
    } else {
      finalLabel = `${selectedSymbol.symbol} ${selectedSymbol.label}`;
    }

    const newAnnotation: SWIAnnotation = {
      id: `ann-${Date.now()}`,
      type: selectedSymbol.type === 'circle' ? 'circle' : selectedSymbol.type === 'rect' ? 'rect' : selectedSymbol.type === 'arrow' ? 'arrow' : 'text',
      x,
      y,
      text: finalLabel,
      color: selectedSymbol.color,
      size: selectedSymbol.type === 'circle' ? 30 : 14
    };

    setAnnotations([...annotations, newAnnotation]);
    setAnnotationCustomText('');
  };

  const handleDeleteAnnotation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    showConfirm(
      isRtl ? '🗑️ حذف نشانه‌گذاری' : '🗑️ Delete Annotation',
      isRtl ? 'آیا از حذف این نشانه‌گذاری روی تصویر اطمینان دارید؟' : 'Are you sure you want to delete this annotation?',
      () => {
        setAnnotations(annotations.filter(ann => ann.id !== id));
      }
    );
  };

  const handleAddImageUrl = () => {
    if (newImgUrl.trim()) {
      setImages([...images, newImgUrl.trim()]);
      setActiveImageIndex(images.length); // Switch to the newly added image
      setNewImgUrl('');
    }
  };

  const handleDeleteImage = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (images.length <= 1) {
      alert(isRtl ? 'حداقل باید یک تصویر در دستورالعمل وجود داشته باشد.' : 'At least one image must remain.');
      return;
    }
    showConfirm(
      isRtl ? '🗑️ حذف تصویر' : '🗑️ Delete Image',
      isRtl ? 'آیا از حذف این تصویر اطمینان دارید؟ تمامی نشانه‌گذاری‌های متناظر آن نیز پاک خواهند شد.' : 'Are you sure you want to delete this image? All annotations on this image will also be removed.',
      () => {
        const filtered = images.filter((_, idx) => idx !== index);
        setImages(filtered);
        setActiveImageIndex(Math.max(0, index - 1));
      }
    );
  };

  const handleSave = () => {
    onSave(annotations, images, activeImageIndex);
  };

  const activeSymbol = symbolsLibrary.find(s => s.id === selectedSymbolId);

  return (
    <div id="image_editor_root" className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-[#09090C] border border-zinc-800/80 rounded-[28px] w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60 bg-[#0C0C10]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl">
              <ImageIcon size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white">{isRtl ? 'میز کار ویرایش و نشانه‌گذاری هوشمند تصاویر (JES)' : 'JES Smart Annotation Studio'}</h2>
              <p className="text-[10px] text-zinc-500 font-bold mt-0.5">{step.station} — {step.operation}</p>
            </div>
          </div>
          
          <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white cursor-pointer transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Editor Body */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Left Canvas Panel - Clean & Lightweight Workspace */}
          <div className="flex-1 bg-[#050507] p-6 flex flex-col justify-center items-center relative overflow-auto border-b lg:border-b-0 lg:border-l border-zinc-800/40">
            {/* Grid background for technical canvas vibe */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

            {/* Image Canvas Container with annotations overlay */}
            <div 
              ref={imageContainerRef}
              onClick={handleImageClick}
              className="relative overflow-hidden border border-zinc-800 rounded-2xl select-none max-w-full max-h-[55vh] flex items-center justify-center shadow-inner transition-shadow bg-zinc-950"
              style={{
                width: '640px',
                height: '420px',
                transform: `rotate(${rotation}deg)`,
                transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
              }}
            >
              <img 
                src={images[activeImageIndex] || step.imageUrl} 
                alt="Workspace Step" 
                className="w-full h-full object-cover pointer-events-none rounded-2xl"
                referrerPolicy="no-referrer"
                style={{
                  transform: `scale(${zoom})`,
                  transition: 'transform 0.1s ease-out'
                }}
              />

              {/* Vector Annotations Overlays */}
              {annotations.map((ann) => {
                const style: React.CSSProperties = {
                  position: 'absolute',
                  left: `${ann.x}%`,
                  top: `${ann.y}%`,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'auto',
                };

                return (
                  <div key={ann.id} style={style} className="group z-10 select-none">
                    {/* Circle marker tool */}
                    {ann.type === 'circle' && (
                      <div className="relative">
                        <div 
                          className="rounded-full border-2 border-dashed animate-pulse"
                          style={{
                            width: '44px',
                            height: '44px',
                            borderColor: ann.color || '#38BDF8'
                          }}
                        />
                        {ann.text && (
                          <div 
                            className="absolute top-11 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[8.5px] font-black whitespace-nowrap shadow-md"
                            style={{
                              backgroundColor: `${ann.color}E6`,
                              borderColor: ann.color,
                              color: '#FFFFFF'
                            }}
                          >
                            <span>{ann.text}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Rect marker tool */}
                    {ann.type === 'rect' && (
                      <div className="relative">
                        <div 
                          className="border-2 border-double"
                          style={{
                            width: '50px',
                            height: '50px',
                            borderColor: ann.color || '#EF4444'
                          }}
                        />
                        {ann.text && (
                          <div 
                            className="absolute top-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[8.5px] font-black whitespace-nowrap shadow-md"
                            style={{
                              backgroundColor: `${ann.color}E6`,
                              borderColor: ann.color,
                              color: '#FFFFFF'
                            }}
                          >
                            <span>{ann.text}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Arrow callout */}
                    {ann.type === 'arrow' && (
                      <div className="flex flex-col items-center">
                        <div className="text-xl -rotate-45 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]" style={{ color: ann.color || '#F59E0B' }}>
                          ➔
                        </div>
                        {ann.text && (
                          <div 
                            className="mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[8.5px] font-black whitespace-nowrap shadow-md"
                            style={{
                              backgroundColor: `${ann.color}E6`,
                              borderColor: ann.color,
                              color: '#FFFFFF'
                            }}
                          >
                            <span>{ann.text}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Badge Glass Callout (Clean & Premium Label) */}
                    {ann.type !== 'circle' && ann.type !== 'rect' && ann.type !== 'arrow' && (
                      <div 
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-xl border whitespace-nowrap text-[9.5px] font-black transition-all group-hover:scale-105"
                        style={{
                          backgroundColor: `${ann.color}25`,
                          borderColor: ann.color,
                          borderWidth: '1.5px',
                          color: '#FFFFFF',
                          boxShadow: `0 4px 14px ${ann.color}20`,
                          backdropFilter: 'blur(4px)'
                        }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full animate-ping shrink-0" style={{ backgroundColor: ann.color }} />
                        <span>{ann.text}</span>
                      </div>
                    )}

                    {/* Quick Delete overlay trigger */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteAnnotation(ann.id, e)}
                      className="absolute -top-3 -right-3 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 cursor-pointer shadow-lg hover:scale-110"
                      title={isRtl ? 'حذف این نشانه‌گذاری' : 'Delete'}
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Quick Interactive Zoom and Canvas controls */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-zinc-900/80 border border-zinc-800/80 rounded-xl p-1.5 shadow-lg select-none">
              <button 
                onClick={() => setZoom(prev => Math.max(1, prev - 0.2))} 
                className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                title={isRtl ? 'کوچکنمایی' : 'Zoom Out'}
              >
                <ZoomOut size={13} />
              </button>
              <span className="text-[10px] font-mono font-bold text-zinc-400 px-1">{Math.round(zoom * 100)}%</span>
              <button 
                onClick={() => setZoom(prev => Math.min(3, prev + 0.2))} 
                className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                title={isRtl ? 'بزرگنمایی' : 'Zoom In'}
              >
                <ZoomIn size={13} />
              </button>
              <div className="w-[1px] h-3 bg-zinc-800 mx-1" />
              <button 
                onClick={() => setRotation(prev => (prev + 90) % 360)} 
                className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-white transition-colors"
                title={isRtl ? 'چرخش ۹۰ درجه' : 'Rotate 90°'}
              >
                <RotateCw size={12} />
              </button>
            </div>

            {/* Bottom Help/Hint Line */}
            <div className="absolute bottom-4 left-4 right-4 bg-zinc-900/60 border border-zinc-800/40 text-zinc-400 text-[10px] py-1.5 px-3 rounded-xl flex items-center gap-2 select-none">
              <HelpCircle size={12} className="text-amber-500 shrink-0" />
              <span>
                {activeSymbol ? (
                  isRtl 
                    ? `ابزار [ ${activeSymbol.symbol} — ${activeSymbol.label} ] فعال است. روی بخش مورد نظر در تصویر کلیک کنید.` 
                    : `Active: [ ${activeSymbol.symbol} — ${activeSymbol.label} ]. Click anywhere on the photograph to place.`
                ) : (
                  isRtl 
                    ? 'یک نشانه‌ را انتخاب کنید و جهت اشاره روی جزئیات گام، روی عکس کلیک کنید.' 
                    : 'Choose a symbol from the sidebar and click on the photograph to place it.'
                )}
              </span>
            </div>
          </div>

          {/* Right Sidebar - Tools, Presets and Custom Symbol Creation */}
          <div className="w-full lg:w-[360px] bg-[#09090C] p-5 flex flex-col justify-between gap-4 overflow-y-auto shrink-0 border-r border-zinc-800/20">
            
            <div className="flex flex-col gap-4">
              
              {/* Library list / Picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider">{isRtl ? 'کتابخانه نشانه‌های مهندسی و کارگاهی' : 'Shopfloor Symbol Library'}</h3>
                  <button 
                    type="button" 
                    onClick={() => setIsCreatorOpen(!isCreatorOpen)}
                    className="flex items-center gap-1 text-[10px] font-extrabold text-amber-500 hover:text-amber-400 transition-colors"
                  >
                    <Plus size={11} strokeWidth={3} />
                    <span>{isRtl ? 'نشانه جدید' : 'New Symbol'}</span>
                  </button>
                </div>

                {/* Inline creator form */}
                {isCreatorOpen && (
                  <div className="bg-[#121217] border border-zinc-800 rounded-xl p-3.5 mb-3 flex flex-col gap-3 animate-fade-in">
                    <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800/50">
                      <span className="text-[10px] font-black text-amber-500 flex items-center gap-1">
                        <Sparkles size={11} />
                        <span>{isRtl ? 'ساخت نشانه سفارشی' : 'Define Custom Symbol'}</span>
                      </span>
                      <button type="button" onClick={() => setIsCreatorOpen(false)} className="text-zinc-500 hover:text-white">
                        <X size={10} />
                      </button>
                    </div>

                    {/* Label Input */}
                    <div>
                      <label className="text-[9px] text-zinc-500 block mb-1">{isRtl ? 'نام / توضیح کوتاه نشانه:' : 'Label Name:'}</label>
                      <input 
                        type="text" 
                        value={newSymLabel}
                        onChange={(e) => setNewSymLabel(e.target.value)}
                        placeholder={isRtl ? "مثلا: رزوه داخلی M12" : "e.g. Core Pin Alignment"}
                        className="w-full bg-[#1A1A22] border border-zinc-800 rounded-lg py-1 px-2.5 text-xs text-white"
                      />
                    </div>

                    {/* Type selection */}
                    <div>
                      <label className="text-[9px] text-zinc-500 block mb-1">{isRtl ? 'نوع رفتار ترسیمی:' : 'Shape Type:'}</label>
                      <select
                        value={newSymType}
                        onChange={(e) => setNewSymType(e.target.value as any)}
                        className="w-full bg-[#1A1A22] border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white"
                      >
                        <option value="badge">{isRtl ? 'کپسول برچسب هوشمند' : 'Glass Callout Badge'}</option>
                        <option value="circle">{isRtl ? 'حلقه دایره دفرمه' : 'Focus Ring Circle'}</option>
                        <option value="rect">{isRtl ? 'کادر مربعی دو خط' : 'Bounding Rect'}</option>
                        <option value="arrow">{isRtl ? 'فلش جهتی' : 'Directional Arrow'}</option>
                      </select>
                    </div>

                    {/* Emoji Preset list */}
                    <div>
                      <label className="text-[9px] text-zinc-500 block mb-1">{isRtl ? 'آیکون / ایموجی نشانه:' : 'Pick Icon / Emoji:'}</label>
                      <div className="flex flex-wrap gap-1 bg-[#181820] p-1.5 rounded-lg border border-zinc-800">
                        {EMOJI_PRESETS.map(emo => (
                          <button
                            key={emo}
                            type="button"
                            onClick={() => setNewSymChar(emo)}
                            className={`w-7 h-7 flex items-center justify-center text-xs rounded hover:bg-zinc-800 transition-colors ${newSymChar === emo ? 'bg-amber-500/20 border border-amber-500/40 text-amber-500' : ''}`}
                          >
                            {emo}
                          </button>
                        ))}
                      </div>
                      <input 
                        type="text" 
                        value={newSymChar}
                        onChange={(e) => setNewSymChar(e.target.value)}
                        placeholder={isRtl ? "یا ایموجی سفارشی بنویسید..." : "Or type custom character..."}
                        className="w-full bg-[#1A1A22] border border-zinc-800 rounded-lg py-1 px-2.5 text-xs text-white mt-1.5 font-bold"
                      />
                    </div>

                    {/* Color Presets */}
                    <div>
                      <label className="text-[9px] text-zinc-500 block mb-1">{isRtl ? 'رنگ متمایز کننده:' : 'Choose Accent Color:'}</label>
                      <div className="flex gap-1.5">
                        {COLOR_PRESETS.map(col => (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setNewSymColor(col)}
                            className="w-5 h-5 rounded-full border border-black/50 transition-transform active:scale-90"
                            style={{ 
                              backgroundColor: col,
                              boxShadow: newSymColor === col ? `0 0 0 2px #09090C, 0 0 0 3px ${col}` : 'none'
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Submit */}
                    <button
                      type="button"
                      onClick={handleAddCustomSymbol}
                      className="w-full bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[10.5px] py-1.5 rounded-lg transition-colors mt-1 flex items-center justify-center gap-1"
                    >
                      <Plus size={12} strokeWidth={3} />
                      <span>{isRtl ? 'افزودن نشانه به کتابخانه' : 'Add Symbol to Library'}</span>
                    </button>
                  </div>
                )}

                {/* Symbols Library Grid (Figma Style) */}
                <div className="grid grid-cols-2 gap-1.5 max-h-[160px] overflow-y-auto pr-1 bg-[#101015] border border-zinc-800/50 rounded-xl p-2">
                  {symbolsLibrary.map((sym) => {
                    const isSelected = selectedSymbolId === sym.id;
                    return (
                      <button
                        key={sym.id}
                        type="button"
                        onClick={() => setSelectedSymbolId(sym.id)}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-right transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-[#1D1D26] border-amber-500 text-amber-400 font-extrabold shadow-md shadow-amber-500/5' 
                            : 'bg-[#121217] border-zinc-850 text-zinc-400 hover:text-zinc-200 hover:border-zinc-800'
                        }`}
                      >
                        <span 
                          className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] font-black shrink-0"
                          style={{ backgroundColor: `${sym.color}20`, color: sym.color }}
                        >
                          {sym.symbol}
                        </span>
                        <span className="text-[10px] truncate leading-none">{sym.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom note for the next placed callout */}
              <div className="bg-[#101015] border border-zinc-800/50 rounded-xl p-3">
                <label className="text-[9px] text-zinc-500 font-black block mb-1 uppercase">
                  {isRtl ? 'توضیحات تکمیلی نشانه جاری:' : 'Custom Text Detail (Next Placement):'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={annotationCustomText}
                    onChange={(e) => setAnnotationCustomText(e.target.value)}
                    placeholder={isRtl ? "مثال: رزوه سالم تست شد یا ۵ گشتاور" : "e.g. Verify alignment or 15Nm torque"}
                    className="w-full bg-[#181820] border border-zinc-800 rounded-lg py-1.5 px-3 text-[11px] text-white outline-none focus:border-amber-500/30"
                  />
                  {annotationCustomText && (
                    <button 
                      onClick={() => setAnnotationCustomText('')} 
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <p className="text-[8.5px] text-zinc-500 font-bold mt-1.5">
                  {isRtl 
                    ? 'ابتدا متن بالا را بنویسید، سپس روی عکس کلیک کنید تا با آیکون انتخابی روی موقعیت ثبت شود.' 
                    : 'Write detail first, then tap the photograph to place with the selected symbol prefix.'}
                </p>
              </div>

              {/* Multi-Image Gallery */}
              <div>
                <h3 className="text-xs font-black text-zinc-400 mb-2.5 uppercase tracking-wider">{isRtl ? 'گالری تصاویر پیوست گام ساخت' : 'Attached Photgraphs Gallery'}</h3>
                
                <div className="flex flex-col gap-3 bg-[#101015] border border-zinc-800/50 rounded-xl p-3">
                  {/* Image thumbnails list */}
                  <div className="flex flex-wrap gap-2">
                    {images.map((img, idx) => (
                      <div 
                        key={idx}
                        onClick={() => setActiveImageIndex(idx)}
                        className={`relative w-14 h-14 rounded-lg overflow-hidden border cursor-pointer transition-all ${activeImageIndex === idx ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-zinc-800 hover:border-zinc-700'}`}
                      >
                        <img src={img} alt="Thumb" className="w-full h-full object-cover pointer-events-none" referrerPolicy="no-referrer" />
                        <button 
                          type="button"
                          onClick={(e) => handleDeleteImage(idx, e)}
                          className="absolute top-0.5 right-0.5 bg-red-600/95 hover:bg-red-600 text-white p-0.5 rounded transition-colors cursor-pointer"
                        >
                          <X size={8} />
                        </button>
                        <span className="absolute bottom-0.5 left-0.5 bg-black/75 text-white text-[7px] px-1 rounded font-mono font-bold">{idx + 1}</span>
                      </div>
                    ))}
                  </div>

                  {/* Add image URL input */}
                  <div className="flex gap-2 border-t border-zinc-800/30 pt-2.5 mt-1">
                    <input
                      type="text"
                      value={newImgUrl}
                      onChange={(e) => setNewImgUrl(e.target.value)}
                      placeholder={isRtl ? "لینک عکس کارگاهی جدید..." : "Add new photo URL..."}
                      className="flex-1 bg-[#181820] border border-zinc-850 rounded-lg py-1 px-2.5 text-[10.5px] text-white outline-none focus:border-amber-500/30"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className="bg-amber-500 hover:bg-amber-400 text-black p-1.5 rounded-lg select-none cursor-pointer transition-all active:scale-95 flex items-center justify-center shrink-0"
                    >
                      <Plus size={12} strokeWidth={3} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Active Annotations Manager List */}
              {annotations.length > 0 && (
                <div className="border-t border-zinc-800/40 pt-3.5 mt-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black text-zinc-400 uppercase tracking-wider">{isRtl ? 'نشانه‌های ثبت شده در تصویر' : 'Placed On-Image Labels'}</h3>
                    <button 
                      onClick={() => setAnnotations([])}
                      className="text-[9.5px] font-black text-rose-500 hover:text-rose-400 transition-colors"
                    >
                      {isRtl ? 'حذف همه' : 'Clear All'}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1 max-h-[110px] overflow-y-auto bg-[#101015] border border-zinc-800/50 rounded-xl p-2">
                    {annotations.map((ann) => (
                      <div key={ann.id} className="flex items-center justify-between bg-[#14141A] border border-zinc-850/50 rounded-lg py-1 px-2 text-[10px] text-zinc-300 font-bold">
                        <span className="flex items-center gap-1.5 truncate">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: ann.color }} />
                          <span className="truncate">{ann.text}</span>
                        </span>
                        <button 
                          onClick={(e) => handleDeleteAnnotation(ann.id, e)} 
                          className="text-zinc-500 hover:text-rose-500 p-0.5"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Actions Row */}
            <div className="flex items-center gap-2 border-t border-zinc-800/40 pt-4 mt-auto">
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs py-2.5 rounded-xl select-none transition-all cursor-pointer text-center shadow-lg active:scale-95"
              >
                {isRtl ? 'تایید و ثبت نهایی' : 'Save Annotations'}
              </button>
              
              <button
                type="button"
                onClick={onClose}
                className="bg-[#121216] hover:bg-[#181820] text-zinc-400 hover:text-white font-bold text-xs py-2.5 px-4 rounded-xl select-none border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer text-center"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* Modern custom confirmDialog modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/85 animate-fade-in backdrop-blur-md" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0D0D10] border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col relative select-none">
            <div className="flex items-center gap-3 border-b border-[#1C1C1E] pb-4 mb-4">
              <div className="p-2.5 bg-rose-500/10 rounded-xl text-rose-500 shrink-0">
                <AlertTriangle size={18} />
              </div>
              <div className="flex-1 text-right">
                <h4 className="text-sm font-black text-white">
                  {confirmDialog.title}
                </h4>
              </div>
              <button 
                type="button"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="text-zinc-500 hover:text-white p-1 rounded transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>
            
            <p className="text-[11.5px] text-zinc-300 leading-relaxed text-right py-1 mb-6 font-sans">
              {confirmDialog.message}
            </p>
            
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-[#1C1C1F] hover:bg-[#252529] text-zinc-400 hover:text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    confirmDialog.onConfirm();
                  } catch (err: any) {
                    console.error('Confirm action failed', err);
                  }
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-rose-600/10 cursor-pointer"
              >
                {isRtl ? 'تأیید' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
