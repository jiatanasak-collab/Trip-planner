import { describe, expect, it } from "vitest";
import {
  applyTripInfo, budgetStatus, daySum, mergeIntoTrip, importAsNewTrip, newDay, newTrip, perPerson,
  stayClash, stayForDay, stayGaps, stayRange, stayVisited, syncDaysToRange, tripTotals,
} from "../src/domain/trip";
import { addDays, daysBetween, fmtDate, normTime, timeKey } from "../src/domain/util";

describe("วันที่", () => {
  it("fmtDate แสดงแบบไทย พ.ศ.", () => {
    expect(fmtDate("2026-12-12")).toBe("ส. 12 ธ.ค. 69");
    expect(fmtDate("2026-12-12", false)).toBe("12 ธ.ค. 69");
    expect(fmtDate("")).toBe("");
  });
  it("addDays / daysBetween ข้ามเดือนและปี", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(daysBetween("2026-12-30", "2027-01-02")).toBe(3);
    expect(addDays("bad", 1)).toBe("");
  });
  it("normTime / timeKey", () => {
    expect(normTime("9.30")).toBe("09:30");
    expect(normTime("25:10")).toBe("23:10");
    expect(normTime("")).toBe("");
    expect(timeKey("")).toBe(9999);
    expect(timeKey("01:30")).toBe(90);
  });
});

describe("syncDaysToRange", () => {
  it("สร้างวันตามช่วงวันที่", () => {
    const t = newTrip({ start: "2026-12-12", end: "2026-12-14" });
    syncDaysToRange(t);
    expect(t.days.map((d) => d.date)).toEqual(["2026-12-12", "2026-12-13", "2026-12-14"]);
  });
  it("ไม่ลบวันที่ยังมีกิจกรรม", () => {
    const t = newTrip({ start: "2026-12-12", end: "2026-12-12" });
    t.days = [newDay(), newDay(), newDay({ items: [{ id: "x", time: "", title: "a", place: "", cat: "sight", cost: 0, note: "", done: false }] }), newDay()];
    syncDaysToRange(t);
    expect(t.days).toHaveLength(3);
  });
  it("วันกลับก่อนวันเริ่มถือเป็นวันเดียว", () => {
    const t = newTrip({ start: "2026-12-12", end: "2026-12-01" });
    syncDaysToRange(t);
    expect(t.days).toHaveLength(1);
  });
});

describe("applyTripInfo", () => {
  const base = { name: "x", destination: "", travelers: 2, currency: "THB", budget: "" };
  it("ตรวจวันกลับก่อนวันเริ่ม และเกิน 60 วัน", () => {
    expect(applyTripInfo(newTrip(), { ...base, start: "2026-12-12", end: "2026-12-01" }, true).error).toBeTruthy();
    expect(applyTripInfo(newTrip(), { ...base, start: "2026-01-01", end: "2026-12-01" }, true).error).toBeTruthy();
  });
  it("ทริปใหม่ไม่มีวันที่ได้ 1 วันว่าง", () => {
    const t = newTrip();
    applyTripInfo(t, { ...base, start: "", end: "" }, true);
    expect(t.days).toHaveLength(1);
    expect(t.end).toBe("");
  });
  it("ย่นวันกลับแต่วันท้ายมีกิจกรรม จะขยายวันกลับให้", () => {
    const t = newTrip({ start: "2026-12-12", end: "2026-12-14" });
    syncDaysToRange(t);
    t.days[2].items.push({ id: "x", time: "", title: "a", place: "", cat: "sight", cost: 0, note: "", done: false });
    const r = applyTripInfo(t, { ...base, start: "2026-12-12", end: "2026-12-12" }, false);
    expect(r.notice).toBeTruthy();
    expect(t.end).toBe("2026-12-14");
    expect(t.days).toHaveLength(3);
  });
  it("ลบวันที่ออกแล้ว ล้าง date ของทุกวัน", () => {
    const t = newTrip({ start: "2026-12-12", end: "2026-12-13" });
    syncDaysToRange(t);
    applyTripInfo(t, { ...base, start: "", end: "" }, false);
    expect(t.days.every((d) => d.date === "")).toBe(true);
  });
});

const item = (cost: number, cat: any = "sight", done = false) => ({ id: Math.random() + "", time: "", title: "a", place: "", cat, cost, note: "", done });

describe("งบประมาณ", () => {
  const t = newTrip({ travelers: 2, budget: 10000 });
  t.days = [newDay({ items: [item(1000, "food"), item(500, "move")] }), newDay({ items: [item(2000, "food")] })];
  t.stays = [{ id: "s", name: "H", address: "", map: "", startDay: 0, nights: 1, cost: 3000, booking: "", note: "" }];

  it("รวมกิจกรรม + ที่พัก แยกตามประเภท", () => {
    const tot = tripTotals(t);
    expect(tot.total).toBe(6500);
    expect(tot.items).toBe(3);
    expect(tot.byCat).toEqual({ food: 3000, move: 500, stay: 3000 });
  });
  it("แยกตามวันไม่นับค่าที่พัก", () => {
    expect(t.days.map(daySum)).toEqual([1500, 2000]);
  });
  it("ต่อคน และเทียบงบ", () => {
    expect(perPerson(6500, 2)).toBe(3250);
    expect(perPerson(100, 0)).toBe(100);
    expect(budgetStatus(6500, 10000)).toEqual({ pct: 65, over: false, remaining: 3500 });
    expect(budgetStatus(12000, 10000)).toMatchObject({ pct: 100, over: true, remaining: -2000 });
    expect(budgetStatus(100, 0)).toBeNull();
  });
});

describe("ที่พัก", () => {
  const t = newTrip({ start: "2026-12-12", end: "2026-12-15" });
  syncDaysToRange(t);
  t.stays = [{ id: "a", name: "A", address: "", map: "", startDay: 0, nights: 2, cost: 0, booking: "", note: "" }];
  it("คืนนี้นอนที่ไหน", () => {
    expect(stayForDay(t, 1)?.name).toBe("A");
    expect(stayForDay(t, 2)).toBeUndefined();
  });
  it("ช่วงคืน", () => expect(stayRange(t, t.stays[0])).toBe("12 ธ.ค. 69 – 14 ธ.ค. 69"));
  it("คืนที่ซ้อนกัน", () => {
    expect(stayClash(t, 1, 1)?.id).toBe("a");
    expect(stayClash(t, 2, 1)).toBeUndefined();
    expect(stayClash(t, 1, 1, "a")).toBeUndefined();
  });
  it("คืนที่ยังไม่มีที่พัก (ไม่นับคืนสุดท้าย)", () => expect(stayGaps(t)).toEqual([2]));
  it("พักแล้ว: ตามที่ติ๊ก หรือตามกิจกรรมที่ไปแล้ว", () => {
    expect(stayVisited(t, t.stays[0])).toBe(false);
    t.days[1].items.push(item(0, "sight", true));
    expect(stayVisited(t, t.stays[0])).toBe(true);
    expect(stayVisited(t, { ...t.stays[0], visited: false })).toBe(false);
  });
});

describe("นำเข้าแผน", () => {
  const parsed = { name: "P", days: [{ title: "D1", date: "2026-12-12", items: [{ title: "x", time: "9:00" }] }, { title: "D2", items: [{ title: "y" }] }], checklist: ["พาสปอร์ต"], stays: [{ name: "H", startDay: 0, nights: 1 }] };
  it("สร้างทริปใหม่ ใช้วันที่ของวันแรก", () => {
    const t = importAsNewTrip(parsed, "");
    expect(t.start).toBe("2026-12-12");
    expect(t.end).toBe("2026-12-13");
    expect(t.currency).toBe("THB");
    expect(t.days[0].items[0].time).toBe("09:00");
  });
  it("ใช้วันเริ่มที่ผู้ใช้ระบุถ้าแผนไม่มีวันที่", () => {
    const t = importAsNewTrip({ days: [{ items: [{ title: "x" }] }] }, "2027-01-01");
    expect(t.start).toBe("2027-01-01");
  });
  it("เพิ่มลงทริปเดิม ข้ามที่พักที่ซ้อน และเช็กลิสต์ซ้ำ", () => {
    const t = newTrip({ start: "2026-12-12", end: "2026-12-12" });
    syncDaysToRange(t);
    t.checklist = [{ id: "c", text: "พาสปอร์ต", done: true }];
    t.stays = [{ id: "a", name: "A", address: "", map: "", startDay: 0, nights: 1, cost: 0, booking: "", note: "" }];
    mergeIntoTrip(t, parsed, "");
    expect(t.days).toHaveLength(2);
    expect(t.end).toBe("2026-12-13");
    expect(t.days[1].date).toBe("2026-12-13");
    expect(t.days[0].title).toBe("D1");
    expect(t.stays).toHaveLength(1);
    expect(t.checklist).toHaveLength(1);
  });
});
