import { useState, type FormEvent } from "react";
import { Ic } from "../../components/Icon";
import { CURRENCIES } from "../../domain/cats";
import { applyTripInfo } from "../../domain/trip";
import type { Trip } from "../../domain/types";
import { useApp } from "../../state";

export function TripForm({ trip, isNew }: { trip: Trip; isNew?: boolean }) {
  const app = useApp();
  const [err, setErr] = useState("");

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const input = {
      name: String(f.get("name") || ""), destination: String(f.get("destination") || ""),
      start: String(f.get("start") || ""), end: String(f.get("end") || ""),
      travelers: String(f.get("travelers") || ""), currency: String(f.get("currency") || "THB"), budget: String(f.get("budget") || ""),
    };
    if (isNew) {
      const t: Trip = JSON.parse(JSON.stringify(trip));
      const r = applyTripInfo(t, input, true);
      if (r.error) return setErr(r.error);
      app.saveTrip(t);
      app.closeModal();
      app.setUi({ tab: "plan", mapDay: null });
      app.go("trip", t.id);
      return;
    }
    // ตรวจก่อนบน clone เพื่อแสดง error ในฟอร์มโดยไม่แก้ข้อมูล
    const probe = applyTripInfo(JSON.parse(JSON.stringify(trip)), input, false);
    if (probe.error) return setErr(probe.error);
    app.updateTrip(trip.id, (d) => { applyTripInfo(d, input, false); });
    if (probe.notice) app.toast(probe.notice);
    app.closeModal();
  };

  const del = () =>
    app.confirm(`ลบทริป "${trip.name}" ใช่ไหม? ลบแล้วกู้คืนไม่ได้`, "ลบทริป", () => {
      app.removeTrip(trip.id);
      app.go("home", null);
      app.toast("ลบทริปแล้ว");
    });

  return (
    <>
      <h3>{isNew ? "สร้างทริปใหม่" : "แก้ข้อมูลทริป"}</h3>
      <form onSubmit={submit}>
        <label className="f">ชื่อทริป</label>
        <input className="txt" name="name" defaultValue={isNew ? "" : trip.name} placeholder="เช่น โตเกียว–ฟูจิ 5 วัน" required autoFocus />
        <label className="f">ปลายทาง</label>
        <input className="txt" name="destination" defaultValue={trip.destination} placeholder="เช่น ญี่ปุ่น" />
        <div className="frow">
          <div><label className="f">วันเริ่ม</label><input className="txt" type="date" name="start" defaultValue={trip.start} /></div>
          <div><label className="f">วันกลับ</label><input className="txt" type="date" name="end" defaultValue={trip.end} /></div>
        </div>
        <div className="frow3">
          <div><label className="f">จำนวนคน</label><input className="txt" type="number" min={1} name="travelers" defaultValue={trip.travelers || 1} /></div>
          <div>
            <label className="f">สกุลเงิน</label>
            <select className="txt" name="currency" defaultValue={trip.currency}>
              {[...new Set([trip.currency, ...CURRENCIES])].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div><label className="f">งบรวม</label><input className="txt" type="number" min={0} step="any" name="budget" defaultValue={trip.budget || ""} placeholder="ไม่บังคับ" /></div>
        </div>
        {isNew && <p className="hint" style={{ marginTop: 10 }}>ถ้ายังไม่รู้วันที่ เว้นว่างไว้ก่อน แล้วเพิ่มวันเองได้</p>}
        <div className="err">{err}</div>
        <div className="foot">
          {!isNew && <button type="button" className="btn danger" style={{ marginRight: "auto" }} onClick={del}><Ic n="trash" /> ลบทริป</button>}
          <button type="button" className="btn" onClick={app.closeModal}>ยกเลิก</button>
          <button className="btn primary">{isNew ? "สร้างทริป" : "บันทึก"}</button>
        </div>
      </form>
    </>
  );
}
