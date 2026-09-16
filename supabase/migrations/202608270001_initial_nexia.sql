create table public.reports (
  id uuid primary key, public_code varchar(16) not null unique, reporter_name varchar(120) not null,
  incident_type varchar(40) not null, incident_date date not null, approximate_time time not null,
  location varchar(160) not null, involved_aliases text, description text not null, status varchar(32) not null,
  public_summary text, rejection_reason text, created_at timestamptz not null, updated_at timestamptz not null
);
create index reports_status_idx on public.reports(status);
create index reports_incident_type_idx on public.reports(incident_type);

create table public.cameras (
  id uuid primary key, identifier varchar(30) not null unique, label varchar(80) not null,
  location varchar(160) not null, is_active boolean not null default true
);
create table public.evidence_clips (
  id uuid primary key, report_id uuid not null references public.reports(id) on delete cascade,
  camera_id uuid not null references public.cameras(id), original_name varchar(255) not null,
  stored_name varchar(255) not null unique, mime_type varchar(80) not null, size_bytes bigint not null,
  recording_started_at timestamptz not null, duration_seconds integer not null, created_at timestamptz not null
);
create index evidence_report_idx on public.evidence_clips(report_id);
create table public.analysis_jobs (
  id uuid primary key, report_id uuid not null references public.reports(id) on delete cascade,
  evidence_id uuid not null references public.evidence_clips(id) on delete cascade, status varchar(24) not null,
  model varchar(80) not null, started_at timestamptz, completed_at timestamptz, safe_error text, created_at timestamptz not null
);
create index analysis_report_idx on public.analysis_jobs(report_id);
create table public.analysis_results (
  id uuid primary key, job_id uuid not null unique references public.analysis_jobs(id) on delete cascade,
  temporal_match boolean not null, spatial_match boolean not null, event_match varchar(24) not null,
  suggested_type varchar(80), summary text not null, confidence_level varchar(24) not null,
  relevant_moments_json text not null default '[]', created_at timestamptz not null
);
create table public.admin_decisions (
  id uuid primary key, result_id uuid not null unique references public.analysis_results(id) on delete cascade,
  decision varchar(24) not null, observation text, created_at timestamptz not null
);

insert into public.cameras (id, identifier, label, location, is_active) values
  (gen_random_uuid(), 'CAM-B2', 'Cámara Bloque B - Piso 2', 'Bloque B - Segundo piso', true),
  (gen_random_uuid(), 'CAM-S304', 'Cámara Salón 304', 'Salón 304', true),
  (gen_random_uuid(), 'CAM-PATIO', 'Cámara Patio central', 'Patio central', true);

revoke all on all tables in schema public from anon, authenticated;
