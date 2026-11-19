import { Ic } from "../../components/Icon";
import { downloadJson } from "../../components/common";
import { makeBackup, safeFileName } from "../../domain/backup";
import { perPerson, tripAsText, tripTotals } from "../../domain/trip";
import type { Trip } from "../../domain/types";
import { fmtDate, money } from "../../domain/util";
import { TripMap } from "../../map/TripMap";
import { useApp, type TabKey } from "../../state";
import { TripForm } from "../forms/TripForm";
import { ImportModal } from "../import/ImportModal";
import { Assistant } from "./AssistantPanel";
import { BudgetTab } from "./BudgetTab";
import { CheckTab } from "./CheckTab";
import { NotesTab } from "./NotesTab";
import { PlanTab } from "./PlanTab";
import { StaysTab } from "./StaysTab";

const TABS: [TabKey, string][] = [["plan", "แผนรายวัน"], ["map", "แผนที่"], ["stays", "ที่พัก"], ["budget", "งบประมาณ"], ["check", "เช็กลิสต์"], ["notes", "บันทึก"]];

export function TripView({ trip: t }: { trip: Trip }) {
  const app = useApp();
  const { ui, setUi } = app;
  const tot = tripTotals(t);

  const copyText = () => {
    const text = tripAsText(t);
    const fallback = () => app.openModal(<CopyFallback text={text} />);
    try { navigator.clipboard.writeText(text).then(() => app.toast("คัดลอกแผนแล้ว วางในแชตหรือโน้ตได้เลย"), fallback); } catch { fallback(); }
  };
  const exportJson = async () => {
    if (await downloadJson(safeFileName(t.name) + ".json", makeBackup([t]))) app.toast("ดาวน์โหลดไฟล์ทริปแล้ว");
  };

  return (
    <>
      <button className="btn ghost back" onClick={() => app.go("home", null)}><Ic n="back" /> ทริปทั้งหมด</button>
      <div className="card trip-head">
        <div className="row">
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2>{t.name}</h2>
            <div className="meta">
              {t.destination && <span><Ic n="map" /> {t.destination}</span>}
              <span><Ic n="cal" /> {t.start ? fmtDate(t.start) + (t.end && t.end !== t.start ? " – " + fmtDate(t.end) : "") : "ยังไม่กำหนดวัน"}</span>
              <span>{t.travelers} คน</span>
            </div>
          </div>
          <button className="btn sm" onClick={() => app.openModal(<TripForm trip={t} />)}><Ic n="edit" /> แก้ข้อมูลทริป</button>
          <button className="btn sm" onClick={() => app.openModal(<ImportModal intoTripId={t.id} />, true)}><Ic n="import" /> นำเข้าเพิ่ม</button>
          <button className="btn sm" onClick={copyText}><Ic n="copy" /> คัดลอกแผน</button>
          <button className="btn sm" onClick={exportJson}><Ic n="export" /> ส่งออก JSON</button>
        </div>
        <div className="stats">
          <div className="stat"><b>{t.days.length}</b><span>วัน</span></div>
          <div className="stat"><b>{tot.items}</b><span>กิจกรรม</span></div>
          <div className="stat"><b>{(t.stays || []).length}</b><span>ที่พัก</span></div>
          <div className="stat"><b>{money(tot.total, "")}</b><span>ค่าใช้จ่าย ({t.currency})</span></div>
          <div className="stat"><b>{money(perPerson(tot.total, t.travelers), "")}</b><span>ต่อคน</span></div>
          {t.checklist.length > 0 && <div className="stat"><b>{t.checklist.filter((c) => c.done).length}/{t.checklist.length}</b><span>เตรียมของแล้ว</span></div>}
        </div>
      </div>
      <div className="tabs">
        {TABS.map(([k, l]) => <button key={k} className={"tab " + (ui.tab === k ? "on" : "")} onClick={() => setUi({ tab: k })}>{l}</button>)}
      </div>
      {ui.tab === "plan" ? <PlanTab t={t} />
        : ui.tab === "map" ? <TripMap t={t} />
        : ui.tab === "stays" ? <StaysTab t={t} />
        : ui.tab === "budget" ? <BudgetTab t={t} />
        : ui.tab === "check" ? <CheckTab t={t} />
        : <NotesTab t={t} />}
      <Assistant t={t} />
    </>
  );
}

function CopyFallback({ text }: { text: string }) {
  const app = useApp();
  return (
    <>
      <h3>คัดลอกแผนเที่ยว</h3>
      <p className="hint">เลือกข้อความทั้งหมดแล้วคัดลอก</p>
      <textarea className="txt" rows={14} readOnly value={text} autoFocus onFocus={(e) => e.currentTarget.select()} />
      <div className="foot"><button className="btn primary" onClick={app.closeModal}>ปิด</button></div>
    </>
  );
}
