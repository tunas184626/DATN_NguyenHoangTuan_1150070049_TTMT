import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '../../config/env.js'
import { AppError } from '../../shared/errors.js'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
let storageClient: SupabaseClient | undefined
let bucketPromise: Promise<void> | undefined

function getStorageClient(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    throw new AppError(503, 'STORAGE_NOT_CONFIGURED', 'Kho ảnh chưa được cấu hình')
  }
  storageClient ??= createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return storageClient
}

async function ensurePrivateBucket(): Promise<void> {
  bucketPromise ??= (async () => {
    const client = getStorageClient()
    const { data, error } = await client.storage.getBucket(env.SUPABASE_STORAGE_BUCKET)
    if (data) return
    const status = Number((error as { statusCode?: string | number } | null)?.statusCode)
    if (error && status !== 404) throw new AppError(502, 'STORAGE_UNAVAILABLE', 'Không thể kiểm tra kho ảnh')
    const created = await client.storage.createBucket(env.SUPABASE_STORAGE_BUCKET, {
      public: false,
      fileSizeLimit: 8 * 1024 * 1024,
      allowedMimeTypes: [...ALLOWED_IMAGE_TYPES],
    })
    if (created.error) throw new AppError(502, 'STORAGE_BUCKET_ERROR', 'Không thể khởi tạo kho ảnh')
  })()
  try {
    await bucketPromise
  } catch (error) {
    bucketPromise = undefined
    throw error
  }
}

function extensionFor(file: Express.Multer.File): string {
  const extension = file.originalname.split('.').pop()?.toLowerCase()
  if (extension && /^[a-z0-9]{1,8}$/.test(extension)) return extension
  return file.mimetype === 'image/png' ? 'png' : file.mimetype === 'image/webp' ? 'webp' : 'jpg'
}

export function validateIncidentImage(file: Express.Multer.File | undefined): asserts file is Express.Multer.File {
  if (!file) throw new AppError(400, 'IMAGE_REQUIRED', 'Vui lòng chọn ảnh')
  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
    throw new AppError(415, 'UNSUPPORTED_IMAGE_TYPE', 'Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP')
  }
  const bytes = file.buffer
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const png = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  const webp = bytes.length >= 12 && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  if (!jpeg && !png && !webp) {
    throw new AppError(415, 'INVALID_IMAGE_CONTENT', 'Nội dung tệp không phải ảnh hợp lệ')
  }
}

export async function uploadIncidentImage(incidentId: string, file: Express.Multer.File) {
  await ensurePrivateBucket()
  const path = `${incidentId}/${randomUUID()}.${extensionFor(file)}`
  const result = await getStorageClient().storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .upload(path, file.buffer, { contentType: file.mimetype, upsert: false, cacheControl: '3600' })
  if (result.error) throw new AppError(502, 'STORAGE_UPLOAD_FAILED', 'Không thể tải ảnh lên kho lưu trữ')
  return { bucket: env.SUPABASE_STORAGE_BUCKET, path }
}

export async function removeIncidentImage(path: string): Promise<void> {
  const result = await getStorageClient().storage.from(env.SUPABASE_STORAGE_BUCKET).remove([path])
  if (result.error) throw new AppError(502, 'STORAGE_DELETE_FAILED', 'Không thể xóa ảnh khỏi kho lưu trữ')
}

export async function createIncidentImageUrls(paths: string[]): Promise<Map<string, string>> {
  if (paths.length === 0 || !env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) return new Map()
  const result = await getStorageClient().storage
    .from(env.SUPABASE_STORAGE_BUCKET)
    .createSignedUrls(paths, 60 * 60)
  if (result.error) return new Map()
  const urls = new Map<string, string>()
  result.data.forEach((item, index) => {
    if (item.signedUrl) urls.set(paths[index]!, item.signedUrl)
  })
  return urls
}
