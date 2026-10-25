import { describe, expect, it, vi } from 'vitest'
import { parseDetectedAt, readIncidentIntake, toLocalDateTimeInput, validateIncidentDetails, validateIncidentPhotos } from '../../src/utils/incidentIntake'
import { createIncidentSchema } from './modules/incidents/schemas'

describe('incident intake validation', () => {
  const now = new Date(2026, 9, 22, 14, 37, 42)

  it('keeps the operator local date and minute rather than UTC midnight', () => {
    expect(toLocalDateTimeInput(now)).toBe('2026-10-22T14:37')
    expect(parseDetectedAt('2026-10-22T14:37', now)).toBe(new Date(2026, 9, 22, 14, 37).toISOString())
    expect(parseDetectedAt('2026-10-22T14:37', now)).not.toBe('2026-10-22T00:00:00.000Z')
  })

  it('rejects future, overflowing and malformed dates', () => {
    for (const date of ['2026-10-22T14:38', '2026-02-30T09:00', '2026-10-22T25:00', '2026-13-12T10:00', '2026-10-22', '', '2026-10-22T14:37Z']) {
      expect(parseDetectedAt(date, now), date).toBeNull()
    }
  })

  it('accepts actual detection dates before intake', () => {
    expect(parseDetectedAt('2026-10-21T09:15', now)).toBe(new Date(2026, 9, 21, 9, 15).toISOString())
  })

  it('requires a useful bounded description and bounded initial actions', () => {
    expect(validateIncidentDetails('   ngắn  ', '2026-10-22T14:30', '', now)).toBeTruthy()
    expect(validateIncidentDetails('a'.repeat(5001), '2026-10-22T14:30', '', now)).toBeTruthy()
    expect(validateIncidentDetails('Rò rỉ tại đầu nối ống.', '2026-10-22T14:30', 'a'.repeat(2001), now)).toBeTruthy()
    expect(validateIncidentDetails('Rò rỉ tại đầu nối ống.', '2026-10-22T14:30', 'Đã đặt biển cảnh báo.', now)).toBeNull()
    expect(validateIncidentDetails('Rò rỉ tại đầu nối ống.', '2026-10-23T14:30', '', now)).toBeTruthy()
  })

  it('rejects invalid photo count, MIME and size without silently dropping files', () => {
    const image = { name: 'hiện-trường.jpg', type: 'image/jpeg', size: 1_024 }
    expect(validateIncidentPhotos(Array(4).fill(image))).toBeTruthy()
    expect(validateIncidentPhotos([{ ...image, type: 'application/pdf' }])).toBeTruthy()
    expect(validateIncidentPhotos([{ ...image, size: 8 * 1024 * 1024 + 1 }])).toBeTruthy()
    expect(validateIncidentPhotos([{ ...image, size: 0 }])).toBeTruthy()
    expect(validateIncidentPhotos([image, { ...image, type: 'image/png' }, { ...image, type: 'image/webp' }])).toBeNull()
  })

  it('safely reads structured intake while ignoring malformed legacy details', () => {
    const intake = { detectionChannel: 'site_inspection', serviceImpact: 'unknown', initialResponse: '', detectedAt: now.toISOString(), locationConfirmed: true }
    expect(readIncidentIntake(intake)).toEqual(intake)
    for (const value of [null, 'legacy text', {}, { ...intake, detectionChannel: 'toString' }, { ...intake, initialResponse: { text: 'invalid' } }, { ...intake, detectedAt: 'not a date' }, { ...intake, locationConfirmed: false }]) expect(readIncidentIntake(value)).toBeNull()
  })

  it('rejects future API timestamps while allowing one minute of client clock skew', () => {
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now.getTime())
    try {
      const input = { incidentType: 'leak', severity: 'high', description: 'Rò rỉ tại đầu nối ống.', latitude: 10.9, longitude: 106.4 }
      expect(createIncidentSchema.safeParse({ ...input, reportedAt: new Date(now.getTime() + 60_000).toISOString() }).success).toBe(true)
      expect(createIncidentSchema.safeParse({ ...input, reportedAt: new Date(now.getTime() + 60_001).toISOString() }).success).toBe(false)
      expect(createIncidentSchema.safeParse({ ...input, reportedAt: 'invalid' }).success).toBe(false)
    } finally { clock.mockRestore() }
  })
})
