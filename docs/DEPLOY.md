# Deploy ด้วย Docker + GitHub Actions

```text
git push (main) → CI (test + docker build) → Deploy: build image → GHCR (Private, latest + sha-xxxxxxx)
                                                  → VPS: docker compose pull + up -d → รอ health
VPS: Nginx + HTTPS (certbot) → 127.0.0.1:3310 → app (เว็บ + API + worker) → mysql / redis / qdrant (volume)
                                                                         → Ollama บนเครื่องผู้พัฒนา (Tailscale)
```

| ค่า | ใช้ |
|---|---|
| โฟลเดอร์บน VPS | `~/ai-cv-analyzer` (แอป Lab ใช้ `~/app`) |
| Port บน VPS | `127.0.0.1:3310` (แอป Lab ใช้ 3300) |
| Image | `ghcr.io/thebaoxcucumber/ai-cv-analyzer` และ `ghcr.io/thebaoxcucumber/ai-cv-analyzer-migrator` |
| Health | `GET /api/health` — 200 เมื่อ DB พร้อม, 503 เมื่อ DB ล่ม |
| โดเมน | `learnace.tech` (+ `www`) — DNS ที่ Hostinger, HTTPS จาก certbot |
| AI (Ollama) | เครื่อง Windows ของผู้พัฒนา (GPU) ผ่าน Tailscale — VPS RAM ไม่พอรัน `qwen3:4b-instruct` |

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
| `deploy/nginx-security.conf` | security headers + ซ่อนเลขเวอร์ชัน Nginx (วางใน `/etc/nginx/conf.d/`) |
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

## ตั้งค่าเพิ่มเติมบนเว็บจริง

### AI: ใช้ GPU เครื่องตัวเองผ่าน Tailscale

VPS (RAM 3.8 GB, ไม่มี GPU) รัน `qwen3:4b-instruct` ไม่ได้ — `qwen3:1.7b` บน CPU ทดสอบแล้วไม่ผ่าน (ให้ 100/100 ทุกคน แต่งข้อมูลเอง และเกินเวลา 4 นาที)
จึงให้ VPS เรียก Ollama บนเครื่อง Windows ผ่าน Tailscale (เครือข่ายส่วนตัว เข้ารหัส — Ollama ไม่เปิดสู่อินเทอร์เน็ต)

เครื่อง Windows (PowerShell):

```powershell
winget install --id Tailscale.Tailscale -e      # แล้ว Log in ในแอป
tailscale ip -4                                 # จด IP 100.x.y.z
tailscale serve --bg --tcp 11434 tcp://127.0.0.1:11434
```

VPS:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up                                    # login บัญชีเดียวกัน
nano ~/ai-cv-analyzer/.env                      # OLLAMA_HOST=http://100.x.y.z:11434
                                                # OLLAMA_MODEL=qwen3:4b-instruct
                                                # OLLAMA_NUM_GPU=99   (COMPOSE_PROFILES ว่าง)
cd ~/ai-cv-analyzer && docker compose up -d
docker compose exec app node -e "fetch(process.env.OLLAMA_HOST+'/api/tags').then(r=>r.json()).then(j=>console.log(j.models.map(m=>m.name)))"
```

- วิเคราะห์ได้เฉพาะตอนเครื่อง Windows เปิดอยู่ (Ollama + Tailscale) และไม่ sleep — ปิดอยู่ = งานลองซ้ำ 3 ครั้งแล้วขึ้นว่าล้มเหลว ส่วนอื่นของเว็บใช้ได้ปกติ
- embedding บนเว็บจริงใช้ Gemini (`GEMINI_API_KEY`) ไม่ต้องพึ่งเครื่อง Windows
- เลิกให้ VPS ใช้ GPU: `tailscale serve --tcp 11434 off`

### Careerjet (ค้นหางาน / Job Match)

key ของ Careerjet ผูกกับ IP — ต้องเพิ่ม IP ของ VPS (`179.197.241.29`) ในบัญชี Careerjet Partner
อาการถ้ายังไม่เพิ่ม: ค้นหางานไม่ได้ และ log มี `Careerjet API error: { status: 403, error: 'Unauthorized access from IP ...' }`

### Google sign-in

Google Cloud Console → OAuth client:

- Authorized JavaScript origins: `https://learnace.tech`
- Authorized redirect URIs: `https://learnace.tech/api/auth/oauth/google/callback`
- (คง `http://localhost:5173` ไว้สำหรับ dev)

Google Auth Platform → **Branding**: App name, support email, home page `https://learnace.tech`, privacy policy `https://learnace.tech/privacy`, authorized domain `learnace.tech` — **ไม่ใส่โลโก้** (ใส่แล้ว Google บังคับตรวจหลายวัน) → **Audience** → Publish app
ขอแค่ `openid email profile` จึงไม่ต้องรอ Google ตรวจสอบ — รายละเอียดเพิ่ม: `backend/docs/OAUTH_SETUP.md`

### ตั้งผู้ดูแลระบบ (ADMIN)

สมัครบัญชีบนเว็บจริงก่อน (หน้า admin ใช้อีเมล + รหัสผ่าน) แล้วบน VPS:

```bash
cd ~/ai-cv-analyzer
docker compose exec mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE" -e "UPDATE users SET role = \"ADMIN\" WHERE email = \"you@example.com\"; SELECT id, email, role FROM users WHERE email = \"you@example.com\";"'
```

หน้า admin: `https://learnace.tech/admin/` — คนต่อไปให้ admin ใช้ **Promote by email** ในหน้า admin ได้เลย

### SSH: ใช้ key เท่านั้น

ตั้ง key ของเครื่องตัวเองก่อน (`ssh-keygen` → ส่ง `.pub` ขึ้น `~/.ssh/authorized_keys` → ทดสอบ `ssh -o PasswordAuthentication=no ...` ผ่าน) แล้วบน VPS:

```bash
cat > /etc/ssh/sshd_config.d/00-hardening.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
sshd -t && systemctl reload ssh
```

ชื่อไฟล์ขึ้นต้น `00-` ให้ชนะ `50-cloud-init.conf` (sshd ใช้ค่าแรกที่เจอ) — เข้าไม่ได้: hPanel → VPS → Browser terminal

### แจ้งเตือนเมื่อเว็บล่ม

UptimeRobot (ฟรี): HTTP(s) monitor → `https://learnace.tech/api/health` ทุก 5 นาที → แจ้งทางอีเมล
DB ล่ม = health ตอบ 503 = นับเป็น Down ด้วย (ไม่ครอบคลุม AI — เครื่อง Windows ปิดยังขึ้น Up)

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

## Security headers (Nginx)

ไฟล์ site ของ Nginx บน VPS ถูก certbot แก้เพิ่ม HTTPS ไปแล้ว — **อย่า copy `nginx.conf` ทับ** ให้ติดตั้ง header เป็นไฟล์แยกแทน:

```bash
cd ~/ai-cv-analyzer
curl -fsSLO https://raw.githubusercontent.com/THEBAOxCucumber/AI-CV-Analyzer/main/deploy/nginx-security.conf
cp nginx-security.conf /etc/nginx/conf.d/ai-cv-security.conf
sed -i 's/^\(\s*\)server_tokens [a-z]*;/\1server_tokens off;/' /etc/nginx/nginx.conf   # ซ่อนเลขเวอร์ชัน
nginx -t && systemctl reload nginx
curl -sI https://learnace.tech | grep -iE 'server|strict|x-frame|referrer|x-content|permissions'
```

ได้ HSTS, `X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy` และ `Server: nginx` (ไม่มีเลขเวอร์ชัน) — หน้า `/admin` ใช้ค่าที่แอปตั้งเอง (CSP เข้มกว่า)

## อัปเดต docker-compose.yml บน VPS

workflow Deploy อัปเดตเฉพาะ **image** — ไฟล์ `docker-compose.yml` บน VPS ไม่เปลี่ยนตาม เมื่อแก้ไฟล์นี้ใน repo ต้องดึงไปเอง:

```bash
cd ~/ai-cv-analyzer
cp docker-compose.yml docker-compose.yml.bak
curl -fsSLO https://raw.githubusercontent.com/THEBAOxCucumber/AI-CV-Analyzer/main/docker-compose.yml
docker compose config -q && docker compose up -d
```

`up -d` สร้าง container ที่ config เปลี่ยนใหม่ (เว็บสะดุดราว 20–30 วินาที) ข้อมูลใน volume ไม่หาย — ห้ามใช้ `down -v`
