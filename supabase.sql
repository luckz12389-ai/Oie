-- Cole TUDO isto no Supabase > SQL Editor > Run

create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  email text, name text, avatar text,
  role text not null default 'user' check (role in ('user','admin','owner')),
  created_at timestamptz default now()
);
create table if not exists posts (
  id bigint generated always as identity primary key,
  section text not null check (section in ('logs','game')),
  title text not null, body text, image_url text,
  author_id uuid references profiles(id) on delete set null,
  author_name text, author_role text,
  created_at timestamptz default now()
);
create table if not exists admin_codes (
  code text primary key,
  created_by uuid references profiles(id) on delete set null,
  used_by uuid references profiles(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz default now()
);

create or replace function my_role() returns text
language sql security definer set search_path=public stable as
$$ select role from profiles where id = auth.uid() $$;

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  insert into profiles(id,email,name,avatar) values(
    new.id, new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'user_name', 'User'),
    coalesce(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture')
  ) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();

create or replace function redeem_code(c text) returns text
language plpgsql security definer set search_path=public as $$
declare k text;
begin
  update admin_codes set used_by=auth.uid(), used_at=now()
   where code=c and used_by is null returning code into k;
  if k is null then raise exception 'invalid_code'; end if;
  update profiles set role='admin' where id=auth.uid() and role='user';
  return 'ok';
end $$;

alter table profiles enable row level security;
alter table posts enable row level security;
alter table admin_codes enable row level security;

create policy "profiles_read" on profiles for select to authenticated using (true);
create policy "posts_read" on posts for select to authenticated using (true);
create policy "posts_insert" on posts for insert to authenticated with check (
  (section='logs' and my_role() in ('admin','owner')) or
  (section='game' and my_role()='owner')
);
create policy "posts_delete" on posts for delete to authenticated using (my_role()='owner');
create policy "codes_owner_all" on admin_codes for all to authenticated
  using (my_role()='owner') with check (my_role()='owner');

insert into storage.buckets (id,name,public) values ('images','images',true) on conflict do nothing;
create policy "images_read" on storage.objects for select using (bucket_id='images');
create policy "images_upload" on storage.objects for insert to authenticated
  with check (bucket_id='images' and my_role() in ('admin','owner'));

-- DEPOIS de entrar no site pela 1ª vez, rode isto com SEU e-mail para virar Owner:
-- update profiles set role='owner' where email='SEU_EMAIL_AQUI';
