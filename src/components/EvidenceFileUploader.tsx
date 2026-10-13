/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, DragEvent, ChangeEvent } from 'react';
import { Upload, Trash2, Image, AlertCircle, Eye } from 'lucide-react';

interface Props {
  itemId: string;
  image?: string;
  onUpload: (id: string, file: File) => void;
  onRemove: (id: string) => void;
  onZoom: (img: string) => void;
}

export default function EvidenceFileUploader({ itemId, image, onUpload, onRemove, onZoom }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  // Handle Drag Events
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        onUpload(itemId, file);
      } else {
        alert('لطفا فقط فایل‌های تصویری معتبر (JPG، PNG، WebP) آپلود نمایید.');
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        onUpload(itemId, file);
      } else {
        alert('لطفا فقط فایل‌های تصویری معتبر (JPG، PNG، WebP) آپلود نمایید.');
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-w-[70px] select-none" dir="rtl">
      {image ? (
        <div className="relative group/uploader w-12 h-12 border border-[#3E3E43] rounded-lg bg-[#0F0F11] overflow-hidden flex items-center justify-center shadow-lg shadow-black/35 transition-all hover:border-amber-500/50">
          <img
            src={image}
            alt="شواهد ممیزی"
            className="w-full h-full object-cover transition-transform duration-300 group-hover/uploader:scale-110"
          />
          
          {/* Cover Action Overlays */}
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center gap-1.5 opacity-0 group-hover/uploader:opacity-100 transition-opacity duration-200">
            <button
              type="button"
              onClick={() => onZoom(image)}
              className="p-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded transition-colors"
              title="مشاهده بزرگتر تصویر"
            >
              <Eye size={12} />
            </button>
            <button
              type="button"
              onClick={() => onRemove(itemId)}
              className="p-1 bg-red-950/80 hover:bg-red-900 hover:text-red-300 text-red-400 rounded transition-colors"
              title="حذف پیوست تصویر شواهد"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative group/uploader w-12 h-12 border border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-amber-500 bg-amber-500/10 scale-105'
              : 'border-[#2A2A2D] hover:border-amber-500/25 bg-[#121214] hover:bg-white/5 text-slate-500 hover:text-amber-500'
          }`}
          title="جهت بارگذاری تصویر کلیک کنید یا تصویر ممیزی را به این کادر بکشید (Drag & Drop)"
        >
          <label className="absolute inset-0 w-full h-full cursor-pointer flex flex-col items-center justify-center">
            <Upload size={13} className={`transition-transform duration-200 ${isDragging ? '-translate-y-1' : ''}`} />
            <span className="text-[7.5px] font-black mt-1 tracking-tighter">بارگذاری</span>
            
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </label>
        </div>
      )}
    </div>
  );
}
