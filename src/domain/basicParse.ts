// ตัวแปลงแผนเที่ยวจากข้อความแบบพื้นฐาน (ไม่ใช้ AI) — ย้ายจากต้นแบบแบบตรงตัว
// เพิ่มพารามิเตอร์ today เพื่อให้เดาปีได้แน่นอนตอนทดสอบ (ต้นแบบใช้ new Date() ตรงๆ)
import { guessCat } from "./cats";
import type { Cat } from "./types";
import { normTime, toISO, TH_MONTHS, TH_MONTHS_FULL } from "./util";

export interface ParsedItem { time: string; title: string; place: string; cat: Cat; cost: number; note: string }
export interface ParsedDay { title: string; date: string; items: ParsedItem[] }
export interface ParsedPlan {
  name: string; destination: string; start: string; end: string; currency: string;
  days: ParsedDay[]; checklist: string[];
}

const dayRe = /^(?:[#*\s]*)(?:วันที่|วัน|day|d)\s*(\d{1,2})\b[\s:.\-–—)]*(.*)$/i;
const dateRe = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})|(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})/;
const thMonthRe = new RegExp(
  "(\\d{1,2})\\s*(" + TH_MONTHS.map((m) => m.replace(/\./g, "\\.?")).join("|") + "|" + TH_MONTHS_FULL.join("|") + ")\\s*(\\d{2,4})?",
);
const costRe = /(?:฿\s*)?(\d[\d,]*(?:\.\d+)?)\s*(บาท|฿|thb|เยน|yen|¥|jpy|วอน|won|krw|usd|\$|ดอลลาร์|ยูโร|eur|€)/i;
// เพิ่มจากต้นแบบ: ราคาที่มีสัญลักษณ์นำหน้าอย่างเดียว เช่น "฿200", "¥1,500"
const prefixCostRe = /([฿$¥€])\s*(\d[\d,]*(?:\.\d+)?)/;
const curMap: Record<string, string> = {
  "บาท": "THB", "฿": "THB", thb: "THB", "เยน": "JPY", yen: "JPY", "¥": "JPY", jpy: "JPY", "วอน": "KRW", won: "KRW", krw: "KRW",
  usd: "USD", $: "USD", "ดอลลาร์": "USD", "ยูโร": "EUR", eur: "EUR", "€": "EUR",
};

/** ปี 2 หลัก: ≥50 ถือเป็น พ.ศ. (69 → 2569), <50 ถือเป็น ค.ศ. (26 → 2026); ปี > 2400 แปลง พ.ศ. → ค.ศ. */
export function toYear(y: string | number): number {
  let n = +y;
  if (n < 100) n += n >= 50 ? 2500 : 2000;
  if (n > 2400) n -= 543;
  return n;
}

export function findDate(s: string, today: Date = new Date()): string {
  let m = dateRe.exec(s);
  if (m) {
    if (m[1]) return toISO(new Date(+m[1] > 2400 ? +m[1] - 543 : +m[1], +m[2] - 1, +m[3]));
    return toISO(new Date(toYear(m[6]), +m[5] - 1, +m[4]));
  }
  m = thMonthRe.exec(s);
  if (m) {
    let mi = TH_MONTHS_FULL.indexOf(m[2]);
    if (mi < 0) mi = TH_MONTHS.findIndex((x) => x.replace(/\./g, "") === m![2].replace(/\./g, ""));
    if (mi >= 0) {
      const y = m[3] ? toYear(m[3]) : today.getFullYear();
      return toISO(new Date(y, mi, +m[1]));
    }
  }
  return "";
}

export function basicParse(text: string, today: Date = new Date()): ParsedPlan {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: ParsedPlan = { name: "", destination: "", start: "", end: "", currency: "", days: [], checklist: [] };
  let cur: ParsedDay | null = null;
  const dates: string[] = [];
  let inChecklist = false;
  for (const raw of lines) {
    const l = raw.replace(/^[-•*·▪︎►>]+\s*/, "").replace(/\*\*/g, "");
    if (/^(เช็กลิสต์|เช็คลิสต์|checklist|ของที่ต้องเตรียม|สิ่งที่ต้องเตรียม|packing)/i.test(l)) { inChecklist = true; continue; }
    const dm = dayRe.exec(l);
    const isDateHeader = !dm && !!findDate(l, today) && !/^\d{1,2}[:.]\d{2}/.test(l) && l.length < 60;
    if (dm || isDateHeader) {
      inChecklist = false;
      const rest = dm ? dm[2] : l;
      const dt = findDate(l, today);
      cur = { title: rest.replace(dateRe, "").replace(thMonthRe, "").replace(/^[\s:.\-–—()|]+|[\s:.\-–—()|]+$/g, ""), date: dt, items: [] };
      if (dt) dates.push(dt);
      out.days.push(cur);
      continue;
    }
    if (inChecklist) { out.checklist.push(l.replace(/^\[.?\]\s*/, "")); continue; }
    if (!out.name && !cur && !/^\d{1,2}[:.]\d{2}/.test(l)) { out.name = l.replace(/^#+\s*/, "").slice(0, 80); continue; }
    if (!cur) { cur = { title: "", date: "", items: [] }; out.days.push(cur); }
    const tm = /^(\d{1,2})[:.](\d{2})\s*(?:น\.?)?\s*(?:[-–—~]\s*\d{1,2}[:.]\d{2}\s*(?:น\.?)?)?\s*[-–—:|]?\s*(.*)$/.exec(l);
    let time = "", title = l;
    if (tm) { time = normTime(tm[1] + ":" + tm[2]); title = tm[3] || ""; }
    let cost = 0;
    const cm = costRe.exec(title);
    const pm = cm ? null : prefixCostRe.exec(title);
    if (cm || pm) {
      const [whole, num, sym] = cm ? [cm[0], cm[1], cm[2]] : [pm![0], pm![2], pm![1]];
      cost = Number(num.replace(/,/g, "")) || 0;
      if (!out.currency) out.currency = curMap[sym.toLowerCase()] || "";
      title = title.replace(whole, "").replace(/[\s(,]+\)?$/, "").trim();
    }
    let note = "";
    const nm = /^(.*?)\s*[(（](.+)[)）]\s*$/.exec(title);
    if (nm) { title = nm[1]; note = nm[2]; }
    if (!title) continue;
    cur.items.push({ time, title, place: "", cat: guessCat(title), cost, note });
  }
  out.days = out.days.filter((d) => d.items.length || d.title);
  if (dates.length) { out.start = dates[0]; out.end = dates[dates.length - 1]; }
  if (!out.name) out.name = "แผนเที่ยวที่นำเข้า";
  return out;
}
