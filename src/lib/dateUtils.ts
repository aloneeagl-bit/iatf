/**
 * Gregorian to Jalali (Solar Hijri) Date Converter
 * Highly accurate pure JavaScript/TypeScript implementation.
 */
export function getJalaliDate(date: Date = new Date()): string {
  const gy = date.getFullYear();
  const gm = date.getMonth() + 1;
  const gd = date.getDate();

  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = (gm > 2) ? (gy + 1) : gy;
  let g_day_no = 355666 + (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + gd + g_d_m[gm - 1];
  let jy = -1595 + (33 * Math.floor(g_day_no / 12053));
  g_day_no %= 12053;
  jy += 4 * Math.floor(g_day_no / 1461);
  g_day_no %= 1461;
  if (g_day_no > 365) {
    jy += Math.floor((g_day_no - 1) / 365);
    g_day_no = (g_day_no - 1) % 365;
  }
  let jm = (g_day_no < 186) ? (1 + Math.floor(g_day_no / 31)) : (7 + Math.floor((g_day_no - 186) / 30));
  let jd = 1 + ((g_day_no < 186) ? (g_day_no % 31) : ((g_day_no - 186) % 30));

  const yStr = String(jy);
  const mStr = String(jm).padStart(2, '0');
  const dStr = String(jd).padStart(2, '0');
  return `${yStr}/${mStr}/${dStr}`;
}
