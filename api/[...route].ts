// ตัวเชื่อมสำหรับ deploy บน Vercel: ทุกคำขอ /api/* มาที่ Hono app ตัวเดียวกับตอน dev
import { handle } from "hono/vercel";
import { app } from "../server/app";

export const GET = handle(app);
export const POST = handle(app);
