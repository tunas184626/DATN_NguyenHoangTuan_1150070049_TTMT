create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null unique,
  name text not null,
  type text not null check (type in ('water_plant','raw_water_lake','pipeline','canal','supply_zone','boundary','label','pending_data')),
  status text not null default 'pending_data' check (status in ('active','maintenance','need_inspection','pending_data')),
  description text not null default '',
  address text not null default '',
  attributes jsonb not null default '{}'::jsonb,
  geom geometry(Geometry, 4326) not null,
  version integer not null default 1 check (version > 0),
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint assets_geometry_valid check (st_isvalid(geom)),
  constraint assets_geometry_world_bounds check (geom && st_makeenvelope(-180,-90,180,90,4326))
);

create index if not exists assets_geom_gist on assets using gist (geom);
create index if not exists assets_type_status_idx on assets (type, status) where deleted_at is null;
create index if not exists assets_updated_at_idx on assets (updated_at desc) where deleted_at is null;
