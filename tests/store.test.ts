import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { DexieTripStore } from "../src/store/dexieStore";
import { newTrip } from "../src/domain/trip";

describe("DexieTripStore", () => {
  it("บันทึก อ่าน และลบทริป", async () => {
    const s = new DexieTripStore("test-" + Math.random());
    const t = newTrip({ name: "A" });
    await s.putTrip(t);
    expect((await s.listTrips()).map((x) => x.name)).toEqual(["A"]);
    await s.deleteTrip(t.id);
    expect(await s.listTrips()).toEqual([]);
  });
  it("journal เริ่มต้นว่าง และบันทึกได้", async () => {
    const s = new DexieTripStore("test-" + Math.random());
    expect(await s.getJournal()).toEqual({ countries: {} });
    await s.putJournal({ countries: { "764": true } });
    expect(await s.getJournal()).toEqual({ countries: { "764": true } });
  });
});
