import {
  ArrowLeft,
  GraduationCap,
  Mail,
} from "lucide-react"

import {
  useEffect,
  useState,
  type ReactNode,
} from "react"

import {
  apiRequest,
} from "../services/api"

import {
  Link,
} from "react-router-dom"

import {
  useAuth,
} from "../hooks/useAuth"

import {
  useTheme,
} from "../hooks/useTheme"

import logoBlue from "../assets/brand/logo-blue.png"
import logoWhite from "../assets/brand/logo-white.png"

import "../styles/pages/PrivacyPage.css"

/*
 * นโยบายความเป็นส่วนตัว (PDPA)
 *
 * เนื้อหาอ้างอิงการทำงานจริงของระบบ ณ วันที่ปรับปรุง — แก้ระบบแล้วต้องแก้หน้านี้ด้วย เช่น
 *   - EMBEDDING_PROVIDER: หน้านี้อ่านจาก GET /api/privacy เอง (ส่วน "ข้อมูลที่ส่งไปยังบริการภายนอก")
 *   - ผู้ให้บริการค้นหางาน (ตอนนี้ Careerjet)
 *   - JWT_EXPIRES_IN, PASSWORD_RESET_OTP_TTL_MINUTES, rate limit window
 */
const UPDATED_AT = "15 ตุลาคม 2569"
const CONTACT_EMAIL = "phiriyaporn.y@ku.th"
const COURSE = "02739499 Information Technology Project"

const SECTIONS = [
  { id: "collect", title: "ข้อมูลที่เราเก็บ" },
  { id: "use", title: "เราใช้ข้อมูลทำอะไร" },
  { id: "share", title: "ข้อมูลที่ส่งไปยังบริการภายนอก" },
  { id: "retention", title: "ระยะเวลาการเก็บข้อมูล" },
  { id: "storage", title: "คุกกี้และข้อมูลในเบราว์เซอร์" },
  { id: "rights", title: "สิทธิ์ของคุณ" },
  { id: "security", title: "การรักษาความปลอดภัย" },
  { id: "contact", title: "ติดต่อเรา" },
]

function Section({
  id,
  number,
  children,
}: Readonly<{
  id: string
  number: number
  children: ReactNode
}>) {
  const title = SECTIONS.find((section) => section.id === id)?.title

  return (
    <section
      id={id}
      className="privacy-section"
      aria-labelledby={`${id}-title`}
    >
      <h2 id={`${id}-title`}>
        <span aria-hidden="true">{number}</span>
        {title}
      </h2>

      {children}
    </section>
  )
}

/*
 * ข้อความ Resume สร้าง vector ที่ไหน — อ่านจากการตั้งค่าจริงของเซิร์ฟเวอร์
 * โหลดไม่สำเร็จ / ยังไม่ได้คำตอบ → แสดงแบบเปิดเผยมากที่สุด (ส่งไป Gemini)
 */
function useEmbeddingIsLocal(): boolean {
  const [isLocal, setIsLocal] =
    useState(false)

  useEffect(() => {
    let cancelled = false

    apiRequest<{ data: { embeddingProvider: string } }>("/privacy")
      .then((response) => {
        if (!cancelled) {
          setIsLocal(response.data.embeddingProvider === "ollama")
        }
      })
      .catch(() => {
        /* คงค่าแบบเปิดเผย */
      })

    return () => {
      cancelled = true
    }
  }, [])

  return isLocal
}

export function PrivacyPage() {
  const { isAuthenticated } = useAuth()
  const { resolvedTheme } = useTheme()
  const embeddingIsLocal = useEmbeddingIsLocal()

  const backTo = isAuthenticated ? "/settings" : "/sign-in"
  const backLabel = isAuthenticated ? "กลับไปหน้าตั้งค่า" : "กลับไปหน้าเข้าสู่ระบบ"

  return (
    <div className="privacy-page">
      <header className="privacy-topbar">
        <Link
          to={isAuthenticated ? "/dashboard" : "/sign-in"}
          aria-label="AI Resume Analyzer"
        >
          <img
            className="privacy-topbar__logo"
            src={resolvedTheme === "dark" ? logoWhite : logoBlue}
            alt="AI Resume Analyzer"
            width={480}
            height={208}
          />
        </Link>

        <Link
          className="privacy-back"
          to={backTo}
        >
          <ArrowLeft size={17} aria-hidden="true" />
          <span className="privacy-back__label">{backLabel}</span>
        </Link>
      </header>

      <main className="privacy-main">
        <div className="privacy-hero">
          <p className="privacy-eyebrow">อัปเดตล่าสุด {UPDATED_AT}</p>

          <h1>นโยบายความเป็นส่วนตัว</h1>

          <p>
            AI Resume Analyzer ให้ความสำคัญกับข้อมูลส่วนบุคคลของคุณ
            หน้านี้อธิบายว่าเราเก็บข้อมูลอะไร ใช้อย่างไร ส่งต่อให้ใคร
            และคุณควบคุมข้อมูลของตัวเองได้อย่างไร
            ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
          </p>
        </div>

        <aside className="privacy-course" aria-label="ข้อมูลโครงงาน">
          <span className="privacy-course__icon" aria-hidden="true">
            <GraduationCap size={22} />
          </span>

          <div>
            <strong>
              เว็บไซต์นี้เป็นส่วนหนึ่งของรายวิชา {COURSE}
            </strong>

            <p>
              จัดทำเพื่อการศึกษา ไม่ใช่บริการเชิงพาณิชย์
              ระบบอยู่ในช่วงพัฒนาและทดสอบ
              โปรดหลีกเลี่ยงการอัปโหลดข้อมูลที่อ่อนไหวเกินจำเป็น
              เช่น เลขบัตรประชาชน หรือข้อมูลสุขภาพ
            </p>
          </div>
        </aside>

        <nav className="privacy-toc" aria-label="สารบัญ">
          <h2>สารบัญ</h2>

          <ol>
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`}>{section.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <Section id="collect" number={1}>
          <dl className="privacy-list">
            <dt>ข้อมูลบัญชี</dt>
            <dd>
              ชื่อ นามสกุล อีเมล และรหัสผ่าน (เก็บแบบเข้ารหัสทางเดียว
              ไม่มีใครอ่านรหัสผ่านจริงได้ รวมถึงผู้ดูแลระบบ)
              วันที่สมัครและเวลาเข้าสู่ระบบล่าสุด
              หากเข้าสู่ระบบด้วย Google เราได้รับเฉพาะชื่อและอีเมลจาก Google
              ไม่ได้รับรหัสผ่าน Google ของคุณ
            </dd>

            <dt>ข้อมูลโปรไฟล์ (กรอกเองหรือไม่กรอกก็ได้)</dt>
            <dd>
              เบอร์โทรศัพท์ จังหวัด ตำแหน่ง/หัวข้อโปรไฟล์ แนะนำตัว
              ข้อมูลการศึกษา ตำแหน่งงานที่สนใจ และระดับประสบการณ์
            </dd>

            <dt>Resume</dt>
            <dd>
              ไฟล์ PDF ที่อัปโหลด ข้อความที่ดึงออกมาจากไฟล์
              ข้อความที่แบ่งเป็นส่วนย่อย และตัวเลขแทนความหมายของข้อความ (vector)
              ที่ใช้ค้นหาเนื้อหาที่เกี่ยวข้องตอนวิเคราะห์
            </dd>

            <dt>ผลการวิเคราะห์</dt>
            <dd>
              คะแนน จุดแข็ง จุดที่ควรปรับปรุง คำแนะนำ
              และรายละเอียดงานที่คุณใช้เปรียบเทียบ (ตำแหน่ง บริษัท รายละเอียดงาน)
            </dd>

            <dt>ข้อมูลทางเทคนิค</dt>
            <dd>
              หมายเลข IP ใช้จำกัดจำนวนครั้งการเข้าสู่ระบบผิด
              เพื่อป้องกันการเดารหัสผ่าน
              และส่งให้ผู้ให้บริการค้นหางานตามที่ระบุในข้อ 3
            </dd>
          </dl>
        </Section>

        <Section id="use" number={2}>
          <ul className="privacy-bullets">
            <li>ยืนยันตัวตนและให้คุณเข้าถึงบัญชีของตัวเอง</li>
            <li>วิเคราะห์ Resume และเปรียบเทียบกับตำแหน่งงานที่คุณเลือก</li>
            <li>ค้นหาตำแหน่งงานตามคำค้นของคุณ</li>
            <li>ส่งรหัส OTP สำหรับตั้งรหัสผ่านใหม่ และแจ้งเตือนเมื่อรหัสผ่านถูกเปลี่ยน</li>
            <li>ป้องกันการใช้งานผิดปกติ และดูแลให้ระบบทำงานได้</li>
          </ul>

          <p className="privacy-note">
            เราไม่ขายข้อมูล ไม่ใช้ข้อมูลเพื่อโฆษณา
            และไม่นำ Resume ของคุณไปฝึกโมเดล AI
          </p>
        </Section>

        <Section id="share" number={3}>
          {embeddingIsLocal ? (
            <p>
              <strong>Resume ของคุณประมวลผลบนเครื่องเซิร์ฟเวอร์ของโครงงานทั้งหมด</strong>{" "}
              ทั้งการวิเคราะห์ (โมเดล qwen3) และการสร้าง vector (โมเดล qwen3-embedding) ผ่าน Ollama
              เนื้อหา Resume จึงไม่ถูกส่งไปยังบริการ AI ภายนอก
            </p>
          ) : (
            <p>
              <strong>การวิเคราะห์ด้วย AI ทำงานบนเครื่องเซิร์ฟเวอร์ของโครงงาน</strong>{" "}
              (โมเดล qwen3 ผ่าน Ollama) เนื้อหา Resume ที่ใช้วิเคราะห์จึงไม่ถูกส่งไปยังบริการ AI ภายนอก
              ยกเว้นการสร้าง vector ตามตารางด้านล่าง
            </p>
          )}

          <div className="privacy-table-wrap">
            <table className="privacy-table">
              <thead>
                <tr>
                  <th scope="col">บริการ</th>
                  <th scope="col">ข้อมูลที่ส่ง</th>
                  <th scope="col">เมื่อไร / เพื่ออะไร</th>
                </tr>
              </thead>

              <tbody>
                {!embeddingIsLocal && (
                  <tr>
                    <td>Google Gemini API</td>
                    <td>ข้อความใน Resume (แบ่งเป็นส่วนย่อย)</td>
                    <td>หลังอัปโหลด — แปลงข้อความเป็น vector สำหรับค้นหาเนื้อหาที่เกี่ยวข้อง</td>
                  </tr>
                )}

                <tr>
                  <td>Careerjet</td>
                  <td>คำค้นหา หมายเลข IP และข้อมูลเบราว์เซอร์ (user agent)</td>
                  <td>เมื่อค้นหางาน — Careerjet กำหนดให้ส่ง IP และเบราว์เซอร์ของผู้ค้นหา</td>
                </tr>

                <tr>
                  <td>Google (เข้าสู่ระบบ)</td>
                  <td>คุณยืนยันตัวตนกับ Google โดยตรง</td>
                  <td>เฉพาะเมื่อเลือก “ดำเนินการต่อด้วย Google”</td>
                </tr>

                <tr>
                  <td>Gmail (SMTP)</td>
                  <td>อีเมล ชื่อ และรหัส OTP</td>
                  <td>เมื่อขอตั้งรหัสผ่านใหม่ หรือเมื่อรหัสผ่านถูกเปลี่ยน</td>
                </tr>

                <tr>
                  <td>Google Fonts</td>
                  <td>หมายเลข IP (จากการโหลดไฟล์ฟอนต์)</td>
                  <td>ทุกครั้งที่เปิดเว็บไซต์</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p>
            บริการเหล่านี้ประมวลผลข้อมูลตามนโยบายของผู้ให้บริการแต่ละราย
            และอาจจัดเก็บข้อมูลไว้ในต่างประเทศ
          </p>
        </Section>

        <Section id="retention" number={4}>
          <ul className="privacy-bullets">
            <li>
              <strong>บัญชี โปรไฟล์ Resume และผลวิเคราะห์</strong> —
              เก็บจนกว่าคุณจะลบเอง เมื่อลบ Resume ไฟล์ PDF และ vector จะถูกลบไปด้วย
            </li>
            <li>
              <strong>เมื่อลบบัญชี</strong> — ข้อมูลทั้งหมดของคุณถูกลบทันที
              ระบบเก็บไว้เพียงบันทึกว่ามีการลบบัญชีเลขที่ใด พร้อมจำนวน Resume
              และผลวิเคราะห์ โดยไม่มีชื่อ อีเมล หรือ IP
            </li>
            <li><strong>รหัส OTP</strong> — หมดอายุภายใน 10 นาที</li>
            <li><strong>ตัวนับการเข้าสู่ระบบผิด</strong> — ล้างเองภายใน 15 นาที</li>
            <li><strong>การเข้าสู่ระบบแต่ละครั้ง</strong> — หมดอายุภายใน 15 นาที</li>
          </ul>
        </Section>

        <Section id="storage" number={5}>
          <p>
            เราไม่ใช้คุกกี้เพื่อติดตามหรือโฆษณา และไม่มีระบบวิเคราะห์สถิติผู้เข้าชม
            เบราว์เซอร์ของคุณเก็บข้อมูลบางอย่างไว้ในเครื่อง (localStorage) เพื่อให้ระบบทำงานได้:
          </p>

          <ul className="privacy-bullets">
            <li>รหัสยืนยันการเข้าสู่ระบบ (ลบออกเมื่อออกจากระบบ)</li>
            <li>ธีม ขนาดตัวอักษร และการย่อ/ขยายเมนูที่คุณเลือก</li>
          </ul>
        </Section>

        <Section id="rights" number={6}>
          <p>คุณใช้สิทธิ์ตาม PDPA ได้เองในหน้า <strong>ตั้งค่า</strong>:</p>

          <dl className="privacy-list">
            <dt>เข้าถึงและขอรับสำเนาข้อมูล</dt>
            <dd>“ดาวน์โหลดข้อมูลของฉัน” ได้ไฟล์ JSON ของบัญชี โปรไฟล์ Resume และผลวิเคราะห์ทั้งหมด</dd>

            <dt>แก้ไขข้อมูล</dt>
            <dd>แก้ไขโปรไฟล์และเปลี่ยนรหัสผ่านได้ตลอดเวลา</dd>

            <dt>ลบข้อมูล</dt>
            <dd>ลบ Resume หรือผลวิเคราะห์ทีละรายการ หรือ “ลบบัญชี” เพื่อลบข้อมูลทั้งหมด</dd>

            <dt>สิทธิ์อื่น</dt>
            <dd>
              เช่น คัดค้านหรือขอให้ระงับการใช้ข้อมูล ติดต่อเราตามข้อ 8
              และหากเห็นว่าข้อมูลถูกใช้ไม่ถูกต้อง
              คุณมีสิทธิ์ร้องเรียนต่อสำนักงานคณะกรรมการคุ้มครองข้อมูลส่วนบุคคล (สคส.)
            </dd>
          </dl>
        </Section>

        <Section id="security" number={7}>
          <ul className="privacy-bullets">
            <li>รหัสผ่านเข้ารหัสแบบทางเดียว (bcrypt)</li>
            <li>จำกัดจำนวนครั้งการเข้าสู่ระบบผิด และยืนยันตัวตนทุกคำขอ</li>
            <li>ผู้ใช้แต่ละคนเข้าถึงได้เฉพาะ Resume และผลวิเคราะห์ของตัวเอง</li>
            <li>
              ผู้ดูแลระบบเห็นชื่อ อีเมล ชื่อไฟล์ คะแนน และสถานะงานวิเคราะห์ เพื่อดูแลระบบ
              ทุกการกระทำของผู้ดูแลถูกบันทึกไว้ตรวจสอบย้อนหลัง
            </li>
          </ul>

          <p className="privacy-note">
            ไม่มีระบบใดปลอดภัยได้ 100% และระบบนี้เป็นโครงงานการศึกษา
            โปรดใช้รหัสผ่านที่ไม่ซ้ำกับบริการอื่น
          </p>
        </Section>

        <Section id="contact" number={8}>
          <p>
            หากมีคำถามเกี่ยวกับข้อมูลส่วนบุคคล หรือต้องการใช้สิทธิ์ที่ทำเองในระบบไม่ได้
            ติดต่อผู้จัดทำโครงงาน:
          </p>

          <a
            className="privacy-contact"
            href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("ข้อมูลส่วนบุคคล — AI Resume Analyzer")}`}
          >
            <Mail size={18} aria-hidden="true" />
            {CONTACT_EMAIL}
          </a>

          <p className="privacy-note">
            หากนโยบายนี้มีการเปลี่ยนแปลง เราจะปรับวันที่ “อัปเดตล่าสุด” ด้านบน
          </p>
        </Section>
      </main>

      <footer className="privacy-footer">
        เว็บไซต์นี้เป็นส่วนหนึ่งของรายวิชา {COURSE}
      </footer>
    </div>
  )
}
