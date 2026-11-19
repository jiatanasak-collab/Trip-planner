import { Ic } from "../../components/Icon";
import { downloadJson } from "../../components/common";
import { makeBackup } from "../../domain/backup";
import { newTrip, tripTotals } from "../../domain/trip";
import { fmtDate, money, toISO } from "../../domain/util";
import { useApp } from "../../state";
import { TripForm } from "../forms/TripForm";
import { ImportModal } from "../import/ImportModal";
import { ImportJsonModal } from "../import/ImportJsonModal";
import { JournalMap } from "../../map/JournalMap";

export function Home() {
  const app = useApp();
  const { ui, setUi, trips, openModal, go } = app;
  const list = Object.values(trips).sort((a, b) => (a.start || "9999").localeCompare(b.start || "9999") || b.updated - a.updated);
  const today = toISO(new Date());

  const nav = (
    <div className="homenav">
      <button className={ui.homeTab === "trips" ? "on" : ""} onClick={() => setUi({ homeTab: "trips" })}>ทริปของฉัน</button>
      <button className={ui.homeTab === "map" ? "on" : ""} onClick={() => setUi({ homeTab: "map" })}>
        <Ic n="map" size={15} style={{ verticalAlign: -2 }} /> แผนที่การเดินทาง
      </button>
    </div>
  );

  if (ui.homeTab === "map") return <>{nav}<JournalMap /></>;

  const backupAll = async () => {
    if (await downloadJson(`trip-planner-backup-${today}.json`, makeBackup(list, app.journal))) app.toast("ดาวน์โหลดไฟล์สำรองแล้ว");
  };

  return (
    <>
      {nav}
      <div className="hero">
        <div className="card" onClick={() => openModal(<TripForm trip={newTrip()} isNew />)}>
          <div className="badge" style={{ background: "var(--teal-2)", color: "var(--gold)" }}><Ic n="plus" size={22} /></div>
          <h2>สร้างทริปใหม่</h2>
          <p>ใส่ชื่อทริป ปลายทาง และวันที่ แล้วเพิ่มกิจกรรมทีละวัน</p>
        </div>
        <div className="card" onClick={() => openModal(<ImportModal />, true)}>
          <div className="badge" style={{ background: "var(--coral-2)", color: "var(--coral)" }}><Ic n="import" size={22} /></div>
          <h2>นำแผนเที่ยวที่มีอยู่เข้ามา</h2>
          <p>วางข้อความแผนเที่ยว หรือแนบรูปภาพ/ไฟล์ แล้วระบบจะจัดเป็นตารางรายวันให้</p>
        </div>
      </div>
      <div className="list-head">
        <h3 className="section-title" style={{ margin: 0 }}>
          <Ic n="cal" /> ทริปของฉัน <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 14 }}>({list.length})</span>
        </h3>
        <span className="spacer" />
        <button className="btn sm ghost" onClick={() => openModal(<ImportJsonModal />)}><Ic n="import" /> นำเข้าไฟล์ JSON</button>
        {list.length > 0 && <button className="btn sm ghost" onClick={backupAll}><Ic n="export" /> สำรองข้อมูลทั้งหมด</button>}
      </div>
      {list.length ? (
        <div className="trips">
          {list.map((t) => {
            const tot = tripTotals(t);
            const past = t.end && t.end < today;
            const now = t.start && t.start <= today && (t.end || t.start) >= today;
            return (
              <div key={t.id} className="card trip-card" onClick={() => { setUi({ tab: "plan", mapDay: null }); go("trip", t.id); }}>
                <div className="stripe" style={{ background: now ? "var(--coral)" : past ? "var(--muted)" : "var(--teal)" }} />
                <h3>{t.name}{t.shared && <span className="chip shared-chip">แชร์</span>}</h3>
                <div className="meta">{t.destination || "ยังไม่ระบุปลายทาง"}</div>
                <div className="meta">
                  {t.start ? fmtDate(t.start, false) + (t.end && t.end !== t.start ? " – " + fmtDate(t.end, false) : "") : "ยังไม่กำหนดวัน"}
                  {now && <> · <b style={{ color: "var(--coral)" }}>กำลังเที่ยว</b></>}
                </div>
                <div className="count">
                  <span>{t.days.length} วัน</span>
                  <span>{tot.items} กิจกรรม</span>
                  {tot.total ? <span>{money(tot.total, t.currency)}</span> : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card empty">ยังไม่มีทริป เริ่มจากสร้างทริปใหม่ หรือนำแผนเที่ยวที่มีอยู่เข้ามาก็ได้</div>
      )}
    </>
  );
}
