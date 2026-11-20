import { useEffect, useId, useRef, useState } from 'react'
import { BookOpen, Check, Expand, FileDown, Globe2, LoaderCircle, Minimize2, Network, SlidersHorizontal, X } from 'lucide-react'

export type CadVisualMode = 'classic' | 'clean' | 'report' | 'water' | 'irrigation' | 'dark'

interface CadMapToolbarProps {
  presetLabel: string
  visualMode: CadVisualMode
  onVisualModeChange: (mode: CadVisualMode) => void
  showGrid: boolean
  onGridChange: (value: boolean) => void
  effects: boolean
  onEffectsChange: (value: boolean) => void
  showLegend: boolean
  onToggleLegend: () => void
  isFullscreen: boolean
  onToggleFullscreen: () => void
  onShowSurroundings: () => void
  onPrint: () => void
  printing: boolean
}

const MODES: Array<{ key: CadVisualMode; label: string }> = [
  { key: 'classic', label: 'Sáng' },
  { key: 'clean', label: 'Trắng' },
  { key: 'report', label: 'Bản in' },
  { key: 'water', label: 'Cấp nước' },
  { key: 'irrigation', label: 'Thủy lợi' },
  { key: 'dark', label: 'Tối' },
]

export function CadMapToolbar({
  presetLabel, visualMode, onVisualModeChange, showGrid, onGridChange,
  effects, onEffectsChange, showLegend, onToggleLegend, isFullscreen,
  onToggleFullscreen, onShowSurroundings, onPrint, printing,
}: CadMapToolbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const id = useId()

  useEffect(() => {
    if (!settingsOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !settingsRef.current?.contains(event.target)) setSettingsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSettingsOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [settingsOpen])

  return (
    <header className="cad-toolbar cad-no-print">
      <div className="cad-toolbar-title">
        <span className="cad-toolbar-symbol"><Network size={20} strokeWidth={1.8} aria-hidden="true" /></span>
        <h2>CAD Vector</h2>
        <span className="cad-preset-badge">{presetLabel}</span>
      </div>
      <div className="cad-toolbar-actions" role="group" aria-label="Công cụ bản đồ CAD">
        <div className="cad-settings-anchor" ref={settingsRef}>
          <button ref={triggerRef} type="button" className={`cad-tool${settingsOpen ? ' is-active' : ''}`} aria-expanded={settingsOpen} aria-controls={id} aria-label="Tùy chỉnh bản đồ" title="Tùy chỉnh bản đồ" onClick={() => setSettingsOpen((value) => !value)}>
            <SlidersHorizontal size={17} aria-hidden="true" /><span>Nền</span>
          </button>
          {settingsOpen && (
            <section id={id} className="cad-settings" aria-label="Tùy chỉnh bản đồ">
              <div className="cad-popover-heading"><h3>Hiển thị</h3><button type="button" className="cad-icon-button" aria-label="Đóng tùy chỉnh" onClick={() => { setSettingsOpen(false); triggerRef.current?.focus() }}><X size={16} aria-hidden="true" /></button></div>
              <fieldset>
                <legend>Nền bản đồ</legend>
                <div className="cad-theme-grid">
                  {MODES.map(({ key, label }) => (
                    <label key={key} className={`cad-theme-option${visualMode === key ? ' is-selected' : ''}`}>
                      <input type="radio" name={`${id}-theme`} value={key} checked={visualMode === key} onChange={() => onVisualModeChange(key)} />
                      <span className={`cad-theme-preview cad-theme-${key}`} aria-hidden="true"><i /><i /><i />{visualMode === key && <Check size={12} strokeWidth={3} />}</span>
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="cad-setting-row"><span>Lưới tọa độ</span><input type="checkbox" role="switch" checked={showGrid} onChange={(event) => onGridChange(event.target.checked)} /><span className="cad-switch" aria-hidden="true" /></label>
              <label className="cad-setting-row"><span>Hiệu ứng</span><input type="checkbox" role="switch" checked={effects} onChange={(event) => onEffectsChange(event.target.checked)} /><span className="cad-switch" aria-hidden="true" /></label>
            </section>
          )}
        </div>
        <button type="button" className={`cad-tool${showLegend ? ' is-active' : ''}`} aria-label="Chú giải" aria-expanded={showLegend} aria-controls="cad-map-legend" title="Chú giải" onClick={onToggleLegend}><BookOpen size={17} aria-hidden="true" /><span>Chú giải</span></button>
        <button type="button" className="cad-tool" aria-label="Xem bản đồ địa lý" title="Xem bản đồ địa lý" onClick={onShowSurroundings}><Globe2 size={17} aria-hidden="true" /><span>Địa lý</span></button>
        <button type="button" className="cad-tool cad-fullscreen-button" aria-label={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'} aria-pressed={isFullscreen} title={isFullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình'} onClick={onToggleFullscreen}>{isFullscreen ? <Minimize2 size={17} aria-hidden="true" /> : <Expand size={17} aria-hidden="true" />}</button>
        <span className="cad-toolbar-divider" aria-hidden="true" />
        <button type="button" className="cad-export" disabled={printing} onClick={onPrint}>
          {printing ? <LoaderCircle size={17} className="cad-spin" aria-hidden="true" /> : <FileDown size={17} aria-hidden="true" />}<span>{printing ? 'Đang chuẩn bị…' : 'Xuất PDF'}</span>
        </button>
      </div>
    </header>
  )
}
