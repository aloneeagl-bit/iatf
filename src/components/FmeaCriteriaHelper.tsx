import React, { useState } from 'react';
import { X, Check, Info, FileText, Activity, AlertOctagon, ShieldAlert, Sliders, Trash2, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';

interface FmeaCriteriaHelperProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'severity' | 'occurrence' | 'detection';
  setActiveTab: (tab: 'severity' | 'occurrence' | 'detection') => void;
  onSelectScore: (score: number) => void;
  selectedCellInfo: { itemId: string; colId: string; currentVal: number } | null;
  isRtl: boolean;
}

// ----------------------------------------------------
// Core Datasets Transcribed Exactly from PDF Document
// ----------------------------------------------------

export interface SeverityItem {
  score: number;
  effect: string;
  effectEn: string;
  domains: {
    product: string; // محصول (قطعه/خودرو)
    builderLine: string; // خط تولید خودروساز
    customerLine: string; // خط تولید مشتری (قطعه‌ساز)
    localLine: string; // خط تولید قطعه‌ساز
    consumer: string; // مصرف‌کننده
    service: string; // خدمات پس از فروش
  };
}

export interface OccurrenceItem {
  score: number;
  cpk: string;
  ratio: string;
  effect: string;
  ppk: string;
  ppkRatio: string;
  occurrenceOdds: string;
}

export interface DetectionItem {
  score: number;
  detectionText: string;
  criterion: string;
  inspections: {
    A: boolean; // ضد خطاسازی (Poka-Yoke)
    B: boolean; // گیج
    C: boolean; // طرح بازرسی
  };
  rangeMethods: string;
}

const severityData: SeverityItem[] = [
  {
    score: 10,
    effect: 'بسیار خطرناک - عدم انطباق ایمنی یا قوانین دولتی بدون هشدار قبلی',
    effectEn: 'Hazardous without warning (Safety or regulatory non-compliance)',
    domains: {
      product: 'حالت خرابی بالقوه بر ایمنی عملکردی محصول اثر می‌گذارد و / یا شامل عدم تطابق با قوانین دولتی مستقل بدون هشدار قبلی می‌باشد.',
      builderLine: 'ممکن است اپراتور خطوط تولید بدون هشدار قبلی به خطر بیافتد. / بدون هشدار قبلی مقررات دولتی را نقض نماید.',
      customerLine: 'ممکن است اپراتور خط مونتاژ مشتری را بدون هشدار به خطر اندازد، / بدون هشدار قبلی مقررات دولتی را نقض نماید.',
      localLine: 'ممکن است بدون هشدار قبلی خطرات جانی برای اپراتور ماشین یا مونتاژ سازمان داشته باشد.',
      consumer: 'نقص و یا خرابی که بدون هشدار قبلی بر ایمنی سرنشین خودرو و یا اطرافیان خودرو تاثیر بگذارد./ بدون هشدار قبلی مقررات دولتی را نقض نماید.',
      service: 'ممکن است اپراتور تعمیرات (خدمات پس از فروش) بدون هشدار قبلی به خطر بیافتد.'
    }
  },
  {
    score: 9,
    effect: 'بسیار خطرناک - عدم انطباق ایمنی یا قوانین دولتی با هشدار قبلی',
    effectEn: 'Hazardous with warning (Safety or regulatory non-compliance)',
    domains: {
      product: 'حالت خرابی بالقوه بر ایمنی عملکردی محصول کارایی می‌گذارد و / یا شامل عدم تطابق با قوانین دولتی با هشدار قبلی می‌باشد.',
      builderLine: 'ممکن است اپراتور خطوط تولید با هشدار قبلی به خطر بیافتد / توقف تولید بیش از ۲ ساعت / ۱۰۰٪ محصولات نهایی درجه دو می‌گردد.',
      customerLine: 'ممکن است اپراتور خط مونتاژ مشتری را با هشدار قبلی به خطر اندازد، / و یا با هشدار قبلی مقررات دولتی را نقض نماید.',
      localLine: 'ممکن است با هشدار ماشین یا مونتاژ سازمان را با هشدار قبلی به خطر اندازد.',
      consumer: 'نقص و یا خرابی که با هشدار قبلی بر ایمنی سرنشین خودرو و یا اطرافیان خودرو تاثیر بگذارد./ و یا با هشدار قبلی مقررات دولتی را نقض نماید.',
      service: 'ممکن است اپراتور تعمیرات (خدمات پس از فروش) با هشدار قبلی به خطر بیافتد.'
    }
  },
  {
    score: 8,
    effect: 'فقدان عملکرد اصلی محصول (نارضایتی بسیار شدید)',
    effectEn: 'Loss of primary function (Very high dissatisfaction)',
    domains: {
      product: 'فقدان عملکرد اولیه (محصول کار نمی‌کند و بر ایمنی عملکردی محصول اثر ندارد).',
      builderLine: 'توقف خط تولید بین ۱ تا ۲ ساعت / ۱۰۰٪ محصولات نیاز به بازکاری داشته و منجر به خروج محصول از فرآیند تولید گردد. / بخشی از محصولات نهایی درجه دو می‌گردد.',
      customerLine: 'عدم مونتاژ یا عدم عملکرد محصول در خط مشتری / توقف تولید خط مشتری بین ۱ تا ۲ ساعت.',
      localLine: '۱۰۰٪ محصول نهایی بدون امکان بازکاری اسقاط شود.',
      consumer: 'اخلال در عملکرد اصلی محصول ایجاد شود. عملکرد اصلی محصول از بین می‌رود. خودرو کار نکند / خودرو خاموش گردد / متوقف گردد / عدم انطباق که باعث آسیب رسیدن به برند می‌گردد و میزان فروش پایین می‌رود. هر گونه نارضایتی مشتری که منجر به شکایت مشتری گردد و باعث تعویض خودرو گردد.',
      service: 'عدم انطباق منجر به تعویض قطعه در دوره گارانتی گردد. / توقف خودرو بیش از ۲ روز در نمایندگی.'
    }
  },
  {
    score: 7,
    effect: 'کاهش عملکرد اصلی محصول (نارضایتی شدید)',
    effectEn: 'Reduced primary function performance',
    domains: {
      product: 'تضعیف عملکرد اولیه (محصول کار می‌کند اما کارایی کمی دارد).',
      builderLine: 'توقف خط تولید زیر یک ساعت / ۱۰۰٪ محصولات نیاز به بازکاری روی خط تولید دارد. / بخشی از محصول نهایی خارج از خط تولید نیاز به بازکاری دارد.',
      customerLine: 'اختلال در فرآیند مشتری / توقف تولید زیر یک ساعت / ۱۰۰٪ محصولات نیاز به بازکاری روی خط تولید دارد. / بخشی از محصول نهایی خارج از خط تولید نیاز به بازکاری دارد.',
      localLine: '۱۰۰٪ محصول نهایی نیاز به بازکاری دارد و بخشی از آن پس از بازکاری اسقاط می‌شود. هزینه خرابی محصول نیمه ساخته بیشتر از ۳۰٪ قیمت تمام شده محصول نهایی باشد.',
      consumer: 'اجزاء محصول با عملکرد نامناسب کار می‌کنند به نحوی که عیب صراحتاً غیر قابل تحمل بوده و نیاز مبرم به رفع آن داشته و باعث ایجاد نارضایتی شدید مصرف‌کننده می‌گردد. توقف خودرو ۲ روز در نمایندگی.',
      service: 'توقف خودرو ۲ روز در نمایندگی.'
    }
  },
  {
    score: 6,
    effect: 'فقدان عملکرد ثانویه و رفاهی محصول',
    effectEn: 'Loss of secondary/convenience function',
    domains: {
      product: 'فقدان عملکرد ثانویه (خودرو کار می‌کند اما عملکرد‌های تسهیلات/راحتی کار نمی‌کند).',
      builderLine: 'بخشی از محصولات روی خط تولید نیاز به بازکاری دارد / عدم انطباق باعث سخت مونتاژ روی ۱۰۰ درصد محصولات می‌گردد.',
      customerLine: 'اختلال در فرآیند مشتری / بخشی از محصولات روی خط تولید نیاز به بازکاری دارد / عدم انطباق باعث سخت مونتاژ روی ۱۰۰ درصد محصولات می‌گردد.',
      localLine: '۱۰۰٪ محصول نهایی جهت استفاده نیاز به بازکاری دارد که تماماً پس از بازکاری قابل استفاده است و یا هزینه خرابی محصول نیمه ساخته بین ۲۰ تا ۳۰ ٪ قیمت تمام شده محصول نهایی باشد.',
      consumer: 'اجزاء محصول با عملکرد نامناسب کار می‌کند به نحوی که مشتری بسیار ناراضی است. عیوب مهمی که توسط مشتری حتماً دیده می‌شود، عمدتاً درخواست تعمیر داده شده و ناراحتی ایجاد نماید.',
      service: 'توقف خودرو یک روز در نمایندگی.'
    }
  },
  {
    score: 5,
    effect: 'کاهش کارایی عملکرد ثانویه و رفاهی',
    effectEn: 'Reduced secondary function performance',
    domains: {
      product: 'تضعیف عملکرد ثانویه (خودرو کار می‌کند اما عملکردهای تسهیلات/راحتی کارایی کمی دارند).',
      builderLine: 'عدم انطباق باعث سخت مونتاژ روی بخشی از محصولات می‌گردد.',
      customerLine: 'عدم انطباق باعث سخت مونتاژ روی بخشی از محصولات می‌گردد.',
      localLine: 'هزینه خرابی محصول نیمه ساخته بین ۱۵ تا ۲۰ ٪ قیمت تمام شده محصول نهایی باشد.',
      consumer: 'محصول کار می‌کند و عیب قابل تشخیص است و توسط مشتری دیده شده ولی برخی مشتریان نیاز به تعمیر و اصلاح دارند.',
      service: 'بدون اثر ملموس در گارانتی یا توقف نمایندگی.'
    }
  },
  {
    score: 4,
    effect: 'عیوب ظاهری یا صوتی آزاردهنده (دید بالا)',
    effectEn: 'Aesthetic / acoustic defects noticed by most (>75%)',
    domains: {
      product: 'صداهای غیر عادی شنیده می‌شوند، خودرو کار می‌کند، آیتم‌های خودرو منطبق بوده و اغلب مشتریان متوجه ایراد می‌شوند (بیشتر از ۷۵٪).',
      builderLine: 'عدم انطباق نیاز به اصلاح نداشته باشد.',
      customerLine: '—',
      localLine: 'هزینه خرابی محصول نیمه ساخته بین ۱۰ تا ۱۵ ٪ قیمت تمام شده محصول نهایی باشد.',
      consumer: 'خودرو کار می‌کند و عیب قابل کشف است به نحوی که توسط عموم مشتریان دیده نشود ولی در صورت رویت مشتریان، اغلب مشتریان نیاز به تعمیر و اصلاح دارند.',
      service: '—'
    }
  },
  {
    score: 3,
    effect: 'عیوب ظاهری یا صوتی متوسط (دید متوسط)',
    effectEn: 'Aesthetic / acoustic defects noticed by many (50%)',
    domains: {
      product: 'صداهای غیر عادی شنیده می‌شوند، خودرو کار می‌کند، آیتم‌های خودرو منطبق بوده و بسیاری از مشتریان متوجه ایراد می‌شوند (۵۰٪).',
      builderLine: '—',
      customerLine: '—',
      localLine: 'هزینه خرابی محصول نیمه ساخته بین ۵ تا ۱۰ ٪ قیمت تمام شده محصول نهایی باشد.',
      consumer: 'خودرو کار می‌کند و عیب قابل کشف است به نحوی که توسط عموم مشتریان دیده نشود ولی در صورت رویت مشتریان، برخی از مشتریان نیاز به تعمیر و اصلاح دارند.',
      service: '—'
    }
  },
  {
    score: 2,
    effect: 'عیوب ظاهری یا صوتی جزئی (دید کم)',
    effectEn: 'Aesthetic / acoustic defects noticed by few (<25%)',
    domains: {
      product: 'صداهای غیر عادی شنیده می‌شوند، خودرو کار می‌کند، آیتم‌های خودرو منطبق بوده و برخی از مشتریان متوجه ایراد می‌شوند (کمتر از ۲۵٪).',
      builderLine: '—',
      customerLine: '—',
      localLine: 'هزینه خرابی محصول نیمه ساخته کمتر از ۵٪ قیمت تمام شده محصول نهایی باشد.',
      consumer: 'عدم انطباق جزئی که معمولاً دکمه تعمیر بر روی آن زده نمی‌شود.',
      service: '—'
    }
  },
  {
    score: 1,
    effect: 'بدون اثر ملحوظ',
    effectEn: 'No discernible effect / completely unnoticed',
    domains: {
      product: 'هیچ اثری ندارد.',
      builderLine: '—',
      customerLine: '—',
      localLine: 'بدون اثر یا اثر بسیار ناچیز بر عملیات تولیدی دارد.',
      consumer: 'مشتری متوجه عیب نمی‌گردد.',
      service: '—'
    }
  }
];

const occurrenceData: OccurrenceItem[] = [
  {
    score: 10,
    cpk: 'CPK < 0.33',
    ratio: '۱ خرابی در ۲ مورد',
    effect: 'خیلی زیاد، خراب اجتناب‌ناپذیر است.',
    ppk: 'Ppk < 0.55',
    ppkRatio: 'بزرگتر یا مساوی ۱۰۰ مورد در هر ۱۰۰۰ مورد یا خودرو',
    occurrenceOdds: 'خیلی زیاد: احتمال خرابی مکرر و بسیار بالا'
  },
  {
    score: 9,
    cpk: 'CPK >= 0.33',
    ratio: '۱ خرابی در ۳ مورد',
    effect: 'خیلی زیاد، خراب اجتناب‌ناپذیر است.',
    ppk: 'Ppk >= 0.55',
    ppkRatio: 'بزرگتر یا مساوی ۵۰ مورد در هر ۱۰۰۰ مورد یا خودرو',
    occurrenceOdds: 'خیلی زیاد: احتمال خرابی مکرر و بسیار بالا'
  },
  {
    score: 8,
    cpk: 'CPK >= 0.51',
    ratio: '۱ خرابی در ۸ مورد',
    effect: 'زیاد: خرابی‌های مکرر مشابه فرآیندهایی که در گذشته غالباً خرابی داشته‌اند.',
    ppk: 'Ppk >= 0.78',
    ppkRatio: 'بزرگتر یا مساوی ۲۰ مورد در هر ۱۰۰۰ مورد یا خودرو',
    occurrenceOdds: 'بالا: خرابی مکرر'
  },
  {
    score: 7,
    cpk: 'CPK >= 0.67',
    ratio: '۱ خرابی در ۲۰ مورد',
    effect: 'زیاد: خرابی‌های مکرر مشابه فرآیندهایی که در گذشته غالباً خرابی داشته‌اند.',
    ppk: 'Ppk >= 0.86',
    ppkRatio: 'بزرگتر یا مساوی ۱۰ مورد در هر ۱۰۰۰ مورد یا خودرو',
    occurrenceOdds: 'بالا: خرابی مکرر'
  },
  {
    score: 6,
    cpk: 'CPK >= 0.82',
    ratio: '۱ خرابی در ۸۰ مورد',
    effect: 'متوسط: خرابی‌های گاه‌وبیگاه، مشابه فرآیندهایی که گاه خرابی داشته ولی نه خرابی عمده.',
    ppk: 'Ppk >= 0.94',
    ppkRatio: 'بزرگتر یا مساوی ۵ مورد در هر ۱۰۰۰ مورد یا خودرو',
    occurrenceOdds: 'متوسط: احتمال گاه‌وبیگاه'
  },
  {
    score: 5,
    cpk: 'CPK >= 1.00',
    ratio: '۱ خرابی در ۴۰۰ مورد',
    effect: 'متوسط: خرابی‌های گاه‌وبیگاه، مشابه فرآیندهایی که گاه خرابی داشته ولی نه خرابی عمده.',
    ppk: 'Ppk >= 1.00',
    ppkRatio: 'بزرگتر یا مساوی ۲ مورد در هر ۱۰۰۰ مورد یا خودرو',
    occurrenceOdds: 'متوسط: احتمال گاه‌وبیگاه'
  },
  {
    score: 4,
    cpk: 'CPK >= 1.17',
    ratio: '۱ خرابی در ۲۰۰۰ مورد',
    effect: 'متوسط: خرابی‌های گاه‌وبیگاه، مشابه فرآیندهایی که گاه خرابی داشته ولی نه خرابی عمده.',
    ppk: 'Ppk >= 1.10',
    ppkRatio: 'بزرگتر یا مساوی ۱ مورد در هر ۱۰۰۰ مورد یا خودرو',
    occurrenceOdds: 'متوسط: احتمال گاه‌وبیگاه'
  },
  {
    score: 3,
    cpk: 'CPK >= 1.33',
    ratio: '۱ خرابی در ۱۵۰۰۰ مورد',
    effect: 'پایین: تعداد اندکی خرابی، خرابی‌های منفرد (ایزوله) مرتبط با فرآیندهای مشابه.',
    ppk: 'Ppk >= 1.20',
    ppkRatio: 'بزرگتر یا مساوی ۰.۵ مورد در هر ۱۰۰۰ مورد یا خودرو',
    occurrenceOdds: 'پایین: خرابی‌های نسبتاً کم'
  },
  {
    score: 2,
    cpk: 'CPK >= 1.50',
    ratio: '۱ خرابی در ۱۵۰۰۰۰ مورد',
    effect: 'پایین: تعداد اندکی خرابی، خرابی‌های منفرد (ایزوله) مرتبط با فرآیندهای مشابه.',
    ppk: 'Ppk >= 1.30',
    ppkRatio: 'بزرگتر یا مساوی ۰.۱ مورد در هر ۱۰۰۰ مورد یا خودرو',
    occurrenceOdds: 'پایین: خرابی‌های نسبتاً کم'
  },
  {
    score: 1,
    cpk: 'CPK >= 1.67',
    ratio: 'کمتر از ۱ خرابی در ۱۵۰۰۰۰۰ مورد',
    effect: 'نادر: خرابی بعید است. هیچ خرابی در فرآیندهای مشابه ثبت نشده است.',
    ppk: 'Ppk >= 1.67',
    ppkRatio: 'بزرگتر یا مساوی ۰.۰۱ مورد در هر ۱۰۰۰ مورد یا خودرو',
    occurrenceOdds: 'نادر: احتمال خرابی بعید'
  }
];

const detectionData: DetectionItem[] = [
  {
    score: 10,
    detectionText: 'غیرممکن / یقیناً غیرقابل کشف',
    criterion: 'یقیناً تشخیص وجود ندارد',
    inspections: { A: false, B: false, C: true },
    rangeMethods: 'بازرسی نشده و یا نمی‌توان تشخیص داد.'
  },
  {
    score: 9,
    detectionText: 'بسیار ناچیز',
    criterion: 'کنترل‌ها به احتمال زیاد تشخیص ندارند',
    inspections: { A: false, B: false, C: true },
    rangeMethods: 'کنترل‌ها فقط به صورت رندوم یا غیرمستقیم انجام می‌شود.'
  },
  {
    score: 8,
    detectionText: 'ناچیز',
    criterion: 'کنترل‌ها شانس بسیار کمی برای تشخیص دارند',
    inspections: { A: false, B: false, C: true },
    rangeMethods: 'کنترل‌ها به صورت بازرسی چشمی انجام می‌شوند.'
  },
  {
    score: 7,
    detectionText: 'خیلی کم',
    criterion: 'کنترل‌ها شانس بسیار کمی برای تشخیص دارند',
    inspections: { A: false, B: false, C: true },
    rangeMethods: 'کنترل‌ها به صورت بازرسی چشمی دوبار انجام می‌شوند.'
  },
  {
    score: 6,
    detectionText: 'کم',
    criterion: 'کنترل‌ها ممکن است تشخیص دهند',
    inspections: { A: false, B: true, C: true },
    rangeMethods: 'کنترل با روش‌های نموداری مانند SPC انجام می‌شود.'
  },
  {
    score: 5,
    detectionText: 'متوسط',
    criterion: 'کنترل‌ها ممکن است تشخیص دهند',
    inspections: { A: false, B: true, C: false },
    rangeMethods: 'کنترل بر اساس گیج‌های کمی بعد از آنکه قطعات از آن ایستگاه منتقل شدند یا با گیج‌های برو و نرو بر اساس بازرسی صددرصد بعد از آنکه قطعات از آن ایستگاه منتقل شدند.'
  },
  {
    score: 4,
    detectionText: 'متوسط متمایل به زیاد',
    criterion: 'کنترل‌ها شانس خوبی برای تشخیص دارند',
    inspections: { A: true, B: true, C: false },
    rangeMethods: 'تشخیص خرابی در عملیات مرحله بعدی با گیج زدن زمان تنظیم و کنترل اولین قطعه (گیج زدن فقط برروی عوامل مربوط به تنظیم اولیه).'
  },
  {
    score: 3,
    detectionText: 'زیاد',
    criterion: 'کنترل‌ها شانس خوبی برای تشخیص دارند',
    inspections: { A: true, B: true, C: false },
    rangeMethods: 'خطا در همان ایستگاه شناسایی می‌شود یا در عملیات بعدی توسط چندین سطح پذیرش (عرضه، انتخاب، نصب، تصدیق نمودن قطعات نامناسب پذیرش نمی‌شوند).'
  },
  {
    score: 2,
    detectionText: 'خیلی زیاد',
    criterion: 'کنترل‌ها تقریباً همیشه عیوب را تشخیص می‌دهند',
    inspections: { A: true, B: true, C: false },
    rangeMethods: 'خطا در همان ایستگاه تشخیص داده می‌شود (گیج زنی اتوماتیک همراه با توقف اتوماتیک) قطعه خراب نمی‌تواند از این مرحله بگذرد.'
  },
  {
    score: 1,
    detectionText: 'یقیناً قابل کشف / ضد خطاسازی شده',
    criterion: 'کنترل حتماً تشخیص می‌دهد',
    inspections: { A: true, B: false, C: false },
    rangeMethods: 'قطعات خراب نمی‌توانند تولید شوند زیرا مشخصه توسط طراحی محصول یا فرآیند ضد خطاسازی (Poka-Yoke) شده است.'
  }
];

export const FmeaCriteriaPanel: React.FC<FmeaCriteriaHelperProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  onSelectScore,
  selectedCellInfo,
  isRtl,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // States to hold uploaded smart custom criteria
  const [customSeverity, setCustomSeverity] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('fmea_custom_criteria_severity');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [customOccurrence, setCustomOccurrence] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('fmea_custom_criteria_occurrence');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [customDetection, setCustomDetection] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('fmea_custom_criteria_detection');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Determines whether we view 'standard' or 'custom' criteria list
  const [criteriaMode, setCriteriaMode] = useState<'standard' | 'custom'>(() => {
    try {
      const s = localStorage.getItem('fmea_custom_criteria_severity');
      const o = localStorage.getItem('fmea_custom_criteria_occurrence');
      const d = localStorage.getItem('fmea_custom_criteria_detection');
      if (s || o || d) return 'custom';
    } catch {}
    return 'standard';
  });

  const defaultCustomSeverity = severityData.map(item => ({
    score: item.score,
    effect: item.effect,
    detail: [
      item.domains.product !== '—' ? `${isRtl ? 'محصول / قطعه' : 'Product'}: ${item.domains.product}` : '',
      item.domains.builderLine !== '—' ? `${isRtl ? 'خط تولید خودروساز' : 'Automaker Line'}: ${item.domains.builderLine}` : '',
      item.domains.customerLine !== '—' ? `${isRtl ? 'خط مونتاژ مشتری' : 'Customer Line'}: ${item.domains.customerLine}` : '',
      item.domains.localLine !== '—' ? `${isRtl ? 'خط تولید ما' : 'Local Line'}: ${item.domains.localLine}` : '',
      item.domains.consumer !== '—' ? `${isRtl ? 'مصرف‌کننده نهایی' : 'Consumer'}: ${item.domains.consumer}` : '',
      item.domains.service !== '—' ? `${isRtl ? 'خدمات پس از فروش' : 'Warranty'}: ${item.domains.service}` : ''
    ].filter(Boolean).join(' | ')
  }));

  const defaultCustomOccurrence = occurrenceData.map(item => ({
    score: item.score,
    effect: item.occurrenceOdds,
    detail: [
      `${isRtl ? 'نرخ خرابی' : 'Odds Ratio'}: ${item.ratio || ''} | Cpk: ${item.cpk || ''}`,
      `${isRtl ? 'خط تولید سازمان (Ppk)' : 'Ppk'}: ${item.ppk || ''} - ${item.ppkRatio || ''}`,
      item.effect ? `${isRtl ? 'شرح اثر' : 'Effect'}: ${item.effect}` : ''
    ].filter(Boolean).join(' | ')
  }));

  const defaultCustomDetection = detectionData.map(item => ({
    score: item.score,
    effect: `${isRtl ? 'قابلیت تشخیص' : 'Detection text'}: ${item.detectionText}`,
    detail: [
      `${isRtl ? 'انواع بازرسی' : 'Inspections'}: ${[item.inspections.A ? 'A' : '', item.inspections.B ? 'B' : '', item.inspections.C ? 'C' : ''].filter(Boolean).join('-')}`,
      item.rangeMethods ? `${isRtl ? 'روش‌های پیشنهادی' : 'Suggested range/methods'}: ${item.rangeMethods || ''}` : '',
      item.criterion ? `${isRtl ? 'معیار' : 'Criterion'}: ${item.criterion || ''}` : ''
    ].filter(Boolean).join(' | ')
  }));

  const activeCustomList = activeTab === 'severity'
    ? (customSeverity || defaultCustomSeverity)
    : activeTab === 'occurrence'
    ? (customOccurrence || defaultCustomOccurrence)
    : (customDetection || defaultCustomDetection);

  const hasCustomUploaded = activeTab === 'severity'
    ? customSeverity !== null
    : activeTab === 'occurrence'
    ? customOccurrence !== null
    : customDetection !== null;

  if (!isOpen) return null;

  const parseExcelData = (sheetData: any[][]) => {
    if (!sheetData || sheetData.length === 0) return [];

    let scoreColIdx = -1;
    let textColIdx = -1;

    const colStats = [];
    const maxCols = Math.max(...sheetData.slice(0, 20).map(r => r ? r.length : 0));

    for (let c = 0; c < maxCols; c++) {
      let numericScoreCount = 0;
      let avgStrLen = 0;
      let textCellsCount = 0;

      for (let r = 0; r < Math.min(20, sheetData.length); r++) {
        if (!sheetData[r]) continue;
        const val = sheetData[r][c];
        if (val !== undefined && val !== null) {
          const strVal = String(val).trim();
          const num = Number(strVal);
          if (!isNaN(num) && num >= 1 && num <= 10) {
            numericScoreCount++;
          }
          if (strVal.length > 5) {
            avgStrLen += strVal.length;
            textCellsCount++;
          }
        }
      }

      colStats.push({
        index: c,
        numericScoreCount,
        avgStrLen: textCellsCount > 0 ? avgStrLen / textCellsCount : 0
      });
    }

    scoreColIdx = colStats.reduce((best, curr) => 
      curr.numericScoreCount > best.numericScoreCount ? curr : best
    , { index: 0, numericScoreCount: -1 }).index;

    const textCols = colStats.filter(c => c.index !== scoreColIdx);
    textColIdx = textCols.reduce((best, curr) => 
      curr.avgStrLen > best.avgStrLen ? curr : best
    , { index: -1, avgStrLen: -1 }).index;

    if (textColIdx === -1) {
      textColIdx = (scoreColIdx + 1) % (maxCols || 1);
    }

    const parsedItems: any[] = [];
    sheetData.forEach((row) => {
      if (!row) return;
      const rawScore = row[scoreColIdx];
      const scoreVal = parseInt(String(rawScore)) || 0;
      if (scoreVal >= 1 && scoreVal <= 10) {
        const effectText = row[textColIdx] ? String(row[textColIdx]).trim() : '';
        
        const otherDetails: string[] = [];
        row.forEach((cell, idx) => {
          if (idx !== scoreColIdx && idx !== textColIdx && cell !== undefined && cell !== null) {
            const str = String(cell).trim();
            if (str && str.length > 2) {
              otherDetails.push(str);
            }
          }
        });

        parsedItems.push({
          score: scoreVal,
          effect: effectText,
          detail: otherDetails.join(' | ')
        });
      }
    });

    parsedItems.sort((a, b) => b.score - a.score);
    return parsedItems;
  };

  const handleFileUploadRaw = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        if (!buffer) return;

        const workbook = XLSX.read(buffer, { type: 'array' });
        
        let newSeverity = null;
        let newOccurrence = null;
        let newDetection = null;
        let processedAny = false;

        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<any[][]>(sheet, { header: 1 });
          
          if (!rows || rows.length === 0) return;

          const parsed = parseExcelData(rows);
          if (parsed && parsed.length > 0) {
            const nameLower = sheetName.toLowerCase();
            if (nameLower.includes('شدت') || nameLower.includes('severity') || nameLower.includes('sev') || nameLower.includes('s')) {
              newSeverity = parsed;
              processedAny = true;
            } else if (nameLower.includes('وقوع') || nameLower.includes('occurrence') || nameLower.includes('occ') || nameLower.includes('o')) {
              newOccurrence = parsed;
              processedAny = true;
            } else if (nameLower.includes('تشخیص') || nameLower.includes('detection') || nameLower.includes('det') || nameLower.includes('d')) {
              newDetection = parsed;
              processedAny = true;
            }
          }
        });

        if (!processedAny && workbook.SheetNames.length === 1) {
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<any[][]>(sheet, { header: 1 });
          const parsed = parseExcelData(rows);
          if (parsed && parsed.length > 0) {
            if (activeTab === 'severity') newSeverity = parsed;
            else if (activeTab === 'occurrence') newOccurrence = parsed;
            else if (activeTab === 'detection') newDetection = parsed;
            processedAny = true;
          }
        } else if (!processedAny && workbook.SheetNames.length > 0) {
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<any[][]>(sheet, { header: 1 });
          const parsed = parseExcelData(rows);
          if (parsed && parsed.length > 0) {
            if (activeTab === 'severity') newSeverity = parsed;
            else if (activeTab === 'occurrence') newOccurrence = parsed;
            else if (activeTab === 'detection') newDetection = parsed;
            processedAny = true;
          }
        }

        if (newSeverity) {
          setCustomSeverity(newSeverity);
          localStorage.setItem('fmea_custom_criteria_severity', JSON.stringify(newSeverity));
        }
        if (newOccurrence) {
          setCustomOccurrence(newOccurrence);
          localStorage.setItem('fmea_custom_criteria_occurrence', JSON.stringify(newOccurrence));
        }
        if (newDetection) {
          setCustomDetection(newDetection);
          localStorage.setItem('fmea_custom_criteria_detection', JSON.stringify(newDetection));
        }

        setCriteriaMode('custom');
      } catch (err) {
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUploadRaw(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUploadRaw(file);
  };

  const clearCustomCriteria = () => {
    if (activeTab === 'severity') {
      setCustomSeverity(null);
      localStorage.removeItem('fmea_custom_criteria_severity');
    } else if (activeTab === 'occurrence') {
      setCustomOccurrence(null);
      localStorage.removeItem('fmea_custom_criteria_occurrence');
    } else if (activeTab === 'detection') {
      setCustomDetection(null);
      localStorage.removeItem('fmea_custom_criteria_detection');
    }
    setCriteriaMode('standard');
  };

  const handleRowClick = (score: number) => {
    onSelectScore(score);
  };

  return (
    <div 
      className={`fixed top-[64px] bottom-0 w-[420px] bg-[#0c0c0e] border-l border-[#1f1f23] shadow-2l z-50 transition-all duration-300 animate-slide-in flex flex-col font-sans ${
        isRtl ? 'left-0' : 'right-0'
      }`}
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{ boxShadow: isRtl ? '10px 0 30px rgba(0,0,0,0.5)' : '-10px 0 30px rgba(0,0,0,0.5)' }}
    >
      {/* Header */}
      <div className="p-4 border-b border-[#1f1f23] flex items-center justify-between bg-[#111114]">
        <div className="flex items-center gap-2">
          <Sliders className="text-amber-500 w-5 h-5 shrink-0" />
          <h3 className="text-sm font-black text-white">
            {isRtl ? 'مرجع ارزیابی و معیارهای PFMEA' : 'PFMEA Evaluation Criteria Helper'}
          </h3>
        </div>
        <button 
          onClick={onClose}
          className="text-zinc-500 hover:text-white p-1 hover:bg-[#1f1f23] rounded-lg transition-all cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Selected Cell Warning Info */}
      <div className="p-3 bg-amber-500/10 border-b border-amber-500/25 px-4 flex flex-col gap-1 text-[11px] leading-relaxed animate-fade-in">
        {selectedCellInfo ? (
          <div className="flex items-start gap-2">
            <Info className="text-amber-500 w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <span className="text-amber-400 font-bold block">
                {isRtl 
                  ? `سلول هدف مشخص شد: خانه ردیف فعال، فیلد «${selectedCellInfo.colId === 'severity' || selectedCellInfo.colId === 'severity2' ? 'S - شدت' : selectedCellInfo.colId === 'occurrence' || selectedCellInfo.colId === 'occurrence2' ? 'O - وقوع' : 'D - تشخیص'}»`
                  : `Target cell selected: Row key, field "${selectedCellInfo.colId}"`}
              </span>
              <span className="text-zinc-400 block mt-0.5">
                {isRtl 
                  ? `مقدار فعلی: ${selectedCellInfo.currentVal || 'فاقد مقدار'}. روی هر کدام از سطرهای معیارهای پایین کلیک کنید تا جایگزین گردد.` 
                  : `Current value: ${selectedCellInfo.currentVal}. Click any row below to overwrite.`}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <ShieldAlert className="text-rose-400 w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <span className="text-rose-400 font-black block">
                {isRtl ? '⚠️ هیچ سلولی انتخاب نشده است' : '⚠️ No cell selected'}
              </span>
              <span className="text-zinc-400 block mt-0.5">
                {isRtl 
                  ? 'بر روی یکی از خانه‌های عددی شدت (Severity)، وقوع (Occurrence) یا تشخیص (Detection) کلیک کنید تا فعال گردد.'
                  : 'Click any cell in S, O or D columns to link and input rating.'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Active Mode Banner */}
      <div className="flex items-center justify-between bg-[#070709] border-b border-[#1c1c1f] px-4 py-3">
        <span className="text-xs font-black text-zinc-400">
          {isRtl ? 'بخش معیار فعال:' : 'Active criteria section:'}
        </span>
        <div className="flex items-center gap-1.5">
          {activeTab === 'severity' && (
            <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-black rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 shadow-sm animate-fade-in">
              <AlertOctagon size={12} className="shrink-0" />
              <span>{isRtl ? 'معیار بررسی شدت (S)' : 'Severity Criteria (S)'}</span>
            </span>
          )}
          {activeTab === 'occurrence' && (
            <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-black rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-sm animate-fade-in">
              <Activity size={12} className="shrink-0" />
              <span>{isRtl ? 'معیار بررسی وقوع (O)' : 'Occurrence Criteria (O)'}</span>
            </span>
          )}
          {activeTab === 'detection' && (
            <span className="flex items-center gap-1 px-2.5 py-1 text-xs font-black rounded-lg bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-sm animate-fade-in">
              <ShieldAlert size={12} className="shrink-0" />
              <span>{isRtl ? 'معیار بررسی تشخیص (D)' : 'Detection Criteria (D)'}</span>
            </span>
          )}
        </div>
      </div>

      {/* Criteria Mode Toggle */}
      <div className="flex bg-[#0f0f12] border-b border-[#1c1c1f] p-1 gap-1">
        <button
          onClick={() => setCriteriaMode('standard')}
          className={`flex-1 py-1.5 text-[10.5px] font-black rounded transition-all cursor-pointer ${
            criteriaMode === 'standard'
              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/25 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-350 border border-transparent'
          }`}
        >
          {isRtl ? '🗄️ معیار استاندارد پیش‌فرض' : '🗄️ Standard Default Rating'}
        </button>
        <button
          onClick={() => setCriteriaMode('custom')}
          className={`flex-1 py-1.5 text-[10.5px] font-black rounded transition-all cursor-pointer ${
            criteriaMode === 'custom'
              ? 'bg-[#1c1c20] text-amber-500 border border-amber-500/25 shadow-sm'
              : 'text-zinc-500 hover:text-zinc-350 border border-transparent'
          }`}
        >
          {isRtl ? '📤 بارگذاری و استفاده از فایل معیار شما' : '📤 Load & Use Your Spreadsheet'}
        </button>
      </div>

      {/* Filter / Search input */}
      <div className="p-3 border-b border-[#1c1c1f] bg-[#111113]">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={isRtl ? '🔍 جستجو در معیارها...' : '🔍 Search criteria details...'}
          className="w-full bg-[#18181b] text-zinc-200 placeholder-zinc-500 text-xs px-3 py-2 rounded border border-zinc-800 outline-none focus:border-amber-500/50 text-right leading-relaxed"
        />
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-3 bg-[#0a0a0c]">
        {criteriaMode === 'custom' ? (
          <div className="space-y-3 animate-fade-in">
            {/* Action Card at the Top of Custom Mode */}
            <div className="p-3 bg-[#111114] border border-[#1c1c1f] rounded-xl space-y-2 animate-fade-in">
              {hasCustomUploaded ? (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-black text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                    <span className="truncate max-w-[260px]" title={isRtl ? 'معیار اختصاصی فعال است' : 'Your custom criteria is loaded'}>
                      {isRtl ? '✔️ فایل سفارشی بارگذاری شده فعال است.' : '✔️ Your custom criteria is loaded.'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <label className="flex-1 text-center bg-zinc-800 hover:bg-zinc-750 text-amber-500 font-bold border border-zinc-700 text-[10px] py-1.5 rounded-lg cursor-pointer transition-all select-none">
                      {isRtl ? '📤 بارگذاری فایل جدید' : '📤 Upload New File'}
                      <input 
                        type="file" 
                        accept=".xlsx,.xls,.csv" 
                        onChange={onFileUpload} 
                        className="hidden" 
                      />
                    </label>
                    <button 
                      onClick={clearCustomCriteria}
                      className="flex-1 text-[10px] bg-red-500/15 hover:bg-red-500/25 border border-red-500/20 text-rose-400 rounded-lg py-1.5 shrink-0 flex items-center justify-center gap-1 transition-all cursor-pointer font-bold"
                    >
                      <Trash2 size={10} />
                      <span>{isRtl ? 'برگشت به لیست پیش‌فرض' : 'Reset to Default'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`p-3 rounded-lg border-2 border-dashed transition-all text-center ${
                    isDragging 
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400' 
                      : 'border-[#1f1f23] bg-[#0c0c0e] hover:border-amber-500/20'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-[10px] text-zinc-400 leading-normal font-bold">
                      {isRtl 
                        ? '🗄️ در حال نمایش معیارهای استاندارد پیش‌فرض سیستم.' 
                        : '🗄️ Using Standard Default Rating.'}
                    </span>
                    <p className="text-[9px] text-zinc-500 leading-relaxed max-w-[320px] mx-auto">
                      {isRtl
                        ? 'جهت جایگزینی با فایل اکسل یا CSV معیار خود، فایل را به این کادر بکشید یا از دکمه زیر انتخاب کنید:'
                        : 'To replace with your custom Excel/CSV ratings, drop file here or click below:'}
                    </p>
                    <label className="bg-amber-500 hover:bg-amber-600 text-[#0c0c0e] font-black text-[9.5px] px-3 py-1 rounded cursor-pointer transition-all shadow-md select-none">
                      {isRtl ? '📁 انتخاب فایل اکسل / معیار' : '📁 Search Rating File'}
                      <input 
                        type="file" 
                        accept=".xlsx,.xls,.csv" 
                        onChange={onFileUpload} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Render Custom List (populated either with custom file or standard defaults) */}
            {activeCustomList
              .filter(item => 
                String(item.score).includes(searchTerm) ||
                (item.effect && item.effect.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (item.detail && item.detail.toLowerCase().includes(searchTerm.toLowerCase()))
              )
              .map((item, idx) => {
                const isSelected = selectedCellInfo && selectedCellInfo.colId.startsWith(activeTab) && selectedCellInfo.currentVal === item.score;
                return (
                  <div
                    key={`${item.score}-${idx}`}
                    onClick={() => handleRowClick(item.score)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer text-right group ${
                      isSelected 
                        ? 'bg-amber-500/15 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.1)]' 
                        : 'bg-[#121215] border-[#1c1c1f] hover:border-[#38383f] hover:bg-[#15151a]'
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-[#1c1c1f] pb-2 mb-2">
                      <span className={`px-2 py-0.5 text-xs font-black font-mono rounded ${
                        item.score >= 8 ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                        item.score >= 5 ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' :
                        'bg-teal-500/10 text-teal-400 border border-teal-500/20'
                      }`}>
                        {isRtl ? `امتیاز: ${item.score}` : `Rating: ${item.score}`}
                      </span>
                      {isSelected && <span className="text-[10px] text-amber-500 font-bold">● {isRtl ? 'انتخاب شده' : 'Selected'}</span>}
                    </div>

                    <h4 className="text-zinc-100 font-bold text-xs leading-relaxed mb-2 group-hover:text-amber-400 transition-colors">
                      {item.effect || (isRtl ? 'بدون شرح' : 'No description')}
                    </h4>

                    {item.detail && (
                      <p className="text-[10px] text-zinc-400 leading-relaxed bg-[#070709] p-2.5 rounded-lg border border-white/[0.01]">
                        {item.detail}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        ) : (
          <>
            {activeTab === 'severity' && (
              <div className="space-y-3 animate-fade-in">
                {severityData
                  .filter(item => 
                    String(item.score).includes(searchTerm) ||
                    item.effect.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    Object.values(item.domains).some(v => v.toLowerCase().includes(searchTerm.toLowerCase()))
                  )
                  .map(item => {
                    const isSelected = selectedCellInfo && (selectedCellInfo.colId === 'severity' || selectedCellInfo.colId === 'severity2') && selectedCellInfo.currentVal === item.score;
                    return (
                      <div
                        key={item.score}
                        onClick={() => handleRowClick(item.score)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer text-right group ${
                          isSelected 
                            ? 'bg-amber-500/15 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.1)]' 
                            : 'bg-[#121215] border-[#1c1c1f] hover:border-[#38383f] hover:bg-[#15151a]'
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-zinc-850 pb-2 mb-2">
                          <span className={`px-2 py-0.5 text-xs font-black font-mono rounded ${
                            item.score >= 8 ? 'bg-red-500/20 text-red-500 border border-red-500/30' :
                            item.score >= 5 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                            'bg-green-500/25 text-green-400'
                          }`}>
                            {isRtl ? `درجه شدت: ${item.score}` : `Severity: ${item.score}`}
                          </span>
                          {isSelected && <span className="text-[10px] text-amber-500 font-bold">● {isRtl ? 'انتخاب شده' : 'Selected'}</span>}
                        </div>

                        <h4 className="text-zinc-150 font-bold text-xs leading-relaxed mb-2 text-zinc-100 group-hover:text-amber-400 transition-colors">
                          {item.effect}
                        </h4>

                        {/* Expandable domains details for maximum accuracy to PDF screenshots */}
                        <div className="mt-2 text-[10px] text-zinc-400 bg-[#070709] p-2.5 rounded-lg border border-white/[0.02] space-y-2">
                          <div className="leading-relaxed"><strong className="text-[#a0a0aa]">{isRtl ? 'محصول / قطعه:' : 'Product:'}</strong> {item.domains.product}</div>
                          <div className="leading-relaxed"><strong className="text-[#a0a0aa]">{isRtl ? 'خط تولید خودروساز:' : 'Automaker Line:'}</strong> {item.domains.builderLine}</div>
                          <div className="leading-relaxed"><strong className="text-[#a0a0aa]">{isRtl ? 'خط تولید قطعه‌ساز (مشتری):' : 'Customer Line:'}</strong> {item.domains.customerLine}</div>
                          <div className="leading-relaxed"><strong className="text-[#a0a0aa]">{isRtl ? 'خط تولید محوطه (ما):' : 'Local Line:'}</strong> {item.domains.localLine}</div>
                          <div className="leading-relaxed"><strong className="text-[#a0a0aa]">{isRtl ? 'مصرف‌کننده نهایی:' : 'Consumer:'}</strong> {item.domains.consumer}</div>
                          {item.domains.service !== '—' && (
                            <div className="leading-relaxed"><strong className="text-[#a0a0aa]">{isRtl ? 'خدمات پس از فروش (گارانتی):' : 'After-sales:'}</strong> {item.domains.service}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {activeTab === 'occurrence' && (
              <div className="space-y-3 animate-fade-in">
                {occurrenceData
                  .filter(item => 
                    String(item.score).includes(searchTerm) ||
                    item.cpk.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.ratio.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.effect.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.ppkRatio.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map(item => {
                    const isSelected = selectedCellInfo && (selectedCellInfo.colId === 'occurrence' || selectedCellInfo.colId === 'occurrence2') && selectedCellInfo.currentVal === item.score;
                    return (
                      <div
                        key={item.score}
                        onClick={() => handleRowClick(item.score)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer text-right group ${
                          isSelected 
                            ? 'bg-amber-500/15 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.1)]' 
                            : 'bg-[#121215] border-[#1c1c1f] hover:border-[#38383f] hover:bg-[#15151a]'
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-zinc-850 pb-2 mb-2">
                          <span className={`px-2 py-0.5 text-xs font-black font-mono rounded ${
                            item.score >= 8 ? 'bg-red-500/20 text-red-500 border border-red-500/30' :
                            item.score >= 5 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                            'bg-green-500/25 text-green-400'
                          }`}>
                            {isRtl ? `درجه وقوع: ${item.score}` : `Occurrence: ${item.score}`}
                          </span>
                          {isSelected && <span className="text-[10px] text-amber-500 font-bold">● {isRtl ? 'انتخاب شده' : 'Selected'}</span>}
                        </div>

                        <h4 className="text-zinc-100 font-bold text-xs leading-relaxed mb-2 group-hover:text-amber-400 transition-colors">
                          {item.occurrenceOdds}
                        </h4>

                        {/* Criteria Info Grid */}
                        <div className="grid grid-cols-2 gap-2 text-[10px] bg-[#070709] p-2 rounded-lg border border-white/[0.01] font-mono leading-relaxed text-right mb-2 text-zinc-300">
                          <div><strong className="text-[#a0a0aa] block not-italic font-sans">{isRtl ? 'نرخ خرابی تجربی:' : 'Odds Ratio:'}</strong> {item.ratio}</div>
                          <div><strong className="text-[#a0a0aa] block not-italic font-sans">{isRtl ? 'شاخص فرآیند:' : 'Indicator:'}</strong> {item.cpk}</div>
                        </div>

                        <div className="bg-[#0e0e11] border border-white/[0.01] p-2 rounded-lg text-[10px] text-zinc-400 mt-2 space-y-1 text-right leading-relaxed">
                          <div><strong className="text-amber-500 font-bold font-sans block text-[9px] mb-0.5">{isRtl ? 'معیار بر اساس خط تولید سازمان (Ppk):' : 'Mitigation / Ppk:'}</strong></div>
                          <div><span className="font-mono text-zinc-250 font-bold">{item.ppk}</span></div>
                          <div><span>{item.ppkRatio}</span></div>
                        </div>

                        <p className="text-[10px] text-zinc-400 leading-relaxed mt-2 italic">
                          💡 {item.effect}
                        </p>
                      </div>
                    );
                  })}
              </div>
            )}

            {activeTab === 'detection' && (
              <div className="space-y-3 animate-fade-in">
                {detectionData
                  .filter(item => 
                    String(item.score).includes(searchTerm) ||
                    item.detectionText.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.criterion.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    item.rangeMethods.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map(item => {
                    const isSelected = selectedCellInfo && (selectedCellInfo.colId === 'detection' || selectedCellInfo.colId === 'detection2') && selectedCellInfo.currentVal === item.score;
                    return (
                      <div
                        key={item.score}
                        onClick={() => handleRowClick(item.score)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer text-right group ${
                          isSelected 
                            ? 'bg-amber-500/15 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.1)]' 
                            : 'bg-[#121215] border-[#1c1c1f] hover:border-[#38383f] hover:bg-[#15151a]'
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-zinc-850 pb-2 mb-2">
                          <span className={`px-2 py-0.5 text-xs font-black font-mono rounded ${
                            item.score >= 8 ? 'bg-red-500/20 text-red-500 border border-red-500/30' :
                            item.score >= 5 ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' :
                            'bg-green-500/25 text-green-400'
                          }`}>
                            {isRtl ? `درجه تشخیص: ${item.score}` : `Detection: ${item.score}`}
                          </span>
                          {isSelected && <span className="text-[10px] text-amber-500 font-bold">● {isRtl ? 'انتخاب شده' : 'Selected'}</span>}
                        </div>

                        <h4 className="text-zinc-100 font-black text-xs leading-relaxed mb-2 group-hover:text-amber-400 transition-colors">
                          {isRtl ? `قابلیت: ${item.detectionText}` : `Capability: ${item.detectionText}`}
                        </h4>

                        {/* Inspection Types representation EXACT wrapper matching page 4 */}
                        <div className="mt-2 mb-2 p-2 bg-[#070709] rounded-lg border border-white/[0.01] text-[10px] text-zinc-300 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 leading-none">
                            <strong className="text-[#a0a0aa] leading-none">{isRtl ? 'انواع بازرسی:' : 'Inspections:'}</strong>
                            <span className={`px-1 rounded font-bold ${item.inspections.A ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-600 opacity-30'}`} title={isRtl ? 'A= ضد خطاسازی (Poka-Yoke)' : 'A= Error Proofing'}>A</span>
                            <span className={`px-1 rounded font-bold ${item.inspections.B ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-600 opacity-30'}`} title={isRtl ? 'B= گیج کنترلی' : 'B= Gauging'}>B</span>
                            <span className={`px-1 rounded font-bold ${item.inspections.C ? 'text-amber-400 bg-amber-400/10' : 'text-zinc-600 opacity-30'}`} title={isRtl ? 'C= بازرسی/طرح کنترل عمومی' : 'C= Visual inspection'}>C</span>
                          </div>
                          <div className="text-[9px] text-[#71717a]">
                            {isRtl ? '* بر اساس نوع A, B یا C' : '* Based on type A, B, C'}
                          </div>
                        </div>

                        {/* Specific Criterion details */}
                        <div className="text-[10px] text-zinc-200 bg-[#0e0e11] p-2.5 rounded-lg leading-relaxed text-right space-y-1">
                          <div><strong className="text-amber-500 font-bold block mb-1 text-[9px]">{isRtl ? 'دامنه پیشنهادی متدولوژی و روش تشخیص:' : 'Suggested Range & Methods:'}</strong></div>
                          <div>{item.rangeMethods}</div>
                          <div className="text-[#71717a] mt-1 italic">
                            {isRtl ? `معیار: ${item.criterion}` : `Criterion: ${item.criterion}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer Instructions */}
      <div className="p-3.5 border-t border-[#1f1f23] text-center bg-[#111114] text-[10.5px] text-zinc-500">
        {isRtl 
          ? 'تغییرات فوراً در سلول فعال و RPN کل محاسبات اثرگذار خواهد بود.' 
          : 'Values apply in real-time, instantly recalculating Risk RPN parameters.'}
      </div>
    </div>
  );
};
