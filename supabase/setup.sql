-- ============================================================
-- Site do Ezra: banco, regras de acesso e fotos
-- Rode este arquivo inteiro uma vez no SQL Editor do Supabase.
-- ============================================================

-- 1. Quem é o dono do site (uma linha só, preenchida no passo 5 do guia)
create table if not exists public.site_owner (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.site_owner enable row level security;
-- Sem nenhuma regra de acesso: ninguém lê nem altera esta tabela pelo site.

-- 2. Função que responde "quem está logado é o dono?"
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.site_owner where user_id = auth.uid());
$$;
revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to anon, authenticated;

-- 3. Conteúdo do site (tramas, textos, meta, aviso e registro de cenas)
create table if not exists public.docs (
  path text primary key
    check (char_length(path) between 3 and 300 and path ~ '^[A-Za-z0-9_.~:@+/-]+$'),
  data jsonb not null
    check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 262144),
  updated_at timestamptz not null default now()
);
alter table public.docs enable row level security;

drop policy if exists "leitura publica" on public.docs;
drop policy if exists "dono insere" on public.docs;
drop policy if exists "dono altera" on public.docs;
drop policy if exists "dono apaga" on public.docs;

-- Todo mundo lê o que é público. O que começa com "data/" (registro de cenas) só o dono lê.
create policy "leitura publica" on public.docs
  for select using (path not like 'data/%' or public.is_owner());
-- Só o dono grava, altera e apaga.
create policy "dono insere" on public.docs
  for insert with check (public.is_owner());
create policy "dono altera" on public.docs
  for update using (public.is_owner()) with check (public.is_owner());
create policy "dono apaga" on public.docs
  for delete using (public.is_owner());

-- 4. Fotos: leitura pública, envio só do dono, até 5 MB, só imagens
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "dono envia fotos" on storage.objects;
drop policy if exists "dono altera fotos" on storage.objects;
drop policy if exists "dono apaga fotos" on storage.objects;

create policy "dono envia fotos" on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos' and public.is_owner());
create policy "dono altera fotos" on storage.objects
  for update to authenticated using (bucket_id = 'fotos' and public.is_owner());
create policy "dono apaga fotos" on storage.objects
  for delete to authenticated using (bucket_id = 'fotos' and public.is_owner());

-- ============================================================
-- 5. Depois de criar o seu usuário (passo 4 do guia), rode SÓ a linha abaixo,
--    trocando o e-mail pelo seu:
--
-- insert into public.site_owner (user_id) select id from auth.users where email = 'seu@email.com';
-- ============================================================
