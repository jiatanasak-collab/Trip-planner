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

/**
 * เก็บใน db ของ artifact:
 * - ทริปส่วนตัว + ประเทศที่เคยไป → data/users/<id>/ (เห็นได้แค่เจ้าของ)
 * - ทริปที่แชร์ → trips/<tripId> (ทุกคนที่หน้านี้แชร์ให้ระดับ Contributor ขึ้นไปเห็นและแก้ได้)
 */
class ArtifactDbStore implements TripStore {
  readonly label = "บันทึกในบัญชีของคุณ";
  readonly canShare = true;
  private pending = new Map<string, { ref: any; body: Record<string, unknown> | null }>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private chains = new Map<string, Promise<void>>();
  /** ทริปแต่ละอันเก็บอยู่ที่ไหนตอนนี้ (ใช้ย้ายเมื่อเปิด/ปิดการแชร์) */
  private where = new Map<string, "private" | "shared">();
  constructor(private col: any, private sharedCol: any) {}

  private read(snap: any, shared: boolean): Trip[] {
    return snap.docs
      .filter((d: any) => d.id !== "journal" && d.data()?.trip)
      .map((d: any) => {
        const t = sanitizeTrip(JSON.parse(JSON.stringify(d.data().trip)));
        t.id = d.id;
        if (shared) t.shared = true; else delete t.shared;
        this.where.set(t.id, shared ? "shared" : "private");
        return t;
      });
  }
  async listTrips() {
    const mine = this.read(await timeout(this.col.get(), 10000), false);
    let shared: Trip[] = [];
    try { shared = this.read(await timeout(this.sharedCol.get(), 10000), true); } catch { /* ไม่มีสิทธิ์อ่านทริปที่แชร์ */ }
    const ids = new Set(shared.map((t) => t.id));
    return [...shared, ...mine.filter((t) => !ids.has(t.id))];
  }
  async getJournal(): Promise<Journal> {
    const d: any = await timeout(this.col.doc("journal").get(), 10000);
    return (d.exists && sanitizeJournal(d.data()?.journal)) || { countries: {} };
  }
  private waiters = new Map<string, { resolve: () => void; reject: (e: unknown) => void }[]>();
  /** เขียนทีละครั้งต่อเอกสาร และรวมการแก้ถี่ๆ (เช่นพิมพ์บันทึก) เป็นการเขียนครั้งเดียว
   * ทุกคำสั่งที่ถูกรวมกันจะได้ผลลัพธ์ (resolve/reject) พร้อมกันเมื่อเขียนจริง */
  private write(ref: any, body: Record<string, unknown> | null, delay = 600) {
    const key = ref.path;
    this.pending.set(key, { ref, body });
    clearTimeout(this.timers.get(key));
    return new Promise<void>((resolve, reject) => {
      const list = this.waiters.get(key) || [];
      list.push({ resolve, reject });
      this.waiters.set(key, list);
      this.timers.set(key, setTimeout(() => {
        const ws = this.waiters.get(key) || [];
        this.waiters.delete(key);
        const prev = this.chains.get(key) || Promise.resolve();
        const next = prev.then(async () => {
          const job = this.pending.get(key);
          if (!job) return;
          this.pending.delete(key);
          if (job.body === null) await job.ref.delete(); else await job.ref.set(job.body);
        });
        this.chains.set(key, next.catch(() => {}));
        next.then(() => ws.forEach((w) => w.resolve()), (e) => ws.forEach((w) => w.reject(e)));
      }, delay));
    });
  }
  putTrip(trip: Trip) {
    const to = trip.shared ? "shared" : "private";
    const from = this.where.get(trip.id);
    const body = JSON.parse(JSON.stringify(trip));
    delete body.shared;
    this.where.set(trip.id, to);
    const target = (to === "shared" ? this.sharedCol : this.col).doc(trip.id);
    const p = this.write(target, { trip: body, updated: trip.updated });
    // ย้ายที่เก็บ: เขียนที่ใหม่ก่อน แล้วค่อยลบที่เดิม
    if (from && from !== to) {
      const old = (from === "shared" ? this.sharedCol : this.col).doc(trip.id);
      return p.then(() => this.write(old, null, 0));
    }
    return p;
  }
  deleteTrip(id: string) {
    const from = this.where.get(id) || "private";
    this.where.delete(id);
    return this.write((from === "shared" ? this.sharedCol : this.col).doc(id), null);
  }
  putJournal(j: Journal) { return this.write(this.col.doc("journal"), { journal: JSON.parse(JSON.stringify(j)) }); }
  /** ฟังการเปลี่ยนแปลงของทริปที่แชร์ (อีกคนแก้แล้วเห็นทันที) */
  subscribeShared(cb: (trips: Trip[]) => void) {
    return this.sharedCol.onSnapshot(
      (snap: any) => { if (!snap.metadata.hasPendingWrites && !snap.metadata.fromCache) cb(this.read(snap, true)); },
      () => { /* หยุดฟัง: ยังใช้งานได้ แค่ไม่อัปเดตสด */ },
    );
  }
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
      const s = new ArtifactDbStore(db.collection("data/users/" + id), db.collection("trips"));
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
  get canShare() { return !!this.inner?.canShare; }
  subscribeShared(cb: (trips: Trip[]) => void) {
    let stop: (() => void) | null = null, dead = false;
    this.ready.then((s) => { if (!dead && s.subscribeShared) stop = s.subscribeShared(cb); });
    return () => { dead = true; stop?.(); };
  }
  listTrips() { return this.ready.then((s) => s.listTrips()); }
  putTrip(t: Trip) { return this.ready.then((s) => s.putTrip(t)); }
  deleteTrip(id: string) { return this.ready.then((s) => s.deleteTrip(id)); }
  getJournal() { return this.ready.then((s) => s.getJournal()); }
  putJournal(j: Journal) { return this.ready.then((s) => s.putJournal(j)); }
}
