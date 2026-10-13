/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Trash2, 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  Filter, 
  Search, 
  User as UserIcon, 
  Sparkles, 
  Check, 
  Info,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  CalendarCheck2
} from 'lucide-react';
import { generateProcessRequirementsMatrix } from '../lib/matrixGenerator';

export interface AuditTask {
  id: string;
  title: string;
  category: 'internal_audit' | 'calibration' | 'mgmt_review' | 'doc_review' | 'csr' | 'other';
  month: number; // 1 to 12
  day: number; // 1 to 31
  auditor: string;
  leadNotifyDays: number; // Notification alert start days
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in_progress' | 'completed' | 'overdue';
  description?: string;
  processName?: string; // Associated process from Clause 4.4
}

// Jalali month names and day counts
export const JALALI_MONTHS = [
  { name: 'فروردین', nameEn: 'Farvardin', days: 31 },
  { name: 'اردیبهشت', nameEn: 'Ordibehesht', days: 31 },
  { name: 'خرداد', nameEn: 'Khordad', days: 31 },
  { name: 'تیر', nameEn: 'Tir', days: 31 },
  { name: 'مرداد', nameEn: 'Mordad', days: 31 },
  { name: 'شهریور', nameEn: 'Shahrivar', days: 31 },
  { name: 'مهر', nameEn: 'Mehr', days: 30 },
  { name: 'آبان', nameEn: 'Aban', days: 30 },
  { name: 'آذر', nameEn: 'Azar', days: 30 },
  { name: 'دی', nameEn: 'Dey', days: 30 },
  { name: 'بهمن', nameEn: 'Bahman', days: 30 },
  { name: 'اسفند', nameEn: 'Esfand', days: 29 } // Non-leap year assumption
];

// Jalali to Gregorian Conversion Formula
export function jalaliToGregorian(jy: number, jm: number, jd: number): Date {
  let sal_a = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
  let gy: number;
  if (jy > 979) {
    gy = 1600;
    jy -= 979;
  } else {
    gy = 621;
  }
  let days = (365 * jy) + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  let sal_b = [0, 31, ((gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm: number;
  for (gm = 0; gm < 13; gm++) {
    let v = sal_b[gm];
    if (gd <= v) break;
    gd -= v;
  }
  return new Date(gy, gm - 1, gd);
}

// Gregorian to Jalali Conversion Formula
export function gregorianToJalali(g_y: number, g_m: number, g_d: number) {
  let gy = g_y - 1600;
  let gm = g_m - 1;
  let gd = g_d - 1;

  let g_day_no = 365 * gy + Math.floor((gy + 3) / 4) - Math.floor((gy + 99) / 100) + Math.floor((gy + 399) / 400);
  for (let i = 0; i < gm; ++i) {
    let sal_b = [31, ((g_y % 4 === 0 && g_y % 100 !== 0) || (g_y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    g_day_no += sal_b[i];
  }
  g_day_no += gd;

  let j_day_no = g_day_no - 79;

  let j_np = Math.floor(j_day_no / 12053);
  j_day_no %= 12053;

  let jy = 979 + 33 * j_np + 4 * Math.floor(j_day_no / 1461);
  j_day_no %= 1461;

  if (j_day_no >= 366) {
    jy += Math.floor((j_day_no - 1) / 365);
    j_day_no = (j_day_no - 1) % 365;
  }

  let jm: number;
  for (jm = 0; jm < 11; ++jm) {
    let daysInMonth = jm < 6 ? 31 : 30;
    if (j_day_no < daysInMonth) break;
    j_day_no -= daysInMonth;
  }
  let jd = j_day_no + 1;

  return { jy, jm: jm + 1, jd };
}

// Helper to determine active countdown alerts based on task configurations
export function getActiveAlerts(tasks: AuditTask[], currentDate: Date = new Date()): Array<{ task: AuditTask; daysLeft: number; isTriggered: boolean }> {
  return tasks.map(task => {
    // 1405 is the current year corresponding to July 2026
    const taskDate = jalaliToGregorian(1405, task.month, task.day);
    
    // Clear hours to avoid time-of-day offsets
    const currentClean = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const taskClean = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
    
    const diffTime = taskClean.getTime() - currentClean.getTime();
    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Alert triggers if the remaining days is positive and within the leadNotifyDays threshold
    const isTriggered = daysLeft >= 0 && daysLeft <= task.leadNotifyDays && task.status !== 'completed';
    
    return {
      task,
      daysLeft,
      isTriggered
    };
  }).filter(item => item.isTriggered || (item.daysLeft < 0 && item.task.status !== 'completed'));
}

const STORAGE_KEY = 'iatf_qms_internal_audit_tasks';

const DEFAULT_TASKS: AuditTask[] = [];

interface Props {
  lang: 'fa' | 'en';
  onPinToDashboard?: () => void;
}

export default function InternalAuditCalendar({ lang, onPinToDashboard }: Props) {
  const isRtl = lang === 'fa';
  
  // Navigation tabs for Calendar vs Process-specific Tasks Monitoring
  const [activeCalendarTab, setActiveCalendarTab] = useState<'calendar' | 'processes'>('calendar');

  // Load processes dynamically from standard Turtle Diagrams
  const activeProcesses = useMemo(() => {
    try {
      const matrix = generateProcessRequirementsMatrix() || [];
      return matrix.map(item => ({
        key: item.id || item.field1,
        name: (item.field1 || '').trim(),
        type: item.field2 || 'COPs',
        clauseId: item.clauseId || '4.4'
      }));
    } catch (e) {
      console.warn('Could not read matrix generator for process monitoring:', e);
      return [];
    }
  }, []);

  // Tasks state
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  
  // Calendar Navigation
  const [selectedMonth, setSelectedMonth] = useState<number>(4); // Default to Tir
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  
  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  
  // Task Editing/Adding State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AuditTask | null>(null);
  
  // Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<AuditTask['category']>('internal_audit');
  const [formDay, setFormDay] = useState<number>(1);
  const [formAuditor, setFormAuditor] = useState('');
  const [formLeadNotifyDays, setFormLeadNotifyDays] = useState<number>(5);
  const [formPriority, setFormPriority] = useState<AuditTask['priority']>('medium');
  const [formStatus, setFormStatus] = useState<AuditTask['status']>('todo');
  const [formDescription, setFormDescription] = useState('');
  const [formProcessName, setFormProcessName] = useState<string>('');

  // Custom confirmation dialog state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmClass?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Fetch current Jalali date to highlight today
  // Current Gregorian is 2026-07-15
  const todayJalali = gregorianToJalali(2026, 7, 15);

  // Load and save tasks from localStorage
  useEffect(() => {
    const loadTasks = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          // Clean out legacy prototyping/mock tasks (IDs starting with tsk-001 to tsk-006)
          const cleanTasks = Array.isArray(parsed) ? parsed.filter((t: any) => !t.id.startsWith('tsk-00')) : [];
          setTasks(cleanTasks);
        } catch (e) {
          setTasks([]);
        }
      } else {
        setTasks([]);
      }
    };

    loadTasks();

    const handleProgramsSyncInCalendar = () => {
      loadTasks();
    };

    window.addEventListener('qms-internal-audit-programs-updated', handleProgramsSyncInCalendar);
    window.addEventListener('qms-internal-audit-tasks-updated', handleProgramsSyncInCalendar);

    return () => {
      window.removeEventListener('qms-internal-audit-programs-updated', handleProgramsSyncInCalendar);
      window.removeEventListener('qms-internal-audit-tasks-updated', handleProgramsSyncInCalendar);
    };
  }, []);

  const syncTasksToPrograms = (updatedTasks: AuditTask[]) => {
    try {
      const pRaw = localStorage.getItem('qms_audit_module_programs_v1');
      if (!pRaw) return;
      const programs: any[] = JSON.parse(pRaw);
      if (!Array.isArray(programs)) return;

      let hasChanges = false;
      const updatedPrograms = programs.map(prog => {
        const correspondingTask = updatedTasks.find(t => t.id === `audit-prog-${prog.id}`);
        if (correspondingTask) {
          const tMonth = String(correspondingTask.month).padStart(2, '0');
          const tDay = String(correspondingTask.day).padStart(2, '0');
          const expectedDateStr = `۱۴۰۵/${tMonth}/${tDay}`;
          
          // Helper to convert Persian digits to English for easy comparisons
          const toEng = (s: string) => s.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
          
          if (toEng(prog.auditDate) !== toEng(expectedDateStr)) {
            hasChanges = true;
            return {
              ...prog,
              auditDate: expectedDateStr
            };
          }
        }
        return prog;
      });

      if (hasChanges) {
        localStorage.setItem('qms_audit_module_programs_v1', JSON.stringify(updatedPrograms));
        window.dispatchEvent(new Event('qms-internal-audit-programs-updated'));
      }
    } catch (e) {
      console.error('Error syncing calendar tasks to programs:', e);
    }
  };

  const saveTasksToStorage = (updatedTasks: AuditTask[]) => {
    setTasks(updatedTasks);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTasks));
    // Sync tasks back to programs in case any audit program task dates changed in calendar
    syncTasksToPrograms(updatedTasks);
    // Dispatch custom event to notify App.tsx header icon
    window.dispatchEvent(new Event('qms-internal-audit-tasks-updated'));
  };

  // Select day handler
  const handleDayClick = (dayNum: number) => {
    setSelectedDay(dayNum);
    // Find if there's an existing task for this day
    const taskOnDay = tasks.find(t => t.month === selectedMonth && t.day === dayNum);
    if (taskOnDay) {
      handleEditTaskClick(taskOnDay);
    } else {
      // Clear form and open to add for this specific day
      setEditingTask(null);
      setFormTitle('');
      setFormCategory('internal_audit');
      setFormDay(dayNum);
      setFormAuditor('');
      setFormLeadNotifyDays(7);
      setFormPriority('medium');
      setFormStatus('todo');
      setFormDescription('');
      setFormProcessName('');
      setIsFormOpen(true);
    }
  };

  const handleMonthDayClick = (monthNum: number, dayNum: number) => {
    setSelectedMonth(monthNum);
    setSelectedDay(dayNum);
    // Find if there's an existing task for this day
    const taskOnDay = tasks.find(t => t.month === monthNum && t.day === dayNum);
    if (taskOnDay) {
      handleEditTaskClick(taskOnDay);
    } else {
      // Clear form and open to add for this specific day
      setEditingTask(null);
      setFormTitle('');
      setFormCategory('internal_audit');
      setFormDay(dayNum);
      setFormAuditor('');
      setFormLeadNotifyDays(7);
      setFormPriority('medium');
      setFormStatus('todo');
      setFormDescription('');
      setFormProcessName('');
      setIsFormOpen(true);
    }
  };

  const handleEditTaskClick = (task: AuditTask) => {
    setEditingTask(task);
    setFormTitle(task.title);
    setFormCategory(task.category);
    setFormDay(task.day);
    setFormAuditor(task.auditor);
    setFormLeadNotifyDays(task.leadNotifyDays);
    setFormPriority(task.priority);
    setFormStatus(task.status);
    setFormDescription(task.description || '');
    setFormProcessName(task.processName || '');
    setIsFormOpen(true);
  };

  const handleDeleteTask = (taskId: string) => {
    const taskToDelete = tasks.find(t => t.id === taskId);
    const titleText = taskToDelete ? `"${taskToDelete.title}"` : '';
    setConfirmModal({
      isOpen: true,
      title: isRtl ? '⚠️ تأیید حذف وظیفه ممیزی' : '⚠️ Confirm Delete Audit Task',
      message: isRtl 
        ? `آیا از حذف وظیفه ممیزی ${titleText} اطمینان دارید؟ این عمل غیرقابل بازگشت است.` 
        : `Are you sure you want to delete the audit task ${titleText}? This action cannot be undone.`,
      confirmLabel: isRtl ? 'بله، حذف شود' : 'Delete',
      confirmClass: 'bg-red-500 hover:bg-red-650',
      onConfirm: () => {
        const updated = tasks.filter(t => t.id !== taskId);
        saveTasksToStorage(updated);
        setIsFormOpen(false);
        setEditingTask(null);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    if (editingTask) {
      // Edit existing with confirmation prompt
      setConfirmModal({
        isOpen: true,
        title: isRtl ? '📝 تأیید ویرایش وظیفه ممیزی' : '📝 Confirm Audit Task Edit',
        message: isRtl 
          ? `آیا از ثبت تغییرات در وظیفه ممیزی "${editingTask.title}" اطمینان دارید؟` 
          : `Are you sure you want to save changes to the audit task "${editingTask.title}"?`,
        confirmLabel: isRtl ? 'ثبت تغییرات' : 'Save Changes',
        confirmClass: 'bg-amber-500 hover:bg-amber-400 text-black',
        onConfirm: () => {
          const updated = tasks.map(t => {
            if (t.id === editingTask.id) {
              return {
                ...t,
                title: formTitle.trim(),
                category: formCategory,
                day: formDay,
                month: selectedMonth,
                auditor: formAuditor.trim() || 'نامشخص',
                leadNotifyDays: Number(formLeadNotifyDays),
                priority: formPriority,
                status: formStatus,
                description: formDescription.trim(),
                processName: formProcessName
              };
            }
            return t;
          });
          saveTasksToStorage(updated);
          setIsFormOpen(false);
          setEditingTask(null);
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      });
    } else {
      // Create new (no confirm needed for simple creation, but saves directly)
      const newTask: AuditTask = {
        id: `tsk-${Date.now()}`,
        title: formTitle.trim(),
        category: formCategory,
        month: selectedMonth,
        day: formDay,
        auditor: formAuditor.trim() || 'نامشخص',
        leadNotifyDays: Number(formLeadNotifyDays),
        priority: formPriority,
        status: formStatus,
        description: formDescription.trim(),
        processName: formProcessName
      };
      saveTasksToStorage([...tasks, newTask]);
      setIsFormOpen(false);
      setEditingTask(null);
    }
  };

  const renderTaskForm = () => {
    return (
      <form onSubmit={handleFormSubmit} className="space-y-3.5 text-right">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-400 block px-1">{isRtl ? 'عنوان وظیفه / دامنه ممیزی:' : 'Task / Audit Title:'}</label>
          <input
            type="text"
            required
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            placeholder={isRtl ? 'مثال: ممیزی فرآیند سالن بدنه ساپکو' : 'e.g. Press Shop Process Audit'}
            className="w-full bg-[#161619] border border-[#2D2D31] text-xs text-white p-2.5 rounded-xl outline-none focus:border-amber-500/40"
          />
        </div>

        {/* Process Field */}
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-400 block px-1">
            {isRtl ? 'تعیین فرآیند مربوطه (از شناسنامه فرآیندها):' : 'Associated Process:'}
          </label>
          <select
            value={formProcessName}
            onChange={(e) => setFormProcessName(e.target.value)}
            className="w-full bg-[#161619] border border-[#2D2D31] text-xs text-white p-2.5 rounded-xl outline-none focus:border-amber-500/40 cursor-pointer"
          >
            <option value="">{isRtl ? '-- انتخاب فرآیند (شناسنامه فرآیندها ۴.۴) --' : '-- Choose Process (Clause 4.4) --'}</option>
            {activeProcesses.map(p => (
              <option key={p.key} value={p.name}>
                {p.name} {p.clauseId ? `(${p.clauseId})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 block px-1">{isRtl ? 'نوع برنامه‌ریزی:' : 'Category:'}</label>
            <select
              value={formCategory}
              onChange={(e: any) => setFormCategory(e.target.value)}
              className="w-full bg-[#161619] border border-[#2D2D31] text-xs text-white p-2.5 rounded-xl outline-none"
            >
              <option value="internal_audit">{isRtl ? 'ممیزی داخلی' : 'Internal Audit'}</option>
              <option value="calibration">{isRtl ? 'کالیبراسیون' : 'Calibration'}</option>
              <option value="mgmt_review">{isRtl ? 'بازنگری مدیریت' : 'Mgmt Review'}</option>
              <option value="doc_review">{isRtl ? 'بازبینی مدارک' : 'Doc Review'}</option>
              <option value="csr">{isRtl ? 'الزامات مشتری (CSR)' : 'Customer Specific'}</option>
              <option value="other">{isRtl ? 'سایر موارد' : 'Others'}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 block px-1">{isRtl ? 'روز سررسید:' : 'Day Number:'}</label>
            <input
              type="number"
              min={1}
              max={monthMeta.days}
              required
              value={formDay}
              onChange={(e) => setFormDay(Number(e.target.value))}
              className="w-full bg-[#161619] border border-[#2D2D31] text-xs text-white p-2.5 rounded-xl outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-400 block px-1">{isRtl ? 'ممیز / مسئول اجرا:' : 'Auditor / Assignee:'}</label>
          <input
            type="text"
            required
            value={formAuditor}
            onChange={(e) => setFormAuditor(e.target.value)}
            placeholder={isRtl ? 'مثال: مهندس حسینی (ممیز مستقل)' : 'e.g. Audit Lead Team'}
            className="w-full bg-[#161619] border border-[#2D2D31] text-xs text-white p-2.5 rounded-xl outline-none focus:border-amber-500/40"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 block px-1">
              {isRtl ? 'شروع هشدار (روز قبل):' : 'Pre-Alert (Days before):'}
            </label>
            <input
              type="number"
              min={1}
              max={60}
              required
              value={formLeadNotifyDays}
              onChange={(e) => setFormLeadNotifyDays(Number(e.target.value))}
              className="w-full bg-[#161619] border border-[#2D2D31] text-xs text-white p-2.5 rounded-xl outline-none focus:border-amber-500/40"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-zinc-400 block px-1">{isRtl ? 'اولویت سررسید:' : 'Priority:'}</label>
            <select
              value={formPriority}
              onChange={(e: any) => setFormPriority(e.target.value)}
              className="w-full bg-[#161619] border border-[#2D2D31] text-xs text-white p-2.5 rounded-xl outline-none"
            >
              <option value="high">{isRtl ? 'بحرانی / بالا' : 'High'}</option>
              <option value="medium">{isRtl ? 'متوسط' : 'Medium'}</option>
              <option value="low">{isRtl ? 'عادی' : 'Low'}</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-400 block px-1">{isRtl ? 'وضعیت اجرا:' : 'Status:'}</label>
          <select
            value={formStatus}
            onChange={(e: any) => setFormStatus(e.target.value)}
            className="w-full bg-[#161619] border border-[#2D2D31] text-xs text-white p-2.5 rounded-xl outline-none"
          >
            <option value="todo">{isRtl ? 'در انتظار ممیزی' : 'Pending'}</option>
            <option value="in_progress">{isRtl ? 'در حال انجام ممیزی' : 'In Progress'}</option>
            <option value="completed">{isRtl ? 'ممیزی با موفقیت بسته شد' : 'Completed'}</option>
            <option value="overdue">{isRtl ? 'معوق شده و فاقد اثر' : 'Overdue'}</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] font-bold text-zinc-400 block px-1">{isRtl ? 'شرح دامنه یا چک‌لیست‌ها:' : 'Audit scope & notes:'}</label>
          <textarea
            rows={2}
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder={isRtl ? 'آیتم‌ها یا چک‌لیست‌های مربوطه را در این قسمت یادداشت کنید...' : 'Write notes or reference checklist...'}
            className="w-full bg-[#161619] border border-[#2D2D31] text-xs text-white p-2.5 rounded-xl outline-none focus:border-amber-500/40 font-sans"
          />
        </div>

        <div className="flex gap-2.5 pt-2">
          <button
            type="submit"
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[11px] py-2.5 rounded-xl transition-all shadow-md shadow-amber-500/10 cursor-pointer"
          >
            {isRtl ? 'ذخیره برنامه ممیزی' : 'Save Event'}
          </button>
          
          {editingTask && (
            <button
              type="button"
              onClick={() => handleDeleteTask(editingTask.id)}
              className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center"
              title={isRtl ? "حذف برنامه ممیزی" : "Delete Event"}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </form>
    );
  };

  // Helpers for category styling
  const getCategoryMeta = (cat: AuditTask['category']) => {
    switch(cat) {
      case 'internal_audit':
        return { label: isRtl ? 'ممیزی داخلی' : 'Internal Audit', color: 'bg-emerald-500', textClass: 'text-emerald-400', borderClass: 'border-emerald-500/20' };
      case 'calibration':
        return { label: isRtl ? 'کالیبراسیون' : 'Calibration', color: 'bg-blue-500', textClass: 'text-blue-400', borderClass: 'border-blue-500/20' };
      case 'mgmt_review':
        return { label: isRtl ? 'بازنگری مدیریت' : 'Mgmt Review', color: 'bg-purple-500', textClass: 'text-purple-400', borderClass: 'border-purple-500/20' };
      case 'doc_review':
        return { label: isRtl ? 'بازبینی مدارک' : 'Doc Review', color: 'bg-amber-500', textClass: 'text-amber-400', borderClass: 'border-amber-500/20' };
      case 'csr':
        return { label: isRtl ? 'الزامات خاص مشتری' : 'CSR', color: 'bg-pink-500', textClass: 'text-pink-400', borderClass: 'border-pink-500/20' };
      default:
        return { label: isRtl ? 'متفرقه' : 'Other', color: 'bg-zinc-500', textClass: 'text-zinc-400', borderClass: 'border-zinc-500/20' };
    }
  };

  const getPriorityBadge = (prio: AuditTask['priority']) => {
    switch(prio) {
      case 'high':
        return { label: isRtl ? 'بحرانی' : 'High', class: 'bg-red-500/10 text-red-400 border border-red-500/30' };
      case 'medium':
        return { label: isRtl ? 'متوسط' : 'Medium', class: 'bg-amber-500/10 text-amber-400 border border-amber-500/30' };
      default:
        return { label: isRtl ? 'عادی' : 'Low', class: 'bg-zinc-500/15 text-zinc-400 border border-zinc-500/20' };
    }
  };

  const getStatusMeta = (status: AuditTask['status'], daysLeft?: number) => {
    switch(status) {
      case 'completed':
        return { label: isRtl ? 'انجام شده' : 'Completed', color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
      case 'in_progress':
        return { label: isRtl ? 'در حال اجرا' : 'In Progress', color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
      case 'overdue':
        return { label: isRtl ? 'معوق' : 'Overdue', color: 'bg-red-500/10 text-red-400 border border-red-500/20' };
      default:
        if (daysLeft !== undefined && daysLeft < 0) {
          return { label: isRtl ? 'معوق' : 'Overdue', color: 'bg-red-500/10 text-red-400 border border-red-500/20' };
        }
        return { label: isRtl ? 'در انتظار' : 'Pending', color: 'bg-zinc-800 text-zinc-400 border border-zinc-700/60' };
    }
  };

  // Filter and Search Logic
  const filteredTasks = tasks.filter(task => {
    const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (task.description && task.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          task.auditor.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || task.category === categoryFilter;
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;

    return matchesSearch && matchesCategory && matchesPriority;
  }).sort((a, b) => {
    // Sort chronologically by Month then Day
    if (a.month !== b.month) return a.month - b.month;
    return a.day - b.day;
  });

  const monthMeta = JALALI_MONTHS[selectedMonth - 1];

  return (
    <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Overview Card */}
      <div className="bg-[#0F0F12] border border-amber-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {onPinToDashboard && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPinToDashboard();
                  }}
                  className="p-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 rounded-lg transition-all cursor-pointer select-none shrink-0"
                  title={isRtl ? 'پین به داشبورد ابزار IATF' : 'Pin to IATF Tools Dashboard'}
                >
                  📌
                </button>
              )}
              <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                <CalendarCheck2 size={20} />
              </div>
              <h2 className="text-base font-black text-white">
                {isRtl ? 'تقویم داخلی سیستم (بند ۹.۲.۲.۱)' : 'Internal System Calendar (Clause 9.2.2.1)'}
              </h2>
            </div>
            <p className="text-zinc-400 text-xs leading-relaxed max-w-3xl">
              {isRtl 
                ? 'ابزار پیشرفته تقویم داخلی سیستم مطابق با بند ۹.۲.۲.۱ استاندارد IATF 16949. این سیستم با پایش روزشمار هوشمند، شما را پیش از رسیدن سررسیدها از طریق هشدارهای پیش‌از‌موعد معکوس مطلع می‌سازد.'
                : 'Advanced internal system schedules and milestones planning according to IATF 16949 clause 9.2.2.1. Configured with customizable advance-notice lead periods and dynamic countdown trackers.'}
            </p>
          </div>
          <div className="flex items-center gap-2.5 bg-zinc-900/60 px-4 py-2.5 rounded-xl border border-zinc-800">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <div className="text-xs">
              <span className="text-zinc-450 text-zinc-400 block sm:inline">{isRtl ? 'تاریخ جاری سیستم:' : 'Current Date:'}</span>{' '}
              <strong className="text-white font-mono">{todayJalali.jy}/{String(todayJalali.jm).padStart(2, '0')}/{String(todayJalali.jd).padStart(2, '0')}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex bg-[#0E0E11] border border-zinc-800 p-1 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveCalendarTab('calendar')}
          className={`px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
            activeCalendarTab === 'calendar'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          📅 {isRtl ? 'تقویم و نمای سالانه ممیزی' : 'Annual Audit Calendar'}
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveCalendarTab('processes');
            setIsFormOpen(false);
          }}
          className={`px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
            activeCalendarTab === 'processes'
              ? 'bg-amber-500 text-black shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          🔄 {isRtl ? 'پایش هوشمند وظایف به تفکیک فرآیند' : 'Process Tasks Monitoring'}
        </button>
      </div>

      {activeCalendarTab === 'calendar' ? (
        <>
          {/* 12-Month Calendar Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {JALALI_MONTHS.map((month, idx) => {
          const monthNum = idx + 1;
          const isSelected = selectedMonth === monthNum;
          
          // Get tasks for this month
          const monthTasks = tasks.filter(t => t.month === monthNum);

          return (
            <div
              key={month.name}
              onClick={() => {
                setSelectedMonth(monthNum);
                setSelectedDay(null);
                setIsFormOpen(false);
              }}
              className={`text-right p-4 rounded-xl border transition-all hover:scale-[1.01] cursor-pointer ${
                isSelected 
                  ? 'bg-[#15151A] border-amber-500/40 shadow-lg shadow-amber-500/5' 
                  : 'bg-[#0E0E11]/80 border-[#222] hover:border-zinc-700/60'
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <span className={`text-xs font-black ${isSelected ? 'text-amber-500' : 'text-zinc-400'}`}>
                  {isRtl ? month.name : month.nameEn}
                </span>
                
                {/* Indicators for tasks in this month */}
                <div className="flex gap-1">
                  {monthTasks.map(t => {
                    const meta = getCategoryMeta(t.category);
                    const taskDate = jalaliToGregorian(1405, t.month, t.day);
                    const diffTime = taskDate.getTime() - new Date(2026, 6, 15).getTime(); // relative to local time July 15, 2026
                    const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const isDueWarning = daysLeft >= 0 && daysLeft <= t.leadNotifyDays && t.status !== 'completed';

                    return (
                      <span 
                        key={t.id} 
                        title={t.title}
                        className={`w-2 h-2 rounded-full ${meta.color} ${isDueWarning ? 'animate-pulse ring-2 ring-red-500/50 scale-125' : ''}`}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Day Grid representation */}
              <div className="grid grid-cols-7 gap-1 text-[10px] text-zinc-500 font-mono text-center mb-1">
                {/* 12-Month Small Calendar grid dots */}
                {Array.from({ length: month.days }).map((_, dIdx) => {
                  const dayNum = dIdx + 1;
                  const monthTasksOnDay = monthTasks.filter(t => t.day === dayNum);
                  const hasTask = monthTasksOnDay.length > 0;
                  const isToday = todayJalali.jy === 1405 && todayJalali.jm === monthNum && todayJalali.jd === dayNum;
                  
                  return (
                    <button 
                      key={dayNum}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMonthDayClick(monthNum, dayNum);
                      }}
                      className={`h-5 w-full flex items-center justify-center rounded-sm text-[9px] font-sans transition-all cursor-pointer select-none ${
                        isToday 
                          ? 'bg-amber-500 text-black font-black font-mono scale-110 shadow-sm hover:bg-amber-400' 
                          : hasTask 
                          ? 'bg-amber-500/20 text-amber-400 font-bold hover:bg-amber-500/40 hover:scale-105' 
                          : 'hover:bg-white/10 text-zinc-500 hover:text-white'
                      }`}
                      title={hasTask 
                        ? `${isRtl ? 'روز' : 'Day'} ${dayNum}: ${monthTasksOnDay.map(t => t.title).join(' | ')}`
                        : `${isRtl ? 'افزودن ممیزی برای روز' : 'Add schedule for day'} ${dayNum}`}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>

              <div className="text-[10px] text-zinc-500 font-medium flex justify-between border-t border-zinc-800/60 pt-2 mt-2">
                <span>{monthTasks.length} {isRtl ? 'وظیفه برنامه ریزی شده' : 'Tasks'}</span>
                {monthTasks.some(t => t.status === 'todo') && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid: Selected Month's Day View & Task Management Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Pane: Detailed Month Day Selector & Audit Calendar */}
        <div className="lg:col-span-8 bg-[#0E0E11] border border-[#222] rounded-2xl p-6">
          <div className="flex justify-between items-center mb-5 pb-3 border-b border-[#222]">
            <div className="space-y-0.5">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <span>📅</span>
                <span>{isRtl ? `نمای ممیزی‌های ماه ${monthMeta.name}` : `Detailed Month view for ${monthMeta.nameEn}`}</span>
              </h3>
              <p className="text-zinc-500 text-[11px] font-medium">
                {isRtl ? 'جهت تعریف یا ویرایش برنامه‌های ممیزی روی هر یک از روزها کلیک کنید.' : 'Click on any day to define or edit audit programs.'}
              </p>
            </div>
            
            {/* Quick Month Switcher buttons */}
            <div className="flex gap-1 bg-[#15151A] p-1 border border-[#2D2D31] rounded-lg">
              <button 
                type="button"
                onClick={() => setSelectedMonth(prev => prev > 1 ? prev - 1 : 12)}
                className="p-1 hover:bg-white/5 rounded cursor-pointer"
              >
                <ChevronRight size={14} className={isRtl ? '' : 'rotate-180'} />
              </button>
              <span className="px-2 py-0.5 text-xs text-white font-bold select-none">{monthMeta.name}</span>
              <button 
                type="button"
                onClick={() => setSelectedMonth(prev => prev < 12 ? prev + 1 : 1)}
                className="p-1 hover:bg-white/5 rounded cursor-pointer"
              >
                <ChevronLeft size={14} className={isRtl ? '' : 'rotate-180'} />
              </button>
            </div>
          </div>

          {/* Large month days grid */}
          <div className="grid grid-cols-7 gap-3 text-center mb-4">
            {/* Calendar Headers */}
            {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map(h => (
              <div key={h} className="text-[11px] font-bold text-zinc-500 py-1">{h}</div>
            ))}

            {Array.from({ length: monthMeta.days }).map((_, dIdx) => {
              const dayNum = dIdx + 1;
              const isToday = todayJalali.jy === 1405 && todayJalali.jm === selectedMonth && todayJalali.jd === dayNum;
              const dayTasks = tasks.filter(t => t.month === selectedMonth && t.day === dayNum);
              
              return (
                <button
                  key={dayNum}
                  onClick={() => handleDayClick(dayNum)}
                  className={`min-h-16 flex flex-col justify-between p-2 rounded-xl transition-all border text-right cursor-pointer group ${
                    isToday 
                      ? 'border-amber-500 bg-amber-550/10 shadow-[0_0_12px_rgba(245,158,11,0.15)]' 
                      : dayTasks.length > 0
                      ? 'border-amber-500/20 bg-amber-500/[0.02] hover:border-amber-500/40' 
                      : 'border-zinc-800/80 bg-[#121215]/40 hover:border-zinc-700 hover:bg-[#1A1A22]'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className={`text-[11px] font-bold ${isToday ? 'text-amber-500 font-extrabold' : 'text-zinc-400'}`}>
                      {dayNum}
                    </span>
                    {isToday && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    )}
                  </div>

                  {/* Tasks on this day */}
                  <div className="space-y-1 w-full mt-1">
                    {dayTasks.map(t => {
                      const meta = getCategoryMeta(t.category);
                      const taskDate = jalaliToGregorian(1405, t.month, t.day);
                      const diffTime = taskDate.getTime() - new Date(2026, 6, 15).getTime();
                      const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                      const isDueWarning = daysLeft >= 0 && daysLeft <= t.leadNotifyDays && t.status !== 'completed';

                      return (
                        <div 
                          key={t.id} 
                          className={`text-[9px] font-black leading-tight px-1.5 py-0.5 rounded truncate flex items-center justify-between gap-1 border ${meta.borderClass} ${meta.textClass} bg-black/40`}
                          title={`${t.title} - متولی: ${t.auditor}`}
                        >
                          <span className="truncate">{t.title}</span>
                          {isDueWarning && (
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0 animate-ping" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 items-center justify-start text-[10px] text-zinc-500 border-t border-[#1C1C20] pt-4 mt-2">
            <span className="font-bold">{isRtl ? 'راهنمای علائم:' : 'Legend:'}</span>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{isRtl ? 'ممیزی داخلی فرآیند/سیستم' : 'Internal Audit'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>{isRtl ? 'تجهیزات و کالیبراسیون' : 'Calibration'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <span>{isRtl ? 'بازنگری مدیریت' : 'Mgmt Review'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>{isRtl ? 'بازبینی مدارک کیفیت' : 'Doc Review'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-pink-500"></span>
              <span>{isRtl ? 'الزامات خاص مشتری (CSR)' : 'Customer Specific'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse ring-2 ring-red-500/40"></span>
              <span className="text-red-400 font-bold">{isRtl ? 'اعلام هشدار فعال (روزشمار)' : 'Active Notification Warning'}</span>
            </div>
          </div>
        </div>

        {/* Right Pane: Tasks Search, Filters & Form */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* Task Form Drawer */}
          {isFormOpen && (
            <div className="bg-[#0F0F12] border border-amber-500/30 rounded-2xl p-5 shadow-2xl relative animate-fade-in">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingTask(null);
                }}
                className="absolute top-4 left-4 p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                ✕
              </button>
              
              <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#222]">
                <Calendar className="text-amber-500" size={16} />
                <h4 className="text-xs font-black text-white">
                  {editingTask 
                    ? (isRtl ? 'ویرایش برنامه ممیزی' : 'Edit Audit Task') 
                    : (isRtl ? `افزودن ممیزی برای روز ${formDay} ${monthMeta.name}` : `Schedule Task for Day ${formDay}`)}
                </h4>
              </div>

              {renderTaskForm()}
            </div>
          )}

          {/* Search and Filters panel */}
          <div className="bg-[#0E0E11] border border-[#222] rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-black text-white flex items-center gap-1.5">
              <Filter size={13} className="text-amber-500" />
              <span>{isRtl ? 'جستجو و فیلتر برنامه زمان‌بندی' : 'Filters & Search'}</span>
            </h4>

            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isRtl ? 'جستجوی عنوان ممیزی یا مسئول...' : 'Search title or auditor...'}
                  className="w-full bg-[#151518] border border-zinc-800 rounded-xl py-2 px-3 pl-8 text-xs text-white placeholder-zinc-550 outline-none focus:border-amber-500/30 font-sans"
                />
                <Search size={12} className="absolute left-2.5 top-3 text-zinc-500" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-zinc-500 block px-1">{isRtl ? 'دسته‌بندی:' : 'Category:'}</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full bg-[#151518] border border-zinc-800 rounded-xl p-2 text-[10px] text-zinc-300 outline-none"
                  >
                    <option value="all">{isRtl ? 'همه موارد' : 'All Categories'}</option>
                    <option value="internal_audit">{isRtl ? 'ممیزی داخلی' : 'Internal Audit'}</option>
                    <option value="calibration">{isRtl ? 'کالیبراسیون' : 'Calibration'}</option>
                    <option value="mgmt_review">{isRtl ? 'بازنگری مدیریت' : 'Mgmt Review'}</option>
                    <option value="doc_review">{isRtl ? 'بازبینی مدارک' : 'Doc Review'}</option>
                    <option value="csr">{isRtl ? 'الزامات مشتری' : 'CSR'}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-zinc-500 block px-1">{isRtl ? 'اولویت سررسید:' : 'Priority:'}</span>
                  <select
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    className="w-full bg-[#151518] border border-zinc-800 rounded-xl p-2 text-[10px] text-zinc-300 outline-none"
                  >
                    <option value="all">{isRtl ? 'همه اولویت‌ها' : 'All Priorities'}</option>
                    <option value="high">{isRtl ? 'بحرانی' : 'High'}</option>
                    <option value="medium">{isRtl ? 'متوسط' : 'Medium'}</option>
                    <option value="low">{isRtl ? 'عادی' : 'Low'}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Upcoming Schedules & Active Warnings Panel */}
          <div className="bg-[#0E0E11] border border-[#222] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                <Bell size={13} className="text-amber-500 animate-pulse" />
                <span>{isRtl ? 'کل زمان‌بندی‌های ممیزی سال ۱۴۰۵' : '1405 Master Audit Schedule'}</span>
              </h4>
              <span className="text-[9px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-bold">
                {filteredTasks.length} {isRtl ? 'برنامه' : 'Schedules'}
              </span>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
              {filteredTasks.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-xs italic">
                  {isRtl ? 'هیچ وظیفه ممیزی ثبت شده‌ای یافت نشد.' : 'No audit tasks found.'}
                </div>
              ) : (
                filteredTasks.map(task => {
                  const meta = getCategoryMeta(task.category);
                  const prioMeta = getPriorityBadge(task.priority);
                  const taskDate = jalaliToGregorian(1405, task.month, task.day);
                  
                  // Compute remaining days relative to July 15, 2026
                  const diffTime = taskDate.getTime() - new Date(2026, 6, 15).getTime();
                  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  const statusMeta = getStatusMeta(task.status, daysLeft);
                  const isWarningTriggered = daysLeft >= 0 && daysLeft <= task.leadNotifyDays && task.status !== 'completed';

                  return (
                    <button
                      key={task.id}
                      onClick={() => {
                        setSelectedMonth(task.month);
                        handleEditTaskClick(task);
                      }}
                      className={`w-full text-right p-3 rounded-xl border transition-all text-xs flex flex-col gap-2 relative overflow-hidden cursor-pointer ${
                        isWarningTriggered 
                          ? 'bg-red-500/[0.03] border-red-500/30 shadow-md hover:border-red-500/50' 
                          : 'bg-[#151518]/60 border-[#222] hover:border-zinc-700 hover:bg-[#1C1C22]'
                      }`}
                    >
                      {/* Left warning highlight banner */}
                      {isWarningTriggered && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
                      )}

                      <div className="flex justify-between items-start gap-2 w-full">
                        <div className="space-y-0.5">
                          <span className={`text-[8.5px] font-black uppercase tracking-wider ${meta.textClass}`}>
                            {meta.label}
                          </span>
                          <h5 className="font-extrabold text-white leading-snug line-clamp-2">{task.title}</h5>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1 font-mono shrink-0">
                          <span className="text-[10px] text-zinc-350 bg-black/30 border border-zinc-800 px-1.5 py-0.5 rounded">
                            {task.month}/{String(task.day).padStart(2, '0')}
                          </span>
                          <span className="text-[9px] text-zinc-500">
                            {JALALI_MONTHS[task.month - 1].name} {task.day}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[9.5px] border-t border-zinc-900 pt-2.5 mt-1">
                        <div className="flex items-center gap-1 text-zinc-400">
                          <UserIcon size={10} className="text-zinc-500" />
                          <span>{isRtl ? 'ممیز:' : 'Auditor:'} <strong>{task.auditor}</strong></span>
                        </div>
                        
                        <div className="flex gap-1">
                          <span className={`text-[8.5px] px-1.5 py-0.3 rounded-full ${prioMeta.class}`}>
                            {prioMeta.label}
                          </span>
                          <span className={`text-[8.5px] px-1.5 py-0.3 rounded-full font-bold ${statusMeta.color}`}>
                            {statusMeta.label}
                          </span>
                        </div>
                      </div>

                      {/* Display warning countdown relative to June/July 2026 */}
                      {task.status !== 'completed' && (
                        <div className="flex items-center justify-between text-[10px] bg-black/40 p-2 rounded-lg mt-1">
                          <div className="flex items-center gap-1 text-zinc-400">
                            <Clock size={10} />
                            <span>{isRtl ? 'آستانه هشدار سیستم:' : 'System warning threshold:'} <strong>{task.leadNotifyDays} {isRtl ? 'روز قبل' : 'days before'}</strong></span>
                          </div>
                          
                          {daysLeft > 0 ? (
                            <span className={`font-bold ${isWarningTriggered ? 'text-red-400 animate-pulse font-black' : 'text-zinc-400'}`}>
                              {isRtl ? `${daysLeft} روز مانده` : `${daysLeft} days remaining`}
                            </span>
                          ) : daysLeft === 0 ? (
                            <span className="text-amber-500 font-extrabold animate-bounce">
                              ⚠️ {isRtl ? 'امروز سررسید ممیزی است!' : 'Audit due today!'}
                            </span>
                          ) : (
                            <span className="text-red-500 font-extrabold animate-pulse">
                              ⚠️ {isRtl ? `${Math.abs(daysLeft)} روز تأخیر معوق` : `${Math.abs(daysLeft)} days overdue`}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
        </>
      ) : (
        <div className="space-y-6 animate-fade-in text-right">
          {/* Processes List Monitor Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeProcesses.map((proc) => {
              // Find tasks matching this process
              const procTasks = tasks.filter(t => t.processName === proc.name);
              const completedTasks = procTasks.filter(t => t.status === 'completed');
              const inProgressTasks = procTasks.filter(t => t.status === 'in_progress');
              const todoTasks = procTasks.filter(t => t.status === 'todo');
              const overdueTasks = procTasks.filter(t => {
                const taskDate = jalaliToGregorian(1405, t.month, t.day);
                const diffTime = taskDate.getTime() - new Date(2026, 6, 15).getTime();
                const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return t.status === 'overdue' || (t.status !== 'completed' && daysLeft < 0);
              });

              const totalCount = procTasks.length;
              const completionPercent = totalCount > 0 ? Math.round((completedTasks.length / totalCount) * 100) : 0;

              return (
                <div key={proc.key} className="bg-[#0E0E11] border border-zinc-800 rounded-2xl p-5 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-[10px] font-black text-amber-500 uppercase bg-amber-500/10 px-2 py-0.5 rounded">
                          {proc.type}
                        </span>
                        <h3 className="text-sm font-black text-white mt-1.5">{proc.name}</h3>
                      </div>
                      <span className="text-xs text-zinc-500 font-mono">
                        {proc.clauseId ? `بند ${proc.clauseId}` : 'بند ۴.۴'}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5 mb-4">
                      <div className="flex justify-between text-[10px] text-zinc-400">
                        <span>{isRtl ? 'درصد پیشرفت وظایف:' : 'Tasks Progress:'}</span>
                        <span className="font-bold text-white">{completionPercent}%</span>
                      </div>
                      <div className="w-full bg-[#161619] h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-emerald-500 h-full transition-all duration-300" 
                          style={{ width: `${completionPercent}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats mini grid */}
                    <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] mb-4">
                      <div className="bg-[#121215] p-1.5 rounded border border-zinc-800/40">
                        <div className="text-zinc-500 font-medium">{isRtl ? 'کل' : 'Total'}</div>
                        <div className="text-white font-bold">{totalCount}</div>
                      </div>
                      <div className="bg-[#121c15] p-1.5 rounded border border-emerald-950/40">
                        <div className="text-emerald-500 font-medium">{isRtl ? 'انجام' : 'Done'}</div>
                        <div className="text-emerald-400 font-bold">{completedTasks.length}</div>
                      </div>
                      <div className="bg-[#241c10] p-1.5 rounded border border-amber-950/40">
                        <div className="text-amber-500 font-medium">{isRtl ? 'جاری' : 'Active'}</div>
                        <div className="text-amber-400 font-bold">{inProgressTasks.length + todoTasks.length}</div>
                      </div>
                      <div className="bg-[#1c1212] p-1.5 rounded border border-red-950/40">
                        <div className="text-red-500 font-medium">{isRtl ? 'معوق' : 'Overdue'}</div>
                        <div className="text-red-400 font-bold">{overdueTasks.length}</div>
                      </div>
                    </div>

                    {/* Assigned Tasks List */}
                    <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1 text-right">
                      {procTasks.length === 0 ? (
                        <div className="text-center py-4 text-zinc-600 text-xs italic">
                          {isRtl ? 'هیچ وظیفه‌ای تخصیص نیافته است' : 'No tasks assigned yet'}
                        </div>
                      ) : (
                        procTasks.map(t => {
                          const catMeta = getCategoryMeta(t.category);
                          const prioBadge = getPriorityBadge(t.priority);
                          
                          // compute days left
                          const taskDate = jalaliToGregorian(1405, t.month, t.day);
                          const diffTime = taskDate.getTime() - new Date(2026, 6, 15).getTime();
                          const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                          const statMeta = getStatusMeta(t.status, daysLeft);

                          return (
                            <div 
                              key={t.id} 
                              onClick={() => {
                                handleEditTaskClick(t);
                                setSelectedMonth(t.month);
                              }}
                              className="bg-[#151518]/60 hover:bg-[#1D1D22] border border-zinc-800 hover:border-zinc-700/60 p-2.5 rounded-xl transition-all cursor-pointer text-right text-xs space-y-1.5 relative group"
                            >
                              <div className="flex justify-between items-start gap-1">
                                <span className="font-extrabold text-white text-[11px] line-clamp-1 group-hover:text-amber-400 transition-colors">
                                  {t.title}
                                </span>
                                <span className={`text-[8px] font-black uppercase shrink-0 px-1.5 py-0.5 rounded ${catMeta.color} bg-opacity-10 ${catMeta.textClass}`}>
                                  {catMeta.label}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[9px] text-zinc-400">
                                <span>📅 {t.day} {JALALI_MONTHS[t.month - 1].name}</span>
                                <span>👤 {t.auditor}</span>
                              </div>
                              <div className="flex justify-between items-center pt-1 border-t border-zinc-900">
                                <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold ${prioBadge.class}`}>
                                  {prioBadge.label}
                                </span>
                                <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold ${statMeta.color}`}>
                                  {statMeta.label}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Add task button on bottom */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTask(null);
                      setFormTitle('');
                      setFormCategory('internal_audit');
                      setFormDay(1);
                      setFormAuditor('');
                      setFormLeadNotifyDays(7);
                      setFormPriority('medium');
                      setFormStatus('todo');
                      setFormDescription('');
                      setFormProcessName(proc.name);
                      setIsFormOpen(true);
                    }}
                    className="w-full mt-4 bg-[#121215] hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>{isRtl ? 'افزودن وظیفه به این فرآیند' : 'Add Task to Process'}</span>
                  </button>
                </div>
              );
            })}

            {/* Unassigned/Other Tasks Card */}
            {(() => {
              const unassignedTasks = tasks.filter(t => !t.processName || !activeProcesses.some(p => p.name === t.processName));
              if (unassignedTasks.length === 0) return null;

              return (
                <div className="bg-[#0E0E11] border border-dashed border-zinc-800 rounded-2xl p-5 hover:border-amber-500/20 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-[10px] font-black text-zinc-450 bg-zinc-800 px-2 py-0.5 rounded">
                          {isRtl ? 'عمومی/متفرقه' : 'General'}
                        </span>
                        <h3 className="text-sm font-black text-zinc-300 mt-1.5">
                          {isRtl ? 'وظایف عمومی / سایر فرآیندها' : 'General & Other Tasks'}
                        </h3>
                      </div>
                    </div>

                    <div className="text-[11px] text-zinc-500 mb-4 leading-relaxed">
                      {isRtl 
                        ? 'این بخش شامل وظایفی است که فرآیند مشخصی برای آن‌ها انتخاب نشده یا فرآیند انتخابی خارج از فرآیندهای شناسنامه فرآیندها است.'
                        : 'These tasks are general system events or are not mapped to any specific turtle diagrams process.'}
                    </div>

                    <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1 text-right">
                      {unassignedTasks.map(t => {
                        const catMeta = getCategoryMeta(t.category);
                        const prioBadge = getPriorityBadge(t.priority);
                        const taskDate = jalaliToGregorian(1405, t.month, t.day);
                        const diffTime = taskDate.getTime() - new Date(2026, 6, 15).getTime();
                        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        const statMeta = getStatusMeta(t.status, daysLeft);

                        return (
                          <div 
                            key={t.id} 
                            onClick={() => {
                              handleEditTaskClick(t);
                              setSelectedMonth(t.month);
                            }}
                            className="bg-[#151518]/60 hover:bg-[#1D1D22] border border-zinc-800 hover:border-zinc-700/60 p-2.5 rounded-xl transition-all cursor-pointer text-right text-xs space-y-1.5 relative group"
                          >
                            <div className="flex justify-between items-start gap-1">
                              <span className="font-extrabold text-white text-[11px] line-clamp-1 group-hover:text-amber-400 transition-colors">
                                {t.title}
                              </span>
                              <span className={`text-[8px] font-black uppercase shrink-0 px-1.5 py-0.5 rounded ${catMeta.color} bg-opacity-10 ${catMeta.textClass}`}>
                                {catMeta.label}
                              </span>
                            </div>
                            <div className="flex justify-between items-center text-[9px] text-zinc-400">
                              <span>📅 {t.day} {JALALI_MONTHS[t.month - 1].name}</span>
                              <span>👤 {t.auditor}</span>
                            </div>
                            <div className="flex justify-between items-center pt-1 border-t border-zinc-900">
                              <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold ${prioBadge.class}`}>
                                {prioBadge.label}
                              </span>
                              <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-bold ${statMeta.color}`}>
                                {statMeta.label}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          
          {activeProcesses.length === 0 && (
            <div className="text-center py-12 bg-[#0E0E11] border border-dashed border-zinc-800 rounded-2xl">
              <div className="text-zinc-500 mb-2 text-sm">
                {isRtl 
                  ? 'هیچ فرآیندی در شناسنامه فرآیندها (لاک‌پشتی بند ۴.۴) تعریف نشده است.'
                  : 'No organization business processes are defined in Clause 4.4 profiles.'}
              </div>
              <p className="text-xs text-zinc-600 max-w-md mx-auto">
                {isRtl 
                  ? 'لطفاً ابتدا اسناد بند ۴.۴ را تکمیل نمایید تا فرآیندها به صورت هوشمند و خودکار به تقویم متصل شوند.'
                  : 'Please complete Clause 4.4 Process profiles to unlock smart process-linked schedules.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Floating Modal Task Form for Process Monitor Mode */}
      {isFormOpen && activeCalendarTab === 'processes' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in" dir={isRtl ? 'rtl' : 'ltr'}>
          <div className="bg-[#0F0F12] border border-amber-500/30 rounded-2xl p-6 shadow-2xl relative max-w-md w-full max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                setIsFormOpen(false);
                setEditingTask(null);
              }}
              className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-xs`}
            >
              ✕
            </button>
            
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#222]">
              <Calendar className="text-amber-500" size={16} />
              <h4 className="text-xs font-black text-white">
                {editingTask 
                  ? (isRtl ? 'ویرایش برنامه ممیزی فرآیند' : 'Edit Process Task') 
                  : (isRtl ? 'تخصیص وظیفه جدید به فرآیند' : 'Assign New Task to Process')}
              </h4>
            </div>

            {renderTaskForm()}
          </div>
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
                className={`${confirmModal.confirmClass || 'bg-red-500 hover:bg-red-650 text-white'} px-5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-lg`}
              >
                {confirmModal.confirmLabel || (isRtl ? 'تأیید' : 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
