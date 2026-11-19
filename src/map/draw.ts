// ฟังก์ชันวาดแผนที่ด้วย d3 (ย้ายจากต้นแบบ)
import { select, type Selection } from "d3-selection";
import { zoom, zoomIdentity, type ZoomTransform } from "d3-zoom";
import type { GeoProjection } from "d3-geo";
import type { Pin } from "./pins";

export const CHECK_D = "M-3.6,0.2 L-1,2.8 L3.8,-2.4";

export function newSvg(box: HTMLElement, W: number, H: number) {
  box.innerHTML = "";
  return select(box).append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("class", "map");
}

export function pinLayer(g: Selection<SVGGElement, unknown, null, undefined>, pins: Pin[], proj: GeoProjection, onClick: (p: Pin) => void) {
  const sel = g.selectAll<SVGGElement, Pin>("g.pin").data(pins, (d) => d.key).join("g")
    .attr("class", (d) => "pin" + (d.visited ? " v" : "") + (d.stay ? " s" : ""))
    .attr("transform", (d) => { const [x, y] = proj([d.lng, d.lat])!; return `translate(${x},${y})`; })
    .style("cursor", "pointer")
    .on("click", (e: MouseEvent, d) => { e.stopPropagation(); onClick(d); });
  sel.selectAll("*").remove();
  sel.append("circle").attr("class", "halo").attr("r", (d) => (d.visited ? 9 : 6));
  sel.append("circle").attr("class", "dot").attr("r", (d) => (d.visited ? 7 : 4.5));
  sel.filter((d) => d.visited).append("path").attr("class", "tick").attr("d", CHECK_D);
  sel.append("title").text((d) => d.name + (d.visited ? " ✓ ไปแล้ว" : ""));
  return sel;
}

/** ซูม/เลื่อนแผนที่ จำตำแหน่งไว้ใน store ตาม key */
export function setupZoom(
  svg: Selection<SVGSVGElement, unknown, null, undefined>,
  inner: Selection<SVGGElement, unknown, null, undefined>,
  key: string,
  memory: Record<string, ZoomTransform>,
  onZoom: (k: number) => void,
  maxK = 40,
) {
  const z = zoom<SVGSVGElement, unknown>().scaleExtent([1, maxK]).on("zoom", (e) => {
    inner.attr("transform", e.transform.toString());
    memory[key] = e.transform;
    onZoom(e.transform.k);
  });
  svg.call(z).on("dblclick.zoom", null);
  if (memory[key]) svg.call(z.transform, memory[key]);
  else { onZoom(1); svg.call(z.transform, zoomIdentity); }
  return z;
}
