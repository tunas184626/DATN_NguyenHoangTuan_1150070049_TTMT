import type {
  IncidentAssignee,
  IncidentLinkedAsset,
  IncidentRealtimeEvent,
} from '../types/gis'
import { apiGet } from './apiClient'
import { getSupabaseClient } from './supabaseClient'

interface RealtimeIncidentRow {
  id?: string
  created_by?: string | null
  updated_by?: string | null
}

export async function loadIncidentAssignees(): Promise<IncidentAssignee[]> {
  const response = await apiGet<{ items: IncidentAssignee[] }>('/users/assignees')
  return response.items
}

export async function loadIncidentLinkedAssets(incidentId: string): Promise<IncidentLinkedAsset[]> {
  const response = await apiGet<{ items: IncidentLinkedAsset[] }>(
    `/incidents/${encodeURIComponent(incidentId)}/assets`,
  )
  return response.items
}

export async function subscribeToIncidentChanges(
  onChange: (event: IncidentRealtimeEvent) => void,
): Promise<() => void> {
  const client = await getSupabaseClient()
  if (!client) return () => undefined
  const { data } = await client.auth.getSession()
  if (data.session?.access_token) await client.realtime.setAuth(data.session.access_token)

  const channel = client
    .channel('webgis-incident-workflow')
    .on<RealtimeIncidentRow>(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'incidents' },
      (payload) => {
        const row = (payload.eventType === 'DELETE' ? payload.old : payload.new) as RealtimeIncidentRow
        if (!row.id) return
        onChange({
          id: row.id,
          eventType: payload.eventType,
          actorId: row.updated_by ?? row.created_by ?? null,
          occurredAt: Date.now(),
        })
      },
    )
    .subscribe()

  return () => { void client.removeChannel(channel) }
}
