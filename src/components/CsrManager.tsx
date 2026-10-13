/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { CsrDocument, CsrComparisonItem } from "../types";
import { iatfData, IATFClause } from "../data/iatfData";
import { 
  FileText, Sparkles, CheckCircle, AlertTriangle, XCircle, 
  Plus, Trash2, ArrowLeftRight, ChevronRight, Play, Info, 
  Compass, RefreshCw, Search, ShieldAlert, ArrowLeft,
  Edit2, Check, X, Save, Upload, FileUp, AlertCircle, TrendingUp
} from "lucide-react";
import { uiTranslations, iatfEnglishData } from "../lib/translations";
import { getGlobalAiModel } from "../lib/aiConfig";

interface Props {
  onSelectClauseId: (clauseId: string) => void;
  comparisons: CsrComparisonItem[];
  setComparisons: React.Dispatch<React.SetStateAction<CsrComparisonItem[]>>;
  documents: CsrDocument[];
  setDocuments: React.Dispatch<React.SetStateAction<CsrDocument[]>>;
  lang: 'fa' | 'en';
  onPinToDashboard?: () => void;
}

const TEMPLATE_IKCO = `الزامات خاص زنجیره تامین ایران خودرو (ساپکو):
بند ۱-۲: کلیه قطعات چدنی ایمنی ترمز دیسک باید تا سطح بچ ذوب ذوب‌آهن ردیابی شوند. شماره بچ و نام کوره بایستی بر روی پیشانی قطعه به صورت دائم حکاکی چشمی‌گردد و مغایرت بین مستندات و قطعه فیزیکی خط قرمز است.
بند ۳-۴: پیمانکار موظف است فرآیند تولید نمونه‌های اولیه را در قالب فرآیند APQP ثبت و پرونده ۱۹ گانه PPAP را به تأیید اداره تضمین کیفیت ساپکو برساند.
بند ۲-۵: آزمایشگاه فیزیکی پیمانکار باید نتایج آزمون خستگی و سایش فلز را هر ۲ ماه ممیزی کند. در صورت استفاده از آزمایشگاه همکار بیرونی، آن دپارتمان حتما بایستی گواهینامه ایزو ۱۷۰۲۵ معتبر از مراجع ملی داشته باشد.`;

const TEMPLATE_SAIPA = `الزامات کیفی زنجیره ساخت گروه خودرویی سایپا (سازه‌گستر):
بند ۲-۱: سیستم‌های خطاناشدنی‌سازی (Poka-Yoke) فیزیکی باید برای کلیه فرآیندهای پرسکاری و دایکست قطعات تعلیق نصب شوند. سنسورهای پوکایوکه باید در شروع هر شیفت با استفاده از کیت نمونه خراب (Red rabbit) تست و سوابق آن بایستی بیش از ۱۰ سال آرشیو گردد.
بند ۳-۲: در صورتی که هرگونه تعلیق موقت در فرآیندهای پایش اتوماتیک یا سنسورهای مانیتورینگ ایجاد شود، بازرس مقیم تضمین کیفیت بایستی بلافاصله فرآیند کنترل ۱۰۰ درصد دستی را توسط لوپ‌های نوری مستقر کرده و در لاگ‌بوک قرنطینه ثبت کند.
بند ۵-۱: کلیه پرسنل فرآیند خط، ناظرین و حتی اپراتورهای موقت باید دوره‌های بازآموزی ایمنی محصول خودرویی را پاس کرده و کارت صلاحیت ایمنی اختصاصی داشته باشند.`;

const TEMPLATE_BAHMAN = `سند الزامات استراتژیک بهمن موتور:
بند ۴-۳: هرگونه تغییر در قالب، فرآیند، تامین‌کننده ثانویه مواد آلیاژی یا جابجایی سالن تولید فیزیکی با ترانسفر ماشین‌آلات، باید پیش از پیاده‌سازی ارزیابی ریسک با ابزار FMEA شده و از طریق سامانه ECR بهمن‌موتور درخواست و نمونه‌های آزمایشی جدید با تایید مستقیم ممیز بهمن تولید شود.
بند ۱-۶: تامین‌کننده باید توانایی آماری پایش و نمونه‌برداری مشخصه‌های ابعادی کلیدی (Cpk) را داشته باشد. شاخص نهایی فرآیند تولید قطعات شاسی نباید کتبا از مقدار ۱.۶۷ کمتر تعیین گردد.`;

// English Parallel Templates for premium bilingual accuracy
const TEMPLATE_IKCO_EN = `IKCO Sapco Specific Requirements (Melt & Traceability):
Clause 1-2: All cast iron safety components of disc brake must be traceable to the furnace melt batch level. The batch number and furnace identity must be permanently engraved and visible on the component face. Any discrepancy between documentation and physical parts is a strict red-line.
Clause 3-4: The contractor is mandated to log and register the initial prototype generation process using the APQP framework, and obtain quality approval for all 19 PPAP elements from Sapco Quality Department.
Clause 2-5: The contractor's physical laboratory must audit wear and metal fatigue parameters every 2 months. In case of using an external partner laboratory, that department must hold a valid ISO/IEC 17025 accreditation from national standard services.`;

const TEMPLATE_SAIPA_EN = `SAIPA Quality Specific Requirements (Sazegostar):
Clause 2-1: Physical Poke-Yoke error-proofing systems must be installed for all stamping and die-casting press stations of suspension assemblies. Poke-Yoke active sensors must be validated at the beginning of each shift using a default failed kit (Red Rabbit). Records must be archived for more than 10 years.
Clause 3-2: In case of any temporary suspension of automated monitoring devices or sensor control loops, the residential QA Inspector must immediately deploy a 100% manual check under optical lines and record it in the quarantine logbook.
Clause 5-1: All active operators, supervisors, and temporary plant line workers must complete automotive product safety refresher courses and hold an exclusive safety qualification badge.`;

const TEMPLATE_BAHMAN_EN = `Bahman Motor Strategic Requirements:
Clause 4-3: Any changes in mold tooling, secondary alloy material supply, or plant machinery location transfers must be risk-assessed beforehand using FMEA tools, requested via Bahman Motor's ECR platform, and trial batches launched with auditor clearance.
Clause 1-6: Fully verified machine statistical index (Cpk) tracking is required for all critical dimensions. The process index of chassis components must not fall below 1.67.`;

export default function CsrManager({ 
  onSelectClauseId, 
  comparisons, 
  setComparisons, 
  documents, 
  setDocuments,
  lang,
  onPinToDashboard
}: Props) {
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);

  // PDF Upload specific states
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedModel, setSelectedModel] = useState(getGlobalAiModel());

  useEffect(() => {
    const handleModelChange = (e: any) => {
      if (e.detail?.modelId) {
        setSelectedModel(e.detail.modelId);
      }
    };
    window.addEventListener('qms_ai_model_changed', handleModelChange);
    return () => window.removeEventListener('qms_ai_model_changed', handleModelChange);
  }, []);

  // States for manual editing individual items
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<CsrComparisonItem | null>(null);

  const t = uiTranslations[lang];
  const isRtl = lang === 'fa';

  // Dynamic on-demand script injector for PDF.js to support flawless background client parsing
  const loadPdfJs = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      script.crossOrigin = "anonymous";
      script.onload = () => {
        const lib = (window as any).pdfjsLib;
        if (lib) {
          lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          resolve(lib);
        } else {
          reject(new Error("PDF.js global object not found."));
        }
      };
      script.onerror = () => {
        reject(new Error("Failed to load PDF.js engine from CDN."));
      };
      document.head.appendChild(script);
    });
  };

  const handlePdfUpload = async (file: File) => {
    if (!file) return;
    const isPdfFile = file.type === "application/pdf" || file.name.endsWith(".pdf");
    const isWordFile = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
                       file.type === "application/msword" ||
                       file.name.endsWith(".docx") || 
                       file.name.endsWith(".doc");

    if (!isPdfFile && !isWordFile) {
      setPdfError(isRtl ? "لطفاً فقط فایل PDF یا Word معتبر بارگذاری کنید (.pdf, .docx, .doc)" : "Please upload a valid PDF or Word file (.pdf, .docx, .doc)");
      return;
    }

    setPdfLoading(true);
    setPdfError(null);
    setIsAddingNew(true);

    // Auto-derive clean display title from filename
    const cleanTitle = file.name
      .replace(/\.(pdf|docx|doc)$/i, "")
      .replace(/[-_]/g, " ")
      .trim();
    setDocTitle(cleanTitle);

    try {
      // Read the file as base64 to leverage our extremely robust backend parser
      const reader = new FileReader();
      
      const fileText: string = await new Promise((resolve, reject) => {
        reader.onload = async () => {
          try {
            const base64String = (reader.result as string).split(',')[1];
            const response = await fetch("/api/extract-pdf", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ 
                base64: base64String, 
                model: selectedModel,
                fileType: isWordFile ? "docx" : "pdf",
                fileName: file.name
              })
            });
            const resData = await response.json();
            if (resData.success) {
              resolve(resData.text);
            } else {
              reject(new Error(resData.error || (isRtl ? "خطا در تجزیه مدرک در سرور" : "Failed server document parsing")));
            }
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = () => reject(new Error(isRtl ? "خطا در خواندن فایل" : "File reading failed"));
        reader.readAsDataURL(file);
      });

      const finalContent = fileText.trim();
      if (!finalContent) {
        throw new Error(isRtl ? "متن استخراج شده خالی است." : "Empty text output");
      }

      setDocContent(finalContent);
      setPdfError(null);
    } catch (error: any) {
      console.warn("Could not extract text from document, error returned:", error);
      setPdfError(error.message);
    } finally {
      setPdfLoading(false);
    }
  };

  // Helper recursively flattens IATF tree structure down to depth 5 for the dropdown menu
  const flatClausesList = useMemo(() => {
    const getFlat = (clauses: IATFClause[], depth = 0): { id: string; number: string; title: string; depth: number }[] => {
      let list: any[] = [];
      for (const c of clauses) {
        // Localized Title
        const translatedTitle = isRtl ? c.title : (iatfEnglishData[c.id]?.title || c.title);
        list.push({ id: c.id, number: c.number, title: translatedTitle, depth });
        if (c.subClauses) {
          list = [...list, ...getFlat(c.subClauses, depth + 1)];
        }
      }
      return list;
    };
    return getFlat(iatfData);
  }, [isRtl]);

  const [csrConfirmModal, setCsrConfirmModal] = useState<{
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

  const handleStartEdit = (item: CsrComparisonItem) => {
    setEditingItemId(item.customerId);
    setEditFormData({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditFormData(null);
  };

  const handleSaveEdit = () => {
    if (!editFormData) return;
    setComparisons(prev => prev.map(c => c.customerId === editFormData.customerId ? editFormData : c));
    setEditingItemId(null);
    setEditFormData(null);
  };

  // Quick template loading helper
  const handleLoadTemplate = (type: "ikco" | "saipa" | "bahman") => {
    if (isRtl) {
      if (type === "ikco") {
        setDocTitle("الزامات خاص ایران خودرو (ساپکو - ذوب و ردیابی)");
        setDocContent(TEMPLATE_IKCO);
      } else if (type === "saipa") {
        setDocTitle("الزامات خاص سایپا (سازه‌گستر - پوکایوکه و موقت)");
        setDocContent(TEMPLATE_SAIPA);
      } else {
        setDocTitle("الزامات استراتژیک بهمن موتور (تغییرات مهندسی و آماری)");
        setDocContent(TEMPLATE_BAHMAN);
      }
    } else {
      if (type === "ikco") {
        setDocTitle("IKCO Sapco Specific Requirements (Melt & Traceability)");
        setDocContent(TEMPLATE_IKCO_EN);
      } else if (type === "saipa") {
        setDocTitle("SAIPA Quality Requirements (Poke-Yoke & Backup)");
        setDocContent(TEMPLATE_SAIPA_EN);
      } else {
        setDocTitle("Bahman Motor Strategic Requirements (FMEA & Cp)");
        setDocContent(TEMPLATE_BAHMAN_EN);
      }
    }
    setIsAddingNew(true);
  };

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim() || !docContent.trim()) return;

    const newDoc: CsrDocument = {
      id: `csr-doc-${Date.now()}`,
      title: docTitle.trim(),
      content: docContent.trim(),
      createdAt: new Date().toISOString().split("T")[0]
    };

    setDocuments(prev => [newDoc, ...prev]);
    setActiveDocId(newDoc.id);
    setDocTitle("");
    setDocContent("");
    setIsAddingNew(false);
  };

  const handleDeleteDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const promptTitle = isRtl ? "🗑️ حذف سند الزامات خاص مشتری" : "🗑️ Delete Customer Specific Requirements Document";
    const promptMessage = isRtl 
      ? "آیا از حذف این سند الزامات مشتری اطمینان دارید؟ تمامی تحلیل‌ها و مقایسه‌های مرتبط با آن پاک خواهند شد." 
      : "Are you sure you want to delete this customer requirements document? All related alignments and AI analyses will be lost.";
      
    setCsrConfirmModal({
      isOpen: true,
      title: promptTitle,
      message: promptMessage,
      onConfirm: () => {
        setDocuments(prev => prev.filter(d => d.id !== id));
        if (activeDocId === id) {
          setActiveDocId(null);
        }
        setComparisons(prev => prev.filter(c => c.documentId !== id));
        setCsrConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAnalyzeDocument = async (doc: CsrDocument) => {
    setLoading(true);
    setLoadingStep(isRtl ? "در حال برقراری ارتباط با موتور هوش مصنوعی..." : "Establishing communication with AI engine...");
    
    // Smooth loader step simulation for rich UX, as API calls are fast but users value feedback
    const stepsFa = [
      "در حال بارگذاری کاتالوگ بندهای عمومی IATF 16949...",
      "در حال تفکیک و استخراج بندهای خاص سند مشتری...",
      "در حال مقایسه هوشمند بند به بند در عمق ۵ زیربند...",
      "مکان‌یابی شکاف‌های کیفی و تحلیل گپ استاندارد...",
      "در حال نهایی‌سازی گزارش تطبیق CSR..."
    ];

    const stepsEn = [
      "Loading generic IATF 16949 clause map...",
      "Extracting custom statements from the client booklet...",
      "Performing comparative audits down to level 5 depth...",
      "Locating quality discrepancies and standard gaps...",
      "Finalizing dynamic alignment CSR record..."
    ];

    const targetSteps = isRtl ? stepsFa : stepsEn;

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < targetSteps.length) {
        setLoadingStep(targetSteps[currentStep]);
        currentStep++;
      }
    }, 900);

    try {
      const response = await fetch("/api/compare-requirements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentTitle: doc.title,
          documentContent: doc.content,
          model: selectedModel
        })
      });

      const resData = await response.json();
      clearInterval(interval);

      if (resData.success && Array.isArray(resData.data)) {
        // Tag with current document reference
        const processed: CsrComparisonItem[] = resData.data.map((item: any) => ({
          ...item,
          documentId: doc.id,
          documentTitle: doc.title
        }));

        // Remove old comparisons for this document and append new ones
        setComparisons(prev => [
          ...prev.filter(c => c.documentId !== doc.id),
          ...processed
        ]);
        setActiveDocId(doc.id);
      } else {
        alert(isRtl ? "خطا در پاسخ هوش مصنوعی. لطفا مجددا تلاش فرمایید." : "AI engine returned an invalid response. Please retry.");
      }
    } catch (e) {
      console.error(e);
      clearInterval(interval);
      alert(isRtl ? "خطا در ایجاد ارتباط با سرور مقایسه‌گر هوشمند." : "Failed to establish secure network tunnel for comparison.");
    } finally {
      setLoading(false);
      setLoadingStep("");
    }
  };

  const [clauseFilter, setClauseFilter] = useState<string>("all");

  // Filter comparison items for display
  const activeComparisons = useMemo(() => {
    let items = comparisons.filter(c => c.documentId === activeDocId);
    
    if (statusFilter !== "all") {
      items = items.filter(c => c.status === statusFilter);
    }

    if (clauseFilter !== "all") {
      items = items.filter(c => c.mappedIatfClauseId === clauseFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(c => 
        c.customerNumber.toLowerCase().includes(q) ||
        (c.customerTitle && c.customerTitle.toLowerCase().includes(q)) ||
        c.customerText.toLowerCase().includes(q) ||
        c.mappedIatfClauseId.toLowerCase().includes(q) ||
        c.comparisonText.toLowerCase().includes(q)
      );
    }

    return items;
  }, [comparisons, activeDocId, statusFilter, clauseFilter, searchQuery]);

  // Aggregate stats
  const activeStats = useMemo(() => {
    const items = comparisons.filter(c => c.documentId === activeDocId);
    const total = items.length;
    if (total === 0) return { avgScore: 0, fully: 0, partial: 0, gap: 0, total: 0 };

    const sum = items.reduce((acc, curr) => acc + curr.alignmentScore, 0);
    const fully = items.filter(c => c.status === "fully_aligned").length;
    const partial = items.filter(c => c.status === "partially_aligned").length;
    const gap = items.filter(c => c.status === "gap_detected").length;

    return {
      avgScore: Math.round(sum / total),
      fully,
      partial,
      gap,
      total
    };
  }, [comparisons, activeDocId]);

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Top CSR Intro Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className={isRtl ? "text-right" : "text-left"}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-500 font-bold text-xs tracking-wider">
              CUSTOMER SPECIFIC REQUIREMENTS (CSR)
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
          </div>
          <h1 className={`text-lg sm:text-xl md:text-2xl text-white ${isRtl ? "font-sans font-extrabold" : "font-sans font-bold"} flex items-center gap-1.5`}>
            <span>{isRtl ? "مدیریت و انطباق هوشمند الزامات خاص مشتریان" : "Smart Management & Alignment of Customer-Specific Requirements"}</span>
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
          <p className="text-xs text-slate-400 mt-1">
            {isRtl 
              ? "بارگذاری اسناد، مقایسه بند به بند تا عمق ۵ زیربند، گزارش انطباق و ردیابی گپ‌های استاندارد" 
              : "Upload booklets, analyze clauses down to level 5 depth, generate alignment scores and audit gaps."}
          </p>
        </div>
        
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-[#141416] px-2.5 py-1.5 rounded text-xs text-slate-400 border border-[#232327]">
              <Sparkles size={12} className="text-amber-500 animate-pulse" />
              <span className="text-[10px] text-slate-500">{isRtl ? "موتور هوش مصنوعی:" : "AI Engine:"}</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-transparent text-slate-300 outline-none cursor-pointer text-[11px] font-sans"
              >
                <option value="gemini-2.5-flash">{isRtl ? "Gemini 2.5 Flash" : "Gemini 2.5 Flash"}</option>
                <option value="gemini-2.5-pro">{isRtl ? "Gemini 2.5 Pro (پیشرفته)" : "Gemini 2.5 Pro"}</option>
                <option value="gemini-2.0-flash">{isRtl ? "Gemini 2.0 Flash" : "Gemini 2.0 Flash"}</option>
                <option value="gemini-2.0-pro-exp">{isRtl ? "Gemini 2.0 Pro Exp" : "Gemini 2.0 Pro Exp"}</option>
                <option value="gemini-3.5-flash">{isRtl ? "Gemini 3.5 Flash (آخرین ورژن ✨)" : "Gemini 3.5 Flash (Latest)"}</option>
                <option value="gemini-3.1-pro-preview">{isRtl ? "Gemini 3.1 Pro" : "Gemini 3.1 Pro"}</option>
                <option value="gemini-3.1-flash-lite">{isRtl ? "Gemini 3.1 Lite" : "Gemini 3.1 Lite"}</option>
              </select>
            </div>
            {selectedModel !== 'gemini-3.5-flash' && (
              <button
                onClick={() => setSelectedModel('gemini-3.5-flash')}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-500 rounded text-[10px] font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer"
                title={isRtl ? "ارتقاء فوری به آخرین ورژن در دسترس" : "Upgrade instantly to latest version"}
              >
                <TrendingUp size={11} className="animate-bounce" />
                <span>{isRtl ? "ارتقاء به آخرین ورژن" : "Upgrade"}</span>
              </button>
            )}
          </div>
          {!isAddingNew && (
            <button
              onClick={() => setIsAddingNew(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-bold py-2.5 px-4 rounded text-xs transition-colors shadow-lg hover:shadow-amber-500/10"
            >
              <Plus size={14} />
              {isRtl ? "ثبت الزامات جدید" : "Register New Booklets"}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Left pane: CSR Documents List & Add */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* PDF or Word Drag & Drop Upload Zone */}
          <div 
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handlePdfUpload(e.dataTransfer.files[0]);
              }
            }}
            className={`border border-dashed rounded-xl p-5 text-center transition-all cursor-pointer relative ${
              dragActive 
                ? "border-amber-500 bg-amber-500/5 shadow-[0_0_15px_rgba(245,158,11,0.1)]" 
                : pdfLoading
                ? "border-amber-500/40 bg-[#121214] animate-pulse"
                : "border-[#2D2D31] bg-[#0F0F11]/30 hover:border-amber-500/30 hover:bg-amber-500/[0.01]"
            }`}
          >
            <input
              type="file"
              accept=".pdf,.docx,.doc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handlePdfUpload(e.target.files[0]);
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={pdfLoading}
            />
            
            {pdfLoading ? (
              <div className="space-y-3 py-3">
                <RefreshCw className="mx-auto text-amber-500 animate-spin" size={28} />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white uppercase tracking-wider animate-pulse">
                    {isRtl ? "در حال استخراج هوشمند متن سند..." : "Extracting text structure from document..."}
                  </p>
                  <p className="text-[10px] text-amber-500 font-mono">
                    {isRtl ? "با استفاده از تحلیلگر هوشمند و محلی" : "Powered by AI & local document parsers"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 py-2">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-amber-500/10 text-amber-500">
                  <Upload size={20} className="animate-bounce" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white">
                    {isRtl ? "بارگذاری فایل PDF یا Word الزامات خاص" : "Upload Customer PDF/Word Booklet"}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {isRtl ? "فایل PDF یا Word را به اینجا بکشید یا برای انتخاب کلیک کنید" : "Drag & drop PDF or Word booklet here, or click to browse"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {pdfError && (
            <div className="border border-red-500/20 bg-red-500/[0.02] rounded-xl p-4 flex gap-3 text-xs text-[#E57373] leading-relaxed relative animate-fade-in">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-400" />
              <div>
                <p>{pdfError}</p>
                <button 
                  onClick={() => setPdfError(null)}
                  className="mt-2 text-[10px] underline font-bold hover:text-red-300"
                >
                  {isRtl ? "متوجه شدم" : "Dismiss"}
                </button>
              </div>
            </div>
          )}
          
          {/* Form to add custom CSR document */}
          {isAddingNew && (
            <div className="border border-[#2A2A2D] bg-[#121214] rounded-xl p-5 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-[#2A2A2D]">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  {isRtl ? "ثبت مدرک CSR جدید" : "Register Custom CSR"}
                </h3>
                <button 
                  onClick={() => setIsAddingNew(false)}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  <ArrowLeft size={16} className={isRtl ? "" : "rotate-180"} />
                </button>
              </div>

              <form onSubmit={handleAddDocument} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-[#666] font-bold block">
                    {isRtl ? "عنوان سند الزامات مشتری:" : "Client book title:"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isRtl ? "مانند: الزامات خاص پارس خودرو - خط شاسی" : "e.g. Sazegostar brakes line manual"}
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    className="w-full text-xs bg-[#0F0F11] border border-[#2A2A2D] focus:border-amber-500/40 rounded py-2.5 px-3 text-slate-300 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase text-[#666] font-bold block">
                    {isRtl ? "متن بندهای الزامات:" : "Statement requirements content:"}
                  </label>
                  <textarea
                    required
                    rows={8}
                    placeholder={isRtl 
                      ? "متن بندها را در اینجا وارد یا پیست کنید. هر بند با شماره مشخص نظیر 'بند ۲-۱' آغاز شود." 
                      : "Type or paste items here. Begin clauses with clear tags like 'Clause 2-1'."}
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    className="w-full text-xs font-sans bg-[#0F0F11] border border-[#2A2A2D] focus:border-amber-500/40 rounded py-2.5 px-3 text-[#BBB] outline-none transition-all resize-none custom-scrollbar leading-relaxed"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-slate-100 hover:bg-white text-black font-bold py-2.5 rounded text-xs transition-colors"
                >
                  {isRtl ? "افزودن به لیست اسناد" : "Save Booklet"}
                </button>
              </form>
            </div>
          )}

          {/* List of active CSR documents */}
          <div className="border border-[#2A2A2D] bg-[#0F0F11]/50 rounded-xl overflow-hidden">
            <div className="p-4 bg-[#121214] border-b border-[#2A2A2D]">
              <h3 className="text-xs font-bold text-white">
                {isRtl ? "دفترچه الزامات مشتریان بارگذاری شده" : "Client Booklet Database"}
              </h3>
            </div>
            
            <div className="p-2 divide-y divide-[#2A2A2D]">
              {documents.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  <FileText className="mx-auto opacity-10 mb-2" size={36} />
                  {isRtl 
                    ? "هیچ سند الزاماتی ثبت نشده است. مدرک جدید ثبت کرده یا فایلی آپلود کنید." 
                    : "No corporate booklets loaded. Create or upload a custom item."}
                </div>
              ) : (
                documents.map((doc) => {
                  const hasAnalysis = comparisons.some(c => c.documentId === doc.id);
                  const isActive = activeDocId === doc.id;

                  return (
                    <div
                      key={doc.id}
                      onClick={() => setActiveDocId(doc.id)}
                      className={`p-3 cursor-pointer transition-colors hover:bg-white/[0.02] flex flex-col gap-2 ${
                        isActive ? "bg-amber-500/5 " + (isRtl ? "border-r-2 border-amber-500" : "border-l-2 border-amber-500") : ""
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-2.5">
                          <FileText size={16} className={isActive ? "text-amber-500" : "text-slate-400"} />
                          <div className={isRtl ? "text-right" : "text-left"}>
                            <h4 className="text-xs font-medium text-white line-clamp-1">{doc.title}</h4>
                            <span className="text-[10px] text-[#555] font-mono block mt-0.5">{doc.createdAt}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDeleteDoc(doc.id, e)}
                          className="text-slate-600 hover:text-red-400 p-1 rounded hover:bg-white/5 transition-colors shrink-0"
                          title="حذف سند"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed bg-[#0A0A0B]/60 p-2 rounded">
                        {doc.content}
                      </div>

                      {/* Analysis activator */}
                      <div className="pt-1 flex items-center justify-between">
                        <span className="text-[9px] text-[#555] font-bold uppercase">
                          {hasAnalysis ? (
                            <span className="text-green-500 flex items-center gap-1">
                              <CheckCircle size={10} />
                              {isRtl ? "ممیزی شده" : "Audited"}
                            </span>
                          ) : (
                            <span className="text-slate-500">{isRtl ? "آماده تحلیل" : "Pending Analysis"}</span>
                          )}
                        </span>

                        <button
                          type="button"
                          disabled={loading}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAnalyzeDocument(doc);
                          }}
                          className={`text-[9px] font-bold px-2 py-1 rounded transition-colors flex items-center gap-1 ${
                            hasAnalysis 
                              ? "bg-[#222] text-[#AAA] hover:bg-[#333] hover:text-white" 
                              : "bg-amber-500 hover:bg-amber-400 text-black shadow-md shadow-amber-500/5 font-extrabold"
                          }`}
                        >
                          <Play size={8} />
                          {hasAnalysis ? (isRtl ? "بررسی مجدد" : "Re-analyze") : (isRtl ? "تحلیل با جمینی" : "Analyze with Gemini")}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right pane: Results & Interactive edits */}
        <div className="xl:col-span-8 space-y-6">
          {activeDocId ? (
            <>
              {/* Statistics Panel */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="border border-[#2D2D31] bg-[#121214] rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">{t.totalComplianceIndex}</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-mono text-amber-500 font-extrabold">{activeStats.avgScore}%</span>
                  </div>
                  <div className="mt-2 w-full bg-[#1e1e22] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-amber-500 h-full" style={{ width: `${activeStats.avgScore}%` }}></div>
                  </div>
                </div>

                <div className="border border-[#2D2D31] bg-[#121214] rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">{t.totalCustomerClauses}</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-mono text-white font-extrabold">{activeStats.total}</span>
                    <span className="text-[10px] text-[#555] font-black uppercase">items</span>
                  </div>
                  <span className="text-[9px] text-[#555] font-bold font-mono mt-2 block">Level 1 - 5 check active</span>
                </div>

                <div className="border border-[#2D2D31] bg-[#121214] rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">{t.statusFullyAligned}</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-mono text-green-400 font-extrabold">{activeStats.fully}</span>
                    <span className="text-[10px] text-green-500/50">aligned</span>
                  </div>
                  <div className="mt-2 w-full bg-[#1e1e22] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-green-500 h-full" style={{ width: `${activeStats.total ? (activeStats.fully / activeStats.total) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div className="border border-[#2D2D31] bg-[#121214] rounded-xl p-4 flex flex-col justify-between">
                  <span className="text-[10px] font-bold text-[#666] uppercase tracking-wider">{t.totalDetectedGaps}</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-mono text-red-500 font-extrabold">{activeStats.gap}</span>
                    <span className="text-[10px] text-red-500/50">gaps</span>
                  </div>
                  <div className="mt-2 w-full bg-[#1e1e22] rounded-full h-1.5 overflow-hidden">
                    <div className="bg-red-500 h-full" style={{ width: `${activeStats.total ? (activeStats.gap / activeStats.total) * 100 : 0}%` }}></div>
                  </div>
                </div>
              </div>

              {/* Loader */}
              {loading && (
                <div className="border border-[#2A2A2D] bg-[#121214] p-10 rounded-xl space-y-4 flex flex-col items-center justify-center text-center">
                  <RefreshCw className="animate-spin text-amber-500" size={36} />
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                      {isRtl ? "موتور هوش مصنوعی در حال اجرای فرآیند ممیزی..." : "AI engine processing QMS validation tunnels..."}
                    </h4>
                    <p className="text-[11px] text-amber-500 font-mono font-bold">{loadingStep}</p>
                  </div>
                </div>
              )}

              {/* Filter controls and items ledger if not loading */}
              {!loading && activeStats.total === 0 && (
                <div className="border border-dashed border-[#2D2D31] rounded-xl p-16 text-center space-y-4">
                  <ShieldAlert className="mx-auto text-amber-500/20" size={48} />
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">
                      {isRtl ? "گزارش گپ هنوز اجرا نشده است" : "Audit Gap Report Pending"}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {isRtl 
                        ? "سند الزامات انتخابی شما هنوز پردازش نشده است. لطفاً روی دکمه 'تحلیل با جمینی' در منوی سمت چپ کلیک کنید." 
                        : "Your selected document has not been audited yet. Click 'Analyze with Gemini' on the left side list."}
                    </p>
                  </div>
                </div>
              )}

              {!loading && activeStats.total > 0 && (
                <div className="border border-[#2D2D31] bg-[#121214] rounded-xl overflow-hidden space-y-4 p-4 sm:p-6">
                  {/* Ledger Header and Filters */}
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#2D2D31] pb-4">
                    <div>
                      <h3 className="text-sm font-semibold text-white">
                        {isRtl ? "لیست مفصل انطباق بندهای الزامات" : "Detailed Statement Compliance Ledger"}
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {isRtl ? "قابلیت فیلتر نتایج به همراه ادیت دستی بندها" : "Filter results, alter mapped clauses, or perform manual calibration"}
                      </p>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                      {/* Search box */}
                      <div className="relative flex-1 md:flex-initial min-w-[140px]">
                        <Search size={12} className={`absolute top-1/2 -translate-y-1/2 text-[#555] ${isRtl ? 'right-3' : 'left-3'}`} />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={t.searchCsrPlaceholder}
                          className={`bg-[#0A0A0B] border border-[#2D2D31] text-[10px] sm:text-xs rounded px-2.5 py-1.5 outline-none text-slate-300 w-full focus:border-amber-500/50 ${isRtl ? 'pr-8 pl-3' : 'pl-8 pr-3'}`}
                        />
                      </div>

                      {/* Status Filter */}
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-[#0A0A0B] border border-[#2D2D31] text-[10px] sm:text-xs rounded py-1.5 px-2 outline-none text-slate-300 focus:border-amber-500/50"
                      >
                        <option value="all">{isRtl ? "تمام مدل‌های تطابق" : "All Alignments"}</option>
                        <option value="fully_aligned">{t.statusFullyAligned}</option>
                        <option value="partially_aligned">{t.statusPartiallyAligned}</option>
                        <option value="gap_detected">{t.statusGapDetected}</option>
                      </select>

                      {/* IATF Clause Filter */}
                      <select
                        value={clauseFilter}
                        onChange={(e) => setClauseFilter(e.target.value)}
                        className="bg-[#0A0A0B] border border-[#2D2D31] text-[10px] sm:text-xs rounded py-1.5 px-2 max-w-[140px] outline-none text-slate-300 focus:border-amber-500/50"
                      >
                        <option value="all">{t.allStandardClauses}</option>
                        {flatClausesList.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.number} - {c.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Manual Insertion option */}
                  <div className={`flex justify-end ${isRtl ? 'text-left' : 'text-right'}`}>
                    <button
                      type="button"
                      onClick={() => {
                        const newId = `manual-csr-${Date.now()}`;
                        const newItem: CsrComparisonItem = {
                          documentId: activeDocId,
                          documentTitle: documents.find(d => d.id === activeDocId)?.title || "سند الزامات",
                          customerId: newId,
                          customerNumber: isRtl ? "بند جدید الزامات" : "New Requirement",
                          customerTitle: isRtl ? "عنوان کیفیت" : "Quality Goal",
                          customerText: isRtl ? "لطفا الزام فیزیکی را بنویسید..." : "Write custom statement...",
                          mappedIatfClauseId: flatClausesList[0]?.id || "4.1",
                          alignmentScore: 80,
                          status: "partially_aligned",
                          comparisonText: isRtl 
                            ? "تحلیل کارشناسی خود را بازنویسی کنید..." 
                            : "Provide custom expert QMS alignment review..."
                        };
                        setComparisons(prev => [newItem, ...prev]);
                        setEditingItemId(newId);
                        setEditFormData(newItem);
                      }}
                      className="text-[10px] sm:text-xs font-bold text-amber-500 bg-amber-500/5 hover:bg-amber-500/15 border border-amber-500/30 rounded px-3 py-1.5 transition-all flex items-center gap-1"
                    >
                      {t.addCsrClause}
                    </button>
                  </div>

                  {/* Comparisons List */}
                  <div className="space-y-4">
                    {activeComparisons.length === 0 ? (
                      <div className="p-10 text-center text-slate-500 text-xs italic">
                        {t.noMatchedCsr}
                      </div>
                    ) : (
                      activeComparisons.map((item) => {
                        const isEditing = editingItemId === item.customerId;
                        const matchedIatf = getIatfRef(item.mappedIatfClauseId);

                        return (
                          <div 
                            key={item.customerId} 
                            className={`border rounded-xl p-4 sm:p-5 transition-all ${
                              isEditing 
                                ? "bg-[#18181B] border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.15)]" 
                                : item.status === "gap_detected" 
                                ? "bg-red-500/[0.01] border-red-500/20 hover:border-red-500/30" 
                                : "bg-[#0E0E10]/80 border-[#2D2D31] hover:border-[#3E3E43]"
                            }`}
                          >
                            {isEditing && editFormData ? (
                              /* Active Edit Form */
                              <div className="space-y-4 text-xs">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase text-[#666] font-bold block">{t.clauseNo}:</label>
                                    <input
                                      type="text"
                                      value={editFormData.customerNumber}
                                      onChange={(e) => setEditFormData({ ...editFormData, customerNumber: e.target.value })}
                                      className="w-full bg-[#0A0A0B] border border-[#2D2D31] rounded p-2 text-white text-xs outline-none focus:border-amber-500/50"
                                    />
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase text-[#666] font-bold block">{t.customerReqTitle}:</label>
                                    <input
                                      type="text"
                                      value={editFormData.customerTitle}
                                      onChange={(e) => setEditFormData({ ...editFormData, customerTitle: e.target.value })}
                                      className="w-full bg-[#0A0A0B] border border-[#2D2D31] rounded p-2 text-white text-xs outline-none focus:border-amber-500/50"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-[10px] uppercase text-[#666] font-bold block">{t.originalCsrTextEditable}</label>
                                  <textarea
                                    rows={3}
                                    placeholder={t.reqTextPlaceholder}
                                    value={editFormData.customerText}
                                    onChange={(e) => setEditFormData({ ...editFormData, customerText: e.target.value })}
                                    className="w-full bg-[#0A0A0B] border border-[#2D2D31] rounded p-2 text-white text-xs outline-none focus:border-amber-500/50 font-sans resize-none leading-relaxed"
                                  />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase text-[#666] font-bold block">{t.standardTreeDropdown}</label>
                                    <select
                                      value={editFormData.mappedIatfClauseId}
                                      onChange={(e) => {
                                        const cId = e.target.value;
                                        setEditFormData({ ...editFormData, mappedIatfClauseId: cId });
                                      }}
                                      className="w-full bg-[#0A0A0B] border border-[#2D2D31] rounded p-2 text-white text-xs outline-none focus:border-amber-500/50"
                                    >
                                      <option value="none">{t.noAssignment}</option>
                                      {flatClausesList.map(c => (
                                        <option key={c.id} value={c.id}>
                                          {c.number} {c.title}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase text-[#666] font-bold block">{t.alignmentStatus}</label>
                                    <select
                                      value={editFormData.status}
                                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                                      className="w-full bg-[#0A0A0B] border border-[#2D2D31] rounded p-2 text-white text-xs outline-none focus:border-amber-500/50"
                                    >
                                      <option value="fully_aligned">{t.statusFullyAligned}</option>
                                      <option value="partially_aligned">{t.statusPartiallyAligned}</option>
                                      <option value="gap_detected">{t.statusGapDetected}</option>
                                    </select>
                                  </div>

                                  <div className="space-y-1.5">
                                    <label className="text-[10px] uppercase text-[#666] font-bold block">{t.matchScore} Percentage (0-100):</label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={editFormData.alignmentScore}
                                      onChange={(e) => setEditFormData({ ...editFormData, alignmentScore: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })}
                                      className="w-full bg-[#0A0A0B] border border-[#2D2D31] rounded p-2 text-white text-xs outline-none focus:border-amber-500/50 font-mono"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <label className="text-[10px] uppercase text-[#666] font-bold block">{t.qaGuidance}</label>
                                  <textarea
                                    rows={3}
                                    placeholder={t.expertAnalysisPlaceholder}
                                    value={editFormData.comparisonText}
                                    onChange={(e) => setEditFormData({ ...editFormData, comparisonText: e.target.value })}
                                    className="w-full bg-[#0A0A0B] border border-[#2D2D31] rounded p-2 text-[#DDD] text-xs outline-none focus:border-amber-500/50 leading-relaxed resize-none font-sans"
                                  />
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={handleSaveEdit}
                                    className="px-4 py-2 bg-amber-500 font-bold hover:bg-amber-400 text-black rounded text-[10px] uppercase tracking-wider flex items-center gap-1"
                                  >
                                    <Save size={12} />
                                    {t.saveManualChanges}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="px-4 py-2 bg-[#2D2D31] hover:bg-[#3E3E43] text-white rounded text-[10px] uppercase tracking-wider"
                                  >
                                    {t.cancel}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Standard Card Presentation Row */
                              <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#2D2D31]/50 pb-2.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-amber-500 font-bold text-xs uppercase tracking-wide">
                                      {item.customerNumber}
                                    </span>
                                    <span className="text-white font-semibold text-xs py-0.5 px-2 bg-[#1A1A1D] border border-[#2A2A2D] rounded">
                                      {item.customerTitle}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      item.status === "fully_aligned"
                                        ? "bg-green-500/10 text-green-400"
                                        : item.status === "partially_aligned"
                                        ? "bg-amber-500/10 text-amber-500"
                                        : "bg-red-500/10 text-red-500"
                                    }`}>
                                      {item.status === "fully_aligned" 
                                        ? t.statusFullyAligned 
                                        : item.status === "partially_aligned" 
                                        ? t.statusPartiallyAligned 
                                        : t.statusGapDetected} • {item.alignmentScore}% {t.matchScore}
                                    </span>

                                    {/* Action Buttons */}
                                    <button
                                      type="button"
                                      onClick={() => handleStartEdit(item)}
                                      className="p-1 text-slate-400 hover:text-amber-500 hover:bg-white/5 rounded transition-all ml-1 shrink-0"
                                      title={t.manualEdit}
                                    >
                                      <Edit2 size={12} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        const proceed = isRtl 
                                          ? "آیا از حذف این بند الزامات خاص فیزیکی موازی اطمینان دارید؟" 
                                          : "Are you sure you want to delete this specific aligned clause?";
                                        setCsrConfirmModal({
                                           isOpen: true,
                                           title: isRtl ? "🗑️ حذف بند همتراز" : "🗑️ Delete Aligned Clause",
                                           message: proceed,
                                           onConfirm: () => {
                                             setComparisons(prev => prev.filter(c => c.customerId !== item.customerId));
                                             setCsrConfirmModal(prev => ({ ...prev, isOpen: false }));
                                           }
                                         });
                                         if (false) {
                                          setComparisons(prev => prev.filter(c => c.customerId !== item.customerId));
                                        }
                                      }}
                                      className="p-1 text-slate-500 hover:text-red-400 hover:bg-white/5 rounded transition-all shrink-0"
                                      title={t.delete}
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>

                                <p className={`text-xs text-[#999] leading-relaxed italic bg-[#0A0A0B]/40 p-3 rounded. border border-[#2A2A2D]/10 ${isRtl ? 'text-right' : 'text-left'}`}>
                                  <strong className="text-[9px] text-[#555] font-black uppercase tracking-widest block mb-1">
                                    {t.originalCsrText}
                                  </strong>
                                  "{item.customerText}"
                                </p>

                                {/* Mapping section with click navigation to Main IATF catalog */}
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-start pt-1">
                                  <div className="sm:col-span-4 bg-[#0A0A0B]/80 border border-[#2D2D31] rounded-lg p-3 flex flex-col justify-between h-full min-h-[90px]">
                                    <div>
                                      <span className="text-[9px] text-[#555] font-black uppercase tracking-wider block mb-1">
                                        {t.mappedIatfClause}
                                      </span>
                                      <span className="text-xs font-mono font-bold text-amber-500 block">
                                        {item.mappedIatfClauseId !== "none" ? item.mappedIatfClauseId : t.noAssignment}
                                      </span>
                                      {matchedIatf && (
                                        <span className="text-[10px] text-white line-clamp-1 font-medium mt-0.5">
                                          {matchedIatf.title}
                                        </span>
                                      )}
                                    </div>

                                    {item.mappedIatfClauseId !== "none" && (
                                      <button
                                        onClick={() => onSelectClauseId(item.mappedIatfClauseId)}
                                        className="text-[9px] text-amber-500 hover:text-amber-400 font-extrabold flex items-center gap-1 transition-colors mt-2 text-right uppercase"
                                        title={t.viewClauseDetailsHelp}
                                      >
                                        {t.viewClauseDetails}
                                        <ChevronRight size={10} className={isRtl ? "rotate-180" : ""} />
                                      </button>
                                    )}
                                  </div>

                                  <div className="sm:col-span-8 bg-[#121214] border border-[#2D2D31]/40 rounded-lg p-3 h-full min-h-[90px] flex flex-col">
                                    <span className="text-[9px] text-[#555] font-black uppercase tracking-wider block mb-1">
                                      {t.qaGuidance}
                                    </span>
                                    <p className={`text-[11px] text-[#BBB] leading-relaxed ${isRtl ? 'text-justify' : 'text-left'}`}>
                                      {item.comparisonText}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="border border-dashed border-[#2D2D31] rounded-xl p-16 text-center space-y-4">
              <FileText className="mx-auto text-amber-500/15" size={48} />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-white">
                  {t.activeCsrDoc}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {t.noActiveDoc}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Custom Confirmation Dialog Modal */}
      {csrConfirmModal.isOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0F0F12] border border-[#27272C] rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
              <span className="text-red-500">{csrConfirmModal.title}</span>
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
              {csrConfirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setCsrConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                {isRtl ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={csrConfirmModal.onConfirm}
                className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-red-500/10"
              >
                {isRtl ? 'تأیید حذف' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Inline helper to locate IATF Clause meta for CSR card display
function getIatfRef(id: string): IATFClause | null {
  const find = (list: IATFClause[]): IATFClause | null => {
    for (const c of list) {
      if (c.id === id) return c;
      if (c.subClauses) {
        const res = find(c.subClauses);
        if (res) return res;
      }
    }
    return null;
  };
  return find(iatfData);
}
