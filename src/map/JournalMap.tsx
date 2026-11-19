import { useEffect, useMemo, useRef, useState } from "react";
import { geoGraticule10, geoMercator, geoNaturalEarth1, geoPath } from "d3-geo";
import type { Selection } from "d3-selection";
import { Ic } from "../components/Icon";
import { fmtDate } from "../domain/util";
import { useApp } from "../state";
import { CHECK_D, newSvg, pinLayer, setupZoom } from "./draw";
import { countryName, geoReady, loadGeo, type CFeature } from "./geo";
import { journalStats, setPinRefs, type Pin } from "./pins";
import { PinInfo } from "./PinInfo";

/** แผนที่การเดินทาง: แผนที่โลก (ประเทศที่ไปแล้ว/วางแผนไว้) → กดเข้าไปเป็นแผนที่ประเทศพร้อมหมุด */
export function JournalMap() {
  const app = useApp();
  const { ui, setUi } = app;
  const box = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(!!geoReady());
  const [failed, setFailed] = useState(false);
  const [selKey, setSelKey] = useState<string | null>(null);

  useEffect(() => {
    if (ready) return;
    loadGeo().then(() => setReady(true), () => setFailed(true));
  }, [ready]);

  const trips = useMemo(() => Object.values(app.trips), [app.trips]);
  const st = useMemo(() => (ready ? journalStats(trips, app.journal) : null), [ready, trips, app.journal]);
  const geo = geoReady();
  const country = ui.country && geo?.byId[ui.country] ? ui.country : null;
  const pins: Pin[] = country && st ? st.pinsBy[country] || [] : [];
  const selPin = pins.find((p) => p.key === selKey) || null;

  const openCountry = (id: string | null) => { setSelKey(null); setUi({ country: id }); };

  useEffect(() => {
    if (!st || !geo || !box.current) return;
    if (!country) drawWorld(box.current, st, geo.fc.features, (id) => openCountry(id), app.zoomT.current);
    else drawCountry(box.current, geo.byId[country], geo.fc.features, st.visited.has(country), pins, (id) => openCountry(id), (p) => setSelKey(p.key), app.zoomT.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st, geo, country]);

  if (failed) return <div className="card mapcard"><div className="maploading">โหลดแผนที่ไม่ได้ ลองรีเฟรชหน้าอีกครั้ง</div></div>;

  const manual = !!(country && app.journal.countries[country]);
  const v = !!(country && st?.visited.has(country));

  return (
    <>
      {st && (
        <div className="stats" style={{ margin: "0 0 4px" }}>
          <div className="stat"><b>{st.visited.size}</b><span>ประเทศที่ไปแล้ว</span></div>
          <div className="stat"><b>{st.placesDone}</b><span>สถานที่ที่ไปแล้ว</span></div>
          <div className="stat"><b>{st.planned.size}</b><span>ประเทศที่วางแผนไว้</span></div>
          <div className="stat"><b>{st.places - st.placesDone}</b><span>สถานที่ที่ยังไม่ได้ไป</span></div>
        </div>
      )}
      <div className="jhead">
        {!country ? (
          <>
            <h3 className="section-title" style={{ margin: 0 }}>แผนที่โลก</h3>
            <span className="hint" style={{ margin: 0 }}>กดที่ประเทศเพื่อดูหมุดสถานที่ หรือทำเครื่องหมายว่าเคยไปแล้ว</span>
          </>
        ) : (
          <>
            <button className="btn sm" onClick={() => openCountry(null)}><Ic n="back" /> แผนที่โลก</button>
            <h3 className="section-title" style={{ margin: 0 }}>{v && <><span className="okbadge">✓</span> </>}{countryName(country)}</h3>
            <span className="spacer" />
            <label className="check" style={{ border: "none", padding: 0, gap: 6, fontSize: 14 }}>
              <input type="checkbox" className="cb" checked={manual} onChange={(e) => {
                const on = e.target.checked;
                app.updateJournal((j) => { if (on) j.countries[country] = true; else delete j.countries[country]; });
              }} />
              <span>เคยไปประเทศนี้แล้ว</span>
            </label>
          </>
        )}
      </div>
      <div className="card mapcard">
        <div ref={box} className="mapbox">{!st && <div className="maploading"><span className="spin" /> กำลังโหลดแผนที่…</div>}</div>
      </div>
      <div>
        {selPin ? <PinInfo pin={selPin} /> : country && pins.length > 0 && (
          <p className="hint" style={{ margin: "8px 0 0" }}>กดที่หมุดเพื่อดูรายละเอียด · ✓ สีทอง = ไปแล้ว · จุดเล็ก = ยังไม่ได้ไป</p>
        )}
      </div>
      <div style={{ marginTop: 14 }}>
        {st && !country && <CountryList ids={[...st.visited, ...st.planned]} st={st} onOpen={(id) => { openCountry(id); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}
        {st && country && (pins.length ? <PlacesByTrip pins={pins} /> : (
          <div className="card empty">{manual ? "ทำเครื่องหมายว่าเคยไปแล้ว — " : ""}ยังไม่มีหมุดสถานที่ในประเทศนี้</div>
        ))}
      </div>
    </>
  );
}

function CountryList({ ids, st, onOpen }: { ids: string[]; st: ReturnType<typeof journalStats>; onOpen: (id: string) => void }) {
  if (!ids.length) return <div className="card empty">ยังไม่มีสถานที่บนแผนที่ เพิ่มพิกัดให้กิจกรรมในทริป (แท็บ "แผนที่" ของทริป) หรือกดที่ประเทศเพื่อทำเครื่องหมายว่าเคยไปแล้ว</div>;
  return (
    <div className="clist">
      {ids.map((id) => {
        const pins = st.pinsBy[id] || [];
        const done = pins.filter((p) => p.visited).length;
        const v = st.visited.has(id);
        return (
          <button key={id} className={"cchip " + (v ? "v" : "")} onClick={() => onOpen(id)}>
            <span className="cmark">{v ? "✓" : "○"}</span>
            <span><b>{countryName(id)}</b><small>{pins.length ? `ไปแล้ว ${done}/${pins.length} แห่ง` : "เคยไปแล้ว"}</small></span>
          </button>
        );
      })}
    </div>
  );
}

function PlacesByTrip({ pins }: { pins: Pin[] }) {
  const app = useApp();
  const byTrip = new Map<string, Pin[]>();
  pins.forEach((p) => { if (!byTrip.has(p.tripId)) byTrip.set(p.tripId, []); byTrip.get(p.tripId)!.push(p); });
  return (
    <>
      {[...byTrip.values()].map((list) => {
        list.sort((a, b) => a.day - b.day);
        const tid = list[0].tripId;
        return (
          <div key={tid} className="card panel" style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ fontSize: 19, flex: 1 }}>{list[0].tripName}</h3>
              <span className="meta" style={{ color: "var(--muted)", fontSize: 13 }}>ไปแล้ว {list.filter((p) => p.visited).length}/{list.length} แห่ง</span>
              <button className="btn sm" onClick={() => { app.setUi({ tab: "map", mapDay: null }); app.go("trip", tid); }}>เปิดทริป</button>
            </div>
            <div className="plist">
              {list.map((p) => (
                <label key={p.key} className={"pl " + (p.visited ? "v" : "")}>
                  <input type="checkbox" className="cb" checked={p.visited}
                    onChange={(e) => { const val = e.target.checked; app.updateTrip(p.tripId, (d) => setPinRefs(d, p.refs, val)); }} />
                  <span className="pl-n">{p.name}</span>
                  <span className="pl-d">{p.date ? fmtDate(p.date, false) : "วันที่ " + (p.day + 1)}</span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

type G = Selection<SVGGElement, unknown, null, undefined>;

function drawWorld(box: HTMLElement, st: ReturnType<typeof journalStats>, features: CFeature[], open: (id: string) => void, memory: Record<string, any>) {
  const W = 960, H = 500;
  const svg = newSvg(box, W, H);
  const proj = geoNaturalEarth1().fitExtent([[6, 6], [W - 6, H - 6]], { type: "Sphere" } as any);
  const path = geoPath(proj);
  const inner: G = svg.append("g");
  inner.append("path").datum({ type: "Sphere" } as any).attr("class", "sphere").attr("d", path as any);
  inner.append("path").datum(geoGraticule10()).attr("class", "grat").attr("d", path as any);
  inner.selectAll<SVGPathElement, CFeature>("path.c").data(features).join("path")
    .attr("class", (f) => "c" + (st.visited.has(f.id) ? " v" : st.planned.has(f.id) ? " p" : ""))
    .attr("d", path as any)
    .on("click", (_e, f) => open(f.id))
    .append("title").text((f) => countryName(f.id));
  const vis = features.filter((f) => st.visited.has(f.id));
  const badges = inner.selectAll<SVGGElement, CFeature>("g.badge").data(vis).join("g").attr("class", "badge").style("cursor", "pointer").on("click", (_e, f) => open(f.id));
  badges.append("circle").attr("r", 8.5);
  badges.append("path").attr("d", CHECK_D);
  const place = (k: number) => badges.attr("transform", (f) => { const [x, y] = proj(f._c)!; return `translate(${x},${y}) scale(${1 / Math.sqrt(k)})`; });
  setupZoom(svg, inner, "world", memory, place, 12);
}

function drawCountry(box: HTMLElement, f: CFeature, features: CFeature[], v: boolean, pins: Pin[], open: (id: string) => void, onPin: (p: Pin) => void, memory: Record<string, any>) {
  const W = 960, H = 620;
  const svg = newSvg(box, W, H);
  const target = { type: "FeatureCollection", features: [f._main].concat(pins.length ? [{ type: "Feature", properties: {}, geometry: { type: "MultiPoint", coordinates: pins.map((p) => [p.lng, p.lat]) } } as any] : []) };
  const proj = geoMercator().fitExtent([[30, 30], [W - 30, H - 30]], target as any);
  const path = geoPath(proj);
  const inner: G = svg.append("g");
  inner.append("rect").attr("class", "sea").attr("x", -W * 20).attr("y", -H * 20).attr("width", W * 41).attr("height", H * 41);
  inner.selectAll<SVGPathElement, CFeature>("path.c").data(features).join("path")
    .attr("class", (x) => "c " + (x.id === f.id ? (v ? "sel v" : "sel") : "dim"))
    .attr("d", path as any)
    .on("click", (_e, x) => { if (x.id !== f.id) open(x.id); })
    .append("title").text((x) => countryName(x.id));
  const sel = pinLayer(inner, pins, proj, onPin);
  setupZoom(svg, inner, "c-" + f.id, memory, (k) => sel.attr("transform", (d) => { const [x, y] = proj([d.lng, d.lat])!; return `translate(${x},${y}) scale(${1 / k})`; }), 60);
}
