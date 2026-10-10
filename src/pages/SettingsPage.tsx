import {
  Link,
} from "react-router-dom"

import {
  useEffect,
  useState,
  type SubmitEvent,
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
  deleteAccount,
} from "../services/auth.service"

import {
  ModalDialog,
} from "../components/ui/ModalDialog"

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
  mergeFields,
} from "../utils/form-merge"

import {
  getFontSize,
  setFontSize,
  type FontSize,
  type Theme,
} from "../utils/appearance"

import {
  useTheme,
} from "../hooks/useTheme"

import {
  Check,
  CheckCircle2,
  CircleAlert,
  Eye,
  EyeOff,
  LoaderCircle,
  Monitor,
  Moon,
  Sun,
  Trash2,
  type LucideIcon,
} from "lucide-react"

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

/*
 * field ของแต่ละการ์ด — กด Save การ์ดไหน บันทึกเฉพาะ field ของการ์ดนั้น
 * (PUT /profile รับทุก field → field การ์ดอื่นส่งค่าที่บันทึกไว้ล่าสุด
 *  ไม่ใช่ค่าที่ผู้ใช้แก้ค้างไว้)
 */
type ProfileCard = "profile" | "preferences"

const CARD_FIELDS: Record<ProfileCard, Array<keyof ProfileForm>> = {
  profile: ["phone", "location", "headline", "bio"],
  preferences: [
    "interestedPosition",
    "experienceLevel",
    "university",
    "faculty",
    "major",
    "educationLevel",
    "graduationYear",
  ],
}

const FONT_SIZE_OPTIONS: Array<{
  value: FontSize
  label: string
}> = [
  { value: "small", label: "เล็ก" },
  { value: "medium", label: "กลาง" },
  { value: "large", label: "ใหญ่" },
]

const THEME_OPTIONS: Array<{
  value: Theme
  label: string
  icon: LucideIcon
}> = [
  { value: "light", label: "สว่าง", icon: Sun },
  { value: "dark", label: "มืด", icon: Moon },
  { value: "system", label: "ตามระบบ", icon: Monitor },
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

/*
 * ตัวเลือกแบบปุ่มติดกัน — ใช้ radio จริง (ลูกศรเลือกได้, screen reader อ่านเป็นกลุ่ม)
 */
function SegmentedControl<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string
  name: string
  options: Array<{
    value: T
    label: string
    icon?: LucideIcon
  }>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <fieldset className="segmented-field">
      <legend className="settings-subheading">
        {legend}
      </legend>

      <div className="segmented">
        {options.map((option) => {
          const Icon = option.icon
          const isActive = value === option.value

          return (
            <label
              key={option.value}
              className={
                isActive
                  ? "segmented__option segmented__option--active"
                  : "segmented__option"
              }
            >
              <input
                type="radio"
                className="segmented__input"
                name={name}
                value={option.value}
                checked={isActive}
                onChange={() =>
                  onChange(option.value)
                }
              />

              {Icon && <Icon size={16} />}
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function Message({
  type,
  children,
}: {
  type: "error" | "success"
  children: ReactNode
}) {
  const Icon = type === "error"
    ? CircleAlert
    : CheckCircle2

  return (
    <p
      className={`settings-message settings-message--${type}`}
      role={type === "error" ? "alert" : "status"}
    >
      <Icon size={16} aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

function Spinner() {
  return (
    <LoaderCircle
      className="settings-spinner"
      size={16}
      aria-hidden="true"
    />
  )
}

/*
 * ปุ่ม Save: ระหว่างบันทึก = spinner
 * บันทึกสำเร็จ = เครื่องหมายถูก จนกว่าจะแก้ข้อมูลอีกครั้ง
 */
function SaveButton({
  isSaving,
  isSaved,
  disabled,
}: {
  isSaving: boolean
  isSaved: boolean
  disabled: boolean
}) {
  let label = "บันทึก"

  if (isSaving) {
    label = "กำลังบันทึก..."
  } else if (isSaved) {
    label = "บันทึกแล้ว"
  }

  return (
    <button
      type="submit"
      className={
        isSaved
          ? "settings-button settings-button--primary settings-button--block settings-button--saved"
          : "settings-button settings-button--primary settings-button--block"
      }
      disabled={disabled}
      aria-busy={isSaving || undefined}
    >
      {isSaving && <Spinner />}
      {isSaved && (
        <Check size={17} aria-hidden="true" />
      )}
      {label}
    </button>
  )
}

/*
 * ช่องรหัสผ่าน + ปุ่มแสดง/ซ่อน
 */
function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  maxLength,
  hint,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  autoComplete: string
  minLength?: number
  maxLength?: number
  hint?: string
}) {
  const [isVisible, setIsVisible] =
    useState(false)

  const toggleLabel = isVisible
    ? "ซ่อนรหัสผ่าน"
    : "แสดงรหัสผ่าน"

  return (
    <label className="settings-field settings-field--full">
      <span>{label}</span>

      <span className="settings-password">
        <input
          type={isVisible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={minLength}
          maxLength={maxLength}
          value={value}
          onChange={(event) =>
            onChange(event.target.value)
          }
        />

        <button
          type="button"
          className="settings-password__toggle"
          onClick={() => setIsVisible((visible) => !visible)}
          aria-label={toggleLabel}
          aria-pressed={isVisible}
          title={toggleLabel}
        >
          {isVisible
            ? <EyeOff size={18} />
            : <Eye size={18} />}
        </button>
      </span>

      {hint && <small>{hint}</small>}
    </label>
  )
}

function SettingsSkeleton() {
  return (
    <main
      className="settings-page"
      aria-busy="true"
    >
      <header className="settings-page__header">
        <h1>ตั้งค่า</h1>

        <p>
          จัดการโปรไฟล์ เป้าหมายงาน และบัญชีของคุณ
        </p>
      </header>

      <p className="sr-only" role="status">
        กำลังโหลดข้อมูล...
      </p>

      <div
        className="settings-card"
        aria-hidden="true"
      >
        <span className="skeleton" style={{ width: 220, height: 24 }} />

        <div className="profile-layout">
          <div className="profile-layout__aside">
            <span className="skeleton" style={{ width: 96, height: 96, borderRadius: "50%" }} />
            <span className="skeleton" style={{ width: "100%", height: 88 }} />
          </div>

          <div className="settings-grid">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="settings-skeleton__field">
                <span className="skeleton" style={{ width: "40%", height: 12 }} />
                <span className="skeleton" style={{ height: 46 }} />
              </div>
            ))}

            <div className="settings-skeleton__field settings-field--full">
              <span className="skeleton" style={{ width: "25%", height: 12 }} />
              <span className="skeleton" style={{ height: 96 }} />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export function SettingsPage() {
  const { user, logout } = useAuth()

  const [form, setForm] =
    useState<ProfileForm>(emptyForm)

  /*
   * ค่าที่บันทึกในระบบล่าสุด (ใช้เป็น field ของการ์ดที่ไม่ได้กด Save)
   */
  const [savedForm, setSavedForm] =
    useState<ProfileForm>(emptyForm)

  const [isDeleteOpen, setIsDeleteOpen] =
    useState(false)

  const [deleteForm, setDeleteForm] =
    useState({ currentPassword: "", confirmEmail: "" })

  const [isDeletingAccount, setIsDeletingAccount] =
    useState(false)

  const [deleteError, setDeleteError] =
    useState("")

  const [isLoading, setIsLoading] =
    useState(true)

  const [loadError, setLoadError] =
    useState("")

  /*
   * การ์ดที่กำลังบันทึก (ปุ่มอีกการ์ด disabled แต่ไม่หมุน)
   */
  const [savingCard, setSavingCard] =
    useState<ProfileCard | null>(null)

  const isSaving = savingCard !== null

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

  const {
    theme,
    setTheme,
  } = useTheme()

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

        const loaded = toForm(
          profileResponse.data.profile,
        )

        setForm(loaded)
        setSavedForm(loaded)

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
   * บันทึกเฉพาะ field ของการ์ดที่กด
   * field การ์ดอื่น = ค่าที่บันทึกไว้ล่าสุด (ที่แก้ค้างไว้ไม่ถูกบันทึกไปด้วย)
   */
  async function handleSaveProfile(
    event: SubmitEvent<HTMLFormElement>,
    card: ProfileCard,
  ) {
    event.preventDefault()

    setSaveResult(null)

    const values = mergeFields(
      savedForm,
      form,
      CARD_FIELDS[card],
    )

    const phone = values.phone.trim()

    if (
      phone &&
      !/^0\d{8,9}$/.test(phone)
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

    if (values.graduationYear.trim()) {
      graduationYear =
        Number(values.graduationYear)

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
      phone: toNullable(values.phone),
      location: toNullable(values.location),
      headline: toNullable(values.headline),
      university: toNullable(values.university),
      faculty: toNullable(values.faculty),
      major: toNullable(values.major),
      educationLevel:
        values.educationLevel || null,
      graduationYear,
      interestedPosition:
        toNullable(values.interestedPosition),
      experienceLevel:
        values.experienceLevel || null,
      bio: toNullable(values.bio),
    }

    try {
      setSavingCard(card)

      const response =
        await updateProfile(payload)

      const saved = toForm(response.data.profile)

      setSavedForm(saved)

      // อัปเดตเฉพาะการ์ดนี้ — การ์ดอื่นยังเก็บค่าที่แก้ค้างไว้
      setForm((current) =>
        mergeFields(current, saved, CARD_FIELDS[card]),
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
      setSavingCard(null)
    }
  }

  async function handleChangePassword(
    event: SubmitEvent<HTMLFormElement>,
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

  function closeDeleteDialog() {
    setIsDeleteOpen(false)
    setDeleteForm({ currentPassword: "", confirmEmail: "" })
    setDeleteError("")
  }

  async function handleDeleteAccount(
    event: SubmitEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setDeleteError("")

    try {
      setIsDeletingAccount(true)

      await deleteAccount(deleteForm)

      /*
       * โหลดหน้าใหม่ทั้งหน้า (ไม่ใช้ navigate):
       * - navigate ของ React Router เป็น transition → logout render ก่อน
       *   ProtectedRoute จึง redirect เองโดยไม่มีข้อความแจ้ง
       * - ล้าง state ในหน่วยความจำของบัญชีที่ถูกลบทั้งหมด
       */
      logout()
      window.location.replace("/sign-in?accountDeleted=1")
    } catch (error) {
      setDeleteError(
        getErrorMessage(
          error,
          "ไม่สามารถลบบัญชีได้ กรุณาลองใหม่อีกครั้ง",
        ),
      )
      setIsDeletingAccount(false)
    }
  }

  const canConfirmDelete =
    deleteForm.currentPassword.length > 0 &&
    deleteForm.confirmEmail.trim().toLowerCase() ===
      (user?.email ?? "").toLowerCase()

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
    return <SettingsSkeleton />
  }

  return (
    <main className="settings-page">
      <header className="settings-page__header">
        <h1>ตั้งค่า</h1>

        <p>
          จัดการโปรไฟล์ เป้าหมายงาน และบัญชีของคุณ
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
          title="ข้อมูลโปรไฟล์"
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
              <h3>สถานะบัญชี</h3>

              <dl>
                <dt>สมัครเมื่อ</dt>
                <dd>
                  {user?.createdAt
                    ? formatThaiDate(
                      user.createdAt,
                    )
                    : "—"}
                </dd>

                <dt>เข้าสู่ระบบล่าสุด</dt>
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
              <span>ชื่อ-นามสกุล</span>

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
              <span>อีเมล</span>

              <input
                type="email"
                value={user?.email ?? ""}
                disabled
              />
            </label>

            <label className="settings-field">
              <span>เบอร์โทรศัพท์</span>

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
                จังหวัด
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
              <span>ตำแหน่ง / หัวข้อโปรไฟล์</span>

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
              <span>แนะนำตัว</span>

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
          ชื่อและอีเมลเป็นข้อมูลบัญชี
          จึงยังไม่สามารถแก้ไขจากหน้านี้ได้
        </p>

        {saveResult?.card === "profile" && (
          <Message type={saveResult.type}>
            {saveResult.message}
          </Message>
        )}

        <SaveButton
          isSaving={savingCard === "profile"}
          isSaved={
            saveResult?.card === "profile" &&
            saveResult.type === "success"
          }
          disabled={isSaving}
        />
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
            title="เป้าหมายงานและการศึกษา"
          />

          <div className="settings-grid">
            <label className="settings-field settings-field--full">
              <span>ตำแหน่งงานที่สนใจ</span>

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
              <span>ระดับประสบการณ์</span>

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

          <SaveButton
            isSaving={savingCard === "preferences"}
            isSaved={
              saveResult?.card === "preferences" &&
              saveResult.type === "success"
            }
            disabled={isSaving}
          />
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
            title="ความปลอดภัย"
          />

          <h3 className="settings-subheading">
            เปลี่ยนรหัสผ่าน
          </h3>

          <div className="settings-grid">
            <PasswordField
              label="รหัสผ่านปัจจุบัน"
              autoComplete="current-password"
              value={passwordForm.currentPassword}
              onChange={(value) =>
                setPasswordForm((current) => ({
                  ...current,
                  currentPassword: value,
                }))
              }
            />

            <PasswordField
              label="รหัสผ่านใหม่"
              autoComplete="new-password"
              minLength={8}
              maxLength={72}
              hint="อย่างน้อย 8 ตัว มีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข"
              value={passwordForm.newPassword}
              onChange={(value) =>
                setPasswordForm((current) => ({
                  ...current,
                  newPassword: value,
                }))
              }
            />

            <PasswordField
              label="ยืนยันรหัสผ่านใหม่"
              autoComplete="new-password"
              value={passwordForm.confirmPassword}
              onChange={(value) =>
                setPasswordForm((current) => ({
                  ...current,
                  confirmPassword: value,
                }))
              }
            />
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
            aria-busy={isChangingPassword || undefined}
          >
            {isChangingPassword && <Spinner />}
            {isChangingPassword
              ? "กำลังเปลี่ยน..."
              : "เปลี่ยนรหัสผ่าน"}
          </button>
        </form>

        {/* 4. Appearance */}
        <section className="settings-card">
          <SectionTitle
            number={4}
            title="การแสดงผล"
          />

          <SegmentedControl
            legend="ธีม"
            name="theme"
            options={THEME_OPTIONS}
            value={theme}
            onChange={setTheme}
          />

          <SegmentedControl
            legend="ขนาดตัวอักษร"
            name="font-size"
            options={FONT_SIZE_OPTIONS}
            value={fontSize}
            onChange={handleFontSizeChange}
          />

          <p className="settings-note">
            ใช้กับอุปกรณ์และเบราว์เซอร์นี้เท่านั้น
          </p>
        </section>

        {/* 5. Data & Storage */}
        <section className="settings-card">
          <SectionTitle
            number={5}
            title="ข้อมูลและพื้นที่จัดเก็บ"
          />

          <ul className="data-list">
            <li>
              <div>
                <strong>จัดการ Resume</strong>
                <span>
                  ดูหรือลบ Resume ที่อัปโหลด
                </span>
              </div>

              <Link
                className="settings-button settings-button--outline"
                to="/dashboard"
              >
                จัดการ
              </Link>
            </li>

            <li>
              <div>
                <strong>ประวัติการวิเคราะห์</strong>
                <span>
                  ดูและจัดการผลการวิเคราะห์ที่ผ่านมา
                </span>
              </div>

              <Link
                className="settings-button settings-button--outline"
                to="/history"
              >
                จัดการ
              </Link>
            </li>

            <li>
              <div>
                <strong>ดาวน์โหลดข้อมูลของฉัน</strong>
                <span>
                  ดาวน์โหลดข้อมูลทั้งหมดเป็นไฟล์ JSON
                </span>
              </div>

              <button
                type="button"
                className="settings-button settings-button--outline"
                disabled={isExporting}
                aria-busy={isExporting || undefined}
                onClick={() => {
                  void handleExportData()
                }}
              >
                {isExporting && <Spinner />}
                {isExporting
                  ? "กำลังเตรียมไฟล์..."
                  : "ดาวน์โหลด"}
              </button>
            </li>
          </ul>

          {exportError && (
            <Message type="error">
              {exportError}
            </Message>
          )}

          <div className="storage-used">
            <span>พื้นที่ที่ใช้</span>

            <strong>
              {formatFileSize(storageUsed)}
              {" · "}
              {resumes.length} Resume
            </strong>
          </div>
        </section>
      </div>

      {/* 6. ลบบัญชี */}
      <section className="settings-card settings-card--danger">
        <SectionTitle
          number={6}
          title="ลบบัญชี"
        />

        <div className="danger-zone">
          <p>
            ลบบัญชีและข้อมูลทั้งหมดอย่างถาวร ได้แก่ โปรไฟล์ Resume ไฟล์ PDF
            และผลการวิเคราะห์ทุกครั้ง <strong>กู้คืนไม่ได้</strong>
            {" "}— แนะนำให้ดาวน์โหลดข้อมูลของคุณเก็บไว้ก่อน
          </p>

          <button
            type="button"
            className="settings-button settings-button--danger"
            onClick={() => setIsDeleteOpen(true)}
          >
            <Trash2 size={16} aria-hidden="true" />
            ลบบัญชี
          </button>
        </div>
      </section>

      {isDeleteOpen && (
        <ModalDialog
          labelledBy="delete-account-title"
          dismissible={!isDeletingAccount}
          onClose={closeDeleteDialog}
        >
          <form
            className="delete-account"
            onSubmit={(event) => {
              void handleDeleteAccount(event)
            }}
          >
            <div className="delete-account__icon" aria-hidden="true">
              <Trash2 size={22} />
            </div>

            <h2 id="delete-account-title">
              ลบบัญชีถาวร?
            </h2>

            <p>
              ข้อมูลทั้งหมดของ <strong>{user?.email}</strong> จะถูกลบทันทีและกู้คืนไม่ได้
            </p>

            <label className="settings-field">
              <span>รหัสผ่านปัจจุบัน</span>

              <input
                type="password"
                autoComplete="current-password"
                required
                value={deleteForm.currentPassword}
                onChange={(event) =>
                  setDeleteForm((current) => ({
                    ...current,
                    currentPassword: event.target.value,
                  }))
                }
              />
            </label>

            <label className="settings-field">
              <span>
                พิมพ์อีเมลของคุณเพื่อยืนยัน
              </span>

              <input
                type="email"
                autoComplete="off"
                spellCheck={false}
                placeholder={user?.email}
                required
                value={deleteForm.confirmEmail}
                onChange={(event) =>
                  setDeleteForm((current) => ({
                    ...current,
                    confirmEmail: event.target.value,
                  }))
                }
              />
            </label>

            {deleteError && (
              <Message type="error">
                {deleteError}
              </Message>
            )}

            <div className="delete-account__actions">
              <button
                type="button"
                className="settings-button settings-button--outline"
                disabled={isDeletingAccount}
                onClick={closeDeleteDialog}
              >
                ยกเลิก
              </button>

              <button
                type="submit"
                className="settings-button settings-button--danger"
                disabled={!canConfirmDelete || isDeletingAccount}
                aria-busy={isDeletingAccount || undefined}
              >
                {isDeletingAccount && <Spinner />}
                {isDeletingAccount
                  ? "กำลังลบ..."
                  : "ลบบัญชีถาวร"}
              </button>
            </div>
          </form>
        </ModalDialog>
      )}
    </main>
  )
}
