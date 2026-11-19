import { mapsLink, navLink } from "../domain/util";
import { Ic } from "./Icon";

/** ปุ่ม "ดูบนแผนที่" + "นำทาง" ไป Google Maps */
export function PinBtns({ q, label }: { q: string; label?: string }) {
  if (!q) return null;
  return (
    <>
      <a className="pinbtn" href={mapsLink(q)} target="_blank" rel="noopener"><Ic n="map" size={13} /> {label || "ดูบนแผนที่"}</a>
      <a className="pinbtn go" href={navLink(q)} target="_blank" rel="noopener"><Ic n="nav" size={13} /> นำทาง</a>
    </>
  );
}

export const Spin = () => <span className="spin" />;

/**
 * ดาวน์โหลดไฟล์ JSON — ใน artifact ของ claude.ai ใช้ระบบดาวน์โหลดของ artifact (ผู้ใช้ยืนยันก่อนบันทึก)
 * ที่อื่นใช้ลิงก์ดาวน์โหลดของเบราว์เซอร์ คืน true ถ้าบันทึกแล้ว
 */
export async function downloadJson(filename: string, data: unknown): Promise<boolean> {
  const text = JSON.stringify(data, null, 2);
  const c = (window as any).claude;
  if (c && typeof c.use === "function") {
    const dl = await c.use("downloads").catch(() => null);
    if (dl) {
      try { await dl.save({ filename, data: text }); return true; } catch { return false; }
    }
  }
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
