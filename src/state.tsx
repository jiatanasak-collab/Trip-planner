import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ZoomTransform } from "d3-zoom";
import { aiAvailable } from "./ai/client";
import type { Journal, Trip } from "./domain/types";
import type { TripStore } from "./store/TripStore";

export type TabKey = "plan" | "map" | "stays" | "budget" | "check" | "notes";
export type HomeTab = "trips" | "map";

interface UiState {
  view: "home" | "trip";
  tripId: string | null;
  tab: TabKey;
  homeTab: HomeTab;
  country: string | null;
  mapDay: number | null;
}

interface AppCtx {
  store: TripStore;
  loaded: boolean;
  trips: Record<string, Trip>;
  journal: Journal;
  ai: boolean;
  ui: UiState;
  setUi: (p: Partial<UiState>) => void;
  go: (view: "home" | "trip", tripId?: string | null) => void;
  /** แก้ทริปแบบ clone → แก้ → บันทึก (ตั้งเวลา updated ให้) */
  updateTrip: (id: string, fn: (draft: Trip) => void) => void;
  saveTrip: (trip: Trip) => void;
  /** ทริปเวอร์ชันล่าสุด (รวมการแก้ที่ยังไม่ได้ render) */
  getTrip: (id: string) => Trip | undefined;
  removeTrip: (id: string) => void;
  updateJournal: (fn: (draft: Journal) => void) => void;
  /** ตำแหน่งซูมของแต่ละแผนที่ จำไว้ระหว่างเปลี่ยนหน้า */
  zoomT: React.MutableRefObject<Record<string, ZoomTransform>>;
  toast: (msg: string) => void;
  openModal: (node: ReactNode, wide?: boolean) => void;
  closeModal: () => void;
  confirm: (msg: string, okLabel: string, fn: () => void) => void;
}

const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function readHash(): Pick<UiState, "view" | "tripId"> {
  const h = (location.hash || "").replace("#", "");
  return h.startsWith("trip-") ? { view: "trip", tripId: h.slice(5) } : { view: "home", tripId: null };
}

export function AppProvider({ store, children }: { store: TripStore; children: ReactNode }) {
  const [loaded, setLoaded] = useState(false);
  const [trips, setTrips] = useState<Record<string, Trip>>({});
  const [journal, setJournal] = useState<Journal>({ countries: {} });
  const [ai, setAi] = useState(false);
  const [ui, setUiState] = useState<UiState>({ ...readHash(), tab: "plan", homeTab: "trips", country: null, mapDay: null });
  const [modal, setModal] = useState<{ node: ReactNode; wide?: boolean } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; msg: string }[]>([]);
  const zoomT = useRef<Record<string, ZoomTransform>>({});
  const tripsRef = useRef(trips);
  tripsRef.current = trips;
  const journalRef = useRef(journal);
  journalRef.current = journal;

  useEffect(() => {
    Promise.all([store.listTrips(), store.getJournal()]).then(([list, j]) => {
      const map: Record<string, Trip> = {};
      list.forEach((t) => (map[t.id] = t));
      setTrips(map);
      setJournal(j);
      setLoaded(true);
    });
    aiAvailable().then(setAi);
  }, [store]);

  // ทริปที่แชร์: อีกคนแก้แล้วอัปเดตที่นี่ด้วย (เฉพาะหน้า artifact)
  useEffect(() => {
    if (!loaded || !store.subscribeShared) return;
    return store.subscribeShared((serverTrips) => {
      const cur = tripsRef.current;
      const next = { ...cur };
      let changed = false;
      const ids = new Set(serverTrips.map((t) => t.id));
      for (const t of serverTrips) {
        const mine = cur[t.id];
        if (!mine || (t.updated > mine.updated)) { next[t.id] = t; changed = true; }
      }
      // ทริปที่แชร์ซึ่งอีกคนลบหรือเลิกแชร์ (ไม่นับที่เพิ่งแก้ในเครื่องนี้และยังเขียนไม่เสร็จ)
      for (const t of Object.values(cur)) {
        if (t.shared && !ids.has(t.id) && Date.now() - t.updated > 5000) { delete next[t.id]; changed = true; }
      }
      if (changed) { tripsRef.current = next; setTrips(next); }
    });
  }, [loaded, store]);

  useEffect(() => {
    const on = () => setUiState((u) => ({ ...u, ...readHash() }));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const toast = useCallback((msg: string) => {
    const id = Math.random();
    setToasts((l) => [...l, { id, msg }]);
    setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 2600);
  }, []);

  const persistFail = useCallback(() => toast("บันทึกไม่สำเร็จ พื้นที่ในเบราว์เซอร์อาจเต็ม"), [toast]);

  const saveTrip = useCallback((trip: Trip) => {
    const t = clone(trip);
    t.updated = Date.now();
    tripsRef.current = { ...tripsRef.current, [t.id]: t };
    setTrips(tripsRef.current);
    store.putTrip(t).catch(persistFail);
  }, [store, persistFail]);

  const updateTrip = useCallback((id: string, fn: (d: Trip) => void) => {
    const cur = tripsRef.current[id];
    if (!cur) return;
    const d = clone(cur);
    fn(d);
    d.updated = Date.now();
    tripsRef.current = { ...tripsRef.current, [id]: d };
    setTrips(tripsRef.current);
    store.putTrip(d).catch(persistFail);
  }, [store, persistFail]);

  const removeTrip = useCallback((id: string) => {
    setTrips((m) => { const n = { ...m }; delete n[id]; return n; });
    store.deleteTrip(id).catch(persistFail);
  }, [store, persistFail]);

  const updateJournal = useCallback((fn: (d: Journal) => void) => {
    const d = clone(journalRef.current);
    fn(d);
    journalRef.current = d;
    setJournal(d);
    store.putJournal(d).catch(persistFail);
  }, [store, persistFail]);

  const getTrip = useCallback((id: string) => tripsRef.current[id], []);

  const setUi = useCallback((p: Partial<UiState>) => setUiState((u) => ({ ...u, ...p })), []);

  const go = useCallback((view: "home" | "trip", tripId?: string | null) => {
    setUiState((u) => ({ ...u, view, ...(tripId !== undefined ? { tripId } : {}) }));
    const id = tripId !== undefined ? tripId : null;
    // ใช้ hash แบบ #trip-<id> อย่างเดียว (ใช้ได้ทั้งเว็บปกติและหน้า artifact)
    const h = view === "trip" && id ? "#trip-" + id : "";
    if (location.hash !== h) location.hash = h;
    window.scrollTo(0, 0);
  }, []);

  const closeModal = useCallback(() => setModal(null), []);
  const openModal = useCallback((node: ReactNode, wide?: boolean) => setModal({ node, wide }), []);
  const confirm = useCallback((msg: string, okLabel: string, fn: () => void) => {
    setModal({
      node: (
        <>
          <h3>{msg}</h3>
          <div className="foot">
            <button className="btn" onClick={() => setModal(null)}>ยกเลิก</button>
            <button className="btn coral" autoFocus onClick={() => { setModal(null); fn(); }}>{okLabel || "ยืนยัน"}</button>
          </div>
        </>
      ),
    });
  }, []);

  useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setModal(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal]);

  const value = useMemo<AppCtx>(() => ({
    store, loaded, trips, journal, ai, ui, setUi, go, updateTrip, saveTrip, getTrip, removeTrip, updateJournal, zoomT, toast, openModal, closeModal, confirm,
  }), [store, loaded, trips, journal, ai, ui, setUi, go, updateTrip, saveTrip, getTrip, removeTrip, updateJournal, toast, openModal, closeModal, confirm]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {modal && (
        <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className={"card modal" + (modal.wide ? " wide" : "")} role="dialog" aria-modal="true">{modal.node}</div>
        </div>
      )}
      {toasts.map((t, i) => (
        <div key={t.id} className="toast" style={i ? { bottom: 20 + i * 52 } : undefined}>{t.msg}</div>
      ))}
    </Ctx.Provider>
  );
}
