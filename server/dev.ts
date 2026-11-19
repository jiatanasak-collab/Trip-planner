// เซิร์ฟเวอร์ API สำหรับ npm run dev (Vite ส่งต่อ /api มาที่นี่)
import { serve } from "@hono/node-server";
import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
const { app, aiEnabled } = await import("./app");

const port = Number(process.env.API_PORT || 8787);
serve({ fetch: app.fetch, port }, () => {
  console.log(`API พร้อมที่ http://localhost:${port}/api  ·  AI: ${aiEnabled() ? "เปิดใช้งาน" : "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY (ปุ่ม AI จะถูกซ่อน)"}`);
});
