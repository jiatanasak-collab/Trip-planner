// เรียก AI ผ่าน backend ของเราเอง (/api/ai) — ไม่มีคีย์ฝั่งเบราว์เซอร์
import { CATS } from "../domain/cats";
import { cleanLL, hasLL } from "../domain/geo";
import type { ItemRef } from "../domain/trip";
import type { Trip } from "../domain/types";
import { isUrl, toISO } from "../domain/util";
import { AI_INSTR, NOTE_RULES } from "./prompts";

export class AiError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

let statusP: Promise<boolean> | null = null;
/** มีคีย์ AI ที่เซิร์ฟเวอร์ไหม (ถามครั้งเดียวแล้วจำไว้) */
export function aiAvailable(): Promise<boolean> {
  statusP ??= fetch("/api/status")
    .then((r) => (r.ok ? r.json() : { ai: false }))
    .then((j) => !!j.ai)
    .catch(() => false);
  return statusP;
}

interface ImagePart { media_type: string; data: string }

async function callAi(prompt: string, expect: "object" | "array", images: ImagePart[] = []): Promise<unknown> {
  let r: Response;
  try {
    r = await fetch("/api/ai", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt, expect, images }) });
  } catch {
    throw new AiError("network", "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new AiError(j.code || "server", j.error || "AI ขัดข้อง");
  return j.data;
}

/** ข้อความแจ้งผู้ใช้ตามชนิดข้อผิดพลาด */
export function aiErrorText(e: unknown, fallback: string): string {
  const code = e instanceof AiError ? e.code : "";
  if (code === "rate_limited") return "ใช้งาน AI ถี่เกินไป รอสักครู่แล้วลองใหม่";
  if (code === "not_configured") return "ยังไม่ได้ตั้งค่า AI (ANTHROPIC_API_KEY)";
  if (code === "bad_key") return "คีย์ AI ไม่ถูกต้อง ตรวจ ANTHROPIC_API_KEY";
  return fallback;
}

/** ย่อรูปก่อนส่ง (ด้านยาวสุด 1600px, JPEG) เพื่อให้ขนาดคำขอเล็กและเร็ว */
export async function imageToPart(file: File, maxSide = 1600): Promise<ImagePart> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * k);
  canvas.height = Math.round(bmp.height * k);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL("image/jpeg", 0.85);
  return { media_type: "image/jpeg", data: url.slice(url.indexOf(",") + 1) };
}

/** ให้ AI แปลงแผนเที่ยว (ข้อความและ/หรือรูป) เป็นโครงสร้างทริป */
export async function aiParse(text: string, images: File[], hintStart: string): Promise<any> {
  const parts = await Promise.all(images.map((f) => imageToPart(f)));
  const input = AI_INSTR + (hintStart ? `\nวันเริ่มทริปที่ผู้ใช้ระบุ: ${hintStart}` : "") + `\nวันนี้คือ ${toISO(new Date())}\n\n--- แผนเที่ยว ---\n` + (text || "(ดูจากรูปภาพที่แนบ)");
  const v = await callAi(input, "object", parts);
  return v && typeof v === "object" ? v : {};
}

/**
 * ให้ AI เขียนหมายเหตุให้กิจกรรมที่ยังว่าง ทีละ 30 รายการ
 * เขียนลงเฉพาะกิจกรรมที่หมายเหตุยังว่างอยู่ — ไม่ทับสิ่งที่ผู้ใช้ใส่เอง
 */
export async function aiNotes(t: Trip, list: ItemRef[], onProgress?: (n: number) => void): Promise<number> {
  let n = 0;
  for (let i = 0; i < list.length; i += 30) {
    const chunk = list.slice(i, i + 30).map((x) => ({
      id: x.it.id, date: x.d.date || "วันที่ " + (x.di + 1), time: x.it.time, title: x.it.title,
      place: isUrl(x.it.place) ? "" : x.it.place, type: CATS[x.it.cat]?.label,
    }));
    const prompt = `ทริป: ${t.name}${t.destination ? " ปลายทาง " + t.destination : ""}${t.start ? " วันที่ " + t.start + " ถึง " + t.end : ""} จำนวน ${t.travelers} คน\n${NOTE_RULES}\nตอบเป็น JSON array เท่านั้น รูปแบบ [{"id":"...","note":"..."}]\n\nกิจกรรม:\n` + JSON.stringify(chunk);
    const v = await callAi(prompt, "array");
    (Array.isArray(v) ? v : []).forEach((r: any) => {
      const x = list.find((y) => y.it.id === r?.id);
      const note = String(r?.note || "").trim().slice(0, 600);
      if (x && note && !String(x.it.note || "").trim()) { x.it.note = note; n++; }
    });
    onProgress?.(n);
  }
  return n;
}

/** ให้ AI หาพิกัดของสถานที่ที่ยังไม่มีพิกัด เติมเฉพาะที่ยังว่าง คืนจำนวนที่ได้ */
export async function aiGeocode(t: Trip): Promise<number> {
  const list: { id: string; q: string }[] = [];
  t.days.forEach((d) => d.items.forEach((it) => { if (!hasLL(it) && it.place && !isUrl(it.place)) list.push({ id: it.id, q: it.place }); }));
  (t.stays || []).forEach((s) => { if (!hasLL(s)) list.push({ id: s.id, q: [s.name, s.address].filter(Boolean).join(", ") }); });
  if (!list.length) return 0;
  const prompt = `ให้พิกัดละติจูด/ลองจิจูด (ทศนิยม 4 ตำแหน่ง) ของสถานที่ต่อไปนี้ ซึ่งอยู่ในทริปไป "${t.destination || t.name}". ตอบเป็น JSON array เท่านั้น รูปแบบ [{"id":"...","lat":0,"lng":0}] ถ้าไม่แน่ใจตำแหน่งของที่ไหน ให้ข้ามรายการนั้น\n\n` + JSON.stringify(list);
  const v = await callAi(prompt, "array");
  let n = 0;
  (Array.isArray(v) ? v : []).forEach((r: any) => {
    const ll = cleanLL(r);
    if (!ll) return;
    const it = t.days.flatMap((d) => d.items).find((x) => x.id === r.id) || (t.stays || []).find((x) => x.id === r.id);
    if (it && !hasLL(it)) { it.lat = ll.lat; it.lng = ll.lng; n++; }
  });
  return n;
}
