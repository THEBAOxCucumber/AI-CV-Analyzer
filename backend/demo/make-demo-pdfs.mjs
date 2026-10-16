// สร้าง Resume ตัวอย่าง (บุคคลสมมติ) เป็น PDF — ใช้กับ npm run demo:seed และเทสต์ E2E
//
// ใช้: เปิด Edge/Chrome แบบ headless ที่ port 9333 แล้ว
//   msedge --headless=new --remote-debugging-port=9333 --user-data-dir=<temp>
//   node demo/make-demo-pdfs.mjs demo
//
// ฟอนต์ Sarabun + ปิด "ccmp": ถ้าเปิด เบราว์เซอร์จะแทนวรรณยุกต์ที่อยู่เหนือสระบน (ที่ ตั้ง ขึ้น)
// ด้วย glyph ที่ไม่มีรหัส Unicode → ดึงข้อความจาก PDF แล้ววรรณยุกต์หาย (กลายเป็น U+0000)
import { writeFileSync } from "node:fs"
const outDir = process.argv[2]

const css = `
  @page { size: A4; margin: 16mm 16mm; }
  body { font-family: "Sarabun", Tahoma, sans-serif; font-size: 10.5pt; color: #1e2a3f; line-height: 1.5; font-feature-settings: "ccmp" 0; }
  h1 { font-size: 20pt; margin: 0; color: #1e3156; }
  .role { font-size: 12pt; color: #496995; margin: 2px 0 6px; }
  .contact { font-size: 9.5pt; color: #444; }
  h2 { font-size: 12pt; color: #1e3156; border-bottom: 1.5px solid #c9d6ea; padding-bottom: 2px; margin: 14px 0 6px; }
  ul { margin: 4px 0; padding-left: 18px; } li { margin: 2px 0; }
  .job b { color: #1e3156; } .muted { color: #666; }
`

const resumes = {
  "demo-resume-backend.pdf": `
    <h1>สมชาย ใจดี (Somchai Jaidee)</h1>
    <div class="role">Backend Developer</div>
    <div class="contact">อีเมล: somchai.demo@example.com · โทร 080-000-0001 · กรุงเทพมหานคร · github.com/somchai-demo</div>

    <h2>สรุปโปรไฟล์ (Profile Summary)</h2>
    <p>นักพัฒนา Backend ประสบการณ์ 3 ปี เชี่ยวชาญ Node.js, TypeScript และฐานข้อมูล MySQL
    ออกแบบ REST API ที่รองรับผู้ใช้กว่า 50,000 คน และลดเวลาตอบสนองของระบบลง 35%</p>

    <h2>ทักษะ (Skills)</h2>
    <ul>
      <li>ภาษา: TypeScript, JavaScript, Python, SQL</li>
      <li>Backend: Node.js, Express, NestJS, REST API, GraphQL</li>
      <li>ฐานข้อมูล: MySQL, PostgreSQL, Redis</li>
      <li>DevOps: Docker, GitHub Actions (CI/CD), Linux, Nginx</li>
      <li>อื่นๆ: Git, Unit Testing (Jest), BullMQ, Agile/Scrum</li>
    </ul>

    <h2>ประสบการณ์ทำงาน (Experience)</h2>
    <div class="job"><b>Backend Developer — บริษัท สยามดิจิทัล จำกัด (สมมติ)</b> <span class="muted">มิ.ย. 2566 – ปัจจุบัน</span>
      <ul>
        <li>พัฒนา REST API ด้วย Node.js และ Express สำหรับระบบจองคิวที่มีผู้ใช้ 50,000 คน</li>
        <li>ย้ายงานประมวลผลหนักไปทำงานผ่าน BullMQ + Redis ลดเวลาตอบสนองจาก 1.2 วินาที เหลือ 0.8 วินาที</li>
        <li>เขียน Unit Test ด้วย Jest ครอบคลุมโค้ด 80% และตั้ง CI/CD ด้วย GitHub Actions</li>
      </ul>
    </div>
    <div class="job"><b>Junior Developer — บริษัท ไทยซอฟต์ จำกัด (สมมติ)</b> <span class="muted">พ.ค. 2565 – พ.ค. 2566</span>
      <ul>
        <li>ดูแลฐานข้อมูล MySQL ปรับ index ทำให้รายงานประจำวันเร็วขึ้น 3 เท่า</li>
        <li>ทำ Docker image สำหรับระบบภายใน 4 ระบบ</li>
      </ul>
    </div>

    <h2>โปรเจกต์ (Projects)</h2>
    <ul>
      <li><b>ระบบแจ้งเตือนพัสดุ</b> — Node.js, PostgreSQL, LINE Messaging API ส่งแจ้งเตือนวันละ 2,000 ครั้ง</li>
      <li><b>เว็บสรุปค่าใช้จ่าย</b> — NestJS + React แสดงกราฟค่าใช้จ่ายรายเดือน</li>
    </ul>

    <h2>การศึกษา (Education)</h2>
    <p>วิศวกรรมศาสตรบัณฑิต สาขาวิศวกรรมคอมพิวเตอร์ มหาวิทยาลัยตัวอย่าง (สมมติ) ปีที่จบ 2565 เกรดเฉลี่ย 3.25</p>
  `,
  "demo-resume-frontend.pdf": `
    <h1>สมหญิง รักเรียน (Somying Rakrian)</h1>
    <div class="role">Frontend Developer (นักศึกษาจบใหม่)</div>
    <div class="contact">อีเมล: somying.demo@example.com · โทร 080-000-0002 · เชียงใหม่</div>

    <h2>สรุปโปรไฟล์</h2>
    <p>นักศึกษาจบใหม่ที่สนใจงาน Frontend ถนัด React และ TypeScript
    มีประสบการณ์ฝึกงาน 4 เดือน และทำโปรเจกต์เว็บแอปพลิเคชันมาแล้ว 3 โปรเจกต์</p>

    <h2>ทักษะ</h2>
    <ul>
      <li>React, TypeScript, JavaScript, HTML, CSS, Tailwind CSS</li>
      <li>Figma, Responsive Design</li>
      <li>Git, GitHub</li>
    </ul>

    <h2>ประสบการณ์ฝึกงาน</h2>
    <div class="job"><b>Frontend Intern — บริษัท เว็บดี จำกัด (สมมติ)</b> <span class="muted">มิ.ย. – ก.ย. 2568</span>
      <ul>
        <li>ทำหน้าจอแดชบอร์ดด้วย React และ TypeScript จากแบบใน Figma</li>
        <li>แก้หน้าเว็บให้แสดงผลบนมือถือได้ 12 หน้า</li>
      </ul>
    </div>

    <h2>โปรเจกต์</h2>
    <ul>
      <li><b>เว็บรวมสูตรอาหาร</b> — React + Firebase ค้นหาสูตรตามวัตถุดิบ</li>
      <li><b>แอปจดรายรับรายจ่าย</b> — React Native</li>
    </ul>

    <h2>การศึกษา</h2>
    <p>วิทยาศาสตรบัณฑิต สาขาวิทยาการคอมพิวเตอร์ มหาวิทยาลัยตัวอย่าง (สมมติ) ปีที่จบ 2568</p>
  `,
}

const t = await (await fetch("http://127.0.0.1:9333/json/new?about:blank", { method: "PUT" })).json()
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => ws.addEventListener("open", r, { once: true }))
let id = 0; const p = new Map()
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id) } })
const send = (method, params = {}) => new Promise((r) => { const i = ++id; p.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await send("Page.enable")
for (const [file, body] of Object.entries(resumes)) {
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>Resume</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=block"><style>${css}</style></head><body>${body}</body></html>`
  await send("Page.navigate", { url: "data:text/html;charset=utf-8;base64," + Buffer.from(html).toString("base64") })
  await sleep(3500)
  const pdf = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true })
  writeFileSync(`${outDir}/${file}`, Buffer.from(pdf.result.data, "base64"))
  console.log("saved", file)
}
await fetch(`http://127.0.0.1:9333/json/close/${t.id}`); ws.close()
