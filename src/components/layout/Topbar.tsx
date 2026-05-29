import { BarChart3, LayoutGrid, Map, Search } from 'lucide-react'
import type { ViewMode } from '../../types/gis'

export interface SearchResultItem {
  id: string
  label: string
  meta: string
}

interface TopbarProps {
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  searchResults: SearchResultItem[]
  onSelectSearchResult: (id: string) => void
}

const VIEW_OPTIONS: Array<{
  id: ViewMode
  label: string
  icon: typeof Map
}> = [
  { id: 'map', label: 'Bản đồ', icon: Map },
  { id: 'manage', label: 'Quản lý', icon: LayoutGrid },
  { id: 'report', label: 'Bao cao', icon: BarChart3 },
]

export function Topbar({
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchQueryChange,
  searchResults,
  onSelectSearchResult,
}: TopbarProps) {
  return (
    <header className="panel relative z-[900] mx-3 mt-3 flex h-[74px] items-center gap-4 px-4 lg:px-6">
      <div>
        <p className="font-display text-[26px] uppercase leading-none tracking-wide text-water-800">
          WebGIS
        </p>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-water-600">
          Quản lý hệ thống cấp nước
        </p>
      </div>

      <div className="relative ml-auto w-full max-w-[430px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Tìm đối tượng: Đức Hòa, D300, SC-001..."
          className="field-input h-10 pl-9"
          type="search"
        />

        {searchQuery.trim().length > 0 && (
          <div className="absolute left-0 right-0 top-12 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
            {searchResults.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-500">Không tìm thấy đối tượng phù hợp.</p>
            ) : (
              <ul className="space-y-1">
                {searchResults.map((result) => (
                  <li key={result.id}>
                    <button
                      type="button"
                      onClick={() => onSelectSearchResult(result.id)}
                      className="w-full rounded-lg px-3 py-2 text-left transition hover:bg-water-50"
                    >
                      <p className="text-sm font-semibold text-slate-700">{result.label}</p>
                      <p className="text-xs text-slate-500">{result.meta}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="hidden items-center gap-1 rounded-xl border border-water-100 bg-water-50 p-1 md:flex">
        {VIEW_OPTIONS.map((option) => {
          const Icon = option.icon
          const active = option.id === viewMode

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onViewModeChange(option.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                active
                  ? 'bg-white text-water-700 shadow-sm'
                  : 'text-water-700/80 hover:bg-white/70'
              }`}
            >
              <Icon className="size-4" />
              {option.label}
            </button>
          )
        })}
      </div>
    </header>
  )
}
