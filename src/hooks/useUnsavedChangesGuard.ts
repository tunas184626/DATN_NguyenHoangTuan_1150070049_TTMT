import { useCallback, useEffect } from 'react'

const UNSAVED_MESSAGE = 'Bạn có thay đổi chưa lưu. Bạn có chắc muốn đóng form?'

export function useUnsavedChangesGuard(isDirty: boolean, onClose: () => void) {
  const requestClose = useCallback(() => {
    if (!isDirty || window.confirm(UNSAVED_MESSAGE)) {
      onClose()
    }
  }, [isDirty, onClose])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') requestClose()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isDirty, requestClose])

  return requestClose
}
