export type Cat = "sight" | "food" | "move" | "stay" | "shop" | "other";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Item {
  id: string;
  /** "HH:MM" หรือ "" */
  time: string;
  title: string;
  /** ชื่อสถานที่ หรือลิงก์ Google Maps */
  place: string;
  cat: Cat;
  cost: number;
  note: string;
  /** "ไปแล้ว" */
  done: boolean;
  /** ไอคอนที่ผู้ใช้เลือกเอง ถ้าไม่มีจะเลือกอัตโนมัติ */
  icon?: string;
  lat?: number;
  lng?: number;
}

export interface Day {
  id: string;
  /** "YYYY-MM-DD" หรือ "" ถ้าทริปยังไม่มีวันเริ่ม */
  date: string;
  title: string;
  items: Item[];
}

export interface Stay {
  id: string;
  name: string;
  address: string;
  /** ลิงก์ Google Maps (https://...) หรือ "" */
  map: string;
  /** index ของวันที่เช็กอิน เริ่มจาก 0 */
  startDay: number;
  nights: number;
  cost: number;
  booking: string;
  note: string;
  visited?: boolean;
  lat?: number;
  lng?: number;
}

export interface CheckItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  start: string;
  end: string;
  currency: string;
  travelers: number;
  budget: number;
  days: Day[];
  stays: Stay[];
  checklist: CheckItem[];
  notes: string;
  created: number;
  updated: number;
}

/** ประเทศที่ผู้ใช้ติ๊กเองว่าเคยไป (key = ISO 3166-1 numeric เช่น "392") */
export interface Journal {
  countries: Record<string, true>;
}
