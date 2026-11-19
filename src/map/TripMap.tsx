import { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { Selection } from "d3-selection";
import { aiErrorText, aiGeocode } from "../ai/client";
import { Ic } from "../components/Icon";
import { Spin } from "../components/common";
import { hasLL } from "../domain/geo";
import { countMissing } from "../domain/trip";
import type { Trip } from "../domain/types";
import { fmtDate } from "../domain/util";
import { useApp } from "../state";
import { newSvg, pinLayer, setupZoom } from "./draw";
import { countryName, geoReady, loadGeo, type CFeature } from "./geo";
import { tripPins, type Pin } from "./pins";
import { PinInfo } from "./PinInfo";

/** แท็บ "แผนที่" ของทริป: หมุดทุกสถานที่ เส้นทางรายวัน ซูมได้ และปุ่มหาพิกัดที่ขาด */
export function TripMap({ t }: { t: Trip }) {
  const app = useApp();
  const { ui, setUi } = app;
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(!!geoReady());
  const [failed, setFailed] = useState(false);
  const [selKey, setSelKey] = useState<string | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const day = ui.mapDay != null && ui.mapDay < t.days.length ? ui.mapDay : null;
  const missing = countMissing(t);

  useEffect(() => {
    if (ready) return;
    loadGeo().then(() => setReady(true), () => setFailed(true));
  }, [ready]);

  const pins = useMemo(() => tripPins(t, day), [t, day]);
  const selPin = pins.find((p) => p.key === selKey) || null;

  useEffect(() => {
    const geo = geoReady();
    if (!ready || !geo || !box.current || !pins.length) return;
    drawTripMap(box.current, t, day, pins, geo.fc.features, (p) => setSelKey(p.key), app.zoomT.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, pins]);

  const markAll = (v: boolean) => app.updateTrip(t.id, (d) => {
    d.days.forEach((x, i) => { if (day == null || day === i) x.items.forEach((it) => (it.done = v)); });
    d.stays.forEach((s) => { if (day == null || (day >= s.startDay && day < s.startDay + s.nights)) s.visited = v; });
  });

  const findCoords = async () => {
    setGeoBusy(true);
    try {
      const copy: Trip = JSON.parse(JSON.stringify(t));
      const n = await aiGeocode(copy);
      if (n) {
        // เติมเฉพาะที่ยังไม่มีพิกัด กันทับพิกัดที่ผู้ใช้ใส่ระหว่างรอ
        const ll = new Map<string, { lat: number; lng: number }>();
        copy.days.forEach((d) => d.items.forEach((it) => { if (hasLL(it)) ll.set(it.id, { lat: it.lat, lng: it.lng }); }));
        copy.stays.forEach((s) => { if (hasLL(s)) ll.set(s.id, { lat: s.lat, lng: s.lng }); });
        app.updateTrip(t.id, (d) => {
          [...d.days.flatMap((x) => x.items), ...d.stays].forEach((o) => { const v = ll.get(o.id); if (v && !hasLL(o)) { o.lat = v.lat; o.lng = v.lng; } });
        });
      }
      app.toast(n ? `ได้พิกัด ${n} แห่ง (ตำแหน่งโดยประมาณ)` : "หาพิกัดไม่ได้ ลองใส่ชื่อสถานที่ให้ชัดขึ้น");
    } catch (e) {
      app.toast(aiErrorText(e, "หาพิกัดไม่สำเร็จ ลองอีกครั้ง"));
    }
    setGeoBusy(false);
  };

  let msg = "";
  if (failed) msg = "โหลดแผนที่ไม่ได้ ลองรีเฟรชหน้าอีกครั้ง";
  else if (ready && !pins.length) msg = missing ? (app.ai ? 'ยังไม่มีพิกัดสถานที่ — กด "หาพิกัดที่ขาด" หรือใส่พิกัดในกิจกรรม' : "ยังไม่มีพิกัดสถานที่ — ใส่พิกัดหรือวางลิงก์ Google Maps ในกิจกรรม") : "ยังไม่มีสถานที่ในวันนี้";

  return (
    <>
      <div className="card panel" style={{ padding: "14px 16px", marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select className="txt" style={{ width: "auto", maxWidth: "100%" }} value={day ?? ""} onChange={(e) => { setSelKey(null); setUi({ mapDay: e.target.value === "" ? null : +e.target.value }); }}>
          <option value="">ทุกวัน</option>
          {t.days.map((d, i) => <option key={d.id} value={i}>วันที่ {i + 1}{d.date ? " · " + fmtDate(d.date, false) : ""}{d.title ? " · " + d.title : ""}</option>)}
        </select>
        <span className="spacer" />
        <button className="btn sm" onClick={() => markAll(true)}>✓ ติ๊กว่าไปแล้ว{day != null ? "ทั้งวัน" : "ทั้งทริป"}</button>
        <button className="btn sm ghost" onClick={() => markAll(false)}>ล้างเครื่องหมาย</button>
        {missing > 0 && app.ai && (
          <button className="btn sm coral" disabled={geoBusy} onClick={findCoords}>
            {geoBusy ? <><Spin /> กำลังหาพิกัด…</> : <><Ic n="spark" /> หาพิกัดที่ขาด {missing} แห่ง</>}
          </button>
        )}
      </div>
      <div className="card mapcard">
        <div ref={box} className="mapbox" key={msg ? "msg" : "map"}>
          {msg ? <div className="maploading">{msg}</div> : !ready && <div className="maploading"><span className="spin" /> กำลังโหลดแผนที่…</div>}
        </div>
      </div>
      <div>{selPin && <PinInfo pin={selPin} />}</div>
      <p className="hint" style={{ marginTop: 8 }}>เส้นประคือเส้นทางตามลำดับกิจกรรมในแต่ละวัน · ติ๊ก "ไปแล้ว" ที่กิจกรรมในแผนรายวันหรือที่หมุด แล้วประเทศจะขึ้น ✓ ในแผนที่การเดินทาง</p>
    </>
  );
}

function drawTripMap(box: HTMLElement, t: Trip, day: number | null, pins: Pin[], features: CFeature[], onPin: (p: Pin) => void, memory: Record<string, any>) {
  const W = 960, H = 600;
  const svg = newSvg(box, W, H);
  let pts = pins.map((p) => [p.lng, p.lat]);
  const lats = pts.map((p) => p[1]), lngs = pts.map((p) => p[0]);
  const span = Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
  if (span < 0.02) {
    // หมุดอยู่ใกล้กันมาก ขยายกรอบให้เห็นบริบทรอบๆ
    const cx = lngs.reduce((a, b) => a + b, 0) / lngs.length, cy = lats.reduce((a, b) => a + b, 0) / lats.length;
    pts = pts.concat([[cx - 0.02, cy - 0.02], [cx + 0.02, cy + 0.02]]);
  }
  const proj = geoMercator().fitExtent([[50, 50], [W - 50, H - 50]], { type: "MultiPoint", coordinates: pts } as any);
  const path = geoPath(proj);
  const inner: Selection<SVGGElement, unknown, null, undefined> = svg.append("g");
  inner.append("rect").attr("class", "sea").attr("x", -W * 20).attr("y", -H * 20).attr("width", W * 41).attr("height", H * 41);
  inner.selectAll<SVGPathElement, CFeature>("path.c").data(features).join("path").attr("class", "c land").attr("d", path as any)
    .append("title").text((x) => countryName(x.id));
  const routes: number[][][] = [];
  t.days.forEach((d, di) => {
    if (day != null && day !== di) return;
    const seq = d.items.filter(hasLL).map((it) => [it.lng!, it.lat!]);
    if (seq.length > 1) routes.push(seq);
  });
  const routeSel = inner.selectAll("path.route").data(routes).join("path").attr("class", "route").attr("d", (r) => path({ type: "LineString", coordinates: r } as any));
  const sel = pinLayer(inner, pins, proj, onPin);
  setupZoom(svg, inner, "t-" + t.id + "-" + (day == null ? "a" : day), memory, (k) => {
    sel.attr("transform", (d) => { const [x, y] = proj([d.lng, d.lat])!; return `translate(${x},${y}) scale(${1 / k})`; });
    routeSel.style("stroke-width", 1.6 / k + "px").style("stroke-dasharray", `${4 / k} ${4 / k}`);
  }, 80);
}
