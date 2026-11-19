// ฟังก์ชันช่วยทั่วไป ย้ายมาจากต้นแบบแบบตรงตัว

export const TH_DAYS = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
export const TH_MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
export const TH_MONTHS_FULL = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

export const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function parseISO(s: unknown): Date | null {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(d: Date): string {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export function addDays(s: string, n: number): string {
  const d = parseISO(s);
  if (!d) return "";
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** แสดงวันที่แบบไทย ปี พ.ศ. 2 หลัก เช่น "ศ. 12 ธ.ค. 69" */
export function fmtDate(s: string, withDay = true): string {
  const d = parseISO(s);
  if (!d) return "";
  return (withDay ? TH_DAYS[d.getDay()] + " " : "") + d.getDate() + " " + TH_MONTHS[d.getMonth()] + " " + String(d.getFullYear() + 543).slice(-2);
}

export function daysBetween(a: string, b: string): number {
  const A = parseISO(a), B = parseISO(b);
  if (!A || !B) return 0;
  return Math.round((B.getTime() - A.getTime()) / 864e5);
}

export function money(n: unknown, cur?: string): string {
  const v = Number(n) || 0;
  return v.toLocaleString("th-TH", { maximumFractionDigits: 2 }) + " " + (cur || "");
}

export function timeKey(t: string | undefined): number {
  if (!t) return 9999;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  return m ? +m[1] * 60 + +m[2] : 9999;
}

export function normTime(t: unknown): string {
  if (!t) return "";
  const m = /(\d{1,2})[:.](\d{2})/.exec(String(t));
  return m ? String(Math.min(23, +m[1])).padStart(2, "0") + ":" + m[2] : "";
}

export const isUrl = (s: unknown): boolean => /^https?:\/\//i.test(String(s || "").trim());

export function mapsLink(q: string): string {
  q = String(q || "").trim();
  return isUrl(q) ? q : "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
}

export function navLink(q: string): string {
  q = String(q || "").trim();
  return isUrl(q) ? q : "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(q);
}

export function routeLink(places: string[]): string {
  return "https://www.google.com/maps/dir/" + places.map((p) => encodeURIComponent(p)).join("/");
}
