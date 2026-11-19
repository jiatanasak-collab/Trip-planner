import type { Cat } from "./types";

export const CATS: Record<Cat, { label: string; color: string }> = {
  sight: { label: "เที่ยวชม", color: "var(--c-sight)" },
  food: { label: "กิน/ดื่ม", color: "var(--c-food)" },
  move: { label: "เดินทาง", color: "var(--c-move)" },
  stay: { label: "ที่พัก", color: "var(--c-stay)" },
  shop: { label: "ช้อปปิ้ง", color: "var(--c-shop)" },
  other: { label: "อื่นๆ", color: "var(--c-other)" },
};

export const CAT_KEYS = Object.keys(CATS) as Cat[];
export const isCat = (k: unknown): k is Cat => typeof k === "string" && k in CATS;

export const CURRENCIES = ["THB", "JPY", "KRW", "USD", "EUR", "CNY", "TWD", "HKD", "SGD", "MYR", "VND", "GBP", "AUD"];

/** เดาประเภทกิจกรรมจากข้อความ (ใช้ตอนนำเข้า และตอนพิมพ์ชื่อกิจกรรมใหม่) */
export function guessCat(text: string): Cat {
  const t = (text || "").toLowerCase();
  if (/บิน|เครื่องบิน|สนามบิน|รถไฟ|ชินคันเซ็น|รถบัส|บัส|แท็กซี่|taxi|flight|train|bus|airport|transfer|เดินทาง|นั่งรถ|ขึ้นรถ|เรือ|ferry|subway|mrt|bts|jr /.test(t)) return "move";
  if (/โรงแรม|ที่พัก|เช็คอิน|เช็กอิน|check.?in|check.?out|เช็คเอาท์|hotel|hostel|ryokan|เรียวกัง|airbnb|พักผ่อน|นอน/.test(t)) return "stay";
  if (/กิน|อาหาร|ร้าน|คาเฟ่|cafe|café|coffee|กาแฟ|ข้าว|มื้อ|lunch|dinner|breakfast|brunch|ราเมง|ซูชิ|บุฟเฟ่ต์|ขนม|ดื่ม|บาร์|bar|izakaya|ปิ้งย่าง|street food/.test(t)) return "food";
  if (/ช้อป|ช็อป|shopping|mall|ห้าง|ตลาด|market|outlet|เอาท์เล็ท|ซื้อของ|ของฝาก|ดองกี้|don quijote/.test(t)) return "shop";
  return "sight";
}
