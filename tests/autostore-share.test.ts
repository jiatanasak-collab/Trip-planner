// ทดสอบการแชร์ทริปของที่เก็บแบบ artifact ด้วย db จำลอง
import { afterEach, describe, expect, it, vi } from "vitest";
import { newTrip } from "../src/domain/trip";

function mockDb() {
  const data: Record<string, any> = {};
  const snap = (path: string) => {
    const pre = path + "/";
    const docs = Object.keys(data).filter((k) => k.startsWith(pre) && !k.slice(pre.length).includes("/"))
      .map((k) => ({ id: k.slice(pre.length), exists: true, data: () => data[k] }));
    return { docs, metadata: { fromCache: false, hasPendingWrites: false } };
  };
  const doc = (path: string) => ({
    path, get: async () => ({ exists: !!data[path], data: () => data[path] }),
    set: async (b: any) => { data[path] = b; }, delete: async () => { delete data[path]; },
  });
  const collection = (path: string) => ({ path, get: async () => snap(path), doc: (id: string) => doc(path + "/" + id), onSnapshot: () => () => {} });
  return { data, db: { collection, doc } };
}

async function storeFor(uid: string, db: any) {
  (globalThis as any).window = { claude: { use: async (n: string) => (n === "db" ? db : n === "user" ? { id: async () => uid, can: () => true } : null) } };
  vi.resetModules();
  const { AutoStore } = await import("../src/store/autoStore");
  const s = new AutoStore();
  await s.listTrips();
  return s;
}

afterEach(() => { vi.useRealTimers(); delete (globalThis as any).window; });

describe("แชร์ทริป (หน้า artifact)", () => {
  it("ทริปส่วนตัวไม่เห็นข้ามคน, แชร์แล้วเห็น, เลิกแชร์แล้วกลับเป็นส่วนตัว", async () => {
    const { data, db } = mockDb();
    const a = await storeFor("A", db);
    expect(a.canShare).toBe(true);
    const t = newTrip({ name: "ญี่ปุ่น" });
    await a.putTrip(t);
    expect(Object.keys(data)).toEqual([`data/users/A/${t.id}`]);
    const b = await storeFor("B", db);
    expect(await b.listTrips()).toEqual([]);

    await a.putTrip({ ...t, shared: true });
    expect(Object.keys(data)).toEqual([`trips/${t.id}`]);
    const seen = await b.listTrips();
    expect(seen.map((x) => [x.name, x.shared])).toEqual([["ญี่ปุ่น", true]]);
    expect(data[`trips/${t.id}`].trip.shared).toBeUndefined();

    await a.putTrip({ ...t });
    expect(Object.keys(data)).toEqual([`data/users/A/${t.id}`]);
    expect(await b.listTrips()).toEqual([]);
  });

  it("แก้ซ้ำถี่ๆ หลังกดแชร์ ยังลบสำเนาเก่าครบ", async () => {
    const { data, db } = mockDb();
    const a = await storeFor("A", db);
    const t = newTrip({ name: "x" });
    await a.putTrip(t);
    const p1 = a.putTrip({ ...t, shared: true });
    const p2 = a.putTrip({ ...t, shared: true, name: "y" });
    await Promise.all([p1, p2]);
    expect(Object.keys(data)).toEqual([`trips/${t.id}`]);
    expect(data[`trips/${t.id}`].trip.name).toBe("y");
  });
});
