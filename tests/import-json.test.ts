import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { makeBackup, readImportJson } from "../src/domain/backup";
import { itemIcon } from "../src/domain/icons";

const proto = JSON.parse(readFileSync(new URL("./fixtures/prototype-trip.json", import.meta.url), "utf8"));

describe("นำเข้า JSON จากต้นแบบ", () => {
  const { trips } = readImportJson(proto);
  const t = trips[0];

  it("ข้อมูลทริปครบ", () => {
    expect(trips).toHaveLength(1);
    expect(t).toMatchObject({ id: "k3j9x2ab9f1c", name: "โตเกียว–ฟูจิ 5 วัน", currency: "JPY", travelers: 2, budget: 150000, notes: "เลขจองตั๋ว ABC123", start: "2026-12-12", end: "2026-12-14" });
    expect(t.days.map((d) => d.date)).toEqual(["2026-12-12", "2026-12-13", "2026-12-14"]);
  });
  it("กิจกรรม พิกัด ไอคอน และสถานะไปแล้ว", () => {
    const [i1, i2, i3] = t.days[0].items;
    expect(i1).toMatchObject({ id: "i1", done: true, lat: 35.772, lng: 140.3929, cat: "move" });
    expect(i2).toMatchObject({ done: true, note: "ไปก่อน 8 โมงคนน้อย" });
    expect(i3).toMatchObject({ icon: "bowl", done: false, cost: 3000 });
    // พิกัดจากลิงก์ Google Maps ในช่องสถานที่
    expect(i3).toMatchObject({ lat: 35.6938, lng: 139.7034 });
    expect(itemIcon(i3)).toBe("bowl");
    expect(itemIcon(t.days[1].items[1])).toBe("onsen");
    expect(t.days[1].items[1].time).toBe("");
  });
  it("ที่พักเรียงตามวัน พร้อมพิกัดและสถานะพักแล้ว", () => {
    expect(t.stays.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(t.stays[0]).toMatchObject({ visited: true, booking: "BK-77", map: "https://maps.app.goo.gl/abc", cost: 18000 });
    expect(t.stays[1]).toMatchObject({ lat: 35.5011, lng: 138.7672 });
    expect("visited" in t.stays[1]).toBe(false);
  });
  it("เช็กลิสต์ทั้งแบบ object และข้อความ", () => {
    expect(t.checklist.map((c) => [c.text, c.done])).toEqual([["พาสปอร์ต", true], ["ปลั๊กแปลง", false]]);
  });
});

describe("รูปแบบไฟล์ที่รองรับ", () => {
  it("array ของทริป", () => expect(readImportJson([proto, proto]).trips).toHaveLength(2));
  it("localStorage ของต้นแบบ { id: trip }", () => expect(readImportJson({ [proto.id]: proto }).trips).toHaveLength(1));
  it("เอกสาร db ของต้นแบบ { trip }", () => expect(readImportJson({ trip: proto, updated: 1 }).trips).toHaveLength(1));
  it("ไฟล์สำรองของแอปนี้ รวมประเทศที่ติ๊กไว้", () => {
    const b = JSON.parse(JSON.stringify(makeBackup(readImportJson(proto).trips, { countries: { "392": true } })));
    const r = readImportJson(b);
    expect(r.trips[0].days[0].items[0].done).toBe(true);
    expect(r.journal).toEqual({ countries: { "392": true } });
  });
  it("ไฟล์ที่ไม่ใช่ทริป", () => {
    expect(readImportJson({ hello: 1 }).trips).toEqual([]);
    expect(readImportJson(null).trips).toEqual([]);
  });
});
