import { useState } from "react";
import { CATS, CAT_KEYS } from "../../domain/cats";
import { budgetStatus, daySum, perPerson, tripTotals } from "../../domain/trip";
import type { Trip } from "../../domain/types";
import { fmtDate, money } from "../../domain/util";
import { useApp } from "../../state";

export function BudgetTab({ t }: { t: Trip }) {
  const app = useApp();
  // แก้ช่องงบแบบพิมพ์ไปเรื่อยๆ แล้วค่อยอัปเดตแถบเมื่อออกจากช่อง (เหมือนต้นแบบ)
  const [draft, setDraft] = useState(t.budget ? String(t.budget) : "");
  const tot = tripTotals(t);
  const max = Math.max(1, ...Object.values(tot.byCat).map(Number));
  const daySums = t.days.map(daySum);
  const dayMax = Math.max(1, ...daySums);
  const bs = budgetStatus(tot.total, t.budget);

  return (
    <div className="grid2">
      <div className="card panel">
        <h3 style={{ fontSize: 16 }}>งบที่ตั้งไว้</h3>
        <div className="addrow">
          <input className="txt" type="number" min={0} step="any" value={draft} placeholder="เช่น 30000"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => app.updateTrip(t.id, (d) => { d.budget = Number(draft) || 0; })}
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
          <span style={{ alignSelf: "center" }}>{t.currency}</span>
        </div>
        {bs ? (
          <>
            <div className="progress"><i className={bs.over ? "over" : ""} style={{ width: bs.pct + "%" }} /></div>
            <div style={{ fontSize: 14 }}>
              {bs.over
                ? <b style={{ color: "var(--coral)" }}>เกินงบ {money(-bs.remaining, t.currency)}</b>
                : <>ใช้ไป {bs.pct.toFixed(0)}% · เหลือ <b>{money(bs.remaining, t.currency)}</b></>}
            </div>
          </>
        ) : <p style={{ color: "var(--muted)", fontSize: 14 }}>ใส่งบรวมของทริปเพื่อดูว่าใช้ไปเท่าไรแล้ว</p>}
        <div style={{ marginTop: 14, fontSize: 14 }}>
          รวมทั้งทริป <b>{money(tot.total, t.currency)}</b> · เฉลี่ยต่อคน <b>{money(perPerson(tot.total, t.travelers), t.currency)}</b>
        </div>
      </div>
      <div className="card panel">
        <h3 style={{ fontSize: 16 }}>แยกตามประเภท</h3>
        {CAT_KEYS.filter((k) => tot.byCat[k]).length ? CAT_KEYS.filter((k) => tot.byCat[k]).map((k) => (
          <div key={k} className="bar-row">
            <span>{CATS[k].label}</span>
            <div className="bar"><i style={{ width: (tot.byCat[k]! / max) * 100 + "%", background: CATS[k].color }} /></div>
            <span className="num">{money(tot.byCat[k], "")}</span>
          </div>
        )) : <p style={{ color: "var(--muted)", fontSize: 14 }}>ยังไม่มีค่าใช้จ่าย ใส่ราคาในแต่ละกิจกรรมได้</p>}
      </div>
      <div className="card panel" style={{ gridColumn: "1/-1" }}>
        <h3 style={{ fontSize: 16 }}>แยกตามวัน</h3>
        {t.days.length ? t.days.map((d, i) => (
          <div key={d.id} className="bar-row">
            <span>วันที่ {i + 1}{d.date ? " · " + fmtDate(d.date, false) : ""}</span>
            <div className="bar"><i style={{ width: (daySums[i] / dayMax) * 100 + "%", background: "var(--teal)" }} /></div>
            <span className="num">{money(daySums[i], "")}</span>
          </div>
        )) : <p style={{ color: "var(--muted)" }}>ยังไม่มีวัน</p>}
      </div>
    </div>
  );
}
