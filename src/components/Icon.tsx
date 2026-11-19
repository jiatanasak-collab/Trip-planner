import type { CSSProperties } from "react";
import { AICONS } from "../domain/icons";

// ไอคอนของ UI คัดลอกจากต้นแบบ
export const ICONS: Record<string, string> = {
  plus:'<path d="M12 5v14M5 12h14"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  up:'<path d="m18 15-6-6-6 6"/>',
  down:'<path d="m6 9 6 6 6-6"/>',
  map:'<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  route:'<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  attach:'<path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',
  export:'<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
  import:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  back:'<path d="m15 18-6-6 6-6"/>',
  sort:'<path d="M3 6h13M3 12h9M3 18h5M17 8v12M14 17l3 3 3-3"/>',
  spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/>',
  move:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  bed:'<path d="M2 20V8M22 20v-6a3 3 0 0 0-3-3H10v6"/><path d="M2 17h20"/><circle cx="6" cy="12" r="2"/>',
  nav:'<path d="m3 11 18-8-8 18-2-8Z"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'
};

export type IconName = keyof typeof ICONS;

/** ไอคอน UI (เส้นหนา 2) */
export function Ic({ n, size, style }: { n: string; size?: number; style?: CSSProperties }) {
  const st = size ? { width: size, height: size, ...style } : style;
  return (
    <svg className="icon" style={st} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: ICONS[n] || "" }} />
  );
}

/** ไอคอนกิจกรรม (เส้นหนา 1.7) */
export function Aic({ k, size, style }: { k: string; size?: number; style?: CSSProperties }) {
  const st = size ? { width: size, height: size, ...style } : style;
  return (
    <svg className="icon" style={st} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: (AICONS[k] || AICONS.pin).p }} />
  );
}
