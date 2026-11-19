// ส่งออก/นำเข้าไฟล์ JSON
import type { Journal, Trip } from "./types";
import { sanitizeTrip } from "./trip";

export const BACKUP_KIND = "trip-planner-backup";

export interface Backup {
  kind: typeof BACKUP_KIND;
  version: 1;
  exported: string;
  trips: Trip[];
  journal?: Journal;
}

export function makeBackup(trips: Trip[], journal?: Journal): Backup {
  return { kind: BACKUP_KIND, version: 1, exported: new Date().toISOString(), trips, ...(journal ? { journal } : {}) };
}

export function sanitizeJournal(j: any): Journal | null {
  if (!j || typeof j !== "object" || !j.countries || typeof j.countries !== "object") return null;
  const c: Record<string, true> = {};
  Object.keys(j.countries).forEach((k) => { if (j.countries[k]) c[String(k).slice(0, 12)] = true; });
  return { countries: c };
}

const looksLikeTrip = (o: any) => !!o && typeof o === "object" && Array.isArray(o.days);

/**
 * อ่านไฟล์ JSON ที่นำเข้า รองรับทุกรูปแบบที่ต้นแบบและแอปนี้ใช้:
 * - ทริปเดียว `{ name, days, ... }`
 * - array ของทริป
 * - ไฟล์สำรองของแอปนี้ `{ kind, trips, journal }`
 * - ข้อมูล localStorage ของต้นแบบ `{ [id]: trip }`
 * - เอกสารฐานข้อมูลของต้นแบบ `{ trip: {...} }`
 */
export function readImportJson(data: unknown): { trips: Trip[]; journal: Journal | null } {
  const d: any = data;
  let raw: any[] = [];
  let journal: Journal | null = null;
  if (Array.isArray(d)) raw = d.map((x) => (looksLikeTrip(x?.trip) ? x.trip : x));
  else if (d && typeof d === "object") {
    if (Array.isArray(d.trips)) { raw = d.trips; journal = sanitizeJournal(d.journal); }
    else if (looksLikeTrip(d)) raw = [d];
    else if (looksLikeTrip(d.trip)) raw = [d.trip];
    else {
      raw = Object.values(d).map((x: any) => (looksLikeTrip(x?.trip) ? x.trip : x));
      if (d.journal) journal = sanitizeJournal(d.journal.journal || d.journal);
    }
  }
  const trips = raw.filter(looksLikeTrip).map(sanitizeTrip);
  return { trips, journal };
}

export function safeFileName(s: string): string {
  return (s || "trip").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-").slice(0, 60) || "trip";
}
