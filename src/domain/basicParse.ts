// ตัวแปลงแผนเที่ยวจากข้อความแบบพื้นฐาน (ไม่ใช้ AI) — ย้ายจากต้นแบบแบบตรงตัว
// เพิ่มพารามิเตอร์ today เพื่อให้เดาปีได้แน่นอนตอนทดสอบ (ต้นแบบใช้ new Date() ตรงๆ)
import { guessCat } from "./cats";
import type { Cat } from "./types";
import { normTime, toISO, TH_MONTHS, TH_MONTHS_FULL } from "./util";

export interface ParsedItem { time: string; title: string; place: string; cat: Cat; cost: number; note: string }
export interface ParsedDay { title: string; date: string; items: ParsedItem[] }
export interface ParsedStay { name: string; startDay: number; nights: number }
export interface ParsedPlan {
  name: string; destination: string; start: string; end: string; currency: string;
  days: ParsedDay[]; checklist: string[];
  /** ที่พักจากบรรทัด "พัก: ..." */
  stays: ParsedStay[];
  /** ข้อความก่อนวันแรก (เช่น ข้อมูลตั๋วเครื่องบิน) เก็บเป็นบันทึกของทริป */
  notes: string;
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

export function findDate(s: string, today: Date = new Date(), defaultYear?: number): string {
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
      const y = m[3] ? toYear(m[3]) : defaultYear ?? today.getFullYear();
      return toISO(new Date(y, mi, +m[1]));
    }
  }
  return "";
}

/** ปีแรกที่เขียนไว้ชัดเจนในข้อความ (ใช้เป็นปีของวันที่ที่ไม่ได้เขียนปี) */
function firstExplicitYear(text: string): number | undefined {
  const re = new RegExp(dateRe.source + "|" + thMonthRe.source, "g");
  for (const m of text.matchAll(re)) {
    if (m[1]) return +m[1] > 2400 ? +m[1] - 543 : +m[1];
    if (m[6]) return toYear(m[6]);
    if (m[9]) return toYear(m[9]);
  }
  return undefined;
}

const stayRe = /^(?:พัก|ที่พัก|นอน|นอนที่|โรงแรม|hotel|stay|overnight)\s*[:：]\s*(.+)$/i;
const bulletRe = /^(?:[-•·▪︎►>]|\*(?!\*))\s*/;
const nameHintRe = /(?:แพลน|แผน)(?:การ)?เที่ยว|itinerary|trip plan|ทริป.*\d+\s*วัน/i;

export function basicParse(text: string, today: Date = new Date()): ParsedPlan {
  const lines = String(text || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: ParsedPlan = { name: "", destination: "", start: "", end: "", currency: "", days: [], checklist: [], stays: [], notes: "" };
  const clean = (raw: string) => raw.replace(/^[-•*·▪︎►>]+\s*/, "").replace(/\*\*/g, "");
  // ถ้ามีหัว "Day 1 / วันที่ 1" ให้ใช้หัวพวกนี้แบ่งวันเท่านั้น ข้อความก่อนวันแรก (เช่น ข้อมูลตั๋ว) เก็บเป็นบันทึกของทริป
  const hasDayHeaders = lines.some((raw) => dayRe.test(clean(raw)));
  const defaultYear = firstExplicitYear(text);
  const preamble: string[] = [];
  let cur: (ParsedDay & { stay?: string }) | null = null;
  const days: (ParsedDay & { stay?: string })[] = [];
  const dates: string[] = [];
  let inChecklist = false;
  for (const raw of lines) {
    const l = clean(raw);
    const isBullet = bulletRe.test(raw);
    if (/^(เช็กลิสต์|เช็คลิสต์|checklist|ของที่ต้องเตรียม|สิ่งที่ต้องเตรียม|packing)/i.test(l)) { inChecklist = true; continue; }
    const dm = dayRe.exec(l);
    const isDateHeader = !hasDayHeaders && !dm && !!findDate(l, today, defaultYear) && !/^\d{1,2}[:.]\d{2}/.test(l) && l.length < 60;
    if (dm || isDateHeader) {
      inChecklist = false;
      const rest = dm ? dm[2] : l;
      let dt = findDate(l, today, defaultYear);
      // วันที่ไม่ได้เขียนปีแต่ย้อนกลับไปก่อนวันก่อนหน้า (เช่น ธ.ค. → ม.ค.) ถือว่าข้ามปี
      if (dt && dates.length && dt < dates[dates.length - 1] && !/\d{4}|\d{1,2}[/.]\d{1,2}[/.]\d{2}/.test(l)) {
        dt = (+dt.slice(0, 4) + 1) + dt.slice(4);
      }
      cur = { title: rest.replace(dateRe, "").replace(thMonthRe, "").replace(/^[\s:.\-–—()|]+|[\s:.\-–—()|]+$/g, ""), date: dt, items: [] };
      if (dt) dates.push(dt);
      days.push(cur);
      continue;
    }
    if (inChecklist) { out.checklist.push(l.replace(/^\[.?\]\s*/, "")); continue; }
    if (hasDayHeaders && !cur) { preamble.push((isBullet ? "• " : "") + l); continue; }
    if (!out.name && !cur && !/^\d{1,2}[:.]\d{2}/.test(l)) { out.name = l.replace(/^#+\s*/, "").slice(0, 80); continue; }
    if (!cur) { cur = { title: "", date: "", items: [] }; days.push(cur); }
    // "พัก: ชื่อที่พัก" → ที่พักของคืนนี้ (ไม่ใช่กิจกรรม)
    const sm = stayRe.exec(l);
    if (sm) { cur.stay = sm[1].replace(/\s*[(（].*$/, "").trim().slice(0, 200); continue; }
    // ประโยคที่ไม่ใช่หัวข้อย่อย ในวันที่กิจกรรมเป็นหัวข้อย่อย → หมายเหตุของกิจกรรมก่อนหน้า
    const last = cur.items[cur.items.length - 1];
    if (!isBullet && last && (last as any)._bullet && !/^\d{1,2}[:.]\d{2}/.test(l)) {
      last.note = (last.note ? last.note + " · " : "") + l;
      continue;
    }
    const tm = /^(\d{1,2})[:.](\d{2})\s*(?:น\.?)?\s*(?:[-–—~]\s*\d{1,2}[:.]\d{2}\s*(?:น\.?)?)?\s*[-–—:|]?\s*(.*)$/.exec(l);
    let time = "", title = l;
    if (tm) { time = normTime(tm[1] + ":" + tm[2]); title = tm[3] || ""; }
    else {
      // เวลาที่อยู่กลาง/ท้ายบรรทัด เช่น "ถึงญี่ปุ่น 18:25 น."
      const tt = /\s*(?:เวลา\s*)?(\d{1,2}):(\d{2})\s*(?:น\.?)?/.exec(title);
      if (tt) { time = normTime(tt[1] + ":" + tt[2]); title = (title.slice(0, tt.index) + " " + title.slice(tt.index + tt[0].length)).replace(/\s+/g, " ").trim(); }
    }
    let cost = 0;
    const cm = costRe.exec(title);
    const pm = cm ? null : prefixCostRe.exec(title);
    if (cm || pm) {
      const [whole, num, sym] = cm ? [cm[0], cm[1], cm[2]] : [pm![0], pm![2], pm![1]];
      cost = Number(num.replace(/,/g, "")) || 0;
      if (!out.currency) out.currency = curMap[sym.toLowerCase()] || "";
      title = title.replace(whole, "").replace(/[\s(,]+\)?$/, "").trim();
      // เพิ่มจากต้นแบบ: ตัดคำบอกราคาที่ค้างอยู่ เช่น "(ประมาณ 1,200 เยน)" → ไม่เหลือ "(ประมาณ"
      title = title.replace(/\s*[(（]?\s*(?:ประมาณ|ราวๆ|ราว|ค่าใช้จ่าย|ราคา|approx\.?|~|:)?\s*[)）]?\s*[,:]?\s*$/i, "").trim();
    }
    let note = "";
    const nm = /^(.*?)\s*[(（](.+)[)）]\s*$/.exec(title);
    if (nm && nm[1].trim()) { title = nm[1]; note = nm[2]; }
    if (!title) continue;
    const item: ParsedItem = { time, title, place: "", cat: guessCat(title), cost, note };
    Object.defineProperty(item, "_bullet", { value: isBullet, enumerable: false });
    cur.items.push(item);
  }
  const kept = days.filter((d) => d.items.length || d.title || d.stay);
  // รวมคืนที่พักติดกันที่ชื่อเดียวกันเป็นที่พักเดียว
  kept.forEach((d, i) => {
    if (!d.stay) return;
    const prev = out.stays[out.stays.length - 1];
    if (prev && prev.name.toLowerCase() === d.stay.toLowerCase() && prev.startDay + prev.nights === i) prev.nights++;
    else out.stays.push({ name: d.stay, startDay: i, nights: 1 });
  });
  out.days = kept.map(({ title, date, items }) => ({ title, date, items }));
  if (hasDayHeaders && preamble.length) {
    const chosen = preamble.find((l) => nameHintRe.test(l)) || preamble[0];
    out.name = chosen.replace(/^[#•\s]+/, "").replace(/\s*ตาม(?:ไฟลต์|ไฟลท์|ไฟล์ท|ตั๋ว)(?:นี้)?\s*$/, "").slice(0, 80);
    out.notes = preamble.filter((l) => l !== chosen).join("\n");
  }
  if (dates.length) { out.start = dates[0]; out.end = dates[dates.length - 1]; }
  if (!out.name) out.name = "แผนเที่ยวที่นำเข้า";
  return out;
}
