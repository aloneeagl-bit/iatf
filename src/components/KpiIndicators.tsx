import React, { useState } from 'react';
import { Indicator, IndicatorRecord } from '../types';
import { Plus, Trash2, Calendar, Target, Activity, Award, Bookmark, ArrowUpRight, CheckCircle, Database, HelpCircle, Sparkles, Filter, Check, X, ArrowLeft } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, BarChart, Bar } from 'recharts';
import { documentTemplates } from '../data/documentTemplates';
import { QmsDatabase } from '../lib/qmsDatabase';

interface KpiIndicatorsProps {
  lang: 'fa' | 'en';
  onSelectClauseId: (clauseId: string) => void;
  indicators: Indicator[];
  setIndicators: React.Dispatch<React.SetStateAction<Indicator[]>>;
  updateDocKpiValue: (indicatorId: string, newValue: number) => void;
  onPinToDashboard?: () => void;
}

const evaluateFormula = (formulaStr: string, variables: Record<string, number>): number => {
  if (!formulaStr || !formulaStr.trim()) return 0;
  
  // Only allow uppercase letters, numbers, standard math operations, dots, whitespace, and parentheses
  let sanitized = formulaStr.replace(/[^A-Za-z0-9+\-*/().\s]/g, '');
  
  // Replace each variable letter (A-Z) with its numeric value
  const uppercaseLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < uppercaseLetters.length; i++) {
    const char = uppercaseLetters[i];
    if (sanitized.includes(char)) {
      const val = variables[char] !== undefined ? variables[char] : 0;
      sanitized = sanitized.split(char).join(val.toString());
    }
  }

  try {
    const fn = new Function(`return (${sanitized});`);
    const res = fn();
    return typeof res === 'number' && !isNaN(res) && isFinite(res) ? Number(res.toFixed(2)) : 0;
  } catch (err) {
    return 0;
  }
};

export interface GlobalVariable {
  char: string;
  nameFa: string;
  nameEn: string;
  value?: number;
  isFormulaResult?: boolean;
  relatedKpiId?: string;
  linkedDocName?: string;
  linkedCellInfo?: string;
}

export default function KpiIndicators({ lang, onSelectClauseId, indicators, setIndicators, updateDocKpiValue, onPinToDashboard }: KpiIndicatorsProps) {
  // Global mathematical variable registry state
  const [globalVariables, setGlobalVariables] = useState<GlobalVariable[]>(() => {
    try {
      const dbKpiVars = QmsDatabase.selectAll(QmsDatabase.TABLES.KPI_VARS);
      if (dbKpiVars && Object.keys(dbKpiVars).length > 0) {
        return Array.isArray(dbKpiVars) ? dbKpiVars : Object.values(dbKpiVars);
      }
      const saved = localStorage.getItem('iatf_kpi_global_vars');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const saveVariables = (newVars: GlobalVariable[]) => {
    setGlobalVariables(newVars);
    try {
      localStorage.setItem('iatf_kpi_global_vars', JSON.stringify(newVars));
      const recordSet: Record<string, any> = {};
      newVars.forEach((v, index) => {
        const id = v.char || `var-${index}`;
        recordSet[id] = { ...v, var_key: id, updatedAt: new Date().toISOString() };
      });
      QmsDatabase.writeAll(QmsDatabase.TABLES.KPI_VARS, recordSet);
    } catch {}
  };

  // DAG dynamic recursive formula evaluation engine
  const getVariableValue = (
    char: string, 
    gvList: GlobalVariable[],
    kpis: Indicator[],
    visited: string[] = []
  ): number => {
    if (visited.includes(char)) return 0; // Guard clause for recursion
    const gv = gvList.find(x => x.char === char);
    if (!gv) return 0;
    
    if (gv.isFormulaResult && gv.relatedKpiId) {
      const kpi = kpis.find(k => k.id === gv.relatedKpiId);
      if (kpi && kpi.formula) {
        const parsedMatches = kpi.formula.match(/[A-Z]/g) || [];
        const formulaVars = (parsedMatches as string[]).filter((v, i, self) => self.indexOf(v) === i);
        const subVariables: Record<string, number> = {};
        formulaVars.forEach(v => {
          subVariables[v] = getVariableValue(v, gvList, kpis, [...visited, char]);
        });
        return evaluateFormula(kpi.formula, subVariables);
      }
    }
    return gv.value !== undefined ? gv.value : 0;
  };

  // Auto-synchronize indicators that have formulas with the global registry table
  React.useEffect(() => {
    let changed = false;
    const updatedVars = [...globalVariables];
    
    // 1. Remove variables whose KPIs no longer exist or no longer have formulas
    const filteredVars = updatedVars.filter(gv => {
      if (gv.isFormulaResult && gv.relatedKpiId) {
        const kpi = indicators.find(k => k.id === gv.relatedKpiId);
        if (!kpi || !kpi.formula) {
          changed = true;
          return false;
        }
      }
      return true;
    });
    
    // 2. Insert or update dynamic variables for all active formulas
    indicators.forEach(kpi => {
      if (kpi.formula) {
        const hasVar = filteredVars.some(gv => gv.isFormulaResult && gv.relatedKpiId === kpi.id);
        if (!hasVar) {
          // Find first unused uppercase character
          const unusedLetter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(char => 
            !filteredVars.some(gv => gv.char === char)
          );
          if (unusedLetter) {
            filteredVars.push({
              char: unusedLetter,
              nameFa: `حاصل فرمول شاخص: ${kpi.titleFa}`,
              nameEn: `Formula result for KPI: ${kpi.titleEn}`,
              isFormulaResult: true,
              relatedKpiId: kpi.id
            });
            changed = true;
          }
        } else {
          const index = filteredVars.findIndex(gv => gv.isFormulaResult && gv.relatedKpiId === kpi.id);
          if (index !== -1) {
            const gv = filteredVars[index];
            const nameFa = `حاصل فرمول شاخص: ${kpi.titleFa}`;
            const nameEn = `Formula result for KPI: ${kpi.titleEn}`;
            if (gv.nameFa !== nameFa || gv.nameEn !== nameEn) {
              filteredVars[index] = { ...gv, nameFa, nameEn };
              changed = true;
            }
          }
        }
      }
    });
    
    if (changed) {
      const sorted = filteredVars.sort((a, b) => a.char.localeCompare(b.char));
      saveVariables(sorted);
    }
  }, [indicators]);

  const [showVarsTable, setShowVarsTable] = useState(false);
  
  // Adding new variable state
  const [newVarChar, setNewVarChar] = useState('');
  const [newVarNameFa, setNewVarNameFa] = useState('');
  const [newVarNameEn, setNewVarNameEn] = useState('');
  const [isAddingVar, setIsAddingVar] = useState(false);
  const [editingVarChar, setEditingVarChar] = useState<string | null>(null);
  const [editVarNameFa, setEditVarNameFa] = useState('');
  const [editVarNameEn, setEditVarNameEn] = useState('');

  // Advanced Math Formula configuration state
  const [formulaKpiId, setFormulaKpiId] = useState<string | null>(null);
  const [editingFormula, setEditingFormula] = useState('');
  const [editingVariableLabels, setEditingVariableLabels] = useState<Record<string, string>>({});

  // Inputs for variables when registering records: Record<kpiId, Record<variableName, string>>
  const [variableInputs, setVariableInputs] = useState<Record<string, Record<string, string>>>({});

  // Document Cell Dynamic Intersect / Linking states
  const [linkTargetVarChar, setLinkTargetVarChar] = useState<string | null>(null);
  const [showDocLinkerModal, setShowDocLinkerModal] = useState(false);
  const [selectedLinkingDocName, setSelectedLinkingDocName] = useState<string | null>(null);
  const [docSearchQuery, setDocSearchQuery] = useState('');

  // Read stored custom documents
  const getCustomDocuments = (): Record<string, any[]> => {
    try {
      const saved = localStorage.getItem('iatf_docs');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  };

  const getDocMetadata = (docName: string) => {
    const isFa = lang === 'fa';
    if (documentTemplates[docName]) {
      return documentTemplates[docName];
    }
    const customDocs = getCustomDocuments();
    const items = customDocs[docName] || [];
    
    let headers = [isFa ? 'فیلد ۱' : 'Field 1', isFa ? 'فیلد ۲' : 'Field 2', isFa ? 'فیلد ۳' : 'Field 3', isFa ? 'فیلد ۴' : 'Field 4'];
    if (items.length > 0 && items[0]) {
      const keys = Object.keys(items[0]).filter(k => k !== 'id' && !k.includes('connections') && !['x', 'y', 'processId'].includes(k));
      if (keys.length > 0) {
        headers = keys.map((k, i) => {
          if (k === 'field1') return isFa ? 'نام فرآیند/عنوان کاربری' : 'Name / User Title';
          if (k === 'field2') return isFa ? 'مشخصات ورودی/جزییات' : 'Inputs / Detail Specs';
          if (k === 'field3') return isFa ? 'خروجی فرآیند/محاسبه' : 'Outputs / Value';
          if (k === 'field4') return isFa ? 'شاخص فرآیند/حد هدف' : 'KPI / Target Objective';
          return isFa ? `شرح ویژگی ${i + 1}` : `Attribute ${i + 1}`;
        });
      }
    }
    
    return {
      title: docName,
      description: isFa ? 'سند تعریف شده جدید پروژه گام‌به‌گام QMS' : 'Newly defined project document for QMS compliance',
      smartType: 'Standard',
      headers: headers
    };
  };

  // Generate gorgeous realistic QMS sample items for any unpopulated table
  const getInteractiveItems = (docName: string): any[] => {
    const customDocs = getCustomDocuments();
    if (customDocs[docName] && customDocs[docName].length > 0) {
      return customDocs[docName];
    }
    
    // Check if the static templates has pre-populated items
    const tpl = documentTemplates[docName];
    if (tpl && tpl.items && tpl.items.length > 0) {
      return tpl.items;
    }
    
    // Fallback: Generate custom high-fidelity realistic datasets as objects mirroring the specific QMS document schema
    if (docName.includes('SWOT')) {
      return [
        { id: 'sw1', field1: 'S', field2: 'دانش فنی و کارآزمودگی بالای مهندسی فرآیند', weight: 0.15, rating: 9, field3: '0.15', field4: '9', field5: '1.35' },
        { id: 'sw2', field1: 'W', field2: 'فرسودگی خط تولید بدنه پشتی خودرو ساپکو', weight: 0.12, rating: 6, field3: '0.12', field4: '6', field5: '0.72' },
        { id: 'sw3', field1: 'O', field2: 'صادرات فعال قطعات تزریقی به کشورهای حوزه خلیج فارس', weight: 0.20, rating: 8, field3: '0.20', field4: '8', field5: '1.60' },
        { id: 'sw4', field1: 'T', field2: 'نوسانات ناگهانی ارز و تاخیر ترخیص فولاد گمرک بندرعباس', weight: 0.18, rating: 7, field3: '0.18', field4: '7', field5: '1.26' }
      ];
    } else if (docName.includes('DFMEA') || docName.includes('PFMEA')) {
      return [
        { id: 'me1', field1: 'ایستگاه تزریق پلاستیک / سنسور حرارت قالب', field2: 'نوسان مجرای خنک کاری دورانی قالب پلاستیک دژپاد', severity: 8, occurrence: 4, detection: 3, field3: '8', field4: '4', field5: '3', field6: '96' },
        { id: 'me2', field1: 'پرس هیدرولیک ۸۰۰ تن خط قطعات فلزی ساپکو', field2: 'انحراف گونیایی قالب کشش ورق گالوانیزه بدنه', severity: 9, occurrence: 3, detection: 5, field3: '9', field4: '3', field5: '5', field6: '135' },
        { id: 'me3', field1: 'توزین و تغذیه کامپاند مواد اولیه پلیمری بدنه', field2: 'کالیبره نبودن لودسل دیجیتال میکسر اتومات خمیر', severity: 7, occurrence: 2, detection: 4, field3: '7', field4: '2', field5: '4', field6: '56' }
      ];
    } else if (docName.includes('طرح کنترلی') || docName.includes('Control Plan')) {
      return [
        { id: 'cp1', field1: 'خط تریم نهایی تارا - ایستگاه بست پیچی', field2: 'گشتاور اعمالی آچار ترکمتر عقربه‌ای', field3: 'آچار سنجش ترکمتر کالیبره', actual: 44.5, target: 45.0, field4: '45.0', field5: '44.5' },
        { id: 'cp2', field1: 'کوره پخت رنگ الکترواستاتیک قطعات جانبی', field2: 'مدت زمان ماند قطعه در منطقه دمایی ۲۳۰ درجه', field3: 'ثبت کننده دمای پیوسته کوره', actual: 18.2, target: 18.0, field4: '18.0', field5: '18.2' },
        { id: 'cp3', field1: 'برش اتومات لوله اگزوز با ماشین لایزر', field2: 'قطر دهانه برش خورده دو لبه هدی', field3: 'میکرومتر تماسی سوزنی', actual: 35.02, target: 35.00, field4: '35.00', field5: '35.02' }
      ];
    } else if (docName.includes('توانمندی') || docName.includes('Cpk')) {
      return [
        { id: 'spc1', field1: 'قطر خارجی شفت رزوه شده سگدست پلتفرم شاهین', usl: 12.10, lsl: 11.90, field5: '12.02, 11.98, 12.05, 12.01, 11.99', actual: 1.45, field6: '1.45' },
        { id: 'spc2', field1: 'طول پین تراز اتصال لولای درب جلو خودرو ساین', usl: 45.20, lsl: 44.80, field5: '45.01, 44.95, 45.10, 44.98, 45.06', actual: 1.28, field6: '1.28' }
      ];
    } else if (docName.includes('ابعادی') || docName.includes('Dimensional')) {
      return [
        { id: 'dm1', field1: 'موقعیت نقشه سوراخ مرکزی سینی موتور D-A5', field2: '15.00', field3: '0.05', field4: '-0.05', field5: '15.02', field6: '0.02' },
        { id: 'dm2', field1: 'ضخامت ورق تقویتی ستون وسط خودرو شاهین C-B1', field2: '2.50', field3: '0.08', field4: '-0.08', field5: '2.44', field6: '-0.06' }
      ];
    } else if (docName.includes('سیستم اندازه‌گیری') || docName.includes('MSA')) {
      return [
        { id: 'msa1', field1: 'میکرومتر خارجی دیجیتال میتوتویو صدم‌دار', evValue: 0.02, avValue: 0.03, actual: 4.5, field2: '0.02', field3: '0.03', field4: '4.5%' },
        { id: 'msa2', field1: 'سایزسنج عمیق قطعه کار ساپکو با کالیبره سالانه', evValue: 0.12, avValue: 0.15, actual: 12.4, field2: '0.12', field3: '0.15', field4: '12.4%' }
      ];
    } else if (docName.includes('تایید غیابی') || docName.includes('PSW')) {
      return [
        { id: 'psw1', field1: 'خار نگه‌دارنده شیشه برقی پنل جلو شاهین', field2: 'Level 3', field3: 'تغییر هندسه قالب تزریق فریم', field4: '0.015', actual: 100, field5: 'تایید نهایی زنجیره تامین سایپا' }
      ];
    }
    
    // General fallback template records with numeric values
    return [
      { id: 'g1', field1: 'رکورد پایش عملکرد فر آیند خط ۱ تولید', field2: 'شرح عملکرد آزمایشی', actual: 85, target: 90, value: 550, field3: '550', field4: '90', field5: '85' },
      { id: 'g2', field1: 'رکورد پایش سنجش ایستگاه مونتاژ تریم نهایی ۲', field2: 'شرح کیفیت هدی بدنه', actual: 94, target: 95, value: 240, field3: '240', field4: '95', field5: '94' }
    ];
  };

  // Cross-reference cell cell data resolver
  const getCellValue = (item: any, colIndex: number, smartType?: string): { raw: any, numeric: number | null } => {
    let val: any = undefined;
    
    if (smartType === 'SWOT') {
      if (colIndex === 0) val = item.type || item.field1;
      else if (colIndex === 1) val = item.field2;
      else if (colIndex === 2) val = item.weight !== undefined ? item.weight : item.field3;
      else if (colIndex === 3) val = item.rating !== undefined ? item.rating : item.field4;
      else if (colIndex === 4) {
        const w = parseFloat(item.weight !== undefined ? item.weight : item.field3);
        const r = parseFloat(item.rating !== undefined ? item.rating : item.field4);
        val = (!isNaN(w) && !isNaN(r)) ? Number((w * r).toFixed(2)) : item.field5;
      }
    } else if (smartType === 'RISK') {
      if (colIndex === 0) val = item.field1;
      else if (colIndex === 1) val = item.field2;
      else if (colIndex === 2) val = item.severity !== undefined ? item.severity : item.field3;
      else if (colIndex === 3) val = item.occurrence !== undefined ? item.occurrence : item.field4;
      else if (colIndex === 4) val = item.detection !== undefined ? item.detection : item.field5;
      else if (colIndex === 5) {
        const s = parseInt(item.severity !== undefined ? item.severity : item.field3);
        const o = parseInt(item.occurrence !== undefined ? item.occurrence : item.field4);
        const d = parseInt(item.detection !== undefined ? item.detection : item.field5);
        val = (!isNaN(s) && !isNaN(o) && !isNaN(d)) ? s * o * d : item.field6;
      }
    } else if (smartType === 'CALIBRATION') {
      if (colIndex === 0) val = item.field1;
      else if (colIndex === 2) val = item.refValue !== undefined ? item.refValue : item.field3;
      else if (colIndex === 3) val = item.readValue !== undefined ? item.readValue : item.field4;
      else if (colIndex === 4) val = item.mpe !== undefined ? item.mpe : item.field5;
      else if (colIndex === 5) {
        const ref = parseFloat(item.refValue !== undefined ? item.refValue : item.field3);
        const read = parseFloat(item.readValue !== undefined ? item.readValue : item.field4);
        val = (!isNaN(ref) && !isNaN(read)) ? Number((read - ref).toFixed(4)) : item.field6;
      }
    } else if (smartType === 'MSA') {
      if (colIndex === 0) val = item.field1;
      else if (colIndex === 1) val = item.evValue !== undefined ? item.evValue : item.field2;
      else if (colIndex === 2) val = item.avValue !== undefined ? item.avValue : item.field3;
      else if (colIndex === 3) {
        const ev = parseFloat(item.evValue !== undefined ? item.evValue : item.field2);
        const av = parseFloat(item.avValue !== undefined ? item.avValue : item.field3);
        val = (!isNaN(ev) && !isNaN(av)) ? Number(Math.sqrt(ev*ev + av*av).toFixed(2)) : item.field4;
      }
    } else if (smartType === 'SPC') {
      if (colIndex === 0) val = item.field1;
      else if (colIndex === 1) val = item.usl !== undefined ? item.usl : item.field2;
      else if (colIndex === 2) val = item.lsl !== undefined ? item.lsl : item.field3;
      else if (colIndex === 3) val = item.field5; // measurements
      else if (colIndex === 5) val = item.actual !== undefined ? item.actual : item.field6;
    } else {
      const fieldKeys = ['field1', 'field2', 'field3', 'field4', 'field5', 'field6', 'field7'];
      val = item[fieldKeys[colIndex]] !== undefined ? item[fieldKeys[colIndex]] : 
            (item.actual !== undefined && colIndex === 4 ? item.actual : 
            (item.target !== undefined && colIndex === 3 ? item.target : undefined));
    }
    
    if (val === undefined) {
      if (colIndex === 3 && item.target !== undefined) val = item.target;
      else if (colIndex === 4 && item.actual !== undefined) val = item.actual;
      else if (colIndex === 4 && item.value !== undefined) val = item.value;
    }

    let num: number | null = null;
    if (val !== undefined && typeof val !== 'boolean') {
      // Remove Farsi numbers / commas/ percent signs / etc for flawless parsing
      const cleaned = String(val)
        .replace(/[\u0660-\u0669\u06f0-\u06f9]/g, d => String(d.charCodeAt(0) & 15)) // convert Persian/Arabic digits
        .replace(/[^0-9.-]/g, '');
      const p = parseFloat(cleaned);
      if (!isNaN(p)) {
        num = p;
      }
    }
    
    return { raw: val, numeric: num };
  };

  // Custom new indicator form state
  const [isAdding, setIsAdding] = useState(false);
  const [newTitleFa, setNewTitleFa] = useState('');
  const [newTitleEn, setNewTitleEn] = useState('');
  const [newType, setNewType] = useState<'process' | 'quality_objective'>('process');
  const [newClauseId, setNewClauseId] = useState('9.1.1.1');
  const [newTarget, setNewTarget] = useState(85);
  const [newUnit, setNewUnit] = useState('%');

  // Input states for registering new record points on existing indicators
  const [newRecordPeriod, setNewRecordPeriod] = useState<Record<string, string>>({});
  const [newRecordValue, setNewRecordValue] = useState<Record<string, string>>({});
  const [newRecordIsArchived, setNewRecordIsArchived] = useState<Record<string, boolean>>({});

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

  const isFa = lang === 'fa';

  const handleAddIndicator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitleFa.trim() || !newTitleEn.trim()) return;

    const newKpi: Indicator = {
      id: `kpi-${Date.now()}`,
      type: newType,
      titleFa: newTitleFa.trim(),
      titleEn: newTitleEn.trim(),
      clauseId: newClauseId.trim(),
      target: newTarget,
      unit: newUnit.trim(),
      records: []
    };

    setIndicators(prev => [...prev, newKpi]);
    setNewTitleFa('');
    setNewTitleEn('');
    setNewClauseId('9.1.1.1');
    setNewTarget(100);
    setNewUnit('%');
    setIsAdding(false);
  };

  const handleDeleteIndicator = (id: string) => {
    if (id.startsWith("doc-")) {
      alert(isFa 
        ? "این شاخص مستقیماً از اسناد سیستمی (مانند شناسنامه فرآیندها یا اهداف کیفی) تعریف شده است. جهت حذف، ردیف مربوطه را در آن سند حذف کنید." 
        : "This metric is synced from system documents (e.g. process specifies / objectives). To delete it, please remove its row in that document.");
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: isFa ? "🗑️ حذف شاخص پایش" : "🗑️ Delete Monitoring Indicator",
      message: isFa ? "آیا از حذف این شاخص پایش اطمینان دارید؟ تغییرات بلافاصله ذخیره می‌شوند." : "Are you sure you want to delete this monitoring indicator? Changes will be updated immediately.",
      onConfirm: () => {
        setIndicators(prev => prev.filter(ind => ind.id !== id));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAddNewRecord = (indId: string) => {
    const period = newRecordPeriod[indId]?.trim();
    if (!period) return;

    const ind = indicators.find(i => i.id === indId);
    if (!ind) return;

    let value = 0;
    let variableValsToSave: Record<string, number> = {};

    if (ind.formula) {
      const parsedMatches = ind.formula.match(/[A-Z]/g) || [];
      const vars = (parsedMatches as string[]).filter((v, i, self) => self.indexOf(v) === i).sort();
      const variablesEval: Record<string, number> = {};
      
      vars.forEach(v => {
        variablesEval[v] = getVariableValue(v, globalVariables, indicators);
      });
      
      value = evaluateFormula(ind.formula, variablesEval);
      variableValsToSave = variablesEval;
    } else {
      const valStr = newRecordValue[indId];
      if (!valStr) return;
      value = parseFloat(valStr);
      if (isNaN(value)) return;
    }

    const isArchived = !!newRecordIsArchived[indId];

    setIndicators(prev => prev.map(item => {
      if (item.id === indId) {
        const newRec: IndicatorRecord & { variableValues?: Record<string, number> } = { 
          period, 
          value, 
          isArchived,
          variableValues: Object.keys(variableValsToSave).length > 0 ? variableValsToSave : undefined
        };
        return {
          ...item,
          records: [
            ...item.records,
            newRec
          ]
        };
      }
      return item;
    }));

    if (!isArchived) {
      updateDocKpiValue(indId, value);
    }

    setNewRecordPeriod(prev => ({ ...prev, [indId]: '' }));
    setNewRecordValue(prev => ({ ...prev, [indId]: '' }));
    setNewRecordIsArchived(prev => ({ ...prev, [indId]: false }));
    setVariableInputs(prev => {
      const copy = { ...prev };
      delete copy[indId];
      return copy;
    });
  };

  const handleToggleRecordArchive = (indId: string, period: string) => {
    setIndicators(prev => prev.map(ind => {
      if (ind.id === indId) {
        return {
          ...ind,
          records: ind.records.map(r => r.period === period ? { ...r, isArchived: !r.isArchived } : r)
        };
      }
      return ind;
    }));
  };

  const handleDeleteRecord = (indId: string, period: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmModal({
      isOpen: true,
      title: isFa ? "🗑️ حذف رکورد داده" : "🗑️ Delete Record Point",
      message: isFa ? `آیا از حذف داده دوره "${period}" اطمینان دارید؟` : `Are you sure you want to delete the data point for period "${period}"?`,
      onConfirm: () => {
        setIndicators(prev => prev.map(ind => {
          if (ind.id === indId) {
            return {
              ...ind,
              records: ind.records.filter(r => r.period !== period)
            };
          }
          return ind;
        }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const filteredIndicators = indicators;

  const selectedValueBinding = (numericValue: number, headerName: string, rowIndex: number) => {
    if (!linkTargetVarChar) return;
    const docTitleTrunc = selectedLinkingDocName ? selectedLinkingDocName.substring(0, 15) : '';
    const updated = globalVariables.map(item => {
      if (item.char === linkTargetVarChar) {
        return {
          ...item,
          value: numericValue,
          linkedDocName: selectedLinkingDocName || undefined,
          linkedCellInfo: `${docTitleTrunc}... (${isFa ? "ردیف" : "Row"} ${rowIndex + 1} - ${headerName.substring(0, 10)})`
        };
      }
      return item;
    });
    saveVariables(updated);
    
    // Close modal & reset linking state
    setShowDocLinkerModal(false);
    setLinkTargetVarChar(null);
    setSelectedLinkingDocName(null);
  };

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full pb-12 font-sans">
      {/* Dashboard Headline card */}
      <div className="bg-[#111113] p-6 rounded-2xl border border-[#2D2D31] flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center rounded-xl">
            <Activity size={24} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white flex items-center gap-2">
              <span>{isFa ? "داشبورد هوشمند پایش شاخص‌های عملکرد پایانه" : "QMS Performance & Measurement Indicators Portal"}</span>
              {onPinToDashboard && (
                <button
                  type="button"
                  onClick={onPinToDashboard}
                  className="text-amber-500 hover:text-amber-400 p-1 transition-all select-none text-xs sm:text-sm cursor-pointer ml-1 animate-pulse"
                  title={isFa ? 'پین به داشبورد ابزار IATF' : 'Pin to IATF Tools Dashboard'}
                >
                  📌
                </button>
              )}
              <span className="text-[9px] bg-amber-500/20 text-amber-500 border border-amber-500/30 px-1.5 py-0.5 rounded font-extrabold uppercase select-none">
                {isFa ? "پایش زنده اسناد سیستمی" : "LIVE SYSTEM SYNC"}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              {isFa 
                ? "ارزیابی، تحلیل و بایگانی شاخص‌های عملکردی استخراج‌شده از شناسنامه فرآیندها (بند 4.4) و سوابق اهداف کیفی و برنامه‌های دستیابی (بند 6.2)."
                : "Evaluation, analysis, and archiving of performance metrics extracted from Process Cards (Clause 4.4) and QMS Quality Objectives (Clause 6.2)."}
            </p>
          </div>
        </div>
      </div>

      {/* Unified Variables Definition Registry Table Space */}
      <div className="bg-[#111113] p-4 rounded-xl border border-[#232326] flex flex-col gap-3 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20 font-mono text-sm font-black">
              ±x
            </div>
            <div>
              <h3 className="text-xs font-extrabold text-white flex items-center gap-2">
                {isFa ? "جدول یکتا و مرجع تعریف متغیرهای فرمول‌نویسی" : "Unified Formula Variables Reference Table"}
                <span className="text-[9px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-1 rounded font-normal font-sans">
                  {isFa ? "تضمین یکتایی متغیرها" : "Strict Uniqueness"}
                </span>
              </h3>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {isFa 
                  ? "متغیرهای ریاضی (A-Z) را در این جدول یکبار تعریف کنید تا در کل فرمول‌های پایش به صورت هماهنگ قابل انتخاب و استفاده باشند." 
                  : "Define all active algebraic symbols here to insert them easily and keep formulas unified across QMS."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowVarsTable(!showVarsTable)}
            className="bg-[#18181B] hover:bg-[#202024] text-amber-500 hover:text-amber-400 border border-[#2D2D31] text-[10px] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
          >
            <span>{showVarsTable ? (isFa ? "بستن جدول" : "Hide Registry") : (isFa ? "مشاهده و مدیریت جدول متغیرها" : "Open Variable Registry")}</span>
            <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.2 rounded font-black">{globalVariables.length}</span>
          </button>
        </div>

        {showVarsTable && (
          <div className="border-t border-[#1C1C1F] pt-4 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400">
                {isFa ? "لیست متغیرهای ریاضی تعریف شده:" : "Registered Math Variables:"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAddingVar(!isAddingVar);
                  // Find next unused letter from A-Z
                  const nextChar = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find(c => !globalVariables.some(gv => gv.char === c)) || 'A';
                  setNewVarChar(nextChar);
                  setNewVarNameFa('');
                  setNewVarNameEn('');
                }}
                className="bg-amber-500 hover:bg-amber-400 text-black text-[9px] font-extrabold px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1"
              >
                <Plus size={11} strokeWidth={3} />
                <span>{isFa ? "برچسب متغیر جدید" : "Create Variable"}</span>
              </button>
            </div>

            {/* Form to add a new variable */}
            {isAddingVar && (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newVarChar || !newVarNameFa.trim() || !newVarNameEn.trim()) return;
                  if (globalVariables.some(gv => gv.char === newVarChar)) {
                    alert(isFa ? "این شناسه متغیر قبلاً تعریف شده است." : "Variable symbol already defined.");
                    return;
                  }
                  const updated = [...globalVariables, { char: newVarChar, nameFa: newVarNameFa.trim(), nameEn: newVarNameEn.trim() }]
                    .sort((a,b) => a.char.localeCompare(b.char));
                  saveVariables(updated);
                  setIsAddingVar(false);
                  setNewVarNameFa('');
                  setNewVarNameEn('');
                }}
                className="p-3 bg-[#161619] border border-amber-500/20 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3 items-end animate-fadeIn"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-[8px] text-[#A78BFA] font-extrabold uppercase">{isFa ? "نماد متغیر (ریاضی انگلیسی):" : "Variable char (A-Z):"}</label>
                  <select
                    value={newVarChar}
                    onChange={(e) => setNewVarChar(e.target.value)}
                    className="bg-[#0A0A0C] border border-[#2D2D31] text-[10px] text-white rounded-lg px-2 py-1.5 focus:border-amber-500 outline-none cursor-pointer font-mono"
                  >
                    {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(c => {
                      const taken = globalVariables.some(gv => gv.char === c);
                      return (
                        <option key={c} value={c} disabled={taken}>
                          {c} {taken ? (isFa ? " (استفاده شده)" : " (In use)") : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="flex flex-col gap-1 col-span-1 md:col-span-1">
                  <label className="text-[8px] text-zinc-400 font-bold">{isFa ? "شرح متغیر (فارسی):" : "Persian description:"}</label>
                  <input
                    type="text"
                    required
                    placeholder={isFa ? "مثلاً: کل تناژ بارگیری شده" : "e.g. Total tonnage"}
                    value={newVarNameFa}
                    onChange={(e) => setNewVarNameFa(e.target.value)}
                    className="bg-[#0A0A0C] border border-[#2D2D31] text-[10px] text-white rounded-lg px-2.5 py-1.5 focus:border-amber-500 outline-none"
                  />
                </div>

                <div className="flex flex-col gap-1 col-span-1 md:col-span-1">
                  <label className="text-[8px] text-zinc-400 font-bold">{isFa ? "شرح متغیر (انگلیسی):" : "English description:"}</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Total Loaded Tonnage"
                    value={newVarNameEn}
                    onChange={(e) => setNewVarNameEn(e.target.value)}
                    className="bg-[#0A0A0C] border border-[#2D2D31] text-[10px] text-white rounded-lg px-2.5 py-1.5 focus:border-amber-500 outline-none text-left font-mono"
                    style={{ direction: 'ltr' }}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="flex-1 bg-amber-500 hover:bg-amber-400 text-black text-[10px] font-extrabold h-8 rounded-lg cursor-pointer transition-all"
                  >
                    {isFa ? "ثبت و تایید" : "Confirm & Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddingVar(false)}
                    className="px-2 text-[10px] text-slate-400 hover:text-slate-300 h-8 cursor-pointer"
                  >
                    {isFa ? "انصراف" : "Cancel"}
                  </button>
                </div>
              </form>
            )}

            {/* Table layout of declared variables */}
            <div className="overflow-x-auto border border-[#1E1E22] rounded-xl bg-[#08080A]">
              <table className="w-full text-right border-collapse text-[11px]">
                <thead>
                  <tr className="bg-[#111113] border-b border-[#1E1E22]">
                    <th className="p-2 font-black text-slate-400 text-center w-20">{isFa ? "شناسه ریاضی" : "Algebraic ID"}</th>
                    <th className="p-2 font-bold text-slate-400">{isFa ? "عنوان و شرح فارسی" : "Farsi definition"}</th>
                    <th className="p-2 font-bold text-slate-400 text-left">{isFa ? "عنوان و شرح انگلیسی" : "English definition"}</th>
                    <th className="p-2 font-bold text-slate-400 text-center w-36">{isFa ? "مقدار جاری متغیر" : "Current Value"}</th>
                    <th className="p-2 font-bold text-slate-400 text-center w-28">{isFa ? "عملیات تصحیح" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {globalVariables.map(gv => {
                    const isEditing = editingVarChar === gv.char;
                    return (
                      <tr key={gv.char} className="border-b border-[#151518]/60 hover:bg-white/[0.01] transition-all">
                        <td className="p-2 text-center bg-amber-500/[0.01]">
                          <span className="inline-block w-6 h-6 rounded bg-amber-500/10 border border-amber-500/20 leading-6 text-center text-[11px] font-black font-mono text-amber-500">
                            {gv.char}
                          </span>
                        </td>
                        
                        <td className="p-2 text-slate-200">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editVarNameFa}
                              onChange={(e) => setEditVarNameFa(e.target.value)}
                              className="w-full bg-[#161619] border border-[#2D2D31] text-[11px] px-2 py-1 rounded text-white focus:border-amber-500 outline-none"
                            />
                          ) : (
                            <span>{gv.nameFa}</span>
                          )}
                        </td>

                        <td className="p-2 text-slate-300 text-left font-sans">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editVarNameEn}
                              onChange={(e) => setEditVarNameEn(e.target.value)}
                              className="w-full bg-[#161619] border border-[#2D2D31] text-[11px] px-2 py-1 rounded text-white focus:border-amber-500 outline-none text-left"
                              style={{ direction: 'ltr' }}
                            />
                          ) : (
                            <span>{gv.nameEn}</span>
                          )}
                        </td>

                        {/* Real-time editable or computed value */}
                        <td className="p-2 text-center bg-[#0C0C0E]">
                          {gv.isFormulaResult ? (
                            (() => {
                              const calculatedVal = getVariableValue(gv.char, globalVariables, indicators);
                              return (
                                <div className="flex items-center gap-1 justify-center">
                                  <span className="text-[10px] font-mono font-black text-[#A78BFA] bg-[#A78BFA]/10 border border-[#A78BFA]/20 px-2 py-0.5 rounded-md min-w-[36px] inline-block text-center select-all">
                                    {calculatedVal}
                                  </span>
                                  <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">{isFa ? "(فرمول)" : "(Formula)"}</span>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="flex flex-col items-center gap-1 justify-center py-1">
                              <input
                                type="number"
                                step="any"
                                value={gv.value !== undefined ? gv.value : ''}
                                placeholder="0"
                                onChange={(e) => {
                                  const revisedVal = parseFloat(e.target.value);
                                  const updated = globalVariables.map(item => {
                                    if (item.char === gv.char) {
                                      return { 
                                        ...item, 
                                        value: isNaN(revisedVal) ? 0 : revisedVal,
                                        // clear link info on manual over-write
                                        linkedDocName: undefined,
                                        linkedCellInfo: undefined
                                      };
                                    }
                                    return item;
                                  });
                                  saveVariables(updated);
                                }}
                                className="w-24 bg-[#0A0A0C] border border-[#232326] text-[11px] text-center py-1 rounded text-amber-500 font-mono focus:border-amber-500 outline-none hover:border-amber-500/20"
                              />
                              
                              <button
                                type="button"
                                onClick={() => {
                                  setLinkTargetVarChar(gv.char);
                                  setShowDocLinkerModal(true);
                                  setSelectedLinkingDocName(null);
                                }}
                                className="flex items-center gap-1.5 px-2 py-0.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:text-purple-300 text-[8.5px] rounded font-bold cursor-pointer transition-all shrink-0"
                              >
                                <Database size={10} className="text-purple-400 animate-pulse" />
                                <span>{isFa ? "دریافت از سند" : "Pull from Doc"}</span>
                              </button>

                              {/* Linked document label display */}
                              {gv.linkedDocName && (
                                <div 
                                  className="text-[7.5px] text-purple-400 bg-purple-500/5 border border-purple-500/10 px-1 py-0.5 rounded max-w-[105px] truncate font-sans text-center mt-0.5 leading-none"
                                  title={`${gv.linkedDocName}\n${gv.linkedCellInfo}`}
                                >
                                  {gv.linkedCellInfo ? `✓ ${gv.linkedCellInfo}` : "✓ متصل"}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {gv.isFormulaResult ? (
                              <span className="text-[8px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded font-black uppercase select-none">
                                {isFa ? "پیوند زنده سیستمی" : "Live Linked"}
                              </span>
                            ) : isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!editVarNameFa.trim() || !editVarNameEn.trim()) return;
                                    const updated = globalVariables.map(item => {
                                      if (item.char === gv.char) {
                                        return { ...item, nameFa: editVarNameFa.trim(), nameEn: editVarNameEn.trim() };
                                      }
                                      return item;
                                    });
                                    saveVariables(updated);
                                    setEditingVarChar(null);
                                  }}
                                  className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[9px] font-bold px-1.5 py-0.5 rounded cursor-pointer"
                                >
                                  {isFa ? "ذخیره" : "Save"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingVarChar(null)}
                                  className="text-slate-400 hover:text-slate-300 text-[9px]"
                                >
                                  {isFa ? "انصراف" : "Cancel"}
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingVarChar(gv.char);
                                    setEditVarNameFa(gv.nameFa);
                                    setEditVarNameEn(gv.nameEn);
                                  }}
                                  className="text-amber-500/80 hover:text-amber-400 text-[10px] font-bold cursor-pointer"
                                >
                                  {isFa ? "ویرایش" : "Edit"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmModal({
                                      isOpen: true,
                                      title: isFa ? '🗑️ حذف متغیر' : '🗑️ Delete Variable',
                                      message: isFa 
                                        ? `آیا از حذف متغیر "${gv.char}" اطمینان دارید؟` 
                                        : `Are you sure you want to delete variable "${gv.char}"?`,
                                      onConfirm: () => {
                                        const updated = globalVariables.filter(item => item.char !== gv.char);
                                        saveVariables(updated);
                                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                      }
                                    });
                                  }}
                                  className="text-red-500 hover:text-red-400 text-[10px] font-bold cursor-pointer"
                                >
                                  {isFa ? "حذف" : "Delete"}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Indicator Bento Grid List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredIndicators.length === 0 ? (
          <div className="col-span-full p-12 bg-[#111113] border border-dashed border-[#2D2D31] rounded-2xl text-center text-slate-500 text-xs flex flex-col items-center gap-2">
            <Activity size={32} className="text-slate-600 animate-pulse" />
            <span>
              {isFa 
                ? "هیچ شاخصی مشخص و تراز‌شده‌ای در این فیلتر یافت نشد." 
                : "No mapped quality indicators found in this segment."}
            </span>
          </div>
        ) : (
          filteredIndicators.map((ind) => {
            const isOee = ind.titleFa.includes("OEE");
            const hasData = ind.records.length > 0;
            const currentRecord = hasData ? ind.records[ind.records.length - 1] : null;
            const archivedRecords = ind.records.filter(r => r.isArchived);
            const activeRecords = ind.records.filter(r => !r.isArchived);

            return (
              <div 
                key={ind.id} 
                className="bg-[#111113] border border-[#232326] rounded-2xl p-5 flex flex-col gap-4 shadow-lg hover:border-[#2D2D31] transition-all relative overflow-hidden group"
              >
                {/* Background ambient badge */}
                <span className="absolute top-0 right-0 py-1.5 px-3 bg-amber-500/10 text-amber-500 text-[8px] font-extrabold uppercase rounded-bl-xl tracking-wider select-none font-sans">
                  {ind.type === 'process' 
                    ? (isFa ? "شاخص فرآیندی (بند ۴.۴)" : "Process KPI (4.4)") 
                    : (isFa ? "هدف کیفی (بند ۶.۲)" : "Quality Objective (6.2)")}
                </span>

                {/* KPI Core Metadata */}
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 max-w-[85%]">
                      <div className="p-1 px-1.5 bg-[#1B1B1F] border border-[#2D2D31] text-amber-500 font-bold rounded-lg text-[10px] font-mono shrink-0 select-none">
                        {ind.clauseId}
                      </div>
                      <div className="flex flex-col gap-1">
                        <h2 className="text-xs font-extrabold text-white line-clamp-1">
                          {isFa ? ind.titleFa : ind.titleEn}
                        </h2>
                        {ind.id.startsWith("doc-") && (
                          <span className="text-[9px] text-[#A78BFA] font-black uppercase tracking-wider flex items-center gap-1 bg-[#8B5CF6]/10 border border-[#8B5CF6]/20 px-1.5 py-0.5 rounded w-fit select-none font-sans mt-0.5">
                            <Database size={10} className="text-[#A78BFA]" />
                            <span>{isFa ? `پیوند با سند: ${ind.id.split("-")[1]}` : `Linked: ${ind.id.split("-")[1]}`}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => onSelectClauseId(ind.clauseId)}
                      className="p-1 px-2 border border-amber-500/30 bg-amber-500/5 text-amber-500 hover:bg-amber-500 text-slate-200 hover:text-black rounded-lg transition-all cursor-pointer shrink-0 text-[9px] font-bold flex items-center gap-1"
                      title={isFa ? "ویرایش و مدیریت در سند منبع" : "Edit and manage in source document"}
                    >
                      <span>{isFa ? "ویرایش سند منبع" : "Edit Source"}</span>
                      <ArrowUpRight size={10} />
                    </button>
                  </div>

                  <div className="flex items-center gap-3 mt-3 text-[10px]">
                    <div className="flex items-center gap-1 text-slate-400">
                      <Target size={11} className="text-amber-500/80" />
                      <span>{isFa ? "تارگت توافقی:" : "Target limit:"}</span>
                      <strong className="text-white font-mono">{ind.target} {ind.unit}</strong>
                    </div>

                    <button 
                      onClick={() => onSelectClauseId(ind.clauseId)}
                      className="text-[10px] text-amber-500 hover:text-amber-400 font-bold hover:underline flex items-center gap-0.5"
                    >
                      <span>{isFa ? "مشاهده فرجام بند" : "Inspect subclause"}</span>
                      <ArrowUpRight size={10} />
                    </button>
                  </div>

                  {/* Formula configuration panel toggle and display */}
                  <div className="mt-3.5 pt-3 border-t border-[#1E1E22] flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-slate-400 text-[10px] flex-wrap max-w-[70%]">
                        <Sparkles size={11} className="text-amber-500 shrink-0" />
                        <span>{isFa ? "فرمول پایش:" : "Calculation Formula:"}</span>
                        {ind.formula ? (
                          <code className="bg-[#1B1B1F] border border-[#2D2D31] text-amber-500 font-mono px-1.5 py-0.5 rounded text-[9px] tracking-wider select-all">
                            {ind.formula}
                          </code>
                        ) : (
                          <span className="text-slate-600 italic text-[9px]">{isFa ? "تعریف نشده (ورودی دستی)" : "Not defined (Manual input)"}</span>
                        )}
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          if (formulaKpiId === ind.id) {
                            setFormulaKpiId(null);
                          } else {
                            setFormulaKpiId(ind.id);
                            setEditingFormula(ind.formula || '');
                            setEditingVariableLabels(ind.variableLabels || {});
                          }
                        }}
                        className="text-[9px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 bg-[#161619] px-2 py-1 rounded border border-[#2A2A2E] cursor-pointer"
                      >
                        <span>{isFa ? "🧮 فرمول‌نویسی" : "🧮 Math Formula"}</span>
                      </button>
                    </div>

                    {/* Formula Editor Panel inside card */}
                    {formulaKpiId === ind.id && (
                      <div className="bg-[#16161A] border border-amber-500/20 rounded-xl p-4 mt-2 flex flex-col gap-4 animate-fadeIn">
                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] text-zinc-200 font-extrabold flex items-center gap-1">
                            <Sparkles size={11} className="text-amber-500" />
                            <span>{isFa ? "فرمول محاسباتی فعال شاخص (تایپ حروف انگلیسی مسدود است):" : "Active Indicator Calculation Formula (Letters typing is blocked):"}</span>
                          </label>
                          <input
                            type="text"
                            value={editingFormula}
                            onChange={(e) => {
                              const raw = e.target.value.toUpperCase();
                              // Strip ALL alphabetical letter characters, preventing keyboard typing of variables.
                              const filtered = raw.replace(/[A-Z]/g, '');
                              setEditingFormula(filtered);
                            }}
                            placeholder="e.g. (A - B) / A * 100"
                            className="bg-[#0A0A0C] border border-[#323236] rounded-lg px-2.5 py-2 text-xs text-amber-400 outline-none font-mono focus:border-amber-500 text-left tracking-widest font-black"
                            style={{ direction: 'ltr' }}
                          />
                          <p className="text-[9px] text-amber-500/80 leading-relaxed mt-1 font-semibold">
                            {isFa 
                              ? "💡 ورود مستقیم حروف مسدود است. به جهت یکتایی فرمول‌ها، نماد متغیرها را فقط با کلیک روی دکمه‌های متغیرهای تعریف شده در پایین درج کنید (اعداد و نمادهای ریاضی قابل تایپ هستند)." 
                              : "💡 Direct variable characters typing is blocked. To preserve formula integrity, please insert variable characters ONLY by clicking the buttons under the reference list below."}
                          </p>
                        </div>

                        {/* Quick insert helper panel */}
                        <div className="bg-[#0D0D10] border border-[#202024] rounded-xl p-3 flex flex-col gap-2.5">
                          <span className="text-[9px] text-amber-400 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles size={11} className="text-amber-500" strokeWidth={2.5} />
                            <span>{isFa ? "سکو هوشمند درج فوری متغیرهای یکتا بر اساس جدول مرجع" : "One-Click Variable Selection Pad"}</span>
                          </span>
                          
                          {/* Variables Quick Select */}
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[8.5px] text-zinc-400 font-bold">{isFa ? "کلیک برای افزودن متغیر به فرمول نویسی:" : "Click to insert a registered variable character:"}</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                              {globalVariables.map(gv => (
                                <button
                                  type="button"
                                  key={gv.char}
                                  onClick={() => setEditingFormula(prev => prev + gv.char)}
                                  className="flex items-center gap-2 bg-[#161619] hover:bg-amber-500 hover:text-black border border-[#2A2A2E] hover:border-amber-500 p-2 text-right rounded-lg transition-all text-[10px] group cursor-pointer"
                                >
                                  <span className="w-5 h-5 bg-amber-500/10 group-hover:bg-black/15 text-amber-400 group-hover:text-black font-mono text-[10px] font-black rounded border border-amber-500/20 group-hover:border-transparent shrink-0 flex items-center justify-center">
                                    {gv.char}
                                  </span>
                                  <span className="text-slate-300 font-medium truncate group-hover:text-neutral-900 pr-1" title={isFa ? gv.nameFa : gv.nameEn}>{isFa ? gv.nameFa : gv.nameEn}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Standard operators quick deck */}
                          <div className="flex flex-col gap-1.5 mt-1 border-t border-[#1C1C20] pt-2">
                            <span className="text-[8.5px] text-zinc-400 font-bold">{isFa ? "عملگرهای آماده محاسباتی:" : "Add math operators & numbers:"}</span>
                            <div className="flex flex-wrap gap-1.5">
                              {['+', '-', '*', '/', '(', ')', '100'].map(op => (
                                <button
                                  type="button"
                                  key={op}
                                  onClick={() => setEditingFormula(prev => prev + op)}
                                  className="px-3 py-1 bg-[#161619] hover:bg-zinc-800 text-slate-300 hover:text-white rounded-lg border border-[#2D2D31] text-[10px] font-mono font-bold cursor-pointer transition-all"
                                >
                                  {op}
                                </button>
                              ))}
                              <button
                                type="button"
                                onClick={() => setEditingFormula('')}
                                className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg border border-red-500/20 text-[9px] font-bold cursor-pointer transition-all mr-auto"
                              >
                                {isFa ? "پاک کردن کل فرمول" : "Clear Formula"}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Variables configuration list */}
                        {editingFormula.match(/[A-Z]/g) && (
                          <div className="flex flex-col gap-2 mt-1">
                            <span className="text-[9px] text-[#A78BFA] font-bold uppercase tracking-wider">{isFa ? "بررسی برچسب متغیرهای شناسایی شده در فرمول:" : "Analyze detected algebraic symbols labels:"}</span>
                            <div className="grid grid-cols-1 gap-1.5">
                              {((editingFormula.match(/[A-Z]/g) || []) as string[]).filter((v, i, self) => self.indexOf(v) === i).sort().map(char => {
                                const globalVar = globalVariables.find(gv => gv.char === char);
                                return (
                                  <div key={char} className="flex flex-col gap-1 text-[10px] bg-[#0A0A0C] p-2 rounded-lg border border-[#202024]">
                                    <div className="flex items-center gap-2">
                                      <span className="w-5 h-5 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono rounded flex items-center justify-center shrink-0 text-[10px] font-black">{char}</span>
                                      {globalVar ? (
                                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                                          ✓ {isFa ? `شناسایی هماهنگ از جدول مرجع: ${globalVar.nameFa}` : `Match in reference table: ${globalVar.nameEn}`}
                                        </span>
                                      ) : (
                                        <span className="text-amber-500 italic">
                                          ⚠ {isFa ? "تعریف نشده در جدول مرجع متغیرها (نیاز به تعریف محلی یا اضافه کردن به جدول)" : "Not defined in reference table"}
                                        </span>
                                      )}
                                    </div>
                                    {!globalVar && (
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] text-zinc-500">{isFa ? "شرح محلی و موقت:" : "Local temporary description:"}</span>
                                        <input
                                          type="text"
                                          placeholder={isFa ? `شرح برای متغیر ${char}` : `Label for variable ${char}`}
                                          value={editingVariableLabels[char] || ''}
                                          onChange={(e) => {
                                            const labelVal = e.target.value;
                                            const variableKey = char;
                                            setEditingVariableLabels(prev => {
                                              const next = { ...prev };
                                              next[variableKey] = labelVal;
                                              return next;
                                            });
                                          }}
                                          className="flex-1 bg-[#161619] border border-[#2E2E33] rounded px-2 py-0.5 text-[10px] text-white outline-none focus:border-amber-500/50"
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 mt-1 pt-2 border-t border-[#26262B]">
                          <button
                            type="button"
                            onClick={() => setFormulaKpiId(null)}
                            className="px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-300 rounded cursor-pointer"
                          >
                            {isFa ? "انصراف" : "Cancel"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIndicators(prev => prev.map(item => {
                                if (item.id === ind.id) {
                                  return {
                                    ...item,
                                    formula: editingFormula.trim() || undefined,
                                    variableLabels: Object.keys(editingVariableLabels).length > 0 ? editingVariableLabels : undefined
                                  };
                                }
                                return item;
                              }));
                              setFormulaKpiId(null);
                            }}
                            className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-3 py-1.5 text-[10px] rounded-lg transition-all cursor-pointer"
                          >
                            {isFa ? "ذخیره نهایی فرمول" : "Save Formula"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Custom Chart View */}
                <div className="h-44 w-full bg-[#0A0A0C] border border-[#1E1E22] rounded-xl p-2 relative flex items-center justify-center">
                  {hasData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      {ind.id.includes("kpi-") && !isOee ? (
                        <BarChart data={ind.records} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                          <CartesianGrid stroke="#1A1A1F" strokeDasharray="3 3" />
                          <XAxis dataKey="period" stroke="#4B5563" fontSize={9} tickLine={false} />
                          <YAxis stroke="#4B5563" fontSize={9} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#111113', borderColor: '#2D2D31', fontSize: '10px' }}
                            itemStyle={{ color: '#F59E0B' }}
                          />
                          <ReferenceLine y={ind.target} stroke="#EF4444" strokeDasharray="5 5" label={{ value: isFa ? 'هدف' : 'Target', fill: '#EF4444', fontSize: 8, position: 'top' }} />
                          <Bar dataKey="value" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={20} />
                        </BarChart>
                      ) : (
                        <AreaChart data={ind.records} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`colorValue-${ind.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#1A1A1F" strokeDasharray="3 3" />
                          <XAxis dataKey="period" stroke="#4B5563" fontSize={9} tickLine={false} />
                          <YAxis stroke="#4B5563" fontSize={9} tickLine={false} />
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#111113', borderColor: '#2D2D31', fontSize: '10px' }}
                            itemStyle={{ color: '#F59E0B' }}
                          />
                          <ReferenceLine y={ind.target} stroke="#EF4444" strokeDasharray="5 5" label={{ value: isFa ? 'هدف' : 'Target', fill: '#EF4444', fontSize: 8, position: 'top' }} />
                          <Area type="monotone" dataKey="value" stroke="#F59E0B" strokeWidth={1.5} fillOpacity={1} fill={`url(#colorValue-${ind.id})`} />
                        </AreaChart>
                      )}
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-[10px] text-slate-600 flex flex-col items-center gap-1 select-none">
                      <HelpCircle size={14} />
                      <span>{isFa ? "داده‌ای برای ترسیم نمودار یافت نشد." : "No records to plot chart yet."}</span>
                    </div>
                  )}
                </div>

                {/* Historical vs Running indicators breakdown */}
                <div className="bg-[#15151A] border border-[#232326] p-3 rounded-xl flex flex-col sm:flex-row items-stretch justify-between gap-3 text-[10px]">
                  <div className="flex flex-col gap-1.5 flex-1">
                    <span className="text-slate-500 font-bold flex items-center gap-1">
                      📁 {isFa ? "سوابق بایگانی شده (آرشیو):" : "Archived Records (Historical):"}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {archivedRecords.length > 0 ? (
                        archivedRecords.map((r, i) => (
                          <div 
                            key={i} 
                            onClick={() => handleToggleRecordArchive(ind.id, r.period)}
                            className="group bg-[#0D0D10] hover:bg-neutral-800 text-[#7E8F9F] hover:text-white px-1.5 py-1 rounded font-mono border border-[#232326] flex items-center gap-1 cursor-pointer transition-all min-h-[22px]"
                            title={isFa ? "کلیک جهت بازگردانی به جریان زنده" : "Click to active"}
                          >
                            <span>{r.period}: <strong className="text-zinc-300 font-mono">{r.value}</strong></span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteRecord(ind.id, r.period, e)}
                              className="opacity-0 group-hover:opacity-100 ml-1 text-red-500 hover:text-red-400 font-bold text-[8px] transition-all px-0.5 rounded"
                              title={isFa ? "حذف این بازه" : "Delete data point"}
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-600 italic">Ø</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 flex-1 border-t sm:border-t-0 sm:border-r border-[#24242A] sm:pt-0 pt-2 sm:pr-3 sm:mr-3">
                    <span className="text-emerald-500 font-bold flex items-center gap-1">
                      ⚡ {isFa ? "سوابق کاری (زنده/فعال):" : "Active Flow (Running):"}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {activeRecords.length > 0 ? (
                        activeRecords.map((r, i) => (
                          <div 
                            key={i} 
                            onClick={() => handleToggleRecordArchive(ind.id, r.period)}
                            className="group bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 px-1.5 py-1 rounded font-mono border border-emerald-500/20 flex items-center gap-1 cursor-pointer transition-all min-h-[22px]"
                            title={isFa ? "کلیک جهت بایگانی و انتقال به تاریخچه" : "Click to archive"}
                          >
                            <span>{r.period}: <strong className="text-white font-mono">{r.value}</strong></span>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteRecord(ind.id, r.period, e)}
                              className="opacity-0 group-hover:opacity-100 ml-1 text-red-400 hover:text-red-300 font-bold text-[8px] transition-all px-0.5"
                              title={isFa ? "حذف این بازه" : "Delete data point"}
                            >
                              ✕
                            </button>
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-600 italic">Ø</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Add Record Tool supporting formulas */}
                <div className="border-t border-[#1E1E22] pt-4 flex flex-col gap-2.5">
                  <span className="text-[9px] text-[#888] font-bold uppercase tracking-wider">{isFa ? "ثبت نقطه داده جدید در این نمودار" : "Log New Achievement Coordinate"}</span>
                  
                  {/* Period selection */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 flex flex-col gap-1">
                      <label className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">{isFa ? "بازه زمانی:" : "Period Label:"}</label>
                      <input
                        type="text"
                        placeholder={isFa ? "بازه (مانند دی ماه، Q1)" : "Period (e.g. Q1, Azar)"}
                        value={newRecordPeriod[ind.id] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewRecordPeriod(prev => ({ ...prev, [ind.id]: val }));
                        }}
                        className="bg-[#0A0A0C] border border-[#202023] rounded-lg px-2.5 py-1.5 text-[10px] text-white outline-none focus:border-amber-500/40 w-full"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">{isFa ? "نوع بایگانی:" : "Archive Status:"}</label>
                      <select
                        value={newRecordIsArchived[ind.id] ? "true" : "false"}
                        onChange={(e) => {
                          const isArch = e.target.value === "true";
                          setNewRecordIsArchived(prev => ({ ...prev, [ind.id]: isArch }));
                        }}
                        className="bg-[#0A0A0C] border border-[#202023] rounded-lg px-2 py-1.5 text-[11px] text-white outline-none cursor-pointer focus:border-amber-500/40 h-8"
                      >
                        <option value="false">{isFa ? "رکورد فعال (زنده)" : "Active / Live"}</option>
                        <option value="true">{isFa ? "سوابق تاریخچه" : "Archived / Historical"}</option>
                      </select>
                    </div>
                  </div>

                  {/* Formula-driven variable inputs versus manual entry list */}
                  {ind.formula ? (
                    <div className="bg-[#16161C] border border-[#24242A] p-3 rounded-xl flex flex-col gap-3">
                      <span className="text-[9px] text-[#A78BFA] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles size={11} className="text-[#A78BFA]" />
                        <span>{isFa ? "ارزیابی متکی بر مقادیر جدول مرجع متغیرها:" : "Evaluated based on master variable table values:"}</span>
                      </span>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(() => {
                          const parsedMatches = ind.formula.match(/[A-Z]/g) || [];
                          const vars = (parsedMatches as string[]).filter((v, i, self) => self.indexOf(v) === i).sort();
                          
                          // Calculate preview value in real-time
                          const tempVariablesEval: Record<string, number> = {};
                          vars.forEach(v => {
                            tempVariablesEval[v] = getVariableValue(v, globalVariables, indicators);
                          });
                          const previewResult = evaluateFormula(ind.formula, tempVariablesEval);

                          return (
                            <>
                              {vars.map(char => {
                                const globalVar = globalVariables.find(gv => gv.char === char);
                                const displayedLabel = globalVar 
                                  ? (isFa ? globalVar.nameFa : globalVar.nameEn)
                                  : (ind.variableLabels?.[char] || (isFa ? `متغیر ${char}` : `Variable ${char}`));
                                const val = tempVariablesEval[char];
                                
                                return (
                                  <div key={char} className="flex flex-col gap-0.5 bg-[#0A0A0C] border border-[#202024] p-2 rounded-lg text-right">
                                    <div className="flex items-center gap-1">
                                      <span className="w-3.5 h-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8.5px] font-black rounded flex items-center justify-center shrink-0">{char}</span>
                                      <span className="text-[9px] text-zinc-400 truncate" title={displayedLabel}>{displayedLabel}</span>
                                    </div>
                                    <div className="text-[11px] font-sans font-black text-amber-500 mt-0.5 pr-4.5">
                                      {val}
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Calculations preview box */}
                              <div className="col-span-full mt-2 bg-[#0D0D10] border border-[#232326] p-2.5 rounded-lg flex items-center justify-between">
                                <div className="text-[9px] text-slate-400">
                                  {isFa ? "فرمول پایش شاخص:" : "Indicator Formula:"}{" "}
                                  <code className="text-amber-500 font-mono text-[10px] font-bold">{ind.formula}</code>
                                </div>
                                <div className="text-[10px] text-white font-bold flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-lg border border-amber-500/20 font-mono">
                                    {isFa ? "حاصل محاسبه لحظه‌ای:" : "Instantaneous Result:"} {previewResult} {ind.unit}
                                  </span>
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>

                      <div className="text-[8.5px] text-zinc-500 text-center leading-relaxed">
                        {isFa 
                          ? "💡 مقادیر فوق صرفاً در جدول مرجع متغیرها (بالای صفحه) قابل تغییر و مقداردهی هستند."
                          : "💡 Values above are managed and populated exclusively inside the Master Variables Registry Table (at the top)."}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddNewRecord(ind.id)}
                        disabled={!newRecordPeriod[ind.id]}
                        className="w-full bg-amber-500 hover:bg-amber-400 text-black border border-amber-500 text-[10px] font-extrabold rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:pointer-events-none py-2 shrink-0 shadow-lg"
                      >
                        {isFa ? "ثبت مقدار با حاصل فوق به عنوان نقطه داده" : "Log Computed Value as KPI Data Point"}
                      </button>
                    </div>
                  ) : (
                    /* Default manual override */
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="flex-1 flex flex-col gap-1">
                        <label className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">{isFa ? "مقدار حاصل شده:" : "Observed Value:"}</label>
                        <input
                          type="number"
                          step="any"
                          placeholder={isFa ? "مقدار حاصل شده" : "Observed value"}
                          value={newRecordValue[ind.id] || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewRecordValue(prev => ({ ...prev, [ind.id]: val }));
                          }}
                          className="bg-[#0A0A0C] border border-[#202023] rounded-lg px-2.5 py-1.5 text-[10px] text-white outline-none font-mono focus:border-amber-500/40 w-full"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddNewRecord(ind.id)}
                        disabled={!newRecordPeriod[ind.id] || !newRecordValue[ind.id]}
                        className="sm:self-end h-8 bg-[#1A1A1D] hover:bg-amber-500 hover:text-black border border-[#2D2D31] hover:border-amber-500 text-slate-300 text-[10px] font-bold rounded-lg transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none px-4 py-1.5"
                      >
                        {isFa ? "ثبت رکورد" : "Log Coordinates"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Dynamic Pop-up Spread-sheet Cell Value linking Modal */}
      {showDocLinkerModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fadeIn overflow-y-auto">
          <div className="bg-[#0C0C0E] border border-[#2D2D31] text-right rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-scaleIn">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-[#232326] flex items-center justify-between bg-[#111114]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl flex items-center justify-center">
                  <Database size={18} className="animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white text-right">
                    {isFa ? "دریافت آنلاین مقادیر از سلول‌های مراجع و اسناد پروژه" : "Pull Value Live from Project Document Cells"}
                  </h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5 text-right">
                    {isFa 
                      ? `جایگذاری مستقیم مقدار عددی انتخاب شده در متغیر فعال: ${linkTargetVarChar}`
                      : `Insert chosen numerical value directly into variable symbol: ${linkTargetVarChar}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowDocLinkerModal(false);
                  setLinkTargetVarChar(null);
                  setSelectedLinkingDocName(null);
                }}
                className="p-1 px-1.5 hover:bg-[#1E1E22] border border-transparent hover:border-[#2D2D31] text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-4 text-right">
              
              {!selectedLinkingDocName ? (
                /* --- STAGE 1: DOCUMENT SELECTOR LIST --- */
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#111113] p-3 rounded-xl border border-[#1E1E22]">
                    <span className="text-[11px] font-black text-amber-500 text-right">
                      {isFa ? "گام اول: سند یا گزارش مرجع پروژه خودرویی را انتخاب کنید:" : "Step 1: Choose a QMS reference document / automotive report:"}
                    </span>
                    
                    {/* Compact Search Bar for 13+ Documents */}
                    <div className="relative w-full sm:w-64">
                      <input
                        type="text"
                        placeholder={isFa ? "جستجوی مستند..." : "Search document..."}
                        value={docSearchQuery}
                        onChange={(e) => setDocSearchQuery(e.target.value)}
                        className="w-full bg-[#070709] border border-[#232326] rounded-lg px-2.5 py-1.5 pl-8 text-[11px] text-white outline-none focus:border-amber-500/50 text-right"
                      />
                      <Filter size={12} className="absolute left-2.5 top-2.5 text-zinc-500" />
                    </div>
                  </div>

                   {/* Documents Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {Array.from(new Set([...Object.keys(documentTemplates), ...Object.keys(getCustomDocuments())]))
                      .filter(key => 
                        !docSearchQuery || 
                        key.toLowerCase().includes(docSearchQuery.toLowerCase())
                      )
                      .map(key => {
                        const itemsLength = getInteractiveItems(key).length;
                        const meta = getDocMetadata(key);
                        return (
                          <div
                            key={key}
                            onClick={() => setSelectedLinkingDocName(key)}
                            className="bg-[#141417] hover:bg-[#1B1B1F] border border-[#232326] hover:border-purple-500/30 rounded-xl p-4 transition-all cursor-pointer flex flex-col justify-between gap-3 group relative overflow-hidden text-right"
                          >
                            <div className="absolute top-0 left-0 bg-purple-500/10 text-purple-400 border-r border-b border-purple-500/20 px-2 py-0.5 text-[8px] font-bold select-none font-sans uppercase">
                              {meta.smartType || "Standard"}
                            </div>
                            
                            <div>
                              <h4 className="text-[12px] font-extrabold text-white group-hover:text-amber-400 transition-colors text-right">
                                {key}
                              </h4>
                              <p className="text-[9.5px] text-zinc-400 leading-relaxed mt-1 text-right border-zinc-800">
                                {meta.description || ""}
                              </p>
                            </div>
                            
                            <div className="flex items-center justify-between border-t border-zinc-800/60 pt-2 text-[10px]">
                              <span className="text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded-lg font-black">
                                {isFa ? `${itemsLength} ردیف داده آماده` : `${itemsLength} ready rows`}
                              </span>
                              <span className="text-[#A78BFA] text-[10px] font-black group-hover:translate-x-[-4px] transition-transform flex items-center gap-1">
                                {isFa ? "مشاهده سند و گزینش خانه ←" : "Explore Sheet & Bind ←"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                /* --- STAGE 2: CELL SPREADSHEET SELECTOR POPUP --- */
                <div className="flex flex-col gap-4 animate-fadeIn font-sans text-right">
                  
                  {/* Sub-header inside Modal */}
                  <div className="flex items-center justify-between gap-2 bg-[#121215] border border-purple-500/20 p-3.5 rounded-xl">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedLinkingDocName(null)}
                        className="p-1 px-2.5 bg-zinc-900 hover:bg-zinc-800 text-purple-400 border border-[#2D2D31] hover:border-purple-500/30 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <ArrowLeft size={12} className="rotate-180" />
                        <span>{isFa ? "بازگشت به لیست مستندات" : "Back to Documents List"}</span>
                      </button>
                      <div className="h-4 w-px bg-zinc-800 mx-1" />
                      <div className="flex flex-col text-right">
                        <span className="text-[10px] text-purple-400 font-extrabold uppercase">{isFa ? "سند فعال جاری:" : "Active Sheet:"}</span>
                        <h4 className="text-xs font-black text-white">{selectedLinkingDocName}</h4>
                      </div>
                    </div>
                    <span className="text-[9.5px] text-zinc-400 bg-[#0A0A0C] border border-[#1E1E22] px-2.5 py-1 rounded-lg">
                      {isFa 
                        ? `💡 با کلیک روی هر سلول با حاشیه زرد رنگ (سلول عددی)، آن را به عنوان متغیر ${linkTargetVarChar} برگزینید.` 
                        : `💡 Click any cell with yellow/dashed border to bind it to variable ${linkTargetVarChar}.`}
                    </span>
                  </div>

                  {/* Dynamic Spreadsheet Grid */}
                  <div className="overflow-x-auto border border-[#222226] rounded-xl bg-[#09090C]">
                    <table className="w-full text-right border-collapse text-[11px] font-sans">
                      <thead>
                        <tr className="bg-[#111113] border-b border-[#222226]">
                          <th className="p-2.5 text-center text-zinc-500 text-[10px] w-12 font-bold select-none">#</th>
                          {selectedLinkingDocName && (getDocMetadata(selectedLinkingDocName)?.headers || []).map((head, idx) => (
                            <th key={idx} className="p-2.5 font-extrabold text-[#7E8F9F] text-right whitespace-nowrap min-w-[120px]">
                              {head}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedLinkingDocName && getInteractiveItems(selectedLinkingDocName).map((item, rowIndex) => {
                          const meta = getDocMetadata(selectedLinkingDocName);
                          const headers = meta?.headers || [];
                          const smartType = meta?.smartType;
                          
                          return (
                            <tr key={item.id || rowIndex} className="border-b border-[#16161A]/80 hover:bg-white/[0.01] transition-colors">
                              <td className="p-2 text-center text-zinc-500 font-mono font-medium select-none bg-zinc-950/20">
                                {rowIndex + 1}
                              </td>
                              {headers.map((head, colIndex) => {
                                const { raw, numeric } = getCellValue(item, colIndex, smartType);
                                const isClickableValue = numeric !== null;

                                return (
                                  <td 
                                    key={colIndex} 
                                    className={`p-1 text-right whitespace-normal relative transition-all group ${
                                      isClickableValue 
                                        ? 'bg-[#A78BFA]/[0.01] hover:bg-yellow-500/10' 
                                        : ''
                                    }`}
                                  >
                                    {isClickableValue ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          selectedValueBinding(numeric, head, rowIndex);
                                        }}
                                        className="w-full text-right p-1.5 font-mono font-black text-amber-400 border border-dashed border-amber-500/20 group-hover:border-amber-500 rounded transition-all text-[11px] block select-all cursor-pointer"
                                        title={isFa ? `درج مقدار "${numeric}" به جای متغیر ${linkTargetVarChar}` : `Substitute value "${numeric}" for variable ${linkTargetVarChar}`}
                                      >
                                        <div className="flex items-center justify-between gap-1.5">
                                          <span>{raw}</span>
                                          <span className="text-[8px] bg-amber-500/10 text-amber-500 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity uppercase shrink-0 font-bold">
                                            {isFa ? "انتخاب" : "BIND"}
                                          </span>
                                        </div>
                                      </button>
                                    ) : (
                                      <div className="p-2.5 text-zinc-300 max-w-[280px] shrink-0 truncate text-[11px] leading-relaxed" title={raw !== undefined ? String(raw) : '-'}>
                                        {raw !== undefined ? String(raw) : '-'}
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="text-[10px] text-zinc-500 leading-relaxed text-center mt-2">
                    {isFa 
                      ? "⚠️ سیستم به صورت هوشمند مقادیر عددی داخل سلول‌ها را جهت محاسبات شناسایی و تفکیک کرده است." 
                      : "⚠️ The platform automatically parses and formats numeric cells to offer rapid value-extraction."}
                  </div>
                </div>
              )}

            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-[#232326] flex items-center justify-end bg-[#0A0A0D]">
              <button
                type="button"
                onClick={() => {
                  setShowDocLinkerModal(false);
                  setLinkTargetVarChar(null);
                  setSelectedLinkingDocName(null);
                }}
                className="bg-[#1C1C1F] hover:bg-[#25252A] text-zinc-300 border border-[#2D2D31] text-[10px] font-black px-4 py-2 rounded-lg cursor-pointer transition-all shrink-0"
              >
                {isFa ? "بستن پورتال مستندات" : "Close Document Portal"}
              </button>
            </div>

          </div>
        </div>
      )}
      {/* Custom Confirmation Dialog Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 text-right" dir={isFa ? 'rtl' : 'ltr'}>
          <div className="bg-[#0F0F12] border border-[#27272C] rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <h3 className="text-sm font-black text-white flex items-center gap-2 border-b border-white/5 pb-2.5">
              <span className="text-red-500">{confirmModal.title}</span>
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed font-medium">
              {confirmModal.message}
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                {isFa ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg shadow-red-500/10"
              >
                {isFa ? 'تأیید حذف' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
