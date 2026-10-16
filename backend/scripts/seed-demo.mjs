// สร้างบัญชีสาธิตพร้อม Resume ตัวอย่างและผลวิเคราะห์จริง (ผ่าน API ของแอป)
//
// ต้องเปิด backend (npm run dev) + Docker + Ollama ก่อน
//   npm run demo:seed
//
// รันซ้ำได้: ลบบัญชีสาธิตเดิม (ผ่าน API ลบบัญชี) แล้วสร้างใหม่ทั้งหมด
// ค่าที่เปลี่ยนได้: DEMO_EMAIL, DEMO_PASSWORD, API_URL
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API = process.env.API_URL ?? "http://localhost:5000/api";
const EMAIL = process.env.DEMO_EMAIL ?? "demo@example.com";
const PASSWORD = process.env.DEMO_PASSWORD ?? "Demo12345";

const demoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../demo");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function call(method, route, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API}${route}`, {
    method,
    headers,
    body: form ?? (body ? JSON.stringify(body) : undefined),
  });
  const json = await response.json().catch(() => ({}));

  return { status: response.status, json };
}

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

async function login() {
  const { status, json } = await call("POST", "/auth/login", { body: { email: EMAIL, password: PASSWORD } });
  return status === 200 ? json.data.token : null;
}

// ---------- 0) backend พร้อมไหม ----------
const health = await fetch(`${API}/health`).catch(() => null);
if (!health?.ok) fail(`ติดต่อ backend ไม่ได้ (${API}) — เปิด npm run dev ก่อน`);

// ---------- 1) ลบบัญชีสาธิตเดิม ----------
const oldToken = await login();
if (oldToken) {
  const { status } = await call("DELETE", "/auth/account", {
    token: oldToken,
    body: { currentPassword: PASSWORD, confirmEmail: EMAIL },
  });
  if (status !== 200) fail(`ลบบัญชีสาธิตเดิมไม่สำเร็จ (HTTP ${status})`);
  console.log("• ลบบัญชีสาธิตเดิมแล้ว");
}

// ---------- 2) สมัคร + โปรไฟล์ ----------
const register = await call("POST", "/auth/register", {
  body: { firstName: "สมชาย", lastName: "ใจดี", email: EMAIL, password: PASSWORD },
});
if (register.status !== 201) {
  fail(`สมัครบัญชีสาธิตไม่สำเร็จ (HTTP ${register.status}): ${register.json.message ?? ""}\n  ถ้าอีเมลนี้มีอยู่แล้วแต่รหัสผ่านไม่ตรง ให้ตั้ง DEMO_PASSWORD ให้ถูก`);
}

const token = await login();
if (!token) fail("เข้าสู่ระบบบัญชีสาธิตไม่สำเร็จ");

await call("PUT", "/profile", {
  token,
  body: {
    phone: "0800000001",
    location: "กรุงเทพมหานคร",
    headline: "Backend Developer",
    university: "มหาวิทยาลัยตัวอย่าง",
    faculty: "วิศวกรรมศาสตร์",
    major: "วิศวกรรมคอมพิวเตอร์",
    educationLevel: "BACHELOR",
    graduationYear: 2022,
    interestedPosition: "Backend Developer",
    experienceLevel: "JUNIOR",
    bio: "บัญชีสาธิตสำหรับนำเสนอโครงงาน (ข้อมูลสมมติ)",
  },
});
console.log(`• สร้างบัญชี ${EMAIL}`);

// ---------- 3) อัปโหลด Resume + สร้าง vector ----------
async function uploadResume(file) {
  const form = new FormData();
  form.append("resume", new Blob([readFileSync(path.join(demoDir, file))], { type: "application/pdf" }), file);

  const upload = await call("POST", "/resumes/upload", { token, form });
  if (upload.status !== 201 && upload.status !== 200) fail(`อัปโหลด ${file} ไม่สำเร็จ (HTTP ${upload.status}): ${upload.json.message ?? ""}`);

  const resumeId = upload.json.data.resume.id;
  const embed = await call("POST", `/resumes/${resumeId}/embeddings`, { token });
  if (embed.status !== 200) fail(`สร้าง vector ของ ${file} ไม่สำเร็จ (HTTP ${embed.status}): ${embed.json.message ?? ""}`);

  console.log(`• อัปโหลด ${file} (resume ${resumeId})`);
  return resumeId;
}

const backendResume = await uploadResume("demo-resume-backend.pdf");
const frontendResume = await uploadResume("demo-resume-frontend.pdf");

// ---------- 4) รายละเอียดงาน ----------
async function createJob(job) {
  const { status, json } = await call("POST", "/job-descriptions", { token, body: job });
  if (status !== 201 && status !== 200) fail(`สร้างรายละเอียดงานไม่สำเร็จ (HTTP ${status})`);
  return json.data.jobDescription.id;
}

const backendJob = await createJob({
  title: "Backend Developer",
  company: "บริษัท ตัวอย่างเทค จำกัด",
  description: "รับสมัคร Backend Developer ประสบการณ์ 2 ปีขึ้นไป ใช้ Node.js และ TypeScript ออกแบบ REST API ทำงานกับ MySQL และ Redis ใช้ Docker และ CI/CD ได้ มีความรู้ AWS หรือ Kubernetes จะพิจารณาเป็นพิเศษ",
});

const frontendJob = await createJob({
  title: "Frontend Developer",
  company: "บริษัท ตัวอย่างดีไซน์ จำกัด",
  description: "รับสมัคร Frontend Developer ใช้ React และ TypeScript สร้างหน้าเว็บตามแบบใน Figma รองรับมือถือ (Responsive) มีความรู้ Testing และ Accessibility เป็นข้อได้เปรียบ รับนักศึกษาจบใหม่",
});

// ---------- 5) วิเคราะห์ด้วย AI จริง (ทีละงาน) ----------
async function analyze(resumeId, label, body) {
  const started = Date.now();
  const start = await call("POST", `/resumes/${resumeId}/analyses`, { token, body });
  if (start.status !== 201 && start.status !== 202 && start.status !== 200) fail(`เริ่มวิเคราะห์ ${label} ไม่สำเร็จ (HTTP ${start.status}): ${start.json.message ?? ""}`);

  const runId = (start.json.data.analysis ?? start.json.data.analysisRun ?? start.json.data).id;

  for (let i = 0; i < 600; i++) {
    const { json } = await call("GET", `/analyses/${runId}`, { token });
    const run = json.data.analysis ?? json.data.analysisRun ?? json.data;

    if (run.status === "COMPLETED") {
      const score = run.analysisType === "BASE" ? run.baseResumeScore : run.jobMatchScore;
      console.log(`• ${label}: ${score}/100 (${((Date.now() - started) / 1000).toFixed(0)} วินาที)`);
      return;
    }

    if (run.status === "FAILED") fail(`${label} ล้มเหลว: ${run.errorCode} ${run.errorMessage ?? ""}`);

    await sleep(1000);
  }

  fail(`${label} ใช้เวลานานเกิน 10 นาที — ตรวจ Ollama`);
}

console.log("• กำลังวิเคราะห์ด้วย AI (ครั้งแรกอาจช้าเพราะโหลดโมเดล)...");
await analyze(backendResume, "วิเคราะห์ Resume สมชาย", { analysisType: "BASE" });
await analyze(backendResume, "สมชาย × Backend Developer", { analysisType: "JOB_MATCH", jobDescriptionId: backendJob });
await analyze(backendResume, "สมชาย × Frontend Developer", { analysisType: "JOB_MATCH", jobDescriptionId: frontendJob });
await analyze(frontendResume, "วิเคราะห์ Resume สมหญิง", { analysisType: "BASE" });
await analyze(frontendResume, "สมหญิง × Frontend Developer", { analysisType: "JOB_MATCH", jobDescriptionId: frontendJob });

console.log(`\n✓ พร้อมสาธิต — เข้าสู่ระบบด้วย ${EMAIL} / ${PASSWORD}`);
