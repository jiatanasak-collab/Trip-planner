// ทดสอบเส้นทาง /api/ai จนถึง SDK โดยใช้เซิร์ฟเวอร์จำลองแทน Anthropic API (ไม่ต้องมีคีย์จริง)
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let server: Server;
let last: { url: string; headers: Record<string, unknown>; body: any } | null = null;
let reply: { status: number; body: unknown } = { status: 200, body: {} };

const msg = (text: string, stop = "end_turn") => ({
  id: "msg_1", type: "message", role: "assistant", model: "claude-sonnet-5-5", stop_reason: stop, stop_sequence: null,
  content: [{ type: "text", text }], usage: { input_tokens: 1, output_tokens: 1 },
});

beforeAll(async () => {
  server = createServer((req, res) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      last = { url: req.url || "", headers: req.headers, body: JSON.parse(data || "{}") };
      res.writeHead(reply.status, { "content-type": "application/json" });
      res.end(JSON.stringify(reply.body));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  process.env.ANTHROPIC_BASE_URL = `http://localhost:${(server.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = "test-key";
});
afterAll(() => {
  server.close();
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.ANTHROPIC_API_KEY;
});

const call = async (body: unknown) => {
  const { app } = await import("../server/app");
  return app.request("/api/ai", { method: "POST", body: JSON.stringify(body) });
};

describe("/api/ai ผ่าน SDK", () => {
  it("ส่งข้อความ + รูปไปที่ claude-sonnet-5-5 และอ่าน JSON กลับ", async () => {
    reply = { status: 200, body: msg('```json\n{"name":"ทริป","days":[]}\n```') };
    const r = await call({ prompt: "แผน", expect: "object", images: [{ media_type: "image/jpeg", data: "QUJD" }] });
    expect(r.status).toBe(200);
    expect((await r.json()).data).toEqual({ name: "ทริป", days: [] });
    expect(last!.body.model).toBe("claude-sonnet-5-5");
    expect(last!.body.fallbacks).toBe("default");
    expect(String(last!.headers["anthropic-beta"])).toContain("server-side-fallback-2026-07-01");
    expect(last!.headers["authorization"]).toBe("Bearer test-key");
    const content = last!.body.messages[0].content;
    expect(content[0]).toEqual({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: "QUJD" } });
    expect(content[1]).toEqual({ type: "text", text: "แผน" });
  });
  it("array ที่ห่อด้วย object", async () => {
    reply = { status: 200, body: msg('{"notes":[{"id":"a","note":"x"}]}') };
    const r = await call({ prompt: "x", expect: "array" });
    expect((await r.json()).data).toEqual([{ id: "a", note: "x" }]);
  });
  it("โมเดลปฏิเสธ", async () => {
    reply = { status: 200, body: msg("", "refusal") };
    const r = await call({ prompt: "x" });
    expect(r.status).toBe(422);
  });
  it("rate limit", async () => {
    reply = { status: 429, body: { type: "error", error: { type: "rate_limit_error", message: "slow" } } };
    const r = await call({ prompt: "x" });
    expect(r.status).toBe(429);
    expect((await r.json()).code).toBe("rate_limited");
  }, 30000);
});
