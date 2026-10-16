// เช็กลิสต์ก่อนสาธิต: บริการทุกตัว + โมเดล + โหลดโมเดลค้างไว้ (warm up) + บัญชีสาธิต
//   npm run demo:check
import "dotenv/config";
import net from "node:net";
import { execFileSync } from "node:child_process";

const API = process.env.API_URL ?? "http://localhost:5000/api";
const FRONTEND = process.env.FRONTEND_CHECK_URL ?? "http://localhost:5173";
const OLLAMA = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
const QDRANT = process.env.QDRANT_URL ?? "http://localhost:6333";
const ANALYSIS_MODEL = process.env.OLLAMA_MODEL ?? "qwen3:4b-instruct";
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER ?? "gemini";
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL ?? "gemini-embedding-001";
const KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE ?? "30m";
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@example.com";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo12345";

let failures = 0;

function report(ok, label, detail = "") {
  if (!ok) failures += 1;
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function getJson(url, init) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000), ...init });
  return { ok: response.ok, status: response.status, json: await response.json().catch(() => ({})) };
}

function tcp(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host, timeout: 2000 });
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("error", () => resolve(false));
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
  });
}

console.log("เช็กลิสต์ก่อนสาธิต\n");

// ---------- บริการ ----------
report(await tcp(Number(process.env.DB_PORT ?? 3306)), "MySQL", "port 3306");
report(await tcp(Number(process.env.REDIS_PORT ?? 6379)), "Redis", "port 6379");

const qdrant = await fetch(`${QDRANT}/readyz`).then((r) => r.ok, () => false);
report(qdrant, "Qdrant", QDRANT);

const backend = await getJson(`${API}/health`).catch(() => null);
report(Boolean(backend?.ok), "Backend", backend ? `${API} (database ${backend.json.data?.database ?? "?"})` : `ติดต่อไม่ได้ — รัน npm run dev`);

const frontend = await fetch(FRONTEND).then((r) => r.ok, () => false);
report(frontend, "Frontend", frontend ? FRONTEND : `${FRONTEND} ติดต่อไม่ได้ — รัน npm run dev ที่โฟลเดอร์หลัก`);

// ---------- Ollama + โมเดล ----------
const tags = await getJson(`${OLLAMA}/api/tags`).catch(() => null);
report(Boolean(tags?.ok), "Ollama", tags ? OLLAMA : "ติดต่อไม่ได้ — เปิดโปรแกรม Ollama");

const installed = new Set((tags?.json.models ?? []).map((m) => m.name));
report(installed.has(ANALYSIS_MODEL), `โมเดลวิเคราะห์ ${ANALYSIS_MODEL}`, installed.has(ANALYSIS_MODEL) ? "" : `ยังไม่มี — ollama pull ${ANALYSIS_MODEL}`);

if (EMBEDDING_PROVIDER === "ollama") {
  report(installed.has(EMBEDDING_MODEL), `โมเดล Embedding ${EMBEDDING_MODEL}`, installed.has(EMBEDDING_MODEL) ? "" : `ยังไม่มี — ollama pull ${EMBEDDING_MODEL}`);
} else {
  report(Boolean(process.env.GEMINI_API_KEY), "Embedding: Gemini (ต้องใช้อินเทอร์เน็ต)", "แนะนำ EMBEDDING_PROVIDER=ollama สำหรับวันสาธิต (ดู README)");
}

// ---------- โหลดโมเดลค้างไว้ ----------
if (tags?.ok && installed.has(ANALYSIS_MODEL)) {
  const started = Date.now();
  const options = process.env.OLLAMA_NUM_GPU ? { num_gpu: Number(process.env.OLLAMA_NUM_GPU) } : {};
  const warm = await getJson(`${OLLAMA}/api/generate`, {
    method: "POST",
    body: JSON.stringify({ model: ANALYSIS_MODEL, prompt: "", keep_alive: KEEP_ALIVE, options }),
  }).catch((error) => ({ ok: false, json: { error: error.message } }));
  report(warm.ok, "โหลดโมเดลวิเคราะห์ค้างไว้", warm.ok ? `${((Date.now() - started) / 1000).toFixed(1)} วินาที, ค้างไว้ ${KEEP_ALIVE}` : warm.json.error);
}

if (EMBEDDING_PROVIDER === "ollama" && installed.has(EMBEDDING_MODEL)) {
  const warm = await getJson(`${OLLAMA}/api/embed`, {
    method: "POST",
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: "warm up", keep_alive: KEEP_ALIVE, options: { num_gpu: Number(process.env.EMBEDDING_NUM_GPU ?? 0) } }),
  }).catch((error) => ({ ok: false, json: { error: error.message } }));
  report(warm.ok, "โหลดโมเดล Embedding ค้างไว้", warm.ok ? "" : warm.json.error);
}

// ---------- GPU (ถ้ามี NVIDIA) ----------
try {
  const ps = await getJson(`${OLLAMA}/api/ps`);
  const model = (ps.json.models ?? []).find((m) => m.name === ANALYSIS_MODEL);
  if (model) {
    const onGpu = model.size_vram >= model.size;
    report(true, onGpu ? "โมเดลวิเคราะห์อยู่บน GPU ทั้งหมด" : "โมเดลวิเคราะห์บางส่วนอยู่บน CPU (ช้ากว่า)",
      `${Math.round(model.size_vram / 1e6)}/${Math.round(model.size / 1e6)} MB${onGpu ? "" : " — ลองปิดโปรแกรมที่ใช้ GPU หรือตั้ง OLLAMA_NUM_GPU"}`);
  }
  const gpu = execFileSync("nvidia-smi", ["--query-gpu=name,memory.used,memory.total", "--format=csv,noheader"], { encoding: "utf8" }).trim();
  console.log(`  GPU: ${gpu}`);
} catch {
  /* ไม่มี nvidia-smi */
}

// ---------- บัญชีสาธิต ----------
if (backend?.ok) {
  const login = await getJson(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });

  if (login.ok) {
    const resumes = await getJson(`${API}/resumes`, { headers: { Authorization: `Bearer ${login.json.data.token}` } });
    const count = resumes.json.data?.resumes?.length ?? 0;
    report(count > 0, `บัญชีสาธิต ${DEMO_EMAIL}`, `${count} Resume${count ? "" : " — รัน npm run demo:seed"}`);
  } else {
    report(false, `บัญชีสาธิต ${DEMO_EMAIL}`, "ยังไม่มี — รัน npm run demo:seed");
  }
}

console.log(failures === 0 ? "\n✓ พร้อมสาธิต" : `\n✗ ยังไม่พร้อม ${failures} รายการ`);
process.exit(failures === 0 ? 0 : 1);
