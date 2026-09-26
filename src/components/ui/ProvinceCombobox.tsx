import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react"

import type {
  Province,
} from "../../services/location.service"

import "../../styles/components/ProvinceCombobox.css"

interface ProvinceComboboxProps {
  labelId: string
  value: string
  provinces: Province[]
  isLoading?: boolean
  placeholder?: string
  onChange: (value: string) => void
}

function matchesQuery(
  province: Province,
  query: string,
): boolean {
  const normalized =
    query.trim().toLowerCase()

  if (!normalized) {
    return true
  }

  return (
    province.nameTh.includes(normalized) ||
    province.nameEn
      .toLowerCase()
      .includes(normalized)
  )
}

function findExactProvince(
  provinces: Province[],
  text: string,
): Province | undefined {
  const normalized =
    text.trim().toLowerCase()

  return provinces.find(
    (province) =>
      province.nameTh === text.trim() ||
      province.nameEn.toLowerCase() ===
        normalized,
  )
}

/*
 * ช่องเลือกจังหวัด พิมพ์เพื่อค้นหา (ไทย/อังกฤษ)
 * ต้องเลือกจากรายการ; ลบจนว่าง = ไม่ระบุ
 */
export function ProvinceCombobox({
  labelId,
  value,
  provinces,
  isLoading = false,
  placeholder = "พิมพ์เพื่อค้นหาจังหวัด",
  onChange,
}: ProvinceComboboxProps) {
  const listboxId = useId()

  const listRef =
    useRef<HTMLUListElement>(null)

  const [inputText, setInputText] =
    useState(value)

  const [query, setQuery] =
    useState("")

  const [isOpen, setIsOpen] =
    useState(false)

  const [activeIndex, setActiveIndex] =
    useState(0)

  /*
   * value เปลี่ยนจากภายนอก
   * (โหลด/บันทึก profile)
   */
  const [syncedValue, setSyncedValue] =
    useState(value)

  if (value !== syncedValue) {
    setSyncedValue(value)
    setInputText(value)
  }

  const filtered = useMemo(
    () =>
      provinces.filter((province) =>
        matchesQuery(province, query),
      ),
    [provinces, query],
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    listRef.current
      ?.querySelector<HTMLElement>(
        `[data-index="${activeIndex}"]`,
      )
      ?.scrollIntoView({
        block: "nearest",
      })
  }, [activeIndex, isOpen])

  function selectProvince(
    province: Province,
  ) {
    onChange(province.nameTh)
    setInputText(province.nameTh)
    setQuery("")
    setIsOpen(false)
  }

  function openList() {
    setQuery("")
    setActiveIndex(0)
    setIsOpen(true)
  }

  /*
   * ออกจากช่องโดยไม่ได้เลือก
   * ว่าง → ไม่ระบุ
   * ตรงชื่อจังหวัด → เลือกให้
   * อื่นๆ → กลับค่าเดิม
   */
  function commitText() {
    setIsOpen(false)
    setQuery("")

    const text = inputText.trim()

    if (!text) {
      onChange("")
      setInputText("")
      return
    }

    const exact =
      findExactProvince(provinces, text)

    if (exact) {
      onChange(exact.nameTh)
      setInputText(exact.nameTh)
      return
    }

    setInputText(value)
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault()

        if (!isOpen) {
          openList()
          return
        }

        setActiveIndex((index) =>
          Math.min(
            index + 1,
            filtered.length - 1,
          ),
        )
        return

      case "ArrowUp":
        event.preventDefault()

        setActiveIndex((index) =>
          Math.max(index - 1, 0),
        )
        return

      case "Enter":
        /*
         * dropdown เปิด: เลือกจังหวัด
         * ไม่ submit form ที่ครอบอยู่
         */
        if (isOpen && filtered[activeIndex]) {
          event.preventDefault()
          selectProvince(
            filtered[activeIndex],
          )
        }
        return

      case "Escape":
        if (isOpen) {
          event.preventDefault()
          setIsOpen(false)
          setQuery("")
          setInputText(value)
        }
        return
    }
  }

  const activeOptionId =
    isOpen && filtered[activeIndex]
      ? `${listboxId}-${filtered[activeIndex].id}`
      : undefined

  return (
    <div className="province-combobox">
      <input
        type="text"
        role="combobox"
        autoComplete="off"
        aria-labelledby={labelId}
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        placeholder={
          isLoading
            ? "กำลังโหลดรายชื่อจังหวัด..."
            : placeholder
        }
        disabled={isLoading}
        value={inputText}
        onFocus={(event) => {
          event.target.select()
          openList()
        }}
        onChange={(event) => {
          setInputText(event.target.value)
          setQuery(event.target.value)
          setActiveIndex(0)
          setIsOpen(true)
        }}
        onBlur={commitText}
        onKeyDown={handleKeyDown}
      />

      {isOpen && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={labelId}
          className="province-combobox__list"
        >
          {filtered.length === 0 ? (
            <li className="province-combobox__empty">
              ไม่พบจังหวัดที่ค้นหา
            </li>
          ) : (
            filtered.map((province, index) => (
              <li
                key={province.id}
                id={`${listboxId}-${province.id}`}
                data-index={index}
                role="option"
                aria-selected={
                  province.nameTh === value
                }
                className={
                  index === activeIndex
                    ? "province-combobox__option province-combobox__option--active"
                    : "province-combobox__option"
                }
                /*
                 * กันช่องหลุดโฟกัส (blur)
                 * ก่อนคลิกเลือกเสร็จ
                 */
                onMouseDown={(event) => {
                  event.preventDefault()
                }}
                onMouseEnter={() =>
                  setActiveIndex(index)
                }
                onClick={() =>
                  selectProvince(province)
                }
              >
                <span>{province.nameTh}</span>
                <small>{province.nameEn}</small>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
