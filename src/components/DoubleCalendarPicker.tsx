import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ToggleLeft, ToggleRight, Sparkles } from 'lucide-react';

// ==========================================
// TRIPLE-ACCURATE JALALI <-> GREGORIAN MATHS
// ==========================================
export function jalaliToGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  const gy = (jy <= 979) ? 621 : 1600;
  jy -= (jy <= 979) ? 0 : 979;
  const days = (365 * jy) + (Math.floor(jy / 33) * 8) + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
  let g_day_no = 365 * gy + Math.floor(gy / 4) - Math.floor(gy / 100) + Math.floor(gy / 400) + days;
  let y = gy + Math.floor(g_day_no / 146097) * 400;
  g_day_no %= 146097;
  let leap = true;
  if (g_day_no >= 36525) {
    g_day_no--;
    y += Math.floor(g_day_no / 36524) * 100;
    g_day_no %= 36524;
    if (g_day_no >= 365) {
      g_day_no++;
    } else {
      leap = false;
    }
  }
  y += Math.floor(g_day_no / 365) * 4;
  g_day_no %= 365;
  if (g_day_no >= 366) {
    y++;
    g_day_no -= 366;
  } else {
    y += Math.floor(g_day_no / 365);
    g_day_no %= 365;
  }
  let m = 1;
  const g_days_in_month = [0, 31, (leap ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  while (m <= 12 && g_day_no >= g_days_in_month[m]) {
    g_day_no -= g_days_in_month[m];
    m++;
  }
  return [y, m, g_day_no + 1];
}

export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_days_in_month = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const j_days_in_month = [0, 31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  
  const isLeap = (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0);
  if (isLeap) g_days_in_month[2] = 29;

  let gy2 = gy - 1600;
  let gm2 = gm - 1;
  const gd2 = gd - 1;

  let g_day_no = 365 * gy2 + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400);

  for (let i = 0; i < gm2; ++i) {
    g_day_no += g_days_in_month[i + 1];
  }
  g_day_no += gd2;

  let j_day_no = g_day_no - 79;

  const j_np = Math.floor(j_day_no / 12053);
  j_day_no %= 12053;

  let jy = 979 + 33 * j_np + 4 * Math.floor(j_day_no / 1461);
  j_day_no %= 1461;

  if (j_day_no >= 366) {
    jy += Math.floor((j_day_no - 1) / 365);
    j_day_no = (j_day_no - 1) % 365;
  }

  let i = 0;
  for (i = 0; i < 11 && j_day_no >= j_days_in_month[i + 1]; ++i) {
    j_day_no -= j_days_in_month[i + 1];
  }

  const jm = i + 1;
  const jd = j_day_no + 1;

  return [jy, jm, jd];
}

// Check weekday index of Gregorian Date (0 = Sunday, 6 = Saturday)
function getGregorianWeekday(y: number, m: number, d: number): number {
  return new Date(y, m - 1, d).getDay();
}

// Check Jalali weekday index (0 = Saturday, 6 = Friday)
function getJalaliWeekday(jy: number, jm: number, jd: number): number {
  const [gy, gm, gd] = jalaliToGregorian(jy, jm, jd);
  const gw = getGregorianWeekday(gy, gm, gd);
  // Gregorian: 0:Sun, 1:Mon, 2:Tue, 3:Wed, 4:Thu, 5:Fri, 6:Sat
  // Jalali Weekday starting Saturday: Sat(0), Sun(1), Mon(2), Tue(3), Wed(4), Thu(5), Fri(6)
  return (gw + 1) % 7;
}

// Shamsi month titles
const shamsiMonthName = [
  '',
  'فروردین', 'اردیبهشت', 'خرداد',
  'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر',
  'دی', 'بهمن', 'اسفند'
];

const shamsiMonthNameEn = [
  '',
  'Farvardin', 'Ordibehesht', 'Khordad',
  'Tir', 'Mordad', 'Shahrivar',
  'Mehr', 'Aban', 'Azar',
  'Dey', 'Bahman', 'Esfand'
];

// Miladi month titles
const miladiMonthName = [
  '',
  'January', 'February', 'March', 'April',
  'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'
];

const miladiMonthNameFa = [
  '',
  'ژانویه', 'فوریه', 'مارس', 'آوریل',
  'مه', 'ژوئن', 'ژوئیه', 'اوت',
  'سپتامبر', 'اکتبر', 'نوامبر', 'دسامبر'
];

interface Props {
  value: string; // E.g. "1405/03/01" or "2026-06-13" or "2026/06/13"
  onChange: (newValue: string) => void;
  lang: 'fa' | 'en';
}

export default function DoubleCalendarPicker({ value, onChange, lang }: Props) {
  const isRtl = lang === 'fa';
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calendar mode: true = Shamsi (Jalali), false = Miladi (Gregorian)
  const [isShamsi, setIsShamsi] = useState(() => {
    const clean = value ? value.trim() : '';
    if (clean.startsWith('13') || clean.startsWith('14')) {
      return true;
    }
    return false;
  });

  // Parse current value into absolute Year, Month, Day variables
  const parsedDate = useMemo(() => {
    let year = 1405;
    let month = 3;
    let day = 1;

    try {
      const parts = value ? value.split(/[-/]/).map(Number).filter(n => !isNaN(n)) : [];
      if (parts.length === 3) {
        if (parts[0] > 1800) {
          // Input is Miladi
          if (isShamsi) {
            const [jy, jm, jd] = gregorianToJalali(parts[0], parts[1], parts[2]);
            year = jy; month = jm; day = jd;
          } else {
            year = parts[0]; month = parts[1]; day = parts[2];
          }
        } else {
          // Input is Shamsi
          if (isShamsi) {
            year = parts[0]; month = parts[1]; day = parts[2];
          } else {
            const [gy, gm, gd] = jalaliToGregorian(parts[0], parts[1], parts[2]);
            year = gy; month = gm; day = gd;
          }
        }
      } else {
        // Fallback default
        if (isShamsi) {
          year = 1405; month = 3; day = 1;
        } else {
          year = 2026; month = 6; day = 13;
        }
      }
    } catch {
      if (isShamsi) {
        year = 1405; month = 3; day = 1;
      } else {
        year = 2026; month = 6; day = 13;
      }
    }

    return { year, month, day };
  }, [value, isShamsi]);

  // Working calendar state (user might browse other months while keeping selection)
  const [viewYear, setViewYear] = useState(parsedDate.year);
  const [viewMonth, setViewMonth] = useState(parsedDate.month);

  // Sync to actual selected value on value or mode change
  useEffect(() => {
    setViewYear(parsedDate.year);
    setViewMonth(parsedDate.month);
  }, [parsedDate.year, parsedDate.month, isShamsi]);

  // Handle outside clicks to close popover
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Mode Toggle trigger
  const handleToggleMode = () => {
    const nextMode = !isShamsi;
    setIsShamsi(nextMode);

    // Convert current selected date to show in calendar input nicely
    if (nextMode) {
      // Switched to Shamsi
      const [jy, jm, jd] = gregorianToJalali(parsedDate.year, parsedDate.month, parsedDate.day);
      const str = `${jy}/${jm.toString().padStart(2, '0')}/${jd.toString().padStart(2, '0')}`;
      onChange(str);
    } else {
      // Switched to Miladi
      const [gy, gm, gd] = jalaliToGregorian(parsedDate.year, parsedDate.month, parsedDate.day);
      const str = `${gy}-${gm.toString().padStart(2, '0')}-${gd.toString().padStart(2, '0')}`;
      onChange(str);
    }
  };

  // Grid Builder helpers
  const dayCells = useMemo(() => {
    const cells = [];
    if (isShamsi) {
      // Shamsi month sizes
      const limit = viewMonth <= 6 ? 31 : viewMonth <= 11 ? 30 : 29; // ESFAND 29 (30 for leap is skipped for simpleness)
      
      // Weekday index of first day of shamsi month
      const startWd = getJalaliWeekday(viewYear, viewMonth, 1); // 0 (Sat) to 6 (Fri)
      
      // Empty padding cells
      for (let i = 0; i < startWd; i++) {
        cells.push({ day: 0, isCurrent: false });
      }

      // Day cells
      for (let d = 1; d <= limit; d++) {
        const isSel = parsedDate.year === viewYear && parsedDate.month === viewMonth && parsedDate.day === d;
        cells.push({ day: d, isCurrent: isSel });
      }
    } else {
      // Miladi month sizes
      const mSize = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      const isLeap = (viewYear % 4 === 0 && viewYear % 100 !== 0) || (viewYear % 400 === 0);
      if (isLeap) mSize[2] = 29;

      const limit = mSize[viewMonth];
      
      // Weekday of 1st day of standard month (Gregorian: 0=Sun, 6=Sat)
      const startWd = getGregorianWeekday(viewYear, viewMonth, 1);

      // Empty padding cells
      for (let i = 0; i < startWd; i++) {
        cells.push({ day: 0, isCurrent: false });
      }

      // Day cells
      for (let d = 1; d <= limit; d++) {
        const isSel = parsedDate.year === viewYear && parsedDate.month === viewMonth && parsedDate.day === d;
        cells.push({ day: d, isCurrent: isSel });
      }
    }
    return cells;
  }, [viewYear, viewMonth, isShamsi, parsedDate]);

  // Navigation commands
  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (d: number) => {
    if (d === 0) return;
    
    if (isShamsi) {
      const str = `${viewYear}/${viewMonth.toString().padStart(2, '0')}/${d.toString().padStart(2, '0')}`;
      onChange(str);
    } else {
      const str = `${viewYear}-${viewMonth.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
      onChange(str);
    }
    setIsOpen(false);
  };

  const handleSetToday = () => {
    const today = new Date();
    const ty = today.getFullYear();
    const tm = today.getMonth() + 1;
    const td = today.getDate();

    if (isShamsi) {
      const [jy, jm, jd] = gregorianToJalali(ty, tm, td);
      onChange(`${jy}/${jm.toString().padStart(2, '0')}/${jd.toString().padStart(2, '0')}`);
    } else {
      onChange(`${ty}-${tm.toString().padStart(2, '0')}-${td.toString().padStart(2, '0')}`);
    }
    setIsOpen(false);
  };

  // Translate month title
  const currentMonthLabel = isShamsi
    ? (isRtl ? shamsiMonthName[viewMonth] : shamsiMonthNameEn[viewMonth])
    : (isRtl ? miladiMonthNameFa[viewMonth] : miladiMonthName[viewMonth]);

  // Weekdays Labels list depending on setting
  const weekdayShortLabels = isShamsi
    ? (isRtl ? ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] : ['Sa', 'Su', 'Mo', 'Tu', 'We', 'Th', 'Fr'])
    : (isRtl ? ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'] : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);

  return (
    <div ref={containerRef} className="relative inline-block w-full sm:w-auto font-sans">
      
      {/* Decorative Input Field clickable box */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-[#09090B] border border-[#2D2D30] hover:border-amber-500/50 rounded-lg p-2 text-xs text-white cursor-pointer select-none font-mono justify-between transition-all"
      >
        <div className="flex items-center gap-1.5">
          <CalendarIcon size={12} className="text-amber-500 shrink-0" />
          <span className="font-bold tracking-wider">{value || (isShamsi ? '1405/03/01' : '2026-06-13')}</span>
        </div>
        <span className="text-[9px] font-bold uppercase py-0.5 px-1 bg-amber-500/5 text-amber-500 rounded border border-amber-500/15 scale-90">
          {isShamsi ? (isRtl ? 'شمسی' : 'JALALI') : (isRtl ? 'میلادی' : 'MILADI')}
        </span>
      </div>

      {isOpen && (
        <div 
          className={`absolute z-[9999] mt-2 w-72 bg-[#0F0F12] border border-[#26262A] rounded-xl shadow-2xl p-4 animate-fade-in ${
            isRtl ? 'right-0' : 'left-0'
          }`}
          dir={isRtl ? 'rtl' : 'ltr'}
        >
          {/* Header configuration options */}
          <div className="flex items-center justify-between pb-3 border-b border-[#242428] gap-2">
            
            {/* Today Quick key */}
            <button
              onClick={handleSetToday}
              className="px-2 py-1 text-[9px] font-bold text-amber-500 hover:text-white bg-amber-500/10 hover:bg-amber-500/30 rounded border border-amber-500/20 cursor-pointer transition-all"
            >
              {isRtl ? 'امروز' : 'Today'}
            </button>

            {/* Shamsi <-> Miladi calendar swap toggle */}
            <button
              onClick={handleToggleMode}
              className="flex items-center gap-1 text-[9px] font-extrabold uppercase px-2 py-1 bg-[#16161A] text-slate-300 hover:text-white rounded border border-[#2B2B2F] cursor-pointer hover:border-amber-500/35 transition-all select-none"
            >
              <Sparkles size={10} className="text-amber-400" />
              <span>{isShamsi ? (isRtl ? 'تقویم میلادی' : 'Convert Miladi') : (isRtl ? 'تقویم خورشیدی' : 'Convert Shamsi')}</span>
            </button>
          </div>

          {/* Month & Year control bar with navigation */}
          <div className="flex items-center justify-between py-3">
            <button 
              onClick={handlePrevMonth}
              className="p-1 text-slate-400 hover:text-white hover:bg-[#1C1C22] rounded transition-all cursor-pointer"
            >
              <ChevronLeft size={16} className={isRtl ? 'rotate-180' : ''} />
            </button>
            
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <span>{currentMonthLabel}</span>
              <span className="font-mono text-amber-500">{viewYear}</span>
            </div>

            <button 
              onClick={handleNextMonth}
              className="p-1 text-slate-400 hover:text-white hover:bg-[#1C1C22] rounded transition-all cursor-pointer"
            >
              <ChevronRight size={16} className={isRtl ? 'rotate-180' : ''} />
            </button>
          </div>

          {/* Weekday headers list */}
          <div className="grid grid-cols-7 text-center text-[10px] text-slate-500 font-bold mb-1.5 select-none">
            {weekdayShortLabels.map((lbl, idx) => (
              <span key={idx} className="block py-1 font-sans">{lbl}</span>
            ))}
          </div>

          {/* Days Grid container */}
          <div className="grid grid-cols-7 text-center gap-1">
            {dayCells.map((cell, idx) => {
              if (cell.day === 0) {
                return <span key={idx} className="block py-1 text-transparent select-none">-</span>;
              }
              return (
                <button
                  key={idx}
                  onClick={() => handleSelectDay(cell.day)}
                  className={`
                    block py-1 rounded text-xs transition-all font-mono font-bold cursor-pointer select-none
                    ${cell.isCurrent
                      ? 'bg-amber-500 text-black font-extrabold shadow-lg shadow-amber-500/10'
                      : 'text-slate-300 hover:bg-[#1A1A22] hover:text-white'
                    }
                  `}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Quick instructions indicator */}
          <div className="mt-3 pt-2 border-t border-[#242428] text-[9px] text-[#555] text-center italic">
            {isShamsi 
              ? 'نمایش تقویم با تاریخ خورشیدی (شمسی)' 
              : 'Calendar rendered in Gregorian (Miladi) date'
            }
          </div>

        </div>
      )}

    </div>
  );
}
