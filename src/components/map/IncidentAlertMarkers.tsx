import { useEffect, useMemo, useRef } from 'react'
import { divIcon, DomEvent, type Marker as LeafletMarker } from 'leaflet'
import { Marker, Tooltip } from 'react-leaflet'
import type { IncidentFeature, IncidentSeverity } from '../../types/gis'
import { getIncidentSeverityMeta, getIncidentStatusMeta } from '../../utils/status'
import './incident-alerts.css'

interface Props {
  incidents: IncidentFeature[]
  selectedId: string | null
  onSelect: (id: string) => void
}

interface AlertMarkerProps {
  incident: IncidentFeature
  selected: boolean
  onSelect: Props['onSelect']
}

function IncidentAlertMarker({ incident, selected, onSelect }: AlertMarkerProps) {
  const { id, name, incidentCode, severity, status } = incident.properties
  const marker = useRef<LeafletMarker>(null)
  const resolved = status === 'resolved'
  const visualSeverity: IncidentSeverity = severity === 'high' || severity === 'low' ? severity : 'medium'
  const statusLabel = getIncidentStatusMeta(status)?.label ?? 'Chưa xác định'
  const severityLabel = getIncidentSeverityMeta(severity)?.label ?? 'Chưa xác định'
  const label = `${incidentCode || name}: ${statusLabel}, mức độ ${severityLabel}. Mở chi tiết sự cố.`
  const icon = useMemo(() => divIcon({
    className: [
      'incident-alert',
      `incident-alert--${visualSeverity}`,
      resolved ? 'incident-alert--resolved' : 'incident-alert--active',
      selected ? 'incident-alert--selected' : '',
    ].filter(Boolean).join(' '),
    // Keep this markup constant: incident data is rendered by React in the tooltip.
    html: '<span class="incident-alert__selection" aria-hidden="true"></span><span class="incident-alert__ring" aria-hidden="true"></span><span class="incident-alert__ring incident-alert__ring--second" aria-hidden="true"></span><span class="incident-alert__core" aria-hidden="true"></span>',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    tooltipAnchor: [0, -15],
  }), [visualSeverity, resolved, selected])

  useEffect(() => {
    const element = marker.current?.getElement()
    element?.setAttribute('aria-label', label)
    element?.setAttribute('aria-pressed', String(selected))
  }, [icon, label, selected])

  const [longitude, latitude] = incident.geometry.coordinates
  return (
    <Marker ref={marker} position={[latitude, longitude]} icon={icon}
      keyboard title={label} alt={label} bubblingMouseEvents={false}
      zIndexOffset={selected ? 1000 : resolved ? 0 : 100}
      eventHandlers={{
        click: () => onSelect(id),
        keydown: (event) => {
          if (event.originalEvent.key !== 'Enter' && event.originalEvent.key !== ' ') return
          DomEvent.stop(event.originalEvent)
          if (!event.originalEvent.repeat) onSelect(id)
        },
      }}>
      <Tooltip direction="top">
        <div className="max-w-64 whitespace-normal">
          <strong>{incidentCode || name}</strong>
          {incidentCode && <div>{name}</div>}
          <div>{statusLabel} · Mức độ {severityLabel.toLocaleLowerCase('vi-VN')}</div>
          {!resolved && <div className="text-xs text-slate-500">Vòng lan tỏa là ký hiệu cảnh báo, không thể hiện phạm vi ảnh hưởng.</div>}
        </div>
      </Tooltip>
    </Marker>
  )
}

export function IncidentAlertMarkers({ incidents, selectedId, onSelect }: Props) {
  return <>{incidents.map((incident) => {
    const [longitude, latitude] = incident.geometry.coordinates
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
      || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null
    return <IncidentAlertMarker key={incident.properties.id} incident={incident}
      selected={incident.properties.id === selectedId} onSelect={onSelect} />
  })}</>
}
