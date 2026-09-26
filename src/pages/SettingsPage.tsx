import {
  Link,
} from "react-router-dom"

import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react"

import {
  useAuth,
} from "../hooks/useAuth"

import {
  getProfile,
  updateProfile,
} from "../services/profile.service"

import {
  changePassword,
} from "../services/auth.service"

import {
  getResumes,
} from "../services/resume.service"

import {
  getResumeAnalysisHistory,
} from "../services/analysis.service"

import {
  ApiError,
} from "../services/api"

import {
  getThaiProvinces,
  type Province,
} from "../services/location.service"

import {
  ProvinceCombobox,
} from "../components/ui/ProvinceCombobox"

import type {
  EducationLevel,
  ExperienceLevel,
  UpdateProfileInput,
  UserProfile,
} from "../types/profile"

import type {
  Resume,
} from "../types/resume"

import {
  formatThaiDate,
  formatThaiDateTime,
} from "../utils/date-time"

import {
  formatFileSize,
} from "../utils/file-size"

import {
  getFontSize,
  setFontSize,
  type FontSize,
} from "../utils/appearance"

import "../styles/pages/SettingsPage.css"

interface ProfileForm {
  phone: string
  location: string
  headline: string
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
  location: "",
  headline: "",
  university: "",
  faculty: "",
  major: "",
  educationLevel: "",
  graduationYear: "",
  interestedPosition: "",
  experienceLevel: "",
  bio: "",
}

const FONT_SIZE_OPTIONS: Array<{
  value: FontSize
  label: string
}> = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
]

function toNullable(
  value: string,
): string | null {
  const trimmed = value.trim()

  return trimmed
    ? trimmed
    : null
}

function toForm(
  profile: UserProfile,
): ProfileForm {
  return {
    phone: profile.phone ?? "",
    location: profile.location ?? "",
    headline: profile.headline ?? "",
    university: profile.university ?? "",
    faculty: profile.faculty ?? "",
    major: profile.major ?? "",
    educationLevel:
      profile.educationLevel ?? "",
    graduationYear:
      profile.graduationYear !== null
        ? String(profile.graduationYear)
        : "",
    interestedPosition:
      profile.interestedPosition ?? "",
    experienceLevel:
      profile.experienceLevel ?? "",
    bio: profile.bio ?? "",
  }
}

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof ApiError
    ? error.message
    : fallback
}

function SectionTitle({
  number,
  title,
}: {
  number: number
  title: string
}) {
  return (
    <div className="settings-card__title">
      <span aria-hidden="true">
        {number}
      </span>

      <h2>{title}</h2>
    </div>
  )
}

function Message({
  type,
  children,
}: {
  type: "error" | "success"
  children: ReactNode
}) {
  return (
    <p
      className={`settings-message settings-message--${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      {children}
    </p>
  )
}

export function SettingsPage() {
  const { user } = useAuth()

  const [form, setForm] =
    useState<ProfileForm>(emptyForm)

  const [isLoading, setIsLoading] =
    useState(true)

  const [loadError, setLoadError] =
    useState("")

  const [isSaving, setIsSaving] =
    useState(false)

  /*
   * ข้อความแสดงในการ์ดที่กด Save
   */
  const [saveResult, setSaveResult] =
    useState<{
      card: "profile" | "preferences"
      type: "error" | "success"
      message: string
    } | null>(null)

  const [passwordForm, setPasswordForm] =
    useState({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    })

  const [isChangingPassword, setIsChangingPassword] =
    useState(false)

  const [passwordResult, setPasswordResult] =
    useState<{
      type: "error" | "success"
      message: string
    } | null>(null)

  const [fontSize, setFontSizeState] =
    useState<FontSize>(getFontSize)

  const [resumes, setResumes] =
    useState<Resume[]>([])

  const [isExporting, setIsExporting] =
    useState(false)

  const [exportError, setExportError] =
    useState("")

  const [provinces, setProvinces] =
    useState<Province[]>([])

  const [
    provinceLoadFailed,
    setProvinceLoadFailed,
  ] = useState(false)

  /*
   * แยกจาก loadSettings
   * API จังหวัดล่ม หน้ายังใช้งานได้
   */
  useEffect(() => {
    let cancelled = false

    getThaiProvinces()
      .then((result) => {
        if (!cancelled) {
          setProvinces(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProvinceLoadFailed(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      try {
        const [
          profileResponse,
          resumesResponse,
        ] = await Promise.all([
          getProfile(),
          getResumes(),
        ])

        if (cancelled) {
          return
        }

        setForm(
          toForm(
            profileResponse.data.profile,
          ),
        )

        setResumes(
          resumesResponse.data.resumes,
        )
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            getErrorMessage(
              error,
              "ไม่สามารถโหลดข้อมูลโปรไฟล์ได้",
            ),
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadSettings()

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

    setSaveResult(null)
  }

  /*
   * Profile และ Preferences
   * บันทึกข้อมูลโปรไฟล์ทั้งชุด
   * (PUT /profile รับทุก field)
   */
  async function handleSaveProfile(
    event: FormEvent<HTMLFormElement>,
    card: "profile" | "preferences",
  ) {
    event.preventDefault()

    setSaveResult(null)

    const phone = form.phone.trim()

    if (
      phone &&
      !/^0[0-9]{8,9}$/.test(phone)
    ) {
      setSaveResult({
        card,
        type: "error",
        message:
          "เบอร์โทรศัพท์ต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก",
      })
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
        !Number.isInteger(graduationYear) ||
        graduationYear < 1950 ||
        graduationYear > currentYear + 10
      ) {
        setSaveResult({
          card,
          type: "error",
          message:
            "กรุณาระบุปีที่จบการศึกษาให้ถูกต้อง",
        })
        return
      }
    }

    const payload: UpdateProfileInput = {
      phone: toNullable(form.phone),
      location: toNullable(form.location),
      headline: toNullable(form.headline),
      university: toNullable(form.university),
      faculty: toNullable(form.faculty),
      major: toNullable(form.major),
      educationLevel:
        form.educationLevel || null,
      graduationYear,
      interestedPosition:
        toNullable(form.interestedPosition),
      experienceLevel:
        form.experienceLevel || null,
      bio: toNullable(form.bio),
    }

    try {
      setIsSaving(true)

      const response =
        await updateProfile(payload)

      setForm(
        toForm(response.data.profile),
      )

      setSaveResult({
        card,
        type: "success",
        message: "บันทึกข้อมูลเรียบร้อยแล้ว",
      })
    } catch (error) {
      setSaveResult({
        card,
        type: "error",
        message: getErrorMessage(
          error,
          "ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบข้อมูลอีกครั้ง",
        ),
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleChangePassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setPasswordResult(null)

    if (
      passwordForm.newPassword !==
      passwordForm.confirmPassword
    ) {
      setPasswordResult({
        type: "error",
        message:
          "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน",
      })
      return
    }

    try {
      setIsChangingPassword(true)

      await changePassword({
        currentPassword:
          passwordForm.currentPassword,
        newPassword:
          passwordForm.newPassword,
      })

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })

      setPasswordResult({
        type: "success",
        message: "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว",
      })
    } catch (error) {
      setPasswordResult({
        type: "error",
        message: getErrorMessage(
          error,
          "ไม่สามารถเปลี่ยนรหัสผ่านได้",
        ),
      })
    } finally {
      setIsChangingPassword(false)
    }
  }

  function handleFontSizeChange(
    size: FontSize,
  ) {
    setFontSize(size)
    setFontSizeState(size)
  }

  async function handleExportData() {
    setExportError("")

    try {
      setIsExporting(true)

      const [
        profileResponse,
        resumesResponse,
      ] = await Promise.all([
        getProfile(),
        getResumes(),
      ])

      const exportResumes =
        resumesResponse.data.resumes

      const histories =
        await Promise.all(
          exportResumes.map((resume) =>
            getResumeAnalysisHistory(
              resume.id,
            ),
          ),
        )

      const data = {
        exportedAt:
          new Date().toISOString(),
        user,
        profile:
          profileResponse.data.profile,
        resumes: exportResumes.map(
          (resume, index) => ({
            ...resume,
            analyses:
              histories[index].data.analyses,
          }),
        ),
      }

      const blob = new Blob(
        [JSON.stringify(data, null, 2)],
        { type: "application/json" },
      )

      const url =
        URL.createObjectURL(blob)

      const link =
        document.createElement("a")

      link.href = url
      link.download =
        `ai-resume-analyzer-export-${new Date()
          .toISOString()
          .slice(0, 10)}.json`

      link.click()

      URL.revokeObjectURL(url)
    } catch (error) {
      setExportError(
        getErrorMessage(
          error,
          "ไม่สามารถ Export ข้อมูลได้",
        ),
      )
    } finally {
      setIsExporting(false)
    }
  }

  const initials =
    `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`
      .toUpperCase()

  const storageUsed =
    resumes.reduce(
      (sum, resume) =>
        sum + resume.fileSize,
      0,
    )

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
        <h1>Settings</h1>

        <p>
          Manage your profile, preferences
          and account settings
        </p>
      </header>

      {loadError && (
        <Message type="error">
          {loadError}
        </Message>
      )}

      {/* 1. Profile Information */}
      <form
        className="settings-card"
        onSubmit={(event) => {
          void handleSaveProfile(
            event,
            "profile",
          )
        }}
      >
        <SectionTitle
          number={1}
          title="Profile Information"
        />

        <div className="profile-layout">
          <aside className="profile-layout__aside">
            <div
              className="profile-avatar"
              aria-hidden="true"
            >
              {initials || "?"}
            </div>

            <div className="account-status">
              <h3>Account Status</h3>

              <dl>
                <dt>Member since</dt>
                <dd>
                  {user?.createdAt
                    ? formatThaiDate(
                      user.createdAt,
                    )
                    : "—"}
                </dd>

                <dt>Last login</dt>
                <dd>
                  {user?.lastLoginAt
                    ? formatThaiDateTime(
                      user.lastLoginAt,
                    )
                    : "—"}
                </dd>
              </dl>
            </div>
          </aside>

          <div className="settings-grid">
            <label className="settings-field">
              <span>Full Name</span>

              <input
                value={
                  user
                    ? `${user.firstName} ${user.lastName}`
                    : ""
                }
                disabled
              />
            </label>

            <label className="settings-field">
              <span>Email</span>

              <input
                type="email"
                value={user?.email ?? ""}
                disabled
              />
            </label>

            <label className="settings-field">
              <span>Phone Number</span>

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

            {/*
              * div ไม่ใช่ label:
              * คลิกใน dropdown แล้ว label
              * จะดึงโฟกัสกลับไปที่ input
              */}
            <div className="settings-field">
              <span id="location-label">
                Location
              </span>

              {provinceLoadFailed ? (
                <>
                  <input
                    aria-labelledby="location-label"
                    maxLength={255}
                    placeholder="เช่น เชียงใหม่"
                    value={form.location}
                    onChange={(event) =>
                      updateField(
                        "location",
                        event.target.value,
                      )
                    }
                  />

                  <small>
                    โหลดรายชื่อจังหวัดไม่สำเร็จ
                    พิมพ์ชื่อจังหวัดเองได้
                  </small>
                </>
              ) : (
                <ProvinceCombobox
                  labelId="location-label"
                  value={form.location}
                  provinces={provinces}
                  isLoading={
                    provinces.length === 0
                  }
                  onChange={(value) =>
                    updateField(
                      "location",
                      value,
                    )
                  }
                />
              )}
            </div>

            <label className="settings-field settings-field--full">
              <span>Headline / Title</span>

              <input
                maxLength={255}
                placeholder="เช่น Backend Developer"
                value={form.headline}
                onChange={(event) =>
                  updateField(
                    "headline",
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="settings-field settings-field--full">
              <span>Bio</span>

              <textarea
                rows={4}
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
        </div>

        <p className="settings-note">
          ชื่อและ Email เป็นข้อมูลบัญชี
          จึงยังไม่สามารถแก้ไขจากหน้านี้ได้
        </p>

        {saveResult?.card === "profile" && (
          <Message type={saveResult.type}>
            {saveResult.message}
          </Message>
        )}

        <button
          type="submit"
          className="settings-button settings-button--primary settings-button--block"
          disabled={isSaving}
        >
          {isSaving
            ? "กำลังบันทึก..."
            : "Save Changes"}
        </button>
      </form>

      <div className="settings-columns">
        {/* 2. Preferences */}
        <form
          className="settings-card"
          onSubmit={(event) => {
            void handleSaveProfile(
              event,
              "preferences",
            )
          }}
        >
          <SectionTitle
            number={2}
            title="Preferences"
          />

          <div className="settings-grid">
            <label className="settings-field settings-field--full">
              <span>Target Job Role</span>

              <input
                maxLength={255}
                placeholder="เช่น Frontend Developer"
                value={form.interestedPosition}
                onChange={(event) =>
                  updateField(
                    "interestedPosition",
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="settings-field settings-field--full">
              <span>Experience Level</span>

              <select
                value={form.experienceLevel}
                onChange={(event) =>
                  updateField(
                    "experienceLevel",
                    event.target.value as
                      | ExperienceLevel
                      | "",
                  )
                }
              >
                <option value="">ไม่ระบุ</option>
                <option value="FRESH_GRADUATE">
                  นักศึกษาจบใหม่
                </option>
                <option value="JUNIOR">Junior</option>
                <option value="MID_LEVEL">
                  Mid Level
                </option>
                <option value="SENIOR">Senior</option>
              </select>
            </label>

            <label className="settings-field">
              <span>มหาวิทยาลัย</span>

              <input
                maxLength={255}
                value={form.university}
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

            <label className="settings-field settings-field--full">
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
              <span>ระดับการศึกษา</span>

              <select
                value={form.educationLevel}
                onChange={(event) =>
                  updateField(
                    "educationLevel",
                    event.target.value as
                      | EducationLevel
                      | "",
                  )
                }
              >
                <option value="">ไม่ระบุ</option>
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
              <span>ปีที่จบการศึกษา</span>

              <input
                type="number"
                min={1950}
                max={new Date().getFullYear() + 10}
                placeholder="2026"
                value={form.graduationYear}
                onChange={(event) =>
                  updateField(
                    "graduationYear",
                    event.target.value,
                  )
                }
              />
            </label>
          </div>

          {saveResult?.card === "preferences" && (
            <Message type={saveResult.type}>
              {saveResult.message}
            </Message>
          )}

          <button
            type="submit"
            className="settings-button settings-button--primary settings-button--block"
            disabled={isSaving}
          >
            {isSaving
              ? "กำลังบันทึก..."
              : "Save Changes"}
          </button>
        </form>

        {/* 3. Privacy & Security */}
        <form
          className="settings-card"
          onSubmit={(event) => {
            void handleChangePassword(event)
          }}
        >
          <SectionTitle
            number={3}
            title="Privacy & Security"
          />

          <h3 className="settings-subheading">
            Change Password
          </h3>

          <div className="settings-grid">
            <label className="settings-field settings-field--full">
              <span>Current Password</span>

              <input
                type="password"
                autoComplete="current-password"
                required
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    currentPassword:
                      event.target.value,
                  }))
                }
              />
            </label>

            <label className="settings-field settings-field--full">
              <span>New Password</span>

              <input
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    newPassword:
                      event.target.value,
                  }))
                }
              />

              <small>
                อย่างน้อย 8 ตัว มีตัวพิมพ์ใหญ่
                ตัวพิมพ์เล็ก และตัวเลข
              </small>
            </label>

            <label className="settings-field settings-field--full">
              <span>Confirm New Password</span>

              <input
                type="password"
                autoComplete="new-password"
                required
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((current) => ({
                    ...current,
                    confirmPassword:
                      event.target.value,
                  }))
                }
              />
            </label>
          </div>

          {passwordResult && (
            <Message type={passwordResult.type}>
              {passwordResult.message}
            </Message>
          )}

          <button
            type="submit"
            className="settings-button settings-button--secondary"
            disabled={isChangingPassword}
          >
            {isChangingPassword
              ? "กำลังเปลี่ยน..."
              : "Change Password"}
          </button>
        </form>

        {/* 4. Appearance */}
        <section className="settings-card">
          <SectionTitle
            number={4}
            title="Appearance"
          />

          <h3 className="settings-subheading">
            Font Size
          </h3>

          <div
            className="segmented"
            role="radiogroup"
            aria-label="Font Size"
          >
            {FONT_SIZE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={
                  fontSize === option.value
                }
                className={
                  fontSize === option.value
                    ? "segmented__option segmented__option--active"
                    : "segmented__option"
                }
                onClick={() =>
                  handleFontSizeChange(
                    option.value,
                  )
                }
              >
                {option.label}
              </button>
            ))}
          </div>

          <p className="settings-note">
            ใช้กับอุปกรณ์และเบราว์เซอร์นี้เท่านั้น
          </p>
        </section>

        {/* 5. Data & Storage */}
        <section className="settings-card">
          <SectionTitle
            number={5}
            title="Data & Storage"
          />

          <ul className="data-list">
            <li>
              <div>
                <strong>Manage Resume</strong>
                <span>
                  ดูหรือลบ Resume ที่อัปโหลด
                </span>
              </div>

              <Link
                className="settings-button settings-button--outline"
                to="/dashboard"
              >
                Manage
              </Link>
            </li>

            <li>
              <div>
                <strong>Analysis History</strong>
                <span>
                  ดูและจัดการผลการวิเคราะห์ที่ผ่านมา
                </span>
              </div>

              <Link
                className="settings-button settings-button--outline"
                to="/history"
              >
                Manage
              </Link>
            </li>

            <li>
              <div>
                <strong>Export My Data</strong>
                <span>
                  ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON
                </span>
              </div>

              <button
                type="button"
                className="settings-button settings-button--outline"
                disabled={isExporting}
                onClick={() => {
                  void handleExportData()
                }}
              >
                {isExporting
                  ? "กำลัง Export..."
                  : "Export"}
              </button>
            </li>
          </ul>

          {exportError && (
            <Message type="error">
              {exportError}
            </Message>
          )}

          <div className="storage-used">
            <span>Storage Used</span>

            <strong>
              {formatFileSize(storageUsed)}
              {" · "}
              {resumes.length} Resume
            </strong>
          </div>
        </section>
      </div>
    </main>
  )
}
