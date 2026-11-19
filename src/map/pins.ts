// หมุดสถานที่ของทริป และสถิติประเทศที่ไปแล้ว/วางแผนไว้
import { hasLL } from "../domain/geo";
import { stayVisited } from "../domain/trip";
import type { Item, Journal, Stay, Trip } from "../domain/types";
import { addDays, isUrl } from "../domain/util";
import { countryAt } from "./geo";

export type PinRef =
  | { kind: "item"; id: string; dayId: string; title: string; time: string; visited: boolean; ref: Item }
  | { kind: "stay"; id: string; title: string; time: ""; visited: boolean; ref: Stay };

export interface Pin {
  key: string; lat: number; lng: number; name: string; tripId: string; tripName: string;
  refs: PinRef[]; visited: boolean; stay: boolean; day: number; date: string;
}

/** รวมกิจกรรม/ที่พักที่มีพิกัดเป็นหมุด (ชื่อเดียวกันและพิกัดใกล้กันรวมเป็นหมุดเดียว) */
export function tripPins(t: Trip, dayFilter: number | null = null): Pin[] {
  const groups = new Map<string, Pin>();
  const add = (p: { lat: number; lng: number; name: string; day: number; date: string; ref: PinRef }) => {
    const key = t.id + "|" + p.name.toLowerCase() + "|" + p.lat.toFixed(3);
    let g = groups.get(key);
    if (!g) {
      g = { key, lat: p.lat, lng: p.lng, name: p.name, tripId: t.id, tripName: t.name, refs: [], visited: false, stay: false, day: p.day, date: p.date };
      groups.set(key, g);
    }
    g.refs.push(p.ref);
    if (p.ref.visited) g.visited = true;
    if (p.ref.kind === "stay") g.stay = true;
    if (p.day < g.day) { g.day = p.day; g.date = p.date; }
  };
  t.days.forEach((d, di) => {
    if (dayFilter != null && dayFilter !== di) return;
    d.items.forEach((it) => {
      if (!hasLL(it)) return;
      add({
        lat: it.lat, lng: it.lng, name: it.place && !isUrl(it.place) ? it.place : it.title, day: di, date: d.date,
        ref: { kind: "item", id: it.id, dayId: d.id, title: it.title, time: it.time, visited: !!it.done, ref: it },
      });
    });
  });
  (t.stays || []).forEach((s) => {
    if (!hasLL(s)) return;
    if (dayFilter != null && !(dayFilter >= s.startDay && dayFilter < s.startDay + s.nights)) return;
    add({
      lat: s.lat, lng: s.lng, name: s.name, day: s.startDay, date: t.start ? addDays(t.start, s.startDay) : "",
      ref: { kind: "stay", id: s.id, title: "ที่พัก " + s.nights + " คืน", time: "", visited: stayVisited(t, s), ref: s },
    });
  });
  return [...groups.values()];
}

export interface JournalStats {
  visited: Set<string>; planned: Set<string>; pinsBy: Record<string, Pin[]>; places: number; placesDone: number;
}

/** ประเทศที่ไปแล้ว = ติ๊กเอง หรือมีสถานที่ที่ "ไปแล้ว"; ประเทศที่วางแผนไว้ = มีหมุดแต่ยังไม่ได้ไป */
export function journalStats(trips: Trip[], journal: Journal): JournalStats {
  const visited = new Set(Object.keys(journal.countries || {}).filter((k) => journal.countries[k]));
  const planned = new Set<string>();
  const pinsBy: Record<string, Pin[]> = {};
  let places = 0, placesDone = 0;
  trips.forEach((t) => tripPins(t).forEach((p) => {
    const c = countryAt(p.lat, p.lng);
    if (!c) return;
    (pinsBy[c] = pinsBy[c] || []).push(p);
    places++;
    if (p.visited) { placesDone++; visited.add(c); } else planned.add(c);
  }));
  visited.forEach((c) => planned.delete(c));
  return { visited, planned, pinsBy, places, placesDone };
}

/** ติ๊ก/ล้าง "ไปแล้ว" ให้ทุกรายการในหมุด (ใช้ใน updateTrip) */
export function setPinRefs(d: Trip, refs: PinRef[], val: boolean) {
  refs.forEach((r) => {
    if (r.kind === "item") {
      const it = d.days.find((x) => x.id === r.dayId)?.items.find((x) => x.id === r.id);
      if (it) it.done = val;
    } else {
      const s = d.stays.find((x) => x.id === r.id);
      if (s) s.visited = val;
    }
  });
}
