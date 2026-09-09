create table if not exists app_users (
  auth_user_id uuid primary key,
  display_name text not null,
  role text not null check (role in ('admin','manager','technician')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_users_role_active_idx on app_users (role, active);
