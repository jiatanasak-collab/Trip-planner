// API ของแอป: ตรวจว่ามีคีย์ AI ไหม และส่งคำขอไปยัง Anthropic Messages API
// คีย์อ่านจาก env ANTHROPIC_API_KEY ฝั่งเซิร์ฟเวอร์เท่านั้น ไม่ถูกส่งไปที่เบราว์เซอร์
import Anthropic from "@anthropic-ai/sdk";
import { Hono } from "hono";
import { extractJson, type JsonShape } from "./json";

export const MODEL = "claude-sonnet-5-5";
const MAX_PROMPT_CHARS = 200_000;
const MAX_IMAGES = 6;
const MAX_IMAGE_B64 = 7_000_000; // ~5MB ต่อรูป (ฝั่งเบราว์เซอร์ย่อรูปก่อนส่งอยู่แล้ว)
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

interface AiRequest {
  prompt: string;
  images?: { media_type: string; data: string }[];
  expect?: JsonShape;
}

export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

export const app = new Hono().basePath("/api");

app.get("/status", (c) => c.json({ ai: aiEnabled(), model: aiEnabled() ? MODEL : null }));

app.post("/ai", async (c) => {
  if (!aiEnabled()) return c.json({ code: "not_configured", error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY" }, 503);

  let body: AiRequest;
  try { body = await c.req.json(); } catch { return c.json({ code: "bad_request", error: "รูปแบบคำขอไม่ถูกต้อง" }, 400); }
  const prompt = typeof body?.prompt === "string" ? body.prompt : "";
  const images = Array.isArray(body?.images) ? body.images : [];
  const shape: JsonShape = body?.expect === "array" ? "array" : "object";
  if (!prompt.trim() || prompt.length > MAX_PROMPT_CHARS) return c.json({ code: "bad_request", error: "ข้อความว่างหรือยาวเกินไป" }, 400);
  if (images.length > MAX_IMAGES) return c.json({ code: "bad_request", error: `แนบรูปได้ไม่เกิน ${MAX_IMAGES} รูป` }, 400);
  for (const im of images) {
    if (!IMAGE_TYPES.includes(im?.media_type as ImageType) || typeof im?.data !== "string" || im.data.length > MAX_IMAGE_B64) {
      return c.json({ code: "bad_request", error: "รูปภาพไม่ถูกต้องหรือใหญ่เกินไป" }, 400);
    }
  }

  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    ...images.map((im): Anthropic.Beta.BetaImageBlockParam => ({
      type: "image",
      source: { type: "base64", media_type: im.media_type as ImageType, data: im.data },
    })),
    { type: "text", text: prompt },
  ];

  try {
    const res = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // ถ้าโมเดลปฏิเสธคำขอ ให้ API ลองโมเดลสำรองให้อัตโนมัติ
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages: [{ role: "user", content }],
    } as any);
    if (res.stop_reason === "refusal") return c.json({ code: "refused", error: "AI ปฏิเสธคำขอนี้" }, 422);
    const text = res.content.map((b: any) => (b.type === "text" ? b.text : "")).join("");
    const data = extractJson(text, shape);
    if (data === undefined) return c.json({ code: "bad_output", error: "AI ตอบกลับในรูปแบบที่อ่านไม่ได้" }, 502);
    return c.json({ data, truncated: res.stop_reason === "max_tokens" });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return c.json({ code: "rate_limited", error: "ใช้งาน AI ถี่เกินไป" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return c.json({ code: "bad_key", error: "คีย์ ANTHROPIC_API_KEY ไม่ถูกต้อง" }, 502);
    if (e instanceof Anthropic.BadRequestError) return c.json({ code: "bad_request", error: e.message }, 400);
    if (e instanceof Anthropic.APIError) return c.json({ code: "upstream", error: `AI ขัดข้อง (${e.status ?? "network"})` }, 502);
    console.error(e);
    return c.json({ code: "server", error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" }, 500);
  }
});
