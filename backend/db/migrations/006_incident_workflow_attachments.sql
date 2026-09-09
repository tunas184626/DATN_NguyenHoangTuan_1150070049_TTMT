alter table incidents
  add column if not exists assigned_to text,
  add column if not exists assigned_at timestamptz;

alter table incident_status_history
  add column if not exists event_type text not null default 'status_changed',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists incident_attachments (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references incidents(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 8388608),
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists incident_attachments_incident_idx
  on incident_attachments (incident_id, created_at desc);

create index if not exists incidents_assigned_to_idx
  on incidents (assigned_to) where deleted_at is null and assigned_to is not null;
