// ผู้ช่วย AI ในหน้าทริป: คุยกับ Claude แล้วให้ Claude แก้ทริปผ่าน "เครื่องมือ" ที่หน้าเว็บเตรียมไว้
// ใช้ได้เฉพาะหน้า artifact บน claude.ai (sample capability แบบมี tools)
import { CATS, isCat } from "../domain/cats";
import { cleanLL, hasLL, parseLL } from "../domain/geo";
import { stayClash, stayForDay } from "../domain/trip";
import type { Item, Stay, Trip } from "../domain/types";
import { normTime, timeKey, uid } from "../domain/util";
import { getSampler, MODEL } from "./client";

export interface ChatTurn { role: "user" | "assistant"; content: string }

/** ใช้ผู้ช่วยได้ไหม (ต้องเป็นหน้า artifact ที่รองรับ tools) */
export async function assistantAvailable(): Promise<boolean> {
  const s = await getSampler();
  if (!s) return false;
  const lim = await s.limits().catch(() => null);
  return !!lim?.tools;
}

/** สรุปทริปเป็น JSON สั้นๆ ให้ Claude อ่าน (วันนับจาก 1) */
export function tripContext(t: Trip) {
  return {
    name: t.name, destination: t.destination, start: t.start || null, end: t.end || null,
    currency: t.currency, travelers: t.travelers,
    days: t.days.map((d, i) => ({
      day: i + 1, date: d.date || null, title: d.title || undefined,
      sleep: stayForDay(t, i)?.name,
      items: d.items.map((it) => ({
        id: it.id, time: it.time || undefined, title: it.title, place: it.place || undefined,
        cat: it.cat, cost: it.cost || undefined, note: it.note ? it.note.slice(0, 160) : undefined,
        done: it.done || undefined, pinned: hasLL(it),
      })),
    })),
    stays: t.stays.map((s) => ({
      id: s.id, name: s.name, address: s.address || undefined, checkInDay: s.startDay + 1, nights: s.nights,
      cost: s.cost || undefined, pinned: hasLL(s),
    })),
  };
}

export function instructions(t: Trip): string {
  return `คุณคือผู้ช่วยวางแผนเที่ยวในแอป "สมุดแผนเที่ยว" ช่วยผู้ใช้แก้แผนทริปด้านล่าง ตอบเป็นภาษาไทย สั้น กระชับ เป็นกันเอง
วันนี้คือ ${new Date().toISOString().slice(0, 10)}

กติกา:
- เมื่อผู้ใช้สั่งให้แก้ เพิ่ม ลบ ย้าย หรือปักหมุด ให้เรียกเครื่องมือเพื่อแก้จริง แล้วสรุปสั้นๆ ว่าแก้อะไรไป (ไม่ต้องแสดง id)
- อ้างถึงกิจกรรมด้วย id จากข้อมูลทริปเท่านั้น ห้ามเดา id; วัน (day) นับจาก 1
- เวลาใช้รูปแบบ HH:MM (24 ชม.); ประเภท cat: ${Object.entries(CATS).map(([k, v]) => `${k}=${v.label}`).join(", ")}
- ปักหมุด = ใส่ lat/lng (ทศนิยม 4 ตำแหน่ง) จากความรู้ของคุณ เฉพาะที่มั่นใจตำแหน่ง ถ้าไม่แน่ใจให้ข้ามแล้วบอกผู้ใช้ ถ้าชื่อสถานที่กว้างไป (เช่นแค่ชื่อเมือง) ให้ปักที่ใจกลางพื้นที่นั้นและบอกผู้ใช้
- เมื่อปักหมุดหรือแนะนำสถานที่ ให้ใส่ place เป็นชื่อที่ค้นหาบน Google Maps ได้ (ภาษาอังกฤษหรือภาษาท้องถิ่น)
- ถ้าผู้ใช้ขอคำแนะนำสถานที่ ให้แนะนำ 2–5 แห่งพร้อมเหตุผลสั้นๆ และถามก่อนว่าจะเพิ่มลงแผนไหม ยกเว้นผู้ใช้สั่งให้เพิ่มเลย
- ห้ามแต่งข้อมูลที่ไม่แน่ใจ เช่น ราคาหรือเวลาเปิดปิดเจาะจง ห้ามลบอะไรที่ผู้ใช้ไม่ได้สั่งลบ
- ค่าที่พักใส่ในที่พัก (stays) ไม่ต้องซ้ำในกิจกรรม
- ผู้ใช้กด "ย้อนกลับ" ได้ทุกครั้ง จึงแก้ตามคำสั่งได้เลยไม่ต้องถามยืนยัน

ข้อมูลทริปปัจจุบัน (JSON):
${JSON.stringify(tripContext(t))}`;
}

type Apply = (fn: (d: Trip) => void) => void;
type GetTrip = () => Trip;

const str = (v: unknown, max = 300) => (v == null ? undefined : String(v).slice(0, max));
const num = (v: unknown) => (v == null || v === "" ? undefined : Number(v));

/** เครื่องมือที่ Claude เรียกได้ — ทุกตัวแก้ทริปผ่าน apply() และคืนผลสั้นๆ */
export function makeTools(getTrip: GetTrip, apply: Apply, onChange: (n: number) => void) {
  const findItem = (d: Trip, id: string) => {
    for (const day of d.days) { const it = day.items.find((x) => x.id === id); if (it) return { day, it }; }
    return null;
  };
  const patchItem = (it: Item, c: any) => {
    if (c.time !== undefined) it.time = normTime(c.time);
    if (c.title !== undefined && String(c.title).trim()) it.title = str(c.title)!;
    if (c.place !== undefined) {
      it.place = str(c.place) || "";
      const ll = parseLL(it.place);
      if (ll) { it.lat = ll.lat; it.lng = ll.lng; }
    }
    if (c.cat !== undefined && isCat(c.cat)) it.cat = c.cat;
    if (c.cost !== undefined) it.cost = Math.max(0, num(c.cost) || 0);
    if (c.note !== undefined) it.note = str(c.note, 2000) || "";
    if (c.done !== undefined) it.done = !!c.done;
    if (c.lat !== undefined || c.lng !== undefined) {
      const ll = cleanLL(c);
      if (ll) { it.lat = ll.lat; it.lng = ll.lng; }
      else if (c.lat === null) { delete it.lat; delete it.lng; }
    }
  };

  const itemProps = {
    time: { type: "string", description: "HH:MM หรือ \"\" เพื่อลบเวลา" },
    title: { type: "string" },
    place: { type: "string", description: "ชื่อสถานที่ที่ค้นหาบน Google Maps ได้" },
    cat: { type: "string", enum: Object.keys(CATS) },
    cost: { type: "number" },
    note: { type: "string" },
    lat: { type: "number" },
    lng: { type: "number" },
  };

  return [
    {
      name: "update_items",
      description: "แก้กิจกรรมที่มีอยู่หลายรายการพร้อมกัน: เวลา ชื่อ สถานที่ ประเภท ราคา หมายเหตุ สถานะไปแล้ว พิกัด (ปักหมุด) หรือย้ายไปวันอื่นด้วย moveToDay ใส่เฉพาะช่องที่จะเปลี่ยน คืนจำนวนที่แก้ได้และ id ที่ไม่พบ",
      inputSchema: {
        type: "object",
        properties: {
          changes: {
            type: "array",
            items: { type: "object", properties: { id: { type: "string" }, ...itemProps, done: { type: "boolean" }, moveToDay: { type: "integer", description: "วันที่ปลายทาง นับจาก 1" } }, required: ["id"] },
          },
        },
        required: ["changes"],
      },
      execute(input: Record<string, unknown>) {
        const changes = Array.isArray(input.changes) ? input.changes.slice(0, 200) : [];
        let n = 0; const missing: string[] = [];
        apply((d) => {
          for (const c of changes as any[]) {
            const f = findItem(d, String(c?.id));
            if (!f) { missing.push(String(c?.id)); continue; }
            patchItem(f.it, c);
            const to = num(c.moveToDay);
            if (to && to >= 1 && to <= d.days.length && d.days[to - 1] !== f.day) {
              f.day.items = f.day.items.filter((x) => x !== f.it);
              d.days[to - 1].items.push(f.it);
              d.days[to - 1].items.sort((a, b) => timeKey(a.time) - timeKey(b.time));
            } else if (c.time !== undefined) {
              f.day.items.sort((a, b) => timeKey(a.time) - timeKey(b.time));
            }
            n++;
          }
        });
        onChange(n);
        return { updated: n, notFound: missing };
      },
    },
    {
      name: "add_items",
      description: "เพิ่มกิจกรรมใหม่ลงวันที่กำหนด (day นับจาก 1) เรียงตามเวลาให้อัตโนมัติ ใส่ lat/lng ถ้ารู้ตำแหน่งแน่ชัดเพื่อปักหมุด คืน id ของกิจกรรมใหม่",
      inputSchema: {
        type: "object",
        properties: { items: { type: "array", items: { type: "object", properties: { day: { type: "integer" }, ...itemProps }, required: ["day", "title"] } } },
        required: ["items"],
      },
      execute(input: Record<string, unknown>) {
        const items = Array.isArray(input.items) ? input.items.slice(0, 50) : [];
        const ids: string[] = []; const errors: string[] = [];
        apply((d) => {
          for (const c of items as any[]) {
            const day = num(c?.day);
            if (!day || day < 1 || day > d.days.length) { errors.push(`ไม่มีวันที่ ${c?.day}`); continue; }
            if (!String(c?.title || "").trim()) continue;
            const it: Item = { id: uid(), time: "", title: "", place: "", cat: "sight", cost: 0, note: "", done: false };
            patchItem(it, c);
            if (!isCat(c.cat)) it.cat = "sight";
            d.days[day - 1].items.push(it);
            d.days[day - 1].items.sort((a, b) => timeKey(a.time) - timeKey(b.time));
            ids.push(it.id);
          }
        });
        onChange(ids.length);
        return { added: ids, errors };
      },
    },
    {
      name: "delete_items",
      description: "ลบกิจกรรมตาม id ใช้เฉพาะเมื่อผู้ใช้สั่งลบ",
      inputSchema: { type: "object", properties: { ids: { type: "array", items: { type: "string" } } }, required: ["ids"] },
      execute(input: Record<string, unknown>) {
        const ids = new Set((Array.isArray(input.ids) ? input.ids : []).map(String));
        let n = 0;
        apply((d) => d.days.forEach((day) => {
          const before = day.items.length;
          day.items = day.items.filter((x) => !ids.has(x.id));
          n += before - day.items.length;
        }));
        onChange(n);
        return { deleted: n };
      },
    },
    {
      name: "upsert_stays",
      description: "เพิ่มหรือแก้ที่พัก: มี id = แก้ที่พักเดิม, ไม่มี id = เพิ่มใหม่ (ต้องมี name, checkInDay นับจาก 1, nights) ใส่ lat/lng เพื่อปักหมุด คืนข้อผิดพลาดถ้าช่วงคืนซ้อนกับที่พักอื่น",
      inputSchema: {
        type: "object",
        properties: {
          stays: {
            type: "array",
            items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, address: { type: "string" }, checkInDay: { type: "integer" }, nights: { type: "integer" }, cost: { type: "number" }, note: { type: "string" }, lat: { type: "number" }, lng: { type: "number" } } },
          },
        },
        required: ["stays"],
      },
      execute(input: Record<string, unknown>) {
        const list = Array.isArray(input.stays) ? input.stays.slice(0, 30) : [];
        let n = 0; const errors: string[] = [];
        apply((d) => {
          for (const c of list as any[]) {
            let s: Stay | undefined = c?.id ? d.stays.find((x) => x.id === String(c.id)) : undefined;
            if (c?.id && !s) { errors.push(`ไม่พบที่พัก ${c.id}`); continue; }
            const startDay = num(c.checkInDay) !== undefined ? Math.max(0, num(c.checkInDay)! - 1) : s?.startDay ?? 0;
            const nights = num(c.nights) !== undefined ? Math.max(1, Math.round(num(c.nights)!)) : s?.nights ?? 1;
            const clash = stayClash(d, startDay, nights, s?.id);
            if (clash) { errors.push(`ช่วงคืนซ้อนกับ "${clash.name}"`); continue; }
            if (!s) {
              if (!String(c?.name || "").trim()) { errors.push("ที่พักใหม่ต้องมีชื่อ"); continue; }
              s = { id: uid(), name: "", address: "", map: "", startDay, nights, cost: 0, booking: "", note: "" };
              d.stays.push(s);
            }
            if (c.name !== undefined && String(c.name).trim()) s.name = str(c.name, 200)!;
            if (c.address !== undefined) s.address = str(c.address) || "";
            if (c.cost !== undefined) s.cost = Math.max(0, num(c.cost) || 0);
            if (c.note !== undefined) s.note = str(c.note, 1000) || "";
            s.startDay = startDay; s.nights = nights;
            const ll = cleanLL(c);
            if (ll) { s.lat = ll.lat; s.lng = ll.lng; }
            n++;
          }
          d.stays.sort((a, b) => a.startDay - b.startDay);
        });
        onChange(n);
        return { saved: n, errors };
      },
    },
    {
      name: "get_trip",
      description: "อ่านข้อมูลทริปล่าสุด (หลังแก้ไปแล้ว) ใช้เมื่อต้องตรวจผลหรือต้องการ id ใหม่",
      execute() { return tripContext(getTrip()); },
    },
  ];
}

/** ส่งข้อความหนึ่งรอบ: Claude อาจเรียกเครื่องมือหลายครั้งแล้วตอบข้อความสรุป */
export async function askAssistant(opts: {
  trip: Trip; history: ChatTurn[]; getTrip: GetTrip; apply: Apply; onChange: (n: number) => void;
  onText: (text: string) => void; signal: AbortSignal;
}): Promise<string> {
  const sample = await getSampler();
  if (!sample) throw { code: "not_available", message: "ผู้ช่วยใช้ได้เฉพาะในหน้า artifact บน claude.ai" };
  // เก็บประวัติไว้ไม่เกิน 12 ข้อความล่าสุด และเริ่มด้วยข้อความของผู้ใช้เสมอ
  let hist = opts.history.slice(-12);
  while (hist.length && hist[0].role !== "user") hist = hist.slice(1);
  const input: ChatTurn[] = [{ role: "user", content: instructions(opts.trip) }, ...hist];
  const res = await sample(input, {
    model: MODEL, modelTier: "default", signal: opts.signal,
    tools: makeTools(opts.getTrip, opts.apply, opts.onChange),
    onText: ({ text }: { text: string }) => opts.onText(text),
  });
  return res.text;
}
