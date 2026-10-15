/*
 * ตั้งค่า Ollama ต่อคำขอ (ความเร็วบน GPU หน่วยความจำน้อย)
 *
 * วัดจริงบน RTX 3050 4GB + qwen3:4b (Q4): ค่าเริ่มต้นของ Ollama วางโมเดลบน GPU ไม่หมด
 * (~1GB ไป CPU) → 6.6 token/s, วิเคราะห์ 1 ครั้ง ~2 นาที
 * บังคับทุก layer บน GPU (num_gpu) + context พอดี prompt → ~48 token/s, ~20 วินาที
 */

// อักษรไทยใช้ token มากกว่าอังกฤษ — วัดได้ ~2.5 ตัวอักษร/token → ประมาณแบบเผื่อที่ 2
const CHARS_PER_TOKEN = 2;

// ผลวิเคราะห์ JSON ใช้ ~700–800 token — เผื่อไว้
const OUTPUT_TOKEN_BUDGET = 1536;

const CONTEXT_STEP = 1024;

export interface OllamaTuning {
  /** จำนวน layer บน GPU (null = ให้ Ollama เลือกเอง) */
  numGpu: number | null;
  minContext: number;
  maxContext: number;
}

/*
 * context พอดีกับ prompt + คำตอบ (ปัดขึ้นทีละ 1024)
 * เล็กเกิน → prompt ถูกตัด / ใหญ่เกิน → KV cache ล้น GPU แล้วช้า
 */
export function contextSizeFor(
  promptCharacters: number,
  tuning: Pick<OllamaTuning, "minContext" | "maxContext">,
): number {
  const needed =
    Math.ceil(promptCharacters / CHARS_PER_TOKEN) + OUTPUT_TOKEN_BUDGET;

  const rounded =
    Math.ceil(needed / CONTEXT_STEP) * CONTEXT_STEP;

  return Math.min(
    tuning.maxContext,
    Math.max(tuning.minContext, rounded),
  );
}

export function buildOllamaOptions(
  promptCharacters: number,
  tuning: OllamaTuning,
): Record<string, number> {
  const options: Record<string, number> = {
    temperature: 0.1,
    num_ctx: contextSizeFor(promptCharacters, tuning),
  };

  if (tuning.numGpu !== null) {
    options.num_gpu = tuning.numGpu;
  }

  return options;
}

/*
 * โหลดโมเดลไม่ขึ้นเพราะหน่วยความจำ GPU ไม่พอ (เช่นโปรแกรมอื่นใช้ VRAM อยู่)
 * → ลองใหม่โดยไม่บังคับ num_gpu (Ollama แบ่ง GPU/CPU เอง ช้ากว่าแต่ทำงานได้)
 */
export function isGpuMemoryError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  return /out of memory|cudaMalloc|failed to allocate|insufficient memory|unable to allocate|model requires more system memory/i.test(
    message,
  );
}

/*
 * เรียก Ollama ด้วย num_gpu ที่ตั้งไว้ — VRAM ไม่พอ → ลองใหม่ครั้งเดียวแบบอัตโนมัติ (null)
 * error อื่น (timeout, เชื่อมต่อไม่ได้ ฯลฯ) ส่งต่อให้ worker ตัดสินว่าจะ retry ไหม
 */
export async function withGpuFallback<T>(
  numGpu: number | null,
  request: (numGpu: number | null) => Promise<T>,
  onFallback: (error: unknown) => void = () => {},
): Promise<T> {
  try {
    return await request(numGpu);
  } catch (error) {
    if (numGpu === null || !isGpuMemoryError(error)) {
      throw error;
    }

    onFallback(error);

    return request(null);
  }
}
