import type { Trip } from "../../domain/types";
import { useApp } from "../../state";

export function NotesTab({ t }: { t: Trip }) {
  const app = useApp();
  return (
    <div className="card panel">
      <label className="f" style={{ marginTop: 0 }}>บันทึกของทริป เช่น เลขที่การจอง ที่อยู่โรงแรม เบอร์ติดต่อ</label>
      <textarea className="txt" rows={12} value={t.notes} placeholder="จดอะไรก็ได้ที่เกี่ยวกับทริปนี้"
        onChange={(e) => { const v = e.target.value; app.updateTrip(t.id, (d) => { d.notes = v; }); }} />
    </div>
  );
}
