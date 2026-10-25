import type { IncidentFeature } from '../../types/gis'
import type { IncidentWorkQueue, OperationsSummary } from '../../types/operations'

export const WORK_QUEUES: Array<{ key: IncidentWorkQueue; label: string; countKey: keyof Pick<OperationsSummary, 'unassignedIncidents' | 'overdueIncidents' | 'highPriorityIncidents' | 'inProgressIncidents'>; hint: string }> = [
  { key: 'unassigned', label: 'Chờ phân công', countKey: 'unassignedIncidents', hint: 'Sự cố mới chưa có người phụ trách' },
  { key: 'overdue', label: 'Quá hạn SLA', countKey: 'overdueIncidents', hint: 'Sự cố đang mở đã quá hạn xử lý' },
  { key: 'high_priority', label: 'Ưu tiên cao', countKey: 'highPriorityIncidents', hint: 'Sự cố mức cao chưa được giải quyết' },
  { key: 'in_progress', label: 'Đang xử lý', countKey: 'inProgressIncidents', hint: 'Theo dõi công việc đang thực hiện' },
]

export function matchesWorkQueue(incident: IncidentFeature, queue: IncidentWorkQueue): boolean {
  const properties = incident.properties
  if (queue === 'unassigned') return properties.status === 'new' && !properties.assignedUserId && !properties.assignedTo?.trim()
  if (queue === 'overdue') return properties.status !== 'resolved' && Boolean(properties.dueAt && new Date(properties.dueAt).getTime() < Date.now())
  if (queue === 'high_priority') return properties.status !== 'resolved' && properties.severity === 'high'
  return properties.status === 'in_progress'
}
