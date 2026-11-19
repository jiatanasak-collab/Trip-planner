import { useEffect, useRef, useState, type FormEvent } from "react";
import { askAssistant, assistantAvailable, type ChatTurn } from "../../ai/assistant";
import { Ic } from "../../components/Icon";
import type { Trip } from "../../domain/types";
import { useApp } from "../../state";

interface Msg extends ChatTurn {
  /** จำนวนรายการที่ AI แก้ในข้อความนี้ */
  changes?: number;
  /** สำเนาทริปก่อน AI แก้ ใช้ย้อนกลับ */
  before?: Trip;
  undone?: boolean;
  error?: boolean;
}

// เก็บบทสนทนาของแต่ละทริปไว้ระหว่างเปิดหน้า (ปิดแผงแล้วเปิดใหม่ยังเห็นอยู่)
const histories = new Map<string, Msg[]>();

const SUGGEST = [
  "ปักหมุดทุกสถานที่ที่ยังไม่มีหมุด",
  "ใส่เวลาให้กิจกรรมที่ยังไม่มีเวลา ให้เหมาะกับการเดินทาง",
  "แนะนำร้านอาหารแถวที่พักคืนแรก",
  "เลื่อนกิจกรรมวันที่ 2 ให้ช้าลง 1 ชั่วโมง",
];

const errorText = (code: string) =>
  code === "not_granted" ? "ยังไม่ได้อนุญาตให้หน้านี้ใช้ Claude — เปิดสิทธิ์ได้ที่เมนู Permissions ของหน้านี้"
  : code === "rate_limited" ? "ใช้งานถี่เกินไป หรือโควตา Claude ของคุณเต็มชั่วคราว รอสักครู่แล้วลองใหม่"
  : code === "sampling_disabled" ? "บัญชีนี้ใช้ Claude ในหน้านี้ไม่ได้"
  : code === "session_expired" ? "กรุณาเข้าสู่ระบบ claude.ai อีกครั้ง"
  : code === "refused" ? "Claude ปฏิเสธคำขอนี้ ลองพิมพ์ใหม่อีกแบบ"
  : code === "tools_unavailable" || code === "not_available" ? "ผู้ช่วยใช้ไม่ได้ในหน้านี้"
  : "ผู้ช่วยขัดข้อง ลองส่งใหม่อีกครั้ง";

/** ปุ่ม "ผู้ช่วย AI" ลอยมุมขวาล่าง + แผงแชต */
export function Assistant({ t }: { t: Trip }) {
  const [ok, setOk] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { assistantAvailable().then(setOk); }, []);
  if (!ok) return null;
  return (
    <>
      {!open && (
        <button className="btn primary ai-fab" onClick={() => setOpen(true)}><Ic n="spark" /> ผู้ช่วย AI</button>
      )}
      {open && <AssistantPanel t={t} onClose={() => setOpen(false)} />}
    </>
  );
}

function AssistantPanel({ t, onClose }: { t: Trip; onClose: () => void }) {
  const app = useApp();
  const [msgs, setMsgs] = useState<Msg[]>(() => histories.get(t.id) || []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState("");
  const ctl = useRef<AbortController | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => { histories.set(t.id, msgs); }, [t.id, msgs]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [msgs, live, busy]);
  useEffect(() => () => ctl.current?.abort(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const send = async (content: string) => {
    content = content.trim();
    if (!content || busy) return;
    const history: Msg[] = [...msgs.filter((m) => !m.error), { role: "user", content }];
    setMsgs((m) => [...m, { role: "user", content }]);
    setText("");
    setBusy(true);
    setLive("");
    const before: Trip = JSON.parse(JSON.stringify(app.getTrip(t.id) || t));
    let changes = 0;
    const c = new AbortController();
    ctl.current = c;
    try {
      const reply = await askAssistant({
        trip: before,
        history: history.map(({ role, content }) => ({ role, content })),
        getTrip: () => app.getTrip(t.id) || t,
        apply: (fn) => app.updateTrip(t.id, fn),
        onChange: (n) => { changes += n; },
        onText: setLive,
        signal: c.signal,
      });
      setMsgs((m) => [...m, { role: "assistant", content: reply.trim(), changes, before: changes ? before : undefined }]);
    } catch (e: any) {
      const code = String(e?.code || "");
      const partial = String(e?.text || "").trim();
      if (code === "cancelled") {
        setMsgs((m) => [...m, { role: "assistant", content: (partial ? partial + "\n\n" : "") + "(หยุดแล้ว)", changes, before: changes ? before : undefined }]);
      } else {
        setMsgs((m) => [...m, { role: "assistant", content: (partial ? partial + "\n\n" : "") + errorText(code), error: true, changes, before: changes ? before : undefined }]);
      }
    }
    setLive("");
    setBusy(false);
    ctl.current = null;
  };

  const undo = (i: number) => {
    const m = msgs[i];
    if (!m.before) return;
    app.saveTrip(m.before);
    setMsgs((all) => all.map((x, j) => (j === i ? { ...x, undone: true } : x)));
    app.toast("ย้อนกลับการแก้ของ AI แล้ว");
  };
  const lastChange = msgs.map((m, i) => (m.before && !m.undone ? i : -1)).filter((i) => i >= 0).pop();

  const submit = (e: FormEvent) => { e.preventDefault(); send(text); };

  return (
    <div className="ai-sheet card" role="dialog" aria-label="ผู้ช่วย AI">
      <div className="ai-head">
        <Ic n="spark" />
        <b>ผู้ช่วย AI</b>
        <span className="ai-sub">แก้แผน · ปักหมุด · แนะนำสถานที่</span>
        <span className="spacer" />
        {msgs.length > 0 && !busy && <button className="btn sm ghost" onClick={() => setMsgs([])}>เริ่มใหม่</button>}
        <button className="iconbtn" title="ปิด" onClick={onClose} disabled={busy}><Ic n="down" /></button>
      </div>
      <div className="ai-list" ref={list}>
        {msgs.length === 0 && (
          <div className="ai-empty">
            <p>บอกสิ่งที่อยากให้ช่วยกับทริป <b>{t.name}</b> ได้เลย เช่น แก้เวลา ย้ายกิจกรรม เพิ่มสถานที่ หรือปักหมุด ทุกการแก้กด "ย้อนกลับ" ได้</p>
            <div className="ai-chips">
              {SUGGEST.map((s) => <button key={s} className="btn sm" onClick={() => send(s)}>{s}</button>)}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={"ai-msg " + m.role + (m.error ? " err" : "")}>
            <div className="ai-bubble">{m.content}</div>
            {!!m.changes && (
              <div className="ai-change">
                ✓ แก้ทริป {m.changes} รายการ
                {m.undone ? <span> · ย้อนกลับแล้ว</span>
                  : i === lastChange && <button className="btn sm ghost" onClick={() => undo(i)}>ย้อนกลับ</button>}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="ai-msg assistant">
            <div className="ai-bubble">{live || <><span className="spin" /> กำลังคิด…</>}</div>
          </div>
        )}
      </div>
      <form className="ai-input" onSubmit={submit}>
        <textarea className="txt" rows={2} value={text} placeholder="เช่น ย้าย Tokyo Skytree ไปวันที่ 3 ตอน 16:00"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(text); } }} />
        {busy
          ? <button type="button" className="btn" onClick={() => ctl.current?.abort()}>หยุด</button>
          : <button className="btn primary" disabled={!text.trim()}>ส่ง</button>}
      </form>
    </div>
  );
}
