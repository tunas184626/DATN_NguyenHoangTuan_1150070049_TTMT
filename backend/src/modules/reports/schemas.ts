import { z } from 'zod'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày phải có định dạng YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(date.getTime()) && date.getUTCFullYear() >= 1 && date.toISOString().slice(0, 10) === value
  }, 'Ngày không hợp lệ')

export const reportSummaryQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  region: z.string().trim().max(255).default(''),
}).refine((value) => value.from <= value.to, {
  path: ['to'],
  message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi',
}).refine((value) => {
  const from = new Date(value.from)
  const to = new Date(value.to)
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth() < 120
}, { path: ['to'], message: 'Mỗi báo cáo hỗ trợ tối đa 120 tháng' })

export const reportIncidentsQuerySchema = reportSummaryQuerySchema.safeExtend({
  limit: z.coerce.number().int().min(1).max(500).default(20),
  offset: z.coerce.number().int().min(0).max(10_000_000).default(0),
})

export type ReportSummaryQuery = z.infer<typeof reportSummaryQuerySchema>
export type ReportIncidentsQuery = z.infer<typeof reportIncidentsQuerySchema>
