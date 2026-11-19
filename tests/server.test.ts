import { afterEach, describe, expect, it } from "vitest";
import { app } from "../server/app";
import { extractJson } from "../server/json";

describe("extractJson", () => {
  it("อ่าน JSON ล้วน, มี code fence, หรือมีข้อความปน", () => {
    expect(extractJson('{"a":1}', "object")).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":1}\n```', "object")).toEqual({ a: 1 });
    expect(extractJson('นี่คือผลลัพธ์ {"a":1} ครับ', "object")).toEqual({ a: 1 });
    expect(extractJson('[{"id":"x"}]', "array")).toEqual([{ id: "x" }]);
    expect(extractJson('{"notes":[{"id":"x"}]}', "array")).toEqual([{ id: "x" }]);
    expect(extractJson("ไม่มี json", "object")).toBeUndefined();
  });
});

describe("API", () => {
  const key = process.env.ANTHROPIC_API_KEY;
  afterEach(() => { if (key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = key; });

  it("status บอกว่ายังไม่ได้ตั้งค่า AI เมื่อไม่มีคีย์", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await app.request("/api/status");
    expect(await r.json()).toEqual({ ai: false, model: null });
  });
  it("/api/ai ตอบ 503 เมื่อไม่มีคีย์", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await app.request("/api/ai", { method: "POST", body: JSON.stringify({ prompt: "x" }) });
    expect(r.status).toBe(503);
    expect((await r.json()).code).toBe("not_configured");
  });
  it("/api/ai ตรวจคำขอก่อนเรียก AI", async () => {
    process.env.ANTHROPIC_API_KEY = "test";
    const r = await app.request("/api/ai", { method: "POST", body: JSON.stringify({ prompt: "x", images: [{ media_type: "text/html", data: "x" }] }) });
    expect(r.status).toBe(400);
  });
});
