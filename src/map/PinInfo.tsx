import { Aic } from "../components/Icon";
import { PinBtns } from "../components/common";
import { itemIcon } from "../domain/icons";
import { catColor } from "../domain/trip";
import { fmtDate } from "../domain/util";
import { useApp } from "../state";
import type { Pin } from "./pins";

/** กล่องรายละเอียดหมุด: ชื่อสถานที่ ทริป วันที่ ปุ่มเปิด Google Maps และติ๊ก "ไปแล้ว" ทีละรายการ */
export function PinInfo({ pin }: { pin: Pin }) {
  const app = useApp();
  return (
    <div className="card pininfo">
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="pi-name">{pin.visited && <><span className="okbadge">✓ ไปแล้ว</span> </>}{pin.name}</div>
          <div className="meta">{pin.tripName}{pin.date ? " · " + fmtDate(pin.date) : " · วันที่ " + (pin.day + 1)}</div>
        </div>
        <PinBtns q={pin.lat.toFixed(6) + "," + pin.lng.toFixed(6)} label="เปิดใน Google Maps" />
      </div>
      <div style={{ marginTop: 8 }}>
        {pin.refs.map((r) => (
          <label key={r.kind + r.id} className="check" style={{ border: "none", padding: "4px 0" }}>
            <input type="checkbox" className="cb" checked={r.visited} onChange={(e) => {
              const v = e.target.checked;
              app.updateTrip(pin.tripId, (d) => {
                if (r.kind === "item") { const it = d.days.find((x) => x.id === r.dayId)?.items.find((x) => x.id === r.id); if (it) it.done = v; }
                else { const s = d.stays.find((x) => x.id === r.id); if (s) s.visited = v; }
              });
            }} />
            {r.kind === "item"
              ? <span className="aicon" style={{ width: 26, height: 26, color: catColor(r.ref.cat) }}><Aic k={itemIcon(r.ref)} size={14} /></span>
              : <span className="aicon" style={{ width: 26, height: 26, color: "var(--c-stay)" }}><Aic k="bed" size={14} /></span>}
            <span>{r.time ? r.time + " · " : ""}{r.title}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
