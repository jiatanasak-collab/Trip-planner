import { useRef, useState } from "react";
import { readImportJson } from "../../domain/backup";
import type { Journal, Trip } from "../../domain/types";
import { uid } from "../../domain/util";
import { useApp } from "../../state";

/** นำเข้าไฟล์ JSON ของทริป (ไฟล์ที่ส่งออกจากแอปนี้ หรือ JSON ทริปจากต้นแบบ) */
export function ImportJsonModal() {
  const app = useApp();
  const fileIn = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState("");
  const [data, setData] = useState<{ trips: Trip[]; journal: Journal | null } | null>(null);
  const [replace, setReplace] = useState(true);
  const [over, setOver] = useState(false);

  async function read(files: FileList | null) {
    setErr("");
    setData(null);
    const f = files?.[0];
    if (!f) return;
    try {
      const r = readImportJson(JSON.parse(await f.text()));
      if (!r.trips.length && !r.journal) return setErr("ไม่พบข้อมูลทริปในไฟล์นี้");
      setData(r);
    } catch {
      setErr("อ่านไฟล์ไม่ได้ ต้องเป็นไฟล์ .json");
    }
  }

  const dup = data ? data.trips.filter((t) => app.trips[t.id]) : [];

  const save = () => {
    if (!data) return;
    const saved = data.trips.map((t) => {
      const copy = app.trips[t.id] && !replace ? { ...t, id: uid(), name: t.name + " (สำเนา)" } : t;
      app.saveTrip(copy);
      return copy;
    });
    if (data.journal) {
      const j = data.journal;
      app.updateJournal((d) => { Object.assign(d.countries, j.countries); });
    }
    app.closeModal();
    if (saved.length === 1) { app.setUi({ tab: "plan", mapDay: null }); app.go("trip", saved[0].id); }
    app.toast(`นำเข้า ${data.trips.length} ทริปแล้ว`);
  };

  return (
    <>
      <h3>นำเข้าไฟล์ JSON</h3>
      <p className="hint">เลือกไฟล์ที่ส่งออกจากปุ่ม "ส่งออก JSON" หรือ "สำรองข้อมูลทั้งหมด" รองรับไฟล์ทริปจากแอปเวอร์ชันเดิมด้วย</p>
      <div className={"drop " + (over ? "over" : "")} onClick={() => fileIn.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); read(e.dataTransfer.files); }}>
        คลิกเพื่อเลือกไฟล์ .json หรือลากมาวาง
        <input ref={fileIn} type="file" accept=".json,application/json" hidden onChange={(e) => { read(e.target.files); e.target.value = ""; }} />
      </div>
      <div className="err">{err}</div>
      {data && (
        <div className="json-sum">
          <b>พบ {data.trips.length} ทริป</b>{data.journal ? ` และประเทศที่เคยไป ${Object.keys(data.journal.countries).length} ประเทศ` : ""}
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {data.trips.map((t) => (
              <li key={t.id}>{t.name} <span style={{ color: "var(--muted)" }}>· {t.days.length} วัน {t.days.reduce((s, d) => s + d.items.length, 0)} กิจกรรม{app.trips[t.id] ? " · มีอยู่แล้ว" : ""}</span></li>
            ))}
          </ul>
          {dup.length > 0 && (
            <div className="seg" style={{ marginTop: 10 }}>
              <button type="button" className={replace ? "on" : ""} onClick={() => setReplace(true)}>แทนที่ทริปเดิม</button>
              <button type="button" className={!replace ? "on" : ""} onClick={() => setReplace(false)}>เพิ่มเป็นสำเนา</button>
            </div>
          )}
        </div>
      )}
      <div className="foot">
        <button type="button" className="btn" onClick={app.closeModal}>ยกเลิก</button>
        {data && <button type="button" className="btn primary" onClick={save}>นำเข้า</button>}
      </div>
    </>
  );
}
