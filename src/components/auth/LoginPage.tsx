import { useId, useRef, useState } from 'react'
import {
  AlertCircle, ArrowRight, Check, Droplets, Eye, EyeOff,
  LoaderCircle, LockKeyhole, Mail, Pause, Play,
} from 'lucide-react'
import { useAuth } from '../../auth/AuthContext'
import './LoginPage.css'

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) return 'Email hoặc mật khẩu không đúng.'
  if (/email not confirmed/i.test(message)) return 'Email chưa xác nhận. Liên hệ quản trị viên.'
  if (/failed to fetch|network/i.test(message)) return 'Lỗi kết nối. Vui lòng thử lại.'
  if (/too many requests|rate limit/i.test(message)) return 'Thử quá nhiều lần. Vui lòng đợi một lúc.'
  return 'Đăng nhập thất bại. Vui lòng thử lại.'
}

/** Decorative water network, drawn locally without external imagery. */
function WaterNetwork() {
  const id = useId()
  return (
    <svg className="login-network" viewBox="0 0 680 600" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="90" y1="490" x2="580" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4ce2b2" stopOpacity=".12" />
          <stop offset=".5" stopColor="#8ceecf" />
          <stop offset="1" stopColor="#b4f4db" stopOpacity=".3" />
        </linearGradient>
      </defs>
      <g stroke="#93d8bf" strokeOpacity=".13" strokeWidth="1">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M ${-180 + i * 25} 610 C ${140 + i * 20} ${420 - i * 24}, ${15 + i * 20} ${260 - i * 18}, ${280 + i * 24} ${220 - i * 22} S ${520 + i * 18} ${110 - i * 20}, 790 ${-20 - i * 24}`} />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <ellipse key={i} cx="555" cy="505" rx={80 + i * 30} ry={50 + i * 23} transform="rotate(-32 555 505)" />
        ))}
      </g>
      <g stroke="#8de5c6" strokeOpacity=".15" strokeWidth="14" strokeLinejoin="round">
        <path d="M85 450H200L290 360V280L390 180H515L580 115" />
        <path d="M290 360H440L520 440M200 450V525M390 180V85M290 280H155L100 225" />
      </g>
      <g stroke={`url(#${id})`} strokeWidth="2" strokeLinejoin="round">
        <path d="M85 450H200L290 360V280L390 180H515L580 115" />
        <path d="M290 360H440L520 440M200 450V525M390 180V85M290 280H155L100 225" />
      </g>
      <path className="login-flow" d="M85 450H200L290 360V280L390 180H515L580 115" stroke="#d3fff0" strokeWidth="3" strokeDasharray="6 150" />
      {[[200, 450], [290, 360], [290, 280], [390, 180], [515, 180], [440, 360]].map(([cx, cy], i) => (
        <g key={i}>
          <circle className="login-node-halo" cx={cx} cy={cy} r="15" fill="#7cf4c5" style={{ animationDelay: `${i * -.65}s`, transformOrigin: `${cx}px ${cy}px` }} />
          <circle cx={cx} cy={cy} r="5" fill="#b6f4dc" stroke="#0c493a" strokeWidth="2" />
        </g>
      ))}
      <g transform="translate(268 320)">
        <rect width="44" height="44" rx="14" fill="#c0f5dc" />
        <path d="M22 10C19 15 14 20 14 25a8 8 0 0 0 16 0c0-5-5-10-8-15Z" fill="#155543" />
        <path d="M18 25a4 4 0 0 0 4 4" stroke="#c0f5dc" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

export default function LoginPage() {
  const { signIn } = useAuth()
  const id = useId()
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const inFlight = useRef(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [paused, setPaused] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (inFlight.current) return
    const nextErrors: typeof fieldErrors = {}
    if (!email.trim()) nextErrors.email = 'Vui lòng nhập email.'
    else if (emailRef.current?.validity.typeMismatch) nextErrors.email = 'Email không hợp lệ.'
    if (!password) nextErrors.password = 'Vui lòng nhập mật khẩu.'
    setFieldErrors(nextErrors)
    setError('')
    if (nextErrors.email || nextErrors.password) {
      if (nextErrors.email) emailRef.current?.focus()
      else passwordRef.current?.focus()
      return
    }

    inFlight.current = true
    setSubmitting(true)
    try {
      await signIn(email.trim(), password)
    } catch (reason) {
      setError(friendlyAuthError(reason instanceof Error ? reason.message : ''))
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <main className={`login-page${paused ? ' login-paused' : ''}`}>
      <section className="login-story" aria-labelledby={`${id}-story`}>
        <div className="login-story-glow" aria-hidden="true" />
        <div className="login-brand">
          <span className="login-brand-mark"><Droplets size={25} strokeWidth={1.8} aria-hidden="true" /></span>
          <span>WEBGIS</span>
        </div>
        <div className="login-story-copy">
          <h1 id={`${id}-story`}>Hạ tầng<br /><span>cấp nước.</span></h1>
        </div>
        <div className="login-map-art" aria-hidden="true">
          <WaterNetwork />
        </div>
      </section>

      <section className="login-workspace" aria-labelledby={`${id}-title`}>
        <div className="login-workspace-top">
          <span className="login-mobile-brand"><Droplets size={21} aria-hidden="true" /> WEBGIS</span>
          <button type="button" className="login-motion-toggle" onClick={() => setPaused((value) => !value)} aria-label={paused ? 'Tiếp tục hiệu ứng nền' : 'Tạm dừng hiệu ứng nền'} aria-pressed={paused} title={paused ? 'Tiếp tục hiệu ứng nền' : 'Tạm dừng hiệu ứng nền'}>
            {paused ? <Play size={15} aria-hidden="true" /> : <Pause size={15} aria-hidden="true" />}
          </button>
        </div>

        <div className="login-form-wrap">
          <div className="login-welcome-icon" aria-hidden="true"><LockKeyhole size={25} strokeWidth={1.6} /><span><Check size={10} strokeWidth={3} /></span></div>
          <header className="login-form-heading">
            <h2 id={`${id}-title`}>Đăng nhập</h2>
          </header>

          {error && <div id={`${id}-error`} className="login-error" role="alert"><AlertCircle size={18} aria-hidden="true" /><span>{error}</span></div>}

          <form onSubmit={handleSubmit} noValidate aria-busy={submitting} className="login-form">
            <div className="login-field">
              <label htmlFor={`${id}-email`}>Email</label>
              <div className="login-input-wrap">
                <Mail className="login-input-icon" size={18} strokeWidth={1.7} aria-hidden="true" />
                <input id={`${id}-email`} ref={emailRef} type="email" name="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} required readOnly={submitting}
                  value={email} onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: undefined })); setError('') }}
                  placeholder="ten@donvi.vn" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? `${id}-email-error` : error ? `${id}-error` : undefined} />
              </div>
              {fieldErrors.email && <p id={`${id}-email-error`} className="login-field-error" role="alert">{fieldErrors.email}</p>}
            </div>

            <div className="login-field">
              <label htmlFor={`${id}-password`}>Mật khẩu</label>
              <div className="login-input-wrap">
                <LockKeyhole className="login-input-icon" size={18} strokeWidth={1.7} aria-hidden="true" />
                <input id={`${id}-password`} ref={passwordRef} type={showPassword ? 'text' : 'password'} name="password" autoComplete="current-password" required readOnly={submitting}
                  value={password} onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: undefined })); setError('') }}
                  onKeyDown={(event) => setCapsLock(event.getModifierState('CapsLock'))} onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))} onBlur={() => setCapsLock(false)}
                  placeholder="Nhập mật khẩu" aria-invalid={Boolean(fieldErrors.password)} aria-describedby={[fieldErrors.password ? `${id}-password-error` : '', capsLock ? `${id}-caps` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined} />
                <button type="button" className="login-password-toggle" aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={showPassword} aria-controls={`${id}-password`} onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? <EyeOff size={18} strokeWidth={1.7} aria-hidden="true" /> : <Eye size={18} strokeWidth={1.7} aria-hidden="true" />}
                </button>
              </div>
              {fieldErrors.password && <p id={`${id}-password-error`} className="login-field-error" role="alert">{fieldErrors.password}</p>}
              {capsLock && <p id={`${id}-caps`} className="login-caps-hint" role="status">Caps Lock đang bật.</p>}
            </div>

            <button type="submit" disabled={submitting} className="login-submit">
              <span>{submitting ? <><LoaderCircle className="login-spinner" size={19} aria-hidden="true" /> Đang đăng nhập…</> : <>Đăng nhập <ArrowRight size={19} aria-hidden="true" /></>}</span>
            </button>
            <span className="login-sr-only" role="status">{submitting ? 'Đang đăng nhập, vui lòng chờ.' : ''}</span>
          </form>

          <details className="login-help">
            <summary>Hỗ trợ<span aria-hidden="true">+</span></summary>
            <p>Liên hệ quản trị viên để cấp tài khoản hoặc đặt lại mật khẩu.</p>
          </details>
        </div>
      </section>
    </main>
  )
}
