import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { instructions, makeTools, tripContext } from "../src/ai/assistant";
import { readImportJson } from "../src/domain/backup";
import type { Trip } from "../src/domain/types";

const fresh = (): Trip => readImportJson(JSON.parse(readFileSync(new URL("./fixtures/prototype-trip.json", import.meta.url), "utf8"))).trips[0];

function setup() {
  let trip = fresh();
  let changes = 0;
  const tools = makeTools(() => trip, (fn) => { const d = JSON.parse(JSON.stringify(trip)); fn(d); trip = d; }, (n) => { changes += n; });
  const run = (name: string, input: any) => tools.find((t) => t.name === name)!.execute(input) as any;
  return { run, get trip() { return trip; }, get changes() { return changes; } };
}

describe("ผู้ช่วย AI: ข้อมูลที่ส่งให้ Claude", () => {
  it("มี id, วันนับจาก 1, ที่พักคืนนั้น และสถานะปักหมุด", () => {
    const c = tripContext(fresh());
    expect(c.days[0]).toMatchObject({ day: 1, date: "2026-12-12", sleep: "Hotel Gracery Shinjuku" });
    expect(c.days[0].items[0]).toMatchObject({ id: "i1", pinned: true });
    expect(c.days[1].items[0]).toMatchObject({ id: "i4", pinned: false });
    expect(c.stays[0]).toMatchObject({ id: "s1", checkInDay: 1, nights: 1, pinned: false });
    expect(instructions(fresh())).toContain('"id":"i4"');
  });
});

describe("ผู้ช่วย AI: เครื่องมือแก้ทริป", () => {
  it("แก้เวลาแล้วเรียงตามเวลาใหม่", () => {
    const s = setup();
    expect(s.run("update_items", { changes: [{ id: "i3", time: "8.30" }] })).toEqual({ updated: 1, notFound: [] });
    expect(s.trip.days[0].items.map((i) => [i.id, i.time])).toEqual([["i3", "08:30"], ["i1", "09:00"], ["i2", "14:00"]]);
  });
  it("ปักหมุดด้วย lat/lng และไม่รับพิกัดที่ผิด", () => {
    const s = setup();
    s.run("update_items", { changes: [{ id: "i4", lat: 35.6896, lng: 139.7006 }, { id: "i5", lat: 999, lng: 0 }] });
    const [i4, i5] = s.trip.days[1].items;
    expect([i4.lat, i4.lng]).toEqual([35.6896, 139.7006]);
    expect(i5.lat).toBeUndefined();
  });
  it("ย้ายวัน และแจ้ง id ที่ไม่มี", () => {
    const s = setup();
    const r = s.run("update_items", { changes: [{ id: "i2", moveToDay: 3, time: "10:00" }, { id: "nope" }] });
    expect(r).toEqual({ updated: 1, notFound: ["nope"] });
    expect(s.trip.days[0].items.map((i) => i.id)).toEqual(["i1", "i3"]);
    expect(s.trip.days[2].items.map((i) => [i.id, i.time])).toEqual([["i2", "10:00"]]);
  });
  it("ไม่แก้ช่องที่ไม่ได้ส่งมา และประเภทที่ไม่รู้จักถูกข้าม", () => {
    const s = setup();
    s.run("update_items", { changes: [{ id: "i2", cat: "party" }] });
    expect(s.trip.days[0].items[1]).toMatchObject({ title: "ไหว้พระวัดเซ็นโซจิ", cat: "sight", note: "ไปก่อน 8 โมงคนน้อย", done: true });
  });
  it("เพิ่มกิจกรรมลงวันที่กำหนด เรียงตามเวลา และปฏิเสธวันที่ไม่มี", () => {
    const s = setup();
    const r = s.run("add_items", { items: [
      { day: 2, time: "07:00", title: "อาหารเช้า", place: "Lawson", cat: "food", lat: 35.5, lng: 138.7 },
      { day: 9, title: "x" },
    ] });
    expect(r.added).toHaveLength(1);
    expect(r.errors).toEqual(["ไม่มีวันที่ 9"]);
    expect(s.trip.days[1].items[0]).toMatchObject({ title: "อาหารเช้า", time: "07:00", cat: "food", lat: 35.5, done: false });
  });
  it("ลบกิจกรรม", () => {
    const s = setup();
    expect(s.run("delete_items", { ids: ["i1", "i5"] })).toEqual({ deleted: 2 });
    expect(s.trip.days.flatMap((d) => d.items).map((i) => i.id)).toEqual(["i2", "i3", "i4"]);
  });
  it("แก้/เพิ่มที่พัก และกันช่วงคืนซ้อน", () => {
    const s = setup();
    const r = s.run("upsert_stays", { stays: [
      { id: "s1", lat: 35.6946, lng: 139.7017 },
      { name: "ซ้อน", checkInDay: 1, nights: 1 },
      { name: "Osaka Hotel", checkInDay: 3, nights: 1 },
    ] });
    expect(r.saved).toBe(2);
    expect(r.errors).toEqual(['ช่วงคืนซ้อนกับ "Hotel Gracery Shinjuku"']);
    expect(s.trip.stays.map((x) => [x.name, x.startDay])).toEqual([["Hotel Gracery Shinjuku", 0], ["Fuji Lake Hotel", 1], ["Osaka Hotel", 2]]);
    expect(s.trip.stays[0].lat).toBe(35.6946);
  });
  it("นับจำนวนการแก้ เพื่อแสดงปุ่มย้อนกลับ", () => {
    const s = setup();
    s.run("update_items", { changes: [{ id: "i1", note: "x" }] });
    s.run("add_items", { items: [{ day: 1, title: "y" }] });
    expect(s.changes).toBe(2);
  });
});
