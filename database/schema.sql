create extension if not exists pgcrypto;

create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  site_key text not null unique,
  site_name text not null,
  base_domain text not null,
  category text not null default 'public_service',
  status text not null default 'active'
    check (status in ('active', 'inactive', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  template_key text not null unique,
  template_name text not null,
  version text not null,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'archived')),
  url_patterns text[] not null,
  template_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  version text not null,
  status text not null default 'draft'
    check (status in ('draft', 'pending_review', 'approved', 'archived')),
  template_json jsonb not null,
  change_note text,
  created_by text,
  created_at timestamptz not null default now(),
  unique (template_id, version)
);

create table if not exists field_mappings (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  field_key text not null,
  label text not null,
  input_type text not null
    check (input_type in ('text', 'password', 'email', 'tel', 'number', 'date', 'select', 'textarea')),
  selector text not null,
  xpath text,
  required boolean not null default false,
  validation_rule text,
  options_json jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (template_id, field_key)
);

create table if not exists runner_instructions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  step_order integer not null,
  instruction_type text not null
    check (
      instruction_type in (
        'fill',
        'click',
        'select',
        'waitForElement',
        'prompt_user',
        'review',
        'submit_after_confirm'
      )
    ),
  field_key text,
  selector text,
  xpath text,
  value_source text,
  wait_ms integer,
  metadata_json jsonb,
  created_at timestamptz not null default now(),
  unique (template_id, step_order)
);

-- User-facing, ordered workflow guidance. This is intentionally separate from
-- runner_instructions, which stores low-level fill/select/review actions.
create table if not exists instructions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  template_id uuid references templates(id) on delete set null,
  workflow_key text not null,
  page_key text not null,
  step_order integer not null check (step_order > 0),
  page_url text not null,
  url_pattern text not null,
  heading_match text not null,
  instruction_title text not null,
  instruction_text text not null,
  completion_rule jsonb not null default '{}'::jsonb,
  allowed_next_page_keys text[] not null default '{}',
  out_of_order_message text not null,
  block_out_of_order boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_key, page_key),
  unique (workflow_key, step_order)
);

create table if not exists validation_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  rule_name text not null,
  regex_pattern text,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists anonymous_template_errors (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references templates(id) on delete set null,
  template_version text,
  url text,
  error_code text not null,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists website_requests (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  base_domain text not null unique,
  site_name text not null,
  user_note text,
  status text not null default 'pending'
    check (status in ('pending', 'in_review', 'fulfilled', 'rejected')),
  request_count integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_templates_status on templates(status);
create index if not exists idx_templates_site_id on templates(site_id);
create index if not exists idx_field_mappings_template_id on field_mappings(template_id);
create index if not exists idx_runner_instructions_template_id on runner_instructions(template_id);
create index if not exists idx_instructions_site_id on instructions(site_id);
create index if not exists idx_instructions_workflow_order on instructions(workflow_key, step_order);
create index if not exists idx_website_requests_status on website_requests(status);
create index if not exists idx_website_requests_base_domain on website_requests(base_domain);

-- AccessLens reads these tables through its private backend connection only.
alter table sites enable row level security;
alter table templates enable row level security;
alter table template_versions enable row level security;
alter table field_mappings enable row level security;
alter table runner_instructions enable row level security;
alter table instructions enable row level security;
alter table validation_rules enable row level security;
alter table anonymous_template_errors enable row level security;
alter table website_requests enable row level security;

revoke all on table sites from anon, authenticated;
revoke all on table templates from anon, authenticated;
revoke all on table template_versions from anon, authenticated;
revoke all on table field_mappings from anon, authenticated;
revoke all on table runner_instructions from anon, authenticated;
revoke all on table instructions from anon, authenticated;
revoke all on table validation_rules from anon, authenticated;
revoke all on table anonymous_template_errors from anon, authenticated;
revoke all on table website_requests from anon, authenticated;

