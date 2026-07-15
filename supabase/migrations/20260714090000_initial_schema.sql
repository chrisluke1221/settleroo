-- RoomTab landlord/property schema, reconstructed from the old
-- lwhmjxzkstckruvxbzek project's db_cluster backup (2025-08-13).
-- Run this first, in the Supabase SQL Editor of the NEW project
-- (trfaqjkkozusxdvqnkgo).

create extension if not exists "pgcrypto";

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = '';

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  description text,
  landlord_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  email text,
  phone text,
  room text not null,
  move_in_date date not null,
  move_out_date date,
  current_balance numeric(10,2) default 0,
  payment_status text default 'pending' check (payment_status in ('paid','pending','overdue')),
  number_of_occupants integer not null default 1 check (number_of_occupants > 0),
  landlord_id uuid references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  bill_type text not null,
  total_amount numeric not null,
  billing_period_start date not null,
  billing_period_end date not null,
  landlord_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bill_splits (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tenant_name text not null,
  room text not null,
  number_of_occupants integer not null,
  occupancy_days integer not null,
  person_days integer not null,
  percentage numeric not null,
  owed_amount numeric not null,
  occupancy_start date not null,
  occupancy_end date not null,
  landlord_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index idx_bills_created_at on public.bills(created_at desc);
create index idx_bill_splits_bill_id on public.bill_splits(bill_id);
create index idx_bill_splits_tenant_id on public.bill_splits(tenant_id);

create trigger update_properties_updated_at before update on public.properties
  for each row execute function public.update_updated_at_column();
create trigger update_tenants_updated_at before update on public.tenants
  for each row execute function public.update_updated_at_column();
create trigger update_bills_updated_at before update on public.bills
  for each row execute function public.update_updated_at_column();

alter table public.properties enable row level security;
alter table public.tenants enable row level security;
alter table public.bills enable row level security;
alter table public.bill_splits enable row level security;

create policy "Landlords can view their own properties" on public.properties for select using (auth.uid() = landlord_id);
create policy "Landlords can create their own properties" on public.properties for insert with check (auth.uid() = landlord_id);
create policy "Landlords can update their own properties" on public.properties for update using (auth.uid() = landlord_id);
create policy "Landlords can delete their own properties" on public.properties for delete using (auth.uid() = landlord_id);

create policy "Landlords can view their tenants" on public.tenants for select using (auth.uid() = landlord_id);
create policy "Landlords can create tenants" on public.tenants for insert with check (auth.uid() = landlord_id);
create policy "Landlords can update their tenants" on public.tenants for update using (auth.uid() = landlord_id);
create policy "Landlords can delete their tenants" on public.tenants for delete using (auth.uid() = landlord_id);

create policy "Landlords can view their bills" on public.bills for select using (auth.uid() = landlord_id);
create policy "Landlords can create bills" on public.bills for insert with check (auth.uid() = landlord_id);
create policy "Landlords can update their bills" on public.bills for update using (auth.uid() = landlord_id);
create policy "Landlords can delete their bills" on public.bills for delete using (auth.uid() = landlord_id);

create policy "Landlords can view their bill splits" on public.bill_splits for select using (auth.uid() = landlord_id);
create policy "Landlords can create bill splits" on public.bill_splits for insert with check (auth.uid() = landlord_id);
create policy "Landlords can update their bill splits" on public.bill_splits for update using (auth.uid() = landlord_id);
create policy "Landlords can delete their bill splits" on public.bill_splits for delete using (auth.uid() = landlord_id);

grant all on function public.update_updated_at_column() to anon, authenticated, service_role;
