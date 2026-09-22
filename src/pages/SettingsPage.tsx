import {
  BriefcaseBusiness,
  GraduationCap,
  Save,
  Settings,
  UserRound,
} from "lucide-react"

import {
  useEffect,
  useState,
  type FormEvent,
} from "react"

import {
  useAuth,
} from "../hooks/useAuth"

import {
  getProfile,
  updateProfile,
} from "../services/profile.service"

import type {
  EducationLevel,
  ExperienceLevel,
  UpdateProfileInput,
} from "../types/profile"

import "../styles/pages/SettingsPage.css"

interface ProfileForm {
  phone: string
  university: string
  faculty: string
  major: string
  educationLevel: EducationLevel | ""
  graduationYear: string
  interestedPosition: string
  experienceLevel: ExperienceLevel | ""
  bio: string
}

const emptyForm: ProfileForm = {
  phone: "",
  university: "",
  faculty: "",
  major: "",
  educationLevel: "",
  graduationYear: "",
  interestedPosition: "",
  experienceLevel: "",
  bio: "",
}

function toNullable(
  value: string,
): string | null {
  const trimmed = value.trim()

  return trimmed
    ? trimmed
    : null
}

export function SettingsPage() {
  const { user } = useAuth()

  const [form, setForm] =
    useState<ProfileForm>(emptyForm)

  const [isLoading, setIsLoading] =
    useState(true)

  const [isSaving, setIsSaving] =
    useState(false)

  const [error, setError] =
    useState("")

  const [success, setSuccess] =
    useState("")

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      try {
        const response =
          await getProfile()

        const profile =
          response.data.profile

        if (cancelled) {
          return
        }

        setForm({
          phone:
            profile.phone ?? "",
          university:
            profile.university ?? "",
          faculty:
            profile.faculty ?? "",
          major:
            profile.major ?? "",
          educationLevel:
            profile.educationLevel ?? "",
          graduationYear:
            profile.graduationYear !== null
              ? String(
                  profile.graduationYear,
                )
              : "",
          interestedPosition:
            profile.interestedPosition ??
            "",
          experienceLevel:
            profile.experienceLevel ?? "",
          bio:
            profile.bio ?? "",
        })
      } catch {
        if (!cancelled) {
          setError(
            "ไม่สามารถโหลดข้อมูลโปรไฟล์ได้",
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [])

  function updateField<
    K extends keyof ProfileForm,
  >(
    field: K,
    value: ProfileForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }))

    setSuccess("")
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setError("")
    setSuccess("")

    const phone =
      form.phone.trim()

    if (
      phone &&
      !/^0[0-9]{8,9}$/.test(phone)
    ) {
      setError(
        "เบอร์โทรศัพท์ต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก",
      )
      return
    }

    let graduationYear:
      | number
      | null = null

    if (form.graduationYear.trim()) {
      graduationYear =
        Number(form.graduationYear)

      const currentYear =
        new Date().getFullYear()

      if (
        !Number.isInteger(
          graduationYear,
        ) ||
        graduationYear < 1950 ||
        graduationYear >
          currentYear + 10
      ) {
        setError(
          "กรุณาระบุปีที่จบการศึกษาให้ถูกต้อง",
        )
        return
      }
    }

    const payload: UpdateProfileInput = {
      phone:
        toNullable(form.phone),

      university:
        toNullable(
          form.university,
        ),

      faculty:
        toNullable(
          form.faculty,
        ),

      major:
        toNullable(form.major),

      educationLevel:
        form.educationLevel ||
        null,

      graduationYear,

      interestedPosition:
        toNullable(
          form.interestedPosition,
        ),

      experienceLevel:
        form.experienceLevel ||
        null,

      bio:
        toNullable(form.bio),
    }

    try {
      setIsSaving(true)

      const response =
        await updateProfile(
          payload,
        )

      const profile =
        response.data.profile

      setForm({
        phone:
          profile.phone ?? "",
        university:
          profile.university ?? "",
        faculty:
          profile.faculty ?? "",
        major:
          profile.major ?? "",
        educationLevel:
          profile.educationLevel ?? "",
        graduationYear:
          profile.graduationYear !== null
            ? String(
                profile.graduationYear,
              )
            : "",
        interestedPosition:
          profile.interestedPosition ??
          "",
        experienceLevel:
          profile.experienceLevel ?? "",
        bio:
          profile.bio ?? "",
      })

      setSuccess(
        "บันทึกข้อมูลเรียบร้อยแล้ว",
      )
    } catch {
      setError(
        "ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบข้อมูลอีกครั้ง",
      )
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <main className="settings-page">
        <div className="settings-page__state">
          กำลังโหลดข้อมูล...
        </div>
      </main>
    )
  }

  return (
    <main className="settings-page">
      <header className="settings-page__header">
        <div>
          <p className="settings-page__eyebrow">
            Settings
          </p>

          <h1>
            ตั้งค่าโปรไฟล์
          </h1>

          <p>
            จัดการข้อมูลส่วนตัว
            การศึกษา และเป้าหมายอาชีพ
          </p>
        </div>

        <div className="settings-page__header-icon">
          <Settings size={22} />
        </div>
      </header>

      {error && (
        <div
          className="settings-page__message settings-page__message--error"
          role="alert"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="settings-page__message settings-page__message--success"
          role="status"
        >
          {success}
        </div>
      )}

      <form
        onSubmit={(event) => {
          void handleSubmit(event)
        }}
      >
        <section className="settings-section">
          <div className="settings-section__heading">
            <div className="settings-section__icon">
              <UserRound size={20} />
            </div>

            <div>
              <h2>
                ข้อมูลบัญชี
              </h2>

              <p>
                ข้อมูลพื้นฐานของบัญชี
                และข้อมูลติดต่อ
              </p>
            </div>
          </div>

          <div className="settings-form-grid">
            <label className="settings-field">
              <span>ชื่อ</span>

              <input
                value={
                  user?.firstName ?? ""
                }
                disabled
              />
            </label>

            <label className="settings-field">
              <span>นามสกุล</span>

              <input
                value={
                  user?.lastName ?? ""
                }
                disabled
              />
            </label>

            <label className="settings-field">
              <span>Email</span>

              <input
                type="email"
                value={
                  user?.email ?? ""
                }
                disabled
              />
            </label>

            <label className="settings-field">
              <span>
                เบอร์โทรศัพท์
              </span>

              <input
                type="tel"
                inputMode="numeric"
                placeholder="0812345678"
                maxLength={10}
                value={form.phone}
                onChange={(event) =>
                  updateField(
                    "phone",
                    event.target.value,
                  )
                }
              />
            </label>
          </div>

          <p className="settings-section__note">
            ชื่อ นามสกุล และ Email
            เป็นข้อมูลบัญชี
            จึงยังไม่สามารถแก้ไขจากหน้านี้ได้
          </p>
        </section>

        <section className="settings-section">
          <div className="settings-section__heading">
            <div className="settings-section__icon">
              <GraduationCap size={20} />
            </div>

            <div>
              <h2>
                ข้อมูลการศึกษา
              </h2>

              <p>
                ข้อมูลที่ช่วยให้ระบบเข้าใจ
                พื้นฐานการศึกษาของคุณ
              </p>
            </div>
          </div>

          <div className="settings-form-grid">
            <label className="settings-field">
              <span>
                มหาวิทยาลัย
              </span>

              <input
                maxLength={255}
                value={
                  form.university
                }
                onChange={(event) =>
                  updateField(
                    "university",
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="settings-field">
              <span>คณะ</span>

              <input
                maxLength={255}
                value={form.faculty}
                onChange={(event) =>
                  updateField(
                    "faculty",
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="settings-field">
              <span>สาขาวิชา</span>

              <input
                maxLength={255}
                value={form.major}
                onChange={(event) =>
                  updateField(
                    "major",
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="settings-field">
              <span>
                ระดับการศึกษา
              </span>

              <select
                value={
                  form.educationLevel
                }
                onChange={(event) =>
                  updateField(
                    "educationLevel",
                    event.target
                      .value as
                      | EducationLevel
                      | "",
                  )
                }
              >
                <option value="">
                  ไม่ระบุ
                </option>

                <option value="HIGH_SCHOOL">
                  มัธยมศึกษา
                </option>

                <option value="VOCATIONAL">
                  ปวช. / ปวส.
                </option>

                <option value="BACHELOR">
                  ปริญญาตรี
                </option>

                <option value="MASTER">
                  ปริญญาโท
                </option>

                <option value="DOCTORATE">
                  ปริญญาเอก
                </option>
              </select>
            </label>

            <label className="settings-field">
              <span>
                ปีที่จบการศึกษา
              </span>

              <input
                type="number"
                min={1950}
                max={
                  new Date()
                    .getFullYear() +
                  10
                }
                placeholder="2026"
                value={
                  form.graduationYear
                }
                onChange={(event) =>
                  updateField(
                    "graduationYear",
                    event.target.value,
                  )
                }
              />
            </label>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-section__heading">
            <div className="settings-section__icon">
              <BriefcaseBusiness
                size={20}
              />
            </div>

            <div>
              <h2>
                เป้าหมายอาชีพ
              </h2>

              <p>
                ระบุตำแหน่งและระดับประสบการณ์
                ที่สนใจ
              </p>
            </div>
          </div>

          <div className="settings-form-grid">
            <label className="settings-field">
              <span>
                ตำแหน่งที่สนใจ
              </span>

              <input
                maxLength={255}
                placeholder="เช่น Frontend Developer"
                value={
                  form.interestedPosition
                }
                onChange={(event) =>
                  updateField(
                    "interestedPosition",
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="settings-field">
              <span>
                ระดับประสบการณ์
              </span>

              <select
                value={
                  form.experienceLevel
                }
                onChange={(event) =>
                  updateField(
                    "experienceLevel",
                    event.target
                      .value as
                      | ExperienceLevel
                      | "",
                  )
                }
              >
                <option value="">
                  ไม่ระบุ
                </option>

                <option value="FRESH_GRADUATE">
                  นักศึกษาจบใหม่
                </option>

                <option value="JUNIOR">
                  Junior
                </option>

                <option value="MID_LEVEL">
                  Mid Level
                </option>

                <option value="SENIOR">
                  Senior
                </option>
              </select>
            </label>

            <label className="settings-field settings-field--full">
              <span>
                แนะนำตัว
              </span>

              <textarea
                rows={6}
                maxLength={2000}
                placeholder="เขียนข้อมูลเกี่ยวกับตัวคุณ ประสบการณ์ และเป้าหมายในการทำงาน..."
                value={form.bio}
                onChange={(event) =>
                  updateField(
                    "bio",
                    event.target.value,
                  )
                }
              />

              <small>
                {form.bio.length}/2000
              </small>
            </label>
          </div>
        </section>

        <div className="settings-page__actions">
          <button
            type="submit"
            className="settings-page__save"
            disabled={isSaving}
          >
            <Save size={18} />

            {isSaving
              ? "กำลังบันทึก..."
              : "บันทึกการเปลี่ยนแปลง"}
          </button>
        </div>
      </form>
    </main>
  )
}