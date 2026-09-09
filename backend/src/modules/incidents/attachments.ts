import multer from 'multer'
import { getPool } from '../../db/pool.js'
import { AppError } from '../../shared/errors.js'
import { createIncidentImageUrls, removeIncidentImage, uploadIncidentImage, validateIncidentImage } from './storage.js'

export const receiveIncidentImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
}).single('file')

interface AttachmentRow {
  id: string
  incident_id: string
  storage_bucket: string
  storage_path: string
  original_name: string
  mime_type: string
  size_bytes: string
  created_at: Date
}

async function assertIncidentExists(incidentId: string): Promise<void> {
  const result = await getPool().query('select 1 from incidents where id=$1 and deleted_at is null', [incidentId])
  if (!result.rowCount) throw new AppError(404, 'INCIDENT_NOT_FOUND', 'Không tìm thấy sự cố')
}

function serialize(row: AttachmentRow, signedUrl?: string) {
  return {
    id: row.id,
    incidentId: row.incident_id,
    name: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at.toISOString(),
    url: signedUrl ?? null,
  }
}

export async function listIncidentAttachments(incidentId: string) {
  await assertIncidentExists(incidentId)
  const result = await getPool().query<AttachmentRow>(
    `select id, incident_id, storage_bucket, storage_path, original_name, mime_type,
      size_bytes::text, created_at from incident_attachments
     where incident_id=$1 order by created_at desc`,
    [incidentId],
  )
  const urls = await createIncidentImageUrls(result.rows.map((row) => row.storage_path))
  return { items: result.rows.map((row) => serialize(row, urls.get(row.storage_path))) }
}

export async function addIncidentAttachment(incidentId: string, file: Express.Multer.File | undefined, actorId: string) {
  validateIncidentImage(file)
  await assertIncidentExists(incidentId)
  const stored = await uploadIncidentImage(incidentId, file)
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const result = await client.query<AttachmentRow>(
      `insert into incident_attachments
       (incident_id, storage_bucket, storage_path, original_name, mime_type, size_bytes, created_by)
       values ($1,$2,$3,$4,$5,$6,$7)
       returning id, incident_id, storage_bucket, storage_path, original_name, mime_type, size_bytes::text, created_at`,
      [incidentId, stored.bucket, stored.path, file.originalname.slice(0, 255), file.mimetype, file.size, actorId],
    )
    await client.query(
      `insert into incident_status_history
       (incident_id, from_status, to_status, note, changed_by, event_type, metadata)
       select id, status, status, $2, $3, 'attachment_added', $4::jsonb
       from incidents where id=$1`,
      [incidentId, `Đã thêm ảnh ${file.originalname.slice(0, 255)}`, actorId, JSON.stringify({ attachmentId: result.rows[0]!.id })],
    )
    await client.query('commit')
    const urls = await createIncidentImageUrls([stored.path])
    return serialize(result.rows[0]!, urls.get(stored.path))
  } catch (error) {
    await client.query('rollback').catch(() => undefined)
    await removeIncidentImage(stored.path).catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

export async function deleteIncidentAttachment(incidentId: string, attachmentId: string): Promise<void> {
  const result = await getPool().query<AttachmentRow>(
    `select id, incident_id, storage_bucket, storage_path, original_name, mime_type,
      size_bytes::text, created_at from incident_attachments where id=$1 and incident_id=$2`,
    [attachmentId, incidentId],
  )
  const attachment = result.rows[0]
  if (!attachment) throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Không tìm thấy ảnh đính kèm')
  await removeIncidentImage(attachment.storage_path)
  await getPool().query('delete from incident_attachments where id=$1', [attachmentId])
}
