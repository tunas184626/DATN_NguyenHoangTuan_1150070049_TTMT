import type { IncidentIntake } from '../types/gis'

export const DETECTION_CHANNEL_LABELS: Record<IncidentIntake['detectionChannel'], string> = {
  site_inspection: 'Kiểm tra hiện trường',
  phone: 'Tiếp nhận qua điện thoại',
  field_report: 'Báo cáo của nhân viên',
}

export const SERVICE_IMPACT_LABELS: Record<IncidentIntake['serviceImpact'], string> = {
  unknown: 'Chưa xác định',
  none: 'Chưa ảnh hưởng cấp nước',
  reduced: 'Giảm áp / giảm lưu lượng',
  interrupted: 'Gián đoạn cấp nước',
}

/** Old free-form details may contain unrelated data under the same key. */
export function readIncidentIntake(value: unknown): IncidentIntake | null {
  if (!value || typeof value !== 'object') return null
  const item = value as Record<string, unknown>
  if (typeof item.detectionChannel !== 'string' || !Object.hasOwn(DETECTION_CHANNEL_LABELS, item.detectionChannel)
    || typeof item.serviceImpact !== 'string' || !Object.hasOwn(SERVICE_IMPACT_LABELS, item.serviceImpact)
    || typeof item.initialResponse !== 'string' || typeof item.detectedAt !== 'string'
    || !Number.isFinite(Date.parse(item.detectedAt)) || item.locationConfirmed !== true) return null
  return item as unknown as IncidentIntake
}

/** datetime-local uses the operator's local clock, never UTC midnight. */
export function toLocalDateTimeInput(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function parseDetectedAt(value: string, now = new Date()): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const [, year, month, day, hours, minutes] = match.map(Number)
  const date = new Date(year, month - 1, day, hours, minutes)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day
    || date.getHours() !== hours || date.getMinutes() !== minutes || date.getTime() > now.getTime()) return null
  return date.toISOString()
}

export function validateIncidentDetails(description: string, detectedAt: string, initialResponse: string, now = new Date()): string | null {
  if (description.trim().length < 10) return 'Mô tả ít nhất 10 ký tự: dấu hiệu quan sát, phạm vi và tình trạng hiện trường.'
  if (description.trim().length > 5000) return 'Mô tả tối đa 5.000 ký tự.'
  if (!parseDetectedAt(detectedAt, now)) return 'Thời điểm phát hiện chưa hợp lệ hoặc nằm trong tương lai.'
  if (initialResponse.trim().length > 2000) return 'Ghi nhận biện pháp ban đầu tối đa 2.000 ký tự.'
  return null
}

export function validateIncidentPhotos(files: Array<Pick<File, 'name' | 'type' | 'size'>>): string | null {
  if (files.length > 3) return 'Chọn tối đa 3 ảnh hiện trường.'
  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return `Ảnh ${file.name} phải có định dạng JPG, PNG hoặc WebP.`
    if (file.size > 8 * 1024 * 1024 || file.size <= 0) return `Ảnh ${file.name} phải lớn hơn 0 và không vượt quá 8 MB.`
  }
  return null
}
