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

/** ให้เบราว์เซอร์ดาวน์โหลดไฟล์ JSON */
export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
