create table if not exists incident_sla_policies (
  severity text primary key check (severity in ('low','medium','high')),
  resolution_minutes integer not null check (resolution_minutes > 0),
  escalation_after_minutes integer not null check (escalation_after_minutes >= 0),
  updated_at timestamptz not null default now()
);

insert into incident_sla_policies (severity, resolution_minutes, escalation_after_minutes)
values ('high', 240, 60), ('medium', 1440, 240), ('low', 4320, 720)
on conflict (severity) do nothing;

alter table incidents
  add column if not exists due_at timestamptz,
  add column if not exists escalation_level integer not null default 0 check (escalation_level between 0 and 3),
  add column if not exists escalated_at timestamptz,
  add column if not exists assigned_user_id uuid references app_users(auth_user_id) on delete set null;

update incidents as incident
set due_at = incident.reported_at + make_interval(mins => policy.resolution_minutes)
from incident_sla_policies as policy
where incident.due_at is null and policy.severity = incident.severity;

alter table incidents alter column due_at set not null;

create table if not exists incident_assets (
  incident_id uuid not null references incidents(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  relation_type text not null default 'affected' check (relation_type in ('affected','suspected','context')),
  linked_by text,
  linked_at timestamptz not null default now(),
  primary key (incident_id, asset_id)
);

insert into incident_assets (incident_id, asset_id, linked_by)
select id, asset_id, created_by from incidents where asset_id is not null
on conflict (incident_id, asset_id) do nothing;

create index if not exists incidents_due_open_idx
  on incidents (due_at, escalation_level) where deleted_at is null and status <> 'resolved';
create index if not exists incidents_assigned_user_idx
  on incidents (assigned_user_id) where deleted_at is null and assigned_user_id is not null;
create index if not exists incident_assets_asset_idx on incident_assets (asset_id, incident_id);

-- Supabase Realtime: chỉ cấu hình khi database có đủ role/schema Supabase.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth')
     and exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute $fn$
      create or replace function public.is_active_app_user()
      returns boolean
      language sql
      stable
      security definer
      set search_path = ''
      as 'select exists (
        select 1 from public.app_users
        where auth_user_id = auth.uid() and active = true
      )'
    $fn$;
    execute 'grant execute on function public.is_active_app_user() to authenticated';
    execute 'grant select on table public.incidents to authenticated';

    alter table public.incidents enable row level security;
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = 'incidents' and policyname = 'Active app users can receive incident changes'
    ) then
      execute 'create policy "Active app users can receive incident changes"
        on public.incidents for select to authenticated using (public.is_active_app_user())';
    end if;

    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
      execute 'create publication supabase_realtime';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'incidents'
    ) then
      execute 'alter publication supabase_realtime add table public.incidents';
    end if;
  end if;
end $$;
