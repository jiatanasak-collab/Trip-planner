import { useState, type FormEvent } from "react";
import { hasLL, parseLL } from "../../domain/geo";
import { stayClash } from "../../domain/trip";
import type { Stay } from "../../domain/types";
import { addDays, fmtDate, isUrl, uid } from "../../domain/util";
import { useApp } from "../../state";

export function StayForm({ tripId, stayId, dayIdx = 0 }: { tripId: string; stayId?: string; dayIdx?: number }) {
  const app = useApp();
  const [err, setErr] = useState("");
  const t = app.trips[tripId];
  const orig = stayId ? t?.stays.find((x) => x.id === stayId) : undefined;
  if (!t || (stayId && !orig)) return null;
  const s: Partial<Stay> = orig || { name: "", address: "", map: "", startDay: dayIdx, nights: 1, cost: 0, booking: "", note: "" };
  const n = Math.max(1, t.days.length);
  const dayOpt = (i: number) => `วันที่ ${i + 1}${t.start ? " · " + fmtDate(addDays(t.start, i)) : ""}`;

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const mapRaw = String(f.get("map") || "").trim();
    const data = {
      name: String(f.get("name") || "").trim(), address: String(f.get("address") || "").trim(),
      map: isUrl(mapRaw) ? mapRaw : "",
      startDay: parseInt(String(f.get("startDay"))) || 0, nights: Math.max(1, parseInt(String(f.get("nights"))) || 1),
      cost: Number(f.get("cost")) || 0, booking: String(f.get("booking") || "").trim(), note: String(f.get("note") || "").trim(),
    };
    if (!data.name) return;
    const llText = String(f.get("ll") || "").trim();
    const ll = parseLL(llText) || parseLL(data.map);
    if (!ll && llText) return setErr("รูปแบบพิกัดไม่ถูกต้อง ใช้แบบ 35.7148, 139.7967");
    if (mapRaw && !data.map) return setErr("ลิงก์แผนที่ต้องขึ้นต้นด้วย https://");
    const clash = stayClash(t, data.startDay, data.nights, stayId);
    if (clash) return setErr(`ช่วงคืนนี้ซ้อนกับ "${clash.name}" — ปรับวันหรือจำนวนคืนก่อน`);
    app.updateTrip(tripId, (d) => {
      d.stays = d.stays || [];
      let x = stayId ? d.stays.find((y) => y.id === stayId) : undefined;
      const resetLL = !ll && x && (x.name !== data.name || x.address !== data.address);
      if (!x) { x = { id: uid() } as Stay; d.stays.push(x); }
      Object.assign(x, data);
      if (ll) { x.lat = ll.lat; x.lng = ll.lng; }
      else if (resetLL) { delete x.lat; delete x.lng; }
      d.stays.sort((a, b) => a.startDay - b.startDay);
    });
    app.closeModal();
  };

  return (
    <>
      <h3>{stayId ? "แก้ไขที่พัก" : "เพิ่มที่พัก"}</h3>
      <form onSubmit={submit}>
        <label className="f">ชื่อที่พัก</label>
        <input className="txt" name="name" defaultValue={s.name} placeholder="เช่น Hotel Gracery Shinjuku" required autoFocus />
        <label className="f">ที่อยู่ หรือชื่อสำหรับค้นหาบนแผนที่</label>
        <input className="txt" name="address" defaultValue={s.address} placeholder="เช่น 1-19-1 Kabukicho, Shinjuku, Tokyo" />
        <div className="frow" style={{ gridTemplateColumns: "1fr 200px" }}>
          <div><label className="f">ลิงก์ Google Maps (ไม่บังคับ — จะเปิดหมุดนี้ตรงๆ)</label><input className="txt" name="map" defaultValue={s.map} placeholder="https://maps.app.goo.gl/..." /></div>
          <div><label className="f">พิกัด (ไม่บังคับ)</label><input className="txt" name="ll" defaultValue={hasLL(s) ? s.lat + ", " + s.lng : ""} placeholder="35.7135, 139.7929" /></div>
        </div>
        <div className="frow">
          <div>
            <label className="f">เช็กอินวัน</label>
            <select className="txt" name="startDay" defaultValue={String(s.startDay)}>
              {Array.from({ length: n }, (_, i) => <option key={i} value={i}>{dayOpt(i)}</option>)}
            </select>
          </div>
          <div><label className="f">จำนวนคืน</label><input className="txt" type="number" min={1} max={60} name="nights" defaultValue={s.nights} /></div>
        </div>
        <div className="frow">
          <div><label className="f">ค่าที่พักรวม ({t.currency})</label><input className="txt" type="number" min={0} step="any" name="cost" defaultValue={s.cost || ""} placeholder="0" /></div>
          <div><label className="f">เลขที่การจอง</label><input className="txt" name="booking" defaultValue={s.booking} /></div>
        </div>
        <label className="f">หมายเหตุ</label>
        <textarea className="txt" rows={2} name="note" defaultValue={s.note} placeholder="เช่น เช็กอิน 15:00, มีอาหารเช้า" />
        <div className="err">{err}</div>
        <div className="foot">
          <button type="button" className="btn" onClick={app.closeModal}>ยกเลิก</button>
          <button className="btn primary">{stayId ? "บันทึก" : "เพิ่ม"}</button>
        </div>
      </form>
    </>
  );
}
