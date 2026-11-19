// โมเดลทริป: สร้าง, ตรวจข้อมูลนำเข้า, จัดวันตามช่วงวันที่, ที่พัก และงบประมาณ
// logic ย้ายจากต้นแบบแบบตรงตัว เปลี่ยนแค่ให้เป็นฟังก์ชันล้วนที่ทดสอบได้
import type { CheckItem, Day, Item, Stay, Trip } from "./types";
import { CATS, guessCat, isCat } from "./cats";
import { cleanLL, hasLL, parseLL } from "./geo";
import { AICONS } from "./icons";
import { addDays, daysBetween, fmtDate, isUrl, mapsLink, money, normTime, parseISO, uid } from "./util";

export const MAX_TRIP_DAYS = 60;

export function newTrip(p: Partial<Trip> = {}): Trip {
  return {
    id: uid(), name: "ทริปใหม่", destination: "", start: "", end: "", currency: "THB", travelers: 1, budget: 0,
    days: [], stays: [], checklist: [], notes: "", created: Date.now(), updated: Date.now(),
    ...p,
  };
}

export const newDay = (p: Partial<Day> = {}): Day => ({ id: uid(), title: "", date: "", items: [], ...p });

/**
 * ทำให้จำนวนวันตรงกับช่วงวันที่ของทริป (ถ้ามีวันเริ่ม)
 * เพิ่มวันที่ขาด และตัดได้เฉพาะวันท้ายที่ว่าง — ไม่ลบวันที่ยังมีกิจกรรม
 */
export function syncDaysToRange(trip: Trip): void {
  if (!trip.start) return;
  const end = trip.end && daysBetween(trip.start, trip.end) >= 0 ? trip.end : trip.start;
  const n = daysBetween(trip.start, end) + 1;
  while (trip.days.length < n) trip.days.push(newDay());
  while (trip.days.length > n && trip.days[trip.days.length - 1].items.length === 0) trip.days.pop();
  trip.days.forEach((d, i) => { d.date = addDays(trip.start, i); });
}

const str = (v: unknown, max: number) => String(v ?? "").slice(0, max);

function sanitizeItem(it: any): Item {
  const out: Item = {
    id: typeof it?.id === "string" ? it.id : uid(),
    time: normTime(it?.time),
    title: str(it?.title, 300),
    place: str(it?.place, 300),
    cat: isCat(it?.cat) ? it.cat : guessCat((it?.title || "") + " " + (it?.place || "")),
    cost: Number(it?.cost) || 0,
    note: str(it?.note, 2000),
    done: !!it?.done,
  };
  if (typeof it?.icon === "string" && it.icon && /^[a-z]+$/.test(it.icon)) out.icon = it.icon;
  const ll = cleanLL(it) || parseLL(it?.place);
  if (ll) { out.lat = ll.lat; out.lng = ll.lng; }
  return out;
}

function sanitizeStay(s: any): Stay {
  const out: Stay = {
    id: typeof s?.id === "string" ? s.id : uid(),
    name: str(s?.name, 200),
    address: str(s?.address, 300),
    map: isUrl(s?.map) ? String(s.map).trim().slice(0, 1000) : "",
    startDay: Math.max(0, parseInt(s?.startDay) || 0),
    nights: Math.max(1, parseInt(s?.nights) || 1),
    cost: Number(s?.cost) || 0,
    booking: str(s?.booking, 200),
    note: str(s?.note, 1000),
  };
  if (typeof s?.visited === "boolean") out.visited = s.visited;
  const ll = cleanLL(s) || parseLL(s?.map);
  if (ll) { out.lat = ll.lat; out.lng = ll.lng; }
  return out;
}

/** ตรวจและเติมค่าให้ข้อมูลทริปที่มาจากภายนอก (ไฟล์ JSON, AI, แปลงแบบพื้นฐาน) — รับรูปแบบเดียวกับต้นแบบ */
export function sanitizeTrip(raw: any): Trip {
  const t = newTrip();
  if (!raw || typeof raw !== "object") return t;
  (["id", "name", "destination", "notes"] as const).forEach((k) => { if (typeof raw[k] === "string") t[k] = raw[k]; });
  if (typeof raw.start === "string" && parseISO(raw.start)) t.start = raw.start;
  if (typeof raw.end === "string" && parseISO(raw.end)) t.end = raw.end;
  if (typeof raw.currency === "string" && raw.currency.trim()) t.currency = raw.currency.toUpperCase().slice(0, 5);
  t.travelers = Math.max(1, parseInt(raw.travelers) || 1);
  t.budget = Number(raw.budget) || 0;
  t.created = Number(raw.created) || Date.now();
  t.updated = Number(raw.updated) || Date.now();
  t.days = (Array.isArray(raw.days) ? raw.days : []).map((d: any) => ({
    id: typeof d?.id === "string" ? d.id : uid(),
    title: typeof d?.title === "string" ? d.title : "",
    date: typeof d?.date === "string" && parseISO(d.date) ? d.date : "",
    items: (Array.isArray(d?.items) ? d.items : []).map(sanitizeItem),
  }));
  t.stays = (Array.isArray(raw.stays) ? raw.stays : []).map(sanitizeStay)
    .filter((s: Stay) => s.name)
    .sort((a: Stay, b: Stay) => a.startDay - b.startDay);
  t.checklist = (Array.isArray(raw.checklist) ? raw.checklist : [])
    .map((c: any): CheckItem => typeof c === "string"
      ? { id: uid(), text: c, done: false }
      : { id: typeof c?.id === "string" ? c.id : uid(), text: String(c?.text || ""), done: !!c?.done })
    .filter((c: CheckItem) => c.text);
  if (t.start) syncDaysToRange(t);
  return t;
}

/* ---------- ที่พัก ---------- */

export function stayForDay(trip: Trip, di: number): Stay | undefined {
  return (trip.stays || []).find((s) => di >= s.startDay && di < s.startDay + s.nights);
}

export function stayQuery(st: Stay): string {
  return st.map || [st.name, st.address].filter(Boolean).join(" ");
}

export function stayRange(trip: Trip, s: Stay): string {
  if (trip.start) {
    const a = addDays(trip.start, s.startDay), b = addDays(trip.start, s.startDay + s.nights);
    return fmtDate(a, false) + " – " + fmtDate(b, false);
  }
  return "คืนวันที่ " + (s.startDay + 1) + (s.nights > 1 ? "–" + (s.startDay + s.nights) : "");
}

/** พักแล้ว: ใช้ค่าที่ผู้ใช้ติ๊กไว้ ถ้าไม่เคยติ๊ก ถือว่าพักแล้วเมื่อมีกิจกรรม "ไปแล้ว" ในช่วงคืนนั้น */
export function stayVisited(t: Trip, s: Stay): boolean {
  if (typeof s.visited === "boolean") return s.visited;
  for (let i = s.startDay; i < s.startDay + s.nights && i < t.days.length; i++) {
    if (t.days[i].items.some((x) => x.done)) return true;
  }
  return false;
}

/** ที่พักที่ช่วงคืนซ้อนกับช่วงที่ให้มา (ไม่นับตัวเอง) */
export function stayClash(t: Trip, startDay: number, nights: number, exceptId?: string): Stay | undefined {
  return (t.stays || []).find((x) => x.id !== exceptId && startDay < x.startDay + x.nights && x.startDay < startDay + nights);
}

/** index ของคืนที่ยังไม่มีที่พัก (คืนสุดท้ายของทริปไม่ต้องพัก) */
export function stayGaps(t: Trip): number[] {
  const nightsNeeded = Math.max(0, t.days.length - 1);
  const gaps: number[] = [];
  for (let i = 0; i < nightsNeeded; i++) if (!stayForDay(t, i)) gaps.push(i);
  return gaps;
}

/* ---------- งบประมาณ ---------- */

export const daySum = (d: Day): number => d.items.reduce((s, i) => s + (Number(i.cost) || 0), 0);

export interface Totals { total: number; byCat: Partial<Record<string, number>>; items: number }

/** รวมค่าใช้จ่าย: ทุกกิจกรรม + ค่าที่พักจาก stays (ไม่นับซ้ำในกิจกรรม) */
export function tripTotals(trip: Trip): Totals {
  const byCat: Record<string, number> = {};
  let total = 0, items = 0;
  trip.days.forEach((d) => d.items.forEach((it) => {
    items++;
    const c = Number(it.cost) || 0;
    total += c;
    const k = it.cat || "other";
    byCat[k] = (byCat[k] || 0) + c;
  }));
  (trip.stays || []).forEach((s) => {
    const c = Number(s.cost) || 0;
    total += c;
    byCat.stay = (byCat.stay || 0) + c;
  });
  return { total, byCat, items };
}

export const perPerson = (total: number, travelers: number) => total / (travelers || 1);

export interface BudgetStatus { pct: number; over: boolean; remaining: number }
export function budgetStatus(total: number, budget: number): BudgetStatus | null {
  if (!budget) return null;
  return { pct: Math.min(100, (total / budget) * 100), over: total > budget, remaining: budget - total };
}

/* ---------- ข้อมูลทริป (ฟอร์ม "แก้ข้อมูลทริป") ---------- */

export interface TripInfoInput {
  name: string; destination: string; start: string; end: string;
  travelers: number | string; currency: string; budget: number | string;
}

/**
 * ใช้ค่าจากฟอร์มข้อมูลทริป คืน error เป็นข้อความถ้ากรอกไม่ถูก
 * ถ้าย่นวันกลับแต่วันท้ายยังมีกิจกรรม จะขยายวันกลับให้แทนการลบ แล้วคืน notice ไว้แจ้งผู้ใช้
 */
export function applyTripInfo(trip: Trip, f: TripInfoInput, isNew: boolean): { error?: string; notice?: string } {
  const start = f.start || "", end = f.end || "";
  if (start && end && end < start) return { error: "วันกลับต้องไม่ก่อนวันเริ่ม" };
  if (start && end && daysBetween(start, end) > MAX_TRIP_DAYS) return { error: `ทริปยาวได้ไม่เกิน ${MAX_TRIP_DAYS} วัน` };
  let notice: string | undefined;
  trip.name = String(f.name || "").trim() || "ทริปใหม่";
  trip.destination = String(f.destination || "").trim();
  trip.travelers = Math.max(1, parseInt(String(f.travelers)) || 1);
  trip.currency = f.currency || "THB";
  trip.budget = Number(f.budget) || 0;
  trip.start = start;
  trip.end = start ? end || start : "";
  if (trip.start) {
    const nNeed = daysBetween(trip.start, trip.end) + 1;
    if (trip.days.length > nNeed && trip.days.slice(nNeed).some((d) => d.items.length)) {
      trip.end = addDays(trip.start, trip.days.length - 1);
      notice = "ขยายวันกลับให้ เพราะวันท้ายๆ ยังมีกิจกรรมอยู่";
    }
    syncDaysToRange(trip);
  } else if (isNew && !trip.days.length) {
    trip.days.push(newDay());
  }
  if (!trip.start) trip.days.forEach((d) => (d.date = ""));
  return { notice };
}

/* ---------- AI helpers ---------- */

export interface ItemRef { it: Item; d: Day; di: number }

export function itemsMissingNotes(t: Trip): ItemRef[] {
  const out: ItemRef[] = [];
  t.days.forEach((d, di) => d.items.forEach((it) => { if (!String(it.note || "").trim()) out.push({ it, d, di }); }));
  return out;
}

/** จำนวนสถานที่ที่ยังไม่มีพิกัด (นับเฉพาะกิจกรรมที่มีชื่อสถานที่ และที่พักทุกแห่ง) */
export function countMissing(t: Trip): number {
  let n = 0;
  t.days.forEach((d) => d.items.forEach((it) => { if (!hasLL(it) && it.place && !isUrl(it.place)) n++; }));
  (t.stays || []).forEach((s) => { if (!hasLL(s)) n++; });
  return n;
}

/* ---------- คัดลอกเป็นข้อความ ---------- */

export function tripAsText(t: Trip): string {
  const L: string[] = [];
  L.push(t.name + (t.destination ? " — " + t.destination : ""));
  if (t.start) L.push(fmtDate(t.start) + (t.end && t.end !== t.start ? " – " + fmtDate(t.end) : "") + " · " + t.travelers + " คน");
  t.days.forEach((d, i) => {
    L.push("");
    L.push("วันที่ " + (i + 1) + (d.date ? " (" + fmtDate(d.date) + ")" : "") + (d.title ? " · " + d.title : ""));
    const st = stayForDay(t, i);
    if (st) L.push("🛏 นอน: " + st.name + (st.address ? " (" + st.address + ")" : "") + " — " + mapsLink(stayQuery(st)));
    d.items.forEach((it) => L.push((it.time ? it.time + " " : "• ") + it.title + (it.place && it.place !== it.title ? " @ " + it.place : "") + (it.cost ? " · " + money(it.cost, t.currency) : "") + (it.note ? " (" + it.note + ")" : "")));
  });
  const tot = tripTotals(t);
  if (tot.total) { L.push(""); L.push("รวมค่าใช้จ่าย " + money(tot.total, t.currency) + " (ต่อคน " + money(perPerson(tot.total, t.travelers), t.currency) + ")"); }
  if (t.checklist.length) { L.push(""); L.push("เช็กลิสต์: " + t.checklist.map((c) => (c.done ? "✓ " : "") + c.text).join(", ")); }
  return L.join("\n");
}

/* ---------- นำเข้าแผน (หลังพรีวิว) ---------- */

/** เตรียมผลการแปลงก่อนบันทึก: เติมวันเริ่มจากวันแรกที่มีวันที่ หรือจากวันที่ผู้ใช้ระบุ แล้วคำนวณวันกลับจากจำนวนวัน */
export function prepareParsed(parsed: any, startOverride: string): any {
  const p = JSON.parse(JSON.stringify(parsed || {}));
  delete p.id;
  if (!p.start && Array.isArray(p.days)) {
    const ds = p.days.map((d: any) => d?.date).filter((d: unknown) => parseISO(d));
    if (ds.length) p.start = ds[0];
  }
  if (startOverride && !p.start) p.start = startOverride;
  if (p.start) p.end = addDays(p.start, Math.max(0, (p.days || []).length - 1));
  return p;
}

export function importAsNewTrip(parsed: any, startOverride: string): Trip {
  const p = prepareParsed(parsed, startOverride);
  if (!p.currency) p.currency = "THB";
  const t = sanitizeTrip(p);
  t.id = uid();
  t.created = Date.now();
  return t;
}

/** เพิ่มแผนที่นำเข้าลงทริปเดิม: วันที่ i ของแผน → วันที่ i ของทริป, ที่พักที่ช่วงคืนซ้อนจะถูกข้าม, เช็กลิสต์ไม่ซ้ำ */
export function mergeIntoTrip(t: Trip, parsed: any, startOverride: string): void {
  const p = prepareParsed(parsed, startOverride);
  const add = sanitizeTrip({ ...p, start: "", end: "" });
  add.days.forEach((d, i) => {
    if (t.days[i]) {
      t.days[i].items.push(...d.items);
      if (!t.days[i].title) t.days[i].title = d.title;
    } else t.days.push({ id: uid(), title: d.title, date: "", items: d.items });
  });
  if (t.start && t.days.length > daysBetween(t.start, t.end) + 1) t.end = addDays(t.start, t.days.length - 1);
  if (t.start) syncDaysToRange(t);
  t.stays = t.stays || [];
  add.stays.forEach((s) => { if (!stayClash(t, s.startDay, s.nights)) t.stays.push(s); });
  t.stays.sort((a, b) => a.startDay - b.startDay);
  add.checklist.forEach((c) => { if (!t.checklist.some((x) => x.text === c.text)) t.checklist.push(c); });
  if (!t.destination && add.destination) t.destination = add.destination;
}

export const catLabel = (k: string) => (CATS as any)[k]?.label || "อื่นๆ";
export const catColor = (k: string) => (CATS as any)[k]?.color || CATS.other.color;
export const iconExists = (k: string) => !!AICONS[k];

export const CHECK_SUGGEST = ["พาสปอร์ต", "วีซ่า", "ตั๋วเครื่องบิน", "จองที่พัก", "ประกันเดินทาง", "ซิม/eSIM", "แลกเงิน", "ปลั๊กแปลง", "พาวเวอร์แบงก์", "ยาประจำตัว"];
