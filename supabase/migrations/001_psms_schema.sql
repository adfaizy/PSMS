-- PSMS (Punjab School Management System) — Supabase schema
-- Matches app data currently stored in localStorage

create extension if not exists "pgcrypto";

-- ─── schools ─────────────────────────────────────────────────────────────────
create table if not exists public.schools (
  id text primary key,
  name text not null default 'School',
  status text not null default 'active'
    check (status in ('active', 'stopped', 'deleted')),
  current_session text,
  sessions jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  timetable jsonb not null default '{}'::jsonb,
  question_bank jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── classes (denormalized from settings.classes for queryability) ───────────
create table if not exists public.classes (
  id text primary key,
  school_id text not null references public.schools(id) on delete cascade,
  name text,
  label text,
  grade text,
  section text,
  sort_order int default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists classes_school_id_idx on public.classes(school_id);

-- ─── app users (school principals / operators / teachers) ────────────────────
create table if not exists public.app_users (
  id text primary key,
  email text not null,
  password_hash text not null,
  school_id text references public.schools(id) on delete set null,
  user_type text not null default 'school',
  blocked boolean not null default false,
  display_name text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists app_users_email_lower_idx
  on public.app_users (lower(email));
create index if not exists app_users_school_id_idx on public.app_users(school_id);

-- ─── students ────────────────────────────────────────────────────────────────
create table if not exists public.students (
  id text primary key,
  school_id text not null references public.schools(id) on delete cascade,
  class_id text,
  admission_no text,
  roll_no text,
  name text not null default '',
  father_name text default '',
  dob text default '',
  bay_form text default '',
  father_cnic text default '',
  whatsapp text default '',
  photo text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists students_school_id_idx on public.students(school_id);
create index if not exists students_class_id_idx on public.students(class_id);
create unique index if not exists students_school_admission_uidx
  on public.students (school_id, admission_no)
  where admission_no is not null and admission_no <> '';

-- ─── staff profiles ──────────────────────────────────────────────────────────
create table if not exists public.staff_profiles (
  id text primary key,
  school_id text not null references public.schools(id) on delete cascade,
  photo text,
  staff_category text,
  cpn text,
  name text,
  fname text,
  cnic text,
  bps text,
  designation text,
  dob text,
  domicile text,
  aq text,
  subj text,
  pq text,
  doe text,
  dprs text,
  dppp text,
  daps text,
  contact text,
  email text,
  bank_name text,
  acc_no text,
  iban text,
  bank_code text,
  branch text,
  address text,
  emergency_contact text,
  employee_status text,
  department text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists staff_profiles_school_id_idx on public.staff_profiles(school_id);

-- ─── staff transfer / retired history ────────────────────────────────────────
create table if not exists public.staff_transfer_history (
  id text primary key default gen_random_uuid()::text,
  school_id text not null references public.schools(id) on delete cascade,
  staff_id text,
  payload jsonb not null default '{}'::jsonb,
  transferred_at timestamptz default now()
);
create index if not exists staff_transfer_history_school_id_idx
  on public.staff_transfer_history(school_id);

create table if not exists public.retired_staff (
  id text primary key default gen_random_uuid()::text,
  school_id text not null references public.schools(id) on delete cascade,
  staff_id text,
  payload jsonb not null default '{}'::jsonb,
  retired_at timestamptz default now()
);
create index if not exists retired_staff_school_id_idx on public.retired_staff(school_id);

-- ─── academic sessions + exam data ───────────────────────────────────────────
create table if not exists public.exam_sessions (
  id text primary key default gen_random_uuid()::text,
  school_id text not null references public.schools(id) on delete cascade,
  session_label text not null,
  exam_tm jsonb not null default '{}'::jsonb,
  exam_om jsonb not null default '{}'::jsonb,
  exam_datesheet jsonb not null default '{"dates":[],"cols":[],"subs":{},"note":""}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, session_label)
);
create index if not exists exam_sessions_school_id_idx on public.exam_sessions(school_id);

-- ─── attendance ──────────────────────────────────────────────────────────────
-- key pattern in app: "{classId}_{YYYY-MM-DD}" → { studentId: "P"|"A"|"L" }
create table if not exists public.attendance_records (
  id text primary key default gen_random_uuid()::text,
  school_id text not null references public.schools(id) on delete cascade,
  class_id text not null,
  attendance_date date not null,
  student_id text not null,
  status text not null check (status in ('P', 'A', 'L')),
  application jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, class_id, attendance_date, student_id)
);
create index if not exists attendance_school_date_idx
  on public.attendance_records(school_id, attendance_date);

-- ─── fees ────────────────────────────────────────────────────────────────────
create table if not exists public.fee_records (
  id text primary key default gen_random_uuid()::text,
  school_id text not null references public.schools(id) on delete cascade,
  class_id text,
  student_id text,
  month int not null check (month between 1 and 12),
  year int not null,
  amount numeric(12,2) not null default 20,
  paid_at timestamptz default now(),
  meta jsonb not null default '{}'::jsonb,
  unique (school_id, class_id, student_id, month, year)
);
create index if not exists fee_records_school_id_idx on public.fee_records(school_id);

-- ─── library ─────────────────────────────────────────────────────────────────
create table if not exists public.library_books (
  id text primary key,
  school_id text not null references public.schools(id) on delete cascade,
  title text,
  author text,
  copies int not null default 1,
  meta jsonb not null default '{}'::jsonb,
  added_at timestamptz default now()
);
create index if not exists library_books_school_id_idx on public.library_books(school_id);

create table if not exists public.library_borrowings (
  id text primary key,
  school_id text not null references public.schools(id) on delete cascade,
  book_id text not null references public.library_books(id) on delete cascade,
  student_id text,
  borrower_name text,
  issued_at timestamptz default now(),
  returned_at timestamptz,
  meta jsonb not null default '{}'::jsonb
);
create index if not exists library_borrowings_school_id_idx
  on public.library_borrowings(school_id);

-- ─── about / discussion messages ─────────────────────────────────────────────
create table if not exists public.discussion_messages (
  id text primary key default gen_random_uuid()::text,
  author text,
  body text not null,
  created_at timestamptz not null default now()
);

-- ─── updated_at trigger ──────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists schools_set_updated_at on public.schools;
create trigger schools_set_updated_at
  before update on public.schools
  for each row execute function public.set_updated_at();

drop trigger if exists app_users_set_updated_at on public.app_users;
create trigger app_users_set_updated_at
  before update on public.app_users
  for each row execute function public.set_updated_at();

drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

drop trigger if exists staff_profiles_set_updated_at on public.staff_profiles;
create trigger staff_profiles_set_updated_at
  before update on public.staff_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists exam_sessions_set_updated_at on public.exam_sessions;
create trigger exam_sessions_set_updated_at
  before update on public.exam_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists attendance_records_set_updated_at on public.attendance_records;
create trigger attendance_records_set_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- ─── Row Level Security (open for anon key during app migration; tighten later)
alter table public.schools enable row level security;
alter table public.classes enable row level security;
alter table public.app_users enable row level security;
alter table public.students enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.staff_transfer_history enable row level security;
alter table public.retired_staff enable row level security;
alter table public.exam_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.fee_records enable row level security;
alter table public.library_books enable row level security;
alter table public.library_borrowings enable row level security;
alter table public.discussion_messages enable row level security;

-- Temporary permissive policies so the client can connect with the anon key.
-- Replace with auth.uid()-scoped policies once Supabase Auth is wired.
do $$
declare
  t text;
begin
  foreach t in array array[
    'schools','classes','app_users','students','staff_profiles',
    'staff_transfer_history','retired_staff','exam_sessions',
    'attendance_records','fee_records','library_books',
    'library_borrowings','discussion_messages'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_all_access', t);
    execute format(
      'create policy %I on public.%I for all using (true) with check (true)',
      t || '_all_access', t
    );
  end loop;
end $$;

-- Expose tables to PostgREST
grant usage on schema public to anon, authenticated;
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
