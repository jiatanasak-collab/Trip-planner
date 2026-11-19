import { useState, type FormEvent } from "react";
import { aiErrorText, aiNotes } from "../../ai/client";
import { Aic, Ic } from "../../components/Icon";
import { Spin } from "../../components/common";
import { CATS, CAT_KEYS, guessCat } from "../../domain/cats";
import { hasLL, parseLL } from "../../domain/geo";
import { AICONS, itemIcon } from "../../domain/icons";
import type { Cat, Item, Trip } from "../../domain/types";
import { fmtDate, normTime, timeKey, uid } from "../../domain/util";
import { useApp } from "../../state";

export function ItemForm({ tripId, dayId, itemId }: { tripId: string; dayId: string; itemId?: string }) {
  const app = useApp();
  const t: Trip | undefined = app.trips[tripId];
  const day = t?.days.find((d) => d.id === dayId);
  const orig = itemId ? day?.items.find((i) => i.id === itemId) : undefined;
  const it: Partial<Item> = orig || { time: "", title: "", place: "", cat: "sight", cost: 0, note: "" };

  const [title, setTitle] = useState(it.title || "");
  const [place, setPlace] = useState(it.place || "");
  const [cat, setCat] = useState<Cat>(it.cat || "sight");
  const [catTouched, setCatTouched] = useState(!!itemId);
  const [icon, setIcon] = useState(it.icon || "");
  const [note, setNote] = useState(it.note || "");
  const [time, setTime] = useState(it.time || "");
  const [busy, setBusy] = useState(false);

  if (!t || !day || (itemId && !orig)) return null;
  const autoIcon = itemIcon({ title, place, cat });

  const suggest = async () => {
    if (!title.trim()) return app.toast("ใส่ชื่อกิจกรรมก่อน");
    const tmp: Item = { id: "tmp", title: title.trim(), place, time, cat, note: "", cost: 0, done: false };
    setBusy(true);
    try {
      const n = await aiNotes(t, [{ it: tmp, d: day, di: t.days.indexOf(day) }]);
      if (n) setNote((v) => (v.trim() ? v.trim() + "\n" : "") + tmp.note);
      else app.toast("AI ไม่มีคำแนะนำสำหรับกิจกรรมนี้");
    } catch (e) {
      app.toast(aiErrorText(e, "AI เขียนหมายเหตุไม่สำเร็จ ลองอีกครั้ง"));
    }
    setBusy(false);
  };

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const data: Partial<Item> = {
      time: normTime(f.get("time")), title: title.trim(), place: place.trim(), cat,
      cost: Number(f.get("cost")) || 0, note: note.trim(), icon: AICONS[icon] ? icon : "",
    };
    if (!data.title) return;
    const llText = String(f.get("ll") || "").trim();
    const ll = parseLL(llText) || parseLL(data.place);
    if (!ll && llText) return app.toast("รูปแบบพิกัดไม่ถูกต้อง ใช้แบบ 35.7148, 139.7967");
    const targetId = String(f.get("day") || dayId);
    app.updateTrip(tripId, (d) => {
      const src = d.days.find((x) => x.id === dayId)!;
      const target = d.days.find((x) => x.id === targetId) || src;
      const apply = (x: Item) => {
        Object.assign(x, data);
        if (!x.icon) delete x.icon;
        if (ll) { x.lat = ll.lat; x.lng = ll.lng; }
        else if (itemId && orig!.place !== data.place) { delete x.lat; delete x.lng; }
      };
      if (itemId) {
        const x = src.items.find((i) => i.id === itemId)!;
        apply(x);
        if (target !== src) { src.items = src.items.filter((i) => i !== x); target.items.push(x); }
      } else {
        const x = { id: uid(), done: false } as Item;
        apply(x);
        target.items.push(x);
        // กิจกรรมใหม่ที่มีเวลา ให้เรียงตามเวลาทันที
        if (data.time) target.items.sort((a, b) => timeKey(a.time) - timeKey(b.time));
      }
    });
    app.closeModal();
  };

  return (
    <>
      <h3>{itemId ? "แก้ไขกิจกรรม" : "เพิ่มกิจกรรม"}</h3>
      <form onSubmit={submit}>
        <div className="frow keep" style={{ gridTemplateColumns: "120px 1fr" }}>
          <div><label className="f">เวลา</label><input className="txt" type="time" name="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          <div>
            <label className="f">ทำอะไร</label>
            <input className="txt" name="title" value={title} required autoFocus placeholder="เช่น ไหว้พระวัดเซ็นโซจิ"
              onChange={(e) => { setTitle(e.target.value); if (!catTouched) setCat(guessCat(e.target.value)); }} />
          </div>
        </div>
        <div className="frow" style={{ gridTemplateColumns: "1fr 200px" }}>
          <div><label className="f">สถานที่ (ชื่อ หรือวางลิงก์ Google Maps)</label><input className="txt" name="place" value={place} onChange={(e) => setPlace(e.target.value)} placeholder="เช่น Senso-ji Asakusa" /></div>
          <div><label className="f">พิกัด (ไม่บังคับ)</label><input className="txt" name="ll" defaultValue={hasLL(it) ? it.lat + ", " + it.lng : ""} placeholder="35.7148, 139.7967" /></div>
        </div>
        <div className="frow">
          <div>
            <label className="f">ประเภท</label>
            <select className="txt" name="cat" value={cat} onChange={(e) => { setCat(e.target.value as Cat); setCatTouched(true); }}>
              {CAT_KEYS.map((k) => <option key={k} value={k}>{CATS[k].label}</option>)}
            </select>
          </div>
          <div><label className="f">ค่าใช้จ่าย ({t.currency})</label><input className="txt" type="number" min={0} step="any" name="cost" defaultValue={it.cost || ""} placeholder="0" /></div>
        </div>
        <label className="f">ไอคอน</label>
        <div className="iconpick">
          <button type="button" className={"auto " + (icon ? "" : "on")} onClick={() => setIcon("")}>
            {!icon && <Aic k={autoIcon} size={15} style={{ verticalAlign: -3 }} />} อัตโนมัติ
          </button>
          {Object.entries(AICONS).map(([k, v]) => (
            <button type="button" key={k} title={v.l} className={icon === k ? "on" : ""} onClick={() => setIcon(k)}><Aic k={k} /></button>
          ))}
        </div>
        {t.days.length > 1 && (
          <>
            <label className="f">อยู่ในวัน</label>
            <select className="txt" name="day" defaultValue={dayId}>
              {t.days.map((d, i) => (
                <option key={d.id} value={d.id}>วันที่ {i + 1}{d.date ? " · " + fmtDate(d.date) : ""}{d.title ? " · " + d.title : ""}</option>
              ))}
            </select>
          </>
        )}
        <div className="labrow">
          <label className="f">หมายเหตุ</label>
          {app.ai && (
            <button type="button" className="btn sm ghost" disabled={busy} onClick={suggest}>
              {busy ? <><Spin /> AI กำลังเขียนหมายเหตุ…</> : <><Ic n="spark" /> ให้ AI แนะนำ</>}
            </button>
          )}
        </div>
        <textarea className="txt" rows={3} name="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น ต้องจองล่วงหน้า, ปิดวันพุธ" />
        <div className="foot">
          <button type="button" className="btn" onClick={app.closeModal}>ยกเลิก</button>
          <button className="btn primary">{itemId ? "บันทึก" : "เพิ่ม"}</button>
        </div>
      </form>
    </>
  );
}
