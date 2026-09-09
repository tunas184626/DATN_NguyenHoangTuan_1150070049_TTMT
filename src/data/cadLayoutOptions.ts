export interface LayoutOption {
  id: string
  label: string
  fileName: string
  url: string
}

export const CAD_LAYOUT_OPTIONS: LayoutOption[] = [
  {
    id: 'duc-hoa',
    label: 'Đức Hòa',
    fileName: 'duc-hoa-layout.png',
    url: '/maps/layouts/duc-hoa-layout.png',
  },
  {
    id: 'my-hanh',
    label: 'Mỹ Hạnh',
    fileName: 'my-hanh-layout.png',
    url: '/maps/layouts/my-hanh-layout.png',
  },
  {
    id: 'duc-lap',
    label: 'Đức Lập',
    fileName: 'duc-lap-layout.png',
    url: '/maps/layouts/duc-lap-layout.png',
  },
]
