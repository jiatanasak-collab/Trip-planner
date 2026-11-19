import { useRef, type FormEvent } from "react";
import { Ic } from "../../components/Icon";
import { CHECK_SUGGEST } from "../../domain/trip";
import type { Trip } from "../../domain/types";
import { uid } from "../../domain/util";
import { useApp } from "../../state";

export function CheckTab({ t }: { t: Trip }) {
  const app = useApp();
  const input = useRef<HTMLInputElement>(null);
  const sugg = CHECK_SUGGEST.filter((s) => !t.checklist.some((c) => c.text === s));
  const add = (text: string) => app.updateTrip(t.id, (d) => { d.checklist.push({ id: uid(), text, done: false }); });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = (input.current?.value || "").trim();
    if (!v) return;
    add(v);
    input.current!.value = "";
    input.current!.focus();
  };

  return (
    <div className="card panel">
      {t.checklist.length ? t.checklist.map((c) => (
        <div key={c.id} className={"check " + (c.done ? "done" : "")}>
          <input type="checkbox" className="cb" checked={c.done}
            onChange={(e) => { const v = e.target.checked; app.updateTrip(t.id, (d) => { const x = d.checklist.find((y) => y.id === c.id); if (x) x.done = v; }); }} />
          <span>{c.text}</span>
          <button className="iconbtn" title="ลบ" onClick={() => app.updateTrip(t.id, (d) => { d.checklist = d.checklist.filter((x) => x.id !== c.id); })}><Ic n="trash" /></button>
        </div>
      )) : <p style={{ color: "var(--muted)", marginTop: 0 }}>ยังไม่มีรายการ</p>}
      <form className="addrow" onSubmit={submit}>
        <input ref={input} className="txt" placeholder="เพิ่มของที่ต้องเตรียม หรือสิ่งที่ต้องจอง" autoComplete="off" />
        <button className="btn primary"><Ic n="plus" /> เพิ่ม</button>
      </form>
      {sugg.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>เพิ่มด่วน:</span>
          {sugg.map((s) => <button key={s} className="btn sm" onClick={() => add(s)}>+ {s}</button>)}
        </div>
      )}
    </div>
  );
}
