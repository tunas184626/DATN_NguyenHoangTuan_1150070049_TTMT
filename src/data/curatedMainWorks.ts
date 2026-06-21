export type CuratedMainWorkType = 'water_plant' | 'raw_water_lake'

export interface CuratedMainWork {
  id: string
  name: string
  displayName: string
  type: CuratedMainWorkType
  group: 'curated_main_work'
  status: 'draft' | 'positioned' | 'needs_position'
  source: string
  description: string
  cadPosition?: [number, number]
  manuallyPositioned: boolean
  notes: string[]
}

export const CURATED_MAIN_WORKS: CuratedMainWork[] = [
  {
    id: 'curated-nmn-hoa-khanh-tay',
    name: 'NMN Hoa Khanh Tay',
    displayName: 'NMN Hoa Khanh Tay',
    type: 'water_plant',
    group: 'curated_main_work',
    status: 'needs_position',
    source: 'HTCN PMV.dwg',
    description: 'Nha may nuoc chinh can the hien noi bat tren ban do WebGIS.',
    manuallyPositioned: false,
    notes: ['Co the cap nhat lai vi tri thu cong sau khi doi chieu ban ve CAD.'],
  },
  {
    id: 'curated-nmn-duc-hoa-3',
    name: 'NMN Duc Hoa 3',
    displayName: 'NMN Duc Hoa 3',
    type: 'water_plant',
    group: 'curated_main_work',
    status: 'positioned',
    source: 'HTCN PMV.dwg',
    description: 'Nha may nuoc chinh can the hien noi bat tren ban do WebGIS.',
    cadPosition: [577180.224, 1209210.201],
    manuallyPositioned: false,
    notes: ['Vi tri neo tai cum dau noi Pipe Existing_DTDH va Pipe_Phase 1 trong ban ve CAD.'],
  },
  {
    id: 'curated-ho-7ha-hau-nghia',
    name: 'Ho nuoc tho 7ha Hau Nghia',
    displayName: 'Ho nuoc tho 7ha xa Hau Nghia',
    type: 'raw_water_lake',
    group: 'curated_main_work',
    status: 'positioned',
    source: 'HTCN PMV.dwg',
    description: 'Ho nuoc tho thuoc nhom cong trinh chinh can kiem tra va chuan hoa vi tri.',
    cadPosition: [570518.332, 1203167.238],
    manuallyPositioned: false,
    notes: ['Vi tri neo theo nhan Hau Nghia va snap vao tuyen Pipe Existing trong ban ve CAD.'],
  },
  {
    id: 'curated-ho-13ha-my-hanh',
    name: 'Ho nuoc tho 13ha My Hanh',
    displayName: 'Ho nuoc tho 13ha xa My Hanh',
    type: 'raw_water_lake',
    group: 'curated_main_work',
    status: 'positioned',
    source: 'HTCN PMV.dwg',
    description: 'Ho nuoc tho thuoc nhom cong trinh chinh can kiem tra va chuan hoa vi tri.',
    cadPosition: [579478.287, 1203494.184],
    manuallyPositioned: false,
    notes: ['Vi tri neo theo nhan My Hanh va snap vao tuyen Pipe _Existing_PHL trong ban ve CAD.'],
  },
]
