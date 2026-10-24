/*
 * ข้อความจาก Job provider มี HTML ติดมา
 * (เช่น Careerjet ไฮไลต์คำค้นด้วย <b>...</b>)
 * → แปลงเป็นข้อความล้วน ก่อนแสดงผล/ส่งให้ AI
 */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity.startsWith("#x") || entity.startsWith("#X")) {
        const code = Number.parseInt(entity.slice(2), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }

      if (entity.startsWith("#")) {
        const code = Number.parseInt(entity.slice(1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }

      return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    },
  );
}

/*
 * ลบแท็ก <...> — ผลเหมือน /<[^>]*>/g แต่เป็นเส้นตรง
 * (regex ช้าแบบกำลังสองเมื่อมี "<" จำนวนมากแต่ไม่มี ">" ปิด)
 * "<" ที่ไม่มี ">" ตามหลัง = ไม่ใช่แท็ก เก็บข้อความไว้ตามเดิม
 */
function stripTags(value: string): string {
  let result = "";
  let index = 0;

  while (index < value.length) {
    const open = value.indexOf("<", index);
    const close = open === -1 ? -1 : value.indexOf(">", open + 1);

    if (close === -1) {
      return result + value.slice(index);
    }

    result += value.slice(index, open);
    index = close + 1;
  }

  return result;
}

export function toPlainText(value: string): string {
  return decodeEntities(
    stripTags(
      value.replace(/<br\s*\/?>/gi, " "),
    ),
  )
    .replace(/\s+/g, " ")
    .trim();
}
