-- Draft developer recordings are kept separate from approved templates.
-- A completed recording can be reviewed and converted into template and
-- runner instruction rows in a later workflow.

create table if not exists public.recording_sessions (
  id uuid primary key default gen_random_uuid(),
  website_request_id uuid references public.website_requests(id) on delete set null,
  site_url text not null,
  base_domain text not null,
  site_name text not null,
  category text not null check (char_length(trim(category)) between 1 and 100),
  status text not null default 'recording'
    check (status in ('recording', 'completed', 'cancelled')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recording_steps (
  id uuid primary key default gen_random_uuid(),
  recording_session_id uuid not null references public.recording_sessions(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  page_url text not null,
  page_title text not null default '',
  action_type text not null
    check (action_type in ('click', 'input', 'select', 'change')),
  selector text not null,
  xpath text,
  element_label text not null,
  instruction_title text not null,
  instruction_text text not null check (char_length(trim(instruction_text)) > 0),
  element_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recording_session_id, step_order)
);

create index if not exists idx_recording_sessions_domain_category
  on public.recording_sessions(base_domain, category, created_at desc);
create index if not exists idx_recording_sessions_request
  on public.recording_sessions(website_request_id);
create index if not exists idx_recording_steps_session_order
  on public.recording_steps(recording_session_id, step_order);

alter table public.recording_sessions enable row level security;
alter table public.recording_steps enable row level security;

-- These tables are only accessed through the private backend connection.
revoke all on table public.recording_sessions from anon, authenticated;
revoke all on table public.recording_steps from anon, authenticated;

