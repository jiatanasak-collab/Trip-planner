export type JsonShape = "object" | "array";

/**
 * ดึง JSON ออกจากคำตอบของโมเดล รองรับกรณีมี ```json ครอบ หรือมีข้อความอื่นปน
 * คืน undefined ถ้าอ่านไม่ได้ ถ้าได้ object แต่ต้องการ array จะหา array แรกใน object ให้ (เช่น {"notes":[...]})
 */
export function extractJson(text: string, shape: JsonShape): unknown {
  const tryParse = (s: string) => { try { return JSON.parse(s); } catch { return undefined; } };
  const t = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let v = tryParse(t);
  if (v === undefined) {
    const re = shape === "array" ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
    const m = re.exec(t);
    if (m) v = tryParse(m[0]);
    if (v === undefined && shape === "array") {
      const o = /\{[\s\S]*\}/.exec(t);
      if (o) v = tryParse(o[0]);
    }
  }
  if (typeof v === "string") v = extractJson(v, shape);
  if (shape === "array" && v && !Array.isArray(v) && typeof v === "object") {
    const arr = Object.values(v as object).find(Array.isArray);
    if (arr) v = arr;
  }
  return v;
}
