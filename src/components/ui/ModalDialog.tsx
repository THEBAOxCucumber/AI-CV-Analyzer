import {
  useEffect,
  useRef,
  type ReactNode,
} from "react"

import "../../styles/components/ModalDialog.css"

/*
 * Modal ด้วย <dialog> + showModal()
 * browser จัดการ focus trap / Esc / ::backdrop ให้
 *
 * dismissible=false (เช่น ระหว่างลบ) → ปิดด้วย Esc / คลิกพื้นหลังไม่ได้
 */
export function ModalDialog({
  labelledBy,
  dismissible,
  onClose,
  children,
}: {
  labelledBy: string
  dismissible: boolean
  onClose: () => void
  children: ReactNode
}) {
  const dialogRef =
    useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current

    if (dialog && !dialog.open) {
      dialog.showModal()
    }

    return () => {
      dialog?.close()
    }
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="modal-dialog"
      aria-labelledby={labelledBy}
      onCancel={(event) => {
        // Esc: ให้ React state เป็นคนปิด
        event.preventDefault()

        if (dismissible) {
          onClose()
        }
      }}
      onClick={(event) => {
        // คลิกนอกการ์ด = target เป็นตัว <dialog> เอง
        if (
          event.target === event.currentTarget &&
          dismissible
        ) {
          onClose()
        }
      }}
    >
      {children}
    </dialog>
  )
}
