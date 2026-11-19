// ข้อมูลแผนที่โลกจาก npm package world-atlas (countries-50m) และฟังก์ชันหาประเทศจากพิกัด
import { geoArea, geoCentroid, geoContains } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, Geometry, Polygon } from "geojson";
import { NUM2A2 } from "./iso";

export type CFeature = Feature<Geometry, { name: string }> & { id: string; _main: Feature; _c: [number, number] };
export interface GeoData { fc: { type: "FeatureCollection"; features: CFeature[] }; byId: Record<string, CFeature> }

let GEO: GeoData | null = null;
let geoP: Promise<GeoData> | null = null;

export const geoReady = () => GEO;

export function loadGeo(): Promise<GeoData> {
  if (geoP) return geoP;
  geoP = (async () => {
    // ตอน build เป็นหน้า artifact ข้อมูลแผนที่อยู่เป็นไฟล์ข้างหน้าเว็บ (VITE_GEO_URL) ไม่รวมใน bundle
    const url = import.meta.env.VITE_GEO_URL as string | undefined;
    const topo: any = url
      ? await fetch(url).then((r) => { if (!r.ok) throw new Error("data"); return r.json(); })
      : (await import("world-atlas/countries-50m.json")).default;
    const fc = feature(topo, topo.objects.countries) as unknown as GeoData["fc"];
    fc.features = fc.features.filter((f) => f.id !== "010"); // ตัดแอนตาร์กติกา
    fc.features.forEach((f, i) => { if (!f.id) f.id = "x" + i; });
    const byId: Record<string, CFeature> = {};
    fc.features.forEach((f) => { byId[f.id] = f; f._main = mainPart(f); f._c = geoCentroid(f._main as any) as [number, number]; });
    GEO = { fc, byId };
    return GEO;
  })();
  geoP.catch(() => { geoP = null; });
  return geoP;
}

/** ส่วนที่ใหญ่ที่สุดของประเทศ (ใช้วางเครื่องหมาย ✓ และจัดกรอบแผนที่ประเทศ) */
function mainPart(f: CFeature): Feature {
  const g = f.geometry;
  if (!g || g.type !== "MultiPolygon") return f;
  let best: Polygon | null = null, ba = -1;
  g.coordinates.forEach((c) => {
    const p: Polygon = { type: "Polygon", coordinates: c };
    const a = geoArea(p as any);
    if (a > ba) { ba = a; best = p; }
  });
  return { type: "Feature", id: f.id, properties: f.properties, geometry: best! };
}

let thNames: Intl.DisplayNames | null = null;
try { thNames = new Intl.DisplayNames(["th"], { type: "region" }); } catch { /* ไม่รองรับ */ }

export function countryName(id: string): string {
  const f = GEO?.byId[id];
  const a2 = NUM2A2[id];
  try { if (a2 && thNames) { const n = thNames.of(a2); if (n && n !== a2) return n; } } catch { /* ignore */ }
  return f ? f.properties.name : "ไม่ทราบประเทศ";
}

const ctryCache = new Map<string, string | null>();
/** หาว่าพิกัดอยู่ในประเทศไหน ถ้าไม่โดนเลย (เช่นจุดชายฝั่ง) จะลองขยับรอบๆ ทีละนิด */
export function countryAt(lat: number, lng: number): string | null {
  if (!GEO) return null;
  const k = lat.toFixed(3) + "," + lng.toFixed(3);
  if (ctryCache.has(k)) return ctryCache.get(k)!;
  const test = (la: number, ln: number) => {
    for (const f of GEO!.fc.features) if (geoContains(f as any, [ln, la])) return f.id;
    return null;
  };
  let id = test(lat, lng);
  if (!id) {
    outer: for (const r of [0.05, 0.15, 0.35]) {
      for (let a = 0; a < 8; a++) {
        const t = (a * Math.PI) / 4;
        id = test(lat + r * Math.sin(t), lng + r * Math.cos(t));
        if (id) break outer;
      }
    }
  }
  ctryCache.set(k, id);
  return id;
}
