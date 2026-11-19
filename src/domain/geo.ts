import type { LatLng } from "./types";

export const hasLL = (o: unknown): o is LatLng =>
  !!o && typeof (o as LatLng).lat === "number" && typeof (o as LatLng).lng === "number";

/**
 * อ่านพิกัดจากข้อความ รองรับ:
 * - "35.7148, 139.7967"
 * - ลิงก์ Google Maps แบบ /@lat,lng, ?q=lat,lng (รวม query/ll/destination/center) และ !3dlat!4dlng
 */
export function parseLL(str: unknown): LatLng | null {
  const s = String(str || "").trim();
  if (!s) return null;
  const pats = [
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,
    /[?&](?:q|query|ll|destination|center)=(-?\d{1,2}\.\d+)(?:,|%2C)\s*(-?\d{1,3}\.\d+)/i,
    /^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/,
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,
  ];
  for (const p of pats) {
    const m = p.exec(s);
    if (m) {
      const lat = +m[1], lng = +m[2];
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }
  return null;
}

/** ตรวจ lat/lng ที่มาจากข้อมูลภายนอก (JSON หรือ AI) ตัดค่า 0,0 และค่านอกช่วงทิ้ง */
export function cleanLL(o: unknown): LatLng | null {
  if (!o || typeof o !== "object") return null;
  const r = o as { lat?: unknown; lng?: unknown };
  if (r.lat == null || r.lng == null || r.lat === "" || r.lng === "") return null;
  const lat = Number(r.lat), lng = Number(r.lng);
  return isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0)
    ? { lat, lng }
    : null;
}
