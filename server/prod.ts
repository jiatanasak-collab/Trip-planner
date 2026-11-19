// รันแอปที่ build แล้วบนเซิร์ฟเวอร์ Node ตัวเดียว (หน้าเว็บ + API) — npm run build แล้ว npm start
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { existsSync } from "node:fs";
import { Hono } from "hono";
if (existsSync(".env")) process.loadEnvFile(".env");
const { app: api, aiEnabled } = await import("./app");

const app = new Hono();
app.route("/", api);
app.use("/*", serveStatic({ root: "./dist" }));
app.get("*", serveStatic({ path: "./dist/index.html" }));

const port = Number(process.env.PORT || 3000);
serve({ fetch: app.fetch, port }, () => {
  console.log(`สมุดแผนเที่ยว พร้อมที่ http://localhost:${port}  ·  AI: ${aiEnabled() ? "เปิด" : "ปิด"}`);
});
