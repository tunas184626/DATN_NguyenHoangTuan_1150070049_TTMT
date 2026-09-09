create sequence if not exists incident_code_sequence;

create table if not exists incidents (
  id uuid primary key default gen_random_uuid(),
  incident_code text not null unique default (
    'SC-' || to_char(current_date, 'YYYYMM') || '-' || lpad(nextval('incident_code_sequence')::text, 6, '0')
  ),
  asset_id uuid references assets(id) on delete set null,
  name text not null,
  incident_type text not null check (incident_type in ('leak','pressure_loss','pipe_burst','turbid_water','need_inspection')),
  severity text not null check (severity in ('low','medium','high')),
  status text not null default 'new' check (status in ('new','in_progress','resolved')),
  description text not null,
  address text not null default '',
  details jsonb not null default '{}'::jsonb,
  geom geometry(Point, 4326) not null,
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint incidents_geometry_world_bounds check (geom && st_makeenvelope(-180,-90,180,90,4326))
);

create table if not exists incident_status_history (
  id bigint generated always as identity primary key,
  incident_id uuid not null references incidents(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text not null default '',
  changed_by text,
  changed_at timestamptz not null default now()
);

create index if not exists incidents_geom_gist on incidents using gist (geom);
create index if not exists incidents_status_severity_idx on incidents (status, severity) where deleted_at is null;
create index if not exists incidents_reported_at_idx on incidents (reported_at desc) where deleted_at is null;
create index if not exists incident_history_incident_idx on incident_status_history (incident_id, changed_at desc);
