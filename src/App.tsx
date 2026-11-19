import { Home } from "./features/home/Home";
import { TripView } from "./features/trip/TripView";
import { useApp } from "./state";

export function App() {
  const { ui, trips, loaded, store, ai } = useApp();
  const trip = ui.view === "trip" && ui.tripId ? trips[ui.tripId] : undefined;
  return (
    <div className="wrap">
      <header className="top">
        <div className="logo">
          <svg className="icon" style={{ width: 22, height: 22 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
          </svg>
        </div>
        <div>
          <h1>สมุดแผนเที่ยว</h1>
          <div className="sub">จัดแผนเที่ยวรายวัน งบประมาณ และของที่ต้องเตรียม</div>
        </div>
        <div className="spacer" />
        <div className="sync" title={ai ? "AI พร้อมใช้งาน" : "ยังไม่ได้ตั้งค่า AI — ปุ่ม AI ถูกซ่อนไว้"}>
          <span className={"dot " + (loaded ? "ok" : "")} />
          <span>{loaded ? store.label : "กำลังโหลด…"}</span>
        </div>
      </header>
      <main>{!loaded ? null : trip ? <TripView trip={trip} /> : <Home />}</main>
    </div>
  );
}
