# Deploy ด้วย Docker + GitHub Actions

```text
git push (main) → CI (test + docker build) → Deploy: build image → GHCR (Private, latest + sha-xxxxxxx)
                                                  → VPS: docker compose pull + up -d → รอ health
VPS: Nginx + HTTPS (certbot) → 127.0.0.1:3310 → app (เว็บ + API + worker) → mysql / redis / qdrant (volume)
                                                                         → ollama (เฉพาะ profile ai)
```

| ค่า | ใช้ |
|---|---|
| โฟลเดอร์บน VPS | `~/ai-cv-analyzer` (แอป Lab ใช้ `~/app`) |
| Port บน VPS | `127.0.0.1:3310` (แอป Lab ใช้ 3300) |
| Image | `ghcr.io/thebaoxcucumber/ai-cv-analyzer` และ `ghcr.io/thebaoxcucumber/ai-cv-analyzer-migrator` |
| Health | `GET /api/health` — 200 เมื่อ DB พร้อม, 503 เมื่อ DB ล่ม |
| โดเมน | `cv.example.com` (ตัวอย่าง — เปลี่ยนเป็นของจริง) |

## ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `Dockerfile` | multi-stage: build React → build backend → `runtime` (user `node`, มี HEALTHCHECK) และ `migrator` |
| `docker-compose.yml` | ทั้งระบบ ใช้ได้ทั้งในเครื่องและ VPS — DB ไม่เปิด port ออกนอก, ลำดับ db → migrate → app |
| `docker-compose.override.yml` | ในเครื่องเท่านั้น: build เอง + เปิด MySQL ที่ `127.0.0.1:3307` |
| `.env.example` | ค่าตัวอย่างของ compose |
| `backend/scripts/migrate.mjs` | รัน migration ที่ยังไม่เคยรัน (จดใน `schema_migrations`) รันซ้ำได้ |
| `.github/workflows/ci.yml` | job `Docker build` (build เฉยๆ ไม่ push) |
| `.github/workflows/deploy.yml` | push image ไป GHCR + deploy ผ่าน SSH (ไม่ตั้ง Secrets = ข้าม) |
| `deploy/make-env.sh` | สร้าง `.env` บน VPS สุ่มรหัสผ่านให้ |
| `deploy/nginx.conf` | reverse proxy ของโดเมนนี้ |
| `deploy/backup.sh` | สำรอง MySQL + ไฟล์ PDF + vector (Qdrant) เก็บ 14 วัน |
| `deploy/restore.sh` | กู้คืนจากชุดที่เลือก (สำรองสถานะปัจจุบันให้ก่อนเสมอ) |

## ทดลองในเครื่อง (PowerShell)

```powershell
Copy-Item .env.example .env      # แล้วแก้รหัสผ่าน / ลบบรรทัด APP_IMAGE, MIGRATOR_IMAGE
docker compose up --build -d
docker compose ps                # migrate = exited (0), app = healthy
Invoke-RestMethod http://127.0.0.1:3310/api/health
docker compose down              # ห้ามใส่ -v (จะลบฐานข้อมูล)
```

ใช้ Ollama ที่ติดตั้งบน Windows อยู่แล้วแทน container: ใส่ `OLLAMA_HOST=http://host.docker.internal:11434` ใน `.env`

## ขั้นที่ต้องทำเอง

### 1. Commit + push

```powershell
git add Dockerfile .dockerignore docker-compose.yml docker-compose.override.yml .env.example .gitignore deploy docs/DEPLOY.md .github/workflows backend/scripts/migrate.mjs backend/package.json backend/src/app.ts backend/src/server.ts backend/src/config/env.ts
git commit -m "feat(deploy): Docker image, compose and GHCR/VPS deploy workflow"
git push
```

ดูแท็บ **Actions**: `CI` ต้องผ่าน แล้ว `Deploy` จะ push image ไป GHCR (ขั้น deploy ถูกข้ามจนกว่าจะตั้ง Secrets)

### 2. DNS

สร้าง A record ของโดเมน/subdomain ชี้ไปที่ IP ของ VPS

### 3. บน VPS (user ปกติ)

```bash
mkdir -p ~/ai-cv-analyzer && cd ~/ai-cv-analyzer
BASE=https://raw.githubusercontent.com/THEBAOxCucumber/AI-CV-Analyzer/main
curl -fsSLO $BASE/docker-compose.yml
curl -fsSLO $BASE/deploy/make-env.sh
curl -fsSLO $BASE/deploy/nginx.conf
bash make-env.sh cv.example.com          # RAM ว่าง ≥ 6 GB และอยากใช้ AI: เติม --ai
nano .env                                # ใส่ SMTP / Careerjet / Gemini / Google key ที่มี
docker compose pull                      # ถ้า unauthorized: docker login ghcr.io (token สิทธิ์ read:packages)
docker compose up -d
docker compose ps
curl -s http://127.0.0.1:3310/api/health
```

- image ที่ workflow push ขึ้น GHCR เป็น Private (ค่าเริ่มต้น) → VPS ต้อง `docker login ghcr.io -u THEBAOxCucumber` ด้วย Personal access token (classic) ที่มีแค่ `read:packages`
- เปิด AI (`--ai`): ดึงโมเดลครั้งแรก
  `docker compose exec ollama ollama pull qwen3:4b-instruct` และ `docker compose exec ollama ollama pull qwen3-embedding:0.6b`
  บน CPU การวิเคราะห์ 1 ครั้งใช้หลายนาที
- ไม่เปิด AI: อัปโหลด/ค้นหาใช้ Gemini embedding (ต้องมี `GEMINI_API_KEY`) แต่ปุ่มวิเคราะห์จะล้มเหลว
- **ห้าม** `docker compose down -v` — ลบฐานข้อมูลและไฟล์ Resume

### 4. Nginx + HTTPS (root)

```bash
cd ~/ai-cv-analyzer
sed -i 's/cv.example.com/<โดเมนจริง>/g' nginx.conf
sudo cp nginx.conf /etc/nginx/sites-available/ai-cv-analyzer
sudo ln -s /etc/nginx/sites-available/ai-cv-analyzer /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d <โดเมนจริง> --redirect
```

### 5. GitHub Secrets → deploy อัตโนมัติ

Repo → Settings → Secrets and variables → Actions

| ชนิด | ชื่อ | ค่า |
|---|---|---|
| Secret | `VPS_HOST` | IP หรือโดเมนของ VPS |
| Secret | `VPS_USER` | user ที่ SSH เข้าและสั่ง docker ได้ |
| Secret | `VPS_SSH_KEY` | private key ที่ใช้ SSH (เนื้อหาทั้งไฟล์) |
| Variable (ไม่บังคับ) | `VPS_APP_DIR` | ถ้าไม่ใช่ `~/ai-cv-analyzer` |

จากนั้น Actions → **Deploy** → Run workflow → เปิดเว็บ `https://<โดเมน>` ตรวจว่าใช้ได้

### Google sign-in

เพิ่ม `https://<โดเมน>/api/auth/oauth/google/callback` ใน Google Cloud Console (ดู `backend/docs/OAUTH_SETUP.md`)

## สำรองและกู้คืนข้อมูล

ข้อมูลที่หายแล้วสร้างใหม่ไม่ได้: ฐานข้อมูล (บัญชี, Resume, ผลวิเคราะห์), ไฟล์ PDF และ vector ใน Qdrant — Redis เป็นคิวชั่วคราว ไม่ต้องสำรอง

### ติดตั้ง (บน VPS ครั้งเดียว)

```bash
cd ~/ai-cv-analyzer
BASE=https://raw.githubusercontent.com/THEBAOxCucumber/AI-CV-Analyzer/main
curl -fsSLO $BASE/deploy/backup.sh
curl -fsSLO $BASE/deploy/restore.sh
bash backup.sh          # ลองรันมือ 1 ครั้ง → ได้ 3 ไฟล์ใน backups/
```

ตั้งให้รันทุกวัน (`crontab -e` แล้วเพิ่มบรรทัดนี้ — เวลาตามนาฬิกาของ VPS ดูได้ด้วย `timedatectl`; ถ้าเป็น UTC, 20:00 = ตี 3 เวลาไทย):

```text
0 20 * * * cd /root/ai-cv-analyzer && bash backup.sh >> backups/backup.log 2>&1
```

ตรวจย้อนหลัง: `tail backups/backup.log` และ `ls -lh backups/`

### เก็บสำเนาไว้นอก VPS (สำคัญ)

backup ที่อยู่บน VPS เครื่องเดียวกันไม่ช่วยถ้า VPS พังหรือถูกลบ — ดึงลงเครื่องตัวเองเป็นระยะ (PowerShell):

```powershell
New-Item -ItemType Directory -Force "$HOME\ai-cv-backups" | Out-Null
scp "root@179.197.241.29:ai-cv-analyzer/backups/*-*" "$HOME\ai-cv-backups\"
```

ไฟล์มีข้อมูลส่วนตัวของผู้ใช้ (ชื่อ อีเมล Resume) — เก็บในที่ปลอดภัย ห้ามอัปโหลดขึ้นที่สาธารณะ

### กู้คืน

```bash
cd ~/ai-cv-analyzer
bash restore.sh                    # แสดงชุดที่มี
bash restore.sh 20261020-200000    # พิมพ์ restore เพื่อยืนยัน
```

สคริปต์ backup สถานะปัจจุบันให้อีกชุดก่อนกู้คืนเสมอ — เลือกชุดผิดก็กู้กลับได้
