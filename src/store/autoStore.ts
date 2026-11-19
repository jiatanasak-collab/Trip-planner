// เลือกที่เก็บข้อมูลอัตโนมัติ:
// 1) เปิดเป็นหน้า artifact บน claude.ai → เก็บในบัญชีของผู้เปิด (db capability, ส่วนตัวต่อคน)
// 2) ที่อื่น → IndexedDB ในเบราว์เซอร์
// 3) ถ้าเบราว์เซอร์เก็บข้อมูลไม่ได้ → เก็บในหน่วยความจำ (หายเมื่อปิดหน้า)
import type { Journal, Trip } from "../domain/types";
import { sanitizeJournal } from "../domain/backup";
import { sanitizeTrip } from "../domain/trip";
import { DexieTripStore } from "./dexieStore";
import type { TripStore } from "./TripStore";

const claudeUse = (name: string): Promise<any> => {
  const c = (window as any).claude;
  if (!c || typeof c.use !== "function") return Promise.resolve(null);
  return c.use(name).catch(() => null);
};

const timeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

/** เก็บใน db ของ artifact ใต้ data/users/<id>/ ซึ่งเป็นส่วนตัวของผู้เปิดแต่ละคน */
class ArtifactDbStore implements TripStore {
  readonly label = "บันทึกในบัญชีของคุณ";
  private pending = new Map<string, Record<string, unknown>>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private chains = new Map<string, Promise<void>>();
  constructor(private col: any) {}

  async listTrips() {
    const snap = await timeout(this.col.get(), 10000) as any;
    return snap.docs
      .filter((d: any) => d.id !== "journal" && d.data()?.trip)
      .map((d: any) => sanitizeTrip(JSON.parse(JSON.stringify(d.data().trip))));
  }
  async getJournal(): Promise<Journal> {
    const d: any = await timeout(this.col.doc("journal").get(), 10000);
    return (d.exists && sanitizeJournal(d.data()?.journal)) || { countries: {} };
  }
  /** เขียนทีละครั้งต่อเอกสาร และรวมการแก้ถี่ๆ (เช่นพิมพ์บันทึก) เป็นการเขียนครั้งเดียว */
  private write(id: string, body: Record<string, unknown> | null) {
    this.pending.set(id, body as any);
    clearTimeout(this.timers.get(id));
    return new Promise<void>((resolve, reject) => {
      this.timers.set(id, setTimeout(() => {
        const prev = this.chains.get(id) || Promise.resolve();
        const next = prev.then(async () => {
          if (!this.pending.has(id)) return;
          const b = this.pending.get(id);
          this.pending.delete(id);
          const ref = this.col.doc(id);
          if (b === null) await ref.delete(); else await ref.set(b);
        });
        this.chains.set(id, next.catch(() => {}));
        next.then(resolve, reject);
      }, 600));
    });
  }
  putTrip(trip: Trip) { return this.write(trip.id, { trip: JSON.parse(JSON.stringify(trip)), updated: trip.updated }); }
  deleteTrip(id: string) { return this.write(id, null); }
  putJournal(j: Journal) { return this.write("journal", { journal: JSON.parse(JSON.stringify(j)) }); }
}

class MemoryStore implements TripStore {
  readonly label = "ยังไม่ได้บันทึก (เบราว์เซอร์นี้เก็บข้อมูลไม่ได้)";
  private trips = new Map<string, Trip>();
  private journal: Journal = { countries: {} };
  async listTrips() { return [...this.trips.values()]; }
  async putTrip(t: Trip) { this.trips.set(t.id, JSON.parse(JSON.stringify(t))); }
  async deleteTrip(id: string) { this.trips.delete(id); }
  async getJournal() { return this.journal; }
  async putJournal(j: Journal) { this.journal = j; }
}

async function pickStore(): Promise<TripStore> {
  try {
    const [db, user] = await Promise.all([claudeUse("db"), claudeUse("user")]);
    const id = user ? await user.id().catch(() => null) : null;
    // ผู้ที่มีสิทธิ์แค่ดู (Viewer) เขียนข้อมูลในบัญชีไม่ได้ → ใช้ที่เก็บในเบราว์เซอร์แทน
    const canWrite = user?.can ? await Promise.resolve(user.can("data.write")).catch(() => null) : null;
    if (db && id && canWrite !== false) {
      const s = new ArtifactDbStore(db.collection("data/users/" + id));
      await s.listTrips(); // ตรวจว่าอ่านได้จริงก่อนเลือกใช้
      return s;
    }
  } catch { /* ใช้ที่เก็บในเบราว์เซอร์แทน */ }
  try {
    const s = new DexieTripStore();
    await s.listTrips();
    return s;
  } catch {
    return new MemoryStore();
  }
}

/** TripStore ที่รอเลือกที่เก็บก่อนทำงาน (หน้าเว็บแสดงได้ทันทีระหว่างรอ) */
export class AutoStore implements TripStore {
  private inner: TripStore | null = null;
  private ready = pickStore().then((s) => (this.inner = s));
  get label() { return this.inner?.label || "กำลังเชื่อมต่อ…"; }
  listTrips() { return this.ready.then((s) => s.listTrips()); }
  putTrip(t: Trip) { return this.ready.then((s) => s.putTrip(t)); }
  deleteTrip(id: string) { return this.ready.then((s) => s.deleteTrip(id)); }
  getJournal() { return this.ready.then((s) => s.getJournal()); }
  putJournal(j: Journal) { return this.ready.then((s) => s.putJournal(j)); }
}
