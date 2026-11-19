import { Ic } from "../../components/Icon";
import { PinBtns } from "../../components/common";
import { hasLL } from "../../domain/geo";
import { stayGaps, stayQuery, stayRange, stayVisited } from "../../domain/trip";
import type { Trip } from "../../domain/types";
import { addDays, fmtDate, money } from "../../domain/util";
import { useApp } from "../../state";
import { StayForm } from "../forms/StayForm";

export function StaysTab({ t }: { t: Trip }) {
  const app = useApp();
  const gaps = stayGaps(t);
  return (
    <>
      {gaps.length > 0 && t.days.length > 1 && (
        <div className="gap-warn">
          ยังไม่มีที่พักสำหรับ {gaps.map((i) => (t.start ? "คืน " + fmtDate(addDays(t.start, i), false) : "คืนวันที่ " + (i + 1))).join(", ")}
        </div>
      )}
      {(t.stays || []).length ? t.stays.map((s) => (
        <div key={s.id} className="card stay-card">
          <div className="night"><b>{s.nights}</b><span>คืน</span></div>
          <div>
            <h3>{s.name}</h3>
            <div className="meta">
              <Ic n="cal" size={13} style={{ verticalAlign: -2 }} /> {stayRange(t, s)}
              {t.start ? " (เช็กอิน " + fmtDate(addDays(t.start, s.startDay)) + ")" : ""}
            </div>
            {s.address && <div className="meta">{s.address}</div>}
            {(s.cost || s.booking) ? (
              <div className="meta">
                {s.cost ? money(s.cost, t.currency) : ""}{s.cost && s.booking ? " · " : ""}{s.booking ? "เลขที่จอง " + s.booking : ""}
              </div>
            ) : null}
            {s.note && <div className="meta" style={{ whiteSpace: "pre-wrap" }}>{s.note}</div>}
            <div className="links">
              <PinBtns q={hasLL(s) && !s.map ? s.lat + "," + s.lng : stayQuery(s)} label="ปักหมุดบนแผนที่" />
              <label className="check" style={{ border: "none", padding: "0 6px", gap: 6, fontSize: 13 }}>
                <input type="checkbox" className="cb" checked={stayVisited(t, s)}
                  onChange={(e) => { const v = e.target.checked; app.updateTrip(t.id, (d) => { const x = d.stays.find((y) => y.id === s.id); if (x) x.visited = v; }); }} />
                <span>พักแล้ว</span>
              </label>
            </div>
          </div>
          <div className="acts" style={{ display: "flex", gap: 2 }}>
            <button className="iconbtn" title="แก้ไข" onClick={() => app.openModal(<StayForm tripId={t.id} stayId={s.id} />)}><Ic n="edit" /></button>
            <button className="iconbtn" title="ลบ" onClick={() => app.confirm(`ลบที่พัก "${s.name}"?`, "ลบ", () => app.updateTrip(t.id, (d) => { d.stays = d.stays.filter((x) => x.id !== s.id); }))}><Ic n="trash" /></button>
          </div>
        </div>
      )) : <div className="card empty">ยังไม่มีที่พัก</div>}
      <button className="btn primary" onClick={() => app.openModal(<StayForm tripId={t.id} dayIdx={gaps.length ? gaps[0] : 0} />)}><Ic n="plus" /> เพิ่มที่พัก</button>
    </>
  );
}
