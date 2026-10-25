import { useEffect, useId, useRef } from 'react'
import { Check, Focus, Map, Settings2, X } from 'lucide-react'

import type { MapExperience } from '../../utils/mapPreferences'

export function WorkspaceSettings({ value, onChange, onClose }: {
  value: MapExperience
  onChange: (value: MapExperience) => void
  onClose: () => void
}) {
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose }, [onClose])
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return }
      if (event.key !== 'Tab') return
      const elements = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, a[href]') ?? [])
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
        event.preventDefault(); first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus() }
  }, [])

  return <div className="fixed inset-0 z-[1450] flex items-center justify-center bg-slate-950/35 p-3 sm:p-6"
    onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
      className="flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl outline-none">
      <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-slate-100 p-2 text-slate-600"><Settings2 className="size-5" /></span>
          <div><h2 id={titleId} className="font-bold text-slate-900">Thiết lập bản đồ</h2><p className="mt-0.5 text-xs text-slate-500">Hiển thị khu vực xung quanh</p></div>
        </div>
        <button type="button" onClick={onClose} className="ghost-btn size-9 !px-0" aria-label="Đóng thiết lập"><X className="size-4" /></button>
      </header>
      <fieldset className="min-h-0 space-y-3 overflow-auto p-5">
        <legend className="sr-only">Chế độ bản đồ</legend>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Bản đồ</p>
        {([
          { key: 'focus', title: 'Focus bản đồ', icon: Focus, description: 'Giữ rõ khu vực có dữ liệu dự án, làm mờ nhẹ phần bản đồ nền xung quanh để nổi bật mạng lưới đang quản lý.' },
          { key: 'normal', title: 'Bình thường', icon: Map, description: 'Hiển thị bản đồ nền và khu vực xung quanh với độ rõ bình thường như hiện tại.' },
        ] as const).map(({ key, title, icon: Icon, description }) => <label key={key}
          className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-water-400 ${value === key ? 'border-water-500 bg-water-50/60' : 'border-slate-200 hover:bg-slate-50'}`}>
          <input className="sr-only" type="radio" name="map-experience" value={key} checked={value === key} onChange={() => onChange(key)} />
          <Icon className={`mt-0.5 size-5 shrink-0 ${value === key ? 'text-water-700' : 'text-slate-400'}`} />
          <span className="flex-1"><span className="block text-sm font-bold text-slate-800">{title}</span><span className="mt-1 block text-sm leading-relaxed text-slate-500">{description}</span></span>
          <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${value === key ? 'border-water-600 bg-water-600 text-white' : 'border-slate-300'}`} aria-hidden="true">{value === key && <Check className="size-3" />}</span>
        </label>)}
        <p className="pt-1 text-xs text-slate-500">Áp dụng ngay. Lựa chọn được ghi nhớ trên trình duyệt này.</p>
      </fieldset>
      <footer className="flex justify-end border-t border-slate-100 bg-slate-50/60 px-5 py-3"><button type="button" className="primary-btn min-h-10 px-6" onClick={onClose}>Xong</button></footer>
    </div>
  </div>
}
