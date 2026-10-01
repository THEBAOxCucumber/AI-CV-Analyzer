/**
 * จัดข้อความที่ดึงจาก PDF / Resume
 *
 * เลี่ยง regex แบบ `[ \t]+\n` หรือ `[...]+$`
 * เพราะเจอช่องว่างยาวๆ ที่ไม่ได้อยู่ท้ายบรรทัดจะ backtrack แบบ O(n²) (ReDoS, S8786)
 * ใช้ loop ตัดท้ายแทน → O(n)
 */

const SPACE_OR_TAB: ReadonlySet<string> =
  new Set([" ", "\t"]);

/**
 * ตัดอักขระที่อยู่ใน chars ออกจากท้ายข้อความ
 */
export function trimEndChars(
  value: string,
  chars: ReadonlySet<string>,
): string {
  let end = value.length;

  while (
    end > 0 &&
    chars.has(value[end - 1])
  ) {
    end -= 1;
  }

  return value.slice(0, end);
}

export function normalizeExtractedText(
  text: string,
): string {
  return text
    // ทำให้รูปแบบขึ้นบรรทัดเหมือนกัน (\r\n และ \r)
    .replace(/\r\n?/g, "\n")

    // ลบช่องว่างท้ายบรรทัด
    .split("\n")
    .map((line) =>
      trimEndChars(line, SPACE_OR_TAB),
    )
    .join("\n")

    // ลดช่องว่างติดกันหลายตัว
    .replace(/[ \t]{2,}/g, " ")

    // ลดบรรทัดว่างจำนวนมากให้เหลือไม่เกิน 2 บรรทัด
    .replace(/\n{3,}/g, "\n\n")

    .trim();
}
