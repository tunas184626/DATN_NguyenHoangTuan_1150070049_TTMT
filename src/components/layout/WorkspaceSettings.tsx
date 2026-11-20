import { useEffect, useId, useRef } from 'react'
import { Check, CheckCircle2, Eye, Focus, Map, Settings2, Sparkles, X } from 'lucide-react'

import type { MapExperience } from '../../utils/mapPreferences'

interface ModePreviewProps {
  mode: MapExperience
  active: boolean
}

function MapModeIllustration({ mode, active }: ModePreviewProps) {
  const isFocus = mode === 'focus'

  return (
    <div
      className={`relative h-40 w-full overflow-hidden rounded-xl border transition ${
        active ? 'border-water-300 shadow-inner' : 'border-slate-200/90'
      }`}
      aria-hidden="true"
    >
      {/* Base stylized street grid */}
      <svg viewBox="0 0 360 160" className="h-full w-full bg-[#eef3f7]">
        <defs>
          <radialGradient id={`focus-spot-${mode}`} cx="50%" cy="50%" r="48%">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0" />
            <stop offset="68%" stopColor="#0f172a" stopOpacity="0" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.48" />
          </radialGradient>
        </defs>

        {/* Urban blocks & roads */}
        <g opacity={isFocus ? 0.55 : 0.95}>
          <rect x="0" y="0" width="360" height="160" fill="#eef4f8" />
          <rect x="18" y="16" width="64" height="34" rx="4" fill="#e2e8f0" />
          <rect x="96" y="14" width="76" height="36" rx="4" fill="#dce6ef" />
          <rect x="190" y="16" width="68" height="32" rx="4" fill="#e2e8f0" />
          <rect x="274" y="14" width="68" height="40" rx="4" fill="#dce6ef" />
          <rect x="16" y="64" width="54" height="44" rx="4" fill="#dce6ef" />
          <rect x="284" y="68" width="58" height="42" rx="4" fill="#e2e8f0" />
          <rect x="20" y="120" width="72" height="28" rx="4" fill="#e2e8f0" />
          <rect x="256" y="120" width="84" height="28" rx="4" fill="#dce6ef" />

          {/* Road network */}
          <path
            d="M0 56 H360 M0 112 H360 M88 0 V160 M182 0 V160 M268 0 V160"
            stroke="#ffffff"
            strokeWidth="5"
          />
          <path
            d="M0 56 H360 M0 112 H360 M88 0 V160 M182 0 V160 M268 0 V160"
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          <path d="M12 146 L110 96 L236 44 L348 16" stroke="#ffffff" strokeWidth="4" fill="none" />
        </g>

        {/* Focus dimming mask outside project hull */}
        {isFocus && (
          <path
            fillRule="evenodd"
            d="M0 0 H360 V160 H0 Z M112 36 C138 24, 224 24, 250 42 C272 58, 272 104, 246 122 C216 140, 144 138, 114 122 C88 106, 90 50, 112 36 Z"
            fill="#0f172a"
            fillOpacity="0.34"
          />
        )}

        {/* Spotlight boundary ring in focus mode */}
        {isFocus && (
          <path
            d="M112 36 C138 24, 224 24, 250 42 C272 58, 272 104, 246 122 C216 140, 144 138, 114 122 C88 106, 90 50, 112 36 Z"
            fill="#ffffff"
            fillOpacity="0.22"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
        )}

        {/* Project water infrastructure vectors (always sharp!) */}
        <g>
          {/* Raw water lake polygon */}
          <path
            d="M122 52 Q144 38 166 54 Q174 72 152 80 Q124 80 122 52 Z"
            fill="#8b5cf6"
            fillOpacity="0.24"
            stroke="#7c3aed"
            strokeWidth="2"
          />
          {/* Supply zone polygon */}
          <path
            d="M188 74 L244 64 L252 106 L196 116 Z"
            fill="#22c55e"
            fillOpacity="0.16"
            stroke="#16a34a"
            strokeWidth="1.5"
            strokeDasharray="3 2"
          />
          {/* Pipeline network */}
          <path
            d="M148 64 L184 82 L226 88 L242 106"
            fill="none"
            stroke="#2563eb"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M184 82 L154 114 L122 108"
            fill="none"
            stroke="#1ca2c4"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Water plant node */}
          <circle cx="184" cy="82" r="6" fill="#166534" stroke="#ffffff" strokeWidth="2" />
          {/* Incident marker */}
          <circle cx="226" cy="88" r="5" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
        </g>
      </svg>

      <span
        className={`absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm ${
          isFocus
            ? 'border-sky-200 bg-slate-900/80 text-sky-100'
            : 'border-slate-200 bg-white/90 text-slate-700'
        }`}
      >
        {isFocus ? <Focus className="size-3" /> : <Eye className="size-3" />}
        {isFocus ? 'Làm nổi vùng mạng lưới' : 'Hiển thị nền đầy đủ'}
      </span>
    </div>
  )
}

export function WorkspaceSettings({ value, onChange, onClose }: {
  value: MapExperience
  onChange: (value: MapExperience) => void
  onClose: () => void
}) {
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)

  useEffect(() => {
    close.current = onClose
  }, [onClose])

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close.current()
        return
      }
      if (event.key !== 'Tab') return
      const elements = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input, a[href]') ?? [],
      )
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [])

  const options = [
    {
      key: 'focus',
      title: 'Focus bản đồ',
      badge: 'Tập trung mạng lưới',
      icon: Focus,
      description:
        'Giữ sắc nét khu vực có công trình & đường ống dự án, làm dịu nhẹ phần bản đồ nền xung quanh để quan sát hệ thống cấp nước rõ ràng hơn.',
      highlights: ['Nổi bật tuyến ống, nhà máy, hồ chứa', 'Giảm nhiễu thị giác vùng ngoài dự án'],
    },
    {
      key: 'normal',
      title: 'Bình thường',
      badge: 'Toàn cảnh tiêu chuẩn',
      icon: Map,
      description:
        'Hiển thị toàn bộ bản đồ nền đường phố hoặc vệ tinh cùng các vùng lân cận với độ tương phản và độ rõ đồng nhất như mặc định.',
      highlights: ['Quan sát đầy đủ địa hình & giao thông lân cận', 'Phù hợp khi đối chiếu ranh giới mở rộng'],
    },
  ] as const

  return (
    <div
      className="fixed inset-0 z-[1450] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-[2px] sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-2xl shadow-slate-900/20 outline-none"
      >
        {/* Header */}
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 via-white to-water-50/70 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-water-600 text-white shadow-sm">
              <Settings2 className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id={titleId} className="text-base font-bold text-slate-900 sm:text-lg">
                  Thiết lập bản đồ
                </h2>
                <span className="hidden rounded-full border border-water-200 bg-water-50 px-2.5 py-0.5 text-[11px] font-semibold text-water-800 sm:inline-flex">
                  {value === 'focus' ? 'Đang bật: Focus bản đồ' : 'Đang bật: Bình thường'}
                </span>
              </div>
              <p className="truncate text-xs text-slate-500">
                Chọn chế độ hiển thị khu vực xung quanh trên bản đồ địa lý
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ghost-btn !h-9 !w-9 !rounded-xl !p-0"
            aria-label="Đóng thiết lập"
          >
            <X className="size-4" />
          </button>
        </header>

        {/* Horizontal 2-column comparison body */}
        <fieldset className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <legend className="sr-only">Chế độ bản đồ</legend>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {options.map(({ key, title, badge, icon: Icon, description, highlights }) => {
              const active = value === key
              return (
                <label
                  key={key}
                  className={`group flex cursor-pointer flex-col gap-3 rounded-2xl border p-3.5 transition focus-within:ring-2 focus-within:ring-water-400 ${
                    active
                      ? 'border-water-500 bg-gradient-to-b from-water-50/70 to-white shadow-md shadow-water-900/5 ring-2 ring-water-100'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <input
                    className="sr-only"
                    type="radio"
                    name="map-experience"
                    value={key}
                    checked={active}
                    onChange={() => onChange(key)}
                  />

                  <MapModeIllustration mode={key} active={active} />

                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-xl border transition ${
                          active
                            ? 'border-water-200 bg-water-600 text-white shadow-sm'
                            : 'border-slate-200 bg-slate-100 text-slate-500 group-hover:bg-white'
                        }`}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <span className="block text-sm font-bold text-slate-900">{title}</span>
                        <span className="block text-[11px] font-medium text-slate-500">{badge}</span>
                      </div>
                    </div>

                    <span
                      className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border transition ${
                        active
                          ? 'border-water-600 bg-water-600 text-white shadow-sm'
                          : 'border-slate-300 bg-white group-hover:border-slate-400'
                      }`}
                      aria-hidden="true"
                    >
                      {active && <Check className="size-3.5" />}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-slate-600">{description}</p>

                  <ul className="mt-auto space-y-1 border-t border-slate-100 pt-2.5">
                    {highlights.map((item) => (
                      <li key={item} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                        <CheckCircle2
                          className={`size-3.5 shrink-0 ${active ? 'text-water-600' : 'text-slate-400'}`}
                        />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </label>
              )
            })}
          </div>
        </fieldset>

        {/* Footer */}
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/90 px-5 py-3">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Sparkles className="size-4 shrink-0 text-water-600" />
            <span>Áp dụng ngay khi chọn · Tự động ghi nhớ trên trình duyệt này</span>
          </div>

          <button type="button" className="primary-btn px-6 shadow-sm shadow-water-600/20" onClick={onClose}>
            Xong
          </button>
        </footer>
      </div>
    </div>
  )
}
