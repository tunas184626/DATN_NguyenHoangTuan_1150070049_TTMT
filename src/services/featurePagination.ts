import type { FeaturePage } from '../types/operations'

export async function loadAllFeaturePages<T>(loadPage: (offset: number) => Promise<FeaturePage<T>>): Promise<T[]> {
  const features: T[] = []
  let offset = 0
  while (true) {
    const page = await loadPage(offset)
    if (page.type !== 'FeatureCollection' || !Array.isArray(page.features)
      || !Number.isSafeInteger(page.meta?.total) || page.meta.total < 0) {
      throw new Error('Danh sách phân trang không hợp lệ')
    }
    features.push(...page.features)
    offset += page.features.length
    if (offset >= page.meta.total) return features
    if (page.features.length === 0) throw new Error('Máy chủ chưa trả đủ dữ liệu theo số tổng')
  }
}
