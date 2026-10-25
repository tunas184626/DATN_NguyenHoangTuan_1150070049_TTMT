import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

export type ToastTone = 'success' | 'error' | 'info'

interface LoadingPanelProps {
  label?: string
  className?: string
}

interface ToastProps {
  title: string
  message?: string
  tone?: ToastTone
  actionLabel?: string
  onAction?: () => void
  onClose: () => void
  queuedCount?: number
}

interface RegionErrorProps {
  title?: string
  message: string
  onRetry?: () => void
  className?: string
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} aria-hidden="true" />
}

const TOAST_TONES = {
  success: {
    icon: CheckCircle2,
    border: 'border-emerald-200',
    iconColor: 'text-emerald-600',
  },
  error: {
    icon: AlertCircle,
    border: 'border-rose-200',
    iconColor: 'text-rose-600',
  },
  info: {
    icon: Info,
    border: 'border-sky-200',
    iconColor: 'text-sky-600',
  },
} as const

export function LoadingPanel({ label = 'Đang tải dữ liệu...', className = '' }: LoadingPanelProps) {
  return (
    <div
      className={`panel flex min-h-[320px] flex-col justify-center overflow-hidden p-6 ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">{label}</span>
      <div className="mx-auto w-full max-w-md animate-pulse space-y-4" aria-hidden="true">
        <Skeleton className="mx-auto h-4 w-36 !bg-water-100" />
        <Skeleton className="h-12 rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <p className="mt-5 text-center text-sm font-semibold text-slate-500">{label}</p>
    </div>
  )
}

export function RegionError({
  title = 'Không thể tải khu vực này',
  message,
  onRetry,
  className = '',
}: RegionErrorProps) {
  return (
    <section
      className={`panel flex min-h-[240px] flex-col items-center justify-center p-6 text-center ${className}`}
      role="alert"
    >
      <span className="mb-3 inline-flex rounded-full bg-rose-50 p-3 text-rose-600">
        <AlertCircle className="size-6" />
      </span>
      <h2 className="font-bold text-slate-800">{title}</h2>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-500">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="primary-btn mt-4">
          Thử lại
        </button>
      )}
    </section>
  )
}

export function Toast({
  title,
  message,
  tone = 'success',
  actionLabel,
  onAction,
  onClose,
  queuedCount = 0,
}: ToastProps) {
  const meta = TOAST_TONES[tone]
  const Icon = meta.icon

  return (
    <div
      className={`fixed bottom-[max(5rem,calc(env(safe-area-inset-bottom)+4.5rem))] left-3 right-3 z-[1600] flex items-start gap-3 rounded-xl border bg-white p-4 shadow-sm sm:bottom-5 sm:left-auto sm:right-5 sm:max-w-sm ${meta.border}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
    >
      <Icon className={`mt-0.5 size-5 shrink-0 ${meta.iconColor}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-slate-800">{title}</p>
          {queuedCount > 0 && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
              +{queuedCount}
            </span>
          )}
        </div>
        {message && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{message}</p>}
        {actionLabel && onAction && (
          <button type="button" className="mt-2 text-sm font-semibold text-water-700 hover:text-water-900" onClick={onAction}>
            {actionLabel}
          </button>
        )}
      </div>
      <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng thông báo">
        <X className="size-4" />
      </button>
    </div>
  )
}
