import type { Journal, Trip } from "../domain/types";

/**
 * ที่เก็บข้อมูลทริป แยกเป็น interface เพื่อเปลี่ยนไปใช้ backend ภายหลังได้
 * (เช่น REST API หรือ Supabase) โดยไม่ต้องแก้หน้าจอ
 */
export interface TripStore {
  /** ข้อความสั้นๆ ที่แสดงมุมขวาบน เช่น "บันทึกในเครื่องนี้" */
  readonly label: string;
  listTrips(): Promise<Trip[]>;
  putTrip(trip: Trip): Promise<void>;
  deleteTrip(id: string): Promise<void>;
  getJournal(): Promise<Journal>;
  putJournal(journal: Journal): Promise<void>;
  /** ที่เก็บนี้แชร์ทริปกับคนอื่นได้ไหม (trip.shared = true) */
  readonly canShare?: boolean;
  /** ฟังทริปที่แชร์เมื่อคนอื่นแก้ คืนฟังก์ชันหยุดฟัง */
  subscribeShared?(cb: (trips: Trip[]) => void): () => void;
}
