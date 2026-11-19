import { useState } from "react";
import { aiErrorText, aiNotes } from "../../ai/client";
import { Aic, Ic } from "../../components/Icon";
import { PinBtns, Spin } from "../../components/common";
import { AICONS, itemIcon } from "../../domain/icons";
import { catColor, catLabel, daySum, itemsMissingNotes, newDay, stayForDay, stayQuery, stayRange } from "../../domain/trip";
import type { Trip } from "../../domain/types";
import { fmtDate, isUrl, mapsLink, money, navLink, routeLink, timeKey } from "../../domain/util";
import { useApp } from "../../state";
import { ItemForm } from "../forms/ItemForm";
import { StayForm } from "../forms/StayForm";
import { TripForm } from "../forms/TripForm";

/** ให้ AI เขียนหมายเหตุบนสำเนา แล้วเติมกลับเฉพาะกิจกรรมที่หมายเหตุยังว่าง (กันทับสิ่งที่ผู้ใช้แก้ระหว่างรอ) */
export function useAiNotes(t: Trip) {
  const app = useApp();
  const [progress, setProgress] = useState<number | null>(null);
  const run = async () => {
    const copy: Trip = JSON.parse(JSON.stringify(t));
    const list = itemsMissingNotes(copy);
    if (!list.length) return;
    setProgress(0);
    let n = 0;
    try {
      n = await aiNotes(copy, list, setProgress);
      if (n) {
        const notes = new Map(list.filter((x) => x.it.note).map((x) => [x.it.id, x.it.note]));
        app.updateTrip(t.id, (d) => d.days.forEach((day) => day.items.forEach((it) => {
          const v = notes.get(it.id);
          if (v && !String(it.note || "").trim()) it.note = v;
        })));
      }
      app.toast(n ? `เขียนหมายเหตุให้ ${n} กิจกรรมแล้ว` : "AI ไม่มีหมายเหตุเพิ่ม");
    } catch (e) {
      app.toast(aiErrorText(e, "AI เขียนหมายเหตุไม่สำเร็จ ลองอีกครั้ง"));
    }
    setProgress(null);
  };
  return { run, progress };
}

export function PlanTab({ t }: { t: Trip }) {
  const app = useApp();
  const notes = useAiNotes(t);
  const upd = (fn: (d: Trip) => void) => app.updateTrip(t.id, fn);

  if (!t.days.length) {
    return (
      <div className="card empty">
        ยังไม่มีวันในทริปนี้<br /><br />
        <button className="btn primary" onClick={() => upd((d) => { d.days.push(newDay()); })}><Ic n="plus" /> เพิ่มวัน</button>{" "}
        <button className="btn" onClick={() => app.openModal(<TripForm trip={t} />)}>กำหนดวันเดินทาง</button>
      </div>
    );
  }

  const missing = itemsMissingNotes(t).length;

  return (
    <>
      {missing > 0 && app.ai && (
        <div className="card notesbar">
          <span><Ic n="spark" /> มี {missing} กิจกรรมที่ยังไม่มีหมายเหตุ</span>
          <span className="spacer" />
          <button className="btn sm coral" disabled={notes.progress !== null} onClick={notes.run}>
            {notes.progress === null ? <><Ic n="spark" /> ให้ AI เขียนหมายเหตุ</>
              : notes.progress ? <><Spin /> เขียนแล้ว {notes.progress} รายการ…</> : <><Spin /> AI กำลังเขียนหมายเหตุ…</>}
          </button>
        </div>
      )}
      {(t.stays || []).length > 0 && (
        <div className="stays-strip">
          {t.stays.map((s) => (
            <div key={s.id} className="card stay-chip" onClick={() => app.setUi({ tab: "stays" })}>
              <div className="d"><Ic n="bed" size={13} style={{ verticalAlign: -2 }} /> {stayRange(t, s)} · {s.nights} คืน</div>
              <div className="n">{s.name}</div>
            </div>
          ))}
        </div>
      )}
      {t.days.map((d, di) => {
        const st = stayForDay(t, di);
        const last = di === t.days.length - 1;
        const sum = daySum(d);
        const places = d.items.map((i) => i.place || "").filter((p) => p && !isUrl(p));
        const allDone = d.items.length > 0 && d.items.every((i) => i.done);
        const dayUpd = (fn: (day: Trip["days"][number], d: Trip) => void) => upd((trip) => { const x = trip.days.find((y) => y.id === d.id); if (x) fn(x, trip); });
        return (
          <div key={d.id} className="card day">
            <div className="day-head">
              <span className="day-num">วันที่ {di + 1}</span>
              {d.date && <span className="day-date">{fmtDate(d.date)}</span>}
              <input className="day-title" value={d.title} placeholder="ตั้งชื่อวันนี้ เช่น เที่ยวเมืองเก่า" onChange={(e) => dayUpd((x) => { x.title = e.target.value; })} />
              {sum ? <span className="day-sum">{money(sum, t.currency)}</span> : null}
              {places.length >= 2 && <a className="iconbtn" title="ดูเส้นทางทั้งวันบนแผนที่" href={routeLink(places)} target="_blank" rel="noopener"><Ic n="route" /></a>}
              {!t.start && (
                <button className="iconbtn" title="ลบวันนี้" onClick={() => {
                  const del = () => upd((trip) => { trip.days = trip.days.filter((y) => y.id !== d.id); });
                  if (d.items.length) app.confirm("ลบวันนี้พร้อมกิจกรรม " + d.items.length + " รายการ?", "ลบ", del); else del();
                }}><Ic n="trash" /></button>
              )}
            </div>
            {st ? (
              <div className="stay-row">
                <Ic n="bed" /> <span>คืนนี้นอน <b>{st.name}</b>{st.startDay === di && <> <span className="chip">เช็กอิน</span></>}</span>
                <span className="spacer" />
                <PinBtns q={stayQuery(st)} label="ปักหมุดที่พัก" />
              </div>
            ) : last && t.days.length > 1 && stayForDay(t, di - 1) ? (
              <div className="stay-row none"><Ic n="bed" /> วันเดินทางกลับ — ไม่ต้องพัก</div>
            ) : (
              <div className="stay-row none">
                <Ic n="bed" /> ยังไม่ได้ระบุที่พักคืนนี้ <span className="spacer" />
                <button className="btn sm" onClick={() => app.openModal(<StayForm tripId={t.id} dayIdx={di} />)}><Ic n="plus" /> เพิ่มที่พัก</button>
              </div>
            )}
            <div className="items">
              {d.items.length ? d.items.map((it, ii) => {
                const k = itemIcon(it);
                const color = catColor(it.cat);
                const move = (dir: -1 | 1) => dayUpd((x) => {
                  const i = x.items.findIndex((y) => y.id === it.id), j = i + dir;
                  if (i < 0 || j < 0 || j >= x.items.length) return;
                  [x.items[i], x.items[j]] = [x.items[j], x.items[i]];
                });
                return (
                  <div key={it.id} className={"item " + (it.done ? "done" : "")}>
                    <div className={"time " + (it.time ? "" : "none")}>{it.time || "–"}</div>
                    <div className="aicon" style={{ color }} title={AICONS[k].l}>
                      <Aic k={k} />{it.done && <span className="ok">✓</span>}
                    </div>
                    <div style={{ paddingTop: 3 }}>
                      <div className="title">{it.title}</div>
                      <div className="sub">
                        <span className="chip" style={{ color }}>{catLabel(it.cat)}</span>
                        {it.place && (
                          <>
                            <a href={mapsLink(it.place)} target="_blank" rel="noopener"><Ic n="map" size={13} style={{ verticalAlign: -2 }} /> {isUrl(it.place) ? "เปิดแผนที่" : it.place}</a>{" "}
                            <a href={navLink(it.place)} target="_blank" rel="noopener" title="นำทางไปที่นี่"><Ic n="nav" size={13} style={{ verticalAlign: -2 }} /> นำทาง</a>
                          </>
                        )}
                        {it.cost ? <span>{money(it.cost, t.currency)}</span> : null}
                      </div>
                      {it.note && <div className="note">{it.note}</div>}
                    </div>
                    <div className="acts">
                      <input type="checkbox" className="cb" title="ไปแล้ว" checked={it.done}
                        onChange={(e) => { const v = e.target.checked; dayUpd((x) => { const y = x.items.find((z) => z.id === it.id); if (y) y.done = v; }); }} />
                      <button className="iconbtn" title="เลื่อนขึ้น" disabled={ii === 0} onClick={() => move(-1)}><Ic n="up" /></button>
                      <button className="iconbtn" title="เลื่อนลง" disabled={ii === d.items.length - 1} onClick={() => move(1)}><Ic n="down" /></button>
                      <button className="iconbtn" title="แก้ไข" onClick={() => app.openModal(<ItemForm tripId={t.id} dayId={d.id} itemId={it.id} />)}><Ic n="edit" /></button>
                      <button className="iconbtn" title="ลบ" onClick={() => app.confirm(`ลบ "${it.title}"?`, "ลบ", () => dayUpd((x) => { x.items = x.items.filter((y) => y.id !== it.id); }))}><Ic n="trash" /></button>
                    </div>
                  </div>
                );
              }) : <div style={{ padding: "10px 16px", color: "var(--muted)", fontSize: 14 }}>ยังไม่มีกิจกรรม</div>}
            </div>
            <div className="day-foot">
              <button className="btn sm" onClick={() => app.openModal(<ItemForm tripId={t.id} dayId={d.id} />)}><Ic n="plus" /> เพิ่มกิจกรรม</button>
              {d.items.length > 0 && (
                <button className="btn sm ghost" onClick={() => dayUpd((x) => { x.items.forEach((i) => (i.done = !allDone)); })}>✓ ไปครบทั้งวัน</button>
              )}
              {d.items.length > 1 && (
                <button className="btn sm ghost" onClick={() => dayUpd((x) => { x.items.sort((a, b) => timeKey(a.time) - timeKey(b.time)); })}><Ic n="sort" /> เรียงตามเวลา</button>
              )}
            </div>
          </div>
        );
      })}
      {!t.start && <button className="btn" onClick={() => upd((d) => { d.days.push(newDay()); })}><Ic n="plus" /> เพิ่มวัน</button>}
      {t.start && <p style={{ color: "var(--muted)", fontSize: 13 }}>จำนวนวันตั้งตามวันเดินทาง เปลี่ยนได้ที่ "แก้ข้อมูลทริป"</p>}
    </>
  );
}
