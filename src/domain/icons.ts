// ไอคอนกิจกรรมและกฎเลือกไอคอนอัตโนมัติ คัดลอกจากต้นแบบแบบตรงตัว
import type { Cat, Item } from "./types";
import { isUrl } from "./util";

export interface ActivityIcon { l: string; p: string }

export const AICONS: Record<string, ActivityIcon> = {
  plane:{l:"เครื่องบิน",p:'<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>'},
  train:{l:"รถไฟ",p:'<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10h14M9 21l-2-4M15 21l2-4"/><circle cx="9" cy="13.5" r=".9"/><circle cx="15" cy="13.5" r=".9"/>'},
  bus:{l:"รถบัส",p:'<rect x="4" y="3" width="16" height="15" rx="2"/><path d="M4 10h16M8 21v-3M16 21v-3"/><circle cx="8" cy="14" r=".9"/><circle cx="16" cy="14" r=".9"/>'},
  boat:{l:"เรือ",p:'<path d="M3 16h18l-2.5 4.5h-13z"/><path d="M12 3v13M12 4.5 18 13h-6"/>'},
  cable:{l:"กระเช้า",p:'<path d="M3 3l18 4M12 5v4.5"/><rect x="6" y="9.5" width="12" height="11" rx="2"/><path d="M6 14h12"/>'},
  car:{l:"รถยนต์/แท็กซี่",p:'<path d="M5 17V12l2-5h10l2 5v5"/><path d="M5 12h14"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/>'},
  luggage:{l:"กระเป๋า",p:'<rect x="6" y="7" width="12" height="13" rx="2"/><path d="M9 7V4h6v3M10 20v1.5M14 20v1.5M10 11v5M14 11v5"/>'},
  bed:{l:"ที่พัก",p:'<path d="M2 20V8M22 20v-6a3 3 0 0 0-3-3H10v6"/><path d="M2 17h20"/><circle cx="6" cy="12" r="2"/>'},
  onsen:{l:"ออนเซ็น",p:'<path d="M3 15c0 3 4 5.5 9 5.5s9-2.5 9-5.5"/><path d="M3 15h18"/><path d="M8 11.5c-1.2-1.6 1.2-2.6 0-4.5M12 11.5c-1.2-1.6 1.2-2.6 0-4.5M16 11.5c-1.2-1.6 1.2-2.6 0-4.5"/>'},
  torii:{l:"ศาลเจ้า",p:'<path d="M2.5 5c6.3 1.6 12.7 1.6 19 0"/><path d="M4.5 9.5h15"/><path d="M7 6.3V21M17 6.3V21M12 7v2.5"/>'},
  temple:{l:"วัด",p:'<path d="M12 2v3"/><path d="M4 9.5 12 5l8 4.5"/><path d="M5.5 14 12 10.5l6.5 3.5"/><path d="M7 9.5v3M17 9.5v3"/><path d="M3 21h18M7.5 14v7M16.5 14v7"/><path d="M10.5 21v-3.5h3V21"/>'},
  castle:{l:"ปราสาท",p:'<path d="M4 21V10h2.5V7h2v3h2V5h3v5h2V7h2v3H20v11z"/><path d="M10 21v-3.5a2 2 0 0 1 4 0V21"/>'},
  museum:{l:"พิพิธภัณฑ์",p:'<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8"/><path d="M3 21h18"/>'},
  art:{l:"งานศิลปะ",p:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/>'},
  park:{l:"สวนสนุก",p:'<circle cx="12" cy="10" r="7"/><path d="M12 3v14M5 10h14M7 5l10 10M17 5 7 15"/><path d="M8 21.5l4-4.5 4 4.5"/>'},
  tower:{l:"จุดชมวิว",p:'<path d="M12 2v3.5"/><path d="M9 5.5h6l-1 4h-4z"/><path d="M10 9.5 7 21.5M14 9.5l3 12M8.5 15.5h7"/>'},
  bridge:{l:"สะพาน",p:'<path d="M2 16.5h20M3.5 16.5c2-6.5 15-6.5 17 0M7 16.5v-4.5M12 16.5v-6M17 16.5v-4.5"/>'},
  mountain:{l:"ภูเขา",p:'<path d="M2 20 9 8l3.5 5.5L15.5 9 22 20z"/><path d="M7.2 11.2 9 12.3l1.8-1.3"/>'},
  water:{l:"ทะเล/ทะเลสาบ",p:'<path d="M2 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 13.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>'},
  tree:{l:"สวน/ธรรมชาติ",p:'<path d="M12 22v-5.5"/><path d="M12 2.5l5 7h-3l4 6.5H6l4-6.5H7z"/>'},
  bowl:{l:"ราเมง/เส้น",p:'<path d="M3 11.5h18a9 9 0 0 1-18 0z"/><path d="M8 21h8"/><path d="M14.5 2.5 9 11.5M20 4l-7.5 7.5"/>'},
  fish:{l:"ซูชิ/ซีฟู้ด",p:'<path d="M2 12c3-5 10-6.5 15-2l5-3-1.5 5 1.5 5-5-3c-5 4.5-12 3-15-2z"/><circle cx="7" cy="11.2" r=".9"/>'},
  skewer:{l:"ปิ้งย่าง/ของทอด",p:'<path d="M3.5 20.5 20.5 3.5"/><circle cx="8.5" cy="15.5" r="2.2"/><circle cx="12.3" cy="11.7" r="2.2"/><circle cx="16.1" cy="7.9" r="2.2"/>'},
  coffee:{l:"คาเฟ่",p:'<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 3v3M12 3v3"/>'},
  drink:{l:"บาร์/เครื่องดื่ม",p:'<path d="M5 4h14l-7 8z"/><path d="M12 12v8.5M8 20.5h8"/>'},
  meal:{l:"ร้านอาหาร",p:'<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10"/><path d="M17.5 3C15.5 3 14.5 6 14.5 10h3v11"/>'},
  market:{l:"ตลาด",p:'<path d="M3 9l2-5h14l2 5"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12v9h14v-9"/><path d="M10 21v-5h4v5"/>'},
  bag:{l:"ช้อปปิ้ง",p:'<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'},
  camera:{l:"ถ่ายรูป/เที่ยวชม",p:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'},
  route:{l:"เดินทาง",p:'<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19h8.5a3.5 3.5 0 0 0 0-7H7a3.5 3.5 0 0 1 0-7h8.5"/>'},
  pin:{l:"อื่นๆ",p:'<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z"/><circle cx="12" cy="10" r="2.5"/>'}
};

export const ICON_RULES: [string, RegExp][] = [
  ["cable",/กระเช้า|ropeway|cable ?car|gondola/],
  ["train",/ชินคันเซ็น|shinkansen|รถไฟ|train|romancecar|rapi:?t|keikyu|kintetsu|nankai|\bjr\b|subway|metro|รถไฟฟ้า|\bmrt\b|\bbts\b|สถานี|station|suica/],
  ["bus",/รถบัส|บัส|\bbus|busta/],
  ["plane",/สนามบิน|airport|เครื่องบิน|บิน|flight/],
  ["boat",/ล่องเรือ|เรือ|ferry|cruise|boat/],
  ["car",/แท็กซี่|taxi|รถเช่า|rent ?a ?car|grab|uber/],
  ["luggage",/ส่งกระเป๋า|ฝากกระเป๋า|takkyubin|luggage|locker|ล็อกเกอร์/],
  ["onsen",/ออนเซ็น|onsen|แช่น้ำแร่|hot spring|เรียวกัง|ryokan/],
  ["bed",/โรงแรม|hotel|ที่พัก|hostel|เช็กอิน|เช็คอิน|check.?in|เช็กเอาท์|เช็คเอาท์|check.?out|airbnb|resort|รีสอร์ท/],
  ["bowl",/ราเมง|ramen|บะหมี่|อุด้ง|udon|โซบะ|soba|โฮโต|hoto|noodle|ก๋วยเตี๋ยว|ข้าวซอย|pho|เฝอ/],
  ["fish",/ซูชิ|sushi|ซาชิมิ|ซีฟู้ด|seafood|ปลา|fish|ไคเซ็น|kaisen/],
  ["skewer",/ยากิโทริ|yakitori|คุชิ|kushi|ทาโกยากิ|takoyaki|ปิ้งย่าง|yakiniku|ยากินิคุ|bbq|บาร์บีคิว|street food/],
  ["coffee",/คาเฟ่|cafe|café|กาแฟ|coffee|มัทฉะ|matcha|ร้านชา|tea house|ขนม|dessert|ของหวาน/],
  ["drink",/บาร์|\bbar\b|อิซากายะ|izakaya|สาเก|sake|เบียร์|beer|wine|ไวน์|cocktail|ค็อกเทล/],
  ["market",/ตลาด|market|ถนนคนเดิน/],
  ["art",/teamlab|ทีมแล็บ|art ?museum|อาร์ต|exhibition|นิทรรศการ/],
  ["museum",/พิพิธภัณฑ์|museum|gallery|แกลเลอรี/],
  ["park",/universal|\busj\b|disney|ดิสนีย์|สวนสนุก|theme park|amusement/],
  ["castle",/ปราสาท|castle|พระราชวัง|palace/],
  ["torii",/ศาลเจ้า|shrine|jingu|jinja|taisha|ไทฉะ|อินาริ|inari|โทริอิ|torii/],
  ["temple",/วัด|temple|[a-z]+-(?:ji|dera|in)\b|ดะระ|เจดีย์|pagoda|พระใหญ่|buddha/],
  ["tower",/skytree|สกายทรี|tower|ทาวเวอร์|\bsky\b|ชมวิว|จุดชมวิว|viewpoint|observ|ดาดฟ้า/],
  ["bridge",/สะพาน|bridge/],
  ["mountain",/ฟูจิ|fuji|ภูเขา|mount|\bmt\.|โอวาคุดานิ|owakudani|ดอย|ม่อน/],
  ["water",/ทะเลสาบ|lake|ทะเล|beach|ชายหาด|หาด|น้ำตก|waterfall|อ่าว|bay/],
  ["tree",/สวน|park|garden|ป่า|ไผ่|bamboo|forest|ธรรมชาติ|nature/],
  ["bag",/ช้อป|ช็อป|shop|mall|ห้าง|outlet|เอาท์เล็ท|ดองกี้|don ?quijote|ginza|ซื้อของ|ของฝาก|souvenir|character street/],
  ["meal",/กิน|อาหาร|ข้าว|มื้อ|lunch|dinner|breakfast|brunch|restaurant|ร้าน|เทมปุระ|tempura|มงจา|monja|ไคเซกิ|kaiseki|ยูโดฟุ|คามะเมะชิ|บุฟเฟ่ต์|buffet|ชาบู|shabu|สุกี้|wagyu|วากิว/],
  ["camera",/ถ่ายรูป|photo|สี่แยก|crossing|lawson|ลอว์สัน|เดินเล่น|walk/]
];

export const CAT_ALLOWED: Partial<Record<Cat, string[]>> = {shop:["bag","market","coffee","art"],food:["bowl","fish","skewer","coffee","drink","market","meal"],stay:["onsen","bed","luggage"],move:["plane","cable","train","bus","boat","car","luggage"]};
export const CAT_DEFAULT: Record<Cat, string> = {sight:"camera",food:"meal",move:"route",stay:"bed",shop:"bag",other:"pin"};

/**
 * เลือกไอคอนให้กิจกรรม: ใช้ไอคอนที่ผู้ใช้เลือกก่อน ถ้าไม่มีให้ match keyword จากชื่อกิจกรรม
 * แล้วค่อยชื่อสถานที่ (ข้ามถ้าเป็นลิงก์) โดยจำกัดไอคอนตามประเภทใน CAT_ALLOWED
 */
export function itemIcon(it: Pick<Item, "title" | "place" | "cat"> & { icon?: string }): string {
  if (it.icon && AICONS[it.icon]) return it.icon;
  const allowed = CAT_ALLOWED[it.cat];
  for (const text of [(it.title || "").toLowerCase(), isUrl(it.place) ? "" : (it.place || "").toLowerCase()]) {
    if (!text) continue;
    for (const [k, re] of ICON_RULES) {
      if (allowed && !allowed.includes(k)) continue;
      if (re.test(text)) return k;
    }
  }
  return CAT_DEFAULT[it.cat] || "pin";
}
