import { useEffect, useMemo, useRef, useState } from "react";
import { aiErrorText, aiParse } from "../../ai/client";
import { Ic } from "../../components/Icon";
import { Spin } from "../../components/common";
import { basicParse } from "../../domain/basicParse";
import { importAsNewTrip, mergeIntoTrip } from "../../domain/trip";
import { fmtDate, money, normTime } from "../../domain/util";
import { useApp } from "../../state";

const MAX_IMAGE_BYTES = 8e6;

export function ImportModal({ intoTripId }: { intoTripId?: string }) {
  const app = useApp();
  const intoTrip = intoTripId ? app.trips[intoTripId] : undefined;
  const [mode, setMode] = useState<"into" | "new">(intoTrip ? "into" : "new");
  const [text, setText] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [start, setStart] = useState(intoTrip?.start || "");
  const [err, setErr] = useState("");
  const [parsed, setParsed] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [aiUsed, setAiUsed] = useState(false);
  const [over, setOver] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null);

  const thumbs = useMemo(() => images.map((f) => URL.createObjectURL(f)), [images]);
  useEffect(() => () => thumbs.forEach((u) => URL.revokeObjectURL(u)), [thumbs]);

  async function handleFiles(list: FileList | File[] | null) {
    setErr("");
    const add: File[] = [];
    let appended = "";
    for (const f of Array.from(list || [])) {
      if (f.type.startsWith("image/")) {
        if (f.size > MAX_IMAGE_BYTES) { setErr("รูปใหญ่เกิน 8MB"); continue; }
        add.push(f);
        continue;
      }
      const body = await f.text();
      if (/\.json$/i.test(f.name) || /^\s*[{[]/.test(body)) {
        try {
          const j = JSON.parse(body);
          const t0 = Array.isArray(j) ? j[0] : Array.isArray(j?.trips) ? j.trips[0] : j;
          if (t0 && Array.isArray(t0.days)) { setParsed(t0); continue; }
        } catch { /* ไม่ใช่ JSON ทริป ใช้เป็นข้อความ */ }
      }
      appended += (appended ? "\n" : "") + body;
    }
    if (appended) setText((v) => (v ? v + "\n" : "") + appended);
    if (add.length) {
      setImages((l) => [...l, ...add]);
      if (!app.ai) setErr("การอ่านรูปภาพต้องใช้ AI ซึ่งยังไม่ได้ตั้งค่า ลองวางเป็นข้อความแทน");
    }
  }

  const runBasic = () => {
    setErr("");
    if (!text.trim()) return setErr(images.length ? 'แปลงแบบพื้นฐานใช้ได้กับข้อความเท่านั้น รูปภาพให้ใช้ "ให้ AI จัดให้"' : "วางข้อความแผนเที่ยวก่อน");
    setParsed(basicParse(text));
  };

  const runAi = async () => {
    setErr("");
    if (!text.trim() && !images.length) return setErr("วางข้อความหรือแนบรูปแผนเที่ยวก่อน");
    setBusy(true);
    try {
      setParsed(await aiParse(text.trim(), images, start));
    } catch (e) {
      setErr(aiErrorText(e, 'AI อ่านแผนไม่สำเร็จ ลองอีกครั้ง หรือใช้ "แปลงแบบพื้นฐาน"'));
    }
    setBusy(false);
    setAiUsed(true);
  };

  const p = parsed || {};
  const days: any[] = Array.isArray(p.days) ? p.days : [];
  const nItems = days.reduce((s, d) => s + (Array.isArray(d?.items) ? d.items.length : 0), 0);
  const empty = parsed && !nItems;

  const save = () => {
    if (!parsed || !nItems) return;
    if (mode === "into" && intoTrip) {
      app.updateTrip(intoTrip.id, (d) => mergeIntoTrip(d, parsed, start));
      app.closeModal();
      app.toast("เพิ่มกิจกรรมลงทริปแล้ว");
    } else {
      const t = importAsNewTrip(parsed, start);
      app.saveTrip(t);
      app.closeModal();
      app.setUi({ tab: "plan", mapDay: null });
      app.go("trip", t.id);
      app.toast("นำเข้าแผนเที่ยวแล้ว");
    }
  };

  return (
    <>
      <h3>นำแผนเที่ยวเข้ามา</h3>
      <p className="hint">วางแผนเที่ยวในรูปแบบไหนก็ได้ เช่น ที่จดไว้ในโน้ต แชต LINE หรือที่ได้จากเว็บ/AI อื่น แนบรูปหน้าจอหรือไฟล์ .txt / .json ได้</p>
      {intoTrip && (
        <div className="seg" style={{ margin: "4px 0 8px" }}>
          <button type="button" className={mode === "into" ? "on" : ""} onClick={() => setMode("into")}>เพิ่มลงทริปนี้</button>
          <button type="button" className={mode === "new" ? "on" : ""} onClick={() => setMode("new")}>สร้างเป็นทริปใหม่</button>
        </div>
      )}
      <textarea className="txt" rows={9} value={text} autoFocus onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          const fs = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith("image/"));
          if (fs.length) { e.preventDefault(); handleFiles(fs); }
        }}
        placeholder={"ตัวอย่าง:\nทริปเชียงใหม่ 3 วัน\nวันที่ 1 (12 ธ.ค. 69)\n08:00 บินกรุงเทพ–เชียงใหม่ 1,500 บาท\n11:00 ข้าวซอยแม่มณี\n14:00 วัดพระธาตุดอยสุเทพ\nวันที่ 2\n09:00 ม่อนแจ่ม\n..."} />
      <div className={"drop " + (over ? "over" : "")} onClick={() => fileIn.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); }}>
        แนบรูปภาพแผนเที่ยว หรือไฟล์ .txt / .json — คลิกหรือลากมาวาง
        <input ref={fileIn} type="file" accept="image/*,.txt,.md,.json,.csv,text/plain,application/json" multiple hidden
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
      </div>
      <div className="thumbs">
        {thumbs.map((u, i) => (
          <div key={u}><img src={u} alt="" /><button type="button" onClick={() => setImages((l) => l.filter((_, j) => j !== i))}>×</button></div>
        ))}
      </div>
      <div className="frow" style={{ marginTop: 4 }}>
        <div><label className="f">วันเริ่มทริป (ถ้าแผนไม่ได้ระบุ)</label><input className="txt" type="date" value={start} onChange={(e) => setStart(e.target.value)} /></div>
        <div />
      </div>
      <div className="err">{err || (empty ? 'ยังหากิจกรรมในแผนไม่เจอ ลองจัดให้มี "วันที่ 1" และเวลาเช่น "09:00 …" นำหน้าแต่ละบรรทัด หรือใช้ AI' : "")}</div>
      {parsed && nItems > 0 && (
        <>
          <div className="preview">
            <div style={{ marginBottom: 8 }}>
              <b>{p.name || "แผนเที่ยว"}</b>{p.destination ? " · " + p.destination : ""}{p.start ? " · เริ่ม " + fmtDate(p.start) : ""} · {days.length} วัน {nItems} กิจกรรม
            </div>
            {days.map((d, i) => (
              <div key={i}>
                <div className="pd">วันที่ {i + 1}{d?.title ? " · " + d.title : ""}</div>
                {(d?.items || []).map((it: any, j: number) => (
                  <div key={j} className="pi">
                    {it?.time ? normTime(it.time) + " " : ""}{it?.title}
                    {it?.place && <em> @ {it.place}</em>}
                    {Number(it?.cost) ? <em> · {money(it.cost, p.currency || "")}</em> : null}
                  </div>
                ))}
              </div>
            ))}
            {Array.isArray(p.stays) && p.stays.length > 0 && (
              <>
                <div className="pd">ที่พัก</div>
                {p.stays.map((s: any, i: number) => <div key={i} className="pi">{s?.name} <em>· วันที่ {(parseInt(s?.startDay) || 0) + 1} · {parseInt(s?.nights) || 1} คืน</em></div>)}
              </>
            )}
            {Array.isArray(p.checklist) && p.checklist.length > 0 && (
              <>
                <div className="pd">เช็กลิสต์</div>
                <div className="pi">{p.checklist.map((c: any) => (typeof c === "string" ? c : c?.text)).join(", ")}</div>
              </>
            )}
          </div>
          <p className="hint" style={{ marginTop: 8 }}>ตรวจดูก่อนบันทึก แก้ไขรายละเอียดได้ภายหลัง</p>
        </>
      )}
      <div className="foot">
        {!app.ai && <span className="ai-off" style={{ marginRight: "auto", alignSelf: "center" }}>AI ยังไม่ได้ตั้งค่า</span>}
        <button type="button" className="btn" onClick={app.closeModal}>ยกเลิก</button>
        <button type="button" className="btn" title="แยกจากรูปแบบ เช่น วันที่ 1 / 09:00 ..." onClick={runBasic}>แปลงแบบพื้นฐาน</button>
        {app.ai && (
          <button type="button" className="btn coral" disabled={busy} onClick={runAi}>
            {busy ? <><Spin /> กำลังอ่านแผน…</> : <><Ic n="spark" /> {aiUsed ? "ให้ AI จัดใหม่" : "ให้ AI จัดให้"}</>}
          </button>
        )}
        {parsed && nItems > 0 && (
          <button type="button" className="btn primary" onClick={save}>{mode === "into" ? "เพิ่มลงทริปนี้" : "บันทึกเป็นทริปใหม่"}</button>
        )}
      </div>
    </>
  );
}
