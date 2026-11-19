import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { importAsNewTrip } from "../src/domain/trip";
import { basicParse, findDate, toYear } from "../src/domain/basicParse";

const TODAY = new Date(2026, 10, 19); // 19 พ.ย. 2026

describe("toYear", () => {
  it("แปลงปี 2 หลักและ พ.ศ.", () => {
    expect(toYear("69")).toBe(2026);
    expect(toYear("26")).toBe(2026);
    expect(toYear("2569")).toBe(2026);
    expect(toYear("2026")).toBe(2026);
  });
});

describe("findDate", () => {
  it("อ่านวันที่หลายรูปแบบ", () => {
    expect(findDate("2026-12-12", TODAY)).toBe("2026-12-12");
    expect(findDate("2569-12-12", TODAY)).toBe("2026-12-12");
    expect(findDate("12/12/69", TODAY)).toBe("2026-12-12");
    expect(findDate("12.12.2026", TODAY)).toBe("2026-12-12");
    expect(findDate("12 ธ.ค. 69", TODAY)).toBe("2026-12-12");
    expect(findDate("12 ธค 2569", TODAY)).toBe("2026-12-12");
    expect(findDate("3 มกราคม 2570", TODAY)).toBe("2027-01-03");
  });
  it("ไม่ระบุปีใช้ปีของ today", () => {
    expect(findDate("5 มี.ค.", TODAY)).toBe("2026-03-05");
  });
  it("ไม่มีวันที่คืนค่าว่าง", () => {
    expect(findDate("ไปวัดพระแก้ว", TODAY)).toBe("");
  });
});

describe("basicParse", () => {
  const text = `ทริปเชียงใหม่ 3 วัน
วันที่ 1 (12 ธ.ค. 69)
08:00 บินกรุงเทพ–เชียงใหม่ 1,500 บาท
11:00 น. ข้าวซอยแม่มณี (ร้านเปิด 9 โมง)
14:00 - 16:00 วัดพระธาตุดอยสุเทพ
วันที่ 2 ดอยอินทนนท์
09.00 ม่อนแจ่ม
- ตลาดวโรรส ฿200
เช็กลิสต์
- [ ] เสื้อกันหนาว
- ยาประจำตัว`;
  const p = basicParse(text, TODAY);

  it("ชื่อทริปจากบรรทัดแรก", () => expect(p.name).toBe("ทริปเชียงใหม่ 3 วัน"));
  it("แยกวันและวันที่", () => {
    expect(p.days).toHaveLength(2);
    expect(p.days[0].date).toBe("2026-12-12");
    expect(p.days[1].title).toBe("ดอยอินทนนท์");
    expect(p.start).toBe("2026-12-12");
    expect(p.end).toBe("2026-12-12");
  });
  it("เวลา ราคา สกุลเงิน หมายเหตุ และประเภท", () => {
    const [a, b, c] = p.days[0].items;
    expect(a).toMatchObject({ time: "08:00", title: "บินกรุงเทพ–เชียงใหม่", cost: 1500, cat: "move" });
    expect(p.currency).toBe("THB");
    expect(b).toMatchObject({ time: "11:00", title: "ข้าวซอยแม่มณี", note: "ร้านเปิด 9 โมง", cat: "food" });
    expect(c).toMatchObject({ time: "14:00", title: "วัดพระธาตุดอยสุเทพ", cat: "sight" });
    expect(p.days[1].items[0]).toMatchObject({ time: "09:00", title: "ม่อนแจ่ม" });
    expect(p.days[1].items[1]).toMatchObject({ time: "", title: "ตลาดวโรรส", cost: 200, cat: "shop" });
  });
  it("เช็กลิสต์", () => expect(p.checklist).toEqual(["เสื้อกันหนาว", "ยาประจำตัว"]));

  it("ไม่มีหัววันก็สร้างวันให้ และตั้งชื่อเริ่มต้น", () => {
    const q = basicParse("09:00 ไปทะเล\n12:00 กินซีฟู้ด", TODAY);
    expect(q.name).toBe("แผนเที่ยวที่นำเข้า");
    expect(q.days).toHaveLength(1);
    expect(q.days[0].items).toHaveLength(2);
  });
  it("Day 1 ภาษาอังกฤษ และเยน", () => {
    const q = basicParse("Tokyo\nDay 1 Asakusa\n10:00 Senso-ji 500 yen", TODAY);
    expect(q.days[0].title).toBe("Asakusa");
    expect(q.days[0].items[0]).toMatchObject({ title: "Senso-ji", cost: 500 });
    expect(q.currency).toBe("JPY");
  });
  it("ข้อความแบบ ChatGPT (markdown, ตัวหนา, ช่วงเวลา, ราคาในวงเล็บ)", () => {
    const q = basicParse("# แผนเที่ยวโตเกียว\n## วันที่ 1 (12 ธ.ค. 2569) – อาซากุสะ\n- **10:30 – 12:00** ไหว้พระวัดเซ็นโซจิ\n- **12:30** กินราเมง (ประมาณ 1,200 เยน)\n- 15:00 สกายทรี ราคา 3,100 เยน\n**ของที่ต้องเตรียม**\n- พาสปอร์ต", TODAY);
    expect(q.name).toBe("แผนเที่ยวโตเกียว");
    expect(q.days[0]).toMatchObject({ date: "2026-12-12", title: "อาซากุสะ" });
    expect(q.days[0].items.map((i) => [i.time, i.title, i.cost])).toEqual([
      ["10:30", "ไหว้พระวัดเซ็นโซจิ", 0],
      ["12:30", "กินราเมง", 1200],
      ["15:00", "สกายทรี", 3100],
    ]);
    expect(q.currency).toBe("JPY");
    expect(q.checklist).toEqual(["พาสปอร์ต"]);
  });
  it("ข้อความว่าง", () => {
    expect(basicParse("", TODAY).days).toEqual([]);
  });
});

describe("basicParse: แผนจาก ChatGPT ที่มีข้อมูลตั๋วก่อนวันแรก", () => {
  const text = readFileSync(new URL("./fixtures/japan-chatgpt.txt", import.meta.url), "utf8");
  const p = basicParse(text, TODAY);
  it("ได้ 12 วัน ปี 2027 ตามที่เขียนในแผน", () => {
    expect(p.days).toHaveLength(12);
    expect(p.start).toBe("2027-01-16");
    expect(p.end).toBe("2027-01-27");
    expect(p.name).toBe("แพลนเที่ยวญี่ปุ่น 16–27 ม.ค. 2027");
  });
  it("ข้อมูลตั๋วเครื่องบินเก็บเป็นบันทึก ไม่กลายเป็นวัน", () => {
    expect(p.notes).toContain("XJ 606");
    expect(p.notes).toContain("XJ 611");
  });
  it("บรรทัด พัก: กลายเป็นที่พักพร้อมจำนวนคืน", () => {
    expect(p.stays).toEqual([
      { name: "Tokyo", startDay: 0, nights: 4 },
      { name: "Yamanakako", startDay: 4, nights: 2 },
      { name: "Nagoya", startDay: 6, nights: 2 },
      { name: "Osaka", startDay: 8, nights: 3 },
    ]);
    expect(p.days.flatMap((d) => d.items).some((i) => i.title.startsWith("พัก"))).toBe(false);
  });
  it("เวลาท้ายบรรทัด และประโยคอธิบายเป็นหมายเหตุ", () => {
    expect(p.days[0].items[1]).toMatchObject({ time: "18:25", title: "ถึงญี่ปุ่น" });
    expect(p.days[11].items[2]).toMatchObject({ time: "19:45", title: "ขึ้นเครื่องกลับ" });
    expect(p.days[0].items[3].note).toContain("วันนี้ไม่ควรใส่โปรแกรมเที่ยว");
  });
  it("นำเข้าเป็นทริปได้ครบ", () => {
    const t = importAsNewTrip(p, "");
    expect(t.days).toHaveLength(12);
    expect(t.stays.map((s) => s.nights)).toEqual([4, 2, 2, 3]);
    expect(t.notes).toContain("Thai AirAsia X");
  });
});

describe("basicParse: วันที่ข้ามปี", () => {
  it("ธ.ค. → ม.ค. ไม่ได้เขียนปี จะขึ้นปีใหม่", () => {
    const p = basicParse("Day 1 — 30 ธ.ค. 2026\n- a\nDay 2 — 31 ธ.ค.\n- b\nDay 3 — 1 ม.ค.\n- c", TODAY);
    expect(p.days.map((d) => d.date)).toEqual(["2026-12-30", "2026-12-31", "2027-01-01"]);
  });
});
