# ตั้งค่าล็อกอินด้วย Google

ระบบรองรับการล็อกอินด้วย Google แล้ว แต่จะเปิดใช้ได้ก็ต่อเมื่อใส่ **Client ID** และ **Client Secret** ใน `backend/.env` ถ้ายังไม่ใส่ ปุ่ม "ดำเนินการต่อด้วย Google" ในหน้า Sign In และ Register จะกดไม่ได้และขึ้นว่ายังไม่เปิดใช้งาน

## Redirect URI (ต้องตรงทุกตัวอักษร)

```
http://localhost:5173/api/auth/oauth/google/callback
```

URI ชี้ไปที่ Vite (พอร์ต 5173) ซึ่งส่งต่อ `/api` ไปที่ backend เบราว์เซอร์จึงอยู่โดเมนเดียวตลอดทั้ง flow

> **Tester ที่เข้าผ่าน Cloudflare tunnel:** URL ของ `trycloudflare.com` สุ่มใหม่ทุกครั้งที่เปิด tunnel จึงลงทะเบียนล่วงหน้าไม่ได้ ถ้าต้องให้ tester ใช้ปุ่มนี้ ต้องใช้ named tunnel ที่มีโดเมนคงที่ แล้วตั้ง `OAUTH_PUBLIC_BASE_URL` และ `FRONTEND_URL` เป็นโดเมนนั้น พร้อมเพิ่ม Redirect URI ของโดเมนนั้นใน Google ด้วย

---

## 1. สร้าง Client ID ใน Google Cloud

1. เข้า <https://console.cloud.google.com/> แล้วเลือกหรือสร้าง Project (เช่น `AI Resume Analyzer`)
2. ไปที่เมนู **APIs & Services → OAuth consent screen** (หรือ **Google Auth Platform → Branding**)
   - User type: **External**
   - กรอก App name, User support email และ Developer contact email
   - Scopes: ใช้ `openid`, `.../auth/userinfo.email` และ `.../auth/userinfo.profile` ซึ่งเป็นค่าพื้นฐาน ไม่ต้องขอตรวจ
   - ระหว่างทดสอบ (สถานะ **Testing**) ให้เพิ่มอีเมลของคนที่จะลองล็อกอินในหัวข้อ **Test users** (สูงสุด 100 คน) ถ้าจะเปิดให้ทุกคนใช้ ให้กด **Publish app**
3. ไปที่เมนู **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:5173`
   - Authorized redirect URIs: `http://localhost:5173/api/auth/oauth/google/callback`
4. กด Create แล้วคัดลอก **Client ID** และ **Client secret**

## 2. ใส่ค่าใน `backend/.env`

```env
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxx

# ไม่ต้องใส่ ถ้าใช้ที่ localhost:5173 (ค่าเริ่มต้น)
# OAUTH_PUBLIC_BASE_URL=http://localhost:5173
# FRONTEND_URL=http://localhost:5173
```

จากนั้นรีสตาร์ต backend ด้วย `Ctrl+C` แล้วรัน `npm run dev` ใหม่ ปุ่มจะเปิดใช้เอง

**อย่า commit ค่าเหล่านี้** ไว้ใน `backend/.env` เท่านั้น ห้ามใส่ใน `.env.example`

---

## พฤติกรรมของระบบ

| กรณี | ผล |
|---|---|
| ล็อกอินครั้งแรก และยังไม่มีบัญชีที่ใช้อีเมลนี้ | สร้างบัญชีใหม่ แล้วพาไปหน้า **ตั้งรหัสผ่าน** ใช้งานต่อไม่ได้จนกว่าจะตั้งเสร็จ |
| อีเมลตรงกับบัญชีที่สมัครด้วยรหัสผ่านไว้แล้ว | เชื่อมกับบัญชีเดิมอัตโนมัติ ข้อมูล Resume ยังอยู่ครบ |
| อีเมลยังไม่ได้ยืนยันกับ Google | ปฏิเสธ และไม่สร้างบัญชี (กันคนอ้างใช้อีเมลของคนอื่น) |
| ล็อกอินครั้งต่อไป | จำบัญชีจาก id ของ Google แม้ผู้ใช้จะเปลี่ยนอีเมลภายหลัง |
| ผู้ใช้กดยกเลิกที่หน้า Google | กลับมาหน้า Sign In พร้อมข้อความแจ้ง |

**ความปลอดภัย**
- `state` ใช้ได้ครั้งเดียว อายุ 10 นาที และใช้ PKCE เพิ่มอีกชั้น
- token จาก Google ไม่เคยไปถึงเบราว์เซอร์ เบราว์เซอร์ได้แค่ login code ที่ใช้ครั้งเดียว อายุ 60 วินาที อยู่หลัง `#` ของ URL แล้วนำไปแลกเป็น JWT
- ปลายทางของการ redirect มาจาก env เท่านั้น จึงไม่มีช่องโหว่ open redirect

## แก้ปัญหา

| อาการ | สาเหตุที่พบบ่อย |
|---|---|
| `redirect_uri_mismatch` | URI ในข้อ 1.3 ไม่ตรงกับที่ระบบใช้ (เช่น ลงทะเบียนเป็น `127.0.0.1` แต่ระบบใช้ `localhost`) หรือมี `/` ต่อท้าย |
| `access_denied` หรือ "app not verified" | อีเมลที่ใช้ทดสอบไม่อยู่ใน Test users |
| กลับมาแล้วขึ้น "ลิงก์เข้าสู่ระบบหมดอายุ" | ใช้เวลาที่หน้า Google นานเกิน 10 นาที หรือกด Back แล้วส่งซ้ำ ให้กดปุ่มเข้าสู่ระบบใหม่ |
