import { useState } from 'react'
import { Droplets, LoaderCircle, LockKeyhole, Mail } from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email hoặc mật khẩu không đúng.'
  if (/email not confirmed/i.test(message)) return 'Tài khoản chưa được xác nhận email.'
  if (/failed to fetch|network/i.test(message)) return 'Không thể kết nối máy chủ đăng nhập.'
  return 'Không thể đăng nhập. Vui lòng kiểm tra lại thông tin.'
}

export default function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Vui lòng nhập email và mật khẩu.')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await signIn(email.trim(), password)
    } catch (reason) {
      setError(friendlyAuthError(reason instanceof Error ? reason.message : ''))
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <section className="panel w-full max-w-md p-7 md:p-9">
        <div className="mb-7 flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-3 text-slate-600">
            <Droplets className="size-7" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-wide text-slate-900">WEBGIS</h1>
            <p className="text-sm text-slate-500">Quản lý hạ tầng cấp nước</p>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900">Đăng nhập hệ thống</h2>
          <p className="mt-1 text-sm text-slate-500">Sử dụng tài khoản nội bộ đã được cấp.</p>
        </div>

        {error && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="field-label">Email</span>
            <span className="relative block">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                autoComplete="email"
                autoFocus
                className="field-input h-11 pl-10"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ten@donvi.vn"
              />
            </span>
          </label>
          <label className="block">
            <span className="field-label">Mật khẩu</span>
            <span className="relative block">
              <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                autoComplete="current-password"
                className="field-input h-11 pl-10"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Nhập mật khẩu"
              />
            </span>
          </label>
          <button type="submit" disabled={submitting} className="primary-btn h-11 w-full disabled:cursor-wait disabled:opacity-60">
            {submitting ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <LockKeyhole className="mr-2 size-4" />}
            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>
      </section>
    </main>
  )
}
