import { describe, expect, it } from "vitest";
import { AICONS, itemIcon } from "../src/domain/icons";

const ic = (title: string, cat: any, place = "", icon?: string) => itemIcon({ title, place, cat, icon });

describe("itemIcon", () => {
  it("มีไอคอน 31 แบบ (รวมปุ่มอัตโนมัติเป็น 32 ตัวเลือก)", () => {
    expect(Object.keys(AICONS)).toHaveLength(31);
  });
  it("ใช้ไอคอนที่ผู้ใช้เลือกก่อน", () => {
    expect(ic("วัดเซ็นโซจิ", "sight", "", "castle")).toBe("castle");
  });
  it("ไอคอนที่ไม่รู้จักถูกข้าม", () => {
    expect(ic("วัดเซ็นโซจิ", "sight", "", "nope")).toBe("temple");
  });
  it("match ชื่อกิจกรรมก่อนชื่อสถานที่", () => {
    expect(ic("ขึ้นกระเช้า", "move", "Narita Airport")).toBe("cable");
    expect(ic("ไปต่อ", "move", "Narita Airport")).toBe("plane");
  });
  it("keyword ไทยและอังกฤษ", () => {
    expect(ic("ชินคันเซ็นไปเกียวโต", "move")).toBe("train");
    expect(ic("Shinkansen to Kyoto", "move")).toBe("train");
    expect(ic("ราเมงอิจิรัน", "food")).toBe("bowl");
    expect(ic("Fushimi Inari Taisha", "sight")).toBe("torii");
    expect(ic("Kinkaku-ji", "sight")).toBe("temple");
    expect(ic("Tokyo Skytree", "sight")).toBe("tower");
    expect(ic("แช่ออนเซ็น", "stay")).toBe("onsen");
  });
  it("จำกัดไอคอนตามประเภท (CAT_ALLOWED)", () => {
    // "ตลาดปลา" ในหมวดช้อปปิ้งต้องไม่เป็นปลา
    expect(ic("ตลาดปลาสึกิจิ", "shop")).toBe("market");
    expect(ic("ตลาดปลาสึกิจิ", "food")).toBe("fish");
    // หมวดเดินทางห้ามเป็นวัด แม้ชื่อมีคำว่าวัด
    expect(ic("นั่งรถไปวัด", "move")).toBe("route");
  });
  it("ไม่ match ใช้ไอคอนเริ่มต้นของประเภท", () => {
    expect(ic("อะไรก็ได้", "sight")).toBe("camera");
    expect(ic("อะไรก็ได้", "food")).toBe("meal");
    expect(ic("อะไรก็ได้", "other")).toBe("pin");
  });
  it("ไม่ match จากลิงก์แผนที่", () => {
    expect(ic("ไปต่อ", "sight", "https://maps.google.com/?q=temple")).toBe("camera");
  });
});
