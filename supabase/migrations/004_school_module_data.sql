-- Extra module data that lived only in localStorage (daily register, library rules/fines,
-- fee concessions/expenses, staff attendance). Synced worldwide via school_module_data.

create table if not exists public.school_module_data (
  school_id text not null references public.schools(id) on delete cascade,
  module_key text not null,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (school_id, module_key)
);

create index if not exists school_module_data_school_id_idx
  on public.school_module_data(school_id);

drop trigger if exists school_module_data_set_updated_at on public.school_module_data;
create trigger school_module_data_set_updated_at
  before update on public.school_module_data
  for each row execute function public.set_updated_at();

alter table public.school_module_data enable row level security;

drop policy if exists school_module_data_all_access on public.school_module_data;
create policy school_module_data_all_access
  on public.school_module_data
  for all using (true) with check (true);

grant all on public.school_module_data to anon, authenticated;
